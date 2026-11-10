// Grupos internos de las aperturas (p_dumbbell estilo resumen con cruce; ADR 0135 §6, maqueta graficos-sintesis,
// Grupos). Modelo puro: qué grupos entran (hasta cuatro, en el orden en que se eligen), su padrón, el aviso del grupo
// chico y la línea «Base:» de la nota escrita con el mismo formato que el motor:
//   - `.base_frase` (graficos_espec_contraste.R): sólo los casos, sin cobertura, con los grupos dentro de su público:
//     «Base: 24 docentes de TC y 91 de TPA» (Gonzalo, 2026-11-10). La sigla declarada entre paréntesis manda; un nombre
//     común va en minúscula y uno con mayúsculas propias queda como se declaró (`.base_rotulo`).
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
    const incluido = elegidos.includes(o.codigo);
    const n = conteos?.get(o.codigo) ?? null;
    return {
      codigo: o.codigo, etiqueta: o.etiqueta, n, incluido, bloqueado: !incluido && lleno,
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

/** Los grupos incluidos en el orden de la lámina (el de `grupos`), no el de la lista. */
export function incluidosEnOrden(filas: readonly FilaGrupo[], args: Args): FilaGrupo[] {
  return gruposElegidos(args).flatMap((c) => filas.filter((f) => f.codigo === c));
}

const pct = (n: number, u: number) => Math.floor((100 * n) / u + 0.5 + 1e-9);

/** La base de un grupo como la escribe el motor: «91 (88%)» con padrón confiable que lo cubre; si no, «91». */
export function baseDeGrupo(n: number, padron: Padron): string {
  const u = padron.confiable ? padron.valor : null;
  if (u === null || u <= 0 || n > u) return formatoConteo(n);
  return `${formatoConteo(n)} (${pct(n, u)}%)`;
}

/** Un grupo como lo escribe la base del motor (`.base_rotulo`): la sigla entre paréntesis, la sigla sola, o el nombre en minúscula. */
export function rotuloEnBase(etiqueta: string): string {
  const x = etiqueta.replace(/_+/g, " ").trim();
  const sigla = /\(([A-ZÁÉÍÓÚÑ0-9]{2,})\)\s*$/.exec(x);
  if (sigla) return sigla[1];
  if (/^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(x)) return x;
  return /[A-ZÁÉÍÓÚÑ]/.test(x.slice(1)) ? x : x.charAt(0).toLowerCase() + x.slice(1);
}

/** «a, b y c». */
function lista(xs: readonly string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

/**
 * La línea «Base:» que irá en la nota, o `null` si no hay dos grupos con conteo (la vista previa no inventa una base).
 * Con el público del cruce: «Base: 24 docentes de TC y 91 de TPA»; sin él: «Base: 24 de TC y 91 de TPA».
 */
export function lineaBase(incluidos: readonly FilaGrupo[], publico: string | null = null): string | null {
  if (incluidos.length < 2 || incluidos.some((f) => f.n === null)) return null;
  const piezas = incluidos.map((f, i) => {
    const n = formatoConteo(f.n as number), r = rotuloEnBase(f.etiqueta);
    return i === 0 && publico ? `${n} ${publico} de ${r}` : `${n} de ${r}`;
  });
  return `Base: ${lista(piezas)}`;
}

/** Cómo nombra el motor a los casos del cruce: la base en minúscula («docentes»); sin base, «casos». */
export function unidadDeCruce(cruce: string): string {
  const i = cruce.indexOf("$");
  const base = i > 0 ? cruce.slice(0, i).trim() : "";
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
