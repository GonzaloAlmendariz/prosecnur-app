export const HUGGING_FACE_TOKENS_URL = "https://huggingface.co/settings/tokens";
export const PULSO_HF_DEFAULT_NAMESPACE = "PULSOPUCP";
export const PULSO_HF_DEFAULT_TOKEN_ALIAS = "PULSOAnaliticaSocial";

export function openHuggingFaceTokens() {
  window.open(HUGGING_FACE_TOKENS_URL, "_blank", "noopener,noreferrer");
}

