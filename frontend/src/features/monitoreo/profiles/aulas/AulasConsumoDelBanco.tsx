import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";

/**
 * Cuánto cubre la reserva de cada facultad al ritmo de reemplazos observado.
 *
 * El registro es el del informe, no el de la sala: «reemplazadas», «reserva
 * libre», «días de reserva». Se escribía «caídas», «quedan», «aguanta» y «ya sin
 * colchón», y Gonzalo lo paró: «no puede haber una sección que se llame cuánto
 * aguanta el colchón; ¿cómo es posible que haya un lenguaje tan coloquial para
 * algo académico?». Tenía razón: esto se lee en un comité.
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
        Ningún curso-horario ha sido reemplazado todavía, así que no hay consumo de reserva que medir.
      </p>
    );
  }

  const secas = facultades.filter((f) => f.quedan === 0).length;
  const caidas = facultades.reduce((n, f) => n + f.caidas, 0);

  return (
    <div className="aulas-banco-consumo">
      <p className="aulas-banco-consumo-lectura">
        <strong>{fmt(caidas)}</strong> {caidas === 1 ? "curso-horario reemplazado" : "cursos-horario reemplazados"}
        {secas ? (
          <> · <strong>{fmt(secas)}</strong> {secas === 1 ? "facultad sin reserva disponible" : "facultades sin reserva disponible"}</>
        ) : null}
        {sinFecha ? <> · {fmt(sinFecha)} sin fecha de reemplazo, fuera del cálculo</> : null}
      </p>
      <ul className="aulas-banco-consumo-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <li className="aulas-banco-consumo-cabecera" aria-hidden="true">
          <span>Facultad</span><span>Reemplazadas</span><span>Reserva libre</span><span>Días de reserva</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad} className={f.quedan === 0 ? "es-seca" : undefined}>
            <span className="aulas-banco-consumo-nombre" title={f.facultad}>{f.facultad}</span>
            <span className="aulas-banco-consumo-cifra">
              {fmt(f.caidas)}
              {f.ritmo ? <em> · {f.ritmo.toLocaleString("es-PE")}/día</em> : null}
            </span>
            <span className="aulas-banco-consumo-cifra">{fmt(f.quedan)}</span>
            {/* En días de campo y no en una fecha: el ritmo de reemplazos es
                mucho más irregular que el de aplicación, y poner una fecha exacta
                le daría una precisión que no tiene. */}
            <span className="aulas-banco-consumo-aguanta">
              {f.quedan === 0
                ? <strong>sin reserva</strong>
                : f.diasHastaAgotarse == null
                  ? <em>sin ritmo</em>
                  : <>{fmt(f.diasHastaAgotarse)} {f.diasHastaAgotarse === 1 ? "día" : "días"}</>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mon-profile-muted aulas-banco-consumo-pie">
        <strong>Días de reserva</strong> son los días de campo que la reserva libre cubriría al
        ritmo de reemplazos de esa facultad. El estudio no declara un máximo de aulas: el techo
        que se mide aquí es agotar la reserva.
      </p>
    </div>
  );
}
