# A16 — los partes de intento >1 se pierden ENTEROS al releer el libro.
#
# (Checklist `docs/qa/checklist-operativo-aulas-2026-08-31.md`; preexistente,
# descubierto por el rojo de B6(c) el 2026-09-01 y declarado como defecto ajeno
# en test-carga-aulas-enlace-ficha-escaneada.R.)
#
# El mecanismo, medido: el generador escribe los bloques de reintento de «Aulas
# Aplicadas (Campo)» con la parte de AGENDA vacia —sin CURSO-HORARIO— y el
# lector exige codigo por bloque (`if (!nzchar(code)) next` en
# `aulas_aplicadas_a_partes`): un parte tecleado en el bloque 2 tiene sus celdas
# en el xlsx (`efectivas = 9` ESTA en la celda) y aun asi desaparece al
# importar.
#
# B24 (2026-09-01) cambio el eje de la hoja: los bloques son ESLABONES de la
# cadena, no visitas — un codigo tiene UN bloque y ahi viaja su parte MAS
# RECIENTE (mayor intento). La garantia de A16 se muda a la FUSION: el libro
# actualiza el mayor intento del codigo CONSERVANDO su numero, y los intentos
# anteriores viven intactos en la sesion. Lo que un arreglo sigue sin poder
# hacer: perder contenido en silencio o fabricar partes por bloques en blanco.

.a16_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1",
       titular_operational_code = "CH 1", sample_role = "titular",
       faculty = "Ciencias", course_name = "CURSO 1", teacher = "Docente 1",
       eligible_n = 30, enrolled_total = 34, expected_valid = 20),
  list(classroom_id = "A-02", operational_code = "CH 2",
       titular_operational_code = "CH 2", sample_role = "titular",
       faculty = "Letras", course_name = "CURSO 2", teacher = "Docente 2",
       eligible_n = 25, enrolled_total = 28, expected_valid = 18)
)

.a16_partes <- function() list(
  # El intento 1 que NO cerro el aula: exactamente el caso en que existe un
  # intento 2.
  list(operational_code = "CH 1", intento = 1L, observed_students = 27,
       refusals = 2, duplicates = 1, effective_surveys = 21,
       applied_by = "Equipo A", application_status = "NO APLICADA",
       field_note = "quedo pendiente"),
  # El reintento que hoy se pierde ENTERO al releer.
  list(operational_code = "CH 1", intento = 2L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applied_by = "Equipo B", application_status = "APLICADA",
       field_note = "segunda visita",
       scanned_sheet_link = "https://drive.google.com/file/d/reintento2/view"),
  # Un aula normal de un solo intento, para que el conteo tenga control.
  list(operational_code = "CH 2", intento = 1L, observed_students = 18,
       effective_surveys = 15, application_status = "APLICADA")
)

.a16_vuelta <- function() {
  libro <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  aulas_libro_generar(.a16_plan(), libro, partes = .a16_partes())
  aulas_libro_importar(libro)$partes
}

.a16_claves <- function(partes) vapply(partes, function(p)
  sprintf("%s#%d", as.character(p$operational_code %||% ""),
          as.integer(p$intento %||% 0L)), character(1))

test_that("B24: el parte MAS RECIENTE del codigo viaja al libro y vuelve entero", {
  vuelto <- .a16_vuelta()
  codigos <- vapply(vuelto, function(p) as.character(p$operational_code %||% ""),
                    character(1))
  expect_true("CH 1" %in% codigos)

  r <- vuelto[[which(codigos == "CH 1")[[1]]]]
  # El contenido es el del intento 2 (el mas reciente), campo a campo.
  expect_equal(as.numeric(r$observed_students), 12)
  expect_equal(as.numeric(r$refusals), 1)
  expect_equal(as.numeric(r$effective_surveys), 9)
  expect_identical(as.character(r$applied_by), "Equipo B")
  expect_identical(as.character(r$application_status), "APLICADA")
  expect_identical(as.character(r$field_note), "segunda visita")
  expect_identical(as.character(r$scanned_sheet_link %||% ""),
                   "https://drive.google.com/file/d/reintento2/view")
})

test_that("B24: la fusion actualiza el mayor intento del codigo y conserva los anteriores", {
  # El circuito completo: la sesion tiene CH 1#1 y CH 1#2; el libro vuelve con
  # el contenido del mas reciente corregido; la fusion pisa el #2 CONSERVANDO
  # su numero y el #1 queda intacto — nada se pierde en silencio.
  vuelto <- .a16_vuelta()
  codigos <- vapply(vuelto, function(p) as.character(p$operational_code %||% ""),
                    character(1))
  del_libro <- vuelto[[which(codigos == "CH 1")[[1]]]]
  del_libro$effective_surveys <- 11  # correccion tecleada en el libro

  fusion <- aulas_libro_fusionar_partes(.a16_partes(), list(del_libro))
  claves <- .a16_claves(fusion)
  expect_setequal(claves, c("CH 1#1", "CH 1#2", "CH 2#1"))
  f2 <- fusion[[which(claves == "CH 1#2")[[1]]]]
  expect_equal(as.numeric(f2$effective_surveys), 11)
  expect_identical(as.integer(f2$intento), 2L)
  f1 <- fusion[[which(claves == "CH 1#1")[[1]]]]
  expect_equal(as.numeric(f1$effective_surveys), 21)
  expect_identical(as.character(f1$application_status), "NO APLICADA")
})

test_that("B24: vuelve UN parte por codigo con dato y ninguno fabricado", {
  # Dos codigos con parte, dos de vuelta: el eslabon muestra el mas reciente y
  # un bloque sin nada tecleado no es un parte.
  vuelto <- .a16_vuelta()
  codigos <- vapply(vuelto, function(p) as.character(p$operational_code %||% ""),
                    character(1))
  expect_setequal(codigos, c("CH 1", "CH 2"))
})

# --- Guardas contra el arreglo de mas (anatomia real 2025, nivel lector) -----
#
# El libro de 2025 no lo escribio este generador: el equipo TECLEA el
# CURSO-HORARIO del bloque que usa, el bloque principal trae AULA (34 columnas)
# y los de reemplazo no (33). No hay fixture .xlsx real de 2025 en el repo; su
# anatomia vive sintetizada aqui igual que en test-carga-aulas-aplicadas.R
# (`docs/qa/anatomia-excels-aulas-2026-08-16.md`).

.a16_tit_agenda <- c(
  "CURSO-HORARIO", "NOMBRE DE DOCENTE", "FACULTAD", "MATRICULADOS TOTAL DTI",
  "STATUS MUESTRA", "FECHA DE APLICACIÓN"
)
.a16_agenda <- function(code) c(code, "DOCENTE DEMO", "SOCIALES", "40",
                                "AGENDADA", "2025-09-10")
.a16_tit_campo <- function(con_aula) c(
  "MATRICULADOS TOTAL DTI", "CANTIDAD DE ASISTENTES", "CANTIDAD DE EFECTIVAS",
  if (con_aula) "AULA" else NULL,
  "FECHA DE APLICACIÓN", "STATUS DE APLICACIÓN"
)
.a16_campo <- function(asist, efec, estado, con_aula) c(
  "40", as.character(asist), as.character(efec),
  if (con_aula) "J309" else NULL,
  "2025-09-17", estado
)
.a16_hoja <- function(bloques) {
  titulos <- unlist(lapply(seq_along(bloques), function(b)
    c("ID MATCH", .a16_tit_agenda, .a16_tit_campo(b == 1L))))
  fila <- unlist(lapply(seq_along(bloques), function(b) {
    bl <- bloques[[b]]
    c("7", .a16_agenda(bl$code %||% ""), bl$campo)
  }))
  list(df = as.data.frame(rbind(fila), stringsAsFactors = FALSE), titulos = titulos)
}

test_that("un codigo TECLEADO en el bloque de reintento sigue mandando", {
  # En 2025 el bloque 2 puede traer OTRA aula —el reemplazo aplicado—. Un
  # arreglo que derive el codigo del bloque 1 sin mirar la celda pisaria al
  # reemplazo con el titular. Verde hoy; tiene que seguir verde.
  h <- .a16_hoja(list(
    list(code = "CH 4", campo = .a16_campo(0, 0, "NO APLICADA", con_aula = TRUE)),
    list(code = "R 4.1", campo = .a16_campo(22, 18, "APLICADA", con_aula = FALSE))
  ))
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 2L)
  claves <- .a16_claves(partes)
  expect_setequal(claves, c("CH 4#1", "R 4.1#2"))
  r <- partes[[which(claves == "R 4.1#2")[[1]]]]
  expect_equal(as.numeric(r$effective_surveys), 18)
})

test_that("un bloque de reintento sin nada tecleado no fabrica parte", {
  # Hoy este bloque muere en la puerta del codigo (`if (!nzchar(code)) next`).
  # Con el arreglo de A16 pasara esa puerta —tendra codigo, derivado o
  # repetido— y lo tiene que parar la guarda de siempre: sin estado y sin
  # asistentes no hay parte (`test-carga-aulas-aplicadas.R`, «cadena que nunca
  # se aplico»). Verde a conservar por CUALQUIERA de los dos caminos.
  h <- .a16_hoja(list(
    list(code = "CH 4", campo = .a16_campo(30, 24, "APLICADA", con_aula = TRUE)),
    list(code = "", campo = .a16_campo("", "", "", con_aula = FALSE))
  ))
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 1L)
  expect_identical(.a16_claves(partes), "CH 4#1")
})
