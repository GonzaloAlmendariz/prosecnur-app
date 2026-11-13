# Títulos de las sugeridas por contenido (ítem 51B): la etiqueta corta de la
# pregunta, el número de pregunta para una batería, sin formatos entre
# paréntesis y con el código solo como dato secundario. Formularios inventados.

source("setup-load-all.R")

set.seed(512)

.st_survey <- function(filas) {
  d <- do.call(rbind, lapply(filas, function(f) data.frame(
    type = f[[1]], name = f[[2]], label = f[[3]], stringsAsFactors = FALSE)))
  d$type_base <- sub("\\s.*$", "", d$type)
  d$list_name <- ifelse(grepl("^select_", d$type), sub("^\\S+\\s+", "", d$type), "")
  d
}

.st_escala <- function(lista, n = 5) {
  rbind(data.frame(list_name = lista, name = as.character(seq_len(n)), label = paste("Grado", seq_len(n))),
        data.frame(list_name = lista, name = "88", label = "No aplica"))
}

test_that("la etiqueta de una columna pierde el formato entre paréntesis", {
  s <- .st_survey(list(
    list("text", "f1", "Fecha (dd.mm.aaaa)"),
    list("text", "f2", "Fecha de supervisión de mesa (dd.mm.aa)"),
    list("text", "h1", "Hora de inicio (hh.mm)"),
    list("text", "z1", "Dirección (calle y número)")))
  expect_identical(.semilla_nombrar_var("f1", s), "Fecha")
  expect_identical(.semilla_nombrar_var("f2", s), "Fecha de supervisión de mesa")
  expect_identical(.semilla_nombrar_var("h1", s), "Hora de inicio")
  # Un paréntesis que no es un formato se conserva.
  expect_identical(.semilla_nombrar_var("z1", s), "Dirección (calle y número)")
})

test_that("una batería se nombra por el número de pregunta del cuestionario, no por sus códigos", {
  n <- 60
  m <- matrix(sample(as.character(1:5), n * 10, replace = TRUE), n, 10)
  m[1:6, ] <- "3"
  d <- as.data.frame(m, stringsAsFactors = FALSE); names(d) <- sprintf("q29_%d", 1:10)
  s <- .st_survey(lapply(seq_along(names(d)), function(i)
    list("select_one esc", names(d)[i], sprintf("P29.%d Enunciado del ítem %d", i, i))))
  p <- reglas_semilla_baterias(d, s, .st_escala("esc"))
  p <- Filter(function(x) identical(x$semilla$origen, "bateria_iguales"), p)[[1]]
  expect_identical(p$nombre, "Misma respuesta en P29, ítems 1 a 10")
  expect_false(grepl("q29_", p$nombre))
  expect_false(grepl("q29_", p$mensaje))
  # El código queda como dato secundario: la tarjeta lo muestra aparte.
  expect_match(p$semilla$porque, "^P29, ítems 1 a 10 comparten")
  expect_false(grepl("q29_", p$semilla$porque))
})

test_that("un bloque No aplica que cruza preguntas se nombra de la primera a la última", {
  n <- 60
  m <- matrix(sample(as.character(1:5), n * 6, replace = TRUE), n, 6)
  m[1:12, ] <- "88"
  m[13:14, 1:5] <- "88"; m[13:14, 6] <- "2"
  d <- as.data.frame(m, stringsAsFactors = FALSE)
  names(d) <- c("a11_1", "a11_2", "a12_1", "a12_2", "a13_1", "a13_2")
  etq <- c("P11.1 x", "P11.2 x", "P12.1 x", "P12.2 x", "P13.1 x", "P13.2 x")
  s <- .st_survey(lapply(1:6, function(i) list("select_one esc", names(d)[i], etq[i])))
  p <- reglas_semilla_baterias(d, s, .st_escala("esc"))
  p <- Filter(function(x) identical(x$semilla$origen, "bateria_no_aplica"), p)[[1]]
  expect_identical(p$nombre, "No aplica a medias en P11.1 a P13.2")
  expect_false(grepl("a11_", p$nombre))
})

test_that("las fechas se nombran por su etiqueta sin el formato", {
  f1 <- as.Date("2026-10-01") + sample(0:20, 40, replace = TRUE)
  f2 <- f1; f2[1:2] <- f2[1:2] + 3
  f3 <- f1 + sample(1:4, 40, replace = TRUE); f3[3:4] <- f1[3:4] - 2
  d <- data.frame(alfa = format(f1, "%d.%m.%Y"), beta = format(f2, "%d.%m.%Y"),
                  gama = format(f3, "%d.%m.%y"), stringsAsFactors = FALSE)
  s <- .st_survey(list(list("text", "alfa", "Fecha (dd.mm.aaaa)"),
                       list("text", "beta", "Fecha de entrevista (dd.mm.aaaa)"),
                       list("text", "gama", "Fecha de supervisión de mesa (dd.mm.aa)")))
  props <- reglas_semilla_fechas_pares(d, s)
  nom <- vapply(props, `[[`, "", "nombre")
  expect_true("Fecha y fecha de entrevista deben ser iguales" %in% nom)
  expect_true("Fecha de supervisión de mesa antes que fecha de entrevista" %in% nom)
  expect_false(any(grepl("[()]", nom)))
  ig <- Filter(function(x) identical(x$semilla$origen, "fechas_iguales"), props)[[1]]
  expect_match(ig$semilla$porque, "^Fecha y fecha de entrevista coinciden")
})

test_that("el lugar fuera del catálogo nombra el lugar por su etiqueta, con el prefijo común una vez", {
  lugares <- data.frame(ub = c("150110", "150128", "150132", "150101"),
                        di = c("COMAS", "RIMAC", "SAN JUAN DE LURIGANCHO", "LIMA"), stringsAsFactors = FALSE)
  k <- rep(1:4, each = 10)
  d <- data.frame(cod_lugar = lugares$ub[k], nom_lugar = lugares$di[k], stringsAsFactors = FALSE)
  s <- .st_survey(list(list("text", "cod_lugar", "Ubigeo del distrito"), list("text", "nom_lugar", "Distrito")))
  p <- Filter(function(x) identical(x$semilla$origen, "lugar_catalogo"), reglas_semilla_lugar(d, s))[[1]]
  expect_match(p$nombre, "^Lugar fuera del catálogo de ubigeos: (distrito y ubigeo del distrito|ubigeo del distrito y distrito)$")
  expect_false(grepl("_lugar", p$nombre))
  expect_identical(.semilla_nombrar_lista(c("a", "b", "c"), .st_survey(list(
    list("text", "a", "P1. Lugar de nacimiento: región"),
    list("text", "b", "P1. Lugar de nacimiento: provincia"),
    list("text", "c", "P1. Lugar de nacimiento: distrito")))),
    "lugar de nacimiento (región, provincia y distrito)")
})

test_that("el aviso de variantes nombra la columna por su etiqueta", {
  d <- data.frame(lugar = c(rep("COMAS", 30), "COMAs", rep("LIMA", 20)), stringsAsFactors = FALSE)
  pregs <- data.frame(name = "lugar", rotulo = "Distrito", tipo = "text", stringsAsFactors = FALSE)
  s <- .vdc_variantes(d, "lugar", pregs)
  expect_identical(s$titulo, "Un mismo valor escrito de otra forma en distrito")
  expect_match(s$texto, "de distrito solo difiere", fixed = TRUE)
  s0 <- .vdc_variantes(d, "lugar", NULL)
  expect_identical(s0$titulo, "Un mismo valor escrito de otra forma en lugar")
})
