# Paridad de orden de dummies entre Gráficos/PPT y Analítica.
#
# Los dummies `<parent>.<code>` llegan de `reporte_data()` en el orden arbitrario
# en que los generó la codificación. Analítica los reordena al orden de la lista
# de opciones del instrumento antes de servir la base final, el codebook y las
# frecuencias; Gráficos no lo hacía y la misma variable se leía distinto en cada
# módulo. `.graficos_order_sm_dummy_sources` aplica el mismo reordenamiento sobre
# las fuentes que alimentan el PPT.

# Instrumento con un select_multiple `smx` cuya lista declara un valor especial
# (96) a media lista. `extra_codes` son categorías presentes en la data pero
# NO declaradas en el choices (categorías nuevas de la recodificada).
# `with_orders = TRUE` agrega el `orders_list` que arma `reporte_instrumento()`
# (necesario para que el override del analista tenga dónde aplicarse).
gsm_inst <- function(codes = c("1", "2", "96", "10", "9"), with_orders = FALSE) {
  survey <- data.frame(
    name = "smx", type = "select_multiple sp", list_name = "sp",
    label = "Servicios", stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = rep("sp", length(codes)),
    name = as.character(codes),
    label = paste0("Opt ", codes),
    stringsAsFactors = FALSE
  )
  inst <- list(survey = survey, choices = choices)
  if (isTRUE(with_orders)) {
    inst$orders_list <- list(smx = list(
      names = as.character(codes),
      labels = paste0("Opt ", codes),
      label = "Servicios"
    ))
  }
  structure(inst, class = "prosecnur_instrumento")
}

# Base con los dummies de `smx` en el orden CRUDO dado.
gsm_data <- function(codes) {
  df <- data.frame(id = c(1L, 2L))
  for (code in codes) df[[paste0("smx.", code)]] <- c(1L, 0L)
  df
}

gsm_codes <- function(data) {
  sub("^smx\\.", "", grep("^smx\\.", names(data), value = TRUE))
}

test_that("Gráficos ordena los dummies igual que Analítica (categorías nuevas + especial)", {
  # `9` y `12` existen en la data pero no en el choices: categorías nuevas de la
  # recodificada. `96` es un valor especial declarado a media lista.
  inst <- gsm_inst(c("1", "2", "96", "10"))
  crudo <- c("2", "96", "12", "1", "9", "10")
  data <- gsm_data(crudo)

  src <- .graficos_order_sm_dummy_sources(
    list(data_sources = list(default = data), inst_sources = list(default = inst))
  )
  graficos <- gsm_codes(src$data_sources$default)
  analitica <- gsm_codes(.analitica_order_sm_dummy_cols(data, inst))

  # La premisa del fix: el orden crudo NO es el correcto…
  expect_false(identical(crudo, analitica))
  # …y Gráficos ahora coincide con Analítica, que es la definición canónica.
  expect_identical(graficos, analitica)
  # Orden esperado: choices (1, 2, 10) → categorías nuevas (9, 12) → especial 96.
  expect_identical(graficos, c("1", "2", "10", "9", "12", "96"))
})

test_that("cada base se ordena contra SU instrumento (multibase)", {
  inst_a <- gsm_inst(c("1", "2", "96"))
  inst_b <- gsm_inst(c("2", "1", "96"))
  data_a <- gsm_data(c("96", "2", "1"))
  data_b <- gsm_data(c("96", "1", "2"))

  src <- .graficos_order_sm_dummy_sources(list(
    data_sources = list(madre = data_a, hija = data_b),
    inst_sources = list(madre = inst_a, hija = inst_b)
  ))

  expect_identical(gsm_codes(src$data_sources$madre), c("1", "2", "96"))
  expect_identical(gsm_codes(src$data_sources$hija), c("2", "1", "96"))
})

test_that("solo permuta columnas: no pierde datos ni atributos, y es idempotente", {
  inst <- gsm_inst(c("1", "2", "96"))
  data <- gsm_data(c("96", "2", "1"))
  attr(data, "var_peso") <- "peso_final"

  once <- .graficos_order_sm_dummy_sources(
    list(data_sources = list(default = data), inst_sources = list(default = inst))
  )$data_sources$default
  twice <- .graficos_order_sm_dummy_sources(
    list(data_sources = list(default = once), inst_sources = list(default = inst))
  )$data_sources$default

  expect_setequal(names(once), names(data))
  expect_equal(nrow(once), nrow(data))
  expect_identical(once[["smx.96"]], data[["smx.96"]])
  expect_identical(attr(once, "var_peso", exact = TRUE), "peso_final")
  expect_identical(names(twice), names(once))
})

test_that("degrada sin romper ante fuentes incompletas o instrumento sin SM", {
  inst <- gsm_inst(c("1", "2"))
  data <- gsm_data(c("2", "1"))

  expect_identical(.graficos_order_sm_dummy_sources(list()), list())
  expect_identical(
    .graficos_order_sm_dummy_sources(list(data_sources = list(default = data))),
    list(data_sources = list(default = data))
  )
  # Base sin instrumento pareado: se deja intacta.
  out <- .graficos_order_sm_dummy_sources(list(
    data_sources = list(default = data, huerfana = data),
    inst_sources = list(default = inst)
  ))
  expect_identical(names(out$data_sources$huerfana), names(data))
  # Instrumento sin select_multiple: no-op.
  plano <- structure(
    list(
      survey = data.frame(name = "q1", type = "text", list_name = NA_character_,
                          label = "Q1", stringsAsFactors = FALSE),
      choices = data.frame(list_name = character(0), name = character(0),
                           label = character(0), stringsAsFactors = FALSE)
    ),
    class = "prosecnur_instrumento"
  )
  out2 <- .graficos_order_sm_dummy_sources(list(
    data_sources = list(default = data), inst_sources = list(default = plano)
  ))
  expect_identical(names(out2$data_sources$default), names(data))
})

test_that("el override de orden del analista manda sobre el choices también en Gráficos", {
  skip_if_not(exists("session_create", mode = "function"))

  sid <- session_create()
  # El analista fijó 2, 1, 10 con las flechas de Analítica (el 96 queda fuera del
  # override: el pase de valores especiales lo manda igual al final).
  session_set(sid, "analitica_config", list(orden_categorias = list(sp = c("2", "1", "10"))))

  inst <- gsm_inst(c("1", "2", "96", "10"), with_orders = TRUE)
  # `reporte_data()` adjunta el instrumento ORIGINAL; el attr manda como fallback
  # sobre `inst`, así que el override tiene que llegar hasta ahí.
  data <- gsm_data(c("96", "1", "10", "2"))
  attr(data, "instrumento_reporte") <- inst

  src <- list(data_sources = list(default = data), inst_sources = list(default = inst))
  src <- .graficos_apply_orden_categorias_sources(sid, src)
  src <- .graficos_order_sm_dummy_sources(src)

  expect_identical(gsm_codes(src$data_sources$default), c("2", "1", "10", "96"))
})

test_that("sincronizar el orden no borra las variables que el instrumento no trae", {
  skip_if_not(exists("session_create", mode = "function"))

  sid <- session_create()
  session_set(sid, "analitica_config", list(orden_categorias = list(sp = c("2", "1"))))

  inst <- gsm_inst(c("1", "2", "96"), with_orders = TRUE)
  data <- gsm_data(c("96", "1", "2"))
  # El attr trae una variable extra que el inst_source no conoce: el merge por
  # variable tiene que conservarla (un reemplazo total del orders_list la perdía).
  ir <- inst
  ir$orders_list$otra_var <- list(names = c("a", "b"), labels = c("A", "B"))
  attr(data, "instrumento_reporte") <- ir

  src <- .graficos_apply_orden_categorias_sources(
    sid,
    list(data_sources = list(default = data), inst_sources = list(default = inst))
  )
  ol <- attr(src$data_sources$default, "instrumento_reporte", exact = TRUE)$orders_list

  expect_identical(ol$otra_var$names, c("a", "b"))
  expect_identical(as.character(ol$smx$names), c("2", "1", "96"))
})
