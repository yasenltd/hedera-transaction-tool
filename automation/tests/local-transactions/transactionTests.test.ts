import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import {
  getOperatorKeyEnv,
  setupEnvironmentForTransactions,
} from '../../utils/runtime/environment.js';
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
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Transaction account execution tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify user can execute Account Create tx with complex key', async () => {
    const { newAccountId } = await transactionPage.createNewAccount({ isComplex: true });
    const allGeneratedKeys = transactionPage.getAllGeneratedPublicKeys();

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const protoBufEncodedBytes = accountDetails.accounts[0]?.key?.key;
    const decodedKeys = await transactionPage.decodeByteCode(protoBufEncodedBytes);
    const keysMatch = await transactionPage.keysMatch(decodedKeys, allGeneratedKeys);
    expect(keysMatch).toBe(true);
  });

  test('Verify user can execute account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const transactionId = await transactionPage.deleteAccount(accountFromList);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId!);
    const transactionType = transactionDetails?.name;
    const deletedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;

    expect(transactionType).toBe('CRYPTODELETE');
    expect(deletedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');
  });

  test('Verify that all elements on account create page are correct', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    const allElementsAreVisible = await transactionPage.verifyAccountCreateTransactionElements();
    expect(allElementsAreVisible).toBe(true);
  });

  test('Verify sign button is disabled when no owner key is selected', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.fillInPublicKeyForAccount('');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify sign button is disabled when no account ID is entered', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify account create staking validation blocks signing and initial balance resets when exceeding payer balance', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();
    await transactionPage.waitForPublicKeyToBeFilled();

    // Ensure payer info is present so the Initial Balance watcher can clamp the value.
    const payerAccountId = (await transactionPage.getPayerAccountId()) || '0.0.1002';
    await transactionPage.fillInPayerAccountId(payerAccountId);
    await window.getByTestId(transactionPage.payerAccountInputSelector).press('Tab');

    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);

    // 5.2.16: Initial balance auto-resets to 0 when it exceeds payer's available balance.
    const initialBalanceInput = window.getByTestId('input-initial-balance-amount');
    await initialBalanceInput.fill('999999999999');
    await initialBalanceInput.press('Tab');
    await expect.poll(async () => initialBalanceInput.inputValue()).toBe('0');

    // 5.2.15: Invalid Staked Account ID format disables the sign button.
    await window.getByTestId('dropdown-staking-account').selectOption('Account');
    const stakeAccountInput = window.getByTestId('input-stake-accountid');
    await stakeAccountInput.fill('0.0.abc');
    await stakeAccountInput.press('Tab');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);

    // Reset staking -> sign button should re-enable.
    await window.getByTestId('dropdown-staking-account').selectOption('None');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);
  });

  test('Invalid Account ID error shown when submitting with a malformed account ID', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();

    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();

    // Keep the account fetch valid (base id), but fail format validation on submit.
    await transactionPage.fillInUpdatedAccountId(`${accountFromList}--bad`);
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);

    await transactionPage.clickOnSignAndSubmitButton(true);
    const toast = window.locator('.v-toast__text:visible').last();
    await expect(toast).toHaveText('Invalid Account ID', { timeout: 15000 });
  });

  test('Account delete validation blocks submit for deleted accounts and malformed transfer account IDs', async () => {
    const { newAccountId: accountA } = await transactionPage.createNewAccount({
      description: 'delete-validation-A',
    });
    const { newAccountId: accountB } = await transactionPage.createNewAccount({
      description: 'delete-validation-B',
    });

    expect(accountA).toBeTruthy();
    expect(accountB).toBeTruthy();

    await transactionPage.deleteAccount(accountA!);

    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnDeleteAccountTransaction();

    const payerAccountId = (await transactionPage.getPayerAccountId()) || '0.0.1002';
    await window.getByTestId('input-transfer-account-id').fill(payerAccountId);
    await window.getByTestId('input-transfer-account-id').press('Tab');

    // 5.4.8 + 5.4.10: Deleted account shows inline warning and blocks submit.
    await window.getByTestId('input-delete-account-id').fill(accountA!);
    await window.getByTestId('input-delete-account-id').press('Tab');
    await expect(window.getByText('Account is already deleted!')).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);

    // Switch to a non-deleted account so we can exercise transfer-id validation.
    await transactionPage.fillInDeletedAccountId(accountB!);
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);

    // 5.4.9: Invalid Transfer Account ID error on submit.
    await window.getByTestId('input-transfer-account-id').fill(`${accountB}--bad`);
    await window.getByTestId('input-transfer-account-id').press('Tab');
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(true);
    await transactionPage.clickOnSignAndSubmitButton(true);
    const toast = window.locator('.v-toast__text:visible').last();
    await expect(toast).toHaveText('Invalid Transfer Account ID', { timeout: 15000 });

    // 5.4.10: Transfer-to deleted account blocks submit.
    await window.getByTestId('input-transfer-account-id').fill(accountA!);
    await window.getByTestId('input-transfer-account-id').press('Tab');
    await expect(window.getByText('Account is already deleted!')).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  test('Verify confirm transaction modal is displayed with valid information for Account Create tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    await transactionPage.clickOnSignAndSubmitButton();
    const confirmTransactionIsDisplayedAndCorrect =
      await transactionPage.verifyConfirmTransactionInformation('Account Create Transaction');
    await transactionPage.clickOnCancelTransaction();
    expect(confirmTransactionIsDisplayedAndCorrect).toBe(true);
  });

  test('Verify user can execute create account transaction with single key', async () => {
    const { newAccountId } = await transactionPage.createNewAccount();
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const createdTimestamp = accountDetails.accounts[0]?.created_timestamp;
    expect(createdTimestamp).toBeTruthy();
  });

  test('Verify user can create account with memo', async () => {
    const memoText = 'test memo';
    const { newAccountId } = await transactionPage.createNewAccount({ memo: memoText });
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const memoFromAPI = accountDetails.accounts[0]?.memo;
    expect(memoFromAPI).toBe(memoText);
  });

  test('Verify user can create account with receiver sig required', async () => {
    const { newAccountId } = await transactionPage.createNewAccount({
      isReceiverSigRequired: true,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const isReceiverSigRequired = accountDetails.accounts[0]?.receiver_sig_required;
    expect(isReceiverSigRequired).toBe(true);
  });

  test('Verify user can create account with initial funds', async () => {
    const initialHbarFunds = 1;

    const { newAccountId } = await transactionPage.createNewAccount({
      initialFunds: initialHbarFunds.toString(),
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const balanceFromAPI = accountDetails.accounts[0]?.balance?.balance;
    expect(balanceFromAPI).toBe(initialHbarFunds * 100000000);
  });

  test('Verify user can create account with max account associations', async () => {
    const maxAutoAssociations = 10;
    const { newAccountId } = await transactionPage.createNewAccount({ maxAutoAssociations });
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const maxAutoAssociationsFromAPI = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssociationsFromAPI).toBe(maxAutoAssociations);
  });

  test('Verify transaction is stored in the local database for account create tx', async () => {
    const { newTransactionId } = await transactionPage.createNewAccount();

    const isTxExistingInDb = await transactionPage.verifyTransactionExists(
      newTransactionId ?? '',
      'Account Create Transaction',
    );

    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is stored in the local database for account create tx', async () => {
    const { newAccountId } = await transactionPage.createNewAccount();
    await transactionPage.clickOnAccountsMenuButton();
    const isTxExistingInDb = await transactionPage.verifyAccountExists(newAccountId ?? '');
    expect(isTxExistingInDb).toBe(true);
  });

  test('Verify account is displayed in the account card section', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.clickOnAccountsMenuButton();
    const isAccountVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isAccountVisible).toBe(true);
  });

  test('Verify account is deleted from the db after account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);
    const isTxExistingInDb = await transactionPage.verifyAccountExists(accountFromList);
    expect(isTxExistingInDb).toBe(false);
  });

  test('Verify account id is removed from the account cards after account delete tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.deleteAccount(accountFromList);
    await transactionPage.clickOnAccountsMenuButton();
    const isAccountHidden = await transactionPage.isAccountCardHidden(accountFromList);
    expect(isAccountHidden).toBe(true);
  });

  test('Verify that account is updated after we execute an account update tx', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    const updatedMemoText = 'Updated memo';
    const maxAutoAssociationsNumber = '-1';
    const transactionId = await transactionPage.updateAccount(
      accountFromList,
      maxAutoAssociationsNumber,
      updatedMemoText,
    );

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe(accountFromList);
    expect(result).toBe('SUCCESS');

    const accountDetails = await transactionPage.mirrorGetAccountResponse(accountFromList);

    const memoFromResponse = accountDetails.accounts[0]?.memo;
    expect(memoFromResponse).toBe(updatedMemoText);

    const maxAutoAssocFromResponse = accountDetails.accounts[0]?.max_automatic_token_associations;
    expect(maxAutoAssocFromResponse.toString()).toBe(maxAutoAssociationsNumber);
  });

  test('Verify that system account can be updated without account key using a superUser as the fee payer', async () => {
    await setupEnvironmentForTransactions(window, getOperatorKeyEnv());
    const newPublicKey = await transactionPage.generateRandomPublicKey();
    const transactionId = await transactionPage.updateAccountKey('0.0.100', newPublicKey, '0.0.2');

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );

    const transactionType = transactionDetails?.name;
    const updatedAccount = transactionDetails?.entity_id;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('CRYPTOUPDATEACCOUNT');
    expect(updatedAccount).toBe('0.0.100');
    expect(result).toBe('SUCCESS');

    // const accountDetails = await transactionPage.mirrorGetAccountResponse('0.0.100');
    // const key = accountDetails.accounts[0]?.key?.key;
  });
});
