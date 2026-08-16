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
.radar_mb_pct <- function(valores, codigos, pesos = NULL) {
  v <- as.character(valores)
  w <- if (is.null(pesos)) {
    rep(1, length(v))
  } else {
    suppressWarnings(as.numeric(pesos))
  }
  if (length(w) != length(v)) {
    stop("`pesos` debe tener la misma longitud que `valores`.", call. = FALSE)
  }
  w[!is.finite(w) | is.na(w)] <- 0
  if (any(w < 0)) {
    stop("`pesos` no puede contener valores negativos.", call. = FALSE)
  }

  validos <- !is.na(v) & nzchar(trimws(v))
  v <- trimws(v[validos])
  w <- w[validos]
  n <- sum(w)
  if (!is.finite(n) || n <= 0) return(list(valor = NA_real_, n = 0))
  dentro <- sum(w[v %in% as.character(codigos)])
  list(valor = 100 * dentro / n, n = n)
}

# Adapta la declaracion publica del peso al contrato historico de `.peso_vec()`.
# El motor canonico sigue resolviendo `peso`; este consumidor solo le presenta
# bajo ese nombre la columna que `reporte_data()` registro en `attr(var_peso)`.
# Si el atributo falta, esta vacio o apunta fuera de la base, se conserva el
# mecanismo anterior (columna `peso`, o unos cuando tampoco existe).
.radar_mb_pesos <- function(data) {
  var_peso <- attr(data, "var_peso", exact = TRUE)
  if (!is.null(var_peso)) {
    var_peso <- trimws(as.character(var_peso)[1])
    if (!is.na(var_peso) && nzchar(var_peso) && var_peso %in% names(data)) {
      data_peso <- data.frame(peso = data[[var_peso]], check.names = FALSE)
      return(.peso_vec(data_peso))
    }
  }
  .peso_vec(data)
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

# Cuerpo de texto de la tabla al costado, en puntos. Es el defecto: lo pisa el
# preset (`tabla_body_size`) y, por encima, el propio elemento.
.RADAR_MB_TEXTO_PT <- 9

# Fraccion del ancho de tabla que ocupa la primera columna. Fuera de 0.2-0.8 no
# se acepta: por debajo el nombre del tema se parte en cinco lineas y por encima
# las cifras se apelmazan contra el borde derecho.
.radar_mb_fraccion <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA)[1])
  if (!is.finite(v) || v <= 0) return(NA_real_)
  # Se acepta tanto 0.45 como 45: la UI pide un porcentaje y el motor una
  # fraccion, y confundirlas dejaba la columna en el 4500 % del ancho.
  if (v > 1) v <- v / 100
  max(0.2, min(0.8, v))
}

# Ancho de la tabla respecto al radar.
.radar_mb_proporcion <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA)[1])
  if (!is.finite(v) || v <= 0) return(NA_real_)
  max(0.3, min(3, v))
}

# Largo maximo del nombre de un tema para que el radar siga siendo legible.
#
# Medido sobre el estudio: la diapositiva 10 declara siete temas de 91 a 200
# caracteres. Envueltos a 12 columnas dan hasta diecisiete lineas por vertice,
# que se tapan entre si y sepultan el poligono — la lamina salia como una lista
# de frases sin grafico. Un radar compara de un vistazo; si el eje necesita una
# oracion, lo que toca es barras.
.RADAR_MB_MAX_ETIQUETA <- 42L

# Recorta el nombre del eje para dibujarlo. El nombre completo NO se pierde: la
# tabla al costado lo lleva entero, que es donde se lee con calma.
#
# El resultado tiene que seguir siendo UNICO. Dos temas de una bateria comparten
# casi siempre el arranque —«Estoy satisfecho(a) con los programas de…»— y al
# recortar quedaban identicos: el eje del radar es un factor, y un nivel
# duplicado lo mata con «factor level is duplicated». La lamina salia «Sin
# datos». Por eso el corte se alarga hasta que los homonimos se separan.
.radar_mb_recortar_uno <- function(t, max_chars) {
  if (is.na(t) || nchar(t) <= max_chars) return(t)
  corte <- substr(t, 1L, max_chars)
  # Corta en el ultimo espacio antes del limite para no partir una palabra.
  esp <- regexpr("[[:space:]][^[:space:]]*$", corte)
  if (esp > 1L) corte <- substr(corte, 1L, esp - 1L)
  paste0(trimws(corte), "…")
}

.radar_mb_recortar_eje <- function(x, max_chars = .RADAR_MB_MAX_ETIQUETA) {
  x <- as.character(x)
  if (!length(x)) return(x)
  out <- vapply(x, .radar_mb_recortar_uno, character(1),
                max_chars = max_chars, USE.NAMES = FALSE)

  # Los homonimos se alargan a la vez —no uno solo— para que sigan leyendose
  # como el mismo bloque de texto y se distingan por donde de verdad difieren.
  limite <- max_chars
  tope <- max(nchar(x), na.rm = TRUE)
  while (anyDuplicated(out) && limite < tope) {
    limite <- limite + max_chars
    repetidos <- out %in% out[duplicated(out)]
    out[repetidos] <- vapply(x[repetidos], .radar_mb_recortar_uno, character(1),
                             max_chars = limite, USE.NAMES = FALSE)
  }
  # Si ni el texto entero los separa, son el mismo tema declarado dos veces:
  # se numeran para que el radar dibuje sus dos vertices en vez de morir.
  if (anyDuplicated(out)) {
    dup <- out %in% out[duplicated(out)]
    out[dup] <- paste0(out[dup], " (", ave_seq(out[dup]), ")")
  }
  out
}

# Posicion de cada elemento dentro de su grupo de iguales: 1, 2, 3...
ave_seq <- function(x) ave(seq_along(x), x, FUN = seq_along)

# Piso declarado del eje, en puntos porcentuales. El recorte contra los datos
# vive en `.radar_mb_piso()`, que si los tiene a la vista.
.radar_mb_eje_min <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% 0)[1])
  if (!is.finite(v) || v <= 0) return(0)
  min(v, 99)
}

# Renombres de columna declarados como «clave=Titulo», una por linea. Mismo
# formato que `titulos_grupo` de las multiapiladas: el analista no tiene por que
# aprender una sintaxis nueva por cambiar de graficador.
#
# Lo que no se nombra se queda como esta. Un mapa parcial es lo normal: casi
# siempre se retoca una sola columna.
.radar_mb_renombres <- function(x) {
  txt <- as.character(x %||% "")
  if (!length(txt) || !any(nzchar(trimws(txt)))) return(list())
  lineas <- unlist(strsplit(paste(txt, collapse = "\n"), "[\n;]"))
  out <- list()
  for (l in lineas) {
    if (!grepl("=", l, fixed = TRUE)) next
    clave <- trimws(sub("=.*$", "", l))
    valor <- trimws(sub("^[^=]*=", "", l))
    if (nzchar(clave)) out[[clave]] <- valor
  }
  out
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
.radar_mb_datos <- function(ejes, corte, sources, filtros = list()) {
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
    contextos <- vector("list", length(refs))
    firma_tema <- NULL
    firma_ref <- NULL

    for (i in seq_along(refs)) {
      ref <- refs[[i]]
      ctx <- .graficos_consolidado_ref_context(ref, sources)
      if (!isTRUE(ctx$exists)) {
        stop(
          "radar_publicos: el tema `", titulo, "` declara la ref `", ref,
          "`, pero no existe completa en data e instrumento.",
          call. = FALSE
        )
      }

      tipo <- if (is.data.frame(ctx$survey) && "type" %in% names(ctx$survey) &&
                  is.finite(ctx$row_idx)) {
        trimws(as.character(ctx$survey$type[[ctx$row_idx]]))
      } else {
        NA_character_
      }
      if (is.na(tipo) || !grepl("^select_one(?:\\s|$)", tipo, perl = TRUE)) {
        stop(
          "radar_publicos: el tema `", titulo, "`, ref `", ref,
          "`, debe resolver una variable select_one; el tipo es ",
          if (is.na(tipo) || !nzchar(tipo)) "desconocido" else paste0("`", tipo, "`"),
          ".",
          call. = FALSE
        )
      }

      diseno <- .graficos_sig_diseno_de_fuente(ctx$inst, ctx$resolved_variable)
      if (!identical(diseno, "independiente")) {
        stop(
          "radar_publicos: el tema `", titulo, "`, ref `", ref,
          "`, requiere una variable plana de diseño independiente; se detectó `",
          diseno, "` (repeat/cluster).",
          call. = FALSE
        )
      }

      firma <- .equiv_firma_escala(ctx$inst, ctx$resolved_variable)
      if (is.null(firma_tema)) {
        firma_tema <- firma
        firma_ref <- ref
      } else if (!identical(firma, firma_tema)) {
        stop(
          "radar_publicos: el tema `", titulo, "` mezcla firmas E1 distintas entre `",
          firma_ref, "` y `", ref, "` (código + etiqueta).",
          call. = FALSE
        )
      }

      opciones <- .equiv_escala_opciones(ctx$inst, ctx$resolved_variable)
      codigos_escala <- vapply(opciones, function(opcion) {
        as.character(opcion$codigo %||% "")[1]
      }, character(1))
      faltan_corte <- setdiff(codigos, codigos_escala)
      if (length(faltan_corte)) {
        stop(
          "radar_publicos: el tema `", titulo, "`, ref `", ref,
          "`, no contiene el corte `", paste(faltan_corte, collapse = ", "),
          "` en su escala.",
          call. = FALSE
        )
      }
      contextos[[i]] <- ctx
    }

    for (i in seq_along(refs)) {
      ref <- refs[[i]]
      ctx <- contextos[[i]]
      datos <- (sources$data_sources %||% list())[[ctx$source]]
      col <- ctx$resolved_variable
      datos <- .apply_named_filters_safe(
        datos,
        filters = filtros,
        arg_name = paste0("filtros de `", ref, "`"),
        mode = "strict"
      )
      medida <- .radar_mb_pct(datos[[col]], codigos, pesos = .radar_mb_pesos(datos))
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
    descripcion = "Una línea por público sobre la telaraña, con los radios que van del centro a cada tema. El estilo que sincroniza con la matriz de equivalencias.",
    args = list(
      rellenar_poligono = FALSE,
      mostrar_puntos = TRUE,
      # Los radios del centro a cada punta son la estructura que deja seguir un
      # tema desde el centro; sin ellos la telarana es solo anillos concentricos.
      mostrar_radios = TRUE,
      mostrar_tela = TRUE,
      # Ni numeros en los vertices ni etiquetas de nivel por defecto: son dos
      # capas de cifras sobre una figura que se lee por su forma, y la tabla al
      # costado ya da el dato exacto. Las dos se encienden desde la UI.
      mostrar_valores = FALSE,
      mostrar_niveles = FALSE,
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
      mostrar_radios = TRUE,
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
  wrap_ejes = 12L,
  # Aire entre la punta del poligono y el nombre del tema. Con 1.06 el texto
  # quedaba pegado al borde y «Costos y presupuestos» parecia parte de la
  # figura; el radar encoge un poco y el nombre respira.
  radar_scale = 0.92,
  eje_label_mult = 1.20,
  # Holgura para que los nombres largos entren enteros. Encoger el radar no
  # bastaba: las etiquetas se anclan al anillo, no al poligono, asi que seguian
  # cayendo fuera del panel y se cortaban a media palabra.
  #
  # Bajo de 1.42 a 1.18 al subir `eje_label_mult`: el aire lo da ahora el anillo
  # de etiquetas, y el margen extra solo dejaba media lamina en blanco entre el
  # radar y la tabla.
  margen_etiquetas = 1.18
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
  if (piso < minimo) return(piso)
  # Bajar EXACTAMENTE al minimo no basta: ese valor caeria en el centro del
  # radar, que es justo lo que se lee como cero. El piso se coloca un escalon
  # por debajo, redondeado a multiplos de cinco para que los anillos den cifras
  # legibles.
  nuevo <- max(0, floor((minimo - 5) / 5) * 5)
  culpable <- datos[is.finite(datos$valor) & datos$valor == minimo, , drop = FALSE][1, ]
  .pulso_aviso(sprintf(
    "radar_publicos: el piso del eje baja de %s a %s — «%s» en %s vale %.1f%% y en %s quedaria en el centro.",
    format(piso), format(nuevo), as.character(culpable$eje), as.character(culpable$grupo),
    minimo, format(piso)))
  nuevo
}

#' Dibuja el radar comparativo.
.radar_mb_grafico <- function(datos, estilo = NULL, overrides = list(), titulo = NULL,
                              mostrar_valores = NULL, decimales = NULL, eje_min = NULL,
                              indicador = "") {
  if (!requireNamespace("ggplot2", quietly = TRUE)) {
    stop_api(500, "E_RADAR_SIN_GGPLOT2", "El paquete R 'ggplot2' no está instalado.")
  }
  # El nombre largo se recorta SOLO para dibujar. La tabla lo lleva entero.
  #
  # El recorte se calcula sobre los NIVELES y se aplica por posicion. Calcularlo
  # sobre la columna lo rompia: ahi cada eje aparece una vez por grupo, el
  # desambiguador leia esas repeticiones legitimas como homonimos y les colgaba
  # «(1) (2) (3)» — con lo que ningun valor casaba ya con su nivel y el radar se
  # quedaba sin una sola fila valida.
  niveles <- .radar_mb_recortar_eje(levels(datos$eje))
  datos$eje <- factor(niveles[as.integer(datos$eje)], levels = niveles)
  args <- utils::modifyList(
    list(
      data = datos,
      var_eje = "eje", var_grupo = "grupo", var_valor = "valor",
      escala_valor = "proporcion_100",
      limites = c(0, 100),
      titulo = titulo,
      # El indicador va aqui y no en el encabezado de la tabla: «De acuerdo +
      # Totalmente de Acuerdo» dentro de una celda se comia media tabla, y
      # ademas hace falta aunque la tabla este apagada — sin el, la telarana no
      # dice de que porcentaje habla.
      subtitulo = if (nzchar(trimws(as.character(indicador %||% "")))) {
        paste0("% ", trimws(as.character(indicador)))
      } else NULL
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

  # Quedarse SOLO con lo que `graficar_radar()` acepta. El preset llega con el
  # estilo base ya heredado —`preservar_tamanos_texto`, `size_texto_barras`,
  # `size_titulo_slide`, `size_cuerpo_slide`—, que son de los graficadores de
  # barras y no de este; `do.call` con una sola clave ajena aborta la llamada
  # entera con «unused arguments».
  #
  # Y el fallo era invisible: el despachador reintenta sin `preset_args` cuando
  # el renderer falla, asi que la lamina salia igual, con los defectos del
  # graficador y sin ninguna de las catorce claves `tabla_*` que el proyecto
  # declara. Nadie veia un error; solo una tabla que no obedecia.
  # Una funcion con `...` acepta lo que sea, asi que no hay nada que filtrar. La
  # distincion importa: el filtro se aplica sobre la `graficar_radar` que este
  # visible en ese momento, y filtrar contra unos formals de `...` dejaria la
  # llamada sin argumentos.
  fml <- names(formals(graficar_radar))
  if (!"..." %in% fml) {
    desconocidas <- setdiff(names(args), fml)
    if (length(desconocidas)) args <- args[!names(args) %in% desconocidas]
  }
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
#' @param tabla_titulo Encabezado de la primera columna. Vacío = «Tema» más el
#'   nombre del indicador.
#' @param tabla_encabezados Renombres de las columnas de público, `clave=Título`
#'   por línea. Lo que no se nombra se queda como está.
#' @param tabla_ancho_tema Ancho de la primera columna como fracción del ancho
#'   de la tabla (0.2–0.8). Vacío = lo que pida el contenido.
#' @param tabla_proporcion Ancho de la tabla respecto al radar. `1` es la mitad
#'   de la lámina para cada uno; el defecto da más espacio al radar.
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
    tabla_titulo = NULL,
    tabla_encabezados = NULL,
    tabla_ancho_tema = NULL,
    tabla_proporcion = NULL,
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
    # `var = NULL` explicito y no por omision: el motor del PPT lee `el$var` para
    # titular la lamina, y el `$` de R hace MATCH PARCIAL cuando no encuentra el
    # nombre exacto. Sin este campo, `el$var` devolvia `vars` —una lista nombrada
    # de vectores— que el resolvedor deparseaba a `c("docentes$p30_1", ...)` y
    # tumbaba el mazo entero con «La fuente c("docentes no existe en data».
    var            = NULL,
    vars           = lapply(vars, function(x) as.character(unlist(x))),
    corte          = as.character(corte)[1],
    corte_etiqueta = as.character(corte_etiqueta %||% "")[1],
    estilo         = as.character(estilo %||% "comparativo")[1],
    mostrar_tabla  = isTRUE(mostrar_tabla),
    mostrar_valores = isTRUE(mostrar_valores),
    decimales      = .radar_mb_decimales(decimales),
    eje_min        = .radar_mb_eje_min(eje_min),
    tabla_titulo   = as.character(tabla_titulo %||% "")[1],
    tabla_encabezados = .radar_mb_renombres(tabla_encabezados),
    tabla_ancho_tema  = .radar_mb_fraccion(tabla_ancho_tema),
    tabla_proporcion  = .radar_mb_proporcion(tabla_proporcion),
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

  datos <- .radar_mb_datos(el$vars, el$corte, sources, filtros = el$filtros %||% list())
  invalidas <- which(
    !is.finite(datos$valor) | !is.finite(datos$n) | datos$n <= 0
  )
  if (length(invalidas)) {
    celda <- datos[invalidas[[1]], , drop = FALSE]
    stop(
      "radar_publicos: la celda observada del tema `", as.character(celda$eje),
      "` y la fuente `", as.character(celda$grupo),
      "` quedó sin denominador válido; el radar no inventa ese vértice.",
      call. = FALSE
    )
  }
  overrides <- utils::modifyList(as.list(preset_args %||% list()),
                                 as.list(el$overrides %||% list()))
  g <- .radar_mb_grafico(datos, estilo = el$estilo, overrides = overrides,
                         titulo = el$title_slide,
                         mostrar_valores = el$mostrar_valores,
                         decimales = el$decimales,
                         eje_min = el$eje_min,
                         indicador = el$corte_etiqueta)
  if (!isTRUE(el$mostrar_tabla)) return(g)

  tabla <- .radar_mb_tabla(datos, el$corte_etiqueta, decimales = el$decimales)
  .radar_mb_componer(g, tabla,
                     titulo_tema = el$tabla_titulo,
                     encabezados = el$tabla_encabezados,
                     ancho_tema = el$tabla_ancho_tema,
                     proporcion = el$tabla_proporcion,
                     # El elemento manda sobre el preset, y el preset sobre el
                     # defecto: el mismo orden que el resto del motor.
                     texto_pt = el$tabla_texto_pt %||%
                       preset_args$tabla_body_size %||%
                       preset_args$tabla_texto_pt %||% .RADAR_MB_TEXTO_PT)
}

# Envuelve el texto de la primera columna para que la tabla quepa en su mitad de
# la lamina. Sin esto, `tableGrob` —que dimensiona por contenido y no recorta—
# devolvia un grob mas ancho que la diapositiva.
.radar_mb_envolver <- function(x, ancho = 58L) {
  x <- as.character(x)
  if (!requireNamespace("stringr", quietly = TRUE)) return(x)
  stringr::str_wrap(x, width = ancho)
}

# Encabezados finales de la tabla.
#
# La primera columna dice «Tema» a secas. El indicador NO va aqui: metido en la
# celda, «De acuerdo + Totalmente de Acuerdo» se comia media tabla, y ademas
# hace falta aunque la tabla este apagada. Vive en el subtitulo del grafico.
#
# Las columnas de publico se renombran por clave, y la clave es el nombre de la
# base tal como llega del estudio: «docentes», no «Docentes». Lo que no se
# nombra se queda como esta.
.radar_mb_nombres_tabla <- function(tabla, titulo_tema = "", encabezados = list()) {
  nombres <- names(tabla)
  titulo_tema <- trimws(as.character(titulo_tema %||% "")[1])
  if (nzchar(titulo_tema)) nombres[1] <- titulo_tema
  for (clave in names(encabezados %||% list())) {
    j <- match(clave, names(tabla))
    if (!is.na(j)) nombres[j] <- as.character(encabezados[[clave]])
  }
  nombres
}

# Compone el radar con su tabla. La tabla NO es adorno: con tres publicos sobre
# una banda de ocho puntos, la telarana dice la forma y la tabla dice la cifra.
# Etiquetar los vertices seria poner 18 numeros dentro de esa banda.
#
# `cowplot` y `gridExtra` ya son dependencias declaradas; no se anade ninguna.
#' Compone el radar con su tabla al costado
#'
#' `texto_pt` sale del preset y no de un literal. Estuvo escrito a mano —un 9
#' fijo en el `ttheme`— y era invisible desde fuera: subir `tabla_body_size` en
#' el proyecto no movia un punto, porque ese parametro gobierna la tabla del
#' radar clasico y esta es la del radar multibase, que es la que atiende el modo
#' `publicos`. Dos tablas distintas con nombres parecidos y una sola
#' configurable.
#'
#' @keywords internal
.radar_mb_componer <- function(grafico, tabla, titulo_tema = "", encabezados = list(),
                               ancho_tema = NA_real_, proporcion = NA_real_,
                               texto_pt = .RADAR_MB_TEXTO_PT) {
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
  # La primera columna se envuelve. `tableGrob` dimensiona por contenido y no
  # recorta: un tema de 200 caracteres producia una tabla mas ancha que la
  # lamina, que se salia por la derecha y encima tapaba el radar.
  fmt[[1]] <- .radar_mb_envolver(as.character(fmt[[1]]))
  for (j in seq_len(ncol(fmt))[-1]) {
    fmt[[j]] <- ifelse(is.na(fmt[[j]]), "—", sprintf(patron, fmt[[j]]))
  }
  names(fmt) <- .radar_mb_nombres_tabla(tabla, titulo_tema, encabezados)

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

  base_pt <- suppressWarnings(as.numeric(texto_pt)[1])
  if (!is.finite(base_pt) || base_pt <= 0) base_pt <- .RADAR_MB_TEXTO_PT

  tema <- gridExtra::ttheme_minimal(
    base_size = base_pt,
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
  # `tableGrob` dimensiona por contenido, asi que un encabezado largo empuja la
  # primera columna hasta comerse la tabla. Con un ancho declarado se reparte a
  # mano: la primera columna toma su fraccion y el resto se divide en partes
  # iguales, que es lo que hace comparables las cifras.
  if (is.finite(ancho_tema) && k > 1L) {
    ancho_total <- sum(as.numeric(grid::convertWidth(grob$widths, "cm")))
    if (is.finite(ancho_total) && ancho_total > 0) {
      resto <- (1 - ancho_tema) / (k - 1)
      grob$widths <- grid::unit(c(ancho_tema, rep(resto, k - 1)) * ancho_total, "cm")
    }
  }
  rel <- if (is.finite(proporcion)) proporcion else 1
  cowplot::plot_grid(grafico, cowplot::ggdraw(grob),
                     ncol = 2, rel_widths = c(1.35, rel))
}
