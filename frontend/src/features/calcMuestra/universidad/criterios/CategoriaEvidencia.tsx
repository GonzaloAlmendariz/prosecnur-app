import type { CalcMuestraAulasCriterioRadiografiaV2Distribution } from "../../../../api/calcMuestraCriteriosRadiografia";
import { fmtInt } from "../../sharedCore";
import type { AporteCategoria } from "./controles";
import { DistribucionCategoria, dominioRedondeado } from "./DistribucionCategoria";
import "./categoriaEvidencia.css";

/**
 * ADR 0057 · La evidencia de una categoría, en el mismo contenedor que decide.
 *
 * Antes esto vivía repartido: el conmutador aquí, la distribución en una consola
 * aparte, el efecto en el embudo en otro bloque con su propio lenguaje. Se
 * elegía en una zona de la pantalla mirando otra.
 *
 * Todo lo que se dibuja lo calcula R. React no promedia, no acumula y no
 * infiere: si un valor no viene, se declara ausente en vez de fabricarse.
 */

/** Dominio común a todas las categorías de un criterio (ADR 0057, regla 3). */
export type DominioCategorias = { min: number; max: number };

/**
 * Escala compartida por todas las categorías del criterio.
 *
 * Cada caja normalizada contra su propio rango sale del mismo ancho y sugiere
 * que todas las categorías se parecen. Comparar es lo único para lo que existe
 * este gráfico, así que la escala es del conjunto o no hay gráfico.
 *
 * F113 · **El dominio abarca todo lo que se dibuja, no sólo los cuantiles.**
 *
 * Medido en la app con datos del motor: la escala salía de P10..P90 y la media
 * —[17,8 · 43]— mientras el gráfico pintaba bigotes de Tukey (15→60) y un
 * histograma (6→90). Resultado: `left: -11%`, `width: 178%`, topes en `167%` y
 * un polígono de densidad de −66 a 592. Todo fuera del contenedor.
 *
 * Ninguna prueba lo vio porque **todos mis fixtures usaban un dominio 0..100
 * que cubría cualquier valor**. Un dominio holgado en el fixture esconde
 * exactamente el defecto que el dominio ajustado produce.
 */
export function dominioCategorias(
  aportes: Array<AporteCategoria | null | undefined>,
  /**
   * F117 · El corte de un criterio de umbral entra en la escala.
   *
   * Es la misma regla que F113 —el dominio abarca todo lo que se dibuja— con la
   * consecuencia que más importa aquí: un mínimo mayor que el máximo observado
   * **deja fuera todos los cursos-horario**, y eso hay que verlo. Sin incluirlo,
   * el corte se pinta fuera del contenedor y el caso más grave es el único que
   * no se ve.
   */
  umbral?: number | null,
): DominioCategorias | null {
  const valores: number[] = [];
  if (typeof umbral === "number" && Number.isFinite(umbral)) valores.push(umbral);
  for (const aporte of aportes) {
    const d = aporte?.distribucion;
    if (!d) continue;
    // Cada marca que el gráfico dibuja entra en la escala que la posiciona.
    for (const v of [d.p10, d.p25, d.p50, d.p75, d.p90, d.media, d.min, d.max, d.bigote_inf, d.bigote_sup]) {
      if (typeof v === "number" && Number.isFinite(v)) valores.push(v);
    }
    // El histograma se dibuja de su primer borde al último.
    const bordes = d.hist_breaks;
    if (bordes?.length) {
      valores.push(bordes[0], bordes[bordes.length - 1]);
    }
  }
  if (!valores.length) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  // F114 · Se redondea aquí, una sola vez: así todas las categorías del criterio
  // comparten las MISMAS marcas de eje y las tarjetas alinean por construcción.
  return dominioRedondeado(max > min ? { min, max } : { min, max: min + 1 });
}

/**
 * F107 · Singular de «curso-horario».
 *
 * Medido en la app con datos reales: dos categorías excluidas mostraban «sus 1
 * cursos-horario». Ninguna de mis pruebas lo cazó porque **todos los fixtures
 * usaban valores plurales** —120 CH, 3.400 estudiantes—, así que la rama del
 * singular no se ejecutó nunca. Un guard prueba lo que se le da a probar.
 */
function ch1(n: number | null | undefined): string {
  return n === 1 ? "curso-horario" : "cursos-horario";
}

/** Concuerda un sustantivo con su cifra. `n` nulo mantiene el plural genérico. */
function plural(n: number | null | undefined, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}


const fmt = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("es-PE", { maximumFractionDigits: 1 })
    : "—";

/**
 * Declaración de la escala del criterio.
 *
 * Antes esto dibujaba un eje con marcas — y **mentía**: medido en la app, el eje
 * quedaba en x=159 y las cajas en 637–693, cada una en su columna del grid. Unas
 * marcas que no están encima de los datos no se pueden leer contra ellos; son
 * decoración con aspecto de precisión, que es peor que no tener eje.
 *
 * La escala se declara aquí una vez, en palabras, y las marcas viajan pegadas a
 * cada caja, que es donde sí alinean.
 */
export function EjeCategorias({ dominio }: { dominio: DominioCategorias }) {
  return (
    <div className="cmv2-cat-escala-cabecera">
      <p className="cmv2-cat-escala-nota">
        {/* F114 · Antes esta nota explicaba en dos frases lo que el eje
            rotulado ya enseña. Gonzalo: «siento todavía que hay como mucho
            metatexto». Queda lo que el eje no puede decir por sí solo: qué se
            está midiendo. */}
        Estudiantes elegibles por curso-horario · escala común a las categorías
        de este criterio, de <strong>{fmt(dominio.min)}</strong> a{" "}
        <strong>{fmt(dominio.max)}</strong>.
      </p>
      {/* Qué significa cada marca. Va una vez por criterio, no por categoría.
          F111 · Antes decía «de P10 a P90» para los bigotes; con el boxplot
          estándar son los de Tukey —el dato más extremo dentro de 1,5 × RIC—.
          Una leyenda que sobrevive al gráfico que describía es tan falsa como
          una cifra mal calculada, y se lee con la misma confianza. */}
      <ul className="cmv2-cat-leyenda" aria-hidden="true">
        <li><i className="cmv2-cat-leyenda-densidad" /> densidad</li>
        <li><i className="cmv2-cat-leyenda-rango" /> mitad central (P25–P75)</li>
        <li><i className="cmv2-cat-leyenda-mediana" /> mediana</li>
        <li><i className="cmv2-cat-leyenda-media" /> media</li>
        <li><i className="cmv2-cat-leyenda-bigote" /> bigotes de Tukey (1,5 × RIC)</li>
      </ul>
    </div>
  );
}



/**
 * Todo lo que ADR 0057 exige de una categoría: cuántos CH, cuántos alumnos, la
 * forma de su distribución con sus cuantiles, y qué se espera que asista.
 */
/**
 * F115 · Dos variantes, porque no todo lo que se decide es una categoría.
 *
 * Gonzalo: «hay algunos selectores que no son criterios como tal; por ejemplo,
 * el último es simplemente escoger cada uno de los cursos-horario e
 * individualmente validar si vamos a considerarlo o no. Para ese caso no
 * podemos tener información a nivel de densidad ni de cursos-horario totales,
 * pero sí precisión acerca de cuántos alumnos son elegibles y, en caso se tenga
 * asistencia histórica previa, cuánto es y cuánto representa».
 *
 * - `categoria` — un conjunto de cursos-horario: caben las cuatro cifras y las
 *   cuatro capas del gráfico.
 * - `unidad` — **un** curso-horario: «CH totales» valdría 1 y una distribución
 *   de un solo valor no tiene forma. Queda lo que sí decide: cuántos alumnos
 *   elegibles tiene y cuántos se esperan presentes.
 */
/**
 * F118 · Cuatro estándares, uno por tipo de criterio.
 *
 * Gonzalo: «así como hemos definido este estándar que está muy bien para el
 * categórico, poder definir un estándar para cada uno». No es cosmética: cada
 * tipo hace una pregunta distinta y las cifras que la responden cambian.
 *
 * | variante     | la pregunta                        | las cifras                        |
 * |--------------|------------------------------------|-----------------------------------|
 * | `categoria`  | ¿esta categoría entra?             | CH totales · elegibles · alumnos  |
 * | `umbral`     | ¿dónde corto?                      | **qué deja dentro y qué fuera**   |
 * | `proporcion` | ¿qué prevalencia exijo?            | igual, sobre una escala 0–100 %   |
 * | `unidad`     | ¿este curso-horario entra?         | alumnos y presentes esperados     |
 *
 * `umbral` y `proporcion` comparten cifras porque comparten pregunta; se
 * separan en el eje, que en una proporción **es** 0–100 % y no lo fija el dato.
 */
export type VarianteEvidencia = "categoria" | "umbral" | "proporcion" | "unidad";

export function CategoriaEvidencia({
  aporte,
  dominio,
  variante = "categoria",
}: {
  aporte: AporteCategoria;
  dominio: DominioCategorias | null;
  variante?: VarianteEvidencia;
}) {
  // Una categoría sin cursos-horario no tiene nada que distribuir: cinco
  // cuantiles en guiones ocupan espacio y no informan.
  //
  // F105 · Pero `ch` es el segmento **∩ lo que sigue incluido** (verificado en
  // `calc_muestra_aulas_criterio_radiografia_aulas.R`: `actual_idx <-
  // segment_idx[included_actual[segment_idx]]`), así que llega a 0 por dos
  // caminos que no significan lo mismo:
  //
  //   - la facultad no tiene cursos de esa categoría, o
  //   - los tiene y **un criterio los dejó fuera**.
  //
  // Tratar ambos como «sin cursos-horario en esta facultad» era mentir en el
  // segundo caso, y encima ocultaba el contraste: una categoría con 200 CH en
  // el marco, excluida, declaraba no tener ninguno. `chContraste` —los CH
  // totales, incluidos o no— es lo que separa un caso del otro.
  const sinCursos = aporte.ch === 0;
  const excluida = sinCursos && (aporte.chContraste ?? 0) > 0;
  const d = sinCursos ? null : aporte.distribucion ?? null;
  // F112 · Con 0 alumnos elegibles no hay presentes que estimar: la categoría
  // excluida mostraba «~0 presentes de 0», que ocupa una casilla para decir que
  // no hay nada — y ya lo dice la línea de efecto, con su cifra real.
  const presentes =
    typeof aporte.elegibles === "number" &&
    aporte.elegibles > 0 &&
    typeof aporte.tasaAsistencia === "number"
      ? Math.round(aporte.elegibles * aporte.tasaAsistencia)
      : null;

  if (variante === "umbral" || variante === "proporcion") {
    // Lo que el corte deja fuera. Es resta de dos cifras que el motor ya
    // publicó —presentación, no un estadístico nuevo—: si alguna falta, no se
    // fabrica.
    const fuera =
      aporte.chContraste != null && aporte.ch != null ? aporte.chContraste - aporte.ch : null;
    return (
      <div className="cmv2-cat-evidencia" data-variante={variante}>
        <div className="cmv2-cat-cifras">
          <span><strong>{aporte.ch == null ? "—" : fmtInt(aporte.ch)}</strong>{ch1(aporte.ch)} que cumplen</span>
          <span data-tono={fuera && fuera > 0 ? "aviso" : undefined}>
            <strong>{fuera == null ? "—" : fmtInt(fuera)}</strong>quedan fuera
          </span>
          <span title="Estudiantes únicos elegibles que sobreviven al corte">
            <strong>{aporte.elegibles == null ? "—" : fmtInt(aporte.elegibles)}</strong>
            {plural(aporte.elegibles, "alumno elegible", "alumnos elegibles")}
          </span>
          <span title="Supuesto de asistencia del marco, aplicado a los alumnos que sobreviven al corte">
            {presentes != null ? (
              <>
                <strong>~{fmtInt(presentes)}</strong>
                presentes<em>{Math.round((aporte.tasaAsistencia ?? 0) * 100)}% de asistencia</em>
              </>
            ) : (
              <><strong>—</strong>presentes</>
            )}
          </span>
        </div>
        {d && dominio ? (
          <DistribucionCategoria
            elegible={{ nCh: aporte.ch, distribucion: d }}
            dominio={dominio}
            umbral={aporte.umbral ?? null}
            formato={variante === "proporcion" ? "porcentaje" : "conteo"}
            unidad={aporte.unidadEje ?? "estudiantes elegibles por curso-horario"}
          />
        ) : (
          <p className="cmv2-cat-sin-cursos">sin distribución publicada</p>
        )}
      </div>
    );
  }

  if (variante === "unidad") {
    return (
      <div className="cmv2-cat-evidencia" data-variante="unidad">
        <div className="cmv2-cat-cifras" data-columnas="2">
          <span title="Estudiantes únicos elegibles de este curso-horario">
            <strong>{aporte.elegibles == null ? "—" : fmtInt(aporte.elegibles)}</strong>
            {plural(aporte.elegibles, "alumno elegible", "alumnos elegibles")}
          </span>
          {/* La celda se reserva aunque no haya asistencia histórica: es la
              regla de alineación de F114, y aquí pesa más porque la lista de
              cursos-horario es larga y el ojo baja por la columna. */}
          <span title="Asistencia histórica observada, aplicada a los alumnos elegibles de este curso-horario">
            {presentes != null ? (
              <>
                <strong>~{fmtInt(presentes)}</strong>
                presentes<em>{Math.round((aporte.tasaAsistencia ?? 0) * 100)}% de asistencia histórica</em>
              </>
            ) : (
              <>
                <strong>—</strong>
                presentes<em>sin asistencia histórica</em>
              </>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="cmv2-cat-evidencia">
      {/* F111 · Cuatro cifras, decididas con Gonzalo: CH totales, CH elegibles,
          alumnos elegibles y —si el marco la trae— la tasa de asistencia previa.
          Sale **matrículas**: F105 la había puesto para separar los dos granos,
          pero con «alumnos elegibles» rotulado y el conteo de CH al lado, la
          suma de matrículas ocupaba una casilla sin decidir nada. */}
      <div className="cmv2-cat-cifras">
        <span><strong>{aporte.chContraste == null ? "—" : fmtInt(aporte.chContraste)}</strong>CH totales</span>
        <span><strong>{aporte.ch == null ? "—" : fmtInt(aporte.ch)}</strong>CH elegibles</span>
        {/* `n_estudiantes_unicos`: una persona cuenta una vez aunque esté en
            varios cursos-horario. */}
        <span title="Estudiantes únicos elegibles: una persona cuenta una vez aunque esté en varios cursos-horario">
          <strong>{aporte.elegibles == null ? "—" : fmtInt(aporte.elegibles)}</strong>
          {plural(aporte.elegibles, "alumno elegible", "alumnos elegibles")}
        </span>
        {/* La cuarta celda se reserva aunque no haya tasa: un hueco que alinea
            vale más que una rejilla que se recoloca de tarjeta en tarjeta. */}
        <span title="Supuesto de asistencia del marco, aplicado a los alumnos elegibles de esta categoría">
          {presentes != null ? (
            <>
              <strong>~{fmtInt(presentes)}</strong>
              presentes<em>{Math.round((aporte.tasaAsistencia ?? 0) * 100)}% de asistencia</em>
            </>
          ) : (
            <>
              <strong>—</strong>
              presentes
            </>
          )}
        </span>
      </div>
      {/* Contraste: la misma categoría sobre TODOS los cursos-horario. Sin él no
          se sabe si el subconjunto elegible se parece al total o si los
          criterios lo han desplazado —que es justo lo que un criterio hace—. */}
      {/* F112 · Retirada la línea «En todos los cursos-horario: N CH, media M».
          Duplicaba «CH totales», que ya está arriba, y su otra mitad era la
          media de la distribución general — justo lo que Gonzalo dijo que no
          decide: «nos importa la distribución de los elegibles, no tanto la
          distribución general de todo». */}
      {/* F105 · El efecto de la categoría en el embudo, que es el sexto
          contenido que ADR 0057 exige de esta tarjeta y era el único que
          faltaba. No hay cálculo nuevo: es `ch` y `elegibles` dichos como lo
          que son —lo que esta decisión pone o quita—, sin la metáfora de la
          cascada. Y como `ch` se mide contra lo que sigue incluido, la frase se
          recalcula sola con cada criterio anterior (regla 5). */}
      {excluida ? (
        <p className="cmv2-cat-efecto" data-estado="fuera">
          Fuera del marco: {(aporte.chContraste ?? 0) === 1 ? "su" : "sus"}{" "}
          <strong>{fmtInt(aporte.chContraste ?? 0)}</strong>{" "}
          {ch1(aporte.chContraste)} no {(aporte.chContraste ?? 0) === 1 ? "entra" : "entran"} con
          los criterios actuales.
        </p>
      ) : sinCursos ? (
        <p className="cmv2-cat-sin-cursos">sin cursos-horario en esta facultad</p>
      ) : (
        <p className="cmv2-cat-efecto" data-estado="dentro">
          Quitarla deja fuera <strong>{fmtInt(aporte.ch ?? 0)}</strong> {ch1(aporte.ch)}
          {aporte.elegibles != null ? (
            <> y <strong>{fmtInt(aporte.elegibles)}</strong> {aporte.elegibles === 1 ? "estudiante" : "estudiantes"}</>
          ) : null}.
        </p>
      )}
      {/* F111 · Densidad, boxplot y cuantiles sobre un SOLO eje. Antes la caja
          y una fila equiespaciada de P10–P90 vivían separadas: los cinco
          cuantiles ocupaban el mismo ancho aunque P10→P25 recorra cinco veces
          más que P25→P50, y no había forma de leer un número contra el gráfico.
          Ahora cada cifra cae bajo su posición real. */}
      {!sinCursos ? (
        <DistribucionCategoria
          elegible={{ nCh: aporte.ch, distribucion: d }}
          dominio={dominio}
        />
      ) : null}
    </div>
  );
}
