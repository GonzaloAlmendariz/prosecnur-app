# EL GUARD de la clase 3: un motor que recibe el PLAN DE SESION no puede
# comparar `sample_status` en crudo.
#
# **La avería, dos veces en dos días.** El plan que vive en la sesión guarda
# `sample_status` tal como lo escribe el libro —«SIN CONTACTAR», «EN RESERVA»—
# y el vocabulario del motor es el snake_case. Comparar el crudo contra el
# normalizado deja el motor ciego:
#
#   - 2026-09-11, circuito de refuerzos: **1 213 de 1 218** reservas contestaban
#     «ya está comprometida» y marcar era imposible.
#   - 2026-09-12, camino A: `monitoreo_aulas_reservas_disponibles()` devolvía
#     **0** reservas con la forma del libro y **1** con la normalizada, así que
#     activar un reemplazo decía «no quedan» teniéndolas todas.
#
# **Por qué se prueba el COMPORTAMIENTO y no el texto del código.** Un guard que
# grepeara `.mar_txt(r$sample_status)` moriría al renombrar el helper y seguiría
# en verde —ya pasó con otro guard de este repo—. Éste le da a cada motor las
# dos formas del MISMO estado y exige que conteste lo mismo: si una se compara
# en crudo, las respuestas divergen y el test cae.

.men_cadena <- function(estado, extra = list()) {
  list(
    list(classroom_id = "arc232_0905", operational_code = "CH 1",
         sample_role = "titular", sample_status = "agendada",
         titular_operational_code = "CH 1"),
    utils::modifyList(
      list(classroom_id = "arc232_0906", operational_code = "R 1.1",
           sample_role = "chain_reserve", sample_status = estado,
           titular_operational_code = "CH 1", replacement_order = 1),
      extra)
  )
}

# Las cuatro parejas que el libro y el motor escriben para el MISMO estado.
.MEN_PAREJAS <- list(
  list(libro = "SIN CONTACTAR", motor = "sin_contactar"),
  list(libro = "EN RESERVA",    motor = "en_reserva"),
  list(libro = "PLANIFICADA",   motor = "planificada"),
  list(libro = "AGENDADA",      motor = "agendada")
)

test_that("reservas_disponibles contesta lo mismo con las dos formas del estado", {
  for (par in .MEN_PAREJAS) {
    n_libro <- length(monitoreo_aulas_reservas_disponibles(.men_cadena(par$libro), "CH 1"))
    n_motor <- length(monitoreo_aulas_reservas_disponibles(.men_cadena(par$motor), "CH 1"))
    expect_identical(
      n_libro, n_motor,
      info = sprintf(
        paste0("«%s» (forma del libro) y «%s» (forma del motor) son EL MISMO ",
               "estado y dan %d contra %d reservas: el motor compara en crudo ",
               "y el plan de sesion trae la forma del libro."),
        par$libro, par$motor, n_libro, n_motor)
    )
  }
})

test_that("marcar un refuerzo contesta lo mismo con las dos formas del estado", {
  # El motor del 2026-09-11, para que su arreglo no se pueda deshacer sin ruido.
  intento <- function(estado) {
    plan <- list(list(operational_code = "R 1.1", faculty = "DERECHO",
                      sample_role = "chain_reserve", sample_status = estado))
    tryCatch({
      monitoreo_aulas_marcar_refuerzo(plan, "R 1.1", para = "DERECHO",
                                      ahora = "2026-09-12T10:00:00Z")
      "marca"
    }, error = function(e) if (inherits(e, "api_error")) e$code else "E_OTRO")
  }
  for (par in .MEN_PAREJAS) {
    expect_identical(
      intento(par$libro), intento(par$motor),
      info = sprintf("«%s» y «%s» son el mismo estado y el motor los trata distinto.",
                     par$libro, par$motor)
    )
  }
})

test_that("la publicacion de marcas reconoce el estado en las dos formas", {
  # `monitoreo_aulas_marcas_por_publicar()` filtra por `refuerzo_por_contactar`.
  fila <- function(estado) list(list(operational_code = "R 1.1", sample_status = estado))
  remoto <- data.frame(`CURSO-HORARIO` = "R 1.1", `STATUS MUESTRA` = "SIN CONTACTAR",
                       check.names = FALSE, stringsAsFactors = FALSE)
  n <- function(estado) length(monitoreo_aulas_marcas_por_publicar(fila(estado), remoto)$escribibles)
  expect_identical(n("REFUERZO POR CONTACTAR"), n("refuerzo_por_contactar"))
})
