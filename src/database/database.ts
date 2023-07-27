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

    // 如果已经存在就删除原先的
    if (this.dataModal) delete this.dataModal;

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

  public insertCiteLink(protyle: Protyle) {
    this.protyle = protyle;
    this.dataModal.showSearching(protyle, this.insertCiteLinkBySelection.bind(this));
  }

  public insertNotes(protyle:Protyle) {
    this.protyle = protyle;
    this.dataModal.showSearching(protyle, this.insertNotesBySelection.bind(this));
  }

  public copyCiteLink() {
    this.dataModal.showSearching(null, this.copyCiteLinkBySelection.bind(this));
  }

  public copyNotes() {
    this.dataModal.showSearching(null, this.copyNotesBySelection.bind(this));
  }

  public async getContentByKey(key: string) {
    const content = await this.dataModal.getContentFromKey(key);
    return content;
  }

  public getTotalKeys() {
    return this.dataModal.getTotalKeys();
  }

  private async insertCiteLinkBySelection(keys: string[]) {
    const fileId = (this.protyle as any).protyle.block.rootID;
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const literatureEnum = await this.plugin.reference.getLiteratureEnum(fileId);
      const existNotes = Object.keys(this.plugin.key2idDict);
      const insertContent = keys.map(async key => {
        const idx = existNotes.indexOf(key);
        await this.plugin.reference.updateLiteratureNote(key);
        const citeId = this.plugin.key2idDict[key];
        let link = "";
        if (idx == -1) {
          link = await this.plugin.reference.generateCiteLink(key, literatureEnum.length + 1, false);
        } else {
          link = await this.plugin.reference.generateCiteLink(key, idx, false);
        }
        return await this.plugin.reference.generateCiteRef(citeId, link);
      });
      const content = await Promise.all(insertContent);
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
      const existNotes = Object.keys(this.plugin.key2idDict);
      const insertContent = keys.map(async key => {
        const idx = existNotes.indexOf(key);
        await this.plugin.reference.updateLiteratureNote(key);
        const citeId = this.plugin.key2idDict[key];
        const link = await this.plugin.reference.generateCiteLink(key, idx, false);
        return this.plugin.reference.generateCiteRef(citeId, link);
      });
      const content = await Promise.all(insertContent);
      this.plugin.reference.copyContent(content.join(""));
    }
  }

  private async copyNotesBySelection(keys: string[]) {
    const insertContent = keys.map(async key => {
      return await this.plugin.database.dataModal.getCollectedNotesFromKey(key);
    });
    const content = await Promise.all(insertContent);
    this.plugin.reference.copyContent(content.join(""));
  }
}