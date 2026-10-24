source("setup-load-all.R")

# Radar nativo con tabla (lámina 33 de Arte, 2026-10-24): salía pequeño y arrinconado, con la etiqueta larga
# «Experimentación, técnica y producción» fuera de la lámina nativa (caía al ggplot de respaldo). Ahora el radar llena su
# zona, los rótulos largos se envuelven y las cifras de los anillos no pisan ningún rótulo de eje.

.rl_espec <- function(ejes, con_tabla = TRUE, grupos = c("Docentes", "Estudiantes")) {
  K <- length(ejes)
  V <- matrix(c(rep(0.90, K), rep(0.95, K)), K, 2, dimnames = list(ejes, grupos))
  C <- V; C[] <- "90%"
  list(version = "radar/1", tipo = "radar", ejes = ejes, grupos = grupos, valores = V, cifras = C,
       colores = stats::setNames(c("#0B3C8C", "#1FA187"), grupos), lo = 0, anillos = c(20, 40, 60, 80, 100),
       encabezado = "Indicador", con_tabla = con_tabla, nota = NULL)
}
.rl_fuente <- function(prefijo, n_temas, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in seq_len(n_temas)) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% length(valores) + 1L]])
  lst <- paste0("lst_", prefijo); vars <- paste0(prefijo, seq_len(n_temas))
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", n_temas)), list_name = c(NA, rep(lst, n_temas)),
                        name = c("id", vars), label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)))
}
.rl_sources <- function(n) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .rl_fuente("a", n, v); b <- .rl_fuente("b", n, rev(v)); c3 <- .rl_fuente("c", n, v[2:1])
  list(data_sources = list(docentes = a$data, estudiantes = b$data, egresados = c3$data),
       inst_sources = list(docentes = a$inst, estudiantes = b$inst, egresados = c3$inst))
}
.rl_vars <- function(n, tres = FALSE) {
  setNames(lapply(seq_len(n), function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k), if (tres) paste0("egresados$c", k))),
           paste("Tema", seq_len(n)))
}
.rl_largo <- c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación", "Criterio 5", "Criterio 6")
.rl_solapan <- function(a, b) a$x0 < b$x1 && b$x0 < a$x1 && a$y0 < b$y1 && b$y0 < a$y1

test_that("los rótulos largos de los lados se envuelven (hasta tres líneas) y la lámina nativa los acepta", {
  e <- .rl_espec(.rl_largo)
  g <- .lam_radar_geom(e)
  expect_true(grepl("\n", g$rot[3], fixed = TRUE))
  expect_lte(max(g$lineas), 3L)
  expect_true(all(g$ancho_rot <= .LAM_RADAR$rot_max + 0.01))
  expect_true(.lam_radar_cabe(e))
  expect_identical(.lam_radar_envolver("Costos", 1.8), "Costos")                 # lo corto no se toca
  expect_identical(g$rot[-3], .rl_largo[-3])
})

test_that("con tabla, el radar llena su zona y la tabla queda cerca del radar", {
  R <- .LAM_RADAR
  # (con 8 criterios y un rótulo de dos líneas la tabla no cabe a lo alto: eso lo decide `.lam_radar_cabe` desde antes)
  for (ejes in list(.rl_largo, .rl_largo[c(1, 2, 4, 5, 6)], c(.rl_largo[-3], "Criterio 7", "Criterio 8"))) {
    e <- .rl_espec(ejes); g <- .lam_radar_geom(e); cj <- .lam_radar_cajas(e)
    # El diámetro vertical (2 unidades) ocupa ≥ 75 % del alto de la zona (antes 68 %) y el conjunto entra en su ancho.
    expect_gte(2 * g$unidad / R$alto, 0.75)
    expect_gte(min(cj$ejes$x0), -0.01); expect_lte(max(cj$ejes$x1), R$ancho + 0.01)
    expect_true(.lam_radar_cabe(e))
  }
  e <- .rl_espec(.rl_largo); cj <- .lam_radar_cajas(e)
  borde <- .std_geom("margen_izq") + max(cj$ejes$x1)                             # donde termina el rótulo más a la derecha
  expect_lte(R$x_tabla - borde, 0.6)                                             # antes ≈ 1.5 in de aire entre radar y tabla
  expect_gte(R$x_tabla - borde, 0.1)                                             # y sin pisar la tabla
})

test_that("las cifras de los anillos no caen sobre ningún rótulo de eje", {
  for (ejes in list(.rl_largo, .rl_largo[1:5], .rl_largo[1:4], c(.rl_largo, "Criterio 7", "Criterio 8"))) {
    for (tabla in c(TRUE, FALSE)) {
      cj <- .lam_radar_cajas(.rl_espec(ejes, con_tabla = tabla))
      expect_gt(nrow(cj$cifras), 0L)
      for (i in seq_len(nrow(cj$cifras))) for (j in seq_len(nrow(cj$ejes))) {
        expect_false(.rl_solapan(cj$cifras[i, ], cj$ejes[j, ]),
                     info = sprintf("%d ejes, tabla=%s: «%s» pisa «%s»", length(ejes), tabla, cj$cifras$t[i], cj$ejes$eje[j]))
      }
    }
  }
})

test_that("sin tabla el radar conserva la geometría del recetario", {
  for (ejes in list(.rl_largo[1:5], c(.rl_largo[c(1, 2, 4)], "Criterio 5"), c(.rl_largo, "Criterio 7", "Criterio 8"))) {
    g <- .lam_radar_geom(.rl_espec(ejes, con_tabla = FALSE))
    expect_equal(g$unidad, min(.LAM_RADAR$ancho / 4.3, .LAM_RADAR$alto / 2.5))
    expect_equal(g$xlim, c(-2.15, 2.15)); expect_equal(g$ylim, c(-1.25, 1.25))
    expect_identical(g$rot, ejes)
  }
})

test_that("la lámina con rótulo largo y tabla se compone nativa: radar a la izquierda, tabla en x = 7.25", {
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_radar(doc, .rl_espec(.rl_largo), "Competencias de salida", sub = "% De acuerdo", base = "Base: 10", folio = 1)
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  off <- xml2::xml_find_first(xml, "//p:graphicFrame[.//a:tbl]/p:xfrm/a:off")
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 7.25, tolerance = 0.01)
})

test_that("el indicador del radar (su subtítulo) llega a la lámina nativa bajo el título", {
  d <- do.call(rbind, lapply(c("Docentes", "Estudiantes"), function(g)
    data.frame(eje = .rl_largo, grupo = g, valor = c(90, 92, 85, 86, 90, 92))))
  e <- attr(suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", usar_canvas = TRUE, mostrar_tabla_derecha = TRUE,
                                            subtitulo = "% De acuerdo + Totalmente de acuerdo")), "pulso_espec")
  expect_identical(e$subtitulo, "% De acuerdo + Totalmente de acuerdo")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_radar(doc, e, "Competencias", base = "Base: 10", folio = 1)
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  expect_true(any(grepl("De acuerdo + Totalmente de acuerdo", xml2::xml_text(xml2::xml_find_all(xml, "//p:sp")), fixed = TRUE)))
})

test_that("`tabla = no` quita la tabla del radar aunque el preset del proyecto la pida", {
  src <- .rl_sources(6L)
  render <- function(tabla) {
    el <- p_radar(modo = "publicos", vars = .rl_vars(6L), corte = "3,4", corte_etiqueta = "% Bien + Muy bien", tabla = tabla)
    data_sources <- src$data_sources; instrument_sources <- src$inst_sources
    suppressWarnings(.render_radar_publicos(el, preset_args = list(mostrar_tabla_derecha = TRUE)))
  }
  expect_false(attr(render("no"), "pulso_espec")$con_tabla)
  expect_true(attr(render("auto"), "pulso_espec")$con_tabla)
})
