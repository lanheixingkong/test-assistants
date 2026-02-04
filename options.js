const baseUrlEl = document.getElementById("baseUrl");
const modelEl = document.getElementById("model");
const apiKeyEl = document.getElementById("apiKey");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function normalizeBaseUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/$/, "");
}

async function loadConfig() {
  const { baseUrl, model, apiKey } = await chrome.storage.sync.get({
    baseUrl: "",
    model: "",
    apiKey: ""
  });
  baseUrlEl.value = baseUrl;
  modelEl.value = model;
  apiKeyEl.value = apiKey;
}

saveBtn.addEventListener("click", async () => {
  const baseUrl = normalizeBaseUrl(baseUrlEl.value);
  const model = modelEl.value.trim();
  const apiKey = apiKeyEl.value.trim();

  if (!baseUrl || !model || !apiKey) {
    setStatus("Base URL, model, and API key are required.", true);
    return;
  }

  await chrome.storage.sync.set({ baseUrl, model, apiKey });
  setStatus("Saved.");
});

testBtn.addEventListener("click", async () => {
  const baseUrl = normalizeBaseUrl(baseUrlEl.value);
  const apiKey = apiKeyEl.value.trim();

  if (!baseUrl || !apiKey) {
    setStatus("Base URL and API key are required.", true);
    return;
  }

  setStatus("Testing...");
  try {
    const url = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      setStatus(`Failed: ${res.status} ${text.slice(0, 120)}`, true);
      return;
    }

    setStatus("Connection OK.");
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
  }
});

loadConfig();
