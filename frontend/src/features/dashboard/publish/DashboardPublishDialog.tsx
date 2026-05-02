import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Rocket, X } from "lucide-react";
import { apiDashboardConfigPut, apiDashboardPublish, type DashboardLastDeploy } from "../../../api/client";
import type { HfSavedToken } from "../../project/types";
import { sanitizeConfig, useDashboardStore } from "../store";

type Props = {
  defaultTitle: string;
  lastDeploy?: DashboardLastDeploy;
  onClose: () => void;
};

function slugifySpace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function DashboardPublishDialog({ defaultTitle, lastDeploy, onClose }: Props) {
  const [username, setUsername] = useState(lastDeploy?.hf_username ?? "");
  const [token, setToken] = useState("");
  const [tokenName, setTokenName] = useState("GIZ");
  const [savedTokens, setSavedTokens] = useState<HfSavedToken[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState("");
  // Pre-llenar con el space_name del último deploy si existe → re-publish
  // al MISMO Space sin que el usuario tenga que recordar el nombre.
  const [spaceName, setSpaceName] = useState(
    () => lastDeploy?.space_name ?? slugifySpace(defaultTitle || "pulso-dashboard"),
  );
  const [isPrivate, setIsPrivate] = useState(lastDeploy?.private ?? false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; app_url: string; repo_id: string } | null>(null);

  const canPublish = useMemo(
    () => !!username.trim() && /^hf_[A-Za-z0-9_]+$/.test(token.trim()) && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(spaceName.trim()),
    [username, token, spaceName],
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!window.prosecnurApi?.getHfSettings) {
        setLoadingSettings(false);
        return;
      }
      try {
        const settings = await window.prosecnurApi.getHfSettings();
        if (!alive) return;
        setUsername(settings.hf_username ?? "");
        setSavedTokens(settings.saved_tokens ?? []);
      } catch (_e) {
        // La app puede correr fuera de Electron. En ese caso el usuario
        // escribe los campos manualmente y el publish sigue funcionando.
      } finally {
        if (alive) setLoadingSettings(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  async function handleSavedTokenChange(id: string) {
    setSelectedTokenId(id);
    if (!id || !window.prosecnurApi?.getHfToken) return;
    setLoadingSettings(true);
    try {
      const saved = await window.prosecnurApi.getHfToken(id);
      if (!saved) return;
      setUsername(saved.hf_username ?? "");
      setToken(saved.hf_token ?? "");
      setTokenName(saved.name ?? "GIZ");
    } finally {
      setLoadingSettings(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canPublish || publishing) return;
    setPublishing(true);
    setError("");
    setResult(null);
    try {
      await apiDashboardConfigPut(sanitizeConfig(useDashboardStore.getState().config));
      window.dispatchEvent(new CustomEvent("pulso:project-status-changed"));
      useDashboardStore.getState().markClean();
      const out = await apiDashboardPublish({
        hf_username: username.trim(),
        hf_token: token.trim(),
        space_name: spaceName.trim(),
        private: isPrivate,
      });
      if (window.prosecnurApi?.rememberSuccessfulHfToken) {
        const settings = await window.prosecnurApi.rememberSuccessfulHfToken({
          name: tokenName.trim() || username.trim(),
          hf_username: username.trim(),
          hf_token: token.trim(),
        });
        setSavedTokens(settings.saved_tokens ?? []);
      }
      setResult({ url: out.url, app_url: out.app_url, repo_id: out.repo_id });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  function openUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="dash-modal-backdrop" onClick={publishing ? undefined : onClose}>
      <form
        className="dash-modal dash-publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-publish-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="dash-modal-head">
          <div>
            <h2 id="dash-publish-title">Publicar dashboard</h2>
            <p>Sube el proyecto actual a un Hugging Face Space con Docker.</p>
          </div>
          <button type="button" className="dash-publish-close" onClick={onClose} disabled={publishing}>
            <X size={16} />
          </button>
        </header>

        <div className="dash-publish-grid">
          {savedTokens.length > 0 && (
            <label className="dash-publish-wide">
              Token guardado
              <select
                value={selectedTokenId}
                onChange={(e) => void handleSavedTokenChange(e.target.value)}
                disabled={publishing || loadingSettings}
              >
                <option value="">Usar otro token...</option>
                {savedTokens.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name} · {saved.hf_username} · {saved.masked_token}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Usuario u organización HF
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="prosecnur"
              autoComplete="username"
              disabled={publishing || loadingSettings}
            />
          </label>
          <label>
            Token write
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="hf_..."
              type="password"
              autoComplete="off"
              disabled={publishing || loadingSettings}
            />
          </label>
          <label className="dash-publish-wide">
            Recordar token como
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="GIZ"
              disabled={publishing || loadingSettings}
            />
          </label>
          <label className="dash-publish-wide">
            Nombre del Space
            <input
              value={spaceName}
              onChange={(e) => setSpaceName(slugifySpace(e.target.value))}
              placeholder="pulso-cliente"
              disabled={publishing}
            />
          </label>
          <label className="dash-publish-check">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              disabled={publishing}
            />
            Crear como privado
          </label>
        </div>

        {publishing && (
          <div className="dash-publish-status">
            <Loader2 size={16} className="dash-admin-spin" />
            <span>Subiendo archivos y disparando build en HF. La primera construcción suele tomar ~10 min.</span>
          </div>
        )}

        {error && <div className="dash-admin-toolbar-error" role="alert">{error}</div>}

        {result && (
          <div className="dash-publish-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>{result.repo_id}</strong>
              <span>HF ya recibió el Space. El dashboard aparecerá cuando termine el build.</span>
            </div>
            <button type="button" onClick={() => openUrl(result.app_url)}>
              <ExternalLink size={13} /> Abrir
            </button>
          </div>
        )}

        <footer className="dash-publish-actions">
          <button type="button" onClick={onClose} disabled={publishing}>Cerrar</button>
          <button type="submit" className="dash-publish-primary" disabled={!canPublish || publishing || loadingSettings}>
            {publishing ? <Loader2 size={14} className="dash-admin-spin" /> : <Rocket size={14} />}
            Publicar
          </button>
        </footer>
      </form>
    </div>
  );
}
