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
    reconciliation: { extra: [], n_extra: 0, n_incluidas: 0, n_excluidas: 0, n_pendientes: 0 },
    procedencia: null,
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
});
