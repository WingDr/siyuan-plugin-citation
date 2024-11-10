import { type ILogger, createLogger } from "../utils/simple-logger";
import SiYuanPluginCitation from "../index";
import { 
    STORAGE_NAME, 
    citeLinkDynamic, 
    citeLinkStatic, 
    isDev, 
    refRegDynamic, 
    refRegStatic } from "../utils/constants";
import { generateFromTemplate } from "../utils/templates";

export class Cite {
  plugin: SiYuanPluginCitation;
  private logger: ILogger;

  constructor(plugin: SiYuanPluginCitation) {
      this.plugin = plugin;
      this.logger = createLogger("cite");
      
  }

  public async generateCiteLink(key: string, index: number, typeSetting: any, onlyLink=false) {
    const linkTemplate = typeSetting.linkTemplate as string;
    const useDynamicRefLink = typeSetting.useDynamicRefLink as boolean;
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
      this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
      return null;
    }
    if (isDev) this.logger.info("仅包含链接的模板 =>", {index, id: this.plugin.literaturePool.get(key)});
    return generateFromTemplate(template, {
      index,
      citeFileID: this.plugin.literaturePool.get(key),
      ...entry
    });
  }
  
  public async generateLiteratureName(key: string) {
    const nameTemplate = this.plugin.data[STORAGE_NAME].nameTemplate;
    const customCiteText = this.plugin.data[STORAGE_NAME].customCiteText;
    const useDynamicRefLink = this.plugin.data[STORAGE_NAME].useDynamicRefLink;
    // 如果本身不同时使用自定义链接和动态链接，就不需要生成文档的命名
    if (!(customCiteText && useDynamicRefLink)) return "";
    const entry = await this.plugin.database.getContentByKey(key);
    if (!entry) {
      if (isDev) this.logger.error("找不到文献数据");
      this.plugin.noticer.error((this.plugin.i18n.errors as any).getLiteratureFailed);
      return null;
    }
    return generateFromTemplate(nameTemplate, {
      citeFileID: this.plugin.literaturePool.get(key),
      ...entry
    });
  }

  public async generateCiteRef(citeFileId: string, link: string, name: string, typeSetting: any) {
    const customCiteText = typeSetting.customCiteText;
    const useDynamicRefLink = typeSetting.useDynamicRefLink;
    if (customCiteText) {
      if (useDynamicRefLink) await this.plugin.kernelApi.setNameOfBlock(citeFileId, name);
      return link;
    } else if (useDynamicRefLink) {
      await this.plugin.kernelApi.setNameOfBlock(citeFileId, link);
      return citeLinkDynamic.replace("${id}", citeFileId).replace("${cite_type}", typeSetting.name);
    } else {
      return citeLinkStatic.replace("${id}", citeFileId).replace("${link}", link).replace("${cite_type}", typeSetting.name);
    }
  }
}