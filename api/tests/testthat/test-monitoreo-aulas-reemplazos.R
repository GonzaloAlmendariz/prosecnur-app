# Activar un reemplazo como gesto de la app.
#
# La vara V6 del GOAL: «activar un reemplazo es un gesto de la app, no una
# decision en un chat». Lo que estaba en juego no es comodidad: mientras el aula
# caida siga contando contra su meta, la brecha del estudio miente.

.mrr_plan <- function() list(
  list(classroom_id = "A-04", operational_code = "CH 4", label = "Aula 104",
       sample_role = "titular", wave = "M1", orden = 4, eligible_n = 25,
       expected_valid = 18, sample_status = "agendada",
       activation_weight_status = "titular_ready"),
  list(classroom_id = "A-06", operational_code = "R 4.1", label = "Aula 106",
       sample_role = "chain_reserve", replacement_for = "CH 4",
       replacement_order = 1, wave = "M2", orden = 6, eligible_n = 22,
       expected_valid = 16, sample_status = "en_reserva",
       activation_weight_status = "reserve_conditional"),
  list(classroom_id = "A-07", operational_code = "R 4.2", label = "Aula 107",
       sample_role = "chain_reserve", replacement_for = "CH 4",
       replacement_order = 2, wave = "M3", orden = 7, eligible_n = 20,
       expected_valid = 14, sample_status = "sin_contactar",
       activation_weight_status = "reserve_conditional"),
  # Otra cadena: no debe tocarse nunca.
  list(classroom_id = "A-09", operational_code = "R 9.1", label = "Aula 109",
       sample_role = "chain_reserve", replacement_for = "CH 9",
       replacement_order = 1, wave = "M2", orden = 9, eligible_n = 30,
       expected_valid = 20, sample_status = "en_reserva")
)

.mrr_de <- function(plan, codigo) {
  Filter(function(r) identical(as.character(r$operational_code), codigo), plan)[[1]]
}

test_that("cae el titular y entra su primera reserva", {
  res <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4",
                                           motivo = "sin_acceso", ahora = "2026-08-16T10:00:00Z")
  expect_identical(res$activada, "R 4.1")
  expect_false(res$agotada)
  expect_identical(res$restantes, 1L)

  caida <- .mrr_de(res$plan, "CH 4")
  expect_identical(caida$sample_status, "reemplazada")
  expect_identical(caida$replaced_at, "2026-08-16T10:00:00Z")

  entra <- .mrr_de(res$plan, "R 4.1")
  expect_identical(entra$sample_status, "agendada")
  # El motivo viaja a la reserva: quien la mire necesita saber POR QUE esta en
  # campo, no solo que lo esta.
  expect_identical(entra$activation_reason, "sin_acceso")
})

test_that("no toca el peso condicional de la reserva", {
  # `activation_weight_status` dice que el peso de una reserva es condicional
  # POR DISENO MUESTRAL, y el relato de Calculo de muestra lo explica asi.
  # Pisarlo al activar borraria esa señal para el ponderador.
  res <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4", ahora = "2026-08-16T10:00:00Z")
  expect_identical(.mrr_de(res$plan, "R 4.1")$activation_weight_status, "reserve_conditional")
})

test_that("la cadena avanza cuando tambien cae la reserva", {
  paso1 <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4", ahora = "2026-08-16T10:00:00Z")
  paso2 <- monitoreo_aulas_activar_reemplazo(paso1$plan, "R 4.1",
                                             motivo = "cancelada", ahora = "2026-08-16T11:00:00Z")
  # El control: `replacement_for` de R 4.2 apunta al TITULAR `CH 4`, no a
  # `R 4.1`. Buscando reservas «de R 4.1» no se encontraria ninguna.
  expect_identical(paso2$activada, "R 4.2")
  expect_identical(.mrr_de(paso2$plan, "R 4.1")$sample_status, "reemplazada")
  expect_identical(.mrr_de(paso2$plan, "R 4.2")$sample_status, "agendada")
})

test_that("una cadena agotada se declara, no se inventa", {
  plan <- .mrr_plan()
  p1 <- monitoreo_aulas_activar_reemplazo(plan, "CH 4", ahora = "2026-08-16T10:00:00Z")
  p2 <- monitoreo_aulas_activar_reemplazo(p1$plan, "R 4.1", ahora = "2026-08-16T11:00:00Z")
  p3 <- monitoreo_aulas_activar_reemplazo(p2$plan, "R 4.2", ahora = "2026-08-16T12:00:00Z")

  expect_true(p3$agotada)
  expect_null(p3$activada)
  expect_identical(p3$reservas_usadas, 2L)
  # Y la caida NO se marca reemplazada: no lo esta. Decir que si la sacaria del
  # avance sin que nadie cubra su meta.
  expect_identical(.mrr_de(p3$plan, "R 4.2")$sample_status, "agendada")
})

test_that("nunca se roba una reserva de otra cadena", {
  res <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4", ahora = "2026-08-16T10:00:00Z")
  expect_identical(.mrr_de(res$plan, "R 9.1")$sample_status, "en_reserva")
})

test_that("un curso-horario que no existe da error claro, no silencio", {
  expect_error(
    monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 99"),
    class = "api_error"
  )
})

test_that("el aviso explica la consecuencia, no solo el hecho", {
  res <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4", ahora = "2026-08-16T10:00:00Z")
  expect_match(monitoreo_aulas_activacion_texto(res), "CH 4 pasa a reemplazada y entra R 4.1")
  expect_match(monitoreo_aulas_activacion_texto(res), "Quedan 1 reservas")

  p2 <- monitoreo_aulas_activar_reemplazo(res$plan, "R 4.1", ahora = "2026-08-16T11:00:00Z")
  p3 <- monitoreo_aulas_activar_reemplazo(p2$plan, "R 4.2", ahora = "2026-08-16T12:00:00Z")
  texto <- monitoreo_aulas_activacion_texto(p3)
  expect_match(texto, "se agotó")
  # Lo que importa que se lea: la meta se queda sin cubrir.
  expect_match(texto, "sin cubrir")
})

test_that("activar mueve la brecha del tablero al aula que si esta en campo", {
  # La razon de existir del item: mientras el aula caida cuente contra su meta,
  # la brecha del estudio miente.
  plan <- .mrr_plan()
  cfg <- function(p) list(enabled = TRUE, plan = p,
                          source_mapping = list(collector_var = "collectorID"))
  antes <- monitoreo_aulas_dashboard(plan, data.frame(), cfg(plan))
  res <- monitoreo_aulas_activar_reemplazo(plan, "CH 4", motivo = "sin_acceso",
                                           ahora = "2026-08-16T10:00:00Z")
  despues <- monitoreo_aulas_dashboard(res$plan, data.frame(), cfg(res$plan))

  estado <- function(d, codigo) {
    f <- Filter(function(r) identical(as.character(r$operational_code), codigo), d$agenda)
    if (!length(f)) return("")
    as.character(f[[1]]$sample_status %||% "")
  }
  expect_identical(estado(antes, "CH 4"), "agendada")
  expect_identical(estado(despues, "CH 4"), "reemplazada")
  expect_identical(estado(antes, "R 4.1"), "en_reserva")
  expect_identical(estado(despues, "R 4.1"), "agendada")
})

test_that("cada vocabulario reconoce su propia salida", {
  # `en_reserva` degradaba a `sin_contactar` porque el normalizador BORRABA el
  # guion bajo en vez de convertirlo en espacio: "enreserva" ya no empezaba por
  # "en reserva". Una funcion que no reconoce lo que ella misma devuelve degrada
  # el dato en cada vuelta —cargar, guardar, reimportar— sin avisar.
  for (v in monitoreo_aulas_estados_muestra()) {
    expect_identical(monitoreo_aulas_estado_muestra(v), v)
  }
  for (v in monitoreo_aulas_estados_aplicacion()) {
    expect_identical(monitoreo_aulas_estado_aplicacion(v), v)
  }
  for (v in monitoreo_aulas_estados()) {
    expect_identical(.monitoreo_aulas_status(v), v)
  }
})

test_that("sigue leyendo las formas que escribe el Excel", {
  # El arreglo no puede romper el vocabulario del equipo.
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA 1"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("EN RESERVA"), "en_reserva")
  expect_identical(monitoreo_aulas_estado_muestra("AGENDADA"), "agendada")
  expect_identical(monitoreo_aulas_estado_muestra("REAGENDADA"), "reagendada")
  expect_identical(monitoreo_aulas_estado_muestra("REEMPLAZADA"), "reemplazada")
  expect_identical(monitoreo_aulas_estado_muestra(""), "sin_contactar")
})

test_that("las marcas de la activacion sobreviven al normalizador", {
  # Decima aparicion del patron de la lista cerrada: `monitoreo_aulas_normalize_plan()`
  # reconstruye la fila campo a campo, asi que lo que no se declara se cae. El
  # motor escribia estas tres marcas y el tablero las mostraba vacias.
  res <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4",
                                           motivo = "docente_no_autoriza",
                                           ahora = "2026-08-16T10:00:00Z")
  normalizado <- monitoreo_aulas_normalize_plan(res$plan)
  caida <- .mrr_de(normalizado, "CH 4")
  entra <- .mrr_de(normalizado, "R 4.1")
  expect_identical(as.character(caida$replaced_at), "2026-08-16T10:00:00Z")
  expect_identical(as.character(entra$activated_at), "2026-08-16T10:00:00Z")
  expect_identical(as.character(entra$activation_reason), "docente_no_autoriza")
})

test_that("un motivo del vocabulario de reemplazo sobrevive al tablero", {
  # Y el control del otro lado: un ESTADO no es un motivo. `sin_acceso` se
  # normaliza a «otro» y eso es correcto —no es del vocabulario de motivos—,
  # asi que la UI no debe colarlo como sustituto.
  expect_identical(.monitoreo_aulas_reason("docente_no_autoriza"), "docente_no_autoriza")
  expect_identical(.monitoreo_aulas_reason("sin_acceso"), "otro")
})

test_that("nunca tener reserva no es lo mismo que haberlas gastado", {
  # La primera es una decision del diseno muestral; la segunda, un hecho del
  # operativo. «Ya se agoto: se habian usado 0» las confundia.
  solo <- list(list(classroom_id = "A-09", operational_code = "CH 9", label = "x",
                    sample_role = "titular", wave = "M1", orden = 9, eligible_n = 30))
  sin_reserva <- monitoreo_aulas_activar_reemplazo(solo, "CH 9", ahora = "2026-08-16T10:00:00Z")
  texto <- monitoreo_aulas_activacion_texto(sin_reserva)
  expect_match(texto, "no tiene ninguna reserva en el plan")
  expect_no_match(texto, "se agotó")

  # Y el otro lado: con la cadena consumida, sí dice que se agotó y cuántas.
  p1 <- monitoreo_aulas_activar_reemplazo(.mrr_plan(), "CH 4", ahora = "2026-08-16T10:00:00Z")
  p2 <- monitoreo_aulas_activar_reemplazo(p1$plan, "R 4.1", ahora = "2026-08-16T11:00:00Z")
  p3 <- monitoreo_aulas_activar_reemplazo(p2$plan, "R 4.2", ahora = "2026-08-16T12:00:00Z")
  gastada <- monitoreo_aulas_activacion_texto(p3)
  expect_match(gastada, "ya se agotó")
  expect_match(gastada, "se habían usado 2")
})

test_that("la activacion aguanta una cadena profunda de punta a punta", {
  # `feat(calc-muestra): la cadena de reemplazos se acandala por facultad` subio
  # `reserve_depth_target` de 1 a 6 y solto el candado de celda a facultad, asi
  # que las cadenas reales pasan a ser de hasta 11-12 eslabones. Los demas tests
  # de este archivo usan cadenas de 2: sin este, la profundidad nueva no la
  # prueba nadie.
  plan <- c(
    list(list(classroom_id = "A-00", operational_code = "CH 1", label = "titular",
              sample_role = "titular", wave = "M1", orden = 1, eligible_n = 30,
              expected_valid = 20, faculty = "Ciencias", stratum = "Ciencias",
              sample_status = "agendada")),
    lapply(1:11, function(k) list(
      classroom_id = sprintf("A-%02d", k), operational_code = sprintf("R 1.%d", k),
      label = sprintf("reserva %d", k), sample_role = "chain_reserve",
      replacement_for = "CH 1", replacement_order = k, wave = sprintf("M%d", k + 1),
      orden = k + 1, eligible_n = 28, expected_valid = 19, faculty = "Ciencias",
      stratum = "Ciencias", sample_status = "en_reserva"))
  )
  actual <- monitoreo_aulas_normalize_plan(plan)
  caido <- "CH 1"
  activadas <- character(0)
  for (paso in seq_len(15L)) {
    res <- monitoreo_aulas_activar_reemplazo(actual, caido,
                                             ahora = sprintf("2026-08-16T%02d:00:00Z", 8 + paso))
    if (isTRUE(res$agotada)) break
    activadas <- c(activadas, res$activada)
    actual <- res$plan
    caido <- res$activada
  }
  # Las once, en el orden de la cadena y sin repetir ninguna.
  expect_identical(activadas, sprintf("R 1.%d", 1:11))

  estados <- vapply(actual, function(r) as.character(r$sample_status %||% ""), character(1))
  codigos <- vapply(actual, function(r) as.character(r$operational_code), character(1))
  expect_identical(unname(estados[codigos == "R 1.11"]), "agendada")
  expect_identical(sum(estados == "reemplazada"), 11L)

  # Y al final dice que se AGOTO con su cuenta, no que nunca tuvo reserva.
  fin <- monitoreo_aulas_activar_reemplazo(actual, "R 1.11", ahora = "2026-08-16T23:00:00Z")
  expect_true(fin$agotada)
  expect_identical(fin$reservas_usadas, 11L)
  expect_match(monitoreo_aulas_activacion_texto(fin), "se habían usado 11")
})

test_that("el orden derivado vuelve al campo, no se queda en la variable local", {
  # Servia para numerar el codigo de cadena `R n.k` pero el CAMPO seguia en 0,
  # asi que la tabla de reemplazos mostraba «Orden en la cadena: 0» en las seis
  # filas de una cadena de seis: justo la columna que dice cual entra ahora.
  mk <- function(cod, rol, repl = "", i = 1, ord = NA) {
    o <- list(classroom_id = cod, operational_code = cod, label = cod,
              sample_role = rol, wave = "M1", orden = i, eligible_n = 28,
              expected_valid = 20)
    if (nzchar(repl)) o$replacement_for <- repl
    if (!is.na(ord)) o$replacement_order <- ord
    o
  }
  ordenes <- function(pl) {
    setNames(
      vapply(pl, function(r) as.numeric(r$replacement_order %||% NA), numeric(1)),
      vapply(pl, function(r) as.character(r$operational_code), character(1))
    )
  }

  sin_declarar <- monitoreo_aulas_normalize_plan(c(
    list(mk("CH 4", "titular", i = 1)),
    lapply(1:4, function(k) mk(sprintf("R 4.%d", k), "chain_reserve", "CH 4", 1 + k))
  ))
  o1 <- ordenes(sin_declarar)
  expect_identical(unname(o1[sprintf("R 4.%d", 1:4)]), as.numeric(1:4))
  # El titular no tiene orden en la cadena: es 0 por definicion.
  expect_identical(unname(o1[["CH 4"]]), 0)

  # Y lo declarado manda sobre lo derivado.
  declarado <- monitoreo_aulas_normalize_plan(c(
    list(mk("CH 4", "titular", i = 1)),
    lapply(1:3, function(k) mk(sprintf("R 4.%d", k), "chain_reserve", "CH 4", 1 + k, ord = k * 10))
  ))
  expect_identical(unname(ordenes(declarado)[sprintf("R 4.%d", 1:3)]), c(10, 20, 30))
})

test_that("la activacion devuelve la advertencia de ponderacion de la reserva que entra", {
  # La escribe Calculo de muestra y esta redactada para ESTE momento —«usar peso
  # analitico final solo si se activa en campo»—. Viajaba en el plan y quien
  # pulsa el boton no la veia nunca.
  aviso <- "Reserva condicional: usar peso analitico final solo si se activa en campo."
  plan <- list(
    list(operational_code = "CH 4", classroom_id = "CH 4", sample_role = "titular",
         sample_status = "agendada", replacement_for = ""),
    list(operational_code = "R 4.1", classroom_id = "R 4.1", sample_role = "chain_reserve",
         sample_status = "en_reserva", replacement_for = "CH 4", replacement_order = 1,
         analysis_weight_warning = aviso)
  )
  res <- monitoreo_aulas_activar_reemplazo(plan, "CH 4", motivo = "docente_no_autoriza")

  expect_identical(res$activada, "R 4.1")
  expect_identical(res$advertencia_peso, aviso)
  # Y NO se toca `activation_weight_status`: mostrar no es mutar. Es la decision
  # de la cabecera del modulo y este aserto la sostiene.
  reserva <- Filter(function(r) identical(r$operational_code, "R 4.1"), res$plan)[[1]]
  expect_null(reserva$activation_weight_status)
})

test_that("una reserva sin advertencia devuelve cadena vacia, no NULL ni NA", {
  # La UI decide mostrar el renglon con `if (avisoPeso)`. Un NULL serializado
  # como `null` y un NA como `"NA"` pintarian un aviso con texto basura.
  plan <- list(
    list(operational_code = "CH 5", classroom_id = "CH 5", sample_role = "titular",
         sample_status = "agendada", replacement_for = ""),
    list(operational_code = "R 5.1", classroom_id = "R 5.1", sample_role = "chain_reserve",
         sample_status = "en_reserva", replacement_for = "CH 5", replacement_order = 1)
  )
  res <- monitoreo_aulas_activar_reemplazo(plan, "CH 5", motivo = "aula_cerrada")

  expect_identical(res$advertencia_peso, "")
})

test_that("una reserva con el «-» del Excel se ve como disponible", {
  # `-` es como el equipo escribe «todavia nada aqui» en STATUS MUESTRA: 1 810
  # de 2 040 celdas en el estudio de 2025. Esta funcion tenia su propia lista de
  # estados libres, con tres valores contra los cinco de la canonica
  # `MONITOREO_AULAS_ESTADOS_DORMIDOS`, y `-` no estaba: con un libro asi habria
  # respondido «no quedan reservas» teniendolas todas.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", sample_status = "agendada"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve", replacement_for = "CH 1",
         replacement_order = 1, sample_status = "-"),
    list(operational_code = "R 1.2", sample_role = "chain_reserve", replacement_for = "CH 1",
         replacement_order = 2, sample_status = "planificada")
  )
  idx <- monitoreo_aulas_reservas_disponibles(plan, "CH 1")
  expect_length(idx, 2L)
  expect_equal(vapply(plan[idx], function(r) r$operational_code, character(1)),
               c("R 1.1", "R 1.2"))
})

test_that("y una ya agendada sigue sin estarlo", {
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", sample_status = "agendada"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve", replacement_for = "CH 1",
         replacement_order = 1, sample_status = "agendada"),
    list(operational_code = "R 1.2", sample_role = "chain_reserve", replacement_for = "CH 1",
         replacement_order = 2, sample_status = "en_reserva")
  )
  idx <- monitoreo_aulas_reservas_disponibles(plan, "CH 1")
  expect_length(idx, 1L)
  expect_equal(plan[[idx]]$operational_code, "R 1.2")
})

# --- Activar un aula ELEGIDA, que puede no ser la que tocaba -----------------

plan_eleccion <- function() list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "ARQ", sample_status = "agendada"),
  list(operational_code = "R 1.1", sample_role = "chain_reserve", replacement_for = "CH 1",
       replacement_order = 1, faculty = "ARQ", sample_status = "en_reserva"),
  # De otra cadena, ya libre
  list(operational_code = "CH 2", sample_role = "titular", faculty = "ARQ", sample_status = "agendada"),
  list(operational_code = "R 2.1", sample_role = "chain_reserve", replacement_for = "CH 2",
       replacement_order = 1, faculty = "ARQ", sample_status = "en_reserva"),
  # Del bolson, de su facultad y de otra
  list(operational_code = "E-ARQ", sample_role = "extra_reserve_pool", faculty = "ARQ", sample_status = "en_reserva"),
  list(operational_code = "E-DER", sample_role = "extra_reserve_pool", faculty = "DERECHO", sample_status = "en_reserva"),
  # Ya comprometida
  list(operational_code = "R 2.2", sample_role = "chain_reserve", replacement_for = "CH 2",
       replacement_order = 2, faculty = "ARQ", sample_status = "agendada")
)

test_that("sin `elegida` sigue la cadena: el procedimiento manda por defecto", {
  r <- monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", ahora = "2026-01-01T00:00:00Z")
  expect_equal(r$activada, "R 1.1")
  expect_equal(r$origen, "cadena")
})

test_that("con `elegida` de otra cadena, entra esa y el origen lo dice", {
  r <- monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "R 2.1",
                                         ahora = "2026-01-01T00:00:00Z")
  expect_equal(r$activada, "R 2.1")
  expect_equal(r$origen, "otra_cadena")
  # El plan recuerda a QUIEN cubre, aunque su cadena fuera otra: sin esto el
  # avance la seguiria atribuyendo a CH 2 y CH 1 quedaria sin cubrir.
  act <- Filter(function(x) identical(x$operational_code, "R 2.1"), r$plan)[[1]]
  expect_equal(act$activated_for, "CH 1")
  expect_equal(act$activation_origin, "otra_cadena")
  caida <- Filter(function(x) identical(x$operational_code, "CH 1"), r$plan)[[1]]
  expect_equal(caida$replaced_by, "R 2.1")
})

test_that("con `elegida` del bolson, el origen es `extra`", {
  r <- monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "E-ARQ",
                                         ahora = "2026-01-01T00:00:00Z")
  expect_equal(r$origen, "extra")
})

test_that("una elegida de OTRA FACULTAD se rechaza con su codigo", {
  # «El bolson es siempre siempre siempre dentro de la misma facultad, jamas de
  # otra.» Rechaza en vez de corregir: la UI necesita poder decir que pasa.
  expect_error(
    monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "E-DER"),
    class = "api_error"
  )
})

test_that("una elegida ya comprometida se rechaza", {
  expect_error(
    monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "R 2.2"),
    class = "api_error"
  )
})

test_that("un aula no puede reemplazarse a si misma", {
  expect_error(
    monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "CH 1"),
    class = "api_error"
  )
})

test_that("una elegida que no existe se rechaza", {
  expect_error(
    monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "NO EXISTE"),
    class = "api_error"
  )
})

# --- La facultad es frontera dura, y tambien cuando viene vacia --------------
#
# Gonzalo: «el bolson es siempre siempre siempre dentro de la misma facultad,
# jamas de otra». `E_REEMPLAZO_OTRA_FACULTAD` existia sin una sola prueba.

.mar_error <- function(expr) tryCatch(expr, api_error = function(e) e)

test_that("un candidato de otra facultad no se activa", {
  err <- .mar_error(
    monitoreo_aulas_activar_reemplazo(plan_eleccion(), "CH 1", elegida = "E-DER",
                                      ahora = "2026-01-01T00:00:00Z"))
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_REEMPLAZO_OTRA_FACULTAD")
  expect_equal(err$status, 409)
})

test_that("sin facultad declarada en el aula que cae, tampoco cruza", {
  # El caso que se colaba: la guarda exigia que las DOS facultades fueran no
  # vacias, asi que una fila sin facultad aceptaba cualquier candidato. El
  # frontend lo ofrecia ademas, por el mismo agujero en `bolsonExtra()`.
  plan <- plan_eleccion()
  plan <- lapply(plan, function(u) {
    if (identical(u$operational_code, "CH 1")) u$faculty <- ""
    u
  })
  err <- .mar_error(
    monitoreo_aulas_activar_reemplazo(plan, "CH 1", elegida = "E-DER",
                                      ahora = "2026-01-01T00:00:00Z"))
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_REEMPLAZO_OTRA_FACULTAD")
  # Y el aviso dice la CAUSA, no solo el hecho: que no se puede comprobar, y
  # cual de las dos no declara su facultad.
  expect_match(conditionMessage(err), "no la declara")
  expect_match(conditionMessage(err), "CH 1")
})

test_that("si el estudio no reparte por facultad, el reemplazo sigue pasando", {
  # La otra cara del mismo cambio. Endurecer la guarda sin este caso dejaria sin
  # reemplazos a los estudios que no usan facultades: ahi las dos son "" y son
  # identicas, asi que pasa.
  plan <- lapply(plan_eleccion(), function(u) { u$faculty <- ""; u })
  r <- monitoreo_aulas_activar_reemplazo(plan, "CH 1", elegida = "E-ARQ",
                                         ahora = "2026-01-01T00:00:00Z")
  expect_equal(r$activada, "E-ARQ")
})

# ── La cadena se resuelve por el campo que habla el idioma de los codigos ────
#
# Medido el 2026-09-12: `.mar_titular_de()` leia `replacement_for`, que
# `calc_muestra_aulas.R` y `monitoreo_aulas_apply_replacement()` escriben con el
# `classroom_id` del titular —`arc232_0905`—, no con su codigo operativo. Sobre
# HSVG2026, de los 202 `replacement_for` distintos CERO coincidian con un
# titular. El efecto: activar un reemplazo contestaba «no quedan reservas»
# teniendolas todas.
#
# `carga_aulas_libro_generar.R` ya tenia la leccion escrita en `.calg_titular()`;
# lo que faltaba era aplicarla aqui. Dos capas leyendo la misma relacion por
# campos distintos es la deriva que este test cierra.

.mar_cadena_fixture <- function(reserva_extra) {
  list(
    list(classroom_id = "arc232_0905", operational_code = "CH 1",
         sample_role = "titular", sample_status = "agendada"),
    utils::modifyList(
      list(classroom_id = "arc232_0906", operational_code = "R 1.1",
           sample_role = "chain_reserve", sample_status = "sin_contactar",
           replacement_order = 1),
      reserva_extra)
  )
}

test_that("la reserva se encuentra por titular_operational_code, como la escribe el libro", {
  plan <- .mar_cadena_fixture(list(titular_operational_code = "CH 1"))
  expect_length(monitoreo_aulas_reservas_disponibles(plan, "CH 1"), 1L)
  # Y la activacion completa funciona por esa via, que es la que llega del libro.
  out <- monitoreo_aulas_activar_reemplazo(plan, "CH 1", ahora = "2026-09-12T10:00:00Z")
  expect_false(isTRUE(out$agotada))
  expect_identical(out$activada, "R 1.1")
})

test_that("un replacement_for con el classroom_id interno ya no rompe la cadena", {
  # La forma EXACTA que escriben los motores. Antes daba cero reservas; ahora el
  # titular declarado manda y el `replacement_for` inservible no estorba.
  plan <- .mar_cadena_fixture(list(titular_operational_code = "CH 1",
                                   replacement_for = "arc232_0905"))
  expect_length(monitoreo_aulas_reservas_disponibles(plan, "CH 1"), 1L)
})

test_that("un plan viejo que solo trae replacement_for operativo sigue resolviendose", {
  # El respaldo: no se rompe lo que ya funcionaba.
  plan <- .mar_cadena_fixture(list(replacement_for = "CH 1"))
  expect_length(monitoreo_aulas_reservas_disponibles(plan, "CH 1"), 1L)
})
