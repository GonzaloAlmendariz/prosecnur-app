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
  /** Diapositiva del informe a la que va la pregunta (ADR 0062). */
  diapositiva?: string;
  /**
   * Enunciado de la diapositiva (ADR 0064): el texto que el importador de matrices
   * pierde al aplanar el grupo en sus ítems, y el que titula la diapositiva del mazo.
   * Viaja por fila porque el formato plano no tiene dónde poner un atributo de
   * grupo; todas las filas de una diapositiva llevan el mismo.
   */
  enunciado?: string;
  /**
   * Cómo se dibuja el bloque: `""` (barras multiapiladas, el defecto) o `radar`.
   * Es un atributo del BLOQUE —los temas que comparten escala— y como el
   * enunciado viaja repetido en sus filas, que es lo que el formato plano
   * permite.
   */
  grafico?: string;
  /**
   * Códigos de la escala que suman el indicador, separados por coma: `"3,4"` es
   * el top-two-box de una escala de 4 puntos más un «sin información».
   *
   * Se declara y no se deduce: cuál es el corte es una decisión metodológica del
   * estudio, no una propiedad de la escala. Un radar necesita UN número por eje
   * y por serie; las barras dibujan la distribución entera y no lo necesitan.
   */
  corte?: string;
  /**
   * Clave de estilo del radar. Vacía = `comparativo`, el que sincroniza con la
   * matriz. Es del BLOQUE porque el estilo dice cómo se lee ese bloque: una
   * batería de perfil se presenta con líneas y una de diagnóstico con la grilla
   * a la vista, y las dos conviven en el mismo mazo.
   */
  estilo?: string;
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
  /**
   * Estilos de radar que ofrece el motor. Llegan del backend y no se copian
   * aquí: uno nuevo aparece en la pestaña sin tocar el frontend, y uno retirado
   * deja de ofrecerse en vez de quedar como opción muerta.
   */
  estilos_radar?: { value: string; label: string; hint?: string }[];
  /**
   * Largo máximo del nombre de un tema para que el bloque pueda salir como
   * radar. Viaja desde el motor y no se copia aquí: el editor no puede ofrecer
   * un radar que el mazo va a rechazar después, porque entonces lo declarado
   * deja de ser lo que sale.
   */
  radar_max_etiqueta?: number;
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

export type VariableDeBase = {
  name: string;
  label: string;
  seccion: string;
  /**
   * Firma de escala: códigos y etiquetas de su lista, en orden. Es lo que se
   * COMPARA para las invariantes E1/E2 del ADR 0064.
   */
  firma?: string;
  /**
   * Opciones de esa escala, enteras y con la caja original del instrumento. Es
   * lo que se MUESTRA; nunca se compara, porque dos listas distintas pueden
   * verse iguales una vez resumidas. Viajan completas a propósito: cuánto cabe
   * en pantalla lo decide la superficie, que es quien sabe cuánto espacio tiene.
   */
  opciones?: OpcionDeEscala[];
};

export type OpcionDeEscala = { codigo: string; etiqueta: string };

export async function getVariablesEquivalencias(): Promise<{
  ok: boolean;
  variables: Record<string, VariableDeBase[]>;
}> {
  return handle(
    await apiFetch("/api/carga/equivalencias/variables", { headers: headers() }),
  );
}
