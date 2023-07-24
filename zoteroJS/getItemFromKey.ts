// @ts-nocheck 
/* eslint-disable */
var item = await Zotero.Items.getByLibraryAndKeyAsync(library, key);

function getAllFields(item) {
  // 获得fields
  let fieldDetail = {};
  var fields = item.getUsedFields(true);
  for (let fieldName of fields) {
    fieldDetail[fieldName] = item.getField(fieldName);
  }
  return fieldDetail;
}

// 获得fields
var itemFields = getAllFields(item);

// 获得notes
var noteIDs = item.getNotes();
let notes = [];
for (let noteID of noteIDs) {
  notes.push(Zotero.Items.get(noteID).getNote());
}

// 获得attachments和annotations
var attachmentIDs = item.getAttachments();
let attachments = [];
let annotations = [];
for (let attachmentID of attachmentIDs) {
  var attachment = Zotero.Items.get(attachmentID);
  var attachDetail = {
    path: await attachment.getFilePathAsync(),
    key: attachment.key,
    title: attachment.getField("title"),
    select: 'zotero://select/library/items/' + attachment.key,
    ...getAllFields(attachment)
  }
  attachments.push(attachDetail);
  var annoItems = attachment.getAnnotations();
  if (annoItems.length) {
    var annoDetail = {
      parentKey: attachDetail.key,
      parentTitle: attachDetail.title,
      details: []
    }
    for (let annoItem of annoItems) {
      annoDetail.details.push({
        key: annoItem.key,
        annotationText: annoItem.annotationText,
        annotationPosition: JSON.parse(annoItem.annotationPosition),
        ...getAllFields(annoItem)
      })
    }
    annotations.push(annoDetail);
  }
}

// 输出结果
return JSON.stringify({
  notes,
  annotations,
  attachments,
  ...itemFields
});