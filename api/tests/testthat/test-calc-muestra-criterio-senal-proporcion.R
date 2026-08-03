testthat::test_that("la señal de composición viaja en la unidad del control", {
  # G38 · Gonzalo: «la distribución y el boxplot debían hacer referencia al
  # porcentaje de su composición, no a la cantidad de alumnos elegibles […]
  # podemos hacer que la distribución tenga ejes del 0 al 100 porque es un
  # porcentaje».
  #
  # El motor calcula la composición como razón (0–1) y el control la fija en
  # porcentaje. Publicarla como razón obliga al cliente a escalar, y escalar en
  # el cliente es exactamente lo que produjo el defecto de G25: un eje que
  # llegaba a 200 % porque se rotuló con la unidad del umbral un dato que era
  # otro.
  d <- .cm_criterio_radiografia_signal_distribution(
    c(0.40, 0.80, 1.00), "proporcion"
  )
  testthat::expect_equal(d$media, 220 / 3)
  testthat::expect_equal(d$min, 40)
  testthat::expect_equal(d$max, 100)
  testthat::expect_equal(d$p50, 80)
})

testthat::test_that("la escala de una proporción es del dominio, no del dato", {
  # Un eje ajustado al rango observado hace que «85 %» parezca el extremo de la
  # escala cuando es el 85 % de un máximo posible de 100.
  d <- .cm_criterio_radiografia_signal_distribution(c(0.10, 0.20, 0.30), "proporcion")
  testthat::expect_equal(d$escala$min, 0)
  testthat::expect_equal(d$escala$max, 100)
  # El resto de señales siguen leyendo su eje del dato.
  v <- .cm_criterio_radiografia_signal_distribution(c(10, 20, 30), "valor_criterio")
  testthat::expect_null(v$escala)
  testthat::expect_equal(v$max, 30)
})

testthat::test_that("n_fuera cuenta los cursos-horario que el corte deja fuera", {
  # La pregunta literal de Gonzalo: «no hay forma de saber cuántos perdemos por
  # el porcentaje que estamos aplicando». Es una cuenta sobre los datos, no una
  # resta de dos cifras ya publicadas, así que la hace el motor.
  d <- .cm_criterio_radiografia_signal_distribution(
    c(0.40, 0.75, 0.80, 0.95), "proporcion", umbral = 0.80
  )
  testthat::expect_equal(d$umbral_aplicado, 80)
  # 40 y 75 quedan fuera; 80 cumple —el corte es «al menos», como lo evalúa
  # `.cm_criterios_flag` con `signal >= threshold`.
  testthat::expect_equal(d$n_fuera, 2L)
})

testthat::test_that("sin criterio activo no se anuncia ningún corte", {
  # NA es «no aplica». Un 0 diría «no se queda fuera ninguno», que es una
  # afirmación distinta y falsa cuando el criterio ni siquiera está encendido.
  d <- .cm_criterio_radiografia_signal_distribution(c(0.40, 0.90), "proporcion")
  testthat::expect_true(is.na(d$n_fuera))
  testthat::expect_true(is.na(d$umbral_aplicado))
})

testthat::test_that("la señal publica el contrato v2 completo", {
  # Sin bigotes ni histograma la tarjeta de tres capas no se puede dibujar, y el
  # cliente no puede derivarlos: sólo el motor tiene los datos por curso-horario.
  d <- .cm_criterio_radiografia_signal_distribution(
    c(0.10, 0.42, 0.55, 0.61, 0.78, 0.80, 0.83, 0.91), "proporcion", umbral = 0.60
  )
  for (campo in c("min", "max", "bigote_inf", "bigote_sup", "n_atipicos",
                  "n_atipicos_inf", "n_atipicos_sup", "hist_breaks",
                  "hist_counts", "escala", "umbral_aplicado", "n_fuera")) {
    testthat::expect_true(campo %in% names(d), info = campo)
  }
  testthat::expect_true(length(d$hist_breaks) >= 2L)
  testthat::expect_equal(sum(d$hist_counts), 8L)
})

testthat::test_that("el umbral aplicado sale de la config que evalúa el criterio", {
  # Dos sitios donde vive el mismo umbral es la forma más barata de que la
  # tarjeta enseñe un corte y el motor aplique otro.
  cfg <- list(filters = list(require_min_prevalence = TRUE, min_prevalence_pct = 0.65))
  testthat::expect_equal(.cm_criterios_umbral_composicion("c7", cfg), 0.65)
  # Criterio apagado: no hay corte que anunciar.
  cfg_off <- list(filters = list(require_min_prevalence = FALSE, min_prevalence_pct = 0.65))
  testthat::expect_null(.cm_criterios_umbral_composicion("c7", cfg_off))
  # Un criterio que no es de composición no tiene umbral de composición.
  testthat::expect_null(.cm_criterios_umbral_composicion("modality", cfg))
})

testthat::test_that("la whitelist deja pasar el contrato v2 entero", {
  # Trampa medida en la casa: un campo nuevo que no se declara en la whitelist
  # se cae sin dejar rastro. El payload sale bien formado, el front encuentra
  # `undefined`, y el defecto se lee como «el motor no lo publica».
  d <- .cm_criterio_radiografia_signal_distribution(
    c(0.10, 0.42, 0.55, 0.61, 0.78, 0.80), "proporcion", umbral = 0.60
  )
  s <- .pulso_sanitize_calc_muestra_criteria_signal(d)
  for (campo in c("min", "max", "bigote_inf", "bigote_sup", "n_atipicos",
                  "hist_breaks", "hist_counts", "escala", "umbral_aplicado",
                  "n_fuera")) {
    testthat::expect_true(campo %in% names(s), info = campo)
  }
  testthat::expect_equal(s$escala$max, 100)
  # 10, 42 y 55 quedan por debajo de 60. (Escribí 2 de memoria y el motor me
  # corrigió: la cuenta la hace él, y por eso está donde está.)
  testthat::expect_equal(s$n_fuera, 3L)
})

testthat::test_that("la tabla de descartes es exacta en cada posición del control", {
  # G39 · Gonzalo: «no hay forma de saber cuántas CH descartamos (y su porcentaje
  # con que nos quedamos respecto al total) para poder tomar una decisión más
  # meditada». Esa cifra tiene que cambiar mientras se arrastra, y el motor no
  # puede recalcularla por cada píxel.
  #
  # Sumar los cubos del histograma en el cliente parecía suficiente y falla justo
  # en el umbral: los cubos son cerrados por la derecha, así que un curso-horario
  # que está EXACTAMENTE en el corte cae del lado de los descartados aunque el
  # criterio lo admita (`>= umbral`). Medido con umbral 80: el cliente sumaba 5 y
  # el motor contaba 4. En el extremo de la escala no hay convención que lo
  # arregle. Así que la cuenta la hace quien tiene los datos, en los 21 cortes.
  v <- c(0.42, 0.55, 0.61, 0.78, 0.80, 0.83, 0.91, 0.95, 1.00)
  d <- .cm_criterio_radiografia_signal_distribution(v, "proporcion", umbral = 0.80)
  testthat::expect_equal(length(d$n_fuera_por_corte), 21L)
  for (u in seq(0, 100, by = 5)) {
    i <- which(d$hist_breaks == u)
    testthat::expect_equal(
      as.integer(d$n_fuera_por_corte[[i]]),
      as.integer(sum(v * 100 < u)),
      info = paste("corte", u)
    )
  }
  # El corte aplicado y la tabla dicen lo mismo: una sola verdad, dos accesos.
  testthat::expect_equal(
    as.integer(d$n_fuera),
    as.integer(d$n_fuera_por_corte[[which(d$hist_breaks == 80)]])
  )
})

testthat::test_that("una señal que no es proporción no publica tabla de cortes", {
  # El control de un conteo no se mueve en pasos fijos sobre una escala cerrada,
  # así que la tabla no tendría dónde indexarse. Vacía es «no aplica».
  d <- .cm_criterio_radiografia_signal_distribution(c(10, 20, 30), "valor_criterio")
  testthat::expect_equal(length(d$n_fuera_por_corte), 0L)
})
