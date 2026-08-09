source("setup-load-all.R")

# G2-L0.1 — contraejemplos metodologicos de la ola 4.
#
# Estos fixtures son deliberadamente pequenos: cada fila cambia una sola
# decision (peso, filtro, firma, grano o completitud de matriz). El objetivo no
# es caracterizar la implementacion, sino fijar la afirmacion que el grafico
# hace sobre los datos antes de dibujarla.

.g2_fuente <- function(valores,
                       tipo = "select_one lik",
                       codigos = c("0", "1"),
                       etiquetas = c("No", "Si"),
                       pesos = rep(1, length(valores)),
                       segmento = rep("incluido", length(valores)),
                       repeat_grain = NULL) {
  data <- data.frame(
    id = seq_along(valores),
    p1 = valores,
    segmento = segmento,
    peso = pesos,
    stringsAsFactors = FALSE
  )
  attr(data, "var_peso") <- "peso"

  inst <- list(
    survey = data.frame(
      type = c("integer", tipo, "select_one segmento", "decimal"),
      name = c("id", "p1", "segmento", "peso"),
      list_name = c("", "lik", "segmento", ""),
      label = c("ID", "Pregunta", "Segmento", "Peso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lik", length(codigos)), "segmento", "segmento"),
      name = c(as.character(codigos), "incluido", "fuera"),
      label = c(as.character(etiquetas), "Incluido", "Fuera"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  if (!is.null(repeat_grain)) attr(inst, "repeat_grain") <- repeat_grain
  list(data = data, inst = inst)
}

.g2_sources <- function(...) {
  fuentes <- list(...)
  list(
    data_sources = lapply(fuentes, `[[`, "data"),
    inst_sources = lapply(fuentes, `[[`, "inst")
  )
}

.g2_capturar_error <- function(expr) {
  tryCatch(
    {
      force(expr)
      NULL
    },
    error = identity
  )
}

.g2_esperar_error_contextual <- function(error, patrones) {
  expect_true(inherits(error, "error"), info = "El contraejemplo fue aceptado en vez de fallar cerrado.")
  if (!inherits(error, "error")) return(invisible(NULL))
  mensaje <- conditionMessage(error)
  for (patron in patrones) expect_match(mensaje, patron, perl = TRUE)
  invisible(error)
}

.g2_ctx_lollipop <- function(tipo = "select_one lik", repeat_grain = NULL) {
  fuente <- .g2_fuente(c("0", "1"), tipo = tipo, repeat_grain = repeat_grain)
  list(
    source = "base",
    data = fuente$data,
    instrumento = fuente$inst,
    survey = fuente$inst$survey,
    choices = fuente$inst$choices,
    var = "p1",
    var_requested = "p1",
    raw_ref = "p1"
  )
}

test_that("el estimador multibase pondera 9/1 y conserva argumentos opcionales de cola", {
  expect_identical(names(formals(.radar_mb_pct)), c("valores", "codigos", "pesos"))
  expect_identical(names(formals(.radar_mb_datos)), c("ejes", "corte", "sources", "filtros"))

  src <- .g2_sources(
    base = .g2_fuente(c("1", "0"), pesos = c(9, 1))
  )
  datos <- .radar_mb_datos(list(Tema = "base$p1"), "1", src)

  # Nueve unidades ponderadas en el indicador y una fuera: 90 %, no 50 %.
  expect_equal(datos$valor, 90)
})

test_that("el estimador respeta la columna de peso publico declarada en var_peso", {
  fuente <- .g2_fuente(c("1", "0"), pesos = c(9, 1))
  names(fuente$data)[names(fuente$data) == "peso"] <- "peso_final"
  attr(fuente$data, "var_peso") <- "peso_final"
  fuente$inst$survey$name[fuente$inst$survey$name == "peso"] <- "peso_final"
  src <- .g2_sources(base = fuente)

  datos <- .radar_mb_datos(list(Tema = "base$p1"), "1", src)

  expect_equal(datos$valor, 90)
  expect_equal(datos$n, 10)
})

test_that("el estimador multibase aplica filtros nombrados antes del denominador", {
  src <- .g2_sources(
    base = .g2_fuente(
      c("1", "1", "0", "0"),
      segmento = c("incluido", "incluido", "fuera", "fuera")
    )
  )

  filtrado <- tryCatch(
    .radar_mb_datos(
      list(Tema = "base$p1"),
      "1",
      src,
      filtros = list(segmento = "incluido")
    ),
    error = identity
  )
  expect_false(inherits(filtrado, "error"), info = if (inherits(filtrado, "error")) conditionMessage(filtrado) else NULL)
  if (!inherits(filtrado, "error")) {
    expect_equal(filtrado$valor, 100)
    expect_equal(filtrado$n, 2L)
  }
})

test_that("la firma E1 compara codigo y etiqueta acreditados por tema", {
  src <- .g2_sources(
    referencia = .g2_fuente(c("0", "1"), etiquetas = c("No", "Si")),
    comparacion = .g2_fuente(c("0", "1"), etiquetas = c("No", "Afirmativo"))
  )

  error <- .g2_capturar_error(.radar_mb_datos(
    list(Satisfaccion = c("referencia$p1", "comparacion$p1")),
    "1",
    src
  ))

  .g2_esperar_error_contextual(error, c("Satisfaccion", "referencia\\$p1", "comparacion\\$p1"))
})

test_that("select_multiple, repeat y tipo desconocido fallan cerrados", {
  multiple <- .g2_sources(
    base = .g2_fuente(c("0", "1"), tipo = "select_multiple lik")
  )
  error_multiple <- .g2_capturar_error(.radar_mb_datos(
    list(Tema = "base$p1"), "1", multiple
  ))
  .g2_esperar_error_contextual(error_multiple, c("select_one"))

  repeat_src <- .g2_sources(
    hija = .g2_fuente(
      c("0", "1"),
      repeat_grain = list(
        kind = "instancia",
        parent_base = "madre",
        repeat_group = "servicios"
      )
    )
  )
  error_repeat <- .g2_capturar_error(.radar_mb_datos(
    list(Tema = "hija$p1"), "1", repeat_src
  ))
  .g2_esperar_error_contextual(error_repeat, c("repeat|independiente|plana"))

  desconocida <- .g2_sources(
    base = .g2_fuente(c("0", "1"), tipo = NA_character_)
  )
  error_desconocida <- .g2_capturar_error(.radar_mb_datos(
    list(Tema = "base$p1"), "1", desconocida
  ))
  .g2_esperar_error_contextual(error_desconocida, c("desconoc|select_one"))
})

test_that("una ref inexistente y un corte ausente en la escala nombran el contraejemplo", {
  src <- .g2_sources(base = .g2_fuente(c("0", "1")))

  error_ref <- .g2_capturar_error(.radar_mb_datos(
    list(Tema_ausente = "base$no_existe"), "1", src
  ))
  .g2_esperar_error_contextual(error_ref, c("Tema_ausente", "base\\$no_existe"))

  error_corte <- .g2_capturar_error(.radar_mb_datos(
    list(Tema_corte = "base$p1"), "9", src
  ))
  .g2_esperar_error_contextual(error_corte, c("Tema_corte", "base\\$p1", "9"))
})

test_that("Dumbbell exige las mismas dos fuentes completas y en el mismo orden", {
  error_incompleto <- .g2_capturar_error(p_dumbbell(
    vars = list(Tema = "a$p1"),
    corte = "1"
  ))
  .g2_esperar_error_contextual(error_incompleto, c("Tema", "dos|2"))

  error_orden <- .g2_capturar_error(p_dumbbell(
    vars = list(
      Tema_A = c("a$p1", "b$p1"),
      Tema_B = c("b$p1", "a$p1")
    ),
    corte = "1"
  ))
  .g2_esperar_error_contextual(error_orden, c("Tema_B", "orden|fuentes"))
})

test_that("la diferencia Dumbbell es segunda fuente menos primera", {
  skip_if_not_installed("ggplot2")
  datos <- data.frame(
    eje = c("Tema", "Tema"),
    grupo = factor(c("referencia", "comparacion"), levels = c("referencia", "comparacion")),
    valor = c(10, 90),
    stringsAsFactors = FALSE
  )
  grafico <- graficar_dumbbell(datos, mostrar_brecha = TRUE)
  expect_equal(grafico$layers[[1]]$data$.brecha, 80)
})

test_that("Serie temporal exige secuencia implicita identica y matriz completa", {
  error_secuencia <- .g2_capturar_error(p_serie_temporal(
    vars = list(
      Tema_A = c("ola1$p1", "ola2$p1"),
      Tema_B = c("ola1$p1", "ola3$p1")
    ),
    corte = "1"
  ))
  .g2_esperar_error_contextual(error_secuencia, c("Tema_B", "period|fuentes|secuencia"))

  error_hueco <- .g2_capturar_error(p_serie_temporal(
    vars = list(
      Tema_A = c("ola1$p1", "ola2$p1"),
      Tema_B = "ola1$p1"
    ),
    corte = "1"
  ))
  .g2_esperar_error_contextual(error_hueco, c("Tema_B", "ola2|complet"))
})

test_that("orden_periodos es una permutacion exacta, completa y sin duplicados", {
  vars <- list(
    Tema_A = c("ola1$p1", "ola2$p1"),
    Tema_B = c("ola2$p1", "ola1$p1")
  )

  error_duplicado <- .g2_capturar_error(p_serie_temporal(
    vars = vars,
    corte = "1",
    orden_periodos = c("ola1", "ola1")
  ))
  .g2_esperar_error_contextual(error_duplicado, c("orden_periodos", "duplic|permut"))

  error_ajeno <- .g2_capturar_error(p_serie_temporal(
    vars = vars,
    corte = "1",
    orden_periodos = c("ola1", "ola3")
  ))
  .g2_esperar_error_contextual(error_ajeno, c("orden_periodos", "ola2|ola3|permut"))

  valido <- p_serie_temporal(
    vars = vars,
    corte = "1",
    orden_periodos = c("ola2", "ola1")
  )
  expect_identical(valido$overrides$orden_periodos, c("ola2", "ola1"))
})

test_that("overrides no puede eludir la permutacion exacta de orden_periodos", {
  vars <- list(Tema = c("ola1$p1", "ola2$p1"))

  error_duplicado <- .g2_capturar_error(p_serie_temporal(
    vars = vars,
    corte = "1",
    overrides = list(orden_periodos = c("ola1", "ola1"))
  ))
  .g2_esperar_error_contextual(error_duplicado, c("orden_periodos", "duplic|permut"))

  error_ajeno <- .g2_capturar_error(p_serie_temporal(
    vars = vars,
    corte = "1",
    overrides = list(orden_periodos = c("ola1", "ola3"))
  ))
  .g2_esperar_error_contextual(error_ajeno, c("orden_periodos", "ola2|ola3|permut"))
})

test_that("el preset efectivo tampoco puede duplicar orden_periodos", {
  src <- .g2_sources(
    ola1 = .g2_fuente(c("0", "1")),
    ola2 = .g2_fuente(c("1", "1"))
  )
  data_sources <- src$data_sources
  instrument_sources <- src$inst_sources
  elemento <- p_serie_temporal(
    vars = list(Tema = c("ola1$p1", "ola2$p1")),
    corte = "1"
  )

  error <- .g2_capturar_error(.render_serie_temporal(
    elemento,
    preset_args = list(orden_periodos = c("ola1", "ola1"))
  ))
  .g2_esperar_error_contextual(error, c("orden_periodos", "duplic|permut|exacta"))
})

test_that("direccion positivo_negativo invierte lados sin reordenar la escala", {
  skip_if_not_installed("ggplot2")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c("Positiva", "Neutral", "Negativa", "Total"),
      n = c(60, 10, 30, 100),
      stringsAsFactors = FALSE
    )
  }

  elemento <- tryCatch(
    p_barras_divergentes(
      vars = "p1",
      n_negativas = 1,
      mostrar_saldo = FALSE,
      direccion_escala = "positivo_negativo"
    ),
    error = identity
  )
  expect_false(inherits(elemento, "error"), info = if (inherits(elemento, "error")) conditionMessage(elemento) else NULL)
  if (inherits(elemento, "error")) return(invisible(NULL))

  grafico <- .render_barras_divergentes(elemento)
  primera <- grafico$data$.signo[as.character(grafico$data$.cat) == "niv_1"]
  ultima <- grafico$data$.signo[as.character(grafico$data$.cat) == "niv_3"]

  expect_true(all(primera > 0))
  expect_true(all(ultima < 0))
  expect_identical(levels(grafico$data$.cat), c("niv_1", "niv_2", "niv_3"))
})

test_that("direccion positivo_negativo conserva n_negativas en una escala par asimetrica", {
  skip_if_not_installed("ggplot2")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c(
        "Muy positiva", "Positiva", "Algo positiva", "Negativa", "Total"
      ),
      n = c(35, 30, 25, 10, 100),
      stringsAsFactors = FALSE
    )
  }

  elemento <- p_barras_divergentes(
    vars = "p1",
    n_negativas = 1,
    mostrar_saldo = FALSE,
    direccion_escala = "positivo_negativo"
  )
  grafico <- .render_barras_divergentes(elemento)

  negativas <- unique(as.character(
    grafico$data$.cat[grafico$data$.signo < 0]
  ))
  positivas <- unique(as.character(
    grafico$data$.cat[grafico$data$.signo > 0]
  ))

  # `n_negativas = 1` conserva su cardinalidad semantica: en una escala que va
  # de positivo a negativo, el UNICO nivel negativo es el ultimo. Intercambiar
  # las listas completas produciria tres negativos y solo uno positivo.
  expect_length(negativas, 1L)
  expect_identical(negativas, "niv_4")
  expect_length(positivas, 3L)
  expect_setequal(positivas, c("niv_1", "niv_2", "niv_3"))
  expect_identical(
    levels(grafico$data$.cat),
    c("niv_1", "niv_2", "niv_3", "niv_4")
  )
})

test_that("Lollipop acepta solo select_one plano", {
  skip_if_not_installed("ggplot2")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(Opciones = c("No", "Si", "Total"), n = c(1, 1, 2), stringsAsFactors = FALSE)
  }

  .resolve_ref <- function(ref, arg_name = "var") .g2_ctx_lollipop("select_multiple lik")
  error_multiple <- .g2_capturar_error(.render_lollipop(p_lollipop("p1")))
  .g2_esperar_error_contextual(error_multiple, c("select_one"))

  .resolve_ref <- function(ref, arg_name = "var") {
    .g2_ctx_lollipop(
      "select_one lik",
      repeat_grain = list(kind = "instancia", parent_base = "madre", repeat_group = "servicios")
    )
  }
  error_repeat <- .g2_capturar_error(.render_lollipop(p_lollipop("p1")))
  .g2_esperar_error_contextual(error_repeat, c("repeat|independiente|plana"))
})

test_that("Lollipop propaga errores de resolucion de referencia", {
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(Opciones = c("No", "Si", "Total"), n = c(1, 1, 2), stringsAsFactors = FALSE)
  }
  .resolve_ref <- function(ref, arg_name = "var") stop("E_REF_SENTINELA: p1 no existe", call. = FALSE)

  error <- .g2_capturar_error(.ola4_tabla_opciones("p1", list()))
  .g2_esperar_error_contextual(error, c("E_REF_SENTINELA", "p1"))
})

test_that("Lollipop conserva una categoria sustantiva llamada Total", {
  .tab_freq <- function(ref, filtros = list()) {
    # La primera fila es una opcion real; solo la ultima es el agregado del
    # helper de frecuencias.
    data.frame(
      Opciones = c("Total", "Otra", "Total"),
      n = c(3, 7, 10),
      stringsAsFactors = FALSE
    )
  }
  .resolve_ref <- function(ref, arg_name = "var") .g2_ctx_lollipop()
  .exclusion_for_ctx <- function(ctx, excluir_opciones) excluir_opciones

  tabla <- .ola4_tabla_opciones("p1", list())
  expect_identical(as.character(tabla$Opciones), c("Total", "Otra"))
  expect_equal(tabla$n, c(3, 7))
})

test_that("excluir cambia el denominador; top_n solo oculta y declara N de M", {
  skip_if_not_installed("ggplot2")
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(
      Opciones = c("A", "B", "Sin opinion", "Total"),
      n = c(4, 4, 2, 10),
      stringsAsFactors = FALSE
    )
  }
  .resolve_ref <- function(ref, arg_name = "var") .g2_ctx_lollipop()
  .exclusion_for_ctx <- function(ctx, excluir_opciones) excluir_opciones

  completo <- .render_lollipop(p_lollipop("p1", excluir_opciones = "Sin opinion"))
  recortado <- .render_lollipop(p_lollipop(
    "p1",
    top_n = 1,
    excluir_opciones = "Sin opinion"
  ))

  expect_equal(sum(completo$data$.valor), 100)
  expect_equal(recortado$data$.valor, 50)
  expect_identical(recortado$labels$caption, "Se muestran 1 de 2 categorías.")
})
