# Los cinco gráficos del resumen ejecutivo de Arte y Diseño FG 2026, nativos del motor (ADR 0134).

.re_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.re_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }
.re_sp <- function(xml, n) xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))
.re_txt <- function(xml, n) xml2::xml_text(.re_sp(xml, n))
.re_x <- function(xml, n) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm", n))
  data.frame(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "x")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cx")) / 914400)
}
.re_geom <- function(xml, n) xml2::xml_attr(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]//a:prstGeom", n)), "prst")

.re_publicos <- function() {
  ejes <- c("Reglamentos se aplican", "Docentes actualizados", "Servicio de salud", "Autoridades accesibles")
  d <- rbind(data.frame(eje = ejes, grupo = "Estudiantes", valor = c(76, 92, 83, 80), n_casos = 279),
             data.frame(eje = ejes, grupo = "Docentes", valor = c(49, 66, 62, 90), n_casos = 115))
  d$grupo <- factor(d$grupo, levels = c("Estudiantes", "Docentes"))
  d
}

# ---- 1. Comparación de dos públicos ------------------------------------------

test_that("el contraste de dos públicos resta el primero menos el segundo, ordena por diferencia y escribe n (cobertura %)", {
  p <- graficar_dumbbell(.re_publicos(), estilo = "resumen", universos = "Docentes: 123; Estudiantes: 327")
  e <- attr(p, "pulso_espec")
  expect_identical(e$version, "contraste/1"); expect_identical(e$modo, "par")
  expect_identical(e$rotulos, c("Reglamentos se aplican", "Docentes actualizados", "Servicio de salud", "Autoridades accesibles"))
  expect_identical(e$textos_diferencia, c("+27", "+26", "+21", "-10"))
  expect_identical(e$bases[1, ], c("279 (85%)", "115 (93%)"))
  expect_identical(e$formas, c("ellipse", "rect"))                         # se distinguen impresos en blanco y negro
  expect_identical(e$colores, unname(.std_paleta("actores"))[c(2, 1)])   # cada público con su color
  expect_identical(e$sentido_diferencia, "Estudiantes menos Docentes")   # D6: en palabras
})

test_that("la base va al pie, abajo a la izquierda, y la tabla queda sólo con la diferencia", {
  e <- attr(graficar_dumbbell(.re_publicos(), estilo = "resumen", universos = "Docentes: 123; Estudiantes: 327"), "pulso_espec")
  expect_identical(e$base_en, "nota")
  expect_identical(e$nota_base, "Base: Estudiantes 279 (85%); Docentes 115 (93%)")
  expect_identical(e$leyenda, c("Estudiantes", "Docentes"))
  xml <- .re_xml(.lam_laminas_contraste(.re_doc(), e, "Docentes y estudiantes", base = "Top Two Box", folio = 6)$doc)
  expect_identical(.re_txt(xml, "tabla:encabezado"), "Diferencia")       # sin columnas de base
  expect_length(.re_sp(xml, "puntos:base"), 0L)
  expect_match(.re_txt(xml, "Base lamina"), "^Base: Estudiantes 279 \\(85%\\); Docentes 115 \\(93%\\)\\. Top Two Box")
  # Si la base cambia de fila a fila (una pregunta filtrada), el pie da su rango; nunca abre columnas por su cuenta.
  d <- .re_publicos(); d$n_casos[1] <- 200
  ed <- attr(graficar_dumbbell(d, estilo = "resumen", universos = "Docentes: 123; Estudiantes: 327"), "pulso_espec")
  expect_identical(ed$base_en, "nota")
  expect_identical(ed$nota_base, "Base: Estudiantes 200 a 279 (61% a 85%); Docentes 115 (93%)")
  # La leyenda sigue disponible si se pide y la base es la misma en todas las filas.
  el <- attr(graficar_dumbbell(.re_publicos(), estilo = "resumen", universos = "Docentes: 123; Estudiantes: 327", base_en = "leyenda"), "pulso_espec")
  expect_identical(el$leyenda, c("Estudiantes (n = 279, 85%)", "Docentes (n = 115, 93%)"))
  expect_identical(attr(graficar_dumbbell(d, estilo = "resumen", base_en = "leyenda"), "pulso_espec")$base_en, "nota")
})

test_that("la lámina del contraste pone la tabla de Diferencia y Base fuera del área de puntos, con encabezados", {
  e <- attr(graficar_dumbbell(.re_publicos(), estilo = "resumen", universos = "Docentes: 123; Estudiantes: 327", base_en = "tabla"), "pulso_espec")
  expect_true(.lam_contraste_cabe(e))
  xml <- .re_xml(.lam_laminas_contraste(.re_doc(), e, "Docentes y estudiantes", folio = 6)$doc)
  expect_setequal(.re_txt(xml, "tabla:encabezado"), c("Diferencia", "Base", "Estudiantes", "Docentes"))
  expect_identical(.re_txt(xml, "puntos:diferencia"), c("+27", "+26", "+21", "-10"))
  marcas <- .re_x(xml, "puntos:marca"); dif <- .re_x(xml, "puntos:diferencia")
  expect_true(max(marcas$x + marcas$w) < min(dif$x))                      # ningún punto invade la tabla
  expect_setequal(unique(.re_geom(xml, "puntos:marca")), c("ellipse", "rect"))
  expect_length(.re_sp(xml, "puntos:banda"), 0L)                          # P10: sin bandas alternas, todo transparente
  # Quién menos quién va al analista, no al pie (Gonzalo, 2026-11-09; lamina_pie_resumen.R).
  expect_false(grepl("Estudiantes menos Docentes", paste(.re_txt(xml, "Base lamina"), collapse = " "), fixed = TRUE))
  expect_message(.lam_laminas_contraste(.re_doc(), e, "Docentes y estudiantes", folio = 6), "Estudiantes menos Docentes", fixed = TRUE)
})

test_that("sin padrón, o con uno menor que los casos, la base va sólo con n (no se inventa cobertura)", {
  e <- attr(graficar_dumbbell(.re_publicos(), estilo = "resumen", universos = list(Docentes = 100)), "pulso_espec")
  expect_identical(e$bases[1, ], c("279", "115"))
  expect_identical(.contraste_base_texto(24, NA_real_), "24")
  expect_identical(.contraste_base_texto(139, 162), "139 (86%)")
})

test_that("el recetario sigue siendo el estilo por defecto (láminas 85 y 86)", {
  expect_identical(attr(graficar_dumbbell(.re_publicos()), "pulso_espec")$tipo, "pesas")
})

# ---- 2. Aperturas internas ---------------------------------------------------

test_that("con tres grupos cada pregunta lleva una sub-fila por grupo y la diferencia es el mayor menos el menor", {
  d <- data.frame(eje = rep(c("Dotación de recursos", "Servicio de salud"), 3), grupo = rep(c("2do", "3er", "4to"), each = 2),
                  valor = c(70, 85, 64, 96, 53, 79), n_casos = c(139, 139, 25, 25, 115, 115))
  d$grupo <- factor(d$grupo, levels = c("2do", "3er", "4to"))
  e <- attr(graficar_dumbbell(d, estilo = "resumen", orden = "declarado"), "pulso_espec")
  expect_identical(e$modo, "subfilas"); expect_identical(e$formas, c("ellipse", "rect", "triangle"))
  expect_identical(e$textos_diferencia, c("17", "17"))
  expect_identical(e$bases[1, ], c("139", "25", "115"))                    # sin padrón del subgrupo: sólo n
  expect_identical(e$nota_base, "Base: 2do 139; 3er 25; 4to 115")
  expect_identical(e$colores, unname(.std_paleta("grupos"))[1:3])
  xml <- .re_xml(.lam_laminas_contraste(.re_doc(), e, "Por ciclo", folio = 9)$doc)
  expect_length(.re_sp(xml, "puntos:marca"), 6L)
  expect_identical(.re_txt(xml, "puntos:cifra"), c("70", "64", "53", "85", "96", "79"))
  expect_true(.lam_contraste_cabe(e))
})

test_that("con tres o cuatro grupos el recetario se dibuja como el contraste; con cinco, sigue pidiendo dos", {
  # Gonzalo, 2026-11-09 (test-dumbbell-tres-grupos.R): el dumbbell con tres o cuatro grupos lleva una sub-fila por grupo.
  d <- data.frame(eje = "a", grupo = c("x", "y", "z"), valor = c(1, 2, 3))
  expect_identical(attr(graficar_dumbbell(d), "pulso_espec")$tipo, "contraste")
  expect_s3_class(graficar_dumbbell(d, estilo = "resumen"), "ggplot")
  expect_error(graficar_dumbbell(data.frame(eje = "a", grupo = letters[1:5], valor = 1:5)), "de dos a 4 grupos y llegaron 5")   # P6
  expect_identical(p_dumbbell(vars = list("b$p1"), corte = "4", cruce = "b$c", grupos = c("1", "2", "3"))$grupos, c("1", "2", "3"))
  expect_error(p_dumbbell(vars = list("b$p1"), corte = "4", cruce = "b$c", grupos = as.character(1:5)), "entre dos y cuatro")
  el <- p_dumbbell(vars = list("b$p1"), corte = "4", cruce = "b$c", grupos = c("1", "2", "3"), estilo = "resumen",
                   universos = "1: 20", separar_tras = 0)
  expect_identical(el$overrides$estilo, "resumen"); expect_identical(el$overrides$universos, "1: 20")
  expect_null(el$overrides$separar_tras)                                   # 0 = sin separador
})

# ---- 3. Panorama -------------------------------------------------------------

test_that("el panorama da la mediana y cuántas preguntas quedan bajo la referencia, con puntos deterministas", {
  d <- data.frame(publico = factor(rep(c("Estudiantes", "Docentes"), c(5, 4)), levels = c("Estudiantes", "Docentes")),
                  item = paste0("p", 1:9), valor = c(84, 90, 58, 77, 95, 73, 40, 59.6, 80))
  e <- attr(graficar_panorama(d), "pulso_espec")
  expect_identical(e$version, "panorama/1")
  expect_identical(e$textos_mediana, c("84%", "67%"))                    # 40, 60, 73, 80: 66.5 sube; 59.6 se lee 60, no queda bajo 60
  expect_identical(e$textos_bajo, c("1 de 5", "1 de 4"))
  expect_identical(e$encabezado_bajo, "Bajo 60%")
  expect_identical(e$desplazamientos, attr(graficar_panorama(d), "pulso_espec")$desplazamientos)
  expect_true(all(abs(unlist(e$desplazamientos)) <= 0.5))
  xml <- .re_xml(.lam_laminas_panorama(.re_doc(), e, "Panorama", folio = 3)$doc)
  expect_length(.re_sp(xml, "panorama:punto"), 9L)
  expect_length(.re_sp(xml, "panorama:mediana"), 2L)
  expect_true(any(grepl("prstDash", as.character(.re_sp(xml, "panorama:referencia")))))
  expect_false(any(grepl("cr[ií]tico", tolower(xml2::xml_text(xml)))))     # no se rotula ningún tramo crítico
  expect_setequal(.re_txt(xml, "tabla:encabezado"), c("Mediana", "Bajo 60%"))
})

test_that("p_panorama exige referencias calificadas y un corte", {
  expect_error(p_panorama(vars = "p1", corte = "4"), "base\\$variable")
  expect_error(p_panorama(vars = "b$*", corte = NULL), "corte")
  el <- p_panorama(vars = c("est$*", "doc$p1"), corte = c("4", "5"), referencia = 70)
  expect_identical(el$.element_type, "panorama"); expect_identical(el$corte, "4,5"); expect_identical(el$overrides$referencia, 70)
})

test_that("base$* toma las preguntas de escala con el corte y deja fuera las que no lo son", {
  # Tres preguntas comparten la lista: una batería (ADR 0135, punto 5).
  inst <- list(survey = data.frame(name = c("p1", "p2", "p3", "sexo"), type = c("select_one lk", "select_one lk", "select_one lk", "select_one sx"),
                                   label = c("Uno", "Dos", "Tres", "Sexo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lk", 5), "sx", "sx"), name = c(1:5, 1:2), label = c("TD", "D", "A", "TA", "SI", "H", "M"),
                                    stringsAsFactors = FALSE))
  datos <- data.frame(p1 = c("4", "5", "1", "2"), p2 = c("5", "5", "4", "1"), p3 = c("1", "1", "1", "4"), sexo = c("1", "2", "1", "2"),
                      stringsAsFactors = FALSE)
  src <- list(data_sources = list(est = datos), inst_sources = list(est = inst))
  d <- .panorama_datos("est$*", c("4", "5"), src)
  expect_identical(as.character(d$item), c("p1", "p2", "p3"))
  expect_equal(d$valor, c(50, 75, 25))
  expect_identical(levels(d$publico), "Est")
})

# ---- 4. Escala con Sin información aparte ------------------------------------

.re_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "Sin información")
.re_escala <- function() data.frame(it = c("Reglamentos (Doc.)", "Investigación (Doc.)", "Estatuto (Doc.)"),
                                    t1 = c(3, 3, 2), t2 = c(10, 38, 4), t3 = c(34, 23, 55), t4 = c(15, 5, 13), t5 = c(38, 30, 26))

test_that("la escala del resumen ordena por Sin información y usa la paleta Likert del estándar", {
  e <- attr(graficar_barras_divergentes(.re_escala(), "it", names(.re_niv), .re_niv, n_negativas = 2, incluir_neutro = FALSE,
                                        estilo = "resumen", orden = "sin_informacion"), "pulso_espec")
  expect_identical(e$estilo, "resumen")
  expect_identical(e$filas, c("Reglamentos (Doc.)", "Investigación (Doc.)", "Estatuto (Doc.)"))
  expect_identical(toupper(e$categorias$color), toupper(unname(.std_paleta("likert"))))
  expect_identical(e$categorias$col[e$orden_neg], c("t2", "t1"))          # «En desacuerdo» pegado al centro
  e2 <- attr(graficar_barras_divergentes(.re_escala(), "it", names(.re_niv), .re_niv, n_negativas = 2, incluir_neutro = FALSE), "pulso_espec")
  expect_identical(e2$estilo, "recetario"); expect_identical(e2$filas[1], "Estatuto (Doc.)")   # por acuerdo, como siempre
})

test_that("en la lámina del resumen la cifra del extremo que no cabe sale de la barra, la interior encoge y el cero no se pinta", {
  e <- attr(graficar_barras_divergentes(.re_escala(), "it", names(.re_niv), .re_niv, n_negativas = 2, incluir_neutro = FALSE,
                                        estilo = "resumen", orden = "sin_informacion"), "pulso_espec")
  expect_true(.lam_divergentes_cabe(e))
  xml <- .re_xml(.lam_laminas_divergentes(.re_doc(), e, "Información", folio = 5)$doc)
  fuera <- .re_txt(xml, "divergentes:cifra_fuera")
  expect_true(all(c("3%") %in% fuera))                                     # el 3% de Totalmente en desacuerdo
  # Negrita y con el color del segmento oscurecido.
  rpr <- xml2::xml_find_all(.re_sp(xml, "divergentes:cifra_fuera")[1], ".//a:rPr")
  expect_identical(xml2::xml_attr(rpr, "b"), "1")
  expect_identical(xml2::xml_attr(xml2::xml_find_first(rpr, ".//a:srgbClr"), "val"), .lam_hex(.lam_oscurecer(.std_paleta("likert")[1])))
  expect_length(.re_sp(xml, "divergentes:cifra_chica"), 0L)                # P16: la interior que no cabe no se escribe
  seg <- .re_sp(xml, "divergentes:segmento")
  expect_length(seg, 12L)                                                   # 3 filas x 4 niveles; Sin información va aparte
  # Un segmento en cero no se pinta: sin el 2% de Estatuto, su «En desacuerdo» pasa a ser el extremo y su cifra sale.
  d0 <- .re_escala(); d0$t1[3] <- 0; d0$t5[3] <- 28
  e0 <- attr(graficar_barras_divergentes(d0, "it", names(.re_niv), .re_niv, n_negativas = 2, incluir_neutro = FALSE,
                                         estilo = "resumen", orden = "sin_informacion"), "pulso_espec")
  x0 <- .re_xml(.lam_laminas_divergentes(.re_doc(), e0, "Información", folio = 5)$doc)
  expect_length(.re_sp(x0, "divergentes:segmento"), 11L)
  expect_true("4%" %in% .re_txt(x0, "divergentes:cifra_fuera"))
  expect_identical(.re_txt(xml, "divergentes:cifra_sin_inf"), c("38%", "30%", "26%"))
  expect_false(any(c("De acuerdo (Top Two Box)", "Totalmente de acuerdo") %in% .re_txt(xml, "divergentes:encabezado")))
  # La leyenda del desacuerdo termina antes de la línea central y la del acuerdo empieza después.
  cen <- .re_x(xml, "divergentes:centro"); xc <- cen$x + cen$w / 2
  cuadros <- .re_x(xml, "leyenda:cuadro")
  expect_true(all(cuadros$x[1:2] < xc) && all(cuadros$x[3:4] > xc))
})

test_that("p_barras_divergentes sólo escribe estilo y orden si el slot los declara", {
  el <- p_barras_divergentes(vars = c("a", "b"))
  expect_null(el$overrides$estilo); expect_null(el$overrides$orden)
  el2 <- p_barras_divergentes(vars = c("a", "b"), estilo = "resumen", orden = "sin_informacion")
  expect_identical(el2$overrides$estilo, "resumen"); expect_identical(el2$overrides$orden, "sin_informacion")
  expect_error(p_barras_divergentes(vars = "a", estilo = "otro"), "estilo")
})

# ---- 5. Competencias con separador -------------------------------------------

test_that("el separador entre grupos de ítems fija el orden declarado y se dibuja punteado", {
  ejes <- c("Comunicación visual", "Creación", "Ética", "Colaboración")
  d <- rbind(data.frame(eje = ejes, grupo = "Estudiantes", valor = c(94, 96, 85, 90), n_casos = 279),
             data.frame(eje = ejes, grupo = "Docentes", valor = c(90, 92, 70, 84), n_casos = 115))
  d$grupo <- factor(d$grupo, levels = c("Estudiantes", "Docentes"))
  e <- attr(graficar_dumbbell(d, estilo = "resumen", separar_tras = 2), "pulso_espec")
  expect_identical(e$rotulos, ejes)                                         # no se reordena por brecha
  expect_identical(e$separadores, 2L)
  xml <- .re_xml(.lam_laminas_contraste(.re_doc(), e, "Competencias", folio = 7)$doc)
  sep <- .re_sp(xml, "puntos:separador")
  expect_length(sep, 1L)
  expect_identical(xml2::xml_attr(xml2::xml_find_first(sep, ".//a:prstDash"), "val"), "dash")
})

# ---- Registro y ruta real ----------------------------------------------------

test_that("el registro ofrece los estilos y el panorama, con args que son formales del constructor", {
  m <- .GRAFICADORES_META
  nombres <- function(g) vapply(m[[g]]$args, `[[`, "", "name")
  expect_true(all(c("estilo", "universos", "separar_tras", "base_en") %in% nombres("p_dumbbell")))
  expect_true(all(c("estilo", "universos", "separar_tras", "base_en") %in% names(formals(p_dumbbell))))
  expect_true(all(c("estilo", "orden") %in% nombres("p_barras_divergentes")))
  expect_true(all(nombres("p_panorama") %in% names(formals(p_panorama))))
  expect_identical(m$p_panorama$blueprint, "panorama"); expect_true(m$p_panorama$salida_nativa)
})

test_that("en la ruta real el panorama y la escala del resumen salen como láminas nativas", {
  skip_if_not_installed("officer")
  set.seed(7); N <- 80
  dat <- data.frame(a1 = sample(as.character(1:5), N, TRUE), a2 = sample(as.character(1:5), N, TRUE, prob = c(.05, .1, .4, .4, .05)),
                    stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("a1", "a2"), type = c("select_one lk", "select_one lk"), list_name = c("lk", "lk"),
                                   label = c("Afirmación uno", "Afirmación dos"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = rep("lk", 5), name = as.character(1:5), label = unname(.re_niv), stringsAsFactors = FALSE),
               orders_list = NULL, listas_ordinales_declaradas = "lk")   # dos preguntas: la escala la declara el estudio
  plan <- list(a = p_slide_1_grafico(grafico = p_barras_divergentes(vars = c("a1", "a2"), incluir_neutro = FALSE, estilo = "resumen"),
                                     titulo = "Escala"),
               b = p_slide_1_grafico(grafico = p_panorama(vars = "default$*", corte = c("3", "4")), titulo = "Panorama"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  g <- function(k) xml2::xml_attr(xml2::xml_find_all(xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))), "//p:grpSp/p:nvGrpSpPr/p:cNvPr"), "name")
  expect_true("prosecnur:grafico:divergentes" %in% g(1))
  expect_true("prosecnur:grafico:panorama" %in% g(2))
})
