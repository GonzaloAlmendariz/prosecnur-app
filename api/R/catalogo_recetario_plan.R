# Plan del catálogo del recetario (checklist-catalogo-recetario-2026-10-14.md, K3–K5).
#
# Una lámina por variante del recetario, en el orden de sus capítulos, más las configuraciones que cambian lo dibujado
# y todas las láminas de estructura en sus variantes. Cada título dice qué variante es y de qué página sale, para que
# quien recorra el catálogo sepa qué debería ver. Lo que el motor no produce entra como lámina de texto que lo dice
# (K5): un hueco visible, no una omisión.

.cr_g <- function(graficador, ...) list(graficador = graficador, args = list(...))

.catalogo_recetario_plan <- function() {
  n <- 0L
  sl <- function(tipo, ..., meta = NULL) {
    n <<- n + 1L
    payload <- list(...)
    if (length(meta)) payload$meta <- meta
    list(id = sprintf("cr-%03d", n), tipo = tipo, payload = payload)
  }
  uno <- function(titulo, grafico, pagina, base = NULL) {
    sl("p_slide_1_grafico", titulo = sprintf("%s (p%s)", titulo, pagina), grafico = grafico, base = base)
  }
  falta <- function(titulo, pagina, motivo) {
    sl("p_slide_texto", titulo = sprintf("%s (p%s)", titulo, pagina),
       texto = paste("El motor todavía no produce esta variante del recetario.", motivo))
  }
  cap <- function(titulo, variante, numero, subtitulo = NULL) {
    meta <- list(numero = as.character(numero))
    if (!is.null(variante)) meta$variante <- variante
    sl("p_slide_seccion", titulo = titulo, subtitulo = subtitulo, meta = meta)
  }
  subcap <- function(titulo, variante = NULL) {
    meta <- list(nivel = "subcapitulo")
    if (!is.null(variante)) meta$variante <- variante
    sl("p_slide_seccion", titulo = titulo, meta = meta)
  }
  pub <- function(v, bases = c("docentes", "estudiantes", "egresados")) paste0(bases, "$", v)
  ttb <- c("De acuerdo", "Totalmente de acuerdo")
  btb <- c("Totalmente en desacuerdo", "En desacuerdo")
  gestion <- paste0("estudiantes$gestion_", seq_along(.CR_GESTION))
  comp_pub <- stats::setNames(lapply(seq_along(.CR_COMPETENCIAS), function(i) pub(paste0("comp_", i))), .CR_COMPETENCIAS)
  TXT <- "Texto de ejemplo: resume el hallazgo principal de la lámina y orienta la lectura del gráfico."
  g_ciclo <- .cr_g("p_barras_agrupadas", var = "estudiantes$ciclo")
  g_sexo <- .cr_g("p_pie", var = "estudiantes$sexo")
  # Las composiciones grafican una sola base (estudiantes): mezclar públicos en una lámina es un aviso legítimo.
  g_mision <- .cr_g("p_donut", var = "estudiantes$conoce_mision")
  g_titulo <- .cr_g("p_donut", var = "estudiantes$consulta_mision")
  g_situacion <- .cr_g("p_barras_agrupadas", var = "estudiantes$tutoria")
  g_edad <- .cr_g("p_numerico", var = "estudiantes$edad", metrica = "mean", titulo = "Edad promedio")
  g_cifra <- function(v, rotulo) .cr_g("p_cifra", var = paste0("estudiantes$", v), modo = "porcentaje", categoria = "1", rotulo = rotulo)

  list(
    # ---- Apertura ----------------------------------------------------------------------------------------------------
    sl("p_slide_portada", titulo = "Catálogo del recetario", subtitulo = "Todos los gráficos y láminas, con datos de prueba",
       fecha = "Octubre 2026", meta = list(variante = "centrada")),
    sl("p_slide_indice", titulo = "Índice"),
    sl("p_slide_objetivo_icono", titulo = "Objetivo del estudio",
       texto = "Conocer la percepción de **docentes, estudiantes y egresados** sobre el servicio educativo de la Facultad.",
       meta = list(variante = "clasica", actores = c("Docentes", "Estudiantes", "Egresados"))),
    sl("p_slide_tabla_tecnica", titulo = "Ficha técnica",
       filas = paste("Universo: docentes, estudiantes y egresados de la Facultad",
                     "Técnica: encuesta en línea autoadministrada",
                     "Muestra: 52 docentes, 172 estudiantes y 178 egresados",
                     "Trabajo de campo: datos sintéticos para el catálogo", sep = "\n")),
    sl("p_slide_top_two_box", titulo = "Top Two Box"),
    sl("p_slide_redondeo", titulo = "Cómo se redondean las cifras"),

    # ---- 1. Láminas de estructura -----------------------------------------------------------------------------------
    cap("Láminas de estructura", NULL, 1, "Portadas, índices, separadores, objetivos y cierres"),
    subcap("Portadas e índices"),
    sl("p_slide_portada", titulo = "Portada alineada a la izquierda (p24)", subtitulo = "Encargo del estudio", fecha = "Octubre 2026",
       meta = list(variante = "izquierda")),
    sl("p_slide_portada", titulo = "Portada con banda al pie (p25)", subtitulo = "Encargo del estudio", fecha = "Octubre 2026",
       meta = list(variante = "banda")),
    sl("p_slide_indice", titulo = "Índice en facetas, con capítulos propios",
       secciones = "Perfil del encuestado\nMisión y propósitos\nCompetencias del perfil", meta = list(composicion = "facetas")),
    sl("p_slide_indice", titulo = "Índice en círculos, con subcapítulos",
       secciones = "Gestión\nDocencia\nEgresados",
       subindices = "Gestión: Autoridades\nGestión: Trámites\nDocencia: Calidad\nEgresados: Inserción laboral",
       meta = list(composicion = "circulos")),
    sl("p_slide_indice", titulo = "Índice en bloques", secciones = "Perfil\nResultados\nConclusiones", meta = list(composicion = "bloques")),
    subcap("Separadores de subcapítulo", "barra"),
    subcap("Subcapítulo en banda", "banda"),
    subcap("Subcapítulo sin lámina", "sin_lamina"),
    sl("p_slide_texto", titulo = "Texto corrido", bullets = c("Primer punto del texto.", "Segundo punto con un hallazgo.", "Tercero con la recomendación.")),
    subcap("Objetivos"),
    sl("p_slide_objetivo_icono", titulo = "Objetivo en panel lateral (p27)",
       texto = "Conocer la percepción de la comunidad sobre la gestión de la Facultad.",
       meta = list(variante = "panel", actores = c("Docentes", "Estudiantes", "Egresados"))),
    sl("p_slide_objetivo_icono", titulo = "Objetivo con dimensiones (p28)", texto = "Conocer la percepción sobre",
       meta = list(variante = "dimensiones", actores = c("Docentes", "Estudiantes", "Egresados"),
                   dimensiones = c("Los propósitos", "La gestión", "La docencia", "Los servicios"))),

    # ---- 2.1 Barras y proporciones ----------------------------------------------------------------------------------
    cap("Barras y proporciones", "numero", 2, "Categorías, dicotómicas, partes de un todo y rankings"),
    uno("Barras categóricas", .cr_g("p_barras_categoricas", var = "estudiantes$ciclo", formato_valor = "porcentaje_n"), 68),
    uno("Barras categóricas, sólo porcentaje", .cr_g("p_barras_categoricas", var = "estudiantes$ciclo", formato_valor = "porcentaje"), 68),
    uno("Torta", .cr_g("p_pie", var = "egresados$titulo"), 69),
    falta("Torta con leyenda de cifras («56 de 178»)", 69, "La leyenda con cifra, rótulo y conteo es una propuesta del recetario."),
    uno("Dona", .cr_g("p_donut", var = "estudiantes$conoce_mision"), 70),
    uno("Barras divergentes", .cr_g("p_barras_divergentes", vars = as.list(gestion), n_negativas = 2, excluir_opciones = "SIN INF"), 71),
    uno("Barras divergentes con saldo y sin neutro",
        .cr_g("p_barras_divergentes", vars = as.list(gestion), n_negativas = 2, excluir_opciones = "SIN INF", mostrar_saldo = TRUE, incluir_neutro = FALSE), 71),
    uno("Ranking con puntos", .cr_g("p_lollipop", var = "estudiantes$ciclo"), 72),
    uno("Ranking con puntos, top 3 y una resaltada", .cr_g("p_lollipop", var = "estudiantes$ciclo", top_n = 3, resaltar = "Noveno ciclo"), 72),
    uno("Ranking con puntos de opción múltiple", .cr_g("p_lollipop", var = "egresados$mejoras"), 72),
    uno("Ranking en barras", .cr_g("p_barras_agrupadas", var = "egresados$mejoras"), 73),
    uno("Barras de 0 a 100 %, sin marcas", .cr_g("p_barras_agrupadas", var = "egresados$mejoras", overrides = list(usar_eje_libre = FALSE)), 74),
    uno("Barras de 0 a 100 %, con marcas", .cr_g("p_barras_agrupadas", var = "egresados$mejoras", overrides = list(usar_eje_libre = FALSE, marcas_eje = TRUE)), 75),
    uno("Dicotómica", .cr_g("p_dicotomica", var = "egresados$trabaja"), 76),

    # ---- 2.2 Escalas -------------------------------------------------------------------------------------------------
    cap("Escalas de acuerdo", "fondo", 3, "Barras apiladas con Top Two Box y Bottom Two Box"),
    subcap("Multiapiladas en sus cinco lecturas"),
    uno("Preguntas, con Top Two Box (escala de utilidad)",
        .cr_g("p_barras_multiapiladas", modo = "var", vars = as.list(paste0("egresados$oe_", seq_along(.CR_OE))),
              top2box = TRUE, top2box_labels = c("Útil", "Totalmente útil")), 78),
    uno("Públicos por tema, misma escala en los tres públicos, con Top Two Box y Bottom Two Box",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = list(`Servicios de tutoría` = pub("tutoria")),
              top2box = TRUE, top2box_labels = ttb, overrides = list(columna_bottom2box = TRUE, bottom2box_labels = btb)), 79),
    # Escalas distintas entre públicos (docentes en cinco puntos, estudiantes y egresados en cuatro): van en bloques
    # separados (Gonzalo, 2026-10-14). Juntas en un mismo tema, la exportación lo rechaza y sugiere esto.
    uno("Escalas distintas entre públicos, en bloques separados",
        .cr_g("p_barras_multiapiladas", modo = "multilista", top2box = TRUE, top2box_labels = ttb, bloques = list(
          list(modo = "var", vars = as.list(paste0("docentes$serv_", seq_along(.CR_SERVICIOS))), titulo = "Docentes (escala de cinco puntos)"),
          list(modo = "var_cruce", titulo = "Estudiantes y egresados (escala de cuatro puntos)",
               vars = stats::setNames(lapply(seq_along(.CR_SERVICIOS), function(i) c(paste0("estudiantes$serv_", i), paste0("egresados$p40_", i))), .CR_SERVICIOS)))), 79),
    uno("Públicos por tema, escala equivalente con otra caja en las etiquetas y otros nombres de variable",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce",
              vars = stats::setNames(lapply(seq_along(.CR_SERVICIOS), function(i) c(paste0("estudiantes$serv_", i), paste0("egresados$p40_", i))), .CR_SERVICIOS),
              top2box = TRUE, top2box_labels = ttb), 79),
    uno("Públicos por tema, seis temas en la misma escala",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = comp_pub, top2box = TRUE, top2box_labels = ttb), 79),
    uno("Una pregunta por grupos",
        .cr_g("p_barras_multiapiladas", modo = "cruce", var = "estudiantes$tutoria", cruces = "estudiantes$ciclo",
              top2box = TRUE, top2box_labels = ttb), 79),
    uno("Preguntas por grupos",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = gestion[1:3], cruces = "estudiantes$sexo",
              top2box = TRUE, top2box_labels = ttb), 79),
    uno("Bloques con escalas distintas",
        .cr_g("p_barras_multiapiladas", modo = "multilista", top2box = TRUE, top2box_labels = ttb, bloques = list(
          list(modo = "var", vars = as.list(gestion[1:3]), titulo = "Gestión"),
          list(modo = "var", vars = as.list(paste0("estudiantes$satisf_", 1:3)), titulo = "Atención", top2box_labels = c("Satisfecho", "Muy satisfecho")))), 79),
    subcap("Ajustes de las escalas"),
    uno("Temas anchos y sin respuestas por público",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = comp_pub[1:3], ancho_tema = "ancho", mostrar_respuestas = FALSE,
              top2box = TRUE, top2box_labels = ttb), 79),
    uno("Categorías en 0 % y sin Top Two Box",
        .cr_g("p_barras_multiapiladas", modo = "var", vars = as.list(gestion), mostrar_categorias_en_cero = TRUE), 79),
    uno("Barras apiladas", .cr_g("p_barras_apiladas", var = "estudiantes$satisf_general"), 77),
    uno("Barras apiladas por grupos", .cr_g("p_barras_apiladas", var = "estudiantes$satisf_general", cruces = "estudiantes$ciclo"), 77),
    falta("Peso en la satisfacción", 98, "El peso por regresión es una propuesta del recetario; las escalas de los aspectos sí se grafican arriba."),

    # ---- 2.3 Números -------------------------------------------------------------------------------------------------
    cap("Números", NULL, 4, "Distribuciones, promedios y cifras"),
    uno("Histograma", .cr_g("p_histograma", var = "egresados$anio_egreso"), 81),
    uno("Histograma por grupos", .cr_g("p_histograma", var = "egresados$meses_empleo", grupo = "egresados$sexo"), 81),
    uno("Indicador numérico", .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "mean", cruce = "estudiantes$ciclo"), 82),
    uno("Indicador numérico con mediana", .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "median", cruce = "estudiantes$ciclo"), 82),
    uno("Diagrama de caja", .cr_g("p_boxplot", var = "egresados$meses_empleo", cruce = "egresados$situacion"), 83),
    uno("Media y rango", .cr_g("p_media_rango", var = "egresados$meses_empleo", cruce = "egresados$situacion"), 84),
    falta("Conteos por año", 85, "La matriz de conteos con totales es una propuesta del recetario."),
    sl("p_slide_cifras_y_graficos", titulo = "Cifras destacadas (p172)",
       cifra_izquierda = g_cifra("conoce_mision", "conoce la misión"),
       cifra_centro = g_cifra("consulta_mision", "sabe dónde consultarla"),
       cifra_derecha = .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "mean", titulo = "Horas de estudio a la semana"),
       grafico_izquierda = g_sexo, grafico_derecha = g_ciclo),

    # ---- 2.4 Comparaciones -------------------------------------------------------------------------------------------
    cap("Comparaciones", NULL, 5, "Públicos, brechas, mediciones y cuadrantes"),
    uno("Puntos comparativos", .cr_g("p_puntos_comparativos", var = "estudiantes$tutoria", cruces = "estudiantes$ciclo", corte = "3,4"), 87),
    uno("Brecha entre dos públicos",
        .cr_g("p_dumbbell", vars = stats::setNames(lapply(seq_along(.CR_COMPETENCIAS), function(i) pub(paste0("comp_", i), c("docentes", "estudiantes"))), .CR_COMPETENCIAS),
              corte = "3,4", mostrar_brecha = TRUE), 88),
    uno("Serie temporal de dos mediciones",
        .cr_g("p_serie_temporal", vars = list(`Servicios de tutoría` = paste0(c("estudiantes_2021", "estudiantes"), "$tutoria")), corte = "3,4"), 89),
    uno("Serie temporal con varias mediciones",
        .cr_g("p_serie_temporal", vars = stats::setNames(lapply(1:3, function(i) paste0(c("estudiantes_2018", "estudiantes_2021", "estudiantes"), "$comp_", i)),
                                                         .CR_COMPETENCIAS[1:3]), corte = "3,4"), 90),
    uno("Matriz de cuadrantes",
        .cr_g("p_matriz_cuadrantes", temas = stats::setNames(lapply(seq_along(.CR_GESTION), function(i) as.list(pub(paste0("gestion_", i), c("estudiantes", "docentes")))),
                                                             paste("Gestión", seq_along(.CR_GESTION))),
              corte_x = "3,4", corte_y = "3,4"), 91),

    # ---- 2.5 Competencias y dimensiones ------------------------------------------------------------------------------
    cap("Competencias y dimensiones", NULL, 6, "Radares, mapas de calor e índices"),
    uno("Radar con tabla", .cr_g("p_radar", modo = "publicos", vars = comp_pub, corte = "3,4", mostrar_tabla = TRUE), 93),
    uno("Radar sin tabla", .cr_g("p_radar", modo = "publicos", vars = comp_pub, corte = "3,4", mostrar_tabla = FALSE), 93),
    uno("Radar de opción múltiple", .cr_g("p_radar", modo = "sm", var = "egresados$mejoras"), 93),
    uno("Tabla de Top Two Box", .cr_g("p_tabla", modo = "box", vars = stats::setNames(as.list(paste0("estudiantes$comp_", seq_along(.CR_COMPETENCIAS))), .CR_COMPETENCIAS),
                                     box_labels = ttb), 198),
    falta("Puntos por competencia, alternativa al radar", 94, "Por verificar si «Puntos comparativos» lo cubre con rangos por actor."),
    uno("Mapa de calor por dimensión", .cr_g("p_dim_heatmap", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$ciclo"), 95),
    uno("Mapa de calor por criterio", .cr_g("p_dim_heatmap_criterios", config_criterios = list(
          list(id = "tec", titulo = "Técnicas", vars = as.list(paste0("r100_comp_", 1:3))),
          list(id = "fin", titulo = "Gestión financiera", vars = as.list(paste0("r100_comp_", c(4, 6)))),
          list(id = "neg", titulo = "Visión empresarial", vars = list("r100_comp_5"))), source = "estudiantes"), 96),
    uno("Comparativo de dimensiones", .cr_g("p_dim_comparativo_radarbar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$sexo"), 97),
    uno("Radar por dimensiones", .cr_g("p_dim_radar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$sexo"), 99),

    # ---- 2.6 Preguntas abiertas ---------------------------------------------------------------------------------------
    cap("Preguntas abiertas", NULL, 7, "Palabras, frases y temas"),
    uno("Nube de palabras", .cr_g("p_nube_palabras", var = "egresados$comentario"), 101),
    uno("Nube de palabras con ranking", .cr_g("p_nube_palabras", var = "egresados$comentario", mostrar_ranking = TRUE), 102),
    falta("Nube de frases", 103, "La nube cuenta palabras sueltas; las frases de dos y tres palabras no existen todavía."),
    falta("Pregunta abierta: frases y temas", 104, "Depende de la codificación de la pregunta abierta."),

    # ---- 2.7 Mapas -------------------------------------------------------------------------------------------------------
    cap("Mapas", NULL, 8, "Resultado por distrito y cobertura territorial"),
    uno("Mapa de Lima: resultado por distrito", .cr_g("p_mapa_resultado_distrital", var = "egresados$satisf_general", cruces = "egresados$distrito",
                                                     corte = "3,4", rotulo = "Satisfechos o muy satisfechos"), 107),
    falta("Mapas territoriales de cobertura", "106, p108–p109", "Necesitan el contexto territorial de Hojas de ruta y Monitoreo; se prueban con el proyecto de referencia acnur_acg."),

    # ---- 2.8 Significancia -------------------------------------------------------------------------------------------
    cap("Diferencias significativas", NULL, 9),
    uno("Ranking con diferencias significativas", .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision", cruces = "estudiantes$sexo",
                                                      mostrar_significancia = TRUE), 111),
    uno("Apiladas con diferencias significativas", .cr_g("p_barras_apiladas", var = "estudiantes$tutoria", cruces = "estudiantes$sexo",
                                                       mostrar_significancia = TRUE), 111),
    uno("Tabla de letras entre públicos", .cr_g("p_significancia_publicos",
         vars = list(`Conoce la misión` = c("docentes$conoce_mision", "estudiantes$conoce_mision", "egresados$conoce_mision"),
                     `Sabe dónde consultarla` = c("docentes$consulta_mision", "estudiantes$consulta_mision", "egresados$consulta_mision")),
         corte = "Sí"), 112),

    # ---- 3. Composiciones ----------------------------------------------------------------------------------------------
    cap("Composiciones de lámina", NULL, 10, "Las disposiciones del recetario con varios gráficos"),
    sl("p_slide_1_grafico_narrativo", titulo = "Un gráfico narrativo", grafico = g_ciclo, texto = TXT),
    sl("p_slide_grafico_texto_derecha", titulo = "Gráfico y texto a la derecha", grafico = g_ciclo, texto = TXT),
    sl("p_slide_grafico_texto_izquierda", titulo = "Gráfico y texto a la izquierda", grafico = g_ciclo, texto = TXT),
    sl("p_slide_2_graficos", titulo = "Dos gráficos", izquierda = g_sexo, derecha = g_ciclo),
    sl("p_slide_2_graficos_narrativo", titulo = "Dos gráficos narrativo", izquierda = g_sexo, derecha = g_ciclo, texto = TXT),
    sl("p_slide_2_graficos_texto_izquierda", titulo = "Dos gráficos y texto a la izquierda", grafico_1 = g_sexo, grafico_2 = g_ciclo, texto = TXT),
    sl("p_slide_2_graficos_texto_derecha", titulo = "Dos gráficos y texto a la derecha", grafico_1 = g_sexo, grafico_2 = g_ciclo, texto = TXT),
    sl("p_slide_2_graficos_vertical", titulo = "Dos gráficos en vertical", superior = g_ciclo, inferior = g_situacion),
    sl("p_slide_2_graficos_asimetrico", titulo = "Dos gráficos asimétricos", principal = g_ciclo, apoyo = g_sexo),
    # Dependencia entre los dos gráficos de la lámina (Gonzalo, 2026-10-14: «la dependencia no es un tipo de gráfico»).
    sl("p_slide_2_graficos", titulo = "Llave sobre varias categorías (p194)", izquierda = .cr_g("p_barras_agrupadas", var = "egresados$situacion"),
       derecha = .cr_g("p_barras_agrupadas", var = "egresados$relacion"),
       meta = list(dependencia = list(de = "izquierda", habilita = c("Dependiente", "Independiente", "Dependiente e independiente")))),
    sl("p_slide_3_graficos_fila", titulo = "Tres gráficos en fila", izquierda = g_sexo, centro = g_mision, derecha = g_titulo),
    sl("p_slide_3_graficos_2mas1", titulo = "Tres gráficos, dos más uno", superior_izquierda = g_sexo, inferior_izquierda = g_mision, derecha = g_ciclo),
    sl("p_slide_3_graficos_1mas2", titulo = "Tres gráficos, uno más dos", izquierda = g_ciclo, superior_derecha = g_sexo, inferior_derecha = g_mision),
    sl("p_slide_3_graficos_1arriba", titulo = "Tres gráficos, uno arriba", superior = g_ciclo, inferior_izquierda = g_sexo, inferior_derecha = g_mision),
    sl("p_slide_4_graficos", titulo = "Cuatro gráficos", superior_izquierda = g_sexo, superior_derecha = g_ciclo,
       inferior_izquierda = g_mision, inferior_derecha = g_situacion),
    sl("p_slide_4_graficos", titulo = "Base chica en cuatro paneles (p196–p197)",
       superior_izquierda = .cr_g("p_barras_agrupadas", var = "docentes$grado", filtros = list(sexo = "3")),
       superior_derecha = .cr_g("p_donut", var = "docentes$conoce_mision", filtros = list(grado = "4")),
       inferior_izquierda = .cr_g("p_donut", var = "docentes$consulta_mision", filtros = list(grado = "4")),
       inferior_derecha = .cr_g("p_barras_agrupadas", var = "docentes$sexo", filtros = list(grado = "4"))),
    # P5 (checklist-poblacion-y-filtro): la tira del recetario es de dicotómicas (recetario_m2c.R:26-35).
    sl("p_slide_3_graficos_poblacion_tira", titulo = "Población en tira", superior = .cr_g("p_barras_agrupadas", var = "egresados$sexo"),
       medio = .cr_g("p_barras_agrupadas", var = "egresados$titulo"), inferior = .cr_g("p_barras_agrupadas", var = "egresados$trabaja")),
    # P5/D5: corona y cifras con lo que dibuja el recetario (p161, p170): dicotomía, barras y cifras con su unidad. La torta y la
    # dona en un panel (P1) se prueban en las de cinco y seis.
    sl("p_slide_3_graficos_poblacion_corona", titulo = "Población en corona", superior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision"),
       superior_derecha = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo"), inferior = g_ciclo),
    sl("p_slide_3_graficos_poblacion_cifras", titulo = "Población con cifras", superior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision"),
       derecha = g_ciclo, cifra_superior = .cr_g("p_numerico", var = "estudiantes$edad", metrica = "median", titulo = "Edad mediana (años)"),
       inferior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo"),
       cifra_inferior = .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "mean", titulo = "Horas de estudio a la semana (horas)")),
    sl("p_slide_5_graficos_poblacion", titulo = "Población: cinco gráficos", grafico_superior_1 = g_sexo, grafico_superior_2 = g_ciclo,
       grafico_superior_3 = g_mision, grafico_inferior_1 = g_titulo, grafico_inferior_2 = g_situacion),
    sl("p_slide_6_graficos_poblacion", titulo = "Población: seis gráficos", grafico_superior_1 = g_sexo, grafico_superior_2 = g_ciclo,
       grafico_superior_3 = g_mision, grafico_inferior_1 = g_titulo, grafico_inferior_2 = g_situacion,
       grafico_inferior_3 = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo")),
    # Pregunta filtro y subpregunta con filtro dicotómico (p192 abajo, p193 al costado); la de varias categorías, arriba.
    sl("p_slide_2_graficos_vertical", titulo = "Pregunta filtro y subpregunta (p192)", superior = .cr_g("p_barras_agrupadas", var = "egresados$trabaja"),
       inferior = .cr_g("p_barras_apiladas", var = "egresados$relacion"), meta = list(dependencia = list(de = "superior", habilita = "Sí"))),
    sl("p_slide_2_graficos", titulo = "Filtro al costado (p193)", izquierda = .cr_g("p_donut", var = "egresados$trabaja"),
       derecha = .cr_g("p_barras_agrupadas", var = "egresados$relacion"), meta = list(dependencia = list(de = "izquierda", habilita = "Sí"))),

    # ---- Cierres -----------------------------------------------------------------------------------------------------------
    sl("p_slide_cierre", variante = "contraportada", correo = "pulsopucp@pucp.edu.pe", direccion = "Av. Universitaria 1801, San Miguel", web = "pulso.pucp.edu.pe"),
    sl("p_slide_cierre", variante = "banda_azul", correo = "pulsopucp@pucp.edu.pe", web = "pulso.pucp.edu.pe"),
    sl("p_slide_cierre", variante = "banda_clara", correo = "pulsopucp@pucp.edu.pe", web = "pulso.pucp.edu.pe"),
    sl("p_slide_cierre", variante = "contacto", correo = "pulsopucp@pucp.edu.pe", web = "pulso.pucp.edu.pe"),
    sl("p_slide_cierre", variante = "tres_columnas", correo = "pulsopucp@pucp.edu.pe", direccion = "Av. Universitaria 1801, San Miguel", web = "pulso.pucp.edu.pe")
  )
}
