import { isDev } from "../utils/constants";
import SiYuanPluginCitation from "../index";
import { createLogger, type ILogger } from "../utils/simple-logger";

type ExportType = "markdown" | "word" | "latex" | "pdf";
interface ExportOption {
    "paragraphBeginningSpace"?: boolean,
    "addTitle"?: boolean,
    "markdownYFM"?: boolean,
    "blockRefMode"?: number,
    "blockEmbedMode"?: number,
    "fileAnnotationRefMode"?: number,
    "pdfFooter"?: string,
    "blockRefTextLeft"?: string,
    "blockRefTextRight"?: string,
    "tagOpenMarker"?: string,
    "tagCloseMarker"?: string,
    "pandocBin"?: string
}


export class ExportManager {
  private userConfig: {[key: string]: string};
  private logger: ILogger

  constructor (private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("export manager");
  }

  public async export(exportIDs: string[], exportType: ExportType ) {
    switch (exportType) {
      case "markdown": {
        this.exportMarkdown(exportIDs);
      }
    }

  }

  private async exportMarkdown(exportIDs: string[]) {
    await this.setExportConfig({
      blockRefMode: 2,
      blockEmbedMode: 0,
      blockRefTextLeft: "\\exportRef{",
      blockRefTextRight: "\}"
    } as ExportOption);

    const refReg = /\[\\exportRef\{(.*?)\}\]\(siyuan:\/\/blocks\/(.*?)\)/g;
    const citeBlockIDs = this.plugin.literaturePool.ids;
    const pList = exportIDs.map(async blockID => {
      const res = await this.plugin.kernelApi.exportMDContent(blockID);
      const content = (res.data as any).content as string;
      if (isDev) this.logger.info("获得导出内容，content=>", {content});
      return content.replace(refReg, (match, p1, p2) => {
        if (citeBlockIDs.indexOf(p2) != -1) {
          return `\\cite{${this.plugin.literaturePool.get(p2)}}`;
        } else {
          return p1;
        }
      })
    });

    const exportContents = await Promise.all(pList);
    if (isDev) this.logger.info("获得处理后的导出内容, contents=>", exportContents);
    this.resetExportConfig();
  }

  private async setExportConfig(changedOptions: ExportOption) {
    this.userConfig = (window as unknown as {siyuan: any}).siyuan.config.export;
    if (isDev) this.logger.info("读取到用户设置数据, config=>", this.userConfig);
    // 拷贝设置然后修改
    const setConfig = Object.assign({}, this.userConfig);
    Object.keys(changedOptions).forEach(key => {
      setConfig[key] = changedOptions[key];
    })
    await this.plugin.kernelApi.setExport(setConfig);
  }

  private async resetExportConfig() {
    await this.plugin.kernelApi.setExport(this.userConfig);
  }
}