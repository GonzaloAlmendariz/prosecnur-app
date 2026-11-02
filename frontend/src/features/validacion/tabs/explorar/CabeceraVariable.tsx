import { ChevronLeft, ChevronRight } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { ExplorarUnivariadoResult } from "../../../../api/validacion";
import type { ExploradorFicha } from "../../../../api/validacionExplorar";
import type { ExploradorVariable } from "../../types";
import InsigniaTipo from "./InsigniaTipo";

/**
 * E2 — la pregunta: sección y posición, el texto como título, el código, el
 * tipo, cuántas opciones tiene y cuándo aparece. Con cruce, el título suma
 * «por <la otra>» y la línea de abajo nombra el gráfico del par.
 */
export default function CabeceraVariable({
  uni,
  ficha,
  seccion,
  posicion,
  total,
  nOpciones,
  cruce,
  onAnterior,
  onSiguiente,
  nombreAnterior,
  nombreSiguiente,
  repeatLabel,
  repeatInstances,
}: {
  uni: ExplorarUnivariadoResult;
  ficha: ExploradorFicha | null;
  seccion: string | null;
  posicion: number;
  total: number;
  nOpciones: number | null;
  cruce: { variable: ExploradorVariable; grafico: string | null } | null;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  nombreAnterior: string | null;
  nombreSiguiente: string | null;
  repeatLabel: string | null;
  repeatInstances: number | null;
}) {
  const titulo = ficha?.label || uni.label || uni.var;
  const eyebrow = [seccion, posicion > 0 ? `Pregunta ${posicion} de ${total}` : null].filter(Boolean).join("  ·  ");
  return (
    <section className={`vx-tarjeta vx-cabecera vx-tipo-${uni.tipo}`} aria-label="Pregunta que se explora">
      <div className="vx-cabecera-texto">
        {eyebrow && <span className="vx-eyebrow">{eyebrow}</span>}
        <h3>
          {titulo}
          {cruce && <small> por {cruce.variable.label || cruce.variable.name}</small>}
        </h3>
        <div className="vx-cabecera-meta">
          <span className="vx-codigo vx-mono">{uni.var}</span>
          {cruce ? (
            <>
              <span className="vx-sep-punto" aria-hidden>×</span>
              <span className="vx-codigo vx-mono">{cruce.variable.name}</span>
              {cruce.grafico && <span>{cruce.grafico}</span>}
            </>
          ) : (
            <>
              <InsigniaTipo tipo={uni.tipo} larga />
              {nOpciones !== null && nOpciones > 0 && <span>{nOpciones} {nOpciones === 1 ? "opción" : "opciones"}</span>}
              {ficha?.relevant && (
                <>
                  <span className="vx-sep-punto" aria-hidden>·</span>
                  <span>
                    Aplica si <span className="vx-mono">{ficha.relevant}</span>
                  </span>
                </>
              )}
            </>
          )}
          {repeatLabel && (
            <span className="pulso-repeat-variable-context">
              Servicio · {repeatLabel}
              {repeatInstances != null && ` · ${repeatInstances.toLocaleString("es-PE")} instancias`}
            </span>
          )}
        </div>
      </div>
      <div className="vx-cabecera-nav">
        <PulsoButton
          variant="icon"
          size="lg"
          aria-label={nombreAnterior ? `Variable anterior: ${nombreAnterior}` : "Variable anterior"}
          title={nombreAnterior ? `Anterior: ${nombreAnterior} (←)` : "Ya estás en la primera variable"}
          disabled={!onAnterior}
          onClick={onAnterior}
        >
          <ChevronLeft size={16} aria-hidden />
        </PulsoButton>
        <PulsoButton
          variant="icon"
          size="lg"
          aria-label={nombreSiguiente ? `Variable siguiente: ${nombreSiguiente}` : "Variable siguiente"}
          title={nombreSiguiente ? `Siguiente: ${nombreSiguiente} (→)` : "Ya estás en la última variable"}
          disabled={!onSiguiente}
          onClick={onSiguiente}
        >
          <ChevronRight size={16} aria-hidden />
        </PulsoButton>
      </div>
    </section>
  );
}
