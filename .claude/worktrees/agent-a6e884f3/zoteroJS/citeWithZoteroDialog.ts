//@ts-nocheck
/* eslint-disable max-classes-per-file */
var is7 = (typeof location !== 'undefined' && location.search) ? ((new URLSearchParams(location.search)).get('is7') === 'true') : Zotero.platformMajorVersion >= 102;

class FieldEnumerator {
  // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle,id-blacklist,id-match
  
  constructor(doc) {
    this.doc = doc;
    this.idx = 0;
    this.QueryInterface = (is7 ? ChromeUtils : XPCOMUtils).generateQI([Components.interfaces.nsISupports, Components.interfaces.nsISimpleEnumerator]);
  }

  hasMoreElements() { return this.idx < this.doc.fields.length; }
  getNext() { return this.doc.fields[this.idx++]; }

}

/**
 * The Field class corresponds to a field containing an individual citation
 * or bibliography
 */
class Field {

  constructor(doc) {
    this.doc = doc;
    this.code = "";
    this.text = "{Placeholder}";
    this.wrappedJSObject = this;
    this.noteIndex = 0;
  }

   delete() { this.doc.fields.filter(field => field !== this); }

   removeCode() { this.code = ""; }

   select() { return 0; }

   setText(text, isRich) {
    this.text = text;
    this.isRich = isRich;
  }

   getText() { return this.text; }

   setCode(code) { this.code = code; }

   getCode() { return this.code; }

   equals(field) { return this === field; }

   getNoteIndex() { return 0; }
}

/**
 * The Document class corresponds to a single word processing document.
 */
class Document {

  constructor(docId, options) {
    this.id = docId;
    this.fields = [];

    options.style = options.style || "apa";
    var style = Zotero.Styles.get(`http://www.zotero.org/styles/${options.style}`) || Zotero.Styles.get(`http://juris-m.github.io/styles/${options.style}`) || Zotero.Styles.get(options.style);
    options.style = style ? style.url : "http://www.zotero.org/styles/apa";

    var data = new Zotero.Integration.DocumentData();
    data.prefs = {
      noteType: 0,
      fieldType: "Field",
      automaticJournalAbbreviations: true,
    };
    data.style = {styleID: options.style, locale: "en-US", hasBibliography: true, bibliographyStyleHasBeenSet: true};
    data.sessionID = Zotero.Utilities.randomString(10); // eslint-disable-line no-magic-numbers
    this.data = data.serialize();
  }

   displayAlert(_dialogText, _icon, _buttons) { return 0; }

   activate() { return 0; }

   canInsertField(_fieldType) { return true; }

   cursorInField(_fieldType) { return false; }


   getDocumentData() { return this.data; }

   setDocumentData(data) { this.data = data; }

   insertField(fieldType, noteType) {
    if (typeof noteType !== "number") {
      throw new Error("noteType must be an integer");
    }
    var field = new Field(this);
    this.fields.push(field);
    return field;
  }

   getFields(_fieldType) { return new FieldEnumerator(this); }

   getFieldsAsync(fieldType, observer) {
    observer.observe(this.getFields(fieldType), "fields-available", null);
  }

   setBibliographyStyle(_firstLineIndent, _bodyIndent, _lineSpacing, _entrySpacing, _tabStops, _tabStopsCount) { return 0; }

   convert(_fields, _toFieldType, _toNoteType, _count) { return 0; }

   cleanup() { return 0; }

   complete() { return 0; }

   citation() {
    if (!this.fields[0] || !this.fields[0].code || !this.fields[0].code.startsWith("ITEM CSL_CITATION ")) return [];

    var citationItems = JSON.parse(this.fields[0].code.replace(/ITEM CSL_CITATION /, "")).citationItems;
    
    var items = (citationItems.map(item => {
      var zoteroItem = Zotero.Items.get(item.id);
      return {
      id: item.id,
      key: zoteroItem.key,
      libraryID: zoteroItem.libraryID,
      locator: item.locator || "",
      suppressAuthor: !!item["suppress-author"],
      prefix: item.prefix || "",
      suffix: item.suffix || "",
      label: item.locator ? (item.label || "page") : "",
      citekey: Zotero.BetterBibTeX?.KeyManager.get(item.id).citekey,

      uri: Array.isArray(item.uri) ? item.uri[0] : undefined,
      itemType: item.itemData ? item.itemData.type : undefined,
      title: item.itemData ? item.itemData.title : undefined,
    }}));
    return items;
  }
}

// export singleton: https://k94n.com/es6-modules-single-instance-pattern
var application = new class { 
  constructor() {
    this.primaryFieldType = "Field";
    this.secondaryFieldType = "Bookmark";
    this.fields = [];
    this.docs = {};
  }

   getActiveDocument() { return this.docs[this.active]; }

   async getDocument(id) { 
    return this.docs[id];
  }

   QueryInterface() { return this; }

   createDocument(options) {
    this.active = `citation-for-siyuan-cayw-${Zotero.Utilities.generateObjectKey()}`;
    this.docs[this.active] = new Document(this.active, options);
    return this.docs[this.active];
  }

   closeDocument(doc) {
    delete this.docs[doc.id];
  }
};

var document, session, documentImported;
var agent = "Citation for SiYuan";
var command = "addEditCitation";
var options = {
  format: "translate",
  translator: "36a3b0b5-bad0-4a04-b79b-441c7cef77db",
  exportNotes: true
};
var doc = application.createDocument(options);
var docId = doc.id;

Zotero.Integration.currentDoc = true;

var startTime = (new Date()).getTime();

try {
  Zotero.debug(`Integration: ${agent}-${command}${docId ? `:'${docId}'` : ""} invoked`);
  var documentPromise = (application.getDocument && docId ? application.getDocument(docId) : application.getActiveDocument());
  Zotero.Integration.currentDoc = document = await documentPromise;
        
  [session, documentImported] = await Zotero.Integration.getSession(application, document, agent, false);
  Zotero.Integration.currentSession = session;
  if (!documentImported) {
    await (new Zotero.Integration.Interface(application, document, session))[command]();
  }
  await document.setDocumentData(session.data.serialize());
}
catch (e) {
  if (!(e instanceof Zotero.Exception.UserCancelled)) {
    await Zotero.Integration._handleCommandError(document, session, e);
  }
  else {
    if (session) {
      // If user cancels we should still write the currently assigned session ID
      try {
        await document.setDocumentData(session.data.serialize());
        // And any citations marked for processing (like retraction warning ignore flag changes)
        if (Object.keys(session.processIndices).length) {
          session.updateDocument(FORCE_CITATIONS_FALSE, false, false);
        }
      // Since user cancelled we can ignore if processor fails here.
      } catch(e) {}
    }
  }
}
finally {
  var diff = ((new Date()).getTime() - startTime)/1000;
  Zotero.debug(`Integration: ${agent}-${command}${docId ? `:'${docId}'` : ""} complete in ${diff}s`);
  if (document) {
    try {
      await document.cleanup();
      await document.activate();
      
      // Call complete function if one exists
      if (document.wrappedJSObject && document.wrappedJSObject.complete) {
        document.wrappedJSObject.complete();
      } else if (document.complete) {
        await document.complete();
      }
    } catch(e) {
      Zotero.logError(e);
    }
  }

  if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
    var oldWindow = Zotero.Integration.currentWindow;
    Zotero.Promise.delay(100).then(function() {
      oldWindow.close();
    });
  }

  if (Zotero.Integration.currentSession && Zotero.Integration.currentSession.progressBar) {
    Zotero.Promise.delay(5).then(function() {
      Zotero.Integration.currentSession.progressBar.hide();
    });
  }
  Zotero.Integration.currentDoc = Zotero.Integration.currentWindow = false;
}

var picked = doc.citation();
application.closeDocument(doc);
return JSON.stringify(picked);
