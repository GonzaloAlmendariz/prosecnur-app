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
# Estos tests fijan el RESULTADO, no el mecanismo. `ID MATCH` ancla la fila y
# los bloques 2+ son reintentos DE ESA aula, asi que el parte del intento 2
# tiene que volver con su codigo y su clave `%s#%d` — da igual si el lector
# deriva el codigo del bloque 1 de la misma fila o si el generador lo repite en
# cada bloque. Lo unico que un arreglo NO puede hacer es pisar un codigo
# tecleado (anatomia 2025: el bloque 2 puede traer OTRA aula) ni fabricar
# partes por los bloques en blanco.

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

test_that("A16: el parte del intento 2 vuelve entero al releer el libro", {
  vuelto <- .a16_vuelta()
  claves <- .a16_claves(vuelto)

  # La clave con la que el propio generador indexa: aula + intento.
  expect_true("CH 1#2" %in% claves)

  r2 <- vuelto[[which(claves == "CH 1#2")[[1]]]]
  expect_identical(as.character(r2$operational_code), "CH 1")
  expect_identical(as.integer(r2$intento), 2L)
  # Los campos del parte, intactos: no basta con que la fila exista.
  expect_equal(as.numeric(r2$observed_students), 12)
  expect_equal(as.numeric(r2$refusals), 1)
  expect_equal(as.numeric(r2$effective_surveys), 9)
  expect_identical(as.character(r2$applied_by), "Equipo B")
  expect_identical(as.character(r2$application_status), "APLICADA")
  expect_identical(as.character(r2$field_note), "segunda visita")
  # La ficha escaneada del bloque 2 viaja con SU intento: B6(c) fijo el
  # generador; aqui se cierra el circulo por el xlsx.
  expect_identical(as.character(r2$scanned_sheet_link %||% ""),
                   "https://drive.google.com/file/d/reintento2/view")

  # Y el intento 1 sigue siendo el suyo: recuperar el reintento no puede
  # costarle nada al titular de la fila.
  expect_true("CH 1#1" %in% claves)
  r1 <- vuelto[[which(claves == "CH 1#1")[[1]]]]
  expect_equal(as.numeric(r1$effective_surveys), 21)
  expect_identical(as.character(r1$application_status), "NO APLICADA")
})

test_that("A16: el conteo de partes tras generar -> leer es el que se escribio", {
  # Tres escritos, tres de vuelta. Las dos mitades del pin: ni se pierde el
  # reintento (hoy vuelven 2 de 3) ni el arreglo puede fabricar partes por los
  # bloques en blanco — CH 2 tiene los bloques 2 y 3 vacios y CH 1 el 3, y un
  # bloque sin nada tecleado no es un parte.
  vuelto <- .a16_vuelta()
  expect_length(vuelto, 3L)
  expect_setequal(.a16_claves(vuelto), c("CH 1#1", "CH 1#2", "CH 2#1"))
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
