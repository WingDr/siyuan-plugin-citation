// @ts-nocheck 
/* eslint-disable */
var targetItem = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);

if (!targetItem) return {
  itemExist: false
}

// 获得attachments和annotations
var attachmentIDs = targetItem.getAttachments();
let existAttachID = 0;
for (let attachmentID of attachmentIDs) {
  var attachment = Zotero.Items.get(attachmentID);
  var attachURL = attachment.getField("url");
  if (attachURL === url) {
    existAttachID = attachmentID;
  }
}

if (existAttachID) {
  var attachment = Zotero.Items.get(existAttachID);
  attachment.setField("title", title);
  return JSON.stringify({result: await attachment.saveTx()});
} else {
  var itemData = {
    url,
    parentItemID: targetItem.id,
    title,
  };
  return JSON.stringify({result: await Zotero.Attachments.linkFromURL(itemData)});
}
