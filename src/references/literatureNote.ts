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
    private updateBatches: Map<string, {
      entry: any, 
      noConfirmUserData: boolean,
      mission: Promise<void> | null
    }>; // 批量更新

    constructor(plugin: SiYuanPluginCitation) {
        this.plugin = plugin;
        this.logger = createLogger("literature-note");
        this.updateBatches = new Map();
    }

    public async addLiteratureNotesToUpdateBatch(key: string, entry: any, noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm) {
      // 计算最终的 key（与 updateLiteratureNote 保持一致）
      const useItemKey = this.plugin.data[STORAGE_NAME].useItemKey as boolean;
      const final_key = "1_" + (useItemKey ? entry.itemKey : entry.citekey);

      // 1. 检查batch里面是否重复（使用最终key）
      if (this.updateBatches.has(final_key)) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文献更新任务已存在，batch=>", this.updateBatches);
        return;
      }

      // 2. 检查 literaturePool 中是否已存在（使用最终key）
      const existingDocId = this.plugin.literaturePool.get(final_key);
      if (existingDocId) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文献文档已存在于literaturePool，key=>", final_key, "id=>", existingDocId);
        // 如果已存在，只更新内容，不创建新文档
        this.updateBatches.set(final_key, {entry, noConfirmUserData, mission: null});
        const mission = this.updateLiteratureNote(final_key, entry, {noConfirmUserData, userDataId: ""});
        this.updateBatches.set(final_key, {entry, noConfirmUserData, mission});
        return;
      }

      // 3. 首先进行占位（防止并发，使用最终key）
      this.updateBatches.set(final_key, {entry, noConfirmUserData, mission:null});

      // 4. 检查文档是否存在，不存在则新建（使用最终key搜索）
      const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
      const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
      const res = this.plugin.kernelApi.searchFileWithKey(notebookId, refPath + "/", final_key);
      const data = (await res).data as any[];
      let userDataId = "";

      if (!data.length) {
        // 创建前再次检查 literaturePool（双重检查，防止竞争条件，使用最终key）
        const doubleCheckDocId = this.plugin.literaturePool.get(final_key);
        if (doubleCheckDocId) {
          if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("双重检查发现文献已存在，key=>", final_key, "id=>", doubleCheckDocId);
          const mission = this.updateLiteratureNote(final_key, entry, {noConfirmUserData, userDataId: ""});
          this.updateBatches.set(final_key, {entry, noConfirmUserData, mission});
          return;
        }

        // 创建时直接使用最终key
        const literatureId = await this._createEmptyNote(final_key, entry);
        userDataId = await this._updateEmptyNote(literatureId);
      } else {
        // 文档已存在，更新 literaturePool（使用最终key）
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("从数据库查询发现文献已存在，key=>", final_key, "id=>", data[0].id);
        this.plugin.literaturePool.set({id: data[0].id, key: final_key});
      }

      // 这里仅新建文档不填充内容，在_processExistedLiteratureNote中会被判断为空文档然后填充（使用最终key）
      const mission = this.updateLiteratureNote(final_key, entry, {noConfirmUserData, userDataId});
      // 这里更新内容
      this.updateBatches.set(final_key, {entry, noConfirmUserData, mission});
    }

    public async processUpdateBatches() {
      if (!this.updateBatches.size) return;
      // 获取所有的key、entry、noConfirmUserData
      const batches = Array.from(this.updateBatches.entries());
      // 对batches异步处理但是promise.all
      await Promise.all(batches.map(([key, {entry, noConfirmUserData, mission}]) => {
        return mission;
      })).then(() => {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("批量更新完成");
        batches.forEach(([key, {entry, noConfirmUserData, mission}]) => {
          this.updateBatches.delete(key);
        });
      });
      // this.updateBatches.clear();
    }

    public async updateLiteratureNote(key: string, entry: any, {noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm, userDataId=""}={}) {
      const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
      const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
      const useItemKey = this.plugin.data[STORAGE_NAME].useItemKey as boolean;

      // 优先从 literaturePool 获取（新增）
      let literatureId = this.plugin.literaturePool.get(key);

      if (!literatureId) {
        // literaturePool 中不存在，查询数据库
        const res = this.plugin.kernelApi.searchFileWithKey(notebookId, refPath + "/", key);
        const data = (await res).data as any[];

        if (!data.length) {
          literatureId = await this._createEmptyNote(key, entry);
          userDataId = await this._updateEmptyNote(literatureId);
        } else {
          literatureId = data[0].id;
          // 更新 literaturePool
          this.plugin.literaturePool.set({id: literatureId, key});
        }
      }

      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("已存在文献文档，id=>", {literatureId});
      // 保险起见更新一下字典
      this.plugin.literaturePool.set({id: literatureId, key});
      await this._processExistedLiteratureNote(literatureId, key, entry, {noConfirmUserData, userDataId});
      // 最后更新一下key的形式
      const new_key = "1_" + (useItemKey ? entry.itemKey : entry.citekey);
      await this.plugin.kernelApi.setBlockKey(literatureId, new_key);
      this.plugin.literaturePool.set({id: literatureId, key:new_key});
      this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
      return;
    }

    public async bindDocumentToLiterature(key: string, literatureId: string) {
      const useItemKey = this.plugin.data[STORAGE_NAME].useItemKey as boolean;
      // 查找用户自定义片段
      const res = await this.plugin.kernelApi.getChildBlocks(literatureId);
      const dataIds = (res.data as any[]).map(data => {
        return data.id as string;
      });
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      // 获取文献信息
      const entry = await this.plugin.database.getContentByKey(key);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("从database中获得文献内容 =>", entry);
      if (!entry) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.error("找不到文献数据", {key, blockID: this.plugin.literaturePool.get(key)});
        this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
        return null;
      }
      // 先检查是否已经有文档绑定在了相同文献
      if (!this.plugin.literaturePool.get(key)) {
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("没有已重复文献，key=>", key);
        // 没有重复，是好事，直接形成文献内容文档，形成结构然后刷新
        this.plugin.literaturePool.set({key, id: literatureId});
        // 检查是否有用户数据区域
        if (dataIds.length) {
          // 查找用户数据片段
          const userDataInfo = await this._detectUserData(literatureId, dataIds, key, userDataTitle);
          // 如果没有用户数据，将整个文档作为用户数据
          if (!userDataInfo.hasUserData) await this.plugin.kernelApi.setBlockAttr(literatureId, {"custom-literature-key": key});
        } else await this.plugin.kernelApi.setBlockAttr(literatureId, {"custom-literature-key": key}); // 空白文档一样处理
        // 清除unlink状态
        await this.plugin.kernelApi.setBlockAttr(literatureId, {"custom-literature-unlinked": ""});
        await this._processExistedLiteratureNote(literatureId, key, entry);
      } else {
        // 有重复，得额外处理
        const existDocId = this.plugin.literaturePool.get(key);
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("已存在文献内容文档，id=>", {existDocId});
        if (dataIds.length) {
          // 对于空白文档直接删除（虽然不太可能有这种情况）
          // 查找用户数据片段
          const userDataInfo = await this._detectUserData(literatureId, dataIds, key, userDataTitle);
          let moveList = []; // 需要移动的块列表
          if (!userDataInfo.hasUserData || userDataInfo.userDataId === literatureId) {
            // 把整个当做用户数据片段
            moveList = dataIds;
          } else {
            // 把userDataId后面的都移动
            moveList = dataIds.slice(dataIds.indexOf(userDataInfo.userDataId)+1);
          }
          let res = await this.plugin.kernelApi.getChildBlocks(existDocId);
          // 如果已有文档是空的，设定moveInside
          if (!(res.data as any[]).length) {
            await this._moveBlocks(moveList, 0, existDocId, true);
          } else {
            const startBlock = (res.data as any[])[(res.data as any[]).length - 1].id;
            await this._moveBlocks(moveList, 0, startBlock, false);
          }
        }
        // 将当前文档的所有引用转移到已有文档
        await this.plugin.kernelApi.transferBlockRef(literatureId, existDocId);
        // 最终删除当前的重复文档，并提示用户
        await this.plugin.kernelApi.removeDocByID(literatureId);
        this.plugin.noticer.info((this.plugin.i18n.notices as any).deleteDuplicatedDocument, {documentId: literatureId});
      }
      // 最后更新一下key的形式
      const new_key = "1_" + (useItemKey ? entry.itemKey : entry.citekey);
      await this.plugin.kernelApi.setBlockKey(literatureId, new_key);
      this.plugin.literaturePool.set({id: literatureId, key:new_key});
      this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
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
      if (!attrViewBlock || !attrViewTemplate || !attrViewBlock.length || !attrViewTemplate.length) return;
      const blockID = this.plugin.literaturePool.get(key);
      let res = await this.plugin.kernelApi.getBlock(attrViewBlock);
      const content = (res.data as any[])[0].markdown as string;
      const avIdReg = /.*data-av-id=\"(.*?)\".*/;
      const avID = content.match(avIdReg)![1];
      // 检查块是否在数据库中
      res = await this.plugin.kernelApi.getAttributeViewItemIDsByBoundIDs(avID, [blockID]);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到块在数据库中的绑定情况", res.data);
      const findItem = (res.data as any)[blockID];
      // 返回值是一个对象，键是块ID，值是itemID
      if (!findItem || !findItem.length) {
        // 创建数据库
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("数据库中不存在块，将块插入数据库", {avID, blockID});
        res = await this.plugin.kernelApi.addAttributeViewBlocks(avID, [{
          id: blockID,
          isDetached: false
        }]);
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("插入数据库api返回", res);
      }
      // 生成插入数据
      const dataString = generateFromTemplate(attrViewTemplate, entry);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("根据模板生成属性=>", {dataString});
      try { 
        JSON.parse(dataString);
      } catch (error) { 
        this.plugin.noticer.error((this.plugin.i18n as any).errors.attrViewTemplateNotJson + error);
        return;
      }
      const data = JSON.parse(dataString);
      // 获取块在数据库中对应的itemID
      res = await this.plugin.kernelApi.getAttributeViewItemIDsByBoundIDs(avID, [blockID]);
      const itemID = (res.data as any)[blockID];
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到文档对应的itemID=>", {itemID});
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("插入数据库属性", data);
      await this.plugin.kernelApi.batchSetAttributeViewBlockAttrs(avID, data.map((d: { keyID: string; value: any; }) => ({
        keyID: d.keyID,
        itemID,
        value: d.value
      })));
    }

    private async _processExistedLiteratureNote(literatureId: string, key: string, entry: any, {noConfirmUserData=this.plugin.data[STORAGE_NAME].deleteUserDataWithoutConfirm, userDataId=""}={}) {
      // 文件存在就更新文件内容
      // 首先将文献的基本内容塞到用户文档的自定义属性中
      this.plugin.kernelApi.setBlockEntry(literatureId, JSON.stringify(cleanEmptyKey(Object.assign({}, entry))));
      // 查找用户自定义片段
      const res = await this.plugin.kernelApi.getChildBlocks(literatureId);
      const dataIds = (res.data as any[]).map(data => {
        return data.id as string;
      });
      const userDataTitle = this.plugin.data[STORAGE_NAME].userDataTitle as string;
      const that = this;
      // 玩玩状态机
      // 1. 判定状态
      let state: string = "";
      let userDataInfo: any = null;
      let deleteList: string[] = [];
      let userDataLink: string = "";
      if (!userDataId.length) {
        if (dataIds.length) {
          userDataInfo = await this._detectUserData(literatureId, dataIds, key, userDataTitle);
          ({deleteList, userDataId, userDataLink} = userDataInfo);
          if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获得用户片段更新信息=>", userDataInfo);
          if (!userDataInfo.hasUserData) {
            state = noConfirmUserData ? "updateEmpty" : "confirmUpdate";
          }
        } else {
          if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("文献内容文档中没有内容");
          state = "updateEmpty";
        }
      }
      // 2. 定义状态 -> 差异函数
      const handlers: Record<string, () => Promise<Partial<{ deleteList: any[]; userDataId: string; userDataLink: string; }> | void>> = {
        async confirmUpdate() {
          // 注意这里直接 return 整个函数，不再走后续公共逻辑
          return await confirm("⚠️", (that.plugin.i18n.confirms as any).updateWithoutUserData.replaceAll("${title}", entry.title), async () => {
            that._updateDataSourceItem(key, entry);
            const newUserDataId = await that._updateEmptyNote(literatureId);
            const newUserDataLink = `[${userDataTitle}](siyuan://blocks/${newUserDataId})\n\n`;
            that._updateComplexContents(literatureId, newUserDataId, newUserDataLink, entry, []);
            setTimeout(() => {
              that._updateAttrView(key, entry);
            }, 1000);
            return;
          });
        },
        async updateEmpty() {
          const newUserDataId = await that._updateEmptyNote(literatureId);
          return { deleteList: [], userDataId: newUserDataId };
        },
        async default() {
          return {};
        },
      };
      // 执行
      const diff = await (handlers[state] || handlers.default).call(this);
      // 如果 confirmUpdate 已经 return 出去了，这里就不会执行
      if (!diff) return;  
      // 公共逻辑
      deleteList = diff.deleteList ?? deleteList;
      userDataId = diff.userDataId ?? userDataId;
      userDataLink = diff.userDataLink ?? userDataLink;
      // 执行后续操作之前先更新文献池
      this.plugin.literaturePool.set({id: literatureId, key: key});
      // 插入前置片段
      // if (!userDataLink.length) userDataLink = `((${userDataId} '${userDataTitle}'))\n\n`;
      userDataLink = `[${userDataTitle}](siyuan://blocks/${userDataId})\n\n`;
      this._updateComplexContents(literatureId, userDataId, userDataLink, entry, deleteList);
      this._updateDataSourceItem(key, entry);
      setTimeout(() => {
        this._updateAttrView(key, entry);
      }, 1000);
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

    private async _moveBlocks(moveList: string[], currentIndex: number, targetID: string, moveInside: boolean): Promise<void> {
      // 迭代移动块
      if (!moveList.length) return;
      if (currentIndex >= moveList.length) return;
      const blockId = moveList[currentIndex];
      if (moveInside) await this.plugin.kernelApi.moveBlockByParentID(blockId, targetID);
      else await this.plugin.kernelApi.moveBlockByPreviousID(blockId, targetID);
      return await this._moveBlocks(moveList, currentIndex + 1, blockId, false);
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
      let res = await this.plugin.kernelApi.getChildBlocks(literatureId);
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
    
    private async _createEmptyNote(key: string, entry: any): Promise<string> {
      const titleTemplate = this.plugin.data[STORAGE_NAME].titleTemplate as string;
      //文件不存在就新建文件
      let noteTitle = generateFromTemplate(titleTemplate, entry);
      noteTitle = noteTitle.replace(DISALLOWED_FILENAME_CHARACTERS_RE, "_");
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("生成文件标题 =>", noteTitle);
      // 创建新文档
      const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
      const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
      const res = await this.plugin.kernelApi.createDocWithMd(notebookId, refPath + `/${noteTitle}`, "");
      const rootId = String(res.data);
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("创建文档，ID =>", rootId);
      // 将文献的基本内容塞到用户文档的自定义属性中
      // 注意：这里直接使用传入的 key，该 key 应该已经是最终格式（在 addLiteratureNotesToUpdateBatch 中计算）
      await this.plugin.kernelApi.setBlockKey(rootId, key);
      // 新建文件之后也要更新对应字典
      this.plugin.literaturePool.set({id: rootId, key: key});
      return rootId;
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
        await this.plugin.kernelApi.prependBlock(rootId, "markdown", `# ${userDataTitle}\n{: custom-literature-block-type="user data"}`);
        const res = await this.plugin.kernelApi.getChildBlocks(rootId);
        userDataId = (res.data as any[])[0].id as string;
      }
      if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取用户区域标题，ID =>", userDataId);
      if (userDataTemplatePath.length) {
        // 在用户数据中调用模板渲染
        const absTemplatePath = workspaceDir + userDataTemplatePath
        if (isDev || this.plugin.data[STORAGE_NAME].consoleDebug) this.logger.info("获取到模板绝对路径：" + absTemplatePath);
        try {
          const res = await this.plugin.kernelApi.renderTemplate(rootId, absTemplatePath);
          if (useWholeDocAsUserData) this.plugin.kernelApi.insertBlock("dom", (res.data as any).content, "", "", rootId);
          else this.plugin.kernelApi.insertBlock("dom", (res.data as any).content, "", userDataId, "");
        } catch (error) {
          this.plugin.noticer.error((this.plugin.i18n as any).errors.userDataTemplatePathRenderError, error);
        }
      }
      return userDataId;
    }

}