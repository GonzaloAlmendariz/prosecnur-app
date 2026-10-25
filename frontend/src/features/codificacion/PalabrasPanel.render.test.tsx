// TXT-6/7: lo que se ve del panel «Palabras» de una pregunta abierta, sin portal ni red.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PalabraReconocida, TextoAbiertoDiccionario } from "../../api/textoAbierto";
import { ESTADO_INICIAL_PALABRAS, reducirPalabras, type EstadoPalabras } from "./diccionarioPalabras";
import { PalabrasBarra, PalabrasCuerpo, readinessPalabras } from "./PalabrasPanel";

const p = (clave: string, forma: string, personas: number, extra: Partial<PalabraReconocida> = {}): PalabraReconocida =>
  ({ clave, forma, formas: [forma], personas, grupo: null, excluida: false, frases: [], excluidaEn: [], ...extra });

const datos = (extra: Partial<TextoAbiertoDiccionario> = {}): TextoAbiertoDiccionario => ({
  base: "ccss", variable: "coment",
  diccionario: { equivalencias: [{ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"] }], excluir: ["gracias"], frases: [] },
  palabras: [
    p("estudiant", "estudiantes", 11, { grupo: "estudiantes" }),
    p("alumn", "alumnos", 3, { grupo: "estudiantes" }),
    p("graci", "gracias", 1, { excluida: true }),
    p("docent", "docentes", 6),
  ],
  grupos: [{ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"], personas: 13 }],
  frasesDetectadas: [{ clave: "ciencias sociales", forma: "ciencias sociales", personas: 5, fija: false, excluida: false }],
  resumen: { escribieron: 40, conContenido: 31, nPalabras: 4 },
  ...extra,
});

const noop = () => undefined;
const listo = (d = datos()): EstadoPalabras => reducirPalabras(ESTADO_INICIAL_PALABRAS, { tipo: "cargado", datos: d });
const cuerpo = (estado: EstadoPalabras) => renderToStaticMarkup(createElement(PalabrasCuerpo, { estado, despachar: noop }));
const barra = (estado: EstadoPalabras) => renderToStaticMarkup(createElement(PalabrasBarra, { estado, despachar: noop, onGuardar: noop }));

describe("PalabrasCuerpo", () => {
  it("leyendo: un estado que contiene su vacío", () => {
    const html = cuerpo(ESTADO_INICIAL_PALABRAS);
    expect(html).toContain("Leyendo las palabras");
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(readinessPalabras(ESTADO_INICIAL_PALABRAS)).toBe("false");
  });

  it("lista: cada palabra con su conteo, su grupo y su exclusión; grupos que se deshacen; frases que se fijan", () => {
    const html = cuerpo(listo());
    expect(html).toContain('data-qa-geometry-group="codificacion/palabras"');
    expect(html).toContain("estudiantes");
    expect(html).toContain("<strong>11</strong> personas");

    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Se muestra como «estudiantes»");
    expect(html).toContain('aria-label="Deshacer el grupo «estudiantes»"');
    expect(html).toContain("13 personas");
    // TXT-18: el total del grupo con su desglose, en «Palabras unidas» y en la fila de la palabra que lo muestra.
    expect(html).toContain("estudiantes 11 + alumnos 3");
    expect(html).toContain("13 personas en el grupo");
    expect(html).toContain("Palabras más frecuentes");
    expect(html).toContain("Palabras excluidas");
    expect(html).toContain('aria-label="Volver a contar «gracias»"');
    // La misma fila del estandarizador de respuestas: check, texto y conteo.
    expect(html).toContain("pulso-cv2-resp-row");
    expect(html).toContain('aria-label="Marcar «docentes»"');
    // La excluida no está entre las frecuentes.
    expect(html).not.toContain('aria-label="Marcar «gracias»"');
    expect(html).toContain('aria-label="Fijar la frase «ciencias sociales»"');
    expect(html).not.toMatch(/raíz|raiz|lematiz|E_TXT/i);
    expect(readinessPalabras(listo())).toBe("true");
  });

  it("TXT-15: la lista de palabras más frecuentes va primero; unidas, excluidas y frases van plegadas en un resumen", () => {
    const html = cuerpo(listo());
    const lista = html.indexOf("Palabras más frecuentes");
    expect(lista).toBeGreaterThan(-1);
    for (const otra of ["Palabras unidas", "Palabras excluidas", "Frases que se repiten"]) {
      expect(html.indexOf(otra)).toBeGreaterThan(lista);
    }
    // El resumen plegable dice qué guarda sin abrirlo.
    expect(html).toMatch(/<details[^>]*class="pulso-cv2-pal-ajustes"/);
    expect(html).toContain("1 grupo · 1 excluida · 1 frase");
  });

  it("el buscador filtra y avisa si nada coincide", () => {
    const html = cuerpo(reducirPalabras(listo(), { tipo: "buscar", consulta: "zzz" }));
    expect(html).toContain("Ninguna palabra coincide con «zzz»");
  });

  it("sin palabras: vacío legítimo, dicho en su contenedor", () => {
    const vacio = listo(datos({ palabras: [], grupos: [], frasesDetectadas: [], diccionario: { equivalencias: [], excluir: [], frases: [] } }));
    expect(cuerpo(vacio)).toContain("Todavía no hay palabras");
    expect(readinessPalabras(vacio)).toBe("vacio:sin-palabras");
  });

  it("error de lectura: se dice la causa", () => {
    const s = reducirPalabras(ESTADO_INICIAL_PALABRAS, { tipo: "error-lectura", mensaje: "La base no tiene la pregunta." });
    expect(cuerpo(s)).toContain("La base no tiene la pregunta.");
    expect(readinessPalabras(s)).toBe("vacio:error");
  });
});

describe("PalabrasBarra", () => {
  it("con menos de dos marcadas, «Unir» está apagado; sin marcas, «Excluir»; sin cambios, «Guardar»", () => {
    const html = barra(listo());
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Excluir/);
    expect(html).toContain('aria-label="Buscar una palabra"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Unir/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Guardar/);
  });

  it("al unir pregunta cuál se muestra, con radios", () => {
    let s = reducirPalabras(listo(), { tipo: "marcar", clave: "docent" });
    s = reducirPalabras(s, { tipo: "marcar", clave: "graci" });
    s = reducirPalabras(s, { tipo: "empezar-union" });
    const html = barra(s);
    expect(html).toContain("¿Cuál se muestra?");
    expect(html).toContain('type="radio"');
    expect(html).toContain("Confirmar unión");
  });

  it("un error al guardar se dice en texto llano", () => {
    let s = reducirPalabras(listo(), { tipo: "alternar-frase", frase: "ciencias sociales" });
    s = reducirPalabras(s, { tipo: "error-guardado", mensaje: "La palabra que se muestra tiene que ser una de las que uniste." });
    const html = barra(s);
    expect(html).toContain('role="alert"');
    expect(html).toContain("La palabra que se muestra tiene que ser una de las que uniste.");
  });
});
