# =============================================================================
# test-aulas-plan-aplicadores-sin-agendar.R — los titulares sin agendar, dentro
# =============================================================================
#
# Gonzalo, 2026-09-21, viendo la primera versión en una hoja aparte: «en vez de
# tener dos hojas separadas, en la hoja de reparto de la semana 1 podemos poner
# integrados todos los cursos-horario titulares no confirmados […] que sigan la
# misma lógica, la misma estructura que la base original».
#
# Y el porqué, suyo también: «la ventaja de que esté en una misma hoja y que se
# repita en la siguiente semana es que tienes la misma posibilidad de asignarles
# estados, la misma posibilidad de asignarles responsables, y todo eso lo hacen
# manualmente: el coordinador de campo asigna».
#
# CUÁNDO DEJA DE APARECER: «si ha sido aplicado o rechazada, ya no vuelven a
# aparecer. Y si ha sido reagendada, ya la podemos asumir como una agendación».

.apsa_fila <- function(codigo, sesiones = "", venue = "A1", rol = "titular",
                       fecha = "", hora = "", muestra = "", validas = NA) {
  f <- list(operational_code = codigo, sample_role = rol, venue = venue,
            faculty = "CIENCIAS SOCIALES", course_name = "CURSO SINTÉTICO",
            teacher = "DOCENTE, SINTÉTICO")
  if (nzchar(sesiones)) f[["sesiones_dia_hora"]] <- sesiones
  if (nzchar(fecha)) f[["scheduled_date"]] <- fecha
  if (nzchar(hora)) f[["scheduled_time"]] <- hora
  if (nzchar(muestra)) f[["sample_status"]] <- muestra
  if (!is.na(validas)) f[["respuestas_validas"]] <- validas
  f
}

.apsa_disp <- function() list(list(nombre = "Ana Prueba", dias = stats::setNames(
  rep(list(list(list(inicio = "07:00", fin = "22:00"))), 6L),
  c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado"))))

.apsa_col <- function(fila, nombre) {
  i <- match(nombre, c("APLICADOR", "DÍA", "FECHA", "EN OFICINA", "SALE AL AULA",
                       "APLICA", "CURSO-HORARIO", "AULA", "FACULTAD", "CURSO",
                       "DOCENTE", "ESTADO"))
  as.character(unlist(fila, use.names = FALSE))[[i]]
}

.apsa_filas <- function(plan, estados = character(0)) {
  f <- aulas_libro_filas_plan_aplicadores(plan, .apsa_disp(), estados_previos = estados)
  if (is.null(f) || length(f) < 2L) return(list())
  f[-1L]
}

.apsa_codigos <- function(filas) vapply(filas, .apsa_col, character(1), "CURSO-HORARIO")

# 2026-09-22 es MARTES; su semana va del lunes 21 al sábado 26.
.APSA_PLAN <- list(
  .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
  .apsa_fila("CH 7", sesiones = "MAR y JUE 08:00-10:00", venue = "Z411")
)

test_that("un titular sin agendar entra en la hoja de la semana, con la misma estructura", {
  filas <- .apsa_filas(.APSA_PLAN)
  suyas <- Filter(function(f) identical(.apsa_col(f, "CURSO-HORARIO"), "CH 7"), filas)
  # Martes y jueves de ESA semana: dos filas, una por día.
  expect_length(suyas, 2L)
  expect_identical(vapply(suyas, .apsa_col, character(1), "FECHA"), c("22/09", "24/09"))
  expect_identical(vapply(suyas, .apsa_col, character(1), "DÍA"), c("Martes", "Jueves"))
  # El APLICADOR va VACÍO: lo asigna el coordinador en el desplegable.
  expect_identical(unique(vapply(suyas, .apsa_col, character(1), "APLICADOR")), "")
  # Su estado es el suyo, no «POR APLICAR».
  expect_identical(unique(vapply(suyas, .apsa_col, character(1), "ESTADO")),
                   "POR APLICAR SIN AGENDACIÓN")
  # Y el protocolo de horas es el mismo: recojo T−30, salida T−15.
  expect_identical(.apsa_col(suyas[[1]], "EN OFICINA"), "07:30")
  expect_identical(.apsa_col(suyas[[1]], "SALE AL AULA"), "07:45")
  # La ventana es la de la CLASE, y la celda lo DICE: un rango de dos horas en
  # una columna que promete una aplicación se lee como una aplicación de dos
  # horas. En las agendadas la hora pactada manda y ya trae el momento dentro.
  expect_identical(.apsa_col(suyas[[1]], "APLICA"), "08:00 a 10:00 (clase)")
  expect_identical(.apsa_col(suyas[[1]], "AULA"), "Z411")
})

test_that("la hora ACORDADA de una cita se respeta tal cual, con sus 30 minutos", {
  # Es la alarma de Gonzalo, 2026-09-21: «la agenda ya pone una hora acordada,
  # ¿por qué no se respeta esa hora?». Se respeta, y no se recalcula desde la
  # clase: la hora pactada ya trae dentro el momento que el docente concedió
  # —«al inicio», «en el receso», «al final»— y CH 2 lo demuestra en el
  # proyecto real: clase de 10:00 a 13:00, momento «al final», hora 12:45.
  plan <- list(.apsa_fila("CH 2", sesiones = "MAR 10:00-13:00",
                          fecha = "2026-09-22", hora = "12:45 pm"))
  fila <- .apsa_filas(plan)[[1]]
  expect_identical(.apsa_col(fila, "APLICA"), "12:45 a 13:15")
  expect_identical(.apsa_col(fila, "EN OFICINA"), "12:15")
  expect_identical(.apsa_col(fila, "SALE AL AULA"), "12:30")
  # Y no lleva la marca de clase: ésa es de las que no tienen hora acordada.
  expect_false(grepl("clase", .apsa_col(fila, "APLICA"), fixed = TRUE))
})

test_that("se intercalan por hora con las citas del mismo día, no van pegadas al final", {
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
    .apsa_fila("CH 7", sesiones = "MAR 08:00-10:00"),
    .apsa_fila("CH 9", sesiones = "MAR 15:00-17:00")
  )
  filas <- .apsa_filas(plan)
  martes <- Filter(function(f) identical(.apsa_col(f, "FECHA"), "22/09"), filas)
  # La de las 8 antes de la cita de las 9, y la de las 15 después.
  expect_identical(.apsa_codigos(martes), c("CH 7", "CH 1", "CH 9"))
})

test_that("un estado TERMINAL en lo publicado la cierra, y no vuelve la semana siguiente", {
  # Se mira por CÓDIGO y no por (código, fecha): una clase sin agendar se repite
  # cada semana con otra fecha, así que atar la respuesta a la fecha la haría
  # reaparecer el lunes siguiente como si nada.
  for (estado in c("APLICADA SIN AGENDACIÓN", "APLICADA", "RECHAZADA",
                   "REAGENDADA", "APLICADA POR REAGENDACIÓN")) {
    previos <- stats::setNames(estado, paste("CH 7", "15/09", sep = "\r"))
    expect_false("CH 7" %in% .apsa_codigos(.apsa_filas(.APSA_PLAN, previos)),
                 info = estado)
  }
})

test_that("un estado NO terminal la deja donde está, y conserva lo que el coordinador puso", {
  previos <- stats::setNames("POR APLICAR SIN AGENDACIÓN", paste("CH 7", "15/09", sep = "\r"))
  expect_true("CH 7" %in% .apsa_codigos(.apsa_filas(.APSA_PLAN, previos)))
  # Y si él ya la tocó ESA fecha, el motor no la degrada.
  previos2 <- stats::setNames("REAGENDADA", paste("CH 9", "22/09", sep = "\r"))
  plan <- c(.APSA_PLAN, list(.apsa_fila("CH 9", sesiones = "MAR 15:00-17:00")))
  expect_false("CH 9" %in% .apsa_codigos(.apsa_filas(plan, previos2)))
})

test_that("rechazada por el docente y aplicada de hecho no se ofrecen", {
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
    .apsa_fila("CH 7", sesiones = "MAR 08:00-10:00"),
    .apsa_fila("CH 8", sesiones = "MAR 08:00-10:00", muestra = "RECHAZO"),
    .apsa_fila("CH 9", sesiones = "MAR 08:00-10:00", validas = 12)
  )
  cods <- .apsa_codigos(.apsa_filas(plan))
  expect_true("CH 7" %in% cods)
  expect_false("CH 8" %in% cods)
  expect_false("CH 9" %in% cods)
})

test_that("sólo TITULARES sin fecha: ni reemplazos, ni extras, ni los ya agendados", {
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
    .apsa_fila("R 12.1", sesiones = "MAR 08:00-10:00", rol = "chain_reserve"),
    .apsa_fila("EXTRA 1", sesiones = "MAR 08:00-10:00", rol = "extra_reserve_pool"),
    # Agendado: ya es una cita, y duplicarlo sería ofrecer dos veces lo mismo.
    .apsa_fila("CH 5", sesiones = "MAR 08:00-10:00", fecha = "2026-09-24", hora = "10:00am")
  )
  cods <- .apsa_codigos(.apsa_filas(plan))
  expect_false(any(c("R 12.1", "EXTRA 1") %in% cods))
  expect_identical(sum(cods == "CH 5"), 1L)
})

test_that("sin fechas legibles en el reparto no se inventa una semana", {
  # Sin día al que colgarla, una clase semanal no tiene fecha que publicar.
  plan <- list(.apsa_fila("CH 7", sesiones = "MAR 08:00-10:00"))
  expect_length(.apsa_filas(plan), 0L)
})

# --- el gris suave que las distingue -----------------------------------------

test_that("las filas sin agendación se tiñen de DÍA a DOCENTE, y no el aplicador", {
  # Gonzalo, 2026-09-21: «para diferenciar las por aplicar y sin agendación,
  # todas las filas menos la del aplicador deben ser gris suave».
  filas <- aulas_libro_filas_plan_aplicadores(.APSA_PLAN, .apsa_disp())
  reqs <- .alpa_reglas_sin_agendar(77L, length(filas))
  expect_gte(length(reqs), 1L)
  for (r in reqs) {
    rango <- r$addConditionalFormatRule$rule$ranges[[1]]
    # DÍA es la 2.ª y DOCENTE la 11.ª: índices 1..11 (fin exclusivo).
    expect_identical(rango$startColumnIndex, 1L)
    expect_identical(rango$endColumnIndex, 11L)
    # El APLICADOR (índice 0) queda fuera: lo pidió él, y lleva el color de
    # cada persona.
    expect_gt(rango$startColumnIndex, 0L)
    # Y el ESTADO (índice 11) también: su chip es el que nombra por qué la fila
    # está gris, y teñirlo taparía la explicación de su propio tinte.
    expect_lte(rango$endColumnIndex, 11L)
    # La cabecera no se tiñe.
    expect_identical(rango$startRowIndex, 1L)
  }
})

test_that("el gris SIGUE AL VALOR del estado, no a las filas que hoy son sin agendar", {
  # Pintado estático, una fila que el coordinador marca aplicada se quedaría
  # con el aspecto de pendiente hasta la próxima publicación.
  filas <- aulas_libro_filas_plan_aplicadores(.APSA_PLAN, .apsa_disp())
  formulas <- vapply(.alpa_reglas_sin_agendar(1L, length(filas)), function(r) {
    as.character(r$addConditionalFormatRule$rule$booleanRule$condition$values[[1]]$userEnteredValue)
  }, character(1))
  expect_true(all(grepl("^=\\$L2=", formulas)))
  expect_true(any(grepl("POR APLICAR SIN AGENDACIÓN", formulas, fixed = TRUE)))
  # La columna es FIJA y la fila RELATIVA: al contrario, cada celda se
  # compararía con la del estado de la primera fila.
  expect_false(any(grepl("$L$2", formulas, fixed = TRUE)))
  # Y se cubre la forma SIN TILDES, que es la que puede haber quedado escrita
  # en un documento heredado.
  expect_true(any(grepl("SIN AGENDACION", formulas, fixed = TRUE)))
})

test_that("la regla entra en el lote de formato, antes que las del estado", {
  # Google aplica la PRIMERA regla que casa, y cada una se inserta en index 0:
  # las últimas añadidas quedan delante. El gris va antes para que el chip del
  # ESTADO siga mandando en su columna.
  filas <- aulas_libro_filas_plan_aplicadores(.APSA_PLAN, .apsa_disp())
  reqs <- aulas_libro_plan_aplicadores_formato_requests(5L, filas, roster = list("Ana Prueba"))
  es_gris <- vapply(reqs, function(r) {
    if (!identical(names(r)[[1]], "addConditionalFormatRule")) return(FALSE)
    cond <- r$addConditionalFormatRule$rule$booleanRule$condition
    identical(as.character(cond$type %||% ""), "CUSTOM_FORMULA")
  }, logical(1))
  es_estado <- vapply(reqs, function(r) {
    if (!identical(names(r)[[1]], "addConditionalFormatRule")) return(FALSE)
    rango <- r$addConditionalFormatRule$rule$ranges[[1]]
    identical(rango$startColumnIndex, 11L)
  }, logical(1))
  expect_true(any(es_gris))
  expect_true(any(es_estado))
  expect_lt(max(which(es_gris)), min(which(es_estado)))
})

# --- las agendadas cuya hora no se puede usar --------------------------------

test_that("una cita AGENDADA sin hora utilizable sale en la hoja, no desaparece", {
  # Gonzalo, 2026-09-22, con la hoja del día delante: «lo de la 37 y la 39 me
  # preocupa». CH 37 tenía «Hora por confirmar» tecleado y CH 39 la celda
  # vacía, las dos agendadas para ESE martes. El motor las manda a
  # `por_confirmar` y el publicador sólo escribía las asignaciones: la app las
  # contaba y el aplicador no las veía, así que nadie iba a un aula que el
  # docente ya había concedido.
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
    .apsa_fila("CH 37", sesiones = "MAR 14:00-17:00", venue = "A37",
               fecha = "2026-09-22", hora = "Hora por confirmar"),
    .apsa_fila("CH 39", sesiones = "MAR 09:00-12:00", venue = "A39",
               fecha = "2026-09-22")
  )
  filas <- .apsa_filas(plan)
  cods <- .apsa_codigos(filas)
  expect_true(all(c("CH 37", "CH 39") %in% cods))

  suya <- Filter(function(f) identical(.apsa_col(f, "CURSO-HORARIO"), "CH 37"), filas)[[1]]
  # Están AGENDADAS: su estado es POR APLICAR, no una apuesta sin agendación.
  expect_identical(.apsa_col(suya, "ESTADO"), "POR APLICAR")
  # El aplicador va vacío porque el motor no puede repartir sin hora.
  expect_identical(.apsa_col(suya, "APLICADOR"), "")
  # Y la celda DICE que falta la hora, con la ventana de la clase de ese día
  # para que el coordinador sepa entre qué horas cerrar con el docente.
  expect_identical(.apsa_col(suya, "APLICA"), "14:00 a 17:00 (por confirmar)")
  # Sin hora no hay recojo ni salida que calcular: vacías, no inventadas.
  expect_identical(.apsa_col(suya, "EN OFICINA"), "")
  expect_identical(.apsa_col(suya, "SALE AL AULA"), "")
  # El aula y el docente sí se saben, y son lo que hace falta para ir.
  expect_identical(.apsa_col(suya, "AULA"), "A37")
})

test_that("sin ventana de clase tampoco se inventa una: se dice que falta la hora", {
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "9:00am"),
    .apsa_fila("CH 40", fecha = "2026-09-22", hora = "Hora por confirmar")
  )
  suya <- Filter(function(f) identical(.apsa_col(f, "CURSO-HORARIO"), "CH 40"), .apsa_filas(plan))[[1]]
  expect_identical(.apsa_col(suya, "APLICA"), "Hora por confirmar")
})

test_that("se ordenan por la hora de su clase, no al final del día", {
  # Una cita por confirmar de las 9 va antes que una cita pactada de la 1: el
  # coordinador lee el día en orden y decide a quién mandar.
  plan <- list(
    .apsa_fila("CH 1", fecha = "2026-09-22", hora = "1:00pm"),
    .apsa_fila("CH 39", sesiones = "MAR 09:00-12:00", fecha = "2026-09-22")
  )
  expect_identical(.apsa_codigos(.apsa_filas(plan)), c("CH 39", "CH 1"))
})
