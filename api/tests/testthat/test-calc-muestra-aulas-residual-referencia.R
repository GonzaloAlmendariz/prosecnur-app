# El residual de una facultad SIN base suficiente se publica y NO se aplica.
#
# Decision de Gonzalo (2026-08-24), textual: derivarlo «con tal de que no
# exageremos las aulas a pedir; si no es asi, me parece correcto pero debe
# reportarse y quedar absolutamente claro».
#
# Medido sobre 2025, las nueve facultades sin factor propio tienen k = 2 a 11 y
# un intervalo de 0,246 a 0,736 de ancho. Con eso, aplicarlas seria calibrar
# contra ruido — pero callarlas seria peor: el residual observado de EDUCACION es
# 0,783 y el de ARQUITECTURA 1,377, y el equipo tiene que poder verlo.
#
# De ahi las DOS columnas: `factor_facultad` es lo que el modelo usa;
# `residual_ref` es lo que el historico vio. Colapsarlas haria que una facultad
# sin base pareciera calibrada.

.rref_frame <- function() data.frame(
  faculty = c("CIENCIAS E INGENIERIA", "EDUCACION", "SIN SELLO"),
  eligible_n = c(40, 20, 30),
  teacher_type = "DOCENTE CONTRATADO - CONTRATADO",
  stringsAsFactors = FALSE
)

.rref_cfg <- function() list(
  fuente = "historico", periodo = "2025", tau_base = 1,
  rendimiento_tramos = list(
    list(hasta = 15, tasa = 0.809), list(hasta = 25, tasa = 0.642),
    list(hasta = 35, tasa = 0.566), list(hasta = 50, tasa = 0.500),
    list(hasta = NA, tasa = 0.409)
  ),
  por_facultad = list(
    # Con base suficiente: se aplica.
    list(facultad = "CIENCIAS E INGENIERIA", tau = 0.972, k = 40, suficiencia = "suficiente"),
    # Sin base: viaja como referencia y NO toca el modelo.
    list(facultad = "EDUCACION", tau = 0.783, k = 7, suficiencia = "sin base",
         aplicar = FALSE, ic_low = 0.548, ic_high = 1.043)
  ))

.rref_anotado <- function() {
  f <- .cm_aulas_efectividad_anotar(
    .rref_frame(),
    .cm_efectividad_calibracion(list(efectividad = .rref_cfg()))
  )
  stats::setNames(split(f, seq_len(nrow(f))), f$faculty)
}

test_that("una facultad con base suficiente aplica su residual", {
  a <- .rref_anotado()[["CIENCIAS E INGENIERIA"]]
  expect_equal(a$factor_facultad, 0.972)
  expect_identical(a$facultad_k, 40L)
  expect_true(a$residual_aplicado)
  expect_equal(a$residual_ref, 0.972)
})

test_that("una facultad SIN base publica su residual y NO lo aplica", {
  a <- .rref_anotado()[["EDUCACION"]]
  # El modelo no la toca: sigue en 1 y sin k, como estaba declarado.
  expect_equal(a$factor_facultad, 1)
  expect_true(is.na(a$facultad_k))
  # Pero el dato queda a la vista, con su k y su intervalo.
  expect_false(a$residual_aplicado)
  expect_equal(a$residual_ref, 0.783)
  expect_identical(a$residual_ref_k, 7L)
  expect_equal(a$residual_ref_ic_low, 0.548)
  expect_equal(a$residual_ref_ic_high, 1.043)
})

test_that("una facultad sin entrada en el sello no inventa referencia", {
  a <- .rref_anotado()[["SIN SELLO"]]
  expect_equal(a$factor_facultad, 1)
  expect_true(is.na(a$residual_ref))
  expect_false(a$residual_aplicado)
})

test_that("el residual no aplicado NO mueve las efectivas esperadas", {
  # Es la comprobacion de que «reportar» no se colo en «corregir». EDUCACION
  # rinde 20 elegibles x R(16-25)=0,642 x factor 1 = 12,8. Con su residual
  # observado de 0,783 daria 10,1: la diferencia es justo lo que NO se aplica.
  a <- .rref_anotado()[["EDUCACION"]]
  expect_equal(a$efectivas_esperadas, round(20 * 0.642 * 1, 1))
  expect_false(isTRUE(all.equal(a$efectivas_esperadas, round(20 * 0.642 * 0.783, 1))))
})

test_that("`aplicar` ausente sigue significando SI, para no romper los sellos vigentes", {
  # Los seis residuales sellados del plan 1b no declaran `aplicar`; si la
  # ausencia se leyera como FALSE, el modelo perderia su calibracion entera sin
  # que ningun sello cambiara.
  ef <- .rref_cfg()
  ef$por_facultad[[2]]$aplicar <- NULL
  f <- .cm_aulas_efectividad_anotar(.rref_frame(), .cm_efectividad_calibracion(list(efectividad = ef)))
  edu <- f[f$faculty == "EDUCACION", ]
  expect_equal(edu$factor_facultad, 0.783)
  expect_true(edu$residual_aplicado)
})
