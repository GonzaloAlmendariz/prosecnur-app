import { describe, expect, it } from "vitest";

import { normalizarPlannerCalendario, normalizarPlannerEquipoDe, normalizarPlannerEstado, normalizarPlannerModos } from "./planner";

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
    expect(modos.origen).toBe("deducido");
  });

  it("lee los canales que todavía no abren su campaña (checklist-planner-q5, 4b)", () => {
    const pendiente = { canal: "qr", campana: "aulas", texto: "Falta un sorteo de cursos-horario.", href: "/calc-muestra" };
    const modos = normalizarPlannerModos({ material: { campanas: ["correo"], pendientes: [pendiente, { canal: "x" }, "basura"] } });
    expect(modos.material.pendientes).toEqual([pendiente]);
    expect(normalizarPlannerModos({ material: {} }).material.pendientes).toEqual([]);
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
    expect(estado.origen.equipo).toBe("vacio");
  });

  it("lee la etapa sin declarar como vacía, y una sección ausente no se lee como proyectada", () => {
    const cal = normalizarPlannerCalendario({
      hoy: "2026-10-31",
      campo: { inicio: "2026-11-10", fin: "" },
      etapa: { valor: null, origen: "vacio" },
      avisos: [{ codigo: "algo", mensaje: "Un aviso." }],
    });
    expect(cal.etapa).toEqual({ valor: null, origen: "vacio" });
    expect(cal.campo).toEqual({ inicio: "2026-11-10", fin: "" });
    expect(cal.avisos).toHaveLength(1);
    // ADR 0123 §5: lo que no vino declarado es vacío, también con un origen desconocido.
    expect(normalizarPlannerEstado({ origen: { estudio: "proyectado" } }).origen.estudio).toBe("vacio");
  });

  it("lee el equipo de un perfil; con DNI llega bloqueado y sin personas", () => {
    const eq = normalizarPlannerEquipoDe({ origen: "declarado", bloqueado: false, personas: [{ codigo: "P001", nombre: "Uno", rol: "encuestador", activo: false }] }, "territorial");
    expect(eq.personas).toEqual([{ codigo: "P001", nombre: "Uno", rol: "encuestador", activo: false }]);
    expect(eq.origen).toBe("declarado");
    const dni = normalizarPlannerEquipoDe({ bloqueado: true, motivo: "El código del equipo es el DNI", personas: {} }, "territorial");
    expect(dni.bloqueado).toBe(true);
    expect(dni.personas).toEqual([]);
  });

  it("lee la ventana de campo: la propuesta y su origen", () => {
    const cal = normalizarPlannerCalendario({
      ventana: { inicio: "2026-11-10", fin: "2026-12-02", fuente: "planner", origen: "declarado" },
    });
    expect(cal.ventana).toEqual({ inicio: "2026-11-10", fin: "2026-12-02", fuente: "planner", origen: "declarado" });
    // Sin declarar, del cronograma; lo que no es un día cae al vacío.
    const del_cronograma = normalizarPlannerCalendario({ ventana: { inicio: "2026-11-10T00:00:00Z", fin: "x", fuente: "cronograma", origen: "vacio" } });
    expect(del_cronograma.ventana).toEqual({ inicio: "2026-11-10", fin: "", fuente: "cronograma", origen: "vacio" });
    // Una fuente que ya no existe (Monitoreo) no se lee.
    expect(normalizarPlannerCalendario({ ventana: { fuente: "monitoreo" } }).ventana.fuente).toBe("");
    // Un backend anterior sin ventana: vacía.
    const viejo = normalizarPlannerCalendario({});
    expect(viejo.ventana).toEqual({ inicio: "", fin: "", fuente: "", origen: "vacio" });
    expect(normalizarPlannerEstado({ planner: { ventana: { inicio: "2026-11-10", fin: "2026-12-02" } } }).planner.ventana)
      .toEqual({ inicio: "2026-11-10", fin: "2026-12-02" });
  });
});
