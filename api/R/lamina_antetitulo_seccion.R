# El nombre de la sección sobre el título de cada lámina (Gonzalo, 2026-10-28, pedido de Renzo en Arte v1-9).
#
# «Se puede correr sin que salga el nombre de la sección?» → opción global del informe, APAGADA por defecto: la lámina
# no hereda el título del separador vigente como antetítulo («PRINCIPALES RESULTADOS» sobre «MISIÓN Y VISIÓN…»). Si se
# activa, sale como antes. Vive en `estilo_cliente.antetitulo_seccion` (true/false; ausente = apagado), y el worker la
# deja en la opción `prosecnur.lam_antetitulo_seccion` mientras arma el mazo. El antetítulo que una lámina fija por su
# cuenta (`meta$antetitulo`, p. ej. «Cómo leer este informe») sale siempre: no es el nombre de la sección.

#' ¿Las láminas heredan el nombre de la sección como antetítulo?
#' @keywords internal
.lam_antetitulo_seccion_activo <- function() isTRUE(getOption("prosecnur.lam_antetitulo_seccion", FALSE))

#' Valida `estilo_cliente.antetitulo_seccion` (estricto: 400 `E_BAD_ESTILO_CLIENTE` vía `.ec_bad`)
#' @keywords internal
.ec_antetitulo_seccion_validar <- function(v) {
  if (is.null(v)) return(invisible(NULL))
  v <- unlist(v)
  if (!is.logical(v) || length(v) != 1L || is.na(v)) .ec_bad("«estilo_cliente.antetitulo_seccion» debe ser true o false.")
  invisible(NULL)
}
