# Las bandas de «Plan del día» en Sheets (dictado 2026-09-03: «Plan del día
# también está muy feo») — derivadas del contenido real: selector B20 en navy,
# cabeceras en azul claro, totales de jornada en neutro cálido y los
# pendientes de jornadas anteriores en el rojo suave. Los strings son los de
# los renderers: si uno cambia un rótulo, este archivo lo dice.

.tpdf_filas <- function() {
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "a", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-09-10",
         scheduled_time = "10:00", faculty = "DERECHO",
         teacher = "Docente Uno", course_name = "Curso Uno"),
    list(operational_code = "CH 2", classroom_id = "b", sample_role = "titular",
         operational_status = "agendada", scheduled_date = "2026-08-01",
         scheduled_time = "09:00", faculty = "DERECHO",
         teacher = "Docente Dos", course_name = "Curso Dos")
  )
  # Un parte rendido fija el CORTE del estudio (determinismo sin reloj): con
  # él, la jornada de agosto sin parte cae a «Pendientes de jornadas
  # anteriores», que es la sección cuya banda este test clava.
  partes <- list(list(operational_code = "CH 1", intento = 1L,
                      observed_students = 20, effective_surveys = 18,
                      applied_by = "Ana", applied_date = "2026-09-10"))
  listado <- .malp_df_a_values(aulas_libro_hoja_plan_dia(plan, partes = partes))
  .mapds_con_selector(listado)
}

test_that("las bandas del plan del día se derivan del contenido publicado", {
  rows <- .tpdf_filas()
  reqs <- monitoreo_aulas_plan_dia_formato_requests(9L, rows)
  expect_gt(length(reqs), 3L)
  # Cada request toca SOLO formato o geometría: repeatCell acotado a
  # userEnteredFormat, o un ancho/alto de dimensión acotado a pixelSize.
  for (r in reqs) {
    if (!is.null(r$repeatCell)) {
      expect_true(startsWith(r$repeatCell$fields, "userEnteredFormat("))
    } else {
      expect_identical(r$updateDimensionProperties$fields, "pixelSize")
    }
  }
  primeras <- vapply(rows, function(row) trimws(as.character(row[[1]] %||% "")), character(1))
  bandas <- Filter(function(r) {
    !is.null(r$repeatCell) && grepl("backgroundColor", r$repeatCell$fields) &&
      r$repeatCell$range$startColumnIndex == 0L
  }, reqs)
  filas_banda <- vapply(bandas, function(r) r$repeatCell$range$startRowIndex + 1L, integer(1))

  # El selector: sus dos títulos en navy y a 12 pt (jerarquía, no solo color).
  fila_sel <- which(primeras == "VER EL DÍA:")[1]
  expect_true(fila_sel %in% filas_banda)
  sel <- bandas[[which(filas_banda == fila_sel)[1]]]
  expect_identical(sel$repeatCell$cell$userEnteredFormat$textFormat$fontSize, 12L)
  expect_true(which(primeras == "PLAN DEL DÍA ELEGIDO")[1] %in% filas_banda)
  # TODAS las cabeceras de tabla (área del selector y listado) ganan banda.
  cabeceras <- which(primeras == "FECHA AGENDADA")
  expect_gte(length(cabeceras), 2L)
  expect_true(all(cabeceras %in% filas_banda))
  # El cierre de cada jornada y la sección de pendientes, también.
  expect_true(all(which(primeras == "Total de la jornada") %in% filas_banda))
  expect_true(which(primeras == "Pendientes de jornadas anteriores")[1] %in% filas_banda)
  # Una fila-aula normal NO se tiñe.
  fila_aula <- which(primeras == "2026-09-10")[1]
  if (!is.na(fila_aula)) expect_false(fila_aula %in% filas_banda)
})

test_that("la celda elegible del selector se resalta en el ámbar de la casa", {
  rows <- .tpdf_filas()
  reqs <- monitoreo_aulas_plan_dia_formato_requests(9L, rows)
  primeras <- vapply(rows, function(row) trimws(as.character(row[[1]] %||% "")), character(1))
  fila_sel <- which(primeras == "VER EL DÍA:")[1]
  # La request de UNA celda (la siguiente al rótulo, en su fila), después de
  # la banda navy para ganarle en el batch.
  celda <- Filter(function(r) {
    !is.null(r$repeatCell) &&
      r$repeatCell$range$startRowIndex == fila_sel - 1L &&
      r$repeatCell$range$startColumnIndex == 1L &&
      r$repeatCell$range$endColumnIndex == 2L
  }, reqs)
  expect_identical(length(celda), 1L)
  fmt <- celda[[1]]$repeatCell$cell$userEnteredFormat
  expect_identical(fmt$backgroundColor, .monitoreo_sheets_rgb("#FDF3D8"))
  expect_true(isTRUE(fmt$textFormat$bold))
})

test_that("los anchos cubren las 15 columnas del listado y las horas van centradas", {
  rows <- .tpdf_filas()
  reqs <- monitoreo_aulas_plan_dia_formato_requests(9L, rows)
  anchos <- Filter(function(r) {
    !is.null(r$updateDimensionProperties) &&
      identical(r$updateDimensionProperties$range$dimension, "COLUMNS")
  }, reqs)
  expect_gte(length(anchos), 3L)
  cubiertas <- rep(FALSE, 15L)
  for (a in anchos) {
    rg <- a$updateDimensionProperties$range
    expect_gt(a$updateDimensionProperties$properties$pixelSize, 0L)
    cubiertas[seq.int(rg$startIndex + 1L, min(15L, rg$endIndex))] <- TRUE
  }
  expect_true(all(cubiertas))

  centrados <- Filter(function(r) {
    !is.null(r$repeatCell) &&
      identical(r$repeatCell$fields, "userEnteredFormat(horizontalAlignment)")
  }, reqs)
  expect_identical(length(centrados), 2L)
  for (ctr in centrados) {
    expect_identical(ctr$repeatCell$range$endRowIndex, length(rows))
  }
})

test_that("sin filas no hay requests; el vacío no inventa bandas", {
  expect_identical(monitoreo_aulas_plan_dia_formato_requests(9L, list()), list())
})

# --- El área del día elegido no se queda muda ---------------------------------
#
# El bloque reserva tantas filas como el día más cargado para que el desborde de
# la fórmula no choque con el listado. Sin día elegido eso son veinticinco filas
# vacías entre dos cabeceras iguales, y Gonzalo lo leyó como un bug: «el plan del
# día estaba bugueado, había filas arriba que estaban vacías». No lo estaba —
# estaba sin usar—, pero para quien abre la hoja es lo mismo.

test_that("sin día elegido el área DICE qué hacer, en vez de quedarse en blanco", {
  geo <- list(sel_col = 1L, sel_fila = 1L, fila_cabecera_listado = 29L,
              n_filas = 201L, n_cols = 21L, col_fecha = 1L, col_codigo = 8L)
  f <- prosecnurapp:::.mapds_formula(geo)
  # La rama del selector vacío ya no devuelve la cadena vacía.
  expect_false(grepl('=IF($B$1="";"";', f, fixed = TRUE))
  expect_true(grepl(prosecnurapp:::.mapds_SIN_DIA_ELEGIDO, f, fixed = TRUE))
  # Y la frase apunta al desplegable, que está justo encima.
  expect_true(grepl("arriba", prosecnurapp:::.mapds_SIN_DIA_ELEGIDO, fixed = TRUE))
})

test_that("el aviso de «ese día no tiene aulas» NO se pisa con el de «elige día»", {
  # Son dos huecos distintos: uno es que no has elegido y el otro es que ese día
  # no hay nada. Decir lo mismo en los dos casos haría creer que el selector no
  # funciona justo cuando sí funcionó.
  f <- prosecnurapp:::.mapds_formula(list(
    sel_col = 1L, sel_fila = 1L, fila_cabecera_listado = 29L,
    n_filas = 201L, n_cols = 21L, col_fecha = 1L, col_codigo = 8L))
  expect_true(grepl("Sin aulas agendadas para ese día.", f, fixed = TRUE))
  expect_false(identical(prosecnurapp:::.mapds_SIN_DIA_ELEGIDO,
                         "Sin aulas agendadas para ese día."))
})

# --- EL INVARIANTE QUE FALTABA: la reserva cubre al día más cargado ----------
#
# El bloque del selector reserva filas para el desborde del `FILTER`, y el
# propio motor lo explica: «FILTER revienta con #REF! si el desborde choca con
# una celda ocupada». Por eso la reserva se calcula como el día más cargado
# (`reserva <- max(as.integer(table(fechas)))`).
#
# **Medido en el Sheets del operativo el 2026-09-12: la reserva eran 24 filas y
# el listado publicado A SU LADO traía un día de 28** —el lunes 14/09, el más
# cargado de la semana—, así que la celda salía en `#REF!` y elegir ese día
# dejaba sin plan a quien lo abriera. Los dos números viajan en la MISMA hoja y
# no cuadraban entre sí.
#
# El invariante no mira el valor de la reserva —que cambia con cada corte— sino
# la RELACIÓN entre las dos mitades de la hoja, que es lo que nunca puede
# romperse. Un guard que fijara «24» habría que reescribirlo en cada corte y
# acabaría desactivado.

.tpdf_reserva_y_dia_mas_cargado <- function(values) {
  cab <- which(vapply(values, function(f) {
    x <- trimws(as.character(unlist(f, use.names = FALSE)))
    length(x) && identical(x[[1]], "FECHA AGENDADA")
  }, logical(1)))
  if (length(cab) < 2L) return(NULL)
  # **El MISMO criterio que producción**: cuenta la fila que trae
  # `CURSO-HORARIO`, no cualquiera que empiece por una fecha. Las filas de
  # sección, los subtotales de jornada y el bloque de pendientes también llevan
  # fecha en la primera columna, y contarlas infla el máximo — con esa medida
  # equivocada la hoja del operativo parecía tener un día de 28 contra una
  # reserva de 24, y no era cierto: con el criterio bueno son 24 contra 24.
  fechas <- .mapds_fechas_aula(values)
  list(reserva = cab[[2]] - cab[[1]] - 2L,
       mas_cargado = if (length(fechas)) max(as.integer(table(fechas))) else 0L)
}

test_that("la reserva del desborde cubre al día más cargado del listado que la acompaña", {
  medida <- .tpdf_reserva_y_dia_mas_cargado(.tpdf_filas())
  expect_false(is.null(medida))
  expect_gte(medida$reserva, medida$mas_cargado)
})

test_that("con un día muy cargado la reserva CRECE con él, no se queda fija", {
  # Doce aulas el mismo día contra una suelta en otro: si la reserva no
  # siguiera al máximo, aquí se quedaría corta y el #REF! del operativo
  # volvería a ocurrir.
  plan <- c(
    lapply(seq_len(12L), function(i) list(
      operational_code = sprintf("CH %d", i), classroom_id = sprintf("c%d", i),
      sample_role = "titular", operational_status = "agendada",
      scheduled_date = "2026-09-14", scheduled_time = sprintf("%02d:00", 8L + (i %% 10L)),
      faculty = "DERECHO", teacher = "Docente", course_name = "Curso")),
    list(list(operational_code = "CH 99", classroom_id = "z", sample_role = "titular",
              operational_status = "agendada", scheduled_date = "2026-09-15",
              scheduled_time = "09:00", faculty = "LETRAS",
              teacher = "Docente", course_name = "Curso"))
  )
  values <- .mapds_con_selector(.malp_df_a_values(aulas_libro_hoja_plan_dia(plan)))
  medida <- .tpdf_reserva_y_dia_mas_cargado(values)
  expect_false(is.null(medida))
  expect_gte(medida$mas_cargado, 12L)
  expect_gte(medida$reserva, medida$mas_cargado)
})

# --- un `#REF!` puede ser un recuerdo, no un hecho ---------------------------
#
# Medido en el operativo el 2026-09-12. La celda del área decía `#REF!` y
# Google daba el motivo exacto: «Array result was not expanded because it would
# overwrite data in B4». Pero B4 estaba VACÍA —ni `userEnteredValue`, ni
# combinaciones, ni rangos protegidos— y el día elegido cabía de sobra: 18
# filas para una reserva de 24. El estorbo existió, desapareció, y el resultado
# se quedó cacheado: `FILTER` no es volátil y Google sirve el error viejo
# mientras ninguna entrada cambie. Abrir el documento tampoco lo recalcula.
#
# Reescribir la misma fórmula no basta (Sheets ve el mismo contenido): hay que
# vaciar la celda y volver a ponerla. Sólo tras haber visto un error.

test_that("una celda atascada en error se desatasca y deja de acusarse", {
  vistas <- character(0)
  puestos <- character(0)
  # La celda arranca en `#REF!` y se limpia en cuanto alguien la reescribe.
  atascada <- TRUE
  handler <- function(url, method = "GET", body = NULL, ...) {
    if (identical(method, "PUT")) {
      v <- as.character(body$values[[1]][[1]])
      puestos <<- c(puestos, if (nzchar(v)) "formula" else "vacio")
      if (identical(v, "")) atascada <<- FALSE
      return(list(updatedCells = 1L))
    }
    vistas <<- c(vistas, "get")
    list(values = list(list(if (atascada) "#REF!" else "2026-09-10")))
  }
  testthat::local_mocked_bindings(.monitoreo_google_api = handler)
  out <- .mapds_formula_publicar("sheet_x", "Plan del día", .tpdf_filas())
  expect_true(isTRUE(out))
  # Se vació ANTES de volver a poner la fórmula: reescribir lo mismo no fuerza
  # el recálculo, y ése era justamente el fallo.
  expect_identical(puestos, c("formula", "vacio", "formula"))
  expect_length(vistas, 2L)
})

test_that("si el error sobrevive al desatasco, entonces sí viaja al recibo", {
  handler <- function(url, method = "GET", body = NULL, ...) {
    if (identical(method, "PUT")) return(list(updatedCells = 1L))
    list(values = list(list("#REF!")))
  }
  testthat::local_mocked_bindings(.monitoreo_google_api = handler)
  expect_identical(.mapds_formula_publicar("sheet_x", "Plan del día", .tpdf_filas()),
                   "#REF!")
})
