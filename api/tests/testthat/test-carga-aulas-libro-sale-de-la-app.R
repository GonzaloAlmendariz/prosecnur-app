# El libro sale de la app, y la app no toca el archivo del equipo.
#
# Este fichero nació el 2026-08-28 afirmando lo contrario —que regenerar
# preservaba lo editado a mano— y se dio vuelta el 2026-08-29 al medir el flujo
# real. Queda la historia porque el error es instructivo:
#
# El experimento regeneraba sobre la MISMA ruta y ahí, en efecto, la edición se
# perdía. Pero el único sitio que genera escribe siempre en una ruta nueva
# (`uuid::UUIDgenerate()` en `router_monitoreo.R`) y el front descarga por
# enlace efímero porque «no hay dónde guardar un Excel operativo dentro del
# proyecto, y sacarlo es justo el punto». **El archivo que el equipo edita vive
# en su disco y la app no lo toca nunca.** Medir sobre un escenario que el
# producto no produce fabrica un defecto que no existe.
#
# Lo que estos tests fijan ahora es el contrato de verdad: generar es EMITIR un
# archivo nuevo, y lo que conserva el trabajo del equipo es el estado de sesión
# que el router arrastra, no el disco.
#
# El riesgo que queda es **divergencia** —dos copias y ninguna que diga cuál
# está al día— y se ataca declarando la procedencia dentro del libro, no
# preservando bytes.

.pe_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1, eligible_n = 30,
       enrolled_total = 34, expected_valid = 20, sample_status = "agendada",
       contact_medium = "Correo", contact_attempts = 2,
       contact_date = "2026-08-18", scheduled_date = "2026-08-20"),
  list(classroom_id = "A-04", operational_code = "CH 4", label = "Aula 104",
       course_name = "Curso 4", teacher = "Docente 4", faculty = "Letras",
       sample_role = "titular", wave = "M1", orden = 4, eligible_n = 25,
       enrolled_total = 28, expected_valid = 18, sample_status = "agendada",
       contact_attempts = 1)
)

test_that("generar en una ruta nueva no toca ninguna otra", {
  # El invariante del flujo real: cada generación es un archivo propio. Si
  # alguien cambia el destino a una ruta estable, este test sigue pasando y hay
  # que decidir de nuevo qué pasa con lo que ya está escrito ahí.
  destino_a <- withr::local_tempfile(fileext = ".xlsx")
  destino_b <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), destino_a)
  antes <- unname(tools::md5sum(destino_a))
  aulas_libro_generar(.pe_plan(), destino_b)
  expect_identical(unname(tools::md5sum(destino_a)), antes)
})

test_that("el libro trae SEIS hojas, no tres", {
  # Las tres operativas, «Plan del día», «Avance de campo» (indicadores; hasta
  # A13a 2026-08-31 se llamó «Cómo va el campo» — Gonzalo: «es AVANCE») y
  # «Listas» (el origen de los desplegables). «Plan del día» entra con la
  # unidad B2.1 (2026-08-31): en 2025 el equipo tecleaba a mano SEIS hojas
  # «aplicación del día N» —el recorte de la fila agenda+campo por fecha— y en
  # 2026 el libro trae UNA hoja que la app genera con ese recorte, ordenado
  # por fecha y hora. Su contrato fino vive en
  # test-carga-aulas-libro-plan-dia.R; aquí solo se pinea que el juego de
  # hojas del libro es este y ninguno más.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  expect_setequal(readxl::excel_sheets(libro),
                  c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control",
                    "Plan del día", "Avance de campo",
                    # 2026-09-09: qué se consiguió agendar, con los reemplazos
                    # dentro. Reemplaza a la «Tabla dinámica 2» que el
                    # coordinador rehacía a mano y que sólo veía el titular.
                    "Avance de agendación",
                    "Listas"))
})

test_that("las fechas se escriben como FECHAS de Excel, no como texto", {
  # Costó un rojo en falso: leer sin `detectDates` devuelve el serial —46280 es
  # 2026-09-15— y parece una pérdida de dato que no hubo. Que sean fechas de
  # verdad es lo que permite ordenar y filtrar en Excel, así que es contrato.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  crudo <- openxlsx::read.xlsx(libro, sheet = "Aulas Agendadas")
  con_fechas <- openxlsx::read.xlsx(libro, sheet = "Aulas Agendadas", detectDates = TRUE)
  col <- grep("FECHA", toupper(names(crudo)))[1]
  expect_false(is.na(col))
  expect_true(inherits(con_fechas[[col]], "Date") || all(is.na(con_fechas[[col]])))
})

test_that("«Aulas Aplicadas (Campo)» lleva su cabecera en la fila 2", {
  # La fila 1 es el título combinado del bloque de intento. Leerla como
  # cabecera da nombres inservibles y hace fallar cualquier búsqueda de columna.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  fila1 <- names(openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)"))
  fila2 <- names(openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)", startRow = 2))
  expect_false(any(grepl("ASISTENTES", toupper(fila1))))
  expect_true(any(grepl("ASISTENTES", toupper(fila2))))
})

test_that("lo que el equipo llenó vuelve por el ESTADO, no por el archivo", {
  # El camino real y el único que conserva el trabajo: se importa el libro
  # lleno, y al regenerar el router arrastra `partes` y `control` de la sesión.
  # Aquí se simula ese arrastre pasándolos como parámetros, que es lo que hace
  # `/api/monitoreo/aulas/generar-libro`.
  # La forma real del parte: `intento` e `observed_students`. Con `attendees`
  # suelto el lector no reconoce la fila y devuelve cero partes, que es como se
  # cae un fixture inventado en vez de copiado del que ya funciona.
  partes <- list(list(operational_code = "CH 1", intento = 1L,
                      observed_students = 23, refusals = 1, duplicates = 0,
                      effective_surveys = 19, applied_by = "Equipo A",
                      application_status = "APLICADA"))
  v1 <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), v1, partes = partes)
  vuelta <- aulas_libro_importar(v1)
  expect_length(vuelta$partes, 1L)
  expect_equal(as.numeric(vuelta$partes[[1]]$observed_students), 23)

  # Y regenerar con ese mismo estado lo mantiene: no hace falta el archivo.
  v2 <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), v2, partes = vuelta$partes)
  otra <- aulas_libro_importar(v2)
  expect_equal(as.numeric(otra$partes[[1]]$observed_students), 23)
})

test_that("un libro nuevo sale entero y se relee", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pe_plan(), libro)
  expect_true(file.exists(libro))
  v <- aulas_libro_importar(libro)
  expect_length(v$plan, 2L)
})
