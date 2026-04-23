import { expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import {
  createLocalOnlyOrganizationServerUrl,
  createLocalOrganizationConnectionForTesting,
  deleteLocalOrganizationConnectionForTesting,
} from '../helpers/support/localOrganizationConnectionSupport.js';

let app: TransactionToolApp;
let window: Page;

let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';
let updatedOrganizationNickname = 'New Organization';
let invalidOrganizationNickname = 'Bad Organization';

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Settings (General) tests @organization-basic', () => {
  test.slow();
  test.beforeAll(async () => {
    ({ app, window, loginPage, transactionPage, organizationPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));
    settingsPage = new SettingsPage(window);
    registrationPage = new RegistrationPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    updatedOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Updated Organization',
    );
    invalidOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Invalid Organization',
    );

    await createSeededOrganizationSession(window, loginPage, organizationPage, {
      userCount: 1,
      organizationNickname,
    });
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Tests can end in personal mode or after deleting the organization.
      // The next beforeEach recreates the full fixture.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify user can switch between personal and organization mode', async () => {
    // Organization selector should list all connected orgs (plus personal mode).
    await organizationPage.clickOnSelectModeDropdown();
    const modeItemCount = await organizationPage.countModeSelectionItems();
    const modeItemTexts: string[] = [];
    for (let i = 0; i < modeItemCount; i++) {
      modeItemTexts.push((await organizationPage.getModeSelectionItemText(i)) ?? '');
    }
    const modeMenuText = modeItemTexts.join(' ');
    expect(modeMenuText).toContain('Personal');
    expect(modeMenuText).toContain(organizationNickname);

    // Switch to personal mode.
    await organizationPage.selectModeByIndex(0);
    const isContactListHidden = await organizationPage.isContactListButtonHidden();
    expect(isContactListHidden).toBe(true);

    // Notifications tab should not be available in personal mode.
    await settingsPage.clickOnSettingsButton();
    expect(await settingsPage.isNotificationsTabVisible()).toBe(false);

    // Delay the first organization-server request so we can reliably observe the global loader.
    await organizationPage.delayFirstOrganizationServerRequest(process.env.ORGANIZATION_URL ?? '');

    await organizationPage.selectOrganizationMode();

    expect(await organizationPage.isGlobalLoaderModalVisible(2000)).toBe(true);
    expect(await organizationPage.isGlobalLoaderSpinnerVisible(2000)).toBe(true);
    expect(await organizationPage.isGlobalLoaderModalHidden(15000)).toBe(true);

    await organizationPage.stopDelayingOrganizationServerRequest();
    const isContactListVisibleAfterSwitch = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisibleAfterSwitch).toBe(true);

    // Notifications tab should be available in organization mode.
    await settingsPage.clickOnSettingsButton();
    expect(await settingsPage.isNotificationsTabVisible()).toBe(true);
  });

  test('Verify contact list menu item navigates to /contact-list', async () => {
    await organizationPage.clickOnContactListButton();
    await expect.poll(() => window.url()).toContain('/contact-list');
  });

  test('Verify default organization can be selected from dropdown', async () => {
    await organizationPage.selectPersonalMode();
    await settingsPage.clickOnSettingsButton();

    await settingsPage.selectDefaultOrganizationByLabel('None');
    expect(await settingsPage.getSelectedDefaultOrganizationLabel()).toContain('None');

    await settingsPage.selectDefaultOrganizationByLabel(organizationNickname);
    expect(await settingsPage.getSelectedDefaultOrganizationLabel()).toContain(
      organizationNickname,
    );
  });

  test('Verify user can edit organization nickname', async ({}, testInfo) => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();

    // 3.4.11: Saving a blank org nickname shows validation toast.
    await organizationPage.updateOrganizationNicknameAtIndex(0, '');
    await registrationPage.waitForToastMessageByVariant('error', 'Nickname cannot be empty');
    await loginPage.waitForToastToDisappear();
    expect((await organizationPage.getOrganizationNicknameText())?.trim()).toBe(
      organizationNickname,
    );

    // 3.4.7: Nickname is editable inline.
    await organizationPage.editOrganizationNickname(updatedOrganizationNickname);
    const orgName = await organizationPage.getOrganizationNicknameText();
    expect(orgName).toBe(updatedOrganizationNickname);
    await organizationPage.editOrganizationNickname(organizationNickname);

    // 3.4.12: Editing org nickname to an already-used name shows validation toast.
    // Seed the second local connection directly because CI provisions only one
    // live organization server, while the UI rejects duplicate server URLs.
    const secondOrganizationNickname = `${organizationNickname} (2)`;
    const secondOrganizationServerUrl = createLocalOnlyOrganizationServerUrl(testInfo);
    await createLocalOrganizationConnectionForTesting(
      window,
      secondOrganizationNickname,
      secondOrganizationServerUrl,
    );
    await organizationPage.waitForElementToBeVisible(
      organizationPage.editNicknameOrganizationButtonSelector,
      organizationPage.getLongTimeout(),
      1,
    );

    try {
      await organizationPage.updateOrganizationNicknameAtIndex(1, organizationNickname);
      await registrationPage.waitForToastMessageByVariant('error', 'Nickname already exists');
    } finally {
      await deleteLocalOrganizationConnectionForTesting(window, secondOrganizationServerUrl);
    }
  });

  test('Verify error message when user adds non-existing organization', async () => {
    await loginPage.waitForToastToDisappear();
    await organizationPage.setupWrongOrganization(invalidOrganizationNickname);
    const toastMessage = await registrationPage.waitForToastMessageByVariant(
      'error',
      'Organization does not exist. Please check the server URL',
    );
    expect(toastMessage).toBe('Organization does not exist. Please check the server URL');
    await organizationPage.clickOnCancelAddingOrganizationButton();
    await loginPage.waitForToastToDisappear();
  });

  test('Verify that tabs on Transaction page are visible', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    expect(await organizationPage.returnAllTabsVisible()).toBe(true);
  });

  test('Verify "Import Signatures from File" option is available in organization mode', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnTransactionFileActionsDropdown();
    const isVisible = await transactionPage.isImportSignaturesFromFileOptionVisible();
    expect(isVisible).toBe(true);
  });

  test('Verify user can delete an organization', async () => {
    await organizationPage.selectPersonalMode();
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await loginPage.waitForToastToDisappear();
    await organizationPage.clickOnDeleteFirstOrganization();
    const visibleToasts = window.locator(registrationPage.visibleToastMessageSelector);
    await expect
      .poll(
        async () => {
          const toastTexts = await visibleToasts.allTextContents();
          return toastTexts.map(toast => toast.trim()).includes('Connection deleted successfully');
        },
        {
          timeout: registrationPage.getLongTimeout(),
        },
      )
      .toBe(true);
    const orgName = (await organizationPage.getOrganizationNicknameText()) ?? '';
    const isDeletedFromDb = await organizationPage.verifyOrganizationExists(orgName);
    expect(isDeletedFromDb).toBe(false);
  });

  test('Verify that deleting all keys prevent to sign and execute a draft transaction', async () => {
    // This test is a copy of transactionTests.test.ts 'Verify that deleting all keys prevent to sign and execute a draft transaction'
    // If you fix something here, you probably want to do the same in transactionTests.test.ts

    // Go to Settings / Keys and delete all keys
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnSelectAllKeys();
    await settingsPage.clickOnDeleteKeyAllButton();
    await settingsPage.clickOnDeleteKeyPairButton();

    // Go to Transactions and fill a new Account Update transaction
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await transactionPage.fillInPayerAccountId('0.0.1002');
    await transactionPage.fillInMaxAutoAssociations('0'); // Workaround for -1 bug in maxAutoAssociations
    await transactionPage.fillInUpdatedAccountId('0.0.1002'); // Called last because it waits for sign and submit activation

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnSaveGotoSettings();
    await settingsPage.verifySettingsElements();

    // Go back to Transactions / Drafs
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnDraftsMenuButton();

    // Click Continue to edit draft transaction
    await transactionPage.clickOnFirstDraftContinueButton();

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await new Promise(resolve => setTimeout(resolve, transactionPage.getShortTimeout()));
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnGotoSettings();
    await settingsPage.verifySettingsElements();
  });
});
