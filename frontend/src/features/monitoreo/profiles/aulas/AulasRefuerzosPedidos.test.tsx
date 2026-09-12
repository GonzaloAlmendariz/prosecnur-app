import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasRefuerzosPedidos } from "./AulasRefuerzosPedidos";

/**
 * **La superficie donde viven las marcadas.** Existe porque marcar era un acto
 * sin vuelta: la fila salía del reparto —deja de ser candidata— y no aparecía
 * en ninguna otra parte, así que no había forma de saber si la gestión avanzó.
 *
 * El test mira el MARKUP y no el helper: el helper ya tiene el suyo, y lo que
 * aquí puede romperse es que el panel no pinte lo que el helper sabe.
 */

const fila = (p: Record<string, unknown>) => ({
  operational_code: "R 1.1", faculty: "DERECHO", teacher: "Ana Docente",
  sample_status: "refuerzo_por_contactar", operational_status: "planificada",
  activation_origin: "refuerzo", activated_for: "DERECHO",
  respuestas_validas: 0, ...p,
} as unknown as MonitoreoAulasPlanRow);

const pinta = (filas: MonitoreoAulasPlanRow[]) =>
  renderToStaticMarkup(<AulasRefuerzosPedidos plan={filas} />);

describe("Refuerzos pedidos", () => {
  it("sin nada marcado dice dónde aparecerá lo que se marque, no un vacío mudo", () => {
    // «Nada marcado» es un plan SIN refuerzos, no una fila con el estado especial
    // y sin sello: ésa es justo la que vuelve del Sheets, y desde el 2026-09-12
    // cuenta como pedida. Antes esta fixture pasaba por vacía por accidente.
    const html = pinta([fila({ sample_status: "sin_contactar", activation_origin: "" })]);
    expect(html).toContain("Todavía no has marcado ningún refuerzo");
  });

  it("dibuja los cuatro escalones aunque tres estén en cero", () => {
    // Un paso vacío es un dato —nadie ha llamado todavía— y esconderlo haría
    // parecer que la cola empieza más adelante de donde empieza.
    const html = pinta([fila({})]);
    for (const rótulo of ["espera llamada", "en contacto", "con fecha", "aplicado"]) {
      expect(html).toContain(rótulo);
    }
    expect(html).toContain("es-vacio");
  });

  it("dice cuántas avanzaron y cuántas siguen esperando, sobre su base", () => {
    const html = pinta([
      fila({ operational_code: "R 1.1" }),
      fila({ operational_code: "R 2.2", sample_status: "agendada" }),
      fila({ operational_code: "R 3.3", sample_status: "agendada", respuestas_validas: 11 }),
    ]);
    expect(html).toContain("La app pidió <strong>3</strong>");
    expect(html).toContain("<strong>2</strong> ya");
    expect(html).toContain("<strong>1</strong> sigue en manos del agendador");
  });

  it("el que ya trajo respuestas se pinta como aplicado aunque su casilla diga otra cosa", () => {
    // V4: el hecho antes que el verbo. El estado de muestra lo teclea una
    // persona y llega tarde.
    const html = pinta([fila({ sample_status: "refuerzo_por_contactar", respuestas_validas: 9 })]);
    expect(html).toContain("aulas-pedidos-paso es-aplicado");
    expect(html).toContain("<b>9</b> respuestas");
  });

  it("distingue el complemento (B) del refuerzo (C) al decir a quién ayuda", () => {
    const html = pinta([
      fila({ operational_code: "R 1.1", activation_origin: "complemento", activated_for: "CH 42" }),
    ]);
    expect(html).toContain("complementa");
    expect(html).toContain("CH 42");
  });
});
