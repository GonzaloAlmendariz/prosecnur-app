# El motor sabe cuantas aulas necesita cada facultad y no decia cuantas HAY.
#
# Medido en HSVG2026, componente por facultad: LETRAS Y CIENCIAS HUMANAS
# requiere 16 aulas y tiene exactamente 16 —todas titulares, ninguna para
# reemplazar—; ARQUITECTURA usa 36 de 56 y las 20 que sobran no llegan a una
# reserva por titular; CIENCIAS E INGENIERIA usa 49 de 592 y sostiene las 11 que
# pide el diseño. Ninguna de las tres situaciones se publicaba.
#
# Es la causa de lo que se veia al sortear 190 titulares: 110 recibian menos de
# las once reservas pedidas, alguno UNA sola. Una facultad no puede dar reservas
# que no tiene, y eso se sabe ANTES de sortear.

test_that("las reservas sostenibles salen de las aulas que sobran", {
  # 56 aulas y 36 titulares: sobran 20, que no alcanzan para una a cada uno.
  expect_equal(.cm_aulas_reservas_sostenibles(56, 36), 0L)
  # 592 para 49: sobran 543, o sea 11 por titular.
  expect_equal(.cm_aulas_reservas_sostenibles(592, 49), 11L)
  expect_equal(.cm_aulas_reservas_sostenibles(16, 16), 0L)
  # Sin cifras utilizables no se inventa un cero, que se leeria como «medido».
  expect_true(is.na(.cm_aulas_reservas_sostenibles(NA, 10)))
  expect_true(is.na(.cm_aulas_reservas_sostenibles(50, 0)))
})

test_that("los cuatro estados distinguen situaciones distintas", {
  # Ni para los titulares.
  expect_equal(.cm_aulas_estado_margen(10, 16, 11), "insuficiente")
  # Exactamente las de los titulares: no sobra NI UNA.
  expect_equal(.cm_aulas_estado_margen(16, 16, 11), "sin_reservas")
  # Sobran 20, pero ni una POR TITULAR (floor(20/36)=0): el unico corto real.
  expect_equal(.cm_aulas_estado_margen(56, 36, 11), "reservas_cortas")
  # Gonzalo (2026-08-18): la profundidad de la cadena (11) NO es un
  # requerimiento — sostener menos de 11 ya no fabrica alerta. DERECHO
  # sostiene 8 y esta HOLGADO.
  expect_equal(.cm_aulas_estado_margen(440, 46, 11), "holgado")
  expect_equal(.cm_aulas_estado_margen(592, 49, 11), "holgado")
  expect_equal(.cm_aulas_estado_margen(NA, 16, 11), "desconocido")
})

test_that("`sin_reservas` no se confunde con `reservas_cortas`", {
  # EL defecto de la primera version: decia «todas son titulares» a Arquitectura,
  # que usa 36 de 56 y tiene 20 libres. Un aviso con una cifra falsa es peor que
  # no avisar.
  corto <- .cm_aulas_aviso_margen("reservas_cortas", "ARQUITECTURA", 56, 36, 0L, 11)
  expect_true(grepl("36 de sus 56", corto, fixed = TRUE))
  expect_true(grepl("las 20 que sobran", corto, fixed = TRUE))
  expect_false(grepl("todas son titulares", corto, fixed = TRUE))

  sin <- .cm_aulas_aviso_margen("sin_reservas", "LETRAS", 16, 16, 0L, 11)
  expect_true(grepl("todas son titulares", sin, fixed = TRUE))
})

test_that("cada aviso lleva las cifras que lo justifican", {
  # Un aviso sin cifras es una impresion; con ellas el analista decide.
  corto <- .cm_aulas_aviso_margen("reservas_cortas", "ARQUITECTURA", 56, 36, 0L, 11)
  expect_true(grepl("56", corto, fixed = TRUE))
  expect_true(grepl("las 20 que sobran", corto, fixed = TRUE))
  # La profundidad de la cadena NO es meta: el aviso ya no dice «pide el
  # diseño» ni compara contra 11.
  expect_false(grepl("pide el dise", corto, fixed = TRUE))
  # Una facultad holgada no genera ruido, sostenga 8 u 11.
  expect_equal(.cm_aulas_aviso_margen("holgado", "DERECHO", 440, 46, 8L, 11), "")
  expect_equal(.cm_aulas_aviso_margen("holgado", "CIENCIAS", 592, 49, 11L, 11), "")
})

.cmf_frame <- function(por_facultad) {
  filas <- do.call(rbind, lapply(names(por_facultad), function(fac) {
    n <- por_facultad[[fac]]
    data.frame(
      classroom_id = paste0(fac, "-", seq_len(n)),
      faculty = fac, included = TRUE, stringsAsFactors = FALSE
    )
  }))
  list(aula_frame = filas)
}

.cmf_estudio <- function(estrato, requeridas) {
  list(componentes = list(list(resultado = list(aulas_por_estrato = list(
    list(estrato = estrato, aulas_base = requeridas)
  )))))
}

test_that("el margen se adjunta con las aulas INCLUIDAS de esa facultad", {
  fr <- .cmf_frame(list("LETRAS Y CIENCIAS HUMANAS" = 16, "DERECHO" = 440))
  out <- calc_muestra_aulas_adjuntar_margen(
    .cmf_estudio("LETRAS Y CIENCIAS HUMANAS", 16L), fr, profundidad = 11
  )
  m <- out$componentes[[1]]$resultado$aulas_por_estrato[[1]]$margen
  expect_equal(m$aulas_disponibles, 16L)
  expect_equal(m$aulas_requeridas, 16L)
  expect_equal(m$aulas_sobrantes, 0L)
  expect_equal(m$estado, "sin_reservas")
  expect_true(nzchar(m$aviso))
})

test_that("las aulas EXCLUIDAS no cuentan como disponibles", {
  # Una facultad con 149 aulas de las que solo 16 pasan los criterios tiene 16
  # para sortear, no 149. Contar las excluidas volveria el aviso optimista.
  fr <- .cmf_frame(list("LETRAS Y CIENCIAS HUMANAS" = 16))
  fr$aula_frame <- rbind(fr$aula_frame, data.frame(
    classroom_id = paste0("X", 1:133), faculty = "LETRAS Y CIENCIAS HUMANAS",
    included = FALSE, stringsAsFactors = FALSE
  ))
  disp <- .cm_aulas_disponibles_por_facultad(fr)
  expect_equal(disp[[.cm_aulas_scalar(.cm_criterios_fac_key("LETRAS Y CIENCIAS HUMANAS"), "")]], 16L)
})

test_that("sin marco el margen queda en desconocido y no inventa cifras", {
  out <- calc_muestra_aulas_adjuntar_margen(.cmf_estudio("DERECHO", 46L), NULL, 11)
  m <- out$componentes[[1]]$resultado$aulas_por_estrato[[1]]$margen
  expect_true(is.na(m$aulas_disponibles))
  expect_equal(m$estado, "desconocido")
  expect_equal(m$aviso, "")
})

test_that("el bloque es aditivo y no pisa lo que el motor calculo", {
  fr <- .cmf_frame(list("DERECHO" = 440))
  est <- .cmf_estudio("DERECHO", 46L)
  est$componentes[[1]]$resultado$aulas_por_estrato[[1]]$cuota <- 483L
  est$componentes[[1]]$resultado$aulas_por_estrato[[1]]$avg_conglomerado <- 20
  out <- calc_muestra_aulas_adjuntar_margen(est, fr, 11)
  fila <- out$componentes[[1]]$resultado$aulas_por_estrato[[1]]
  expect_equal(fila$cuota, 483L)
  expect_equal(fila$avg_conglomerado, 20)
  expect_equal(fila$aulas_base, 46L)
})
