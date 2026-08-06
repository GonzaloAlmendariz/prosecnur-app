// equivalencias.ts — equivalencia declarada entre públicos (ADR 0062).
//
// La misma pregunta vive en cada público con otro nombre de variable, y el
// modelo no tenía dónde guardar esa tabla. Estos endpoints la declaran: la app
// emite una plantilla poblada, el analista empareja y escribe la etiqueta
// estándar, y al importarla las etiquetas aterrizan en la configuración de CADA
// base — nunca en la global, que es lo que el ADR 0061 dejó prohibido.

import { apiFetch, handle, headers } from "./core";

export type EquivalenciaFila = {
  seccion: string;
  etiqueta_estandar: string;
  /** `base -> nombre de variable en esa base`. */
  variables: Record<string, string>;
  /** En cuántos públicos existe la pregunta. Derivado, no escrito por nadie. */
  cantidad: number;
};

export type EquivalenciaCoberturaBase = {
  n_declaradas: number;
  n_calzan: number;
  /** Variables que la matriz nombra y el instrumento de hoy ya no tiene. */
  huerfanas: string[];
  sello: string;
};

export type EquivalenciasEstado = {
  ok: boolean;
  /** Falso cuando el estudio no tiene bases separadas: la pestaña no aplica. */
  disponible: boolean;
  declarada: boolean;
  n_filas: number;
  n_sin_etiqueta?: number;
  bases: string[];
  importada_en?: string;
  cobertura: Record<string, EquivalenciaCoberturaBase>;
  /** Bases cuyo instrumento cambió después de importar la declaración. */
  desfasadas: string[];
  filas?: EquivalenciaFila[];
};

export type EquivalenciasPlantilla = {
  ok: boolean;
  file_id: string;
  filename: string;
  size: number;
};

export type EquivalenciasAplicacionBase = {
  aplicadas: number;
  /** Etiquetas editadas a mano que se conservaron en vez de pisarse. */
  conservadas: number;
};

export type EquivalenciasImportacion = {
  ok: boolean;
  estado: EquivalenciasEstado;
  aplicacion: Record<string, EquivalenciasAplicacionBase>;
};

export async function getEquivalencias(): Promise<EquivalenciasEstado> {
  return handle<EquivalenciasEstado>(
    await apiFetch("/api/carga/equivalencias", { headers: headers() }),
  );
}

export async function generarPlantillaEquivalencias(): Promise<EquivalenciasPlantilla> {
  return handle<EquivalenciasPlantilla>(
    await apiFetch("/api/carga/equivalencias/plantilla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

export async function importarEquivalencias(
  fileId: string,
  hoja?: string,
): Promise<EquivalenciasImportacion> {
  return handle<EquivalenciasImportacion>(
    await apiFetch("/api/carga/equivalencias/importar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: fileId, hoja }),
    }),
  );
}
