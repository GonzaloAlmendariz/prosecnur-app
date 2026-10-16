# ADR 0107: los segmentos de cruce son del estudio y tienen nombre estándar en
# todas las bases. Fixture de dos bases separadas, como HSyVbG: «2024» llega en
# .sav y trae el sexo como `cruce_2`; «2026» llega en Excel con el sexo en `P2`
# y la edad numérica en `P1`. Reusa los constructores de helper-base-variables.R.

.sg_opciones <- function(...) {
  x <- c(...)
  lapply(seq_along(x), function(i) list(codigo = names(x)[[i]], etiqueta = x[[i]]))
}

.sg_sn <- data.frame(list_name = "sn", name = c("1", "2", "99"), label = c("Sí", "No", "No responde"),
                     stringsAsFactors = FALSE)

.sg_sav_bytes <- function() {
  df <- data.frame(
    p1 = haven::labelled(c(1, 2, 1, 2, 1, 2, 1, 99), labels = c("Sí" = 1, "No" = 2, "No responde" = 99),
                         label = "¿Presenció hostigamiento?"),
    cruce_2 = haven::labelled(c(1, 1, 1, 2, 2, 2, 1, 2), labels = c("Mujer" = 1, "Hombre" = 2),
                              label = "Sexo"),
    stringsAsFactors = FALSE
  )
  path <- tempfile(fileext = ".sav")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  haven::write_sav(df, path)
  readBin(path, "raw", n = file.info(path)$size)
}

# Edades 18..40 observadas: 18, 19, 20 caen en «18 a 20» y el resto en «21 a más».
.sg_edades <- c(18, 19, 20, 21, 25, 30, 40, 18, 22, 40, 19, 35)

.sg_estudio <- function() {
  sid <- session_create()
  inst_24 <- list(
    survey = data.frame(type = c("select_one sn", "select_one sexo"), name = c("p1", "cruce_2"),
                        label = c("¿Presenció hostigamiento?", "Sexo"), stringsAsFactors = FALSE),
    choices = rbind(.sg_sn, data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
                                       stringsAsFactors = FALSE))
  )
  .bv_add_base(sid, "2024", inst_24, .sg_sav_bytes(), "base_2024.sav", "sav")
  inst_26 <- list(
    survey = data.frame(type = c("select_one sn", "select_one sexo", "integer"), name = c("q1", "P2", "P1"),
                        label = c("¿Presenció hostigamiento?", "Sexo", "Edad"), stringsAsFactors = FALSE),
    choices = rbind(.sg_sn, data.frame(list_name = "sexo", name = c("1", "2"), label = c("Mujer", "Hombre"),
                                       stringsAsFactors = FALSE))
  )
  data_26 <- data.frame(
    `_uuid` = sprintf("u%02d", seq_along(.sg_edades)),
    q1 = rep(c("1", "2", "1", "99"), length.out = length(.sg_edades)),
    P2 = rep(c("1", "2"), length.out = length(.sg_edades)),
    P1 = .sg_edades,
    check.names = FALSE, stringsAsFactors = FALSE
  )
  .bv_add_base(sid, "2026", inst_26, .bv_xlsx_bytes(list(data = data_26)), "data_2026.xlsx", "xlsx")
  estudio_set_topology(sid, "separate")
  # Una pregunta armonizada de la serie para los comparativos.
  .equiv_guardar_declaracion(sid, list(list(
    seccion = "Violencia", etiqueta_estandar = "Presenció hostigamiento", id = "VBG-01",
    variables = list(`2024` = "p1", `2026` = "q1"),
    armonizacion = list(escala = .sg_opciones("1" = "Sí", "2" = "No"),
                        por_base = list(`2024` = list(comparable = TRUE, mapa = list()),
                                        `2026` = list(comparable = TRUE, mapa = list()))))),
    armonizacion_periodos = list("2024", "2026"))
  sid
}

.sg_sexo <- list(
  clave = "Sexo", etiqueta = "Sexo", escala = .sg_opciones("1" = "Mujer", "2" = "Hombre"),
  por_base = list(`2024` = list(origen = "cruce_2", mapa = list(`1` = "1", `2` = "2")),
                  `2026` = list(origen = "P2", mapa = list(`1` = "1", `2` = "2")))
)

.sg_mapa_edad <- function(hasta = 40) {
  cods <- as.character(18:hasta)
  stats::setNames(as.list(ifelse(18:hasta <= 20, "1", "2")), cods)
}

.sg_edad <- function(mapa = .sg_mapa_edad()) list(
  clave = "edád", etiqueta = "Edad", escala = .sg_opciones("1" = "18 a 20 años", "2" = "21 años a más"),
  por_base = list(`2026` = list(origen = "P1", mapa = mapa))
)

.sg_seg <- function(out, clave) {
  out$segmentos[[which(vapply(out$segmentos, `[[`, "", "clave") == clave)]]
}

.sg_fila <- function(sid, id) {
  filas <- session_get(sid)$equivalencias_publicos$filas
  hit <- Filter(function(f) identical(f$id, id), filas)
  if (length(hit)) hit[[1]] else NULL
}

.sg_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

# --- Normalización de la clave ------------------------------------------------------

test_that("la clave se normaliza a [a-z0-9_] sin tildes y sin repetir el prefijo", {
  expect_identical(segmentos_normalizar_clave("Edád del Estudiante"), "edad_del_estudiante")
  expect_identical(segmentos_normalizar_clave("cruce_sexo"), "sexo")
  expect_identical(segmentos_normalizar_clave("Año-de ingreso"), "ano_de_ingreso")
  expect_identical(segmentos_normalizar_clave("  ¿?  "), "")
})

# --- Crear, materializar y estado -----------------------------------------------------

test_that("crear cruce_sexo desde orígenes distintos lo materializa en cada base con su nombre estándar", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  out <- segmentos_guardar(sid, .sg_sexo)
  seg <- .sg_seg(out, "sexo")
  expect_identical(seg$nombre, "cruce_sexo")
  expect_identical(seg$fila_ref, "SEG-sexo")
  expect_identical(vapply(seg$por_base, `[[`, "", "estado"), c(`2024` = "definido", `2026` = "definido"))
  expect_identical(seg$por_base[["2024"]]$origen, "cruce_2")
  expect_identical(seg$por_base[["2026"]]$origen, "P2")

  s <- session_get(sid)
  for (b in c("2024", "2026")) {
    cv <- s$estudio$bases[[b]]$variables_calculadas[[1]]
    expect_identical(cv$nombre, "cruce_sexo")
    expect_identical(cv$regla, "recodificar")
    expect_identical(cv$segmento, "sexo")
  }
  expect_identical(as.numeric(table(s$rp_data_sources[["2024"]]$cruce_sexo)), c(4, 4))
  expect_identical(as.numeric(table(s$rp_data_sources[["2026"]]$cruce_sexo)), c(6, 6))
  # El segmento vive en el estudio.
  expect_identical(names(s$estudio$segmentos_cruce), "sexo")
})

test_that("cruce_edad sale de la edad numérica con un mapa por rangos; sin mapa completo queda incompleto", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  out <- segmentos_guardar(sid, .sg_edad())
  seg <- .sg_seg(out, "edad")
  expect_identical(seg$nombre, "cruce_edad")
  expect_identical(seg$por_base[["2026"]]$estado, "definido")
  expect_identical(seg$por_base[["2024"]]$estado, "sin_origen")
  expect_identical(seg$por_base[["2024"]]$origen, "")
  v <- session_get(sid)$rp_data_sources[["2026"]]$cruce_edad
  expect_identical(as.numeric(v), ifelse(.sg_edades <= 20, 1, 2))
  expect_length(session_get(sid)$estudio$bases[["2024"]]$variables_calculadas %||% list(), 0L)

  # Sin el 40: dos casos sin mapa; reemplazar por clave no duplica la calculada.
  out2 <- segmentos_guardar(sid, .sg_edad(.sg_mapa_edad(39)))
  e26 <- .sg_seg(out2, "edad")$por_base[["2026"]]
  expect_identical(e26$estado, "incompleto")
  expect_identical(e26$n_sin_mapa, 2L)
  expect_identical(unlist(e26$codigos_sin_mapa), "40")
  expect_length(session_get(sid)$estudio$bases[["2026"]]$variables_calculadas, 1L)
  expect_true(all(is.na(session_get(sid)$rp_data_sources[["2026"]]$cruce_edad[.sg_edades == 40])))

  # El 40 explícitamente sin dato: definido, y sigue NA.
  out3 <- segmentos_guardar(sid, .sg_edad(c(.sg_mapa_edad(39), list(`40` = ""))))
  expect_identical(.sg_seg(out3, "edad")$por_base[["2026"]]$estado, "definido")
  expect_true(all(is.na(session_get(sid)$rp_data_sources[["2026"]]$cruce_edad[.sg_edades == 40])))
})

test_that("quitar el origen de una base al reemplazar le borra la calculada y la saca de la fila", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  segmentos_guardar(sid, .sg_sexo)
  solo_26 <- modifyList(.sg_sexo, list(por_base = list(`2024` = NULL)))
  solo_26$por_base <- .sg_sexo$por_base["2026"]
  out <- segmentos_guardar(sid, solo_26)
  expect_identical(.sg_seg(out, "sexo")$por_base[["2024"]]$estado, "sin_origen")
  expect_length(session_get(sid)$estudio$bases[["2024"]]$variables_calculadas, 0L)
  expect_identical(names(.sg_fila(sid, "SEG-sexo")$variables), "2026")
})

# --- Consumidores --------------------------------------------------------------------

test_that("el segmento aparece en Analítica de cada base y en el catálogo de Equivalencias", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  segmentos_guardar(sid, .sg_sexo)
  segmentos_guardar(sid, .sg_edad())
  for (b in c("2024", "2026")) {
    estudio_active_base_set(sid, b)
    out <- .bv_call(mount_analitica, "GET", "/api/analitica/variables", sid)
    nombres <- vapply(out$variables, `[[`, "", "name")
    expect_true("cruce_sexo" %in% nombres, info = b)
    expect_identical("cruce_edad" %in% nombres, identical(b, "2026"), info = b)
  }
  cat <- .bv_call(mount_equivalencias, "GET", "/api/carga/equivalencias/variables", sid)
  for (b in c("2024", "2026")) {
    n <- vapply(cat$variables[[b]], `[[`, "", "name")
    expect_true("cruce_sexo" %in% n, info = b)
    sx <- cat$variables[[b]][[which(n == "cruce_sexo")]]
    expect_identical(vapply(sx$opciones, `[[`, "", "etiqueta"), c("Mujer", "Hombre"))
  }
})

test_that("la fila SEG-* está armonizada (identidad en las bases con origen), marcada y sobrevive al editor", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  segmentos_guardar(sid, .sg_sexo)
  segmentos_guardar(sid, .sg_edad())
  f <- .sg_fila(sid, "SEG-sexo")
  expect_true(isTRUE(f$cruce))
  expect_identical(f$etiqueta_estandar, "Sexo")
  expect_identical(f$variables, list(`2024` = "cruce_sexo", `2026` = "cruce_sexo"))
  expect_identical(vapply(f$armonizacion$escala, `[[`, "", "codigo"), c("1", "2"))
  expect_true(all(vapply(f$armonizacion$por_base, function(e) isTRUE(e$comparable), logical(1))))
  expect_length(f$armonizacion$por_base[["2024"]]$mapa, 0L)
  fe <- .sg_fila(sid, "SEG-edad")
  expect_identical(names(fe$armonizacion$por_base), "2026")
  # La armonización cae sobre los datos reales: el preview no deja casos sin mapa.
  pv <- .equiv_armon_preview(sid, "SEG-sexo", "2024")
  expect_identical(pv$n_sin_mapa, 0L)
  expect_identical(vapply(pv$escala, `[[`, 0L, "n"), c(4L, 4L))

  # El editor guarda la matriz sin conocer `cruce` (y perdiendo el id SEG-*):
  # la marca y el id se conservan, y la fila ajena no se marca.
  filas <- lapply(session_get(sid)$equivalencias_publicos$filas, function(x) {
    x$cruce <- NULL
    if (startsWith(x$id %||% "", "SEG-")) x$id <- NULL
    x
  })
  .equiv_guardar_declaracion(sid, filas)
  expect_true(isTRUE(.sg_fila(sid, "SEG-sexo")$cruce))
  expect_true(isTRUE(.sg_fila(sid, "SEG-edad")$cruce))
  vbg <- .sg_fila(sid, "VBG-01")
  expect_false(is.null(vbg))
  expect_false(isTRUE(vbg$cruce))
  # Volver a guardar el segmento reemplaza su fila en su lugar: no la duplica.
  segmentos_guardar(sid, .sg_sexo)
  ids <- vapply(session_get(sid)$equivalencias_publicos$filas, function(x) x$id %||% "", "")
  expect_identical(ids, c("VBG-01", "SEG-sexo", "SEG-edad"))
  # Y la que manda `cruce = false` la quita.
  filas <- lapply(session_get(sid)$equivalencias_publicos$filas, function(x) {
    if (identical(x$id, "SEG-edad")) x$cruce <- FALSE
    x
  })
  .equiv_guardar_declaracion(sid, filas)
  expect_false(isTRUE(.sg_fila(sid, "SEG-edad")$cruce))
  expect_identical(segmentos_cruces_por_defecto(sid), "SEG-sexo")
})

# job_submit síncrono: corre el MISMO worker y el MISMO on_complete en proceso
# (el job real necesita el paquete instalado). Captura el input del worker.
.sg_cruces_sin_cruces <- function(sid, body = list()) {
  cap <- new.env()
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    job_submit = function(sid, kind, func, args = list(), result_filename = NULL, on_complete = NULL, ...) {
      dir <- file.path(session_get(sid)$dir, "jobs"); dir.create(dir, showWarnings = FALSE, recursive = TRUE)
      cap$input <- readRDS(args$input_path)
      args$result_path <- file.path(dir, paste0("job__", result_filename))
      args$progress_path <- file.path(dir, "job.progress")
      data <- do.call(func, args)
      cap$public <- on_complete(list(sid = sid, result_path = args$result_path, result_data = data))
      "job-sync"
    },
    .package = "prosecnurapp"
  )
  pr <- mount_armonizada(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- eps[[which(vapply(eps, function(e) identical(e$path, "/api/analitica/armonizada/cruces"), logical(1)))]]
  req <- new.env(parent = emptyenv())
  req$postBody <- jsonlite::toJSON(body, auto_unbox = TRUE)
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  out <- ep$getFunc()(req, res)
  list(out = out, status = as.integer(res$status), input = cap$input, public = cap$public)
}

test_that("el comparativo de cruces sin `cruces` usa los segmentos del estudio", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  sin <- .sg_cruces_sin_cruces(sid)
  expect_identical(sin$out$error$code %||% sin$out$code, "E_ARMONIZADA_SIN_CRUCES")

  segmentos_guardar(sid, .sg_sexo)
  segmentos_guardar(sid, .sg_edad())
  expect_identical(segmentos_cruces_por_defecto(sid), c("SEG-sexo", "SEG-edad"))
  r <- .sg_cruces_sin_cruces(sid)
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$out$ok))
  ap <- r$input$ap
  expect_identical(vapply(ap$cruces, function(x) x$fila$id, ""), c("SEG-sexo", "SEG-edad"))
  # Los segmentos no entran como preguntas: sólo VBG-01.
  expect_identical(vapply(ap$preguntas, function(x) x$fila$id, ""), "VBG-01")
  expect_identical(unname(ap$cruces[[2]]$comparable), c(FALSE, TRUE))
  xlsx <- session_get(sid)$files[[r$public$file_id]]$path
  expect_true(file.exists(xlsx))
  expect_identical(openxlsx::getSheetNames(xlsx), "Comparativo cruces")
  # Con `cruces` explícito manda el body.
  r2 <- .sg_cruces_sin_cruces(sid, list(cruces = list("SEG-edad")))
  expect_identical(vapply(r2$input$ap$cruces, function(x) x$fila$id, ""), "SEG-edad")
})

# --- Borrado ----------------------------------------------------------------------------

test_that("borrar un segmento quita sus calculadas y su fila, y deja las ajenas", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  segmentos_guardar(sid, .sg_sexo)
  segmentos_guardar(sid, .sg_edad())
  base_variables_guardar_calculada(sid, "2026", list(
    nombre = "hostigado", etiqueta = "Hostigado", regla = "alguna", variables = list("q1"), codigos = list("1")))
  out <- segmentos_quitar(sid, "sexo")
  expect_identical(vapply(out$segmentos, `[[`, "", "clave"), "edad")
  s <- session_get(sid)
  expect_length(s$estudio$bases[["2024"]]$variables_calculadas, 0L)
  expect_identical(vapply(s$estudio$bases[["2026"]]$variables_calculadas, `[[`, "", "nombre"),
                   c("cruce_edad", "hostigado"))
  expect_null(.sg_fila(sid, "SEG-sexo"))
  expect_false(is.null(.sg_fila(sid, "SEG-edad")))
  expect_false("cruce_sexo" %in% names(s$rp_data_sources[["2024"]]))
  expect_identical(.sg_code(segmentos_quitar(sid, "sexo")), "E_SEGMENTO_NO_ENCONTRADO")
})

# --- Persistencia -----------------------------------------------------------------------

test_that("segmentos, calculadas y fila marcada viajan en el .pulso y reabrir da lo mismo", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  segmentos_guardar(sid, .sg_sexo)
  segmentos_guardar(sid, .sg_edad(.sg_mapa_edad(39)))
  antes <- segmentos_consultar(sid)
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)
  expect_true(build_pulso(sid, tmp, project_name = "Segmentos")$ok)
  res <- load_pulso(tmp)
  sid2 <- res$session_id
  on.exit(session_delete(sid2), add = TRUE)
  .pulso_rebuild_estudio_runtime_sources(sid2)
  despues <- segmentos_consultar(sid2)
  expect_identical(despues$segmentos, antes$segmentos)
  expect_true(isTRUE(.sg_fila(sid2, "SEG-sexo")$cruce))
  expect_identical(as.numeric(table(estudio_data_sources(sid2)[["2024"]]$cruce_sexo)), c(4, 4))
  expect_identical(segmentos_cruces_por_defecto(sid2), c("SEG-sexo", "SEG-edad"))
})

# --- Errores -------------------------------------------------------------------------------

test_that("cada caso inválido corta con su E_SEGMENTO_* antes de escribir nada", {
  skip_if_not_installed("haven")
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  con <- function(...) modifyList(.sg_sexo, list(...))
  expect_identical(.sg_code(segmentos_guardar(sid, con(clave = "¿?"))), "E_SEGMENTO_CLAVE_INVALIDA")
  sin_escala <- .sg_sexo; sin_escala$escala <- list()
  expect_identical(.sg_code(segmentos_guardar(sid, sin_escala)), "E_SEGMENTO_ESCALA_VACIA")
  dup <- .sg_sexo; dup$escala <- .sg_opciones("1" = "Mujer", "1" = "Hombre")
  expect_identical(.sg_code(segmentos_guardar(sid, dup)), "E_SEGMENTO_ESCALA_INVALIDA")
  otra <- .sg_sexo; otra$por_base <- list(`2030` = list(origen = "P2"))
  expect_identical(.sg_code(segmentos_guardar(sid, otra)), "E_SEGMENTO_BASE_INEXISTENTE")
  sin_var <- .sg_sexo; sin_var$por_base$`2026`$origen <- "no_existe"
  expect_identical(.sg_code(segmentos_guardar(sid, sin_var)), "E_SEGMENTO_ORIGEN_INEXISTENTE")
  fuera <- .sg_sexo; fuera$por_base$`2026`$mapa <- list(`1` = "1", `2` = "3")
  expect_identical(.sg_code(segmentos_guardar(sid, fuera)), "E_SEGMENTO_MAPA_FUERA_DE_ESCALA")
  vacio <- .sg_sexo; vacio$por_base$`2026`$mapa <- list(`1` = "", `2` = "")
  expect_identical(.sg_code(segmentos_guardar(sid, vacio)), "E_SEGMENTO_MAPA_INVALIDO")
  # `cruce_2` es una columna de la base 2024: «2» choca aunque el origen esté en otra base.
  choca <- .sg_sexo; choca$clave <- "2"; choca$por_base <- .sg_sexo$por_base["2026"]
  expect_identical(.sg_code(segmentos_guardar(sid, choca)), "E_SEGMENTO_NOMBRE_OCUPADO")
  # Una calculada a mano con el nombre estándar también choca.
  base_variables_guardar_calculada(sid, "2026", list(nombre = "cruce_sexo", etiqueta = "Sexo a mano",
                                                     regla = "recodificar", variables = list("P2"),
                                                     mapa = list(`1` = "1"), escala = .sg_opciones("1" = "M")))
  expect_identical(.sg_code(segmentos_guardar(sid, .sg_sexo)), "E_SEGMENTO_NOMBRE_OCUPADO")
  # Una fila de la matriz con el id SEG-<clave> que no es de un segmento.
  filas <- c(session_get(sid)$equivalencias_publicos$filas, list(list(
    etiqueta_estandar = "Edad a mano", id = "SEG-edad", variables = list(`2026` = "P1"))))
  .equiv_guardar_declaracion(sid, filas)
  expect_identical(.sg_code(segmentos_guardar(sid, .sg_edad())), "E_SEGMENTO_CLAVE_DUPLICADA")
  # Nada quedó escrito por los intentos fallidos.
  expect_length(session_get(sid)$estudio$segmentos_cruce %||% list(), 0L)
  expect_length(session_get(sid)$estudio$bases[["2024"]]$variables_calculadas %||% list(), 0L)
})

# --- Contrato HTTP ---------------------------------------------------------------------------

test_that("contrato HTTP de /api/carga/segmentos: montado, payload del GET/POST y DELETE", {
  skip_if_not_installed("haven")
  expect_true(grepl("mount_segmentos(pr)", paste(deparse(body(build_plumber_app)), collapse = " "),
                    fixed = TRUE))
  sid <- .sg_estudio()
  on.exit(session_delete(sid), add = TRUE)
  g0 <- .bv_call(mount_segmentos, "GET", "/api/carga/segmentos", sid)
  expect_true(isTRUE(g0$ok))
  expect_true(isTRUE(g0$disponible))
  expect_identical(unlist(g0$bases), c("2024", "2026"))
  expect_length(g0$segmentos, 0L)

  p <- .bv_call(mount_segmentos, "POST", "/api/carga/segmentos", sid, body = .sg_edad())
  expect_true(isTRUE(p$ok))
  seg <- p$segmentos[[1]]
  expect_identical(names(seg), c("clave", "nombre", "etiqueta", "escala", "por_base", "fila_ref"))
  expect_identical(names(seg$por_base[["2026"]]),
                   c("origen", "mapa", "estado", "n_sin_mapa", "codigos_sin_mapa"))
  json <- jsonlite::toJSON(p, auto_unbox = TRUE, null = "null")
  back <- jsonlite::fromJSON(json, simplifyVector = FALSE)
  expect_identical(back$segmentos[[1]]$por_base[["2024"]]$mapa, setNames(list(), character(0)))
  expect_identical(back$segmentos[[1]]$por_base[["2026"]]$mapa[["18"]], "1")
  expect_identical(back$segmentos[[1]]$fila_ref, "SEG-edad")

  g <- .bv_call(mount_segmentos, "GET", "/api/carga/segmentos", sid)
  expect_identical(g$segmentos, p$segmentos)
  mal <- .bv_call(mount_segmentos, "POST", "/api/carga/segmentos", sid,
                  body = modifyList(.sg_edad(), list(clave = "")))
  expect_identical(mal$error$code %||% mal$code, "E_SEGMENTO_CLAVE_INVALIDA")
  d <- .bv_call(mount_segmentos, "DELETE", "/api/carga/segmentos", sid, clave = "edad")
  expect_true(isTRUE(d$ok))
  expect_length(d$segmentos, 0L)
  d2 <- .bv_call(mount_segmentos, "DELETE", "/api/carga/segmentos", sid, clave = "edad")
  expect_identical(d2$error$code %||% d2$code, "E_SEGMENTO_NO_ENCONTRADO")
})

test_that("un estudio sin bases separadas no declara segmentos", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  g <- segmentos_consultar(sid)
  expect_false(isTRUE(g$disponible))
  expect_length(g$segmentos, 0L)
  expect_identical(.sg_code(segmentos_guardar(sid, .sg_sexo)), "E_EQUIV_NO_APLICA")
})
