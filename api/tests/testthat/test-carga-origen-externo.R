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
