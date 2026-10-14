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
  # Y la pieza interna de la dependencia: se prueba con láminas de dos gráficos que la declaran (abajo).
  esperados <- setdiff(.graf_names(), c("p_dim_foda", "p_mapa_cobertura_territorial", "p_filtro_subpregunta"))
  expect_equal(setdiff(esperados, graf), character(0))

  tipos <- unique(vapply(plan, `[[`, "", "tipo"))
  # La población antigua salió del recetario y el editor la migra al abrir (graficos_migrar_poblacion.R): el catálogo
  # no la usa, o abriría con «Cambios al abrir el plan» (Gonzalo, 2026-10-14).
  antiguas <- names(.GRAFICOS_POBLACION_ANTIGUA)
  expect_equal(intersect(tipos, antiguas), character(0))
  expect_equal(setdiff(.slide_names(), c(tipos, antiguas)), character(0))
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

# La lámina nativa compara `resaltar` contra el rótulo (lamina_categorica.R): con un código («5») no pinta nada y la lámina
# promete una destacada que el PowerPoint no trae. Además, recortado a `top_n`, lo destacado tiene que entrar.
test_that("lo que el catálogo destaca en un ranking es un rótulo de la pregunta que entra en sus primeras", {
  b <- .catalogo_recetario_bases()
  ch <- .catalogo_recetario_choices()
  graficos <- unlist(lapply(.catalogo_recetario_plan(), function(s) Filter(function(x) is.list(x) && identical(x$graficador, "p_lollipop"), s$payload)), recursive = FALSE)
  con <- Filter(function(g) length(g$args$resaltar), graficos)
  expect_gt(length(con), 0L)
  for (g in con) {
    ref <- strsplit(g$args$var, "$", fixed = TRUE)[[1]]
    lista <- sub("^select_one ", "", b[[ref[1]]]$survey$type[b[[ref[1]]]$survey$name == ref[2]])
    opciones <- ch[ch$list_name == lista, ]
    frec <- table(factor(b[[ref[1]]]$data[[ref[2]]], levels = opciones$name))
    primeras <- opciones$label[match(names(sort(frec, decreasing = TRUE))[seq_len(g$args$top_n %||% nrow(opciones))], opciones$name)]
    expect_true(all(g$args$resaltar %in% opciones$label), info = paste(g$args$resaltar, collapse = ", "))
    expect_true(all(g$args$resaltar %in% primeras), info = paste(primeras, collapse = ", "))
  }
})
