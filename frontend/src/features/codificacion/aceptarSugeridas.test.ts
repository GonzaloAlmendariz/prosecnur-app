import { describe, expect, it } from "vitest";
import { aceptarSugeridas, sugeridasPorAceptar, type EntradaSugerida } from "./sugerenciasModulo";

const prop = (codigo: string, etiqueta: string) => ({ codigo, seccion: "s", etiqueta, puntaje: 1, palabras: [] });
const entrada = (clave: string, codigo: string, etiqueta: string): EntradaSugerida => ({
  clave, casos: [{ idCaso: `c-${clave}`, texto: clave }], propuestas: [prop(codigo, etiqueta)], candidatoOtro: false,
});

describe("aceptar las sugeridas de golpe", () => {
  it("confirma la primera propuesta de cada respuesta sin código, agrupada por módulo", () => {
    const mapa = new Map([
      ["colas", entrada("colas", "20", "Tiempos de espera")],
      ["trato", entrada("trato", "10", "Trato")],
      ["ya", entrada("ya", "10", "Trato")],
    ]);
    const grupos = [{ id: "g", codigo: "1", etiqueta: "Otro", respuestas: ["ya"] }];
    const pendientes = sugeridasPorAceptar(mapa, grupos);
    expect(pendientes.map((e) => e.clave)).toEqual(["colas", "trato"]);
    const r = aceptarSugeridas(grupos, pendientes);
    expect(Object.fromEntries(r.map((g) => [g.codigo, g.respuestas]))).toEqual({ "1": ["ya"], "20": ["colas"], "10": ["trato"] });
  });
});

describe("propuestas con una sola palabra en común", () => {
  it("no se ofrecen: la respuesta pasa a candidata a Otro", async () => {
    const { conEvidenciaSuficiente } = await import("./sugerenciasModulo");
    const sug = {
      variable: "v", base: "", requiereConfirmacion: true as const, modulos: [], otro: { codigo: "80", etiqueta: "Otro" },
      respuestas: [
        { idCaso: "1", fila: 1, texto: "tuve que esperar", noRespuesta: false, candidatoOtro: false, propuestas: [{ ...prop("50", "Información y Retroalimentación"), palabras: ["tuve"] }] },
        { idCaso: "2", fila: 2, texto: "colas largas en caja", noRespuesta: false, candidatoOtro: false, propuestas: [{ ...prop("20", "Tiempos"), palabras: ["colas", "caja"] }] },
      ],
      resumen: { escribieron: 2, conContenido: 2, conPropuesta: 2, candidatosOtro: 0, porModulo: {} },
    };
    const r = conEvidenciaSuficiente(sug);
    expect(r.respuestas.map((x) => x.propuestas.length)).toEqual([0, 1]);
    expect(r.respuestas[0].candidatoOtro).toBe(true);
  });
});
