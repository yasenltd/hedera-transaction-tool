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

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let transactionPage: TransactionPage;
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
});
