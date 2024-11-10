import SiYuanPluginCitation from "../index";
import { STORAGE_NAME, defaultUserDataTile } from "./constants";

// 专门负责处理更新事务的函数
export async function changeUpdate(plugin: SiYuanPluginCitation) {
  await updateDatabaseType(plugin);
  await updateUserDataTitle(plugin);
  await updateLinkTemplatesGroup(plugin);
}

async function updateDatabaseType(plugin: SiYuanPluginCitation) {
  let data_change = false;
  if (plugin.data[STORAGE_NAME].databaseType == "Zotero") {
    plugin.data[STORAGE_NAME].databaseType = "Zotero (better-bibtex)";
    data_change = true;
  } else if (plugin.data[STORAGE_NAME].databaseType == "Juris-M") {
    plugin.data[STORAGE_NAME].databaseType = "Juris-M (better-bibtex)";
    data_change = true;
  }
  if (data_change) await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}

async function updateUserDataTitle(plugin: SiYuanPluginCitation) {
  let data_change = false;
  if (!plugin.data[STORAGE_NAME].userDataTitle) {
    plugin.data[STORAGE_NAME].userDataTitle = defaultUserDataTile;
    data_change = true;
  }
  if (data_change) await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}

async function updateLinkTemplatesGroup(plugin:SiYuanPluginCitation) {
  let data_change = false;
  if (!plugin.data[STORAGE_NAME].linkTemplatesGroup.length) {
    plugin.data[STORAGE_NAME].linkTemplatesGroup = [{
      name: "default",
      ...plugin.data[STORAGE_NAME]
    }];
    data_change = true;
  }
  if (data_change) await plugin.saveData(STORAGE_NAME, plugin.data[STORAGE_NAME]);
}