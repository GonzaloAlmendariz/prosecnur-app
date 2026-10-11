import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CargaReviewSummary } from "./CargaReviewSummary";

const pageSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
const styleSource = fs.readFileSync(
  fileURLToPath(new URL("./carga-v2.css", import.meta.url)),
  "utf8",
);
const findingsStyleSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaReviewSummary.css", import.meta.url)),
  "utf8",
);

function reviewCheck(html: string, label: "Instrumento" | "Respuestas") {
  const item = html
    .match(/<li\b[\s\S]*?<\/li>/gu)
    ?.find((candidate) => candidate.includes(`<strong>${label}</strong>`));

  expect(item, `No se encontró la comprobación «${label}»`).toBeTruthy();
  return item ?? "";
}

function singleReviewBranch(source: string) {
  const start = source.lastIndexOf('activeCargaTab === "revision"');
  const end = source.lastIndexOf('activeCargaTab === "estructura"');

  expect(start, "No se encontró la rama single de Revisión").toBeGreaterThan(-1);
  expect(end, "No se encontró el límite de la rama single de Revisión").toBeGreaterThan(start);
  return source.slice(start, end);
}

function multiReviewBranch(source: string) {
  const workbench = source.indexOf('ariaLabel="Mesa de trabajo de varias bases"');
  const start = source.indexOf('activeCargaTab === "revision"', workbench);
  const end = source.indexOf('activeCargaTab === "estructura"', start);

  expect(workbench, "No se encontró la mesa multibase").toBeGreaterThan(-1);
  expect(start, "No se encontró la rama multibase de Revisión").toBeGreaterThan(workbench);
  expect(end, "No se encontró el límite de Revisión multibase").toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("superficie de Revisión en Carga", () => {
  it("expone cobertura parcial multibase sin marcar instrumento ni respuestas como listos", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        pendingChoiceMapping={false}
        extraVariableCount={0}
        allReady={false}
        isMultiBase
        bases={4}
        instrumentBaseCount={1}
        dataBaseCount={1}
      />,
    );

    const instrument = reviewCheck(html, "Instrumento");
    const responses = reviewCheck(html, "Respuestas");

    expect(instrument).toMatch(/1\s*(?:de|\/)\s*4/u);
    expect(responses).toMatch(/1\s*(?:de|\/)\s*4/u);
    expect(instrument).not.toContain('class="is-ready"');
    expect(responses).not.toContain('class="is-ready"');
  });

  it("ofrece el filtro de universo en single siempre que haya datos confirmados", () => {
    const reviewSource = singleReviewBranch(pageSource);

    expect(reviewSource).toMatch(
      /\{\s*hasData\s*&&\s*!pendingChoiceMapping\s*&&\s*\([\s\S]*?<CargaUniverseFilter/u,
    );
    expect(reviewSource).not.toMatch(
      /sourceMode\s*!==\s*"monitoring"[\s\S]*?<CargaUniverseFilter/u,
    );
  });

  it("permite reabrir un mapeo pendiente también en un estudio de base única", () => {
    const reviewSource = singleReviewBranch(pageSource);

    expect(reviewSource).toMatch(/choice_mapping\.pending[\s\S]*?Revisar mapeo/iu);
    expect(reviewSource).toContain("cargaReview.choice_mapping.maps");
  });

  it("impide que el resumen se encoja y oculte hallazgos en escritorios bajos", () => {
    expect(styleSource).toMatch(
      /@media \(max-height: 720px\)[\s\S]*?\.pulso-carga-frame \.pulso-carga-review-summary[\s\S]*?min-height: max-content/u,
    );
  });

  it("muestra la base revisada, la incompatibilidad y los extras pendientes sin ofrecer continuar", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        pendingChoiceMapping={false}
        extraVariableCount={1}
        allReady
        isMultiBase
        bases={2}
        instrumentBaseCount={2}
        dataBaseCount={2}
        review={{
          ok: true,
          base_nombre: "Base A",
          compatibility: {
            applied: true,
            ok: false,
            status: "incompatible",
            missing_columns: ["pregunta_obligatoria"],
            extra_columns: ["auxiliar"],
            matched_columns: 8,
            expected_columns: 9,
            n_missing: 1,
            n_extra: 1,
            message: "Falta una variable requerida.",
          },
          choice_mapping: {
            status: "confirmed",
            pending: false,
            applied: false,
            requires_confirmation: false,
            n_questions: 0,
            maps: [],
          },
          reconciliation: {
            extra: [{
              name: "auxiliar",
              fill_pct: 25,
              n_fill: 3,
              kind: "con_datos",
              incluida: false,
              decision: "pending",
            }],
            n_extra: 1,
            n_incluidas: 0,
            n_excluidas: 0,
            n_pendientes: 1,
            reviewed: false,
          },
          procedencia: null,
          orden_editor: null,
          fuentes: null,
          ready: false,
        }}
        action={<a href="/validacion">Ir a Validación</a>}
      />,
    );

    expect(html).toContain("Base A");
    expect(html).toMatch(/Incompatible con el formulario/iu);
    expect(html).toMatch(/1\s+(?:extra\s+)?pendiente/iu);
    expect(html).not.toContain("Ir a Validación");
  });

  it("recarga y guarda la revisión con la base elegida por el selector multibase", () => {
    const reviewSource = multiReviewBranch(pageSource);

    expect(reviewSource).toMatch(/Base revisada[\s\S]*?<select[\s\S]*?value=\{selectedCargaBase\}/u);
    expect(reviewSource).toMatch(/<CargaReviewSummary[\s\S]*?review=\{cargaReview\}/u);
    expect(pageSource).toContain("apiCargaReview(selectedCargaBase)");
    expect(pageSource).toContain("apiCargaReviewReconciliation(selectedCargaBase, incluidas)");
    expect(pageSource).toContain("apiCargaReviewSummary()");
    expect(reviewSource).toMatch(/reviewSummary=\{cargaReviewSummary\}/u);
    expect(reviewSource).toMatch(/action=\{cargaReviewSummary\?\.all_ready[\s\S]*?<ContinuarCTA/u);
    expect(pageSource).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?apiCargaReview\(selectedCargaBase\)[\s\S]*?\}, \[[^\]]*selectedCargaBase[^\]]*\]\);/u,
    );
  });

  it("usa el resumen agregado para bloquear o habilitar el CTA multibase", () => {
    const selectedReady = {
      ok: true as const,
      base_nombre: "A",
      compatibility: {
        applied: true,
        ok: true,
        status: "compatible",
        missing_columns: [],
        extra_columns: [],
        matched_columns: 8,
        expected_columns: 8,
        n_missing: 0,
        n_extra: 0,
        message: "Compatible.",
      },
      choice_mapping: {
        status: "not_required",
        pending: false,
        applied: false,
        requires_confirmation: false,
        n_questions: 0,
        maps: [],
      },
      reconciliation: {
        extra: [],
        n_extra: 0,
        n_incluidas: 0,
        n_excluidas: 0,
        n_pendientes: 0,
        reviewed: true,
      },
      procedencia: null,
      orden_editor: null,
      fuentes: null,
      ready: true,
    };
    const common = {
      pendingChoiceMapping: false,
      extraVariableCount: 0,
      allReady: true,
      isMultiBase: true,
      bases: 2,
      instrumentBaseCount: 2,
      dataBaseCount: 2,
      review: selectedReady,
      action: <a href="/validacion">Ir a Validación</a>,
    };

    const partial = renderToStaticMarkup(
      <CargaReviewSummary
        {...common}
        reviewSummary={{
          bases: [
            { base_nombre: "A", ready: true, blockers: [] },
            { base_nombre: "B", ready: false, blockers: ["compatibility"] },
          ],
          n_bases: 2,
          n_ready: 1,
          n_blocked: 1,
          all_ready: false,
        }}
      />,
    );
    const complete = renderToStaticMarkup(
      <CargaReviewSummary
        {...common}
        reviewSummary={{
          bases: [
            { base_nombre: "A", ready: true, blockers: [] },
            { base_nombre: "B", ready: true, blockers: [] },
          ],
          n_bases: 2,
          n_ready: 2,
          n_blocked: 0,
          all_ready: true,
        }}
      />,
    );

    expect(partial).toContain("1/2 bases sin bloqueos");
    expect(partial).not.toContain("Ir a Validación");
    expect(complete).toContain("2/2 bases sin bloqueos");
    expect(complete).toContain("Ir a Validación");

    const aggregateWinsOverStaleLocalGate = renderToStaticMarkup(
      <CargaReviewSummary
        {...common}
        allReady={false}
        reviewSummary={{
          bases: [
            { base_nombre: "A", ready: true, blockers: [] },
            { base_nombre: "B", ready: true, blockers: [] },
          ],
          n_bases: 2,
          n_ready: 2,
          n_blocked: 0,
          all_ready: true,
        }}
      />,
    );
    expect(aggregateWinsOverStaleLocalGate).toContain("Ir a Validación");
  });

  it("reabre el mapeo pendiente del payload y confirma esa misma base", () => {
    const reviewSource = multiReviewBranch(pageSource);

    expect(reviewSource).toMatch(/choice_mapping\.pending[\s\S]*?Revisar mapeo/iu);
    expect(pageSource).toContain("cargaReview.choice_mapping.maps");
    expect(pageSource).toContain("apiCargaConfirmChoiceMapping(selectedCargaBase)");
  });
});

describe("CargaReviewSummary · aviso de procedencia (GOAL validación extrínseca, L11)", () => {
  const baseProps = {
    pendingChoiceMapping: false,
    extraVariableCount: 0,
    allReady: true,
    isMultiBase: false,
    bases: 1,
    instrumentBaseCount: 1,
    dataBaseCount: 1,
  };
  const reviewLimpio = {
    ok: true as const,
    base_nombre: "base_1",
    compatibility: {
      applied: true, ok: true, status: "ok", missing_columns: [], extra_columns: [],
      matched_columns: 10, expected_columns: 10, n_missing: 0, n_extra: 0, message: "",
    },
    choice_mapping: {
      status: "confirmed", pending: false, applied: true,
      requires_confirmation: false, n_questions: 0, maps: [],
    },
    reconciliation: { extra: [], reviewed: true, n_extra: 0, n_incluidas: 0, n_excluidas: 0, n_pendientes: 0 },
    procedencia: null,
    orden_editor: null,
    fuentes: null,
    ready: true,
  };

  it("no dice nada cuando la base viene de una sola versión", () => {
    // Control: sin esto, el aviso siempre visible no distinguiría una base sana.
    const html = renderToStaticMarkup(
      <CargaReviewSummary {...baseProps} review={reviewLimpio} />,
    );
    expect(html).not.toContain("versiones del formulario");
  });

  it("avisa en Carga cuando la base trae dos versiones, sin bloquear el avance", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{
          ...reviewLimpio,
          procedencia: {
            columna: "__version__",
            n_versiones: 2,
            n_casos_afectados: 6,
            n_casos: 104,
            version_vigente: "vNueva",
            mensaje: "6 de 104 casos se recolectaron con una versión anterior del formulario.",
          },
        }}
      />,
    );
    expect(html).toContain("Se recolectó con 2 versiones del formulario");
    expect(html).toContain("6 de 104 casos");
    // El aviso convive con el estado listo: advierte sobre cómo se recolectó,
    // no impide cargar.
    expect(html).toContain("Sin bloqueos");
  });

  it("declara las preguntas que no siguieron el orden del editor, sin bloquear", () => {
    const limpio = renderToStaticMarkup(<CargaReviewSummary {...baseProps} review={reviewLimpio} />);
    expect(limpio).not.toContain("orden de opciones del editor");
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{
          ...reviewLimpio,
          orden_editor: {
            adoptadas: ["p2"],
            omitidas: [{ variable: "p1", motivo: "las etiquetas del mapa no calzan con las opciones de la encuesta" }],
          },
        }}
      />,
    );
    expect(html).toContain("1 pregunta no sigue el orden de opciones del editor");
    expect(html).toContain("p1: las etiquetas del mapa no calzan");
    expect(html).toContain("1 pregunta usa el orden de opciones del editor");
    expect(html).toContain("Sin bloqueos");
  });
});

describe("CargaReviewSummary · fuentes emparejadas por pregunta (ADR 0094)", () => {
  const baseProps = {
    pendingChoiceMapping: false,
    extraVariableCount: 0,
    allReady: true,
    isMultiBase: false,
    bases: 1,
    instrumentBaseCount: 1,
    dataBaseCount: 1,
  };
  const reviewLimpio = {
    ok: true as const,
    base_nombre: "egresados",
    compatibility: {
      applied: true, ok: true, status: "ok", missing_columns: [], extra_columns: [],
      matched_columns: 74, expected_columns: 74, n_missing: 0, n_extra: 0, message: "",
    },
    choice_mapping: {
      status: "confirmed", pending: false, applied: true,
      requires_confirmation: false, n_questions: 0, maps: [],
    },
    reconciliation: { extra: [], reviewed: true, n_extra: 0, n_incluidas: 0, n_excluidas: 0, n_pendientes: 0 },
    procedencia: null,
    orden_editor: null,
    fuentes: null,
    ready: true,
  };
  const fuente = {
    survey_id: "s2",
    titulo: "Telefónico",
    n_emparejadas: 73,
    n_preguntas_base: 74,
    reordenada: false,
    instrumento_distinto: false,
    sin_par_fuente: [],
    sin_par_base: [],
    n_opciones_sin_par: 0,
    excluida: false,
    n_filas_excluidas: 0,
  };
  const items = (html: string) => html.match(/<li\b[\s\S]*?<\/li>/gu) ?? [];
  const finding = (html: string, text: string) => items(html).find((item) => item.includes(text)) ?? "";

  it("una fuente solo reordenada es un dato neutro y no altera el estado listo", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{ ...reviewLimpio, fuentes: { fuentes: [{ ...fuente, reordenada: true }] } }}
      />,
    );
    const item = finding(html, "en otro orden");
    expect(item).toContain('class="is-info"');
    expect(item).toContain("Telefónico · 73 de 74 preguntas emparejadas, en otro orden");
    expect(html).toContain('data-qa-geometry-group="carga-review-findings"');
    expect(html).toContain("Sin bloqueos");
  });

  it("una fuente con preguntas sin par avisa, nombra las primeras y no bloquea", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{
          ...reviewLimpio,
          fuentes: {
            fuentes: [{
              ...fuente,
              sin_par_fuente: ["Cod Pulso", "Celular del egresado", "Enumerador", "DNI"]
                .map((etiqueta, i) => ({ variable: `q${i}`, etiqueta })),
              sin_par_base: [{ variable: "p7", etiqueta: "Edad" }],
            }],
          },
        }}
      />,
    );
    const item = finding(html, "No entraron");
    expect(item).toContain('class="is-pending"');
    expect(item).toContain("Telefónico · 73 de 74 preguntas emparejadas");
    expect(item).toContain("Sin respuesta en esta fuente: Edad");
    expect(item).toContain("No entraron: Cod Pulso, Celular del egresado, Enumerador +1");
    expect(item).not.toMatch(/survey_id|firma|ordinal/u);
    expect(html).toContain("Sin bloqueos");
  });

  it("instrumento distinto se pinta como incompatibilidad y dice qué hacer", () => {
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{
          ...reviewLimpio,
          fuentes: { fuentes: [{ ...fuente, instrumento_distinto: true, excluida: true, n_emparejadas: 30, n_filas_excluidas: 48 }] },
        }}
      />,
    );
    const item = finding(html, "no entró a la base");
    expect(item).toContain('class="is-incompatible"');
    expect(item).toContain("Telefónico · no entró a la base");
    expect(item).toContain("Solo coinciden 30 de 74 preguntas con la base. 48 respuestas quedaron fuera.");
    expect(item).toContain("Impórtala como base separada y relaciónala en Equivalencias.");
    // No bloquea, pero el encabezado no dice «sin bloqueos» junto a una fuente fuera.
    expect(html).toContain("Una fuente no entró a la base");
    expect(html).toContain("Una fuente quedó fuera");
    expect(html).not.toContain("Sin bloqueos");
  });

  it("el orden del editor adoptado es neutro, va después de los avisos y acota la lista", () => {
    const adoptadas = Array.from({ length: 11 }, (_, i) => `p${i + 1}`);
    const html = renderToStaticMarkup(
      <CargaReviewSummary
        {...baseProps}
        review={{
          ...reviewLimpio,
          orden_editor: { adoptadas, omitidas: [{ variable: "p20", motivo: "la etiqueta no calza" }] },
        }}
      />,
    );
    const adoptado = finding(html, "usan el orden de opciones del editor");
    expect(adoptado).toContain('class="is-info"');
    expect(adoptado).not.toContain("is-pending");
    expect(adoptado).toContain("p1, p2, p3, p4, p5, p6, p7, p8 +3");
    const omitida = finding(html, "no sigue el orden de opciones del editor");
    expect(omitida).toContain('class="is-pending"');
    expect(html.indexOf("no sigue el orden")).toBeLessThan(html.indexOf("usan el orden"));
  });

  it("el dato neutro usa tokens neutros y el aviso sigue con los de advertencia", () => {
    const info = findingsStyleSource.match(/\.pulso-carga-review-findings li\.is-info \{([^}]*)\}/u)?.[1] ?? "";
    expect(info).toMatch(/border-color: var\(--pulso-border\)/u);
    expect(info).not.toMatch(/--pulso-warn-|#[0-9a-f]{3,8}\b/iu);
    const base = styleSource.match(/\.pulso-carga-review-findings li \{([^}]*)\}/u)?.[1] ?? "";
    expect(base).toMatch(/--pulso-warn-bg/u);
    expect(styleSource).not.toMatch(/\.pulso-carga-review-findings li\.is-pending \{/u);
  });
});
