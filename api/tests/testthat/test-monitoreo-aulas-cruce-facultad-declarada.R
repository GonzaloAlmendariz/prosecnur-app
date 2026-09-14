# El control de calidad que cruza la facultad del AULA con la que el alumno DECLARA.
#
# Existe porque hasta el 2026-09-14 el avance por facultad se midió SÓLO con la
# facultad del marco y nadie había cruzado eso con lo que responde quien se
# sienta en el aula. Sobre HSVG2026 el cruce dio 80 de 1.390 comparables
# (5,8 %) declarando otra facultad.
#
# Lo que estos tests protegen no es el conteo —eso lo hace la aritmética— sino
# las tres decisiones que costaron dos intentos fallidos: cómo se decide que
# dos nombres son la misma facultad, que el estudio DECLARA su variable en vez
# de que la adivinemos, y que la hoja no se produce cuando no hay con qué.

.tmcfd_cfg <- function(...) {
  list(source_mapping = utils::modifyList(list(
    collector_var = "collectorID",
    faculty_var = "fac",
    faculty_labels = list(
      "1" = "ARQUITECTURA Y URBANISMO",
      "2" = "ARTE Y DISEÑO",
      "7" = "CIENCIAS Y ARTES DE LA COMUNICACIÓN",
      "10" = "ESTUDIOS GENERALES CIENCIAS",
      "11" = "ESTUDIOS GENERALES LETRAS"
    )
  ), list(...)))
}

.tmcfd_plan <- function() list(
  list(operational_code = "CH 1", faculty = "ARQUITECTURA Y URBANISMO"),
  list(operational_code = "CH 2", faculty = "ARTE Y DISEÑO"),
  list(operational_code = "CH 3", faculty = "CIENCIAS Y ARTES DE LA COMUN."),
  list(operational_code = "CH 4", faculty = "ESTUDIOS GENERALES LETRAS")
)

.tmcfd_resp <- function(codigos, facs) {
  data.frame(collectorID = codigos, fac = facs, stringsAsFactors = FALSE)
}

test_that("la abreviatura del marco y el nombre largo del cuestionario son la MISMA facultad", {
  # Éste es el defecto que tuvo la primera versión: comparando el texto entero,
  # «CIENCIAS Y ARTES DE LA COMUN.» no casaba nunca con «…COMUNICACIÓN» y
  # salían 65 falsos desacuerdos, que eran de la comparación y no de los datos.
  expect_true(prosecnurapp:::.mcfd_misma_facultad(
    "CIENCIAS Y ARTES DE LA COMUN.", "CIENCIAS Y ARTES DE LA COMUNICACIÓN"))
  # Y con acentos y minúsculas, que es como llegan de dos sitios distintos.
  expect_true(prosecnurapp:::.mcfd_misma_facultad("Psicología", "PSICOLOGIA"))
})

test_that("dos facultades que empiezan igual NO son la misma", {
  # El segundo intento recortaba a doce letras y fundía las dos Generales en
  # una sola clave: 451 respuestas donde eran 185 y 266. El prefijo mínimo de
  # diez no basta por sí solo; tiene que ser prefijo de la más corta ENTERA.
  expect_false(prosecnurapp:::.mcfd_misma_facultad(
    "ESTUDIOS GENERALES LETRAS", "ESTUDIOS GENERALES CIENCIAS"))
  expect_false(prosecnurapp:::.mcfd_misma_facultad(
    "CIENCIAS CONTABLES", "CIENCIAS SOCIALES"))
  # Un prefijo corto tampoco: «ARTE» no autoriza a fundirse con «ARTES ESCÉNICAS».
  expect_false(prosecnurapp:::.mcfd_misma_facultad("ARTE", "ARTES ESCENICAS"))
  expect_true(is.na(prosecnurapp:::.mcfd_misma_facultad("", "DERECHO")))
})

test_that("el cruce cuenta coincidencias y desacuerdos sobre las comparables", {
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 1", "CH 2", "CH 3", "CH 4"),
                c("1", "2", "2", "7", "10")),
    .tmcfd_cfg())
  expect_true(o$ok)
  expect_identical(o$comparables, 5L)
  # Coinciden: CH 1→1, CH 2→2 y CH 3→7 (la abreviatura). Discrepan: el de
  # Arquitectura que dice Arte y Diseño, y el de Generales Letras que declara
  # Generales Ciencias.
  expect_identical(o$coinciden, 3L)
  expect_identical(o$discrepan, 2L)
})

test_that("una facultad que nadie tiene como aula pero alguien declara sale igual", {
  # Es el punto del control: hoy esa gente no aparece en ninguna fila del
  # avance por facultad, y es justo lo que hay que poder ver.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 4", "CH 4"), c("11", "1")),
    .tmcfd_cfg())
  filas <- vapply(o$por_facultad, function(f) f$facultad, character(1))
  expect_true("ARQUITECTURA Y URBANISMO" %in% filas)
  arq <- Filter(function(f) identical(f$facultad, "ARQUITECTURA Y URBANISMO"),
                o$por_facultad)[[1]]
  expect_identical(arq$respuestas, 0L)
  expect_identical(arq$declaradas, 1L)
})

test_that("sin variable de facultad declarada no hay cruce y no hay hoja", {
  # El estudio declara cuál de sus preguntas es la facultad, igual que con el
  # sexo. Adivinarla sería inventar el dato que el control existe para vigilar.
  cfg <- .tmcfd_cfg(faculty_var = "")
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(), .tmcfd_resp("CH 1", "1"), cfg)
  expect_false(o$ok)
  expect_identical(o$comparables, 0L)
  expect_null(aulas_libro_filas_control_facultad(
    .tmcfd_plan(), .tmcfd_resp("CH 1", "1"), cfg))
  # Y declarada pero ausente de la base: tampoco inventa.
  expect_false(monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(), .tmcfd_resp("CH 1", "1"),
    .tmcfd_cfg(faculty_var = "no_existe"))$ok)
})

test_that("la respuesta cuyo collectorID no es un aula del plan no es comparable", {
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 99"), c("1", "1")),
    .tmcfd_cfg())
  expect_identical(o$comparables, 1L)
  expect_identical(o$sin_aula, 1L)
})

test_that("la hoja trae sus dos bloques, su TOTAL y filas tipadas", {
  filas <- aulas_libro_filas_control_facultad(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 1", "CH 2"), c("1", "2", "2")),
    .tmcfd_cfg())
  expect_true(length(filas) > 0L)
  # Contrato de filas tipadas, el mismo que sus tres hermanas del libro.
  expect_true(all(vapply(filas, function(f)
    is.list(f) && all(c("tipo", "celdas") %in% names(f)), logical(1))))
  primeras <- vapply(filas, function(f) as.character(f$celdas[[1]]), character(1))
  expect_true("CONTROL DE FACULTAD" %in% primeras)
  expect_true("FACULTAD POR FACULTAD" %in% primeras)
  expect_true("DÓNDE SE CRUZAN" %in% primeras)
  expect_true("TOTAL" %in% primeras)
  total <- filas[[which(primeras == "TOTAL")[[1]]]]
  # El TOTAL cuadra con el cruce: 3 comparables, 2 coinciden, 1 discrepa.
  expect_identical(as.character(total$celdas[[2]]), "3")
  expect_identical(as.character(total$celdas[[4]]), "1")
})

test_that("el formato marca el título, los bloques, las cabeceras y el TOTAL", {
  filas <- aulas_libro_valores_control_facultad(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 2"), c("1", "1")),
    .tmcfd_cfg())
  reqs <- aulas_libro_control_facultad_formato_requests("hoja", filas)
  expect_true(length(reqs) > 0L)
  # Un formato mudo —cero requests con filas de sobra— es el modo en que esta
  # hoja se degradaría sin fallar: se publicaría en blanco y negro y nadie lo
  # vería. El guard es que haya al menos una banda por cada rótulo de bloque.
  expect_gte(length(reqs), 4L)
})

test_that("la pestaña está en la lista blanca de publicación", {
  # Sin esto la publicación ENTERA falla, no sólo esta hoja: pasó con
  # «Producción de aplicadores» el 2026-09-13.
  expect_true("Control de facultad" %in% monitoreo_sheets_pestanas_controladas())
})

test_that("si ningún lado casa con el otro, no hay hoja: es la traducción, no el campo", {
  # Se vio generando el .xlsx de verdad, no mirando el motor. Un estudio que
  # declara la variable pero no el catálogo trae el código crudo («7») y la
  # hoja salía perfectamente formada diciendo «1.390 respuestas · 100,0 % DE
  # OTRA FACULTAD». Eso se lee como una catástrofe de campo y es una columna
  # sin traducir.
  cfg <- .tmcfd_cfg(faculty_labels = NULL)
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 2", "CH 3", "CH 4"), c("1", "2", "7", "11")),
    cfg)
  expect_false(o$ok)
  expect_identical(o$comparables, 0L)
  # Y el motivo lo dice, porque un vacío mudo manda a buscar el error en los
  # datos cuando está en el mapping.
  expect_match(o$motivo, "faculty_labels")
  expect_null(aulas_libro_filas_control_facultad(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 2"), c("1", "2")), cfg))
})

test_that("una sola coincidencia basta: el guard no se traga un operativo real", {
  # El guard tiene que distinguir «no se tocan los vocabularios» de «casi todos
  # declaran otra cosa», que es un hallazgo legítimo y debe verse.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 2", "CH 2", "CH 2"), c("1", "1", "1", "1")),
    .tmcfd_cfg())
  expect_true(o$ok)
  expect_identical(o$coinciden, 1L)
  expect_identical(o$discrepan, 3L)
})

test_that("las dos claves del cruce SOBREVIVEN al normalizador de la config", {
  # La whitelist de `monitoreo_aulas_normalize_config()` es la que decide qué
  # persiste: lo que no nombra se cae en silencio al guardar. Le pasó a
  # `collector_var` y a `sex_var` el 2026-09-08 —una pulsación de «actualizar»
  # los dejó en "" y la pestaña de Avance entera en cero sobre 212 efectivas—.
  # Sin este test, declarar la facultad en la UI no llegaría nunca al libro.
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    faculty_var = "datos_demo/P7",
    faculty_labels = list("7" = "CIENCIAS Y ARTES DE LA COMUNICACIÓN")
  )))
  expect_identical(cfg$source_mapping$faculty_var, "datos_demo/P7")
  expect_identical(cfg$source_mapping$faculty_labels[["7"]],
                   "CIENCIAS Y ARTES DE LA COMUNICACIÓN")

  # Y un body que NO las trae conserva lo que ya estaba guardado, en vez de
  # borrarlo: es la misma regla de `previous` que salvó al colector.
  otra <- monitoreo_aulas_normalize_config(list(), previous = cfg)
  expect_identical(otra$source_mapping$faculty_var, "datos_demo/P7")
  expect_identical(otra$source_mapping$faculty_labels[["7"]],
                   "CIENCIAS Y ARTES DE LA COMUNICACIÓN")

  # Un código sin nombre no traduce nada y no se guarda como si lo hiciera.
  sucio <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    faculty_var = "P7",
    faculty_labels = stats::setNames(list("", "DERECHO"), c("7", "")))))
  expect_identical(length(sucio$source_mapping$faculty_labels), 0L)
})
