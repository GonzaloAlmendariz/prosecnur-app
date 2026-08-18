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
