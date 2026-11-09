source("setup-load-all.R")

# D5, D6 y D7 (aprobados por Gonzalo, 2026-11-09, «Sí, los tres»): el eje del dumbbell con cuatro a cinco marcas, la
# diferencia sobria («+4» en negrita bajo «Diferencia»; el pie dice «Diferencia: A menos B, en puntos») y el borde blanco
# de las marcas también en el dumbbell clásico.

.dd_datos <- function(a, b, temas = paste("Tema", seq_along(a))) {
  data.frame(eje = rep(temas, 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = length(a)), levels = c("Docentes", "Estudiantes")),
             valor = c(a, b), stringsAsFactors = FALSE)
}
.dd_marcas <- function(e) length(seq(e[["lo"]], e[["hi"]], by = e[["paso"]]))

test_that("D5: el eje lleva de cuatro a cinco marcas, paso 10 en rangos medianos y 5 sólo en los muy estrechos", {
  expect_identical(.dumbbell_eje(c(44, 97)), c(lo = 40, hi = 100, paso = 20))      # Arte: 40, 60, 80, 100
  expect_identical(.dumbbell_eje(c(55, 80)), c(lo = 50, hi = 85, paso = 10))       # rango mediano: paso 10, cuatro marcas
  expect_identical(.dumbbell_eje(c(70, 96)), c(lo = 65, hi = 100, paso = 10))      # 65, 75, 85, 95 antes que cinco marcas
  expect_identical(.dumbbell_eje(c(84, 97)), c(lo = 80, hi = 100, paso = 5))       # rango estrecho: paso 5
  for (r in list(c(10, 95), c(30, 70), c(60, 88), c(0, 100), c(45, 55), c(5, 12))) {
    e <- .dumbbell_eje(r)
    expect_true(.dd_marcas(e) %in% 4:5, info = paste(r, collapse = "-"))
    expect_true(e[["lo"]] <= min(r) && e[["hi"]] >= max(r) && e[["lo"]] >= 0 && e[["hi"]] <= 100)
  }
  # Nunca un eje degenerado (lo == hi): con todo en 80 va de 75 a 90.
  e80 <- .dumbbell_eje(c(80, 80))
  expect_gt(e80[["hi"]], e80[["lo"]]); expect_true(.dd_marcas(e80) >= 4L)
  expect_identical(.dumbbell_eje(c(100, 100))[["hi"]], 100)
  # Las dos rutas usan la misma regla: el clásico (pesas) y el contraste del resumen.
  p <- graficar_dumbbell(.dd_datos(c(44, 60, 70), c(90, 97, 80)))
  expect_identical(attr(p, "pulso_espec")$eje, c(lo = 40, hi = 100, paso = 20))
  r <- graficar_dumbbell(.dd_datos(c(44, 60, 70), c(90, 97, 80)), estilo = "resumen")
  expect_identical(attr(r, "pulso_espec")$eje[["paso"]], 20)
})

test_that("D6: la diferencia va sin unidad («+4») y el pie dice quién menos quién, en puntos", {
  p <- graficar_dumbbell(.dd_datos(c(60, 50), c(56, 58)))
  e <- attr(p, "pulso_espec")
  expect_setequal(e$textos_diferencia, c("+4", "-8"))
  expect_identical(attr(p, "note_outside"), "Diferencia: Docentes menos Estudiantes, en puntos")
  expect_false(grepl("Diferencia", p$labels$subtitle %||% ""))
  # Quien quiere «pts», la escribe.
  expect_setequal(attr(graficar_dumbbell(.dd_datos(c(60, 50), c(56, 58)), etiqueta_brecha = "pts"), "pulso_espec")$textos_diferencia, c("+4 pts", "-8 pts"))
  # El contraste del resumen: con dos grupos, «A menos B»; con tres o más, el mayor menos el menor.
  r <- attr(graficar_dumbbell(.dd_datos(c(60, 50), c(56, 58)), estilo = "resumen"), "pulso_espec")
  expect_identical(.contraste_sentido_nota(r), "Diferencia: Docentes menos Estudiantes, en puntos")
  expect_identical(.contraste_sentido_nota(list(grupos = c("a", "b", "c"))), "Diferencia: el grupo mayor menos el menor, en puntos")
})

test_that("D7: las marcas del dumbbell clásico llevan borde blanco, en el ggplot y en la lámina nativa", {
  p <- graficar_dumbbell(.dd_datos(c(60, 50), c(56, 58)))
  capas <- Filter(function(l) inherits(l$geom, "GeomPoint"), p$layers)
  borde <- Filter(function(l) identical(l$aes_params$colour, "#FFFFFF") && identical(as.numeric(l$aes_params$shape), 21), capas)
  expect_length(borde, 1L)
  skip_if_not_installed("officer")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_pesas(doc, attr(p, "pulso_espec"), "Brecha", folio = 1)
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE); print(o$doc, target = f)
  x <- xml2::read_xml(unz(f, sprintf("ppt/slides/slide%d.xml", length(o$doc))))
  ln <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='pesas:punto_a']]/p:spPr/a:ln//a:srgbClr")
  expect_true(length(ln) > 0L && all(toupper(xml2::xml_attr(ln, "val")) == "FFFFFF"))
})
