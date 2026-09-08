# El formato de «Avance de campo» en Google Sheets — unidad B19 (v4-app).
#
# Dictado de Gonzalo (2026-09-01, textual): «tiene una estructura muy, muy fea;
# no se ven bien las tablas, no se organiza bien, no se entiende cómo se
# organiza; se ve como toda esa información, no como una tabla».
#
# Cada bloque del modelo (meta, facultades, aplicadores, diario) sale como
# TABLA: banda de título propia y cabecera de columnas formateada. Las filas
# se DERIVAN del contenido del renderer (`aulas_libro_hoja_avance`), jamás de
# números mágicos: un modelo sin cuotas no trae bloque de facultades y las
# bandas de los demás siguen a SU contenido, esté donde esté.
#
# Vive en archivo propio y NO en monitoreo_aulas_sheets_formato.R: ese archivo
# lo trabaja la oleada autor-libro-v4 en paralelo (regla de ownership de la
# oleada v4-app). `.malp_formato_requests` — el adaptador que el motor invoca
# en su batch-2 con los rows realmente publicados — integra estas requests
# DESPUÉS de las genéricas de la hoja.
#
# La paleta no se inventa: navy #002457 con blanco en negrita es la cabecera
# del xlsx (`carga_aulas_libro_formato.R` / estilo `cabecera` de indicadores),
# y el par #E7EEF9/#1B4B8F es el azul de la casa que el semáforo del libro ya
# usa («EN RESERVA», monitoreo_aulas_sheets_formato.R).

# Los títulos de bloque y las cabeceras NO se escriben aquí: son los del
# vocabulario compartido (`carga_aulas_libro_avance_columnas.R`), que es el
# mismo que usan el renderer del Sheets y el writer del xlsx. Repetirlos era la
# tercera copia de la misma lista, y la tercera copia es la que se queda vieja.
.maaf_TITULOS_BLOQUE <- unname(AULAS_AVANCE_TITULOS)

# La primera celda de cada cabecera, para las heurísticas de nota y de ancho.
# La IDENTIFICACIÓN de una tabla, en cambio, compara la fila ENTERA
# (`.calac_tabla_de_cabecera`): cuatro de las cinco empiezan por «Facultad» y la
# primera celda no las distingue.
.maaf_CABECERAS_TABLA <- unique(vapply(AULAS_AVANCE_CABECERAS,
                                       function(x) x[[1L]], character(1)))

# V2 (2026-09-08): toda fila cuya primera celda diga «Total» es un cierre y se
# viste igual. Hoy sólo la fila «Total» de la tabla por facultad.
.maaf_FILA_TOTAL <- "Total"

# --- El SEMÁFORO en Sheets, con la misma clasificación que el xlsx -----------
#
# Dictado de Gonzalo (2026-09-08): diferencia positiva en escalas de verde,
# negativa en escalas de rojo; celda que llegó a la meta en verde y a la
# sobremuestra en azul o celeste. Los tonos son los del xlsx
# (`.CAI_VERDE_META`, `.CAI_CELESTE_SOBRE`, `.CAI_ESCALA_DIF`) para que la misma
# hoja no se lea de dos colores según dónde se abra.
.MAAF_VERDE_FONDO <- "#D6EBD6"
.MAAF_VERDE_TINTA <- "#1E6F3C"
.MAAF_CELESTE_FONDO <- "#D8E7F8"
.MAAF_CELESTE_TINTA <- "#1B4B8F"
.MAAF_ROJO_ESCALA <- "#E9A8A8"
# El extremo vacío de un AVANCE: gris muy claro, no rojo. Ver
# `AULAS_AVANCE_AVANCES` — un avance bajo el día 2 no es malo, es el día 2.
.MAAF_NEUTRO_ESCALA <- "#EFF2F6"
.MAAF_BLANCO_ESCALA <- "#FFFFFF"
.MAAF_VERDE_ESCALA <- "#A9D5A9"

# Una banda de UNA fila a lo ancho del rectángulo publicado: fondo, tinta en
# negrita. `repeatCell` con fields acotado a userEnteredFormat — no toca
# values ni dataValidation. Los opcionales dan la jerarquía tipográfica
# (tamaño, itálica, peso) y `wrap` deja que una cabecera larga baje de línea
# en su columna en vez de cortarse; los defaults reproducen la banda clásica,
# así que los llamadores existentes no cambian de salida.
.maaf_banda <- function(sheet_id, fila, n_cols, fondo, tinta,
                        size = NULL, italic = FALSE, bold = TRUE, wrap = FALSE) {
  texto <- list(
    bold = isTRUE(bold),
    foregroundColor = .monitoreo_sheets_rgb(tinta)
  )
  if (!is.null(size)) texto$fontSize <- as.integer(size)
  if (isTRUE(italic)) texto$italic <- TRUE
  formato <- list(
    backgroundColor = .monitoreo_sheets_rgb(fondo),
    textFormat = texto
  )
  campos <- "userEnteredFormat(backgroundColor,textFormat)"
  if (isTRUE(wrap)) {
    formato$wrapStrategy <- "WRAP"
    formato$verticalAlignment <- "MIDDLE"
    campos <- "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)"
  }
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
    ),
    cell = list(userEnteredFormat = formato),
    fields = campos
  ))
}

# El alto en píxeles de UNA fila (updateDimensionProperties ROWS): el aire de
# los títulos, que a alto por defecto se ven apretados contra su banda.
.maaf_alto_fila <- function(sheet_id, fila, pixeles) {
  list(updateDimensionProperties = list(
    range = list(
      sheetId = sheet_id, dimension = "ROWS",
      startIndex = as.integer(fila - 1L), endIndex = as.integer(fila)
    ),
    properties = list(pixelSize = as.integer(pixeles)),
    fields = "pixelSize"
  ))
}

# Centrado horizontal de un rango de columnas a toda la altura publicada
# (horas, conteos): fields acotado al alineamiento — no pisa bandas ni values.
.maaf_centrar <- function(sheet_id, desde_col, hasta_col, n_filas) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = 0L, endRowIndex = as.integer(n_filas),
      startColumnIndex = as.integer(desde_col), endColumnIndex = as.integer(hasta_col)
    ),
    cell = list(userEnteredFormat = list(horizontalAlignment = "CENTER")),
    fields = "userEnteredFormat(horizontalAlignment)"
  ))
}

# Las requests de banda, cabecera, formato de número y color de «Avance de
# campo», derivadas fila a fila del contenido publicado: título de bloque =
# banda navy; fila de nombres de tabla = cabecera azul clara; y, dentro de cada
# tabla reconocida, el numFmt y las reglas de color que su vocabulario declara.
# Lo que no es ni lo uno ni lo otro (notas, vacíos declarados) no se tiñe.
.maaf_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(row) length(row %||% list()), integer(1))))
  m <- .maaf_celdas(rows, n_cols)
  requests <- list()
  for (i in seq_along(rows)) {
    celdas <- m[i, ]
    primera <- celdas[[1L]]
    if (primera %in% .maaf_TITULOS_BLOQUE) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF")
    } else if (nzchar(.calac_tabla_de_cabecera(celdas))) {
      # S1: la cabecera baja de línea en su columna («Faltantes mujeres
      # sobremuestra» no cabe en la suya) en vez de cortarse.
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE)
      # **Y la fila crece lo que la cabecera necesita.** `WRAP` reparte el texto
      # en líneas pero NO estira la fila: con el alto por defecto la tercera
      # línea se corta y «Tasa de rendimiento de la facultad esperada» salía
      # publicada como «Tasa de / rendimiento de la». Se vio en el Sheets del
      # 2026-09-08. El alto se deriva del ancho que esta misma hoja pide para
      # cada columna, así que sigue al contenido y no a una constante.
      requests[[length(requests) + 1L]] <-
        .maaf_alto_fila(sheet_id, i, .maaf_alto_de_cabecera(celdas, .maaf_anchos_px(m)))
    } else if (identical(primera, .maaf_FILA_TOTAL)) {
      requests[[length(requests) + 1L]] <-
        .maaf_banda(sheet_id, i, n_cols, "#F3F5F9", "#002457")
    }
  }
  # S1: anchos por columna y cifras a la derecha, derivados del contenido.
  # Van DESPUÉS del ancho único de la capa genérica, que así queda pisado.
  c(requests,
    .maaf_ancho_requests(sheet_id, m), .maaf_alinear_requests(sheet_id, m),
    .maaf_nota_requests(sheet_id, m),
    .maaf_numero_requests(sheet_id, rows, m),
    .maaf_alinear_tablas(sheet_id, rows, m),
    .maaf_color_requests(sheet_id, rows, m))
}

# El alto en píxeles que necesita una fila de cabecera: la columna que más
# líneas pida manda. ~7,2 px por carácter (el mismo factor que `.maaf_anchos_px`)
# y 17 px por línea, con un mínimo que deja respirar a una cabecera de una línea.
.maaf_alto_de_cabecera <- function(celdas, anchos_px) {
  n <- min(length(celdas), length(anchos_px))
  if (!n) return(30L)
  # `ceiling()` devuelve double, así que el vapply se declara numeric: pedirle
  # integer revienta con «values must be type 'integer'».
  lineas <- vapply(seq_len(n), function(j) {
    caben <- max(4, floor((anchos_px[[j]] - 14) / 7.2))
    max(1, ceiling(nchar(celdas[[j]], type = "chars") / caben))
  }, numeric(1))
  as.integer(min(120L, max(30L, max(lineas) * 17L + 10L)))
}

# --- Las tablas publicadas, localizadas por su cabecera ----------------------
#
# Todo lo que sigue se ancla en la CABECERA COMPLETA de cada tabla y en el
# NOMBRE de cada columna; nunca en una fila o una columna contada. Un índice
# fijo es una dependencia invisible con el orden: quien inserta una columna no
# tiene forma de saber que existe, y así salió publicado un techo de 188 aulas
# pintado como «18800,0 %».
.maaf_tablas <- function(m) {
  n_filas <- nrow(m)
  out <- list()
  i <- 1L
  while (i <= n_filas) {
    clave <- .calac_tabla_de_cabecera(m[i, ])
    if (!nzchar(clave)) { i <- i + 1L; next }
    j <- i
    while (j < n_filas) {
      siguiente <- m[j + 1L, ]
      if (siguiente[[1L]] %in% .maaf_TITULOS_BLOQUE) break
      if (sum(nzchar(siguiente)) < 2L) break
      j <- j + 1L
    }
    if (j > i) {
      out[[length(out) + 1L]] <- list(clave = clave, cabecera = i,
                                      desde = i + 1L, hasta = j)
    }
    i <- j + 1L
  }
  out
}

# Los valores numéricos publicados, como matriz: el texto («—», los rótulos)
# queda en NA. Sirve para fijar el cero de la escala de diferencias, que si se
# deja en automático Sheets lo pone en la mediana y entonces «peor de lo
# esperado» puede salir verde.
.maaf_numeros <- function(rows, n_cols) {
  vals <- lapply(rows, function(row) {
    celdas <- unname(as.list(row %||% list()))
    v <- vapply(celdas, function(x) {
      if (is.numeric(x) && length(x) == 1L && is.finite(x)) as.numeric(x) else NA_real_
    }, numeric(1))
    c(v, rep(NA_real_, max(0L, n_cols - length(v))))[seq_len(n_cols)]
  })
  matrix(unlist(vals, use.names = FALSE), ncol = n_cols, byrow = TRUE)
}

# El rango de una COLUMNA de datos de una tabla, o de una FILA cuando la tabla
# está traspuesta («Avance general»: una fila por concepto).
.maaf_rango <- function(sheet_id, tabla, k, traspuesta, n_cols_tabla) {
  if (isTRUE(traspuesta)) {
    list(sheetId = sheet_id,
         startRowIndex = as.integer(tabla$desde + k - 2L),
         endRowIndex = as.integer(tabla$desde + k - 1L),
         startColumnIndex = 1L, endColumnIndex = as.integer(n_cols_tabla))
  } else {
    list(sheetId = sheet_id,
         startRowIndex = as.integer(tabla$desde - 1L),
         endRowIndex = as.integer(tabla$hasta),
         startColumnIndex = as.integer(k - 1L), endColumnIndex = as.integer(k))
  }
}

# El numFmt de cada columna (o fila): porcentaje donde el vocabulario declara
# una proporción, miles donde hay un conteo. **El rótulo NO lleva «(%)»**:
# Gonzalo, 2026-09-08, «el (%) significa que va en porcentaje, no que les pongas
# "(%)" al título». Por eso el porcentaje tiene que vivir en la celda, y por eso
# la celda tiene que ser un número.
.maaf_numero_requests <- function(sheet_id, rows, m) {
  requests <- list()
  num <- .maaf_numeros(rows, ncol(m))
  for (tabla in .maaf_tablas(m)) {
    cabecera <- AULAS_AVANCE_CABECERAS[[tabla$clave]]
    traspuesta <- identical(tabla$clave, "general")
    n_cols_tabla <- length(cabecera)
    rotulos <- if (traspuesta) m[tabla$desde:tabla$hasta, 1L] else cabecera
    for (k in seq_along(rotulos)) {
      if (!traspuesta && k == 1L) next
      rango <- .maaf_rango(sheet_id, tabla, k, traspuesta, n_cols_tabla)
      # Una columna sin ninguna cifra publicada es de texto: no lleva numFmt.
      hay_cifra <- if (traspuesta) {
        any(is.finite(num[tabla$desde + k - 1L, seq_len(n_cols_tabla)][-1L]))
      } else {
        any(is.finite(num[tabla$desde:tabla$hasta, k]))
      }
      if (!hay_cifra) next
      patron <- if (.calac_es_proporcion(rotulos[[k]], tabla$clave)) {
        list(type = "PERCENT", pattern = "0.0%")
      } else {
        list(type = "NUMBER", pattern = "#,##0")
      }
      requests[[length(requests) + 1L]] <- list(repeatCell = list(
        range = rango,
        cell = list(userEnteredFormat = list(numberFormat = patron)),
        fields = "userEnteredFormat.numberFormat"
      ))
    }
  }
  requests
}

# La alineación DENTRO de cada tabla, que la heurística global no puede dar.
#
# `.maaf_columnas_cifra()` mira la columna de la hoja ENTERA y exige que todas
# sus celdas de datos sean cifras. Con cinco tablas apiladas eso ya no se cumple
# casi nunca: la columna B lleva la cifra de «Avance general» y de la tabla por
# facultad, pero también el NOMBRE del aplicador. Antes del 2026-09-08 sólo una
# tabla tenía texto fuera de la columna A y la heurística bastaba.
#
# Aquí cada tabla decide por su cuenta y por columna: la que trae números en sus
# filas de datos se alinea a la derecha, en el rango de ESA tabla. Va después de
# la pasada global, así que la pisa donde discrepan.
.maaf_alinear_tablas <- function(sheet_id, rows, m) {
  requests <- list()
  num <- .maaf_numeros(rows, ncol(m))
  for (tabla in .maaf_tablas(m)) {
    n_cols_tabla <- length(AULAS_AVANCE_CABECERAS[[tabla$clave]])
    traspuesta <- identical(tabla$clave, "general")
    columnas <- if (traspuesta) 2:n_cols_tabla else seq_len(n_cols_tabla)[-1L]
    for (k in columnas) {
      if (!any(is.finite(num[tabla$desde:tabla$hasta, k]))) next
      requests[[length(requests) + 1L]] <- list(repeatCell = list(
        range = list(
          sheetId = sheet_id,
          startRowIndex = as.integer(tabla$desde - 1L),
          endRowIndex = as.integer(tabla$hasta),
          startColumnIndex = as.integer(k - 1L), endColumnIndex = as.integer(k)
        ),
        cell = list(userEnteredFormat = list(horizontalAlignment = "RIGHT")),
        fields = "userEnteredFormat(horizontalAlignment)"
      ))
    }
  }
  requests
}

.maaf_regla_booleana <- function(rango, tipo, valor, fondo, tinta) {
  list(addConditionalFormatRule = list(
    index = 0L,
    rule = list(
      ranges = list(rango),
      booleanRule = list(
        condition = list(type = tipo,
                         values = list(list(userEnteredValue = as.character(valor)))),
        format = list(
          backgroundColor = .monitoreo_sheets_rgb(fondo),
          textFormat = list(foregroundColor = .monitoreo_sheets_rgb(tinta))
        )
      )
    )
  ))
}

# La escala de una DIFERENCIA, **sin un solo número con separador decimal**.
#
# La primera versión fijaba los extremos con `type = "NUMBER"` y el valor en
# texto («-0.3348»), y salió publicada con topes de ±3 348: Sheets parsea el
# valor de un punto de interpolación CON EL IDIOMA DEL DOCUMENTO, y en un
# documento en español el punto es separador de miles, así que «0.3348» se leyó
# como 3 348. La regla quedaba viva pero inútil — con un rango de ±3 348, cero
# coma algo se pinta blanco siempre—. Es la misma trampa que ya está anotada
# para USER_ENTERED en `monitoreo_aulas_libro_arrastre.R`, y sólo se ve leyendo
# el documento después de publicar.
#
# Aquí los extremos son MIN y MAX —que no llevan valor— y el único número que
# viaja es el «0» del punto medio, que se lee igual en cualquier idioma. De
# paso la escala se ajusta al rango real de la columna en vez de a un tope
# calculado.
#
# Cuando la columna no cruza el cero no hay punto medio que poner: media escala
# —blanco a verde si todo va a favor, rojo a blanco si todo va en contra—, que
# es lo que la API acepta y lo que el dato dice.
.maaf_regla_escala <- function(rango, valores) {
  v <- valores[is.finite(valores)]
  if (!length(v)) return(NULL)
  punto <- function(color, tipo, valor = NULL) {
    out <- list(color = .monitoreo_sheets_rgb(color), type = tipo)
    if (!is.null(valor)) out$value <- valor
    out
  }
  gradiente <- if (min(v) < 0 && max(v) > 0) {
    list(
      minpoint = punto(.MAAF_ROJO_ESCALA, "MIN"),
      midpoint = punto(.MAAF_BLANCO_ESCALA, "NUMBER", "0"),
      maxpoint = punto(.MAAF_VERDE_ESCALA, "MAX")
    )
  } else if (max(v) <= 0) {
    list(
      minpoint = punto(.MAAF_ROJO_ESCALA, "MIN"),
      maxpoint = punto(.MAAF_BLANCO_ESCALA, "MAX")
    )
  } else {
    list(
      minpoint = punto(.MAAF_BLANCO_ESCALA, "MIN"),
      maxpoint = punto(.MAAF_VERDE_ESCALA, "MAX")
    )
  }
  list(addConditionalFormatRule = list(
    index = 0L,
    rule = list(ranges = list(rango), gradientRule = gradiente)
  ))
}

# La escala de un AVANCE: de vacío a lleno, sin rojo. Los dos extremos son
# NUMBER con «0» y «1» —enteros sin separador decimal, que se leen igual en
# cualquier idioma del documento— porque aquí la escala NO se ajusta al rango de
# los datos: 0 y 100 % son la vara, y con MIN/MAX un avance del 3 % saldría
# verde por ser el mayor de una columna que va toda por debajo.
.maaf_regla_deposito <- function(rango) {
  punto <- function(color, valor) list(
    color = .monitoreo_sheets_rgb(color), type = "NUMBER", value = valor
  )
  list(addConditionalFormatRule = list(
    index = 0L,
    rule = list(ranges = list(rango), gradientRule = list(
      minpoint = punto(.MAAF_NEUTRO_ESCALA, "0"),
      maxpoint = punto(.MAAF_VERDE_ESCALA, "1")
    ))
  ))
}

# El color que sigue al valor. Cinco reglas, todas nombradas por rótulo:
#
#   · una DIFERENCIA se pinta en escala con el blanco clavado en el cero, así
#     que el verde es siempre «mejor de lo esperado» y el rojo siempre peor;
#   · unos FALTANTES en cero significan que esa celda ya cubrió su meta: verde
#     contra la muestra, celeste contra la sobremuestra;
#   · un AVANCE que llega al 100 % es lo mismo dicho en proporción.
#
# El tono es claro a propósito: el color ayuda a barrer la tabla, pero el dato
# es el número y un fondo saturado lo tapa.
.maaf_color_requests <- function(sheet_id, rows, m) {
  requests <- list()
  num <- .maaf_numeros(rows, ncol(m))
  for (tabla in .maaf_tablas(m)) {
    cabecera <- AULAS_AVANCE_CABECERAS[[tabla$clave]]
    traspuesta <- identical(tabla$clave, "general")
    n_cols_tabla <- length(cabecera)
    rotulos <- if (traspuesta) m[tabla$desde:tabla$hasta, 1L] else cabecera
    for (k in seq_along(rotulos)) {
      if (!traspuesta && k == 1L) next
      r <- trimws(rotulos[[k]])
      rango <- .maaf_rango(sheet_id, tabla, k, traspuesta, n_cols_tabla)
      valores <- if (traspuesta) {
        num[tabla$desde + k - 1L, seq_len(n_cols_tabla)][-1L]
      } else {
        num[tabla$desde:tabla$hasta, k]
      }
      valores <- valores[is.finite(valores)]
      if (r %in% AULAS_AVANCE_DIFERENCIAS) {
        regla <- .maaf_regla_escala(rango, valores)
        if (!is.null(regla)) requests[[length(requests) + 1L]] <- regla
      } else if (r %in% AULAS_AVANCE_FALTAN_MUESTRA) {
        requests[[length(requests) + 1L]] <- .maaf_regla_booleana(
          rango, "NUMBER_EQ", 0, .MAAF_VERDE_FONDO, .MAAF_VERDE_TINTA)
      } else if (r %in% AULAS_AVANCE_FALTAN_SOBREMUESTRA) {
        requests[[length(requests) + 1L]] <- .maaf_regla_booleana(
          rango, "NUMBER_EQ", 0, .MAAF_CELESTE_FONDO, .MAAF_CELESTE_TINTA)
      } else if (r %in% AULAS_AVANCE_AVANCES) {
        # **Un depósito que se llena, no un veredicto.** Gris claro en el 0,
        # verde en el 100 %, y celeste al pasarse. Gonzalo pidió primero
        # «rojo hasta verde y luego celeste» y se corrigió él mismo: «rojo da a
        # entender que es algo malo cuando puede ser sólo que recién esté
        # empezando». El rojo se queda donde sí hay veredicto, que son las
        # diferencias contra lo esperado.
        #
        # El orden importa: cada request entra en el índice 0, así que la que se
        # emite ÚLTIMA queda primera y Sheets aplica la primera que casa. La
        # escala va antes y el celeste después, para que el celeste gane.
        requests[[length(requests) + 1L]] <- .maaf_regla_deposito(rango)
        requests[[length(requests) + 1L]] <- .maaf_regla_booleana(
          rango, "NUMBER_GREATER_THAN_EQ", 1, .MAAF_CELESTE_FONDO, .MAAF_CELESTE_TINTA)
      }
    }
  }
  requests
}

# --- S1 (loop estética-aulas-sheets, 2026-09-07): la hoja se lee como tabla ---
#
# Medido antes: la capa genérica (`monitoreo_aulas_sheets_formato_requests`)
# congela título y columna A —eso se conserva— y fija UN ancho de 150 px para
# las doce columnas; con eso «Aulas que llegaron a SU meta» se corta y las
# cifras, que viajan como texto, quedan pegadas a la izquierda igual que un
# rótulo. Aquí cada columna pide el ancho que su contenido necesita, la
# cabecera de tabla baja de línea en vez de ensanchar la columna, y las
# columnas cuyas celdas de datos son cifras se alinean a la derecha. Todo se
# deriva de los rows publicados; ninguna posición viene de un número mágico.

# Una celda más larga que esto es una nota, no un rótulo: no manda ancho.
.maaf_NOTA_MIN_CHARS <- 60L

# S2: una fila es NOTA cuando trae UNA sola celda con contenido, en la columna
# A, que no es título de bloque ni cabecera y pasa de este largo (los rótulos
# de la hoja no llegan a 30; «Al 07/09/2026» tampoco).
.maaf_NOTA_DETECTAR_CHARS <- 40L

# Cabecera de tabla: baja de línea, así que aporta a lo más esto al ancho.
.maaf_CABECERA_MAX_CHARS <- 14L

# ¿La celda es un VALOR que se lee alineado a la derecha: cifra (entera,
# decimal, porcentaje), fecha u hora ISO, o un vacío declarado? Medido con el
# libro real del 07/09: el bloque de meta trae una marca `2026-09-07T20:41:36Z`
# en la columna de cifras, y sin esta cláusula esa sola celda dejaba el bloque
# entero pegado a la izquierda.
.maaf_es_cifra <- function(x) {
  x <- trimws(as.character(x))
  !nzchar(x) | x %in% c("\u2014", "-", "n/d", "s/d") |
    grepl("^[-+]?[0-9]+([.,][0-9]+)?\\s*%?$", x) |
    grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ][0-9]{2}:[0-9]{2}(:[0-9]{2})?Z?)?$", x) |
    grepl("^[0-9]{1,2}:[0-9]{2}$", x)
}

# Los rows como matriz de caracteres n_filas x n_cols, rellenando a la
# derecha: la API devuelve filas dentadas y el renderer también las produce.
.maaf_celdas <- function(rows, n_cols) {
  padded <- lapply(rows, function(row) {
    celdas <- trimws(as.character(unlist(row %||% list(), use.names = FALSE)))
    celdas[is.na(celdas)] <- ""
    c(celdas, rep("", max(0L, n_cols - length(celdas))))[seq_len(n_cols)]
  })
  matrix(unlist(padded, use.names = FALSE), ncol = n_cols, byrow = TRUE)
}

# Una fila de DATOS: ni título de bloque, ni cabecera de tabla, ni portada,
# ni nota (esas traen una sola celda con contenido).
.maaf_es_fila_de_datos <- function(celdas_fila) {
  primera <- celdas_fila[[1L]]
  !(primera %in% .maaf_TITULOS_BLOQUE) && !(primera %in% .maaf_CABECERAS_TABLA) &&
    sum(nzchar(celdas_fila)) >= 2L
}

# El ancho en píxeles de cada columna: ~7,2 px por carácter más el aire de la
# celda, entre 90 y 320. Las notas no cuentan; las cabeceras cuentan hasta
# `.maaf_CABECERA_MAX_CHARS` porque bajan de línea.
.maaf_anchos_px <- function(m) {
  es_cabecera <- m[, 1L] %in% .maaf_CABECERAS_TABLA
  vapply(seq_len(ncol(m)), function(j) {
    n <- nchar(m[, j], type = "chars")
    n[n > .maaf_NOTA_MIN_CHARS] <- 0L
    n[es_cabecera] <- pmin(n[es_cabecera], .maaf_CABECERA_MAX_CHARS)
    as.integer(min(320L, max(90L, round(max(0L, n) * 7.2) + 20L)))
  }, integer(1))
}

# Una request de ancho por tramo de columnas contiguas con el mismo ancho.
.maaf_ancho_requests <- function(sheet_id, m) {
  px <- .maaf_anchos_px(m)
  requests <- list()
  ini <- 1L
  for (j in seq_along(px)) {
    if (j == length(px) || px[j + 1L] != px[j]) {
      requests[[length(requests) + 1L]] <- .mafs_dim_request(sheet_id, ini - 1L, j, px[j])
      ini <- j + 1L
    }
  }
  requests
}

# Qué columnas son de cifras: todas sus celdas de datos con contenido son
# cifras. La columna A nunca: son los rótulos.
.maaf_columnas_cifra <- function(m) {
  de_datos <- vapply(seq_len(nrow(m)), function(i) .maaf_es_fila_de_datos(m[i, ]), logical(1))
  datos <- m[de_datos, , drop = FALSE]
  vapply(seq_len(ncol(m)), function(j) {
    if (j == 1L || !nrow(datos)) return(FALSE)
    v <- datos[, j]
    v <- v[nzchar(v)]
    length(v) > 0L && all(.maaf_es_cifra(v))
  }, logical(1))
}

# Alineación a la derecha de un rectángulo, con fields acotado: no pisa
# bandas ni values.
.maaf_derecha <- function(sheet_id, desde_col, hasta_col, desde_fila, n_filas) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(desde_fila), endRowIndex = as.integer(n_filas),
      startColumnIndex = as.integer(desde_col), endColumnIndex = as.integer(hasta_col)
    ),
    cell = list(userEnteredFormat = list(horizontalAlignment = "RIGHT")),
    fields = "userEnteredFormat(horizontalAlignment)"
  ))
}

# Una request por tramo de columnas de cifras contiguas, desde la fila 3 (las
# dos de portada son texto) hasta el final publicado.
.maaf_alinear_requests <- function(sheet_id, m) {
  cifra <- .maaf_columnas_cifra(m)
  n_filas <- nrow(m)
  desde_fila <- min(2L, n_filas)
  requests <- list()
  j <- 1L
  while (j <= length(cifra)) {
    if (!cifra[j]) { j <- j + 1L; next }
    k <- j
    while (k < length(cifra) && cifra[k + 1L]) k <- k + 1L
    requests[[length(requests) + 1L]] <- .maaf_derecha(sheet_id, j - 1L, k, desde_fila, n_filas)
    j <- k + 1L
  }
  requests
}

# --- S2: las notas no se derraman -------------------------------------------
#
# Medido en el libro real del 07/09: las notas («La cuota es de cada facultad y
# de cada sexo…», «La muestra es la cuota del diseño…») viajan en UNA celda de
# la columna A; en Sheets se derraman hasta la primera celda ocupada y
# sobresalen de su tabla. Aquí cada nota se fusiona a lo ancho publicado, baja
# de línea, se lee desde arriba y su fila crece lo que el texto necesita. El
# reset de pestaña del motor (`.monitoreo_sheets_reset_tab_requests`) deshace
# los merges viejos antes de reformatear, así que una republicación con otra
# geometría no hereda fusiones corridas.

.maaf_es_nota <- function(celdas_fila) {
  con_texto <- which(nzchar(celdas_fila))
  if (length(con_texto) != 1L || con_texto != 1L) return(FALSE)
  primera <- celdas_fila[[1L]]
  !(primera %in% .maaf_TITULOS_BLOQUE) && !(primera %in% .maaf_CABECERAS_TABLA) &&
    nchar(primera, type = "chars") > .maaf_NOTA_DETECTAR_CHARS
}

.maaf_nota_requests <- function(sheet_id, m) {
  n_filas <- nrow(m)
  n_cols <- ncol(m)
  if (!n_filas) return(list())
  # Los caracteres por línea salen de los anchos que esta misma hoja pide
  # (~7,2 px por carácter); así el alto sigue al ancho real, no a una constante.
  chars_por_linea <- max(20L, as.integer(floor(sum(.maaf_anchos_px(m)) / 7.2)))
  requests <- list()
  for (i in seq_len(n_filas)) {
    if (!.maaf_es_nota(m[i, ])) next
    rango <- list(
      sheetId = sheet_id,
      startRowIndex = as.integer(i - 1L), endRowIndex = as.integer(i),
      startColumnIndex = 0L, endColumnIndex = as.integer(n_cols)
    )
    requests[[length(requests) + 1L]] <- list(mergeCells = list(range = rango, mergeType = "MERGE_ALL"))
    requests[[length(requests) + 1L]] <- list(repeatCell = list(
      range = rango,
      cell = list(userEnteredFormat = list(
        wrapStrategy = "WRAP",
        verticalAlignment = "TOP",
        textFormat = list(foregroundColor = .monitoreo_sheets_rgb("#5B6472"))
      )),
      fields = "userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)"
    ))
    lineas <- max(1L, ceiling(nchar(m[i, 1L], type = "chars") / chars_por_linea))
    requests[[length(requests) + 1L]] <- .maaf_alto_fila(sheet_id, i, 21L * lineas + 4L)
  }
  requests
}
