function Citation(el)
    local cite_pattern = "@siyuan_cite{([^}]+)}"
    local name_pattern = "@siyuan_name{([^}]+)}"
    if el.text:match(cite_pattern) then
        if el.text:match(name_pattern) then
            print(el.text)
            local cite_match = el.text:match(cite_pattern)
            -- 用逗号分割id，添加上前后缀，然后再用逗号拼接
            local ids = {}
            for id in string.gmatch(cite_match, "[^,]+") do
                table.insert(ids, '{"id":' .. id .. '}')
            end
            local cite_result = table.concat(ids, ",")
            print(cite_result)
            local name_match = el.text:match(name_pattern)
            return pandoc.RawInline("openxml", '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">ADDIN ZOTERO_ITEM CSL_CITATION {"citationItems":['.. cite_result .. ']}</w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>' .. name_match .. '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>')
        end
    end
end

return {
    { Str = Citation }
}