# Radar comparativo entre públicos (ADR 0064)
# ===========================================
#
# PROBLEMA. Los radares del motor cruzan por una variable DENTRO de una base:
# sus series son las categorías de esa variable. Aquí las series son los
# públicos, que son fuentes distintas, y ninguna combinación de argumentos
# existente lo expresa.
#
# DISEÑO. Un eje por tema, una serie por público, y un valor por celda: el
# porcentaje de respuestas que caen en los códigos declarados como indicador.
#
# El indicador se DECLARA y no se deduce. Cuál es el corte —«Sí», o la suma de
# «De acuerdo» y «Totalmente de acuerdo»— es una decisión metodológica del
# estudio; una regla como «los dos últimos» sería falsa justo en la escala del
# estudio medido, donde el quinto valor es «SIN INF».
#
# Este archivo es el motor puro del cálculo. No conoce la sesión ni el HTTP y no
# dibuja: devuelve el data frame tidy `(eje, grupo, valor, n)` que el graficador
# de radar ya sabe consumir (`var_eje`, `var_grupo`, `var_valor`).
#
# Vive aparte de `reporte_plan_ppt.R` a propósito: ese archivo esta en
# `policy.frozen_growth_files` y la regla de la casa es que la funcionalidad
# nueva estrena archivo y el grande la llama.

# Porcentaje de una variable que cae en un conjunto de códigos.
#
# El denominador son las respuestas VÁLIDAS de esa variable en esa base —no el
# total de filas—: un público con más no-respuesta saldría artificialmente bajo
# y la comparación entre públicos, que es para lo que existe el radar, dejaría
# de ser justa.
.radar_mb_pct <- function(valores, codigos) {
  v <- as.character(valores)
  v <- v[!is.na(v) & nzchar(trimws(v))]
  n <- length(v)
  if (!n) return(list(valor = NA_real_, n = 0L))
  dentro <- sum(trimws(v) %in% as.character(codigos))
  list(valor = 100 * dentro / n, n = n)
}

# Decimales del porcentaje. Se acota aqui y no en cada consumidor para que el
# vertice y la tabla no puedan discrepar: una celda que dice 98 con el numero
# guardado en 98.04 es una cifra que no cuadra con el resto del informe.
#
# El defecto es 0. En un informe de encuesta el porcentaje entero es la norma, y
# el decimal sugiere una precision que la muestra no tiene: con n = 51, un punto
# vale dos casos.
.radar_mb_decimales <- function(x) {
  d <- suppressWarnings(as.integer(x %||% 0L)[1])
  if (!is.finite(d)) d <- 0L
  max(0L, min(3L, d))
}

# Piso declarado del eje, en puntos porcentuales. El recorte contra los datos
# vive en `.radar_mb_piso()`, que si los tiene a la vista.
.radar_mb_eje_min <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% 0)[1])
  if (!is.finite(v) || v <= 0) return(0)
  min(v, 99)
}

# Códigos del indicador a partir de la forma declarada («3,4»).
.radar_mb_codigos <- function(corte) {
  x <- trimws(unlist(strsplit(as.character(corte %||% ""), "[,;|]")))
  x[nzchar(x)]
}

#' Datos del radar comparativo.
#'
#' @param ejes Lista NOMBRADA `titulo del eje -> character()` de referencias
#'   `base$variable`. Es la misma forma que `vars` en `modo = "var_cruce"`, para
#'   que el emparejado entre públicos se declare una sola vez.
#' @param corte Códigos que suman el indicador, como los declara la
#'   equivalencia: `"3,4"`.
#' @param sources `list(data_sources, inst_sources)` ya resueltas.
#'
#' @return `data.frame(eje, grupo, valor, n)` con una fila por (tema, público).
#'   `valor` en porcentaje 0–100. Los ejes salen en el orden declarado y los
#'   grupos en el orden en que aparecen: un radar cuyo poligono cambia de forma
#'   al reordenar las series seria ilegible entre laminas.
.radar_mb_datos <- function(ejes, corte, sources) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos)) {
    stop_api(400, "E_RADAR_SIN_CORTE",
             "El radar necesita un indicador: al menos un código de la escala.")
  }
  if (!length(ejes)) {
    stop_api(400, "E_RADAR_SIN_EJES", "El radar necesita al menos un eje.")
  }

  filas <- list()
  for (titulo in names(ejes)) {
    refs <- as.character(unlist(ejes[[titulo]]))
    for (ref in refs) {
      ctx <- .graficos_consolidado_ref_context(ref, sources)
      if (!isTRUE(ctx$exists)) next
      datos <- (sources$data_sources %||% list())[[ctx$source]]
      col <- ctx$resolved_variable
      if (!is.data.frame(datos) || !col %in% names(datos)) next
      medida <- .radar_mb_pct(datos[[col]], codigos)
      filas[[length(filas) + 1L]] <- data.frame(
        eje = titulo, grupo = ctx$source,
        valor = medida$valor, n = medida$n,
        stringsAsFactors = FALSE
      )
    }
  }

  if (!length(filas)) {
    stop_api(400, "E_RADAR_SIN_DATOS",
             "Ninguna variable del radar existe en la base que la declara.")
  }

  out <- do.call(rbind, filas)
  out$eje <- factor(out$eje, levels = names(ejes))
  out$grupo <- factor(out$grupo, levels = unique(out$grupo))
  rownames(out) <- NULL
  out
}

# ¿La matriz de datos esta completa? Un radar con huecos deforma el poligono sin
# decir por que: la serie a la que le falta un vertice se cierra por otro lado y
# se lee como si ese tema puntuara cero.
#
# Se reporta en vez de rellenar con cero, que seria inventar un dato.
.radar_mb_huecos <- function(datos) {
  ejes <- levels(datos$eje)
  grupos <- levels(datos$grupo)
  faltan <- list()
  for (g in grupos) {
    presentes <- as.character(datos$eje[datos$grupo == g & !is.na(datos$valor)])
    ausentes <- setdiff(ejes, presentes)
    if (length(ausentes)) {
      faltan[[length(faltan) + 1L]] <- list(grupo = g, ejes = as.list(ausentes))
    }
  }
  faltan
}

# Etiqueta del indicador a partir de sus codigos y de la escala. Se deriva en vez
# de pedirse: las opciones elegidas ya dicen como se llama.
.radar_mb_etiqueta_corte <- function(corte, opciones) {
  codigos <- .radar_mb_codigos(corte)
  if (!length(codigos) || !length(opciones)) return("")
  etiquetas <- vapply(opciones, function(o) {
    if (as.character(o$codigo) %in% codigos) as.character(o$etiqueta) else NA_character_
  }, character(1))
  etiquetas <- etiquetas[!is.na(etiquetas)]
  if (!length(etiquetas)) return("")
  paste(etiquetas, collapse = " + ")
}

# -----------------------------------------------------------------------------
# Estilos
# -----------------------------------------------------------------------------
#
# Las multiapiladas tienen perfiles de estilo y el radar no tenia ninguno: salia
# siempre igual. Aqui viven los suyos, como conjuntos de argumentos con nombre
# que se mezclan sobre el defecto — no como variantes de codigo, para que anadir
# uno sea una entrada en esta lista y nada mas.
#
# El primero es el que sincroniza con la matriz de equivalencias: una linea por
# publico y sin relleno, para que dos series no se tapen.
#
# NINGUN estilo etiqueta los vertices. Con tres publicos y seis temas serian 18
# numeros dentro de una banda de ocho puntos —el perfil de egreso mide entre 90 %
# y 98 %— y se montarian unos sobre otros. El ancla numerica es la TABLA, que da
# la cifra exacta sin pelearse con la figura.
.RADAR_MB_ESTILOS <- list(
  comparativo = list(
    etiqueta = "Comparativo entre públicos",
    descripcion = "Una línea por público, con su valor en cada vértice. El estilo que sincroniza con la matriz de equivalencias.",
    args = list(
      rellenar_poligono = FALSE,
      mostrar_puntos = TRUE,
      mostrar_valores = FALSE,
      mostrar_tela = TRUE,
      mostrar_radios = FALSE,
      mostrar_niveles = TRUE,
      leyenda_posicion = "abajo",
      size_linea = 1.1,
      size_punto = 2.4
    )
  ),
  silueta = list(
    etiqueta = "Silueta",
    descripcion = "Polígonos rellenos y sin números. Para leer la forma del perfil, no sus valores.",
    args = list(
      rellenar_poligono = TRUE,
      alpha_relleno = 0.16,
      mostrar_puntos = FALSE,
      mostrar_valores = FALSE,
      mostrar_tela = TRUE,
      mostrar_niveles = FALSE,
      leyenda_posicion = "abajo",
      size_linea = 0.9
    )
  ),
  auditoria = list(
    etiqueta = "Auditoría",
    descripcion = "Grilla y radios visibles, niveles etiquetados y leyenda al costado. Para revisar la lectura del eje, no para presentar.",
    args = list(
      rellenar_poligono = FALSE,
      mostrar_puntos = TRUE,
      mostrar_valores = FALSE,
      mostrar_tela = TRUE,
      mostrar_radios = TRUE,
      mostrar_niveles = TRUE,
      # Cinco anillos y no diez: con diez, las etiquetas de nivel se escriben una
      # sobre otra sobre el mismo rayo —«0%11%22%33%…»— y la grilla deja de
      # informar.
      cortes_grilla = 5L,
      leyenda_posicion = "derecha",
      size_linea = 0.8
    )
  ),
  limpio = list(
    etiqueta = "Limpio",
    descripcion = "Sólo las líneas y las etiquetas de los ejes. Para una lámina que ya explica sus cifras en la tabla.",
    args = list(
      rellenar_poligono = FALSE,
      mostrar_puntos = TRUE,
      mostrar_valores = FALSE,
      mostrar_tela = FALSE,
      mostrar_radios = FALSE,
      mostrar_niveles = FALSE,
      leyenda_posicion = "abajo",
      size_linea = 1
    )
  )
)

# Margenes comunes a todos los estilos.
#
# `radar_scale` por debajo de 1 y `wrap_ejes` corto no son gusto: con seis ejes
# de nombre largo —«Costos y presupuestos»— y los valores dibujados FUERA del
# anillo, el radar a escala 1 recortaba las etiquetas de los lados y los propios
# porcentajes. Medido en la diapositiva 29 del estudio.
.RADAR_MB_MARGENES <- list(
  radar_scale = 1,
  wrap_ejes = 12L,
  eje_label_mult = 1.06,
  # Holgura para que los nombres largos entren enteros. Encoger el radar no
  # bastaba: las etiquetas se anclan al anillo, no al poligono, asi que seguian
  # cayendo fuera del panel y se cortaban a media palabra.
  margen_etiquetas = 1.42
)

# Catalogo de estilos en la forma que consume el registro de graficadores. Se
# deriva de `.RADAR_MB_ESTILOS` en vez de copiarse en `graficos_metadata.R`: un
# estilo nuevo aparece en la UI solo, y uno retirado deja de ofrecerse sin dejar
# una opcion muerta en el selector.
.radar_mb_choices_ui <- function() {
  unname(lapply(names(.RADAR_MB_ESTILOS), function(clave) {
    est <- .RADAR_MB_ESTILOS[[clave]]
    list(value = clave,
         label = as.character(est$etiqueta %||% clave),
         hint  = as.character(est$descripcion %||% ""))
  }))
}

.radar_mb_estilo_args <- function(estilo = NULL) {
  clave <- tolower(trimws(as.character(estilo %||% "")[1]))
  if (!nzchar(clave) || is.null(.RADAR_MB_ESTILOS[[clave]])) clave <- "comparativo"
  utils::modifyList(.RADAR_MB_MARGENES, .RADAR_MB_ESTILOS[[clave]]$args)
}

# Piso del eje radial, en puntos porcentuales.
#
# El defecto es 0 y no el rango de los datos: con seis temas entre 90 % y 98 %,
# un eje autoajustado convierte ocho puntos de diferencia en la mitad del radio
# y exagera lo que el analista tendria que leer como «todos altos y parecidos».
# Pero cuando ESE es justamente el punto —ver la diferencia dentro de una banda
# estrecha— el piso se sube a proposito, y por eso se declara.
#
# Nunca por encima del valor mas bajo: el graficador recorta al centro lo que
# cae debajo del piso, y un 42 % dibujado en el centro se lee como cero. Si el
# piso pedido deja fuera un dato, se baja y se dice cual lo forzo.
.radar_mb_piso <- function(datos, eje_min) {
  piso <- suppressWarnings(as.numeric(eje_min %||% 0)[1])
  if (!is.finite(piso) || piso <= 0) return(0)
  piso <- min(piso, 99)
  v <- datos$valor[is.finite(datos$valor)]
  if (!length(v)) return(piso)
  minimo <- min(v)
  if (piso <= minimo) return(piso)
  culpable <- datos[is.finite(datos$valor) & datos$valor == minimo, , drop = FALSE][1, ]
  message(sprintf(
    "radar_publicos: el piso del eje baja de %s a %s — «%s» en %s vale %.1f%% y quedaria recortado al centro.",
    format(piso), format(minimo), as.character(culpable$eje), as.character(culpable$grupo), minimo))
  minimo
}

#' Dibuja el radar comparativo.
.radar_mb_grafico <- function(datos, estilo = NULL, overrides = list(), titulo = NULL,
                              mostrar_valores = NULL, decimales = NULL, eje_min = NULL) {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop_api(500, "E_RADAR_SIN_GGPLOT2", "El paquete R 'ggplot2' no está instalado.")
  }
  args <- utils::modifyList(
    list(
      data = datos,
      var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
      escala_valor = "proporcion_100",
      limites = c(0, 100),
      titulo = titulo
    ),
    .radar_mb_estilo_args(estilo)
  )
  # Lo que el analista declara pisa al estilo: el estilo es un punto de partida,
  # no un candado.
  if (!is.null(mostrar_valores)) {
    args$mostrar_valores <- isTRUE(mostrar_valores)
    # El umbral del graficador (3 %) existe para radares con muchos ejes de
    # valores chicos. Un indicador entre publicos no tiene ese problema y sus
    # ceros legitimos —un tema en el que nadie esta de acuerdo— merecen su
    # etiqueta, asi que aqui se apaga.
    args$valores_umbral_pct <- 0
    # Hacia el centro: un indicador entre publicos vive en la banda alta, donde
    # el anillo exterior ya lo ocupa el nombre del tema. Escribir «98.0%» hacia
    # afuera lo tapaba.
    args$valores_hacia_dentro <- TRUE
  }
  if (!is.null(decimales)) {
    dec <- suppressWarnings(as.integer(decimales)[1])
    if (is.finite(dec)) args$valores_decimales <- max(0L, min(3L, dec))
  }
  piso <- .radar_mb_piso(datos, eje_min)
  if (piso > 0) args$limites <- c(piso / 100, 1)
  if (length(overrides)) args <- utils::modifyList(args, overrides)
  do.call(graficar_radar, args)
}

# Tabla que acompana al radar: una fila por tema, una columna por publico, y el
# indicador en la esquina. Es lo que da las cifras exactas que la telarana solo
# insinua.
.radar_mb_tabla <- function(datos, etiqueta_corte = "", decimales = 0L) {
  dec <- suppressWarnings(as.integer(decimales)[1])
  if (!is.finite(dec)) dec <- 0L
  dec <- max(0L, min(3L, dec))
  ejes <- levels(datos$eje)
  grupos <- levels(datos$grupo)
  out <- data.frame(Tema = ejes, stringsAsFactors = FALSE)
  for (g in grupos) {
    col <- vapply(ejes, function(e) {
      v <- datos$valor[datos$eje == e & datos$grupo == g]
      if (!length(v) || is.na(v[1])) NA_real_ else round(v[1], dec)
    }, numeric(1))
    out[[g]] <- unname(col)
  }
  attr(out, "indicador") <- as.character(etiqueta_corte %||% "")
  # El formato viaja con la tabla: el redondeo y el texto tienen que decir lo
  # mismo, o la celda muestra 98 y el numero guardado es 98.04.
  attr(out, "decimales") <- dec
  out
}

# -----------------------------------------------------------------------------
# Elemento de plan y renderer
# -----------------------------------------------------------------------------

#' @title Radar comparativo entre públicos
#' @family reporte
#' @param vars Lista NOMBRADA `titulo del eje -> character()` de referencias
#'   `base$variable`. Misma forma que `vars` en `p_barras_multiapiladas(modo =
#'   "var_cruce")`, para que el emparejado se declare una sola vez.
#' @param corte Códigos de la escala que suman el indicador: `"3,4"`.
#' @param estilo Clave de estilo: `comparativo`, `silueta`, `auditoria`, `limpio`.
#' @param corte_etiqueta Nombre del indicador. Si falta, la tabla lo omite.
#' @param mostrar_tabla Si `TRUE`, compone el radar con su tabla al costado.
#' @param mostrar_valores Si `TRUE`, escribe el porcentaje en cada vértice.
#' @param decimales Decimales del porcentaje, en el vértice y en la tabla.
#'   `0` (el defecto) da enteros.
#' @param eje_min Piso del eje radial en puntos porcentuales. `0` es el eje
#'   completo; `50` estira la mitad alta para ver diferencias dentro de una
#'   banda estrecha.
#' @param titulo,overrides,base,filtros Como el resto de elementos del plan.
#' @export
p_radar_publicos <- function(
    vars,
    corte,
    estilo = "comparativo",
    corte_etiqueta = NULL,
    mostrar_tabla = TRUE,
    mostrar_valores = FALSE,
    decimales = 0L,
    eje_min = 0,
    titulo = NULL,
    overrides = list(),
    base = list(),
    filtros = list()
) {
  if (!is.list(vars) || !length(vars)) {
    .plan_spec_abort("p_radar_publicos(): `vars` debe ser una lista nombrada no vacia.")
  }
  if (is.null(names(vars)) || any(!nzchar(trimws(names(vars))))) {
    .plan_spec_abort("p_radar_publicos(): cada eje necesita nombre — es la etiqueta del vertice.")
  }
  if (!length(.radar_mb_codigos(corte))) {
    .plan_spec_abort("p_radar_publicos(): `corte` debe traer al menos un codigo de la escala.")
  }
  if (!is.list(overrides)) .plan_spec_abort("`overrides` debe ser lista.")
  if (!is.list(base)) .plan_spec_abort("`base` debe ser lista.")

  el <- list(
    .element_type  = "radar_publicos",
    vars           = lapply(vars, function(x) as.character(unlist(x))),
    corte          = as.character(corte)[1],
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    estilo         = as.character(estilo %||% "comparativo")[1],
    mostrar_tabla  = isTRUE(mostrar_tabla),
    mostrar_valores = isTRUE(mostrar_valores),
    decimales      = .radar_mb_decimales(decimales),
    eje_min        = .radar_mb_eje_min(eje_min),
    title_slide    = titulo,
    overrides      = overrides,
    base           = base,
    filtros        = .ppt_norm_filters(filtros)
  )
  class(el) <- c("ppt_element", "list")
  el
}

# El despacho del PPT resuelve por convencion de nombre —`.render_<etype>` con
# `inherits = TRUE`— asi que este renderer se encuentra sin tocar
# `reporte_plan_ppt.R`, que esta congelado a crecimiento.
#
# Las fuentes se toman con `dynGet()` de la pila de llamada. El despacho pasa
# solo `(el, preset_args)` y no hay forma de anadir un argumento sin hacer crecer
# el archivo congelado; `dynGet` existe justo para leer una variable del entorno
# de llamada sin acoplarse a la profundidad del frame. Si no aparecen, se dice:
# un radar comparativo sin las bases no tiene nada que comparar.
.render_radar_publicos <- function(el, preset_args = list()) {
  data_sources <- dynGet("data_sources", ifnotfound = NULL)
  inst_sources <- dynGet("instrument_sources", ifnotfound = NULL)
  if (!length(data_sources) || !length(inst_sources)) {
    stop("radar_publicos: el render no expone las fuentes del estudio.", call. = FALSE)
  }
  sources <- list(data_sources = data_sources, inst_sources = inst_sources)

  datos <- .radar_mb_datos(el$vars, el$corte, sources)
  overrides <- utils::modifyList(as.list(preset_args %||% list()),
                                 as.list(el$overrides %||% list()))
  g <- .radar_mb_grafico(datos, estilo = el$estilo, overrides = overrides,
                         titulo = el$title_slide,
                         mostrar_valores = el$mostrar_valores,
                         decimales = el$decimales,
                         eje_min = el$eje_min)
  if (!isTRUE(el$mostrar_tabla)) return(g)

  tabla <- .radar_mb_tabla(datos, el$corte_etiqueta, decimales = el$decimales)
  .radar_mb_componer(g, tabla)
}

# Compone el radar con su tabla. La tabla NO es adorno: con tres publicos sobre
# una banda de ocho puntos, la telarana dice la forma y la tabla dice la cifra.
# Etiquetar los vertices seria poner 18 numeros dentro de esa banda.
#
# `cowplot` y `gridExtra` ya son dependencias declaradas; no se anade ninguna.
.radar_mb_componer <- function(grafico, tabla) {
  if (!requireNamespace("gridExtra", quietly = TRUE) ||
      !requireNamespace("cowplot", quietly = TRUE)) {
    return(grafico)
  }
  navy <- "#062A63"
  gris <- "#F2F2F2"

  dec <- suppressWarnings(as.integer(attr(tabla, "decimales") %||% 0L)[1])
  if (!is.finite(dec)) dec <- 0L
  patron <- paste0("%.", max(0L, min(3L, dec)), "f%%")
  fmt <- tabla
  for (j in seq_len(ncol(fmt))[-1]) {
    fmt[[j]] <- ifelse(is.na(fmt[[j]]), "—", sprintf(patron, fmt[[j]]))
  }
  indicador <- attr(tabla, "indicador") %||% ""
  if (nzchar(indicador)) names(fmt)[1] <- paste0(names(fmt)[1], "  ·  ", indicador)

  n <- nrow(fmt)
  k <- ncol(fmt)

  # `gridExtra` recicla los estilos CELDA A CELDA en orden de columna, no por
  # columna: un vector de largo `k` alineaba una fila si y otra no. Hay que dar
  # el valor de cada celda, repetido `n` veces por columna.
  #
  # El tema a la izquierda y las cifras a la derecha: una columna de porcentajes
  # justificada a la izquierda no deja comparar de un vistazo.
  hjust_cel <- rep(c(0, rep(1, k - 1)), each = n)
  x_cel     <- rep(c(0.04, rep(0.94, k - 1)), each = n)
  # El rayado es por FILA, asi que se repite el patron por columna en vez de
  # alternar celda a celda —que producia un tablero de ajedrez—.
  fill_cel  <- rep(rep_len(c("white", gris), n), times = k)

  tema <- gridExtra::ttheme_minimal(
    base_size = 9,
    core = list(
      fg_params = list(col = navy, hjust = hjust_cel, x = x_cel),
      bg_params = list(fill = fill_cel, col = "white", lwd = 1.2)
    ),
    colhead = list(
      fg_params = list(col = "white", fontface = "bold",
                       hjust = c(0, rep(1, k - 1)),
                       x = c(0.04, rep(0.94, k - 1))),
      bg_params = list(fill = navy, col = "white", lwd = 1.2)
    )
  )

  grob <- gridExtra::tableGrob(fmt, rows = NULL, theme = tema)
  cowplot::plot_grid(grafico, cowplot::ggdraw(grob),
                     ncol = 2, rel_widths = c(1.35, 1))
}
