// Lo que hizo el usuario, en palabras, para cada motivo de "sin guardar".
//
// El backend anota como motivo la clave de sesión que cambió (`session_set`),
// la función que marcó el proyecto cuando el sitio no dio clave
// (`.mark_project_dirty` toma su nombre con `sys.call`), varias claves unidas
// con " + " (`session_set_many`) o un texto con la circunstancia entre
// paréntesis. Esta es la única tabla que los traduce: la UI nunca muestra el
// identificador. Lo que no esté aquí cae en un rótulo genérico con el área
// donde vive el cambio ("Cambio en Validación").

import { areaDeMotivo } from "./modeloMotivosSinGuardar";

/** Motivo exacto (clave de sesión o función) → acción. */
const ACCIONES: Readonly<Record<string, string>> = {
  // Carga: bases, archivos y revisión
  data_raw: "Se cargaron las respuestas",
  files: "Se cambiaron los archivos de Carga",
  estudio: "Se cambiaron las bases del estudio",
  estudio_ensure: "Se preparó el estudio en Carga",
  estudio_add_base: "Se agregó una base",
  estudio_remove_base: "Se quitó una base",
  estudio_rename_base: "Se renombró una base",
  estudio_active_base_set: "Se cambió la base activa",
  estudio_set_nombre: "Se cambió el nombre del estudio",
  estudio_set_topology: "Se cambió la organización de las bases",
  estudio_set_processing_mode: "Se cambió la organización de las bases",
  estudio_update_base_metadata: "Se cambiaron los datos de una base",
  estudio_replace_base_files: "Se reemplazaron los archivos de una base",
  estudio_preserve_original_base_files: "Se conservaron los archivos originales de las bases",
  estudio_apply_template_xlsform_logic: "Se aplicó la lógica del formulario a las bases",
  estudio_mark_independent_shared_logic: "Se aplicó la lógica del formulario a las bases",
  sm_multibase_apply_canonical_xlsform_logic: "Se aplicó la lógica del formulario a las bases",
  estudio_propagate_shared_codif_logic: "Se aplicó la codificación compartida a las bases",
  estudio_promote_independent_siblings: "Se separaron las bases independientes",
  ".carga_review_set_reconciliation": "Se confirmaron las columnas fuera del formulario",
  ".carga_review_confirm_choice_mapping": "Se confirmaron los códigos de respuesta",
  choice_code_maps_confirmed: "Se confirmaron los códigos de respuesta",
  choice_code_maps_pending: "Se encontraron códigos de respuesta por confirmar",
  choice_code_mapping: "Se ajustaron los códigos de respuesta",
  ".instrument_revision_binding_apply": "Se vinculó la versión del formulario a la base",
  ".carga_platform_finalize": "Se actualizaron las respuestas desde la plataforma",
  ".carga_refresh_kobo_independent": "Se actualizaron las respuestas desde la plataforma",
  ".carga_kobo_refresh_repeat_bases": "Se actualizaron las respuestas desde la plataforma",
  ".sm_mb_update_base_raw_snapshot": "Se actualizaron las respuestas desde la plataforma",
  ".sm_mb_update_base_refresh_files": "Se actualizaron las respuestas desde la plataforma",
  ".sm_wb_update_base_import": "Se actualizaron las respuestas desde la plataforma",
  ".carga_xlsx_register_repeat_bases": "Se registraron las bases de grupos repetidos",
  ".carga_sm_guardar_fuentes": "Se importaron bases",
  sm_multibase_import_independent: "Se importaron bases",
  sm_multibase_sav_bundle_import: "Se importaron bases",
  multi_integrated_import: "Se importaron bases",
  ".acb_state_with_materialization": "Se importaron bases",
  ".acsav_state_with_materialization": "Se importaron bases",
  multi_integrated_draft: "Se cambió la integración de bases",
  sm_multibase_decision_apply: "Se aplicó la integración de bases",
  equivalencias_publicos: "Se cambiaron las equivalencias entre públicos",
  carga_actualizar_revertir: "Se revirtió la actualización de respuestas",
  carga_formulario_publicado_importar: "Se importó el formulario publicado",
  carga_universe_filter_apply: "Se cambió el universo de análisis",
  origen_externo_declarar: "Se declaró el origen externo de la base",
  base_variables_carga_registrar: "Se cambiaron las variables de la base",
  ".base_variables_tras_mutar": "Se cambiaron las variables de la base",
  base_variables_marcar_codificada: "Se marcó una variable como codificada",
  ".segmentos_escribir_estudio": "Se cambiaron los segmentos del estudio",
  segmentos_quitar: "Se cambiaron los segmentos del estudio",
  label_overrides: "Se cambiaron rótulos de preguntas",

  // Formulario
  instrumento: "Se cambió el formulario",
  xlsform_state: "Se editó el formulario",
  xlsform_forms: "Se editó el formulario",
  mount_xlsform_editor: "Se editó el formulario",
  xlsform_forms_confirm_logic: "Se confirmó la lógica del formulario",
  xlsform_logica_externa_declarar: "Se declaró la lógica hecha fuera de la app",
  xlsform_revision_publish: "Se publicó una versión del formulario",
  xlsform_campana_declarar: "Se cambiaron las campañas del formulario",
  xlsform_campana_quitar: "Se cambiaron las campañas del formulario",
  ".xlsform_impreso_escribir": "Se cambió el formulario impreso",

  // Validación y limpieza
  validacion_scope_set: "Se cambió la base de Validación",
  validacion_operational_config: "Se cambió la configuración de Validación",
  validacion_variables_excluidas: "Se cambiaron las variables excluidas de Validación",
  reglas_custom: "Se cambiaron las reglas de Validación",
  evaluacion: "Se revisaron las reglas de Validación",
  limpieza_draft: "Se cambiaron las decisiones de limpieza",
  ".limpieza_invalidate_downstream": "Se cambiaron las decisiones de limpieza",
  limpieza_preview: "Se preparó la base limpia",
  limpieza_artifacts: "Se preparó la base limpia",
  ".limpieza_promover_base": "Se aprobó la base limpia",
  ".limpieza_revertir_promocion": "Se retiró la aprobación de la base limpia",

  // Codificación
  codif_source_active: "Se cambió la base de Codificación",
  codif_por_base: "Se cambió la codificación",
  codif_set: "Se cambió la codificación",
  ".codif_config_audit_add": "Se cambió la codificación",
  codif_aplicado: "Se aplicó la codificación a la base",
  ".codif_rotulos_refrescar_sesion": "Se cambiaron los rótulos de la base codificada",
  ".codif_switch_analitica_to_adapted": "Analítica pasó a la base codificada",
  texto_abierto_diccionario: "Se cambió el diccionario de respuestas abiertas",

  // Analítica, Gráficos y Dashboard
  analitica_fuente: "Se cambió la base de Analítica",
  analitica_config: "Se cambió la configuración de Analítica",
  analitica_config_por_base: "Se cambió la configuración de Analítica",
  graficos_config: "Se cambió la configuración de Gráficos",
  graficos_config_por_base: "Se cambió la configuración de Gráficos",
  graficos_consolidado: "Se cambió el informe consolidado",
  graficos_consolidado_draft: "Se cambió el informe consolidado",
  graficos_consolidado_draft_set: "Se cambió el informe consolidado",
  graficos_consolidado_start: "Se cambió el informe consolidado",
  dashboard_source: "Se cambió la base del Dashboard",
  dashboard_config: "Se cambió la configuración del Dashboard",
  dashboard_curacion: "Se cambió la selección del Dashboard",

  // Campo
  monitoreo_config: "Se cambió la configuración de Monitoreo",
  monitoreo_sources: "Se cambiaron las fuentes de Monitoreo",
  monitoreo_snapshot: "Se actualizó el avance de Monitoreo",
  collection_state: "Se cambió el material de campo",
  ".collection_store": "Se cambió el material de campo",
  material_aulas_siembra: "Se cambió el material de campo",
  collection_aulas_siembra_put: "Se cambió el material de campo",
  ".cmail_contactos_touch": "Se cambiaron los contactos de la campaña por correo",
  collection_mail_contacts_control_put: "Se cambiaron los contactos de la campaña por correo",
  ".cmail_export_record": "Se exportó el registro de envíos por correo",
  hojas_ruta_config: "Se cambió la configuración de Hojas de ruta",
  hojas_ruta_runs: "Se generaron hojas de ruta",
  project_modules: "Se cambiaron los módulos del proyecto",
};

/** Familias de claves que comparten acción (la primera que casa gana). */
const ACCIONES_POR_PATRON: ReadonlyArray<readonly [RegExp, string]> = [
  [/^analitica_.+_ok$/, "Se generó un entregable de Analítica"],
  [/^graficos_.+_ok$/, "Se generó un entregable de Gráficos"],
  [/^calc_muestra_/, "Se cambió el cálculo de muestra"],
  [/^material_/, "Se cambió el material de campo"],
];

/** Sin traducción: el área donde vive el cambio. */
function accionGenerica(clave: string): string {
  const area = areaDeMotivo(clave);
  return area === "Otro cambio" ? "Cambio en el proyecto" : `Cambio en ${area}`;
}

function accionDeClave(clave: string): string {
  const exacta = ACCIONES[clave];
  if (exacta) return exacta;
  for (const [patron, accion] of ACCIONES_POR_PATRON) {
    if (patron.test(clave)) return accion;
  }
  return accionGenerica(clave);
}

function enMinuscula(frase: string): string {
  // "Analítica pasó..." conserva la mayúscula del nombre del módulo.
  return /^Se /.test(frase) ? `s${frase.slice(1)}` : frase;
}

/**
 * La acción de un motivo, sin el identificador: "Se cambió la base de Validación". Las claves unidas con " + " se
 * dicen juntas, sin repetir; la circunstancia entre paréntesis se conserva al final.
 */
export function accionDeMotivo(motivo: string): string {
  const texto = motivo.trim();
  const detalle = texto.match(/\(([^()]+)\)\s*$/)?.[1]?.trim();
  const base = detalle ? texto.slice(0, texto.lastIndexOf("(")).trim() : texto;
  const claves = base.split(/\s*\+\s*/).filter(Boolean);
  const acciones = [...new Set((claves.length ? claves : [base]).map(accionDeClave))];
  const frase = acciones.map((a, i) => (i === 0 ? a : enMinuscula(a))).join("; ");
  return detalle ? `${frase}, ${detalle}` : frase;
}
