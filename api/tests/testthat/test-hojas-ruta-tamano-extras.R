# No respuesta, visitas e ICC del tamaño de Hojas de ruta (ADR 0116).

te_icc <- function(...) {
  e <- list(id = "acnur-2025", estudio = "ACNUR PDM 2025", indicador = "ingreso_bajo", escala = "proporcion",
            unidad_conglomerado = "ruta", definicion_conglomerado = "ruta: titular + reemplazos",
            icc = 0.06, icc_ic95 = list(0.03, 0.08), m_medio = 7.8, conglomerados = 142)
  cambios <- list(...)
  e[names(cambios)] <- cambios
  e
}

test_that("procedencia del DEFF: proyecto nuevo por declarar, guardado sin el campo es legado", {
  expect_identical(hojas_ruta_tamano_extras_normalizar(NULL)$design_effect_fuente, "por_declarar")
  expect_identical(hojas_ruta_tamano_extras_normalizar(list(design_effect = 1.5))$design_effect_fuente, "legado")
  expect_identical(hojas_ruta_tamano_extras_normalizar(list(design_effect_fuente = "manual"))$design_effect_fuente, "manual")
  # icc_biblioteca sin una entrada válida cae a manual: el DEFF no queda con una procedencia falsa.
  expect_identical(hojas_ruta_tamano_extras_normalizar(list(design_effect_fuente = "icc_biblioteca"))$design_effect_fuente, "manual")
})

test_that("el normalizador del motor conserva los campos nuevos y un proyecto existente da el mismo N", {
  ss <- .hojas_ruta_normalize_sample_size(list(design_effect = 1.4, response_rate = 0.7, ocupacion = 0.85))
  expect_identical(ss$design_effect_fuente, "legado")
  expect_equal(ss$ocupacion, 0.85)
  expect_equal(ss$design_effect, 1.4)
  # El respaldo de .hojas_ruta_design_effect_for coincide con el defecto del normalizador.
  expect_equal(.hojas_ruta_design_effect_for(list()), .hojas_ruta_normalize_sample_size(list())$design_effect)
})

test_that("las visitas salen de ceil(k/(r·e)) y el tope del 90 % nunca baja de la media", {
  expect_identical(hojas_ruta_visitas_por_ruta(8, 0.5), 16L)
  expect_identical(hojas_ruta_visitas_por_ruta(8, 0.5, 0.8), 20L)
  expect_identical(hojas_ruta_visitas_por_ruta(0, 0.5), 0L)
  cap <- hojas_ruta_visitas_cap(8, 0.5)
  expect_gte(cap, 16L)
  expect_identical(cap, 8L + as.integer(stats::qnbinom(0.9, size = 8, prob = 0.5)))
  expect_identical(hojas_ruta_visitas_cap(8, 1), 8L)
  # Respuesta en el límite: muchas visitas, sin dividir entre cero.
  expect_true(hojas_ruta_visitas_por_ruta(8, 0.01) >= 800L)
})

test_that("el salto se calcula sobre visitas y la capacidad depende del modo de salto", {
  expect_identical(hojas_ruta_salto_visitas(160, 16), 10L)
  expect_identical(hojas_ruta_salto_visitas(0, 16), 1L)
  v_cap <- hojas_ruta_visitas_cap(8, 0.5)
  expect_false(hojas_ruta_capacidad_manzana(0, 8, 0.5)$alcanza)
  expect_false(hojas_ruta_capacidad_manzana(v_cap - 1, 8, 0.5)$alcanza)
  expect_true(hojas_ruta_capacidad_manzana(v_cap, 8, 0.5)$alcanza)
  expect_false(hojas_ruta_capacidad_manzana(v_cap, 8, 0.5, modo = "manual", salto_manual = 2)$alcanza)
  expect_true(hojas_ruta_capacidad_manzana(2 * v_cap, 8, 0.5, modo = "manual", salto_manual = 2)$alcanza)
  # Con ocupación 0,5 hacen falta el doble de viviendas.
  expect_false(hojas_ruta_capacidad_manzana(v_cap, 8, 0.5, e = 0.5)$alcanza)
})

test_that("contactos esperados N/r y visitas planificadas por ruta, también con N no múltiplo de k", {
  cv <- hojas_ruta_contactos_y_visitas(list(a = 16, b = 20), k = 8, r = 0.5)
  expect_equal(cv$contactos_esperados, 72)
  # a: 2 rutas × 16 · b: 2 rutas × 16 + 1 ruta de 4 → 8 visitas.
  expect_identical(cv$visitas_planificadas, 72L)
  expect_identical(hojas_ruta_contactos_y_visitas(list(), 8, 0.5)$visitas_planificadas, 0L)
})

test_that("avisos: DEFF que ignora el conglomerado, DEFF bajo 1, rutas sin reemplazo y visitas excesivas", {
  codigos <- function(...) vapply(hojas_ruta_tamano_extras_avisos(...), `[[`, character(1), "code")
  expect_true("W_DEFF_IGNORES_CLUSTERING" %in% codigos(list(design_effect = 1, design_effect_fuente = "por_declarar"), 8, 1))
  expect_false("W_DEFF_IGNORES_CLUSTERING" %in% codigos(list(design_effect = 1, design_effect_fuente = "por_declarar"), 1, 1))
  expect_false("W_DEFF_IGNORES_CLUSTERING" %in% codigos(list(design_effect = 1.4, design_effect_fuente = "icc_biblioteca"), 8, 1))
  expect_true("W_DEFF_BELOW_ONE" %in% codigos(list(design_effect = 0.8, design_effect_fuente = "manual"), 8, 1))
  expect_true("W_UMP_NONRESPONSE_UNCOVERED" %in% codigos(list(design_effect = 1.4), 8, 0))
  expect_true("W_VISITS_HIGH" %in% codigos(list(design_effect = 1.4, response_rate = 0.1), 8, 1))
  expect_false(hojas_ruta_margen_incluye_conglomerado(list(design_effect = 1), 8))
  expect_true(hojas_ruta_margen_incluye_conglomerado(list(design_effect = 1), 1))
})

test_that("un ICC se aplica sólo con la misma unidad y escala, y con ICC en (0, 1]", {
  expect_true(hojas_ruta_icc_validar(te_icc())$ok)
  expect_match(hojas_ruta_icc_validar(te_icc(unidad_conglomerado = "aula"))$motivo, "aula")
  expect_false(hojas_ruta_icc_validar(te_icc(escala = "continua"))$ok)
  expect_false(hojas_ruta_icc_validar(te_icc(icc = 0))$ok)
  expect_false(hojas_ruta_icc_validar(te_icc(icc = 1.2))$ok)
  expect_false(hojas_ruta_icc_validar(te_icc(conglomerados = NULL))$ok)
  pocos <- hojas_ruta_icc_validar(te_icc(conglomerados = 20))
  expect_true(pocos$ok)
  expect_identical(pocos$avisos[[1]]$code, "W_ICC_FEW_CLUSTERS")
  ancho <- hojas_ruta_icc_validar(te_icc(icc = 0.02, icc_ic95 = list(0.00, 0.06)))
  expect_identical(ancho$avisos[[1]]$code, "W_ICC_FEW_CLUSTERS")
})

test_that("aplicar recalcula el DEFF con el k nuevo, copia la entrada y deja intacto lo que no aplica", {
  ss <- .hojas_ruta_normalize_sample_size(list(design_effect = 1, design_effect_overrides = list("150102" = 2)))
  r <- hojas_ruta_icc_aplicar(ss, te_icc(), k = 8)
  expect_true(r$ok)
  expect_equal(r$sample_size$design_effect, 1 + 7 * 0.06)
  expect_identical(r$sample_size$design_effect_fuente, "icc_biblioteca")
  expect_identical(r$sample_size$icc_aplicado$k_ruta, 8L)
  expect_identical(r$distritos_con_override, "150102")
  # El override del distrito sigue mandando sobre el ICC aplicado.
  expect_equal(.hojas_ruta_design_effect_for(r$sample_size, "150102"), 2)
  # La copia permite reconstruir el DEFF sin la biblioteca, tras normalizar de nuevo.
  otra <- .hojas_ruta_normalize_sample_size(r$sample_size)
  expect_identical(otra$design_effect_fuente, "icc_biblioteca")
  expect_equal(otra$icc_aplicado$deff_resultante, 1.42)
  no <- hojas_ruta_icc_aplicar(ss, te_icc(unidad_conglomerado = "aula"), k = 8)
  expect_false(no$ok)
  expect_identical(no$sample_size, ss)
})

test_that("la biblioteca local guarda, reemplaza por id y lee", {
  ruta <- tempfile(fileext = ".json")
  on.exit(unlink(ruta), add = TRUE)
  expect_length(hojas_ruta_icc_biblioteca_leer(ruta), 0)
  hojas_ruta_icc_biblioteca_guardar(te_icc(), ruta)
  hojas_ruta_icc_biblioteca_guardar(te_icc(icc = 0.07), ruta)
  hojas_ruta_icc_biblioteca_guardar(te_icc(id = "otro"), ruta)
  b <- hojas_ruta_icc_biblioteca_leer(ruta)
  expect_length(b, 2)
  expect_equal(Filter(function(e) e$id == "acnur-2025", b)[[1]]$icc, 0.07)
})

test_that("el posproceso del tamaño agrega visitas, procedencia y avisos sin tocar el N ni contacts_suggested", {
  cfg <- list(territorios = list("150102"), n_objetivo = 80, sample_size_mode = "external_total", n_mode = "total",
              entrevistas_por_manzana = 8, max_per_manzana = 8, replacements_per_titular = 0,
              sample_size = list(design_effect = 1, response_rate = 0.5))
  base <- hojas_ruta_sample_size_preview(cfg)
  r <- hojas_ruta_tamano_extras_completar(base, cfg)
  expect_identical(r$n_used, base$n_used)
  expect_identical(r$contacts_suggested, base$contacts_suggested)
  expect_identical(r$visitas$por_ruta, 16L)
  expect_equal(r$visitas$contactos_esperados, base$n_used / 0.5)
  expect_identical(r$design_effect_fuente, "legado")
  expect_false(r$margen_incluye_conglomerado)
  codigos <- vapply(r$alerts, `[[`, character(1), "code")
  expect_true(all(c("W_DEFF_IGNORES_CLUSTERING", "W_UMP_NONRESPONSE_UNCOVERED") %in% codigos))
})

test_that("HTTP: la biblioteca de ICC se lee, se guarda y se aplica sin guardar la config", {
  ruta <- tempfile(fileext = ".json")
  old <- Sys.getenv("PROSECNUR_HOJAS_RUTA_ICC", unset = NA_character_)
  Sys.setenv(PROSECNUR_HOJAS_RUTA_ICC = ruta)
  on.exit({ unlink(ruta); if (is.na(old)) Sys.unsetenv("PROSECNUR_HOJAS_RUTA_ICC") else Sys.setenv(PROSECNUR_HOJAS_RUTA_ICC = old) }, add = TRUE)
  expect_true(grepl("mount_hojas_ruta_icc(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  pr <- mount_hojas_ruta_icc(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- function(verbo, ruta) Find(function(e) identical(e$verbs, verbo) && identical(e$path, ruta), eps)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  req <- function(body = NULL) {
    r <- list(HTTP_X_PULSO_SESSION = sid)
    if (!is.null(body)) r$bodyRaw <- charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))
    r
  }
  res <- function() plumber:::PlumberResponse$new()
  expect_true(ep("POST", "/api/hojas-ruta/icc")$getFunc()(req = req(list(entrada = te_icc())), res = res())$ok)
  expect_true(ep("POST", "/api/hojas-ruta/icc")$getFunc()(req = req(list(entrada = te_icc(id = "aula", unidad_conglomerado = "aula"))), res = res())$ok)
  lista <- ep("GET", "/api/hojas-ruta/icc")$getFunc()(req = req(), res = res())
  expect_length(lista$entradas, 2)
  expect_false(Filter(function(e) e$id == "aula", lista$entradas)[[1]]$aplicable$ok)
  cfg <- list(territorios = list("150102"), entrevistas_por_manzana = 8, max_per_manzana = 8)
  ok <- ep("POST", "/api/hojas-ruta/icc/aplicar")$getFunc()(req = req(list(config = cfg, id = "acnur-2025")), res = res())
  expect_equal(ok$sample_size$design_effect, 1.42)
  no <- ep("POST", "/api/hojas-ruta/icc/aplicar")$getFunc()(req = req(list(config = cfg, id = "aula")), res = res())
  expect_identical(no$error$code %||% no$code %||% "", "E_ICC_NOT_APPLICABLE")
})
