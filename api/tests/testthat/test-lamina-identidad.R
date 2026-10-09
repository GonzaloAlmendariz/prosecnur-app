# Láminas de identidad del recetario (capítulo 1; ADR 0093, N7): separador de capítulo (variante B, láminas 4, 66,
# 116…) y de subcapítulo sobrio (5, 22, 30…).

.id_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.id_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("los separadores se numeran por su orden: capítulos 1, 2… y subcapítulos n.1, n.2… que vuelven a empezar", {
  plan <- list(p_slide_seccion("A"), p_slide_seccion("A1", meta = list(nivel = "subcapitulo")), p_slide_texto("x", texto = "y"),
               p_slide_seccion("B"), p_slide_seccion("B1", meta = list(nivel = "subcapitulo")), p_slide_seccion("B2", meta = list(nivel = "subcapitulo")),
               p_slide_seccion("C", meta = list(numero = "IV", rotulo = "Parte")))
  n <- .lam_secciones_numeradas(plan)
  expect_null(n[[3]])
  expect_identical(vapply(n[-3], `[[`, "", "numero"), c("1", "1.1", "2", "2.1", "2.2", "IV"))
  expect_identical(n[[5]]$capitulo, "B"); expect_identical(n[[7]]$rotulo, "Parte")
  expect_identical(.lam_secciones_numeradas(list(p_slide_seccion("S", meta = list(nivel = "subcapitulo"))))[[1]]$numero, "1")
})

test_that("el capítulo sale con su rótulo, el filete coral, el título y el subtítulo del recetario (66)", {
  lam <- .id_mazo(list(a = p_slide_seccion("Introducción"), b = p_slide_seccion("Tipos de gráficos", "Cada gráfico sobre la lámina estándar")))
  x <- lam[[2]]
  expect_identical(.id_txt(x, "seccion:rotulo"), "CAPÍTULO 2")
  expect_identical(.id_txt(x, "seccion:titulo"), "Tipos de gráficos")
  expect_identical(.id_txt(x, "seccion:subtitulo"), "Cada gráfico sobre la lámina estándar")
  fil <- xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='seccion:filete']]//a:srgbClr")
  expect_identical(xml2::xml_attr(fil, "val"), .lam_hex(.std_color("coral")))
  off <- xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='seccion:titulo']]/p:spPr/a:xfrm/a:off")
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 2.5, tolerance = 0.01)
  expect_equal(as.numeric(xml2::xml_attr(off, "y")) / 914400, 4.42, tolerance = 0.01)
})

test_that("el subcapítulo sobrio lleva la ruta del capítulo y su número en coral (67)", {
  lam <- .id_mazo(list(a = p_slide_seccion("Introducción"), b = p_slide_seccion("Tipos de gráficos"),
                       c = p_slide_seccion("Barras y proporciones", "Categorías y rankings", meta = list(nivel = "subcapitulo"))))
  x <- lam[[3]]
  expect_identical(.id_txt(x, "seccion:ruta"), "CAPÍTULO 2: TIPOS DE GRÁFICOS")
  expect_identical(.id_txt(x, "seccion:numero"), "2.1")
  expect_identical(.id_txt(x, "seccion:titulo"), "Barras y proporciones")
})

test_that("un título que no cabe o motor_nativo = FALSE vuelven al separador de la plantilla", {
  largo <- paste(rep("Un título de capítulo larguísimo", 6), collapse = " ")
  lam <- .id_mazo(list(a = p_slide_seccion(largo), b = p_slide_seccion("Corto", meta = list(motor_nativo = FALSE)), c = p_slide_seccion("Nativo")))
  nativo <- vapply(lam, function(x) "prosecnur:seccion" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"), TRUE)
  expect_identical(nativo, c(FALSE, FALSE, TRUE))
  expect_identical(.id_txt(lam[[3]], "seccion:rotulo"), "CAPÍTULO 3")                        # cuenta aunque los anteriores no salgan nativos
})

test_that("«Cómo leer este informe: Top Two Box» sale como la lámina 19, con la cifra que suma los dos valores superiores", {
  lam <- .id_mazo(list(a = p_slide_top_two_box(), b = p_slide_top_two_box(valores = c(10, 20, 30, 40), texto = "Mi lectura propia."),
                       c = p_slide_top_two_box(meta = list(motor_nativo = FALSE))))
  x <- lam[[1]]
  expect_identical(.id_txt(x, "Titulo lamina"), "Top Two Box")
  expect_identical(.id_txt(x, "Antetitulo lamina"), "CÓMO LEER ESTE INFORME")
  expect_match(.id_txt(x, "ttb:texto"), "^Es la suma de los dos valores superiores")         # el texto del recetario, no el viejo
  expect_identical(.id_txt(x, "ttb:cifra"), "90%"); expect_identical(.id_txt(x, "ttb:suma"), "35% + 55%")
  expect_identical(.id_txt(x, "leyenda:texto"), paste0(1:4, "  ", .std_valor("ppt", "paletas", "likert", "rotulos")[1:4]))
  expect_identical(.id_txt(lam[[2]], "ttb:cifra"), "70%"); expect_identical(.id_txt(lam[[2]], "ttb:texto"), "Mi lectura propia.")
  expect_false("prosecnur:top_two_box" %in% xml2::xml_attr(xml2::xml_find_all(lam[[3]], "//p:cNvPr"), "name"))
  expect_false(.lam_top_two_box_cabe(list(valores = c(10, 20, 30, 40), top_two_indices = c(2, 4))))  # no contiguos: ruta anterior
})

test_that("el redondeo sale en dos láminas como la 20 y la 21, con las mismas cifras del ejemplo y la suma que da cada método", {
  C <- .lam_redondeo_cifras(c(1, 7, 60, 110, 0))
  expect_identical(C$estandar, c(1, 4, 34, 62, 0)); expect_equal(sum(C$estandar), 101)
  expect_identical(C$resultado, c(0, 4, 34, 62, 0)); expect_identical(sort(C$suben), 2:4)
  lam <- .id_mazo(list(a = p_slide_redondeo(casos = c(1, 7, 60, 110, 0), meta = list(metodo = "ambos")), b = p_slide_redondeo(meta = list(metodo = "resto_mayor")),
                       c = p_slide_redondeo(texto = "Mi nota propia.")))
  expect_length(lam, 4L)                                                                      # 2 (pedidas a mano) + 1 + 1 (la del informe)
  expect_identical(.id_txt(lam[[1]], "Titulo lamina"), "Redondeo estándar")
  expect_identical(.id_txt(lam[[2]], "Titulo lamina"), "Redondeo del resto mayor")
  expect_identical(.id_txt(lam[[1]], "Antetitulo lamina"), "CÓMO LEER ESTE INFORME")
  expect_true("101%" %in% .id_txt(lam[[1]], "redondeo:suma"))
  expect_length(xml2::xml_find_all(lam[[2]], "//p:sp[p:nvSpPr/p:cNvPr[@name='redondeo:marca']]"), 6L)   # tres restos × dos filas
  expect_identical(.id_txt(lam[[2]], "Folio lamina"), "2"); expect_identical(.id_txt(lam[[4]], "redondeo:texto"), "Mi nota propia.")
  expect_identical(.id_txt(lam[[2]], "redondeo:nota"), "Faltan tres puntos: van a los tres restos más grandes. El 0.56% queda en 0%.")
  expect_match(.id_txt(lam[[1]], "Base lamina"), "^Ejemplo con 1, 7, 60, 110 y 0 casos de 178$")
  expect_false(.lam_redondeo_cabe(list(casos = c(2, 3), etiquetas = c("Sí", "No"))))        # dos categorías: ruta anterior
})

test_that("el Top Two Box nativo sólo admite 3 a 5 puntos y nombra bien la llave (verificador de N7)", {
  expect_false(.lam_top_two_box_cabe(list(valores = c(5, 10, 15, 20, 25, 25), etiquetas = as.character(1:6), top_two_indices = c(5, 6))))
  lam <- .id_mazo(list(a = p_slide_top_two_box(valores = c(20, 30, 50), etiquetas = as.character(1:3), top_two_indices = c(2, 3)),
                       b = p_slide_top_two_box(valores = c(10, 20, 30, 40), top_two_indices = c(1, 2), texto = "Lectura con **negrita**."),
                       c = p_slide_top_two_box(meta = list(antetitulo = "Guía de lectura"))))
  cols <- xml2::xml_attr(xml2::xml_find_all(lam[[1]], "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]//a:srgbClr"), "val")
  expect_true(all(grepl("^[0-9A-F]{6}$", cols)))
  expect_true(.lam_hex(.std_paleta("likert")[4]) %in% cols)                                   # el positivo, en verde fuerte
  expect_identical(.id_txt(lam[[2]], "ttb:llave_rotulo"), "Los dos valores inferiores")
  b <- xml2::xml_attr(xml2::xml_find_all(lam[[2]], "//p:sp[p:nvSpPr/p:cNvPr[@name='ttb:texto']]//a:rPr"), "b")
  expect_identical(b, c("0", "1", "0"))
  expect_identical(.id_txt(lam[[3]], "Antetitulo lamina"), "GUÍA DE LECTURA")
})

test_that("la lámina de redondeo es la del método que decidió el informe; las dos sólo si usa los dos o se piden", {
  expect_identical(.lam_redondeo_metodo(list(), list()), "estandar")
  pre <- function(m) { p <- list(); for (k in names(.PRESETS_CALCULOS)) p[[k]] <- list(args = list(metodo_redondeo = m)); p }
  expect_identical(.lam_redondeo_metodo(list(), pre("estandar")), "estandar")
  expect_identical(.lam_redondeo_metodo(list(), pre("reparto")), "resto_mayor")
  mixto <- pre("estandar"); mixto[[names(.PRESETS_CALCULOS)[1]]]$args$metodo_redondeo <- "reparto"
  expect_identical(.lam_redondeo_metodo(list(), mixto), "ambos")
  expect_identical(.lam_redondeo_metodo(list(metodo = "resto_mayor"), pre("estandar")), "resto_mayor")
  expect_identical(.lam_redondeo_metodo(list(metodo = "ambos")), "ambos")
})

test_that("la portada sale como la 23 con la plantilla de PULSO; las de cliente conservan la suya", {
  tit <- "Estudio de opinión sobre el servicio educativo ofrecido por la carrera de Contabilidad"
  lam <- .id_mazo(list(a = p_slide_portada(tit, "Informe consolidado", fecha = "Setiembre de 2026", subtexto = "Por encargo de la Facultad"),
                       b = p_slide_portada(paste(rep(tit, 3), collapse = " "))))
  x <- lam[[1]]
  expect_identical(.id_txt(x, "portada:rotulo"), "INFORME CONSOLIDADO")
  expect_identical(.id_txt(x, "portada:titulo"), tit)
  expect_identical(.id_txt(x, "portada:encargo"), "Por encargo de la Facultad")
  expect_identical(.id_txt(x, "portada:fecha"), "Setiembre de 2026")
  expect_false("prosecnur:portada" %in% xml2::xml_attr(xml2::xml_find_all(lam[[2]], "//p:cNvPr"), "name"))   # no cabe: ruta anterior
  expect_true(.lam_plantilla_estandar("/x/plantilla_16_9.pptx"))
  expect_false(.lam_plantilla_estandar("/x/plantilla_acnur_16_9.pptx"))
})

test_that("la lámina de redondeo sólo atiende a las familias que cierran en 100 y declaran método; la nota concuerda (verificador de N7)", {
  expect_identical(.lam_redondeo_metodo(list(), list(multi_apiladas = list(args = list(metodo_redondeo = "reparto")),
                                                      barras_apiladas = list(args = list()), barras_agrupadas = list(args = list()))), "resto_mayor")
  expect_identical(.lam_redondeo_metodo(list(), list(barras_agrupadas = list(args = list(metodo_redondeo = "reparto")))), "estandar")
  expect_message(m <- .lam_redondeo_metodo(list(metodo = "xyz")), "no reconoce"); expect_identical(m, "estandar")
  lam <- .id_mazo(list(a = p_slide_redondeo(casos = c(1, 1, 1, 0), etiquetas = c("A", "B", "C", "D"), meta = list(metodo = "resto_mayor"))))
  expect_identical(.id_txt(lam[[1]], "redondeo:nota"), "Falta un punto: va al resto más grande.")
})

test_that("la ficha técnica sale como la 29: filas con ícono y la muestra por público en cifras con su tasa", {
  ft <- data.frame(criterio = c("Tipo y técnica", "Universo", "Muestra", "Trabajo de campo"),
                   detalle = c("Encuesta por correo.", "Estudiantes y docentes.", "172 estudiantes (96 %), 178 egresados(as) (66 %) y 15 administrativos (94 %).", "Mayo de 2026."))
  lam <- .id_mazo(list(a = p_slide_tabla_tecnica("Ficha técnica cuantitativa", ft),
                       b = p_slide_tabla_tecnica("Larga", data.frame(criterio = paste("Criterio", 1:9), detalle = "x"))))
  x <- lam[[1]]
  expect_identical(.id_txt(x, "ficha:criterio"), ft$criterio)
  expect_identical(.id_txt(x, "ficha:muestra_n"), c("172", "178", "15"))
  expect_identical(.id_txt(x, "ficha:muestra_publico"), c("estudiantes", "egresados(as)", "administrativos"))
  expect_identical(.id_txt(x, "ficha:muestra_tasa"), c("96% de respuesta", "66% de respuesta", "94% de respuesta"))
  expect_length(xml2::xml_find_all(x, "//p:pic"), 4L)                                         # un ícono por fila
  expect_identical(.id_txt(x, "Antetitulo lamina"), "METODOLOGÍA")
  expect_identical(vapply(ft$criterio, .lam_icono_ficha, ""), c("clipboard-list", "users", "hash", "calendar-days"), ignore_attr = TRUE)
  expect_null(.lam_ficha_muestra("Censo de estudiantes."))                                    # sin cifras: va como texto
  expect_false("prosecnur:ficha" %in% xml2::xml_attr(xml2::xml_find_all(lam[[2]], "//p:cNvPr"), "name"))   # nueve filas: ruta anterior
})

test_that("la portada nativa lleva el logo de socio sólo si se declaró uno propio (el de PULSO ya está en la plantilla)", {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  pics <- function(args) {
    pre <- p_presets(); pre$base$args <- utils::modifyList(pre$base$args %||% list(), args)
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, presets = pre, path_ppt = out, mensajes_progreso = FALSE,
                                                       plan = list(a = p_slide_portada("Portada")))))
    length(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")), "//p:pic"))
  }
  socio <- system.file("ppt_assets", "iconos_recetario", "blanco", "globe.png", package = "prosecnurapp")
  expect_equal(pics(list(partner_logo_cover = TRUE)), 0L)
  expect_equal(pics(list(partner_logo_cover = TRUE, partner_logo_cover_path = socio)), 1L)
})

test_that("el objetivo sale como la 26: la diana, el texto con sus temas en negrita y los actores con su ícono", {
  ic <- p_ggplot_raw(ggplot2::ggplot() + ggplot2::theme_void())
  act <- c("Estudiantes", "Docentes", "Egresados", "Personal administrativo", "Comité Consultivo", "Empleadores")
  lam <- .id_mazo(list(a = p_slide_objetivo_icono(ic, "Conocer **la percepción** de la comunidad.", meta = list(actores = act)),
                       b = p_slide_objetivo_icono(ic, "Sin actores.", titulo = "Propósito"),
                       c = p_slide_objetivo_icono(ic, paste(rep("Un objetivo larguísimo que no cabe en cuatro líneas de la lámina.", 8), collapse = " "))))
  x <- lam[[1]]
  expect_identical(.id_txt(x, "objetivo:titulo"), "Objetivo del estudio")
  expect_identical(xml2::xml_attr(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='objetivo:texto']]//a:rPr"), "b"), c("0", "1", "0"))
  expect_identical(.id_txt(x, "objetivo:actor"), act)
  expect_length(xml2::xml_find_all(x, "//p:pic"), 7L)                                         # la diana y seis actores
  expect_identical(vapply(act, .lam_icono_actor, ""), c("graduation-cap", "presentation", "briefcase", "building-2", "users", "briefcase-business"), ignore_attr = TRUE)
  expect_identical(.id_txt(lam[[2]], "objetivo:titulo"), "Propósito")
  expect_length(xml2::xml_find_all(lam[[2]], "//p:sp[p:nvSpPr/p:cNvPr[@name='objetivo:actor']]"), 0L)
  expect_false("prosecnur:objetivo" %in% xml2::xml_attr(xml2::xml_find_all(lam[[3]], "//p:cNvPr"), "name"))
})

test_that("los íconos casan con criterios y actores acentuados en cualquier plataforma (sin iconv)", {
  expect_identical(.lam_clave(c("Técnica", "Población", "Diseño muestral", "Selección", "Comité")),
                   c("tecnica", "poblacion", "diseno muestral", "seleccion", "comite"))
  expect_identical(vapply(c("Técnica", "Población", "Diseño muestral", "Selección", "Ámbito"), .lam_icono_ficha, ""),
                   c("clipboard-list", "users", "shuffle", "shuffle", "map-pin"), ignore_attr = TRUE)
  expect_identical(.lam_icono_actor("Comité Consultivo"), "users")
  expect_identical(.lam_ficha_muestra("1,234 estudiantes (96 %) y 52 docentes (92 %).")$n, c("1,234", "52"))
})

test_that("el objetivo cuenta sus párrafos: siete líneas en párrafos van a la ruta anterior (verificador de N7)", {
  expect_false(.lam_objetivo_cabe(paste(c("Primero.", "Segundo.", "Tercero.", "Cuarto.", "Quinto.", "Sexto.", "Séptimo."), collapse = "\n")))
  expect_true(.lam_objetivo_cabe("Primero.\nSegundo.\nTercero."))
})

test_that("el índice ofrece las cuatro composiciones del recetario y lleva número, ícono y título por capítulo (31-50)", {
  c5 <- c("Perfil del encuestado", "Características institucionales", "Cuerpo académico", "Características del perfil de egreso", "Estudiantes y graduados")
  plan <- lapply(c("arcos", "facetas", "circulos", "bloques"), function(g) p_slide_indice("Índice", secciones = c5, meta = list(composicion = g)))
  plan$e <- p_slide_indice("Índice", secciones = c5, subindices = stats::setNames(list(c("Estudiantes", "Docentes"), "Misión", "Gestión", "Competencias", "Situación laboral"), c5))
  plan$f <- p_slide_indice("Índice", secciones = paste("Capítulo", 1:14))
  lam <- .id_mazo(plan)
  md5 <- vapply(lam[1:4], function(x) {
    n <- xml2::xml_find_first(x, "//p:pic[p:nvPicPr/p:cNvPr[@name='indice:ilustracion']]//a:blip")
    xml2::xml_attr(n, "embed")
  }, "")
  expect_true(all(!is.na(md5)))
  expect_identical(.id_txt(lam[[1]], "indice:capitulo"), c5)
  expect_identical(.id_txt(lam[[1]], "indice:numero"), as.character(1:5))
  expect_length(xml2::xml_find_all(lam[[1]], "//p:pic[p:nvPicPr/p:cNvPr[@name='indice:icono']]"), 5L)
  expect_identical(vapply(c5, .lam_icono_capitulo, ""), c("users", "building-2", "presentation", "award", "briefcase"), ignore_attr = TRUE)
  expect_identical(.id_txt(lam[[5]], "indice:subnumero"), c("1.1", "1.2", "2.1", "3.1", "4.1", "5.1"))
  expect_false("prosecnur:indice" %in% xml2::xml_attr(xml2::xml_find_all(lam[[6]], "//p:cNvPr"), "name"))   # 14 capítulos: ruta anterior
  ilus <- vapply(c("arcos", "facetas", "circulos", "bloques"), function(g) nzchar(system.file("ppt_assets", "indice_geometria", paste0(g, ".png"), package = "prosecnurapp")), TRUE)
  expect_true(all(ilus))
})

test_that("el índice alinea los subcapítulos por nombre y respeta el estilo de focos cuando se pide", {
  subs <- .lam_indice_subs(c("Objetivo", "Metodología"), list("Metodología" = c("Perfil", "Satisfacción")))
  expect_identical(subs, list(character(0), c("Perfil", "Satisfacción")))
  expect_identical(.lam_indice_subs(c("A", "B", "C"), list("x")), list("x", character(0), character(0)))
  expect_true(.lam_indice_focos(list(iconos_focos = "target")))
  expect_true(.lam_indice_focos(list(), list(composicion = "focos")))
  expect_false(.lam_indice_focos(list(), list(composicion = "arcos")))
})

test_that("la portada ofrece sus tres variantes del recetario: centrada (23), izquierda (24) y con banda (25)", {
  pp <- function(v) p_slide_portada("Estudio de opinión", "Informe consolidado", fecha = "Setiembre de 2026", subtexto = "Por encargo", meta = list(variante = v))
  lam <- .id_mazo(list(a = pp("centrada"), b = pp("izquierda"), c = pp("banda")))
  algn <- function(x) xml2::xml_attr(xml2::xml_find_first(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='portada:titulo']]//a:pPr"), "algn")
  expect_identical(vapply(lam, algn, ""), c("ctr", "l", "ctr"))
  expect_true("portada:banda" %in% xml2::xml_attr(xml2::xml_find_all(lam[[3]], "//p:cNvPr"), "name"))
  expect_identical(.lam_portada_variante("25"), "banda"); expect_identical(.lam_portada_variante(NULL), "centrada")
})

test_that("el índice nativo toma los subíndices en el formato de la app y no confunde un iconos_focos vacío con focos", {
  c3 <- c("Perfil", "Metodología", "Resultados")
  lam <- .id_mazo(list(
    a = p_slide_indice("Índice", secciones = c3, subindices = "Metodología: Diseño muestral\nMetodología: Trabajo de campo\nPerfil: Docentes"),
    b = p_slide_indice("Índice", secciones = c3, subindices = data.frame(seccion = c("Resultados", "Perfil"), subtema = c("Satisfacción", "Egresados"))),
    c = p_slide_indice("Índice", secciones = c3, subtemas = c("Tutoría", "Becas")),
    d = p_slide_indice("Índice", secciones = c3, iconos_focos = "")))
  nativo <- vapply(lam, function(x) "prosecnur:indice" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"), TRUE)
  expect_true(all(nativo))
  expect_identical(.id_txt(lam[[1]], "indice:subcapitulo"), c("Docentes", "Diseño muestral", "Trabajo de campo"))
  expect_identical(.id_txt(lam[[2]], "indice:subcapitulo"), c("Egresados", "Satisfacción"))
  expect_true(all(c("Tutoría", "Becas") %in% .id_txt(lam[[3]], "indice:subcapitulo")))      # los subtemas van, como en la ruta anterior
  expect_identical(.lam_icono_capitulo("Desarrollo de políticas institucionales"), "scroll-text")
})
