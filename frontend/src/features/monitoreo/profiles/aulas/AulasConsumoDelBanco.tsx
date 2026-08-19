import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";

/**
 * Cuánto aguanta el colchón de cada facultad al ritmo al que se está gastando.
 *
 * El «no pasarnos de determinadas aulas» que pide Gonzalo no tiene número
 * declarado en ninguna configuración. El techo que los datos SÍ sostienen es
 * otro: cuando una facultad se queda sin reservas, un aula que caiga ya no se
 * puede reemplazar.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

export function AulasConsumoDelBanco({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { facultades, sinFecha } = useMemo(() => consumoDelBanco(filas), [filas]);

  if (!facultades.length) {
    return (
      <p className="mon-profile-muted">
        Ningún curso-horario ha caído todavía, así que no hay consumo de colchón que medir.
      </p>
    );
  }

  const secas = facultades.filter((f) => f.quedan === 0).length;
  const caidas = facultades.reduce((n, f) => n + f.caidas, 0);

  return (
    <div className="aulas-banco-consumo">
      <p className="aulas-banco-consumo-lectura">
        <strong>{fmt(caidas)}</strong> {caidas === 1 ? "aula ha caído" : "aulas han caído"}
        {secas ? (
          <> · <strong>{fmt(secas)}</strong> {secas === 1 ? "facultad ya no tiene" : "facultades ya no tienen"} con
            qué reemplazar</>
        ) : null}
        {sinFecha ? <> · {fmt(sinFecha)} sin fecha de caída, fuera del ritmo</> : null}
      </p>
      <ul className="aulas-banco-consumo-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-banco-consumo-cabecera" aria-hidden="true">
          <span>Facultad</span><span>Caídas</span><span>Quedan</span><span>Aguanta</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad} className={f.quedan === 0 ? "es-seca" : undefined}>
            <span className="aulas-banco-consumo-nombre" title={f.facultad}>{f.facultad}</span>
            <span className="aulas-banco-consumo-cifra">
              {fmt(f.caidas)}
              {f.ritmo ? <em> · {f.ritmo.toLocaleString("es-PE")}/día</em> : null}
            </span>
            <span className="aulas-banco-consumo-cifra">{fmt(f.quedan)}</span>
            {/* «Aguanta» en días de campo, no una fecha: el ritmo de caídas es
                mucho más irregular que el de aplicación y poner una fecha exacta
                le daría una precisión que no tiene. */}
            <span className="aulas-banco-consumo-aguanta">
              {f.quedan === 0
                ? <strong>ya sin colchón</strong>
                : f.diasHastaAgotarse == null
                  ? <em>sin ritmo</em>
                  : <>{fmt(f.diasHastaAgotarse)} {f.diasHastaAgotarse === 1 ? "día" : "días"}</>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-banco-consumo-pie">
        «Aguanta» son días de campo al ritmo de caídas de esa facultad. El estudio no declara un
        máximo de aulas: el techo que se mide aquí es quedarse sin reservas.
      </p>
    </div>
  );
}
