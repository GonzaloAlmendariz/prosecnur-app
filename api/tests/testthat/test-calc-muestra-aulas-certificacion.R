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
