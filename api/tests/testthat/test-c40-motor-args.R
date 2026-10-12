# C40 capa motor/registro (docs/qa/revision-c40-args-sin-control-f6-2026-10-11.md): cada arg que la tarjeta de Láminas
# ofrece tiene que llegar a la lámina nativa. `.clean_rebuild_args()` (router_graficos.R) descarta del slot todo lo que
# no es formal del constructor, así que un arg declarado en el registro y ausente de los formals es un control que
# promete algo que la lámina no dibuja (C5). Regla: el recetario manda (default del registro = recetario).
#
# Cada caso va por el camino real: slot JSON → `.rebuild_graf()` → `reporte_ppt_plan(solo_lista = TRUE)` → la espec
# nativa (`attr(, "pulso_espec")`) que lee el compositor de láminas. Datos sintéticos, sin red ni reloj.

# ---- fixture de una base --------------------------------------------------------------------------------------------

.cm_cods <- c("1", "2", "3", "4", "99")
.cm_labs <- c("Muy bien", "Bien", "Regular", "Mal", "No responde")
.cm_medios <- c("Radio", "TV", "Diario", "Web", "Amigos", "Otros medios")

.cm_inst <- function() {
  list(
    survey = data.frame(name = c("q", "e", "m", "g"),
                        type = c("select_one l_q", "integer", "select_one l_m", "select_one l_g"),
                        label = c("Pregunta Q", "Edad", "Medio", "Grupo"), stringsAsFactors = FALSE),
    choices = rbind(
      data.frame(list_name = "l_q", name = .cm_cods, label = .cm_labs, stringsAsFactors = FALSE),
      data.frame(list_name = "l_m", name = as.character(1:6), label = .cm_medios, stringsAsFactors = FALSE),
      data.frame(list_name = "l_g", name = c("A", "B"), label = c("A", "B"), stringsAsFactors = FALSE)
    ),
    orders_list = list(
      q = list(names = .cm_cods, labels = .cm_labs, label = "Pregunta Q"),
      m = list(names = as.character(1:6), labels = .cm_medios, label = "Medio"),
      g = list(names = c("A", "B"), labels = c("A", "B"), label = "Grupo")
    )
  )
}

# q: «Regular» (3) sin casos y 99 ausente. e: edades 18-40. m: seis medios con 3/2/2/1/1/1 casos.
.cm_data <- function() {
  data.frame(q = rep(c("1", "2", "4"), c(5, 3, 2)),
             e = c(18, 19, 19, 20, 20, 20, 21, 25, 30, 40),
             m = as.character(rep(1:6, c(3, 2, 2, 1, 1, 1))),
             g = rep(c("A", "B"), 5), stringsAsFactors = FALSE)
}

.cm_slot <- function(graficador, ...) .rebuild_graf(list(graficador = graficador, args = list(...)))

.cm_espec <- function(el, presets = NULL, data = .cm_data(), instrumento = .cm_inst()) {
  res <- suppressWarnings(suppressMessages(reporte_ppt_plan(
    data = data, instrumento = instrumento, plan = list(a = p_slide_1_grafico(grafico = el)),
    presets = presets, solo_lista = TRUE, mensajes_progreso = FALSE
  )))
  attr(res$rendered[[1]], "pulso_espec")
}

# Presets como los arma el router para el entregable: suelo de la casa + lo del proyecto.
.cm_presets_router <- function(proyecto = list()) .build_presets(.enriquecer_presets(proyecto, NULL))

.cm_arg <- function(graficador, nm) {
  for (a in .GRAFICADORES_META[[graficador]]$args) if (identical(a$name, nm)) return(a)
  NULL
}
.cm_preset_arg <- function(preset, nm) {
  for (a in .PRESETS_META[[preset]]$args) if (identical(a$name, nm)) return(a)
  NULL
}

# ---- contrato: registro ⊂ formales, y el slot no lo descarta ---------------------------------------------------------

.CM_ASIGNADOS <- list(
  p_media_rango = c("decimales_promedio", "tipo_rango"),
  p_barras_agrupadas = c("max_categorias", "agrupar_resto_en_otros", "etiqueta_otros"),
  p_dumbbell = "etiqueta_brecha",
  p_barras_apiladas = "mostrar_categorias_en_cero",
  p_barras_multiapiladas = "mostrar_categorias_en_cero",
  p_histograma = "limite_superior"
)

test_that("cada arg C40 está en el registro de su graficador y es formal de su constructor", {
  for (g in names(.CM_ASIGNADOS)) {
    fn <- get(g, mode = "function")
    for (nm in .CM_ASIGNADOS[[g]]) {
      expect_false(is.null(.cm_arg(g, nm)), label = paste(g, nm, "en el registro"))
      expect_true(nm %in% names(formals(fn)), label = paste(g, nm, "formal"))
      # Lo que la tarjeta escribe en el slot sobrevive a `.clean_rebuild_args()`.
      expect_true(nm %in% names(.clean_rebuild_args(stats::setNames(list(1), nm), fn)), label = paste(g, nm, "slot"))
    }
  }
})

test_that("media y rango: el registro ya no ofrece `chip_decimales`, que el slot descartaba", {
  expect_null(.cm_arg("p_media_rango", "chip_decimales"))
  expect_false("chip_decimales" %in% names(.clean_rebuild_args(list(chip_decimales = 2), p_media_rango)))
})

# ---- 1. decimales de media y rango ------------------------------------------------------------------------------------

test_that("decimales_promedio de la tarjeta llega a «Media N» de la lámina nativa", {
  e2 <- .cm_espec(.cm_slot("p_media_rango", var = "e", cruce = "g", decimales_promedio = 2))
  expect_identical(e2$cifras, c("21.60", "24.80"))
  e0 <- .cm_espec(.cm_slot("p_media_rango", var = "e", cruce = "g", decimales_promedio = 0))
  expect_identical(e0$cifras, c("22", "25"))
  # Sin tocarlo: el default del registro (1) es el del graficador.
  expect_identical(.cm_espec(.cm_slot("p_media_rango", var = "e", cruce = "g"))$cifras, c("21.6", "24.8"))
  expect_equal(.cm_arg("p_media_rango", "decimales_promedio")$default, eval(formals(graficar_media_rango)$chip_decimales))
  expect_error(p_media_rango("e", decimales_promedio = 3), "decimales_promedio")
})

# ---- 2 y 3. Otros en barras agrupadas ---------------------------------------------------------------------------------

test_that("max_categorias y etiqueta_otros de la tarjeta recortan la espec nativa de agrupadas", {
  # Las cifras se comparan sin el número de casos («Casos junto al porcentaje» en «nunca»).
  withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))
  sin <- .cm_espec(.cm_slot("p_barras_agrupadas", var = "m"))
  expect_length(sin$rotulos, 6L)                                       # sin preset ni arg: las seis opciones
  e <- .cm_espec(.cm_slot("p_barras_agrupadas", var = "m", max_categorias = 3, etiqueta_otros = "Resto"))
  expect_setequal(e$rotulos, c("Radio", "TV", "Resto"))
  expect_identical(unname(e$cifras[e$rotulos == "Resto"]), "50%")      # 5 de 10: el denominador no cambia
  expect_identical(unname(e$cifras[e$rotulos == "Radio"]), "30%")
})

test_that("agrupar_resto_en_otros = FALSE de la tarjeta apaga el recorte aunque haya máximo", {
  e <- .cm_espec(.cm_slot("p_barras_agrupadas", var = "m", max_categorias = 3, agrupar_resto_en_otros = FALSE,
                          etiqueta_otros = "Resto"))
  expect_length(e$rotulos, 6L)
  expect_false("Resto" %in% e$rotulos)
})

test_that("agrupadas: los defaults del registro son los de la casa y un override explícito manda sobre el formal", {
  casa <- .PRESETS_DEFAULT_PULSO$barras_agrupadas
  for (nm in c("max_categorias", "agrupar_resto_en_otros", "etiqueta_otros")) {
    expect_identical(.cm_arg("p_barras_agrupadas", nm)$default, casa[[nm]], label = nm)
  }
  # Con el suelo de la casa (12) seis opciones no se recortan; con el slot en 3, sí.
  expect_length(.cm_espec(.cm_slot("p_barras_agrupadas", var = "m"), presets = .cm_presets_router())$rotulos, 6L)
  expect_length(.cm_espec(.cm_slot("p_barras_agrupadas", var = "m", max_categorias = 3),
                          presets = .cm_presets_router())$rotulos, 3L)
  el <- p_barras_agrupadas("m", overrides = list(max_categorias = 4), max_categorias = 3)
  expect_identical(el$overrides$max_categorias, 4)
  # Texto en blanco no escribe: rige el preset.
  expect_null(p_barras_agrupadas("m", etiqueta_otros = "  ")$overrides$etiqueta_otros)
  expect_error(p_barras_agrupadas("m", max_categorias = "x"), "max_categorias")
  expect_error(p_barras_agrupadas("m", agrupar_resto_en_otros = NA), "agrupar_resto_en_otros")
})

# ---- 4. unidad de la brecha del dumbbell ------------------------------------------------------------------------------

.cm_ola <- function(valores) {
  out <- data.frame(p1 = valores, peso = 1, stringsAsFactors = FALSE)
  attr(out, "var_peso") <- "peso"
  out
}
.cm_inst_ola <- function() {
  list(survey = data.frame(name = c("p1", "peso"), type = c("select_one lik", "decimal"), list_name = c("lik", ""),
                           label = c("Pregunta", "Peso"), stringsAsFactors = FALSE),
       choices = data.frame(list_name = "lik", name = c("1", "2", "3"), label = c("Negativa", "Neutral", "Positiva"),
                            stringsAsFactors = FALSE),
       orders_list = NULL)
}
.cm_dumbbell <- function(...) {
  el <- .cm_slot("p_dumbbell", vars = list(Tema = c("ola1$p1", "ola2$p1")), corte = "3", ...)
  .cm_espec(el, data = list(ola1 = .cm_ola(c("3", "3", "3", "1")), ola2 = .cm_ola(c("3", "1", "1", "1"))),
            instrumento = list(ola1 = .cm_inst_ola(), ola2 = .cm_inst_ola()))
}

test_that("etiqueta_brecha de la tarjeta llega a la columna Diferencia de la lámina nativa", {
  expect_identical(.cm_dumbbell(etiqueta_brecha = "puntos")$textos_diferencia, "+50 puntos")   # 75 % − 25 %
  expect_identical(.cm_dumbbell()$textos_diferencia, "+50 pts")
})

test_that("etiqueta_brecha: registro, preset y motor dicen «pts», como el recetario", {
  expect_identical(.cm_arg("p_dumbbell", "etiqueta_brecha")$default, "pts")
  expect_identical(.cm_preset_arg("dumbbell", "etiqueta_brecha")$default, "pts")
  expect_identical(formals(graficar_dumbbell)$etiqueta_brecha, "pts")
})

# ---- 5. categorías en cero en apiladas y multiapiladas ----------------------------------------------------------------

test_that("mostrar_categorias_en_cero de la tarjeta dibuja el sustantivo en cero en apiladas; el 99 ausente nunca", {
  sin <- .cm_espec(.cm_slot("p_barras_apiladas", var = "q"))
  expect_false(sin$dibujar[1, "pct_3"])
  con <- .cm_espec(.cm_slot("p_barras_apiladas", var = "q", mostrar_categorias_en_cero = TRUE))
  expect_true(con$dibujar[1, "pct_3"])
  expect_identical(unname(con$cifras[1, "pct_3"]), "0%")
  expect_false("No responde" %in% con$categorias$rotulo)               # I-a: los 90-99 ausentes no resucitan
  expect_false(any(con$dibujar[, con$categorias$especial, drop = FALSE]))
})

test_that("mostrar_categorias_en_cero de la tarjeta llega a multiapiladas, también por bloque", {
  sin <- .cm_espec(.cm_slot("p_barras_multiapiladas", modo = "var", vars = list("q")))
  expect_false(sin$dibujar[1, "pct_3"])
  con <- .cm_espec(.cm_slot("p_barras_multiapiladas", modo = "var", vars = list("q"), mostrar_categorias_en_cero = TRUE))
  expect_true(con$dibujar[1, "pct_3"])
  expect_false("No responde" %in% con$categorias$rotulo)
  # En «Combinar bloques» el bloque hereda el formal y puede pisarlo con su override.
  el <- p_barras_multiapiladas(modo = "multilista", mostrar_categorias_en_cero = TRUE,
                               bloques = list(list(modo = "var", vars = "q"),
                                              list(modo = "var", vars = "q", overrides = list(mostrar_categorias_en_cero = FALSE))))
  expect_true(isTRUE(el$bloques[[1]]$overrides$mostrar_categorias_en_cero))
  expect_false(isTRUE(el$bloques[[2]]$overrides$mostrar_categorias_en_cero))
})

test_that("mostrar_categorias_en_cero: el default del registro es el de los presets", {
  expect_false(.cm_arg("p_barras_apiladas", "mostrar_categorias_en_cero")$default)
  expect_false(.cm_arg("p_barras_multiapiladas", "mostrar_categorias_en_cero")$default)
  expect_false(.cm_preset_arg("barras_apiladas", "mostrar_categorias_en_cero")$default)
  expect_false(.cm_preset_arg("multi_apiladas", "mostrar_categorias_en_cero")$default)
  expect_error(p_barras_apiladas("q", mostrar_categorias_en_cero = "si"), "mostrar_categorias_en_cero")
})

# ---- 6. tipo de rango de media y rango --------------------------------------------------------------------------------

test_that("tipo_rango: un solo default, «minmax», el que dibuja la lámina 82 del recetario", {
  opciones <- c("minmax", "iqr", "p10_p90", "custom")
  reg <- .cm_arg("p_media_rango", "tipo_rango")
  pre <- .cm_preset_arg("media_rango", "tipo_rango")
  expect_identical(reg$default, "minmax")
  expect_identical(pre$default, "minmax")
  expect_identical(.PRESETS_DEFAULT_PULSO$media_rango$tipo_rango, "minmax")
  for (a in list(reg, pre)) {
    valores <- vapply(a$choices, function(ch) ch$value, "")
    expect_identical(valores, opciones)
    expect_true(all(valores %in% eval(formals(graficar_media_rango)$tipo_rango)))
  }
})

test_that("tipo_rango: el entregable sin elección dibuja mínimo a máximo; el proyecto y la tarjeta mandan encima", {
  slot <- function(...) .cm_slot("p_media_rango", var = "e", cruce = "g", ...)
  casa <- .cm_espec(slot(), presets = .cm_presets_router())
  expect_identical(casa$tipo_rango, "minmax")
  expect_equal(casa$inf, c(18, 19)); expect_equal(casa$sup, c(30, 40))
  # Preset del proyecto por encima del suelo de la casa.
  expect_identical(.cm_espec(slot(), presets = .cm_presets_router(list(media_rango = list(tipo_rango = "iqr"))))$tipo_rango, "iqr")
  # La tarjeta por encima del preset del proyecto.
  e <- .cm_espec(slot(tipo_rango = "p10_p90"), presets = .cm_presets_router(list(media_rango = list(tipo_rango = "iqr"))))
  expect_identical(e$tipo_rango, "p10_p90")
  # El valor viejo `min_max` se lee; un valor desconocido es un error de plan.
  expect_identical(p_media_rango("e", tipo_rango = "min_max")$overrides$tipo_rango, "minmax")
  expect_error(p_media_rango("e", tipo_rango = "rango"), "tipo_rango")
})

# ---- 7. límite superior del histograma --------------------------------------------------------------------------------

test_that("limite_superior de la tarjeta junta la cola en la última barra «N+» de la lámina nativa", {
  sin <- .cm_espec(.cm_slot("p_histograma", var = "e"))
  expect_false(any(grepl("\\+$", sin$rotulos)))
  e <- .cm_espec(.cm_slot("p_histograma", var = "e", limite_superior = 22))
  expect_identical(e$rotulos, c("18", "19", "20", "21", "22+"))
  expect_identical(e$conteos, c(1L, 2L, 3L, 1L, 3L))                    # 25, 30 y 40 van en «22+»: nadie se pierde
  expect_identical(p_histograma("e", overrides = list(limite_superior = 30), limite_superior = 22)$overrides$limite_superior, 30)
  expect_error(p_histograma("e", limite_superior = Inf), "limite_superior")
})
