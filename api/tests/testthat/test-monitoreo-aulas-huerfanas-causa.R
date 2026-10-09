# El aviso de huérfanas dice la CAUSA, no sólo el hecho.
#
# Medido el 2026-09-22 (primer día de campo de CCSS Perfil 2026-II): 19
# huérfanas de 29 respuestas, y eran dos averías distintas —11 abiertas por
# enlace, sin recopilador, y 8 del QR de «CAPACITACION»/«PRUEBA»— metidas en un
# solo número. Cada una se arregla en un sitio distinto, así que el número solo
# no sirve para actuar.

test_that("sin huerfanas la frase afirma lo que se comprobo", {
  c0 <- monitoreo_aulas_huerfanas_causa(c(FALSE, FALSE), c("a1", "a2"))
  expect_identical(c0$total, 0L)
  expect_match(c0$frase, "Todas las respuestas válidas se atribuyeron")
})

test_that("las dos causas se cuentan por separado y los valores ajenos se nombran", {
  h <- c(TRUE, TRUE, TRUE, FALSE)
  ids <- c("", "CAPACITACION", "PRUEBA", "a1")
  d <- monitoreo_aulas_huerfanas_causa(h, ids)
  expect_identical(d$total, 3L)
  expect_identical(d$sin_recopilador, 1L)
  expect_identical(d$ajenas, 2L)
  expect_identical(d$valores, c("CAPACITACION", "PRUEBA"))
  expect_match(d$frase, "1 no trae recopilador")
  expect_match(d$frase, "2 traen uno que no es de ninguna aula del plan")
  # El valor concreto es lo que hace accionable el aviso: con él se declara en
  # `descartes` en un minuto, sin él se manda a revisar el plan, que está bien.
  expect_match(d$frase, "CAPACITACION, PRUEBA", fixed = TRUE)
})

test_that("una sola causa no arrastra la otra en cero", {
  solo_sin <- monitoreo_aulas_huerfanas_causa(c(TRUE, TRUE), c("", ""))
  expect_match(solo_sin$frase, "2 no traen recopilador")
  expect_false(grepl("no es de ninguna aula", solo_sin$frase))
  solo_ajenas <- monitoreo_aulas_huerfanas_causa(c(TRUE), c("ZZ"))
  expect_match(solo_ajenas$frase, "1 trae uno que no es de ninguna aula")
  expect_false(grepl("no trae recopilador", solo_ajenas$frase))
})

test_that("con muchos valores ajenos se nombran unos pocos y se dice cuantos faltan", {
  d <- monitoreo_aulas_huerfanas_causa(rep(TRUE, 5), c("a", "b", "c", "d", "e"))
  expect_match(d$frase, "y 2 más", fixed = TRUE)
})

test_that("sin identificadores alineados NO se inventa el reparto", {
  # La regla es la del bloque de avance: lo que no se midió no se publica como
  # cero. Un reparto inventado manda a arreglar la avería equivocada.
  d <- monitoreo_aulas_huerfanas_causa(c(TRUE, TRUE), character(0))
  expect_identical(d$total, 2L)
  expect_true(is.na(d$sin_recopilador))
  expect_match(d$frase, "^2 respuestas válidas no corresponden")
  expect_false(grepl("recopilador:", d$frase))
})

# =============================================================================
# El control y el numerador cuentan las mismas huérfanas
# =============================================================================
#
# El panel de control traía su propio emparejamiento —dos claves, sin
# normalizar— mientras el numerador del tablero usa tres, porque el QR de 2026
# viaja el CÓDIGO OPERATIVO (`CH 45`) y no el `classroom_id`. Una respuesta bien
# atribuida al avance salía en el control como huérfana, con el aviso en
# `warning`.
#
# Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: «29
# respuestas válidas no corresponden a ningún curso-horario» sobre 29
# respuestas, con 10 de ellas contadas en el avance de CH 45.

.mahc_plan <- function() list(
  list(classroom_id = "a1", collection_unit_id = "u1", operational_code = "CH 45",
       label = "a1", faculty = "CIENCIAS SOCIALES", level = "6",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada")
)

test_that("una respuesta que trae el codigo operativo NO es huerfana en el control", {
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, plan = .mahc_plan(),
    source_mapping = list(collector_var = "collectorID")
  ))
  resp <- data.frame(
    collectorID = c("CH 45", "CH 45", "CAPACITACION", ""),
    stringsAsFactors = FALSE
  )
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg)
  detalle <- paste(unlist(d$validation), collapse = " ")
  # El test se cae si la frase deja de estar: un `expect_false` sobre un texto
  # vacío pasa siempre, y con él solo el caso verde sería indistinguible de
  # «el panel desapareció».
  expect_true(grepl("no corresponden a ning", detalle, fixed = TRUE))
  # Dos huérfanas, no cuatro: la de capacitación y la que no trae recopilador.
  expect_match(detalle, "2 respuestas válidas no corresponden", fixed = TRUE)
  # Y el código del propio plan no puede figurar como colector ajeno.
  expect_false(grepl("CH 45", detalle, fixed = TRUE))
  expect_match(detalle, "CAPACITACION", fixed = TRUE)
  # Y el avance dice el mismo número: es la comprobación de que hay UNA
  # atribución, no dos que casi coinciden.
  expect_identical(as.integer(d$avance_cuota$total$huerfanas), 2L)
})
