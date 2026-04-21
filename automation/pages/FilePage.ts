import { BasePage } from './BasePage.js';
import { TransactionPage } from './TransactionPage.js';
import { Page } from '@playwright/test';

export class FilePage extends BasePage {
  // Buttons
  removeFileCardButtonSelector = 'button-remove-file-card';
  removeMultipleButtonSelector = 'button-remove-multiple-files';
  updateFileButtonSelector = 'button-update-file';
  sortFilesButtonSelector = 'button-sort-files';

  /* Selectors */
  appendFileButtonSelector = 'button-append-file';
  readFileButtonSelector = 'button-read-file';
  addNewButtonSelector = 'button-add-new-file';
  createNewLinkSelector = 'link-create-new-file';
  updateLinkSelector = 'link-update-file';
  appendLinkSelector = 'link-append-file';
  readLinkSelector = 'link-read-file';
  addExistingLinkSelector = 'link-add-existing-file';
  linkFileButtonSelector = 'button-link-file';
  confirmUnlinkFileButtonSelector = 'button-confirm-unlink-file';
  filesMenuButtonSelector = 'button-menu-files';
  selectManyFilesButtonSelector = 'button-select-many-files';
  sortFileIdAscSelector = 'menu-sort-file-id-asc';
  sortFileIdDescSelector = 'menu-sort-file-id-desc';
  sortFileNicknameAscSelector = 'menu-sort-file-nickname-asc';
  sortFileNicknameDescSelector = 'menu-sort-file-nickname-desc';
  sortFileDateAddedAscSelector = 'menu-sort-file-date-added-asc';
  sortFileDateAddedDescSelector = 'menu-sort-file-date-added-desc';
  editNicknameButtonSelector = 'span-edit-file-nickname';
  editDescriptionButtonSelector = 'span-edit-file-description';
  fileNicknameInputSelector = 'input-file-nickname';
  fileDescriptionTextareaSelector = 'textarea-file-description';
  fileLastViewedSelector = 'p-file-last-viewed';
  viewStoredFileButtonSelector = 'button-view-stored-file';
  displayedFileContentTextareaSelector = 'textarea-file-content';
  selectedFileNicknameSelector = 'p-file-selected-nickname';
  // Inputs
  existingFileIdInputSelector = 'input-existing-file-id';
  existingFileNicknameInputSelector = 'input-existing-file-nickname';
  existingFileDescriptionTextareaSelector = 'textarea-existing-file-description';
  multiSelectFileCheckboxSelector = 'checkbox-multiple-file-id-';
  // Texts
  fileIdTextSelector = 'p-file-id-info';
  fileSizeTextSelector = 'p-file-size';
  fileKeyTextSelector = 'p-file-key';
  fileKeyTypeTextSelector = 'p-file-key-type';
  fileMemoTextSelector = 'p-file-memo';
  fileLedgerTextSelector = 'p-file-ledger-id';
  fileExpirationTextSelector = 'p-file-expires-at';
  fileDescriptionTextSelector = 'p-file-description';
  fileIdListPrefixSelector = 'p-file-id-';
  fileNicknameListPrefixSelector = 'p-file-nickname-';
  toastMessageSelector = 'css=.v-toast__text';
  private readonly unlikedFiles: string[]; // Store unlinked files
  private transactionPage: TransactionPage;

  constructor(window: Page) {
    super(window);
    this.unlikedFiles = [];
    this.transactionPage = new TransactionPage(window);
  }

  async clickOnRemoveFileCardButton() {
    await this.click(this.removeFileCardButtonSelector);
  }

  async clickOnRemoveMultipleButton() {
    await this.click(this.removeMultipleButtonSelector);
  }

  async isRemoveMultipleButtonDisabled() {
    return await this.isDisabled(this.removeMultipleButtonSelector);
  }

  async clickOnSortFilesButton() {
    await this.click(this.sortFilesButtonSelector);
  }

  async sortByFileIdAsc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileIdAscSelector);
  }

  async sortByFileIdDesc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileIdDescSelector);
  }

  async sortByNicknameAsc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileNicknameAscSelector);
  }

  async sortByNicknameDesc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileNicknameDescSelector);
  }

  async sortByDateAddedAsc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileDateAddedAscSelector);
  }

  async sortByDateAddedDesc() {
    await this.clickOnSortFilesButton();
    await this.click(this.sortFileDateAddedDescSelector);
  }

  async clickOnEditSelectedFileNickname() {
    await this.click(this.editNicknameButtonSelector);
  }

  async fillSelectedFileNickname(nickname: string) {
    await this.fill(this.fileNicknameInputSelector, nickname);
  }

  async saveSelectedFileNickname() {
    await this.pressKey('Tab');
  }

  async getSelectedFileNicknameText() {
    return await this.getText(this.selectedFileNicknameSelector);
  }

  async clickOnEditSelectedFileDescription() {
    await this.click(this.editDescriptionButtonSelector);
  }

  async fillSelectedFileDescription(description: string) {
    await this.fill(this.fileDescriptionTextareaSelector, description);
  }

  async saveSelectedFileDescription() {
    await this.pressKey('Tab');
  }

  async getLastViewedText() {
    return await this.getText(this.fileLastViewedSelector);
  }

  async isViewStoredFileButtonVisible() {
    return await this.isElementVisible(this.viewStoredFileButtonSelector);
  }

  async isDisplayedFileContentVisible() {
    return await this.isElementVisible(this.displayedFileContentTextareaSelector);
  }

  async getDisplayedFileContentText() {
    const textarea = this.window.getByTestId(this.displayedFileContentTextareaSelector);
    await textarea.waitFor({ state: 'visible', timeout: this.LONG_TIMEOUT });
    return await textarea.inputValue();
  }

  async isExistingFileNicknameInputVisible() {
    return await this.isElementVisible(this.existingFileNicknameInputSelector);
  }

  async fillInExistingFileNickname(nickname: string) {
    await this.fill(this.existingFileNicknameInputSelector, nickname);
  }

  async fillInExistingFileDescription(description: string) {
    await this.fill(this.existingFileDescriptionTextareaSelector, description);
  }

  async clickOnUpdateFileButton() {
    await this.click(this.updateFileButtonSelector);
  }

  async clickOnAppendFileButton() {
    await this.click(this.appendFileButtonSelector);
  }

  async clickOnReadFileButton() {
    await this.click(this.readFileButtonSelector);
  }

  async clickOnAddNewFileButton() {
    await this.click(this.addNewButtonSelector);
  }

  async clickOnCreateNewFileLink() {
    await this.click(this.createNewLinkSelector);
  }

  async clickOnUpdateFileLink() {
    await this.click(this.updateLinkSelector);
  }

  async clickOnAppendFileLink() {
    await this.click(this.appendLinkSelector);
  }

  async clickOnReadFileLink() {
    await this.click(this.readLinkSelector);
  }

  async clickOnAddExistingFileLink() {
    await this.click(this.addExistingLinkSelector);
  }

  async clickOnLinkFileButton() {
    await this.click(this.linkFileButtonSelector);
  }

  async isLinkFileButtonDisabled() {
    return await this.isDisabled(this.linkFileButtonSelector);
  }

  async areAddNewFileOptionsVisible() {
    const checks = await Promise.all([
      this.isElementVisible(this.createNewLinkSelector),
      this.isElementVisible(this.updateLinkSelector),
      this.isElementVisible(this.appendLinkSelector),
      this.isElementVisible(this.readLinkSelector),
      this.isElementVisible(this.addExistingLinkSelector),
    ]);

    return checks.every(isTrue => isTrue);
  }

  async fillInExistingFileId(fileId: string) {
    await this.fill(this.existingFileIdInputSelector, fileId);
  }

  async getFileIdText() {
    return await this.getText(this.fileIdTextSelector, null, 3000);
  }

  async getFileSizeText() {
    return await this.getText(this.fileSizeTextSelector);
  }

  async getFileKeyText() {
    return await this.getText(this.fileKeyTextSelector);
  }

  async getFileKeyTypeText() {
    return await this.getText(this.fileKeyTypeTextSelector);
  }

  async getFileMemoText() {
    return await this.getText(this.fileMemoTextSelector);
  }

  async getFileLedgerText() {
    return await this.getText(this.fileLedgerTextSelector);
  }

  async getFileExpirationText() {
    return await this.getText(this.fileExpirationTextSelector);
  }

  async getFileDescriptionText() {
    return await this.getText(this.fileDescriptionTextSelector);
  }

  async getFirstFileFromList() {
    return this.unlikedFiles[0];
  }

  async isUnlinkedFilesEmpty() {
    return this.unlikedFiles.length === 0;
  }

  async addFileToUnliked(fileId: string) {
    this.unlikedFiles.push(fileId);
  }

  async clickOnFilesMenuButton() {
    await this.click(this.filesMenuButtonSelector);
  }

  async clickOnConfirmUnlinkFileButton() {
    await this.click(this.confirmUnlinkFileButtonSelector);
  }

  async isConfirmUnlinkFileButtonVisible() {
    return await this.isElementVisible(this.confirmUnlinkFileButtonSelector);
  }

  async getFirstFileIdFromPage() {
    return await this.getText(this.fileIdListPrefixSelector + '0');
  }

  async clickOnAddNewButtonForFile() {
    await this.click(this.addNewButtonSelector);
  }

  async clickOnFileCardByFileId(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      throw new Error(`File ${fileId} was not found in the list`);
    }
    await this.click(this.fileIdListPrefixSelector + index);
  }

  async getFileIdByIndex(index: number) {
    return await this.getText(this.fileIdListPrefixSelector + index);
  }

  async getFileNicknameByIndex(index: number) {
    return await this.getText(this.fileNicknameListPrefixSelector + index);
  }

  async isMultiSelectFileCheckboxVisibleByIndex(index: number) {
    return await this.isElementVisible(this.multiSelectFileCheckboxSelector + index);
  }

  async clickOnFileCheckbox(fileId: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const index = await this.findFileByIndex(fileId);
    await this.click(this.multiSelectFileCheckboxSelector + index);
  }

  async findFileByIndex(fileId: string) {
    const count = await this.countElements(this.fileIdListPrefixSelector);
    if (count === 0) {
      return 0;
    } else {
      for (let i = 0; i < count; i++) {
        const idText = await this.getText(this.fileIdListPrefixSelector + i);
        if (idText === fileId) {
          return i;
        }
      }
      return -1; // Return -1 if the account ID is not found
    }
  }

  async isFileCardVisible(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      return false; // file not found
    } else {
      return await this.isElementVisible(this.fileIdListPrefixSelector + index);
    }
  }

  async isFileCardHidden(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      return true; // file not found
    } else {
      return await this.isElementHidden(this.fileIdListPrefixSelector + index);
    }
  }

  async ensureFileExistsAndUnlinked() {
    if (await this.isUnlinkedFilesEmpty()) {
      const { fileId } = await this.transactionPage.createFile('test');
      await this.clickOnFilesMenuButton();
      await this.clickOnRemoveFileCardButton();
      await this.clickOnConfirmUnlinkFileButton();
      await this.addFileToUnliked(fileId ?? '');
      await this.waitForElementToDisappear(this.toastMessageSelector);
    }
  }

  async clickOnSelectManyFilesButton() {
    await this.click(this.selectManyFilesButtonSelector);
  }
}
