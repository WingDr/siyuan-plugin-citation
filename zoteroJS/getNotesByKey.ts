// @ts-nocheck 
/* eslint-disable */
var library = Zotero.Libraries.userLibraryID;
var item = await Zotero.Items.getByLibraryAndKeyAsync(library, key);

// 获得notes
var noteIDs = item.getNotes();
let notes = [];
for (let noteID of noteIDs) {
  notes.push(Zotero.Items.get(noteID).getNote());
}

// 输出结果
return JSON.stringify(notes);