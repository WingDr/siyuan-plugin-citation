// @ts-nocheck 
/* eslint-disable */
var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);

var notItemType = ["attachment", "annotation"]

if (!item || (notItemType.indexOf(item.itemType) != -1)) return JSON.stringify({ itemKey: key, itemKeyExist: false })
else return JSON.stringify({ itemKey: key, itemKeyExist: true })