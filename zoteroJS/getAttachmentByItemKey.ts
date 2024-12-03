// @ts-nocheck 
/* eslint-disable */
var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);

function getAllFields(item) {
  // 获得fields
  let fieldDetail = {};
  let fields = Object.keys(item);
  const fieldIgnored = [
    "_ObjectsClass", "_ObjectType", "_objectTypePlural", "_ObjectTypePlural",
    "_synced", "_deleted", "_inCache", "_loaded", "_skipDataTypeLoad", "_changed",
    "_previousData", "_changedData", "_dataTypesToReload", "_disabled", "_creators",
    "_itemData", "_annotationPosition", "_attachments"
  ]
  for (let fieldName of fields) {
    if (fieldIgnored.indexOf(fieldName) == -1) fieldDetail[fieldName.slice(1)] = item[fieldName];
  }
  fields = item.getUsedFields(true);
  for (let fieldName of fields) {
    fieldDetail[fieldName] = item.getField(fieldName);
  }
  return fieldDetail;
}

// 获得attachment
let res = {
    key: item.key,
    itemType: item.itemType,
    ...getAllFields(item),
    path: await item.getFilePathAsync(),
    select: 'zotero://select/library/items/' + item.key,
}

// 输出结果
return JSON.stringify(res);