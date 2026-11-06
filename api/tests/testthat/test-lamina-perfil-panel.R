# checklist-arte-vs-conta-2026-10-29, ítems 18–20: los paneles de las láminas mixtas y de perfil como Contabilidad.
# 18: barra de panel nunca bajo el piso (0,66 cm) y una sola por lámina. 19: rótulo de categoría a 13 pt, el mismo en todos
# los paneles. 20: la pregunta de cada panel a 16 pt y centrada sobre su panel. Sin estilo, `.lam_panel_titulo` no cambia.

.pf_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.pf_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "./p:nvSpPr/p:cNvPr"), "name")
  sp <- sp[nm == nombre]
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
             sz = suppressWarnings(as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), "sz"))) / 100,
             algn = xml2::xml_attr(xml2::xml_find_first(sp, ".//a:pPr"), "algn"),
             txt = vapply(sp, function(s) paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t")), collapse = ""), ""))
}
.pf_cat <- function(cats) {
  p <- seq_along(cats); p <- p / sum(p)
  preparar_categorica(cats, p, paste0(round(100 * p), "%"), NULL)
}
.pf_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("sin estilo, la pregunta de panel sigue a 13 pt y a la izquierda; con él, a 16 pt y centrada con su caja más alta", {
  lz <- .lam_lienzo()
  y1 <- .lam_panel_titulo(lz, 0.5, 1, 4, "¿Cuál es su género?")
  y2 <- .lam_panel_titulo(lz, 0.5, 3, 4, "¿Cuál es su género?", size = .std_comp("perfil", "titulo_pt"), align = "center")
  expect_equal(y1, 1.3)                                      # la caja del recetario, intacta
  expect_equal(y2 - 3, 0.3 * .std_comp("perfil", "titulo_pt") / .std_pt("pregunta"), tolerance = 1e-9)
  expect_equal(.lam_perfil_dy("¿Cuál es su género?", 4, .lam_perfil_estilo()), y2 - 3 - 0.3, tolerance = 1e-9)
})

test_that("la lámina de perfil de cinco paneles: preguntas a 16 pt centradas, rótulos a un tamaño y barras sobre el piso", {
  skip_if_not_installed("officer"); skip_if_not_installed("xml2")
  e <- list(.pf_cat(c("Masculino", "Femenino", "Prefiero no responder")), .pf_cat(c("Tiempo parcial por asignaturas (TPA)", "Tiempo completo (TC)")),
            .pf_cat(c("Magíster", "Licenciado(a)", "Bachiller", "Doctor(a)")), .pf_cat(c("24 a 35 años", "36 a 45 años", "46 a 55 años", "56 años a más")),
            .pf_cat(c("Contratado", "Jefe de Práctica", "Auxiliar")))
  preg <- list("¿Cuál es su género?", "¿Cuál es su dedicación en la universidad?", "¿Cuál es su mayor grado académico alcanzado?",
               "Rangos de edad", "¿Cuál es su categoría académica?")
  doc <- .lam_laminas_mixta(.pf_doc(), e, "poblacion_5", preguntas = preg, publicos = vector("list", 5), titulo = "PERFIL DEL DOCENTE",
                            base = "Base: 115 docentes", folio = 5L)$doc
  xml <- .pf_xml(doc)
  pq <- .pf_cajas(xml, "panel:pregunta")
  expect_identical(pq$txt, unlist(preg))                    # los textos no cambian
  expect_true(all(pq$sz == .std_comp("perfil", "titulo_pt"))); expect_true(all(pq$algn == "ctr"))
  rot <- .pf_cajas(xml, "rotulo"); b <- .pf_cajas(xml, "barra")
  expect_equal(nrow(b), 16L)                                 # todo nativo, nada al respaldo
  expect_length(unique(rot$sz), 1L); expect_equal(rot$sz[1], .std_comp("perfil", "rotulo_pt")[[1]])
  expect_true(all(b$h >= .std_piso_panel_in() - 1e-3))     # ítem 18: nunca bajo 0,66 cm
  expect_lte(diff(range(b$h)), 0.005)                        # una sola barra por lámina
  # Ninguna barra se monta sobre la pregunta de su panel ni sobre la barra de abajo.
  for (i in seq_len(nrow(pq))) {
    en <- b[b$x > pq$x[i] & b$x < pq$x[i] + pq$w[i] & b$y > pq$y[i], ]
    en <- en[en$y < min(c(Inf, pq$y[pq$y > pq$y[i] + 0.1])), ]
    expect_gte(min(en$y), pq$y[i] + pq$h[i] - 1e-3)
    ys <- sort(en$y); expect_true(all(diff(ys) >= en$h[1] + .std_comp("perfil", "aire_fila") - 1e-3))
  }
})

test_that("en la cuadrícula, la fila de paneles que no cabe toma el alto que le sobra a la otra y sale nativa", {
  skip_if_not_installed("officer"); skip_if_not_installed("xml2")
  seis <- .pf_cat(c("Masculino", "Femenino", "No binario", "Género Fluido", "Agénero", "Prefiero no responder"))
  e <- list(seis, .pf_cat(c("A", "B")), .pf_cat(c("17 a 18 años", "19 a 21 años", "22 años a más")), .pf_cat(c("Segundo", "Tercero")))
  preg <- list("¿Cuál es su género?", "Pregunta dos", "Rangos de edad", "Pregunta cuatro")
  geo <- .lam_mixta_geo("paneles_4")
  # Con el reparto de hoy el panel de seis categorías no cabe sobre el piso; repartido, sí.
  expect_false(.lam_mixta_cabe(seis, geo$paneles[[1]], preg[[1]], NULL, estilo = .lam_perfil_estilo()))
  plan <- .lam_perfil_plan(e, geo, preg, vector("list", 4), rep(FALSE, 4))
  expect_true(all(plan$caben))
  expect_gt(plan$geo$paneles[[1]]$h, geo$paneles[[1]]$h)
  expect_equal(plan$geo$paneles[[1]]$h + plan$geo$paneles[[3]]$h, geo$paneles[[1]]$h + geo$paneles[[3]]$h, tolerance = 1e-9)
  h <- Filter(function(f) identical(f$tipo, "h"), plan$geo$filetes)[[1]]
  expect_gt(h$y, plan$geo$paneles[[1]]$y + plan$geo$paneles[[1]]$h); expect_lt(h$y, plan$geo$paneles[[3]]$y)
  doc <- .lam_laminas_mixta(.pf_doc(), e, "paneles_4", preguntas = preg, publicos = vector("list", 4), titulo = "PERFIL", folio = 6L)$doc
  b <- .pf_cajas(.pf_xml(doc), "barra")
  expect_equal(nrow(b), 13L)                                 # 6 + 2 + 3 + 2: los cuatro en barras, ninguno al respaldo
  expect_true(all(b$h >= .std_piso_panel_in() - 1e-3))
})
