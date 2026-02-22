"use strict";

const MODELS = {
  groq: {
    default: "llama-3.3-70b-versatile",
    available: [
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "compound-beta",
    ],
  },

  gemini: {
    default: "gemini-2.5-flash",
    available: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
  },

  openai: {
    default: "gpt-4o",
    available: ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"],
  },

  anthropic: {
    default: "claude-sonnet-4-5",
    available: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5-20251001",
    ],
  },

  grok: {
    default: "grok-4-fast",
    available: ["grok-4", "grok-4-fast", "grok-3", "grok-3-mini"],
  },

  ollama: {
    default: "llama3.3",
    available: [
      "llama4",
      "llama3.3",
      "gemma3",
      "qwen3",
      "mistral",
      "codellama",
    ],
  },
};

function getDefaultModel(provider) {
  return MODELS[provider.toLowerCase()]?.default || null;
}

function getAvailableModels(provider) {
  return MODELS[provider.toLowerCase()]?.available || [];
}

function getAllProviders() {
  return Object.keys(MODELS);
}

module.exports = {
  MODELS,
  getDefaultModel,
  getAvailableModels,
  getAllProviders,
};
