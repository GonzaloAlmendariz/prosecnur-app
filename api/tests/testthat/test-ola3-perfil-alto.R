# Ola 3, O4: la lámina de perfil usa el alto libre (bajo un título corto y hasta el fin del contenido) antes de mandar un
# panel a su imagen de respaldo (lamina_perfil_alto.R). Forma de «PERFIL DEL ESTUDIANTE» de Arte: siete años de ingreso
# con pregunta de dos líneas arriba a la derecha y la pregunta de tres líneas abajo a la derecha. Antes ese panel iba como
# imagen con barras de 0.38 cm (R5) y 0.35 cm de diferencia con el resto (B3).

.o4_cat <- function(cats) { p <- seq_along(cats); p <- p / sum(p); preparar_categorica(cats, p, paste0(round(100 * p), "%"), NULL) }
.o4_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.o4_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, "//p:sp")
  sp <- sp[xml2::xml_attr(xml2::xml_find_first(sp, "./p:nvSpPr/p:cNvPr"), "name") == nombre]
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}
.o4_caso <- function() list(
  especs = list(.o4_cat(c("Masculino", "Femenino", "No binario", "Prefiero no responder")),
                .o4_cat(c("2021-I", "2023-I", "2024-I", "2024-II", "2025-I", "2025-II", "2026-I")),
                .o4_cat(c("17 a 18 años", "19 a 21 años", "22 años a más")),
                .o4_cat(c("Segundo ciclo", "Tercer ciclo", "Cuarto ciclo"))),
  preguntas = list("¿Cuál es su género?", "¿En qué año y ciclo ingresó a la Facultad de Arte y Diseño? (Por ejemplo: 2026-I)",
                   "Rangos de edad", paste("¿Qué ciclo está cursando actualmente? Si está matriculado en cursos de varios ciclos,",
                                           "responda considerando el ciclo en el que lleva más cursos.")))

test_that("sin título el bloque no sube; con un título de una línea sube y los cuatro van en barras", {
  k <- .o4_caso(); geo <- .lam_mixta_geo("paneles_4")
  sin <- .lam_perfil_plan(k$especs, geo, k$preguntas, vector("list", 4), rep(FALSE, 4))
  expect_equal(min(vapply(sin$geo$paneles, `[[`, 0, "y")), min(vapply(geo$paneles, `[[`, 0, "y")))   # sin título: zona del recetario
  con <- .lam_perfil_plan(k$especs, geo, k$preguntas, vector("list", 4), rep(FALSE, 4), titulo = "PERFIL DEL ESTUDIANTE")
  expect_true(all(con$caben))
  P <- con$geo$paneles
  y0 <- min(vapply(P, `[[`, 0, "y")); y1 <- max(vapply(P, function(p) p$y + p$h, 0))
  expect_gte(y0, max(.std_comp("perfil", "zona_y0_min"), .lam_titulo_fin("PERFIL DEL ESTUDIANTE") + .std_comp("perfil", "aire_bajo_titulo")) - 1e-9)
  expect_lte(y1, .std_geom("contenido_y1") + 1e-9)
  # La calle entre filas conserva su alto (crecen las filas, no la calle) y el filete sigue en ella.
  expect_equal(P[[3]]$y - (P[[1]]$y + P[[1]]$h), geo$paneles[[3]]$y - (geo$paneles[[1]]$y + geo$paneles[[1]]$h), tolerance = 1e-6)
  h <- Filter(function(f) identical(f$tipo, "h"), con$geo$filetes)[[1]]
  expect_gt(h$y, P[[1]]$y + P[[1]]$h); expect_lt(h$y, P[[3]]$y)
})

test_that("una lámina que ya cabe no se estira: conserva la geometría del recetario", {
  e <- list(.o4_cat(c("A", "B", "C")), .o4_cat(c("A", "B")), .o4_cat(c("A", "B", "C")), .o4_cat(c("A", "B")))
  geo <- .lam_mixta_geo("paneles_4"); preg <- list("Uno", "Dos", "Tres", "Cuatro")
  plan <- .lam_perfil_plan(e, geo, preg, vector("list", 4), rep(FALSE, 4), titulo = "PERFIL")
  expect_true(all(plan$caben)); expect_identical(plan$geo$paneles, geo$paneles)
})

test_that("un título largo no deja subir el bloque sobre él; sin título sólo baja su fin", {
  geo <- .lam_mixta_geo("paneles_4")
  largo <- paste(rep("Un título de la lámina bastante largo", 3), collapse = " ")
  g <- .lam_perfil_estirar(geo, largo)
  expect_gte(min(vapply(g$paneles, `[[`, 0, "y")), .lam_titulo_fin(largo) + .std_comp("perfil", "aire_bajo_titulo") - 1e-9)
  g0 <- .lam_perfil_estirar(.lam_mixta_geo("poblacion_5"), NULL)
  expect_equal(min(vapply(g0$paneles, `[[`, 0, "y")), min(vapply(.lam_mixta_geo("poblacion_5")$paneles, `[[`, 0, "y")))
  expect_equal(max(vapply(g0$paneles, function(p) p$y + p$h, 0)), .std_geom("contenido_y1"), tolerance = 1e-9)
})

test_that("la lámina dibujada: los cuatro paneles en barras, una sola barra sobre el piso y nada bajo la cabecera", {
  skip_if_not_installed("officer"); skip_if_not_installed("xml2")
  k <- .o4_caso()
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  doc <- .lam_laminas_mixta(doc, k$especs, "paneles_4", preguntas = k$preguntas, publicos = vector("list", 4),
                            titulo = "PERFIL DEL ESTUDIANTE", base = "Base: 279 estudiantes", folio = 6L)$doc
  xml <- .o4_xml(doc)
  b <- .o4_cajas(xml, "barra")
  expect_equal(nrow(b), 17L)                                 # 4 + 7 + 3 + 3: ninguno al respaldo
  expect_true(all(b$h >= .std_piso_panel_in() - 1e-3))       # R5
  expect_lte(diff(range(b$h)), 0.05 / 2.54)                  # B3
  pq <- .o4_cajas(xml, "panel:pregunta")
  expect_gte(min(pq$y), .std_comp("perfil", "zona_y0_min") - 1e-3)
  expect_lte(max(b$y + b$h), .std_geom("contenido_y1") + 1e-3)
})
