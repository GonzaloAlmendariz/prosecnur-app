import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlidingTabList } from "../../components/GlidingTabList";
import {
  AlertTriangle,
  Check,
  Cloud,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  Info,
  KeyRound,
  Loader2,
  MonitorCog,
  RefreshCw,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  apiConnectionCheck,
  apiConnectionGoogleSheetsConnect,
  apiConnectionProfileDelete,
  apiConnectionProfileSave,
  apiConnectionProfileSetDefault,
  apiConnectionTokenClear,
  apiConnectionTokenSave,
  apiConnectionsList,
  apiPath,
  type ConnectionCheckResult,
  type ConnectionProfileState,
  type ConnectionProvider,
  type ConnectionTokenState,
} from "../../api/client";
import {
  LAYOUT_PRESET_OPTIONS,
  layoutPresetMeta,
  useLayoutPreset,
} from "../../lib/layoutPreference";
import {
  openHuggingFaceTokens,
  PULSO_HF_DEFAULT_NAMESPACE,
  PULSO_HF_DEFAULT_TOKEN_ALIAS,
} from "../../lib/huggingFace";
import type { HfSavedDestination, HfSavedToken } from "../project/types";
import type { ReleaseNote } from "./releaseNotes";

type SettingsTab = "appearance" | "connections" | "notes" | "credits";

type GlobalSettingsDialogProps = {
  open: boolean;
  notes: ReleaseNote[];
  pulsoName: string;
  onClose: () => void;
};

type ProviderMeta = {
  provider: ConnectionProvider;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  credentialKind: "token" | "oauth";
  inputLabel: string;
  inputHelp: string;
  inputPlaceholder: string;
  emptyHelp: string;
  verifyHint: string;
};

type HfSettingsState = {
  hf_username: string;
  default_namespace: string;
  token_configured: boolean;
  encryption_available: boolean;
  persistence_status?: "available" | "unavailable";
  saved_tokens: HfSavedToken[];
  recent_destinations: HfSavedDestination[];
};

type HfBusyState = "load" | "save" | "check" | "clear" | "destination" | null;

type HfMessage = { kind: "ok" | "error"; text: string } | null;

const PROVIDERS: ProviderMeta[] = [
  {
    provider: "surveymonkey",
    title: "SurveyMonkey",
    subtitle: "Encuestas, XLSForm y respuestas multibase.",
    Icon: ClipboardList,
    credentialKind: "token",
    inputLabel: "Nueva clave de API",
    inputHelp: "Pega una clave con permisos de lectura. Si escribes un alias, quedará como perfil reutilizable.",
    inputPlaceholder: "Pegar clave de SurveyMonkey",
    emptyHelp: "Conecta una clave para importar formularios y respuestas.",
    verifyHint: "Lista encuestas visibles; no confirma que una campaña específica esté lista para importar.",
  },
  {
    provider: "kobo",
    title: "KoboToolbox",
    subtitle: "Servidores de captura, assets y respuestas de campo.",
    Icon: ServerCog,
    credentialKind: "token",
    inputLabel: "Nueva clave de API",
    inputHelp: "Elige el servidor correcto y pega una clave con acceso a los proyectos que leerá Prosecnur.",
    inputPlaceholder: "Pegar clave de KoboToolbox",
    emptyHelp: "Conecta un perfil para leer proyectos y respuestas Kobo.",
    verifyHint: "Consulta assets visibles en el servidor activo; no valida formularios específicos del proyecto.",
  },
  {
    provider: "google_sheets",
    title: "Google Sheets",
    subtitle: "Lectura y publicación controlada de hojas de Monitoreo.",
    Icon: FileSpreadsheet,
    credentialKind: "oauth",
    inputLabel: "Archivo de autorización de Google",
    inputHelp: "En Google Cloud, descarga el cliente OAuth de escritorio y pega aquí su JSON. Después Prosecnur abrirá Google para elegir la cuenta.",
    inputPlaceholder: "Pegar el JSON descargado de Google Cloud",
    emptyHelp: "Autoriza una cuenta para leer o publicar hojas controladas.",
    verifyHint: "Confirma que el OAuth responde; los permisos de una hoja concreta se revisan en Monitoreo.",
  },
];

const EMPTY_HF_SETTINGS: HfSettingsState = {
  hf_username: "",
  default_namespace: "",
  token_configured: false,
  encryption_available: true,
  saved_tokens: [],
  recent_destinations: [],
};

const KOBO_DEFAULT_BASE_URL = "https://kf.kobotoolbox.org";
const KOBO_SERVER_OPTIONS = [
  { label: "Global", value: KOBO_DEFAULT_BASE_URL },
  { label: "EU", value: "https://eu.kobotoolbox.org" },
  { label: "UNHCR", value: "https://kobo.unhcr.org" },
];

const EMPTY_CONNECTIONS: Record<ConnectionProvider, ConnectionTokenState> = {
  surveymonkey: {
    ok: true,
    provider: "surveymonkey",
    label: "SurveyMonkey",
    has_token: false,
    masked_token: "",
    persisted: false,
    ephemeral: false,
    active_profile_id: "",
    active_profile_alias: "",
    active_profile_base_url: "",
    active_profile_server_label: "",
    profile_count: 0,
    profiles: [],
  },
  kobo: {
    ok: true,
    provider: "kobo",
    label: "KoboToolbox",
    has_token: false,
    masked_token: "",
    persisted: false,
    ephemeral: false,
    active_profile_id: "",
    active_profile_alias: "",
    active_profile_base_url: "",
    active_profile_server_label: "",
    profile_count: 0,
    profiles: [],
  },
  google_sheets: {
    ok: true,
    provider: "google_sheets",
    label: "Google Sheets",
    has_token: false,
    masked_token: "",
    persisted: false,
    ephemeral: false,
    active_profile_id: "",
    active_profile_alias: "",
    active_profile_base_url: "",
    active_profile_server_label: "",
    profile_count: 0,
    profiles: [],
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function normalizeConnections(items: ConnectionTokenState[]): Record<ConnectionProvider, ConnectionTokenState> {
  const next = { ...EMPTY_CONNECTIONS };
  for (const item of items) {
    next[item.provider] = { ...next[item.provider], ...item };
  }
  return next;
}

function connectionStatusLabel(meta: ProviderMeta, state: ConnectionTokenState): string {
  if (!state.has_token) return meta.credentialKind === "oauth" ? "Sin autorización" : "Sin clave";
  if (meta.credentialKind === "oauth") return "Autorizada en este equipo";
  if (state.ephemeral) return "Activa solo esta sesión";
  if (state.persisted) return "Clave guardada en este equipo";
  return "Clave activa";
}

function checkMessage(provider: ConnectionProvider, result: ConnectionCheckResult): string {
  if (!result.ok) return result.error;
  if (provider === "surveymonkey") {
    const n = result.n_surveys_visible;
    return n == null
      ? "La clave responde. No se recibió un conteo de encuestas visibles."
      : `La clave responde. Prosecnur puede listar ${n} encuestas visibles.`;
  }
  if (provider === "google_sheets") {
    return "El OAuth responde. Los permisos de una hoja concreta se validan al registrarla en Monitoreo.";
  }
  const count = result.count;
  const server = result.base_url ? ` en ${result.base_url}` : "";
  return count == null
    ? `La clave responde${server}. No se recibió un conteo de assets.`
    : `La clave responde${server}. ${count} assets visibles.`;
}

function koboBaseUrlFromConnection(state: ConnectionTokenState): string {
  return (
    state.active_profile_base_url ||
    state.profiles?.find((profile) => profile.is_default)?.base_url ||
    state.profiles?.find((profile) => profile.base_url)?.base_url ||
    KOBO_DEFAULT_BASE_URL
  );
}

function parseTokenInput(value: string): string {
  const text = value.trim();
  if (!text.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text) as { token?: unknown; api_key?: unknown; key?: unknown };
    return String(parsed.token ?? parsed.api_key ?? parsed.key ?? text).trim();
  } catch {
    return text;
  }
}

function isValidHfNamespace(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(value.trim());
}

function hfDestinationLabel(destination: HfSavedDestination): string {
  if (destination.repo_id) return destination.repo_id;
  if (destination.namespace && destination.space_name) return `${destination.namespace}/${destination.space_name}`;
  return destination.namespace || destination.label || "Destino HF";
}

function activeConnectionLabel(meta: ProviderMeta, state: ConnectionTokenState): string {
  if (meta.provider === "google_sheets") return "Cuenta Google autorizada";
  if (meta.provider === "kobo") {
    const alias = state.active_profile_alias || "Perfil Kobo activo";
    return state.active_profile_server_label ? `${alias} en ${state.active_profile_server_label}` : alias;
  }
  return state.active_profile_alias ? `Perfil ${state.active_profile_alias}` : "Clave activa de SurveyMonkey";
}

function activeConnectionDetail(meta: ProviderMeta, state: ConnectionTokenState): string {
  const parts: string[] = [];
  if (meta.provider === "google_sheets") {
    parts.push("Lista para fuentes y publicaciones de Monitoreo");
  } else if (meta.provider === "kobo" && state.active_profile_base_url) {
    parts.push(state.active_profile_base_url);
  } else if (meta.provider === "surveymonkey") {
    parts.push("Lista para importar encuestas y respuestas");
  }
  if (state.masked_token && meta.provider !== "google_sheets") {
    parts.push(`${meta.credentialKind === "oauth" ? "Referencia OAuth" : "Referencia local"} ${state.masked_token}`);
  }
  if (meta.provider === "google_sheets") parts.push("Autorización local guardada");
  if (state.ephemeral) parts.push("No se guardó para el próximo inicio");
  return parts.join(" · ");
}

function profileDetail(profile: ConnectionProfileState, isKobo: boolean): string {
  const parts = [profile.is_default ? "Activo" : "Disponible"];
  if (isKobo && profile.server_label) parts.push(profile.server_label);
  if (isKobo && profile.base_url && !profile.server_label) parts.push(profile.base_url);
  if (profile.masked_token) parts.push(`Referencia ${profile.masked_token}`);
  return parts.join(" · ");
}

export function GlobalSettingsDialog({ open, notes, pulsoName, onClose }: GlobalSettingsDialogProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("connections");
  const [connections, setConnections] = useState<Record<ConnectionProvider, ConnectionTokenState>>(EMPTY_CONNECTIONS);
  const [hfSettings, setHfSettings] = useState<HfSettingsState>(EMPTY_HF_SETTINGS);
  const [hfUsername, setHfUsername] = useState("");
  const [hfDefaultNamespace, setHfDefaultNamespace] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [hfTokenName, setHfTokenName] = useState(PULSO_HF_DEFAULT_TOKEN_ALIAS);
  const [hfSelectedTokenId, setHfSelectedTokenId] = useState("");
  const [hfBusy, setHfBusy] = useState<HfBusyState>(null);
  const [hfMessage, setHfMessage] = useState<HfMessage>(null);
  const [inputs, setInputs] = useState<Record<ConnectionProvider, string>>({ surveymonkey: "", kobo: "", google_sheets: "" });
  const [aliases, setAliases] = useState<Record<ConnectionProvider, string>>({ surveymonkey: "", kobo: "", google_sheets: "" });
  const [baseUrls, setBaseUrls] = useState<Record<ConnectionProvider, string>>({ surveymonkey: "", kobo: KOBO_DEFAULT_BASE_URL, google_sheets: "" });
  const [remember, setRemember] = useState<Record<ConnectionProvider, boolean>>({ surveymonkey: true, kobo: true, google_sheets: true });
  const [authUrls, setAuthUrls] = useState<Partial<Record<ConnectionProvider, string>>>({});
  const [busy, setBusy] = useState<Partial<Record<ConnectionProvider, "save" | "check" | "clear">>>({});
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<Partial<Record<ConnectionProvider, { kind: "ok" | "error"; text: string }>>>({});
  const [layoutPreset, setLayoutPreset] = useLayoutPreset();

  const latestNote = notes[0];
  const layoutMeta = layoutPresetMeta(layoutPreset);
  const configuredCount = useMemo(
    () => Object.values(connections).filter((item) => item.has_token).length + (hfSettings.token_configured ? 1 : 0),
    [connections, hfSettings.token_configured],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    setActiveTab("connections");
    setLoadError("");
    setMessages({});
    setLoadingConnections(true);
    let cancelled = false;
    async function loadConnections() {
      try {
        const result = await apiConnectionsList();
        if (cancelled) return;
        const next = normalizeConnections(result.connections);
        setConnections(next);
        setRemember({
          surveymonkey: next.surveymonkey.persisted || !next.surveymonkey.has_token,
          kobo: true,
          google_sheets: true,
        });
        setBaseUrls((current) => ({
          ...current,
          kobo: koboBaseUrlFromConnection(next.kobo),
        }));
      } catch (error) {
        if (!cancelled) setLoadError(String((error as Error)?.message ?? error));
      } finally {
        if (!cancelled) setLoadingConnections(false);
      }
    }
    async function loadHfSettings() {
      if (!window.prosecnurApi?.getHfSettings) {
        setHfSettings(EMPTY_HF_SETTINGS);
        return;
      }
      try {
        const settings = await window.prosecnurApi.getHfSettings();
        if (cancelled) return;
        setHfSettings(settings);
        setHfUsername((current) => current || settings.hf_username || PULSO_HF_DEFAULT_TOKEN_ALIAS);
        setHfDefaultNamespace((current) => current || settings.default_namespace || settings.recent_destinations?.[0]?.namespace || PULSO_HF_DEFAULT_NAMESPACE);
      } catch (error) {
        if (!cancelled) {
          setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
        }
      }
    }
    void loadConnections();
    void loadHfSettings();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  function mergeConnection(next: ConnectionTokenState) {
    setConnections((current) => ({ ...current, [next.provider]: { ...current[next.provider], ...next } }));
  }

  function setProviderBusy(provider: ConnectionProvider, next: "save" | "check" | "clear" | null) {
    setBusy((current) => ({ ...current, [provider]: next ?? undefined }));
  }

  function setProviderMessage(provider: ConnectionProvider, kind: "ok" | "error", text: string) {
    setMessages((current) => ({ ...current, [provider]: { kind, text } }));
  }

  async function saveProvider(provider: ConnectionProvider) {
    const token = provider === "google_sheets" ? inputs[provider].trim() : parseTokenInput(inputs[provider]);
    if (!token) {
      setProviderMessage(provider, "error", provider === "google_sheets" ? "Pega el JSON cliente OAuth descargado de Google Cloud." : "Pega una clave API nueva para actualizarla.");
      return;
    }
    setProviderBusy(provider, "save");
    try {
      const aliasInput = aliases[provider].trim();
      const next = provider === "google_sheets"
        ? await authorizeGoogleSheets(token)
        : provider === "kobo"
        ? await apiConnectionProfileSave(provider, token, {
            alias: aliasInput || connections[provider].active_profile_alias || "Kobo",
            profile_id: aliasInput ? undefined : connections[provider].active_profile_id || undefined,
            make_default: true,
            base_url: baseUrls[provider] || KOBO_DEFAULT_BASE_URL,
          })
        : provider === "surveymonkey" && remember[provider]
        ? await apiConnectionProfileSave(provider, token, {
            alias: aliasInput || connections[provider].active_profile_alias || "Principal",
            profile_id: aliasInput ? undefined : connections[provider].active_profile_id || undefined,
            make_default: true,
          })
        : await apiConnectionTokenSave(provider, token, { persist: remember[provider] });
      if ("authorization_required" in next && next.authorization_required) {
        setAuthUrls((current) => ({ ...current, [provider]: next.auth_url }));
        mergeConnection(next.status as ConnectionTokenState);
        setProviderMessage(provider, "ok", "Abre Google, autoriza Prosecnur y vuelve a esta pantalla.");
        window.open(next.auth_url, "_blank", "noopener,noreferrer");
      } else {
        mergeConnection(next as ConnectionTokenState);
        setInputs((current) => ({ ...current, [provider]: "" }));
        setAliases((current) => ({ ...current, [provider]: "" }));
        setAuthUrls((current) => ({ ...current, [provider]: "" }));
        setProviderMessage(provider, "ok", provider === "google_sheets" ? "Google Sheets autorizado." : "Clave actualizada.");
      }
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  async function authorizeGoogleSheets(text: string) {
    const oauth = text.startsWith("{") ? JSON.parse(text) : { access_token: text };
    const callbackUrl = new URL(apiPath("/api/connections/google_sheets/oauth/callback"), window.location.origin).toString();
    return apiConnectionGoogleSheetsConnect(oauth, callbackUrl);
  }

  async function checkProvider(provider: ConnectionProvider) {
    setProviderBusy(provider, "check");
    try {
      const result = await apiConnectionCheck(provider, provider === "kobo"
        ? {
            base_url: baseUrls.kobo || koboBaseUrlFromConnection(connections.kobo),
            profile_id: connections.kobo.active_profile_id || undefined,
          }
        : provider === "surveymonkey"
          ? { profile_id: connections.surveymonkey.active_profile_id || undefined }
        : {});
      setProviderMessage(provider, result.ok ? "ok" : "error", checkMessage(provider, result));
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  async function clearProvider(provider: ConnectionProvider) {
    setProviderBusy(provider, "clear");
    try {
      const next = await apiConnectionTokenClear(provider);
      mergeConnection(next);
      setProviderMessage(provider, "ok", provider === "google_sheets" ? "Autorización OAuth quitada." : "Clave quitada.");
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  async function setDefaultProfile(provider: ConnectionProvider, profile: ConnectionProfileState) {
    setProviderBusy(provider, "save");
    try {
      const next = await apiConnectionProfileSetDefault(provider, profile.id);
      mergeConnection(next);
      if (provider === "kobo" && profile.base_url) {
        setBaseUrls((current) => ({ ...current, kobo: profile.base_url || KOBO_DEFAULT_BASE_URL }));
      }
      setProviderMessage(provider, "ok", `Perfil activo: ${profile.alias}.`);
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  async function deleteProfile(provider: ConnectionProvider, profile: ConnectionProfileState) {
    setProviderBusy(provider, "clear");
    try {
      const next = await apiConnectionProfileDelete(provider, profile.id);
      mergeConnection(next);
      setProviderMessage(provider, "ok", `Perfil quitado: ${profile.alias}.`);
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  function useSavedHfToken(id: string) {
    if (!id) return;
    setHfBusy("load");
    setHfMessage(null);
    try {
      const saved = hfSettings.saved_tokens.find((item) => item.id === id);
      if (!saved) {
        setHfMessage({ kind: "error", text: "No encontré ese token guardado." });
        return;
      }
      if (saved.requires_reauth) {
        setHfSelectedTokenId("");
        setHfToken("");
        setHfMessage({
          kind: "error",
          text: "Este token proviene de un almacenamiento anterior sin cifrado seguro. Pégalo otra vez para volver a autenticarlo.",
        });
        return;
      }
      setHfSelectedTokenId(id);
      setHfUsername(saved.hf_username || "");
      setHfTokenName(saved.name || "Hugging Face");
      setHfToken("");
      setHfMessage({
        kind: "ok",
        text: "Credencial seleccionada. El valor permanece fuera de la interfaz.",
      });
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  async function saveHfToken() {
    if (!window.prosecnurApi?.rememberSuccessfulHfToken) {
      setHfMessage({ kind: "error", text: "La conexión HF se guarda desde la app de escritorio." });
      return;
    }
    const username = hfUsername.trim();
    const token = hfToken.trim();
    if (!token) {
      setHfMessage({ kind: "error", text: "Pega un token write de Hugging Face." });
      return;
    }
    setHfBusy("save");
    setHfMessage(null);
    try {
      const settings = await window.prosecnurApi.rememberSuccessfulHfToken({
        id: hfSelectedTokenId || undefined,
        name: hfTokenName.trim() || username,
        credential_username: username,
        hf_token: token,
      });
      setHfSettings(settings);
      setHfUsername(settings.hf_username || username);
      setHfToken("");
      setHfSelectedTokenId("");
      setHfMessage(
        settings.persistence_status === "unavailable" || !settings.encryption_available
          ? {
              kind: "error",
              text: "El sistema no ofrece cifrado seguro. El token no se guardó; podrás usarlo solo pegándolo de nuevo.",
            }
          : { kind: "ok", text: "Token de Hugging Face guardado en este equipo." },
      );
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  async function checkHfToken() {
    if (!window.prosecnurApi?.checkHfToken) {
      setHfMessage({ kind: "error", text: "La verificación HF está disponible en la app de escritorio." });
      return;
    }
    if (!hfToken.trim() && !hfSelectedTokenId) {
      setHfMessage({ kind: "error", text: "Pega un token o selecciona uno guardado para verificarlo." });
      return;
    }
    setHfBusy("check");
    setHfMessage(null);
    try {
      const result = await window.prosecnurApi.checkHfToken({
        id: hfSelectedTokenId || undefined,
        hf_token: hfToken.trim() || undefined,
      });
      if (result.ok) {
        const orgs = result.org_count ? ` · ${result.org_count} organizaciones visibles` : "";
        if (result.name) setHfUsername((current) => current || result.name);
        setHfMessage({ kind: "ok", text: `Hugging Face responde${result.name ? ` como ${result.name}` : ""}${orgs}.` });
      } else {
        setHfMessage({ kind: "error", text: result.error });
      }
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  async function deleteHfToken(id: string) {
    if (!window.prosecnurApi?.forgetHfToken) return;
    setHfBusy("clear");
    setHfMessage(null);
    try {
      const settings = await window.prosecnurApi.forgetHfToken(id);
      setHfSettings(settings);
      if (hfSelectedTokenId === id) {
        setHfSelectedTokenId("");
        setHfToken("");
      }
      setHfMessage({ kind: "ok", text: "Token de Hugging Face quitado de este equipo." });
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  async function saveHfDefaultNamespace() {
    if (!window.prosecnurApi?.saveHfDefaultNamespace) {
      setHfMessage({ kind: "error", text: "El destino HF se guarda desde la app de escritorio." });
      return;
    }
    const namespace = hfDefaultNamespace.trim();
    if (!namespace || !isValidHfNamespace(namespace)) {
      setHfMessage({ kind: "error", text: `Escribe un namespace HF válido, por ejemplo ${PULSO_HF_DEFAULT_NAMESPACE}.` });
      return;
    }
    setHfBusy("destination");
    setHfMessage(null);
    try {
      const settings = await window.prosecnurApi.saveHfDefaultNamespace(namespace);
      setHfSettings(settings);
      setHfDefaultNamespace(settings.default_namespace || namespace);
      setHfMessage({ kind: "ok", text: `Destino web por defecto guardado: ${namespace}.` });
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  async function deleteHfDestination(id: string) {
    if (!window.prosecnurApi?.forgetHfDestination) return;
    setHfBusy("destination");
    setHfMessage(null);
    try {
      const settings = await window.prosecnurApi.forgetHfDestination(id);
      setHfSettings(settings);
      setHfDefaultNamespace(settings.default_namespace || "");
      setHfMessage({ kind: "ok", text: "Destino HF quitado de los recientes." });
    } catch (error) {
      setHfMessage({ kind: "error", text: String((error as Error)?.message ?? error) });
    } finally {
      setHfBusy(null);
    }
  }

  const sections: {
    id: SettingsTab;
    label: string;
    hint: string;
    Icon: LucideIcon;
    meta: string;
    title: string;
    description: string;
  }[] = [
    {
      id: "appearance",
      label: "Apariencia",
      hint: "Densidad y railes",
      Icon: MonitorCog,
      meta: layoutMeta.label,
      title: "Apariencia",
      description:
        "Elige el perfil de escritorio que guía densidad, railes y toolbars. El tamaño de la ventana no cambia; Prosecnur ajusta su gramática interna.",
    },
    {
      id: "connections",
      label: "Conexiones",
      hint: "Credenciales globales",
      Icon: KeyRound,
      meta: `${configuredCount}/${PROVIDERS.length + 1}`,
      title: "Conexiones",
      description:
        "Credenciales de las herramientas externas que Prosecnur usa fuera de cada proyecto. El archivo .pulso guarda fuentes y snapshots; las claves se quedan en este equipo.",
    },
    {
      id: "notes",
      label: "Novedades",
      hint: "Notas de versión",
      Icon: ScrollText,
      meta: latestNote ? `v${latestNote.version}` : "",
      title: "Notas de versión",
      description: "Qué cambió en cada corte de Prosecnur, del más reciente al más antiguo.",
    },
    {
      id: "credits",
      label: "Créditos",
      hint: "Origen del proyecto",
      Icon: Info,
      meta: "",
      title: "Créditos",
      description: "Para quién y cómo se construyó Prosecnur.",
    },
  ];
  const activeSection = sections.find((section) => section.id === activeTab) ?? sections[0];

  // Portal a body: dentro de .pulso-route-surface cualquier ancestro con
  // transform recortaría el backdrop fixed al área de la ruta.
  return createPortal(
    <>
      <div className="home-settings-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="home-settings-dialog is-split" role="dialog" aria-modal="true" aria-labelledby="home-settings-title">
        <aside className="home-settings-rail">
          <div className="home-settings-rail-brand">
            <span className="home-settings-icon" aria-hidden="true">
              <Settings2 size={17} strokeWidth={2.1} />
            </span>
            <div>
              <span className="home-settings-eyebrow">Prosecnur</span>
              <h3 id="home-settings-title">Configuración</h3>
            </div>
          </div>
          <GlidingTabList as="nav" className="home-settings-nav" activeKey={activeTab} orientation="vertical" role="tablist" aria-label="Secciones de ajustes">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activeTab === section.id}
                data-gliding-key={section.id}
                className={activeTab === section.id ? "is-active" : ""}
                onClick={() => setActiveTab(section.id)}
              >
                <span className="home-settings-nav-icon" aria-hidden="true">
                  <section.Icon size={15} strokeWidth={2} />
                </span>
                <span className="home-settings-nav-text">
                  <strong>{section.label}</strong>
                  <span>{section.hint}</span>
                </span>
                {section.meta && <span className="home-settings-nav-meta">{section.meta}</span>}
              </button>
            ))}
          </GlidingTabList>
        </aside>

        <div className="home-settings-main">
          <header className="home-settings-main-head">
            <div className="home-settings-main-copy">
              <h4>{activeSection.title}</h4>
              <p>{activeSection.description}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="home-settings-close"
              onClick={onClose}
              aria-label="Cerrar ajustes"
            >
              <X size={16} />
            </button>
          </header>

        <div className="home-settings-body">
          {activeTab === "appearance" && (
            <div className="home-settings-panel" role="tabpanel">
              <div className="home-layout-preset-list" role="radiogroup" aria-label="Disposición de pantalla">
                {LAYOUT_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={layoutPreset === option.value}
                    className={`home-layout-preset${layoutPreset === option.value ? " is-active" : ""}`}
                    onClick={() => setLayoutPreset(option.value)}
                  >
                    <span className="home-layout-preset-check" aria-hidden="true">
                      {layoutPreset === option.value && <Check size={13} />}
                    </span>
                    <span className="home-layout-preset-copy">
                      <strong>{option.label}</strong>
                      <small>{option.size}</small>
                      <span>{option.description}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="home-layout-preset-current">
                <span>Activo</span>
                <strong>{layoutMeta.label} · {layoutMeta.size}</strong>
              </div>
            </div>
          )}

          {activeTab === "connections" && (
            <div className="home-settings-panel" role="tabpanel">
              {loadError && (
                <div className="home-settings-alert is-error">
                  <AlertTriangle size={14} />
                  <span>{loadError}</span>
                </div>
              )}
              <div className="home-connection-list" aria-busy={loadingConnections}>
                {PROVIDERS.map((meta) => (
                  <ConnectionCard
                    key={meta.provider}
                    meta={meta}
                    state={connections[meta.provider]}
                    input={inputs[meta.provider]}
                    alias={aliases[meta.provider]}
                    baseUrl={baseUrls[meta.provider]}
                    remember={remember[meta.provider]}
                    busy={busy[meta.provider] ?? null}
                    message={messages[meta.provider] ?? null}
                    onInputChange={(value) => setInputs((current) => ({ ...current, [meta.provider]: value }))}
                    onAliasChange={(value) => setAliases((current) => ({ ...current, [meta.provider]: value }))}
                    onBaseUrlChange={(value) => setBaseUrls((current) => ({ ...current, [meta.provider]: value }))}
                    onRememberChange={(value) => setRemember((current) => ({ ...current, [meta.provider]: value }))}
                    onSave={() => void saveProvider(meta.provider)}
                    onCheck={() => void checkProvider(meta.provider)}
                    onClear={() => void clearProvider(meta.provider)}
                    onSetDefault={(profile) => void setDefaultProfile(meta.provider, profile)}
                    onDeleteProfile={(profile) => void deleteProfile(meta.provider, profile)}
                    authUrl={authUrls[meta.provider] ?? ""}
                    onOpenAuth={() => authUrls[meta.provider] && window.open(authUrls[meta.provider], "_blank", "noopener,noreferrer")}
                  />
                ))}
                <HuggingFaceConnectionCard
                  settings={hfSettings}
                  username={hfUsername}
                  defaultNamespace={hfDefaultNamespace}
                  token={hfToken}
                  tokenName={hfTokenName}
                  selectedTokenId={hfSelectedTokenId}
                  busy={hfBusy}
                  message={hfMessage}
                  desktopAvailable={Boolean(window.prosecnurApi?.getHfSettings)}
                  onUsernameChange={setHfUsername}
                  onDefaultNamespaceChange={setHfDefaultNamespace}
                  onTokenChange={setHfToken}
                  onTokenNameChange={setHfTokenName}
                  onUseSavedToken={useSavedHfToken}
                  onSave={() => void saveHfToken()}
                  onSaveDefaultNamespace={() => void saveHfDefaultNamespace()}
                  onCheck={() => void checkHfToken()}
                  onDelete={(id) => void deleteHfToken(id)}
                  onDeleteDestination={(id) => void deleteHfDestination(id)}
                />
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="home-settings-panel home-settings-panel--notes" role="tabpanel">
              {notes.map((note, idx) => (
                <section key={note.version} className={`home-release ${idx === 0 ? "is-latest" : ""}`}>
                  <header className="home-release-head">
                    <span className="home-release-pill">v{note.version}</span>
                    <span className="home-release-date">{formatDate(note.date)}</span>
                    {idx === 0 && <span className="home-release-now">Actual</span>}
                  </header>
                  <ul className="home-release-notes">
                    {note.highlights.map((highlight, i) => (
                      <li key={i}>
                        <Check size={13} />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {activeTab === "credits" && (
            <div className="home-settings-panel home-credits-body" role="tabpanel">
              <section className="home-credit-section">
                <span className="home-credit-label">Para quién fue hecho</span>
                <p>
                  Prosecnur fue construido para el {pulsoName}, como una herramienta
                  de trabajo para estudios con cuestionarios, bases, validación,
                  codificación, muestreo y reportes.
                </p>
              </section>
              <section className="home-credit-section">
                <span className="home-credit-label">Cómo nació</span>
                <p>
                  El proyecto empezó como una forma de ordenar tareas repetitivas
                  del flujo de investigación aplicada: revisar instrumentos,
                  normalizar datos, documentar decisiones y convertir análisis en
                  entregables claros.
                </p>
              </section>
              <section className="home-credit-section">
                <span className="home-credit-label">Construcción</span>
                <p>
                  Gonzalo Almendáriz viene diseñando y desarrollando Prosecnur en
                  diálogo con las necesidades cotidianas del equipo.
                </p>
              </section>
            </div>
          )}
        </div>
        </div>
      </section>
    </>,
    document.body,
  );
}

function HuggingFaceConnectionCard({
  settings,
  username,
  defaultNamespace,
  token,
  tokenName,
  selectedTokenId,
  busy,
  message,
  desktopAvailable,
  onUsernameChange,
  onDefaultNamespaceChange,
  onTokenChange,
  onTokenNameChange,
  onUseSavedToken,
  onSave,
  onSaveDefaultNamespace,
  onCheck,
  onDelete,
  onDeleteDestination,
}: {
  settings: HfSettingsState;
  username: string;
  defaultNamespace: string;
  token: string;
  tokenName: string;
  selectedTokenId: string;
  busy: HfBusyState;
  message: HfMessage;
  desktopAvailable: boolean;
  onUsernameChange: (value: string) => void;
  onDefaultNamespaceChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onTokenNameChange: (value: string) => void;
  onUseSavedToken: (id: string) => void;
  onSave: () => void;
  onSaveDefaultNamespace: () => void;
  onCheck: () => void;
  onDelete: (id: string) => void;
  onDeleteDestination: (id: string) => void;
}) {
  const savedTokens = settings.saved_tokens ?? [];
  const usableTokens = savedTokens.filter((item) => !item.requires_reauth);
  const destinations = settings.recent_destinations ?? [];
  const selected = savedTokens.find((item) => item.id === selectedTokenId) ?? usableTokens[0] ?? savedTokens[0] ?? null;
  const hasTokens = usableTokens.length > 0;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const effectiveDefaultNamespace = defaultNamespace.trim() || settings.default_namespace || destinations[0]?.namespace || PULSO_HF_DEFAULT_NAMESPACE;
  const defaultDestination = destinations.find((item) => item.namespace === effectiveDefaultNamespace) ?? destinations[0] ?? null;
  const canSave = desktopAvailable && busy == null && token.trim().length > 0;
  const selectedToken = savedTokens.find((item) => item.id === selectedTokenId);
  const canCheck = desktopAvailable && busy == null && (
    token.trim().length > 0 ||
    Boolean(selectedTokenId && selectedToken && !selectedToken.requires_reauth)
  );
  const canSaveNamespace = desktopAvailable && busy == null && isValidHfNamespace(defaultNamespace);

  return (
    <article className="home-connection-card home-connection-card--hf">
      <div className="home-connection-top">
        <span className="home-connection-icon" aria-hidden="true">
          <Cloud size={18} strokeWidth={2.1} />
        </span>
        <div className="home-connection-title">
          <h4>Hugging Face Spaces</h4>
          <p>Publicación web de dashboards derivados.</p>
        </div>
        <span className={`home-connection-status ${hasTokens ? "is-ready" : ""}`}>
          {hasTokens ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {hasTokens
            ? "Token guardado en este equipo"
            : savedTokens.length
              ? "Reautenticación requerida"
              : "Sin token HF"}
        </span>
      </div>

      <div className="home-hf-current-grid">
        {hasTokens && selected ? (
          <div className="home-connection-current">
            <span>Credencial local</span>
            <strong>{selected.name || selected.hf_username || "Token HF"}</strong>
            <small>
              {selected.hf_username ? `Cuenta/alias ${selected.hf_username}` : "Cuenta HF no verificada"} · {selected.masked_token || "••••"}
              {selected.requires_reauth ? " · vuelve a autenticar" : ""}
            </small>
          </div>
        ) : (
          <div className="home-connection-empty">
            <span>Pendiente</span>
            <strong>Conecta un token write para publicar Spaces.</strong>
          </div>
        )}
        {effectiveDefaultNamespace ? (
          <div className="home-connection-current home-connection-current--destination">
            <span>Destino web por defecto</span>
            <strong>{effectiveDefaultNamespace}</strong>
            <small>{defaultDestination ? hfDestinationLabel(defaultDestination) : "Namespace usado para nuevas publicaciones"}</small>
          </div>
        ) : (
          <div className="home-connection-empty">
            <span>Sin destino</span>
            <strong>Define o usa {PULSO_HF_DEFAULT_NAMESPACE}.</strong>
          </div>
        )}
      </div>

      <details className="home-connection-details" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>
          <span>Configurar publicación</span>
          <small>{hasTokens ? `${savedTokens.length} ${savedTokens.length === 1 ? "token" : "tokens"}` : "Token requerido"} · {effectiveDefaultNamespace || "sin namespace"}</small>
        </summary>

        {savedTokens.length > 0 && (
          <div className="home-connection-profiles" aria-label="Tokens de Hugging Face">
            <div className="home-connection-profiles-head">
              <span>Tokens de publicación</span>
              <small>{savedTokens.length} {savedTokens.length === 1 ? "token" : "tokens"}</small>
            </div>
            <div className="home-connection-profile-list">
              {savedTokens.map((saved) => (
                <div key={saved.id} className={`home-connection-profile ${saved.id === selectedTokenId ? "is-default" : ""}`}>
                  <div className="home-connection-profile-copy">
                    <strong>{saved.name || "Token HF"}</strong>
                    <small>
                      {saved.hf_username ? `Cuenta/alias ${saved.hf_username}` : "Cuenta HF no verificada"} · {saved.masked_token || "••••"}
                      {saved.requires_reauth ? " · almacenamiento anterior no seguro" : ""}
                    </small>
                  </div>
                  <div className="home-connection-profile-actions">
                    <button type="button" onClick={() => onUseSavedToken(saved.id)} disabled={busy != null}>
                      {saved.requires_reauth
                        ? "Reautenticar"
                        : busy === "load" && saved.id === selectedTokenId
                          ? "Abriendo"
                          : "Usar"}
                    </button>
                    <button type="button" className="is-danger" onClick={() => onDelete(saved.id)} disabled={busy != null}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p>Se usa al publicar Dashboard. Los XLSX y Sheets de Monitoreo usan la conexión Google Sheets.</p>
          </div>
        )}

        {destinations.length > 0 && (
          <div className="home-connection-profiles home-hf-destination-list" aria-label="Destinos recientes de Hugging Face">
            <div className="home-connection-profiles-head">
              <span>Destinos recientes</span>
              <small>{destinations.length} {destinations.length === 1 ? "destino" : "destinos"}</small>
            </div>
            <div className="home-connection-profile-list">
              {destinations.map((destination) => (
                <div key={destination.id} className={`home-connection-profile ${destination.namespace === effectiveDefaultNamespace ? "is-default" : ""}`}>
                  <div className="home-connection-profile-copy">
                    <strong>{hfDestinationLabel(destination)}</strong>
                    <small>{destination.private ? "Privado" : "No marcado privado"}{destination.audience ? ` · ${destination.audience}` : ""}</small>
                  </div>
                  <div className="home-connection-profile-actions">
                    <button type="button" onClick={() => onDefaultNamespaceChange(destination.namespace)} disabled={busy != null || !destination.namespace}>
                      Usar
                    </button>
                    <button type="button" className="is-danger" onClick={() => onDeleteDestination(destination.id)} disabled={busy != null}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p>Estos destinos no contienen secretos; sirven para no confundir la cuenta del token con el namespace donde se publica.</p>
          </div>
        )}

        <div className="home-connection-form">
          <label>
            <span>Cuenta o alias de la credencial</span>
            <small>No define el destino. Sirve para reconocer qué token local estás usando.</small>
            <input
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder={PULSO_HF_DEFAULT_TOKEN_ALIAS}
              disabled={busy != null || !desktopAvailable}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>Namespace destino por defecto</span>
            <small>Ejemplo: {PULSO_HF_DEFAULT_NAMESPACE}. El Space se elige en Dashboard o Monitoreo.</small>
            <input
              type="text"
              value={defaultNamespace}
              onChange={(event) => onDefaultNamespaceChange(event.target.value.trim())}
              placeholder={PULSO_HF_DEFAULT_NAMESPACE}
              disabled={busy != null || !desktopAvailable}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label>
            <span>Alias del token</span>
            <input
              type="text"
              value={tokenName}
              onChange={(event) => onTokenNameChange(event.target.value)}
              placeholder={PULSO_HF_DEFAULT_TOKEN_ALIAS}
              disabled={busy != null || !desktopAvailable}
            />
          </label>
          <label>
            <span>Token write</span>
            <small>Permite crear o actualizar Spaces. No se guarda dentro del proyecto .pulso.</small>
            <input
              className="home-secret-input is-masked"
              type="text"
              value={token}
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder={hasTokens ? "Pegar para reemplazar o crear token" : "hf_..."}
              disabled={busy != null || !desktopAvailable}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </label>
        </div>

        <div className="home-connection-actions">
          <button type="button" className="is-primary" onClick={onSave} disabled={!canSave}>
            {busy === "save" ? <Loader2 size={13} className="pulso-spin" /> : <KeyRound size={13} />}
            Guardar token
          </button>
          <button type="button" onClick={onSaveDefaultNamespace} disabled={!canSaveNamespace}>
            {busy === "destination" ? <Loader2 size={13} className="pulso-spin" /> : <Cloud size={13} />}
            Guardar destino
          </button>
          <button
            type="button"
            onClick={onCheck}
            disabled={!canCheck}
            title="Consulta whoami en Hugging Face; los permisos concretos del Space se validan al publicar."
            aria-label="Verificar token de Hugging Face"
          >
            {busy === "check" ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Verificar alcance
          </button>
          <button type="button" onClick={() => onDefaultNamespaceChange(PULSO_HF_DEFAULT_NAMESPACE)} disabled={busy != null || !desktopAvailable}>
            <Cloud size={13} />
            Usar {PULSO_HF_DEFAULT_NAMESPACE}
          </button>
          <button type="button" onClick={openHuggingFaceTokens}>
            <ExternalLink size={13} />
            Crear token HF
          </button>
        </div>

        <p className="home-connection-verify-note">
          <RefreshCw size={12} aria-hidden="true" />
          <span>{desktopAvailable ? "Valida el token contra Hugging Face; la publicación confirma permisos del Space destino." : "Disponible al abrir Prosecnur como app de escritorio."}</span>
        </p>
      </details>

      {message && (
        <div className={`home-settings-alert ${message.kind === "error" ? "is-error" : "is-ok"}`}>
          {message.kind === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
          <span>{message.text}</span>
        </div>
      )}
    </article>
  );
}

function ConnectionCard({
  meta,
  state,
  input,
  alias,
  baseUrl,
  remember,
  busy,
  message,
  onInputChange,
  onAliasChange,
  onBaseUrlChange,
  onRememberChange,
  onSave,
  onCheck,
  onClear,
  onSetDefault,
  onDeleteProfile,
  authUrl,
  onOpenAuth,
}: {
  meta: ProviderMeta;
  state: ConnectionTokenState;
  input: string;
  alias: string;
  baseUrl: string;
  remember: boolean;
  busy: "save" | "check" | "clear" | null;
  message: { kind: "ok" | "error"; text: string } | null;
  onInputChange: (value: string) => void;
  onAliasChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSave: () => void;
  onCheck: () => void;
  onClear: () => void;
  onSetDefault: (profile: ConnectionProfileState) => void;
  onDeleteProfile: (profile: ConnectionProfileState) => void;
  authUrl: string;
  onOpenAuth: () => void;
}) {
  const Icon = meta.Icon;
  const hasInput = input.trim().length > 0;
  const canCheck = state.has_token && busy == null;
  const canClear = state.has_token && busy == null;
  const supportsSession = meta.provider === "surveymonkey";
  const supportsProfiles = meta.provider === "surveymonkey" || meta.provider === "kobo";
  const isKobo = meta.provider === "kobo";
  const isOAuth = meta.credentialKind === "oauth";
  const profiles = supportsProfiles ? state.profiles ?? [] : [];
  const koboServerSelectValue = KOBO_SERVER_OPTIONS.some((option) => option.value === baseUrl) ? baseUrl : "custom";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saveLabel = isOAuth
    ? "Autorizar cuenta"
    : supportsProfiles && (!supportsSession || remember)
    ? alias.trim()
      ? "Guardar perfil"
      : "Actualizar activo"
    : "Actualizar";

  return (
    <article className="home-connection-card">
      <div className="home-connection-top">
        <span className="home-connection-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={2.1} />
        </span>
        <div className="home-connection-title">
          <h4>{meta.title}</h4>
          <p>{meta.subtitle}</p>
        </div>
        <span className={`home-connection-status ${state.has_token ? "is-ready" : ""}`}>
          {state.has_token ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {connectionStatusLabel(meta, state)}
        </span>
      </div>

      {state.has_token ? (
        <div className="home-connection-current">
          <span>{isOAuth ? "Autorización activa" : "Credencial activa"}</span>
          <strong>{activeConnectionLabel(meta, state)}</strong>
          <small>{activeConnectionDetail(meta, state)}</small>
        </div>
      ) : (
        <div className="home-connection-empty">
          <span>Pendiente</span>
          <strong>{meta.emptyHelp}</strong>
        </div>
      )}

      <details className="home-connection-details" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>
          <span>Configurar credencial</span>
          <small>{supportsProfiles ? `${profiles.length} ${profiles.length === 1 ? "perfil" : "perfiles"}` : isOAuth ? "OAuth local" : "Token API"}</small>
        </summary>

        {supportsProfiles && profiles.length > 0 && (
          <div className="home-connection-profiles" aria-label={`Perfiles ${meta.title}`}>
            <div className="home-connection-profiles-head">
              <span>Perfiles de acceso</span>
              <small>{profiles.length} {profiles.length === 1 ? "perfil" : "perfiles"}</small>
            </div>
            <div className="home-connection-profile-list">
              {profiles.map((profile) => (
                <div key={profile.id} className={`home-connection-profile ${profile.is_default ? "is-default" : ""}`}>
                  <div className="home-connection-profile-copy">
                    <strong>{profile.alias}</strong>
                    <small>
                      {profileDetail(profile, isKobo)}
                    </small>
                  </div>
                  <div className="home-connection-profile-actions">
                    {!profile.is_default && (
                      <button type="button" onClick={() => onSetDefault(profile)} disabled={busy != null}>
                        Activar
                      </button>
                    )}
                    <button type="button" className="is-danger" onClick={() => onDeleteProfile(profile)} disabled={busy != null}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p>
              {isKobo
                ? "Cada perfil fija servidor y clave. Prosecnur usa solo el perfil activo al leer assets y respuestas."
                : "Prosecnur usa solo el perfil activo. Si necesitas otra clave, actívala antes de importar."}
            </p>
          </div>
        )}

        <div className="home-connection-form">
          {supportsProfiles && (!supportsSession || remember) && (
            <label>
              <span>Alias del perfil</span>
              <input
                type="text"
                value={alias}
                onChange={(event) => onAliasChange(event.target.value)}
                placeholder={state.active_profile_alias || "Principal"}
                disabled={busy != null}
              />
            </label>
          )}
          {isKobo && (
            <>
              <label>
                <span>Servidor Kobo</span>
                <select
                  value={koboServerSelectValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    onBaseUrlChange(value === "custom" ? baseUrl || KOBO_DEFAULT_BASE_URL : value);
                  }}
                  disabled={busy != null}
                >
                  {KOBO_SERVER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </label>
              {koboServerSelectValue === "custom" && (
                <label>
                  <span>URL del servidor</span>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(event) => onBaseUrlChange(event.target.value)}
                    placeholder="https://kobo.example.org"
                    disabled={busy != null}
                  />
                </label>
              )}
            </>
          )}
          <label>
            <span>{meta.inputLabel}</span>
            <small>{meta.inputHelp}</small>
            {isOAuth ? (
              <textarea
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={meta.inputPlaceholder}
                rows={4}
                disabled={busy != null}
              />
            ) : (
              <input
                type="password"
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={state.has_token ? "Pegar para reemplazar o crear perfil" : meta.inputPlaceholder}
                disabled={busy != null}
              />
            )}
          </label>
          {supportsSession && (
            <label className="home-connection-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => onRememberChange(event.target.checked)}
                disabled={busy != null}
              />
              <span>Recordar en este equipo</span>
            </label>
          )}
        </div>

        <div className="home-connection-actions">
          <button type="button" className="is-primary" onClick={onSave} disabled={!hasInput || busy != null}>
            {busy === "save" ? <Loader2 size={13} className="pulso-spin" /> : <KeyRound size={13} />}
            {saveLabel}
          </button>
          {isOAuth && authUrl && (
            <button type="button" onClick={onOpenAuth} disabled={!authUrl || busy != null}>
              <ExternalLink size={13} />
              Continuar en Google
            </button>
          )}
          <button
            type="button"
            onClick={onCheck}
            disabled={!canCheck}
            title={meta.verifyHint}
            aria-label={`Verificar alcance de ${meta.title}`}
          >
            {busy === "check" ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
            Verificar alcance
          </button>
          <button type="button" className="is-danger" onClick={onClear} disabled={!canClear}>
            {busy === "clear" ? <Loader2 size={13} className="pulso-spin" /> : <Trash2 size={13} />}
            Quitar
          </button>
        </div>

        <p className="home-connection-verify-note">
          <RefreshCw size={12} aria-hidden="true" />
          <span>{meta.verifyHint}</span>
        </p>
      </details>

      {message && (
        <div className={`home-settings-alert ${message.kind === "error" ? "is-error" : "is-ok"}`}>
          {message.kind === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
          <span>{message.text}</span>
        </div>
      )}
    </article>
  );
}
