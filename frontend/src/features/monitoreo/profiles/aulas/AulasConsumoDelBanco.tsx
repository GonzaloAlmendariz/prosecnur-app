import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";

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

export function AulasConsumoDelBanco({ filas, diasDeCampo = 0, facultadEnFoco, onFoco }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * Días de campo que lleva el estudio: el denominador del ritmo de caídas.
   * Sin él no se proyecta nada, porque el ritmo viejo —caídas por día CON
   * caídas— no podía bajar de 1 y convertía «una reserva libre» en «un día» por
   * aritmética, no por medición.
   */
  diasDeCampo?: number;
  /** La facultad enfocada. **No filtra: resalta** — ver la nota en `AulasRitmoPorFacultad`. */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const { facultades, sinFecha } = useMemo(
    () => consumoDelBanco(filas, diasDeCampo),
    [filas, diasDeCampo],
  );

  // Dos causas, y **sólo dos**: sin plan no hay nada, y con plan sin reemplazos la
  // lista vacía es una buena noticia. Escribí aquí una tercera —«hay reemplazos
  // sin fecha»— y el test la tumbó: en el motor la facultad se registra ANTES de
  // mirar la fecha (`f.caidas += 1` es incondicional), así que un reemplazo sin
  // fecha sí produce entrada y esta lista no puede quedar vacía por eso. Ese caso
  // ya está dicho donde sí ocurre, en la lectura de abajo: «N sin fecha de
  // reemplazo, fuera del cálculo».
  if (!facultades.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {filas.length
          ? "Ningún curso-horario ha sido reemplazado todavía, así que no hay consumo de reserva que medir."
          : "El plan todavía no trae cursos-horario."}
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
          <li key={f.facultad} className={`${f.quedan === 0 ? "es-seca" : ""}${f.facultad === facultadEnFoco ? " es-en-foco" : ""}`.trim() || undefined}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-banco-consumo-nombre"
              enFoco={f.facultad === facultadEnFoco} onFoco={onFoco} />
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
