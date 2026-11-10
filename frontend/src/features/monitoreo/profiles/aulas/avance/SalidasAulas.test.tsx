import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasConfig } from "../../../../../api/monitoreo";
import { PestanaPropiaDeAulas } from "../navegacion/PestanaPropiaDeAulas";
import { SalidasAulas, type ContextoDeSalidas } from "./SalidasAulas";

const contexto: ContextoDeSalidas = {
  config: {
    libro_sheets: { spreadsheet_id: "abc" },
    libro_publicado: { publicado_en: "2026-10-01T20:04:00Z", synced_at: "2026-10-01T20:03:00Z", hojas: 2,
      detalle: [{ hoja: "Base de control", accion: "actualizada", filas: 3 }, { hoja: "Aulas Agendadas", accion: "respetada", filas: 9 }] },
  } as unknown as MonitoreoAulasConfig,
  corte: "2026-10-01T20:03:00Z",
  clientSheets: null,
  ocupado: false,
  irAMaterial: () => {},
  generarLibro: async () => ({ ok: true as const, file_id: "libro-1", filename: "Libro.xlsx", unidades: 0, partes: 0, control: 0 }),
  hrefHerramientas: "/monitoreo?modo=aulas&seccion=avance&pestana=salidas&panel=herramientas",
};

function pintar(url = "/monitoreo?modo=aulas&seccion=avance&pestana=salidas") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}><SalidasAulas contexto={contexto} /></MemoryRouter>,
  );
}

describe("SalidasAulas", () => {
  it("declara sus superficies (C1) y pinta las salidas, la vista previa y lo que toca Publicar", () => {
    const html = pintar();
    // En el primer render la vista previa todavía se pide: la marca espera.
    expect(html).toContain('data-audit-ready="false"');
    // Estándar de Salidas (4 nov 2026): la portada común, con las salidas propias de cursos-horario.
    expect(html).toContain('data-qa-geometry-group="monitoreo-salidas"');
    expect(html).toContain('data-qa-geometry-member="salidas"');
    expect(html).toContain('data-qa-geometry-member="vista"');
    expect(html).toContain('data-qa-geometry-group="aulas-salidas-que-toca"');
    for (const texto of ["Salidas del corte", "Libro del operativo", "Al día con el corte", "PDF de avance", "Sheets del cliente",
      "Libro en Excel", "Así se verá", "Avance de campo", "Qué toca Publicar en el libro", "Nunca se escribe", "Se reescribe"]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain("Generar PDF");
    expect(html).toContain("Conectar");
  });

  it("la pestaña propia monta A5 sólo en la principal y con su contexto", () => {
    const base = { dashboard: null, cargando: false, vacioSinTablero: <p>x</p> };
    const principal = renderToStaticMarkup(
      <MemoryRouter><PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "salidas", panel: null }} {...base} salidas={contexto} /></MemoryRouter>,
    );
    expect(principal).toContain("Salidas del corte");
    const herramientas = renderToStaticMarkup(
      <MemoryRouter><PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "salidas", panel: "herramientas" }} {...base} salidas={contexto} /></MemoryRouter>,
    );
    expect(herramientas).toBe("");
  });
});
