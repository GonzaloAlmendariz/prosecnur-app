// Ítem 4 de la oleada I2: el reparto que el control dibuja tiene que ser el del motor (`.divergentes_reparto`).
import { describe, expect, it } from "vitest";
import { detalle, fila, lados } from "../cifrasInspector/fixturaDetalle.test-utils";
import { bordeVisual, kDesdeBorde, leerLados, parcheLados, repartoLados, sustantivas, textoLados, trasClicCentral, avisoDosNiveles } from "./modeloLados";

const NP = "negativo_positivo" as const;
const PN = "positivo_negativo" as const;

describe("reparto de los lados", () => {
  it("cinco niveles, dos negativas y neutro partido: el central es el neutro", () => {
    expect(repartoLados(5, { k: 2, incluirNeutro: true, direccion: NP })).toEqual(["neg", "neg", "neu", "pos", "pos"]);
  });
  it("sin partir el neutro, el central va al lado positivo; un corte fuera del medio no tiene neutro", () => {
    expect(repartoLados(5, { k: 2, incluirNeutro: false, direccion: NP })).toEqual(["neg", "neg", "pos", "pos", "pos"]);
    expect(repartoLados(5, { k: 1, incluirNeutro: true, direccion: NP })).toEqual(["neg", "pos", "pos", "pos", "pos"]);
  });
  it("positivo → negativo cuenta las negativas desde el final de la escala visible", () => {
    expect(repartoLados(4, { k: 1, incluirNeutro: true, direccion: PN })).toEqual(["pos", "pos", "pos", "neg"]);
    expect(bordeVisual(4, { k: 1, incluirNeutro: true, direccion: PN })).toBe(3);
    expect(kDesdeBorde(4, 3, PN)).toBe(1);
  });
  it("sin n_negativas, la mitad; el asa nunca deja un lado vacío", () => {
    expect(leerLados({}, 5)).toEqual({ k: 2, incluirNeutro: true, direccion: NP });
    expect(leerLados({ n_negativas: 9 }, 5).k).toBe(4);
    expect(kDesdeBorde(5, 0, NP)).toBe(1);
  });
  it("el clic en el central parte el neutro (corte al medio) o deja de partirlo", () => {
    expect(trasClicCentral(5, { k: 1, incluirNeutro: false, direccion: NP })).toEqual({ k: 2, incluirNeutro: true, direccion: NP });
    expect(trasClicCentral(5, { k: 2, incluirNeutro: true, direccion: NP }).incluirNeutro).toBe(false);
    expect(parcheLados({ k: 2, incluirNeutro: true, direccion: PN })).toEqual({ n_negativas: 2, incluir_neutro: true, direccion_escala: PN });
  });
});

describe("cifras de los lados", () => {
  const cats = [{ clave: "Malo", valor: 21, lado: "neg" as const }, { clave: "Regular", valor: 15, lado: "neu" as const },
    { clave: "Bueno", valor: 64, lado: "pos" as const }, { clave: "NS", valor: 0, lado: "sin_inf" as const, especial: true }];
  it("una pregunta: «Negativo 21%, Positivo 64%»; las sustantivas sin «Sin información»", () => {
    const d = detalle(cats, { forma: "divergentes", filas: [fila("p1", cats, { lados: lados(21, 15, 64) })] });
    expect(textoLados(d)).toBe("Negativo 21%, Positivo 64%");
    expect(sustantivas(d)).toEqual(["Malo", "Regular", "Bueno"]);
  });
  it("varias preguntas: el rango de cada lado; sin lados, nada", () => {
    const d = detalle(cats, { forma: "divergentes", filas: [fila("p1", cats, { lados: lados(21, 15, 64) }), fila("p2", cats, { lados: lados(30, 10, 50) })] });
    expect(textoLados(d)).toBe("Negativo de 21% a 30%, Positivo de 50% a 64%");
    expect(textoLados(detalle(cats))).toBeNull();
    expect(textoLados(null)).toBeNull();
  });
});

describe("R8-12: con dos respuestas se dice cuál va a cada lado hasta que el analista lo fije", () => {
  const defecto = leerLados({}, 2);
  it("sin nada guardado, «Sí» (la primera) va al negativo y se dice", () => {
    expect(avisoDosNiveles({}, ["Sí", "No"], defecto)).toBe("«Sí» va al lado negativo y «No» al positivo.");
  });
  it("con los lados fijados, o con más de dos niveles, no se dice nada", () => {
    expect(avisoDosNiveles({ n_negativas: 1 }, ["Sí", "No"], defecto)).toBeNull();
    expect(avisoDosNiveles({ direccion_escala: "positivo_negativo" }, ["Sí", "No"], defecto)).toBeNull();
    expect(avisoDosNiveles({}, ["Malo", "Regular", "Bueno"], leerLados({}, 3))).toBeNull();
  });
  it("invertido en vivo, el texto sigue lo que se ve", () => {
    expect(avisoDosNiveles({}, ["Sí", "No"], { ...defecto, direccion: "positivo_negativo" })).toBe("«No» va al lado negativo y «Sí» al positivo.");
  });
});
