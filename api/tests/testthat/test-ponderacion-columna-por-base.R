# =============================================================================
# R2 (contrato E4-E7): ponderación "columna" y config de ponderación por base.
#   - modo columna: `peso` = as.numeric(columna declarada); NA -> 0.
#   - .analitica_ponderacion_apply_sources resuelve la config de CADA base: una
#     base sin ponderación propia no hereda la de la activa.
#   - sin config por base, el comportamiento es el de siempre.
# =============================================================================

.pcb_data <- function() {
  list(
    b2024 = data.frame(p1 = c("1", "2", "1", "2"),
                       factor_ponderacion = c(0.5, 1.5, 2, NA),
                       stringsAsFactors = FALSE),
    b2025 = data.frame(p1 = c("1", "1", "2"),
                       w_otro = c("3", "1", "2"),
                       factor_ponderacion = c(9, 9, 9),
                       stringsAsFactors = FALSE),
    b2026 = data.frame(p1 = c("1", "2", "2", "2", "1"),
                       factor_ponderacion = c(7, 7, 7, 7, 7),
                       stringsAsFactors = FALSE)
  )
}

.pcb_session <- function(topology = "separate") {
  sid <- session_create()
  estudio_ensure(sid)
  s <- session_get(sid)
  for (b in names(.pcb_data())) {
    s$estudio$bases[[b]] <- list(nombre = b, data_ext = "xlsx")
  }
  s$estudio$active_base <- "b2024"
  .session_env[[sid]] <- s
  if (!is.null(topology)) estudio_set_topology(sid, topology)
  sid
}

.pcb_pond_col <- function(col) list(ponderacion = list(enabled = TRUE, modo = "columna", peso_columna = col))

# N ponderado por categoría tal como lo cuenta Frecuencias (.peso_vec).
.pcb_n_pond <- function(df) {
  w <- .peso_vec(df)
  c(total = sum(w), tapply(w, df$p1, sum))
}

test_that("modo columna: peso = columna declarada, NA -> 0, sello «columna»", {
  df <- .pcb_data()$b2024
  out <- .analitica_ponderacion_apply(df, .pcb_pond_col("factor_ponderacion"))
  expect_equal(out$peso, c(0.5, 1.5, 2, 0))
  estado <- attr(out, "ponderacion_estado")
  expect_equal(estado$status, "aplicada")
  expect_equal(estado$modo, "columna")
  expect_equal(estado$peso_columna, "factor_ponderacion")
  sello <- reporte_ponderacion_sello(estado)
  expect_match(sello, "^Resultados ponderados por la columna «factor_ponderacion»")
  expect_match(sello, "n efectivo = ")
  # El sello derivado (atributo perdido) también declara la columna.
  attr(out, "ponderacion_estado") <- NULL
  expect_match(
    reporte_ponderacion_sello_para_corrida(out, .pcb_pond_col("factor_ponderacion")),
    "por la columna «factor_ponderacion»"
  )
})

test_that("modo columna con columna inexistente o sin nombre falla con E_*", {
  df <- .pcb_data()$b2026
  err <- tryCatch(.analitica_ponderacion_apply(df, .pcb_pond_col("no_existe")),
                  api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_PONDERACION_COLUMNA_INEXISTENTE")
  expect_equal(err$status, 422)
  err2 <- tryCatch(.analitica_ponderacion_apply(df, .pcb_pond_col("")),
                   api_error = function(e) e)
  expect_equal(err2$code, "E_PONDERACION_COLUMNA_SIN_NOMBRE")
})

test_that("cada base se pondera con SU config: columna, otra columna, sin peso", {
  sid <- .pcb_session("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    b2024 = .pcb_pond_col("factor_ponderacion"),
    b2025 = .pcb_pond_col("w_otro"),
    b2026 = list(ponderacion = list(enabled = FALSE))
  ))
  data <- .pcb_data()
  # La corrida recibe la config de la activa (b2024), como hoy.
  out <- .analitica_ponderacion_apply_sources(
    sid, data, list(), .pcb_pond_col("factor_ponderacion")
  )$data_sources

  expect_equal(.pcb_n_pond(out$b2024), c(total = 4, `1` = 2.5, `2` = 1.5))
  expect_equal(.pcb_n_pond(out$b2025), c(total = 6, `1` = 4, `2` = 2))
  # b2026 trae `factor_ponderacion` pero su config dice sin peso: N = casos.
  expect_false("peso" %in% names(out$b2026))
  expect_equal(.pcb_n_pond(out$b2026), c(total = 5, `1` = 2, `2` = 3))
  expect_equal(attr(out$b2025, "ponderacion_estado")$peso_columna, "w_otro")
})

test_that("una base sin config propia no hereda la de la activa", {
  sid <- .pcb_session("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    b2024 = .pcb_pond_col("factor_ponderacion")
  ))
  out <- .analitica_ponderacion_apply_sources(
    sid, .pcb_data(), list(), .pcb_pond_col("factor_ponderacion")
  )$data_sources
  expect_true("peso" %in% names(out$b2024))
  expect_false("peso" %in% names(out$b2025))
  expect_false("peso" %in% names(out$b2026))
  expect_null(attr(out$b2025, "ponderacion_estado"))
})

test_that("estudio por base sin ninguna ponderación propia conserva la herencia de la corrida", {
  sid <- .pcb_session("separate")
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    b2025 = list(datos = list(variable_labels = list(p1 = "P1")))
  ))
  out <- .analitica_ponderacion_apply_sources(
    sid, .pcb_data(), list(), .pcb_pond_col("factor_ponderacion")
  )$data_sources
  expect_equal(out$b2024$peso, c(0.5, 1.5, 2, 0))
  expect_true("peso" %in% names(out$b2026))
})

test_that("sin config por base, todas las bases reciben la cfg de la corrida (como hoy)", {
  sid <- .pcb_session(NULL)
  on.exit(session_delete(sid), add = TRUE)
  data <- .pcb_data()[c("b2024", "b2026")]
  out <- .analitica_ponderacion_apply_sources(
    sid, data, list(), .pcb_pond_col("factor_ponderacion")
  )$data_sources
  expect_equal(out$b2024$peso, c(0.5, 1.5, 2, 0))
  expect_equal(out$b2026$peso, rep(7, 5))

  # Y sin ponderación habilitada la base sale intacta.
  plain <- .analitica_ponderacion_apply_sources(sid, data, list(), list())$data_sources
  expect_identical(plain$b2024, data$b2024)
})

test_that("calibración clásica no cambia: sin `modo` sigue usando el motor", {
  df <- data.frame(sexo = c("h", "h", "m", "m", "m", "m"), stringsAsFactors = FALSE)
  cfg <- list(ponderacion = list(enabled = TRUE,
                                 rake = list(margins = list(list(var = "sexo",
                                                                 targets = list(h = 0.5, m = 0.5))))))
  out <- .analitica_ponderacion_apply(df, cfg)
  expect_equal(sum(out$peso[out$sexo == "h"]), sum(out$peso[out$sexo == "m"]), tolerance = 1e-6)
  expect_equal(attr(out, "ponderacion_estado")$modo, "calibracion")
  expect_match(reporte_ponderacion_sello(attr(out, "ponderacion_estado")), "^Resultados ponderados \\(n efectivo")
})

test_that("una entrada por base SIN `ponderacion` (Revisión/Equivalencias) no apaga la global", {
  sid <- .pcb_session(NULL)
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "analitica_config_por_base", list(
    b2026 = list(datos = list(variable_labels = list(p1 = "P1"))),
    b2025 = .pcb_pond_col("w_otro")
  ))
  out <- .analitica_ponderacion_apply_sources(
    sid, .pcb_data(), list(), .pcb_pond_col("factor_ponderacion")
  )$data_sources
  expect_equal(out$b2026$peso, rep(7, 5))       # hereda la de la corrida, como hoy
  expect_equal(out$b2025$peso, c(3, 1, 2))      # su ponderación propia manda
  expect_equal(out$b2024$peso, c(0.5, 1.5, 2, 0))
})

test_that("Frecuencias multibase: «b» y «c» no heredan el peso de «a» (render real)", {
  skip_if_not_installed("haven")
  skip_if_not_installed("readxl")
  mk_sav <- function() {
    p <- tempfile(fileext = ".sav")
    on.exit(unlink(p, force = TRUE), add = TRUE)
    haven::write_sav(data.frame(
      p1 = haven::labelled(c(1, 2, 1), labels = c(Si = 1, No = 2), label = "Pregunta uno"),
      fp = c(1, 2, 3)
    ), p)
    readBin(p, "raw", n = file.info(p)$size)
  }
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  for (b in c("a", "b", "c")) {
    m <- save_upload(sid, "sav", paste0(b, ".sav"), mk_sav())
    carga_sav_registrar_base(sid, m$file_id, b)
  }
  estudio_set_topology(sid, "separate")
  session_set(sid, "analitica_config_por_base", list(a = .pcb_pond_col("fp")))
  expect_equal(estudio_active_base(sid), "a")

  # Misma tubería que POST /api/analitica/frecuencias.
  cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
  res <- run_report_multibase(sid, "frecuencias", "xlsx", "frecuencias", "frecuencias_zip",
                              .analitica_frecuencias_render_fn(sid, cfg))
  leer <- function(nombre) {
    o <- Filter(function(x) identical(x$nombre, nombre), res$bases)[[1]]
    t <- as.data.frame(readxl::read_excel(o$path, col_names = FALSE, .name_repair = "minimal"))
    fila <- function(et) suppressWarnings(as.numeric(t[[2]][which(t[[1]] == et)[1]]))
    c(Si = fila("Si"), No = fila("No"), Total = fila("Total"))
  }
  expect_equal(leer("a"), c(Si = 4, No = 2, Total = 6))   # ponderada por fp
  expect_equal(leer("b"), c(Si = 2, No = 1, Total = 3))   # casos, sin heredar
  expect_equal(leer("c"), c(Si = 2, No = 1, Total = 3))
})

test_that("una columna de peso tipo factor usa sus valores, no los códigos de nivel", {
  d <- data.frame(p1 = c(1, 2, 1), fp = factor(c("2.5", "0.5", "1")))
  out <- .analitica_ponderacion_apply(d, .pcb_pond_col("fp"))
  expect_equal(out$peso, c(2.5, 0.5, 1))
})
