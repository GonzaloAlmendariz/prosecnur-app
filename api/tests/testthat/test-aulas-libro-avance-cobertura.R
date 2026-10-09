# =============================================================================
# El bloque «Cobertura»: el motor ya lo calculaba y nadie lo pintaba
# =============================================================================
#
# `.monitoreo_aulas_avance_cuota()` publica `composicion` desde el 2026-09-17
# —población del marco contra lo alcanzado, por cada dimensión descriptiva que
# el estudio declare— y ninguna de las tres superficies del libro lo enseñaba.
# Un motor sin consumidor no es una capacidad.
#
# Para CCSS es hoy la tabla más accionable: ECONOMÍA es el 44,8 % de la
# población y el 74,3 % de lo recogido, y tres carreras van en cero.

.laco_composicion <- function() list(
  schema = MONITOREO_AULAS_COMPOSICION_SCHEMA,
  caracter = "referencial",
  nota = "Sexo y carrera son referenciales: no se miden aquí.",
  fuente = "padron",
  personas = 109L,
  dimensiones = list(
    sexo = list(
      dimension = "sexo", etiqueta = "Sexo",
      poblacion_total = 800L, obtenidas_total = 109L,
      filas = list(
        list(categoria = "F", poblacion = 421L, poblacion_pct = 52.6,
             obtenidas = 58L, obtenidas_pct = 53.2),
        list(categoria = "M", poblacion = 379L, poblacion_pct = 47.4,
             obtenidas = 51L, obtenidas_pct = 46.8))),
    carrera = list(
      dimension = "carrera", etiqueta = "Carrera",
      poblacion_total = 800L, obtenidas_total = 109L,
      filas = list(
        list(categoria = "ECONOMÍA", poblacion = 358L, poblacion_pct = 44.8,
             obtenidas = 81L, obtenidas_pct = 74.3),
        list(categoria = "CIENCIA POLÍTICA Y GOBIERNO", poblacion = 131L,
             poblacion_pct = 16.4, obtenidas = 0L, obtenidas_pct = 0)))
  )
)

test_that("una tabla por dimensión, en el orden en que vienen", {
  cob <- aulas_libro_cobertura(.laco_composicion())
  expect_length(cob, 2L)
  expect_identical(vapply(cob, function(c) c$clave, character(1)), c("sexo", "carrera"))
  expect_identical(vapply(cob, function(c) c$titulo, character(1)),
                   c("Cobertura por sexo", "Cobertura por carrera"))
  for (c in cob) expect_identical(names(c$tabla), AULAS_COBERTURA_CABECERAS)
})

test_that("las cifras son las del motor, y los porcentajes viajan 0–1", {
  # El porcentaje es FORMATO DE CELDA en toda esta hoja, nunca texto con «%»:
  # `composicion` los emite 0–100 porque su consumidor natural es la pantalla.
  t <- aulas_libro_cobertura(.laco_composicion())[[2]]$tabla
  eco <- t[t[["Categoría"]] == "ECONOMÍA", , drop = FALSE]
  expect_identical(as.numeric(eco[["Población"]]), 358)
  expect_identical(as.numeric(eco[["Alcanzadas"]]), 81)
  expect_equal(as.numeric(eco[["% de la población"]]), 0.448)
  expect_equal(as.numeric(eco[["% de lo alcanzado"]]), 0.743)
  # Un cero MEDIDO sigue siendo cero: tres carreras en cero es justo lo que este
  # bloque existe para enseñar.
  cpg <- t[t[["Categoría"]] == "CIENCIA POLÍTICA Y GOBIERNO", , drop = FALSE]
  expect_identical(as.numeric(cpg[["Alcanzadas"]]), 0)
  expect_equal(as.numeric(cpg[["% de lo alcanzado"]]), 0)
})

test_that("no lleva muestra, faltantes ni avance: no hay cuota que exigir", {
  # `composicion` se declara a sí misma `caracter = "referencial"`. Una columna
  # de faltantes aquí inventaría un umbral que el estudio negó, y el operativo
  # gastaría llamadas persiguiendo una cuota que no existe.
  cols <- AULAS_COBERTURA_CABECERAS
  for (prohibida in c("Muestra", "Faltantes", "Avance", "Sobremuestra")) {
    expect_false(any(grepl(prohibida, cols, fixed = TRUE)), info = prohibida)
  }
})

test_that("sin dimensiones o sin filas el bloque NO se escribe", {
  # Una tabla de ceros se leería como «no alcanzamos a nadie», que es una
  # afirmación; la ausencia del bloque es el silencio correcto.
  expect_length(aulas_libro_cobertura(NULL), 0L)
  expect_length(aulas_libro_cobertura(list(dimensiones = list())), 0L)
  vacia <- .laco_composicion()
  vacia$dimensiones <- list(sexo = list(dimension = "sexo", etiqueta = "Sexo", filas = list()))
  expect_length(aulas_libro_cobertura(vacia), 0L)
})

test_that("la nota del motor NO se pinta", {
  # Las notas didácticas se retiraron de este libro el 2026-09-22. `composicion`
  # trae una y no cruza a la hoja: lo que la tabla necesita decir lo dice su
  # título.
  cob <- aulas_libro_cobertura(.laco_composicion())
  textos <- unlist(lapply(cob, function(c) c(c$titulo, as.character(c$tabla[[1]]))))
  expect_false(any(grepl("referenciales", textos, fixed = TRUE)))
})

# --- El vocabulario lo reconoce ---------------------------------------------

test_that("el vocabulario reconoce el bloque, o saldría sin formato y sin banda", {
  # Los dos renderers y el formateador de Sheets deciden el numFmt por RÓTULO y
  # la banda por TÍTULO. Sin registrar las dos cosas, el bloque sale publicado
  # con «0.448» donde debería decir «44,8 %» y sin una sola banda, en silencio.
  expect_identical(prosecnurapp:::.calac_tabla_de_cabecera(AULAS_COBERTURA_CABECERAS),
                   AULAS_COBERTURA_CLAVE)
  expect_true(prosecnurapp:::.calac_es_proporcion("% de la población", AULAS_COBERTURA_CLAVE))
  expect_true(prosecnurapp:::.calac_es_proporcion("% de lo alcanzado", AULAS_COBERTURA_CLAVE))
  expect_false(prosecnurapp:::.calac_es_proporcion("Población", AULAS_COBERTURA_CLAVE))
  titulos <- prosecnurapp:::.maaf_titulos_bloque()
  for (t in c("Cobertura por sexo", "Cobertura por carrera")) {
    expect_true(t %in% titulos, info = t)
  }
  # Y los títulos posibles salen del catálogo de dimensiones, no de una lista a
  # mano: una dimensión nueva se publica sin tocar el formateador.
  expect_length(prosecnurapp:::.calaco_titulos_posibles(),
                length(prosecnurapp:::.MAC_REF_DIMENSIONES))
})

# --- Llega a la hoja, en su sitio -------------------------------------------

.laco_ind <- function() {
  ind <- aulas_libro_indicadores(
    list(list(classroom_id = "A1", operational_code = "CH 1", faculty = "FAC1",
              label = "a1", sample_role = "titular", wave = "M1",
              eligible_n = 30, expected_valid = 10, operational_status = "aplicada")),
    efectivas = c(`CH 1` = 6),
    cuotas = list(facultades = list(list(facultad = "FAC1",
                                         faculty_key = .cm_criterios_fac_key("FAC1"),
                                         cuota = 10, tau = 0.5))))
  ind$cobertura <- aulas_libro_cobertura(.laco_composicion())
  ind
}

test_that("en la hoja va detrás del bloque del eje y delante del rendimiento", {
  # Es el orden que pidió Gonzalo, y el mismo en la pantalla: «cuánto llevas»
  # primero, «a quién estás alcanzando» después, y el rendimiento al final.
  filas <- aulas_libro_hoja_avance(.laco_ind(), fecha = as.Date("2026-09-22"))
  primera <- vapply(filas, function(f) as.character(f[[1]] %||% ""), character(1))
  pos <- function(x) which(primera == x)[[1]]
  expect_true(pos("Avance por facultad") < pos("Cobertura por sexo"))
  expect_true(pos("Cobertura por sexo") < pos("Cobertura por carrera"))
  expect_true(pos("Cobertura por carrera") < pos("Rendimiento por facultad"))
  # Y con sus cifras, no sólo con su título.
  i <- pos("Cobertura por carrera")
  expect_identical(as.character(filas[[i + 1L]][[1]]), "Categoría")
  expect_identical(as.character(filas[[i + 2L]][[1]]), "ECONOMÍA")
  expect_identical(filas[[i + 2L]][[2]], 358)
})

test_that("el xlsx escribe el bloque con su título y sus cinco columnas", {
  skip_if_not_installed("openxlsx")
  wb <- openxlsx::createWorkbook()
  aulas_libro_escribir_indicadores(wb, .laco_ind(), hoja = "Avance de campo")
  path <- withr::local_tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  celdas <- openxlsx::read.xlsx(path, sheet = "Avance de campo", colNames = FALSE,
                                skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  col1 <- as.character(celdas[[1]])
  fila <- which(!is.na(col1) & col1 == "Cobertura por carrera")
  expect_length(fila, 1L)
  expect_identical(as.character(celdas[fila + 1L, seq_along(AULAS_COBERTURA_CABECERAS)]),
                   AULAS_COBERTURA_CABECERAS)
  expect_identical(as.character(celdas[fila + 2L, 1]), "ECONOMÍA")
})
