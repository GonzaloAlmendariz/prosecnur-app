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

test_that("una reserva cuyo titular sigue vivo es ADICIONAL, no reemplazo", {
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
  expect_identical(a$clase, "adicional")
  # Y SIN letra: entre B y C no hay evidencia, sólo intención.
  expect_identical(a$caso, "")
  expect_match(a$por_que, "todavía vivo")
})

test_that("un titular ya aplicado NO convierte a su reserva en complemento", {
  # **Lo demostró Gonzalo el 2026-09-18** con la lista de los quince refuerzos
  # de la primera semana, todos caso C. Entre ellos R 161.5, R 161.6 y R 161.8,
  # cuyo titular CH 161 ya se había aplicado con 12 efectivas: una versión
  # anterior deducía «titular aplicado → complemento (B)» y las habría marcado
  # B. Eran C, elegidas por la cuota de Psicología, no para completar a CH 161.
  #
  # La diferencia entre B y C es la INTENCIÓN de quien eligió el aula, y eso no
  # está en los datos. Por eso lo no declarado sale sin letra.
  plan <- list(
    .ref_u("CH 50", operational_status = "aplicada"),
    .ref_u("R 50.1", rol = "chain_reserve", titular_operational_code = "CH 50",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  a <- Filter(function(x) identical(x$codigo, "R 50.1"), o$activadas)[[1]]
  expect_identical(a$clase, "adicional")
  expect_identical(a$caso, "")
  expect_false(identical(a$clase, "complemento"))
})

test_that("lo declarado SÍ trae su letra", {
  # `monitoreo_aulas_marcar_refuerzo()` escribe «complemento» o «refuerzo», y
  # ahí la letra es un dato, no una deducción.
  plan <- list(
    .ref_u("CH 51", operational_status = "aplicada"),
    .ref_u("R 51.1", rol = "chain_reserve", titular_operational_code = "CH 51",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25", activation_origin = "complemento"),
    .ref_u("R 51.2", rol = "chain_reserve", titular_operational_code = "CH 51",
           replacement_order = 2, sample_status = "agendada",
           scheduled_date = "2026-09-26", activation_origin = "refuerzo")
  )
  o <- monitoreo_aulas_refuerzos(plan, data.frame(), list(), hoy = as.Date("2026-09-18"))
  b <- Filter(function(x) identical(x$codigo, "R 51.1"), o$activadas)[[1]]
  c <- Filter(function(x) identical(x$codigo, "R 51.2"), o$activadas)[[1]]
  expect_identical(b$caso, "B")
  expect_identical(c$caso, "C")
  expect_identical(b$procedencia_fuente, "declarada")
  expect_identical(c$procedencia_fuente, "declarada")
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
  expect_identical(a$caso, "A")
  expect_match(a$por_que, "rechazo")
})

test_that("la procedencia tiene TRES grados de certeza, no dos", {
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
  expect_identical(leida$procedencia_fuente, "declarada")
  expect_identical(leida$caso, "C")
})

test_that("lo que la app dedujo y selló no se publica como declarado", {
  # Con dos grados, sellar convertía ocho deducciones en «registrada» y les daba
  # la certeza de una decisión. Lo advirtió la sesión vecina mirando este mismo
  # diseño el 2026-09-18, y era cierto: se medía en HSVG2026.
  plan <- list(
    .ref_u("CH 30", sample_status = "en_contacto"),
    .ref_u("R 30.1", rol = "chain_reserve", titular_operational_code = "CH 30",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25")
  )
  sellado <- monitoreo_aulas_sellar_procedencia(plan, ahora = "2026-09-18T12:00:00Z",
                                                hoy = as.Date("2026-09-18"))
  expect_equal(sellado$selladas, 1)
  o <- monitoreo_aulas_refuerzos(sellado$plan, data.frame(), list(),
                                 hoy = as.Date("2026-09-18"))
  a <- Filter(function(x) identical(x$codigo, "R 30.1"), o$activadas)[[1]]
  expect_identical(a$clase, "adicional")
  expect_identical(a$procedencia_fuente, "sellada")
  expect_false(identical(a$procedencia_fuente, "declarada"))
})

test_that("sellar es idempotente y no pisa lo que alguien declaró", {
  plan <- list(
    .ref_u("CH 31", sample_status = "en_contacto"),
    .ref_u("R 31.1", rol = "chain_reserve", titular_operational_code = "CH 31",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25", activation_origin = "refuerzo",
           activation_reason = "lo pidió el coordinador")
  )
  o <- monitoreo_aulas_sellar_procedencia(plan, hoy = as.Date("2026-09-18"))
  expect_equal(o$selladas, 0)
  expect_identical(o$plan[[2]]$activation_reason, "lo pidió el coordinador")
  # Y una segunda pasada sobre un plan ya sellado tampoco sella nada.
  sin_marca <- list(
    .ref_u("CH 32", sample_status = "en_contacto"),
    .ref_u("R 32.1", rol = "chain_reserve", titular_operational_code = "CH 32",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25")
  )
  a <- monitoreo_aulas_sellar_procedencia(sin_marca, hoy = as.Date("2026-09-18"))
  b <- monitoreo_aulas_sellar_procedencia(a$plan, hoy = as.Date("2026-09-18"))
  expect_equal(a$selladas, 1)
  expect_equal(b$selladas, 0)
})

test_that("un reemplazo orgánico NO se sella como refuerzo", {
  # Sellar de más es peor que no sellar: convertiría en decisión deliberada lo
  # que fue la cadena haciendo su trabajo.
  plan <- list(
    .ref_u("CH 33", sample_status = "rechazo"),
    .ref_u("R 33.1", rol = "chain_reserve", titular_operational_code = "CH 33",
           replacement_order = 1, sample_status = "agendada",
           scheduled_date = "2026-09-25")
  )
  o <- monitoreo_aulas_sellar_procedencia(plan, hoy = as.Date("2026-09-18"))
  expect_equal(o$selladas, 0)
})

test_that("el aula se encuentra por su classroom_id cuando no trae código operativo", {
  # `%||%` en R sólo cae por NULL: con `operational_code` presente pero VACÍO,
  # indexar con `cod %||% aula` no usaría nunca el `classroom_id`. La sesión
  # vecina lo midió el 2026-09-18 en otro motor: 0 de 64 filas casaban por
  # código y 63 de 64 por aula, y la pantalla decía «64 sin identificar».
  plan <- list(
    .ref_u("CH 34", sample_status = "en_contacto"),
    utils::modifyList(
      .ref_u("R 34.1", rol = "chain_reserve", titular_operational_code = "CH 34",
             replacement_order = 1, sample_status = "agendada",
             scheduled_date = "2026-09-25"),
      list(operational_code = "", classroom_id = "AULA-34-1"))
  )
  o <- monitoreo_aulas_sellar_procedencia(plan, hoy = as.Date("2026-09-18"))
  expect_equal(o$selladas, 1)
  expect_identical(o$plan[[2]]$activation_origin, prosecnurapp:::.MARF_ORIGEN_INFERIDO)
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
  expect_equal(o$rendimiento$adicional$n, 1)
  expect_equal(o$rendimiento$titulares$elegibles, 100)
  expect_equal(o$rendimiento$banco$elegibles, 40)
})

# --- las cuotas urgentes: el eje de TIEMPO, no sólo el de cantidad ---

.ref_riesgo <- function(...) {
  # Un `monitoreo_aulas_riesgo_facultades()` de mentira con lo justo: este
  # bloque consume su salida, no la recalcula.
  list(ok = TRUE, facultades = list(utils::modifyList(list(
    facultad = "DERECHO", agendadas = 2, sin_agendar = 0, reservas_libres = 50,
    campo_cerrado = FALSE, proxima_cita = "2026-10-05", ultima_cita = "2026-10-10",
    sexo = list(list(sexo = "M", cuota = 100, logrado = 90, al_cierre = 115,
                     margen = 15, margen_declarado = NA_real_, prob_cierre = 1))
  ), list(...))))
}

test_that("con los mismos números, la cuota cuya agenda se acaba antes es más urgente", {
  # Es el eje que Gonzalo pidió: «a nivel de tiempo o agenda muy lejana o casi
  # finalizando». Dos celdas idénticas en cantidad no corren el mismo riesgo si
  # una ya no puede reaccionar.
  lejos <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(ultima_cita = "2026-10-10"), hoy = as.Date("2026-09-18"))[[1]]
  cerca <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(ultima_cita = "2026-09-21"), hoy = as.Date("2026-09-18"))[[1]]
  expect_gt(cerca$urgencia, lejos$urgencia)
  expect_true("tiempo" %in% as.character(cerca$ejes))
  expect_equal(cerca$dias_a_la_ultima, 3)
})

test_that("una cuota corta sin nada que aplicar es el peor caso, aunque su número se vea bien", {
  x <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(agendadas = 0, sin_agendar = 0, campo_cerrado = TRUE,
                proxima_cita = "", ultima_cita = ""),
    hoy = as.Date("2026-09-18"))[[1]]
  expect_false(isTRUE(x$admite_refuerzo))
  expect_true(any(grepl("no le queda nada por aplicar", as.character(x$por_que))))
})

test_that("el motivo nunca contradice a `admite_refuerzo`", {
  # Con la agenda acabándose PERO aulas del plan sin fecha, sí se puede reforzar.
  # La primera versión decía «un refuerzo ya no llegaría a tiempo» mientras el
  # campo decía que sí: un rótulo que promete lo contrario de su propio dato.
  x <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(ultima_cita = "2026-09-20", sin_agendar = 1),
    hoy = as.Date("2026-09-18"))[[1]]
  expect_true(isTRUE(x$admite_refuerzo))
  expect_false(any(grepl("ya no llegaría a tiempo", as.character(x$por_que))))
  expect_true(any(grepl("por agendar", as.character(x$por_que))))
  # Y sin aulas por agendar, sí lo dice y el campo lo acompaña.
  y <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(ultima_cita = "2026-09-20", sin_agendar = 0),
    hoy = as.Date("2026-09-18"))[[1]]
  expect_false(isTRUE(y$admite_refuerzo))
  expect_true(any(grepl("ya no llegaría a tiempo", as.character(y$por_que))))
})

test_that("los motivos concuerdan en número y no llevan «(s)»", {
  x <- monitoreo_aulas_cuotas_urgentes(
    .ref_riesgo(agendadas = 0, sin_agendar = 1, reservas_libres = 1,
                proxima_cita = "", ultima_cita = ""),
    hoy = as.Date("2026-09-18"))[[1]]
  txt <- paste(as.character(x$por_que), collapse = " | ")
  expect_false(grepl("(s)", txt, fixed = TRUE))
  expect_match(txt, "1 aula en el plan", fixed = TRUE)
  expect_match(txt, "queda sólo 1 reserva libre", fixed = TRUE)
})

test_that("una cuota ya cumplida no aparece en la lista", {
  # Lo recogido no se devuelve: pedir un refuerzo para una cuota cerrada gasta
  # techo en la única facultad que no lo necesita.
  #
  # El fixture NO usa `modifyList` para la celda: es recursivo y FUSIONA la
  # lista anidada en vez de reemplazarla, así que la celda «cumplida» heredaba
  # el `logrado` de la base y el test se creía verde por el motivo contrario.
  f <- .ref_riesgo()$facultades[[1]]
  f$sexo <- list(list(sexo = "M", cuota = 100, logrado = 120, al_cierre = 130,
                      margen = 30, margen_declarado = NA_real_, prob_cierre = 1))
  vacia <- monitoreo_aulas_cuotas_urgentes(list(ok = TRUE, facultades = list(f)),
                                           hoy = as.Date("2026-09-18"))
  expect_length(vacia, 0L)
})

test_that("la lista sale ordenada de más a menos urgente", {
  r <- list(ok = TRUE, facultades = list(
    .ref_riesgo(ultima_cita = "2026-10-10")$facultades[[1]],
    utils::modifyList(.ref_riesgo()$facultades[[1]],
                      list(facultad = "PSICOLOGÍA", ultima_cita = "2026-09-20",
                           agendadas = 1, reservas_libres = 2))))
  u <- monitoreo_aulas_cuotas_urgentes(r, hoy = as.Date("2026-09-18"))
  expect_length(u, 2L)
  expect_identical(u[[1]]$facultad, "PSICOLOGÍA")
  expect_gte(u[[1]]$urgencia, u[[2]]$urgencia)
})

# --- los candidatos: la app ordena, Gonzalo elige ---

.ref_plan_con_reservas <- function() {
  # Dos facultades cortas y reservas libres en cada una, con mezclas de sexo
  # opuestas para que elegir por aporte se note.
  list(
    .ref_u("CH 10", fac = "DERECHO", operational_status = "aplicada"),
    .ref_u("R 10.1", fac = "DERECHO", rol = "chain_reserve",
           titular_operational_code = "CH 10", replacement_order = 1,
           eligible_n = 30, sex_top_1 = "F", sex_top_1_n = 28,
           sex_top_2 = "M", sex_top_2_n = 2),
    .ref_u("R 10.2", fac = "DERECHO", rol = "chain_reserve",
           titular_operational_code = "CH 10", replacement_order = 2,
           eligible_n = 60, sex_top_1 = "M", sex_top_1_n = 55,
           sex_top_2 = "F", sex_top_2_n = 5)
  )
}

.ref_riesgo_una <- function(sexo = "M", ...) {
  list(ok = TRUE, facultades = list(utils::modifyList(list(
    facultad = "DERECHO", agendadas = 2, sin_agendar = 0, reservas_libres = 50,
    campo_cerrado = FALSE, proxima_cita = "2026-10-05", ultima_cita = "2026-10-10",
    sexo = list(list(sexo = sexo, cuota = 100, logrado = 80, al_cierre = 110,
                     margen = 10, margen_declarado = NA_real_, prob_cierre = 1))
  ), list(...))))
}

test_that("el candidato se elige por lo que aporta a la celda que falta, no por su tamaño", {
  # Un aula grande de mayoría contraria no mueve la cuota que se quiere cerrar.
  hombres <- monitoreo_aulas_candidatos_refuerzo(
    .ref_plan_con_reservas(), data.frame(), list(),
    riesgo = .ref_riesgo_una("M"), hoy = as.Date("2026-09-18"))
  expect_true(isTRUE(hombres$ok))
  expect_identical(hombres$candidatos[[1]]$codigo, "R 10.2")
  mujeres <- monitoreo_aulas_candidatos_refuerzo(
    .ref_plan_con_reservas(), data.frame(), list(),
    riesgo = .ref_riesgo_una("F"), hoy = as.Date("2026-09-18"))
  # La misma facultad y el mismo plan: cambia la celda y cambia el primero.
  expect_identical(mujeres$candidatos[[1]]$codigo, "R 10.1")
})

test_that("cada candidato carga el porqué de SU cuota, no una nota al pie", {
  # El número 7 tiene que poder defenderse contra el 8 sin abrir otra pantalla.
  o <- monitoreo_aulas_candidatos_refuerzo(
    .ref_plan_con_reservas(), data.frame(), list(),
    riesgo = .ref_riesgo_una("M", ultima_cita = "2026-09-20", reservas_libres = 3),
    hoy = as.Date("2026-09-18"))
  c1 <- o$candidatos[[1]]
  expect_gt(length(as.character(c1$por_que)), 0L)
  expect_true(any(grepl("agenda se acaba", as.character(c1$por_que))))
  expect_true(is.finite(c1$urgencia_de_la_cuota))
  expect_identical(c1$cuota, "DERECHO · Hombres")
})

test_that("no se sobrepromete: el techo marca hasta dónde llega el sitio", {
  # Su vara: «Tampoco sobreprometer aulas». Lo que excede sigue en la lista
  # —para el día que el techo suba o alguien caiga— pero declarado como tal.
  o <- monitoreo_aulas_candidatos_refuerzo(
    .ref_plan_con_reservas(), data.frame(), list(techo_aulas_campo = 2),
    riesgo = .ref_riesgo_una("M"), hoy = as.Date("2026-09-18"))
  # 1 aula aplicada, techo 2 → cabe 1.
  expect_equal(o$caben, 1)
  expect_true(isTRUE(o$candidatos[[1]]$dentro_del_techo))
  expect_false(isTRUE(o$candidatos[[2]]$dentro_del_techo))
})

test_that("sin techo declarado no se marca ni se inventa un corte", {
  o <- monitoreo_aulas_candidatos_refuerzo(
    .ref_plan_con_reservas(), data.frame(), list(),
    riesgo = .ref_riesgo_una("M"), hoy = as.Date("2026-09-18"))
  expect_true(is.na(o$caben))
  expect_true(all(vapply(o$candidatos, function(c) is.na(c$dentro_del_techo), logical(1))))
})

test_that("un aula no se ofrece dos veces aunque sirva a dos cuotas de su facultad", {
  # Las dos celdas de una facultad comparten banca: proponer la misma aula en
  # las dos la contaría dos veces contra el techo.
  r <- list(ok = TRUE, facultades = list(utils::modifyList(
    .ref_riesgo_una("M")$facultades[[1]],
    list(sexo = list(
      list(sexo = "M", cuota = 100, logrado = 80, al_cierre = 110, margen = 10,
           margen_declarado = NA_real_, prob_cierre = 1),
      list(sexo = "F", cuota = 100, logrado = 70, al_cierre = 105, margen = 5,
           margen_declarado = NA_real_, prob_cierre = 1))))))
  o <- monitoreo_aulas_candidatos_refuerzo(.ref_plan_con_reservas(), data.frame(), list(),
                                           riesgo = r, hoy = as.Date("2026-09-18"))
  codigos <- vapply(o$candidatos, function(c) c$codigo, character(1))
  expect_identical(length(codigos), length(unique(codigos)))
})

test_that("sin cuotas cortas no se proponen refuerzos, y se dice por qué", {
  r <- .ref_riesgo_una("M")
  r$facultades[[1]]$sexo <- list(list(sexo = "M", cuota = 100, logrado = 130,
                                      al_cierre = 140, margen = 40,
                                      margen_declarado = NA_real_, prob_cierre = 1))
  o <- monitoreo_aulas_candidatos_refuerzo(.ref_plan_con_reservas(), data.frame(), list(),
                                           riesgo = r, hoy = as.Date("2026-09-18"))
  expect_false(isTRUE(o$ok))
  expect_match(o$motivo, "por debajo de su meta")
  expect_length(o$candidatos, 0L)
})

# --- el payload: una capacidad existe sólo si alguien la consume ---

test_that("el tablero publica los tres bloques de refuerzos", {
  # Cuatro motores exportados y ningún consumidor es deuda, no avance.
  plan <- list(
    .ref_u("CH 20", fac = "DERECHO", operational_status = "aplicada"),
    .ref_u("R 20.1", fac = "DERECHO", rol = "chain_reserve",
           titular_operational_code = "CH 20", replacement_order = 1)
  )
  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(techo_aulas_campo = 10))
  expect_true(is.list(d$refuerzos))
  expect_true(isTRUE(d$refuerzos$ok))
  expect_equal(d$refuerzos$techo$declarado, 10)
  expect_true("cuotas_urgentes" %in% names(d))
  expect_true("candidatos_refuerzo" %in% names(d))
})

test_that("el cruce de facultad entra por argumento y no se recalcula", {
  # Cuesta 11,9 s sobre las 3 000 respuestas de HSVG2026 y el tablero lo
  # necesita dos veces —`control_facultad` y el bloque de riesgo—: calcularlo
  # en cada uno llevó el dashboard de 7,6 s a 31 s.
  #
  # El fixture pasa un cruce IMPOSIBLE de obtener de estos datos: si el motor
  # lo recalculara, la retención saldría distinta y el test no lo vería. Así
  # sólo pasa si de verdad usa el que se le da.
  plan <- list(.ref_u("CH 21", fac = "DERECHO", operational_status = "aplicada"))
  marcado <- list(ok = TRUE, comparables = 999, coinciden = 999, discrepan = 0,
                  por_sexo = list(list(facultad = "DERECHO", aula_M = 100,
                                       declaradas_M = 50, aula_F = 0, declaradas_F = 0)),
                  por_facultad = list())
  r <- monitoreo_aulas_riesgo_facultades(plan, data.frame(), list(),
                                         cruce = marcado, hoy = as.Date("2026-09-18"))
  expect_true(isTRUE(r$ok))
  celda <- Filter(function(c) identical(c$sexo, "M"), r$facultades[[1]]$sexo)
  # Retención 50/100 = 0,5: sólo puede venir del cruce que se le pasó.
  expect_equal(celda[[1]]$retencion, 0.5)
})
