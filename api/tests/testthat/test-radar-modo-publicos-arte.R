source("setup-load-all.R")

# Arte (comentarios de Renzo, P12): la lámina 33 era un radar «box» con `var` residual y ocho `vars` planas. La intención
# era 4 temas × 2 públicos = modo «publicos». Estas pruebas fijan (a) el plan corregido reproduce las cifras de la lámina
# 40 de Renzo, (b) el guard del modo «box» dice qué hacer, (c) el margen de las etiquetas crece con el rótulo lateral.

.arte_fuente <- function(prefijo, conteos) {
  # `conteos`: lista nombrada por variable de vectores de 5 conteos (códigos 1..5; el 5 es «SIN INF»).
  n <- sum(conteos[[1]])
  data <- data.frame(id = seq_len(n), stringsAsFactors = FALSE)
  for (v in names(conteos)) data[[v]] <- as.character(rep(1:5, times = conteos[[v]]))
  lst <- paste0("lst_", prefijo)
  inst <- list(
    survey = data.frame(type = c("integer", rep("select_one", length(conteos))),
                        list_name = c(NA, rep(lst, length(conteos))),
                        name = c("id", names(conteos)), label = c("id", names(conteos)), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:5),
                         label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo",
                                   "Totalmente de acuerdo", "SIN INF"), stringsAsFactors = FALSE)
  )
  list(data = data, inst = inst)
}

.arte_sources <- function() {
  doc <- .arte_fuente("p25", list(p25_1 = c(2, 4, 68, 35, 6), p25_2 = c(1, 2, 72, 34, 6),
                                  p25_3 = c(0, 9, 65, 33, 8), p25_4 = c(0, 7, 70, 29, 9)))
  est <- .arte_fuente("p17", list(p17_1 = c(1, 7, 172, 91, 8), p17_2 = c(2, 6, 137, 131, 3),
                                  p17_3 = c(2, 8, 131, 136, 2), p17_4 = c(2, 11, 156, 98, 12)))
  list(data_sources = list(docentes = doc$data, estudiantes = est$data),
       inst_sources = list(docentes = doc$inst, estudiantes = est$inst))
}

.arte_args_corregidos <- function() {
  list(
    modo = "publicos",
    vars = list(`Comunicación visual` = c("docentes$p25_1", "estudiantes$p17_1"),
                `Creación` = c("docentes$p25_2", "estudiantes$p17_2"),
                `Experimentación, técnica y producción` = c("docentes$p25_3", "estudiantes$p17_3"),
                `Representación` = c("docentes$p25_4", "estudiantes$p17_4")),
    corte = "3,4", corte_etiqueta = "De acuerdo + Totalmente de acuerdo",
    titulos_grupo = list(`Comunicación visual` = "Comunicación visual", `Creación` = "Creación",
                         `Experimentación, técnica y producción` = "Experimentación, técnica y producción",
                         `Representación` = "Representación"),
    mostrar_tabla = TRUE)
}

test_that("el plan de Arte con modo publicos arma el radar y reproduce las cifras de la lámina 40 de Renzo", {
  el <- do.call(p_radar, .arte_args_corregidos())
  expect_identical(el$.element_type, "radar_publicos")
  d <- .radar_mb_datos(el$vars, el$corte, .arte_sources())
  v <- function(g) round(d$valor[d$grupo == g])
  expect_equal(v("docentes"), c(90, 92, 85, 86))
  expect_equal(v("estudiantes"), c(94, 96, 96, 91))
  expect_equal(as.character(d$eje[d$grupo == "docentes"]),
               c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación"))
})

test_that("el radar «box» con `var` y `vars` dice que para comparar públicos se usa «publicos»", {
  err <- tryCatch(
    p_radar(modo = "box", var = "estudiantes$p17_1",
            vars = list("docentes$p25_1", "estudiantes$p17_1", "docentes$p25_2", "estudiantes$p17_2")),
    error = function(e) conditionMessage(e))
  expect_match(err, "compara preguntas de una base", fixed = TRUE)
  expect_match(err, "para comparar públicos usa el modo «publicos»", fixed = TRUE)
})

test_that("el radar «box» con `vars` de varias bases NO aborta (lista nombrada por tema es un uso soportado)", {
  # Regresion corregida: el guard abortaba con refs de varias bases aunque `vars` fuera una lista nombrada por tema
  # (test-engine-plan-ppt-var-cruce.R: «p_radar_tabla modo box acepta vars como lista multi-fuente»). Solo `var` aborta.
  expect_no_error(
    p_radar(modo = "box", vars = list("Tema uno" = c("docentes$p25_1", "estudiantes$p17_1"),
                                      "Tema dos" = c("docentes$p25_2", "estudiantes$p17_2")),
            box_labels = c("De acuerdo", "Total")))
})

test_that("el radar «box» de una sola base y sin `var` sigue válido", {
  expect_no_error(
    p_radar(modo = "box", vars = list("docentes$p25_1", "docentes$p25_2"), box_labels = c("De acuerdo", "Total")))
})

test_that("el margen de las etiquetas crece con el rótulo lateral más largo y se acota en 5 ejes", {
  corto <- .radar_mb_margen_etiquetas(c("Uno", "Dos", "Tres", "Cuatro"))
  largo <- .radar_mb_margen_etiquetas(c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación"))
  expect_gte(corto, 1.18)
  expect_gt(largo, 1.18)
  expect_lte(largo, 1.5)
  # De seis ejes en adelante el encuadre no cambia: el aire lo da el anillo de etiquetas (ver `.RADAR_MB_MARGENES`).
  expect_equal(.radar_mb_margen_etiquetas(c("Representación", rep("Otro", 5))), 1.18)
})

test_that("el margen derivado llega al graficador del radar entre públicos y un override lo pisa", {
  datos <- .radar_mb_datos(.arte_args_corregidos()$vars, "3,4", .arte_sources())
  cap <- function(...) {
    capturado <- NULL
    testthat::with_mocked_bindings(
      graficar_radar = function(...) { capturado <<- list(...); NULL },
      .radar_mb_grafico(datos, ...), .package = "prosecnurapp")
    capturado
  }
  expect_gt(cap()$margen_etiquetas, 1.18)
  expect_equal(cap(overrides = list(margen_etiquetas = 1.4))$margen_etiquetas, 1.4)
})

# Las cifras de los anillos (20 %-100 %) caían sobre el lado de las series en un radar de cuatro ejes, con valores de
# 90 % a 96 %: se leían encima de la línea y del punto (lámina 33 de Arte).
.arte_espec_cuatro_ejes <- function() {
  d <- do.call(rbind, list(
    data.frame(eje = c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación"),
               grupo = "Docentes", valor = c(90, 92, 85, 86)),
    data.frame(eje = c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación"),
               grupo = "Estudiantes", valor = c(94, 96, 96, 91))))
  d$eje <- factor(d$eje, levels = unique(d$eje))
  attr(suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", usar_canvas = TRUE,
                                       mostrar_tabla_derecha = TRUE, limites = c(0, 1))), "pulso_espec")
}
.arte_capa_niveles <- function(e) {
  g <- .lam_radar_gg(e)
  i <- which(vapply(g$layers, function(l) inherits(l$geom, "GeomLabel"), TRUE))
  g$layers[[i]]
}

test_that("con cuatro ejes las cifras de los anillos quedan dentro del lado de la serie más baja, sin pisarla", {
  e <- .arte_espec_cuatro_ejes()
  capa <- .arte_capa_niveles(e)
  expect_equal(capa$aes_params$hjust, 1)     # hacia adentro del lado: hacia afuera cruzaba la línea de las series
  niv <- ggplot2::layer_data(.lam_radar_gg(e) , which(vapply(.lam_radar_gg(e)$layers, function(l) inherits(l$geom, "GeomLabel"), TRUE)))
  lo <- e$lo; rr <- function(v) (v - lo) / (100 - lo)
  d_lado <- vapply(e$grupos, function(a) {
    v <- 100 * e$valores[, a]
    sum(((rr(v[1]) * c(0, 1) + rr(v[2]) * c(1, 0)) / 2) * c(cos(pi / 4), sin(pi / 4)))
  }, 0)
  rho <- (niv$x + 0.02) * cos(pi / 4) + niv$y * sin(pi / 4)
  expect_true(all(rho + 0.07 < min(d_lado)))
  expect_gte(nrow(niv), 2L)                  # la grilla sigue informando
})

test_that("de seis ejes en adelante las cifras de los anillos conservan su sitio", {
  ejes <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
  d <- data.frame(eje = factor(ejes, levels = ejes), grupo = "Docentes", valor = c(98, 96, 92, 96, 94, 92))
  e <- attr(suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", usar_canvas = TRUE,
                                            mostrar_tabla_derecha = TRUE)), "pulso_espec")
  expect_equal(.arte_capa_niveles(e)$aes_params$hjust, 0)
})

test_that("margen_etiquetas se expone en la metadata del radar y se guarda en el slot", {
  meta <- .GRAFICADORES_META$p_radar$args
  m <- Filter(function(a) identical(a$name, "margen_etiquetas"), meta)
  expect_length(m, 1L)
  expect_identical(m[[1]]$tipo_input, "number")
  expect_equal(c(m[[1]]$min, m[[1]]$max), c(1, 2))
  expect_true(nzchar(m[[1]]$descripcion))
  el <- do.call(p_radar, c(.arte_args_corregidos(), list(margen_etiquetas = 1.4)))
  expect_equal(el$overrides$margen_etiquetas, 1.4)
  expect_error(do.call(p_radar, c(.arte_args_corregidos(), list(margen_etiquetas = 3))), "margen_etiquetas")
  expect_null(do.call(p_radar, .arte_args_corregidos())$overrides$margen_etiquetas)
})
