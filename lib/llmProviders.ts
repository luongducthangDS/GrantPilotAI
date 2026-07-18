import "server-only";

// FPT.AI Marketplace only — OpenAI-compatible chat completions
// (POST {baseUrl}/chat/completions, Bearer auth, standard messages/choices
// shape). Confirmed against a real curl example from the account owner
// (2026-07-19); no Gemini/OpenAI/Anthropic/xAI calls remain in this app.
export type LlmProvider = "fptai";

export type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
};

export type ImageInput = {
  data: string; // base64, no data: prefix
  mimeType: string; // e.g. "image/png", "image/jpeg"
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  fptai: "FPT.AI Marketplace"
};

// "Answer chính" per the account owner's model-assignment table: the model
// used for the reasoning-heavy tasks (grounded Q&A, policy-match analysis)
// where following the anti-hallucination/nuance rules in each route's
// SYSTEM_INSTRUCTION matters most.
export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  fptai: "GLM-5.2"
};

// "Tác vụ nhẹ" — a lighter/cheaper model for more mechanical extraction-style
// tasks (checklist item matching, free-form .txt field extraction) that
// don't need GLM-5.2's full reasoning budget.
export const DEFAULT_LIGHT_MODELS: Record<LlmProvider, string> = {
  fptai: "DeepSeek-V4-Flash"
};

// Vision-capable default — Qwen2.5-VL-7B-Instruct is the only confirmed
// vision model in the account's catalog; none of the other text models
// (GLM/DeepSeek/gpt-oss/Llama/etc.) accept image input.
export const DEFAULT_VISION_MODELS: Record<LlmProvider, string> = {
  fptai: "Qwen2.5-VL-7B-Instruct"
};

const FPT_AI_BASE_URL = process.env.CUSTOM_LLM_BASE_URL || "https://mkp-api.fptcloud.com/v1";

async function generateFptAi(
  config: LlmConfig,
  systemInstruction: string,
  prompt: string,
  images?: ImageInput[]
): Promise<string> {
  const userContent = images?.length
    ? [
        { type: "text", text: prompt },
        ...images.map((image) => ({ type: "image_url" as const, image_url: { url: `data:${image.mimeType};base64,${image.data}` } }))
      ]
    : prompt;

  const response = await fetch(`${FPT_AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      // temperature 0.1: every use case in this app is grounded
      // extraction/analysis (OCR fields, policy explanations, cited Q&A)
      // with no creative-writing need — a lower temperature reduces the
      // model's tendency to fabricate a plausible-looking value.
      temperature: 0.1,
      stream: false,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`FPT.AI Marketplace trả về lỗi ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;
  // GLM-5.2 (a "thinking" model) puts its actual answer in reasoning_content
  // instead of content specifically when response_format: json_object is
  // set — content comes back null — verified live against this deployment.
  // content is normally the real field for every other model, so try it
  // first and only fall back to reasoning_content when it's empty.
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? undefined;
  if (!text) throw new Error("Phản hồi rỗng từ LLM.");
  return text;
}

// Generates a grounded answer with the caller's chosen model/key.
// Throws on any failure — callers are expected to catch and fall back
// (e.g. to the rule-based local answerer) rather than surface raw errors.
export async function generateAnswer(config: LlmConfig, systemInstruction: string, prompt: string): Promise<string> {
  if (!config.apiKey) throw new Error("Thiếu API key.");
  return generateFptAi(config, systemInstruction, prompt);
}

// Same as generateAnswer, but attaches image(s) to the request (vision/OCR
// use case). Only a vision-capable model (see DEFAULT_VISION_MODELS) can
// actually use this — the caller is responsible for passing one. PDF is NOT
// supported here: unlike Gemini's inlineData part, an OpenAI-style
// image_url content block needs an actual raster image (jpg/png/webp), so
// callers must rasterize a PDF page before calling this.
export async function generateVisionAnswer(
  config: LlmConfig,
  systemInstruction: string,
  prompt: string,
  image: ImageInput | ImageInput[]
): Promise<string> {
  if (!config.apiKey) throw new Error("Thiếu API key.");
  const images = Array.isArray(image) ? image : [image];
  return generateFptAi(config, systemInstruction, prompt, images);
}

// No real schema-validated guarantee the way Gemini's responseSchema was —
// this is just generateAnswer/generateVisionAnswer under a name that
// signals intent at the call site. Callers must regex-extract the
// {...}/[...] block from the returned text and validate/sanitize every
// field themselves (this app's OCR and recommend routes do this as their
// primary parsing path, not a fallback). Deliberately does NOT send
// response_format: json_object — verified live that it breaks GLM-5.2 (a
// "thinking" model): the API pushes the actual answer into a
// reasoning_content field instead of content, and for a long/complex
// prompt reasoning_content often never resolves into clean JSON at all.
// Regular (non-forced) generation reliably puts the real answer in content.
export async function generateJsonAnswer(
  config: LlmConfig,
  systemInstruction: string,
  prompt: string,
  image?: ImageInput | ImageInput[]
): Promise<string> {
  if (!config.apiKey) throw new Error("Thiếu API key.");
  const images = image ? (Array.isArray(image) ? image : [image]) : undefined;
  return generateFptAi(config, systemInstruction, prompt, images);
}
