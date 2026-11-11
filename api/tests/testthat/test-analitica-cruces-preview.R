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
      # `n` de la columna es la suma de pesos sin redondear; la fila Total del archivo la escribe redondeada.
      if (!igual(round(co$n, 0), b$total$n[[c]])) nota(v, ": Total de la columna ", co$h2)
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
      # El archivo rotula siempre la columna con su letra; la vista previa la anula "frente al resto".
      esperado <- unlist(lapply(con_letras, function(cr) vapply(seq_along(cr$columnas), function(j) {
        co <- cr$columnas[[j]]
        publica <- !identical(cr$significancia$modo, "frente_al_resto") &&
          !identical(cr$significancia$motivo, "letras_por_rotulo_no_calculadas")
        if (publica && !identical(co$letra, openxlsx::int2col(j))) return("letra")
        paste0(co$etiqueta, " (", openxlsx::int2col(j), ")")
      }, character(1))))
      if (!identical(esperado, attr(b$letras, "encabezado"))) nota(v, ": encabezado de letras")
      # Las letras de una columna emparejada por rótulo no se publican (el archivo las trae mal): no se comparan.
      leidas <- unlist(lapply(con_letras, function(cr) {
        rep(!identical(cr$significancia$motivo, "letras_por_rotulo_no_calculadas"), length(cr$columnas))
      }))
      for (i in seq_along(t$filas)) {
        prev <- unlist(lapply(con_letras, function(cr) vapply(cr$columnas, function(co) {
          l <- co$celdas[[i]]$letras
          if (is.na(l)) "" else l
        }, character(1))))
        if (!identical(prev[leidas], b$letras[[i]][leidas])) nota(v, ": letras de la fila ", t$filas[[i]]$etiqueta)
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
    # La base de la tabla se compara con los casos de SU nivel (`base.de`), no con los de la base activa.
    expect_identical(t$base$n, t$total$base_n)
    expect_true(is.integer(t$base$de))
    expect_lte(t$total$base_n, t$base$de)
    expect_identical(t$sin_respuestas, identical(t$total$base_n, 0L))
    expect_gte(t$total$casos_sin_fila, 0L)
    if (!isTRUE(res$ponderado)) expect_equal(t$total$base_n, t$total$n, label = t$variable)
    for (cr in t$cruces) {
      if (!isTRUE(cr$multiple)) expect_gte(cr$sin_columna$base_n, 0L)
      for (co in cr$columnas) {
        expect_true(is.integer(co$base_n), label = paste(t$variable, co$codigo))
        expect_lte(co$base_n, t$total$base_n)
        expect_null(co$n_ponderado)
        if (!isTRUE(res$ponderado)) expect_equal(co$base_n, co$n, label = paste(t$variable, co$codigo))
      }
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
  expect_false(isTRUE(all.equal(col$n, as.numeric(col$base_n))))
  expect_false(isTRUE(all.equal(col$n, round(col$n))))   # `n` sin redondear: un solo significado, como Frecuencias
  # Total menos columnas con pesos: sin residuo negativo de coma flotante.
  sin_col <- unlist(lapply(res$tablas, function(t) lapply(t$cruces, function(cr) cr$sin_columna$n)))
  expect_gt(length(sin_col), 0L)
  expect_true(all(sin_col >= 0))
  expect_equal(.cruces_preview_resta(10, 10 + 5.34e-12), 0)
  expect_equal(.cruces_preview_resta(10, 9.5), 0.5)
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
  expect_equal(x$n, 1.75)
  expect_identical(y$base_n, 1L)            # peso 0 y "sin marcar" quedan fuera
  expect_equal(y$n, 2.2)
  expect_identical(medios$total$base_n, 3L)
  expect_equal(sum(vapply(x$celdas, function(c) c$n, numeric(1))), 1.25 + 1.25 + 0.5)   # marcas, no personas

  voto <- .cp_tabla_sintetica(datos, "voto")
  y <- .cp_columna(voto, "grupo", "y")
  expect_identical(voto$denominador, "validos_de_la_columna")
  expect_identical(y$base_n, 2L)
  expect_equal(y$n, 3.2)
  expect_identical(voto$total$base_n, 4L)
  expect_true(is.integer(voto$total$base_n))

  sin_pesos <- .cp_tabla_sintetica(datos[setdiff(names(datos), "peso")], "voto")
  for (co in sin_pesos$cruces[[1]]$columnas) expect_equal(co$base_n, co$n)
  expect_equal(sin_pesos$total$base_n, sin_pesos$total$n)
})

test_that("dos opciones con el mismo rótulo: el archivo deja la segunda fuera y la vista previa lo dice", {
  datos <- data.frame(voto = c("1", "2", "3"), grupo = c("x", "x", "y"), stringsAsFactors = FALSE)
  inst <- list(orders_list = list(voto = list(names = c("1", "2", "3"), labels = c("Sí", "Sí", "No"))))
  tb <- .cruces_tabla_archivo(datos, "voto", "grupo", orders_list = inst$orders_list,
                              notas = .notas_pie_normalizar(NULL), casos_sin_ponderar = TRUE)
  expect_identical(tb$codes_row, c("1", "3"))
  expect_identical(tb$omitidas, list(list(codigo = "2", etiqueta = "Sí", motivo = "rotulo_repetido", casos = 1L)))
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
  expect_identical(otro$motivo, "excluida")          # con letras, la regla le pone `.b`; el motivo real es la exclusión
  expect_true(otro$exclusion_aplicada)
  expect_identical(res$casos$antes_de_excluir - res$casos$cuentan, 2L)   # los dos casos de "Otro"
  global <- Filter(function(a) identical(a$codigo, "exclusion_global"), res$avisos)
  expect_length(global, 1L)
  expect_match(global[[1]]$mensaje, "Se quitaron 2 casos de toda la base", fixed = TRUE)
  expect_match(global[[1]]$mensaje, "\"Otro\"", fixed = TRUE)
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
  expect_identical(info$cruces[[1]]$significancia$modo, "letras")   # 6 distritos: no pasa de max_letras
  # Lo que la prueba usó de verdad: la regla propuesta (sin regla del estudio), no el alfa guardado en Cruces.
  expect_identical(siempre$significancia_regla$origen, "propuesta")
  expect_identical(siempre$significancia_regla$prueba, "z")
  expect_equal(siempre$significancia_regla$base_minima, 30)
  expect_equal(siempre$significancia_regla$umbral_puntos, 10)
  expect_identical(siempre$significancia_regla$n_prueba, "pesos_llevados_a_media_1")
  expect_null(siempre$opciones[["alfa"]])
  expect_equal(siempre$opciones$alfa_configurado, 0.05)
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
  expect_identical(estudio$significancia_regla$origen, "estudio")
  expect_equal(estudio$significancia_regla$base_minima, 20)
  expect_equal(estudio$significancia_regla$umbral_puntos, 5)
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
  expect_null(apagada$significancia_regla)
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
  # transport tiene 7 categorías declaradas (una excluida, vacía): la regla compara frente al resto, con flechas.
  medio <- Filter(function(c) identical(c$variable, "transport"), .cp_tabla(res, "conocimiento")$cruces)[[1]]
  expect_identical(medio$significancia$modo, "frente_al_resto")
  expect_true(all(is.na(vapply(medio$columnas, function(co) co$letra, character(1)))))
  # En estos datos ningún medio difiere del resto (bases de 0 a 235 registros): celdas vacías o `.b`, nunca letras
  # de columna. Las flechas con una diferencia real las fija la prueba "más de 6 columnas".
  flechas <- unlist(lapply(medio$columnas, function(co) vapply(co$celdas, function(c) c$letras, character(1))))
  expect_true(all(flechas %in% c("", ".b") | grepl("^[▲▼△▽]+$", flechas)))
  expect_true(any(flechas == ".b"))

  bloques <- .cp_leer_archivo(.cp_generar_archivo(sid, "rep_servicios"))
  expect_identical(.cp_diferencias(res$tablas, bloques), character(0))
  .cp_invariantes_base(res)
  # La tabla del encuestado cuenta personas: su base no pasa de las filas de la madre.
  madre <- suppressWarnings(.analitica_cruces_preparar(sid, modo = "estandar"))$data_sources[[1]]
  expect_lte(.cp_tabla(res, "conocimiento")$total$base_n, nrow(madre))
  expect_gt(.cp_tabla(res, "srv_satisfaccion")$total$base_n, nrow(madre))
})

# --- Revisión metodológica (C1 a C8) ----------------------------------------------

# Base de 400 casos con una pregunta sí/no y un cruce de dos grupos con 80/20 frente a 20/80.
.cp_rev_datos <- function(sexo = NULL, n = 400) {
  set.seed(1)
  cod <- sample(c("1", "2"), n, TRUE)
  q <- ifelse(cod == "1", sample(c("1", "2"), n, TRUE, prob = c(.8, .2)), sample(c("1", "2"), n, TRUE, prob = c(.2, .8)))
  list(cod = cod, data = data.frame(q = q, sexo = sexo %||% cod, stringsAsFactors = FALSE))
}
.cp_rev_inst <- list(
  survey = data.frame(type = c("select_one yn", "select_one sx"), name = c("q", "sexo"), label = c("Q", "Sexo"),
                      stringsAsFactors = FALSE),
  orders_list = list(yn = list(names = c("1", "2"), labels = c("Sí", "No")),
                     sx = list(names = c("1", "2"), labels = c("Hombre", "Mujer")))
)
.cp_rev_tabla <- function(data, cruce = "sexo", inst = .cp_rev_inst, regla = TRUE, excluidas = list()) {
  previa <- options(prosecnur.sig_informe = if (regla) list(regla = .sig_regla_fabrica(), familia = NULL) else NULL)
  on.exit(options(previa), add = TRUE)
  tb <- .cruces_tabla_archivo(data, "q", cruce, survey = inst$survey, orders_list = inst$orders_list,
                              notas = .notas_pie_normalizar(NULL), show_sig = TRUE,
                              sig_spec = .cruces_significancia_normalizar(NULL), casos_sin_ponderar = TRUE)
  .cruces_preview_tabla(tb, "S", NA_character_, NA_character_, excluidas = excluidas, survey = inst$survey)
}
.cp_codigos_avisos <- function(tablas) vapply(.cruces_preview_avisos_tablas(tablas), function(a) a$codigo, character(1))

test_that("clave mezclada (5 con código y 395 con rótulo): los casos sin columna se cuentan y se avisan", {
  d <- .cp_rev_datos()
  limpia <- .cp_rev_tabla(d$data)
  expect_identical(limpia$cruces[[1]]$sin_columna$base_n, 0L)
  expect_false("casos_sin_columna" %in% .cp_codigos_avisos(list(limpia)))     # el caso que no debe avisar

  mixta <- d$data
  mixta$sexo <- ifelse(d$cod == "1", "Hombre", "Mujer")
  mixta$sexo[1:5] <- d$cod[1:5]
  t <- .cp_rev_tabla(mixta)
  cr <- t$cruces[[1]]
  expect_identical(cr$columnas_por, "codigo")                  # basta un código para cruzar por código
  expect_identical(sum(vapply(cr$columnas, function(co) co$base_n, integer(1))), 5L)
  expect_identical(t$total$base_n, 400L)                       # el Total sí los cuenta
  expect_identical(cr$sin_columna$valores_no_reconocidos, 395L)
  expect_identical(cr$sin_columna$base_n, 395L)
  expect_true("casos_sin_columna" %in% .cp_codigos_avisos(list(t)))
})

test_that("columnas emparejadas por rótulo: el archivo trae letras vacías y la vista previa no las publica", {
  d <- .cp_rev_datos()
  por_codigo <- .cp_rev_tabla(d$data)
  expect_identical(por_codigo$cruces[[1]]$significancia$metodo, "regla_z")
  expect_true(any(nzchar(unlist(lapply(por_codigo$cruces[[1]]$columnas, function(co) {
    vapply(co$celdas, function(c) c$letras, character(1))
  })))))                                                       # con códigos, 80/20 contra 20/80 sí marca

  rot <- d$data
  rot$sexo <- ifelse(d$cod == "1", "Hombre", "Mujer")
  t <- .cp_rev_tabla(rot)
  cr <- t$cruces[[1]]
  expect_identical(cr$columnas_por, "rotulo")
  expect_identical(cr$significancia$metodo, "descriptivo")
  expect_identical(cr$significancia$motivo, "letras_por_rotulo_no_calculadas")
  for (co in cr$columnas) {
    expect_true(is.na(co$letra))
    expect_true(all(is.na(vapply(co$celdas, function(c) c$letras, character(1)))))
  }
  expect_true("letras_por_rotulo_no_calculadas" %in% .cp_codigos_avisos(list(t)))
  # Los porcentajes sí salen por rótulo, iguales a los de la base con códigos.
  expect_equal(vapply(cr$columnas[[1]]$celdas, function(c) c$pct, numeric(1)),
               vapply(por_codigo$cruces[[1]]$columnas[[1]]$celdas, function(c) c$pct, numeric(1)))
})

test_that("más de 6 columnas: la regla compara cada una frente al resto y la columna no lleva letra", {
  set.seed(4)
  n <- 1400
  g <- as.character(rep(1:7, each = n / 7))
  q <- ifelse(g == "1", sample(c("1", "2"), n, TRUE, prob = c(.9, .1)), sample(c("1", "2"), n, TRUE, prob = c(.3, .7)))
  inst <- .cp_rev_inst
  inst$orders_list$sx <- list(names = as.character(1:7), labels = paste("Grupo", 1:7))
  siete <- .cp_rev_tabla(data.frame(q = q, sexo = g, stringsAsFactors = FALSE), inst = inst)
  cr <- siete$cruces[[1]]
  expect_identical(cr$significancia$modo, "frente_al_resto")
  expect_true(all(is.na(vapply(cr$columnas, function(co) co$letra, character(1)))))
  celdas <- unlist(lapply(cr$columnas, function(co) vapply(co$celdas, function(c) c$letras, character(1))))
  expect_true(any(grepl("[▲▼△▽]", celdas)))                   # flechas, no letras

  # La regla cuenta todas las columnas que escribe el archivo, también una vacía: 7 declaradas y 6 con datos.
  vacia <- .cp_rev_tabla(data.frame(q = q[g != "7"], sexo = g[g != "7"], stringsAsFactors = FALSE), inst = inst)
  expect_identical(vacia$cruces[[1]]$columnas[[7]]$base_n, 0L)
  expect_identical(vacia$cruces[[1]]$significancia$modo, "frente_al_resto")
  # Con seis declaradas, letras.
  inst$orders_list$sx <- list(names = as.character(1:6), labels = paste("Grupo", 1:6))
  seis <- .cp_rev_tabla(data.frame(q = q[g != "7"], sexo = g[g != "7"], stringsAsFactors = FALSE), inst = inst)
  expect_identical(seis$cruces[[1]]$significancia$modo, "letras")
  expect_identical(vapply(seis$cruces[[1]]$columnas, function(co) co$letra, character(1))[1:3], c("A", "B", "C"))
})

test_that("columna excluida sin la regla: su motivo es la exclusión, no la base insuficiente", {
  d <- .cp_rev_datos()
  inst <- .cp_rev_inst
  inst$orders_list$sx <- list(names = c("1", "2", "3"), labels = c("Hombre", "Mujer", "Otro"))
  sin_excluir <- .cp_rev_tabla(d$data, inst = inst, regla = FALSE)
  otro <- sin_excluir$cruces[[1]]$columnas[[3]]
  expect_identical(sin_excluir$cruces[[1]]$significancia$metodo, "z_simple")
  expect_identical(otro$motivo, "base_insuficiente")           # el `.b` de la prueba z, sin decir por qué
  excluida <- .cp_rev_tabla(d$data, inst = inst, regla = FALSE, excluidas = list(sexo = "3"))
  otro <- excluida$cruces[[1]]$columnas[[3]]
  expect_identical(otro$motivo, "excluida")
  expect_true(otro$exclusion_aplicada)
  # Excluida pero con datos (la base trae otro valor y la exclusión no quitó nada): no se promete vacía.
  con_datos <- .cp_rev_tabla(d$data, inst = inst, regla = FALSE, excluidas = list(sexo = "1"))
  hombre <- con_datos$cruces[[1]]$columnas[[1]]
  expect_true(hombre$excluida)
  expect_false(hombre$exclusion_aplicada)
  expect_identical(hombre$motivo, "excluida")
})

test_that("base sin respuestas: la tabla existe, con su base en 0 y `sin_respuestas`", {
  d <- .cp_rev_datos()
  vacia <- d$data
  vacia$q <- NA_character_
  t <- .cp_rev_tabla(vacia)
  expect_false(t$sin_datos)
  expect_true(t$sin_respuestas)
  expect_identical(t$base$n, 0L)
  expect_identical(t$base$de, 400L)
  expect_false(.cp_rev_tabla(d$data)$sin_respuestas)          # con respuestas, falso
})

# Hija repeat opcional: 160 estudiantes en la madre y 60 registros de 40 de ellos en la hija.
.cp_hija_opcional <- function() {
  set.seed(7)
  madre <- data.frame(`_index` = 1:160, ciclo = sample(c("6", "9"), 160, TRUE), area = rep(c("1", "2"), 80),
                      check.names = FALSE, stringsAsFactors = FALSE)
  pos <- rep(1:40, c(rep(1L, 20), rep(2L, 20)))
  hija <- data.frame(`_parent_index` = pos, `_index` = seq_along(pos),
                     nivel = sample(c("u", "s"), length(pos), TRUE),
                     ciclo = madre$ciclo[pos], area = madre$area[pos], check.names = FALSE, stringsAsFactors = FALSE)
  survey <- data.frame(name = c("ciclo", "area", "nivel"), type = c("select_one ci", "select_one ar", "select_one nv"),
                       label = c("Ciclo", "Área", "Nivel"), stringsAsFactors = FALSE)
  inst <- list(survey = survey, orders_list = list(
    ci = list(names = c("6", "9"), labels = c("Sexto", "Noveno")),
    ar = list(names = c("1", "2"), labels = c("Uno", "Dos")),
    nv = list(names = c("u", "s"), labels = c("Universitario", "Secundaria"))))
  diseno <- list(kind = "cluster_persona", cluster_col = "_parent_index", n_instancias = nrow(hija), n_personas = 40L,
                 min_clusters = 8L, inference_ok = TRUE, reason = "", heredadas = c("ciclo", "area"),
                 parent_base = "madre", unidad = "registros")
  attr(hija, "repeat_design") <- diseno
  attr(hija, "repeat_madre") <- madre
  list(
    data_sources = list(hija = hija), inst_sources = list(hija = inst), repeat_design_by_base = list(hija = diseno),
    notas = .notas_pie_normalizar(NULL), secs = list(G = c("ciclo", "nivel")), cruces_val = "area",
    numericas_arg = character(0), show_sig = FALSE, orden_cruces = "original", ordinal_lists_by_base = list(),
    incluir_secciones = FALSE, cruces_map = list(area = character(0)), excluidas = character(0), alpha = 0.05,
    significancia = NULL
  )
}

test_that("hija con más encuestados que registros: cada tabla declara su base y su unidad", {
  p <- .cp_hija_opcional()
  withr::local_options(prosecnur.sig_informe = NULL)
  res <- .cruces_preview_tablas(p, "hija")
  ciclo <- Filter(function(t) identical(t$variable, "ciclo"), res$tablas)[[1]]
  nivel <- Filter(function(t) identical(t$variable, "nivel"), res$tablas)[[1]]
  expect_identical(ciclo$grano, "encuestado")
  expect_identical(ciclo$base, list(n = 160L, de = 160L, unidad = "encuestado"))
  expect_identical(nivel$grano, "registro")
  expect_identical(nivel$base, list(n = 60L, de = 60L, unidad = "registro"))
  # El invariante viejo (contra las filas de la base activa, la hija) se rompe con un grupo opcional.
  expect_gt(ciclo$total$base_n, .frecuencias_base_con_peso(p$data_sources$hija))
  for (t in res$tablas) expect_lte(t$total$base_n, t$base$de)
})

test_that("sin letras en una base hija, la vista previa repone la regla del proceso", {
  sid <- .cp_abrir("pdm")
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list(list(name = "timing"))
    cfg$cruces$show_sig <- FALSE
    # La última tabla es heredada: si la regla no se repone, queda la de la madre.
    cfg$secciones <- list(list(id = "a", nombre = "A", variables = list("srv_satisfaccion", "conocimiento")))
    cfg
  })
  estudio_active_base_set(sid, "rep_servicios")
  # Una regla ya vigente en el proceso (de otra vista previa): la tabla heredada de la hija activa la de la madre.
  vigente <- list(regla = .sig_regla_fabrica(), familia = NULL,
                  madre = list(regla = .sig_regla_fabrica(), familia = NULL, marca = "madre"))
  previa <- options(prosecnur.sig_informe = vigente)
  on.exit(options(previa), add = TRUE)
  res <- suppressWarnings(analitica_cruces_preview(sid))
  expect_identical(res$casos$unidad, "registro")
  expect_true(any(vapply(res$tablas, function(t) identical(t$grano, "encuestado"), logical(1))))
  expect_identical(getOption("prosecnur.sig_informe"), vigente)
})

test_that("total.base_n de Cruces es la base.n de Frecuencias en toda categórica de acnur_acg", {
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list(list(name = "M5_district"))
    cfg$cruces$show_sig <- FALSE
    cfg
  })
  frec <- suppressWarnings(analitica_frecuencias_preview(sid, limite = 500L))
  base_frec <- stats::setNames(vapply(frec$tablas, function(t) as.integer(t$base$n), integer(1)),
                               vapply(frec$tablas, function(t) t$variable, character(1)))
  cruces <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  base_cruces <- stats::setNames(vapply(cruces$tablas, function(t) t$total$base_n, integer(1)),
                                 vapply(cruces$tablas, function(t) t$variable, character(1)))
  expect_gt(length(base_cruces), 20L)
  expect_setequal(names(base_cruces), intersect(names(base_frec), names(base_cruces)))
  expect_identical(base_cruces, base_frec[names(base_cruces)])
  for (t in cruces$tablas) expect_identical(t$total$casos_sin_fila, 0L)

  # Diferencia documentada: la exclusión de categorías de cruce es global. Al excluir "Otro" de sexo, Cruces pierde
  # esos 2 casos en toda tabla y Frecuencias no.
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list(list(name = "M5_district"), list(name = "E2_sex", excluidas = list("3")))
    cfg
  })
  excl <- suppressWarnings(analitica_cruces_preview(sid, limite = 200L))
  dif <- base_frec[vapply(excl$tablas, function(t) t$variable, character(1))] -
    vapply(excl$tablas, function(t) t$total$base_n, integer(1))
  expect_true(all(dif >= 0L & dif <= 2L))
  expect_identical(unname(dif[["A1_leg"]]), 2L)
})


test_that("avisos con su caso que no avisa: modo configurado no aplicado y variable de cruce múltiple", {
  sid <- .cp_abrir("acg")
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$cruces_vars <- list(list(name = "M5_district"))
    cfg$cruces$show_sig <- FALSE
    cfg$cruces$modo <- "estandar"
    cfg
  })
  codigos <- function(r) vapply(r$avisos, function(a) a$codigo, character(1))
  expect_false("modo_configurado_no_aplicado" %in% codigos(suppressWarnings(analitica_cruces_preview(sid, variables = "E6_impact"))))
  .cp_configurar(sid, function(cfg) {
    cfg$cruces$modo <- "dimensiones"
    cfg
  })
  dim <- suppressWarnings(analitica_cruces_preview(sid, variables = "E6_impact"))
  expect_identical(dim$modo, "estandar")
  expect_identical(dim$modo_configurado, "dimensiones")
  expect_true("modo_configurado_no_aplicado" %in% codigos(dim))

  d <- .cp_rev_datos()
  expect_false("cruce_multiple" %in% .cp_codigos_avisos(list(.cp_rev_tabla(d$data))))
  inst <- .cp_rev_inst
  inst$survey$type[inst$survey$name == "sexo"] <- "select_multiple sx"
  multiple <- .cp_rev_tabla(d$data, inst = inst)
  expect_true(multiple$cruces[[1]]$multiple)
  expect_true(is.na(multiple$cruces[[1]]$sin_columna$base_n))
  expect_true("cruce_multiple" %in% .cp_codigos_avisos(list(multiple)))
})

test_that("código ajeno al instrumento: fuera del denominador y contado en `casos_sin_fila`", {
  d <- .cp_rev_datos()
  expect_identical(.cp_rev_tabla(d$data)$total$casos_sin_fila, 0L)
  ajeno <- d$data
  ajeno$q[1:7] <- "7"
  t <- .cp_rev_tabla(ajeno)
  expect_identical(t$total$casos_sin_fila, 7L)
  expect_identical(t$total$base_n, 393L)
})

test_that("`sin_respuestas` es falso cuando no hay tabla (`sin_datos`)", {
  vacia <- data.frame(q = c(NA, NA), sexo = c("1", "2"), stringsAsFactors = FALSE)
  inst <- .cp_rev_inst
  inst$orders_list$yn <- NULL
  inst$survey$type[inst$survey$name == "q"] <- "select_one zz"
  t <- .cp_rev_tabla(vacia, inst = inst)
  expect_true(t$sin_datos)
  expect_false(t$sin_respuestas)
})

test_that("filas no probadas: con la regla, 99 No responde no entra a la prueba; sin regla todas entran", {
  set.seed(9)
  n <- 600
  sexo <- sample(c("1", "2"), n, TRUE)
  q <- ifelse(sexo == "1", sample(c("1", "2", "99"), n, TRUE, prob = c(.7, .2, .1)),
              sample(c("1", "2", "99"), n, TRUE, prob = c(.2, .7, .1)))
  inst <- .cp_rev_inst
  inst$orders_list$yn <- list(names = c("1", "2", "99"), labels = c("Sí", "No", "No responde"))
  datos <- data.frame(q = q, sexo = sexo, stringsAsFactors = FALSE)
  con_regla <- .cp_rev_tabla(datos, inst = inst)
  expect_identical(vapply(con_regla$filas, function(f) f$probada, logical(1)), c(TRUE, TRUE, FALSE))
  sin_regla <- .cp_rev_tabla(datos, inst = inst, regla = FALSE)
  expect_identical(vapply(sin_regla$filas, function(f) f$probada, logical(1)), c(TRUE, TRUE, TRUE))
})

test_that("`significancia_regla` sale de un bloque que usó la regla; si ninguno la usó, es nula", {
  p <- .cp_hija_opcional()
  p$show_sig <- TRUE
  p$sig_estudio <- NULL                       # sin regla vigente: la hija compara con errores agrupados
  withr::local_options(prosecnur.sig_informe = NULL)
  res <- suppressMessages(.cruces_preview_tablas(p, "hija"))
  nivel <- Filter(function(t) identical(t$variable, "nivel"), res$tablas)[[1]]
  expect_false(startsWith(nivel$cruces[[1]]$significancia$metodo, "regla_"))
  expect_null(res$regla)
  # Un bloque descriptivo trae la regla que no pudo aplicar: no es la regla usada.
  fabrica <- .sig_regla_fabrica()
  tb <- list(sig = list(bloques = list(
    a = list(method = "descriptivo", regla = modifyList(fabrica, list(prueba = "rao_scott"))),
    b = list(method = "regla_z", regla = fabrica))))
  expect_identical(.cruces_preview_regla_de_tabla(tb)$prueba, "z")
  tb$sig$bloques$b <- NULL
  expect_null(.cruces_preview_regla_de_tabla(tb))
  regla <- .cruces_preview_regla(modifyList(.sig_regla_fabrica(), list(incluir_ns = TRUE)), "estudio")
  expect_true(regla$incluir_ns)
  expect_false(.cruces_preview_regla(.sig_regla_fabrica(), "propuesta")$incluir_ns)
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
