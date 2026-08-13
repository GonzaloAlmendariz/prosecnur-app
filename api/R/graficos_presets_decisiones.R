# =============================================================================
# graficos_presets_decisiones.R — el proyecto guarda decisiones, no defaults
# =============================================================================
#
# ADR 0074. Cuando el motor recibe un valor de preset no puede distinguir «esto
# lo eligió el analista» de «esto vino de fábrica»: las dos cosas llegan como la
# misma entrada en la misma lista.
#
# Medido sobre «Conta 11-08», 253 valores guardados en sus presets: **218 (86 %)
# idénticos al default de fábrica**, 22 distintos, 13 sin default declarado.
# Ocho de cada nueve son una foto del default del día en que se guardó — y esa
# foto se comporta como una decisión, porque pisa cualquier default nuevo.
#
# De ahí salieron la regla de «legado» de `textos_negrita`, el alias de
# `numerar_oe`, que el resolutor multiactor pisara el preset, y una discusión
# entera sobre la negrita de una lámina para acabar descubriendo que la
# preferencia que se estaba respetando era el default de la víspera.
#
# La invariante: **presencia = decisión**. Es la misma que el frontend ya usa
# para los overrides de un gráfico —`inherited` o `custom` sale de si la clave
# está en la bolsa, sin guardar nada—; aquí sólo se extiende a los presets.

#' Quita de un bag de presets todo lo que coincide con el default de fábrica.
#'
#' Se aplica al guardar Y al leer. Al leer también, porque un `.pulso` anterior
#' a esto trae sus 253 valores y hay que darle el mismo trato sin obligar a una
#' migración: el primer guardado lo deja ya limpio.
#'
#' @param presets Bag de presets tal como lo trae el proyecto.
#' @param defaults Defaults de fábrica; por defecto los del paquete.
#' @return El bag con sólo lo que difiere. Los args sin default declarado se
#'   conservan: de esos no se puede decir que nadie los eligió.
#' @keywords internal
.graficos_presets_solo_decisiones <- function(presets, defaults = NULL) {
  if (is.null(presets) || !is.list(presets) || !length(presets)) return(presets)
  if (is.null(defaults)) {
    defaults <- tryCatch(.PRESETS_DEFAULT_PULSO, error = function(e) NULL)
  }
  if (is.null(defaults) || !is.list(defaults)) return(presets)

  igual_al_default <- function(valor, default) {
    if (is.null(default)) return(FALSE)
    # `all.equal` compara con tolerancia numérica y devuelve un mensaje cuando
    # difiere, no FALSE; de ahí el `isTRUE`.
    isTRUE(all.equal(valor, default, check.attributes = FALSE))
  }

  out <- presets
  for (bloque in names(out)) {
    args <- out[[bloque]]
    if (!is.list(args) || !length(args)) next
    d <- defaults[[bloque]]
    if (is.null(d)) next
    conservar <- vapply(names(args), function(a) {
      !igual_al_default(args[[a]], d[[a]])
    }, logical(1))
    conservados <- args[conservar]
    # Un bloque sin decisiones queda como lista vacía SIN nombres. `x[logical]`
    # deja un `names` de longitud cero que no es lo mismo para `identical()` ni
    # para jsonlite, y ese detalle viaja al `.pulso`.
    out[[bloque]] <- if (length(conservados)) conservados else list()
  }
  out
}

#' Cuántos valores guarda un bag y cuántos son decisiones.
#'
#' Para poder decir el número en vez de estimarlo: es la medición que motivó el
#' ADR y la que verifica que esto hace lo que dice.
#'
#' @keywords internal
.graficos_presets_recuento <- function(presets, defaults = NULL) {
  if (is.null(defaults)) {
    defaults <- tryCatch(.PRESETS_DEFAULT_PULSO, error = function(e) list())
  }
  total <- 0L; decisiones <- 0L; sin_default <- 0L
  for (bloque in names(presets %||% list())) {
    args <- presets[[bloque]]
    if (!is.list(args)) next
    for (a in names(args)) {
      total <- total + 1L
      d <- (defaults[[bloque]] %||% list())[[a]]
      if (is.null(d)) { sin_default <- sin_default + 1L; decisiones <- decisiones + 1L; next }
      if (!isTRUE(all.equal(args[[a]], d, check.attributes = FALSE))) {
        decisiones <- decisiones + 1L
      }
    }
  }
  list(total = total, decisiones = decisiones, sin_default = sin_default,
       defaults_congelados = total - decisiones)
}

#' Repone el default de fábrica bajo las decisiones del proyecto.
#'
#' El reverso de `.graficos_presets_solo_decisiones()`. En **disco** el bag
#' guarda sólo decisiones; en **memoria**, para renderizar, hacen falta los
#' valores completos.
#'
#' Esto se descubrió con el render, no con los tests: al vaciar el bag los
#' títulos de bloque de la lámina 66 pasaron de negrita a plana, porque
#' `.graficos_default_config()` COPIA el default dentro del proyecto y el motor
#' lee los presets de ahí — no hay ningún merge con el default más abajo. Sin
#' este reverso, guardar limpio equivalía a borrar la mitad de la configuración.
#'
#' @param presets Bag del proyecto, ya sin defaults.
#' @param defaults Defaults de fábrica.
#' @return El bag completo: default abajo, decisiones encima.
#' @keywords internal
.graficos_presets_con_defaults <- function(presets, defaults = NULL) {
  if (is.null(defaults)) {
    defaults <- tryCatch(.PRESETS_DEFAULT_PULSO, error = function(e) NULL)
  }
  if (is.null(defaults) || !is.list(defaults)) return(presets)
  if (is.null(presets) || !is.list(presets)) return(defaults)

  out <- defaults
  for (bloque in names(presets)) {
    args <- presets[[bloque]]
    if (!is.list(args)) { out[[bloque]] <- args; next }
    base <- out[[bloque]]
    if (!is.list(base)) base <- list()
    for (a in names(args)) base[[a]] <- args[[a]]
    out[[bloque]] <- base
  }
  out
}
