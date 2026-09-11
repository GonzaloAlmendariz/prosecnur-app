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

# --- E6: ¿sobrevive el estado a regenerar el libro? --------------------------
#
# Gonzalo, 2026-09-11: «si regenero el Sheets, ¿desaparece o persiste?».
# Persiste —el libro se siembra desde el plan y el plan lo guarda— pero la
# primera medición encontró que persistía MAL: `.calg_status_excel` no lo
# conocía, caía en la rama de «fuera del vocabulario» y escribía el valor tal
# cual en mayúsculas, o sea «REFUERZO_POR_CONTACTAR» con guiones bajos. La regla
# de color busca la forma con espacios, así que el dato sobrevivía y el morado
# se perdía: justo lo que el agendador mira.

test_that("regenerar el libro escribe el estado en la forma que el color busca", {
  expect_identical(prosecnurapp:::.calg_status_excel("refuerzo_por_contactar"),
                   "REFUERZO POR CONTACTAR")
  # Y la forma ya legible tampoco se rompe al releer y regenerar.
  expect_identical(prosecnurapp:::.calg_status_excel("REFUERZO POR CONTACTAR"),
                   "REFUERZO POR CONTACTAR")
})

test_that("el desplegable lo ofrece: si no, la celda sale con warning sobre un dato correcto", {
  # Es el mismo problema que B13a documenta para «SIN CONTACTAR»: quien agenda
  # leería un aviso de error donde hay una instrucción.
  expect_true("REFUERZO POR CONTACTAR" %in% prosecnurapp:::AULAS_LIBRO_STATUS_MUESTRA_BASE)
})

test_that("el texto del libro y el de la paleta son el MISMO byte a byte", {
  # Dos listas separadas es como un estado sale de dos colores en el mismo
  # libro; aquí serían color y celda sin casar.
  reglas <- prosecnurapp:::.mafs_REGLAS_STATUS_MUESTRA
  expect_identical(reglas[[1]]$texto, prosecnurapp:::.calg_status_excel("refuerzo_por_contactar"))
})

# ── La forma del libro, que es la que trae el plan de la sesion ──────────────
#
# Medido el 2026-09-11 contra el operativo real: el plan que vive en la sesion
# guarda `sample_status` tal como lo escribe el libro —«SIN CONTACTAR»— y el
# motor comparaba contra el vocabulario normalizado `sin_contactar`. Resultado:
# las 1.213 reservas disponibles del plan contestaban «ya esta comprometida (SIN
# CONTACTAR)» y el circuito entero de refuerzos era inalcanzable desde la app.
# El defecto no lo veia ningun test porque todas las fixtures se escribian ya
# normalizadas.

.mrf_libro <- function(codigo = "R 1.1", estado = "SIN CONTACTAR") {
  list(list(operational_code = codigo, faculty = "DERECHO", sample_role = "chain_reserve",
            sample_status = estado))
}

test_that("marca una reserva cuyo estado viene en la forma del libro", {
  out <- monitoreo_aulas_marcar_refuerzo(.mrf_libro(), "R 1.1", para = "DERECHO",
                                         tipo = "refuerzo", ahora = "2026-09-11T10:00:00Z")
  expect_identical(out$marcada$sample_status, "refuerzo_por_contactar")
  expect_identical(out$marcada$activation_origin, "refuerzo")
})

test_that("«EN RESERVA» del libro tambien es una reserva disponible", {
  out <- monitoreo_aulas_marcar_refuerzo(.mrf_libro(estado = "EN RESERVA"), "R 1.1",
                                         ahora = "2026-09-11T10:00:00Z")
  expect_identical(out$marcada$sample_status, "refuerzo_por_contactar")
})

test_that("«AGENDADA» del libro sigue siendo intocable", {
  expect_error(
    monitoreo_aulas_marcar_refuerzo(.mrf_libro(estado = "AGENDADA"), "R 1.1"),
    "comprometida"
  )
})

# ── Deshacer ────────────────────────────────────────────────────────────────
#
# El autopicker marca quince de golpe; sin vuelta atras, un lote mal elegido
# deja quince cursos-horario apartados del inventario.

.mrf_marcada <- function(extra = list()) {
  fila <- list(operational_code = "R 1.1", faculty = "DERECHO", sample_role = "chain_reserve",
               sample_status = "refuerzo_por_contactar", activated_at = "2026-09-11T10:00:00Z",
               activation_origin = "refuerzo", activated_for = "DERECHO",
               activation_reason = "prueba")
  list(utils::modifyList(fila, extra))
}

test_that("retirar devuelve la reserva al inventario y borra los sellos enteros", {
  out <- monitoreo_aulas_desmarcar_refuerzo(.mrf_marcada(), "R 1.1")
  expect_identical(out$retirada$sample_status, "sin_contactar")
  # Los cuatro sellos, no tres: un `activation_origin` huerfano haria que el
  # seguimiento siguiera contando como pedida un aula que ya se solto.
  expect_null(out$retirada$activated_at)
  expect_null(out$retirada$activation_origin)
  expect_null(out$retirada$activated_for)
  expect_null(out$retirada$activation_reason)
})

test_that("no retira una marca cuya gestion ya empezo", {
  # El agendador la paso a EN CONTACTO: retirarla borraria su trabajo.
  expect_error(
    monitoreo_aulas_desmarcar_refuerzo(.mrf_marcada(list(sample_status = "en_contacto")), "R 1.1"),
    "gestion empezo"
  )
  expect_error(
    monitoreo_aulas_desmarcar_refuerzo(.mrf_marcada(list(sample_status = "AGENDADA")), "R 1.1"),
    "gestion empezo"
  )
})

test_that("no retira una marca que no puso la app", {
  expect_error(
    monitoreo_aulas_desmarcar_refuerzo(
      .mrf_marcada(list(activation_origin = NULL)), "R 1.1"),
    "no la puso la app"
  )
})

test_that("retirar y volver a marcar deja la fila como al principio", {
  # El ciclo completo, que es lo que el boton de deshacer promete.
  uno <- monitoreo_aulas_marcar_refuerzo(.mrf_libro(), "R 1.1", para = "DERECHO",
                                         ahora = "2026-09-11T10:00:00Z")
  dos <- monitoreo_aulas_desmarcar_refuerzo(uno$plan, "R 1.1")
  tres <- monitoreo_aulas_marcar_refuerzo(dos$plan, "R 1.1", para = "DERECHO",
                                          ahora = "2026-09-11T11:00:00Z")
  expect_identical(tres$marcada$sample_status, "refuerzo_por_contactar")
  expect_identical(tres$marcada$activated_at, "2026-09-11T11:00:00Z")
})

test_that("retirar exige codigo y plan", {
  expect_error(monitoreo_aulas_desmarcar_refuerzo(list(), "R 1.1"), "No hay plan")
  expect_error(monitoreo_aulas_desmarcar_refuerzo(.mrf_marcada(), ""), "Falta el codigo")
  expect_error(monitoreo_aulas_desmarcar_refuerzo(.mrf_marcada(), "R 9.9"), "No existe")
})
