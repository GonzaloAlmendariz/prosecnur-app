# ADR 0076 — una base depurada se promueve, no se recomienda.
#
# Los invariantes que el ADR declara para su cumplimiento:
#   1. la exclusión llega a quien consume la base;
#   2. el linaje no se rompe y permite revertir;
#   3. lo promovido tiene forma de base del estudio, no de tabla de trabajo;
#   4. la cadena respeta el orden universo -> limpieza.

.prom_base_meta <- function(extra = list()) {
  utils::modifyList(list(
    xlsform_file_id = "XLS1", data_file_id = "DATA_CRUDA",
    original_xlsform_file_id = "XLS1", original_data_file_id = "DATA_CRUDA",
    data_ext = "xlsx"
  ), extra)
}

test_that("la forma de origen descarta las derivadas del plan y conserva el orden", {
  td <- tempfile("prom_forma_"); dir.create(td)
  origen <- file.path(td, "origen.xlsx")
  openxlsx::write.xlsx(data.frame(
    Pulso_code = c("A", "B"), edad = c(30, 41), sexo = c("1", "2"),
    stringsAsFactors = FALSE, check.names = FALSE
  ), origen, overwrite = TRUE)

  # Lo que sale de Validación: mismas columnas + derivadas del plan, y en otro orden.
  trabajo <- data.frame(
    sexo = c("1", "2"), Pulso_code = c("A", "B"), edad = c(30, 41),
    `.__case_id__` = c("A", "B"), r_regla_001 = c(TRUE, FALSE), n_incons = c(1, 0),
    stringsAsFactors = FALSE, check.names = FALSE
  )

  out <- prosecnurapp:::.limpieza_forma_de_origen(trabajo, origen, "xlsx")
  expect_equal(names(out), c("Pulso_code", "edad", "sexo"))
  expect_equal(nrow(out), 2L)
  expect_false(any(grepl("^r_regla|case_id|n_incons", names(out))))
})

test_that("la cadena de Codificación prefiere limpieza sobre universo", {
  resolver <- function(base_extra) {
    s <- list(
      estudio = list(bases = list(default = .prom_base_meta(base_extra))),
      files = list(
        DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
        DATA_UNIV  = list(file_id = "DATA_UNIV", ext = "xlsx"),
        DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx")
      )
    )
    base <- s$estudio$bases$default
    elegido <- NULL
    for (etapa in c("limpieza", "universe_filter")) {
      cfg <- base[[etapa]]
      if (is.null(cfg) || !isTRUE(cfg$enabled)) next
      fid <- as.character(cfg$effective_data_file_id %||% "")
      if (nzchar(fid) && !is.null(s$files[[fid]])) { elegido <- fid; break }
    }
    elegido %||% base$original_data_file_id
  }
  `%||%` <- function(a, b) if (is.null(a)) b else a

  # Sin depuración: la cruda.
  expect_equal(resolver(list()), "DATA_CRUDA")
  # Solo universo.
  expect_equal(resolver(list(universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"))),
               "DATA_UNIV")
  # Ambos: manda la limpieza, que es posterior en la cadena.
  expect_equal(resolver(list(
    universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"),
    limpieza = list(enabled = TRUE, effective_data_file_id = "DATA_LIMPIA")
  )), "DATA_LIMPIA")
  # Promoción revertida: vuelve a mandar el universo.
  expect_equal(resolver(list(
    universe_filter = list(enabled = TRUE, effective_data_file_id = "DATA_UNIV"),
    limpieza = list(enabled = FALSE, effective_data_file_id = "DATA_LIMPIA")
  )), "DATA_UNIV")
})

test_that("promover actualiza la base vigente y deja linaje reversible", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(
    DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx", kind = "data"),
    DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx", kind = "validacion_limpieza_base_limpia")
  )
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215
  )
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base$data_file_id, "DATA_LIMPIA")
  expect_equal(base$n_filas, 101L)
  expect_true(isTRUE(base$limpieza$enabled))
  expect_equal(base$limpieza$source_data_file_id, "DATA_CRUDA")
  expect_equal(base$limpieza$n_casos_antes, 103L)
  # `original_*` no se toca: sigue siendo lo que se cargó.
  expect_equal(base$original_data_file_id, "DATA_CRUDA")

  # Y se puede volver atrás sin rehacer decisiones.
  expect_true(prosecnurapp:::.limpieza_revertir_promocion(sid, "default"))
  base2 <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base2$data_file_id, "DATA_CRUDA")
  expect_false(isTRUE(base2$limpieza$enabled))
  expect_true(nzchar(base2$limpieza$reverted_at %||% ""))
})

test_that("sin promocion vigente, revertir es un 409 y no un silencio", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  err <- tryCatch(prosecnurapp:::limpieza_revertir_promocion(sid, "default"),
                  api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_LIMPIEZA_SIN_PROMOCION")
  expect_equal(err$status, 409)
})

test_that("revertir devuelve el linaje vigente e invalida aguas abajo", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx"))
  s$codif_aplicado <- TRUE
  s$analitica_frecuencias_ok <- TRUE
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215
  )

  linaje <- prosecnurapp:::limpieza_revertir_promocion(sid, "default")
  expect_false(isTRUE(linaje$enabled))
  expect_true(nzchar(linaje$reverted_at %||% ""))
  expect_equal(linaje$n_casos_antes, 103L)

  s2 <- prosecnurapp:::session_get(sid)
  expect_equal(s2$estudio$bases$default$data_file_id, "DATA_CRUDA")
  # El insumo volvió a cambiar: lo de aguas abajo se rehace.
  expect_false(isTRUE(s2$codif_aplicado))
  expect_false(isTRUE(s2$analitica_frecuencias_ok))
})

test_that("el linaje que se sirve es el vigente, no el congelado del cierre", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215
  )

  # Editar una decisión limpia `limpieza_artifacts`, pero la base promovida
  # sigue rigiendo: el payload tiene que seguir declarándolo.
  payload <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_true(isTRUE(payload$artifacts$promocion$enabled))
  expect_equal(payload$artifacts$promocion$n_casos_despues, 101L)

  prosecnurapp:::limpieza_revertir_promocion(sid, "default")
  payload2 <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_false(isTRUE(payload2$artifacts$promocion$enabled))
})

test_that("sin bloqueo la clave no viaja: el serializer convertiria el NULL en {}", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215
  )
  expect_false("bloqueo" %in% names(linaje))
  json <- jsonlite::toJSON(list(promocion = linaje), auto_unbox = TRUE)
  expect_false(grepl("bloqueo", json, fixed = TRUE))
})

test_that("una base con hijas repeat no se promueve y declara el motivo", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  DATA_LIMPIA = list(file_id = "DATA_LIMPIA", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid = sid, base_nombre = "default",
    clean_meta = list(file_id = "DATA_LIMPIA", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215,
    motivo_bloqueo = "La base tiene grupos repetibles."
  )
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_equal(base$data_file_id, "DATA_CRUDA")   # no se promovió
  expect_false(isTRUE(base$limpieza$enabled))
  expect_true(nzchar(base$limpieza$bloqueo))
})

# --- La ficha del informe metodológico lee el linaje -------------------------
#
# El ADR 0076 hace que la exclusión llegue a la base entregada; también tiene
# que llegar al informe que la acompaña, y solo en agregado.

test_that("sin filtro de universo, la promoción alimenta la ficha del informe", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta(list(
    limpieza = list(enabled = TRUE, n_casos_antes = 103L, n_casos_despues = 101L)
  ))))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  u <- prosecnurapp:::.validacion_upstream_universe(sid, "default")
  expect_false(isTRUE(u$applied))
  expect_true(isTRUE(u$cleaning_applied))
  expect_equal(u$total, 103L)
  expect_equal(u$included, 101L)
  expect_equal(u$excluded_cleaning, 2L)
})

test_that("promoción revertida o sin linaje no inventa una ficha", {
  build <- function(extra) {
    sid <- prosecnurapp:::session_create()
    s <- prosecnurapp:::session_get(sid)
    s$estudio <- list(bases = list(default = .prom_base_meta(extra)))
    .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
    .env_sesiones[[sid]] <- s
    prosecnurapp:::.validacion_upstream_universe(sid, "default")
  }
  expect_null(build(list()))
  expect_null(build(list(limpieza = list(enabled = FALSE, n_casos_antes = 103L, n_casos_despues = 101L))))
  # Bloqueada por repeats: hay linaje, pero nada se promovió.
  expect_null(build(list(limpieza = list(enabled = FALSE, bloqueo = "repeats",
                                         n_casos_antes = 103L, n_casos_despues = 101L))))
})

test_that("la depuración se encadena al filtro sólo si arranca de su universo", {
  build <- function(n_antes) {
    sid <- prosecnurapp:::session_create()
    s <- prosecnurapp:::session_get(sid)
    s$estudio <- list(bases = list(default = .prom_base_meta(list(
      universe_filter = list(
        enabled = TRUE, variable = "testreal",
        real_values = "real", test_values = "test",
        audit = list(total = 430L, included = 426L, excluded_test = 4L)
      ),
      limpieza = list(enabled = TRUE, n_casos_antes = n_antes, n_casos_despues = 424L)
    ))))
    .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
    .env_sesiones[[sid]] <- s
    prosecnurapp:::.validacion_upstream_universe(sid, "default")
  }

  # Empalma: la limpieza partió de las 426 que dejó el filtro.
  encadenado <- build(426L)
  expect_true(isTRUE(encadenado$cleaning_applied))
  expect_equal(encadenado$total, 430L)
  expect_equal(encadenado$excluded_test, 4L)
  expect_equal(encadenado$excluded_cleaning, 2L)
  expect_equal(encadenado$included, 424L)

  # No empalma: el linaje habla de otra base y el embudo no se inventa nada.
  suelto <- build(430L)
  expect_false(isTRUE(suelto$cleaning_applied))
  expect_equal(suelto$included, 426L)
})

# --- El linaje describe "de lo recibido a lo que rige" -----------------------

test_that("depurar dos veces conserva el N recibido, no el intermedio", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  L1 = list(file_id = "L1", ext = "xlsx"),
                  L2 = list(file_id = "L2", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L1", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215)

  # `limpieza_finalize()` pasa como origen la data VIGENTE, que ya es la
  # promovida: sin anclaje el linaje diría 101 -> 99 y perdería el 103.
  vigente <- prosecnurapp:::session_get(sid)$estudio$bases$default$data_file_id
  expect_equal(vigente, "L1")
  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L2", ext = "xlsx"),
    source_fid = vigente, n_antes = 101, n_despues = 99, n_columnas = 215)

  expect_equal(linaje$n_casos_antes, 103L)
  expect_equal(linaje$n_casos_despues, 99L)
  # Y revertir vuelve a lo recibido, coherente con lo que el linaje declara.
  expect_equal(linaje$source_data_file_id, "DATA_CRUDA")
  expect_true(prosecnurapp:::.limpieza_revertir_promocion(sid, "default"))
  expect_equal(prosecnurapp:::session_get(sid)$estudio$bases$default$data_file_id, "DATA_CRUDA")
})

test_that("tras revertir, el siguiente cierre arranca de cero y no encadena", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  L1 = list(file_id = "L1", ext = "xlsx"), L2 = list(file_id = "L2", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L1", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215)
  prosecnurapp:::.limpieza_revertir_promocion(sid, "default")
  linaje <- prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L2", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 100, n_columnas = 215)
  expect_equal(linaje$n_casos_antes, 103L)
  expect_equal(linaje$n_casos_despues, 100L)
})

# --- Reemplazar la data descarta la promoción; el XLSForm no ----------------

test_that("recargar la data descarta el linaje en vez de dejarlo mintiendo", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  L1 = list(file_id = "L1", ext = "xlsx"),
                  NUEVA = list(file_id = "NUEVA", ext = "xlsx"),
                  XLS2 = list(file_id = "XLS2", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s

  prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L1", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215)

  # Recargar el instrumento no toca la base depurada: la data no cambió.
  prosecnurapp:::estudio_replace_base_files(sid, "default", xlsform_file_id = "XLS2")
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_true(isTRUE(base$limpieza$enabled))
  expect_equal(base$data_file_id, "L1")

  # Reemplazar la data sí: el linaje describía un archivo que ya no rige.
  prosecnurapp:::estudio_replace_base_files(sid, "default", data_file_id = "NUEVA",
                                            data_ext = "xlsx", n_filas = 250L)
  base <- prosecnurapp:::session_get(sid)$estudio$bases$default
  expect_null(base$limpieza)
  expect_equal(base$data_file_id, "NUEVA")
  expect_equal(base$n_filas, 250L)
  # Y la ficha del informe deja de servir un conteo que ya no describe nada.
  expect_null(prosecnurapp:::.validacion_upstream_universe(sid, "default"))
})

# --- La promoción sin nada que la justifique se declara (ADR 0077) ----------

test_that("un linaje vigente sin plan se sirve como sin respaldo", {
  sid <- prosecnurapp:::session_create()
  s <- prosecnurapp:::session_get(sid)
  s$estudio <- list(bases = list(default = .prom_base_meta()))
  s$files <- list(DATA_CRUDA = list(file_id = "DATA_CRUDA", ext = "xlsx"),
                  L1 = list(file_id = "L1", ext = "xlsx"))
  .env_sesiones <- getFromNamespace(".session_env", "prosecnurapp")
  .env_sesiones[[sid]] <- s
  prosecnurapp:::.limpieza_promover_base(
    sid, "default", list(file_id = "L1", ext = "xlsx"),
    source_fid = "DATA_CRUDA", n_antes = 103, n_despues = 101, n_columnas = 215)

  # Workspace vaciado (lo que deja recargar el instrumento): no hay plan.
  sin_plan <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_true(isTRUE(sin_plan$artifacts$promocion$sin_respaldo))

  # Con plan la clave no viaja: un `{}` del serializer sería truthy en JS.
  con_plan <- prosecnurapp:::build_limpieza(list(plan_result = list(plan = data.frame(x = 1))),
                                            sid = sid, base_nombre = "default")
  expect_false("sin_respaldo" %in% names(con_plan$artifacts$promocion))

  # Revertida tampoco: ya no rige nada que explicar.
  prosecnurapp:::.limpieza_revertir_promocion(sid, "default")
  revertida <- prosecnurapp:::build_limpieza(list(), sid = sid, base_nombre = "default")
  expect_false("sin_respaldo" %in% names(revertida$artifacts$promocion))
})
