import { confirm } from "siyuan";
import SiYuanPluginCitation from "./index";
import { SiyuanData } from "./api/base-api";
import {
  STORAGE_NAME, isDev, citeLink, 
  DISALLOWED_FILENAME_CHARACTERS_RE, 
  refReg, refRegStatic, refRegDynamic
} from "./utils/constants";
import {
  generateFromTemplate
} from "./utils/templates";
import { ILogger, createLogger } from "./utils/simple-logger";


// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;

  constructor(plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.checkRefDirExist();
    this.logger = createLogger("reference");
  }

  public async updateLiteratureNote(citekey: string) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
    const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
    const entry = await this.plugin.database.getContentByCitekey(citekey);
    if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    const res = this.plugin.kernelApi.searchFileWithName(notebookId, refPath + "/", citekey);
    const data = (await res).data as any[];
    const noteTitle = generateFromTemplate(titleTemplate, entry);
    noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
    const literatureNote = generateFromTemplate(noteTemplate, entry);
    if (data.length) {
      const literatureId = data[0].id;
      // 文件存在就更新文件内容
      // 查找用户自定义片段F
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
          await this.deleteBlocks(dataIds.slice(0, idx));
        } else if (stMatch && stMatch.length && stMatch[0] && dataIds.indexOf(stMatch[0].split(" ")[0].slice(2)) != -1) {
          // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
          const idx = dataIds.indexOf(stMatch[0].split(" ")[0].slice(2));
          userDataId = dataIds[idx];
          userDataLink = stMatch[0];
          if (isDev) this.logger.info("匹配到用户片段静态锚文本链接 =>", {stMatch: stMatch, id: userDataId});
          // 删除所有需要更新的片段
          await this.deleteBlocks(dataIds.slice(0, idx));
        } else {
          if (isDev) this.logger.info("未匹配到用户片段链接 =>", {
            markdown: res.data[0].markdown,
            stMatch,
            dyMatch,
            totalIds: dataIds
          });
          return confirm("⚠️", this.plugin.i18n.confirms.updateWithoutUserData, async () => {
            // 不存在用户数据区域，整个更新
            await this.deleteBlocks(dataIds);
            userDataId = await this.updateEmptyNote(literatureId);
            if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
            return this.plugin.kernelApi.prependBlock(literatureId, userDataLink + "\n\n" + literatureNote);
          });
        }
      } else {
        if (isDev) this.logger.info("文献内容文档中没有内容");
        // 更新空的文档内容
        userDataId = await this.updateEmptyNote(literatureId);
      }
      // 插入前置片段
      if (!userDataLink.length) userDataLink = `((${userDataId} 'User Data'))`;
      this.plugin.kernelApi.prependBlock(literatureId, userDataLink + "\n\n" + literatureNote);
      return;
    } else {
      //文件不存在就新建文件
      const noteData = await this.createLiteratureNote(noteTitle);
      await this.plugin.kernelApi.setNameOfBlock(noteData.rootId, citekey);
      // 新建文件之后也要更新对应字典
      this.plugin.ck2idDict[citekey] = noteData.rootId;
      this.plugin.id2ckDict[noteData.rootId] = citekey;
      this.plugin.kernelApi.prependBlock(noteData.rootId, `(( ${noteData.userDataId} 'User Data'))\n\n` + literatureNote);
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

  private async updateEmptyNote(rootId: string): Promise<string> {
    await this.plugin.kernelApi.updateBlockContent(rootId, "# User Data");
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
          let link = "";
          if (this.plugin.data[STORAGE_NAME].customCiteText) {
            link = await this.generateOnlyCiteLink(this.plugin.id2ckDict[key], idx);
          } else {
            link = await this.generateCiteLink(this.plugin.id2ckDict[key], idx);
          }
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
    const citekeys = this.plugin.database.getTotalCitekeys();
    return citekeys.map(key => {
      return {
        citekey: key as string,
        idx: fileContent.indexOf(this.plugin.ck2idDict[key]) as number,
      };
    })
    .filter(key => key.idx != -1)
    .sort((a,b) => a.idx - b.idx)
    .map(item => {
      return this.plugin.ck2idDict[item.citekey];
    });

  }

  public async generateCiteLink(citekey: string, index: number) {
    const linkTemplate = this.plugin.data[STORAGE_NAME].linkTemplate as string;
    const entry = await this.plugin.database.getContentByCitekey(citekey);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    return generateFromTemplate(linkTemplate, {
      index,
      citeFileID: this.plugin.ck2idDict[citekey],
      ...entry
    });
  }

  public async generateOnlyCiteLink(citekey: string, index: number) {
    const linkTemplate = this.plugin.data[STORAGE_NAME].linkTemplate as string;
    const linkReg = refRegStatic;
    const matchRes = linkTemplate.matchAll(linkReg);
    let modifiedTemplate = "";
    for (const match of matchRes) {
      if (match[1].indexOf("{{citeFileID}}") != -1) {
        modifiedTemplate = match[2];
      }
    }
    if (isDev) this.logger.info("仅包含链接的模板 =>", modifiedTemplate);
    const entry = await this.plugin.database.getContentByCitekey(citekey);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
      return null;
    }
    return generateFromTemplate(modifiedTemplate, {
      index,
      citeFileID: this.plugin.ck2idDict[citekey],
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
    Object.keys(this.plugin.ck2idDict).forEach(async citekey => {
      const entry = await this.plugin.database.getContentByCitekey(citekey);
      if (isDev) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry) {
        if (isDev) this.logger.error("找不到文献数据");
        this.plugin.noticer.error(this.plugin.i18n.errors.getLiteratureFailed);
        return null;
      }
      const noteTitle = generateFromTemplate(titleTemplate, entry);
      noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
      // 不对的时候才更新
      const res = await this.plugin.kernelApi.getBlock(this.plugin.ck2idDict[citekey]);
      const title = res.data[0].content;
      if (noteTitle != title) await this.plugin.kernelApi.renameDoc(notebookId, res.data[0].path , noteTitle);
    });
    if (isDev) this.logger.info("所有文件标题已更新");
    this.plugin.noticer.info(this.plugin.i18n.refreshTitleSuccess.replace("${size}", Object.keys(this.plugin.ck2idDict).length));
    return this.plugin.id2ckDict, this.plugin.ck2idDict;
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
    this.plugin.noticer.info(this.plugin.i18n.copyCiteLinkSuccess);
  }
}