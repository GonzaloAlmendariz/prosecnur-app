# Importador de la Matriz PULSO modelo IAC-CINDA → XLSForm.
#
# Una "Matriz PULSO" es un .xlsx con una hoja `Matriz Pulso` (o
# `Matriz de preguntas`) organizada como: Criterio | Subcriterio | <audiencias...>,
# donde cada audiencia (Docentes / Estudiantes / Administrativos) trae la
# afirmación redactada para responder en escala Likert. Las celdas de
# criterio/subcriterio suelen venir combinadas (NA hacia abajo).
#
# La conversión (validada por prototipo, ver docs del PR) produce un workbook
# XLSForm por audiencia: secciones por criterio (begin_group/end_group) y
# corridas de matriz por (subcriterio + escala) compartiendo prefijo de `name`
# para que el motor PDF y el editor las agrupen. El detalle vive en el spec del
# convertidor; aquí implementamos la lógica de dominio pura y testeable.

# Audiencias reconocidas → etiqueta canónica (para display y settings).
.matriz_pulso_audiencias_canon <- function() {
  c(
    docentes = "Docentes",
    estudiantes = "Estudiantes",
    administrativos = "Administrativos"
  )
}

# Normaliza un texto para comparaciones robustas a mayúsculas/acentos/espacios.
# Se usa para casar nombres de hoja, encabezados y audiencias.
.matriz_pulso_norm <- function(x) {
  v <- as.character(x %||% "")
  v <- trimws(v)
  v <- tolower(v)
  # Quitar tildes/diéresis frecuentes en español sin depender de iconv (que en
  # locale C podría fallar). Reemplazo directo por su letra base.
  v <- chartr("áàäâéèëêíìïîóòöôúùüûñç", "aaaaeeeeiiiioooouuuunc", v)
  v <- gsub("[[:space:]]+", " ", v)
  v
}

# Forward-fill de una columna de texto: arrastra el último valor no vacío hacia
# abajo (celdas combinadas dejan NA). Devuelve un vector chr (NA donde nunca
# hubo valor previo).
.matriz_pulso_ffill <- function(x) {
  x <- trimws(as.character(x))
  x[is.na(x) | !nzchar(x)] <- NA_character_
  last <- NA_character_
  out <- x
  for (i in seq_along(x)) {
    if (!is.na(x[i])) last <- x[i]
    out[i] <- last
  }
  out
}

# Infiere la escala de una afirmación por su texto. Heurística documentada:
# "satisfec…" → escala de satisfacción; el resto → escala de acuerdo.
.matriz_pulso_infer_escala <- function(afirmacion) {
  ifelse(
    grepl("satisfec", afirmacion, ignore.case = TRUE),
    "esc_satisf",
    "esc_acuerdo"
  )
}

# Lee la hoja de matriz cruda (col_types texto). Devuelve NULL si no se puede
# leer; el llamador decide el error de API.
.matriz_pulso_read_sheet <- function(path, sheet) {
  tryCatch(
    readxl::read_excel(
      path,
      sheet = sheet,
      col_types = "text",
      .name_repair = "minimal"
    ),
    error = function(e) NULL
  )
}

# Localiza la hoja de matriz en el archivo, prefiriendo `Matriz Pulso`. Devuelve
# el nombre real de la hoja o NA.
.matriz_pulso_find_sheet <- function(sheets) {
  norm_sheets <- .matriz_pulso_norm(sheets)
  for (target in c("matriz pulso", "matriz de preguntas")) {
    idx <- which(norm_sheets == target)
    if (length(idx)) return(sheets[idx[1]])
  }
  NA_character_
}

# Extrae las audiencias presentes (con ≥1 celda no vacía) de un data.frame de
# matriz ya leído. Devuelve las etiquetas canónicas en el orden del archivo.
.matriz_pulso_audiencias_presentes <- function(df) {
  cols <- as.character(names(df))
  canon <- .matriz_pulso_audiencias_canon()
  present <- character(0)
  for (j in seq_along(cols)) {
    key <- .matriz_pulso_norm(cols[j])
    if (key %in% names(canon)) {
      vals <- trimws(as.character(df[[j]]))
      if (any(!is.na(vals) & nzchar(vals))) {
        present <- c(present, unname(canon[[key]]))
      }
    }
  }
  unique(present)
}

#' Detecta si un .xlsx es una Matriz PULSO modelo IAC-CINDA.
#'
#' @return list(is_matriz, sheet, audiences)
matriz_pulso_detect <- function(path) {
  empty <- list(is_matriz = FALSE, sheet = NA_character_, audiences = character(0))
  sheets <- tryCatch(readxl::excel_sheets(path), error = function(e) character(0))
  if (!length(sheets)) return(empty)

  sheet <- .matriz_pulso_find_sheet(sheets)
  if (is.na(sheet)) return(empty)

  df <- .matriz_pulso_read_sheet(path, sheet)
  if (is.null(df) || ncol(df) < 3L) return(empty)

  cols <- as.character(names(df))
  if (!(identical(.matriz_pulso_norm(cols[1]), "criterio") &&
        identical(.matriz_pulso_norm(cols[2]), "subcriterio"))) {
    return(empty)
  }

  audiences <- .matriz_pulso_audiencias_presentes(df)
  if (!length(audiences)) return(empty)

  list(is_matriz = TRUE, sheet = sheet, audiences = audiences)
}

# Resuelve el nombre real de la columna del data.frame que corresponde a la
# audiencia canónica pedida (case/acento-insensible). NA si no está.
.matriz_pulso_audiencia_col <- function(df, audience_canon) {
  cols <- as.character(names(df))
  target <- .matriz_pulso_norm(audience_canon)
  idx <- which(.matriz_pulso_norm(cols) == target)
  if (!length(idx)) return(NA_character_)
  cols[idx[1]]
}

# Construye la hoja `survey` a partir de los vectores paralelos criterio /
# subcriterio (ya forward-filled) y afirmacion (ya filtrados a no vacíos).
# Devuelve list(survey=df, escala=chr, n_secciones, n_questions).
.matriz_pulso_build_survey <- function(criterio, subcriterio, afirmacion) {
  n <- length(afirmacion)
  escala <- .matriz_pulso_infer_escala(afirmacion)

  types <- character(0)
  names_v <- character(0)
  labels <- character(0)
  add <- function(type, name, label) {
    types[[length(types) + 1L]] <<- type
    names_v[[length(names_v) + 1L]] <<- name
    labels[[length(labels) + 1L]] <<- label
  }

  sec_i <- 0L
  grp <- 0L
  qn <- 0L
  prev_crit <- NULL
  prev_sub <- NULL
  prev_scale <- NULL
  open <- FALSE

  for (i in seq_len(n)) {
    crit <- criterio[i] %||% ""
    if (is.null(prev_crit) || !identical(crit, prev_crit)) {
      if (open) add("end_group", "", "")
      sec_i <- sec_i + 1L
      add("begin_group", sprintf("sec%d", sec_i), crit)
      open <- TRUE
      prev_crit <- crit
      # Nueva sección corta cualquier corrida en curso.
      prev_sub <- NULL
      prev_scale <- NULL
    }
    # Corrida de matriz = mismo subcriterio Y misma escala consecutivos.
    if (is.null(prev_sub) ||
        !identical(subcriterio[i] %||% "", prev_sub) ||
        !identical(escala[i], prev_scale)) {
      grp <- grp + 1L
      prev_sub <- subcriterio[i] %||% ""
      prev_scale <- escala[i]
    }
    qn <- qn + 1L
    add(sprintf("select_one %s", escala[i]), sprintf("g%d_%d", grp, qn), afirmacion[i])
  }
  if (open) add("end_group", "", "")

  survey <- data.frame(
    type = as.character(types),
    name = as.character(names_v),
    label = as.character(labels),
    required = "",
    relevant = "",
    constraint = "",
    calculation = "",
    choice_filter = "",
    appearance = "",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  list(
    survey = survey,
    escala = escala,
    n_secciones = sec_i,
    n_questions = n
  )
}

# Cataloga las corridas de matriz (subcriterio+escala contiguos) para estimar
# cuántas se agruparán como matriz (≥2 preguntas). Devuelve el conteo.
.matriz_pulso_n_matrices <- function(criterio, subcriterio, escala) {
  n <- length(escala)
  if (!n) return(0L)
  run_len <- 0L
  matrices <- 0L
  prev_crit <- NULL
  prev_sub <- NULL
  prev_scale <- NULL
  flush <- function() if (run_len >= 2L) matrices <<- matrices + 1L
  for (i in seq_len(n)) {
    same <- !is.null(prev_sub) &&
      identical(criterio[i] %||% "", prev_crit) &&
      identical(subcriterio[i] %||% "", prev_sub) &&
      identical(escala[i], prev_scale)
    if (same) {
      run_len <- run_len + 1L
    } else {
      flush()
      run_len <- 1L
      prev_crit <- criterio[i] %||% ""
      prev_sub <- subcriterio[i] %||% ""
      prev_scale <- escala[i]
    }
  }
  flush()
  matrices
}

# Catálogos de opciones (dos escalas Likert de 4 puntos + valor SIN INF = 9).
.matriz_pulso_choices <- function() {
  data.frame(
    list_name = c(
      rep("esc_acuerdo", 5),
      rep("esc_satisf", 5)
    ),
    name = c(
      "1", "2", "3", "4", "9",
      "1", "2", "3", "4", "9"
    ),
    label = c(
      "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
      "Nada satisfecho", "Poco satisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

# Hoja settings con el título por audiencia.
.matriz_pulso_settings <- function(audience_canon) {
  data.frame(
    form_title = sprintf("Cuestionario %s — Acreditación IAC-CINDA", audience_canon),
    form_id = sprintf("matriz_iac_cinda_%s", .matriz_pulso_norm(audience_canon)),
    version = format(Sys.Date(), "%Y%m%d"),
    default_language = "es",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

#' Convierte una Matriz PULSO a un workbook XLSForm para una audiencia.
#'
#' @return list(survey, choices, settings, summary, warnings)
matriz_pulso_to_workbook <- function(path, audience) {
  det <- matriz_pulso_detect(path)
  if (!isTRUE(det$is_matriz)) {
    stop_api(
      400, "E_MATRIZ_NOT_DETECTED",
      "El archivo no tiene el formato de Matriz PULSO IAC-CINDA (hoja `Matriz Pulso` con columnas Criterio/Subcriterio y audiencias)."
    )
  }

  audience_in <- trimws(as.character(audience %||% "")[1])
  match_idx <- which(.matriz_pulso_norm(det$audiences) == .matriz_pulso_norm(audience_in))
  if (!nzchar(audience_in) || !length(match_idx)) {
    stop_api(
      400, "E_MATRIZ_AUDIENCE",
      sprintf(
        "La audiencia '%s' no existe en la matriz. Disponibles: %s.",
        audience_in, paste(det$audiences, collapse = ", ")
      )
    )
  }
  audience_canon <- det$audiences[match_idx[1]]

  df <- .matriz_pulso_read_sheet(path, det$sheet)
  if (is.null(df) || !ncol(df)) {
    stop_api(400, "E_MATRIZ_READ_FAILED", "No pude leer la hoja de la Matriz PULSO. ¿El archivo está corrupto o protegido?")
  }

  criterio_ff <- .matriz_pulso_ffill(df[[1]])
  subcriterio_ff <- .matriz_pulso_ffill(df[[2]])
  aud_col <- .matriz_pulso_audiencia_col(df, audience_canon)
  if (is.na(aud_col)) {
    stop_api(400, "E_MATRIZ_AUDIENCE", sprintf("La columna de audiencia '%s' no está en la hoja.", audience_canon))
  }
  afirm <- trimws(as.character(df[[aud_col]]))

  keep <- !is.na(afirm) & nzchar(afirm)
  criterio <- criterio_ff[keep]
  subcriterio <- subcriterio_ff[keep]
  afirmacion <- afirm[keep]

  if (!length(afirmacion)) {
    stop_api(
      400, "E_MATRIZ_EMPTY_AUDIENCE",
      sprintf("La audiencia '%s' no tiene afirmaciones con texto en la matriz.", audience_canon)
    )
  }

  # Criterio/subcriterio sin valor (matriz mal armada arriba): usamos rótulo
  # provisional para no romper el survey, y lo señalamos como warning.
  sin_criterio <- sum(is.na(criterio) | !nzchar(criterio))
  criterio[is.na(criterio) | !nzchar(criterio)] <- "Sin criterio"
  subcriterio[is.na(subcriterio) | !nzchar(subcriterio)] <- "Sin subcriterio"

  built <- .matriz_pulso_build_survey(criterio, subcriterio, afirmacion)
  escala <- built$escala
  n_acuerdo <- sum(escala == "esc_acuerdo")
  n_satisf <- sum(escala == "esc_satisf")
  n_matrices <- .matriz_pulso_n_matrices(criterio, subcriterio, escala)

  warnings <- character(0)
  warnings <- c(warnings, sprintf(
    "Escala inferida por texto (heurística revisable): %d afirmaciones de acuerdo, %d de satisfacción.",
    n_acuerdo, n_satisf
  ))
  if (sin_criterio > 0L) {
    warnings <- c(warnings, sprintf(
      "%d afirmación(es) no tenían criterio/subcriterio arriba; se rotularon como 'Sin criterio'. Revisa las celdas combinadas de la matriz.",
      sin_criterio
    ))
  }

  list(
    survey = built$survey,
    choices = .matriz_pulso_choices(),
    settings = .matriz_pulso_settings(audience_canon),
    summary = list(
      audience = audience_canon,
      n_questions = as.integer(built$n_questions),
      n_matrices_estimadas = as.integer(n_matrices),
      n_acuerdo = as.integer(n_acuerdo),
      n_satisf = as.integer(n_satisf),
      n_secciones = as.integer(built$n_secciones)
    ),
    warnings = warnings
  )
}
