# =============================================================================
# graficos_resumen_base.R — de qué base lee una lámina de resumen (resumen de diferencias y hallazgos clave)
# =============================================================================
#
# Las demás láminas resuelven su base así (`.resolve_source_name` en reporte_plan_ppt.R): la fuente explícita del
# elemento, si no el prefijo de la referencia («base$var») y, si no, la única base del informe. El editor guarda las
# referencias peladas y el job, la vista previa y la propuesta las califican con la base activa
# (`.graficos_calificar_refs_plan`), que es la base del plan.
#
# Las láminas de resumen no tienen `var`: su `fuente` caía a `.cifra_fuente("")`, que devuelve la PRIMERA base de la
# sesión, y en un estudio multibase con otra base activa la lámina leía en silencio una base distinta de la del resto
# del mazo. Aquí se aplica la misma regla:
#
#   1. `fuente` de la lámina («base» o «base$var»), que `.graficos_calificar_refs_plan` llena con la base activa;
#   2. si no, la única base que nombran sus propias referencias (filas, cifras y cruces con prefijo);
#   3. si no, la única base que nombran las preguntas del plan;
#   4. si no, la única base del informe; con varias, la primera y un aviso que lo dice.
#
# Una lámina de resumen tiene una sola base: el total, el n de la lámina, las columnas de grupos y la regla de la prueba
# son de esa base, y mezclar en una misma tabla grupos de dos poblaciones cambiaría lo que significa cada celda. Por eso
# una fila o cifra que nombra otra base no se lee contra la base de la lámina: queda fuera con un aviso que lo dice
# (y en la selección automática, las preguntas del plan de otra base no entran a la propuesta).

#' Base de una referencia «base$var», o NA si viene pelada
#' @keywords internal
.resbase_de_ref <- function(ref) {
  r <- as.character(unlist(ref %||% character(0)))
  r <- trimws(r[!is.na(r)])
  out <- ifelse(grepl("$", r, fixed = TRUE), trimws(sub("\\$.*$", "", r)), NA_character_)
  out[!is.na(out) & nzchar(out)]
}

#' Referencias propias de una lámina de resumen: filas y cifras de sus capítulos, cifras sueltas y cruces
#' @keywords internal
.resbase_refs_lamina <- function(el) {
  caps <- .dif_lista_registros(el$capitulos, c("titulo", "filas", "cifras"))
  refs <- unlist(lapply(caps, function(c) {
    c <- as.list(c)
    regs <- c(.dif_lista_registros(c$filas, "var"), .dif_lista_registros(c$cifras, "var"))
    vapply(regs, function(x) .dif_chr1(as.list(x)$var) %||% NA_character_, character(1))
  }), use.names = FALSE)
  cifras <- .dif_lista_registros(el$cifras, "var")
  refs <- c(refs, vapply(cifras, function(x) .dif_chr1(as.list(x)$var) %||% NA_character_, character(1)),
            as.character(unlist(el$cruces)))
  refs[!is.na(refs)]
}

#' Referencias de las preguntas del plan del motor (lista de `ppt_slide`), sin las láminas de resumen
#' @keywords internal
.resbase_refs_plan <- function(plan) {
  unlist(lapply(plan %||% list(), function(s) {
    el <- (s$slots %||% list())$plot
    if (!inherits(el, "ppt_element") || isTRUE(el$.element_type %in% c("resumen_diferencias", "hallazgos"))) return(NULL)
    as.character(unlist(c(el$var, el$vars)))
  }), use.names = FALSE)
}

#' Base de lectura de una lámina de resumen (ver la cabecera)
#'
#' @param el Elemento `resumen_diferencias` o `hallazgos`.
#' @param data_sources Fuentes con nombre del render.
#' @param plan Plan del motor (lista de `ppt_slide`).
#' @return Nombre de la base.
#' @keywords internal
.resumen_base_lamina <- function(el, data_sources, plan = list()) {
  bases <- names(data_sources)
  ref <- .dif_chr1(el$fuente_ref)
  if (!is.null(ref)) {
    b <- if (grepl("$", ref, fixed = TRUE)) trimws(sub("\\$.*$", "", ref)) else ref
    if (!b %in% bases) stop(sprintf("la base «%s» no está en el informe.", b), call. = FALSE)
    return(b)
  }
  if (length(bases) == 1L) return(bases)
  propias <- intersect(unique(.resbase_de_ref(.resbase_refs_lamina(el))), bases)
  if (length(propias) == 1L) return(propias)
  del_plan <- intersect(unique(.resbase_de_ref(.resbase_refs_plan(plan))), bases)
  if (length(del_plan) == 1L) return(del_plan)
  .dif_aviso(.resbase_prefijo(el), sprintf("la lámina no dice de qué base lee y el informe tiene varias, así que lee la base «%s». Elige la base de la lámina para leer otra.",
                                            bases[1]))
  bases[1]
}

#' Prefijo de los avisos de la lámina, según su tipo
#' @keywords internal
.resbase_prefijo <- function(el) {
  if (identical(el$.element_type, "hallazgos")) "Resumen ejecutivo" else "Resumen de diferencias"
}

#' ¿La referencia nombra una base distinta de la de la lámina? Devuelve esa base, o NULL
#' @keywords internal
.resbase_ajena <- function(ref, base) {
  if (is.null(base) || is.na(base)) return(NULL)
  b <- .resbase_de_ref(ref)
  if (length(b) && !identical(b[1], base)) b[1] else NULL
}

#' Quita las filas o cifras de otra base, con un aviso por cada una
#'
#' @param items Ítems normalizados con `.dif_item` (llevan `ref`, la referencia como la escribió el analista).
#' @param base Base de la lámina (`fuente$base`); NULL no filtra.
#' @param prefijo Prefijo del aviso.
#' @keywords internal
.resbase_filtrar_items <- function(items, base, prefijo) {
  if (is.null(base)) return(items)
  Filter(function(it) {
    otra <- .resbase_ajena(it$ref, base)
    if (is.null(otra)) return(TRUE)
    .dif_aviso(prefijo, sprintf("«%s» es de la base «%s» y la lámina lee la base «%s», así que queda fuera. Ponla en un resumen de esa base.",
                                it$rotulo %||% it$var, otra, base))
    FALSE
  }, items)
}

#' Preguntas del plan que lee la selección automática: las de la base de la lámina, con un aviso de las que quedan fuera
#'
#' @param preguntas Salida de `.resumen_dif_preguntas_plan` (cada una con `bases`, las de sus referencias).
#' @keywords internal
.resbase_filtrar_preguntas <- function(preguntas, base, prefijo) {
  if (is.null(base)) return(preguntas)
  ajena <- vapply(preguntas, function(q) any(!is.na(q$bases) & q$bases != base), logical(1))
  if (any(ajena)) {
    otras <- unique(unlist(lapply(preguntas[ajena], function(q) setdiff(q$bases, base))))
    n <- sum(ajena)
    .dif_aviso(prefijo, sprintf("%s del informe %s de %s %s y no %s a la propuesta, que lee la base «%s».",
                                if (n == 1L) "una pregunta" else sprintf("%d preguntas", n), if (n == 1L) "es" else "son",
                                if (length(otras) == 1L) "la base" else "las bases", paste(sprintf("«%s»", otras), collapse = " y "),
                                if (n == 1L) "entra" else "entran", base))
  }
  preguntas[!ajena]
}

#' Califica la base de una lámina de resumen del editor, como `.graficos_calificar_refs_plan` califica las referencias
#'
#' Sin `fuente`, la lámina lee la única base que nombran sus filas y cifras o, si no nombran ninguna, la base activa. Una
#' lámina que ya dice su `fuente`, o que no es de resumen, no se toca.
#' @param sl Lámina en el formato del editor (`tipo`, `payload`).
#' @param active_base Base activa (no vacía).
#' @keywords internal
.resbase_calificar_lamina <- function(sl, active_base) {
  tipo <- as.character(sl$tipo %||% "")[1]
  if (is.na(tipo) || !tipo %in% c("p_slide_hallazgos", "p_slide_resumen_diferencias") || !is.list(sl$payload)) return(sl)
  if (!is.null(.dif_chr1(sl$payload$fuente))) return(sl)
  propias <- unique(.resbase_de_ref(.resbase_refs_lamina(list(capitulos = sl$payload$capitulos, cifras = sl$payload$cifras,
                                                              cruces = sl$payload$cruces))))
  sl$payload$fuente <- if (length(propias) == 1L) propias else active_base
  sl
}
