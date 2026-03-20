// @ts-nocheck 
/* eslint-disable */
var item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);

function _translate(items, format, callback) {
	let translation = new Zotero.Translate.Export();
	translation.setItems(items.slice());
	translation.setTranslator(format.id);
	if (format.options) {
		translation.setDisplayOptions(format.options);
	}
	translation.setHandler("done", callback);
	translation.translate();
}

let markdownFormat = { mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN, options: {exportNotes: true} };

return await new Promise((resolve, reject) => {
    _translate([item], markdownFormat, (obj, worked) => {
        resolve(obj.string.replace(/\r\n/g, '\n'))
    })
})