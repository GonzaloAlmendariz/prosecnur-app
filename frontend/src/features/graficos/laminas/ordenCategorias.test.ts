import { describe, expect, it } from "vitest";
import { normalizeGraficosConfig } from "../../../api/graficosConfigNormalizer";
import type { GraficosCategorias } from "../../../api/graficos";
import { mergeSlotArgsPatch } from "../store";
import { mergeWithDefaults } from "../useGraficosAutosave";
import { claveCategorias } from "./useCategoriasGrafico";
import { AVISO_BASE_POR_DEFECTO, AVISO_ESCALA_ORDEN_IGNORADO, leerAvisosOrden, sinPrefijoPregunta } from "./ordenCategorias";
import { aplicaOrden, botonTrasMover, categoriasSinRespuestas, listaDesdeMostrado, ordenMostrado, varCalificada, leerOrden, listaPersonalizada, mover, ordenAGuardar, rotuloRecetario, tieneOrdenHeredado } from "./ordenCategorias";

const datos: GraficosCategorias = {
  var: "p7", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [
    { codigo: "1", etiqueta: "A", n: 5, pct: 0.5, residual: false },
    { codigo: "2", etiqueta: "B", n: 3, pct: 0.3, residual: false },
    { codigo: "0", etiqueta: "Otro", n: 1, pct: 0.1, residual: true },
    { codigo: "3", etiqueta: "C", n: 1, pct: 0.1, residual: false },
  ],
  orden: { recetario: ["1", "2", "3", "0"], instrumento: ["1", "2", "0", "3"], frecuencia: ["1", "2", "3", "0"] },
  avisos: [],
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

// Lo que dibuja el motor en `personalizado` (contrato §4), escrito aparte para no probar la función contra sí misma:
// la parte listada (al revés con `invertir`), luego las no listadas en orden del instrumento y al final sus residuales.
function dibujado(lista: readonly string[], d: GraficosCategorias, invertir: boolean): string[] {
  const existe = new Set(d.categorias.map((c) => c.codigo));
  const listada = lista.filter((k) => existe.has(k));
  const resto = d.orden.instrumento.filter((k) => !listada.includes(k));
  const residual = new Set(d.categorias.filter((c) => c.residual).map((c) => c.codigo));
  return [...(invertir ? [...listada].reverse() : listada), ...resto.filter((k) => !residual.has(k)), ...resto.filter((k) => residual.has(k))];
}

describe("Personalizado + Invertir: la lista se muestra en el orden en que se dibuja (F-a, WYSIWYG)", () => {
  it("sin invertir, lo mostrado es lo dibujado", () => {
    expect(ordenMostrado(["3", "1", "2", "0"], datos, false)).toEqual(dibujado(["3", "1", "2", "0"], datos, false));
  });
  it("con invertir, lo mostrado es la lista al revés, como se dibuja", () => {
    expect(ordenMostrado(["3", "1", "2", "0"], datos, true)).toEqual(["0", "2", "1", "3"]);
    expect(ordenMostrado(["3", "1", "2", "0"], datos, true)).toEqual(dibujado(["3", "1", "2", "0"], datos, true));
  });
  it("con invertir y lista incompleta, sólo se invierte la parte listada; las no listadas siguen detrás", () => {
    expect(ordenMostrado(["3", "1"], datos, true)).toEqual(["1", "3", "2", "0"]);
    expect(ordenMostrado(["3", "1"], datos, true)).toEqual(dibujado(["3", "1"], datos, true));
  });
  it("lo que el analista deja en pantalla es lo que se dibuja, con y sin invertir", () => {
    for (const invertir of [false, true]) {
      for (const guardada of [["3", "1", "2", "0"], ["3", "1"], ["0", "2"]]) {
        const visto = ordenMostrado(guardada, datos, invertir);
        for (let desde = 0; desde < visto.length; desde++) {
          for (let hasta = 0; hasta < visto.length; hasta++) {
            const movido = mover(visto, desde, hasta);
            const aGuardar = listaDesdeMostrado(movido, invertir);
            expect(dibujado(aGuardar, datos, invertir)).toEqual(movido);
            expect(ordenMostrado(aGuardar, datos, invertir)).toEqual(movido);
          }
        }
      }
    }
  });
});

describe("Personalizado sin parte listada: se muestra lo que el motor dibuja (instrumento, residuales al final)", () => {
  it("con la lista vacía, invierta o no, el orden es el del instrumento (no el del recetario)", () => {
    expect(ordenMostrado([], datos, false)).toEqual(dibujado([], datos, false));
    expect(ordenMostrado([], datos, true)).toEqual(dibujado([], datos, true));
    expect(ordenMostrado([], datos, true)).toEqual(["1", "2", "3", "0"]);
    const otroRecetario: GraficosCategorias = { ...datos, orden: { ...datos.orden, recetario: ["3", "2", "1", "0"] } };
    expect(ordenMostrado([], otroRecetario, false)).toEqual(["1", "2", "3", "0"]);
    expect(ordenMostrado([], otroRecetario, true)).toEqual(["1", "2", "3", "0"]);
  });
  it("una lista con sólo códigos que ya no existen se comporta como vacía", () => {
    expect(ordenMostrado(["99"], datos, true)).toEqual(dibujado(["99"], datos, true));
  });
});

describe("categoriasSinRespuestas", () => {
  it("devuelve los códigos con n = 0", () => {
    const d: GraficosCategorias = { ...datos, categorias: datos.categorias.map((c) => (c.codigo === "3" ? { ...c, n: 0 } : c)) };
    expect([...categoriasSinRespuestas(d)]).toEqual(["3"]);
    expect(categoriasSinRespuestas(datos).size).toBe(0);
  });
});


describe("avisos de la pregunta (decisión 4, §7)", () => {
  const P = "¿Cuál es su edad?";
  it("recorta el prefijo «“<pregunta>”: » sólo si coincide exacto", () => {
    expect(sinPrefijoPregunta(`“${P}”: una categoría no tiene respuestas.`, P)).toBe("Una categoría no tiene respuestas.");
    expect(sinPrefijoPregunta(`“${P}”: una categoría no tiene respuestas.`, "¿Cuál es su edad")).toBe(`“${P}”: una categoría no tiene respuestas.`);
    expect(sinPrefijoPregunta(`“${P}”:una`, P)).toBe(`“${P}”:una`);
    expect(sinPrefijoPregunta(`“${P}”: `, P)).toBe(`“${P}”: `);
    expect(sinPrefijoPregunta("“”: x", "")).toBe("“”: x");
    expect(sinPrefijoPregunta(`“${P}”: «Otro» va al final.`, P)).toBe("«Otro» va al final.");
  });

  it("separa la de escala, destaca base_por_defecto y conserva el orden y los códigos desconocidos", () => {
    const r = leerAvisosOrden({ pregunta: P, avisos: [
      { codigo: AVISO_BASE_POR_DEFECTO, texto: "las categorías son de otra base" },
      { codigo: AVISO_ESCALA_ORDEN_IGNORADO, texto: "x" },
      { codigo: "residuales_al_final", texto: "base_por_defecto escala_orden_ignorado" },
      { codigo: "nuevo", texto: "y" },
    ] });
    expect(r.escala).toEqual({ codigo: AVISO_ESCALA_ORDEN_IGNORADO, texto: "x", destacada: false });
    expect(r.notas.map((n) => [n.codigo, n.destacada])).toEqual([[AVISO_BASE_POR_DEFECTO, true], ["residuales_al_final", false], ["nuevo", false]]);
    expect(leerAvisosOrden(null)).toEqual({ notas: [], escala: null });
  });

  it("la caché del hook distingue el graficador (el aviso de escala depende de él)", () => {
    expect(claveCategorias("s", "active", "d$p7", "p_pie")).not.toBe(claveCategorias("s", "active", "d$p7", "p_barras_apiladas"));
  });
});
