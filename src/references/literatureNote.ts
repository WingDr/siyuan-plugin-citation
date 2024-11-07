import { 
    DISALLOWED_FILENAME_CHARACTERS_RE, 
    STORAGE_NAME, 
    isDev, 
    refRegDynamic, 
    refRegStatic 
} from "../utils/constants";
import SiYuanPluginCitation from "../index";
import { type ILogger, createLogger } from "../utils/simple-logger";
import { generateFromTemplate } from "../utils/templates";
import { cleanEmptyKey } from "../utils/util";
import { confirm, getFrontend } from "siyuan";

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
        if (isDev) this.logger.info("已存在文献文档，id=>", {literatureId});
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
        if (isDev) this.logger.info("生成文件标题 =>", noteTitle);
        const noteData = await this._createLiteratureNote(noteTitle);
        // 首先将文献的基本内容塞到用户文档的自定义属性中
        await this.plugin.kernelApi.setBlockKey(noteData.rootId, key);
        this.plugin.kernelApi.setBlockEntry(noteData.rootId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
        // 新建文件之后也要更新对应字典
        this.plugin.literaturePool.set({id: noteData.rootId, key: key});
        this._insertComplexContents(noteData.rootId, noteData.userDataId, `[${userDataTitle}](siyuan://blocks/${noteData.userDataId})\n\n`, entry, []);
        this.updateDataSourceItem(key, entry);
        return;
      }
    }

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

    private async _processExistedLiteratureNote(literatureId: string, key: string, entry: any, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
      // 文件存在就更新文件内容
      let deleteList = [];
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
        const userDataInfo = await this._detectUserData(literatureId, dataIds, key);
        deleteList = userDataInfo.deleteList;
        userDataId = userDataInfo.userDataId;
        userDataLink = userDataInfo.userDataLink;
        const hasUserData = userDataInfo.hasUserData;
        if (!hasUserData) {
          if (!noConfirmUserData) return confirm("⚠️", this.plugin.i18n.confirms.updateWithoutUserData.replaceAll("${title}", entry.title), async () => {
            // 不存在用户数据区域，整个更新
            deleteList = dataIds;
            userDataId = await this._updateEmptyNote(literatureId);
            // if (!userDataLink.length) userDataLink = `((${userDataId} '${userDataTitle}'))\n\n`;
            userDataLink = `[${userDataTitle}](siyuan://blocks/${userDataId})\n\n`;
            this._insertComplexContents(literatureId, userDataId, userDataLink, entry, deleteList);
            this.updateDataSourceItem(key, entry);
            return;
          });
          else {
            deleteList = dataIds;
            userDataId = await this._updateEmptyNote(literatureId);
          }
        }
      } else {
        if (isDev) this.logger.info("文献内容文档中没有内容");
        // 更新空的文档内容
        userDataId = await this._updateEmptyNote(literatureId);
      }
      // 执行后续操作之前先更新文献池
      this.plugin.literaturePool.set({id: literatureId, key: key});
      // 插入前置片段
      // if (!userDataLink.length) userDataLink = `((${userDataId} '${userDataTitle}'))\n\n`;
      userDataLink = `[${userDataTitle}](siyuan://blocks/${userDataId})\n\n`;
      this._insertComplexContents(literatureId, userDataId, userDataLink, entry, deleteList);
      this.updateDataSourceItem(key, entry);
    }

    private async _detectUserData( literatureId: string, dataIds: string[], key: string ): Promise<{
      deleteList: string[], userDataId: string, userDataLink: string, hasUserData: boolean
    }> {
      let userDataId = "";
      let userDataLink = "";
      // 首先判断是否有新式的用户数据情况
      let res = await this.plugin.kernelApi.getLiteratureUserData(literatureId);
      if ((res.data as string[]).length) return {
        deleteList: dataIds.slice(0, dataIds.indexOf(res.data[0].block_id)),
        userDataId: res.data[0].block_id as string,
        userDataLink: "",
        hasUserData: true
      };
      // 否则根据旧版规则查找第一个块的内容中是否包含用户自定义片段
      res = await this.plugin.kernelApi.getBlock(dataIds[0]);
      const dyMatch = (res.data[0].markdown as string).match(refRegDynamic);
      const stMatch = (res.data[0].markdown as string).match(refRegStatic);
      if (dyMatch && dyMatch.length && dyMatch[0] && dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2)) != -1) {
        // 如果能查找到链接，并且链接存在于文本中，则说明存在用户数据区域
        const idx = dataIds.indexOf(dyMatch[0].split(" ")[0].slice(2));
        userDataId = dataIds[idx];
        userDataLink = dyMatch[0];
        if (isDev) this.logger.info("匹配到用户片段动态锚文本链接 =>", {dyMatch: dyMatch, id: userDataId});
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
        if (isDev) this.logger.info("匹配到用户片段静态锚文本链接 =>", {stMatch: stMatch, id: userDataId});
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
        if (isDev) this.logger.info("未匹配到用户片段链接 =>", {
          markdown: res.data[0].markdown, stMatch, dyMatch, totalIds: dataIds
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
  
    private async _insertComplexContents(literatureId: string, userDataId: string, userDataLink: string, entry: any, deleteList: string[]) {
      const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
      const note = entry.note;
      entry.note = entry.note?.map(n => {
        return n.prefix + `\n\n{ {note${n.index}} }`;
        // return `${n.prefix}\n\n${n.content}`;
      }).join("\n\n");
      // const annotations = entry.annotations;
      // 和 literature note 一起更新，而不是单独更新，减少更新时间
      const annoPList = entry.annotations.map( async anno => {
        const filePList = anno.content.map(async content => {
          // return `{ {annotation-${anno.index}-${content.index}} }`;
          return await this._generateSingleAnnotation(content);
        });
        return anno.title + await Promise.all(filePList).then(res => res.join("\n\n"));
      });
      entry.annotations = await Promise.all(annoPList).then(res => res.join("\n\n"));
      const literatureNote = generateFromTemplate(noteTemplate, entry);
      if (deleteList.length) await this.plugin.networkManager.sendNetworkMission([deleteList], this._deleteBlocks.bind(this));
      if (isDev) this.logger.info("向literature note发起插入请求, content=>", {literatureNote});
      this.plugin.kernelApi.prependBlock(literatureId, userDataLink + literatureNote);
      note.forEach(n => {
        this.plugin.eventTrigger.addSQLIndexEvent({
          triggerFn: this._insertNotes.bind(this),
          params: {
            index: n.index,
            content: n.content,
            literatureId,
            userDataId,
            callbackTimes: 0
          },
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
          if (isDev) this.logger.info("更新次数到极限，本次暂停更新, detail=>", { index, content, literatureId, userDataId, callbackTimes});
          return;
        }
        // 还没更新出来就重新塞回队列
        if (isDev) this.logger.info("文档尚未更新到数据库，等下一次数据库更新，detail=>", { index, content, literatureId, userDataId, callbackTimes });
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
            quoteContent = await this._moveImgToAssets(detail.imagePath, detail);
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
            quoteContent = await this._moveImgToAssets(detail.imagePath, detail);
          }
          break;
        }
      }
      // return `{{{row\n> ${quoteContent}\n[Open on Zotero](${content.openURI})\n\n${content.detail.annotationComment ? content.detail.annotationComment : ""}\n}}}`;
      return `{{{row\n> ${quoteContent}\n[Open on Zotero](${content.openURI})\n\n${content.detail.annotationComment ? content.detail.annotationComment : ""}\n}}}\n{: custom-annotation-color="${content.detail.annotationColor}" style="border:dashed 0.2em ${content.detail.annotationColor}" }`;
    }
    
    private async _moveImgToAssets(imgPath: string, detail: any) {
      const time = detail.dateAdded.replace(/[-:\s]/g, "");
      // 用于欺骗思源的随机（伪）字符串，是7位的小写字母和数字（itemKey是8位）
      const randomStr = (detail.key as string).toLowerCase().slice(1);
      const name = `zotero-annotations-${detail.annotationType}-${detail.parentKey}-${detail.key}-${time}-${randomStr}`;
      const assetPath = `assets/${name}.png`;
      const assetAbsPath = "/data/" + assetPath;
      if (!(await this.plugin.kernelApi.getFile(assetAbsPath, "any"))) {
          // 如果文件不存在（同时会检验添加时间、父条目key和annotation自己的key，基本可以确定不存在了）
          await this.plugin.kernelApi.globalCopyFiles([imgPath], "/data/assets");
          await this.plugin.kernelApi.renameFile(`/data/assets/${detail.key}.png`, assetAbsPath);
          if (isDev) this.logger.info("移动批注图片到工作空间, info=>", {imgPath, assetAbsPath});
      } 
      return `![img](${assetPath})`;
    }
    
    private async _updateEmptyNote(rootId: string): Promise<string> {
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      await this.plugin.kernelApi.updateBlockContent(rootId, "markdown", `# ${userDataTitle}\n{: custom-literature-block-type="user data"}`);
      const res = await this.plugin.kernelApi.getChidBlocks(rootId);
      const userDataId = res.data[0].id as string;
      if (isDev) this.logger.info("获取用户区域标题，ID =>", userDataId);
      return userDataId;
    }

}