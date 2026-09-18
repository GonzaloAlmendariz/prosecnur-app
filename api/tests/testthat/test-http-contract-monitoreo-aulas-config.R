# El POST de config de aulas por HTTP REAL — la clase de bug que no reproduce
# in-process (doctrina de helper-http-contract.R): plumber parsea el body con
# simplifyVector y {"CH 7": "..."} llega al normalizador como VECTOR nombrado,
# no como lista. El guard `!is.list` lo tiraba y el mapa de fijaciones (B36)
# se perdía en silencio — medido en vivo 2026-09-02: la UI mandaba
# {"reparto_fijado": {"CH 7": "Aquino..."}} y el estado devolvía `[]`.

test_that("B36 por HTTP: reparto_fijado sobrevive al body real de plumber", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  resp <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(reparto_fijado = list(
      "CH 7" = "Aquino Dulanto, Alejandro Moises",
      "CH 12" = "Castillo Solorsano, Leidy Viviana"
    ))
  )
  expect_identical(resp$status, 200L)
  eco <- resp$json$aulas_universitarias$reparto_fijado
  expect_identical(
    as.character(eco[["CH 7"]]),
    "Aquino Dulanto, Alejandro Moises"
  )
  expect_identical(
    as.character(eco[["CH 12"]]),
    "Castillo Solorsano, Leidy Viviana"
  )

  # Soltar por HTTP: el valor vacío quita la cita y conserva la otra.
  resp2 <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(reparto_fijado = list("CH 7" = "Aquino Dulanto, Alejandro Moises"))
  )
  eco2 <- resp2$json$aulas_universitarias$reparto_fijado
  expect_identical(as.character(eco2[["CH 7"]]), "Aquino Dulanto, Alejandro Moises")
  expect_null(eco2[["CH 12"]])
})

# La facultad declarada sobrevive a un POST que no la menciona.
#
# Medido en el `.pulso` de HSVG2026 el 2026-09-18: el proyecto guardado a las
# 10:14 publicó el libro con la hoja «Control de facultad» muda porque
# `source_mapping$faculty_var` había quedado en "" y `faculty_labels` en 0. El
# del 16/09 traía `datos_demo/P7` y sus 15 etiquetas. Con el mapping recuperado
# el cruce mide 2.745 comparables y 137 que declaran otra facultad; sin él, el
# bloque entero contesta «el estudio no declara su variable de facultad».
#
# La causa es el merge del endpoint: `for (nm in names(incoming))` reemplaza
# `source_mapping` ENTERO, así que un panel que manda su propio trozo del
# mapping —el colector, el sexo— se lleva por delante lo que él no conoce. Es
# el mismo defecto que el 2026-09-08 dejó `collector_var` en "" con una sola
# pulsación de «actualizar»; aquél se arregló pasando `previous` en el sync, y
# este endpoint se quedó sin esa red.
test_that("la facultad declarada sobrevive a un POST que trae otro trozo del mapping", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id
  expect_true(is.character(sid) && nzchar(sid))

  declarar <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(source_mapping = list(
      faculty_var = "datos_demo/P7",
      faculty_labels = list("1" = "DERECHO", "2" = "PSICOLOGÍA")
    ))
  )
  expect_identical(declarar$status, 200L)
  expect_identical(
    as.character(declarar$json$aulas_universitarias$source_mapping$faculty_var),
    "datos_demo/P7"
  )

  # Otro panel guarda SU parte del mapping y no menciona la facultad.
  otro <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(source_mapping = list(
      collector_var = "collectorID",
      sex_var = "datos_demo/P2"
    ))
  )
  expect_identical(otro$status, 200L)
  mapa <- otro$json$aulas_universitarias$source_mapping
  expect_identical(as.character(mapa$collector_var), "collectorID")
  expect_identical(as.character(mapa$faculty_var), "datos_demo/P7")
  expect_identical(as.character(mapa$faculty_labels[["1"]]), "DERECHO")
  expect_identical(as.character(mapa$faculty_labels[["2"]]), "PSICOLOGÍA")
})

# La contracara: conservar lo que no llega NO puede convertirse en no poder
# cambiarlo. Si la red de `previous` tapara también los cambios deliberados, el
# panel de facultad declarada dejaría de servir para corregir una elección mala.
test_that("declarar otra variable de facultad sigue pisando la anterior", {
  srv <- http_contract_server()
  creada <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))
  sid <- creada$json$session_id

  http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(source_mapping = list(
      faculty_var = "datos_demo/P7",
      faculty_labels = list("1" = "DERECHO")
    ))
  )
  cambio <- http_post_json(
    srv, "/api/monitoreo/aulas/config", sid = sid,
    body = list(source_mapping = list(
      faculty_var = "datos_demo/P9",
      faculty_labels = list("1" = "EDUCACION")
    ))
  )
  mapa <- cambio$json$aulas_universitarias$source_mapping
  expect_identical(as.character(mapa$faculty_var), "datos_demo/P9")
  expect_identical(as.character(mapa$faculty_labels[["1"]]), "EDUCACION")
})

# Agendar una reserva cuyo titular sigue vivo deja constancia de que es refuerzo.
#
# Medido en HSVG26ULT2 el 2026-09-18: de las 15 aulas que entraron como
# refuerzo, UNA tenía `activation_origin`. Las otras catorce se agendaron
# directo y perdieron el morado de `refuerzo_por_contactar` al pasar a
# `agendada`, sin dejar constancia. Gonzalo: «el sheets los marcó de morados y
# muchos se agendaron, entonces ya no estuvieron marcados como refuerzo».
test_that("al agendar por HTTP, un refuerzo queda sellado como tal", {
  srv <- http_contract_server()
  sid <- http_post_json(srv, "/api/session", body = list(fresh = TRUE))$json$session_id

  plan <- list(
    list(operational_code = "CH 40", titular_operational_code = "CH 40",
         classroom_id = "CH 40", collection_unit_id = "CH 40", sample_role = "titular",
         faculty = "DERECHO", eligible_n = 40, sample_status = "en_contacto"),
    list(operational_code = "R 40.1", titular_operational_code = "CH 40",
         classroom_id = "R 40.1", collection_unit_id = "R 40.1",
         sample_role = "chain_reserve", replacement_order = 1,
         faculty = "DERECHO", eligible_n = 40, sample_status = "")
  )
  puesto <- http_post_json(srv, "/api/monitoreo/aulas/config", sid = sid,
                           body = list(config = list(plan = plan)))
  expect_identical(puesto$status, 200L)

  # Se agenda la reserva. Su titular sigue «en_contacto»: no ha caído.
  r <- http_post_json(srv, "/api/monitoreo/aulas/agenda", sid = sid,
                      body = list(updates = list(list(
                        operational_code = "R 40.1", sample_status = "agendada",
                        scheduled_date = "2026-10-02"))))
  expect_identical(r$status, 200L)
  fila <- Filter(function(u) identical(as.character(u$operational_code), "R 40.1"),
                 r$json$agenda)
  expect_length(fila, 1L)
  expect_identical(as.character(fila[[1]]$activation_origin), "refuerzo_inferido")
  expect_true(nzchar(as.character(fila[[1]]$activated_at %||% "")))
  # Y el titular, que no se activó, sigue sin sello.
  tit <- Filter(function(u) identical(as.character(u$operational_code), "CH 40"),
                r$json$agenda)
  expect_false(nzchar(as.character(tit[[1]]$activation_origin %||% "")))
})
