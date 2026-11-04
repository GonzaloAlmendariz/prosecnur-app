source("setup-load-all.R")

# Tarjetas de diferencias (ADR 0129, propuesta P08 aprobada el 2026-11-03): selección y orden, los dos niveles, el tope
# de 6, la geometría del panel del PPT (1 y 2 columnas), la disposición del Word (par e impar) y los artefactos.

# ---- Fixtures --------------------------------------------------------------------------------------------------------

# Una prueba normalizada (lo que devuelve `.tarjetas_evaluar_cruce`): el grupo que difiere y si sube.
.tj_prueba <- function(cruce, fila, grupo, sube = TRUE, fragil = FALSE, dif = 20) {
  data.frame(cruce = cruce, fila = fila, grupo = grupo, sube = sube, fragil = fragil, dif = dif, p_ajustado = if (fragil) 0.03 else 0.001,
             stringsAsFactors = FALSE)
}
.tj_grupos <- data.frame(cruce = c("area", "area", "nivel", "nivel", "nivel", "nivel", "sexo", "sexo"),
                         codigo = c("1", "2", "6", "7", "8", "9", "1", "2"),
                         etiqueta = c("Economía y Finanzas", "Ciencias políticas y sociales", "Nivel 6", "Nivel 7", "Nivel 8",
                                      "Nivel 9", "Mujer", "Hombre"), n = 50, stringsAsFactors = FALSE)
.tj_celdas <- function(filas) {
  do.call(rbind, lapply(filas, function(f) data.frame(cruce = .tj_grupos$cruce, fila = f, grupo = .tj_grupos$codigo,
                                                        p = seq(10, 80, length.out = nrow(.tj_grupos)), n = 50,
                                                        stringsAsFactors = FALSE)))
}
.tj_tarjeta <- function(fila = "Trabajaré en una empresa privada", fragil = FALSE, n_grupos = 2L) {
  list(cruce = "area", fila = fila, total = 35, cifra_total = "35%", fragil = fragil, brecha = 39,
       grupos = data.frame(codigo = as.character(seq_len(n_grupos)), etiqueta = c("Econ. y Finanzas", "CC. Pol. y Soc.", "Nivel 8")[seq_len(n_grupos)],
                           p = c(52, 13, 30)[seq_len(n_grupos)], dir = c("up", "down", "down")[seq_len(n_grupos)], fragil = fragil,
                           stringsAsFactors = FALSE))
}

# Base sintética por aulas: 40 aulas de 10, el área se asigna por aula y «q» depende fuerte del área.
.tj_base <- function() {
  set.seed(129)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  area <- ifelse(as.integer(sub("a", "", aula)) <= 20, "1", "2")
  nivel <- rep(rep(c("6", "7", "8", "9"), each = 10), times = 10)
  sexo <- rep(c("1", "2"), 200)
  p_si <- ifelse(area == "1", 0.75, 0.2)
  q <- ifelse(stats::runif(400) < p_si, "1", ifelse(stats::runif(400) < 0.5, "2", "3"))
  data.frame(aula = aula, area = area, nivel = nivel, sexo = sexo, q = q, stringsAsFactors = FALSE)
}
.tj_regla <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  r
}

# ---- Opción de la lámina ---------------------------------------------------------------------------------------------

test_that("la lámina pide tarjetas con TRUE o con una lista; FALSE o activo = FALSE no las pide", {
  expect_null(.tarjetas_opcion(list()))
  expect_null(.tarjetas_opcion(list(tarjetas_diferencias = FALSE)))
  expect_null(.tarjetas_opcion(list(tarjetas_diferencias = list(activo = FALSE))))
  o <- .tarjetas_opcion(list(tarjetas_diferencias = TRUE))
  expect_identical(o$max, 6L)
  o <- .tarjetas_opcion(list(tarjetas_diferencias = list(max = 4, cortos = list(`Economía y Finanzas` = "Econ. y Finanzas"),
                                                          rotulos = list(area = "Área"), publico = "estudiantes")))
  expect_identical(o$max, 4L)
  expect_identical(unname(o$cortos[["Economía y Finanzas"]]), "Econ. y Finanzas")
  expect_identical(o$publico, "estudiantes")
})

# ---- Selección y orden -----------------------------------------------------------------------------------------------

test_that("múltiple: una tarjeta por (opción, cruce); primero las del 99% y después de mayor a menor diferencia", {
  pr <- rbind(.tj_prueba("area", "A", "1", dif = 15), .tj_prueba("sexo", "A", "2", fragil = TRUE, dif = 30),
              .tj_prueba("area", "B", "2", dif = 40), .tj_prueba("nivel", "C", "7", sube = FALSE, fragil = TRUE, dif = 12))
  t <- .tarjetas_seleccionar(pr, .tj_celdas(c("A", "B", "C")), .tj_grupos, c(A = 30, B = 20, C = 10), "multiple",
                             c("area", "nivel", "sexo"))
  expect_length(t, 4L)
  expect_identical(vapply(t, function(x) paste(x$cruce, x$fila), ""), c("area B", "area A", "sexo A", "nivel C"))
  expect_identical(vapply(t, `[[`, logical(1), "fragil"), c(FALSE, FALSE, TRUE, TRUE))
})

test_that("con dos grupos se muestran los dos con ▲ y ▼; con más, solo los que difieren", {
  pr <- rbind(.tj_prueba("area", "A", "2"), .tj_prueba("nivel", "A", "9", sube = FALSE))
  t <- .tarjetas_seleccionar(pr, .tj_celdas("A"), .tj_grupos, c(A = 30), "multiple", c("area", "nivel"))
  area <- t[[1]]$grupos
  expect_setequal(area$codigo, c("1", "2"))
  expect_identical(area$dir[area$codigo == "2"], "up")
  expect_identical(area$dir[area$codigo == "1"], "down")
  expect_identical(t[[2]]$grupos$codigo, "9")
  expect_identical(t[[2]]$grupos$dir, "down")
  # Los grupos van de mayor a menor proporción.
  expect_true(all(diff(area$p) <= 0))
})

test_that("dicotómica: solo la opción principal genera tarjeta", {
  pr <- rbind(.tj_prueba("area", "Sí", "1"), .tj_prueba("sexo", "No", "2"))
  t <- .tarjetas_seleccionar(pr, .tj_celdas(c("Sí", "No")), .tj_grupos, c(`Sí` = 40, No = 60), "dicotomica",
                             c("area", "sexo"), filas_visibles = c("Sí", "No"))
  expect_length(t, 1L)
  expect_identical(t[[1]]$fila, "Sí")
})

test_that("opción única: una tarjeta por cruce con la categoría de mayor diferencia; otra solo si trae un grupo nuevo", {
  pr <- rbind(.tj_prueba("nivel", "4 o más", "6", dif = 25), .tj_prueba("nivel", "4 o más", "9", sube = FALSE, dif = 38),
              .tj_prueba("nivel", "3 veces", "9", dif = 20),          # mismo grupo ya cubierto: espejo, no genera tarjeta
              .tj_prueba("nivel", "2 veces", "7", dif = 15),          # grupo nuevo: genera tarjeta
              .tj_prueba("area", "4 o más", "1", dif = 29), .tj_prueba("area", "3 veces", "2", dif = 19))
  t <- .tarjetas_seleccionar(pr, .tj_celdas(c("4 o más", "3 veces", "2 veces")), .tj_grupos,
                             c(`4 o más` = 81, `3 veces` = 12, `2 veces` = 5), "opcion_unica", c("nivel", "area"))
  claves <- vapply(t, function(x) paste(x$cruce, x$fila), "")
  expect_setequal(claves, c("nivel 4 o más", "nivel 2 veces", "area 4 o más", "area 3 veces"))
  expect_false("nivel 3 veces" %in% claves)
})

# ---- Dos niveles, definidos solo por p -------------------------------------------------------------------------------

test_that("el nivel lo define solo el p: una diferencia de 10 a 12 puntos con p < 0.01 sigue al 99% (sin el criterio de 12)", {
  pr <- .tj_prueba("area", "A", "1", fragil = FALSE, dif = 10.5)
  t <- .tarjetas_seleccionar(pr, .tj_celdas("A"), .tj_grupos, c(A = 30), "multiple", "area")
  expect_false(t[[1]]$fragil)
  expect_false(any(t[[1]]$grupos$fragil))
})

test_that("una tarjeta mezcla niveles por grupo y solo es punteada si todas sus diferencias son del 95%", {
  pr <- rbind(.tj_prueba("nivel", "A", "6", fragil = FALSE), .tj_prueba("nivel", "A", "7", fragil = TRUE))
  t <- .tarjetas_seleccionar(pr, .tj_celdas("A"), .tj_grupos, c(A = 30), "multiple", "nivel")
  expect_false(t[[1]]$fragil)
  expect_identical(t[[1]]$grupos$fragil[t[[1]]$grupos$codigo == "7"], TRUE)
})

test_that("la evaluación usa la prueba de diseño frente al resto y normaliza el cruce de dos grupos al mayor", {
  d <- .tj_base()
  fuente <- list(data = d, survey = NULL, choices = NULL, orders_list = NULL)
  ev <- .tarjetas_evaluar_cruce(fuente, "q", "area", .tj_regla(), familia = NULL, filas = "1")
  expect_s3_class(ev$pruebas, "data.frame")
  expect_identical(nrow(ev$pruebas), 1L)       # dos grupos: una sola prueba
  expect_identical(ev$pruebas$grupo, "1")       # atribuida al mayor
  expect_true(ev$pruebas$sube)
  expect_gte(ev$pruebas$dif, 10)
  # Los dos niveles salen del p ajustado: con este efecto, el 99%.
  expect_false(ev$pruebas$fragil)
  # Con una familia enorme el mismo p cae al nivel del 95% o deja de marcarse; nunca sube.
  fam <- .sig_bh_tabla(c(ev$pruebas$p_ajustado, rep(0.5, 2000)))
  ev2 <- .tarjetas_evaluar_cruce(fuente, "q", "area", .tj_regla(), familia = fam, filas = "1")
  expect_true(nrow(ev2$pruebas) == 0L || ev2$pruebas$fragil || ev2$pruebas$p_ajustado >= ev$pruebas$p_ajustado)
})

test_that("con «fragiles = ocultar» las diferencias del 95% no generan tarjeta", {
  d <- .tj_base()
  fuente <- list(data = d, survey = NULL, choices = NULL, orders_list = NULL)
  r <- .tj_regla(); r$fragiles <- "ocultar"
  fam <- .sig_bh_tabla(c(seq(0.0001, 0.02, length.out = 50), rep(0.6, 400)))
  ev <- .tarjetas_evaluar_cruce(fuente, "q", "area", r, familia = fam, filas = "1")
  expect_false(any(ev$pruebas$fragil))
})

# ---- Tope de 6 -------------------------------------------------------------------------------------------------------

test_that("con más de seis diferencias se dibujan las seis principales y se informa el total", {
  # Opción única de tres categorías: por cruce, la de mayor diferencia y otra que trae el otro grupo (dos por cruce).
  d <- .tj_base()
  for (k in 1:8) d[[paste0("c", k)]] <- d$area
  fuente <- list(data = d, survey = NULL, choices = NULL, orders_list = NULL)
  sig <- list(regla = .tj_regla(), familia = NULL, cruces = paste0("c", 1:8))
  r <- .tarjetas_calcular(fuente, "q", .tarjetas_opcion(list(tarjetas_diferencias = TRUE)), list(tipo = "categorica"), sig)
  expect_identical(r$total, 16L)
  expect_length(r$tarjetas, 6L)
  r4 <- .tarjetas_calcular(fuente, "q", .tarjetas_opcion(list(tarjetas_diferencias = list(max = 4))), list(tipo = "categorica"), sig)
  expect_length(r4$tarjetas, 4L)
})

# ---- Geometría del PPT -----------------------------------------------------------------------------------------------

test_that("PPT: hasta 4 tarjetas, una columna de 1/3 del ancho útil; con 5 o 6, dos columnas en la mitad", {
  expect_identical(vapply(1:6, .tarjetas_columnas_ppt, integer(1)), c(1L, 1L, 1L, 1L, 2L, 2L))
  g <- .std_geom; util <- g("ancho") - g("margen_izq") - g("margen_der")
  L3 <- .lam_tarjetas_disponer(rep(list(.tj_tarjeta()), 3), 1.4, 6.7)
  expect_identical(L3$cols, 1L)
  expect_equal(L3$wp, util / 3)
  expect_equal(L3$xp + L3$wp, g("ancho") - g("margen_der"))
  L6 <- .lam_tarjetas_disponer(rep(list(.tj_tarjeta()), 6), 1.4, 6.7)
  expect_identical(L6$cols, 2L)
  expect_equal(L6$wp, util / 2)
  expect_true(L6$cabe)
  # Las cajas no se pisan y quedan dentro de la zona.
  cajas <- L6$cajas
  expect_true(all(vapply(cajas, function(b) b$t >= 1.4 - 1e-9 && b$t + b$h <= 6.7 + 1e-9, logical(1))))
  expect_lt(cajas[[1]]$l + cajas[[1]]$w, cajas[[2]]$l)
})

# ---- Disposición del Word --------------------------------------------------------------------------------------------

test_that("Word: una a todo el ancho; dos a la mitad; con número impar, la principal sola y las demás de a dos", {
  expect_identical(.tarjetas_filas_word(1), list(1L))
  expect_identical(.tarjetas_filas_word(2), list(1:2))
  expect_identical(.tarjetas_filas_word(3), list(1L, 2:3))
  expect_identical(.tarjetas_filas_word(4), list(1:2, 3:4))
  expect_identical(.tarjetas_filas_word(5), list(1L, 2:3, 4:5))
  W <- 6.27
  L <- .word_tarjetas_disponer(rep(list(.tj_tarjeta()), 3), W)
  z <- .WORD_TARJETAS_ZOOM
  expect_equal(L$cajas[[1]]$w * z, W)
  expect_equal((L$cajas[[2]]$w + L$cajas[[3]]$w) * z + .WORD_TARJETAS_SEP, W)
  expect_equal(L$cajas[[2]]$t, L$cajas[[3]]$t)
})

# ---- Artefactos ------------------------------------------------------------------------------------------------------

test_that("la lámina del PPT lleva el total y el panel como grupos nativos, con borde punteado en la del 95%", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  espec <- list(tipo = "categorica", rotulos = c("Trabajaré en una empresa privada", "Otra"), largos = c(0.35, 0.02),
                cifras = c("35%", "2%"))
  p <- ggplot2::ggplot()
  attr(p, "pulso_espec") <- espec
  attr(p, "pulso_tarjetas") <- list(tarjetas = list(.tj_tarjeta(), .tj_tarjeta("Otra", fragil = TRUE)), total = 2L, tipo = "multiple",
                                    opcion = .tarjetas_opcion(list(tarjetas_diferencias = TRUE)),
                                    rotulos_cruce = c(area = "Área"))
  expect_true(.lam_tarjetas_aplica(p, list(meta = list())))
  expect_false(.lam_tarjetas_aplica(p, list(meta = list(motor_nativo = FALSE))))
  o <- .lam_laminas_tarjetas(doc, p, "¿Cuáles de las siguientes opciones…?", base = "Base: 400", folio = 3L)
  f <- tempfile(fileext = ".pptx"); print(o$doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "prosecnur:tarjetas_diferencias", fixed = TRUE)
  expect_match(xml, "prosecnur:grafico:total", fixed = TRUE)
  expect_match(xml, 'prstDash val="dash"', fixed = TRUE)
  expect_match(xml, "Econ", fixed = TRUE)
  expect_false(grepl("Nota significancia", xml, fixed = TRUE))   # sin nota por lámina: solo base y fuente
})

test_that("el Word dibuja las tarjetas en una imagen bajo la figura, del ancho del texto", {
  t <- list(tarjetas = list(.tj_tarjeta(), .tj_tarjeta("B"), .tj_tarjeta("C", fragil = TRUE)), tipo = "multiple",
            opcion = .tarjetas_opcion(list(tarjetas_diferencias = TRUE)), rotulos_cruce = c(area = "Área"))
  png <- .word_tarjetas_png(t, ancho = 6.27)
  expect_true(file.exists(png))
  expect_equal(attr(png, "ancho"), 6.27)
  dims <- dim(png::readPNG(as.character(png)))
  expect_equal(dims[2] / dims[1], 6.27 / attr(png, "alto"), tolerance = 0.02)
  expect_null(.word_tarjetas_png(list(tarjetas = list())))
  # La escala no se compacta; las barras sí.
  expect_equal(.word_tarjetas_alto_total(4, list(tarjetas = list(1), tipo = "bateria")), 4)
  expect_lt(.word_tarjetas_alto_total(4, list(tarjetas = list(1), tipo = "multiple")), 4)
})

test_that("la lectura (PPT y Word) sale de la regla del estudio, en prosa y sin «frágil»", {
  regla <- .tj_regla()
  lec <- list(tarjeta = .tj_tarjeta(), tipo = "multiple", rotulo_cruce = "Área", regla = regla, cruces = c("Área", "Nivel"),
              opcion = .tarjetas_opcion(list(tarjetas_diferencias = list(publico = "estudiantes"))),
              bases = list(list(cruce = "Área", grupos = c("Economía y Finanzas", "Ciencias políticas y sociales"), n = c(224, 176))))
  tx <- .tarjetas_textos_lectura(lec)
  expect_match(tx$frase_ppt, "al menos 10 puntos", fixed = TRUE)
  expect_match(tx$metodo_ppt, "Rao-Scott por aula", fixed = TRUE)
  expect_identical(tx$nivel_2, "95% de confianza")
  prosa <- paste(stats::na.omit(tx$parrafos_word), collapse = " ")
  expect_match(prosa, "Benjamini-Hochberg sobre el conjunto de comparaciones del informe", fixed = TRUE)
  expect_match(prosa, "Economía y Finanzas 224", fixed = TRUE)
  expect_false(grepl("fr[aá]gil", prosa))
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_tarjetas_lectura(doc, "Cómo leer las diferencias entre grupos", lec, "Graficos2", "Office Theme")
  f <- tempfile(fileext = ".pptx"); print(o$doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "CÓMO LEER ESTE INFORME", fixed = TRUE)
  expect_match(xml, "DIFERENCIA ENTRE GRUPOS", fixed = TRUE)
  expect_match(xml, ">39<", fixed = TRUE)
})

test_that("la leyenda de la escala reserva sus renglones y ninguno pasa del borde derecho", {
  rot <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
           "Totalmente de acuerdo", "No tengo información suficiente para responder")
  ley <- .lam_tarjetas_leyenda_disponer(rot, 3.5, 7.5)
  expect_gt(ley$renglones, 1L)
  expect_true(all(ley$x + 0.11 + ley$w <= 7.5 + 1e-9 | ley$x == 3.5))
  expect_identical(ley$renglon[1], 1L)
  expect_true(all(diff(ley$renglon) >= 0L))
})
