import { describe, expect, it } from "vitest";

import { normalizarPlannerCalendario, normalizarPlannerEstado, normalizarPlannerModos } from "./planner";

describe("normalizadores del Planner", () => {
  it("lee los modos como los serializa R: escalares sueltos y listas vacías como {}", () => {
    const modos = normalizarPlannerModos({
      perfiles: "aulas",
      calc: { modo: "opinion-universitaria", perfil: "aulas", macro_familia: "encuesta_estudiantes", del_cliente: {} },
      monitoreo: { modos: "aulas", familias: "aulas_universitarias", modo: "aulas", familia: "aulas_universitarias" },
      material: { campanas: "aulas" },
      hojas_ruta: { aplica: false },
      origen: "declarado",
      revision: 3,
    });
    expect(modos.perfiles).toEqual(["aulas"]);
    expect(modos.calc).toEqual({ modo: "opinion-universitaria", perfil: "aulas", macroFamilia: "encuesta_estudiantes", delCliente: [] });
    expect(modos.monitoreo.modo).toBe("aulas");
    expect(modos.material.campanas).toEqual(["aulas"]);
    expect(modos.hojasRuta.aplica).toBe(false);
    expect(modos.origen).toBe("declarado");
  });

  it("sin perfiles no inventa modos", () => {
    const modos = normalizarPlannerModos({ perfiles: {}, calc: { modo: null }, monitoreo: {}, material: {}, hojas_ruta: {} });
    expect(modos.calc.modo).toBeNull();
    expect(modos.monitoreo.modo).toBeNull();
    expect(modos.material.campanas).toEqual([]);
    expect(modos.origen).toBe("proyectado");
  });

  it("descarta perfiles desconocidos y lee la representatividad vacía como nula", () => {
    const estado = normalizarPlannerEstado({
      revision: 1,
      planner: { perfiles: [{ tipo: "digital_general" }, { tipo: "aulas", poblaciones: [{ id: "principal", etiqueta: "Estudiantes", representatividad: {} }] }] },
      origen: { perfiles: "declarado" },
    });
    expect(estado.planner.perfiles.map((p) => p.tipo)).toEqual(["aulas"]);
    expect(estado.planner.perfiles[0].poblaciones[0].representatividad).toBeNull();
    expect(estado.origen.perfiles).toBe("declarado");
    expect(estado.origen.equipo).toBe("proyectado");
  });

  it("lee la etapa con sus fuentes y no inventa acuerdo cuando no lo hay", () => {
    const cal = normalizarPlannerCalendario({
      hoy: "2026-10-31",
      campo: { inicio: "2026-11-10", fin: "" },
      etapa: { valor: null, fuentes: { hojas_ruta: { etapa: "campo" }, monitoreo: { etapa: "piloto", campo_desde: "2026-11-12" } } },
      avisos: [{ codigo: "etapa_no_coincide", mensaje: "Hojas de ruta dice campo y Monitoreo, piloto." }],
    });
    expect(cal.etapa.valor).toBeNull();
    expect(cal.etapa.fuentes.monitoreo).toEqual({ etapa: "piloto", pilotoDesde: undefined, campoDesde: "2026-11-12" });
    expect(cal.campo).toEqual({ inicio: "2026-11-10", fin: "" });
    expect(cal.avisos).toHaveLength(1);
  });
});
