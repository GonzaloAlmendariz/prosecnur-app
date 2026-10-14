# =============================================================================
# Fuentes de respuestas para un formulario publicado (ADR 0102, decisión 2)
# =============================================================================
#
# Tres fuentes llevan sus respuestas a las variables y a los códigos de UNA
# revisión publicada. Cada preparador devuelve la misma forma:
#
#   list(data, fuentes, emparejadas, sin_par_fuente, recodificaciones,
#        opciones_sin_par, extra_meta)
#
# - `data`: respuestas ya en los nombres y códigos del instrumento, ANTES de
#   completar las variables sin par (eso lo hace el engine).
# - `emparejadas`: variables del instrumento que recibieron una columna.
# - `sin_par_fuente`: data.frame(variable, etiqueta, fuente) de lo que no entra.
# - `recodificaciones`: list(variable, etiqueta, desde, hacia) cuando el código
#   de la fuente y el del instrumento difieren para la MISMA etiqueta.
# - `opciones_sin_par`: entero nombrado variable -> respuestas cuya etiqueta no
#   existe en la lista del instrumento (quedan vacías).
#
# Capas (integraciones-datos), sin mezclar:
# - transporte: `sm_api_fetch_survey_details`, `.carga_platform_fetch_sm_bulk`
#   (envueltos en `.cfp_sm_transporte`, que traduce fallas a E_SM_API_FAILED);
# - traducción del proveedor: `sm_api_xlsform` vía `.sm_mb_inst_generado`, el
#   remapeo q→p del traductor (`.sm_q_to_p`) y la codificación por etiqueta de
#   `.sm_mb_codificar_fuente` (ADR 0099);
# - normalización: `normalize_data_for_xlsform` contra el XLSForm de la revisión.
#
# Regla de valores (dominio): se recodifica POR ETIQUETA, nunca por posición. Un
# `.sav` exportado de SurveyMonkey trae «SIN INF» = 5 porque es la quinta opción;
# el instrumento publicado la tiene en 99. El 5 se lee como «SIN INF» y se
# escribe 99. Una etiqueta que no existe en la lista del instrumento queda vacía
# y se cuenta; jamás conserva el código de la fuente (ese código, en la lista
# del instrumento, puede ser OTRA opción).
# =============================================================================

.CFP_ESTRUCTURALES <- c("begin_group", "end_group", "begin_repeat", "end_repeat", "note")

.cfp_chr <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  out <- as.character(x[[1]])
  if (is.na(out)) return(default)
  out <- trimws(out)
  if (nzchar(out)) out else default
}

# Variables de pregunta del instrumento: las que la base debe traer, sin el
# «Otro (especifique)» de una pregunta que existe (viaja con su madre y no
# cuenta como variable propia, igual que en la alineación de ADR 0099 y en la
# tarjeta del formulario).
.cfp_variables <- function(inst) {
  nombres <- .dn_expected_data_names(inst)
  es_other <- grepl("_other$", nombres) & sub("_other$", "", nombres) %in% nombres
  nombres[!es_other]
}

.cfp_etiquetas <- function(inst, variables) {
  sv <- (inst %||% list())$survey
  if (is.null(sv) || !nrow(sv) || !"name" %in% names(sv)) return(rep("", length(variables)))
  etiquetas <- if ("label" %in% names(sv)) as.character(sv$label) else rep("", nrow(sv))
  out <- etiquetas[match(variables, as.character(sv$name))]
  out[is.na(out)] <- ""
  out
}

.cfp_tipo <- function(inst, variable) {
  row <- .sm_mb_survey_row(inst, variable)
  if (is.null(row)) return("")
  .sm_mb_type_base(row$type)
}

.cfp_tabla_variables <- function(inst, variables) {
  variables <- as.character(variables %||% character(0))
  data.frame(variable = variables, etiqueta = .cfp_etiquetas(inst, variables), stringsAsFactors = FALSE)
}

.cfp_filas <- function(df) {
  if (is.null(df) || !NROW(df)) return(list())
  lapply(seq_len(NROW(df)), function(i) {
    fila <- list(variable = as.character(df$variable[i]), etiqueta = as.character(df$etiqueta[i]))
    if ("fuente" %in% names(df)) fila$fuente <- as.character(df$fuente[i])
    fila
  })
}

.cfp_sumar <- function(x, var, n) {
  if (!length(n) || is.na(n) || n <= 0L) return(x)
  x[[var]] <- as.integer((if (var %in% names(x)) x[[var]] else 0L) + n)
  x
}

# Columnas de metadatos de una encuesta: no son variables del instrumento ni se
# declaran sin par. Misma lista que usa el bundle SAV y los identificadores que
# reconocen Codificación y la base de partida declarada.
.cfp_columnas_meta <- function(nombres) {
  nombres <- as.character(nombres)
  if (!length(nombres)) return(character(0))
  meta <- .sm_sav_metadata_columns(stats::setNames(as.list(nombres), nombres))
  ids <- nombres[tolower(nombres) %in% tolower(.codif_key_candidates)]
  unique(c(meta, ids))
}

# --- Nombres de la fuente -> variables del instrumento -----------------------

# Resuelve el nombre de UNA columna de la fuente. Orden:
#   1. remapeo q→p del traductor SurveyMonkey (sólo si la revisión viene de SM);
#   2. el mismo nombre (exacto o sin distinguir mayúsculas);
#   3. matriz de una sola fila exportada como `pN_1` cuando el instrumento tiene `pN`;
#   4. dummy de una múltiple (`pN_k` con `pN` select_multiple): la pliega
#      `normalize_data_for_xlsform` por la etiqueta de su opción;
#   5. la etiqueta de la variable (o el encabezado de un Excel), si calza con
#      UNA sola variable del instrumento.
# Devuelve list(destino, via) o NULL.
.cfp_resolver_nombre <- function(col, etiqueta, inst, nombres_inst, etiquetas_inst, desde_sm) {
  candidatos <- character(0)
  if (isTRUE(desde_sm)) {
    p <- .sm_q_to_p(col)
    if (!is.na(p)) candidatos <- c(candidatos, p)
  }
  candidatos <- unique(c(candidatos, col))
  for (cand in candidatos) {
    if (cand %in% nombres_inst) return(list(destino = cand, via = if (identical(cand, col)) "nombre" else "q_a_p"))
    hit <- nombres_inst[tolower(nombres_inst) == tolower(cand)]
    if (length(hit) == 1L) return(list(destino = hit[[1]], via = "nombre"))
    m <- regmatches(cand, regexec("^(.+)_([0-9]+)$", cand))[[1]]
    if (length(m) == 3L && m[2] %in% nombres_inst) {
      tipo_madre <- .cfp_tipo(inst, m[2])
      if (identical(tipo_madre, "select_multiple")) return(list(destino = cand, via = "dummy_multiple", madre = m[2]))
      if (identical(m[3], "1")) return(list(destino = m[2], via = "matriz_una_fila"))
    }
  }
  etiqueta_norm <- .dn_norm_text(etiqueta)
  if (nzchar(etiqueta_norm)) {
    hit <- nombres_inst[.dn_norm_text(etiquetas_inst) == etiqueta_norm]
    if (length(hit) == 1L) return(list(destino = hit[[1]], via = "etiqueta"))
  }
  NULL
}

# Renombra la data de la fuente. Las columnas que no resuelven y no son
# metadatos no entran y se listan.
.cfp_renombrar <- function(df, etiquetas_fuente, inst, desde_sm, fuente_titulo) {
  sv <- inst$survey
  nombres_inst <- as.character(sv$name[!is.na(sv$name) & nzchar(sv$name) &
                                         !.sm_mb_type_base(sv$type) %in% .CFP_ESTRUCTURALES])
  etiquetas_inst <- .cfp_etiquetas(inst, nombres_inst)
  meta <- .cfp_columnas_meta(names(df))
  destinos <- stats::setNames(rep(NA_character_, ncol(df)), names(df))
  sin_par <- character(0)
  dummies <- character(0)
  for (col in names(df)) {
    if (col %in% meta) {
      destinos[[col]] <- col
      next
    }
    r <- .cfp_resolver_nombre(col, etiquetas_fuente[[col]] %||% "", inst, nombres_inst, etiquetas_inst, desde_sm)
    if (is.null(r) || r$destino %in% destinos) {
      sin_par <- c(sin_par, col)
      next
    }
    destinos[[col]] <- r$destino
    if (identical(r$via, "dummy_multiple")) dummies <- c(dummies, r$destino)
  }
  keep <- !is.na(destinos)
  out <- df[, keep, drop = FALSE]
  names(out) <- unname(destinos[keep])
  list(
    data = out,
    dummies = dummies,
    meta = meta,
    sin_par_fuente = data.frame(
      variable = sin_par,
      etiqueta = vapply(sin_par, function(x) .cfp_chr(etiquetas_fuente[[x]]), character(1), USE.NAMES = FALSE),
      fuente = rep(fuente_titulo, length(sin_par)),
      stringsAsFactors = FALSE
    )
  )
}

# --- Valores por etiqueta ------------------------------------------------------

# Código del instrumento para cada etiqueta de la fuente (NA si no hay par).
.cfp_codigo_por_etiqueta <- function(etiquetas, cb) {
  lab_b <- .dn_norm_text(cb$label)
  codigo_b <- as.character(cb$name)
  keep <- !duplicated(lab_b) & nzchar(lab_b)
  unname(stats::setNames(codigo_b[keep], lab_b[keep])[.dn_norm_text(etiquetas)])
}

# Recodifica una select_one de un `.sav` por sus etiquetas de valor. Sin
# etiquetas de valor no hay a qué leer: el valor se conserva sólo si ya es un
# código de la lista (no hubo traducción posible) y si no, queda vacío y se cuenta.
.cfp_recodificar_select_one_sav <- function(x, variable, cb) {
  labs <- attr(x, "labels", exact = TRUE)
  valores <- as.character(haven::zap_labels(x))
  valores <- trimws(valores)
  valores[!is.na(valores) & !nzchar(valores)] <- NA_character_
  recod <- list()
  if (length(labs)) {
    etiquetas <- names(labs)
    codigos_fuente <- as.character(unname(labs))
    destino <- .cfp_codigo_por_etiqueta(etiquetas, cb)
    for (i in seq_along(codigos_fuente)) {
      if (is.na(destino[i]) || identical(codigos_fuente[i], destino[i])) next
      recod[[length(recod) + 1L]] <- list(variable = variable, etiqueta = etiquetas[i],
                                          desde = codigos_fuente[i], hacia = destino[i])
    }
    nuevo <- destino[match(valores, codigos_fuente)]
  } else {
    nuevo <- ifelse(valores %in% as.character(cb$name), valores, NA_character_)
  }
  perdidos <- !is.na(valores) & is.na(nuevo)
  # Qué etiquetas se pierden, no sólo cuántas: el analista decide si las agrega
  # al formulario y vuelve a publicar.
  rotulos <- if (length(labs)) names(labs)[match(valores[perdidos], as.character(unname(labs)))] else character(0)
  rotulos <- ifelse(is.na(rotulos), valores[perdidos], rotulos)
  list(values = nuevo, recodificaciones = recod, sin_par = as.integer(sum(perdidos)),
       etiquetas_sin_par = .cfp_contar_etiquetas(rotulos))
}

# Conteo por etiqueta, de la más a la menos frecuente.
.cfp_contar_etiquetas <- function(x) {
  x <- as.character(x)
  if (!length(x)) return(integer(0))
  t <- sort(table(x), decreasing = TRUE)
  stats::setNames(as.integer(t), names(t))
}

# Recodifica una select_one de un Excel: el valor ya es un código de la lista,
# o es la etiqueta de una opción (se escribe su código); lo demás queda vacío.
.cfp_recodificar_select_one_texto <- function(x, variable, cb) {
  valores <- trimws(as.character(x))
  valores[!is.na(valores) & !nzchar(valores)] <- NA_character_
  codigos <- as.character(cb$name)
  por_etiqueta <- .cfp_codigo_por_etiqueta(valores, cb)
  nuevo <- ifelse(valores %in% codigos, valores, por_etiqueta)
  usadas <- !is.na(valores) & !(valores %in% codigos) & !is.na(por_etiqueta)
  recod <- list()
  if (any(usadas)) {
    pares <- unique(data.frame(desde = valores[usadas], hacia = por_etiqueta[usadas], stringsAsFactors = FALSE))
    recod <- lapply(seq_len(nrow(pares)), function(i) list(
      variable = variable, etiqueta = pares$desde[i], desde = pares$desde[i], hacia = pares$hacia[i]
    ))
  }
  perdidos <- !is.na(valores) & is.na(nuevo)
  list(values = nuevo, recodificaciones = recod, sin_par = as.integer(sum(perdidos)),
       etiquetas_sin_par = .cfp_contar_etiquetas(valores[perdidos]))
}

# select_multiple en texto: cada token debe ser un código de la lista.
.cfp_filtrar_multiple <- function(x, cb) {
  valores <- trimws(as.character(x))
  codigos <- as.character(cb$name)
  sin_par <- 0L
  out <- vapply(valores, function(v) {
    if (is.na(v) || !nzchar(v)) return(NA_character_)
    tokens <- strsplit(v, "\\s+")[[1]]
    ok <- tokens %in% codigos
    if (any(!ok)) sin_par <<- sin_par + 1L
    if (any(ok)) paste(tokens[ok], collapse = " ") else NA_character_
  }, character(1), USE.NAMES = FALSE)
  list(values = out, sin_par = as.integer(sin_par))
}

# Recorre las columnas ya renombradas y deja cada select en códigos del
# instrumento. `modo` = "sav" (etiquetas de valor) o "texto" (Excel).
.cfp_recodificar_columnas <- function(df, inst, dummies, modo) {
  recod <- list()
  sin_par <- integer(0)
  etiquetas_sin_par <- list()
  for (variable in setdiff(names(df), dummies)) {
    tipo <- .cfp_tipo(inst, variable)
    x <- df[[variable]]
    if (tipo %in% c("select_one", "select_multiple")) {
      cb <- .sm_mb_choices_for_var(inst, variable)
      if (!nrow(cb)) {
        df[[variable]] <- as.character(haven::zap_labels(x))
        next
      }
      if (identical(tipo, "select_one")) {
        r <- if (identical(modo, "sav")) {
          .cfp_recodificar_select_one_sav(x, variable, cb)
        } else {
          .cfp_recodificar_select_one_texto(x, variable, cb)
        }
        recod <- c(recod, r$recodificaciones)
      } else {
        r <- .cfp_filtrar_multiple(haven::zap_labels(x), cb)
      }
      df[[variable]] <- r$values
      sin_par <- .cfp_sumar(sin_par, variable, r$sin_par)
      if (length(r$etiquetas_sin_par)) etiquetas_sin_par[[variable]] <- r$etiquetas_sin_par
    } else if (inherits(x, "haven_labelled")) {
      df[[variable]] <- as.vector(haven::zap_labels(x))
    }
    attr(df[[variable]], "label") <- NULL
  }
  list(data = df, recodificaciones = recod, opciones_sin_par = sin_par,
       opciones_sin_par_etiquetas = etiquetas_sin_par)
}

# Pliega las dummies de múltiples con el normalizador de siempre y devuelve qué
# madres recibieron datos.
.cfp_normalizar <- function(df, inst) {
  if (!nrow(df)) return(list(data = df, madres = character(0)))
  out <- normalize_data_for_xlsform(df, inst, choice_code_maps = list())
  info <- attr(out, "xlsform_normalized", exact = TRUE) %||% list()
  attr(out, "xlsform_normalized") <- NULL
  list(data = out, madres = names(info$select_multiple %||% list()))
}

# Prepara un archivo tabular (SAV o Excel) ya leído.
.cfp_preparar_tabla <- function(df, inst, desde_sm, titulo, tipo) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  etiquetas_fuente <- lapply(stats::setNames(names(df), names(df)), function(col) {
    lab <- attr(df[[col]], "label", exact = TRUE)
    if (identical(tipo, "excel")) col else .cfp_chr(lab)
  })
  ren <- .cfp_renombrar(df, etiquetas_fuente, inst, desde_sm, titulo)
  rec <- .cfp_recodificar_columnas(ren$data, inst, ren$dummies, if (identical(tipo, "sav")) "sav" else "texto")
  norm <- .cfp_normalizar(rec$data, inst)
  data <- norm$data
  sobrantes <- intersect(ren$dummies, names(data))  # dummies que el normalizador no pudo plegar
  if (length(sobrantes)) {
    data <- data[, setdiff(names(data), sobrantes), drop = FALSE]
    ren$sin_par_fuente <- rbind(ren$sin_par_fuente, data.frame(
      variable = sobrantes, etiqueta = "", fuente = titulo, stringsAsFactors = FALSE))
  }
  emparejadas <- intersect(.cfp_variables(inst), unique(c(names(rec$data), norm$madres)))
  list(
    data = data,
    fuentes = list(list(tipo = tipo, titulo = titulo, n_filas = as.integer(nrow(data)))),
    emparejadas = emparejadas,
    sin_par_fuente = ren$sin_par_fuente,
    recodificaciones = rec$recodificaciones,
    opciones_sin_par = rec$opciones_sin_par,
    opciones_sin_par_etiquetas = rec$opciones_sin_par_etiquetas,
    extra_meta = list()
  )
}

# --- Lectura de archivos subidos ----------------------------------------------

.cfp_archivo <- function(s, file_id, kinds) {
  fid <- .cfp_chr(file_id)
  meta <- (s$files %||% list())[[fid]]
  if (!nzchar(fid) || is.null(meta) || !file.exists(.cfp_chr(meta$path))) {
    stop_api(404, "E_FILE_NOT_FOUND", "No se encontró el archivo subido: vuelve a subirlo.")
  }
  if (!(.cfp_chr(meta$kind) %in% kinds)) {
    stop_api(400, "E_BAD_FILE", sprintf("El archivo subido no es del tipo esperado (%s).", paste(kinds, collapse = " o ")))
  }
  meta
}

.cfp_leer_sav <- function(meta) {
  if (!requireNamespace("haven", quietly = TRUE)) {
    stop_api(500, "E_NO_HAVEN", "haven no está disponible para leer .sav")
  }
  tryCatch(
    as.data.frame(haven::read_sav(meta$path), stringsAsFactors = FALSE),
    error = function(e) {
      message(sprintf("[formulario_publicado] .sav ilegible (%s): %s", .cfp_chr(meta$file_id), conditionMessage(e)))
      stop_api(400, "E_SAV_READ_FAILED", "No se pudo leer el .sav: verifica que sea un archivo SPSS válido.")
    }
  )
}

.cfp_leer_excel <- function(meta) {
  ext <- tolower(.cfp_chr(meta$ext, tools::file_ext(meta$path)))
  if (!(ext %in% c("xlsx", "xls", "csv"))) {
    stop_api(400, "E_BAD_FILE", "El Excel debe ser .xlsx, .xls o .csv.")
  }
  df <- tryCatch(
    .read_data_any_path(meta$path, ext),
    error = function(e) {
      if (inherits(e, "api_error")) stop(e)
      message(sprintf("[formulario_publicado] Excel ilegible (%s): %s", .cfp_chr(meta$file_id), conditionMessage(e)))
      stop_api(400, "E_BAD_FILE", "No se pudo leer el Excel como tabla.")
    }
  )
  as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
}

.cfp_preparar_sav <- function(s, revision, inst, file_id) {
  meta <- .cfp_archivo(s, file_id, c("sav", "data"))
  df <- .cfp_leer_sav(meta)
  desde_sm <- identical(.cfp_chr((revision$source %||% list())$kind), "surveymonkey")
  out <- .cfp_preparar_tabla(df, inst, desde_sm, .cfp_chr(meta$original_name, "archivo .sav"), "sav")
  out$extra_meta <- list(source_file_id = .cfp_chr(meta$file_id), source_file_name = .cfp_chr(meta$original_name),
                         source_title = .cfp_chr(meta$original_name))
  out
}

.cfp_preparar_excel <- function(s, revision, inst, file_id) {
  meta <- .cfp_archivo(s, file_id, c("data"))
  df <- .cfp_leer_excel(meta)
  desde_sm <- identical(.cfp_chr((revision$source %||% list())$kind), "surveymonkey")
  out <- .cfp_preparar_tabla(df, inst, desde_sm, .cfp_chr(meta$original_name, "archivo Excel"), "excel")
  out$extra_meta <- list(source_file_id = .cfp_chr(meta$file_id), source_file_name = .cfp_chr(meta$original_name),
                         source_title = .cfp_chr(meta$original_name))
  out
}

# --- SurveyMonkey por API -----------------------------------------------------

# Campañas complementarias declaradas en la revisión (ADR 0101).
.cfp_campanas <- function(source) {
  variantes <- (source %||% list())$variants %||% list()
  out <- list()
  for (v in variantes) {
    if (!is.list(v) || !identical(.cfp_chr(v$rol), "campana_complementaria")) next
    sid_v <- .cfp_chr(v$survey_id)
    if (!nzchar(sid_v)) next
    out[[length(out) + 1L]] <- list(survey_id = sid_v, titulo = .cfp_chr(v$survey_title, sid_v))
  }
  out
}

# Transporte: un api_error del proveedor (rate limit, permisos) se conserva tal
# cual; una falla cruda (timeout, 401, red) se traduce a E_SM_API_FAILED sin
# llevar la petición ni el token a la respuesta.
.cfp_sm_transporte <- function(expr, survey_id) {
  # Un solo handler: con `api_error =` y `error =` juntos, tryCatch anida el
  # segundo por fuera y el re-lanzamiento del primero caería en él.
  tryCatch(
    expr,
    error = function(e) {
      if (inherits(e, "api_error")) stop(e)
      message(sprintf("[formulario_publicado] SurveyMonkey falló para la encuesta %s: %s",
                      survey_id, gsub("(?i)bearer\\s+\\S+", "Bearer ***", conditionMessage(e), perl = TRUE)))
      stop_api(400, "E_SM_API_FAILED", sprintf(
        "SurveyMonkey no respondió para la encuesta %s: revisa la conexión y el token, y vuelve a intentar.", survey_id))
    }
  )
}

# Instrumento sobre el que se calcula la clave de la base: el XLSForm GENERADO
# de la encuesta principal (ADR 0099, `inst_clave_base`), restringido a las
# variables que existen en la revisión. Las listas conservan los códigos de la
# plataforma —la firma de escala compara el código literal— y los nombres son
# los de la revisión, que es donde `.sm_mb_alin_aplicar` busca la lista destino.
# Una variable que el editor quitó o renombró no tiene par y se declara.
.cfp_inst_clave <- function(inst_generado, inst_revision) {
  sv <- inst_generado$survey
  nombres <- as.character(sv$name)
  estructural <- .sm_mb_type_base(sv$type) %in% .CFP_ESTRUCTURALES | is.na(nombres) | !nzchar(nombres)
  inst_generado$survey <- sv[estructural | nombres %in% as.character(inst_revision$survey$name), , drop = FALSE]
  inst_generado
}

# Recodificaciones que la alineación aplica a una encuesta: por cada par
# variable de la fuente -> variable del instrumento, las opciones cuya etiqueta
# calza con otro código.
.cfp_sm_recodificaciones <- function(al, inst_fuente, inst) {
  out <- list()
  mapa <- al$mapa %||% character(0)
  for (f in names(mapa)) {
    b <- mapa[[f]]
    lookup <- .sm_mb_alin_lookup(inst_fuente, f, inst, b)
    if (is.null(lookup)) next
    cf <- .sm_mb_choices_for_var(inst_fuente, f)
    for (codigo in names(lookup)) {
      hacia <- unname(lookup[[codigo]])
      if (is.na(hacia) || identical(hacia, codigo)) next
      out[[length(out) + 1L]] <- list(
        variable = b, etiqueta = as.character(cf$label[match(codigo, as.character(cf$name))]),
        desde = codigo, hacia = hacia
      )
    }
  }
  out
}

.cfp_preparar_sm <- function(sid, revision, inst, incluir_campanas = FALSE, profile_id = NULL) {
  source <- revision$source %||% list()
  principal <- .cfp_chr(source$survey_id)
  if (!identical(.cfp_chr(source$kind), "surveymonkey") || !nzchar(principal)) {
    stop_api(400, "E_BAD_REQUEST",
             "Este formulario no viene de una encuesta SurveyMonkey: carga sus respuestas desde un .sav o un Excel.")
  }
  token <- .connections_token_require("surveymonkey", sid, profile_id = profile_id)
  encuestas <- list(list(survey_id = principal, titulo = .cfp_chr(source$survey_title, principal), rol = "principal"))
  if (isTRUE(incluir_campanas)) {
    for (campana in .cfp_campanas(source)) {
      encuestas[[length(encuestas) + 1L]] <- c(campana, list(rol = "campana_complementaria"))
    }
  }
  cache <- .sm_mb_cache_operacion()
  .carga_job_progress("fetch", message = "SurveyMonkey: leyendo la estructura de la encuesta principal...")
  details_principal <- .cfp_sm_transporte(sm_api_fetch_survey_details(principal, token), principal)
  inst_clave <- .cfp_inst_clave(.sm_mb_inst_generado(details_principal, cache = cache), inst)

  dfs <- list()
  filtros <- list()
  fuentes <- list()
  emparejadas <- character(0)
  sin_par_fuente <- data.frame(variable = character(0), etiqueta = character(0), fuente = character(0),
                               stringsAsFactors = FALSE)
  recod <- list()
  opciones <- integer(0)
  alin <- .sm_mb_alin_nuevo()
  for (k in seq_along(encuestas)) {
    e <- encuestas[[k]]
    .carga_job_progress("fetch", current = k, total = length(encuestas),
                        message = sprintf("SurveyMonkey: descargando %s...", e$titulo))
    details <- if (identical(e$survey_id, principal)) {
      details_principal
    } else {
      .cfp_sm_transporte(sm_api_fetch_survey_details(e$survey_id, token), e$survey_id)
    }
    titulo <- .cfp_chr(details$title, e$titulo)
    payload <- .cfp_sm_transporte(.carga_platform_fetch_sm_bulk(e$survey_id, token), e$survey_id)
    df <- .sm_mb_codificar_fuente(
      details_fuente = details,
      responses = payload$data %||% list(),
      inst_base = inst,
      survey_id = e$survey_id,
      inst_clave_base = inst_clave,
      cache = cache,
      source_title = titulo,
      source_channel = e$rol
    )
    al <- attr(df, "sm_alineacion", exact = TRUE) %||% list()
    consentimiento <- attr(df, "sm_consentimiento", exact = TRUE) %||% list()
    excluida <- !identical(e$rol, "principal") && isTRUE(al$instrumento_distinto)
    alin <- .sm_mb_alin_registrar(alin, df, e$survey_id, titulo, principal)
    fuentes[[length(fuentes) + 1L]] <- list(
      tipo = "surveymonkey", titulo = titulo, survey_id = e$survey_id, rol = e$rol,
      n_filas = if (excluida) 0L else as.integer(NROW(df)),
      excluida = excluida,
      cobertura = as.numeric(al$cobertura %||% NA_real_),
      n_excluidas_consentimiento = as.integer(consentimiento$n_excluidas %||% 0L)[1]
    )
    if (excluida) next
    mapa <- al$mapa %||% character(0)
    emparejadas <- union(emparejadas, unname(mapa))
    spf <- al$sin_par_fuente
    if (NROW(spf)) {
      sin_par_fuente <- rbind(sin_par_fuente, data.frame(
        variable = spf$variable, etiqueta = spf$etiqueta, fuente = rep(titulo, NROW(spf)), stringsAsFactors = FALSE))
    }
    recod <- c(recod, .cfp_sm_recodificaciones(al, .sm_mb_inst_generado(details, cache = cache), inst))
    for (v in names(attr(df, "sm_opciones_sin_par", exact = TRUE) %||% integer(0))) {
      opciones <- .cfp_sumar(opciones, v, attr(df, "sm_opciones_sin_par", exact = TRUE)[[v]])
    }
    if (NROW(df)) {
      dfs[[length(dfs) + 1L]] <- df
      filtros[[length(filtros) + 1L]] <- attr(df, "sm_response_filter", exact = TRUE) %||% list()
    }
  }
  .carga_job_progress("normalize", message = "Normalizando respuestas contra el formulario publicado...")
  data <- .sm_mb_bind_rows(dfs)
  if (nrow(data)) data <- normalize_data_for_xlsform(data, inst, choice_code_maps = list())
  attr(data, "xlsform_normalized") <- NULL
  incluidas <- Filter(function(f) !isTRUE(f$excluida), fuentes)
  base_meta_alin <- .sm_mb_alin_en_base(list(), alin)
  list(
    data = data,
    fuentes = fuentes,
    emparejadas = intersect(.cfp_variables(inst), emparejadas),
    sin_par_fuente = unique(sin_par_fuente),
    recodificaciones = recod,
    opciones_sin_par = opciones,
    extra_meta = list(
      source_kind = .CFP_SOURCE_KIND_SM,
      survey_id = principal,
      source_title = .cfp_chr(details_principal$title, principal),
      connection_profile_id = .cfp_chr(profile_id),
      sources = lapply(incluidas, function(f) list(
        survey_id = f$survey_id, titulo = f$titulo, canal = f$rol, rol = f$rol, n_filas = f$n_filas
      )),
      response_filter = if (length(filtros)) .sm_mb_response_filter_total(filtros) else list(),
      sm_alineacion_fuentes = base_meta_alin$sm_alineacion_fuentes,
      sm_opciones_sin_par_principal = base_meta_alin$sm_opciones_sin_par_principal
    )
  )
}
