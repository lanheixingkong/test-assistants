function normalizeBaseUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/$/, "");
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

async function callLLM({ fields, baseUrl, model, apiKey }) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized || !model || !apiKey) {
    throw new Error("Missing LLM config. Set Base URL, model, and API key.");
  }

  const url = normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;

  const system = "You generate JSON to fill web forms for QA. Return only a JSON object. Use concise realistic test data.";
  const user = {
    instruction:
      "Given the fields, return a JSON object mapping best field keys to values. Use keys from candidates when possible. Use Chinese for string values. Return JSON only.",
    fields
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error: ${res.status} ${text.slice(0, 160)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM response did not include valid JSON object.");
  }

  return parsed;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LLM_REQUEST") return false;

  (async () => {
    try {
      const { baseUrl, model, apiKey } = await chrome.storage.sync.get({
        baseUrl: "",
        model: "",
        apiKey: ""
      });

      const data = await callLLM({
        fields: message.payload.fields,
        baseUrl,
        model,
        apiKey
      });

      sendResponse({ ok: true, data });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true;
});
