# Revisión del PPT v7.23 de CCSS Perfil del estudiante 2026 (Gonzalo, 2026-11-05): ítems de motor 1, 5, 6, 7, 8, 9, 11 y 12.
# Todo es presentación: ninguna prueba cambia cifras, n, porcentajes ni tarjetas.

.v723_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.v723_xml <- function(doc, k = length(doc)) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
}
.v723_cajas <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
             texto = xml2::xml_text(sp), stringsAsFactors = FALSE)
}
.v723_genero <- function() preparar_categorica(c("Femenino", "Masculino", "No binario", "Prefiero no responder"),
                                               c(212, 183, 4, 1) / 400, c("53%", "46%", "1%", "0%"), c(212, 183, 4, 1),
                                               sin_ceros = FALSE)   # como la arma el plan: la categoría con casos se conserva
.v723_tarjeta <- function(fila, grupos) {
  list(cruce = "nivel_curricular", fila = fila, total = 81, cifra_total = "81%", fragil = TRUE, brecha = 20,
       grupos = data.frame(codigo = as.character(seq_along(grupos)), etiqueta = grupos, p = seq(90, 60, length.out = length(grupos)),
                           dir = rep(c("up", "down"), length.out = length(grupos)), fragil = TRUE, stringsAsFactors = FALSE))
}
.v723_escala <- function(premisas) {
  niv <- c(t1 = "Nunca", t2 = "A veces", t3 = "Siempre")
  df <- data.frame(item = premisas, N = 400, t1 = .2, t2 = .3, t3 = .5, stringsAsFactors = FALSE)
  preparar_escala(df, "item", "N", names(niv), niv)
}

# ---- Ítem 1 (lámina 8): «Prefiero no responder» con 1 caso de 400 dice «<1%», también en la lámina de dos gráficos ----

test_that("v7.23 ítem 1: la espec de un panel de varios gráficos escribe «<1%» donde hay casos, sin tocar valores", {
  p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- .v723_genero()
  e <- .lam_espec_de(p)
  expect_identical(e$cifras, c("53%", "46%", "1%", "<1%"))
  expect_equal(e$valores, .v723_genero()$valores)                      # sólo el texto de la cifra
  attr(p, "pulso_espec") <- e
  expect_identical(.lam_espec_de(p)$cifras, e$cifras)                  # idempotente
  e0 <- preparar_categorica(c("A", "B"), c(1, 0), c("100%", "0%"), c(400, 0), sin_ceros = FALSE)
  attr(p, "pulso_espec") <- e0
  expect_identical(.lam_espec_de(p)$cifras, c("100%", "0%"))           # sin casos sigue «0%»
})

test_that("v7.23 ítem 1: la lámina de dos gráficos dibuja «<1%» y la figura del Word también", {
  p <- ggplot2::ggplot(); attr(p, "pulso_espec") <- .v723_genero()
  especs <- list(.lam_espec_de(p), .lam_espec_de(p))
  o <- .lam_laminas_mixta(.v723_doc(), especs, "graficos_2", preguntas = list("Género", "Género"), titulo = "Sexo y género", folio = 8)
  cif <- .v723_cajas(.v723_xml(o$doc), "cifra")$texto
  expect_true("<1%" %in% cif); expect_false("0%" %in% cif)
  b <- suppressWarnings(ggplot2::ggplot_build(.word_g_barras(.v723_genero())))
  etiquetas <- unlist(lapply(Filter(function(d) "label" %in% names(d), b$data), `[[`, "label"))
  expect_true("<1%" %in% etiquetas); expect_false("0%" %in% etiquetas)
})

# ---- Ítem 5 (lámina 17): el «N respuestas» de un panel sólo si difiere de la base de la lámina --------------------------

test_that("v7.23 ítem 5: la base principal es el número que sigue a «Base:»", {
  expect_equal(.lam_base_principal_n("Base: 400 estudiantes de sexto a noveno nivel curricular."), 400)
  expect_equal(.lam_base_principal_n("Base: 1,234 estudiantes"), 1234)
  expect_equal(.lam_base_principal_n("Estudiantes de 6.º a 9.º: 400"), 6)   # sin «Base:», el primer número de la frase
  expect_true(is.na(.lam_base_principal_n(NULL))); expect_true(is.na(.lam_base_principal_n("Base: estudiantes")))
})

test_that("v7.23 ítem 5: el panel con el n de la base no lo repite; el que difiere (55) conserva su subtítulo", {
  e400 <- preparar_categorica(c("A", "B"), c(.6, .4), c("60%", "40%"), c(240, 160))
  e55 <- preparar_categorica(c("C", "D"), c(.6, .4), c("60%", "40%"), c(33, 22))
  pub <- .lam_mixta_encabezados(list(e400, e55))$publicos
  expect_identical(pub, list("400 respuestas", "55 respuestas"))
  q <- .lam_mixta_publicos_sin_base(pub, list(e400, e55), "Base: 400 estudiantes de sexto a noveno nivel curricular.")
  expect_null(q[[1]]); expect_identical(q[[2]], "55 respuestas")
  expect_identical(.lam_mixta_publicos_sin_base(pub, list(e400, e55), NULL), pub)   # sin base, nada cambia
  expect_identical(.lam_mixta_publicos_sin_base(pub, list(e400, e55), "Base: 140 estudiantes que trabajan"), pub)
})

test_that("v7.23 ítem 5: la base automática se queda con la principal si los gráficos son del mismo público", {
  bases <- c("Base: 400 estudiantes de sexto a noveno nivel curricular.", "Base: 55 estudiantes criados por otra persona adulta.")
  e <- list(list(tipo = "categorica"), list(tipo = "categorica"))
  expect_identical(.lam_mixta_solo_base_principal(bases, e, list(list(var = "A9"), list(var = "A9_otro"))), bases[1])
  # Públicos distintos (docentes y estudiantes): el panel sólo dice «N respuestas», las bases se conservan todas.
  dos <- c("Base: 52 docentes", "Base: 400 estudiantes")
  expect_identical(.lam_mixta_solo_base_principal(dos, e, list(list(var = "docentes$p1"), list(var = "estudiantes$p1"))), dos)
})

# ---- Ítem 6 (lámina 26): tarjetas de una misma fila con el mismo alto --------------------------------------------------

test_that("v7.23 ítem 6: las tarjetas de las dos mitades toman el alto de la más alta de su fila", {
  t3 <- list(tarjetas = list(.v723_tarjeta("4 o más veces", c("Nivel 6", "Nivel 7", "Nivel 9"))), tipo = "opcion_unica",
             opcion = list(cortos = character(0)))
  t2 <- list(tarjetas = list(.v723_tarjeta("4 o más veces", c("Econ.", "CC. Pol."))), tipo = "opcion_unica", opcion = list(cortos = character(0)))
  op <- options(prosecnur.lam_tarjeta_compacta = TRUE); on.exit(options(op))
  a3 <- .lam_tarjeta_alto(t3$tarjetas[[1]], 2.8, tipo = "opcion_unica"); a2 <- .lam_tarjeta_alto(t2$tarjetas[[1]], 2.8, tipo = "opcion_unica")
  expect_gt(a3, a2)                                                    # de verdad miden distinto
  h <- .lam_tarjetas_ranuras_altos_fila(list(t3, t2), 2.8)
  expect_equal(h, c(a3, a3))
  expect_equal(.lam_tarjetas_ranuras_altos_fila(list(t3, t2), 2.8, debajo = c(FALSE, TRUE)), c(a3, a2))   # pegada a su barra: su propia fila
  expect_equal(.lam_tarjetas_ranuras_altos_fila(list(t3, NULL), 2.8), c(a3, 0))
})

# ---- Ítem 7 (lámina 30) e ítem 12 (lámina 46): la batería con tarjetas -------------------------------------------------

test_that("v7.23 ítem 7: con tarjetas cada premisa va encima de su barra y la barra arranca en el borde de la premisa", {
  e <- .v723_escala(c("ChatGPT", "Claude", "Otras herramientas de IA generativa (Copilot, DeepSeek, Perplexity, entre otras)."))
  expect_true(.lam_escala_arriba_aplica(e))
  op <- options(prosecnur.lam_reserva_derecha = 3.6); on.exit(options(op))
  lz <- .lam_lienzo()
  .lam_bloque_escala_arriba(lz, e, .lam_escala_premisas(e))
  doc <- .lam_agrupar(officer::add_slide(.v723_doc(), layout = "Graficos2", master = "Office Theme"), lz, nombre = "prosecnur:grafico:escala")
  xml <- .v723_xml(doc)
  prem <- .v723_cajas(xml, "premisa"); seg <- .v723_cajas(xml, "segmento")
  expect_equal(nrow(prem), 3L)
  L <- .std_geom("likert")
  expect_equal(min(seg$x), L$x_premisa, tolerance = 1e-3)              # la barra usa la columna de premisas
  filas <- sort(unique(round(seg$y, 3)))
  expect_length(filas, 3L)
  prem <- prem[order(prem$y), ]
  expect_true(all(prem$y + prem$h <= filas + 1e-3))                    # cada premisa termina antes de su barra
  expect_true(all(prem$y[-1] >= filas[-3]))                            # y empieza después de la barra anterior
  expect_true(all(seg$x + seg$w <= .std_geom("ancho") - .std_geom("margen_der") + 1e-3))   # no entra al panel de tarjetas
  ley <- .v723_cajas(xml, "leyenda:cuadro")
  expect_true(all(ley$y > max(seg$y + seg$h)))                         # la leyenda, bajo las barras
})

test_that("v7.23 ítems 7 y 12: sólo la parte con tarjetas reserva el panel y lleva la premisa encima", {
  op <- options(prosecnur.lam_escala_tarjetas = list(filas = "Claude", reserva = 3.6, arriba = TRUE)); on.exit(options(op))
  e <- .v723_escala(c("ChatGPT", "Claude", "Gemini"))
  pr <- .lam_escala_premisas(e)
  expect_identical(.lam_escala_tarjetas_parte(pr), list(arriba = TRUE, reserva = 3.6))
  expect_identical(.lam_escala_tarjetas_parte(pr[1]), list(arriba = FALSE, reserva = 0))    # ítem 12: sin tarjetas, a todo el ancho
  options(prosecnur.lam_escala_tarjetas = list(filas = "Claude", reserva = 3.6, arriba = FALSE))
  expect_identical(.lam_escala_tarjetas_parte(pr), list(arriba = FALSE, reserva = 3.6))
  options(prosecnur.lam_escala_tarjetas = NULL)
  expect_null(.lam_escala_tarjetas_parte(pr))                                                # sin tarjetas en la lámina: como siempre
})

test_that("v7.23 ítem 12: la lámina de la escala sin tarjetas no reserva la columna de tarjetas aunque otra parte sí", {
  e <- .v723_escala(c("ChatGPT", "Claude", "Gemini"))
  fin_barras <- function(opcion) {
    op <- options(prosecnur.lam_reserva_derecha = 3.6, prosecnur.lam_escala_tarjetas = opcion); on.exit(options(op))
    o <- .lam_laminas_escala(.v723_doc(), e, "IA", base = "Base: 400", folio = 1)
    s <- .v723_cajas(.v723_xml(o$doc), "segmento"); max(s$x + s$w)
  }
  sin <- fin_barras(list(filas = "Perplexity", reserva = 3.6, arriba = TRUE))   # la tarjeta es de otra parte
  con <- fin_barras(list(filas = "Claude", reserva = 3.6, arriba = TRUE))
  op <- options(prosecnur.lam_reserva_derecha = 0); on.exit(options(op))
  libre <- max(.v723_cajas(.v723_xml(.lam_laminas_escala(.v723_doc(), e, "IA", base = "Base: 400", folio = 1)$doc), "segmento")[, c("x", "w")] |> rowSums())
  expect_equal(sin, libre, tolerance = 1e-3)
  expect_lt(con, libre - 2)
})

test_that("v7.23 ítem 7: la fila de una premisa encima de su barra es la de abajo, no la barra anterior más cercana", {
  prem <- data.frame(y = c(1.0, 2.0), h = c(0.3, 0.3)); prem$yc <- prem$y + prem$h / 2
  filas <- c(1.5, 2.48)                                                 # la barra de la primera queda más cerca del texto de la segunda
  expect_identical(.lam_fila_de_premisa(prem, filas), c(1L, 2L))
  prem$y_ancla <- filas
  expect_equal(.lam_premisa_arriba_a_su_fila(prem)$yc, filas)
  junto <- data.frame(y = 1.3, h = 0.6, yc = 1.6, y_ancla = 1.6)          # la batería de siempre: la premisa cruza su fila
  expect_equal(.lam_premisa_arriba_a_su_fila(junto)$yc, 1.6)
})

# ---- Ítem 8 (lámina 32): la pista gris en toda barra de una serie, PPT y Word ---------------------------------------------

test_that("v7.23 ítem 8: una agrupada con eje libre también lleva su pista, en la lámina y en el Word", {
  e <- preparar_categorica(c("Cumplo", "Responsable", "Me cuesta", "Depende"), c(.59, .24, .11, .06), c("59%", "24%", "11%", "6%"))
  e$escala_completa <- FALSE                                            # eje libre (`usar_eje_libre`)
  expect_true(.lam_barras_pista_activa(e))
  lz <- .lam_lienzo(); .lam_barras_h(lz, e, 0.5, 2, 12, wlab = 3, g = 0.3, fila = 0.6)
  nombres <- regmatches(unlist(lz$formas), regexpr('name="[^"]+"', unlist(lz$formas)))
  expect_equal(sum(nombres == 'name="barra:pista"'), 4L)
  g <- .word_g_barras(e)
  expect_true(any(vapply(g$layers, function(l) inherits(l$geom, "GeomRect") && identical(l$aes_params$fill, .lam_barras_pista_color()), TRUE)))
  e$pista <- "nunca"
  expect_false(.lam_barras_pista_activa(e))                             # el mando la sigue apagando
})

# ---- Ítem 9 (lámina 37): la guía de la tarjeta aunque una categoría no dibuje barra ------------------------------------

test_that("v7.23 ítem 9: las filas se encuentran aunque una categoría de largo cero no dibuje su barra", {
  rot <- data.frame(texto = c("Seminarios", "Coloquios", "No responde"), x = 0.5, y = c(1.0, 1.6, 2.2), w = 3, h = 0.4)
  pista <- data.frame(texto = "", x = 3.6, y = c(1.05, 1.65, 2.25), w = 5, h = 0.3)
  bar <- pista[1:2, ]; bar$w <- c(2.1, 1.5)                             # «No responde» (<1%) sin barra
  cif <- data.frame(texto = c("43%", "31%", "<1%"), x = c(5.75, 5.15, 3.64), y = c(1.05, 1.65, 2.25), w = 0.8, h = 0.3)
  f <- .lam_tarjetas_filas_por_altura(rot, bar, pista, cif)
  expect_equal(nrow(f), 3L)
  expect_equal(f$yc, rot$y + rot$h / 2, tolerance = 1e-9)
  expect_gt(f$fin[3], 3.64)                                             # la fila sin barra ancla en su cifra
  expect_gt(f$fin[1], 3.6 + 2.1)
  expect_null(.lam_tarjetas_filas_por_altura(rot, bar[0, ], NULL, NULL))   # sin ninguna fila dibujada no hay guía
})

# ---- Ítem 11 (lámina 44): ninguna franja dicotómica en el mazo ---------------------------------------------------------

test_that("v7.23 ítem 11: la Sí/No de una ranura de dos gráficos es una barra apilada clásica con su leyenda", {
  sn <- preparar_categorica(c("Sí", "No"), c(.28, .72), c("28%", "72%"), c(112, 288))
  ot <- preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"))
  o <- .lam_laminas_mixta(.v723_doc(), list(ot, sn), "graficos_2", preguntas = list("Motivos", "Experiencia vinculada"), titulo = "Trabajo", folio = 44)
  xml <- .v723_xml(o$doc)
  expect_equal(nrow(.v723_cajas(xml, "dicotomia:segmento")), 0L)
  expect_equal(nrow(.v723_cajas(xml, "dicotomia:cifra")), 0L)
  seg <- .v723_cajas(xml, "barra:segmento"); cif <- .v723_cajas(xml, "barra:cifra")
  expect_equal(nrow(seg), 2L)
  expect_setequal(cif$texto, c("28%", "72%"))
  expect_true(all(cif$y >= min(seg$y) - 1e-3 & cif$y + cif$h <= max(seg$y + seg$h) + 1e-3))   # cifras dentro
  expect_true(all(c("Sí", "No") %in% .v723_cajas(xml, "leyenda:texto")$texto))
})

test_that("v7.23 ítem 11: la pregunta filtro Sí/No con su subpregunta debajo tampoco es franja partida", {
  f <- preparar_categorica(c("Sí", "No"), c(.35, .65), c("35%", "65%"), c(140, 260))
  s <- preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"))
  espec <- list(filtro = f, sub = s, habilita = "Sí", disposicion = "abajo", pregunta_filtro = "¿Trabajas?", pregunta_sub = "¿Por qué?",
                n_filtro = 400, n_sub = 140, rotulo = "Sí")
  o <- suppressWarnings(.lam_laminas_filtro_sub(.v723_doc(), espec, "Trabajo", folio = 1))
  xml <- .v723_xml(o$doc)
  expect_equal(nrow(.v723_cajas(xml, "dicotomia:segmento")), 0L)
  expect_equal(nrow(.v723_cajas(xml, "barra:segmento")), 2L)
})
