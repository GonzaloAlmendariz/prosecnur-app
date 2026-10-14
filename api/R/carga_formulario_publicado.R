# =============================================================================
# La base nace del formulario publicado (ADR 0102)
# =============================================================================
#
# Primero se elige el instrumento, después se traen los datos. La base se crea
# con el XLSForm de la revisión publicada (`revision$xlsform_file_id`) y queda
# ligada a ella desde el inicio con el estado `matched` del enlace
# (`.instrument_revision_binding_apply`): no hay hash que adivinar, lo eligió el
# analista. Así Validación y Analítica leen los contratos de la revisión.
#
# Tres fuentes de respuestas (ver carga_formulario_publicado_fuentes.R):
# SurveyMonkey por API (principal + campañas declaradas), `.sav` y Excel. Lo que
# no calza se declara; si menos del 80 % de las variables del instrumento tiene
# par (`.SM_MB_COBERTURA_MINIMA`), la base no es de ese formulario y se bloquea.
#
# Un formulario con la lógica declarada fuera (`logic_status =
# "external_declared"`) crea la base como base de partida declarada (ADR 0100):
# el bloque `origen_externo` de la base registra la herramienta y que la
# Validación y la Limpieza se hicieron fuera.
#
# Grano: una base nueva por importación (scope de escritura = esa base). No se
# toca ninguna base existente ni el instrumento single-base de la sesión.
# =============================================================================

.CFP_FUENTES <- c("surveymonkey", "sav", "excel")
.CFP_JOB_ACTION <- "formulario_publicado_sm"
.CFP_JOB_KIND <- "carga.formulario_publicado_sm"
# Valores propios y no los de las bases SM de siempre: el refresh multibase y
# «Agregar fuente» reconocen `surveymonkey*` y regenerarían el XLSForm desde la
# plataforma, rompiendo el enlace con la revisión.
.CFP_SOURCE_KIND_SM <- "formulario_publicado_surveymonkey"
.CFP_SOURCE_KIND <- c(sav = "formulario_publicado_sav", excel = "formulario_publicado_excel")

# --- Revisiones ---------------------------------------------------------------

.cfp_revision <- function(s, revision_id) {
  rid <- .cfp_chr(revision_id)
  revision <- if (nzchar(rid)) .instrument_validation_revision(s, rid) else NULL
  if (is.null(revision) || !nzchar(.cfp_chr(revision$published_at))) {
    stop_api(404, "E_REVISION_NOT_FOUND", "No existe esa revisión publicada en el proyecto.")
  }
  revision
}

.cfp_instrumento <- function(s, revision) {
  meta <- (s$files %||% list())[[.cfp_chr(revision$xlsform_file_id)]]
  path <- .cfp_chr((meta %||% list())$path)
  if (!nzchar(path) || !file.exists(path)) {
    stop_api(404, "E_REVISION_NOT_FOUND",
             "La revisión publicada perdió su XLSForm: vuelve a publicar el formulario.")
  }
  reporte_instrumento(path = path)
}

.cfp_logic_status <- function(revision) {
  .cfp_chr((revision$source %||% list())$logic_status,
           .cfp_chr((revision$logic_audit %||% list())$logic_status))
}

.cfp_logica_externa <- function(revision) {
  identical(.cfp_logic_status(revision), .XLSFORM_LOGICA_EXTERNA)
}

.cfp_form_nombre <- function(s, revision) {
  form <- (s$xlsform_forms %||% list())[[.cfp_chr(revision$form_id)]]
  .cfp_chr((form %||% list())$name,
           .cfp_chr((revision$source %||% list())$survey_title, .cfp_chr(revision$form_id, "formulario")))
}

.cfp_revision_orden <- function(revisiones) {
  no <- vapply(revisiones, function(r) {
    v <- suppressWarnings(as.integer(r$revision_no %||% 0L)[1])
    if (is.na(v)) 0L else v
  }, integer(1))
  pub <- vapply(revisiones, function(r) .cfp_chr(r$published_at), character(1))
  order(no, pub, decreasing = TRUE)
}

#' Última revisión publicada de cada formulario, lista para elegir en Carga.
#' @keywords internal
carga_formularios_publicados <- function(sid) {
  s <- session_get(sid)
  revisiones <- Filter(function(r) is.list(r) && nzchar(.cfp_chr(r$published_at)),
                       unname(s$instrument_revisions %||% list()))
  if (!length(revisiones)) return(list(ok = TRUE, formularios = list()))
  por_form <- split(revisiones, vapply(revisiones, function(r) .cfp_chr(r$form_id, .cfp_chr(r$revision_id)), character(1)))
  formularios <- lapply(por_form, function(grupo) {
    r <- grupo[[.cfp_revision_orden(grupo)[[1]]]]
    n_campos <- tryCatch(length(.cfp_variables(.cfp_instrumento(s, r))), error = function(e) NA_integer_)
    source <- r$source %||% list()
    externa <- source$logic_external
    list(
      form_id = .cfp_chr(r$form_id),
      form_name = .cfp_form_nombre(s, r),
      revision_id = .cfp_chr(r$revision_id),
      revision_no = as.integer(r$revision_no %||% NA_integer_)[1],
      published_at = .cfp_chr(r$published_at),
      survey_id = .cfp_chr(source$survey_id),
      campanas = .cfp_campanas(source),
      logic_status = .cfp_logic_status(r),
      # Booleano, como lo lee el cliente; la herramienta va aparte.
      logic_external = .cfp_logica_externa(r),
      logic_external_herramienta = if (.cfp_logica_externa(r)) .cfp_chr((externa %||% list())$herramienta, "otro programa") else "",
      n_campos = as.integer(n_campos)
    )
  })
  formularios <- unname(formularios)
  orden <- order(vapply(formularios, function(f) f$form_name, character(1)))
  list(ok = TRUE, formularios = formularios[orden])
}

# --- Preparación compartida por vista previa e importación --------------------

.cfp_fuente <- function(parsed) {
  fuente <- tolower(.cfp_chr(parsed$fuente))
  if (!(fuente %in% .CFP_FUENTES)) {
    stop_api(400, "E_BAD_REQUEST", "La fuente debe ser 'surveymonkey', 'sav' o 'excel'.")
  }
  fuente
}

.cfp_preparar <- function(sid, parsed) {
  s <- session_get(sid)
  revision <- .cfp_revision(s, parsed$revision_id)
  inst <- .cfp_instrumento(s, revision)
  fuente <- .cfp_fuente(parsed)
  prep <- switch(
    fuente,
    surveymonkey = .cfp_preparar_sm(
      sid, revision, inst,
      incluir_campanas = isTRUE(parsed$incluir_campanas),
      profile_id = parsed$connection_profile_id %||% parsed$profile_id %||% NULL
    ),
    sav = .cfp_preparar_sav(s, revision, inst, parsed$file_id),
    excel = .cfp_preparar_excel(s, revision, inst, parsed$file_id)
  )
  prep$fuente <- fuente
  prep$revision <- revision
  prep$inst <- inst
  prep$resumen <- .cfp_resumen(prep, inst, fuente)
  prep
}

.cfp_recodificaciones_unicas <- function(recod) {
  if (!length(recod)) return(list())
  clave <- vapply(recod, function(r) paste(r$variable, r$desde, r$hacia, sep = "\r"), character(1))
  unname(recod[!duplicated(clave)])
}

# Respuesta de la vista previa (contrato HTTP del ADR 0102).
.cfp_resumen <- function(prep, inst, fuente) {
  variables <- .cfp_variables(inst)
  emparejadas <- intersect(variables, prep$emparejadas)
  n_var <- length(variables)
  cobertura <- if (n_var) length(emparejadas) / n_var else 0
  n_filas <- as.integer(NROW(prep$data))
  bloqueo <- NULL
  if (cobertura < .SM_MB_COBERTURA_MINIMA) {
    bloqueo <- list(codigo = "E_FUENTE_NO_CALZA", mensaje = sprintf(
      "Sólo %d de %d variables del formulario (%s %%) tienen par en esta fuente: esa base no es de este formulario.",
      length(emparejadas), n_var, .sm_mb_cobertura_texto(cobertura)))
  } else if (!n_filas) {
    bloqueo <- if (identical(fuente, "surveymonkey")) {
      list(codigo = "E_SM_NO_RESPONSES", mensaje = "Las encuestas elegidas no tienen respuestas completas para importar.")
    } else {
      list(codigo = "E_BAD_FILE", mensaje = "El archivo no trae filas.")
    }
  }
  opciones <- prep$opciones_sin_par %||% integer(0)
  list(
    ok = TRUE,
    n_filas = n_filas,
    fuentes = prep$fuentes,
    n_emparejadas = length(emparejadas),
    n_variables_instrumento = n_var,
    cobertura = cobertura,
    cobertura_texto = .sm_mb_cobertura_texto(cobertura),
    sin_par_instrumento = .cfp_filas(.cfp_tabla_variables(inst, setdiff(variables, emparejadas))),
    sin_par_fuente = .cfp_filas(prep$sin_par_fuente),
    agregadas_fuente = .cfp_filas(prep$agregadas_fuente),
    recodificaciones = .cfp_recodificaciones_unicas(prep$recodificaciones),
    opciones_sin_par = lapply(names(opciones), function(v) {
      et <- (prep$opciones_sin_par_etiquetas %||% list())[[v]] %||% integer(0)
      list(variable = v, n = as.integer(opciones[[v]]),
           etiquetas = lapply(names(et), function(e) list(etiqueta = e, n = as.integer(et[[e]]))))
    }),
    bloqueo = bloqueo
  )
}

#' Vista previa: qué entra, qué no y con qué códigos, sin crear nada.
#' @keywords internal
carga_formulario_publicado_vista_previa <- function(sid, parsed) {
  .cfp_preparar(sid, parsed)$resumen
}

# --- Importación --------------------------------------------------------------

# Nombre por defecto: slug del formulario. Los acentos se transliteran antes
# (`iconv` en macOS deja «acreditaci_on» con «ASCII//TRANSLIT»).
.cfp_slug <- function(nombre) {
  if (requireNamespace("stringi", quietly = TRUE)) nombre <- stringi::stri_trans_general(nombre, "Latin-ASCII")
  .carga_slug(nombre, "formulario")
}

.cfp_base_nombre <- function(s, parsed, revision) {
  pedido <- .cfp_chr(parsed$base_name)
  nombre <- if (nzchar(pedido)) pedido else .cfp_slug(.cfp_form_nombre(s, revision))
  if (grepl("\\$|\\s", nombre)) {
    stop_api(400, "E_BASE_NOMBRE_INVALIDO", "El nombre de la base no puede contener '$' ni espacios.")
  }
  if (nombre %in% names((s$estudio %||% list())$bases %||% list())) {
    stop_api(409, "E_BASE_EXISTE", sprintf(
      "Ya existe una base llamada «%s»: elige otro nombre.", nombre))
  }
  nombre
}

# Lo que puede rechazar la importación se comprueba antes de descargar nada.
.cfp_precheck <- function(sid, parsed) {
  s <- session_get(sid)
  revision <- .cfp_revision(s, parsed$revision_id)
  .cfp_fuente(parsed)
  .cfp_base_nombre(s, parsed, revision)
}

# Bloque `origen_externo` (ADR 0100) para la base de un formulario con la lógica
# declarada fuera. Misma forma que el de la declaración sin lista de casos; se
# agregan la herramienta, la nota y la revisión de la que nace.
.cfp_origen_externo <- function(revision, n_filas, data_file_id) {
  externa <- (revision$source %||% list())$logic_external %||% list()
  herramienta <- .cfp_chr(externa$herramienta, "otro programa")
  bloque <- .origen_externo_bloque_sin_lista(NULL, n_filas, herramienta, "", data_file_id)
  bloque$herramienta <- herramienta
  bloque$nota <- .cfp_chr(externa$nota)
  bloque$fuente <- "formulario_publicado"
  bloque$instrument_revision_id <- .cfp_chr(revision$revision_id)
  bloque$logica_y_limpieza_fuera <- TRUE
  bloque$variables_retiradas <- list()
  bloque$n_variables_retiradas <- 0L
  bloque
}

.cfp_data_final <- function(data, inst) {
  data <- as.data.frame(data, stringsAsFactors = FALSE, check.names = FALSE)
  esperadas <- .dn_expected_data_names(inst)
  if (!nrow(data)) return(.carga_empty_data_for_instrument(inst))
  for (v in setdiff(esperadas, names(data))) data[[v]] <- NA_character_
  meta <- setdiff(names(data), esperadas)
  data[, c(meta, esperadas), drop = FALSE]
}

#' Crea la base desde el formulario publicado. Síncrona: para SurveyMonkey la
#' llama el worker del job (`carga_platform_job_runner`).
#' @keywords internal
carga_formulario_publicado_importar <- function(sid, parsed) {
  base_name <- .cfp_precheck(sid, parsed)
  prep <- .cfp_preparar(sid, parsed)
  resumen <- prep$resumen
  if (!is.null(resumen$bloqueo)) {
    status <- if (identical(resumen$bloqueo$codigo, "E_BAD_FILE")) 400 else 409
    stop_api(status, resumen$bloqueo$codigo, resumen$bloqueo$mensaje, details = list(
      cobertura = resumen$cobertura, n_emparejadas = resumen$n_emparejadas,
      n_variables_instrumento = resumen$n_variables_instrumento
    ))
  }
  revision <- prep$revision
  inst <- prep$inst
  data <- .cfp_data_final(prep$data, inst)
  .carga_assert_data_xlsform_compatible(data, inst)

  .carga_job_progress("write", message = "Escribiendo la base...")
  s <- session_get(sid)
  downloads_dir <- file.path(s$dir, "downloads")
  dir.create(downloads_dir, recursive = TRUE, showWarnings = FALSE)
  data_path <- file.path(downloads_dir, paste0(uuid::UUIDgenerate(), "_", base_name, "_data.xlsx"))
  .carga_write_xlsx_sheet(data, data_path, "datos")
  data_meta <- save_upload(sid, "data", paste0(base_name, "_data.xlsx"),
                           readBin(data_path, "raw", n = file.info(data_path)$size))
  unlink(data_path)

  imported_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  origen_declarado <- .cfp_logica_externa(revision)
  extra <- prep$extra_meta %||% list()
  if (is.null(extra$source_kind)) extra$source_kind <- .CFP_SOURCE_KIND[[prep$fuente]]
  extra$original_xlsform_file_id <- .cfp_chr(revision$xlsform_file_id)
  extra$formulario_publicado <- list(
    schema = "formulario_publicado/v1",
    revision_id = .cfp_chr(revision$revision_id),
    form_id = .cfp_chr(revision$form_id),
    fuente = prep$fuente,
    incluir_campanas = isTRUE(parsed$incluir_campanas),
    importado_at = imported_at,
    n_filas = resumen$n_filas,
    fuentes = resumen$fuentes,
    n_emparejadas = resumen$n_emparejadas,
    n_variables_instrumento = resumen$n_variables_instrumento,
    cobertura = resumen$cobertura,
    sin_par_instrumento = resumen$sin_par_instrumento,
    sin_par_fuente = resumen$sin_par_fuente,
    agregadas_fuente = resumen$agregadas_fuente,
    recodificaciones = resumen$recodificaciones,
    opciones_sin_par = resumen$opciones_sin_par
  )
  if (estudio_is_independent_siblings(sid)) {
    extra$processing_mode <- "independent_siblings"
    if (exists("estudio_independent_family_id", mode = "function")) {
      extra$sibling_family_id <- estudio_independent_family_id(sid) %||% ""
    }
  }

  .carga_job_progress("finalize", message = "Registrando la base en el estudio...")
  registro <- list(
    data_df = data, rp_inst = inst, inst_meta = list(file_id = .cfp_chr(revision$xlsform_file_id)),
    data_meta = data_meta, imported_at = imported_at, choice_order_editor = NULL,
    sm_opciones_sin_par_principal = extra$sm_opciones_sin_par_principal
  )
  extra$sm_opciones_sin_par_principal <- NULL
  .carga_separate_register(sid, base_name, registro, extra)
  .instrument_revision_binding_apply(
    sid, base_name,
    state = .INSTRUMENT_REVISION_BINDING_MATCHED,
    revision = revision,
    hash = .cfp_chr(revision$content_sha256),
    detail = "El analista eligió el formulario publicado al crear la base (ADR 0102)."
  )
  if (origen_declarado) {
    s <- session_get(sid)
    s$estudio$bases[[base_name]]$origen_externo <- .cfp_origen_externo(revision, nrow(data), data_meta$file_id)
    s <- .mark_project_dirty(s)
    .session_env[[sid]] <- s
  }
  list(
    ok = TRUE,
    base_name = base_name,
    n_filas = as.integer(nrow(data)),
    n_columnas = as.integer(ncol(data)),
    instrument_revision_id = .cfp_chr(revision$revision_id),
    origen_declarado = origen_declarado
  )
}

#' Puerta del endpoint: SurveyMonkey corre como job (descarga de respuestas);
#' `.sav` y Excel son síncronos.
#' @keywords internal
carga_formulario_publicado_importar_endpoint <- function(sid, parsed) {
  .cfp_precheck(sid, parsed)
  if (identical(.cfp_fuente(parsed), "surveymonkey")) {
    return(.carga_platform_job_submit(sid, .CFP_JOB_ACTION, parsed, kind = .CFP_JOB_KIND))
  }
  carga_formulario_publicado_importar(sid, parsed)
}
