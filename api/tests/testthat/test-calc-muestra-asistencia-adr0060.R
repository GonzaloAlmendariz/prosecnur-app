# D4 — Tasas del glosario ADR 0060 en la serie semanal y los embudos.
#
# El ADR 0060 (docs/adrs/0060-vocabulario-del-embudo-de-aulas.md) prohíbe
# `asistentes / elegibles`: mezcla universos —numerador con no elegibles,
# denominador sin ellos— y produce valores imposibles (>100 %; en la base
# PUCP 2025, 31 de 194 aulas, máximo 230 %). Las fórmulas sancionadas:
#
#   asistencia_elegibles = asistentes_elegibles / elegibles   (acotada a 1)
#   pct_ya_medidas       = ya_medidas / asistentes_elegibles
#   asistentes_elegibles = asistentes − presentes_no_elegibles
#
# Hoy calc_muestra_asistencia_referencia.R publica en la serie semanal
# `asistencia = .cm_asist_ratio(asistentes, elegibles)` (tasa prohibida, puede
# superar 1) y `pct_ya_medidas = .cm_asist_ratio(ya_medidas, asistentes)`
# (denominador inflado con los no elegibles), y repite el denominador inflado
# en los embudos por celda (.cm_asist_embudo_por).
#
# Contrato congelado (verde): la serie semanal no publica ninguna tasa de
# asistencia > 1 (con datos sucios: NA o marca, nunca un valor imposible), y
# pct_ya_medidas usa asistentes_elegibles = asistentes − no_elegibles como
# denominador, en la serie y en los embudos.
#
# Fixture (modelo del arnés de test-calc-muestra-asistencia-referencia.R):
# base v2 con glosario completo. La semana 1 son solo dos aulas donde el
# aplicador contó más presentes que elegibles (elegibles 10, asistentes 23 —
# el caso HUM113-0238 del ADR); las semanas 2 y 3 son limpias.

.adr0060_fixture <- function() {
  n_limpias <- 22L
  n <- n_limpias + 2L
  datos <- data.frame(
    `CURSO-HORARIO` = sprintf("CH-%03d", seq_len(n)),
    `STATUS DE APLICACIÓN` = rep("APLICADA", n),
    `MATRICULADOS TOTALES` = rep(40, n),
    `N° ASISTENTES EN AULA` = rep(30, n),
    `TOTAL ENVIADAS` = rep(24, n),
    `TOTAL LARGAS` = rep(20, n),
    `N° ASISTENTES QUE NO RESPONDIERON` = rep(6, n),
    `RANGO - HORARIO` = rep("Regular", n),
    facultad = c(rep("Facultad Desborde", 2L), rep("Facultad Limpia", n_limpias)),
    tipo_sesion = rep("Teórica", n),
    # Glosario del encuentro (ADR 0060): elegibles, ya_medidas, no_elegibles,
    # no_efectivas. "MATRICULADOS POBLACIÓN" es el alias de entrada histórico
    # de `elegibles`.
    `MATRICULADOS POBLACIÓN` = rep(35, n),
    ya_medidas = rep(2, n),
    no_elegibles = rep(1, n),
    no_efectivas = rep(3, n),
    semana = c(1L, 1L, rep(2L, n_limpias / 2L), rep(3L, n_limpias / 2L)),
    check.names = FALSE
  )
  # Las dos aulas de la semana 1: más presentes que elegibles (el aplicador
  # contó cabezas, no elegibilidad). Identidad A = E + no_respondieron intacta.
  datos$`MATRICULADOS POBLACIÓN`[1:2] <- 10
  datos$`N° ASISTENTES EN AULA`[1:2] <- 23
  datos$`TOTAL ENVIADAS`[1:2] <- 20
  datos$`TOTAL LARGAS`[1:2] <- 18
  datos$`N° ASISTENTES QUE NO RESPONDIERON`[1:2] <- 3
  datos$no_elegibles[1:2] <- 4
  datos
}

.adr0060_out <- function() {
  calc_muestra_asistencia_referencia(.adr0060_fixture(), bootstrap_n = 50L)
}

.adr0060_semana <- function(out, semana) {
  hit <- Filter(function(f) identical(f$semana, as.integer(semana)), out$serie_campo$filas)
  expect_length(hit, 1L)
  hit[[1L]]
}

test_that("D4: la serie semanal no publica ninguna tasa de asistencia mayor que 1", {
  out <- .adr0060_out()
  expect_true(out$cobertura$glosario_completo)

  # HOY ROJO: la semana 1 publica asistencia = 46/20 = 2.3, la tasa
  # `asistentes / elegibles` que el ADR 0060 prohíbe por mezclar universos.
  # Verde: toda tasa de asistencia publicada es NA (o intervalo/marca) o <= 1;
  # nunca un valor imposible.
  for (fila in out$serie_campo$filas) {
    campos_asistencia <- grep("^asistencia", names(fila), value = TRUE)
    expect_gt(length(campos_asistencia), 0L)
    for (campo in campos_asistencia) {
      valor <- suppressWarnings(as.numeric(fila[[campo]]))
      expect_true(
        !is.finite(valor) || valor <= 1 + 1e-9,
        info = sprintf(
          "Semana %d publica %s = %s (> 1): numerador con no elegibles, denominador sin ellos (tasa prohibida por ADR 0060).",
          fila$semana, campo, format(valor)
        )
      )
    }
  }
})

test_that("D4: pct_ya_medidas de la serie usa asistentes_elegibles como denominador", {
  out <- .adr0060_out()

  # Semana limpia (sin desborde): ya = 22, asistentes = 330, no_elegibles = 11.
  # HOY ROJO: publica 22/330 (denominador inflado con no elegibles).
  # Verde: 22 / (330 - 11) = ya_medidas / asistentes_elegibles.
  semana2 <- .adr0060_semana(out, 2L)
  expect_equal(semana2$ya_medidas, 22)
  expect_equal(semana2$asistentes, 330)
  expect_equal(semana2$no_elegibles, 11)
  expect_equal(
    semana2$pct_ya_medidas,
    semana2$ya_medidas / (semana2$asistentes - semana2$no_elegibles),
    tolerance = 1e-9,
    info = paste(
      "pct_ya_medidas divide entre todos los presentes; el ADR 0060 exige",
      "ya_medidas / asistentes_elegibles (asistentes - no_elegibles):",
      "el traslape queda subestimado."
    )
  )
})

test_that("D4: pct_ya_medidas de los embudos por celda usa asistentes_elegibles como denominador", {
  out <- .adr0060_out()
  embudo_fac <- Filter(
    function(e) identical(e$dimension_key, "facultad"),
    out$embudos
  )
  expect_length(embudo_fac, 1L)
  limpia <- Filter(
    function(f) identical(f$celda_label, "Facultad Limpia"),
    embudo_fac[[1L]]$filas
  )
  expect_length(limpia, 1L)
  fila <- limpia[[1L]]

  # Facultad limpia: ya = 44, asistentes = 660, no_elegibles = 22.
  # HOY ROJO: .cm_asist_embudo_por publica 44/660. Verde: 44/(660-22).
  expect_equal(fila$ya_medidas, 44)
  expect_equal(fila$asistentes, 660)
  expect_equal(fila$no_elegibles, 22)
  expect_equal(
    fila$pct_ya_medidas,
    fila$ya_medidas / (fila$asistentes - fila$no_elegibles),
    tolerance = 1e-9,
    info = paste(
      "El embudo por celda repite el denominador inflado de la serie:",
      "pct_ya_medidas debe medir el traslape sobre asistentes_elegibles."
    )
  )
})

# H1/H2 (ADR 0060 §198-203) — el embudo de una celda cuyo conteo de campo no
# cierra. Caso HUM113-0238: el aplicador conto mas cabezas que elegibles habia
# en lista (elegibles 10, asistentes 23 por aula). En la Facultad Desborde del
# fixture: elegibles 20, asistentes 46, no_elegibles 8, ya_medidas 4,
# efectivas 36, no_efectivas 6, presentes 46-4-8 = 34.
test_that("H1/H2: el embudo de una celda con desborde publica NA + residual, nunca una tasa imposible", {
  out <- .adr0060_out()
  embudo_fac <- Filter(
    function(e) identical(e$dimension_key, "facultad"),
    out$embudos
  )
  expect_length(embudo_fac, 1L)
  desborde <- Filter(
    function(f) identical(f$celda_label, "Facultad Desborde"),
    embudo_fac[[1L]]$filas
  )
  expect_length(desborde, 1L)
  fila <- desborde[[1L]]

  # Absolutos intactos para el diagnostico.
  expect_equal(fila$elegibles, 20)
  expect_equal(fila$asistentes, 46)
  expect_equal(fila$no_elegibles, 8)
  expect_equal(fila$ya_medidas, 4)
  expect_equal(fila$efectivas, 36)

  # H1: asistentes_elegibles es cota, no observacion; el bruto 46-8 = 38
  # desborda a los 20 elegibles y se capa a la identidad, divulgandolo.
  expect_equal(
    fila$asistentes_elegibles, 20,
    info = "asistentes_elegibles debe caparse a elegibles cuando el bruto desborda."
  )
  expect_true(
    isTRUE(fila$residual_negativo),
    info = "El cap de identidad debe divulgarse con la marca residual de la celda."
  )

  # H2: pct_ausencia = (20-46)/20 = -1.3 es imposible -> NA, nunca negativa.
  expect_true(
    is.na(fila$pct_ausencia),
    info = sprintf("pct_ausencia publica %s; una perdida negativa no es un dato.", format(fila$pct_ausencia))
  )
  # efectividad = 36/34 > 1 es imposible -> NA; y nunca > 1.
  expect_true(
    !is.finite(as.numeric(fila$efectividad)) || fila$efectividad <= 1 + 1e-9,
    info = sprintf("efectividad publica %s (> 1).", format(fila$efectividad))
  )
  expect_true(is.na(fila$efectividad))
  # pct_ya_medidas = 4/20 = 0.2 sigue siendo publicable y nunca > 1.
  expect_equal(fila$pct_ya_medidas, 4 / 20, tolerance = 1e-9)
  expect_lte(fila$pct_ya_medidas, 1)

  # H1: el intervalo de asistencia de elegibles viaja en la celda y toda cota
  # publicada vive en [0, 1] con min <= max.
  expect_true(all(c("asistencia_elegibles_min", "asistencia_elegibles_max") %in% names(fila)))
  minimo <- as.numeric(fila$asistencia_elegibles_min)
  maximo <- as.numeric(fila$asistencia_elegibles_max)
  for (cota in list(minimo, maximo)) {
    expect_true(
      !is.finite(cota) || (cota >= 0 && cota <= 1 + 1e-9),
      info = sprintf("Una cota del intervalo publica %s fuera de [0, 1].", format(cota))
    )
  }
  if (is.finite(minimo) && is.finite(maximo)) expect_lte(minimo, maximo)
  # En este caso la cota superior es exactamente 1 (20 capados / 20) y la
  # inferior (36/20 = 1.8, imposible) va NA.
  expect_equal(maximo, 1, tolerance = 1e-9)
  expect_true(is.na(minimo))
})

test_that("H1/H2: la serie semanal con desborde capa asistentes_elegibles y acota su intervalo", {
  out <- .adr0060_out()
  semana1 <- .adr0060_semana(out, 1L)

  expect_equal(semana1$elegibles, 20)
  expect_equal(semana1$asistentes, 46)
  expect_equal(semana1$asistentes_elegibles, 20)
  expect_true(isTRUE(semana1$residual_negativo))
  expect_true(all(c("asistencia_elegibles_min", "asistencia_elegibles_max") %in% names(semana1)))
  expect_equal(as.numeric(semana1$asistencia_elegibles_max), 1, tolerance = 1e-9)
  expect_true(is.na(semana1$asistencia_elegibles_min))
  # efectividad de la semana = efectivas 36 / a_encuestar 34 > 1 -> NA.
  expect_true(is.na(semana1$efectividad))
  expect_equal(semana1$pct_ya_medidas, 4 / 20, tolerance = 1e-9)
})

# B2 (ADR 0060) — una celda de dimension con mas asistentes que matriculados y
# suficiencia propia (k >= 12): su tasa va NA + marca residual con los conteos
# intactos, y su publicacion degrada al global valido (o a sin_publicacion si
# el global tambien es invalido — ese caso lo cubre el arnes de jerarquias de
# test-calc-muestra-asistencia-referencia.R).
.b2_fixture_celda_desborde <- function() {
  n <- 24L
  desborde <- rep(c(TRUE, FALSE), each = n / 2L)
  data.frame(
    curso_horario = sprintf("CH-%03d", seq_len(n)),
    estado_aplicacion = "APLICADA",
    matriculados = rep(40L, n),
    asistieron = ifelse(desborde, 50L, 20L),
    enviadas = ifelse(desborde, 45L, 16L),
    validas = ifelse(desborde, 40L, 14L),
    no_respondieron = ifelse(desborde, 5L, 4L),
    rango_horario = "Regular",
    facultad = ifelse(desborde, "Facultad Desborde", "Facultad Limpia"),
    tipo_sesion = "Teórica",
    stringsAsFactors = FALSE
  )
}

test_that("B2: la celda desbordada publica NA + residual con conteos intactos y degrada al global valido", {
  out <- calc_muestra_asistencia_referencia(.b2_fixture_celda_desborde(), bootstrap_n = 50L)

  # Global valido: 840 asistentes sobre 960 matriculados, sin marca.
  expect_equal(out$global$matriculados, 960)
  expect_equal(out$global$asistentes, 840)
  expect_equal(out$global$tasa, 840 / 960, tolerance = 1e-9)
  expect_false(isTRUE(out$global$residual_negativo))

  fac <- Filter(
    function(d) identical(d$dimension_key, "facultad"),
    out$dimensiones
  )
  expect_length(fac, 1L)
  celdas <- fac[[1L]]$filas
  desborde <- Filter(function(f) identical(f$celda_label, "Facultad Desborde"), celdas)
  limpia <- Filter(function(f) identical(f$celda_label, "Facultad Limpia"), celdas)
  expect_length(desborde, 1L)
  expect_length(limpia, 1L)
  celda <- desborde[[1L]]

  # Conteos intactos (600 asistentes sobre 480 matriculados) con tasa NA +
  # marca; el IC calculado sobre una tasa imposible tampoco se publica.
  expect_equal(celda$k, 12L)
  expect_equal(celda$matriculados, 480)
  expect_equal(celda$asistentes, 600)
  expect_true(is.na(celda$tasa))
  expect_true(isTRUE(celda$residual_negativo))
  expect_true(is.na(celda$ic_low) && is.na(celda$ic_high))
  expect_identical(celda$metodo_ic, "no_aplica")

  # La publicacion degrada al global valido, sin clamp.
  expect_identical(celda$fuente_publicada, "global")
  expect_equal(celda$tasa_publicada, out$global$tasa, tolerance = 1e-12)
  expect_identical(as.integer(celda$k_publicada), as.integer(out$global$k))

  # La celda sana del mismo fixture publica su propia tasa: la degradacion es
  # de la celda invalida, no un apagon de la dimension.
  sana <- limpia[[1L]]
  expect_equal(sana$tasa, 240 / 480, tolerance = 1e-9)
  expect_false(isTRUE(sana$residual_negativo))
  expect_identical(sana$fuente_publicada, "celda")
})
