import { 
    DISALLOWED_FILENAME_CHARACTERS_RE, 
    STORAGE_NAME, 
    isDev, 
    refRegDynamic, 
    refRegStatic, 
    workspaceDir
} from "../utils/constants";
import SiYuanPluginCitation from "../index";
import { type ILogger, createLogger } from "../utils/simple-logger";
import { generateFromTemplate } from "../utils/templates";
import { cleanEmptyKey } from "../utils/util";
import { confirm, getFrontend } from "siyuan";
import { NoteProcessor } from "./noteProcessor";

export class LiteratureNote {
    plugin: SiYuanPluginCitation;
    private logger: ILogger;

    constructor(plugin: SiYuanPluginCitation) {
        this.plugin = plugin;
        this.logger = createLogger("literature-note");
    }

    public async updateLiteratureNote(key: string, entry: any, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
      const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
      const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
      const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      const useItemKey = this.plugin.data[STORAGE_NAME].useItemKey as boolean;
      const res = this.plugin.kernelApi.searchFileWithKey(notebookId, refPath + "/", key);
      const data = (await res).data as any[];
      if (data.length) {
        const literatureId = data[0].id;
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("已存在文献文档，id=>", {literatureId});
        // 保险起见更新一下字典
        this.plugin.literaturePool.set({id: literatureId, key});
        await this._processExistedLiteratureNote(literatureId, key, entry, noConfirmUserData);
        // 最后更新一下key的形式
        const new_key = "1_" + (useItemKey ? entry.itemKey : entry.citekey);
        await this.plugin.kernelApi.setBlockKey(literatureId, new_key);
        this.plugin.literaturePool.set({id: literatureId, key:new_key});
        this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
        return;
      } else {
        //文件不存在就新建文件
        let noteTitle = generateFromTemplate(titleTemplate, entry);
        noteTitle = noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("生成文件标题 =>", noteTitle);
        // const noteData = await this._createLiteratureNote(noteTitle);
        // 创建新文档
        const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
        const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
        const res = await this.plugin.kernelApi.createDocWithMd(notebookId, refPath + `/${noteTitle}`, "");
        const rootId = String(res.data);
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("创建文档，ID =>", rootId);
        const userDataId = await this._updateEmptyNote(rootId);
        const noteData = { rootId, userDataId };
        // 将文献的基本内容塞到用户文档的自定义属性中
        await this.plugin.kernelApi.setBlockKey(noteData.rootId, key);
        this.plugin.kernelApi.setBlockEntry(noteData.rootId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
        // 新建文件之后也要更新对应字典
        this.plugin.literaturePool.set({id: noteData.rootId, key: key});
        this._updateDataSourceItem(key, entry);
        this._updateAttrView(key, entry);
        // 对文档本身进行更新
        this._updateComplexContents(noteData.rootId, noteData.userDataId, `[${userDataTitle}](siyuan://blocks/${noteData.userDataId})\n\n`, entry, []);
        return;
      }
    }

    public async moveImgToAssets(imgPath: string, detail: any, linkType: "html" | "markdown" = "markdown"): Promise<string> {
      const time = detail.dateAdded.replace(/[-:\s]/g, "");
      // 用于欺骗思源的随机（伪）字符串，是7位的小写字母和数字（itemKey是8位）
      const randomStr = (detail.key as string).toLowerCase().slice(1);
      const name = `zotero-annotations-${detail.annotationType}-${detail.parentKey}-${detail.key}-${time}-${randomStr}`;
      const assetPath = `assets/${name}.png`;
      const assetAbsPath = "/data/" + assetPath;
      if (!(await this.plugin.kernelApi.getFile(assetAbsPath, "any"))) {
          // 如果文件不存在（同时会检验添加时间、父条目key和annotation自己的key，基本可以确定不存在了）
          await this.plugin.kernelApi.globalCopyFiles([imgPath], "/data/assets");
          const originFilename = imgPath.split("\\").slice(-1)[0];
          await this.plugin.kernelApi.renameFile(`/data/assets/${originFilename}`, assetAbsPath);
          if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("移动批注图片到工作空间, info=>", {imgPath, assetAbsPath});
      } 
      // 添加width属性避免图片太大
      if (linkType == "html") return `<img src="${assetPath}" data-src="${assetPath}" style="width:100%" alt="img">`;
      return `![img](${assetPath})`;
    }

    private async _updateDataSourceItem(key: string, entry: any) {
      const fileID = this.plugin.literaturePool.get(key);
      const itemAttrs:Record<string, any> = {};
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
  
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取更新数据源数据, attrs=>", itemAttrs);
  
      if (Object.keys(itemAttrs).length) this.plugin.database.updateDataSourceItem(key, itemAttrs);
      else if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("没有数据源数据需要更新");
    }

    private async _updateAttrView(key: string, entry: any) {
      const attrViewBlock = this.plugin.data[STORAGE_NAME].attrViewBlock;
      const attrViewTemplate = this.plugin.data[STORAGE_NAME].attrViewTemplate;
      const blockID = this.plugin.literaturePool.get(key);
      let res = await this.plugin.kernelApi.getBlock(attrViewBlock);
      const content = (res.data as any[])[0].markdown as string;
      const avIdReg = /.*data-av-id=\"(.*?)\".*/;
      const avID = content.match(avIdReg)![1];
      // 检查块是否在数据库中
      res = await this.plugin.kernelApi.getAttributeViewKeys(blockID);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到块添加的数据库", res.data);
      const findItem = (res.data as any[]).find(item => item.avID === avID);
      if (!findItem || !findItem.keyValues) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("数据库中不存在块，将块插入数据库", {avID, blockID});
        res = await this.plugin.kernelApi.addAttributeViewBlocks(avID, [{
          id: blockID,
          isDetached: false
        }]);
      }
      const dataString = generateFromTemplate(attrViewTemplate, entry);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("根据模板生成属性=>", {dataString});
      const data = JSON.parse(dataString);
      for (const item of data) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("插入数据库属性", item);
        res = await this.plugin.kernelApi.setAttributeViewBlockAttr(avID, item.keyID, blockID, item.value)
      }
    }

    private async _processExistedLiteratureNote(literatureId: string, key: string, entry: any, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
      // 文件存在就更新文件内容
      let deleteList: string[] = [];
      // 首先将文献的基本内容塞到用户文档的自定义属性中
      this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
      // 查找用户自定义片段
      const res = await this.plugin.kernelApi.getChidBlocks(literatureId);
      const dataIds = (res.data as any[]).map(data => {
        return data.id as string;
      });
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      let userDataId = "";
      let userDataLink = "";
      if (dataIds.length) {
        // 查找用户数据片段
        const userDataInfo = await this._detectUserData(literatureId, dataIds, key, userDataTitle);
        deleteList = userDataInfo.deleteList;
        userDataId = userDataInfo.userDataId;
        userDataLink = userDataInfo.userDataLink;
        const hasUserData = userDataInfo.hasUserData;
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获得用户片段更新信息=>", userDataInfo);
        if (!hasUserData) {
          // 没有查找到用户数据片段时进行更新
          if (!noConfirmUserData) return confirm("⚠️", (this.plugin.i18n.confirms as any).updateWithoutUserData.replaceAll("${title}", entry.title), async () => {
            this._updateDataSourceItem(key, entry);
            this._updateAttrView(key, entry);
            // 不存在用户数据区域，整个更新
            deleteList = dataIds;
            userDataId = await this._updateEmptyNote(literatureId);
            // if (!userDataLink.length) userDataLink = `((${userDataId} '${userDataTitle}'))\n\n`;
            userDataLink = `[${userDataTitle}](siyuan://blocks/${userDataId})\n\n`;
            this._updateComplexContents(literatureId, userDataId, userDataLink, entry, deleteList);
            return;
          });
          else {
            this._updateDataSourceItem(key, entry);
            this._updateAttrView(key, entry);
            deleteList = dataIds;
            userDataId = await this._updateEmptyNote(literatureId);
          }
        }
      } else {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文献内容文档中没有内容");
        // 更新空的文档内容
        userDataId = await this._updateEmptyNote(literatureId);
      }
      // 执行后续操作之前先更新文献池
      this.plugin.literaturePool.set({id: literatureId, key: key});
      // 插入前置片段
      // if (!userDataLink.length) userDataLink = `((${userDataId} '${userDataTitle}'))\n\n`;
      userDataLink = `[${userDataTitle}](siyuan://blocks/${userDataId})\n\n`;
      this._updateComplexContents(literatureId, userDataId, userDataLink, entry, deleteList);
      this._updateDataSourceItem(key, entry);
      this._updateAttrView(key, entry);
    }

    private async _detectUserData( literatureId: string, dataIds: string[], key: string, userDataTitle: string ): Promise<{
      deleteList: string[], userDataId: string, userDataLink: string, hasUserData: boolean
    }> {
      const useWholeDocAsUserData = this.plugin.data[STORAGE_NAME].useWholeDocAsUserData as boolean;
      let userDataId = "";
      let userDataLink = "";
      // 首先判断是否有新式的用户数据情况
      let res = await this.plugin.kernelApi.getLiteratureUserData(literatureId);
      if (res.data && (res.data as any[]).length) {
        if ((res.data as any[])[0].block_id != literatureId ) {
          // 说明用户数据片段在文档里，并且设置和情况对的上，照常更新
          if (!useWholeDocAsUserData) return {
            deleteList: dataIds.slice(0, dataIds.indexOf((res.data as any[])[0].block_id)),
            userDataId: (res.data as any[])[0].block_id as string,
            userDataLink: "",
            hasUserData: true
          };
          else {
            // 说明用户数据在文档里，但是想要转换到新的情况，主要是把deleteList扩充，然后给文档附上属性
            await this.plugin.kernelApi.setBlockAttr(literatureId, {"custom-literature-block-type": "user data"});
            return {
              deleteList: dataIds.slice(0, dataIds.indexOf((res.data as any[])[0].block_id)+1),
              userDataId: literatureId,
              userDataLink: "",
              hasUserData: true
            };
          }
        } else {
          // 说明用户数据片段就是文档，而且情况对的上，就完全不更新就行
          if (useWholeDocAsUserData) return {
            deleteList: [], userDataId: literatureId, userDataLink: "", hasUserData: true
          };
          else {
            // 说明用户数据就是文档，但是想转换成传统情况
            await this.plugin.kernelApi.setBlockAttr(literatureId, {"custom-literature-block-type": ""}); // 将文档的属性值复位
            res = await this.plugin.kernelApi.prependBlock(literatureId, "markdown", `# ${userDataTitle}\n{: custom-literature-block-type="user data"}`);
            return {
              deleteList: [],
              userDataId: (res.data as any[])[0].doOperations[0].id,
              userDataLink: "",
              hasUserData: true
            }
          }
        }
        
      }
      // 否则根据旧版规则查找第一个块的内容中是否包含用户自定义片段
      res = await this.plugin.kernelApi.getBlock(dataIds[0]);
      const dyMatch = ((res.data as any[])[0].markdown as string).match(refRegDynamic);
      const stMatch = ((res.data as any[])[0].markdown as string).match(refRegStatic);
      if (dyMatch && dyMatch.length && dyMatch[0] && dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2)) != -1) {
        // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
        const idx = dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2));
        userDataId = dataIds[idx];
        userDataLink = dyMatch[0];
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("匹配到用户片段动态锚文本链接 =>", {dyMatch: dyMatch, id: userDataId});
        // 更新为新形式的user data判断
        await this.plugin.kernelApi.setBlockAttr(userDataId, {"custom-literature-block-type": "user data"});
        // 删除所有需要更新的片段 
        return {
          deleteList: dataIds.slice(0, idx),
          userDataId,
          userDataLink,
          hasUserData: true
        };
      } else if (stMatch && stMatch.length && stMatch[0] && dataIds.indexOf(stMatch[0].split(" ")[0].slice(2)) != -1) {
        // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
        const idx = dataIds.indexOf(stMatch[0].split(" ")[0].slice(2));
        userDataId = dataIds[idx];
        userDataLink = stMatch[0];
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("匹配到用户片段静态锚文本链接 =>", {stMatch: stMatch, id: userDataId});
        // 更新为新形式的user data判断
        await this.plugin.kernelApi.setBlockAttr(userDataId, {"custom-literature-block-type": "user data"});
        // 删除所有需要更新的片段
        return {
          deleteList: dataIds.slice(0, idx),
          userDataId,
          userDataLink,
          hasUserData: true
        };
      } else {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("未匹配到用户片段链接 =>", {
          markdown: (res.data as any[])[0].markdown, stMatch, dyMatch, totalIds: dataIds
        });
        // 执行后续操作之前先更新文献池
        this.plugin.literaturePool.set({id: literatureId, key: key});
        return {
          deleteList: dataIds,
          userDataId: "",
          userDataLink: "",
          hasUserData: false
        };
      }
    }
    
    private async _deleteBlocks(blockIds: string[]) {
      const p = blockIds.map(blockId => {
        return this.plugin.kernelApi.deleteBlock(blockId);
      });
      return Promise.all(p);
    }
  
    private async _updateComplexContents(literatureId: string, userDataId: string, userDataLink: string, entry: any, deleteList: string[]) {
      // 通用操作，先把需要删掉的都删掉
      if (deleteList.length) await this.plugin.networkManager.sendNetworkMission([deleteList], this._deleteBlocks.bind(this));
      // 首先判断是否将整个文档用作用户数据，即literatureId和userDataId相同
      if (userDataId == literatureId) return;
      const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
      const note = entry.note;
      entry.note = entry.note?.map((n: { prefix: string; index: any; }) => {
        return n.prefix + `\n\n{ {note${n.index}} }`;
        // return `${n.prefix}\n\n${n.content}`;
      }).join("\n\n");
      // const annotations = entry.annotations;
      // 和 literature note 一起更新，而不是单独更新，减少更新时间
      const annoPList = entry.annotations.map( async (anno: { content: any[]; title: string; }) => {
        const filePList = anno.content.map(async (content: any) => {
          // return `{ {annotation-${anno.index}-${content.index}} }`;
          return await this._generateSingleAnnotation(content);
        });
        return anno.title + await Promise.all(filePList).then(res => res.join("\n\n"));
      });
      entry.annotations = await Promise.all(annoPList).then(res => res.join("\n\n"));
      const literatureNote = generateFromTemplate(noteTemplate, entry);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("向literature note发起插入请求, content=>", {literatureNote});
      this.plugin.kernelApi.prependBlock(literatureId, "markdown", userDataLink + literatureNote);
      note.forEach( async (n: { content: string; index: any; }) => {
        const processor = new NoteProcessor(this.plugin);
        n.content = await processor.processNote(n.content as string);
        this.plugin.eventTrigger.addSQLIndexEvent({
          triggerFn: this._insertNotes.bind(this),
          params: {
            index: n.index,
            content: n.content,
            literatureId,
            userDataId,
            callbackTimes: 0
          } as Record<string, any>,
          type: "once"
        });
      });
    }
    
    private async _insertNotes(params: {index: number, content: string, literatureId: string, userDataId: string, callbackTimes: number}) {
      const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
      const index = params.index;
      const content = params.content;
      const literatureId = params.literatureId;
      const userDataId = params.userDataId;
      const callbackTimes = params.callbackTimes;
      let res = await this.plugin.kernelApi.getChidBlocks(literatureId);
      const dataIds = (res.data as any[]).map(data => {
        return data.id as string;
      });
      res = await this.plugin.kernelApi.getBlocksWithContent(notebookId, literatureId, `{ {note${index}} }`);
      const data = res.data as any[];
      if (!data.length) {
        if (callbackTimes >= 1) {
          if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("更新次数到极限，本次暂停更新, detail=>", { index, content, literatureId, userDataId, callbackTimes});
          return;
        }
        // 还没更新出来就重新塞回队列
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文档尚未更新到数据库，等下一次数据库更新，detail=>", { index, content, literatureId, userDataId, callbackTimes });
        return this.plugin.eventTrigger.addSQLIndexEvent({
          triggerFn: this._insertNotes.bind(this),
          params: {
            index,
            content,
            literatureId,
            userDataId,
            callbackTimes: callbackTimes + 0.05
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
    
    private async _generateSingleAnnotation(content: any) {
      const detail = content.detail;
      const type = detail.annotationType;
      let quoteContent = `${type} on page ${detail.annotationPageLabel}`;
      switch (type) {
        case "image": {
          if (!["browser-desktop", "browser-mobile", "mobile"].includes(getFrontend())) {
            if (this.plugin.data[STORAGE_NAME].moveImgToAssets) {
              // 如果开启了移动图片到assets目录，则移动图片
              quoteContent = await this.moveImgToAssets(detail.imagePath, detail);
            } else {
              quoteContent = `Image`;
            }
          }
          break;
        }
        case "highlight": {
          if (detail.annotationText) quoteContent = `<span data-type="text" style="outline-color: ${detail.annotationColor};outline-style:solid;outline-width:0.1em">${detail.annotationText.replace(/\n+/g, "\n")}</span>`;
          else quoteContent = `<span data-type="text" style="outline-color: ${detail.annotationColor};outline-style:solid;outline-width:0.1em">" "</span>`;
          break;
        }
        case "underline": {
          quoteContent = `<span data-type="text" style="text-decoration: underline solid 0.2em ${detail.annotationColor} ">${detail.annotationText.replace(/\n+/g, "\n")}</span>`;
          break;
        }
        case "ink": {
          if (!["browser-desktop", "browser-mobile", "mobile"].includes(getFrontend())) {
            if (this.plugin.data[STORAGE_NAME].moveImgToAssets) {
              // 如果开启了移动图片到assets目录，则移动图片
              quoteContent = await this.moveImgToAssets(detail.imagePath, detail);
            } else {
              quoteContent = `Image`;
            }
          }
          break;
        }
      }
      // return `{{{row\n> ${quoteContent}\n[Open on Zotero](${content.openURI})\n\n${content.detail.annotationComment ? content.detail.annotationComment : ""}\n}}}`;
      return `{{{row\n> ${quoteContent}\n[Open on Zotero](${content.openURI})\n\n${content.detail.annotationComment ? content.detail.annotationComment : ""}\n}}}\n{: custom-annotation-color="${content.detail.annotationColor}" style="border:dashed 0.2em ${content.detail.annotationColor}" }`;
    }
    
    private async _updateEmptyNote(rootId: string): Promise<string> {
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      const useWholeDocAsUserData = this.plugin.data[STORAGE_NAME].useWholeDocAsUserData as boolean;
      const userDataTemplatePath = this.plugin.data[STORAGE_NAME].userDataTemplatePath as string;
      let userDataId = "";
      if (useWholeDocAsUserData) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("使用整个文档作为用户数据");
        // 对整个文档附加custom-literature-block-type属性
        await this.plugin.kernelApi.setBlockAttr(rootId, {
          "custom-literature-block-type": "user data"
        });
        userDataId = rootId;
      } else {
        await this.plugin.kernelApi.updateBlockContent(rootId, "markdown", `# ${userDataTitle}\n{: custom-literature-block-type="user data"}`);
        const res = await this.plugin.kernelApi.getChidBlocks(rootId);
        userDataId = (res.data as any[])[0].id as string;
      }
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取用户区域标题，ID =>", userDataId);
      if (userDataTemplatePath.length) {
        // 在用户数据中调用模板渲染
        const absTemplatePath = workspaceDir + userDataTemplatePath
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到模板绝对路径：" + absTemplatePath);
        try {
          const res = await this.plugin.kernelApi.renderTemplate(rootId, absTemplatePath);
          this.plugin.kernelApi.appendBlock(rootId, "dom", (res.data as any).content)
        } catch (error) {
          this.plugin.noticer.error((this.plugin.i18n as any).errors.userDataTemplatePathRenderError, error);
        }
      }
      return userDataId;
    }

}