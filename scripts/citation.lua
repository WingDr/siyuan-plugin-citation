function Citation(el)
    local cite_pattern = "@siyuan_cite{([^}]+)}"
    local name_pattern = "@siyuan_name{([^}]+)}"
    if el.text:match(cite_pattern) then
        if el.text:match(name_pattern) then
            print(el.text)
            local cite_match = el.text:match(cite_pattern)
            local name_match = el.text:match(name_pattern)
            return pandoc.RawInline("openxml", '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">ADDIN ZOTERO_ITEM CSL_CITATION {"citationItems":[{"id":'.. cite_match .. '}]}</w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>' .. name_match .. '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>')
        end
    end
end

return {
    { Str = Citation }
}