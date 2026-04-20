import { expect, Page, test } from '@playwright/test';
import { generateRandomEmail } from '../../utils/data/random.js';
import { closeApp, setupApp } from '../../utils/runtime/appSession.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import {
  activateTestIsolation,
  cleanupIsolation,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../../utils/setup/sharedTestEnvironment.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'] | undefined;
let window: Page;
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

const weakPassword = '123456789';
const strongPassword = '123456789a';
const mismatchingPassword = '123456789b';

test.describe('Registration first-time validation tests @local-basic', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (app) {
      await closeApp(app);
      app = undefined;
    }

    isolationContext = await activateTestIsolation(testInfo);
    await resetLocalStateForSuite();

    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    loginPage = new LoginPage(window);
    await loginPage.assertRegistrationMode('registration first-time validation bootstrap');
  });

  test.afterEach(async () => {
    await closeApp(app);
    app = undefined;
    await resetLocalStateForTeardown();
    await cleanupIsolation(isolationContext);
    isolationContext = null;
  });

  test.afterAll(async () => {
    if (app) {
      await closeApp(app);
    }

    await cleanupIsolation(isolationContext);
  });

  test('Password strength tooltip shows real-time feedback (>= 10 chars)', async () => {
    await registrationPage.typePassword(weakPassword);
    await registrationPage.showPasswordStrengthTooltip();
    expect(await registrationPage.isPasswordLengthRequirementSatisfied()).toBe(false);

    await registrationPage.typePassword(strongPassword);
    await registrationPage.showPasswordStrengthTooltip();
    expect(await registrationPage.isPasswordLengthRequirementSatisfied()).toBe(true);
  });

  test('Registration fails when passwords do not match', async () => {
    const email = generateRandomEmail();

    await registrationPage.typeEmail(email);
    await registrationPage.typePassword(strongPassword);
    await registrationPage.typeConfirmPassword(mismatchingPassword);
    await registrationPage.typeEmail(email);

    const confirmPasswordErrorMessage =
      (await registrationPage.getConfirmPasswordErrorMessage())?.trim() ?? '';
    expect(confirmPasswordErrorMessage).toBe('Password do not match');
    expect(await registrationPage.isRegisterButtonDisabled()).toBe(true);
  });

  test('Registration fails with invalid email format', async () => {
    await registrationPage.typeEmail('invalid-email');
    await registrationPage.typePassword(strongPassword);
    await registrationPage.typeConfirmPassword(strongPassword);

    const emailErrorMessage = (await registrationPage.getEmailErrorMessage())?.trim() ?? '';
    expect(emailErrorMessage).toBe('Invalid e-mail');
    expect(await registrationPage.isRegisterButtonDisabled()).toBe(true);
  });

  test('Registration fails with weak password (< 10 characters)', async () => {
    await registrationPage.typeEmail(generateRandomEmail());
    await registrationPage.typePassword(weakPassword);
    await registrationPage.typeConfirmPassword(weakPassword);

    const passwordErrorMessage = (await registrationPage.getPasswordErrorMessage())?.trim() ?? '';
    expect(passwordErrorMessage).toBe('Invalid password');
    expect(await registrationPage.isRegisterButtonDisabled()).toBe(true);
  });

  test('Register button is disabled until all validations pass', async () => {
    expect(await registrationPage.isRegisterButtonDisabled()).toBe(true);

    await registrationPage.typeEmail(generateRandomEmail());
    await registrationPage.typePassword(weakPassword);
    await registrationPage.typeConfirmPassword(weakPassword);
    expect(await registrationPage.isRegisterButtonDisabled()).toBe(true);

    await registrationPage.typePassword(strongPassword);
    await registrationPage.typeConfirmPassword(strongPassword);
    expect(await registrationPage.isRegisterButtonEnabled()).toBe(true);
  });

  test('"Keep me logged in" checkbox is available during registration', async () => {
    expect(await registrationPage.isKeepMeLoggedInCheckboxVisible()).toBe(true);
    expect(await registrationPage.isKeepMeLoggedInChecked()).toBe(false);

    await registrationPage.clickOnKeepMeLoggedInCheckbox();
    expect(await registrationPage.isKeepMeLoggedInChecked()).toBe(true);
  });
});
