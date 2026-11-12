import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);
const revisionSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/PestanaRevision.tsx", import.meta.url)),
  "utf8",
);
// P4b R4: Revisión es una sola mesa para una y varias bases (pestanas/revision/MesaDeRevision.tsx).
const mesaRevisionSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/revision/MesaDeRevision.tsx", import.meta.url)),
  "utf8",
);
const marcoKitSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/revision/marcoDeMesa.css", import.meta.url)),
  "utf8",
);
const mesaSource = fs.readFileSync(
  fileURLToPath(new URL("./pestanas/MesaDeCarga.tsx", import.meta.url)),
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
const fuentesFindingsSource = fs.readFileSync(
  fileURLToPath(new URL("./CargaReviewFuentesFindings.tsx", import.meta.url)),
  "utf8",
);
const verPreguntasSource = fs.readFileSync(
  fileURLToPath(new URL("./VerPreguntasFuenteBoton.tsx", import.meta.url)),
  "utf8",
);

describe("superficie de Revisión en Carga", () => {
  it("ofrece el filtro de universo en single siempre que haya datos confirmados", () => {
    expect(revisionSource).toMatch(/conDeclaraciones=\{varias \? Boolean\(baseElegida\) : tieneRespuestas && !mapeoPendiente\}/u);
    expect(mesaRevisionSource).toMatch(/\{conDeclaraciones \?[\s\S]*?<CargaUniverseFilter/u);
    expect(mesaRevisionSource).not.toMatch(/sourceMode\s*!==\s*"monitoring"/u);
  });

  it("permite reabrir un mapeo pendiente también en un estudio de base única", () => {
    // Una sola composición: el botón vive en la decisión de "Códigos de las opciones".
    expect(mesaRevisionSource).toMatch(/choice_mapping\.pending[\s\S]*?Revisar mapeo/iu);
    expect(mesaRevisionSource).toContain("revision.choice_mapping.maps");
    expect(mesaRevisionSource).not.toMatch(/if \(varias\)/u);
  });

  it("reabre el mapeo pendiente del payload y confirma esa misma base", () => {
    expect(mesaRevisionSource).toMatch(/choice_mapping\.pending[\s\S]*?Revisar mapeo/iu);
    expect(mesaRevisionSource).toContain("revision.choice_mapping.maps");
    expect(pageSource).toContain("apiCargaConfirmChoiceMapping(selectedCargaBase)");
  });

  it("el dato neutro usa tokens neutros y el aviso sigue con los de advertencia", () => {
    const info = findingsStyleSource.match(/\.pulso-carga-review-findings li\.is-info \{([^}]*)\}/u)?.[1] ?? "";
    expect(info).toMatch(/border-color: var\(--pulso-border\)/u);
    expect(info).not.toMatch(/--pulso-warn-|#[0-9a-f]{3,8}\b/iu);
    const base = styleSource.match(/\.pulso-carga-review-findings li \{([^}]*)\}/u)?.[1] ?? "";
    expect(base).toMatch(/--pulso-warn-bg/u);
    expect(styleSource).not.toMatch(/\.pulso-carga-review-findings li\.is-pending \{/u);
  });

  it('"Ver preguntas" abre la fuente de su base: el foco de la dirección la lleva', () => {
    expect(fuentesFindingsSource).toMatch(/baseNombre=\{baseNombre\}/u);
    expect(verPreguntasSource).toMatch(/searchConEmparejamiento\(location\.search, props\.surveyId, props\.baseNombre\)/u);
  });

  it("el selector de Revisión es el común de Carga, con las bases primarias", () => {
    // SelectorDeBaseCarga: PulsoField "Base" con el select del kit, solo con dos o más bases.
    expect(mesaRevisionSource).toMatch(/<SelectorDeBaseCarga bases=\{basesPrimarias\}/u);
  });

  it("C3/C4: Revisión conserva el alto de la ventana y cada contenedor desplaza su cuerpo, también en escritorio bajo", () => {
    expect(mesaSource).toMatch(/PESTANAS_CON_MESA_DEL_KIT[^\n]*"revision"/u);
    expect(marcoKitSource).toMatch(
      /:root \.pulso-carga-frame\.pulso-page-frame--scroll-panels \.pulso-page-frame-body > \.pulso-carga-workbench\.pulso-carga-workbench--kit \{[^}]*height: 100%;/u,
    );
  });

  it("la readiness de Revisión espera a la lectura de la base elegida y se escribe en false", () => {
    // Tras Revisión puede venir otra pestaña que también espera (Variables, ADR 0142).
    expect(pageSource).toMatch(/activeCargaTab === "revision" && !revisionEstado\.completa\)(?:\s*\|\| \([^)]*\))*\s*\?\s*"false"/u);
    expect(pageSource).toMatch(/revisionLeyendo: clavePedida === "revision" && !revisionEstado\.datosLeidos/u);
    expect(pageSource).toMatch(/leyendo=\{!revisionEstado\.datosLeidos\}/u);
  });
});
