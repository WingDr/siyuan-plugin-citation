// @ts-nocheck 
/* eslint-disable */
var s = new Zotero.Search();
s.libraryID = Zotero.Libraries.userLibraryID;
s.addCondition('noChildren', 'true');
s.addCondition('recursive', 'true');
s.addCondition('joinMode', 'any');
var ids = await s.search();
let Result = [];
for (let id of ids) {
  var item = Zotero.Items.get(id)
  if (!item.isNote() && !item.isAnnotation() && !item.isAttachment()) Result.push(item);
}
return JSON.stringify(Result);

