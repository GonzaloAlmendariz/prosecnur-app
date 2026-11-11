# Vista previa de Cruces (POST /api/analitica/cruces/preview).
#
# La prueba que importa: LO QUE DEVUELVE LA VISTA PREVIA ES LO QUE ESCRIBE EL ARCHIVO. Se genera el XLSX con la
# misma preparación que recibe el trabajo del archivo (`.analitica_cruces_preparar()`) y los mismos argumentos que
# arma su worker, se lee con un lector propio que no usa nada del motor, y se compara tabla por tabla y celda por
# celda: filas, n y proporción de la columna Total y de cada categoría de columna, fila Total, notas al pie y letras.
#
# El archivo se genera en proceso (el worker hace lo mismo con el paquete que carga).

# --- Proyectos ---------------------------------------------------------------

.cp_ruta_pulso <- function(...) {
  ruta <- system.file(..., package = "prosecnurapp")
  if (!nzchar(ruta)) ruta <- testthat::test_path("..", "..", "inst", ...)
  ruta
}

.cp_abrir <- function(cual = c("acg", "pdm"), envir = parent.frame()) {
  cual <- match.arg(cual)
  pulso <- switch(cual,
    acg = .cp_ruta_pulso("reference_projects", "acnur_acg", "acnur_acg.pulso"),
    pdm = .cp_ruta_pulso("reference_projects", "acnur_pdm", "acnur_pdm.pulso")
  )
  testthat::skip_if_not(file.exists(pulso), paste("sin el proyecto", cual))
  copia <- withr::local_tempdir(.local_envir = envir)
  file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso")))
  withr::defer(session_delete(ld$session_id), envir = envir)
  ld$session_id
}

.cp_configurar <- function(sid, cambiar, regla = NULL) {
  cfg <- cambiar(.analitica_config_get(sid))
  .analitica_config_set(sid, cfg)
  if (!is.null(regla)) {
    gc <- .graficos_config_get(sid)
    gc$significancia <- regla
    .graficos_config_set(sid, gc)
  }
  invisible(cfg)
}

# Configuración de acnur_acg: distrito y sexo (sin "Otro") como cruces, edad numérica y letras.
.cp_cfg_acg <- function(cfg) {
  cfg$cruces$cruces_vars <- list(list(name = "M5_district"), list(name = "E2_sex", excluidas = list("3")))
  cfg$cruces$show_sig <- TRUE
  cfg$numericas <- list("E1_age")
  cfg
}

.cp_calibrar <- function(cfg) {
  cfg$ponderacion <- list(enabled = TRUE, rake = list(margins = list(
    list(var = "M3_edu", targets = list(`1` = 0.2, `2` = 0.45, `3` = 0.35)))))
  cfg
}

# El archivo de la base `base`, con los argumentos que arma el worker de POST /api/analitica/cruces.
.cp_generar_archivo <- function(sid, base) {
  p <- suppressWarnings(.analitica_cruces_preparar(sid, modo = "estandar"))
  previa <- suppressMessages(.sig_informe_preparar(p$sig_estudio, p$data_sources, p$inst_sources, base))
  on.exit(options(previa), add = TRUE)
  out <- tempfile(fileext = ".xlsx")
  suppressWarnings(suppressMessages(reporte_cruces(
    data = p$data_sources[[base]], instrumento = p$inst_sources[[base]], SECCIONES = p$secs,
    cruces = p$cruces_val, modo = p$modo, path_xlsx = out,
    numericas = if (length(p$numericas_arg) > 0L) p$numericas_arg else NULL,
    show_sig = p$show_sig, alpha = p$alpha,
    significancia = .cruces_significancia_normalizar(.sig_spec_vigente(p$significancia)),
    incluir_total = p$incluir_total, incluir_titulos = p$incluir_titulos, incluir_secciones = p$incluir_secciones,
    orden = p$orden_cruces, ordinal_lists = p$ordinal_lists_by_base[[base]] %||% character(0),
    repeat_design = p$repeat_design_by_base[[base]],
    fuente = (p$notas %||% list())$fuente %||% "Pulso PUCP", notas = p$notas,
    ficha_tecnica = FALSE
  )))
  out
}

# --- Lector del archivo (independiente del motor) ----------------------------
#
# Una tabla categórica empieza en la fila cuyas columnas 2 y 3 dicen "n" y "%" (tercera fila del encabezado). Sobre
# ella, el rótulo de cada columna y, dos filas arriba, el de su variable de cruce (combinado: se arrastra a la
# derecha). El cuerpo llega hasta la fila "Total"; debajo, las notas, y si las hay, la subtabla de letras.
.cp_leer_archivo <- function(path) {
  x <- suppressMessages(readxl::read_excel(path, sheet = "Cruces", col_names = FALSE, col_types = "list",
                                           .name_repair = "minimal"))
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
    if (!identical(txt(2, i), "n") || !identical(txt(3, i), "%")) next
    cols <- 2L
    while (identical(txt(cols + 2L, i), "n")) cols <- cols + 2L
    pares <- seq(2L, cols, by = 2L)
    h1 <- character(0)
    ultimo <- NA_character_
    for (c in pares) {
      if (!is.na(txt(c, i - 2L))) ultimo <- txt(c, i - 2L)
      h1 <- c(h1, ultimo)
    }
    h2 <- vapply(pares, function(c) txt(c, i - 1L), character(1))
    j <- i + 1L
    filas <- list()
    while (j <= n && !identical(txt(1, j), "Total")) {
      filas[[length(filas) + 1L]] <- list(
        etiqueta = txt(1, j),
        n = vapply(pares, function(c) num(c, j), numeric(1)),
        pct = vapply(pares, function(c) num(c + 1L, j), numeric(1))
      )
      j <- j + 1L
    }
    total <- list(n = vapply(pares, function(c) num(c, j), numeric(1)),
                  pct = vapply(pares, function(c) num(c + 1L, j), numeric(1)))
    j <- j + 1L
    notas <- character(0)
    while (j <= n && !is.na(txt(1, j)) && !identical(txt(1, j), "Comparaciones de proporciones de columna")) {
      notas <- c(notas, txt(1, j))
      j <- j + 1L
    }
    letras <- NULL
    if (identical(txt(1, j), "Comparaciones de proporciones de columna")) {
      ncol_sig <- 1L
      while (!is.na(txt(ncol_sig + 1L, j + 2L))) ncol_sig <- ncol_sig + 1L
      letras <- lapply(seq_along(filas), function(k) {
        vapply(seq_len(ncol_sig - 1L) + 1L, function(c) {
          v <- txt(c, j + 2L + k)
          if (is.na(v)) "" else v
        }, character(1))
      })
      encabezado_letras <- vapply(seq_len(ncol_sig - 1L) + 1L, function(c) txt(c, j + 2L), character(1))
      attr(letras, "encabezado") <- encabezado_letras
      attr(letras, "nota") <- txt(1, j + 3L + length(filas))
    }
    bloques[[length(bloques) + 1L]] <- list(
      titulo = txt(1, i - 3L), h1 = h1, h2 = h2, filas = filas, total = total, notas = notas, letras = letras
    )
  }
  bloques
}

# Diferencias entre las tablas de la vista previa y los bloques del archivo. Vacío significa "idénticas".
.cp_diferencias <- function(tablas, bloques, tol = 1e-9) {
  dif <- character(0)
  nota <- function(...) dif <<- c(dif, paste0(...))
  igual <- function(a, b) {
    length(a) == length(b) && all(is.na(a) == is.na(b)) &&
      all(abs(a - b)[!is.na(a)] <= tol * pmax(1, abs(b[!is.na(a)])))
  }
  tablas <- Filter(function(t) !isTRUE(t$sin_datos), tablas)
  if (length(tablas) != length(bloques)) {
    nota("número de tablas: vista previa ", length(tablas), ", archivo ", length(bloques))
    return(dif)
  }
  for (k in seq_along(tablas)) {
    t <- tablas[[k]]
    b <- bloques[[k]]
    v <- t$variable
    if (!identical(t$etiqueta, b$titulo)) nota(v, ": título")
    if (!identical(vapply(t$filas, function(f) f$etiqueta, character(1)),
                   vapply(b$filas, function(f) f$etiqueta, character(1)))) nota(v, ": filas")
    if (!identical(as.character(unlist(t$notas)), b$notas)) nota(v, ": notas al pie")
    # Columnas de la vista previa en el orden del archivo: Total y, por cruce, sus categorías.
    cols <- c(list(list(h1 = NA_character_, h2 = "Total", n = t$total$n, celdas = t$total$celdas)),
              unlist(lapply(t$cruces, function(cr) lapply(cr$columnas, function(co) {
                list(h1 = cr$etiqueta, h2 = co$etiqueta, n = co$n, celdas = co$celdas)
              })), recursive = FALSE))
    if (length(cols) != length(b$h2)) {
      nota(v, ": número de columnas ", length(cols), " frente a ", length(b$h2))
      next
    }
    for (c in seq_along(cols)) {
      co <- cols[[c]]
      if (!identical(co$h2, b$h2[[c]])) nota(v, ": rótulo de la columna ", c)
      if (c > 1L && !identical(co$h1, b$h1[[c]])) nota(v, ": variable de cruce de la columna ", c)
      if (!igual(co$n, b$total$n[[c]])) nota(v, ": Total de la columna ", co$h2)
      n_p <- vapply(co$celdas, function(x) x$n, numeric(1))
      pct_p <- vapply(co$celdas, function(x) x$pct, numeric(1))
      if (!identical(vapply(co$celdas, function(x) x$fila, character(1)),
                     vapply(t$filas, function(f) f$codigo, character(1)))) nota(v, ": códigos de fila de ", co$h2)
      if (!igual(n_p, vapply(b$filas, function(f) f$n[[c]], numeric(1)))) nota(v, ": n de ", co$h2)
      if (!igual(pct_p, vapply(b$filas, function(f) f$pct[[c]], numeric(1)))) nota(v, ": % de ", co$h2)
    }
    con_letras <- Filter(function(cr) !is.null(cr$significancia), t$cruces)
    if (is.null(b$letras) != !length(con_letras)) {
      nota(v, ": subtabla de letras")
      next
    }
    if (length(con_letras)) {
      esperado <- unlist(lapply(con_letras, function(cr) vapply(cr$columnas, function(co) {
        paste0(co$etiqueta, " (", co$letra, ")")
      }, character(1))))
      if (!identical(esperado, attr(b$letras, "encabezado"))) nota(v, ": encabezado de letras")
      for (i in seq_along(t$filas)) {
        prev <- unlist(lapply(con_letras, function(cr) vapply(cr$columnas, function(co) {
          l <- co$celdas[[i]]$letras
          if (is.na(l)) "" else l
        }, character(1))))
        if (!identical(prev, b$letras[[i]])) nota(v, ": letras de la fila ", t$filas[[i]]$etiqueta)
      }
      if (!identical(t$significancia$nota, attr(b$letras, "nota"))) nota(v, ": nota de letras")
    }
  }
  dif
}

.cp_tabla <- function(res, variable) {
  Filter(function(t) identical(t$variable, variable), res$tablas)[[1]]
}

.cp_columna <- function(tabla, cruce, codigo) {
  cr <- Filter(function(x) identical(x$variable, cruce), tabla$cruces)[[1]]
  Filter(function(co) identical(co$codigo, codigo), cr$columnas)[[1]]
}

# Invariantes de la base (regla I1) en todas las tablas de una respuesta.
.cp_invariantes_base <- function(res) {
  for (t in res$tablas) {
    if (isTRUE(t$sin_datos)) next
    expect_true(is.integer(t$total$base_n), label = t$variable)
    expect_lte(t$total$base_n, res$casos$con_peso)
    for (cr in t$cruces) for (co in cr$columnas) {
      expect_true(is.integer(co$base_n), label = paste(t$variable, co$codigo))
      expect_lte(co$base_n, t$total$base_n)
      if (!isTRUE(res$ponderado)) expect_equal(co$base_n, co$n_ponderado, label = paste(t$variable, co$codigo))
    }
  }
}

# --- El archivo y la vista previa son lo mismo -------------------------------

test_that("sin ponderar: cada cifra y cada letra de la vista previa es la del archivo (acnur_acg)", {
  skip_if_not_installed("readxl")
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, .cp_cfg_acg)
  res <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  expect_true(res$ok)
  expect_false(res$ponderado)
  expect_identical(res$escala_pct, "proporcion")
  expect_identical(res$devueltas, res$total_variables)
  expect_gt(res$devueltas, 20L)
  # Única y múltiple.
  expect_identical(.cp_tabla(res, "E6_impact")$tipo, "unica")
  multiple <- .cp_tabla(res, "D1_information")
  expect_identical(multiple$tipo, "multiple")
  expect_identical(multiple$denominador, "marcaron_alguna_opcion")
  # La numérica la escribe el archivo y la vista previa lo dice.
  expect_identical(Filter(function(x) identical(x$variable, "E1_age"), res$sin_tabla)[[1]]$motivo, "numerica")
  expect_true("numericas_sin_vista_previa" %in% vapply(res$avisos, function(a) a$codigo, character(1)))

  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, res$base$nombre))
  expect_identical(.cp_diferencias(res$tablas, bloques), character(0))
  .cp_invariantes_base(res)

  # El comparador ve una celda movida y una letra cambiada.
  mutada <- res$tablas
  i <- which(vapply(mutada, function(t) identical(t$variable, "E6_impact"), logical(1)))
  mutada[[i]]$cruces[[1]]$columnas[[2]]$celdas[[1]]$n <- mutada[[i]]$cruces[[1]]$columnas[[2]]$celdas[[1]]$n + 1
  expect_match(.cp_diferencias(mutada, bloques), "E6_impact: n de ", all = FALSE)
})

test_that("con calibración: n y porcentajes ponderados son los del archivo y la base sigue en casos (acnur_acg)", {
  skip_if_not_installed("readxl")
  sid <- .cp_abrir("acg")
  sin <- {
    .cp_configurar(sid, .cp_cfg_acg)
    suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  }
  .cp_configurar(sid, function(cfg) .cp_calibrar(.cp_cfg_acg(cfg)))
  res <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  expect_true(res$ponderado)
  expect_identical(res$ponderacion$estado, "aplicada")
  expect_identical(res$ponderacion$escala, "normalizada")

  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, res$base$nombre))
  expect_identical(.cp_diferencias(res$tablas, bloques), character(0))
  .cp_invariantes_base(res)

  # La base es la misma con y sin pesos; el denominador ponderado no.
  impacto <- .cp_tabla(res, "E6_impact")
  impacto_sin <- .cp_tabla(sin, "E6_impact")
  col <- .cp_columna(impacto, "M5_district", "smp")
  col_sin <- .cp_columna(impacto_sin, "M5_district", "smp")
  expect_identical(col$base_n, col_sin$base_n)
  expect_identical(impacto$total$base_n, impacto_sin$total$base_n)
  expect_false(isTRUE(all.equal(col$n_ponderado, as.numeric(col$base_n))))
  expect_equal(col$n, round(col$n_ponderado))
})

# --- Base sin ponderar (regla I1) --------------------------------------------

# Sin instrumento el motor trata como múltiple toda variable que sea columna (`tipo_pregunta()`): el tipo se declara.
.cp_survey <- data.frame(name = c("voto", "medios", "grupo"),
                         type = c("select_one v", "select_multiple m", "select_one g"),
                         label = c("Voto", "Medios", "Grupo"), stringsAsFactors = FALSE)

.cp_tabla_sintetica <- function(datos, var, cruce = "grupo") {
  tb <- .cruces_tabla_archivo(datos, var, cruce, survey = .cp_survey, notas = .notas_pie_normalizar(NULL),
                              casos_sin_ponderar = TRUE)
  .cruces_preview_tabla(tb, "S", NA_character_, NA_character_)
}

test_that("base: entera, sin ponderar, peso 0 fuera y en una múltiple cada persona una vez", {
  datos <- data.frame(
    voto = c("1", "2", "1", "2", "1"),
    medios = c("a b", "a", "b", "c", ""),
    grupo = c("x", "x", "y", "y", "y"),
    peso = c(1.25, 0.5, 2.2, 0, 1),
    stringsAsFactors = FALSE
  )
  medios <- .cp_tabla_sintetica(datos, "medios")
  expect_identical(medios$tipo, "multiple")
  x <- .cp_columna(medios, "grupo", "x")
  y <- .cp_columna(medios, "grupo", "y")
  expect_identical(x$base_n, 2L)            # dos personas; una marcó dos opciones
  expect_equal(x$n_ponderado, 1.75)
  expect_identical(y$base_n, 1L)            # peso 0 y "sin marcar" quedan fuera
  expect_equal(y$n_ponderado, 2.2)
  expect_identical(medios$total$base_n, 3L)
  expect_equal(sum(vapply(x$celdas, function(c) c$n, numeric(1))), 1.25 + 1.25 + 0.5)   # marcas, no personas

  voto <- .cp_tabla_sintetica(datos, "voto")
  y <- .cp_columna(voto, "grupo", "y")
  expect_identical(voto$denominador, "validos_de_la_columna")
  expect_identical(y$base_n, 2L)
  expect_equal(y$n_ponderado, 3.2)
  expect_identical(voto$total$base_n, 4L)
  expect_true(is.integer(voto$total$base_n))

  sin_pesos <- .cp_tabla_sintetica(datos[setdiff(names(datos), "peso")], "voto")
  for (co in sin_pesos$cruces[[1]]$columnas) expect_equal(co$base_n, co$n_ponderado)
  expect_equal(sin_pesos$total$base_n, sin_pesos$total$n_ponderado)
})

test_that("dos opciones con el mismo rótulo: el archivo deja la segunda fuera y la vista previa lo dice", {
  datos <- data.frame(voto = c("1", "2", "3"), grupo = c("x", "x", "y"), stringsAsFactors = FALSE)
  inst <- list(orders_list = list(voto = list(names = c("1", "2", "3"), labels = c("Sí", "Sí", "No"))))
  tb <- .cruces_tabla_archivo(datos, "voto", "grupo", orders_list = inst$orders_list,
                              notas = .notas_pie_normalizar(NULL), casos_sin_ponderar = TRUE)
  expect_identical(tb$codes_row, c("1", "3"))
  expect_identical(tb$omitidas, list(list(codigo = "2", etiqueta = "Sí", motivo = "rotulo_repetido")))
})

test_that("las letras se leen por código de fila y de columna; si la matriz no corresponde, error interno", {
  m <- matrix(c("B", "", ".b", ".b"), 2, 2, dimnames = list(c("1", "2"), c("x", "y")))
  bl <- list(letras = m)
  expect_identical(.cruces_preview_letras(bl, c("1", "2"), c("Sí", "No"), "y"), c(".b", ".b"))
  expect_identical(.cruces_preview_letras(bl, c("9", "8"), c("1", "2"), "x"), c("B", ""))   # por rótulo de fila
  expect_null(.cruces_preview_letras(NULL, c("1", "2"), c("Sí", "No"), "x"))
  err <- tryCatch(suppressMessages(.cruces_preview_letras(bl, c("2", "1"), c("No", "Sí"), "x")), api_error = function(e) e)
  expect_identical(err$code, "E_INTERNAL")
  err <- tryCatch(suppressMessages(.cruces_preview_letras(bl, c("1", "2"), c("Sí", "No"), "z")), api_error = function(e) e)
  expect_identical(err$code, "E_INTERNAL")
  expect_false(grepl("letras", err$message))   # el detalle queda en stderr, no en la respuesta
})

# --- Entrada, recorte, filtros y casos sin tablas -----------------------------

test_that("la entrada inválida se rechaza con E_BAD_REQUEST y dice el campo", {
  campo_de <- function(body) {
    err <- tryCatch(.cruces_preview_entrada(body), api_error = function(e) e)
    expect_s3_class(err, "api_error")
    expect_identical(err$status, 400)
    expect_identical(err$code, "E_BAD_REQUEST")
    err$details$campo
  }
  expect_identical(campo_de(list(limite = 0)), "limite")
  expect_identical(campo_de(list(limite = 2.5)), "limite")
  expect_identical(campo_de(list(limite = "10")), "limite")
  expect_identical(campo_de(list(limite = .CRUCES_PREVIEW_LIMITE_MAX + 1)), "limite")
  expect_identical(campo_de(list(variables = "sexo")), "variables")
  expect_identical(campo_de(list(variables = list("sexo", 3))), "variables")
  expect_identical(campo_de(list(cruces = list(""))), "cruces")
  expect_identical(campo_de(list(cruces = list(a = "sexo"))), "cruces")
  expect_identical(campo_de(list(cruce = list("sexo"))), "cruce")
  expect_identical(campo_de(list("sexo")), "cuerpo")

  expect_identical(.cruces_preview_entrada(NULL),
                   list(variables = NULL, cruces = NULL, limite = .CRUCES_PREVIEW_LIMITE_DEFECTO))
  ok <- .cruces_preview_entrada(list(variables = list(" a ", "b", "a"), cruces = list("s"), limite = 7))
  expect_identical(ok, list(variables = c("a", "b"), cruces = "s", limite = 7L))
})

test_that("sin base preparada: 409 E_NO_RP_DATA", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  err <- tryCatch(analitica_cruces_preview(sid), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$status, 409)
  expect_identical(err$code, "E_NO_RP_DATA")
})

test_that("recorte, filtro de variables y de cruces, en el orden del archivo y sin descartar en silencio", {
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, function(cfg) {
    cfg <- .cp_cfg_acg(cfg)
    cfg$cruces$show_sig <- FALSE
    cfg$variables_excluidas <- list("A1_leg")
    cfg
  })
  todo <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  orden <- vapply(todo$tablas, function(t) t$variable, character(1))

  corto <- suppressWarnings(analitica_cruces_preview(sid, limite = 3L))
  expect_true(corto$recortado)
  expect_identical(corto$devueltas, 3L)
  expect_identical(vapply(corto$tablas, function(t) t$variable, character(1)), orden[1:3])
  defecto <- suppressWarnings(analitica_cruces_preview(sid))
  expect_identical(defecto$devueltas, min(.CRUCES_PREVIEW_LIMITE_DEFECTO, length(orden)))

  pedidas <- suppressWarnings(analitica_cruces_preview(sid, variables = c("E6_impact", "M3_edu", "A1_leg", "nada"),
                                                       cruces = c("E2_sex", "otra")))
  expect_identical(vapply(pedidas$tablas, function(t) t$variable, character(1)),
                   orden[orden %in% c("E6_impact", "M3_edu")])
  motivos <- stats::setNames(vapply(pedidas$sin_tabla, function(x) x$motivo, character(1)),
                             vapply(pedidas$sin_tabla, function(x) x$variable, character(1)))
  expect_identical(motivos[["A1_leg"]], "excluida")
  expect_identical(motivos[["nada"]], "desconocida")
  # Solo las columnas de sexo, con las mismas cifras que con todos los cruces.
  impacto <- .cp_tabla(pedidas, "E6_impact")
  expect_identical(vapply(impacto$cruces, function(c) c$variable, character(1)), "E2_sex")
  expect_identical(impacto$cruces[[1]], Filter(function(c) identical(c$variable, "E2_sex"), .cp_tabla(todo, "E6_impact")$cruces)[[1]])
  sin_col <- vapply(pedidas$cruces_sin_columnas, function(x) paste(x$variable, x$motivo), character(1))
  expect_identical(sin_col, "otra no_configurada")
  expect_true(all(c("variables_sin_tabla", "cruces_sin_columnas") %in% vapply(pedidas$avisos, function(a) a$codigo, character(1))))
})

test_that("sin variables de cruce configuradas: 200 con tablas vacías y un aviso", {
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list()
    cfg
  })
  res <- analitica_cruces_preview(sid)
  expect_true(res$ok)
  expect_identical(res$tablas, list())
  expect_identical(res$devueltas, 0L)
  expect_identical(vapply(res$avisos, function(a) a$codigo, character(1)), "sin_variables_de_cruce")
})

test_that("categorías de cruce excluidas: salen de toda la base, su columna queda vacía y marcada, y una exclusión vacía se avisa", {
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, function(cfg) {
    cfg <- .cp_cfg_acg(cfg)
    cfg$cruces$cruces_vars <- list(list(name = "E2_sex", excluidas = list("3")),
                                   list(name = "M3_edu", excluidas = list("9")))
    cfg
  })
  res <- suppressWarnings(analitica_cruces_preview(sid, variables = "E6_impact"))
  sexo <- Filter(function(c) identical(c$variable, "E2_sex"), .cp_tabla(res, "E6_impact")$cruces)[[1]]
  # El archivo escribe la columna de "Otro" sin casos: la vista previa la devuelve igual y la marca.
  expect_identical(vapply(sexo$columnas, function(co) co$codigo, character(1)), c("1", "2", "3"))
  expect_identical(vapply(sexo$columnas, function(co) co$excluida, logical(1)), c(FALSE, FALSE, TRUE))
  otro <- sexo$columnas[[3]]
  expect_identical(otro$base_n, 0L)
  expect_identical(otro$n, 0)
  expect_true(all(is.na(vapply(otro$celdas, function(c) c$pct, numeric(1)))))
  expect_identical(res$casos$antes_de_excluir - res$casos$cuentan, 2L)   # los dos casos de "Otro"
  ex <- stats::setNames(lapply(res$exclusiones, function(x) x$categorias), vapply(res$exclusiones, function(x) x$variable, character(1)))
  expect_identical(ex$E2_sex[[1]], list(codigo = "3", filas = 2L))
  expect_identical(ex$M3_edu[[1]], list(codigo = "9", filas = 0L))
  aviso <- Filter(function(a) identical(a$codigo, "exclusion_sin_casos"), res$avisos)
  expect_length(aviso, 1L)
  expect_match(aviso[[1]]$mensaje, "M3_edu = 9", fixed = TRUE)
})

# --- Significancia -----------------------------------------------------------

test_that("letras con la regla del estudio y con la de siempre: las del archivo, con método y motivo", {
  skip_if_not_installed("readxl")
  sid <- .cp_abrir("acg")
  cfg_edu <- function(cfg) {
    cfg <- .cp_cfg_acg(cfg)
    cfg$cruces$cruces_vars <- list(list(name = "M5_district"), list(name = "M3_edu"))
    cfg
  }
  .cp_configurar(sid, cfg_edu)
  siempre <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, siempre$base$nombre))
  expect_identical(.cp_diferencias(siempre$tablas, bloques), character(0))
  info <- .cp_tabla(siempre, "D1_information")
  expect_identical(info$cruces[[1]]$significancia$metodo, "regla_z")
  # "Primaria o menos" tiene entre 20 y 30 casos en esta pregunta: con la base mínima de siempre (30) no se compara.
  primaria <- .cp_columna(info, "M3_edu", "1")
  expect_gte(primaria$base_n, 20L)
  expect_lt(primaria$base_n, 30L)
  expect_identical(primaria$motivo, "base_insuficiente")
  expect_true(all(vapply(primaria$celdas, function(c) c$letras %in% c(".b", ""), logical(1))))
  expect_match(info$significancia$nota, "menos de 30 casos", fixed = TRUE)
  # E6_impact (37 casos): ningún distrito llega a la base mínima.
  dist <- Filter(function(c) identical(c$variable, "M5_district"), .cp_tabla(siempre, "E6_impact")$cruces)[[1]]
  expect_true(all(vapply(dist$columnas, function(co) identical(co$motivo, "base_insuficiente"), logical(1))))

  # La regla del estudio con base mínima 20: la columna sí se compara, y las letras siguen siendo las del archivo.
  .cp_configurar(sid, cfg_edu,
                 regla = list(prueba = "z", correccion = "bonferroni_fila", base_minima = 20, umbral_puntos = 5))
  estudio <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, estudio$base$nombre))
  expect_identical(.cp_diferencias(estudio$tablas, bloques), character(0))
  info <- .cp_tabla(estudio, "D1_information")
  expect_true(is.na(.cp_columna(info, "M3_edu", "1")$motivo))
  expect_match(info$significancia$nota, "menos de 20 casos", fixed = TRUE)
  expect_match(info$significancia$nota, "al menos 5 puntos", fixed = TRUE)

  # Sin significancia: sin letras, sin método y el archivo sin subtabla.
  .cp_configurar(sid, function(cfg) {
    cfg <- cfg_edu(cfg)
    cfg$cruces$show_sig <- FALSE
    cfg
  })
  apagada <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, apagada$base$nombre))
  expect_identical(.cp_diferencias(apagada$tablas, bloques), character(0))
  t <- .cp_tabla(apagada, "D1_information")
  expect_null(t$significancia)
  expect_null(t$cruces[[1]]$significancia)
  expect_true(is.na(t$cruces[[1]]$columnas[[1]]$letra))
  expect_true(is.na(t$cruces[[1]]$columnas[[1]]$celdas[[1]]$letras))
  expect_true(all(vapply(bloques, function(b) is.null(b$letras), logical(1))))
  # La vista previa no deja la regla fijada en el proceso.
  expect_null(getOption("prosecnur.sig_informe"))
})

# --- Grupo repetido ------------------------------------------------------------

test_that("hija repeat (acnur_pdm): cada tabla en su grano y con las cifras del archivo", {
  skip_if_not_installed("readxl")
  sid <- .cp_abrir("pdm")
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list(list(name = "timing"), list(name = "transport", excluidas = list("colective")))
    cfg$cruces$show_sig <- TRUE
    cfg$secciones <- list(
      list(id = "a", nombre = "Llegada", variables = list("conocimiento", "common_spaces", "Feel_safe_reporting")),
      list(id = "b", nombre = "Servicios", variables = list("srv_claridad", "srv_satisfaccion"))
    )
    cfg$ponderacion <- list(enabled = TRUE, rake = list(margins = list(
      list(var = "timing", targets = list(less15 = 0.3, `15_30` = 0.3, `30_1h` = 0.2, `1_2h` = 0.1, more_2h = 0.1)))))
    cfg
  })
  estudio_active_base_set(sid, "rep_servicios")
  res <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  expect_identical(res$base$nombre, "rep_servicios")
  expect_true(res$ponderado)
  granos <- stats::setNames(vapply(res$tablas, function(t) t$grano, character(1)),
                            vapply(res$tablas, function(t) t$variable, character(1)))
  expect_identical(granos[["conocimiento"]], "encuestado")
  expect_identical(granos[["srv_satisfaccion"]], "registro")

  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, "rep_servicios"))
  expect_identical(.cp_diferencias(res$tablas, bloques), character(0))
  .cp_invariantes_base(res)
  # La tabla del encuestado cuenta personas: su base no pasa de las filas de la madre.
  madre <- suppressWarnings(.analitica_cruces_preparar(sid, modo = "estandar"))$data_sources[[1]]
  expect_lte(.cp_tabla(res, "conocimiento")$total$base_n, nrow(madre))
  expect_gt(.cp_tabla(res, "srv_satisfaccion")$total$base_n, nrow(madre))
})

# --- Contrato HTTP -----------------------------------------------------------

test_that("HTTP: la ruta responde con las cifras sin redondear y rechaza la entrada inválida", {
  srv <- http_contract_server()
  pulso <- .cp_ruta_pulso("reference_projects", "acnur_acg", "acnur_acg.pulso")
  skip_if_not(file.exists(pulso), "sin el proyecto acnur_acg")
  copia <- withr::local_tempdir()
  file.copy(pulso, file.path(copia, "ref.pulso"))
  abierto <- http_post_json(srv, "/api/project/open", body = list(path = file.path(copia, "ref.pulso")))
  expect_identical(abierto$status, 200L)
  sid <- abierto$json$session_id

  r <- http_post_json(srv, "/api/analitica/cruces/preview",
                      body = list(variables = list("E6_impact"), limite = 5), sid = sid)
  expect_identical(r$status, 200L)
  expect_true(r$json$ok)
  expect_identical(r$json$devueltas, 1L)
  expect_identical(r$json$escala_pct, "proporcion")
  tabla <- r$json$tablas[[1]]
  expect_identical(tabla$variable, "E6_impact")
  columna <- tabla$cruces[[1]]$columnas[[1]]
  expect_identical(columna$codigo, "smp")
  expect_true(is.numeric(columna$base_n))

  local <- .cp_abrir("acg")
  esperado <- analitica_cruces_preview(local, variables = "E6_impact")$tablas[[1]]$cruces[[1]]$columnas[[1]]
  pct_http <- vapply(columna$celdas, function(c) c$pct, numeric(1))
  pct_motor <- vapply(esperado$celdas, function(c) c$pct, numeric(1))
  expect_equal(pct_http, pct_motor, tolerance = 1e-12)
  expect_true(any(abs(pct_motor - round(pct_motor, 4)) > 1e-6))   # el redondeo a 4 decimales se habría notado
  expect_identical(vapply(columna$celdas, function(c) c$fila, character(1)),
                   vapply(esperado$celdas, function(c) c$fila, character(1)))

  malo <- http_post_json(srv, "/api/analitica/cruces/preview", body = list(limite = 0), sid = sid)
  expect_identical(malo$status, 400L)
  expect_identical(malo$json$error$code, "E_BAD_REQUEST")
  expect_identical(malo$json$error$details$campo, "limite")
  ajeno <- http_post_json(srv, "/api/analitica/cruces/preview", body = list(cruce = list("x")), sid = sid)
  expect_identical(ajeno$status, 400L)
  expect_identical(ajeno$json$error$details$campo, "cruce")
})
