# **«Estas respuestas cuentan para otro aula».**
#
# Del operativo del 2026-09-09: un aplicador confundió los QR de sus dos aulas y
# CH 117 y CH 121 quedaron cruzadas. Veintiséis encuestas de Arquitectura
# contando para Arte y Diseño, y un aula que se veía sin aplicar cuando sí se
# había aplicado.
#
# La corrección vive en el PROYECTO y no en la plataforma: lo que Kobo tiene es
# lo que Kobo recibió, y editarlo borra la huella de que hubo un error.

.mreat_u <- function(cod, hora, fecha = "2026-09-09") {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = "titular", sample_status = "agendada", faculty = "Ciencias",
       scheduled_date = fecha, scheduled_time = hora, eligible_n = 40,
       expected_valid = 20)
}

.mreat_lote <- function(cod, hhmm_utc, n = 8L, desde_id = 1L) {
  base <- as.POSIXct(paste0("2026-09-09T", hhmm_utc, ":00"),
                     format = "%Y-%m-%dT%H:%M:%S", tz = "UTC")
  data.frame(
    `_id` = as.character(seq(desde_id, length.out = n)),
    classroom_id = rep(cod, n),
    `_submission_time` = format(base + seq_len(n) * 60, "%Y-%m-%dT%H:%M:%S", tz = "UTC"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("una reatribución mueve las respuestas que nombra, y sólo ésas", {
  d <- .mreat_lote("CH 1", "14:05", n = 3L, desde_id = 1L)
  cfg <- list(reatribuciones = list(list(de = "CH 1", a = "CH 9", ids = list("1", "2"))))
  out <- prosecnurapp:::.monitoreo_aulas_response_classroom(d, cfg)
  expect_equal(out, c("CH 9", "CH 9", "CH 1"))
})

test_that("sin identificadores NO corrige por posición: devuelve el crudo", {
  # Corregir por posición sería atribuir respuestas al azar, que es peor que el
  # error que se quiere arreglar.
  d <- data.frame(classroom_id = c("CH 1", "CH 1"), stringsAsFactors = FALSE)
  cfg <- list(reatribuciones = list(list(de = "CH 1", a = "CH 9", ids = list("1"))))
  expect_equal(prosecnurapp:::.monitoreo_aulas_response_classroom(d, cfg), c("CH 1", "CH 1"))
})

test_that("una entrada sin destino o sin ids se descarta: no corrige nada", {
  # Guardar una corrección que no corrige deja al que lee creyendo que algo se
  # arregló.
  expect_length(monitoreo_aulas_reatribuciones_normalizar(list(
    list(de = "CH 1", ids = list("1")),                 # sin `a`
    list(de = "CH 1", a = "CH 9", ids = list()),        # sin ids
    list(de = "CH 1", a = "CH 9", ids = list("1"))      # ésta sí
  )), 1L)
})

test_that("la última entrada manda cuando dos tocan la misma respuesta", {
  # Es alguien corrigiéndose a sí mismo: vale lo último que decidió.
  d <- .mreat_lote("CH 1", "14:05", n = 1L)
  cfg <- list(reatribuciones = list(
    list(de = "CH 1", a = "CH 8", ids = list("1")),
    list(de = "CH 1", a = "CH 9", ids = list("1"))))
  expect_equal(prosecnurapp:::.monitoreo_aulas_response_classroom(d, cfg), "CH 9")
})

test_that("propone el intercambio de dos QR cruzados, con sus ids", {
  plan <- list(.mreat_u("CH 1", "09:00"), .mreat_u("CH 2", "10:00"),
               .mreat_u("CH 3", "11:00"), .mreat_u("CH 4", "15:00"))
  d <- rbind(.mreat_lote("CH 4", "14:05", desde_id = 1L),    # lo de CH 1
             .mreat_lote("CH 2", "15:05", desde_id = 11L),
             .mreat_lote("CH 3", "16:05", desde_id = 21L),
             .mreat_lote("CH 1", "20:05", desde_id = 31L))   # lo de CH 4
  p <- monitoreo_aulas_reatribucion_propuesta(plan, d)
  expect_length(p, 2L)
  destinos <- stats::setNames(vapply(p, function(x) x$a, character(1)),
                              vapply(p, function(x) x$de, character(1)))
  expect_equal(destinos[["CH 4"]], "CH 1")
  expect_equal(destinos[["CH 1"]], "CH 4")
  # Y trae los ids, que es lo que la hace aplicable sin volver a mirar horas.
  ids4 <- unlist(p[[which(names(destinos) == "CH 4")]]$ids)
  expect_setequal(ids4, as.character(1:8))
  # Aplicarla deja a cada aula con lo suyo y CALLA al detector.
  cfg <- list(reatribuciones = p)
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, d, cfg), 0L)
})

test_that("dos aulas desfasadas hacia el MISMO lado no se proponen como cruce", {
  # No es un intercambio: es que las dos se movieron, y cambiarlas entre sí
  # dejaría las dos mal. Aquí la app tiene que callar y que mire una persona.
  plan <- list(.mreat_u("CH 1", "09:00"), .mreat_u("CH 2", "10:00"),
               .mreat_u("CH 3", "11:00"), .mreat_u("CH 4", "12:00"),
               .mreat_u("CH 5", "13:00"))
  d <- rbind(.mreat_lote("CH 1", "14:05", desde_id = 1L),
             .mreat_lote("CH 2", "15:05", desde_id = 11L),
             .mreat_lote("CH 3", "16:05", desde_id = 21L),
             .mreat_lote("CH 4", "20:05", desde_id = 31L),   # +3 h
             .mreat_lote("CH 5", "21:05", desde_id = 41L))   # +3 h
  expect_length(monitoreo_aulas_reatribucion_propuesta(plan, d), 0L)
})

test_that("el detector ve la reatribución que DESPLAZA un aula entera, no la que mezcla", {
  # Contrapartida de mirar los códigos corregidos, y su LÍMITE, que conviene
  # tener pinado para que nadie lo suponga más fuerte de lo que es.
  #
  # Mover TODO lo de un aula a otra que no tenía nada se ve: el destino queda
  # entero fuera de su franja.
  plan <- list(.mreat_u("CH 1", "09:00"), .mreat_u("CH 2", "10:00"),
               .mreat_u("CH 3", "11:00"), .mreat_u("CH 4", "18:00"))
  d <- rbind(.mreat_lote("CH 1", "14:05", desde_id = 1L),
             .mreat_lote("CH 2", "15:05", desde_id = 11L),
             .mreat_lote("CH 3", "16:05", desde_id = 21L))
  mal <- list(reatribuciones = list(list(de = "CH 1", a = "CH 4",
                                         ids = as.list(as.character(1:8)))))
  out <- monitoreo_aulas_respuestas_fuera_de_franja(plan, d, mal)
  expect_equal(vapply(out, function(x) x$codigo, character(1)), "CH 4")

  # **Pero una MEZCLA se le escapa**, y hay que decirlo: si el destino ya tenía
  # respuestas propias, la mediana de las dos mitades cae a medio camino y entra
  # dentro de la tolerancia. El detector razona por racimos, no por respuesta;
  # para eso están los ids de la propuesta, que son exactos.
  plan2 <- list(.mreat_u("CH 1", "09:00"), .mreat_u("CH 2", "10:00"),
                .mreat_u("CH 3", "11:00"), .mreat_u("CH 4", "12:00"))
  d2 <- rbind(d, .mreat_lote("CH 4", "17:05", desde_id = 31L))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan2, d2, mal), 0L)
})
