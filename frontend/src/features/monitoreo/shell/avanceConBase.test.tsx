// L20 de Meta B: la insignia de Avance era «106 %» suelto. Toda cifra de avance
// se lee con su base: a la vista cuando cabe y siempre en el tooltip y en el
// nombre accesible, que es lo que queda cuando la banda angosta esconde la
// cápsula.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonitoreoModuleChrome } from "./MonitoreoModuleChrome";
import { MONITOREO_MODOS } from "../core/monitoreoRegistry";
import { nombreDeLaPildora, normalizarMetrica, tituloDeLaPildora } from "./metricaDeSeccion";
import { insigniasDelModo } from "../profiles/telefonico/navegacion/barraTelefonica";

const ruta = MONITOREO_MODOS.find((m) => m.family === "telefonico")!;

const render = (viewMetrics: Record<string, unknown>) =>
  renderToStaticMarkup(
    <MonitoreoModuleChrome
      routes={[ruta]}
      route={ruta}
      routeSelected
      seccionActiva="avance"
      sourceTotal={1}
      activeSources={1}
      nRows={0}
      hasSnapshot
      saving={false}
      syncedAt=""
      viewMetrics={viewMetrics}
      onCambioSeccion={() => {}}
    />,
  );

const AVANCE = { valor: "106 %", base: "423/400", lectura: "423 efectivas de una meta de 400" };

describe("la insignia de Avance lleva su base", () => {
  it("la base se pinta dentro de la cápsula, junto al porcentaje", () => {
    const html = render({ avance: AVANCE });
    expect(html).toContain('class="pulso-phase-pill-metric has-base"');
    expect(html).toContain('<span class="mon-pill-metric-valor">106 %</span>');
    expect(html).toContain('<span class="mon-pill-metric-base">423/400</span>');
  });

  it("el nombre accesible y el tooltip dicen la base entera", () => {
    const html = render({ avance: AVANCE });
    expect(html).toContain('aria-label="Avance, 106 %, 423 efectivas de una meta de 400: Cuotas, ritmo y entregas"');
    expect(html).toContain("title=\"Avance: 106 %, 423 efectivas de una meta de 400\nCuotas, ritmo y entregas\"");
  });

  it("un conteo suelto sigue siendo texto y el tooltip no encadena con «·»", () => {
    const html = render({ control: "23" });
    expect(html).toContain('<span class="mon-pill-metric-valor">23</span>');
    expect(html).not.toContain("mon-pill-metric-base");
    expect(html).toContain('title="Control: 23\nLlamadas y casos"');
  });
});

describe("el modelo de la insignia", () => {
  it("un texto vacío no produce cápsula", () => {
    expect(normalizarMetrica("")).toBeNull();
    expect(normalizarMetrica(undefined)).toBeNull();
    expect(normalizarMetrica({ valor: "" })).toBeNull();
  });

  it("sin lectura usa la base compacta", () => {
    const metrica = { valor: "59 %", base: "236/400" };
    expect(nombreDeLaPildora("Avance", metrica, "Faltante")).toBe("Avance, 59 %, 236/400: Faltante");
    expect(tituloDeLaPildora("Avance", metrica, "Faltante")).toBe("Avance: 59 %, 236/400\nFaltante");
  });

  it("Telefónico toma efectivas y meta del mismo resumen que Avance › Cuotas", () => {
    const insignias = insigniasDelModo({ ejeDeCuota: null, meta: 400, faltan: 0, efectivas: 423, porRevisar: 4 });
    expect(insignias.avance).toEqual(AVANCE);
    expect(insignias.control).toBe("4");
  });
});
