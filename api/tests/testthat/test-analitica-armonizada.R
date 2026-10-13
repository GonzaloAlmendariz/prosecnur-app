source("setup-load-all.R")

# Contrato E4-E7 (R4 y R4b): apilado y cálculo de la serie armonizada. Fixture
# sintético de tres mediciones (sin datos de cliente) que entra por la MISMA
# ruta que las tablas anuales de Analítica: XLSForm y data subidos como
# archivos, base registrada con `estudio_add_base()` y lectura con
# `.load_rp_sources()`:
#   b2024  peso en la columna `factor_ponderacion` (modo columna). El código 7
#          de v24 no tiene mapa (sustantivo sin correspondencia).
#   b2025  peso en otra columna, `w25` (modo columna). El 99 de v25 no tiene
#          mapa (especial).
#   b2026  sin ponderar. Codificada: su par adaptado trae `lug26_agrup`, que
#          NO existe en la data original (`rp_data_sources`).
# Preguntas: VBG-01 armonizada con mapas no triviales en 2024 y 2025,
# DEN-01 no comparable en 2025 y con «No recuerda» que 2024 no ofrecía. Cruce
# S-05 «Lugar de nacimiento» con tres categorías: 2024 junta Lima y Callao y no
# ofrecía «Fuera del país» («—»).

.az_bloque <- function(lugar, resp) {
  data.frame(lug = rep(lugar, sum(resp)), v = rep(names(resp), resp), stringsAsFactors = FALSE)
}

.az_datos <- function() {
  b24 <- rbind(.az_bloque(1, c(`1` = 40, `2` = 15, `9` = 5, `7` = 2)),
               .az_bloque(2, c(`1` = 10, `2` = 10)),
               .az_bloque(3, c(`1` = 20, `2` = 90, `9` = 10)))
  b24 <- data.frame(v24 = as.numeric(b24$v), lug24 = b24$lug,
                    den24 = rep(c(1, 2, 2, 2), length.out = nrow(b24)),
                    factor_ponderacion = rep(c(0.8, 1.2), length.out = nrow(b24)))
  b25 <- rbind(.az_bloque(1, c(`10` = 50, `20` = 25, `30` = 5)),
               .az_bloque(5, c(`10` = 20, `20` = 75, `30` = 5)),
               .az_bloque(27, c(`10` = 12, `20` = 8)),
               .az_bloque(99, c(`10` = 5)),
               .az_bloque(1, c(`99` = 3)))
  b25 <- data.frame(v25 = as.numeric(b25$v), lug25 = b25$lug,
                    den25 = rep(c(1, 2), length.out = nrow(b25)),
                    w25 = rep(c(1.5, 0.5), length.out = nrow(b25)))
  b26 <- rbind(.az_bloque(1, c(`1` = 20, `2` = 25, `3` = 5)),
               .az_bloque(2, c(`1` = 10, `2` = 38, `3` = 2)),
               .az_bloque(3, c(`1` = 5, `2` = 5)))
  # Detalle original (11 Lima, 12 Callao, 21-22 regiones, 31 fuera) y su
  # agrupación de Codificación en `lug26_agrup`.
  det <- c(`1` = 11, `2` = 21, `3` = 31)[as.character(b26$lug)]
  det[b26$lug == 1 & seq_len(nrow(b26)) %% 3 == 0] <- 12
  det[b26$lug == 2 & seq_len(nrow(b26)) %% 2 == 0] <- 22
  b26 <- data.frame(v26 = as.numeric(b26$v), lug26_det = unname(det), lug26_agrup = b26$lug,
                    den26 = rep(c(1, 1, 2), length.out = nrow(b26)))
  list(b2024 = b24, b2025 = b25, b2026 = b26)
}

.az_filas <- function() {
  vbg <- list(
    id = "VBG-01", seccion = "Violencia basada en género", etiqueta_estandar = "Violencia alguna vez",
    enunciado = "¿Alguna vez en la vida has experimentado violencia basada en género?",
    variables = list(b2024 = "v24", b2025 = "v25", b2026 = "v26"),
    armonizacion = list(
      escala = list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "2", etiqueta = "No"),
                    list(codigo = "3", etiqueta = "No sé / Prefiero no decir")),
      por_base = list(
        b2024 = list(comparable = TRUE, mapa = list(`1` = "1", `2` = "2", `9` = "3")),
        b2025 = list(comparable = TRUE, mapa = list(`10` = "1", `20` = "2", `30` = "3")),
        b2026 = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))
      )))
  den <- list(
    id = "DEN-01", seccion = "Violencia basada en género", etiqueta_estandar = "Denunció",
    enunciado = "",
    variables = list(b2024 = "den24", b2025 = "den25", b2026 = "den26"),
    armonizacion = list(
      escala = list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "2", etiqueta = "No"),
                    list(codigo = "3", etiqueta = "No recuerda")),
      por_base = list(
        b2024 = list(comparable = TRUE, mapa = list(`1` = "1", `2` = "2")),
        b2025 = list(comparable = FALSE,
                     nota = "por diferencias en la redacción de la pregunta entre mediciones",
                     mapa = stats::setNames(list(), character(0))),
        b2026 = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))
      )))
  lug <- list(
    id = "S-05", seccion = "Sociodemográficas", etiqueta_estandar = "Lugar de nacimiento",
    enunciado = "¿Dónde naciste?",
    variables = list(b2024 = "lug24", b2025 = "lug25", b2026 = "lug26_agrup"),
    armonizacion = list(
      escala = list(list(codigo = "1", etiqueta = "Lima Metropolitana y Callao"),
                    list(codigo = "2", etiqueta = "Otras regiones"),
                    list(codigo = "3", etiqueta = "Fuera del país")),
      por_base = list(
        b2024 = list(comparable = TRUE,
                     nota = "El cuestionario de 2024 no incluía la opción «Fuera del país».",
                     mapa = list(`1` = "1", `2` = "1", `3` = "2")),
        b2025 = list(comparable = TRUE, mapa = list(`1` = "1", `5` = "2", `27` = "3")),
        b2026 = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))
      )))
  list(vbg, den, lug)
}

.az_notas <- function() list(
  fuente = "Pulso PUCP 2026",
  base_defecto = "total de encuestados",
  base_por_pregunta = list(`DEN-01` = "quienes experimentaron al menos una situación"),
  por_cruce = list(`S-05` = "Lugar de nacimiento: «Lima Metropolitana y Callao» incluye el Callao."),
  base_reducida = list(activo = TRUE, umbral = 30)
)

.az_pesos <- c("factor_ponderacion", "w25", "peso")

# XLSForm de una base: select_one por variable con los códigos que trae la
# data, decimal para los pesos. `sm` vuelve select_multiple a esas variables.
.az_xlsform <- function(path, df, sm = character(0)) {
  vars <- setdiff(names(df), .az_pesos)
  pesos <- intersect(names(df), .az_pesos)
  tipo <- ifelse(vars %in% sm, "select_multiple", "select_one")
  survey <- data.frame(type = c(paste0(tipo, " l_", vars), rep("decimal", length(pesos))),
                       name = c(vars, pesos), label = c(vars, pesos), stringsAsFactors = FALSE)
  choices <- do.call(rbind, lapply(vars, function(v) {
    cods <- as.character(sort(unique(df[[v]])))
    data.frame(list_name = paste0("l_", v), name = cods, label = paste("Opción", cods),
               stringsAsFactors = FALSE)
  }))
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey"); openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices"); openxlsx::writeData(wb, "choices", choices)
  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", data.frame(form_title = "Serie sintética"))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.az_subir <- function(sid, path, kind) {
  save_upload(sid, kind, basename(path), readBin(path, "raw", n = file.info(path)$size))
}

# Sesión con las tres bases registradas como en la app.
#   datos: lista de data.frames (por defecto `.az_datos()`).
#   sm: lista base -> variables que el XLSForm declara select_multiple.
#   modo: `processing_mode` del estudio. por_base: config de Analítica por base.
.az_setup <- function(env = parent.frame(), datos = .az_datos(), sm = list(),
                      modo = "multibase", por_base = NULL) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  dir <- withr::local_tempdir(.local_envir = env)
  s <- session_get(sid)
  s$estudio <- list(bases = list(), processing_mode = modo, topology_declared = "separate")
  .session_env[[sid]] <- s
  for (b in names(datos)) {
    df <- datos[[b]]
    # La data original no trae las agrupaciones de Codificación.
    orig <- df[, !grepl("_agrup$", names(df)), drop = FALSE]
    xo <- file.path(dir, paste0(b, "_form.xlsx")); do <- file.path(dir, paste0(b, "_data.xlsx"))
    .az_xlsform(xo, orig, sm[[b]] %||% character(0)); openxlsx::write.xlsx(orig, do)
    fx <- .az_subir(sid, xo, "xlsform"); fd <- .az_subir(sid, do, "data")
    inst <- reporte_instrumento(fx$path)
    estudio_add_base(sid, b, fx$file_id, fd$file_id, "xlsx",
                     rp_data = reporte_data(orig, instrumento = inst), rp_inst = inst)
    if (ncol(orig) < ncol(df)) {
      xa <- file.path(dir, paste0(b, "_form_cod.xlsx")); da <- file.path(dir, paste0(b, "_data_cod.xlsx"))
      .az_xlsform(xa, df, sm[[b]] %||% character(0)); openxlsx::write.xlsx(df, da)
      ax <- .az_subir(sid, xa, "xlsform"); ad <- .az_subir(sid, da, "data")
      s <- session_get(sid)
      s$files[[ax$file_id]]$kind <- "instrumento_adaptado"
      s$files[[ad$file_id]]$kind <- "data_adaptada"
      s$estudio$bases[[b]]$original_xlsform_file_id <- fx$file_id
      s$estudio$bases[[b]]$original_data_file_id <- fd$file_id
      s$estudio$bases[[b]]$xlsform_file_id <- ax$file_id
      s$estudio$bases[[b]]$data_file_id <- ad$file_id
      .session_env[[sid]] <- s
    }
  }
  s <- session_get(sid)
  s$estudio$active_base <- "b2026"
  s$analitica_config_por_base <- por_base %||% list(
    b2024 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "factor_ponderacion")),
    b2025 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "w25")),
    b2026 = list(ponderacion = list(enabled = FALSE))
  )
  s$equivalencias_publicos <- list(filas = .az_filas(),
                                   armonizacion_periodos = c("b2024", "b2025", "b2026"))
  .session_env[[sid]] <- s
  sid
}

test_that("el apilado pondera cada período con SU peso y aplica los mapas", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(notas = .az_notas()), filas_refs = NULL, cruces_refs = list("S-05"))
  expect_identical(ap$periodos, c("b2024", "b2025", "b2026"))
  # Sin filas pedidas: todas las armonizadas menos la que hace de cruce.
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"), c("Violencia alguna vez", "Denunció"))
  expect_identical(ap$ponderacion$b2024$peso_columna, "factor_ponderacion")
  expect_identical(ap$ponderacion$b2025$peso_columna, "w25")
  expect_false(ap$ponderacion$b2026$pondera)

  d <- .az_datos()
  m <- armonizada_modelo_frecuencias(ap)
  vbg <- m$preguntas[[1]]

  # 2024 a mano: 1 -> Sí, 2 -> No, 9 -> NS, peso factor_ponderacion. El 7 no
  # tiene mapa y sale del denominador.
  w <- d$b2024$factor_ponderacion; v <- d$b2024$v24
  esperado24 <- c(sum(w[v == 1]), sum(w[v == 2]), sum(w[v == 9]))
  expect_equal(unname(vbg$periodos$b2024$n), esperado24)
  expect_equal(vbg$periodos$b2024$N, sum(w[v != 7]))
  expect_equal(unname(vbg$periodos$b2024$pct), esperado24 / sum(w[v != 7]))

  # 2025 a mano: el código 99 no tiene mapa y sale del denominador.
  w <- d$b2025$w25; v <- d$b2025$v25
  esperado25 <- c(sum(w[v == 10]), sum(w[v == 20]), sum(w[v == 30]))
  expect_equal(unname(vbg$periodos$b2025$n), esperado25)
  expect_equal(vbg$periodos$b2025$N, sum(w[v != 99]))
  expect_equal(vbg$periodos$b2025$N_sin_peso, sum(v != 99))

  # 2026 sin peso: conteos crudos con mapa identidad.
  v <- d$b2026$v26
  expect_equal(unname(vbg$periodos$b2026$n), c(sum(v == 1), sum(v == 2), sum(v == 3)))
  expect_equal(vbg$periodos$b2026$N, length(v))

  # DEN-01: n.c. sólo en 2025.
  den <- m$preguntas[[2]]
  expect_identical(vapply(den$periodos, `[[`, "", "estado"),
                   c(b2024 = "ok", b2025 = "n.c.", b2026 = "ok"))
  expect_null(den$periodos$b2025$n)
})

test_that("los cruces marcan n.a. y «no ofrecida» por separado y las letras salen dentro del período", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  m <- armonizada_modelo_cruces(ap, alpha = 0.05)
  expect_length(m$preguntas, 1L)
  q <- m$preguntas[[1]]
  d <- .az_datos()

  # 2024: «Fuera del país» no tiene origen en el mapa: no se ofrecía (N == 0).
  c24 <- q$periodos$b2024$cruces$x1
  expect_equal(unname(c24$N_vec[3]), 0)
  expect_identical(c24$no_ofrecidas, "3")
  expect_identical(unname(c24$letras[, 3]), rep("n.a.", 3))
  # Lima junta los códigos 1 y 2 de 2024.
  w <- d$b2024$factor_ponderacion
  lima <- d$b2024$lug24 %in% c(1, 2) & d$b2024$v24 != 7
  expect_equal(unname(c24$N_vec[1]), sum(w[lima]))
  expect_equal(unname(c24$n_mat["1", 1]), sum(w[lima & d$b2024$v24 == 1]))
  expect_equal(unname(c24$N_sin_peso),
               c(sum(lima), sum(d$b2024$lug24 == 3 & d$b2024$v24 != 7), 0L))

  # Letras de 2025 = comparar_columnas_sig directo sobre la tabla de 2025 sola.
  w <- d$b2025$w25; v <- d$b2025$v25; l <- d$b2025$lug25
  cod_l <- c(`1` = 1, `2` = 5, `3` = 27)
  cod_v <- c(`1` = 10, `2` = 20, `3` = 30)
  n_mat <- outer(seq_along(cod_v), seq_along(cod_l), Vectorize(function(i, j) sum(w[v == cod_v[i] & l == cod_l[j]])))
  N_vec <- vapply(cod_l, function(cj) sum(w[l == cj & v %in% cod_v]), numeric(1))
  directo <- trimws(comparar_columnas_sig(n_mat, unname(N_vec), alpha = 0.05)$letras)
  expect_equal(unname(q$periodos$b2025$cruces$x1$letras), unname(directo))
  expect_true(any(grepl("[A-C]", directo)))  # no es un verde vacío: hay letras
  expect_identical(q$periodos$b2025$cruces$x1$no_ofrecidas, character(0))

  # Total de la pregunta en 2025 incluye el lugar sin mapa (99): N de la pregunta.
  expect_equal(q$periodos$b2025$total$N, sum(w[v != 99]))
})

# ---- R4b, revisión metodológica del 2026-10-13 ----------------------------------

test_that("R4b-1: misma fuente que Analítica, el N sin ponderar es el denominador de la tabla anual (cruce _agrup)", {
  sid <- .az_setup()
  # La data original de la sesión no tiene la agrupación de Codificación:
  # leerla de ahí (como antes de R4b) no podría cruzar por `lug26_agrup`.
  expect_false("lug26_agrup" %in% names(estudio_data_sources(sid)$b2026))
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  q <- armonizada_modelo_cruces(ap)$preguntas[[1]]

  # Tabla anual de Analítica: misma fuente, denominador_validos sin ponderar.
  src <- .load_rp_sources(sid)
  for (b in c("b2024", "b2026")) {
    rv <- .analitica_apply_data_review(src$data_sources[[b]], src$inst_sources[[b]],
                                       .armz_cfg_revision(sid, b, list()))
    anual <- rv$data
    var <- c(b2024 = "v24", b2026 = "v26")[[b]]
    lug <- c(b2024 = "lug24", b2026 = "lug26_agrup")[[b]]
    codes <- c(b2024 = list(c("1", "2", "9")), b2026 = list(c("1", "2", "3")))[[b]]
    todos <- rep(TRUE, nrow(anual))
    expect_equal(q$periodos[[b]]$total$N_sin_peso,
                 denominador_validos(anual, var, codes, "so", todos, weight_col = NULL), info = b)
    # Columna a columna del cruce, con el mapa del cruce sobre la variable anual.
    grupos <- if (b == "b2024") list(c(1, 2), 3) else list(1, 2, 3)
    for (j in seq_along(grupos)) {
      mask <- anual[[lug]] %in% grupos[[j]]
      expect_equal(unname(q$periodos[[b]]$cruces$x1$N_sin_peso[j]),
                   denominador_validos(anual, var, codes, "so", mask, weight_col = NULL),
                   info = paste(b, j))
    }
  }
  # La columna agrupada sí entró: 2026 tiene casos en las tres categorías.
  expect_true(all(q$periodos$b2026$cruces$x1$N_sin_peso > 0))
})

test_that("R4b-1: un estudio de hermanas independientes trae las bases que no son la activa", {
  sid <- .az_setup(modo = "independent_siblings")
  expect_length(.load_rp_sources(sid)$data_sources, 1L)
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  expect_identical(unique(ap$data$periodo), c("b2024", "b2025", "b2026"))
  q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_equal(q$periodos$b2025$N_sin_peso, sum(.az_datos()$b2025$v25 != 99))
})

test_that("R4b-2: una columna peso sin ponderación declarada corta, «sin ponderar» la ignora", {
  datos <- .az_datos()
  datos$b2026$peso <- rep(c(2, 0.5), length.out = nrow(datos$b2026))
  sid <- .az_setup(datos = datos, por_base = list(
    b2024 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "factor_ponderacion")),
    b2025 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "w25"))))
  # b2026 es la activa y su config (la de la corrida) no declara ponderación.
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_s3_class(e, "api_error")
  expect_equal(e$code, "E_ARMONIZADA_PESO_NO_DECLARADO")
  expect_equal(e$status, 409)
  expect_match(conditionMessage(e), "b2026", fixed = TRUE)
  expect_match(conditionMessage(e), "sin ponderar", fixed = TRUE)

  # Declarar «sin ponderar» explícito: la columna se ignora.
  ap <- .armz_preparar(sid, list(ponderacion = list(enabled = FALSE)), filas_refs = list("VBG-01"))
  expect_false(ap$ponderacion$b2026$pondera)
  expect_true(ap$ponderacion$b2026$declarada)
  q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_equal(q$periodos$b2026$N, nrow(datos$b2026))

  # Pie: cómo se ponderó cada año, agrupado por método.
  pond <- list(b2024 = list(pondera = TRUE, metodo = "columna", peso_columna = "factor_ponderacion"),
               b2025 = list(pondera = TRUE, metodo = "columna", peso_columna = "factor_ponderacion"),
               b2026 = list(pondera = FALSE, metodo = "sin_ponderar"))
  rot <- .armz_rotulos(c("b2024", "b2025", "b2026"))
  expect_identical(.comparativo_linea_ponderacion(pond, names(pond), rot),
                   "Ponderación: 2024 y 2025 por factor_ponderacion. 2026 sin ponderar.")
  expect_identical(.comparativo_linea_ponderacion(ap$ponderacion, ap$periodos, rot),
                   "Ponderación: 2024 por factor_ponderacion. 2025 por w25. 2026 sin ponderar.")
})

test_that("R4b-3: casos sin mapa por pregunta y período, sustantivos y especiales por separado", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"))
  sm <- ap$preguntas[[1]]$sin_mapa
  expect_identical(sm$b2024$n_sin_mapa, 2L)          # el 7, sustantivo
  expect_identical(sm$b2024$codigos_sin_mapa, list("7"))
  expect_identical(sm$b2025$n_sin_mapa, 0L)
  expect_identical(sm$b2025$n_especial_sin_mapa, 3L)  # el 99, especial
  av <- armonizada_avisos(ap)
  expect_length(Filter(function(a) identical(a$tipo, "sin_mapa"), av), 1L)
  expect_match(av[[1]]$mensaje, "2 casos de 2024 sin correspondencia en la escala", fixed = TRUE)
})

test_that("R4b-4: la categoría sin origen en el mapa se marca «no ofrecida», un cero observado no", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(), filas_refs = list("DEN-01"))
  den <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
  expect_identical(den$periodos$b2024$no_ofrecidas, "3")   # 2024 no ofrecía «No recuerda»
  expect_identical(den$periodos$b2026$no_ofrecidas, character(0))
  expect_equal(unname(den$periodos$b2026$n[3]), 0)         # 2026 la ofrecía y nadie la eligió
  expect_equal(unname(den$periodos$b2026$pct[3]), 0)
})

test_that("R4b-5: un mapa que no deja ningún caso es un error, no «n.a.»", {
  sid <- .az_setup()
  s <- session_get(sid)
  eq <- s$equivalencias_publicos
  eq$filas[[1]]$armonizacion$por_base$b2025$mapa <- list(`1` = "1", `2` = "2")  # códigos de otro año
  session_set(sid, "equivalencias_publicos", eq)
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_MAPA_ROTO")
  expect_equal(e$status, 409)
  expect_identical(e$details$base, "b2025")
  expect_setequal(unlist(e$details$codigos), c("10", "20", "30"))

  # Sólo especiales sin mapa (todos dijeron «no responde»): sigue siendo n.a.
  datos <- .az_datos()
  datos$b2025$v25 <- 99
  sid2 <- .az_setup(datos = datos)
  q <- armonizada_modelo_frecuencias(.armz_preparar(sid2, list(), filas_refs = list("VBG-01")))$preguntas[[1]]
  expect_identical(q$periodos$b2025$estado, "n.a.")
})

test_that("R4b-5: una variable select_multiple en cualquier base se rechaza", {
  sid <- .az_setup(sm = list(b2025 = "v25"))
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SELECT_MULTIPLE")
  expect_equal(e$status, 409)
  expect_identical(e$details$base, "b2025")
})

test_that("R4b-7: N sin ponderar cuenta peso > 0, haven_labelled y factor, suma de pesos vigilada", {
  filas <- .az_filas()[1]
  base <- data.frame(v24 = c(1, 1, 2, 9, 2), peso = c(1, 0, 2, 1, 0.5))
  lab <- base
  lab$v24 <- haven::labelled(lab$v24, c(Sí = 1, No = 2, NS = 9))
  fac <- base
  fac$v24 <- factor(fac$v24)
  b26 <- data.frame(v26 = c(1, 2, 3))
  for (caso in list(base, lab, fac)) {
    ap <- armonizada_apilar(list(b2024 = caso, b2026 = b26), filas, periodos = c("b2024", "b2026"))
    q <- armonizada_modelo_frecuencias(ap)$preguntas[[1]]
    expect_equal(unname(q$periodos$b2024$n), c(1, 2.5, 1))
    expect_equal(q$periodos$b2024$N_sin_peso, 4L)  # el caso con peso 0 no cuenta
  }

  ap <- armonizada_apilar(list(b2024 = base, b2026 = b26), filas, periodos = c("b2024", "b2026"))
  ap$ponderacion <- list(
    b2024 = list(pondera = TRUE, n = 2400, suma_pesos = 2500, razon_suma_n = 2500 / 2400),
    b2026 = list(pondera = FALSE, n = 3, suma_pesos = 3, razon_suma_n = 1))
  av <- Filter(function(a) identical(a$tipo, "suma_pesos"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_identical(av[[1]]$base, "b2024")
  expect_match(av[[1]]$mensaje, "2,500 con 2,400 casos (+4.2%)", fixed = TRUE)
  # HSyVbG 2025 (2 500 sobre 2 471, +1.2 %) queda bajo el umbral de 2 %: sin aviso.
  ap$ponderacion$b2024 <- list(pondera = TRUE, n = 2471, suma_pesos = 2500, razon_suma_n = 2500 / 2471)
  expect_length(Filter(function(a) identical(a$tipo, "suma_pesos"), armonizada_avisos(ap)), 0L)
})

test_that("rótulos: año del nombre de base, el parámetro manda", {
  expect_identical(unname(.armz_rotulos(c("b2024", "ola_b"))), c("2024", "ola_b"))
  expect_identical(unname(.armz_rotulos(c("b2024", "b2025"), list(b2025 = "2025-I"))), c("2024", "2025-I"))
  expect_identical(unname(.armz_rotulos(c("b2024", "b2025"), list("A", "B"))), c("A", "B"))
  # Dos bases del mismo año no colapsan en un rótulo: conservan su nombre.
  expect_identical(unname(.armz_rotulos(c("docentes_2024", "egresados_2024", "b2025"))),
                   c("docentes_2024", "egresados_2024", "2025"))
})

test_that("errores de dominio: sin matriz, una sola medición, fila sin armonizar", {
  sid <- .az_setup()
  s <- session_get(sid)
  e <- tryCatch(.armz_preparar(sid, list(), cruces_refs = list("NO-EXISTE")), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_FILA_NO_ENCONTRADA")

  sin_arm <- s$equivalencias_publicos
  sin_arm$filas[[2]]$armonizacion <- NULL
  session_set(sid, "equivalencias_publicos", sin_arm)
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("DEN-01")), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_SIN_ARMONIZACION")

  una <- s$equivalencias_publicos
  una$armonizacion_periodos <- c("b2024")
  session_set(sid, "equivalencias_publicos", una)
  e <- tryCatch(.armz_preparar(sid, list()), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_PERIODOS")

  session_set(sid, "equivalencias_publicos", list(filas = list()))
  e <- tryCatch(.armz_preparar(sid, list()), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SIN_MATRIZ")
})

# El job real corre en callr y necesita el paquete instalado (no se instala
# en esta oleada). Aquí el endpoint se invoca in-process y job_submit se
# reemplaza por una versión síncrona que llama al MISMO worker y al MISMO
# on_complete con el contrato de job_submit (result_path, progress_path).
.az_endpoint <- function(pr, path) {
  eps <- unlist(pr$endpoints, recursive = FALSE)
  eps[[which(vapply(eps, function(e) identical(e$path, path) && "POST" %in% e$verbs, logical(1)))]]
}

.az_llamar <- function(sid, path, body) {
  capturado <- new.env()
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    job_submit = function(sid, kind, func, args = list(), result_filename = NULL, on_complete = NULL, ...) {
      dir <- file.path(session_get(sid)$dir, "jobs"); dir.create(dir, showWarnings = FALSE, recursive = TRUE)
      args$result_path <- file.path(dir, paste0("job__", result_filename))
      args$progress_path <- file.path(dir, "job.progress")
      expect_identical(attr(func, "prosecnur_job_function_name", exact = TRUE), "armonizada_job_worker")
      data <- do.call(func, args)
      capturado$kind <- kind
      capturado$public <- on_complete(list(sid = sid, result_path = args$result_path, result_data = data))
      "job-sync"
    },
    .package = "prosecnurapp"
  )
  pr <- mount_armonizada(plumber::pr())
  ep <- .az_endpoint(pr, path)
  req <- new.env(parent = emptyenv())
  req$postBody <- jsonlite::toJSON(body, auto_unbox = TRUE)
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  list(out = out, status = as.integer(res$status), kind = capturado$kind, public = capturado$public)
}

test_that("POST /api/analitica/armonizada/cruces lanza el job y registra entregable y manifest", {
  sid <- .az_setup()
  r <- .az_llamar(sid, "/api/analitica/armonizada/cruces",
                  list(filas = list("VBG-01"), cruces = list("S-05"), rotulos_periodos = list(b2026 = "2026")))
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$out$ok))
  expect_identical(r$out$kind, "analitica.armonizada.cruces")
  expect_identical(r$kind, "analitica.armonizada.cruces")
  expect_identical(vapply(r$out$periodos, `[[`, "", "rotulo"), c("2024", "2025", "2026"))

  pub <- r$public
  roles <- vapply(pub$artifacts, `[[`, "", "role")
  expect_identical(sort(roles), c("deliverable", "manifest"))
  expect_true(all(nzchar(vapply(pub$artifacts, `[[`, "", "file_id"))))
  expect_true(all(grepl("^[0-9a-f]{64}$", vapply(pub$artifacts, `[[`, "", "sha256"))))
  files <- session_get(sid)$files
  xlsx <- files[[pub$file_id]]
  expect_true(file.exists(xlsx$path))
  expect_match(xlsx$original_name, "\\.xlsx$")
  man <- jsonlite::fromJSON(files[[pub$artifacts[[2]]$file_id]]$path, simplifyVector = FALSE)
  expect_identical(man$entregable$sha256, pub$sha256)
  expect_identical(man$periodos[[1]]$ponderacion$peso_columna, "factor_ponderacion")
  expect_identical(openxlsx::getSheetNames(xlsx$path), "Comparativo cruces")
})

test_that("POST /api/analitica/armonizada/frecuencias y cruces sin cruces", {
  sid <- .az_setup()
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(openxlsx::getSheetNames(session_get(sid)$files[[r$public$file_id]]$path), "Comparativo")
  expect_identical(r$public$resumen$n_preguntas, 3L)  # sin cruces pedidos entran las tres

  e <- tryCatch(.armonizada_submit(sid, "cruces", list(filas = list("VBG-01"))), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SIN_CRUCES")
})

test_that("R4b-8 y contrato HTTP: notas libres en el body, avisos y casos sin mapa en resumen y manifest", {
  sid <- .az_setup()
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list(
    notas_pregunta = list(`VBG-01` = "En cada medición la pregunta se refiere al año de esa encuesta",
                          `NO-EXISTE` = "Nota huérfana"),
    notas_generales = list("Los segmentos se definen igual en los tres años.")))
  expect_identical(r$status, 200L)
  pub <- r$public
  vbg <- pub$resumen$preguntas[[1]]
  expect_identical(vapply(vbg$sin_mapa, `[[`, "", "base"), c("b2024", "b2025", "b2026"))
  expect_identical(vapply(vbg$sin_mapa, `[[`, 0L, "n_sin_mapa"), c(2L, 0L, 0L))
  expect_identical(vapply(vbg$sin_mapa, `[[`, 0L, "n_especial_sin_mapa"), c(0L, 3L, 0L))
  tipos <- vapply(pub$resumen$avisos, `[[`, "", "tipo")
  expect_true(all(c("sin_mapa", "nota_sin_pregunta") %in% tipos))

  files <- session_get(sid)$files
  man <- jsonlite::fromJSON(files[[pub$artifacts[[2]]$file_id]]$path, simplifyVector = FALSE)
  expect_identical(man$preguntas[[1]]$sin_mapa[[1]]$n_sin_mapa, 2L)
  expect_identical(man$preguntas[[1]]$sin_mapa[[2]]$n_especial_sin_mapa, 3L)
  expect_identical(man$periodos[[1]]$ponderacion$metodo, "columna")
  expect_identical(man$preguntas[[1]]$sin_mapa[[2]]$codigos_especiales, list("99"))
  expect_identical(man$preguntas[[1]]$sin_mapa[[2]]$etiquetas_especiales, list("Opción 99"))
  expect_true(length(man$avisos) >= 2L)

  celdas <- openxlsx::read.xlsx(files[[pub$file_id]]$path, colNames = FALSE, skipEmptyRows = FALSE)[[1]]
  expect_true("En cada medición la pregunta se refiere al año de esa encuesta." %in% celdas)
  expect_identical(sum(celdas == "Los segmentos se definen igual en los tres años.", na.rm = TRUE), 3L)
  expect_false("Nota huérfana." %in% celdas)

  e <- tryCatch(.armonizada_submit(sid, "frecuencias", list(notas_pregunta = list("sin clave"))),
                api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_NOTAS_INVALIDAS")
  expect_equal(e$status, 400)
  e <- tryCatch(.armonizada_submit(sid, "frecuencias", list(notas_generales = list(list(a = 1)))),
                api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_NOTAS_INVALIDAS")
})

# ---- Condiciones del revisor (aprobación con supuestos, 2026-10-13) -------------

test_that("C1: «sin ponderar» declarado con columna peso avisa peso_ignorado en resumen y manifest", {
  datos <- .az_datos()
  datos$b2026$peso <- rep(c(2, 0.5), length.out = nrow(datos$b2026))
  sid <- .az_setup(datos = datos)
  s <- session_get(sid)
  s$analitica_config_por_base$b2026 <- list(ponderacion = list(enabled = FALSE))
  .session_env[[sid]] <- s
  ap <- .armz_preparar(sid, list(ponderacion = list(enabled = FALSE)), filas_refs = list("VBG-01"))
  expect_true(ap$ponderacion$b2026$peso_ignorado)
  expect_false(isTRUE(ap$ponderacion$b2024$peso_ignorado))
  av <- Filter(function(a) identical(a$tipo, "peso_ignorado"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_identical(av[[1]]$mensaje, paste(
    "La base 2026 trae una columna peso que el comparativo no usa porque la ponderación está",
    "declarada sin ponderar. Las tablas anuales sí la usan."))

  # Por el endpoint: el aviso llega al resumen del job y al manifest.
  testthat::local_mocked_bindings(.analitica_get_config = function(sid) list(ponderacion = list(enabled = FALSE)),
                                  .package = "prosecnurapp")
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list(filas = list("VBG-01")))
  expect_true("peso_ignorado" %in% vapply(r$public$resumen$avisos, `[[`, "", "tipo"))
  man <- jsonlite::fromJSON(session_get(sid)$files[[r$public$artifacts[[2]]$file_id]]$path, simplifyVector = FALSE)
  expect_true("peso_ignorado" %in% vapply(man$avisos, `[[`, "", "tipo"))
})

.az_setup_99_cubierto <- function(env = parent.frame(), datos = .az_datos()) {
  sid <- .az_setup(env, datos = datos)
  eq <- session_get(sid)$equivalencias_publicos
  # 2024 mapea su 99 a «No sé»: en 2025 el 99 sin mapa es una omisión del mapa.
  eq$filas[[1]]$armonizacion$por_base$b2024$mapa[["99"]] <- "3"
  session_set(sid, "equivalencias_publicos", eq)
  sid
}

test_that("manifest de cruces: no_ofrecidas_cruce por variable de cruce y año", {
  sid <- .az_setup()
  r <- .az_llamar(sid, "/api/analitica/armonizada/cruces", list(filas = list("VBG-01"), cruces = list("S-05")))
  expect_identical(r$public$resumen$preguntas[[1]]$no_ofrecidas_cruce,
                   list(`Lugar de nacimiento` = list(b2024 = list("3"))))
  man <- jsonlite::fromJSON(session_get(sid)$files[[r$public$artifacts[[2]]$file_id]]$path, simplifyVector = FALSE)
  expect_identical(man$preguntas[[1]]$no_ofrecidas_cruce$`Lugar de nacimiento`$b2024, list("3"))
  expect_identical(man$preguntas[[1]]$sin_mapa[[2]]$codigos_especiales, list("99"))
})

test_that("C2: un especial que otra base mapea y aquí queda sin mapa cuenta como sin correspondencia", {
  sid <- .az_setup_99_cubierto()
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"))
  sm <- ap$preguntas[[1]]$sin_mapa$b2025
  expect_identical(sm$n_sin_mapa, 3L)
  expect_identical(sm$n_especial_sin_mapa, 0L)
  expect_identical(sm$codigos_sin_mapa, list("99"))
  av <- Filter(function(a) identical(a$tipo, "sin_mapa") && identical(a$base, "b2025"), armonizada_avisos(ap))
  expect_length(av, 1L)
  rot <- .armz_rotulos(ap$periodos)
  expect_identical(.comparativo_linea_sin_mapa(ap$preguntas[[1]]$sin_mapa, ap$periodos, rot),
                   "2 casos de 2024 y 3 de 2025 sin correspondencia en la escala.")
})

test_that("C2: si sólo quedan especiales que la serie reconoce, el mapa está roto", {
  datos <- .az_datos()
  datos$b2025$v25 <- 99
  sid <- .az_setup_99_cubierto(datos = datos)
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_MAPA_ROTO")
  expect_identical(e$details$base, "b2025")
})

test_that("C3: los especiales de una variable de cruce se declaran con su etiqueta", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  x <- armonizada_modelo_cruces(ap)$cruces[[1]]
  expect_identical(x$sin_mapa$b2025$n_especial_sin_mapa, 5L)
  expect_identical(x$sin_mapa$b2025$etiquetas_especiales, list("Opción 99"))
  expect_identical(.comparativo_linea_especiales_cruce(x, ap$periodos, .armz_rotulos(ap$periodos)),
                   "5 casos de 2025 sin categoría en Lugar de nacimiento (Opción 99).")
})

test_that("c3: una base hija repeat no puede ser una medición de la serie", {
  sid <- .az_setup()
  s <- session_get(sid)
  s$estudio$bases$b2025$parent_base <- "b2024"
  s$estudio$bases$b2025$repeat_group <- "miembros"
  .session_env[[sid]] <- s
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_PERIODO_REPEAT")
  expect_equal(e$status, 409)
  expect_identical(e$details$base, "b2025")
})

test_that("c1: en hermanas, la fuente de cada base sale de su propia config", {
  sid <- .az_setup(modo = "independent_siblings")
  vistas <- list()
  testthat::local_mocked_bindings(
    .analitica_effective_source = function(s, cfg, bases = NULL) {
      vistas[[names(bases)[1]]] <<- cfg$fuente_preferida %||% ""
      "adaptados"
    }, .package = "prosecnurapp")
  s <- session_get(sid)
  s$analitica_config_por_base$b2024$fuente_preferida <- "originales"
  .session_env[[sid]] <- s
  .armz_fuentes_hermanas(sid, c("b2024", "b2025"), list(fuente_preferida = "adaptados"))
  expect_identical(vistas$b2024, "originales")
  expect_identical(vistas$b2025, "")
})

# ---- Fila sin variable en una medición (matriz importada con «(pendiente)») -----

# Deja sin variable las bases dadas de la fila `id`, con su entrada en
# `por_base` intacta (declarada comparable), como la importación de bloques.
.az_sin_variable <- function(sid, id, bases) {
  s <- session_get(sid)
  for (i in seq_along(s$equivalencias_publicos$filas)) {
    if (!identical(s$equivalencias_publicos$filas[[i]]$id, id)) next
    for (b in bases) s$equivalencias_publicos$filas[[i]]$variables[[b]] <- ""
  }
  .session_env[[sid]] <- s
  invisible(sid)
}

test_that("sin variable: 2026 sin variable sale n.c. con motivo propio y aviso, el resto del libro sale", {
  sid <- .az_setup()
  .az_sin_variable(sid, "VBG-01", "b2026")
  ap <- .armz_preparar(sid, list(notas = .az_notas()))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"),
                   c("Violencia alguna vez", "Denunció", "Lugar de nacimiento"))
  expect_length(ap$omitidas, 0L)
  m <- armonizada_modelo_frecuencias(ap)
  vbg <- m$preguntas[[1]]
  expect_identical(vapply(vbg$periodos, `[[`, "", "estado"),
                   c(b2024 = "ok", b2025 = "ok", b2026 = "n.c."))
  expect_identical(vbg$periodos$b2026$motivo, "sin_variable")
  # DEN-01 sigue no comparable en 2025 por declaración, no por falta de variable.
  expect_identical(m$preguntas[[2]]$periodos$b2025$motivo, "no_comparable")
  av <- Filter(function(a) identical(a$tipo, "sin_variable"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_identical(av[[1]][c("tipo", "base", "fila")],
                   list(tipo = "sin_variable", base = "b2026", fila = "Violencia alguna vez"))
  expect_match(av[[1]]$mensaje, "no tiene variable declarada en la matriz para 2026", fixed = TRUE)

  # Contrato HTTP: el comparativo sale (200) con las tres preguntas y el aviso.
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(r$public$resumen$n_preguntas, 3L)
  expect_true("sin_variable" %in% vapply(r$public$resumen$avisos, `[[`, "", "tipo"))
  expect_identical(r$public$resumen$preguntas[[1]]$sin_variable, list("b2026"))
  celdas <- openxlsx::read.xlsx(session_get(sid)$files[[r$public$file_id]]$path,
                                colNames = FALSE, skipEmptyRows = FALSE)[[1]]
  expect_identical(sum(celdas == "n.c.: 2026 sin variable declarada en la matriz.", na.rm = TRUE), 1L)
  expect_false(any(grepl("n.c.: no comparable.$", celdas)))
})

test_that("sin variable: una pregunta sin variable en ninguna medición se omite con aviso", {
  sid <- .az_setup()
  .az_sin_variable(sid, "DEN-01", c("b2024", "b2025", "b2026"))
  ap <- .armz_preparar(sid, list(notas = .az_notas()))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"),
                   c("Violencia alguna vez", "Lugar de nacimiento"))
  expect_identical(vapply(ap$omitidas, `[[`, "", "fila"), "Denunció")
  av <- armonizada_avisos(ap)
  tipos <- vapply(av, `[[`, "", "tipo")
  expect_identical(sum(tipos == "pregunta_omitida"), 1L)
  expect_identical(sum(tipos == "sin_variable"), 0L)  # la omitida no avisa año por año
  om <- av[[which(tipos == "pregunta_omitida")]]
  expect_identical(om$fila, "Denunció")
  expect_match(om$mensaje, "ninguna medición de la serie", fixed = TRUE)

  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(r$public$resumen$n_preguntas, 2L)
  expect_true("pregunta_omitida" %in% vapply(r$public$resumen$avisos, `[[`, "", "tipo"))

  # Si ninguna pregunta elegida tiene variable, no hay libro: 409 de dominio.
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("DEN-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SIN_FILAS")
  expect_equal(e$status, 409)
})

test_that("sin variable: un cruce sin variable en 2026 deja esa columna en n.c. con aviso", {
  sid <- .az_setup()
  .az_sin_variable(sid, "S-05", "b2026")
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  m <- armonizada_modelo_cruces(ap)
  p26 <- m$preguntas[[1]]$periodos$b2026
  expect_identical(p26$estado, "ok")  # la pregunta sí compara en 2026
  expect_identical(p26$cruces$x1$estado, "n.c.")
  expect_identical(p26$cruces$x1$motivo, "sin_variable")
  expect_identical(m$preguntas[[1]]$periodos$b2025$cruces$x1$estado, "ok")
  av <- Filter(function(a) identical(a$tipo, "sin_variable"), armonizada_avisos(ap))
  expect_identical(lapply(av, `[[`, "fila"), list("Lugar de nacimiento"))
  expect_identical(lapply(av, `[[`, "base"), list("b2026"))
})

test_that("sin variable: el preview de R3 sigue cortando con E_EQUIV_ARMONIZACION_SIN_VARIABLE", {
  sid <- .az_setup()
  .az_sin_variable(sid, "VBG-01", "b2026")
  e <- tryCatch(.equiv_armon_preview(sid, "VBG-01", "b2026"), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_ARMONIZACION_SIN_VARIABLE")
  expect_equal(e$status, 409)
})

# ---- Una fila defectuosa no tumba el libro ----------------------------------------

.az_romper_mapa <- function(sid) {
  eq <- session_get(sid)$equivalencias_publicos
  eq$filas[[1]]$armonizacion$por_base$b2025$mapa <- list(`1` = "1", `2` = "2")  # códigos de otro año
  session_set(sid, "equivalencias_publicos", eq)
  invisible(sid)
}

test_that("omitidas: con varias preguntas, la de mapa roto se omite y queda declarada en aviso, libro y manifest", {
  sid <- .az_romper_mapa(.az_setup())
  ap <- .armz_preparar(sid, list(notas = .az_notas()))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"), c("Denunció", "Lugar de nacimiento"))
  expect_length(ap$omitidas, 1L)
  o <- ap$omitidas[[1]]
  expect_identical(o[c("tipo", "fila", "motivo", "base")],
                   list(tipo = "pregunta", fila = "Violencia alguna vez", motivo = "mapa_roto", base = "b2025"))
  expect_setequal(unlist(o$codigos), c("10", "20", "30"))
  av <- Filter(function(a) identical(a$tipo, "pregunta_omitida"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_identical(av[[1]]$motivo, "mapa_roto")
  expect_identical(av[[1]]$base, "b2025")
  expect_match(av[[1]]$mensaje, "no se incluyó en el comparativo", fixed = TRUE)
  expect_match(av[[1]]$mensaje, "Ningún caso de 2025 cae en la escala", fixed = TRUE)

  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(r$public$resumen$n_preguntas, 2L)
  expect_identical(r$public$resumen$omitidas[[1]]$motivo, "mapa_roto")
  files <- session_get(sid)$files
  path <- files[[r$public$file_id]]$path
  expect_identical(openxlsx::getSheetNames(path), c("Comparativo", "Preguntas omitidas"))
  om <- openxlsx::read.xlsx(path, sheet = "Preguntas omitidas", colNames = FALSE, skipEmptyRows = FALSE)
  expect_identical(unname(unlist(om[2, 1:4])), c("Pregunta", "Uso", "Motivo", "Año"))
  expect_identical(unname(unlist(om[3, 1:4])),
                   c("¿Alguna vez en la vida has experimentado violencia basada en género?",
                     "Pregunta", "Mapa roto", "2025"))
  man <- jsonlite::fromJSON(files[[r$public$artifacts[[2]]$file_id]]$path, simplifyVector = FALSE)
  expect_identical(man$omitidas[[1]]$motivo, "mapa_roto")
  expect_identical(man$omitidas[[1]]$base, "b2025")
  expect_true("pregunta_omitida" %in% vapply(man$avisos, `[[`, "", "tipo"))
})

test_that("omitidas: sin defectos el libro no lleva la hoja de omitidas", {
  sid <- .az_setup()
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  path <- session_get(sid)$files[[r$public$file_id]]$path
  expect_identical(openxlsx::getSheetNames(path), "Comparativo")
  expect_length(r$public$resumen$omitidas, 0L)
})

test_that("omitidas: con una sola pregunta pedida el mapa roto sigue siendo 409", {
  sid <- .az_romper_mapa(.az_setup())
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_MAPA_ROTO")
  expect_equal(e$status, 409)
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list(filas = list("VBG-01")))
  expect_identical(r$status, 409L)
})

test_that("omitidas: opción múltiple se omite entre varias, y si todas son defectuosas sigue el 409", {
  sid <- .az_setup(sm = list(b2025 = "v25"))
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01", "DEN-01"))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"), "Denunció")
  expect_identical(ap$omitidas[[1]]$motivo, "select_multiple")
  expect_identical(ap$omitidas[[1]]$variable, "v25")

  sid2 <- .az_setup(sm = list(b2024 = c("v24", "den24")))
  e <- tryCatch(.armz_preparar(sid2, list(), filas_refs = list("VBG-01", "DEN-01")), api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SELECT_MULTIPLE")
  expect_equal(e$status, 409)
})

test_that("omitidas: una variable de cruce defectuosa se omite con aviso si hay otro cruce, sola es 409", {
  sid <- .az_setup(sm = list(b2024 = "lug24"))
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05", "DEN-01"))
  expect_identical(vapply(ap$cruces, `[[`, "", "etiqueta"), "Denunció")
  expect_identical(ap$omitidas[[1]][c("tipo", "fila", "motivo")],
                   list(tipo = "cruce", fila = "Lugar de nacimiento", motivo = "select_multiple"))
  av <- Filter(function(a) identical(a$tipo, "cruce_omitido"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_match(av[[1]]$mensaje, "como variable de cruce", fixed = TRUE)
  m <- armonizada_modelo_cruces(ap)
  expect_identical(names(m$preguntas[[1]]$periodos$b2024$cruces), "x2")

  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05")),
                api_error = function(e) e)
  expect_equal(e$code, "E_ARMONIZADA_SELECT_MULTIPLE")
})

# ---- Variable declarada que no está en los datos de Analítica -------------------

# Datos sin las columnas dadas por base: list(b2025 = "v25").
.az_sin_columna <- function(quitar, datos = .az_datos()) {
  for (b in names(quitar)) datos[[b]] <- datos[[b]][, setdiff(names(datos[[b]]), quitar[[b]]), drop = FALSE]
  datos
}

# Config de Analítica por base con `variables_excluidas` en las bases dadas.
.az_por_base_excluidas <- function(excluidas) {
  pb <- list(
    b2024 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "factor_ponderacion")),
    b2025 = list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = "w25")),
    b2026 = list(ponderacion = list(enabled = FALSE))
  )
  for (b in names(excluidas)) pb[[b]]$variables_excluidas <- as.list(excluidas[[b]])
  pb
}

test_that("variable ausente: excluida en Analítica en una base sale n.c. con aviso motivo excluida", {
  sid <- .az_setup(datos = .az_sin_columna(list(b2025 = "v25")),
                   por_base = .az_por_base_excluidas(list(b2025 = "v25")))
  ap <- .armz_preparar(sid, list(notas = .az_notas()))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"),
                   c("Violencia alguna vez", "Denunció", "Lugar de nacimiento"))
  expect_length(ap$omitidas, 0L)
  m <- armonizada_modelo_frecuencias(ap)
  vbg <- m$preguntas[[1]]
  expect_identical(vapply(vbg$periodos, `[[`, "", "estado"),
                   c(b2024 = "ok", b2025 = "n.c.", b2026 = "ok"))
  expect_identical(vbg$periodos$b2025[c("motivo", "causa", "variable")],
                   list(motivo = "variable_ausente", causa = "excluida", variable = "v25"))
  av <- Filter(function(a) identical(a$tipo, "variable_ausente"), armonizada_avisos(ap))
  expect_length(av, 1L)
  expect_identical(av[[1]][c("tipo", "base", "fila", "variable", "motivo")],
                   list(tipo = "variable_ausente", base = "b2025", fila = "Violencia alguna vez",
                        variable = "v25", motivo = "excluida"))
  expect_identical(av[[1]]$mensaje, paste(
    "«¿Alguna vez en la vida has experimentado violencia basada en género?»:",
    "la variable «v25» está excluida en Analítica en 2025. Ese año sale como n.c."))

  # Contrato HTTP: el comparativo sale (200) con las tres preguntas, el aviso y el pie.
  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(r$public$resumen$n_preguntas, 3L)
  expect_true("variable_ausente" %in% vapply(r$public$resumen$avisos, `[[`, "", "tipo"))
  expect_identical(r$public$resumen$preguntas[[1]]$variable_ausente,
                   list(list(base = "b2025", fila = "Violencia alguna vez", variable = "v25",
                             motivo = "excluida")))
  celdas <- openxlsx::read.xlsx(session_get(sid)$files[[r$public$file_id]]$path,
                                colNames = FALSE, skipEmptyRows = FALSE)[[1]]
  expect_identical(sum(celdas == "n.c.: la variable «v25» está excluida en Analítica en 2025.",
                       na.rm = TRUE), 1L)
})

test_that("variable ausente: la que la base no trae sale n.c. con motivo no_esta_en_la_base", {
  sid <- .az_setup(datos = .az_sin_columna(list(b2024 = "v24")))
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"))
  m <- armonizada_modelo_frecuencias(ap)
  expect_identical(m$preguntas[[1]]$periodos$b2024[c("estado", "motivo", "causa")],
                   list(estado = "n.c.", motivo = "variable_ausente", causa = "no_esta_en_la_base"))
  expect_identical(m$preguntas[[1]]$periodos$b2025$estado, "ok")
  av <- Filter(function(a) identical(a$tipo, "variable_ausente"), armonizada_avisos(ap))
  expect_identical(av[[1]][c("base", "variable", "motivo")],
                   list(base = "b2024", variable = "v24", motivo = "no_esta_en_la_base"))
  expect_match(av[[1]]$mensaje, "la variable «v24» no está en la base de 2024. Ese año sale como n.c.",
               fixed = TRUE)
  expect_false(grepl("[;·—–]", av[[1]]$mensaje))
})

test_that("variable ausente: sin ninguna medición utilizable la pregunta se omite, sola es 409", {
  datos <- .az_sin_columna(list(b2024 = "v24", b2025 = "v25", b2026 = "v26"))
  sid <- .az_setup(datos = datos, por_base = .az_por_base_excluidas(list(b2025 = "v25")))
  ap <- .armz_preparar(sid, list(notas = .az_notas()))
  expect_identical(vapply(ap$preguntas, `[[`, "", "etiqueta"), c("Denunció", "Lugar de nacimiento"))
  o <- ap$omitidas[[1]]
  expect_identical(o[c("tipo", "fila", "motivo")],
                   list(tipo = "pregunta", fila = "Violencia alguna vez", motivo = "variable_ausente"))
  expect_identical(vapply(o$ausentes, `[[`, "", "motivo"),
                   c("no_esta_en_la_base", "excluida", "no_esta_en_la_base"))
  av <- armonizada_avisos(ap)
  tipos <- vapply(av, `[[`, "", "tipo")
  expect_identical(sum(tipos == "variable_ausente"), 0L)  # la omitida no avisa año por año
  om <- av[[which(tipos == "pregunta_omitida")]]
  expect_identical(om$motivo, "variable_ausente")
  expect_match(om$mensaje, "No queda ningún año con su variable en los datos de Analítica.", fixed = TRUE)
  expect_match(om$mensaje, "La variable «v25» está excluida en Analítica en 2025.", fixed = TRUE)
  expect_false(grepl("[;·—–]", om$mensaje))

  r <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list())
  expect_identical(r$status, 200L)
  expect_identical(r$public$resumen$n_preguntas, 2L)
  expect_identical(r$public$resumen$omitidas[[1]]$motivo, "variable_ausente")
  om_x <- openxlsx::read.xlsx(session_get(sid)$files[[r$public$file_id]]$path,
                              sheet = "Preguntas omitidas", colNames = FALSE, skipEmptyRows = FALSE)
  expect_identical(om_x[3, 3], "Variable ausente en los datos")

  # Una sola pregunta pedida y ninguna medición utilizable: se mantiene el 409.
  e <- tryCatch(.armz_preparar(sid, list(), filas_refs = list("VBG-01")), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE")
  expect_equal(e$status, 409)
  r1 <- .az_llamar(sid, "/api/analitica/armonizada/frecuencias", list(filas = list("VBG-01")))
  expect_identical(r1$status, 409L)
})

test_that("variable ausente: un cruce sin ninguna medición utilizable se omite como cruce_omitido", {
  datos <- .az_sin_columna(list(b2024 = "lug24", b2025 = "lug25", b2026 = c("lug26_agrup", "lug26_det")))
  sid <- .az_setup(datos = datos)
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05", "DEN-01"))
  expect_identical(vapply(ap$cruces, `[[`, "", "etiqueta"), "Denunció")
  expect_identical(ap$omitidas[[1]][c("tipo", "fila", "motivo")],
                   list(tipo = "cruce", fila = "Lugar de nacimiento", motivo = "variable_ausente"))
  av <- Filter(function(a) identical(a$tipo, "cruce_omitido"), armonizada_avisos(ap))
  expect_identical(av[[1]]$motivo, "variable_ausente")

  # Ausente en una sola base: el cruce queda, esa columna sale n.c. con motivo propio.
  sid2 <- .az_setup(datos = .az_sin_columna(list(b2024 = "lug24")))
  ap2 <- .armz_preparar(sid2, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  m <- armonizada_modelo_cruces(ap2)
  x24 <- m$preguntas[[1]]$periodos$b2024$cruces$x1
  expect_identical(x24[c("estado", "motivo", "causa")],
                   list(estado = "n.c.", motivo = "variable_ausente", causa = "no_esta_en_la_base"))
  av2 <- Filter(function(a) identical(a$tipo, "variable_ausente"), armonizada_avisos(ap2))
  expect_identical(lapply(av2, `[[`, "fila"), list("Lugar de nacimiento"))
})

test_that("variable ausente: el preview de R3 sigue cortando con E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE", {
  sid <- .az_setup(datos = .az_sin_columna(list(b2024 = "v24")))
  e <- tryCatch(.equiv_armon_preview(sid, "VBG-01", "b2024"), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE")
  expect_equal(e$status, 409)
})
