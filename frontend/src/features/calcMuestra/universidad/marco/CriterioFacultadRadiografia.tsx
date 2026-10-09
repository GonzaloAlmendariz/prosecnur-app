import type {
  CalcMuestraAulasCriterioSignalDistribution,
  CalcMuestraAulasCriteriosRadiografia,
} from "../../../../api/calcMuestraCriteriosRadiografia";
import type {
  CalcMuestraCriteriosAnclasHistoricas,
  CalcMuestraCriteriosCascada,
  CalcMuestraCriteriosPreviewInput,
  CalcMuestraCriteriosTotales,
} from "../../../../api/calcMuestraCriteriosI18b";
import {
  boxplotDomain,
  CriterioBoxplotLeyenda,
  CriterioBoxplotPercentilar,
} from "./CriterioBoxplotPercentilar";
import { CriteriosRadiografiaCardDetalle } from "./CriteriosRadiografiaCardDetalle";
import { rotuloSegmento } from "./segmentoRotulo";
import { CategoriaEvidencia, dominioCategorias, EjeCategorias } from "../criterios/CategoriaEvidencia";
import { varianteDeCriterio } from "./varianteCriterio";
import type { AporteCategoria } from "../criterios/controles";
import type { CriterioRadiografiaCard } from "./criteriosRadiografiaModel";
import "./criterioFacultadRadiografia.css";

/** F108 · El rótulo vigente por llave; el del payload sólo como respaldo. */
const rotulo = (row: { segment_key?: string | null; segment_label?: string | null }) =>
  rotuloSegmento(row.segment_key, row.segment_label, "ch");

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

function fmt(value: number | null): string {
  return value === null ? "NA" : NUMBER.format(value);
}

export type CriterioFacultadEvidence = {
  radiografia: CalcMuestraAulasCriteriosRadiografia;
  totals: CalcMuestraCriteriosTotales | null;
  cascade: CalcMuestraCriteriosCascada | null;
  anchors: CalcMuestraCriteriosAnclasHistoricas | null;
  previewRequest: CalcMuestraCriteriosPreviewInput | null;
  complete: boolean;
};

/**
 * Fila del contrato v2 → aporte de categoría.
 *
 * F112 · El puente que permite que criterios numéricos y de rango usen la misma
 * tarjeta que los categóricos. Los campos ya existían: lo que faltaba era
 * llamarlos por el mismo nombre.
 */
function aporteDeFila(row: {
  actual: { n_ch: number; n_ch_con_dato: number; n_estudiantes_unicos: number | null; distribution: unknown };
  contraste_total: { n_ch: number; n_estudiantes_unicos?: number | null; distribution: { media: number | null } };
  signal_distribution?: CalcMuestraAulasCriterioSignalDistribution | null;
}): AporteCategoria {
  /*
   * G38 · Un criterio de proporción se describe con su proporción.
   *
   * Gonzalo: «la distribución y el boxplot debían hacer referencia al porcentaje
   * de su composición, no a la cantidad de alumnos elegibles». `actual.distribution`
   * describe alumnos elegibles por curso-horario —la misma variable para todos
   * los criterios—; `signal_distribution` describe **la señal con la que ESTE
   * criterio decide**. Para composición son cosas distintas, y el umbral se fija
   * sobre la segunda.
   *
   * El motor ya la publica en porcentaje con su escala (contrato v2), así que
   * aquí no se convierte nada: se elige cuál de las dos describe el criterio.
   */
  const senal = row.signal_distribution ?? null;
  const esProporcion = senal?.unit === "proporcion";
  /*
   * La señal propia se usa SIEMPRE que exista, no sólo cuando es proporción.
   *
   * La guarda era `unit === "proporcion"`, así que un criterio con señal en otra
   * unidad caía al genérico. Medido sobre HSVG26DEF: «Nivel del curso» publica
   * la suya con `unit: "valor_criterio"` —la distribución de niveles, que es lo
   * que ese criterio decide— y la tarjeta dibujaba en su lugar «elegibles por
   * curso-horario», el MISMO boxplot que «Mínimo de alumnos elegibles»: mismos
   * 961, 0, 4.776, Q1 13, mediana 26. Dos criterios distintos con una figura
   * idéntica, y ninguna de las dos describía el nivel del curso.
   * `esProporcion` sigue mandando sólo donde debe: en cómo se rotula el eje.
   */
  const usaSenal = senal != null;
  return {
    ch: row.actual.n_ch,
    chContraste: row.contraste_total.n_ch,
    elegiblesContraste: row.contraste_total.n_estudiantes_unicos ?? null,
    chConDato: row.actual.n_ch_con_dato,
    elegibles: row.actual.n_estudiantes_unicos,
    mediaContraste: row.contraste_total.distribution.media,
    tasaAsistencia: null,
    distribucion: (usaSenal
      ? senal
      : row.actual.distribution) as AporteCategoria["distribucion"],
    escalaEje: usaSenal ? senal.escala : null,
    nFuera: usaSenal ? senal.n_fuera : null,
    descartePorCorte:
      esProporcion &&
      senal.hist_breaks != null &&
      senal.n_fuera_por_corte.length === senal.hist_breaks.length
        ? { cortes: senal.hist_breaks, fuera: senal.n_fuera_por_corte, total: senal.n_total }
        // Longitudes distintas es un payload incoherente: sin tabla, la línea
        // no se dibuja. Indexar dos vectores desalineados daría una cifra
        // plausible y falsa, que es peor que no dar ninguna.
        : null,
  };
}

/**
 * Cifras VIVAS de un criterio-gate en una facultad, desde la cascada del
 * borrador.
 *
 * `aporteDeFila()` describe el marco CONSTRUIDO: es lo que publica la
 * radiografía. Para un criterio de un solo segmento —el mínimo de elegibles, el
 * nivel del curso— eso significaba que mover su umbral cambiaba la decisión y
 * dejaba «CH que cumplen» y «quedan fuera» clavados en las cifras del último
 * marco. Reportado por Gonzalo el 2026-08-25 moviendo el mínimo propio de
 * Ingeniería: el criterio pasaba a ≥ 11 y la tarjeta seguía diciendo 899 y 62.
 *
 * Sólo se aplica con UN segmento: la cascada publica el corte por criterio y
 * facultad, no por categoría, así que en un criterio de set no hay con qué
 * sustituir cada barra y las suyas se quedan como están.
 */
function aporteVivo(
  cascade: CalcMuestraCriteriosCascada | null,
  criterionId: string,
  facultyKey: string,
): { ch: number; nFuera: number } | null {
  // Sólo la cascada del BORRADOR. La ejecutada describe el marco construido, y
  // ahí el mínimo no recorta nada porque se construyó con el umbral viejo: leer
  // de ella daba «961 CH que cumplen · 0 quedan fuera» —«no excluye a nadie»—
  // cada vez que el preview estaba recalculando. Sin cascada viva se conservan
  // las cifras de la radiografía, que al menos son de un marco real.
  if (cascade?.momento !== "borrador_no_persistido") return null;
  const paso = cascade?.steps.find((s) => s.criterion_id === criterionId);
  const fila = paso?.faculties.find((f) => f.faculty_key === facultyKey);
  if (!fila) return null;
  return { ch: fila.after_ch, nFuera: Math.max(0, fila.before_ch - fila.after_ch) };
}

/**
 * G38 · El aporte de una regla común, para su tarjeta.
 *
 * Composición no admite umbral por facultad —el contrato del motor no lo tiene—
 * así que su tarjeta describe el marco entero. Se prefiere la fila `global`
 * cuando el motor la publica; si no, no se agrega nada a mano: una media de
 * medias no es la media, y React presenta pero no calcula.
 */
export function aporteGlobalDeCard(card: CriterioRadiografiaCard | null): AporteCategoria | null {
  const filas = card?.entries.flatMap((entry) => entry.rows) ?? [];
  if (!filas.length) return null;
  const fila = filas.find((row) => row.segment_kind === "global") ?? filas[0];
  return aporteDeFila(fila);
}

function rowsForFaculty<Row extends { key: string }>(
  rows: Row[],
  facultyKey: string,
): Row[] {
  return rows.filter((row) => row.key === facultyKey);
}

export function criterioCardForFaculty(
  card: CriterioRadiografiaCard,
  facultyKey: string,
  _facultyLabel: string,
): CriterioRadiografiaCard {
  return {
    ...card,
    entries: card.entries.map((entry) => ({
      ...entry,
      rows: rowsForFaculty(
        entry.rows.map((row) => ({ ...row, key: row.faculty_key, label: row.faculty_label })),
        facultyKey,
      ).map(({ key: _key, label: _label, ...row }) => row),
    })),
    v1Rows: rowsForFaculty(
      card.v1Rows.map((row) => ({ ...row, key: row.facultad_key, label: row.facultad_label })),
      facultyKey,
    ).map(({ key: _key, label: _label, ...row }) => row),
  };
}

export function CriterioFacultadRadiografia({
  card,
  facultyKey,
  facultyLabel,
  evidence,
}: {
  card: CriterioRadiografiaCard | null;
  facultyKey: string;
  facultyLabel: string;
  evidence: CriterioFacultadEvidence | null;
}) {
  if (!card || !evidence) {
    return (
      <div className="cmv2-crc-inline-empty" role="status">
        El motor no publicó una radiografía acreditable para este criterio en {facultyLabel}.
      </div>
    );
  }

  const facultyCard = criterioCardForFaculty(card, facultyKey, facultyLabel);
  const localRows = facultyCard.entries.reduce((total, entry) => total + entry.rows.length, 0) + facultyCard.v1Rows.length;
  if (card.state === "v2" && localRows === 0) {
    return (
      <div className="cmv2-crc-contract-alert" role="alert">
        El contrato v2 existe, pero no publica la fila de {facultyLabel} para este criterio. La interfaz no la
        reemplaza con el total ni con otra facultad.
      </div>
    );
  }

  const invalid = facultyCard.state === "invalido";
  const compactRows = invalid
    ? []
    : facultyCard.entries.flatMap((entry) => entry.rows.map((row) => ({ entry, row })));
  // F112 · Sin recorte. Antes se mostraban cuatro segmentos y el resto quedaba
  // en un contador: esconder categorías de un criterio es esconder la decisión,
  // y ninguna de las que no se veían dejaba de contar en el marco.
  const visibleRows = compactRows;
  // S4: las categorías de un criterio se comparan entre sí sobre una escala
  // única, calculada sobre TODAS sus filas.
  const domain = dominioCategorias(compactRows.map(({ row }) => aporteDeFila(row)));



  return (
    <div
      className="cmv2-crc-faculty-inline"
      aria-label={`Radiografía de ${card.label} en ${facultyLabel}`}
      data-card-id={card.cardId}
      data-faculty-key={facultyKey}
    >
      <section className="cmv2-crc-compact" data-state={card.state}>
        <header className="cmv2-crc-compact-head">
          <div>
            {/* Dos cabeceras decían «Radiografía EN Karina E Karina» y
                «Radiografía DE Karina E Karina», distinguidas sólo por una
                preposición: leídas seguidas, parecen la misma sección repetida.
                Cada una se nombra por lo que muestra. */}
            <span>Distribución por categoría</span>
            {/* «Dato de R» nombra de dónde sale el número, no qué es.
                «según X» sólo cuando X reparte de verdad. Con una sola categoría
                el título prometía un desglose que no ocurre: en «Nivel del curso»
                sin rango declarado la única fila es «Todos los niveles», y la
                cabecera anunciaba «Elegibles por curso-horario según nivel del
                curso» sobre un boxplot que no separa por nivel ninguno.
                Reportado por Gonzalo el 2026-08-25: «Nivel de curso me muestra
                otra cosa». El número siempre fue el correcto; el rótulo prometía
                otro. */}
            <strong>
              {visibleRows.length > 1
                ? `Elegibles por curso-horario según ${card.label.toLocaleLowerCase("es-PE")}`
                : "Elegibles por curso-horario"}
            </strong>
          </div>
          <span className="cmv2-crc-compact-state">{card.state === "v2" ? "vigente" : card.state.replace("_", " ")}</span>
        </header>

        {visibleRows.length && domain ? <EjeCategorias dominio={domain} /> : null}
        {visibleRows.length ? (
          <div
            className="cmv2-crc-compact-segments"
            data-qa-geometry-group="calc-muestra/radiografia-compacta-facultad"
            data-qa-geometry-contract="intrinsic"
          >
            {visibleRows.map(({ entry, row }) => (
              <article
                className="cmv2-crc-compact-segment"
                key={`${entry.id}:${row.segment_key}:${row.segment_kind}`}
                data-criterion-id={entry.id}
                data-qa-geometry-member
                data-qa-geometry-capacity="owned"
              >
                <header>
                  <strong>{rotulo(row)}</strong>
                  {facultyCard.entries.length > 1 ? <span>{entry.label}</span> : null}
                </header>
                {/* F112 · La MISMA tarjeta que los criterios categóricos.
                    Gonzalo: «si este va a ser el criterio de tarjeta que vamos a
                    utilizar, tiene que estar en absolutamente todos los
                    criterios, en cada una de las categorías donde haya
                    cursos-horario». Antes esto era un bloque propio con su
                    boxplot, su escala y una lista de diez cifras — dos
                    tratamientos distintos para el mismo dato. */}
                {/* G22 · La variante la decide el criterio, no el componente.
                    Las cuatro existían con sus guards y sólo `categoria` estaba
                    montada: se construyeron, se probaron y nunca se cablearon. */}
                <CategoriaEvidencia
                  aporte={(() => {
                    const base = aporteDeFila(row);
                    if (visibleRows.length !== 1) return base;
                    const vivo = aporteVivo(evidence?.cascade ?? null, entry.id, facultyKey);
                    return vivo ? { ...base, ch: vivo.ch, nFuera: vivo.nFuera } : base;
                  })()}
                  dominio={domain}
                  variante={varianteDeCriterio(entry.id)}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="cmv2-crc-inline-empty" role={invalid ? "alert" : "status"}>
            {invalid
              ? facultyCard.issue ?? "La tarjeta no cumple el contrato y sus filas quedan retenidas."
              : "El motor calculó este criterio, pero no publicó ninguna categoría con datos para esta facultad."}
          </div>
        )}

        {/* F43 · Acotado a la facultad en foco, este bloque deja de ser «las
            quince dentro de una» —4.719 px, el módulo duplicado por criterio— y
            pasa a ser lo que su nombre prometía: el detalle de esta facultad.
            Ya no hay motivo para plegarlo, y por eso desaparece el último
            `<details>` de la pestaña. La comparación entre facultades vive
            arriba, en el panorama y la matriz, que es su sitio. */}
        {/* G19 · Fuera la consola de «Efecto de este criterio».

            Gonzalo: «sigue en la pestaña de criterios cuando ya quedamos que no
            va eso, y en su reemplazo van las tarjetas estandarizadas». Sus
            cuatro pestañas —cuánto recorta, comparación con 2025, si lo
            quitara, decidir— repartían en cuatro clicks lo que las tarjetas de
            arriba enseñan de una vez y sobre una escala compartida.

            Las tarjetas estándar SE QUEDAN: viven en este mismo componente,
            encima. Retirar el componente entero se habría llevado las dos. */}
      </section>
    </div>
  );
}
