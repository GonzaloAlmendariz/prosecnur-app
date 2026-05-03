# Catálogo humano de slides y graficadores de `prosecnur`.
#
# Este archivo es la "capa de traducción" entre los formals() técnicos
# de las funciones R y la UI que construye el analista. Cada entrada
# expone:
#   - titulo_humano: cómo llamarla en la UI.
#   - descripcion: frase corta en español no técnico.
#   - icono_ui: sugerencia de ícono lucide para la UI.
#   - categoria: agrupador en el picker (estructural / 1grafico / 2graficos /
#     4graficos / poblacion / dimensiones).
#   - args: lista con nombre técnico + label humano + tipo_input + grupo +
#     descripcion + choices (si aplica).
#
# El contrato con el frontend es: todo lo que aparezca en esta lista se
# renderiza como control UI; lo que no, queda con defaults del backend.
# Un arg sin descripción se renderiza igual pero sin tooltip.

# ---- Tipos de input que la UI reconoce ------------------------------------
#
# "variable"         → dropdown de una sola variable del instrumento
# "variable_opt"     → idem + opción "(ninguna)"
# "variables_list"   → multi-select
# "string"           → input de texto
# "textarea"         → textarea multi-línea
# "number"           → input numérico
# "bool"             → switch
# "choice"           → radio pills / select con enum
# "codigos_list"     → lista editable de códigos (ej. sm_omit_codes)
# "series_colors"    → pares serie → color con filas editables
# "criteria_config"  → criterios/conductores con selector de variables
# "icono"            → dropdown del catálogo de iconos subidos en sesión
# "overrides"        → editor especial de overrides (delta vs preset tipo)
# "filtros"          → editor de filtros por variable (avanzado)
# "base_config"      → editor de la base automática/manual (avanzado)
# "meta"             → objeto libre; casi nunca se expone en UI

# ---- Grupos semánticos ----------------------------------------------------
#
# "datos"        → qué variable, qué cruce, qué modo
# "lectura"      → títulos, etiquetas, textos y legibilidad
# "valores"      → porcentajes, decimales, top/bottom box, valores en barras
# "leyenda"      → posición, tamaño y distribución de la leyenda
# "espacio"      → distribución interna del gráfico y canvas
# "tabla"        → tabla derecha / tabla de apoyo
# "diagnostico"  → debug visual y controles de inspección
#
# Los grupos legacy ("textos", "estilo", "filtro", "semaforo", "canvas",
# "avanzado") siguen aceptándose para compatibilidad, pero el payload que
# consume el frontend los normaliza a los grupos de intención anteriores.

# ===========================================================================
# Helpers para args compartidos (deben definirse antes de .SLIDES_META porque
# la lista los llama directamente al momento de construirse).
# ===========================================================================

# Args de títulos + base + pie + etiqueta que casi todos los slides de
# contenido comparten.
.args_slide_titulos_base <- function() list(
  list(name = "titulo",     label = "Título del slide",    tipo_input = "string",   grupo = "textos",
       descripcion = "Aparece arriba del gráfico como encabezado."),
  list(name = "etiqueta",   label = "Etiqueta corta",      tipo_input = "string",   grupo = "textos",
       descripcion = "Texto pequeño a la izquierda del título (ej. sección numerada)."),
  list(name = "base",       label = "Base",                tipo_input = "string",   grupo = "textos",
       descripcion = "Nota al pie con la base real (ej. 'Base: 120 encuestados'). Si la dejas vacía, se infiere automáticamente."),
  list(name = "pie",        label = "Pie (nota)",          tipo_input = "textarea", grupo = "textos",
       descripcion = "Línea de fuente o disclaimer al pie del slide.")
)

.args_slide_poblacion_basico <- function() list(
  list(name = "titulo",   label = "Título del slide", tipo_input = "string",   grupo = "textos"),
  list(name = "base",     label = "Base",             tipo_input = "string",   grupo = "textos",
       descripcion = "Nota al pie con la base real. Vacío = automática."),
  list(name = "pie",      label = "Pie",              tipo_input = "textarea", grupo = "textos"),
  list(name = "etiqueta", label = "Etiqueta corta",   tipo_input = "string",   grupo = "textos")
)

# Args compartidos por TODOS los graficadores.
.args_graf_comunes <- function() list(
  list(name = "titulo",     label = "Título del gráfico", tipo_input = "string",      grupo = "textos",
       descripcion = "Título que aparece sobre el gráfico. Si lo dejas vacío, se usa la etiqueta de la variable."),
  list(name = "overrides",  label = "Overrides de estilo",tipo_input = "overrides",   grupo = "estilo",
       descripcion = "Ajustes visuales específicos a este gráfico (tamaños, colores, canvas) que pisan el preset global."),
  list(name = "filtros",    label = "Filtros",            tipo_input = "filtros",     grupo = "filtro",
       descripcion = "Restringe los datos que entran al gráfico (ej. solo mujeres, solo Lima)."),
  list(name = "base",       label = "Base del gráfico",   tipo_input = "base_config", grupo = "textos",
       descripcion = "Texto al pie del gráfico. Puede ser automático (cuenta los casos) o manual.")
)

# ---- Textos en negrita ---------------------------------------------------
#
# Universo canónico de tokens que pueden ir en negrita. Cada graficador
# soporta un subset de estos tokens; el helper `.arg_textos_negrita`
# arma un arg tipo `multiflag` con el subset que corresponda.
#
# Notación: los tokens son snake_case sin acentos para matchear el
# código R de los graficadores, que los compara con `%in% textos_negrita`.
.TOKENS_NEGRITA <- list(
  titulo         = list(value = "titulo",        label = "Título"),
  subtitulo      = list(value = "subtitulo",     label = "Subtítulo"),
  leyenda        = list(value = "leyenda",       label = "Leyenda"),
  nota_pie       = list(value = "nota_pie",      label = "Nota al pie"),
  ejes           = list(value = "ejes",          label = "Ejes"),
  eje_x          = list(value = "eje_x",         label = "Eje X"),
  eje_y          = list(value = "eje_y",         label = "Eje Y"),
  valores        = list(value = "valores",       label = "Valores"),
  barra_extra    = list(value = "barra_extra",   label = "Barra extra"),
  titulos_grupo  = list(value = "titulos_grupo", label = "Títulos de grupo"),
  niveles        = list(value = "niveles",       label = "Niveles del radar"),
  etiquetas      = list(value = "etiquetas",     label = "Etiquetas (%)")
)

# Arma el arg "textos_negrita" tipo `multiflag` restringido al subset de
# tokens que el graficador acepta. `tokens` es un vector de keys de
# `.TOKENS_NEGRITA`. Si pasas un token desconocido se lanza error para
# fallar rápido en caso de typo.
.arg_textos_negrita <- function(tokens) {
  bad <- setdiff(tokens, names(.TOKENS_NEGRITA))
  if (length(bad) > 0) {
    stop(sprintf(
      "Token(s) de negrita desconocido(s): %s. Disponibles: %s",
      paste(bad, collapse = ", "),
      paste(names(.TOKENS_NEGRITA), collapse = ", ")
    ))
  }
  list(
    name = "textos_negrita",
    label = "Textos en negrita",
    tipo_input = "multiflag",
    grupo = "estilo",
    descripcion = "Selecciona qué partes del gráfico van en negrita.",
    opciones = unname(.TOKENS_NEGRITA[tokens])
  )
}

# ===========================================================================
# SLIDES
# ===========================================================================

.SLIDES_META <- list(

  # ---- Estructurales ------------------------------------------------------

  p_slide_portada = list(
    titulo_humano = "Portada",
    descripcion   = "Primera lámina del reporte, con el título principal, subtítulo, fecha y un texto descriptivo.",
    icono_ui      = "FileText",
    categoria     = "estructural",
    slots         = character(0),
    args = list(
      list(name = "titulo",    label = "Título principal",   tipo_input = "string",   grupo = "textos",
           descripcion = "El título grande que aparece en la tapa del reporte."),
      list(name = "subtitulo", label = "Subtítulo",          tipo_input = "string",   grupo = "textos",
           descripcion = "Línea secundaria debajo del título (opcional)."),
      list(name = "fecha",     label = "Fecha",              tipo_input = "string",   grupo = "textos",
           descripcion = "Fecha o período que se muestra en la portada (ej. 'Abril 2026')."),
      list(name = "subtexto",  label = "Texto descriptivo",  tipo_input = "textarea", grupo = "textos",
           descripcion = "Párrafo breve que describe el alcance del reporte.")
    )
  ),

  p_slide_indice = list(
    titulo_humano = "Índice",
    descripcion   = "Tabla de contenidos auto-generada a partir de las secciones del reporte.",
    icono_ui      = "List",
    categoria     = "estructural",
    slots         = character(0),
    args          = list()
  ),

  p_slide_seccion = list(
    titulo_humano = "Separador de sección",
    descripcion   = "Lámina de transición entre bloques grandes del reporte. Muestra solo el título de la sección.",
    icono_ui      = "Bookmark",
    categoria     = "estructural",
    slots         = character(0),
    args = list(
      list(name = "titulo",             label = "Título de la sección", tipo_input = "string",   grupo = "textos",
           descripcion = "Nombre del bloque que empieza (ej. 'Satisfacción con el servicio')."),
      list(name = "subtitulo",          label = "Subtítulo",            tipo_input = "string",   grupo = "textos"),
      list(name = "introduccion_word",  label = "Intro (solo Word)",    tipo_input = "textarea", grupo = "textos",
           descripcion = "Párrafo introductorio que solo aparece en el export a Word, no en PPT.")
    )
  ),

  p_slide_objetivo_icono = list(
    titulo_humano = "Objetivo con ícono",
    descripcion   = "Bloque de texto con un ícono grande al costado. Útil para enunciar objetivos o hallazgos clave.",
    icono_ui      = "Target",
    categoria     = "estructural",
    slots         = "icono",
    args = list(
      list(name = "icono",  label = "Ícono",      tipo_input = "icono",    grupo = "datos",
           descripcion = "PNG decorativo que aparece al lado del texto. Debes haberlo subido antes en 'Iconos'."),
      list(name = "texto",  label = "Contenido",  tipo_input = "textarea", grupo = "textos",
           descripcion = "El mensaje principal del slide. Párrafo corto, 2-4 líneas."),
      list(name = "titulo", label = "Título",     tipo_input = "string",   grupo = "textos")
    )
  ),

  p_slide_texto = list(
    titulo_humano = "Bloque de texto",
    descripcion   = "Lámina solo con texto: título + párrafo + bullets opcionales. Útil para conclusiones o metodología.",
    icono_ui      = "Type",
    categoria     = "estructural",
    slots         = character(0),
    args = list(
      list(name = "titulo",  label = "Título",     tipo_input = "string",   grupo = "textos"),
      list(name = "texto",   label = "Párrafo",    tipo_input = "textarea", grupo = "textos",
           descripcion = "Texto principal, típicamente 1-3 párrafos."),
      list(name = "bullets", label = "Bullets",    tipo_input = "textarea", grupo = "textos",
           descripcion = "Lista de puntos, uno por línea. Se renderiza con viñetas."),
      list(name = "base",    label = "Base",       tipo_input = "string",   grupo = "textos",
           descripcion = "Texto pequeño al pie (ej. 'Base: 350 encuestados').")
    )
  ),

  p_slide_tabla_tecnica = list(
    titulo_humano = "Tabla técnica",
    descripcion   = "Slide con una tabla editorial (ej. ficha técnica del estudio, parámetros, metodología).",
    icono_ui      = "Table",
    categoria     = "estructural",
    slots         = character(0),
    args = list(
      list(name = "titulo", label = "Título de la tabla", tipo_input = "string",   grupo = "textos"),
      list(name = "filas",  label = "Filas",              tipo_input = "textarea", grupo = "datos",
           descripcion = "Una fila por línea, en formato 'Campo: valor'. La UI lo traduce a filas de la tabla."),
      list(name = "pie",    label = "Nota al pie",        tipo_input = "string",   grupo = "textos")
    )
  ),

  # ---- 1 gráfico ----------------------------------------------------------

  p_slide_1_grafico = list(
    titulo_humano = "Un gráfico",
    descripcion   = "Lámina estándar con un solo gráfico grande al centro y encabezados arriba/abajo.",
    icono_ui      = "BarChart2",
    categoria     = "1grafico",
    slots         = "grafico",
    args = .args_slide_titulos_base()  # definido abajo
  ),

  p_slide_1_grafico_narrativo = list(
    titulo_humano = "Un gráfico + narrativa",
    descripcion   = "Gráfico central con un bloque de texto narrativo arriba. Útil para guiar la lectura.",
    icono_ui      = "AlignLeft",
    categoria     = "1grafico",
    slots         = "grafico",
    args = c(list(
      list(name = "texto", label = "Texto narrativo", tipo_input = "textarea", grupo = "textos",
           descripcion = "Párrafo de 2-4 líneas que introduce o interpreta el gráfico.")
    ), .args_slide_titulos_base())
  ),

  p_slide_grafico_texto_derecha = list(
    titulo_humano = "Gráfico + texto a la derecha",
    descripcion   = "Gráfico a la izquierda, bloque de texto a la derecha. Ideal para hallazgos o recomendaciones junto a la evidencia.",
    icono_ui      = "LayoutPanelLeft",
    categoria     = "1grafico",
    slots         = "grafico",
    args = c(list(
      list(name = "texto", label = "Texto", tipo_input = "textarea", grupo = "textos")
    ), .args_slide_titulos_base())
  ),

  p_slide_grafico_texto_izquierda = list(
    titulo_humano = "Gráfico + texto a la izquierda",
    descripcion   = "Texto a la izquierda, gráfico a la derecha. Útil cuando quieres que el mensaje se lea antes del gráfico.",
    icono_ui      = "LayoutPanelTop",
    categoria     = "1grafico",
    slots         = "grafico",
    args = c(list(
      list(name = "texto", label = "Texto", tipo_input = "textarea", grupo = "textos")
    ), .args_slide_titulos_base())
  ),

  # ---- 2 gráficos ---------------------------------------------------------

  p_slide_2_graficos = list(
    titulo_humano = "Dos gráficos",
    descripcion   = "Dos gráficos lado a lado, mismo tamaño. Útil para comparaciones directas.",
    icono_ui      = "Columns2",
    categoria     = "2graficos",
    slots         = c("izquierda", "derecha"),
    args = .args_slide_titulos_base()
  ),

  p_slide_2_graficos_narrativo = list(
    titulo_humano = "Dos gráficos + narrativa",
    descripcion   = "Dos gráficos con un bloque de texto narrativo arriba.",
    icono_ui      = "AlignLeft",
    categoria     = "2graficos",
    slots         = c("izquierda", "derecha"),
    args = c(list(
      list(name = "texto", label = "Texto narrativo", tipo_input = "textarea", grupo = "textos")
    ), .args_slide_titulos_base())
  ),

  p_slide_2_graficos_texto_izquierda = list(
    titulo_humano = "Dos gráficos + texto izquierda",
    descripcion   = "Los dos gráficos a la derecha y un bloque de texto a la izquierda.",
    icono_ui      = "LayoutPanelTop",
    categoria     = "2graficos",
    slots         = c("grafico_1", "grafico_2"),
    args = c(list(
      list(name = "texto", label = "Texto", tipo_input = "textarea", grupo = "textos")
    ), .args_slide_titulos_base())
  ),

  p_slide_2_graficos_texto_derecha = list(
    titulo_humano = "Dos gráficos + texto derecha",
    descripcion   = "Los dos gráficos a la izquierda y un bloque de texto a la derecha.",
    icono_ui      = "LayoutPanelLeft",
    categoria     = "2graficos",
    slots         = c("grafico_1", "grafico_2"),
    args = c(list(
      list(name = "texto", label = "Texto", tipo_input = "textarea", grupo = "textos")
    ), .args_slide_titulos_base())
  ),

  # ---- Grids 4-6 ---------------------------------------------------------

  p_slide_4_graficos = list(
    titulo_humano = "Cuatro gráficos",
    descripcion   = "Grid 2×2 con cuatro gráficos compactos. Ideal para ver varias dimensiones en paralelo.",
    icono_ui      = "LayoutGrid",
    categoria     = "4graficos",
    slots         = c("superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"),
    args = .args_slide_titulos_base()
  ),

  # ---- Población (con ícono central) -------------------------------------

  p_slide_2_graficos_poblacion = list(
    titulo_humano = "Dos gráficos + ícono (población)",
    descripcion   = "Dos gráficos con un ícono grande al centro. Usado para láminas de perfil poblacional.",
    icono_ui      = "UsersRound",
    categoria     = "poblacion",
    slots         = c("izquierda", "derecha", "icono"),
    args = .args_slide_poblacion_basico()
  ),

  p_slide_4_graficos_poblacion = list(
    titulo_humano = "Cuatro gráficos + ícono (población)",
    descripcion   = "Grid 2×2 con ícono central, típico para slides demográficas.",
    icono_ui      = "UsersRound",
    categoria     = "poblacion",
    slots         = c("superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha", "icono"),
    args = .args_slide_poblacion_basico()
  ),

  p_slide_5_graficos_poblacion = list(
    titulo_humano = "Cinco gráficos + ícono",
    descripcion   = "Tres gráficos arriba + dos abajo, con ícono central. Diseñado para caracterizar poblaciones con muchas dimensiones.",
    icono_ui      = "UsersRound",
    categoria     = "poblacion",
    slots         = c("grafico_superior_1", "grafico_superior_2", "grafico_superior_3",
                      "grafico_inferior_1", "grafico_inferior_2", "icono"),
    args = .args_slide_poblacion_basico()
  ),

  p_slide_6_graficos_poblacion = list(
    titulo_humano = "Seis gráficos + ícono",
    descripcion   = "Grid 3×2 con ícono central, la lámina más densa de población.",
    icono_ui      = "UsersRound",
    categoria     = "poblacion",
    slots         = c("grafico_superior_1", "grafico_superior_2", "grafico_superior_3",
                      "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3", "icono"),
    args = .args_slide_poblacion_basico()
  )
)

# ===========================================================================
# GRAFICADORES
# ===========================================================================

.GRAFICADORES_META <- list(

  # ---- Básicos ------------------------------------------------------------

  p_barras_agrupadas = list(
    titulo_humano = "Barras agrupadas",
    descripcion   = "Barras horizontales o verticales, una por categoría. Si hay cruce, las barras se agrupan por grupo. Útil para comparar porcentajes de una variable entre segmentos.",
    icono_ui      = "BarChartHorizontal",
    args = c(list(
      list(name = "var",    label = "Variable",   tipo_input = "variable",     grupo = "datos",
           descripcion = "La pregunta que quieres graficar."),
      list(name = "cruces", label = "Dividir por",tipo_input = "variable_opt", grupo = "datos",
           descripcion = "Segunda variable para segmentar (ej. sexo, región). Si la dejas vacía, muestra una serie única.")
    ), .args_graf_comunes())
  ),

  p_barras_apiladas = list(
    titulo_humano = "Barras apiladas",
    descripcion   = "Barras donde cada segmento es una categoría de respuesta. Suma 100% por fila. Ideal para escalas Likert (satisfacción, acuerdo, etc.).",
    icono_ui      = "BarChartBig",
    args = c(list(
      list(name = "var",    label = "Variable",    tipo_input = "variable",     grupo = "datos",
           descripcion = "Variable categórica, típicamente de escala (Likert)."),
      list(name = "cruces", label = "Dividir por", tipo_input = "variable_opt", grupo = "datos",
           descripcion = "Si la eliges, cada barra es un grupo de la variable de cruce.")
    ), .args_graf_comunes())
  ),

  p_barras_multiapiladas = list(
    titulo_humano = "Multi-apiladas",
    descripcion   = "Varias barras apiladas en un solo gráfico. Perfecto para comparar preguntas con la misma escala de respuesta.",
    icono_ui      = "Rows3",
    args = c(list(
      list(name = "modo", label = "Modo", tipo_input = "choice", grupo = "datos",
           descripcion = "Cómo construir las barras.",
           choices = list(
             list(value = "var",        label = "Una variable", hint = "Una sola pregunta."),
             list(value = "cruce",      label = "Cruzada",       hint = "Una pregunta partida por los grupos de un cruce."),
             list(value = "var_cruce",  label = "Variables × cruce", hint = "Varias preguntas agrupadas en bloques temáticos, cada una cruzada."),
             list(value = "multilista", label = "Multilista",    hint = "Bloques arbitrarios, avanzado.")
           )),
      list(name = "vars",          label = "Variables",     tipo_input = "variables_list", grupo = "datos",
           descripcion = "Preguntas a incluir. Todas deben tener la misma escala de respuestas."),
      list(name = "var",           label = "Variable única",tipo_input = "variable_opt",   grupo = "datos",
           descripcion = "Usado en modo 'Cruzada': una sola variable partida por los grupos del cruce."),
      list(name = "cruces",        label = "Variable de cruce", tipo_input = "variable_opt", grupo = "datos"),
      list(name = "titulos_grupo", label = "Títulos por bloque", tipo_input = "textarea",  grupo = "textos",
           descripcion = "Solo en modo 'Variables × cruce'. Formato: 'clave=Título'. Una línea por bloque."),
      list(name = "top2box",       label = "Mostrar Top 2",  tipo_input = "bool",          grupo = "filtro",
           descripcion = "Combina las dos mejores categorías (ej. 'Muy de acuerdo' + 'De acuerdo') en una barra extra."),
      list(name = "top2box_labels",label = "Etiquetas Top 2",tipo_input = "codigos_list",  grupo = "filtro",
           descripcion = "Qué etiquetas cuentan como Top 2. Si está vacío, se toman las dos últimas de la escala."),
      list(name = "wrap_y",        label = "Ancho etiquetas Y", tipo_input = "number",    grupo = "avanzado",
           descripcion = "Máximo de caracteres por línea en las etiquetas del eje Y. Recomendado: 30-80.")
    ), .args_graf_comunes())
  ),

  p_pie = list(
    titulo_humano = "Gráfico de torta",
    descripcion   = "Pie chart clásico con porcentajes. Útil para variables con pocas categorías.",
    icono_ui      = "PieChart",
    args = c(list(
      list(name = "var", label = "Variable", tipo_input = "variable", grupo = "datos")
    ), .args_graf_comunes())
  ),

  p_donut = list(
    titulo_humano = "Gráfico de dona",
    descripcion   = "Variante compacta del pie, con un hueco al centro. Usado en grids densas.",
    icono_ui      = "CircleDot",
    args = c(list(
      list(name = "var", label = "Variable", tipo_input = "variable", grupo = "datos")
    ), .args_graf_comunes())
  ),

  p_numerico = list(
    titulo_humano = "Indicador numérico",
    descripcion   = "Cifra grande (media, mediana, N, %) cruzada opcionalmente por un segmento. Ideal para KPIs.",
    icono_ui      = "Hash",
    args = c(list(
      list(name = "var",     label = "Variable",    tipo_input = "variable_opt", grupo = "datos"),
      list(name = "metrica", label = "Métrica",     tipo_input = "choice",       grupo = "filtro",
           descripcion = "Qué estadístico mostrar.",
           choices = list(
             list(value = "mean",   label = "Media",      hint = "Promedio aritmético."),
             list(value = "median", label = "Mediana",    hint = "Valor central."),
             list(value = "pct",    label = "Porcentaje", hint = "% sobre el total."),
             list(value = "N",      label = "Conteo (N)", hint = "Cantidad de casos.")
           )),
      list(name = "cruce",   label = "Dividir por", tipo_input = "variable_opt", grupo = "datos"),
      list(name = "formato", label = "Formato",     tipo_input = "string",       grupo = "avanzado",
           descripcion = "Formato del número (ej. '%.1f' para 1 decimal, '%.0f%%' para entero con %).")
    ), .args_graf_comunes())
  ),

  p_boxplot = list(
    titulo_humano = "Box plot",
    descripcion   = "Caja con cuartiles y bigotes. Muestra la distribución de una variable numérica, opcionalmente por grupos.",
    icono_ui      = "BoxSelect",
    args = c(list(
      list(name = "var",                label = "Variable numérica", tipo_input = "variable",     grupo = "datos"),
      list(name = "cruce",              label = "Dividir por",       tipo_input = "variable_opt", grupo = "datos"),
      list(name = "decimales_promedio", label = "Decimales del promedio", tipo_input = "number",   grupo = "filtro"),
      list(name = "cortes_chip",        label = "Cortes del semáforo",    tipo_input = "codigos_list", grupo = "semaforo",
           descripcion = "Valores numéricos que separan los colores (ej. [3, 4] → rojo <3, amarillo 3-4, verde >4)."),
      list(name = "modo_semaforo",      label = "Tipo de semáforo",  tipo_input = "choice",       grupo = "semaforo",
           choices = list(
             list(value = "grupos",                 label = "Por grupos",        hint = "Colores fijos entre cortes."),
             list(value = "degradado_automatico",   label = "Degradado auto",     hint = "Gradiente suave, cortes calculados."),
             list(value = "degradado_manual",       label = "Degradado manual",   hint = "Gradiente con cortes definidos por ti."),
             list(value = "degradado",              label = "Degradado simple",   hint = "Gradiente lineal sin cortes.")
           ))
    ), .args_graf_comunes())
  ),

  p_media_rango = list(
    titulo_humano = "Media y rango",
    descripcion   = "Puntos o burbujas con el promedio de una variable, uno por grupo. Opcional: barras de rango (min-max, IQR).",
    icono_ui      = "Activity",
    args = c(list(
      list(name = "var",                label = "Variable numérica", tipo_input = "variable",     grupo = "datos"),
      list(name = "cruce",              label = "Dividir por",       tipo_input = "variable_opt", grupo = "datos"),
      list(name = "decimales_promedio", label = "Decimales",         tipo_input = "number",       grupo = "filtro"),
      list(name = "mostrar_ref_label",  label = "Mostrar referencia",tipo_input = "bool",         grupo = "filtro",
           descripcion = "Muestra una línea o etiqueta con el promedio global como referencia."),
      list(name = "cortes_chip",        label = "Cortes del semáforo", tipo_input = "codigos_list", grupo = "semaforo"),
      list(name = "modo_semaforo",      label = "Tipo de semáforo",  tipo_input = "choice",       grupo = "semaforo",
           choices = list(
             list(value = "grupos",               label = "Por grupos"),
             list(value = "degradado_automatico", label = "Degradado auto"),
             list(value = "degradado_manual",     label = "Degradado manual"),
             list(value = "degradado",            label = "Degradado simple")
           ))
    ), .args_graf_comunes())
  ),

  # p_radar y p_tabla son wrappers de `p_radar_tabla` (ver api/R/p_radar_split.R).
  # Ofrecen el radar y la tabla por SEPARADO, cada uno ocupando su propio
  # placeholder. El combinado `p_radar_tabla` ya no se expone en el
  # registry — sigue vivo en el motor por compat de planes viejos.

  p_radar = list(
    titulo_humano = "Radar",
    descripcion   = "Gráfico radar (telaraña) sin tabla al costado. Ocupa todo el placeholder. Ideal cuando querés la tabla en otro slot o no la necesitás.",
    icono_ui      = "Radar",
    args = c(list(
      list(name = "modo",         label = "Modo",                 tipo_input = "choice",         grupo = "datos",
           choices = list(
             list(value = "sm",  label = "Select múltiple", hint = "Una variable con opciones múltiples."),
             list(value = "box", label = "Cajas/cortes",    hint = "Una variable agrupada por rangos.")
           )),
      list(name = "var",          label = "Variable (modo box)",  tipo_input = "variable_opt",   grupo = "datos"),
      list(name = "vars",         label = "Variables (modo sm)",  tipo_input = "variables_list", grupo = "datos"),
      list(name = "cruce",        label = "Dividir por",          tipo_input = "variable_opt",   grupo = "datos"),
      list(name = "top_n",        label = "Top N",                tipo_input = "number",         grupo = "filtro",
           descripcion = "Cantidad máxima de categorías a mostrar. Si vacío, se muestran todas."),
      list(name = "sm_omit_codes",label = "Códigos a omitir",     tipo_input = "codigos_list",   grupo = "filtro",
           descripcion = "Códigos de respuesta que no queremos en el radar (ej. 88=No sabe, 90=No aplica)."),
      list(name = "sm_omit_na",   label = "Omitir NA",            tipo_input = "bool",           grupo = "filtro",
           descripcion = "Excluir casos con respuesta vacía.")
    ), .args_graf_comunes())
  ),

  p_tabla = list(
    titulo_humano = "Tabla",
    descripcion   = "Tabla de Top-Two-Box (o indicadores agregados) sin el radar al costado. Útil para acompañar un radar colocado en otro slot, o como resumen ejecutivo suelto.",
    icono_ui      = "Table",
    args = c(list(
      list(name = "modo",         label = "Modo",                 tipo_input = "choice",         grupo = "datos",
           choices = list(
             list(value = "sm",  label = "Select múltiple"),
             list(value = "box", label = "Cajas/cortes")
           )),
      list(name = "var",          label = "Variable (modo box)",  tipo_input = "variable_opt",   grupo = "datos"),
      list(name = "vars",         label = "Variables (modo sm)",  tipo_input = "variables_list", grupo = "datos"),
      list(name = "cruce",        label = "Dividir por",          tipo_input = "variable_opt",   grupo = "datos"),
      list(name = "titulo_tabla", label = "Título de la tabla",   tipo_input = "string",         grupo = "textos"),
      list(name = "top_n",        label = "Top N",                tipo_input = "number",         grupo = "filtro"),
      list(name = "sm_omit_codes",label = "Códigos a omitir",     tipo_input = "codigos_list",   grupo = "filtro"),
      list(name = "sm_omit_na",   label = "Omitir NA",            tipo_input = "bool",           grupo = "filtro")
    ), .args_graf_comunes())
  ),

  # ---- Dimensiones (requieren reporte_dimensiones previo) -----------------

  p_dim_radar = list(
    titulo_humano = "Radar por dimensiones",
    descripcion   = "Radar que compara el puntaje de varias dimensiones (subíndices o indicadores). Requiere haber calculado las dimensiones primero.",
    icono_ui      = "Radar",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "modo",      label = "Nivel",       tipo_input = "choice",       grupo = "datos",
           choices = list(
             list(value = "general",      label = "Índice general", hint = "Compara índices completos."),
             list(value = "indicadores",  label = "Indicadores",    hint = "Compara indicadores individuales.")
           )),
      list(name = "objetivo",  label = "Objetivo",    tipo_input = "string",       grupo = "datos",
           descripcion = "Qué se está midiendo (ej. 'Satisfacción', 'Calidad de atención')."),
      list(name = "cruce",     label = "Dividir por", tipo_input = "variable_opt", grupo = "datos"),
      list(name = "incluir_total", label = "Incluir serie total", tipo_input = "bool", grupo = "filtro",
           descripcion = "Añade una serie con el total de la muestra como referencia.")
    ), .args_graf_comunes())
  ),

  p_dim_radar_tabla = list(
    titulo_humano = "Radar dimensional + tabla",
    descripcion   = "Radar de dimensiones con una tabla al costado. Versión con tabla para contextualizar los puntajes.",
    icono_ui      = "Radar",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "modo",          label = "Nivel",        tipo_input = "choice",       grupo = "datos",
           choices = list(
             list(value = "general",      label = "Índice general"),
             list(value = "indicadores",  label = "Indicadores")
           )),
      list(name = "objetivo",      label = "Objetivo",     tipo_input = "string",       grupo = "datos"),
      list(name = "cruce",         label = "Dividir por",  tipo_input = "variable_opt", grupo = "datos"),
      list(name = "titulo_tabla",  label = "Título tabla", tipo_input = "string",       grupo = "textos"),
      list(name = "incluir_total", label = "Incluir total",tipo_input = "bool",         grupo = "filtro")
    ), .args_graf_comunes())
  ),

  p_dim_heatmap = list(
    titulo_humano = "Heatmap de dimensiones",
    descripcion   = "Mapa de calor con filas = dimensiones y columnas = grupos del cruce. Celdas coloreadas por puntaje.",
    icono_ui      = "LayoutGrid",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "modo",      label = "Nivel",      tipo_input = "choice",       grupo = "datos",
           choices = list(
             list(value = "general",      label = "Índice general"),
             list(value = "indicadores",  label = "Indicadores")
           )),
      list(name = "objetivo",  label = "Objetivo",   tipo_input = "string",       grupo = "datos"),
      list(name = "cruce",     label = "Cruce",      tipo_input = "variable_opt", grupo = "datos"),
      list(name = "incluir_total", label = "Incluir totales", tipo_input = "bool", grupo = "filtro"),
      list(name = "brecha_filas",   label = "Brecha por filas",   tipo_input = "bool", grupo = "filtro",
           descripcion = "Añade columna 'Brecha' con max-min por fila."),
      list(name = "brecha_cols",    label = "Brecha por columnas",tipo_input = "bool", grupo = "filtro"),
      list(name = "modo_semaforo",  label = "Tipo de semáforo",   tipo_input = "choice", grupo = "semaforo",
           choices = list(
             list(value = "grupos",               label = "Por grupos"),
             list(value = "degradado_automatico", label = "Degradado auto"),
             list(value = "degradado_manual",     label = "Degradado manual"),
             list(value = "degradado",            label = "Degradado simple")
           ))
    ), .args_graf_comunes())
  ),

  p_dim_comparativo_radarbar = list(
    titulo_humano = "Radar + barras comparativo",
    descripcion   = "Radar con barras al lado, comparando dos o más grupos en un mismo lienzo. Ideal para reportes ejecutivos.",
    icono_ui      = "Activity",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "modo",           label = "Nivel",           tipo_input = "choice",       grupo = "datos",
           choices = list(
             list(value = "general",      label = "Índice general"),
             list(value = "indicadores",  label = "Indicadores")
           )),
      list(name = "objetivo",       label = "Objetivo",        tipo_input = "string",       grupo = "datos"),
      list(name = "cruce",          label = "Dividir por",     tipo_input = "variable_opt", grupo = "datos"),
      list(name = "incluir_total",  label = "Incluir total",   tipo_input = "bool",         grupo = "filtro"),
      list(name = "radar_min_ejes", label = "Mínimo de ejes en radar", tipo_input = "number", grupo = "avanzado",
           descripcion = "Si hay menos dimensiones que este número, el radar se reemplaza por barras.")
    ), .args_graf_comunes())
  ),

  p_dim_foda = list(
    titulo_humano = "Matriz FODA dimensional",
    descripcion   = "Matriz 2×2 o dispersión estilo FODA (fortalezas, oportunidades, debilidades, amenazas) sobre indicadores. Altamente personalizable.",
    icono_ui      = "Grid3X3",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "nivel",     label = "Nivel de análisis", tipo_input = "choice",       grupo = "datos",
           choices = list(
             list(value = "subindices",    label = "Subíndices"),
             list(value = "indicadores",   label = "Indicadores")
           )),
      list(name = "objetivo",  label = "Objetivo",          tipo_input = "string",       grupo = "datos"),
      list(name = "modo_foda", label = "Disposición",       tipo_input = "choice",       grupo = "estilo",
           choices = list(
             list(value = "matriz",      label = "Matriz 2×2"),
             list(value = "dispersion",  label = "Dispersión")
           )),
      list(name = "cruce",         label = "Cruce",           tipo_input = "variable_opt", grupo = "datos"),
      list(name = "incluir_total", label = "Incluir total",   tipo_input = "bool",         grupo = "filtro"),
      list(name = "usar_pesos",    label = "Aplicar pesos",   tipo_input = "bool",         grupo = "filtro",
           descripcion = "Si los subíndices tienen pesos declarados, los aplica al ranking FODA.")
    ), .args_graf_comunes())
  ),

  p_dim_heatmap_criterios = list(
    titulo_humano = "Heatmap por criterios",
    descripcion   = "Heatmap agrupado por criterios temáticos definidos en la config de dimensiones.",
    icono_ui      = "LayoutGrid",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "config_criterios", label = "Criterios", tipo_input = "criteria_config", grupo = "datos",
           descripcion = "Agrupa variables en criterios para construir el heatmap.")
    ), .args_graf_comunes())
  )
)

# ===========================================================================
# PRESETS (estilo global por tipo de graficador)
# ===========================================================================
#
# `p_presets` acepta 13 bloques de tipo: `base` (se hereda a todos
# los graficadores) + un bloque por cada tipo de gráfico (barras_apiladas,
# multi_apiladas, barras_agrupadas, barras_numericas, boxplot, media_rango,
# pie, donut, radar_tabla, dim_heatmap, dim_heatmap_criterios, dim_radar,
# dim_foda). Cada bloque es `list(args = list(...))`; los `args` se pasan
# a la función del graficador correspondiente.
#
# Este catálogo cura los args MÁS útiles para estilo global: tipografía,
# tamaños, canvas heights, leyendas. Args técnicos muy específicos de un
# gráfico puntual quedan fuera de la UI principal. El objetivo es que el analista tenga un
# control real de estilo global en <10 campos por tipo, no 40.
#
# `grupo_hereda` indica si el arg viene también por herencia desde `base`
# (solo documentativo — sirve para que el editor muestre "también se puede
# setear en base").

.PRESETS_META <- list(

  # =========================================================================
  # BASE (se hereda a todos)
  # =========================================================================
  base = list(
    titulo_humano = "Base — estilo común",
    descripcion   = "Valores por defecto que heredan todos los gráficos: fuente, tamaños, colores de texto, negritas, formato del texto 'Base: N' y el debug de placeholders. Lo que pongas acá aplica a todo el reporte salvo que un preset tipo lo sobrescriba.",
    icono_ui      = "Layers",
    args = list(
      # --- Tipografía y fuente --------------------------------------------
      list(name = "font_family",       label = "Fuente",                 tipo_input = "string", grupo = "textos",
           default = "Arial",
           descripcion = "Familia tipográfica usada por todos los gráficos (ej. 'Arial', 'Helvetica', 'Open Sans', 'Roboto')."),
      list(name = "font_family_ppt",   label = "Fuente (solo PPT)",      tipo_input = "string", grupo = "textos",
           descripcion = "Sobrescribe la 'Fuente' solo al exportar a PowerPoint. Vacío = usa la general. Útil si en PPT necesitas una fuente Office-safe distinta."),
      list(name = "formato",           label = "Formato del texto base", tipo_input = "string", grupo = "textos",
           default = "Base: %s",
           descripcion = "Plantilla del texto automático de la base. %s se reemplaza por el conteo. Ej. 'Base: %s' → 'Base: 120'. Otras opciones: 'n = %s', 'N = %s respuestas'."),
      list(name = "sufijo_auto",       label = "Sufijo de la base auto", tipo_input = "string", grupo = "textos",
           descripcion = "Texto extra que se añade al final del conteo. Ej. si formato='Base: %s' y sufijo='Establecimientos de Salud' → 'Base: 120 Establecimientos de Salud'."),

      # --- Tamaños (pt) ---------------------------------------------------
      list(name = "size_titulo",       label = "Tamaño del título",      tipo_input = "number", grupo = "estilo",
           default = 12,
           descripcion = "Tamaño de fuente del título del gráfico (pt). Valores típicos: 10-14."),
      list(name = "size_subtitulo",    label = "Tamaño del subtítulo",   tipo_input = "number", grupo = "estilo",
           default = 9),
      list(name = "size_leyenda",      label = "Tamaño de la leyenda",   tipo_input = "number", grupo = "estilo",
           default = 10),
      list(name = "size_ejes",         label = "Tamaño de los ejes",     tipo_input = "number", grupo = "estilo",
           default = 10,
           descripcion = "Tamaño de las etiquetas de los ejes X e Y (pt)."),
      list(name = "size_nota_pie",     label = "Tamaño de la nota al pie", tipo_input = "number", grupo = "estilo",
           default = 8),
      list(name = "size_texto_barras", label = "Tamaño del texto de barras", tipo_input = "number", grupo = "estilo",
           default = 4,
           descripcion = "Tamaño de los valores numéricos que se escriben DENTRO de las barras (ej. los %). Nota: en ggplot/cowplot no es pt exacto, son unidades relativas."),

      # --- Colores de texto ----------------------------------------------
      list(name = "color_titulo",      label = "Color del título",       tipo_input = "color", grupo = "estilo",
           default = "#222222",
           descripcion = "Hex del color del texto del título (ej. '#39588B' para azul institucional)."),
      list(name = "color_subtitulo",   label = "Color del subtítulo",    tipo_input = "color", grupo = "estilo",
           default = "#222222"),
      list(name = "color_leyenda",     label = "Color de la leyenda",    tipo_input = "color", grupo = "estilo",
           default = "#222222"),
      list(name = "color_ejes",        label = "Color de los ejes",      tipo_input = "color", grupo = "estilo",
           default = "#222222"),
      list(name = "color_nota_pie",    label = "Color de la nota al pie", tipo_input = "color", grupo = "estilo",
           default = "#222222"),

      # --- Negritas -------------------------------------------------------
      # `base` expone el universo completo de tokens. Los presets tipo
      # graficador redeclaran el arg con su subset soportado.
      .arg_textos_negrita(c(
        "titulo", "subtitulo", "leyenda", "nota_pie",
        "ejes", "eje_x", "eje_y",
        "valores", "barra_extra", "titulos_grupo",
        "niveles", "etiquetas"
      )),

      # --- Debug de placeholders -----------------------------------------
      list(name = "debug_ph_bordes",   label = "Mostrar bordes", tipo_input = "bool",   grupo = "avanzado",
           default = FALSE,
           descripcion = "Muestra bordes de referencia alrededor de cada bloque interno del gráfico. Controlable con el botón global del encabezado."),
      list(name = "debug_ph_col",      label = "Color de los bordes", tipo_input = "string", grupo = "avanzado",
           default = "#FF00FF",
           descripcion = "Hex del color de los bordes de referencia. Magenta (#FF00FF) es el default porque no suele aparecer en gráficos reales."),
      list(name = "debug_ph_lwd",      label = "Grosor de los bordes", tipo_input = "number", grupo = "avanzado",
           default = 0.6)
    )
  ),

  # =========================================================================
  # BARRAS APILADAS — el preset más usado (escalas Likert)
  # =========================================================================
  barras_apiladas = list(
    titulo_humano = "Barras apiladas",
    descripcion   = "Estilo global de las barras apiladas horizontales (escalas Likert). Cada barra suma 100% y cada segmento es una categoría de respuesta. Hereda todo de 'Base'.",
    icono_ui      = "BarChartBig",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "leyenda", "eje_y", "valores", "barra_extra")),

      # --- Barra extra (Top2Box / Bottom2Box / N) ------------------------
      list(name = "mostrar_barra_extra",  label = "Mostrar barra extra",   tipo_input = "bool",   grupo = "estilo",
           descripcion = "Añade una barra adicional a la derecha con Top2Box, Bottom2Box o N. Se configura con 'Preset de la barra extra' del graficador."),
      list(name = "color_barra_extra",    label = "Color de la barra extra", tipo_input = "color", grupo = "estilo",
           descripcion = "Hex del color de la barra extra. Ej. '#39588B'."),
      list(name = "size_barra_extra",     label = "Tamaño texto barra extra", tipo_input = "number", grupo = "estilo"),
      list(name = "size_titulo_extra",    label = "Tamaño título de la columna extra", tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño del título que va encima de la barra extra (ej. 'TOP 2')."),
      list(name = "prefijo_barra_extra",  label = "Prefijo barra extra",   tipo_input = "string", grupo = "textos",
           descripcion = "Texto antes del valor de la barra extra. Ej. 'N = ' → 'N = 120'."),
      list(name = "size_titulos_grupo",   label = "Tamaño títulos de grupo", tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño de los títulos de bloque cuando se usan varias variables agrupadas."),

      # --- Etiquetas de valores ------------------------------------------
      list(name = "mostrar_valores",      label = "Mostrar valores",       tipo_input = "bool",   grupo = "estilo",
           descripcion = "Escribe el % dentro de cada segmento de la barra."),
      list(name = "color_texto_barras",   label = "Color texto en barras", tipo_input = "color", grupo = "estilo",
           default = "white",
           descripcion = "Color del texto del porcentaje dentro de cada segmento. 'white' o un hex."),
      list(name = "decimales",            label = "Decimales",             tipo_input = "number", grupo = "filtro",
           default = 0,
           descripcion = "Cuántos decimales mostrar en los porcentajes (0 = enteros)."),
      list(name = "umbral_etiqueta",      label = "Umbral mínimo para etiqueta", tipo_input = "number", grupo = "filtro",
           default = 0.01,
           descripcion = "Fracción mínima de la barra para que se escriba el valor. Segmentos por debajo quedan sin etiqueta. 0.01 = 1%."),
      list(name = "umbral_mostrar_etiqueta", label = "Umbral para mostrar etiqueta", tipo_input = "number", grupo = "filtro",
           descripcion = "Variante: segmentos muy pequeños pueden tener la etiqueta afuera/desplazada. Este es el corte a partir del cual aparece."),
      list(name = "umbral_etiqueta_normal", label = "Umbral etiqueta normal", tipo_input = "number", grupo = "filtro",
           descripcion = "A partir de este umbral, la etiqueta va dentro del segmento sin desplazar."),
      list(name = "repeler_etiquetas_peq", label = "Repeler etiquetas pequeñas", tipo_input = "bool",   grupo = "filtro",
           descripcion = "Si está activo, las etiquetas de segmentos muy chicos se desplazan verticalmente para no superponerse."),
      list(name = "desplazamiento_max_etiquetas_peq", label = "Desplazamiento máximo etiquetas pequeñas", tipo_input = "number", grupo = "filtro",
           descripcion = "Cuánto puede moverse (fracción) una etiqueta chica al repelerla. 0.06 es típico."),

      # --- Eje Y ----------------------------------------------------------
      list(name = "ancho_max_eje_y",      label = "Ancho máximo eje Y",    tipo_input = "number", grupo = "filtro",
           default = 15,
           descripcion = "Máximo de caracteres por línea en las etiquetas del eje Y antes de romper. Valores 10-80 según cuánto espacio tengas."),
      list(name = "wrap_y",               label = "Wrap eje Y (alternativo)", tipo_input = "number", grupo = "filtro",
           descripcion = "Alias alternativo para ancho_max_eje_y, por compatibilidad."),
      list(name = "invertir_barras",      label = "Invertir orden de las barras", tipo_input = "bool",   grupo = "estilo",
           descripcion = "Si es TRUE, las barras se muestran en orden inverso (la primera abajo, la última arriba)."),
      list(name = "angle_x",              label = "Rotación etiquetas X",  tipo_input = "number", grupo = "estilo",
           default = 0,
           descripcion = "Grados de rotación del eje X (0 = horizontal, 45 = diagonal, 90 = vertical)."),

      # --- Leyenda --------------------------------------------------------
      list(name = "leyenda_posicion",     label = "Posición de la leyenda", tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",    label = "Abajo"),
             list(value = "arriba",   label = "Arriba"),
             list(value = "derecha",  label = "Derecha"),
             list(value = "izquierda",label = "Izquierda"),
             list(value = "ninguna",  label = "Ocultar")
           )),
      list(name = "legend_key_cm",        label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo",
           default = 0.40),
      list(name = "legend_espaciado",     label = "Espaciado entre items de leyenda", tipo_input = "number", grupo = "estilo",
           default = 15),
      list(name = "legend_n_por_fila",    label = "Items por fila en leyenda", tipo_input = "number", grupo = "estilo",
           default = 6),

      # --- Canvas (anchos y altos internos en pulgadas) ------------------
      list(name = "canvas_w_etiquetas",     label = "Ancho columna etiquetas", tipo_input = "number", grupo = "canvas",
           default = 0.12,
           descripcion = "Fracción del ancho total que ocupa la columna de etiquetas del eje Y. 0.12 = 12% del canvas."),
      list(name = "canvas_w_buf_etq_bars",  label = "Espacio etiquetas→barras", tipo_input = "number", grupo = "canvas",
           default = 0.02,
           descripcion = "Fracción de separación entre las etiquetas y las barras."),
      list(name = "canvas_w_bars",          label = "Ancho zona de barras",   tipo_input = "number", grupo = "canvas",
           default = 0.60,
           descripcion = "Fracción del ancho para las barras principales. Debe sumar con los demás w_* aprox 1.0."),
      list(name = "canvas_w_buf_bars_extra",label = "Espacio barras→columna extra", tipo_input = "number", grupo = "canvas",
           default = 0.02),
      list(name = "canvas_w_extra",         label = "Ancho columna extra",    tipo_input = "number", grupo = "canvas",
           default = 0.12,
           descripcion = "Fracción del ancho para la columna de la barra extra (Top2Box, N, etc.)."),
      list(name = "canvas_h_toprow_in",     label = "Alto zona superior (in)", tipo_input = "number", grupo = "canvas",
           default = 0.10,
           descripcion = "Altura en pulgadas de la primera fila del canvas (espacio en blanco arriba)."),
      list(name = "canvas_h_header_in",     label = "Alto del header (in)",   tipo_input = "number", grupo = "canvas",
           default = 0.15,
           descripcion = "Altura en pulgadas de la zona del título. Si el título no entra, aumenta este valor."),
      list(name = "canvas_h_legend_in",     label = "Alto de la leyenda (in)", tipo_input = "number", grupo = "canvas",
           default = 0.15),
      list(name = "canvas_h_caption_in",    label = "Alto del pie de página (in)", tipo_input = "number", grupo = "canvas",
           default = 0.20),
      list(name = "alto_por_categoria",     label = "Alto por categoría (in)", tipo_input = "number", grupo = "canvas",
           default = 0.46,
           descripcion = "Altura en pulgadas que ocupa cada fila (categoría). Más = barras más gruesas."),

      # --- Grosor de barras ----------------------------------------------
      list(name = "grosor_modo",          label = "Modo de grosor",        tipo_input = "choice", grupo = "avanzado",
           default = "auto",
           choices = list(
             list(value = "auto",   label = "Automático",   hint = "Se calcula según alto_por_categoria."),
             list(value = "manual", label = "Manual",        hint = "Usa grosor_barras tal cual.")
           )),
      list(name = "grosor_barras",        label = "Grosor de las barras",  tipo_input = "number", grupo = "avanzado",
           default = 0.6,
           descripcion = "Solo si modo=manual. Valor entre 0 y 1."),
      list(name = "grosor_barras_mult",   label = "Multiplicador grosor (modo auto)", tipo_input = "number", grupo = "avanzado",
           default = 0.9,
           descripcion = "Solo si modo=auto. Fracción del alto_por_categoria que ocupa la barra (0.9 = barras casi pegadas, 0.6 = más separadas)."),

      # --- Avanzado -------------------------------------------------------
      list(name = "exportar",             label = "Modo de export",        tipo_input = "choice", grupo = "avanzado",
           default = "rplot",
           choices = list(
             list(value = "rplot",  label = "R plot (default)"),
             list(value = "image",  label = "Imagen PNG")
           ))
    )
  ),

  # =========================================================================
  # MULTI-APILADAS (conjunto de preguntas con misma escala)
  # =========================================================================
  multi_apiladas = list(
    titulo_humano = "Multi-apiladas",
    descripcion   = "Varias barras apiladas en un solo gráfico (preguntas con misma escala). Hereda muchos args de 'Barras apiladas' por similitud visual.",
    icono_ui      = "Rows3",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "leyenda", "eje_y", "valores", "barra_extra", "titulos_grupo")),

      # --- Textos / tamaños ---------------------------------------------
      list(name = "size_titulos_grupo",   label = "Tamaño títulos de bloque", tipo_input = "number", grupo = "estilo",
           descripcion = "Cuando hay varios bloques temáticos, es el tamaño del título de cada bloque."),
      list(name = "color_texto_barras",   label = "Color texto en barras", tipo_input = "color", grupo = "estilo"),
      list(name = "mostrar_valores",      label = "Mostrar valores",       tipo_input = "bool",   grupo = "estilo"),
      list(name = "decimales",            label = "Decimales",             tipo_input = "number", grupo = "filtro"),
      list(name = "umbral_etiqueta",      label = "Umbral mínimo para etiqueta", tipo_input = "number", grupo = "filtro"),
      list(name = "repeler_etiquetas_peq", label = "Repeler etiquetas pequeñas", tipo_input = "bool", grupo = "filtro"),

      # --- Barra extra ---------------------------------------------------
      list(name = "mostrar_barra_extra",  label = "Mostrar barra extra",   tipo_input = "bool",   grupo = "estilo"),
      list(name = "prefijo_barra_extra",  label = "Prefijo barra extra",   tipo_input = "string", grupo = "textos"),
      list(name = "color_barra_extra",    label = "Color de la barra extra", tipo_input = "color", grupo = "estilo"),

      # --- Eje Y + separación --------------------------------------------
      list(name = "espacio_entre_barras", label = "Separación entre barras", tipo_input = "number", grupo = "estilo",
           descripcion = "Fracción del ancho entre barras (0 = pegadas, 0.3 = separación generosa)."),
      list(name = "ancho_max_eje_y",      label = "Ancho máximo eje Y",    tipo_input = "number", grupo = "filtro"),
      list(name = "invertir_barras",      label = "Invertir orden",        tipo_input = "bool",   grupo = "estilo"),
      list(name = "angle_x",              label = "Rotación etiquetas X",  tipo_input = "number", grupo = "estilo"),
      list(name = "alto_por_categoria",   label = "Alto por categoría (in)", tipo_input = "number", grupo = "canvas"),

      # --- Leyenda --------------------------------------------------------
      list(name = "leyenda_posicion",     label = "Posición de la leyenda", tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",  label = "Abajo"),
             list(value = "arriba", label = "Arriba"),
             list(value = "derecha",label = "Derecha"),
             list(value = "izquierda",label = "Izquierda"),
             list(value = "ninguna",label = "Ocultar")
           )),
      list(name = "legend_key_cm",        label = "Tamaño icono leyenda",  tipo_input = "number", grupo = "estilo"),
      list(name = "legend_espaciado",     label = "Espaciado leyenda",     tipo_input = "number", grupo = "estilo"),
      list(name = "legend_n_por_fila",    label = "Items por fila leyenda", tipo_input = "number", grupo = "estilo"),

      # --- Canvas ---------------------------------------------------------
      list(name = "canvas_w_etiquetas",     label = "Ancho columna etiquetas", tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_w_bars",          label = "Ancho zona de barras",   tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_w_extra",         label = "Ancho columna extra",    tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_toprow_in",     label = "Alto zona superior (in)", tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_header_in",     label = "Alto del header (in)",   tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_legend_in",     label = "Alto de la leyenda (in)", tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_caption_in",    label = "Alto del pie (in)",      tipo_input = "number", grupo = "canvas")
    )
  ),

  # =========================================================================
  # BARRAS AGRUPADAS
  # =========================================================================
  barras_agrupadas = list(
    titulo_humano = "Barras agrupadas",
    descripcion   = "Barras lado a lado (una por categoría), útil para comparar entre grupos. Puede tener una o varias series.",
    icono_ui      = "BarChartHorizontal",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "leyenda", "eje_y", "valores", "barra_extra")),

      # --- Serie y leyenda -----------------------------------------------
      list(name = "mostrar_leyenda",      label = "Mostrar leyenda",       tipo_input = "bool",   grupo = "estilo",
           descripcion = "Útil poner en FALSE cuando hay una sola serie (no hace falta explicarla)."),
      list(name = "leyenda_posicion",     label = "Posición de la leyenda", tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",  label = "Abajo"),
             list(value = "arriba", label = "Arriba"),
             list(value = "derecha",label = "Derecha"),
             list(value = "izquierda",label = "Izquierda"),
             list(value = "ninguna",label = "Ocultar")
           )),
      list(name = "colores_series",       label = "Colores por serie",     tipo_input = "series_colors", grupo = "estilo",
           descripcion = "Asigna un color a cada serie que aparece en la leyenda."),
      list(name = "invertir_barras",      label = "Invertir orden",        tipo_input = "bool",   grupo = "estilo"),
      list(name = "angle_x",              label = "Rotación etiquetas X",  tipo_input = "number", grupo = "estilo"),

      # --- Valores y cálculo ---------------------------------------------
      list(name = "mostrar_valores",      label = "Mostrar valores",       tipo_input = "bool",   grupo = "estilo"),
      list(name = "decimales",            label = "Decimales",             tipo_input = "number", grupo = "filtro"),
      list(name = "umbral_etiqueta",      label = "Umbral mínimo para etiqueta", tipo_input = "number", grupo = "filtro",
           default = 0.001),
      list(name = "umbral_posicion",      label = "Umbral de posición de la etiqueta", tipo_input = "number", grupo = "filtro",
           default = 0.07,
           descripcion = "A partir de qué fracción la etiqueta va dentro vs fuera de la barra."),

      # --- Barra extra (menos común acá) ---------------------------------
      list(name = "mostrar_barra_extra",  label = "Mostrar barra extra",   tipo_input = "bool",   grupo = "estilo"),
      list(name = "prefijo_barra_extra",  label = "Prefijo barra extra",   tipo_input = "string", grupo = "textos"),
      list(name = "size_barra_extra",     label = "Tamaño texto barra extra", tipo_input = "number", grupo = "estilo"),
      list(name = "color_texto_barras",   label = "Color texto en barras", tipo_input = "color", grupo = "estilo"),

      # --- Eje Y / labels -------------------------------------------------
      list(name = "ancho_max_eje_y",      label = "Ancho máximo eje Y",    tipo_input = "number", grupo = "filtro", default = 30),
      list(name = "wrap_y",               label = "Wrap eje Y",            tipo_input = "number", grupo = "filtro"),

      # --- Canvas ---------------------------------------------------------
      list(name = "canvas_w_etiquetas",     label = "Ancho columna etiquetas", tipo_input = "number", grupo = "canvas", default = 0.15),
      list(name = "canvas_w_buf_etq_bars",  label = "Espacio etiquetas→barras", tipo_input = "number", grupo = "canvas", default = 0.02),
      list(name = "canvas_w_bars",          label = "Ancho zona de barras",   tipo_input = "number", grupo = "canvas", default = 0.58),
      list(name = "canvas_w_buf_bars_extra",label = "Espacio barras→extra",   tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_w_extra",         label = "Ancho columna extra",    tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_toprow_in",     label = "Alto zona superior (in)", tipo_input = "number", grupo = "canvas", default = 0.10),
      list(name = "canvas_h_header_in",     label = "Alto del header (in)",   tipo_input = "number", grupo = "canvas", default = 0.70),
      list(name = "canvas_h_legend_in",     label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas", default = 0),
      list(name = "canvas_h_caption_in",    label = "Alto pie (in)",          tipo_input = "number", grupo = "canvas", default = 0),
      list(name = "alto_por_categoria",     label = "Alto por categoría (in)", tipo_input = "number", grupo = "canvas", default = 0.48)
    )
  ),

  # =========================================================================
  # BARRAS NUMÉRICAS (medias, KPIs)
  # =========================================================================
  barras_numericas = list(
    titulo_humano = "Barras numéricas",
    descripcion   = "Barras de valores numéricos (medias, sumas, conteos). Útil para KPIs comparativos. Suele ir con orientación vertical y valor sobre cada barra.",
    icono_ui      = "BarChart",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "leyenda", "valores")),

      list(name = "orientacion",          label = "Orientación",            tipo_input = "choice", grupo = "estilo",
           default = "vertical",
           choices = list(
             list(value = "vertical",   label = "Vertical",   hint = "Barras de abajo hacia arriba."),
             list(value = "horizontal", label = "Horizontal", hint = "Barras de izquierda a derecha.")
           )),

      # --- Valores -------------------------------------------------------
      list(name = "mostrar_valores",      label = "Mostrar valor dentro",  tipo_input = "bool",   grupo = "estilo",
           default = TRUE,
           descripcion = "Escribe el valor dentro de cada barra."),
      list(name = "color_texto_barras",   label = "Color texto en barras", tipo_input = "color", grupo = "estilo",
           default = "white"),
      list(name = "size_texto_barras",    label = "Tamaño texto en barras", tipo_input = "number", grupo = "estilo", default = 4.4),
      list(name = "decimales",            label = "Decimales",             tipo_input = "number", grupo = "filtro",
           descripcion = "Decimales del valor. Ej. 1 → '4.3', 0 → '4'."),

      # --- N sobre barras ------------------------------------------------
      list(name = "mostrar_n_sobre_barras", label = "Mostrar N arriba de cada barra", tipo_input = "bool", grupo = "estilo",
           descripcion = "Imprime 'N = 120' encima de cada barra. Útil cuando el tamaño muestral varía entre grupos."),
      list(name = "prefijo_n_sobre_barras", label = "Prefijo del N",        tipo_input = "string", grupo = "textos",
           default = "N = "),
      list(name = "size_n_sobre_barras",    label = "Tamaño texto N",       tipo_input = "number", grupo = "estilo", default = 3.6),
      list(name = "color_n_sobre_barras",   label = "Color texto N",        tipo_input = "color", grupo = "estilo", default = "#0B3A67"),

      # --- Eje Y ---------------------------------------------------------
      list(name = "mostrar_eje_y",        label = "Mostrar eje Y numérico", tipo_input = "bool",   grupo = "estilo",
           default = FALSE,
           descripcion = "Si los valores están dentro de las barras, normalmente el eje Y sobra."),

      # --- Serie ---------------------------------------------------------
      list(name = "colores_series",       label = "Colores por serie",     tipo_input = "series_colors", grupo = "estilo",
           descripcion = "Asigna un color a cada serie que aparece en la leyenda."),
      list(name = "mostrar_leyenda",      label = "Mostrar leyenda",       tipo_input = "bool",   grupo = "estilo"),
      list(name = "leyenda_posicion",     label = "Posición leyenda",      tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "arriba",  label = "Arriba"),
             list(value = "derecha", label = "Derecha"),
             list(value = "izquierda", label = "Izquierda"),
             list(value = "ninguna", label = "Ocultar")
           )),

      # --- Canvas ---------------------------------------------------------
      list(name = "canvas_h_title",       label = "Alto zona título (in)",  tipo_input = "number", grupo = "canvas", default = 0.12),
      list(name = "canvas_h_legend",      label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas", default = 0.10),
      list(name = "canvas_h_caption",     label = "Alto pie (in)",          tipo_input = "number", grupo = "canvas", default = 0),
      list(name = "canvas_pad_top",       label = "Padding superior (in)",  tipo_input = "number", grupo = "canvas", default = 0.01),

      # --- Textos --------------------------------------------------------
      list(name = "nota_pie",             label = "Nota al pie (fijo)",    tipo_input = "string", grupo = "textos",
           descripcion = "Texto opcional que siempre va al pie. Si está vacío, se usa la base automática.")
    )
  ),

  # =========================================================================
  # PIE
  # =========================================================================
  pie = list(
    titulo_humano = "Pie",
    descripcion   = "Gráfico de torta con porcentajes. 'Donut' hereda su configuración por defecto — definilo acá y el donut lo respeta.",
    icono_ui      = "PieChart",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "leyenda", "etiquetas")),

      list(name = "tipo_pie",             label = "Tipo",                   tipo_input = "choice", grupo = "estilo",
           default = "pie",
           choices = list(
             list(value = "pie",   label = "Pie (torta llena)"),
             list(value = "donut", label = "Donut (con hueco)")
           )),

      # --- Etiquetas porcentuales ---------------------------------------
      list(name = "mostrar_etiquetas_pct", label = "Mostrar porcentajes",  tipo_input = "bool",   grupo = "estilo", default = TRUE),
      list(name = "size_etiquetas_pct",    label = "Tamaño etiquetas %",   tipo_input = "number", grupo = "estilo", default = 5),
      list(name = "color_etiquetas_pct",   label = "Color etiquetas %",    tipo_input = "color", grupo = "estilo", default = "white"),
      list(name = "etiquetas_negrita",     label = "Etiquetas en negrita", tipo_input = "bool",   grupo = "estilo", default = TRUE),

      # --- Leyenda -------------------------------------------------------
      list(name = "leyenda_posicion",      label = "Posición leyenda",     tipo_input = "choice", grupo = "estilo",
           default = "abajo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "derecha", label = "Derecha"),
             list(value = "ninguna", label = "Ocultar")
           )),
      list(name = "size_leyenda",         label = "Tamaño leyenda",        tipo_input = "number", grupo = "estilo", default = 11),
      list(name = "tamano_key_cm",        label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo", default = 0.45),
      list(name = "espaciado_vertical_cm",label = "Espaciado vertical leyenda (cm)", tipo_input = "number", grupo = "estilo", default = 0.30),
      list(name = "ncol_leyenda_bajo",    label = "Columnas leyenda (abajo)", tipo_input = "number", grupo = "estilo", default = 2,
           descripcion = "Solo aplica cuando la leyenda va abajo. Distribuye los items en N columnas."),
      list(name = "invertir_leyenda",     label = "Invertir orden leyenda", tipo_input = "bool",   grupo = "estilo", default = TRUE),

      # --- Título y orden ------------------------------------------------
      list(name = "pos_titulo",           label = "Posición del título",   tipo_input = "choice", grupo = "textos",
           default = "centro",
           choices = list(
             list(value = "centro",    label = "Centro"),
             list(value = "izquierda", label = "Izquierda"),
             list(value = "derecha",   label = "Derecha")
           )),
      list(name = "size_titulo",          label = "Tamaño título",         tipo_input = "number", grupo = "estilo", default = 13),
      list(name = "subtitulo",            label = "Subtítulo (fijo)",      tipo_input = "string", grupo = "textos"),
      list(name = "nota_pie",             label = "Nota al pie (fija)",    tipo_input = "string", grupo = "textos"),
      list(name = "ordenar_categorias",   label = "Orden de las categorías", tipo_input = "choice", grupo = "filtro",
           default = "asc",
           choices = list(
             list(value = "asc",     label = "Ascendente (menor → mayor)"),
             list(value = "desc",    label = "Descendente (mayor → menor)"),
             list(value = "natural", label = "Natural (orden del instrumento)")
           )),

      # --- Canvas --------------------------------------------------------
      list(name = "canvas_h_title",         label = "Alto zona título (in)", tipo_input = "number", grupo = "canvas", default = 0.08),
      list(name = "canvas_h_caption",       label = "Alto zona pie (in)",    tipo_input = "number", grupo = "canvas", default = 0),
      list(name = "canvas_h_legend_bottom", label = "Alto leyenda inferior (in)", tipo_input = "number", grupo = "canvas", default = 0.08),
      list(name = "canvas_w_legend_right",  label = "Ancho leyenda derecha", tipo_input = "number", grupo = "canvas",
           descripcion = "Fracción del ancho reservada cuando la leyenda va a la derecha. Ej. 0.30 = 30% para la leyenda."),
      list(name = "canvas_pad_top",         label = "Padding superior (in)", tipo_input = "number", grupo = "canvas", default = 0),

      # --- Debug ---------------------------------------------------------
      list(name = "debug_lw",             label = "Grosor línea debug",    tipo_input = "number", grupo = "avanzado", default = 1)
    )
  ),

  # =========================================================================
  # DONUT (hereda pie)
  # =========================================================================
  donut = list(
    titulo_humano = "Donut",
    descripcion   = "Variante compacta del pie con hueco central. Por defecto hereda TODO del preset 'Pie'; los args acá solo lo sobrescriben.",
    icono_ui      = "CircleDot",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "leyenda", "etiquetas")),

      list(name = "tipo_pie",             label = "Tipo",                   tipo_input = "choice", grupo = "estilo", default = "donut",
           choices = list(
             list(value = "pie",   label = "Pie"),
             list(value = "donut", label = "Donut")
           )),
      list(name = "donut_hole",           label = "Tamaño del hueco",      tipo_input = "number", grupo = "estilo", default = 0.60,
           descripcion = "Fracción del radio ocupada por el hueco central. 0 = pie, 0.4 = donut grueso, 0.7 = donut fino."),
      list(name = "leyenda_posicion",     label = "Posición leyenda",      tipo_input = "choice", grupo = "estilo",
           default = "derecha",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "derecha", label = "Derecha"),
             list(value = "ninguna", label = "Ocultar")
           )),
      list(name = "size_titulo",          label = "Tamaño título",         tipo_input = "number", grupo = "estilo"),
      list(name = "size_leyenda",         label = "Tamaño leyenda",        tipo_input = "number", grupo = "estilo"),
      list(name = "size_etiquetas_pct",   label = "Tamaño etiquetas %",    tipo_input = "number", grupo = "estilo"),
      list(name = "tamano_key_cm",        label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo"),
      list(name = "espaciado_vertical_cm",label = "Espaciado vertical leyenda (cm)", tipo_input = "number", grupo = "estilo"),
      list(name = "ncol_leyenda_bajo",    label = "Columnas leyenda (abajo)", tipo_input = "number", grupo = "estilo"),
      list(name = "canvas_h_title",       label = "Alto zona título (in)", tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_legend_bottom", label = "Alto leyenda inferior (in)", tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_w_legend_right",label = "Ancho leyenda derecha", tipo_input = "number", grupo = "canvas")
    )
  ),

  # =========================================================================
  # RADAR + TABLA (el más denso en args — 40+)
  # =========================================================================
  radar_tabla = list(
    titulo_humano = "Radar + tabla",
    descripcion   = "Gráfico radar (telaraña) acompañado de una tabla a la derecha (típicamente Top Two Box). Muy configurable para reportes formales.",
    icono_ui      = "Radar",
    args = list(

      # --- Escala del radar ---------------------------------------------
      list(name = "escala_valor",         label = "Escala de valores",      tipo_input = "choice", grupo = "filtro",
           default = "proporcion_1",
           choices = list(
             list(value = "proporcion_1",  label = "Proporción 0-1",  hint = "Los valores van de 0 a 1."),
             list(value = "porcentaje_100",label = "Porcentaje 0-100",hint = "Los valores van de 0 a 100.")
           )),
      list(name = "limites",              label = "Límites del radar",     tipo_input = "codigos_list", grupo = "filtro",
           descripcion = "Mínimo y máximo, separados por coma. Ej: 0, 1 o 0, 100. Si vacío, se deduce de escala_valor."),
      list(name = "cortes_grilla",        label = "Cortes de la grilla",   tipo_input = "number", grupo = "estilo", default = 6,
           descripcion = "Número de círculos concéntricos dentro del radar."),
      list(name = "mostrar_niveles",      label = "Mostrar etiquetas de grilla", tipo_input = "bool", grupo = "estilo", default = FALSE,
           descripcion = "Muestra los valores en cada círculo (ej. 20, 40, 60...)."),
      list(name = "mostrar_radios",       label = "Mostrar radios",        tipo_input = "bool",   grupo = "estilo", default = FALSE),
      list(name = "rellenar_poligono",    label = "Rellenar polígono",     tipo_input = "bool",   grupo = "estilo", default = FALSE,
           descripcion = "Si es TRUE, el área dentro del polígono se colorea."),
      list(name = "radar_scale",          label = "Escala del radar",      tipo_input = "number", grupo = "estilo", default = 0.85,
           descripcion = "Fracción del espacio disponible que ocupa el radar (0.85 deja ~15% para respirar)."),

      # --- Ejes ---------------------------------------------------------
      list(name = "eje_label_mult",       label = "Separación etiquetas de ejes", tipo_input = "number", grupo = "estilo", default = 1.2,
           descripcion = "Multiplicador que aleja las etiquetas del centro. 1 = pegadas al vértice, 1.2 = más afuera."),
      list(name = "wrap_ejes",            label = "Ancho etiquetas de ejes", tipo_input = "number", grupo = "estilo", default = 20,
           descripcion = "Caracteres máximo antes de quebrar la etiqueta del eje."),
      list(name = "size_ejes",            label = "Tamaño texto de ejes",   tipo_input = "number", grupo = "estilo", default = 10),
      list(name = "size_linea",           label = "Grosor de línea del radar", tipo_input = "number", grupo = "estilo", default = 1.2),
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "leyenda", "ejes", "niveles")),

      # --- Leyenda -------------------------------------------------------
      list(name = "mostrar_leyenda",      label = "Mostrar leyenda",       tipo_input = "bool",   grupo = "estilo", default = TRUE),
      list(name = "leyenda_posicion",     label = "Posición leyenda",      tipo_input = "choice", grupo = "estilo",
           default = "abajo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "arriba",  label = "Arriba"),
             list(value = "ninguna", label = "Ocultar")
           )),
      list(name = "legend_n_por_fila",    label = "Items por fila",        tipo_input = "number", grupo = "estilo", default = 3),
      list(name = "legend_key_cm",        label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo", default = 0.60),
      list(name = "legend_espaciado",     label = "Espaciado entre items",  tipo_input = "number", grupo = "estilo", default = 20),
      list(name = "legend_key_spacing_x_cm", label = "Espaciado horizontal key-texto (cm)", tipo_input = "number", grupo = "estilo", default = 0.12),
      list(name = "size_leyenda",         label = "Tamaño leyenda",        tipo_input = "number", grupo = "estilo", default = 12),

      # --- Tabla derecha: existencia + contenido ------------------------
      list(name = "mostrar_tabla_derecha",label = "Mostrar tabla a la derecha", tipo_input = "bool", grupo = "tabla", default = TRUE),
      list(name = "titulo_tabla",         label = "Título de la tabla",    tipo_input = "string", grupo = "tabla",
           default = "TOP TWO BOX"),
      list(name = "tabla_digits",         label = "Decimales en tabla",    tipo_input = "number", grupo = "tabla", default = 0),
      list(name = "umbral_rojo_pct",      label = "Umbral rojo (%)",       tipo_input = "number", grupo = "tabla", default = 60,
           descripcion = "Celdas por debajo de este porcentaje se marcan en rojo. 0 = deshabilitado."),

      # --- Tabla: colores y bordes --------------------------------------
      list(name = "tabla_header_fill",    label = "Color de fondo header",  tipo_input = "string", grupo = "tabla",
           descripcion = "Hex del fondo del encabezado. NA = transparente."),
      list(name = "tabla_body_fill",      label = "Color de fondo body",    tipo_input = "string", grupo = "tabla",
           descripcion = "Hex del fondo de las celdas. NA = transparente."),
      list(name = "tabla_grid_col",       label = "Color de la grilla",     tipo_input = "string", grupo = "tabla",
           default = "white"),
      list(name = "tabla_text_blue",      label = "Color del texto",        tipo_input = "string", grupo = "tabla",
           default = "#062A63"),
      list(name = "tabla_line_lwd",       label = "Grosor de líneas",       tipo_input = "number", grupo = "tabla"),

      # --- Tabla: tamaños y padding --------------------------------------
      list(name = "tabla_padding_mm",     label = "Padding interno (mm)",   tipo_input = "number", grupo = "tabla", default = 10),
      list(name = "tabla_header_size",    label = "Tamaño texto header",    tipo_input = "number", grupo = "tabla", default = 8),
      list(name = "tabla_body_size",      label = "Tamaño texto body",      tipo_input = "number", grupo = "tabla", default = 7),
      list(name = "tabla_firstcol_size",  label = "Tamaño texto 1ra columna", tipo_input = "number", grupo = "tabla"),
      list(name = "tabla_firstcol_bold",  label = "1ra columna en negrita", tipo_input = "bool",   grupo = "tabla", default = TRUE),
      list(name = "tabla_firstcol_wrap",  label = "Ancho 1ra columna (chars)", tipo_input = "number", grupo = "tabla",
           descripcion = "Máximo de caracteres por línea en la primera columna antes de romper."),
      list(name = "tabla_firstcol_indent_npc", label = "Indent 1ra columna", tipo_input = "number", grupo = "tabla"),
      list(name = "tabla_firstcol_frac",  label = "Fracción 1ra columna",   tipo_input = "number", grupo = "tabla",
           descripcion = "Fracción del ancho de la tabla que ocupa la primera columna (0.4 = 40%)."),
      list(name = "tabla_auto_fit",       label = "Auto-ajustar tamaños",   tipo_input = "bool",   grupo = "tabla", default = FALSE,
           descripcion = "Si es TRUE, intenta ajustar los tamaños automáticamente para que quepa todo."),
      list(name = "tabla_height_frac",    label = "Fracción de altura",     tipo_input = "number", grupo = "tabla",
           descripcion = "Fracción del alto disponible que ocupa la tabla (0.72 = 72%)."),

      # --- Tabla: placeholder ppt ----------------------------------------
      list(name = "tabla_ph_ancho",       label = "Ancho placeholder PPT",  tipo_input = "number", grupo = "canvas", default = 0.46),
      list(name = "tabla_ph_gap",         label = "Gap placeholder-radar",  tipo_input = "number", grupo = "canvas", default = 0.01),
      list(name = "tabla_ph_margin_top",  label = "Margen superior PH",     tipo_input = "number", grupo = "canvas", default = 0.001),
      list(name = "tabla_ph_margin_bot",  label = "Margen inferior PH",     tipo_input = "number", grupo = "canvas", default = 0.001),

      # --- Canvas --------------------------------------------------------
      list(name = "canvas_h_header_in",   label = "Alto header (in)",       tipo_input = "number", grupo = "canvas", default = 0.45),
      list(name = "canvas_h_legend_in",   label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas", default = 0.22)
    )
  ),

  # =========================================================================
  # BOX PLOT
  # =========================================================================
  boxplot = list(
    titulo_humano = "Box plot",
    descripcion   = "Cajas con cuartiles y bigotes. Muestra la distribución de una variable numérica por grupos. 'Media y rango' hereda muchos args de aquí.",
    icono_ui      = "BoxSelect",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "leyenda", "nota_pie")),

      # --- Elementos visibles --------------------------------------------
      list(name = "mostrar_outliers",     label = "Mostrar outliers",      tipo_input = "bool",   grupo = "estilo",
           descripcion = "Dibujar los puntos que caen fuera de los bigotes."),
      list(name = "mostrar_media",        label = "Mostrar media",         tipo_input = "bool",   grupo = "estilo",
           descripcion = "Añade un marcador con la media además de la mediana."),
      list(name = "mostrar_rango",        label = "Mostrar rango extendido", tipo_input = "bool", grupo = "estilo",
           descripcion = "Dibuja barras con min-max o IQR según tipo_rango."),
      list(name = "tipo_rango",           label = "Tipo de rango",         tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "iqr",     label = "IQR (P25-P75)"),
             list(value = "min_max", label = "Min-Max")
           )),
      list(name = "mostrar_leyenda",      label = "Mostrar leyenda",       tipo_input = "bool",   grupo = "estilo"),

      # --- Cálculo -------------------------------------------------------
      list(name = "decimales_promedio",   label = "Decimales del promedio", tipo_input = "number", grupo = "filtro"),

      # --- Canvas --------------------------------------------------------
      list(name = "canvas_h_title",       label = "Alto zona título (in)",  tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_legend",      label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_pad_top",       label = "Padding superior (in)",  tipo_input = "number", grupo = "canvas")
    )
  ),

  # =========================================================================
  # MEDIA Y RANGO
  # =========================================================================
  media_rango = list(
    titulo_humano = "Media y rango",
    descripcion   = "Puntos con el promedio por grupo y opcionalmente barras de rango (min-max o IQR). Hereda de 'Box plot' y 'Base'.",
    icono_ui      = "Activity",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "leyenda", "nota_pie")),

      list(name = "decimales_promedio",   label = "Decimales del promedio", tipo_input = "number", grupo = "filtro"),
      list(name = "mostrar_rango",        label = "Mostrar rango",         tipo_input = "bool",   grupo = "estilo"),
      list(name = "tipo_rango",           label = "Tipo de rango",         tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "iqr",     label = "IQR (P25-P75)"),
             list(value = "min_max", label = "Min-Max")
           )),
      list(name = "mostrar_ref_label",    label = "Mostrar línea/etiqueta de referencia", tipo_input = "bool", grupo = "estilo",
           descripcion = "Añade una línea o texto con el promedio global como referencia visual."),
      list(name = "mostrar_leyenda",      label = "Mostrar leyenda",       tipo_input = "bool",   grupo = "estilo"),
      list(name = "canvas_h_title",       label = "Alto zona título (in)",  tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_h_legend",      label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas"),
      list(name = "canvas_pad_top",       label = "Padding superior (in)",  tipo_input = "number", grupo = "canvas")
    )
  ),

  # =========================================================================
  # DIMENSIONES: HEATMAP
  # =========================================================================
  dim_heatmap = list(
    titulo_humano = "Heatmap dimensional",
    descripcion   = "Mapa de calor de dimensiones (filas) vs grupos del cruce (columnas). Requiere haber calculado dimensiones en Analítica.",
    icono_ui      = "LayoutGrid",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "eje_x", "eje_y")),

      list(name = "angle_x",              label = "Rotación etiquetas X",  tipo_input = "number", grupo = "estilo", default = 0),
      list(name = "size_ejes",            label = "Tamaño ejes",           tipo_input = "number", grupo = "estilo", default = 10),
      list(name = "size_texto_celdas",    label = "Tamaño texto de celdas", tipo_input = "number", grupo = "estilo", default = 10),
      list(name = "canvas_h_title",       label = "Alto zona título (in)", tipo_input = "number", grupo = "canvas", default = 0.13),
      list(name = "canvas_h_legend",      label = "Alto leyenda (in)",     tipo_input = "number", grupo = "canvas", default = 0.09),
      list(name = "canvas_h_caption",     label = "Alto pie (in)",         tipo_input = "number", grupo = "canvas", default = 0.06)
    )
  ),

  dim_heatmap_criterios = list(
    titulo_humano = "Heatmap por criterios",
    descripcion   = "Heatmap dimensional agrupado por criterios temáticos. Hereda de 'Heatmap dimensional' y 'Base'.",
    icono_ui      = "LayoutGrid",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "eje_x", "eje_y")),

      list(name = "font_family",          label = "Fuente",                tipo_input = "string", grupo = "textos",
           descripcion = "Vacío = hereda de Base.")
    )
  ),

  # =========================================================================
  # DIMENSIONES: RADAR
  # =========================================================================
  dim_radar = list(
    titulo_humano = "Radar dimensional",
    descripcion   = "Radar (telaraña) comparando el puntaje de varias dimensiones o indicadores. Requiere dimensiones calculadas.",
    icono_ui      = "Radar",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie", "leyenda", "ejes", "niveles")),

      list(name = "cortes_grilla",        label = "Cortes de la grilla",    tipo_input = "number", grupo = "estilo", default = 4),
      list(name = "wrap_ejes",            label = "Ancho etiquetas ejes",   tipo_input = "number", grupo = "estilo", default = 22),
      list(name = "eje_label_mult",       label = "Separación etiquetas",   tipo_input = "number", grupo = "estilo", default = 1.03),
      list(name = "leyenda_posicion",     label = "Posición leyenda",       tipo_input = "choice", grupo = "estilo",
           default = "abajo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "derecha", label = "Derecha"),
             list(value = "ninguna", label = "Ocultar")
           )),
      list(name = "legend_n_por_fila",    label = "Items por fila leyenda", tipo_input = "number", grupo = "estilo", default = 4),
      list(name = "legend_key_cm",        label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo", default = 0.45),
      list(name = "legend_espaciado",     label = "Espaciado leyenda",      tipo_input = "number", grupo = "estilo", default = 12),
      list(name = "canvas_h_header_in",   label = "Alto header (in)",       tipo_input = "number", grupo = "canvas", default = 0.58),
      list(name = "canvas_h_legend_in",   label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas", default = 0.20),
      list(name = "canvas_h_caption_in",  label = "Alto pie (in)",          tipo_input = "number", grupo = "canvas", default = 0.08)
    )
  ),

  # =========================================================================
  # DIMENSIONES: FODA
  # =========================================================================
  dim_foda = list(
    titulo_humano = "Matriz FODA dimensional",
    descripcion   = "Matriz 2×2 o dispersión estilo FODA sobre indicadores. Hereda de 'Base'.",
    icono_ui      = "Grid3X3",
    args = list(

      # --- Negritas -------------------------------------------------------
      .arg_textos_negrita(c("titulo", "subtitulo", "nota_pie")),

      list(name = "canvas_h_title",       label = "Alto zona título (in)",  tipo_input = "number", grupo = "canvas", default = 0),
      list(name = "canvas_h_legend",      label = "Alto leyenda (in)",      tipo_input = "number", grupo = "canvas", default = 0.09),
      list(name = "canvas_h_caption",     label = "Alto pie (in)",          tipo_input = "number", grupo = "canvas", default = 0.06)
    )
  )
)

# ===========================================================================
# DEFAULTS PULSO — los valores iniciales de cada preset en una sesión nueva
# ===========================================================================
#
# Cuando el analista entra por primera vez a Gráficos (sin config persistida),
# el store se hidrata con estos presets. Vienen extraídos del QMD de
# referencia (prueba_plan_ppt.qmd) y reflejan el estilo institucional Pulso:
# azul #39588B, fuente Arial, base 'Base: %s', Likert con mostrar_valores,
# barras_apiladas con barra_extra, radar_tabla con Top Two Box.
#
# Así el analista NO arranca con un canvas vacío — los gráficos ya se ven
# bien desde el primer export, y él solo ajusta lo que necesite cambiar.

.PRESETS_DEFAULT_PULSO <- list(

  base = list(
    formato           = "Base: %s",
    sufijo_auto       = "respuestas",

    size_titulo       = 12,
    size_subtitulo    = 9,
    size_leyenda      = 10,
    size_ejes         = 10,
    size_nota_pie     = 8,
    size_texto_barras = 4,

    color_titulo      = "#39588B",
    color_subtitulo   = "#39588B",
    color_leyenda     = "#39588B",
    color_ejes        = "#39588B",
    color_nota_pie    = "#39588B",

    textos_negrita    = c("titulo", "leyenda", "barra_extra", "eje_y", "valores"),

    font_family       = "Arial"
  ),

  barras_apiladas = list(
    color_barra_extra        = "#39588B",

    canvas_w_etiquetas       = 0.12,
    canvas_w_buf_etq_bars    = 0.02,
    canvas_w_bars            = 0.60,
    canvas_w_buf_bars_extra  = 0.02,
    canvas_w_extra           = 0.12,

    canvas_h_toprow_in       = 0.10,
    canvas_h_header_in       = 0.15,
    canvas_h_legend_in       = 0.15,
    canvas_h_caption_in      = 0.20,

    alto_por_categoria       = 0.46,

    grosor_modo              = "auto",
    grosor_barras            = 0.6,
    grosor_barras_mult       = 0.9,

    mostrar_valores          = TRUE,
    umbral_etiqueta          = 0.01,
    decimales                = 0,

    mostrar_barra_extra      = TRUE,

    legend_key_cm            = 0.40,
    legend_espaciado         = 15,
    legend_n_por_fila        = 6,

    size_barra_extra         = 10,
    size_titulo_extra        = 10,
    ancho_max_eje_y          = 15,
    prefijo_barra_extra      = "N = ",

    color_texto_barras       = "white",
    size_titulos_grupo       = 10,
    repeler_etiquetas_peq    = TRUE
  ),

  multi_apiladas = list(
    canvas_w_etiquetas       = 0.15,
    canvas_w_bars            = 0.60,
    canvas_w_extra           = 0.10,

    canvas_h_toprow_in       = 0.10,
    canvas_h_header_in       = 0.15,
    canvas_h_legend_in       = 0.15,
    canvas_h_caption_in      = 0.15,

    alto_por_categoria       = 0.42,
    ancho_max_eje_y          = 30,

    mostrar_valores          = TRUE,
    decimales                = 0,

    legend_key_cm            = 0.35,
    legend_espaciado         = 10,
    legend_n_por_fila        = 6,

    color_texto_barras       = "white",
    size_titulos_grupo       = 10
  ),

  barras_agrupadas = list(
    canvas_w_etiquetas       = 0.15,
    canvas_w_buf_etq_bars    = 0.02,
    canvas_w_bars            = 0.58,
    canvas_w_buf_bars_extra  = 0.02,
    canvas_w_extra           = 0.15,

    canvas_h_toprow_in       = 0.10,
    canvas_h_header_in       = 0.70,
    canvas_h_legend_in       = 0.00,
    canvas_h_caption_in      = 0.00,

    alto_por_categoria       = 0.48,
    ancho_max_eje_y          = 30,

    mostrar_valores          = TRUE,
    decimales                = 0,
    umbral_etiqueta          = 0.001,
    umbral_posicion          = 0.07,

    mostrar_barra_extra      = FALSE,
    prefijo_barra_extra      = "N = ",

    mostrar_leyenda          = FALSE,
    invertir_barras          = TRUE,

    size_barra_extra         = 9,
    colores_series           = list(Porcentaje = "#39588B")
  ),

  barras_numericas = list(
    orientacion              = "vertical",

    canvas_h_title           = 0.12,
    canvas_h_legend          = 0.10,
    canvas_h_caption         = 0.00,
    canvas_pad_top           = 0.01,

    mostrar_valores          = TRUE,
    color_texto_barras       = "white",
    size_texto_barras        = 4.4,
    mostrar_eje_y            = FALSE,

    mostrar_n_sobre_barras   = TRUE,
    prefijo_n_sobre_barras   = "N = ",
    size_n_sobre_barras      = 3.6,
    color_n_sobre_barras     = "#0B3A67",
    colores_series           = list(Media = "#0B3A67")
  ),

  pie = list(
    tipo_pie                 = "pie",

    mostrar_etiquetas_pct    = TRUE,
    size_etiquetas_pct       = 5,
    color_etiquetas_pct      = "white",
    etiquetas_negrita        = TRUE,

    leyenda_posicion         = "abajo",
    size_leyenda             = 11,
    tamano_key_cm            = 0.45,
    espaciado_vertical_cm    = 0.30,
    ncol_leyenda_bajo        = 2,
    invertir_leyenda         = TRUE,

    canvas_h_title           = 0.08,
    canvas_h_caption         = 0.00,
    canvas_h_legend_bottom   = 0.08,
    canvas_pad_top           = 0.00,

    pos_titulo               = "centro",
    size_titulo              = 13,

    ordenar_categorias       = "asc"
  ),

  donut = list(
    tipo_pie                 = "donut",
    donut_hole               = 0.60,

    leyenda_posicion         = "derecha",
    size_leyenda             = 11.5,
    tamano_key_cm            = 0.48,
    espaciado_vertical_cm    = 0.50,

    mostrar_etiquetas_pct    = TRUE,
    size_etiquetas_pct       = 5.2,
    color_etiquetas_pct      = "white",
    etiquetas_negrita        = TRUE,

    canvas_h_title           = 0.10,
    canvas_h_caption         = 0.00,
    canvas_pad_top           = 0.00,
    canvas_w_legend_right    = 0.30,

    pos_titulo               = "centro",
    size_titulo              = 13
  ),

  radar_tabla = list(
    escala_valor             = "proporcion_1",
    cortes_grilla            = 6,
    limites                  = c(0, 1),
    rellenar_poligono        = FALSE,
    mostrar_radios           = FALSE,
    mostrar_niveles          = FALSE,
    eje_label_mult           = 1.2,
    radar_scale              = 0.85,
    wrap_ejes                = 20,

    mostrar_leyenda          = TRUE,
    leyenda_posicion         = "abajo",
    legend_n_por_fila        = 3,
    legend_key_cm            = 0.60,
    legend_espaciado         = 20,
    size_leyenda             = 12,
    size_ejes                = 10,
    size_linea               = 1.2,
    textos_negrita           = c("ejes", "leyenda"),

    mostrar_tabla_derecha    = TRUE,
    titulo_tabla             = "TOP TWO BOX",
    umbral_rojo_pct          = 60,
    tabla_digits             = 0,
    tabla_padding_mm         = 10,

    tabla_header_fill        = "#062A63",
    tabla_body_fill          = "#F2F2F2",
    tabla_grid_col           = "white",
    tabla_text_blue          = "#062A63",

    tabla_ph_ancho           = 0.46,
    tabla_ph_gap             = 0.01,
    tabla_ph_margin_top      = 0.001,
    tabla_ph_margin_bot      = 0.001,

    tabla_header_size        = 8,
    tabla_body_size          = 7,
    tabla_firstcol_bold      = TRUE,
    tabla_auto_fit           = FALSE,

    canvas_h_header_in       = 0.45,
    canvas_h_legend_in       = 0.22
  )
)

# ===========================================================================
# OVERRIDES PRE-ESTABLECIDOS (reducido / compacto)
# ===========================================================================
#
# Dos overrides reutilizables que vienen cargados de fábrica cuando el
# analista entra por primera vez. Extraídos del QMD de referencia
# (`ovr_apiladas_compactas`, `ovr_pie_compacto`, etc.).
#
# Convención:
#   - "reducido": para slides con 2 gráficos en paralelo. Los tamaños
#     están algo achicados respecto al default pero todavía son legibles.
#   - "compacto": para slides densos de 4+ gráficos. Canvas apretado y
#     tipografía pequeña; el analista sacrifica detalle por densidad.
#
# Cada override aplica a un `tipo_preset` específico — por eso se
# declaran N overrides (uno por tipo × tamaño) en vez de uno genérico.
# El analista los edita libremente desde OverridesEditor (están en el
# store autosaveado como cualquier otro override).

.OVERRIDES_DEFAULT_PULSO <- list(
  # --- Barras apiladas ---
  list(
    id = "ovr-apiladas-reducido",
    nombre = "Apiladas · reducido (2 en slide)",
    tipo_preset = "barras_apiladas",
    args = list(
      size_titulo = 10,
      size_ejes = 8,
      size_leyenda = 8,
      size_texto_barras = 3.6,
      legend_key_cm = 0.32,
      legend_espaciado = 8,
      canvas_h_toprow_in = 0.08,
      canvas_h_header_in = 0.14,
      canvas_h_legend_in = 0.13,
      canvas_h_caption_in = 0.10
    )
  ),
  list(
    id = "ovr-apiladas-compacto",
    nombre = "Apiladas · compacto (4+ en slide)",
    tipo_preset = "barras_apiladas",
    args = list(
      size_titulo = 9,
      size_ejes = 6.8,
      size_leyenda = 6.8,
      size_texto_barras = 3.1,
      legend_key_cm = 0.28,
      legend_espaciado = 6,
      canvas_h_toprow_in = 0.07,
      canvas_h_header_in = 0.18,
      canvas_h_legend_in = 0.12,
      canvas_h_caption_in = 0.08
    )
  ),
  # --- Barras agrupadas ---
  list(
    id = "ovr-agrupadas-reducido",
    nombre = "Agrupadas · reducido (2 en slide)",
    tipo_preset = "barras_agrupadas",
    args = list(
      size_titulo = 10,
      size_ejes = 8,
      size_leyenda = 8,
      size_texto_barras = 3.6,
      canvas_h_toprow_in = 0.08,
      canvas_h_header_in = 0.64,
      canvas_h_caption_in = 0.04,
      canvas_w_etiquetas = 0.28
    )
  ),
  list(
    id = "ovr-agrupadas-compacto",
    nombre = "Agrupadas · compacto (4+ en slide)",
    tipo_preset = "barras_agrupadas",
    args = list(
      size_titulo = 9,
      size_ejes = 6.8,
      size_leyenda = 6.8,
      size_texto_barras = 3.0,
      canvas_h_toprow_in = 0.08,
      canvas_h_header_in = 0.62,
      canvas_h_caption_in = 0,
      mostrar_barra_extra = FALSE,
      canvas_w_extra = 0,
      canvas_w_buf_bars_extra = 0,
      canvas_w_etiquetas = 0.26
    )
  ),
  # --- Pie ---
  list(
    id = "ovr-pie-reducido",
    nombre = "Pie · reducido (2 en slide)",
    tipo_preset = "pie",
    args = list(
      size_titulo = 10,
      size_leyenda = 8,
      size_etiquetas_pct = 4.6,
      tamano_key_cm = 0.32,
      espaciado_vertical_cm = 0.20,
      ncol_leyenda_bajo = 2,
      canvas_h_title = 0.09,
      canvas_h_legend_bottom = 0.10
    )
  ),
  list(
    id = "ovr-pie-compacto",
    nombre = "Pie · compacto (4+ en slide)",
    tipo_preset = "pie",
    args = list(
      size_titulo = 9,
      size_leyenda = 7,
      size_etiquetas_pct = 4.2,
      tamano_key_cm = 0.28,
      espaciado_vertical_cm = 0.15,
      ncol_leyenda_bajo = 2,
      canvas_h_title = 0.10,
      canvas_h_legend_bottom = 0.12
    )
  ),
  # --- Barras numéricas ---
  list(
    id = "ovr-numericas-compacto",
    nombre = "Numéricas · compacto (4+ en slide)",
    tipo_preset = "barras_numericas",
    args = list(
      size_titulo = 9,
      size_texto_barras = 3.8,
      size_n_sobre_barras = 3,
      mostrar_eje_y = FALSE,
      mostrar_valores = TRUE,
      decimales = 1,
      mostrar_leyenda = FALSE,
      canvas_h_title = 0.12,
      canvas_h_legend = 0
    )
  )
)

# ---- Normalización UI de args de graficadores -----------------------------
#
# La metadata histórica expone muchos nombres cercanos al motor R
# (canvas_w_*, wrap_y, etc.). Antes de enviarla al frontend, compactamos esa
# superficie en grupos y ayudas pensadas para quien está armando el PPT.

.graf_arg_ui_group <- function(arg_name, grupo = NULL) {
  nm <- as.character(arg_name %||% "")
  gp <- as.character(grupo %||% "")

  if (nm %in% c("debug_ph_bordes", "debug_ph_col", "debug_ph_lwd", "debug_lw", "exportar")) {
    return("diagnostico")
  }
  if (grepl("^(canvas_|tabla_ph_|alto_por_categoria$|ancho_max_eje_y$|wrap_y$|wrap_ejes$|eje_label_mult$)", nm)) {
    return("espacio")
  }
  if (grepl("^(tabla_|mostrar_tabla_derecha$|titulo_tabla$|umbral_rojo_pct$)", nm)) {
    return("tabla")
  }
  if (grepl("^(leyenda_|legend_|mostrar_leyenda$|invertir_leyenda$|size_leyenda$|color_leyenda$|tamano_key_cm$|espaciado_vertical_cm$|ncol_leyenda_bajo$)", nm)) {
    return("leyenda")
  }
  if (grepl("^(mostrar_valores$|mostrar_etiquetas_pct$|size_etiquetas_pct$|color_etiquetas_pct$|etiquetas_negrita$|decimales|umbral_|repeler_|desplazamiento_|top[23]box|bottom2box|barra_extra|mostrar_barra_extra|color_texto_barras|size_texto_barras|mostrar_n_sobre_barras|prefijo_n_sobre_barras|size_n_sobre_barras|color_n_sobre_barras|cortes_|modo_semaforo|mostrar_eje_y$)", nm)) {
    return("valores")
  }
  if (grepl("^(titulo$|subtitulo$|nota_pie$|prefijo_|pos_|size_titulo$|size_subtitulo$|size_nota_pie$|color_titulo$|color_subtitulo$|color_nota_pie$|font_family|formato$|sufijo_auto$|textos_negrita$|angle_x$)", nm)) {
    return("lectura")
  }

  switch(
    gp,
    textos = "lectura",
    estilo = "valores",
    filtro = "valores",
    semaforo = "valores",
    canvas = "espacio",
    avanzado = "diagnostico",
    if (nzchar(gp)) gp else "diagnostico"
  )
}

.graf_arg_ui_patch <- function(arg) {
  nm <- as.character(arg$name %||% "")

  patch <- switch(
    nm,
    ancho_max_eje_y = list(
      label = "Ancho de texto de etiquetas",
      descripcion = "Cuántos caracteres se permiten por línea en las etiquetas. Sube este valor si el texto queda demasiado partido.",
      unidad = "caracteres",
      min = 10,
      max = 80,
      step = 1,
      control = "stepper",
      relacionados = c("canvas_w_etiquetas"),
      efecto = "Cambia los saltos de línea de las etiquetas."
    ),
    wrap_y = list(
      label = "Ancho de texto de etiquetas",
      descripcion = "Cuántos caracteres se permiten por línea en las etiquetas. Es el mismo ajuste que usa el eje Y.",
      unidad = "caracteres",
      min = 10,
      max = 80,
      step = 1,
      control = "stepper",
      relacionados = c("canvas_w_etiquetas"),
      efecto = "Cambia los saltos de línea de las etiquetas."
    ),
    canvas_w_etiquetas = list(
      label = "Espacio para etiquetas",
      descripcion = "Reserva más ancho a la izquierda para que las etiquetas respiren. Para que el texto use ese espacio, ajusta también el ancho de texto.",
      unidad = "proporción",
      min = 0,
      max = 0.55,
      step = 0.01,
      control = "slider",
      relacionados = c("ancho_max_eje_y", "wrap_y"),
      efecto = "Mueve el inicio de las barras hacia la derecha o izquierda."
    ),
    canvas_w_bars = list(
      label = "Espacio para barras",
      descripcion = "Ancho relativo reservado al área principal de barras.",
      unidad = "proporción",
      min = 0.2,
      max = 0.9,
      step = 0.01,
      control = "slider"
    ),
    canvas_w_extra = list(
      label = "Espacio para columna derecha",
      descripcion = "Reserva ancho para N, Top Two Box u otra columna de apoyo a la derecha.",
      unidad = "proporción",
      min = 0,
      max = 0.35,
      step = 0.01,
      control = "slider"
    ),
    canvas_w_buf_etq_bars = list(
      label = "Separación etiquetas-barras",
      unidad = "proporción",
      min = 0,
      max = 0.12,
      step = 0.005,
      control = "slider"
    ),
    canvas_w_buf_bars_extra = list(
      label = "Separación barras-columna derecha",
      unidad = "proporción",
      min = 0,
      max = 0.12,
      step = 0.005,
      control = "slider"
    ),
    alto_por_categoria = list(
      label = "Alto por fila",
      descripcion = "Aumenta el alto disponible para cada categoría. Útil cuando hay etiquetas largas o muchas barras.",
      unidad = "pulgadas",
      min = 0.2,
      max = 1.2,
      step = 0.02,
      control = "stepper"
    ),
    leyenda_posicion = list(
      label = "Ubicación de la leyenda",
      descripcion = "Dónde se coloca la leyenda en el gráfico exportado.",
      efecto = "Cambia la posición real de la leyenda en el PPT."
    ),
    legend_n_por_fila = list(
      label = "Elementos por fila",
      descripcion = "Cuántas categorías se muestran por fila en la leyenda.",
      min = 1,
      max = 10,
      step = 1,
      control = "stepper"
    ),
    legend_key_cm = list(
      label = "Tamaño del marcador",
      unidad = "cm",
      min = 0.15,
      max = 1,
      step = 0.05,
      control = "stepper"
    ),
    legend_espaciado = list(
      label = "Separación en leyenda",
      descripcion = "Espacio entre los elementos de la leyenda.",
      min = 0,
      max = 40,
      step = 1,
      control = "stepper"
    ),
    canvas_h_header_in = list(
      label = "Alto del encabezado",
      unidad = "pulgadas",
      min = 0,
      max = 1.5,
      step = 0.02,
      control = "stepper"
    ),
    canvas_h_legend_in = list(
      label = "Alto de leyenda",
      unidad = "pulgadas",
      min = 0,
      max = 1.2,
      step = 0.02,
      control = "stepper"
    ),
    canvas_h_caption_in = list(
      label = "Alto del pie",
      unidad = "pulgadas",
      min = 0,
      max = 1,
      step = 0.02,
      control = "stepper"
    ),
    canvas_h_toprow_in = list(
      label = "Alto de fila superior",
      unidad = "pulgadas",
      min = 0,
      max = 0.8,
      step = 0.02,
      control = "stepper"
    ),
    debug_ph_bordes = list(
      label = "Mostrar bordes",
      descripcion = "Muestra bordes de referencia para revisar cómo se reparte el espacio interno."
    ),
    list()
  )

  if (grepl("^umbral_", nm) && !grepl("_pct$", nm)) {
    patch <- utils::modifyList(list(
      unidad = "%",
      min = 0,
      max = 1,
      step = 0.0001,
      control = "stepper",
      descripcion = "Porcentaje minimo de la barra para mostrar o mover la etiqueta. Puedes escribir 0.05 para 0.05%.",
      efecto = "Define desde que tamano se muestra o cambia de posicion la etiqueta."
    ), patch)
  }

  utils::modifyList(arg, patch)
}

.normalize_args_for_ui <- function(args) {
  if (is.null(args) || !length(args)) return(list())
  arg_names <- vapply(args, function(a) as.character(a$name %||% ""), character(1))
  has_label_width <- "ancho_max_eje_y" %in% arg_names

  out <- list()
  for (arg in args) {
    nm <- as.character(arg$name %||% "")
    if (!nzchar(nm)) next
    # El export lo fuerza el backend; exponerlo en la UI principal confunde.
    if (identical(nm, "exportar")) next
    # Overrides, filtros y base tecnica ya tienen superficies dedicadas
    # (modos, panel de filtros, base automatica); como edición cruda ensucian
    # la UI principal del graficador.
    if (as.character(arg$tipo_input %||% "") %in% c("overrides", "filtros", "base_config", "meta")) next
    # Evita duplicar el mismo concepto cuando existe el nombre canónico.
    if (identical(nm, "wrap_y") && isTRUE(has_label_width)) next

    arg$grupo <- .graf_arg_ui_group(nm, arg$grupo %||% NULL)
    out[[length(out) + 1L]] <- .graf_arg_ui_patch(arg)
  }
  out
}

# Serializa el catálogo de presets para el endpoint /presets-metadata.
.presets_metadata_payload <- function() {
  presets <- lapply(names(.PRESETS_META), function(nm) {
    meta <- .PRESETS_META[[nm]]
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "Sliders"),
      args          = .normalize_args_for_ui(meta$args %||% list())
    )
  })
  list(presets = presets)
}

# ===========================================================================
# TEMPLATES (planes pre-armados)
# ===========================================================================
#
# Catálogo de planes "de arranque" que el analista puede cargar en un
# click. Sirven como punto de partida para reportes típicos: portada +
# índice + un par de bloques narrativos. El analista luego cambia los
# títulos, elige variables en los slots y exporta.
#
# Cada template define `plan.slides` con `id` placeholder (el frontend
# lo regenera al cargar para evitar colisiones). Los slots de graficador
# van vacíos (`null`) — al analista le corresponde elegir qué pregunta
# va en cada uno.

.TEMPLATES_META <- list(

  plan_vacio = list(
    titulo_humano = "Plan mínimo",
    descripcion   = "Portada + índice + un separador de sección + un gráfico. El arranque más sencillo — lo amplías desde ahí.",
    icono_ui      = "FileText",
    n_slides      = 4L,
    plan = list(
      slides = list(
        list(id = "tpl-1", tipo = "p_slide_portada",
             payload = list(titulo = "Informe", subtitulo = "", fecha = "", subtexto = "")),
        list(id = "tpl-2", tipo = "p_slide_indice", payload = list()),
        list(id = "tpl-3", tipo = "p_slide_seccion",
             payload = list(titulo = "Sección 1", subtitulo = "", introduccion_word = "")),
        list(id = "tpl-4", tipo = "p_slide_1_grafico",
             payload = list(titulo = "", grafico = NULL, base = "", pie = "", etiqueta = ""))
      )
    )
  ),

  reporte_ejecutivo = list(
    titulo_humano = "Reporte ejecutivo (10 slides)",
    descripcion   = "Portada + índice + 2 bloques temáticos, cada uno con separador, slide narrativo, un gráfico y una comparativa de dos gráficos. Estructura típica para devolver hallazgos a stakeholders.",
    icono_ui      = "Layers",
    n_slides      = 10L,
    plan = list(
      slides = list(
        list(id = "tpl-1", tipo = "p_slide_portada",
             payload = list(titulo = "Reporte", subtitulo = "", fecha = "", subtexto = "")),
        list(id = "tpl-2", tipo = "p_slide_indice", payload = list()),
        # Bloque 1
        list(id = "tpl-3", tipo = "p_slide_seccion",
             payload = list(titulo = "Bloque 1", subtitulo = "", introduccion_word = "")),
        list(id = "tpl-4", tipo = "p_slide_1_grafico_narrativo",
             payload = list(titulo = "", grafico = NULL, texto = "", base = "", pie = "", etiqueta = "")),
        list(id = "tpl-5", tipo = "p_slide_2_graficos",
             payload = list(titulo = "", izquierda = NULL, derecha = NULL, base = "", pie = "", etiqueta = "")),
        # Bloque 2
        list(id = "tpl-6", tipo = "p_slide_seccion",
             payload = list(titulo = "Bloque 2", subtitulo = "", introduccion_word = "")),
        list(id = "tpl-7", tipo = "p_slide_grafico_texto_derecha",
             payload = list(titulo = "", grafico = NULL, texto = "", base = "", pie = "", etiqueta = "")),
        list(id = "tpl-8", tipo = "p_slide_2_graficos",
             payload = list(titulo = "", izquierda = NULL, derecha = NULL, base = "", pie = "", etiqueta = "")),
        # Conclusión
        list(id = "tpl-9", tipo = "p_slide_4_graficos",
             payload = list(titulo = "Hallazgos", base = "", pie = "", etiqueta = "",
                            superior_izquierda = NULL, superior_derecha = NULL,
                            inferior_izquierda = NULL, inferior_derecha = NULL)),
        list(id = "tpl-10", tipo = "p_slide_texto",
             payload = list(titulo = "Conclusiones", texto = "", bullets = "", base = ""))
      )
    )
  ),

  analisis_poblacional = list(
    titulo_humano = "Análisis poblacional",
    descripcion   = "Portada + bloques demográficos con íconos centrales. Ideal para caracterizar la muestra (género, edad, distrito, nivel educativo).",
    icono_ui      = "UsersRound",
    n_slides      = 5L,
    plan = list(
      slides = list(
        list(id = "tpl-1", tipo = "p_slide_portada",
             payload = list(titulo = "Perfil poblacional", subtitulo = "", fecha = "", subtexto = "")),
        list(id = "tpl-2", tipo = "p_slide_seccion",
             payload = list(titulo = "Quiénes respondieron", subtitulo = "", introduccion_word = "")),
        list(id = "tpl-3", tipo = "p_slide_2_graficos_poblacion",
             payload = list(titulo = "Género y edad", base = "", pie = "", etiqueta = "",
                            izquierda = NULL, derecha = NULL, icono = NULL)),
        list(id = "tpl-4", tipo = "p_slide_4_graficos_poblacion",
             payload = list(titulo = "Dimensiones demográficas", base = "", pie = "", etiqueta = "",
                            superior_izquierda = NULL, superior_derecha = NULL,
                            inferior_izquierda = NULL, inferior_derecha = NULL, icono = NULL)),
        list(id = "tpl-5", tipo = "p_slide_6_graficos_poblacion",
             payload = list(titulo = "Caracterización completa", base = "", pie = "", etiqueta = "",
                            grafico_superior_1 = NULL, grafico_superior_2 = NULL, grafico_superior_3 = NULL,
                            grafico_inferior_1 = NULL, grafico_inferior_2 = NULL, grafico_inferior_3 = NULL,
                            icono = NULL))
      )
    )
  ),

  foda_dimensional = list(
    titulo_humano = "FODA dimensional",
    descripcion   = "Portada + radar + heatmap + matriz FODA. Requiere haber calculado dimensiones en la Fase 4 antes de exportar.",
    icono_ui      = "Grid3X3",
    n_slides      = 4L,
    plan = list(
      slides = list(
        list(id = "tpl-1", tipo = "p_slide_portada",
             payload = list(titulo = "Análisis dimensional", subtitulo = "", fecha = "", subtexto = "")),
        list(id = "tpl-2", tipo = "p_slide_1_grafico_narrativo",
             payload = list(titulo = "Puntajes por dimensión", grafico = NULL, texto = "", base = "", pie = "", etiqueta = "")),
        list(id = "tpl-3", tipo = "p_slide_1_grafico",
             payload = list(titulo = "Mapa de calor", grafico = NULL, base = "", pie = "", etiqueta = "")),
        list(id = "tpl-4", tipo = "p_slide_1_grafico",
             payload = list(titulo = "Matriz FODA", grafico = NULL, base = "", pie = "", etiqueta = ""))
      )
    )
  ),

  acreditacion_multibase = list(
    titulo_humano = "Acreditación — Multi-base (3 roles)",
    descripcion   = "Template para estudios de acreditación con 3 bases paralelas (docentes / estudiantes / administrativos). Incluye portada, perfil demográfico por rol, y un bloque comparativo con p_barras_multiapiladas en modo var_cruce que muestra las 3 fuentes lado a lado. Diseñado para cargarse sobre el demo 'Acreditación PUCP — AMDT'.",
    icono_ui      = "GraduationCap",
    n_slides      = 7L,
    plan = list(
      slides = list(
        list(id = "tpl-1", tipo = "p_slide_portada",
             payload = list(
               titulo = "Estudio de opinión",
               subtitulo = "Acreditación de la carrera — 3 bases",
               fecha = "",
               subtexto = "Cada slide puede mezclar variables de las 3 fuentes con notación 'fuente$variable'."
             )),
        list(id = "tpl-2", tipo = "p_slide_seccion",
             payload = list(titulo = "Perfil del encuestado", subtitulo = "", introduccion_word = "")),
        # Perfil docentes (requiere 4 graficadores)
        list(id = "tpl-3", tipo = "p_slide_4_graficos_poblacion",
             payload = list(
               titulo = "Perfil del docente", base = "", pie = "", etiqueta = "",
               superior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "docentes$sexo", titulo = "Sexo")),
               superior_derecha   = list(graficador = "p_barras_agrupadas", args = list(var = "docentes$p3",   titulo = "Máximo grado")),
               inferior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "docentes$edadg", titulo = "Rango de edad")),
               inferior_derecha   = list(graficador = "p_barras_agrupadas", args = list(var = "docentes$anos_g", titulo = "Años de experiencia")),
               icono = NULL
             )),
        # Perfil estudiantes
        list(id = "tpl-4", tipo = "p_slide_4_graficos_poblacion",
             payload = list(
               titulo = "Perfil del estudiante", base = "", pie = "", etiqueta = "",
               superior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$sexo", titulo = "Sexo")),
               superior_derecha   = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$ingreso_g", titulo = "Año de ingreso")),
               inferior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$edadg", titulo = "Rango de edad")),
               inferior_derecha   = list(graficador = "p_barras_agrupadas", args = list(var = "estudiantes$p5", titulo = "Ciclo de especialidad")),
               icono = NULL
             )),
        # Perfil administrativos
        list(id = "tpl-5", tipo = "p_slide_4_graficos_poblacion",
             payload = list(
               titulo = "Perfil del administrativo", base = "", pie = "", etiqueta = "",
               superior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "administrativos$sexo", titulo = "Sexo")),
               superior_derecha   = list(graficador = "p_barras_agrupadas", args = list(var = "administrativos$edadg", titulo = "Rango de edad")),
               inferior_izquierda = list(graficador = "p_barras_agrupadas", args = list(var = "administrativos$anoingre_g", titulo = "Año de ingreso a la facultad")),
               inferior_derecha   = NULL,
               icono = NULL
             )),
        # Separador
        list(id = "tpl-6", tipo = "p_slide_seccion",
             payload = list(titulo = "Principales resultados", subtitulo = "", introduccion_word = "")),
        # Bloque comparativo con multi-apiladas var_cruce (patrón del QMD surveymonkey)
        list(id = "tpl-7", tipo = "p_slide_1_grafico",
             payload = list(
               titulo = "Misión y propósitos institucionales", base = "", pie = "", etiqueta = "",
               grafico = list(
                 graficador = "p_barras_multiapiladas",
                 args = list(
                   modo = "var_cruce",
                   vars = list(
                     mision     = c("docentes$p6_1", "estudiantes$p6_1", "administrativos$p4_1"),
                     consulta   = c("docentes$p6_2", "estudiantes$p6_2", "administrativos$p4_2"),
                     propositos = c("docentes$p6_3", "estudiantes$p6_3", "administrativos$p4_3")
                   ),
                   titulos_grupo = c(
                     mision     = "Conoce la misión y visión de la PUCP",
                     consulta   = "Sabe dónde consultarla",
                     propositos = "Conoce los propósitos de la Facultad"
                   )
                 )
               )
             ))
      )
    )
  )
)

# Serializa el catálogo de templates para /api/graficos/templates.
.templates_payload <- function() {
  templates <- lapply(names(.TEMPLATES_META), function(nm) {
    meta <- .TEMPLATES_META[[nm]]
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "FileText"),
      n_slides      = as.integer(meta$n_slides %||% 0L),
      plan          = meta$plan
    )
  })
  list(templates = templates)
}

# ===========================================================================
# API helpers
# ===========================================================================

# Devuelve el metadata completo de un slide por nombre (o NULL si no existe).
.slide_meta <- function(name) .SLIDES_META[[name]]

# Devuelve el metadata completo de un graficador por nombre (o NULL).
.graf_meta <- function(name) .GRAFICADORES_META[[name]]

# Devuelve la lista canónica de nombres (para que router_graficos.R la use
# como fuente de verdad sin duplicar strings).
.slide_names <- function() names(.SLIDES_META)
.graf_names  <- function() names(.GRAFICADORES_META)

# Devuelve la lista de slots (nombres de argumentos que aceptan graficadores)
# para un tipo de slide. Usado por el validador y el builder en el worker.
.slide_slots <- function(name) {
  meta <- .SLIDES_META[[name]]
  if (is.null(meta)) return(character(0))
  as.character(meta$slots)
}

# Devuelve la categoría de un slide (para el agrupador del picker UI).
.slide_categoria <- function(name) {
  meta <- .SLIDES_META[[name]]
  if (is.null(meta)) return("otro")
  as.character(meta$categoria %||% "otro")
}

# Serializa el metadata completo a una lista lista para JSON (lo usa el
# endpoint /api/graficos/registry).
.graficos_registry_payload <- function() {
  slides <- lapply(names(.SLIDES_META), function(nm) {
    meta <- .SLIDES_META[[nm]]
    # Recuperar formals reales de la función de prosecnur para documentar
    # args que no estén en la lista curada (todos los args técnicos viven
    # en `args_extra`).
    fn <- tryCatch(getExportedValue("prosecnurapp", nm), error = function(e) NULL)
    formals_names <- if (!is.null(fn)) names(formals(fn)) else character(0)
    curated_names <- vapply(meta$args, function(a) as.character(a$name), character(1))
    args_extra <- setdiff(formals_names, curated_names)
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "FileText"),
      categoria     = as.character(meta$categoria %||% "otro"),
      slots         = as.list(meta$slots %||% character(0)),
      args          = .normalize_args_for_ui(meta$args %||% list()),
      args_extra    = as.list(args_extra)
    )
  })
  graficadores <- lapply(names(.GRAFICADORES_META), function(nm) {
    meta <- .GRAFICADORES_META[[nm]]
    fn <- tryCatch(getExportedValue("prosecnurapp", nm), error = function(e) NULL)
    formals_names <- if (!is.null(fn)) names(formals(fn)) else character(0)
    curated_names <- vapply(meta$args, function(a) as.character(a$name), character(1))
    args_extra <- setdiff(formals_names, curated_names)
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "BarChart"),
      requisito     = as.character(meta$requisito %||% ""),
      args          = .normalize_args_for_ui(meta$args %||% list()),
      args_extra    = as.list(args_extra)
    )
  })
  list(slides = slides, graficadores = graficadores)
}
