// Carga › Equivalencias con la forma del prototipo "carga-equivalencias": la
// tabla de la misma pregunta en cada base, sus filtros y la escala de la fila
// elegida. Lógica pura: el estado de cada fila sale de `indicadorDeEscala`
// (el mismo que usaba la tabla anterior) y las escalas de cada base del
// catálogo que publica el motor (`GET /api/carga/equivalencias/variables`).
// Todo cruce es por código, nunca por etiqueta ni por posición.

import type { OpcionDeEscala, VariableDeBase } from "../../../../api/equivalencias";
import type { ChromeStatusTone } from "../../../../components/ModuleCommandBar";
import { focoDeFila } from "../../armonizacionModel";
import type { FilaEditor } from "../../equivalenciasEditorModel";
import { esCompuesta } from "../../indicadorCompuestoModel";
import type { NombreDeSerie } from "../../nombreDeSerie";
import { coincidenciaDeEscala, indicadorDeEscala } from "../../preguntaEquivalenteModel";
import { claveDeFilaCruce } from "../../segmentos/segmentosModel";

/**
 * Lo que el prototipo dibuja y el motor no publica. Se declara en la cabecera
 * (`cifrasPendientes`) para que la diferencia con el prototipo tenga su causa.
 */
export const HUECOS_DEL_MOTOR_EQUIVALENCIAS =
  '"Casos que cambian, 212 de 671": GET /api/carga/equivalencias no publica por fila cuántos casos cambian de categoría con la escala común guardada (pedido: filas[].armonizacion_resumen = { n_cambian, n_total }); el preview lo da por base y solo al abrir la armonización';

export type FiltroDeEquivalencias = "todas" | "armonizar" | "falta";

export const FILTROS_DE_EQUIVALENCIAS: readonly { clave: FiltroDeEquivalencias; rotulo: string }[] = [
  { clave: "todas", rotulo: "Todas" },
  { clave: "armonizar", rotulo: "Por armonizar" },
  { clave: "falta", rotulo: "Falta en alguna base" },
];

export type EstadoDeFila = {
  tono: ChromeStatusTone;
  /** El rótulo corto de la columna "Escala". */
  texto: string;
  /** La causa, para el `title` y el inspector. */
  explicacion: string;
  /** Pide una decisión: entra en "Por armonizar". */
  porArmonizar: boolean;
  /** Ninguna de sus preguntas tiene lista de respuestas (abierta, numérica): no hay escala que armonizar. */
  sinLista: boolean;
  /** Se puede abrir la armonización de la fila (con dos bases elegidas). */
  abre: boolean;
};

/** Rótulos cortos del prototipo para los textos largos del indicador. */
const ROTULO_CORTO: Record<string, string> = {
  "Escalas distintas: armonizar": "Por armonizar",
  "Sin lista de respuestas": "Sin lista",
};

/** "Revisar mapa en 2 bases" y "No comparable en 3 bases" caben en la columna sin las bases; el detalle va al `title`. */
export function rotuloCorto(texto: string): string {
  if (ROTULO_CORTO[texto]) return ROTULO_CORTO[texto];
  if (texto.startsWith("Revisar mapa")) return "Revisar mapa";
  if (texto.startsWith("No comparable")) return "No comparable";
  return texto;
}

export function estadoDeFila(
  fila: FilaEditor,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
  serie: NombreDeSerie,
): EstadoDeFila {
  if (claveDeFilaCruce(fila) !== null) {
    return { tono: "success", texto: "Segmento de cruce", explicacion: 'Su escala sale del segmento: se edita en "Segmentos de cruce".', porArmonizar: false, sinLista: false, abre: false };
  }
  if (esCompuesta(fila)) {
    return { tono: "info", texto: "Indicador compuesto", explicacion: "Cuenta un sí cuando alguna de sus preguntas marca uno de sus códigos.", porArmonizar: false, sinLista: false, abre: false };
  }
  const ind = indicadorDeEscala(fila, bases, variablesPorBase, serie);
  const tono: ChromeStatusTone = ind.tono === "ok" ? "success" : ind.tono === "aviso" ? "warn" : "neutral";
  const conEscalaComun = Boolean(fila.armonizacion && fila.armonizacion.escala.length > 0);
  return {
    tono,
    texto: rotuloCorto(ind.texto),
    explicacion: ind.explicacion,
    porArmonizar: ind.tono === "aviso",
    sinLista: !conEscalaComun && coincidenciaDeEscala(bases, fila.variables, variablesPorBase).tipo === "sin_lista",
    abre: ind.abre,
  };
}

/** En cuántas de las bases de la tabla está la fila. */
export function basesConPregunta(fila: Pick<FilaEditor, "variables">, bases: readonly string[]): number {
  return bases.filter((b) => Boolean(fila.variables[b])).length;
}

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** La fila coincide con la búsqueda por su nombre en el informe o por el código en alguna base. */
export function coincideBusqueda(fila: Pick<FilaEditor, "etiqueta_estandar" | "variables">, busqueda: string): boolean {
  const q = sinTildes(busqueda.trim());
  if (!q) return true;
  if (sinTildes(fila.etiqueta_estandar).includes(q)) return true;
  return Object.values(fila.variables).some((v) => Boolean(v) && sinTildes(v).includes(q));
}

export function cumpleFiltro(
  filtro: FiltroDeEquivalencias,
  estado: Pick<EstadoDeFila, "porArmonizar">,
  enBases: number,
  nBases: number,
): boolean {
  if (filtro === "armonizar") return estado.porArmonizar;
  if (filtro === "falta") return enBases < nBases;
  return true;
}

export type FilaDeMesa = {
  fila: FilaEditor;
  estado: EstadoDeFila;
  enBases: number;
};

export function filasDeMesa(
  filas: readonly FilaEditor[],
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
  serie: NombreDeSerie,
): FilaDeMesa[] {
  return filas.map((fila) => ({
    fila,
    estado: estadoDeFila(fila, bases, variablesPorBase, serie),
    enBases: basesConPregunta(fila, bases),
  }));
}

export function conteoPorFiltro(filas: readonly FilaDeMesa[], nBases: number): Record<FiltroDeEquivalencias, number> {
  const conteo: Record<FiltroDeEquivalencias, number> = { todas: 0, armonizar: 0, falta: 0 };
  for (const f of filas) {
    for (const { clave } of FILTROS_DE_EQUIVALENCIAS) {
      if (cumpleFiltro(clave, f.estado, f.enBases, nBases)) conteo[clave] += 1;
    }
  }
  return conteo;
}

export function filasVisibles(
  filas: readonly FilaDeMesa[],
  filtro: FiltroDeEquivalencias,
  busqueda: string,
  nBases: number,
): FilaDeMesa[] {
  return filas.filter((f) => cumpleFiltro(filtro, f.estado, f.enBases, nBases) && coincideBusqueda(f.fila, busqueda));
}

/** Las cifras de la cabecera: emparejadas, por armonizar y en todas las bases. */
export function cifrasDeEquivalencias(filas: readonly FilaDeMesa[], nBases: number) {
  return {
    emparejadas: filas.length,
    porArmonizar: resumenDeEscalas(filas).porArmonizar,
    enTodas: nBases > 0 ? filas.filter((f) => f.enBases === nBases).length : 0,
  };
}

/**
 * Lo que la matriz tiene pendiente de escala, con la misma definición que la
 * tabla y su filtro: lo usan la cabecera y el paso "Matriz" del recorrido de la
 * serie, para que una cifra no tenga dos lecturas en la misma pantalla.
 */
export type ResumenDeEscalas = { porArmonizar: number; sinLista: number };

export function resumenDeEscalas(filas: readonly Pick<FilaDeMesa, "estado">[]): ResumenDeEscalas {
  return {
    porArmonizar: filas.filter((f) => f.estado.porArmonizar).length,
    sinLista: filas.filter((f) => f.estado.sinLista).length,
  };
}

/** La fila que nombra el `foco` de la dirección: por su id de bloque o por su posición guardada. */
export function filaDeFoco(filas: readonly FilaEditor[], foco: string | null): FilaEditor | null {
  if (!foco) return null;
  return filas.find((f) => focoDeFila(f) === foco) ?? null;
}

/**
 * La fila del inspector: la elegida si sigue en la tabla; si no, la primera
 * visible. Con la tabla vacía, ninguna.
 */
export function filaDelInspector(visibles: readonly FilaDeMesa[], todas: readonly FilaDeMesa[], elegida: string | null): FilaDeMesa | null {
  if (elegida) {
    const enTodas = todas.find((f) => f.fila.id === elegida);
    if (enTodas) return enTodas;
  }
  return visibles[0] ?? null;
}

export type EscalaDeBase = {
  base: string;
  /** Código de la pregunta en esa base; vacío si la base no la tiene. */
  variable: string;
  opciones: readonly OpcionDeEscala[];
};

/** La escala de la pregunta en cada base, del catálogo del motor, cruzada por código de variable. */
export function escalasDeFila(
  fila: Pick<FilaEditor, "variables">,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): EscalaDeBase[] {
  return bases.map((base) => {
    const variable = fila.variables[base] ?? "";
    const entrada = variable ? (variablesPorBase[base] ?? []).find((v) => v.name === variable) : undefined;
    return { base, variable, opciones: entrada?.opciones ?? [] };
  });
}

export type PasoDeMapa = {
  /** Bases que llevan sus respuestas a la escala común de la misma forma. */
  bases: string[];
  /** "Muy mala" y "Mala" pasan a Mala; "Buena" y "Muy buena" a Buena. */
  frase: string;
};

export function enumerarConY(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * El mapa guardado de la armonización, en palabras: por cada base, qué
 * respuestas pasan a otra categoría de la escala común. Cruza por código
 * (`mapa[codigo de la base] = codigo de la escala`); la etiqueta solo se lee.
 * Una respuesta que llega a una categoría con su mismo nombre no se nombra.
 * Las bases con la misma frase se juntan.
 */
export function mapaEnPalabras(
  fila: Pick<FilaEditor, "armonizacion" | "variables">,
  escalas: readonly EscalaDeBase[],
): PasoDeMapa[] {
  const arm = fila.armonizacion;
  if (!arm || arm.escala.length === 0) return [];
  const destino = new Map(arm.escala.map((c) => [c.codigo, c.etiqueta || c.codigo]));
  const pasos: PasoDeMapa[] = [];
  for (const { base, opciones } of escalas) {
    const mapa = arm.por_base[base]?.mapa ?? {};
    // Con mapa vacío la base pasa tal cual (identidad); con mapa, una respuesta sin destino queda fuera.
    const conMapa = Object.keys(mapa).length > 0;
    const porDestino = new Map<string, string[]>();
    const fuera: string[] = [];
    for (const op of opciones) {
      const cod = mapa[op.codigo];
      if (!cod) {
        if (conMapa) fuera.push(op.etiqueta || op.codigo);
        continue;
      }
      const nombreDestino = destino.get(cod) ?? cod;
      const nombreOrigen = op.etiqueta || op.codigo;
      if (sinTildes(nombreOrigen) === sinTildes(nombreDestino)) continue;
      porDestino.set(nombreDestino, [...(porDestino.get(nombreDestino) ?? []), nombreOrigen]);
    }
    const partes = [...porDestino.entries()].map(([d, origenes], i) =>
      `${enumerarConY(origenes.map((o) => `"${o}"`))} ${i === 0 ? (origenes.length === 1 ? "pasa a" : "pasan a") : "a"} ${d}`);
    if (fuera.length > 0) {
      partes.push(`${enumerarConY(fuera.map((o) => `"${o}"`))} ${fuera.length === 1 ? "queda" : "quedan"} sin categoría`);
    }
    if (partes.length === 0) continue;
    const frase = partes.join("; ");
    const previo = pasos.find((p) => p.frase === frase);
    if (previo) previo.bases.push(base);
    else pasos.push({ bases: [base], frase });
  }
  return pasos;
}

