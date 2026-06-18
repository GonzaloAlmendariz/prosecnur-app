import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Rocket, X } from "lucide-react";
import { apiDashboardConfigPut, apiDashboardPublish, type DashboardLastDeploy } from "../../../api/client";
import {
  openHuggingFaceTokens,
  PULSO_HF_DEFAULT_NAMESPACE,
  PULSO_HF_DEFAULT_TOKEN_ALIAS,
} from "../../../lib/huggingFace";
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
  const [tokenName, setTokenName] = useState(PULSO_HF_DEFAULT_TOKEN_ALIAS);
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
  const selectedSavedToken = savedTokens.find((saved) => saved.id === selectedTokenId) ?? null;
  const hfCredentialReady = selectedTokenId ? true : /^hf_[A-Za-z0-9_]+$/.test(token.trim());

  const canPublish = useMemo(
    () => !!username.trim() && hfCredentialReady && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(spaceName.trim()),
    [username, hfCredentialReady, spaceName],
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!window.prosecnurApi?.getHfSettings) {
        setUsername((current) => current || PULSO_HF_DEFAULT_NAMESPACE);
        setLoadingSettings(false);
        return;
      }
      try {
        const settings = await window.prosecnurApi.getHfSettings();
        if (!alive) return;
        setUsername(lastDeploy?.hf_username || settings.default_namespace || settings.recent_destinations?.[0]?.namespace || PULSO_HF_DEFAULT_NAMESPACE);
        const nextTokens = settings.saved_tokens ?? [];
        setSavedTokens(nextTokens);
        if (nextTokens.length) {
          setSelectedTokenId((current) => current || nextTokens[0].id);
          setToken("");
          setTokenName(nextTokens[0].name || PULSO_HF_DEFAULT_TOKEN_ALIAS);
        }
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
    setToken("");
    const saved = savedTokens.find((item) => item.id === id);
    if (saved) setTokenName(saved.name || PULSO_HF_DEFAULT_TOKEN_ALIAS);
  }

  async function resolveHfTokenForPublish() {
    const pasted = token.trim();
    if (pasted) return pasted;
    if (!selectedTokenId) return "";
    if (!window.prosecnurApi?.getHfToken) {
      throw new Error("No pude leer la credencial guardada de Hugging Face en esta sesion.");
    }
    const saved = await window.prosecnurApi.getHfToken(selectedTokenId);
    const savedToken = saved?.hf_token?.trim() ?? "";
    if (!savedToken) {
      throw new Error("La credencial guardada no pudo descifrarse. Selecciona otro token o pegalo manualmente.");
    }
    setTokenName(saved?.name || tokenName || PULSO_HF_DEFAULT_TOKEN_ALIAS);
    return savedToken;
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
      const hfToken = await resolveHfTokenForPublish();
      const out = await apiDashboardPublish({
        hf_username: username.trim(),
        hf_token: hfToken,
        space_name: spaceName.trim(),
        private: isPrivate,
      });
      if (window.prosecnurApi?.rememberSuccessfulHfToken) {
        const settings = await window.prosecnurApi.rememberSuccessfulHfToken({
          id: selectedTokenId || undefined,
          name: tokenName.trim() || username.trim(),
          credential_username: savedTokens.find((saved) => saved.id === selectedTokenId)?.hf_username || "",
          destination_namespace: username.trim(),
          space_name: spaceName.trim(),
          repo_id: out.repo_id,
          app_url: out.app_url,
          module: "dashboard",
          private: isPrivate,
          hf_token: hfToken,
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
                    {saved.name} · {saved.hf_username ? `cuenta ${saved.hf_username}` : "sin cuenta verificada"} · {saved.masked_token}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedSavedToken ? (
            <div className="dash-publish-saved-credential dash-publish-wide">
              <span>Credencial activa</span>
              <strong>{selectedSavedToken.name || "Token HF"}</strong>
              <small>{selectedSavedToken.hf_username ? `Cuenta/alias ${selectedSavedToken.hf_username}` : "Cuenta HF no verificada"} · se descifra solo al publicar.</small>
            </div>
          ) : null}
          <label>
            Namespace destino HF
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={PULSO_HF_DEFAULT_NAMESPACE}
              autoComplete="off"
              disabled={publishing || loadingSettings}
            />
          </label>
          {!selectedSavedToken ? (
            <>
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
                  placeholder={PULSO_HF_DEFAULT_TOKEN_ALIAS}
                  disabled={publishing || loadingSettings}
                />
              </label>
            </>
          ) : null}
          <div className="dash-publish-hf-actions dash-publish-wide">
            <button type="button" onClick={() => setUsername(PULSO_HF_DEFAULT_NAMESPACE)} disabled={publishing || loadingSettings}>
              Usar {PULSO_HF_DEFAULT_NAMESPACE}
            </button>
            <button type="button" onClick={openHuggingFaceTokens}>
              <ExternalLink size={13} /> Crear token HF
            </button>
          </div>
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
