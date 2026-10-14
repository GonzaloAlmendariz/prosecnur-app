# Diferencias significativas entre públicos (recetario p111–p112; inventario de configuraciones, ítem 18). El cálculo se
# fija contra las cifras del recetario (propuestas_rescatables.R:203-216 y la lámina 112), que vienen de conteos reales.

test_that("dos públicos: la prueba y el intervalo de Newcombe dicen lo mismo en los seis temas del recetario", {
  x <- cbind(c(51, 47, 43, 39, 49, 48), c(133, 106, 91, 132, 99, 105))
  n <- cbind(c(52, 51, 52, 52, 51, 51), c(172, 133, 172, 172, 109, 109))
  r <- .sigpub_calcular(x, n)
  expect_identical(r$sig[, 1], (r$lo[, 1] > 0 | r$hi[, 1] < 0))
  expect_equal(round(r$p[1, ]), c(98, 77))
  expect_true(r$sig[1, 1]); expect_identical(r$letras[1, ], c("B", ""))     # «Conoce la misión»: docentes mayor que estudiantes
})

test_that("tres públicos: las letras de la lámina 112 del recetario", {
  # Conoce la misión (98 %, 77 %, 78 %) y Auditoría (96 %, 91 %, 98 %).
  x <- rbind(c(51, 133, 138), c(49, 99, 158)); n <- rbind(c(52, 172, 178), c(51, 109, 161))
  r <- .sigpub_calcular(x, n)
  expect_identical(r$letras[1, ], c("BC", "", ""))
  expect_identical(r$letras[2, ], c("", "", "B"))
  expect_equal(dim(r$d), c(2L, 3L))                                          # A−B, A−C, B−C
  # La letra y el punto lleno salen del mismo p ajustado: nunca se contradicen.
  for (i in 1:2) for (k in 1:3) {
    a <- r$pares[1, k]; b <- r$pares[2, k]
    mayor <- if (r$p[i, a] > r$p[i, b]) a else b; menor <- setdiff(c(a, b), mayor)
    expect_identical(grepl(LETTERS[menor], r$letras[i, mayor]), r$sig[i, k])
  }
})

test_that("un par sin base queda sin prueba, sin letra y sin punto", {
  r <- .sigpub_calcular(cbind(c(10), c(0)), cbind(c(20), c(0)))
  expect_true(is.na(r$d[1, 1])); expect_false(r$sig[1, 1]); expect_identical(r$letras[1, ], c("", ""))
})

test_that("por la ruta real la lámina nativa sale con su tabla de letras y sus paneles", {
  skip_if_not_installed("officer")
  mk <- function(n, si) { d <- data.frame(mision = c(rep("1", si), rep("2", n - si)), stringsAsFactors = FALSE); d }
  inst <- list(survey = data.frame(name = "mision", type = "select_one si_no", list_name = "si_no", label = "¿Conoce la misión?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "si_no", name = c("1", "2"), label = c("Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = list(docentes = mk(52, 51), estudiantes = mk(172, 133), egresados = mk(178, 138)),
    instrumento = list(docentes = inst, estudiantes = inst, egresados = inst), path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_significancia_publicos(vars = list(`Conoce la misión` = c("docentes$mision", "estudiantes$mision", "egresados$mision")),
                                                             corte = "Sí"), titulo = "Misión en tres públicos")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"); textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_true("prosecnur:grafico:significancia" %in% nombres)
  expect_true("BC" %in% textos)
  expect_equal(sum(nombres == "significancia:panel"), 3L)
  expect_true(any(grepl("Bonferroni", textos)))
})
