import { Env, ParsedIntent } from "./types";

const TOOL_CATALOG = `
- image-compress: 1pt - Compress image (PNG/JPG/WebP)
- image-resize: 1pt - Resize image
- image-crop: 1pt - Crop image
- image-watermark: 2pts - Add watermark to image
- image-convert: 1pt - Convert image format
- pdf-merge: 2pts - Merge multiple PDFs
- pdf-compress: 1pt - Compress PDF
- pdf-to-image: 2pts - Convert PDF pages to images
- image-to-pdf: 1pt - Convert images to PDF
- qr-generate: 1pt - Generate QR code
- qr-read: 1pt - Read/decode QR code
- hash-compute: 1pt - Compute hash (MD5/SHA256/SHA512)
- base64-convert: 1pt - Base64 encode/decode
- url-encode: 1pt - URL encode/decode
- json-format: 1pt - Format/minify JSON
- html-format: 1pt - Format/minify HTML
- css-minify: 1pt - Minify CSS
- js-minify: 1pt - Minify JavaScript
- markdown-preview: 1pt - Preview Markdown
- color-convert: 1pt - Convert color (HEX/RGB/HSL)
- svg-optimize: 1pt - Optimize SVG
- text-diff: 1pt - Compare text differences
- text-counter: 1pt - Count words/characters
- password-gen: 1pt - Generate secure password
- lorem-gen: 1pt - Generate lorem ipsum
- uuid-gen: 1pt - Generate UUID
- timestamp-convert: 1pt - Convert timestamp
- regex-test: 1pt - Test regular expressions
- jwt-decode: 1pt - Decode JWT token
- emoji-search: 1pt - Search emoji
- unit-convert: 1pt - Convert units
- timezone-convert: 1pt - Convert timezones
`;

const INTENT_SYSTEM_PROMPT = `You are a tool orchestration assistant for a web toolbox.
Given a user request, break it down into a sequence of tool steps.
Available tools and their point costs:
${TOOL_CATALOG}

Rules:
- Each step's input can be "$url" for a URL the user provides, or "$stepN.output" for the output of step N
- Only use tools from the list above
- If the request can be handled by a single tool, return just one step
- Respond in JSON only
Schema: {"steps":[{"tool":"<tool-id>","input":"$url or $stepN.output","params":{}}],"total_points":<number>,"confidence":0.0-1.0}`;

type ProviderName = "gemini" | "cloudflare" | "mimo" | "deepseek";

interface ProviderAttemptResult {
  provider: ProviderName;
  text: string;
}

export async function parseIntent(userMessage: string, env: Env): Promise<ParsedIntent> {
  const order = getProviderOrder(env);
  const errors: string[] = [];

  for (const provider of order) {
    try {
      const raw = await runProvider(provider, userMessage, env);
      if (!raw?.text) continue;
      const parsed = sanitizeIntent(raw.text, provider);
      if (parsed.steps.length > 0) return parsed;
    } catch (err) {
      errors.push(`${provider}:${(err as Error).message}`);
    }
  }

  const fallback = fallbackParseIntent(userMessage);
  fallback.provider = errors.length ? `rule-fallback (${errors.join("; ")})` : "rule-fallback";
  return fallback;
}

function getProviderOrder(env: Env): ProviderName[] {
  const configured = (env.AI_PROVIDER_ORDER || "gemini,cloudflare,mimo,deepseek")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as ProviderName[];

  const valid: ProviderName[] = [];
  for (const provider of configured) {
    if (!valid.includes(provider) && ["gemini", "cloudflare", "mimo", "deepseek"].includes(provider)) {
      valid.push(provider);
    }
  }
  return valid.length ? valid : ["gemini", "cloudflare", "mimo", "deepseek"];
}

async function runProvider(provider: ProviderName, userMessage: string, env: Env): Promise<ProviderAttemptResult | null> {
  if (provider === "gemini") return callGemini(userMessage, env);
  if (provider === "cloudflare") return callCloudflare(userMessage, env);
  if (provider === "mimo") return callMimo(userMessage, env);
  return callDeepSeek(userMessage, env);
}

async function callCloudflare(userMessage: string, env: Env): Promise<ProviderAttemptResult | null> {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return null;
  const model = env.CF_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: INTENT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        max_tokens: 512,
      }),
    }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { result?: { response?: string } };
  return data?.result?.response ? { provider: "cloudflare", text: data.result.response } : null;
}

async function callGemini(userMessage: string, env: Env): Promise<ProviderAttemptResult | null> {
  if (!env.GEMINI_API_KEY) return null;
  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      contents: [
        {
          role: "user",
          parts: [{ text: `${INTENT_SYSTEM_PROMPT}\n\nUser request: ${userMessage}` }],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? { provider: "gemini", text } : null;
}

async function callMimo(userMessage: string, env: Env): Promise<ProviderAttemptResult | null> {
  if (!env.MIMO_API_KEY || !env.MIMO_API_BASE) return null;
  const model = env.MIMO_MODEL || "mimo-chat";
  const response = await fetch(`${stripSlash(env.MIMO_API_BASE)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MIMO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data?.choices?.[0]?.message?.content;
  return text ? { provider: "mimo", text } : null;
}

async function callDeepSeek(userMessage: string, env: Env): Promise<ProviderAttemptResult | null> {
  if (!env.DEEPSEEK_API_KEY) return null;
  const model = env.DEEPSEEK_MODEL || "deepseek-chat";
  const base = stripSlash(env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data?.choices?.[0]?.message?.content;
  return text ? { provider: "deepseek", text } : null;
}

function sanitizeIntent(rawText: string, provider: string): ParsedIntent {
  const parsed = JSON.parse(rawText) as ParsedIntent;
  if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error("invalid payload");

  const cleanSteps = parsed.steps
    .filter((s) => typeof s.tool === "string" && s.tool.length > 0)
    .map((s) => ({
      tool: s.tool,
      input: s.input || "$url",
      params: s.params || {},
    }))
    .filter((s) => getToolCost(s.tool) > 0);

  return {
    steps: cleanSteps,
    total_points: cleanSteps.reduce((sum, s) => sum + getToolCost(s.tool), 0),
    confidence: typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.7,
    provider,
  };
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function fallbackParseIntent(message: string): ParsedIntent {
  const keywords: Record<string, string> = {
    compress: "image-compress",
    resize: "image-resize",
    crop: "image-crop",
    watermark: "image-watermark",
    convert: "image-convert",
    merge: "pdf-merge",
    pdf: "pdf-compress",
    qr: "qr-generate",
    hash: "hash-compute",
    base64: "base64-convert",
    url: "url-encode",
    json: "json-format",
    html: "html-format",
    css: "css-minify",
    javascript: "js-minify",
    markdown: "markdown-preview",
    color: "color-convert",
    svg: "svg-optimize",
    diff: "text-diff",
    password: "password-gen",
    uuid: "uuid-gen",
    timestamp: "timestamp-convert",
    regex: "regex-test",
    jwt: "jwt-decode",
    emoji: "emoji-search",
    unit: "unit-convert",
    timezone: "timezone-convert",
  };

  const lower = message.toLowerCase();
  for (const [keyword, toolId] of Object.entries(keywords)) {
    if (lower.includes(keyword)) {
      return {
        steps: [{ tool: toolId, input: "$url" }],
        total_points: getToolCost(toolId),
        confidence: 0.6,
      };
    }
  }

  return { steps: [], total_points: 0, confidence: 0 };
}

function getToolCost(toolId: string): number {
  const costs: Record<string, number> = {
    "image-compress": 1, "image-resize": 1, "image-crop": 1,
    "image-watermark": 2, "image-convert": 1,
    "pdf-merge": 2, "pdf-compress": 1, "pdf-to-image": 2, "image-to-pdf": 1,
    "qr-generate": 1, "qr-read": 1,
    "hash-compute": 1, "base64-convert": 1, "url-encode": 1,
    "json-format": 1, "html-format": 1, "css-minify": 1, "js-minify": 1,
    "markdown-preview": 1, "color-convert": 1, "svg-optimize": 1,
    "text-diff": 1, "text-counter": 1,
    "password-gen": 1, "lorem-gen": 1, "uuid-gen": 1,
    "timestamp-convert": 1, "regex-test": 1, "jwt-decode": 1,
    "emoji-search": 1, "unit-convert": 1, "timezone-convert": 1,
  };
  return costs[toolId] || 0;
}

export { getToolCost };
