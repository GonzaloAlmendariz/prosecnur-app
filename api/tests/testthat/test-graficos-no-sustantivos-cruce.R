source("setup-load-all.R")

# CCSS Perfil 2026 (lámina 55, CCSS-11b y CCSS-12b): en la multiapilada de CRUCE el no sustantivo (9 «No tengo información
# suficiente») seguía con el verde más oscuro y el neutro pasaba a amarillo, porque la paleta se armaba con seis pasos. El
# enganche de graficos_no_sustantivos.R cubría sólo el modo var; ahora también cruce, var_cruce y multilista.

.nsc_etq <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo",
              "Totalmente de acuerdo", "No tengo información suficiente para responder")
.nsc_render <- function(modo) {
  set.seed(11); n <- 300
  dat <- data.frame(id = seq_len(n), c1 = sample(c(1:5, 9), n, TRUE), c2 = sample(c(1:5, 9), n, TRUE),
                    g = sample(c("A", "B"), n, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(type = c("integer", "select_one acuerdo", "select_one acuerdo", "select_one gr"),
                                   name = c("id", "c1", "c2", "g"), label = c("id", "Premisa uno", "Premisa dos", "Grupo"),
                                   list_name = c(NA, "acuerdo", "acuerdo", "gr"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("acuerdo", 6), "gr", "gr"), name = c(as.character(c(1:5, 9)), "A", "B"),
                                    label = c(.nsc_etq, "A", "B"), stringsAsFactors = FALSE))
  el <- if (identical(modo, "cruce")) p_barras_multiapiladas(modo = "cruce", var = "c1", cruces = "g") else
    p_barras_multiapiladas(modo = "var", vars = c("c1", "c2"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
                                                     plan = list(s = p_slide_1_grafico(grafico = el, titulo = "T")))))
  x <- paste(readLines(unz(out, "ppt/slides/slide1.xml"), warn = FALSE), collapse = "")
  unique(toupper(regmatches(x, gregexpr('(?<=srgbClr val=")[0-9A-Fa-f]{6}', x, perl = TRUE))[[1]]))
}

test_that("en el cruce el no sustantivo va en gris y el neutro conserva su color, igual que en el modo var", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  pal <- toupper(sub("^#", "", unname(.graficos_no_sustantivos_paleta("acuerdo", as.character(c(1:5, 9)),
    data.frame(list_name = "acuerdo", name = as.character(c(1:5, 9)), label = .nsc_etq, stringsAsFactors = FALSE)))))
  var <- .nsc_render("var"); cruce <- .nsc_render("cruce")
  expect_true(all(pal %in% var), info = paste(setdiff(pal, var), collapse = ", "))
  expect_true(all(pal %in% cruce), info = paste("faltan en el cruce:", paste(setdiff(pal, cruce), collapse = ", ")))
})
