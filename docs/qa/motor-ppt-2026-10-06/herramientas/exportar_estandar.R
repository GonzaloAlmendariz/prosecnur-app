# Exporta la norma de los dos recetarios (PPT moderno y propuesta en Word) a api/inst/estandar/estandar_pulso.json, la fuente única de
# verdad del estilo del motor (ADR 0092). Los valores salen de recetario.R, recetario_piezas.R, recetario_fichas.R, recetario_word_graficos.R
# y recetario_word_identidad.R; si cambian ahí, se cambian aquí y se vuelve a exportar. Uso (desde la raíz del repo):
#   Rscript docs/qa/motor-ppt-2026-10-06/herramientas/exportar_estandar.R [salida.json]
# Sin argumento escribe la fuente de verdad; con uno, una copia (test-estandar-tokens.R la compara con la versionada).
suppressMessages(library(jsonlite))
r3 <- function(x) round(x, 3)

# ---- lámina (recetario.R:17-35, estilo moderno)
W <- 13.333; H <- 7.5; MR <- 0.315; ML0 <- 0.315; ML <- ML0 + 0.18
XC <- ML; AC <- W - MR - ML
geom <- list(unidad = "in", ancho = W, alto = H, margen_izq_borde = ML0, margen_izq = ML, margen_der = MR, titulo_y = 0.355,
             zona_datos_y0 = 1.65, zona_datos_y1 = 6.42, contenido_y1 = 6.72, leyenda_y = 6.42, base_y = 6.88,
             ancho_contenido = r3(AC), separacion_paneles = 0.5, columna_top_two_box = 1.0, aire_cifra_chica = 0.36,
             likert = list(x_premisa = ML, ancho_premisa = 3.3, x_actor = 3.6, ancho_actor = 1.5, x_barra = 5.2, ancho_barra = 6.0, x_top_two_box = 11.4))
tipografia_ppt <- list(unidad = "pt", titulo = 24, antetitulo = 10, pregunta = 13, cifra = 14, cifra_fuera = 12, leyenda = 12, actor = 12,
                       base = 10, n = 10, cuerpo = 14, narrativa = 15, cifra_destacada = 34, rotulo_top_two_box = 10, fuente = "Arial")
colores <- list(coral = "#CA5651", azul = "#081F5C", tenue = "#8E9DBD", texto_suave = "#5A6480", texto_tenue = "#8A93A8", filete = "#D5D9DF",
                cebra = "#E9ECF1", fondo = "#F2F2F2", verde_top_two_box = "#4E9438", naranja_bottom_two_box = "#B4541F", naranja_bottom_two_box_texto = "#A44A1F", azul_medio = "#4F7FAF",
                azul_rango = "#B9C5DC",   # caja del 50 % central (boxplot) y barra del rango (media y rango), recetario_m3b.R
                anillo_radar = "#C9CED8")   # anillos del radar, recetario_m3c.R:82
paletas <- list(
  likert = list(colores = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"), rotulos = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")),
  likert_neutro = list(colores = c("#F4B183", "#FFD965", "#D9D9D9", "#ADD493", "#70AD47")),
  dicotomica = list(colores = c("#081F5C", "#9DC3E6"), rotulos = c("Sí", "No")),
  actores = list(colores = c(Docentes = "#0B4F8C", Estudiantes = "#2A9D8F", Egresados = "#E9C46A", Autoridades = "#8E9DBD", Administrativos = "#081F5C", Empleadores = "#9DC3E6")),
  categorias = list(mayor = "#081F5C", resto = "#8E9DBD", residual = "#8A93A8"),
  calor = list(desde = "#EEF2F8", hasta = "#2F4B7C", rango = c(80, 100),
               # Cinco tramos en vez de degradado (recetario_m3d.R:21-23, C30): todos pasan 4.5:1 con su texto.
               tramos = c("#EEF2F8", "#C9D3E6", "#9FB1D1", "#4F6A9A", "#2F4B7C")),
  mapa = list(clases = c("#C9D5EA", "#8EA3C6", "#4F6B9E", "#081F5C"), fuera = "#E2E6EC"))
grosor <- list(unidad = "in", nota = "por número de filas de la lámina; la barra no adelgaza por cifras chicas, la fila gana aire",
  escala_apilada = list(list(filas_hasta = 2, grosor = 0.50), list(filas_hasta = 3, grosor = 0.48), list(filas_hasta = 6, grosor = 0.44), list(filas_hasta = 9, grosor = 0.38), list(filas_hasta = 999, grosor = 0.32)),
  categorias = list(list(filas_hasta = 3, grosor = 0.26), list(filas_hasta = 6, grosor = 0.28), list(filas_hasta = 7, grosor = 0.30), list(filas_hasta = 999, grosor = 0.32)))
reglas <- list(
  leyenda = "centrada en todo el bloque, incluida la columna Top Two Box; en mapas, al lado y centrada en vertical",
  cifras_chicas = "si no caben en su segmento suben con una guía, separadas 0.46 in entre sí; la fila gana aire_cifra_chica",
  orden_escala = "de lo negativo a lo positivo; Sin información y No he usado el servicio al final y en gris",
  orden_categorias = "de la más elegida a la menos elegida; Otros, Ninguna, No sabe y Prefiero no responder al final",
  categoria_mayor = "la mayor en azul y en negrita; las demás en el tono de apoyo",
  texto_sobre_color = "blanco o azul, el que más contraste",
  base_chica = "con menos de 30 casos, todas las filas del bloque dicen «x de y»",
  redondeo = "resto mayor: cada barra suma 100",
  coral = "sólo en títulos y en el filete de la narrativa")

# ---- tipos de lámina (recetario_fichas.R:5-33), ranuras en pulgadas
xS <- XC; xE <- W - MR; aw <- xE - xS; h1 <- 4.6; h2 <- 2.2; y1 <- 1.65; y2 <- 4.05; w2 <- (aw - 0.5) / 2; x2 <- xS + w2 + 0.5; w3 <- (aw - 1.0) / 3
R <- function(tipo, x, y, w, h) list(tipo = tipo, x = r3(x), y = r3(y), w = r3(w), h = r3(h))
G <- function(...) R("grafico", ...); Tx <- function(...) R("texto", ...); Ci <- function(...) R("cifras", ...)
fam <- function(escala, cifra, rot, barra) list(escala = escala, cifra_pt = cifra, rotulo_pt = rot, barra_in = barra)
f1 <- fam(1, 14, 12, 0.42); fT <- fam(0.6, 14, 12, 0.36); f2 <- fam(0.48, 13, 11.5, 0.34); f3 <- fam(0.4, 12, 11, 0.26); fP <- fam(0.3, 12, 10.5, 0.22)
tipo <- function(id, nombre, layout, ranuras, familia, uso) list(id = id, nombre = nombre, layout = layout, ranuras = ranuras, familia = familia, uso = uso)
tipos <- list(
  tipo("p_slide_1_grafico", "Un gráfico", "Graficos", list(G(xS, y1, aw, h1)), f1, "La lámina estándar: una pregunta, un gráfico"),
  tipo("p_slide_1_grafico_narrativo", "Un gráfico con narrativa", "1_Grafico_narrativo", list(Tx(xS, y1, aw, 0.8), G(xS, 2.6, aw, 3.7)), f1, "Una frase arriba dice lo que hay que retener"),
  tipo("p_slide_grafico_texto_derecha", "Gráfico con texto a la derecha", "right_grafico_texto", list(G(xS, y1, 7.6, h1), Tx(8.6, 1.9, xE - 8.6, 3.0)), fT, "El gráfico y su lectura al costado"),
  tipo("p_slide_grafico_texto_izquierda", "Gráfico con texto a la izquierda", "left_grafico_texto", list(Tx(xS, 1.9, 4.2, 3.0), G(5.2, y1, xE - 5.2, h1)), fT, "Para alternar con la lámina vecina"),
  tipo("p_slide_texto", "Texto", "Title and Content", list(Tx(xS, y1, aw, h1)), NULL, "Conclusiones o notas metodológicas breves"),
  tipo("p_slide_2_graficos", "Dos gráficos", "Graficos_2columnas", list(G(xS, y1, w2, h1), G(x2, y1, w2, h1)), f2, "Dos preguntas que se leen juntas"),
  tipo("p_slide_2_graficos_narrativo", "Dos gráficos con narrativa", "1_Graficos_2columnas_narrativo", list(Tx(xS, y1, aw, 0.8), G(xS, 2.6, w2, 3.7), G(x2, 2.6, w2, 3.7)), f2, "Dos gráficos con una idea común arriba"),
  tipo("p_slide_2_graficos_texto_izquierda", "Dos gráficos con texto a la izquierda", "left_2graficos_texto", list(Tx(xS, 1.9, 3.5, 3.0), G(4.4, y1, 4.2, h1), G(8.85, y1, xE - 8.85, h1)), f3, "Perfiles breves con su lectura"),
  tipo("p_slide_2_graficos_texto_derecha", "Dos gráficos con texto a la derecha", "right_2graficos_texto", list(G(xS, y1, 4.1, h1), G(4.85, y1, 4.1, h1), Tx(9.25, 1.9, xE - 9.25, 3.0)), f3, "Igual que la anterior, para alternar"),
  tipo("p_slide_2_graficos_vertical", "Dos gráficos apilados", "graficos_2_vertical", list(G(xS, y1, aw, h2), G(xS, y2, aw, h2)), fam(1, 14, 12, 0.30), "Dos preguntas de escala que comparten leyenda"),
  tipo("p_slide_2_graficos_asimetrico", "Gráfico principal y de apoyo", "graficos_2_asimetrico", list(G(xS, y1, 7.9, h1), G(8.85, y1, xE - 8.85, h1)), fam(0.65, 14, 12, 0.36), "Un gráfico manda y el otro lo resume"),
  tipo("p_slide_3_graficos_2mas1", "Tres gráficos, dos apilados y uno alto", "graficos_3_2mas1", list(G(xS, y1, w2, h2), G(xS, y2, w2, h2), G(x2, y1, w2, h1)), f3, "Dos preguntas breves y una más larga"),
  tipo("p_slide_3_graficos_1mas2", "Tres gráficos, uno alto y dos apilados", "graficos_3_1mas2", list(G(xS, y1, w2, h1), G(x2, y1, w2, h2), G(x2, y2, w2, h2)), f3, "La pregunta larga primero"),
  tipo("p_slide_3_graficos_1arriba", "Tres gráficos, uno ancho arriba", "graficos_3_1arriba", list(G(xS, y1, aw, h2), G(xS, y2, w2, h2), G(x2, y2, w2, h2)), f3, "Una pregunta general y dos de detalle"),
  tipo("p_slide_3_graficos_fila", "Tres gráficos en fila", "graficos_3_fila", list(G(xS, y1, w3, h1), G(xS + w3 + 0.5, y1, w3, h1), G(xS + 2 * (w3 + 0.5), y1, w3, h1)), f3, "Tres variables de perfil"),
  tipo("p_slide_3_graficos_poblacion_tira", "Tres gráficos en tira", "poblacion_3_tira", list(G(xS, y1, aw, 1.4), G(xS, y1 + 1.6, aw, 1.4), G(xS, y1 + 3.2, aw, 1.4)), fam(1, 14, 12, 0.30), "Tres preguntas de sí o no del mismo público"),
  tipo("p_slide_3_graficos_poblacion_corona", "Tres gráficos en corona", "poblacion_3_corona", list(G(xS, y1, w2, h2), G(xS, y2, w2, h2), G(x2, y1, w2, h1)), f3, "Perfil con una variable más larga"),
  tipo("p_slide_4_graficos", "Cuatro gráficos", "4_paneles", list(G(xS, y1, w2, h2), G(x2, y1, w2, h2), G(xS, y2, w2, h2), G(x2, y2, w2, h2)), f3, "Cuatro variables de perfil del mismo público"),
  tipo("p_slide_5_graficos_poblacion", "Cinco gráficos", "poblacion_5", list(G(xS, y1, w3, h2), G(xS + w3 + 0.5, y1, w3, h2), G(xS + 2 * (w3 + 0.5), y1, w3, h2), G(xS, y2, w2, h2), G(x2, y2, w2, h2)), fP, "Perfil del egresado o del docente"),
  tipo("p_slide_6_graficos_poblacion", "Seis gráficos", "poblacion_6", list(G(xS, y1, w3, h2), G(xS + w3 + 0.5, y1, w3, h2), G(xS + 2 * (w3 + 0.5), y1, w3, h2), G(xS, y2, w3, h2), G(xS + w3 + 0.5, y2, w3, h2), G(xS + 2 * (w3 + 0.5), y2, w3, h2)), fP, "El máximo de gráficos en una lámina"),
  tipo("p_slide_3_graficos_poblacion_cifras", "Cifras en columna lateral", "poblacion_3_cifras", list(Ci(xS, y1, 3.0, h1), G(3.9, y1, 4.4, h2), G(3.9, y2, 4.4, h2), G(8.75, y1, xE - 8.75, h1)), fP, "Tamaño de la muestra y edad en cifras"),
  tipo("p_slide_cifras_y_graficos", "Cifras en banda superior", "cifras_y_graficos", list(Ci(xS, y1, aw, 1.2), G(xS, 3.05, w2, 3.2), G(x2, 3.05, w2, 3.2)), f2, "Abrir un capítulo o resumir el estudio"))

# ---- Word (recetario_word_graficos.R y recetario_word_identidad.R)
word <- list(
  pagina = list(unidad = "in", ancho = 8.27, alto = 11.69, margen_izq = 1.0, margen_der = 1.0, margen_sup = 1.1, margen_inf = 0.9, encabezado = 0.4, pie = 0.4, ancho_util = 6.27),
  tipografia = list(unidad = "pt", fuente = "Arial", titulo_1 = 18, titulo_2 = 12.5, numero_capitulo = 9, rotulo = 10, base = 8.5, lectura = 10.5, cuerpo = 10.5, toc_1 = 10.5, toc_2 = 10,
                    grafico_minimo = 8, grafico_cifra = 9.5, grafico_rotulo = 9, grafico_leyenda = 8),
  colores = list(titulos = "#002060", texto = "#26303F", suave = "#5A6480", acento = "#CA5651", filete = "#D5D9DF", recuadro = "#F3F5F8"),
  figura = list(dpi = 300, fondo = "transparente", alto_apilada = list(base = 1.2, por_fila = 0.36, grosor_fraccion = 0.58), alto_barras = list(base = 0.75, por_fila = 0.27, grosor_fraccion = 0.64)),
  rotulo = "«Gráfico N» en negrita con campo SEQ y, en la línea siguiente, el título en cursiva; la base y la fuente centradas debajo, sin la palabra Nota",
  documento = c("portada tipográfica sola en su página", "resumen", "índice, índice de gráficos e índice de tablas en página propia", "una sección de Word por capítulo con su encabezado escrito",
                "apertura de capítulo con número grande, título, entrada y secciones", "Cómo leer este informe", "referencias con sangría francesa", "contraportada sin encabezado"))

est <- list(version = "2026.10", fuente = c("docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx", "docs/qa/motor-ppt-2026-10-06/4-recetario/propuesta-word.docx"),
            ppt = list(geometria = geom, tipografia = tipografia_ppt, colores = colores, paletas = paletas, grosor = grosor, reglas = reglas, tipos_lamina = tipos), word = word)
dir.create("api/inst/estandar", showWarnings = FALSE, recursive = TRUE)
salida <- commandArgs(trailingOnly = TRUE)[1]
if (is.na(salida)) salida <- "api/inst/estandar/estandar_pulso.json"
write_json(est, salida, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
cat("estandar_pulso.json:", length(tipos), "tipos de lámina\n")
