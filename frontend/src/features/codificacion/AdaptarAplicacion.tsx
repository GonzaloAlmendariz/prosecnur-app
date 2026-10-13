import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Play } from "lucide-react";
import { apiCodifAplicar, AplicarResult, downloadUrl } from "../../api/client";
import { Alert } from "../../components/Alert";
import { JobProgress } from "../../components/JobProgress";
import { Panel } from "../../components/Panel";
import { useSession } from "../../lib/SessionContext";
import { AplicarOmitidasAviso } from "./AplicarOmitidasAviso";
import {
  type AplicarEntrada,
  aplicarCodificacion,
  selectAplicarEntrada,
  useAplicarAvisosStore,
} from "./aplicarAvisosStore";
import "./AdaptarAplicacion.css";

// La mitad de Adaptar que sobrevive al remontaje: el botón que lanza
// `/aplicar`, el progreso del job, lo que no se aplicó, lo que se entrega sin
// recodificar y las descargas. Todo sale de `aplicarAvisosStore`, keyed por
// sesión y base; AdaptarPane sólo aporta el plan.

type Props = {
  /** `claveAplicar(sessionId, base)`. */
  clave: string;
  /** Preguntas soportadas del plan: con 0 no hay nada que adaptar. */
  nPreguntas: number;
  onBackToCodificar: () => void;
  onBackToMatrices: () => void;
};

const TEXTO_APLICANDO = "Revisando el catálogo contra la base; puede tardar un par de minutos.";

export function AdaptarAplicacion({ clave, nPreguntas, onBackToCodificar, onBackToMatrices }: Props) {
  const { refresh } = useSession();
  const entrada = useAplicarAvisosStore(selectAplicarEntrada(clave));
  const terminar = useAplicarAvisosStore((s) => s.terminar);
  const fallar = useAplicarAvisosStore((s) => s.fallar);
  const cancelar = useAplicarAvisosStore((s) => s.cancelar);
  const marcarEnfocado = useAplicarAvisosStore((s) => s.marcarEnfocado);

  return (
    <AdaptarAplicacionVista
      entrada={entrada}
      nPreguntas={nPreguntas}
      onBackToCodificar={onBackToCodificar}
      onBackToMatrices={onBackToMatrices}
      onAdaptar={() => void aplicarCodificacion(clave, apiCodifAplicar)}
      onJobDone={(d) => {
        terminar(clave, { data: d.data_adaptada.file_id, inst: d.instrumento_adaptado.file_id });
        void refresh();
        window.dispatchEvent(new Event("pulso:session-changed"));
      }}
      onJobError={(msg) => fallar(clave, msg)}
      onJobCancelled={() => cancelar(clave)}
      onEnfocado={() => marcarEnfocado(clave)}
    />
  );
}

type VistaProps = {
  entrada: AplicarEntrada;
  nPreguntas: number;
  onBackToCodificar: () => void;
  onBackToMatrices: () => void;
  onAdaptar: () => void;
  onJobDone: (d: AplicarResult) => void;
  onJobError: (msg: string) => void;
  onJobCancelled: () => void;
  onEnfocado: () => void;
};

/** Presentación pura de la entrada del store; testeable sin DOM. */
export function AdaptarAplicacionVista({
  entrada,
  nPreguntas,
  onBackToCodificar,
  onBackToMatrices,
  onAdaptar,
  onJobDone,
  onJobError,
  onJobCancelled,
  onEnfocado,
}: VistaProps) {
  const { aplicando, jobId, avisos, sinRecodificar, salida, error, enfocarPendiente } = entrada;

  const motivoDeshabilitado = aplicando
    ? "La codificación se está aplicando."
    : jobId
    ? "La adaptación ya está corriendo."
    : nPreguntas === 0
    ? "No hay codificaciones listas para adaptar."
    : "";

  return (
    <>
      {!salida && (
        <div className="pulso-codificacion-adaptar-actions">
          <button type="button" className="pulso-cv2-pill" onClick={onBackToCodificar} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Volver a codificar
          </button>
          <button type="button" className="pulso-cv2-pill" onClick={onBackToMatrices} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileSpreadsheet size={13} /> Revisar matrices
          </button>
          <div style={{ flex: 1 }} />
          {/* Región viva siempre montada: el lector anuncia el cambio de texto. */}
          <span className="pulso-codif-adaptar-estado" role="status" aria-live="polite">
            {aplicando ? TEXTO_APLICANDO : ""}
          </span>
          <button
            type="button"
            className="pulso-primary"
            onClick={onAdaptar}
            disabled={aplicando || !!jobId || nPreguntas === 0}
            aria-busy={aplicando || undefined}
            aria-describedby={motivoDeshabilitado ? "codificacion-adaptar-disabled-reason" : undefined}
            data-testid="codificacion-adaptar-boton"
            style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {aplicando ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="pulso-codif-adaptar-giro" /> Aplicando…
              </>
            ) : (
              <>
                <Play size={14} aria-hidden="true" /> Confirmar y adaptar respuestas
              </>
            )}
          </button>
          {motivoDeshabilitado && (
            <span id="codificacion-adaptar-disabled-reason" className="pulso-sr-only">
              {motivoDeshabilitado}
            </span>
          )}
        </div>
      )}

      {jobId && (
        <JobProgress<AplicarResult>
          label="Adaptando respuestas con mapeos confirmados"
          jobId={jobId}
          onDone={onJobDone}
          onError={onJobError}
          onCancelled={onJobCancelled}
        />
      )}

      {error && <Alert kind="error">{error}</Alert>}

      {/* ADR 0100, P1: las preguntas del catálogo que no se aplicaron y los
          textos que quedaron sin código. Sin nada que decir, no pinta. */}
      <AplicarOmitidasAviso
        omitidas={avisos.omitidas}
        textosSinCodigo={avisos.textos_sin_codigo}
        enfocar={enfocarPendiente}
        onEnfocado={onEnfocado}
      />

      {/* ADR 0078, punto 5: qué se entrega sin recodificar. Aparece al aplicar
          y no antes, porque es el momento en que deja de ser reversible sin
          rehacer. Informa y no frena: bloquear acá se satisfaría desmarcando
          todo, que dejaría el módulo peor que ahora. */}
      {sinRecodificar.length > 0 && (
        <Alert kind="warn">
          <div data-testid="codificacion-sin-recodificar">
            <strong>
              {sinRecodificar.length === 1
                ? "1 variable se entrega sin recodificar"
                : `${sinRecodificar.length} variables se entregan sin recodificar`}
              .
            </strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {sinRecodificar.map((v) => (
                <li key={v.parent} style={{ fontSize: 12, marginBottom: 2 }}>
                  <code>{v.parent}</code>{" "}
                  {v.deliberado ? (
                    <>— decidido: {v.motivo}</>
                  ) : (
                    <>
                      — {v.n_respuestas} {v.n_respuestas === 1 ? "respuesta" : "respuestas"} sin
                      categorizar
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {salida && (
        <Panel eyebrow="Resultado" title="Archivos adaptados listos para descargar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--pulso-success-fg)", marginBottom: 10 }}>
            <CheckCircle2 size={16} /> La adaptación terminó correctamente.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={downloadUrl(salida.data)}
              className="pulso-primary"
              style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
            >
              <Download size={14} /> data_adaptada.xlsx
            </a>
            <a
              href={downloadUrl(salida.inst)}
              style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> instrumento_adaptado.xlsx
            </a>
          </div>
        </Panel>
      )}
    </>
  );
}
