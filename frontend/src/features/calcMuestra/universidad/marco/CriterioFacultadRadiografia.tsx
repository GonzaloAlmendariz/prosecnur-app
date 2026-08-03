import type { CalcMuestraAulasCriteriosRadiografia } from "../../../../api/calcMuestraCriteriosRadiografia";
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
  contraste_total: { n_ch: number; distribution: { media: number | null } };
}): AporteCategoria {
  return {
    ch: row.actual.n_ch,
    chContraste: row.contraste_total.n_ch,
    chConDato: row.actual.n_ch_con_dato,
    elegibles: row.actual.n_estudiantes_unicos,
    mediaContraste: row.contraste_total.distribution.media,
    tasaAsistencia: null,
    distribucion: row.actual.distribution as AporteCategoria["distribucion"],
  };
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
            {/* «Dato de R» nombra de dónde sale el número, no qué es. */}
            <strong>Elegibles por curso-horario según {card.label.toLocaleLowerCase("es-PE")}</strong>
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
                <CategoriaEvidencia aporte={aporteDeFila(row)} dominio={domain} />
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
        <section className="cmv2-crc-compact-detail">
          {/* F112 · Aquí iba «N segmentos más de esta facultad»: un contador de
              lo que la lista no mostraba. Ya no hay recorte, así que no hay nada
              que contar — y un contador es la forma más barata de esconder. */}
          <CriteriosRadiografiaCardDetalle
            card={facultyCard}
            radiografia={evidence.radiografia}
            totals={null}
            cascade={evidence.cascade}
            anchors={evidence.anchors}
            previewRequest={evidence.previewRequest}
            i18bComplete={evidence.complete}
            context="faculty"
            facultyKey={facultyKey}
            facultyLabel={facultyLabel}
          />
        </section>
      </section>
    </div>
  );
}
