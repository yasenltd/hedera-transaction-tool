import { expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
import { AccountPage } from '../../pages/AccountPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let accountPage: AccountPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Workflow account navigation tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    accountPage = new AccountPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    registrationPage = new RegistrationPage(window, seededUser.recoveryPhraseWordMap);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify account card is visible with valid information', async () => {
    const initialHbarFunds = '1';
    const memoText = 'test memo';
    const maxAutoAssociations = 23;

    const { newAccountId } = await transactionPage.createNewAccount({
      initialFunds: initialHbarFunds,
      memo: memoText,
      maxAutoAssociations: maxAutoAssociations,
    });

    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId ?? '');
    const evmAddressFromMirrorNode = accountDetails.accounts[0]?.evm_address;
    const keyAddressFromMirrorNode = accountDetails.accounts[0]?.key?.key;
    const keyTypeFromMirrorNode = accountDetails.accounts[0]?.key?._type;
    const normalizedKeyTypeFromMirrorNode =
      keyTypeFromMirrorNode === 'ECDSA_SECP256K1' ? 'secp256k1' : keyTypeFromMirrorNode;
    const maxAutoAssociationsFromMirrorNode =
      accountDetails.accounts[0]?.max_automatic_token_associations;
    const ethereumNonceFromMirrorNode = accountDetails.accounts[0]?.ethereum_nonce;
    const autoRenewPeriodFromMirrorNode = accountDetails.accounts[0]?.auto_renew_period;

    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();

    const accountId = await accountPage.getAccountIdText();
    expect(accountId).toContain(newAccountId);

    const evmAddress = ((await accountPage.getEvmAddressText()) ?? '').trim();
    expect(evmAddress).toBe(evmAddressFromMirrorNode);

    const balance = ((await accountPage.getBalanceText()) ?? '').trim();
    expect(balance).toContain(initialHbarFunds);

    const key = ((await accountPage.getKeyText()) ?? '').trim();
    expect(key).toBe(keyAddressFromMirrorNode);

    const keyType = ((await accountPage.getKeyTypeText()) ?? '').trim();
    expect(normalizedKeyTypeFromMirrorNode).toContain(keyType);

    const receiverSigRequiredText = ((await accountPage.getReceiverSigRequiredText()) ?? '').trim();
    expect(receiverSigRequiredText).toBe('No');

    const memo = ((await accountPage.getMemoText()) ?? '').trim();
    expect(memo).toBe(memoText);

    const maxAutoAssociationsText = ((await accountPage.getMaxAutoAssocText()) ?? '').trim();
    expect(maxAutoAssociationsText).toBe(maxAutoAssociationsFromMirrorNode.toString());

    const ethereumNonceText = ((await accountPage.getEthereumNonceText()) ?? '').trim();
    expect(ethereumNonceText).toBe(ethereumNonceFromMirrorNode.toString());

    const createdAtText = ((await accountPage.getCreatedAtText()) ?? '').trim();
    expect(createdAtText).toBeTruthy();

    const expiresAtText = ((await accountPage.getExpiresAtText()) ?? '').trim();
    expect(expiresAtText).toBeTruthy();

    const autoRenewPeriodText = ((await accountPage.getAutoRenewPeriodText()) ?? '').trim();
    expect(autoRenewPeriodText).toContain(autoRenewPeriodFromMirrorNode.toString());

    const stakedToText = ((await accountPage.getStakedToText()) ?? '').trim();
    expect(stakedToText).toBe('None');

    const pendingRewardText = ((await accountPage.getPendingRewardText()) ?? '').trim();
    expect(pendingRewardText).toBe('0 ℏ');

    const rewardsText = ((await accountPage.getRewardsText()) ?? '').trim();
    expect(rewardsText).toBe('Accepted');
  });

  test('Verify clicking on "Create New" button navigates the user on create account tx page', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnCreateNewLink();
    const isSignAndSubmitButtonVisible = await transactionPage.isSignAndSubmitButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);
  });

  test('Verify clicking on "Edit" and "Update" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnUpdateInNetworkLink();
    const isSignAndSubmitButtonVisible = await transactionPage.isSignAndSubmitButtonVisible();
    expect(isSignAndSubmitButtonVisible).toBe(true);
    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInUpdatePage();
    expect(isAccountIdPrefilled).toContain(accountFromList);
  });

  test('Verify clicking on "Edit" and "Delete" navigates the user on update account tx page with prefilled account', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnEditButton();
    await accountPage.clickOnDeleteFromNetworkLink();

    const isTransferAccountIdVisible = await transactionPage.isTransferAccountIdVisible();
    expect(isTransferAccountIdVisible).toBe(true);

    const isAccountIdPrefilled = await transactionPage.getPrefilledAccountIdInDeletePage();
    expect(isAccountIdPrefilled).toContain(accountFromList);
  });

  test('Verify user can unlink accounts', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.clickOnTransactionsMenuButton();
    const { newAccountId } = await transactionPage.createNewAccount();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnSelectManyAccountsButton();

    // Assert select mode enables multi-select state (checkboxes and remove button visible)
    const isRemoveMultipleVisible = await accountPage.isElementVisible(
      accountPage.removeMultipleButtonSelector,
    );
    expect(isRemoveMultipleVisible).toBe(true);

    await accountPage.clickOnAccountCheckbox(accountFromList);
    await accountPage.clickOnAccountCheckbox(newAccountId ?? '');
    await loginPage.waitForToastToDisappear();
    await accountPage.clickOnRemoveMultipleButton();
    await accountPage.unlinkAccounts();
    const toastText = await registrationPage.getToastMessage();
    expect(toastText).toBe('Account Unlinked!');
  });

  test('Verify user can add an existing account', async () => {
    await accountPage.ensureAccountExistsAndUnlinked();
    const accountFromList = await accountPage.getFirstAccountFromUnlinkedList();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnAddExistingLink();
    expect(await accountPage.isLinkAccountButtonDisabled()).toBe(true);
    await accountPage.fillInExistingAccountId(accountFromList);
    expect(await accountPage.isLinkAccountButtonDisabled()).toBe(false);
    await accountPage.clickOnLinkAccountButton();
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    const isAccountCardVisible = await transactionPage.isAccountCardVisible(accountFromList);
    expect(isAccountCardVisible).toBe(true);
  });

  test('Verify duplicate account link shows error toast', async () => {
    await transactionPage.ensureAccountExists();
    const accountFromList = await transactionPage.getFirstAccountFromList();
    await transactionPage.mirrorGetAccountResponse(accountFromList);
    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();
    await accountPage.clickOnAddNewButton();
    await accountPage.clickOnAddExistingLink();
    await accountPage.fillInExistingAccountId(accountFromList);
    await accountPage.clickOnLinkAccountButton();
    const toastText = await registrationPage.getToastMessageByVariant('error');
    expect(toastText).toContain('Account ID or Nickname already exists!');
  });

  test.only('Verify account list can be sorted by Account ID, Nickname, and Date Added', async () => {
    const { newAccountId: firstAccountId } = await transactionPage.createNewAccount();
    // Ensure different "Date Added" timestamps for stable sort expectations.
    await new Promise(resolve => setTimeout(resolve, 1100));
    const { newAccountId: secondAccountId } = await transactionPage.createNewAccount();

    const accountIdA = firstAccountId ?? '';
    const accountIdB = secondAccountId ?? '';

    await transactionPage.clickOnTransactionsMenuButton();
    await accountPage.clickOnAccountsLink();

    // Set nicknames so nickname sorting is deterministic.
    const nicknameSuffix = Date.now().toString(36);
    const nicknameA = `A-${nicknameSuffix}`;
    const nicknameB = `B-${nicknameSuffix}`;

    const indexA = await transactionPage.findAccountIndexById(accountIdA);
    expect(indexA).toBeGreaterThanOrEqual(0);
    await transactionPage.clickOnAccountByIndex(indexA);
    await accountPage.clickOnEditSelectedAccountNickname();
    await accountPage.fillSelectedAccountNickname(nicknameB);
    await accountPage.saveSelectedAccountNickname();
    await expect
      .poll(async () => {
        const currentIndexA = await transactionPage.findAccountIndexById(accountIdA);
        if (currentIndexA < 0) return null;
        return await accountPage.getAccountNicknameByIndex(currentIndexA);
      })
      .toBe(nicknameB);

    const indexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(indexB).toBeGreaterThanOrEqual(0);
    await transactionPage.clickOnAccountByIndex(indexB);
    await accountPage.clickOnEditSelectedAccountNickname();
    await accountPage.fillSelectedAccountNickname(nicknameA);
    await accountPage.saveSelectedAccountNickname();
    await expect
      .poll(async () => {
        const currentIndexB = await transactionPage.findAccountIndexById(accountIdB);
        if (currentIndexB < 0) return null;
        return await accountPage.getAccountNicknameByIndex(currentIndexB);
      })
      .toBe(nicknameA);

    await accountPage.sortByNicknameAsc();
    await expect
      .poll(async () => {
        const currentIndexA = await transactionPage.findAccountIndexById(accountIdA);
        const currentIndexB = await transactionPage.findAccountIndexById(accountIdB);
        return currentIndexA >= 0 && currentIndexB >= 0 && currentIndexB < currentIndexA;
      })
      .toBe(true);
    const nicknameAscIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const nicknameAscIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(await accountPage.getAccountNicknameByIndex(nicknameAscIndexB)).toBe(nicknameA);
    expect(await accountPage.getAccountNicknameByIndex(nicknameAscIndexA)).toBe(nicknameB);

    await accountPage.sortByNicknameDesc();
    await expect
      .poll(async () => {
        const currentIndexA = await transactionPage.findAccountIndexById(accountIdA);
        const currentIndexB = await transactionPage.findAccountIndexById(accountIdB);
        return currentIndexA >= 0 && currentIndexB >= 0 && currentIndexA < currentIndexB;
      })
      .toBe(true);
    const nicknameDescIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const nicknameDescIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(await accountPage.getAccountNicknameByIndex(nicknameDescIndexA)).toBe(nicknameB);
    expect(await accountPage.getAccountNicknameByIndex(nicknameDescIndexB)).toBe(nicknameA);

    await accountPage.sortByAccountIdAsc();
    const ascIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const ascIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(ascIndexA).toBeLessThan(ascIndexB);

    await accountPage.sortByAccountIdDesc();
    const descIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const descIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(descIndexA).toBeGreaterThan(descIndexB);

    await accountPage.sortByDateAddedAsc();
    const dateAscIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const dateAscIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(dateAscIndexA).toBeLessThan(dateAscIndexB);

    await accountPage.sortByDateAddedDesc();
    const dateDescIndexA = await transactionPage.findAccountIndexById(accountIdA);
    const dateDescIndexB = await transactionPage.findAccountIndexById(accountIdB);
    expect(dateDescIndexA).toBeGreaterThan(dateDescIndexB);
  });

});
