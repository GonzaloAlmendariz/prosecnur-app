// Modelo puro del inspector entre públicos (ADR 0138): el estado de la sección, los rótulos de cada veredicto y estado
// de tema, la marca que lleva cada par (▲ firme, △ frágil, ninguna) y dónde se declara la equivalencia que falta.
//
// Juicio del analista: aquí no se interpreta nada. Se nombra lo que el motor devolvió (pares, p, n, motivos) y, cuando
// falta una equivalencia, se dice dónde declararla. Sólo «marcada» y «frágil» llevan marca; un veredicto desconocido no.
// El intervalo de Newcombe es un dato secundario, nunca la marca. Sin React.

import type {
  EquivalenciaTema,
  EstadoTemaPublicos,
  GrupoPublico,
  LaminaDiferencias,
  ParPublico,
  TemaEntrePublicos,
  VeredictoPublico,
} from "../../../../api/graficosDiferencias";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import type { CargaDiferencias } from "./modeloDiferencias";
import { formatoP, formatoPct, formatoPuntos } from "./modeloDiferencias";

export type EstadoPublicos = "calculando" | "error" | "sin_temas" | "abstencion" | "ninguna" | "con_marcas";

/** El estado de la sección a partir de la carga. `sin_temas`: el motor no encontró ningún tema que evaluar. */
export function estadoPublicos(carga: CargaDiferencias<{ lamina: LaminaDiferencias }> | undefined): EstadoPublicos {
  if (!carga || (carga.estado === "cargando" && !carga.datos)) return "calculando";
  if (carga.estado === "error") return "error";
  const lamina = carga.datos?.lamina;
  if (!lamina) return "calculando";
  if (lamina.estado === "error") return "error";
  const temas = lamina.entre_publicos?.temas ?? [];
  if (!temas.length) return "sin_temas";
  if (lamina.estado === "con_marcas") return "con_marcas";
  if (lamina.estado === "ninguna") return "ninguna";
  return "abstencion";
}

export const ROTULO_VEREDICTO: Readonly<Record<VeredictoPublico, string>> = {
  marcada: "Marcada",
  fragil: "Frágil",
  bajo_umbral: "Bajo el umbral",
  no_significativa: "No significativa",
  no_comparable: "No comparable",
  escalas_distintas: "Escalas distintas",
  sin_equivalencia: "Sin equivalencia declarada",
  fuera_de_familia: "Fuera de la familia",
  desconocido: "Sin veredicto",
};

/** El rótulo del veredicto; uno desconocido dice el texto que mandó el motor. */
export function rotuloVeredicto(par: Pick<ParPublico, "veredicto" | "veredicto_crudo">): string {
  if (par.veredicto === "desconocido" && par.veredicto_crudo) return `Veredicto "${par.veredicto_crudo}"`;
  return ROTULO_VEREDICTO[par.veredicto];
}

export type MarcaPar = "firme" | "fragil" | null;

/** ▲ para la marcada, △ con contorno punteado para la frágil; todo lo demás va sin marca. */
export function marcaDe(veredicto: VeredictoPublico): MarcaPar {
  if (veredicto === "marcada") return "firme";
  if (veredicto === "fragil") return "fragil";
  return null;
}

export const ROTULO_ESTADO_TEMA: Readonly<Record<EstadoTemaPublicos, string>> = {
  evaluable: "Comparado",
  sin_equivalencia: "Sin equivalencia declarada",
  escalas_distintas: "Escalas distintas",
  abstencion: "No se compara",
  fuera_de_familia: "Fuera de la familia",
  desconocido: "Estado sin reconocer",
};

export function rotuloEstadoTema(tema: Pick<TemaEntrePublicos, "estado" | "estado_crudo">): string {
  if (tema.estado === "desconocido" && tema.estado_crudo) return `Estado "${tema.estado_crudo}"`;
  return ROTULO_ESTADO_TEMA[tema.estado];
}

export function rotuloEquivalencia(eq: EquivalenciaTema | null): string {
  if (eq === "emparejado") return "Par confirmado en el emparejado";
  if (eq === "matriz") return "Fila de la matriz de equivalencias";
  return "Sin equivalencia declarada";
}

/** ¿Al tema le falta la equivalencia? Por su estado o porque algún par lo dice. */
export function faltaEquivalencia(tema: Pick<TemaEntrePublicos, "estado" | "pares">): boolean {
  return tema.estado === "sin_equivalencia" || tema.pares.some((p) => p.veredicto === "sin_equivalencia");
}

/** Dónde se declara la equivalencia de este gráfico: el panorama sólo lee la matriz; el contraste y el radar, sus temas. */
export type DondeDeclarar = "matriz" | "temas";
export const dondeDeclarar = (graficador: string): DondeDeclarar => (graficador === "p_panorama" ? "matriz" : "temas");

export type ConteosPublicos = { temas: number; comparados: number; marcadas: number; fragiles: number; sinEquivalencia: number };

/** Conteos de lo que devolvió el motor; «marcadas» incluye las frágiles, que se cuentan además aparte. */
export function conteosPublicos(temas: readonly TemaEntrePublicos[]): ConteosPublicos {
  const pares = temas.flatMap((t) => t.pares);
  return {
    temas: temas.length,
    comparados: temas.filter((t) => t.estado === "evaluable").length,
    marcadas: pares.filter((p) => marcaDe(p.veredicto) !== null).length,
    fragiles: pares.filter((p) => p.veredicto === "fragil").length,
    sinEquivalencia: temas.filter(faltaEquivalencia).length,
  };
}

/** El rótulo de un público del tema por su base. */
export function etiquetaPublico(grupos: readonly GrupoPublico[], base: string): string {
  return grupos.find((g) => g.base === base)?.etiqueta ?? base;
}

/** «Docentes 78% frente a Estudiantes 64%»: las cifras del par, sin juicio. */
export function parEnPalabras(par: ParPublico, grupos: readonly GrupoPublico[]): string {
  return `${etiquetaPublico(grupos, par.a)} ${formatoPct(par.p_a)} frente a ${etiquetaPublico(grupos, par.b)} ${formatoPct(par.p_b)}`;
}

/** «+14 pp» (o «—» sin diferencia). */
export const diferenciaPar = (par: Pick<ParPublico, "dif_pp">): string => (par.dif_pp === null ? "—" : `${formatoPuntos(par.dif_pp)} pp`);

/** Datos secundarios del par: p, p ajustado y el intervalo de Newcombe (informativo). */
export function datosPar(par: Pick<ParPublico, "p" | "p_ajustado" | "ic_newcombe">): string {
  const partes = [`p ${formatoP(par.p)}`, `p ajustado ${formatoP(par.p_ajustado)}`];
  if (par.ic_newcombe) {
    partes.push(`intervalo de Newcombe ${formatoDecimal(par.ic_newcombe[0], 1)} a ${formatoDecimal(par.ic_newcombe[1], 1)} pp`);
  }
  return partes.join(", ");
}

/** «Docentes: 78%, n 120» o, si no entra a la prueba, con su motivo. */
export function publicoEnPalabras(g: GrupoPublico): string {
  const n = g.n === null ? "n sin dato" : `n ${formatoConteo(g.n)}`;
  const base = `${g.etiqueta}: ${formatoPct(g.p)}, ${n}`;
  return g.comparable ? base : `${base} (${g.motivo ?? "no entra a la prueba"})`;
}

/** La familia de Benjamini-Hochberg entre públicos, si aplica. */
export function textoFamilia(familia: { m: number; local: boolean }): string | null {
  if (familia.m <= 0) return null;
  const n = `${formatoConteo(familia.m)} ${familia.m === 1 ? "comparación" : "comparaciones"}`;
  return familia.local ? `Familia entre públicos: ${n} de esta lámina.` : `Familia entre públicos: ${n} del informe.`;
}
