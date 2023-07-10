// @ts-nocheck 
/* eslint-disable */
var selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
var resItems = [];
selectedItems.forEach(item => {
  resItems.push(Zotero.Items.get(item.id));
})
return JSON.stringify(resItems);