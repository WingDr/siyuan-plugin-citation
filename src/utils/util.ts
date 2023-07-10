import SiYuanPluginCitation from "../index";
import { 
  dataDir,
  isDev,
  STORAGE_NAME
} from "./constants";
import { createLogger } from "./simple-logger";
import { createNoticer, INoticer } from "./noticer";
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
  const noticer = createNoticer();
  plugin.ck2idDict = {};
  plugin.id2ckDict = {};
  const notebookId = plugin.data[STORAGE_NAME].referenceNotebook as string;
  const refPath = plugin.data[STORAGE_NAME].referencePath as string;
  const limit = 20;
  let offset = 0;
  let cont = true;
  while (cont) {
      const res  = await plugin.kernelApi.getFileTitleInPath(notebookId, refPath + "/", offset, limit);
      if ((res.data as any[]).length < limit) {
          cont = false;
      }
      (res.data as any[]).forEach(async file => {
        if (file.name != "") {
          plugin.id2ckDict[file.id] = file.name;
          plugin.ck2idDict[file.name] = file.id;
        } else {
          //命名为空，那么就把标题赋给命名
          await plugin.kernelApi.setNameOfBlock(file.id, file.content);
          plugin.id2ckDict[file.id] = file.content;
          plugin.ck2idDict[file.content] = file.id;
        }
      });
      offset += limit;
  }
  if (isDev) logger.info("成功载入引用，id2ckDict=>", plugin.id2ckDict);
  if (isDev) logger.info("成功载入引用，ck2idDict=>", plugin.ck2idDict);
  noticer.info(plugin.i18n.loadRefSuccess.replace("${size}", Object.keys(plugin.id2ckDict).length));
  return plugin.id2ckDict, plugin.ck2idDict;
}

export function generateFileLinks(files: string[]) {
  return files ? files.map(file => {
    const fileName = file.split("\\").slice(-1)[0];
    return `[${fileName}]` + "\(file://" + file.replace(/\\(.?)/g, (m, p1) => p1) + "\)";
  }).join("\n") : files;
}