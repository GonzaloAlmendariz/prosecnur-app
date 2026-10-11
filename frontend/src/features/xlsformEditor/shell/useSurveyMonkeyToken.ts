// =============================================================================
// shell/useSurveyMonkeyToken.ts — token de SurveyMonkey del importador (L8)
// =============================================================================
// Abrir el importador NO consulta nada: ni el estado del token guardado ni
// SurveyMonkey. Antes, al montar, se pedía la máscara del token y, si había
// uno, se verificaba contra GET /users/me; un token revocado o sin red pintaba
// un error que el usuario no había pedido, y el estado inicial dependía del
// disco de cada equipo.
//
// Ahora el estado inicial es siempre el mismo («sin consultar») y la primera
// consulta la dispara una acción explícita: Probar conexión, Buscar mis
// encuestas, Usar esta encuesta, crear el borrador o apagar «Recordar en este
// equipo». Si el usuario pegó un token, se usa ese; si no, se mira entonces si
// hay uno guardado.
// =============================================================================

import { useState } from "react";
import {
  apiXlsformEditorSmCheckToken,
  apiXlsformEditorSmTokenClear,
  apiXlsformEditorSmTokenLoad,
  apiXlsformEditorSmTokenSave,
  type SurveyMonkeyTokenInfo,
  type SurveyMonkeyTokenState,
} from "../../../api/multiIntegrado";

export const EMPTY_SM_TOKEN_STATE: SurveyMonkeyTokenState = {
  ok: true,
  has_token: false,
  masked_token: "",
  persisted: false,
  ephemeral: false,
};

/**
 * Lectura de UI del token. `consultado = false` es el estado inicial: no se
 * sabe si hay un token guardado, así que las acciones quedan habilitadas
 * (`canAttempt`) y la primera de ellas lo averigua.
 */
export function surveyMonkeyTokenUiState(
  tokenState: SurveyMonkeyTokenState,
  currentInput: string,
  consultado = true,
) {
  const hasInput = currentInput.trim().length > 0;
  const hasStoredToken = tokenState.has_token;
  const hasUsableToken = hasInput || hasStoredToken;
  return {
    inputValue: currentInput,
    hasUsableToken,
    canAttempt: hasUsableToken || !consultado,
    pendingLookup: !consultado && !hasInput,
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

function mensaje(e: unknown): string {
  return String((e as Error)?.message ?? e);
}

export function useSurveyMonkeyToken({
  onError,
  onTokenInvalidated,
}: {
  /** Error visible del bloque de conexión. */
  onError: (message: string) => void;
  /** El token cambió o se borró: lo conectado con el anterior deja de valer. */
  onTokenInvalidated: () => void;
}) {
  const [token, setToken] = useState("");
  const [tokenState, setTokenState] = useState<SurveyMonkeyTokenState>(EMPTY_SM_TOKEN_STATE);
  const [consultado, setConsultado] = useState(false);
  const [rememberToken, setRememberToken] = useState(true);
  const [tokenStatus, setTokenStatus] = useState<SurveyMonkeyTokenInfo | null>(null);

  function applyTokenState(next: SurveyMonkeyTokenState) {
    setTokenState(next);
    setConsultado(true);
    if (next.has_token) setRememberToken(next.persisted);
  }

  /** Estado del token guardado; solo se pide la primera vez, tras una acción. */
  async function storedState(): Promise<SurveyMonkeyTokenState> {
    if (consultado) return tokenState;
    const state = await apiXlsformEditorSmTokenLoad();
    applyTokenState(state);
    return state;
  }

  async function saveInput(input: string, persist: boolean) {
    const state = await apiXlsformEditorSmTokenSave(input, { persist });
    applyTokenState(state);
    setToken("");
    return state;
  }

  async function ensureReady(missingMessage: string): Promise<boolean> {
    const input = token.trim();
    try {
      if (input) return (await saveInput(input, rememberToken)).has_token;
      if ((await storedState()).has_token) return true;
    } catch (e) {
      onError(mensaje(e));
      return false;
    }
    onError(missingMessage);
    return false;
  }

  function handleTokenChange(next: string) {
    setToken(next);
    setTokenStatus(null);
    onTokenInvalidated();
  }

  async function handleTokenBlur() {
    const input = token.trim();
    if (!input) return;
    try {
      await saveInput(input, rememberToken);
    } catch {
      // Si falla guardar, el usuario puede volver a intentar; no es fatal.
    }
  }

  async function handleRememberToggle(next: boolean) {
    setRememberToken(next);
    try {
      const input = token.trim();
      if (input) {
        await saveInput(input, next);
        return;
      }
      const state = await storedState();
      if (next && state.ephemeral) {
        setRememberToken(false);
        onError("Para recordar este token en el equipo, vuelve a pegarlo y activa «Recordar» antes de usarlo.");
      } else if (!next && state.has_token) {
        applyTokenState(await apiXlsformEditorSmTokenClear());
      }
    } catch {
      // ignore
    }
  }

  async function forget() {
    setToken("");
    setTokenState(EMPTY_SM_TOKEN_STATE);
    setTokenStatus(null);
    onTokenInvalidated();
    try {
      applyTokenState(await apiXlsformEditorSmTokenClear());
    } catch {
      // ignore
    }
  }

  async function verify() {
    if (!(await ensureReady("Necesitas el token de la API para probar la conexión."))) return;
    setTokenStatus(null);
    try {
      setTokenStatus(await apiXlsformEditorSmCheckToken());
    } catch (e) {
      setTokenStatus({ ok: false, error: mensaje(e) });
    }
  }

  return {
    token,
    tokenState,
    consultado,
    rememberToken,
    tokenStatus,
    ensureReady,
    handleTokenChange,
    handleTokenBlur,
    handleRememberToggle,
    forget,
    verify,
  };
}
