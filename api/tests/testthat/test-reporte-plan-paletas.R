test_that("multiapiladas ordena segmentos por choices antes que por paleta", {
  if (!exists(".reporte_plan_ordered_stack_levels", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_plan_ppt.R"), envir = globalenv())
  }

  choices <- data.frame(
    list_name = rep("lst_acuerdo_4", 4),
    name = c("1", "2", "3", "4"),
    `label::es` = c(
      "Totalmente en desacuerdo 1",
      "2",
      "3",
      "Totalmente de acuerdo 4"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  observed <- c(
    "2",
    "3",
    "Totalmente en desacuerdo 1",
    "Totalmente de acuerdo 4"
  )

  expect_equal(
    .reporte_plan_ordered_stack_levels(
      "lst_acuerdo_4",
      observed,
      choices_use = choices,
      palette_names = observed
    ),
    c(
      "Totalmente en desacuerdo 1",
      "2",
      "3",
      "Totalmente de acuerdo 4"
    )
  )
})

test_that("paletas nombradas por codigo se resuelven contra labels de choices", {
  if (!exists(".reporte_plan_palette_for_levels", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_plan_ppt.R"), envir = globalenv())
  }

  choices <- data.frame(
    list_name = rep("lst_acuerdo_4", 4),
    name = c("1", "2", "3", "4"),
    `label::es` = c(
      "Totalmente en desacuerdo 1",
      "2",
      "3",
      "Totalmente de acuerdo 4"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  levels <- c(
    "Totalmente en desacuerdo 1",
    "2",
    "3",
    "Totalmente de acuerdo 4"
  )
  palette <- c(
    "1" = "#E52525",
    "2" = "#FF7A1A",
    "3" = "#F2C300",
    "4" = "#19A64A"
  )

  out <- .reporte_plan_palette_for_levels(
    "lst_acuerdo_4",
    levels,
    choices_use = choices,
    palette = palette
  )

  expect_equal(names(out), levels)
  expect_equal(
    unname(out),
    c("#E52525", "#FF7A1A", "#F2C300", "#19A64A")
  )
})

test_that("opciones Other especificar se limpian y se agregan antes de graficar", {
  if (!exists(".reporte_plan_clean_other_label_es", mode = "function", envir = globalenv())) {
    sys.source(file.path("../../R", "reporte_plan_ppt.R"), envir = globalenv())
  }

  expect_equal(
    .reporte_plan_clean_other_label_es(c(
      "Other (especificar)",
      "Other (please specify)",
      "Otro, por favor especificar",
      "Empresa"
    )),
    c("Otros", "Otros", "Otros", "Empresa")
  )

  tab <- data.frame(
    Opciones = c("A", "Other (especificar)", "Otros", "Sin datos", "Total"),
    n = c(2, 1, 0, 0, 3),
    stringsAsFactors = FALSE
  )

  out <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = FALSE)
  expect_equal(out$Opciones, c("A", "Otros"))
  expect_equal(out$n, c(2, 1))

  out_all <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = TRUE)
  expect_equal(out_all$Opciones, c("A", "Otros", "Sin datos"))
  expect_equal(out_all$n, c(2, 1, 0))
})

test_that("la paleta guardada se reparte por NOMBRE, no por el orden en que se guardo", {
  # Regresion del mazo de acreditacion (Conta 09-08): `as.character()` borraba
  # los nombres de la paleta y el reparto caia siempre a la rama posicional. En
  # una escala ordinal el orden guardado coincide con el de los niveles y el
  # error es invisible; en una dicotomia guardada {No, Si} contra niveles
  # {Si, No} los dos colores salen intercambiados.
  paleta <- c(No = "#9DC3E6", "Sí" = "#081F5C")

  out <- .reporte_plan_palette_for_levels(
    "lst_p11",
    levels = c("Sí", "No"),
    choices_use = NULL,
    palette = paleta
  )

  expect_equal(out[["Sí"]], "#081F5C")
  expect_equal(out[["No"]], "#9DC3E6")
})

test_that("una paleta con mas entradas que niveles sigue resolviendo por nombre", {
  # En multibase la misma lista acumula las categorias de varias bases: la
  # paleta trae Likert + Si/No juntos y solo algunas entradas son de esta
  # lamina. El reparto posicional le habria dado a «De acuerdo» el color de
  # «Totalmente en desacuerdo».
  paleta <- c(
    "Muy insatisfecho" = "#CA5651",
    "De acuerdo"       = "#ADD493",
    "No"               = "#9DC3E6",
    "Totalmente de acuerdo" = "#70AD47"
  )

  out <- .reporte_plan_palette_for_levels(
    "lst_p12",
    levels = c("De acuerdo", "Totalmente de acuerdo"),
    choices_use = NULL,
    palette = paleta
  )

  expect_equal(out[["De acuerdo"]], "#ADD493")
  expect_equal(out[["Totalmente de acuerdo"]], "#70AD47")
})

test_that("sin nombres utiles la paleta sigue cayendo al reparto posicional", {
  out <- .reporte_plan_palette_for_levels(
    "lst_x",
    levels = c("A", "B"),
    choices_use = NULL,
    palette = c("#111111", "#222222")
  )

  expect_equal(out[["A"]], "#111111")
  expect_equal(out[["B"]], "#222222")
})
