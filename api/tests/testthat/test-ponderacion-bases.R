# GET /api/analitica/ponderacion/bases: ponderación declarada de TODAS las
# bases, con la misma regla que .armz_ponderar (sin `enabled` = no declarada;
# `enabled: false` = declarada sin ponderar), sin cambiar la activa ni mutar
# la sesión.

.pbs_session <- function(topology = "separate", activa = "b2025") {
  sid <- session_create()
  estudio_ensure(sid)
  s <- session_get(sid)
  for (b in c("b2024", "b2025", "b2026")) {
    s$estudio$bases[[b]] <- list(nombre = b, data_ext = "xlsx")
  }
  s$estudio$active_base <- activa
  .session_env[[sid]] <- s
  if (!is.null(topology)) estudio_set_topology(sid, topology)
  sid
}

.pbs_config <- function(sid) {
  session_set(sid, "analitica_config_por_base", list(
    b2024 = list(ponderacion = list(enabled = TRUE, modo = "columna",
                                    peso_columna = "factor_ponderacion")),
    b2025 = list(secciones = list()),
    b2026 = list(ponderacion = list(enabled = FALSE, modo = "columna",
                                    peso_columna = "factor_ponderacion"))
  ))
  session_set(sid, "project_dirty", FALSE)
}

test_that("lee la ponderación de todas las bases sin cambiar la activa ni mutar", {
  sid <- .pbs_session()
  on.exit(session_delete(sid), add = TRUE)
  .pbs_config(sid)
  antes <- session_get(sid)

  out <- ponderacion_bases_estado(sid)

  expect_true(out$ok)
  expect_setequal(names(out$bases), c("b2024", "b2025", "b2026"))
  expect_identical(out$bases$b2024, list(declarada = TRUE, enabled = TRUE,
                                         modo = "columna",
                                         peso_columna = "factor_ponderacion",
                                         columnas_peso = list()))
  # La activa (b2025) no declara: no hereda de b2024.
  expect_identical(out$bases$b2025, list(declarada = FALSE, enabled = NA,
                                         modo = NA_character_,
                                         peso_columna = NA_character_,
                                         columnas_peso = list()))
  expect_identical(out$bases$b2026, list(declarada = TRUE, enabled = FALSE,
                                         modo = NA_character_,
                                         peso_columna = NA_character_,
                                         columnas_peso = list()))

  despues <- session_get(sid)
  expect_identical(estudio_active_base(sid), "b2025")
  expect_identical(despues, antes)
  expect_false(isTRUE(despues$project_dirty))
})

test_that("la activa con columna declarada se lee igual; calibración sin modo", {
  sid <- .pbs_session(activa = "b2024")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    b2024 = list(ponderacion = list(enabled = TRUE, modo = "columna",
                                    peso_columna = "w")),
    b2025 = list(ponderacion = list(enabled = TRUE,
                                    design = list(var = "sexo",
                                                  pop_sizes = list(F = 10, M = 10))))
  ))
  out <- ponderacion_bases_estado(sid)
  expect_identical(out$bases$b2024$modo, "columna")
  expect_identical(out$bases$b2024$peso_columna, "w")
  expect_identical(out$bases$b2025$modo, "calibracion")
  expect_true(is.na(out$bases$b2025$peso_columna))
  expect_false(out$bases$b2026$declarada)
  expect_identical(estudio_active_base(sid), "b2024")
})

# Dos bases con data real: «2025» trae `factor_ponderacion` numérica sin
# declarar (y una `pond_nota` de texto que no es peso); «2026» no trae peso.
.pbs_session_con_data <- function() {
  sid <- session_create()
  inst <- list(
    survey = data.frame(type = c("select_one sexo", "text"), name = c("sexo", "pond_nota"),
                        label = c("Sexo", "Nota"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
                         stringsAsFactors = FALSE)
  )
  d25 <- data.frame(sexo = rep(c("1", "2"), 5L), pond_nota = rep(c("alto", "bajo"), 5L),
                    factor_ponderacion = seq(0.5, 1.4, by = 0.1), stringsAsFactors = FALSE)
  d26 <- data.frame(sexo = rep(c("1", "2"), 5L), pond_nota = rep(c("alto", "bajo"), 5L),
                    stringsAsFactors = FALSE)
  .bv_add_base(sid, "2025", inst, .bv_xlsx_bytes(list(data = d25)), "data_2025.xlsx", "xlsx")
  .bv_add_base(sid, "2026", inst, .bv_xlsx_bytes(list(data = d26)), "data_2026.xlsx", "xlsx")
  estudio_active_base_set(sid, "2026")
  sid
}

test_that("columnas_peso: la columna numérica con nombre de peso sin declarar, y [] si la base no la trae", {
  skip_if_not_installed("openxlsx")
  sid <- .pbs_session_con_data()
  on.exit(session_delete(sid), add = TRUE)
  antes <- digest::digest(session_get(sid))

  out <- ponderacion_bases_estado(sid)

  expect_false(out$bases$`2025`$declarada)
  expect_identical(out$bases$`2025`$columnas_peso, list("factor_ponderacion"))
  expect_false(out$bases$`2026`$declarada)
  expect_identical(out$bases$`2026`$columnas_peso, list())
  # Arreglo JSON también con uno o cero elementos.
  json <- jsonlite::toJSON(out, auto_unbox = TRUE, null = "null", na = "null")
  expect_match(json, '"columnas_peso":["factor_ponderacion"]', fixed = TRUE)
  expect_match(json, '"columnas_peso":[]', fixed = TRUE)
  # Lee las dos bases sin cambiar la activa ni mutar la sesión.
  expect_identical(.estudio_active_base_name(session_get(sid)), "2026")
  expect_identical(digest::digest(session_get(sid)), antes)
})

test_that("contrato HTTP: ruta GET montada, JSON con null y sin sesión E_NO_SESSION", {
  fuente <- paste(deparse(body(build_plumber_app)), collapse = " ")
  expect_match(fuente, "mount_ponderacion_bases(pr)", fixed = TRUE)

  sid <- .pbs_session()
  on.exit(session_delete(sid), add = TRUE)
  .pbs_config(sid)

  # Mismo serializador que build_plumber_app (na = "null"), fijado ANTES de montar.
  pr <- mount_ponderacion_bases(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  rutas <- vapply(pr$endpoints[[1]], function(e) paste(e$verbs, e$path), character(1))
  expect_true("GET /api/analitica/ponderacion/bases" %in% rutas)

  llamar <- function(sid_header) {
    req <- new.env()
    req$REQUEST_METHOD <- "GET"
    req$PATH_INFO <- "/api/analitica/ponderacion/bases"
    req$QUERY_STRING <- ""
    # GET sin body: stream de entrada vacío (Rook no es dependencia).
    req$rook.input <- list(read = function(...) raw(0), rewind = function() invisible(0L),
                           read_lines = function(...) character(0))
    if (!is.null(sid_header)) req$HTTP_X_PULSO_SESSION <- sid_header
    pr$call(req)
  }

  r <- llamar(sid)
  expect_identical(as.integer(r$status), 200L)
  j <- jsonlite::fromJSON(r$body, simplifyVector = FALSE)
  expect_true(j$ok)
  expect_identical(j$bases$b2024$modo, "columna")
  expect_identical(j$bases$b2024$peso_columna, "factor_ponderacion")
  expect_identical(j$bases$b2024$columnas_peso, list())
  expect_false(j$bases$b2025$declarada)
  expect_null(j$bases$b2025$enabled)
  expect_true("enabled" %in% names(j$bases$b2025))
  expect_identical(j$bases$b2026$enabled, FALSE)
  expect_null(j$bases$b2026$modo)
  expect_identical(estudio_active_base(sid), "b2025")

  sin <- llamar(NULL)
  expect_identical(as.integer(sin$status), 404L)
  expect_identical(jsonlite::fromJSON(sin$body)$error$code %||%
                     jsonlite::fromJSON(sin$body)$code, "E_NO_SESSION")
})

# Una base con una columna llamada exactamente `peso` que no es numérica (coma
# decimal tecleada) u otra toda vacía: `.armz_ponderar` bloquea por su sola
# existencia, así que `columnas_peso` tiene que traerla para que la UI ofrezca
# declarar esa base.
.pbs_session_peso_raro <- function(peso_25, peso_26) {
  sid <- session_create()
  inst <- list(
    survey = data.frame(type = "select_one sexo", name = "sexo", label = "Sexo",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
                         stringsAsFactors = FALSE)
  )
  d25 <- data.frame(sexo = c("1", "2"), peso = peso_25, stringsAsFactors = FALSE)
  d26 <- data.frame(sexo = c("1", "2"), peso = peso_26, stringsAsFactors = FALSE)
  .bv_add_base(sid, "2025", inst, .bv_xlsx_bytes(list(data = d25)), "data_2025.xlsx", "xlsx")
  .bv_add_base(sid, "2026", inst, .bv_xlsx_bytes(list(data = d26)), "data_2026.xlsx", "xlsx")
  estudio_active_base_set(sid, "2026")
  sid
}

test_that("columnas_peso trae la columna `peso` exacta aunque no sea numérica o esté vacía", {
  skip_if_not_installed("openxlsx")
  sid <- .pbs_session_peso_raro(c("1,25", "0,8"), c(NA, NA))
  on.exit(session_delete(sid), add = TRUE)
  out <- ponderacion_bases_estado(sid)
  expect_identical(out$bases$`2025`$columnas_peso, list("peso"))
  expect_identical(out$bases$`2026`$columnas_peso, list("peso"))
  # Y son justo las bases que el comparativo bloquea sin declaración.
  s <- session_get(sid)
  for (b in c("2025", "2026")) {
    df <- .analitica_read_pair(.analitica_pair_for_base(s, s$estudio$bases[[b]], "adaptados", b),
                               s$estudio$bases[[b]])$data
    expect_true("peso" %in% names(df))
    err <- tryCatch(.armz_ponderar(sid, b, df, .analitica_default_config()),
                    api_error = function(e) e)
    expect_identical(err$code, "E_ARMONIZADA_PESO_NO_DECLARADO")
  }
})
