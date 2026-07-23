source("setup-load-all.R")

# =============================================================================
# Re-anclaje de etiquetas de servicio (`.repeat_service_labels_from_raw`,
# entregables_repeats.R). `_index` es la llave de instancia; `_submission__id`
# solo es fallback valido cuando identifica UNA fila hija por submission: con
# multiplicidad >1, `match()` tomaria siempre la primera fila y todas las
# instancias heredarian el servicio de la primera — laminas "por servicio"
# con datos de otro servicio. En ese caso se aborta (NULL), no se adivina.
# =============================================================================

.svc_raw_child <- function() {
  data.frame(
    `_index`          = c(1L, 2L, 3L, 4L),
    `_submission__id` = c("s1", "s1", "s2", "s2"),
    current_label     = c("Salud", "Legal", "Salud", "CEPR"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("re-ancla por _index cuando ambas fuentes lo conservan", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .svc_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  data <- raw[c(3L, 1L, 4L), setdiff(names(raw), "current_label"), drop = FALSE]
  out <- .repeat_service_labels_from_raw(sid, "rep_servicios", data)
  expect_identical(out, c("Salud", "Salud", "CEPR"))
})

test_that("_index gana aunque _submission__id tenga multiplicidad >1", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .svc_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  data <- raw[, setdiff(names(raw), "current_label"), drop = FALSE]
  out <- .repeat_service_labels_from_raw(sid, "rep_servicios", data)
  expect_identical(out, raw$current_label)
})

test_that("fallback _submission__id funciona cuando es llave unica (una hija por submission)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- data.frame(
    `_submission__id` = c("s1", "s2", "s3"),
    current_label     = c("Salud", "Legal", "CEPR"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  data <- data.frame(
    `_submission__id` = c("s3", "s1"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  out <- .repeat_service_labels_from_raw(sid, "rep_servicios", data)
  expect_identical(out, c("CEPR", "Salud"))
})

test_that("aborta (NULL) con solo _submission__id y multiplicidad >1", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  raw <- .svc_raw_child()
  session_set(sid, "rp_data_sources", list(rep_servicios = raw))

  # La fuente adaptada perdio `_index`: solo queda el fallback ambiguo.
  data <- raw[, setdiff(names(raw), c("current_label", "_index")), drop = FALSE]
  out <- .repeat_service_labels_from_raw(sid, "rep_servicios", data)
  expect_null(out)
})
