// TXT-3 en la mesa de codificación: la sugerencia se ve como propuesta, dice por qué y se confirma a mano.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CodifSugerenciasSeccion, Grupo } from "../../api/codificacion";
import { SugerenciaModuloFila } from "./SugerenciaModuloFila";
import { SugerenciasModuloBanda } from "./SugerenciasModuloBanda";
import type { EntradaSugerida } from "./sugerenciasModulo";

const B = { codigo: "20", seccion: "modulo_b", etiqueta: "MÓDULO B. EXPERIENCIA UNIVERSITARIA", puntaje: 3.1, palabras: ["biblioteca", "espacios"] };
const A = { codigo: "10", seccion: "modulo_a", etiqueta: "MÓDULO A. INFORMACIÓN GENERAL", puntaje: 1.2, palabras: ["familia"] };
const entrada = (clave: string, propuestas = [B], candidatoOtro = false): EntradaSugerida =>
  ({ clave, casos: [{ idCaso: "1", texto: clave }], propuestas, candidatoOtro });
const noop = () => undefined;

describe("SugerenciaModuloFila", () => {
  it("una no respuesta no pinta nada", () => {
    expect(renderToStaticMarkup(createElement(SugerenciaModuloFila, { entrada: undefined, grupos: [], onConfirmar: noop, onQuitar: noop }))).toBe("");
  });

  it("sin vocabulario en común dice «Sin módulo claro», sin botón", () => {
    const html = renderToStaticMarkup(createElement(SugerenciaModuloFila, { entrada: entrada("gracias", [], true), grupos: [], onConfirmar: noop, onQuitar: noop }));
    expect(html).toContain("Sin módulo claro");
    expect(html).not.toContain("<button");
  });

  it("cada módulo es un chip que se confirma, con el porqué accesible; multicode muestra los dos", () => {
    const html = renderToStaticMarkup(createElement(SugerenciaModuloFila, { entrada: entrada("x", [B, A]), grupos: [], onConfirmar: noop, onQuitar: noop }));
    expect(html).toContain("B · Experiencia universitaria");
    expect(html).toContain("A · Información general");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Confirmar B · Experiencia universitaria para esta respuesta");
    expect(html).toContain("Coincide en: biblioteca, espacios");
    expect(html).toContain("aria-describedby=");
  });

  it("confirmada, el chip queda presionado y ofrece quitarla", () => {
    const grupos: Grupo[] = [{ id: "mod_20", codigo: "20", etiqueta: "B. Experiencia universitaria", respuestas: ["x"], origen: "nuevo" }];
    const html = renderToStaticMarkup(createElement(SugerenciaModuloFila, { entrada: entrada("x"), grupos, onConfirmar: noop, onQuitar: noop }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Quitar B · Experiencia universitaria de esta respuesta");
  });
});

describe("SugerenciasModuloBanda", () => {
  const datos: CodifSugerenciasSeccion = {
    variable: "coment", base: "", requiereConfirmacion: true,
    modulos: [{ codigo: "10", seccion: "modulo_a", etiqueta: A.etiqueta, nTerminos: 1 }, { codigo: "20", seccion: "modulo_b", etiqueta: B.etiqueta, nTerminos: 1 },
      { codigo: "30", seccion: "modulo_c", etiqueta: "MÓDULO C. GOBIERNO", nTerminos: 1 }],
    otro: { codigo: "80", etiqueta: "Otro" }, respuestas: [],
    resumen: { escribieron: 0, conContenido: 0, conPropuesta: 0, candidatosOtro: 0, porModulo: {} },
  };
  const mapa = new Map([["x", entrada("x", [B, A])], ["y", entrada("y")], ["z", entrada("z", [], true)]]);

  it("dice que es una propuesta, cuenta por módulo y ofrece confirmar módulo por módulo (no todo de una)", () => {
    const html = renderToStaticMarkup(createElement(SugerenciasModuloBanda, { datos, mapa, grupos: [], ultima: null, onConfirmarModulo: noop, onDeshacer: noop }));
    expect(html).toContain("Es una propuesta");
    expect(html).toContain("Confirmar las 2 respuestas sugeridas para B · Experiencia universitaria");
    expect(html).toContain("Confirmar la respuesta sugerida para A · Información general");
    expect(html).not.toContain("C · Gobierno");
    expect(html).toContain("Sin módulo claro");
    expect(html).not.toMatch(/Confirmar todo/i);
    expect(html).not.toContain("Deshacer");
  });

  it("tras confirmar un módulo, ofrece deshacer", () => {
    const html = renderToStaticMarkup(createElement(SugerenciasModuloBanda, { datos, mapa, grupos: [], ultima: { modulo: "B · Experiencia universitaria", n: 2 }, onConfirmarModulo: noop, onDeshacer: noop }));
    expect(html).toContain("Se confirmaron 2 respuestas en B · Experiencia universitaria.");
    expect(html).toContain("Deshacer");
  });
});

// TXT-17: los subtemas de un módulo partido van agrupados bajo su módulo, con rótulo corto y el enunciado en el tooltip.
describe("SugerenciasModuloBanda: subtemas", () => {
  const RED = "¿Con qué frecuencia utilizas las siguientes redes sociales y plataformas digitales?";
  const REC = "¿Cómo valoras los recursos que ofrece la Facultad?";
  const PADRE = "MÓDULO B. EXPERIENCIA UNIVERSITARIA";
  const datos: CodifSugerenciasSeccion = {
    variable: "coment", base: "", requiereConfirmacion: true,
    modulos: [
      { codigo: "10", seccion: "modulo_a", etiqueta: A.etiqueta, nTerminos: 1 },
      { codigo: "20", seccion: "modulo_b", etiqueta: PADRE, nTerminos: 1 },
      { codigo: "22", seccion: "redes", etiqueta: RED, nTerminos: 1, padre: "20", padreEtiqueta: PADRE },
      { codigo: "25", seccion: "recursos", etiqueta: REC, nTerminos: 1, padre: "20", padreEtiqueta: PADRE },
    ],
    otro: { codigo: "80", etiqueta: "Otro" }, respuestas: [],
    resumen: { escribieron: 0, conContenido: 0, conPropuesta: 0, candidatosOtro: 0, porModulo: {} },
  };
  const pRed = { codigo: "22", seccion: "redes", etiqueta: RED, padre: "20", padreEtiqueta: PADRE, puntaje: 2, palabras: ["redes"] };
  const pRec = { codigo: "25", seccion: "recursos", etiqueta: REC, padre: "20", padreEtiqueta: PADRE, puntaje: 2, palabras: ["recursos"] };
  const mapa = new Map([["x", entrada("x", [pRed])], ["y", entrada("y", [pRec])], ["z", entrada("z", [pRec, A])]]);
  const html = renderToStaticMarkup(createElement(SugerenciasModuloBanda, { datos, mapa, grupos: [], ultima: null, onConfirmarModulo: noop, onDeshacer: noop }));

  it("el módulo partido encabeza su grupo con el total, y sus subtemas van dentro con rótulo corto", () => {
    expect(html).toContain("B · Experiencia universitaria");
    expect(html).toMatch(/aria-label="Subtemas de B · Experiencia universitaria"/);
    expect(html).toContain(">Redes sociales y plataformas<");
    expect(html).toContain(">Recursos de la Facultad<");
    expect(html).toContain("Confirmar las 2 respuestas sugeridas para B · Recursos de la Facultad");
    expect(html).toContain("3 respuestas");
  });

  it("el enunciado entero no se pinta: queda en el tooltip", () => {
    expect(html).not.toContain(`>${RED}<`);
    expect(html).toContain(`title="${RED}"`);
  });

  it("el chip de la respuesta usa el rótulo corto", () => {
    const fila = renderToStaticMarkup(createElement(SugerenciaModuloFila, { entrada: entrada("x", [pRed]), grupos: [], onConfirmar: noop, onQuitar: noop }));
    expect(fila).toContain("B · Redes sociales y plataformas");
    expect(fila).not.toContain(`>${RED}<`);
  });
});
