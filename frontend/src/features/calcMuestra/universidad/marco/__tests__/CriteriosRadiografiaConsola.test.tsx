import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriterioRadiografiaV2Row,
  CalcMuestraAulasCriteriosRadiografiaV2,
  CriteriosCatalogo,
} from "../../../../../api/client";
import {
  CriteriosRadiografiaCardDetalle,
  CriteriosRadiografiaConsola,
} from "../CriteriosRadiografiaConsola";
import type { CriterioRadiografiaCard } from "../criteriosRadiografiaModel";
import { criterioCardForFaculty } from "../CriterioFacultadRadiografia";

const distribution = { media: 10, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 };

function startTags(html: string, tag: string, className: string): string[] {
  return html.match(new RegExp(`<${tag}\\b[^>]*class="${className}"[^>]*>`, "g")) ?? [];
}

function expectOwnedGeometryMembers(tags: string[]): void {
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) {
    expect(tag).toContain("data-qa-geometry-member");
    expect(tag).toContain('data-qa-geometry-capacity="owned"');
  }
}

const row: CalcMuestraAulasCriterioRadiografiaV2Row = {
  faculty_key: "ingenieria",
  faculty_label: "Ingeniería",
  segment_key: "cumple",
  segment_label: "Cumple umbral",
  segment_kind: "cumple",
  actual: {
    n_ch: 4,
    n_ch_con_dato: 4,
    n_estudiantes_unicos: 30,
    n_matriculas: 35,
    distribution,
  },
  contraste_total: {
    n_ch: 5,
    n_ch_con_dato: 5,
    n_estudiantes_unicos: 32,
    n_matriculas: 40,
    distribution,
  },
  signal_distribution: {
    unit: "valor_criterio",
    n_total: 4,
    n_con_dato: 4,
    ...distribution,
  },
  delta: {
    reference: "marco_ejecutado",
    action: "reemplazar_regla",
    reconstruccion_valida: false,
    delta_ch: null,
    delta_matriculas: null,
    delta_estudiantes_unicos: null,
  },
};

function numericEntry(): CalcMuestraAulasCriterioRadiografiaV2Entry {
  return {
    id: "enrolled_total",
    card_id: "enrolled_total",
    label: "Matrículas inscritas",
    scope: "aula",
    family: "classroom_numeric",
    owner: "calc_muestra_aulas_frame_v1.aula_frame",
    kind: "numeric",
    grain: "curso_horario_x_facultad_x_segmento",
    unit: "curso_horario_unico",
    gate: "marco",
    status: "disponible",
    effective_layer: null,
    overlap: false,
    faculty_dimension: "curso_horario_efectiva",
    rows: [row],
  };
}

const catalogo: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [{
    id: "enrolled_total",
    scope: "aula",
    kind: "numeric",
    label: "Matrículas inscritas",
    mappedColumn: "Matriculados",
  }],
};

const radiografia: CalcMuestraAulasCriteriosRadiografiaV2 = {
  schema: "calc_muestra_aulas_criterios_radiografia_v2",
  owner: "calc_muestra_aulas_frame_v1.criterios_radiografia",
  frame_hash: "frame-123",
  momento: "marco_ejecutado",
  grano: "criterio_x_facultad_x_segmento",
  unidad: "curso_horario_unico",
  filas_owner: "calc_muestra_aulas_frame_v1.aula_frame",
  filas_grano: "session_type_x_facultad_efectiva",
  filas: [],
  criterios: [numericEntry()],
};

describe("CriteriosRadiografiaConsola", () => {
  it("renderiza la jerarquía literal, denominadores, seis estadísticos y NA honesto", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola
        catalogo={catalogo}
        radiografia={radiografia}
        rawPresent
        scope="aula"
      />,
    );

    // S1: los cinco pasos se recorren, no se apilan. El riel conserva el orden
    // metodológico completo y la tarjeta abre en Distribución — el dato.
    const riel = html.slice(html.indexOf('class="cmv2-crc-pasos"'));
    expect(riel.indexOf("Distribución")).toBeLessThan(riel.indexOf("Cascada viva"));
    expect(riel.indexOf("Cascada viva")).toBeLessThan(riel.indexOf("Ancla histórica"));
    expect(riel.indexOf("Ancla histórica")).toBeLessThan(riel.indexOf("Impacto marginal"));
    expect(riel.indexOf("Impacto marginal")).toBeLessThan(riel.indexOf("Acción"));
    expect(html).toContain('data-paso="distribucion"');
    expect(html).toContain('data-paso="accion"');
    // F41 · «Procedencia y contrato» —hash, owner, grano, unidad— es el contrato
    // interno del motor, no información del estudio: sale de la superficie. Y
    // con ella el último plegado: «si algo está oculto es un error de diseño».
    expect(html).not.toContain("Procedencia y contrato");
    expect(html).not.toContain("<details");
    // S1: un solo control para enfocar un criterio. El `<select>` que
    // duplicaba la tira quedó retirado; su información vive en el chip.
    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Enfocar criterio"');
    expect(html).toContain("Radiografía v2");
    expect(html).toContain('data-qa-geometry-group="calc-muestra/criterios-radiografia-consola"');
    expect(html).toContain('data-qa-geometry-group="calc-muestra/criterios-radiografia-facultades"');
    expect(html).toContain('aria-label="Radiografía en Ingeniería"');
    expect(html).toContain("Ingeniería");
    expect(html).toContain("Media");
    expect(html).toContain("P10");
    expect(html).toContain("P25");
    expect(html).toContain("P50 · mediana");
    expect(html).toContain("P75");
    expect(html).toContain("P90");
    expect(html).toContain("NA CH");
  });

  it("declara la geometría intrínseca de pasos, segmentos y snapshots", () => {
    const secondRow: CalcMuestraAulasCriterioRadiografiaV2Row = {
      ...row,
      segment_key: "no_cumple",
      segment_label: "No cumple umbral",
      segment_kind: "no_cumple",
    };
    const entry = { ...numericEntry(), rows: [row, secondRow] };
    const card: CriterioRadiografiaCard = {
      cardId: entry.card_id,
      label: entry.label,
      scope: entry.scope,
      kind: entry.kind,
      gateIds: [entry.id],
      source: "catalogo",
      expectedFamily: entry.family,
      state: "v2",
      entries: [entry],
      v1Rows: [],
    };

    const html = renderToStaticMarkup(
      <CriteriosRadiografiaCardDetalle card={card} radiografia={radiografia} />,
    );

    const cardTags = startTags(html, "article", "cmv2-crc-card");
    expect(cardTags).toHaveLength(1);
    expect(cardTags[0]).toContain('data-qa-geometry-group="calc-muestra/criterios-radiografia-pasos"');
    expect(cardTags[0]).toContain('data-qa-geometry-contract="intrinsic"');
    // Los cinco pasos siguen en el DOM y en el contrato; solo el activo ocupa
    // layout. Apilarlos visibles costaba 23.244 px por tarjeta.
    const stepTags = startTags(html, "section", "cmv2-crc-step");
    expect(stepTags).toHaveLength(5);
    expect(stepTags.filter((tag) => tag.includes("hidden"))).toHaveLength(4);
    expect((html.match(/data-paso="/g) ?? [])).toHaveLength(5);
    expectOwnedGeometryMembers(stepTags);

    const segmentGroupTags = startTags(html, "div", "cmv2-crc-segments");
    expect(segmentGroupTags).toHaveLength(1);
    expect(segmentGroupTags[0]).toContain('data-qa-geometry-group="calc-muestra/criterios-radiografia-segmentos"');
    expect(segmentGroupTags[0]).toContain('data-qa-geometry-contract="intrinsic"');
    const segmentTags = startTags(html, "article", "cmv2-crc-segment");
    expect(segmentTags).toHaveLength(2);
    expectOwnedGeometryMembers(segmentTags);

    const snapshotGroupTags = startTags(html, "div", "cmv2-crc-snapshot-pair");
    expect(snapshotGroupTags).toHaveLength(2);
    for (const tag of snapshotGroupTags) {
      expect(tag).toContain('data-qa-geometry-group="calc-muestra/criterios-radiografia-snapshots"');
      expect(tag).toContain('data-qa-geometry-contract="intrinsic"');
    }
    const snapshotTags = startTags(html, "div", "cmv2-crc-snapshot");
    expect(snapshotTags).toHaveLength(4);
    expectOwnedGeometryMembers(snapshotTags);
  });

  it("aísla las filas F1 de la facultad sin alterar owner ni estado del gate", () => {
    const medicina = { ...row, faculty_key: "medicina", faculty_label: "Medicina" };
    const entry = { ...numericEntry(), rows: [row, medicina] };
    const card: CriterioRadiografiaCard = {
      cardId: entry.card_id,
      label: entry.label,
      scope: entry.scope,
      kind: entry.kind,
      gateIds: [entry.id],
      source: "catalogo",
      expectedFamily: entry.family,
      state: "v2",
      entries: [entry],
      v1Rows: [],
    };

    const filtered = criterioCardForFaculty(card, "ingenieria", "Ingeniería");
    expect(filtered.entries[0]?.owner).toBe(entry.owner);
    expect(filtered.entries[0]?.status).toBe(entry.status);
    expect(filtered.entries[0]?.rows.map((item) => item.faculty_key)).toEqual(["ingenieria"]);
  });

  it("usa exclusivamente la clave contractual y falla cerrado ante etiquetas coincidentes", () => {
    const sameLabelOtherKey = {
      ...row,
      faculty_key: "ingenieria-duplicada",
      faculty_label: "INGENIERIA",
    };
    const labelFallback = {
      ...row,
      faculty_key: "key-publicada-por-r",
      faculty_label: "Ingeniería",
    };
    const entry = { ...numericEntry(), rows: [row, sameLabelOtherKey] };
    const card: CriterioRadiografiaCard = {
      cardId: entry.card_id,
      label: entry.label,
      scope: entry.scope,
      kind: entry.kind,
      gateIds: [entry.id],
      source: "catalogo",
      expectedFamily: entry.family,
      state: "v2",
      entries: [entry],
      v1Rows: [],
    };

    expect(criterioCardForFaculty(card, "ingenieria", "Ingeniería").entries[0]?.rows)
      .toEqual([row]);
    expect(criterioCardForFaculty(
      { ...card, entries: [{ ...entry, rows: [labelFallback] }] },
      "clave-ui-distinta",
      "INGENIERIA",
    ).entries[0]?.rows).toEqual([]);
    expect(criterioCardForFaculty(
      { ...card, entries: [{ ...entry, rows: [labelFallback, sameLabelOtherKey] }] },
      "clave-ui-distinta",
      "INGENIERIA",
    ).entries[0]?.rows).toEqual([]);
  });

  it("declara que los segmentos jerárquicos solapados no son aditivos", () => {
    const entry = {
      ...numericEntry(),
      id: "teacher_type",
      card_id: "teacher_type",
      label: "Tipo de docente",
      family: "classroom_hierarchical",
      kind: "hierarchical",
      overlap: true,
      rows: [{
        ...row,
        segment_key: "docente",
        segment_label: "Docente",
        segment_kind: "grupo",
        signal_distribution: undefined,
        delta: { ...row.delta, action: "restringir_a_categoria" },
      }],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
    const card: CriterioRadiografiaCard = {
      cardId: "teacher_type",
      label: "Tipo de docente",
      scope: "aula",
      kind: "hierarchical",
      gateIds: ["teacher_type"],
      source: "catalogo",
      expectedFamily: "classroom_hierarchical",
      state: "v2",
      entries: [entry],
      v1Rows: [],
    };

    const html = renderToStaticMarkup(<CriteriosRadiografiaCardDetalle card={card} radiografia={radiografia} />);
    expect(html).toContain("segmentos solapados · no aditivos");
  });

  it("falla cerrado por tarjeta cuando un gate de composición es inválido", () => {
    const validGate = {
      ...numericEntry(),
      id: "c7",
      card_id: "composition",
      label: "Criterio 7",
      family: "proportion_gate",
      owner: "calc_muestra_aulas_criterios_v1",
      kind: "gate",
      rows: [{
        ...row,
        faculty_label: "NO_DEBE_PUBLICARSE_987",
        signal_distribution: { ...row.signal_distribution!, unit: "proporcion" },
        delta: { ...row.delta, action: "activar" },
      }],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
    const invalidGate = {
      ...validGate,
      id: "c8_facultad",
      label: "Criterio 8 por facultad",
      status: "invalido",
      rows: [],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
    const noDataGate = {
      ...validGate,
      id: "c8",
      label: "Criterio 8",
      status: "no_aplica",
      rows: [],
    } as CalcMuestraAulasCriterioRadiografiaV2Entry;
    const card: CriterioRadiografiaCard = {
      cardId: "composition",
      label: "Composición del curso-horario",
      scope: "aula",
      kind: "gate",
      gateIds: ["c7", "c8_facultad", "c8"],
      source: "extra",
      expectedFamily: "proportion_gate",
      state: "invalido",
      entries: [validGate, invalidGate, noDataGate],
      v1Rows: [],
      issue: "El engine publicó una fila o metadato inválido.",
    };

    const html = renderToStaticMarkup(<CriteriosRadiografiaCardDetalle card={card} radiografia={radiografia} />);
    expect(html).toContain("El engine publicó una fila o metadato inválido.");
    expect(html).toContain("Impacto retenido");
    expect(html).toContain("Acción bloqueada");
    expect(html).not.toContain("NO_DEBE_PUBLICARSE_987");
    expect(html).not.toContain("Contrafactual reconstruido");
  });
});
