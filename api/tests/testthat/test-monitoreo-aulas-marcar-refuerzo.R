# =============================================================================
# Marcar un complemento (B) o un refuerzo (C) como REFUERZO POR CONTACTAR
# =============================================================================
#
# Gonzalo, 2026-09-11: «sería mejor que tenga un estado propio algo así como
# REFUERZO POR CONTACTAR y que sea como de un morado especial. Además el popover
# necesita operar sobre B y C porque A se aplica desde el mismo Sheets sin ayuda
# de la app, la app solo lo lee».
#
# Las dos mitades importan. El ESTADO propio porque `agendada` metería el aula en
# el aforo agendado sin que nadie haya llamado —«un refuerzo tampoco es una
# aplicación garantizada», el mismo día— y `sin_contactar` la confundiría con los
# titulares que nadie tocó nunca. Y B/C SOLAMENTE porque A ya se escribe en el
# Sheets: duplicarlo pondría a la app a competir con quien agenda en vivo.

.mmr_fila <- function(codigo, estado = "en_reserva", rol = "chain_reserve", fac = "Derecho") {
  list(operational_code = codigo, sample_role = rol, sample_status = estado,
       faculty = fac, titular_operational_code = "CH 1")
}

test_that("marca el estado propio y deja el rastro de por qué entró", {
  plan <- list(.mmr_fila("CH 1", "agendada", "titular"), .mmr_fila("R 1.1"))
  out <- monitoreo_aulas_marcar_refuerzo(plan, "R 1.1", para = "CH 1",
                                         tipo = "complemento", motivo = "rindió corto")
  m <- out$marcada
  expect_identical(m$sample_status, "refuerzo_por_contactar")
  expect_identical(m$activation_origin, "complemento")
  # A quién ayuda: en B un curso-horario, en C una facultad. Sin esto, después
  # no se sabe por qué entró esta aula.
  expect_identical(m$activated_for, "CH 1")
  expect_identical(m$activation_reason, "rindió corto")
  expect_true(nzchar(m$activated_at))
})

test_that("NO la deja en «agendada»: nadie la ha llamado todavía", {
  # Es la regla que sostiene todo el perfil desde esta jornada: agendada
  # significa que hay día en que aplicar, y aquí no lo hay.
  plan <- list(.mmr_fila("CH 1", "agendada", "titular"), .mmr_fila("R 1.1"))
  out <- monitoreo_aulas_marcar_refuerzo(plan, "R 1.1", para = "Derecho")
  expect_false(identical(out$marcada$sample_status, "agendada"))
})

test_that("el estado nuevo es del vocabulario, no una cadena suelta", {
  expect_true("refuerzo_por_contactar" %in% monitoreo_aulas_estados_muestra())
  # Y el normalizador lo reconoce como lo escribe el libro, en mayúsculas.
  expect_identical(monitoreo_aulas_estado_muestra("REFUERZO POR CONTACTAR"),
                   "refuerzo_por_contactar")
  expect_identical(monitoreo_aulas_estado_muestra("refuerzo_por_contactar"),
                   "refuerzo_por_contactar")
  # Y NO degrada a `sin_contactar`, que es a donde caía todo lo desconocido: el
  # agendador perdería justo la cola que la app le acaba de poner por delante.
  expect_false(identical(monitoreo_aulas_estado_muestra("REFUERZO POR CONTACTAR"),
                         "sin_contactar"))
})

test_that("una ya marcada no se re-marca: borraría desde cuándo espera", {
  plan <- list(.mmr_fila("R 1.1", "refuerzo_por_contactar"))
  expect_error(monitoreo_aulas_marcar_refuerzo(plan, "R 1.1"), "ya esta marcada")
})

test_that("una comprometida con otra cosa no se pisa", {
  plan <- list(.mmr_fila("R 1.1", "agendada"))
  expect_error(monitoreo_aulas_marcar_refuerzo(plan, "R 1.1"), "ya esta comprometida")
})

test_that("sin plan, sin código o con un tipo inventado da su error propio", {
  expect_error(monitoreo_aulas_marcar_refuerzo(list(), "R 1.1"), "No hay plan")
  expect_error(monitoreo_aulas_marcar_refuerzo(list(.mmr_fila("R 1.1")), ""), "Falta el codigo")
  expect_error(monitoreo_aulas_marcar_refuerzo(list(.mmr_fila("R 1.1")), "R 9.9"),
               "No existe el curso-horario")
  expect_error(monitoreo_aulas_marcar_refuerzo(list(.mmr_fila("R 1.1")), "R 1.1", tipo = "A"),
               "no es un tipo de ayuda")
})

test_that("el morado del libro va PRIMERO en la paleta", {
  # `contains` sobre la celda y gana el índice menor: si una regla con «CONTACT»
  # se colara antes, «REFUERZO POR CONTACTAR» saldría de otro color sin avisar.
  reglas <- prosecnurapp:::.mafs_REGLAS_STATUS_MUESTRA
  expect_identical(reglas[[1]]$texto, "REFUERZO POR CONTACTAR")
  expect_identical(reglas[[1]]$fondo, "#F0E9F7")
  # Y ninguna de las demás casa con ese texto, que es lo que hace segura la regla.
  otras <- vapply(reglas[-1], function(r) grepl(r$texto, "REFUERZO POR CONTACTAR", fixed = TRUE), logical(1))
  expect_false(any(otras))
})
