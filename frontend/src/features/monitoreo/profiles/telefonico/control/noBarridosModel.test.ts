import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { avisoDeNoBarridos, construirAvisos } from "./avisosModel";
import {
  UMBRALES_NO_BARRIDO,
  construirNoBarridos,
  fraseDeReferencia,
  mensajeParaElEquipo,
  mensajeParaElOperador,
  severidadDe,
} from "./noBarridosModel";

function reportes(bloques: Record<string, Array<Record<string, unknown>>>): MonitoreoAcreditacionReports {
  return {
    schema: "test",
    generated_at: "",
    reference_tabs: [],
    sheets: [{
      id: "monitoreo_telefonico",
      title: "Telefónico",
      blocks: Object.entries(bloques).map(([id, rows]) => ({ id, title: id, columns: [], rows })),
    }],
  } as unknown as MonitoreoAcreditacionReports;
}

// Corte del 23/10 a mediodía en hora local (como lo guarda `synced_at`).
const CORTE = new Date(2026, 9, 23, 12, 0).toISOString();

function caso(codigo: string, responsable: string, referencia: string, tipo = "primera_llamada_operador", ultima = "2026-10-22") {
  return {
    CodPulso: codigo,
    Responsable: responsable,
    "Variable cuota": "dim_periodo",
    Cuota: "Pre visa humanitaria",
    Origen: "Muestra",
    "Fecha referencia": referencia,
    Referencia: tipo,
    "Primera llamada operador": "2026-10-14",
    "Ultima llamada operador": ultima,
  };
}

const BLOQUES = {
  no_barridos_casos: [
    caso("NB-001", "Op-01", "2026-10-18", "asignacion"),
    caso("NB-002", "Op-01", "2026-10-23", "asignacion"),
    caso("NB-003", "Op-02", "2026-10-21", "asignacion"),
    caso("NB-004", "Op-03", "2026-10-22", "asignacion"),
    caso("NB-005", "Op-04", "2026-10-14", "inicio_campo", ""),
  ],
  no_barridos_responsable: [
    { Responsable: "Op-01", "Casos asignados": 70, "No barridos": 2 },
    { Responsable: "", "Casos asignados": 370, "No barridos": 370 },
  ],
};

describe("Control › Barrido › No barridos", () => {
  it("los umbrales son 2 días de aviso y 4 de grave, en un solo lugar", () => {
    expect(UMBRALES_NO_BARRIDO).toEqual({ aviso: 2, grave: 4 });
    expect(severidadDe(0)).toBe("reciente");
    expect(severidadDe(1)).toBe("reciente");
    expect(severidadDe(2)).toBe("aviso");
    expect(severidadDe(3)).toBe("aviso");
    expect(severidadDe(4)).toBe("grave");
    expect(severidadDe(null)).toBe("sin-dato");
  });

  it("cuenta los días contra el corte y ordena operadores por severidad y antigüedad", () => {
    const modelo = construirNoBarridos(reportes(BLOQUES), CORTE);
    if (modelo.clave !== "lista") throw new Error(modelo.clave);
    const dias = Object.fromEntries(modelo.casos.map((item) => [item.codigo, item.dias]));
    expect(dias).toEqual({ "NB-001": 5, "NB-002": 0, "NB-003": 2, "NB-004": 1, "NB-005": 9 });
    expect(modelo.operadores.map((op) => op.nombre)).toEqual(["Op-04", "Op-01", "Op-02", "Op-03"]);
    expect(modelo.operadores[0].ultimaLlamada).toBeNull();
    expect(modelo.operadores[1]).toMatchObject({ graves: 1, avisos: 0, recientes: 1, maxDias: 5, severidad: "grave", asignados: 70 });
    expect(modelo.totales).toEqual({ casos: 5, graves: 2, avisos: 1, atrasados: 3, operadoresAtrasados: 3 });
    expect(modelo.sinAsignar).toBe(370);
    expect(modelo.corte).toBe("23/10");
  });

  it("declara la referencia que usa, en orden de prioridad", () => {
    const modelo = construirNoBarridos(reportes(BLOQUES), CORTE);
    if (modelo.clave !== "lista") throw new Error(modelo.clave);
    expect(modelo.referencias).toEqual(["asignacion", "inicio_campo"]);
    expect(fraseDeReferencia(modelo.referencias)).toBe("Días desde la fecha de asignación de la hoja; sin ella, desde el primer día de campo");
    expect(fraseDeReferencia(["primera_llamada_operador"])).toBe("Días desde la primera llamada de cada operador");
    expect(fraseDeReferencia(["sin_referencia"])).toBe("La hoja no trae fechas para contar los días");
  });

  it("sin el bloque dice «preparando»; sin hoja, «sin-hoja»", () => {
    expect(construirNoBarridos(reportes({ resumen_telefonico: [] }), CORTE).clave).toBe("preparando");
    expect(construirNoBarridos({ schema: "", generated_at: "", reference_tabs: [], sheets: [] }, CORTE).clave).toBe("sin-hoja");
  });

  it("sin corte no inventa días", () => {
    const modelo = construirNoBarridos(reportes(BLOQUES), null);
    if (modelo.clave !== "lista") throw new Error(modelo.clave);
    expect(modelo.casos.every((item) => item.dias == null && item.severidad === "sin-dato")).toBe(true);
    expect(avisoDeNoBarridos(reportes(BLOQUES), null)).toBeNull();
  });

  it("el mensaje por operador lista sus casos atrasados y el del equipo sólo a quien tiene atraso", () => {
    const modelo = construirNoBarridos(reportes(BLOQUES), CORTE);
    if (modelo.clave !== "lista") throw new Error(modelo.clave);
    const op01 = modelo.operadores.find((op) => op.nombre === "Op-01");
    if (!op01) throw new Error("Op-01");
    expect(mensajeParaElOperador(op01, "23/10")).toBe(
      "Op-01: 1 caso asignado sigue sin barrer al 23/10 (el más antiguo, 5 días).\n- NB-001 (Pre visa humanitaria): 5 días",
    );
    const equipo = mensajeParaElEquipo(modelo.operadores, "23/10");
    expect(equipo).toContain("Op-04:");
    expect(equipo).toContain("Op-02:");
    expect(equipo).not.toContain("Op-03:");
  });

  it("avisa en Control › Avisos con nivel alto si hay graves, con los casos y el desglose por operador", () => {
    const aviso = avisoDeNoBarridos(reportes(BLOQUES), CORTE);
    expect(aviso).toMatchObject({
      id: "casos-sin-barrer",
      nivel: "alta",
      casos: 3,
      destino: { direccion: { seccion: "control", pestana: "no-barridos" } },
    });
    expect(aviso?.desglose).toEqual([
      { etiqueta: "Op-04", valor: 1 },
      { etiqueta: "Op-01", valor: 1 },
      { etiqueta: "Op-02", valor: 1 },
    ]);
    expect(aviso?.afectados.map((item) => item.codigo)).toEqual(["NB-005", "NB-001", "NB-003"]);
    expect(construirAvisos(reportes(BLOQUES), CORTE).avisos.some((item) => item.id === "casos-sin-barrer")).toBe(true);
  });

  it("sólo con casos en aviso, el aviso es de nivel medio", () => {
    const aviso = avisoDeNoBarridos(reportes({ no_barridos_casos: [caso("NB-003", "Op-02", "2026-10-21", "asignacion")] }), CORTE);
    expect(aviso?.nivel).toBe("media");
    expect(aviso?.titulo).toBe("Casos asignados sin barrer hace 2 días o más");
  });
});
