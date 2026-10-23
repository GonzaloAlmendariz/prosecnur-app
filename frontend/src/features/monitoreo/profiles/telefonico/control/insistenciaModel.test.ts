import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import {
  FILTROS_INICIALES,
  conDiasAlCorte,
  diasDesde,
  siglaDeCuota,
  escalaDeIntentos,
  filtrarCola,
  telefonosPorCaso,
} from "../../../core/colaDeInsistenciaModel";
import { casosDeCola, chipsDeInsistencia, estadoDeInsistencia, repartoDelEquipo, responsablesDeCola } from "./insistenciaModel";

function fila(codigo: string, responsable: string, intentos: number | "", status = "No contesta", extra: Record<string, unknown> = {}) {
  return {
    CodPulso: codigo,
    Responsable: responsable,
    "Sin asignar": responsable === "Sin asignar",
    Status: status,
    Intentos: intentos,
    Fecha: "2026-07-02",
    "Observación": "",
    "Variable cuota": "Sede",
    Cuota: "SJL",
    efectiva_kobo: false,
    dias_sin_registro: 25,
    "Criterio cola": "Vocabulario del proyecto",
    ...extra,
  };
}

function reportes(bloques: Array<{ id: string; rows: Array<Record<string, unknown>> }>): MonitoreoAcreditacionReports {
  return {
    schema: "test",
    generated_at: "",
    reference_tabs: [],
    sheets: [{ id: "monitoreo_telefonico", title: "Telefónico", blocks: bloques.map((b) => ({ ...b, title: b.id, columns: [] })) }],
  } as unknown as MonitoreoAcreditacionReports;
}

const cola = [
  fila("PDM1376", "Op-09", 3, "Contactar después", { "Observación": "durante la mañana" }),
  fila("PDM1372", "Op-09", 3),
  fila("PDM1385", "Op-09", 2, "Contactar después"),
  fila("PDM1409", "Op-09", 1),
  fila("PDM1885", "Op-09", 1, "No contesta", { efectiva_kobo: "TRUE" }),
  fila("PDM1999", "Op-09", ""),
  fila("PDM2001", "Op-15", 2),
];

describe("Control › Insistencia del telefónico", () => {
  it("lee el bloque normalizando vacíos y booleanos", () => {
    const casos = casosDeCola(cola);
    expect(casos).toHaveLength(7);
    expect(casos.find((caso) => caso.codigo === "PDM1999")?.intentos).toBeNull();
    expect(casos.find((caso) => caso.codigo === "PDM1885")?.efectivaKobo).toBe(true);
    // La observación sale literal, sin recortes.
    expect(casos[0].observacion).toBe("durante la mañana");
    // Sin las columnas propias, no hay teléfono ni origen que mostrar.
    expect(casos[0].ordenTelefono).toBeNull();
    expect(casos[0].origen).toBeNull();
  });

  it("ordena por más intentos primero (P12 abierta, configurable)", () => {
    const casos = casosDeCola(cola);
    const orden = filtrarCola(casos, { ...FILTROS_INICIALES, responsable: "Op-09" }).map((caso) => caso.intentos);
    expect(orden).toEqual([3, 3, 2, 1, 1, null]);
    const porFecha = filtrarCola(casos, { ...FILTROS_INICIALES, orden: "resultado" }).map((caso) => caso.status);
    expect(porFecha[0]).toBe("Contactar después");
  });

  it("oculta las efectivas en Kobo cuando se pide", () => {
    const casos = casosDeCola(cola);
    expect(filtrarCola(casos, { ...FILTROS_INICIALES, ocultarEfectivas: true }).some((caso) => caso.efectivaKobo)).toBe(false);
  });

  it("dice la escala de intentos de la cola en una frase", () => {
    const casos = filtrarCola(casosDeCola(cola), { ...FILTROS_INICIALES, responsable: "Op-09" });
    expect(escalaDeIntentos(casos)).toBe("6 casos: 2 con 3 intentos, 1 con 2, 2 con 1 y 1 sin dato");
    const muchos = casosDeCola([fila("A", "Op-03", 18), fila("B", "Op-03", 12), fila("C", "Op-03", 6), fila("D", "Op-03", 2)]);
    expect(escalaDeIntentos(muchos)).toBe("4 casos: 2 con 10 intentos o más, 1 con 5 a 9 y 1 con 1 a 4");
  });

  it("califica la insistencia frente a la mediana del equipo y deja «Sin asignar» fuera", () => {
    const responsables = responsablesDeCola([
      { Responsable: "Op-01", "Sin asignar": false, "Casos en cola": 2, "Ya efectivas en Kobo": 0, "Promedio intentos": 4, "Sin dato de intentos": 0, "Por llamar": 1 },
      { Responsable: "Op-02", "Sin asignar": false, "Casos en cola": 10, "Ya efectivas en Kobo": 1, "Promedio intentos": 2, "Sin dato de intentos": 0, "Por llamar": 5 },
      { Responsable: "Op-03", "Sin asignar": false, "Casos en cola": 8, "Ya efectivas en Kobo": 0, "Promedio intentos": 1, "Sin dato de intentos": 0, "Por llamar": 0 },
      { Responsable: "Sin asignar", "Sin asignar": true, "Casos en cola": 0, "Ya efectivas en Kobo": 0, "Promedio intentos": "", "Sin dato de intentos": 0, "Por llamar": 12 },
    ]);
    expect(responsables.map((item) => item.intensidad)).toEqual(["sobre", "en", "bajo", null]);
    const reparto = repartoDelEquipo(responsables, reportes([{ id: "no_barridos_responsable", rows: [
      { Responsable: "Sin responsable", "Casos asignados": 1197 },
      { Responsable: "Op-01", "Casos asignados": 53 },
      { Responsable: "Op-02", "Casos asignados": 100 },
    ] }]));
    expect(reparto).toEqual({ porLlamarAsignados: 6, repartidos: 153, equipo: 3 });
  });

  it("sin el bloque en el corte dice «Preparando», no una cola vacía", () => {
    expect(estadoDeInsistencia(reportes([{ id: "resumen_telefonico", rows: [] }])).clave).toBe("preparando");
    expect(estadoDeInsistencia(null).clave).toBe("sin-hoja");
    expect(chipsDeInsistencia(reportes([{ id: "cola_insistencia", rows: cola }]))).toEqual([
      "7 casos por rellamar",
      "1 ya es efectiva en Kobo",
    ]);
  });

  it("las columnas propias aparecen sólo si la hoja las trae", () => {
    const casos = casosDeCola([fila("MVH0037", "Op-03", 18, "Contactar después", { OrdenTelefono: 4, NumTelefonos: 4, Origen: "Listado" })]);
    expect(casos[0].ordenTelefono).toBe(4);
    expect(casos[0].origen).toBe("Listado");
    expect(telefonosPorCaso(casos)).toEqual([{ telefonos: 4, casos: 1 }]);
  });

  it("los días sin registro no restan mal con fechas posteriores al corte", () => {
    expect(diasDesde(25)).toBe("hace 25 días");
    expect(diasDesde(0)).toBe("el día del corte");
    expect(diasDesde(-3)).toBe("después del corte");
  });

  it("cuenta los días sin registro contra el corte, no contra el día del armado", () => {
    const [caso] = conDiasAlCorte(casosDeCola([fila("PDM1385", "Op-09", 2)]), "2026-07-27T09:04:00");
    expect(caso.diasSinRegistro).toBe(25);
  });

  it("la columna de cuota usa la sigla entre paréntesis si el valor la trae", () => {
    expect(siglaDeCuota("San Juan de Lurigancho (SJL)")).toBe("SJL");
    expect(siglaDeCuota("Cercado de Lima")).toBeNull();
  });
});
