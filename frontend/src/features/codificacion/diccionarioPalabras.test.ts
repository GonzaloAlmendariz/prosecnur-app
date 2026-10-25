// TXT-6/7: lo que hace el panel «Palabras» con el diccionario de la pregunta, sin red ni React.
import { describe, expect, it } from "vitest";
import type { DiccionarioPregunta, PalabraReconocida, TextoAbiertoDiccionario } from "../../api/textoAbierto";
import {
  ESTADO_INICIAL_PALABRAS,
  claveTermino,
  filtrarPalabras,
  grupoDePalabra,
  hayCambios,
  mensajeGuardadoLlano,
  palabraExcluida,
  palabrasFrecuentes,
  reducirPalabras,
  totalDelGrupo,
  type EstadoPalabras,
} from "./diccionarioPalabras";

const p = (clave: string, forma: string, personas: number, extra: Partial<PalabraReconocida> = {}): PalabraReconocida =>
  ({ clave, forma, formas: [forma], personas, grupo: null, excluida: false, frases: [], excluidaEn: [], ...extra });

const ALUMNOS = p("alumn", "alumnos", 3);
const ESTUDIANTES = p("estudiant", "estudiantes", 10, { formas: ["estudiantes", "estudiante"] });
const PROFESORES = p("profesor", "profesores", 4);
const DOCENTES = p("docent", "docentes", 6);
const VACIO: DiccionarioPregunta = { equivalencias: [], excluir: [], frases: [] };

const datos = (diccionario: DiccionarioPregunta = VACIO, palabras = [ESTUDIANTES, DOCENTES, PROFESORES, ALUMNOS]): TextoAbiertoDiccionario => ({
  base: "ccss", variable: "coment", diccionario, palabras, grupos: [],
  frasesDetectadas: [{ clave: "ciencias sociales", forma: "ciencias sociales", personas: 5, fija: false, excluida: false }],
  resumen: { escribieron: 30, conContenido: 25, nPalabras: palabras.length },
});

const listo = (d = datos()): EstadoPalabras => reducirPalabras(ESTADO_INICIAL_PALABRAS, { tipo: "cargado", datos: d });

describe("claveTermino", () => {
  it("compara sin mayúsculas, tildes ni espacios de más", () => {
    expect(claveTermino("  Ciencias   Sociáles ")).toBe("ciencias sociales");
  });
});

describe("unir palabras", () => {
  it("marcar dos, pulsar Unir y elegir cuál se muestra deja un grupo en el borrador", () => {
    let s = listo();
    s = reducirPalabras(s, { tipo: "marcar", clave: "alumn" });
    s = reducirPalabras(s, { tipo: "marcar", clave: "estudiant" });
    s = reducirPalabras(s, { tipo: "empezar-union" });
    expect(s.union?.opciones).toEqual(["estudiantes", "alumnos"]);
    expect(s.union?.mostrar).toBe("estudiantes"); // la que más personas usan
    s = reducirPalabras(s, { tipo: "elegir-mostrar", mostrar: "alumnos" });
    s = reducirPalabras(s, { tipo: "confirmar-union" });
    expect(s.borrador.equivalencias).toEqual([{ mostrar: "alumnos", formas: ["estudiantes", "alumnos"] }]);
    expect(s.seleccion).toEqual([]);
    expect(s.union).toBeNull();
    expect(hayCambios(s)).toBe(true);
    expect(grupoDePalabra(ESTUDIANTES, s.borrador)?.mostrar).toBe("alumnos");
  });

  it("con menos de dos marcadas no se puede unir", () => {
    let s = reducirPalabras(listo(), { tipo: "marcar", clave: "alumn" });
    s = reducirPalabras(s, { tipo: "empezar-union" });
    expect(s.union).toBeNull();
  });

  it("unir una palabra que ya está en un grupo lo absorbe en vez de repetir la palabra", () => {
    let s = listo(datos({ equivalencias: [{ mostrar: "docentes", formas: ["profesores", "docentes"] }], excluir: [], frases: [] }));
    s = reducirPalabras(s, { tipo: "marcar", clave: "docent" });
    s = reducirPalabras(s, { tipo: "marcar", clave: "alumn" });
    s = reducirPalabras(s, { tipo: "empezar-union" });
    expect(s.union?.opciones).toEqual(["docentes", "alumnos", "profesores"]);
    s = reducirPalabras(s, { tipo: "confirmar-union" });
    expect(s.borrador.equivalencias).toEqual([{ mostrar: "docentes", formas: ["docentes", "alumnos", "profesores"] }]);
  });

  it("deshacer un grupo lo quita del borrador; desmarcar quita la marca", () => {
    let s = listo(datos({ equivalencias: [{ mostrar: "docentes", formas: ["profesores", "docentes"] }], excluir: [], frases: [] }));
    expect(hayCambios(s)).toBe(false);
    s = reducirPalabras(s, { tipo: "deshacer-grupo", mostrar: "docentes" });
    expect(s.borrador.equivalencias).toEqual([]);
    s = reducirPalabras(s, { tipo: "marcar", clave: "alumn" });
    s = reducirPalabras(s, { tipo: "marcar", clave: "alumn" });
    expect(s.seleccion).toEqual([]);
  });

  it("el grupo que el servidor reconoce por otra forma de la palabra también se ve", () => {
    const dic = { equivalencias: [{ mostrar: "estudiantes", formas: ["alumno", "estudiantes"] }], excluir: [], frases: [] };
    expect(grupoDePalabra({ ...ALUMNOS, grupo: "estudiantes" }, dic)?.mostrar).toBe("estudiantes");
    expect(grupoDePalabra(ALUMNOS, dic)).toBeNull();
  });
});

describe("excluir y fijar", () => {
  it("excluir una palabra la agrega por su forma; volver a contarla la quita", () => {
    let s = reducirPalabras(listo(), { tipo: "alternar-excluir", termino: "alumnos", formas: ["alumnos"] });
    expect(s.borrador.excluir).toEqual(["alumnos"]);
    expect(palabraExcluida(ALUMNOS, s.borrador)).toBe(true);
    s = reducirPalabras(s, { tipo: "alternar-excluir", termino: "alumnos", formas: ["alumnos"] });
    expect(s.borrador.excluir).toEqual([]);
  });

  it("fijar una frase detectada y volver a soltarla", () => {
    let s = reducirPalabras(listo(), { tipo: "alternar-frase", frase: "ciencias sociales" });
    expect(s.borrador.frases).toEqual(["ciencias sociales"]);
    s = reducirPalabras(s, { tipo: "alternar-frase", frase: "Ciencias Sociales" });
    expect(s.borrador.frases).toEqual([]);
  });
});

describe("guardar", () => {
  it("guardado: el borrador vuelve a ser el del servidor y no quedan cambios", () => {
    let s = reducirPalabras(listo(), { tipo: "alternar-frase", frase: "ciencias sociales" });
    s = reducirPalabras(s, { tipo: "guardando" });
    expect(s.guardado.fase).toBe("guardando");
    s = reducirPalabras(s, { tipo: "guardado", datos: datos({ equivalencias: [], excluir: [], frases: ["ciencias sociales"] }) });
    expect(s.guardado.fase).toBe("ok");
    expect(hayCambios(s)).toBe(false);
  });

  it("un error de guardado conserva el borrador para corregirlo", () => {
    let s = reducirPalabras(listo(), { tipo: "alternar-frase", frase: "ciencias sociales" });
    s = reducirPalabras(s, { tipo: "error-guardado", mensaje: "x" });
    expect(s.guardado).toEqual({ fase: "error", mensaje: "x" });
    expect(s.borrador.frases).toEqual(["ciencias sociales"]);
  });

  it("los mensajes del 422 se dicen en texto llano, sin código ni jerga", () => {
    const repetida = mensajeGuardadoLlano("E_TXT_FORMA_REPETIDA", "El grupo «estudiantes» comparte la raíz «alumn» con otro grupo: son la misma palabra. · E_TXT_FORMA_REPETIDA");
    expect(repetida).toContain("ya está en otro grupo");
    expect(repetida).not.toMatch(/raíz|E_TXT/);
    expect(mensajeGuardadoLlano("E_TXT_MOSTRAR_FUERA_DE_FORMAS", "x · E_TXT_MOSTRAR_FUERA_DE_FORMAS")).toBe("La palabra que se muestra tiene que ser una de las que uniste.");
    expect(mensajeGuardadoLlano("E_TXT_DICCIONARIO_INVALIDO", "El grupo «a» une menos de dos palabras. · E_TXT_DICCIONARIO_INVALIDO")).toBe("El grupo «a» une menos de dos palabras.");
  });
});

describe("excluir en lote (CCSS-TXT-14)", () => {
  it("marcar varias y pulsar «Excluir» las saca de las frecuentes; se reincorporan una por una", () => {
    let s = reducirPalabras(listo(), { tipo: "marcar", clave: "docent" });
    s = reducirPalabras(s, { tipo: "marcar", clave: "alumn" });
    s = reducirPalabras(s, { tipo: "excluir-marcadas" });
    expect(s.borrador.excluir).toEqual(["docentes", "alumnos"]);
    expect(s.seleccion).toEqual([]);
    expect(palabrasFrecuentes(s).map((x) => x.clave)).toEqual(["estudiant", "profesor"]);
    s = reducirPalabras(s, { tipo: "reincorporar", termino: "Docentes" });
    expect(s.borrador.excluir).toEqual(["alumnos"]);
    expect(palabrasFrecuentes(s).map((x) => x.clave)).toEqual(["estudiant", "docent", "profesor"]);
  });

  it("las frecuentes van ordenadas por personas aunque el servidor las mande en otro orden", () => {
    const s = listo(datos(VACIO, [ALUMNOS, DOCENTES, ESTUDIANTES, PROFESORES]));
    expect(palabrasFrecuentes(s).map((x) => x.personas)).toEqual([10, 6, 4, 3]);
  });
});

describe("filtrarPalabras", () => {
  it("busca en todas las formas, sin tildes", () => {
    expect(filtrarPalabras([ESTUDIANTES, DOCENTES], "estudiante").map((x) => x.clave)).toEqual(["estudiant"]);
    expect(filtrarPalabras([p("cafe", "café", 2)], "cafe")).toHaveLength(1);
    expect(filtrarPalabras([ESTUDIANTES, DOCENTES], "  ")).toHaveLength(2);
  });
});

// TXT-18: un grupo unido muestra cuántas personas usan alguna de sus palabras (lo cuenta el backend, sin repetir
// personas) y de dónde sale: «alumnos 6 + estudiantes 7».
describe("totalDelGrupo", () => {
  const g = { mostrar: "estudiantes", formas: ["alumnos", "estudiantes"] };
  const conGrupo = (grupos: TextoAbiertoDiccionario["grupos"]) => ({ ...datos({ equivalencias: [g], excluir: [], frases: [] }), grupos });
  it("toma las personas del grupo guardado y desglosa por palabra, de más a menos", () => {
    const t = totalDelGrupo(g, conGrupo([{ mostrar: "Estudiantes", formas: ["estudiantes", "alumnos"], personas: 13 }]));
    expect(t.personas).toBe(13);
    expect(t.partes).toEqual([{ forma: "estudiantes", personas: 10 }, { forma: "alumnos", personas: 3 }]);
  });
  it("sin guardar (o con otras palabras) todavía no hay total", () => {
    expect(totalDelGrupo(g, conGrupo([])).personas).toBeNull();
    expect(totalDelGrupo(g, conGrupo([{ mostrar: "estudiantes", formas: ["alumnos"], personas: 3 }])).personas).toBeNull();
    expect(totalDelGrupo(g, null).partes).toEqual([]);
  });
});
