source("setup-load-all.R")

# Contrato E4-E7 (R3): armonización de mediciones en la fila de la matriz de
# equivalencias. Serie sintética de dos mediciones de orientación sexual con
# los códigos de HSyVbG 2024/2025 (1 Heterosexual, 2 Homosexual, 3 Bisexual,
# 88 Otra, 99 No sé / Prefiero no decir). Sin datos de cliente.

.arm_inst <- function(var, lista) {
  list(
    survey = data.frame(type = paste("select_one", lista), name = var,
                        label = "Orientación sexual", list_name = lista, section = "S",
                        stringsAsFactors = FALSE),
    choices = data.frame(
      list_name = lista,
      name = c("1", "2", "3", "88", "99"),
      label = c("Heterosexual", "Homosexual (gay/lesbiana)", "Bisexual",
                "Otra orientación sexual", "No sé / Prefiero no decir"),
      stringsAsFactors = FALSE)
  )
}

.arm_setup <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(b2024 = list(nombre = "b2024"), b2025 = list(nombre = "b2025")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "b2024"
  )
  s$rp_inst_sources <- list(b2024 = .arm_inst("orientacion_sexual", "lst_or24"),
                            b2025 = .arm_inst("P4", "lst_or25"))
  s$rp_data_sources <- list(
    # 5 no está en el instrumento: código huérfano observado.
    b2024 = data.frame(orientacion_sexual = c(1, 1, 2, 3, 88, 99, NA, 5)),
    b2025 = data.frame(P4 = c(1, 2, 2, 3, 88, 99, 99))
  )
  .session_env[[sid]] <- s
  sid
}

.arm_escala <- function() list(
  list(codigo = "1", etiqueta = "Heterosexual"),
  list(codigo = "2", etiqueta = "Homosexual"),
  list(codigo = "3", etiqueta = "Bisexual"),
  list(codigo = "88", etiqueta = "Otra"),
  list(codigo = "99", etiqueta = "No responde")
)

.arm_fila <- function(armonizacion = NULL, incluir = TRUE) {
  f <- list(seccion = "Sociodemográficas", etiqueta_estandar = "Orientación sexual",
            variables = list(b2024 = "orientacion_sexual", b2025 = "P4"))
  if (incluir) f["armonizacion"] <- list(armonizacion)
  f
}

.arm_valida <- function() list(
  escala = .arm_escala(),
  por_base = list(
    # Mapa vacío = identidad.
    b2024 = list(comparable = TRUE, mapa = list()),
    # 99 queda sin mapear a propósito: debe salir NA, no caer en otra categoría.
    b2025 = list(comparable = TRUE, nota = "Misma lista.",
                 mapa = list(`1` = "1", `2` = "2", `3` = "3", `88` = "88"))
  )
)

test_that("guardar conserva y valida la armonización; la revisión la incluye", {
  sid <- .arm_setup()
  .equiv_guardar_declaracion(sid, list(.arm_fila(incluir = FALSE)))
  rev_sin <- .equiv_estado(sid)$revision

  out <- .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())),
                                    armonizacion_periodos = list("b2024", "b2025"))
  equiv <- session_get(sid)$equivalencias_publicos
  arm <- equiv$filas[[1]]$armonizacion
  expect_equal(vapply(arm$escala, `[[`, "", "codigo"), c("1", "2", "3", "88", "99"))
  expect_true(arm$por_base$b2024$comparable)
  expect_length(arm$por_base$b2024$mapa, 0L)
  expect_equal(arm$por_base$b2025$mapa[["88"]], "88")
  expect_equal(arm$por_base$b2025$nota, "Misma lista.")
  expect_equal(equiv$armonizacion_periodos, c("b2024", "b2025"))
  # El mapa vacío viaja como objeto, no como arreglo.
  expect_match(as.character(jsonlite::toJSON(arm$por_base$b2024$mapa, auto_unbox = TRUE)), "^\\{\\}$")

  rev_con <- out$estado$revision
  expect_false(identical(rev_sin, rev_con))

  # Cambiar sólo el mapa mueve la revisión.
  otra <- .arm_valida()
  otra$por_base$b2025$mapa$`99` <- "99"
  rev_otra <- .equiv_guardar_declaracion(sid, list(.arm_fila(otra)))$estado$revision
  expect_false(identical(rev_con, rev_otra))
})

test_that("una fila sin armonización deja la revisión exactamente como antes", {
  sid <- .arm_setup()
  equiv <- list(filas = list(list(etiqueta_estandar = "X", variables = list(b2024 = "orientacion_sexual"))))
  antes <- .equiv_declaracion_revision(equiv, .equiv_inst_por_base(sid))
  equiv$filas[[1]]["armonizacion"] <- list(NULL)
  expect_identical(.equiv_declaracion_revision(equiv, .equiv_inst_por_base(sid)), antes)
})

test_that("la validación rechaza armonizaciones mal formadas con E_EQUIV_ARMONIZACION_INVALIDA", {
  sid <- .arm_setup()
  casos <- list(
    base_inexistente = { a <- .arm_valida(); a$por_base$b2030 <- list(comparable = TRUE, mapa = list()); a },
    codigo_duplicado = { a <- .arm_valida(); a$escala[[2]]$codigo <- "1"; a },
    destino_fuera = { a <- .arm_valida(); a$por_base$b2025$mapa$`3` <- "7"; a },
    comparable_texto = { a <- .arm_valida(); a$por_base$b2024$comparable <- "si"; a },
    nota_no_texto = { a <- .arm_valida(); a$por_base$b2024$nota <- 3; a }
  )
  for (nm in names(casos)) {
    e <- tryCatch(.equiv_guardar_declaracion(sid, list(.arm_fila(casos[[nm]]))),
                  api_error = function(e) e)
    expect_s3_class(e, "api_error")
    expect_match(conditionMessage(e), "armonización", info = nm)
    expect_equal(e$code, "E_EQUIV_ARMONIZACION_INVALIDA", info = nm)
  }
  e <- tryCatch(.equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())),
                                           armonizacion_periodos = list("b2024", "b2099")),
                api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_ARMONIZACION_INVALIDA")
})

test_that("un editor que no conoce el campo no lo borra; null explícito sí", {
  sid <- .arm_setup()
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())),
                             armonizacion_periodos = list("b2025", "b2024"))
  # Sin la clave: se conserva por variables, y el orden de la serie también.
  .equiv_guardar_declaracion(sid, list(.arm_fila(incluir = FALSE)))
  equiv <- session_get(sid)$equivalencias_publicos
  expect_false(is.null(equiv$filas[[1]]$armonizacion))
  expect_equal(equiv$armonizacion_periodos, c("b2025", "b2024"))
  # Con la clave en null: se borra.
  .equiv_guardar_declaracion(sid, list(.arm_fila(NULL)))
  expect_null(session_get(sid)$equivalencias_publicos$filas[[1]]$armonizacion)
})

test_that("reimportar la plantilla conserva la armonización de las filas que casan por variables", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")
  sid <- .arm_setup()
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())),
                             armonizacion_periodos = list("b2024", "b2025"))
  meta <- .equiv_escribir_plantilla(sid)
  vuelta <- .equiv_importar_desde_file(sid, meta$file_id)$estado
  expect_equal(vuelta$n_filas, 1L)
  expect_equal(vuelta$filas[[1]]$armonizacion, .equiv_armon_normalizar(.arm_valida(), c("b2024", "b2025")))
  expect_equal(session_get(sid)$equivalencias_publicos$armonizacion_periodos, c("b2024", "b2025"))
})

test_that("la spec aplica identidad, deja NA los especiales sin mapear y calla si no es comparable", {
  arm <- .equiv_armon_normalizar(.arm_valida(), c("b2024", "b2025"))
  fila <- .arm_fila(arm)

  spec24 <- .equiv_armon_spec(fila, "b2024")
  expect_equal(spec24$parent, "orientacion_sexual")
  expect_equal(spec24$categorias[[4]]$codigos, list("88"))
  out24 <- equiv_armonizar_base(data.frame(orientacion_sexual = c(1, 2, 88, 99, 5, NA)), fila, "b2024")
  # Identidad: 1, 2, 88 y 99 se quedan; 5 no está en la escala -> NA.
  expect_equal(out24, c("1", "2", "88", "99", NA, NA))

  out25 <- equiv_armonizar_base(data.frame(P4 = c(1, 3, 88, 99)), fila, "b2025")
  # 99 no se mapeó en 2025: queda NA, nunca cae en otra categoría.
  expect_equal(out25, c("1", "3", "88", NA))

  no_comp <- arm
  no_comp$por_base$b2025$comparable <- FALSE
  expect_null(.equiv_armon_spec(.arm_fila(no_comp), "b2025"))
  expect_null(equiv_armonizar_base(data.frame(P4 = 1), .arm_fila(no_comp), "b2025"))
  # Sin entrada para la base: no se presume comparable.
  sin_base <- arm
  sin_base$por_base$b2025 <- NULL
  expect_null(.equiv_armon_spec(.arm_fila(sin_base), "b2025"))
  expect_null(.equiv_armon_spec(.arm_fila(NULL), "b2024"))

  e <- tryCatch(equiv_armonizar_base(data.frame(otra = 1), fila, "b2024"), api_error = function(e) e)
  expect_equal(e$code, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE")
})

test_that("el preview cuenta por código y por categoría sobre los datos reales de la base", {
  sid <- .arm_setup()
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())))

  p25 <- .equiv_armon_preview(sid, "0", "b2025")
  expect_equal(p25$variable, "P4")
  expect_true(p25$comparable)
  cods <- vapply(p25$codigos, `[[`, "", "codigo")
  expect_equal(cods, c("1", "2", "3", "88", "99"))
  expect_equal(vapply(p25$codigos, `[[`, 1L, "n"), c(1L, 2L, 1L, 1L, 2L))
  expect_equal(vapply(p25$codigos, function(x) x$armonizado, ""), c("1", "2", "3", "88", NA))
  expect_equal(vapply(p25$escala, `[[`, 1L, "n"), c(1L, 2L, 1L, 1L, 0L))
  expect_equal(p25$n_sin_mapa, 2L)
  expect_equal(p25$n_total, 7L)

  # Por etiqueta y en la otra base: el 5 observado aparece sin etiqueta y sin mapa.
  p24 <- .equiv_armon_preview(sid, "Orientación sexual", "b2024")
  cinco <- p24$codigos[[which(vapply(p24$codigos, `[[`, "", "codigo") == "5")]]
  expect_true(is.na(cinco$etiqueta))
  expect_true(is.na(cinco$armonizado))
  expect_equal(cinco$n, 1L)
  expect_equal(p24$n_sin_mapa, 1L)

  expect_equal(tryCatch(.equiv_armon_preview(sid, "7", "b2025"), api_error = function(e) e$code),
               "E_EQUIV_FILA_NO_ENCONTRADA")
  expect_equal(tryCatch(.equiv_armon_preview(sid, "0", "b2099"), api_error = function(e) e$code),
               "E_EQUIV_BASE_DESCONOCIDA")
  .equiv_guardar_declaracion(sid, list(.arm_fila(NULL)))
  expect_equal(tryCatch(.equiv_armon_preview(sid, "0", "b2025"), api_error = function(e) e$code),
               "E_EQUIV_SIN_ARMONIZACION")
})

# Contrato HTTP por el enrutador real de plumber: el parámetro de query llega por
# nombre, y el POST de la declaración transporta armonizacion_periodos.
.arm_http <- function(sid, metodo, ruta, query = "", body = NULL) {
  # Mismo serializador que la app (plumber_app.R): unboxed y NA -> null.
  pr <- plumber::pr() |>
    plumber::pr_set_serializer(.api_serializer()) |>
    mount_equivalencias()
  raw <- if (is.null(body)) raw(0) else charToRaw(enc2utf8(as.character(
    jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  req <- new.env()
  req$REQUEST_METHOD <- metodo
  req$PATH_INFO <- ruta
  req$QUERY_STRING <- query
  req$HTTP_X_PULSO_SESSION <- sid
  req$HTTP_CONTENT_TYPE <- "application/json"
  # Entrada Rook mínima: plumber sólo la rebobina y la lee.
  entrada <- new.env()
  entrada$rewind <- function() invisible(0L)
  entrada$read <- function(l = -1L) raw
  entrada$read_lines <- function(n = -1L) rawToChar(raw)
  req$rook.input <- entrada
  res <- pr$call(req)
  list(status = res$status, body = jsonlite::fromJSON(res$body, simplifyVector = FALSE))
}

test_that("contrato HTTP: POST declaración con armonización y GET preview por query", {
  sid <- .arm_setup()
  r <- .arm_http(sid, "POST", "/api/carga/equivalencias/declaracion",
                 body = list(filas = list(.arm_fila(.arm_valida())),
                             armonizacion_periodos = list("b2024", "b2025")))
  expect_equal(r$status, 200L)
  expect_equal(unlist(r$body$estado$filas[[1]]$armonizacion$por_base$b2025$mapa), c(`1` = "1", `2` = "2", `3` = "3", `88` = "88"))
  # Mapa vacío llega como objeto.
  expect_equal(length(r$body$estado$filas[[1]]$armonizacion$por_base$b2024$mapa), 0L)

  g <- .arm_http(sid, "GET", "/api/carga/equivalencias/armonizacion/preview",
                 query = "fila=0&base=b2025")
  expect_equal(g$status, 200L)
  expect_equal(g$body$n_sin_mapa, 2L)
  expect_null(g$body$codigos[[5]]$armonizado)

  g404 <- .arm_http(sid, "GET", "/api/carga/equivalencias/armonizacion/preview",
                    query = "fila=9&base=b2025")
  expect_equal(g404$status, 404L)
  expect_equal(g404$body$error$code %||% g404$body$code, "E_EQUIV_FILA_NO_ENCONTRADA")
})

test_that("el estado expone armonizacion_periodos siempre como arreglo", {
  sid <- .arm_setup()
  expect_identical(.equiv_estado(sid)$armonizacion_periodos, list())
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())))
  vacio <- .equiv_estado(sid)$armonizacion_periodos
  expect_identical(vacio, list())
  expect_equal(as.character(jsonlite::toJSON(vacio, auto_unbox = TRUE)), "[]")
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())), armonizacion_periodos = list("b2025"))
  uno <- .equiv_estado(sid)$armonizacion_periodos
  expect_equal(as.character(jsonlite::toJSON(uno, auto_unbox = TRUE)), "[\"b2025\"]")

  # Por HTTP: GET /api/carga/equivalencias.
  r <- .arm_http(sid, "GET", "/api/carga/equivalencias")
  expect_equal(r$status, 200L)
  expect_equal(r$body$armonizacion_periodos, list("b2025"))
})

test_that("armonizacion y armonizacion_periodos sobreviven intactos al .pulso", {
  sid <- .arm_setup()
  .equiv_guardar_declaracion(sid, list(.arm_fila(.arm_valida())),
                             armonizacion_periodos = list("b2025", "b2024"))
  antes <- session_get(sid)$equivalencias_publicos

  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  build_pulso(sid, tmp)
  loaded <- load_pulso(tmp)
  on.exit(session_delete(loaded$session_id), add = TRUE)

  despues <- session_get(loaded$session_id)$equivalencias_publicos
  expect_identical(despues$armonizacion_periodos, c("b2025", "b2024"))
  arm <- despues$filas[[1]]$armonizacion
  expect_identical(arm, antes$filas[[1]]$armonizacion)
  expect_equal(arm$por_base$b2025$nota, "Misma lista.")
  expect_equal(unlist(arm$por_base$b2025$mapa), c(`1` = "1", `2` = "2", `3` = "3", `88` = "88"))
  # El mapa vacío (identidad) sigue siendo un objeto con nombres, no un arreglo.
  expect_false(is.null(names(arm$por_base$b2024$mapa)))
  expect_length(arm$por_base$b2024$mapa, 0L)
  expect_identical(.equiv_declaracion_revision(despues, .equiv_inst_por_base(sid)),
                   .equiv_declaracion_revision(antes, .equiv_inst_por_base(sid)))
})
