// @ts-nocheck 
/* eslint-disable */
var s = new Zotero.Search();
s.libraryID = Zotero.Libraries.userLibraryID;
s.addCondition('noChildren', 'true');
s.addCondition('recursive', 'true');
s.addCondition('joinMode', 'any');
s.addCondition("itemType", "isNot", "note");
s.addCondition("itemType", "isNot", "attachment");
s.addCondition("itemType", "isNot", "annotation");
var ids = await s.search();
let Result = [];
for (let id of ids) {
  var item = Zotero.Items.get(id)
  Result.push({
    key: item.key,
    creators: item.getCreators(),
    date: item.date,
    title: item.title
  });
}
return JSON.stringify(Result);

