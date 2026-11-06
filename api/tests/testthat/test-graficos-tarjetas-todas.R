source("setup-load-all.R")

# Tarjetas de diferencias con la opción `todas` (ítem 23 de la v7 RV, extensión del ADR 0129): una tarjeta por cruce
# declarado con todos sus grupos comparables, aunque ninguna diferencia sea significativa. La flecha va solo donde la
# regla la da; los demás grupos van sin flecha y en el tono neutro; los no comparables no se muestran.

.tt_grupos <- data.frame(cruce = c("area", "area", "area", "nivel", "nivel", "sexo", "sexo"),
                         codigo = c("1", "2", "3", "6", "7", "1", "2"),
                         etiqueta = c("Ciencias", "Letras", "Artes", "Nivel 6", "Nivel 7", "Mujer", "Hombre"),
                         n = 50, stringsAsFactors = FALSE)
.tt_celdas <- function(filas, no_comparable = character(0)) {
  do.call(rbind, lapply(filas, function(f) {
    d <- data.frame(cruce = .tt_grupos$cruce, fila = f, grupo = .tt_grupos$codigo,
                    p = c(70, 60, 50, 62, 58, 64, 56), n = 50, comparable = TRUE, stringsAsFactors = FALSE)
    d$comparable[paste(d$cruce, d$grupo) %in% no_comparable] <- FALSE
    d
  }))
}
.tt_prueba <- function(cruce, fila, grupo, sube = TRUE, fragil = FALSE, dif = 15) {
  data.frame(cruce = cruce, fila = fila, grupo = grupo, sube = sube, fragil = fragil, dif = dif,
             p_ajustado = if (fragil) 0.03 else 0.001, stringsAsFactors = FALSE)
}

test_that("la opción `todas` está apagada por defecto y se enciende con todas = true", {
  expect_false(.tarjetas_opcion(list(tarjetas_diferencias = TRUE))$todas)
  expect_false(.tarjetas_opcion(list(tarjetas_diferencias = list(max = 4)))$todas)
  expect_true(.tarjetas_opcion(list(tarjetas_diferencias = list(todas = TRUE)))$todas)
})

test_that("con `todas`, una tarjeta por cruce en el orden declarado aunque no haya ninguna diferencia", {
  fila <- "Top Two Box"
  sel <- .tarjetas_seleccionar_todas(NULL, .tt_celdas(fila), .tt_grupos, c(`Top Two Box` = 61), "bateria",
                                     c("area", "nivel", "sexo"), filas_visibles = fila)
  expect_identical(vapply(sel, `[[`, "", "cruce"), c("area", "nivel", "sexo"))
  expect_true(all(vapply(sel, function(t) isTRUE(t$sin_diferencias), logical(1))))
  expect_true(all(vapply(sel, function(t) all(is.na(t$grupos$dir)), logical(1))))
  expect_identical(nrow(sel[[1]]$grupos), 3L)                # todos los grupos del cruce
  expect_identical(sel[[1]]$grupos$p, c(70, 60, 50))         # de mayor a menor
  # Sin `todas`, la misma pregunta no lleva tarjetas.
  expect_length(.tarjetas_seleccionar(NULL, .tt_celdas(fila), .tt_grupos, c(`Top Two Box` = 61), "bateria", c("area", "nivel", "sexo")), 0L)
})

test_that("con `todas`, la flecha va solo donde la regla la da y los no comparables no se muestran", {
  fila <- "Top Two Box"
  pr <- .tt_prueba("area", fila, "1", fragil = TRUE)
  sel <- .tarjetas_seleccionar_todas(pr, .tt_celdas(fila, no_comparable = "area 3"), .tt_grupos, c(`Top Two Box` = 61),
                                     "bateria", c("area", "sexo"), filas_visibles = fila)
  a <- sel[[1]]
  expect_identical(a$grupos$codigo, c("1", "2"))              # «Artes» (base chica) fuera
  expect_identical(a$grupos$dir, c("up", NA))
  expect_identical(a$grupos$fragil, c(TRUE, FALSE))
  expect_false(isTRUE(a$sin_diferencias))
  expect_true(isTRUE(sel[[2]]$sin_diferencias))
  # Un cruce de dos grupos con diferencia lleva sus dos flechas, como sin `todas`.
  sel2 <- .tarjetas_seleccionar_todas(.tt_prueba("sexo", fila, "1"), .tt_celdas(fila), .tt_grupos, c(`Top Two Box` = 61),
                                      "bateria", "sexo", filas_visibles = fila)
  expect_setequal(sel2[[1]]$grupos$dir, c("up", "down"))
  # Un cruce sin ningún grupo comparable no da tarjeta.
  expect_length(.tarjetas_seleccionar_todas(NULL, .tt_celdas(fila, no_comparable = c("nivel 6", "nivel 7")), .tt_grupos,
                                            c(`Top Two Box` = 61), "bateria", "nivel", filas_visibles = fila), 0L)
})

test_that("con `todas` en una opción única, la categoría es la de mayor diferencia; sin ninguna, la más alejada del total", {
  ce <- .tt_celdas(c("A", "B"))
  ce$p[ce$fila == "B" & ce$cruce == "nivel"] <- c(90, 20)
  tot <- c(A = 61, B = 50)
  sel <- .tarjetas_seleccionar_todas(.tt_prueba("area", "A", "1"), ce, .tt_grupos, tot, "opcion_unica", c("area", "nivel"),
                                     filas_visibles = c("A", "B"))
  expect_identical(vapply(sel, `[[`, "", "fila"), c("A", "B"))
})

test_that("PPT: los grupos sin diferencia van sin flecha y con barra neutra; la tarjeta sin diferencias no lleva borde de nivel", {
  t <- .tarjetas_seleccionar_todas(.tt_prueba("area", "Top Two Box", "1"), .tt_celdas("Top Two Box"), .tt_grupos,
                                   c(`Top Two Box` = 61), "bateria", c("area", "nivel"), filas_visibles = "Top Two Box")
  dibujar <- function(tj) {
    rec <- new.env(); rec$nm <- character(0); rec$fill <- list()
    b <- list(rect = function(l, t, w, h, fill = NULL, borde = NULL, pt = 0.75, punteado = FALSE, radio = 0, nombre = "") {
                rec$nm <- c(rec$nm, nombre); rec$fill[[length(rec$nm)]] <- fill %||% NA_character_ },
              txt = function(s, l, t, w, h, size, color, bold = FALSE, align = "left", nombre = "") rec$nm <- c(rec$nm, nombre),
              tri = function(x, yc, dir, fragil) rec$nm <- c(rec$nm, paste0("flecha:", dir)))
    .lam_tarjeta_dibujar(b, tj, list(l = 9, t = 1.5, w = 2.6, h = 2.2), "Área", tipo = "bateria", con_fila = FALSE)
    list(nm = rec$nm, fill = rec$fill)
  }
  a <- dibujar(t[[1]])
  expect_identical(sum(a$nm == "tarjeta:grupo:barra"), 1L)          # Ciencias, con su flecha
  expect_identical(sum(a$nm == "tarjeta:grupo_neutro:barra"), 2L)   # Letras y Artes, sin flecha
  expect_identical(sum(grepl("^flecha:", a$nm)), 1L)
  expect_true("tarjeta:99" %in% a$nm)
  b <- dibujar(t[[2]])
  expect_true("tarjeta:sin_diferencias" %in% b$nm)
  expect_identical(sum(b$nm == "tarjeta:grupo_neutro:barra"), 2L)
  expect_false(any(grepl("^flecha:", b$nm)))
  i <- which(b$nm == "tarjeta:grupo_neutro:barra")[1]
  expect_identical(toupper(b$fill[[i]]), toupper(.std_color("tarjeta_barra_neutra")))
})

test_that("la nota del PPT y el Word dicen que se muestran todos los grupos; la frase no se repite", {
  expect_identical(.tarjetas_nota_todas(NULL), .TARJETAS_FRASE_TODAS)
  n <- .tarjetas_nota_todas("Fuente: PULSO PUCP 2026")
  expect_identical(n, paste("Fuente: PULSO PUCP 2026.", .TARJETAS_FRASE_TODAS))
  expect_identical(.tarjetas_nota_todas(n), n)
  t <- list(tarjetas = .tarjetas_seleccionar_todas(NULL, .tt_celdas("Top Two Box"), .tt_grupos, c(`Top Two Box` = 61), "bateria",
                                                   "area", filas_visibles = "Top Two Box"),
            tipo = "bateria", opcion = .tarjetas_opcion(list(tarjetas_diferencias = list(todas = TRUE))),
            rotulos_cruce = c(area = "Área"))
  doc <- .word_estilos(officer::read_docx())
  doc <- .word_tarjetas_en_figura(doc, t, ancho = 6.27)
  txt <- officer::docx_summary(doc)$text
  expect_true(.TARJETAS_FRASE_TODAS %in% txt)
})

test_that("una pregunta de escala sola va en columna apilada vertical con la llave del Top Two Box", {
  niv <- c(t1 = "Mala", t2 = "Regular", t3 = "Buena", t4 = "Muy buena", t5 = "Excelente")
  d <- data.frame(item = "q", N = 400, t1 = .01, t2 = .14, t3 = .38, t4 = .37, t5 = .10, rotulo = "Calidad")
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "rotulo", barra_extra_preset = "top2box", top2box_labels = c("Muy buena", "Excelente"))
  expect_true(.lam_columna_llave_aplica(e))
  lz <- .lam_columna_llave(.lam_lienzo(), e, 0.6, 6, 1.8, 6.4)
  geo <- attr(lz, "geo")
  doc <- .lam_laminas_columna_llave(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                    e, "¿Cómo consideras que es la calidad?", base = "Base: 400.", folio = 1L, x1 = 6)
  f <- tempfile(fileext = ".pptx"); print(doc, target = f)
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  expect_match(xml, "prosecnur:grafico:columna_llave", fixed = TRUE)
  expect_match(xml, "TOP TWO BOX", fixed = TRUE)
  expect_match(xml, ">47%<", fixed = TRUE)
  # Ítem 15 de la v7.11 RV: el eje de los nombres queda limpio; la cifra que no cabe va a la derecha con su guía.
  expect_false(grepl("Mala  1%", xml, fixed = TRUE))
  sl <- xml2::read_xml(xml); ns <- xml2::xml_ns(sl)
  caja <- function(nombre) {
    sp <- xml2::xml_find_all(sl, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), ns)
    v <- function(x, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0(".//a:", x)), a)) / 914400
    data.frame(x = v("off", "x"), w = v("ext", "cx"), texto = xml2::xml_text(sp))
  }
  rot <- caja("columna:rotulo")
  expect_lt(diff(range(rot$x + rot$w)), 1e-6)                          # un solo eje
  fuera <- caja("columna:cifra_fuera")
  expect_identical(trimws(fuera$texto), "1%")
  expect_gt(fuera$x, geo$xc + geo$wc)                                  # a la derecha de la columna
  expect_false(grepl("columna:leyenda", xml, fixed = TRUE))
  expect_equal(geo$alto, 6.4 - 1.8)
  # Una batería de varias filas o sin Top Two Box sigue con la escala de siempre.
  d2 <- rbind(d, transform(d, item = "r", rotulo = "Otra"))
  expect_false(.lam_columna_llave_aplica(preparar_escala(d2, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "rotulo", barra_extra_preset = "top2box", top2box_labels = c("Muy buena", "Excelente"))))
  expect_false(.lam_columna_llave_aplica(preparar_escala(d, "item", "N", paste0("t", 1:5), niv, var_etiqueta_categoria = "rotulo")))
})
