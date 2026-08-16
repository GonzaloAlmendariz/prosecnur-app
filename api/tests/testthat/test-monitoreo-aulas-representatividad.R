# La representatividad efectiva dice lo que mide.
#
# La escala es `100 - 100 * desvio_medio / 0.05`: 100 es una muestra efectiva
# identica a la planificada y 0 es un desvio medio de 5 pp o MAS —el tope de la
# escala, no «sin dato»—. El estado se derivaba solo de `warning`, que exige
# 10 pp en UNA celda, asi que un 0 sobre 100 se mostraba como «Correcto».

.mrp_aviso <- function(plan) {
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))
  Filter(function(r) identical(as.character(r$check), "effective_representativity"), d$validation)[[1]]
}

.mrp_aula <- function(cod, estrato, n, rol = "titular", wave = "M1", extra = list()) {
  # `modifyList` y no `c()`: concatenar deja DOS claves con el mismo nombre y
  # `$` devuelve la primera, asi que `extra` no sobreescribia nada.
  utils::modifyList(
    list(classroom_id = paste0("A-", cod), operational_code = cod, label = cod,
         sample_role = rol, wave = wave, orden = 1, eligible_n = n,
         expected_valid = n, stratum = estrato, faculty = estrato,
         operational_status = "agendada"),
    extra
  )
}

test_that("una muestra efectiva igual a la planificada sale ok", {
  plan <- list(
    .mrp_aula("CH 1", "Ciencias", 30),
    .mrp_aula("CH 2", "Letras", 30)
  )
  aviso <- .mrp_aviso(plan)
  expect_identical(as.character(aviso$status), "ok")
  expect_match(as.character(aviso$detail), "Puntaje 100")
})

test_that("un puntaje en el suelo de la escala NO se declara correcto", {
  # El control exacto del defecto: aqui `warning` esta vacio —ninguna celda pasa
  # de 10 pp— y el puntaje es 0. Antes, «Correcto».
  plan <- list(
    .mrp_aula("CH 1", "Ciencias", 30),
    .mrp_aula("CH 2", "Letras", 30),
    # Una reserva activada que desequilibra la composicion por estrato.
    .mrp_aula("R 2.1", "Letras", 26, rol = "chain_reserve", wave = "M2",
              extra = list(replacement_for = "CH 2"))
  )
  aviso <- .mrp_aviso(plan)
  # Lo que importa es que NO diga «Correcto». Este caso concreto desvia mas de
  # 10 pp en una celda, asi que escala a `warning`; un desvio menor pero con
  # puntaje bajo da `review`. Antes los dos salian «ok».
  expect_true(as.character(aviso$status) %in% c("review", "warning"))
  expect_match(as.character(aviso$detail), "de 100")
})

test_that("el aviso explica la escala, no solo el numero", {
  # «Score efectivo 0.0» no le dice a nadie si 0 es bueno o malo.
  plan <- list(.mrp_aula("CH 1", "Ciencias", 30), .mrp_aula("CH 2", "Letras", 30))
  detalle <- as.character(.mrp_aviso(plan)$detail)
  expect_match(detalle, "100 = identica")
  expect_match(detalle, "5 pp o mas")
  expect_match(detalle, "pp en promedio")
})

test_that("sin muestra efectiva lo dice en vez de fingir un puntaje", {
  plan <- list(.mrp_aula("CH 1", "Ciencias", 30, extra = list(operational_status = "cancelada")))
  aviso <- .mrp_aviso(plan)
  # Ni «ok» —no hay nada que aprobar— ni alerta de representatividad: no hay
  # desvio, hay ausencia.
  expect_identical(as.character(aviso$status), "review")
  expect_match(as.character(aviso$detail), "Todavia no hay muestra efectiva|Sin datos suficientes")
})
