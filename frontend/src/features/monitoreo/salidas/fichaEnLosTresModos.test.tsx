import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { construirCorte } from "../corte/corteContract";
import { MonitoreoOutputsWorkbench } from "./MonitoreoOutputsWorkbench";

/**
 * Cierre de QA (2026-10-25): Acreditación y Territorial montaban la forma
 * anterior del workbench —bloque «Listo» teñido de verde, antetítulo en
 * píldora, título truncado a 1024—. Los tres modos de Monitoreo llevan la
 * ficha, pasen o no `variante`. Cursos-horario la pide aparte.
 */
const LISTO = construirCorte({ ingesta: 10, procesable: 10, oficial: 10, meta: 10, hasSnapshot: true, generationStatus: "complete" });

function pintar(family: "telefonico" | "acreditacion" | "territorial" | "aulas", extra: { rotulo?: JSX.Element } = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MonitoreoOutputsWorkbench family={family} routeLabel="Monitoreo" corte={LISTO} rotulo={extra.rotulo} />
    </MemoryRouter>,
  );
}

describe("salidas: la ficha es la forma de los tres modos", () => {
  for (const family of ["telefonico", "acreditacion", "territorial"] as const) {
    it(`${family}: ficha sin pasar la variante`, () => {
      const html = pintar(family);
      expect(html).toContain("mon-outputs-workbench--ficha");
      expect(html).toContain("mon-outputs-workbench__antetitulo");
    });
  }

  it("cursos-horario conserva su forma mientras no la pida", () => {
    expect(pintar("aulas")).not.toContain("mon-outputs-workbench--ficha");
  });

  it("con rótulo de pestaña, éste encabeza la primera tarjeta y el antetítulo propio sobra", () => {
    const html = pintar("territorial", { rotulo: <span className="rotulo-de-prueba">AVANCE Salidas</span> });
    expect(html).toContain('class="mon-outputs-workbench__rotulo"><span class="rotulo-de-prueba">');
    expect(html).not.toContain("mon-outputs-workbench__antetitulo");
  });
});
