function normalizeText(text) {
  return (text || "").trim().toLowerCase();
}

function ensureStatusPanel() {
  const id = "__llm_autofill_panel__";
  let panel = document.getElementById(id);
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = id;
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "16px";
  panel.style.zIndex = "2147483647";
  panel.style.padding = "10px 12px";
  panel.style.borderRadius = "12px";
  panel.style.background = "rgba(34, 34, 34, 0.94)";
  panel.style.color = "#fff";
  panel.style.fontSize = "12px";
  panel.style.fontFamily = "Arial, sans-serif";
  panel.style.boxShadow = "0 6px 18px rgba(0,0,0,0.2)";
  panel.style.maxWidth = "240px";
  panel.style.lineHeight = "1.4";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "6px";
  header.style.cursor = "move";
  header.style.userSelect = "none";

  const title = document.createElement("span");
  title.textContent = "LLM Autofill";
  title.style.fontWeight = "600";

  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", "Close");
  close.style.background = "transparent";
  close.style.border = "none";
  close.style.color = "#fff";
  close.style.cursor = "pointer";
  close.style.fontSize = "14px";
  close.style.lineHeight = "1";
  close.onclick = () => panel.remove();

  const body = document.createElement("div");
  body.id = "__llm_autofill_panel_body__";
  body.textContent = "Idle";

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";
  footer.style.marginTop = "8px";

  const runBtn = document.createElement("button");
  runBtn.id = "__llm_autofill_panel_run__";
  runBtn.textContent = "Fill";
  runBtn.style.background = "rgba(255,255,255,0.1)";
  runBtn.style.border = "1px solid rgba(255,255,255,0.3)";
  runBtn.style.color = "#fff";
  runBtn.style.borderRadius = "8px";
  runBtn.style.padding = "4px 8px";
  runBtn.style.cursor = "pointer";
  runBtn.style.fontSize = "12px";

  footer.appendChild(runBtn);

  header.appendChild(title);
  header.appendChild(close);
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  document.body.appendChild(panel);

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMouseMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const nextLeft = Math.max(0, startLeft + dx);
    const nextTop = Math.max(0, startTop + dy);
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };

  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  header.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  runBtn.addEventListener("click", () => {
    runAutofillFromPanel();
  });

  return panel;
}

let panelTickTimer = null;

function updateStatusPanel(message) {
  const panel = ensureStatusPanel();
  const body = panel.querySelector("#__llm_autofill_panel_body__");
  if (body) body.textContent = message;
}

function startPanelTick(message) {
  updateStatusPanel(message);
  if (panelTickTimer) clearInterval(panelTickTimer);
  let dots = 0;
  panelTickTimer = setInterval(() => {
    dots = (dots + 1) % 4;
    const suffix = ".".repeat(dots);
    updateStatusPanel(`${message}${suffix}`);
  }, 500);
}

function stopPanelTick() {
  if (panelTickTimer) clearInterval(panelTickTimer);
  panelTickTimer = null;
}

let panelRunning = false;

async function runAutofillFromPanel() {
  if (panelRunning) return;
  panelRunning = true;
  const runBtn = document.getElementById("__llm_autofill_panel_run__");
  if (runBtn) runBtn.disabled = true;

  try {
    const { lastMode, lastJson } = await chrome.storage.sync.get({
      lastMode: "llm",
      lastJson: ""
    });
    let targetData = null;
    if (lastMode === "json") {
      if (!lastJson) {
        updateStatusPanel("Missing JSON. Open popup to set.");
        return;
      }
      try {
        targetData = JSON.parse(lastJson);
      } catch (err) {
        updateStatusPanel("Invalid JSON. Open popup to fix.");
        return;
      }
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await fillWithMode(lastMode, targetData, requestId);
  } catch (err) {
    updateStatusPanel(`Autofill failed: ${err.message || "error"}`);
  } finally {
    panelRunning = false;
    if (runBtn) runBtn.disabled = false;
  }
}

function sendProgress(requestId, text, tick = false) {
  if (!requestId) return;
  if (tick) {
    startPanelTick(text);
  } else {
    stopPanelTick();
    updateStatusPanel(text);
  }
  chrome.runtime.sendMessage({ type: "LLM_PROGRESS", requestId, text, tick });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getLabelText(el) {
  const id = el.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for='${CSS.escape(id)}']`);
    if (label) return label.textContent || "";
  }

  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.textContent || "";

  const aria = el.getAttribute("aria-label");
  if (aria) return aria;

  return "";
}

function getFieldCandidates(el) {
  const label = getLabelText(el);
  const name = el.getAttribute("name") || "";
  const id = el.getAttribute("id") || "";
  const placeholder = el.getAttribute("placeholder") || "";
  const aria = el.getAttribute("aria-label") || "";

  const candidates = [label, name, id, placeholder, aria]
    .map(normalizeText)
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function isFillable(el) {
  if (el.disabled) return false;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (["hidden", "button", "submit", "reset", "file", "image"].includes(type)) {
      return false;
    }
  }
  return true;
}

function collectFields() {
  const elements = Array.from(
    document.querySelectorAll("input, textarea, select, [contenteditable='true']")
  ).filter(isFillable);

  const nativeFields = elements.map((el) => {
    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? (el.getAttribute("type") || "text") : tag;
    const candidates = getFieldCandidates(el);
    const options = tag === "select"
      ? Array.from(el.options).map((opt) => ({
          value: opt.value,
          text: opt.textContent
        }))
      : [];

    return {
      element: el,
      descriptor: {
        tag,
        type,
        candidates,
        placeholder: el.getAttribute("placeholder") || "",
        options,
        framework: "native"
      }
    };
  });

  const customFields = collectCustomFields();
  return nativeFields.concat(customFields);
}

function pickAutoValue(descriptor) {
  const joined = descriptor.candidates.join(" ");

  if (/(email)/i.test(joined)) return "qa@example.com";
  if (/(phone|mobile|tel)/i.test(joined)) return "13800138000";
  if (/(name|user|account|username|用户名|姓名)/i.test(joined)) return "测试用户";
  if (/(company|org|公司|单位|组织)/i.test(joined)) return "测试公司";
  if (/(address|地址)/i.test(joined)) return "测试路1号";
  if (/(date)/i.test(joined)) return "2026-02-04";
  if (/(time)/i.test(joined)) return "10:00";
  if (/(url|link|链接|网址)/i.test(joined)) return "https://example.com";
  if (descriptor.tag === "select" && descriptor.options.length) {
    const choice = descriptor.options.find((opt) => opt.value) || descriptor.options[0];
    return choice?.value || choice?.text || "";
  }

  return "测试";
}

function collectCustomFields() {
  const fields = [];

  document.querySelectorAll(".ant-select, .el-select").forEach((root) => {
    const input =
      root.querySelector("input[role='combobox']") ||
      root.querySelector("input") ||
      root.querySelector(".ant-select-selector");
    if (!input) return;
    const candidates = getFieldCandidates(input);
    const isMultiple =
      root.classList.contains("ant-select-multiple") ||
      root.classList.contains("el-select--multiple");
    fields.push({
      element: root,
      descriptor: {
        tag: "custom",
        type: isMultiple ? "multiselect" : "select",
        candidates,
        placeholder: input.getAttribute("placeholder") || "",
        options: [],
        framework: root.classList.contains("ant-select") ? "antd" : "element"
      }
    });
  });

  document
    .querySelectorAll(
      ".ant-picker, .ant-picker-range, .el-date-editor, .el-date-picker, .el-date-editor--date, .el-date-editor--daterange, .el-date-editor--datetimerange"
    )
    .forEach((root) => {
      const input = root.querySelector("input");
      if (!input) return;
      const candidates = getFieldCandidates(input);
      const isRange =
        root.classList.contains("ant-picker-range") ||
        root.classList.contains("el-date-editor--daterange") ||
        root.classList.contains("el-date-editor--datetimerange");
      fields.push({
        element: root,
        descriptor: {
          tag: "custom",
          type: isRange ? "daterange" : "datepicker",
          candidates,
          placeholder: input.getAttribute("placeholder") || "",
          options: [],
          framework: root.classList.contains("ant-picker") ? "antd" : "element"
        }
      });
    });

  document.querySelectorAll(".ant-switch, .el-switch").forEach((root) => {
    const input = root.querySelector("input") || root;
    const candidates = getFieldCandidates(input);
    fields.push({
      element: root,
      descriptor: {
        tag: "custom",
        type: "switch",
        candidates,
        placeholder: "",
        options: [],
        framework: root.classList.contains("ant-switch") ? "antd" : "element"
      }
    });
  });

  document.querySelectorAll(".ant-cascader, .el-cascader").forEach((root) => {
    const input = root.querySelector("input") || root;
    const candidates = getFieldCandidates(input);
    fields.push({
      element: root,
      descriptor: {
        tag: "custom",
        type: "cascader",
        candidates,
        placeholder: input.getAttribute("placeholder") || "",
        options: [],
        framework: root.classList.contains("ant-cascader") ? "antd" : "element"
      }
    });
  });

  return fields;
}

function applyValue(el, value) {
  const tag = el.tagName.toLowerCase();
  const type = tag === "input" ? (el.getAttribute("type") || "text").toLowerCase() : tag;

  if (type === "checkbox") {
    el.checked = Boolean(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (type === "radio") {
    if (value && el.value === value) {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  if (tag === "select") {
    const options = Array.from(el.options);
    const match = options.find(
      (opt) => opt.value === value || opt.textContent === value
    );
    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  if (el.isContentEditable) {
    el.textContent = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setInputValue(input, value) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

function toValueList(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function applyCustomValue(root, descriptor, value) {
  const strValue = String(value);

  if (descriptor.type === "switch") {
    const input = root.querySelector("input");
    const current = input ? input.checked : root.classList.contains("ant-switch-checked");
    const shouldBeOn = Boolean(value);
    if (current !== shouldBeOn) {
      root.click();
    }
    return true;
  }

  if (descriptor.type === "daterange") {
    const values = Array.isArray(value) ? value : String(value).split(",");
    const [start, end] = values.map((v) => String(v || "").trim());
    const inputs = Array.from(root.querySelectorAll("input"));
    if (inputs.length >= 2) {
      setInputValue(inputs[0], start || "");
      setInputValue(inputs[1], end || "");
      return true;
    }
    return false;
  }

  if (descriptor.type === "datepicker") {
    const input = root.querySelector("input");
    if (!input) return false;
    setInputValue(input, strValue);
    return true;
  }

  if (descriptor.type === "select" || descriptor.type === "multiselect") {
    const input =
      root.querySelector("input[role='combobox']") ||
      root.querySelector("input") ||
      root.querySelector(".ant-select-selector");
    if (!input) return false;

    input.click();
    input.focus();
    if (input.tagName.toLowerCase() === "input") {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const optionSelector =
      descriptor.framework === "antd" ? ".ant-select-item-option" : ".el-select-dropdown__item";
    const options = Array.from(document.querySelectorAll(optionSelector));
    const targets =
      descriptor.type === "multiselect" ? toValueList(value) : [strValue];
    let applied = false;
    for (const target of targets) {
      const match = options.find((opt) =>
        normalizeText(opt.textContent).includes(normalizeText(target))
      );
      const chosen = match || options[0];
      if (chosen) {
        chosen.click();
        applied = true;
      }
    }
    return applied;
  }

  if (descriptor.type === "cascader") {
    root.click();
    const paths = Array.isArray(value)
      ? value
      : String(value)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => p.split("/").map((s) => s.trim()).filter(Boolean));
    const normalizedPaths = Array.isArray(paths[0]) ? paths : [paths];

    const menuSelector =
      descriptor.framework === "antd" ? ".ant-cascader-menu" : ".el-cascader-panel";
    const itemSelector =
      descriptor.framework === "antd" ? ".ant-cascader-menu-item" : ".el-cascader-node";

    for (const path of normalizedPaths) {
      for (const segment of path) {
        const menus = Array.from(document.querySelectorAll(menuSelector));
        const activeMenu = menus[menus.length - 1] || document;
        const items = Array.from(activeMenu.querySelectorAll(itemSelector));
        const match = items.find((item) =>
          normalizeText(item.textContent).includes(normalizeText(segment))
        );
        const chosen = match || items[0];
        if (chosen) chosen.click();
      }
    }
    return true;
  }

  return false;
}

function matchValue(candidates, data) {
  const keys = Object.keys(data || {});
  for (const candidate of candidates) {
    const match = keys.find((k) => normalizeText(k) === candidate);
    if (match) return data[match];
  }

  for (const candidate of candidates) {
    const match = keys.find((k) => normalizeText(k).includes(candidate));
    if (match) return data[match];
  }

  return undefined;
}

async function fillWithMode(mode, targetData, requestId) {
  updateStatusPanel(mode === "llm" ? "LLM autofill running..." : "Autofill running...");
  sendProgress(requestId, "Collecting fields...", true);
  const fields = collectFields();
  sendProgress(requestId, `Found ${fields.length} fields.`);
  let data = targetData;

  if (mode === "llm") {
    sendProgress(requestId, "Calling LLM...", true);
    const descriptors = fields.map((f) => f.descriptor);
    const llmStart = Date.now();
    const response = await chrome.runtime.sendMessage({
      type: "LLM_REQUEST",
      payload: { fields: descriptors }
    });
    const llmMs = Date.now() - llmStart;

    if (!response?.ok) {
      throw new Error(response?.error || "LLM request failed");
    }
    data = response.data;
    sendProgress(requestId, `LLM responded in ${formatDuration(llmMs)}. Filling...`);
  }

  let filled = 0;
  let matched = 0;
  const total = fields.length;
  let index = 0;
  for (const { element, descriptor } of fields) {
    index += 1;
    let value;
    if (mode === "auto") {
      value = pickAutoValue(descriptor);
    } else {
      value = matchValue(descriptor.candidates, data || {});
    }

    if (value === undefined) continue;
    matched += 1;
    const applied = descriptor.tag === "custom"
      ? applyCustomValue(element, descriptor, value)
      : applyValue(element, value);
    if (applied) filled += 1;
    if (index % 5 === 0 || index === total) {
      sendProgress(requestId, `Filling ${index}/${total}...`, true);
    }
  }

  const matchRate = total ? Math.round((matched / total) * 100) : 0;
  sendProgress(
    requestId,
    `Completed. Filled ${filled} fields. Match rate ${matched}/${total} (${matchRate}%).`
  );
  updateStatusPanel(`Done. Filled ${filled} fields.`);
  return filled;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LLM_AUTOFILL") return false;

  (async () => {
    try {
      const count = await fillWithMode(
        message.payload.mode,
        message.payload.targetData,
        message.payload.requestId
      );
      sendResponse({ ok: true, count });
    } catch (err) {
      updateStatusPanel(`Autofill failed: ${err.message || "error"}`);
      sendProgress(message?.payload?.requestId, `Failed: ${err.message || "error"}`);
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true;
});
