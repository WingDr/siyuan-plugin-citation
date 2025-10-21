-- smart-math.lua: 智能处理 LaTeX 数学环境的 Pandoc 过滤器
-- 版本 3.0: 修正了 LaTeX 导出时因返回类型错误而导致的崩溃问题

-- 定义需要特殊处理的 LaTeX 顶层环境
local top_level_envs = {
  ["align"] = true, ["align*"] = true,
  ["gather"] = true, ["gather*"] = true,
  ["flalign"] = true, ["flalign*"] = true,
  ["alignat"] = true, ["alignat*"] = true,
  ["multline"] = true, ["multline*"] = true,
  ["equation"] = true, ["equation*"] = true
}

-- 定义顶层环境到内部环境的映射 (用于 Word 输出)
local to_inner_map = {
  ["align"] = "aligned", ["align*"] = "aligned",
  ["gather"] = "gathered", ["gather*"] = "gathered",
  ["alignat"] = "alignedat", ["alignat*"] = "alignedat",
  ["equation"] = "aligned", ["equation*"] = "aligned",
}

-- 过滤器函数 1: 处理所有 Math 元素 (行内和块级)
-- 主要职责: 将老旧的 {\rm ...} 转换为标准的 \mathrm{...}
-- This function runs on every math element, both inline and display.
function Math(m)
  m.text = m.text:gsub("{\\rm%s*(.-)}", "\\mathrm{%1}")
  return m -- 返回修改后的 Math (Inline) 元素
end

-- 过滤器函数 2: 处理段落 (Paragraph) 块
-- 主要职责: 处理包含顶层环境的块级公式，根据输出格式进行转换
-- This function runs on every paragraph block.
function Para(p)
  -- 检查段落是否只包含一个元素，且该元素是 DisplayMath 类型的 Math 元素
  if #p.content == 1 and p.content[1].t == 'Math' and p.content[1].mathtype == 'DisplayMath' then
    local math_elem = p.content[1]
    -- 注意: 此时 math_elem.text 中的 {\rm} 已经被上面的 Math() 函数处理过了
    local content = math_elem.text:match("^%s*(.*%S)") or ""
    local env_name = content:match("^\\begin%{(.-)%}")

    -- 如果匹配到顶层环境
    if env_name and top_level_envs[env_name] then
      -- 目标是 Word: 转换为内部环境
      if FORMAT:match 'docx' then
        local inner_env = to_inner_map[env_name]
        if inner_env then
          local new_content = content:gsub("(\\begin%{" .. env_name .. "%})", "\\begin{" .. inner_env .. "}")
          new_content = new_content:gsub("(\\end%{" .. env_name .. "%})", "\\end{" .. inner_env .. "}")
          math_elem.text = new_content
          -- 返回被修改的整个段落块 (p)
          return p
        end
      -- 目标是 LaTeX/PDF: 将整个段落块替换为原生 LaTeX 块
      elseif FORMAT:match 'latex' or FORMAT == 'pdf' then
        -- 这里返回一个 Block 元素是正确的，因为它会替换掉原来的 Para (Block) 元素
        return pandoc.RawBlock('latex', content)
      end
    end
  end
  -- 如果不满足上述条件，不进行任何操作
  return nil
end

-- 返回一个过滤器列表，Pandoc 会按顺序应用它们
return {
  { Math = Math },
  { Para = Para }
}