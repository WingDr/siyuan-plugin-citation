// @ts-nocheck 
/* eslint-disable */
var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
var resItems = [];
selectedItems.forEach(item => {
  var item = Zotero.Items.get(item.id);
  resItems.push(item.libraryID + "_" + item.key);
})
return JSON.stringify(resItems);