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

# --- el bloque por sexo: «¿y si cerramos campo aquí y aquí no?» ---------------
#
# Pregunta de Gonzalo (2026-09-14): «debería poder ayudarnos a comparar con esta
# cuenta cómo vamos con el avance de hombres y mujeres por facultad, porque ¿qué
# pasa si en el avance que reportamos cerramos campo y aquí no?». Cerrar una
# facultad que llegó a su cuota contando por el aula, cuando por lo que los
# alumnos declaran sigue corta, es cerrar sobre una cuota que nunca se llenó — y
# ya no hay cómo volver.

.tmcfd_cfg_sexo <- function(...) {
  cfg <- .tmcfd_cfg(...)
  cfg$source_mapping$sex_var <- "sexo"
  cfg$source_mapping$sex_female_values <- list("1")
  cfg$source_mapping$sex_male_values <- list("2")
  cfg
}

.tmcfd_resp_sexo <- function(codigos, facs, sexos) {
  data.frame(collectorID = codigos, fac = facs, sexo = sexos,
             stringsAsFactors = FALSE)
}

.tmcfd_cuotas <- function(...) list(facultades = list(...))

test_that("avisa de la facultad que cerraría por el aula y no por lo declarado", {
  # CH 2 es de Arte y Diseño. Sus tres hombres llenan la meta contando por el
  # aula; uno de ellos declara ser de Arquitectura, así que por lo declarado
  # Arte y Diseño se queda en 2 de 3.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp_sexo(c("CH 2", "CH 2", "CH 2", "CH 1"),
                     c("2", "2", "1", "1"),
                     c("2", "2", "2", "1")),
    .tmcfd_cfg_sexo(),
    cuotas = .tmcfd_cuotas(
      list(facultad = "ARTE Y DISEÑO", cuota_sexo = list(F = 0, M = 3))))
  arte <- Filter(function(f) identical(f$facultad, "ARTE Y DISEÑO"), o$por_sexo)[[1]]
  expect_identical(arte$aula_M, 3L)
  expect_identical(arte$declaradas_M, 2L)
  expect_true(arte$riesgo_M)
  expect_identical(arte$faltan_M, 1L)
})

test_that("no avisa cuando las dos cuentas llegan a la meta", {
  # Mismo tamaño de celda, sin nadie de fuera: cerrar aquí es cerrar de verdad.
  # Sin este caso el aviso podría estar encendido siempre y nadie lo notaría.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp_sexo(c("CH 2", "CH 2"), c("2", "2"), c("2", "2")),
    .tmcfd_cfg_sexo(),
    cuotas = .tmcfd_cuotas(
      list(facultad = "ARTE Y DISEÑO", cuota_sexo = list(F = 0, M = 2))))
  arte <- Filter(function(f) identical(f$facultad, "ARTE Y DISEÑO"), o$por_sexo)[[1]]
  expect_false(arte$riesgo_M)
  expect_identical(arte$faltan_M, 0L)
})

test_that("una facultad que NO llegó a la meta por el aula no dispara el aviso", {
  # El aviso es sobre el cierre, no sobre el desacuerdo: si todavía no cierra
  # por ninguna de las dos cuentas, no hay decisión que advertir. Un aviso en
  # las quince facultades no se lee, se ignora.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp_sexo(c("CH 2", "CH 2"), c("2", "1"), c("2", "2")),
    .tmcfd_cfg_sexo(),
    cuotas = .tmcfd_cuotas(
      list(facultad = "ARTE Y DISEÑO", cuota_sexo = list(F = 0, M = 9))))
  arte <- Filter(function(f) identical(f$facultad, "ARTE Y DISEÑO"), o$por_sexo)[[1]]
  expect_false(arte$riesgo_M)
})

test_that("la meta se empareja con la abreviatura del marco, no sólo con el nombre exacto", {
  # El plan dice «CIENCIAS Y ARTES DE LA COMUN.» y el diseño escribe el nombre
  # entero. Emparejar por texto exacto dejaría esa facultad sin meta y sin aviso
  # para siempre, en silencio.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp_sexo("CH 3", "7", "1"),
    .tmcfd_cfg_sexo(),
    cuotas = .tmcfd_cuotas(list(facultad = "CIENCIAS Y ARTES DE LA COMUNICACIÓN",
                                cuota_sexo = list(F = 1, M = 0))))
  com <- Filter(function(f) grepl("^CIENCIAS Y ARTES", f$facultad), o$por_sexo)[[1]]
  expect_identical(com$meta_F, 1)
  expect_identical(com$aula_F, 1L)
})

test_that("sin sexo declarado no hay bloque por sexo, y sin cuotas no hay meta", {
  # Misma doctrina que el resto del perfil: adivinar qué código es mujer ya
  # costó una lectura al revés en este estudio.
  sin_sexo <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(), .tmcfd_resp_sexo("CH 1", "1", "1"), .tmcfd_cfg())
  expect_identical(length(sin_sexo$por_sexo), 0L)

  sin_cuotas <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(), .tmcfd_resp_sexo("CH 1", "1", "1"), .tmcfd_cfg_sexo())
  expect_true(length(sin_cuotas$por_sexo) > 0L)
  arq <- sin_cuotas$por_sexo[[1]]
  expect_true(is.na(arq$meta_F))
  expect_false(arq$riesgo_F)
})

test_that("la hoja trae el bloque con su cabecera y el aviso escrito", {
  filas <- aulas_libro_filas_control_facultad(
    .tmcfd_plan(),
    .tmcfd_resp_sexo(c("CH 2", "CH 2", "CH 2", "CH 1"),
                     c("2", "2", "1", "1"), c("2", "2", "2", "1")),
    .tmcfd_cfg_sexo(),
    cuotas = .tmcfd_cuotas(
      list(facultad = "ARTE Y DISEÑO", cuota_sexo = list(F = 0, M = 3))))
  primeras <- vapply(filas, function(f) as.character(f$celdas[[1]]), character(1))
  expect_true("SI CERRAMOS POR EL AULA, ¿CERRAMOS DE VERDAD?" %in% primeras)
  cabecera <- Filter(function(f) identical(as.character(f$celdas[[1]]), "FACULTAD") &&
                       length(f$celdas) == 8L, filas)
  expect_identical(length(cabecera), 1L)
  avisos <- unlist(lapply(filas, function(f)
    as.character(f$celdas[[length(f$celdas)]])))
  expect_true(any(grepl("CERRARÍA POR AULA Y NO POR LO DECLARADO", avisos)))
  expect_true(any(grepl("faltarían 1 hombres", avisos)))
})

# --- la matriz de consistencia ------------------------------------------------
#
# Pedido de Gonzalo (2026-09-14): «un seguimiento de quién responde otra
# carrera, en cada facultad a qué carrera responde; creo que es una matriz de
# consistencia de 15x15».

test_that("la matriz es cuadrada, la diagonal son los que coinciden y cada fila suma su total", {
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 1", "CH 2", "CH 3", "CH 4"),
                c("1", "2", "2", "7", "10")),
    .tmcfd_cfg())
  n <- length(o$matriz)
  expect_true(all(vapply(o$matriz, function(f) length(f$celdas), integer(1)) == n))
  # Las dos invariantes que hacen que la matriz sea LA misma medida que el
  # resumen de arriba: sin ellas podría cuadrar por dentro y contradecir al
  # encabezado de la hoja.
  expect_identical(sum(vapply(o$matriz, function(f) f$total, integer(1))),
                   o$comparables)
  expect_identical(sum(vapply(seq_along(o$matriz), function(i)
    o$matriz[[i]]$celdas[[i]], integer(1))), o$coinciden)
})

test_that("filas y columnas van en el MISMO orden, también con la abreviatura", {
  # Si filas y columnas se ordenaran por separado, la diagonal dejaría de ser
  # la coincidencia y nada fallaría: los totales seguirían cuadrando. Este caso
  # lo ancla con la abreviatura del plan («COMUN.») contra el nombre largo del
  # cuestionario, que es donde el emparejamiento tiene su regla propia.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 3", "CH 3", "CH 1"), c("7", "7", "1")),
    .tmcfd_cfg())
  i <- which(vapply(o$matriz, function(f) grepl("^CIENCIAS Y ARTES", f$facultad),
                    logical(1)))
  expect_identical(length(i), 1L)
  expect_identical(o$matriz[[i]]$celdas[[i]], 2L)
  expect_identical(o$matriz[[i]]$coinciden, 2L)
})

test_that("la matriz incluye la facultad que nadie tiene como aula pero alguien declara", {
  # Su fila va en cero y su COLUMNA es la que importa: dice quién está llenando
  # una cuota que no tiene aulas.
  o <- monitoreo_aulas_cruce_facultad_declarada(
    .tmcfd_plan(), .tmcfd_resp(c("CH 4", "CH 4"), c("11", "1")), .tmcfd_cfg())
  i <- which(vapply(o$matriz, function(f)
    identical(f$facultad, "ARQUITECTURA Y URBANISMO"), logical(1)))
  expect_identical(length(i), 1L)
  expect_identical(o$matriz[[i]]$total, 0L)
  columna <- sum(vapply(o$matriz, function(f) f$celdas[[i]], integer(1)))
  expect_identical(columna, 1L)
})

test_that("la hoja dibuja la matriz numerada y con su fila por facultad", {
  filas <- aulas_libro_filas_control_facultad(
    .tmcfd_plan(),
    .tmcfd_resp(c("CH 1", "CH 1", "CH 2"), c("1", "2", "2")),
    .tmcfd_cfg())
  primeras <- vapply(filas, function(f) as.character(f$celdas[[1]]), character(1))
  expect_true("MATRIZ DE CONSISTENCIA" %in% primeras)
  expect_true("AULA \\ DECLARA" %in% primeras)
  # La numeración de las columnas tiene que casar con la de las filas: es lo
  # único que hace legible una matriz sin repetir quince nombres largos arriba.
  cab <- filas[[which(primeras == "AULA \\ DECLARA")[[1]]]]
  n_facs <- sum(grepl("^[0-9]+\\. ", primeras))
  expect_identical(length(cab$celdas), n_facs + 2L)
  expect_identical(as.character(cab$celdas[[2]]), "1")
  expect_true(any(grepl("^1\\. ", primeras)))
})
