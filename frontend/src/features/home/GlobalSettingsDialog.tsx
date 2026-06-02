import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  apiConnectionCheck,
  apiConnectionProfileDelete,
  apiConnectionProfileSave,
  apiConnectionProfileSetDefault,
  apiConnectionTokenClear,
  apiConnectionTokenSave,
  apiConnectionsList,
  type ConnectionCheckResult,
  type ConnectionProfileState,
  type ConnectionProvider,
  type ConnectionTokenState,
} from "../../api/client";
import type { ReleaseNote } from "./ReleaseNotesDrawer";

type SettingsTab = "connections" | "notes" | "credits";

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
  Icon: typeof Cloud;
};

const PROVIDERS: ProviderMeta[] = [
  {
    provider: "surveymonkey",
    title: "SurveyMonkey",
    subtitle: "Editor XLSForm, importación multibase y Monitoreo.",
    Icon: Cloud,
  },
  {
    provider: "kobo",
    title: "KoboToolbox",
    subtitle: "Monitoreo de campo y conexiones de captura.",
    Icon: Database,
  },
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

function connectionStatusLabel(state: ConnectionTokenState): string {
  if (!state.has_token) return "No configurada";
  if (state.ephemeral) return "Solo esta sesión";
  if (state.persisted) return "Guardada en este equipo";
  return "Configurada";
}

function checkMessage(provider: ConnectionProvider, result: ConnectionCheckResult): string {
  if (!result.ok) return result.error;
  if (provider === "surveymonkey") {
    const n = result.n_surveys_visible;
    return n == null ? "Conexión verificada." : `Conexión verificada · ${n} encuestas visibles.`;
  }
  const count = result.count;
  return count == null ? "Conexión verificada." : `Conexión verificada · ${count} assets visibles.`;
}

export function GlobalSettingsDialog({ open, notes, pulsoName, onClose }: GlobalSettingsDialogProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("connections");
  const [connections, setConnections] = useState<Record<ConnectionProvider, ConnectionTokenState>>(EMPTY_CONNECTIONS);
  const [inputs, setInputs] = useState<Record<ConnectionProvider, string>>({ surveymonkey: "", kobo: "" });
  const [aliases, setAliases] = useState<Record<ConnectionProvider, string>>({ surveymonkey: "", kobo: "" });
  const [remember, setRemember] = useState<Record<ConnectionProvider, boolean>>({ surveymonkey: true, kobo: true });
  const [busy, setBusy] = useState<Partial<Record<ConnectionProvider, "save" | "check" | "clear">>>({});
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<Partial<Record<ConnectionProvider, { kind: "ok" | "error"; text: string }>>>({});

  const latestNote = notes[0];
  const configuredCount = useMemo(
    () => Object.values(connections).filter((item) => item.has_token).length,
    [connections],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    setActiveTab("connections");
    setLoadError("");
    setMessages({});
    setLoadingConnections(true);
    let cancelled = false;
    apiConnectionsList()
      .then((result) => {
        if (cancelled) return;
        const next = normalizeConnections(result.connections);
        setConnections(next);
        setRemember({
          surveymonkey: next.surveymonkey.persisted || !next.surveymonkey.has_token,
          kobo: true,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(String((error as Error)?.message ?? error));
      })
      .finally(() => {
        if (!cancelled) setLoadingConnections(false);
      });
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
    const token = inputs[provider].trim();
    if (!token) {
      setProviderMessage(provider, "error", "Pega una clave API nueva para actualizarla.");
      return;
    }
    setProviderBusy(provider, "save");
    try {
      const aliasInput = aliases[provider].trim();
      const next = provider === "surveymonkey" && remember[provider]
        ? await apiConnectionProfileSave(provider, token, {
            alias: aliasInput || connections[provider].active_profile_alias || "Principal",
            profile_id: aliasInput ? undefined : connections[provider].active_profile_id || undefined,
            make_default: true,
          })
        : await apiConnectionTokenSave(provider, token, { persist: remember[provider] });
      mergeConnection(next);
      setInputs((current) => ({ ...current, [provider]: "" }));
      setAliases((current) => ({ ...current, [provider]: "" }));
      setProviderMessage(provider, "ok", "Clave actualizada.");
    } catch (error) {
      setProviderMessage(provider, "error", String((error as Error)?.message ?? error));
    } finally {
      setProviderBusy(provider, null);
    }
  }

  async function checkProvider(provider: ConnectionProvider) {
    setProviderBusy(provider, "check");
    try {
      const result = await apiConnectionCheck(provider);
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
      setProviderMessage(provider, "ok", "Clave quitada.");
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

  return (
    <>
      <div className="home-settings-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="home-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="home-settings-title">
        <header className="home-settings-head">
          <span className="home-settings-icon" aria-hidden="true">
            <Settings2 size={18} strokeWidth={2.1} />
          </span>
          <div>
            <span className="home-settings-eyebrow">Prosecnur</span>
            <h3 id="home-settings-title">Ajustes</h3>
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

        <nav className="home-settings-tabs" role="tablist" aria-label="Secciones de ajustes">
          <button type="button" className={activeTab === "connections" ? "is-active" : ""} onClick={() => setActiveTab("connections")}>
            Conexiones
            <span>{configuredCount}/2</span>
          </button>
          <button type="button" className={activeTab === "notes" ? "is-active" : ""} onClick={() => setActiveTab("notes")}>
            Notas
            {latestNote && <span>v{latestNote.version}</span>}
          </button>
          <button type="button" className={activeTab === "credits" ? "is-active" : ""} onClick={() => setActiveTab("credits")}>
            Créditos
          </button>
        </nav>

        <div className="home-settings-body">
          {activeTab === "connections" && (
            <div className="home-settings-panel" role="tabpanel">
              <div className="home-settings-panel-copy">
                <KeyRound size={15} aria-hidden="true" />
                <p>Las claves quedan cifradas en este equipo y no viajan dentro del archivo .pulso.</p>
              </div>
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
                    remember={remember[meta.provider]}
                    busy={busy[meta.provider] ?? null}
                    message={messages[meta.provider] ?? null}
                    onInputChange={(value) => setInputs((current) => ({ ...current, [meta.provider]: value }))}
                    onAliasChange={(value) => setAliases((current) => ({ ...current, [meta.provider]: value }))}
                    onRememberChange={(value) => setRemember((current) => ({ ...current, [meta.provider]: value }))}
                    onSave={() => void saveProvider(meta.provider)}
                    onCheck={() => void checkProvider(meta.provider)}
                    onClear={() => void clearProvider(meta.provider)}
                    onSetDefault={(profile) => void setDefaultProfile(meta.provider, profile)}
                    onDeleteProfile={(profile) => void deleteProfile(meta.provider, profile)}
                  />
                ))}
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
      </section>
    </>
  );
}

function ConnectionCard({
  meta,
  state,
  input,
  alias,
  remember,
  busy,
  message,
  onInputChange,
  onAliasChange,
  onRememberChange,
  onSave,
  onCheck,
  onClear,
  onSetDefault,
  onDeleteProfile,
}: {
  meta: ProviderMeta;
  state: ConnectionTokenState;
  input: string;
  alias: string;
  remember: boolean;
  busy: "save" | "check" | "clear" | null;
  message: { kind: "ok" | "error"; text: string } | null;
  onInputChange: (value: string) => void;
  onAliasChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onSave: () => void;
  onCheck: () => void;
  onClear: () => void;
  onSetDefault: (profile: ConnectionProfileState) => void;
  onDeleteProfile: (profile: ConnectionProfileState) => void;
}) {
  const Icon = meta.Icon;
  const hasInput = input.trim().length > 0;
  const canCheck = state.has_token && busy == null;
  const canClear = state.has_token && busy == null;
  const supportsSession = meta.provider === "surveymonkey";
  const profiles = supportsSession ? state.profiles ?? [] : [];
  const saveLabel = supportsSession && remember
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
          {connectionStatusLabel(state)}
        </span>
      </div>

      {state.has_token && (
        <div className="home-connection-mask">
          <span>{supportsSession && state.active_profile_alias ? `Perfil activo · ${state.active_profile_alias}` : "Clave activa"}</span>
          <code>{state.masked_token}</code>
        </div>
      )}

      {supportsSession && profiles.length > 0 && (
        <div className="home-connection-profiles" aria-label="Perfiles SurveyMonkey">
          <div className="home-connection-profiles-head">
            <span>Perfiles guardados</span>
            <small>{profiles.length} {profiles.length === 1 ? "perfil" : "perfiles"}</small>
          </div>
          <div className="home-connection-profile-list">
            {profiles.map((profile) => (
              <div key={profile.id} className={`home-connection-profile ${profile.is_default ? "is-default" : ""}`}>
                <div>
                  <strong>{profile.alias}</strong>
                  <small>
                    {profile.is_default ? "Predeterminado" : "Disponible"}
                    {profile.masked_token ? ` · ${profile.masked_token}` : ""}
                  </small>
                </div>
                <div className="home-connection-profile-actions">
                  {!profile.is_default && (
                    <button type="button" onClick={() => onSetDefault(profile)} disabled={busy != null}>
                      Usar
                    </button>
                  )}
                  <button type="button" className="is-danger" onClick={() => onDeleteProfile(profile)} disabled={busy != null}>
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p>El cambio de perfil es manual. Prosecnur no rota tokens automáticamente para sortear límites de la API.</p>
        </div>
      )}

      <div className="home-connection-form">
        {supportsSession && remember && (
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
        <label>
          <span>Nueva clave API</span>
          <input
            type="password"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={state.has_token ? "Pegar para reemplazar o crear perfil" : "Pegar clave API"}
            disabled={busy != null}
          />
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
        <button type="button" onClick={onCheck} disabled={!canCheck}>
          {busy === "check" ? <Loader2 size={13} className="pulso-spin" /> : <RefreshCw size={13} />}
          Probar
        </button>
        <button type="button" className="is-danger" onClick={onClear} disabled={!canClear}>
          {busy === "clear" ? <Loader2 size={13} className="pulso-spin" /> : <Trash2 size={13} />}
          Quitar
        </button>
      </div>

      {message && (
        <div className={`home-settings-alert ${message.kind === "error" ? "is-error" : "is-ok"}`}>
          {message.kind === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
          <span>{message.text}</span>
        </div>
      )}
    </article>
  );
}
