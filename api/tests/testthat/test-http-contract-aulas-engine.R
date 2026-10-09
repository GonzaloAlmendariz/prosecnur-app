# Contrato HTTP del 400 de motor no reconocido (remate REST de J1).
#
# El defecto que motivó el gate: un method_id no reconocido caía EN SILENCIO
# al default (cube_balanceado) y el caller creía haber corrido OTRO motor —
# la variante HTTP de la lista cerrada que se traga lo que no reconoce. El
# gate unitario existe (43af6290); esto prueba que el 400 llega POR EL WIRE
# con su código E_* y el motor rechazado en el mensaje, que es lo que la UI
# necesita para avisar la causa y no solo el hecho.

test_that("un motor inventado responde 400 E_CALC_MUESTRA_AULAS_ENGINE por el wire", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  # El frame viaja por body: la validación del motor dispara ANTES de usarlo,
  # así que basta un esqueleto para cruzar el 409 de «sin marco».
  r <- http_post_json(
    srv, "/api/calc-muestra/aulas/seleccionar",
    body = list(
      frame = list(aula_frame = list(), config = list()),
      method_id = "motor_inventado"
    ),
    sid = sid
  )
  expect_identical(r$status, 400L)
  expect_identical(r$json$error$code, "E_CALC_MUESTRA_AULAS_ENGINE")
  # El mensaje nombra el motor rechazado: el caller corrige sin adivinar.
  expect_match(as.character(r$json$error$message), "motor_inventado", fixed = TRUE)
})

test_that("un alias valido NO tropieza con el gate del motor (control)", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id

  # Mismo esqueleto, alias legitimo («pps_sistematico» → sistematico_pps).
  # Si fallara, debe ser MAS ADELANTE (seleccion sobre frame vacio), nunca
  # con el codigo del gate: eso prueba que el gate distingue desconocido de
  # conocido y no rechaza por rechazar.
  r <- http_post_json(
    srv, "/api/calc-muestra/aulas/seleccionar",
    body = list(
      frame = list(aula_frame = list(), config = list()),
      method_id = "pps_sistematico"
    ),
    sid = sid
  )
  expect_false(identical(r$json$error$code %||% "", "E_CALC_MUESTRA_AULAS_ENGINE"))
})

# Contrato HTTP de la reserva ELEGIDA.
#
# El motor acepta `elegida` desde hace varios commits y esta bien probado en
# unitario, pero la RUTA no leia el campo del body: la eleccion moria en el
# wire y la activacion seguia la cadena como si nadie hubiera elegido. Es la
# forma HTTP del mismo patron —una capacidad escrita que nadie puede consumir—
# y por eso el gate va aqui y no en el engine.

.aulas_plan_eleccion_http <- function() {
  fila <- function(cod, rol, tit, orden, fac, est) list(
    classroom_id = cod, operational_code = cod, sample_role = rol,
    titular_operational_code = tit, replacement_for = tit,
    replacement_order = orden, faculty = fac,
    sample_status = est, operational_status = if (est == "agendada") "agendada" else "planificada",
    eligible_n = 30, expected_valid = 15, course_name = paste("Curso", cod)
  )
  list(
    fila("CH 1", "titular", "CH 1", 0, "DERECHO", "agendada"),
    fila("R 1.1", "chain_reserve", "CH 1", 1, "DERECHO", "en_reserva"),
    fila("R 1.2", "chain_reserve", "CH 1", 2, "DERECHO", "en_reserva"),
    fila("CH 2", "titular", "CH 2", 0, "DERECHO", "aplicada"),
    fila("R 2.1", "chain_reserve", "CH 2", 1, "DERECHO", "en_reserva")
  )
}

.aulas_sembrar_plan_http <- function(srv, sid, plan) {
  http_post_json(srv, "/api/monitoreo/config", sid = sid, body = list(
    monitoreo_profile = list(family = "aulas_universitarias", variant = "multi_actor",
                             status = "active", route_selected = TRUE),
    aulas_universitarias = list(enabled = TRUE, plan = plan)
  ))
}

test_that("la reserva ELEGIDA viaja por el wire y entra ESA", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  expect_identical(creada$status, 200L)
  sid <- creada$json$session_id

  sembrada <- .aulas_sembrar_plan_http(srv, sid, .aulas_plan_eleccion_http())
  skip_if_not(identical(sembrada$status, 200L),
              paste("no se pudo sembrar el plan:", sembrada$status))

  # `R 2.1` es de OTRA cadena, ya resuelta (su titular CH 2 se aplico), misma
  # facultad. Sin `elegida` entraria `R 1.1` por orden de cadena.
  r <- http_post_json(srv, "/api/monitoreo/aulas/activar-reemplazo", sid = sid,
                      body = list(operational_code = "CH 1", motivo = "docente_no_autoriza",
                                  elegida = "R 2.1"))
  expect_identical(r$status, 200L)
  expect_identical(as.character(r$json$activada), "R 2.1")
  # El origen se declara: activar de otra cadena no es seguir el plan.
  expect_identical(as.character(r$json$origen), "otra_cadena")
})

test_that("sin `elegida` la ruta sigue la cadena (control del mismo wire)", {
  # Sin este control, el test de arriba pasaria igual si la ruta activara
  # siempre `R 2.1` por cualquier otra razon.
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  sembrada <- .aulas_sembrar_plan_http(srv, sid, .aulas_plan_eleccion_http())
  skip_if_not(identical(sembrada$status, 200L),
              paste("no se pudo sembrar el plan:", sembrada$status))

  r <- http_post_json(srv, "/api/monitoreo/aulas/activar-reemplazo", sid = sid,
                      body = list(operational_code = "CH 1", motivo = "docente_no_autoriza"))
  expect_identical(r$status, 200L)
  expect_identical(as.character(r$json$activada), "R 1.1")
})
