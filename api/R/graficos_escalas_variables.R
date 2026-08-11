# =============================================================================
# graficos_escalas_variables.R — qué variables usa cada escala del estudio
# =============================================================================
#
# `.graficos_collect_palette_lists()` devuelve las escalas con sus etiquetas y
# las bases donde viven, pero no dice QUÉ PREGUNTA usa cada una. Sin ese puente
# la UI que ofrece reordenar categorías a mano tiene que enseñar las 23 escalas
# del estudio y esperar que el analista reconozca la suya; con él puede poner
# primero la del gráfico que está editando.
#
# El puente sale del `survey` del instrumento: `type = "select_one lst_p4_recod"`
# en la fila cuyo `name` es la variable. Es la misma lectura que hace
# `reporte_data.R`, con la columna `list_name` explícita cuando existe.

#' Nombre de lista declarado por una fila del `survey`.
#'
#' Prefiere la columna `list_name` cuando el instrumento la trae; si no, la
#' extrae del `type`. Devuelve `NA_character_` si la fila no es de selección.
#' @keywords internal
.escala_list_name_de_fila <- function(surv, i) {
  if ("list_name" %in% names(surv)) {
    ln <- trimws(as.character(surv$list_name[i]))
    if (!is.na(ln) && nzchar(ln)) return(ln)
  }
  tp <- trimws(as.character(surv$type[i]))
  if (is.na(tp) || !nzchar(tp)) return(NA_character_)
  m <- regmatches(tp, regexec("^(?:select_one|select_multiple)\\s+(\\S+)", tp, perl = TRUE))[[1]]
  if (length(m) >= 2L && nzchar(m[2])) m[2] else NA_character_
}

#' Variables de cada escala, calificadas por base.
#'
#' @param inst_sources La misma lista que consume `.graficos_collect_palette_lists()`.
#' @return Lista nombrada por `list_name`; cada elemento es un vector de
#'   variables. Van calificadas (`docentes$p4_recod`) cuando la fuente tiene
#'   nombre —que es cuando el plan también las califica— porque un mismo
#'   `list_name` es una escala distinta en cada instrumento. Un instrumento
#'   suelto y sin nombre las deja a secas.
#' @keywords internal
.graficos_variables_por_escala <- function(inst_sources) {
  if (is.null(inst_sources) || !is.list(inst_sources) || is.data.frame(inst_sources)) {
    return(list())
  }
  # Un instrumento suelto llega sin envolver; el resto del módulo hace lo mismo.
  if (!is.null(inst_sources$survey) && is.data.frame(inst_sources$survey)) {
    inst_sources <- list(inst_sources)
  }

  fuentes <- names(inst_sources)
  if (is.null(fuentes)) fuentes <- rep("", length(inst_sources))

  out <- list()
  for (idx in seq_along(inst_sources)) {
    inst <- inst_sources[[idx]]
    if (is.null(inst) || !is.list(inst)) next
    surv <- inst$survey
    if (is.null(surv) || !is.data.frame(surv) || !nrow(surv)) next
    if (!("type" %in% names(surv)) || !("name" %in% names(surv))) next

    fuente <- trimws(as.character(fuentes[idx] %||% ""))
    for (i in seq_len(nrow(surv))) {
      ln <- .escala_list_name_de_fila(surv, i)
      if (is.na(ln) || !nzchar(ln)) next
      nm <- trimws(as.character(surv$name[i]))
      if (is.na(nm) || !nzchar(nm)) next
      # Se califica cuando la fuente tiene nombre, que es exactamente cuando el
      # plan escribe `docentes$p4_recod`. Contar fuentes para decidirlo fallaba
      # con un estudio de una sola base nombrada. Un instrumento suelto y sin
      # nombre queda a secas, igual que su `var`.
      var <- if (nzchar(fuente)) paste0(fuente, "$", nm) else nm
      if (!(var %in% (out[[ln]] %||% character(0)))) {
        out[[ln]] <- c(out[[ln]] %||% character(0), var)
      }
    }
  }
  out
}

#' Añade a cada escala las variables que la usan.
#'
#' Se aplica sobre la salida de `.graficos_collect_palette_lists()` y no dentro,
#' para que el colector siga siendo lo que su nombre dice y el contrato con la
#' UI crezca en un solo sitio.
#'
#' El `list_name` NO alcanza para atribuir: el colector separa las escalas
#' homónimas (`lst_p10`, `lst_p10#2`…) porque en cada base son otra cosa, y
#' pegarles a todas las variables del nombre hacía que la Sí/No de docentes
#' reclamara los meses desde el egreso. Se acota por las `fuentes` que el propio
#' colector ya calculó, que es lo único que distingue una homónima de otra.
#' @keywords internal
.graficos_escalas_con_variables <- function(listas, inst_sources) {
  vars <- .graficos_variables_por_escala(inst_sources)
  lapply(listas, function(l) {
    v <- vars[[as.character(l$list_name %||% "")]] %||% character(0)
    fuentes <- as.character(l$fuentes %||% character(0))
    if (length(v) && length(fuentes)) {
      base_de <- sub("\\$.*$", "", v)
      # Una variable sin calificar (instrumento suelto) no se puede descartar
      # por base: no la declara.
      v <- v[base_de == v | base_de %in% fuentes]
    }
    # I() mantiene el contrato "array siempre", igual que `fuentes`.
    l$variables <- I(as.character(v))
    l
  })
}
