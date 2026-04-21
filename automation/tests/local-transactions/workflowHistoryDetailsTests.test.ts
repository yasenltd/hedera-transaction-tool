import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { DetailsPage } from '../../pages/DetailsPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
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
let detailsPage: DetailsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Workflow history/detail account and transfer tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    detailsPage = new DetailsPage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify account create tx is displayed in history page', async () => {
    // Create multiple history items so we can verify sorting in the History table.
    const { newTransactionId: txB } = await transactionPage.createNewAccount({
      description: 'B history sort',
    });
    const { newTransactionId: txA } = await transactionPage.createNewAccount({
      description: 'A history sort',
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnHistoryTab();

    // Assert History table column headers are present
    const headerTexts = await detailsPage.getHistoryTableHeaderTexts();
    expect(headerTexts).toContain('Transaction ID');
    expect(headerTexts).toContain('Transaction Type');
    expect(headerTexts).toContain('Description');
    expect(headerTexts).toContain('Status');
    expect(headerTexts).toContain('Created At');
    expect(headerTexts).toContain('Actions');

    // Verify sorting by Description (asc/desc)
    await detailsPage.sortHistoryByDescription();
    await expect.poll(() => detailsPage.getFirstTransactionDescription()).toBe('A history sort');
    await detailsPage.sortHistoryByDescription();
    await expect.poll(() => detailsPage.getFirstTransactionDescription()).toBe('B history sort');
    await detailsPage.sortHistoryByDescription();
    await expect.poll(() => detailsPage.getFirstTransactionDescription()).toBe('A history sort');

    // Keep the original "is displayed" assertion (first row contains txA after sorting asc).
    const newTransactionId = txA;
    const txDescription = 'A history sort';
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Create',
      txDescription,
    );

    // 4.4.2: Status badge style (success should not be marked as danger).
    expect(await detailsPage.isTransactionStatusBadgeSuccess()).toBe(true);
  });

  test('Verify history status badge shows danger styling for failed transactions', async () => {
    const { newAccountId: emptyAccountId } = await transactionPage.createNewAccount({
      initialFunds: '0',
      description: 'failed transfer source',
    });
    const { newAccountId: receiverAccountId } = await transactionPage.createNewAccount({
      description: 'failed transfer receiver',
    });
    expect(emptyAccountId).toBeTruthy();
    expect(receiverAccountId).toBeTruthy();

    await transactionPage.transferAmountBetweenAccounts(receiverAccountId ?? '', '1', {
      fromAccountId: emptyAccountId ?? '',
      isSupposedToFail: true,
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnHistoryTab();

    expect(await detailsPage.isTransactionStatusBadgeDanger()).toBe(true);
  });

  test('Verify transaction details are displayed for account tx', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount({
      description: 'testDescription',
    });
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();

    // Assert details page route and title explicitly
    await expect.poll(() => window.url()).toContain('/transaction/');
    const detailsType = await detailsPage.getTransactionDetailsType();
    expect(detailsType).toBe('Account Create');

    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Create');
    const getAccountDetailsKey = await detailsPage.getAccountDetailsKey();
    expect(getAccountDetailsKey).toBeTruthy();

    const getAccountDetailsStaking = await detailsPage.getAccountDetailsStaking();
    expect(getAccountDetailsStaking).toBe('None');

    const getAccountDetailsAcceptRewards = await detailsPage.getAccountDetailsAcceptRewards();
    expect(getAccountDetailsAcceptRewards).toBe('Yes');

    const getAccountDetailsReceiverSigRequired =
      await detailsPage.getAccountDetailsReceiverSigRequired();
    expect(getAccountDetailsReceiverSigRequired).toBe('No');

    const getAccountDetailsInitialBalance = await detailsPage.getAccountDetailsInitBalance();
    expect(getAccountDetailsInitialBalance).toBe('0 ℏ');

    const getTransactionDescription = await detailsPage.getTransactionDescription();
    expect(getTransactionDescription).toBe('testDescription');

    // Link the newly created account into local store, then verify the details view reflects that state.
    if (await detailsPage.isLinkAccountButtonVisible()) {
      await detailsPage.clickOnLinkAccountButton();
      await loginPage.waitForToastToDisappear();
    }
    expect(await detailsPage.isAccountAlreadyLinkedLabelVisible()).toBe(true);
  });

  test('Verify transaction details are displayed for account update tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Update');
    const getTransactionMemo = await detailsPage.getTransactionDetailsMemo();
    expect(getTransactionMemo).toBe('Transaction memo update');

    const getAccountId = await detailsPage.getAccountUpdateDetailsId();
    expect(getAccountId).toContain(accountFromList);

    const getAccountMemoDetails = await detailsPage.getAccountDetailsMemo();
    expect(getAccountMemoDetails).toBe(updatedMemoText);
  });

  test('Verify account update tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo again';
    const maxAutoAssociationsNumber = '44';
    const newTransactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Account Update');
  });

  test('Verify account delete tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Account Delete');
  });

  test('Verify transaction details are displayed for account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const newTransactionId = await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Delete');
    const getDeletedAccountId = await detailsPage.getDeletedAccountId();
    expect(getDeletedAccountId).toContain(accountFromList);

    const getTransferAccountId = await detailsPage.getAccountDeleteDetailsTransferId();
    expect(getTransferAccountId).toBeTruthy();
  });

  test('Verify transfer tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(newTransactionId ?? '', 'Transfer');
  });

  test('Verify transaction details are displayed for transfer tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeTransferred = '1';
    const newTransactionId = await transactionPage.transferAmountBetweenAccounts(
      accountFromList,
      amountToBeTransferred,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Transfer');
    const transferDetailsFromAccount = await detailsPage.getTransferDetailsFromAccount();
    expect(transferDetailsFromAccount).toBeTruthy();

    const transferDetailsFromAmount = await detailsPage.getTransferDetailsFromAmount();
    expect(transferDetailsFromAmount).toContain('-' + amountToBeTransferred + ' ℏ');

    const transferDetailsToAccount = await detailsPage.getTransferDetailsToAccount();
    expect(transferDetailsToAccount).toContain(accountFromList);

    const transferDetailsToAmount = await detailsPage.getTransferDetailsToAmount();
    expect(transferDetailsToAmount).toContain(amountToBeTransferred + ' ℏ');
  });

  test('Verify approve allowance tx is displayed in history page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.assertTransactionDisplayed(
      newTransactionId ?? '',
      'Account Allowance Approve',
    );
  });

  test('Verify transaction details are displayed for approve allowance tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const amountToBeApproved = '10';
    const newTransactionId = await transactionPage.approveAllowance(
      accountFromList,
      amountToBeApproved,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await detailsPage.clickOnFirstTransactionDetailsButton();
    await detailsPage.assertTransactionDetails(newTransactionId ?? '', 'Account Allowance Approve');
    const allowanceOwnerAccount = await detailsPage.getAllowanceDetailsOwnerAccount();
    expect(allowanceOwnerAccount).toBeTruthy();

    const allowanceSpenderAccount = await detailsPage.getAllowanceDetailsSpenderAccount();
    expect(allowanceSpenderAccount).toContain(accountFromList);

    const allowanceAmount = await detailsPage.getAllowanceDetailsAmount();
    expect(allowanceAmount).toContain(amountToBeApproved + ' ℏ');
  });
});
