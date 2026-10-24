# Regresión G8 (CCSS Perfil 2026-II): «Otra persona responsable o tutor/a» salía como «Otros».
#
# Frecuencias (`.freq_clean_other_label_es`) y el mazo (`.reporte_plan_clean_other_label_es`) marcaban como «otro»
# toda etiqueta que EMPEZARA por otro/otra, y si dos opciones quedaban como «Otros» las sumaban. Es «otro» sólo la
# etiqueta que, quitado el «especifique», queda en otro/a/s.

etiquetas <- c(
  "Otra persona responsable o tutor/a",
  "Otro (especifique)",
  "Otros",
  "Otra, ¿cuál?",
  "Otro:",
  "Other (please specify)",
  "Otro, por favor especificar",
  "Otras actividades académicas",
  "Madre"
)
esperado <- c(
  "Otra persona responsable o tutor/a", "Otros", "Otros", "Otros", "Otros", "Otros", "Otros",
  "Otras actividades académicas", "Madre"
)

test_that("Frecuencias y el mazo sólo renombran la opción que es «otro» y nada más", {
  expect_equal(prosecnurapp:::.freq_clean_other_label_es(etiquetas), esperado)
  expect_equal(prosecnurapp:::.reporte_plan_clean_other_label_es(etiquetas), esperado)
})

test_that("Frecuencias ya no suma «Otra persona…» con el «Otro (especifique)»", {
  tab <- data.frame(
    Opciones = c("Madre", "Otra persona responsable o tutor/a", "Otro (especifique)", "Total"),
    n = c(10, 5, 2, 17), pct = c(10, 5, 2, 17) / 17 * 100,
    stringsAsFactors = FALSE
  )
  out <- prosecnurapp:::.freq_clean_option_labels_for_export(tab)
  expect_equal(out$Opciones, c("Madre", "Otra persona responsable o tutor/a", "Otros", "Total"))
  expect_equal(out$n, c(10, 5, 2, 17))
})
