import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { generateECDSAKeyPair, generateEd25519KeyPair } from '../../utils/crypto/keyUtil.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import { restoreKeyFromSettings } from '../helpers/flows/settingsKeyRecoveryFlow.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings keys tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    registrationPage = new RegistrationPage(window, seededUser.recoveryPhraseWordMap);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
    await settingsPage.clickOnSettingsButton();
  });

  test('Verify user can decrypt private key', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnEyeDecryptIcon();
    const decryptedPrivateKey = await settingsPage.getPrivateKeyText();
    expect(decryptedPrivateKey).toBeTruthy();
  });

  test('Verify user can copy public key to clipboard', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnCopyPublicKeyAtIndex(0);

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Public Key copied successfully');
  });

  test('Verify user can copy private key to clipboard', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnEyeDecryptIcon();
    await settingsPage.clickOnCopyPrivateKeyAtIndex(0);

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Private Key copied successfully');
  });

  test('Verify user can restore key', async () => {
    await settingsPage.clickOnKeysTab();
    await restoreKeyFromSettings(settingsPage, registrationPage, loginPage, {
      expectSuccessToast: true,
    });
    await settingsPage.incrementIndex();
  });

  test('Verify user can delete key', async () => {
    await settingsPage.clickOnKeysTab();
    const rowCountBeforeRestore = await settingsPage.getKeyRowCount();

    await restoreKeyFromSettings(settingsPage, registrationPage, loginPage, {
      expectSuccessToast: true,
    });
    await settingsPage.incrementIndex();

    await settingsPage.clickOnDeleteButtonAtIndex(rowCountBeforeRestore);
    await settingsPage.clickOnDeleteKeyPairButton();
    await loginPage.waitForToastToDisappear();

    const rowCountAfterDelete = await settingsPage.getKeyRowCount();
    expect(rowCountBeforeRestore).toBe(rowCountAfterDelete);
    await settingsPage.decrementIndex();
  });

  test('Verify user restored key pair is saved in the local database', async () => {
    await settingsPage.clickOnKeysTab();

    const currentIndex = await restoreKeyFromSettings(settingsPage, registrationPage, loginPage, {
      waitForToastAfterSave: true,
      waitForToastBeforeNickname: false,
    });

    await expect.poll(
      async () =>
        await settingsPage.verifyKeysExistByIndexAndEmail(globalCredentials.email, currentIndex),
      { timeout: 5000, intervals: [250] },
    ).toBe(true);

    await settingsPage.incrementIndex();
  });

  test('Verify user can import ECDSA key', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();

    const privateKey = generateECDSAKeyPair();
    await settingsPage.fillInECDSAPrivateKey(privateKey);
    await settingsPage.fillInECDSANickname('Test-ECDSA-Import');
    await loginPage.waitForToastToDisappear();
    await settingsPage.clickOnECDSAImportButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('ECDSA private key imported successfully');

    const rowCount = await settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;
    const { index, nickname, accountID, keyType, publicKey } =
      await settingsPage.getRowDataByIndex(lastRowIndex);

    expect(index).toBe('N/A');
    expect(nickname!.trim()).toBe('Test-ECDSA-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ECDSA');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can import ED25519 keys', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();

    const { privateKey } = generateEd25519KeyPair();
    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Test-ED25519-Import');
    await loginPage.waitForToastToDisappear();
    await settingsPage.clickOnED25519ImportButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('ED25519 private key imported successfully');

    const rowCount = await settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;
    const { index, nickname, accountID, keyType, publicKey } =
      await settingsPage.getRowDataByIndex(lastRowIndex);

    expect(index).toBe('N/A');
    expect(nickname!.trim()).toBe('Test-ED25519-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ED25519');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can filter keys by All, Recovery Phrase, and Private Key', async () => {
    await settingsPage.clickOnKeysTab();

    const { privateKey } = generateEd25519KeyPair();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Filter-ED25519-Import');
    await loginPage.waitForToastToDisappear();
    await settingsPage.clickOnED25519ImportButton();

    await settingsPage.clickOnPrivateKeyFilterTab();
    const privateKeyRows = await settingsPage.getKeyRowCount();
    expect(privateKeyRows).toBeGreaterThanOrEqual(1);

    const privateKeyData = await settingsPage.getRowDataByIndex(0);
    expect(privateKeyData.index).toBe('N/A');

    await settingsPage.selectFirstRecoveryPhraseFilterOption();
    const recoveryPhraseRows = await settingsPage.getKeyRowCount();
    expect(recoveryPhraseRows).toBeGreaterThanOrEqual(1);

    await settingsPage.clickOnAllKeysFilterTab();
    const allRows = await settingsPage.getKeyRowCount();
    expect(allRows).toBeGreaterThan(privateKeyRows);
  });

  test('Verify user can select multiple keys and bulk delete', async () => {
    await settingsPage.clickOnKeysTab();
    const initialRowCount = await settingsPage.getKeyRowCount();

    const { privateKey: firstPrivateKey } = generateEd25519KeyPair();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(firstPrivateKey);
    await settingsPage.fillInED25519Nickname('Bulk-Delete-ED25519-1');
    await settingsPage.clickOnED25519ImportButton();

    const { privateKey: secondPrivateKey } = generateEd25519KeyPair();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(secondPrivateKey);
    await settingsPage.fillInED25519Nickname('Bulk-Delete-ED25519-2');
    await settingsPage.clickOnED25519ImportButton();

    const rowCountAfterImport = await settingsPage.getKeyRowCount();
    expect(rowCountAfterImport).toBe(initialRowCount + 2);

    await settingsPage.clickOnKeyCheckboxByIndex(rowCountAfterImport - 1);
    await settingsPage.clickOnKeyCheckboxByIndex(rowCountAfterImport - 2);
    expect(await settingsPage.isDeleteKeyAllButtonVisible()).toBe(true);

    await settingsPage.clickOnDeleteKeyAllButton();
    await settingsPage.clickOnDeleteKeyPairButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Private key(s) deleted successfully');

    await loginPage.waitForToastToDisappear();
    expect(await settingsPage.getKeyRowCount()).toBe(initialRowCount);
  });

  test('Verify duplicate private key import shows an error', async () => {
    await settingsPage.clickOnKeysTab();

    const { privateKey } = generateEd25519KeyPair();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Duplicate-Import-Key');
    await settingsPage.clickOnED25519ImportButton();
    await loginPage.waitForToastToDisappear();

    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Duplicate-Import-Key-Again');
    await settingsPage.clickOnED25519ImportButton(false);

    const toastMessage = await registrationPage.getToastMessageByVariant('error');
    expect(toastMessage).toContain('Key pair already exists');
  });

  test('Verify user can change key nickname', async () => {
    const newNickname = 'testChangeNickname';
    await settingsPage.clickOnKeysTab();
    await settingsPage.changeNicknameForFirstKey(newNickname);

    const keyData = await settingsPage.getRowDataByIndex(0);
    expect(keyData.nickname!.trim()).toBe(newNickname);
  });

  test('Verify wrong app password blocks private key decryption', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clearCachedPersonalPasswordForTesting();

    await settingsPage.clickOnEyeDecryptIcon();
    expect(await settingsPage.isEncryptPasswordInputVisible()).toBe(true);

    await settingsPage.fillInEncryptPassword('incorrect-password');
    await settingsPage.clickOnContinueEncryptPasswordButton();
    await settingsPage.wait(500);

    expect(await settingsPage.isEncryptPasswordInputVisible()).toBe(true);
    expect(await settingsPage.isPrivateKeyVisible()).toBe(false);
  });

  test('Verify decrypt private key flow is aborted when password modal is cancelled', async () => {
    await settingsPage.clickOnKeysTab();
    await settingsPage.clearCachedPersonalPasswordForTesting();

    await settingsPage.clickOnEyeDecryptIcon();
    expect(await settingsPage.isEncryptPasswordInputVisible()).toBe(true);

    await settingsPage.clickOnCancelEncryptPasswordButton();

    expect(await settingsPage.isEncryptPasswordInputVisible()).toBe(false);
    expect(await settingsPage.isPrivateKeyVisible()).toBe(false);
  });
});
