# Armonización y comparación de fuentes de bases nacidas del formulario
# publicado (ADR 0102). Sin red: las bases se crean importando .sav sintéticos
# (sin datos de ningún estudio real) con el mismo camino que usa la app.

library(testthat)

# --- Utilidades ----------------------------------------------------------------

.carmt_error <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)

.carmt_sesion <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  sid
}

.carmt_df <- function(...) data.frame(..., stringsAsFactors = FALSE, check.names = FALSE)
.carmt_lab <- function(x, labels, label) haven::labelled(x, labels = labels, label = label)

.carmt_archivo <- function(sid, kind, path, nombre = basename(path)) {
  save_upload(sid, kind, nombre, readBin(path, "raw", n = file.info(path)$size))$file_id
}

.carmt_modelo <- function() {
  list(
    survey = .carmt_df(
      type = c("select_one genero", "select_multiple medios", "select_one si_no", "text"),
      name = c("p1", "p2", "p3", "p4"),
      `label::es` = c("Género", "Medios que usa", "¿Trabaja?", "Comentario")
    ),
    choices = .carmt_df(
      list_name = c(rep("genero", 3), rep("medios", 3), rep("si_no", 2)),
      name = c("1", "2", "99", "1", "2", "3", "1", "2"),
      `label::es` = c("Mujer", "Hombre", "SIN INF", "Radio", "TV", "Web", "Sí", "No")
    ),
    settings = .carmt_df(form_title = "Encuesta de Prueba", form_id = "prueba", default_language = "es")
  )
}

.carmt_publicar <- function(sid, revision_id = "rev-1", revision_no = 1L) {
  path <- tempfile(fileext = ".xlsx")
  .sm_mb_write_xlsform_model(.carmt_modelo(), path)
  file_id <- .carmt_archivo(sid, "xlsform", path, paste0(revision_id, ".xlsx"))
  s <- session_get(sid)
  s$xlsform_forms <- s$xlsform_forms %||% list()
  s$xlsform_forms[["form-1"]] <- list(id = "form-1", name = "Encuesta de Prueba", source = list(kind = "xlsform"))
  s$instrument_revisions <- s$instrument_revisions %||% list()
  s$instrument_revisions[[revision_id]] <- list(
    schema = "instrument_revision/v1", revision_id = revision_id, form_id = "form-1",
    revision_no = as.integer(revision_no),
    content_sha256 = digest::digest(revision_id, algo = "sha256"),
    xlsform_file_id = file_id, source = list(kind = "xlsform"),
    published_at = sprintf("2026-10-%02dT12:00:00Z", as.integer(revision_no))
  )
  .session_env[[sid]] <- s
  invisible(file_id)
}

.carmt_genero <- c("Mujer" = 1, "Hombre" = 2, "No binario" = 3, "SIN INF" = 99)
.carmt_si_no <- c("Sí" = 1, "No" = 2)

# Crea una base importando un .sav con los nombres del instrumento.
.carmt_base <- function(sid, nombre, ids, p1, p2, p3, revision_id = "rev-1") {
  df <- if (is.null(ids)) data.frame(row.names = seq_along(p1)) else .carmt_df(respondent_id = ids)
  df$p1 <- .carmt_lab(p1, .carmt_genero, "Género")
  df$p2 <- p2
  df$p3 <- .carmt_lab(p3, .carmt_si_no, "¿Trabaja?")
  df$p4 <- rep("texto", length(p1))
  path <- tempfile(fileext = ".sav")
  haven::write_sav(df, path)
  fid <- .carmt_archivo(sid, "sav", path, paste0(nombre, ".sav"))
  carga_formulario_publicado_importar(sid, list(
    revision_id = revision_id, fuente = "sav", file_id = fid, base_name = nombre))
}

# A: .sav limpio, trae «No binario» (no está en la lista: se pierde en la carga).
# B: otra fuente del mismo formulario, trae SIN INF (99) que A no tiene.
.carmt_par <- function(sid) {
  .carmt_publicar(sid)
  .carmt_base(sid, "a", ids = c("1", "2", "3", "4.0"),
              p1 = c(1, 1, 2, 3), p2 = c("1 2", "1", "3", ""), p3 = c(1, 1, 2, 2))
  .carmt_base(sid, "b", ids = c("3", "4", " 5", "6"),
              p1 = c(1, 2, 99, 1), p2 = c("1", "2", "3", "1 3"), p3 = c(1, 1, 2, 2))
}

.carmt_var <- function(res, nombre) Filter(function(v) identical(v$variable, nombre), res$variables)[[1]]
.carmt_cat <- function(v, codigo) Filter(function(c) identical(c$codigo, codigo), v$categorias)[[1]]

# --- Armonización guardada -------------------------------------------------------

test_that("armonización: una base del formulario publicado devuelve la meta guardada con nombre y número de revisión", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  res <- carga_armonizacion(sid, "a")
  expect_true(res$ok)
  expect_true(res$disponible)
  expect_identical(res$base, "a")
  expect_identical(res$formulario, list(form_id = "form-1", form_name = "Encuesta de Prueba",
                                        revision_id = "rev-1", revision_no = 1L))
  expect_identical(res$fuente, "sav")
  expect_identical(res$n_filas, 4L)
  expect_identical(res$n_emparejadas, 4L)
  expect_identical(res$n_variables_instrumento, 4L)
  expect_equal(res$cobertura, 1)
  expect_identical(res$opciones_sin_par, list(list(variable = "p1", n = 1L,
    etiquetas = list(list(etiqueta = "No binario", n = 1L)))))
  # Lee lo guardado, no recalcula: un cambio en la meta se ve tal cual.
  s <- session_get(sid)
  s$estudio$bases$a$formulario_publicado$n_filas <- 279L
  .session_env[[sid]] <- s
  expect_identical(carga_armonizacion(sid, "a")$n_filas, 279L)
})

test_that("armonización: base sin formulario publicado es disponible=false; base inexistente es 404", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  s <- session_get(sid)
  s$estudio$bases$a$formulario_publicado <- NULL
  .session_env[[sid]] <- s
  expect_identical(carga_armonizacion(sid, "a"), list(ok = TRUE, base = "a", disponible = FALSE))
  e <- .carmt_error(carga_armonizacion(sid, "no_existe"))
  expect_identical(e$code, "E_BASE_NOT_FOUND")
  expect_equal(e$status, 404)
})

# --- Comparación de fuentes ------------------------------------------------------

test_that("comparar: porcentajes sobre válidos con especiales, categorías exclusivas, perdidas en carga y orden", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  res <- carga_comparar_fuentes(sid, list(base_a = "a", base_b = "b"))
  expect_true(res$ok)
  expect_identical(res$revision_id, "rev-1")
  expect_identical(res$base_a, list(nombre = "a", n_filas = 4L, fuente = "sav", datos = "cruda"))
  expect_identical(res$base_b$n_filas, 4L)
  expect_identical(res$n_variables, 3L)
  # Distintas primero por diferencia desc; la igual al final.
  expect_identical(vapply(res$variables, `[[`, "", "variable"), c("p1", "p2", "p3"))
  expect_identical(vapply(res$variables, `[[`, "", "estado"), c("distinta", "distinta", "igual"))

  p1 <- .carmt_var(res, "p1")
  expect_identical(p1$tipo, "select_one")
  expect_identical(p1$etiqueta, "Género")
  # «No binario» llegó vacío a A: 3 válidos, no 4.
  expect_identical(c(p1$n_validos_a, p1$n_validos_b), c(3L, 4L))
  mujer <- .carmt_cat(p1, "1")
  expect_equal(c(mujer$pct_a, mujer$pct_b), c(66.67, 50))
  sin_inf <- .carmt_cat(p1, "99")
  expect_identical(sin_inf$etiqueta, "SIN INF")
  expect_true(sin_inf$especial)
  expect_false(mujer$especial)
  expect_identical(c(sin_inf$n_a, sin_inf$n_b), c(0L, 1L))
  expect_equal(p1$diferencia_max_pp, 25)
  expect_identical(p1$categorias_solo_a, list())
  expect_identical(p1$categorias_solo_b, list("SIN INF"))
  expect_identical(res$perdidas_en_carga_a, list(list(variable = "p1", etiqueta = "No binario", n = 1L)))
  expect_identical(res$perdidas_en_carga_b, list())

  # select_multiple: una categoría por opción, % sobre quienes respondieron.
  p2 <- .carmt_var(res, "p2")
  expect_identical(p2$tipo, "select_multiple")
  expect_identical(c(p2$n_validos_a, p2$n_validos_b), c(3L, 4L))
  expect_identical(vapply(p2$categorias, `[[`, "", "etiqueta"), c("Radio", "TV", "Web"))
  radio <- .carmt_cat(p2, "1")
  expect_identical(c(radio$n_a, radio$n_b), c(2L, 2L))
  expect_equal(c(radio$pct_a, radio$pct_b), c(66.67, 50))
  expect_equal(p2$diferencia_max_pp, 16.67)

  p3 <- .carmt_var(res, "p3")
  expect_equal(p3$diferencia_max_pp, 0)

  # p1 tiene exclusiva y perdida: cuenta una sola vez.
  expect_identical(res$resumen, list(n_iguales = 1L, n_distintas = 2L,
                                     n_con_categorias_exclusivas = 1L, diferencia_filas = 0L))
})

test_that("comparar: declara si cada base es la cruda o la depurada promovida (ADR 0076)", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  s <- session_get(sid)
  fid <- s$estudio$bases$b$data_file_id
  s$estudio$bases$b$limpieza <- list(enabled = TRUE, source_data_file_id = "otro", effective_data_file_id = fid)
  .session_env[[sid]] <- s
  res <- carga_comparar_fuentes(sid, list(base_a = "a", base_b = "b"))
  expect_identical(c(res$base_a$datos, res$base_b$datos), c("cruda", "depurada"))
})

test_that("comparar: una diferencia de hasta 2 pp sin exclusivas es igual", {
  sid <- .carmt_sesion()
  .carmt_publicar(sid)
  .carmt_base(sid, "a", ids = NULL, p1 = rep(c(1, 2), 50), p2 = rep("1", 100), p3 = rep(c(1, 2), 50))
  .carmt_base(sid, "b", ids = NULL, p1 = c(rep(1, 51), rep(2, 49)), p2 = rep("1", 100),
              p3 = c(rep(1, 53), rep(2, 47)))
  res <- carga_comparar_fuentes(sid, list(base_a = "a", base_b = "b"))
  expect_identical(.carmt_var(res, "p1")$estado, "igual")
  expect_equal(.carmt_var(res, "p1")$diferencia_max_pp, 1)
  expect_identical(.carmt_var(res, "p3")$estado, "distinta")
  expect_identical(res$variables[[1]]$variable, "p3")
})

test_that("comparar: casos por respondent_id normalizado, sólo conteos; sin clave en ambas es null", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  res <- carga_comparar_fuentes(sid, list(base_a = "a", base_b = "b"))
  # "4.0" casa con "4" y " 5" con "5".
  expect_identical(res$casos, list(clave = "respondent_id", solo_a = 2L, solo_b = 2L, en_ambas = 2L))
  # Ningún identificador individual sale en la respuesta.
  json <- jsonlite::toJSON(res, auto_unbox = TRUE, na = "null")
  expect_false(grepl("\"4.0\"|\" 5\"", json))

  .carmt_base(sid, "c", ids = NULL, p1 = c(1, 2), p2 = c("1", "2"), p3 = c(1, 2))
  res_c <- carga_comparar_fuentes(sid, list(base_a = "a", base_b = "c"))
  expect_identical(res_c$casos, list(clave = NA_character_, solo_a = NA_integer_,
                                     solo_b = NA_integer_, en_ambas = NA_integer_))
  expect_identical(res_c$resumen$diferencia_filas, 2L)
  expect_match(as.character(jsonlite::toJSON(res_c$casos, auto_unbox = TRUE, na = "null")),
               "\"clave\":null", fixed = TRUE)
})

test_that("comparar: otra revisión o base sin revisión es 409 con mensaje legible; base inexistente 404", {
  sid <- .carmt_sesion()
  .carmt_par(sid)
  .carmt_publicar(sid, revision_id = "rev-2", revision_no = 2L)
  .carmt_base(sid, "nueva", ids = c("1", "2"), p1 = c(1, 2), p2 = c("1", "2"), p3 = c(1, 2),
              revision_id = "rev-2")
  e <- .carmt_error(carga_comparar_fuentes(sid, list(base_a = "a", base_b = "nueva")))
  expect_identical(e$code, "E_COMPARAR_OTRA_REVISION")
  expect_equal(e$status, 409)
  expect_match(conditionMessage(e), "revisión 1 de «Encuesta de Prueba»", fixed = TRUE)
  expect_match(conditionMessage(e), "revisión 2", fixed = TRUE)

  s <- session_get(sid)
  s$estudio$bases$b$instrument_revision_id <- NULL
  .session_env[[sid]] <- s
  e2 <- .carmt_error(carga_comparar_fuentes(sid, list(base_a = "a", base_b = "b")))
  expect_identical(e2$code, "E_COMPARAR_OTRA_REVISION")
  expect_match(conditionMessage(e2), "«b» no está ligada", fixed = TRUE)

  expect_identical(.carmt_error(carga_comparar_fuentes(sid, list(base_a = "a", base_b = "zz")))$code,
                   "E_BASE_NOT_FOUND")
  expect_identical(.carmt_error(carga_comparar_fuentes(sid, list(base_a = "a", base_b = "a")))$code,
                   "E_BAD_REQUEST")
  expect_identical(.carmt_error(carga_comparar_fuentes(sid, list(base_a = "a")))$code, "E_BAD_REQUEST")
})

test_that("comparar: un código fuera de la lista entra con su código como etiqueta y fuera_de_lista", {
  inst <- list(
    choices = data.frame(list_name = c("g", "g"), name = c("1", "2"), label = c("Mujer", "Hombre"),
                         stringsAsFactors = FALSE)
  )
  p <- list(variable = "p1", tipo = "select_one", etiqueta = "Género", lista = "g")
  ca <- .carm_conteos(data.frame(p1 = c("1", "7", NA), stringsAsFactors = FALSE), p)
  cb <- .carm_conteos(data.frame(p1 = c("1.0", "2"), stringsAsFactors = FALSE), p)
  v <- .carm_variable(p, inst, ca, cb)
  fuera <- Filter(function(c) identical(c$codigo, "7"), v$categorias)[[1]]
  expect_identical(fuera$etiqueta, "7")
  expect_true(fuera$fuera_de_lista)
  expect_false(v$categorias[[1]]$fuera_de_lista)
  expect_identical(v$categorias_solo_a, list("7"))
  expect_identical(v$categorias_solo_b, list("Hombre"))
  expect_identical(c(ca$validos, cb$validos), c(2L, 2L))
})

test_that("las dos rutas quedan montadas", {
  pr <- mount_carga_armonizacion(plumber::pr())
  rutas <- vapply(pr$endpoints[[1]], function(e) e$path, character(1))
  expect_true(all(c("/api/carga/bases/<base>/armonizacion", "/api/carga/comparar-fuentes") %in% rutas))
})
