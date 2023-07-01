import SiYuanPluginCitation from "./index";
import { SiyuanData } from "./api/base-api";
import {
  Author
} from "./library";
import {
  STORAGE_NAME
} from "./utils/constants";
import {
  generateFileLinks,
  generateFromTemplate
} from "./utils/util";

// 根据输入更新文献库和引用文档，并维护本文档中的引用次序
export class Reference {
  plugin: SiYuanPluginCitation;

  constructor(plugin: SiYuanPluginCitation) {
    this.plugin = plugin;
    this.checkRefDirExist();
  }

  public async initializeReferenceDir() {
    // this.updateLiteratureNote("caiAdaptiveFinitetimeConsensus2017");
    // const res = await this.updateLiteratureLink("20230621160139-xh1t8dg");
    // console.log(await this.checkRefDirExist());
  }

  public async updateLiteratureNote(citekey: string) {
    const notebookId = this.plugin.data[STORAGE_NAME].referenceNotebook as string;
    const refPath = this.plugin.data[STORAGE_NAME].referencePath as string;
    const noteTemplate = this.plugin.data[STORAGE_NAME].noteTemplate as string;
    const res = await this.plugin.kernelApi.searchFileInSpecificPath(notebookId, refPath + `/${citekey}`);
    const data = res.data as any[];
    const entry = this.plugin.library.getTemplateVariablesForCitekey(citekey);
    entry.files = generateFileLinks(entry.files);
    const literatureNote = generateFromTemplate(noteTemplate, entry);
    if (data.length) {
      const literatureId = data[0].root_id;
      // 文件存在就更新文件内容
      return await this.plugin.kernelApi.updateBlockContent(literatureId, literatureNote);
    } else {
      //文件不存在就新建文件
      return await this.plugin.kernelApi.createDocWithMd(notebookId, refPath + `/${citekey}`, literatureNote).then(res => {
        // 新建文件之后也要更新对应字典
        const id  = String(res.data);
        this.plugin.ck2idDict[citekey] = id;
        this.plugin.id2ckDict[id] = citekey;
      });
    }
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
    citedBlocks.forEach(block => {
      const reg = /\(\((.*?)\)\)/g;
      let isModified = false;
      let isCited = false;
      const newContent = block.content.replace(reg, (match, p1) => {
        const key = p1.split(" ")[0];
        const anchor = p1.split(" ")[1];
        const idx = literatureEnum.indexOf(key);
        if (idx != -1) {
          isCited = true;
          const link = this.generateCiteLink(this.plugin.id2ckDict[key], idx);
          if (anchor != "'" + link + "'") {
            isModified = true;
          }
          return `((${key} '`+ link +"'))";
        }
        return match;
      });
      if (!isCited) {
        cancelCiteList.push({
          blockId: block.id as string
        });
      }
      if (isModified) {
        writeList.push({
          content: newContent,
          blockId: block.id as string
        });
      }
    });
    console.log(cancelCiteList);
    console.log(writeList);
    const update = writeList.map(witem => {
      return this.plugin.kernelApi.updateCitedBlock(witem.blockId, witem.content);
    });
    const cancel = cancelCiteList.map(citem => {
      return this.plugin.kernelApi.setBlockCited(citem.blockId, false);
    });
    return Promise.all(update).then(() => Promise.all(cancel));
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
    const citekeys = Object.keys(this.plugin.library.entries);
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

  public generateCiteLink(citekey: string, index: number) {
    const linkTemplate = this.plugin.data[STORAGE_NAME].linkTemplate as string;
    const entry = this.plugin.library.getTemplateVariablesForCitekey(citekey);
    const shortAuthor = entry.author ? this.generateShortAuthor(entry.author, 2) : "";
    return generateFromTemplate(linkTemplate, {
      index,
      shortAuthor,
      ...entry
    });
  }

  public async insertCiteLink(protyle, content: string) {
    const blockId = protyle.protyle.breadcrumb.id;
    const rootId = protyle.protyle.block.rootID;
    console.log(blockId, rootId);
    protyle.insert(content, false, true);
    // TODO 等待前后端联动API更新再更新文档标号
    // await this.plugin.kernelApi.setBlockCited(blockId, true);
    // await this.plugin.reference.updateLiteratureLink(rootId);
  }

  private generateShortAuthor(author: Author[], limit: number): string {
    let shortAuthor = "";
    if (author.length == 0) {
      return "";
    }
    for (let i = 0; i < limit && i < author.length; i++) {
      if (i == 0) {
        shortAuthor += author[i].family;
      } else if (i == limit - 1) {
        shortAuthor += " and " + author[i].family;
        if (limit < author.length) {
          shortAuthor +=  " et al.";
        }
      } else if (author.length < limit && i == author.length - 1) {
        shortAuthor += " and " + author[i].family;
      } else {
        shortAuthor += ", " + author[i].family;
      }
    }
    return shortAuthor;
  }

  /**
   * Translate the human readable path to siyuan path
   * @param notebookId id of the target notebook
   * @param currentDir the current searching directory
   * @param pathSteps the rest of path that needs searching
   * @returns transelate results {success: boolean, path: string}
   */
  private async translateReferenceDir(notebookId: string, currentDir: string, pathSteps: string[]): Promise<any> {
    // 终止条件
    if (pathSteps.length == 0) {
      return {
          success: true,
          path: currentDir
        };
    }
    const res = await this.plugin.kernelApi.readDir(`/data/${notebookId}/${currentDir}`);
    const data = res.data as any[];
    // 只检索思源文本文件
    const files = data.filter((file) => {
      const p = file.name.split(".");
      const pLen = p.length;
      return !file.isDir && (p[pLen-1] == "sy");
    });
    const promise = files.map(file => {
      return this.plugin.kernelApi.getFile(`/data/${notebookId}/${currentDir}/${file.name}`, "text");
    });
    return Promise.all(promise).then(contents => {
      const subpromise = contents.map(async contentStr => {
        const content = JSON.parse(contentStr);
        if (content.Properties.title == pathSteps[0]) {
          return this.translateReferenceDir(notebookId, currentDir + `/${content.ID}`, pathSteps.slice(1)).then(res => {
            console.log(res);
            if (res.success) {
              return {
                success: true,
                path: res.path
              };
            } else {
              return res;
            }
          });
        } else {
          return {
            success: false,
            path: ""
          };
        }
      });
      return Promise.all(subpromise).then(res => {
        let success = false;
        let path = "";
        res.forEach(item => {
          if (item.success) {
            success = true;
            path = item.path;
          }
        });
        return {
          success,
          path
        };
      });
    });
  }
}