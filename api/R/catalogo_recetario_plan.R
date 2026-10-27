# Plan del catálogo del recetario (checklist-catalogo-recetario-2026-10-14.md, K3–K5; checklist-recetario-desfase-2026-10-26.md, C1).
#
# El catálogo es EL recetario del motor (ADR 0092, D1) y se lee como un informe real (Gonzalo, 2026-10-26: «Como informe
# real»): el antetítulo es el capítulo, el título es un hallazgo de ejemplo que dice lo que el gráfico dibuja con los datos
# sintéticos, el subtítulo es la pregunta que mide y el pie, «Base: N <público>», lo pone el preset de base. El nombre del
# estilo, su graficador, sus opciones, cuándo usarlo y la página del recetario histórico van en las NOTAS DEL ORADOR
# (`meta$notas`, lamina_notas_orador.R), nunca en la lámina.
#
# Los hallazgos se verificaron contra el render del catálogo (pdftotext del PPT): si se cambian los datos o las opciones
# de un gráfico, hay que releer las cifras y reescribir el título. Lo que el motor aún no produce no entra al catálogo: se
# lista en «Estilos que el motor aún no produce» del checklist del desfase.

.cr_g <- function(graficador, ...) list(graficador = graficador, args = list(...))

#' Opciones de un gráfico para la nota del orador: lo que lo distingue, sin las referencias a variables
#' @keywords internal
.cr_opciones <- function(args) {
  fuera <- c("var", "vars", "bloques", "temas", "config_criterios", "source", "cruces", "cruce", "grupo", "filtros", "rotulo", "titulo")
  fmt <- function(k, v) {
    if (is.list(v) && !is.null(names(v)) && length(v)) return(paste(vapply(names(v), function(n) fmt(n, v[[n]]), ""), collapse = ", "))
    v <- unlist(v, use.names = FALSE)
    if (!length(v)) return(NULL)
    if (is.character(v)) v <- sprintf("\"%s\"", v)
    paste0(k, " = ", if (length(v) == 1L) v else paste0("c(", paste(v, collapse = ", "), ")"))
  }
  partes <- unlist(lapply(setdiff(names(args), fuera), function(k) fmt(k, args[[k]])))
  if (!length(partes)) "las de defecto" else paste(partes, collapse = ", ")
}

#' Nota del orador con la ficha del estilo, en el formato fijo del catálogo
#' @keywords internal
.cr_nota <- function(estilo, graficador, uso, opciones = "las de defecto", pagina = NULL) {
  paste0("Estilo: ", estilo, " · Graficador: ", graficador, " · Opciones: ", opciones, " · Úsalo cuando: ", uso,
         if (!is.null(pagina)) paste0(" · Referencia histórica: p", pagina, " de recetario-moderna.pptx") else "")
}

.catalogo_recetario_plan <- function() {
  n <- 0L
  sl <- function(tipo, ..., meta = NULL) {
    n <<- n + 1L
    payload <- list(...)
    # La cifra y su «%» no se separan al partir la línea (un título de dos líneas dejaba «32» arriba y «%» abajo).
    for (k in intersect(c("titulo", "texto", "bullets"), names(payload))) payload[[k]] <- gsub(" %", "\u00a0%", payload[[k]], fixed = TRUE)
    if (length(meta)) payload$meta <- meta
    list(id = sprintf("cr-%03d", n), tipo = tipo, payload = payload)
  }
  # Lámina de un gráfico: hallazgo, pregunta (subtítulo; NULL donde el gráfico ya la encabeza) y la ficha en las notas.
  uno <- function(titulo, pregunta, grafico, estilo, uso, pagina = NULL) {
    nota <- .cr_nota(estilo, grafico$graficador, uso, .cr_opciones(grafico$args), pagina)
    sl("p_slide_1_grafico", titulo = titulo, subtitulo = pregunta, grafico = grafico, meta = list(notas = nota))
  }
  # Lámina de estructura o composición: la ficha dice el tipo de lámina como graficador.
  lam <- function(tipo, ..., estilo, uso, pagina = NULL, opciones = "las de defecto", meta = list()) {
    meta$notas <- .cr_nota(estilo, tipo, uso, opciones, pagina)
    sl(tipo, ..., meta = meta)
  }
  cap <- function(titulo, variante, numero, subtitulo, estilo, uso) {
    meta <- list(numero = as.character(numero),
                 notas = .cr_nota(estilo, "p_slide_seccion", uso, if (is.null(variante)) "las de defecto" else sprintf("meta$variante = \"%s\"", variante)))
    if (!is.null(variante)) meta$variante <- variante
    sl("p_slide_seccion", titulo = titulo, subtitulo = subtitulo, meta = meta)
  }
  subcap <- function(titulo, variante = NULL, estilo = "Subcapítulo sobrio", uso = "abres una parte de un capítulo sin cambiar de tema") {
    op <- paste0("meta$nivel = \"subcapitulo\"", if (!is.null(variante)) sprintf(", meta$variante = \"%s\"", variante) else "")
    meta <- list(nivel = "subcapitulo", notas = .cr_nota(estilo, "p_slide_seccion", uso, op))
    if (!is.null(variante)) meta$variante <- variante
    sl("p_slide_seccion", titulo = titulo, meta = meta)
  }
  pub <- function(v, bases = c("docentes", "estudiantes", "egresados")) paste0(bases, "$", v)
  ttb <- c("De acuerdo", "Totalmente de acuerdo")
  btb <- c("Totalmente en desacuerdo", "En desacuerdo")
  # Las apiladas declaran sus respuestas de la caja: sin ellas el motor quita la columna Top Two Box y avisa.
  sat <- c("Satisfecho", "Muy satisfecho")
  gestion <- paste0("estudiantes$gestion_", seq_along(.CR_GESTION))
  comp_pub <- stats::setNames(lapply(seq_along(.CR_COMPETENCIAS), function(i) pub(paste0("comp_", i))), .CR_COMPETENCIAS)
  g_ciclo <- .cr_g("p_barras_agrupadas", var = "estudiantes$ciclo")
  g_sexo <- .cr_g("p_pie", var = "estudiantes$sexo")
  # Las composiciones grafican una sola base (estudiantes): mezclar públicos en una lámina es un aviso legítimo.
  g_mision <- .cr_g("p_donut", var = "estudiantes$conoce_mision")
  g_titulo <- .cr_g("p_donut", var = "estudiantes$consulta_mision")
  g_situacion <- .cr_g("p_barras_agrupadas", var = "estudiantes$tutoria")
  g_cifra <- function(v, rotulo) .cr_g("p_cifra", var = paste0("estudiantes$", v), modo = "porcentaje", categoria = "1", rotulo = rotulo)
  Q_GESTION <- "¿Qué tan de acuerdo está con las siguientes afirmaciones sobre la gestión de la Unidad?"
  Q_COMP <- "¿Qué tan de acuerdo está en que la formación desarrolla cada competencia?"
  Q_SERV <- "¿Qué tan de acuerdo está en que cada servicio responde a las necesidades?"
  Q_MEJORAS <- "¿Qué podría mejorar la carrera?"
  CIERRE <- list(correo = "pulsopucp@pucp.edu.pe", web = "pulso.pucp.edu.pe")
  DIR <- "Av. Universitaria 1801, San Miguel"
  U_POBLACION <- "describes a quién representa la encuesta antes de los resultados"

  list(
    # ---- Apertura ----------------------------------------------------------------------------------------------------
    lam("p_slide_portada", titulo = "Estudio de percepción del servicio educativo", subtitulo = "Catálogo del recetario · datos sintéticos",
        fecha = "Octubre 2026", meta = list(variante = "centrada"),
        estilo = "Portada centrada", uso = "abres el informe; es la portada de siempre", opciones = "meta$variante = \"centrada\""),
    lam("p_slide_indice", titulo = "Índice", estilo = "Índice automático", uso = "el informe tiene más de tres capítulos; se arma con los separadores del plan"),
    lam("p_slide_objetivo_icono", titulo = "Objetivo del estudio",
        texto = "Conocer la percepción de **docentes, estudiantes y egresados** sobre el servicio educativo de la Facultad.",
        meta = list(variante = "clasica", actores = c("Docentes", "Estudiantes", "Egresados")),
        estilo = "Objetivo con íconos de actores", uso = "el estudio consulta a varios públicos y conviene nombrarlos al inicio",
        opciones = "meta$variante = \"clasica\", meta$actores"),
    lam("p_slide_tabla_tecnica", titulo = "Ficha técnica",
        filas = paste("Universo: docentes, estudiantes y egresados de la Facultad",
                      "Técnica: encuesta en línea autoadministrada",
                      "Muestra: 52 docentes, 172 estudiantes y 178 egresados",
                      "Trabajo de campo: datos sintéticos para el catálogo", sep = "\n"),
        estilo = "Ficha técnica", uso = "documentas universo, técnica, muestra y campo"),
    lam("p_slide_top_two_box", titulo = "Top Two Box", estilo = "Cómo leer: Top Two Box",
        uso = "el informe resume escalas con la suma de sus dos valores superiores"),
    lam("p_slide_redondeo", titulo = "Cómo se redondean las cifras", estilo = "Cómo leer: redondeo",
        uso = "hay cifras que no suman 100 % por el redondeo y conviene explicarlo una vez"),

    # ---- 1. Reglas de la identidad (P5) ------------------------------------------------------------------------------
    # La constitución del motor: las láminas leen estandar_pulso.json (lamina_estandar.R), así que lo que muestran es lo
    # que el motor pinta. Gonzalo, 2026-10-27: «el recetario es la fuente de verdad y la constitución».
    cap("Reglas de la identidad", "numero", 1, "Los colores, su significado y la escala tipográfica del motor", "Capítulo con número grande",
        "abres un capítulo del informe"),
    lam("p_slide_estandar", parte = "respuestas", estilo = "Reglas: colores de las respuestas",
        uso = "necesitas saber qué color lleva cada respuesta y por qué; es la paleta que el motor pone a una lista sin colores",
        opciones = "parte = \"respuestas\""),
    lam("p_slide_estandar", parte = "apoyo", estilo = "Reglas: colores de apoyo",
        uso = "pintas públicos, barras de una serie, tablas de calor o mapas", opciones = "parte = \"apoyo\""),
    lam("p_slide_estandar", parte = "colores", estilo = "Reglas: colores con nombre de la lámina",
        uso = "diseñas una pieza nueva y necesitas el código exacto de un color del motor", opciones = "parte = \"colores\""),
    lam("p_slide_estandar", parte = "tipografia", estilo = "Reglas: escala tipográfica",
        uso = "necesitas el tamaño de cada texto de la lámina", opciones = "parte = \"tipografia\""),

    # ---- 2. Perfil del encuestado ------------------------------------------------------------------------------------
    cap("Perfil del encuestado", "numero", 2, "Quiénes respondieron la encuesta", "Capítulo con número grande", "abres un capítulo del informe"),
    subcap("Estudiantes", "barra", "Subcapítulo con barra", "el subcapítulo merece su propia lámina y una marca visible"),
    uno("Octavo y noveno ciclo concentran cada uno el 20 % de los estudiantes encuestados", "Nivel curricular del estudiante",
        .cr_g("p_barras_categoricas", var = "estudiantes$ciclo", formato_valor = "porcentaje_n"),
        "Columnas de una categórica con porcentaje y casos", "una pregunta de una respuesta con pocas categorías ordenadas", 68),
    uno("Quinto y décimo ciclo son los menos representados, con 13 % cada uno", "Nivel curricular del estudiante",
        .cr_g("p_barras_categoricas", var = "estudiantes$ciclo", formato_valor = "porcentaje"),
        "Columnas de una categórica, sólo porcentaje", "los casos no aportan a la lectura", 68),
    uno("Octavo y noveno ciclo encabezan la participación, con 20 % cada uno", "Nivel curricular del estudiante",
        .cr_g("p_lollipop", var = "estudiantes$ciclo"), "Ranking con puntos", "quieres ordenar las categorías de mayor a menor", 72),
    uno("Octavo, noveno y séptimo son los ciclos más numerosos; noveno reúne el 20 %", "Nivel curricular del estudiante",
        .cr_g("p_lollipop", var = "estudiantes$ciclo", top_n = 3, resaltar = "Noveno ciclo"),
        "Ranking con puntos, primeras categorías y una resaltada", "importan las primeras y una categoría merece atención", 72),
    uno("Los estudiantes dedican entre 17 y 18 horas semanales al estudio en todos los ciclos", "Horas de estudio a la semana",
        .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "mean", cruce = "estudiantes$ciclo"),
        "Indicador numérico por grupos (media)", "comparas un promedio entre grupos", 82),
    uno("Sexto ciclo marca la mediana más alta de horas de estudio: 20 a la semana", "Horas de estudio a la semana",
        .cr_g("p_numerico", var = "estudiantes$horas_estudio", metrica = "median", cruce = "estudiantes$ciclo"),
        "Indicador numérico por grupos (mediana)", "la variable tiene valores extremos y la media engaña", 82),
    lam("p_slide_cifras_y_graficos", titulo = "El 59 % de los estudiantes conoce la misión y el 75 % sabe dónde consultarla",
        cifra_izquierda = g_cifra("conoce_mision", "conoce la misión"),
        cifra_centro = g_cifra("consulta_mision", "sabe dónde consultarla"),
        cifra_derecha = .cr_g("p_cifra", var = "estudiantes$horas_estudio", modo = "media", unidad = "horas", rotulo = "Horas de estudio a la semana"),
        grafico_izquierda = g_sexo, grafico_derecha = g_ciclo,
        estilo = "Cifras destacadas con dos gráficos", uso = "abres un perfil con tres cifras clave y su composición", pagina = 172),
    lam("p_slide_1_grafico_narrativo", titulo = "La participación crece hacia los últimos ciclos", grafico = g_ciclo,
        texto = "Octavo y noveno ciclo reúnen el 20 % de los estudiantes cada uno; quinto y décimo, el 13 %.",
        estilo = "Un gráfico con texto narrativo", uso = "el gráfico necesita una frase que guíe la lectura"),
    lam("p_slide_grafico_texto_derecha", titulo = "Los ciclos intermedios y finales concentran la participación de los estudiantes", grafico = g_ciclo,
        texto = "Séptimo, octavo y noveno ciclo reúnen el 19 %, el 20 % y el 20 % de los estudiantes.",
        estilo = "Gráfico y texto a la derecha", uso = "el texto explica el gráfico y cabe en una columna"),
    lam("p_slide_grafico_texto_izquierda", titulo = "Quinto y décimo ciclo aportan el 13 % de los estudiantes cada uno", grafico = g_ciclo,
        texto = "Los extremos de la carrera son los grupos con menos casos y sus cifras se leen con cautela.",
        estilo = "Gráfico y texto a la izquierda", uso = "el texto se lee antes que el gráfico"),
    lam("p_slide_2_graficos", titulo = "Las mujeres son el 52 % de los estudiantes encuestados", izquierda = g_sexo, derecha = g_ciclo,
        estilo = "Dos gráficos lado a lado", uso = U_POBLACION),
    lam("p_slide_2_graficos_narrativo", titulo = "Mujeres y hombres se reparten casi por mitades: 52 % y 45 %", izquierda = g_sexo, derecha = g_ciclo,
        texto = "El 3 % prefiere no declarar su sexo; ningún ciclo supera el 20 % de los encuestados.",
        estilo = "Dos gráficos con texto narrativo", uso = "dos gráficos comparten una lectura que conviene escribir"),
    lam("p_slide_2_graficos_texto_izquierda", titulo = "Más de la mitad de los estudiantes encuestados son mujeres", grafico_1 = g_sexo, grafico_2 = g_ciclo,
        texto = "Las mujeres son el 52 % y los hombres el 45 %.",
        estilo = "Dos gráficos y texto a la izquierda", uso = "un texto introduce dos gráficos de perfil"),
    lam("p_slide_2_graficos_texto_derecha", titulo = "Octavo y noveno ciclo son los grupos más numerosos", grafico_1 = g_sexo, grafico_2 = g_ciclo,
        texto = "Cada uno reúne el 20 % de los estudiantes encuestados.",
        estilo = "Dos gráficos y texto a la derecha", uso = "el texto concluye después de dos gráficos de perfil"),
    lam("p_slide_2_graficos_asimetrico", titulo = "Ningún ciclo supera el 20 % de los estudiantes", principal = g_ciclo, apoyo = g_sexo,
        estilo = "Dos gráficos asimétricos", uso = "un gráfico manda y el otro lo acompaña"),
    lam("p_slide_3_graficos_fila", titulo = "El 75 % de los estudiantes sabe dónde consultar la misión; la conoce el 59 %",
        izquierda = g_sexo, centro = g_mision, derecha = g_titulo,
        estilo = "Tres gráficos en fila", uso = "tres gráficos del mismo peso"),
    lam("p_slide_3_graficos_2mas1", titulo = "Seis de cada diez estudiantes conocen la misión de la Facultad",
        superior_izquierda = g_sexo, inferior_izquierda = g_mision, derecha = g_ciclo,
        estilo = "Tres gráficos, dos más uno", uso = "dos gráficos chicos acompañan a uno alto"),
    lam("p_slide_3_graficos_1mas2", titulo = "El 59 % de los estudiantes conoce la misión de la Facultad",
        izquierda = g_ciclo, superior_derecha = g_sexo, inferior_derecha = g_mision,
        estilo = "Tres gráficos, uno más dos", uso = "un gráfico alto abre y dos chicos completan"),
    lam("p_slide_3_graficos_1arriba", titulo = "Séptimo, octavo y noveno ciclo reúnen a 103 estudiantes",
        superior = g_ciclo, inferior_izquierda = g_sexo, inferior_derecha = g_mision,
        estilo = "Tres gráficos, uno arriba", uso = "un gráfico ancho arriba y dos debajo"),
    lam("p_slide_4_graficos", titulo = "Uno de cada cuatro estudiantes está totalmente de acuerdo con el servicio de tutoría (26 %)",
        superior_izquierda = g_sexo, superior_derecha = g_ciclo, inferior_izquierda = g_mision, inferior_derecha = g_situacion,
        estilo = "Cuatro gráficos", uso = "cuatro gráficos del mismo peso"),
    # P5/D5: corona y cifras con lo que dibuja el recetario (p161, p170): dicotomía, barras y cifras con su unidad.
    lam("p_slide_3_graficos_poblacion_corona", titulo = "El 41 % de los estudiantes no conoce la misión de la Facultad",
        superior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision"),
        superior_derecha = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo"), inferior = g_ciclo,
        estilo = "Población en corona", uso = U_POBLACION, pagina = 161),
    lam("p_slide_3_graficos_poblacion_cifras", titulo = "La mediana de edad de los estudiantes es 21 años y estudian 17.8 horas a la semana",
        superior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision"),
        derecha = g_ciclo, cifra_superior = .cr_g("p_cifra", var = "estudiantes$edad", modo = "mediana", unidad = "años", rotulo = "Edad mediana"),
        inferior_izquierda = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo"),
        cifra_inferior = .cr_g("p_cifra", var = "estudiantes$horas_estudio", modo = "media", unidad = "horas", rotulo = "Horas de estudio a la semana"),
        estilo = "Población con cifras en columna lateral", uso = "el perfil combina cifras con unidad y distribuciones", pagina = 170),
    lam("p_slide_5_graficos_poblacion", titulo = "Tres de cada cuatro estudiantes saben dónde consultar la misión",
        grafico_superior_1 = g_sexo, grafico_superior_2 = g_ciclo,
        grafico_superior_3 = g_mision, grafico_inferior_1 = g_titulo, grafico_inferior_2 = g_situacion,
        estilo = "Población en cinco gráficos", uso = U_POBLACION),
    lam("p_slide_6_graficos_poblacion", titulo = "Perfil de los estudiantes: 52 % mujeres y 59 % conoce la misión",
        grafico_superior_1 = g_sexo, grafico_superior_2 = g_ciclo,
        grafico_superior_3 = g_mision, grafico_inferior_1 = g_titulo, grafico_inferior_2 = g_situacion,
        grafico_inferior_3 = .cr_g("p_barras_agrupadas", var = "estudiantes$sexo"),
        estilo = "Población en seis gráficos", uso = U_POBLACION),
    subcap("Egresados", "banda", "Subcapítulo en banda", "el subcapítulo abre una parte larga y conviene marcarla con una banda"),
    uno("Dos de cada tres egresados aún no cuentan con título universitario", "¿Cuenta con título universitario?",
        .cr_g("p_pie", var = "egresados$titulo"), "Torta", "una pregunta de dos o tres respuestas que reparten un todo", 69),
    uno("El 84 % de los egresados cursó la carrera en modalidad presencial", "¿En qué modalidad cursó la carrera?",
        .cr_g("p_donut", var = "egresados$modalidad"),
        "Dona con tajadas chicas", "una distribución tiene categorías muy pequeñas: la guía radial las nombra sin encimarlas"),
    uno("La mitad de los egresados terminó la carrera desde 2021; el año con más egresos es 2024", "Año de egreso",
        .cr_g("p_histograma", var = "egresados$anio_egreso"), "Histograma", "describes la distribución de una variable numérica", 81),
    lam("p_slide_3_graficos_poblacion_tira", titulo = "El 76 % de los egresados trabaja y el 34 % tiene título universitario",
        superior = .cr_g("p_barras_agrupadas", var = "egresados$sexo"),
        medio = .cr_g("p_barras_agrupadas", var = "egresados$titulo"), inferior = .cr_g("p_barras_agrupadas", var = "egresados$trabaja"),
        estilo = "Población en tira", uso = "el perfil son varias dicotómicas que se leen de arriba abajo"),
    subcap("Docentes", "sin_lamina", "Subcapítulo sin lámina", "el subcapítulo es corto: su primera lámina lo anuncia en el antetítulo"),
    lam("p_slide_4_graficos", titulo = "Con bases de tres y siete docentes, las cifras se leen con cautela",
        superior_izquierda = .cr_g("p_barras_agrupadas", var = "docentes$grado", filtros = list(sexo = "3")),
        superior_derecha = .cr_g("p_donut", var = "docentes$conoce_mision", filtros = list(grado = "4")),
        inferior_izquierda = .cr_g("p_donut", var = "docentes$consulta_mision", filtros = list(grado = "4")),
        inferior_derecha = .cr_g("p_barras_agrupadas", var = "docentes$sexo", filtros = list(grado = "4")),
        estilo = "Base chica en cuatro paneles", uso = "los paneles tienen bases distintas y chicas: cada uno nombra la suya",
        pagina = "196–p197", opciones = "filtros por panel"),

    # ---- 3. Experiencia universitaria --------------------------------------------------------------------------------
    cap("Experiencia universitaria", "fondo", 3, "Misión, gestión de la Unidad y tutoría", "Capítulo con número de fondo", "abres un capítulo del informe"),
    subcap("Misión y propósitos"),
    uno("Seis de cada diez estudiantes conocen la misión y los propósitos de la Facultad", "¿Conoce la misión y los propósitos de la Facultad?",
        .cr_g("p_donut", var = "estudiantes$conoce_mision"), "Dona", "una pregunta Sí/No que conviene leer como parte de un todo", 70),
    subcap("Gestión de la Unidad"),
    uno("Las autoridades reúnen el mayor acuerdo: 47 % de acuerdo y 32 % totalmente de acuerdo", Q_GESTION,
        .cr_g("p_barras_divergentes", vars = as.list(gestion), n_negativas = 2, excluir_opciones = "SIN INF"),
        "Barras divergentes", "una batería de acuerdo se lee como desacuerdo frente a acuerdo", 71),
    uno("El 79 % está de acuerdo con la información de las autoridades; la biblioteca queda última con 64 %", Q_GESTION,
        .cr_g("p_barras_divergentes", vars = as.list(gestion), n_negativas = 2, excluir_opciones = "SIN INF", mostrar_saldo = TRUE, incluir_neutro = FALSE),
        "Barras divergentes con saldo y sin neutro", "importa el saldo de acuerdo de cada afirmación", 71),
    uno("Tres de cada cuatro estudiantes valoran cómo informan las autoridades; la biblioteca obtiene 60 %", Q_GESTION,
        .cr_g("p_barras_multiapiladas", modo = "var", vars = as.list(gestion), barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: seis preguntas de un público", "una batería de hasta seis afirmaciones de un público, ordenadas por Top Two Box", 79),
    uno("La biblioteca reúne el mayor desacuerdo: 8 % totalmente en desacuerdo y 27 % en desacuerdo", Q_GESTION,
        .cr_g("p_barras_multiapiladas", modo = "var", vars = as.list(gestion), mostrar_categorias_en_cero = TRUE,
              overrides = list(barra_extra = FALSE)),
        "Multiapiladas con categorías en 0 % y sin Top Two Box", "importa la distribución completa y no el resumen", 79),
    uno("Mujeres y hombres coinciden: 65 % de acuerdo con la agilidad de los procesos", Q_GESTION,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = gestion[1:2], cruces = "estudiantes$sexo",
              barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: preguntas por grupos", "comparas varias afirmaciones entre los grupos de un cruce (seis barras: 3 + 3)", 79),
    uno("Todos los aspectos de gestión y de atención superan el 50 % de valoración positiva", "Gestión y atención en la Unidad",
        .cr_g("p_barras_multiapiladas", modo = "multilista", barra_extra = list("top2box"), top2box_labels = ttb, bloques = list(
          list(modo = "var", vars = as.list(gestion[1:3]), titulo = "Gestión"),
          list(modo = "var", vars = as.list(paste0("estudiantes$satisf_", 1:3)), titulo = "Atención", top2box_labels = c("Satisfecho", "Muy satisfecho")))),
        "Multiapiladas en bloques con escalas distintas", "una lámina junta baterías con escalas distintas, cada una con su leyenda", 79),
    uno("Las gestiones 1, 3 y 5 obtienen el mayor acuerdo de estudiantes y docentes", Q_GESTION,
        .cr_g("p_matriz_cuadrantes", temas = stats::setNames(lapply(seq_along(.CR_GESTION), function(i) as.list(pub(paste0("gestion_", i), c("estudiantes", "docentes")))),
                                                             paste("Gestión", seq_along(.CR_GESTION))),
              corte_x = "3,4", corte_y = "3,4"),
        "Matriz de cuadrantes", "cruzas dos lecturas del mismo tema para priorizar", 91),
    subcap("Tutoría académica"),
    uno("En noveno ciclo, el 77 % reconoce el servicio de tutoría; en quinto, el 55 %", "La Unidad cuenta con servicios de tutoría académica.",
        .cr_g("p_barras_multiapiladas", modo = "cruce", var = "estudiantes$tutoria", cruces = "estudiantes$ciclo",
              barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: una pregunta por grupos", "una afirmación se compara entre los grupos de un cruce", 79),
    uno("El acuerdo con la tutoría varía 22 puntos entre ciclos: de 55 % a 77 %", "La Unidad cuenta con servicios de tutoría académica.",
        .cr_g("p_puntos_comparativos", var = "estudiantes$tutoria", cruces = "estudiantes$ciclo", corte = "3,4"),
        "Puntos comparativos", "comparas un solo porcentaje entre grupos con su n", 87),
    uno("El acuerdo con la tutoría se mantiene: 64 % en 2021 y 63 % en la medición actual", "La Unidad cuenta con servicios de tutoría académica.",
        .cr_g("p_serie_temporal", vars = list(`Servicios de tutoría` = paste0(c("estudiantes_2021", "estudiantes"), "$tutoria")), corte = "3,4"),
        "Serie temporal de dos mediciones", "comparas una medición con la anterior", 89),
    lam("p_slide_2_graficos_vertical", titulo = "El 20 % de los estudiantes está en desacuerdo con el servicio de tutoría y el 6 %, totalmente",
        superior = g_ciclo, inferior = g_situacion,
        estilo = "Dos gráficos en vertical", uso = "dos gráficos anchos se leen uno debajo del otro"),

    # ---- 4. Satisfacción con los servicios ---------------------------------------------------------------------------
    cap("Satisfacción con los servicios", NULL, 4, "Atención, biblioteca, bienestar y salud", "Capítulo con rótulo", "abres un capítulo del informe"),
    uno("El 72 % de los estudiantes está satisfecho o muy satisfecho con la atención", NULL,
        .cr_g("p_barras_apiladas", var = "estudiantes$satisf_general", overrides = list(top2box_labels = sat)),
        "Barra apilada de una pregunta", "una sola escala de un público; la pregunta encabeza la barra", 77),
    uno("Séptimo ciclo es el más satisfecho con la atención (91 %) y décimo el menos (47 %)", "En general, ¿qué tan satisfecho está con la atención en la Unidad?",
        .cr_g("p_barras_apiladas", var = "estudiantes$satisf_general", cruces = "estudiantes$ciclo", overrides = list(top2box_labels = sat)),
        "Barras apiladas por grupos", "una escala se compara entre los grupos de un cruce", 77),
    # E9 (tabla de calor pregunta × cruce con Top Two Box) queda fuera: en un proyecto de varias bases el motor no la dibuja
    # (`.heatmap_pc_espec` llama a `.tab_freq(var)` sin la fuente); ver «Estilos que el motor aún no produce» del checklist.
    uno("En los tres públicos, la biblioteca obtiene igual o más acuerdo que el bienestar estudiantil", Q_SERV,
        .cr_g("p_barras_multiapiladas", modo = "multilista", barra_extra = list("top2box"), top2box_labels = ttb, bloques = list(
          list(modo = "var", vars = as.list(paste0("docentes$serv_", 1:2)), titulo = "Docentes (escala de cinco puntos)"),
          list(modo = "var_cruce", titulo = "Estudiantes y egresados (escala de cuatro puntos)",
               vars = stats::setNames(lapply(1:2, function(i) c(paste0("estudiantes$serv_", i), paste0("egresados$p40_", i))), .CR_SERVICIOS[1:2])))),
        "Multiapiladas con escalas distintas entre públicos, en bloques", "los públicos responden la misma pregunta con escalas de distinto largo", 79),
    uno("Los egresados valoran más que los estudiantes la biblioteca y el bienestar; en salud ocurre lo contrario", Q_SERV,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce",
              vars = stats::setNames(lapply(seq_along(.CR_SERVICIOS), function(i) c(paste0("estudiantes$serv_", i), paste0("egresados$p40_", i))), .CR_SERVICIOS),
              barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: públicos por tema con escala equivalente", "los públicos usan la misma escala con otra caja en las etiquetas y otros nombres de variable", 79),

    # ---- 5. Comparación entre públicos -------------------------------------------------------------------------------
    cap("Comparación entre públicos", "numero", 5, "Docentes, estudiantes y egresados frente a los mismos temas", "Capítulo con número grande", "abres un capítulo del informe"),
    uno("Los egresados son los que menos desacuerdo expresan con la tutoría: 17 % frente a 25 % y 26 %", "La Unidad cuenta con servicios de tutoría académica.",
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = list(`Servicios de tutoría` = pub("tutoria")),
              barra_extra = list("top2box", "bottom2box"), top2box_labels = ttb, overrides = list(bottom2box_labels = btb)),
        "Multiapiladas: públicos por tema con Top Two Box y Bottom Two Box", "un tema se compara entre públicos con la misma escala", 79),
    uno("En tributación, el acuerdo de los docentes (91 %) supera en 19 puntos al de los estudiantes", Q_COMP,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = comp_pub[1:2], barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: dos temas de tres públicos (3 + 3)", "dos temas con tres públicos cada uno: seis barras, el máximo por lámina", 79),
    uno("Docentes y estudiantes coinciden en estados financieros y se separan en tributación", Q_COMP,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = lapply(comp_pub[1:3], `[`, 1:2), barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: tres temas de dos públicos (2 + 2 + 2)", "tres temas con dos públicos cada uno", 79),
    uno("En finanzas, los egresados (85 %) superan a los estudiantes (77 %)", Q_COMP,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = c(comp_pub[3], lapply(comp_pub[4], `[`, 2:3)), barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: un tema de tres públicos y otro de dos (3 + 2)", "los temas no tienen los mismos públicos", 79),
    uno("En costos y presupuestos, los estudiantes (78 %) superan a los egresados (73 %)", Q_COMP,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = lapply(comp_pub[5:6], `[`, 2:3), barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas: dos temas de dos públicos (2 + 2)", "dos temas con dos públicos", 79),
    uno("Los tres públicos coinciden en estados financieros: 86 % y 87 % de acuerdo", Q_COMP,
        .cr_g("p_barras_multiapiladas", modo = "var_cruce", vars = comp_pub[1:2], ancho_tema = "ancho", mostrar_respuestas = FALSE,
              barra_extra = list("top2box"), top2box_labels = ttb),
        "Multiapiladas con temas anchos y sin respuestas por público", "los temas tienen rótulos largos y el n por público no hace falta", 79),
    uno("La mayor brecha está en tributación: los docentes superan a los estudiantes por 17 puntos", Q_COMP,
        .cr_g("p_dumbbell", vars = stats::setNames(lapply(seq_along(.CR_COMPETENCIAS), function(i) pub(paste0("comp_", i), c("docentes", "estudiantes"))), .CR_COMPETENCIAS),
              corte = "3,4", mostrar_brecha = TRUE),
        "Brecha entre dos públicos", "comparas dos públicos en varios temas y la diferencia es el mensaje", 88),
    uno("Docentes, estudiantes y egresados coinciden en estados financieros, con 87 % cada uno", Q_COMP,
        .cr_g("p_radar", modo = "publicos", vars = comp_pub, corte = "3,4", mostrar_tabla = TRUE),
        "Radar de públicos con tabla", "comparas el perfil de 5 a 8 criterios entre públicos y las cifras deben leerse", 93),
    uno("En tributación, el perfil de los docentes se separa del de estudiantes y egresados", Q_COMP,
        .cr_g("p_radar", modo = "publicos", vars = comp_pub, corte = "3,4", mostrar_tabla = FALSE),
        "Radar de públicos sin tabla", "basta la forma del perfil", 93),
    uno("En auditoría, los tres públicos están entre 74 % y 78 % de acuerdo", Q_COMP,
        .cr_g("p_radar", modo = "publicos", vars = comp_pub[1:3], corte = "3,4"),
        "Comparativo por criterio (radar con menos de cinco criterios)", "comparas públicos en menos de cinco criterios: el motor cambia el radar por un comparativo y avisa", 94),

    # ---- 6. Competencias del perfil de egreso ------------------------------------------------------------------------
    cap("Competencias del perfil de egreso", "fondo", 6, "Objetivos educacionales, competencias e índices", "Capítulo con número de fondo", "abres un capítulo del informe"),
    uno("El 83 % de los egresados considera útil el primer objetivo educacional", "¿Qué tan útil le resultó cada objetivo educacional en su trabajo?",
        .cr_g("p_barras_multiapiladas", modo = "var", vars = as.list(paste0("egresados$oe_", seq_along(.CR_OE))),
              barra_extra = list("top2box"), top2box_labels = c("Útil", "Totalmente útil")),
        "Multiapiladas: preguntas con Top Two Box (escala de utilidad)", "una batería con una escala que no es de acuerdo", 78),
    uno("Estados financieros es la competencia mejor valorada por los estudiantes, con 87 %", Q_COMP,
        .cr_g("p_tabla", modo = "box", vars = stats::setNames(as.list(paste0("estudiantes$comp_", seq_along(.CR_COMPETENCIAS))), .CR_COMPETENCIAS),
              box_labels = ttb),
        "Tabla de Top Two Box", "muchos indicadores se leen mejor como cifras que como barras", 198),
    uno("Séptimo ciclo marca el índice de competencias técnicas más alto: 73, frente a 69 del total", "Índice de competencias (0 a 100), por nivel curricular",
        .cr_g("p_dim_heatmap", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$ciclo"),
        "Mapa de calor por dimensión", "comparas índices entre los grupos de un cruce con la diferencia al total", 95),
    uno("Estados financieros obtiene el puntaje más alto entre los criterios, con 73", "Puntaje de cada competencia (0 a 100), por dimensión",
        .cr_g("p_dim_heatmap_criterios", config_criterios = list(
          list(id = "tec", titulo = "Técnicas", vars = as.list(paste0("r100_comp_", 1:3))),
          list(id = "fin", titulo = "Gestión financiera", vars = as.list(paste0("r100_comp_", c(4, 6)))),
          list(id = "neg", titulo = "Visión empresarial", vars = list("r100_comp_5"))), source = "estudiantes"),
        "Mapa de calor por criterio", "cada dimensión se abre en sus criterios con un semáforo", 96),
    uno("Los hombres puntúan 68 o 69 en las tres dimensiones del índice", "Índice de competencias (0 a 100), por sexo",
        .cr_g("p_dim_comparativo_radarbar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$sexo"),
        "Comparativo de dimensiones", "comparas los subíndices entre grupos en barras", 97),
    uno("Las tres dimensiones del índice de competencias tienen un perfil parecido por sexo", "Índice de competencias (0 a 100), por sexo",
        .cr_g("p_dim_radar", modo = "general", objetivo = "idx_comp", cruce = "estudiantes$sexo"),
        "Radar por dimensiones", "comparas el perfil de los subíndices entre grupos", 99),
    uno("El acuerdo con estados financieros subió de 74 % en 2018 a 87 % en la medición actual", Q_COMP,
        .cr_g("p_serie_temporal", vars = stats::setNames(lapply(1:3, function(i) paste0(c("estudiantes_2018", "estudiantes_2021", "estudiantes"), "$comp_", i)),
                                                         .CR_COMPETENCIAS[1:3]), corte = "3,4"),
        "Serie temporal con varias mediciones", "sigues varios temas a lo largo de tres o más mediciones", 90),

    # ---- 7. Inserción laboral ----------------------------------------------------------------------------------------
    cap("Inserción laboral", NULL, 7, "Situación laboral de los egresados", "Capítulo con rótulo", "abres un capítulo del informe"),
    uno("Tres de cada cuatro egresados están trabajando actualmente", NULL,
        .cr_g("p_dicotomica", var = "egresados$trabaja"), "Dicotómica", "una pregunta Sí/No de un público; la pregunta encabeza la barra", 76),
    uno("El 76 % de los egresados trabaja; el 24 % no", NULL,
        .cr_g("p_dicotomica", var = "egresados$trabaja", orientacion = "vertical"),
        "Dicotómica vertical", "la barra Sí/No acompaña a otro elemento y conviene de pie", 76),
    uno("Los tramos de 2 a 3 y de 4 a 6 meses son los más frecuentes para conseguir el primer empleo", "Meses hasta conseguir el primer empleo",
        .cr_g("p_histograma", var = "egresados$meses_empleo", grupo = "egresados$sexo"),
        "Histograma por grupos", "la distribución numérica se abre por un cruce", 81),
    uno("Los independientes consiguen empleo en una mediana de 3 meses; los dependientes, en 4", NULL,
        .cr_g("p_boxplot", var = "egresados$meses_empleo", cruce = "egresados$situacion"),
        "Diagrama de caja", "importan la mediana y la dispersión por grupo", 83),
    uno("Quienes no trabajan ni buscan tardaron en promedio 6 meses en su primer empleo", NULL,
        .cr_g("p_media_rango", var = "egresados$meses_empleo", cruce = "egresados$situacion"),
        "Media y rango", "importan el promedio y los extremos por grupo", 84),
    # Dependencia entre los dos gráficos de la lámina (Gonzalo, 2026-10-14: «la dependencia no es un tipo de gráfico»).
    lam("p_slide_2_graficos", titulo = "De los 136 egresados que trabajan, el 36 % lo hace en algo relacionado con la carrera y el 32 %, muy relacionado",
        izquierda = .cr_g("p_barras_agrupadas", var = "egresados$situacion"),
        derecha = .cr_g("p_barras_agrupadas", var = "egresados$relacion"),
        meta = list(dependencia = list(de = "izquierda", habilita = c("Dependiente", "Independiente", "Dependiente e independiente"),
                                      frase = "que trabajan")),
        estilo = "Llave sobre varias categorías", uso = "la segunda pregunta sólo la responden quienes marcaron varias categorías de la primera",
        pagina = 194, opciones = "meta$dependencia (de, habilita, frase)"),
    # Pregunta filtro y subpregunta con filtro dicotómico (p192 abajo, p193 al costado); la de varias categorías, arriba.
    lam("p_slide_2_graficos_vertical", titulo = "El 68 % de los egresados que trabajan lo hace en algo relacionado con la carrera",
        superior = .cr_g("p_barras_agrupadas", var = "egresados$trabaja"),
        inferior = .cr_g("p_barras_apiladas", var = "egresados$relacion", overrides = list(top2box_labels = c("Relacionado", "Muy relacionado"))),
        meta = list(dependencia = list(de = "superior", habilita = "Sí", rotulo = "Trabajan")),
        estilo = "Pregunta filtro y subpregunta", uso = "una subpregunta depende de un Sí; el filtro va arriba", pagina = 192,
        opciones = "meta$dependencia (de, habilita, rotulo)"),
    lam("p_slide_2_graficos", titulo = "Un tercio de los egresados que trabajan lo hace en algo muy relacionado con la carrera",
        izquierda = .cr_g("p_donut", var = "egresados$trabaja"),
        derecha = .cr_g("p_barras_agrupadas", var = "egresados$relacion"), meta = list(dependencia = list(de = "izquierda", habilita = "Sí")),
        estilo = "Filtro al costado", uso = "el filtro Sí/No se lee al lado de su subpregunta", pagina = 193,
        opciones = "meta$dependencia (de, habilita)"),

    # ---- 8. Propuestas de mejora -------------------------------------------------------------------------------------
    cap("Propuestas de mejora", "numero", 8, "Lo que los egresados cambiarían de la carrera", "Capítulo con número grande", "abres un capítulo del informe"),
    uno("Cuatro de cada diez egresados piden más herramientas digitales e inteligencia artificial", Q_MEJORAS,
        .cr_g("p_lollipop", var = "egresados$mejoras"), "Ranking con puntos de opción múltiple", "una pregunta de varias respuestas se ordena de mayor a menor", 72),
    uno("La actualización del plan de estudios es la segunda mejora más pedida, con 28 %", Q_MEJORAS,
        .cr_g("p_barras_agrupadas", var = "egresados$mejoras"), "Ranking en barras",
        "una opción múltiple con rótulos largos; la columna de rótulos se acota y los parte en líneas", 73),
    uno("Sólo el 5 % de los egresados no sabe qué mejorar o no sugiere nada", Q_MEJORAS,
        .cr_g("p_barras_agrupadas", var = "egresados$mejoras", overrides = list(usar_eje_libre = FALSE)),
        "Barras de 0 a 100 %, sin marcas", "la escala completa evita exagerar diferencias", 74),
    uno("Ninguna propuesta de mejora alcanza a la mitad de los egresados", Q_MEJORAS,
        .cr_g("p_barras_agrupadas", var = "egresados$mejoras", overrides = list(usar_eje_libre = FALSE, marcas_eje = TRUE)),
        "Barras de 0 a 100 %, con marcas", "las marcas del eje ayudan a leer la distancia al 50 %", 75),
    uno("Las herramientas digitales dominan las propuestas de mejora de los egresados", Q_MEJORAS,
        .cr_g("p_radar", modo = "sm", var = "egresados$mejoras"),
        "Radar de opción múltiple", "importa la forma del perfil de respuestas más que cada cifra", 93),

    # ---- 9. Comentarios abiertos -------------------------------------------------------------------------------------
    cap("Comentarios abiertos", "fondo", 9, "Lo que los egresados escribieron con sus palabras", "Capítulo con número de fondo", "abres un capítulo del informe"),
    uno("«Laboral» es la palabra más repetida en los comentarios, con 48 menciones", "¿Qué cambiaría de la carrera?",
        .cr_g("p_nube_palabras", var = "egresados$comentario"),
        "Nube de palabras y frases", "resumes una pregunta abierta sin codificar; cuenta palabras y frases de dos o tres palabras dichas por tres o más personas",
        "101 y p103"),
    uno("Laboral, mercado y cursos son las palabras más mencionadas: 48, 43 y 42 veces", "¿Qué cambiaría de la carrera?",
        .cr_g("p_nube_palabras", var = "egresados$comentario", mostrar_ranking = TRUE),
        "Nube de palabras con ranking", "la nube necesita las cifras de las palabras más mencionadas", 102),
    uno("Los temas más mencionados son el plan de estudios y el vínculo con el mercado laboral", "¿Qué cambiaría de la carrera?",
        .cr_g("p_barras_agrupadas", var = "egresados$comentario_temas", temas_de_texto = "comentario"),
        "Temas de un texto abierto codificado", "la pregunta abierta ya está codificada en temas: el % es sobre comentarios con contenido y suma más de 100 %", 104),
    # TXT-4: sin aprobadas sale como borrador y lo dice.
    uno("Los egresados piden conectar la malla curricular con el mercado laboral", NULL,
        .cr_g("p_citas", var = "egresados$comentario"),
        "Citas representativas", "ilustras un tema con frases textuales; sin citas aprobadas sale como borrador"),

    # ---- 10. Territorio -----------------------------------------------------------------------------------------------
    cap("Territorio", NULL, 10, "Resultados por distrito de residencia", "Capítulo con rótulo", "abres un capítulo del informe"),
    uno("San Isidro concentra la mayor satisfacción de los egresados (88 %) y el distrito de Lima, la menor (48 %)",
        "En general, ¿qué tan satisfecho está con la atención en la Unidad?",
        .cr_g("p_mapa_resultado_distrital", var = "egresados$satisf_general", cruces = "egresados$distrito",
              corte = "3,4", rotulo = "Satisfechos o muy satisfechos"),
        "Mapa de Lima por distrito", "un resultado se compara entre distritos de Lima", 107),

    # ---- 11. Diferencias significativas ------------------------------------------------------------------------------
    cap("Diferencias significativas", NULL, 11, "Qué diferencias entre grupos no son azar", "Capítulo con rótulo", "abres un capítulo del informe"),
    uno("Conocer la misión no difiere de forma significativa entre mujeres (61 %) y hombres (57 %)", "¿Conoce la misión y los propósitos de la Facultad?",
        .cr_g("p_barras_agrupadas", var = "estudiantes$conoce_mision", cruces = "estudiantes$sexo", mostrar_significancia = TRUE),
        "Barras agrupadas con diferencias significativas", "comparas grupos y quieres decir qué diferencia es real", 111),
    uno("El acuerdo con la tutoría de mujeres (67 %) y hombres (61 %) no difiere de forma significativa", "La Unidad cuenta con servicios de tutoría académica.",
        .cr_g("p_barras_apiladas", var = "estudiantes$tutoria", cruces = "estudiantes$sexo",
              mostrar_significancia = TRUE, overrides = list(top2box_labels = ttb)),
        "Apiladas con diferencias significativas", "una escala por grupos lleva sus letras de significancia", 111),
    uno("El 75 % de los estudiantes sabe dónde consultar la misión, frente al 69 % de los docentes", "Conocimiento de la misión según público",
        .cr_g("p_significancia_publicos",
              vars = list(`Conoce la misión` = c("docentes$conoce_mision", "estudiantes$conoce_mision", "egresados$conoce_mision"),
                          `Sabe dónde consultarla` = c("docentes$consulta_mision", "estudiantes$consulta_mision", "egresados$consulta_mision")),
              corte = "Sí"),
        "Tabla de letras entre públicos", "comparas una cifra entre públicos con la prueba de cada par", 112),
    lam("p_slide_texto", titulo = "Conclusiones",
        bullets = c("El 59 % de los estudiantes conoce la misión de la Facultad y el 75 % sabe dónde consultarla.",
                    "La información de las autoridades obtiene el mayor acuerdo (79 %) y la biblioteca, el menor (64 %).",
                    "El 76 % de los egresados trabaja y el 68 % de ellos, en algo relacionado con la carrera."),
        estilo = "Texto corrido", uso = "el contenido es prosa o viñetas: conclusiones, recomendaciones"),

    # ---- Anexo: otras formas de las láminas de estructura -----------------------------------------------------------
    cap("Anexo", NULL, 12, "Otras formas de portada, índice, objetivo y cierre", "Capítulo con rótulo", "abres los anexos del informe"),
    subcap("Portadas"),
    lam("p_slide_portada", titulo = "Estudio de percepción del servicio educativo", subtitulo = "Informe de resultados", fecha = "Octubre 2026",
        meta = list(variante = "izquierda"), estilo = "Portada alineada a la izquierda", uso = "el título es largo o la marca va a la izquierda",
        pagina = 24, opciones = "meta$variante = \"izquierda\""),
    lam("p_slide_portada", titulo = "Estudio de percepción del servicio educativo", subtitulo = "Informe de resultados", fecha = "Octubre 2026",
        meta = list(variante = "banda"), estilo = "Portada con banda al pie", uso = "la fecha o la entidad se destacan en una banda",
        pagina = 25, opciones = "meta$variante = \"banda\""),
    subcap("Índices"),
    lam("p_slide_indice", titulo = "Contenido", secciones = "Perfil del encuestado\nExperiencia universitaria\nCompetencias del perfil de egreso",
        meta = list(composicion = "facetas"), estilo = "Índice en facetas", uso = "el índice lista pocos capítulos propios",
        opciones = "meta$composicion = \"facetas\", secciones"),
    lam("p_slide_indice", titulo = "Contenido", secciones = "Gestión\nDocencia\nEgresados",
        subindices = "Gestión: Autoridades\nGestión: Trámites\nDocencia: Calidad\nEgresados: Inserción laboral",
        meta = list(composicion = "circulos"), estilo = "Índice en círculos, con subcapítulos", uso = "el índice muestra capítulos y subcapítulos",
        opciones = "meta$composicion = \"circulos\", secciones, subindices"),
    lam("p_slide_indice", titulo = "Contenido", secciones = "Perfil\nResultados\nConclusiones", meta = list(composicion = "bloques"),
        estilo = "Índice en bloques", uso = "el índice tiene tres partes grandes", opciones = "meta$composicion = \"bloques\", secciones"),
    subcap("Objetivos"),
    lam("p_slide_objetivo_icono", titulo = "Objetivo del estudio",
        texto = "Conocer la percepción de la comunidad sobre la gestión de la Facultad.",
        meta = list(variante = "panel", actores = c("Docentes", "Estudiantes", "Egresados")),
        estilo = "Objetivo en panel lateral", uso = "el objetivo es una frase y los actores van al costado", pagina = 27,
        opciones = "meta$variante = \"panel\", meta$actores"),
    lam("p_slide_objetivo_icono", titulo = "Objetivo del estudio", texto = "Conocer la percepción sobre",
        meta = list(variante = "dimensiones", actores = c("Docentes", "Estudiantes", "Egresados"),
                    dimensiones = c("Los propósitos", "La gestión", "La docencia", "Los servicios")),
        estilo = "Objetivo con dimensiones", uso = "el objetivo se abre en dimensiones del estudio", pagina = 28,
        opciones = "meta$variante = \"dimensiones\", meta$actores, meta$dimensiones"),
    subcap("Cierres"),
    lam("p_slide_cierre", variante = "banda_azul", correo = CIERRE$correo, web = CIERRE$web,
        estilo = "Cierre con banda azul", uso = "el cierre lleva sólo el contacto sobre una banda de la marca", opciones = "variante = \"banda_azul\""),
    lam("p_slide_cierre", variante = "banda_clara", correo = CIERRE$correo, web = CIERRE$web,
        estilo = "Cierre con banda clara", uso = "el cierre lleva el contacto sobre fondo claro", opciones = "variante = \"banda_clara\""),
    lam("p_slide_cierre", variante = "contacto", correo = CIERRE$correo, web = CIERRE$web,
        estilo = "Cierre de contacto", uso = "el cierre destaca los datos de contacto", opciones = "variante = \"contacto\""),
    lam("p_slide_cierre", variante = "tres_columnas", correo = CIERRE$correo, direccion = DIR, web = CIERRE$web,
        estilo = "Cierre en tres columnas", uso = "correo, dirección y web se leen como columnas", opciones = "variante = \"tres_columnas\""),

    # ---- Cierre del informe ------------------------------------------------------------------------------------------
    lam("p_slide_cierre", variante = "contraportada", correo = CIERRE$correo, direccion = DIR, web = CIERRE$web,
        estilo = "Contraportada", uso = "cierras el informe; es el cierre de siempre", opciones = "variante = \"contraportada\"")
  )
}
