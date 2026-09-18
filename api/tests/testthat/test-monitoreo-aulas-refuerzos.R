# El seguimiento de refuerzos y el techo de aulas del operativo.

.ref_u <- function(cod, fac = "DERECHO", rol = "titular", ...) {
  utils::modifyList(list(
    selection_run_id = "sel", operational_code = cod, titular_operational_code = cod,
    sample_role = rol, replacement_order = 0, classroom_id = cod, collection_unit_id = cod,
    faculty = fac, eligible_n = 40, expected_valid = 20, sample_status = "",
    operational_status = "", application_status = "", scheduled_date = "",
    sex_top_1 = "M", sex_top_1_n = 25, sex_top_2 = "F", sex_top_2_n = 15
  ), list(...))
}

test_that("una reserva cuyo titular sigue vivo es REFUERZO, no reemplazo", {
  # Es la distinción que Gonzalo pidió el 2026-09-18 y que el plan no guarda:
  # «no hay forma de distinguir tan bien si un reemplazo fue por reemplazo
  # organico o en verdad fue un reemplazo al aire».
  plan <- list(
    .ref_u("CH 1", sample_status = "en_contacto"),
    .ref_u("R 1.1", rol = "chain_reserve", titular_operational_code = "CH 1",
           replacement_order = 1, operational_status = "aplicada")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  a <- Filter(function(x) identical(x$codigo, "R 1.1"), o$activadas)[[1]]
  expect_identical(a$clase, "refuerzo")
  expect_match(a$por_que, "sigue vivo")
})

test_that("una reserva cuyo titular está caído es REEMPLAZO orgánico", {
  plan <- list(
    .ref_u("CH 2", sample_status = "rechazo"),
    .ref_u("R 2.1", rol = "chain_reserve", titular_operational_code = "CH 2",
           replacement_order = 1, operational_status = "aplicada")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  a <- Filter(function(x) identical(x$codigo, "R 2.1"), o$activadas)[[1]]
  expect_identical(a$clase, "reemplazo")
  expect_match(a$por_que, "rechazo")
})

test_that("cada fila dice SI la procedencia se leyó o se dedujo", {
  # Un dato registrado y uno inferido no valen lo mismo, y la vista no debe
  # poder confundirlos. Mientras nadie escriba `activation_origin`, todo es
  # reconstruido — 1 de 1 392 filas lo traía el 2026-09-18.
  plan <- list(
    .ref_u("CH 3", sample_status = "en_contacto"),
    .ref_u("R 3.1", rol = "chain_reserve", titular_operational_code = "CH 3",
           replacement_order = 1, operational_status = "aplicada"),
    .ref_u("R 3.2", rol = "chain_reserve", titular_operational_code = "CH 3",
           replacement_order = 2, operational_status = "aplicada",
           activation_origin = "refuerzo dirigido")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  deducida <- Filter(function(x) identical(x$codigo, "R 3.1"), o$activadas)[[1]]
  leida <- Filter(function(x) identical(x$codigo, "R 3.2"), o$activadas)[[1]]
  expect_identical(deducida$procedencia_fuente, "reconstruida")
  expect_identical(leida$procedencia_fuente, "registrada")
  expect_identical(leida$clase, "refuerzo")
})

test_that("el techo se cuenta con las aulas que FUERON A CAMPO, no con el eslabón en juego", {
  # Medido el 2026-09-18 sobre HSVG2026: 152 aulas fueron a campo y el criterio
  # «en juego» daba 145, porque seis cadenas tienen dos eslabones aplicados.
  # Contra un techo de 195 esa diferencia son siete refuerzos que no existen.
  plan <- list(
    .ref_u("CH 4", operational_status = "aplicada"),
    .ref_u("R 4.1", rol = "chain_reserve", titular_operational_code = "CH 4",
           replacement_order = 1, operational_status = "aplicada")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(techo_aulas_campo = 10),
                                 hoy = as.Date("2026-09-18"))
  expect_equal(o$techo$gastadas, 2)
  expect_equal(o$techo$caben, 8)
})

test_that("una cita en una cadena ya aplicada no consume techo", {
  # Tiene fecha y ocupa un aplicador, pero no se va a aplicar: el titular ya
  # rindió. Contarla gastaba margen que sí existe.
  plan <- list(
    .ref_u("CH 5", operational_status = "aplicada"),
    .ref_u("R 5.1", rol = "chain_reserve", titular_operational_code = "CH 5",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(techo_aulas_campo = 10),
                                 hoy = as.Date("2026-09-18"))
  expect_equal(o$techo$gastadas, 1)
  expect_equal(o$techo$por_gastar, 0)
  expect_equal(o$techo$citas_huerfanas, 1)
  expect_identical(as.character(o$techo$codigos_huerfanos), "R 5.1")
  expect_equal(o$techo$caben, 9)
})

test_that("sin techo declarado no se inventa uno", {
  # `caben = NA` y no 0: un estudio sin techo no es un estudio sin sitio.
  plan <- list(.ref_u("CH 6", operational_status = "aplicada"))
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  expect_false(isTRUE(o$techo$hay))
  expect_true(is.na(o$techo$caben))
  expect_equal(o$techo$gastadas, 1)
})

test_that("el techo declarado sobrevive al whitelist de la config", {
  # Misma trampa que se comió `faculty_var` el 2026-09-18: lo que la lista
  # cerrada no nombra, no se guarda.
  c1 <- monitoreo_aulas_normalize_config(list(techo_aulas_campo = 195))
  expect_equal(c1$techo_aulas_campo, 195)
  expect_equal(monitoreo_aulas_normalize_config(c1)$techo_aulas_campo, 195)
  # Un valor imposible cae a «sin declarar» en vez de romper el config.
  expect_equal(monitoreo_aulas_normalize_config(list(techo_aulas_campo = -3))$techo_aulas_campo, 0)
})

test_that("las tasas separan refuerzo, reemplazo y banco de los titulares", {
  # El 2026-09-18 el banco rendía 28 % y el refuerzo con reserva 43 %, contra
  # 53 % de un titular. Publicarlos juntos como «no titulares» escondía que el
  # problema está en el banco, no en los refuerzos.
  plan <- list(
    .ref_u("CH 7", operational_status = "aplicada", eligible_n = 100),
    .ref_u("CH 8", sample_status = "rechazo"),
    .ref_u("R 8.1", rol = "chain_reserve", titular_operational_code = "CH 8",
           replacement_order = 1, operational_status = "aplicada", eligible_n = 50),
    .ref_u("EXTRA 1", rol = "extra_reserve_pool", titular_operational_code = "EXTRA 1",
           operational_status = "aplicada", eligible_n = 40)
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  expect_equal(o$rendimiento$titulares$n, 1)
  expect_equal(o$rendimiento$reemplazo$n, 1)
  expect_equal(o$rendimiento$banco$n, 1)
  expect_equal(o$rendimiento$titulares$elegibles, 100)
  expect_equal(o$rendimiento$banco$elegibles, 40)
})
