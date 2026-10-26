import type { CSSProperties } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { Ban, Check, CheckCircle2, CircleAlert, Loader2, CloudDownload, TriangleAlert, X } from "../../../vendor/lucide-react";
import {
  etiquetaProveedor,
  fasesDeImport,
  formatoTranscurrido,
  type EstrategiaImport,
  type ImportExitoso,
  type ProveedorPlataforma,
} from "./modeloPlataforma";
import type { UseImportPlataforma } from "./useImportPlataforma";
import "./importador-plataforma.css";

export type ImportadorPlataformaProps = {
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  /** Lo que devuelve `useImportPlataforma` (solo se lee). */
  importacion: Pick<UseImportPlataforma, "estado" | "lanzando" | "vivo" | "terminado" | "transcurridoMs" | "cancelar" | "descartar">;
  /** Navegación a la base importada; el botón nombra el destino. */
  onIrABase?: (baseNombre: string) => void;
  onReintentar?: () => void;
};

const NUMERO = new Intl.NumberFormat("es-PE");

function detalleExito(exito: ImportExitoso): string {
  const partes: string[] = [];
  if (exito.nFilas != null) partes.push(`${NUMERO.format(exito.nFilas)} registros`);
  if (exito.nColumnas != null) partes.push(`${NUMERO.format(exito.nColumnas)} columnas`);
  if (exito.basesHijas.length) {
    partes.push(`${exito.basesHijas.length} base${exito.basesHijas.length === 1 ? "" : "s"} de repeat`);
  }
  return partes.join(" · ");
}

/**
 * Tarjeta del import de plataforma (maqueta L03): anillo + barra, cuatro
 * fases, tiempo transcurrido y Cancelar mientras corre; desenlace con copy
 * propio al terminar. Presentacional: el job lo lleva `useImportPlataforma`.
 *
 * No monta `components/JobProgress`: ese componente abre su propio poll con
 * `useJob` y se queda con el Cancelar, y aquí hacen falta un único poll con
 * vida de módulo y saber que el usuario canceló (para distinguir «cancelé y
 * aun así se importó»). Toma del kit `PulsoButton` y el vocabulario de fases.
 */
export function ImportadorPlataforma({
  proveedor,
  estrategia,
  importacion,
  onIrABase,
  onReintentar,
}: ImportadorPlataformaProps) {
  const { estado, lanzando, vivo, terminado, transcurridoMs } = importacion;
  const plataforma = etiquetaProveedor(proveedor);

  if (estado === "inactivo") return null;

  if (estado === "lanzando" || estado === "en-curso") {
    const enCurso = vivo ?? lanzando;
    const progreso = vivo?.progreso ?? null;
    const fase = progreso?.fase ?? 0;
    const percent = progreso?.percent ?? null;
    const cancelando = enCurso?.cancelSolicitado === true;
    const fases = fasesDeImport(estrategia);
    const contador = progreso?.actual != null && progreso.total != null
      ? `${NUMERO.format(progreso.actual)} de ${NUMERO.format(progreso.total)}`
      : null;
    const mensaje = cancelando
      ? "Cancelando…"
      : vivo?.reintentando
        ? "Reintentando conexión…"
        : progreso?.mensaje || (estado === "lanzando" ? `Conectando con ${plataforma}…` : fases[fase]);
    const meta = [mensaje, contador, `${formatoTranscurrido(transcurridoMs)} transcurridos`].filter(Boolean).join(" · ");
    const estiloAvance = { "--importador-avance": percent ?? 0 } as CSSProperties;

    return (
      <section
        className="pulso-importador-plataforma"
        data-estado="en-curso"
        data-proveedor={proveedor}
        aria-label={`Importación desde ${plataforma}`}
        aria-busy="true"
      >
        <header className="pulso-importador-plataforma__head">
          <CloudDownload size={16} aria-hidden="true" />
          <h3>Importación en curso</h3>
          <span className="pulso-importador-plataforma__chip">en segundo plano</span>
        </header>
        <div
          className="pulso-importador-plataforma__job"
          style={estiloAvance}
          data-qa-geometry-group="carga-importador-job"
          data-qa-geometry-contract="intrinsic"
        >
          <span
            className={`pulso-importador-plataforma__anillo${percent == null ? " is-indeterminado" : ""}`}
            aria-hidden="true"
            data-qa-geometry-member=""
          />
          <div className="pulso-importador-plataforma__copy" data-qa-geometry-member="">
            <strong>{enCurso?.etiqueta || plataforma}</strong>
            <span className="pulso-importador-plataforma__meta" aria-live="polite">{meta}</span>
            <div
              className={`pulso-importador-plataforma__barra${percent == null ? " is-indeterminado" : ""}`}
              role="progressbar"
              aria-label={`Avance de la importación de ${enCurso?.etiqueta || plataforma}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent == null ? undefined : Math.round(percent)}
              aria-valuetext={percent == null ? fases[fase] : `${Math.round(percent)} % · ${fases[fase]}`}
            >
              <i />
            </div>
            <ol
              className="pulso-importador-plataforma__fases"
              aria-label="Fases de la importación"
              data-qa-geometry-group="carga-importador-fases"
              data-qa-geometry-contract="intrinsic"
            >
              {fases.map((nombre, i) => {
                const estadoFase = i < fase ? "hecha" : i === fase ? "actual" : "pendiente";
                return (
                  <li
                    key={nombre}
                    data-fase-estado={estadoFase}
                    aria-current={estadoFase === "actual" ? "step" : undefined}
                  >
                    {estadoFase === "hecha" ? <Check size={12} aria-hidden="true" /> : null}
                    {nombre}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="pulso-importador-plataforma__acciones" data-qa-geometry-member="">
            <PulsoButton
              variant="ghost"
              size="sm"
              onClick={() => { void importacion.cancelar(); }}
              disabled={cancelando}
            >
              {cancelando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              {cancelando ? "Cancelando…" : "Cancelar"}
            </PulsoButton>
          </div>
        </div>
        <p className="pulso-importador-plataforma__nota">
          Puedes cambiar de pestaña o de módulo: la importación sigue y te avisamos al terminar.
        </p>
      </section>
    );
  }

  if (!terminado) return null;
  const { resultado } = terminado;
  const etiqueta = terminado.etiqueta || plataforma;

  let tono: "ok" | "aviso" | "error";
  let Icono = CheckCircle2;
  let titulo: string;
  let detalle: string;
  let codigo: string | null = null;
  let baseNombre: string | null = null;

  switch (resultado.tipo) {
    case "importado":
      tono = "ok";
      baseNombre = resultado.baseNombre;
      titulo = baseNombre ? `«${etiqueta}» quedó en la base ${baseNombre}` : `«${etiqueta}» quedó importada`;
      detalle = detalleExito(resultado) || `Formulario y respuestas traídos desde ${plataforma}.`;
      break;
    case "cancelado-importado":
      tono = "aviso";
      Icono = TriangleAlert;
      baseNombre = resultado.baseNombre;
      titulo = "Cancelaste, pero la importación ya había terminado";
      detalle = baseNombre
        ? `La base ${baseNombre} quedó en el estudio. Si no la quieres, elimínala desde las bases del estudio.`
        : "Los datos quedaron en el estudio. Si no los quieres, revísalos en las bases del estudio.";
      break;
    case "cancelado":
      tono = "aviso";
      Icono = Ban;
      titulo = "Importación cancelada";
      detalle = "El estudio no cambió.";
      break;
    case "sesion-obsoleta":
      tono = "aviso";
      Icono = TriangleAlert;
      titulo = "Importación descartada";
      detalle = resultado.mensaje;
      codigo = "E_CARGA_JOB_STALE_SESSION";
      break;
    case "error":
    default:
      tono = "error";
      Icono = CircleAlert;
      titulo = resultado.titulo;
      detalle = resultado.mensaje;
      codigo = resultado.codigo;
      break;
  }

  const puedeReintentar = tono === "error" || resultado.tipo === "cancelado" || resultado.tipo === "sesion-obsoleta";

  return (
    <section
      className="pulso-importador-plataforma"
      data-estado={resultado.tipo}
      data-tono={tono}
      data-proveedor={proveedor}
      aria-label={`Importación desde ${plataforma}`}
    >
      <div
        className="pulso-importador-plataforma__desenlace"
        role={tono === "error" ? "alert" : "status"}
        data-qa-geometry-group="carga-importador-desenlace"
        data-qa-geometry-contract="intrinsic"
      >
        <span className="pulso-importador-plataforma__icono" aria-hidden="true" data-qa-geometry-member="">
          <Icono size={16} />
        </span>
        <div className="pulso-importador-plataforma__copy" data-qa-geometry-member="">
          <strong>{titulo}</strong>
          <span className="pulso-importador-plataforma__meta">
            {detalle}
            {codigo ? <code className="pulso-importador-plataforma__codigo">{codigo}</code> : null}
          </span>
        </div>
        <div className="pulso-importador-plataforma__acciones" data-qa-geometry-member="">
          {baseNombre && onIrABase ? (
            <PulsoButton variant="secondary" size="sm" nav onClick={() => onIrABase(baseNombre as string)}>
              Abrir base {baseNombre}
            </PulsoButton>
          ) : null}
          {puedeReintentar && onReintentar ? (
            <PulsoButton variant="link" size="sm" onClick={onReintentar}>Reintentar</PulsoButton>
          ) : null}
          <PulsoButton
            variant="icon"
            size="sm"
            intent="remove"
            aria-label="Cerrar aviso de importación"
            onClick={importacion.descartar}
          >
            <X size={14} aria-hidden="true" />
          </PulsoButton>
        </div>
      </div>
    </section>
  );
}
