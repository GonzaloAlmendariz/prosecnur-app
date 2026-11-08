// Diferencias por palabra de la evidencia del par (X6).
import { describe, expect, it } from "vitest";
import { diffPorPalabra, type Trozo } from "./diffPalabras";

const marcadas = (t: readonly Trozo[]) => t.filter((x) => x.distinto).map((x) => x.texto);
const texto = (t: readonly Trozo[]) => t.map((x) => x.texto).join("");

describe("diffPorPalabra", () => {
  it("textos iguales: nada marcado y el texto intacto", () => {
    const d = diffPorPalabra("Servicio de salud", "Servicio de salud");
    expect(marcadas(d.a)).toEqual([]);
    expect(marcadas(d.b)).toEqual([]);
    expect(d.a).toEqual([{ texto: "Servicio de salud", distinto: false }]);
  });

  it("compara normalizado: tildes, mayúsculas y signos no cuentan como diferencia", () => {
    const d = diffPorPalabra("¿Cómo calificas la atención?", "como calificas la ATENCION");
    expect(marcadas(d.a)).toEqual([]);
    expect(marcadas(d.b)).toEqual([]);
  });

  it("marca en cada lado lo que no está en el otro y conserva el texto completo", () => {
    const a = "Los docentes se desempeñan eficazmente";
    const b = "Estoy satisfecho(a) con el liderazgo de los docentes";
    const d = diffPorPalabra(a, b);
    expect(texto(d.a)).toBe(a);
    expect(texto(d.b)).toBe(b);
    expect(marcadas(d.a)).toEqual(["se desempeñan eficazmente"]);
    expect(marcadas(d.b)).toEqual(["Estoy satisfecho(a) con el liderazgo de"]);
  });

  it("las palabras vacías también se marcan: la evidencia muestra todo lo que cambia", () => {
    const d = diffPorPalabra("Calidad del servicio", "Calidad de los servicios");
    expect(marcadas(d.a)).toEqual(["del servicio"]);
    expect(marcadas(d.b)).toEqual(["de los servicios"]);
  });

  it("un cambio en medio deja marcada sólo esa palabra", () => {
    const d = diffPorPalabra("La biblioteca atiende bien", "La cafetería atiende bien");
    expect(d.a).toEqual([
      { texto: "La ", distinto: false },
      { texto: "biblioteca", distinto: true },
      { texto: " atiende bien", distinto: false },
    ]);
  });

  it("un lado vacío marca entero al otro", () => {
    const d = diffPorPalabra("", "Texto nuevo");
    expect(d.a).toEqual([]);
    expect(marcadas(d.b)).toEqual(["Texto nuevo"]);
  });
});
