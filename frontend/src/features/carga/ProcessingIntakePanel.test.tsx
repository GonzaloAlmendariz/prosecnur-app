import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./ProcessingIntakePanel.tsx", import.meta.url)),
  "utf8",
);

function openingTagBefore(label: string, tag = "button"): string {
  const labelIndex = source.indexOf(label);
  expect(labelIndex, `No se encontró el texto visible «${label}»`).toBeGreaterThan(-1);
  const openingIndex = source.lastIndexOf(`<${tag}`, labelIndex);
  expect(openingIndex, `No se encontró <${tag}> para «${label}»`).toBeGreaterThan(-1);
  // El fragmento llega hasta la etiqueta visible: así no confundimos el `=>`
  // de un handler JSX con el cierre real del tag de apertura.
  return source.slice(openingIndex, labelIndex);
}

function expectDescribedByTarget(openingTag: string) {
  const literal = openingTag.match(/aria-describedby="([^"]+)"/u)?.[1];
  if (literal) {
    expect(source).toContain(`id="${literal}"`);
    return;
  }

  const expression = openingTag.match(/aria-describedby=\{([^}]+)\}/u)?.[1]?.trim();
  expect(expression, "El control bloqueable debe declarar aria-describedby").toBeTruthy();
  expect(source).toContain(`id={${expression}}`);
}

describe("contrato accesible del plan multiactor", () => {
  it("presenta el propósito como un heading real y en lenguaje de tarea", () => {
    expect(source).toMatch(
      /<h[1-6][^>]*>\s*Asignar un formulario a cada público\s*<\/h[1-6]>/u,
    );
  });

  it("nombra con claridad las sugerencias y explica por qué puede bloquearse la coincidencia segura", () => {
    expect(source).toContain(
      'aria-label={`Agregar público ${suggestion.actor} desde Monitoreo`}',
    );

    const guidedButton = openingTagBefore("Completar con coincidencias seguras");
    expectDescribedByTarget(guidedButton);
    expect(source).toMatch(/Monitoreo identifique (?:al menos un |)público/iu);
    expect(source).toMatch(/No hay revisiones publicadas/iu);
  });

  it("ofrece abrir el Editor desde la guía cuando aún no hay formularios publicados", () => {
    const guidedStart = source.indexOf(
      '<div className="pulso-processing-intake-guided"',
    );
    const guidedEnd = source.indexOf("{guidedPlan &&", guidedStart);
    expect(guidedStart).toBeGreaterThan(-1);
    expect(guidedEnd).toBeGreaterThan(guidedStart);
    const guidedBlock = source.slice(guidedStart, guidedEnd);

    expect(guidedBlock).toContain("revisions.length === 0");
    expect(guidedBlock).toContain('<Link to="/editor-xlsform"');
    expect(guidedBlock).toMatch(/(?:Abrir|Publicar)[^<]*Editor/iu);
    expect(source).toMatch(/Si el instrumento ya existe[^.]*confirma su lógica[^.]*publícalo/iu);
  });

  it("expone cada asignación como grupo nombrado y marca sus tres datos obligatorios", () => {
    expect(source).toContain("<fieldset");
    expect(source).toContain("<legend");
    expect(source.match(/\brequired(?:=|\s|>)/gu) ?? []).toHaveLength(3);
  });

  it("mueve el foco al primer campo del público agregado", () => {
    expect(source).toContain('setPendingFocus({ kind: "actor", key: entryId })');
    expect(source).toContain("actorInputRefs.current.set(entry.entry_id, node)");
    expect(source).toContain("actorInputRefs.current.get(pendingFocus.key)");
    expect(source).toContain("target.focus()");
  });
});

describe("estado visible del plan ya materializado", () => {
  it("reconoce el plan completo desde entradas persistidas y públicos sugeridos", () => {
    expect(source).toContain("processingIntakePlanComplete");
    expect(source).toMatch(
      /const\s+planComplete\s*=\s*processingIntakePlanComplete\(\s*payload\?\.intake\.entries\s*\?\?\s*\[\],\s*suggestions,?\s*\)/u,
    );
  });

  it("sustituye la guía y su CTA por un cierre inequívoco cuando las bases ya existen", () => {
    expect(source).toMatch(/Bases e instrumentos listos/iu);
    expect(source).toMatch(/Plan completo/iu);
    expect(source).toMatch(/las bases ya (?:fueron|están) creadas/iu);

    const guideStart = source.indexOf(
      '<div className="pulso-processing-intake-guided"',
    );
    expect(guideStart).toBeGreaterThan(-1);
    const incompleteGuard = source.lastIndexOf("{!planComplete && (", guideStart);
    expect(
      incompleteGuard,
      "La guía y «Completar con coincidencias seguras» deben renderizarse solo si falta completar el plan",
    ).toBeGreaterThan(-1);
  });
});
