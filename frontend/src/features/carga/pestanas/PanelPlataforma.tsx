import type { ReactNode } from "react";
import { CloudDownload, Database, Loader2, RefreshCw, Search } from "../../../vendor/lucide-react";
import type {
  CargaPlatformProvider,
  ConnectionTokenState,
  MonitoreoKoboAssetItem,
  SurveyMonkeyMultibaseListItem,
} from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { Switch } from "../../../components/Switch";
import { DetectedKoboSourceCallout } from "./AvisoKoboDetectado";
import { formatoConteoDe, numeroFinito } from "../../../lib/formatoNumero";
import { providerLabel, type DetectedKoboSource } from "./cargaPaginaModelo";

export function PlatformImportPanel({
  provider,
  onProviderChange,
  connectionsLoading,
  smConnection,
  koboConnection,
  smProfiles,
  koboProfiles,
  selectedSmProfileId,
  selectedKoboProfileId,
  onSmProfileChange,
  onKoboProfileChange,
  query,
  onQueryChange,
  catalogLoading,
  onLoadCatalog,
  smSurveys,
  koboAssets,
  selectedSurveyId,
  selectedAssetUid,
  onSurveySelect,
  onAssetSelect,
  includePartials,
  onIncludePartialsChange,
  busy,
  error,
  message,
  importador,
  detectedKoboSource,
  onImportDetectedKoboSource,
  onImport,
}: {
  provider: CargaPlatformProvider;
  onProviderChange: (provider: CargaPlatformProvider) => void;
  connectionsLoading: boolean;
  smConnection?: ConnectionTokenState;
  koboConnection?: ConnectionTokenState;
  smProfiles: Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }>;
  koboProfiles: Array<{ id: string; alias: string; base_url?: string; is_default?: boolean }>;
  selectedSmProfileId: string;
  selectedKoboProfileId: string;
  onSmProfileChange: (profileId: string) => void;
  onKoboProfileChange: (profileId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  catalogLoading: boolean;
  onLoadCatalog: (forceRefresh: boolean) => void;
  smSurveys: SurveyMonkeyMultibaseListItem[];
  koboAssets: MonitoreoKoboAssetItem[];
  selectedSurveyId: string;
  selectedAssetUid: string;
  onSurveySelect: (surveyId: string) => void;
  onAssetSelect: (assetUid: string) => void;
  includePartials: boolean;
  onIncludePartialsChange: (value: boolean) => void;
  busy: boolean;
  error: string;
  message: string;
  /** L5b: la tarjeta del import en curso o del último desenlace. */
  importador?: ReactNode;
  detectedKoboSource: DetectedKoboSource | null;
  onImportDetectedKoboSource: () => void;
  onImport: () => void;
}) {
  const isSurveyMonkey = provider === "surveymonkey";
  const connection = isSurveyMonkey ? smConnection : koboConnection;
  const profiles = isSurveyMonkey ? smProfiles : koboProfiles;
  const selectedProfileId = isSurveyMonkey ? selectedSmProfileId : selectedKoboProfileId;
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const hasConnection = connection?.has_token === true;
  const selectedSurvey = smSurveys.find((survey) => survey.id === selectedSurveyId) ?? null;
  const selectedAsset = koboAssets.find((asset) => asset.uid === selectedAssetUid) ?? null;
  const selectedReady = isSurveyMonkey ? Boolean(selectedSurvey) : Boolean(selectedAsset);
  const rowsCount = isSurveyMonkey ? smSurveys.length : koboAssets.length;
  const providerName = providerLabel(provider);
  const providerOptions: CargaPlatformProvider[] = ["surveymonkey", "kobo"];

  return (
    <section className="pulso-platform-import" aria-label="Carga desde plataforma">
      <div className="pulso-platform-topbar">
        <GlidingTabList
          activeKey={provider}
          mode="tabs"
          className="pulso-platform-provider-tabs pulso-compact-tabs"
          role="radiogroup"
          aria-label="Proveedor"
        >
          {providerOptions.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`pulso-compact-tab${provider === item ? " is-active" : ""}`}
              onClick={() => onProviderChange(item)}
              onKeyDown={(event) => {
                const targetIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? providerOptions.length - 1
                    : event.key === "ArrowRight"
                      ? (index + 1) % providerOptions.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + providerOptions.length) % providerOptions.length
                        : -1;
                if (targetIndex < 0) return;
                onProviderChange(providerOptions[targetIndex]);
              }}
              role="radio"
              aria-checked={provider === item}
              data-gliding-key={item}
              title={`${providerLabel(item)} - seleccionar proveedor de origen`}
            >
              {item === "surveymonkey" ? <CloudDownload size={14} /> : <Database size={14} />}
              <span className="pulso-platform-provider-label">{providerLabel(item)}</span>
            </button>
          ))}
        </GlidingTabList>
        <div className="pulso-platform-topbar-actions">
          <div className={`pulso-platform-status${hasConnection ? " is-ready" : ""}`}>
            <span aria-hidden="true" />
            {connectionsLoading ? "Verificando conexiones" : hasConnection ? "Conectado" : "Sin conexión"}
          </div>
          {isSurveyMonkey && (
            <label className="pulso-platform-check">
              <Switch
                className="pulso-carga-switch"
                checked={includePartials}
                onToggle={() => onIncludePartialsChange(!includePartials)}
                disabled={busy}
                ariaLabel="Incluir respuestas parciales"
              />
              <span>Parciales</span>
            </label>
          )}
        </div>
      </div>

      <div className="pulso-platform-controls">
        <label className="pulso-platform-field">
          <span>Conexión</span>
          <select
            value={selectedProfile?.id || ""}
            onChange={(event) => {
              if (isSurveyMonkey) onSmProfileChange(event.target.value);
              else onKoboProfileChange(event.target.value);
            }}
            disabled={busy || catalogLoading || profiles.length <= 1}
          >
            {profiles.length > 0 ? profiles.map((profile) => (
              <option key={profile.id || profile.alias} value={profile.id}>
                {profile.alias}{profile.base_url ? ` (${profile.base_url.replace(/^https?:\/\//, "")})` : ""}
              </option>
            )) : (
              <option value="">Sin perfil conectado</option>
            )}
          </select>
        </label>
        <label className="pulso-platform-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={isSurveyMonkey ? "Filtrar encuestas" : "Filtrar proyectos"}
            disabled={busy || catalogLoading || !hasConnection}
          />
        </label>
        <button
          type="button"
          className="pulso-platform-load"
          onClick={() => onLoadCatalog(false)}
          disabled={busy || catalogLoading || !hasConnection}
        >
          {catalogLoading ? <Loader2 size={14} className="pulso-spin" /> : <CloudDownload size={14} />}
          Actualizar catálogo
        </button>
        <button
          type="button"
          className="pulso-platform-refresh"
          title={`Forzar actualización del catálogo de ${providerName}`}
          aria-label={`Forzar actualización del catálogo de ${providerName}`}
          onClick={() => onLoadCatalog(true)}
          disabled={busy || catalogLoading || !hasConnection}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {!isSurveyMonkey && detectedKoboSource && (
        <DetectedKoboSourceCallout
          source={detectedKoboSource}
          busy={busy}
          hasConnection={hasConnection}
          compact
          onImport={onImportDetectedKoboSource}
          onReview={() => {
            onQueryChange(detectedKoboSource.name || detectedKoboSource.source_title || "");
            onAssetSelect(detectedKoboSource.asset_uid);
          }}
        />
      )}

      {importador}
      {error && <div className="pulso-platform-alert is-error">{error}</div>}
      {message && !error && <div className="pulso-platform-alert">{message}</div>}

      <div className="pulso-platform-list" aria-label={`Catálogo ${providerName}`}>
        {rowsCount === 0 ? (
          <EstadoVacio
            icono={<Search size={15} />}
            titulo={hasConnection ? "Catálogo pendiente" : `Sin conexión con ${providerName}`}
            descripcion={hasConnection ? "Actualiza el catálogo para ver fuentes disponibles." : "Elige una conexión antes de importar."}
          />
        ) : isSurveyMonkey ? (
          smSurveys.map((survey) => (
            <button
              key={survey.id}
              type="button"
              className={`pulso-platform-row${selectedSurveyId === survey.id ? " is-selected" : ""}`}
              onClick={() => onSurveySelect(survey.id)}
              aria-pressed={selectedSurveyId === survey.id}
            >
              <span className="pulso-platform-row-main">
                <strong>{survey.title}</strong>
                <small>
                  Survey ID {survey.id}
                  {survey.nickname ? `, ${survey.nickname}` : ""}
                  {survey.date_modified ? `, ${survey.date_modified.slice(0, 10)}` : ""}
                </small>
              </span>
              <span className="pulso-platform-row-count">
                {numeroFinito(survey.response_count) == null ? "Sin conteo de respuestas" : formatoConteoDe(survey.response_count, "respuesta")}
              </span>
            </button>
          ))
        ) : (
          koboAssets.map((asset) => (
            <button
              key={asset.uid}
              type="button"
              className={`pulso-platform-row${selectedAssetUid === asset.uid ? " is-selected" : ""}`}
              onClick={() => onAssetSelect(asset.uid)}
              aria-pressed={selectedAssetUid === asset.uid}
            >
              <span className="pulso-platform-row-main">
                <strong>{asset.name}</strong>
                <small>
                  Asset {asset.uid}
                  {asset.date_modified ? `, ${asset.date_modified.slice(0, 10)}` : ""}
                </small>
              </span>
              <span className={`pulso-platform-row-count${asset.deployment_active ? " is-live" : ""}`}>
                {asset.deployment_active ? "activo" : "borrador"}
              </span>
            </button>
          ))
        )}
      </div>

      <div className={`pulso-platform-footer${selectedReady ? " is-ready" : " is-waiting"}`}>
        <span>
          {selectedReady
            ? isSurveyMonkey
              ? selectedSurvey?.title
              : selectedAsset?.name
            : hasConnection
              ? rowsCount > 0
                ? "Elige una fuente para importar."
                : "Actualiza el catálogo y elige una fuente."
              : `Conecta ${providerName} para importar fuentes.`}
        </span>
        <button
          type="button"
          className={`pulso-platform-import-button${selectedReady ? " is-ready" : " is-unavailable"}${busy ? " is-busy" : ""}`}
          onClick={onImport}
          disabled={busy || catalogLoading || !hasConnection || !selectedReady}
        >
          {busy ? <Loader2 size={15} className="pulso-spin" /> : <CloudDownload size={15} />}
          Importar seleccionada
        </button>
      </div>
    </section>
  );
}
