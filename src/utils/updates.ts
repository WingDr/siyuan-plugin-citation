import SiYuanPluginCitation from "../index";
import { STORAGE_NAME, defaultUserDataTile } from "./constants";

// 专门负责处理更新事务的函数
export async function changeUpdate(plugin: SiYuanPluginCitation) {
  await updateDatabaseType(plugin);
  await updateUserDataTitle(plugin);
}

async function updateDatabaseType(plugin: SiYuanPluginCitation) {
  if (plugin.data[STORAGE_NAME].databaseType == "Zotero") {
    plugin.data[STORAGE_NAME].databaseType = "Zotero (better-bibtex)";
  } else if (plugin.data[STORAGE_NAME].databaseType == "Juris-M") {
    plugin.data[STORAGE_NAME].databaseType = "Juris-M (better-bibtex)";
  }
  await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}

async function updateUserDataTitle(plugin: SiYuanPluginCitation) {
  if (!plugin.data[STORAGE_NAME].userDataTitle) {
    plugin.data[STORAGE_NAME].userDataTitle = defaultUserDataTile;
  }
  await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}