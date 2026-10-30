import { describe, expect, it } from "vitest";
import { conteoPor, dibujarFlujo, esSinRespuesta, flujoDeRespuestas, normalizarFlujo, rotuloDeResultado } from "./flujoDeCruce";

// Los 26 enlaces del flujo de Contabilidad (corte 23/07/26).
const FLUJO = [
  ["Completa", "Incluido en avance", 418], ["Ficha QR", "Completa", 178], ["En base", "Ficha QR", 177], ["En base", "Correo", 164],
  ["En base", "Telefónico", 121], ["Telefónico", "Completa", 117], ["Correo", "Sin respuesta", 90], ["Sin respuesta", "Pendiente de respuesta", 90],
  ["Correo", "Completa", 72], ["Enlace personalizado", "Completa", 64], ["En base", "Enlace personalizado", 57], ["Fuera de base", "Enlace personalizado", 16],
  ["Fuera de base", "Ficha QR", 15], ["Completa", "Excluido del avance", 13], ["Parcial", "Excluido del avance", 13], ["Ficha QR", "Parcial", 9],
  ["Parcial", "Incluido en avance", 8], ["Enlace personalizado", "Parcial", 7], ["Rechazo", "Excluido del avance", 6], ["Ficha QR", "Rechazo", 5],
  ["Telefónico", "Parcial", 4], ["Rechazo", "Incluido en avance", 3], ["Correo", "Rechazo", 2], ["Enlace personalizado", "Rechazo", 2],
  ["Correo", "Parcial", 1], ["Fuera de base", "Correo", 1],
].map(([source, target, value]) => ({ source: String(source), target: String(target), value: Number(value) }));

describe("flujo de Control › Cruce", () => {
  it("re-rotula el resultado según de dónde viene (H4)", () => {
    expect(rotuloDeResultado("Completa", "Incluido en avance")).toBe("Efectiva");
    expect(rotuloDeResultado("Parcial", "Incluido en avance")).toBe("En el universo, no cuenta");
    const { enlaces, columna } = normalizarFlujo(FLUJO);
    const resultado = (nombre: string) => enlaces.filter((enlace) => enlace.target === nombre).reduce((suma, enlace) => suma + enlace.value, 0);
    expect([resultado("Efectiva"), resultado("En el universo, no cuenta"), resultado("Excluida del avance"), resultado("Pendiente de respuesta")]).toEqual([418, 11, 32, 90]);
    expect(columna.get("Ficha QR")).toBe("canal");
    expect(columna.get("Efectiva")).toBe("resultado");
  });

  it("ubica cuatro columnas y conserva los 551 registros", () => {
    const { nodos, registros, cintas } = dibujarFlujo(FLUJO, 900, 600);
    expect(registros).toBe(551);
    expect([...new Set(nodos.map((nodo) => nodo.columna))]).toEqual(["origen", "canal", "plataforma", "resultado"]);
    expect(nodos.find((nodo) => nodo.nombre === "Completa")?.valor).toBe(431);
    // Ningún nodo sale del lienzo.
    expect(Math.max(...nodos.map((nodo) => nodo.y + nodo.alto))).toBeLessThanOrEqual(600.5);
    expect(cintas.every((cinta) => cinta.d.startsWith("M"))).toBe(true);
  });

  it("cuenta por rótulo de mayor a menor", () => {
    expect(conteoPor([{ l: "Enlace usado" }, { l: "Código PUCP declarado" }, { l: "Código PUCP declarado" }, { l: "" }], (fila) => fila.l))
      .toEqual([{ rotulo: "Código PUCP declarado", casos: 2 }, { rotulo: "Enlace usado", casos: 1 }]);
  });
});

describe("flujo de las respuestas (sin el padrón pendiente)", () => {
  it("quita la cinta «Sin respuesta» y la descuenta de «En base → canal»", () => {
    const { enlaces, sinRespuesta } = flujoDeRespuestas(FLUJO);
    expect(sinRespuesta).toBe(90);
    expect(enlaces.some((enlace) => enlace.source === "Sin respuesta" || enlace.target === "Sin respuesta")).toBe(false);
    expect(enlaces.find((enlace) => enlace.source === "En base" && enlace.target === "Correo")?.value).toBe(164 - 90);
    // Las respuestas se conservan: 551 registros menos los 90 que no respondieron.
    expect(dibujarFlujo(enlaces, 900, 600).registros).toBe(551 - 90);
    expect(dibujarFlujo(enlaces, 900, 600).nodos.find((nodo) => nodo.nombre === "Completa")?.valor).toBe(431);
  });

  it("un canal donde nadie respondió desaparece del origen", () => {
    const { enlaces } = flujoDeRespuestas([
      { source: "En base", target: "Correo", value: 5 }, { source: "Correo", target: "Sin respuesta", value: 5 },
      { source: "Sin respuesta", target: "Pendiente de respuesta", value: 5 },
    ]);
    expect(enlaces).toEqual([]);
  });

  it("reconoce al padrón pendiente por estado o por identidad", () => {
    expect(esSinRespuesta({ platform_state: "Sin respuesta" })).toBe(true);
    expect(esSinRespuesta({ identity_status: "pendiente_base" })).toBe(true);
    expect(esSinRespuesta({ platform_state: "Completa" })).toBe(false);
  });
});
