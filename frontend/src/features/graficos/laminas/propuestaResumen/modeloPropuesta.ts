// La propuesta del motor como lista para elegir (H13 del checklist de usabilidad del editor, 2026-11-05). Gonzalo: «no
// me deja ni escoger para mí cuáles son los hallazgos». Sin React, para probarlo solo.
//
// Lo mismo sirve para el resumen ejecutivo («Hallazgos clave») y el resumen de diferencias: la vista unifica cada cifra
// o fila en un elemento con su pregunta, su cifra, su frase o rótulo y la diferencia principal; las casillas marcan qué
// queda; y lo marcado se convierte en los capítulos que guarda el editor, sin los campos de sólo lectura.

import type { EstadoDiferencia, PropuestaResumen } from "../../../../api/graficosPropuesta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { escribirCapitulos, leerCapitulos } from "../hallazgos/modeloCapitulosHallazgos";
import { escribirCapitulosResumen, leerCapitulosResumen } from "../resumenDiferencias/modeloCapitulosResumen";

export type ElementoVista = {
  clave: string;
  pregunta: string;
  cifra: string;
  n: number | null;
  /** La frase del hallazgo o el rótulo de la fila, como sale en la lámina. */
  frase: string;
  diferencia: string;
  estado: EstadoDiferencia;
  /** Hallazgo sin texto propio: la lámina usa la frase de respaldo. */
  sinTexto: boolean;
};

export type CapituloVista = { clave: string; titulo: string; elementos: ElementoVista[] };

const clave = (i: number, j: number) => `c${i}e${j}`;

export function vistaPropuesta(p: PropuestaResumen): CapituloVista[] {
  if (p.tipo === "p_slide_resumen_diferencias") {
    return p.capitulos.map((c, i) => ({
      clave: `c${i}`,
      titulo: c.titulo,
      elementos: c.filas.map((f, j) => ({
        clave: clave(i, j), pregunta: f.pregunta, cifra: f.cifra, n: f.n, frase: f.rotuloLamina,
        diferencia: f.diferencia, estado: f.diferenciaEstado, sinTexto: false,
      })),
    }));
  }
  return p.capitulos.map((c, i) => ({
    clave: `c${i}`,
    titulo: c.titulo,
    elementos: c.cifras.map((h, j) => ({
      clave: clave(i, j), pregunta: h.pregunta, cifra: h.cifra, n: h.n, frase: h.frase,
      diferencia: h.diferencia, estado: h.diferenciaEstado, sinTexto: !h.texto,
    })),
  }));
}

/** Al cargar, todo queda marcado. */
export function todosMarcados(p: PropuestaResumen): Set<string> {
  return new Set(vistaPropuesta(p).flatMap((c) => c.elementos.map((e) => e.clave)));
}

export function alternar(marcados: ReadonlySet<string>, k: string): Set<string> {
  const otro = new Set(marcados);
  if (otro.has(k)) otro.delete(k); else otro.add(k);
  return otro;
}

export const totalElementos = (p: PropuestaResumen): number =>
  p.tipo === "p_slide_resumen_diferencias"
    ? p.capitulos.reduce((n, c) => n + c.filas.length, 0)
    : p.capitulos.reduce((n, c) => n + c.cifras.length, 0);

/** Cuántos de los marcados siguen existiendo en la propuesta. */
export function cuantosQuedan(p: PropuestaResumen, marcados: ReadonlySet<string>): number {
  return vistaPropuesta(p).reduce((n, c) => n + c.elementos.filter((e) => marcados.has(e.clave)).length, 0);
}

const respuesta = (x: { fila: string; top2box: string[] }): Record<string, unknown> =>
  x.top2box.length ? { top2box: [...x.top2box] } : { fila: x.fila };

/**
 * Lo marcado como los capítulos que guarda el editor, sin los campos de sólo lectura. Un capítulo sin nada marcado no
 * va. Un hallazgo sin texto propio lleva la frase con que sale en la lámina («respondió «Posgrado»»): así la lámina no
 * cambia al pasar a «Los escribo yo» y el hallazgo no se cae del plan por incompleto. El analista la reescribe ahí.
 * Con varias bases (`conBase`), la pregunta va calificada con la base de la que leyó el motor (`base$var`): sin ella el
 * selector avisa «falta la base» y el informe conjunto la bloquea.
 */
export function capitulosDesdePropuesta(p: PropuestaResumen, marcados: ReadonlySet<string>, conBase = false): Record<string, unknown>[] {
  const ref = (v: string) => (conBase && p.base && !v.includes("$") ? `${p.base}$${v}` : v);
  if (p.tipo === "p_slide_resumen_diferencias") {
    return p.capitulos.flatMap((c, i) => {
      const filas = c.filas.flatMap((f, j) => (marcados.has(clave(i, j))
        ? [{ var: ref(f.var), ...respuesta(f), rotulo: f.rotulo || f.rotuloLamina || f.pregunta }] : []));
      return filas.length ? [{ titulo: c.titulo, filas }] : [];
    });
  }
  return p.capitulos.flatMap((c, i) => {
    const cifras = c.cifras.flatMap((h, j) => (marcados.has(clave(i, j))
      ? [{ var: ref(h.var), ...respuesta(h), texto: h.texto || h.frase, comparacion: h.comparacion || "auto" }] : []));
    return cifras.length ? [{ titulo: c.titulo, cifras }] : [];
  });
}

/** Lo que ya está escrito en el plan y sale, en la forma que entiende el motor. */
export function escritosQueSalen(tipo: PropuestaResumen["tipo"], valor: unknown): Record<string, unknown>[] {
  return tipo === "p_slide_resumen_diferencias"
    ? escribirCapitulosResumen(leerCapitulosResumen(valor))
    : escribirCapitulos(leerCapitulos(valor));
}

export type ComoCombinar = "reemplazar" | "agregar";

/** Reemplaza lo escrito o agrega lo traído al final. */
export function combinarCapitulos(escritos: readonly Record<string, unknown>[], traidos: readonly Record<string, unknown>[], como: ComoCombinar): Record<string, unknown>[] {
  return como === "reemplazar" ? [...traidos] : [...escritos, ...traidos];
}

const SIN_TEXTO = /no tiene texto/i;
const PREFIJO = /^(Hallazgos clave|Resumen de diferencias|Propuesta)\s*:\s*/;

/**
 * Los avisos del motor que importan al elegir. Los «no tiene texto» de cada cifra se dicen en uno solo, con cuántos son;
 * los demás van tal cual, sin el nombre de la lámina delante (ya se está mirando).
 */
export function avisosPropuesta(p: PropuestaResumen): string[] {
  const out: string[] = [];
  if (p.tipo === "p_slide_hallazgos") {
    const sin = p.capitulos.reduce((n, c) => n + c.cifras.filter((h) => !h.texto).length, 0);
    if (sin === 1) out.push("1 hallazgo no tiene texto propio. La lámina dice «respondió…» hasta que lo escribas.");
    else if (sin > 1) out.push(`${formatoConteo(sin)} hallazgos no tienen texto propio. La lámina dice «respondió…» hasta que los escribas.`);
  }
  for (const a of p.avisos) {
    if (SIN_TEXTO.test(a)) continue;
    const limpio = a.replace(PREFIJO, "").trim();
    if (!limpio) continue;
    const frase = limpio.charAt(0).toUpperCase() + limpio.slice(1);
    if (!out.includes(frase)) out.push(frase);
  }
  return out;
}

/** «12 de 12 quedan», «1 de 4 queda». */
export function conteoQuedan(quedan: number, total: number): string {
  return `${formatoConteo(quedan)} de ${formatoConteo(total)} ${quedan === 1 ? "queda" : "quedan"}`;
}

export const nombreElemento = (tipo: PropuestaResumen["tipo"], plural = false): string =>
  tipo === "p_slide_resumen_diferencias" ? (plural ? "filas" : "fila") : (plural ? "hallazgos" : "hallazgo");

/** Lo que no cambia qué propone el motor: lo escrito a mano, la selección y los textos de la lámina. */
const NO_DECIDEN: ReadonlySet<string> = new Set(["capitulos", "seleccion", "titulo", "subtitulo", "antetitulo", "etiqueta", "nota"]);

/** «los hallazgos» o «las filas», para las frases de carga. */
export const losElementos = (tipo: PropuestaResumen["tipo"]): string =>
  tipo === "p_slide_resumen_diferencias" ? "las filas" : "los hallazgos";

/** El aviso de quien desmarcó todo y quiere editar. */
export const avisoNadaMarcado = (tipo: PropuestaResumen["tipo"]): string =>
  tipo === "p_slide_resumen_diferencias"
    ? "No marcaste ninguna fila. Marca al menos una para editarla."
    : "No marcaste ningún hallazgo. Marca al menos uno para editarlo.";

/** La firma de lo que decide la propuesta (los cruces, los topes, el modo, la base…), con las claves en orden. */
export function firmaLamina(slide: { id: string; tipo: string; payload: Record<string, unknown> }): string {
  const resto = Object.keys(slide.payload).filter((k) => !NO_DECIDEN.has(k)).sort().map((k) => [k, slide.payload[k]]);
  return JSON.stringify([slide.id, slide.tipo, resto]);
}
