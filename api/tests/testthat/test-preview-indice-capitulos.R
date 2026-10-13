# G2 (Gonzalo, 2026-10-13): con una ilustración del recetario elegida, «Ver cómo queda» del índice mostraba la lámina
# antigua de cinco focos. El índice toma sus capítulos de los separadores del plan; el mini-plan de la vista previa no
# los tenía, el índice quedaba vacío y caía a la ruta anterior.

plan <- list(
  list(id = "i", tipo = "p_slide_indice", payload = list(meta = list(composicion = "facetas"))),
  list(id = "s1", tipo = "p_slide_seccion", payload = list(titulo = "Perfil del encuestado")),
  list(id = "s1a", tipo = "p_slide_seccion", payload = list(titulo = "Estudiantes", meta = list(nivel = "subcapitulo"))),
  list(id = "g", tipo = "p_slide_1_grafico", payload = list()),
  list(id = "s2", tipo = "p_slide_seccion", payload = list(titulo = "Cuerpo académico"))
)

test_that("un índice sin capítulos escritos recibe los del plan, sin los subcapítulos", {
  r <- .preview_con_capitulos(plan[[1]], plan)
  expect_identical(r$payload$secciones, "Perfil del encuestado\nCuerpo académico")
  expect_identical(r$payload$meta$composicion, "facetas")
})

test_that("si el índice ya declara capítulos, o la lámina no es un índice, no se toca", {
  propio <- list(id = "i", tipo = "p_slide_indice", payload = list(secciones = "Mi capítulo"))
  expect_identical(.preview_con_capitulos(propio, plan), propio)
  expect_identical(.preview_con_capitulos(plan[[4]], plan), plan[[4]])
  expect_identical(.preview_con_capitulos(plan[[1]], list(plan[[1]])), plan[[1]])
})

test_that("con los capítulos del plan el índice sale nativo con su ilustración, no con los focos de la plantilla", {
  skip_if_not_installed("officer")
  caps <- strsplit(.preview_con_capitulos(plan[[1]], plan)$payload$secciones, "\n")[[1]]
  expect_true(.lam_indice_cabe(caps))
  expect_false(.lam_indice_cabe(character(0)))   # lo que tenía la vista previa: ruta anterior
})
