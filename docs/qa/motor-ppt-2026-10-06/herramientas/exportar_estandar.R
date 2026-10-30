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
             likert = list(x_premisa = ML, ancho_premisa = 3.0, x_actor = 3.45, ancho_actor = 1.5, x_barra = 5.2, ancho_barra = 6.2, x_top_two_box = 11.5),
             # K15: la cifra de las láminas de composición es la pieza `cifra()` (recetario_piezas.R:51-56): valor de 0.62,
             # rótulo debajo (0.3), detalle en +0.9 (0.26); ocupa 1.15 y sus separadores van de y + 0.05 a y + 1.2 (p171).
             cifra_pieza = list(valor_h = 0.62, rotulo_dy = 0.62, rotulo_h = 0.3, detalle_dy = 0.9, detalle_h = 0.26, alto = 1.15, separador_dy = 0.05))
tipografia_ppt <- list(unidad = "pt", titulo = 24, antetitulo = 10, subtitulo = 18, pregunta = 13, cifra = 14, cifra_fuera = 12, leyenda = 12, actor = 12,
                       # Rótulo de cada categoría en barras, columnas y circulares (el `actor` es el público de la escala).
                       rotulo_categoria = 12,
                       base = 10, n = 10, cuerpo = 14, narrativa = 15, cifra_destacada = 34, rotulo_top_two_box = 12,
                       # Piso de las cifras tras el paso de letra del cliente (K13 en el PPT, como `grafico_minimo` en el Word) y la
                       # portada del recetario (lámina 23 y sus variantes 24 «izquierda» y 25 «banda», lamina_identidad.R).
                       cifra_minimo = 8, portada_rotulo = 13, portada_titulo = 30, portada_encargo = 18, portada_fecha = 18,
                       portada_encargo_izquierda = 16, portada_fecha_izquierda = 14, portada_encargo_banda = 15, portada_fecha_banda = 13,
                       fuente = "Arial")
colores <- list(coral = "#CA5651", azul = "#081F5C", tenue = "#8E9DBD", texto_suave = "#5A6480", texto_tenue = "#8A93A8", filete = "#D5D9DF",
                cebra = "#E9ECF1", fondo = "#F2F2F2", verde_top_two_box = "#70AD47", naranja_bottom_two_box = "#B4541F", naranja_bottom_two_box_texto = "#A44A1F", azul_medio = "#4F7FAF",
                azul_rango = "#B9C5DC",   # caja del 50 % central (boxplot) y barra del rango (media y rango), recetario_m3b.R
                anillo_radar = "#C9CED8",   # anillos del radar, recetario_m3c.R:82
                mapa_aplicada = "#2F4B7C", mapa_medio = "#9FB1D1", mapa_fuera = "#E2E6EC", mapa_borde = "#B8C2D3",   # mapas, recetario_m3e.R:85
                numero_fondo = "#DCE2EC", banda_clara = "#E3E7EF",   # separadores C y subcapítulo 3 (recetario-moderna.pptx, láminas 54 y 57)
                fondo_destacado = "#F8E3E2")   # cuadrante destacado de la matriz de cuadrantes (lámina 91)
# `uso` es la regla de cada paleta tal como la lee la lámina «Los colores y lo que significan» del catálogo
# (lamina_estandar_paleta.R): la constitución dice el color y su regla en el mismo sitio (Gonzalo, 2026-10-27).
paletas <- list(
  likert = list(colores = c("#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"), rotulos = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                uso = "De lo negativo a lo positivo, siempre en ese orden. Lo negativo va en naranja, nunca en rojo; Sin información va al final y en gris."),
  likert_neutro = list(colores = c("#F4B183", "#FFD965", "#D9D9D9", "#ADD493", "#70AD47"),
                       rotulos = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                       uso = "La escala de cinco pasos lleva el punto neutro en gris, al centro."),
  dicotomica = list(colores = c("#081F5C", "#9DC3E6"), rotulos = c("Sí", "No"),
                    uso = "Sí en azul oscuro y No en celeste, en todas las láminas; también cualquier lista de dos opciones."),
  # Lo que el motor pone a las porciones de más de dos categorías sin paleta propia (lamina_circulares.R, `.lam_colores_pie`)
  # y lo que la app sugiere a una lista nominal (paletasSugeridas.ts): la rampa de azules de la marca (Gonzalo, 2026-10-27:
  # «manda el JSON»).
  categorica = list(colores = c("#081F5C", "#4F7FAF", "#8E9DBD", "#B9C5DC", "#8A93A8"),
                    uso = "Categorías sin orden con más de dos opciones: la rampa de azules de la marca, de la más a la menos elegida."),
  actores = list(colores = c(Docentes = "#0B4F8C", Estudiantes = "#2A9D8F", Egresados = "#E9C46A", Autoridades = "#8E9DBD", Administrativos = "#081F5C", Empleadores = "#9DC3E6"),
                 rotulos = c("Docentes", "Estudiantes", "Egresados", "Autoridades", "Administrativos", "Empleadores"),
                 uso = "Cada público conserva su color en todo el informe; si el nombre ya está junto a la barra, no necesita color."),
  categorias = list(mayor = "#081F5C", resto = "#8E9DBD", residual = "#8A93A8",
                    rotulos = list(mayor = "La más elegida", resto = "Las demás", residual = "No sabe, Otros"),
                    uso = "Barras de una serie: la mayor en azul; las demás en el tono de apoyo; No sabe, Otros y similares al final en gris azulado."),
  # El semáforo de Analítica › Dimensiones, el que ve el analista, para todo el motor: chips del boxplot y de media y
  # rango, comparativo Top Two Box y su tendencia (Gonzalo, 2026-10-27, P10). Antes había tres semáforos distintos.
  semaforo = list(rojo = "#D84B55", ambar = "#E0B44C", verde = "#3A9A5B",
                  rotulos = list(rojo = "Bajo", ambar = "Medio", verde = "Alto"),
                  uso = "Indicadores con umbral: bajo en rojo, medio en ámbar y alto en verde; la tendencia que sube va en verde y la que baja en rojo."),
  calor = list(desde = "#EEF2F8", hasta = "#2F4B7C", rango = c(80, 100),
               # Cinco tramos en vez de degradado (recetario_m3d.R:21-23, C30): todos pasan 4.5:1 con su texto.
               tramos = c("#EEF2F8", "#C9D3E6", "#9FB1D1", "#4F6A9A", "#2F4B7C"),
               uso = "Tablas de calor: cinco tramos del claro al oscuro, todos legibles con su texto."),
  mapa = list(clases = c("#C9D5EA", "#8EA3C6", "#4F6B9E", "#081F5C"), fuera = "#E2E6EC",
              uso = "Mapas de cobertura: cuatro clases del claro al oscuro; lo que queda fuera del marco, en gris."))
grosor <- list(unidad = "in", nota = "por número de filas de la lámina; la barra no adelgaza por cifras chicas, la fila gana aire",
  # Piso de grosor de la barra de escala en cm (ADR 0092, registro: rige sin declararlo; el informe lo cambia y 0 lo apaga).
  piso_escala_cm = 1.12,
  # Piso de la barra de escala dentro de un panel (media lámina), en cm: el mínimo de Contabilidad (lám. 18, 19 y 21:
  # 0,66 cm). El de la escala, 1,12 cm, no cabe en media lámina (Gonzalo, 2026-10-29: «0,66 cm, como Conta»).
  piso_panel_cm = 0.66,
  escala_apilada = list(list(filas_hasta = 2, grosor = 0.50), list(filas_hasta = 3, grosor = 0.48), list(filas_hasta = 6, grosor = 0.44), list(filas_hasta = 9, grosor = 0.38), list(filas_hasta = 999, grosor = 0.32)),
  categorias = list(list(filas_hasta = 3, grosor = 0.26), list(filas_hasta = 6, grosor = 0.28), list(filas_hasta = 7, grosor = 0.30), list(filas_hasta = 999, grosor = 0.32)))
# Composición de las láminas de escala (Sí/No, multilista, filtro): las medidas que el motor decide y que se midieron sobre
# el informe de Contabilidad del motor anterior (GOAL docs/qa/goal-estandar-composicion-2026-10-29.md). Todo en pulgadas.
composicion <- list(unidad = "in",
  escala = list(
    aire_tema = 0.14,                # entre las barras de un mismo tema, borde a borde (Conta 0,10–0,35)
    aire_entre_temas_max = 0.9,      # tope del aire entre temas cuando la lámina no llena su alto
    aire_leyenda = 0.3,              # de la última barra (o premisa) a la leyenda
    aire_leyenda_multilista = 0.09,  # del final del último bloque a la leyenda compartida (el bloque acaba 0,06 bajo su barra)
    aire_leyenda_apretada = 0.12,    # lo mismo en la lámina apretada (M1), que no tiene sitio para más
    aire_leyenda_fila = 0.17,        # de la barra a su leyenda cuando cada fila lleva la suya (Sí/No con escala, como Conta)
    aire_leyenda_solo = 0.55,        # de la barra a la leyenda en la lámina de una sola afirmación (recetario 216)
    rotulo_box_sobre = 0.45,         # el rótulo TOP TWO BOX sobre el inicio de la franja de barras
    primera_chica = 0.18,            # alto de la primera barra bajo el bloque si su cifra chica sube (medio paso de 0,24 + 0,06):
                                     # la cifra no se acerca al rótulo de la columna Top Two Box
    columna_box = 1.5, columna_box_con_btb = 1.25),   # ancho de la columna Top/Bottom Two Box
  filtro = list(                     # pregunta filtro y subpregunta (lamina_filtro_sub.R; PPT 23 de Renzo, p193)
    columna_box = 1.3,               # columna Top Two Box de la barra del filtro y de la subpregunta
    rotulo_box_sobre = 0.4,          # el rótulo TOP TWO BOX sobre la barra de la subpregunta
    cifra_pt = 26, cifra_pt_bateria = 20,   # cifras de la dicotomía filtro; con una batería abajo, compacta
    grosor = 0.42, grosor_bateria = 0.32,   # grosor de esa dicotomía
    aire_sub = 0.75, aire_sub_bateria = 0.5,   # de la dicotomía a la subpregunta
    # Como Conta (su lámina 34, lamina_filtro_sub_conta.R): barra de 0,71, leyenda a 0,45 de su barra, 2,78 de barra a barra
    conta_grosor = 0.71, conta_aire_leyenda = 0.45, conta_y = 0.25, conta_paso = 2.78),
  filas = list(                      # la escala en filas, con Total o Bottom Two Box (recetario, lámina 77)
    ancho_rotulo = 1.8,              # columna de los rótulos de fila
    lineas_max = 2),                 # premisas de a lo más estas líneas en esa columna pueden ir en filas
  # La tabla de datos al costado de líneas y puntos o del radar (lamina_tabla_costado.R; la de la lámina 90) y la tabla
  # nativa genérica del camino general. Letra en pt; `relleno_pt`, el margen interno de la celda.
  tabla_costado = list(col1 = 2.2, col = 1.15, fila = 0.5, fila_min = 0.4, hueco = 0.3, hueco_v = 0.2,
                       min_graf_w = 3.6, dy = 0.6, cuerpo_pt = 13, enc_pt = 11, relleno_pt = 12),
  tabla_general = list(col1 = 2.2, col = 1.15, fila = 0.42, cuerpo_pt = 12, enc_pt = 11, relleno_pt = 14),
  multilista = list(                 # varios bloques en una lámina (lamina_multilista.R; recetario p144)
    gap_bloques = 0.27,              # del fondo de un bloque al título del siguiente (p144: 0,33 desde la barra)
    aire_titulo = 0.1,               # del título del bloque a su primera fila, sin columna Top Two Box
    aire_ttb = 0.35,                 # lo mismo con columna Top Two Box: su rótulo cabe en medio
    rotulo_box_sobre = 0.37,         # el rótulo TOP TWO BOX sobre la franja de un bloque con título (p144)
    alto_leyenda = 0.5),             # alto de la leyenda propia de un bloque, con su aire al siguiente
  apretada = list(                   # la lámina que sólo cabe con el aire en su mínimo (M1, lamina_escala_aire.R)
    holgura_chica = 0.03,            # de la cifra chica a la barra de arriba (0,075 en la lámina normal)
    aire_ttb = 0.25,                 # del título del bloque a su primera fila con Top Two Box
    extra_franja = 0.30),            # lo que la franja de datos baja hacia el pie
  perfil = list(                     # paneles de las láminas de perfil y mixtas, como Conta (lamina_perfil_panel.R; ítems 18–20)
    titulo_pt = 16,                  # pregunta del panel, centrada
    rotulo_pt = c(13, 12.5, 12, 11.5, 11),   # categoría: 13 pt y baja medio punto sólo si así quedan más paneles nativos
    grosor_max_cm = 0.99,            # la barra más gruesa de Conta (el piso es piso_panel_cm)
    grosor_frac = 0.7,               # fracción de la fila que ocupa la barra
    aire_fila = 0.06,                # aire mínimo entre dos barras
    aire_titulo = 0.18,              # de la pregunta (o su público) a la primera barra
    margen_inf = 0.03),              # bajo la última barra
  pie = list(base_x = 0.35, base_y = 7.06, base_negrita = TRUE),   # «Base:» y folio; la base en negrita (Gonzalo, 2026-10-30)
  portada_plantilla = list(         # encargo y fecha de la portada sobre «Title Slide», como Conta (ítem 26; lamina_portada_plantilla.R)
    encargo = list(left = 3.30, top = 5.50, width = 6.75, height = 0.56), fecha = list(left = 9.17, top = 6.21, width = 3.06, height = 0.40),
    encargo_pt = 18, fecha_pt = 18),
  llenar = list(                     # la lámina con alto de sobra (lamina_escala_llenar.R)
    aire_leyenda = 0.45,             # Conta 0,3–0,75
    aire_entre_temas_max = 1.0,      # Conta: mediana 0,74; 1,1–1,4 con pocas barras
    aire_publicos_max = 0.65,        # públicos de una sola pregunta (Conta 0,65–0,84)
    piso_leyenda = 0.32,             # la leyenda de una fila no baja de base_y menos esto
    grosor = list(list(filas_hasta = 2, grosor = 0.70), list(filas_hasta = 3, grosor = 0.66), list(filas_hasta = 4, grosor = 0.58),
                  list(filas_hasta = 6, grosor = 0.51), list(filas_hasta = 9, grosor = 0.38), list(filas_hasta = 999, grosor = 0.32))))
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
# K15: las láminas de cinco y seis gráficos (p164, p166) usan calles de 0.4 (columnas de 3.908); la de cifras lateral (p169),
# columnas de 4.312 con calles de 0.45 tras la columna de cifras de 3.0 y su calle de 0.45.
w3b <- (aw - 0.8) / 3; wc21 <- (xE - (xS + 3.0 + 0.45) - 0.45) / 2
R <- function(tipo, x, y, w, h) list(tipo = tipo, x = r3(x), y = r3(y), w = r3(w), h = r3(h))
G <- function(...) R("grafico", ...); Tx <- function(...) R("texto", ...); Ci <- function(...) R("cifras", ...)
fam <- function(escala, cifra, rot, barra) list(escala = escala, cifra_pt = cifra, rotulo_pt = rot, barra_in = barra)
f1 <- fam(1, 14, 12, 0.42); fT <- fam(0.6, 14, 12, 0.36); f2 <- fam(0.48, 13, 11.5, 0.34); f3 <- fam(0.4, 12, 11, 0.26); fP <- fam(0.3, 12, 10.5, 0.22)
tipo <- function(id, nombre, layout, ranuras, familia, uso, cifras = NULL) { t <- list(id = id, nombre = nombre, layout = layout, ranuras = ranuras, familia = familia, uso = uso); if (!is.null(cifras)) t$cifras <- cifras; t }
tipos <- list(
  tipo("p_slide_1_grafico", "Un gráfico", "Graficos", list(G(xS, y1, aw, h1)), f1, "La lámina estándar: una pregunta, un gráfico"),
  tipo("p_slide_1_grafico_narrativo", "Un gráfico con narrativa", "1_Grafico_narrativo", list(Tx(xS, y1, aw, 0.8), G(xS, 2.6, aw, 3.7)), f1, "Una frase arriba dice lo que hay que retener"),
  # K15: p128 dibuja el gráfico hasta 9.095 y el texto desde su filete de acento en 9.55
  tipo("p_slide_grafico_texto_derecha", "Gráfico con texto a la derecha", "right_grafico_texto", list(G(xS, y1, 8.6, h1), Tx(9.55, 2.45, xE - 9.55, 3.4)), fT, "El gráfico y su lectura al costado"),
  # K15: p130: texto con filete en 0.495 (caja hasta 3.945); gráfico desde 4.55, pregunta en 1.75
  tipo("p_slide_grafico_texto_izquierda", "Gráfico con texto a la izquierda", "left_grafico_texto", list(Tx(xS, 2.05, 3.45, 3.4), G(4.55, 1.75, 8.4, 6.25 - 1.75)), fT, "Para alternar con la lámina vecina"),
  tipo("p_slide_texto", "Texto", "Title and Content", list(Tx(xS, y1, aw, h1)), NULL, "Conclusiones o notas metodológicas breves"),
  tipo("p_slide_2_graficos", "Dos gráficos", "Graficos_2columnas", list(G(xS, y1, w2, h1), G(x2, y1, w2, h1)), f2, "Dos preguntas que se leen juntas"),
  tipo("p_slide_2_graficos_narrativo", "Dos gráficos con narrativa", "1_Graficos_2columnas_narrativo", list(Tx(xS, y1, aw, 0.8), G(xS, 2.6, w2, 3.7), G(x2, 2.6, w2, 3.7)), f2, "Dos gráficos con una idea común arriba"),
  # K15: p140 apila los dos gráficos a la derecha del texto (filete en 3.5)
  tipo("p_slide_2_graficos_texto_izquierda", "Dos gráficos con texto a la izquierda", "left_2graficos_texto", list(Tx(xS, 2.05, 3.45, 3.6), G(4.55, 1.7, xE - 4.55, 3.5 - 0.2 - 1.7), G(4.55, 3.7, xE - 4.55, 6.25 - 3.7)), f3, "Perfiles breves con su lectura"),
  # K15: p142 apila los dos gráficos a la izquierda del texto
  tipo("p_slide_2_graficos_texto_derecha", "Dos gráficos con texto a la derecha", "right_2graficos_texto", list(G(xS, 1.7, 8.6, 3.8 - 0.2 - 1.7), G(xS, 3.8, 8.6, 6.25 - 3.8), Tx(9.55, 2.05, xE - 9.55, 3.4)), f3, "Igual que la anterior, para alternar"),
  tipo("p_slide_2_graficos_vertical", "Dos gráficos apilados", "graficos_2_vertical", list(G(xS, y1, aw, h2), G(xS, y2, aw, h2)), fam(1, 14, 12, 0.30), "Dos preguntas de escala que comparten leyenda"),
  # K15: p146: principal de 8.4 y apoyo desde 9.35, preguntas en 1.6
  tipo("p_slide_2_graficos_asimetrico", "Gráfico principal y de apoyo", "graficos_2_asimetrico", list(G(xS, 1.6, 8.4, 6.25 - 1.6), G(9.35, 1.6, xE - 9.35, 6.25 - 1.6)), fam(0.65, 14, 12, 0.36), "Un gráfico manda y el otro lo resume"),
  tipo("p_slide_3_graficos_2mas1", "Tres gráficos, dos apilados y uno alto", "graficos_3_2mas1", list(G(xS, y1, w2, h2), G(xS, y2, w2, h2), G(x2, y1, w2, h1)), f3, "Dos preguntas breves y una más larga"),
  # K15: p151: filete en 3.5 y el de abajo desde 3.7 (lo que ya dibuja el motor, lamina_mixtas.R)
  tipo("p_slide_3_graficos_1mas2", "Tres gráficos, uno alto y dos apilados", "graficos_3_1mas2", list(G(xS, y1, w2, h1), G(x2, y1, w2, 3.5 - 0.2 - y1), G(x2, 3.7, w2, 6.25 - 3.7)), f3, "La pregunta larga primero"),
  # K15: p154: el ancho desde 1.6, filete en 4.05 y los de abajo desde 4.2 (lo que ya dibuja el motor)
  tipo("p_slide_3_graficos_1arriba", "Tres gráficos, uno ancho arriba", "graficos_3_1arriba", list(G(xS, 1.6, aw, 4.05 - 0.2 - 1.6), G(xS, 4.2, w2, 6.25 - 4.2), G(x2, 4.2, w2, 6.25 - 4.2)), f3, "Una pregunta general y dos de detalle"),
  tipo("p_slide_3_graficos_fila", "Tres gráficos en fila", "graficos_3_fila", list(G(xS, y1, w3, h1), G(xS + w3 + 0.5, y1, w3, h1), G(xS + 2 * (w3 + 0.5), y1, w3, h1)), f3, "Tres variables de perfil"),
  # K15: p158: franjas cada 1.68 in con filetes en 3.03 y 4.71
  tipo("p_slide_3_graficos_poblacion_tira", "Tres gráficos en tira", "poblacion_3_tira", list(G(xS, y1, aw, 3.03 - 0.2 - y1), G(xS, 3.33, aw, 4.71 - 0.2 - 3.33), G(xS, 5.01, aw, 6.25 - 5.01)), fam(1, 14, 12, 0.30), "Tres preguntas de sí o no del mismo público"),
  # Corona (decisión de Gonzalo, 2026-10-10: «manda el recetario»): las ranuras que dibuja la lámina 160
  # (recetario_m2c.R, «Perfil del docente»): dos arriba lado a lado con 0.8 in de calle, filete vertical hasta 3.8,
  # filete horizontal en 4.0 y el panel ancho de abajo desde 4.2 hasta su última fila (6.37). La ficha 159 aún las
  # dibuja como dos apilados + uno alto.
  tipo("p_slide_3_graficos_poblacion_corona", "Tres gráficos en corona", "poblacion_3_corona", list(G(xS, y1, (aw - 0.8) / 2, 2.15), G(xS + (aw - 0.8) / 2 + 0.8, y1, (aw - 0.8) / 2, 2.15), G(xS, y1 + 2.55, aw, 2.17)), f3, "Perfil con una variable más larga"),
  # K15: p162: filete en 4.16 y la fila de abajo en 4.36 (lo que ya dibuja el motor nativo)
  tipo("p_slide_4_graficos", "Cuatro gráficos", "4_paneles", list(G(xS, y1, w2, 4.16 - 0.2 - y1), G(x2, y1, w2, 4.16 - 0.2 - y1), G(xS, 4.36, w2, 6.25 - 4.36), G(x2, 4.36, w2, 6.25 - 4.36)), f3, "Cuatro variables de perfil del mismo público"),
  # K15: p164: tres arriba de 3.908 con calle de 0.4; dos abajo de 5.862 con calle de 0.8 (como la corona), filete en 4.135
  tipo("p_slide_5_graficos_poblacion", "Cinco gráficos", "poblacion_5", list(G(xS, y1, w3b, 4.135 - 0.2 - y1), G(xS + w3b + 0.4, y1, w3b, 4.135 - 0.2 - y1), G(xS + 2 * (w3b + 0.4), y1, w3b, 4.135 - 0.2 - y1), G(xS, 4.335, (aw - 0.8) / 2, 6.25 - 4.335), G(xS + (aw - 0.8) / 2 + 0.8, 4.335, (aw - 0.8) / 2, 6.25 - 4.335)), fP, "Perfil del egresado o del docente"),
  # K15: p166: columnas de 3.908 con calle de 0.4; filete en 4.05 y la fila de abajo en 4.5
  tipo("p_slide_6_graficos_poblacion", "Seis gráficos", "poblacion_6", list(G(xS, y1, w3b, 4.05 - 0.2 - y1), G(xS + w3b + 0.4, y1, w3b, 4.05 - 0.2 - y1), G(xS + 2 * (w3b + 0.4), y1, w3b, 4.05 - 0.2 - y1), G(xS, 4.5, w3b, 6.25 - 4.5), G(xS + w3b + 0.4, 4.5, w3b, 6.25 - 4.5), G(xS + 2 * (w3b + 0.4), 4.5, w3b, 6.25 - 4.5)), fP, "El máximo de gráficos en una lámina"),
  # K15: p169: cifras de 3.0, filetes en 3.715 y 8.487, columnas de 4.312 desde 3.945 y 8.707; filete horizontal en 3.6
  tipo("p_slide_3_graficos_poblacion_cifras", "Cifras en columna lateral", "poblacion_3_cifras", list(Ci(xS, y1, 3.0, h1), G(3.945, y1, wc21, 3.6 - 0.2 - y1), G(3.945, 3.75, wc21, 6.25 - 3.75), G(3.945 + wc21 + 0.45, y1, wc21, h1)), fP, "Tamaño de la muestra y edad en cifras", cifras = list(valor_pt = 34)),   # p169: cifra() con su tamaño por defecto
  # K15: p171: banda de cifras con filete en 3.05 y los gráficos desde 3.25
  tipo("p_slide_cifras_y_graficos", "Cifras en banda superior", "cifras_y_graficos", list(Ci(xS, y1, aw, 1.2), G(xS, 3.25, w2, 6.25 - 3.25), G(x2, 3.25, w2, 6.25 - 3.25)), f2, "Abrir un capítulo o resumir el estudio", cifras = list(valor_pt = 32, calle = 0.4)))   # p171: cifra(size = 32), calles de 0.4

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
            ppt = list(geometria = geom, tipografia = tipografia_ppt, colores = colores, paletas = paletas, grosor = grosor, composicion = composicion, reglas = reglas, tipos_lamina = tipos), word = word)
dir.create("api/inst/estandar", showWarnings = FALSE, recursive = TRUE)
salida <- commandArgs(trailingOnly = TRUE)[1]
if (is.na(salida)) salida <- "api/inst/estandar/estandar_pulso.json"
write_json(est, salida, auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
cat("estandar_pulso.json:", length(tipos), "tipos de lámina\n")
