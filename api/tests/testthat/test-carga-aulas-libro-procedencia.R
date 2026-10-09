# El libro dice de qué lectura salió, dentro del propio libro.
#
# El riesgo de la sinergia app ↔ Excel no es que la app destruya el archivo del
# equipo —no lo toca: emite uno nuevo cada vez— sino la DIVERGENCIA: alguien
# edita su copia, otro genera sin haberla subido, y quedan dos libros sin nada
# que diga cuál está al día.
#
# El dato ya existía sin consumidor dentro del libro: el recibo
# `monitoreo_aulas_libro` que compone `aulas_libro_importar_en_sesion()` y que
# hasta ahora sólo veía la UI.
#
# La cadena tiene tres eslabones —recibo en sesión, parámetro del generador,
# celda del Excel— y este repo ya perdió un dato en cada uno de ellos alguna
# vez, así que se prueba el extremo: que la marca LLEGUE AL ARCHIVO.

.pr_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1, eligible_n = 30,
       enrolled_total = 34, expected_valid = 20, sample_status = "agendada")
)

.pr_recibo <- function() list(
  importado_en = "2026-08-29T11:22:33Z",
  resumen = list(unidades = 174, titulares = 174, reservas = 0,
                 contactadas = 12, partes_de_campo = 7, filas_de_control = 5)
)

# La hoja no es una tabla: son etiquetas y valores sueltos. Se lee entera y se
# busca el texto, que es como lo vería una persona.
.pr_hoja <- function(path) {
  # A13a (2026-08-31): la hoja era «Cómo va el campo»; Gonzalo: «es AVANCE».
  d <- openxlsx::read.xlsx(path, sheet = "Avance de campo", colNames = FALSE)
  as.character(unlist(d, use.names = FALSE))
}

test_that("la marca del último import llega hasta la celda del Excel", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), libro, procedencia = .pr_recibo())
  celdas <- .pr_hoja(libro)
  expect_true(any(grepl("De dónde salió este libro", celdas, fixed = TRUE)))
  # Contrato viejo (hasta el 2026-09-07): la celda llevaba el ISO UTC tal cual,
  # «2026-08-29T11:22:33Z». Contrato nuevo (S10 del loop de mejora estética):
  # la MISMA marca, en hora local legible «dd/mm/aaaa hh:mm» (el huso es el del
  # equipo que genera, por eso aquí se comprueba la forma y no la hora). La
  # reproducibilidad la sigue vigilando el test de abajo: la marca sale del
  # estado, no del reloj.
  marca <- grep("^[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}$", celdas, value = TRUE)
  expect_length(marca, 1L)
  expect_identical(.cai_marca_local("2026-08-29T11:22:33Z", tz = "America/Lima"), "29/08/2026 06:22")
  expect_false(any(grepl("2026-08-29T11:22:33Z", celdas, fixed = TRUE)))
})

test_that("viajan los conteos de esa lectura, no sólo la fecha", {
  # Una fecha sola no distingue dos copias del mismo día. Los conteos sí.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), libro, procedencia = .pr_recibo())
  celdas <- .pr_hoja(libro)
  expect_true(any(celdas == "174"))
  expect_true(any(celdas == "7"))
  expect_true(any(celdas == "5"))
})

test_that("el libro dice qué hacer con esa fecha, no sólo cuál es", {
  # Cuatro cifras sin una frase son cuatro cifras que nadie sabe para qué mirar.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), libro, procedencia = .pr_recibo())
  expect_true(any(grepl("no lo subiste", .pr_hoja(libro), fixed = TRUE)))
})

test_that("sin haber leído nunca un libro, lo DICE en vez de callar", {
  # El vacío se declara: una sección ausente se leería como «no aplica» cuando
  # lo que pasa es que la app nunca vio un libro lleno.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), libro,
                     procedencia = list(importado_en = "", resumen = list()))
  celdas <- .pr_hoja(libro)
  expect_true(any(grepl("Ninguna: sale sólo del plan", celdas, fixed = TRUE)))
  # Y los conteos que no hay salen como raya, nunca como cero: un 0 diría que
  # la lectura trajo cero aulas.
  expect_true(any(celdas == "—"))
})

test_that("sin procedencia el libro sale igual que siempre", {
  # Aditivo: un llamador que no la pase —un script, un test viejo— no puede
  # romperse ni ganar una sección vacía.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), libro)
  expect_false(any(grepl("De dónde salió este libro", .pr_hoja(libro), fixed = TRUE)))
})

test_that("la procedencia NO vuelve el libro irreproducible", {
  # `importado_en` sale del ESTADO, no del reloj: dos generaciones del mismo
  # estado tienen que dar el mismo contenido. Si alguien la sustituye por
  # `Sys.time()`, este test lo caza.
  a <- withr::local_tempfile(fileext = ".xlsx")
  b <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.pr_plan(), a, procedencia = .pr_recibo())
  aulas_libro_generar(.pr_plan(), b, procedencia = .pr_recibo())
  expect_identical(.pr_hoja(a), .pr_hoja(b))
})

test_that("EL ROUTER la pasa: la cadena no se corta en el último eslabón", {
  # Los tests de arriba llaman al generador directo, así que pasarían aunque el
  # endpoint no mandara nada — y entonces el libro real saldría sin procedencia.
  # Es el patrón que este repo ya pagó varias veces: la capacidad existe, está
  # testeada, y nadie la consume.
  #
  # Se comprueba sobre la fuente porque el endpoint necesita sesión, sid y
  # ficheros: montar todo eso mediría el arnés, no el cableado.
  fuente <- readLines(testthat::test_path("..", "..", "R", "router_monitoreo.R"),
                      warn = FALSE)
  llamada <- grep("aulas_libro_generar\\(", fuente)
  expect_length(llamada, 1L)
  # La llamada se abre en una línea y sigue en las siguientes: se mira el bloque.
  bloque <- paste(fuente[llamada:(llamada + 8L)], collapse = " ")
  expect_match(bloque, "procedencia\\s*=\\s*s\\$monitoreo_aulas_libro")
})
