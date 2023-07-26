// @ts-nocheck 
/* eslint-disable */
var library = Zotero.Libraries.userLibraryID;
var item = await Zotero.Items.getByLibraryAndKeyAsync(library, key);

if (!item) return JSON.stringify({ itemKey: key, itemKeyExist: false })
else return JSON.stringify({ itemKey: key, itemKeyExist: true })