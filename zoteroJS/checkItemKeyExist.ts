// @ts-nocheck 
/* eslint-disable */
var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);

if (!item) return JSON.stringify({ itemKey: key, itemKeyExist: false })
else return JSON.stringify({ itemKey: key, itemKeyExist: true })