# graficos_temas_titulos.R — títulos de tema y corte del indicador para los
# graficadores que comparan públicos (radar públicos, brecha entre dos bases y
# serie temporal). Enmienda al ADR 0103 (P21).
#
# Los tres reciben `vars = {clave: ["base$var", ...]}`: la clave es interna (la
# fila que el analista armó en «Comparar públicos por tema») y el TÍTULO del
# tema —la etiqueta del vértice, de la fila o de la línea— viaja aparte en
# `titulos_grupo`. Se aplica aquí, antes de validar, para que los renderers sigan
# leyendo `names(vars)` sin saber nada de claves.
#
# Interno: sin @export. Lo llaman sólo los constructores del plan.

# Mapa `clave -> título` desde lo que llegue por JSON o por R: lista nombrada,
# vector nombrado o texto «clave=Título» por línea (la forma de las
# multiapiladas).
.graf_titulos_grupo_mapa <- function(titulos_grupo) {
  if (is.null(titulos_grupo) || !length(titulos_grupo)) return(list())
  if (is.null(names(titulos_grupo)) && is.character(titulos_grupo)) {
    return(.radar_mb_renombres(titulos_grupo))
  }
  nms <- names(titulos_grupo)
  if (is.null(nms)) return(list())
  out <- list()
  for (i in seq_along(titulos_grupo)) {
    clave <- trimws(nms[[i]])
    valor <- unlist(titulos_grupo[[i]])
    valor <- if (length(valor)) trimws(as.character(valor[[1]])) else ""
    if (nzchar(clave) && !is.na(valor)) out[[clave]] <- valor
  }
  out
}

# Renombra los temas de `vars` con su título. Lo que no trae título (o lo trae
# vacío) se queda con su clave. Dos temas que terminan con el mismo título
# abortan: el renderer los fundiría en un solo vértice o fila sin avisar.
.graf_aplicar_titulos_grupo <- function(vars, titulos_grupo, contexto) {
  if (!is.list(vars) || !length(vars) || is.null(names(vars))) return(vars)
  mapa <- .graf_titulos_grupo_mapa(titulos_grupo)
  claves <- names(vars)
  titulos <- vapply(claves, function(k) {
    t <- mapa[[trimws(k)]] %||% ""
    if (nzchar(t)) t else k
  }, character(1), USE.NAMES = FALSE)
  if (length(mapa)) {
    dup <- unique(titulos[duplicated(trimws(titulos)) & nzchar(trimws(titulos))])
    if (length(dup)) {
      .plan_spec_abort(
        contexto, ": dos temas quedaron con el mismo título (",
        paste0("«", dup, "»", collapse = ", "),
        "). Cada tema necesita un título distinto para no fundirse en uno solo."
      )
    }
  }
  names(vars) <- titulos
  vars
}

# Corte del indicador como texto canónico «3,4». Une TODOS los códigos: un Top
# Two Box declarado como c("3","4") no puede quedar reducido al primero.
.graf_corte_unido <- function(corte) {
  paste(.radar_mb_codigos(corte), collapse = ",")
}
