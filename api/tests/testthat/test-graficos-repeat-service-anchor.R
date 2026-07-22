source("setup-load-all.R")

# =============================================================================
# Re-anclaje de current_code / current_label en fuentes de render de una base
# hija repeat (bug 0.5.16: la fuente analítica/adaptada los strippea y la
# apertura por servicio revienta el filtro `current_code` del render).
# =============================================================================

# Raw de la hija tal como lo deja Fase 1: conserva las llaves técnicas y los
# campos calculate del roster (current_code / current_label).
.anchor_raw_child <- function() {
  data.frame(
    `_index`        = c(1L, 2L, 3L, 4L, 5L),
    `_parent_index` = c(1L, 1L, 2L, 2L, 3L),
    current_code    = c("salud", "legal", "salud", "cepr", "salud"),
    current_label   = c("Socios en Salud", "Protección Legal", "Socios en Salud",
                        "CEPR", "Socios en Salud"),
    srv_claridad    = c("muy", "poco", "muy", "nada", "poco"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

# Fuente adaptada/analítica que llega al render: conserva `_index` pero perdió
# los calculate del roster (25 cols en producción; aquí simulamos el strip).
.anchor_stripped_source <- function(raw) {
  raw[, setdiff(names(raw), c("current_code", "current_label")), drop = FALSE]
}

test_that("re-ancla current_code/current_label desde el raw cuando la fuente los strippea", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .anchor_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  stripped <- .anchor_stripped_source(raw)
  expect_false("current_code" %in% names(stripped))
  expect_false("current_label" %in% names(stripped))

  src <- list(
    data_sources = list(rep_servicios = stripped),
    inst_sources = list(rep_servicios = list(survey = data.frame()))
  )
  out <- .graficos_reanchor_repeat_service_cols(sid, src)
  fixed <- out$data_sources$rep_servicios

  expect_true(all(c("current_code", "current_label") %in% names(fixed)))
  expect_equal(fixed$current_code, raw$current_code)
  expect_equal(fixed$current_label, raw$current_label)
})

test_that("el filtro por servicio del render funciona tras el re-anclaje", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .anchor_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  stripped <- .anchor_stripped_source(raw)
  src <- list(
    data_sources = list(rep_servicios = stripped),
    inst_sources = list(rep_servicios = list(survey = data.frame()))
  )
  fixed <- .graficos_reanchor_repeat_service_cols(sid, src)$data_sources$rep_servicios

  # Sin el re-anclaje este filtro (el que emite la apertura por servicio) rompe
  # TODA la lámina con "La variable de filtro `current_code` no existe".
  sub <- .apply_named_filters(fixed, list(current_code = "salud"))
  expect_equal(nrow(sub), 3L)
  expect_true(all(sub$current_code == "salud"))
})

test_that("aplicar el filtro sobre la fuente STRIPEADA reproduce el error del bug", {
  raw <- .anchor_raw_child()
  stripped <- .anchor_stripped_source(raw)
  expect_error(
    .apply_named_filters(stripped, list(current_code = "salud")),
    "current_code"
  )
})

test_that("no sobrescribe columnas de servicio ya presentes y correctas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .anchor_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  # La fuente ya trae current_code (procesamiento, 63 cols): el guard no la toca.
  present <- raw
  present$current_code <- paste0("x_", raw$current_code)  # valor distinto para detectar sobrescritura
  src <- list(
    data_sources = list(rep_servicios = present),
    inst_sources = list(rep_servicios = list(survey = data.frame()))
  )
  out <- .graficos_reanchor_repeat_service_cols(sid, src)$data_sources$rep_servicios
  expect_equal(out$current_code, paste0("x_", raw$current_code))
})

test_that("es no-op sobre una base que no es hija repeat (raw sin current_code)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  madre <- data.frame(
    `_index` = 1:3, sexo = c("1", "2", "1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  session_set(sid, "rp_data_sources", list(madre = madre))
  src <- list(
    data_sources = list(madre = madre),
    inst_sources = list(madre = list(survey = data.frame()))
  )
  out <- .graficos_reanchor_repeat_service_cols(sid, src)$data_sources$madre
  expect_false("current_code" %in% names(out))
  expect_false("current_label" %in% names(out))
  expect_equal(names(out), names(madre))
})
