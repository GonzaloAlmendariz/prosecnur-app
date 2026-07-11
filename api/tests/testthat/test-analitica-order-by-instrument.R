# Tests del reorden canónico por instrumento, la higiene de columnas internas y
# la reconstrucción de la columna madre legible de select_multiple para el export
# de base al cliente (analitica_sm_dummy_order.R / analitica_base_export_hygiene.R).

make_inst <- function() {
  survey <- data.frame(
    name = c("q_pre", "sm1", "sm1_recod", "q_post"),
    type = c("select_one yn", "select_multiple opts",
             "select_multiple opts_recod", "text"),
    list_name = c("yn", "opts", "opts_recod", ""),
    label = c("Pregunta previa", "Medios", "Medios (recod)", "Comentario"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("yn", "yn", "opts", "opts", "opts", "opts_recod", "opts_recod"),
    name = c("1", "2", "1", "2", "96", "1", "2"),
    label = c("Sí", "No", "Radio", "Televisión", "Otro", "RadioR", "TVR"),
    stringsAsFactors = FALSE
  )
  structure(list(survey = survey, choices = choices),
            class = "prosecnur_instrumento")
}

# Base con los dummies de sm1/sm1_recod apendados AL FINAL (patrón real de la
# codificación) y columnas no-survey (kobo_*, _uuid) también al final.
make_data_dummies_al_final <- function() {
  data.frame(
    q_pre = c(1L, 2L),
    q_post = c("a", "b"),
    kobo_fecha = c("2026-01-01", "2026-01-02"),
    `_uuid` = c("u1", "u2"),
    sm1.1 = c(1L, 0L),
    sm1.2 = c(0L, 1L),
    sm1.96 = c(0L, 0L),
    sm1_recod.1 = c(1L, 0L),
    sm1_recod.2 = c(0L, 1L),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
}

test_that("(a) los dummies de select_multiple vuelven a la posición del parent en el survey", {
  inst <- make_inst()
  data <- make_data_dummies_al_final()
  out <- .analitica_order_by_instrument(data, inst)

  expect_equal(
    names(out),
    c("q_pre",
      "sm1.1", "sm1.2", "sm1.96",
      "sm1_recod.1", "sm1_recod.2",
      "q_post",
      "kobo_fecha", "_uuid")
  )
  # El contenido de cada columna se preserva (solo se reordena).
  expect_equal(out$sm1.2, data$sm1.2)
  expect_equal(out[["_uuid"]], data[["_uuid"]])
})

test_that("(b) columnas no-survey (kobo_*, _uuid) quedan al final sin perderse", {
  inst <- make_inst()
  data <- make_data_dummies_al_final()
  out <- .analitica_order_by_instrument(data, inst)

  expect_setequal(names(out), names(data))
  expect_equal(tail(names(out), 2L), c("kobo_fecha", "_uuid"))
})

test_that("(c) guardrail: el set de columnas nunca cambia (no pierde ni duplica)", {
  inst <- make_inst()
  data <- make_data_dummies_al_final()
  out <- .analitica_order_by_instrument(data, inst)
  expect_equal(length(names(out)), length(names(data)))
  expect_false(any(duplicated(names(out))))
  # Idempotente: aplicar dos veces == una vez.
  expect_identical(.analitica_order_by_instrument(out, inst), out)
})

test_that("(d) no-op sin inst$survey", {
  data <- make_data_dummies_al_final()
  expect_identical(.analitica_order_by_instrument(data, list()), data)
  expect_identical(.analitica_order_by_instrument(data, NULL), data)
})

test_that("(e) preserva atributos top-level", {
  inst <- make_inst()
  data <- make_data_dummies_al_final()
  attr(data, "instrumento_reporte") <- list(marca = "x")
  attr(data, "var_peso") <- "peso_final"
  out <- .analitica_order_by_instrument(data, inst)
  expect_equal(attr(out, "instrumento_reporte"), list(marca = "x"))
  expect_equal(attr(out, "var_peso"), "peso_final")
})

test_that(".analitica_base_internal_cols detecta plumbing y respeta metadata legítima", {
  data <- data.frame(
    q1 = 1:2,
    `.source_id` = c("s", "s"),
    `.source_kind` = c("kobo", "kobo"),
    dim_territorial_phase = c("f1", "f2"),
    dim_origen = c("o", "o"),
    kobo_fecha = c("x", "y"),
    kobo_hora = c("h", "h"),
    kobo_timestamp_iso = c("t", "t"),
    kobo_fecha_iso = c("i", "i"),
    kobo_fecha_hora = c("z", "z"),
    `_uuid` = c("u1", "u2"),
    `_submission_time` = c("s1", "s2"),
    `_id` = c("1", "2"),
    start = c("a", "b"),
    end = c("c", "d"),
    today = c("e", "f"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  internas <- .analitica_base_internal_cols(data)

  expect_true(all(c(".source_id", ".source_kind", "dim_territorial_phase",
                    "dim_origen", "kobo_fecha", "kobo_hora", "kobo_timestamp_iso",
                    "kobo_fecha_iso", "kobo_fecha_hora") %in% internas))
  # Metadata legítima de Kobo NO se marca.
  expect_false(any(c("_uuid", "_submission_time", "_id", "start", "end",
                     "today", "q1") %in% internas))
})

test_that("madre legible: reconstruye <parent> con etiquetas unidas en la posición del parent", {
  inst <- make_inst()
  # Base con la madre plana AUSENTE (solo dummies), como en la data real.
  data <- data.frame(
    q_pre = c(1L, 2L, 3L),
    sm1.1 = c(1L, 0L, 1L),
    sm1.2 = c(0L, 1L, 1L),
    sm1.96 = c(0L, 0L, 0L),
    q_post = c("a", "b", "c"),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  out <- .analitica_base_reconstruct_madre_sm(data, inst)

  # La madre se agrega justo antes de su bloque de dummies.
  expect_true("sm1" %in% names(out))
  pos_madre <- match("sm1", names(out))
  pos_dummy <- match("sm1.1", names(out))
  expect_equal(pos_madre + 1L, pos_dummy)

  # La madre trae los códigos concatenados; .aplicar_etiquetas los decodifica.
  expect_equal(as.character(out$sm1), c("1", "2", "1 2"))
  dec <- .aplicar_etiquetas(out, inst, valores = "etiquetas", multi_select = "dummy_01")
  expect_equal(as.character(dec$sm1), c("Radio", "Televisión", "Radio | Televisión"))
})

test_that("madre legible: no duplica si la madre plana ya existe", {
  inst <- make_inst()
  data <- data.frame(
    q_pre = c(1L, 2L),
    sm1 = c("1", "2"),
    sm1.1 = c(1L, 0L),
    sm1.2 = c(0L, 1L),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  out <- .analitica_base_reconstruct_madre_sm(data, inst)
  expect_equal(sum(names(out) == "sm1"), 1L)
  expect_identical(out$sm1, data$sm1)
})
