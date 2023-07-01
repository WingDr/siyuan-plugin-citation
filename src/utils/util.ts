import SiYuanPluginCitation from "../index";
import {
  Library,
  loadEntries,
  Entry,
  EntryData,
  EntryBibLaTeXAdapter,
  EntryCSLAdapter,
  IIndexable
} from "../library";
import { 
  dataDir,
  isDev,
  REF_DIR_PATH,
  STORAGE_NAME
} from "./constants";
import { createLogger } from "./simple-logger";
import { createNoticer } from "./noticer";
const fs = window.require("fs");
const path = window.require("path");

export const DISALLOWED_FILENAME_CHARACTERS_RE = /[*"\\/<>:|?]/g;

/**
 * Reading the given directory and 
 * search all the .json and .bib file
 */
export async function fileSearch(dirPath: string): Promise<string[]> {
  const absPluginPath = path.resolve(dataDir, "./plugins/siyuan-plugin-citation/");
  const absDirPath = path.join(absPluginPath, dirPath);
  const files = await fsReadDir(absDirPath);
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
      return fileSearch(datas.files[datas.stats.indexOf(fileStat)]);
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

export async function loadLibrary(plugin: SiYuanPluginCitation): Promise<Library> {
  const logger = createLogger("load library");
  const noticer = createNoticer();
  const files = await fileSearch(REF_DIR_PATH);
  const fs = window.require("fs");
  const fileContents = files.map(filePath => {
      return fs.readFileSync(filePath, "utf-8");
  });
  if (isDev) logger.info("本地文献文件检索，数量=>", fileContents.length);
  plugin.library = null;
  const promises = files.map(filePath => {
      const sName = filePath.split(".");
      const type = sName[sName.length - 1];
      if (type == "json") {
          return {
              entries: loadEntries(
                  fileContents[files.indexOf(filePath)],
                  "csl-json"),
              type: "csl-json"
          };
      } else if (type == "bib") {
          return {
              entries: loadEntries(
                  fileContents[files.indexOf(filePath)],
                  "biblatex"),
              type: "biblatex"
          };
      }
  });
  return Promise.all(promises).then((res) => {
      let adapter: new (data: EntryData) => Entry;
      let idKey: string;

      const entries: any[] = [];
      res.forEach(fileEntries => {
          entries.push(...fileEntries.entries.map((e) => {
              switch (fileEntries.type) {
                  case "biblatex":
                    adapter = EntryBibLaTeXAdapter;
                    idKey = "key";
                    break;
                  case "csl-json":
                    adapter = EntryCSLAdapter;
                    idKey = "id";
                    break;
                }
              return [(e as IIndexable)[idKey], new adapter(e)];
          }));
      });
      const library = new Library(
          Object.fromEntries(
              entries
          ),
      );
      return library;
  }).then(library => {
    if (isDev) logger.info("成功载入文献库，数量=>", library.size);
    noticer.info(`Successfully loaded library with ${library.size} entries.`);
    plugin.library = library;
    return library;
  }).catch((e) => {
    if (isDev) logger.error("载入文献库失败，错误信息=>", e);
    noticer.error(e);
    return null;
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
      (res.data as any[]).forEach(file => {
          plugin.id2ckDict[file.id] = file.content;
          plugin.ck2idDict[file.content] = file.id;
      });
      offset += limit;
  }
  if (isDev) logger.info("成功载入引用，id2ckDict=>", plugin.id2ckDict);
  if (isDev) logger.info("成功载入引用，ck2idDict=>", plugin.ck2idDict);
  noticer.info(`Successfully loaded references with ${Object.keys(plugin.id2ckDict).length} files.`);
  return plugin.id2ckDict, plugin.ck2idDict;
}

export function generateFileLinks(files: string[]) {
  console.log(files);
  return files.map(file => {
    const fileName = file.split("\\").slice(-1)[0];
    return `[${fileName}]` + "\(file://" + file.replace(/\\(.?)/g, (m, p1) => p1) + "\)";
  }).join("\n");
}

export function generateFromTemplate(template: string, params: object) {
  const reg = /\{\{(.*?)\}\}/g;
  return template.replace(reg, (match, pname) => {
    return params[pname] ?? "";
  });
}