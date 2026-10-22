# HSyVbG 2026: dummies `P26.1` con 1 = «Angustia» y `P26_recod.1` rotuladas sólo con la
# opción. En el SAV van 0 = No, 1 = Sí y la recodificada lleva pregunta + opción.

inst_dummies <- function() list(
  survey = data.frame(
    name = c("P26", "P26_recod", "P3"),
    type = c("select_multiple emo", "select_multiple emo_r", "select_one gen"),
    label = c("¿Qué emociones te provocó?", "¿Qué emociones te provocó? (codificada)", "Género"),
    stringsAsFactors = FALSE
  ),
  var_labels = list(P26 = "¿Qué emociones te provocó?")
)

test_that("las dummies de una múltiple quedan en No/Sí y la recod con la pregunta", {
  df <- data.frame(id = 1:3)
  df[["P26.1"]] <- haven::labelled(c(1, 0, NA), labels = c(No = 0, Angustia = 1),
                                   label = "¿Qué emociones te provocó? Angustia")
  df[["P26_recod.1"]] <- structure(c(1, 0, NA), labels = c(`0` = "No", `1` = "Sí"), label = "Angustia")
  df[["P3"]] <- haven::labelled(c(1, 2, 1), labels = c(Mujer = 1, Hombre = 2))

  out <- .bases_dummies_si_no(df, inst_dummies())

  expect_identical(names(attr(out[["P26.1"]], "labels")), c("No", "Sí"))
  expect_identical(attr(out[["P26.1"]], "label"), "¿Qué emociones te provocó? Angustia")
  expect_identical(attr(out[["P26_recod.1"]], "label"), "¿Qué emociones te provocó? Angustia")
  expect_identical(attr(out[["P3"]], "labels"), c(Mujer = 1, Hombre = 2))
  expect_identical(as.numeric(out[["P26.1"]]), c(1, 0, NA))
})

test_that("el SAV exportado trae las dummies en No/Sí", {
  skip_if_not_installed("haven")
  df <- data.frame(id = 1:3)
  df[["P26.1"]] <- haven::labelled(c(1, 0, NA), labels = c(No = 0, Angustia = 1), label = "Emociones Angustia")
  path <- tempfile(fileext = ".sav")
  withr::local_envvar(PROSECNUR_SAV_WRITER = "haven")
  .bases_export_sav(df, inst_dummies(), path)
  leido <- haven::read_sav(path)
  expect_identical(unname(attr(leido[["P26.1"]], "labels")), c(0, 1))
  expect_identical(names(attr(leido[["P26.1"]], "labels")), c("No", "Sí"))
})

test_that("la original llega como texto y sólo su recod es múltiple: sus dummies igual van a No/Sí", {
  inst <- inst_dummies()
  inst$survey$type[inst$survey$name == "P26"] <- "text"
  df <- data.frame(id = 1:2)
  df[["P26.1"]] <- haven::labelled(c(1, 0), labels = c(No = 0, Angustia = 1))
  out <- .bases_dummies_si_no(df, inst)
  expect_identical(names(attr(out[["P26.1"]], "labels")), c("No", "Sí"))
})

test_that("sin madre en el instrumento basta 0 = No y la etiqueta pregunta + opción", {
  df <- data.frame(id = 1:2)
  df[["P11.1"]] <- haven::labelled(c(1, 0), labels = c(No = 0, Visual = 1),
                                   label = "¿Qué tipo de discapacidad tienes? Visual")
  df[["sel.1"]] <- haven::labelled(c(1, 0), labels = c(`No seleccionado` = 0, Seleccionado = 1),
                                   label = "Caso seleccionado")
  out <- .bases_dummies_si_no(df, inst_dummies())
  expect_identical(names(attr(out[["P11.1"]], "labels")), c("No", "Sí"))
  expect_identical(names(attr(out[["sel.1"]], "labels")), c("No seleccionado", "Seleccionado"))
})
