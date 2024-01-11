import SiYuanPluginCitation from "../index";
import { 
  dataDir,
  isDev,
  STORAGE_NAME
} from "./constants";
import { createLogger } from "./simple-logger";
import { type INoticer } from "./noticer";
const fs = window.require("fs");
const path = window.require("path");

/**
 * Reading the given directory and 
 * search all the .json and .bib file
 */
export async function fileSearch(dirPath: string, noticer: INoticer): Promise<string[]> {
  const absStoragePath = path.resolve(dataDir, "./storage/petal/siyuan-plugin-citation");
  const absDirPath = path.join(absStoragePath, dirPath);
  // TODO 如果没有这个文件夹就新建
  const files = await fsReadDir(absDirPath).catch((error: Error) => {
    if (error.message.split(":")[0] === "ENOENT") {
      //ENOENT错误说明没有文件夹，新建references文件夹
      fs.mkdirSync(absDirPath);
    } else {
      // 如果是其它错误就报错
      noticer.error(error.message);
      return null;
    }
    return [];
  });
  if (!files) return null;
  const promises = files.map(file => {
    return fsStat(path.join(absDirPath, file));
  });
  const datas = await Promise.all(promises).then(stats => {
    for (let i = 0; i < files.length; i += 1) files[i] = path.join(absDirPath, files[i]);
    return { stats, files };
  });
  const returnp = datas.stats.map(fileStat => {
    const isFile = fileStat.isFile();
    const isDir = fileStat.isDirectory();
    if (isDir) {
      return fileSearch(datas.files[datas.stats.indexOf(fileStat)], noticer);
    }
    if (isFile) {
      const filePath = datas.files[datas.stats.indexOf(fileStat)];
      const typePos = filePath.split(".").length - 1;
      if (filePath.split(".")[typePos] == "json" || filePath.split(".")[typePos] == "bib") {
        return [filePath];
      } else {
        return [];
      }
    }
  });
  return await Promise.all(returnp).then(finalRes => {
    const filePath: string[] = [];
    finalRes.forEach(fileList => {
      filePath.push(...fileList);
    });
    return filePath;
  });
}

// 读取文件的逻辑拉出
function fsReadDir(dir: string) {
  return new Promise<string[]>((resolve, reject) => {
    fs.readdir(dir, (err: any, files: string[] | PromiseLike<string[]>) => {
      if (err) reject(err);
      resolve(files);
    });
  });
}

// 获取fs.stats的逻辑拉出
function fsStat(path: string) {
  return new Promise<any>((resolve, reject) => {
    fs.stat(path, (err: any, stat: any) => {
      if (err) reject(err);
      resolve(stat);
    });
  });
}

export async function loadLocalRef(plugin: SiYuanPluginCitation): Promise<any> {
  const logger = createLogger("load references");
  const notebookId = plugin.data[STORAGE_NAME].referenceNotebook as string;
  const refPath = plugin.data[STORAGE_NAME].referencePath as string;
  plugin.literaturePool.empty();
  const limit = 64;
  let offset = 0;
  let cont = true;
  let promiseList = [];
  while (cont) {
    /**
     * 通过读取文献库中的文献构建文献池，用于快速索引和对应key与文档id
     * 文献的索引位置经过两次更新，因此目前要考虑将更新前的情况进行转化：
     * 1. key在文档标题位置
     * 2. key在文档的命名中
     * 3. key在文档的自定义字段“custom-literature-key”中
     */
    const literatureDocs  = (await plugin.kernelApi.getLiteratureDocInPath(notebookId, refPath + "/", offset, limit)).data as any[];
    if (literatureDocs.length < limit) {
      // 已经提取到所有了
      cont = false;
    }
    console.log(literatureDocs);
    const pList = literatureDocs.map(async file => {
      let key = "";
      const literatureKey = file.literature_key;
      if (!literatureKey) {
        // 如果没有这个自定义属性，就在标题和命名里找一下
        if (file.name === "") {
          // 如果命名为空就从标题里拿
          await plugin.kernelApi.setBlockKey(file.id, file.content);
          key = file.content;
        } else {
          // 命名不为空那就在命名里
          await plugin.kernelApi.setBlockKey(file.id, file.name);
          key = file.name;
        }
      } else key = literatureKey;
      plugin.literaturePool.set({id: file.id, key});
    });
    promiseList = [...promiseList, ...pList];
    offset += limit;
  }
  await Promise.all(promiseList);
  if (isDev) logger.info("成功载入引用，content=>", plugin.literaturePool.content);
  plugin.noticer.info(plugin.i18n.notices.loadRefSuccess, {size: plugin.literaturePool.size});
}

export function generateFileLinks(files: string[]) {
  return files ? files.map(file => {
    const fileName = file.split("\\").slice(-1)[0];
    return `[${fileName}]` + "\(file://" + file.replace(/\\(.?)/g, (m, p1) => p1) + "\)";
  }).join("\n") : files;
}

export function filePathProcess(path: string) {
  const illegalSigns = /([\(\)])/g;
  return path.replace(illegalSigns, (m, p1) => `\\${p1}`);
}

export function fileNameProcess(path: string) {
  const illegalSigns = /([\(\)\[\]])/g;
  return path.replace(illegalSigns, (m, p1) => `\\${p1}`);
}

export async function sleep(time: number) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
}

export function cleanEmptyKey(obj: object) {
  Object.keys(obj).forEach(key => {
    if (obj[key] == null || obj[key] == undefined) delete obj[key];
    else if (typeof obj[key] == "object") {
      if (Object.prototype.toString.call(obj[key]) === "[object Array]") {
        if (obj[key].length > 0) obj[key].forEach(o => cleanEmptyKey(o));
      } else cleanEmptyKey(obj[key]);
    }
  });
  return obj;
}