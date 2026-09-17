import { useMemo } from "react";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";
import { SIN_VALOR_DEL_EJE } from "./consumoDeCadena";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import {
  etiquetaDelEje, etiquetaPluralDelEje, etiquetaDeValorEnGrafico,
  etiquetaSinValorDelEje, type EjeDeclarado,
} from "./etiquetaDelEje";
import { fmt } from "./kpisDeAulas";

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

export function AulasConsumoDelBanco({ filas, diasDeCampo = 0, facultadEnFoco, onFoco, eje }: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * La declaración del eje (`avance_cuota.eje`), que decide por qué columna se
   * agrupa y con qué palabra se dice.
   *
   * Sin ella el panel se reduce a UNA fila en un estudio de una sola facultad
   * —«CIENCIAS SOCIALES», con las 85 cadenas dentro— y deja de contestar su
   * única pregunta: DÓNDE se rompe la reserva. Visto en pantalla el 2026-09-17.
   *
   * **Ojo con la palabra.** Con el eje en nivel, el nivel de un curso-horario
   * es su nivel MODAL (`calc_muestra_aulas.R:1432` lo colapsa a la moda del
   * aula), mientras que las celdas de cuota cuentan PERSONAS resueltas contra
   * el padrón. Es la misma palabra para dos cosas, así que el pie lo dice: si
   * no, quien lea sumará las dos.
   */
  eje?: EjeDeclarado;
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
  const columna = eje?.columna || "faculty";
  const { facultades, sinFecha } = useMemo(
    () => consumoDelBanco(filas, diasDeCampo, columna),
    [filas, diasDeCampo, columna],
  );
  // El valor del eje, dicho con su palabra: «CIENCIAS E INGENIERIA» crudo con
  // el eje en facultad —HSVG no se mueve— y «Nivel 7» con el eje en nivel,
  // porque un «7» suelto en una columna de cifras se lee como una cuenta.
  const nombre = (valor: string) =>
    valor === SIN_VALOR_DEL_EJE ? etiquetaSinValorDelEje(eje) : etiquetaDeValorEnGrafico(valor, eje);

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
          <> · <strong>{fmt(secas)}</strong>{" "}
            {(secas === 1 ? etiquetaDelEje(eje) : etiquetaPluralDelEje(eje)).toLocaleLowerCase("es")}
            {" sin reserva disponible"}</>
        ) : null}
        {sinFecha ? <> · {fmt(sinFecha)} sin fecha de reemplazo, fuera del cálculo</> : null}
      </p>
      <ul role="table"
        aria-label={`Consumo de la reserva por ${etiquetaDelEje(eje).toLocaleLowerCase("es")}`}
        className="aulas-banco-consumo-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* Semántica de tabla sobre la rejilla: la cabecera iba con
            `aria-hidden` y un lector de pantalla recibía cifras sin nombre de
            columna. Roles y no `<table>`: la geometría está afinada y el
            defecto es de nombres. */}
        <li className="aulas-banco-consumo-cabecera" role="row">
          <span role="columnheader">{etiquetaDelEje(eje)}</span><span role="columnheader">Reemplazados</span><span role="columnheader">Reserva libre</span><span role="columnheader">Días de reserva</span>
        </li>
        {facultades.map((f) => (
          <li key={f.facultad} role="row" className={`${f.quedan === 0 ? "es-seca" : ""}${f.facultad === facultadEnFoco ? " es-en-foco" : ""}`.trim() || undefined}>
            <NombreDeFacultad facultad={f.facultad} className="aulas-banco-consumo-nombre"
              rol="rowheader"
              ejeClave={eje?.clave || "facultad"}
              enFoco={f.facultad === facultadEnFoco}>
              {nombre(f.facultad)}
            </NombreDeFacultad>
            <span role="cell" className="aulas-banco-consumo-cifra">
              {fmt(f.caidas)}
              {f.ritmo ? <em> · {f.ritmo.toLocaleString("es-PE")}/día</em> : null}
            </span>
            <span role="cell" className="aulas-banco-consumo-cifra">{fmt(f.quedan)}</span>
            {/* En días de campo y no en una fecha: el ritmo de reemplazos es
                mucho más irregular que el de aplicación, y poner una fecha exacta
                le daría una precisión que no tiene. */}
            <span role="cell" className="aulas-banco-consumo-aguanta">
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
        ritmo de reemplazos de ese grupo. El estudio no declara un máximo de cursos-horario: el techo
        que se mide aquí es agotar la reserva.
        {/* **La misma palabra para dos cosas, y hay que separarlas.** Con el
            eje en un valor de la PERSONA —el nivel sale del padrón— lo que
            agrupa aquí es el valor del CURSO-HORARIO, que es su moda. Sin esta
            línea, «Nivel 7: 3 reemplazados» y «Nivel 7: faltan 103 personas»
            parecen dos cifras del mismo grupo, y son de dos poblaciones. */}
        {eje?.atribucion === "persona" ? (
          <>
            {" "}El {etiquetaDelEje(eje).toLocaleLowerCase("es")} de un curso-horario es el de la
            mayoría de sus alumnos; las metas, en cambio, se cuentan por persona.
          </>
        ) : null}
      </p>
    </div>
  );
}
