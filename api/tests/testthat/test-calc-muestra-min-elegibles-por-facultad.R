# El mínimo de elegibles POR FACULTAD sobrevive a la falta de umbral general.
#
# `.cm_criterios_normalize_seleccion()` conserva `{byFaculty: {...}}` sin
# `threshold` porque la app manda el general sólo cuando el usuario lo cambia.
# Sus tres consumidores —marco, cascada viva y radiografía— repetían la guarda
# vieja `!is.finite(threshold)` y reemplazaban el objeto entero por uno con
# `byFaculty = list()`: la normalización salvaba los mínimos propios y el
# evaluador los tiraba tres líneas después, sin aviso.
#
# Medido el 2026-08-25 sobre HSVG26DEF con
# `minEligible = {threshold: NA, byFaculty: {ciencias_e_ingenieria: 20}}`:
# el marco dejó DENTRO 333 de las 899 aulas incluidas de Ingeniería con menos de
# 20 elegibles (una con 1) y NINGUNA fila excluida por `min_eligible_per_class`.

test_that("sin umbral general, los minimos por facultad se conservan", {
  min_elig <- list(threshold = NA_real_, byFaculty = list(ciencias_e_ingenieria = 20))

  efectivo <- .cm_criterios_min_elig_con_fallback(min_elig, 1L)

  # Lo que se perdía: la clave por facultad desaparecía del objeto efectivo.
  expect_identical(efectivo$byFaculty$ciencias_e_ingenieria, 20)
  # El general cae al piso legacy, que es lo correcto: las demás facultades no
  # declararon mínimo propio.
  expect_identical(efectivo$threshold, 1L)
})

test_that("el minimo por facultad excluye las aulas por debajo de su umbral", {
  min_elig <- .cm_criterios_min_elig_con_fallback(
    list(threshold = NA_real_, byFaculty = list(ciencias_e_ingenieria = 20)),
    1L
  )
  elegibles <- c(1, 4, 19, 20, 45, 3)
  facultades <- .cm_criterios_fac_key(c(
    rep("CIENCIAS E INGENIERIA", 5), "DERECHO"
  ))

  ok <- .cm_criterios_eval_min_eligible(elegibles, facultades, min_elig)

  # Ingeniería: sólo 20 y 45 llegan a su mínimo propio.
  expect_identical(ok[1:5], c(FALSE, FALSE, FALSE, TRUE, TRUE))
  # Derecho no declaró mínimo: la rige el general (piso 1), así que 3 pasa.
  expect_true(ok[[6]])
})

test_that("sin umbral general NI minimos por facultad manda el piso legacy", {
  efectivo <- .cm_criterios_min_elig_con_fallback(
    list(threshold = NA_real_, byFaculty = list()), 5L
  )

  expect_identical(efectivo$threshold, 5L)
  expect_length(efectivo$byFaculty, 0L)
  # Con el piso en 5, un aula de 4 elegibles queda fuera.
  expect_identical(
    .cm_criterios_eval_min_eligible(c(4, 5), .cm_criterios_fac_key(c("A", "A")), efectivo),
    c(FALSE, TRUE)
  )
})

test_that("un umbral general propio convive con las excepciones por facultad", {
  efectivo <- .cm_criterios_min_elig_con_fallback(
    list(threshold = 10, byFaculty = list(derecho = 30)), 1L
  )

  expect_identical(efectivo$threshold, 10)
  expect_identical(
    .cm_criterios_eval_min_eligible(
      c(9, 10, 29, 30),
      .cm_criterios_fac_key(c("OTRA", "OTRA", "DERECHO", "DERECHO")),
      efectivo
    ),
    c(FALSE, TRUE, FALSE, TRUE)
  )
})

# Rango de nivel por facultad guardado antes del arreglo de la eñe (a9c217c0).
#
# `crit$exceptions` y `minEligible$byFaculty` pasan por
# `.cm_aulas_canonizar_claves()`; `courseLevelRanges` no lo hacía, pese a que el
# contrato de ADR 0080 lo nombra. El efecto no era «el rango se ignora»: como el
# mapa NO está vacío el criterio sí se aplica, el bucle no encuentra ningún par
# que decida y devuelve FALSE, así que la facultad entera sale del marco —
# incluidas las aulas cuyo nivel está DENTRO del rango declarado.

test_that("un rango por facultad con clave legada sigue decidiendo", {
  etiqueta <- "ARTE Y DISEÑO"
  legada <- .cm_aulas_text_key_legada(etiqueta)
  expect_false(identical(legada, .cm_aulas_text_key(etiqueta)))

  rangos <- stats::setNames(list(list(list(min = 1, max = 5))), legada)
  dentro <- paste(etiqueta, "3", sep = .cm_catalogo_pair_fld)
  fuera <- paste(etiqueta, "9", sep = .cm_catalogo_pair_fld)

  # Dentro del rango declarado: entra. Antes salía excluida.
  expect_true(.cm_criterios_eval_course_ranges(dentro, rangos, etiqueta))
  # Fuera del rango: sigue saliendo.
  expect_false(.cm_criterios_eval_course_ranges(fuera, rangos, etiqueta))
})

test_that("la clave legada de un rango decide igual que la vigente", {
  etiqueta <- "ARTE Y DISEÑO"
  rango <- list(list(min = 1, max = 5))
  vigente <- stats::setNames(list(rango), .cm_aulas_text_key(etiqueta))
  legada <- stats::setNames(list(rango), .cm_aulas_text_key_legada(etiqueta))

  for (nivel in c("1", "3", "5", "6", "9")) {
    par <- paste(etiqueta, nivel, sep = .cm_catalogo_pair_fld)
    expect_identical(
      .cm_criterios_eval_course_ranges(par, legada, etiqueta),
      .cm_criterios_eval_course_ranges(par, vigente, etiqueta),
      info = paste("nivel", nivel)
    )
  }
})

# Contexto de criterios rehidratado desde el marco GUARDADO.
#
# El contexto completo lleva la tabla atómica estudiante x CH y es
# `cache_stripped`: al abrir un `.pulso` NUNCA existe, así que el preview quedaba
# muerto y el embudo caía a la cascada ejecutada sin decirlo. La versión reducida
# devuelve el recorrido vivo para los pasos de curso-horario —que no necesitan
# esa tabla— y declara los de alumno como `sin_recuento` en vez de dejarlos
# correr sobre `eligible_n = NA`, donde el mínimo pasaría a todos en silencio.

test_that("las membresias del marco salen de la columna, no de NA", {
  frame <- data.frame(
    classroom_id = c("a", "b"),
    eligible_n = c(4, 40),
    prevalence_ratio = c(0.5, 0.9),
    faculty_match_share = c(0.6, 0.95),
    level_match_share = c(0.7, 0.99),
    stringsAsFactors = FALSE
  )
  m <- .cm_criterios_membresias_del_marco(frame)
  expect_identical(m$eligible_n, c(4, 40))
  # Se declara que NO es del borrador: el preview lo usa para marcar los pasos
  # de alumno como `sin_recuento`.
  expect_false(m$valido)
  expect_true(m$desde_marco)

  comp <- .cm_criterios_composicion_del_marco(frame)
  expect_identical(comp$c7, c(0.5, 0.9))
  expect_identical(comp$c8_facultad, c(0.6, 0.95))
  expect_identical(comp$c8, c(0.7, 0.99))
})

test_that("el minimo sigue mordiendo con las cifras del marco", {
  frame <- data.frame(
    classroom_id = c("a", "b"), eligible_n = c(4, 40), stringsAsFactors = FALSE
  )
  m <- .cm_criterios_membresias_del_marco(frame)
  regla <- .cm_criterios_min_elig_con_fallback(
    list(threshold = 20, byFaculty = list()), 1L
  )
  # Lo que se evitaba: con `eligible_n` en NA, `eval_min_eligible` devuelve TRUE
  # para todos y el criterio deja de recortar sin que nada avise.
  expect_identical(
    .cm_criterios_eval_min_eligible(m$eligible_n, .cm_criterios_fac_key(c("F", "F")), regla),
    c(FALSE, TRUE)
  )
})

test_that("un marco sin aulas no produce contexto rehidratado", {
  expect_null(.cm_criterios_contexto_desde_marco(NULL))
  expect_null(.cm_criterios_contexto_desde_marco(list(aula_frame = NULL)))
  expect_null(.cm_criterios_contexto_desde_marco(
    list(aula_frame = data.frame(classroom_id = character(0)))
  ))
})
