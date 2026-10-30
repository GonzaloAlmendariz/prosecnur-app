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

.u16_frame_mock <- function() data.frame(id_manzana = c("M1", "M9"), ubigeo = "150101", distrito = "Lima",
                                         viviendas = c(20, 1), poblacion = c(80, 40), stringsAsFactors = FALSE)

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
  expect_identical(cob$`Total excluido`, c("12.0 %", "2.0 %"))
  # Lima excluye 12 % (exige), Magdalena 2 % (no exige).
  expect_identical(m$estado$`Decisión de cobertura`, c("Sin decisión registrada", "No requiere decisión (excluye menos del 10 %)"))
  expect_match(m$frases_distrito[1], "La muestra representa a los hogares de manzanas con al menos 3 viviendas registradas en 2017, fuera de las áreas excluidas \\(1 área declarada para el estudio, 8.0 % de la población del distrito\\)", perl = TRUE)
  expect_identical(m$areas$Motivo, "Inseguridad")
  expect_match(m$areas$Evidencia, "Comisaría del sector, 15 de septiembre de 2026")
  expect_identical(m$areas$`Población excluida`, "800")
  # Muestra sin `por_distrito` en `por_area`: se cae al conteo del estudio.
  expect_match(m$frases_distrito[2], "las áreas excluidas del estudio no excluyen población de este distrito")
  expect_null(m$decisiones)
  # La piloto no es criterio del marco: va como nota aparte.
  expect_match(m$nota_piloto, "Lima: 2 manzanas")
  expect_match(m$nota_piloto, "no suma el 100 % de la población 2017")
  expect_length(m$supuestos, 3L)
  expect_match(paste(m$supuestos, collapse = " "), "población INEI 2017 completa")
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
  # Sin costos: el plan por defecto trae S/ 145 por jornada (B21), así que se anulan.
  plan <- hojas_ruta_plan_campo(bloques, list(encuestadores = 2, visitas_por_jornada = 30, costo_por_jornada = 0, supervision_pct = 0), puntos = puntos)
  q <- reporte_mt_plan_modelo(cfg, NULL, plan)
  expect_null(q$sin_plan)
  expect_identical(q$plan$resumen$Valor[q$plan$resumen$Concepto == "Jornadas-encuestador equivalentes"], "3")
  expect_false("Costo estimado" %in% q$plan$resumen$Concepto)
  con_costo <- reporte_mt_plan_modelo(cfg, NULL, hojas_ruta_plan_campo(bloques, list(encuestadores = 2, visitas_por_jornada = 30), puntos = puntos))
  expect_true("Costo estimado" %in% con_costo$plan$resumen$Concepto)
  expect_identical(q$plan$rutas_largas$Ruta, "M2")
  expect_identical(q$plan$rutas_largas$`Días consecutivos`, "2")
  expect_match(q$plan$nota_largas, "1 ruta requiere más visitas esperadas que una jornada de 30")
  expect_false(grepl("W_PLAN", paste(unlist(q), collapse = " ")))
})

test_that("el router calcula los insumos desde la sesión: bitácora, decisión vigente, plan y NSE", {
  cr <- .u16_criterios(areas = FALSE)
  # La muestra guarda los conteos que el marco recalculado reproduce (candado del NSE).
  filas <- hojas_ruta_marco_elegible_aplicar(.u16_frame_mock(), cr)$por_distrito
  sid <- session_create()
  .hojas_ruta_ensure_runs(sid)
  s <- session_get(sid)
  run <- s$hojas_ruta_runs$field
  run$config$marco_elegible <- cr
  run$config$territorios <- list("150101", "150120")
  run$workspace_outputs$sample <- list(
    marco_elegible = list(criterios = cr, por_distrito = filas, por_area = list()),
    blocks = list(list(id_manzana = "M1", ubigeo = "150101", distrito = "Lima", entrevistas = 5, visitas_esperadas = 13))
  )
  s$hojas_ruta_runs$field <- run
  s$hojas_ruta_active_phase <- "field"
  s$hojas_ruta_bitacora <- list(
    list(id = 3L, accion = "sorteo", fase = "field", resumen = "x", detalle = list()),
    list(id = 4L, accion = "plan_supuestos", fase = "pilot", fecha = "2026-10-01T09:00:00-0500", resumen = "p", detalle = list(supuestos = list(encuestadores = 9L))),
    list(id = 5L, accion = "plan_supuestos", fase = "field", fecha = "2026-10-21T09:00:00-0500", resumen = "p", detalle = list(supuestos = list(encuestadores = 2L, visitas_por_jornada = 30L))),
    .u16_decision(cr, "redefinir", id = 9L)
  )
  .session_env[[sid]] <- s
  local_mocked_bindings(
    hojas_ruta_marco_elegible_puntos = function(ubigeo) data.frame(id_manzana = c("M1", "M9"), lon = c(-77.03, -77.0), lat = c(-12.04, -12.0), nse_nivel = c("B", "C")),
    hojas_ruta_inei_frame = function(...) .u16_frame_mock()
  )
  active <- .hojas_ruta_active_run(sid)
  ins <- .reporte_mt_insumos_sesion(sid, active, hojas_ruta_integrada_normalize_config(active$run$config), active$run$workspace_outputs$sample)
  expect_length(ins$bitacora, 1L)
  expect_identical(ins$decision_cobertura$vigente, 9L)
  # El plan sale de la última entrada `plan_supuestos` de la fase activa.
  expect_identical(ins$plan_campo$supuestos$encuestadores, 2L)
  expect_identical(ins$plan_fecha, "2026-10-21T09:00:00-0500")
  expect_identical(ins$estado_muestra, "declarado")
  expect_false(ins$config_cambio)
  expect_identical(ins$nse_por_distrito[[1]]$excluida$C, 40)
  expect_false(ins$nse_marco_cambio)
  expect_identical(ins$muestra$entrevistas, 5)
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
  # Las secciones heredadas no imprimen markdown literal ni contradicen el diseño.
  expect_false(grepl("**Tama", html, fixed = TRUE))
  expect_false(grepl("_Cuotas no", html, fixed = TRUE))
  expect_false(grepl("Random walk", html, fixed = TRUE))
})

test_that("un fallo al calcular la decisión o el NSE no se publica como falta de datos (guardian U16 I1)", {
  filas <- list(list(ubigeo = "150103", distrito = "ATE", total = list(poblacion = 1000), elegible = list(poblacion = 850),
                     excluida_area = list(poblacion = 100), excluida_minimo = list(poblacion = 50), excluida_piloto = list(poblacion = 0)))
  ins <- list(marco = list(criterios = list(declarado = TRUE, minimo_viviendas = 5L, areas_excluidas = list()), por_distrito = filas, por_area = list()),
              decision_cobertura = NULL, bitacora = list(), decision_fallo = TRUE, nse_fallo = TRUE)
  m <- reporte_mt_marco_modelo(ins, list())
  txt <- paste(unlist(m$estado), collapse = " ")
  expect_false(grepl("Sin decisión registrada", txt, fixed = TRUE))
  expect_match(txt, "No pudo verificarse", fixed = TRUE)
  expect_match(m$nota_nse, "no pudo calcularse", fixed = TRUE)
  ins$decision_fallo <- FALSE; ins$nse_fallo <- FALSE
  m2 <- reporte_mt_marco_modelo(ins, list())
  expect_match(paste(unlist(m2$estado), collapse = " "), "Sin decisión registrada", fixed = TRUE)
  expect_false(grepl("no trae el nivel NSE", m2$nota_nse %||% "", fixed = TRUE))
  # vigente con forma inesperada no rompe el worker (M2).
  ins$decision_cobertura <- list(exigida = list(), vigente = list(1, 2))
  expect_silent(reporte_mt_marco_modelo(ins, list()))
})

# ---------- Revisión metodológica de U16 ----------

.u16_sesion <- function(config_me, sample, bitacora = list(), ui_plan = NULL) {
  sid <- session_create()
  .hojas_ruta_ensure_runs(sid)
  s <- session_get(sid)
  run <- s$hojas_ruta_runs$field
  run$config$marco_elegible <- config_me
  run$config$territorios <- list("150101", "150120")
  if (!is.null(ui_plan)) run$ui_state$plan_campo <- ui_plan
  run$workspace_outputs$sample <- sample
  s$hojas_ruta_runs$field <- run
  s$hojas_ruta_active_phase <- "field"
  s$hojas_ruta_bitacora <- bitacora
  .session_env[[sid]] <- s
  active <- .hojas_ruta_active_run(sid)
  .reporte_mt_insumos_sesion(sid, active, hojas_ruta_integrada_normalize_config(active$run$config), active$run$workspace_outputs$sample)
}

.u16_mock_cartografia <- function(env = parent.frame()) {
  local_mocked_bindings(
    hojas_ruta_marco_elegible_puntos = function(ubigeo) data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0)),
    hojas_ruta_inei_frame = function(...) data.frame(id_manzana = character(0), ubigeo = character(0), distrito = character(0), viviendas = numeric(0), poblacion = numeric(0)),
    .env = env
  )
}

test_that("un área que toca uno de dos distritos: k por distrito en la frase y en la tabla de áreas", {
  cr <- .u16_criterios()
  ins <- .u16_insumos(cr)
  ins$marco$por_area <- list(list(id = "Cerro Norte", motivo = "inseguridad", manzanas = 5, viviendas = 200, poblacion = 800,
                                  por_distrito = list(list(ubigeo = "150101", manzanas = 5, poblacion = 800))))
  m <- reporte_mt_marco_modelo(ins)
  expect_match(m$frases_distrito[1], "fuera de las áreas excluidas \\(1 área, 8.0 % de la población del distrito\\)")
  expect_match(m$frases_distrito[2], "ninguna de las áreas excluidas del estudio toca este distrito")
  expect_identical(m$areas$Distritos, "Lima")
  # El motor devuelve ese desglose desde `aplicar`.
  frame <- data.frame(id_manzana = c("a", "b", "c"), ubigeo = c("150101", "150101", "150120"), distrito = c("Lima", "Lima", "Magdalena"),
                      viviendas = c(20, 30, 40), poblacion = c(80, 120, 160), stringsAsFactors = FALSE)
  puntos <- data.frame(id_manzana = c("a", "b", "c"), lon = c(-77.022, -77.10, -77.025), lat = c(-12.042, -12.10, -12.30), nse_nivel = "B")
  ap <- hojas_ruta_marco_elegible_aplicar(frame, cr, puntos = puntos)
  expect_identical(ap$por_area[[1]]$por_distrito, list(list(ubigeo = "150101", manzanas = 1L, poblacion = 80)))
})

test_that("total excluido ≥ 10 % con cada componente < 10 % exige decisión", {
  cr <- .u16_criterios(areas = FALSE)
  filas <- list(.u16_fila("150101", "Lima", 10000, area = 600, minimo = 400))
  m <- reporte_mt_marco_modelo(.u16_insumos(cr, filas = filas))
  expect_identical(m$cobertura$`Total excluido`, "10.0 %")
  expect_identical(m$estado$`Decisión de cobertura`, "Sin decisión registrada")
})

test_that("piloto con población: la nota explica por qué elegible + área + mínimo no suma 100 %", {
  cr <- .u16_criterios(areas = FALSE)
  f <- .u16_fila("150101", "Lima", 10000, minimo = 100)
  f$excluida_piloto <- list(manzanas = 3, viviendas = 40, poblacion = 160)
  f$elegible$poblacion <- 10000 - 100 - 160
  m <- reporte_mt_marco_modelo(.u16_insumos(cr, filas = list(f)))
  expect_match(m$nota_piloto, "Lima: 3 manzanas y 160 personas", fixed = TRUE)
  expect_match(m$nota_piloto, "no entra en los porcentajes de exclusión ni en la decisión")
  expect_identical(m$cobertura$`Total excluido`, "1.0 %")
})

test_that("config modificada después del sorteo: el informe describe la muestra y la decisión usa su huella", {
  .u16_mock_cartografia()
  cr <- .u16_criterios(areas = FALSE)
  cr_config <- cr; cr_config$minimo_viviendas <- 8L
  sample <- list(marco_elegible = list(criterios = cr, por_distrito = .u16_filas(), por_area = list()),
                 blocks = list(list(id_manzana = "M1", ubigeo = "150101", entrevistas = 5)))
  ins <- .u16_sesion(cr_config, sample, bitacora = list(.u16_decision(cr, "aceptar", id = 4L)))
  expect_true(ins$config_cambio)
  expect_identical(ins$decision_cobertura$vigente, 4L)
  m <- reporte_mt_marco_modelo(ins)
  expect_identical(m$aviso_config, "La configuración del marco elegible cambió después del sorteo; este informe describe la muestra sorteada.")
  expect_match(m$frases_distrito[1], "al menos 3 viviendas")
  expect_match(m$estado$`Decisión de cobertura`[1], "^Decisión registrada")
})

test_that("sin entrada plan_supuestos no hay plan, aunque ui_state traiga supuestos", {
  .u16_mock_cartografia()
  cr <- .u16_criterios(areas = FALSE)
  sample <- list(marco_elegible = list(criterios = cr, por_distrito = .u16_filas(), por_area = list()),
                 blocks = list(list(id_manzana = "M1", ubigeo = "150101", entrevistas = 5)))
  ins <- .u16_sesion(cr, sample, ui_plan = list(encuestadores = 4L, visitas_por_jornada = 30L))
  expect_null(ins$plan_campo)
  p <- reporte_mt_plan_modelo(.u16_config(), NULL, ins$plan_campo, ins$plan_fecha, ins$plan_fallo)
  expect_identical(p$sin_plan, "No se registró un plan de campo para esta muestra.")
})

test_that("tres estados sin marco: sin sorteo, sorteo previo al marco elegible y sin criterios", {
  .u16_mock_cartografia()
  cr <- .u16_criterios(areas = FALSE)
  terr <- list(list(ubigeo = "150101", distrito = "Lima"))
  sin <- .u16_sesion(cr, list())
  expect_identical(sin$estado_muestra, "sin_sorteo")
  m <- reporte_mt_marco_modelo(sin, terr)
  expect_match(m$frase_general, "Todavía no hay una muestra sorteada")
  expect_null(m$estado)
  previo <- .u16_sesion(cr, list(blocks = list(list(id_manzana = "M1", ubigeo = "150101", entrevistas = 5))))
  expect_identical(previo$estado_muestra, "previo_al_marco")
  mp <- reporte_mt_marco_modelo(previo, terr)
  expect_match(mp$frase_general, "antes de que se declarara el marco elegible")
  expect_identical(mp$estado$`Decisión de cobertura`, "Sorteado sobre todo el marco 2017")
  legacy <- .u16_sesion(list(declarado = FALSE), list(blocks = list(list(id_manzana = "M1", ubigeo = "150101", entrevistas = 5))))
  expect_identical(legacy$estado_muestra, "sin_criterios")
  expect_match(reporte_mt_marco_modelo(legacy, terr)$frase_general, "sin criterios de elegibilidad declarados")
})

test_that("ICC con k actual distinto del k con que se aplicó: DEFF con el k actual y aviso", {
  icc <- list(id = "hsvg-2025", estudio = "HSVG 2025", indicador = "confianza_baja", icc = 0.06, icc_ic95 = list(0.02, 0.10),
              unidad_conglomerado = "ruta", escala = "proporcion", conglomerados = 142, k_ruta = 5L, deff_resultante = 1.24)
  cfg <- .u16_config("icc_biblioteca", 1.24, icc = icc, k = 6L)
  mm <- reporte_mt_margen_modelo(cfg)
  expect_match(mm$procedencia, "k = 6 entrevistas por ruta, lo que da 1.30")
  expect_match(mm$procedencia, "indicador «confianza_baja»; conglomerado: ruta; IC 95 %: 0.020 a 0.100")
  expect_match(mm$aviso_icc, "no coincide")
  ok <- reporte_mt_margen_modelo(.u16_config("icc_biblioteca", 1.24, icc = icc, k = 5L))
  expect_null(ok$aviso_icc)
})

test_that("margen nominal numérico, DEFF con dos decimales y FPC coherente entre parámetros y fórmula", {
  cfg <- .u16_config("legado", 1.24)
  cfg$sample_size$apply_fpc <- FALSE
  mm <- reporte_mt_margen_modelo(cfg, sample_size_preview = list(n_used = 400, total_population = 100000))
  esperado <- 100 * 1.96 * sqrt(1.24 * 0.25 / 400)
  expect_match(mm$margen_numerico, sprintf("± %.1f puntos porcentuales al 95 %% de confianza, con p = 0.5, n = 400 y DEFF 1.24.", esperado), fixed = TRUE)
  d <- reporte_mt_diseno_modelo(cfg, list(n_used = 400))
  expect_identical(d$parametros$Valor[d$parametros$`Parámetro` == "Efecto de diseño (DEFF)"], "1.24")
  expect_identical(d$parametros$Valor[d$parametros$`Parámetro` == "Corrección por población finita (FPC)"], "No")
  expect_match(d$formula_intro, "sin corrección por población finita")
  expect_false(grepl("N - 1", d$formula, fixed = TRUE))
  cfg$sample_size$apply_fpc <- TRUE
  d2 <- reporte_mt_diseno_modelo(cfg, NULL)
  expect_match(d2$formula_intro, "con corrección por población finita")
  txt <- paste(unlist(d), collapse = " ")
  expect_false(grepl("Random walk|aleatorias dentro de cada manzana|dentro de cada conglomerado", txt))
  expect_match(txt, "Cuotas de totales por sexo y por edad, sin cruces")
  expect_match(txt, "no probabilístico dentro de ella")
})

# ---------- Segunda vuelta de la revisión metodológica de U16 ----------

.u16_sesion_nse <- function(por_distrito, hash_marco = NULL, env = parent.frame()) {
  cr <- .u16_criterios(areas = FALSE)
  marco_tmp <- withr::local_tempfile(fileext = ".csv", .local_envir = env)
  writeLines(c("id_manzana,ubigeo", "M1,150101"), marco_tmp)
  local_mocked_bindings(
    hojas_ruta_marco_elegible_puntos = function(ubigeo) data.frame(id_manzana = c("M1", "M9"), lon = c(-77.03, -77.0), lat = c(-12.04, -12.0), nse_nivel = c("B", "C")),
    hojas_ruta_inei_frame = function(...) .u16_frame_mock(),
    hojas_ruta_inei_frame_path = function(...) marco_tmp,
    .env = env
  )
  sample <- list(marco_elegible = list(criterios = cr, por_distrito = por_distrito, por_area = list(), hash_marco = hash_marco),
                 blocks = list(list(id_manzana = "M1", ubigeo = "150101", entrevistas = 5)))
  .u16_sesion(cr, sample)
}

test_that("NSE: se publica si el marco recalculado reproduce la muestra; si cambió el archivo o los conteos, no", {
  cr <- .u16_criterios(areas = FALSE)
  filas <- hojas_ruta_marco_elegible_aplicar(.u16_frame_mock(), cr)$por_distrito
  ok <- .u16_sesion_nse(filas)
  expect_false(ok$nse_marco_cambio)
  expect_false(is.null(ok$nse_por_distrito))
  # Rama hash_marco: el archivo del marco no es el del sorteo.
  hash <- .u16_sesion_nse(filas, hash_marco = "hash-del-sorteo")
  expect_true(hash$nse_marco_cambio)
  expect_null(hash$nse_por_distrito)
  expect_match(reporte_mt_marco_modelo(hash)$nota_nse, "cambiaron después del sorteo")
  # Candado: mismo archivo, pero los conteos no se reproducen (p. ej. cambió la cartografía).
  otra <- filas; otra[[1]]$excluida_minimo$poblacion <- 39
  cand <- .u16_sesion_nse(otra)
  expect_true(cand$nse_marco_cambio)
  expect_null(cand$nse_por_distrito)
  expect_false(.reporte_mt_conteos_coinciden(filas, otra))
  expect_true(.reporte_mt_conteos_coinciden(filas, filas))
})

test_that("cuotas: sólo totales por sexo y por edad que suman el n del distrito; el anexo trae todas las celdas", {
  rangos <- c("18-24", "25-34", "35-44", "45-54", "55-64", "65+")
  cells <- do.call(c, lapply(c("150101", "150120", "150122"), function(u) do.call(c, lapply(c("Hombre", "Mujer"), function(sx) {
    lapply(seq_along(rangos), function(i) list(territorio = "LIMA", ubigeo = u, sexo = sx, rango_edad = rangos[i], rango_id = i, cuota = i + if (sx == "Mujer") 1 else 0))
  }))))
  expect_gt(length(cells), 30L)
  terr <- list(list(ubigeo = "150101", distrito = "Lima"), list(ubigeo = "150120", distrito = "Magdalena del Mar"), list(ubigeo = "150122", distrito = "Miraflores"))
  q <- reporte_mt_cuotas_modelo(list(cells = cells), terr)
  # Hombres 1..6 = 21, mujeres 2..7 = 27, total 48 por distrito.
  expect_identical(q$sexo$Hombres, rep("21", 3)); expect_identical(q$sexo$Mujeres, rep("27", 3))
  expect_identical(q$sexo$Total, rep("48", 3))
  expect_identical(names(q$edad), c("Distrito", rangos, "Total"))
  expect_identical(q$edad$`18-24`, rep("3", 3))
  expect_identical(sum(as.numeric(unlist(q$edad[1, rangos]))), 48)
  expect_identical(nrow(q$anexo), 6L)
  expect_identical(sum(as.numeric(unlist(q$anexo[rangos]))), 3 * 48)
  expect_match(q$nota_anexo, "Referencia para Monitoreo")
  expect_identical(q$sexo$Distrito, c("Lima", "Magdalena del Mar", "Miraflores"))
  expect_null(q$aviso_n)
  sp <- list(district_rows = list(list(ubigeo = "150101", n_used = 48), list(ubigeo = "150120", n_used = 50)))
  q2 <- reporte_mt_cuotas_modelo(list(cells = cells), terr, sp)
  expect_match(q2$aviso_n, "^La cuota no suma el tamaño calculado en un distrito: Magdalena del Mar \\(cuota 48, tamaño 50\\)")
})

test_that("A1: la muestra sorteada que no suma el n del cálculo se avisa", {
  cfg <- .u16_config()
  d <- reporte_mt_diseno_modelo(cfg, list(n_used = 400), muestra = list(rutas = 9, entrevistas = 45))
  expect_match(d$aviso_tamano, "tiene 9 rutas titulares que suman 45 entrevistas, frente a las 400 del cálculo")
  expect_null(reporte_mt_diseno_modelo(cfg, list(n_used = 400), muestra = list(rutas = 80, entrevistas = 400))$aviso_tamano)
  p <- reporte_mt_plan_modelo(cfg, list(visitas = list(contactos_esperados = 800, visitas_planificadas = 1040)))
  expect_true("Contactos esperados en todo el estudio, n / r" %in% p$supuestos$Supuesto)
  expect_true(any(grepl("^Visitas planificadas según el tamaño calculado", p$supuestos$Supuesto)))
})

test_that("A3: el distrito cuyo margen nominal pasa el objetivo por distrito se avisa", {
  cfg <- .u16_config("legado", 1.24)
  cfg$sample_size$margin_district <- 0.10
  sp <- list(n_used = 400, district_rows = list(
    list(ubigeo = "150101", distrito = "Lima", poblacion = 268352, n_used = 330),
    list(ubigeo = "150120", distrito = "Magdalena del Mar", poblacion = 54656, n_used = 70)))
  d <- reporte_mt_diseno_modelo(cfg, sp)
  expect_identical(d$por_distrito$Objetivo, rep("± 10.0 pp", 2))
  expect_match(d$aviso_margen_distrito, "^Un distrito supera el margen de error objetivo por distrito: Magdalena del Mar \\(± 13.0 pp frente a ± 10.0 pp\\)")
  expect_false(grepl("Lima", d$aviso_margen_distrito))
})

test_that("A2: un plan sobre rutas sorteadas con otros supuestos muestra los de la muestra", {
  cfg <- .u16_config(k = 5L)
  bloques <- list(list(id_manzana = "M1", ubigeo = "150101", distrito = "Lima", entrevistas = 5, visitas_esperadas = 7))
  plan <- hojas_ruta_plan_campo(bloques, list(), puntos = data.frame(id_manzana = "M1", lon = -77, lat = -12))
  q <- reporte_mt_plan_modelo(cfg, NULL, plan, muestra = list(rutas = 1, entrevistas = 5, k = 5, visitas = c(7, 7), respuesta = 0.9, ocupacion = 0.8))
  expect_match(q$plan$aviso_supuestos, "supuestos distintos")
  expect_identical(q$plan$supuestos_plan$`Rutas sorteadas`, c("90 %", "80 %", "5", "7"))
  expect_identical(q$plan$supuestos_plan$`Configuración actual`, c("50 %", "80 %", "5", "13"))
  igual <- reporte_mt_plan_modelo(cfg, NULL, plan, muestra = list(k = 5, visitas = c(13, 13), respuesta = 0.5, ocupacion = 0.8))
  expect_null(igual$plan$supuestos_plan)
  expect_match(q$plan$resumen$Concepto[3], "Visitas esperadas de las rutas sorteadas")
})

test_that("supuestos del margen: nominal por cuotas y, con ICC, el traslado declarado", {
  icc <- list(id = "hsvg-2025", estudio = "HSVG 2025", icc = 0.06, unidad_conglomerado = "ruta", escala = "proporcion", conglomerados = 142, k_ruta = 5L, deff_resultante = 1.24)
  m <- reporte_mt_margen_modelo(.u16_config("icc_biblioteca", 1.24, icc = icc))
  expect_length(m$supuestos, 2L)
  expect_match(m$supuestos[1], "por cuotas, no probabilística")
  expect_match(m$supuestos[2], "«HSVG 2025» se traslada")
  expect_null(m$aviso_icc)
})

test_that("F33: el informe no contradice al estudio (v1, N por distrito, sin salto)", {
  cfg <- .u16_config("legado", 1)
  cfg$sample_size_mode <- "external_district"
  cfg$sample_size$allocation_mode <- "proportional"
  cfg$route_jump_mode <- "off"
  v1 <- list(list(distrito = "SAN JUAN DE LURIGANCHO", pct = 70.3), list(distrito = "ATE", pct = 50.2))
  ssp <- list(n_used = 400, district_rows = list(
    list(ubigeo = "150132", distrito = "SAN JUAN DE LURIGANCHO", poblacion = 940818, n_used = 200),
    list(ubigeo = "150108", distrito = "CHORRILLOS", poblacion = 309779, n_used = 200)))
  d <- reporte_mt_diseno_modelo(cfg, ssp, muestra = list(rutas = 50, entrevistas = 400, avisos_v1 = v1))
  # (a) limitación de cobertura con su denominador, sin órdenes internas ni jerga.
  expect_match(d$aviso_sorteo_v1, "Limitación de cobertura")
  expect_match(d$aviso_sorteo_v1, "marco elegible de cada distrito en esa situación: SAN JUAN DE LURIGANCHO, 70.3 %", fixed = TRUE)
  expect_false(grepl("v1|vigente|no debe ir a campo", d$aviso_sorteo_v1))
  expect_match(d$decisiones$`Justificación`[1], "sin posibilidad de selección")
  # (b) N fijado para cada distrito: sin «proporcional», sin fórmula ni redondeo, y con la nota de ponderación.
  expect_identical(d$parametros$Valor[d$parametros$`Parámetro` == "Reparto entre distritos"], "Fijado para cada distrito")
  expect_true("Margen de error total de referencia" %in% d$parametros$`Parámetro`)
  expect_false(any(grepl("proporcional a la población", d$nota_tecnica)))
  expect_match(d$formula_intro, "se fijó de antemano para cada distrito")
  expect_null(d$formula)
  expect_false(grepl("redondeado", d$tamano))
  expect_true(any(grepl("deben ponderarse por el peso de cada distrito", d$nota_tecnica)))
  expect_false(any(grepl("se integra en la fórmula", d$nota_tecnica)))
  # (c) sin salto: ni salto ni «todas las viviendas».
  expect_match(d$decisiones$Valor[5], "^Sin salto: se visitan las viviendas una tras otra")
  expect_false(grepl("sorteada|todas las viviendas", d$decisiones$Valor[5]))
  # Salto manual de 1 también es sin salto.
  cfg$route_jump_mode <- "manual"; cfg$route_jump_manual <- 1L
  expect_match(reporte_mt_diseno_modelo(cfg, ssp)$decisiones$Valor[5], "^Sin salto")
})

test_that("F33: sin v1, N calculado y salto 3 queda como antes; total fijado con compromiso se lee bien", {
  cfg <- .u16_config("legado", 1)
  cfg$sample_size_mode <- "calculator"; cfg$route_jump_mode <- "manual"; cfg$route_jump_manual <- 3L
  d <- reporte_mt_diseno_modelo(cfg, list(n_used = 400), muestra = list(rutas = 50, entrevistas = 400))
  expect_null(d$aviso_sorteo_v1)
  expect_match(d$decisiones$`Justificación`[1], "^Las manzanas se sortean con probabilidad conocida")
  expect_identical(d$parametros$Valor[d$parametros$`Parámetro` == "Reparto entre distritos"], "Proporcional a la población")
  expect_match(d$decisiones$Valor[5], "fijo de 3 viviendas")
  expect_match(d$tamano, "redondeado hacia arriba")
  cfg$sample_size_mode <- "external_total"; cfg$sample_size$allocation_mode <- "compromise"
  d2 <- reporte_mt_diseno_modelo(cfg, list(n_used = 400))
  expect_true(any(grepl("se distribuye entre los distritos de forma intermedia entre la proporcional y la uniforme.", d2$nota_tecnica, fixed = TRUE)))
})

test_that("F33: los avisos v1 se leen de la muestra, y si no se pueden calcular se dice", {
  alerta <- list(code = "W_SAMPLE_DRAWN_WITH_V1", message = "ATE: esta muestra se sorteó con un reparto…", viviendas_sin_probabilidad_pct = 50.2)
  zona <- list(code = "W_ZONE_QUOTA_EXCLUDES_ZONES", message = "CHORRILLOS: la cuota por zona…", viviendas_sin_probabilidad_pct = 12.5)
  local_mocked_bindings(hojas_ruta_sorteo_aviso_v1 = function(sample) { sample$alerts <- list(alerta, zona, list(code = "W_OTRO")); sample })
  av <- .reporte_mt_avisos_v1(list(blocks = list(list(id_manzana = "1"))))
  expect_false(av$fallo)
  expect_identical(vapply(av$avisos, `[[`, "", "distrito"), c("ATE", "CHORRILLOS"))
  expect_identical(vapply(av$avisos, `[[`, 0, "pct"), c(50.2, 12.5))
  local_mocked_bindings(hojas_ruta_sorteo_aviso_v1 = function(sample) stop("sin marco"))
  av2 <- suppressMessages(.reporte_mt_avisos_v1(list(blocks = list(list(id_manzana = "1")))))
  expect_true(av2$fallo)
  d <- reporte_mt_diseno_modelo(.u16_config("legado", 1), NULL, muestra = list(rutas = 1, entrevistas = 8, avisos_v1 = av2$avisos, avisos_v1_fallo = av2$fallo))
  expect_match(d$aviso_sorteo_v1, "No se pudo comprobar")
  expect_false(grepl("^Las manzanas se sortean con probabilidad conocida;", d$decisiones$`Justificación`[1]))
})

test_that("F34: la estratificación y la selección dicen cómo se sorteó la muestra, no la config vigente", {
  cfg <- .u16_config("legado", 1)
  cfg$sampling_method <- "pps"; cfg$row_var <- "distrito"
  fila <- function(d, nombre) d$decisiones[d$decisiones$`Decisión` == nombre, ]
  m <- function(alg, metodo = "pps", row_var = "distrito") list(rutas = 1, entrevistas = 8, algoritmo_sorteo = alg, metodo = metodo, row_var = row_var, measure_var = "viviendas")
  modelo <- function(muestra, c = cfg) reporte_mt_diseno_modelo(c, NULL, muestra = muestra)
  # v1: sin firma, NA o firma desconocida, como el motor.
  for (alg in list("", NA_character_, "algo_raro")) {
    d <- modelo(m(alg))
    expect_identical(fila(d, "Estratificación")$Valor, "Distrito y zona")
    expect_match(fila(d, "Selección de manzanas")$Valor, "dentro de cada zona$")
  }
  # v2 por distrito.
  v2 <- modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO))
  expect_identical(fila(v2, "Estratificación")$Valor, "Distrito (lista ordenada por zona)")
  expect_match(fila(v2, "Estratificación")$`Justificación`, "en promedio")
  expect_match(fila(v2, "Selección de manzanas")$Valor, "^Sistemática con probabilidad proporcional al tamaño .*dentro del distrito$")
  # Sin muestra se describe el próximo sorteo.
  expect_identical(fila(reporte_mt_diseno_modelo(cfg, NULL), "Estratificación")$Valor, "Distrito (lista ordenada por zona)")
  # v2 con cuotas por zona (de la muestra).
  vz <- modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO, row_var = "zona"))
  expect_match(fila(vz, "Estratificación")$Valor, "cuotas por zona")
  expect_match(fila(vz, "Estratificación")$`Justificación`, "se resuelven por sorteo")
  # La muestra manda sobre la config vigente.
  c_tope <- cfg; c_tope$sampling_method <- "pps_tope"
  t1 <- modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO_TOPE, metodo = "pps_tope"), cfg)  # sorteada con tope, config pasada a pps
  expect_match(fila(t1, "Selección de manzanas")$Valor, "percentil 95")
  expect_match(fila(t1, "Selección de manzanas")$`Justificación`, "autoponderado")
  expect_false(grepl("percentil 95", fila(modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO), c_tope), "Selección de manzanas")$Valor))
  expect_false(grepl("percentil 95", fila(modelo(m(""), c_tope), "Selección de manzanas")$Valor))
  expect_match(fila(modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO, metodo = "sistematico"), cfg), "Selección de manzanas")$Valor, "^Sistemática con igual probabilidad")
  expect_match(fila(modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO, row_var = "distrito"), within(cfg, row_var <- "zona")), "Estratificación")$Valor, "lista ordenada por zona")
  # Igual probabilidad también pide ponderar; conglomerado fijo sortea como PPS; v1 con zona y sistemático.
  expect_match(fila(modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO, metodo = "sistematico")), "Selección de manzanas")$`Justificación`, "no es autoponderado")
  expect_match(fila(modelo(m(HOJAS_RUTA_ALGORITMO_SORTEO, metodo = "conglomerado_fijo")), "Selección de manzanas")$Valor, "probabilidad proporcional al tamaño")
  expect_match(fila(modelo(m("", metodo = "sistematico", row_var = "zona")), "Selección de manzanas")$Valor, "^Sistemática con igual probabilidad dentro de cada zona$")
  # Sin jerga interna en lo que lee el cliente.
  todo <- paste(unlist(lapply(list(v2, vz, t1), function(d) d$decisiones)), collapse = " ")
  expect_false(grepl("estrato implícito|topada|medida mayor que cero|v1|v2", todo))
})

test_that("F35: el salto y los reemplazos salen de la muestra, no de la config vigente", {
  cfg <- .u16_config("legado", 1)
  cfg$route_jump_mode <- "manual"; cfg$route_jump_manual <- 3L; cfg$replacements_per_titular <- 1L
  fila <- function(d, nombre) d$decisiones[d$decisiones$`Decisión` == nombre, ]$Valor
  muestra <- list(rutas = 1, entrevistas = 8, route_jump_mode = "off", route_jump_manual = 1L, replacements_per_titular = 2L)
  d <- reporte_mt_diseno_modelo(cfg, NULL, muestra = muestra)
  expect_match(fila(d, "Selección de viviendas"), "^Sin salto")
  expect_identical(fila(d, "Reemplazo de rutas"), "2 manzanas de reemplazo por titular")
  # Sin esos datos en la muestra, la config.
  d2 <- reporte_mt_diseno_modelo(cfg, NULL, muestra = list(rutas = 1, entrevistas = 8))
  expect_match(fila(d2, "Selección de viviendas"), "fijo de 3 viviendas")
  expect_identical(fila(d2, "Reemplazo de rutas"), "1 manzana de reemplazo por titular")
})

test_that("F37: con las cuotas sin repartir por ficha el informe no dice que cada ruta sigue la cuota del distrito", {
  fila <- function(d) d$decisiones[d$decisiones$`Decisión` == "Selección de personas", ]$`Justificación`
  cfg <- .u16_config("legado", 1)
  expect_match(fila(reporte_mt_diseno_modelo(cfg, NULL, muestra = list(rutas = 1, entrevistas = 8, cuotas_repartidas = FALSE))), "la misma cuota en todas las rutas")
  expect_match(fila(reporte_mt_diseno_modelo(cfg, NULL, muestra = list(rutas = 1, entrevistas = 8, cuotas_repartidas = TRUE))), "^Cada ruta completa sus totales")
  expect_match(fila(reporte_mt_diseno_modelo(cfg, NULL)), "^Cada ruta completa sus totales")
})
