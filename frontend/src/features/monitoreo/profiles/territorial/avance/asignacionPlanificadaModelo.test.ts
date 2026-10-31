import { describe, expect, it } from "vitest";

import { normalizeAsignacionPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";
import { columnaPlanificada } from "./asignacionPlanificadaModelo";

const comparable = normalizeAsignacionPlanificada({
  ok: true, estado: "comparable", motivo: "",
  resumen: { asignadas: 2, coinciden: 1, coinciden_con_otros: 0, otro_encuestador: 1, sin_respuestas: 0, sin_planificar: 1 },
  // auto_unbox: una lista de uno llega como objeto suelto.
  por_ump: [
    { id_manzana: "M1", label: "UMP 1", role: "titular", origen: "explicita", codigo_planificado: "P844", nombre_planificado: "Ana Ruiz",
      observados: { codigo: "P844", nombre: "Ana Ruiz", respuestas: 2 }, respuestas: 2, lectura: "coincide" },
    { id_manzana: "M3", label: "UMP 3 R", role: "reemplazo", origen: "heredada", codigo_planificado: "P101", nombre_planificado: "",
      observados: [{ codigo: "P320", nombre: "", respuestas: 1 }], respuestas: 1, lectura: "otro_encuestador" },
  ],
});

describe("columna Planificado (B3)", () => {
  it("normaliza la lista de uno y arma la celda con su lectura", () => {
    const c = columnaPlanificada(comparable);
    if (c.tipo !== "columna") throw new Error("sin columna");
    expect(c.porManzana.get("M1")).toMatchObject({ rotulo: "P844 · Ana Ruiz", texto: "Coincide", tono: "ok" });
    expect(c.porManzana.get("M1")?.detalle).toBe("Llegaron: P844 (2)");
    expect(c.porManzana.get("M3")).toMatchObject({ rotulo: "P101", texto: "Otro encuestador", tono: "falta" });
    expect(c.porManzana.get("M3")?.detalle).toBe("Llegaron: P320 (1). Código heredado del titular.");
    expect(c.resumen).toBe("Planificado en Material: 1 coinciden, 1 con otro encuestador, 1 con respuestas sin asignar.");
  });

  it("otra muestra se dice en una línea; sin asignación no pinta nada", () => {
    const otra = normalizeAsignacionPlanificada({ estado: "otra_muestra", motivo: "La muestra cambió desde el envío a campo: asignación de otra muestra." });
    expect(columnaPlanificada(otra)).toEqual({ tipo: "aviso", texto: "La muestra cambió desde el envío a campo: asignación de otra muestra." });
    expect(columnaPlanificada(normalizeAsignacionPlanificada({ estado: "sin_asignacion" }))).toEqual({ tipo: "nada" });
    expect(columnaPlanificada(null)).toEqual({ tipo: "nada" });
  });
});

describe("C7: estado declarado por campo", () => {
  it("lo pone en la celda con su contraste y lo cuenta en el resumen", () => {
    const a = normalizeAsignacionPlanificada({
      estado: "comparable",
      resumen: { asignadas: 1, coinciden: 0, con_estado_declarado: 1, contrastes: 1 },
      por_ump: [{ id_manzana: "M4", codigo_planificado: "P101", observados: [], respuestas: 0, lectura: "sin_respuestas",
        estado_declarado: "Finalizada", fecha_salida: "2026-10-01", fecha_entrega: "2026-10-02", contraste: "finalizada_sin_respuestas" }],
    });
    const c = columnaPlanificada(a);
    if (c.tipo !== "columna") throw new Error("sin columna");
    expect(c.conDeclarado).toBe(true);
    expect(c.porManzana.get("M4")?.declarado).toEqual({
      estado: "Finalizada",
      fechas: "salió 2026-10-01, entregó 2026-10-02",
      contraste: "Campo la da por finalizada y no llegó ninguna respuesta a Kobo.",
      conteo: null,
    });
    expect(c.resumen).toContain("Estado declarado por campo en 1; 1 no cuadra con Kobo.");
  });
});

describe("P2: efectivas del consolidado contra Kobo", () => {
  it("pone «Campo X · Kobo Y» en la celda y lo cuenta en el resumen", () => {
    const a = normalizeAsignacionPlanificada({
      estado: "comparable",
      resumen: { asignadas: 1, con_conteos: 1, conteos_distintos: 1 },
      por_ump: [{ id_manzana: "M2", codigo_planificado: "P844", observados: [], respuestas: 2, lectura: "coincide_con_otros",
        estado_declarado: "En campo", efectivas_declaradas: 5, efectivas_kobo: 1 }],
    });
    const c = columnaPlanificada(a);
    if (c.tipo !== "columna") throw new Error("sin columna");
    expect(c.porManzana.get("M2")?.declarado?.conteo).toEqual({ texto: "Campo 5 · Kobo 1", distinto: true });
    expect(c.resumen).toContain("Efectivas del consolidado en 1; 1 distinta de Kobo.");
  });
});
