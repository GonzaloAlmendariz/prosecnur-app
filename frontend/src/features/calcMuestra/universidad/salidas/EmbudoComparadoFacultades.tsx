/**
 * El embudo comparado 2025↔hoy, facultad por facultad — el gráfico que a
 * Coincidencia le faltaba (Gonzalo: «en Datos la pestaña histórica tiene un
 * montón de gráficos interesantes que en Entrega y Coincidencia no existen
 * cuando deberían hacerlo»).
 *
 * Habla el lenguaje visual del histórico: mismas barras horizontales con
 * fondo neutro, mismo tooltip delegado (`TooltipGrafico`), mismos tokens.
 * Por cada facultad, dos barras a escala común: HOY llena, 2025 en trazo
 * tenue debajo, y el delta al costado. Un paso a la vez — mezclar Población
 * (miles) con aulas (decenas) en una sola escala aplastaría las barras
 * chicas — y el selector de paso recorre el embudo entero.
 */
import { useState } from "react";
import { fmtInt } from "../../sharedCore";
import { tip, tipAria, useTooltipGrafico } from "../shared/graficos/TooltipGrafico";
import { pasoComparado, pasosComparables } from "./embudoComparadoModel";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";
import "./embudoComparado.css";

const PASO_INICIAL = 3; // «Aulas que pasan los criterios»: el corazón de la coincidencia.

export function EmbudoComparadoFacultades({
  fichas,
  periodo,
}: {
  fichas: FichaFacultad[];
  periodo: string;
}) {
  const pasos = pasosComparables(fichas);
  const [pasoN, setPasoN] = useState(
    pasos.some((p) => p.n === PASO_INICIAL) ? PASO_INICIAL : (pasos[0]?.n ?? PASO_INICIAL),
  );
  const { manejadores, tooltip } = useTooltipGrafico();
  if (!fichas.length || !pasos.length) return null;

  const paso = pasoComparado(fichas, pasoN);
  const etiquetaAntes = periodo || "estudio anterior";
  const ancho = (n: number | null) =>
    n == null || paso.escala <= 0 ? 0 : (n / paso.escala) * 100;

  return (
    <section className="cmv2-generales-card" aria-label="El embudo comparado por facultad">
      <header>
        <strong>El embudo, facultad por facultad</strong>
        <span>
          hoy contra {etiquetaAntes} a la misma escala; {fmtInt(paso.comparables)} de{" "}
          {fmtInt(paso.filas.length)} facultades con ambas cifras
        </span>
      </header>
      <nav className="cmv2-embcmp-pasos" aria-label="Paso del embudo">
        {pasos.map((p) => (
          <button
            key={p.n}
            type="button"
            data-activo={p.n === pasoN ? "si" : undefined}
            onClick={() => setPasoN(p.n)}
          >
            {p.n}. {p.titulo}
          </button>
        ))}
      </nav>
      <ol className="cmv2-embcmp-lista" {...manejadores}>
        {paso.filas.map((f) => {
          const datosTip = {
            titulo: f.facultad,
            filas: [
              { label: "Hoy", valor: f.hoy != null ? fmtInt(f.hoy) : "sin medir" },
              { label: etiquetaAntes, valor: f.antes != null ? fmtInt(f.antes) : "sin referencia" },
              ...(f.delta != null
                ? [{ label: "Diferencia", valor: `${f.delta > 0 ? "+" : ""}${fmtInt(f.delta)}` }]
                : []),
            ],
            nota: paso.titulo,
            tono: "efectiva",
          };
          return (
            <li key={f.facultad} aria-label={tipAria(datosTip)}>
              <span className="cmv2-embcmp-nombre">{f.facultad}</span>
              <span className="cmv2-embcmp-tracks" {...tip(datosTip)}>
                <span className="cmv2-embcmp-track" data-serie="hoy">
                  {f.hoy != null ? (
                    <span style={{ width: `${ancho(f.hoy)}%` }} />
                  ) : (
                    <i>sin medir</i>
                  )}
                </span>
                <span className="cmv2-embcmp-track" data-serie="antes">
                  {f.antes != null ? (
                    <span style={{ width: `${ancho(f.antes)}%` }} />
                  ) : (
                    <i>sin referencia</i>
                  )}
                </span>
              </span>
              <span className="cmv2-embcmp-cifras">
                <b>{f.hoy != null ? fmtInt(f.hoy) : "—"}</b>
                <span>{f.antes != null ? fmtInt(f.antes) : "—"}</span>
              </span>
              <span
                className="cmv2-embcmp-delta"
                data-signo={f.delta == null ? undefined : f.delta > 0 ? "mas" : f.delta < 0 ? "menos" : "igual"}
              >
                {f.delta == null ? "" : f.delta > 0 ? `+${fmtInt(f.delta)}` : fmtInt(f.delta)}
              </span>
            </li>
          );
        })}
      </ol>
      {tooltip}
    </section>
  );
}
