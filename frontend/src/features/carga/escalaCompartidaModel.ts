/**
 * Armonizar por escala (checklist OIGD 2026-10-15, G3).
 *
 * Una escala de frecuencia («Nunca», «Una vez», «Dos a tres veces»…, «No sé»)
 * se repite en veinte preguntas, y armonizarlas una por una repetía la misma
 * decisión veinte veces. Aquí se decide a qué otras filas guardadas se puede
 * llevar la armonización de una fila sin volver a mirarlas: las que, en cada
 * una de sus bases, usan la misma lista de respuestas que la fila de origen en
 * esa misma base.
 *
 * «La misma lista» es la firma tolerante: códigos y etiquetas normalizadas
 * (minúsculas, sin tildes, sin puntuación, espacios colapsados). Los especiales
 * (80–99) cuentan con su código como cualquier otro: «No sé = 88» y
 * «No sé = 99» son listas distintas. Una fila que casa sólo en algunas de sus
 * bases no se ofrece: se cuenta aparte, para decir que quedó fuera.
 *
 * `mismaEscalaModel` cubre otra cosa: filas cuyas bases ya comparten la lista
 * idéntica y sólo hay que confirmar la identidad.
 */

import type {
  Armonizacion,
  ArmonizacionBase,
  EquivalenciaFila,
  OpcionDeEscala,
  VariableDeBase,
} from "../../api/equivalencias";
import type { FilaEditor } from "./equivalenciasEditorModel";
import { etiquetaTolerante } from "./etiquetaTolerante";
import { esCompuesta } from "./indicadorCompuestoModel";

// ---- Firma tolerante ----------------------------------------------------------

// La normalización vive en `etiquetaTolerante.ts`; se reexporta para sus usuarios de siempre.
export { etiquetaTolerante };

function clavesTolerantes(opciones: readonly OpcionDeEscala[]): string[] {
  return opciones
    .filter((o) => o.codigo.trim())
    .map((o) => `${o.codigo.trim()}=${etiquetaTolerante(o.etiqueta)}`)
    .sort();
}

/**
 * Firma de una lista de respuestas que ignora tildes, puntuación, mayúsculas y
 * el orden en que el instrumento las lista. Vacía si no hay lista.
 */
export function firmaTolerante(opciones: readonly OpcionDeEscala[] | undefined): string {
  return clavesTolerantes(opciones ?? []).join("|");
}

export function opcionesDe(
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
  base: string,
  variable: string | undefined,
): OpcionDeEscala[] {
  if (!variable) return [];
  return (variablesPorBase[base] ?? []).find((v) => v.name === variable)?.opciones ?? [];
}

// ---- Traducción del mapa --------------------------------------------------------

/**
 * La entrada de la base de origen llevada a otra pregunta de esa misma base.
 * Cada código de la pregunta destino va a donde iba, en el origen, la opción
 * con su misma etiqueta tolerante. Un mapa vacío es identidad y se queda vacío:
 * con la firma igual, los códigos son los mismos. `null` si la base no está
 * declarada en el origen.
 */
export function traducirEntrada(
  origen: ArmonizacionBase | undefined,
  opcionesOrigen: readonly OpcionDeEscala[],
  opcionesDestino: readonly OpcionDeEscala[],
): ArmonizacionBase | null {
  if (!origen) return null;
  const nota = origen.nota?.trim();
  const base: ArmonizacionBase = { comparable: origen.comparable, ...(nota ? { nota } : {}), mapa: {} };
  if (!origen.comparable) return base;
  if (!Object.values(origen.mapa).some(Boolean)) return base;
  const porEtiqueta = new Map<string, string>();
  for (const o of opcionesOrigen) {
    const clave = etiquetaTolerante(o.etiqueta);
    if (!porEtiqueta.has(clave)) porEtiqueta.set(clave, o.codigo.trim());
  }
  for (const d of opcionesDestino) {
    const codigo = d.codigo.trim();
    if (!codigo) continue;
    const codigoOrigen = porEtiqueta.get(etiquetaTolerante(d.etiqueta));
    const destino = codigoOrigen ? origen.mapa[codigoOrigen] : undefined;
    if (destino) base.mapa[codigo] = destino;
  }
  return base;
}

// ---- Candidatos ---------------------------------------------------------------

export type CandidatoEscala = {
  /** Posición en la declaración guardada. */
  indice: number;
  etiqueta: string;
  /** `base -> variable`, en el orden de la serie. */
  variables: { base: string; variable: string }[];
  armonizacion: Armonizacion;
  /** Ya tiene una armonización propia, distinta: aplicarla la reemplaza. */
  reemplaza: boolean;
};

export type CandidatosEscala = {
  candidatos: CandidatoEscala[];
  /** Casan en alguna de sus bases pero no en todas: quedan fuera. */
  parciales: number;
};

function mismasVariables(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a).filter((k) => a[k]);
  const kb = Object.keys(b).filter((k) => b[k]);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/**
 * Posiciones guardadas que el editor de la tabla todavía muestra tal cual. Una
 * fila con sus preguntas cambiadas sin guardar, o quitada sin guardar, queda
 * fuera: lo guardado ya no es lo que se ve. Sin editor, todas.
 */
export function indicesIntactos(
  guardadas: readonly EquivalenciaFila[],
  editor: readonly FilaEditor[] | null,
): Set<number> {
  if (!editor) return new Set(guardadas.map((_, i) => i));
  const out = new Set<number>();
  for (const f of editor) {
    const i = f.indice_declarado;
    if (typeof i !== "number" || !guardadas[i]) continue;
    if (mismasVariables(f.variables, guardadas[i].variables)) out.add(i);
  }
  return out;
}

function canonica(arm: Armonizacion | null | undefined): string {
  if (!arm) return "";
  const porBase = Object.keys(arm.por_base).sort().map((b) => {
    const e = arm.por_base[b];
    const mapa = Object.keys(e.mapa).sort().map((k) => `${k}>${e.mapa[k]}`).join(",");
    return `${b}:${e.comparable ? 1 : 0}:${e.nota ?? ""}:${mapa}`;
  });
  return `${arm.escala.map((c) => `${c.codigo}=${c.etiqueta}`).join("|")}#${porBase.join(";")}`;
}

/**
 * Otras filas guardadas a las que se puede llevar la armonización `origen` de
 * la fila `indiceOrigen`. Quedan fuera los indicadores compuestos, las
 * propuestas sin confirmar, las filas con cambios sin guardar, las de una sola
 * base y las que ya tienen exactamente esta armonización.
 */
export function candidatosDeEscala({
  indiceOrigen,
  origen,
  guardadas,
  editor,
  bases,
  variablesPorBase,
}: {
  indiceOrigen: number;
  origen: Armonizacion | null;
  guardadas: readonly EquivalenciaFila[];
  editor: readonly FilaEditor[] | null;
  bases: readonly string[];
  variablesPorBase: Record<string, readonly VariableDeBase[]>;
}): CandidatosEscala {
  const filaOrigen = guardadas[indiceOrigen];
  if (!origen || origen.escala.length === 0 || !filaOrigen || esCompuesta(filaOrigen)) {
    return { candidatos: [], parciales: 0 };
  }
  const firmaOrigen: Record<string, string> = {};
  for (const b of bases) {
    if (!origen.por_base[b]) continue;
    firmaOrigen[b] = firmaTolerante(opcionesDe(variablesPorBase, b, filaOrigen.variables[b]));
  }
  const intactos = indicesIntactos(guardadas, editor);
  const candidatos: CandidatoEscala[] = [];
  let parciales = 0;
  guardadas.forEach((fila, indice) => {
    if (indice === indiceOrigen || fila.sugerida || esCompuesta(fila) || !intactos.has(indice)) return;
    const conVariable = bases.filter((b) => fila.variables[b]);
    if (conVariable.length < 2) return;
    const casan = conVariable.filter((b) => {
      const firma = firmaTolerante(opcionesDe(variablesPorBase, b, fila.variables[b]));
      return Boolean(firma) && firma === firmaOrigen[b];
    });
    if (casan.length === 0) return;
    if (casan.length < conVariable.length) {
      parciales += 1;
      return;
    }
    const por_base: Record<string, ArmonizacionBase> = {};
    for (const b of conVariable) {
      const entrada = traducirEntrada(
        origen.por_base[b],
        opcionesDe(variablesPorBase, b, filaOrigen.variables[b]),
        opcionesDe(variablesPorBase, b, fila.variables[b]),
      );
      if (entrada) por_base[b] = entrada;
    }
    const armonizacion: Armonizacion = { escala: origen.escala.map((c) => ({ ...c })), por_base };
    const previa = fila.armonizacion && fila.armonizacion.escala.length > 0 ? fila.armonizacion : null;
    if (previa && canonica(previa) === canonica(armonizacion)) return;
    candidatos.push({
      indice,
      etiqueta: fila.etiqueta_estandar.trim(),
      variables: conVariable.map((b) => ({ base: b, variable: fila.variables[b] })),
      armonizacion,
      reemplaza: Boolean(previa),
    });
  });
  return { candidatos, parciales };
}

/** Las que van marcadas al abrir: las que todavía no tienen armonización propia. */
export function marcadosPorDefecto(candidatos: readonly CandidatoEscala[]): Set<number> {
  return new Set(candidatos.filter((c) => !c.reemplaza).map((c) => c.indice));
}

/**
 * La declaración guardada con la armonización de cada fila elegida reemplazada.
 * Las demás viajan como estaban; la de origen ya viene armonizada en `guardadas`.
 */
export function filasConEscalaAplicada(
  guardadas: readonly EquivalenciaFila[],
  candidatos: readonly CandidatoEscala[],
  elegidos: ReadonlySet<number>,
): EquivalenciaFila[] {
  const porIndice = new Map(candidatos.filter((c) => elegidos.has(c.indice)).map((c) => [c.indice, c]));
  return guardadas.map((f, i) => {
    const c = porIndice.get(i);
    return c ? { ...f, armonizacion: c.armonizacion } : f;
  });
}

// ---- Textos -------------------------------------------------------------------

export function textoAplicarA(n: number): string {
  return n === 1 ? "Aplicar a 1 pregunta" : `Aplicar a ${n} preguntas`;
}

export function textoHayCompartidas(n: number): string {
  return n === 1 ? "Otra pregunta usa esta misma escala." : `Otras ${n} preguntas usan esta misma escala.`;
}

export function textoParciales(n: number): string {
  return n === 1
    ? "1 pregunta casa sólo en algunas de sus bases y queda fuera: armonízala aparte."
    : `${n} preguntas casan sólo en algunas de sus bases y quedan fuera: armonízalas aparte.`;
}
