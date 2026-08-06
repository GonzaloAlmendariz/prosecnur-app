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
  /** Lámina del informe a la que va la pregunta (ADR 0062). */
  diapositiva?: string;
  /**
   * Propuesta del motor, no decisión del analista. La marca es el contrato con
   * la UI: sin ella una sugerencia se vería igual que algo ya confirmado.
   */
  sugerida?: boolean;
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
  /**
   * Huella del CONTENIDO de la declaración (ADR 0063). Gráficos la compara
   * contra la que quedó grabada al aplicar el mazo para saber si envejeció.
   */
  revision?: string;
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

export async function getSugerenciasEquivalencias(): Promise<{
  ok: boolean;
  sugerencias: EquivalenciaFila[];
}> {
  return handle(
    await apiFetch("/api/carga/equivalencias/sugerencias", { headers: headers() }),
  );
}

export async function guardarEquivalencias(
  filas: EquivalenciaFila[],
): Promise<EquivalenciasImportacion> {
  return handle<EquivalenciasImportacion>(
    await apiFetch("/api/carga/equivalencias/declaracion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ filas }),
    }),
  );
}

export type VariableDeBase = { name: string; label: string; seccion: string };

export async function getVariablesEquivalencias(): Promise<{
  ok: boolean;
  variables: Record<string, VariableDeBase[]>;
}> {
  return handle(
    await apiFetch("/api/carga/equivalencias/variables", { headers: headers() }),
  );
}
