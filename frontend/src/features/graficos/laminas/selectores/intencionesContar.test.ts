// «¿Qué quieres contar?» (ADR 0135 §1): las intenciones, la clase de cada tarjeta, el filtro por registro, la búsqueda y
// el gráfico de partida que la tarjeta escribe sin pisar lo configurado.
import { describe, expect, it } from "vitest";
import { payloadPorDefecto } from "../../store";
import { planearCambioTipo } from "./cambioTipoLamina";
import { cambioConOpcion, conOpcion, presetDe, tipoDeOpcion, type EstudioDelSelector } from "./opcionesLamina";
import {
  casaBusqueda, indicadorPorDefecto, INTENCIONES_CONTAR, presentacionDeGrafico, ROTULO_CLASE, TARJETAS_CONTAR, tarjetaContar, tarjetaContarDeLamina, tarjetasDe,
} from "./intencionesContar";
import { etiquetaBotonTarjeta, usoDeTarjeta } from "./detalleLamina";
import { PRESETS_LAMINA } from "./opcionesLamina";
import { existeEntradaCatalogo, graficadorDeEntrada, NOMBRE_TIPO_GRAFICO, nombreDeEntrada, varianteGrafico } from "../../catalogoGraficos";
import { CATALOGO_LAMINAS, VARIANTES_GRAFICO } from "../../iconos/catalogoTipos.generated";

const HOY = new Set(["p_panorama", "p_dumbbell", "p_barras_divergentes", "p_heatmap_cruce", "p_significancia_publicos", "p_dim_heatmap_criterios"]);
const LAMINAS = new Set(["p_slide_1_grafico"]);
const claves = (id: string, g = HOY) => tarjetasDe(INTENCIONES_CONTAR.find((i) => i.id === id)!, g, LAMINAS).map((t) => t.clave);

describe("intenciones de «¿Qué quieres contar?»", () => {
  it("son cuatro, en este orden, y ninguna es la tendencia entre mediciones (ADR 0135 §9)", () => {
    expect(INTENCIONES_CONTAR.map((i) => i.nombre)).toEqual(["Resumen del estudio", "Comparación de públicos", "Grupos de un público", "Escalas de acuerdo"]);
    expect(TARJETAS_CONTAR.some((t) => /tendencia/i.test(t.nombre))).toBe(false);
  });

  it("Fortalezas y Cobertura sólo aparecen cuando el registro trae su graficador", () => {
    expect(claves("resumir")).toEqual(["p_slide_1_grafico:panorama"]);
    expect(claves("resumir", new Set([...HOY, "p_fortalezas", "p_cobertura"]))).toEqual([
      "p_slide_1_grafico:panorama", "p_slide_1_grafico:fortalezas", "p_slide_1_grafico:cobertura",
    ]);
  });

  it("el cierre con hallazgos es la última tarjeta de «Resumen del estudio», como lámina y sin gráfico", () => {
    const conCierre = tarjetasDe(INTENCIONES_CONTAR[0], new Set([...HOY, "p_fortalezas", "p_cobertura"]), new Set([...LAMINAS, "p_slide_cierre_hallazgos"]));
    const ultima = conCierre[conCierre.length - 1];
    expect(ultima).toMatchObject({ clave: "p_slide_cierre_hallazgos:cierre", tipo: "p_slide_cierre_hallazgos", nombre: "Cierre con hallazgos", clase: "lamina" });
    expect(ultima.grafico).toBeUndefined();
    expect(claves("resumir")).not.toContain("p_slide_cierre_hallazgos:cierre");
    expect(conOpcion("p_slide_cierre_hallazgos:cierre", payloadPorDefecto("p_slide_cierre_hallazgos"))).toEqual(payloadPorDefecto("p_slide_cierre_hallazgos"));
    expect(presentacionDeGrafico("p_barras_agrupadas", {}).nombre).toBeNull();
  });

  it("comparar, ver dentro y leer una escala ofrecen sus tarjetas; el contraste está en dos intenciones", () => {
    // ADR 0137: la tabla de letras y el mapa por dimensión no se ofrecen aunque el registro los traiga.
    expect(claves("comparar")).toEqual(["p_slide_1_grafico:contraste"]);
    expect(claves("dentro")).toEqual(["p_slide_1_grafico:aperturas", "p_slide_1_grafico:mapa_calor", "p_slide_1_grafico:contraste"]);
    expect(claves("escala")).toEqual(["p_slide_1_grafico:escala", "p_slide_1_grafico:divergentes"]);
    expect(claves("comparar", new Set(["p_dumbbell"]))).toEqual(["p_slide_1_grafico:contraste"]);
  });

  it("ADR 0137: ninguna intención ofrece una tarjeta con un tipo retirado; el mapa de calor por cruce entra con su graficador", () => {
    const todas = INTENCIONES_CONTAR.flatMap((i) => tarjetasDe(i, HOY, LAMINAS));
    expect(todas.map((t) => t.grafico?.graficador)).not.toContain("p_significancia_publicos");
    expect(todas.map((t) => t.grafico?.graficador)).not.toContain("p_dim_heatmap_criterios");
    expect(claves("dentro", new Set(["p_dumbbell"]))).not.toContain("p_slide_1_grafico:mapa_calor");
    expect(tarjetaContar("p_slide_1_grafico:mapa_calor")?.grafico).toEqual({ graficador: "p_heatmap_cruce", args: {} });
  });

  it("cada tarjeta declara su clase, una línea corta sin punto medio y lo que pide", () => {
    for (const t of TARJETAS_CONTAR) {
      expect(ROTULO_CLASE[t.clase], t.clave).toBeTruthy();
      expect(t.uso.length, t.clave).toBeLessThanOrEqual(56);
      expect(t.uso, t.clave).not.toMatch(/[·;—]/);
      expect(t.pide, t.clave).toBeTruthy();
    }
    // ADR 0139: una tarjeta que inserta un gráfico es un gráfico; «Lámina» queda para las composiciones.
    expect(presetDe("p_slide_1_grafico:panorama")?.clase).toBe("grafico");
    expect(presetDe("p_slide_1_grafico:divergentes")?.clase).toBe("grafico");
    expect(ROTULO_CLASE).toEqual({ grafico: "Gráfico", lamina: "Lámina" });
    for (const t of TARJETAS_CONTAR) if (t.grafico) expect(t.clase, t.clave).toBe("grafico");
  });
});

describe("el gráfico de partida", () => {
  it("insertar la tarjeta escribe la lámina con su gráfico y su estilo", () => {
    expect(tipoDeOpcion("p_slide_1_grafico:contraste")).toBe("p_slide_1_grafico");
    const p = conOpcion("p_slide_1_grafico:contraste", payloadPorDefecto("p_slide_1_grafico"));
    expect(p.grafico).toEqual({ graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null, regla: { tipo: "mayor_diferencia", n: 13 } } });
    const a = conOpcion("p_slide_1_grafico:aperturas", payloadPorDefecto("p_slide_1_grafico"));
    expect(a.grafico).toEqual({ graficador: "p_dumbbell", args: { estilo: "resumen", regla: { tipo: "mayor_diferencia", n: 10 } } });
  });

  it("sobre el mismo graficador conserva sus preguntas y sólo escribe lo de la tarjeta", () => {
    const slide = { tipo: "p_slide_1_grafico" as const, payload: { titulo: "T", grafico: { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null, vars: { t1: ["a$p1", "b$p1"] } } } } };
    const c = cambioConOpcion("p_slide_1_grafico:aperturas", planearCambioTipo(slide, "p_slide_1_grafico"));
    expect(c.payload.grafico).toEqual({
      graficador: "p_dumbbell", args: { estilo: "resumen", vars: { t1: ["a$p1", "b$p1"] }, regla: { tipo: "mayor_diferencia", n: 10 } },
    });
    expect(c.sobrantes).toEqual([]);
    expect(c.mismoTipo).toBe(false);
    expect(c.payload.titulo).toBe("T");
  });

  it("al cambiar, un gráfico de otro tipo se avisa como sobrante en vez de pisarse en silencio", () => {
    const pie = { graficador: "p_pie", args: { var: "P1" } };
    const slide = { tipo: "p_slide_1_grafico" as const, payload: { titulo: "", grafico: pie } };
    const c = cambioConOpcion("p_slide_1_grafico:panorama", planearCambioTipo(slide, "p_slide_1_grafico"));
    expect(c.sobrantes).toEqual([{ slot: "grafico", grafico: pie }]);
    expect(c.conservados).toEqual([]);
    expect(c.payload.grafico).toEqual({ graficador: "p_panorama", args: { regla: { tipo: "todas" } } });
    expect(etiquetaBotonTarjeta({ modo: "cambiar", clase: "grafico", actual: false, sobrantes: 1, confirmando: true }).texto).toBe("Cambiar y quitar 1 gráfico");
  });

  it("la lámina ya puesta se reconoce como su tarjeta y el inspector la presenta con su nombre y clase", () => {
    const g = (graficador: string, args: Record<string, unknown>) => ({ tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador, args } } });
    expect(tarjetaContarDeLamina(g("p_dumbbell", { estilo: "resumen", cruce: null }))?.clave).toBe("p_slide_1_grafico:contraste");
    expect(tarjetaContarDeLamina(g("p_dumbbell", { estilo: "resumen", cruce: "base$ciclo" }))?.clave).toBe("p_slide_1_grafico:aperturas");
    expect(tarjetaContarDeLamina(g("p_dumbbell", { cruce: "base$ciclo" }))).toBeNull();
    expect(tarjetaContarDeLamina(g("p_barras_divergentes", {}))?.clave).toBe("p_slide_1_grafico:divergentes");
    expect(presentacionDeGrafico("p_panorama", {})).toEqual({ nombre: "Panorama de públicos", clase: "grafico", deResumen: true });
    expect(presentacionDeGrafico("p_pie", {})).toEqual({ nombre: null, clase: "grafico", deResumen: false });
    // R13-6a: la tarjeta de clase «Gráfico» dice que el gráfico va dentro; la de clase «Lámina» inserta la lámina.
    expect(etiquetaBotonTarjeta({ modo: "insertar", clase: "grafico", actual: false, sobrantes: 0, confirmando: false }).texto).toBe("Insertar lámina con este gráfico");
    expect(etiquetaBotonTarjeta({ modo: "insertar", clase: "lamina", actual: false, sobrantes: 0, confirmando: false }).texto).toBe("Insertar lámina");
    expect(etiquetaBotonTarjeta({ modo: "cambiar", clase: "grafico", actual: true, sobrantes: 0, confirmando: false })).toEqual({ texto: "Es la lámina actual", deshabilitado: true });
  });
});

describe("ADR 0135 §2: las láminas de resumen nacen con su regla", () => {
  const ESTUDIO: EstudioDelSelector = { bases: ["docentes", "estudiantes", "administrativos"], baseActiva: "estudiantes" };
  const insertar = (op: Parameters<typeof conOpcion>[0], estudio: EstudioDelSelector = ESTUDIO) =>
    conOpcion(op, payloadPorDefecto("p_slide_1_grafico"), estudio).grafico as { graficador: string; args: Record<string, unknown> };

  it("panorama: todas las de escala de cada base del estudio", () => {
    expect(insertar("p_slide_1_grafico:panorama").args).toEqual({
      regla: { tipo: "todas" }, vars: ["docentes$*", "estudiantes$*", "administrativos$*"],
    });
  });
  it("contraste y aperturas: las de mayor diferencia, 13 y 10", () => {
    expect(insertar("p_slide_1_grafico:contraste").args.regla).toEqual({ tipo: "mayor_diferencia", n: 13 });
    expect(insertar("p_slide_1_grafico:aperturas").args.regla).toEqual({ tipo: "mayor_diferencia", n: 10 });
  });
  it("contraste: nace con el par de las dos primeras bases; con una sola no lo inventa; aperturas no lleva par", () => {
    expect(insertar("p_slide_1_grafico:contraste").args.bases).toEqual(["docentes", "estudiantes"]);
    expect(insertar("p_slide_1_grafico:contraste", { bases: ["unica"], baseActiva: "unica" }).args.bases).toBeUndefined();
    expect(insertar("p_slide_1_grafico:contraste", { bases: [], baseActiva: null }).args.bases).toBeUndefined();
    const slide = { tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador: "p_dumbbell", args: { estilo: "resumen", bases: ["docentes", "estudiantes"] } } } };
    const aperturas = conOpcion("p_slide_1_grafico:aperturas", slide.payload, ESTUDIO).grafico as { args: Record<string, unknown> };
    expect(aperturas.args).not.toHaveProperty("bases");
  });
  it("escala: bajo 60 %; con 2+ bases sobre todas, en su orden; con una, la suya", () => {
    expect(insertar("p_slide_1_grafico:escala").args).toEqual({
      estilo: "resumen", regla: { tipo: "bajo_umbral", umbral: 60 }, vars: ["docentes$*", "estudiantes$*", "administrativos$*"],
    });
    expect(insertar("p_slide_1_grafico:escala", { bases: ["unica"], baseActiva: null }).args.vars).toEqual(["unica$*"]);
  });
  it("fortalezas: las preguntas de la base activa; la regla la pone el constructor", () => {
    expect(insertar("p_slide_1_grafico:fortalezas").args).toEqual({ vars: ["estudiantes$*"] });
  });
  it("cobertura: todas las bases del estudio y la propuesta de padrón y meta que haya (U3)", () => {
    expect(insertar("p_slide_1_grafico:cobertura").args).toEqual({ bases: ["docentes", "estudiantes", "administrativos"] });
    const conPropuesta: EstudioDelSelector = { ...ESTUDIO, padron: [
      { base: "docentes", padron: 123, padron_origen: "Cálculo de muestra: marco validado (Docentes)", meta: 60, meta_unidad: "porcentaje", meta_origen: "", motivo: "" },
      { base: "administrativos", padron: 90, padron_origen: "Monitoreo: universo (Administrativos)", meta: 74, meta_unidad: "casos", meta_origen: "", motivo: "" },
      { base: "estudiantes", padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "", motivo: "Sin padrón declarado." },
    ] };
    expect(insertar("p_slide_1_grafico:cobertura", conPropuesta).args).toEqual({
      bases: ["docentes", "estudiantes", "administrativos"],
      universos: "Docentes: 123; Administrativos: 90",
      metas: "Docentes: 60%; Administrativos: 74",
    });
    expect(insertar("p_slide_1_grafico:cobertura", { bases: [], baseActiva: null }).args).toEqual({});
  });
  it("sin bases conocidas no inventa vars; lo ya configurado no se pisa", () => {
    expect(insertar("p_slide_1_grafico:panorama", { bases: [], baseActiva: null }).args).toEqual({ regla: { tipo: "todas" } });
    const slide = { tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador: "p_panorama", args: { vars: ["docentes$p1"], regla: { tipo: "bajo_umbral", umbral: 50 } } } } };
    const c = cambioConOpcion("p_slide_1_grafico:panorama", planearCambioTipo(slide, "p_slide_1_grafico"), ESTUDIO);
    expect(c.payload.grafico).toEqual({ graficador: "p_panorama", args: { vars: ["docentes$p1"], regla: { tipo: "bajo_umbral", umbral: 50 } } });
  });
  it("la divergente del recetario borra la regla, que es del estilo resumen", () => {
    const slide = { tipo: "p_slide_1_grafico" as const, payload: { grafico: { graficador: "p_barras_divergentes", args: { estilo: "resumen", vars: ["d$*"], regla: { tipo: "bajo_umbral", umbral: 60 } } } } };
    const c = cambioConOpcion("p_slide_1_grafico:divergentes", planearCambioTipo(slide, "p_slide_1_grafico"), ESTUDIO);
    expect(c.payload.grafico).toEqual({ graficador: "p_barras_divergentes", args: { estilo: "recetario", vars: ["d$*"] } });
  });
});

describe("buscar por pregunta o tipo", () => {
  it("casa sin tildes ni mayúsculas y pide todas las palabras", () => {
    expect(casaBusqueda("publicos", ["Contraste de públicos"])).toBe(true);
    expect(casaBusqueda("ESCALA sin", ["Escala con Sin información aparte"])).toBe(true);
    expect(casaBusqueda("escala tendencia", ["Escala con Sin información aparte"])).toBe(false);
    expect(casaBusqueda("  ", ["x"])).toBe(true);
  });
});

describe("intenciones sin nombres fijos (S2)", () => {
  it("«Comparar públicos» no nombra públicos de un estudio", () => {
    const comparar = INTENCIONES_CONTAR.find((i) => i.id === "comparar")!;
    expect(comparar.ayuda).toBe("Dónde difieren los públicos.");
    expect(INTENCIONES_CONTAR.map((i) => i.ayuda).join(" ")).not.toMatch(/docentes|estudiantes/i);
  });

  it("el cierre con hallazgos declara lo que usa (S8)", () => {
    expect(tarjetaContar("p_slide_cierre_hallazgos:cierre")?.usaSinGrafico).toBe("Cifras de otras láminas de resumen del informe");
  });
});

describe("R5-2: el indicador por defecto del estudio", () => {
  const conIndicador: EstudioDelSelector = {
    bases: ["docentes", "estudiantes"], baseActiva: "docentes", indicador: { codigos: ["4", "5"], etiqueta: "Top Two Box" },
  };
  const args = (op: Parameters<typeof conOpcion>[0], e: EstudioDelSelector, previo?: Record<string, unknown>) => {
    const tipo = tipoDeOpcion(op);
    const p = conOpcion(op, previo ?? payloadPorDefecto(tipo), e);
    return (p.grafico as { args: Record<string, unknown> }).args;
  };

  it("el contraste insertado lleva el indicador del estudio (en cadena, como lo guarda p_dumbbell)", () => {
    expect(args("p_slide_1_grafico:contraste", conIndicador)).toMatchObject({ corte: "4,5", corte_etiqueta: "Top Two Box" });
    expect(indicadorPorDefecto(conIndicador)).toEqual({ corte: ["4", "5"], corte_etiqueta: "Top Two Box" });
  });

  it("sin escala en el estudio no se inventa un indicador", () => {
    expect(args("p_slide_1_grafico:contraste", { bases: ["a", "b"], baseActiva: "a" }).corte).toBeUndefined();
    expect(indicadorPorDefecto({ bases: [], baseActiva: null, indicador: null })).toEqual({});
  });

  it("no pisa el indicador ya elegido en la lámina", () => {
    const previo = { ...payloadPorDefecto("p_slide_1_grafico"), grafico: { graficador: "p_dumbbell", args: { estilo: "resumen", cruce: null, corte: "3,4,5" } } };
    expect(args("p_slide_1_grafico:contraste", conIndicador, previo).corte).toBe("3,4,5");
  });
});

describe("las recomendaciones apuntan al catálogo de gráficos (ADR 0139, decisión 3)", () => {
  const laminas = new Set(CATALOGO_LAMINAS.map((l) => l.name));

  it("cada recomendación señala un graficador o una variante que existe, y se llama como esa entrada", () => {
    for (const t of TARJETAS_CONTAR) {
      if (t.grafico) {
        expect(existeEntradaCatalogo(t.entrada), `${t.clave} → ${t.entrada}`).toBe(true);
        expect(t.grafico.graficador, t.clave).toBe(graficadorDeEntrada(t.entrada));
        expect(t.nombre, t.clave).toBe(nombreDeEntrada(t.entrada));
      } else {
        // Sin gráfico (el cierre con hallazgos): señala un tipo de lámina del catálogo.
        expect(laminas.has(t.entrada), `${t.clave} → ${t.entrada}`).toBe(true);
        expect(t.entrada).toBe(t.tipo);
      }
      expect(laminas.has(t.tipo), t.clave).toBe(true);
    }
  });

  it("cada intención nombra tarjetas que existen y los presets de lámina, tipos del catálogo", () => {
    for (const i of INTENCIONES_CONTAR) for (const k of i.tarjetas) expect(tarjetaContar(k), `${i.id} → ${k}`).not.toBeNull();
    for (const p of PRESETS_LAMINA) {
      expect(laminas.has(p.tipo), p.clave).toBe(true);
      if (p.grafico) expect(existeEntradaCatalogo(p.grafico.graficador), p.clave).toBe(true);
    }
  });

  it("una variante aplicada nace con sus args fijos y sin los que quita", () => {
    for (const v of VARIANTES_GRAFICO) {
      const t = TARJETAS_CONTAR.find((x) => x.entrada === v.id);
      if (!t?.grafico) continue;
      for (const [k, val] of Object.entries(v.args_fijos)) expect(t.grafico.args[k], `${v.id}.${k}`).toEqual(val);
      for (const k of v.args_quitar) {
        expect(k in t.grafico.args, `${v.id}.${k}`).toBe(true);
        expect(t.grafico.args[k], `${v.id}.${k}`).toBeUndefined();
      }
    }
  });

  it("el inspector y la Estructura nombran «<tipo>, versión <versión>» la variante de una lámina guardada (ronda 19)", () => {
    // Los nombres salen del catálogo (titulo_humano, nombre_version): el test no los escribe a mano.
    const conVersion = (id: string) => {
      const v = varianteGrafico(id);
      if (!v) throw new Error(`falta ${id}`);
      return `${NOMBRE_TIPO_GRAFICO[v.graficador]}, versión ${v.nombre_version ?? v.nombre}`;
    };
    expect(presentacionDeGrafico("p_dumbbell", { estilo: "resumen", cruce: null }).nombre).toBe(conVersion("p_dumbbell:contraste"));
    expect(presentacionDeGrafico("p_dumbbell", { estilo: "resumen", cruce: "base$ciclo" }).nombre).toBe(conVersion("p_dumbbell:aperturas"));
    expect(presentacionDeGrafico("p_barras_divergentes", { estilo: "resumen" }).nombre)
      .toBe(conVersion("p_barras_divergentes:escala_sin_informacion"));
    expect(presentacionDeGrafico("p_barras_divergentes", { estilo: "resumen" }).nombre).not.toContain("·");
    expect(presentacionDeGrafico("p_barras_divergentes", {}).nombre).toBe(NOMBRE_TIPO_GRAFICO.p_barras_divergentes);
  });

  it("ninguna tarjeta usa jerga interna en lo que se ve", () => {
    for (const t of TARJETAS_CONTAR) {
      for (const texto of [t.nombre, t.uso, t.descripcion, t.pide]) expect(texto, t.clave).not.toMatch(/recetario|lámina \d+/i);
    }
  });

  it("R13-7: el cierre de «Resumen del estudio» dice lo mismo que su entrada en la familia «Hallazgos»", () => {
    const cierre = tarjetaContar("p_slide_cierre_hallazgos:cierre");
    const delCatalogo = usoDeTarjeta("p_slide_cierre_hallazgos", undefined, undefined);
    expect(delCatalogo).not.toBe("");
    expect(cierre?.uso).toBe(delCatalogo);
    expect(cierre?.descripcion).toBe(delCatalogo);
  });
});
