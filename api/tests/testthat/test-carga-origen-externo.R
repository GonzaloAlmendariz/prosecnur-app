# ADR 0100, pieza P2: la base depurada fuera de la app declara de dónde viene.
#
# Caso real: HSyVBG 2026 recibió 3 327 efectivas, un script en R quitó 9
# (3 críticas y 6 ambiguas) y la base se cargó con 3 318.

.oe_lista <- function() {
  data.frame(
    `_uuid` = c("a", "b", "c"),
    Motivo = c("patrón de burla", "duración 2 min", ""),
    Categoría = c("crítico", "ambiguo", "ambiguo"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

test_that("la lista se normaliza con los nombres de columna de Kobo", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  expect_identical(ex$id, c("a", "b", "c"))
  expect_identical(ex$categoria, c("crítico", "ambiguo", "ambiguo"))
  expect_error(
    .origen_externo_normalizar_exclusiones(data.frame(x = 1)),
    class = "api_error"
  )
})

test_that("una lista que cuadra con la base no trae avisos de fondo", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("d", "e"), n_recibidas = 5L,
                                  script = "limpieza.R", version = "v3", data_file_id = "f1")
  expect_identical(out$bloque$n_recibidas, 5L)
  expect_identical(out$bloque$n_entregadas, 2L)
  expect_identical(out$bloque$n_excluidas, 3L)
  expect_false(out$bloque$n_recibidas_deducida)
  codigos <- vapply(out$avisos, `[[`, "", "codigo")
  expect_identical(codigos, "sin_motivo")
})

test_that("una exclusión que sigue en la base y un total que no cuadra se dicen", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("a", "d"), n_recibidas = 10L)
  codigos <- vapply(out$avisos, `[[`, "", "codigo")
  expect_true(all(c("siguen_en_la_base", "no_cuadra") %in% codigos))
  expect_match(out$avisos[[which(codigos == "no_cuadra")]]$mensaje, "faltan o sobran 5", fixed = TRUE)
})

test_that("sin n_recibidas se deduce y se declara deducida", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  out <- origen_externo_construir(ex, ids_base = c("d", "e"))
  expect_identical(out$bloque$n_recibidas, 5L)
  expect_true(out$bloque$n_recibidas_deducida)
})

test_that("una base recargada deja la declaración «para otra base»", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  b <- origen_externo_construir(ex, "d", data_file_id = "f1")$bloque
  expect_identical(.origen_externo_estado(b, "f1"), "vigente")
  expect_identical(.origen_externo_estado(b, "f2"), "otra_base")
  expect_identical(.origen_externo_estado(NULL, "f1"), "")
})

test_that("el resumen para la ficha lleva totales y categorías, nunca identificadores", {
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  b <- origen_externo_construir(ex, c("d", "e"), data_file_id = "f1")$bloque
  r <- .origen_externo_resumen(b)
  expect_identical(c(r$recibidas, r$excluidas, r$entregadas), c(5L, 3L, 2L))
  por <- stats::setNames(vapply(r$por_categoria, `[[`, 0L, "n"),
                         vapply(r$por_categoria, `[[`, "", "categoria"))
  expect_identical(por[["ambiguo"]], 2L)
  expect_identical(por[["crítico"]], 1L)
  expect_false(any(grepl("\"a\"|\"b\"", deparse(r))))
})

test_that("declarar sobre una sesión guarda el bloque y la respuesta no lleva identificadores", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  dir <- tempfile("oe_"); dir.create(dir)
  base_path <- file.path(dir, "base.csv")
  utils::write.csv(data.frame(`_uuid` = c("d", "e"), P1 = c(1, 2), check.names = FALSE),
                   base_path, row.names = FALSE)
  lista_path <- file.path(dir, "lista.csv")
  utils::write.csv(.oe_lista(), lista_path, row.names = FALSE, fileEncoding = "UTF-8")
  s <- session_get(sid)
  s$files <- list(
    fbase = list(file_id = "fbase", path = base_path, ext = "csv"),
    flista = list(file_id = "flista", path = lista_path, ext = "csv")
  )
  s$estudio <- list(bases = list(default = list(nombre = "default", data_file_id = "fbase")),
                    active_base = "default")
  .session_env[[sid]] <- s

  out <- origen_externo_declarar(sid, "default", file_id = "flista", n_recibidas = 5L,
                                 script = "limpieza.R")
  expect_identical(out$estado, "vigente")
  expect_identical(out$resumen$recibidas, 5L)
  expect_null(out$bloque$exclusiones)
  guardado <- session_get(sid)$estudio$bases$default$origen_externo
  expect_length(guardado$exclusiones, 3L)

  # Recargar la base deja la declaración «para otra base», no la borra.
  s <- session_get(sid); s$estudio$bases$default$data_file_id <- "otra"; .session_env[[sid]] <- s
  expect_identical(origen_externo_consultar(sid, "default")$estado, "otra_base")
})

# --- la ficha del universo ------------------------------------------------------

.oe_sesion_con_base <- function(meta) {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(bases = list(default = meta), active_base = "default")
  .session_env[[sid]] <- s
  sid
}

.oe_bloque <- function(fid = "f1", entregadas = 3318L) {
  ex <- data.frame(id = sprintf("x%d", 1:9), motivo = "sospechosa",
                   categoria = rep(c("crítico", "ambiguo"), c(3, 6)), stringsAsFactors = FALSE)
  origen_externo_construir(ex, sprintf("b%d", seq_len(entregadas)), n_recibidas = 3327L,
                           data_file_id = fid)$bloque
}

test_that("con sólo depuración externa la ficha existe y declara recibidas y retiradas fuera", {
  sid <- .oe_sesion_con_base(list(nombre = "default", data_file_id = "f1", origen_externo = .oe_bloque()))
  on.exit(session_delete(sid), add = TRUE)
  u <- .validacion_upstream_universe(sid, "default")
  expect_true(isTRUE(u$external_applied))
  expect_identical(u$received_external, 3327L)
  expect_identical(u$excluded_external, 9L)
  # `total` sigue siendo lo que la app recibió: el script de replicación lo
  # compara contra la base cargada.
  expect_identical(u$total, 3318L)
  expect_identical(u$included, 3318L)
  expect_match(paste(.vmr_universe_preparation_sentences(u), collapse = " "),
               "de 3327 encuestas recibidas se retiraron 9", fixed = TRUE)
})

test_that("el tramo externo se encadena con la limpieza de la app cuando empalma", {
  meta <- list(nombre = "default", data_file_id = "f1", origen_externo = .oe_bloque(),
               limpieza = list(enabled = TRUE, n_casos_antes = 3318L, n_casos_despues = 3300L))
  sid <- .oe_sesion_con_base(meta)
  on.exit(session_delete(sid), add = TRUE)
  u <- .validacion_upstream_universe(sid, "default")
  expect_true(isTRUE(u$external_applied))
  expect_true(isTRUE(u$cleaning_applied))
  expect_identical(c(u$total, u$included, u$excluded_cleaning), c(3318L, 3300L, 18L))
})

test_that("si no empalma o la base se recargó, el tramo externo no se inventa", {
  meta <- list(nombre = "default", data_file_id = "f1", origen_externo = .oe_bloque(),
               limpieza = list(enabled = TRUE, n_casos_antes = 3000L, n_casos_despues = 2990L))
  sid <- .oe_sesion_con_base(meta)
  on.exit(session_delete(sid), add = TRUE)
  expect_null(.validacion_upstream_universe(sid, "default")$external_applied)

  sid2 <- .oe_sesion_con_base(list(nombre = "default", data_file_id = "otra", origen_externo = .oe_bloque()))
  on.exit(session_delete(sid2), add = TRUE)
  expect_null(.validacion_upstream_universe(sid2, "default"))
})

test_that("con depuración externa las dos «recibidas» no se llaman igual", {
  u <- list(external_applied = TRUE, total = 3318L)
  expect_identical(.vmr_universe_rotulo_total(u), "encuestas cargadas a la plataforma")
  expect_identical(.vmr_universe_rotulo_total(list(total = 3318L)), "encuestas recibidas")
})

test_that("una base de SurveyMonkey o con código PULSO también se puede declarar", {
  sm <- data.frame(respondent_id = c("r1", "r2"), motivo = "x", stringsAsFactors = FALSE)
  expect_identical(.origen_externo_normalizar_exclusiones(sm)$id, c("r1", "r2"))
  expect_false(is.na(.origen_externo_col_id(c("P1", "response_id"))))
  expect_false(is.na(.origen_externo_col_id(c("P1", "Código pulso"))))
  expect_true(is.na(.origen_externo_col_id(c("P1", "P2"))))
})

test_that("la declaración sobrevive a guardar y reabrir el .pulso (y sigue vigente)", {
  bytes_xlsx <- function(df) {
    p <- tempfile(fileext = ".xlsx"); openxlsx::write.xlsx(df, p)
    on.exit(unlink(p)); readBin(p, "raw", file.info(p)$size)
  }
  sid <- session_create()
  inst <- save_upload(sid, "xlsform", "inst.xlsx", bytes_xlsx(data.frame(type = "text", name = "p1")))
  dat <- save_upload(sid, "data", "base.xlsx", bytes_xlsx(data.frame(`_uuid` = c("d", "e"), check.names = FALSE)))
  estudio_ensure(sid)
  s <- session_get(sid)
  ex <- .origen_externo_normalizar_exclusiones(.oe_lista())
  s$estudio$bases[["default"]] <- list(
    nombre = "default", xlsform_file_id = inst$file_id, data_file_id = dat$file_id, data_ext = "xlsx",
    origen_externo = origen_externo_construir(ex, c("d", "e"), n_recibidas = 5L,
                                              data_file_id = dat$file_id)$bloque
  )
  .session_env[[sid]] <- s
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)

  expect_true(build_pulso(sid, tmp, project_name = "Origen externo")$ok)
  res <- load_pulso(tmp)
  on.exit(session_delete(res$session_id), add = TRUE)

  r <- origen_externo_consultar(res$session_id, "default")
  expect_identical(r$estado, "vigente")
  expect_identical(c(r$resumen$recibidas, r$resumen$excluidas, r$resumen$entregadas), c(5L, 3L, 2L))
  expect_length(session_get(res$session_id)$estudio$bases$default$origen_externo$exclusiones, 3L)
})

# --- P2b: la base preparada fuera también puede traer menos variables -----------
#
# HSyVBG 2026: el script quitó `start` y `end`. La app detecta las variables del
# instrumento que no vinieron y la declaración les pone motivo.

.oe_survey <- function() {
  data.frame(
    type = c("start", "end", "begin_group", "text", "select_multiple sm", "text",
             "note", "calculate", "begin_repeat", "text", "end_repeat", "end_group"),
    name = c("start", "end", "grp", "P1", "P11", "si", "aviso", "calc", "rep", "Prep", "", ""),
    label = c("", "", "Grupo", "P1", "P11", "Sí", "Nota", "", "Rep", "Prep", "", ""),
    stringsAsFactors = FALSE
  )
}

test_that("detecta las faltantes con prefijo de grupo y sin contar las dummies de SM", {
  columnas <- c("_uuid", "grp/P1", "P11/1", "P11/si", "grp/P11/2", "calc")
  f <- origen_externo_variables_faltantes(.oe_survey(), columnas)
  vars <- vapply(f, `[[`, "", "variable")
  # `P1` llega como `grp/P1`. `P11` sólo trae dummies: falta. `si` es también
  # una opción de P11 y `P11/si` no es la variable `si`. La nota, el grupo y la
  # pregunta del repeat no son columnas de la base ancha.
  expect_setequal(vars, c("start", "end", "P11", "si"))
  por <- stats::setNames(vapply(f, `[[`, "", "motivo_sugerido"), vars)
  expect_identical(unname(por[c("start", "end", "P11", "si")]), c("metadato", "metadato", "", ""))
  expect_identical(f[[which(vars == "P11")]]$tipo, "select_multiple")
  # El backfill sigue sin contar los metadatos.
  expect_false("start" %in% .dn_expected_data_names(list(survey = .oe_survey())))
})

test_that("sólo se declaran faltantes; una presente o un motivo fuera de la lista se dicen", {
  f <- origen_externo_variables_faltantes(.oe_survey(), c("grp/P1", "calc"))
  v <- origen_externo_variables_retiradas(f, c("grp/P1", "calc"),
                                          list(P1 = "otra", si = "no_va_al_cliente", start = "zzz", nada = "otra"))
  codigos <- vapply(v$avisos, `[[`, "", "codigo")
  expect_true(all(c("variable_presente", "motivo_invalido") %in% codigos))
  motivos <- stats::setNames(vapply(v$retiradas, `[[`, "", "motivo"), vapply(v$retiradas, `[[`, "", "variable"))
  expect_identical(motivos[["si"]], "no_va_al_cliente")
  expect_identical(motivos[["start"]], "metadato")   # inválido: queda el sugerido
  expect_identical(motivos[["P11"]], "otra")         # sin motivo ni sugerido
  expect_false("P1" %in% names(motivos))
})

.oe_xlsx <- function(x) {
  p <- tempfile(fileext = ".xlsx"); openxlsx::write.xlsx(x, p)
  on.exit(unlink(p)); readBin(p, "raw", file.info(p)$size)
}

.oe_sesion_variables <- function() {
  sid <- session_create()
  choices <- data.frame(list_name = "sm", name = c("1", "2", "si"), label = c("Uno", "Dos", "Sí"))
  inst <- save_upload(sid, "xlsform", "inst.xlsx",
                      .oe_xlsx(list(survey = .oe_survey(), choices = choices)))
  base <- data.frame(`_uuid` = c("d", "e"), `grp/P1` = c("a", "b"), `P11/1` = 1:0,
                     `P11/si` = 0:1, calc = 1:2, check.names = FALSE)
  dat <- save_upload(sid, "data", "base.xlsx", .oe_xlsx(base))
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["default"]] <- list(
    nombre = "default", xlsform_file_id = inst$file_id, data_file_id = dat$file_id, data_ext = "xlsx")
  s$estudio$active_base <- "default"
  .session_env[[sid]] <- s
  sid
}

test_that("la consulta trae las faltantes aunque no haya declaración", {
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  r <- origen_externo_consultar(sid, "default")
  expect_identical(r$estado, "")
  expect_null(r$bloque)
  expect_setequal(vapply(r$variables_faltantes, `[[`, "", "variable"), c("start", "end", "P11", "si"))
})

test_that("se declaran sólo variables, sin lista de casos, y van a variables_excluidas sin duplicar", {
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  expect_error(origen_externo_declarar(sid, "default"), class = "api_error")

  s <- session_get(sid)
  s$analitica_config <- list(variables_excluidas = list("start"))
  .session_env[[sid]] <- s

  out <- origen_externo_declarar(sid, "default", variables_motivo = list(si = "no_va_al_cliente", P1 = "otra"))
  expect_identical(out$estado, "vigente")
  expect_identical(out$bloque$n_variables_retiradas, 4L)
  expect_false(isTRUE(out$bloque$casos_declarados))
  expect_identical(out$resumen$excluidas, 0L)
  expect_true("variable_presente" %in% vapply(out$avisos, `[[`, "", "codigo"))
  por <- stats::setNames(vapply(out$resumen$variables_retiradas$por_motivo, `[[`, 0L, "n"),
                         vapply(out$resumen$variables_retiradas$por_motivo, `[[`, "", "motivo"))
  expect_identical(por[c("metadato", "no_va_al_cliente", "otra")], c(metadato = 2L, no_va_al_cliente = 1L, otra = 1L))
  # `start` ya estaba excluida: no se duplica y no cuenta como agregada.
  expect_setequal(unlist(out$variables_excluidas_agregadas), c("end", "si"))
  excl <- unlist(session_get(sid)$analitica_config$variables_excluidas)
  expect_setequal(excl, c("start", "end", "si"))
  expect_false(anyDuplicated(excl) > 0L)

  # Redeclarar no duplica.
  out2 <- origen_externo_declarar(sid, "default", variables_motivo = list(si = "no_va_al_cliente"))
  expect_length(out2$variables_excluidas_agregadas, 0L)
  expect_length(unlist(session_get(sid)$analitica_config$variables_excluidas), 3L)
})

test_that("en un estudio con config por base, la exclusión cae en ESA base y no en la activa", {
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio$bases$hermana <- list(nombre = "hermana", data_file_id = "x")
  s$estudio$active_base <- "hermana"
  s$analitica_config_por_base <- list(hermana = list(variables_excluidas = list("Q9")),
                                      default = list(variables_excluidas = list()))
  .session_env[[sid]] <- s
  origen_externo_declarar(sid, "default", variables_motivo = list(si = "no_va_al_cliente"))
  s <- session_get(sid)
  expect_setequal(unlist(s$analitica_config_por_base$default$variables_excluidas), c("start", "end", "si"))
  expect_identical(unlist(s$analitica_config_por_base$hermana$variables_excluidas), "Q9")
  expect_null(s$analitica_config$variables_excluidas)
})

test_that("declarar variables conserva la lista de casos ya declarada para la base", {
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  dir <- tempfile("oe_"); dir.create(dir)
  lista_path <- file.path(dir, "lista.csv")
  utils::write.csv(.oe_lista(), lista_path, row.names = FALSE, fileEncoding = "UTF-8")
  s <- session_get(sid)
  s$files$flista <- list(file_id = "flista", path = lista_path, ext = "csv")
  .session_env[[sid]] <- s
  origen_externo_declarar(sid, "default", file_id = "flista", n_recibidas = 5L)
  out <- origen_externo_declarar(sid, "default", variables_motivo = list(si = "otra"))
  expect_identical(c(out$resumen$recibidas, out$resumen$excluidas), c(5L, 3L))
  expect_identical(out$resumen$variables_retiradas$total, 4L)
})

test_that("con sólo variables retiradas la ficha existe y lo dice", {
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  origen_externo_declarar(sid, "default", variables_motivo = list(si = "no_va_al_cliente"))
  u <- .validacion_upstream_universe(sid, "default")
  expect_null(u$external_applied)
  expect_identical(c(u$total, u$included), c(2L, 2L))
  expect_identical(u$variables_retiradas_external, 4L)
  expect_true(.vmr_universe_declares_counts(u))
  expect_match(paste(.vmr_universe_preparation_sentences(u), collapse = " "),
               "Antes de cargarse a la plataforma se retiraron 4 variables del instrumento (2 metadatos de la plataforma, 1 de uso interno, 1 por otros motivos).",
               fixed = TRUE)
  expect_identical(.vmr_universe_variables_line(list(
    variables_retiradas_external = 1L,
    variables_retiradas_external_por_motivo = list(list(motivo = "metadato", n = 1L)))),
    "Antes de cargarse a la plataforma se retiró 1 variable del instrumento (1 metadato de la plataforma).")
})

test_that("el POST HTTP acepta sólo variables_motivo y rechaza un cuerpo sin partes", {
  pr <- mount_origen_externo(plumber::pr())
  eps <- pr$endpoints[[1]]
  post <- Find(function(e) identical(e$verbs, "POST"), eps)
  get <- Find(function(e) identical(e$verbs, "GET"), eps)
  expect_true(grepl("mount_origen_externo(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  sid <- .oe_sesion_variables()
  on.exit(session_delete(sid), add = TRUE)
  req <- function(body) list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(body))
  res <- plumber:::PlumberResponse$new()
  out <- post$getFunc()(req = req('{"base_nombre":"default","variables_motivo":{"si":"no_va_al_cliente"}}'), res = res)
  expect_true(isTRUE(out$ok))
  expect_setequal(unlist(out$variables_excluidas_agregadas), c("start", "end", "si"))
  vacio <- post$getFunc()(req = req('{"base_nombre":"default","variables_motivo":{}}'),
                          res = plumber:::PlumberResponse$new())
  expect_identical(vacio$error$code %||% vacio$code %||% "", "E_BAD_REQUEST")
  g <- get$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                     base_nombre = "default")
  expect_identical(g$resumen$variables_retiradas$total, 4L)
  expect_length(g$variables_faltantes, 4L)
})

test_that("las variables retiradas sobreviven a guardar y reabrir el .pulso", {
  sid <- .oe_sesion_variables()
  origen_externo_declarar(sid, "default", variables_motivo = list(si = "no_va_al_cliente"))
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)
  expect_true(build_pulso(sid, tmp, project_name = "Origen externo P2b")$ok)
  res <- load_pulso(tmp)
  on.exit(session_delete(res$session_id), add = TRUE)
  r <- origen_externo_consultar(res$session_id, "default")
  expect_identical(r$estado, "vigente")
  expect_identical(r$bloque$n_variables_retiradas, 4L)
  ret <- session_get(res$session_id)$estudio$bases$default$origen_externo$variables_retiradas
  expect_identical(vapply(ret, `[[`, "", "motivo")[vapply(ret, `[[`, "", "variable") == "si"], "no_va_al_cliente")
  expect_setequal(unlist(session_get(res$session_id)$analitica_config$variables_excluidas), c("start", "end", "si"))
})
