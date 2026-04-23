import { expect, Page, test } from '@playwright/test';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { ContactListPage } from '../../pages/ContactListPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { generateRandomEmail } from '../../utils/data/random.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { closeApp, setupApp } from '../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import { signInOrganizationUser } from '../helpers/support/organizationAuthSupport.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  resetBackendStateForSuite,
  resetBackendStateForTeardown,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { isUserAdmin } from '../../utils/db/databaseQueries.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
let globalCredentials = { email: '', password: '' };
let organizationPage: OrganizationPage;
let contactListPage: ContactListPage;
let loginPage: LoginPage;
let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let adminUser: UserDetails;
let regularUser: UserDetails;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Contact List tests @organization-basic', () => {
  test.slow();
  test.beforeAll(async () => {
    isolationContext = await activateSuiteIsolation(test.info());
    await resetLocalStateForSuite();
    await resetBackendStateForSuite();
    ({ app, window } = await setupApp());
    organizationPage = new OrganizationPage(window);
    contactListPage = new ContactListPage(window);
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    transactionPage = new TransactionPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 2,
        organizationNickname,
        signInUserIndex: null,
        setupPersonalTransactions: false,
        setupOrganizationTransactions: false,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;

    adminUser = organizationPage.getUser(0);
    regularUser = organizationPage.getUser(1);
    await contactListPage.upgradeUserToAdmin(adminUser.email);
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Some attach-mode reruns fail before the org session is fully established.
      // The next beforeEach recreates a fresh fixture, so this cleanup stays best-effort.
    }
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await resetBackendStateForTeardown();
    await cleanupIsolation(isolationContext);
  });

  test('Verify associated accounts are displayed', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    const result = await contactListPage.verifyAssociatedAccounts();
    expect(result).toBe(true);
  });

  test('Verify user can change nickname', async () => {
    await signInOrganizationUser(organizationPage, regularUser, globalCredentials.password);
    const newNickname = 'Test-Nickname';
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    await contactListPage.clickOnChangeNicknameButton();
    await contactListPage.fillInContactNickname(newNickname);
    await contactListPage.clickOnAccountInContactListByEmail(adminUser.email);
    const nickNameText = await contactListPage.getContactNicknameText(newNickname);
    expect(nickNameText).toBe(newNickname);
  });

  test('Verify admin user can add new user to the organization', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const newUserEmail = generateRandomEmail();
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    const isUserAdded = await contactListPage.verifyUserExistsInOrganization(newUserEmail);
    expect(isUserAdded).toBe(true);
  });

  test('Verify admin user can remove user from the organization', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const newUserEmail = generateRandomEmail();
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);
    await contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await contactListPage.clickOnRemoveContactButton();
    expect(await contactListPage.isConfirmRemoveContactButtonVisible()).toBe(true);
    await contactListPage.clickOnConfirmRemoveContactButton();
    const isUsedDeleted = await contactListPage.isUserDeleted(newUserEmail);
    expect(isUsedDeleted).toBe(true);
  });

  test('Verify adding user with invalid email shows error', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const malformedEmail = 'not-a-valid-email';
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(malformedEmail);

    // The malformed email should not be registered in the organization
    const isUserRegistered = await contactListPage.verifyUserExistsInOrganization(malformedEmail);
    expect(isUserRegistered).toBe(false);
  });

  test('Verify admin bulk user registration supports comma-separated emails and error states', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    await organizationPage.clickOnContactListButton();

    // 10.2.6: bulk add multiple users
    const bulkUser1 = generateRandomEmail();
    const bulkUser2 = generateRandomEmail();
    await contactListPage.clickOnAddNewContactButton();
    await contactListPage.enableMultipleEmailsMode();
    await contactListPage.fillMultipleEmails(`${bulkUser1}, ${bulkUser2}`);
    await contactListPage.registerUsers();
    expect(await contactListPage.verifyUserExistsInOrganization(bulkUser1)).toBe(true);
    expect(await contactListPage.verifyUserExistsInOrganization(bulkUser2)).toBe(true);

    // 10.2.12: invalid email list yields `Invalid emails: ...` toast and stays on the page
    await organizationPage.clickOnContactListButton();
    await contactListPage.clickOnAddNewContactButton();
    await contactListPage.enableMultipleEmailsMode();
    const invalidEmail = 'not-a-valid-email';
    await contactListPage.fillMultipleEmails(`${generateRandomEmail()}, ${invalidEmail}`);
    await contactListPage.registerUsers();
    await registrationPage.waitForToastMessageByVariant('error', `Invalid emails: ${invalidEmail}`);

    // 10.2.13: partial bulk add (existing + new) shows `Failed to sign up users with emails: ...`
    // 10.2.14: single add with existing email shows `Failed to sign up user`
    const partialNewUser = generateRandomEmail();
    await contactListPage.fillMultipleEmails(`${regularUser.email}, ${partialNewUser}`);
    await contactListPage.registerUsers();
    await registrationPage.waitForToastMessageByVariant(
      'error',
      `Failed to sign up users with emails: ${regularUser.email}`,
    );
    expect(await contactListPage.verifyUserExistsInOrganization(partialNewUser)).toBe(true);

    // Single mode "already exists" error
    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(regularUser.email);
    await registrationPage.waitForToastMessageByVariant('error', 'Failed to sign up user');
  });

  test('Verify admin can elevate a user to admin role', async () => {
    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);
    const newUserEmail = generateRandomEmail();

    await organizationPage.clickOnContactListButton();
    await contactListPage.addNewUser(newUserEmail);

    await expect.poll(() => contactListPage.isContactVisible(newUserEmail)).toBe(true);
    await contactListPage.clickOnAccountInContactListByEmail(newUserEmail);
    await contactListPage.clickOnElevateContactButton();

    // 10.2.11: elevate modal appears
    expect(await contactListPage.isConfirmElevateContactButtonVisible()).toBe(true);
    await contactListPage.clickOnConfirmElevateContactButton();
    await registrationPage.waitForToastMessageByVariant('success', 'elevate to admin successfully');

    // 10.2.10: elevated role reflected in backend
    await expect.poll(() => isUserAdmin(newUserEmail)).toBe(true);
  });

  test('Verify adding a duplicate approver to a transaction shows `User already exists in the list` error', async () => {
    test.skip(
      true,
      'Approvers UI is feature-flagged off (FEATURE_APPROVERS_ENABLED=false). Enable it to run this test.',
    );

    await signInOrganizationUser(organizationPage, adminUser, globalCredentials.password);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    // Open Approvers and create a complex approver structure.
    await transactionPage.clickOnAddApproverButton();
    await transactionPage.clickOnComplexApproverTab();

    // Add a user to the structure, then attempt to add the same user again.
    await transactionPage.addFirstUserToComplexApproverStructure();
    await transactionPage.addFirstUserToComplexApproverStructure();

    const errorToast = await registrationPage.getToastMessageByVariant('error');
    expect(errorToast).toContain('User already exists in the list');
  });
});
