# =============================================================================
# test-aulas-libro-por-agendar.R — la hoja hermana de cada semana
# =============================================================================
#
# Gonzalo, 2026-09-21: «¿y qué hay de la tabla al lado (o en otra hoja) con las
# aulas titulares aún no agendadas?». Va en OTRA hoja. Y el mismo día, viendo la
# primera versión: «no entiendo por qué sería semana 1 estos cursos por agendar
# si son aulas que pasan todas las semanas» — así que es UNA sola hoja, por DÍA
# DE SEMANA y sin fechas.
#
# Contrato:
# - Primera fila el aviso, segunda la cabecera, y de ahí las clases.
# - Una fila por (curso-horario, DÍA DE SEMANA), con el vocabulario del operativo:
#   `LUGAR`, no `AULA` (ADR 0060: la unidad es el curso-horario).
# - Con varias aulas se nombran TODAS y se pide confirmar: el catálogo no
#   promete cuál toca ese día.
# - Sin ninguna clase que ofrecer devuelve NULL y la hoja no se crea: una
#   pestaña vacía se lee igual que una rota.
# - Orden: día de semana → hora → código.

.albpat_fila <- function(codigo, sesiones, venue = "A1", rol = "titular", fecha = "") {
  f <- list(operational_code = codigo, sesiones_dia_hora = sesiones, venue = venue,
            sample_role = rol, course_name = "CURSO SINTÉTICO",
            teacher = "DOCENTE, SINTÉTICO", eligible_n = 20, modality = "PRESENCIAL")
  if (nzchar(fecha)) f[["scheduled_date"]] <- fecha
  f
}

.albpat_cuerpo <- function(filas) if (length(filas) > 2L) filas[-c(1L, 2L)] else list()

test_that("la hoja abre con su aviso y su cabecera, en el vocabulario del operativo", {
  filas <- aulas_libro_filas_por_agendar(list(.albpat_fila("CH 7", "MAR 08:00-10:00", "Z411")))
  expect_gte(length(filas), 3L)
  aviso <- as.character(unlist(filas[[1]], use.names = FALSE))
  expect_match(aviso[[1]], "TITULARES")
  # Dice que se repiten, que es justo lo que el nombre por semana ocultaba.
  expect_match(aviso[[1]], "TODAS las semanas")
  # Dice que la reescribe: su valor es estar al día, así que anotar ahí se
  # pierde y hay que advertirlo DONDE se abre, no sólo en el commit.
  expect_match(aviso[[1]], "reescribe")
  cab <- as.character(unlist(filas[[2]], use.names = FALSE))
  expect_identical(cab, c("DÍA", "HORARIO", "CURSO-HORARIO", "CURSO",
                          "LUGAR", "DOCENTE", "ELEGIBLES"))
  # Sin FECHA: estas clases se dictan todas las semanas, y fecharlas prometía
  # una lista propia de una semana.
  expect_false("FECHA" %in% cab)
  # `LUGAR` y no `AULA`: la misma palabra que la hoja de la distribución.
  expect_false("AULA" %in% cab)
})

test_that("una fila por día: el curso de dos días sale dos veces, con su fecha corta", {
  filas <- aulas_libro_filas_por_agendar(list(.albpat_fila("CH 18", "MAR y JUE 08:00-10:00", "J309")))
  cuerpo <- .albpat_cuerpo(filas)
  expect_length(cuerpo, 2L)
  dias <- vapply(cuerpo, function(f) as.character(unlist(f))[[1]], character(1))
  expect_identical(dias, c("Martes", "Jueves"))
  # Y la hora de la clase, que es lo que el aplicador necesita en la puerta.
  expect_identical(as.character(unlist(cuerpo[[1]]))[[2]], "08:00 a 10:00")
  expect_identical(as.character(unlist(cuerpo[[1]]))[[5]], "J309")
})

test_that("con varias aulas se nombran todas y se pide confirmar", {
  filas <- aulas_libro_filas_por_agendar(list(.albpat_fila("CH 40", "MIE y VIE 07:30-09:30", "Z201 · Z413")))
  lugares <- vapply(.albpat_cuerpo(filas), function(f) as.character(unlist(f))[[5]], character(1))
  expect_true(all(grepl("Z201 o Z413", lugares, fixed = TRUE)))
  expect_true(all(grepl("confirma", lugares)))
})

test_that("sin nada que ofrecer no se crea la hoja", {
  # Una pestaña vacía se lee igual que una rota: mejor que no exista.
  expect_null(aulas_libro_filas_por_agendar(list()))
  # Un reemplazo no cuenta: la hoja es de TITULARES por agendar.
  expect_null(aulas_libro_filas_por_agendar(list(.albpat_fila("R 12.1", "MAR 08:00-10:00", "A1", rol = "chain_reserve"))))
  # Ni una que ya tiene cita.
  expect_null(aulas_libro_filas_por_agendar(list(.albpat_fila("CH 7", "MAR 08:00-10:00", "A1", fecha = "2026-09-22"))))
})

test_that("la hoja es UNA sola y su nombre no nombra ninguna semana", {
  # «Semana 1 · por agendar» prometía una lista propia de esa semana cuando
  # estas clases se dictan todas.
  expect_identical(.albpa_hoja(), "Clases por agendar")
  expect_identical(.albpa_hoja("Semana 1"), "Clases por agendar")
  expect_identical(.albpa_hoja("Semana 12"), "Clases por agendar")
  expect_false(grepl("Semana", .albpa_hoja("Semana 3")))
})



test_that("la hoja hermana NO apaga la guarda de «republico encima de su trabajo»", {
  # La hermana se publica aunque la semana tenga dueño —es cuando más sirve—,
  # pero eso no puede hacer que publicar sobre el trabajo del coordinador deje
  # de ser un error: sería cambiar un 409 declarado por un silencio.
  fuente <- paste(readLines("../../R/monitoreo_aulas_publicar_distribucion.R", warn = FALSE),
                  collapse = "\n")
  # El 409 sigue existiendo…
  expect_true(grepl("E_AULAS_DISTRIBUCION_CON_DUENO", fuente, fixed = TRUE))
  # …y su condición descuenta las hermanas antes de decidir que no hay nada que
  # sembrar. Se busca en el archivo entero y no en las líneas de alrededor: la
  # primera versión de este test ancló a doce líneas del `stop_api` y se rompió
  # en cuanto la guarda se movió, que no es el defecto que viene a vigilar.
  expect_true(grepl("setdiff(names(tabs), hermanas)", fuente, fixed = TRUE))
})

test_that("la hoja hermana está en la lista de pestañas que la publicación puede escribir", {
  # Estrenarla dio E_INTERNAL: «La publicacion solo puede escribir pestanas
  # controladas de monitoreo: Semana 1 · por agendar». El validador está bien
  # puesto —impide escribir en una pestaña cualquiera del documento del
  # cliente— y lo que faltaba era declararla.
  permitidas <- monitoreo_sheets_pestanas_controladas()
  # El nombre lo genera la MISMA función que lo escribe: si alguien lo cambia,
  # las dos listas se mueven juntas y no aparece una divergencia muda entre el
  # publicador y su validador.
  expect_true(.albpa_hoja() %in% permitidas)
  expect_true("Clases por agendar" %in% permitidas)
})

test_that("las clases salen ordenadas por día de semana y hora, no por el orden del plan", {
  # Quien lee busca «qué pasa los miércoles»: el día manda, y dentro la hora.
  plan <- list(
    .albpat_fila("CH 9", "VIE 15:00-17:00", "A1"),
    .albpat_fila("CH 2", "LUN 08:00-10:00", "A2"),
    .albpat_fila("CH 1", "LUN 08:00-10:00", "A3"),
    .albpat_fila("CH 5", "LUN 14:00-16:00", "A4"),
    .albpat_fila("CH 7", "MIE 10:00-12:00", "A5")
  )
  cuerpo <- .albpat_cuerpo(aulas_libro_filas_por_agendar(plan))
  dias <- vapply(cuerpo, function(f) as.character(unlist(f))[[1]], character(1))
  cods <- vapply(cuerpo, function(f) as.character(unlist(f))[[3]], character(1))
  expect_identical(dias, c("Lunes", "Lunes", "Lunes", "Miércoles", "Viernes"))
  # Misma hora: manda el código, no la fila del plan.
  expect_identical(cods, c("CH 1", "CH 2", "CH 5", "CH 7", "CH 9"))
})

# --- el formato, que la primera versión no tenía ------------------------------

test_that("la hoja lleva su banda, sus anchos y la cabecera congelada", {
  # Gonzalo, 2026-09-21: «le falta formato, color». Salió sin nada por quedar
  # fuera del formato de la distribución y no tener el suyo.
  filas <- aulas_libro_filas_por_agendar(
    list(.albpat_fila("CH 7", "MAR 08:00-10:00", "Z411")))
  reqs <- aulas_libro_por_agendar_formato_requests(1234L, filas)
  expect_gt(length(reqs), 5L)
  tipos <- unlist(lapply(reqs, function(r) names(r)[[1]]))
  expect_true("repeatCell" %in% tipos)
  expect_true("updateDimensionProperties" %in% tipos)
  # La cabecera se congela: con cuarenta clases, perderla al bajar obliga a
  # adivinar qué columna es cuál.
  congela <- Filter(function(r) identical(names(r)[[1]], "updateSheetProperties"), reqs)
  expect_length(congela, 1L)
  expect_identical(
    congela[[1]]$updateSheetProperties$properties$gridProperties$frozenRowCount, 2L)
  # Un ancho por columna declarada.
  anchos <- Filter(function(r) identical(names(r)[[1]], "updateDimensionProperties") &&
                     identical(r$updateDimensionProperties$range$dimension, "COLUMNS"), reqs)
  expect_length(anchos, length(.ALBPA_CABECERA))
})

test_that("el color agrupa por DÍA, no una cebra por fila", {
  # Los lunes pueden ser tres y los miércoles once: una cebra fija partiría los
  # bloques por la mitad y la tabla dejaría de leerse por día.
  plan <- list(
    .albpat_fila("CH 1", "LUN 08:00-10:00", "A1"),
    .albpat_fila("CH 2", "LUN 10:00-12:00", "A2"),
    .albpat_fila("CH 3", "LUN 14:00-16:00", "A3"),
    .albpat_fila("CH 4", "MAR 08:00-10:00", "A4")
  )
  filas <- aulas_libro_filas_por_agendar(plan)
  reqs <- aulas_libro_por_agendar_formato_requests(1L, filas)
  fondos <- Filter(function(r) identical(names(r)[[1]], "repeatCell") &&
                     identical(r$repeatCell$fields, "userEnteredFormat.backgroundColor"), reqs)
  # DOS bloques —lunes y martes—, no cuatro rayas.
  expect_length(fondos, 2L)
  expect_identical(fondos[[1]]$repeatCell$range$startRowIndex, 2L)
  expect_identical(fondos[[1]]$repeatCell$range$endRowIndex, 5L)
  expect_identical(fondos[[2]]$repeatCell$range$startRowIndex, 5L)
  expect_identical(fondos[[2]]$repeatCell$range$endRowIndex, 6L)
})

test_that("sin clases no se piden formatos para una hoja que no existe", {
  expect_identical(aulas_libro_por_agendar_formato_requests(1L, NULL), list())
  expect_identical(aulas_libro_por_agendar_formato_requests(1L, list()), list())
})

test_that("ningún rango del formato se sale de la grilla que se publica", {
  # La hoja salió publicada y SIN NADA de formato porque una petición pedía
  # H1:G28 sobre una grilla de 7 columnas: Google rechaza el lote ENTERO, así
  # que se cayeron también la banda, los anchos y el congelado. El error venía
  # de pasar números de columna a `.maaf_centrar()`, que toma índices base 0
  # con fin exclusivo.
  filas <- aulas_libro_filas_por_agendar(list(
    .albpat_fila("CH 7", "MAR 08:00-10:00", "Z411"),
    .albpat_fila("CH 8", "MIE 09:00-11:00", "Z412")))
  n_cols <- length(.ALBPA_CABECERA)
  n_filas <- length(filas)
  for (r in aulas_libro_por_agendar_formato_requests(1L, filas)) {
    rango <- r[[1]]$range
    if (is.null(rango)) next
    ci <- rango$startColumnIndex; cf <- rango$endColumnIndex
    ri <- rango$startRowIndex;    rf <- rango$endRowIndex
    if (!is.null(ci) && !is.null(cf)) {
      expect_lt(ci, cf)
      expect_lte(cf, n_cols)
      expect_gte(ci, 0L)
    }
    if (!is.null(ri) && !is.null(rf)) {
      expect_lt(ri, rf)
      expect_lte(rf, n_filas)
      expect_gte(ri, 0L)
    }
    # Y los de dimensión, que traen su propio rango.
    if (identical(names(r)[[1]], "updateDimensionProperties")) {
      d <- r$updateDimensionProperties$range
      tope <- if (identical(d$dimension, "COLUMNS")) n_cols else n_filas
      expect_lt(d$startIndex, d$endIndex)
      expect_lte(d$endIndex, tope)
    }
  }
})
