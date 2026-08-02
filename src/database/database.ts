import { Protyle, Menu } from "siyuan";
import SiYuanPluginCitation from "../index";
import{
  loadLocalRef,
  sleep
} from "../utils/util";
import { isDev, databaseType, STORAGE_NAME } from "../utils/constants";
import { createLogger, type ILogger } from "../utils/simple-logger";
import {
  DataModal,
  FilesModal,
  ZoteroModal,
  ZoteroDBModal,
  ZoteroWebAPIModal
} from "./modal";

export type DatabaseType = typeof databaseType[number];

export class Database {
  private logger: ILogger;
  public type: DatabaseType | null;
  private dataModal!: DataModal;
  private refStartNode: HTMLElement | null;
  private refEndNode: HTMLElement | null;

  private protyle!: Protyle;
  private docId!: string;

  constructor(private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("database");
    this.type = null;
    this.refStartNode = null;
    this.refEndNode = null;
  }

  public async buildDatabase(type: DatabaseType) {
    // 如果数据库类型没变化就不需要再构建
    if (type === this.type) {
      if (isDev) this.logger.info("数据库无变化，不需要重建");
      return null;
    }
    this.type = type;

    // 如果已经存在就删除原先的
    // if (this.dataModal) delete this.dataModal;

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
      case "Zotero (Web API)": {
        this.dataModal = new ZoteroWebAPIModal(this.plugin, "Zotero");
        break;
      }
      case "Juris-M (Web API)": {
        this.dataModal = new ZoteroWebAPIModal(this.plugin, "Juris-M");
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
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获得到Zotero中选中的条目, keys=>", keys);
      if (!keys.length) this.plugin.noticer.info((this.plugin.i18n.notices as any).noSelectedItem);
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
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获得到Zotero中选中的条目, keys=>", keys);
      if (!keys.length) this.plugin.noticer.info((this.plugin.i18n.notices as any).noSelectedItem);
      else this.copyCiteLinkBySelection(keys);
    }
  }

  public async linkDocToLiterature(docId: string) {
    this.docId = docId;
    // 检查文档id是否合法，文件是否在文献库中
    if (!docId || !docId.length) {
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("无法获取文档ID，无法绑定文档");
      return;
    }
    const res = await this.plugin.kernelApi.getHPathByID(docId);
    const hpath = (res.data as any) as string;
    // 检查文档是否在文献库中
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const fileInPath = await this.plugin.kernelApi.checkFileInHPath(notebookId, refPath, docId);
    console.log(fileInPath);
    if (!hpath || !hpath.length || !fileInPath) {
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文档不在文献库中");
      this.plugin.noticer.error((this.plugin.i18n.errors as any).documentNotInRefDir);
      return;
    }
    if (await this.checkSettings()) return this.dataModal.showSearching(null, this.linkDocToLiteratureBySelection.bind(this));
  }


  // Group: 间接通用接口

  public setSelected(keys: string[]) {
    if (!keys.length) {
      // 确保可能导致选择问题的全部为空
      this.setRefNode(null, null);
      this.docId = "";
      this.plugin.reference.setEmptySelection();
    }
    this.dataModal.selectedList = keys;
  }

  public setRefNode(refStartNode: HTMLElement | null, refEndNode: HTMLElement | null) {
    this.refStartNode = refStartNode;
    this.refEndNode = refEndNode;
  }

  public async getContentByKey(key: string, shortAuthorLimit: number = 2) {
    const content = await this.dataModal.getContentFromKey(key, shortAuthorLimit);
    return content;
  }

  public async getAttachmentByItemKey(itemKey: string) {
    return await this.dataModal.getAttachmentByItemKey(itemKey);
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
      this.plugin.noticer.error((this.plugin.i18n.errors as any).notebookUnselected);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("未选择笔记本！");
    } else if (!this.plugin.isRefPathExist) {
      this.plugin.noticer.error((this.plugin.i18n.errors as any).refPathInvalid);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("文献库路径不存在！");
    } else {
      return true;
    }
    return false;
  }

  private async insertCiteLinkBySelection(keys: string[]) {
    const fileId = (this.protyle as any).protyle.block.rootID;
    await this.plugin.reference.checkRefDirExist();
    if (this.plugin.isRefPathExist) {
      const menu = new Menu("cite-type-selection");
      const linkTempGroup = this.plugin.data[STORAGE_NAME].linkTemplatesGroup;
      const useDefaultCiteType = this.plugin.data[STORAGE_NAME].useDefaultCiteType;
      if (!useDefaultCiteType) {
        linkTempGroup.map((tmp: { name: string | undefined; }) => {
          menu.addItem({
            label: tmp.name,
            icon: "iconRef",
            click: async () => {
              const content = await this.plugin.reference.processReferenceContents(keys, fileId, tmp.name);
              this.plugin.reference.insertContent(this.protyle, content.join(""), this.refStartNode, this.refEndNode);
            }
          });
        });
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("展示引用类型选择菜单", menu);
        const rect = this.protyle.protyle.toolbar!.range.getBoundingClientRect();
        await sleep(500);
        menu.open({
          x: rect.left,
          y: rect.top
        });
      } else {
        const content = await this.plugin.reference.processReferenceContents(keys, fileId, linkTempGroup[0].name);
        this.plugin.reference.insertContent(this.protyle, content.join(""), this.refStartNode, this.refEndNode);
      }
    }
  }

  private async insertNotesBySelection(keys: string[]) {
    const insertContent = keys.map(async key => {
      return await this.dataModal.getCollectedNotesFromKey(key);
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
      return await this.dataModal.getCollectedNotesFromKey(key);
    });
    const content = await Promise.all(insertContent);
    this.plugin.reference.copyContent(content.join(""), this.plugin.i18n.notes);
  }

  private async linkDocToLiteratureBySelection(keys: string[]) {
    if (!keys.length) {
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("没有选择任何条目，无法绑定文档");
      return;
    }
    const key = keys[0];
    const docId = this.docId;
    this.plugin.reference.bindDocumentToLiterature(key, docId);
  }
}