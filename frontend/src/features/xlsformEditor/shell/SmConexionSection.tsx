import { useState } from "react";
import { Check, Cloud, RefreshCw, ShieldCheck } from "../../../vendor/lucide-react";
import type {
  SurveyMonkeyListItem,
  SurveyMonkeyTokenInfo,
  SurveyMonkeyTokenState,
} from "../../../api/multiIntegrado";
import { surveyMonkeyTokenUiState } from "./smTokenUi";
import { SmConteo } from "./SmConteo";
import { SmPerfilesRescate } from "./SmPerfilesRescate";
import { SmSurveyPicker, type SmSurveyMeta } from "./SmSurveyPicker";
import { textoSeccionesSm } from "./smImportModel";
import "../styles/xfSmImport";

// Conexión con SurveyMonkey y elección de la encuesta. El estado de la prueba
// se dice en el mismo renglón del token; si falla, la salida (otro perfil o
// dónde cambiar el token) aparece ahí mismo (U2, U4).

export type SmEncuestaCargada = {
  titulo: string;
  secciones: number;
  preguntas: number;
  campos: number;
  obligatorias: number;
  validaciones: number;
};

function textoReglasTraidas(obligatorias: number, validaciones: number): string {
  const partes: string[] = [];
  if (obligatorias > 0) partes.push(`${obligatorias} ${obligatorias === 1 ? "obligatoria" : "obligatorias"}`);
  if (validaciones > 0) partes.push(`${validaciones} con validación`);
  return partes.length ? `Trae también ${partes.join(" y ")}.` : "";
}

function EstadoPrueba({ status, probando, conConteo }: { status: SurveyMonkeyTokenInfo | null; probando: boolean; conConteo: boolean }) {
  if (probando) {
    return <span className="pulso-xf-smi-prueba is-pendiente" aria-live="polite">Probando conexión…</span>;
  }
  if (!status?.ok) return null;
  const n = status.n_surveys_visible;
  return (
    <span className="pulso-xf-smi-prueba is-lista" role="status" aria-live="polite">
      <Check size={12} aria-hidden /> Conexión lista
      {conConteo && n != null && n >= 0 ? ` · ${n} ${n === 1 ? "encuesta visible" : "encuestas visibles"}` : ""}
    </span>
  );
}

export function SmConexionSection({
  surveyId,
  token,
  tokenState,
  connectedSurveyId,
  fetching,
  listing,
  probando,
  encuestaCargada,
  errorMessage,
  surveyList,
  surveyMeta,
  tokenStatus,
  rememberToken,
  onSurveyIdChange,
  onTokenChange,
  onTokenBlur,
  onRememberToggle,
  onVerifyToken,
  onForgetToken,
  onFetch,
  onList,
  onPerfilActivado,
}: {
  surveyId: string;
  token: string;
  tokenState: SurveyMonkeyTokenState;
  connectedSurveyId: string | null;
  fetching: boolean;
  listing: boolean;
  probando: boolean;
  encuestaCargada: SmEncuestaCargada | null;
  errorMessage: string | null;
  surveyList: SurveyMonkeyListItem[] | null;
  surveyMeta: SmSurveyMeta | null;
  tokenStatus: SurveyMonkeyTokenInfo | null;
  rememberToken: boolean;
  onSurveyIdChange: (s: string) => void;
  onTokenChange: (s: string) => void;
  onTokenBlur: () => void;
  onRememberToggle: (b: boolean) => void;
  onVerifyToken: () => void;
  onForgetToken: () => void;
  onFetch: () => void;
  onList: (forceRefresh?: boolean) => void;
  onPerfilActivado: (alias: string) => Promise<void> | void;
}) {
  const tokenUi = surveyMonkeyTokenUiState(tokenState, token);
  const [expanded, setExpanded] = useState(true);
  // Con la encuesta cargada, el catálogo se pliega: lo que importa ahora es lo
  // que se cargó. «Cambiar de encuesta» lo vuelve a abrir.
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const lista = Boolean(encuestaCargada && connectedSurveyId);
  const ocupado = fetching || listing;
  const sinToken = !tokenUi.hasUsableToken;
  const fallo = tokenStatus && tokenStatus.ok === false ? tokenStatus : null;
  const reglasTraidas = encuestaCargada
    ? textoReglasTraidas(encuestaCargada.obligatorias, encuestaCargada.validaciones)
    : "";

  return (
    <details
      className={`pulso-xf-smi-conexion${lista ? " is-lista" : ""}`}
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary>
        <Cloud size={15} aria-hidden />
        <span>Encuesta de SurveyMonkey</span>
        {lista ? (
          <span className="pulso-xf-smi-sello is-lista"><Check size={13} aria-hidden /> Cargada</span>
        ) : (
          <span className="pulso-xf-smi-sello">Necesaria</span>
        )}
      </summary>
      <div className="pulso-xf-smi-conexion-cuerpo">
        <p className="pulso-xf-smi-intro">
          Trae la definición original: secciones, orden, tipos de pregunta, opciones, obligatoriedad y validaciones.
        </p>

        <label className="pulso-xf-sm-field-label" htmlFor="pulso-sm-api-token">
          Token de acceso
        </label>
        <div className="pulso-xf-smi-renglon">
          <input
            id="pulso-sm-api-token"
            type="password"
            className="pulso-xf-smi-input is-mono"
            value={token}
            placeholder={tokenState.has_token ? "Hay un token guardado; pega otro para cambiarlo" : "Pega el token de SurveyMonkey"}
            onChange={(e) => onTokenChange(e.target.value)}
            onBlur={onTokenBlur}
            disabled={ocupado}
          />
          <button type="button" onClick={onVerifyToken} disabled={sinToken || ocupado || probando}>
            Probar conexión
          </button>
          <button
            type="button"
            onClick={() => onList(false)}
            disabled={ocupado || sinToken}
            title="Muestra tus encuestas recientes para elegir una sin copiar el ID"
          >
            {listing ? "Buscando…" : "Buscar mis encuestas"}
          </button>
          {surveyList && surveyList.length > 0 ? (
            <button
              type="button"
              onClick={() => onList(true)}
              disabled={ocupado || sinToken}
              title="Vuelve a consultar SurveyMonkey y reemplaza la lista guardada"
              aria-label="Actualizar la lista de encuestas"
            >
              <RefreshCw size={13} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="pulso-xf-smi-renglon is-secundario">
          <label className="pulso-xf-smi-check">
            <input
              type="checkbox"
              checked={rememberToken}
              onChange={(e) => onRememberToggle(e.target.checked)}
            />
            Recordar en este equipo (cifrado)
          </label>
          {tokenUi.hasUsableToken ? (
            <span className="pulso-xf-smi-token-activo">
              {tokenState.active_profile_alias ? `Perfil ${tokenState.active_profile_alias} · ` : ""}
              <code>{tokenUi.displayMask}</code>
              {tokenUi.storageLabel ? ` · ${tokenUi.storageLabel}` : ""}
              <button
                type="button"
                className="pulso-xf-smi-enlace is-peligro"
                onClick={onForgetToken}
                title="Borra el token de esta sesión y el guardado cifrado en este equipo"
              >
                Quitar
              </button>
            </span>
          ) : null}
          {/* Con el buscador abierto, el total de la cuenta va en su única línea de conteo. */}
          <EstadoPrueba status={tokenStatus} probando={probando} conConteo={!(surveyList && surveyList.length > 0)} />
        </div>

        {fallo ? (
          <SmPerfilesRescate
            key={`${tokenState.active_profile_id ?? ""}:${fallo.status_code ?? "x"}`}
            rechazado={fallo.status_code === 401}
            perfilActivoId={tokenState.active_profile_id}
            perfilActivoAlias={tokenState.active_profile_alias}
            onActivado={onPerfilActivado}
          />
        ) : null}

        {surveyList && surveyList.length > 0 && (!lista || catalogoAbierto) ? (
          <SmSurveyPicker
            surveys={surveyList}
            meta={surveyMeta}
            totalCuenta={tokenStatus?.ok ? tokenStatus.n_surveys_visible : null}
            selectedId={surveyId}
            disabled={fetching}
            onSelect={(id) => {
              setCatalogoAbierto(false);
              onSurveyIdChange(id);
            }}
          />
        ) : null}
        {surveyList && surveyList.length > 0 && lista && !catalogoAbierto ? (
          <button type="button" className="pulso-xf-smi-mas" onClick={() => setCatalogoAbierto(true)}>
            Cambiar de encuesta
          </button>
        ) : null}

        <label className="pulso-xf-sm-field-label" htmlFor="pulso-sm-survey-id">
          Encuesta
        </label>
        <div className="pulso-xf-smi-renglon">
          <input
            id="pulso-sm-survey-id"
            type="text"
            className="pulso-xf-smi-input"
            value={surveyId}
            placeholder="Pega el enlace de SurveyMonkey o el ID de la encuesta"
            onChange={(e) => onSurveyIdChange(e.target.value)}
            disabled={fetching}
          />
          <button
            type="button"
            className={lista ? undefined : "pulso-primary"}
            onClick={onFetch}
            disabled={fetching || !surveyId.trim() || sinToken}
          >
            {fetching ? "Cargando…" : "Usar esta encuesta"}
          </button>
        </div>
        {encuestaCargada ? (
          <div className="pulso-xf-smi-cargada" role="status" aria-live="polite">
            <ShieldCheck size={15} aria-hidden />
            <span>
              <strong>{encuestaCargada.titulo}</strong>
              <span className="pulso-xf-smi-cargada-conteo">
                {textoSeccionesSm(encuestaCargada.secciones)} ·{" "}
                <SmConteo preguntas={encuestaCargada.preguntas} campos={encuestaCargada.campos} />
              </span>
              {reglasTraidas ? <small>{reglasTraidas} Se aplican al crear el borrador.</small> : null}
            </span>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="pulso-xf-smi-error" role="alert">{errorMessage}</div>
        ) : null}
      </div>
    </details>
  );
}
