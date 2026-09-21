# =============================================================================
# test-aulas-libro-por-agendar.R — la hoja hermana de cada semana
# =============================================================================
#
# Gonzalo, 2026-09-21: «¿y qué hay de la tabla al lado (o en otra hoja) con las
# aulas titulares aún no agendadas?». Va en OTRA hoja, hermana de la semana.
#
# Contrato:
# - Primera fila el aviso, segunda la cabecera, y de ahí las clases.
# - Una fila por (curso-horario, DÍA), con el vocabulario del operativo:
#   `LUGAR`, no `AULA` (ADR 0060: la unidad es el curso-horario).
# - Con varias aulas se nombran TODAS y se pide confirmar: el catálogo no
#   promete cuál toca ese día.
# - Sin ninguna clase que ofrecer devuelve NULL y la hoja no se crea: una
#   pestaña vacía se lee igual que una rota.
# - El tramo es la SEMANA entera del lunes, no sólo los días con cita.

.albpat_fila <- function(codigo, sesiones, venue = "A1", rol = "titular", fecha = "") {
  f <- list(operational_code = codigo, sesiones_dia_hora = sesiones, venue = venue,
            sample_role = rol, course_name = "CURSO SINTÉTICO",
            teacher = "DOCENTE, SINTÉTICO", eligible_n = 20, modality = "PRESENCIAL")
  if (nzchar(fecha)) f[["scheduled_date"]] <- fecha
  f
}

.albpat_cuerpo <- function(filas) if (length(filas) > 2L) filas[-c(1L, 2L)] else list()

test_that("la hoja abre con su aviso y su cabecera, en el vocabulario del operativo", {
  filas <- aulas_libro_filas_por_agendar(
    list(.albpat_fila("CH 7", "MAR 08:00-10:00", "Z411")), "2026-09-21", "2026-09-27")
  expect_gte(length(filas), 3L)
  aviso <- as.character(unlist(filas[[1]], use.names = FALSE))
  expect_match(aviso[[1]], "TITULARES")
  # Dice que la reescribe: su valor es estar al día, así que anotar ahí se
  # pierde y hay que advertirlo DONDE se abre, no sólo en el commit.
  expect_match(aviso[[1]], "reescribe")
  cab <- as.character(unlist(filas[[2]], use.names = FALSE))
  expect_identical(cab, c("DÍA", "FECHA", "HORARIO", "CURSO-HORARIO", "CURSO",
                          "LUGAR", "DOCENTE", "ELEGIBLES"))
  # `LUGAR` y no `AULA`: la misma palabra que la hoja de la distribución.
  expect_false("AULA" %in% cab)
})

test_that("una fila por día: el curso de dos días sale dos veces, con su fecha corta", {
  filas <- aulas_libro_filas_por_agendar(
    list(.albpat_fila("CH 18", "MAR y JUE 08:00-10:00", "J309")), "2026-09-21", "2026-09-27")
  cuerpo <- .albpat_cuerpo(filas)
  expect_length(cuerpo, 2L)
  dias <- vapply(cuerpo, function(f) as.character(unlist(f))[[1]], character(1))
  fechas <- vapply(cuerpo, function(f) as.character(unlist(f))[[2]], character(1))
  expect_identical(dias, c("Martes", "Jueves"))
  expect_identical(fechas, c("22/09", "24/09"))
  # Y la hora de la clase, que es lo que el aplicador necesita en la puerta.
  expect_identical(as.character(unlist(cuerpo[[1]]))[[3]], "08:00 a 10:00")
  expect_identical(as.character(unlist(cuerpo[[1]]))[[6]], "J309")
})

test_that("con varias aulas se nombran todas y se pide confirmar", {
  filas <- aulas_libro_filas_por_agendar(
    list(.albpat_fila("CH 40", "MIE y VIE 07:30-09:30", "Z201 · Z413")),
    "2026-09-21", "2026-09-27")
  lugares <- vapply(.albpat_cuerpo(filas), function(f) as.character(unlist(f))[[6]], character(1))
  expect_true(all(grepl("Z201 o Z413", lugares, fixed = TRUE)))
  expect_true(all(grepl("confirma", lugares)))
})

test_that("sin nada que ofrecer no se crea la hoja", {
  # Una pestaña vacía se lee igual que una rota: mejor que no exista.
  expect_null(aulas_libro_filas_por_agendar(list(), "2026-09-21", "2026-09-27"))
  # Un reemplazo no cuenta: la hoja es de TITULARES por agendar.
  expect_null(aulas_libro_filas_por_agendar(
    list(.albpat_fila("R 12.1", "MAR 08:00-10:00", "A1", rol = "chain_reserve")),
    "2026-09-21", "2026-09-27"))
  # Ni una que ya tiene cita.
  expect_null(aulas_libro_filas_por_agendar(
    list(.albpat_fila("CH 7", "MAR 08:00-10:00", "A1", fecha = "2026-09-22")),
    "2026-09-21", "2026-09-27"))
})

test_that("el nombre de la hoja hermana la deja junto a su semana", {
  expect_identical(.albpa_hoja("Semana 1"), "Semana 1 · por agendar")
  expect_identical(.albpa_hoja("Semana 12"), "Semana 12 · por agendar")
  expect_identical(.albpa_hoja(""), "Por agendar")
})

test_that("el tramo es la SEMANA entera, no sólo los días con cita", {
  # Un jueves sin ninguna cita pactada es justo el día con más hueco: acotar el
  # tramo a los días del reparto escondería sus clases precisamente ahí.
  trozo <- list(dias = list(list(fecha = "2026-09-22"), list(fecha = "2026-09-23")))
  expect_identical(.albpa_tramo(trozo), list(desde = "2026-09-21", hasta = "2026-09-26"))
  # Sin fechas legibles no se inventa una semana.
  expect_identical(.albpa_tramo(list()), list(desde = "", hasta = ""))
})

test_that("la hoja hermana NO apaga la guarda de «republico encima de su trabajo»", {
  # La hermana se publica aunque la semana tenga dueño —es cuando más sirve—,
  # pero eso no puede hacer que publicar sobre el trabajo del coordinador deje
  # de ser un error: sería cambiar un 409 declarado por un silencio.
  fuente <- readLines("../../R/monitoreo_aulas_publicar_distribucion.R", warn = FALSE)
  guarda <- grep("E_AULAS_DISTRIBUCION_CON_DUENO", fuente)
  expect_length(guarda, 1L)
  # La condición descuenta las hermanas antes de decidir que no hay nada que
  # sembrar.
  condicion <- fuente[seq(max(1L, guarda - 12L), guarda)]
  expect_true(any(grepl("setdiff(names(tabs), hermanas)", condicion, fixed = TRUE)))
})
