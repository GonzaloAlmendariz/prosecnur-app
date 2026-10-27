# Escala con una categoría no sustantiva (CCSS Perfil 2026: C1 1-5 + 9 «No tengo información suficiente para responder»,
# B12 1-5 + 77 «No lo sé / No uso este recurso»). Invariantes del lead (dominio + entregables + motor fino):
#
# - Detección: (a) metadata del instrumento, (b) código fuera del rango de la escala, (c) rótulo («No sé», «No lo sé»,
#   «No sabe», «No tengo información», «Sin información», «SIN INF», «No uso», «No aplica», «No responde», «Prefiero no
#   responder»; sin distinguir mayúsculas ni tildes; un rótulo compuesto con « / » cuenta si alguna parte casa). Si (a)
#   choca con (b)/(c), manda (a). Un código dentro del rango nunca es no sustantivo.
# - Lámina: la no sustantiva sigue DENTRO del 100 % de la barra; va gris (`texto_tenue`), al final de la barra y de la
#   leyenda; el Top/Bottom Two Box tiene el mismo denominador (el total) y nunca la suma, tampoco por defecto.

.ens_etq <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
              "Totalmente de acuerdo", "No tengo información suficiente para responder")

# El gris del no sustantivo: `texto_tenue` (623146ac2), distinto del neutro #D9D9D9 de la escala. No es el `likert[5]` de
# «SIN INF» en Arte a propósito: en una escala con neutro gris, ese gris casi no se distingue (decisión del lead, 2026-10-27).
.ens_gris <- function() .graficos_no_sustantivo_color()

test_that("(c) los rótulos del dominio, sin distinguir mayúsculas ni tildes", {
  rot <- c("No sé", "NO SE", "No lo sé", "no lo se", "No sabe", "No tengo información", "NO TENGO INFORMACION SUFICIENTE",
           "Sin información", "SIN INF", "No uso", "No aplica", "No responde", "Prefiero no responder")
  for (r in rot) {
    expect_identical(.graficos_no_sustantivos(c("a", "b", "c", "x"), c("Malo", "Regular", "Bueno", r)),
                     c(FALSE, FALSE, FALSE, TRUE), info = r)
  }
})

test_that("(c) un rótulo compuesto con « / » cuenta si alguna parte casa", {
  expect_identical(.graficos_no_sustantivos(c("a", "b", "c", "x"), c("Malo", "Regular", "Bueno", "No corresponde / No sabe")),
                   c(FALSE, FALSE, FALSE, TRUE))
  expect_identical(.graficos_no_sustantivos(c("a", "b", "c", "x"), c("Malo", "Regular", "Bueno", "Desconoce / NO APLICA")),
                   c(FALSE, FALSE, FALSE, TRUE))
  # una barra suelta sin espacios no parte el rótulo: «Bueno/Muy bueno» no es no sustantivo
  expect_false(any(.graficos_no_sustantivos(c("a", "b", "c"), c("Malo", "Regular", "Bueno/Muy bueno"))))
})

test_that("(a) manda cuando choca con (b) o (c): la metadata que dice «no especial» gana", {
  ch <- data.frame(list_name = "acuerdo", name = as.character(c(1:5, 9)), label = .ens_etq,
                   especial = c("", "", "", "", "", "0"), stringsAsFactors = FALSE)
  # sin la metadata, (b) y (c) lo marcan
  expect_identical(.graficos_no_sustantivos_de_niveles("acuerdo", ch$name, ch[, 1:3]), c(rep(FALSE, 5), TRUE))
  # con la metadata explícita en «no», manda (a)
  expect_identical(.graficos_no_sustantivos_de_niveles("acuerdo", ch$name, ch), rep(FALSE, 6))
  # y la metadata en «sí» sigue marcando, incluso dentro del rango
  ch$especial <- c("", "", "1", "", "", "")
  expect_identical(.graficos_no_sustantivos_de_niveles("acuerdo", ch$name, ch), c(FALSE, FALSE, TRUE, FALSE, FALSE, TRUE))
})

test_that("un código dentro del rango nunca es no sustantivo por rótulo", {
  expect_false(any(.graficos_no_sustantivos(as.character(1:4), c("No uso", "Uso poco", "Uso bastante", "Uso mucho"))))
})

# ---- en la lámina ---------------------------------------------------------------------------------------------------

.ens_render <- function() {
  cod <- c(1:5, 9)
  dat <- data.frame(id = 1:100, c1 = rep(cod, c(10, 20, 30, 25, 5, 10)), c2 = rep(cod, c(5, 15, 30, 30, 12, 8)))
  inst <- list(survey = data.frame(type = c("integer", "select_one acuerdo", "select_one acuerdo"), name = c("id", "c1", "c2"),
                                   label = c("id", "Premisa uno", "Premisa dos"), list_name = c(NA, "acuerdo", "acuerdo"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = "acuerdo", name = as.character(cod), label = .ens_etq, stringsAsFactors = FALSE))
  el <- p_barras_multiapiladas(modo = "var", vars = c("c1", "c2"), barra_extra = "top2box",
                               top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(s = p_slide_1_grafico(grafico = el, titulo = "T")))))
  x <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  s <- xml2::xml_find_all(x, "//p:sp")
  num <- function(n, a) as.numeric(xml2::xml_attr(xml2::xml_find_first(s, n), a)) / 914400
  data.frame(nm = xml2::xml_attr(xml2::xml_find_first(s, "./p:nvSpPr/p:cNvPr"), "name"),
             x = num(".//a:off", "x"), y = num(".//a:off", "y"),
             col = toupper(xml2::xml_attr(xml2::xml_find_first(s, "./p:spPr/a:solidFill/a:srgbClr"), "val")),
             t = xml2::xml_text(s), stringsAsFactors = FALSE)
}

test_that("en la multiapilada el no sustantivo va gris, último en la barra y en la leyenda, y el T2B no cambia", {
  skip_if_not_installed("officer")
  f <- .ens_render()
  gris <- toupper(sub("^#", "", .ens_gris()))
  seg <- f[f$nm == "segmento", ]
  for (y in unique(seg$y)) {
    fila <- seg[seg$y == y, ]; fila <- fila[order(fila$x), ]
    expect_identical(fila$col[nrow(fila)], gris, info = paste("fila", y))
    expect_false(any(fila$col[-nrow(fila)] == gris), info = paste("fila", y))
  }
  ley <- f[f$nm == "leyenda:texto", ]; ley <- ley[order(ley$y, ley$x), ]
  expect_identical(ley$t[nrow(ley)], .ens_etq[6])
  cua <- f[f$nm == "leyenda:cuadro", ]; cua <- cua[order(cua$y, cua$x), ]
  expect_identical(cua$col[nrow(cua)], gris)
  # Top Two Box sobre el total (100), sin la no sustantiva: c2 = 30 + 12 = 42 %, c1 = 25 + 5 = 30 %.
  box <- f[f$nm == "box:cifra", ]; box <- box[order(box$y), ]
  expect_setequal(box$t, c("42%", "30%"))
  # la no sustantiva sigue dentro del 100 %: su cifra se rotula (10 % en c1, 8 % en c2)
  expect_true(all(c("10%", "8%") %in% f$t[f$nm %in% c("cifra", "cifra_fuera")]))
})

# ---- Top/Bottom Two Box por defecto (sin `top2box_labels`) ------------------------------------------------------------
# `.default_box_cols` tomaba «las dos últimas» no especiales y «No tengo información suficiente» (código 9) no lo era para
# `.is_special_box_choice`: el Top Two Box por defecto de C1 sumaba 5 + 9 en vez de 4 + 5. Corrección de una cifra errónea.

.ens_cols <- c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5", "pct_9")
.ens_lab <- stats::setNames(.ens_etq, .ens_cols)

test_that("el box por defecto no toma el no sustantivo: 4 + 5 arriba, 1 + 2 abajo", {
  expect_identical(.default_box_cols(.ens_cols, .ens_lab, n = 2L, side = "top"), c("pct_4", "pct_5"))
  expect_identical(.default_box_cols(.ens_cols, .ens_lab, n = 2L, side = "bottom"), c("pct_1", "pct_2"))
  b12 <- stats::setNames(c("Muy malo", "Malo", "Regular", "Bueno", "Muy bueno", "No lo sé / No uso este recurso"),
                         c("pct_1", "pct_2", "pct_3", "pct_4", "pct_5", "pct_77"))
  expect_identical(.default_box_cols(names(b12), b12, n = 2L, side = "top"), c("pct_4", "pct_5"))
  # sin código en la columna decide el rótulo
  sin_cod <- stats::setNames(.ens_etq, paste0("c", letters[1:6]))
  expect_identical(.default_box_cols(names(sin_cod), sin_cod, n = 2L, side = "top"), c("cd", "ce"))
  # un código dentro del rango nunca sale, aunque su rótulo lo parezca
  uso <- stats::setNames(c("No uso", "Uso poco", "Uso bastante", "Uso mucho"), paste0("pct_", 1:4))
  expect_identical(.default_box_cols(names(uso), uso, n = 2L, side = "bottom"), c("pct_1", "pct_2"))
})

test_that("en el graficador, sin declarar categorías el box no se dibuja (no hay cifra por defecto que corregir)", {
  # `.box_decidir` apaga la columna sin `top2box_labels`: `.default_box_cols` sólo se alcanza si la declaración no empareja
  # nada, y entonces tampoco se dibuja. El arreglo de arriba deja la regla posicional correcta por si vuelve a usarse.
  df <- data.frame(categoria = c("Premisa uno", "Premisa dos"), N = c(100L, 100L), stringsAsFactors = FALSE)
  v <- rbind(c(.10, .20, .30, .25, .05, .10), c(.05, .15, .30, .30, .12, .08))
  for (k in seq_along(.ens_cols)) df[[.ens_cols[k]]] <- v[, k]
  g <- function(...) suppressWarnings(graficar_barras_apiladas(
    data = df, var_categoria = "categoria", var_n = "N", cols_porcentaje = .ens_cols, etiquetas_grupos = .ens_lab,
    mostrar_barra_extra = TRUE, barra_extra_preset = "top2box", ...))
  expect_message(g(), "no hay categorías declaradas")
  expect_length(attr(suppressMessages(g()), "pulso_espec")$box$cols, 0L)
  # declarado 4 + 5: 30 % y 42 % sobre el total
  box <- attr(suppressMessages(g(top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))), "pulso_espec")$box
  expect_identical(box$cols, c("pct_4", "pct_5"))
  expect_identical(unname(box$cifras), c("30%", "42%"))
})
