source("setup-load-all.R")

# Contrato E4-E7 (R4): apilado y cálculo de la serie armonizada. Fixture
# sintético de tres mediciones (sin datos de cliente):
#   b2024  peso en la columna `factor_ponderacion` (modo columna)
#   b2025  peso en otra columna, `w25` (modo columna)
#   b2026  sin ponderar
# Preguntas: VBG-01 armonizada con mapas no triviales en 2024 y 2025,
# DEN-01 no comparable en 2025. Cruce S-05 «Lugar de nacimiento» con tres
# categorías: 2024 junta Lima y Callao y no tiene «Fuera del país» (n.a.).

.az_bloque <- function(lugar, resp) {
  data.frame(lug = rep(lugar, sum(resp)), v = rep(names(resp), resp), stringsAsFactors = FALSE)
}

.az_datos <- function() {
  b24 <- rbind(.az_bloque(1, c(`1` = 40, `2` = 15, `9` = 5)),
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
  b26 <- data.frame(v26 = as.numeric(b26$v), lug26 = b26$lug,
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
      escala = list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "2", etiqueta = "No")),
      por_base = list(
        b2024 = list(comparable = TRUE, mapa = stats::setNames(list(), character(0))),
        b2025 = list(comparable = FALSE,
                     nota = "por diferencias en la redacción de la pregunta entre mediciones",
                     mapa = stats::setNames(list(), character(0))),
        b2026 = list(comparable = TRUE, mapa = stats::setNames(list(), character(0)))
      )))
  lug <- list(
    id = "S-05", seccion = "Sociodemográficas", etiqueta_estandar = "Lugar de nacimiento",
    enunciado = "¿Dónde naciste?",
    variables = list(b2024 = "lug24", b2025 = "lug25", b2026 = "lug26"),
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

.az_setup <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  s <- session_get(sid)
  s$estudio <- list(
    bases = list(b2024 = list(nombre = "b2024"), b2025 = list(nombre = "b2025"),
                 b2026 = list(nombre = "b2026")),
    processing_mode = "multibase", topology_declared = "separate", active_base = "b2026"
  )
  s$rp_data_sources <- .az_datos()
  s$analitica_config_por_base <- list(
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

  # 2024 a mano: 1 -> Sí, 2 -> No, 9 -> NS, peso factor_ponderacion.
  w <- d$b2024$factor_ponderacion; v <- d$b2024$v24
  esperado24 <- c(sum(w[v == 1]), sum(w[v == 2]), sum(w[v == 9]))
  expect_equal(unname(vbg$periodos$b2024$n), esperado24)
  expect_equal(vbg$periodos$b2024$N, sum(w))
  expect_equal(unname(vbg$periodos$b2024$pct), esperado24 / sum(w))

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

test_that("los cruces marcan n.a. donde la categoría no tiene casos y las letras salen dentro del período", {
  sid <- .az_setup()
  ap <- .armz_preparar(sid, list(), filas_refs = list("VBG-01"), cruces_refs = list("S-05"))
  m <- armonizada_modelo_cruces(ap, alpha = 0.05)
  expect_length(m$preguntas, 1L)
  q <- m$preguntas[[1]]
  d <- .az_datos()

  # 2024: «Fuera del país» no existe (N == 0) -> n.a. en las letras.
  c24 <- q$periodos$b2024$cruces$x1
  expect_equal(unname(c24$N_vec[3]), 0)
  expect_identical(unname(c24$letras[, 3]), rep("n.a.", 3))
  # Lima junta los códigos 1 y 2 de 2024.
  w <- d$b2024$factor_ponderacion
  lima <- d$b2024$lug24 %in% c(1, 2)
  expect_equal(unname(c24$N_vec[1]), sum(w[lima]))
  expect_equal(unname(c24$n_mat["1", 1]), sum(w[lima & d$b2024$v24 == 1]))
  expect_equal(unname(c24$N_sin_peso), c(sum(lima), sum(d$b2024$lug24 == 3), 0L))

  # Letras de 2025 = comparar_columnas_sig directo sobre la tabla de 2025 sola.
  w <- d$b2025$w25; v <- d$b2025$v25; l <- d$b2025$lug25
  cod_l <- c(`1` = 1, `2` = 5, `3` = 27)
  cod_v <- c(`1` = 10, `2` = 20, `3` = 30)
  n_mat <- outer(seq_along(cod_v), seq_along(cod_l), Vectorize(function(i, j) sum(w[v == cod_v[i] & l == cod_l[j]])))
  N_vec <- vapply(cod_l, function(cj) sum(w[l == cj & v %in% cod_v]), numeric(1))
  directo <- trimws(comparar_columnas_sig(n_mat, unname(N_vec), alpha = 0.05)$letras)
  expect_equal(unname(q$periodos$b2025$cruces$x1$letras), unname(directo))
  expect_true(any(grepl("[A-C]", directo)))  # no es un verde vacío: hay letras

  # Total de la pregunta en 2025 incluye el lugar sin mapa (99): N de la pregunta.
  expect_equal(q$periodos$b2025$total$N, sum(w[v != 99]))
})

test_that("rótulos: año del nombre de base, el parámetro manda", {
  expect_identical(unname(.armz_rotulos(c("b2024", "ola_b"))), c("2024", "ola_b"))
  expect_identical(unname(.armz_rotulos(c("b2024", "b2025"), list(b2025 = "2025-I"))), c("2024", "2025-I"))
  expect_identical(unname(.armz_rotulos(c("b2024", "b2025"), list("A", "B"))), c("A", "B"))
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
