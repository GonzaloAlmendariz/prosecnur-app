# Regresion: el normalizador no debe vaciar la madre select_multiple cuando la
# UNICA opcion marcada es "otro" (dummy de OPCION `<parent>/other`). Antes,
# `.dn_match_sm_dummy_columns` excluia esa dummy junto con el TEXTO LIBRE
# `<parent>_other`, de modo que una fila "other-only" reconstruia NA y pisaba el
# valor crudo "other". Eso disparaba falsos positivos masivos en required/skip
# (240 inconsistencias espurias sobre PDM_Prueba) y borraba la categoria "other"
# de las frecuencias de analitica.

test_that("normalize_data_for_xlsform conserva 'other' en filas other-only y X+other", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_q", "text"),
      name = c("q", "q_other"),
      list_name = c("lst_q", NA),
      label = c("Servicios necesarios", "Otro servicio"),
      required = c("true", ""),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_q", "lst_q"),
      name = c("psico", "other"),
      label = c("Apoyo psicologico", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  # Data con convencion ODK: madre cruda + dummies de opcion `/` + texto libre `_`.
  raw <- data.frame(
    q = c("psico", "psico other", "other", NA_character_),
    `q/psico` = c(1, 1, 0, 0),
    `q/other` = c(0, 1, 1, 0),
    q_other = c("", "detalle 2", "detalle 3", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  nd <- normalize_data_for_xlsform(raw, inst)

  fila_other_only <- 3L
  fila_psico_other <- 2L

  # (a) La fila other-only reconstruye "other" y NO queda NA.
  expect_false(is.na(nd$q[fila_other_only]))
  expect_true("other" %in% strsplit(nd$q[fila_other_only], " ")[[1]])

  # (b) La fila psico + other conserva ambos tokens (antes se perdia "other").
  toks_mix <- strsplit(nd$q[fila_psico_other], " ")[[1]]
  expect_true(all(c("psico", "other") %in% toks_mix))

  # El texto libre `q_other` sobrevive como columna aparte (no se trata de dummy).
  expect_true("q_other" %in% names(nd))
  expect_identical(nd$q_other, raw$q_other)

  # La dummy de opcion `q/other` se consumio (dropped), no queda como columna.
  expect_false(any(c("q/psico", "q/other") %in% names(nd)))

  # Ninguna fila con opcion marcada quedo vacia (invariante del fix).
  emptied <- (!is.na(raw$q) & nzchar(raw$q)) & (is.na(nd$q) | !nzchar(nd$q))
  expect_false(any(emptied))
})

test_that("dummy de opcion aporta su token sin importar el NOMBRE de la opcion", {
  # Endurecimiento name-agnostic: la exclusion por PATRON DE NOMBRE se fue.
  # Ahora una opcion contribuye por su NATURALEZA (columna binaria 0/1), asi se
  # llame `specify` o sea un numero especial `96`. Solo el TEXTO LIBRE
  # `<parent>_other` (cadenas + survey var) queda fuera.
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_q", "text"),
      name = c("q", "q_other"),
      list_name = c("lst_q", NA),
      label = c("Servicios necesarios", "Otro servicio"),
      required = c("true", ""),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_q", 3),
      # Opciones con nombres deliberadamente adversos: `specify` (antes botada
      # por `[/.](specify|texto)$`), el valor especial `96` (Blanco/Viciado) y
      # `other` (antes botada por `_(other|...)$`).
      name = c("specify", "96", "other"),
      label = c("Especificar programa", "Blanco/Viciado", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  raw <- data.frame(
    q = c("specify", "96", "other", "specify 96"),
    `q/specify` = c(1, 0, 0, 1),
    `q/96` = c(0, 1, 0, 1),
    `q/other` = c(0, 0, 1, 0),
    # Texto libre de la opcion "other": cadenas, NO 0/1. Debe quedar fuera del
    # conteo de dummies pese a llamarse "_other".
    q_other = c("", "", "salud", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  nd <- normalize_data_for_xlsform(raw, inst)

  # (a) La opcion `specify` aporta su token (antes se botaba por el nombre).
  expect_true("specify" %in% strsplit(nd$q[1], " ")[[1]])
  # (b) La opcion numerica `96` aporta su token.
  expect_true("96" %in% strsplit(nd$q[2], " ")[[1]])
  # (c) La fila other-only reconstruye "other" y no queda NA.
  expect_false(is.na(nd$q[3]))
  expect_true("other" %in% strsplit(nd$q[3], " ")[[1]])
  # Fila mixta: ambos tokens de opcion.
  expect_true(all(c("specify", "96") %in% strsplit(nd$q[4], " ")[[1]]))

  # El texto libre `q_other` sobrevive intacto y NO se consumio como dummy.
  expect_true("q_other" %in% names(nd))
  expect_identical(nd$q_other, raw$q_other)

  # Las tres dummies de opcion se consumieron (dropped).
  expect_false(any(c("q/specify", "q/96", "q/other") %in% names(nd)))

  # Invariante: ninguna fila con marca quedo vacia.
  emptied <- (!is.na(raw$q) & nzchar(raw$q)) & (is.na(nd$q) | !nzchar(nd$q))
  expect_false(any(emptied))
})

test_that("normalize_data_for_xlsform reconstruye SM SurveyMonkey sin madre (no regresion)", {
  # Path SM/SAV: solo dummies numeradas, sin columna madre. La opcion "otro"
  # llega como dummy con etiqueta y se matchea por label. El texto libre
  # `<parent>_other` (separador `_`) sigue excluido como no-dummy.
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_act", "text"),
      name = c("q0027", "q0027_other"),
      list_name = c("lst_act", NA),
      label = c("Actividades", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_act", 3),
      name = c("1", "2", "other"),
      label = c("Emprendimiento", "Voluntariado", "Otros:"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  raw <- data.frame(
    q0027_0001 = haven::labelled(c(NA, 1, NA), c("Otros:" = 1)),
    q0027_0002 = haven::labelled(c(1, NA, NA), c("Emprendimiento" = 1)),
    q0027_0003 = haven::labelled(c(1, NA, NA), c("Voluntariado" = 1)),
    q0027_other = c("", "Detalle", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(as.character(out$q0027), c("1 2", "other", NA))
  expect_true("q0027_other" %in% names(out))
  expect_false(any(c("q0027_0001", "q0027_0002", "q0027_0003") %in% names(out)))
})
