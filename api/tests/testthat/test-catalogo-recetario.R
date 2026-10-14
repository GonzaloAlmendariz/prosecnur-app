# El catálogo del recetario (docs/qa/checklist-catalogo-recetario-2026-10-14.md) cubre todo lo que el editor ofrece:
# si el registro suma un gráfico o una lámina, este test queda en rojo hasta que el catálogo lo incluya.

test_that("el plan del catálogo valida y cubre todos los gráficos vigentes y todos los tipos de lámina", {
  plan <- .catalogo_recetario_plan()
  v <- .validar_plan_json(list(slides = plan))
  expect_true(v$ok, info = paste(v$errors, collapse = "\n"))
  expect_equal(anyDuplicated(vapply(plan, `[[`, "", "id")), 0L)

  graficos_de <- function(s) {
    g <- Filter(function(x) is.list(x) && !is.null(x$graficador), s$payload)
    vapply(g, function(x) as.character(x$graficador), "")
  }
  graf <- unique(unlist(lapply(plan, graficos_de)))
  # Fuera a propósito: FODA (retirada del selector) y el mapa de cobertura (necesita contexto territorial; lámina de texto lo dice).
  esperados <- setdiff(.graf_names(), c("p_dim_foda", "p_mapa_cobertura_territorial"))
  expect_equal(setdiff(esperados, graf), character(0))

  tipos <- unique(vapply(plan, `[[`, "", "tipo"))
  expect_equal(setdiff(.slide_names(), tipos), character(0))
})

test_that("las bases sintéticas traen cada tipo de variable que el recetario necesita y se regeneran idénticas", {
  b <- .catalogo_recetario_bases()
  expect_setequal(names(b), c("docentes", "estudiantes", "egresados", "estudiantes_2018", "estudiantes_2021"))
  tipos <- unique(sub(" .*", "", unlist(lapply(b, function(x) x$survey$type))))
  expect_true(all(c("select_one", "select_multiple", "integer", "text") %in% tipos))
  # Acreditación: la misma pregunta en escalas distintas (5 y 4 puntos) y con otra caja en las etiquetas.
  expect_match(b$docentes$survey$type[b$docentes$survey$name == "serv_1"], "acuerdo5")
  expect_match(b$egresados$survey$type[b$egresados$survey$name == "p40_1"], "acuerdo_eg")
  expect_identical(.catalogo_recetario_bases(), b)
})

test_that("el plan del catálogo pasa la regla de escalas de la exportación con sus propios instrumentos", {
  inst <- lapply(.catalogo_recetario_bases(), function(x) list(survey = x$survey, choices = .catalogo_recetario_choices()))
  v <- .validar_plan_json(list(slides = .catalogo_recetario_plan()), inst_sources = inst)
  expect_true(v$ok, info = paste(v$errors, collapse = "\n"))
})
