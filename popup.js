const statusEl = document.getElementById("status");
const jsonEl = document.getElementById("json");
const modeEl = document.getElementById("mode");
const fillBtn = document.getElementById("fill");
const openOptionsBtn = document.getElementById("openOptions");
let currentRequestId = null;
let tickTimer = null;
let tickStart = 0;
let lastBaseStatus = "";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function startTick(base) {
  lastBaseStatus = base;
  tickStart = Date.now();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - tickStart) / 1000);
    setStatus(`${lastBaseStatus} (${seconds}s)`);
  }, 1000);
}

function stopTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  lastBaseStatus = "";
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "LLM_PROGRESS") return;
  if (!currentRequestId || message.requestId !== currentRequestId) return;

  stopTick();
  setStatus(message.text);
  if (message.tick) {
    startTick(message.text);
  }
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

fillBtn.addEventListener("click", async () => {
  currentRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  setStatus("Injecting...");
  startTick("Injecting...");
  fillBtn.disabled = true;

  let targetData = null;
  if (modeEl.value === "json") {
    const raw = jsonEl.value.trim();
    if (!raw) {
      setStatus("Provide JSON or switch mode.", true);
      stopTick();
      fillBtn.disabled = false;
      return;
    }
    try {
      targetData = JSON.parse(raw);
      if (targetData === null || Array.isArray(targetData)) {
        throw new Error("JSON must be an object.");
      }
    } catch (err) {
      setStatus(`Invalid JSON: ${err.message}`, true);
      stopTick();
      fillBtn.disabled = false;
      return;
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("No active tab.", true);
    stopTick();
    fillBtn.disabled = false;
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "LLM_AUTOFILL",
      payload: {
        mode: modeEl.value,
        targetData,
        requestId: currentRequestId
      }
    });

    if (response?.ok) {
      setStatus(`Filled ${response.count} fields.`);
    } else {
      setStatus(response?.error || "Failed to fill.", true);
    }
  } catch (err) {
    setStatus(err.message || "Injection failed.", true);
  } finally {
    stopTick();
    fillBtn.disabled = false;
  }
});
