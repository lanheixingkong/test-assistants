# LLM 表单自动填充 Chrome 插件

用于在任意网页表单上，基于 JSON / 规则 / LLM 自动填充字段，提升功能测试效率。

## 功能亮点

- 三种填充模式：
  - `LLM (Form Structure)`：读取页面字段结构，由 LLM 生成测试数据
  - `JSON`：你提供目标数据，按字段名匹配
  - `Auto`：基于字段名/placeholder 的规则推断
- 支持 Antd/Element 的常见组件：
  - `Select` / `多选 Select`
  - `DatePicker` / `日期范围`
  - `Switch`
  - `Cascader`
- 页面右下角状态面板：
  - 动态进度提示
  - 显示 LLM 响应耗时
  - 显示匹配率（匹配/总数）
  - 内置 `Fill` 按钮，可直接在页面触发

## 安装与使用

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择目录：
   - `/Users/lei/development/deeplearning/test-assistants`
4. 点击插件图标 → `Config`，填写（OpenAI API接口格式）：
   - `Base URL`
   - `Model`
   - `API Key`
5. 进入你要测试的页面：
   - 方式 A：点击插件图标 → 选择模式 → `Fill Current Page`
   - 方式 B：页面右下角面板 → 点击 `Fill`

## Base URL 说明

- 如果填写 `https://api.example.com/v1`，请求会发送到：
  - `https://api.example.com/v1/chat/completions`
- 如果填写 `https://api.example.com`，请求会发送到：
  - `https://api.example.com/v1/chat/completions`

## JSON 模式示例

```json
{
  "email": "qa@example.com",
  "用户名": "测试用户",
  "phone": "13800138000",
  "公司": "测试公司",
  "地址": "测试路1号",
  "日期": "2026-02-04",
  "范围": "2026-02-01,2026-02-04",
  "多选": ["选项A", "选项B"],
  "级联": "省/市/区"
}
```

## 说明与限制

- 目前优先支持常规 `input/textarea/select`，以及 Antd/Element 的常见控件。
- 复杂组件（例如自定义表格、异步联动、动态校验）可能需要针对性适配。

## 目录结构

- `manifest.json` 插件配置
- `popup.*` 弹窗 UI
- `options.*` 配置页 UI
- `background.js` LLM 请求
- `content.js` 页面注入与填充逻辑

如需进一步定制（多语言、更多组件、保存模板、批量填充），可以继续扩展。
