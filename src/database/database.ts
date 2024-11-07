import { Protyle } from "siyuan";
import SiYuanPluginCitation from "../index";
import{
  loadLocalRef
} from "../utils/util";
import { isDev, databaseType, STORAGE_NAME } from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import { 
  DataModal,
  FilesModal,
  ZoteroModal,
  ZoteroDBModal
} from "./modal";

export type DatabaseType = typeof databaseType[number];

export class Database {
  private logger: ILogger;
  public type: DatabaseType;
  private dataModal: DataModal;

  private protyle: Protyle;

  constructor(private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("database");
    this.type = null;
    this.dataModal = null;
  }

  public async buildDatabase(type: DatabaseType) {
    // 如果数据库类型没变化就不需要再构建
    if (type === this.type) {
      return null;
    }
    this.type = type;

    // 如果已经存在就删除原先的
    if (this.dataModal) delete this.dataModal;

    if (isDev) this.logger.info("建立数据库类型=>", {type});
    switch (type) {
      case "BibTex and CSL-JSON": {
        this.dataModal = new FilesModal(this.plugin);
        break;
      }
      case "Zotero (better-bibtex)": {
        this.dataModal = new ZoteroModal(this.plugin, "Zotero");
        break;
      }
      case "Juris-M (better-bibtex)": {
        this.dataModal = new ZoteroModal(this.plugin, "Juris-M");
        break;
      }
      case "Zotero (debug-bridge)": {
        this.dataModal = new ZoteroDBModal(this.plugin, "Zotero", this.plugin.data[STORAGE_NAME].useItemKey);
        break;
      }
      case "Juris-M (debug-bridge)": {
        this.dataModal = new ZoteroDBModal(this.plugin, "Juris-M", this.plugin.data[STORAGE_NAME].useItemKey);
        break;
      }
    }
    await this.dataModal.buildModal();
    if (isDev) this.logger.info("载入引用");
    loadLocalRef(this.plugin);
  }


  // Group: 功能接口

  public async insertCiteLink(protyle: Protyle) {
    this.protyle = protyle;
    if (await this.checkSettings()) return this.dataModal.showSearching(protyle, this.insertCiteLinkBySelection.bind(this));
    else protyle.insert("", false, true);
  }

  public insertNotes(protyle:Protyle) {
    this.protyle = protyle;
    this.dataModal.showSearching(protyle, this.insertNotesBySelection.bind(this));
  }

  public async insertSelectedCiteLink(protyle: Protyle) {
    this.protyle = protyle;
    if (await this.checkSettings()) {
      const keys = await this.dataModal.getSelectedItems();
      if (isDev) this.logger.info("获得到Zotero中选中的条目, keys=>", keys);
      if (!keys.length) this.plugin.noticer.info(this.plugin.i18n.notices.noSelectedItem);
      else this.insertCiteLinkBySelection(keys);
    } else {
      protyle.insert("", false, true);
    }
  }

  public async copyCiteLink() {
    if (await this.checkSettings()) return this.dataModal.showSearching(null, this.copyCiteLinkBySelection.bind(this));
  }

  public copyNotes() {
    this.dataModal.showSearching(null, this.copyNotesBySelection.bind(this));
  }

  public async copySelectedCiteLink() {
    if (await this.checkSettings()) {
      const keys = await this.dataModal.getSelectedItems();
      if (isDev) this.logger.info("获得到Zotero中选中的条目, keys=>", keys);
      if (!keys.length) this.plugin.noticer.info(this.plugin.i18n.notices.noSelectedItem);
      else this.copyCiteLinkBySelection(keys);
    }
  }


  // Group: 间接通用接口

  public setSelected(keys: string[]) {
    this.dataModal.selectedList = keys;
  }

  public async getContentByKey(key: string) {
    const content = await this.dataModal.getContentFromKey(key);
    return content;
  }

  public getTotalKeys() {
    return this.dataModal.getTotalKeys();
  }

  public async updateDataSourceItem(key: string, content: {[attr: string]: any}) {
    return this.dataModal.updateDataSourceItem(key, content);
  }

  private async checkSettings(): Promise<boolean> {
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.data[STORAGE_NAME].referenceNotebook === "") {
      this.plugin.noticer.error(this.plugin.i18n.errors.notebookUnselected);
      if (isDev) this.logger.error("未选择笔记本！");
    } else if (!this.plugin.isRefPathExist) {
      this.plugin.noticer.error(this.plugin.i18n.errors.refPathInvalid);
      if (isDev) this.logger.error("文献库路径不存在！");
    } else {
      return true;
    }
    return false;
  }

  private async insertCiteLinkBySelection(keys: string[]) {
    const fileId = (this.protyle as any).protyle.block.rootID;
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const content = await this.plugin.reference.processReferenceContents(keys, fileId);
      this.plugin.reference.insertContent(this.protyle, content.join(""));
    }
  }

  private async insertNotesBySelection(keys: string[]) {
    const insertContent = keys.map(async key => {
      return await this.plugin.database.dataModal.getCollectedNotesFromKey(key);
    });
    const content = await Promise.all(insertContent);
    this.plugin.reference.insertContent(this.protyle, content.join(""));
  }

  private async copyCiteLinkBySelection(keys: string[]) {
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const content = await this.plugin.reference.processReferenceContents(keys);
      this.plugin.reference.copyContent(content.join(""), this.plugin.i18n.citeLink);
    }
  }

  private async copyNotesBySelection(keys: string[]) {
    const insertContent = keys.map(async key => {
      return await this.plugin.database.dataModal.getCollectedNotesFromKey(key);
    });
    const content = await Promise.all(insertContent);
    this.plugin.reference.copyContent(content.join(""), this.plugin.i18n.notes);
  }
}