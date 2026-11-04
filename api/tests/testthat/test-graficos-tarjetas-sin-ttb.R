source("setup-load-all.R")

# Tarjetas de una batería sin columna de Top Two Box (`barra_extra = FALSE`, G17; RV v7, láminas 21 y 26: frecuencia de
# redes sociales y de IA generativa). La tarjeta compara el Top Two Box que declara el gráfico, se ancla al final de la
# barra de su premisa y su encabezado nombra el indicador. Datos sintéticos.

.st_niv <- c(t1 = "No la uso", t2 = "Algunas veces al mes", t3 = "Todos los días, en momentos puntuales",
             t4 = "Todos los días, a lo largo del día")
.st_espec <- function() {
  d <- data.frame(item = c("a", "b"), N = 400, t1 = c(.3, .2), t2 = c(.3, .2), t3 = c(.2, .3), t4 = c(.2, .3),
                  rotulo = c("ChatGPT", "Claude"))
  preparar_escala(d, "item", "N", paste0("t", 1:4), .st_niv, var_etiqueta_categoria = "rotulo")
}

test_that("el indicador se nombra con lo común de sus categorías, o con el declarado", {
  expect_identical(.tarjetas_indicador(c("Todos los días, en momentos puntuales", "Todos los días, a lo largo del día")), "Todos los días")
  expect_identical(.tarjetas_indicador(c("De acuerdo", "Totalmente de acuerdo")), "Top Two Box")
  expect_identical(.tarjetas_indicador(c("Siempre", "Casi siempre"), "Con frecuencia"), "Con frecuencia")
  expect_identical(.tarjetas_indicador("Excelente"), "Excelente")
  t <- list(fila = "Claude", indicador = "Todos los días")
  expect_identical(.tarjetas_encabezado(t), "Claude · Todos los días")                 # Word y panel: fila e indicador
  expect_identical(.tarjetas_encabezado(t, con_fila = FALSE), "Todos los días")            # anclada: la premisa ya está en el eje
  expect_null(.tarjetas_encabezado(list(fila = "Claude"), con_fila = FALSE))               # con columna, como siempre
  expect_identical(.tarjetas_encabezado(list(fila = "Claude")), "Claude")
})

test_that("sin columna de Top Two Box la batería compara el que declara el gráfico y su total sale de la base", {
  e <- .st_espec()
  expect_null(e$box)
  vistos <- list()
  local_mocked_bindings(
    .tarjetas_evaluar_cruce = function(fuente, var, cruce, regla, familia, filas = NULL, top2box = NULL, fila_como = NULL) {
      vistos[[length(vistos) + 1L]] <<- top2box
      list(pruebas = data.frame(cruce = cruce, fila = fila_como, grupo = "1", sube = TRUE, fragil = FALSE, dif = 25, p_ajustado = 0.001),
           celdas = data.frame(cruce = cruce, fila = fila_como, grupo = c("1", "2"), p = c(48, 23), n = 200, comparable = TRUE),
           totales = stats::setNames(if (identical(var, "B2")) 36.6 else 40, fila_como),
           grupos = data.frame(cruce = cruce, codigo = c("1", "2"), etiqueta = c("Econ.", "CC. Pol."), n = 200))
    },
    .tarjetas_vars_bateria = function(vars, espec, survey) c("B1", "B2"),
    .sig_diseno_invalido = function(...) NULL
  )
  fuente <- list(data = data.frame(B1 = 1, B2 = 1, area = 1), survey = NULL)
  opt <- .tarjetas_opcion(list(tarjetas_diferencias = TRUE)); opt$top2box <- unname(.st_niv[c("t3", "t4")])
  r <- .tarjetas_calcular(fuente, c("B1", "B2"), opt, e, list(regla = .sig_regla_fabrica(), cruces = "area"), titulo = "Frecuencia")
  expect_identical(unique(vistos)[[1]], unname(.st_niv[c("t3", "t4")]))
  expect_length(r$tarjetas, 2L)
  expect_true(all(vapply(r$tarjetas, function(t) identical(t$indicador, "Todos los días"), TRUE)))
  expect_setequal(vapply(r$tarjetas, `[[`, "", "cifra_total"), c("40%", "37%"))
  # Sin Top Two Box declarado, avisa y no hay tarjetas.
  opt$top2box <- NULL
  expect_null(.tarjetas_calcular(fuente, c("B1", "B2"), opt, e, list(regla = .sig_regla_fabrica(), cruces = "area")))
})

test_that("sin columna de Top Two Box la guía sale del borde derecho de la barra de cada premisa", {
  e <- .st_espec()
  doc <- suppressMessages(.lam_laminas_escala(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                                              e, "Frecuencia de uso", folio = 1))$doc
  f <- .lam_tarjetas_filas_escala(doc)
  expect_false(anyNA(f$x_fin))
  sl <- doc$slide$get_slide(doc$cursor)$get(); ns <- xml2::xml_ns(sl)
  seg <- xml2::xml_find_all(sl, "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]", ns)
  fin <- max(vapply(seg, function(s) {
    (as.numeric(xml2::xml_attr(xml2::xml_find_first(s, ".//a:off", ns), "x")) + as.numeric(xml2::xml_attr(xml2::xml_find_first(s, ".//a:ext", ns), "cx"))) / .EMU
  }, 0))
  expect_equal(max(f$x_fin), fin + 0.07, tolerance = 1e-3)
  expect_true(all(abs(f$y_ancla - f$yc) < 0.3))      # cada ancla a la altura de su premisa
})

test_that("una batería que no cabe junto a sus premisas se ancla compacta y, si no, con las principales y un aviso", {
  avisos <- character(0); compacta <- logical(0)
  local_mocked_bindings(
    .lam_tarjetas_anclar = function(doc, t, L, y0, y1, laminas) {
      compacta <<- c(compacta, .lam_tarjeta_compacta())
      if (.lam_tarjeta_compacta() && length(t$tarjetas) <= 3L) "anclado" else NULL
    },
    .pulso_aviso = function(x) avisos <<- c(avisos, x)
  )
  t <- list(tarjetas = as.list(1:4))
  expect_identical(.lam_tarjetas_anclar_cascada(NULL, t, NULL, 1, 6, 1, titulo = "IA generativa"), "anclado")
  expect_identical(compacta[1], FALSE)                     # primero, la tarjeta de siempre
  expect_match(avisos, "caben 3 de 4", fixed = TRUE)
  expect_false(.lam_tarjeta_compacta())                    # la opción no queda pegada
})

test_that("Word: cada pieza de una batería partida lleva las tarjetas de sus filas", {
  pieza <- function(rotulos) {
    p <- ggplot2::ggplot()
    attr(p, "pulso_espec") <- list(tipo = "escala", filas = data.frame(rotulo = rotulos, stringsAsFactors = FALSE))
    p
  }
  viejo <- .tarjetas_estado$registro; on.exit(.tarjetas_estado$registro <- viejo, add = TRUE)
  .tarjetas_estado$registro <- NULL
  t <- list(tipo = "bateria", filas = c("WhatsApp", "YouTube", "Facebook", "LinkedIn"),
            tarjetas = list(list(fila = "YouTube"), list(fila = "Facebook")))
  .tarjetas_registrar(pieza(t$filas), t)
  a <- .tarjetas_de_figura(pieza(c("WhatsApp", "YouTube")))
  b <- .tarjetas_de_figura(pieza(c("Facebook", "LinkedIn")))
  expect_identical(vapply(a$tarjetas, `[[`, "", "fila"), "YouTube")
  expect_identical(vapply(b$tarjetas, `[[`, "", "fila"), "Facebook")
  expect_null(.tarjetas_de_figura(pieza(c("TikTok", "X"))))
})

test_that("con tarjetas, la columna de premisas se angosta hasta donde ninguna premisa gana una línea", {
  prem <- lapply(c("ChatGPT", "Claude", "Otras herramientas de IA generativa (Copilot, DeepSeek, Perplexity, entre otras)."),
                 function(x) list(texto = x))
  pt <- .std_pt("pregunta")
  lin <- function(w) vapply(prem, function(p) .lam_lineas_tinta(p$texto, w - 0.3, pt, TRUE), 0)
  w <- .lam_escala_columna_con_tarjetas(prem, 2.99)
  expect_lt(w, 2.99)                                   # gana ancho para las barras
  expect_true(all(lin(w) <= lin(2.99)))                # sin líneas de más
  expect_gt(max(lin(w - 0.05) - lin(2.99)), 0)         # y es lo justo
  expect_equal(.lam_escala_columna_con_tarjetas(lapply(c("A", "B"), function(x) list(texto = x)), 2.99), 1.0)
  # Solo con el panel de tarjetas: sin reserva, la columna de una batería no cambia.
  e <- list(premisas_son_grupos = FALSE)
  expect_equal(.lam_escala_columna_premisa(prem, 2.99, e), 2.99)
  expect_lt(withr::with_options(list(prosecnur.lam_reserva_derecha = 2.5), .lam_escala_columna_premisa(prem, 2.99, e)), 2.99)
})
