source("setup-load-all.R")

# S7 (Gonzalo, 2026-11-09, «Diferencias por ciclo»: «al ser tres y tantas premisas no queda claro cuál es cuál»). Con
# tres o cuatro grupos el hueco entre preguntas es al menos el doble del paso entre sub-filas, hay un filete entre
# preguntas y, con más de ocho, la lámina avisa que se puede partir con "Continuar desde" (lamina_contraste_grupos.R).

.cg_espec <- function(n = 7L) {
  rot <- c("La FAD fomenta la movilidad estudiantil", "Asesorías de matrícula", "Servicio de salud", "Dotación de recursos suficiente",
           "En la Formación General se fomentan espacios de diálogo y discusión en favor de una formación profesional.",
           "Investigación-creación docente relevante", "Malla con salidas de campo")[seq_len(n)]
  g <- c("Segundo ciclo", "Tercer ciclo", "Cuarto ciclo")
  d <- data.frame(eje = rep(rot, 3), grupo = rep(g, each = n), valor = c(seq(60, 86, length.out = n), seq(75, 100, length.out = n), seq(53, 85, length.out = n)),
                  n_casos = rep(c(139, 25, 115), each = n))
  .espec_contraste(d, base_en = "nota")
}
.cg_render <- function(espec) {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  avisos <- character(0)
  doc <- withCallingHandlers(.lam_laminas_contraste(doc, espec, "Diferencias por ciclo", folio = 1)$doc,
                             message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  list(xml = xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))), avisos = avisos)
}
.cg_y <- function(xml, nombre) {
  sps <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  y <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sps, ".//a:off"), "y")) / 914400
  h <- as.numeric(xml2::xml_attr(xml2::xml_find_first(sps, ".//a:ext"), "cy")) / 914400
  y + h / 2
}

test_that("S7: con tres grupos el hueco entre preguntas es al menos el doble del paso entre sub-filas, con filete entre ellas", {
  espec <- .cg_espec(7L)
  ge <- .lam_contraste_geom(espec, titulo = "Diferencias por ciclo")
  expect_true(ge$cabe)
  expect_gte(ge$hueco, ge$u - 1e-9)                       # de la última sub-fila a la primera de la siguiente: u + hueco >= 2u
  r <- .cg_render(espec)
  marcas <- sort(.cg_y(r$xml, "puntos:marca"))
  pasos <- diff(marcas)
  sub <- min(pasos)
  entre <- sort(pasos, decreasing = TRUE)[1:6]            # los seis saltos entre las siete preguntas
  expect_true(all(entre > 2 * sub - 1e-3))
  expect_length(.cg_y(r$xml, "puntos:filete_pregunta"), 6L)
  # El rótulo, centrado en el bloque de sus sub-filas.
  rot <- .cg_y(r$xml, "puntos:rotulo")
  bloques <- vapply(split(marcas, rep(seq_len(7), each = 3)), mean, 0)
  expect_true(all(abs(sort(rot) - bloques) < 0.02))
})

test_that("S7: con tres grupos y más de ocho preguntas avisa que se puede partir; con siete no, y nunca se parte sola", {
  # Gonzalo dejó "Diferencias por ciclo" (tres grupos, siete preguntas) en una lámina: partida en 4 y 3 se veía vacía.
  # Con tres grupos la lámina nativa admite hasta siete preguntas (27 sub-filas): el aviso queda para quien llame con más.
  av9 <- character(0)
  withCallingHandlers(.lam_contraste_grupos_aviso(list(grupos = c("a", "b", "c"), rotulos = paste("P", 1:9), modo = "grupos")),
                      message = function(m) { av9 <<- c(av9, conditionMessage(m)); invokeRestart("muffleMessage") })
  expect_true(any(grepl("Con tres grupos y 9 preguntas la lectura se aprieta; puedes partirla en dos láminas con \"Continuar desde\".", av9, fixed = TRUE)))
  r7 <- .cg_render(.cg_espec(7L))
  expect_false(any(grepl("la lectura se aprieta", r7$avisos, fixed = TRUE)))
  expect_length(.cg_y(r7$xml, "puntos:rotulo"), 7L)
})
