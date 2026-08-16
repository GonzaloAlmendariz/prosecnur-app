# Un criterio sin señal en su columna no se pudo EVALUAR, y eso no es lo mismo
# que haberse evaluado y no recortar.
#
# Medido en una pila limpia: `formation` declarado en capa marco sobre una base
# que no trae esa columna publicaba `filas_pasan` = 4 de 4, igual que un
# criterio que sí se midió y dejó pasar a todos. Con ese conteo, la tarjeta del
# criterio afirmaba «está declarado y no filtra a nadie» — falso: no había con
# qué filtrar. Son justo las dos cosas que ese desglose existe para distinguir.

test_that("la columna sin señal se detecta en texto y en numero", {
  expect_false(.cm_criterios_columna_con_senal(NULL))
  expect_false(.cm_criterios_columna_con_senal(character(0)))
  expect_false(.cm_criterios_columna_con_senal(c("", "", "")))
  expect_false(.cm_criterios_columna_con_senal(c("  ", NA, "")))
  # "NA" como texto es lo que deja una lectura de Excel sin dato, no un valor.
  expect_false(.cm_criterios_columna_con_senal(c("NA", "NA")))
  expect_true(.cm_criterios_columna_con_senal(c("", "PREGRADO", "")))
  # `level` llega numerico: su ausencia es NA, no cadena vacia.
  expect_false(.cm_criterios_columna_con_senal(c(NA_real_, NA_real_)))
  expect_true(.cm_criterios_columna_con_senal(c(NA_real_, 5)))
})

test_that("el reporte marca evaluable segun haya senal", {
  sel <- list(byVariable = list(
    formation = list(scope = "alumno", kind = "flat", layer = "marco", values = list("PREGRADO"))
  ))
  vacio <- function(n) rep("", n)
  con <- calc_muestra_aulas_criterios_alumno(sel, list(
    student_id = c("A", "B"), formation = c("PREGRADO", "POSGRADO"),
    condition = vacio(2), age = c(NA_real_, NA_real_), faculty = vacio(2), level = c(NA_real_, NA_real_)
  ))
  sin <- calc_muestra_aulas_criterios_alumno(sel, list(
    student_id = c("A", "B"), formation = vacio(2),
    condition = vacio(2), age = c(NA_real_, NA_real_), faculty = vacio(2), level = c(NA_real_, NA_real_)
  ))
  expect_true(con$report$criterios$formation$evaluable)
  expect_false(sin$report$criterios$formation$evaluable)
})

test_that("un criterio no evaluable no excluye ni firma una razon", {
  # Hoy lo garantizan los propios evaluadores: con la columna vacia, tanto la
  # rama `flat` como la `numeric` dejan pasar a todo el mundo. Se fija aqui
  # porque es una propiedad de la que depende el resto —si un criterio que no
  # se pudo medir empezara a excluir, la exclusion citaria como motivo un
  # criterio que nunca corrio— y esa garantia no debe perderse al tocarlos.
  sel <- list(byVariable = list(
    formation = list(scope = "alumno", kind = "flat", layer = "marco", values = list("PREGRADO"))
  ))
  sin <- calc_muestra_aulas_criterios_alumno(sel, list(
    student_id = c("A", "B"), formation = c("", ""),
    condition = c("", ""), age = c(NA_real_, NA_real_), faculty = c("", ""), level = c(NA_real_, NA_real_)
  ))
  expect_true(all(sin$marco_ok))
  expect_true(all(!nzchar(sin$marco_razon)))

  # Mismo compromiso por la rama numerica, donde el vacio llega como NA.
  num <- calc_muestra_aulas_criterios_alumno(
    list(byVariable = list(age = list(scope = "alumno", kind = "numeric", layer = "marco",
                                      threshold = list(op = ">=", min = 18)))),
    list(student_id = c("A", "B"), formation = c("", ""), condition = c("", ""),
         age = c(NA_real_, NA_real_), faculty = c("", ""), level = c(NA_real_, NA_real_))
  )
  expect_false(num$report$criterios$age$evaluable)
  expect_true(all(num$marco_ok))
})
