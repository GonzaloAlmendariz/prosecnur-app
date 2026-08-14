# Puntos comparativos: un indicador descriptivo por grupo
# =======================================================
#
# Este archivo concentra las dos piezas calculables del tipo:
#   1) el estimando ponderado por grupo, con n crudo y guardas metodologicas;
#   2) el grafico de puntos independientes sobre un eje fijo 0--100.
#
# No conoce sesiones, rutas HTTP ni planes PPT. El adaptador del plan vive en
# `graficos_puntos_comparativos_plan.R` y solo resuelve la fuente activa antes
# de llamar estas funciones.

.puntos_comparativos_codigos <- function(x, argumento, permitir_null = FALSE) {
  if (is.null(x) && isTRUE(permitir_null)) return(NULL)
  if (is.null(x) || !length(x)) {
    stop("`", argumento, "` debe declarar al menos un codigo no vacio.", call. = FALSE)
  }

  valores <- as.character(unlist(x, use.names = FALSE))
  if (!length(valores) || anyNA(valores)) {
    stop("`", argumento, "` debe contener codigos no vacios.", call. = FALSE)
  }
  # El editor envia un vector, pero se conserva compatibilidad con planes que
  # hayan serializado una lista como texto separado por coma/semicolon/barra.
  valores <- unlist(strsplit(valores, "[,;|]", perl = TRUE), use.names = FALSE)
  valores <- trimws(valores)
  if (!length(valores) || any(!nzchar(valores))) {
    stop("`", argumento, "` debe contener codigos no vacios.", call. = FALSE)
  }
  if (anyDuplicated(valores)) {
    stop("`", argumento, "` contiene codigos duplicados; deben ser unicos.", call. = FALSE)
  }
  valores
}

.puntos_comparativos_variable <- function(instrumento, variable, rol) {
  survey <- (instrumento %||% list())$survey %||% NULL
  if (!is.data.frame(survey) || !all(c("name", "type") %in% names(survey))) {
    stop(
      "puntos_comparativos: el instrumento no permite acreditar `", rol,
      "` ni su tipo select_one.",
      call. = FALSE
    )
  }
  idx <- which(as.character(survey$name) == as.character(variable))
  if (!length(idx)) {
    stop(
      "puntos_comparativos: la variable de `", rol, "` `", variable,
      "` no existe en el instrumento.",
      call. = FALSE
    )
  }
  idx <- idx[[1]]
  tipo <- trimws(as.character(survey$type[[idx]]))
  if (is.na(tipo) || !grepl("^select_one(?:\\s|$)", tipo, perl = TRUE)) {
    stop(
      "puntos_comparativos: `", rol, "` (`", variable,
      "`) debe ser select_one; se encontro `",
      if (is.na(tipo) || !nzchar(tipo)) "desconocido" else tipo,
      "`.",
      call. = FALSE
    )
  }

  diseno <- .graficos_sig_diseno_de_fuente(instrumento, variable)
  if (!identical(diseno, "independiente")) {
    stop(
      "puntos_comparativos: `", rol, "` (`", variable,
      "`) debe ser una select_one plana independiente; se detecto `", diseno,
      "` (repeat/cluster).",
      call. = FALSE
    )
  }

  opciones <- .equiv_escala_opciones(instrumento, variable)
  if (!length(opciones)) {
    stop(
      "puntos_comparativos: no se pudo acreditar la escala de `", rol,
      "` (`", variable, "`) en choices.",
      call. = FALSE
    )
  }
  codigos <- vapply(opciones, function(opcion) {
    trimws(as.character(opcion$codigo %||% "")[[1]])
  }, character(1))
  etiquetas <- vapply(opciones, function(opcion) {
    trimws(as.character(opcion$etiqueta %||% "")[[1]])
  }, character(1))
  if (anyNA(codigos) || any(!nzchar(codigos)) || anyDuplicated(codigos) ||
      anyNA(etiquetas) || any(!nzchar(etiquetas))) {
    stop(
      "puntos_comparativos: la escala de `", rol,
      "` debe tener codigos unicos y etiquetas no vacias.",
      call. = FALSE
    )
  }

  pregunta <- as.character(
    if ("label" %in% names(survey)) survey$label[[idx]] else variable
  )[[1]]
  if (is.na(pregunta) || !nzchar(trimws(pregunta))) pregunta <- as.character(variable)

  list(
    variable = as.character(variable),
    codigos = codigos,
    etiquetas = etiquetas,
    pregunta = trimws(pregunta)
  )
}

.puntos_comparativos_exclusiones <- function(x, escala) {
  tokens <- .puntos_comparativos_codigos(
    x,
    "excluir_opciones",
    permitir_null = TRUE
  )
  if (is.null(tokens)) return(character(0))

  resueltos <- character(length(tokens))
  for (i in seq_along(tokens)) {
    token <- tokens[[i]]
    por_codigo <- which(escala$codigos == token)
    por_etiqueta <- which(escala$etiquetas == token)
    candidatos <- unique(c(por_codigo, por_etiqueta))
    if (length(candidatos) != 1L) {
      stop(
        "puntos_comparativos: `excluir_opciones` contiene `", token,
        "`, que no resuelve de forma unica a un codigo de la escala del indicador.",
        call. = FALSE
      )
    }
    resueltos[[i]] <- escala$codigos[[candidatos]]
  }
  if (anyDuplicated(resueltos)) {
    stop(
      "puntos_comparativos: `excluir_opciones` resuelve codigos duplicados; deben ser unicos.",
      call. = FALSE
    )
  }
  resueltos
}

.puntos_comparativos_pesos <- function(data, declaracion = NULL) {
  ponderado <- FALSE
  columna <- ""
  if (!is.null(declaracion)) {
    declaracion_chr <- as.character(declaracion)
    if (length(declaracion_chr) != 1L || is.na(declaracion_chr) ||
        !nzchar(trimws(declaracion_chr))) {
      stop(
        "puntos_comparativos: la declaracion `attr(data, 'var_peso')` no resuelve una columna de peso.",
        call. = FALSE
      )
    }
    columna <- trimws(declaracion_chr)
    if (!(columna %in% names(data))) {
      stop(
        "puntos_comparativos: la columna de peso declarada `", columna,
        "` no existe en data.",
        call. = FALSE
      )
    }
    ponderado <- TRUE
  } else if ("peso" %in% names(data)) {
    columna <- "peso"
    ponderado <- TRUE
  }

  pesos <- if (nzchar(columna)) {
    valores_peso <- data[[columna]]
    if (is.factor(valores_peso)) {
      valores_peso <- as.character(valores_peso)
    }
    suppressWarnings(as.numeric(valores_peso))
  } else {
    rep(1, nrow(data))
  }
  if (length(pesos) != nrow(data)) {
    stop("puntos_comparativos: la columna de peso tiene un largo incompatible.", call. = FALSE)
  }
  if (any(is.finite(pesos) & pesos < 0)) {
    stop("puntos_comparativos: el peso no puede contener valores negativos.", call. = FALSE)
  }

  list(valores = pesos, ponderado = ponderado, columna = columna)
}

.puntos_comparativos_orden <- function(observados, escala_grupos, orden_grupos = NULL) {
  if (is.null(orden_grupos)) {
    return(escala_grupos$codigos[escala_grupos$codigos %in% observados])
  }
  orden <- .puntos_comparativos_codigos(orden_grupos, "orden_grupos")
  if (length(orden) != length(observados) || !setequal(orden, observados)) {
    faltan <- setdiff(observados, orden)
    sobran <- setdiff(orden, observados)
    stop(
      "puntos_comparativos: `orden_grupos` debe ser una permutacion exacta y completa; faltan [",
      paste(faltan, collapse = ", "), "] y sobran [",
      paste(sobran, collapse = ", "), "].",
      call. = FALSE
    )
  }
  orden
}

# Motor puro: una fila de salida por grupo observado.
.puntos_comparativos_calcular <- function(
    data,
    instrumento,
    var,
    cruces,
    corte,
    filtros = list(),
    orden_grupos = NULL,
    excluir_opciones = NULL
) {
  if (!is.data.frame(data)) {
    stop("puntos_comparativos: `data` debe ser un data.frame.", call. = FALSE)
  }
  if (identical(as.character(var), as.character(cruces))) {
    stop("puntos_comparativos: `var` y `cruces` deben ser variables distintas.", call. = FALSE)
  }

  indicador <- .puntos_comparativos_variable(instrumento, var, "indicador")
  grupos <- .puntos_comparativos_variable(instrumento, cruces, "cruces")
  corte_codigos <- .puntos_comparativos_codigos(corte, "corte")
  faltan_corte <- setdiff(corte_codigos, indicador$codigos)
  if (length(faltan_corte)) {
    stop(
      "puntos_comparativos: el corte contiene el codigo `",
      paste(faltan_corte, collapse = ", "),
      "`, que no existe en la escala del indicador.",
      call. = FALSE
    )
  }

  excluir <- .puntos_comparativos_exclusiones(excluir_opciones, indicador)
  solape <- intersect(corte_codigos, excluir)
  if (length(solape)) {
    stop(
      "puntos_comparativos: `corte` y `excluir_opciones` se solapan en `",
      paste(solape, collapse = ", "), "`.",
      call. = FALSE
    )
  }
  elegibles <- setdiff(indicador$codigos, excluir)
  if (!length(elegibles) || setequal(corte_codigos, elegibles)) {
    stop(
      "puntos_comparativos: `corte` debe ser no trivial, un subconjunto propio de la escala elegible.",
      call. = FALSE
    )
  }

  declaracion_peso <- attr(data, "var_peso", exact = TRUE)
  filtrada <- .apply_named_filters(
    data,
    filters = filtros %||% list(),
    arg_name = "filtros",
    mode = "strict"
  )
  pesos <- .puntos_comparativos_pesos(filtrada, declaracion = declaracion_peso)

  indicador_valores <- trimws(as.character(filtrada[[var]]))
  grupos_valores <- trimws(as.character(filtrada[[cruces]]))
  indicador_presente <- !is.na(indicador_valores) & nzchar(indicador_valores)
  grupo_presente <- !is.na(grupos_valores) & nzchar(grupos_valores)

  codigos_indicador_desconocidos <- setdiff(
    unique(indicador_valores[indicador_presente]),
    indicador$codigos
  )
  if (length(codigos_indicador_desconocidos)) {
    stop(
      "puntos_comparativos: el indicador observa codigos fuera de su escala: ",
      paste(codigos_indicador_desconocidos, collapse = ", "), ".",
      call. = FALSE
    )
  }

  observados <- unique(grupos_valores[grupo_presente])
  grupos_desconocidos <- setdiff(observados, grupos$codigos)
  if (length(grupos_desconocidos)) {
    stop(
      "puntos_comparativos: `cruces` observa grupos fuera de su escala: ",
      paste(grupos_desconocidos, collapse = ", "), ".",
      call. = FALSE
    )
  }
  n_grupos <- length(observados)
  if (n_grupos < 2L || n_grupos > 12L) {
    stop(
      "puntos_comparativos: deben quedar entre 2 y 12 grupos observados; quedaron ",
      n_grupos, ".",
      call. = FALSE
    )
  }
  etiquetas_observadas <- grupos$etiquetas[match(observados, grupos$codigos)]
  if (anyDuplicated(.escala_etiqueta_normalizada(etiquetas_observadas))) {
    stop(
      paste0(
        "puntos_comparativos: las etiquetas acreditadas de los grupos observados ",
        "deben ser distinguibles despues de normalizar caja y espacios."
      ),
      call. = FALSE
    )
  }
  orden <- .puntos_comparativos_orden(observados, grupos, orden_grupos)

  filas <- lapply(orden, function(grupo) {
    en_grupo <- grupo_presente & grupos_valores == grupo
    respuesta_valida <- indicador_presente & indicador_valores %in% elegibles
    peso_positivo <- is.finite(pesos$valores) & pesos$valores > 0
    validas <- en_grupo & respuesta_valida & peso_positivo
    denominador <- sum(pesos$valores[validas])
    if (!is.finite(denominador) || denominador <= 0) {
      etiqueta <- grupos$etiquetas[match(grupo, grupos$codigos)]
      stop(
        "puntos_comparativos: el grupo `", etiqueta, "` (`", grupo,
        "`) quedo con denominador/base cero, sin peso positivo.",
        call. = FALSE
      )
    }
    numerador <- sum(
      pesos$valores[validas & indicador_valores %in% corte_codigos]
    )
    data.frame(
      grupo_codigo = grupo,
      grupo = grupos$etiquetas[match(grupo, grupos$codigos)],
      porcentaje = 100 * numerador / denominador,
      n = as.integer(sum(validas)),
      stringsAsFactors = FALSE
    )
  })

  out <- do.call(rbind, filas)
  if (anyDuplicated(out$grupo)) {
    stop(
      "puntos_comparativos: las etiquetas observadas de `cruces` deben ser unicas.",
      call. = FALSE
    )
  }
  out$grupo <- factor(out$grupo, levels = out$grupo)
  rownames(out) <- NULL

  etiquetas_corte <- indicador$etiquetas[match(corte_codigos, indicador$codigos)]
  attr(out, "puntos_comparativos_pregunta") <- indicador$pregunta
  attr(out, "puntos_comparativos_corte_etiqueta") <- paste(etiquetas_corte, collapse = " + ")
  attr(out, "puntos_comparativos_ponderado") <- isTRUE(pesos$ponderado)
  attr(out, "puntos_comparativos_peso") <- pesos$columna
  out
}

#' Puntos comparativos independientes
#'
#' Dibuja un punto y su base cruda por grupo. `data` debe contener una fila por
#' grupo ya calculada; la funcion no une puntos ni agrega intervalos.
#'
#' @param data Data frame con una fila por grupo.
#' @param var_grupo Columna con la etiqueta del grupo.
#' @param var_valor Columna con el porcentaje (escala 0--100).
#' @param var_n Columna con el numero crudo de casos validos.
#' @family graficador
#' @export
graficar_puntos_comparativos <- function(
    data,
    var_grupo = "grupo",
    var_valor = "porcentaje",
    var_n = "n",
    titulo = NULL,
    subtitulo = NULL,
    nota_pie = NULL,
    valores_decimales = 0L,
    color_punto = "#002457",
    size_punto = 4.2,
    color_etiqueta = .PULSO_COLOR_EJES,
    size_etiqueta = 3.2,
    color_ejes = .PULSO_COLOR_EJES,
    size_ejes = 9,
    mostrar_grid_x = TRUE,
    color_titulo = .PULSO_COLOR_TEXTO,
    size_titulo = 11,
    color_subtitulo = .PULSO_COLOR_TEXTO,
    size_subtitulo = 9,
    color_nota_pie = .PULSO_COLOR_TEXTO,
    size_nota_pie = 8,
    textos_negrita = NULL,
    font_family = "Arial"
) {
  if (!is.data.frame(data) || !nrow(data)) {
    stop("`data` debe ser un data frame con al menos dos grupos.", call. = FALSE)
  }
  requeridas <- c(var_grupo, var_valor, var_n)
  faltan <- setdiff(requeridas, names(data))
  if (length(faltan)) {
    stop("Faltan columnas en `data`: ", paste(faltan, collapse = ", "), ".", call. = FALSE)
  }

  grupos <- as.character(data[[var_grupo]])
  valores <- suppressWarnings(as.numeric(data[[var_valor]]))
  casos <- suppressWarnings(as.numeric(data[[var_n]]))
  if (length(grupos) < 2L || length(grupos) > 12L || anyNA(grupos) ||
      any(!nzchar(trimws(grupos))) || anyDuplicated(grupos)) {
    stop("`data` debe contener entre 2 y 12 grupos unicos no vacios.", call. = FALSE)
  }
  if (any(!is.finite(valores)) || any(valores < 0 | valores > 100)) {
    stop("Los porcentajes deben ser finitos y estar entre 0 y 100.", call. = FALSE)
  }
  if (any(!is.finite(casos)) || any(casos < 0) || any(casos != floor(casos))) {
    stop("`n` debe contener conteos crudos enteros no negativos.", call. = FALSE)
  }

  niveles <- if (is.factor(data[[var_grupo]])) {
    intersect(levels(data[[var_grupo]]), grupos)
  } else {
    grupos
  }
  df <- data.frame(
    .grupo = factor(grupos, levels = niveles),
    .valor = valores,
    .n = as.integer(casos),
    stringsAsFactors = FALSE
  )
  decimales <- suppressWarnings(as.integer(valores_decimales)[[1]])
  if (!is.finite(decimales) || decimales < 0L) decimales <- 0L
  decimales <- min(decimales, 3L)
  # Regla de la casa: el 0,5 sube. `round()` redondea al par.
  df$.etiqueta <- paste0(
    .pulso_fmt_half_up(df$.valor, decimales),
    " % · n = ", df$.n
  )
  df$.hjust <- ifelse(df$.valor >= 82, 1.18, -0.18)
  face <- .graficos_face_de(textos_negrita)

  ggplot2::ggplot(df, ggplot2::aes(x = .data$.valor, y = .data$.grupo)) +
    ggplot2::geom_point(colour = color_punto, size = size_punto) +
    ggplot2::geom_text(
      ggplot2::aes(label = .data$.etiqueta, hjust = .data$.hjust),
      colour = color_etiqueta,
      size = size_etiqueta,
      family = font_family,
      fontface = face("valores")
    ) +
    ggplot2::scale_x_continuous(
      limits = c(0, 100),
      breaks = seq(0, 100, by = 25),
      labels = function(x) paste0(x, "%"),
      expand = ggplot2::expansion(mult = c(0, 0))
    ) +
    ggplot2::labs(
      title = titulo,
      subtitle = subtitulo,
      caption = nota_pie,
      x = NULL,
      y = NULL
    ) +
    ggplot2::coord_cartesian(clip = "off") +
    ggplot2::theme_minimal(base_family = font_family) +
    ggplot2::theme(
      plot.title = ggplot2::element_text(
        colour = color_titulo, size = size_titulo, family = font_family,
        face = face("titulo"), hjust = 0.5
      ),
      plot.subtitle = ggplot2::element_text(
        colour = color_subtitulo, size = size_subtitulo, family = font_family,
        face = face("subtitulo"), hjust = 0.5
      ),
      plot.caption = ggplot2::element_text(
        colour = color_nota_pie, size = size_nota_pie, family = font_family,
        face = face("nota_pie"), hjust = 1
      ),
      axis.text = ggplot2::element_text(
        colour = color_ejes, size = size_ejes, family = font_family,
        face = face("ejes")
      ),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major.y = ggplot2::element_blank(),
      panel.grid.major.x = if (isTRUE(mostrar_grid_x)) {
        ggplot2::element_line(colour = .PULSO_COLOR_GRID, linewidth = 0.3)
      } else {
        ggplot2::element_blank()
      },
      plot.margin = ggplot2::margin(10, 48, 8, 12)
    )
}
