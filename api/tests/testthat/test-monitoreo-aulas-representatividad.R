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
  # **La CADENA se declara.** Desde el 2026-09-08 la muestra efectiva se arma con
  # `monitoreo_aulas_en_juego()`, que agrupa por `titular_operational_code`, y un
  # plan que no lo trae sale del normalizador con el codigo de la PRIMERA fila en
  # todas: dos titulares independientes se leian como una sola cadena y solo uno
  # entraba a la muestra efectiva. Es un artefacto de la fixture —el plan real de
  # HSVG2026 trae 174 cadenas para sus 174 titulares, medido— pero se declara
  # aqui igual, porque un titular ES la cabeza de su propia cadena y el test debe
  # decir lo que quiere decir.
  utils::modifyList(
    list(classroom_id = paste0("A-", cod), operational_code = cod, label = cod,
         titular_operational_code = cod,
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
              extra = list(replacement_for = "CH 2", titular_operational_code = "CH 2",
                           sample_status = "agendada", replacement_order = 1))
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
  expect_match(detalle, "100 = idéntica")
  expect_match(detalle, "5 pp o más")
  expect_match(detalle, "pp en promedio")
})

test_that("sin muestra efectiva lo dice en vez de fingir un puntaje", {
  plan <- list(.mrp_aula("CH 1", "Ciencias", 30, extra = list(operational_status = "cancelada")))
  aviso <- .mrp_aviso(plan)
  # Ni «ok» —no hay nada que aprobar— ni alerta de representatividad: no hay
  # desvio, hay ausencia.
  expect_identical(as.character(aviso$status), "review")
  expect_match(as.character(aviso$detail), "Todavía no hay muestra efectiva|Sin datos suficientes")
})

test_that("una reserva DORMIDA no entra a la muestra efectiva aunque declare a quien reemplaza", {
  # **El defecto que este test fija**, medido sobre HSVG26ULT2 el 2026-09-08.
  #
  # La muestra efectiva se armaba como los M1 vivos MAS toda fila con
  # `replacement_for` no vacio y estado activo, con «planificada» dentro de esa
  # lista de activos. Pero `replacement_for` marca a que titular PODRIA
  # reemplazar una reserva, no que haya reemplazado; y «planificada» es un estado
  # DORMIDO. Juntos metian el banco entero: 1 173 reservas con `replacement_for`
  # puesto, las 1 173 dormidas, y un conjunto efectivo de 1 347 cursos-horario
  # contra 174 planificados. El `score_loss` salia -17,4 — la muestra efectiva
  # aparecia MAS representativa que el diseno, que es imposible.
  #
  # Aqui la reserva es de un estrato distinto al de su titular: si entrara,
  # movería la composicion y el puntaje bajaria de 100. Como no ha entrado, la
  # muestra efectiva son los dos titulares y el puntaje es 100.
  plan <- list(
    .mrp_aula("CH 1", "Ciencias", 30),
    .mrp_aula("CH 2", "Letras", 30),
    .mrp_aula("R 2.1", "Ciencias", 30, rol = "chain_reserve", wave = "M2",
              extra = list(replacement_for = "CH 2", titular_operational_code = "CH 2",
                           sample_status = "sin_contactar", replacement_order = 1,
                           operational_status = "planificada"))
  )
  aviso <- .mrp_aviso(plan)
  expect_identical(as.character(aviso$status), "ok")
  expect_match(as.character(aviso$detail), "Puntaje 100")
})
