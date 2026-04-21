import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { PrivateKey } from '@hiero-ledger/sdk';
import { RegistrationPage } from '../../pages/RegistrationPage.js';

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let transactionPage: TransactionPage;
let registrationPage: RegistrationPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings general tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
    transactionPage = new TransactionPage(window);
    registrationPage = new RegistrationPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
    await settingsPage.clickOnSettingsButton();
  });

  test('Verify that all elements in settings page are present', async () => {
    const allElementsVisible = await settingsPage.verifySettingsElements();
    expect(allElementsVisible).toBe(true);
  });

  test('Verify user can switch between Dark and Light themes', async () => {
    await settingsPage.clickOnDarkThemeTab();
    expect(await settingsPage.isDarkThemeTabActive()).toBe(true);

    await settingsPage.clickOnLightThemeTab();
    expect(await settingsPage.isLightThemeTabActive()).toBe(true);
  });

  test('Verify app version info is displayed', async () => {
    await settingsPage.clickOnGeneralTab();
    expect(await settingsPage.isAppVersionVisible()).toBe(true);
    expect(await settingsPage.getAppVersionText()).toBeTruthy();
  });

  test('Verify user can switch to Custom and enter mirror node base URL', async () => {
    const customMirrorNodeBaseURL = 'https://mainnet-public.mirrornode.hedera.com:443/';

    await settingsPage.clickOnCustomNodeTab();
    expect(await settingsPage.isCustomNodeTabActive()).toBe(true);
    expect(await settingsPage.isMirrorNodeBaseURLInputVisible()).toBe(true);

    await settingsPage.fillInMirrorNodeBaseURL(customMirrorNodeBaseURL);
    await settingsPage.applyMirrorNodeBaseURL();

    const mirrorNodeBaseURL = await settingsPage.getMirrorNodeBaseURL();
    expect(mirrorNodeBaseURL).toBe('mainnet-public.mirrornode.hedera.com');
  });

  test('Verify user can set global max tx fee', async () => {
    const maxTransactionFee = '5';
    await settingsPage.fillInDefaultMaxTransactionFee(maxTransactionFee);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const transactionFee = await transactionPage.getMaxTransactionFee();
    expect(transactionFee).toBe(maxTransactionFee);
  });

  test('Verify date/time display format preference can be changed', async () => {
    await settingsPage.selectDateTimeFormatLocalTime();
    expect(await settingsPage.getSelectedDateTimeFormatLabel()).toContain('Local Time');

    await settingsPage.selectDateTimeFormatUtcTime();
    expect(await settingsPage.getSelectedDateTimeFormatLabel()).toContain('UTC Time');
  });

  test('Verify organizations empty state and invalid server URL validation', async () => {
    await settingsPage.clickOnOrganisationsTab();
    await expect(window.getByText('There are no connected organizations.', { exact: true })).toBeVisible();

    await window.getByRole('button', { name: 'Connect now', exact: true }).click();
    await window.getByTestId('input-server-url').fill('not-a-url');
    await window.getByTestId('button-add-organization-in-modal').click();

    const toastText = await registrationPage.getToastMessageByVariant('error');
    expect(toastText).toContain('Invalid Server URL');
  });

  test('Verify user can manage public key mappings (import, rename, copy, delete)', async () => {
    await settingsPage.clickOnPublicKeysTab();

    // Table headers
    const headers = await window.locator('.table-custom thead th').allTextContents();
    const headerText = headers.map(h => h.trim()).join(' ');
    expect(headerText).toContain('Nickname');
    expect(headerText).toContain('Owner');
    expect(headerText).toContain('Public Key');

    // Import modal and disabled state
    await window.getByTestId('button-import-public-dropdown').click();
    await window.getByTestId('import-single-public-key').click();
    await expect(window.getByTestId('button-public-key-import')).toBeDisabled();

    // Invalid key shows error
    await window.getByTestId('input-public-key-mapping').fill('invalid-key');
    await window.getByTestId('input-public-key-nickname').fill('Bad Key');
    await expect(window.getByTestId('button-public-key-import')).toBeEnabled();
    await window.getByTestId('button-public-key-import').click();
    expect(await registrationPage.getToastMessageByVariant('error')).toContain('Invalid public key!');

    // Import 2 valid mappings (for bulk delete)
    const key1 = PrivateKey.generateED25519().publicKey.toString();
    const key2 = PrivateKey.generateED25519().publicKey.toString();

    await window.getByTestId('input-public-key-mapping').fill(key1);
    await window.getByTestId('input-public-key-nickname').fill('Key One');
    await window.getByTestId('button-public-key-import').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain('imported successfully');

    await window.getByTestId('button-import-public-dropdown').click();
    await window.getByTestId('import-single-public-key').click();
    await window.getByTestId('input-public-key-mapping').fill(key2);
    await window.getByTestId('input-public-key-nickname').fill('Key Two');
    await window.getByTestId('button-public-key-import').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain('imported successfully');

    // Copy public key shows success toast
    await window.getByTestId('span-copy-public-key-0').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain(
      'Public Key copied successfully',
    );

    // Rename the first mapping
    await window.getByTestId('button-change-key-nickname').first().click();
    await window.getByTestId('input-public-key-nickname').fill('Key One Renamed');
    await window.getByTestId('button-confirm-update-nickname').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain(
      'Nickname updated successfully',
    );
    expect(await window.getByTestId('cell-public-nickname-0').textContent()).toContain(
      'Key One Renamed',
    );

    // Delete a single mapping via the row trash button
    await window.getByTestId('button-delete-key-1').click();
    await window.getByTestId('button-delete-public-key-mapping').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain('deleted successfully');

    // Bulk delete remaining via select-all
    await window.getByTestId('checkbox-select-all-public-keys').click();
    await window.getByTestId('button-delete-public-all').click();
    await window.getByTestId('button-delete-public-key-mapping').click();
    expect(await registrationPage.getToastMessageByVariant('success')).toContain('deleted successfully');
  });
});
