// Mata: tarjetas ofrecidas en una lámina con cruce (el motor las rechaza), apagar que borra los rótulos cortos del
// estudio, `activo: false` leído como encendido, una ranura que pisa la otra, y editar un ajuste que borra los demás.
import { describe, expect, it } from "vitest";
import type { SlideMeta } from "../../slideMeta";
import {
  admiteEnLinea,
  admiteTarjetas,
  dondeTarjetas,
  modoAGuardar,
  avisoCorto,
  cortosAFilas,
  filasACortos,
  leerTarjetas,
  maxAGuardar,
  maxEfectivo,
  metaConTarjetas,
  mismosCortos,
  opcionActiva,
  opcionAlternada,
  opcionCon,
  opcionesMax,
  ranuraDeTarjetas,
  rotuloDeCruce,
  rotulosCon,
  tarjetasActivas,
  tarjetasAlternadas,
} from "./modeloTarjetas";

// La opción real del mazo de referencia (CCSS, lámina 31).
const MAZO = {
  activo: true,
  publico: "estudiantes",
  cruces: ["area", "nivel_curricular", "sexo_marco", "primera_gen"],
  rotulos: { area: "Área", nivel_curricular: "Nivel", sexo_marco: "Sexo", primera_gen: "Estudios de padres" },
  cortos: { "Economía y Finanzas": "Econ. y Finanzas" },
  modo: "en_linea",
};

describe("tarjetas de diferencias (ADR 0129)", () => {
  it("una lámina de un gráfico o una ranura de la de dos, de categorías o escala, sin cruce", () => {
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_agrupadas", "")).toBe(true);
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_multiapiladas", "")).toBe(true);
    expect(admiteTarjetas("p_slide_1_grafico", "p_barras_agrupadas", "default$area")).toBe(false);
    expect(admiteTarjetas("p_slide_1_grafico", "p_histograma", "")).toBe(false);
    // U2: en la lámina de dos gráficos cada ranura las suyas; las de texto no.
    expect(admiteTarjetas("p_slide_2_graficos", "p_barras_agrupadas", "", "izquierda")).toBe(true);
    expect(admiteTarjetas("p_slide_2_graficos", "p_barras_apiladas", "", "derecha")).toBe(true);
    expect(admiteTarjetas("p_slide_2_graficos", "p_barras_agrupadas", "area", "derecha")).toBe(false);
    expect(admiteTarjetas("p_slide_2_graficos_texto_derecha", "p_barras_agrupadas", "", "grafico_1")).toBe(false);
    expect(ranuraDeTarjetas("p_slide_2_graficos", "derecha")).toBe("derecha");
    expect(ranuraDeTarjetas("p_slide_1_grafico", "grafico")).toBeNull();
  });

  it("lee encendido con `true` o con una opción sin `activo: false`", () => {
    expect(tarjetasActivas({})).toBe(false);
    expect(tarjetasActivas({ tarjetas_diferencias: true })).toBe(true);
    expect(tarjetasActivas({ tarjetas_diferencias: { cortos: { a: "b" } } })).toBe(true);
    expect(tarjetasActivas({ tarjetas_diferencias: { activo: false, max: 4 } })).toBe(false);
    expect(tarjetasActivas({ tarjetas_diferencias: false })).toBe(false);
  });

  it("apagar conserva la opción declarada y volver a encender la recupera", () => {
    const meta = { tarjetas_diferencias: { activo: true, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } } };
    const apagada = tarjetasAlternadas(meta, false);
    expect(apagada).toEqual({ activo: false, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } });
    expect(tarjetasAlternadas({ tarjetas_diferencias: apagada }, true)).toEqual({ activo: true, cortos: { "Economía y Finanzas": "Econ. y Finanzas" } });
    expect(tarjetasAlternadas({}, true)).toBe(true);
    expect(tarjetasAlternadas({ tarjetas_diferencias: true }, false)).toBeUndefined();
  });
});

describe("U1: cómo salen las tarjetas", () => {
  it("editar un ajuste conserva los demás (también `modo`, que el inspector no edita) y deja las tarjetas encendidas", () => {
    expect(opcionCon(MAZO, { publico: "alumnos" })).toEqual({ ...MAZO, publico: "alumnos" });
    expect(opcionCon(true, { cruces: ["area"] })).toEqual({ activo: true, cruces: ["area"] });
    // Vacío borra la clave para que mande el motor.
    const { publico: _p, ...sinPublico } = MAZO;
    expect(opcionCon(MAZO, { publico: "  " })).toEqual(sinPublico);
    const { cruces: _c, ...sinCruces } = MAZO;
    expect(opcionCon(MAZO, { cruces: [] })).toEqual(sinCruces);
    const { cortos: _k, ...sinCortos } = MAZO;
    expect(opcionCon(MAZO, { cortos: {} })).toEqual(sinCortos);
    // El texto se guarda como se escribe: el espacio entre palabras no se pierde a media escritura.
    expect(opcionCon(MAZO, { publico: "personas " }).publico).toBe("personas ");
  });

  it("el nombre de cada cruce se guarda por su variable sin base, y los demás nombres no se tocan", () => {
    expect(rotuloDeCruce(MAZO, "estudiantes$area")).toBe("Área");
    expect(rotuloDeCruce(MAZO, "facultad")).toBe("");
    expect(rotulosCon(MAZO, "estudiantes$area", "Áreas")).toEqual({ ...MAZO.rotulos, area: "Áreas" });
    const { sexo_marco: _s, ...sinSexo } = MAZO.rotulos;
    expect(rotulosCon(MAZO, "sexo_marco", "")).toEqual(sinSexo);
  });

  it("el tope: 4 por defecto, de 1 a 9 como el motor; el de fábrica no se guarda", () => {
    expect(maxEfectivo(MAZO, null)).toBe(4);
    expect(maxEfectivo({ max: 6 }, null)).toBe(6);
    expect(maxEfectivo({ max: 20 }, null)).toBe(9);
    expect(maxEfectivo({ max: 0 }, null)).toBe(4);
    expect(maxEfectivo(true, null)).toBe(4);
    expect(opcionesMax(null)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(maxAGuardar(4, null)).toBeUndefined();
    expect(maxAGuardar(3, null)).toBe(3);
  });

  it("rótulos cortos: sólo las filas completas se guardan; una fila a medias no borra lo guardado", () => {
    const filas = cortosAFilas(MAZO);
    expect(filas).toEqual([{ clave: "c0", grupo: "Economía y Finanzas", corto: "Econ. y Finanzas" }]);
    const conNueva = [...filas, { clave: "n1", grupo: "Ciencias e Ingeniería", corto: "" }];
    expect(filasACortos(conNueva)).toEqual(MAZO.cortos);
    expect(mismosCortos(MAZO, conNueva)).toBe(true);
    expect(avisoCorto(conNueva[1], conNueva)).toBe("Falta el rótulo corto: no se usa.");
    const repetida = [...filas, { clave: "n2", grupo: "Economía y Finanzas", corto: "Eco." }];
    expect(filasACortos(repetida)).toEqual(MAZO.cortos);
    expect(avisoCorto(repetida[1], repetida)).toBe("Ese grupo ya tiene rótulo corto: no se usa.");
    expect(avisoCorto(filas[0], filas)).toBeNull();
  });
});

describe("U2: tarjetas por ranura en la lámina de dos gráficos", () => {
  const meta: SlideMeta = { antetitulo: "Uso", tarjetas_diferencias: { izquierda: { publico: "estudiantes" }, derecha: true } };

  it("cada ranura lee la suya; la opción de una lámina de un gráfico no vale como la de una ranura, ni al revés", () => {
    expect(leerTarjetas(meta, "izquierda")).toEqual({ publico: "estudiantes" });
    expect(leerTarjetas(meta, "derecha")).toBe(true);
    expect(leerTarjetas(meta, null)).toBeUndefined();
    expect(leerTarjetas({ tarjetas_diferencias: MAZO }, "izquierda")).toBeUndefined();
    expect(leerTarjetas({ tarjetas_diferencias: MAZO }, null)).toEqual(MAZO);
  });

  it("escribir una ranura no toca la otra ni el resto de la meta; vaciar las dos borra la clave", () => {
    const m1 = metaConTarjetas(meta, "derecha", opcionCon(leerTarjetas(meta, "derecha"), { max: 1 }));
    expect(m1).toEqual({ antetitulo: "Uso", tarjetas_diferencias: { izquierda: { publico: "estudiantes" }, derecha: { activo: true, max: 1 } } });
    const m2 = metaConTarjetas(m1, "izquierda", opcionAlternada(leerTarjetas(m1, "izquierda"), false));
    expect(m2.tarjetas_diferencias).toEqual({ izquierda: { publico: "estudiantes", activo: false }, derecha: { activo: true, max: 1 } });
    expect(opcionActiva(leerTarjetas(m2, "izquierda"))).toBe(false);
    const m3 = metaConTarjetas(metaConTarjetas({ tarjetas_diferencias: { derecha: true } }, "derecha", undefined), "izquierda", undefined);
    expect(m3).toEqual({});
  });

  it("el tope de una ranura es 2 (van debajo de su gráfico) y el de fábrica no se guarda", () => {
    expect(maxEfectivo(true, "izquierda")).toBe(2);
    expect(maxEfectivo({ max: 1 }, "izquierda")).toBe(1);
    expect(maxEfectivo({ max: 6 }, "derecha")).toBe(2);
    expect(opcionesMax("izquierda")).toEqual([1, 2]);
    expect(maxAGuardar(2, "izquierda")).toBeUndefined();
    expect(maxAGuardar(1, "izquierda")).toBe(1);
  });
});

describe("dónde van las tarjetas (U13, `modo`)", () => {
  it("«Bajo cada barra» sólo en la agrupada de una lámina de un gráfico (`.tarjetas_en_linea_aplica`)", () => {
    expect(admiteEnLinea("p_barras_agrupadas", null)).toBe(true);
    expect(admiteEnLinea("p_barras_agrupadas", "izquierda")).toBe(false);
    expect(admiteEnLinea("p_barras_multiapiladas", null)).toBe(false);
    expect(admiteEnLinea("p_barras_apiladas", null)).toBe(false);
  });
  it("lee como el motor: sólo «en_linea» es bajo cada barra; el panel se guarda sin clave y conserva lo demás", () => {
    expect(dondeTarjetas({ modo: "en_linea" })).toBe("en_linea");
    expect(dondeTarjetas({ modo: "otro" })).toBe("panel");
    expect(dondeTarjetas(true)).toBe("panel");
    const v = { activo: true, cruces: ["e$area"], modo: "en_linea" };
    expect(opcionCon(v, { modo: modoAGuardar("panel") })).toEqual({ activo: true, cruces: ["e$area"] });
    expect(opcionCon(true, { modo: modoAGuardar("en_linea") })).toEqual({ activo: true, modo: "en_linea" });
  });
});
