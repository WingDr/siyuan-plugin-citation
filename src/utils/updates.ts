import SiYuanPluginCitation from "../index";
import { STORAGE_NAME } from "./constants";

// 专门负责处理更新事务的函数
export async function changeUpdate(plugin: SiYuanPluginCitation) {
  await updateDatabaseType(plugin);
}

async function updateDatabaseType(plugin: SiYuanPluginCitation) {
  if (plugin.data[STORAGE_NAME].databaseType == "Zotero") {
    plugin.data[STORAGE_NAME].databaseType = "Zotero (better-bibtex)";
  } else if (plugin.data[STORAGE_NAME].databaseType == "Juris-M") {
    plugin.data[STORAGE_NAME].databaseType = "Juris-M (better-bibtex)";
  }
  await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}