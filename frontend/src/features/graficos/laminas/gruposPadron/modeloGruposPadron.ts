// Grupos internos de las aperturas (p_dumbbell estilo resumen con cruce; ADR 0135 §6, maqueta graficos-sintesis,
// Grupos). Modelo puro: qué grupos entran (hasta cuatro, en el orden en que se eligen), su padrón, el aviso del grupo
// chico y la línea «Base:» de la nota escrita con el mismo formato que el motor:
//   - `.contraste_base_texto`: «115 (93%)» con padrón confiable que lo cubre; «115» sin él (graficos_espec_contraste.R).
//   - `nota_base`: «Base: » y los grupos separados por «; ».
//   - `.dumbbell_nota_grupo_chico`: «Grupo chico: 24 docentes TC.» o «Grupos chicos: …; ….» (umbral 30).
// La vista previa usa los casos de cada grupo en el cruce. El motor usa los de cada pregunta, que pueden ser menos (quien
// no respondió una pregunta no cuenta en su base); cuando cambian de pregunta a pregunta, el pie da su rango.

import { formatoConteo } from "../../../../lib/formatoNumero";
import { gruposElegidos, MAX_GRUPOS_RESUMEN, type Opcion } from "../brecha/modeloBrechaGrupos";
import { padronDe, UMBRAL_GRUPO_CHICO, type Padron } from "./modeloPadron";

type Args = Readonly<Record<string, unknown>>;

export type FilaGrupo = {
  codigo: string;
  etiqueta: string;
  /** Casos del grupo en el cruce; `null` si no hay conteo. */
  n: number | null;
  incluido: boolean;
  /** Lugar en la lámina (1 = primero); `null` fuera. */
  posicion: number | null;
  /** Fuera y con el tope lleno: no se puede encender. */
  bloqueado: boolean;
  padron: Padron;
  chico: boolean;
};

/** Las filas de la lista: una por opción del cruce, en el orden del instrumento. */
export function filasGrupos(opciones: readonly Opcion[], conteos: ReadonlyMap<string, number> | null, args: Args, tope = MAX_GRUPOS_RESUMEN): FilaGrupo[] {
  const elegidos = gruposElegidos(args);
  const lleno = elegidos.length >= tope;
  return opciones.map((o) => {
    const i = elegidos.indexOf(o.codigo);
    const incluido = i >= 0;
    const n = conteos?.get(o.codigo) ?? null;
    return {
      codigo: o.codigo, etiqueta: o.etiqueta, n, incluido, posicion: incluido ? i + 1 : null, bloqueado: !incluido && lleno,
      padron: padronDe(args, o.etiqueta), chico: n !== null && n < UMBRAL_GRUPO_CHICO,
    };
  });
}

/** Encender agrega el grupo al final (el orden de la lámina es el de elección); apagar lo quita. Nunca pasa del tope. */
export function alternarGrupo(args: Args, codigo: string, incluir: boolean, tope = MAX_GRUPOS_RESUMEN): Record<string, unknown> {
  const actuales = gruposElegidos(args);
  if (incluir) {
    if (actuales.includes(codigo) || actuales.length >= tope) return { grupos: actuales };
    return { grupos: [...actuales, codigo] };
  }
  return { grupos: actuales.filter((g) => g !== codigo) };
}

/**
 * Mueve un grupo incluido un lugar antes (-1) o después (+1) en la lámina; con dos, mover es invertir la diferencia.
 * En el borde, o fuera de la lámina, devuelve el orden tal cual.
 */
export function moverGrupo(args: Args, codigo: string, delta: -1 | 1): Record<string, unknown> {
  const actuales = gruposElegidos(args);
  const i = actuales.indexOf(codigo);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= actuales.length) return { grupos: actuales };
  const nuevos = [...actuales];
  [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
  return { grupos: nuevos };
}

/**
 * La diferencia que calcula la lámina con los grupos de hoy: con dos, «TC menos TP» (el primero menos el segundo); con
 * más, «el mayor menos el menor»; con menos de dos, `null`.
 */
export function textoDiferencia(incluidos: readonly FilaGrupo[]): string | null {
  if (incluidos.length < 2) return null;
  if (incluidos.length > 2) return "Diferencia: el mayor menos el menor";
  return `Diferencia: ${incluidos[0].etiqueta} menos ${incluidos[1].etiqueta}`;
}

/** Los grupos incluidos en el orden de la lámina (el de `grupos`), no el de la lista. */
export function incluidosEnOrden(filas: readonly FilaGrupo[], args: Args): FilaGrupo[] {
  return gruposElegidos(args).flatMap((c) => filas.filter((f) => f.codigo === c));
}

const pct = (n: number, u: number) => Math.floor((100 * n) / u + 0.5 + 1e-9);

/**
 * La relación del grupo con su padrón, con la regla del motor (`.contraste_base_texto`): sin n o sin padrón no hay
 * nada que mostrar; una n mayor que el padrón no lleva cobertura; con el padrón no confiable la cobertura se calcula
 * igual pero no va en la base.
 */
export type CoberturaGrupo =
  | { tipo: "en-base" | "fuera-de-base"; n: number; padron: number; pct: number }
  | { tipo: "supera"; n: number; padron: number };

export function coberturaDeGrupo(n: number | null, padron: Padron): CoberturaGrupo | null {
  const u = padron.valor;
  if (n === null || u === null || u <= 0) return null;
  if (n > u) return { tipo: "supera", n, padron: u };
  return { tipo: padron.confiable ? "en-base" : "fuera-de-base", n, padron: u, pct: pct(n, u) };
}

/** «Cobertura 88%», «Cobertura 88%, no va en la base» o «139 supera el padrón (120): la base va sin cobertura». */
export function textoCobertura(c: CoberturaGrupo): string {
  if (c.tipo === "supera") return `${formatoConteo(c.n)} supera el padrón (${formatoConteo(c.padron)}): la base va sin cobertura`;
  return c.tipo === "en-base" ? `Cobertura ${c.pct}%` : `Cobertura ${c.pct}%, no va en la base`;
}

/** La base de un grupo como la escribe el motor: «91 (88%)» con padrón confiable que lo cubre; si no, «91». */
export function baseDeGrupo(n: number, padron: Padron): string {
  const c = coberturaDeGrupo(n, padron);
  return c?.tipo === "en-base" ? `${formatoConteo(n)} (${c.pct}%)` : formatoConteo(n);
}

/**
 * La línea «Base:» que irá en la nota, o `null` si no hay dos grupos con conteo (la vista previa no inventa una base).
 */
export function lineaBase(incluidos: readonly FilaGrupo[]): string | null {
  if (incluidos.length < 2 || incluidos.some((f) => f.n === null)) return null;
  return `Base: ${incluidos.map((f) => `${f.etiqueta} ${baseDeGrupo(f.n as number, f.padron)}`).join("; ")}`;
}

/** Cómo nombra el motor a los casos del cruce: la base en minúscula («docentes»); sin base, «casos». */
export function unidadDeCruce(cruce: string): string {
  const base = baseDeCruce(cruce);
  return base ? base.toLowerCase() : "casos";
}

/** El aviso del grupo chico con el texto del pie del motor, o `null` si ningún grupo incluido queda bajo 30. */
export function notaGrupoChico(incluidos: readonly FilaGrupo[], unidad: string): string | null {
  const chicos = incluidos.filter((f) => f.chico && f.n !== null);
  if (!chicos.length) return null;
  const piezas = chicos.map((f) => `${formatoConteo(f.n)} ${unidad} ${f.etiqueta}`);
  return `${chicos.length === 1 ? "Grupo chico" : "Grupos chicos"}: ${piezas.join("; ")}.`;
}

/** «3 de 4». */
export function textoTope(incluidos: number, tope = MAX_GRUPOS_RESUMEN): string {
  return `${incluidos} de ${tope}`;
}

/** Los grupos incluidos sin padrón escrito, en el orden de la lámina: su base va sólo con n. */
export function gruposSinPadron(incluidos: readonly FilaGrupo[]): string[] {
  return incluidos.filter((f) => f.padron.valor === null).map((f) => f.etiqueta);
}

/** «Sin padrón: TC, TP. La base va sólo con n.», o `null` si todos lo tienen. */
export function textoSinPadron(etiquetas: readonly string[]): string | null {
  return etiquetas.length ? `Sin padrón: ${etiquetas.join(", ")}. La base va sólo con n.` : null;
}

/** La base de la pregunta que divide («docentes$dedicacion» → «docentes»); vacío si no la declara. */
export function baseDeCruce(cruce: string): string {
  const i = cruce.indexOf("$");
  return i > 0 ? cruce.slice(0, i).trim() : "";
}
