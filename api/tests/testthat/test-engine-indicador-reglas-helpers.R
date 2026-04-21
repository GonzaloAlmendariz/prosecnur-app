test_that("helpers ind_* manejan códigos y observados", {
  x <- c("1", "", NA, "NA", "2")

  expect_identical(ind_es(x, "1"), c(TRUE, FALSE, FALSE, FALSE, FALSE))
  expect_identical(ind_en(x, c("1", "2")), c(TRUE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(ind_alguna_obs(x), c(TRUE, FALSE, FALSE, FALSE, TRUE))
  expect_identical(ind_todas_obs(x), c(TRUE, FALSE, FALSE, FALSE, TRUE))
})

test_that("helpers lógicos ind_* exigen largos consistentes", {
  expect_error(ind_alguna(c(TRUE, FALSE), c(TRUE)), "largos inconsistentes")
  expect_error(ind_todas(c(TRUE, FALSE), c(TRUE)), "largos inconsistentes")
  expect_error(ind_ninguna(c(TRUE, FALSE), c(TRUE)), "largos inconsistentes")
})

test_that("helpers variádicos ind_* funcionan con variables directas", {
  d <- data.frame(
    a = c("1", "2", ""),
    b = c("2", "2", "1"),
    stringsAsFactors = FALSE
  )

  expect_identical(ind_alguna_en(d$a, d$b, codigos = "1"), c(TRUE, FALSE, TRUE))
  expect_identical(ind_todas_en(d$a, d$b, codigos = c("1", "2")), c(TRUE, TRUE, FALSE))
  expect_identical(ind_alguna_obs(d$a, d$b), c(TRUE, TRUE, TRUE))
  expect_identical(ind_todas_obs(d$a, d$b), c(TRUE, TRUE, FALSE))
})

test_that("integración nueva: indicador con `cuando` y referencias `nivel_<code>`", {
  d <- data.frame(
    P17_1 = c("1", NA, "2", NA),
    P17_2 = c(NA, "1", NA, "2"),
    P18 = c("2", "1", "1", "2"),
    stringsAsFactors = FALSE
  )

  ind_nuevo <- indicador(
    nombre = "acceso",
    niveles = list(
      nivel("1", "Reciente", cuando = ~ ind_alguna(ind_es(P17_1, "1"), ind_es(P17_2, "1"))),
      nivel("2", "No reciente", cuando = ~ !nivel_1 & ind_es(P18, "1")),
      nivel("3", "No atendido", cuando = ~ !nivel_1 & ind_es(P18, "2"))
    )
  )

  out <- reporte_indicadores(d, list(ind_nuevo), prefijo = "", verbose = FALSE)
  expect_identical(as.character(out$acceso), c("1", "1", "2", "3"))
})

test_that("solo_observados = TRUE deja NA cuando no hay dato en vía nueva", {
  d <- data.frame(
    P33_1 = c("1", "2", NA),
    P33_2 = c("", "", NA),
    stringsAsFactors = FALSE
  )

  ind_p33 <- indicador(
    nombre = "p33_conocimiento",
    niveles = list(
      nivel("1", "Conoce", cuando = ~ ind_alguna_en(P33_1, P33_2, codigos = "1")),
      nivel("2", "No conoce", cuando = ~ ind_alguna_obs(P33_1, P33_2) & !nivel_1)
    ),
    solo_observados = TRUE
  )

  out <- reporte_indicadores(d, list(ind_p33), prefijo = "", verbose = FALSE)
  expect_identical(as.character(out$p33_conocimiento), c("1", "2", NA))
})

test_that("indicador() falla si se mezcla `cuando` y `usa`", {
  n1 <- nivel("1", "A", cuando = ~ TRUE)
  n2 <- nivel("2", "B", usa = "B")

  expect_error(
    indicador(
      nombre = "mix",
      niveles = list(n1, n2),
      definidores = list(B = ~ TRUE)
    ),
    "No mezcles `cuando` y `usa`"
  )
})

test_that("vía antigua usa + definidores + grupo sigue operativa con deprecación", {
  d <- data.frame(
    P17_1 = c("1", NA, "2", NA),
    P17_2 = c(NA, "1", NA, "2"),
    P18 = c("2", "1", "1", "2"),
    stringsAsFactors = FALSE
  )

  ind_viejo <- NULL
  expect_warning(
    ind_viejo <- indicador(
      nombre = "acceso_viejo",
      grupos = list(P17 = suppressWarnings(grupo(P17_1, P17_2))),
      definidores = list(
        A = ~ ind_alguna_en(P17, codigos = "1"),
        B = ~ !A & ind_es(P18, "1"),
        C = ~ !A & ind_es(P18, "2")
      ),
      niveles = list(
        nivel("1", "Reciente", usa = "A"),
        nivel("2", "No reciente", usa = "B"),
        nivel("3", "No atendido", usa = "C")
      )
    ),
    "deprecad"
  )

  out <- reporte_indicadores(d, list(ind_viejo), prefijo = "", verbose = FALSE)
  expect_identical(as.character(out$acceso_viejo), c("1", "1", "2", "3"))
})

test_that("aliases viejos fueron retirados y muestran mensaje guiado", {
  d <- data.frame(P1 = c("1", "2"), stringsAsFactors = FALSE)
  ind_old <- indicador(
    nombre = "old_alias",
    niveles = list(
      nivel("1", "A", cuando = ~ es(P1, "1"))
    )
  )

  expect_error(
    reporte_indicadores(d, list(ind_old), prefijo = "", verbose = FALSE),
    "fue retirado\\. Usa `ind_es\\(\\)`",
    perl = TRUE
  )
})

test_that("cuando no permite referencia a niveles futuros", {
  expect_error(
    indicador(
      nombre = "bad_refs",
      niveles = list(
        nivel("1", "A", cuando = ~ !nivel_2),
        nivel("2", "B", cuando = ~ ind_es(x, "1"))
      )
    ),
    "niveles no permitidos"
  )
})

test_that("indicador() falla si se pasa `prioridad`", {
  expect_error(
    indicador(
      nombre = "bad_prioridad",
      niveles = list(nivel("1", "A", cuando = ~ TRUE)),
      prioridad = "primero"
    ),
    "prioridad.*eliminado"
  )
})

test_that("verbose usa lenguaje humano y no imprime líneas técnicas antiguas", {
  d <- data.frame(
    P17_1 = c("1", NA, "2", NA),
    P17_2 = c(NA, "1", NA, "2"),
    P18 = c("2", "1", "1", "2"),
    stringsAsFactors = FALSE
  )

  ind_humano <- indicador(
    nombre = "ind_Acceso_Salud",
    etiqueta = "Acceso a servicios de salud",
    niveles = list(
      nivel("1", "Atendidos en los ultimos 6 meses", cuando = ~ ind_alguna(ind_es(P17_1, "1"), ind_es(P17_2, "1"))),
      nivel("2", "Atendidos alguna vez, pero no en los ultimos 6 meses", cuando = ~ !nivel_1 & ind_es(P18, "1")),
      nivel("3", "No atendidos", cuando = ~ !nivel_1 & ind_es(P18, "2"))
    )
  )

  msgs <- testthat::capture_messages(
    reporte_indicadores(d, list(ind_humano), prefijo = "", verbose = TRUE)
  )
  txt <- paste(msgs, collapse = "\n")

  expect_match(txt, "Base evaluada:", fixed = TRUE)
  expect_match(txt, "Variables usadas:", fixed = TRUE)
  expect_match(txt, "Resultado: cumplen =", fixed = TRUE)
  expect_match(txt, "No cumple el nivel 1", fixed = TRUE)
  expect_false(grepl("\\(No cumple el nivel 1\\)", txt, perl = TRUE))
  expect_false(grepl("Modo reglas:", txt, fixed = TRUE))
  expect_false(grepl("Definidores a validar:", txt, fixed = TRUE))
  expect_false(grepl("Nivel lógica", txt, fixed = TRUE))
  expect_false(grepl("Prioridad:", txt, fixed = TRUE))
})

test_that("verbose muestra diagnóstico humano de no asignación", {
  d <- data.frame(
    P33_1 = c("1", "2", NA),
    P33_2 = c("", "", NA),
    stringsAsFactors = FALSE
  )

  ind_conoce <- indicador(
    nombre = "ind_Conocimiento",
    etiqueta = "Conocimiento",
    niveles = list(
      nivel("1", "Conoce", cuando = ~ ind_alguna_en(P33_1, P33_2, codigos = "1")),
      nivel("2", "No conoce", cuando = ~ ind_alguna_obs(P33_1, P33_2) & !nivel_1)
    ),
    solo_observados = TRUE
  )

  msgs <- testthat::capture_messages(
    reporte_indicadores(d, list(ind_conoce), prefijo = "", verbose = TRUE)
  )
  txt <- paste(msgs, collapse = "\n")

  expect_match(txt, "No se asignó nivel a 1 fila\\(s\\)\\.", perl = TRUE)
  expect_match(txt, "Sin respuesta en variables evaluadas: 1", fixed = TRUE)
  expect_match(txt, "Con respuesta pero sin cumplir reglas: 0", fixed = TRUE)
  expect_false(grepl("no matchearon", txt, ignore.case = TRUE))
})
