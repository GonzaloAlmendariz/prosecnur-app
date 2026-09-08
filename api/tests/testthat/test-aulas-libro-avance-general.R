# =============================================================================
# La tabla «AVANCE GENERAL» — las dos metas, por sexo, y las tres de aulas
# (2026-09-08, segundo dictado de Gonzalo con el Sheets vivo delante)
# =============================================================================
#
# «Dos metas una real y otra referencial (aunque no debe decir que lo es), la de
# 2500 y la de 3750. Además debe estar clarísimo la meta de hombres y mujeres en
# total y por facultad en muestra y sobremuestra.» Y, sobre qué preside Avance:
# «Efectivas sobre la cuota (212 de 2,500 · 8,5 %)».
#
# El segundo dictado del mismo día la convierte en TABLA con nombre propio
# —«Indicadores · Total · Hombres · Mujeres»— y diez filas fijas, tres de ellas
# nuevas: aulas aplicadas, asignadas y planificadas.
#
# Contrato anterior, citado para quien lea un diff: se llamaba «Avance contra la
# meta», su cabecera era «Por sexo», iba en mujeres→hombres, sus filas de
# faltantes se llamaban «Faltan para la…», las tres de la sobremuestra
# desaparecían sin diseño y las dos de aulas («Aulas que llegaron a SU meta»,
# «Aulas del operativo») vivían fuera de la tabla. Sigue siendo el bloque de
# etiqueta|valor cuando no hay cuotas del diseño, que es cuando la cuota no se
# puede reconstruir.

.lamet_aula <- function(id, fac, code, meta = 10) {
  list(classroom_id = id, operational_code = code, faculty = fac,
       label = paste("Aula", id), sample_role = "titular", wave = "M1",
       eligible_n = 30, expected_valid = meta, operational_status = "aplicada")
}

.lamet_cfg <- function() list(source_mapping = list(collector_var = "collectorID", sex_var = "sexo"))

# FAC1 pide 10 (6 F / 4 M) y recibe 6 (4 F / 2 M); FAC2 pide 5 (2 F / 3 M) y
# recibe 4 (3 F / 1 M): en FAC2 SOBRAN mujeres y FALTAN hombres, que es el caso
# que separa la suma por celdas del neto (ADR 0079).
.lamet_fixture <- function(meta_operativa = 30) {
  facs <- list(
    list(facultad = "FAC1", faculty_key = .cm_criterios_fac_key("FAC1"),
         cuota = 10, cuota_sexo = list(F = 6, M = 4), tau = 0.5),
    list(facultad = "FAC2", faculty_key = .cm_criterios_fac_key("FAC2"),
         cuota = 5, cuota_sexo = list(F = 2, M = 3), tau = 0.5)
  )
  cuotas <- list(schema = "monitoreo_aulas_design_targets_v1", facultades = facs,
                 meta_diseno = 15)
  if (!is.null(meta_operativa)) cuotas$meta_operativa <- meta_operativa
  list(
    plan = list(.lamet_aula("AULA-1", "FAC1", "CH 1"), .lamet_aula("AULA-2", "FAC2", "CH 2")),
    efectivas = c(`CH 1` = 6, `CH 2` = 4),
    responses = data.frame(
      collectorID = c(rep("AULA-1", 6), rep("AULA-2", 4)),
      sexo = c("Femenino", "Femenino", "Femenino", "Masculino", "Masculino", "Femenino",
               "Femenino", "Femenino", "Femenino", "Masculino"),
      stringsAsFactors = FALSE
    ),
    cuotas = cuotas
  )
}

.lamet_ind <- function(meta_operativa = 30, asignados = NULL) {
  d <- .lamet_fixture(meta_operativa)
  aulas_libro_indicadores(d$plan, efectivas = d$efectivas, responses = d$responses,
                          cuotas = d$cuotas, cfg = .lamet_cfg(), asignados = asignados)
}

# La celda de una fila de «Avance general», por su etiqueta. Devuelve
# total, hombres, mujeres: el orden dictado el 2026-09-08.
.lamet_fila <- function(general, etiqueta) {
  fila <- general[general[[1L]] == etiqueta, , drop = FALSE]
  c(fila$Total, fila$Hombres, fila$Mujeres)
}

test_that("la cabecera y las diez filas son las que dictó Gonzalo, en su orden", {
  g <- .lamet_ind()$general
  expect_true(is.data.frame(g))
  expect_identical(names(g), c("Indicadores", "Total", "Hombres", "Mujeres"))
  expect_identical(names(g), AULAS_AVANCE_CABECERAS$general)
  expect_identical(as.character(g[[1L]]), AULAS_AVANCE_FILAS_GENERAL)
  expect_identical(as.character(g[[1L]]), c(
    "Efectivas", "Muestra", "Avance muestra", "Faltantes para la muestra",
    "Sobremuestra", "Avance sobremuestra", "Faltantes para la sobremuestra",
    "Aulas aplicadas", "Aulas asignadas", "Aulas planificadas"
  ))
  # Ningún rótulo lleva «(%)»: Gonzalo, «el (%) significa que va en porcentaje,
  # no que les pongas "(%)" al título».
  expect_false(any(grepl("%", c(names(g), as.character(g[[1L]])), fixed = TRUE)))
})

test_that("las dos metas y las efectivas salen por sexo, y las partes suman el total", {
  g <- .lamet_ind()$general
  # Efectivas 10 (3 M / 7 F) contra una muestra de 15 (7 / 8) y una
  # sobremuestra de 30 (14 / 16): el ratio del diseño es x2.
  expect_equal(.lamet_fila(g, "Efectivas"), c(10, 3, 7))
  expect_equal(.lamet_fila(g, "Muestra"), c(15, 7, 8))
  expect_equal(.lamet_fila(g, "Sobremuestra"), c(30, 14, 16))
  for (et in c("Efectivas", "Muestra", "Sobremuestra")) {
    v <- .lamet_fila(g, et)
    expect_equal(v[[2]] + v[[3]], v[[1]],
                 info = sprintf("«%s»: hombres + mujeres no da el total", et))
  }
})

test_that("las tres filas de aulas van sólo en el total: un aula no tiene sexo", {
  # Contar aulas «de mujeres» no significa nada — el aula es mixta por
  # definición— y una cifra repetida en las tres columnas invitaría a sumarlas.
  ind <- .lamet_ind(asignados = list(`CH 1` = "PEREZ GOMEZ, ANA"))
  g <- ind$general
  expect_equal(.lamet_fila(g, "Aulas aplicadas"), c(2, NA, NA))
  expect_equal(.lamet_fila(g, "Aulas planificadas"), c(2, NA, NA))
  # ASIGNADAS son las que tienen aplicador en el reparto, no las agendadas.
  expect_equal(.lamet_fila(g, "Aulas asignadas"), c(1, NA, NA))
})

test_that("sin reparto cargado, «Aulas asignadas» calla en vez de decir cero", {
  # Un cero se leería como «nadie tiene nada asignado», que es una noticia
  # distinta de «todavía no se ha cargado la disponibilidad».
  g <- .lamet_ind()$general
  expect_true(is.na(.lamet_fila(g, "Aulas asignadas")[[1]]))
})

test_that("los faltantes se suman por celda y no se netean entre facultades ni entre sexos", {
  g <- .lamet_ind()$general
  # Muestra: FAC1 debe 2 M y 2 F; FAC2 debe 2 M y 0 F (le sobra una).
  # El neto —15 menos 10— diría 5, y faltan 6: el excedente de mujeres de FAC2
  # no cubre a los hombres que faltan.
  expect_equal(.lamet_fila(g, "Faltantes para la muestra"), c(6, 4, 2))
  # Sobremuestra: FAC1 debe 6 M y 8 F; FAC2 debe 5 M y 1 F. El neto diría 20 y
  # aquí coincide, pero por celda: 11 + 9.
  expect_equal(.lamet_fila(g, "Faltantes para la sobremuestra"), c(20, 11, 9))
  for (et in c("Faltantes para la muestra", "Faltantes para la sobremuestra")) {
    v <- .lamet_fila(g, et)
    expect_equal(v[[2]] + v[[3]], v[[1]],
                 info = sprintf("«%s»: hombres + mujeres no da el total", et))
  }
})

test_that("el avance es una tasa por celda, no el reparto de una sola", {
  g <- .lamet_ind()$general
  expect_equal(.lamet_fila(g, "Avance muestra"), c(10 / 15, 3 / 7, 7 / 8))
  expect_equal(.lamet_fila(g, "Avance sobremuestra"), c(10 / 30, 3 / 14, 7 / 16))
  # Las dos filas de tasa son las únicas que esta tabla escribe con formato de
  # porcentaje, y el vocabulario lo dice POR TABLA: «Diferencia» se llama igual
  # en otras dos y allí no siempre es una proporción.
  pct <- Filter(function(r) prosecnurapp:::.calac_es_proporcion(r, "general"),
                AULAS_AVANCE_FILAS_GENERAL)
  expect_setequal(pct, c("Avance muestra", "Avance sobremuestra"))
})

test_that("sin sobremuestra en el diseño sus tres filas siguen, declaradas en blanco", {
  # Antes se omitían («tres renglones de — son ruido»), y eso valía cuando el
  # bloque era una lista de etiquetas. En una tabla de filas dictadas, una fila
  # que aparece y desaparece según el estudio obliga a contar renglones para
  # saber qué se está leyendo.
  g <- .lamet_ind(meta_operativa = NULL)$general
  expect_identical(as.character(g[[1L]]), AULAS_AVANCE_FILAS_GENERAL)
  expect_true(all(is.na(.lamet_fila(g, "Sobremuestra"))))
  expect_true(is.na(.lamet_fila(g, "Avance sobremuestra")[[1]]))
  # Y el titular tampoco inventa el porcentaje de una meta que no existe.
  d <- .lamet_fixture(meta_operativa = NULL)
  fac <- prosecnurapp:::.calaf_avance_por_facultad(
    d$plan, efectivas = d$efectivas, cuotas = d$cuotas, responses = d$responses, cfg = .lamet_cfg())
  expect_false(grepl("sobremuestra", prosecnurapp:::.calam_titular(fac), fixed = TRUE))
})

test_that("el titular dice efectivas sobre la cuota, con las dos metas", {
  d <- .lamet_fixture()
  fac <- prosecnurapp:::.calaf_avance_por_facultad(
    d$plan, efectivas = d$efectivas, cuotas = d$cuotas, responses = d$responses, cfg = .lamet_cfg())
  txt <- prosecnurapp:::.calam_titular(fac)
  expect_match(txt, "Efectivas sobre la cuota: 10 de 15", fixed = TRUE)
  expect_match(txt, "66.7 % de la muestra", fixed = TRUE)
  expect_match(txt, "33.3 % de la sobremuestra", fixed = TRUE)
  # Ninguna de las dos metas se degrada de palabra (V6, la misma regla que la
  # nota al pie de la tabla por facultad).
  for (prohibida in c("referencial", "margen", "segunda meta", "techo")) {
    expect_false(grepl(prohibida, tolower(txt), fixed = TRUE),
                 info = sprintf("el titular llama «%s» a una de las metas", prohibida))
  }
})

test_that("en el Sheets la tabla abre con el titular y sus tasas van como NÚMERO", {
  filas <- aulas_libro_hoja_avance(.lamet_ind())
  primera <- vapply(filas, function(f) as.character(f[[1L]]), character(1))
  i <- which(primera == "Avance general")
  expect_length(i, 1L)
  expect_match(primera[[i + 1L]], "^Efectivas sobre la cuota: 10 de 15")
  expect_identical(primera[[i + 2L]], "Indicadores")
  expect_false("Encuestas de la meta" %in% primera)

  # **La tasa viaja como PROPORCIÓN NUMÉRICA, no como el texto «66.7 %».** Sin
  # número no hay numFmt de porcentaje que aplicar ni regla de color que
  # compare, que es justo lo que pidió Gonzalo el 2026-09-08.
  fila_pct <- filas[[which(primera == "Avance muestra")]]
  expect_true(is.numeric(fila_pct[[2L]]))
  expect_equal(fila_pct[[2L]], round(10 / 15, 4))
  expect_equal(fila_pct[[3L]], round(3 / 7, 4))
  # Y un conteo también es número, no texto.
  fila_ef <- filas[[which(primera == "Efectivas")]]
  expect_identical(fila_ef[[2L]], 10)
  # Una celda sin dato sigue siendo el «—» declarado, que no es un cero.
  fila_aulas <- filas[[which(primera == "Aulas planificadas")]]
  expect_identical(fila_aulas[[3L]], "\u2014")
})

test_that("sin cuotas del diseño el bloque sigue siendo el de la meta del plan", {
  d <- .lamet_fixture()
  ind <- aulas_libro_indicadores(d$plan, efectivas = d$efectivas, responses = d$responses,
                                 cuotas = NULL, cfg = .lamet_cfg())
  expect_null(ind$general)
  primera <- vapply(aulas_libro_hoja_avance(ind),
                    function(f) as.character(f[[1L]]), character(1))
  expect_true("Encuestas de la meta" %in% primera)
  expect_false("Indicadores" %in% primera)
})
