# Ola 2, E1a (diag4/e1a_orden.R): con la escala visible declarada de positivo a negativo (Totalmente de acuerdo, De
# acuerdo, En desacuerdo, Totalmente en desacuerdo; `direccion_escala = "positivo_negativo"`), la imagen ggplot apila los
# extremos pegados al cero: «Totalmente de acuerdo» de 0 a 30 y «De acuerdo» por fuera, de 30 a 70. Una divergente lee
# la intensidad por la distancia al centro, así que el extremo de cada polo tiene que ir afuera, como ya lo ordena la
# especificación (graficos_espec_divergentes.R) y como sale la misma escala declarada de negativo a positivo.
#
# Decisión del lead: cuando la dirección declarada contradice el sentido que se lee de los extremos de la escala
# (`.escala_arm_sentido()`), el render lo avisa con nombre (`[PULSO-AVISO]`, por message: el renderer se traga los
# warning) y no corrige: la inversión de la QA fue declarada, no un error.
#
# Interfaz: el mismo `.render_barras_divergentes` del plan, con la tabla de frecuencias sustituida en el marco del test
# (como test-graficos-ola4-metodologia.R).

.ola2_e1a_render <- function(direccion, etiquetas, n) {
  .tab_freq <- function(ref, filtros = list()) {
    data.frame(Opciones = c(etiquetas, "Total"), n = c(n, sum(n)), stringsAsFactors = FALSE)
  }
  el <- p_barras_divergentes(vars = "p1", n_negativas = 2, incluir_neutro = FALSE, mostrar_saldo = FALSE,
                             direccion_escala = direccion)
  avisos <- character(0)
  g <- withCallingHandlers(
    .render_barras_divergentes(el),
    message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
  list(g = g, avisos = avisos)
}

# Segmentos de la barra (capa con xmin/xmax y relleno), identificados por su largo: los cuatro valores son distintos.
.ola2_e1a_segmentos <- function(g, largos) {
  b <- ggplot2::ggplot_build(g)
  capa <- Filter(function(d) all(c("xmin", "xmax", "fill") %in% names(d)), b$data)[[1]]
  capa <- capa[!is.na(capa$xmin), , drop = FALSE]
  ancho <- round(abs(capa$xmax - capa$xmin), 6)
  i <- vapply(largos, function(v) which(abs(ancho - v) < 1e-6)[1], integer(1))
  data.frame(cat = names(largos), xmin = capa$xmin[i], xmax = capa$xmax[i])
}

.ola2_e1a_pn <- c("Totalmente de acuerdo", "De acuerdo", "En desacuerdo", "Totalmente en desacuerdo")
.ola2_e1a_np <- rev(.ola2_e1a_pn)

test_that("E1a: escala declarada positivo->negativo: los extremos de cada polo van afuera, no pegados al cero", {
  skip_if_not_installed("ggplot2")
  r <- .ola2_e1a_render("positivo_negativo", .ola2_e1a_pn, c(30, 40, 20, 10))
  s <- .ola2_e1a_segmentos(r$g, c(TA = 30, DA = 40, ED = 20, TD = 10))
  # Precondición: el lado de cada categoría ya es el correcto (lo fija test-graficos-ola4-metodologia.R).
  expect_true(all(s$xmin[s$cat %in% c("TA", "DA")] >= 0))
  expect_true(all(s$xmax[s$cat %in% c("ED", "TD")] <= 0))
  expect_equal(s$xmax[s$cat == "TA"], max(s$xmax))
  expect_equal(s$xmin[s$cat == "TD"], min(s$xmin))
  # Los intermedios, pegados al cero.
  expect_equal(s$xmin[s$cat == "DA"], 0)
  expect_equal(s$xmax[s$cat == "ED"], 0)
})

test_that("E1a: referencia negativo->positivo con los mismos valores (ya correcta)", {
  skip_if_not_installed("ggplot2")
  r <- .ola2_e1a_render("negativo_positivo", .ola2_e1a_np, c(10, 20, 40, 30))
  s <- .ola2_e1a_segmentos(r$g, c(TD = 10, ED = 20, DA = 40, TA = 30))
  expect_equal(s$xmax[s$cat == "TA"], max(s$xmax))
  expect_equal(s$xmin[s$cat == "TD"], min(s$xmin))
})

test_that("E1a: la dirección declarada que contradice el sentido de la escala se avisa con nombre", {
  skip_if_not_installed("ggplot2")
  # La escala va de positivo a negativo (lo dicen sus extremos) y se declara negativo->positivo.
  expect_identical(.escala_arm_sentido(.ola2_e1a_pn), "positivo_negativo")
  r <- .ola2_e1a_render("negativo_positivo", .ola2_e1a_pn, c(30, 40, 20, 10))
  sellados <- grep("[PULSO-AVISO]", r$avisos, fixed = TRUE, value = TRUE)
  expect_true(any(grepl("direcci[oó]n|sentido", sellados, ignore.case = TRUE)),
              info = paste("avisos emitidos:", paste(r$avisos, collapse = " | ")))
})

test_that("E1a: la dirección declarada que coincide con el sentido de la escala no avisa", {
  skip_if_not_installed("ggplot2")
  r <- .ola2_e1a_render("positivo_negativo", .ola2_e1a_pn, c(30, 40, 20, 10))
  sellados <- grep("[PULSO-AVISO]", r$avisos, fixed = TRUE, value = TRUE)
  expect_false(any(grepl("direcci[oó]n|sentido", sellados, ignore.case = TRUE)))
  r2 <- .ola2_e1a_render("negativo_positivo", .ola2_e1a_np, c(10, 20, 40, 30))
  sellados2 <- grep("[PULSO-AVISO]", r2$avisos, fixed = TRUE, value = TRUE)
  expect_false(any(grepl("direcci[oó]n|sentido", sellados2, ignore.case = TRUE)))
})
