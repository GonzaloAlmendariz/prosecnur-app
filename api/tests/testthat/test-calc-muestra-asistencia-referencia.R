# Contrato del resumen transferible de asistencia de un estudio histórico.
# Fixture completamente sintético: una fila por curso-horario agendado.

.asr_repartir_total <- function(capacidad, total) {
  capacidad <- as.integer(capacidad)
  bruto <- capacidad * as.integer(total) / sum(capacidad)
  asignado <- floor(bruto)
  faltan <- as.integer(total - sum(asignado))
  if (faltan > 0L) {
    prioridad <- order(-(bruto - asignado), seq_along(bruto))
    idx <- prioridad[seq_len(faltan)]
    asignado[idx] <- asignado[idx] + 1L
  }
  stopifnot(sum(asignado) == total, all(asignado >= 0L), all(asignado <= capacidad))
  as.integer(asignado)
}

.asr_fixture_construir <- function() {
  tamanos <- list(
    T1 = c(14L, rep(10L, 28L), 6L),
    T2 = c(15L, 24L, rep(20L, 37L), 21L),
    T3 = c(25L, 39L, rep(32L, 48L)),
    T4 = c(40L, 59L, rep(50L, 47L), 51L),
    T5 = c(60L, rep(84L, 18L), 89L)
  )
  asistieron_totales <- c(T1 = 248L, T2 = 614L, T3 = 1165L, T4 = 1753L, T5 = 1012L)
  matriculados <- as.integer(unlist(tamanos, use.names = FALSE))
  asistieron <- as.integer(unlist(Map(
    .asr_repartir_total,
    tamanos,
    as.list(asistieron_totales)
  ), use.names = FALSE))
  enviadas <- .asr_repartir_total(asistieron, 3610L)
  validas <- .asr_repartir_total(enviadas, 3223L)
  n_observadas <- length(matriculados)

  rango_horario <- rep(c("Mañana", "Tarde", "Noche"), length.out = n_observadas)
  rango_horario[seq_len(9L)] <- "Mañana especial"
  niveles_tipo <- c("Teórica", "Teórico-práctica", "Seminario")

  observadas <- data.frame(
    curso_horario = sprintf("CH-%03d", seq_len(n_observadas)),
    estado_aplicacion = "APLICADA",
    matriculados = matriculados,
    asistieron = asistieron,
    enviadas = enviadas,
    validas = validas,
    no_respondieron = asistieron - enviadas,
    rango_horario = rango_horario,
    facultad = rep(paste("Facultad", LETTERS[1:4]), length.out = n_observadas),
    tipo_sesion = factor(
      rep(c("Teórica", "Teórico-práctica"), length.out = n_observadas),
      levels = niveles_tipo
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  # Dos APLICADA sin asistencia reportada y dos agendas no aplicadas. Sus M
  # conocidos no pertenecen a las 190 observaciones ni a sus sumas estrictas.
  sin_observacion <- data.frame(
    curso_horario = sprintf("CH-%03d", 191:194),
    estado_aplicacion = c("APLICADA", "APLICADA", "NO_APLICADA", "NO_APLICADA"),
    matriculados = c(20L, 25L, 30L, 35L),
    asistieron = NA_integer_,
    enviadas = NA_integer_,
    validas = NA_integer_,
    no_respondieron = NA_integer_,
    rango_horario = c("Mañana", "Tarde", "Noche", "Mañana"),
    facultad = paste("Facultad", LETTERS[1:4]),
    tipo_sesion = factor(
      c("Teórica", "Teórico-práctica", "Teórica", "Teórico-práctica"),
      levels = niveles_tipo
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- rbind(observadas, sin_observacion)
  stopifnot(
    nrow(out) == 194L,
    sum(out$estado_aplicacion == "APLICADA") == 192L,
    sum(is.finite(out$asistieron)) == 190L,
    sum(observadas$matriculados) == 6861L,
    sum(observadas$asistieron) == 4792L,
    sum(observadas$enviadas) == 3610L,
    sum(observadas$validas) == 3223L,
    all(observadas$asistieron == observadas$enviadas + observadas$no_respondieron),
    sum(observadas$rango_horario == "Mañana especial") == 9L
  )
  out
}

.asr_fixture <- .asr_fixture_construir()

.asr_estudio <- list(
  id = "estudio-historico-sintetico",
  label = "Estudio histórico sintético",
  periodo = "2026-I",
  fuente = "fixture_sintetico"
)

.asr_engine_existe <- function() {
  exists("calc_muestra_asistencia_referencia", mode = "function", inherits = TRUE)
}

.asr_skip_sin_engine <- function() {
  skip_if_not(
    .asr_engine_existe(),
    "Contrato pendiente: falta calc_muestra_asistencia_referencia()"
  )
}

# Los tramos de tamano ya no son una escala del motor: los declara el estudio en
# Marco. Estos reproducen los cortes historicos, para que el golden de celdas
# siga midiendo lo mismo que medía antes.
.asr_grupos_tamano <- list(
  list(id = "T1", label = "Menos de 15", min = 0, max = 14),
  list(id = "T2", label = "15 a 24", min = 15, max = 24),
  list(id = "T3", label = "25 a 39", min = 25, max = 39),
  list(id = "T4", label = "40 a 59", min = 40, max = 59),
  list(id = "T5", label = "60 o más", min = 60, max = NA)
)

.asr_run <- function(datos = .asr_fixture, bootstrap_n = 200L,
                     grupos_tamano = NULL) {
  fn <- get("calc_muestra_asistencia_referencia", mode = "function", inherits = TRUE)
  fn(datos, estudio = .asr_estudio, bootstrap_n = bootstrap_n,
     grupos_tamano = grupos_tamano)
}

.asr_dimension <- function(out, dimension_key) {
  hit <- Filter(
    function(dimension) identical(dimension$dimension_key, dimension_key),
    out$dimensiones
  )
  expect_length(hit, 1L)
  dimension <- hit[[1L]]
  expect_named(dimension, c("dimension_key", "dimension_label", "orden", "filas"))
  dimension
}

.asr_fila <- function(out, dimension_key, celda_key) {
  dimension <- .asr_dimension(out, dimension_key)
  hit <- Filter(function(fila) identical(fila$celda_key, celda_key), dimension$filas)
  expect_length(hit, 1L)
  fila <- hit[[1L]]
  expect_named(fila, c(
    "celda_key", "celda_label", "orden", "k", "matriculados", "asistentes",
    "tasa", "estimador", "media_ch", "sd_ch", "ic_low", "ic_high",
    "metodo_ic", "suficiencia", "tasa_publicada", "k_publicada",
    "fuente_publicada"
  ))
  fila
}

test_that("existe el engine de referencia de asistencia", {
  expect_true(
    .asr_engine_existe(),
    info = "Falta el símbolo calc_muestra_asistencia_referencia()"
  )
})

test_that("el root exacto declara procedencia, estudio, umbrales y dimensiones", {
  .asr_skip_sin_engine()
  fn <- get("calc_muestra_asistencia_referencia", mode = "function", inherits = TRUE)
  expect_identical(eval(formals(fn)$bootstrap_n), 2000L)

  out <- .asr_run()
  expect_named(out, c(
    "schema", "owner", "momento", "transferible", "modelo", "combinable",
    "unidad", "denominador", "estudio", "diseno", "filtros_corte", "cobertura",
    "encuentros", "embudos", "serie_campo", "cadenas_reemplazo",
    "identidad", "umbrales",
    "cadena", "global", "dimensiones", "advertencias", "celdas_criterios"
  ))
  expect_identical(out$schema, "calc_muestra_referencia_asistencia_v2")
  expect_identical(out$owner, "estudio_historico_externo")
  expect_identical(out$momento, "post_hoc_estudio_previo")
  expect_identical(out$transferible, "modelo_por_celda")
  expect_identical(out$modelo, "marginales_independientes")
  expect_false(out$combinable)
  expect_identical(out$unidad, "encuentro_en_curso_horario_aplicado")
  expect_identical(out$denominador, "matriculados_totales")
  expect_true(all(c("id", "label", "periodo", "fuente") %in% names(out$estudio)))
  for (campo in names(.asr_estudio)) {
    expect_identical(out$estudio[[campo]], .asr_estudio[[campo]])
  }
  expect_identical(out$umbrales, list(
    insuficiente_max = 11L,
    delgada_min = 12L,
    solida_min = 30L,
    bootstrap_n = 200L,
    nivel_ic = 0.95,
    quantile_type = 7L
  ))

  # Sin `grupos_tamano` declarados, la dimension de tamano NO se emite: los
  # tramos los fija cada estudio en Marco y el motor no impone una escala
  # propia. Con grupos declarados vuelve, y eso se prueba aparte.
  expect_length(out$dimensiones, 3L)
  expect_identical(
    vapply(out$dimensiones, function(x) x$dimension_key, character(1)),
    c("rango_horario", "facultad", "tipo_sesion")
  )
  for (i in seq_along(out$dimensiones)) {
    dimension <- .asr_dimension(out, out$dimensiones[[i]]$dimension_key)
    expect_true(is.integer(dimension$orden) && dimension$orden > 0L)
    expect_true(is.character(dimension$dimension_label) && nzchar(dimension$dimension_label))
    expect_type(dimension$filas, "list")
  }

  expect_type(out$advertencias, "list")
  expect_true(all(vapply(
    out$advertencias,
    function(x) is.character(x) && length(x) == 1L,
    logical(1)
  )))
  advertencias <- unlist(out$advertencias, use.names = FALSE)
  expect_true("marginales_no_combinables" %in% advertencias)
  expect_true("celdas_con_k_1_a_11_degradan_a_global" %in% advertencias)
  expect_false("celdas_con_k_menor_12_degradan_a_global" %in% advertencias)
})

test_that("cadena, global, cobertura e identidad conservan las cifras estrictas", {
  .asr_skip_sin_engine()
  out <- .asr_run()

  expect_identical(out$cobertura, list(
    agendados = 194L,
    aplicados = 192L,
    observados = 190L,
    glosario_completo = FALSE,
    columnas_glosario = list(), columnas_criterio = list()
  ))
  expect_identical(out$identidad, list(
    regla = "A = E + no_respondieron",
    verificada = TRUE,
    verificables = 190L,
    inconsistentes = 0L,
    residuales_negativos = NULL
  ))

  global <- out$global
  expect_named(global, c(
    "k", "matriculados", "asistentes", "enviadas", "validas",
    "no_respondieron", "tasa", "media_ch", "sd_ch", "ic_low", "ic_high",
    "metodo_ic"
  ))
  expect_equal(global$k, 190L)
  expect_equal(global$matriculados, 6861L)
  expect_equal(global$asistentes, 4792L)
  expect_equal(global$enviadas, 3610L)
  expect_equal(global$validas, 3223L)
  expect_equal(global$no_respondieron, 1182L)
  expect_equal(global$tasa, 4792 / 6861, tolerance = 1e-12)
  expect_false(anyNA(unlist(global[c("media_ch", "sd_ch", "ic_low", "ic_high")])))
  expect_identical(global$metodo_ic, "bootstrap_percentil")

  expect_named(out$cadena, c("asistencia", "apertura", "efectividad", "rendimiento"))
  esperada <- list(
    asistencia = c(numerador = 4792L, denominador = 6861L),
    apertura = c(numerador = 3610L, denominador = 4792L),
    efectividad = c(numerador = 3223L, denominador = 3610L),
    rendimiento = c(numerador = 3223L, denominador = 6861L)
  )
  for (key in names(esperada)) {
    tramo <- out$cadena[[key]]
    expect_named(tramo, c(
      "key", "label", "k", "numerador", "denominador", "tasa",
      "ic_low", "ic_high", "metodo_ic"
    ))
    expect_identical(tramo$key, key)
    expect_true(is.character(tramo$label) && nzchar(tramo$label))
    expect_equal(tramo$k, 190L)
    expect_equal(tramo$numerador, esperada[[key]][["numerador"]])
    expect_equal(tramo$denominador, esperada[[key]][["denominador"]])
    expect_equal(
      tramo$tasa,
      esperada[[key]][["numerador"]] / esperada[[key]][["denominador"]],
      tolerance = 1e-12
    )
    expect_false(anyNA(c(tramo$ic_low, tramo$ic_high)))
    expect_identical(tramo$metodo_ic, "bootstrap_percentil")
  }
  expect_equal(
    out$cadena$rendimiento$tasa,
    out$cadena$asistencia$tasa * out$cadena$apertura$tasa * out$cadena$efectividad$tasa,
    tolerance = 1e-12
  )
  expect_lte(abs(out$cadena$rendimiento$tasa - 0.469), 0.002)
})

test_that("celdas congelan bandas, estimador, IC y reglas de publicación", {
  .asr_skip_sin_engine()
  out <- .asr_run(grupos_tamano = .asr_grupos_tamano)
  esperado <- data.frame(
    celda_key = paste0("T", 1:5),
    k = c(30L, 40L, 50L, 50L, 20L),
    matriculados = c(300L, 800L, 1600L, 2500L, 1661L),
    asistentes = c(248L, 614L, 1165L, 1753L, 1012L),
    suficiencia = c("solida", "solida", "solida", "solida", "delgada"),
    stringsAsFactors = FALSE
  )

  tasas <- numeric(nrow(esperado))
  for (i in seq_len(nrow(esperado))) {
    fila <- .asr_fila(out, "tamano", esperado$celda_key[[i]])
    expect_equal(fila$k, esperado$k[[i]])
    expect_equal(fila$matriculados, esperado$matriculados[[i]])
    expect_equal(fila$asistentes, esperado$asistentes[[i]])
    expect_equal(
      fila$tasa,
      esperado$asistentes[[i]] / esperado$matriculados[[i]],
      tolerance = 1e-12
    )
    expect_identical(fila$estimador, "razon_agregada")
    expect_identical(fila$suficiencia, esperado$suficiencia[[i]])
    expect_identical(fila$metodo_ic, "bootstrap_percentil")
    expect_false(anyNA(c(fila$ic_low, fila$ic_high)))
    expect_equal(fila$tasa_publicada, fila$tasa)
    expect_equal(fila$k_publicada, fila$k)
    expect_identical(fila$fuente_publicada, "celda")
    tasas[[i]] <- fila$tasa
  }
  expect_true(all(diff(tasas) <= 0))

  t5 <- .asr_fila(out, "tamano", "T5")
  idx_t5 <- is.finite(.asr_fixture$asistieron) & .asr_fixture$matriculados >= 60L
  tasas_ch_t5 <- .asr_fixture$asistieron[idx_t5] / .asr_fixture$matriculados[idx_t5]
  expect_equal(t5$media_ch, mean(tasas_ch_t5), tolerance = 1e-12)
  expect_equal(t5$sd_ch, stats::sd(tasas_ch_t5), tolerance = 1e-12)

  insuficiente <- .asr_fila(out, "rango_horario", "manana_especial")
  idx_insuficiente <- is.finite(.asr_fixture$asistieron) &
    .asr_fixture$rango_horario == "Mañana especial"
  expect_identical(insuficiente$celda_label, "Mañana especial")
  expect_identical(insuficiente$k, 9L)
  expect_equal(
    insuficiente$tasa,
    sum(.asr_fixture$asistieron[idx_insuficiente]) /
      sum(.asr_fixture$matriculados[idx_insuficiente]),
    tolerance = 1e-12
  )
  expect_identical(insuficiente$suficiencia, "insuficiente")
  expect_identical(insuficiente$metodo_ic, "no_aplica")
  expect_true(all(is.na(c(insuficiente$ic_low, insuficiente$ic_high))))
  expect_equal(insuficiente$tasa_publicada, out$global$tasa)
  expect_equal(insuficiente$k_publicada, out$global$k)
  expect_identical(insuficiente$fuente_publicada, "global")

  vacia <- .asr_fila(out, "tipo_sesion", "seminario")
  expect_identical(vacia$celda_label, "Seminario")
  expect_identical(vacia$k, 0L)
  expect_identical(vacia$suficiencia, "vacia")
  expect_identical(vacia$metodo_ic, "no_aplica")
  expect_true(all(is.na(c(
    vacia$tasa, vacia$ic_low, vacia$ic_high,
    vacia$tasa_publicada, vacia$k_publicada
  ))))
  expect_identical(vacia$fuente_publicada, "sin_publicacion")
})

test_that("NA en M invalida sumas y una identidad falsa se reporta sin error", {
  .asr_skip_sin_engine()
  con_na <- .asr_fixture
  idx <- which(is.finite(con_na$asistieron) & con_na$facultad == "Facultad A")[[1L]]
  con_na$matriculados[[idx]] <- NA_integer_
  out_na <- .asr_run(con_na)
  fac_a <- .asr_fila(out_na, "facultad", "facultad_a")

  expect_true(all(is.na(c(
    out_na$global$matriculados, out_na$global$asistentes, out_na$global$tasa,
    fac_a$matriculados, fac_a$asistentes, fac_a$tasa
  ))))

  identidad_falsa <- .asr_fixture
  identidad_falsa$no_respondieron[[1L]] <- identidad_falsa$no_respondieron[[1L]] + 1L
  out_identidad <- NULL
  expect_no_error(out_identidad <- .asr_run(identidad_falsa))
  expect_false(out_identidad$identidad$verificada)
  expect_identical(out_identidad$identidad$verificables, 190L)
  expect_identical(out_identidad$identidad$inconsistentes, 1L)
})

test_that("curso_horario repetido se rechaza antes de inflar k o habilitar bootstrap", {
  .asr_skip_sin_engine()
  repetidas <- .asr_fixture[rep(1L, 12L), , drop = FALSE]
  rownames(repetidas) <- NULL
  expect_identical(length(unique(repetidas$curso_horario)), 1L)

  capturado <- tryCatch(
    .asr_run(repetidas, bootstrap_n = 20L),
    error = identity
  )
  expect_true(
    inherits(capturado, "api_error"),
    info = paste(
      "Doce filas de un mismo curso_horario no son doce unidades",
      "independientes y deben rechazarse antes del bootstrap."
    )
  )
  if (inherits(capturado, "api_error")) {
    expect_equal(as.integer(capturado$status), 400L)
    expect_identical(capturado$code, "E_CALC_MUESTRA_ASISTENCIA_INPUT")
  }
})

test_that("curso_horario vacio con datos materiales se rechaza como input invalido", {
  .asr_skip_sin_engine()
  sin_unidad <- .asr_fixture[1L, , drop = FALSE]
  sin_unidad$curso_horario <- "  "

  capturado <- tryCatch(
    .asr_run(sin_unidad, bootstrap_n = 20L),
    error = identity
  )
  expect_true(
    inherits(capturado, "api_error"),
    info = "Una fila material sin curso_horario no puede entrar a cobertura."
  )
  if (inherits(capturado, "api_error")) {
    expect_equal(as.integer(capturado$status), 400L)
    expect_identical(capturado$code, "E_CALC_MUESTRA_ASISTENCIA_INPUT")
  }
})

test_that("jerarquias observadas alertan sin borrar magnitud ni publicar probabilidades invalidas", {
  .asr_skip_sin_engine()
  casos <- list(
    asistentes_mayor_matriculados = list(
      valores = c(
        matriculados = 10L, asistieron = 15L, enviadas = 12L,
        validas = 10L, no_respondieron = 0L
      ),
      tramo = "asistencia",
      tasa = 1.5
    ),
    enviadas_mayor_asistentes = list(
      valores = c(
        matriculados = 20L, asistieron = 10L, enviadas = 15L,
        validas = 12L, no_respondieron = 0L
      ),
      tramo = "apertura",
      tasa = 1.5
    ),
    validas_mayor_enviadas = list(
      valores = c(
        matriculados = 20L, asistieron = 15L, enviadas = 10L,
        validas = 12L, no_respondieron = 0L
      ),
      tramo = "efectividad",
      tasa = 1.2
    )
  )

  for (nombre in names(casos)) {
    datos <- .asr_fixture[1L, , drop = FALSE]
    caso <- casos[[nombre]]
    valores <- caso$valores
    for (campo in names(valores)) datos[[campo]] <- valores[[campo]]

    capturado <- tryCatch(
      .asr_run(datos, bootstrap_n = 20L),
      error = identity
    )
    expect_false(
      inherits(capturado, "error"),
      info = paste("La jerarquia observada no bloquea el resumen:", nombre)
    )
    if (inherits(capturado, "error")) next
    out <- capturado

    expect_equal(
      out$cadena[[caso$tramo]]$tasa,
      caso$tasa,
      tolerance = 1e-12,
      info = paste("La tasa diagnostica debe conservar su magnitud:", nombre)
    )
    expect_false(
      out$identidad$verificada,
      info = paste("La identidad A=E+no_respondieron falla en:", nombre)
    )

    advertencias <- unlist(out$advertencias, use.names = FALSE)
    expect_true(
      any(grepl(nombre, advertencias, fixed = TRUE)),
      info = paste("Falta advertencia dinamica para:", nombre)
    )

    filas <- unlist(
      lapply(out$dimensiones, function(dimension) dimension$filas),
      recursive = FALSE
    )
    global_tasa <- as.numeric(out$global$tasa)
    global_valida <- length(global_tasa) == 1L && is.finite(global_tasa) &&
      global_tasa >= 0 && global_tasa <= 1
    publicacion_segura <- all(vapply(filas, function(fila) {
      tasa <- as.numeric(fila$tasa)
      publicada <- as.numeric(fila$tasa_publicada)
      fuente <- as.character(fila$fuente_publicada)
      if (!is.finite(publicada)) return(identical(fuente, "sin_publicacion"))
      if (publicada < 0 || publicada > 1) return(FALSE)
      tasa_invalida <- is.finite(tasa) && (tasa < 0 || tasa > 1)
      if (tasa_invalida) {
        return(
          identical(fuente, "global") && global_valida &&
            isTRUE(all.equal(publicada, global_tasa, tolerance = 1e-12))
        )
      }
      if (identical(fuente, "global")) {
        return(
          global_valida &&
            isTRUE(all.equal(publicada, global_tasa, tolerance = 1e-12))
        )
      }
      fuente %in% c("celda", "sin_publicacion")
    }, logical(1)))
    expect_true(
      publicacion_segura,
      info = paste(
        "tasa_publicada debe degradar a global valida o sin_publicacion, sin clamp:",
        nombre
      )
    )
  }
})

test_that("encabezado agrupador real se promueve y admite tipo de sesion ausente", {
  .asr_skip_sin_engine()
  n <- 12L
  cola <- NA_character_
  fuente_agrupada <- data.frame(
    `FACULTAD SINTETICA` = c("CURSO-HORARIO", sprintf("CH-G-%03d", seq_len(n)), cola),
    `...2` = c("MATRICULADOS TOTALES", rep("30", n), cola),
    APLICACION = c("STATUS DE APLICACIÓN", rep("APLICADA", n), cola),
    ENCUESTAS = c("TOTAL ENVIADAS", rep("20", n), cola),
    `...5` = c("TOTAL LARGAS", rep("18", n), cola),
    `...6` = c(NA_character_, rep("0.9", n), cola),
    ASISTENCIA = c("N° ASISTENTES EN AULA", rep("24", n), cola),
    `...8` = c("N° ASISTENTES QUE NO RESPONDIERON", rep("4", n), cola),
    HORARIO = c("RANGO - HORARIO", rep("Mañana", n), cola),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  expect_true(all(is.na(fuente_agrupada[nrow(fuente_agrupada), ])))

  capturado <- tryCatch(
    .asr_run(fuente_agrupada, bootstrap_n = 20L),
    error = identity
  )
  expect_false(
    inherits(capturado, "error"),
    info = paste(
      "Debe promover la primera fila de encabezados exactos, derivar facultad",
      "del agrupador y tolerar tipo_sesion ausente."
    )
  )
  if (inherits(capturado, "error")) return(invisible())
  out <- capturado

  expect_identical(out$schema, "calc_muestra_referencia_asistencia_v2")
  expect_identical(out$cobertura, list(
    agendados = 12L,
    aplicados = 12L,
    observados = 12L,
    glosario_completo = FALSE,
    columnas_glosario = list(), columnas_criterio = list()
  ))
  expect_identical(out$global$k, 12L)
  expect_identical(out$global$metodo_ic, "bootstrap_percentil")

  facultad <- .asr_fila(out, "facultad", "facultad_sintetica")
  expect_identical(facultad$k, 12L)
  expect_match(tolower(facultad$celda_label), "facultad sintetica", fixed = TRUE)
  tipo_ausente <- .asr_fila(out, "tipo_sesion", "sin_dato")
  expect_identical(tipo_ausente$celda_label, "Sin dato")
  expect_identical(tipo_ausente$k, 12L)

  advertencias <- unlist(out$advertencias, use.names = FALSE)
  expect_true(any(vapply(advertencias, function(advertencia) {
    grepl("tipo_sesion", advertencia, fixed = TRUE) &&
      grepl("sin_dato", advertencia, fixed = TRUE)
  }, logical(1))))
})

test_that("bootstrap es reproducible, invariante al orden y no toca el RNG global", {
  .asr_skip_sin_engine()
  out_1 <- .asr_run()
  expect_identical(.asr_run(), out_1)
  reordenada <- .asr_fixture[rev(seq_len(nrow(.asr_fixture))), , drop = FALSE]
  expect_identical(.asr_run(reordenada), out_1)

  set.seed(731L)
  seed_antes <- get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  invisible(.asr_run())
  expect_identical(get(".Random.seed", envir = .GlobalEnv, inherits = FALSE), seed_antes)

  seed_guardada <- get(".Random.seed", envir = .GlobalEnv, inherits = FALSE)
  on.exit(assign(".Random.seed", seed_guardada, envir = .GlobalEnv), add = TRUE)
  rm(".Random.seed", envir = .GlobalEnv)
  invisible(.asr_run())
  expect_false(exists(".Random.seed", envir = .GlobalEnv, inherits = FALSE))
})

# --- ADR 0060: glosario del encuentro, filtros declarables y diseño ------------

.asr_v2_base <- function(n = 40L, extra = list()) {
  datos <- data.frame(
    `CURSO-HORARIO` = sprintf("CH-V2-%03d", seq_len(n)),
    `STATUS DE APLICACIÓN` = rep("APLICADA", n),
    `MATRICULADOS TOTALES` = rep(40, n),
    `N° ASISTENTES EN AULA` = rep(30, n),
    `TOTAL ENVIADAS` = rep(24, n),
    `TOTAL LARGAS` = rep(20, n),
    `N° ASISTENTES QUE NO RESPONDIERON` = rep(6, n),
    `RANGO - HORARIO` = rep("Regular", n),
    facultad = rep("Facultad X", n),
    tipo_sesion = rep("Teórica", n),
    check.names = FALSE
  )
  for (key in names(extra)) datos[[key]] <- extra[[key]]
  datos
}

.asr_v2_glosario <- function(n = 40L, no_efectivas = 3) {
  .asr_v2_base(n, list(
    `MATRICULADOS POBLACIÓN` = rep(35, n),
    ya_medidas = rep(2, n),
    no_elegibles = rep(1, n),
    no_efectivas = rep(no_efectivas, n)
  ))
}

test_that("sin las columnas del glosario el motor degrada y lo declara", {
  out <- calc_muestra_asistencia_referencia(.asr_v2_base(), bootstrap_n = 50L)

  expect_identical(out$schema, "calc_muestra_referencia_asistencia_v2")
  expect_false(out$cobertura$glosario_completo)
  expect_identical(out$cobertura$columnas_glosario, list())
  expect_null(out$encuentros)
  expect_identical(out$denominador, "matriculados_totales")
  expect_identical(out$identidad$regla, "A = E + no_respondieron")

  # La cadena heredada sigue siendo multiplicativa y cierra en el rendimiento.
  expect_equal(out$cadena$asistencia$tasa, 30 / 40)
  expect_equal(out$cadena$apertura$tasa, 24 / 30)
  expect_equal(out$cadena$efectividad$tasa, 20 / 24)
  expect_equal(
    out$cadena$rendimiento$tasa,
    out$cadena$asistencia$tasa * out$cadena$apertura$tasa * out$cadena$efectividad$tasa
  )
})

test_that("con el glosario el denominador pasa a elegibles presentes", {
  out <- calc_muestra_asistencia_referencia(.asr_v2_glosario(), bootstrap_n = 50L)

  expect_true(out$cobertura$glosario_completo)
  expect_identical(out$denominador, "elegibles_presentes")
  expect_identical(out$unidad, "encuentro_en_curso_horario_aplicado")
  expect_setequal(
    unlist(out$cobertura$columnas_glosario),
    c("elegibles", "ya_medidas", "no_elegibles", "no_efectivas")
  )

  enc <- out$encuentros
  # 40 aulas x (30 - 2 - 1) elegibles presentes
  expect_identical(enc$elegibles_presentes, 40 * 27)
  expect_identical(enc$efectivas, 40 * 20)
  expect_identical(enc$no_efectivas, 40 * 3)
  expect_identical(enc$no_realizadas, 40 * 4)

  # ADR 0060, identidad de cierre del encuentro.
  expect_identical(
    enc$elegibles_presentes,
    enc$efectivas + enc$no_efectivas + enc$no_realizadas
  )
  expect_identical(
    out$identidad$regla,
    "elegibles_presentes = efectivas + no_efectivas + no_realizadas"
  )
  # asistencia sobre elegibles, efectividad sobre elegibles presentes.
  expect_equal(out$cadena$asistencia$tasa, 30 / 35)
  expect_equal(out$cadena$efectividad$tasa, 20 / 27)
  expect_equal(out$cadena$rendimiento$tasa, 20 / 35)
})

test_that("un residual negativo se marca y no se publica", {
  # no_efectivas = 12 deja elegibles_presentes - efectivas - no_efectivas < 0.
  out <- calc_muestra_asistencia_referencia(
    .asr_v2_glosario(no_efectivas = 12), bootstrap_n = 50L
  )

  expect_identical(out$identidad$residuales_negativos, 40L)
  expect_identical(out$encuentros$unidades_publicables, 0L)
  expect_true(is.na(out$encuentros$no_realizadas))
})

test_that("la taxonomia de clases de filtro es cerrada", {
  base <- .asr_v2_base()

  expect_error(
    calc_muestra_asistencia_referencia(
      base, bootstrap_n = 50L,
      filtros_corte = list(list(id = "x", clase = "inventada"))
    ),
    "no pertenece a la taxonom"
  )
  expect_error(
    calc_muestra_asistencia_referencia(
      base, bootstrap_n = 50L,
      filtros_corte = list(list(id = "a", clase = "rechazo"), list(id = "a", clase = "abandono"))
    ),
    "repetido"
  )
  expect_error(
    calc_muestra_asistencia_referencia(
      base, bootstrap_n = 50L,
      filtros_corte = list(list(id = "a", clase = "rechazo", origen = "excel"))
    ),
    "origen"
  )
  expect_error(
    calc_muestra_asistencia_referencia(
      base, bootstrap_n = 50L,
      filtros_corte = list(list(clase = "rechazo"))
    ),
    "debe declarar un id"
  )
})

test_that("la clase decide el efecto sobre el denominador, no el estudio", {
  out <- calc_muestra_asistencia_referencia(
    .asr_v2_base(), bootstrap_n = 50L,
    filtros_corte = list(
      list(id = "ciclos", clase = "no_elegible", orden = 3),
      list(id = "consent", clase = "rechazo", orden = 1),
      list(id = "repetido", clase = "ya_medido", origen = "campo", orden = 2)
    )
  )

  # Se ordenan por `orden`, no por el orden de declaración.
  expect_identical(vapply(out$filtros_corte, function(f) f$id, ""), c("consent", "repetido", "ciclos"))
  efecto <- vapply(out$filtros_corte, function(f) f$en_denominador, logical(1))
  expect_identical(efecto, c(TRUE, FALSE, FALSE))
  expect_identical(out$filtros_corte[[2]]$origen, "campo")
  # El origen por defecto es el formulario.
  expect_identical(out$filtros_corte[[1]]$origen, "formulario")
})

test_that("el diseno del estudio previo viaja con la referencia", {
  out <- calc_muestra_asistencia_referencia(
    .asr_v2_base(), bootstrap_n = 50L,
    diseno = list(
      poblacion_objetivo = 22234, muestra = 2500, sobremuestra = 3750,
      ratio_sobremuestra = 1.5, nivel_confianza = 0.95,
      proporcion_esperada = 0.30, margen_error = 0.0246, deff = 2,
      aulas_marco = 1097, aulas_dimensionadas = 170, aulas_aplicadas = 194,
      tasa_respuesta_asumida = 0.7038,
      afijacion = "proporcional_facultad_sexo",
      metodo_seleccion = "sistematico",
      metodo_ajuste = "recorte_aleatorio_por_celda",
      ponderado = TRUE
    )
  )

  expect_true(out$diseno$declarado)
  expect_identical(out$diseno$muestra, 2500)
  expect_identical(out$diseno$sobremuestra, 3750)
  expect_identical(out$diseno$deff, 2)
  expect_identical(out$diseno$metodo_ajuste, "recorte_aleatorio_por_celda")
  expect_true(out$diseno$ponderado)

  vacio <- calc_muestra_asistencia_referencia(.asr_v2_base(), bootstrap_n = 50L)
  expect_false(vacio$diseno$declarado)
  expect_null(vacio$diseno$muestra)
  expect_identical(vacio$filtros_corte, list())
})

test_that("los tramos de tamano salen de los grupos declarados, no del motor", {
  .asr_skip_sin_engine()

  # Sin declaracion, la dimension no existe: el motor no inventa una escala.
  sin_grupos <- .asr_run()
  expect_false("tamano" %in% vapply(
    sin_grupos$dimensiones, function(d) d$dimension_key, character(1)
  ))

  # Con dos tramos propios, la dimension habla en ESOS tramos.
  propios <- .asr_run(grupos_tamano = list(
    list(id = "chico", label = "Hasta 39", min = 0, max = 39),
    list(id = "grande", label = "40 o más", min = 40, max = NA)
  ))
  dimension <- .asr_dimension(propios, "tamano")
  expect_identical(
    vapply(dimension$filas, function(f) f$celda_key, character(1)),
    c("chico", "grande")
  )
  expect_identical(
    vapply(dimension$filas, function(f) f$celda_label, character(1)),
    c("Hasta 39", "40 o más")
  )
  # Reparto exhaustivo y sin solape: cada curso-horario cae en un tramo.
  expect_identical(
    sum(vapply(dimension$filas, function(f) f$k, integer(1))),
    sum(vapply(.asr_dimension(propios, "facultad")$filas, function(f) f$k, integer(1)))
  )
})

test_that("la serie semanal publica sus bases y las cadenas su historia", {
  .asr_skip_sin_engine()

  # La fixture heredada no declara semana ni cadena: ambos bloques son opcionales
  # y su ausencia se lee como NULL, no como error.
  base <- .asr_run()
  expect_null(base$serie_campo)
  expect_null(base$cadenas_reemplazo)

  datos <- .asr_fixture
  n <- nrow(datos)
  datos$semana <- rep(c(1L, 2L), length.out = n)
  datos$cadena <- seq_len(n)
  datos$posicion <- rep(1L, n)
  datos$rol <- rep("TITULAR", n)
  out <- .asr_run(datos)

  expect_identical(out$serie_campo$unidad, "semana_de_campo")
  expect_length(out$serie_campo$filas, 2L)
  for (semana in out$serie_campo$filas) {
    # Toda tasa publicada tiene que poder reconstruirse desde los absolutos que
    # viajan a su lado: un porcentaje sin su base no se puede verificar.
    expect_equal(
      semana$asistencia, semana$asistentes / semana$elegibles,
      tolerance = 1e-9
    )
    expect_equal(
      semana$rendimiento, semana$efectivas / semana$elegibles,
      tolerance = 1e-9
    )
    expect_gte(semana$elegibles, semana$asistentes)
  }
  # El acumulado del último corte es el total del campo.
  ultimo <- out$serie_campo$filas[[length(out$serie_campo$filas)]]
  expect_equal(
    ultimo$efectivas_acumuladas,
    sum(vapply(out$serie_campo$filas, function(f) f$efectivas, numeric(1)))
  )

  cadenas <- out$cadenas_reemplazo
  expect_identical(cadenas$unidad, "cadena_de_reemplazo")
  expect_identical(cadenas$cadenas_declaradas, n)
  # Una cadena se resuelve en su titular o en un reemplazo, nunca en ambos.
  expect_identical(
    cadenas$resueltas_con_titular + cadenas$resueltas_con_reemplazo,
    cadenas$cadenas_resueltas
  )
  for (fila in cadenas$filas) {
    expect_gte(length(fila$escalones), 1L)
    for (escalon in fila$escalones) {
      expect_true(escalon$estado %in% c("aplicado", "cayo", "reserva"))
    }
  }
})
