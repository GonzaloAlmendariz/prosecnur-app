// Avisos del resultado de un comparativo, agrupados por tipo y con severidad
// (P-A4). Un comparativo con decenas de preguntas devolvía decenas de avisos
// sueltos, todos en ámbar, y lo esperado (una pregunta que no existía en una
// medición) tapaba lo que cambia la lectura (casos fuera del denominador).
//
// Severidad:
// - «advertencia»: cambia denominadores o deja algo fuera del archivo, o el
//   motor no dice qué es (sin_mapa, variable que no está en la base, avisos de
//   ponderación del motor y cualquier tipo que el cliente no conoce).
// - «informativo»: lo esperado de una serie armonizada; no cambia ninguna cifra
//   publicada (sin_variable, variable excluida en Analítica, peso ignorado por
//   decisión declarada, suma de pesos distinta de N, nota sin pregunta).
// Las omitidas (`pregunta_omitida`, `cruce_omitido`) no pasan por aquí: tienen
// su bloque destacado arriba.

import type { ComparativoAviso } from "../../../api/analitica";
import { accionParaAviso, cantidad, etiquetaDeAviso, type AccionDeError } from "./comparativosModel";

export type SeveridadAviso = "advertencia" | "informativo";

export type GrupoDeAvisos = {
  clave: string;
  etiqueta: string;
  severidad: SeveridadAviso;
  /** Cuántas preguntas, bases o notas abarca el grupo, con su sustantivo. */
  alcance: string;
  avisos: ComparativoAviso[];
  /** Acción común del grupo, si todos sus avisos llevan al mismo sitio. */
  accion: AccionDeError | null;
};

const INFORMATIVOS = new Set([
  "sin_variable",
  "variable_ausente:excluida",
  "peso_ignorado",
  "suma_pesos",
  "nota_sin_pregunta",
]);

function claveDe(aviso: ComparativoAviso): string {
  return aviso.motivo ? `${aviso.tipoOriginal}:${aviso.motivo}` : aviso.tipoOriginal || "otro";
}

export function severidadDeAviso(aviso: ComparativoAviso): SeveridadAviso {
  return INFORMATIVOS.has(claveDe(aviso)) ? "informativo" : "advertencia";
}

// Las preguntas se cuentan por su fila (una pregunta sin variable en dos
// mediciones es una pregunta, no dos); las de ponderación, por base.
function alcanceDe(avisos: readonly ComparativoAviso[]): string {
  const tipo = avisos[0]?.tipoOriginal ?? "";
  if (tipo === "ponderacion" || tipo === "peso_ignorado" || tipo === "suma_pesos") {
    const bases = new Set(avisos.map((a) => a.base ?? ""));
    return cantidad(bases.size, "base", "bases");
  }
  if (tipo === "nota_sin_pregunta") return cantidad(avisos.length, "nota", "notas");
  const filas = new Set(avisos.map((a) => a.fila || a.mensaje));
  if (avisos.every((a) => a.fila)) return cantidad(filas.size, "pregunta", "preguntas");
  return cantidad(avisos.length, "aviso", "avisos");
}

function accionComun(avisos: readonly ComparativoAviso[]): AccionDeError | null {
  const acciones = avisos.map(accionParaAviso);
  const primera = acciones[0];
  if (!primera) return null;
  return acciones.every((a) => a && a.href === primera.href) ? primera : null;
}

/**
 * Agrupa por tipo (y motivo), primero las advertencias y dentro de cada
 * severidad los grupos más grandes. El orden de los avisos dentro de un grupo
 * es el del motor.
 */
export function gruposDeAvisos(avisos: readonly ComparativoAviso[]): GrupoDeAvisos[] {
  const porClave = new Map<string, ComparativoAviso[]>();
  for (const aviso of avisos) {
    const clave = claveDe(aviso);
    const lista = porClave.get(clave);
    if (lista) lista.push(aviso);
    else porClave.set(clave, [aviso]);
  }
  const grupos: GrupoDeAvisos[] = [...porClave.entries()].map(([clave, lista]) => ({
    clave,
    etiqueta: etiquetaDeAviso(lista[0]),
    severidad: severidadDeAviso(lista[0]),
    alcance: alcanceDe(lista),
    avisos: lista,
    accion: accionComun(lista),
  }));
  const peso = (g: GrupoDeAvisos) => (g.severidad === "advertencia" ? 0 : 1);
  return grupos.sort((a, b) => peso(a) - peso(b) || b.avisos.length - a.avisos.length);
}
