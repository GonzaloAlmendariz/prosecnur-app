# =============================================================================
# V3 — el bloque «Avance contra la meta» con LAS DOS METAS y por sexo
# (2026-09-08, dictado de Gonzalo con el Sheets vivo delante)
# =============================================================================
#
# «Dos metas una real y otra referencial (aunque no debe decir que lo es), la de
# 2500 y la de 3750. Además debe estar clarísimo la meta de hombres y mujeres en
# total y por facultad en muestra y sobremuestra.» Y, sobre qué preside Avance:
# «Efectivas sobre la cuota (212 de 2,500 · 8,5 %)».
#
# Contrato anterior, citado para quien lea un diff: el bloque abría con
# «Encuestas de la meta», la suma de `expected_valid` por curso-horario del
# plan — una TERCERA cifra (3 158 en HSVG2026) que compite con las dos metas
# del estudio. Sigue siendo el bloque cuando no hay cuotas del diseño, que es
# cuando la cuota no se puede reconstruir.

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

.lamet_ind <- function(meta_operativa = 30) {
  d <- .lamet_fixture(meta_operativa)
  aulas_libro_indicadores(d$plan, efectivas = d$efectivas, responses = d$responses,
                          cuotas = d$cuotas, cfg = .lamet_cfg())
}

# La celda de una fila de la tabla de metas, por su etiqueta.
.lamet_fila <- function(metas, etiqueta) {
  fila <- metas[metas[[1L]] == etiqueta, , drop = FALSE]
  c(fila$Total, fila$Mujeres, fila$Hombres)
}

test_that("las dos metas y las efectivas salen por sexo, y las partes suman el total", {
  metas <- .lamet_ind()$metas
  expect_true(is.data.frame(metas))
  expect_identical(names(metas), c("Por sexo", "Total", "Mujeres", "Hombres"))
  # Efectivas 10 (7 F / 3 M) contra una muestra de 15 (8 / 7) y una
  # sobremuestra de 30 (16 / 14): el ratio del diseño es x2.
  expect_equal(.lamet_fila(metas, "Efectivas conseguidas"), c(10, 7, 3))
  expect_equal(.lamet_fila(metas, "Muestra"), c(15, 8, 7))
  expect_equal(.lamet_fila(metas, "Sobremuestra"), c(30, 16, 14))
  for (et in c("Efectivas conseguidas", "Muestra", "Sobremuestra")) {
    v <- .lamet_fila(metas, et)
    expect_equal(v[[2]] + v[[3]], v[[1]],
                 info = sprintf("«%s»: mujeres + hombres no da el total", et))
  }
})

test_that("los faltantes se suman por celda y no se netean entre facultades ni entre sexos", {
  metas <- .lamet_ind()$metas
  # Muestra: FAC1 debe 2 F y 2 M; FAC2 debe 0 F (le sobra una) y 2 M.
  # El neto —15 menos 10— diría 5, y faltan 6: el excedente de mujeres de FAC2
  # no cubre a los hombres que faltan.
  expect_equal(.lamet_fila(metas, "Faltan para la muestra"), c(6, 2, 4))
  # Sobremuestra: FAC1 debe 8 F y 6 M; FAC2 debe 1 F y 5 M. El neto diría 20 y
  # aquí coincide, pero por celda: 14 + 6.
  expect_equal(.lamet_fila(metas, "Faltan para la sobremuestra"), c(20, 9, 11))
  for (et in c("Faltan para la muestra", "Faltan para la sobremuestra")) {
    v <- .lamet_fila(metas, et)
    expect_equal(v[[2]] + v[[3]], v[[1]],
                 info = sprintf("«%s»: mujeres + hombres no da el total", et))
  }
})

test_that("el avance es una tasa por celda, no el reparto de una sola", {
  metas <- .lamet_ind()$metas
  expect_equal(.lamet_fila(metas, "Avance a la muestra"), c(10 / 15, 7 / 8, 3 / 7))
  expect_equal(.lamet_fila(metas, "Avance a la sobremuestra"), c(10 / 30, 7 / 16, 3 / 14))
  # Las dos filas de tasa son las que los renderers escriben como porcentaje.
  expect_setequal(prosecnurapp:::.calam_FILAS_PCT,
                  c("Avance a la muestra", "Avance a la sobremuestra"))
  expect_true(all(prosecnurapp:::.calam_FILAS_PCT %in% metas[[1L]]))
})

test_that("sin sobremuestra en el diseño las tres filas no salen en blanco: no salen", {
  metas <- .lamet_ind(meta_operativa = NULL)$metas
  expect_identical(as.character(metas[[1L]]),
                   c("Efectivas conseguidas", "Muestra", "Avance a la muestra",
                     "Faltan para la muestra"))
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

test_that("el bloque del Sheets abre con el titular y la tabla, no con «Encuestas de la meta»", {
  filas <- prosecnurapp:::.malp_df_a_values(aulas_libro_hoja_avance(.lamet_ind()))
  primera <- vapply(filas, function(f) as.character(unlist(f))[[1L]], character(1))
  i <- which(primera == "Avance contra la meta")
  expect_length(i, 1L)
  expect_match(primera[[i + 1L]], "^Efectivas sobre la cuota: 10 de 15")
  expect_identical(primera[[i + 2L]], "Por sexo")
  expect_false("Encuestas de la meta" %in% primera)
  # Las dos cifras de AULAS no son de personas y siguen fuera de la tabla.
  expect_true(all(c("Aulas que llegaron a SU meta", "Aulas del operativo") %in% primera))
  # El porcentaje se escribe como texto por FILA, no crudo.
  fila_pct <- unlist(filas[[which(primera == "Avance a la muestra")]])
  expect_identical(as.character(fila_pct[[2L]]), "66.7 %")
  expect_identical(as.character(fila_pct[[4L]]), "42.9 %")
})

test_that("sin cuotas del diseño el bloque sigue siendo el de la meta del plan", {
  d <- .lamet_fixture()
  ind <- aulas_libro_indicadores(d$plan, efectivas = d$efectivas, responses = d$responses,
                                 cuotas = NULL, cfg = .lamet_cfg())
  expect_null(ind$metas)
  primera <- vapply(prosecnurapp:::.malp_df_a_values(aulas_libro_hoja_avance(ind)),
                    function(f) as.character(unlist(f))[[1L]], character(1))
  expect_true("Encuestas de la meta" %in% primera)
  expect_false("Por sexo" %in% primera)
})
