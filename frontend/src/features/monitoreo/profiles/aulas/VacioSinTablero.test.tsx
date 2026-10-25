import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VacioSinTablero } from "./VacioSinTablero";

describe("VacioSinTablero", () => {
  it("sin plan importado manda al origen del plan, no a sincronizar", () => {
    const html = renderToStaticMarkup(
      <VacioSinTablero planImportado={false} fuentesActivas={0} fuentesDeclaradas={0} onIrAFuentes={vi.fn()} />,
    );

    expect(html).toContain("Falta importar el plan");
    expect(html).toContain("cálculo de muestra");
    expect(html).toContain("Ir a Fuentes");
  });

  it("con el plan puesto el pendiente es el corte de campo", () => {
    const html = renderToStaticMarkup(
      <VacioSinTablero planImportado fuentesActivas={1} fuentesDeclaradas={2} onIrAFuentes={vi.fn()} />,
    );

    expect(html).toContain("Falta sincronizar el campo");
    expect(html).toContain("1 de 2 fuentes activas");
  });

  it("si la lectura falló no culpa al plan: dice que no se leyó (Meta B, L21)", () => {
    const html = renderToStaticMarkup(
      <VacioSinTablero planImportado={false} fuentesActivas={0} fuentesDeclaradas={0} lecturaFallida onReintentar={vi.fn()} />,
    );

    expect(html).toContain("No se pudo leer el monitoreo");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("Falta importar el plan");
  });

  it("la página pasa la lectura fallida sólo cuando no hay estado", () => {
    const pagina = readFileSync(resolve(__dirname, "AulasMonitoreoPage.tsx"), "utf8");
    expect(pagina).toContain("lecturaFallida={!state && Boolean(error)}");
  });

  it("el perfil no vuelve al vacío mudo", () => {
    const pagina = readFileSync(resolve(__dirname, "AulasMonitoreoPage.tsx"), "utf8");
    expect(pagina).not.toContain("Todavía no hay un panel local preparado para cursos-horario");
    expect(pagina).toContain("<VacioSinTablero");
  });
});
