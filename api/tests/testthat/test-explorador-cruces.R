# E8 del revamp del explorador (docs/qa/checklist-explorador-variables-2026-11-02.md): `cruce` del bivariado para
# los 25 pares tipo × tipo — motor `explorador_cruce()` y su llegada por POST /api/validacion/v2/explorar/bivariado.

.ecr_inst <- function() {
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

.ecr_data <- function() {
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

.ecr_vars <- c(so = "sexo", sm = "medios", num = "edad", fecha = "fecha", texto = "comentario")

.ecr_esperado <- list(
  so_so = c("Tabla de calor", "tabla"), so_sm = c("% que marca, por categoría", "tabla"),
  so_num = c("Cajas por categoría", "cajas"), so_fecha = c("Casos por día, apilados", "serie"),
  so_texto = c("Respuestas por categoría", "lista"),
  sm_so = c("% que marca cada opción, por categoría", "tabla"), sm_sm = c("Coocurrencia de opciones", "tabla"),
  sm_num = c("Cajas por opción marcada", "cajas"), sm_fecha = c("% que marca, por día", "serie"),
  num_so = c("Cajas por categoría", "cajas"), num_sm = c("Cajas por opción marcada", "cajas"),
  num_num = c("Dispersión con tendencia", "dispersion"), num_fecha = c("Mediana por día", "serie"),
  fecha_so = c("Días por categoría", "cajas"), fecha_sm = c("Días por opción marcada", "cajas"),
  fecha_num = c("Fecha frente a la numérica", "dispersion"), fecha_fecha = c("Diferencia en días", "cajas"),
  texto_so = c("Respuestas por categoría", "lista")
)

# Una abierta sólo se cruza con una única (decisión de Gonzalo, 2026-11-03).
.ecr_sin_cruce <- c("sm_texto", "texto_sm", "num_texto", "texto_num", "fecha_texto", "texto_fecha", "texto_texto")

test_that("los 18 pares que se cruzan devuelven su gráfico y su forma, con el cuerpo de esa forma", {
  datos <- .ecr_data(); inst <- .ecr_inst()
  for (tx in names(.ecr_vars)) for (ty in names(.ecr_vars)) {
    clave <- paste(tx, ty, sep = "_")
    if (clave %in% .ecr_sin_cruce) next
    cr <- explorador_cruce(datos, .ecr_vars[[tx]], .ecr_vars[[ty]], inst)
    expect_identical(cr$tipo_x, tx, info = clave)
    expect_identical(cr$tipo_y, ty, info = clave)
    expect_identical(c(cr$grafico, cr$forma), .ecr_esperado[[clave]], info = clave)
    expect_identical(names(cr), c("tipo_x", "tipo_y", "grafico", "forma", "base_n", "n_x", "n_y", cr$forma), info = clave)
    expect_true(is.integer(cr$base_n) && cr$base_n > 0L, info = clave)
  }
  expect_setequal(names(.explorador_cruces_catalogo()), names(.ecr_esperado))
  expect_length(.explorador_cruces_catalogo(), 18L)
})

test_that("una abierta con algo que no es una única no se cruza: 400 con la limitación dicha", {
  datos <- .ecr_data(); inst <- .ecr_inst()
  inst$survey <- rbind(inst$survey, transform(inst$survey[8, ], name = "otra", label = "Otra abierta"))
  datos$otra <- datos$comentario
  vars <- c(.ecr_vars, texto2 = "otra")
  for (clave in .ecr_sin_cruce) {
    tipos <- strsplit(clave, "_", fixed = TRUE)[[1]]
    vy <- if (identical(tipos, c("texto", "texto"))) "otra" else .ecr_vars[[tipos[2]]]
    err <- tryCatch(explorador_cruce(datos, .ecr_vars[[tipos[1]]], vy, inst), error = function(e) e)
    expect_s3_class(err, "api_error")
    expect_equal(err$status, 400, info = clave)
    expect_identical(err$code, "E_EXPLORAR_CRUCE_NO_SE_OFRECE", info = clave)
    expect_match(conditionMessage(err), "sólo con una pregunta de selección única", info = clave)
  }
})

test_that("so × so: tabla de calor cuyas filas suman su marginal y el total suma la base", {
  cr <- explorador_cruce(.ecr_data(), "sexo", "satis", .ecr_inst())
  t <- cr$tabla
  expect_identical(vapply(t$filas, `[[`, "", "etiqueta"), c("Hombre", "Mujer", "9"))
  expect_identical(vapply(t$columnas, `[[`, "", "etiqueta"),
                   c("Nada satisfecho", "Poco satisfecho", "Algo satisfecho", "Muy satisfecho"))
  expect_identical(dim(t$n), c(3L, 4L))
  expect_identical(sum(t$n), cr$base_n)
  expect_equal(colSums(t$n), vapply(t$columnas, `[[`, 1L, "n"))
  expect_identical(t$n[1, ], c(1L, 1L, 1L, 2L))   # Hombre: filas 1, 3, 5, 7, 11
  j <- jsonlite::fromJSON(as.character(jsonlite::toJSON(cr, auto_unbox = TRUE, na = "null")), simplifyVector = FALSE)
  expect_identical(length(j$tabla$n), 3L)          # n[fila][col]
  expect_identical(length(j$tabla$n[[1]]), 4L)
})

test_that("so × sm y sm × so: n = cuántos de la fila marcan la opción; columnas[].n = n de cada opción", {
  cr <- explorador_cruce(.ecr_data(), "sexo", "medios", .ecr_inst())
  t <- cr$tabla
  expect_identical(vapply(t$columnas, `[[`, "", "codigo"), c("tv", "radio", "web", "otro", "cine"))
  expect_identical(vapply(t$columnas, `[[`, 1L, "n"), c(6L, 4L, 4L, 2L, 1L))
  expect_equal(colSums(t$n), vapply(t$columnas, `[[`, 1L, "n"))
  expect_identical(t$n[1, 1], 4L)                  # hombres que marcan tv: filas 1, 3, 7, 11
  inv <- explorador_cruce(.ecr_data(), "medios", "sexo", .ecr_inst())
  expect_identical(vapply(inv$tabla$filas, `[[`, "", "codigo"), c("tv", "radio", "web", "otro", "cine"))
  expect_identical(inv$tabla$n, t(t$n))
  co <- explorador_cruce(.ecr_data(), "medios", "medios", .ecr_inst())
  expect_identical(diag(co$tabla$n), vapply(co$tabla$columnas, `[[`, 1L, "n"))   # la diagonal es lo que marca cada una
})

test_that("cajas: por categoría suman la base; fecha en días desde la mínima; diferencia de fechas en un grupo", {
  cr <- explorador_cruce(.ecr_data(), "sexo", "edad", .ecr_inst())
  g <- cr$cajas$grupos
  expect_identical(names(g[[1]]), c("etiqueta", "n", "min", "p25", "mediana", "p75", "max", "n_atipicos"))
  expect_identical(sum(vapply(g, `[[`, 1L, "n")), cr$base_n)
  expect_identical(g[[1]]$etiqueta, "Hombre")
  expect_identical(g[[1]]$max, 150)
  expect_identical(g[[1]]$n_atipicos, 1L)
  inv <- explorador_cruce(.ecr_data(), "edad", "sexo", .ecr_inst())
  expect_identical(inv$cajas, cr$cajas)
  fd <- explorador_cruce(.ecr_data(), "fecha", "sexo", .ecr_inst())
  expect_identical(min(vapply(fd$cajas$grupos, `[[`, 1, "min")), 0)
  expect_identical(fd$cajas$origen, format(min(as.Date(.ecr_data()$fecha), na.rm = TRUE), "%Y-%m-%d"))   # el día cero, para rotular fechas
  expect_null(cr$cajas$origen)
  datos <- .ecr_data(); datos$fecha2 <- as.character(as.Date(datos$fecha) + 3)
  inst <- .ecr_inst()
  inst$survey <- rbind(inst$survey, transform(inst$survey[7, ], name = "fecha2", label = "Fecha de cierre"))
  ff <- explorador_cruce(datos, "fecha", "fecha2", inst)
  expect_length(ff$cajas$grupos, 1L)
  expect_identical(ff$cajas$grupos[[1]]$mediana, 3)
})

test_that("dispersión: tendencia por mínimos cuadrados con todos los casos y a lo más 3000 puntos, sin tocar el RNG", {
  n <- 5000L
  x <- seq_len(n)
  datos <- data.frame(edad = x, edad2 = 2 * x + 5)
  inst <- .ecr_inst()
  inst$survey <- rbind(inst$survey, transform(inst$survey[6, ], name = "edad2", label = "Doble"))
  set.seed(1); antes <- .Random.seed
  cr <- explorador_cruce(datos, "edad", "edad2", inst)
  expect_identical(.Random.seed, antes)
  expect_identical(cr$dispersion$n, n)
  expect_identical(dim(cr$dispersion$puntos), c(3000L, 2L))
  expect_equal(cr$dispersion$tendencia$pendiente, 2)
  expect_equal(cr$dispersion$tendencia$intercepto, 5)
  expect_identical(explorador_cruce(datos, "edad", "edad2", inst)$dispersion$puntos, cr$dispersion$puntos)
  fx <- explorador_cruce(.ecr_data(), "fecha", "edad", .ecr_inst())
  expect_identical(min(fx$dispersion$puntos[, 1]), 0)
  expect_match(fx$dispersion$origen, "^\\d{4}-\\d{2}-\\d{2}$")
  expect_null(cr$dispersion$origen)
})

test_that("serie: casos por día apilados suman la base; % que marca por día; mediana con p25/p75", {
  cr <- explorador_cruce(.ecr_data(), "sexo", "fecha", .ecr_inst())
  p <- cr$serie$puntos
  expect_identical(names(p[[1]]), c("fecha", "valor", "baja", "alta", "serie", "n"))
  expect_identical(sum(vapply(p, function(z) as.numeric(z$valor), 1)), as.numeric(cr$base_n))
  expect_setequal(unique(vapply(p, `[[`, "", "serie")), c("Hombre", "Mujer", "9"))
  sm <- explorador_cruce(.ecr_data(), "medios", "fecha", .ecr_inst())
  tv1 <- Filter(function(z) z$serie == "Televisión" && z$fecha == "2026-10-01", sm$serie$puntos)[[1]]
  expect_equal(tv1$valor, 50)   # el 1/10 responden dos y uno marca tv
  expect_identical(tv1$n, 2L)   # …y esos dos son el denominador del día
  md <- explorador_cruce(.ecr_data(), "edad", "fecha", .ecr_inst())
  d1 <- md$serie$puntos[[1]]
  expect_identical(d1$fecha, "2026-10-01")
  expect_equal(d1$valor, 28)
  expect_true(d1$baja <= d1$valor && d1$valor <= d1$alta)
  expect_true(is.na(d1$serie))
  expect_true(is.integer(d1$n) && d1$n >= 1L)
})

test_that("lista: la abierta agrupada por las categorías de la única; máximo 20 grupos y 15 respuestas agrupadas", {
  cr <- explorador_cruce(.ecr_data(), "sexo", "comentario", .ecr_inst())
  g <- cr$lista$grupos
  expect_identical(names(g[[1]]), c("etiqueta", "respuestas"))
  expect_identical(g[[1]]$etiqueta, "Hombre")
  expect_identical(g[[1]]$respuestas[[1]], list(texto = "Regular", n = 2L))   # Hombre: filas 1, 3, 5, 7, 11
  inv <- explorador_cruce(.ecr_data(), "comentario", "sexo", .ecr_inst())
  expect_identical(inv$lista, cr$lista)
  n <- 600L
  muchos <- data.frame(
    comentario = sprintf("Texto %02d", (seq_len(n) %% 30L)),
    grupo = sprintf("g%02d", (seq_len(n) %% 25L)),
    stringsAsFactors = FALSE
  )
  inst <- .ecr_inst()
  inst$survey <- rbind(inst$survey, transform(inst$survey[2, ], name = "grupo", list_name = "grupo", label = "Grupo"))
  inst$choices <- rbind(inst$choices, data.frame(list_name = "grupo", name = sprintf("g%02d", 0:24), label = sprintf("Grupo %02d", 0:24)))
  tt <- explorador_cruce(muchos, "comentario", "grupo", inst)
  expect_identical(tt$grafico, "Respuestas por categoría")
  expect_length(tt$lista$grupos, 20L)
  expect_true(all(vapply(tt$lista$grupos, function(z) length(z$respuestas) <= 15L, logical(1))))
})

test_that("filas[].n y columnas[].n cuentan CASOS de la base, no menciones (E8b–d, revisión metodológica)", {
  d <- .ecr_data(); inst <- .ecr_inst()
  # so × sm: cada categoría cuenta sus casos que responden la múltiple; suman la base.
  cr <- explorador_cruce(d, "sexo", "medios", inst)
  filas_n <- vapply(cr$tabla$filas, `[[`, 1L, "n")
  ok <- !is.na(d$sexo) & rowSums(d[, grep("^medios\\.", names(d))], na.rm = TRUE) > 0
  expect_identical(filas_n, c(as.integer(sum(ok & d$sexo == "1")), as.integer(sum(ok & d$sexo == "2")),
                              as.integer(sum(ok & d$sexo == "9"))))
  expect_identical(sum(filas_n), cr$base_n)
  # El código fuera de lista (9) es una fila legítima, dentro de la base.
  expect_true("9" %in% vapply(cr$tabla$filas, `[[`, "", "codigo"))
  # Con la múltiple en columnas, la suma de celdas de una fila NO es su n (un caso marca varias).
  expect_false(identical(as.integer(rowSums(cr$tabla$n)), filas_n))
  # sm × so: la fila es cuántos casos de la base marcan la opción = colSums de las dummies dentro de la base.
  inv <- explorador_cruce(d, "medios", "sexo", inst)
  mat <- as.matrix(d[ok, c("medios.tv", "medios.radio", "medios.web", "medios.otro", "medios.cine")])
  expect_identical(vapply(inv$tabla$filas, `[[`, 1L, "n"), as.integer(colSums(mat)))
  # Con y única, filas.n coincide con la suma de celdas.
  expect_identical(vapply(inv$tabla$filas, `[[`, 1L, "n"), as.integer(rowSums(inv$tabla$n)))
  # n_x / n_y: los que responden cada una por separado, con los mismos filtros.
  expect_identical(cr$n_x, as.integer(sum(!is.na(d$sexo))))
  expect_identical(cr$n_y, as.integer(sum(rowSums(d[, grep("^medios\\.", names(d))], na.rm = TRUE) > 0)))
})

test_that("una categoría sin casos en la base se omite y una base vacía no rompe la tabla", {
  d <- .ecr_data(); inst <- .ecr_inst()
  cr <- explorador_cruce_filtrado(d, "satis", "sexo", inst, filtros = list(satis = list("4")))
  expect_identical(vapply(cr$tabla$filas, `[[`, "", "codigo"), "4")
  vacio <- explorador_cruce(d[0, , drop = FALSE], "sexo", "medios", inst)
  expect_identical(vacio$base_n, 0L)
  expect_length(vacio$tabla$filas, 0L)
})

test_that("los filtros del explorador se aplican al cruce igual que a la vista", {
  cr <- explorador_cruce_filtrado(.ecr_data(), "sexo", "satis", .ecr_inst(), filtros = list(sexo = list("1")))
  expect_identical(cr$base_n, 5L)
  expect_length(cr$tabla$filas, 1L)
})

test_that("POST /explorar/bivariado suma `cruce` sin quitar `view`, sobre la base pedida", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  datos <- .ecr_data()
  for (nm in c("primera", "segunda")) {
    d <- if (nm == "primera") datos else datos[1:6, , drop = FALSE]
    estudio_add_base(sid, nombre = nm, xlsform_file_id = paste0("x-", nm), data_file_id = paste0("d-", nm),
                     data_ext = "xlsx", rp_data = d, rp_inst = .ecr_inst())
  }
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err)) |>
    mount_validacion()
  body <- '{"var_x":"sexo","var_y":"fecha","fuente":"raw"}'
  raw_body <- charToRaw(body)
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  r <- pr$call(as.environment(list(
    REQUEST_METHOD = "POST", PATH_INFO = "/api/validacion/v2/explorar/bivariado", QUERY_STRING = "",
    CONTENT_TYPE = "application/json", HTTP_X_PULSO_SESSION = sid, HTTP_X_BASE_NOMBRE = "segunda",
    rook.input = input
  )))
  j <- jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)
  expect_identical(as.integer(r$status), 200L)
  expect_false(is.null(j$view))
  expect_identical(j$cruce$forma, "serie")
  expect_identical(j$cruce$grafico, "Casos por día, apilados")
  expect_identical(j$cruce$base_n, 6L)
  expect_null(j$cruce$serie$puntos[[1]]$baja)
})

test_that("POST /explorar/bivariado rechaza cruzar una variable consigo misma", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_add_base(sid, nombre = "unica", xlsform_file_id = "x-u", data_file_id = "d-u",
                   data_ext = "xlsx", rp_data = .ecr_data(), rp_inst = .ecr_inst())
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    plumber::pr_set_error(function(req, res, err) handle_api_error(req, res, err)) |>
    mount_validacion()
  body <- '{"var_x":"medios","var_y":"medios","fuente":"raw"}'
  raw_body <- charToRaw(body)
  input <- list(read = function(...) raw_body, rewind = function() invisible(0), read_lines = function(...) body)
  r <- pr$call(as.environment(list(
    REQUEST_METHOD = "POST", PATH_INFO = "/api/validacion/v2/explorar/bivariado", QUERY_STRING = "",
    CONTENT_TYPE = "application/json", HTTP_X_PULSO_SESSION = sid, HTTP_X_BASE_NOMBRE = "unica",
    rook.input = input
  )))
  j <- jsonlite::fromJSON(as.character(r$body), simplifyVector = FALSE)
  expect_identical(as.integer(r$status), 400L)
  expect_identical(j$code %||% j$error$code, "E_EXPLORAR_CRUCE_MISMA_VARIABLE")
})
