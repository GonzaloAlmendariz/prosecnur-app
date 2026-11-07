source("setup-load-all.R")

# ADR 0128 §4.4 y §3 (dictamen del revisor metodológico sobre multiapiladas por cruce):
#   - un solo resolutor del indicador para la lámina y la familia: el Top Two Box se prueba SÓLO si está declarado;
#   - sin declaración, una escala no se prueba y el editor recibe un aviso; una lista sin orden sigue con segmentos;
#   - la visibilidad de la columna no cambia qué se prueba sino dónde se informa (lámina o aviso al editor);
#   - una categoría del T2B que no cuadra con el gráfico lleva a abstenerse;
#   - cada p que la lámina marca pertenece a la familia del informe.

.ESCALA <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
             "Totalmente de acuerdo")
.T2B <- c("De acuerdo", "Totalmente de acuerdo")

# Dos grupos (Hombre, Mujer) de `n` estudiantes en `aulas` aulas cada uno; el T2B de Hombre es `p_h` y el de Mujer `p_m`.
.t2b_fuente <- function(p_h = 0.75, p_m = 0.30, n = 240, aulas = 24, opciones = .ESCALA, seed = 128, un_grupo = FALSE) {
  set.seed(seed)
  k <- length(opciones)
  # Códigos iguales a los rótulos (como el fixture de U11): la prueba y el gráfico leen los mismos nombres.
  saca <- function(p_top, n) {
    top <- stats::runif(n) < p_top
    ifelse(top, sample(opciones[k - 1:0], n, TRUE), sample(opciones[seq_len(k - 2L)], n, TRUE))
  }
  sexo <- if (un_grupo) rep("Hombre", 2 * n) else rep(c("Hombre", "Mujer"), each = n)
  aula <- c(paste0("h", rep(seq_len(aulas), length.out = n)), paste0("m", rep(seq_len(aulas), length.out = n)))
  data <- data.frame(id = seq_len(2 * n), p1 = c(saca(p_h, n), saca(p_m, n)), sexo = sexo, aula = aula,
                     stringsAsFactors = FALSE)
  inst <- list(
    survey = data.frame(type = c("integer", "select_one esc", "select_one sx", "text"),
                        name = c("id", "p1", "sexo", "aula"), label = c("id", "La universidad me apoya", "Sexo", "Aula"),
                        list_name = c(NA, "esc", "sx", NA), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("esc", k), "sx", "sx"), name = c(opciones, "Hombre", "Mujer"),
                         label = c(opciones, "Hombre", "Mujer"), stringsAsFactors = FALSE))
  list(data = data, inst = inst)
}

.t2b_slot <- function(barra_extra = NULL, labels = NULL) {
  a <- list(modo = "cruce", var = "p1", cruces = "sexo", mostrar_significancia = TRUE)
  if (!is.null(labels)) a$top2box_labels <- labels
  if (!is.null(barra_extra)) a$overrides <- list(barra_extra = barra_extra)
  do.call(p_barras_multiapiladas, .clean_rebuild_args(a, p_barras_multiapiladas))
}

# Render real de una lámina; devuelve las formas (nombre, texto) y los avisos al editor.
.t2b_render <- function(grafico, f = .t2b_fuente()) {
  out <- tempfile(fileext = ".pptx")
  avisos <- character(0)
  withCallingHandlers(
    suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst,
      plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Apoyo por sexo")),
      path_ppt = out, mensajes_progreso = FALSE)),
    message = function(m) {
      if (grepl(.PULSO_AVISO_SELLO, conditionMessage(m), fixed = TRUE)) avisos <<- c(avisos, conditionMessage(m))
      invokeRestart("muffleMessage")
    })
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  ns <- xml2::xml_ns(x)
  sps <- xml2::xml_find_all(x, "//p:sp", ns)
  formas <- data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(sps, ".//p:cNvPr"), "name"),
                       texto = vapply(sps, function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t", ns)),
                                                             collapse = ""), ""),
                       stringsAsFactors = FALSE)
  list(formas = formas, todo = paste(formas$texto, collapse = " | "), avisos = avisos)
}

.t2b_skip <- function() {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  skip_if_not_installed("xml2")
}
.MARCAS_RX <- "[▲▼△▽]"

test_that("1. sin rótulos declarados, una escala con el preset Top Two Box no se prueba: sin marcas, letras ni clave", {
  .t2b_skip()
  r <- .t2b_render(.t2b_slot(barra_extra = "top2box"))
  expect_false(grepl(.MARCAS_RX, r$todo), info = r$todo)
  expect_false(grepl("(A) Hombre", r$todo, fixed = TRUE))
  expect_false(any(r$formas$nombre == "Nota significancia"))
  expect_true(any(grepl("sin Top Two Box declarado", r$avisos)), info = paste(r$avisos, collapse = "\n"))
  expect_false(any(grepl("[;·—]", r$avisos[grepl("Top Two Box declarado", r$avisos)])))
})

test_that("2. rótulos declarados con la barra extra apagada: se prueba sólo el T2B, la lámina no lo marca y el aviso dice el par", {
  .t2b_skip()
  r <- .t2b_render(.t2b_slot(barra_extra = FALSE, labels = .T2B))
  expect_false(grepl(.MARCAS_RX, r$todo), info = r$todo)
  expect_false(grepl("(A) Hombre", r$todo, fixed = TRUE))
  expect_false(any(r$formas$nombre == "Nota significancia"))
  av <- r$avisos[grepl("no muestra su columna", r$avisos)]
  expect_length(av, 1L)
  expect_match(av, "se prueban en el Top Two Box", fixed = TRUE)
  expect_match(av, "Hombre supera a Mujer", fixed = TRUE)
  expect_match(av, "Enciende la columna para verla.", fixed = TRUE)
  expect_false(grepl("[;·—]", av))
  # Nada de segmentos: el aviso no nombra categorías de la escala.
  expect_false(grepl("Totalmente|desacuerdo", av))
})

test_that("2b. el aviso del T2B oculto dice si el hallazgo es frágil", {
  ev <- list(pares = data.frame(a = "H", b = "M", veredicto = "fragil", stringsAsFactors = FALSE),
             etiquetas_grupos = c(H = "Hombre", M = "Mujer"), regla = list(fragiles = "mostrar"))
  txt <- suppressMessages(.sig_aviso_t2b_oculto(ev))
  expect_match(txt, "Hombre supera a Mujer (frágil)", fixed = TRUE)
  ev$pares$veredicto <- "no_significativa"
  expect_null(suppressMessages(.sig_aviso_t2b_oculto(ev)))
})

test_that("3. rótulos declarados y columna visible: la marca va en la cifra del T2B (no regresión)", {
  .t2b_skip()
  r <- .t2b_render(.t2b_slot(barra_extra = "top2box", labels = .T2B))
  expect_true(grepl(.MARCAS_RX, r$todo), info = r$todo)
  expect_match(r$todo, "(A) Hombre", fixed = TRUE)
  expect_true(any(r$formas$nombre == "Nota significancia"))
  expect_false(any(grepl("no muestra su columna|sin Top Two Box declarado", r$avisos)))
  # La marca está pegada a la cifra de la columna (un porcentaje seguido de ▲B), no a un segmento.
  expect_true(any(grepl("[0-9]+%\\s*[▲△]B", r$formas$texto)), info = r$todo)
})

# --- Fuente sintética para probar la regla sin pasar por el render -------------------------------------------------

.t2b_bloque <- function(f, opciones = .ESCALA) {
  ind <- .sig_indicadores(f$data, "p1", survey = f$inst$survey)
  g <- f$data$sexo
  niveles <- c("Hombre", "Mujer")
  n <- vapply(niveles, function(gr) colSums(ind$Y[g == gr, opciones, drop = FALSE], na.rm = TRUE),
              numeric(length(opciones)))
  df <- data.frame(categoria = c("Hombre", "Mujer"), N = colSums(n), stringsAsFactors = FALSE)
  for (i in seq_along(opciones)) df[[paste0("n_", i)]] <- n[i, ]
  df
}
.t2b_fuente_sig <- function(f, top2box = .T2B, visible = TRUE) {
  structure(list(diseno = "independiente", var = "p1", survey = f$inst$survey, orders_list = NULL, data = f$data,
                 g = f$data$sexo, niveles = c("Hombre", "Mujer"), rotulos_niveles = c("Hombre", "Mujer"), ancho_rotulo = NA,
                 top2box = top2box, top2box_visible = visible, resolver_indicador = TRUE), class = "sig_fuente")
}
.t2b_aplicar <- function(fuente, df, opciones = .ESCALA) {
  cols_n <- paste0("n_", seq_along(opciones))
  withr::with_options(list(prosecnur.sig_informe = NULL),
    suppressMessages(.sig_aplicar_regla_transpuesto(fuente, df, cols_n, paste0("pct_", seq_along(opciones)), opciones,
                                                    top2box = fuente$top2box)))
}

test_that("4. una categoría del T2B que no cuadra con el gráfico lleva a abstenerse", {
  f <- .t2b_fuente()
  df <- .t2b_bloque(f)
  ok <- .t2b_aplicar(.t2b_fuente_sig(f), df)
  expect_gt(nrow(ok$sufijos), 0L)
  expect_true(all(ok$sufijos$.col_pct == "top2box"))
  df$n_5[1] <- df$n_5[1] + 7   # «Totalmente de acuerdo» de Hombre ya no es la suma de la prueba
  mal <- .t2b_aplicar(.t2b_fuente_sig(f), df)
  expect_null(mal$sufijos)
  expect_true(is.null(mal$nota) || !nzchar(mal$nota) || !grepl(.MARCAS_RX, mal$nota))
  # Un T2B con una categoría que la escala no tiene tampoco se prueba.
  otra <- .t2b_aplicar(.t2b_fuente_sig(f, top2box = c("De acuerdo", "Muy de acuerdo")), .t2b_bloque(f))
  expect_null(otra$sufijos)
})

test_that("5. paridad: lo que la lámina marca está en la familia, y un p ajeno a la familia no se marca", {
  f <- .t2b_fuente()
  plan <- list(slides = list(list(id = "s1", payload = list(grafico = list(graficador = "p_barras_multiapiladas",
    args = list(modo = "cruce", var = "p1", cruces = "sexo", top2box_labels = .T2B,
                overrides = list(barra_extra = FALSE)))))))
  ctx <- .sig_contexto_estudio(f$data, f$inst, graficos_config = list(plan = plan), analitica_config = list())
  expect_identical(ctx$regla$correccion, "bh_informe")
  clave <- paste("p1", "sexo", paste(.T2B, collapse = "+"), sep = "\r")
  ev_fam <- ctx$familia_completa$evaluaciones[[clave]]
  expect_identical(unique(ev_fam$pares$fila), paste(.T2B, collapse = " + "))   # la familia prueba el T2B, no segmentos
  expect_gt(ctx$m, 0L)
  # El render, bajo la familia del informe, marca y cada p marcado está en la familia.
  withr::with_options(list(prosecnur.sig_informe = list(regla = ctx$regla, familia = ctx$familia)), {
    df <- .t2b_bloque(f)
    res <- suppressMessages(.sig_aplicar_regla_transpuesto(.t2b_fuente_sig(f), df, paste0("n_", 1:5),
                                                           paste0("pct_", 1:5), .ESCALA, top2box = .T2B))
  })
  expect_gt(nrow(res$sufijos), 0L)
  marcados <- res$ev$pares$p[res$ev$pares$veredicto %in% c("marcada", "fragil")]
  expect_true(all(.sig_bh_en_familia(marcados, ctx$familia)))
  # La misma evaluación contra una familia que no contiene su p: ningún par se marca.
  ajena <- .sig_bh_tabla(c(1e-6, 0.2, 0.5))
  ev <- .sig_veredictos(res$ev, ctx$regla, ajena, exigir_familia = TRUE)
  expect_null(ev$marcas)
  expect_true(all(ev$pares$veredicto[ev$pares$elegible] == "fuera_de_familia"))
  expect_equal(ev$fuera_de_familia, sum(ev$pares$elegible))
  # Sin exigirlo (tablas y tarjetas), el comportamiento de siempre.
  expect_false(any(.sig_veredictos(res$ev, ctx$regla, ajena)$pares$veredicto == "fuera_de_familia"))
})

test_that("5b. paridad: sin T2B declarado la familia no guarda segmentos de la lámina y el inspector se abstiene", {
  f <- .t2b_fuente()
  plan <- list(slides = list(list(id = "s1", payload = list(titulo = "Apoyo", grafico = list(
    graficador = "p_barras_multiapiladas",
    args = list(modo = "cruce", var = "p1", cruces = "sexo", overrides = list(barra_extra = "top2box")))))))
  ctx <- .sig_contexto_estudio(f$data, f$inst, graficos_config = list(plan = plan), analitica_config = list())
  expect_identical(ctx$m, 0L)
  lam <- .sig_lamina_json(plan$slides[[1]], .sig_fuente(f$data, f$inst), ctx)
  expect_identical(lam$estado, "abstencion")
  expect_match(lam$motivo, "sin Top Two Box declarado")
  # Si Analítica compara la misma pregunta por el mismo cruce, sus segmentos sí entran a la familia.
  ac <- list(cruces_vars = list(list(name = "sexo")), secciones = list(list(variables = list("p1"))))
  f$inst$orders_list <- list(p1 = list(labels = .ESCALA))
  combos <- .sig_combinaciones_estudio(.sig_fuente(f$data, f$inst), plan, ac)
  expect_length(combos, 1L)
  expect_false(combos[[1]]$lamina_escala)
})

test_that("6. límites: escala corta, grupos chicos, pocas aulas, lista sin orden y cruce de un nivel", {
  r <- list(prueba = "rao_scott", correccion = "bh_informe", conglomerado = "aula")
  # Resolutor: escala de dos sustantivas y lista sin orden siguen con segmentos; escala de cinco sin T2B no se prueba.
  expect_identical(.sig_indicador_lamina(NULL, c("Sí", "No"), regla = r)$tipo, "segmentos")
  expect_identical(.sig_indicador_lamina(NULL, c("De acuerdo", "En desacuerdo", "No sé"), regla = r)$tipo, "segmentos")
  expect_identical(.sig_indicador_lamina(NULL, c("Rojo", "Verde", "Azul"), regla = r)$tipo, "segmentos")
  expect_identical(.sig_indicador_lamina(NULL, .ESCALA, regla = r)$tipo, "escala_sin_declarar")
  expect_identical(.sig_indicador_lamina(.T2B, .ESCALA, regla = r)$tipo, "top2box")

  # Lista sin orden: la lámina prueba sus segmentos (el resolutor no la toca).
  colores <- c("Rojo", "Verde", "Azul", "Amarillo", "Blanco")
  fc <- .t2b_fuente(opciones = colores)
  sin_orden <- .t2b_aplicar(.t2b_fuente_sig(fc, top2box = character(0)), .t2b_bloque(fc, colores), colores)
  expect_false(isTRUE(sin_orden$ev$sin_declarar))
  expect_gt(nrow(sin_orden$sufijos), 0L)
  expect_true(all(sin_orden$sufijos$.col_pct %in% paste0("pct_", 1:5)))

  # Grupo de menos de 30: no comparable, sin marcas.
  chico <- .t2b_fuente(n = 25, aulas = 12)
  rc <- .t2b_aplicar(.t2b_fuente_sig(chico), .t2b_bloque(chico))
  expect_null(rc$sufijos)
  expect_false(any(rc$ev$pares$veredicto %in% c("marcada", "fragil")))

  # Menos de 8 aulas por grupo: no comparable, sin marcas.
  pocas <- .t2b_fuente(aulas = 5)
  rp <- .t2b_aplicar(.t2b_fuente_sig(pocas), .t2b_bloque(pocas))
  expect_null(rp$sufijos)

  # Cruce de un solo nivel: no hay contraste, no hay marcas.
  uno <- .t2b_fuente(un_grupo = TRUE)
  ev1 <- .sig_evaluar_pregunta(.sig_fuente(uno$data, uno$inst), "p1", "sexo", .sig_regla_propuesta(uno$data),
                               top2box = .T2B, lamina_escala = TRUE)
  expect_null(ev1)
})

test_that("visibilidad: la columna cuenta sólo si se dibuja con las categorías declaradas", {
  et <- stats::setNames(.ESCALA, paste0("pct_", 1:5))
  cols <- names(et)
  base <- list(mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", top2box_labels = .T2B)
  expect_true(.sig_top2box_visible(base, .T2B, et, cols))
  expect_false(.sig_top2box_visible(modifyList(base, list(mostrar_barra_extra = FALSE)), .T2B, et, cols))
  expect_false(.sig_top2box_visible(modifyList(base, list(barra_extra_preset = "ninguno")), .T2B, et, cols))
  expect_false(.sig_top2box_visible(modifyList(base, list(top2box_labels = c("Ni de acuerdo ni en desacuerdo",
                                                                               "De acuerdo"))), .T2B, et, cols))
  expect_identical(.sig_top2box_declarado(list(top2box_labels = list("A", "B"))), c("A", "B"))
  expect_identical(.sig_top2box_declarado(list(overrides = list(top2box_labels = "A"))), "A")
  expect_identical(.sig_top2box_declarado(list()), character(0))
})
