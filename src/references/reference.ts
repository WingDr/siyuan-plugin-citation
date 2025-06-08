import { Protyle, type IProtyle } from "siyuan";
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
import type { ISpanItem } from "src/utils/types";

// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;
  private Cite: Cite;
  private LiteratureNote: LiteratureNote;
  private refStartNode!: HTMLElement | null;
  private refEndNode!: HTMLElement | null;
  private refSpanList!: HTMLElement[];
  private replaceEndNode!: boolean;

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
    this.refStartNode = null;
    this.refEndNode = null;
    this.refSpanList = [];
  }

  // Main Functions

  public setEmptySelection(): void {
    this.refStartNode = null;
    this.refEndNode = null;
    this.replaceEndNode = false;
    this.refSpanList = [];
  }

  public getAllNeighborReference(protyle: IProtyle, needTransport=true): {
    keyList: string[],
    refStartNode: HTMLElement | null,
    refEndNode: HTMLElement | null
  } {
    // 只允许使用debug-bridge和siyuan面板的使用neighbor特性
    const database = this.plugin.data[STORAGE_NAME].database;
    const dbSearchDialogType = this.plugin.data[STORAGE_NAME].dbSearchDialogType;
    if (["Zotero (debug-bridge)", "Juris-M (debug-bridge)"].indexOf(database) == -1 || (dbSearchDialogType != "SiYuan" && needTransport)) {
      this.refStartNode = null;
      this.refEndNode = null;
      return {keyList: [], refStartNode: null, refEndNode: null};
    }
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到protyle=>", protyle);
    if (!protyle.toolbar) {
      // 如果获取不到toolbar就不选择
      this.setEmptySelection(); 
      return {keyList: [], refStartNode: null, refEndNode: null};
    }
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到选区=>", protyle.toolbar.range);
    const pRange = protyle.toolbar.range;
    const selectedNode = pRange.startContainer;
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("定位到起始点=>", selectedNode);
    let isInRef = false;
    let currentElement = selectedNode as HTMLElement;
    if (selectedNode.parentElement && this._checkReferenceElement(selectedNode.parentElement)) {
      //说明输入在引用内
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("起始点在引用内");
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
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到头引用=>", startElements);
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
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到尾引用=>", endElements);
    const refStartNode = startElements[0];
    const refEndNode = endElements[endElements.length - 1]
    this.refStartNode = refStartNode;
    this.refEndNode = refEndNode;
    const existRefSpanList = isInRef ? [...startElements.slice(0, -1), ...endElements] : [...startElements.slice(0, -1), ...endElements.slice(1)];
    this.refSpanList = existRefSpanList;
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("所有引用=>", existRefSpanList);
    const existRefList = existRefSpanList.map((e:HTMLSpanElement) => {
      return this.plugin.literaturePool.get(e.getAttribute("data-id") as string);
    });
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("头尾引用为, nodes=>", {start: this.refStartNode, end: this.refEndNode});
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("所有引用, key=>", existRefList);
    this.replaceEndNode = (refEndNode != selectedNode);
    return {
      keyList: existRefList,
      refStartNode: refStartNode,
      refEndNode: refEndNode
    };
  }

  public async updateNeighborLinks(element:HTMLElement, protyle: IProtyle, target_type: string) {
    const block = this._getCurrentBlock(element);
    const blockID = block.getAttribute("data-node-id");
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到当前元素所在块：", {block, blockID});
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("更新结果：", {block, blockID});
    if (!blockID) return;
    const keys = this.getAllNeighborReference(protyle, false).keyList;
    const content = await this.processReferenceContents(keys, protyle.block.rootID, target_type);
    const replacedHTML = this.refSpanList.map(e => e.outerHTML).join("");
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("更新前的HTML：", {block:block.innerHTML, span:replacedHTML});
    const res = block.outerHTML.toString().replace(replacedHTML, content.join(""));
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("更新后的HTML：", {block:res});
    this.plugin.kernelApi.updateBlockContent(blockID, "dom", res);
  }

  public async updateLiteratureLink(fileId: string) {
    // 获得所有含有文献引用的块，用于内容更新
    const res = await this.plugin.kernelApi.getCitedBlocks(fileId);
    const data = res.data as any[];
    const citedBlocks = data.map(block => {
      return {
        id: block.id as string,
        content: block.markdown as string
      };
    });
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到引用块内容=>", citedBlocks);
    const writeList:{content: string, blockId: string}[] = [];
    const generatePromise = citedBlocks.map(async block => {
      const spans = (await this.plugin.kernelApi.getCitedSpans(block.id)).data as ISpanItem[];
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到引用行级元素span=>", spans);
      // 引用块的结构：(( id "content" )){: ial_data }，因此要通过查找到的spans进行处理
      const reg = refReg;
      const cited_spans = spans.reduce((acc:any[], cur) => {
        const matchRes = cur.markdown.match(reg);
        const target_id = matchRes![1].split(" ")[0];
        // 如果不在文献池里说明不是文献的引用
        if (!this.plugin.literaturePool.get(target_id))  return acc;
        const full_content = cur.markdown + cur.ial;
        const cite_type = cur.ial.match(/custom-cite-type=\"(.*?)\"/)![1];
        const startPos = block.content.indexOf(full_content);
        const endPos = startPos+full_content.length;
        let res = acc;
        const curObj = { ...cur, target: target_id, key: this.plugin.literaturePool.get(target_id), full_content, startPos, endPos, cite_type};
        let newTerm = true;   // 标志是否需要新建一个term
        for (const [res_idx, term] of (res as {startPos: number, endPos: number}[][]).entries()) {
          let skip = false;   // 标志是否退出
          for (const [term_idx, item] of term.entries()) {
            if (startPos == item.endPos) { // 塞到后面
              res[res_idx] = [...res[res_idx].slice(0, term_idx+1), curObj, ...res[res_idx].slice(term_idx+1)];
              skip = true; newTerm = false; break;
            } else if (endPos == item.startPos) { // 塞到前面
              res[res_idx] = [...res[res_idx].slice(0, term_idx-1), curObj, ...res[res_idx].slice(term_idx-1)];
              skip = true; newTerm = false; break;
            }
          }
          if (skip) break;
        }
        if (newTerm) res = [...res, [curObj]];
        return res;
      }, []);
      if (!cited_spans.length) return;
      const replaceList: { full_content: any; insertContent: any; }[] = [];
      await Promise.all(cited_spans.map(async group_cite => {
        const insertContent = await this.processReferenceContents(group_cite.map((span: { key: any; }) => span.key), fileId, group_cite[0].cite_type);
        return group_cite.map((span: any, idx: number) => {
          replaceList.push({
            full_content: span.full_content,
            insertContent: insertContent[idx]
          });
        });
      }));
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获得块中引用行级元素基本信息=>", {block, cited_spans, replaceList});
      let newContent = block.content;
      replaceList.forEach(span => {
        newContent = newContent.replace(span.full_content, span.insertContent);
      });
      writeList.push({
        content: newContent,
        blockId: block.id
      });
    });
    await Promise.all(generatePromise);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("写入引用列表 =>", writeList);
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
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("找不到文献数据", {key, blockID: this.plugin.literaturePool.get(key)});
        this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
        // 在zotero里对应不到了，把文档名改成unlinked
        const literatureId = this.plugin.literaturePool.get(key);
        const res = await this.plugin.kernelApi.getBlock(literatureId);
        await this.plugin.kernelApi.renameDoc(notebookId, (res.data as any[])[0].path , "unlinked");
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
      const title = (res.data as any[])[0].content;
      if (noteTitle != title) await this.plugin.kernelApi.renameDoc(notebookId, (res.data as any[])[0].path , noteTitle);
      const literatureKey = ((await this.plugin.kernelApi.getBlockAttrs(literatureId)) as any).data["custom-literature-key"];
      if (literatureKey != entry.key) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("给文档刷新key，detail=>", {id: literatureId, name: entry.key});
        await this.plugin.kernelApi.setBlockKey(literatureId, entry.key);
      } else if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文档无需刷新key，detail=>", {id: literatureId, name: entry.key});
    });
    return await Promise.all(pList).then(async () => {
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("所有文件标题已更新");
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
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("所有文献内容刷新完毕");
    this.plugin.noticer.info((this.plugin.i18n.notices as any).refreshLiteratureNoteContentsSuccess, {size: this.plugin.literaturePool.size});
  }

  public async refreshSingleLiteratureNote(literatureId: string, needRefresh=true, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
    // 在刷新之前先更新一下文献池
    if (needRefresh) await loadLocalRef(this.plugin);
    const key = this.plugin.literaturePool.get(literatureId);
    const entry = await this.plugin.database.getContentByKey(key);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("从database中获得文献内容 =>", entry);
    if (!entry) {
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("找不到文献数据", {key, blockID: this.plugin.literaturePool.get(key)});
      this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
      return null;
    }
    await this.LiteratureNote.updateLiteratureNote(key, entry, noConfirmUserData);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文献内容刷新完毕, literatureId=>", {literatureId, key, title: entry.title});
    if (needRefresh) this.plugin.noticer.info((this.plugin.i18n.notices as any).refreshSingleLiteratureNoteSuccess, {key});
    return;
  }

  public async insertContent(protyle: Protyle, content: string, refStartNode: HTMLElement | null = null, refEndNode: HTMLElement | null = null) {
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("插入内容, detail=>", {protyle, content});
    const blockId = protyle.protyle.block.id;
    const rootId = protyle.protyle.block.rootID;
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("Protyle块ID =>", blockId);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("Protyle文档ID =>", rootId);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("插入的内容为, content=>", content);
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("头尾引用为, nodes=>", {start: refStartNode, end: refEndNode});
    // 避免重复设置或者不设置导致的bug
    if (refStartNode && refStartNode != protyle.protyle.toolbar!.range.startContainer) protyle.protyle.toolbar!.range.setStartBefore(refStartNode);
    if (refEndNode && this.replaceEndNode){
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("确认结尾节点变化，替换结尾节点");
      protyle.protyle.toolbar!.range.setEndAfter(refEndNode);
    } 
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("替换选区为, range=>", {range: protyle.protyle.toolbar!.range});
    await protyle.insert(content, false, true);
    // TODO 等待前后端联动API更新再更新文档标号
    // if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.getCursorOffsetInBlock(blockId);
    // await this.plugin.kernelApi.setBlockCited(blockId, true);
    // await this.plugin.reference.updateLiteratureLink(rootId);
  }

  public async copyContent(content: string, type: string) {
    if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("复制的内容为, content=>", content);
    navigator.clipboard.writeText(content);
    this.plugin.noticer.info(((this.plugin.i18n.notices as any).copyContentSuccess as string), {type});
  }

  // Extra Functions
  public getCurrentTypeSetting(type_name: string) {
    let typeSetting = {};
    const nameList = this.plugin.data[STORAGE_NAME].linkTemplatesGroup.map((tmp: { name: any; }) => {
      return tmp.name;
    }) as string[];
    if (!type_name.length || nameList.indexOf(type_name) == -1) {
      // 没有名称或者找不到的时候使用默认设置
      typeSetting = this.plugin.data[STORAGE_NAME];
    } else {
      typeSetting = this.plugin.data[STORAGE_NAME].linkTemplatesGroup[nameList.indexOf(type_name)];
    }
    return typeSetting;
  }

  public async moveImgToAssets(imgPath: string, detail: any, linkType: "html" | "markdown" = "markdown"): Promise<string> {
    return await this.LiteratureNote.moveImgToAssets(imgPath, detail, linkType);
  }

  public async processReferenceContents(keys: string[], fileId?: string, type_name="", returnDetail=false, errorReminder=true): Promise<any[]> {
    // let literatureEnum = [];
    // if (fileId) literatureEnum = await this._getLiteratureEnum(fileId);
    const typeSetting = this.getCurrentTypeSetting(type_name);
    const existNotes = this.plugin.literaturePool.keys;
    const insertContent = keys.map(async (key, i) => {
      const idx = existNotes.indexOf(key);
      const entry = await this.plugin.database.getContentByKey(key);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry || !entry.key) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("找不到文献数据", {key, blockID: this.plugin.literaturePool.get(key)});
        if (errorReminder) this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
        return null;
      }
      await this.LiteratureNote.updateLiteratureNote(key, entry);
      const citeId = this.plugin.literaturePool.get(key);
      const link = this._processMultiCitation(await this.Cite.generateCiteLink(key, idx, typeSetting, false), i, keys.length, typeSetting);
      const name = await this.Cite.generateLiteratureName(key, typeSetting);
      if (returnDetail) {
        let content = link;
        const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
        const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
        if (customCiteText) content = await this.Cite.generateCiteLink(key, idx, typeSetting, true);
        if (customCiteText && useDynamicRefLink) content = name;
        const citeRef = await this.Cite.generateCiteRef(citeId, link, name, typeSetting);
        return {
          citeId,
          content,
          citeRef,
          entry
        };
      }
      return await this.Cite.generateCiteRef(citeId, link, name, typeSetting);
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
      this.plugin.literaturePool.get(element.getAttribute("data-id")!)) {
        //说明输入在引用内
        return true;
    }
    else return false;
  }

  private _processMultiCitation(link: string, idx:number, full_length:number, typeSetting: any): string {
    const prefix = typeSetting.multiCitePrefix ?? "" ;
    const connector = typeSetting.multiCiteConnector ?? "";
    const suffix = typeSetting.multiCiteSuffix ?? "";
    if (full_length == 1) return prefix + link + suffix;
    else if (idx == 0) return prefix + link + connector;
    else if (idx == full_length-1) return link + suffix;
    else return link + connector; 
  }

  // Group: 获取当前文档内容

  private _getCurrentBlock(source: HTMLElement):HTMLElement {
    let target = source;
    let i = 1;
    while (!target.getAttribute("data-node-id") && i < 10) {
      i = i+1;
      target = target.parentElement!;
    }
    return target;
  }

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