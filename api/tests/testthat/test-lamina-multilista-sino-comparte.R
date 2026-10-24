# M1 (2026-10-23), «Mecanismos de admisión» y «Proceso formativo» de Arte (informe v6): un bloque de escala de acuerdo y un
# bloque Sí/No de una barra salían en DOS láminas con el mismo título. La multilista no comparte leyenda entre escalas
# distintas (cada bloque reserva 0,5 in para la suya) y juntos pasaban por 0,32 in la franja de 4,62 in. Con piso, cuando
# la alternativa es partir, las palancas de aire de `.lam_multilista_apretar` (holgura de la cifra chica, aire del Top
# Two Box, franja 0,30 in hacia el pie) también valen con leyenda propia por bloque. La barra no baja del piso de 1,12 cm.
.sc_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
.sc_sino <- function() {
  d <- data.frame(item = "q01", N = 51, t1 = 0.38, t2 = 0.62, rotulo = "¿Conocía los requisitos de admisión?")
  e <- preparar_escala(d, "item", "N", c("t1", "t2"), c(t1 = "Sí", t2 = "No"), var_etiqueta_categoria = "rotulo",
                       colores_grupos = list(Sí = "#001a5a", No = "#9dc3e6"))
  e$grosor_piso_cm <- 1.12
  e
}
.sc_lam <- function(ml) suppressMessages(.lam_laminas_multilista(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                                                 ml, "Mecanismos de admisión", folio = 1))
.sc_texto <- function(doc, i) paste(xml2::xml_text(xml2::xml_find_all(doc$slide$get_slide(i)$get(), "//a:t")), collapse = " | ")
.sc_forma <- function(doc, i, nombre) {
  sp <- xml2::xml_find_all(doc$slide$get_slide(i)$get(), sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  data.frame(y = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:off"), "y")) / 914400,
             h = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400)
}
.sc_larga <- paste("Los criterios de admisión aplicados permiten a los(as) estudiantes matriculados cumplir con las exigencias",
                   "del plan de estudios y del proceso formativo que se desarrolla en la Facultad de manera sostenida")
.sc_acuerdo <- function(filas_por_premisa) {   # p. ej. c(2, 1): 2 públicos en la premisa 1 y 1 en la 2
  d <- do.call(rbind, lapply(seq_along(filas_por_premisa), function(p)
    data.frame(pub = c("Docentes", "Estudiantes")[seq_len(filas_por_premisa[p]) + (filas_por_premisa[p] == 1L)], p = p, stringsAsFactors = FALSE)))
  d$item <- sprintf("p%02d_%s", d$p, substr(d$pub, 1, 3)); d$N <- 51
  d$t1 <- 0.01; d$t2 <- 0.04; d$t3 <- 0.45; d$t4 <- 0.50
  d$gid <- sprintf("g%d", d$p); d$gt <- ifelse(d$p == 1L, .sc_larga, "El proceso formativo considera las condiciones de entrada de los(as) estudiantes admitidos.")
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), .sc_niv, var_etiqueta_categoria = "pub", var_grupo_id = "gid", var_grupo_titulo = "gt",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], .sc_niv)), barra_extra_preset = "top2box", top2box_labels = .sc_niv[3:4])
  e$grosor_piso_cm <- 1.12
  e
}
.sc_ml <- function(filas) list(bloques = list(list(espec = .sc_acuerdo(filas), titulo = NULL),
                                              list(espec = .sc_sino(), titulo = NULL)))

test_that("Escala de acuerdo (3 barras) + bloque Sí/No de una barra: una sola lámina cuando la alternativa es partir", {
  on.exit(options(prosecnur.evitar_cont = NULL, prosecnur.grosor_piso_cm = NULL))
  ml <- .sc_ml(c(2, 1)); items <- .lam_multilista_items(ml); options(prosecnur.grosor_piso_cm = 1.12)
  disp <- .lam_multilista_disponible(FALSE)
  expect_false(.lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec")))     # dos escalas: una leyenda cada una
  expect_gt(.lam_multilista_alto_f(items, FALSE, 0), disp)                           # ni con el aire al mínimo cabe
  expect_true(.lam_multilista_apretar(items, FALSE))
  o <- .sc_lam(ml)
  expect_identical(o$partes, 1L)
  expect_false(grepl("(cont.)", .sc_texto(o$doc, 1), fixed = TRUE))
  seg <- .sc_forma(o$doc, 1, "segmento")
  expect_gte(min(seg$h) * 2.54, 1.12 - 0.005)                                        # N1: el piso no se toca
  ley <- .sc_forma(o$doc, 1, "leyenda:cuadro")
  expect_equal(nrow(ley), 4 + 2)                                                     # cada bloque con SU leyenda
  expect_lte(max(ley$y + ley$h), .std_geom("base_y") - 0.1)                          # la última leyenda no llega al «Base:»
  expect_gte(min(ley$y[ley$y > max(seg$y)]) - max(seg$y + seg$h), 0.05)              # ni pisa la barra Sí/No
  # apagado (N1 puro): como antes, dos láminas
  options(prosecnur.evitar_cont = FALSE)
  expect_identical(.sc_lam(ml)$partes, 2L)
})

test_that("Escala de 5 barras + bloque Sí/No: no cabe ni apretado y sigue en dos láminas", {
  on.exit(options(prosecnur.evitar_cont = NULL, prosecnur.grosor_piso_cm = NULL))
  ml <- .sc_ml(c(2, 2, 1)); items <- .lam_multilista_items(ml); options(prosecnur.grosor_piso_cm = 1.12)
  expect_false(.lam_multilista_apretar(items, FALSE))
  expect_identical(.sc_lam(ml)$partes, 2L)
})

test_that("Lo que ya cabía no cambia: apretar solo aplica cuando no cabe al natural ni con el aire al mínimo", {
  on.exit(options(prosecnur.evitar_cont = NULL, prosecnur.grosor_piso_cm = NULL))
  options(prosecnur.grosor_piso_cm = 1.12)
  items <- .lam_multilista_items(list(bloques = list(list(espec = .sc_acuerdo(1), titulo = NULL), list(espec = .sc_acuerdo(1), titulo = NULL))))
  expect_false(.lam_multilista_apretar(items, .lam_multilista_leyenda_compartida(lapply(items, `[[`, "espec"))))
})
