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

// 获得notes
var noteIDs = item.getNotes();
let notes = [];
for (let noteID of noteIDs) {
  var noteItem = Zotero.Items.get(noteID);
  notes.push({
    note: noteItem.getNote(),
    ...getAllFields(noteItem),
    key: noteItem.key,
    itemType: noteItem.itemType
  });
}

// 输出结果
return JSON.stringify(notes);