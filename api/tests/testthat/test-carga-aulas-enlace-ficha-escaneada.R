# B6(c) — la columna MANUAL «ENLACE DE FICHA ESCANEADA» del parte de campo.
#
# Gonzalo (2026-08-31, dictado): «debe haber una columna sp. no automatica para
# poder pegar la ficha QR escaneada, o sea su enlace, porque tambien se va a
# subir a un drive».
#
# El contrato, congelado por el lead:
#
# - La hoja «Aulas Aplicadas (Campo)» gana una columna manual en la parte de
#   campo de CADA bloque de intento. La hoja ES de bloques por intento
#   (TITULAR, REEMPLAZO 1, ...: cada bloque abre con `ID MATCH` y trae parte de
#   agenda + parte de campo). B6c la puso al FINAL; el orden v4 (B16) la
#   recoloco dentro del flujo del parte — la SECUENCIA vive en
#   test-carga-aulas-libro-contrato-v4.R y aqui todo se deriva por nombre.
# - La app la SIEMBRA vacia y la LEE de vuelta. El enlace —el PDF escaneado que
#   el equipo sube al Drive— es dato del EQUIPO: la app no lo posee, no lo
#   deriva y no lo pisa. NO confundir con `link` («ENLACE DE LA FICHA»), que es
#   la ficha QR generada por la app y vive en la parte de agenda.
# - El campo del parte se llama `scanned_sheet_link`, alineado al estilo de los
#   demas campos del parte (`applied_by`, `actual_room`, `field_note`).
# - Libros viejos sin la columna se leen igual (tolerancia por titulo, el
#   patron de toda la hoja).
# - El registro en-app NO la escribe: no es un campo del formulario del parte.

.efe_enlace <- function(tag) sprintf("https://drive.google.com/file/d/%s/view", tag)

.efe_titulo <- "ENLACE DE FICHA ESCANEADA"

.efe_tit_agenda <- c(
  "CURSO-HORARIO", "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE",
  "CORREO PUCP DOCENTE", "NOMBRE DEL CURSO", "FACULTAD", "NIVEL DEL CURSO",
  "SESIONES Y AULA", "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN",
  "MEDIO DE CONTACTO", "FECHA DE LLAMADA", "NÚMERO DE INTENTOS",
  "STATUS MUESTRA", "FECHA AGENDADA", "DÍA", "HORA", "MOMENTO DE LA CLASE",
  "ENLACE DE LA FICHA", "OBSERVACIONES SOBRE AULAS AGENDADAS"
)

.efe_agenda <- function(code) c(
  code, "DOCENTE DEMO", "999", "demo@pucp.edu.pe", "CURSO DEMO", "SOCIALES",
  "3", "LUN 08:00 A101", "40", "35", "Llamada", "2026-09-02", "1", "AGENDADA",
  "2026-09-10", "MIE", "08:00", "inicio", "https://x.test/ficha-qr", "sin novedad"
)

# La parte de campo del bloque. `con_enlace = FALSE` reproduce el libro VIEJO,
# que es exactamente la forma de hoy (13 titulos, remata en OBSERVACIONES).
.efe_tit_campo <- function(con_enlace = TRUE) c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN", "CANTIDAD DE ASISTENTES",
  "% ASISTENCIA", "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)",
  "CANTIDAD DE EFECTIVAS", "APLICADOR", "AULA", "FECHA DE APLICACIÓN",
  "HORA DE APLICACIÓN", "STATUS DE APLICACIÓN",
  "OBSERVACIONES SOBRE APLICACIONES",
  if (con_enlace) .efe_titulo else NULL
)

.efe_campo <- function(enlace = NULL) c(
  "40", "35", "27", "0.62", "1", "3", "23", "Bryan Robles", "J309",
  "2026-09-17", "15:00", "APLICADA", "todo bien",
  enlace
)

.efe_hoja <- function(bloques, con_enlace = TRUE) {
  titulos <- unlist(lapply(bloques, function(b)
    c("ID MATCH", .efe_tit_agenda, .efe_tit_campo(con_enlace))))
  fila <- unlist(lapply(bloques, function(b)
    c("7", .efe_agenda(b$code), b$campo)))
  list(df = as.data.frame(rbind(fila), stringsAsFactors = FALSE), titulos = titulos)
}

.efe_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1",
       titular_operational_code = "CH 1", sample_role = "titular",
       faculty = "Ciencias", course_name = "CURSO 1", teacher = "Docente 1",
       eligible_n = 30, enrolled_total = 34, sample_status = "agendada",
       # El enlace de la ficha QR, que la app SI posee. Esta aqui a proposito:
       # es el señuelo con el que se comprueba que el generador no lo cuela en
       # la columna del escaneado.
       link = "https://ee.kobotoolbox.org/x/abc?d[collectorID]=CH%201")
)

# --- El lector -------------------------------------------------------------

test_that("una fila con el enlace pegado produce un parte con `scanned_sheet_link`", {
  h <- .efe_hoja(list(list(code = "CH 9", campo = .efe_campo(.efe_enlace("abc123")))))
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 1L)
  expect_identical(partes[[1]]$scanned_sheet_link, .efe_enlace("abc123"))
})

test_that("cada intento conserva SU enlace: la ficha del reintento es otra ficha", {
  # Dos bloques del mismo curso-horario —titular y reemplazo, misma clave
  # `%s#%d` con intento distinto—, cada uno con su PDF escaneado.
  h <- .efe_hoja(list(
    list(code = "CH 9", campo = .efe_campo(.efe_enlace("intento1"))),
    list(code = "CH 9", campo = .efe_campo(.efe_enlace("intento2")))
  ))
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 2L)
  por_intento <- setNames(partes, vapply(partes, function(p) as.character(p$intento), character(1)))
  expect_identical(por_intento[["1"]]$scanned_sheet_link, .efe_enlace("intento1"))
  expect_identical(por_intento[["2"]]$scanned_sheet_link, .efe_enlace("intento2"))
})

test_that("un libro viejo sin la columna se lee igual y no inventa enlace", {
  # Tolerancia, el contrato-b de toda la hoja: el emparejado es por titulo y lo
  # ausente no rompe. Se acepta ausencia o cadena vacia —ambas dicen «no hay
  # enlace»— para no fijar mas de lo que el diseño congelo.
  h <- .efe_hoja(list(list(code = "CH 9", campo = .efe_campo())), con_enlace = FALSE)
  partes <- aulas_aplicadas_a_partes(h$df, h$titulos)
  expect_length(partes, 1L)
  expect_identical(partes[[1]]$scanned_sheet_link %||% "", "")
  # Y el resto del parte sigue entero: la columna nueva no descuadra lo viejo.
  expect_equal(partes[[1]]$effective_surveys, 23)
  expect_identical(partes[[1]]$field_note, "todo bien")
})

# --- El generador ----------------------------------------------------------

test_that("el generador siembra la columna del escaneado en cada bloque, vacia", {
  # DÓNDE cae dentro del parte lo pinea el contrato v4 del bloque
  # (test-carga-aulas-libro-contrato-v4.R); aqui se deriva por NOMBRE para que
  # un reorden del parte no obligue a recontar nada.
  hoja <- aulas_libro_hoja_aplicadas(.efe_plan())
  campos <- as.character(unlist(hoja[2, ], use.names = FALSE))
  inicios <- which(campos == "ID MATCH")
  # B24: los bloques son ESLABONES — un plan de un titular sin reservas tiene
  # UN bloque, no los 3 fijos del diseño por intentos.
  expect_length(inicios, 1L)
  cols_enlace <- which(campos == .efe_titulo)
  # Una por bloque de intento.
  expect_length(cols_enlace, length(inicios))
  # Y la celda sale VACIA en un libro nuevo: el enlace lo pega el equipo. En
  # particular NO sale `link` —la ficha QR del plan—, que es el señuelo del
  # fixture: son dos enlaces distintos y la app solo posee el primero.
  cuerpo <- hoja[-c(1, 2), cols_enlace, drop = FALSE]
  expect_true(all(!nzchar(trimws(as.character(unlist(cuerpo))))))
})

test_that("un parte guardado en castellano tambien devuelve su enlace al libro", {
  # La leccion de las cuatro capas ciegas (`monitoreo_aulas_alias.R`): los
  # partes pueden vivir en castellano y el generador escribe por alias, no por
  # nombre literal. `enlace_ficha_escaneada` es la forma castellana declarada.
  parte <- list(operational_code = "CH 1", intento = 1L, asistentes = 27,
                efectivas = 23, estado = "APLICADA",
                enlace_ficha_escaneada = .efe_enlace("manual"))
  hoja <- aulas_libro_hoja_aplicadas(.efe_plan(), partes = list(parte))
  campos <- as.character(unlist(hoja[2, ], use.names = FALSE))
  col <- which(campos == .efe_titulo)
  expect_gt(length(col), 0L)
  fila <- as.character(unlist(hoja[3, ], use.names = FALSE))
  expect_identical(fila[[col[[1]]]], .efe_enlace("manual"))
})

# --- El roundtrip ----------------------------------------------------------

test_that("el enlace pegado por el equipo sobrevive generar -> leer", {
  partes <- list(
    list(operational_code = "CH 1", intento = 1L, observed_students = 27,
         effective_surveys = 23, application_status = "APLICADA",
         scanned_sheet_link = .efe_enlace("vuelta1"))
  )
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.efe_plan(), libro, partes = partes)
  vuelto <- aulas_libro_importar(libro)$partes
  expect_length(vuelto, 1L)
  expect_identical(as.character(vuelto[[1]]$scanned_sheet_link %||% ""),
                   .efe_enlace("vuelta1"))
  # El señuelo: lo que vuelve es el escaneado del EQUIPO, no la ficha QR que la
  # app posee en `link`.
  expect_false(grepl("kobotoolbox", as.character(vuelto[[1]]$scanned_sheet_link %||% "")))
})

test_that("el enlace de una reserva aplicada cae en el bloque de SU eslabon", {
  # B24: los bloques son eslabones. El parte de la reserva R 1.1 —con su propio
  # escaneado— cae en el bloque 2 (su eslabon), y el del titular en el bloque
  # 1; y para el MISMO codigo con dos visitas, el bloque muestra el escaneado
  # del intento mas reciente (la garantia de no perder el anterior vive en la
  # fusion: test-carga-aulas-partes-reintento.R).
  plan <- c(.efe_plan(), list(
    list(classroom_id = "A-02", operational_code = "R 1.1",
         titular_operational_code = "CH 1", sample_role = "chain_reserve",
         replacement_order = 1, faculty = "Ciencias", course_name = "CURSO 1R",
         teacher = "Docente 1R", eligible_n = 26, enrolled_total = 29)
  ))
  partes <- list(
    list(operational_code = "CH 1", intento = 1L, observed_students = 27,
         effective_surveys = 23, application_status = "APLICADA",
         scanned_sheet_link = .efe_enlace("bloque1")),
    list(operational_code = "R 1.1", intento = 1L, observed_students = 12,
         effective_surveys = 9, application_status = "APLICADA",
         scanned_sheet_link = .efe_enlace("bloque2"))
  )
  hoja <- aulas_libro_hoja_aplicadas(plan, partes = partes)
  campos <- as.character(unlist(hoja[2, ], use.names = FALSE))
  # Por NOMBRE, no por «ultima del bloque»: la posicion dentro del parte la
  # pinea el contrato v4 y aqui solo importa que cada eslabon conserve SU celda.
  cols_enlace <- which(campos == .efe_titulo)
  expect_gte(length(cols_enlace), 2L)
  fila <- as.character(unlist(hoja[3, ], use.names = FALSE))
  expect_identical(fila[[cols_enlace[[1]]]], .efe_enlace("bloque1"))
  expect_identical(fila[[cols_enlace[[2]]]], .efe_enlace("bloque2"))
})

# --- El payload del tablero ------------------------------------------------

test_that("el enlace viaja hasta el payload de partes publicados", {
  # Mismo precedente que `attendance_pct` (test-carga-aulas-aplicadas.R): un
  # lector que lo lee y un publicador que lo tira dejan el dato muerto camino a
  # la UI. La ficha del registro (fase 2, frontend) lo busca aqui.
  parte <- list(operational_code = "CH 9", intento = 1L, observed_students = 27,
                effective_surveys = 23, application_status = "APLICADA",
                scanned_sheet_link = .efe_enlace("payload"))
  pub <- monitoreo_aulas_partes_publicados(list(parte))[[1]]
  expect_identical(pub$scanned_sheet_link, .efe_enlace("payload"))
})

# --- El registro en-app NO la escribe --------------------------------------

test_that("el parte en-app no emite el enlace: la columna es manual del equipo", {
  # Guard verde a proposito, contra el arreglo de mas: agregar el campo a
  # `.PARTE_APP_CAMPOS` convertiria una columna manual del equipo en un campo
  # del formulario, que es exactamente lo que el dictado excluye («no
  # automatica»). Un update que solo trae el enlace no fabrica parte.
  upd <- list(scanned_sheet_link = .efe_enlace("x"),
              enlace_ficha_escaneada = .efe_enlace("x"))
  expect_identical(monitoreo_aulas_parte_de_update(upd), list())

  # Y un update legitimo del registro en-app tampoco lo blanquea: el upsert es
  # PATCH y el valor del libro manda porque el update no lo menciona.
  parte_libro <- list(operational_code = "CH 1", intento = 1L,
                      observed_students = 27, effective_surveys = 23,
                      application_status = "APLICADA",
                      scanned_sheet_link = .efe_enlace("del-libro"))
  upsert <- monitoreo_aulas_partes_upsert(
    partes = list(parte_libro),
    updates = list(list(operational_code = "CH 1", effective_surveys = 24)),
    plan = list()
  )
  expect_identical(upsert[[1]]$scanned_sheet_link, .efe_enlace("del-libro"))
  expect_equal(as.numeric(upsert[[1]]$effective_surveys), 24)
})
