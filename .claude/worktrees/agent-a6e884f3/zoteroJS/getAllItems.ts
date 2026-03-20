// @ts-nocheck 
/* eslint-disable */
let Result = [];
var s = new Zotero.Search();
s.libraryID = Zotero.Libraries.userLibraryID;
s.addCondition('noChildren', 'true');
s.addCondition('recursive', 'true');
s.addCondition('joinMode', 'any');
s.addCondition("itemType", "isNot", "note", true);
s.addCondition("itemType", "isNot", "attachment", true);
s.addCondition("itemType", "isNot", "annotation", true);
var ids = await s.search();

for (let id of ids) {
  var item = Zotero.Items.get(id)
  Result.push({
    libraryID: item.libraryID,
    itemKey: item.key,
    citationKey: item.getField("citationKey"),
    creators: item.getCreatorsJSON(),
    year: item.getField("year"),
    title: item.getField("title"),
  });
}

return JSON.stringify(Result);