# Lector del parte de campo «Aulas Aplicadas (Campo)».
#
# Fixture sintetica: el libro real trae docentes con telefono y correo. Lo que
# se fija es la anatomia medida en `docs/qa/anatomia-excels-aulas-2026-08-16.md`.

.cap_agenda <- function(code) c(
  "Muestra 01", code, "DOCENTE DEMO", "999", "demo@pucp.edu.pe", "CURSO DEMO",
  "SOCIALES", "3", "LUN 08:00 A101", "40", "35", "Llamada", "2025-09-02", "1",
  "AGENDADA", "2025-09-10", "Miercoles", "08:00", "https://x.test/f", "sin novedad"
)
.cap_tit_agenda <- c(
  "MUESTRA", "CURSO-HORARIO", "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE",
  "CORREO PUCP DOCENTE", "NOMBRE DEL CURSO", "FACULTAD", "NIVEL DEL CURSO",
  "SESIONES Y AULA", "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN",
  "MEDIO DE CONTACTO", "FECHA DE LLAMADA", "NÚMERO DE INTENTOS", "STATUS MUESTRA",
  "FECHA DE APLICACIÓN", "DÍA", "HORA", "ENLACE DE LA FICHA",
  "OBSERVACIONES SOBRE AULAS AGENDADAS"
)
# El bloque principal trae AULA; los de reemplazo no. Esa es la irregularidad.
.cap_tit_campo <- function(con_aula) c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN", "CANTIDAD DE ASISTENTES",
  "% ASISTENCIA", "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)",
  "CANTIDAD DE EFECTIVAS", "APLICADOR",
  if (con_aula) "AULA" else NULL,
  "FECHA DE APLICACIÓN", "HORA DE APLICACIÓN", "STATUS DE APLICACIÓN",
  "OBSERVACIONES SOBRE APLICACIONES"
)
.cap_campo <- function(asist, rech, dup, efec, estado = "APLICADA", con_aula = TRUE,
                       aula = "J309", asistencia = "0.5") {
  c("40", "35", as.character(asist), as.character(asistencia), as.character(rech), as.character(dup),
    as.character(efec), "Bryan Robles",
    if (con_aula) aula else NULL,
    "2025-09-17", "15:00", estado, "todo bien")
}

.cap_hoja <- function(bloques) {
  titulos <- unlist(lapply(seq_along(bloques), function(b)
    c("ID MATCH", .cap_tit_agenda, .cap_tit_campo(b == 1L))))
  fila <- unlist(lapply(seq_along(bloques), function(b) {
    bl <- bloques[[b]]
    if (is.null(bl)) return(c("", rep("", length(.cap_tit_agenda)), rep("", length(.cap_tit_campo(b == 1L)))))
    c("77", .cap_agenda(bl$code), bl$campo)
  }))
  list(df = as.data.frame(rbind(fila), stringsAsFactors = FALSE), titulos = titulos)
}

test_that("los bloques se detectan por su marcador y no por un paso fijo", {
  h <- .cap_hoja(list(
    list(code = "POL312-0889", campo = .cap_campo(5, 0, 0, 5)),
    list(code = "POL312-0890", campo = .cap_campo(8, 1, 0, 7, con_aula = FALSE))
  ))
  # El control: el bloque principal ocupa una columna mas que el de reemplazo
  # —solo el trae AULA—, asi que un paso fijo desalinearia el segundo.
  expect_length(aulas_aplicadas_inicios(h$titulos), 2L)
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 2L)
  expect_identical(partes[[1]]$operational_code, "POL312-0889")
  expect_identical(partes[[1]]$intento, 1L)
  expect_identical(partes[[2]]$operational_code, "POL312-0890")
  expect_identical(partes[[2]]$intento, 2L)
})

test_that("la fecha de aplicacion real no se confunde con la agendada", {
  h <- .cap_hoja(list(list(code = "ABC-01", campo = .cap_campo(10, 2, 1, 7))))
  p <- aulas_aplicadas_a_partes(h$df, h$titulos)[[1]]
  # El control: `FECHA DE APLICACION` aparece dos veces en el bloque; resolver
  # por titulo a secas devolveria la agendada (2025-09-10).
  expect_identical(p$applied_date, "2025-09-17")
  expect_identical(p$applied_time, "15:00")
})

test_that("el parte trae los cuatro numeros que definen el resultado", {
  h <- .cap_hoja(list(list(code = "ABC-01", campo = .cap_campo(27, 1, 3, 23))))
  p <- aulas_aplicadas_a_partes(h$df, h$titulos)[[1]]
  expect_equal(p$observed_students, 27)
  expect_equal(p$refusals, 1)
  expect_equal(p$duplicates, 3)
  # `effective_surveys` es el numero que manda; no es "encuestas aplicadas".
  expect_equal(p$effective_surveys, 23)
  expect_identical(p$actual_room, "J309")
})

test_that("el porcentaje de asistencia llega al parte y no se recalcula", {
  # Era el unico de los once campos de la hoja que estaba declarado en
  # `AULAS_APLICADAS_CAMPO`, se le resolvia la columna y no se escribia en el
  # parte. La hoja trae 40 matriculados y 27 asistentes —que darian 0.675— y el
  # equipo escribio 0.62: se publica LO QUE ESCRIBIO. El control esta puesto asi
  # a proposito; con un valor coherente, un `attendance_pct` derivado a mano
  # pasaria este test igual que uno leido.
  h <- .cap_hoja(list(list(code = "ABC-01", campo = .cap_campo(27, 1, 3, 23, asistencia = "0.62"))))
  p <- aulas_aplicadas_a_partes(h$df, h$titulos)[[1]]
  expect_equal(p$attendance_pct, 0.62)

  # Y viaja hasta el payload, que es donde la vista lo busca. Un lector que lo
  # lee y un publicador que lo tira dejarian este campo a medio camino otra vez.
  pub <- monitoreo_aulas_partes_publicados(list(p))[[1]]
  expect_equal(pub$attendance_pct, 0.62)
})

test_that("un bloque sin estado ni asistentes no produce parte", {
  h <- .cap_hoja(list(
    list(code = "ABC-01", campo = .cap_campo(10, 0, 0, 10)),
    list(code = "ABC-02", campo = .cap_campo("", "", "", "", estado = "", con_aula = FALSE))
  ))
  # El control: contarlo como aula visitada inflaria el avance con cadena que
  # nunca se aplico.
  expect_length(aulas_aplicadas_a_partes(h$df, h$titulos), 1L)
})

test_that("el estado de aplicacion es su propio eje", {
  h <- .cap_hoja(list(list(code = "ABC-01", campo = .cap_campo(0, 0, 0, 0, estado = "NO APLICADA"))))
  p <- aulas_aplicadas_a_partes(h$df, h$titulos)[[1]]
  expect_identical(p$application_status, "NO APLICADA")
  # No se mezcla con `sample_status`, que vive en la hoja de agendamiento.
  expect_null(p$sample_status)
})
