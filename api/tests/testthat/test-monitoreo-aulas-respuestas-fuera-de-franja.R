# **El aula cuyas respuestas llegaron a una hora que no es la suya.**
#
# Del operativo real, 2026-09-09 con campo activo: un aplicador confundió los QR
# de sus dos aulas. CH 117 (8:50-9:20) figuraba sin una sola encuesta y CH 121
# (10:30-11:00) tenía 26 recibidas entre las 08:58 y las 09:16, hora y media
# antes de existir. Nadie lo habría visto: el cruce funcionaba, ninguna
# respuesta quedó huérfana y los totales del día cuadraban; sólo estaban en la
# columna equivocada, con 26 encuestas de una facultad contando para otra.

.marff_u <- function(cod, hora, fecha = "2026-09-09") {
  list(operational_code = cod, classroom_id = tolower(gsub(" ", "", cod)),
       sample_role = "titular", sample_status = "agendada", faculty = "Ciencias",
       scheduled_date = fecha, scheduled_time = hora, eligible_n = 40,
       expected_valid = 20)
}

# Kobo sella en UTC y la agenda está en hora local; Lima es UTC-5, así que una
# clase de las 09:00 recibe lo suyo cerca de las 14:00 UTC. El detector NO sabe
# eso: deduce el desfase común de las propias aulas.
.marff_lote <- function(cod, hhmm_utc, n = 8L) {
  base <- as.POSIXct(paste0("2026-09-09T", hhmm_utc, ":00"),
                     format = "%Y-%m-%dT%H:%M:%S", tz = "UTC")
  data.frame(
    classroom_id = rep(cod, n),
    `_submission_time` = format(base + seq_len(n) * 60, "%Y-%m-%dT%H:%M:%S", tz = "UTC"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("una jornada sana no declara ninguna anomalía", {
  plan <- list(.marff_u("CH 1", "09:00"), .marff_u("CH 2", "10:00"), .marff_u("CH 3", "11:00"))
  r <- rbind(.marff_lote("CH 1", "14:05"), .marff_lote("CH 2", "15:05"),
             .marff_lote("CH 3", "16:05"))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, r), 0L)
})

test_that("dos QR cruzados salen los dos, con su desfase y sus horas en local", {
  # CH 1 y CH 4 intercambiados: cada uno lleva lo del otro. CH 2 y CH 3 sanas
  # son las que fijan cuál es el desfase normal.
  plan <- list(.marff_u("CH 1", "09:00"), .marff_u("CH 2", "10:00"),
               .marff_u("CH 3", "11:00"), .marff_u("CH 4", "15:00"))
  r <- rbind(.marff_lote("CH 4", "14:05"),   # lo de CH 1, etiquetado CH 4
             .marff_lote("CH 2", "15:05"),
             .marff_lote("CH 3", "16:05"),
             .marff_lote("CH 1", "20:05"))   # lo de CH 4, etiquetado CH 1
  out <- monitoreo_aulas_respuestas_fuera_de_franja(plan, r)
  expect_length(out, 2L)
  codigos <- vapply(out, function(x) x$codigo, character(1))
  expect_setequal(codigos, c("CH 1", "CH 4"))
  # El signo dice hacia dónde: CH 1 recibió tarde, CH 4 temprano.
  d <- vapply(out, function(x) x$desfase_min, integer(1))
  names(d) <- codigos
  expect_gt(d[["CH 1"]], 0L)
  expect_lt(d[["CH 4"]], 0L)
  # **Los minutos van RELATIVOS a la franja del aula**, no en un reloj: cuánto
  # se salió es lo que se dice por teléfono, y no necesita saber de husos.
  # Traducir a hora local exigía separar el huso del retraso de aplicación, y
  # medirlos juntos enseñaba una hora que no era la de nadie.
  ch4 <- out[[which(codigos == "CH 4")]]
  expect_lt(ch4$hasta_min, 0L)          # terminó ANTES de que su clase empezara
  expect_lt(ch4$desde_min, ch4$hasta_min)
  ch1 <- out[[which(codigos == "CH 1")]]
  expect_gt(ch1$desde_min, 0L)          # empezó mucho después de su hora
})

test_that("con menos de tres aulas medibles NO opina", {
  # «Lo normal» sería lo que diga la propia anomalía y el detector se acusaría a
  # sí mismo. Callar es la respuesta correcta, no un cero.
  plan <- list(.marff_u("CH 1", "09:00"), .marff_u("CH 2", "10:00"))
  r <- rbind(.marff_lote("CH 1", "20:05"), .marff_lote("CH 2", "15:05"))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, r), 0L)
})

test_that("un puñado de respuestas no basta para acusar a un aula", {
  # Con dos o tres la mediana es ruido. El aula rara tiene 3; las sanas, 8.
  plan <- list(.marff_u("CH 1", "09:00"), .marff_u("CH 2", "10:00"),
               .marff_u("CH 3", "11:00"), .marff_u("CH 4", "12:00"))
  r <- rbind(.marff_lote("CH 1", "14:05"), .marff_lote("CH 2", "15:05"),
             .marff_lote("CH 3", "16:05"), .marff_lote("CH 4", "22:05", n = 3L))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, r), 0L)
})

test_that("aplicar al final de una clase larga NO es una anomalía", {
  # Una clase de tres horas donde se aplica al final mueve la mediana casi una
  # hora. La tolerancia de 90 minutos existe para eso: si esto saltara, el aviso
  # sonaría todos los días y nadie lo miraría el día que importa.
  plan <- list(.marff_u("CH 1", "09:00"), .marff_u("CH 2", "10:00"),
               .marff_u("CH 3", "11:00"), .marff_u("CH 4", "12:00"))
  r <- rbind(.marff_lote("CH 1", "14:05"), .marff_lote("CH 2", "15:05"),
             .marff_lote("CH 3", "16:05"), .marff_lote("CH 4", "18:20"))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, r), 0L)
})

test_that("sin respuestas, sin plan o sin columna de tiempo devuelve vacío", {
  plan <- list(.marff_u("CH 1", "09:00"))
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(list(), .marff_lote("CH 1", "14:05")), 0L)
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, data.frame()), 0L)
  sin_hora <- data.frame(classroom_id = rep("CH 1", 8), otra = 1:8, stringsAsFactors = FALSE)
  expect_length(monitoreo_aulas_respuestas_fuera_de_franja(plan, sin_hora), 0L)
})
