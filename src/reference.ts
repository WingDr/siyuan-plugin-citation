import { confirm } from "siyuan";
import SiYuanPluginCitation from "./index";
import { type SiyuanData } from "./api/base-api";
import {
  STORAGE_NAME, isDev, citeLink, 
  DISALLOWED_FILENAME_CHARACTERS_RE, 
  refReg, refRegStatic, refRegDynamic
} from "./utils/constants";
import {
  generateFromTemplate
} from "./utils/templates";
import { type ILogger, createLogger } from "./utils/simple-logger";
import { loadLocalRef } from "./utils/util";


// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;

  constructor(plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.checkRefDirExist();
    this.logger = createLogger("reference");
  }

  public async updateLiteratureNote(key: string) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
    const entry = await this.plugin.database.getContentByKey(key);
    if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    const res = this.plugin.kernelApi.searchFileWithName(notebookId, refPath + "/", key);
    const data = (await res).data as any[];
    if (data.length) {
      const literatureId = data[0].id;
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
          return confirm("⚠️", this.plugin.i18n.confirms.updateWithoutUserData, async () => {
            // 不存在用户数据区域，整个更新
            deleteList = dataIds;
            userDataId = await this.updateEmptyNote(literatureId);
            if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
            this.insertNoteContent(literatureId, userDataId, userDataLink, entry, deleteList);
            return;
          });
        }
      } else {
        if (isDev) this.logger.info("文献内容文档中没有内容");
        // 更新空的文档内容
        userDataId = await this.updateEmptyNote(literatureId);
      }
      // 插入前置片段
      if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
      this.insertNoteContent(literatureId, userDataId, userDataLink, entry, deleteList);
      return;
    } else {
      //文件不存在就新建文件
      let noteTitle = generateFromTemplate(titleTemplate, entry);
      noteTitle = noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
      if (isDev) this.logger.info("生成文件标题 =>", noteTitle);
      const noteData = await this.createLiteratureNote(noteTitle);
      // 首先将文献的基本内容塞到用户文档的自定义属性中
      await this.plugin.kernelApi.setNameOfBlock(noteData.rootId, key);
      this.plugin.kernelApi.setBlockEntry(noteData.rootId, JSON.stringify(entry));
      // 新建文件之后也要更新对应字典
      this.plugin.key2idDict[key] = noteData.rootId;
      this.plugin.id2keyDict[noteData.rootId] = key;
      this.insertNoteContent(noteData.rootId, noteData.userDataId, `(( ${noteData.userDataId} 'User Data'))`, entry, []);
      return;
    }
  }

  private async createLiteratureNote(noteTitle: string): Promise<{rootId: string, userDataId: string}> {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const res = await this.plugin.kernelApi.createDocWithMd(notebookId, refPath + `/${noteTitle}`, "");
    const rootId = String(res.data);
    if (isDev) this.logger.info("创建文档，ID =>", rootId);
    const userDataId = await this.updateEmptyNote(rootId);
    return {
      rootId,
      userDataId
    };
  }

  private async deleteBlocks(blockIds: string[]) {
    const p = blockIds.map(blockId => {
      return this.plugin.kernelApi.deleteBlock(blockId);
    });
    return Promise.all(p);
  }

  private async insertNoteContent(literatureId: string, userDataId: string, userDataLink: string, entry: any, deleteList: string[]) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
    const note = entry.note;
    entry.note = entry.note.map(n => {
      // return n.prefix + `\n\n{ {note${n.index}} }`;
      return `${n.prefix}\n\n${n.content}`;
    }).join("\n\n");
    const literatureNote = generateFromTemplate(noteTemplate, entry);
    if (deleteList.length) await this.deleteBlocks(deleteList);
    await this.plugin.kernelApi.prependBlock(literatureId, userDataLink + "\n\n" + literatureNote);
    // const res = await this.plugin.kernelApi.getChidBlocks(literatureId);
    // const dataIds = (res.data as any[]).map(data => {
    //   return data.id as string;
    // });
    // setTimeout(async () => {
    //   const pList = note.map(async n => {
    //     const res = this.plugin.kernelApi.getBlocksWithContent(notebookId, literatureId, `{ {note${n.index}} }`);
    //     const data = (await res).data as any[];
    //     const pList = data.map(async d => {
    //       // 只有在userDataID之前的才会更新
    //       if (dataIds.indexOf(d.id) != -1 && dataIds.indexOf(d.id) < dataIds.indexOf(userDataId)) {
    //         await this.plugin.kernelApi.updateBlockContent(d.id, "dom", n.content);
    //       }
    //     });
    //     await Promise.all(pList);
    //   });
    //   return await Promise.all(pList);
    // }, 3000);
  }

  private async updateEmptyNote(rootId: string): Promise<string> {
    await this.plugin.kernelApi.updateBlockContent(rootId, "markdown", "# User Data");
    const res = await this.plugin.kernelApi.getChidBlocks(rootId);
    const userDataId = res.data[0].id as string;
    if (isDev) this.logger.info("获取用户区域标题，ID =>", userDataId);
    return userDataId;
  }

  public async updateLiteratureLink(fileId: string): Promise<SiyuanData[]> {
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
          const link = await this.generateCiteLink(this.plugin.id2keyDict[key], idx, this.plugin.data[STORAGE_NAME].customCiteText);
          if (isDev) this.logger.info("更新文献引用 =>", link);
          if (!link) continue;
          if (anchor != `"${link}"`) {
            isModified = true;
          }
          replaceList[key] = citeLink.replace("${id}", key).replace("${link}", link);
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

  public async getLiteratureEnum(fileId: string): Promise<string[]> {
    // 获得该文件的全部kramdown内容，用于引用排序
    const res = await this.plugin.kernelApi.getBlockContent(fileId);
    const data = res.data as any;
    const fileContent = data.kramdown as string;
    // 获取所有可以引用的citekey，用于筛选在文件中的引用
    const citekeys = this.plugin.database.getTotalKeys();
    return citekeys.map(key => {
      return {
        citekey: key as string,
        idx: fileContent.indexOf(this.plugin.key2idDict[key]) as number,
      };
    })
    .filter(key => key.idx != -1)
    .sort((a,b) => a.idx - b.idx)
    .map(item => {
      return this.plugin.key2idDict[item.citekey];
    });

  }

  public async generateCiteLink(key: string, index: number, onlyLink: boolean) {
    const linkTemplate = this.plugin.data[STORAGE_NAME].linkTemplate as string;
    let template = "";
    if (onlyLink) {
      const linkReg = refRegStatic;
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
    return generateFromTemplate(template, {
      index,
      citeFileID: this.plugin.key2idDict[key],
      ...entry
    });
  }

  public generateCiteRef(citeFileId: string, link: string) {
    if (this.plugin.data[STORAGE_NAME].customCiteText) {
      return link;
    } else {
      return citeLink.replace("${id}", citeFileId).replace("${link}", link);
    }
  }

  public async refreshLiteratureNoteTitles() {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
    const dType = this.plugin.data[STORAGE_NAME].database as string;
    let enableNameRefresh = false;
    if (dType == "Zotero (debug-bridge)" || dType == "Juris-M (debug-bridge)") enableNameRefresh = true;
    if (isDev) this.logger.info("是否需要刷新命名 =>", {database: dType, enableNameRefresh});
    const pList = Object.keys(this.plugin.key2idDict).map(async key => {
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
      const res = await this.plugin.kernelApi.getBlock(this.plugin.key2idDict[key]);
      const title = res.data[0].content;
      if (noteTitle != title) await this.plugin.kernelApi.renameDoc(notebookId, res.data[0].path , noteTitle);
      if (enableNameRefresh) {
        if (res.data[0].name != entry.key) {
          if (isDev) this.logger.info("给文档刷新命名，detail=>", {id: this.plugin.key2idDict[key], name: entry.key});
          await this.plugin.kernelApi.setNameOfBlock(this.plugin.key2idDict[key], entry.key);
        }
      } 
    });
    await Promise.all(pList);
    if (isDev) this.logger.info("所有文件标题已更新");
    this.plugin.noticer.info(this.plugin.i18n.notices.refreshTitleSuccess.replace("${size}", Object.keys(this.plugin.key2idDict).length));
    await loadLocalRef(this.plugin);
    return this.plugin.id2keyDict, this.plugin.key2idDict;
  }

  public async insertContent(protyle, content: string) {
    const blockId = protyle.protyle.breadcrumb.id;
    const rootId = protyle.protyle.block.rootID;
    if (isDev) this.logger.info("Protyle块ID =>", blockId);
    if (isDev) this.logger.info("Protyle文档ID =>", rootId);
    await protyle.insert(content, false, true);
    // TODO 等待前后端联动API更新再更新文档标号
    // if (isDev) this.getCursorOffsetInBlock(blockId);
    // await this.plugin.kernelApi.setBlockCited(blockId, true);
    // await this.plugin.reference.updateLiteratureLink(rootId);
  }

  public async copyContent(content: string) {
    navigator.clipboard.writeText(content);
    this.plugin.noticer.info(this.plugin.i18n.notices.copyCiteLinkSuccess);
  }
}