import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultModoSoForQuickAdopt, IncluirEnCodificacion, modoSoOptionsForDisplay } from "./PreguntasLanding";
import { pregunta } from "./preguntas/unidadesDePrueba";

describe("PreguntasLanding quick adopt mode", () => {
  test("integrates select_one other text by default", () => {
    expect(defaultModoSoForQuickAdopt("select_one")).toBe("padre");
  });

  test("keeps select_multiple without SO mode", () => {
    expect(defaultModoSoForQuickAdopt("select_multiple")).toBeUndefined();
  });

  test("names the parent mode as codifying the original question", () => {
    const options = modoSoOptionsForDisplay("p10_mexico", "p10_mexico_other");
    expect(options[0]).toMatchObject({
      value: "padre",
      label: "Codificar pregunta original",
    });
    expect(options[1]).toMatchObject({
      value: "hijo",
      label: "Codificar texto aparte",
    });
  });
});

// Etapa P3a del rediseño de Procesamiento: la pestaña es una lista de unidades con inspector, y este
// archivo solo compone. Las piezas, el modelo y la hoja viven en `preguntas/`.
describe("PreguntasLanding compone la lista de unidades y el inspector", () => {
  const fuente = fs.readFileSync(fileURLToPath(new URL("./PreguntasLanding.tsx", import.meta.url)), "utf8");

  test("monta la barra, la lista y el inspector dentro del arrastre", () => {
    for (const pieza of ["<DndContext", "<BarraPreguntas", "<ListaUnidades", "<InspectorUnidad", "<DragOverlay"]) {
      expect(fuente, pieza).toContain(pieza);
    }
  });

  test("no vuelve a las tarjetas por sección plegable", () => {
    expect(fuente).not.toMatch(/aria-expanded|<details|collapsed|pulso-codificacion-question/);
  });

  test("la selección no se escribe en la URL", () => {
    expect(fuente).not.toMatch(/useSearchParams|useNavigate|usePanelDireccionable/);
  });

  test("sigue delgado: lo nuevo va en preguntas/, un componente por archivo", () => {
    expect(fuente.split("\n").length).toBeLessThan(300);
    expect(fuente).not.toMatch(/useDraggable|useDroppable/);
  });
});

describe("incluir en codificación y la decisión de no codificar", () => {
  const nada = () => undefined;
  const pinta = (extra: Parameters<typeof pregunta>[2]) =>
    renderToStaticMarkup(createElement(IncluirEnCodificacion, { p: pregunta("p9", "text", extra), busy: false, onIncluir: nada, onNoCategorizar: nada }));

  test("una pregunta incluida y pendiente lleva el interruptor y, debajo, cómo registrar que no se codifica", () => {
    const html = pinta({ marcada: true, status: "en-curso" });
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Registrar que no se codifica");
  });

  test("con la decisión registrada el interruptor no se muestra: queda el motivo y cómo volver atrás", () => {
    const html = pinta({ marcada: true, no_categorizar: { motivo: "Dato personal", decidido_en: "2026-11-10" } });
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Incluir en codificación");
    expect(html).toContain("Motivo registrado: Dato personal");
    expect(html).toContain("Volver a pendiente");
  });

  test("una pareja lleva el interruptor encendido y fijo, con su causa", () => {
    const html = pinta({ marcada: true, marcada_auto: true, status: "en-curso" });
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*disabled=""/);
    expect(html).toContain("Se incluye mientras esté emparejada.");
  });

  test("sin incluir no se ofrece registrar nada", () => {
    expect(pinta({ marcada: false })).not.toContain("Registrar que no se codifica");
  });
});
