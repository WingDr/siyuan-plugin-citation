import SiYuanPluginCitation from "../index";
import { 
  isDev,
  STORAGE_NAME
} from "./constants";
import { createLogger } from "./simple-logger";
import { type INoticer } from "./noticer";

interface ReadDirRes {
  isDir: boolean;
  isSymlink: boolean;
  name: string;
  updated: string;
}

/**
 * Reading the given directory and 
 * search all the .json and .bib file
 */
export async function fileSearch(plugin: SiYuanPluginCitation, dirPath: string, noticer: INoticer): Promise<string[]> {
  const absStoragePath = "/data/storage/petal/siyuan-plugin-citation";
  const absDirPath = absStoragePath + dirPath;
  // 读取文件夹
  let files = (await plugin.kernelApi.readDir(absDirPath)).data as ReadDirRes[];
  // 如果没有这个文件夹就新建
  if (!files) { plugin.kernelApi.putFile(absDirPath, true, ""); files = []; }
  const pList = files.map( async file => {
    if (file.isDir) {
      // 如果是文件夹就迭代搜索
      const subdirPath = dirPath + file.name + "/";
      const files = await fileSearch(plugin, subdirPath, noticer);
      return files;
    } else {
      // 如果不是文件夹就获取文件内容
      const typePos = file.name.split(".").length - 1;
      if (file.name.split(".")[typePos] == "json" || file.name.split(".")[typePos] == "bib") {
        return [absDirPath + file.name];
      } else {
        return [];
      }
    }
  });
  return await Promise.all(pList).then(finalRes => {
    const filePaths: any[] | PromiseLike<any[]> = [];
    finalRes.forEach(fileList => {
      filePaths.push(...fileList);
    });
    return filePaths;
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
  let promiseList: any[] = [];
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
  plugin.noticer.info((plugin.i18n.notices as any).loadRefSuccess, {size: plugin.literaturePool.size});
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

export function cleanEmptyKey(obj: any) {
  const cleanedObj = Object.keys(obj).reduce((prv: any, key) => {
    if (obj[key] == null || obj[key] == undefined || obj[key] == "") return prv;
    else if (typeof obj[key] == "object") {
      if (Object.prototype.toString.call(obj[key]) === "[object Array]") {
        if (obj[key].length > 0) prv[key] = obj[key].map((o: any) => {
          if (typeof o == "object") return cleanEmptyKey(o);
          else return o;
        });
      } else prv[key] = cleanEmptyKey(obj[key]);
    } else prv[key] = obj[key];
    return prv;
  }, {});
  return cleanedObj;
}