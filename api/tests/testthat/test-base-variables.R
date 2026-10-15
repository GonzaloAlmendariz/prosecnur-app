# ADR 0106: cada base declara sus variables propias —columnas que trae y el
# XLSForm no declara— y variables que se calculan en ella; una base se puede
# marcar «ya viene codificada»; la carga manual acepta preguntas retiradas.
# Fixtures en helper-base-variables.R (HSyVbG en miniatura: 2026 xlsx, 2024 .sav).

.bv_opciones <- function(...) {
  x <- c(...)
  lapply(seq_along(x), function(i) list(codigo = names(x)[[i]], etiqueta = x[[i]]))
}

.bv_declarar_p12 <- function(sid) {
  base_variables_declarar(sid, "2026", declarar = list(list(
    name = "P12_R", label = "Tramo P12", tipo = "select_one",
    opciones = .bv_opciones("1" = "Bajo", "2" = "Medio", "3" = "Alto"))))
}

.bv_recurrio <- list(nombre = "recurrio", etiqueta = "Recurrió a alguna instancia",
                     regla = "alguna", variables = list("q1", "q2"), codigos = list("1"))

# --- Detector -------------------------------------------------------------------

test_that("en un Excel detecta las columnas propias y propone opciones si hay 30 o menos valores", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  r <- base_variables_consultar(sid, "2026")
  por <- stats::setNames(r$extras, vapply(r$extras, `[[`, "", "name"))
  # `_uuid` es metadato y q1..q3 son del instrumento: no son propias.
  expect_identical(names(por), c("facultad", "P12_R", "indice"))
  expect_identical(por$facultad$tipo, "select_one")
  expect_setequal(vapply(por$facultad$opciones, `[[`, "", "codigo"), c("Ciencias", "Derecho", "Letras"))
  expect_identical(vapply(por$P12_R$opciones, `[[`, "", "codigo"), c("1", "2", "3"))
  # 40 valores distintos: no se proponen como opciones.
  expect_identical(por$indice$tipo, "decimal")
  expect_length(por$indice$opciones, 0L)
  expect_identical(por$indice$n_validos, 40L)
  expect_false(any(vapply(r$extras, `[[`, NA, "declarada")))
  expect_false(r$ya_codificada)
  expect_length(r$calculadas, 0L)
})

test_that("en un .sav la etiqueta y las opciones salen del archivo", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  r <- base_variables_consultar(sid, "2024")
  expect_identical(vapply(r$extras, `[[`, "", "name"), "indice_vbg")
  e <- r$extras[[1]]
  expect_identical(e$label, "Índice de VBG")
  expect_identical(e$tipo, "select_one")
  expect_identical(vapply(e$opciones, `[[`, "", "etiqueta"), c("Bajo", "Medio", "Alto"))
})

test_that("la propuesta de una columna .sav con sólo especiales etiquetados es numérica", {
  skip_if_not_installed("haven")
  x <- haven::labelled(c(19, 22, 99, 40), labels = c("No responde" = 99), label = "Edad")
  p <- base_variables_proponer(x, "edad")
  expect_identical(p$tipo, "integer")
  expect_identical(p$label, "Edad")
})

# --- Declarar -----------------------------------------------------------------

test_that("declarar una columna la lleva al instrumento de la base sin tocar el XLSForm ni la hermana", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  s0 <- session_get(sid)
  xls_path <- s0$files[[s0$estudio$bases[["2026"]]$xlsform_file_id]]$path
  md5_antes <- unname(tools::md5sum(xls_path))

  out <- .bv_declarar_p12(sid)
  expect_true(isTRUE(out$extras[[which(vapply(out$extras, `[[`, "", "name") == "P12_R")]]$declarada))
  expect_identical(unname(tools::md5sum(xls_path)), md5_antes)

  s <- session_get(sid)
  sv <- s$rp_inst_sources[["2026"]]$survey
  expect_true("P12_R" %in% sv$name)
  ln <- sv$list_name[sv$name == "P12_R"]
  ch <- s$rp_inst_sources[["2026"]]$choices
  expect_identical(as.character(ch$label[ch$list_name == ln]), c("Bajo", "Medio", "Alto"))
  # La hermana sigue con su instrumento.
  expect_false("P12_R" %in% s$rp_inst_sources[["2024"]]$survey$name)
  expect_identical(s$estudio$bases[["2024"]]$variables_propias, NULL)

  # Quitarla la saca del instrumento.
  q <- base_variables_declarar(sid, "2026", quitar = list("P12_R", "nada"))
  expect_false("P12_R" %in% session_get(sid)$rp_inst_sources[["2026"]]$survey$name)
  expect_true("no_declarada" %in% vapply(q$avisos, `[[`, "", "codigo"))
})

test_that("declarar valida nombre, tipo y opciones con códigos E_BASE_VARIABLE_*", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  err <- function(expr) tryCatch(expr, api_error = function(e) e)
  e1 <- err(base_variables_declarar(sid, "2026", list(list(name = "q1", tipo = "text"))))
  expect_identical(c(e1$code, as.character(e1$status)), c("E_BASE_VARIABLE_DUPLICADA", "409"))
  e2 <- err(base_variables_declarar(sid, "2026", list(list(name = "no_existe", tipo = "text"))))
  expect_identical(e2$code, "E_BASE_VARIABLE_INEXISTENTE")
  e3 <- err(base_variables_declarar(sid, "2026", list(list(name = "facultad", tipo = "lista"))))
  expect_identical(e3$code, "E_BASE_VARIABLE_TIPO_INVALIDO")
  e4 <- err(base_variables_declarar(sid, "2026", list(list(name = "facultad", tipo = "select_one"))))
  expect_identical(e4$code, "E_BASE_VARIABLE_ESCALA_VACIA")
  e5 <- err(base_variables_consultar(sid, ""))
  expect_identical(e5$code, "E_BASE_REQUIRED")
})

test_that("declarar invalida la lectura memoizada: la firma cambia y la relectura trae la columna", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  firma_y_lectura <- function() {
    s <- session_get(sid)
    meta <- s$estudio$bases[["2026"]]
    pair <- .analitica_pair_for_base(s, meta, "originales", "2026")
    list(firma = .analitica_lectura_signature(pair, meta), lectura = .analitica_read_pair(pair, meta))
  }
  antes <- firma_y_lectura()
  expect_false("P12_R" %in% antes$lectura$inst$survey$name)
  .bv_declarar_p12(sid)
  despues <- firma_y_lectura()
  expect_false(identical(antes$firma, despues$firma))
  expect_true("P12_R" %in% despues$lectura$inst$survey$name)
  expect_true("P12_R" %in% names(despues$lectura$data))
})

# --- Calculadas ---------------------------------------------------------------

test_that("alguna vale 1 / 0 / NA como el indicador compuesto, especiales incluidos", {
  df <- data.frame(a = c("1", "2", "99", NA, "2", "98"),
                   b = c("2", "1", "99", NA, NA, "2"), stringsAsFactors = FALSE)
  v <- base_variables_calcular(df, list(nombre = "x", regla = "alguna", variables = list("a", "b"),
                                        codigos = list("1")))
  # 1 si alguna tiene 1; 0 si hay una válida no especial; NA vacío o sólo especiales.
  expect_identical(as.numeric(v), c(1, 1, NA, NA, 0, 0))
  # Igual que `.equiv_deriv_valor` del ADR 0105.
  expect_identical(as.character(v), .equiv_deriv_valor(df, c("a", "b"), "1"))
})

test_that("alguna mira dentro de una opción múltiple", {
  df <- data.frame(m = c("2 1", "2 3", "99", NA), stringsAsFactors = FALSE)
  v <- base_variables_calcular(df, list(nombre = "x", regla = "alguna", variables = list("m"),
                                        codigos = list("1")))
  expect_identical(as.numeric(v), c(1, 0, NA, NA))
})

test_that("recodificar lleva varios códigos a uno y lo no mapeado queda NA", {
  df <- data.frame(p = c(1, 2, 3, 4, NA, 99))
  cv <- list(nombre = "p_r", regla = "recodificar", variables = list("p"),
             mapa = list("1" = "1", "2" = "1", "3" = "2", "99" = "99"),
             escala = .bv_opciones("1" = "Bajo", "2" = "Alto", "99" = "No responde"))
  expect_identical(as.numeric(base_variables_calcular(df, cv)), c(1, 1, 2, NA, NA, 99))
})

test_that("validar una calculada corta con su código cada caso inválido", {
  ocupados <- c("q1", "q2", "facultad")
  columnas <- c("q1", "q2", "facultad")
  err <- function(cv) tryCatch(base_variables_validar_calculada(cv, columnas, ocupados),
                               api_error = function(e) e$code)
  expect_identical(err(list(nombre = "q1", regla = "alguna", variables = list("q2"), codigos = list("1"))),
                   "E_BASE_VARIABLE_DUPLICADA")
  # Sin mayúsculas ni separadores: la normalización renombraría `Facultad` a ella.
  expect_identical(err(list(nombre = "Facul_tad", regla = "alguna", variables = list("q2"),
                            codigos = list("1"))), "E_BASE_VARIABLE_DUPLICADA")
  expect_identical(err(list(nombre = "1x", regla = "alguna")), "E_BASE_VARIABLE_NOMBRE_INVALIDO")
  expect_identical(err(list(nombre = "x", regla = "suma", variables = list("q1"))),
                   "E_BASE_VARIABLE_REGLA_DESCONOCIDA")
  expect_identical(err(list(nombre = "x", regla = "alguna", variables = list("zz"), codigos = list("1"))),
                   "E_BASE_VARIABLE_INEXISTENTE")
  expect_identical(err(list(nombre = "x", regla = "alguna", variables = list("q1"))),
                   "E_BASE_VARIABLE_REGLA_INCOMPLETA")
  expect_identical(err(list(nombre = "x", regla = "recodificar", variables = list("q1"),
                            mapa = list("1" = "1"))), "E_BASE_VARIABLE_ESCALA_VACIA")
  expect_identical(err(list(nombre = "x", regla = "recodificar", variables = list("q1"),
                            mapa = list("1" = "7"), escala = .bv_opciones("1" = "Sí"))),
                   "E_BASE_VARIABLE_MAPA_INVALIDO")
  ok <- base_variables_validar_calculada(list(nombre = "x", regla = "alguna", variables = list("q1"),
                                              codigos = list("1")), columnas, ocupados)
  expect_identical(vapply(ok$escala, `[[`, "", "codigo"), c("1", "0"))
})

test_that("una calculada se materializa al leer la base y entra al instrumento con su escala", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  out <- base_variables_guardar_calculada(sid, "2026", .bv_recurrio)
  n <- stats::setNames(vapply(out$resumen$por_codigo, `[[`, 0L, "n"),
                       vapply(out$resumen$por_codigo, `[[`, "", "codigo"))
  # Ciclo de 5: (1,2)->1 (2,1)->1 (2,2)->0 (99,99)->NA (NA,NA)->NA, 8 vueltas.
  expect_identical(n[["1"]], 16L)
  expect_identical(n[["0"]], 8L)
  expect_identical(out$resumen$n_sin_dato, 16L)
  s <- session_get(sid)
  expect_identical(as.numeric(table(s$rp_data_sources[["2026"]]$recurrio)), c(8, 16))
  sv <- s$rp_inst_sources[["2026"]]$survey
  expect_identical(sv$type[sv$name == "recurrio"], "select_one")
  # El archivo de data no se reescribió: la columna no está en él.
  dat_path <- s$files[[s$estudio$bases[["2026"]]$data_file_id]]$path
  expect_false("recurrio" %in% names(readxl::read_excel(dat_path)))

  # Reemplazar por nombre y borrar.
  base_variables_guardar_calculada(sid, "2026", modifyList(.bv_recurrio, list(codigos = list("2"))))
  expect_length(session_get(sid)$estudio$bases[["2026"]]$variables_calculadas, 1L)
  base_variables_quitar_calculada(sid, "2026", "recurrio")
  expect_length(session_get(sid)$estudio$bases[["2026"]]$variables_calculadas, 0L)
  expect_identical(tryCatch(base_variables_quitar_calculada(sid, "2026", "recurrio"),
                            api_error = function(e) e$code), "E_BASE_VARIABLE_NO_ENCONTRADA")
})

# --- Consumidores -------------------------------------------------------------

test_that("Analítica lista y lee las declaradas y calculadas de la base activa", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  .bv_declarar_p12(sid)
  base_variables_guardar_calculada(sid, "2026", .bv_recurrio)
  out <- .bv_call(mount_analitica, "GET", "/api/analitica/variables", sid)
  vars <- stats::setNames(out$variables, vapply(out$variables, `[[`, "", "name"))
  expect_true(all(c("P12_R", "recurrio") %in% names(vars)))
  expect_true(isTRUE(vars$P12_R$analisis))
  expect_true(isTRUE(vars$recurrio$categorica))
  # Frecuencias, cruces y exportes leen las fuentes preparadas: traen la columna.
  ctx <- .load_rp_sources(sid)
  expect_true(all(c("P12_R", "recurrio") %in% names(ctx$data_sources[["2026"]])))
  expect_false("recurrio" %in% names(ctx$data_sources[["2024"]]))
  # El volcado de la BBDD ya no las trata como extra a reconciliar.
  plan <- .reconciliacion_variables_extra(ctx$data_sources[["2026"]], ctx$inst_sources[["2026"]])
  expect_false(any(c("P12_R", "recurrio") %in% plan$name))
})

test_that("el catálogo de Equivalencias de la base trae las declaradas y calculadas", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  .bv_declarar_p12(sid)
  base_variables_guardar_calculada(sid, "2026", .bv_recurrio)
  base_variables_declarar(sid, "2024", list(list(name = "indice_vbg", label = "Índice de VBG",
                                                  tipo = "select_one",
                                                  opciones = .bv_opciones("1" = "Bajo", "2" = "Medio", "3" = "Alto"))))
  out <- .bv_call(mount_equivalencias, "GET", "/api/carga/equivalencias/variables", sid)
  n26 <- vapply(out$variables[["2026"]], `[[`, "", "name")
  n24 <- vapply(out$variables[["2024"]], `[[`, "", "name")
  expect_true(all(c("P12_R", "recurrio") %in% n26))
  expect_true("indice_vbg" %in% n24)
  expect_false("recurrio" %in% n24)
  rec <- out$variables[["2026"]][[which(n26 == "recurrio")]]
  expect_identical(vapply(rec$opciones, `[[`, "", "etiqueta"), c("Sí", "No"))
})

test_that("Codificación ve la columna declarada y no aplica sobre una base ya codificada", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  estudio_active_base_set(sid, "2026")
  expect_false("P12_R" %in% codif_inst_cached(sid, "2026")$survey$name)
  .bv_declarar_p12(sid)
  expect_true("P12_R" %in% codif_inst_cached(sid, "2026")$survey$name)

  m <- .bv_call(mount_base_variables, "POST", "/api/carga/base-variables/codificada", sid,
                body = list(base = "2026", ya_codificada = TRUE))
  expect_true(isTRUE(m$ya_codificada))
  r <- .bv_call(mount_codificacion, "POST", "/api/codificacion/aplicar", sid)
  expect_identical(r$error$code %||% r$code, "E_CODIF_BASE_YA_CODIFICADA")
  expect_match(r$error$message %||% r$message, "ya viene codificada", fixed = TRUE)
  # La hermana no quedó marcada.
  expect_false(isTRUE(session_get(sid)$estudio$bases[["2024"]]$ya_codificada))
  expect_silent(base_variables_assert_codificable(sid, "2024"))
})

# --- Persistencia -------------------------------------------------------------

test_that("declaradas, calculadas y la marca viajan en el .pulso y reabrir da lo mismo", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  .bv_declarar_p12(sid)
  base_variables_guardar_calculada(sid, "2026", .bv_recurrio)
  base_variables_marcar_codificada(sid, "2024", TRUE)
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)
  expect_true(build_pulso(sid, tmp, project_name = "Base variables")$ok)
  res <- load_pulso(tmp)
  on.exit(session_delete(res$session_id), add = TRUE)
  sid2 <- res$session_id

  r <- base_variables_consultar(sid2, "2026")
  expect_true(isTRUE(r$extras[[which(vapply(r$extras, `[[`, "", "name") == "P12_R")]]$declarada))
  expect_identical(vapply(r$calculadas, `[[`, "", "nombre"), "recurrio")
  expect_true(base_variables_consultar(sid2, "2024")$ya_codificada)
  # Las fuentes se re-derivan de los archivos más las declaraciones.
  s2 <- session_get(sid2)
  s2$rp_data_sources <- list(); s2$rp_inst_sources <- list()
  .session_env[[sid2]] <- s2
  .pulso_rebuild_estudio_runtime_sources(sid2)
  expect_true(all(c("P12_R", "recurrio") %in% estudio_inst_sources(sid2)[["2026"]]$survey$name))
  expect_identical(as.numeric(table(estudio_data_sources(sid2)[["2026"]]$recurrio)), c(8, 16))
})

# --- Carga manual con preguntas retiradas -------------------------------------

test_that("la carga manual acepta una base sin una pregunta y la registra retirada pendiente de motivo", {
  skip_if_not_installed("haven")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  xmeta <- save_upload(sid, "xlsform", "inst.xlsx", .bv_xlsx_bytes(.bv_inst_2026(extra_q = "q4")))
  dmeta <- save_upload(sid, "data", "data.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  out <- .bv_call(mount_estudio, "POST", "/api/estudio/base", sid,
                  body = list(nombre = "2026", xlsform_file_id = xmeta$file_id, data_file_id = dmeta$file_id))
  expect_true(isTRUE(out$ok))
  meta <- session_get(sid)$estudio$bases[["2026"]]
  ret <- meta$origen_externo$variables_retiradas
  expect_identical(vapply(ret, `[[`, "", "variable"), "q4")
  expect_identical(vapply(ret, `[[`, "", "motivo"), "pendiente")
  expect_identical(origen_externo_consultar(sid, "2026")$estado, "vigente")

  r <- base_variables_consultar(sid, "2026")
  expect_identical(unlist(r$retiradas), "q4")
  expect_identical(unlist(r$retiradas_pendientes), "q4")
  # Analítica lee la base: la retirada no está en su instrumento y no tumba la lectura.
  pair <- .analitica_pair_for_base(session_get(sid), meta, "originales", "2026")
  lectura <- .analitica_read_pair(pair, meta)
  expect_false("q4" %in% lectura$inst$survey$name)
  expect_identical(nrow(lectura$data), 40L)
})

test_that("una base a la que le falta más de la mitad del instrumento sigue rechazándose", {
  skip_if_not_installed("haven")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  xmeta <- save_upload(sid, "xlsform", "inst.xlsx",
                       .bv_xlsx_bytes(.bv_inst_2026(extra_q = c("q4", "q5", "q6", "q7"))))
  dmeta <- save_upload(sid, "data", "data.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  out <- .bv_call(mount_estudio, "POST", "/api/estudio/base", sid,
                  body = list(nombre = "x", xlsform_file_id = xmeta$file_id, data_file_id = dmeta$file_id))
  expect_identical(out$error$code %||% out$code, "E_DATA_XLSFORM_INCOMPATIBLE")
  expect_null(session_get(sid)$estudio$bases[["x"]])
})

# --- Contrato HTTP ----------------------------------------------------------------

test_that("contrato HTTP de /api/carga/base-variables: montado, base explícita y errores", {
  skip_if_not_installed("haven")
  expect_true(grepl("mount_base_variables(pr)", paste(deparse(body(build_plumber_app)), collapse = " "),
                    fixed = TRUE))
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  g <- .bv_call(mount_base_variables, "GET", "/api/carga/base-variables", sid, base = "2026")
  expect_true(isTRUE(g$ok))
  expect_true(all(c("base", "ya_codificada", "extras", "calculadas", "retiradas") %in% names(g)))
  sin_base <- .bv_call(mount_base_variables, "GET", "/api/carga/base-variables", sid)
  expect_identical(sin_base$error$code %||% sin_base$code, "E_BASE_REQUIRED")

  d <- .bv_call(mount_base_variables, "POST", "/api/carga/base-variables/declarar", sid,
                body = list(base = "2026", declarar = list(list(name = "facultad", label = "Facultad",
                                                                  tipo = "text"))))
  expect_true(isTRUE(d$ok))
  c1 <- .bv_call(mount_base_variables, "POST", "/api/carga/base-variables/calculada", sid,
                 body = c(list(base = "2026"), .bv_recurrio))
  expect_true(isTRUE(c1$ok))
  expect_identical(c1$calculada$nombre, "recurrio")
  # La calculada cayó en la base pedida, no en la primera ni en la activa.
  expect_length(session_get(sid)$estudio$bases[["2024"]]$variables_calculadas %||% list(), 0L)
  del <- .bv_call(mount_base_variables, "DELETE", "/api/carga/base-variables/calculada", sid,
                  base = "2026", nombre = "recurrio")
  expect_true(isTRUE(del$ok))
  del2 <- .bv_call(mount_base_variables, "DELETE", "/api/carga/base-variables/calculada", sid,
                   base = "2026", nombre = "recurrio")
  expect_identical(del2$error$code %||% del2$code, "E_BASE_VARIABLE_NO_ENCONTRADA")
  json <- jsonlite::toJSON(g, auto_unbox = TRUE, null = "null")
  expect_true(nzchar(json))
})

# --- Qué retiradas salen del instrumento (decisión del lead, 2026-10-15) ---------

.bv_variables_analitica <- function(sid) {
  out <- .bv_call(mount_analitica, "GET", "/api/analitica/variables", sid)
  vapply(out$variables, `[[`, "", "name")
}

# Base 2026 cuyo XLSForm trae q4 y cuya data no: registrada directo, como una
# base anterior a la carga tolerante, con q4 declarada retirada por `motivo`.
.bv_estudio_retirada_previa <- function(motivo) {
  sid <- session_create()
  meta <- .bv_add_base(sid, "2026", .bv_inst_2026(extra_q = "q4"),
                       .bv_xlsx_bytes(list(data = .bv_data_2026())), "data_2026.xlsx", "xlsx")
  s <- session_get(sid)
  b <- s$estudio$bases[["2026"]]
  b$origen_externo <- list(enabled = TRUE, data_file_id = b$data_file_id, casos_declarados = FALSE,
                           variables_retiradas = list(list(variable = "q4", tipo = "select_one",
                                                           motivo = motivo)))
  s$estudio$bases[["2026"]] <- b
  .session_env[[sid]] <- s
  sid
}

test_that("una retirada de motivo «otra» declarada antes sigue en Analítica y la lectura no se rompe", {
  sid <- .bv_estudio_retirada_previa("otra")
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.base_variables_retiradas(session_get(sid)$estudio$bases[["2026"]]), character(0))
  expect_true("q4" %in% .bv_variables_analitica(sid))
  meta <- session_get(sid)$estudio$bases[["2026"]]
  lectura <- .analitica_read_pair(.analitica_pair_for_base(session_get(sid), meta, "originales", "2026"), meta)
  # Llega vacía: es una pregunta que la base no trae, no un error de lectura.
  expect_true(all(is.na(lectura$data$q4)))
  # Sigue informada como retirada.
  expect_identical(unlist(base_variables_consultar(sid, "2026")$retiradas), "q4")
})

test_that("una retirada por metadato o de uso interno sí sale del instrumento", {
  sid <- .bv_estudio_retirada_previa("no_va_al_cliente")
  on.exit(session_delete(sid), add = TRUE)
  expect_false("q4" %in% .bv_variables_analitica(sid))
})

test_that("la retirada de la carga manual sale y sigue fuera aunque se redeclare el origen externo", {
  skip_if_not_installed("haven")
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # q2 es relevante sólo si q4 = 1: la pregunta retirada se cita en otra.
  xmeta <- save_upload(sid, "xlsform", "inst.xlsx",
                       .bv_xlsx_bytes(.bv_inst_2026(extra_q = "q4", relevant_q2 = "${q4} = '1'")))
  dmeta <- save_upload(sid, "data", "data.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  out <- .bv_call(mount_estudio, "POST", "/api/estudio/base", sid,
                  body = list(nombre = "2026", xlsform_file_id = xmeta$file_id, data_file_id = dmeta$file_id))
  expect_true(isTRUE(out$ok))
  vars <- .bv_variables_analitica(sid)
  expect_false("q4" %in% vars)
  expect_true("q2" %in% vars)
  meta <- session_get(sid)$estudio$bases[["2026"]]
  lectura <- .analitica_read_pair(.analitica_pair_for_base(session_get(sid), meta, "originales", "2026"), meta)
  expect_identical(nrow(lectura$data), 40L)
  expect_true("q2" %in% lectura$inst$survey$name)

  # Ponerle motivo «otra» después rehace el bloque, pero la base sigue sin q4.
  origen_externo_declarar(sid, "2026", variables_motivo = list(q4 = "otra"))
  expect_false("q4" %in% .bv_variables_analitica(sid))
  expect_identical(unlist(session_get(sid)$estudio$bases[["2026"]]$retiradas_carga_manual), "q4")
})

test_that("«pendiente» es un motivo del vocabulario y el informe lo dice con su rótulo", {
  expect_true("pendiente" %in% .ORIGEN_EXTERNO_MOTIVOS_VARIABLE)
  expect_false("pendiente" %in% .ORIGEN_EXTERNO_MOTIVOS_EXCLUYEN)
  r <- .origen_externo_resumen_variables(list(list(variable = "q4", motivo = "pendiente"),
                                              list(variable = "start", motivo = "metadato")))
  universo <- list(variables_retiradas_external = r$total,
                   variables_retiradas_external_por_motivo = r$por_motivo)
  expect_match(.vmr_universe_variables_line(universo), "1 pendiente de motivo", fixed = TRUE)
})

# --- Privacidad del detector ------------------------------------------------------

test_that("una columna de texto libre se propone como texto, sin opciones", {
  nombres <- c(sprintf("Persona %02d", 1:18), "Persona 01", "Persona 02")
  p <- base_variables_proponer(nombres, "nombre")
  expect_identical(p$tipo, "text")
  expect_length(p$opciones, 0L)
  largo <- rep(c("Sí", paste(rep("comentario", 6), collapse = " ")), 10)
  expect_identical(base_variables_proponer(largo, "comentario")$tipo, "text")
  # Texto categórico de pocos valores y numérica de pocos valores siguen siendo listas.
  expect_identical(base_variables_proponer(rep(c("Derecho", "Letras"), 10), "facultad")$tipo, "select_one")
  expect_identical(base_variables_proponer(rep(c(1, 2, 3), 7), "tramo")$tipo, "select_one")
})

test_that("alguna reduce la opción múltiple antes de evaluar: «98 99» es NA y no 0", {
  df <- data.frame(m = c("98 99", "2 98"), stringsAsFactors = FALSE)
  v <- base_variables_calcular(df, list(nombre = "x", regla = "alguna", variables = list("m"),
                                        codigos = list("1")))
  expect_identical(as.numeric(v), c(NA, 0))
  # El indicador de la matriz (ADR 0105) mira la celda entera y da 0.
  expect_identical(.equiv_deriv_valor(df, "m", "1")[[1]], "0")
})
