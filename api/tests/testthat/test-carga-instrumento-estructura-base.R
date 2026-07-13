# El endpoint de esquema del instrumento consciente de la base (modo multibase).
#
# En un estudio con grupos repeat, el begin_repeat vive en el instrumento de la
# base MADRE (XLSForm completo con la sección repeat), no en la HIJA (que
# promueve las preguntas del repeat a top-level). La vista de esquema de Carga
# debe poder pedir el esquema POR BASE para marcar is_repeat en la madre.

# XLSForm de la MADRE: caracterización top-level (sexo/edad) + begin_repeat
# rep_servicios con su gate `relevant` y preguntas srv_* dentro.
.ceb_madre_xlsform_model <- function() {
  survey <- data.frame(
    type = c(
      "text",
      "select_one lst_sexo",
      "integer",
      "begin_repeat",
      "text",
      "select_one lst_claridad",
      "end_repeat"
    ),
    name = c(
      "p_nombre", "sexo", "edad", "rep_servicios",
      "srv_nombre", "srv_claridad", "rep_servicios"
    ),
    label = c(
      "Nombre", "Sexo", "Edad", "Servicios",
      "Servicio recibido", "Claridad del servicio", ""
    ),
    relevant = c("", "", "", "${p_nombre} != ''", "", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_sexo", "lst_sexo", "lst_claridad", "lst_claridad"),
    name = c("1", "2", "1", "2"),
    label = c("Mujer", "Hombre", "Sí", "No"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  settings <- data.frame(
    form_title = "PDM (madre)", form_id = "pdm_madre",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  list(survey = survey, choices = choices, settings = settings)
}

# XLSForm de la HIJA: el repeat promovido a top-level (sin sección repeat).
.ceb_hija_xlsform_model <- function() {
  survey <- data.frame(
    type = c("text", "select_one lst_claridad"),
    name = c("srv_nombre", "srv_claridad"),
    label = c("Servicio recibido", "Claridad del servicio"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("lst_claridad", "lst_claridad"),
    name = c("1", "2"),
    label = c("Sí", "No"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  settings <- data.frame(
    form_title = "PDM (hija)", form_id = "pdm_hija",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  list(survey = survey, choices = choices, settings = settings)
}

# Monta un estudio multibase con base MADRE (con repeat) e HIJA en la sesión.
.ceb_setup_study <- function() {
  sid <- session_create()

  madre_path <- tempfile("madre_xlsform_", fileext = ".xlsx")
  .carga_write_xlsform_model(.ceb_madre_xlsform_model(), madre_path)
  madre_meta <- save_upload(sid, "xlsform", "madre.xlsx",
                            readBin(madre_path, "raw", n = file.info(madre_path)$size))

  hija_path <- tempfile("hija_xlsform_", fileext = ".xlsx")
  .carga_write_xlsform_model(.ceb_hija_xlsform_model(), hija_path)
  hija_meta <- save_upload(sid, "xlsform", "hija.xlsx",
                           readBin(hija_path, "raw", n = file.info(hija_path)$size))

  s <- session_get(sid)
  s$estudio <- list(
    active_base = "post_distribution_monitoring",
    processing_mode = "independent_siblings",
    bases = list(
      post_distribution_monitoring = list(
        nombre = "post_distribution_monitoring",
        xlsform_file_id = madre_meta$file_id
      ),
      rep_servicios = list(
        nombre = "rep_servicios",
        xlsform_file_id = hija_meta$file_id
      )
    )
  )
  .session_env[[sid]] <- s
  list(sid = sid, madre_id = madre_meta$file_id, hija_id = hija_meta$file_id)
}

.ceb_req <- function(sid) list(HTTP_X_PULSO_SESSION = sid)

test_that("estructura?base=<madre> marca is_repeat en la sección repeat", {
  st <- .ceb_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)

  out <- .carga_estructura_instrumento_endpoint(
    .ceb_req(st$sid), list(), base = "post_distribution_monitoring"
  )

  expect_true(is.list(out$secciones))
  sec_names <- vapply(out$secciones, `[[`, character(1), "name")
  expect_true("rep_servicios" %in% sec_names)

  rep_sec <- out$secciones[[which(sec_names == "rep_servicios")[1]]]
  expect_true(isTRUE(rep_sec$is_repeat))

  # Las preguntas srv_* del repeat vienen en el esquema de la madre.
  q_names <- vapply(out$preguntas, `[[`, character(1), "name")
  expect_true(all(c("srv_nombre", "srv_claridad") %in% q_names))
})

test_that("estructura?base=<hija> NO trae la sección repeat (promovida a top-level)", {
  st <- .ceb_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)

  out <- .carga_estructura_instrumento_endpoint(
    .ceb_req(st$sid), list(), base = "rep_servicios"
  )

  sec_names <- vapply(out$secciones, `[[`, character(1), "name")
  # La hija no tiene begin_repeat; ninguna sección debe venir marcada is_repeat.
  reps <- vapply(out$secciones, function(x) isTRUE(x$is_repeat), logical(1))
  expect_false(any(reps))
  expect_false("rep_servicios" %in% sec_names)
})

test_that("base inexistente -> 404 E_BASE_NOT_FOUND", {
  st <- .ceb_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)

  err <- tryCatch(
    .carga_estructura_instrumento_endpoint(.ceb_req(st$sid), list(), base = "no_existe"),
    api_error = function(e) e
  )
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 404)
  expect_equal(err$code, "E_BASE_NOT_FOUND")
})

test_that("sin `base` -> comportamiento single-base intacto", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  path <- tempfile("single_xlsform_", fileext = ".xlsx")
  .carga_write_xlsform_model(.ceb_madre_xlsform_model(), path)
  save_upload(sid, "xlsform", "single.xlsx",
              readBin(path, "raw", n = file.info(path)$size))

  # Sin estudio ni `base`: cae al camino single-base (último xlsform subido).
  out <- .carga_estructura_instrumento_endpoint(.ceb_req(sid), list())

  sec_names <- vapply(out$secciones, `[[`, character(1), "name")
  expect_true("rep_servicios" %in% sec_names)
  # El instrumento single-base quedó cacheado en inst_limpieza (no por base).
  expect_true(.pulso_valid_inst_cache(session_get(sid)$inst_limpieza))
  expect_null(session_get(sid)$inst_estructura_por_base)
})

test_that("cachea el instrumento por base sin tocar el cache single-base", {
  st <- .ceb_setup_study()
  on.exit(session_delete(st$sid), add = TRUE)

  # Primera resolución -> cachea en inst_estructura_por_base[[madre]].
  inst1 <- .carga_inst_estructura_por_base(st$sid, "post_distribution_monitoring")
  expect_true(.pulso_valid_inst_cache(inst1))
  cache <- session_get(st$sid)$inst_estructura_por_base
  expect_true(.pulso_valid_inst_cache(cache[["post_distribution_monitoring"]]))
  # No debe contaminar el cache single-base.
  expect_null(session_get(st$sid)$inst_limpieza)

  # Borrar el archivo en disco: la segunda resolución debe salir del cache.
  file.remove(session_get(st$sid)$files[[st$madre_id]]$path)
  inst2 <- .carga_inst_estructura_por_base(st$sid, "post_distribution_monitoring")
  expect_true(.pulso_valid_inst_cache(inst2))
})
