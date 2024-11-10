import { Protyle } from "siyuan";
import SiYuanPluginCitation from "../index";
import { type SiyuanData } from "../api/base-api";
import {
  STORAGE_NAME, isDev, citeLinkStatic, citeLinkDynamic, 
  DISALLOWED_FILENAME_CHARACTERS_RE, 
  refReg
} from "../utils/constants";
import {
  generateFromTemplate
} from "../utils/templates";
import { type ILogger, createLogger } from "../utils/simple-logger";
import { loadLocalRef } from "../utils/util";
import { Cite } from "./cite";
import { LiteratureNote } from "./literatureNote";

// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;
  private Cite: Cite;
  private LiteratureNote: LiteratureNote;
  private refStartNode: HTMLElement;
  private refEndNode: HTMLElement;

  constructor(plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.checkRefDirExist();
    this.logger = createLogger("reference");
    this.Cite = new Cite(plugin);
    this.LiteratureNote = new LiteratureNote(plugin);
  }

  // Basic Functions

  public async checkRefDirExist() {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const res = await this.plugin.kernelApi.searchFileInSpecificPath(notebookId, refPath);
    this.plugin.isRefPathExist = (res.data as any[]).length ? true: false;
  }

  // Main Functions

  public getAllNeighborReference(protyle: Protyle): string[] {
    if (isDev) this.logger.info("获取到protyle=>", protyle);
    if (isDev) this.logger.info("获取到选区=>", protyle.protyle.toolbar.range);
    const pRange = protyle.protyle.toolbar.range;
    const selectedNode = pRange.startContainer;
    if (isDev) this.logger.info("定位到起始点=>", selectedNode);
    let isInRef = false;
    let currentElement = selectedNode as HTMLElement;
    if (selectedNode.parentElement && this._checkReferenceElement(selectedNode.parentElement)) {
      //说明输入在引用内
      if (isDev) this.logger.info("起始点在引用内");
      currentElement = selectedNode.parentElement;
      isInRef = true;
    }
    let startElements = null;
    if (!isInRef && pRange.startOffset > 0) {
      // 说明输入在纯文字中，令起始点为自己
      startElements = [currentElement];
    } else {
      startElements = this._getNeighborReference(currentElement, true);
    }
    if (isDev) this.logger.info("获取到头引用=>", startElements);
    let endElements = null;
    if (isInRef) {
      endElements = this._getNeighborReference(currentElement, false);
    }else if (pRange.endOffset + (currentElement as any).wholeText.indexOf(currentElement.textContent) < (currentElement as any).wholeText.length
      || !(currentElement.nextElementSibling && this._checkReferenceElement(currentElement.nextElementSibling as HTMLElement))) {
      // 说明输入在纯文字中，令结束点为自己
      endElements = [currentElement];
    } else {
      // 由于文本的末尾nextSibling永远会出现空字符占位，所以需要独立判断然后跳过
      endElements = [currentElement, ...this._getNeighborReference(currentElement.nextElementSibling as HTMLSpanElement, false)];
    }
    if (isDev) this.logger.info("获取到尾引用=>", endElements);
    this.refStartNode = startElements[0];
    this.refEndNode = endElements[endElements.length - 1];
    const existRefSpanList = isInRef ? [...startElements.slice(0, -1), ...endElements] : [...startElements.slice(0, -1), ...endElements.slice(1)];
    if (isDev) this.logger.info("所有引用=>", existRefSpanList);
    const existRefList = existRefSpanList.map((e:HTMLSpanElement) => {
      return this.plugin.literaturePool.get(e.getAttribute("data-id"));
    });
    if (isDev) this.logger.info("所有引用, key=>", existRefList);
    return existRefList;
  }

  public async updateLiteratureLink(fileId: string): Promise<SiyuanData[]> {
    const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink as boolean;
    // 获得所有含有文献引用的块，用于内容更新
    const res = await this.plugin.kernelApi.getCitedBlocks(fileId);
    const data = res.data as any[];
    const citedBlocks = data.map(block => {
      return {
        id: block.id as string,
        content: block.markdown as string
      };
    });
    const literatureEnum = await this._getLiteratureEnum(fileId);
    const writeList:{content: string, blockId: string}[] = [];
    const cancelCiteList:{blockId: string}[] = [];
    const generatePromise = citedBlocks.map(async block => {
      const reg = refReg;
      let isModified = false;
      // 因为replace只能同步使用，所以先构建替换表
      const matchRes = block.content.matchAll(reg);
      const replaceList: {[key: string]: string} = {};
      for (const match of matchRes) {
        const key = match[1].split(" ")[0];
        const anchor = match[1].slice(key.length + 1);
        const idx = literatureEnum.indexOf(key);
        if (idx != -1) {
          const link = await this.Cite.generateCiteLink(this.plugin.literaturePool.get(key), idx, this.plugin.data[STORAGE_NAME].customCiteText);
          if (isDev) this.logger.info("更新文献引用 =>", link);
          if (!link) continue;
          if (useDynamicRefLink) {
            if (anchor != "''") {
              isModified = true;
            }
            replaceList[key] = citeLinkDynamic.replace("${id}", key);
          } else {
            if (anchor != `"${link}"`) {
              isModified = true;
            }
            replaceList[key] = citeLinkStatic.replace("${id}", key).replace("${link}", link);
          }
          
        }
      }
      const newContent = block.content.replace(reg, (match, p1) => {
        const key = p1.split(" ")[0];
        if (Object.keys(replaceList).indexOf(key) != -1) return replaceList[key];
        return match;
      });
      if (isModified) {
        writeList.push({
          content: newContent,
          blockId: block.id as string
        });
      }
    });
    await Promise.all(generatePromise);
    if (isDev) this.logger.info("取消引用列表 =>", cancelCiteList);
    if (isDev) this.logger.info("写入引用列表 =>", writeList);
    const update = writeList.map(witem => {
      return this.plugin.kernelApi.updateCitedBlock(witem.blockId, witem.content);
    });
    return Promise.all(update);
  }

  public async refreshLiteratureNoteTitles(titleTemplate: string) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    // 在刷新之前先更新一下文献池
    await loadLocalRef(this.plugin);
    const pList = this.plugin.literaturePool.keys.map(async key => {
      const entry = await this.plugin.database.getContentByKey(key);
      if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry) {
        if (isDev) this.logger.error("找不到文献数据");
        this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
        return null;
      }
      const noteTitle = generateFromTemplate(titleTemplate, entry);
      noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
      // 不对的时候才更新
      const literatureId = this.plugin.literaturePool.get(key);
      const res = await this.plugin.kernelApi.getBlock(literatureId);
      if (!(res.data as any[]).length) {
        // 如果这个文档没有了，那就在池子里去掉它
        this.plugin.literaturePool.delete(key);
        return;
      } 
      const title = res.data[0].content;
      if (noteTitle != title) await this.plugin.kernelApi.renameDoc(notebookId, res.data[0].path , noteTitle);
      const literatureKey = (await this.plugin.kernelApi.getBlockAttrs(literatureId)).data["custom-literature-key"];
      if (literatureKey != entry.key) {
        if (isDev) this.logger.info("给文档刷新key，detail=>", {id: literatureId, name: entry.key});
        await this.plugin.kernelApi.setBlockKey(literatureId, entry.key);
      }
      if (isDev) this.logger.info("文档无需刷新key，detail=>", {id: literatureId, name: entry.key});
    });
    return await Promise.all(pList).then(async () => {
      if (isDev) this.logger.info("所有文件标题已更新");
      this.plugin.noticer.info((this.plugin.i18n.notices as any).refreshTitleSuccess, {size: this.plugin.literaturePool.size});
      await loadLocalRef(this.plugin);
      return this.plugin.literaturePool.content;
    }).catch(e => {
      this.logger.error(e);
    });
  }

  public async refreshLiteratureNoteContents(noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
    // 在刷新之前先更新一下文献池
    await loadLocalRef(this.plugin);
    const ids = this.plugin.literaturePool.ids;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      await this.refreshSingleLiteratureNote(id, false, noConfirmUserData);
    }
    if (isDev) this.logger.info("所有文献内容刷新完毕");
    this.plugin.noticer.info((this.plugin.i18n.notices as any).refreshLiteratureNoteContentsSuccess, {size: this.plugin.literaturePool.size});
  }

  public async refreshSingleLiteratureNote(literatureId: string, needRefresh=true, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
    // 在刷新之前先更新一下文献池
    if (needRefresh) await loadLocalRef(this.plugin);
    const key = this.plugin.literaturePool.get(literatureId);
    const entry = await this.plugin.database.getContentByKey(key);
    if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
      return null;
    }
    await this.LiteratureNote.updateLiteratureNote(key, entry, noConfirmUserData);
    if (isDev) this.logger.info("文献内容刷新完毕, literatureId=>", {literatureId, key, title: entry.title});
    if (needRefresh) this.plugin.noticer.info((this.plugin.i18n.notices as any).refreshSingleLiteratureNoteSuccess, {key});
    return;
  }

  public async insertContent(protyle, content: string) {
    if (isDev) this.logger.info("插入内容, detail=>", {protyle, content});
    const blockId = protyle.protyle.block.id;
    const rootId = protyle.protyle.block.rootID;
    if (isDev) this.logger.info("Protyle块ID =>", blockId);
    if (isDev) this.logger.info("Protyle文档ID =>", rootId);
    if (isDev) this.logger.info("插入的内容为, content=>", content);
    // 避免重复设置导致的bug
    if (this.refStartNode != protyle.protyle.toolbar.range.startContainer) protyle.protyle.toolbar.range.setStartBefore(this.refStartNode);
    if (this.refEndNode != protyle.protyle.toolbar.range.endContainer) protyle.protyle.toolbar.range.setEndAfter(this.refEndNode);
    await protyle.insert(content, false, true);
    // TODO 等待前后端联动API更新再更新文档标号
    // if (isDev) this.getCursorOffsetInBlock(blockId);
    // await this.plugin.kernelApi.setBlockCited(blockId, true);
    // await this.plugin.reference.updateLiteratureLink(rootId);
  }

  public async copyContent(content: string, type: string) {
    if (isDev) this.logger.info("复制的内容为, content=>", content);
    navigator.clipboard.writeText(content);
    this.plugin.noticer.info(((this.plugin.i18n.notices as any).copyContentSuccess as string), {type});
  }

  // Extra Functions

  public async processReferenceContents(keys: string[], fileId?: string, returnDetail=false, errorReminder=true): Promise<any[]> {
    // let literatureEnum = [];
    // if (fileId) literatureEnum = await this._getLiteratureEnum(fileId);
    const existNotes = this.plugin.literaturePool.keys;
    const insertContent = keys.map(async (key, i) => {
      const idx = existNotes.indexOf(key);
      const entry = await this.plugin.database.getContentByKey(key);
      if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry || !entry.key) {
        if (isDev) this.logger.error("找不到文献数据");
        if (errorReminder) this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
        return null;
      }
      await this.LiteratureNote.updateLiteratureNote(key, entry);
      const citeId = this.plugin.literaturePool.get(key);
      const link = this._processMultiCitation(await this.Cite.generateCiteLink(key, idx, false), i, insertContent.length);
      const name = await this.Cite.generateLiteratureName(key);
      if (returnDetail) {
        let content = link;
        const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
        const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
        if (customCiteText) content = await this.Cite.generateCiteLink(key, idx, true);
        if (customCiteText && useDynamicRefLink) content = name;
        const citeRef = await this.Cite.generateCiteRef(citeId, link, name);
        return {
          citeId,
          content,
          citeRef,
          entry
        };
      }
      return await this.Cite.generateCiteRef(citeId, link, name);
    });
    return await Promise.all(insertContent);
  }

  private _getNeighborReference(currentElement: HTMLSpanElement, forward: boolean): HTMLSpanElement[] {
    // 递归查找相邻的引用列表
    if (forward) {
      if (currentElement.previousSibling && this._checkReferenceElement(currentElement.previousSibling as HTMLElement)) {
        return [...this._getNeighborReference(currentElement.previousSibling as HTMLSpanElement, true), currentElement];
      } else return [currentElement];
    } else {
      if (currentElement.nextSibling && this._checkReferenceElement(currentElement.nextSibling as HTMLElement)) {
        return [currentElement, ...this._getNeighborReference(currentElement.nextSibling as HTMLSpanElement, false)];
      } else return [currentElement];
    }
    
  }

  private _checkReferenceElement(element: HTMLElement): boolean {
    if (
      element.getAttribute &&
      element.getAttribute("data-type") == "block-ref" &&
      this.plugin.literaturePool.get(element.getAttribute("data-id"))) {
        //说明输入在引用内
        return true;
    }
    else return false;
  }

  private _processMultiCitation(link: string, idx:number, full_length:number): string {
    const prefix = this.plugin.data[STORAGE_NAME].multiCitePrefix;
    const connector = this.plugin.data[STORAGE_NAME].multiCiteConnector;
    const suffix = this.plugin.data[STORAGE_NAME].multiCiteSuffix;
    if (full_length == 1) return prefix + link + suffix;
    else if (idx == 0) return prefix + link + connector;
    else if (idx == full_length-1) return link + suffix;
    else return link + connector; 
  }

  // Group: 获取当前文档内容

  private async _getLiteratureEnum(fileId: string): Promise<string[]> {
    // 获得该文件的全部kramdown内容，用于引用排序
    const res = await this.plugin.kernelApi.getBlockContent(fileId);
    const data = res.data as any;
    const fileContent = data.kramdown as string;
    // 获取所有可以引用的citekey，用于筛选在文件中的引用
    const citekeys = this.plugin.database.getTotalKeys();
    return citekeys.map(key => {
      return {
        citekey: key as string,
        idx: fileContent.indexOf(this.plugin.literaturePool.get(key)) as number,
      };
    })
    .filter(key => key.idx != -1)
    .sort((a,b) => a.idx - b.idx)
    .map(item => {
      return this.plugin.literaturePool.get(item.citekey);
    });

  }
}