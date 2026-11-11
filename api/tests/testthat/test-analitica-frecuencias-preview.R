# Vista previa de Frecuencias (POST /api/analitica/frecuencias/preview).
#
# La prueba que importa: LO QUE DEVUELVE LA VISTA PREVIA ES LO QUE ESCRIBE EL
# ARCHIVO. Se genera el XLSX por el camino del endpoint real
# (`run_report_multibase()` + `.analitica_frecuencias_render_fn()`), se lee con
# un lector propio que no usa nada del motor, y se compara tabla por tabla:
# título, filas, n, proporción, Total, resumen numérico y notas al pie.
#
# El archivo se genera llamando al motor en proceso: el endpoint real tampoco
# usa un job para Frecuencias, así que es el mismo camino.

# --- Proyectos ---------------------------------------------------------------

.fp_ruta_pulso <- function(...) {
  ruta <- system.file(..., package = "prosecnurapp")
  if (!nzchar(ruta)) ruta <- testthat::test_path("..", "..", "inst", ...)
  ruta
}

.fp_abrir <- function(cual = c("acg", "auditoria"), envir = parent.frame()) {
  cual <- match.arg(cual)
  pulso <- switch(cual,
    acg = .fp_ruta_pulso("reference_projects", "acnur_acg", "acnur_acg.pulso"),
    auditoria = .fp_ruta_pulso("audit_reference", "prosecnur_audit_reference.pulso")
  )
  testthat::skip_if_not(file.exists(pulso), paste("sin el proyecto", cual))
  copia <- withr::local_tempdir(.local_envir = envir)
  file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso")))
  withr::defer(session_delete(ld$session_id), envir = envir)
  ld$session_id
}

.fp_configurar <- function(sid, cambiar) {
  cfg <- cambiar(.analitica_config_get(sid))
  .analitica_config_set(sid, cfg)
  invisible(cfg)
}

# Misma tubería que POST /api/analitica/frecuencias. Devuelve la ruta del XLSX
# de cada base, por nombre.
.fp_generar_archivo <- function(sid) {
  cfg <- .analitica_cfg_with_effective_source(sid, .analitica_get_config(sid))
  res <- suppressMessages(run_report_multibase(
    sid, "frecuencias", "xlsx", "frecuencias", "frecuencias_zip",
    .analitica_frecuencias_render_fn(sid, cfg)
  ))
  stats::setNames(
    lapply(res$bases, function(o) o$path),
    vapply(res$bases, function(o) o$nombre, character(1))
  )
}

# --- Lector del archivo (independiente del motor) ----------------------------
#
# Una tabla categórica empieza en la fila cuyas columnas 2 y 3 dicen "N" y "%";
# una numérica, en la que dice "Estadístico" y "Valor". El título es la fila de
# arriba; el cuerpo llega hasta la primera nota o hasta una fila vacía.
.fp_leer_archivo <- function(path) {
  x <- suppressMessages(readxl::read_excel(
    path, sheet = "Frecuencias", col_names = FALSE, col_types = "list", .name_repair = "minimal"
  ))
  n <- nrow(x)
  celda <- function(col, i) {
    if (col > ncol(x) || i < 1L || i > n) return(NA)
    v <- x[[col]][[i]]
    if (is.null(v) || !length(v)) NA else v
  }
  txt <- function(col, i) {
    v <- celda(col, i)
    if (is.character(v)) v else NA_character_
  }
  num <- function(col, i) {
    v <- celda(col, i)
    if (is.numeric(v)) as.numeric(v) else NA_real_
  }
  bloques <- list()
  for (i in seq_len(n)) {
    es_cat <- identical(txt(2, i), "N") && identical(txt(3, i), "%")
    es_num <- identical(txt(1, i), "Estadístico") && identical(txt(2, i), "Valor")
    if (!es_cat && !es_num) next
    filas <- list()
    notas <- character(0)
    sin_datos <- FALSE
    j <- i + 1L
    while (j <= n && !is.na(txt(1, j)) && !grepl("^(Fuente|Base): ", txt(1, j))) {
      if (identical(txt(1, j), "Sin datos") && is.na(num(2, j))) {
        sin_datos <- TRUE
        j <- j + 1L
        break
      }
      filas[[length(filas) + 1L]] <- list(etiqueta = txt(1, j), n = num(2, j), pct = num(3, j))
      j <- j + 1L
    }
    while (j <= n && !is.na(txt(1, j)) && grepl("^(Fuente|Base): ", txt(1, j))) {
      notas <- c(notas, txt(1, j))
      j <- j + 1L
    }
    bloques[[length(bloques) + 1L]] <- list(
      tipo = if (es_num) "numerica" else "categorica",
      titulo = txt(1, i - 1L),
      # Si hay rótulo de sección, está dos filas sobre el título de su primera tabla.
      sobre_titulo = txt(1, i - 3L),
      filas = filas, notas = notas, sin_datos = sin_datos
    )
  }
  bloques
}

# Diferencias entre las tablas de la vista previa y los bloques del archivo.
# Devuelve un vector de textos; vacío significa "idénticas".
.fp_diferencias <- function(tablas, bloques, tol = 1e-9) {
  dif <- character(0)
  nota <- function(...) dif <<- c(dif, paste0(...))
  igual_num <- function(a, b) {
    length(a) == length(b) && all(is.na(a) == is.na(b)) &&
      all(abs(a - b)[!is.na(a)] <= tol * pmax(1, abs(b[!is.na(a)])))
  }
  if (length(tablas) != length(bloques)) {
    nota("número de tablas: vista previa ", length(tablas), ", archivo ", length(bloques))
    return(dif)
  }
  for (k in seq_along(tablas)) {
    t <- tablas[[k]]
    b <- bloques[[k]]
    v <- t$variable
    if (!identical(t$etiqueta, b$titulo)) nota(v, ": título")
    if (!identical(as.character(unlist(t$notas)), b$notas)) nota(v, ": notas al pie")
    if (!identical(isTRUE(t$sin_datos), b$sin_datos)) nota(v, ": sin datos")
    et_archivo <- vapply(b$filas, function(f) f$etiqueta, character(1))
    n_archivo <- vapply(b$filas, function(f) f$n, numeric(1))
    pct_archivo <- vapply(b$filas, function(f) f$pct, numeric(1))
    if (identical(t$tipo, "numerica")) {
      if (!identical(b$tipo, "numerica")) nota(v, ": el archivo no la resume como numérica")
      if (!identical(vapply(t$resumen, function(r) r$estadistico, character(1)), et_archivo)) nota(v, ": estadísticos")
      if (!igual_num(vapply(t$resumen, function(r) r$valor, numeric(1)), n_archivo)) nota(v, ": valores del resumen")
      next
    }
    if (!identical(b$tipo, "categorica")) nota(v, ": el archivo la resume como numérica")
    con_total <- !isTRUE(t$sin_datos)
    et <- c(vapply(t$filas, function(f) f$etiqueta, character(1)), if (con_total) "Total")
    nn <- c(vapply(t$filas, function(f) f$n, numeric(1)), if (con_total) t$total$n)
    pp <- c(vapply(t$filas, function(f) f$pct, numeric(1)), if (con_total) t$total$pct)
    if (!identical(et, et_archivo)) nota(v, ": opciones o su orden")
    if (!igual_num(nn, n_archivo)) nota(v, ": n")
    if (!igual_num(pp, pct_archivo)) nota(v, ": proporción")
  }
  dif
}

.fp_tabla <- function(res, variable) {
  hit <- Filter(function(t) identical(t$variable, variable), res$tablas)
  if (length(hit)) hit[[1]] else NULL
}

.fp_fila <- function(tabla, codigo) {
  hit <- Filter(function(f) identical(f$codigo, codigo), tabla$filas)
  if (length(hit)) hit[[1]] else NULL
}

# --- Igualdad con el archivo -------------------------------------------------

test_that("sin ponderar: cada tabla de la vista previa es la del archivo (acnur_acg)", {
  sid <- .fp_abrir("acg")
  .fp_configurar(sid, function(cfg) {
    cfg$frecuencias$mostrar_todo <- TRUE
    cfg$codebook$codigos_solo_si_presentes <- list(98L, 99L)
    cfg
  })
  res <- analitica_frecuencias_preview(sid, limite = 500L)
  bloques <- .fp_leer_archivo(.fp_generar_archivo(sid)[[res$base$nombre]])

  expect_identical(.fp_diferencias(res$tablas, bloques), character(0))
  expect_false(res$ponderado)
  expect_identical(res$ponderacion$estado, "sin_config")
  expect_identical(res$escala_pct, "proporcion")
  expect_identical(res$total_variables, length(bloques))
  expect_false(res$recortado)

  tipos <- vapply(res$tablas, function(t) t$tipo, character(1))
  expect_true(all(c("unica", "multiple") %in% tipos))

  # Respuesta única con códigos especiales que sí tienen casos.
  empleo <- .fp_tabla(res, "M4_employment")
  expect_identical(empleo$tipo, "unica")
  expect_true(.fp_fila(empleo, "98")$especial)
  expect_true(.fp_fila(empleo, "99")$especial)
  expect_false(.fp_fila(empleo, "1")$especial)
  expect_identical(empleo$base$denominador, "respondieron")
  expect_equal(empleo$total$n, sum(vapply(empleo$filas, function(f) f$n, numeric(1))))
  expect_equal(empleo$base$n, empleo$total$n)
  expect_equal(empleo$base$de, res$casos$cuentan)

  # Opción múltiple guardada en columnas por opción, ya recodificada: el Total
  # son los casos con alguna marca, no la suma de las opciones.
  recod <- .fp_tabla(res, "D1_information_recod")
  expect_identical(recod$tipo, "multiple")
  expect_identical(recod$variable_origen, "D1_information")
  expect_match(recod$etiqueta, "(Recodificada)", fixed = TRUE)
  expect_identical(recod$base$denominador, "marcaron_alguna_opcion")
  expect_gt(sum(vapply(recod$filas, function(f) f$n, numeric(1))), recod$total$n)
  expect_identical(recod$total$pct, 1)

  # Una pregunta sin respuestas: el archivo escribe "Sin datos" y no pone notas.
  vacia <- Filter(function(t) isTRUE(t$sin_datos), res$tablas)
  expect_gt(length(vacia), 0L)
  expect_identical(vacia[[1]]$filas, list())
  expect_identical(vacia[[1]]$notas, list())

  # Guard del propio comparador: una cifra o un rótulo cambiados se detectan.
  mutada <- res$tablas
  mutada[[3]]$filas[[1]]$n <- mutada[[3]]$filas[[1]]$n + 1
  expect_match(.fp_diferencias(mutada, bloques), ": n$", all = FALSE)
  mutada <- res$tablas
  mutada[[3]]$filas <- rev(mutada[[3]]$filas)
  expect_match(.fp_diferencias(mutada, bloques), "opciones o su orden", all = FALSE)
  expect_match(.fp_diferencias(res$tablas[-1], bloques), "número de tablas", all = FALSE)
})

test_that("ponderado, con numérica, orden descendente, secciones y notas: sigue siendo el archivo (acnur_acg)", {
  sid <- .fp_abrir("acg")
  .fp_configurar(sid, function(cfg) {
    cfg$frecuencias$orden <- "desc"
    cfg$frecuencias$mostrar_todo <- TRUE
    cfg$frecuencias$incluir_secciones <- TRUE
    cfg$frecuencias$numericas_override <- list("E1_age")
    cfg$codebook$codigos_solo_si_presentes <- list(98L, 99L)
    cfg$notas <- list(fuente = "Encuesta de prueba", base_defecto = "Total de entrevistados",
                      base_por_pregunta = list(E2_sex = "Personas que declararon su sexo"))
    cfg$ponderacion <- list(enabled = TRUE, modo = "columna", peso_columna = "E1_age")
    cfg
  })
  res <- analitica_frecuencias_preview(sid, limite = 500L)
  bloques <- .fp_leer_archivo(.fp_generar_archivo(sid)[[res$base$nombre]])

  expect_identical(.fp_diferencias(res$tablas, bloques), character(0))
  expect_true(res$ponderado)
  expect_identical(res$ponderacion$estado, "aplicada")
  expect_identical(res$ponderacion$modo, "columna")
  expect_identical(res$ponderacion$peso_columna, "E1_age")
  expect_gt(res$casos$suma_pesos, res$casos$cuentan)

  # Las cifras son sumas de peso: el Total ya no es el número de casos. La base
  # sí lo es (I1): casos sin ponderar, y ya no declara `ponderado`.
  sexo <- .fp_tabla(res, "E2_sex")
  expect_null(sexo$base$ponderado)
  expect_identical(sexo$base$de, res$casos$con_peso)
  expect_identical(sexo$base$n, res$casos$cuentan)
  expect_gt(sexo$total$n, res$casos$cuentan)
  expect_identical(unlist(sexo$notas),
                   c("Fuente: Encuesta de prueba.", "Base: Personas que declararon su sexo."))
  expect_identical(sexo$orden, "desc")
  ns <- vapply(sexo$filas, function(f) f$n, numeric(1))
  expect_false(is.unsorted(rev(ns)))

  # Una lista ordinal conserva el orden del formulario aunque el global sea descendente.
  ordinal <- Filter(function(t) isTRUE(t$lista_ordinal), res$tablas)
  expect_gt(length(ordinal), 0L)
  expect_true(all(vapply(ordinal, function(t) identical(t$orden, "original"), logical(1))))

  # Numérica: los estadísticos del archivo, ni más ni menos; "Casos válidos" sin ponderar.
  edad <- .fp_tabla(res, "E1_age")
  expect_identical(edad$tipo, "numerica")
  expect_identical(
    vapply(edad$resumen, function(r) r$estadistico, character(1)),
    c("Casos válidos", "Promedio", "Desviación estándar", "Mínimo", "Percentil 25",
      "Mediana (Percentil 50)", "Percentil 75", "Máximo")
  )
  expect_identical(edad$base$denominador, "casos_validos")
  expect_null(edad$base$ponderado)
  expect_identical(edad$base$n, as.integer(edad$resumen[[1]]$valor))
  expect_identical(edad$base$de, res$casos$con_peso)
  expect_identical(edad$filas, list())

  # El rótulo de sección sale como en el archivo, sobre la primera tabla de la sección.
  primera <- res$tablas[[1]]
  expect_identical(primera$seccion$rotulo, bloques[[1]]$sobre_titulo)
  expect_identical(primera$seccion$rotulo, toupper(primera$seccion$rotulo))
})

test_that("numéricas con datos, universo de análisis y ponderación (proyecto sintético)", {
  sid <- .fp_abrir("auditoria")
  base <- estudio_active_base(sid)
  .fp_configurar(sid, function(cfg) {
    cfg$frecuencias$numericas_override <- list("edad", "ingreso", "n_hijos")
    cfg$frecuencias$mostrar_todo <- TRUE
    cfg$codebook$codigos_solo_si_presentes <- list(99L)
    cfg
  })

  sin <- analitica_frecuencias_preview(sid)
  bloques <- .fp_leer_archivo(.fp_generar_archivo(sid)[[base]])
  expect_identical(.fp_diferencias(sin$tablas, bloques), character(0))
  expect_true(all(c("unica", "multiple", "numerica") %in% vapply(sin$tablas, function(t) t$tipo, character(1))))
  hijos <- .fp_tabla(sin, "n_hijos")
  expect_lt(hijos$base$n, hijos$base$de)      # hay casos sin dato
  n_base <- sin$casos$cuentan
  expect_identical(n_base, nrow(estudio_data_sources(sid)[[base]]))

  # Universo: solo cuentan los casos con sexo 1 o 2.
  caso_valido_guardar(sid, base, TRUE, list(list(variable = "sexo", operador = "in", valores = list("1", "2"))))
  .fp_configurar(sid, function(cfg) {
    cfg$ponderacion <- list(enabled = TRUE, modo = "columna", peso_columna = "puntaje")
    cfg
  })
  con <- analitica_frecuencias_preview(sid)
  bloques <- .fp_leer_archivo(.fp_generar_archivo(sid)[[base]])
  expect_identical(.fp_diferencias(con$tablas, bloques), character(0))
  # `cuentan` baja al universo declarado: es la misma cifra que publica el motor del universo.
  expect_lt(con$casos$cuentan, n_base)
  expect_identical(con$casos$cuentan, sum(as.character(estudio_data_sources(sid)[[base]]$sexo) %in% c("1", "2")))
  expect_true(con$ponderado)
  sexo <- .fp_tabla(con, "sexo")
  expect_identical(vapply(sexo$filas[vapply(sexo$filas, function(f) f$n > 0, logical(1))],
                          function(f) f$codigo, character(1)) |> sort(), c("1", "2"))
  edad <- .fp_tabla(con, "edad")
  expect_equal(edad$base$n, con$casos$cuentan)
  # La base de cada tabla es el universo, no la base entera.
  expect_identical(con$casos$con_peso, con$casos$cuentan)
  expect_true(all(vapply(con$tablas, function(t) identical(t$base$de, con$casos$con_peso), logical(1))))
  expect_lt(sexo$base$de, n_base)
  expect_identical(sexo$base$n, con$casos$cuentan)
})

test_that("multibase: la vista previa es de la base activa y no cae en la primera", {
  sid <- .fp_abrir("auditoria")
  archivos <- .fp_generar_archivo(sid)
  expect_gte(length(archivos), 2L)
  primera <- names(archivos)[[1]]
  otra <- names(archivos)[[2]]

  estudio_active_base_set(sid, otra)
  res <- analitica_frecuencias_preview(sid)
  expect_identical(res$base$nombre, otra)
  expect_identical(unlist(res$base$bases_del_archivo), names(archivos))
  expect_identical(res$base$n_bases, length(archivos))
  expect_identical(.fp_diferencias(res$tablas, .fp_leer_archivo(archivos[[otra]])), character(0))
  # Las dos bases no dicen lo mismo: comparar contra la primera tiene que fallar.
  expect_gt(length(.fp_diferencias(res$tablas, .fp_leer_archivo(archivos[[primera]]))), 0L)

  estudio_active_base_set(sid, primera)
  res <- analitica_frecuencias_preview(sid)
  expect_identical(res$base$nombre, primera)
  expect_identical(.fp_diferencias(res$tablas, .fp_leer_archivo(archivos[[primera]])), character(0))
})

# --- Selección y recorte -----------------------------------------------------

test_that("variables: filtra en el orden del archivo, sustituye por la recodificada y avisa de lo que no tiene tabla", {
  sid <- .fp_abrir("acg")
  todas <- analitica_frecuencias_preview(sid, limite = 500L)
  orden_archivo <- vapply(todas$tablas, function(t) t$variable, character(1))

  # Pedidas al revés: salen en el orden del archivo, con las mismas cifras.
  res <- analitica_frecuencias_preview(sid, variables = c("E2_sex", "M5_district"))
  expect_identical(vapply(res$tablas, function(t) t$variable, character(1)),
                   intersect(orden_archivo, c("E2_sex", "M5_district")))
  expect_identical(res$total_variables, todas$total_variables)
  expect_identical(res$devueltas, 2L)
  expect_identical(res$tablas[[1]], .fp_tabla(todas, res$tablas[[1]]$variable))
  expect_identical(res$sin_tabla, list())

  # Excluir la pregunta original: el archivo la saca por su recodificada, y pedirla
  # por su nombre original devuelve esa tabla.
  .fp_configurar(sid, function(cfg) {
    cfg$variables_excluidas <- list("D1_information", "E2_sex")
    cfg
  })
  res <- analitica_frecuencias_preview(sid, variables = c("D1_information", "E2_sex", "E1_age", "no_existe"))
  expect_identical(vapply(res$tablas, function(t) t$variable, character(1)), "D1_information_recod")
  expect_identical(res$tablas[[1]]$variable_origen, "D1_information")
  motivos <- stats::setNames(vapply(res$sin_tabla, function(x) x$motivo, character(1)),
                             vapply(res$sin_tabla, function(x) x$variable, character(1)))
  expect_identical(motivos, c(E2_sex = "excluida", E1_age = "fuera_del_archivo", no_existe = "desconocida"))
  aviso <- Filter(function(a) identical(a$codigo, "variables_sin_tabla"), res$avisos)
  expect_length(aviso, 1L)
  expect_match(aviso[[1]]$mensaje, "3 variables pedidas no tienen tabla en el archivo: E2_sex, E1_age, no_existe.", fixed = TRUE)

  # Lista vacía: no se pidió ninguna, no devuelve ninguna.
  vacia <- analitica_frecuencias_preview(sid, variables = character(0))
  expect_identical(vacia$devueltas, 0L)
  expect_identical(vacia$tablas, list())
  expect_gt(vacia$total_variables, 0L)
})

test_that("limite: recorta, lo dice y conserva el orden del archivo", {
  sid <- .fp_abrir("acg")
  todas <- analitica_frecuencias_preview(sid, limite = 500L)
  res <- analitica_frecuencias_preview(sid, limite = 3L)
  expect_true(res$recortado)
  expect_identical(res$devueltas, 3L)
  expect_identical(res$limite, 3L)
  expect_identical(res$total_variables, todas$total_variables)
  expect_identical(res$tablas, todas$tablas[1:3])

  justo <- analitica_frecuencias_preview(sid, limite = todas$total_variables)
  expect_false(justo$recortado)
  expect_identical(justo$devueltas, todas$total_variables)

  # El límite por defecto existe y se declara.
  expect_identical(analitica_frecuencias_preview(sid)$limite, .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO)
})

test_that("es de solo lectura: no marca el proyecto como modificado ni la etapa como generada", {
  sid <- .fp_abrir("acg")
  analitica_frecuencias_preview(sid, limite = 1L)   # la primera lectura prepara las fuentes
  antes <- session_get(sid)
  analitica_frecuencias_preview(sid, limite = 500L)
  despues <- session_get(sid)
  expect_identical(despues$project_dirty, antes$project_dirty)
  expect_identical(despues$project_dirty_reasons, antes$project_dirty_reasons)
  expect_identical(despues$analitica_frecuencias_ok, antes$analitica_frecuencias_ok)
  expect_identical(despues$analitica_status_por_base, antes$analitica_status_por_base)
  expect_identical(length(despues$files), length(antes$files))
})

# --- Reglas del motor sobre una base armada a mano ---------------------------

.fp_args_sinteticos <- function(orden = "desc", mostrar_todo = TRUE) {
  datos <- data.frame(
    voto = c("1", "1", "2", "2", "2", "99", "99", "3", "7", NA),
    acuerdo = c("3", "3", "3", "1", "2", "2", "2", "2", "1", "3"),
    medios = c("a b", "a", "b c", "a b c", "", "a", NA, "c", "b", "a"),
    hijos = c(0, 1, 2, 3, NA, 1, 1, 0, 2, 5),
    peso = c(2, 1, 1, 1, 0.5, 1, 3, 1, 1, 4),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c("select_one l_voto", "select_one l_acuerdo", "select_multiple l_medios", "integer"),
      name = c("voto", "acuerdo", "medios", "hijos"),
      label = c("Voto", "Acuerdo", "Medios", "Hijos"),
      list_name = c("l_voto", "l_acuerdo", "l_medios", NA),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("l_voto", 6), rep("l_acuerdo", 3), rep("l_medios", 3)),
      name = c("1", "2", "3", "4", "98", "99", "1", "2", "3", "a", "b", "c"),
      label = c("Partido A", "Partido B", "No sé / Prefiero no decir", "Partido D", "No sabe", "No responde",
                "En desacuerdo", "Neutral", "De acuerdo", "Radio", "Televisión", "Redes"),
      stringsAsFactors = FALSE
    )
  )
  list(
    data = datos, instrumento = inst,
    secciones = list("Opinión" = c("voto", "acuerdo", "medios"), "Hogar" = c("hijos", "no_esta")),
    orden = orden, mostrar_todo = mostrar_todo,
    incluir_titulos = TRUE, incluir_secciones = TRUE,
    codigos_solo_si_presentes = c(98L, 99L),
    numericas = "hijos",
    ordinal_lists = "l_acuerdo",
    fuente = "Pulso PUCP", notas = list(base_defecto = "Todos"),
    ficha_tecnica = FALSE
  )
}

.fp_archivo_de_args <- function(args, envir = parent.frame()) {
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = envir)
  suppressMessages(do.call(reporte_frecuencias, c(args, list(path_xlsx = path))))
  .fp_leer_archivo(path)
}

test_that("códigos especiales, opciones sin casos, orden y Total de la múltiple salen como en el archivo", {
  args <- .fp_args_sinteticos()
  res <- frecuencias_preview_tablas(args, limite = 50L)
  expect_identical(.fp_diferencias(res$tablas, .fp_archivo_de_args(args)), character(0))
  expect_identical(res$total_variables, 4L)   # "no_esta" no está en la base y no entra
  nombres <- function(t) vapply(t$filas, function(f) f$etiqueta, character(1))
  codigos <- function(t) vapply(t$filas, function(f) f$codigo, character(1))

  voto <- res$tablas[[1]]
  # 99 tiene casos y sale marcado; 98 no los tiene y no aparece aunque se pidan
  # todas las opciones; "Partido D" (4), sin casos, sí aparece con cero.
  expect_true("No responde" %in% nombres(voto))
  expect_false("No sabe" %in% nombres(voto))
  expect_true(.fp_fila(voto, "99")$especial)
  expect_identical(.fp_fila(voto, "4")$n, 0)
  # "7" no está en la lista de respuestas: sale con su valor y sin código.
  expect_true("7" %in% nombres(voto))
  expect_true(is.na(codigos(voto)[nombres(voto) == "7"]))
  # Ponderado: el denominador es la suma de pesos de quienes respondieron (la fila sin dato pesa 4).
  expect_equal(voto$total$n, sum(args$data$peso) - 4)
  # La base, en cambio, son casos: 9 respondieron de 10 con peso > 0.
  expect_identical(voto$base$n, 9L)
  expect_identical(voto$base$de, 10L)
  expect_equal(.fp_fila(voto, "1")$pct, 3 / voto$total$n)

  # Lista ordinal: orden del formulario aunque el global sea descendente.
  acuerdo <- res$tablas[[2]]
  expect_true(acuerdo$lista_ordinal)
  expect_identical(codigos(acuerdo), c("1", "2", "3"))

  # Múltiple con madre pegada: Total = peso de quienes marcaron algo.
  medios <- res$tablas[[3]]
  expect_identical(medios$tipo, "multiple")
  marcaron <- !is.na(args$data$medios) & nzchar(args$data$medios)
  expect_equal(medios$total$n, sum(args$data$peso[marcaron]))
  expect_equal(.fp_fila(medios, "a")$n, sum(args$data$peso[grepl("a", args$data$medios)]))
  expect_gt(sum(vapply(medios$filas, function(f) f$pct, numeric(1))), 1)

  # Numérica: casos válidos sin ponderar, estadísticos ponderados y a un decimal.
  hijos <- res$tablas[[4]]
  expect_identical(hijos$resumen[[1]]$valor, 9)
  expect_equal(hijos$resumen[[2]]$valor, round(stats::weighted.mean(args$data$hijos[-5], args$data$peso[-5]), 1))
  expect_identical(unlist(hijos$notas), c("Fuente: Pulso PUCP.", "Base: Todos."))
})

test_that("el archivo de la base armada a mano no cambió al separar el cálculo de la escritura", {
  # Celdas que escribía `reporte_frecuencias()` antes de extraer las piezas que
  # comparte con la vista previa (misma base, orden descendente, todas las opciones).
  args <- .fp_args_sinteticos()
  path <- withr::local_tempfile(fileext = ".xlsx")
  suppressMessages(do.call(reporte_frecuencias, c(args, list(path_xlsx = path))))
  x <- suppressMessages(readxl::read_excel(path, sheet = "Frecuencias", col_names = FALSE,
                                           col_types = "text", .name_repair = "minimal"))
  col <- function(i) {
    v <- as.character(x[[i]])
    v[is.na(v)] <- ""
    v
  }
  expect_identical(col(1), c(
    "OPINIÓN", "", "Voto", "", "No responde", "Partido A", "Partido B", "7",
    "No sé / Prefiero no decir", "Partido D", "Total", "Fuente: Pulso PUCP.", "Base: Todos.", "",
    "Acuerdo", "", "En desacuerdo", "Neutral", "De acuerdo", "Total", "Fuente: Pulso PUCP.", "Base: Todos.", "",
    "Medios", "", "Radio", "Televisión", "Redes", "Total", "Fuente: Pulso PUCP.", "Base: Todos.", "", "",
    "HOGAR", "", "Hijos", "Estadístico", "Casos válidos", "Promedio", "Desviación estándar", "Mínimo",
    "Percentil 25", "Mediana (Percentil 50)", "Percentil 75", "Máximo", "Fuente: Pulso PUCP.", "Base: Todos."
  ))
  expect_identical(col(2), c(
    "", "", "", "N", "4", "3", "2.5", "1", "1", "0", "11.5", "", "", "",
    "", "N", "2", "5.5", "8", "15.5", "", "", "",
    "", "N", "9", "5", "3", "12", "", "", "", "",
    "", "", "", "Valor", "9", "2.1", "1.9", "0", "1", "1", "5", "5", "", ""
  ))
  pct <- suppressWarnings(as.numeric(col(3)))
  expect_equal(pct[!is.na(pct)],
               c(c(4, 3, 2.5, 1, 1, 0, 11.5) / 11.5, c(2, 5.5, 8, 15.5) / 15.5, c(9, 5, 3, 12) / 12))
})

test_that("orden original: \"No sé / Prefiero no decir\" va al final, como en el archivo", {
  args <- .fp_args_sinteticos(orden = "original", mostrar_todo = FALSE)
  res <- frecuencias_preview_tablas(args)
  expect_identical(.fp_diferencias(res$tablas, .fp_archivo_de_args(args)), character(0))
  voto <- res$tablas[[1]]
  etiquetas <- vapply(voto$filas, function(f) f$etiqueta, character(1))
  expect_identical(etiquetas[length(etiquetas)], "No sé / Prefiero no decir")
  expect_false("Partido D" %in% etiquetas)
})

test_that("dos opciones con el mismo rótulo: el archivo las suma y la fila queda sin código", {
  args <- .fp_args_sinteticos(orden = "original")
  args$instrumento$choices$label[args$instrumento$choices$name == "2" &
                                   args$instrumento$choices$list_name == "l_voto"] <- "Partido A"
  res <- frecuencias_preview_tablas(args, variables = "voto")
  expect_identical(.fp_diferencias(res$tablas, .fp_archivo_de_args(args)[1]), character(0))
  fila <- Filter(function(f) identical(f$etiqueta, "Partido A"), res$tablas[[1]]$filas)
  expect_length(fila, 1L)
  expect_true(is.na(fila[[1]]$codigo))
  expect_equal(fila[[1]]$n, sum(args$data$peso[args$data$voto %in% c("1", "2")]))
})

test_that("si el archivo no tendría tablas, lo dice y no falla", {
  args <- .fp_args_sinteticos()
  args$secciones <- list("Hogar" = "no_esta")
  res <- frecuencias_preview_tablas(args, variables = c("voto"))
  expect_true(res$sin_tablas_en_el_archivo)
  expect_identical(res$total_variables, 0L)
  expect_identical(res$tablas, list())
  expect_identical(res$sin_tabla[[1]], list(variable = "voto", motivo = "fuera_del_archivo"))
  # El motor del archivo falla en ese mismo caso, con la clase que la vista previa reconoce.
  expect_error(.freq_reporte_contexto(args$data, args$instrumento, args$secciones), class = "freq_sin_tablas")
})

# --- Base en casos sin ponderar (contrato v2, regla I1) ----------------------
#
# `base.n` y `base.de` son enteros de casos con peso > 0; las filas y el Total
# siguen siendo sumas de peso, las del archivo.

# Base mínima: una única (`voto`), una múltiple con madre pegada (`medios`) y una
# numérica (`hijos`). `datos` trae esas columnas y, si se quiere, `peso`.
.fp_args_base <- function(datos, etiquetas_medios = c("Radio", "Televisión", "Redes")) {
  inst <- list(
    survey = data.frame(
      type = c("select_one l_voto", "select_multiple l_medios", "integer"),
      name = c("voto", "medios", "hijos"),
      label = c("Voto", "Medios", "Hijos"),
      list_name = c("l_voto", "l_medios", NA),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("l_voto", "l_voto", "l_medios", "l_medios", "l_medios"),
      name = c("1", "2", "a", "b", "c"),
      label = c("Partido A", "Partido B", etiquetas_medios),
      stringsAsFactors = FALSE
    )
  )
  list(
    data = datos, instrumento = inst,
    secciones = list("Todo" = c("voto", "medios", "hijos")),
    orden = "original", mostrar_todo = FALSE,
    incluir_titulos = TRUE, incluir_secciones = FALSE,
    codigos_solo_si_presentes = c(98L, 99L),
    numericas = "hijos", fuente = "Prueba", ficha_tecnica = FALSE
  )
}

.fp_tablas_base <- function(datos, ...) {
  res <- frecuencias_preview_tablas(.fp_args_base(datos, ...), limite = 50L)
  stats::setNames(res$tablas, vapply(res$tablas, function(t) t$variable, character(1)))
}

# Invariantes de toda respuesta: enteros, base.n <= base.de <= casos.cuentan y
# base.de == casos.con_peso.
.fp_invariantes_base <- function(res) {
  for (t in res$tablas) {
    expect_true(is.integer(t$base$n) && length(t$base$n) == 1L && !is.na(t$base$n), label = t$variable)
    expect_true(is.integer(t$base$de) && length(t$base$de) == 1L && !is.na(t$base$de), label = t$variable)
    expect_lte(t$base$n, t$base$de)
    expect_lte(t$base$de, res$casos$cuentan)
    expect_identical(t$base$de, res$casos$con_peso)
    expect_null(t$base$ponderado)
  }
  expect_true(is.integer(res$casos$con_peso))
}

test_that("base sin ponderar en acnur_acg: invariantes sin pesos, con calibración y con columna", {
  sid <- .fp_abrir("acg")
  sin <- analitica_frecuencias_preview(sid, limite = 500L)
  .fp_invariantes_base(sin)
  expect_identical(sin$casos$con_peso, sin$casos$cuentan)
  # Sin pesos la base es el Total del archivo, tabla por tabla.
  for (t in sin$tablas) {
    if (identical(t$tipo, "numerica")) next
    expect_equal(t$base$n, t$total$n, label = t$variable)
  }
  recod <- .fp_tabla(sin, "D1_information_recod")
  expect_lt(recod$base$n, recod$base$de)    # no todos marcaron alguna opción

  .fp_configurar(sid, function(cfg) {
    cfg$ponderacion <- list(enabled = TRUE, rake = list(margins = list(
      list(var = "E2_sex", targets = list(`1` = 0.35, `2` = 0.6, `3` = 0.05))
    )))
    cfg
  })
  con <- suppressWarnings(analitica_frecuencias_preview(sid, limite = 500L))
  expect_true(con$ponderado)
  .fp_invariantes_base(con)
  # Las bases son las mismas que sin pesos; los Totales ya no.
  expect_identical(lapply(con$tablas, function(t) t$base), lapply(sin$tablas, function(t) t$base))
  impacto <- .fp_tabla(con, "E6_impact")
  expect_identical(impacto$base$n, .fp_tabla(sin, "E6_impact")$base$n)
  expect_false(isTRUE(all.equal(impacto$total$n, as.numeric(impacto$base$n))))
})

test_that("con pesos 1.25, 0.5 y 2.2 la base es el conteo y el Total la suma de pesos", {
  datos <- data.frame(
    voto = c("1", "2", "1", NA),
    medios = c("a", "a b", NA, "c"),
    hijos = c(1, 2, 3, NA),
    peso = c(1.25, 0.5, 2.2, 1),
    stringsAsFactors = FALSE
  )
  t <- .fp_tablas_base(datos)
  expect_identical(t$voto$base$n, 3L)
  expect_equal(t$voto$total$n, 1.25 + 0.5 + 2.2)
  expect_identical(t$voto$base$de, 4L)
  expect_identical(t$medios$base$n, 3L)
  expect_equal(t$medios$total$n, 1.25 + 0.5 + 1)
  expect_identical(t$hijos$base$n, 3L)
})

test_that("un caso con peso 0 no entra en base.n ni en base.de", {
  datos <- data.frame(
    voto = c("1", "2", "1", "2"),
    medios = c("a", "b", "a b", "c"),
    hijos = c(1, 2, 3, 4),
    peso = c(1, 0, 1, 1),
    stringsAsFactors = FALSE
  )
  t <- .fp_tablas_base(datos)
  for (v in c("voto", "medios", "hijos")) {
    expect_identical(t[[v]]$base$n, 3L, label = v)
    expect_identical(t[[v]]$base$de, 3L, label = v)
  }
  res <- frecuencias_preview_tablas(.fp_args_base(datos))
  expect_identical(.frecuencias_base_con_peso(datos), 3L)
  expect_lt(.frecuencias_base_con_peso(datos), nrow(datos))
  expect_length(res$tablas, 3L)
})

test_that("numérica con valores 10, 20, NA, 30 y pesos 1, 0, 1, NA: base 1 de 2", {
  datos <- data.frame(
    voto = c("1", "1", "1", "1"),
    medios = c("a", "a", "a", "a"),
    hijos = c(10, 20, NA, 30),
    peso = c(1, 0, 1, NA),
    stringsAsFactors = FALSE
  )
  hijos <- .fp_tablas_base(datos)$hijos
  expect_identical(hijos$tipo, "numerica")
  expect_identical(hijos$base$n, 1L)
  expect_identical(hijos$base$de, 2L)
  expect_identical(hijos$base$denominador, "casos_validos")
  expect_identical(hijos$resumen[[1]]$valor, 1)
})

test_that("múltiple: un caso que marca dos opciones cuenta una vez, con madre pegada o con columnas por opción", {
  datos <- data.frame(
    voto = c("1", "2", "1"),
    medios = c("a b", "a", ""),
    hijos = c(1, 2, 3),
    stringsAsFactors = FALSE
  )
  medios <- .fp_tablas_base(datos)$medios
  expect_identical(medios$base$n, 2L)
  expect_identical(sum(vapply(medios$filas, function(f) f$n, numeric(1))), 3)

  dummies <- data.frame(
    voto = c("1", "2", "1"),
    `medios/a` = c(1, 1, 0), `medios/b` = c(1, 0, 0), `medios/c` = c(0, 0, 0),
    hijos = c(1, 2, 3),
    peso = c(2, 1, 1),
    check.names = FALSE
  )
  medios <- .fp_tablas_base(dummies)$medios
  expect_identical(medios$tipo, "multiple")
  expect_identical(medios$base$n, 2L)
  expect_equal(medios$total$n, 3)
  expect_identical(medios$base$de, 3L)
})

test_that("múltiple con dos opciones del mismo rótulo: el archivo las junta y la base no se duplica", {
  datos <- data.frame(
    voto = c("1", "2", "1", "2"),
    medios = c("a b", "a", "b", "c"),
    hijos = c(1, 2, 3, 4),
    stringsAsFactors = FALSE
  )
  medios <- .fp_tablas_base(datos, etiquetas_medios = c("Radio", "Radio", "Redes"))$medios
  radio <- Filter(function(f) identical(f$etiqueta, "Radio"), medios$filas)
  expect_length(radio, 1L)
  expect_identical(radio[[1]]$n, 4)            # la fila del archivo suma las dos opciones
  expect_identical(medios$base$n, 4L)          # cuatro personas, no cinco marcas
  expect_identical(medios$total$n, 4)
})

test_that("ponderacion.escala: normalizada, expansión, nula sin ponderar y nula con pesos de una columna", {
  sid <- .fp_abrir("acg")
  escala <- function(pond) {
    .fp_configurar(sid, function(cfg) {
      cfg$ponderacion <- pond
      cfg
    })
    suppressWarnings(analitica_frecuencias_preview(sid, variables = "E2_sex"))
  }
  margenes <- list(margins = list(list(var = "E2_sex", targets = list(`1` = 0.4, `2` = 0.55, `3` = 0.05))))

  sin <- escala(NULL)
  expect_identical(sin$ponderacion$escala, NA_character_)
  expect_identical(sin$casos$con_peso, sin$casos$cuentan)

  norm <- escala(list(enabled = TRUE, rake = margenes))
  expect_identical(norm$ponderacion$estado, "aplicada")
  expect_identical(norm$ponderacion$escala, "normalizada")
  expect_equal(norm$casos$suma_pesos, norm$casos$cuentan)

  exp <- escala(list(enabled = TRUE, rake = margenes, escala = "expansion", total_poblacion = 50000))
  expect_identical(exp$ponderacion$escala, "expansion")
  expect_equal(exp$casos$suma_pesos, 50000)
  sexo <- exp$tablas[[1]]
  expect_identical(sexo$base$n, exp$casos$cuentan)
  expect_equal(sexo$total$n, 50000)

  col <- escala(list(enabled = TRUE, modo = "columna", peso_columna = "E1_age"))
  expect_identical(col$ponderacion$modo, "columna")
  expect_identical(col$ponderacion$escala, NA_character_)

  # Configurada pero no aplicada: no hay escala que declarar.
  expect_identical(.frecuencias_base_escala(reporte_ponderacion_estado("no_aplicada", motivo = "x"), list()),
                   NA_character_)
  # Estado derivado sin `escala` (hija que hereda el peso): manda la config.
  heredado <- reporte_ponderacion_estado("aplicada")
  expect_identical(.frecuencias_base_escala(heredado, list(escala = "expansion")), "expansion")
  expect_identical(.frecuencias_base_escala(heredado, list()), "normalizada")
})

test_that("con calibración, filas, Total y resumen siguen siendo los del archivo (acnur_acg)", {
  sid <- .fp_abrir("acg")
  .fp_configurar(sid, function(cfg) {
    cfg$frecuencias$numericas_override <- list("E1_age")
    cfg$ponderacion <- list(enabled = TRUE, rake = list(margins = list(
      list(var = "E2_sex", targets = list(`1` = 0.35, `2` = 0.6, `3` = 0.05))
    )))
    cfg
  })
  res <- suppressWarnings(analitica_frecuencias_preview(sid, limite = 500L))
  bloques <- suppressWarnings(.fp_leer_archivo(.fp_generar_archivo(sid)[[res$base$nombre]]))
  expect_true(res$ponderado)
  expect_identical(.fp_diferencias(res$tablas, bloques), character(0))
  # El comparador ve un Total en casos donde el archivo escribe la suma de pesos.
  mutada <- res$tablas
  i <- which(vapply(mutada, function(t) identical(t$variable, "E6_impact"), logical(1)))
  expect_false(isTRUE(all.equal(mutada[[i]]$total$n, as.numeric(mutada[[i]]$base$n))))
  mutada[[i]]$total$n <- as.numeric(mutada[[i]]$base$n)
  expect_match(.fp_diferencias(mutada, bloques), ": n$", all = FALSE)
})

# --- Entrada -----------------------------------------------------------------

test_that("la entrada inválida se rechaza con E_BAD_REQUEST y dice el campo", {
  campo_de <- function(body) {
    err <- tryCatch(.frecuencias_preview_entrada(body), api_error = function(e) e)
    expect_s3_class(err, "api_error")
    expect_identical(err$status, 400)
    expect_identical(err$code, "E_BAD_REQUEST")
    err$details$campo
  }
  expect_identical(campo_de(list(limite = 0)), "limite")
  expect_identical(campo_de(list(limite = 2.5)), "limite")
  expect_identical(campo_de(list(limite = "10")), "limite")
  expect_identical(campo_de(list(limite = TRUE)), "limite")
  expect_identical(campo_de(list(limite = .FRECUENCIAS_PREVIEW_LIMITE_MAX + 1)), "limite")
  expect_identical(campo_de(list(limite = list(1, 2))), "limite")
  expect_identical(campo_de(list(variables = "sexo")), "variables")
  expect_identical(campo_de(list(variables = list("sexo", 3))), "variables")
  expect_identical(campo_de(list(variables = list("sexo", ""))), "variables")
  expect_identical(campo_de(list(variables = list(a = "sexo"))), "variables")
  expect_identical(campo_de(list(variable = list("sexo"))), "variable")
  expect_identical(campo_de(list("sexo")), "cuerpo")

  expect_identical(.frecuencias_preview_entrada(list()),
                   list(variables = NULL, limite = .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO))
  expect_identical(.frecuencias_preview_entrada(NULL)$limite, .FRECUENCIAS_PREVIEW_LIMITE_DEFECTO)
  ok <- .frecuencias_preview_entrada(list(variables = list(" sexo ", "edad", "sexo"), limite = 7))
  expect_identical(ok, list(variables = c("sexo", "edad"), limite = 7L))
  expect_identical(.frecuencias_preview_entrada(list(variables = list()))$variables, character(0))
})

# --- Contrato HTTP -----------------------------------------------------------

test_that("HTTP: la ruta responde con las cifras sin redondear y rechaza la entrada inválida", {
  srv <- http_contract_server()
  pulso <- .fp_ruta_pulso("reference_projects", "acnur_acg", "acnur_acg.pulso")
  skip_if_not(file.exists(pulso), "sin el proyecto acnur_acg")
  copia <- withr::local_tempdir()
  file.copy(pulso, file.path(copia, "ref.pulso"))
  abierto <- http_post_json(srv, "/api/project/open", body = list(path = file.path(copia, "ref.pulso")))
  expect_identical(abierto$status, 200L)
  sid <- abierto$json$session_id

  r <- http_post_json(srv, "/api/analitica/frecuencias/preview",
                      body = list(variables = list("M5_district"), limite = 5), sid = sid)
  expect_identical(r$status, 200L)
  expect_true(r$json$ok)
  expect_identical(r$json$devueltas, 1L)
  tabla <- r$json$tablas[[1]]
  expect_identical(tabla$variable, "M5_district")
  expect_null(tabla$variable_origen)
  expect_true(is.list(tabla$notas) && identical(tabla$notas[[1]], "Fuente: Pulso PUCP."))
  expect_identical(r$json$sin_tabla, list())
  expect_identical(r$json$avisos, list())

  # Mismas cifras que el motor en proceso, con todos sus decimales.
  local <- .fp_abrir("acg")
  esperado <- analitica_frecuencias_preview(local, variables = "M5_district")$tablas[[1]]
  pct_http <- vapply(tabla$filas, function(f) f$pct, numeric(1))
  pct_motor <- vapply(esperado$filas, function(f) f$pct, numeric(1))
  expect_equal(pct_http, pct_motor, tolerance = 1e-12)
  expect_true(any(abs(pct_motor - round(pct_motor, 4)) > 1e-6))   # el redondeo a 4 decimales se habría notado
  expect_identical(vapply(tabla$filas, function(f) f$codigo, character(1)),
                   vapply(esperado$filas, function(f) f$codigo, character(1)))

  # Sin cuerpo: todas las del archivo hasta el límite por defecto.
  todo <- http_post_json(srv, "/api/analitica/frecuencias/preview", sid = sid)
  expect_identical(todo$status, 200L)
  expect_identical(todo$json$devueltas, todo$json$total_variables)

  malo <- http_post_json(srv, "/api/analitica/frecuencias/preview", body = list(limite = 0), sid = sid)
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code, "E_BAD_REQUEST")
  expect_identical(malo$json$error$details$campo, "limite")
  ajeno <- http_post_json(srv, "/api/analitica/frecuencias/preview", body = list(variable = list("x")), sid = sid)
  expect_identical(ajeno$status, 400L)
  expect_identical(ajeno$json$error$details$campo, "variable")
})
