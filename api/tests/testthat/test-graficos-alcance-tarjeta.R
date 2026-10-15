# O7c (docs/qa/checklist-revamp-informe-graficos-2026-10-14.md): la tarjeta del gráfico en Láminas escribe cada ajuste
# con su alcance. «Sólo este gráfico» lo pone en el slot (`payload[slot].args` → `.clean_rebuild_args()` →
# constructor `p_*`); «Aplicar a todos los gráficos del tipo» lo pone ADEMÁS en `presets[tipo]`. Para que las dos cosas
# signifiquen algo hacen falta dos garantías, en la lámina nativa y en el Word (mismo pipeline):
#
#   (a) el valor del slot llega al graficador (no se cae por no ser formal, ni lo borra el saneo de «Cálculos»);
#   (b) el preset del tipo es un defecto real DEBAJO del gráfico: llega cuando el slot no opina y pierde cuando opina.
#
# Cada caso va por el camino real: slot JSON → `.rebuild_graf()` → `reporte_ppt_plan(solo_lista = TRUE)`, y se mira la
# lista de args con la que se llama al graficador (lo que devuelve `.keep_formals()`). Datos sintéticos, sin red.

# ---- fixtures ---------------------------------------------------------------------------------------------------------

.o7_cods <- c("1", "2", "3", "4", "99")
.o7_labs <- c("Muy bien", "Bien", "Regular", "Mal", "No responde")
.o7_medios <- c("Radio", "TV", "Diario", "Web", "Amigos", "Otros medios")

.o7_inst <- function() {
  list(
    survey = data.frame(name = c("q", "e", "m", "g"),
                        type = c("select_one l_q", "integer", "select_one l_m", "select_one l_g"),
                        label = c("Pregunta Q", "Edad", "Medio", "Grupo"), stringsAsFactors = FALSE),
    choices = rbind(
      data.frame(list_name = "l_q", name = .o7_cods, label = .o7_labs, stringsAsFactors = FALSE),
      data.frame(list_name = "l_m", name = as.character(1:6), label = .o7_medios, stringsAsFactors = FALSE),
      data.frame(list_name = "l_g", name = c("A", "B"), label = c("A", "B"), stringsAsFactors = FALSE)
    ),
    orders_list = list(
      q = list(names = .o7_cods, labels = .o7_labs, label = "Pregunta Q"),
      m = list(names = as.character(1:6), labels = .o7_medios, label = "Medio"),
      g = list(names = c("A", "B"), labels = c("A", "B"), label = "Grupo")
    )
  )
}

.o7_data <- function() {
  data.frame(q = rep(c("1", "2", "4"), c(5, 3, 2)),
             e = c(18, 19, 19, 20, 20, 20, 21, 25, 30, 40),
             m = as.character(rep(1:6, c(3, 2, 2, 1, 1, 1))),
             g = rep(c("A", "B"), 5), stringsAsFactors = FALSE)
}

# Dos olas de una misma pregunta (dumbbell y serie temporal).
.o7_ola <- function(valores) {
  out <- data.frame(p1 = valores, peso = 1, stringsAsFactors = FALSE)
  attr(out, "var_peso") <- "peso"
  out
}
.o7_inst_ola <- function() {
  list(survey = data.frame(name = c("p1", "peso"), type = c("select_one lik", "decimal"), list_name = c("lik", ""),
                           label = c("Pregunta", "Peso"), stringsAsFactors = FALSE),
       choices = data.frame(list_name = "lik", name = c("1", "2", "3"), label = c("Negativa", "Neutral", "Positiva"),
                            stringsAsFactors = FALSE),
       orders_list = NULL)
}
.o7_olas_data <- function() list(ola1 = .o7_ola(c("3", "3", "3", "1")), ola2 = .o7_ola(c("3", "1", "1", "1")))
.o7_olas_inst <- function() list(ola1 = .o7_inst_ola(), ola2 = .o7_inst_ola())

.o7_slot <- function(graficador, ...) .rebuild_graf(list(graficador = graficador, args = list(...)))

# Presets como los arma el router para el entregable: suelo de la casa + lo del proyecto.
.o7_presets <- function(proyecto = list()) .build_presets(.enriquecer_presets(proyecto, NULL))

# Args con los que el motor llama a `graficador` al renderizar `el` (los de la última llamada).
.o7_args <- function(el, graficador, presets = .o7_presets(), data = .o7_data(), instrumento = .o7_inst()) {
  ns <- asNamespace("prosecnurapp")
  objetivo <- get(graficador, envir = ns)
  real <- get(".keep_formals", envir = ns)
  cap <- NULL
  testthat::local_mocked_bindings(
    .keep_formals = function(fun, args, contexto = NULL) {
      out <- real(fun, args, contexto)
      if (identical(fun, objetivo)) cap <<- out
      out
    },
    .package = "prosecnurapp"
  )
  suppressWarnings(suppressMessages(reporte_ppt_plan(
    data = data, instrumento = instrumento, plan = list(a = p_slide_1_grafico(grafico = el)),
    presets = presets, solo_lista = TRUE, mensajes_progreso = FALSE
  )))
  if (is.null(cap)) stop("El motor no llamó a ", graficador, "().", call. = FALSE)
  cap
}

# Recorre (a), (b) y (c) para un arg: `slot` es el valor de la tarjeta, `preset` el del tipo (distintos entre sí).
.o7_tres_garantias <- function(graficador_p, graficador, tipo, arg, slot, preset, ..., data = .o7_data(),
                               instrumento = .o7_inst()) {
  base_slot <- list(...)
  con_slot <- do.call(.o7_slot, c(list(graficador_p), base_slot, stats::setNames(list(slot), arg)))
  sin_slot <- do.call(.o7_slot, c(list(graficador_p), base_slot))
  pr <- .o7_presets(stats::setNames(list(stats::setNames(list(preset), arg)), tipo))
  a <- .o7_args(con_slot, graficador, data = data, instrumento = instrumento)
  expect_equal(a[[arg]], slot, label = sprintf("(a) %s: el slot llega a %s()", arg, graficador))
  b <- .o7_args(sin_slot, graficador, presets = pr, data = data, instrumento = instrumento)
  expect_equal(b[[arg]], preset, label = sprintf("(b) %s: el preset del tipo llega sin slot", arg))
  c <- .o7_args(con_slot, graficador, presets = pr, data = data, instrumento = instrumento)
  expect_equal(c[[arg]], slot, label = sprintf("(c) %s: el slot manda sobre el preset", arg))
}

# ---- 1. args que el constructor no declaraba ---------------------------------------------------------------------------

test_that("agrupadas: invertir_barras, otros_al_final y normalizar_etiquetas de la tarjeta llegan y mandan sobre el preset", {
  .o7_tres_garantias("p_barras_agrupadas", "graficar_barras_agrupadas", "barras_agrupadas",
                     "invertir_barras", FALSE, TRUE, var = "m")
  .o7_tres_garantias("p_barras_agrupadas", "graficar_barras_agrupadas", "barras_agrupadas",
                     "otros_al_final", FALSE, TRUE, var = "m")
  .o7_tres_garantias("p_barras_agrupadas", "graficar_barras_agrupadas", "barras_agrupadas",
                     "normalizar_etiquetas", "mayuscula_inicial", "ninguna", var = "m")
  expect_error(p_barras_agrupadas("m", normalizar_etiquetas = "rara"), "normalizar_etiquetas")
})

test_that("agrupadas: invertir_barras = FALSE de la tarjeta da la vuelta a la lámina nativa", {
  withr::local_options(prosecnur.casos_junto = list(cuando = "nunca"))
  espec <- function(el) {
    res <- suppressWarnings(suppressMessages(reporte_ppt_plan(
      data = .o7_data(), instrumento = .o7_inst(), plan = list(a = p_slide_1_grafico(grafico = el)),
      presets = .o7_presets(), solo_lista = TRUE, mensajes_progreso = FALSE
    )))
    attr(res$rendered[[1]], "pulso_espec")$rotulos
  }
  casa <- espec(.o7_slot("p_barras_agrupadas", var = "m"))
  vuelta <- espec(.o7_slot("p_barras_agrupadas", var = "m", invertir_barras = FALSE))
  expect_setequal(vuelta, casa)
  expect_false(identical(vuelta, casa))
})

test_that("apiladas y multiapiladas: invertir_barras de la tarjeta llega y manda; en multilista lo heredan los bloques", {
  .o7_tres_garantias("p_barras_apiladas", "graficar_barras_apiladas", "barras_apiladas",
                     "invertir_barras", TRUE, FALSE, var = "q")
  .o7_tres_garantias("p_barras_multiapiladas", "graficar_barras_apiladas", "multi_apiladas",
                     "invertir_barras", TRUE, FALSE, modo = "var", vars = list("q"))
  el <- p_barras_multiapiladas(modo = "multilista", invertir_barras = TRUE,
                               bloques = list(list(modo = "var", vars = "q"),
                                              list(modo = "var", vars = "q", overrides = list(invertir_barras = FALSE))))
  expect_true(isTRUE(el$bloques[[1]]$overrides$invertir_barras))
  expect_false(isTRUE(el$bloques[[2]]$overrides$invertir_barras))
})

test_that("indicador numérico: decimales, mostrar_leyenda e invertir_barras de la tarjeta llegan y mandan", {
  .o7_tres_garantias("p_numerico", "graficar_barras_numericas", "barras_numericas",
                     "decimales", 2, 3, var = "e", cruce = "g")
  .o7_tres_garantias("p_numerico", "graficar_barras_numericas", "barras_numericas",
                     "mostrar_leyenda", FALSE, TRUE, var = "e", cruce = "g")
  .o7_tres_garantias("p_numerico", "graficar_barras_numericas", "barras_numericas",
                     "invertir_barras", TRUE, FALSE, var = "e", cruce = "g")
  # Con la métrica «N» el conteo sale sin decimales por defecto editorial, pero ya no pisa al preset del tipo.
  n_sin <- .o7_args(.o7_slot("p_numerico", var = "e", metrica = "N"), "graficar_barras_numericas")
  expect_equal(n_sin$decimales, 0)
  n_preset <- .o7_args(.o7_slot("p_numerico", var = "e", metrica = "N"), "graficar_barras_numericas",
                       presets = .o7_presets(list(barras_numericas = list(decimales = 1))))
  expect_equal(n_preset$decimales, 1)
})

test_that("histograma: decimales de la tarjeta llega (ya no se cae por `...`) y manda sobre el preset", {
  expect_true("decimales" %in% names(formals(p_histograma)))
  .o7_tres_garantias("p_histograma", "graficar_histograma", "histograma", "decimales", 1, 2, var = "e")
})

test_that("serie temporal: mostrar_leyenda y los ajustes con defecto llegan, y el preset ya no queda tapado", {
  datos <- .o7_olas_data()
  inst <- .o7_olas_inst()
  vars <- list(Tema = c("ola1$p1", "ola2$p1"))
  for (caso in list(list("mostrar_leyenda", FALSE, TRUE), list("mostrar_valores", FALSE, TRUE),
                    list("destacar_ultimo", FALSE, TRUE), list("mostrar_puntos", FALSE, TRUE),
                    list("mostrar_grid_y", FALSE, TRUE), list("max_series_con_cifras", 2L, 7L))) {
    .o7_tres_garantias("p_serie_temporal", "graficar_serie_temporal", "serie_temporal", caso[[1]], caso[[2]],
                       caso[[3]], vars = vars, corte = "3", data = datos, instrumento = inst)
  }
})

test_that("radar sm: limites y decimales de la tarjeta llegan al graficador y mandan sobre el preset", {
  .o7_tres_garantias("p_radar", "graficar_radar", "radar_tabla", "limites", c(0.2, 0.8), c(0.1, 0.9),
                     modo = "sm", var = "m", cruce = "g")
  # El bug: «Decimales» del radar escribía `valores_decimales` y el saneo de «Cálculos» lo borraba (el radar no es
  # familia de esa pestaña). Ahora llega.
  .o7_tres_garantias("p_radar", "graficar_radar", "radar_tabla", "valores_decimales", 2, 1,
                     modo = "sm", var = "m", cruce = "g")
  expect_error(p_radar(modo = "sm", var = "m", limites = c(1, 0)), "limites")
})

# ---- 2. defectos del constructor que tapaban el preset ----------------------------------------------------------------

test_that("dumbbell: orden, mostrar_brecha y umbral_brecha_pct ya no tapan el preset del tipo", {
  datos <- .o7_olas_data()
  inst <- .o7_olas_inst()
  vars <- list(Tema = c("ola1$p1", "ola2$p1"))
  .o7_tres_garantias("p_dumbbell", "graficar_dumbbell", "dumbbell", "orden", "declarado", "valor",
                     vars = vars, corte = "3", data = datos, instrumento = inst)
  .o7_tres_garantias("p_dumbbell", "graficar_dumbbell", "dumbbell", "mostrar_brecha", FALSE, TRUE,
                     vars = vars, corte = "3", data = datos, instrumento = inst)
  .o7_tres_garantias("p_dumbbell", "graficar_dumbbell", "dumbbell", "umbral_brecha_pct", 5, 10,
                     vars = vars, corte = "3", data = datos, instrumento = inst)
  expect_error(p_dumbbell(vars = vars, corte = "3", orden = "otro"), "orden")
  # También en la brecha entre grupos de una base.
  g <- p_dumbbell(vars = list("b$p1"), corte = "3", cruce = "b$g", grupos = c("1", "2"))
  expect_null(g$overrides$orden)
  expect_null(g$overrides$mostrar_brecha)
  expect_identical(p_dumbbell(vars = list("b$p1"), corte = "3", cruce = "b$g", grupos = c("1", "2"),
                              mostrar_brecha = FALSE)$overrides$mostrar_brecha, FALSE)
})

test_that("lollipop: orden ya no tapa el preset del tipo", {
  .o7_tres_garantias("p_lollipop", "graficar_lollipop", "lollipop", "orden", "menor_mayor", "declarado", var = "m")
  expect_error(p_lollipop("m", orden = "otro"), "orden")
})

test_that("sin nada declarado, los defectos son los de antes: los del graficador coinciden con los viejos del constructor", {
  # Lo que el constructor escribía siempre y ahora deja al graficador.
  st <- formals(graficar_serie_temporal)
  expect_identical(list(st$mostrar_valores, st$destacar_ultimo, st$mostrar_puntos, st$mostrar_grid_y,
                        st$max_series_con_cifras, st$valores_decimales), list(TRUE, TRUE, TRUE, TRUE, 5L, 0L))
  db <- formals(graficar_dumbbell)
  expect_identical(eval(db$orden)[1], "brecha")
  expect_true(isTRUE(db$mostrar_brecha))
  expect_equal(db$umbral_brecha_pct, 0)
  expect_identical(eval(formals(graficar_lollipop)$orden)[1], "mayor_menor")
  # Y el preset de la casa no trae ninguno de ellos: sin nada declarado no hay quien los cambie.
  pr <- .o7_presets()
  for (tipo in c("serie_temporal", "dumbbell", "lollipop")) {
    expect_length(intersect(names(pr[[tipo]]$args %||% list()),
                            c("mostrar_valores", "destacar_ultimo", "mostrar_puntos", "mostrar_grid_y",
                              "max_series_con_cifras", "orden", "mostrar_brecha", "umbral_brecha_pct")), 0L)
  }
  # El elemento ya no los escribe.
  el <- p_serie_temporal(vars = list(T = c("a$p1", "b$p1")), corte = "3")
  expect_length(intersect(names(el$overrides), c("mostrar_valores", "destacar_ultimo", "mostrar_puntos",
                                                 "mostrar_grid_y", "max_series_con_cifras", "valores_decimales")), 0L)
  # Agrupadas sin tarjeta: invertir y «Otros al final» siguen siendo los de la casa.
  a <- .o7_args(.o7_slot("p_barras_agrupadas", var = "m"), "graficar_barras_agrupadas")
  expect_true(isTRUE(a$invertir_barras))
  expect_true(isTRUE(a$otros_al_final))
  # Multiapiladas sin Top Two Box: la columna la decide el preset, como antes.
  m <- .o7_args(.o7_slot("p_barras_multiapiladas", modo = "var", vars = list("q")), "graficar_barras_apiladas")
  expect_identical(m$barra_extra_preset, "top2box")
})

# ---- 3. decimales que gobierna «Cálculos» y los que no --------------------------------------------------------------

test_that("el saneo de «Cálculos» deja los decimales de los tipos que esa pestaña no gobierna", {
  for (tipo in .CALCULOS_TIPOS_SIN_GOBIERNO) {
    # Ninguno es familia de la pestaña: si lo fuera, eximirlo rompería el gobierno general.
    expect_false(.calculos_preset_de_etype(tipo) %in% names(.PRESETS_CALCULOS), label = tipo)
    el <- structure(list(.element_type = tipo, overrides = list(decimales = 2, valores_decimales = 1,
                                                                 calculos_propios = TRUE)),
                    class = c("ppt_element", "list"))
    s <- .calculos_sanear_elemento(el)
    expect_equal(s$overrides$decimales, 2, label = tipo)
    expect_equal(s$overrides$valores_decimales, 1, label = tipo)
    expect_null(s$overrides$calculos_propios)   # la marca nunca llega al graficador
  }
  # Las familias de porcentajes siguen gobernadas: sin la marca, sus decimales no sobreviven.
  for (el in list(p_barras_apiladas("q", overrides = list(decimales = 2)),
                  p_serie_temporal(vars = list(T = c("a$p1", "b$p1")), corte = "3", valores_decimales = 2))) {
    s <- .calculos_sanear_elemento(el)
    expect_null(s$overrides$decimales)
    expect_null(s$overrides$valores_decimales)
  }
  # …y con la marca sí (la serie la pide en sus overrides: la tarjeta de «Redondeo propio»).
  st <- p_serie_temporal(vars = list(T = c("a$p1", "b$p1")), corte = "3", valores_decimales = 2,
                         overrides = list(calculos_propios = TRUE))
  expect_identical(.calculos_sanear_elemento(st)$overrides$valores_decimales, 2L)
})

# ---- 4. radar entre públicos: el preset va debajo del gráfico ---------------------------------------------------------

.o7_rmb_fuente <- function(valores) {
  list(data = data.frame(id = seq_along(valores), p1 = valores, stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one lst"), name = c("id", "p1"),
                                       label = c("id", "X"), stringsAsFactors = FALSE),
                   choices = data.frame(list_name = "lst", name = as.character(1:4),
                                        label = c("Muy mal", "Mal", "Bien", "Muy bien"), stringsAsFactors = FALSE)))
}

.o7_radar_publicos <- function(el, preset_args = list()) {
  d <- .o7_rmb_fuente(c("3", "4", "3", "1", "4", "4", "2", "3"))
  e <- .o7_rmb_fuente(c("3", "1", "1", "4", "2", "2", "3", "1"))
  data_sources <- list(docentes = d$data, estudiantes = e$data)
  instrument_sources <- list(docentes = d$inst, estudiantes = e$inst)
  cap <- NULL
  testthat::with_mocked_bindings(
    graficar_radar = function(...) { cap <<- list(...); NULL },
    .render_radar_publicos(el, preset_args),
    .package = "prosecnurapp"
  )
  cap
}

test_that("radar entre públicos: el elemento manda sobre el preset y el preset sobre el defecto", {
  ejes <- list(A = list("docentes$p1", "estudiantes$p1"), B = list("docentes$p1", "estudiantes$p1"),
               C = list("docentes$p1", "estudiantes$p1"))
  pub <- function(...) p_radar(modo = "publicos", vars = ejes, corte = "3,4", mostrar_tabla = FALSE, ...)

  # Nada declarado: los defectos de siempre (sin cifras, enteros, sin piso).
  a <- .o7_radar_publicos(pub())
  expect_false(a$mostrar_valores)
  expect_equal(a$valores_decimales, 0L)
  expect_null(a$limites)

  preset <- list(valores_decimales = 2, mostrar_valores = TRUE, limites = c(0.3, 1))
  # (b) Sin nada en el gráfico, el preset llega.
  b <- .o7_radar_publicos(pub(), preset)
  expect_true(b$mostrar_valores)
  expect_equal(b$valores_decimales, 2L)
  expect_equal(b$limites, c(0.3, 1))
  # (c) Lo del gráfico gana. Antes el preset pisaba decimales, cifras y piso.
  c <- .o7_radar_publicos(pub(valores_decimales = 1, mostrar_valores = FALSE, eje_min = 20), preset)
  expect_false(c$mostrar_valores)
  expect_equal(c$valores_decimales, 1L)
  expect_equal(c$limites, c(0.2, 1))
  # `limites` de la tarjeta viaja en overrides y es lo último que se aplica.
  l <- .o7_radar_publicos(pub(limites = c(0.4, 1)), preset)
  expect_equal(l$limites, c(0.4, 1))
  # La tabla redondea con los mismos decimales que el vértice.
  expect_equal(.radar_mb_resolver(pub(), preset)$decimales, 2L)
  expect_equal(.radar_mb_resolver(pub(valores_decimales = 1), preset)$decimales, 1L)
})

# ---- 5. Top Two Box de multiapiladas -------------------------------------------------------------------------------

test_that("multiapiladas: la columna Top Two Box que declara el gráfico manda sobre el preset del tipo", {
  pr <- .o7_presets(list(multi_apiladas = list(mostrar_barra_extra = FALSE, top2box_labels = c("Mal"),
                                               barra_extra_preset = "ninguno")))
  con <- .o7_args(.o7_slot("p_barras_multiapiladas", modo = "var", vars = list("q"), top2box = TRUE,
                           top2box_labels = c("Muy bien", "Bien")), "graficar_barras_apiladas", presets = pr)
  expect_true(isTRUE(con$mostrar_barra_extra))
  expect_identical(con$barra_extra_preset, "top2box")
  expect_identical(con$top2box_labels, c("Muy bien", "Bien"))
  # Sin declararla, decide el preset del tipo.
  sin <- .o7_args(.o7_slot("p_barras_multiapiladas", modo = "var", vars = list("q")), "graficar_barras_apiladas",
                  presets = pr)
  expect_false(isTRUE(sin$mostrar_barra_extra))
  expect_identical(sin$top2box_labels, "Mal")
  # Y un override explícito del gráfico sigue siendo lo último.
  ov <- .o7_args(.o7_slot("p_barras_multiapiladas", modo = "var", vars = list("q"), top2box = TRUE,
                          overrides = list(mostrar_barra_extra = FALSE)), "graficar_barras_apiladas", presets = pr)
  expect_false(isTRUE(ov$mostrar_barra_extra))
  expect_identical(.top2box_del_grafico(list(top2box = FALSE)), list())
})

test_that("multiapiladas: el preset ya no decide los casos junto al porcentaje (como el resto de tipos)", {
  pr <- .o7_presets(list(multi_apiladas = list(mostrar_n_en_etiquetas = TRUE)))
  a <- .o7_args(.o7_slot("p_barras_multiapiladas", modo = "var", vars = list("q")), "graficar_barras_apiladas",
                presets = pr)
  expect_false(isTRUE(a$mostrar_n_en_etiquetas))
})

# ---- 6. ancho de los temas -----------------------------------------------------------------------------------------

test_that("ancho_tema: sin opinión de la lámina rige el del preset de multiapiladas", {
  presets <- list(multi_apiladas = list(args = list(ancho_tema = "ancho")),
                  multi_apiladas_multiactor = list(args = list(canvas_w_grupo = 0.13)))
  expect_identical(.multiactor_preset_de(presets, list())$canvas_w_grupo, 0.28)
  # La lámina manda sobre el preset.
  expect_identical(.multiactor_preset_de(presets, list(overrides = list(ancho_tema = "angosto")))$canvas_w_grupo, 0.14)
  expect_identical(.multiactor_preset_de(presets, list(overrides = list(ancho_tema = "auto")))$canvas_w_grupo, 0.13)
  # Con el ancho del preset, el ancho propio de la lámina (matriz: 0.22) no vuelve a pisar el reparto al final.
  expect_null(.multiactor_overrides_de(list(canvas_w_grupo = 0.22), presets)$canvas_w_grupo)
  expect_identical(.multiactor_overrides_de(list(canvas_w_grupo = 0.22))$canvas_w_grupo, 0.22)
})
