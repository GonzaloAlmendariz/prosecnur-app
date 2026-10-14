// Estado de superficie del token SurveyMonkey: el backend nunca devuelve el
// secreto, sólo su máscara y dónde quedó guardado.

import type { SurveyMonkeyTokenState } from "../../../api/multiIntegrado";

export const EMPTY_SM_TOKEN_STATE: SurveyMonkeyTokenState = {
  ok: true,
  has_token: false,
  masked_token: "",
  persisted: false,
  ephemeral: false,
};

export function surveyMonkeyTokenUiState(tokenState: SurveyMonkeyTokenState, currentInput: string) {
  const hasInput = currentInput.trim().length > 0;
  const hasStoredToken = tokenState.has_token;
  return {
    inputValue: currentInput,
    hasUsableToken: hasInput || hasStoredToken,
    displayMask: hasInput ? "nuevo token pendiente" : tokenState.masked_token,
    storageLabel: hasInput
      ? "se guardará al usarlo"
      : tokenState.persisted
        ? "cifrado en este equipo"
        : tokenState.ephemeral
          ? "solo esta sesión"
          : "",
  };
}
