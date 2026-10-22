import { describe, expect, it } from "vitest";

import type { PerfilDeContactos, ResumenDeContactos, VariableDelPerfil } from "../../../../api/mailContactos";
import {
  alternarFiltro,
  anchoDeBarra,
  categoriasDeLaTarjeta,
  chipsDeFiltros,
  columnasDeLaLista,
  cruceVigente,
  cuadraConLaBase,
  filtrosDeControl,
  formatoPorcentaje,
  proporcion,
  quitarFiltro,
  rangoDePagina,
  tarjetasDeResumen,
  tasaDe,
  textoDelResultado,
  totalesDelCruce,
  vacioDelPerfil,
  validarEnlace,
} from "./modeloContactos";

const RESUMEN: ResumenDeContactos = {
  importados: 320, efectivos: 312, sin_correo: 3, correo_invalido: 2, repetidos: 3,
  con_enlace: 0, respondieron: null, leido_en: null,
};

const CARRERA: VariableDelPerfil = {
  key: "carrera",
  label: "Carrera",
  categorias: [
    { valor: "Derecho", n: 200, pct: null, respondieron: 50, tasa: null, con_enlace: null, otros: false },
    { valor: "Medicina", n: 100, pct: null, respondieron: null, tasa: null, con_enlace: null, otros: false },
  ],
  sin_dato: { n: 12, pct: null, respondieron: null, tasa: null },
};

describe("cifras", () => {
  it("el porcentaje sale en es-PE, con punto decimal, y sin base es «—»", () => {
    expect(formatoPorcentaje(proporcion(1, 3))).toBe("33.3%");
    expect(formatoPorcentaje(proporcion(1234, 1000))).toBe("123.4%");
    expect(formatoPorcentaje(proporcion(5, 0))).toBe("—");
  });

  it("la tasa es de quienes respondieron entre los efectivos de la categoría; sin lectura, null", () => {
    expect(tasaDe({ n: 200, respondieron: 50 })).toBe(0.25);
    expect(tasaDe({ n: 200, respondieron: null })).toBeNull();
    expect(tasaDe({ n: 0, respondieron: 0 })).toBeNull();
  });

  it("la suma por categoría, con «Sin dato», debe ser la base del corte", () => {
    expect(cuadraConLaBase(CARRERA, 312)).toBe(true);
    expect(cuadraConLaBase(CARRERA, 300)).toBe(false);
  });

  it("las barras escalan contra la categoría mayor y nunca desaparecen si hay casos", () => {
    expect(anchoDeBarra(200, 200)).toBe(100);
    expect(anchoDeBarra(1, 5000)).toBe(1);
    expect(anchoDeBarra(0, 200)).toBe(0);
  });
});

describe("categorías de una tarjeta", () => {
  const muchas: VariableDelPerfil = {
    key: "x", label: "X",
    categorias: Array.from({ length: 15 }, (_, i) => ({ valor: `c${i}`, n: i + 1, pct: null, respondieron: null, tasa: null, con_enlace: null, otros: false })),
    sin_dato: { n: 0, pct: null, respondieron: null, tasa: null },
  };

  it("con más de doce, se ven las doce más frecuentes en el orden del backend", () => {
    const { visibles, ocultas, maximo } = categoriasDeLaTarjeta(muchas, false);
    expect(visibles).toHaveLength(12);
    expect(ocultas).toBe(3);
    expect(visibles[0].valor).toBe("c3");
    expect(maximo).toBe(15);
  });

  it("expandida, se ven todas", () => {
    expect(categoriasDeLaTarjeta(muchas, true).ocultas).toBe(0);
  });
});

describe("filtros", () => {
  it("un clic agrega la categoría y otro la quita; una columna vacía desaparece", () => {
    let f = alternarFiltro({}, "carrera", "Derecho");
    f = alternarFiltro(f, "carrera", "Medicina");
    expect(f).toEqual({ carrera: ["Derecho", "Medicina"] });
    f = alternarFiltro(f, "carrera", "Derecho");
    expect(f).toEqual({ carrera: ["Medicina"] });
    expect(quitarFiltro(f, "carrera", "Medicina")).toEqual({});
  });

  it("el valor vacío es «Sin dato» en el chip", () => {
    expect(chipsDeFiltros({ sede: [""] }, { sede: "Sede" })[0].rotulo).toBe("Sede: Sin dato");
  });

  it("los chips dicen la columna con su nombre humano", () => {
    expect(chipsDeFiltros({ carrera: ["Derecho"] }, { carrera: "Carrera" })).toEqual([
      { columna: "carrera", valor: "Derecho", etiqueta: "Carrera", rotulo: "Carrera: Derecho" },
    ]);
  });

  it("al cambiar las variables de control se sueltan los filtros de columnas que ya no lo son", () => {
    expect(filtrosDeControl({ carrera: ["Derecho"], sede: ["Lima"] }, ["sede"])).toEqual({ sede: ["Lima"] });
  });
});

describe("cruce", () => {
  it("el par pedido sigue si sigue siendo válido; si no, las dos primeras", () => {
    expect(cruceVigente(["a"], null)).toBeNull();
    expect(cruceVigente(["a", "b", "c"], ["c", "a"])).toEqual(["c", "a"]);
    expect(cruceVigente(["a", "b", "c"], ["z", "a"])).toEqual(["a", "b"]);
    expect(cruceVigente(["a", "b"], ["a", "a"])).toEqual(["a", "b"]);
  });

  it("los totales cuadran por fila, por columna y en general", () => {
    expect(totalesDelCruce({ a: "a", b: "b", filas: ["x", "y"], columnas: ["F", "M"], celdas: [[1, 2], [3, 4]] }))
      .toEqual({ porFila: [3, 7], porColumna: [4, 6], total: 10 });
  });
});

describe("resumen", () => {
  it("cinco tarjetas; «Respondieron» dice que aún no se lee en vez de un cero", () => {
    const tarjetas = tarjetasDeResumen(RESUMEN, false);
    expect(tarjetas.map((t) => t.id)).toEqual(["importados", "efectivos", "fuera", "enlace", "respondieron"]);
    expect(tarjetas[1].detalle).toBe("97.5% de 320 importados");
    expect(tarjetas[2]).toMatchObject({ valor: "8", detalle: "3 sin correo · 2 con correo inválido · 3 repetidos", tono: "aviso" });
    expect(tarjetas[3].detalle).toBe("Todavía sin enlaces");
    expect(tarjetas[4]).toMatchObject({ valor: "—", detalle: "Aún no se lee quién respondió" });
  });

  it("con respuestas leídas, la tasa va con su base", () => {
    const t = tarjetasDeResumen({ ...RESUMEN, respondieron: 78, con_enlace: 312 }, true);
    expect(t[4].valor).toBe("78");
    expect(t[4].detalle).toBe("25% de 312 efectivos");
    expect(t[3].tono).toBe("exito");
  });

  it("los millares llevan coma", () => {
    expect(tarjetasDeResumen({ ...RESUMEN, importados: 5000, efectivos: 4890 }, false)[0].valor).toBe("5,000");
  });
});

describe("lista", () => {
  const columnas = [
    { key: "email", label: "Correo" }, { key: "sede", label: "Sede" },
    { key: "carrera", label: "Carrera" }, { key: "anio", label: "Año" },
  ];

  it("las columnas de control van primero, en su orden; el resto solo si se pide", () => {
    expect(columnasDeLaLista(columnas, ["carrera", "sede"], false).map((c) => c.key)).toEqual(["carrera", "sede"]);
    expect(columnasDeLaLista(columnas, ["carrera"], true).map((c) => c.key)).toEqual(["carrera", "sede", "anio"]);
  });

  it("el rango de la página", () => {
    expect(rangoDePagina(2, 50, 312)).toBe("51–100 de 312");
    expect(rangoDePagina(7, 50, 312)).toBe("301–312 de 312");
    expect(rangoDePagina(1, 50, 0)).toBe("0 de 0");
  });
});

describe("enlace a la encuesta", () => {
  it("pide https y una dirección completa, sin jerga", () => {
    expect(validarEnlace("")).toMatchObject({ ok: false });
    expect(validarEnlace("http://es.surveymonkey.com/r/ABC")).toMatchObject({ ok: false });
    expect(validarEnlace("https://localhost/r")).toMatchObject({ ok: false });
    expect(validarEnlace("  https://es.surveymonkey.com/r/ABC  ")).toEqual({ ok: true, url: "https://es.surveymonkey.com/r/ABC" });
    const motivo = validarEnlace("ftp://x").ok ? "" : (validarEnlace("ftp://x") as { motivo: string }).motivo;
    expect(motivo).not.toMatch(/token|t=|custom|variable/i);
  });

  it("el resultado dice cuántos, cuántos nuevos y cuántos se conservaron", () => {
    expect(textoDelResultado({ generados: 5, conservados: 307, total: 312, campo: "enlace_encuesta", url: "", aviso: null, mapeado: [] }))
      .toBe("Listo: 312 enlaces (5 nuevos, 307 conservados)");
    expect(textoDelResultado({ generados: 1, conservados: 0, total: 1, campo: "enlace_encuesta", url: "", aviso: null, mapeado: [] }))
      .toBe("Listo: 1 enlace (1 nuevo, 0 conservados)");
  });
});

describe("vacíos", () => {
  const perfil = (p: Partial<PerfilDeContactos>): PerfilDeContactos => ({
    cargados: true, base: 312, control: ["carrera"], candidatas: [], variables: [], cruce: null, respuestas_leidas: false, ...p,
  });

  it("cada vacío tiene su causa", () => {
    expect(vacioDelPerfil({ ...RESUMEN, importados: 0, efectivos: 0 }, null, false)).toBe("sin-contactos");
    expect(vacioDelPerfil({ ...RESUMEN, efectivos: 0 }, null, false)).toBe("sin-efectivos");
    expect(vacioDelPerfil(RESUMEN, perfil({ control: [] }), false)).toBe("sin-candidatas");
    expect(vacioDelPerfil(RESUMEN, perfil({ control: [], candidatas: [{ key: "c", label: "C", distintos: 3, tipo: "categorica" }] }), false))
      .toBe("sin-variables");
    expect(vacioDelPerfil(RESUMEN, perfil({ base: 0 }), true)).toBe("sin-base");
    expect(vacioDelPerfil(RESUMEN, perfil({}), false)).toBeNull();
    expect(vacioDelPerfil(RESUMEN, perfil({}), false, false)).toBe("sin-contactos");
    expect(vacioDelPerfil(null, perfil({ cargados: false }), false)).toBe("sin-contactos");
  });
});
