// El reparto y la selección local de la regla (ADR 0135 §4): el conteo según el corte para cada tipo, como lo calcula
// `.regla_preguntas_evaluar` (graficos_regla_preguntas.R), el orden de las filas, el corte con sus empates y el tope.
import { describe, expect, it } from "vitest";
import type { CandidataRegla } from "../../../../api/graficosRegla";
import {
  alPaso, apilar, calculableLocal, desplazamientoParaFila, textoCorteEje, estadoTope, repiteElTope, fraccionCorte, fraccionEje, marcasDeCorte, ordenFilas, posicionTope, recorridoSlider, repartoRegla,
  seleccionLocal, techoRedondo, valorPorTecla,
} from "./repartoRegla";
import { enOrden, seleccionVista } from "./vistaRegla";

// En el orden del instrumento, como llegan del backend.
const cand = (pares: [string, number | null][]): CandidataRegla[] =>
  pares.map(([tema, metrica]) => ({ tema, etiqueta: tema.toUpperCase(), metrica, seleccionada: false }));

const C = cand([["p1", 14], ["p2", 20], ["p3", 6], ["p4", 52], ["p5", 20], ["p6", null], ["p7", 20], ["p8", 0]]);

describe("la selección local según el corte", () => {
  it("mayor diferencia: las n de mayor métrica; el orden del instrumento desempata", () => {
    expect(seleccionLocal({ tipo: "mayor_diferencia", n: 1 }, C)).toEqual(["p4"]);
    expect(seleccionLocal({ tipo: "mayor_diferencia", n: 3 }, C)).toEqual(["p4", "p2", "p5"]);
    expect(seleccionLocal({ tipo: "mayor_diferencia", n: 50 }, C)).toHaveLength(7);   // sin dato no entra
  });
  it("diferencia mínima: las de métrica mayor o igual al umbral", () => {
    expect(seleccionLocal({ tipo: "diferencia_minima", umbral: 20 }, C)).toEqual(["p4", "p2", "p5", "p7"]);
    expect(seleccionLocal({ tipo: "diferencia_minima", umbral: 53 }, C)).toEqual([]);
  });
  it("más Sin información: las n mayores, sólo con métrica mayor que cero", () => {
    expect(seleccionLocal({ tipo: "mayor_sin_info", n: 10 }, C)).toEqual(["p4", "p2", "p5", "p7", "p1", "p3"]);
  });
  it("bajo un umbral: las de métrica estrictamente menor, de menor a mayor", () => {
    expect(seleccionLocal({ tipo: "bajo_umbral", umbral: 20 }, C)).toEqual(["p8", "p3", "p1"]);
    expect(seleccionLocal({ tipo: "bajo_umbral", umbral: 0 }, C)).toEqual([]);
  });
  it("extremos: las n más altas y las n más bajas del resto, sin repetir", () => {
    expect(seleccionLocal({ tipo: "extremos", n: 2 }, C)).toEqual(["p4", "p2", "p3", "p8"]);
    expect(seleccionLocal({ tipo: "extremos", n: 5 }, C)).toHaveLength(7);
  });
  it("el ajuste a mano va encima: agregar al final, quitar sale; un tema desconocido no entra", () => {
    expect(seleccionLocal({ tipo: "mayor_diferencia", n: 1, agregar: ["p3", "zz"], quitar: ["p4"] }, C)).toEqual(["p3"]);
  });
  it("sin cifra no hay cálculo local (Todas, Comunes, A mano)", () => {
    expect(seleccionLocal({ tipo: "todas" }, C)).toBeNull();
    expect(calculableLocal("a_mano")).toBe(false);
    expect(calculableLocal("bajo_umbral")).toBe(true);
    expect(repartoRegla({ tipo: "comunes" }, C)).toBeNull();
  });
});

describe("el reparto", () => {
  it("por umbral: eje de valor, corte en el umbral, las que entran marcadas", () => {
    const r = repartoRegla({ tipo: "bajo_umbral", umbral: 20 }, C);
    expect(r?.modo).toBe("umbral");
    expect(r?.ejeMax).toBe(100);
    expect(r?.cortes).toEqual([20]);
    expect(r?.sinDato).toBe(1);
    expect(r?.puntos.filter((p) => p.entra).map((p) => p.tema)).toEqual(["p8", "p3", "p1"]);
    expect(fraccionCorte(r!, 20)).toBeCloseTo(0.2);
  });
  it("diferencias: el eje llega al techo redondo de la mayor (o del umbral)", () => {
    expect(repartoRegla({ tipo: "diferencia_minima", umbral: 15 }, C)?.ejeMax).toBe(60);
    expect(repartoRegla({ tipo: "diferencia_minima", umbral: 75 }, C)?.ejeMax).toBe(80);
    expect(techoRedondo(3)).toBe(10);
    expect(techoRedondo(140)).toBe(100);
  });
  it("por N: eje de puestos de mayor a menor y el corte en la posición N", () => {
    const r = repartoRegla({ tipo: "mayor_diferencia", n: 3 }, C)!;
    expect(r.modo).toBe("posicion");
    expect(r.ejeMax).toBe(7);
    expect(r.cortes).toEqual([3]);
    expect(r.cortesValor).toEqual([20]);
    expect(r.puntos.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Una celda por puesto: la barra va al centro de la suya y el corte tras el puesto N cae en N / puestos, que es
    // donde está el pulgar en N con la pista de 0 a los puestos.
    expect(fraccionEje(r, 3)).toBeCloseTo(2.5 / 7);
    expect(fraccionCorte(r, 3)).toBeCloseTo(3 / 7);
    const { pista } = recorridoSlider(r, "mayor_diferencia", { min: 1, max: 200 }, 3);
    expect((3 - pista.min) / (pista.max - pista.min)).toBeCloseTo(fraccionCorte(r, 3));
  });
  it("extremos lleva dos cortes: tras las altas y antes de las bajas", () => {
    const r = repartoRegla({ tipo: "extremos", n: 2 }, C)!;
    expect(r.cortes).toEqual([2, 5]);
    expect(r.cortesValor).toEqual([20, 6]);
  });
  it("el slider recorre el eje: el umbral hasta su techo, N hasta los puestos (extremos, la mitad)", () => {
    const campo = { min: 0, max: 100 };
    expect(recorridoSlider(repartoRegla({ tipo: "diferencia_minima", umbral: 15 }, C)!, "diferencia_minima", campo, 15))
      .toEqual({ pista: { min: 0, max: 60 }, valores: { min: 0, max: 60 } });
    expect(recorridoSlider(repartoRegla({ tipo: "mayor_diferencia", n: 3 }, C)!, "mayor_diferencia", { min: 1, max: 200 }, 3))
      .toEqual({ pista: { min: 0, max: 7 }, valores: { min: 1, max: 7 } });
    expect(recorridoSlider(repartoRegla({ tipo: "extremos", n: 2 }, C)!, "extremos", { min: 1, max: 50 }, 2))
      .toEqual({ pista: { min: 0, max: 7 }, valores: { min: 1, max: 4 } });
  });
  it("los puntos se apilan por columna", () => {
    const pila = apilar([{ tema: "a", metrica: 20, entra: true, x: 20 }, { tema: "b", metrica: 20, entra: true, x: 20 }, { tema: "c", metrica: 50, entra: false, x: 50 }], 100, 51);
    expect(pila).toEqual([{ tema: "a", columna: 10, nivel: 0 }, { tema: "b", columna: 10, nivel: 1 }, { tema: "c", columna: 25, nivel: 0 }]);
  });
});

describe("las filas en el orden de la lámina", () => {
  it("por la métrica de mayor a menor (bajo un umbral, de menor a mayor); sin dato al final", () => {
    expect(ordenFilas("mayor_diferencia", C).map((c) => c.tema)).toEqual(["p4", "p2", "p5", "p7", "p1", "p3", "p8", "p6"]);
    expect(ordenFilas("bajo_umbral", C).map((c) => c.tema)).toEqual(["p8", "p3", "p1", "p2", "p5", "p7", "p4", "p6"]);
    expect(ordenFilas("a_mano", C).map((c) => c.tema)).toEqual(C.map((c) => c.tema));
  });
  it("la línea del corte va entre las que entran por la regla y las que no; los empates en el corte se marcan", () => {
    const regla = { tipo: "mayor_diferencia" as const, n: 3 };
    const m = marcasDeCorte(regla, ordenFilas(regla.tipo, C));
    expect([...m.trasCorte]).toEqual(["p7"]);
    expect([...m.empates].sort()).toEqual(["p2", "p5", "p7"]);
    const sinEmpate = marcasDeCorte({ tipo: "mayor_diferencia", n: 4 }, ordenFilas("mayor_diferencia", C));
    expect(sinEmpate.empates.size).toBe(0);
    const ext = marcasDeCorte({ tipo: "extremos", n: 2 }, ordenFilas("extremos", C));
    expect([...ext.trasCorte]).toEqual(["p5", "p3"]);
    expect(marcasDeCorte({ tipo: "todas" }, C).trasCorte.size).toBe(0);
  });
  it("C3: el corte se ve también con ninguna o con todas", () => {
    const ninguna = marcasDeCorte({ tipo: "diferencia_minima", umbral: 90 }, ordenFilas("diferencia_minima", C));
    expect([...ninguna.trasCorte]).toEqual(["p4"]);
    const todasConSinDato = marcasDeCorte({ tipo: "mayor_diferencia", n: 50 }, ordenFilas("mayor_diferencia", C));
    expect([...todasConSinDato.trasCorte]).toEqual(["p6"]);
    const sinNulos = C.filter((c) => c.metrica !== null);
    const todas = marcasDeCorte({ tipo: "mayor_diferencia", n: 50 }, ordenFilas("mayor_diferencia", sinNulos));
    expect(todas.trasCorte.size).toBe(0);
    expect(todas.alFinal).toBe(true);
  });
});

describe("el tope de la lámina nativa", () => {
  it("se ve siempre que existe; pasa a aviso cuando la selección que se ve lo excede", () => {
    expect(estadoTope(20, 13)).toEqual({ tope: 20, excedido: false });
    expect(estadoTope(20, 20)).toEqual({ tope: 20, excedido: false });
    expect(estadoTope(20, 22)).toEqual({ tope: 20, excedido: true });
    expect(estadoTope(null, 22)).toBeNull();
    expect(estadoTope(undefined, 22)).toBeNull();
  });
  it("el aviso del motor que repite el límite se reconoce sólo para no decirlo dos veces", () => {
    expect(repiteElTope("22 preguntas bajo 60%; la lámina nativa admite 20 y la escala sale como imagen.")).toBe(true);
    expect(repiteElTope("Otro aviso.")).toBe(false);
  });
  it("la marca cae sobre la que hace el tope en el orden de la lámina, sólo si se pasa", () => {
    const r = repartoRegla({ tipo: "bajo_umbral", umbral: 21 }, C)!;   // entran p8 0, p3 6, p1 14, p2/p5/p7 20
    expect(posicionTope(r, "bajo_umbral", 2)).toBe(6);
    expect(posicionTope(r, "bajo_umbral", 6)).toBeNull();
    expect(posicionTope(repartoRegla({ tipo: "mayor_diferencia", n: 6 }, C)!, "mayor_diferencia", 4)).toBe(4);
    expect(posicionTope(repartoRegla({ tipo: "mayor_diferencia", n: 3 }, C)!, "mayor_diferencia", 4)).toBeNull();
  });
});

describe("el teclado del slider", () => {
  const l = { min: 0, max: 100, paso: 5, grande: 10 };
  it("flechas un paso, Shift el paso grande, Inicio y Fin los extremos, acotado", () => {
    expect(valorPorTecla("ArrowRight", false, 60, l)).toBe(65);
    expect(valorPorTecla("ArrowLeft", true, 60, l)).toBe(50);
    expect(valorPorTecla("PageUp", false, 95, l)).toBe(100);
    expect(valorPorTecla("Home", false, 60, l)).toBe(0);
    expect(valorPorTecla("End", false, 60, l)).toBe(100);
    expect(valorPorTecla("a", false, 60, l)).toBeNull();
  });
});

describe("el conteo optimista", () => {
  const conteo = { seleccionadas: ["p4", "p2"] };
  it("sin nada pendiente manda el backend aunque el cálculo local difiera", () => {
    const v = seleccionVista(conteo, { seleccionadas: ["p4", "p2", "p5"] }, false, {});
    expect([...v.temas]).toEqual(["p4", "p2"]);
    expect(v.proyectada).toBe(false);
  });
  it("con la cifra en movimiento, el cálculo local; un interruptor tocado va encima al instante", () => {
    const v = seleccionVista(conteo, { seleccionadas: ["p4", "p2", "p5"] }, true, { p2: false, p8: true });
    expect([...v.temas].sort()).toEqual(["p4", "p5", "p8"]);
    expect(v.proyectada).toBe(true);
    expect(enOrden(v.temas, ordenFilas("mayor_diferencia", C))).toEqual(["p4", "p5", "p8"]);
  });
  it("sin cálculo local (Todas), el interruptor se aplica sobre lo del backend", () => {
    expect([...seleccionVista(conteo, null, true, { p4: false }).temas]).toEqual(["p2"]);
  });
});

describe("R1: la pista sin paso nativo", () => {
  it("el arrastre cae en el paso y se acota a lo que admite la pista", () => {
    expect(alPaso(58.4, 5, { min: 0, max: 100 })).toBe(60);
    expect(alPaso(57.4, 5, { min: 0, max: 100 })).toBe(55);
    expect(alPaso(2.6, 1, { min: 1, max: 7 })).toBe(3);
    expect(alPaso(0.2, 1, { min: 1, max: 7 })).toBe(1);
    expect(alPaso(0.30000000000000004, 0.1, { min: 0, max: 1 })).toBe(0.3);
  });
});

describe("R2: el rótulo del corte bajo el eje", () => {
  it("lleva «en» y su unidad: no se lee como un conteo", () => {
    expect(textoCorteEje("mayor_diferencia", ["19"])).toBe("Corte en 19 pts");
    expect(textoCorteEje("mayor_sin_info", ["8.5"])).toBe("Corte en 8.5%");
    expect(textoCorteEje("extremos", ["71.2", "40.3"])).toBe("Cortes en 71.2 y 40.3");
    expect(textoCorteEje("mayor_diferencia", [])).toBe("");
  });
});

describe("R4: la lista sólo se mueve por una fila que no se ve", () => {
  const vista = { scrollTop: 100, alto: 200 };
  it("una fila visible no mueve la lista", () => {
    expect(desplazamientoParaFila({ arriba: 120, alto: 30 }, vista)).toBeNull();
  });
  it("una fila arriba o abajo de la vista la trae al borde más cercano", () => {
    expect(desplazamientoParaFila({ arriba: 40, alto: 30 }, vista)).toBe(40);
    expect(desplazamientoParaFila({ arriba: 290, alto: 30 }, vista)).toBe(120);
  });
});
