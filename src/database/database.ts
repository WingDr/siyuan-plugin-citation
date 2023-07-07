import { Protyle } from "siyuan";
import SiYuanPluginCitation from "../index";
import{
  loadLocalRef
} from "../utils/util";
import { isDev, databaseType } from "../utils/constants";
import { createLogger, ILogger } from "../utils/simple-logger";
import { 
  DataModal,
  FilesModal,
  ZoteroModal
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

    switch (type) {
      case "BibTex and CSL-JSON": {
        this.dataModal = new FilesModal(this.plugin);
        break;
      }
      case "Zotero": {
        this.dataModal = new ZoteroModal(this.plugin, "Zotero");
        break;
      }
      case "Juris-M": {
        this.dataModal = new ZoteroModal(this.plugin, "Juris-M");
        break;
      }
    }
    await this.dataModal.buildModal();
    if (isDev) this.logger.info("载入引用");
    loadLocalRef(this.plugin);
  }

  public insertCiteLink(protyle: Protyle) {
    this.dataModal.showSearching(protyle, this.insertCiteLinkBySelection);
  }

  public insertNotes(protyle:Protyle) {
    this.dataModal.showSearching(protyle, this.insertCollectedNotesBySelection);
  }

  public copyCiteLink() {
    this.dataModal.showSearching(null, this.copyCiteLinkBySelection);
  }

  public async getContentByCitekey(citekey: string) {
    const content = await this.dataModal.getContentFromCitekey(citekey);
    return content;
  }

  public getTotalCitekeys() {
    return this.dataModal.getTotalCitekeys();
  }

  private async insertCiteLinkBySelection(citekey: string) {
    const fileId = (this.protyle as any).protyle.block.rootID;
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const literatureEnum = await this.plugin.reference.getLiteratureEnum(fileId);
      const existNotes = Object.keys(this.plugin.ck2idDict);
      const idx = existNotes.indexOf(citekey);
      await this.plugin.reference.updateLiteratureNote(citekey);
      const citeId = this.plugin.ck2idDict[citekey];
      let link = "";
      if (idx == -1) {
        link = await this.plugin.reference.generateCiteLink(citekey, literatureEnum.length + 1);
      } else {
        link = await this.plugin.reference.generateCiteLink(citekey, idx);
      }
      this.plugin.reference.insertContent(this.protyle, this.plugin.reference.generateCiteRef(citeId, link));
    }
  }

  private async insertCollectedNotesBySelection(citekey: string) {
    this.plugin.reference.insertContent(this.protyle, await this.plugin.database.dataModal.getCollectedNotesFromCitekey(citekey));
  }

  private async copyCiteLinkBySelection(citekey: string) {
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const existNotes = Object.keys(this.plugin.ck2idDict);
      const idx = existNotes.indexOf(citekey);
      await this.plugin.reference.updateLiteratureNote(citekey);
      const citeId = this.plugin.ck2idDict[citekey];
      const link = await this.plugin.reference.generateCiteLink(citekey, idx);
      this.plugin.reference.copyContent(this.plugin.reference.generateCiteRef(citeId, link));
    }
  }
}