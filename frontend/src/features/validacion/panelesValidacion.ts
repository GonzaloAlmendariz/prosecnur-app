import type { PanelDeclarado } from "../../lib/navegacion/paneles";

// Paneles direccionables de Validación (`?panel=<id>`, L2). El plan de
// fidelidad (rebanada V0) los declara todos de una vez, aunque su contenido
// llegue en rebanadas posteriores, para que ninguna de ellas toque este
// archivo. Un panel declarado y todavía no montado no abre nada: la pestaña
// sigue a la vista.

/**
 * La regla propia en su editor (V2): `foco=nueva` para una regla nueva o el id
 * de la regla. Mientras V3 no rehace Hallazgos, en esa pestaña el mismo panel
 * es el detalle de la regla con sus casos. El enlace viejo
 * `pestana=instrumento&panel=regla&foco=<id>` ya no lo abre: lleva a Reglas
 * con `foco` (ver `pestanaValidacion.ts`).
 */
export const PANEL_REGLA_VALIDACION: PanelDeclarado = {
  id: "regla",
  label: "Regla",
  clase: "sideover",
};

/** Un caso completo de la última auditoría (V3); `foco` es el id del caso. */
export const PANEL_CASO_VALIDACION: PanelDeclarado = {
  id: "caso",
  label: "Caso",
  clase: "sideover",
};

/** Los controles del operativo, desde la familia "Del operativo" de Reglas (V1, D-F7b). */
export const PANEL_OPERATIVO_VALIDACION: PanelDeclarado = {
  id: "operativo",
  label: "Controles del operativo",
  clase: "sideover",
};

/** Cómo se identifica un caso y el criterio de caso válido, hasta que pasen a Carga › Variables (V1, D-F7b). */
export const PANEL_ROLES_VALIDACION: PanelDeclarado = {
  id: "roles",
  label: "Cómo se identifica un caso",
  clase: "sideover",
};

/** Las preguntas que la auditoría no revisa (V1, D-F7c, si se elige el panel en vez de la familia). */
export const PANEL_FUERA_DE_AUDITORIA_VALIDACION: PanelDeclarado = {
  id: "fuera-de-auditoria",
  label: "Preguntas fuera de la auditoría",
  clase: "sideover",
};

/** El resumen de la auditoría por regla y por pregunta (V3, D-F7d, si se conserva). */
export const PANEL_RESUMEN_VALIDACION: PanelDeclarado = {
  id: "resumen",
  label: "Resumen de la auditoría",
  clase: "sideover",
};

/** El registro completo de las decisiones, con su historial (V4, D-F7f). */
export const PANEL_REGISTRO_VALIDACION: PanelDeclarado = {
  id: "registro",
  label: "Registro de decisiones",
  clase: "sideover",
};

/**
 * Los casos de una sugerencia del detector de consistencia (ítem 31), desde el
 * bloque "Sugerencias para revisar" de Reglas; `foco` es el id de la sugerencia.
 */
export const PANEL_SUGERENCIA_VALIDACION: PanelDeclarado = {
  id: "sugerencia",
  label: "Casos de la sugerencia",
  clase: "dialogo",
};

export const PANELES_VALIDACION: readonly PanelDeclarado[] = [
  PANEL_REGLA_VALIDACION,
  PANEL_CASO_VALIDACION,
  PANEL_OPERATIVO_VALIDACION,
  PANEL_ROLES_VALIDACION,
  PANEL_FUERA_DE_AUDITORIA_VALIDACION,
  PANEL_RESUMEN_VALIDACION,
  PANEL_REGISTRO_VALIDACION,
  PANEL_SUGERENCIA_VALIDACION,
];
