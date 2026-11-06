# E6 del revamp del explorador (docs/qa/checklist-explorador-variables-2026-11-02.md): `dist` del univariado por
# tipo — motor `explorador_distribucion()` y su llegada por POST /api/validacion/v2/explorar/univariado.

.edi_inst <- function() {
  survey <- data.frame(
    type = c("begin_group", "select_one", "select_one", "select_multiple", "text", "integer", "date", "text", "end_group"),
    list_name = c(NA, "sexo", "likert", "medios", NA, NA, NA, NA, NA),
    name = c("g_datos", "sexo", "satis", "medios", "medios_otro", "edad", "fecha", "comentario", NA),
    label = c("Datos del caso", "Sexo del entrevistado", "Satisfacción con el servicio", "Medios por los que se enteró",
              "Otro medio, especifique", "Edad", "Fecha de la entrevista", "Comentario final", NA),
    hint = c(NA, NA, "Lea las opciones", NA, NA, "En años cumplidos", NA, NA, NA),
    relevant = c(NA, NA, NA, NA, "selected(${medios}, 'otro')", NA, NA, NA, NA),
    constraint = c(NA, NA, NA, NA, NA, ". >= 18 and . <= 99", NA, NA, NA),
    constraint_message = c(NA, NA, NA, NA, NA, "Edad entre 18 y 99", NA, NA, NA),
    required = c(NA, "yes", NA, NA, NA, "yes", NA, NA, NA),
    choice_filter = c(NA, NA, NA, NA, NA, NA, NA, NA, NA),
    appearance = c("field-list", NA, "likert", "minimal", NA, NA, NA, "multiline", NA),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = c("sexo", "sexo", rep("likert", 4), rep("medios", 4)),
    name = c("1", "2", "1", "2", "3", "4", "tv", "radio", "web", "otro"),
    label = c("Hombre", "Mujer", "Nada satisfecho", "Poco satisfecho", "Algo satisfecho", "Muy satisfecho",
              "Televisión", "Radio", "Internet", "Otro"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, choices = choices, settings = data.frame(form_id = "fx", version = "2026-11-01"))
}

.edi_data <- function() {
  data.frame(
    id = sprintf("R%02d", 1:12),
    sexo = c("1", "2", "1", "2", "1", "2", "1", "2", "9", NA, "1", "2"),
    satis = c("1", "2", "3", "4", "4", "3", "2", "4", "3", NA, "4", "1"),
    medios.tv = c(1, 0, 1, 1, 0, 0, 1, 0, 1, NA, 1, 0),
    medios.radio = c(0, 1, 1, 0, 0, 1, 0, 0, 0, NA, 0, 1),
    medios.web = c(0, 0, 0, 1, 1, 0, 1, 1, 0, NA, 0, 0),
    medios.otro = c(0, 0, 0, 0, 1, 1, 0, 0, 0, NA, 0, 0),
    medios.cine = c(0, 0, 0, 0, 0, 0, 0, 0, 0, NA, 0, 1),
    medios_otro = c(NA, NA, NA, NA, "Afiche", "afiche ", NA, NA, NA, NA, NA, NA),
    edad = c(25, 31, 47, 52, 19, 33, 61, 28, 40, NA, 150, 36),
    fecha = c("2026-10-01", "2026-10-01", "2026-10-02", "2026-10-02", "2026-10-02", "2026-10-03",
              "2026-10-03", "2026-10-04", "2026-10-04", NA, "2026-10-05", "2026-10-05"),
    comentario = c("Muy bueno", "muy buéno", "Regular", NA, "", "Excelente", "Regular", "Lento", "Muy bueno",
                   NA, "Bien", "Excelente"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

.edi_filas <- function(d, campo) vapply(d$filas, function(f) f[[campo]], if (campo %in% c("n")) 1L else if (campo == "pct") 1 else "")

test_that("dist de una select_one: todas las opciones de la lista, fuera de lista al final, pct 0–100 sobre base_n", {
  d <- explorador_distribucion(.edi_data(), "sexo", .edi_inst())
  expect_identical(names(d), c("tipo", "ordinal", "base_n", "filas"))
  expect_identical(d$tipo, "so")
  expect_false(d$ordinal)
  expect_identical(d$base_n, 11L)
  expect_identical(.edi_filas(d, "codigo"), c("1", "2", "9"))
  expect_identical(.edi_filas(d, "etiqueta"), c("Hombre", "Mujer", "9"))
  expect_identical(sum(.edi_filas(d, "n")), d$base_n)
  expect_equal(sum(.edi_filas(d, "pct")), 100)
})

test_that("dist ordinal: la escala se reconoce con la heurística compartida y conserva las opciones en cero", {
  datos <- .edi_data()
  datos$satis[datos$satis == "2"] <- "1"   # nadie responde «Poco satisfecho»
  d <- explorador_distribucion(datos, "satis", .edi_inst())
  expect_true(d$ordinal)
  expect_identical(.edi_filas(d, "codigo"), c("1", "2", "3", "4"))
  expect_identical(.edi_filas(d, "n")[2], 0L)
  # Lo declarado en Analítica manda sobre la heurística.
  inst <- .edi_inst(); inst$listas_nominales <- "likert"
  expect_false(explorador_distribucion(datos, "satis", inst)$ordinal)
})

test_that("dist de una select_multiple: pct sobre quienes responden y «cuántas marca» suma la base", {
  d <- explorador_distribucion(.edi_data(), "medios", .edi_inst())
  expect_identical(d$tipo, "sm")
  expect_identical(d$base_n, 11L)
  expect_identical(.edi_filas(d, "codigo"), c("tv", "radio", "web", "otro", "cine"))
  expect_identical(.edi_filas(d, "n"), c(6L, 4L, 4L, 2L, 1L))
  expect_equal(.edi_filas(d, "pct")[1], 100 * 6 / 11)
  expect_identical(vapply(d$cuantas_marca, `[[`, "", "k"), c("1", "2", "3+"))
  expect_identical(sum(vapply(d$cuantas_marca, `[[`, 1L, "n")), d$base_n)
  expect_equal(sum(vapply(d$cuantas_marca, `[[`, 1, "pct")), 100)
})

test_that("dist numérica: tramos Freedman–Diaconis entre 8 y 30 que suman la base, atípicos por 1.5 × IQR", {
  d <- explorador_distribucion(.edi_data(), "edad", .edi_inst())
  expect_identical(d$tipo, "num")
  expect_identical(names(d$num), c("bins", "min", "p25", "mediana", "p75", "max", "media", "n_atipicos"))
  expect_gte(length(d$num$bins), 8L)
  expect_lte(length(d$num$bins), 30L)
  expect_identical(sum(vapply(d$num$bins, `[[`, 1L, "n")), d$base_n)
  expect_identical(d$num$bins[[1]]$desde, 19)
  expect_identical(d$num$bins[[length(d$num$bins)]]$hasta, 150)
  expect_identical(d$num$n_atipicos, 1L)   # el 150
  expect_identical(d$num$mediana, 36)
  # Muchos casos: el tope de 30 tramos manda.
  grande <- data.frame(edad = c(seq(1, 100, length.out = 5000), 1e4))
  dg <- explorador_distribucion(grande, "edad", .edi_inst())
  expect_identical(length(dg$num$bins), 30L)
  expect_identical(sum(vapply(dg$num$bins, `[[`, 1L, "n")), 5001L)
  # Sin variación: un solo tramo.
  d1 <- explorador_distribucion(data.frame(edad = rep(30, 4)), "edad", .edi_inst())
  expect_length(d1$num$bins, 1L)
})

test_that("dist de fecha (casos por día ISO) y de texto (agrupado sin mayúsculas ni tildes, top 50)", {
  f <- explorador_distribucion(.edi_data(), "fecha", .edi_inst())
  expect_identical(vapply(f$fecha$dias, `[[`, "", "fecha"),
                   c("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"))
  expect_identical(sum(vapply(f$fecha$dias, `[[`, 1L, "n")), f$base_n)
  t <- explorador_distribucion(.edi_data(), "comentario", .edi_inst())
  expect_identical(t$base_n, 9L)   # el vacío no responde
  expect_identical(t$texto$grupos[[1]], list(texto = "Muy bueno", n = 3L))   # «muy buéno» cae en el mismo grupo
  expect_identical(sum(vapply(t$texto$grupos, `[[`, 1L, "n")), t$base_n)
  muchos <- data.frame(comentario = sprintf("respuesta %03d", 1:80))
  expect_length(explorador_distribucion(muchos, "comentario", .edi_inst())$texto$grupos, 50L)
})

test_that("build_view_univariado suma `dist` sin quitar `chart` ni `kpis`, y aplica los filtros", {
  v <- build_view_univariado(.edi_data(), "satis", .edi_inst(), filtros = list(sexo = list("1")))
  expect_true(all(c("kpis", "chart", "dist") %in% names(v)))
  expect_identical(v$dist$base_n, 5L)
  expect_identical(v$n_tras_filtro, 5L)
})

test_that("POST /explorar/univariado devuelve `dist` por la ruta (pr$call en proceso, base pedida)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  datos <- .edi_data()
  for (nm in c("primera", "segunda")) {
    d <- if (nm == "primera") datos else datos[1:6, , drop = FALSE]
    estudio_add_base(sid, nombre = nm, xlsform_file_id = paste0("x-", nm), data_file_id = paste0("d-", nm),
                     data_ext = "xlsx", rp_data = d, rp_inst = .edi_inst())
  }
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err)) |>
    mount_validacion()
  body <- '{"var":"medios","fuente":"raw"}'
  raw_body <- charToRaw(body)
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  r <- pr$call(as.environment(list(
    REQUEST_METHOD = "POST", PATH_INFO = "/api/validacion/v2/explorar/univariado", QUERY_STRING = "",
    CONTENT_TYPE = "application/json", HTTP_X_PULSO_SESSION = sid, HTTP_X_BASE_NOMBRE = "segunda",
    rook.input = input
  )))
  j <- jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)
  expect_identical(as.integer(r$status), 200L)
  expect_identical(j$base_nombre, "segunda")
  expect_false(is.null(j$chart))
  expect_identical(j$dist$tipo, "sm")
  expect_identical(j$dist$base_n, 6L)
  expect_identical(vapply(j$dist$cuantas_marca, `[[`, "", "k"), c("1", "2", "3+"))
})
