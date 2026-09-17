# =============================================================================
# El padrón que traduce un código de alumno a su nivel
# =============================================================================
#
# El nivel de una respuesta no está en la respuesta: está en la persona. Y no
# sobrevive por ninguna de las dos puertas por las que podría llegar —el marco
# lo colapsa a la moda del aula, el `.pulso` subroga los códigos sin guardar el
# mapa (F114)—. Así que se carga aparte.
#
# Lo que estas pruebas fijan no es el parseo: es que **la columna del nivel se
# exija y no se adivine**. El mapeo del motor acepta nueve alias para el rol
# `level` y toma el primero. Con la base de la DTI, que trae dos, eso convierte
# una decisión metodológica en una carrera de alias — y las dos columnas
# coinciden en 11 de 1.354 casos.

.tp_dir <- function() {
  d <- file.path(tempdir(), paste0("padron-", as.integer(runif(1, 1, 1e9))))
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
  d
}

# Escribe un .xlsx con las hojas dadas (lista nombre -> data.frame).
.tp_xlsx <- function(hojas) {
  path <- file.path(.tp_dir(), "matriculados.xlsx")
  wb <- openxlsx::createWorkbook()
  for (n in names(hojas)) {
    openxlsx::addWorksheet(wb, n)
    openxlsx::writeData(wb, n, hojas[[n]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

# La forma de la base real: una fila por alumno × curso-horario, así que el
# mismo código aparece tantas veces como cursos lleve.
.tp_base <- function() {
  data.frame(
    ALUMNO = c("20191234", "20191234", "20205678", "20213333", "20224444"),
    NOMBRES = c("A", "A", "B", "C", "D"),
    CARRERA = c("ECONOMÍA", "ECONOMÍA", "SOCIOLOGÍA", "ANTROPOLOGÍA", "FINANZAS"),
    SEXO = c("F", "F", "M", "F", "M"),
    NIVEL_CREDITOS = c(3L, 3L, 5L, 2L, 6L),
    NIVEL_CURRICULAR = c(7L, 7L, 9L, 6L, 10L),
    COD_CURSO = c("ECO101", "ECO205", "SOC110", "ANT200", "FIN301"),
    stringsAsFactors = FALSE
  )
}

test_that("deriva codigo, nivel, carrera y sexo, una fila por persona", {
  p <- carga_aulas_padron(.tp_xlsx(list(Data = .tp_base())))
  expect_identical(p$schema, "monitoreo_aulas_padron_v1")
  # Cinco filas de matricula, cuatro personas: el codigo repetido es una
  # matricula mas, no una persona mas.
  expect_length(p$filas, 4L)
  expect_identical(p$columnas$nivel, "NIVEL_CURRICULAR")

  uno <- Filter(function(f) identical(f$codigo, "20191234"), p$filas)[[1]]
  expect_identical(uno$nivel, 7L)
  expect_identical(uno$carrera, "ECONOMÍA")
  expect_identical(uno$sexo, "F")
})

test_that("el codigo repetido avisa, no se traga en silencio", {
  p <- carga_aulas_padron(.tp_xlsx(list(Data = .tp_base())))
  expect_match(paste(attr(p, "avisos"), collapse = " | "), "codigo repetido")
})

test_that("toma el nivel CURRICULAR aunque la base traiga tambien el de creditos", {
  # El aserto central de esta suite. Las dos columnas conviven en la base real y
  # el alias del motor tomaria la primera que encuentre; aqui se exige la
  # curricular por nombre. Si alguien invirtiera el orden de `.CAP_ROLES$nivel`,
  # este test lo dice antes de que un estudio mida 377 personas en vez de 822.
  p <- carga_aulas_padron(.tp_xlsx(list(Data = .tp_base())))
  niveles <- sort(vapply(p$filas, function(f) f$nivel, integer(1)))
  expect_identical(niveles, c(6L, 7L, 9L, 10L))   # curricular
  expect_false(identical(niveles, c(2L, 3L, 5L, 6L)))  # creditos
})

test_that("con solo el nivel de creditos falla diciendo que pida otra extraccion", {
  base <- .tp_base(); base$NIVEL_CURRICULAR <- NULL
  # No es «falta el nivel»: es «tienes el otro nivel». Son dos arreglos
  # distintos —pedirle otra extraccion a la DTI vs revisar el archivo— y por eso
  # son dos codigos de error distintos.
  expect_error(
    carga_aulas_padron(.tp_xlsx(list(Data = base))),
    class = "api_error"
  )
  err <- tryCatch(carga_aulas_padron(.tp_xlsx(list(Data = base))),
                  error = function(e) e)
  expect_identical(err$code, "E_AULAS_PADRON_NIVEL_AUSENTE")
  expect_match(conditionMessage(err), "NIVEL_CURRICULAR")
})

test_that("busca la hoja que trae las columnas, no la primera", {
  # La base de la DTI viaja con hojas hermanas; leer la primera a ciegas
  # devolvia el SQL original como si fuera data.
  hojas <- list(
    `SQL original` = data.frame(x = c("SELECT", "ax.alumno"), stringsAsFactors = FALSE),
    Trazabilidad = data.frame(nota = "armado el 07/09", stringsAsFactors = FALSE),
    Data = .tp_base()
  )
  p <- carga_aulas_padron(.tp_xlsx(hojas))
  expect_identical(p$hoja, "Data")
  expect_length(p$filas, 4L)
})

test_that("una fila sin codigo se salta con aviso, y un nivel ilegible no se imputa", {
  base <- .tp_base()
  base$ALUMNO[2] <- ""
  base$NIVEL_CURRICULAR <- c("7", "7", "noveno", "6", "10")
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)))
  avisos <- paste(attr(p, "avisos"), collapse = " | ")
  expect_match(avisos, "sin codigo")
  expect_match(avisos, "nivel no numerico")
  # El nivel ilegible queda NA: no se adivina «noveno» -> 9. Una cifra
  # inventada es peor que ninguna, y esa persona no acredita celda.
  sos <- Filter(function(f) identical(f$codigo, "20205678"), p$filas)[[1]]
  expect_true(is.na(sos$nivel))
})

test_that("sin carrera o sin sexo carga igual, y lo dice", {
  base <- .tp_base(); base$CARRERA <- NULL; base$SEXO <- NULL
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)))
  expect_length(p$filas, 4L)
  avisos <- paste(attr(p, "avisos"), collapse = " | ")
  expect_match(avisos, "carrera")
  expect_match(avisos, "sexo")
  # El padron sigue sirviendo para su funcion —traducir a nivel—; lo que queda
  # sin dato es el panel referencial, y se declara.
  expect_identical(p$columnas$carrera, "")
})

test_that("el archivo que no existe y el que no trae columnas fallan distinto", {
  e1 <- tryCatch(carga_aulas_padron("/no/existe.xlsx"), error = function(e) e)
  expect_identical(e1$code, "E_AULAS_PADRON_NO_EXISTE")
  e2 <- tryCatch(
    carga_aulas_padron(.tp_xlsx(list(Hoja = data.frame(a = 1, b = 2)))),
    error = function(e) e)
  expect_identical(e2$code, "E_AULAS_PADRON_SIN_COLUMNAS")
})

test_that("el codigo se normaliza igual a los dos lados del cruce", {
  # El padron guarda «20191234» y la respuesta puede traer « 20191234 » o
  # «2019-1234». Si las dos puntas no normalizan con la MISMA funcion, el cruce
  # falla y la respuesta cae a la bolsa «sin nivel» por un espacio.
  expect_identical(monitoreo_aulas_codigo_key(c(" 20191234 ", "2019-1234", "a1b2")),
                   c("20191234", "20191234", "A1B2"))
  expect_identical(monitoreo_aulas_codigo_key(c(NA, "")), c("", ""))
})

test_that("sin filtro carga, pero avisa fuerte de que no es la poblacion del estudio", {
  # Medido el 2026-09-17 sobre la extraccion 212139: sin filtro el lector
  # devuelve 22.746 personas de todo pregrado, no las 783 del estudio. Y como
  # «resuelve en el padron» significa «es poblacion», eso acreditaria celdas de
  # gente que no lo es.
  p <- carga_aulas_padron(.tp_xlsx(list(Data = .tp_base())))
  expect_match(paste(attr(p, "avisos"), collapse = " | "), "SIN filtro")
  expect_false(p$filtro$declarado)
})

test_that("el filtro recorta a la poblacion declarada y lo dice", {
  base <- .tp_base()
  base$FACULTAD <- c(rep("CIENCIAS SOCIALES", 4), "ARQUITECTURA")
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)),
                          filtro = list(facultades = "CIENCIAS SOCIALES",
                                        niveles = 6:9))
  # De las cuatro personas queda una fuera: la de Arquitectura, que ademas es
  # la de nivel 10 —los dos criterios la excluyen, y por eso quedan tres y no
  # dos—. Sobreviven niveles 6, 7 y 9.
  expect_length(p$filas, 3L)
  expect_true(all(vapply(p$filas, function(f) f$nivel %in% 6:9, logical(1))))
  expect_true(p$filtro$declarado)
  expect_match(paste(attr(p, "avisos"), collapse = " | "), "Filtro de poblacion aplicado")
})

test_that("el filtro tolera como este escrito el valor, pero no adivina", {
  base <- .tp_base()
  base$FACULTAD <- rep("Ciencias Sociales", 5)
  # Mayusculas, tildes y espacios no deberian decidir si el filtro funciona.
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)),
                          filtro = list(facultades = "CIENCIAS SOCIALES"))
  expect_length(p$filas, 4L)
})

test_that("un filtro sin ninguna coincidencia falla, no devuelve un padron vacio", {
  base <- .tp_base()
  base$FACULTAD <- rep("CIENCIAS SOCIALES", 5)
  # Cero coincidencias casi nunca es «esta poblacion no existe»: es que se esta
  # comparando un codigo contra un nombre. Devolver un padron vacio dejaria el
  # tablero midiendo cero sin explicar por que.
  err <- tryCatch(
    carga_aulas_padron(.tp_xlsx(list(Data = base)),
                       filtro = list(facultades = "18")),
    error = function(e) e)
  expect_identical(err$code, "E_AULAS_PADRON_FILTRO_SIN_COINCIDENCIAS")
  expect_match(conditionMessage(err), "FACULTAD")
})

test_that("la edad ilegible no se asume mayor de edad", {
  base <- .tp_base()
  base$EDAD <- c(21, 22, NA, "s/d", 25)
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)),
                          filtro = list(edad_minima = 18))
  # Quedan solo los dos legibles y mayores (el primero esta duplicado).
  codigos <- vapply(p$filas, function(f) f$codigo, character(1))
  expect_true("20191234" %in% codigos)
  expect_false("20213333" %in% codigos)  # edad "s/d"
  expect_false("20205678" %in% codigos)  # edad NA
})

test_that("el filtro con el que se derivo viaja con el padron", {
  base <- .tp_base(); base$FACULTAD <- rep("CIENCIAS SOCIALES", 5)
  p <- carga_aulas_padron(.tp_xlsx(list(Data = base)),
                          filtro = list(facultades = "CIENCIAS SOCIALES", niveles = 6:9))
  # Sin esto no se puede decir de que poblacion es la tabla, y el diagnostico
  # de coherencia no sabria como redactar su aviso.
  expect_identical(unlist(p$filtro$facultades), "CIENCIAS SOCIALES")
  expect_identical(sort(unlist(p$filtro$niveles)), 6:9)
})

test_that("el resumen publica conteos y ni un codigo", {
  p <- carga_aulas_padron(.tp_xlsx(list(Data = .tp_base())))
  r <- monitoreo_aulas_padron_resumen(p)
  expect_identical(r$personas, 4L)
  expect_identical(r$por_nivel[["7"]], 1L)
  expect_identical(r$por_carrera[["ECONOMÍA"]], 1L)
  # Lo que hace publicable el resumen: ningun codigo aparece en el, ni como
  # clave ni como valor. Es lo que queda cuando el padron se purga.
  plano <- paste(unlist(r, use.names = TRUE), names(unlist(r)), collapse = " ")
  for (cod in vapply(p$filas, function(f) f$codigo, character(1))) {
    expect_false(grepl(cod, plano, fixed = TRUE))
  }
})

test_that("el resumen de un padron vacio o ausente no inventa nada", {
  r <- monitoreo_aulas_padron_resumen(list())
  expect_identical(r$personas, 0L)
  expect_identical(r$por_nivel, list())
  expect_identical(monitoreo_aulas_padron_resumen(NULL)$personas, 0L)
})

# =============================================================================
# El filtro de población: por CARRERA, y sin tragarse una clave que no conoce
# =============================================================================
#
# Gonzalo, 2026-09-17, sobre la base de la DTI: «aquí en vez de facultad debe ser
# carrera, para este estudio donde la carrera es el estrato, no la facultad».
# Filtrar por facultad en CCSS Perfil 2026-II no acota nada —toda la población es
# Ciencias Sociales— y la agrupación que significa algo es la de sus seis
# carreras.
#
# Y la otra mitad sale de un error mío del mismo día: llamé a la función con
# `list(columna = ..., valores = ...)`, que no son claves de este filtro. **No
# pasó nada**: el filtro no se aplicó, el padrón cargó 25.403 personas de toda la
# universidad, y el aviso decía «sin filtro» — cierto, y no el que hacía falta.
# Un padrón de la universidad entera traduce códigos de gente que no es del
# estudio, así que la clave desconocida se grita.

.tcp_hoja_carreras <- function() data.frame(
  `CODIGO PUCP` = c("20190001", "20190002", "20190003", "20190004"),
  FACULTAD = rep("CIENCIAS SOCIALES", 4),
  CARRERA = c("ECONOMÍA", "ECONOMÍA", "SOCIOLOGÍA", "ANTROPOLOGÍA"),
  NIVEL_CURRICULAR = c(7L, 10L, 8L, 6L),
  SEXO = c("F", "M", "F", "M"),
  check.names = FALSE, stringsAsFactors = FALSE
)

.tcp_escribir <- function(df) {
  f <- file.path(tempdir(), sprintf("padron-%d.xlsx", as.integer(runif(1, 1, 1e9))))
  openxlsx::write.xlsx(df, f)
  f
}

test_that("el filtro por CARRERA acota donde el de facultad no acotaría nada", {
  skip_if_not_installed("openxlsx")
  f <- .tcp_escribir(.tcp_hoja_carreras())
  on.exit(unlink(f), add = TRUE)
  # Por facultad: las cuatro, porque todas son de la misma. No acota.
  todas <- carga_aulas_padron(f, filtro = list(facultades = "CIENCIAS SOCIALES"))
  expect_identical(length(todas$filas), 4L)
  # Por carrera: sólo las dos de Economía. Eso es el estrato.
  eco <- carga_aulas_padron(f, filtro = list(carreras = "ECONOMÍA"))
  expect_identical(length(eco$filas), 2L)
  expect_true(all(vapply(eco$filas, function(r) identical(r$carrera, "ECONOMÍA"), logical(1))))
  # Y se combina con el de niveles, que es el otro recorte de la población.
  eco69 <- carga_aulas_padron(f, filtro = list(carreras = "ECONOMÍA", niveles = 6:9))
  expect_identical(length(eco69$filas), 1L)
  expect_identical(eco69$filas[[1]]$nivel, 7L)
})

test_that("una carrera que no existe se dice, no se devuelve vacío", {
  skip_if_not_installed("openxlsx")
  f <- .tcp_escribir(.tcp_hoja_carreras())
  on.exit(unlink(f), add = TRUE)
  # Cero coincidencias casi nunca es «esta población no existe»: es que se está
  # comparando un código contra un nombre.
  expect_error(
    carga_aulas_padron(f, filtro = list(carreras = "INGENIERÍA INDUSTRIAL")),
    "E_AULAS_PADRON_FILTRO_SIN_COINCIDENCIAS|Ninguna fila calza")
})

test_that("una clave que el filtro no conoce se RECHAZA", {
  skip_if_not_installed("openxlsx")
  f <- .tcp_escribir(.tcp_hoja_carreras())
  on.exit(unlink(f), add = TRUE)
  # El error concreto del 17/09, con su forma exacta.
  expect_error(
    carga_aulas_padron(f, filtro = list(columna = "FACULTAD", valores = "CIENCIAS SOCIALES")),
    "E_AULAS_PADRON_FILTRO_CLAVE|no conoce")
  # Y las cinco que sí conoce no se rechazan.
  expect_silent(invisible(carga_aulas_padron(f, filtro = list(
    facultades = "CIENCIAS SOCIALES", carreras = "ECONOMÍA", niveles = 7,
    condiciones = character(0), edad_minima = NA_integer_))))
})

test_that("el aviso del filtro declarado cuenta también la carrera", {
  skip_if_not_installed("openxlsx")
  f <- .tcp_escribir(.tcp_hoja_carreras())
  on.exit(unlink(f), add = TRUE)
  # Sin esto, un filtro SÓLO por carrera caía en la rama del «sin filtro» y
  # publicaba el aviso fuerte de un padrón sin acotar — diciendo lo contrario de
  # lo que pasaba.
  out <- carga_aulas_padron(f, filtro = list(carreras = "ECONOMÍA"))
  # Los avisos viajan como ATRIBUTO, no como campo: leerlos con `$avisos` da
  # `NULL` y el test pasaría con cualquier aviso, o sin ninguno.
  avisos <- paste(attr(out, "avisos") %||% character(0), collapse = " ")
  expect_true(grepl("Filtro de poblacion aplicado", avisos, fixed = TRUE))
  expect_false(grepl("sin filtro", avisos, fixed = TRUE))
})
