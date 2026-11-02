import { describe, expect, it } from "vitest";

import type { MonitoreoAulasAvanceTabla, MonitoreoAulasConfig } from "../../../../../api/monitoreo";
import { construirSalidas, momentoCorto, readinessDeSalidas } from "./salidasModelo";

const tablaFacultad: MonitoreoAulasAvanceTabla = {
  clave: "facultad",
  titulo: "Por facultad",
  cabecera: ["Facultad", "Planificados", "Aplicados", "Cuota", "Efectivas", "Avance"],
  tipos: ["texto", "numero", "numero", "numero", "numero", "porcentaje"],
  filas: [["Ciencias e Ingeniería", 37, 35, 528, 643, 1.218], ["Educación", 3, null, 24, 56, 2.333]],
  total: ["Total", 40, 35, 552, 699, 1.266],
};

const config = {
  libro_sheets: { spreadsheet_id: "abc" },
  libro_publicado: {
    publicado_en: "2026-10-01T20:04:00Z",
    synced_at: "2026-10-01T20:03:00Z",
    hojas: 13,
    detalle: [
      { hoja: "Aulas Agendadas", accion: "respetada", filas: 1392 },
      { hoja: "Base de control", accion: "actualizada", filas: 190 },
      { hoja: "Asignación de aplicadores", accion: "sin_cambios", filas: 46 },
      { hoja: "Plan del día", accion: "sin_cambios", filas: 4 },
    ],
  },
} as unknown as MonitoreoAulasConfig;

const entrada = { config, corte: "2026-10-01T20:03:00Z", clientSheets: null, tablas: [tablaFacultad], errorTablas: "" };

describe("construirSalidas (A5)", () => {
  it("el libro publicado con el mismo corte está al día, con su hora de Lima", () => {
    const libro = construirSalidas(entrada).salidas[0];
    expect(libro).toMatchObject({ clave: "libro", estado: "Al día con el corte", tono: "ok" });
    expect(libro.detalle).toBe("13 hojas en el Sheets del equipo. Publicado el 01/10 a las 15:04.");
    expect(libro.acciones.map((a) => a.rotulo)).toEqual(["Revisar cambios", "Construir en Material"]);
  });

  it("un corte más nuevo deja el libro anterior al corte; sin destino, Publicar se deshabilita con su motivo", () => {
    expect(construirSalidas({ ...entrada, corte: "2026-10-02T15:00:00Z" }).salidas[0].estado).toBe("Anterior al corte");
    const sin = construirSalidas({ ...entrada, config: {} as MonitoreoAulasConfig }).salidas[0];
    expect(sin.estado).toBe("Sin destino");
    expect(sin.acciones.find((a) => a.accion === "publicar")?.deshabilitada).toBe("Falta conectar el Sheets del equipo.");
  });

  it("qué toca Publicar separa las hojas de la app de las del equipo y nombra la regla de cada una", () => {
    const m = construirSalidas(entrada).queToca;
    if (m.tipo !== "hojas") throw new Error("sin hojas");
    expect(m.app.map((f) => [f.hoja, f.regla])).toEqual([
      ["Base de control", "Se reescribe"],
      ["Asignación de aplicadores", "Solo agrega filas nuevas"],
      ["Plan del día", "Se reescribe"],
    ]);
    expect(m.equipo.map((f) => [f.hoja, f.regla])).toEqual([["Aulas Agendadas", "Nunca se escribe"]]);
    expect(m.sub).toBe("3 de la app y 1 del equipo, según la última publicación");
  });

  it("sin recibo por hoja muestra las reglas declaradas, con las condicionales marcadas", () => {
    const viejo = { ...config, libro_publicado: { publicado_en: "2026-09-01T00:00:00Z" } } as MonitoreoAulasConfig;
    const m = construirSalidas({ ...entrada, config: viejo }).queToca;
    if (m.tipo !== "hojas") throw new Error("sin hojas");
    expect(m.sub).toContain("la próxima publicación deja aquí");
    expect(m.app.find((f) => f.hoja === "Facultades en riesgo")?.condicional).toBe(true);
    expect(m.equipo.map((f) => f.hoja)).toContain("Aulas Aplicadas (Campo)");
    const sin = construirSalidas({ ...entrada, config: {} as MonitoreoAulasConfig }).queToca;
    expect(sin.tipo === "hojas" && sin.sub).toContain("aún no se publica");
  });

  it("la vista previa es la tabla por facultad de la hoja, con su formato y el vacío como raya", () => {
    const v = construirSalidas(entrada).vistaPrevia;
    if (v.tipo !== "tabla") throw new Error("sin tabla");
    // Sin los rótulos de la hoja, cae a las seis primeras columnas.
    expect(v.filas[0]).toEqual(["Ciencias e Ingeniería", "37", "35", "528", "643", "121.8 %"]);
    expect(v.filas[1][2]).toBe("—");
    expect(v.total?.[5]).toBe("126.6 %");
    expect(v.numericas).toEqual([false, true, true, true, true, true]);
  });

  it("con los rótulos de la hoja, la vista previa toma las columnas de la ficha y dice cuántas deja", () => {
    const hoja: MonitoreoAulasAvanceTabla = {
      clave: "facultad", titulo: "Por facultad",
      cabecera: ["Facultad", "Efectivas", "Avance muestra", "Aulas aplicadas", "Aulas planificadas originalmente", "Muestra", "Sobremuestra"],
      tipos: ["texto", "numero", "porcentaje", "numero", "numero", "numero", "numero"],
      filas: [["Derecho", 445, 1.226, 25, 19, 363, 181]],
    };
    const v = construirSalidas({ ...entrada, tablas: [hoja] }).vistaPrevia;
    if (v.tipo !== "tabla") throw new Error("sin tabla");
    expect(v.cabecera).toEqual(["Facultad", "Aulas planificadas originalmente", "Aulas aplicadas", "Muestra", "Efectivas", "Avance muestra"]);
    expect(v.filas[0]).toEqual(["Derecho", "19", "25", "363", "445", "122.6 %"]);
    expect(v.sub).toBe("vista previa con el corte actual, 6 de 7 columnas");
  });

  it("la primera columna es el grupo de la hoja aunque no se llame «Facultad» (eje por nivel)", () => {
    const hoja: MonitoreoAulasAvanceTabla = {
      clave: "facultad", titulo: "Por nivel",
      cabecera: ["Nivel", "Efectivas", "Avance muestra", "Aulas aplicadas", "Muestra"],
      tipos: ["texto", "numero", "porcentaje", "numero", "numero"],
      filas: [["9", 57, 0.919, 12, 62]],
    };
    const v = construirSalidas({ ...entrada, tablas: [hoja] }).vistaPrevia;
    if (v.tipo !== "tabla") throw new Error("sin tabla");
    expect(v.cabecera).toEqual(["Nivel", "Aulas aplicadas", "Muestra", "Efectivas", "Avance muestra"]);
  });

  it("readiness: false mientras se pide la vista previa, la marca después", () => {
    expect(readinessDeSalidas(construirSalidas({ ...entrada, tablas: null }))).toBe("false");
    expect(readinessDeSalidas(construirSalidas(entrada))).toBe("monitoreo-aulas-avance-salidas");
    expect(construirSalidas({ ...entrada, tablas: [], errorTablas: "500" }).vistaPrevia).toMatchObject({ tipo: "vacio" });
  });

  it("momentoCorto escribe la hora de Lima y calla una fecha ilegible", () => {
    expect(momentoCorto("2026-09-25T22:42:00Z")).toBe("25/09 a las 17:42");
    expect(momentoCorto("")).toBe("");
  });
});
