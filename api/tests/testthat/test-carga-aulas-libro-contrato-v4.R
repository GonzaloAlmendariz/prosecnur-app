# Contrato v4 del libro de aulas — B15 + B16 + B17 (oleada libro v4,
# docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictados de Gonzalo (2026-09-01, textuales):
# - B15: «pensemos exactamente en qué es lo que va a ver el agendador: el nombre
#   del docente, su número, las fechas del curso, y que pueda registrar cuándo
#   se va a hacer; no va a ver mucho el correo ni los matriculados — no
#   significa que no tengan que estar, pero no a la mano».
# - B16: «las aulas aplicadas, o sea el registro de campo, esté de la misma
#   forma: la asistencia, la cantidad de rechazos, los duplicados, la cantidad
#   de efectivas, el nombre del aplicador, el aula, la fecha de aplicación —
#   tenerlo bien, bien claro».
# - B17: «hay que mantener el mismo lenguaje de la app: aquí no hablamos de
#   población; matriculados totales de la DTI y matriculados elegibles, que son
#   los que cumplen los criterios».
#
# ESTE archivo es el ÚNICO sitio donde el orden de los bloques vive como
# secuencia literal de nombres. Todo lo demás (formato, desplegables,
# arrastre, orden-espejo, semáforos) se deriva de `AULAS_AGENDADAS_BLOQUE` /
# `.calg_titulos_campo()` / `BASE_CONTROL_CAMPOS` y se recomputa solo: un
# reorden futuro se paga tocando SOLO este archivo.

# El orden v4 del bloque de agenda, congelado por el lead (identidad → zona del
# agendador → contexto). El ID MATCH va FUERA del bloque, como siempre.
.v4_CAMPOS_AGENDA <- c(
  # identidad
  "operational_code", "course_name",
  # zona del agendador: lo que ve y lo que registra, junto y en orden de uso
  "teacher", "teacher_phone", "label", "contact_medium", "contact_date",
  "contact_attempts",
  # B23 (dictado 2026-09-01, con el libro en uso): el resultado de CADA
  # llamada, en todos los CH — titulares incluidos; el cluster de la
  # llamada queda junto y RECIBIO CORREO sigue pegado al status muestra.
  "call_status",
  # B22 (dictado 2026-09-01): a reemplazos y extras se les manda correo hoy
  # y se les llama mañana según necesidad — la marca va A LA IZQUIERDA del
  # status; a los titulares se les llama a todos hoy (celda vacía).
  "email_received", "sample_status",
  # Dictado 2026-09-04: «una columna adicional con algo así como AULA UTILIZADA
  # que le diga al usuario cuál fue el reemplazo que usamos, al lado de status
  # muestra». Pegada a él y no al final, porque se leen juntas.
  "aula_utilizada",
  # B30 (aviso-dictado 2026-09-02): el lugar PACTADO de la aplicacion — puede
  # diferir del aula de la clase — «a la derecha de status muestra».
  "scheduled_venue", "scheduled_date", "scheduled_day",
  "scheduled_time", "scheduled_moment", "notes",
  # contexto: tiene que estar, pero no a la mano
  "teacher_email", "faculty", "program", "level", "enrolled_total", "eligible_n", "link"
)

.v4_TITULOS_AGENDA <- c(
  "CURSO-HORARIO", "NOMBRE DEL CURSO",
  "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE", "SESIONES Y AULA",
  "MEDIO DE CONTACTO", "FECHA DE LLAMADA", "NÚMERO DE INTENTOS",
  "STATUS DE LLAMADA", "RECIBIÓ CORREO",
  # «FECHA AGENDADA», no «FECHA DE APLICACIÓN»: en la hoja del agendador esa
  # fecha es la agendada; el nombre viejo era la confusión que el renombrado de
  # la hoja de campo ya había documentado. El título viejo queda de alias.
  "STATUS MUESTRA", "AULA UTILIZADA",
  "LUGAR DE APLICACIÓN", "FECHA AGENDADA", "DÍA", "HORA", "MOMENTO DE LA CLASE",
  "OBSERVACIONES",
  "CORREO PUCP DOCENTE", "FACULTAD", "CARRERA", "NIVEL DEL CURSO",
  "MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES", "ENLACE DE LA FICHA"
)

# El orden v4 del parte de campo. Los dos denominadores ABREN el parte: son el
# marcador con el que el lector separa agenda de campo (segunda aparición de
# MATRICULADOS TOTAL DTI, carga_aulas_aplicadas.R) y el denominador que
# «% ASISTENCIA» necesita al lado. Después, el flujo del parte tal como se
# rinde: quién aplicó, cuándo, dónde, cuánto, con qué estado y su evidencia.
# S14 (dictado de Gonzalo 2026-09-07): el conteo del aplicador se escribe como
# «CANTIDAD DE ENCUESTAS APLICADAS», no «CANTIDAD DE EFECTIVAS» (las efectivas
# las da la app). El título viejo se sigue LEYENDO (carga_aulas_aplicadas.R).
.v4_TITULOS_CAMPO <- c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS ELEGIBLES",
  "APLICADOR", "FECHA DE APLICACIÓN", "HORA DE APLICACIÓN", "AULA",
  "CANTIDAD DE ASISTENTES", "% ASISTENCIA", "CANTIDAD DE RECHAZOS",
  "DUPLICADOS (YA RESPONDIERON)", "CANTIDAD DE ENCUESTAS APLICADAS",
  # «AULA UTILIZADA» entra el 2026-09-10 PEGADA a su estado, y el sitio es
  # parte del contrato: tres de los seis estados de aplicación terminan en
  # preposición —REEMPLAZADA POR, COMPLEMENTADA CON— porque piden un CUÁL, y
  # hasta esa fecha ese cuál sólo existía en «Aulas Agendadas». Las dos mitades
  # de la misma frase vivían en pestañas distintas y quien marcaba el estado no
  # tenía dónde escribir con quién (dictado de Gonzalo ese día).
  "STATUS DE APLICACIÓN", "AULA UTILIZADA (CAMPO)", "ENLACE DE FICHA ESCANEADA",
  "OBSERVACIONES SOBRE APLICACIONES"
)

.v4_unidad <- function(code = "CH 1", rol = "titular", toc = code, orden = NA) {
  list(
    operational_code = code, titular_operational_code = toc,
    sample_role = rol, replacement_order = orden,
    teacher = "Docente Demo", teacher_phone = "987654321",
    teacher_email = "docente@pucp.edu.pe", course_name = "CURSO V4",
    faculty = "SOCIALES", level = 3, label = "MAT202_0591",
    enrolled_total = 44, eligible_n = 35,
    contact_medium = "Teléfono", contact_date = "2026-09-02",
    contact_attempts = 2, sample_status = "agendada",
    scheduled_date = "2026-09-10", scheduled_day = "MIE",
    scheduled_time = "08:00", scheduled_moment = "Al inicio de la clase",
    link = "https://x.test/ficha", notes = "sin novedad"
  )
}

.v4_titulo_de <- function(campo) {
  i <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1)) == campo)
  AULAS_AGENDADAS_BLOQUE[[i[[1]]]]$titulos[[1]]
}

# --- B15: el bloque de agenda -------------------------------------------------

test_that("B15: la spec del bloque de agenda declara el orden v4 de campos", {
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  expect_identical(unname(campos), .v4_CAMPOS_AGENDA)
})

test_that("B15+B17: los títulos primarios del bloque de agenda son los v4", {
  expect_identical(unname(prosecnurapp:::.calg_titulos_agenda()), .v4_TITULOS_AGENDA)
})

test_that("contrato-b: los títulos viejos quedan de ALIAS, no se borran", {
  # Los libros vivos v3 dicen «MATRICULADOS POBLACIÓN» y «FECHA DE APLICACIÓN»
  # en la agenda; renombrar sin alias los dejaría ilegibles a mitad de campo.
  titulos_de <- function(campo) {
    i <- which(vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1)) == campo)
    AULAS_AGENDADAS_BLOQUE[[i[[1]]]]$titulos
  }
  expect_true(all(c("MATRICULADOS POBLACIÓN", "MATRICULADOS POBLACION") %in%
                    titulos_de("eligible_n")))
  expect_true(all(c("FECHA AGENDADA", "FECHA DE APLICACIÓN", "FECHA DE APLICACION") %in%
                    titulos_de("scheduled_date")))
})

test_that("B15: la hoja de agenda sale con la cabecera v4 y el sufijo de reemplazo", {
  hoja <- aulas_libro_hoja_agendadas(list(
    .v4_unidad("CH 1"),
    .v4_unidad("R 1.1", "chain_reserve", toc = "CH 1", orden = 1)
  ))
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  expect_identical(cab, c("ID MATCH", .v4_TITULOS_AGENDA,
                          paste0(.v4_TITULOS_AGENDA, " R1")))
})

test_that("B15: tras el reorden, cada valor sigue a SU título (no hay desalineación)", {
  # La trampa medida en el propio generador: la cabecera sale de la spec y las
  # celdas se escriben A MANO, así que un reorden a medias deja el teléfono bajo
  # el correo sin que nada falle. El dictado: «que todo eso se esté jalando muy
  # bien, no vaya a ser que jale mal algún número … y el docente pierda
  # seriedad sobre el estudio». Derivado por NOMBRE, no por posición: este test
  # no vuelve a tocarse por un reorden.
  u <- .v4_unidad("CH 1")
  hoja <- aulas_libro_hoja_agendadas(list(u))
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  fila <- as.character(unlist(hoja[2, ], use.names = FALSE))
  celda <- function(campo) fila[[which(cab == .v4_titulo_de(campo))[[1]]]]

  esperados <- list(
    operational_code = "CH 1", teacher = "Docente Demo",
    teacher_phone = "987654321", teacher_email = "docente@pucp.edu.pe",
    course_name = "CURSO V4", faculty = "SOCIALES",
    contact_medium = "Teléfono",
    # Las dos fechas vuelven a la hoja en dd/mm/aaaa, que es como las teclea el
    # agendador; el plan las guarda en ISO porque es lo que se ordena y se
    # compara. Regenerar con el ISO le habría cambiado la forma a las 125 filas
    # que él ya tenía escritas.
    contact_date = "02/09/2026",
    contact_attempts = "2", scheduled_date = "10/09/2026",
    scheduled_day = "MIE", scheduled_time = "08:00",
    enrolled_total = "44", eligible_n = "35",
    link = "https://x.test/ficha", notes = "sin novedad"
  )
  for (campo in names(esperados)) {
    expect_identical(celda(campo), esperados[[campo]],
                     info = sprintf("el valor de `%s` no está bajo su título", campo))
  }
})

# --- B15: sesiones legibles, punta a punta ------------------------------------

test_that("B15: SESIONES Y AULA se lee por día — día + horario + aula por sesión", {
  # El caso del dictado: «a veces pueden ser dos días en pabellones distintos
  # con horarios diferentes». Punta a punta: la cadena SESIONES del catálogo
  # DTI crudo → anotación real → unidad del plan → celda de la hoja. El emparejo
  # día↔aula NO puede cruzarse: L101 es del LUN y A506 del MIE, y perder ese
  # apareamiento es exactamente «jalar mal» el dato ante el docente.
  catalogo <- data.frame(
    SESIONES = "LUN 16:00-18:00 C  L101<br />MIE 17:00-20:00 C  A506",
    stringsAsFactors = FALSE
  )
  raw <- data.frame(x = 1, stringsAsFactors = FALSE)
  anotado <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, raw_key = "k1", catalog_key = "k1", mapping = list()
  )

  # La unidad lleva TODO lo que la anotación derivó (sea cual sea la columna
  # que el arreglo elija para conservar el apareamiento), más su identidad.
  unidad <- c(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", label = "MAT202_0591", schedule = "0591",
         teacher = "Docente Demo", eligible_n = 35),
    as.list(anotado[1, setdiff(names(anotado), "x"), drop = FALSE])
  )
  hoja <- aulas_libro_hoja_agendadas(list(unidad))
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  fila <- as.character(unlist(hoja[2, ], use.names = FALSE))
  celda <- fila[[which(cab == "SESIONES Y AULA")[[1]]]]

  # Formato pineado: cada sesión completa (día + horario + aula) y « · » como
  # separador entre sesiones — el separador de la casa (.cm_aulas_sesiones_unir).
  expect_identical(celda, "LUN 16:00-18:00 L101 · MIE 17:00-20:00 A506")
})

test_that("B15: una sesión única también sale legible, no como código de aula", {
  catalogo <- data.frame(SESIONES = "MIE 17:00-20:00 C  A506",
                         stringsAsFactors = FALSE)
  raw <- data.frame(x = 1, stringsAsFactors = FALSE)
  anotado <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, raw_key = "k1", catalog_key = "k1", mapping = list()
  )
  unidad <- c(
    list(operational_code = "CH 2", titular_operational_code = "CH 2",
         sample_role = "titular", label = "QUI777_0703", schedule = "0703",
         teacher = "Docente Demo", eligible_n = 20),
    as.list(anotado[1, setdiff(names(anotado), "x"), drop = FALSE])
  )
  hoja <- aulas_libro_hoja_agendadas(list(unidad))
  cab <- as.character(unlist(hoja[1, ], use.names = FALSE))
  fila <- as.character(unlist(hoja[2, ], use.names = FALSE))
  expect_identical(fila[[which(cab == "SESIONES Y AULA")[[1]]]],
                   "MIE 17:00-20:00 A506")
})

# --- B15: el desplegable de MOMENTO DE LA CLASE -------------------------------

test_that("B15: MOMENTO DE LA CLASE gana desplegable no absoluto en el xlsx", {
  # Dictado: tres momentos tecleables y texto libre permitido (la validación de
  # esta capa ya es allowBlank + sin error duro, patrón de todo el libro). La
  # lista vive en la hoja «Listas» con el MISMO nombre que su columna, como las
  # demás — una lista, no dos.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(
    .v4_unidad("CH 1"),
    .v4_unidad("R 1.1", "chain_reserve", toc = "CH 1", orden = 1)
  ), libro)

  listas <- suppressMessages(openxlsx::read.xlsx(libro, sheet = "Listas",
                                                 colNames = FALSE, skipEmptyRows = FALSE))
  titulos_lista <- as.character(unlist(listas[1, ], use.names = FALSE))
  col_momento <- which(titulos_lista == "MOMENTO DE LA CLASE")
  expect_length(col_momento, 1L)
  valores <- as.character(listas[-1, col_momento])
  valores <- valores[!is.na(valores) & nzchar(valores)]
  expect_identical(valores, c("Al inicio de la clase", "En el receso",
                              "Al final de la clase"))

  # Y la validación cae sobre la columna del campo en CADA bloque, derivada de
  # la spec — nunca un número a mano.
  v <- validaciones_de(libro, "Aulas Agendadas")
  expect_gt(nrow(v), 0L)
  idx <- which(vapply(AULAS_AGENDADAS_BLOQUE,
                      function(s) identical(s$campo, "scheduled_moment"), logical(1)))
  cols_momento <- vapply(1:2, function(b) {
    1L + (b - 1L) * AULAS_AGENDADAS_ANCHO_BLOQUE + idx
  }, integer(1))
  letras <- vapply(cols_momento, openxlsx::int2col, character(1))
  con_validacion <- vapply(letras, function(l) {
    any(grepl(sprintf("^%s[0-9]", l), v$sqref))
  }, logical(1))
  expect_true(all(con_validacion),
              info = sprintf("faltan desplegables de MOMENTO en columnas: %s",
                             paste(letras[!con_validacion], collapse = ", ")))
})

# --- B16: el bloque de campo --------------------------------------------------

test_that("B16: los títulos del parte de campo siguen el flujo del parte", {
  expect_identical(unname(prosecnurapp:::.calg_titulos_campo()), .v4_TITULOS_CAMPO)
})

test_that("B16: cada bloque de la hoja de campo es ID MATCH + agenda v4 + parte v4", {
  hoja <- aulas_libro_hoja_aplicadas(list(.v4_unidad("CH 1")))
  campos <- as.character(unlist(hoja[2, ], use.names = FALSE))
  inicios <- which(campos == "ID MATCH")
  expect_gt(length(inicios), 0L)
  finales <- c(inicios[-1] - 1L, length(campos))
  bloque_1 <- campos[inicios[[1]]:finales[[1]]]
  # La parte de agenda que esta hoja repite ya dice «FECHA AGENDADA» de fábrica
  # (es el título primario v4), así que las dos fechas del bloque se distinguen
  # sin el parche del `sub()`.
  expect_identical(bloque_1, c("ID MATCH", .v4_TITULOS_AGENDA, .v4_TITULOS_CAMPO))
})

test_that("B16: el lector sigue partiendo agenda/campo tras el reorden", {
  # La frontera del lector es la SEGUNDA aparición de MATRICULADOS TOTAL DTI
  # (carga_aulas_aplicadas.R). El reorden v4 la conserva: los denominadores
  # abren el parte. Ida y vuelta real, con la fecha agendada distinta de la
  # aplicada para que una frontera corrida se vea en el acto.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  partes <- list(list(
    operational_code = "CH 1", intento = 1L, observed_students = 27,
    refusals = 1, duplicates = 3, effective_surveys = 23,
    applied_by = "Bryan Robles", actual_room = "J309",
    applied_date = "2026-09-17", applied_time = "15:00",
    application_status = "APLICADA"
  ))
  aulas_libro_generar(list(.v4_unidad("CH 1")), libro, partes = partes)
  vuelto <- aulas_libro_importar(libro)$partes
  expect_length(vuelto, 1L)
  # `.caa_fecha` normaliza serial de Excel e ISO por igual: la fecha del parte
  # vuelve hoy como «46282» (defecto preexistente, ajeno al reorden) y este pin
  # vigila la FRONTERA — que la fecha leida sea la aplicada y no la agendada.
  fecha <- prosecnurapp:::.caa_fecha(vuelto[[1]]$applied_date)
  expect_identical(fecha, "2026-09-17")
  expect_false(identical(fecha, "2026-09-10"))
  expect_identical(as.character(vuelto[[1]]$applied_time), "15:00")
  expect_equal(as.numeric(vuelto[[1]]$effective_surveys), 23)
})

# --- B17: elegibles, no población ---------------------------------------------

test_that("B17: la Base de control habla de elegibles (spec y hoja generada)", {
  campos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$campo, character(1))
  titulos <- lapply(BASE_CONTROL_CAMPOS, function(s) s$titulos)
  expect_identical(titulos[[which(campos == "eligible_n")]][[1]],
                   "MATRICULADOS ELEGIBLES")
  # Lo que B17 pinea es la PALABRA, no la frase entera: el rótulo dice
  # «elegibles» y nunca «población». El 2026-09-07 pasó de «VS ELEGIBLES» a
  # «ENVIADAS VS ELEGIBLES» en el barrido de vocabulario, porque «VS» a secas no
  # dice contra qué se compara; el contrato sigue intacto.
  expect_match(titulos[[which(campos == "sent_vs_population")]][[1]], "ELEGIBLES")
  expect_false(grepl("POBLACI", titulos[[which(campos == "sent_vs_population")]][[1]]))
  # Los títulos viejos quedan de alias de lectura (libros vivos v3).
  expect_true("MATRICULADOS POBLACION" %in% titulos[[which(campos == "eligible_n")]])
  expect_true("VS POBLACION" %in% titulos[[which(campos == "sent_vs_population")]])

  d <- aulas_libro_hoja_control(list(.v4_unidad("CH 1")))
  fila_titulos <- as.character(unlist(d[2, ], use.names = FALSE))
  expect_true("MATRICULADOS ELEGIBLES" %in% fila_titulos)
  expect_true(any(grepl("ELEGIBLES", fila_titulos, fixed = TRUE)))
  expect_false(any(c("MATRICULADOS POBLACION", "MATRICULADOS POBLACIÓN",
                     "VS POBLACION") %in% fila_titulos))
})

test_that("B17: los rótulos POBLACIÓN de un libro vivo v3 se siguen leyendo", {
  # Agenda v3: el bloque con «MATRICULADOS POBLACIÓN» mapea a `eligible_n`.
  titulos_v3 <- c("CURSO-HORARIO", "NOMBRE DE DOCENTE", "MATRICULADOS POBLACIÓN")
  df <- as.data.frame(rbind(c("1", "CH 9", "Docente X", "35")), stringsAsFactors = FALSE)
  filas <- aulas_agendadas_a_plan(df, titulos = c("ID MATCH", titulos_v3))
  expect_length(filas, 1L)
  expect_equal(as.numeric(filas[[1]]$eligible_n), 35)

  # Base de control v3: «MATRICULADOS POBLACION» y «VS POBLACION» mapean.
  titulos_ctl <- c("CURSO-HORARIO", "MATRICULADOS POBLACION", "VS POBLACION")
  dfc <- as.data.frame(rbind(c("CH 9", "35", "0.7")), stringsAsFactors = FALSE)
  filas_ctl <- base_control_a_filas(dfc, titulos_ctl)$filas
  expect_length(filas_ctl, 1L)
  expect_equal(as.numeric(filas_ctl[[1]]$eligible_n), 35)
  expect_equal(as.numeric(filas_ctl[[1]]$sent_vs_population), 0.7)
})
