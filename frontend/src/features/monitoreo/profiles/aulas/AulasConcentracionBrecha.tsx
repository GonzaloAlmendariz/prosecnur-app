import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { concentracionDeBrecha } from "./concentracionDeBrecha";

/**
 * ¿Hay atajo? — la lectura que le faltaba a Brechas.
 *
 * La pestaña listaba 168 aulas ordenadas por brecha y nada más. Con eso no se
 * puede repartir el equipo: una lista ordenada SUGIERE que las primeras
 * concentran lo que falta, y puede ser justo al revés. Aquí se ve de un golpe.
 *
 * No duplica Avance: allí la brecha se reparte por facultad y por estrato, que
 * es *dónde*; esto es *en cuántas aulas*.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasConcentracionBrecha({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const c = useMemo(() => concentracionDeBrecha(filas), [filas]);

  if (!c.falta || !c.tramos.length) return null;

  const mitadPct = Math.round((100 * c.aulasParaLaMitad) / c.aulas);
  // «Repartida» cuando hacen falta más de un tercio de las aulas para cubrir la
  // mitad. No es una constante estadística: es el punto a partir del cual «ve a
  // las de arriba» deja de ser un plan.
  const repartida = mitadPct > 33;

  return (
    <div className="aulas-concentracion">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(c.aulasParaLaMitad)}</strong> de {fmt(c.aulas)} aulas concentran la mitad de
        lo que falta{" "}
        {repartida
          ? <>· la brecha está <strong>repartida</strong>: no hay unas pocas que lo cierren</>
          : <>· la brecha está <strong>concentrada</strong>: hay por dónde empezar</>}
      </p>
      <ul className="aulas-concentracion-tramos">
        {c.tramos.map((t) => (
          <li key={t.aulas}>
            <span className="aulas-concentracion-rotulo">
              Las <strong>{fmt(t.aulas)}</strong> con más brecha
            </span>
            <span className="aulas-concentracion-carril" role="img"
              aria-label={`${t.aulas} aulas cubren el ${t.pct}% de lo que falta`}>
              <i style={{ width: `${Math.max(1, t.pct)}%`, background: COLOR_RESULTADO.efectiva }} />
            </span>
            <span className="aulas-concentracion-cifra">
              <strong>{t.pct}%</strong>
              <em>{" "}de lo que falta</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
