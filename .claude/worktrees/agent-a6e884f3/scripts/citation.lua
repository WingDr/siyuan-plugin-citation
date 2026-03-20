function Str(el)
    local text = el.text

    -- Siyuan 引用处理
    local cite_pattern = "@siyuan_cite{([^}]+)}"
    local name_pattern = "@siyuan_name{([^}]+)}"
    if text:match(cite_pattern) then
        if text:match(name_pattern) then
            print(text)
            local cite_match = text:match(cite_pattern)
            -- 用逗号分割id，添加上前后缀，然后再用逗号拼接
            local ids = {}
            for id in string.gmatch(cite_match, "[^,]+") do
                table.insert(ids, '{"id":' .. id .. '}')
            end
            local cite_result = table.concat(ids, ",")
            print(cite_result)
            local name_match = text:match(name_pattern)
            return pandoc.RawInline("openxml", '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">ADDIN ZOTERO_ITEM CSL_CITATION {"citationItems":['.. cite_result .. ']}</w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>' .. name_match .. '</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>')
        end
    end

    -- 高亮语法处理
    local parts = {}
    local last_end = 1
    for start_pos, match, end_pos in text:gmatch("()==([^=]+)==()") do
        if start_pos > last_end then
        table.insert(parts, pandoc.Str(text:sub(last_end, start_pos - 1)))
        end
        -- 真正的 Word 高亮 run
        table.insert(parts,
        pandoc.RawInline("openxml",
            '<w:r>'
            .. '<w:rPr><w:highlight w:val="yellow"/></w:rPr>'
            .. '<w:t>' .. match .. '</w:t>'
            .. '</w:r>'
        )
        )
        last_end = end_pos
    end

    if last_end <= #text then
        table.insert(parts, pandoc.Str(text:sub(last_end)))
    end

    if #parts > 0 then
        return parts
    end

    -- 默认返回原始文本
    return el
end


-- 将 Raw HTML 的 <sup>/<sub>/<u> 成对标签转成 Pandoc 内联节点
-- 使 docx 输出得到 Word 原生的上下标与下划线

local function is_raw_html(el)
  return el.t == "RawInline" and type(el.format) == "string"
         and el.format:match("^html")
end

-- 更宽容地匹配开/闭标签（允许空格与属性）
local function is_open_tag(el, tag)
  return is_raw_html(el)
     and el.text:match("^%s*<%s*" .. tag .. "%f[%s/>][^>]*>%s*$")
end

local function is_close_tag(el, tag)
  return is_raw_html(el)
     and el.text:match("^%s*</%s*" .. tag .. "%s*>%s*$")
end

-- 递归转换函数：扫描并成对收集，再包成目标内联节点
local function convert_inlines(inlines)
  local out = {}
  local i = 1
  while i <= #inlines do
    local el = inlines[i]

    local function consume_pair(tag, ctor) -- ctor: 函数(buf)->Inline
      local buf = {}
      local j = i + 1
      local found = false
      while j <= #inlines do
        local e2 = inlines[j]
        if is_close_tag(e2, tag) then
          found = true
          break
        end
        table.insert(buf, e2)
        j = j + 1
      end
      if found then
        -- 递归处理内部，支持嵌套
        buf = convert_inlines(buf)
        table.insert(out, ctor(buf))
        return j + 1
      else
        -- 没找到闭合，原样输出开标签并前进一位
        table.insert(out, el)
        return i + 1
      end
    end

    if is_open_tag(el, "sup") then
      i = consume_pair("sup", pandoc.Superscript)

    elseif is_open_tag(el, "sub") then
      i = consume_pair("sub", pandoc.Subscript)

    elseif is_open_tag(el, "u") then
      -- 优先用原生 Underline；若旧版 pandoc 无该构造器，则降级为 Span class="underline"
      local function mk_underline(buf)
        if pandoc.Underline then
          return pandoc.Underline(buf)
        else
          return pandoc.Span(buf, {class = "underline"})
        end
      end
      i = consume_pair("u", mk_underline)

    else
      table.insert(out, el)
      i = i + 1
    end
  end
  return out
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
    { Str = Str },
    { Inlines = convert_inlines },
    { Para = Para },
    { Figure = Figure }
}
