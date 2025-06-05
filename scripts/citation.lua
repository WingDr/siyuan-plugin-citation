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


-- image-title-to-caption.lua
-- Pandoc Lua过滤器，将图片标题设置为caption，并在只有alt文本时确保无caption

-- 创建caption的函数
function create_caption(text)
    if text:find("^%s*$") then
        return {}
    else
        return {pandoc.Str(text)}
    end
end

-- 处理Para块
function Para(para)
    -- 检查段落是否只包含一个图片
    if #para.content == 1 and para.content[1].t == "Image" then
        local img = para.content[1]
        -- 如果图片有标题，将其包装为Figure并将标题设为caption
        if img.title and img.title ~= "" then
            local content = {pandoc.Plain({img})}
            local caption = create_caption(img.title)
            return pandoc.Figure(content, caption)
        else
            -- 如果只有alt文本（无标题），确保不生成caption
            img.caption = {}
            return pandoc.Para({img})
        end
    end
    -- 如果不是单独的图片，返回未更改的段落
    return para
end

-- 处理Figure块
function Figure(fig)
    -- 查找Figure中的图片
    for i, block in ipairs(fig.content) do
        if block.t == "Plain" then
            for j, inline in ipairs(block.content) do
                if inline.t == "Image" then
                    local img = inline
                    -- 如果图片有标题，将其设为Figure的caption
                    if img.title and img.title ~= "" then
                        fig.caption = create_caption(img.title)
                    else
                        -- 如果无标题，确保Figure无caption
                        fig.caption = {}
                    end
                end
            end
        end
    end
    return fig
end

-- 返回过滤器

return {
    { Str = Citation },
    { Para = Para },
    { Figure = Figure }
}
