// Modelo puro de «Revisar emparejado» en el contraste entre públicos (ADR 0135 §7, enmienda al ADR 0104 en Gráficos).
//
// Cuatro estados por pregunta:
//   - «En la matriz»: el par lo declara la matriz de equivalencias (filas sin `sugerida`).
//   - «Confirmado en esta lámina»: el par está en el payload del contraste (`vars`/`titulos_grupo`, la forma de
//     EditorTemasEquivalentes), así que la regla del contraste ya lo cuenta como par común.
//   - «Sugerido por el texto»: el backend propone una pregunta de la otra base por parecido de texto. No entra a la
//     lámina ni a la regla hasta que el analista la confirma, fila por fila. El único lote es «Confirmar los idénticos»
//     (loteIdenticos.ts, X6): sólo pares de texto idéntico, y cada uno se deshace solo.
//   - «Sin par»: sin sugerencia, o con la sugerencia descartada.
// «Guardar lo confirmado en la matriz» funde los pares confirmados en la declaración (GET, unión, POST): completa o
// agrega filas y nunca quita ni reemplaza las que ya estaban.

import type { EquivalenciaFila, VariableDeBase } from "../../../../api/equivalencias";
import type { VarInfo } from "../../../../api/graficos";
import type { Emparejado, PreguntaDeBase, PreguntaEmparejado } from "../../../../api/graficosEmparejado";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { claveTema, type TemaPublicos } from "../../multiapiladas/temasPublicos";
import { basesDelPar, esSelectOne } from "../../temasEquivalentes/temasEquivalentesModel";

export type EstadoEmparejado = "matriz" | "confirmado" | "sugerido" | "sin_par";
export type FiltroEmparejado = "todas" | "por_confirmar" | "sin_par";

export type FilaEmparejado = {
  /** `base$var` de la pregunta que la fila representa. */
  clave: string;
  pregunta: PreguntaEmparejado;
  estado: EstadoEmparejado;
  /** El par: el de la matriz, el confirmado o la sugerencia de mayor puntaje. `null` sin par. */
  par: PreguntaDeBase | null;
  /** Puntaje de la sugerencia (sólo en «sugerido»). */
  puntaje: number | null;
  /** La base donde se busca el par. */
  otraBase: string;
};

export type ConteoEmparejado = Record<EstadoEmparejado, number> & { total: number };

export const ROTULO_ESTADO: Record<EstadoEmparejado, string> = {
  matriz: "En la matriz",
  confirmado: "Confirmado en esta lámina",
  sugerido: "Sugerido por el texto",
  sin_par: "Sin par",
};

export const refDe = (p: PreguntaDeBase): string => `${p.base}$${p.var}`;

/**
 * Las dos bases del contraste: las declaradas en `bases`; si no, las de sus temas, en su orden; si ningún tema tiene
 * las dos todavía y el estudio tiene exactamente dos bases, ésas. Si no, ninguna: falta elegirlas en la tarjeta.
 */
export function basesDelContraste(args: Readonly<Record<string, unknown>>, basesEstudio: readonly string[]): string[] {
  return basesDelPar(args, basesEstudio);
}

export type FuenteVariables = { name: string; variables: readonly VarInfo[] };

/**
 * Las preguntas de una base que pueden ser el par: de opción única y, si la pregunta tiene firma de escala, con la misma
 * (la regla del contraste sólo compara pares con la misma escala). Las que la matriz ya empareja no se ofrecen.
 */
export function opcionesDeBase(
  fuentes: readonly FuenteVariables[],
  base: string,
  firma: string | undefined,
  excluir: ReadonlySet<string>,
): VariableDeBase[] {
  const vars = fuentes.find((f) => f.name === base)?.variables ?? [];
  return vars
    .filter((v) => esSelectOne(v.tipo) && (!firma || v.scale_signature === firma) && !excluir.has(`${base}$${v.name}`))
    .map((v) => ({ name: v.name, label: v.label, seccion: v.seccion ?? "", ...(v.scale_signature ? { firma: v.scale_signature } : {}) }));
}

/** Las preguntas de la matriz (no se ofrecen como par) y las ya confirmadas en la lámina (elegirlas las mueve). */
export function preguntasOcupadas(filas: readonly FilaEmparejado[]): { matriz: Set<string>; lamina: Set<string> } {
  const matriz = new Set<string>();
  const lamina = new Set<string>();
  for (const f of filas) {
    if (!f.par || (f.estado !== "matriz" && f.estado !== "confirmado")) continue;
    const destino = f.estado === "matriz" ? matriz : lamina;
    destino.add(f.clave);
    destino.add(refDe(f.par));
  }
  return { matriz, lamina };
}

/** Las variables de `base` ya confirmadas en la lámina en OTRA fila (el par propio de la fila no cuenta). */
export function tomadasEnBase(lamina: ReadonlySet<string>, fila: FilaEmparejado): Set<string> {
  const propio = fila.par ? refDe(fila.par) : "";
  const prefijo = `${fila.otraBase}$`;
  return new Set([...lamina].filter((r) => r.startsWith(prefijo) && r !== propio).map((r) => r.slice(prefijo.length)));
}

/** La firma de escala y el rótulo de una pregunta en las fuentes del estudio. */
export function variableDe(fuentes: readonly FuenteVariables[], base: string, variable: string): VarInfo | undefined {
  return fuentes.find((f) => f.name === base)?.variables.find((v) => v.name === variable);
}

function partirRef(ref: string): { base: string; var: string } {
  const i = ref.indexOf("$");
  return i < 0 ? { base: "", var: ref } : { base: ref.slice(0, i), var: ref.slice(i + 1) };
}

/** Los pares que la lámina ya tiene: temas con exactamente una pregunta en cada una de las dos bases. */
export function paresDeLamina(temas: readonly TemaPublicos[], bases: readonly string[]): Map<string, string> {
  const pares = new Map<string, string>();
  if (bases.length !== 2) return pares;
  for (const t of temas) {
    if (t.vars.length !== 2) continue;
    const [a, b] = t.vars;
    const ba = partirRef(a).base; const bb = partirRef(b).base;
    if (ba === bb || !bases.includes(ba) || !bases.includes(bb) || partirRef(a).var === "*" || partirRef(b).var === "*") continue;
    pares.set(a, b);
    pares.set(b, a);
  }
  return pares;
}

/** El par sin orden: `A$x|B$y` y `B$y|A$x` son el mismo. */
const clavePar = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/**
 * Las filas de la revisión. El backend lista primero las preguntas de la primera base (con su par de la matriz o sin
 * par) y después las de la segunda que quedan sin par; un par confirmado en la lámina lo representa la primera fila que
 * lo nombra y la otra pregunta no se repite. Las sugerencias que apuntan a una pregunta ya emparejada se descartan.
 * Un par sugerido se cuenta una vez: si la pregunta B sugiere la misma A que ya la sugería, la fila de B no sale (el par
 * espejo), así que el filtro, el lote y los conteos cuentan pares. Confirmar desde la fila que queda es lo mismo que desde
 * la otra (confirmarPar ordena el par por bases), y descartarla descarta el par: la otra pregunta tampoco lo propone.
 * @param etiquetaDe Rótulo de una pregunta por `base$var` (para un par confirmado que no venía en las sugerencias).
 */
export function filasEmparejado(
  datos: Emparejado,
  temas: readonly TemaPublicos[],
  bases: readonly string[],
  descartadas: ReadonlySet<string>,
  etiquetaDe: (ref: string) => string | undefined = () => undefined,
): FilaEmparejado[] {
  const pares = paresDeLamina(temas, bases);
  const enMatriz = new Set<string>();
  for (const p of datos.preguntas) {
    if (p.estado === "matriz" && p.par) { enMatriz.add(refDe(p)); enMatriz.add(refDe(p.par)); }
  }
  const tomadas = new Set<string>([...enMatriz, ...pares.keys()]);
  const vistas = new Set<string>();
  const paresSugeridos = new Set<string>();
  const paresDescartados = new Set<string>();
  const filas: FilaEmparejado[] = [];
  for (const p of datos.preguntas) {
    const clave = refDe(p);
    if (vistas.has(clave)) continue;
    const otraBase = bases.find((b) => b !== p.base) ?? "";
    if (p.estado === "matriz" && p.par) {
      vistas.add(clave); vistas.add(refDe(p.par));
      filas.push({ clave, pregunta: p, estado: "matriz", par: p.par, puntaje: null, otraBase });
      continue;
    }
    const parRef = pares.get(clave);
    if (parRef) {
      vistas.add(clave); vistas.add(parRef);
      const { base, var: variable } = partirRef(parRef);
      const etiqueta = p.sugerencias.find((s) => refDe(s) === parRef)?.etiqueta ?? etiquetaDe(parRef) ?? variable;
      filas.push({ clave, pregunta: p, estado: "confirmado", par: { base, var: variable, etiqueta }, puntaje: null, otraBase });
      continue;
    }
    const libres = p.sugerencias.filter((s) => !tomadas.has(refDe(s)));
    if (descartadas.has(clave)) {
      // Descartar es del par, no de la cara: la otra pregunta tampoco vuelve a proponerlo.
      if (libres[0]) paresDescartados.add(clavePar(clave, refDe(libres[0])));
      vistas.add(clave);
      filas.push({ clave, pregunta: p, estado: "sin_par", par: null, puntaje: null, otraBase });
      continue;
    }
    const sugerencia = libres.find((s) => !paresDescartados.has(clavePar(clave, refDe(s))));
    // El par espejo (A sugiere B y B sugiere A) ya lo muestra la fila de A: la de B no se repite (E1).
    if (sugerencia && paresSugeridos.has(clavePar(clave, refDe(sugerencia)))) continue;
    vistas.add(clave);
    if (sugerencia) paresSugeridos.add(clavePar(clave, refDe(sugerencia)));
    filas.push(sugerencia
      ? { clave, pregunta: p, estado: "sugerido", par: { base: sugerencia.base, var: sugerencia.var, etiqueta: sugerencia.etiqueta }, puntaje: sugerencia.puntaje, otraBase }
      : { clave, pregunta: p, estado: "sin_par", par: null, puntaje: null, otraBase });
  }
  return filas;
}

export function contarEstados(filas: readonly FilaEmparejado[]): ConteoEmparejado {
  const c: ConteoEmparejado = { matriz: 0, confirmado: 0, sugerido: 0, sin_par: 0, total: filas.length };
  for (const f of filas) c[f.estado] += 1;
  return c;
}

export function filtrarFilas(filas: readonly FilaEmparejado[], filtro: FiltroEmparejado): FilaEmparejado[] {
  if (filtro === "por_confirmar") return filas.filter((f) => f.estado === "sugerido");
  if (filtro === "sin_par") return filas.filter((f) => f.estado === "sin_par");
  return [...filas];
}

/** «47 en la matriz, 6 sin par»: sólo los estados que tienen preguntas. */
export function resumenEmparejado(c: ConteoEmparejado): string {
  const piezas = [
    c.matriz ? `${formatoConteo(c.matriz)} en la matriz` : "",
    c.confirmado ? `${formatoConteo(c.confirmado)} ${c.confirmado === 1 ? "confirmada" : "confirmadas"} en la lámina` : "",
    c.sugerido ? `${formatoConteo(c.sugerido)} por confirmar` : "",
    c.sin_par ? `${formatoConteo(c.sin_par)} sin par` : "",
  ].filter(Boolean);
  return piezas.length ? piezas.join(", ") : "Sin preguntas de escala";
}

export function rotuloFiltro(filtro: FiltroEmparejado, c: ConteoEmparejado): string {
  if (filtro === "por_confirmar") return `Por confirmar (${formatoConteo(c.sugerido)})`;
  if (filtro === "sin_par") return `Sin par (${formatoConteo(c.sin_par)})`;
  return `Todas (${formatoConteo(c.total)})`;
}

// ---- La lámina: confirmar, cambiar y quitar --------------------------------------------------------------------------

function claveLibre(titulo: string, temas: readonly TemaPublicos[]): string {
  const usadas = new Set(temas.map((t) => t.key));
  const base = claveTema(titulo) || "tema";
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/**
 * Confirmar un par en la lámina (Confirmar una sugerencia, Cambiar o Buscar par). El tema que ya nombraba a la pregunta
 * se reescribe con el par en el orden de las bases; si ninguno la nombra, se agrega uno con el texto de la pregunta como
 * título. La otra pregunta sale de cualquier otro tema (elegirla aquí la mueve) y un tema que se queda sin preguntas en
 * dos bases se quita: su fila vuelve a quedar por revisar.
 */
export function confirmarPar(
  temas: readonly TemaPublicos[],
  bases: readonly string[],
  pregunta: PreguntaDeBase,
  par: PreguntaDeBase,
  titulo: string,
): TemaPublicos[] {
  const r1 = refDe(pregunta); const r2 = refDe(par);
  const ordenadas = bases.map((b) => (b === pregunta.base ? r1 : b === par.base ? r2 : "")).filter(Boolean);
  let destino = temas.findIndex((t) => t.vars.includes(r1));
  if (destino < 0) destino = temas.findIndex((t) => t.vars.includes(r2));
  const out: TemaPublicos[] = [];
  temas.forEach((t, i) => {
    if (i === destino) { out.push({ ...t, vars: ordenadas }); return; }
    const vars = t.vars.filter((r) => r !== r1 && r !== r2);
    if (vars.length === t.vars.length) out.push(t);
    else if (new Set(vars.map((r) => partirRef(r).base)).size >= 2) out.push({ ...t, vars });
  });
  if (destino < 0) {
    const limpio = titulo.trim() || pregunta.etiqueta || pregunta.var;
    out.push({ key: claveLibre(limpio, out), title: limpio, vars: ordenadas });
  }
  return out;
}

/** Quitar de la lámina el par confirmado de una pregunta: sale el tema que la nombra. */
export function quitarPar(temas: readonly TemaPublicos[], ref: string): TemaPublicos[] {
  return temas.filter((t) => !t.vars.includes(ref));
}

// ---- La matriz: guardar lo confirmado ----------------------------------------------------------------------------------

export type ParConfirmado = { a: PreguntaDeBase; b: PreguntaDeBase; tema: string };

export type UnionMatriz = {
  filas: EquivalenciaFila[];
  agregadas: number;
  completadas: number;
  yaEstaban: number;
  /** La matriz ya empareja una de las dos preguntas con otra: no se toca. */
  enConflicto: ParConfirmado[];
};

export function confirmadosDe(filas: readonly FilaEmparejado[]): ParConfirmado[] {
  return filas.flatMap((f) => (f.estado === "confirmado" && f.par ? [{ a: f.pregunta, b: f.par, tema: f.pregunta.tema }] : []));
}

const conVariable = (f: EquivalenciaFila, base: string, variable: string): EquivalenciaFila => {
  const variables = { ...f.variables, [base]: variable };
  return { ...f, variables, cantidad: Object.keys(variables).length };
};

/**
 * La unión de la matriz con los pares confirmados. Por cada par: si una fila ya tiene las dos preguntas, queda (y si era
 * una propuesta sin confirmar, deja de serlo); si una fila tiene una de las dos y la otra base vacía, se completa; si la
 * matriz empareja alguna con otra pregunta, el par queda en conflicto y no se toca nada; si no, se agrega una fila sin
 * `sugerida`. El resultado nunca tiene menos filas que la matriz.
 */
export function unirConMatriz(matriz: readonly EquivalenciaFila[], pares: readonly ParConfirmado[]): UnionMatriz {
  const filas = [...matriz];
  let agregadas = 0; let completadas = 0; let yaEstaban = 0;
  const enConflicto: ParConfirmado[] = [];
  for (const par of pares) {
    const { a, b } = par;
    const i = filas.findIndex((f) => f.variables[a.base] === a.var);
    const j = filas.findIndex((f) => f.variables[b.base] === b.var);
    if (i >= 0 && i === j) {
      if (filas[i].sugerida) {
        const confirmada = { ...filas[i] };
        delete confirmada.sugerida;
        filas[i] = confirmada;
        completadas += 1;
      } else yaEstaban += 1;
    } else if (i >= 0 && j < 0 && !filas[i].variables[b.base]) {
      filas[i] = conVariable(filas[i], b.base, b.var);
      completadas += 1;
    } else if (j >= 0 && i < 0 && !filas[j].variables[a.base]) {
      filas[j] = conVariable(filas[j], a.base, a.var);
      completadas += 1;
    } else if (i >= 0 || j >= 0) {
      enConflicto.push(par);
    } else {
      filas.push({ seccion: "", etiqueta_estandar: par.tema || a.etiqueta, variables: { [a.base]: a.var, [b.base]: b.var }, cantidad: 2 });
      agregadas += 1;
    }
  }
  return { filas, agregadas, completadas, yaEstaban, enConflicto };
}

const filasTxt = (n: number) => (n === 1 ? "1 fila" : `${formatoConteo(n)} filas`);

/** El aviso antes de guardar: lo que se agrega, lo que se completa y lo que no se toca. */
export function avisoUnion(u: UnionMatriz): string {
  const piezas = [
    u.agregadas ? `Se ${u.agregadas === 1 ? "agrega" : "agregan"} ${filasTxt(u.agregadas)} a la matriz` : "",
    u.completadas ? `se ${u.completadas === 1 ? "completa" : "completan"} ${filasTxt(u.completadas)}` : "",
  ].filter(Boolean);
  const cambio = piezas.length ? `${piezas.join(" y ")}.` : "La matriz ya tiene estos pares.";
  const conflicto = u.enConflicto.length
    ? ` ${u.enConflicto.length === 1 ? "1 par no se guarda" : `${formatoConteo(u.enConflicto.length)} pares no se guardan`}: la matriz ya empareja esa pregunta con otra.`
    : "";
  return `${cambio.charAt(0).toUpperCase()}${cambio.slice(1)}${conflicto}`;
}

export const hayCambiosEnUnion = (u: UnionMatriz): boolean => u.agregadas + u.completadas > 0;
