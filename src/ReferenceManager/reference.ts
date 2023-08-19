import { confirm } from "siyuan";
import SiYuanPluginCitation from "../index";
import { type SiyuanData } from "../api/base-api";
import {
  STORAGE_NAME, isDev, citeLinkStatic, citeLinkDynamic, 
  DISALLOWED_FILENAME_CHARACTERS_RE, 
  refReg, refRegStatic, refRegDynamic
} from "../utils/constants";
import {
  generateFromTemplate
} from "../utils/templates";
import { type ILogger, createLogger } from "../utils/simple-logger";
import { loadLocalRef } from "../utils/util";


// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;

  constructor(plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.checkRefDirExist();
    this.logger = createLogger("reference");
  }

  public async processReferenceContents(keys: string[], fileId?: string, returnDetail=false): Promise<any[]> {
    let literatureEnum = [];
    if (fileId) literatureEnum = await this.getLiteratureEnum(fileId);
    const existNotes = this.plugin.literaturePool.keys;
    const insertContent = keys.map(async key => {
      const idx = existNotes.indexOf(key);
      const entry = await this.plugin.database.getContentByKey(key);
      if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry) {
        if (isDev) this.logger.error("找不到文献数据");
        this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
        return null;
      }
      await this.updateLiteratureNote(key, entry);
      const citeId = this.plugin.literaturePool.get(key);
      const link = await this._generateCiteLink(key, idx, false);
      const name = await this._generateLiteratureName(key);
      if (returnDetail) {
        let content = link;
        const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
        const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
        if (customCiteText) content = await this._generateCiteLink(key, idx, true);
        if (customCiteText && useDynamicRefLink) content = name;
        return {
          citeId,
          content
        };
      }
      return await this._generateCiteRef(citeId, link, name);
    });
    return await Promise.all(insertContent);
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
    const literatureEnum = await this.getLiteratureEnum(fileId);
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
          const link = await this._generateCiteLink(this.plugin.literaturePool.get(key), idx, this.plugin.data[STORAGE_NAME].customCiteText);
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

  public async checkRefDirExist() {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const res = await this.plugin.kernelApi.searchFileInSpecificPath(notebookId, refPath);
    this.plugin.isRefPathExist = (res.data as any[]).length ? true: false;
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
        this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
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
      this.plugin.noticer.info(this.plugin.i18n.notices.refreshTitleSuccess, {size: this.plugin.literaturePool.size});
      await loadLocalRef(this.plugin);
      return this.plugin.literaturePool.content;
    }).catch(e => {
      this.logger.error(e);
    });
  }

  public async refreshLiteratureNoteContents() {
    // 在刷新之前先更新一下文献池
    await loadLocalRef(this.plugin);
    const ids = this.plugin.literaturePool.ids;
    const pList = ids.map(async id => {
      await this.refreshSingleLiteratureNote(id, false);
    });
    await Promise.all(pList).then(() => {
      if (isDev) this.logger.info("所有文献内容刷新完毕");
      this.plugin.noticer.info(this.plugin.i18n.notices.refreshLiteratureNoteContentsSuccess, {size: this.plugin.literaturePool.size});
    });
  }

  public async refreshSingleLiteratureNote(literatureId: string, needRefresh=true) {
    // 在刷新之前先更新一下文献池
    if (needRefresh) await loadLocalRef(this.plugin);
    const key = this.plugin.literaturePool.get(literatureId);
    const entry = await this.plugin.database.getContentByKey(key);
    if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    await this.updateLiteratureNote(key, entry);
    if (isDev) this.logger.info("文献内容刷新完毕, literatureId=>", {literatureId, key, title: entry.title});
    if (needRefresh) this.plugin.noticer.info(this.plugin.i18n.notices.refreshSingleLiteratureNoteSuccess, {key});
    return;
  }

  public async insertContent(protyle, content: string) {
    const blockId = protyle.protyle.breadcrumb.id;
    const rootId = protyle.protyle.block.rootID;
    if (isDev) this.logger.info("Protyle块ID =>", blockId);
    if (isDev) this.logger.info("Protyle文档ID =>", rootId);
    if (isDev) this.logger.info("插入的内容为, content=>", content);
    await protyle.insert(content, false, true);
    // TODO 等待前后端联动API更新再更新文档标号
    // if (isDev) this.getCursorOffsetInBlock(blockId);
    // await this.plugin.kernelApi.setBlockCited(blockId, true);
    // await this.plugin.reference.updateLiteratureLink(rootId);
  }

  public async copyContent(content: string, type: string) {
    if (isDev) this.logger.info("复制的内容为, content=>", content);
    navigator.clipboard.writeText(content);
    this.plugin.noticer.info((this.plugin.i18n.notices.copyContentSuccess as string), {type});
  }


  // Group: 更新文献内容

  private async updateLiteratureNote(key: string, entry: any) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
    const res = this.plugin.kernelApi.searchFileWithKey(notebookId, refPath + "/", key);
    const data = (await res).data as any[];
    if (data.length) {
      const literatureId = data[0].id;
      if (isDev) this.logger.info("已存在文献文档，id=>", {literatureId});
      // 保险起见更新一下字典
      this.plugin.literaturePool.set({id: literatureId, key});
      this._processExistedLiteratureNote(literatureId, key, entry);
      return;
    } else {
      //文件不存在就新建文件
      let noteTitle = generateFromTemplate(titleTemplate, entry);
      noteTitle = noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
      if (isDev) this.logger.info("生成文件标题 =>", noteTitle);
      const noteData = await this._createLiteratureNote(noteTitle);
      // 首先将文献的基本内容塞到用户文档的自定义属性中
      await this.plugin.kernelApi.setBlockKey(noteData.rootId, key);
      this.plugin.kernelApi.setBlockEntry(noteData.rootId, JSON.stringify(entry));
      // 新建文件之后也要更新对应字典
      this.plugin.literaturePool.set({id: noteData.rootId, key: key});
      this._insertNoteContent(noteData.rootId, noteData.userDataId, `(( ${noteData.userDataId} 'User Data'))`, entry, []);
      this.updateDataSourceItem(key, entry);
      return;
    }
  }

  private async _processExistedLiteratureNote(literatureId: string, key: string, entry: any) {
    // 文件存在就更新文件内容
    let deleteList = [];
    // 首先将文献的基本内容塞到用户文档的自定义属性中
    this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(entry));
    // 查找用户自定义片段
    let res = await this.plugin.kernelApi.getChidBlocks(literatureId);
    const dataIds = (res.data as any[]).map(data => {
      return data.id as string;
    });
    let userDataId = "";
    let userDataLink = "";
    if (dataIds.length) {
      // 查找第一个块的内容中是否包含用户自定义片段
      res = await this.plugin.kernelApi.getBlock(dataIds[0]);
      const dyMatch = (res.data[0].markdown as string).match(refRegDynamic);
      const stMatch = (res.data[0].markdown as string).match(refRegStatic);
      if (dyMatch && dyMatch.length && dyMatch[0] && dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2)) != -1) {
        // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
        const idx = dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2));
        userDataId = dataIds[idx];
        userDataLink = dyMatch[0];
        if (isDev) this.logger.info("匹配到用户片段动态锚文本链接 =>", {dyMatch: dyMatch, id: userDataId});
        // 删除所有需要更新的片段
        deleteList = dataIds.slice(0, idx);
      } else if (stMatch && stMatch.length && stMatch[0] && dataIds.indexOf(stMatch[0].split(" ")[0].slice(2)) != -1) {
        // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
        const idx = dataIds.indexOf(stMatch[0].split(" ")[0].slice(2));
        userDataId = dataIds[idx];
        userDataLink = stMatch[0];
        if (isDev) this.logger.info("匹配到用户片段静态锚文本链接 =>", {stMatch: stMatch, id: userDataId});
        // 删除所有需要更新的片段
        deleteList = dataIds.slice(0, idx);
      } else {
        if (isDev) this.logger.info("未匹配到用户片段链接 =>", {
          markdown: res.data[0].markdown,
          stMatch,
          dyMatch,
          totalIds: dataIds
        });
        // 执行后续操作之前先更新文献池
        this.plugin.literaturePool.set({id: literatureId, key: key});
        return confirm("⚠️", this.plugin.i18n.confirms.updateWithoutUserData.replaceAll("${title}", entry.title), async () => {
          // 不存在用户数据区域，整个更新
          deleteList = dataIds;
          userDataId = await this._updateEmptyNote(literatureId);
          if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
          this._insertNoteContent(literatureId, userDataId, userDataLink, entry, deleteList);
          this.updateDataSourceItem(key, entry);
          return;
        });
      }
    } else {
      if (isDev) this.logger.info("文献内容文档中没有内容");
      // 更新空的文档内容
      userDataId = await this._updateEmptyNote(literatureId);
    }
    // 执行后续操作之前先更新文献池
    this.plugin.literaturePool.set({id: literatureId, key: key});
    // 插入前置片段
    if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
    this._insertNoteContent(literatureId, userDataId, userDataLink, entry, deleteList);
    this.updateDataSourceItem(key, entry);
  }

  private async _createLiteratureNote(noteTitle: string): Promise<{rootId: string, userDataId: string}> {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const res = await this.plugin.kernelApi.createDocWithMd(notebookId, refPath + `/${noteTitle}`, "");
    const rootId = String(res.data);
    if (isDev) this.logger.info("创建文档，ID =>", rootId);
    const userDataId = await this._updateEmptyNote(rootId);
    return {
      rootId,
      userDataId
    };
  }

  private async _deleteBlocks(blockIds: string[]) {
    const p = blockIds.map(blockId => {
      return this.plugin.kernelApi.deleteBlock(blockId);
    });
    return Promise.all(p);
  }

  private async _insertNoteContent(literatureId: string, userDataId: string, userDataLink: string, entry: any, deleteList: string[]) {
    const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
    const note = entry.note;
    entry.note = entry.note.map(n => {
      return n.prefix + `\n\n{ {note${n.index}} }`;
      // return `${n.prefix}\n\n${n.content}`;
    }).join("\n\n");
    const literatureNote = generateFromTemplate(noteTemplate, entry);
    if (deleteList.length) await this._deleteBlocks(deleteList);
    this.plugin.kernelApi.prependBlock(literatureId, userDataLink + "\n\n" + literatureNote);
    note.forEach(n => {
      this.plugin.eventTrigger.addSQLIndexEvent({
        triggerFn: this._insertNotes.bind(this),
        params: {
          index: n.index,
          content: n.content,
          literatureId,
          userDataId
        },
        type: "once"
      });
    });
  }

  private async _insertNotes(params: {index: number, content: string, literatureId: string, userDataId: string}) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const index = params.index;
    const content = params.content;
    const literatureId = params.literatureId;
    const userDataId = params.userDataId;
    let res = await this.plugin.kernelApi.getChidBlocks(literatureId);
    const dataIds = (res.data as any[]).map(data => {
      return data.id as string;
    });
    res = await this.plugin.kernelApi.getBlocksWithContent(notebookId, literatureId, `{ {note${index}} }`);
    const data = res.data as any[];
    if (!data.length) {
      // 还没更新出来就重新塞回队列
      if (isDev) this.logger.info("文档尚未更新到数据库，等下一次数据库更新，detail=>", { index, content, literatureId, userDataId });
      return this.plugin.eventTrigger.addSQLIndexEvent({
        triggerFn: this._insertNotes.bind(this),
        params: {
          index,
          content,
          literatureId,
          userDataId
        },
        type: "once"
      });
    }
    const pList = data.map(async d => {
      // 只有在userDataID之前的才会更新
      if (dataIds.indexOf(d.id) != -1 && dataIds.indexOf(d.id) < dataIds.indexOf(userDataId)) {
        await this.plugin.kernelApi.updateBlockContent(d.id, "dom", content);
      }
    });
    return await Promise.all(pList);
  }

  private async _updateEmptyNote(rootId: string): Promise<string> {
    await this.plugin.kernelApi.updateBlockContent(rootId, "markdown", "# User Data");
    const res = await this.plugin.kernelApi.getChidBlocks(rootId);
    const userDataId = res.data[0].id as string;
    if (isDev) this.logger.info("获取用户区域标题，ID =>", userDataId);
    return userDataId;
  }


  // Group: 更新数据源条目内容

  private async updateDataSourceItem(key: string, entry: any) {
    const fileID = this.plugin.literaturePool.get(key);
    const itemAttrs = {};
    // 获取反链标题
    const titleTemplate = this.plugin.data[STORAGE_NAME].zoteroLinkTitleTemplate as string;
    if (titleTemplate.length) {
      const backlinkURL = `siyuan://blocks/${fileID}`;
      const zoteroLinkTitle = generateFromTemplate(titleTemplate, {
        siyuanLink: backlinkURL,
        citeFileID: fileID,
        ...entry
      });
      itemAttrs["backlink"] = {
        title: zoteroLinkTitle,
        url: backlinkURL
      };
    }

    // 获取标签
    const tagTemplate = this.plugin.data[STORAGE_NAME].zoteroTagTemplate as string;
    if (tagTemplate.length) {
      const zoteroTags = generateFromTemplate(tagTemplate, {
        citeFileID: fileID,
        ...entry
      });
      itemAttrs["tags"] = zoteroTags;
    }

    if (isDev) this.logger.info("获取更新数据源数据, attrs=>", itemAttrs);

    if (Object.keys(itemAttrs).length) this.plugin.database.updateDataSourceItem(key, itemAttrs);
    else if (isDev) this.logger.info("没有数据源数据需要更新");
  }


  // Group: 获取当前文档内容

  private async getLiteratureEnum(fileId: string): Promise<string[]> {
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


  // Group: 引用链接相关

  private async _generateCiteLink(key: string, index: number, onlyLink: boolean) {
    const linkTemplate = this.plugin.data[STORAGE_NAME].linkTemplate as string;
    const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink as boolean;
    let template = "";
    if (onlyLink) {
      const linkReg = useDynamicRefLink ? refRegDynamic : refRegStatic;
      const matchRes = linkTemplate.matchAll(linkReg);
      let modifiedTemplate = "";
      for (const match of matchRes) {
        if (match[1].indexOf("{{citeFileID}}") != -1) {
          modifiedTemplate = match[2];
        }
      }
      if (isDev) this.logger.info("仅包含链接的模板 =>", modifiedTemplate);
      template = modifiedTemplate;
    } else {
      template = linkTemplate;
    }
    const entry = await this.plugin.database.getContentByKey(key);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    if (isDev) this.logger.info("仅包含链接的模板 =>", {index, id: this.plugin.literaturePool.get(key)});
    return generateFromTemplate(template, {
      index,
      citeFileID: this.plugin.literaturePool.get(key),
      ...entry
    });
  }

  private async _generateLiteratureName(key: string) {
    const nameTemplate = this.plugin.data[STORAGE_NAME].nameTemplate;
    const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
    const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
    // 如果本身不同时使用自定义链接和动态链接，就不需要生成文档的命名
    if (!(customCiteText && useDynamicRefLink)) return "";
    const entry = await this.plugin.database.getContentByKey(key);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    return generateFromTemplate(nameTemplate, {
      citeFileID: this.plugin.literaturePool.get(key),
      ...entry
    });
  }

  private async _generateCiteRef(citeFileId: string, link: string, name: string) {
    const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
    const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
    if (customCiteText) {
      if (useDynamicRefLink) await this.plugin.kernelApi.setNameOfBlock(citeFileId, name);
      return link;
    } else if (useDynamicRefLink) {
      await this.plugin.kernelApi.setNameOfBlock(citeFileId, link);
      return citeLinkDynamic.replace("${id}", citeFileId);
    } else {
      return citeLinkStatic.replace("${id}", citeFileId).replace("${link}", link);
    }
  }
}