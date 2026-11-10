# Grano de cada tabla de cruces en una base hija repeat (ADR 0128, sección 4 ter)
# ==============================================================================
#
# Una base hija repeat (ADR 0030) tiene una fila por registro del grupo repetido: en CCSS 2026, una persona
# responsable de la crianza por fila (739 filas de 400 estudiantes). Analítica le hereda las variables del encuestado
# (`analitica_repeats.R`), así que en la hija conviven dos granos:
#
# - una variable heredada es del encuestado. Si se cuenta en la hija, cada encuestado pesa tantas veces como
#   registros tiene y el porcentaje no estima nada definido. Su tabla se calcula sobre la base madre, con la regla y
#   la familia de la madre, y sale idéntica a la tabla de la madre;
# - una variable propia de la hija es del registro. Su tabla se queda en la hija y el pie declara la unidad y los dos
#   conteos, en lugar del texto de base del estudio, que describe al encuestado.
#
# Una tabla cruza su variable de fila contra todas las variables de cruce a la vez, así que va a la madre sólo si la
# madre tiene la fila y todos los cruces. Si algún cruce es propio de la hija, la tabla entera queda en el registro.

#' Contexto de grano de una exportación de cruces
#'
#' @param data Base de la exportación (la hija, si es repeat).
#' @param repeat_design Diseño repeat de la base o NULL.
#' @param cruces Variables de cruce de la exportación.
#' @return `NULL` si la base no es hija repeat; si lo es, la lista que consume `.cruces_grano_tabla()`.
#' @keywords internal
.cruces_grano_preparar <- function(data, repeat_design, cruces = character(0)) {
  if (!is.list(repeat_design) || !is.data.frame(data)) return(NULL)
  heredadas <- as.character(repeat_design$heredadas %||% character(0))
  madre <- attr(data, "repeat_madre", exact = TRUE)
  if (!is.data.frame(madre)) madre <- .cruces_grano_madre_deduplicada(data, repeat_design)
  list(
    hija = data, diseno = repeat_design, heredadas = heredadas, madre = madre,
    cruces_en_madre = is.data.frame(madre) && all(as.character(cruces) %in% names(madre)),
    ctx = .sig_informe_vigente(),
    base_texto = .cruces_grano_base_texto(repeat_design)
  )
}

#' Respaldo sin la base madre: una fila por encuestado, tomada de la hija
#'
#' Sólo cuando la exportación no trae la madre. Pierde a los encuestados sin registros en la hija, por eso la ruta
#' normal es la madre (`attr(data, "repeat_madre")`, que adjunta el router).
#' @keywords internal
.cruces_grano_madre_deduplicada <- function(data, repeat_design) {
  llave <- as.character(repeat_design$cluster_col %||% "")
  if (!nzchar(llave) || !llave %in% names(data)) return(NULL)
  id <- as.character(data[[llave]])
  ok <- !is.na(id) & nzchar(id) & !duplicated(id)
  out <- data[ok, , drop = FALSE]
  attr(out, "repeat_design") <- NULL
  out
}

#' Texto de base de una tabla con grano de registro
#'
#' «datos de cada persona indicada (739 registros de 400 encuestados)»: la unidad es el rótulo del `begin_repeat`.
#' @keywords internal
.cruces_grano_base_texto <- function(repeat_design) {
  n_reg <- suppressWarnings(as.integer(repeat_design$n_instancias %||% NA_integer_))
  n_enc <- suppressWarnings(as.integer(repeat_design$n_personas %||% NA_integer_))
  unidad <- as.character(repeat_design$unidad %||% "")[1]
  if (is.na(unidad) || !nzchar(unidad)) unidad <- "registros del grupo repetido"
  fmt <- function(x) format(x, big.mark = ",", trim = TRUE)
  conteo <- if (!is.na(n_reg) && !is.na(n_enc)) {
    sprintf(" (%s registros de %s encuestados)", fmt(n_reg), fmt(n_enc))
  } else if (!is.na(n_reg)) sprintf(" (%s registros)", fmt(n_reg)) else ""
  paste0(unidad, conteo)
}

#' Datos, diseño, notas y contexto de diferencias de UNA tabla
#'
#' Fija además el contexto de diferencias (`prosecnur.sig_informe`) que corresponde al grano de la tabla: el de la
#' madre para las heredadas, el de la hija para las propias.
#' @return `list(data, repeat_design, notas)`.
#' @keywords internal
.cruces_grano_tabla <- function(g, var, data, repeat_design, notas) {
  if (is.null(g)) return(list(data = data, repeat_design = repeat_design, notas = notas))
  if (var %in% g$heredadas && isTRUE(g$cruces_en_madre) && .has_var_or_dummies(g$madre, var)) {
    if (is.list(g$ctx)) .sig_informe_activar(g$ctx$madre %||% g$ctx)
    return(list(data = g$madre, repeat_design = NULL, notas = notas))
  }
  if (is.list(g$ctx)) .sig_informe_activar(g$ctx)
  if (!var %in% names(notas$base_por_pregunta)) {
    notas$base_por_pregunta[var] <- g$base_texto
  }
  list(data = g$hija, repeat_design = g$diseno, notas = notas)
}

#' Contexto de diferencias de la base que se exporta
#'
#' En una base normal es el de siempre (`.sig_contexto_estudio`). En una hija repeat con madre:
#'
#' - `madre` es el contexto de la madre, con su familia tal cual: las tablas heredadas dan las mismas letras que en la
#'   madre;
#' - la familia de la hija es la de la madre más las comparaciones de las variables propias de la hija, evaluadas a
#'   grano de registro. Las heredadas no se vuelven a contar.
#'
#' La familia de la madre no incluye las comparaciones propias de la hija (ADR 0128 §4 ter): incluirlas cambiaría las
#' letras de la base madre y del mazo ya entregados.
#' @keywords internal
.sig_contexto_de_base <- function(ds, is, nombre, significancia) {
  gc <- significancia$graficos_config
  ac <- significancia$analitica_config
  hija <- ds[[nombre]]
  diseno <- attr(hija, "repeat_design", exact = TRUE)
  madre <- attr(hija, "repeat_madre", exact = TRUE)
  padre <- as.character((diseno %||% list())$parent_base %||% "")
  if (!is.data.frame(madre) && nzchar(padre)) madre <- ds[[padre]]
  if (!is.list(diseno) || !is.data.frame(madre)) {
    return(.sig_contexto_estudio(hija, is[[nombre]], gc, ac))
  }
  inst_madre <- if (nzchar(padre) && !is.null(is[[padre]])) is[[padre]] else is[[nombre]]
  ctx_madre <- .sig_contexto_estudio(madre, inst_madre, gc, ac)
  fuente <- .sig_fuente(hija, is[[nombre]])
  rr <- .sig_regla_del_estudio(gc, fuente$data, ac)
  familia <- NULL
  m <- 0L
  if (identical(rr$regla$correccion, "bh_informe")) {
    heredadas <- as.character(diseno$heredadas %||% character(0))
    combos <- Filter(function(cb) !cb$var %in% heredadas,
                     .sig_combinaciones_estudio(fuente, gc$plan %||% NULL, ac))
    propias <- if (length(combos)) .sig_familia_estudio(fuente, rr$regla, combos)$tabla$p else numeric(0)
    familia <- .sig_bh_tabla(c((ctx_madre$familia %||% list())$p %||% numeric(0), propias))
    m <- familia$m
  }
  list(regla = rr$regla, origen = rr$origen, familia = familia, m = m,
       cruces = .sig_cruces_declarados(ac), madre = .sig_contexto_liviano(ctx_madre))
}
