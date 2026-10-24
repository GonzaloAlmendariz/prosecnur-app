import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoInternalQueries, MonitoreoInternalQueryCase } from "../../../../../../api/client";
import { conRespuestaPor, csvDePersonas, estadoPorPublico, filtrarPersonas, pagina, personasDe } from "./personasModelo";
import { Personas } from "./Personas";

function caso(actor: string, advancement: string, channel = "", base_result = ""): MonitoreoInternalQueryCase {
  return { actor, advancement, channel, base_result, case_key: "cód. ••••29", date: "2026-06-12" } as unknown as MonitoreoInternalQueryCase;
}

const CASOS = [
  caso("Egresados", "effective", "Telefónico", "Cruzó por barrido"),
  caso("Egresados", "effective", "Correo", "Cruzó"),
  caso("Egresados", "partial", "Correo", "Cruzó"),
  caso("Egresados", "pending", "Correo", "En base"),
  caso("Docentes", "refusal", "Enlace personalizado", "Cruzó"),
];

describe("Control › Personas", () => {
  const personas = personasDe(CASOS);

  it("cuenta el estado por público con una fila de todos primero", () => {
    const filas = estadoPorPublico(personas);
    expect(filas.map((fila) => [fila.publico, fila.total])).toEqual([[null, 5], ["Egresados", 4], ["Docentes", 1]]);
    expect(filas[1].porEstado).toMatchObject({ efectiva: 2, parcial: 1, "sin-respuesta": 1 });
  });

  it("canal y cruce solo de quienes respondieron, y el cruce bien dicho", () => {
    const egresados = personas.filter((persona) => persona.publico === "Egresados");
    expect(conRespuestaPor(egresados, "canal")).toEqual([{ rotulo: "Correo", casos: 2 }, { rotulo: "Telefónico", casos: 1 }]);
    expect(conRespuestaPor(egresados, "comoCruzo")).toEqual([{ rotulo: "Cruzó por llave", casos: 2 }, { rotulo: "Cruzó por barrido", casos: 1 }]);
  });

  it("filtra, pagina y exporta con rótulos", () => {
    expect(filtrarPersonas(personas, { publico: "Egresados", estado: "efectiva", busqueda: "telef" })).toHaveLength(1);
    expect(pagina(Array.from({ length: 120 }, (_, i) => i), 3)).toMatchObject({ actual: 3, paginas: 3 });
    expect(csvDePersonas(personas).split("\n")[0]).toBe("\"Llave\",\"Público\",\"Estado\",\"Canal\",\"Cómo cruzó\",\"Fecha\"");
  });

  it("la vista no muestra claves crudas", () => {
    const consultas = { schema: "t", cases: [], case_rollup: CASOS, issues: [], pending_exit: [], totals: { actor: [], date: [], channel: [], source: [], collector: [] }, flow: { nodes: [], links: [] } } as unknown as MonitoreoInternalQueries;
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/monitoreo?foco=Egresados"]}><Personas consultas={consultas} /></MemoryRouter>);
    expect(html).toContain("Estado por público");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
