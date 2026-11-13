# Emparejar las columnas de una base con las preguntas del formulario por su texto.
#
# Ítem 4 del checklist de validación del practicante: la base digitada trae como
# encabezado el texto de cada pregunta ("P7. A continuación... 2. Puedo
# contarles cómo me siento") y no el `name` del formulario. Solo 1 de 204
# encabezados era igual al `label`, pero casi todos lo contienen después de la
# numeración. Este motor PROPONE el emparejamiento; no renombra nada. La persona
# revisa la propuesta y, al aceptarla, la base se carga con los encabezados
# renombrados (carga_emparejar_por_texto_aplicar.R). Desde ahí se cruza por
# identificador.
#
# Cómo empareja, de más a menos seguro:
#   1. exacta: el encabezado y el texto de la pregunta son iguales sin contar
#      tildes, mayúsculas, signos ni la numeración inicial ("P7.", "7)", "P7 -").
#   2. contenida: el encabezado contiene el texto entero de la pregunta.
#   3. dudosa: el texto se parece (la mayoría de sus palabras están en el
#      encabezado, o el encabezado es parte del texto), o el texto de la
#      pregunta también aparece en otro encabezado sin pareja.
# Una selección múltiple con una columna por opción se empareja como
# `pregunta/opción`: el encabezado termina con el texto de la opción y lo que
# queda antes se parece al texto de la pregunta.
#
# La asignación es uno a uno: cada encabezado y cada pregunta queda a lo sumo
# en una pareja, la de mejor coincidencia para ambos. Si un encabezado coincide
# igual de bien con dos preguntas (o dos encabezados con una pregunta), no se
# empareja y se dice por qué. Nada se descarta en silencio: cada encabezado sale
# con su estado y su causa.
#
# Base de las cifras del resumen: encabezados de la base leída (primera hoja de
# un libro, o el CSV). Nivel: columna.

# Proporción mínima de palabras del texto de la pregunta que deben estar en el
# encabezado para proponerlo como dudoso, y palabras mínimas del texto.
.CET_COBERTURA_MIN <- 0.75
.CET_PALABRAS_MIN <- 3L

# Normaliza un texto y le quita la numeración inicial ("P7.", "7)", "P10.1",
# "Pregunta 3 -"). Usa la normalización del normalizador de datos.
.cet_norm <- function(x) {
  x <- .dn_norm_text(x)
  x <- sub("^(p|preg|pregunta)? ?[0-9]+[a-z]?( [0-9]+)?( |$)", "", x, perl = TRUE)
  trimws(x)
}

.cet_tokens <- function(x) {
  if (!nzchar(x)) return(character(0))
  strsplit(x, " ", fixed = TRUE)[[1]]
}

# ¿`aguja` aparece entera (por palabras) dentro de `pajar`?
.cet_contiene <- function(pajar, aguja) {
  nzchar(aguja) && grepl(paste0(" ", aguja, " "), paste0(" ", pajar, " "), fixed = TRUE)
}

# Proporción de las palabras de `texto` que están en `encabezado`.
.cet_cobertura <- function(texto_tokens, encabezado_tokens) {
  if (!length(texto_tokens)) return(0)
  mean(texto_tokens %in% encabezado_tokens)
}

# Primera columna label* del survey (la que se ve en el formulario).
.cet_label_col <- function(df) {
  if (!is.data.frame(df)) return(NA_character_)
  if ("label" %in% names(df)) return("label")
  grep("^label", names(df), value = TRUE)[1]
}

#' Destinos del emparejamiento: preguntas que deben venir como columna y, para
#' cada selección múltiple, una por opción (`pregunta/opción`).
#' @keywords internal
.cet_destinos <- function(instrumento) {
  vacio <- data.frame(name = character(0), texto = character(0), norm = character(0),
                      tipo = character(0), padre = character(0), padre_norm = character(0),
                      opcion = character(0), opcion_norm = character(0), stringsAsFactors = FALSE)
  survey <- instrumento$survey
  if (!is.data.frame(survey) || !nrow(survey)) return(vacio)
  esperadas <- .dn_expected_data_names(instrumento)
  nombres <- .dn_survey_names(survey)
  col_label <- .cet_label_col(survey)
  labels <- if (is.na(col_label)) rep("", nrow(survey)) else as.character(survey[[col_label]])
  labels[is.na(labels)] <- ""
  tipos <- .dn_survey_type_raw(survey)
  choices <- instrumento$choices
  col_ch <- .cet_label_col(choices)
  filas <- list()
  for (nm in esperadas) {
    i <- match(nm, nombres)
    lab <- labels[i]
    filas[[length(filas) + 1L]] <- data.frame(
      name = nm, texto = lab, norm = .cet_norm(lab), tipo = "pregunta", padre = nm,
      padre_norm = .cet_norm(lab), opcion = "", opcion_norm = "", stringsAsFactors = FALSE
    )
    if (grepl("^select_multiple\\b", tipos[i]) && is.data.frame(choices) && !is.na(col_ch)) {
      ln <- .dn_survey_list_name(survey[i, , drop = FALSE])
      ch <- choices[as.character(choices$list_name) %in% ln, , drop = FALSE]
      if (nrow(ch)) {
        op <- as.character(ch[[col_ch]])
        op[is.na(op)] <- ""
        filas[[length(filas) + 1L]] <- data.frame(
          name = paste0(nm, "/", as.character(ch$name)), texto = paste0(lab, " / ", op),
          norm = .cet_norm(paste(lab, op)), tipo = "opcion", padre = nm, padre_norm = .cet_norm(lab),
          opcion = op, opcion_norm = .dn_norm_text(op), stringsAsFactors = FALSE
        )
      }
    }
  }
  if (!length(filas)) return(vacio)
  do.call(rbind, filas)
}

# Coincidencia de un encabezado normalizado con un destino: lista(tier, score, causa)
# o NULL si no se parecen.
.cet_coincidencia <- function(h, h_tokens, d) {
  if (identical(d$tipo, "opcion")) return(.cet_coincidencia_opcion(h, h_tokens, d))
  l <- d$norm
  if (!nzchar(l) || !nzchar(h)) return(NULL)
  if (identical(h, l)) {
    return(list(tier = 3L, score = 1, causa = "Mismo texto que la pregunta, sin contar la numeración"))
  }
  if (.cet_contiene(h, l)) {
    return(list(tier = 2L, score = nchar(l) / nchar(h), causa = "El encabezado contiene el texto de la pregunta"))
  }
  l_tokens <- .cet_tokens(l)
  if (length(l_tokens) >= .CET_PALABRAS_MIN) {
    cob <- .cet_cobertura(l_tokens, h_tokens)
    if (cob >= .CET_COBERTURA_MIN) {
      n_en <- sum(l_tokens %in% h_tokens)
      return(list(tier = 1L, score = cob,
                  causa = sprintf("El texto de la pregunta se parece al encabezado: %d de %d palabras están en él",
                                  n_en, length(l_tokens))))
    }
  }
  if (length(h_tokens) >= 2L && .cet_contiene(l, h)) {
    return(list(tier = 1L, score = 0.9 * nchar(h) / nchar(l),
                causa = "El encabezado es parte del texto de la pregunta"))
  }
  NULL
}

# Una opción de selección múltiple: el encabezado termina con el texto de la
# opción y lo que queda antes se parece al texto de la pregunta.
.cet_coincidencia_opcion <- function(h, h_tokens, d) {
  o <- d$opcion_norm
  if (!nzchar(o) || !nzchar(h)) return(NULL)
  if (!(identical(h, o) || endsWith(h, paste0(" ", o)))) return(NULL)
  resto <- trimws(substr(h, 1L, nchar(h) - nchar(o)))
  resto <- trimws(sub("( [0-9]+)+$", "", resto))
  p <- d$padre_norm
  if (!nzchar(resto) || !nzchar(p)) return(NULL)
  causa_op <- sprintf("termina con la opción \"%s\"", d$opcion)
  if (identical(resto, p)) {
    return(list(tier = 3L, score = 1, causa = paste("Texto de la pregunta seguido de la opción:", causa_op)))
  }
  if (.cet_contiene(resto, p) || .cet_contiene(p, resto)) {
    return(list(tier = 2L, score = min(nchar(p), nchar(resto)) / max(nchar(p), nchar(resto)),
                causa = paste("Contiene el texto de la pregunta y", causa_op)))
  }
  r_tokens <- .cet_tokens(resto)
  cob <- .cet_cobertura(r_tokens, .cet_tokens(p))
  if (length(r_tokens) >= 2L && cob >= .CET_COBERTURA_MIN) {
    return(list(tier = 1L, score = cob, causa = paste("Se parece al texto de la pregunta y", causa_op)))
  }
  NULL
}

# Matriz de coincidencias encabezado x destino (tier y score; 0 = sin coincidencia).
.cet_matriz <- function(h_norm, destinos) {
  nh <- length(h_norm)
  nd <- nrow(destinos)
  tier <- matrix(0L, nh, nd)
  score <- matrix(0, nh, nd)
  causa <- matrix("", nh, nd)
  for (i in seq_len(nh)) {
    h <- h_norm[i]
    if (!nzchar(h)) next
    ht <- .cet_tokens(h)
    for (j in seq_len(nd)) {
      m <- .cet_coincidencia(h, ht, destinos[j, , drop = FALSE])
      if (is.null(m)) next
      tier[i, j] <- m$tier
      score[i, j] <- m$score
      causa[i, j] <- m$causa
    }
  }
  list(tier = tier, score = score, causa = causa)
}

# Mejor índice de un vector de valores entre los habilitados; NA si no hay o si
# hay empate en el primer lugar (atributo "empate" con los empatados).
.cet_mejor <- function(valores, habilitados) {
  v <- valores
  v[!habilitados | v <= 0] <- NA_real_
  if (all(is.na(v))) return(NA_integer_)
  top <- max(v, na.rm = TRUE)
  idx <- which(!is.na(v) & abs(v - top) < 1e-9)
  if (length(idx) > 1L) return(structure(NA_integer_, empate = idx))
  idx
}

#' Propone el emparejamiento de los encabezados de una base con las preguntas del formulario.
#'
#' @param encabezados encabezados de la base, en su orden (columna 1, 2, ...).
#' @param instrumento instrumento del formulario (`survey`, `choices`).
#' @return lista con `columnas` (una fila por encabezado: columna, encabezado,
#'   estado, name, pregunta, confianza, causa), `candidatos` (por encabezado,
#'   hasta tres names parecidos), `destinos` (names que admite el
#'   emparejamiento, con su texto), `sin_columna` (preguntas del
#'   formulario que quedan sin columna) y `resumen` (conteos sobre los
#'   encabezados de la base).
#' @keywords internal
carga_emparejar_por_texto <- function(encabezados, instrumento) {
  encabezados <- as.character(encabezados %||% character(0))
  encabezados[is.na(encabezados)] <- ""
  destinos <- .cet_destinos(instrumento)
  nh <- length(encabezados)
  nombres_form <- unique(c(destinos$name, .dn_survey_names(instrumento$survey %||% data.frame())))
  ya_calza <- encabezados %in% nombres_form
  # Una pregunta que ya viene con su name no se ofrece; tampoco sus opciones.
  presentes <- encabezados[ya_calza]
  destino_libre <- !(destinos$name %in% presentes) & !(destinos$padre %in% presentes)

  h_norm <- .cet_norm(encabezados)
  h_norm[ya_calza] <- ""
  mat <- .cet_matriz(h_norm, destinos)
  valor <- mat$tier + mat$score * 0.999

  asignado_h <- rep(NA_integer_, nh)
  asignado_d <- rep(NA_integer_, nrow(destinos))
  empate_h <- vector("list", nh)
  empate_d <- vector("list", nrow(destinos))
  repeat {
    libres_h <- is.na(asignado_h) & !ya_calza
    libres_d <- is.na(asignado_d) & destino_libre
    nuevos <- 0L
    for (i in which(libres_h)) {
      j <- .cet_mejor(valor[i, ], libres_d)
      empate_h[i] <- list(attr(j, "empate"))
      if (is.na(j)) next
      k <- .cet_mejor(valor[, j], libres_h)
      empate_d[j] <- list(attr(k, "empate"))
      if (is.na(k) || k != i) next
      asignado_h[i] <- j
      asignado_d[j] <- i
      libres_h[i] <- FALSE
      # Una múltiple se empareja entera o por opciones, no de las dos formas.
      bloquear <- destinos$padre == destinos$padre[j] & destinos$tipo != destinos$tipo[j]
      destino_libre[bloquear] <- FALSE
      libres_d[j] <- FALSE
      libres_d[bloquear] <- FALSE
      nuevos <- nuevos + 1L
    }
    if (!nuevos) break
  }

  filas <- lapply(seq_len(nh), function(i) {
    .cet_fila(i, encabezados, ya_calza, asignado_h, asignado_d, empate_h, empate_d, mat, destinos)
  })
  columnas <- if (length(filas)) do.call(rbind, filas) else
    data.frame(columna = integer(0), encabezado = character(0), estado = character(0), name = character(0),
               pregunta = character(0), confianza = character(0), causa = character(0), stringsAsFactors = FALSE)

  cubiertas <- unique(c(presentes, destinos$padre[!is.na(asignado_d)]))
  preguntas <- destinos[destinos$tipo == "pregunta", , drop = FALSE]
  sin_col <- preguntas[!(preguntas$name %in% cubiertas), c("name", "texto"), drop = FALSE]
  names(sin_col) <- c("name", "pregunta")
  rownames(sin_col) <- NULL

  # Hasta tres preguntas candidatas por encabezado, de la más a la menos
  # parecida, para que la persona elija otra pareja al revisar.
  candidatos <- lapply(seq_len(nh), function(i) {
    idx <- which(mat$tier[i, ] > 0L & (destino_libre | !is.na(asignado_d)))
    idx <- idx[order(-valor[i, idx])]
    utils::head(destinos$name[idx], 3L)
  })
  cuenta <- function(e) as.integer(sum(columnas$estado == e))
  list(
    columnas = columnas,
    candidatos = candidatos,
    destinos = destinos[, c("name", "texto", "tipo"), drop = FALSE],
    sin_columna = sin_col,
    resumen = list(
      n_columnas = as.integer(nh),
      n_ya_calzan = cuenta("nombre"),
      n_propuestas = cuenta("exacta") + cuenta("contenida"),
      n_exactas = cuenta("exacta"),
      n_contenidas = cuenta("contenida"),
      n_dudosas = cuenta("dudosa"),
      n_ambiguas = cuenta("ambigua"),
      n_sin_pareja = cuenta("sin_pareja"),
      n_preguntas = as.integer(nrow(preguntas)),
      n_preguntas_sin_columna = as.integer(nrow(sin_col))
    )
  )
}

.cet_cita <- function(x) paste0("\"", x, "\"")

.cet_lista <- function(x) {
  x <- .cet_cita(x)
  if (length(x) <= 1L) return(x)
  paste0(paste(x[-length(x)], collapse = ", "), " y ", x[length(x)])
}

# Una fila del resultado: estado, pregunta propuesta, confianza y causa de un encabezado.
.cet_fila <- function(i, encabezados, ya_calza, asignado_h, asignado_d, empate_h, empate_d, mat, destinos) {
  fila <- function(estado, name = "", pregunta = "", confianza = "", causa = "") {
    data.frame(columna = i, encabezado = encabezados[i], estado = estado, name = name, pregunta = pregunta,
               confianza = confianza, causa = causa, stringsAsFactors = FALSE)
  }
  if (ya_calza[i]) return(fila("nombre", encabezados[i], "", "alta", "Ya trae el nombre de una pregunta del formulario"))
  j <- asignado_h[i]
  if (!is.na(j)) {
    tier <- mat$tier[i, j]
    causa <- mat$causa[i, j]
    # Otro encabezado sin pareja que también contiene el texto de esta pregunta.
    rivales <- which(is.na(asignado_h) & !ya_calza & mat$tier[, j] >= 2L & seq_along(asignado_h) != i)
    estado <- if (tier == 3L) "exacta" else if (tier == 2L) "contenida" else "dudosa"
    if (length(rivales) && estado != "dudosa") {
      estado <- "dudosa"
      causa <- sprintf("%s, pero el texto de la pregunta también aparece en %s", causa,
                       .cet_lista(utils::head(encabezados[rivales], 2L)))
    }
    confianza <- switch(estado, exacta = "alta", contenida = "media", "baja")
    return(fila(estado, destinos$name[j], destinos$texto[j], confianza, causa))
  }
  emp <- empate_h[[i]]
  if (length(emp) > 1L) {
    return(fila("ambigua", causa = sprintf("Coincide igual con %d preguntas: %s", length(emp),
                                           .cet_lista(destinos$name[emp]))))
  }
  candidatos <- which(mat$tier[i, ] > 0L)
  if (length(candidatos)) {
    j <- candidatos[which.max(mat$tier[i, candidatos] + mat$score[i, candidatos] * 0.999)]
    otros <- empate_d[[j]]
    if (length(otros) > 1L && i %in% otros) {
      return(fila("ambigua", causa = sprintf("El texto de la pregunta \"%s\" coincide igual con %d encabezados",
                                             destinos$name[j], length(otros))))
    }
    k <- asignado_d[j]
    if (!is.na(k)) {
      return(fila("sin_pareja", causa = sprintf("La pregunta más parecida, \"%s\", quedó con el encabezado %s",
                                                destinos$name[j], .cet_cita(encabezados[k]))))
    }
    return(fila("sin_pareja", causa = sprintf("La pregunta más parecida, \"%s\", ya viene con su nombre o con sus opciones",
                                              destinos$name[j])))
  }
  fila("sin_pareja", causa = "Ninguna pregunta del formulario tiene un texto parecido")
}
