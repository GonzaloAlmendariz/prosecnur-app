# reporte_plan_dicotomica.R — la dicotómica del recetario como tipo de gráfico propio (G10, Gonzalo 2026-10-13: «aún no
# veo en los tipos de gráficos ese gráfico apilado dicotómico… que tiene los números de los polos algo más grandes»).
#
# La pieza ya existía: `.lam_laminas_dicotomia` (lamina_categorica.R, lámina 76 del recetario) dibuja una barra partida a
# todo el ancho con las dos cifras grandes en los polos, y se activa sola cuando una categórica tiene exactamente dos
# opciones. Pero no se podía elegir: había que saber que unas barras categóricas de Sí/No terminaban así. Este tipo la
# nombra en el selector; por dentro es la misma categórica.

#' Dicotómica: una pregunta de dos opciones en una barra partida, con las cifras grandes en los polos
#'
#' @param var Pregunta de dos opciones (Sí/No u otra dicotomía).
#' @param titulo,overrides,base,filtros,excluir_opciones,orden_categorias Como en `p_barras_categoricas()`.
#' @param orientacion `"horizontal"` (la barra partida a todo el ancho del recetario, por defecto) o `"vertical"` (la
#'   misma barra de pie, con cada cifra junto a su polo). Gonzalo, 2026-10-14.
#' @param estilo `NULL` (el del informe, por defecto la barra partida `"partida"`) o `"barra_estandar"`: una barra normal con el
#'   porcentaje dentro de cada segmento, en blanco, a tamaño estándar y con leyenda (Renzo, informe Arte, 2026-10-22). El del
#'   gráfico gana al del informe (`presets$base$args$estilo_dicotomia`).
#' @param ... Otros argumentos de `p_barras_categoricas()`.
#' @return Elemento `ppt_element`.
#' @family reporte
#' @export
p_dicotomica <- function(var, titulo = NULL, overrides = list(), base = list(), filtros = list(),
                         excluir_opciones = NULL, orden_categorias = NULL, orientacion = NULL, estilo = NULL, ...) {
  if (!is.null(estilo)) {
    estilo <- as.character(estilo)[1]
    if (!estilo %in% .ESTILOS_DICOTOMIA) .plan_spec_abort("`estilo` debe ser \"partida\" o \"barra_estandar\".")
    overrides$estilo_dicotomia <- estilo
  }
  if (!is.null(orientacion)) {
    orientacion <- as.character(orientacion)[1]
    if (!orientacion %in% c("horizontal", "vertical")) .plan_spec_abort("`orientacion` debe ser \"horizontal\" o \"vertical\".")
    overrides$orientacion_dicotomica <- orientacion
  }
  overrides$dicotomica_declarada <- TRUE   # N20: la dicotomía es solo Sí/No salvo que el analista la declare aquí
  p_barras_categoricas(var, titulo = titulo, overrides = overrides, base = base, filtros = filtros,
                       excluir_opciones = excluir_opciones, orden_categorias = orden_categorias, ...)
}
