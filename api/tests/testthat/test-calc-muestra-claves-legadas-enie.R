# Una config guardada antes del arreglo de la eñe seguía valiendo.
#
# Medido en la app el 2026-08-25 sobre HSVG 2026: al reparar `.cm_aulas_text_key`
# la clave de «ARTE Y DISEÑO» pasó de `arte_y_dise_no` a `arte_y_diseno`, y el
# criterio de facultad —un `include` cuyas categorías el `.pulso` guarda como
# claves— dejó de reconocerla. Resultado: 248 aulas con `eligible_n = 0`, 5.327
# alumnos excluidos, la facultad fuera del perfil y la tabla del cálculo con 14
# filas en vez de 15. Sin un solo error.

test_that("la clave legada se reproduce exacta y sin depender de la locale", {
  expect_identical(.cm_aulas_text_key("ARTE Y DISEÑO"), "arte_y_diseno")
  expect_identical(.cm_aulas_text_key_legada("ARTE Y DISEÑO"), "arte_y_dise_no")
  expect_identical(.cm_aulas_text_key_legada("AÑO"), "a_no")
  # Sin eñe las dos formas coinciden: nada que traducir donde no hubo defecto.
  expect_identical(.cm_aulas_text_key_legada("DERECHO"), .cm_aulas_text_key("DERECHO"))
})

test_that("el match casa por clave vigente y por clave legada", {
  guardadas <- c("derecho", "arte_y_dise_no")
  expect_true(.cm_aulas_clave_en("ARTE Y DISEÑO", guardadas))
  expect_true(.cm_aulas_clave_en("DERECHO", guardadas))
  expect_false(.cm_aulas_clave_en("PSICOLOGÍA", guardadas))
  # Sin señal no se decide: cada criterio elige qué hacer con el NA.
  expect_true(is.na(.cm_aulas_clave_en("", guardadas)))
  expect_identical(length(.cm_aulas_clave_en(character(0), guardadas)), 0L)
})

test_that("una config con la clave nueva sigue casando", {
  expect_true(.cm_aulas_clave_en("ARTE Y DISEÑO", c("arte_y_diseno")))
})

test_that("el criterio de facultad del curso no descarta la facultad con eñe", {
  crit <- list(kind = "flat", mode = "include",
               categories = list("derecho", "arte_y_dise_no"))
  facs <- c("DERECHO", "ARTE Y DISEÑO", "PSICOLOGÍA", "")
  expect_identical(
    .cm_criterios_facultad_curso_flag(facs, crit),
    c(TRUE, TRUE, FALSE, TRUE)
  )
})

test_that("en modo exclude la clave legada también excluye", {
  crit <- list(kind = "flat", mode = "exclude", categories = list("arte_y_dise_no"))
  expect_identical(
    .cm_criterios_facultad_curso_flag(c("ARTE Y DISEÑO", "DERECHO", ""), crit),
    c(FALSE, TRUE, TRUE)
  )
})

test_that("el mapa por facultad traduce la clave legada a la vigente", {
  mapa <- list(derecho = 20, arte_y_dise_no = 12)
  out <- .cm_aulas_canonizar_claves(mapa, c("DERECHO", "ARTE Y DISEÑO"))
  expect_true("arte_y_diseno" %in% names(out))
  expect_false("arte_y_dise_no" %in% names(out))
  expect_identical(out[["arte_y_diseno"]], 12)
})

test_that("una entrada vigente nunca la pisa la legada", {
  # Un `.pulso` editado a ambos lados del arreglo trae las dos claves; manda la
  # que escribió la app más reciente. Medido: así llegó HSVG 2026, con 11
  # entradas para 10 facultades.
  mapa <- list(arte_y_dise_no = 12, arte_y_diseno = 18)
  out <- .cm_aulas_canonizar_claves(mapa, "ARTE Y DISEÑO")
  expect_identical(out[["arte_y_diseno"]], 18)
})

test_that("una clave de una facultad ausente del marco se conserva", {
  mapa <- list(arte_y_dise_no = 12)
  out <- .cm_aulas_canonizar_claves(mapa, c("DERECHO", "PSICOLOGÍA"))
  expect_identical(names(out), "arte_y_dise_no")
})

test_that("el mínimo por facultad guardado con la clave legada sí se aplica", {
  # El corazón del defecto: sin traducción el override cae al umbral general.
  min_elig <- list(threshold = 15, byFaculty = list(arte_y_dise_no = 5))
  facs <- c("ARTE Y DISEÑO", "ARTE Y DISEÑO")
  by <- .cm_aulas_canonizar_claves(min_elig$byFaculty, facs)
  min_elig$byFaculty <- by
  flag <- .cm_criterios_eval_min_eligible(
    c(6, 3), .cm_criterios_fac_key(facs), min_elig
  )
  expect_identical(flag, c(TRUE, FALSE))
})
