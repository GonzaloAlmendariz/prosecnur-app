source("setup-load-all.R")

# G16 (Gonzalo, 2026-10-13: «Sí, vamos con matriz de cuadrantes»): cada tema con dos medidas que el estudio ya tiene; la
# app no calcula ninguna. Lámina 91 del recetario.
.mc_sources <- function() {
  n <- 100
  d1 <- data.frame(a = c(rep("4", 80), rep("1", 20)), b = c(rep("4", 30), rep("1", 70)), stringsAsFactors = FALSE)
  d2 <- data.frame(a = c(rep("4", 60), rep("1", 40)), b = c(rep("4", 90), rep("1", 10)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("a", "b"), type = "select_one esc", label = c("Pregunta A", "Pregunta B"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "esc", name = c("1", "4"), label = c("Nada", "Mucho"), stringsAsFactors = FALSE))
  list(data_sources = list(docentes = d1, estudiantes = d2), inst_sources = list(docentes = inst, estudiantes = inst))
}

test_that("cada medida se calcula en su base y la base de la lámina dice el n de cada una", {
  src <- .mc_sources()
  d <- .matriz_cuadrantes_datos(list(A = c("docentes$a", "estudiantes$a"), B = c("docentes$b", "estudiantes$b")), "4", "4", src)
  expect_equal(d$x, c(80, 30)); expect_equal(d$y, c(60, 90))
  expect_identical(.matriz_cuadrantes_base(d), "Base: 100 docentes y 100 estudiantes.")
  expect_identical(.matriz_cuadrantes_eje("Docentes", "docentes$a", "4", src), "Docentes · Mucho")
})

test_that("las líneas cortan en el promedio o en el valor declarado; los cuadrantes neutros salvo que se nombren", {
  d <- data.frame(tema = c("A", "B", "C"), x = c(80, 30, 60), y = c(60, 90, 20))
  e <- attr(graficar_matriz_cuadrantes(d), "pulso_espec")
  expect_equal(c(e$cx, e$cy), c(mean(d$x), mean(d$y)))
  expect_identical(e$cuadrante, c("arriba_der", "arriba_izq", "abajo_der"))
  expect_identical(e$nombres$arriba_der, "Altos en ambos")
  e2 <- attr(graficar_matriz_cuadrantes(d, linea_x = 50, linea_y = 50, nombres = list(arriba_izq = "Prioridad")), "pulso_espec")
  expect_equal(c(e2$cx, e2$cy), c(50, 50)); expect_identical(e2$nombres$arriba_izq, "Prioridad"); expect_identical(e2$linea, "valor")
})

test_that("el constructor pide dos preguntas por tema y las respuestas de cada indicador", {
  el <- p_matriz_cuadrantes(list(A = list("docentes$a", "estudiantes$a")), corte_x = list("4"), corte_y = "4,5")
  expect_identical(el$corte_y, "4,5"); expect_identical(el$destacado, "arriba_izq")
  expect_error(p_matriz_cuadrantes(list(A = "docentes$a"), "4", "4"), "dos preguntas")
  expect_error(p_matriz_cuadrantes(list(A = c("x$a", "y$a")), "", "4"), "respuestas")
  expect_error(p_matriz_cuadrantes(list(A = c("x$a", "y$a")), "4", "4", linea = "valor"), "dónde corta")
})

test_that("la lámina 91 sale en piezas: puntos, nombres de cuadrantes, lista del destacado; nombres que se pisan se avisan", {
  skip_if_not_installed("officer")
  d <- data.frame(tema = c("Salud", "Bienestar", "Cultura", "Trámites"), x = c(30, 80, 45, 60), y = c(85, 70, 40, 30))
  e <- attr(graficar_matriz_cuadrantes(d, eje_x = "Docentes", eje_y = "Estudiantes", nombre_x = "Docentes", nombre_y = "Estudiantes"), "pulso_espec")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp") %||% "")
  skip_if(length(doc) < 0)
  avisos <- character(0)
  o <- withCallingHandlers(.lam_laminas_cuadrantes(doc, e, titulo = "Matriz"), message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  x <- paste(readLines(unz(out, sprintf("ppt/slides/slide%d.xml", length(o$doc))), warn = FALSE), collapse = "")
  expect_match(x, 'name="prosecnur:grafico:cuadrantes"', fixed = TRUE)
  expect_match(x, "Altos en ambos", fixed = TRUE)
  expect_match(x, ">Salud<", fixed = TRUE)
  expect_false(any(grepl("se pisan", avisos)))
  # Nombres largos y puntos juntos: alguno no encuentra lugar libre y la lámina lo avisa (no se acortan solos).
  largos <- data.frame(tema = paste("Estoy satisfecho(a) con la calidad del servicio número", 1:6), x = 50:55, y = 50:55)
  e3 <- attr(graficar_matriz_cuadrantes(largos), "pulso_espec")
  px <- function(v) 1.2 + 7.2 * (v - e3$lim_x[1]) / diff(e3$lim_x); py <- function(v) 2.1 + 3.7 * (e3$lim_y[2] - v) / diff(e3$lim_y)
  u <- .lam_cuadrantes_rotulos(e3, px, py, 1.2, 7.2, 2.1, 3.7)
  expect_true(any(vapply(u, function(r) r$choques > 0, logical(1))))
})
