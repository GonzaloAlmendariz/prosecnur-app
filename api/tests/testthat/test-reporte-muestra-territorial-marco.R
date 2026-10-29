# Reporte decisional territorial: marco elegible, cobertura, margen y plan (U16).

.u16_fila <- function(ubigeo, distrito, total, area = 0, minimo = 0, piloto_mz = 0) {
  cuenta <- function(p, mz = 0) list(manzanas = mz, viviendas = round(p / 4), poblacion = p)
  list(ubigeo = ubigeo, distrito = distrito, total = cuenta(total, 100),
       elegible = cuenta(total - area - minimo, 80),
       excluida_area = cuenta(area, 5), excluida_minimo = cuenta(minimo, 10),
       excluida_piloto = cuenta(0, piloto_mz))
}

.u16_area <- function() list(
  id = "Cerro Norte", motivo = "inseguridad", detalle = "", fuente = "Comisaría del sector", fecha_evidencia = "2026-09-15",
  poligono = list(c(-77.03, -12.04), c(-77.02, -12.04), c(-77.02, -12.05))
)

.u16_criterios <- function(areas = TRUE) hojas_ruta_marco_elegible_normalizar(list(
  declarado = TRUE, minimo_viviendas = 3L, areas_excluidas = if (areas) list(.u16_area()) else list()
))

.u16_filas <- function() list(
  .u16_fila("150101", "Lima", 10000, area = 800, minimo = 400, piloto_mz = 2),
  .u16_fila("150120", "Magdalena del Mar", 5000, area = 0, minimo = 100)
)

.u16_decision <- function(criterios, tipo = "aceptar", id = 7L) list(
  id = id, fecha = "2026-10-20T10:00:00-0500", fase = "field", accion = "decision_cobertura",
  resumen = "Se acepta la pérdida de cobertura en Lima: el área presenta riesgo documentado para el equipo de campo.",
  detalle = list(decision = tipo, marco_hash = hojas_ruta_marco_elegible_huella(criterios), ubigeos = list("150101"))
)

.u16_insumos <- function(criterios, bitacora = list(), filas = .u16_filas(), nse = NULL, plan = NULL) {
  sin_poligono <- criterios
  sin_poligono$areas_excluidas <- lapply(sin_poligono$areas_excluidas, function(a) { a$poligono <- NULL; a })
  list(
    marco = list(criterios = sin_poligono, por_distrito = filas,
                 por_area = list(list(id = "Cerro Norte", motivo = "inseguridad", manzanas = 5, viviendas = 200, poblacion = 800))),
    decision_cobertura = hojas_ruta_decision_cobertura_estado(filas, criterios, bitacora),
    bitacora = bitacora, plan_campo = plan, nse_por_distrito = nse
  )
}

.u16_config <- function(fuente = "legado", deff = 1.5, icc = NULL, k = 5L) {
  ss <- list(design_effect = deff, design_effect_fuente = fuente, response_rate = 0.5, ocupacion = 0.8,
             confidence_level = 0.95, margin = 0.05)
  if (!is.null(icc)) ss$icc_aplicado <- icc
  list(territorios = list("150101", "150120"), entrevistas_por_manzana = k, sample_size = ss)
}

test_that("sin marco declarado: se dice que se sorteó sobre todo el marco 2017", {
  m <- reporte_mt_marco_modelo(list(marco = NULL), territorios = list(list(ubigeo = "150101", distrito = "Lima")))
  expect_false(m$declarado)
  expect_match(m$frase_general, "todo el marco de manzanas del Censo 2017")
  expect_identical(m$estado$`Decisión de cobertura`, "Sorteado sobre todo el marco 2017")
  expect_null(m$areas)
  # Una muestra con el objeto pero legacy (`declarado = FALSE`) también.
  legacy <- reporte_mt_marco_modelo(list(marco = list(criterios = list(declarado = FALSE), por_distrito = .u16_filas())))
  expect_false(legacy$declarado)
  expect_true(all(legacy$estado$`Decisión de cobertura` == "Sorteado sobre todo el marco 2017"))
})

test_that("con marco declarado y sin decisión: % por área y por mínimo sobre la población del distrito; frase del ADR 0115 §4", {
  cr <- .u16_criterios()
  m <- reporte_mt_marco_modelo(.u16_insumos(cr))
  expect_true(m$declarado)
  cob <- m$cobertura
  expect_identical(cob$Distrito, c("Lima", "Magdalena del Mar"))
  expect_identical(cob$`Excluida por área`, c("8.0 %", "0.0 %"))
  expect_identical(cob$`Excluida por mínimo`, c("4.0 %", "2.0 %"))
  # Lima excluye 12 % (exige), Magdalena 2 % (no exige).
  expect_identical(m$estado$`Decisión de cobertura`, c("Sin decisión registrada", "No requiere decisión (excluye menos del 10 %)"))
  expect_match(m$frases_distrito[1], "La muestra representa a los hogares de manzanas con al menos 3 viviendas registradas en 2017, fuera de las áreas excluidas \\(1 área declarada para el estudio, 8.0 % de la población del distrito\\)", perl = TRUE)
  expect_identical(m$areas$Motivo, "Inseguridad")
  expect_match(m$areas$Evidencia, "Comisaría del sector, 15 de septiembre de 2026")
  expect_identical(m$areas$`Población excluida`, "800")
  expect_match(m$frases_distrito[2], "el área excluida del estudio no toca manzanas de este distrito")
  expect_null(m$decisiones)
  # La piloto no es criterio del marco: va como nota aparte.
  expect_match(m$nota_piloto, "2 manzanas titulares de la prueba piloto")
})

test_that("con decisión registrada: fecha legible, tipo y justificación tal cual; sin ids ni códigos", {
  cr <- .u16_criterios()
  b <- list(.u16_decision(cr, "aceptar"))
  m <- reporte_mt_marco_modelo(.u16_insumos(cr, bitacora = b))
  expect_identical(m$estado$`Decisión de cobertura`[1], "Decisión registrada (20/10/2026, aceptar la pérdida de cobertura)")
  expect_identical(m$decisiones$Fecha, "20 de octubre de 2026")
  expect_identical(m$decisiones$`Decisión`, "Se acepta la pérdida de cobertura")
  expect_identical(m$decisiones$`Justificación`, b[[1]]$resumen)
  expect_identical(m$decisiones$Distritos, "Lima")
  r <- reporte_mt_marco_modelo(.u16_insumos(cr, bitacora = list(.u16_decision(cr, "redefinir"))))
  expect_match(r$estado$`Decisión de cobertura`[1], "redefinir la población objetivo")
  # Cambiar el mínimo invalida la decisión: vuelve a «Sin decisión registrada».
  cr2 <- cr; cr2$minimo_viviendas <- 5L
  ins <- .u16_insumos(cr2, bitacora = b)
  expect_identical(reporte_mt_marco_modelo(ins)$estado$`Decisión de cobertura`[1], "Sin decisión registrada")
  todo <- paste(unlist(reporte_mt_marco_modelo(.u16_insumos(cr, bitacora = b))), collapse = " ")
  expect_false(grepl("\\b[EW]_[A-Z_]+", todo, perl = TRUE))
  expect_false(grepl("marco_hash|huella", todo))
})

test_that("sin áreas declaradas la frase lo dice; el perfil NSE compara lo excluido con lo elegible", {
  cr <- .u16_criterios(areas = FALSE)
  nse <- list(list(ubigeo = "150101", elegible = list(A = 2000, B = 6000, `S/D` = 800), excluida = list(B = 300, C = 900)))
  m <- reporte_mt_marco_modelo(.u16_insumos(cr, nse = nse))
  expect_match(m$frases_distrito[1], "al menos 3 viviendas registradas en 2017; no se declararon áreas excluidas.")
  expect_null(m$areas)
  expect_identical(m$nse$`Nivel NSE`, c("A", "B", "C", "Sin dato"))
  expect_identical(m$nse$`% de lo excluido`, c("0.0 %", "25.0 %", "75.0 %", "0.0 %"))
  expect_identical(m$nse$`% de lo elegible`[2], sprintf("%.1f %%", 100 * 6000 / 8800))
  sin_nse <- reporte_mt_marco_modelo(.u16_insumos(cr))
  expect_match(sin_nse$nota_nse, "no está disponible")
})

test_that("margen: DEFF heredado, ICC de la biblioteca y DEFF 1 con conglomerado", {
  leg <- reporte_mt_margen_modelo(.u16_config("legado", 1.5))
  expect_match(leg$margen, "bajo muestreo aleatorio simple \\(MAS\\) ajustado por un efecto de diseño \\(DEFF\\) de 1.50")
  expect_match(leg$procedencia, "DEFF heredado sin procedencia declarada")
  icc <- list(id = "HSVG 2025", icc = 0.06, unidad_conglomerado = "ruta", escala = "proporcion", conglomerados = 142,
              fecha = "2025-11-30", fuente = "Base depurada del estudio", k_ruta = 5L, deff_resultante = 1.24)
  ic <- reporte_mt_margen_modelo(.u16_config("icc_biblioteca", 1.24, icc = icc))
  expect_match(ic$procedencia, "ICC\\) de 0.060 medido en «HSVG 2025»")
  expect_match(ic$procedencia, "142 conglomerados")
  expect_match(ic$procedencia, "k = 5 entrevistas por ruta, lo que da 1.24")
  mas <- reporte_mt_margen_modelo(.u16_config("por_declarar", 1))
  expect_match(mas$margen, "no incluye el efecto del conglomerado")
  expect_match(mas$procedencia, "pendiente de declaración")
  expect_match(leg$alcance, "el margen es nominal")
})

test_that("plan: visitas ceil(k/(r·e)) y con margen; regla de no respuesta; plan guardado y rutas que exceden", {
  cfg <- .u16_config(k = 5L)
  p <- reporte_mt_plan_modelo(cfg, NULL, NULL)
  # k = 5, r = 0,5, e = 0,8 → ceil(5 / 0,4) = 13.
  expect_identical(p$supuestos$Valor[4], "13")
  expect_identical(p$supuestos$Valor[5], as.character(hojas_ruta_visitas_cap(5, 0.5, 0.8)))
  expect_identical(p$regla, HOJAS_RUTA_REGLA_NO_RESPUESTA)
  expect_identical(p$sin_plan, "No se registró un plan de campo para esta muestra.")
  bloques <- list(
    list(id_manzana = "M1", ubigeo = "150101", distrito = "Lima", entrevistas = 5, visitas_esperadas = 13),
    list(id_manzana = "M2", ubigeo = "150101", distrito = "Lima", entrevistas = 5, visitas_esperadas = 40)
  )
  puntos <- data.frame(id_manzana = c("M1", "M2"), lon = c(-77.03, -77.02), lat = c(-12.04, -12.05))
  plan <- hojas_ruta_plan_campo(bloques, list(encuestadores = 2, visitas_por_jornada = 30), puntos = puntos)
  q <- reporte_mt_plan_modelo(cfg, NULL, plan)
  expect_null(q$sin_plan)
  expect_identical(q$plan$resumen$Valor[q$plan$resumen$Concepto == "Jornadas-encuestador equivalentes"], "3")
  expect_false("Costo estimado" %in% q$plan$resumen$Concepto)
  expect_identical(q$plan$rutas_largas$Ruta, "M2")
  expect_identical(q$plan$rutas_largas$`Días consecutivos`, "2")
  expect_match(q$plan$nota_largas, "1 ruta requiere más visitas que una jornada de 30")
  expect_false(grepl("W_PLAN", paste(unlist(q), collapse = " ")))
})

test_that("el router calcula los insumos desde la sesión: bitácora, decisión vigente, plan y NSE", {
  cr <- .u16_criterios(areas = FALSE)
  filas <- .u16_filas()
  sid <- session_create()
  .hojas_ruta_ensure_runs(sid)
  s <- session_get(sid)
  run <- s$hojas_ruta_runs$field
  run$config$marco_elegible <- cr
  run$config$territorios <- list("150101", "150120")
  run$ui_state$plan_campo <- list(encuestadores = 2L, visitas_por_jornada = 30L)
  run$workspace_outputs$sample <- list(
    marco_elegible = list(criterios = cr, por_distrito = filas, por_area = list()),
    blocks = list(list(id_manzana = "M1", ubigeo = "150101", distrito = "Lima", entrevistas = 5, visitas_esperadas = 13))
  )
  s$hojas_ruta_runs$field <- run
  s$hojas_ruta_active_phase <- "field"
  s$hojas_ruta_bitacora <- list(list(id = 3L, accion = "sorteo", resumen = "x", detalle = list()), .u16_decision(cr, "redefinir", id = 9L))
  .session_env[[sid]] <- s
  local_mocked_bindings(
    hojas_ruta_marco_elegible_puntos = function(ubigeo) data.frame(id_manzana = c("M1", "M9"), lon = c(-77.03, -77.0), lat = c(-12.04, -12.0), nse_nivel = c("B", "C")),
    hojas_ruta_inei_frame = function(...) data.frame(id_manzana = c("M1", "M9"), ubigeo = "150101", distrito = "Lima", viviendas = c(20, 1), poblacion = c(80, 4))
  )
  active <- .hojas_ruta_active_run(sid)
  ins <- .reporte_mt_insumos_sesion(sid, active, hojas_ruta_integrada_normalize_config(active$run$config), active$run$workspace_outputs$sample)
  expect_length(ins$bitacora, 1L)
  expect_identical(ins$decision_cobertura$vigente, 9L)
  expect_false(is.null(ins$plan_campo))
  expect_identical(ins$nse_por_distrito[[1]]$excluida$C, 4)
  m <- reporte_mt_marco_modelo(ins)
  expect_match(m$estado$`Decisión de cobertura`[1], "^Decisión registrada \\(20/10/2026, redefinir")
  # El payload del worker no lleva polígonos.
  expect_true(all(vapply(ins$marco$criterios$areas_excluidas, function(a) is.null(a$poligono), logical(1))))
})

test_that("render real del HTML: las dos secciones salen en el archivo, en UTF-8 y sin códigos internos", {
  skip_if_not(nzchar(Sys.which("quarto")) && requireNamespace("quarto", quietly = TRUE), "sin quarto")
  skip_on_cran()
  cr <- .u16_criterios()
  out <- file.path(withr::local_tempdir(), "reporte_muestra_territorial.html")
  reporte_muestra_territorial(
    config = .u16_config(),
    territorios = list(list(ubigeo = "150101", distrito = "Lima"), list(ubigeo = "150120", distrito = "Magdalena del Mar")),
    sample_size_preview = list(n_total = 400),
    output_file = out, formato = "html", quiet = TRUE,
    insumos_marco = .u16_insumos(cr, bitacora = list(.u16_decision(cr)))
  )
  expect_true(file.exists(out))
  expect_gt(file.info(out)$size, 1000)
  html <- paste(readLines(out, encoding = "UTF-8", warn = FALSE), collapse = "\n")
  expect_true(validUTF8(html))
  for (t in c("Marco elegible y cobertura", "Plan de campo y no respuesta", "Margen de error y efecto de diseño",
              "Decisión registrada (20/10/2026, aceptar la pérdida de cobertura)", "DEFF heredado sin procedencia declarada",
              "No se registró un plan de campo")) {
    expect_true(grepl(t, html, fixed = TRUE), info = t)
  }
  expect_false(grepl("Prosecnur", html, fixed = TRUE))
  expect_false(grepl("W_COVERAGE|W_PLAN|E_COVERAGE", html))
})
