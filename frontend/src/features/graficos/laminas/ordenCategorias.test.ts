import { describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../../api/graficosConfigNormalizer";
import type { GraficosCategorias } from "../../../api/graficos";
import { mergeSlotArgsPatch } from "../store";
import { mergeWithDefaults } from "../useGraficosAutosave";
import { aplicaOrden, botonTrasMover, varCalificada, leerOrden, listaPersonalizada, mover, ordenAGuardar, rotuloRecetario, tieneOrdenHeredado } from "./ordenCategorias";

const datos: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "A", n: 5, pct: 0.5, residual: false },
    { codigo: "2", etiqueta: "B", n: 3, pct: 0.3, residual: false },
    { codigo: "0", etiqueta: "Otro", n: 1, pct: 0.1, residual: true },
    { codigo: "3", etiqueta: "C", n: 1, pct: 0.1, residual: false },
  ],
  orden: { recetario: ["1", "2", "3", "0"], instrumento: ["1", "2", "0", "3"], frecuencia: ["1", "2", "3", "0"] },
};

describe("orden de categorías por gráfico (D8)", () => {
  it("sólo en categóricas, agrupadas, torta y dona; en escalas no", () => {
    for (const g of ["p_barras_categoricas", "p_barras_agrupadas", "p_pie", "p_donut"]) expect(aplicaOrden(g)).toBe(true);
    for (const g of ["p_barras_apiladas", "p_barras_multiapiladas", "p_numerico"]) expect(aplicaOrden(g)).toBe(false);
  });

  it("ausente, vacío o modo desconocido es recetario; el de fábrica no se guarda", () => {
    expect(leerOrden({})).toEqual({ modo: "recetario", lista: [], invertir: false });
    expect(leerOrden({ orden_categorias: { modo: "raro", lista: [1, "2", null], invertir: "sí" } })).toEqual({ modo: "recetario", lista: ["1", "2"], invertir: false });
    expect(ordenAGuardar({ modo: "recetario", lista: [], invertir: false })).toBeNull();
    expect(ordenAGuardar({ modo: "recetario", lista: ["1"], invertir: true })).toEqual({ modo: "recetario", lista: [], invertir: true });
    expect(ordenAGuardar({ modo: "personalizado", lista: ["3", "1"], invertir: false })).toEqual({ modo: "personalizado", lista: ["3", "1"], invertir: false });
  });

  it("la opción Recetario dice qué modo aplica, o que manda un orden anterior", () => {
    expect(rotuloRecetario(datos, false)).toBe("Recetario · por frecuencia");
    expect(rotuloRecetario({ ...datos, modo_recetario: "instrumento" }, false)).toBe("Recetario · como el instrumento");
    expect(rotuloRecetario(null, false)).toBe("Recetario");
    expect(rotuloRecetario(datos, true)).toBe("Recetario · orden elegido antes");
    expect(tieneOrdenHeredado({ orden_barras: "mayor_menor" })).toBe(true);
    expect(tieneOrdenHeredado({ overrides: { orden_categorias_manual: [] } })).toBe(false);
  });

  it("la lista personalizada: listados que existen, luego no listados, y los residuales no listados al final", () => {
    expect(listaPersonalizada([], datos)).toEqual(["1", "2", "3", "0"]);
    expect(listaPersonalizada(["0", "3", "99"], datos)).toEqual(["0", "3", "1", "2"]);
    expect(listaPersonalizada(["2"], datos)).toEqual(["2", "1", "3", "0"]);
    expect(mover(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(mover(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
  });

  it("la pregunta va siempre calificada con su base", () => {
    expect(varCalificada("p7", "docentes")).toBe("docentes$p7");
    expect(varCalificada("egresados$p7", "docentes")).toBe("egresados$p7");
    expect(varCalificada("p7", null)).toBe("p7");
  });

  it("ida y vuelta: la clave sobrevive al parche, al guardado (JSON) y a la hidratación", () => {
    const orden = ordenAGuardar({ modo: "personalizado", lista: ["3", "1", "2"], invertir: true });
    const args = mergeSlotArgsPatch({ var: "p7", orden_barras: "instrumento" }, { orden_categorias: orden });
    const cfg = { plan: { slides: [{ id: "s1", tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_categoricas", args } } }] } };
    const guardado = JSON.parse(JSON.stringify(normalizeGraficosConfig(cfg, { includeLegacyAliases: true })));
    const hidratado = mergeWithDefaults(guardado);
    const vuelta = (hidratado.plan.slides[0].payload as Record<string, { args: Record<string, unknown> }>).grafico.args;
    expect(leerOrden(vuelta)).toEqual({ modo: "personalizado", lista: ["3", "1", "2"], invertir: true });
    // Volver a recetario sin invertir borra la clave.
    expect(mergeSlotArgsPatch(vuelta, { orden_categorias: ordenAGuardar({ modo: "recetario", lista: [], invertir: false }) })).not.toHaveProperty("orden_categorias");
  });
});

describe("Subir/Bajar no tiran el foco a BODY al llegar al borde (verificador frontend-3)", () => {
  it("en medio de la lista el foco se queda en el botón pulsado", () => {
    expect(botonTrasMover("subir", 1, 4)).toBe("subir");
    expect(botonTrasMover("bajar", 2, 4)).toBe("bajar");
  });
  it("al llegar al borde, el botón pulsado queda disabled y el foco pasa al opuesto", () => {
    expect(botonTrasMover("subir", 0, 4)).toBe("bajar");
    expect(botonTrasMover("bajar", 3, 4)).toBe("subir");
  });
  it("con una sola categoría no hay botón habilitado: el foco va al ítem", () => {
    expect(botonTrasMover("subir", 0, 1)).toBeNull();
    expect(botonTrasMover("bajar", 0, 1)).toBeNull();
  });
});
