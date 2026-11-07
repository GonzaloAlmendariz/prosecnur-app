import { CheckCircle2, Circle, Loader2, X } from "lucide-react";

import { fmt } from "../kpisDeAulas";
import { NO_TOCA } from "./ReciboDeActualizar";
import type { PasoDeActualizar } from "./useReciboDeActualizar";
import "./estados.css";

const PASOS: Array<{ clave: PasoDeActualizar; rotulo: string }> = [
  { clave: "traer", rotulo: "Traer lo nuevo" },
  { clave: "recalcular", rotulo: "Recalcular" },
  { clave: "recibo", rotulo: "Dejar recibo" },
];

export function detalleDelPaso(clave: PasoDeActualizar, fuentes: number, leyendo = true): string {
  if (clave === "traer") {
    if (!leyendo) return "Se salta: se recalcula con lo que ya entró.";
    return fuentes
      ? `Pide a la plataforma las respuestas nuevas (${fmt(fuentes)} ${fuentes === 1 ? "fuente activa" : "fuentes activas"}) y lee el libro del operativo.`
      : "Sin fuentes activas: no se pide nada a la plataforma; se lee el libro del operativo.";
  }
  if (clave === "recalcular") return "Rehace el tablero de cursos-horario, la agenda y el avance con lo que haya.";
  return "Dice lo que cambió en este corte.";
}

/** P1a · Actualizar abierto: qué va a hacer, en qué orden y qué no toca, antes de empezar. */
export function ActualizarAbierto({ fuentes, onActualizar, onRecalcular, onCerrar }: {
  fuentes: number;
  onActualizar: () => void;
  onRecalcular: () => void;
  onCerrar: () => void;
}) {
  return (
    <section className="aulas-recibo aulas-actualizar" aria-label="Actualizar">
      <header>
        <b>Actualizar el corte de campo</b>
        <button type="button" className="aulas-recibo-cerrar" aria-label="Cerrar" onClick={onCerrar}><X size={14} aria-hidden="true" /></button>
      </header>
      <ol className="aulas-recibo-pasos aulas-actualizar-pasos">
        {PASOS.map((p, i) => (
          <li key={p.clave}>
            <span className="aulas-actualizar-n" aria-hidden="true">{i + 1}</span>
            <span><b>{p.rotulo}</b>, {detalleDelPaso(p.clave, fuentes)}</span>
          </li>
        ))}
      </ol>
      <p className="aulas-recibo-notoca">{NO_TOCA.join(", ")}.</p>
      <div className="aulas-actualizar-acciones">
        <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={onRecalcular}>
          Recalcular sin leer
        </button>
        <button type="button" className="pulso-button is-primary pulso-button--sm" onClick={onActualizar}>
          Actualizar ahora
        </button>
      </div>
    </section>
  );
}

/** P1b · Actualizar corriendo: el paso en curso y cuánto lleva. */
export function ActualizarCorriendo({ paso, segundos, fuentes, leyendo }: {
  paso: PasoDeActualizar;
  segundos: number;
  fuentes: number;
  leyendo: boolean;
}) {
  const actual = PASOS.findIndex((p) => p.clave === paso);
  return (
    <section className="aulas-recibo aulas-actualizar" role="status" aria-live="polite" aria-label="Actualizando">
      <header>
        <b>Actualizando, lleva {fmt(Math.floor(segundos))} s</b>
      </header>
      <ol className="aulas-recibo-pasos aulas-actualizar-pasos">
        {PASOS.map((p, i) => {
          const hecho = i < actual || (p.clave === "traer" && !leyendo);
          const enCurso = i === actual;
          return (
            <li key={p.clave} data-tono={hecho ? "ok" : undefined} data-en-curso={enCurso || undefined}>
              {enCurso
                ? <Loader2 size={14} className="aulas-actualizar-giro" aria-hidden="true" />
                : hecho ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span><b>{p.rotulo}</b>, {detalleDelPaso(p.clave, fuentes, leyendo)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
