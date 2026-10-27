# M1 con piso en la multilista (Gonzalo, 2026-10-22): «mientras menos (cont) haya mejor».
# 1) Con piso de grosor, los bloques que se pasan por poco ceden el AIRE (no la barra) antes de partirse.
# 2) El sufijo «(cont.)» se pone solo si el corte cae DENTRO de un bloque; si cae entre bloques, la lámina que sigue
#    empieza otro bloque y no continúa nada.
.ml1_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
.ml1_cola <- c(corta = "", media = " y que permiten desarrollar las actividades")
.ml1_espec <- function(n, largo = "media", tag = "A") {
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), N = 51, t1 = 0.01, t2 = 0.04, t3 = 0.45, t4 = 0.50,
                  rotulo = sprintf("Los recursos del área %s%d son suficientes y están disponibles%s", tag, seq_len(n), .ml1_cola[[largo]]))
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), .ml1_niv, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], .ml1_niv)),
                       barra_extra_preset = "top2box", top2box_labels = .ml1_niv[3:4])
  e$grosor_piso_cm <- 1.12
  e
}
.ml1 <- function(...) {   # cada argumento: c(n, largo)
  bl <- Map(function(a, k) list(espec = .ml1_espec(as.integer(a[[1]]), a[[2]], LETTERS[k]), titulo = paste("Bloque", LETTERS[k])), list(...), seq_along(list(...)))
  list(bloques = bl)
}
.ml1_lam <- function(ml) suppressMessages(.lam_laminas_multilista(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                                                 ml, "Recursos de apoyo", folio = 1))
.ml1_titulo <- function(doc, i) {
  x <- doc$slide$get_slide(i)$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[contains(@name,'Titulo') or contains(@name,'Title') or contains(@name,'ítulo')]]")
  paste(xml2::xml_text(sp), collapse = " ")
}
.ml1_texto <- function(doc, i) paste(xml2::xml_text(xml2::xml_find_all(doc$slide$get_slide(i)$get(), "//a:t")), collapse = " | ")

test_that("M1 multilista con piso: dos bloques que se pasan por poco caben en UNA lámina cediendo el aire, sin bajar la barra", {
  ml <- .ml1(c(2, "media"), c(2, "corta"))
  op <- options(prosecnur.evitar_cont = FALSE); on.exit(options(op))
  expect_identical(.ml1_lam(ml)$partes, 2L)           # N1: se parte
  options(prosecnur.evitar_cont = NULL)
  o <- .ml1_lam(ml)
  expect_identical(o$partes, 1L)
  x <- o$doc$slide$get_slide(1)$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]")
  h <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400 * 2.54
  expect_gte(min(h), 1.12 - 0.005)
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y")) / 914400
  ley <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:cuadro']]")
  yl <- min(as.numeric(xml2::xml_attr(xml2::xml_find_first(ley, "p:spPr/a:xfrm/a:off"), "y"))) / 914400
  expect_gte(yl - max(y + h / 2.54), 0.05)             # la leyenda no pisa la última barra
})

test_that("M1 multilista: «(cont.)» solo si el corte cae dentro de un bloque", {
  # dos bloques de 4 enunciados de 3 líneas: cada uno cabe solo, juntos no; el corte cae ENTRE bloques
  ml <- .ml1(c(4, "media"), c(4, "media"))
  o <- .ml1_lam(ml)
  expect_identical(o$partes, 2L)
  expect_false(grepl("(cont.)", .ml1_texto(o$doc, 2), fixed = TRUE))
  op <- options(prosecnur.evitar_cont = FALSE); on.exit(options(op))
  o2 <- .ml1_lam(ml)
  expect_true(grepl("(cont.)", .ml1_texto(o2$doc, 2), fixed = TRUE))   # sin la regla, siempre
  options(prosecnur.evitar_cont = NULL)
  # un solo bloque de 7 barras: el corte cae DENTRO del bloque y la segunda lámina sí continúa
  o3 <- .ml1_lam(.ml1(c(7, "corta")))
  expect_gte(o3$partes, 2L)
  expect_true(grepl("(cont.)", .ml1_texto(o3$doc, 2), fixed = TRUE))
})

test_that("M1 multilista: sin piso nada cambia, ni forzando evitar_cont = TRUE", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)   # 0 apaga el piso que el estándar trae desde 2026-10-26
  for (ml in list(.ml1(c(2, "media"), c(2, "corta")), .ml1(c(4, "media"), c(4, "media")))) {
    ml$bloques <- lapply(ml$bloques, function(b) { b$espec$grosor_piso_cm <- NULL; b })
    expect_equal(.std_piso_escala_in(), 0)
    a <- .ml1_lam(ml)
    op <- options(prosecnur.evitar_cont = TRUE)
    b <- .ml1_lam(ml)
    options(op)
    expect_identical(b$partes, a$partes)
    if (a$partes > 1L) expect_true(grepl("(cont.)", .ml1_texto(b$doc, 2), fixed = TRUE))   # sin piso, «(cont.)» como siempre
  }
})

# M1 (2026-10-22), «Proceso formativo» de Arte: un bloque de 5 barras con cifras chicas y otro de otra escala (Sí/No). La
# multilista no comparte leyenda, y cada bloque reservaba 0,5 in para la suya; pero tras repartir, la lámina que lleva
# solo el bloque grande tiene UNA leyenda. Con eso el bloque cabe entero (mínimo 4,42 in vs 4,62) y se evita el «(cont.)».
.ml1_sino <- function(n = 1) {
  d <- data.frame(item = sprintf("q%02d", seq_len(n)), N = 51, t1 = 0.38, t2 = 0.62, rotulo = sprintf("¿Conoce el requisito %d?", seq_len(n)))
  e <- preparar_escala(d, "item", "N", c("t1", "t2"), c(t1 = "Sí", t2 = "No"), var_etiqueta_categoria = "rotulo",
                       colores_grupos = list(Sí = "#001a5a", No = "#9dc3e6"))
  e$grosor_piso_cm <- 1.12
  e
}
test_that("M1 multilista: un bloque que ya no comparte lámina con otra escala usa una sola leyenda y no se parte en «(cont.)»", {
  ml <- list(bloques = list(list(espec = .ml1_espec(5, "media", "A"), titulo = NULL), list(espec = .ml1_sino(1), titulo = NULL)))
  items <- .lam_multilista_items(ml); op <- options(prosecnur.grosor_piso_cm = 1.12); on.exit(options(op))
  expect_false(.lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec")))
  expect_true(.lam_multilista_compartida_parte(items[1], FALSE))                   # un solo bloque: una sola leyenda
  expect_false(.lam_multilista_compartida_parte(items, FALSE))                     # dos escalas distintas: una cada una
  disp <- .lam_multilista_disponible(FALSE)
  expect_gt(.lam_multilista_alto_f(items[1], FALSE, 0), disp)                      # con leyenda propia no cabe (4,92 vs 4,62)
  expect_lte(.lam_multilista_alto_f(items[1], TRUE, 0), disp)                      # con leyenda de la lámina sí (4,42)
  o <- .ml1_lam(ml)
  expect_identical(o$partes, 2L)                                                   # el bloque de 5 + el Sí/No
  expect_false(any(vapply(seq_len(o$partes), function(i) grepl("(cont.)", .ml1_texto(o$doc, i), fixed = TRUE), TRUE)))
  # apagado (N1 puro): como antes, se parte el bloque de 5 y la segunda lámina continúa
  options(prosecnur.evitar_cont = FALSE)
  o0 <- .ml1_lam(ml)
  expect_identical(o0$partes, 3L)
  expect_true(grepl("(cont.)", .ml1_texto(o0$doc, 2), fixed = TRUE))
  options(prosecnur.evitar_cont = NULL)   # no se filtra a las pruebas que siguen
})

# M1 (2026-10-23), «Recursos de apoyo» y «Contenidos del plan» de Arte: 3 premisas x 2 públicos = 6 barras con cifras
# chicas. Regla del usuario: «seis barras caben en una lámina». Con el piso de 1,12 cm el mínimo medido era 5,29 in contra
# 4,62 de franja. Cuando la alternativa es partir, `.lam_multilista_apretar` combina: holgura de la cifra chica 0,075 ->
# 0,03 in, aire del Top Two Box 0,35 -> 0,25 in y franja extendida 0,30 in hacia el pie con la leyenda pegada a la barra.
.ml1_actores <- function(np = 3, pub = c("Docentes", "Estudiantes")) {
  d <- expand.grid(pub = pub, p = seq_len(np), stringsAsFactors = FALSE)
  d$item <- sprintf("p%02d_%s", d$p, substr(d$pub, 1, 3)); d$N <- 51
  d$t1 <- 0.01; d$t2 <- 0.04; d$t3 <- 0.45; d$t4 <- 0.50
  d$gid <- sprintf("g%d", d$p); d$gt <- sprintf("Los recursos del área %d son suficientes y están disponibles", d$p)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), .ml1_niv, var_etiqueta_categoria = "pub", var_grupo_id = "gid", var_grupo_titulo = "gt",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], .ml1_niv)), barra_extra_preset = "top2box", top2box_labels = .ml1_niv[3:4])
  e$grosor_piso_cm <- 1.12
  e
}
.ml1_forma <- function(doc, i, nombre) {
  sp <- xml2::xml_find_all(doc$slide$get_slide(i)$get(), sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  data.frame(y = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y")) / 914400,
             h = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400)
}
test_that("M1 multilista: 3 premisas x 2 públicos con cifras chicas caben en UNA lámina sin «(cont.)», sin bajar la barra del piso", {
  ml <- list(bloques = list(list(espec = .ml1_actores(), titulo = NULL)))
  items <- .lam_multilista_items(ml); op <- options(prosecnur.grosor_piso_cm = 1.12); on.exit(options(op))
  on.exit(options(prosecnur.evitar_cont = NULL), add = TRUE)
  disp <- .lam_multilista_disponible(TRUE)
  expect_gt(.lam_multilista_alto_f(items, TRUE, 0), disp)           # con el aire de siempre ni al mínimo cabe (5,29 vs 4,62)
  expect_true(.lam_multilista_apretar(items, TRUE))
  o <- .ml1_lam(ml)
  expect_identical(o$partes, 1L)
  expect_false(grepl("(cont.)", .ml1_texto(o$doc, 1), fixed = TRUE))
  seg <- .ml1_forma(o$doc, 1, "segmento")
  expect_equal(nrow(seg) / 4, 6)                                    # seis barras de cuatro tramos
  expect_gte(min(seg$h) * 2.54, 1.12 - 0.005)                       # N1: el piso no se toca
  fin_barra <- max(seg$y + seg$h)
  ley <- .ml1_forma(o$doc, 1, "leyenda:cuadro")
  expect_gte(min(ley$y) - fin_barra, 0.05)                          # la leyenda no pisa la última barra
  expect_lte(max(ley$y + ley$h), .std_geom("base_y") - 0.1)         # ni llega al «Base:» y al número de página
  # sin la regla (evitar_cont = FALSE) la lámina se parte como en N1
  options(prosecnur.evitar_cont = FALSE)
  expect_false(.lam_multilista_apretar(items, TRUE))
  expect_gte(.ml1_lam(ml)$partes, 2L)
})
test_that("M1 multilista: lo que ya cabía no se aprieta", {
  op <- options(prosecnur.grosor_piso_cm = 1.12); on.exit(options(op))
  for (ml in list(.ml1(c(2, "media"), c(2, "corta")), .ml1(c(4, "media"), c(4, "media")), .ml1(c(3, "corta")))) {
    items <- .lam_multilista_items(ml)
    expect_false(.lam_multilista_apretar(items, .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec"))))
  }
})
