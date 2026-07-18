import "server-only";

import { GoogleGenAI } from "@google/genai";

export type LlmProvider = "google" | "openai" | "anthropic" | "xai";

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
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  xai: "xAI Grok"
};

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  xai: "grok-4-fast"
};

// Vision-capable default per provider — kept separate since some fast/cheap
// text defaults (e.g. grok-4-fast) may not be the provider's best OCR model.
export const DEFAULT_VISION_MODELS: Record<LlmProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  xai: "grok-4"
};

async function generateGoogle(config: LlmConfig, systemInstruction: string, prompt: string, image?: ImageInput): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: prompt }];
  if (image) parts.unshift({ inlineData: { data: image.data, mimeType: image.mimeType } });

  const response = await ai.models.generateContent({
    model: config.model,
    contents: [{ role: "user", parts }],
    config: { systemInstruction, temperature: 0.2 }
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini trả về phản hồi rỗng.");
  return text;
}

async function generateOpenAiCompatible(
  baseUrl: string,
  config: LlmConfig,
  systemInstruction: string,
  prompt: string,
  image?: ImageInput
): Promise<string> {
  const userContent = image
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
      ]
    : prompt;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${baseUrl} trả về lỗi ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Phản hồi rỗng từ LLM.");
  return text;
}

async function generateAnthropic(config: LlmConfig, systemInstruction: string, prompt: string, image?: ImageInput): Promise<string> {
  const userContent = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } },
        { type: "text", text: prompt }
      ]
    : prompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1536,
      temperature: 0.2,
      system: systemInstruction,
      messages: [{ role: "user", content: userContent }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic trả về lỗi ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text) throw new Error("Phản hồi rỗng từ Anthropic.");
  return text;
}

// Generates a grounded answer with the caller's chosen provider/model/key.
// Throws on any failure — callers are expected to catch and fall back
// (e.g. to the rule-based local answerer) rather than surface raw errors.
export async function generateAnswer(config: LlmConfig, systemInstruction: string, prompt: string): Promise<string> {
  if (!config.apiKey) throw new Error("Thiếu API key.");

  switch (config.provider) {
    case "google":
      return generateGoogle(config, systemInstruction, prompt);
    case "openai":
      return generateOpenAiCompatible("https://api.openai.com/v1", config, systemInstruction, prompt);
    case "xai":
      return generateOpenAiCompatible("https://api.x.ai/v1", config, systemInstruction, prompt);
    case "anthropic":
      return generateAnthropic(config, systemInstruction, prompt);
    default:
      throw new Error(`Nhà cung cấp không được hỗ trợ: ${config.provider}`);
  }
}

// Same as generateAnswer, but attaches an image to the request (vision/OCR
// use case). All 4 providers support image input on their current
// vision-capable models; the caller is responsible for passing a model that
// actually supports vision (see DEFAULT_VISION_MODELS).
export async function generateVisionAnswer(
  config: LlmConfig,
  systemInstruction: string,
  prompt: string,
  image: ImageInput
): Promise<string> {
  if (!config.apiKey) throw new Error("Thiếu API key.");

  switch (config.provider) {
    case "google":
      return generateGoogle(config, systemInstruction, prompt, image);
    case "openai":
      return generateOpenAiCompatible("https://api.openai.com/v1", config, systemInstruction, prompt, image);
    case "xai":
      return generateOpenAiCompatible("https://api.x.ai/v1", config, systemInstruction, prompt, image);
    case "anthropic":
      return generateAnthropic(config, systemInstruction, prompt, image);
    default:
      throw new Error(`Nhà cung cấp không được hỗ trợ: ${config.provider}`);
  }
}
