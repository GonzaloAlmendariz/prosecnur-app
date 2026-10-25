// ¿Se pueden generar los archivos del informe? Una sola regla para el menú «Exportar», la barra y el panel de avisos.
//
// Bloquean los errores del validador del plan y los colores pendientes. Lo segundo es la regla de producto P8 (Gonzalo
// 2026-10-11): «si hay gráficos que aún no tienen paleta configurada cuando deberían […] no se puede exportar. Tenemos
// que asegurar que el usuario tenga todo definido antes de exportar pero también que pueda hacerlo fácilmente». El
// motor sabría exportar con los colores por defecto, pero la regla es de producto, no del motor. U9 (QA de CCSS,
// 2026-10-24): el panel, la barra y el menú lo dicen igual, con el arreglo en un clic.
export function puedeGenerarInforme({ planSinErrores, coloresPendientes }: { planSinErrores: boolean; coloresPendientes: number }): boolean {
  return planSinErrores && coloresPendientes === 0;
}

/** Por qué no se exporta con colores pendientes (P8), igual en el panel y en el menú. */
export const MOTIVO_COLORES_PENDIENTES = "esos gráficos pintan cada respuesta con su color; complétalos para exportar";
