# **Las que no cuentan no son una bolsa.**
#
# El 2026-09-09 el operativo tenía 944 efectivas de 1 049 respuestas, y las 105
# restantes se enseñaban como una resta muda. Son dos cosas distintas: 37 que no
# son del operativo —otra ola, una prueba, un aula que no está en el plan— y 68
# que sí lo son y no pasan el criterio. La primera no pide nada; la segunda es
# trabajo hecho que no suma, y es la que se mira.
#
# Lo que se sujeta aquí es que las tres cifras SUMEN el total sin residuo y que
# ninguna respuesta se cuente dos veces.

.mard_cfg <- function() list()

.mard_plan <- function() list(
  list(operational_code = "CH 1", faculty = "DERECHO"),
  list(operational_code = "CH 2", faculty = "DERECHO"),
  list(operational_code = "CH 3", faculty = "LETRAS")
)

test_that("las tres cifras suman las observadas, sin residuo", {
  d <- data.frame(x = 1:6, stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) c(TRUE, TRUE, TRUE, FALSE, FALSE, FALSE),
    .monitoreo_aulas_descartada = function(...) c(FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
    .monitoreo_aulas_response_classroom = function(...) c("CH 1", "CH 1", "CH 3", "CH 1", "CH 3", ""),
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_respuestas_desglose(.mard_plan(), d, .mard_cfg())
  t <- out$total
  expect_identical(t$observadas, 6L)
  expect_identical(t$efectivas, 3L)
  expect_identical(t$fuera_del_operativo, 1L)
  expect_identical(t$no_pasan_criterio, 2L)
  expect_identical(t$efectivas + t$fuera_del_operativo + t$no_pasan_criterio, t$observadas)
})

test_that("una respuesta descartada Y no válida se cuenta UNA vez, como fuera", {
  # Si el criterio se calculara por diferencia del total, esta respuesta
  # entraría en las dos y la suma dejaría de cuadrar.
  d <- data.frame(x = 1:2, stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) c(FALSE, TRUE),
    .monitoreo_aulas_descartada = function(...) c(TRUE, FALSE),
    .monitoreo_aulas_response_classroom = function(...) c("CH 1", "CH 1"),
    .package = "prosecnurapp"
  )
  t <- monitoreo_aulas_respuestas_desglose(.mard_plan(), d, .mard_cfg())$total
  expect_identical(t$fuera_del_operativo, 1L)
  expect_identical(t$no_pasan_criterio, 0L)
  expect_identical(t$efectivas + t$fuera_del_operativo + t$no_pasan_criterio, 2L)
})

test_that("una respuesta sin aula identificable entra en el total y en ninguna facultad", {
  # Contarla en una facultad inventaría el dato; esconderla del total dejaría
  # las tres cifras sin sumar.
  d <- data.frame(x = 1:3, stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) c(TRUE, TRUE, TRUE),
    .monitoreo_aulas_descartada = function(...) c(FALSE, FALSE, FALSE),
    .monitoreo_aulas_response_classroom = function(...) c("CH 1", "", NA),
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_respuestas_desglose(.mard_plan(), d, .mard_cfg())
  expect_identical(out$total$observadas, 3L)
  expect_identical(out$total$sin_aula, 2L)
  suma_fac <- sum(vapply(out$facultades, function(f) f$observadas, integer(1)))
  expect_identical(suma_fac, 1L)
})

test_that("`nzchar(NA)` no hace pasar un NA por aula identificada", {
  # La trampa medida del perfil: `nzchar(NA)` es TRUE, así que un NA sin
  # normalizar contaría como aula con código y la facultad saldría vacía en vez
  # de «sin aula».
  d <- data.frame(x = 1L, stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) TRUE,
    .monitoreo_aulas_descartada = function(...) FALSE,
    .monitoreo_aulas_response_classroom = function(...) NA_character_,
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_respuestas_desglose(.mard_plan(), d, .mard_cfg())
  expect_identical(out$total$sin_aula, 1L)
  expect_length(out$facultades, 0L)
})

test_that("el grano es la facultad del aula, y salen en orden", {
  d <- data.frame(x = 1:4, stringsAsFactors = FALSE)
  local_mocked_bindings(
    .monitoreo_aulas_valid_response = function(...) c(TRUE, FALSE, TRUE, TRUE),
    .monitoreo_aulas_descartada = function(...) c(FALSE, FALSE, FALSE, FALSE),
    .monitoreo_aulas_response_classroom = function(...) c("CH 3", "CH 1", "CH 2", "CH 3"),
    .package = "prosecnurapp"
  )
  out <- monitoreo_aulas_respuestas_desglose(.mard_plan(), d, .mard_cfg())
  expect_identical(vapply(out$facultades, function(f) f$facultad, character(1)),
                   c("DERECHO", "LETRAS"))
  derecho <- out$facultades[[1]]
  expect_identical(derecho$observadas, 2L)
  expect_identical(derecho$no_pasan_criterio, 1L)
})

test_that("sin respuestas devuelve la forma entera en ceros, no NULL", {
  # Un consumidor que no recibe el bloque no sabe si es que no hay respuestas o
  # si el motor no lo calculó. El vacío se declara.
  out <- monitoreo_aulas_respuestas_desglose(.mard_plan(), NULL, .mard_cfg())
  expect_identical(out$total$observadas, 0L)
  expect_identical(out$total$efectivas, 0L)
  expect_length(out$facultades, 0L)
  expect_identical(out, monitoreo_aulas_respuestas_desglose(list(), data.frame(), list()))
})

# **El aula se busca por las DOS claves.** Medido el 2026-09-18 sobre CCSS Perfil
# 2026-II: `.monitoreo_aulas_response_classroom()` resolvía el `classroom_id`
# (`ant310_0811`) y el mapa se indexaba por `operational_code` (`CH 1`), así que
# 0 de 64 casaban. El panel «Respuestas» publicaba «64 sin curso-horario
# identificable» bajo un «64 efectivas de 64 · 100,0 %», mientras `avance_cuota`
# —que cruza contra la clave buena— contaba UNA huérfana.
test_that("una respuesta que trae el classroom_id encuentra su aula igual", {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "ant310_0811", faculty = "CIENCIAS SOCIALES"),
    list(operational_code = "CH 2", classroom_id = "1eco36_0721", faculty = "CIENCIAS SOCIALES")
  )
  resp <- data.frame(classroom_id = c("ant310_0811", "1eco36_0721", "no_existe"),
                     stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_id_var = "classroom_id"))
  d <- monitoreo_aulas_respuestas_desglose(plan, responses = resp, cfg = cfg)
  # Dos encuentran su aula; la tercera no existe en el plan y ésa sí es «sin aula».
  expect_identical(d$total$sin_aula, 1L)
  expect_identical(length(d$facultades), 1L)
  expect_identical(d$facultades[[1]]$facultad, "CIENCIAS SOCIALES")
  expect_identical(d$facultades[[1]]$observadas, 2L)
})

test_that("y la que trae el operational_code sigue encontrándola, byte a byte", {
  # La clave de siempre se escribe PRIMERO y no se pisa: quien ya casaba, casa.
  plan <- list(list(operational_code = "CH 1", classroom_id = "ant310_0811", faculty = "DERECHO"))
  resp <- data.frame(classroom_id = c("CH 1", "CH 9"), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_id_var = "classroom_id"))
  d <- monitoreo_aulas_respuestas_desglose(plan, responses = resp, cfg = cfg)
  expect_identical(d$total$sin_aula, 1L)
  expect_identical(d$facultades[[1]]$facultad, "DERECHO")
})

test_that("un classroom_id que coincide con el operational_code de OTRA unidad no la roba", {
  # Guard del cruce: la primera clave escrita manda, y es la de siempre.
  plan <- list(
    list(operational_code = "X1", classroom_id = "a", faculty = "PRIMERA"),
    list(operational_code = "b",  classroom_id = "X1", faculty = "SEGUNDA")
  )
  resp <- data.frame(classroom_id = "X1", stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(classroom_id_var = "classroom_id"))
  d <- monitoreo_aulas_respuestas_desglose(plan, responses = resp, cfg = cfg)
  expect_identical(d$facultades[[1]]$facultad, "PRIMERA")
})
