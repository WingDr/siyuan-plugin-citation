-- smart-math.lua: 智能处理 LaTeX 数学环境的 Pandoc 过滤器
-- 版本 4.0: 
-- 1. 修正了 LaTeX 导出时因返回类型错误而导致的崩溃问题。
-- 2. 新增 {\rm ...} 到 \mathrm{...} 的自动转换。
-- 3. 新增 LaTeX 输出时，将行内公式转为 $...$ 形式。
-- 4. 新增 LaTeX 输出时，将普通块级公式转为 \begin{equation}...\end{equation} 形式。

-- 定义需要特殊处理的 LaTeX 顶层环境
local top_level_envs = {
  ["align"] = true, ["align*"] = true,
  ["gather"] = true, ["gather*"] = true,
  ["flalign"] = true, ["flalign*"] = true,
  ["alignat"] = true, ["alignat*"] = true,
  ["multline"] = true, ["multline*"] = true,
  ["equation"] = true, ["equation*"] = true -- 将 equation 也视为顶层，以便直接输出
}

-- 定义顶层环境到内部环境的映射 (用于 Word 输出)
local to_inner_map = {
  ["align"] = "aligned", ["align*"] = "aligned",
  ["gather"] = "gathered", ["gather*"] = "gathered",
  ["alignat"] = "alignedat", ["alignat*"] = "alignedat",
  ["equation"] = "aligned", ["equation*"] = "aligned",
}

-- 过滤器函数 1: 处理所有 Math 元素
function Math(m)
  -- 步骤 1: 通用清理，将 {\rm} 替换为 \mathrm
  m.text = m.text:gsub("{\\rm%s*(.-)}", "\\mathrm{%1}")

  -- 步骤 2: 仅在导出 LaTeX/PDF 时，处理行内公式
  if (FORMAT:match 'latex' or FORMAT == 'pdf') and m.mathtype == 'InlineMath' then
    -- 将行内公式对象替换为一个原生的 LaTeX RawInline 对象
    -- 这会阻止 Pandoc 使用默认的 \(...\)
    return pandoc.RawInline('latex', '$' .. m.text .. '$')
  end
  
  -- 对于其他情况 (Word 输出，或块级公式)，返回修改后的 Math 对象
  return m
end

-- 过滤器函数 2: 处理段落块
function Para(p)
  -- 检查段落是否是一个块级公式 (只包含一个 DisplayMath 元素)
  if #p.content == 1 and p.content[1].t == 'Math' and p.content[1].mathtype == 'DisplayMath' then
    local math_elem = p.content[1]
    local content = math_elem.text:match("^%s*(.*%S)") or ""
    local env_name = content:match("^\\begin%{(.-)%}")

    -- 检查是否匹配到我们定义的顶层环境
    if env_name and top_level_envs[env_name] then
      -- A. 如果是顶层环境...
      
      -- A.1. 目标是 Word: 转换为内部环境
      if FORMAT:match 'docx' then
        local inner_env = to_inner_map[env_name]
        if inner_env then
          local new_content = content:gsub("(\\begin%{" .. env_name .. "%})", "\\begin{" .. inner_env .. "}")
          new_content = new_content:gsub("(\\end%{" .. env_name .. "%})", "\\end{" .. inner_env .. "}")
          math_elem.text = new_content
          return p -- 返回修改后的段落
        end
      -- A.2. 目标是 LaTeX/PDF: 转换为原生块，去掉外围包裹
      elseif FORMAT:match 'latex' or FORMAT == 'pdf' then
        return pandoc.RawBlock('latex', content)
      end
    else
      -- B. 如果不是顶层环境 (即普通块级公式)...
      
      -- B.1. 目标是 LaTeX/PDF: 转换为 equation 环境
      if FORMAT:match 'latex' or FORMAT == 'pdf' then
        local new_content = '\\begin{equation}\n' .. content .. '\n\\end{equation}'
        return pandoc.RawBlock('latex', new_content)
      end
      -- B.2. 目标是 Word (或其他): 不做任何事，Pandoc 会默认处理成单行公式，这是正确的
    end
  end
  -- 如果不是块级公式段落，不进行任何操作
  return nil
end

-- 返回过滤器列表，Pandoc 会按顺序应用
return {
  { Math = Math },
  { Para = Para }
}