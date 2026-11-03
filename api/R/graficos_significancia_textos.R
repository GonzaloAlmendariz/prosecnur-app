# Fuente única de los textos de diferencias (propuesta §4.4, ADR 0128 §4)
# =======================================================================
#
# El PPT, el Word, la lámina «Cómo leer», las tablas de cruces y la UI dicen lo mismo con las mismas palabras. Antes el
# Word recibía la nota como caption de ggplot, la lámina 5 decía «confianza de 95%» y las notas «α = 0.05». Aquí vive
# cada frase una sola vez.
#
# Números en es-PE, con punto decimal. «Puntos», no «pp». «p ajustado», sin α en el texto para el cliente.

#' Número con punto decimal y sin ceros sobrantes (0.05, 0.1, 10)
#' @keywords internal
.sig_num <- function(x) {
  x <- as.numeric(x)
  out <- formatC(x, format = "f", digits = 2)
  out <- sub("0+$", "", out)
  sub("\\.$", "", out)
}

#' Porcentaje entero para el texto (44 → «44%»)
#' @keywords internal
.sig_pct <- function(p) paste0(round(100 * as.numeric(p)), "%")

#' Nombre legible del conglomerado («aula», «curso horario»)
#' @keywords internal
.sig_nombre_conglomerado <- function(col) {
  col <- as.character(col %||% "")[1]
  if (is.na(col) || !nzchar(col)) return("conglomerado")
  gsub("[_.]+", " ", tolower(sub("_id$", "", col)))
}

#' Frase del método: qué prueba y qué corrección
#' @keywords internal
.sig_texto_metodo <- function(regla) {
  alfa <- .sig_num(regla$alfa %||% 0.05)
  prueba <- if (identical(regla$prueba, "rao_scott")) {
    paste0("Rao-Scott por ", .sig_nombre_conglomerado(regla$conglomerado))
  } else {
    "Prueba z"
  }
  corr <- if (identical(regla$correccion, "bh_informe")) "Benjamini-Hochberg" else "Bonferroni"
  sprintf("%s, p < %s con corrección de %s.", prueba, alfa, corr)
}

#' Línea de marcas de la nota (con o sin frágiles)
#' @keywords internal
.sig_texto_linea_marcas <- function(regla, hay_fragiles = FALSE, frente_al_resto = FALSE) {
  umbral <- .sig_num(regla$umbral_puntos %||% 10)
  magnitud <- if ((regla$umbral_puntos %||% 0) > 0) sprintf(" y de al menos %s puntos", umbral) else ""
  marca <- if (isTRUE(frente_al_resto)) {
    sprintf("▲▼  Mayor o menor que el resto de los grupos: diferencia significativa%s.", magnitud)
  } else {
    sprintf("▲A  Mayor que el grupo de esa letra: diferencia significativa%s.", magnitud)
  }
  fragil <- if (isTRUE(hay_fragiles)) {
    sprintf(" △A  Frágil: igual, con p ajustado entre 0.01 y %s.", .sig_num(regla$alfa %||% 0.05))
  } else {
    ""
  }
  paste0(marca, fragil, " ", .sig_texto_metodo(regla))
}

#' Nota cuando ninguna diferencia se sostiene: dice las cifras extremas, porque el silencio se leería como «no se probó»
#' @keywords internal
.sig_texto_ninguna <- function(regla, p_max, grupo_max, p_min, grupo_min, niveles = FALSE) {
  quien <- if (isTRUE(niveles)) "niveles" else "grupos"
  if (!is.finite(p_max) || !is.finite(p_min) || !nzchar(grupo_max %||% "")) {
    return(sprintf("Ninguna diferencia entre %s es significativa. %s", quien, .sig_texto_metodo(regla)))
  }
  sprintf("Ninguna diferencia entre %s es significativa: el %s de %s y el %s de %s no se distinguen con esta muestra. %s",
          quien, .sig_pct(p_max), grupo_max, .sig_pct(p_min), grupo_min, .sig_texto_metodo(regla))
}

#' Línea de contexto de los grupos que no se comparan (base o conglomerados insuficientes)
#' @keywords internal
.sig_texto_bases_chicas <- function(regla, etiquetas) {
  etiquetas <- unique(as.character(etiquetas[nzchar(etiquetas)]))
  if (!length(etiquetas)) return(NULL)
  lista <- if (length(etiquetas) == 1L) etiquetas else paste(paste(utils::head(etiquetas, -1), collapse = ", "), "y",
                                                             utils::tail(etiquetas, 1))
  cond <- if (identical(regla$prueba, "rao_scott")) {
    sprintf("menos de %s casos o de %s %ss", .sig_num(regla$base_minima), regla$conglomerados_minimos,
            .sig_nombre_conglomerado(regla$conglomerado))
  } else {
    sprintf("menos de %s casos", .sig_num(regla$base_minima))
  }
  sprintf("Con trama: %s, con %s. Se muestran como referencia y no se comparan.", lista, cond)
}

#' Línea de contexto del *top two box*
#' @keywords internal
.sig_texto_top_two_box <- function(rotulo, opciones) {
  sprintf("%s: %s; la marca la compara. «No sé» se muestra y cuenta en la base, pero no se compara.",
          rotulo, paste(opciones, collapse = " + "))
}

#' Línea de contexto de la respuesta múltiple
#' @keywords internal
.sig_texto_multiple <- function(k_omitidas = 0L) {
  base <- "Respuesta múltiple: cada opción se compara por separado y los porcentajes no suman 100%."
  if (k_omitidas > 0L) {
    base <- paste0(base, sprintf(" Se omiten %d opciones sin diferencias (ver tablas de cruces).", as.integer(k_omitidas)))
  }
  base
}

#' Abstención por diseño
#' @keywords internal
.sig_texto_abstencion <- function(motivo = c("repeat", "dependiente", "desconocido")) {
  motivo <- match.arg(motivo)
  switch(motivo,
    "repeat" = paste0("No se marcan diferencias: cada estudiante aporta varias respuestas (grupo repetido) y las ",
                    "observaciones no son independientes."),
    dependiente = paste0("No se marcan diferencias: las barras comparan preguntas respondidas por las mismas personas ",
                         "y la prueba exige grupos independientes."),
    desconocido = "No se marcan diferencias: no se pudo establecer si las observaciones son independientes."
  )
}

#' Redacción sugerida para el informe («Copiar redacción» de la UI)
#'
#' La frágil se redacta con prudencia y no se lleva a conclusiones (plan de análisis, regla 4).
#' @keywords internal
.sig_texto_redaccion <- function(fila, grupo_a, grupo_b, p_a, p_b, fragil = FALSE) {
  if (isTRUE(fragil)) {
    sprintf("En %s, «%s» es algo más frecuente que en %s (%s frente a %s).",
            grupo_a, fila, grupo_b, .sig_pct(p_a), .sig_pct(p_b))
  } else {
    sprintf("En %s, «%s» es más frecuente que en %s (%s frente a %s).",
            grupo_a, fila, grupo_b, .sig_pct(p_a), .sig_pct(p_b))
  }
}
