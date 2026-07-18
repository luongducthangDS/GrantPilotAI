"use client";

export type LlmProvider = "google" | "openai" | "anthropic" | "xai";

export type LlmSettings = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
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

// Google list confirmed callable against a real key (see the user's own
// check_api_gemini.ipynb) as of 2026-07: 2.5-flash/-lite are the
// established stable tier, 3.5-flash/3.1-flash-lite are the newer stable
// tier, 3-flash-preview is explicitly a preview build (can change/be
// pulled without notice — kept as an opt-in choice, not the default).
export const MODEL_SUGGESTIONS: Record<LlmProvider, string[]> = {
  google: [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview"
  ],
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
  xai: ["grok-4-fast", "grok-4", "grok-3"]
};

const STORAGE_KEY = "grantpilot_llm_settings";

export function loadLlmSettings(): LlmSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    if (!parsed.provider || !parsed.apiKey) return null;
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey,
      model: parsed.model || DEFAULT_MODELS[parsed.provider]
    };
  } catch {
    return null;
  }
}

export function saveLlmSettings(settings: LlmSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearLlmSettings() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
