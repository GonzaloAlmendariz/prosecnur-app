# Certificación por facultad de la selección (calc_muestra_aulas_certificacion.R).
#
# Gonzalo, textual: «tener aulas tal que nos garantice tener la cantidad de
# alumnos que nos hemos trazado en la meta (…) la selección de aulas tiene que
# certificarse de esa forma». La pregunta es de ALUMNOS, no de aulas: una
# facultad con sus N aulas puede no llegar si le tocaron aulas chicas — el
# fixture rompe el empate con ese caso exacto.

.cert_estudio <- function() list(
  componentes = list(list(resultado = list(aulas_por_estrato = list(
    list(estrato = "FACULTAD GRANDE", cuota = 100, margen = list(aulas_requeridas = 3)),
    list(estrato = "FACULTAD CHICA", cuota = 60, margen = list(aulas_requeridas = 2)),
    list(estrato = "FACULTAD VACIA", cuota = 10, margen = list(aulas_requeridas = 1))
  ))))
)

.cert_seleccion <- function() list(
  selection = data.frame(
    classroom_id = c("G1", "G2", "G3", "H1", "H2"),
    faculty = c(rep("FACULTAD GRANDE", 3), rep("FACULTAD CHICA", 2)),
    sample_role = "titular",
    wave = "M1",
    # GRANDE: 3 aulas x 50 elegibles = 150; CHICA: 2 aulas CHICAS = 30.
    eligible_n = c(50, 50, 50, 15, 15),
    stringsAsFactors = FALSE
  )
)

.cert_referencia <- function() list(diseno = list(tasa_respuesta_asumida = 0.8))

test_that("certifica por ALUMNOS: cumple la que carga elegibles, no la que junta aulas", {
  out <- calc_muestra_aulas_adjuntar_certificacion(
    .cert_seleccion(), .cert_estudio(), .cert_referencia()
  )
  cert <- out$certificacion_facultad
  expect_identical(cert$schema, "calc_muestra_aulas_certificacion_facultad_v1")
  filas <- setNames(cert$filas, vapply(cert$filas, `[[`, "", "faculty_key"))
  g <- filas$facultad_grande
  # 150 x 0.8 = 120 >= 100: certificada con margen 1.2.
  expect_identical(g$estado, "certificada")
  expect_equal(g$efectivas_esperadas, 120)
  expect_equal(g$margen, 1.2)
  # CHICA tiene SUS 2 aulas pero cargan 30 x 0.8 = 24 < 60: NO CUBRE.
  ch <- filas$facultad_chica
  expect_identical(ch$estado, "no_cubre")
  expect_match(ch$aviso, "Faltan 36")
  # VACIA no recibió titulares: el estado dice la causa, no un 0 medido.
  expect_identical(filas$facultad_vacia$estado, "sin_titulares")
  # Resumen: 1 certificada de 2 evaluables -> ok FALSE.
  expect_identical(cert$certificadas, 1L)
  expect_identical(cert$evaluables, 2L)
  expect_false(cert$ok)
})

test_that("sin tasa declarada NO se afirma la certificación", {
  out <- calc_muestra_aulas_adjuntar_certificacion(.cert_seleccion(), .cert_estudio(), NULL)
  filas <- setNames(out$certificacion_facultad$filas,
                    vapply(out$certificacion_facultad$filas, `[[`, "", "faculty_key"))
  expect_identical(filas$facultad_grande$estado, "sin_tasa")
  # Los elegibles SÍ quedan medidos; lo que falta es la tasa, y el aviso lo dice.
  expect_equal(filas$facultad_grande$elegibles_titulares, 150)
  expect_match(filas$facultad_grande$aviso, "tasa")
  expect_identical(out$certificacion_facultad$evaluables, 0L)
})

test_that("aditiva e inocua: sin estudio o sin selección, todo queda intacto", {
  sel <- .cert_seleccion()
  expect_identical(calc_muestra_aulas_adjuntar_certificacion(sel, NULL, NULL), sel)
  expect_identical(calc_muestra_aulas_adjuntar_certificacion(NULL, .cert_estudio(), NULL), NULL)
  con <- calc_muestra_aulas_adjuntar_certificacion(sel, .cert_estudio(), .cert_referencia())
  expect_identical(con$selection, sel$selection)
})

test_that("una tasa fuera de (0, 1] se trata como no declarada", {
  ref_rota <- list(diseno = list(tasa_respuesta_asumida = 70.38))
  out <- calc_muestra_aulas_adjuntar_certificacion(.cert_seleccion(), .cert_estudio(), ref_rota)
  expect_true(is.na(out$certificacion_facultad$tasa_esperada))
  filas <- setNames(out$certificacion_facultad$filas,
                    vapply(out$certificacion_facultad$filas, `[[`, "", "faculty_key"))
  expect_identical(filas$facultad_grande$estado, "sin_tasa")
})

test_that("las cuotas de hombre y mujer se certifican por celda", {
  # El engine ya sub-distribuye la cuota por sexo (distribucion_sub); la
  # certificación la lee de ahí y la enfrenta a los elegibles por sexo de las
  # titulares (sex_top_*). El fixture rompe el empate: GRANDE cubre el total
  # pero su celda de MUJERES queda corta.
  estudio <- .cert_estudio()
  estudio$componentes[[1]]$resultado$distribucion_sub <- list(
    list(estrato = "FACULTAD GRANDE", sub = "F", N = 700, n = 70),
    list(estrato = "FACULTAD GRANDE", sub = "M", N = 300, n = 30)
  )
  sel <- .cert_seleccion()
  sel$selection$sex_top_1 <- c("F", "F", "F", "F", "F")
  sel$selection$sex_top_1_n <- c(20, 20, 20, 10, 10)
  sel$selection$sex_top_2 <- c("M", "M", "M", "M", "M")
  sel$selection$sex_top_2_n <- c(30, 30, 30, 5, 5)
  out <- calc_muestra_aulas_adjuntar_certificacion(sel, estudio, .cert_referencia())
  filas <- setNames(out$certificacion_facultad$filas,
                    vapply(out$certificacion_facultad$filas, `[[`, "", "faculty_key"))
  g <- filas$facultad_grande
  # Total: 150 x 0.8 = 120 >= 100, certificada…
  expect_identical(g$estado, "certificada")
  # …pero MUJERES: 60 elegibles x 0.8 = 48 < 70 -> la celda NO cubre.
  sx <- setNames(g$sexo, vapply(g$sexo, `[[`, "", "sexo"))
  expect_false(sx$F$cubre)
  expect_equal(sx$F$esperadas, 48)
  expect_equal(sx$F$margen, 0.69)
  # HOMBRES: 90 x 0.8 = 72 >= 30, cubre con margen 2.4.
  expect_true(sx$M$cubre)
  expect_equal(sx$M$margen, 2.4)
  # Facultad sin distribucion_sub: sin bloque de sexo, no un bloque en cero.
  expect_length(filas$facultad_chica$sexo, 0L)
})

test_that("la certificación prefiere la τ del PROPIO diseño sobre la referencia", {
  # Certificar con la tasa observada de 2025 cuando el diseño asumió otra
  # sería sellar con un supuesto distinto del que dimensionó las aulas. El
  # fixture rompe el empate: con la referencia (0.8) GRANDE certificaría
  # (150×0.8=120≥100); con su τ (0.5) queda corta (75<100).
  estudio <- .cert_estudio()
  for (i in seq_along(estudio$componentes[[1]]$resultado$aulas_por_estrato)) {
    estudio$componentes[[1]]$resultado$aulas_por_estrato[[i]]$tau <- 0.5
  }
  out <- calc_muestra_aulas_adjuntar_certificacion(.cert_seleccion(), estudio, .cert_referencia())
  cert <- out$certificacion_facultad
  expect_identical(cert$tasa_fuente, "tau_disenio")
  expect_equal(cert$tasa_esperada, 0.5)
  filas <- setNames(cert$filas, vapply(cert$filas, `[[`, "", "faculty_key"))
  expect_identical(filas$facultad_grande$estado, "no_cubre")
  expect_equal(filas$facultad_grande$efectivas_esperadas, 75)
  expect_match(filas$facultad_grande$aviso, "diseño")
  # Sin τ en el diseño, el fallback a la referencia queda DECLARADO.
  out2 <- calc_muestra_aulas_adjuntar_certificacion(.cert_seleccion(), .cert_estudio(), .cert_referencia())
  expect_identical(out2$certificacion_facultad$tasa_fuente, "referencia")
})

# ── Plan 1b/E4: el metodo canonico suma las efectivas esperadas por aula ─────

.mk_sel_e4 <- function(con_esperadas = TRUE) {
  sel_df <- data.frame(
    classroom_id = c("A", "B"),
    sample_role = "titular",
    wave = "M1",
    faculty = "DERECHO",
    eligible_n = c(20, 40),
    stringsAsFactors = FALSE
  )
  if (con_esperadas) sel_df$efectivas_esperadas <- c(13.8, 20.0)
  list(selection = sel_df)
}

.mk_estudio_e4 <- function() {
  list(componentes = list(list(
    actor_id = "estudiantes_facultad",
    resultado = list(aulas_por_estrato = list(list(
      estrato = "DERECHO", cuota = 30, tau = 0.53
    )))
  )))
}

test_that("E4: con esperadas por aula la certificacion SUMA y declara el metodo", {
  sel <- calc_muestra_aulas_adjuntar_certificacion(.mk_sel_e4(TRUE), estudio = .mk_estudio_e4())
  fila <- sel$certificacion_facultad$filas[[1]]
  expect_identical(fila$metodo, "suma_esperadas")
  # 13.8 + 20.0 = 33.8 -> 34; cuota 30 -> certificada.
  expect_equal(fila$efectivas_esperadas, 34)
  expect_identical(fila$estado, "certificada")
  expect_match(fila$aviso, "aula por aula")
  # La tasa de la fila es la EFECTIVA derivada (33.8/60), no la plana.
  expect_equal(fila$tasa, round(33.8 / 60, 4))
})

test_that("E4 CONTROL: sin la columna, cae a tasa plana DECLARADA (retro-compat)", {
  sel <- calc_muestra_aulas_adjuntar_certificacion(.mk_sel_e4(FALSE), estudio = .mk_estudio_e4())
  fila <- sel$certificacion_facultad$filas[[1]]
  expect_identical(fila$metodo, "tasa_plana")
  # 60 x 0.53 = 31.8 -> 32.
  expect_equal(fila$efectivas_esperadas, 32)
  expect_match(fila$aviso, "tasa de rendimiento")
})

test_that("E4: una facultad con esperados PARCIALES no mezcla varas (cae a plana)", {
  base <- .mk_sel_e4(TRUE)
  base$selection$efectivas_esperadas[2] <- NA_real_
  sel <- calc_muestra_aulas_adjuntar_certificacion(base, estudio = .mk_estudio_e4())
  expect_identical(sel$certificacion_facultad$filas[[1]]$metodo, "tasa_plana")
})

