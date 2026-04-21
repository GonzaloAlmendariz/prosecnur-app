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
# "icono"            → dropdown del catálogo de iconos subidos en sesión
# "overrides"        → editor especial de overrides (delta vs preset tipo)
# "filtros"          → editor de filtros por variable (avanzado)
# "base_config"      → editor de la base automática/manual (avanzado)
# "meta"             → objeto libre; casi nunca se expone en UI

# ---- Grupos semánticos ----------------------------------------------------
#
# "datos"      → qué variable, qué cruce, qué modo
# "textos"     → titulo, subtitulo, texto, pie, etiqueta, base
# "estilo"     → overrides del preset tipo (colores, tamaños, canvas)
# "calculo"    → filtros, top2box, decimales, métrica
# "semaforo"   → cortes_chip, modo_semaforo, chip_colores
# "avanzado"   → todo lo demás

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
  list(name = "filtros",    label = "Filtros",            tipo_input = "filtros",     grupo = "calculo",
       descripcion = "Restringe los datos que entran al gráfico (ej. solo mujeres, solo Lima)."),
  list(name = "base",       label = "Base del gráfico",   tipo_input = "base_config", grupo = "textos",
       descripcion = "Texto al pie del gráfico. Puede ser automático (cuenta los casos) o manual.")
)

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
    titulo_humano = "Multi-apiladas (batería)",
    descripcion   = "Varias barras apiladas en un solo gráfico. Perfecto para baterías de preguntas con la misma escala de respuesta.",
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
      list(name = "top2box",       label = "Mostrar Top 2",  tipo_input = "bool",          grupo = "calculo",
           descripcion = "Combina las dos mejores categorías (ej. 'Muy de acuerdo' + 'De acuerdo') en una barra extra."),
      list(name = "top2box_labels",label = "Etiquetas Top 2",tipo_input = "codigos_list",  grupo = "calculo",
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
      list(name = "metrica", label = "Métrica",     tipo_input = "choice",       grupo = "calculo",
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
      list(name = "decimales_promedio", label = "Decimales del promedio", tipo_input = "number",   grupo = "calculo"),
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
      list(name = "decimales_promedio", label = "Decimales",         tipo_input = "number",       grupo = "calculo"),
      list(name = "mostrar_ref_label",  label = "Mostrar referencia",tipo_input = "bool",         grupo = "calculo",
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

  p_radar_tabla = list(
    titulo_humano = "Radar + tabla",
    descripcion   = "Gráfico radar (telaraña) con una tabla al costado. Común para Top-Two-Box de múltiples indicadores.",
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
      list(name = "titulo_tabla", label = "Título de la tabla",   tipo_input = "string",         grupo = "textos"),
      list(name = "top_n",        label = "Top N",                tipo_input = "number",         grupo = "calculo",
           descripcion = "Cantidad máxima de categorías a mostrar. Si vacío, se muestran todas."),
      list(name = "sm_omit_codes",label = "Códigos a omitir",     tipo_input = "codigos_list",   grupo = "calculo",
           descripcion = "Códigos de respuesta que no queremos en el radar (ej. 88=No sabe, 90=No aplica)."),
      list(name = "sm_omit_na",   label = "Omitir NA",            tipo_input = "bool",           grupo = "calculo",
           descripcion = "Excluir casos con respuesta vacía.")
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
      list(name = "incluir_total", label = "Incluir serie total", tipo_input = "bool", grupo = "calculo",
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
      list(name = "incluir_total", label = "Incluir total",tipo_input = "bool",         grupo = "calculo")
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
      list(name = "incluir_total", label = "Incluir totales", tipo_input = "bool", grupo = "calculo"),
      list(name = "brecha_filas",   label = "Brecha por filas",   tipo_input = "bool", grupo = "calculo",
           descripcion = "Añade columna 'Brecha' con max-min por fila."),
      list(name = "brecha_cols",    label = "Brecha por columnas",tipo_input = "bool", grupo = "calculo"),
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
      list(name = "incluir_total",  label = "Incluir total",   tipo_input = "bool",         grupo = "calculo"),
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
      list(name = "incluir_total", label = "Incluir total",   tipo_input = "bool",         grupo = "calculo"),
      list(name = "usar_pesos",    label = "Aplicar pesos",   tipo_input = "bool",         grupo = "calculo",
           descripcion = "Si los subíndices tienen pesos declarados, los aplica al ranking FODA.")
    ), .args_graf_comunes())
  ),

  p_dim_heatmap_criterios = list(
    titulo_humano = "Heatmap por criterios",
    descripcion   = "Heatmap agrupado por criterios temáticos definidos en la config de dimensiones.",
    icono_ui      = "LayoutGrid",
    requisito     = "dimensiones",
    args = c(list(
      list(name = "config_criterios", label = "Criterios", tipo_input = "textarea", grupo = "datos",
           descripcion = "JSON o lista con la definición de criterios a usar. Avanzado.")
    ), .args_graf_comunes())
  )
)

# ===========================================================================
# PRESETS (estilo global por tipo de graficador)
# ===========================================================================
#
# `prosecnur::p_presets` acepta 13 bloques de tipo: `base` (se hereda a todos
# los graficadores) + un bloque por cada tipo de gráfico (barras_apiladas,
# multi_apiladas, barras_agrupadas, barras_numericas, boxplot, media_rango,
# pie, donut, radar_tabla, dim_heatmap, dim_heatmap_criterios, dim_radar,
# dim_foda). Cada bloque es `list(args = list(...))`; los `args` se pasan
# a la función del graficador correspondiente.
#
# Este catálogo cura los args MÁS útiles para estilo global: tipografía,
# tamaños, canvas heights, leyendas. Args técnicos muy específicos de un
# gráfico puntual quedan fuera (se editan vía override por slot o, como
# último recurso, JSON avanzado). El objetivo es que el analista tenga un
# control real de estilo global en <10 campos por tipo, no 40.
#
# `grupo_hereda` indica si el arg viene también por herencia desde `base`
# (solo documentativo — sirve para que el editor muestre "también se puede
# setear en base").

.PRESETS_META <- list(

  # ---- BASE (se hereda a todos) ------------------------------------------
  base = list(
    titulo_humano = "Base — estilo común",
    descripcion   = "Valores por defecto que heredan todos los gráficos. Fuente, tamaños, colores base y el formato del texto 'Base: N'. Lo que pongas acá aplica a todo el reporte salvo que un preset tipo lo sobrescriba.",
    icono_ui      = "Layers",
    args = list(
      list(name = "font_family",       label = "Fuente",            tipo_input = "string", grupo = "textos",
           default = "Arial",
           descripcion = "Familia tipográfica usada por todos los gráficos (ej. 'Arial', 'Helvetica', 'Open Sans')."),
      list(name = "font_family_ppt",   label = "Fuente (solo PPT)", tipo_input = "string", grupo = "textos",
           descripcion = "Sobrescribe 'Fuente' solo cuando se exporta a PPT. Vacío = usa la general."),
      list(name = "color_texto",       label = "Color de texto",    tipo_input = "string", grupo = "estilo",
           descripcion = "Color hex para textos dentro del gráfico (títulos, ejes, etiquetas). Ej. '#222222'."),
      list(name = "size_titulo",       label = "Tamaño título",     tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño de fuente del título del gráfico (pt)."),
      list(name = "size_ejes",         label = "Tamaño ejes",       tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño de fuente de las etiquetas de los ejes (pt)."),
      list(name = "size_etiquetas",    label = "Tamaño etiquetas",  tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño de los valores numéricos sobre las barras/puntos."),
      list(name = "size_base",         label = "Tamaño nota base",  tipo_input = "number", grupo = "estilo",
           descripcion = "Tamaño del texto 'Base: N' al pie del gráfico (pt)."),
      list(name = "formato",           label = "Formato de la base",tipo_input = "string", grupo = "textos",
           default = "Base: %s",
           descripcion = "Plantilla del texto base auto. %s se reemplaza por el conteo (ej. 'Base: %s' → 'Base: 120')."),
      list(name = "sufijo_auto",       label = "Sufijo base auto",  tipo_input = "string", grupo = "textos",
           descripcion = "Texto extra que se añade después del conteo (ej. 'encuestados', 'respuestas')."),
      list(name = "debug_ph_bordes",   label = "Mostrar bordes debug", tipo_input = "bool", grupo = "avanzado",
           descripcion = "Dibuja bordes alrededor de cada placeholder. Útil para diagnosticar layouts (toggle en el header del editor)."),
      list(name = "debug_ph_col",      label = "Color bordes debug",tipo_input = "string", grupo = "avanzado",
           default = "#FF00FF"),
      list(name = "debug_ph_lwd",      label = "Grosor bordes debug", tipo_input = "number", grupo = "avanzado",
           default = 0.6)
    )
  ),

  # ---- Barras apiladas (escalas Likert) -----------------------------------
  barras_apiladas = list(
    titulo_humano = "Barras apiladas",
    descripcion   = "Estilo global de las barras apiladas (escalas Likert). Hereda todo de 'Base' y se puede sobrescribir acá.",
    icono_ui      = "BarChartBig",
    args = list(
      list(name = "angle_x",           label = "Rotación etiquetas X", tipo_input = "number", grupo = "estilo",
           descripcion = "Grados de rotación de las etiquetas del eje X (0 = horizontal, 45 = diagonal, 90 = vertical)."),
      list(name = "wrap_y",            label = "Ancho etiquetas Y",    tipo_input = "number", grupo = "estilo",
           descripcion = "Máximo de caracteres por línea antes de romper la etiqueta del eje Y."),
      list(name = "leyenda_posicion",  label = "Posición de leyenda",  tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",    label = "Abajo"),
             list(value = "arriba",   label = "Arriba"),
             list(value = "derecha",  label = "Derecha"),
             list(value = "izquierda",label = "Izquierda"),
             list(value = "ninguna",  label = "Ocultar")
           )),
      list(name = "mostrar_valores",   label = "Mostrar porcentajes", tipo_input = "bool",   grupo = "estilo",
           descripcion = "Si es TRUE, escribe el % dentro de cada segmento de la barra."),
      list(name = "exportar",          label = "Modo de export",      tipo_input = "choice", grupo = "avanzado",
           choices = list(
             list(value = "rplot",  label = "R plot (default)"),
             list(value = "image",  label = "Imagen PNG")
           ))
    )
  ),

  # ---- Multi-apiladas ------------------------------------------------------
  multi_apiladas = list(
    titulo_humano = "Multi-apiladas (batería)",
    descripcion   = "Varias barras apiladas juntas. Hereda de 'Base'.",
    icono_ui      = "Rows3",
    args = list(
      list(name = "angle_x",           label = "Rotación etiquetas X", tipo_input = "number", grupo = "estilo"),
      list(name = "wrap_y",            label = "Ancho etiquetas Y",    tipo_input = "number", grupo = "estilo"),
      list(name = "espacio_entre_barras", label = "Separación entre barras", tipo_input = "number", grupo = "estilo",
           descripcion = "Fracción del ancho entre barras (0 = pegadas, 0.3 = separación generosa)."),
      list(name = "leyenda_posicion",  label = "Posición de leyenda",  tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",  label = "Abajo"),
             list(value = "arriba", label = "Arriba"),
             list(value = "derecha",label = "Derecha"),
             list(value = "ninguna",label = "Ocultar")
           ))
    )
  ),

  # ---- Barras agrupadas ----------------------------------------------------
  barras_agrupadas = list(
    titulo_humano = "Barras agrupadas",
    descripcion   = "Barras comparativas entre grupos. Hereda de 'Base'.",
    icono_ui      = "BarChartHorizontal",
    args = list(
      list(name = "angle_x",           label = "Rotación etiquetas X", tipo_input = "number", grupo = "estilo"),
      list(name = "mostrar_valores",   label = "Mostrar valores",      tipo_input = "bool",   grupo = "estilo"),
      list(name = "decimales",         label = "Decimales en etiquetas", tipo_input = "number", grupo = "calculo",
           descripcion = "Cuántos decimales mostrar en las etiquetas de valor (0 = enteros).")
    )
  ),

  # ---- Barras numéricas ----------------------------------------------------
  barras_numericas = list(
    titulo_humano = "Barras numéricas",
    descripcion   = "Barras de valores numéricos (medias, sumas). Hereda de 'Base'.",
    icono_ui      = "BarChart",
    args = list(
      list(name = "decimales",         label = "Decimales",         tipo_input = "number", grupo = "calculo"),
      list(name = "mostrar_valores",   label = "Mostrar valores",   tipo_input = "bool",   grupo = "estilo"),
      list(name = "color_barra",       label = "Color principal",   tipo_input = "string", grupo = "estilo",
           descripcion = "Hex del color base si no hay paleta. Ej. '#0A7FB8'.")
    )
  ),

  # ---- Boxplot / Media-rango ----------------------------------------------
  boxplot = list(
    titulo_humano = "Box plot",
    descripcion   = "Cajas con cuartiles. Hereda de 'Base'. Aplica también a 'Media y rango' por herencia.",
    icono_ui      = "BoxSelect",
    args = list(
      list(name = "mostrar_outliers",  label = "Mostrar outliers", tipo_input = "bool",   grupo = "estilo",
           descripcion = "Dibujar los puntos que caen fuera de los bigotes."),
      list(name = "mostrar_media",     label = "Mostrar media",    tipo_input = "bool",   grupo = "estilo",
           descripcion = "Marca adicional con el promedio (además de la mediana)."),
      list(name = "decimales_promedio",label = "Decimales promedio",tipo_input = "number",grupo = "calculo")
    )
  ),

  media_rango = list(
    titulo_humano = "Media y rango",
    descripcion   = "Puntos con promedio y barras de rango. Hereda de 'Boxplot' y 'Base'.",
    icono_ui      = "Activity",
    args = list(
      list(name = "decimales_promedio", label = "Decimales",       tipo_input = "number", grupo = "calculo"),
      list(name = "mostrar_ref_label",  label = "Línea de referencia", tipo_input = "bool", grupo = "estilo")
    )
  ),

  # ---- Pie / Donut ---------------------------------------------------------
  pie = list(
    titulo_humano = "Pie",
    descripcion   = "Gráfico de torta. Donut hereda de Pie.",
    icono_ui      = "PieChart",
    args = list(
      list(name = "mostrar_valores",   label = "Mostrar porcentajes", tipo_input = "bool",   grupo = "estilo"),
      list(name = "decimales",         label = "Decimales",           tipo_input = "number", grupo = "calculo"),
      list(name = "leyenda_posicion",  label = "Posición leyenda",    tipo_input = "choice", grupo = "estilo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "derecha", label = "Derecha"),
             list(value = "ninguna", label = "Ocultar")
           ))
    )
  ),

  donut = list(
    titulo_humano = "Donut",
    descripcion   = "Variante compacta del pie. Hereda de 'Pie'.",
    icono_ui      = "CircleDot",
    args = list(
      list(name = "hole_size",         label = "Tamaño del hueco",  tipo_input = "number", grupo = "estilo",
           descripcion = "Fracción del radio ocupada por el hueco central (0 = pie, 0.6 = donut estrecho)."),
      list(name = "mostrar_valores",   label = "Mostrar porcentajes", tipo_input = "bool", grupo = "estilo")
    )
  ),

  # ---- Radar tabla ---------------------------------------------------------
  radar_tabla = list(
    titulo_humano = "Radar + tabla",
    descripcion   = "Radar con tabla al costado. Hereda de 'Base'.",
    icono_ui      = "Radar",
    args = list(
      list(name = "cortes_grilla",     label = "Cortes de la grilla", tipo_input = "number", grupo = "estilo",
           descripcion = "Número de círculos concéntricos dentro del radar."),
      list(name = "wrap_ejes",         label = "Ancho etiquetas ejes", tipo_input = "number", grupo = "estilo"),
      list(name = "size_tabla",        label = "Tamaño texto tabla",  tipo_input = "number", grupo = "estilo")
    )
  ),

  # ---- Dimensiones: Heatmap -----------------------------------------------
  dim_heatmap = list(
    titulo_humano = "Heatmap dimensional",
    descripcion   = "Mapa de calor de dimensiones. Hereda de 'Base'.",
    icono_ui      = "LayoutGrid",
    args = list(
      list(name = "angle_x",           label = "Rotación etiquetas X",   tipo_input = "number", grupo = "estilo", default = 0),
      list(name = "size_ejes",         label = "Tamaño ejes",            tipo_input = "number", grupo = "estilo", default = 10),
      list(name = "size_texto_celdas", label = "Tamaño texto celdas",    tipo_input = "number", grupo = "estilo", default = 10),
      list(name = "canvas_h_title",    label = "Alto zona título (in)",  tipo_input = "number", grupo = "avanzado", default = 0.13,
           descripcion = "Altura reservada para el título del heatmap en el canvas (pulgadas)."),
      list(name = "canvas_h_legend",   label = "Alto zona leyenda (in)", tipo_input = "number", grupo = "avanzado", default = 0.09),
      list(name = "canvas_h_caption",  label = "Alto zona pie (in)",     tipo_input = "number", grupo = "avanzado", default = 0.06)
    )
  ),

  dim_heatmap_criterios = list(
    titulo_humano = "Heatmap por criterios",
    descripcion   = "Heatmap dimensional agrupado por criterios. Hereda de 'Heatmap dimensional' y 'Base'.",
    icono_ui      = "LayoutGrid",
    args = list(
      list(name = "font_family",       label = "Fuente",                 tipo_input = "string", grupo = "textos",
           descripcion = "Si se deja vacío, usa la fuente de 'Base'.")
    )
  ),

  # ---- Dimensiones: Radar --------------------------------------------------
  dim_radar = list(
    titulo_humano = "Radar dimensional",
    descripcion   = "Radar de dimensiones. Hereda de 'Base'.",
    icono_ui      = "Radar",
    args = list(
      list(name = "cortes_grilla",     label = "Cortes de la grilla",    tipo_input = "number", grupo = "estilo", default = 4),
      list(name = "wrap_ejes",         label = "Ancho etiquetas ejes",   tipo_input = "number", grupo = "estilo", default = 22),
      list(name = "eje_label_mult",    label = "Separación etiquetas",   tipo_input = "number", grupo = "estilo", default = 1.03,
           descripcion = "Multiplicador que aleja las etiquetas del centro (1 = pegadas, 1.1 = más separadas)."),
      list(name = "leyenda_posicion",  label = "Posición leyenda",       tipo_input = "choice", grupo = "estilo", default = "abajo",
           choices = list(
             list(value = "abajo",   label = "Abajo"),
             list(value = "derecha", label = "Derecha"),
             list(value = "ninguna", label = "Ocultar")
           )),
      list(name = "legend_n_por_fila", label = "Items por fila leyenda", tipo_input = "number", grupo = "estilo", default = 4),
      list(name = "legend_key_cm",     label = "Tamaño icono leyenda (cm)", tipo_input = "number", grupo = "estilo", default = 0.45),
      list(name = "legend_espaciado",  label = "Espaciado leyenda",      tipo_input = "number", grupo = "estilo", default = 12),
      list(name = "canvas_h_header_in",label = "Alto header (in)",       tipo_input = "number", grupo = "avanzado", default = 0.58),
      list(name = "canvas_h_legend_in",label = "Alto leyenda (in)",      tipo_input = "number", grupo = "avanzado", default = 0.20),
      list(name = "canvas_h_caption_in",label = "Alto pie (in)",         tipo_input = "number", grupo = "avanzado", default = 0.08)
    )
  ),

  # ---- Dimensiones: FODA --------------------------------------------------
  dim_foda = list(
    titulo_humano = "Matriz FODA dimensional",
    descripcion   = "Matriz 2×2 estilo FODA. Hereda de 'Base'.",
    icono_ui      = "Grid3X3",
    args = list(
      list(name = "canvas_h_title",    label = "Alto zona título (in)",  tipo_input = "number", grupo = "avanzado", default = 0),
      list(name = "canvas_h_legend",   label = "Alto zona leyenda (in)", tipo_input = "number", grupo = "avanzado", default = 0.09),
      list(name = "canvas_h_caption",  label = "Alto zona pie (in)",     tipo_input = "number", grupo = "avanzado", default = 0.06)
    )
  )
)

# Serializa el catálogo de presets para el endpoint /presets-metadata.
.presets_metadata_payload <- function() {
  presets <- lapply(names(.PRESETS_META), function(nm) {
    meta <- .PRESETS_META[[nm]]
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "Sliders"),
      args          = meta$args %||% list()
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
    fn <- tryCatch(getExportedValue("prosecnur", nm), error = function(e) NULL)
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
      args          = meta$args %||% list(),
      args_extra    = as.list(args_extra)
    )
  })
  graficadores <- lapply(names(.GRAFICADORES_META), function(nm) {
    meta <- .GRAFICADORES_META[[nm]]
    fn <- tryCatch(getExportedValue("prosecnur", nm), error = function(e) NULL)
    formals_names <- if (!is.null(fn)) names(formals(fn)) else character(0)
    curated_names <- vapply(meta$args, function(a) as.character(a$name), character(1))
    args_extra <- setdiff(formals_names, curated_names)
    list(
      name          = nm,
      titulo_humano = as.character(meta$titulo_humano %||% nm),
      descripcion   = as.character(meta$descripcion %||% ""),
      icono_ui      = as.character(meta$icono_ui %||% "BarChart"),
      requisito     = as.character(meta$requisito %||% ""),
      args          = meta$args %||% list(),
      args_extra    = as.list(args_extra)
    )
  })
  list(slides = slides, graficadores = graficadores)
}
