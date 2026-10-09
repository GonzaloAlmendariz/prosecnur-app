# ADR 0093 (N1) — el bloque de escala ocupa las posiciones del recetario
# (láminas 216, 221 y 222) y se parte como él.

.niv_esc <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo",
              t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_bateria <- function(n_filas = 11, base = 51) {
  set.seed(n_filas)
  d <- do.call(rbind, lapply(seq_len(n_filas), function(k) {
    c3 <- sample(10:25, 1); c4 <- base - c3 - sample(0:2, 1); resto <- base - c3 - c4
    data.frame(item = sprintf("p%02d", k), rotulo = sprintf("Competencia %d", k), N = base,
               t1 = 0, t2 = resto, t3 = c3, t4 = c4, t5 = 0)
  }))
  d[paste0("t", 1:5)] <- d[paste0("t", 1:5)] / d$N
  preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_esc, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_esc)),
                  barra_extra_preset = "top2box", top2box_labels = .niv_esc[3:4])
}
.formas <- function(doc, nombre) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:escala']]/p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, texto = xml2::xml_text(sp))
}
.doc_vacio <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("once afirmaciones se parten en dos láminas de 5 y 6, como 221 y 222", {
  e <- .espec_bateria(11)
  partes <- .lam_escala_partir(.lam_escala_premisas(e))
  expect_length(partes, 2L)
  expect_equal(vapply(partes, length, 0L), c(5L, 6L))
  # partir conserva las filas y su orden
  expect_identical(unlist(lapply(partes, function(p) vapply(p, function(q) q$filas[[1]]$i, 0L))), e$orden$aplicado)
})

test_that("la batería ocupa las columnas del recetario: barra en 5.2 in de 6 in y Top Two Box en 11.4 in", {
  e <- .espec_bateria(5)
  o <- .lam_laminas_escala(.doc_vacio(), e, "Competencias", ante = "Perfil de egreso", base = "Base: 51 docentes", folio = 221)
  expect_identical(o$partes, 1L)
  seg <- .formas(o$doc, "segmento")
  inicio <- tapply(seg$x, round(seg$y, 3), min); fin <- tapply(seg$x + seg$w, round(seg$y, 3), max)
  expect_true(all(abs(inicio - 5.2) < 0.01))
  expect_true(all(abs(fin - 11.2) < 0.01))
  box <- .formas(o$doc, "box:cifra")
  expect_true(all(abs(box$x - 11.4) < 0.01))
  expect_identical(box$texto, unname(e$box$cifras[e$orden$aplicado]))
  # un filete entre premisas, de margen a margen
  fil <- .formas(o$doc, "filete")
  expect_equal(nrow(fil), 4L)
  expect_true(all(abs(fil$x - .std_geom("margen_izq")) < 0.01))
})

test_that("con base menor que 30 cada Top Two Box dice sus casos", {
  e <- .espec_bateria(4, base = 15)
  o <- .lam_laminas_escala(.doc_vacio(), e, "Gestores", base = "Base: 15 administrativos")
  casos <- .formas(o$doc, "box:casos")
  expect_equal(nrow(casos), 4L)
  expect_match(casos$texto, "^[0-9]+ de 15$")
})

test_that("una afirmación con un público encabeza la lámina y la barra ocupa el ancho (216)", {
  e <- .espec_bateria(1, base = 172)
  e$filas$grupo_id <- "Estudiantes"; e$filas$grupo_titulo <- "Existen mecanismos periódicos"; e$filas$rotulo <- "Estudiantes"
  o <- .lam_laminas_escala(.doc_vacio(), e, "Gestión", ante = "Cuerpo académico", base = "Base: 172 estudiantes", folio = 216)
  seg <- .formas(o$doc, "segmento")
  L <- .std_geom("likert")
  expect_lt(abs(min(seg$x) - (L$x_premisa + 1.75)), 0.01)
  expect_lt(abs(max(seg$x + seg$w) - (L$x_top_two_box - 0.25)), 0.01)
  expect_identical(.formas(o$doc, "pregunta")$texto, "Existen mecanismos periódicos")
  expect_identical(.formas(o$doc, "respuestas")$texto, "172 respuestas")
})

test_that("título, antetítulo, base y folio salen del estándar", {
  e <- .espec_bateria(3)
  o <- .lam_laminas_escala(.doc_vacio(), e, "Título", ante = "Antetítulo", base = "Base: 51", folio = 7)
  x <- o$doc$slide$get_slide(o$doc$cursor)$get()
  txt <- function(n) xml2::xml_text(xml2::xml_find_first(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
  expect_identical(txt("Antetitulo lamina"), "ANTETÍTULO")
  expect_identical(txt("Titulo lamina"), "Título")
  expect_identical(txt("Base lamina"), "Base: 51")
  expect_identical(txt("Folio lamina"), "7")
  sz <- xml2::xml_attr(xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Titulo lamina']]//a:rPr"), "sz")
  expect_identical(sz, as.character(.std_pt("titulo") * 100))
})
