import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./AcreditacionBatchPanel.tsx", import.meta.url)),
  "utf8",
);

function createBasesButtonOpeningTag(): string {
  const labelIndex = source.indexOf("Crear todas las bases");
  expect(labelIndex).toBeGreaterThan(-1);
  const openingIndex = source.lastIndexOf("<button", labelIndex);
  expect(openingIndex).toBeGreaterThan(-1);
  // El fragmento llega hasta la etiqueta visible: así no confundimos el `=>`
  // de un handler JSX con el cierre real del tag de apertura.
  return source.slice(openingIndex, labelIndex);
}

describe("contrato accesible del lote multiactor", () => {
  it("no ejecuta preview-batch hasta una segunda acción explícita", () => {
    expect(source).not.toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,1200}apiCargaAcreditacionBatchPreview\(/u,
    );
    expect(source).toMatch(/Revisar (?:el )?corte|Preparar revisión/iu);
  });

  it("presenta el corte efectivo como un heading real", () => {
    expect(source).toMatch(
      /<h[1-6][^>]*>\s*Crear bases con las encuestas efectivas\s*<\/h[1-6]>/u,
    );
  });

  it("explica en lenguaje directo que faltan formularios y ofrece completar las asignaciones", () => {
    expect(source).toContain("Falta asignar un formulario publicado a uno o más públicos");
    expect(source).toContain("Cada público detectado en Monitoreo debe quedar vinculado con una única revisión publicada.");
    expect(source).toContain("Asignar formularios");
    expect(source).toContain('href="#processing-intake-plan"');
  });

  it("asocia el motivo del bloqueo con el botón que crea las bases", () => {
    const openingTag = createBasesButtonOpeningTag();
    const literal = openingTag.match(/aria-describedby="([^"]+)"/u)?.[1];
    const expression = openingTag.match(/aria-describedby=\{([^}]+)\}/u)?.[1]?.trim();

    expect(literal || expression, "Crear todas las bases debe explicar su bloqueo").toBeTruthy();
    if (literal) expect(source).toContain(`id="${literal}"`);
    if (expression) expect(source).toContain(`id={${expression}}`);
  });
});
