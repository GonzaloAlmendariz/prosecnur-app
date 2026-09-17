# Una sola definición del avance por facultad — A4 del loop de mejora
# estética y técnica (2026-09-07/08).
#
# El tablero (`.monitoreo_aulas_avance_cuota()`) y el libro
# (`.calaf_avance_por_facultad()`, hoja «Avance de campo» del xlsx y del
# Sheets) contestan «¿cuánto lleva y cuánto falta cada facultad?» desde dos
# lados —respuestas atribuidas y efectivas por aula— y coincidían el 07/09
# porque se arreglaron las dos a la vez (212 conseguidas, 2.288 de brecha en
# las 15 facultades, medido). La divergencia latente estaba en la BRECHA: el
# tablero suma lo que falta en cada celda de sexo (ADR 0079: la cuota no se
# compensa entre celdas) y el libro restaba el neto. Con un sexo pasado de su
# cuota, el libro decía «faltan 1» y el tablero «faltan 3» de la misma
# facultad. Aquí la regla vive en una función y los dos la consumen.

.par_plan <- function() list(list(
  classroom_id = "A1", operational_code = "CH 1", label = "Aula A1",
  faculty = "FAC1", stratum = "FAC1", sample_role = "titular", wave = "M1",
  orden = 1, eligible_n = 30, expected_valid = 10, sample_status = "agendada"
))

.par_dt <- function(F = 6, M = 4) list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 10,
  facultades = list(list(
    facultad = "FAC1", faculty_key = .cm_criterios_fac_key("FAC1"),
    cuota = 10, cuota_sexo = if (is.null(F)) list() else list(F = F, M = M), tau = 0.5
  )),
  selection_run_id = "run_1", frame_hash = "hash_1"
)

.par_cfg <- function(dt) monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .par_plan(), design_targets = dt,
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
))

# 8 mujeres y 1 hombre: la celda F (6) se pasa, la M (4) queda a 3.
.par_resp <- function() data.frame(
  collectorID = rep("A1", 9),
  sexo = c(rep("Femenino", 8), "Masculino"),
  stringsAsFactors = FALSE
)

.par_ambas <- function(dt) {
  cfg <- .par_cfg(dt)
  resp <- .par_resp()
  d <- monitoreo_aulas_dashboard(cfg$plan, resp, cfg)
  tablero <- d$avance_cuota$facultades[[1]]
  efectivas <- monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg)
  ind <- aulas_libro_indicadores(
    cfg$plan, efectivas = efectivas, responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg
  )
  list(tablero = tablero, libro = ind$facultades[1, ], efectivas = efectivas)
}

test_that("monitoreo_aulas_brecha_facultad: por celdas cuando las hay, neto cuando no", {
  # Celdas: F 6 con 8 (sobra), M 4 con 1 (faltan 3) → 3, no el neto 1.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list(list(target = 6, observed = 8), list(target = 4, observed = 1))), 3)
  # Sin celdas: el neto.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list()), 1)
  # Una celda sin target no cuenta como celda; y una sin observado observa 0.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 9, list(list(target = NA, observed = 8))), 1)
  expect_identical(monitoreo_aulas_brecha_facultad(10, 2, list(list(target = 6, observed = NA), list(target = 4, observed = 2))), 8)
  # Sin cuota no hay brecha que declarar.
  expect_true(is.na(monitoreo_aulas_brecha_facultad(NA, 9, list())))
  # Nunca negativa.
  expect_identical(monitoreo_aulas_brecha_facultad(10, 14, list()), 0)
})

test_that("A4: con un sexo pasado de su cuota, el libro dice la MISMA brecha que el tablero", {
  r <- .par_ambas(.par_dt(F = 6, M = 4))
  expect_identical(as.numeric(r$efectivas[["CH 1"]]), 9)
  expect_identical(as.numeric(r$tablero$respuestas_validas), 9)
  # «Efectivas» y «Faltantes» desde el dictado de Gonzalo del 2026-09-08
  # (antes «Conseguidas» y «Faltan»); el dato es el mismo.
  expect_identical(as.numeric(r$libro$Efectivas), 9)
  # ADR 0079 en los dos: la celda de hombres pide 3; la de mujeres ya sobra.
  expect_identical(as.numeric(r$tablero$brecha), 3)
  expect_identical(as.numeric(r$libro$`Faltantes muestra`), as.numeric(r$tablero$brecha))
  expect_identical(as.numeric(r$libro$`Efectivas mujeres`), 8)
  expect_identical(as.numeric(r$libro$`Efectivas hombres`), 1)
  # Y por sexo, sin netear: mujeres 0 (sobran dos), hombres 3.
  expect_identical(as.numeric(r$libro$`Faltantes mujeres muestra`), 0)
  expect_identical(as.numeric(r$libro$`Faltantes hombres muestra`), 3)
})

test_that("A4: sin reparto por sexo en el diseño, los dos restan el neto", {
  r <- .par_ambas(.par_dt(F = NULL))
  expect_identical(as.numeric(r$tablero$brecha), 1)
  expect_identical(as.numeric(r$libro$`Faltantes muestra`), 1)
  # Sin celdas no hay faltante por sexo que declarar.
  expect_true(is.na(r$libro$`Faltantes mujeres muestra`))
})

# =============================================================================
# La TERCERA superficie, y el vocabulario que la tenía muda
# =============================================================================
#
# `avance_por_facultad` —la tabla de «cada facultad contra su meta» del Resumen—
# tenía su propia copia de «no se compensa entre celdas», escrita inline, sin
# llamar a `monitoreo_aulas_brecha_facultad()`. Al unificarla salió a la luz que
# NO estaba sumando celdas: publicaba el NETO.
#
# La causa no era la cuenta, era el emparejamiento. La celda se busca por su
# `sex`, y ése es la ETIQUETA con la que la celda se muestra:
# `.maac_sexo_etiqueta()` prefiere la palabra del plan (`sex_top_*`), luego la de
# las respuestas, y sólo cae a "F"/"M" como último recurso. El bloque comparaba
# `toupper(sex)` contra "F", y eso casa únicamente si el estudio escribe la letra
# —HSVG2026 lo hace: su marco pone "F"/"M" literal en `sex_top_1`, medido 2.427 y
# 1.916 aulas—. Con la etiqueta "Femenino" las cuatro columnas de sexo salían
# `NA`, `meta_origen` caía a "prevista" y la brecha se publicaba neteada: un
# hombre de menos cubierto por dos mujeres de más, que es exactamente lo que la
# cuota por sexo existe para impedir.
#
# **Y nada fallaba.** La prueba que guardaba ese bloque
# (`test-monitoreo-aulas-facultad-por-sexo.R`) llamaba a
# `monitoreo_aulas_avance_sexo_facultad()` con celdas escritas a mano cuyo `sex`
# ya venía "F"/"M": replicaba los valores del original sin pasar por el
# emparejamiento que el bloque añadió. Este fixture no declara `sex_top_*`, así
# que la etiqueta sale de las respuestas —"Femenino"— y la superficie se mide por
# el mismo camino que en producción.

.par_tercera <- function(dt) {
  cfg <- .par_cfg(dt)
  d <- monitoreo_aulas_dashboard(cfg$plan, .par_resp(), cfg)
  d$avance_por_facultad[[1]]
}

test_that("A4: la tercera superficie suma celdas, con la etiqueta que sea", {
  f <- .par_tercera(.par_dt(F = 6, M = 4))
  # La celda se encontró: si no, las cuatro salen NA y el resto miente en verde.
  expect_identical(as.numeric(f$mujeres_logrado), 8)
  expect_identical(as.numeric(f$hombres_logrado), 1)
  expect_identical(as.numeric(f$mujeres_deficit), 0)
  expect_identical(as.numeric(f$hombres_deficit), 3)
  # La misma brecha que el tablero y que el libro: 3, no el neto 1.
  expect_identical(as.numeric(f$brecha), 3)
  # Y la meta es la CUOTA, no el pronóstico. Con la celda perdida esto decía
  # "prevista" y la tabla medía contra `expected_valid`.
  expect_identical(f$meta_origen, "cuota")
  # La bandera que la tabla existe para dar.
  expect_true(f$celda_corta)
})

test_that("A4: la etiqueta de la celda no cambia la cifra", {
  # El mismo estudio con el vocabulario de la letra —el de HSVG2026— tiene que
  # dar lo mismo que con el de la palabra. Si las dos corridas discreparan, la
  # cifra dependería de cómo escriba el sexo el marco.
  letra <- .par_cfg(.par_dt(F = 6, M = 4))
  letra$plan <- lapply(letra$plan, function(r) {
    r$sex_top_1 <- "F"; r$sex_top_2 <- "M"
    r$sex_top_1_n <- 18; r$sex_top_2_n <- 12
    r
  })
  d <- monitoreo_aulas_dashboard(letra$plan, .par_resp(), letra)
  con_letra <- d$avance_por_facultad[[1]]
  con_palabra <- .par_tercera(.par_dt(F = 6, M = 4))
  for (campo in c("brecha", "mujeres_logrado", "hombres_logrado",
                  "mujeres_deficit", "hombres_deficit", "meta_origen")) {
    expect_identical(con_letra[[campo]], con_palabra[[campo]])
  }
})

test_that("A4: sin celdas de sexo, la tercera superficie cae al neto y no inventa columnas", {
  # Un estudio sin reparto por sexo en el diseño no tiene celdas, y entonces la
  # fila se queda con sus cinco columnas de siempre: el corte por sexo no se
  # publica vacío. Se asienta la FORMA, porque es lo que distingue «esta
  # facultad no tiene esa celda» de «esa celda está a cero», y con el eje
  # declarable este mismo bloque va a tener que contestar lo mismo para un eje
  # que no sea facultad.
  f <- .par_tercera(.par_dt(F = NULL))
  expect_identical(as.numeric(f$brecha), 1)
  expect_null(f$mujeres_deficit)
  expect_null(f$celda_corta)
  expect_null(f$meta_origen)
  expect_identical(as.numeric(f$meta), 10)
})
