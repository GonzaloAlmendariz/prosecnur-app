// Panel «Experimento conjoint» (E7b editor-conjoint, 2026-11-06): su dirección y el estado del diseño que se edita.
// El estado vive en un reducer propio del panel, no en la página del editor.

import type { PanelDeclarado } from "../../../lib/navegacion/paneles";
import type { AtributoConjoint, DisenoConjoint } from "./modeloConjoint";

export const PANEL_EXPERIMENTO_CONJOINT: PanelDeclarado = {
  id: "experimento-conjoint",
  label: "Experimento conjoint",
  clase: "sideover",
};

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

export type AccionConjoint =
  | { tipo: "general"; cambios: Partial<Pick<DisenoConjoint, "prefijo" | "tareas" | "pregunta" | "intro" | "ordenAleatorio">> }
  | { tipo: "rotuloPerfil"; indice: 0 | 1; texto: string }
  | { tipo: "agregarAtributo" }
  | { tipo: "quitarAtributo"; indice: number }
  | { tipo: "rotuloAtributo"; indice: number; rotulo: string }
  | { tipo: "agregarNivel"; atributo: number }
  | { tipo: "quitarNivel"; atributo: number; nivel: number }
  | { tipo: "textoNivel"; atributo: number; nivel: number; texto: string }
  | { tipo: "usarPesos"; atributo: number; usar: boolean }
  | { tipo: "pesoNivel"; atributo: number; nivel: number; peso: number }
  | { tipo: "condicion"; atributo: number; soloSi: AtributoConjoint["soloSi"] }
  | { tipo: "reiniciar"; diseno: DisenoConjoint };

const recodificar = (a: AtributoConjoint): AtributoConjoint => ({
  ...a,
  niveles: a.niveles.map((n, i) => ({ ...n, codigo: String(i + 1) })),
});

function conAtributo(d: DisenoConjoint, i: number, f: (a: AtributoConjoint) => AtributoConjoint): DisenoConjoint {
  return { ...d, atributos: d.atributos.map((a, j) => (j === i ? f(a) : a)) };
}

/** Pesos iguales que suman 1 exacto (el último absorbe el redondeo). */
function pesosIguales(n: number): number[] {
  const p = Math.round((1 / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((1 - p * (n - 1)) * 100) / 100 : p));
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
    case "agregarAtributo": {
      const clave = claveDesde("Atributo nuevo", d.atributos.map((a) => a.clave));
      return { ...d, atributos: [...d.atributos, { clave, rotulo: "Atributo nuevo", niveles: [{ codigo: "1", texto: "Nivel 1" }, { codigo: "2", texto: "Nivel 2" }] }] };
    }
    case "quitarAtributo": {
      const quitada = d.atributos[accion.indice]?.clave;
      return {
        ...d,
        atributos: d.atributos
          .filter((_, i) => i !== accion.indice)
          .map((a) => (a.soloSi?.atributo === quitada ? { ...a, soloSi: undefined } : a)),
      };
    }
    case "rotuloAtributo": {
      const otras = d.atributos.filter((_, i) => i !== accion.indice).map((a) => a.clave);
      const vieja = d.atributos[accion.indice]?.clave;
      const clave = claveDesde(accion.rotulo, otras);
      const out = conAtributo(d, accion.indice, (a) => ({ ...a, rotulo: accion.rotulo, clave }));
      return { ...out, atributos: out.atributos.map((a) => (a.soloSi?.atributo === vieja ? { ...a, soloSi: { ...a.soloSi, atributo: clave } } : a)) };
    }
    case "agregarNivel":
      return conAtributo(d, accion.atributo, (a) => {
        const niveles = [...a.niveles, { codigo: "", texto: `Nivel ${a.niveles.length + 1}` }];
        const conPesos = a.niveles.every((n) => n.peso != null);
        const pesos = conPesos ? pesosIguales(niveles.length) : null;
        return recodificar({ ...a, niveles: niveles.map((n, i) => (pesos ? { ...n, peso: pesos[i] } : { ...n, peso: undefined })) });
      });
    case "quitarNivel":
      return conAtributo(d, accion.atributo, (a) => recodificar({ ...a, niveles: a.niveles.filter((_, i) => i !== accion.nivel) }));
    case "textoNivel":
      return conAtributo(d, accion.atributo, (a) => ({ ...a, niveles: a.niveles.map((n, i) => (i === accion.nivel ? { ...n, texto: accion.texto } : n)) }));
    case "usarPesos":
      return conAtributo(d, accion.atributo, (a) => {
        const pesos = pesosIguales(a.niveles.length);
        return { ...a, niveles: a.niveles.map((n, i) => ({ ...n, peso: accion.usar ? pesos[i] : undefined })) };
      });
    case "pesoNivel":
      return conAtributo(d, accion.atributo, (a) => ({ ...a, niveles: a.niveles.map((n, i) => (i === accion.nivel ? { ...n, peso: accion.peso } : n)) }));
    case "condicion":
      return conAtributo(d, accion.atributo, (a) => ({ ...a, soloSi: accion.soloSi }));
    case "reiniciar":
      return accion.diseno;
  }
}
