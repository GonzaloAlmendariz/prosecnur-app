// Ficha «Datos» del detalle del selector (auditoría del selector, hallazgo 2): qué preguntas y qué públicos usa el
// gráfico de una tarjeta (`usa` de CATALOGO_GRAFICOS) y qué tiene el estudio para él (`apiGraficosInventario`). La
// ficha dice los hechos y, si algo no alcanza, qué falta; no bloquea la tarjeta ni recomienda otra: decide el analista.
// Pura: la ficha la pinta y los tests la prueban sola.

import type { InventarioPublico, PreguntasDelPublico } from "../../../../api/graficosInventario";
import {
  CATALOGO_GRAFICOS, type PreguntaQueUsa, type PublicosQueUsa, type UsaGrafico,
} from "../../iconos/catalogoTipos.generated";
import type { Slide } from "../../../../api/graficos";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { nombrePublico } from "../gruposPadron/modeloPadron";
import { tarjetaContarDeLamina } from "./intencionesContar";
import type { PresetLamina } from "./opcionesLamina";

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

/**
 * El `usa` de una tarjeta: el de su graficador con lo que la tarjeta declara encima (S1). La composición manda: el
 * contraste estilo resumen es `p_dumbbell` (uno o varios públicos) y compara públicos, así que usa varios.
 */
export function usaDeTarjeta(preset: Pick<PresetLamina, "grafico" | "usa"> | null | undefined): UsaGrafico | null {
  const base = usaDeGrafico(preset?.grafico?.graficador);
  return base ? { ...base, ...preset?.usa } : null;
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
    // S7: el público con la capitalización del motor («Docentes», no «docentes»).
    publico: nombrePublico(b.publico),
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
  } else if (usa.publicos === "varios" && publicos.length === 1) {
    faltas.push("El estudio tiene un solo público.");
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

// ---- La vista partida: qué difiere entre las dos fichas (S6) -----------------------------------------------------------

export type FilaFicha = "preguntas" | "publicos" | "estudio";

const mismos = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Las filas de la ficha «Datos» que no dicen lo mismo en las dos tarjetas de la vista partida: los tipos de pregunta y
 * el cruce, los públicos y el padrón, y lo que el estudio tiene (o le falta) para cada una. Sin las dos fichas, ninguna.
 */
export function filasQueDifieren(
  a: UsaGrafico | null,
  b: UsaGrafico | null,
  inventario: EstadoInventario,
): Set<FilaFicha> {
  const out = new Set<FilaFicha>();
  if (!a || !b) return out;
  if (!mismos(a.pregunta, b.pregunta) || a.cruce !== b.cruce) out.add("preguntas");
  if (a.publicos !== b.publicos || a.padron !== b.padron) out.add("publicos");
  if (inventario.estado === "listo") {
    const ca = cruzarConEstudio(a, inventario.publicos);
    const cb = cruzarConEstudio(b, inventario.publicos);
    if (ca.resumen !== cb.resumen || !mismos(ca.faltas, cb.faltas)) out.add("estudio");
  }
  return out;
}

// ---- El cierre con hallazgos: usa cifras de otras láminas (S8) ---------------------------------------------------------

/** Cuántas láminas de resumen tiene el informe, sin contar los cierres (de ahí salen sus cifras). */
export function laminasDeResumen(slides: readonly Pick<Slide, "tipo" | "payload">[]): number {
  return slides.filter((s) => s.tipo !== "p_slide_cierre_hallazgos" && tarjetaContarDeLamina(s)?.clase === "resumen").length;
}

/** «El informe tiene 3 láminas de resumen.»; sin ninguna, lo que falta. */
export function informeParaCierre(n: number): { resumen: string; falta: string | null } {
  if (n <= 0) return { resumen: "", falta: "El informe no tiene láminas de resumen." };
  return { resumen: `El informe tiene ${n === 1 ? "1 lámina" : `${formatoConteo(n)} láminas`} de resumen.`, falta: null };
}
