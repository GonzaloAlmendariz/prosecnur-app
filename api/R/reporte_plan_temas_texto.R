# Gráfico de temas de un texto abierto codificado (TXT-20, CCSS 2026-10-25).
#
# `p_barras_agrupadas(var = "coment_recod", temas_de_texto = "coment")`: la múltiple que codifica un comentario en temas
# (códigos por módulo del formulario, 10, 20, 30…, y subtemas 21–29 de un módulo partido; codificacion_sugerir_seccion.R)
# sale como % de comentarios con contenido. Apagado por defecto: sin `temas_de_texto`, la múltiple se dibuja como siempre.
#
#  - Denominador: los comentarios con contenido del texto (no vacíos y que no son una no respuesta, `.txt_no_respuesta`,
#    la misma regla de la nube), más cualquier fila con un tema aunque su texto no cuente. Un comentario con contenido
#    al que no se le asignó tema cuenta en la base y en ninguna barra: es lo que dice la base. Ponderado con el mismo
#    peso que el resto del mazo (`.peso_vec`); la base del pie son casos.
#  - Un módulo partido en subtemas (dos o más etiquetas con la misma letra, «B. …») sale como una fila propia con el %
#    de comentarios que tocan cualquiera de sus subtemas (personas, no suma de menciones) y, debajo, sus subtemas en el
#    orden de los códigos con rótulo corto («B · Recursos de la Facultad»). Todo en el orden de los códigos.
#  - El subtítulo avisa que los porcentajes suman más de 100 %; la base dice «comentarios con contenido».
#
# Se engancha en `.render_barras_agrupadas` y en la base del elemento (reporte_plan_ppt.R) con una sustitución de línea
# cada uno: el archivo está congelado a crecimiento.

.PLAN_TT_UNIDAD <- "comentarios con contenido"
.PLAN_TT_SUBTITULO <- "% de comentarios con contenido que toca cada tema (suman más de 100 %)"
.PLAN_TT_PATRON_LETRA <- "^\\s*([A-Za-z])\\.\\s+(.+)$"

#' El texto abierto declarado en `temas_de_texto`, o `NULL` si la opción está apagada
#' @keywords internal
.plan_tt_var <- function(overrides) {
  v <- trimws(as.character(unlist((overrides %||% list())$temas_de_texto))[1])
  if (length(v) && !is.na(v) && nzchar(v)) v else NULL
}

#' La columna del texto: la pedida, no su `_recod` (`.resolve_ref` redirige `coment` a `coment_recod` cuando existe)
#' @keywords internal
.plan_tt_texto_de <- function(ctx) ctx$var_requested %||% ctx$var

#' Ajusta los overrides de la lámina cuando la opción está encendida: subtítulo de múltiple con la nota de más de
#' 100 %, orden de los códigos (el de la tabla) y sin agrupar el resto en «Otros» salvo que el gráfico lo pida
#' @keywords internal
.plan_tt_overrides <- function(overrides) {
  overrides <- overrides %||% list()
  if (is.null(.plan_tt_var(overrides))) return(overrides)
  if (is.null(overrides$subtitulo)) {
    overrides <- .ppt_multiple_choice_notice_overrides(overrides)
    overrides$subtitulo <- .PLAN_TT_SUBTITULO
  }
  overrides$orden_barras <- "instrumento"
  overrides$invertir_barras <- TRUE
  overrides$orden_categorias_manual <- NULL
  overrides$otros_al_final <- FALSE
  if (is.null(overrides$agrupar_resto_en_otros)) overrides$agrupar_resto_en_otros <- FALSE
  overrides
}

#' Encabezado de la lámina nativa (lamina_compositor.R) con la opción encendida: el % es de comentarios con contenido y
#' suma más de 100 %. `NULL` si no aplica (y el compositor pone el de siempre).
#' @keywords internal
.plan_tt_encabezado <- function(el) {
  if (!is.list(el) || !identical(el$.element_type %||% "", "barras_agrupadas")) return(NULL)
  ov <- el$overrides %||% list()
  if (is.null(.plan_tt_var(ov))) return(NULL)
  sub <- trimws(as.character(unlist(ov$subtitulo))[1])
  if (length(sub) && !is.na(sub) && nzchar(sub)) sub else .PLAN_TT_SUBTITULO
}

#' Nombre de un módulo por su letra, desde la etiqueta de su grupo («MÓDULO B. EXPERIENCIA UNIVERSITARIA» →
#' «B. Experiencia universitaria»); sin grupo con esa letra, «B. Todos sus temas»
#' @keywords internal
.plan_tt_modulo <- function(survey, letra) {
  if (is.data.frame(survey) && nrow(survey) && "type" %in% names(survey)) {
    grupos <- grepl("^begin[_ ]group", as.character(survey$type))
    cols <- grep("^label", names(survey), value = TRUE)
    for (cl in cols) {
      lab <- trimws(gsub("\\*+|<[^>]+>", "", sub("^[#\\s]+", "", as.character(survey[[cl]][grupos]), perl = TRUE)))
      m <- regmatches(lab, regexec("^(?:m[oó]dulo|secci[oó]n|bloque|parte)\\s+([a-z0-9]{1,2})\\s*[.:\\-–—]\\s*(.+)$", lab,
                                   ignore.case = TRUE, perl = TRUE))
      for (x in m) {
        if (length(x) == 3L && identical(toupper(x[2]), toupper(letra))) {
          nombre <- trimws(x[3])
          if (identical(nombre, toupper(nombre))) nombre <- paste0(substr(nombre, 1L, 1L), tolower(substr(nombre, 2L, nchar(nombre))))
          return(paste0(toupper(letra), ". ", nombre))
        }
      }
    }
  }
  paste0(toupper(letra), ". Todos sus temas")
}

#' Rótulo corto de un subtema: sin la letra del módulo y, si pasa de cuatro palabras, con la regla de
#' `.codif_rotulo_corto_subtema`
#' @keywords internal
.plan_tt_rotulo_subtema <- function(letra, resto) {
  corto <- resto
  if (length(strsplit(trimws(resto), "\\s+")[[1]]) > 4L) {
    r <- .codif_rotulo_corto_subtema(resto)
    if (nzchar(r)) corto <- r
  }
  paste0(toupper(letra), " · ", corto)
}

#' Tabla de temas: % de comentarios con contenido por tema, con los subtemas bajo su módulo
#'
#' @param data Base (ya filtrada) con las dummies `var.<código>` (o `var/<código>`) y el texto.
#' @param var La múltiple codificada; `texto` el texto abierto.
#' @return `data.frame(Opciones, n, pct, n_casos)` con la fila `Total` (la base), o `NULL` si no hay dummies.
#' @keywords internal
.plan_tt_tabla <- function(data, var, texto, orders_list, survey) {
  ol <- (orders_list %||% list())[[var]]
  codigos <- as.character(ol$names %||% character(0))
  etiquetas <- as.character(ol$labels %||% codigos)
  col_de <- function(cd) {
    for (nm in c(paste0(var, ".", cd), paste0(var, "/", cd))) if (nm %in% names(data)) return(nm)
    NA_character_
  }
  cols <- vapply(codigos, col_de, character(1))
  if (!length(cols) || all(is.na(cols)) || !texto %in% names(data)) return(NULL)
  marca <- function(cs) {
    cs <- cs[!is.na(cs)]
    if (!length(cs)) return(rep(FALSE, nrow(data)))
    rowSums(vapply(cs, function(cl) {
      v <- suppressWarnings(as.numeric(as.character(data[[cl]])))
      !is.na(v) & v == 1
    }, logical(nrow(data))), na.rm = TRUE) > 0
  }
  x <- as.character(data[[texto]]); x[is.na(x)] <- ""
  base <- (nzchar(trimws(x)) & !.txt_no_respuesta(x)) | marca(cols)
  w <- .peso_vec(data)
  w[!is.finite(w)] <- 0
  n_de <- function(m) sum(w[m & base])
  casos_de <- function(m) sum(m & base & w > 0)

  letra <- vapply(etiquetas, function(e) {
    m <- regmatches(e, regexec(.PLAN_TT_PATRON_LETRA, e, perl = TRUE))[[1]]
    if (length(m) == 3L) toupper(m[2]) else ""
  }, character(1), USE.NAMES = FALSE)
  resto <- sub(.PLAN_TT_PATRON_LETRA, "\\2", etiquetas, perl = TRUE)
  conteo <- table(letra[nzchar(letra)])
  partidas <- names(conteo)[conteo >= 2L]

  filas <- list(); hechas <- character(0)
  fila <- function(op, m) list(Opciones = op, n = n_de(m), n_casos = casos_de(m))
  for (i in seq_along(codigos)) {
    if (nzchar(letra[i]) && letra[i] %in% partidas) {
      if (letra[i] %in% hechas) next
      hechas <- c(hechas, letra[i])
      idx <- which(letra == letra[i])
      filas[[length(filas) + 1L]] <- fila(.plan_tt_modulo(survey, letra[i]), marca(cols[idx]))
      for (j in idx) filas[[length(filas) + 1L]] <- fila(.plan_tt_rotulo_subtema(letra[i], resto[j]), marca(cols[j]))
    } else {
      filas[[length(filas) + 1L]] <- fila(etiquetas[i], marca(cols[i]))
    }
  }
  N <- sum(w[base]); N_casos <- sum(base & w > 0)
  out <- data.frame(
    Opciones = c(vapply(filas, `[[`, "", "Opciones"), "Total"),
    n = c(vapply(filas, `[[`, 0, "n"), N),
    n_casos = c(vapply(filas, `[[`, 0, "n_casos"), N_casos),
    stringsAsFactors = FALSE
  )
  out$pct <- if (N > 0) out$n / N else NA_real_
  out[, c("Opciones", "n", "pct", "n_casos")]
}

#' Enganche de `.render_barras_agrupadas`: con la opción encendida y sin cruce, reemplaza la tabla de frecuencias de la
#' múltiple por la de temas. Con cruce, avisa y deja la tabla de siempre.
#' @keywords internal
.plan_tt_tab_render <- function(tab, overrides, var, filtros, cruce, resolve_ref, filter_data) {
  texto <- .plan_tt_var(overrides)
  if (is.null(texto) || is.null(tab)) return(tab)
  if (!is.null(cruce) && length(cruce) && nzchar(trimws(as.character(cruce)[1]))) {
    .pulso_aviso(sprintf("«%s»: «temas de %s» no se aplica a un gráfico con cruce; sale como múltiple.", var, texto))
    return(tab)
  }
  tryCatch({
    ctx <- resolve_ref(var, arg_name = "var")
    ctx_t <- resolve_ref(texto, source = ctx$source, arg_name = "temas_de_texto")
    d <- filter_data(filtros, source = ctx$source)
    .plan_tt_tabla(d, ctx$var, .plan_tt_texto_de(ctx_t), ctx$orders_list, ctx$survey) %||% {
      .pulso_aviso(sprintf("«%s»: no se encontraron los temas o el texto «%s»; sale como múltiple.", var, texto))
      tab
    }
  }, error = function(e) {
    .aviso_detalle("temas de ", texto, ": ", conditionMessage(e))
    .pulso_aviso(sprintf("«%s»: no se pudo calcular el %% de comentarios con contenido%s; sale como múltiple.", var,
                         .aviso_motivo(conditionMessage(e), " (%s)")))
    tab
  })
}

#' Enganche de la base del elemento: «Base: N comentarios con contenido» con la opción encendida; `NULL` si no aplica
#' (y entonces la base sale como siempre)
#' @keywords internal
.plan_tt_caption <- function(el, formato, resolve_ref, filter_data) {
  if (!inherits(el, "ppt_element") || !identical(el$.element_type %||% "", "barras_agrupadas")) return(NULL)
  ov <- el$overrides %||% list()
  texto <- .plan_tt_var(ov)
  if (is.null(texto) || !is.null(ov$cruces %||% el$cruces)) return(NULL)
  tab <- tryCatch({
    ctx <- resolve_ref(el$var, arg_name = "var")
    ctx_t <- resolve_ref(texto, source = ctx$source, arg_name = "temas_de_texto")
    .plan_tt_tabla(filter_data(el$filtros %||% list(), source = ctx$source), ctx$var, .plan_tt_texto_de(ctx_t), ctx$orders_list, ctx$survey)
  }, error = function(e) NULL)
  if (is.null(tab)) return(NULL)
  n <- tab$n_casos[tab$Opciones == "Total"][1]
  if (!is.finite(n) || n <= 0) return(NULL)
  unidad <- trimws(as.character(unlist(ov$unidad_base))[1])
  if (!length(unidad) || is.na(unidad) || !nzchar(unidad)) unidad <- .PLAN_TT_UNIDAD
  sprintf(formato %||% "Base: %s", paste(format(n, big.mark = ",", scientific = FALSE), unidad))
}
