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

# Infiere la escala de una afirmación por su texto (FALLBACK cuando la matriz no
# trae columnas Tipo/Respuesta). "satisfec…" → satisfacción; resto → acuerdo.
.matriz_pulso_infer_escala <- function(afirmacion) {
  ifelse(
    grepl("satisfec", afirmacion, ignore.case = TRUE),
    "esc_satisf",
    "esc_acuerdo"
  )
}

# Resuelve la escala de una fila usando las columnas EXPLÍCITAS Tipo/Respuesta de
# la matriz (formato -2 en adelante); si vienen vacías, cae al fallback por texto.
# Respuesta manda; Tipo es secundario. Vectorizado.
.matriz_pulso_escala_row <- function(tipo, respuesta, afirmacion) {
  n <- length(afirmacion)
  tp <- .matriz_pulso_norm(if (length(tipo)) tipo else rep("", n))
  rp <- .matriz_pulso_norm(if (length(respuesta)) respuesta else rep("", n))
  out <- character(n)
  for (i in seq_len(n)) {
    r <- rp[i]; t <- tp[i]
    if (grepl("si\\s*/\\s*no|si/no|\\bsi no\\b|dicotom", paste(r, t))) {
      out[i] <- "esc_sino"
    } else if (grepl("satisf", r)) {
      out[i] <- "esc_satisf"
    } else if (grepl("acuerdo", r)) {
      out[i] <- "esc_acuerdo"
    } else {
      out[i] <- .matriz_pulso_infer_escala(afirmacion[i])
    }
  }
  out
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

# Quita el indice de acreditacion de una etiqueta ("2.1.2 Gestion..." ->
# "Gestion..."). Las cabeceras de matriz del modelo 2026 se nombran por tema,
# no por codigo; la indexacion queda reservada a las secciones-banda.
.matriz_pulso_strip_index <- function(x) {
  sub("^\\s*[0-9]+(\\.[0-9]+)*[.)]?\\s+", "", as.character(x %||% ""))
}

# Construye la hoja `survey` a partir de los vectores paralelos criterio /
# subcriterio (ya forward-filled) y afirmacion (ya filtrados a no vacíos).
# Estructura fiel al modelo 2026: una unica seccion-banda "SECCION II: ENCUESTA"
# y cabeceras de matriz por criterio (sin indice). El preambulo aporta la otra
# seccion ("SECCION I: DATOS GENERALES").
# Devuelve list(survey=df, escala=chr, n_secciones, n_questions).
.matriz_pulso_build_survey <- function(criterio, subcriterio, afirmacion, escala = NULL) {
  n <- length(afirmacion)
  if (is.null(escala)) escala <- .matriz_pulso_infer_escala(afirmacion)

  types <- character(0)
  names_v <- character(0)
  labels <- character(0)
  subgroups_v <- character(0)
  relevants_v <- character(0)
  add <- function(type, name, label, subgroup = "", relevant = "") {
    types[[length(types) + 1L]] <<- type
    names_v[[length(names_v) + 1L]] <<- name
    labels[[length(labels) + 1L]] <<- label
    subgroups_v[[length(subgroups_v) + 1L]] <<- subgroup
    relevants_v[[length(relevants_v) + 1L]] <<- relevant
  }

  grp <- 0L
  qn <- 0L
  prev_crit <- NULL
  prev_scale <- NULL
  open <- FALSE

  for (i in seq_len(n)) {
    crit_raw <- criterio[i] %||% ""
    # Cabecera de matriz = criterio SIN indice (editable; el modelo 2026 nombra
    # las matrices por tema). Toda la encuesta cuelga de una sola seccion-banda.
    crit_lbl <- .matriz_pulso_strip_index(crit_raw)
    if (!open) {
      add("begin_group", "sec_encuesta", "SECCIÓN II: ENCUESTA")
      open <- TRUE
    }
    # Corrida de matriz = mismo criterio Y misma escala consecutivos.
    if (is.null(prev_crit) ||
        !identical(crit_raw, prev_crit) ||
        !identical(escala[i], prev_scale)) {
      grp <- grp + 1L
      prev_crit <- crit_raw
      prev_scale <- escala[i]
    }
    qn <- qn + 1L
    nm <- sprintf("g%d_%d", grp, qn)
    # La logica de filtro (relevant) NO se infiere aqui: se aplica despues, en
    # matriz_pulso_to_workbook, desde el mapa EXACTO extraido de los cuestionarios
    # modelo 2026 (.matriz_pulso_filter_map), fiel al instrumento.
    add(sprintf("select_one %s", escala[i]), nm, afirmacion[i], subgroup = crit_lbl, relevant = "")
  }
  if (open) add("end_group", "", "")

  survey <- data.frame(
    type = as.character(types),
    name = as.character(names_v),
    label = as.character(labels),
    paper_subgroup = as.character(subgroups_v),
    paper_subletter = "",
    required = "",
    relevant = as.character(relevants_v),
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
    # La encuesta es una unica seccion-banda; el preambulo aporta "DATOS GENERALES".
    n_secciones = if (n > 0L) 1L else 0L,
    n_questions = n
  )
}

# Cataloga las corridas de matriz (criterio+escala contiguos) para estimar
# cuántas se agruparán como matriz (≥2 preguntas). Devuelve el conteo.
# `subcriterio` se mantiene en la firma por compatibilidad, pero ya no agrupa
# (la cabecera de matriz es el criterio, no el subcriterio).
.matriz_pulso_n_matrices <- function(criterio, subcriterio, escala) {
  n <- length(escala)
  if (!n) return(0L)
  run_len <- 0L
  matrices <- 0L
  prev_crit <- NULL
  prev_scale <- NULL
  flush <- function() if (run_len >= 2L) matrices <<- matrices + 1L
  for (i in seq_len(n)) {
    same <- !is.null(prev_crit) &&
      identical(criterio[i] %||% "", prev_crit) &&
      identical(escala[i], prev_scale)
    if (same) {
      run_len <- run_len + 1L
    } else {
      flush()
      run_len <- 1L
      prev_crit <- criterio[i] %||% ""
      prev_scale <- escala[i]
    }
  }
  flush()
  matrices
}

# Catálogos de opciones. Escalas Likert de 4 puntos + SIN INF = 9, y la
# dicotómica Sí/No. Devuelve SOLO las listas efectivamente usadas (`used`).
.matriz_pulso_choices <- function(used = c("esc_acuerdo", "esc_satisf", "esc_sino")) {
  catalog <- list(
    esc_acuerdo = data.frame(
      list_name = "esc_acuerdo", name = c("1", "2", "3", "4", "9"),
      label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"),
      stringsAsFactors = FALSE, check.names = FALSE),
    esc_satisf = data.frame(
      list_name = "esc_satisf", name = c("1", "2", "3", "4", "9"),
      label = c("Nada satisfecho", "Poco satisfecho", "Satisfecho", "Muy satisfecho", "SIN INF"),
      stringsAsFactors = FALSE, check.names = FALSE),
    esc_sino = data.frame(
      list_name = "esc_sino", name = c("1", "2"),
      label = c("Sí", "No"),
      stringsAsFactors = FALSE, check.names = FALSE)
  )
  used <- intersect(c("esc_acuerdo", "esc_satisf", "esc_sino"), unique(used))
  if (!length(used)) used <- "esc_acuerdo"
  do.call(rbind, catalog[used])
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
# Mapa de filtros EXACTO extraido de los cuestionarios modelo 2026 (docx). Cada
# par c(N, T) = "la pregunta N filtra: si su respuesta negativa, pasa a la
# pregunta T" (se saltan N+1..T-1). La numeracion del modelo alinea 1:1 con el
# orden de preguntas que produce este converter. Audiencia no mapeada -> sin
# filtros (list()), y el instrumento queda sin logica hasta encodearla.
.matriz_pulso_filter_map <- function(audience) {
  key <- .matriz_pulso_norm(audience %||% "")
  maps <- list(
    docentes        = list(c(1, 3), c(3, 5), c(35, 37), c(55, 57), c(60, 68)),
    estudiantes     = list(c(1, 3), c(3, 5), c(37, 40), c(40, 50)),
    administrativos = list(c(1, 3), c(3, 5))
  )
  maps[[key]] %||% list()
}

# Aplica el mapa de filtros al survey: marca `relevant = ${filtro} = '1'` a las
# preguntas dependientes (N+1..T-1) de cada filtro. Cuenta preguntas reales
# (filas select_*), salteando begin/end_group.
.matriz_pulso_apply_filters <- function(survey, filter_map) {
  if (!length(filter_map)) return(survey)
  q_rows <- which(grepl("^select_", survey$type))  # filas-pregunta, en orden
  if (!"relevant" %in% names(survey)) survey$relevant <- rep("", nrow(survey))
  for (fm in filter_map) {
    n <- as.integer(fm[1]); t <- as.integer(fm[2])
    if (is.na(n) || is.na(t) || n < 1L || n > length(q_rows) || t <= n + 1L) next
    filter_name <- survey$name[q_rows[n]]
    dep_q <- seq.int(n + 1L, min(t - 1L, length(q_rows)))
    survey$relevant[q_rows[dep_q]] <- sprintf("${%s} = '1'", filter_name)
  }
  survey
}

# Preambulo del cuestionario (extraido de los Cuestionarios modelo 2026):
# nota de INTRODUCCION (saludo + consentimiento) + pregunta de consentimiento +
# SECCION I: DATOS GENERALES (demograficos por audiencia). Sin numero (paper_number
# "-") para que la encuesta arranque en Q1 y el mapa de filtros siga valido.
# Devuelve list(survey, choices, consent_var). Audiencia no mapeada -> preambulo
# minimo (solo intro + consentimiento).
.matriz_pulso_preamble <- function(audience) {
  key <- .matriz_pulso_norm(audience %||% "")
  noun <- switch(key, docentes = "docente", estudiantes = "estudiante",
                 administrativos = "trabajador(a)", "participante")
  intro <- paste0(
    "Estimado(a) ", noun, ", la Formación General de la Facultad de Arte y Diseño de la Pontificia ",
    "Universidad Católica del Perú y el Instituto de Analítica Social e Inteligencia Estratégica - PULSO ",
    "PUCP vienen realizando un estudio de opinión en el marco del proceso de acreditación. El objetivo de ",
    "la encuesta es conocer su percepción acerca de la misión, los propósitos, las competencias de salida, ",
    "la malla curricular, las actividades de investigación y otros aspectos vinculados con la formación. Le ",
    "invitamos a participar en un cuestionario de aproximadamente XX minutos. Toda la información brindada ",
    "será usada solo para los fines del presente estudio, de carácter confidencial de acuerdo con la Ley N.° ",
    "29733, Ley de Protección de Datos Personales. Agradecemos su sinceridad. Si tiene alguna duda, ",
    "escríbanos a pulsopucp@pucp.edu.pe.")
  rows <- list()
  add_row <- function(type, name, label, number = "-") {
    rows[[length(rows) + 1L]] <<- list(type = type, name = name, label = label, number = number)
  }
  add_row("note", "intro", intro, number = "")
  add_row("select_one dg_sino", "consentimiento", "Hecha esta aclaración, ¿desea continuar con la encuesta?")
  add_row("begin_group", "sec_datos", "SECCIÓN I: DATOS GENERALES", number = "")
  if (identical(key, "docentes")) {
    add_row("select_one dg_grado", "dg_grado", "¿Cuál es su mayor grado académico alcanzado?")
    add_row("select_one dg_sino", "dg_exp", "¿Cuenta con experiencia en el medio profesional fuera del ámbito académico?")
    add_row("integer", "dg_anos_exp", "¿Cuántos años de experiencia tiene en el medio profesional?")
  } else if (identical(key, "estudiantes")) {
    add_row("integer", "dg_edad", "¿Cuántos años tiene en la actualidad?")
    add_row("text", "dg_codigo", "¿Cuál es su código PUCP?")
    add_row("text", "dg_ano_ciclo", "¿En qué año y ciclo ingresó a la Facultad de Arte y Diseño? (Por ejemplo: 2026-I)")
    add_row("text", "dg_ciclo", "¿Qué ciclo está cursando actualmente?")
  } else if (identical(key, "administrativos")) {
    add_row("integer", "dg_edad", "¿Cuántos años tiene en la actualidad?")
    add_row("text", "dg_ano_ingreso", "¿En qué año ingresó a trabajar en la Facultad o el Departamento?")
  }
  add_row("end_group", "sec_datos_end", "", number = "")

  survey <- data.frame(
    type = vapply(rows, `[[`, character(1), "type"),
    name = vapply(rows, `[[`, character(1), "name"),
    label = vapply(rows, `[[`, character(1), "label"),
    paper_subgroup = "",
    paper_subletter = "",
    paper_number = vapply(rows, `[[`, character(1), "number"),
    required = "", relevant = "", constraint = "", calculation = "",
    choice_filter = "", appearance = "",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(list_name = "dg_sino", name = c("1", "2"), label = c("Sí", "No"),
                        stringsAsFactors = FALSE)
  if (identical(key, "docentes")) {
    choices <- rbind(choices, data.frame(list_name = "dg_grado", name = as.character(1:5),
      label = c("Técnico especialista", "Bachiller", "Licenciado(a)", "Magíster", "Doctor(a)"),
      stringsAsFactors = FALSE))
  }
  list(survey = survey, choices = choices, consent_var = "consentimiento")
}

# Sub-preguntas (competencias) del modelo 2026. En la Matriz PULSO estas llegan
# como UNA fila con el enunciado + las competencias concatenadas en el texto
# (comas internas ambiguas: "Experimentacion, tecnica y produccion"), asi que el
# desglose fiel se hardcodea desde el docx modelo (igual que el mapa de saltos).
# Devuelve el vector de sub-preguntas si la fila es una madre; character(0) si no.
.matriz_pulso_subquestion_children <- function(label) {
  l <- tolower(.matriz_pulso_norm(label))
  if (grepl("competencias de salida", l) && grepl("comunicaci", l)) {
    return(c("Comunicación visual", "Creación",
             "Experimentación, técnica y producción", "Representación"))
  }
  if (grepl("gen[eé]ricas", l) && grepl("aprendizaje aut", l)) {
    return(c("Aprendizaje autónomo y adaptabilidad",
             "Ética, ciudadanía y conciencia ambiental",
             "Investigación, creación e innovación",
             "Pensamiento crítico y creativo",
             "Comunicación eficaz: oral, escrita y no verbal",
             "Habilidades colaborativas"))
  }
  character(0)
}

# Expande las filas madre (competencias) en: enunciado madre (paper_subletter
# "@", sin codigos al dibujar) + N sub-preguntas (paper_subletter a/b/c...,
# numeradas por letra, sin numero de encuesta). Se aplica DESPUES del mapa de
# filtros para no desalinear la numeracion, y conserva relevant/subgrupo.
.matriz_pulso_expand_subquestions <- function(survey) {
  if (!nrow(survey)) return(survey)
  if (!"paper_subletter" %in% names(survey)) survey$paper_subletter <- ""
  if (!"paper_number" %in% names(survey)) survey$paper_number <- ""
  pieces <- list()
  for (i in seq_len(nrow(survey))) {
    row <- survey[i, , drop = FALSE]
    kids <- if (grepl("^select_", row$type)) .matriz_pulso_subquestion_children(row$label) else character(0)
    if (!length(kids)) { pieces[[length(pieces) + 1L]] <- row; next }
    # Enunciado madre: texto hasta el primer ":" inclusive.
    parent <- row
    parent$label <- sub("\\s*:.*$", ":", row$label)
    parent$paper_subletter <- "@"
    pieces[[length(pieces) + 1L]] <- parent
    for (k in seq_along(kids)) {
      child <- row
      child$name <- sprintf("%s_%s", row$name, letters[k])
      child$label <- kids[k]
      child$paper_subletter <- letters[k]
      child$paper_number <- "-"   # sub-pregunta: sin numero de encuesta propio
      pieces[[length(pieces) + 1L]] <- child
    }
  }
  out <- do.call(rbind, pieces)
  rownames(out) <- NULL
  out
}

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

  # Columnas explícitas de escala (formato -2 en adelante): Tipo / Respuesta.
  # Si no existen, quedan vacías y la escala cae al fallback por texto.
  col_by_name <- function(name) {
    idx <- which(.matriz_pulso_norm(names(df)) == .matriz_pulso_norm(name))
    if (length(idx)) trimws(as.character(df[[idx[1]]])) else rep("", nrow(df))
  }
  tipo_all <- col_by_name("tipo")
  respuesta_all <- col_by_name("respuesta")
  has_explicit <- any(nzchar(respuesta_all) | nzchar(tipo_all))

  keep <- !is.na(afirm) & nzchar(afirm)
  criterio <- criterio_ff[keep]
  subcriterio <- subcriterio_ff[keep]
  afirmacion <- afirm[keep]
  tipo <- tipo_all[keep]
  respuesta <- respuesta_all[keep]

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

  # Escala por fila: explícita (Tipo/Respuesta) con fallback por texto.
  escala <- .matriz_pulso_escala_row(tipo, respuesta, afirmacion)

  built <- .matriz_pulso_build_survey(criterio, subcriterio, afirmacion, escala)
  # Logica de filtro EXACTA extraida de los cuestionarios modelo 2026 (docx):
  # cada filtro (pregunta N) salta a la pregunta T -> se marca `relevant` a las
  # dependientes N+1..T-1. Nuestra numeracion alinea 1:1 con el modelo.
  built$survey <- .matriz_pulso_apply_filters(built$survey, .matriz_pulso_filter_map(audience_canon))
  n_acuerdo <- sum(escala == "esc_acuerdo")
  n_satisf <- sum(escala == "esc_satisf")
  n_sino <- sum(escala == "esc_sino")
  n_matrices <- .matriz_pulso_n_matrices(criterio, subcriterio, escala)

  warnings <- character(0)
  warnings <- c(warnings, if (has_explicit) sprintf(
    "Escala tomada de las columnas Tipo/Respuesta: %d de acuerdo, %d de satisfacción, %d dicotómicas (Sí/No).",
    n_acuerdo, n_satisf, n_sino
  ) else sprintf(
    "Escala inferida por texto (heurística revisable; la matriz no trae columnas Tipo/Respuesta): %d de acuerdo, %d de satisfacción.",
    n_acuerdo, n_satisf
  ))
  if (sin_criterio > 0L) {
    warnings <- c(warnings, sprintf(
      "%d afirmación(es) no tenían criterio/subcriterio arriba; se rotularon como 'Sin criterio'. Revisa las celdas combinadas de la matriz.",
      sin_criterio
    ))
  }

  # Antepone el preambulo del modelo (intro + consentimiento + datos generales).
  # El encuesta va numerada auto (Q1..N); el preambulo sin numero ("-").
  pre <- .matriz_pulso_preamble(audience_canon)
  built$survey$paper_number <- ""
  # Desglosa las sub-preguntas (competencias) en madre + a/b/c... una vez que la
  # numeracion de encuesta ya esta congelada (post filtros).
  built$survey <- .matriz_pulso_expand_subquestions(built$survey)
  cols <- names(pre$survey)
  full_survey <- rbind(pre$survey[cols], built$survey[cols])
  full_choices <- rbind(pre$choices, .matriz_pulso_choices(used = unique(escala)))

  list(
    survey = full_survey,
    choices = full_choices,
    settings = .matriz_pulso_settings(audience_canon),
    consent_var = pre$consent_var,
    summary = list(
      audience = audience_canon,
      n_questions = as.integer(built$n_questions),
      n_matrices_estimadas = as.integer(n_matrices),
      n_acuerdo = as.integer(n_acuerdo),
      n_satisf = as.integer(n_satisf),
      n_sino = as.integer(n_sino),
      # Secciones-banda del cuestionario: DATOS GENERALES (preambulo) + ENCUESTA.
      n_secciones = as.integer(built$n_secciones + 1L)
    ),
    warnings = warnings
  )
}
