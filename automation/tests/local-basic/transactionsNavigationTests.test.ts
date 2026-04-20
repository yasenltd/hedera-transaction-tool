import { expect, Page, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { GroupPage } from '../../pages/GroupPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let groupPage: GroupPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Transactions navigation tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    groupPage = new GroupPage(window);
    await createSeededLocalUserSession(window, loginPage);
  });

  async function navigateToCreateGroupPage() {
    await transactionPage.clickOnTransactionsMenuButton();
    await groupPage.navigateToGroupTransaction();
    expect(await groupPage.verifyGroupElements()).toBe(true);
  }

  test('Transactions page shows Drafts and History tabs', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    expect(await transactionPage.isDraftsTabVisible()).toBe(true);
    expect(await transactionPage.isHistoryTabVisible()).toBe(true);
  });

  test('"Create New" dropdown shows Transaction and Transaction Group options', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewDropdown();

    expect(await transactionPage.isTransactionOptionVisible()).toBe(true);
    expect(await transactionPage.isTransactionGroupOptionVisible()).toBe(true);
  });

  test('Selecting "Transaction" opens TransactionSelectionModal', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewDropdown();
    await transactionPage.clickOnSingleTransactionButton();

    expect(await transactionPage.isTransactionSelectionModalVisible()).toBe(true);
  });

  test('Selecting "Transaction Group" navigates to create-transaction-group', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewDropdown();
    await transactionPage.clickOnTransactionGroupButton();

    await expect.poll(async () => window.url()).toContain('create-transaction-group');
  });

  test('Selecting "Sign Transactions from File" opens sign-from-file modal', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnTransactionFileActionsDropdown();
    await transactionPage.clickOnSignTransactionsFromFileOption();

    expect(await transactionPage.isSignTransactionFileButtonVisible()).toBe(true);
  });

  test('Transaction selection modal displays all transaction categories', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewDropdown();
    await transactionPage.clickOnSingleTransactionButton();

    expect(await transactionPage.areTransactionSelectionGroupsVisible()).toBe(true);
  });

  test('Selecting transaction type from modal navigates to type page', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewDropdown();
    await transactionPage.clickOnSingleTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    expect(await transactionPage.getTransactionTypeHeaderText()).toContain('Create Account');
    expect(await transactionPage.verifyAccountCreateTransactionElements()).toBe(true);
  });

  test('Drafts empty state shows EmptyTransactions component', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnDraftsMenuButton();

    expect(await transactionPage.isEmptyTransactionsTextVisible()).toBe(true);
    expect(await transactionPage.getEmptyTransactionsText()).toContain(
      'There are no Transactions at the moment.',
    );
  });

  test('Saving transaction group with no description shows validation error', async () => {
    await navigateToCreateGroupPage();
    await groupPage.clickOnSaveGroupButton();

    const toastMessage = await groupPage.getToastMessage(true);
    expect(toastMessage).toContain('Please enter a group description');
  });

  test('Sign and submit with empty description shows validation toast', async () => {
    await navigateToCreateGroupPage();
    await groupPage.clickOnAddTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await groupPage.clickAddToGroupButton();
    await groupPage.fillDescription('');
    await groupPage.clickOnSignAndExecuteButton();

    const toastMessage = await groupPage.getToastMessage(true);
    expect(toastMessage).toContain('Group Description Required');
  });

  test('Saving group with zero transactions shows validation error', async () => {
    await navigateToCreateGroupPage();
    await groupPage.fillDescription('group-without-transactions');
    await groupPage.clickOnSaveGroupButton();

    const toastMessage = await groupPage.getToastMessage(true);
    expect(toastMessage).toContain('Please add at least one transaction to the group');
  });

  test('Sign and Submit button is disabled when group has no transactions', async () => {
    await navigateToCreateGroupPage();
    expect(await groupPage.isSignAndExecuteButtonDisabled()).toBe(true);
  });
});
