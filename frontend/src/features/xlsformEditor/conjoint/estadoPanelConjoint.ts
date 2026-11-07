// Estado del diseño de un experimento de elección por pares que se edita (E7b editor-conjoint, 2026-11-06; desde
// C8, 2026-11-07, en la pestaña Experimentos). Vive en un reducer propio, no en la página del editor.

import type { AtributoConjoint, DisenoConjoint } from "./modeloConjoint";
import type { DisenoVinetas } from "./modeloVinetas";

/** Nombre de variable a partir de un rótulo: sin tildes, minúsculas, `_` entre palabras, hasta 20 caracteres. */
export function claveDesde(rotulo: string, usadas: readonly string[] = []): string {
  let base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20)
    .replace(/_+$/g, "");
  if (!base) base = "atributo";
  if (/^\d/.test(base)) base = `a_${base}`;
  let clave = base;
  for (let i = 2; usadas.includes(clave); i += 1) clave = `${base}_${i}`;
  return clave;
}

/** Diseño de partida: genérico, para que se vea cómo funciona antes de escribir el propio. */
export function disenoInicial(prefijo: string): DisenoConjoint {
  return {
    prefijo,
    tareas: 5,
    rotulosPerfil: ["Persona A", "Persona B"],
    pregunta: "¿A cuál de estas dos personas preferiría?",
    intro: "",
    ordenAleatorio: false,
    atributos: [
      { clave: "edad", rotulo: "Edad", niveles: [{ codigo: "1", texto: "35 años" }, { codigo: "2", texto: "50 años" }, { codigo: "3", texto: "65 años" }] },
      { clave: "genero", rotulo: "Género", niveles: [{ codigo: "1", texto: "Hombre" }, { codigo: "2", texto: "Mujer" }] },
    ],
  };
}

/** Acciones sobre los atributos y sus niveles: las comparten la elección por pares y las viñetas. */
export type AccionAtributo =
  | { tipo: "agregarAtributo" }
  | { tipo: "quitarAtributo"; indice: number }
  | { tipo: "rotuloAtributo"; indice: number; rotulo: string }
  | { tipo: "agregarNivel"; atributo: number }
  | { tipo: "quitarNivel"; atributo: number; nivel: number }
  | { tipo: "textoNivel"; atributo: number; nivel: number; texto: string }
  | { tipo: "usarPesos"; atributo: number; usar: boolean }
  | { tipo: "pesoNivel"; atributo: number; nivel: number; peso: number }
  | { tipo: "condicion"; atributo: number; soloSi: AtributoConjoint["soloSi"] };

export type AccionConjoint =
  | AccionAtributo
  | { tipo: "general"; cambios: Partial<Pick<DisenoConjoint, "prefijo" | "tareas" | "pregunta" | "intro" | "ordenAleatorio">> }
  | { tipo: "rotuloPerfil"; indice: 0 | 1; texto: string }
  | { tipo: "reiniciar"; diseno: DisenoConjoint };

const recodificar = (a: AtributoConjoint): AtributoConjoint => ({
  ...a,
  niveles: a.niveles.map((n, i) => ({ ...n, codigo: String(i + 1) })),
});

const conAtributo = (atributos: AtributoConjoint[], i: number, f: (a: AtributoConjoint) => AtributoConjoint) =>
  atributos.map((a, j) => (j === i ? f(a) : a));

/** Pesos iguales que suman 1 exacto (el último absorbe el redondeo). */
function pesosIguales(n: number): number[] {
  const p = Math.round((1 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((1 - p * (n - 1)) * 100) / 100 : p));
}

/** Los atributos tras la acción y, si un rótulo cambió la clave, cuál era y cuál es (las viñetas renombran su hueco). */
export function reducirAtributos(atributos: AtributoConjoint[], accion: AccionAtributo): { atributos: AtributoConjoint[]; renombre?: { vieja: string; nueva: string } } {
  switch (accion.tipo) {
    case "agregarAtributo": {
      const clave = claveDesde("Atributo nuevo", atributos.map((a) => a.clave));
      return { atributos: [...atributos, { clave, rotulo: "Atributo nuevo", niveles: [{ codigo: "1", texto: "Nivel 1" }, { codigo: "2", texto: "Nivel 2" }] }] };
    }
    case "quitarAtributo": {
      const quitada = atributos[accion.indice]?.clave;
      return {
        atributos: atributos
          .filter((_, i) => i !== accion.indice)
          .map((a) => (a.soloSi?.atributo === quitada ? { ...a, soloSi: undefined } : a)),
      };
    }
    case "rotuloAtributo": {
      const otras = atributos.filter((_, i) => i !== accion.indice).map((a) => a.clave);
      const vieja = atributos[accion.indice]?.clave ?? "";
      const clave = claveDesde(accion.rotulo, otras);
      const out = conAtributo(atributos, accion.indice, (a) => ({ ...a, rotulo: accion.rotulo, clave }));
      return {
        atributos: out.map((a) => (a.soloSi?.atributo === vieja ? { ...a, soloSi: { ...a.soloSi, atributo: clave } } : a)),
        ...(vieja && vieja !== clave ? { renombre: { vieja, nueva: clave } } : {}),
      };
    }
    case "agregarNivel":
      return {
        atributos: conAtributo(atributos, accion.atributo, (a) => {
          const niveles = [...a.niveles, { codigo: "", texto: `Nivel ${a.niveles.length + 1}` }];
          const conPesos = a.niveles.every((n) => n.peso != null);
          const pesos = conPesos ? pesosIguales(niveles.length) : null;
          return recodificar({ ...a, niveles: niveles.map((n, i) => (pesos ? { ...n, peso: pesos[i] } : { ...n, peso: undefined })) });
        }),
      };
    case "quitarNivel":
      return { atributos: conAtributo(atributos, accion.atributo, (a) => recodificar({ ...a, niveles: a.niveles.filter((_, i) => i !== accion.nivel) })) };
    case "textoNivel":
      return { atributos: conAtributo(atributos, accion.atributo, (a) => ({ ...a, niveles: a.niveles.map((n, i) => (i === accion.nivel ? { ...n, texto: accion.texto } : n)) })) };
    case "usarPesos":
      return {
        atributos: conAtributo(atributos, accion.atributo, (a) => {
          const pesos = pesosIguales(a.niveles.length);
          return { ...a, niveles: a.niveles.map((n, i) => ({ ...n, peso: accion.usar ? pesos[i] : undefined })) };
        }),
      };
    case "pesoNivel":
      return { atributos: conAtributo(atributos, accion.atributo, (a) => ({ ...a, niveles: a.niveles.map((n, i) => (i === accion.nivel ? { ...n, peso: accion.peso } : n)) })) };
    case "condicion":
      return { atributos: conAtributo(atributos, accion.atributo, (a) => ({ ...a, soloSi: accion.soloSi })) };
  }
}

export function reducirConjoint(d: DisenoConjoint, accion: AccionConjoint): DisenoConjoint {
  switch (accion.tipo) {
    case "general":
      return { ...d, ...accion.cambios };
    case "rotuloPerfil": {
      const r: [string, string] = [...d.rotulosPerfil];
      r[accion.indice] = accion.texto;
      return { ...d, rotulosPerfil: r };
    }
    case "reiniciar":
      return accion.diseno;
    default:
      return { ...d, atributos: reducirAtributos(d.atributos, accion).atributos };
  }
}

export type AccionVinetas =
  | AccionAtributo
  | { tipo: "general"; cambios: Partial<Pick<DisenoVinetas, "vinetas" | "texto" | "pregunta" | "intro">> }
  | { tipo: "escala"; cambios: Partial<DisenoVinetas["escala"]> };

/** Como el de pares; además, si un rótulo cambia la clave de un atributo, su hueco en el texto cambia con ella. */
export function reducirVinetas(d: DisenoVinetas, accion: AccionVinetas): DisenoVinetas {
  switch (accion.tipo) {
    case "general":
      return { ...d, ...accion.cambios };
    case "escala":
      return { ...d, escala: { ...d.escala, ...accion.cambios } };
    default: {
      const r = reducirAtributos(d.atributos, accion);
      const texto = r.renombre ? d.texto.split(`{${r.renombre.vieja}}`).join(`{${r.renombre.nueva}}`) : d.texto;
      return { ...d, atributos: r.atributos, texto };
    }
  }
}
