source("setup-load-all.R")

# C1-C4 (lead, 2026-11-09): el contraste de página entera arranca bajo el título con su leyenda centrada (como la escala
# del resumen, P13), un rótulo de una línea se cuenta en una (P15), la cobertura no promete otra lámina (P14) y el
# contraste en una ranura dice que no admite `continuar_desde`.

.ca_largos <- c("Los reglamentos y normas relacionados a la Unidad se encuentran difundidos entre los(as) docentes de la Facultad.",
                "Servicio de salud", "La biblioteca atiende",
                "Los procesos de selección y contratación de los(as) docentes son justos y transparentes en todas sus etapas.",
                "La tutoría orienta", "El material bibliográfico está actualizado")
.ca_espec <- function(rotulos = .ca_largos) {
  n <- length(rotulos)
  d <- data.frame(eje = rep(rotulos, 2), grupo = factor(rep(c("Estudiantes", "Docentes"), each = n), levels = c("Estudiantes", "Docentes")),
                  valor = c(seq(50, 80, length.out = n), seq(70, 40, length.out = n)))
  attr(graficar_dumbbell(d, estilo = "resumen"), "pulso_espec")
}
.ca_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.ca_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(p, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, p), a)) / 914400
  data.frame(x = num(".//a:xfrm/a:off", "x"), y = num(".//a:xfrm/a:off", "y"), w = num(".//a:xfrm/a:ext", "cx"), h = num(".//a:xfrm/a:ext", "cy"),
             t = vapply(sp, function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), ""))
}
.ca_centro_ley <- function(marcas, textos) {
  ult <- textos[which.max(textos$x), ]
  (min(marcas$x) + ult$x + 0.1 + .lam_ancho_tinta(ult$t, 10.5, FALSE)) / 2
}

test_that("C1: la leyenda del contraste va centrada en la lámina y el bloque arranca bajo el título con el aire de la casa", {
  e <- .ca_espec()
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  xml <- .ca_xml(.lam_laminas_contraste(doc, e, "Contraste de públicos", folio = 1)$doc)
  marcas <- .ca_cajas(xml, "leyenda:marca"); textos <- .ca_cajas(xml, "leyenda:texto")
  expect_identical(nrow(textos), 2L)
  expect_equal(.ca_centro_ley(marcas, textos), .std_geom("ancho") / 2, tolerance = 0.05)
  expect_lt(diff(range(textos$y)), 1e-6)                                  # una sola fila
  aire <- min(textos$y) - .lam_titulo_fin("Contraste de públicos")
  expect_equal(aire, .LAM_AIRE_BAJO_TITULO_IN, tolerance = 1e-6)
  # Las filas parten bajo la cabecera y no pasan del pie (deja el alto del eje).
  ge <- .lam_contraste_geom(e, titulo = "Contraste de públicos")
  expect_lte(ge$zona0 + ge$cab + sum(ge$alturas), .std_geom("contenido_y1") - 0.35 + 1e-6)
  # Sin título (la consulta de si cabe) arranca más abajo: lo que cabe ahí cabe bajo el título.
  expect_gte(.lam_contraste_geom(e)$zona0, ge$zona0)
})

test_that("C1: en su ranura, la leyenda del contraste se centra en el panel y el bloque arranca arriba", {
  e <- .ca_espec(c("Servicio de salud", "La biblioteca atiende", "La tutoría orienta", "El comedor"))
  x <- 0.5; y <- 2; w <- 6.0; h <- 4.2
  geo <- .lam_rr_geo(e, x, y, w, h)
  expect_true(isTRUE(geo$cabe))
  lz <- .lam_lienzo(); .lam_rr_dibujar(lz, e, geo)
  doc <- officer::add_slide(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                            layout = "Graficos2", master = "Office Theme")
  xml <- .ca_xml(.lam_agrupar(doc, lz))
  marcas <- .ca_cajas(xml, "leyenda:marca"); textos <- .ca_cajas(xml, "leyenda:texto")
  expect_equal(.ca_centro_ley(marcas, textos), x + w / 2, tolerance = 0.05)
  expect_equal(min(textos$y), y, tolerance = 1e-6)
})

test_that("C2: un rótulo que cabe en una línea se cuenta en una; la holgura queda sólo para la línea pegada al borde", {
  # Lámina 1 de p16 (Arte, 2026-11-09): cuadro de 5.87 in a 10.5 pt; LibreOffice y PowerPoint lo componen en una línea.
  s <- "Los procesos de selección y contratación de los(as) docentes son justos. (Doc.)"
  expect_length(.lam_rotulo_recortar(s, 5.87, 10.5, 3L)$lineas, 1L)
  dos <- "Estoy satisfecho(a) con los programas de ayuda (becas, movilidad académica, bolsa de trabajo, pasantías) que me brinda la Unidad como su trabajador. (Adm.)"
  expect_length(.lam_rotulo_recortar(dos, 5.87, 10.5, 3L)$lineas, 2L)
  # Una línea al 99.5 % del ancho útil sí está en riesgo: se compone con la holgura y pasa a dos.
  w_borde <- .lam_ancho_tinta(s, 10.5) / 0.995 + 0.22
  expect_length(.lam_rotulo_recortar(s, w_borde, 10.5, 3L)$lineas, 2L)
  expect_lt(.lam_rotulo_util(s, w_borde, 10.5), w_borde - 0.22)
  expect_identical(.lam_rotulo_util(s, 5.87, 10.5), 5.87 - 0.22)
})

test_that("C3: la cobertura dice qué base no cabe, sin prometer otra lámina", {
  expect_identical(.cobcat_nota_omitidos("Estudiantes", "Docentes"), "Por espacio, se muestra Estudiantes; Docentes no cabe en esta lámina")
  expect_identical(.cobcat_nota_omitidos(c("Estudiantes", "Docentes"), c("Administrativos", "Egresados")),
                   "Por espacio, se muestran Estudiantes y Docentes; Administrativos y Egresados no caben en esta lámina")
  fuentes <- list.files(test_path("..", "..", "R"), pattern = "\\.R$", full.names = TRUE)
  if (length(fuentes)) {
    lineas <- unlist(lapply(fuentes, readLines, warn = FALSE))
    # Ningún texto que llega a la lámina promete otra: «va en otra lámina», «van en otra lámina», «el resto en otra lámina».
    expect_false(any(grepl("sprintf\\(.*en otra lámina|\"[^\"]*van? en otra lámina", lineas)))
  }
})

test_that("C4: el contraste en una ranura no admite `continuar_desde` y lo dice", {
  el <- list(.element_type = "dumbbell", overrides = list(ancho = 6, estilo = "resumen"), continuar_desde = 5L)
  expect_message(r <- .contraste_desde_en_ranura(el), "no admite continuar desde una posición \\(5\\)")
  expect_null(r$continuar_desde)
  pagina <- list(.element_type = "dumbbell", overrides = list(ancho = 12.3, estilo = "resumen"), continuar_desde = 5L)
  expect_silent(r2 <- .contraste_desde_en_ranura(pagina))
  expect_identical(r2$continuar_desde, 5L)
})

test_that("en la ranura, con todas las filas dentro y la prioridad distinta del orden, cada rótulo queda sobre su fila", {
  rot <- c("Servicio de salud", "La biblioteca atiende", "La tutoría orienta", "El comedor")
  e <- .ca_espec(rot)
  e$prioridad <- c(3L, 1L, 4L, 2L)                       # la mayor diferencia no es la primera de la lámina
  geo <- .lam_rr_geo(e, 0.5, 2, 6.0, 4.2)
  expect_true(isTRUE(geo$cabe)); expect_identical(geo$k, 4L)
  expect_identical(geo$textos, e$rotulos)
  expect_null(geo$filas)
})
