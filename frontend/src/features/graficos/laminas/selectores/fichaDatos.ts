// Ficha «Datos» del detalle del selector (auditoría del selector, hallazgo 2): qué preguntas y qué públicos usa el
// gráfico de una tarjeta (`usa` de CATALOGO_GRAFICOS) y qué tiene el estudio para él (`apiGraficosInventario`). La
// ficha dice los hechos y, si algo no alcanza, qué falta; no bloquea la tarjeta ni recomienda otra: decide el analista.
// Pura: la ficha la pinta y los tests la prueban sola.

import type { InventarioPublico, PreguntasDelPublico } from "../../../../api/graficosInventario";
import {
  CATALOGO_GRAFICOS, type PreguntaQueUsa, type PublicosQueUsa, type UsaGrafico,
} from "../../iconos/catalogoTipos.generated";
import { formatoConteo } from "../../../../lib/formatoNumero";

export const ROTULO_PREGUNTA: Readonly<Record<PreguntaQueUsa, string>> = {
  escala: "Escala",
  opcion_unica: "Opción única",
  multiple: "Opción múltiple",
  numerica: "Numérica",
  abierta: "Abierta",
  cualquiera: "Cualquier tipo",
};

/** El tipo en minúscula, para la frase de «Tu estudio» («preguntas de escala»). */
const PREGUNTA_EN_FRASE: Readonly<Record<Exclude<PreguntaQueUsa, "cualquiera">, string>> = {
  escala: "de escala",
  opcion_unica: "de opción única",
  multiple: "de opción múltiple",
  numerica: "numéricas",
  abierta: "abiertas",
};

export const ROTULO_PUBLICOS: Readonly<Record<PublicosQueUsa, string>> = {
  uno: "Uno",
  varios: "Varios",
  uno_o_varios: "Uno o varios",
};

/** El `usa` del graficador de la tarjeta; `null` si la tarjeta no trae gráfico o el catálogo no lo conoce. */
export function usaDeGrafico(graficador: string | null | undefined): UsaGrafico | null {
  if (!graficador) return null;
  return CATALOGO_GRAFICOS.find((g) => g.name === graficador)?.usa ?? null;
}

export type PublicoEnFicha = {
  base: string;
  publico: string;
  n: number;
  /** Preguntas del estudio de los tipos que usa el gráfico. */
  preguntas: number;
  padron: boolean;
};

export type CruceConEstudio = {
  publicos: PublicoEnFicha[];
  /** «73 preguntas de escala en Docentes, 60 en Estudiantes»; vacío si ningún público tiene preguntas de ese tipo. */
  resumen: string;
  /** Una línea por cosa que no alcanza; vacío si el estudio tiene lo que el gráfico usa. */
  faltas: string[];
  alcanza: boolean;
};

const TIPOS: readonly (keyof PreguntasDelPublico)[] = ["escala", "opcion_unica", "multiple", "numerica", "abierta"];

function preguntasQueUsa(p: PreguntasDelPublico, usa: readonly PreguntaQueUsa[]): number {
  const tipos = usa.includes("cualquiera") ? TIPOS : TIPOS.filter((t) => usa.includes(t));
  return tipos.reduce((s, t) => s + p[t], 0);
}

/** «de escala», «de escala o de opción múltiple»; con «cualquiera», nada (son «preguntas» a secas). */
export function fraseTipos(usa: readonly PreguntaQueUsa[]): string {
  if (usa.includes("cualquiera")) return "";
  const frases = usa.flatMap((t) => (t === "cualquiera" ? [] : [PREGUNTA_EN_FRASE[t]]));
  return frases.join(" o ");
}

const lista = (xs: readonly string[]): string =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

/** Cruza lo que usa el gráfico con lo que tiene cada público del estudio. */
export function cruzarConEstudio(usa: UsaGrafico, inventario: readonly InventarioPublico[]): CruceConEstudio {
  const publicos: PublicoEnFicha[] = inventario.map((b) => ({
    base: b.base,
    publico: b.publico,
    n: b.n,
    preguntas: preguntasQueUsa(b.preguntas, usa.pregunta),
    padron: b.padron.declarado,
  }));
  const conPreguntas = publicos.filter((p) => p.preguntas > 0);
  const tipos = fraseTipos(usa.pregunta);
  const sustantivo = (n: number) => (n === 1 ? "pregunta" : "preguntas");
  const resumen = conPreguntas.map((p, i) => (i === 0
    ? `${formatoConteo(p.preguntas)} ${sustantivo(p.preguntas)}${tipos ? ` ${tipos}` : ""} en ${p.publico}`
    : `${formatoConteo(p.preguntas)} en ${p.publico}`)).join(", ");

  const faltas: string[] = [];
  if (!publicos.length) {
    faltas.push("El estudio no tiene bases cargadas.");
  } else if (!conPreguntas.length) {
    faltas.push(tipos ? `Ningún público tiene preguntas ${tipos}.` : "Ningún público tiene preguntas.");
  } else if (usa.publicos === "varios" && conPreguntas.length < 2) {
    faltas.push(`Usa dos públicos o más y solo ${conPreguntas[0]?.publico ?? "uno"} tiene preguntas${tipos ? ` ${tipos}` : ""}.`);
  }
  if (usa.padron && publicos.length) {
    const sinPadron = publicos.filter((p) => !p.padron).map((p) => p.publico);
    if (sinPadron.length === publicos.length) faltas.push("Usa padrón y ningún público lo tiene declarado.");
    else if (sinPadron.length) faltas.push(`Falta el padrón de ${lista(sinPadron)}.`);
  }
  return { publicos, resumen, faltas, alcanza: faltas.length === 0 };
}

/** Estado del inventario del estudio mientras el selector está abierto (se pide una vez por apertura). */
export type EstadoInventario =
  | { estado: "inactivo" }
  | { estado: "cargando" }
  | { estado: "listo"; publicos: InventarioPublico[] }
  | { estado: "error"; mensaje: string };
