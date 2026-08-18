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
import { pasoComparado, pasosComparables, pasosDelEmbudo } from "./embudoComparadoModel";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";
import "./embudoComparado.css";

const PASO_INICIAL = 3; // «Aulas que pasan los criterios»: el corazón de la coincidencia.

export function EmbudoComparadoFacultades({
  fichas,
  periodo,
  pasoInicial = PASO_INICIAL,
}: {
  fichas: FichaFacultad[];
  periodo: string;
  /** Paso donde aterriza el selector: Coincidencia abre en el marco (3) y
   *  Selección en los titulares (7), que es lo que ahí se decide. */
  pasoInicial?: number;
}) {
  const pasos = pasosComparables(fichas);
  const todos = pasosDelEmbudo(fichas);
  const [pasoN, setPasoN] = useState(
    pasos.some((p) => p.n === pasoInicial) ? pasoInicial : (pasos[0]?.n ?? pasoInicial),
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
          hoy contra {etiquetaAntes}, ordenado por la diferencia;{" "}
          {paso.difieren > 0 ? (
            <>
              <b>{fmtInt(paso.difieren)}</b> de {fmtInt(paso.comparables)} facultades difieren
              {paso.deltaNeto !== 0
                ? ` (saldo ${paso.deltaNeto > 0 ? "+" : ""}${fmtInt(paso.deltaNeto)})`
                : " y el saldo neto es cero"}
            </>
          ) : (
            <>las {fmtInt(paso.comparables)} facultades comparables coinciden</>
          )}
        </span>
      </header>
      <nav className="cmv2-embcmp-pasos" aria-label="Paso del embudo">
        {todos.map((p) => p.comparable ? (
          <button
            key={p.n}
            type="button"
            data-activo={p.n === pasoN ? "si" : undefined}
            onClick={() => setPasoN(p.n)}
          >
            {p.n}. {p.titulo}
          </button>
        ) : (
          <button
            key={p.n}
            type="button"
            disabled
            title={`${p.titulo}: sin histórico por diseño — no hay con qué comparar`}
          >
            {p.n}. {p.titulo} · sin histórico
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
                {f.delta != null && f.delta !== 0 && paso.escalaDelta > 0 ? (
                  <span className="cmv2-embcmp-delta-barra" aria-hidden="true">
                    <span
                      data-signo={f.delta > 0 ? "mas" : "menos"}
                      style={{ width: `${(Math.abs(f.delta) / paso.escalaDelta) * 100}%` }}
                    />
                  </span>
                ) : null}
                <span className="cmv2-embcmp-delta-cifra">
                  {f.delta == null ? "" : f.delta > 0 ? `+${fmtInt(f.delta)}` : f.delta === 0 ? "=" : fmtInt(f.delta)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {tooltip}
    </section>
  );
}
