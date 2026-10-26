# Nota al pie del redondeo con tres modos y texto propio (R3 del revamp de
# Gráficos, checklist-revamp-informe-graficos-2026-10-14).
#
# Modos: «nunca», «si_no_cierra» (sólo si alguna barra rotulada no suma 100 %)
# y «siempre». El plan no tiene cifras: para las familias que cierran a 100 deja
# una marca (`nota_redondeo_pie`) y el graficador la resuelve con las unidades
# que va a rotular, anexándola al pie que tenga. La nota nunca cambia cifras ni
# bases: sólo agrega o no una línea al pie.

.nrm_el <- function(etype = "barras_apiladas", ov = list()) {
  structure(list(.element_type = etype, overrides = ov), class = c("ppt_element", "list"))
}
.nrm_presets <- function(base = list(), metodo = "estandar", dec = 0) {
  list(base = list(args = base),
       barras_apiladas = list(args = list(metodo_redondeo = metodo, decimales = dec)),
       barras_agrupadas = list(args = list(decimales = dec)))
}
.nrm_marca <- function(el) el$overrides$nota_redondeo_pie %||% NULL

# --- Modo y texto -----------------------------------------------------------

test_that("sin modo se deduce del booleano viejo", {
  expect_equal(.calculos_nota_modo(list(nota_redondeo = TRUE)), "siempre")
  expect_equal(.calculos_nota_modo(list(nota_redondeo = FALSE)), "nunca")
  expect_equal(.calculos_nota_modo(list()), "nunca")
  # Un modo reconocible manda sobre el booleano (el front escribe ambos).
  expect_equal(.calculos_nota_modo(list(nota_redondeo = TRUE, nota_redondeo_modo = "si_no_cierra")),
               "si_no_cierra")
  expect_equal(.calculos_nota_modo(list(nota_redondeo = TRUE, nota_redondeo_modo = "nunca")), "nunca")
  # Uno que no se reconoce cae al booleano.
  expect_equal(.calculos_nota_modo(list(nota_redondeo = TRUE, nota_redondeo_modo = "a_veces")), "siempre")

  # Plan viejo: solo el booleano, sigue saliendo la nota automática y siempre.
  m <- .nrm_marca(.calculos_aplicar_nota(.nrm_el(), .nrm_presets(list(nota_redondeo = TRUE))))
  expect_match(m$texto, "no sumar exactamente 100")
  expect_false(m$solo_si_no_cierra)
})

test_that("siempre usa el texto propio tal cual en vez del automático", {
  propio <- "Cifras al entero; las barras pueden sumar 99 o 101."
  m <- .nrm_marca(.calculos_aplicar_nota(.nrm_el(), .nrm_presets(list(
    nota_redondeo_modo = "siempre", nota_redondeo_texto = paste0("  ", propio, " ")))))
  expect_equal(m$texto, propio)
  # Texto vacío = automático.
  m2 <- .nrm_marca(.calculos_aplicar_nota(.nrm_el(), .nrm_presets(list(
    nota_redondeo_modo = "siempre", nota_redondeo_texto = ""))))
  expect_equal(m2$texto, .calculos_nota_texto("estandar", 0))
  # En una familia que no cierra a 100 va directo al pie, como antes.
  agr <- .calculos_aplicar_nota(.nrm_el("barras_agrupadas"), .nrm_presets(list(
    nota_redondeo_modo = "siempre", nota_redondeo_texto = propio)))
  expect_equal(agr$overrides$nota_pie, propio)
})

test_that("nunca no pone nota aunque el booleano viejo esté encendido", {
  out <- .calculos_aplicar_nota(.nrm_el(), .nrm_presets(list(
    nota_redondeo = TRUE, nota_redondeo_modo = "nunca")))
  expect_null(.nrm_marca(out))
  expect_null(out$overrides$nota_pie)
})

test_that("el anexado pone la previa primero y no repite lo que ya está", {
  expect_equal(.calculos_nota_anexar("Letras: diferencias significativas.", "Cifras al entero."),
               "Letras: diferencias significativas. Cifras al entero.")
  # La Base del caption de una torta no lleva punto: se le agrega.
  expect_equal(.calculos_nota_anexar("Base: 6 respuestas", "Nota R."), "Base: 6 respuestas. Nota R.")
  expect_equal(.calculos_nota_anexar(NULL, "Nota R."), "Nota R.")
  # Ya está (segunda pasada de una apilada con cruce) o ya habla de redondeo.
  expect_equal(.calculos_nota_anexar("Previa. Nota R.", "Nota R."), "Previa. Nota R.")
  expect_equal(.calculos_nota_anexar("Cifras redondeadas por el equipo.", "Nota R."),
               "Cifras redondeadas por el equipo.")

  # En el plan: una previa que ya habla del redondeo deja el elemento intacto.
  pres <- .nrm_presets(list(nota_redondeo_modo = "siempre", nota_redondeo_texto = "Nota R."))
  previa <- "Cifras redondeadas por el equipo."
  expect_null(.nrm_marca(.calculos_aplicar_nota(.nrm_el(ov = list(nota_pie = previa)), pres)))
  agr <- .calculos_aplicar_nota(.nrm_el("barras_agrupadas", list(nota_pie = "Letras.")), pres)
  expect_equal(agr$overrides$nota_pie, "Letras. Nota R.")
})

# --- «si_no_cierra» en el plan ---------------------------------------------

test_that("si_no_cierra marca solo familias que cierran y sin reparto", {
  base <- list(nota_redondeo = TRUE, nota_redondeo_modo = "si_no_cierra")
  out <- .calculos_aplicar_nota(.nrm_el(ov = list(nota_pie = "Nota del analista.")), .nrm_presets(base))
  # El pie no se toca en el plan: lo decide el graficador.
  expect_equal(out$overrides$nota_pie, "Nota del analista.")
  expect_true(.nrm_marca(out)$solo_si_no_cierra)

  # Con reparto la suma cierra por construcción: no hay marca.
  expect_null(.nrm_marca(.calculos_aplicar_nota(.nrm_el(), .nrm_presets(base, metodo = "reparto"))))
  # Agrupadas no cierra a 100: no hay suma que pueda faltar.
  agr <- .calculos_aplicar_nota(.nrm_el("barras_agrupadas"), .nrm_presets(base))
  expect_null(.nrm_marca(agr))
  expect_null(agr$overrides$nota_pie)
})

# --- El criterio: cifras tal como se rotulan --------------------------------

test_that("no_cierra mira la suma de las cifras rotuladas, barra por barra", {
  tercios <- c(1, 1, 1) / 3
  expect_true(.calculos_no_cierra(tercios, 0, "estandar"))      # 33+33+33 = 99
  expect_false(.calculos_no_cierra(c(0.5, 0.5), 0, "estandar")) # 50+50
  expect_false(.calculos_no_cierra(tercios, 0, "reparto"))      # 34+33+33
  # Con un decimal: 33.3 x 3 = 99.9, tampoco cierra.
  expect_true(.calculos_no_cierra(tercios, 1, "estandar"))
  # Una serie que no es distribución (respuesta múltiple) no tiene 100 que cerrar.
  expect_false(.calculos_no_cierra(c(0.62, 0.41, 0.15), 0, "estandar"))
  # Un residual rotulado cuenta: 0.495 + 0.495 + 0.01 → 50 + 50 + 1 = 101.
  expect_true(.calculos_no_cierra(c(0.495, 0.495, 0.01), 0, "estandar"))
})

test_that("el resolver anexa según el modo y lo que dicen las cifras", {
  cond <- list(texto = "Nota R.", solo_si_no_cierra = TRUE)
  siem <- list(texto = "Nota R.", solo_si_no_cierra = FALSE)
  expect_equal(.calculos_nota_resolver("Base: 6 respuestas", cond, no_cierra = TRUE),
               "Base: 6 respuestas. Nota R.")
  # Todo cierra: el pie queda como en «nunca», con su Base.
  expect_equal(.calculos_nota_resolver("Base: 6 respuestas", cond, no_cierra = FALSE), "Base: 6 respuestas")
  expect_null(.calculos_nota_resolver(NULL, cond, FALSE))
  # «Siempre»: aunque cierre.
  expect_equal(.calculos_nota_resolver(NULL, siem, FALSE), "Nota R.")
  # Sin marca: intacto.
  expect_equal(.calculos_nota_resolver("Base: 6", NULL, TRUE), "Base: 6")
})

# --- En el graficador, con las cifras que dibuja ----------------------------

.nrm_apilada <- function(filas, marca, metodo = "estandar", nota = NULL) {
  d <- data.frame(categoria = names(filas), N = 300L, stringsAsFactors = FALSE)
  k <- max(lengths(filas))
  for (j in seq_len(k)) d[[paste0("t", j)]] <- vapply(filas, function(f) f[j] %||% 0, numeric(1))
  suppressMessages(suppressWarnings(graficar_barras_apiladas(
    data = d, var_categoria = "categoria", var_n = "N", cols_porcentaje = paste0("t", seq_len(k)),
    etiquetas_grupos = stats::setNames(paste0("G", seq_len(k)), paste0("t", seq_len(k))),
    exportar = "rplot", usar_canvas = FALSE, metodo_redondeo = metodo,
    nota_pie = nota, nota_redondeo_pie = marca)))
}

test_that("apiladas: la barra 33/33/33 lleva nota, la 50/50 no, el reparto tampoco", {
  skip_if_not_installed("ggplot2")
  m <- .nrm_marca(.calculos_aplicar_nota(.nrm_el(), .nrm_presets(list(nota_redondeo_modo = "si_no_cierra"))))
  nota <- .calculos_nota_texto("estandar", 0)
  tercio <- c(1, 1, 1) / 3

  p <- .nrm_apilada(list(A = tercio), m)
  expect_equal(p$labels$caption, nota)
  # La lámina nativa y el Word la leen de aquí (`.plot_note_from`).
  expect_equal(attr(p, "note_outside"), nota)

  p50 <- .nrm_apilada(list(B = c(0.5, 0.5, 0)), m)
  expect_null(p50$labels$caption)
  expect_null(attr(p50, "note_outside"))
  # Basta UNA barra que no cierre para que la lámina lleve la nota.
  expect_equal(attr(.nrm_apilada(list(A = tercio, B = c(0.5, 0.5, 0)), m), "note_outside"), nota)
  # Con reparto el graficador también ve que todo cierra.
  expect_null(attr(.nrm_apilada(list(A = tercio), m, metodo = "reparto"), "note_outside"))
  # «Siempre»: va aunque cierre, y detrás de la nota previa.
  ms <- list(texto = nota, solo_si_no_cierra = FALSE)
  expect_equal(attr(.nrm_apilada(list(B = c(0.5, 0.5, 0)), ms, nota = "Letras."), "note_outside"),
               paste("Letras.", nota))
  # Las cifras rotuladas no cambian por la nota.
  expect_identical(attr(p, "pulso_espec"), attr(.nrm_apilada(list(A = tercio), NULL), "pulso_espec"))
})

test_that("pie y categóricas anexan la nota a su Base sin perderla", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("cowplot")
  m <- list(texto = "Nota R.", solo_si_no_cierra = TRUE)
  base <- "Base: 300 respuestas"
  pie <- function(pct) suppressMessages(suppressWarnings(graficar_pie(
    data = data.frame(opcion = paste0("O", seq_along(pct)), pct = pct, n = round(pct * 300)),
    var_categoria = "opcion", var_pct = "pct", var_n = "n", exportar = "rplot",
    nota_pie = base, nota_redondeo_pie = m)))
  p3 <- pie(c(1, 1, 1) / 3)
  expect_equal(attr(p3, "pulso_espec")$nota, "Base: 300 respuestas. Nota R.")
  expect_equal(attr(p3, "note_outside"), "Base: 300 respuestas. Nota R.")
  p2 <- pie(c(0.5, 0.5))
  expect_equal(attr(p2, "pulso_espec")$nota, base)
  expect_null(attr(p2, "note_outside"))

  cat_ <- function(pct, formato = "porcentaje") suppressMessages(suppressWarnings(graficar_barras_categoricas(
    data = data.frame(opcion = paste0("O", seq_along(pct)), pct = pct, n = round(pct * 300)),
    var_categoria = "opcion", var_valor = "pct", var_pct = "pct", var_n = "n",
    formato_valor = formato, nota_pie = base, nota_redondeo_pie = m)))
  expect_equal(attr(cat_(c(1, 1, 1) / 3), "note_outside"), "Base: 300 respuestas. Nota R.")
  expect_null(attr(cat_(c(0.5, 0.5)), "note_outside"))
  # Si se rotulan frecuencias y no porcentajes, no hay suma de porcentajes que falte.
  expect_null(attr(cat_(c(1, 1, 1) / 3, formato = "n"), "note_outside"))
})

# --- De punta a punta: el plan, el mazo nativo y su XML ----------------------

.nrm_fixture <- function() {
  df <- data.frame(p1 = c("Bajo", "Bajo", "Medio", "Medio", "Alto", "Alto"),   # 33/33/33 -> 99
                   p2 = c("Bajo", "Bajo", "Bajo", "Alto", "Alto", "Alto"),     # 50/50 -> 100
                   stringsAsFactors = FALSE)
  attr(df$p1, "label") <- "Pregunta tercios"; attr(df$p2, "label") <- "Pregunta mitades"
  inst <- list(
    survey = data.frame(name = c("p1", "p2"), type = "select_one lst", list_name = "lst", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "lst", name = c("Bajo", "Medio", "Alto"), label = c("Bajo", "Medio", "Alto"),
                         stringsAsFactors = FALSE),
    orders_list = NULL)
  plan <- list(diapo_001 = p_slide_1_grafico(grafico = p_barras_apiladas("p1")),
               diapo_002 = p_slide_1_grafico(grafico = p_barras_apiladas("p2")),
               diapo_003 = p_slide_1_grafico(grafico = p_pie("p2")))
  list(df = df, inst = inst, plan = plan)
}

test_that("si_no_cierra en el mazo: nota en la lámina 33/33/33, no en la 50/50, y la Base se queda", {
  skip_if_not_installed("officer")
  skip_if_not_installed("xml2")
  fx <- .nrm_fixture()
  path <- withr::local_tempfile(fileext = ".pptx")
  presets <- p_presets(base = list(nota_redondeo = TRUE, nota_redondeo_modo = "si_no_cierra",
                                   nota_redondeo_texto = "NOTA PROPIA DEL REDONDEO."))
  suppressMessages(suppressWarnings(capture.output(reporte_ppt_plan(
    data = fx$df, instrumento = fx$inst, plan = fx$plan, presets = presets,
    path_ppt = path, mensajes_progreso = FALSE))))
  expect_true(file.exists(path))

  doc <- officer::read_pptx(path)
  textos <- vapply(seq_len(length(doc)), function(i) {
    x <- officer::slide_summary(doc, index = i)
    paste(x$text[!is.na(x$text)], collapse = " | ")
  }, character(1))
  expect_length(textos, 3L)
  expect_match(textos[[1]], "NOTA PROPIA DEL REDONDEO.", fixed = TRUE)
  expect_match(textos[[1]], "Base: 6", fixed = TRUE)
  expect_match(textos[[1]], "33%", fixed = TRUE)
  expect_false(grepl("NOTA PROPIA", textos[[2]], fixed = TRUE))
  expect_match(textos[[2]], "Base: 6", fixed = TRUE)
  # La torta 50/50 cierra: sin nota y con su Base intacta.
  expect_false(grepl("NOTA PROPIA", textos[[3]], fixed = TRUE))
  # Una sola forma del pie en todas las rutas (CCSS-15, 67822ba19): «Base: N» sin sufijo si el preset no lo declara.
  expect_match(textos[[3]], "Base: 6", fixed = TRUE)
})

test_that("la metadata del preset base declara modo y texto", {
  payload <- .presets_metadata_payload()
  base <- Filter(function(x) identical(x$name %||% x$preset %||% "", "base"), payload$presets)
  args <- if (length(base)) base[[1]]$args else NULL
  skip_if(is.null(args), "estructura de metadata distinta")
  nms <- vapply(args, function(a) a$name, character(1))
  expect_true(all(c("nota_redondeo", "nota_redondeo_modo", "nota_redondeo_texto") %in% nms))
  modo <- args[[match("nota_redondeo_modo", nms)]]
  expect_equal(vapply(modo$choices, `[[`, character(1), "value"), c("nunca", "si_no_cierra", "siempre"))
  expect_equal(vapply(modo$choices, `[[`, character(1), "label"),
               c("Nunca", "Sólo si una barra no suma 100 %", "Siempre"))
})
