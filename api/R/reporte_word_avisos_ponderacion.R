# =============================================================================
# reporte_word_avisos_ponderacion.R — el Word ponderado lo declara o avisa (contrato base-sin-ponderar F6, D-b y D-c)
# =============================================================================
#
# El par Word de `graficos_avisos_ponderacion_mazo()` (graficos_verificar_mazo.R). Un Word declara la ponderación en
# «Cómo leer este informe» (con la corrida ponderada, su recuadro lo dice: `.word_como_leer(ponderada = TRUE)`) o en la
# ficha técnica (fila «Ponderación»). Si está ponderado y no trae ninguna de las dos, advertencia al exportar; «Cómo
# leer» no se enciende solo (D-b). El fallback «ponderación configurada no aplicada» sube a advertencia (D-c).
#
# `.word_documento()` no ve las bases: recibe lo que necesita en `opciones$ponderacion`, que arma
# `.word_ponderacion_de_corrida()` donde las bases sí están (el worker o `reporte_word_plan`).

#' Lo que el Word necesita saber de la ponderación de su corrida (sin llevarse las bases)
#'
#' @param data Las bases de la corrida (data frame o lista nombrada), con su estado de ponderación adjunto.
#' @return `list(ponderada, fallback)`: si alguna base aplicó pesos y los avisos D-c ya redactados.
#' @keywords internal
.word_ponderacion_de_corrida <- function(data) {
  list(ponderada = .lam_corrida_ponderada(data), fallback = .lam_ponderacion_avisos_fallback(data))
}

#' ¿El render_meta del Word trae una ficha técnica que declara la ponderación?
#' @keywords internal
.word_ficha_declara_ponderacion <- function(render_meta) {
  any(vapply(render_meta %||% list(), function(e) {
    is.list(e) && identical(e$kind, "technical_table") && .lam_ficha_declara_ponderacion(e$table)
  }, logical(1)))
}

#' Advertencias de ponderación del Word (enganche al cierre de `.word_documento()`)
#'
#' @param ponderacion Salida de `.word_ponderacion_de_corrida()` (`opciones$ponderacion`); `NULL`, nada que decir.
#' @param render_meta Entradas del documento.
#' @param como_leer ¿El documento lleva «Cómo leer este informe»?
#' @return Vector de textos para `avisar()`.
#' @keywords internal
.word_avisos_ponderacion <- function(ponderacion, render_meta, como_leer) {
  if (!is.list(ponderacion)) return(character(0))
  declarada <- (isTRUE(como_leer) && isTRUE(ponderacion$ponderada)) || .word_ficha_declara_ponderacion(render_meta)
  c(as.character(ponderacion$fallback %||% character(0)),
    if (isTRUE(ponderacion$ponderada) && !declarada) .lam_ponderacion_aviso_sin_declarar("Word"))
}
