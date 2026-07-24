# =============================================================================
# Puente opt-in de códigos especiales → excluir_opciones del plan (unidad 5.6b)
# =============================================================================
#
# Contrato (directiva del dueño — control explícito, nunca caja negra):
#   1) DEFAULT APAGADO: sin `excluir_codigos_especiales` en ningún nivel, la
#      cascada devuelve EXACTAMENTE lo histórico y las láminas no cambian.
#   2) Activado por config de la corrida (preset args) sin overrides: los
#      códigos especiales del codebook se excluyen de la lámina.
#   3) El usuario manda por lámina: FALSE en overrides apaga el puente aunque
#      el preset lo active; y sus `excluir_opciones` propios siguen aplicando
#      con la misma semántica de unión de siempre.

# Categorías visibles de la lámina: barras_categoricas las lleva en la data
# del ggplot (categoria_raw = valor crudo de la opción), no en capas de texto.
.codigos_plan_categorias <- function(p) {
  df <- p$data
  raw <- df$categoria_raw
  if (is.null(raw)) raw <- df$categoria
  unique(as.character(raw))
}

make_codigos_especiales_fixture <- function(remapeada = FALSE) {
  vals <- if (remapeada) {
    c("Bueno", "Bueno", "Malo", "No responde", "No responde")
  } else {
    c("1", "1", "2", "99", "99")
  }
  df <- data.frame(p1 = vals, stringsAsFactors = FALSE)
  attr(df$p1, "label") <- "Pregunta 1"

  choices <- if (remapeada) {
    data.frame(
      list_name = rep("lst_p1", 3),
      name = c("Bueno", "Malo", "No responde"),
      label = c("Bueno", "Malo", "No responde"),
      stringsAsFactors = FALSE
    )
  } else {
    data.frame(
      list_name = rep("lst_p1", 3),
      name = c("1", "2", "99"),
      label = c("Bueno", "Malo", "No responde"),
      stringsAsFactors = FALSE
    )
  }

  list(
    data = df,
    instrumento = list(
      survey = data.frame(
        name = "p1",
        type = "select_one lst_p1",
        list_name = "lst_p1",
        stringsAsFactors = FALSE
      ),
      choices = choices,
      orders_list = NULL
    )
  )
}

render_codigos_fixture <- function(fx, presets = NULL, grafico = NULL) {
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = grafico %||% p_barras_categoricas("p1")
    )
  )
  reporte_ppt_plan(
    data = fx$data,
    instrumento = fx$instrumento,
    plan = plan,
    presets = presets,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )
}

# ---- Normalizador y resolución de la cascada (unit) -------------------------

test_that("normalize distingue ausente, apagado explícito y códigos activos", {
  norm <- prosecnurapp:::.reporte_plan_codigos_especiales_normalize
  # Ausente: NULL, list() de jsonlite, NA lógico, strings vacíos.
  expect_null(norm(NULL))
  expect_null(norm(list()))
  expect_null(norm(NA))
  expect_null(norm(c("", "  ")))
  # Apagado explícito.
  expect_identical(norm(FALSE), character(0))
  # TRUE = default del codebook (el mismo que condiciona las tablas).
  expect_identical(norm(TRUE), c("96", "97", "98", "99"))
  # Vector de códigos del proyecto (numeric o character, con list de jsonlite).
  expect_identical(norm(c(94L, 99L)), c("94", "99"))
  expect_identical(norm(list("96", "99")), c("96", "99"))
})

test_that("en la cascada gana el nivel más específico (overrides > el > preset)", {
  activos <- prosecnurapp:::.reporte_plan_codigos_especiales_activos
  # Sin definición en ningún nivel: apagado.
  expect_identical(activos(NULL, NULL, NULL), character(0))
  # El preset activa, la lámina no dice nada: activo.
  expect_identical(activos(NULL, NULL, TRUE), c("96", "97", "98", "99"))
  # FALSE por lámina apaga aunque el preset active.
  expect_identical(activos(FALSE, NULL, TRUE), character(0))
  # Códigos por lámina reemplazan a los del preset.
  expect_identical(activos("94", NULL, TRUE), "94")
})

test_that("la cascada sin toggle es byte-idéntica a la unión histórica", {
  cascada <- prosecnurapp:::.reporte_plan_excluir_cascada
  historica <- prosecnurapp:::.reporte_plan_excluir_opciones
  expect_identical(
    cascada(
      list(excluir_opciones = "A"),
      list(excluir_opciones = "B"),
      list(excluir_opciones = "C")
    ),
    historica("A", "B", "C")
  )
  expect_identical(
    cascada(
      list(excluir_opciones = "A"),
      list(excluir_opciones = "B"),
      list(excluir_opciones = "C"),
      preset_args_extra = list(excluir_opciones = "D")
    ),
    historica("A", "D", "B", "C")
  )
  expect_null(cascada(list(), list(), list()))
})

test_that("activado, los códigos se suman como base y se expanden a etiqueta canónica", {
  cascada <- prosecnurapp:::.reporte_plan_excluir_cascada
  out <- cascada(
    list(excluir_codigos_especiales = c("99")),
    list(excluir_opciones = "Malo"),
    list()
  )
  # Lo del usuario sigue aplicando (unión histórica) + código y etiqueta canon.
  expect_true(all(c("Malo", "99", "No responde") %in% out))
})

# ---- Render end-to-end del plan ---------------------------------------------

test_that("apagado por default: la lámina histórica no cambia", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture()

  out_historico <- render_codigos_fixture(fx)
  cats <- .codigos_plan_categorias(out_historico$rendered[[1]])
  expect_true("99" %in% cats)
  expect_true("1" %in% cats)

  # list() vacío (forma jsonlite de "sin valor") tampoco activa nada: las
  # etiquetas renderizadas son idénticas a las históricas.
  out_vacio <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = list()))
  )
  expect_identical(
    .codigos_plan_categorias(out_vacio$rendered[[1]]),
    cats
  )
})

test_that("activado a nivel corrida (preset), la lámina excluye los códigos especiales", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture()

  out <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = TRUE))
  )
  cats <- .codigos_plan_categorias(out$rendered[[1]])
  expect_false(any(c("99", "No responde") %in% cats))
  expect_true(all(c("1", "2") %in% cats))
})

test_that("activado con la lista real de códigos del proyecto funciona igual", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture()

  out <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = c(96, 97, 98, 99)))
  )
  cats <- .codigos_plan_categorias(out$rendered[[1]])
  expect_false(any(c("99", "No responde") %in% cats))
  expect_true("1" %in% cats)
})

test_that("base remapeada por etiqueta: la exclusión alcanza a la etiqueta canónica", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture(remapeada = TRUE)

  out <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = TRUE))
  )
  cats <- .codigos_plan_categorias(out$rendered[[1]])
  expect_false("No responde" %in% cats)
  expect_true(all(c("Bueno", "Malo") %in% cats))
})

test_that("la lámina manda: FALSE en la lámina apaga el puente del preset", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture()

  out <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = TRUE)),
    # p_barras_categoricas ruta `...` a overrides: control por lámina.
    grafico = p_barras_categoricas("p1", excluir_codigos_especiales = FALSE)
  )
  cats <- .codigos_plan_categorias(out$rendered[[1]])
  expect_true("99" %in% cats)
})

test_that("los excluir_opciones propios del usuario siguen aplicando en unión", {
  skip_if_not_installed("ggplot2")
  fx <- make_codigos_especiales_fixture()

  out <- render_codigos_fixture(
    fx,
    presets = p_presets(barras_categoricas = list(excluir_codigos_especiales = TRUE)),
    grafico = p_barras_categoricas("p1", excluir_opciones = "Malo")
  )
  cats <- .codigos_plan_categorias(out$rendered[[1]])
  # "Malo" se excluyó vía su código "2" (el catálogo mapea etiqueta→código).
  expect_false(any(c("2", "Malo", "No responde", "99") %in% cats))
  expect_true("1" %in% cats)
})
