import { dataDir, isDev, STORAGE_NAME, workspaceDir } from "../utils/constants";
import SiYuanPluginCitation from "../index";
import { createLogger, type ILogger } from "../utils/simple-logger";

export const exportTypes = ["markdown", "word", "latex"] as const;
export type ExportType = typeof exportTypes[number];
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

const exportMarkdownOptions: ExportOption = {
  blockRefMode: 2,
  blockEmbedMode: 0,
  blockRefTextLeft: "\\exportRef{",
  blockRefTextRight: "\}"
};

const refReg = /\[\\\\exportRef\{(.*?)\}\]\(siyuan:\/\/blocks\/(.*?)\)/;

export class ExportManager {
  private userConfig!: {[key: string]: any};
  private logger: ILogger;

  constructor (private plugin: SiYuanPluginCitation) {
    this.logger = createLogger("export manager");
  }

  public async export(exportID: string, exportType: ExportType ) {
    switch (exportType) {
      case "markdown": {
        return await this.exportMarkdown(exportID);
      }
      case "word": {
        return await this.exportWord(exportID);
      }
      case "latex": {
        return await this.exportLatex(exportID);
      }
    }

  }

  private async exportMarkdown(exportID: string) {
    // 导出带有citekey的markdown文档
    await this.setExportConfig(exportMarkdownOptions);

    try {
      const citeBlockIDs = this.plugin.literaturePool.ids;
      let res = await this.plugin.kernelApi.getBlock(exportID);
      const fileTitle = (res.data as any)[0].content;
      res = await this.plugin.kernelApi.exportMDContent(exportID, this.userConfig.markdownYFM);
      let content = (res.data as any).content as string;
      if (isDev) this.logger.info("获得导出内容，content=>", {content});
      let iter = 0;
      while (content.match(refReg)) {
        const match = content.match(refReg);
        let replaceContent = "";
        if (citeBlockIDs.indexOf(match![2]) != -1) {
          const key = this.plugin.literaturePool.get(match![2]);
          const entry = await this.plugin.database.getContentByKey(key);
          if (entry.citekey) {
            replaceContent = `[@${entry.citekey}]`;
          } else {
            replaceContent = `[@${match![1]}](zotero://select/library/items/${entry.itemKey})`
          }
        } else {
          replaceContent = match![1];
        }
        content = content.replace(refReg, replaceContent);
        iter = iter + 1;
        if (iter > 1000) break;
      }
      if (isDev) this.logger.info("获得处理后的导出内容, contents=>", {content});
      // 下载文件
      const file  = new Blob([content]);
      const url = window.URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileTitle}.md`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      await this.resetExportConfig();
    }
  }

  private async exportWord(exportID: string) {
    // 导出带有citekey的markdown文档
    await this.setExportConfig(exportMarkdownOptions);
    try {
      const citeBlockIDs = this.plugin.literaturePool.ids;
      let res = await this.plugin.kernelApi.getBlock(exportID);
      const fileTitle = (res.data as any)[0].content;
      res = await this.plugin.kernelApi.exportMDContent(exportID, this.userConfig.markdownYFM);
      let content = (res.data as any).content as string;
      if (isDev) this.logger.info("获得导出内容，content=>", {content});
      let iter = 0;
      while (content.match(refReg)) {
        let replaceContent = "";
        let totalStr = ""
        const match = content.match(refReg);
        if (citeBlockIDs.indexOf(match![2])==-1) {
          totalStr = match![0];
          replaceContent = match![1];
        }
        else {
          const following = this.getNeighborCites(content.slice(match!.index! + match![0].length), citeBlockIDs)
          totalStr = following ? match![0] + following.totalStr : match![0];
          const keys = following ? [match![2], ...following.keys] : [match![2]];
          const links = following ? [match![1], ...following.links] : [match![1]];
          console.log({totalStr, keys, links})
          if (keys.length == 1) {
            if (citeBlockIDs.indexOf(keys[0]) != -1) {
              const key = this.plugin.literaturePool.get(match![2]);
              const entry = await this.plugin.database.getContentByKey(key);
              replaceContent = `[@siyuan_cite{${entry.entry.data.id}}@siyuan_name{zotero_refresh_to_update}}]`;
            } else {
              replaceContent = match![1];
            }
          } else {
            const ids = [];
            for (let key of keys) {
              const itemKey = this.plugin.literaturePool.get(key);
              const entry = await this.plugin.database.getContentByKey(itemKey);
              ids.push(entry.entry.data.id);
            }
            replaceContent = `[@siyuan_cite{${ids.join(",")}}@siyuan_name{zotero_refresh_to_update}}]`;
          }
        }
        content = content.replace(totalStr, replaceContent);
        iter = iter + 1;
        if (iter > 1000) break;
      }
      if (isDev) this.logger.info("获得处理后的导出内容, contents=>", {content});
      await this.plugin.kernelApi.putFile("/temp/convert/pandoc/citation/exportTemp.md", false, new Blob([content]));
      // 添加额外参数
      const exportWordParams = this.plugin.data[STORAGE_NAME].exportWordParam as string || "";
      const additionalParams = exportWordParams ? exportWordParams.split(",") : [];
      // 构建pandoc导出参数
      const pandocParams = [
        "./exportTemp.md",
        "-o", "exportTemp.docx",
        "--lua-filter", dataDir + "/plugins/siyuan-plugin-citation/scripts/citation.lua",
        "--lua-filter", dataDir + "/plugins/siyuan-plugin-citation/scripts/math.lua",
        "--resource-path", dataDir,
        ...additionalParams
      ];
      if (this.userConfig.docxTemplate) {
        pandocParams.push("--reference-doc", this.userConfig.docxTemplate);
      }
      if (isDev) this.logger.info("开始调用pandoc导出word，参数=>", pandocParams);
      await this.plugin.kernelApi.pandoc("citation", pandocParams)
      res = await this.plugin.kernelApi.getFile("/temp/convert/pandoc/citation/exportTemp.docx", "any") as any;
      const file = await (new Response(((res as any).body as ReadableStream))).blob()
      // 下载
      const url = window.URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileTitle}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      await this.resetExportConfig();
    }
  }

  private async exportLatex(exportID: string) {
    // 导出带有citekey的markdown文档
    await this.setExportConfig(exportMarkdownOptions);
    try {
      const citeBlockIDs = this.plugin.literaturePool.ids;
      let res = await this.plugin.kernelApi.getBlock(exportID);
      const fileTitle = (res.data as any)[0].content;
      res = await this.plugin.kernelApi.exportMDContent(exportID, this.userConfig.markdownYFM);
      let content = (res.data as any).content as string;
      if (isDev) this.logger.info("获得导出内容，content=>", {content});
      let iter = 0;
      while (content.match(refReg)) {
        let replaceContent = "";
        let totalStr = ""
        const match = content.match(refReg);
        if (citeBlockIDs.indexOf(match![2])==-1) {
          totalStr = match![0];
          replaceContent = match![1];
        }
        else {
          const following = this.getNeighborCites(content.slice(match!.index! + match![0].length), citeBlockIDs)
          console.log(following)
          totalStr = following ? match![0] + following.totalStr : match![0];
          const keys = following ? [match![2], ...following.keys] : [match![2]];
          const links = following ? [match![1], ...following.links] : [match![1]];
          if (keys.length == 1) {
            if (citeBlockIDs.indexOf(keys[0]) != -1) {
              const key = this.plugin.literaturePool.get(match![2]);
              const entry = await this.plugin.database.getContentByKey(key);
              replaceContent = `\\cite{${entry.citekey}}`;
            } else {
              replaceContent = match![1];
            }
          } else {
            const ids = [];
            for (let key of keys) {
              const itemKey = this.plugin.literaturePool.get(key);
              const entry = await this.plugin.database.getContentByKey(itemKey);
              ids.push(entry.citekey);
            }
            replaceContent = `\\cite{${ids.join(",")}}`;
          }
        }
        content = content.replace(totalStr, replaceContent);
        iter = iter + 1;
        if (iter > 1000) break;
      }
      if (isDev) this.logger.info("获得处理后的导出内容, contents=>", {content});
      await this.plugin.kernelApi.putFile("/temp/convert/pandoc/citation/exportTemp.md", false, new Blob([content]));
      // 添加额外参数
      const exportLatexParams = this.plugin.data[STORAGE_NAME].exportLaTeXParam as string || "";
      const additionalParams = exportLatexParams ? exportLatexParams.split(",") : [];
      await this.plugin.kernelApi.pandoc("citation", [
        "./exportTemp.md",
        "-o", "exportTemp.tex",
        "--lua-filter", dataDir + "/plugins/siyuan-plugin-citation/scripts/math.lua",
        "--lua-filter", dataDir + "/plugins/siyuan-plugin-citation/scripts/latex.lua",
        "--wrap=none",
        "--template", "D:/Documents/OneDrive/杂项/模板/pandoc_template.tex",
        "--standalone",
        ...additionalParams
      ])
      res = await this.plugin.kernelApi.getFile("/temp/convert/pandoc/citation/exportTemp.tex", "any") as any;
      const file = await (new Response(((res as any).body as ReadableStream))).blob()
      // 下载
      const url = window.URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileTitle}.tex`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      await this.resetExportConfig();
    }
  }

  private async setExportConfig(changedOptions: ExportOption) {
    this.userConfig = (window as unknown as {siyuan: any}).siyuan.config.export;
    if (isDev) this.logger.info("读取到用户设置数据, config=>", this.userConfig);
    // 拷贝设置然后修改
    const setConfig = Object.assign({}, this.userConfig);
    Object.keys(changedOptions).forEach(key => {
      setConfig[key] = (changedOptions as Record<string, any>)[key];
    });
    await this.plugin.kernelApi.setExport(setConfig);
  }

  private async resetExportConfig() {
    await this.plugin.kernelApi.setExport(this.userConfig);
    if (isDev) this.logger.info("成功还原用户设置数据");
  }

  private getNeighborCites(content: string, citeBlockIDs: string[]): null | {totalStr: string, links: string[], keys: string[]} {
    const match = content.match(refReg);
    if (!match) { return null; }
    else if (citeBlockIDs.indexOf(match[2]) != -1 && (match.index == 1 || match.index == 0)) {
      const following = this.getNeighborCites(content.slice(match.index + match[0].length), citeBlockIDs);
      if (!following) return {
        totalStr: content.slice(0, match.index + match[0].length),
        links: [match[1]],
        keys: [match[2]]
      }
      else return {
        totalStr: content.slice(0, match.index + match[0].length) + following.totalStr,
        links: [match[1], ...following.links],
        keys: [match[2], ...following.keys]
      }
    } else { return null; }
  }
}