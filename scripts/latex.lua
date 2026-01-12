-- save as: custom-latex.lua

-- 辅助函数：URL 解码
-- 将 %7B 转换回 {，将 %5C 转换回 \ 等
local function url_decode(str)
  return str:gsub("%%(%x%x)", function(h)
    return string.char(tonumber(h, 16))
  end)
end

function Link(el)
  -- 1. 处理自定义链接: [text](latex:\code)
  if el.target:match("^latex:") then
    -- 提取前缀之后的内容
    local raw_content = el.target:gsub("^latex:%s*", "")
    
    -- 【关键修复】进行 URL 解码
    -- Pandoc 会自动将链接中的 { } \ 等字符编码为 %7B %7D %5C
    -- 我们必须将其还原，否则 LaTeX 无法正确识别
    raw_content = url_decode(raw_content)
    
    -- 返回原生 LaTeX 代码
    return pandoc.RawInline('latex', raw_content)
  end
end

function BlockQuote(el)
  -- 2. 处理自定义引述块: > [!TYPE] ...
  
  -- 获取引用块的第一个块元素
  local first_block = el.content[1]
  
  if not first_block or first_block.t ~= "Para" then return nil end
  
  -- 转换为字符串进行匹配
  local first_block_text = pandoc.utils.stringify(first_block)
  
  -- 匹配 [!TYPE]
  local type_name = first_block_text:match("^%[!([%w%-]+)%]")
  
  if type_name then
    local env_name = type_name:lower()
    local new_inlines = pandoc.List()
    local found_newline = false
    
    -- 移除第一行 (Type 定义行)
    for _, inline in ipairs(first_block.content) do
      if found_newline then
        new_inlines:insert(inline)
      else
        if inline.t == "SoftBreak" or inline.t == "LineBreak" then
          found_newline = true
        end
      end
    end
    
    local new_blocks = pandoc.List()
    
    -- 包裹环境 \begin{...}
    new_blocks:insert(pandoc.RawBlock('latex', '\\begin{' .. env_name .. '}'))
    
    -- 插入修正后的第一段
    if #new_inlines > 0 then
      new_blocks:insert(pandoc.Para(new_inlines))
    end
    
    -- 插入剩余段落
    for i = 2, #el.content do
      new_blocks:insert(el.content[i])
    end
    
    -- 包裹环境 \end{...}
    new_blocks:insert(pandoc.RawBlock('latex', '\\end{' .. env_name .. '}'))
    
    return new_blocks
  end
end