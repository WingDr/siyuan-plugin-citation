// @ts-nocheck 
/* eslint-disable */
var s = new Zotero.Search();
s.libraryID = Zotero.Libraries.userLibraryID;
s.addCondition('noChildren', 'true');
s.addCondition('recursive', 'true');
s.addCondition('joinMode', 'any');
s.addCondition('itemType', 'is', '')
var ids = await s.search();
let Result = [];
for (let id of ids) {
  Result.push(Zotero.Items.get(id).getField('title') + " | " + Zotero.Items.get(id).key);
}
return Result.join("\r\n");