# La hoja de indicadores del libro: «Avance de campo».
#
# Se llamaba «Cómo va el campo» hasta A13a (2026-08-31); Gonzalo, textual:
# «noto mucha jerga […] no, es AVANCE» — la app y el Sheets hablan en registro
# académico.
#
# Gonzalo la pidio asi: «podria tener una pestaña u hoja con indicadores, pero
# deben ser indicadores UTILES para el campo y para el analista, como la
# produccion, el avance diario, como vamos con la meta».
#
# **Es una hoja que no se llena, como las dos que se retiraron, y la diferencia
# esta en el contenido.** «Resumen» contaba lo que ya se sabia al planificar
# —cuantas aulas hay, como se reparten por facultad—; esto cuenta lo que cambia
# mientras el campo corre. Un numero que no se mueve de un dia para otro no
# tiene sitio aqui.
#
# Los dos lectores tienen preguntas distintas y las dos caben:
#   · el campo quiere saber **a quien empujar** —que aplicador rinde, que aulas
#     siguen sin cerrar, cuantas quedan—;
#   · el analista quiere saber **si se llega** —cuanto falta para la meta y a
#     que ritmo—.
#
# La produccion diaria sale de las RESPUESTAS, no de los partes: la fecha del
# parte dice cuando se aplico el aula, y la de la respuesta cuando entro la
# encuesta. Para «cuanto se produjo el martes» manda la segunda.

.cai_txt <- function(x) {
  v <- x
  if (is.null(v) || !length(v)) return("")
  trimws(as.character(v)[1])
}

.cai_num <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA))
  if (!length(v) || !is.finite(v[1])) NA_real_ else v[1]
}

#' Indicadores de campo del libro.
#'
#' @param unidades filas del plan.
#' @param efectivas vector con nombre: efectivas por codigo operativo.
#' @param responses `data.frame` de respuestas, para la serie diaria.
#' @param validas vector logico por fila de `responses`: cuales son efectivas.
#'   Sin el, la serie contaria TODAS las respuestas y no cuadraria con la meta.
#' @param partes partes de campo, para la produccion por aplicador.
#' @param asignados `codigo -> aplicador` del reparto vigente.
#' @param extras banco de extras sin activar, para las aulas adicionales.
#' @return lista con las CINCO tablas dictadas —`general`, `facultades`,
#'   `rendimiento`, `aplicadores`, `diario`— más `meta`, el bloque de escalares
#'   que sobrevive para el tablero y para el respaldo sin cuotas del diseño.
#'   Los conteos de personas salen ENTEROS del modelo; las tasas conservan su
#'   decimal y viajan como PROPORCIÓN (0–1), nunca como texto con «%»: el
#'   porcentaje es formato de celda en los dos renderers.
#' @export
aulas_libro_indicadores <- function(unidades, efectivas = NULL, responses = NULL,
                                    partes = list(), validas = NULL,
                                    cuotas = NULL, cfg = list(),
                                    # `codigo -> aplicador` del reparto: sin él,
                                    # la producción por aplicador sólo puede
                                    # hablar de quien ya rindió parte.
                                    asignados = NULL,
                                    # El banco de extras SIN activar
                                    # (`aulas_libro_extras_banco()`), para poder
                                    # contar las aulas adicionales que el equipo
                                    # ya pidió y agendó aunque todavía no las
                                    # haya aplicado.
                                    extras = list()) {
  titulares <- Filter(function(u) identical(.cai_txt(u$sample_role), "titular"), unidades)
  metas <- vapply(titulares, function(u) .cai_num(u$expected_valid), numeric(1))

  # **Los conteos de personas salen ENTEROS del modelo** (A9-B6, checklist
  # 2026-08-31). `expected_valid` llega fraccionario del calculo (eligible_n x
  # rendimiento x factor) y el libro decia «Encuestas de la meta | 3157.8»:
  # media encuesta no existe. Se redondea AQUI y no en los formateadores para
  # que el xlsx y la pestaña de Sheets hereden el mismo numero sin repetir la
  # regla —y su direccion, que es por cifra— en cada renderer:
  #   · la META al entero mas proximo, mitades hacia ARRIBA: floor(x + 0.5).
  #     NO round(): el de R es banquero y round(3158.5) da 3158;
  #   · lo CONSEGUIDO hacia abajo: no se declara cubierto lo que no se consiguio;
  #   · lo que FALTA hacia arriba, y mas abajo se dice desde que valor.
  # Los BRUTOS se conservan para las tasas y para las restas direccionales.
  meta_bruta <- sum(metas[is.finite(metas)])
  logrado_bruto <- if (is.null(efectivas)) NA_real_ else sum(efectivas, na.rm = TRUE)
  meta_total <- if (is.finite(meta_bruta)) floor(meta_bruta + 0.5) else meta_bruta
  logrado <- if (is.finite(logrado_bruto)) floor(logrado_bruto) else logrado_bruto

  # Cuantas aulas ya llegaron a SU meta, que no es lo mismo que el total: se
  # puede ir al 90 % global con la mitad de las aulas sin cerrar.
  cerradas <- if (is.null(efectivas)) NA_integer_ else sum(vapply(titulares, function(u) {
    m <- .cai_num(u$expected_valid)
    i <- match(.cai_txt(u$operational_code), names(efectivas))
    e <- if (is.na(i)) 0 else efectivas[[i]]
    isTRUE(is.finite(m) && m > 0 && e >= m)
  }, logical(1)))

  meta <- list(
    aulas = length(titulares),
    meta_total = meta_total,
    logrado = logrado,
    # Un 0 de 0 no es 0 %. La tasa se calcula con los BRUTOS: es un promedio,
    # no un conteo, y la regla de enteros no la alcanza.
    avance = if (is.finite(meta_bruta) && meta_bruta > 0 && is.finite(logrado_bruto)) {
      logrado_bruto / meta_bruta
    } else NA_real_,
    # La falta sube al entero desde los BRUTOS, no restando los redondeados:
    # con meta 10.4 y logrado 3.2 faltan 7.2 -> 8, y el 10 - 3 = 7 de los
    # redondeados sub-declara — con 7 no se cierra. El precio es que alguna vez
    # logrado + falta != meta_total en la hoja, y se paga: la regla congelada
    # es no decirle al campo que falta menos de lo que falta.
    falta = if (is.finite(meta_bruta) && is.finite(logrado_bruto)) {
      ceiling(max(0, meta_bruta - logrado_bruto))
    } else NA_real_,
    aulas_cerradas = cerradas
  )

  # **El corte por facultad y por sexo**: la cuota no se compensa entre celdas
  # (ADR 0079), así que un avance global sano puede esconder facultades cortas.
  # Vive en `carga_aulas_libro_avance_facultad.R`.
  facultades <- .calaf_avance_por_facultad(
    unidades, efectivas = efectivas, cuotas = cuotas,
    responses = responses, validas = validas, cfg = cfg, partes = partes
  )

  # **LAS CINCO TABLAS DICTADAS** (Gonzalo, 2026-09-08). Cada una vive en su
  # archivo, y las cinco comparten el vocabulario de
  # `carga_aulas_libro_avance_columnas.R`: los dos renderers —el xlsx imperativo
  # y la pestaña de Sheets— leen de ahí sus rótulos y su naturaleza, así que no
  # hay una segunda lista de nombres que pueda separarse de la primera.
  rendimiento <- .calar_rendimiento_por_facultad(
    unidades, efectivas = efectivas, partes = partes, extras = extras,
    # Las metas y el reparto por sexo llegan de los MISMOS insumos que la tabla
    # por facultad, para que las dos tablas no puedan decir dos metas distintas.
    cuotas = cuotas, responses = responses, cfg = cfg)
  aplicadores <- .calaa_produccion_por_aplicador(
    unidades, efectivas = efectivas, partes = partes, asignados = asignados)
  diario <- .calad_avance_diario(
    unidades, responses = responses, validas = validas, cuotas = cuotas, cfg = cfg)

  # Las tres cifras de AULAS que preside «Avance general». No se derivan de la
  # cuota —la tabla por facultad sólo conoce las aplicadas— así que se cuentan
  # aquí, con la definición única de aplicada y con el reparto vigente.
  aplicadas <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  codigos_del_plan <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  aulas_conteo <- list(
    aplicadas = sum(aplicadas),
    # ASIGNADAS son las que tienen aplicador en el reparto vigente, no las
    # agendadas: un aula puede tener fecha y hora y no tener todavía a nadie que
    # la lleve, y ésa es justo la que hay que ver. Sin reparto cargado la celda
    # calla en vez de decir cero, que se leería como «nadie tiene nada».
    asignadas = if (length(asignados %||% list())) {
      sum(codigos_del_plan %in% names(asignados))
    } else NA_real_,
    planificadas = length(titulares)
  )

  list(meta = meta, diario = diario, aplicadores = aplicadores,
       facultades = facultades, rendimiento = rendimiento,
       general = .calag_tabla_general(facultades, aulas_conteo))
}

#' Por que no hay avance diario, en una frase.
#'
#' Un «—» dice que falta el dato; no dice que hacer. Las dos causas piden cosas
#' distintas: sin base de respuestas hay que cargarla, y con base pero sin
#' fechas legibles el problema esta en la columna de fecha del formulario.
# S11 (loop estética, 2026-09-07): la frase del vacío del bloque de
# aplicadores, UNA para el xlsx y el Sheets. El Sheets ya la escribía (C3: la
# sección no desaparece, dice por qué está vacía) y el xlsx omitía el bloque
# entero: dos hojas del mismo modelo con dos respuestas a la misma pregunta.
.cali_motivo_sin_aplicadores <- function() {
  "Sin partes de campo registrados: todavía no hay producción por aplicador que mostrar."
}

.cali_motivo_sin_diario <- function(ind) {
  m <- ind$meta %||% list()
  if (is.null(m$logrado) || !length(m$logrado) || !is.finite(suppressWarnings(as.numeric(m$logrado)))) {
    return("Todavia no hay base de respuestas cargada, asi que no hay efectivas por dia que seguir.")
  }
  "Las respuestas no traen fecha legible, asi que no se puede repartir el avance por dia."
}

# S10 (loop estética, 2026-09-07): la marca de lectura del libro se escribe
# en hora local legible («07/09/2026 15:41»), no en el ISO UTC del estado
# («2026-09-07T20:41:36Z»): quien lee el libro lee horas de Lima. Lo que no es
# una marca ISO —«Ninguna: sale sólo del plan», vacío— se deja como llegó. El
# huso es el del equipo que genera; `tz` existe para que el test no dependa de
# la máquina.
.cai_marca_local <- function(x, tz = Sys.timezone()) {
  x <- as.character(x %||% "")[1]
  if (is.na(x)) x <- ""
  if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?Z$", x)) return(x)
  if (is.null(tz) || is.na(tz) || !nzchar(tz)) tz <- "UTC"
  marca <- suppressWarnings(as.POSIXct(x, tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ"))
  if (is.na(marca)) marca <- suppressWarnings(as.POSIXct(x, tz = "UTC", format = "%Y-%m-%dT%H:%MZ"))
  if (is.na(marca)) return(x)
  format(marca, "%d/%m/%Y %H:%M", tz = tz)
}

# S2 (loop estética, 2026-09-07): una NOTA es texto corrido en la columna A.
# Sin fusionar, Excel la deja derramarse sobre las celdas vacías de al lado y
# Sheets la corta en la primera ocupada: en los dos casos sobresale de su
# tabla y no se lee como parte del bloque. Aquí se fusiona a lo ancho de la
# hoja, baja de línea y su fila crece lo que el texto necesita.
#
# Los caracteres que caben por línea salen de los anchos que fija esta misma
# hoja al final: A = 34 caracteres y el resto 16, que es lo que `setColWidths`
# pide al cierre de `aulas_libro_escribir_indicadores`. Si esos anchos cambian,
# cambia aquí el reparto, no el mecanismo.
.cai_chars_por_linea <- function(n_hoja) {
  n_hoja <- max(1L, as.integer(n_hoja))
  34L + 16L * (n_hoja - 1L)
}

.cai_nota <- function(wb, hoja, fila, texto, estilo, n_hoja) {
  texto <- as.character(texto %||% "")[1]
  if (is.na(texto)) texto <- ""
  openxlsx::writeData(wb, hoja, texto, startCol = 1, startRow = fila)
  openxlsx::mergeCells(wb, hoja, cols = seq_len(n_hoja), rows = fila)
  openxlsx::addStyle(wb, hoja, estilo, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
  lineas <- max(1L, ceiling(nchar(texto, type = "chars") / .cai_chars_por_linea(n_hoja)))
  openxlsx::setRowHeights(wb, hoja, rows = fila, heights = 15 * lineas + 2)
  invisible(fila)
}

# S4 (loop estética, 2026-09-07): la celda sin dato de una tabla se declara.
# `writeData` deja en blanco los NA de un data.frame, y en el libro real 19 de
# 24 aplicadores sin parte tenían «Encuestas aplicadas (parte)» vacía: la fila quedaba
# con un hueco en medio que se lee como olvido. Se escribe «—» (el vocabulario
# del bloque de meta y de la procedencia: sin dato ≠ cero) celda a celda,
# después de la tabla, para que las cifras sigan siendo números.
.cai_rayas <- function(wb, hoja, tabla, fila_cabecera, estilo) {
  if (!is.data.frame(tabla) || !nrow(tabla)) return(invisible(NULL))
  for (j in seq_along(tabla)) {
    columna <- tabla[[j]]
    if (!is.numeric(columna)) next
    huecos <- which(!is.finite(columna))
    for (i in huecos) {
      openxlsx::writeData(wb, hoja, "\u2014", startCol = j, startRow = fila_cabecera + i)
      openxlsx::addStyle(wb, hoja, estilo, rows = fila_cabecera + i, cols = j, stack = TRUE)
    }
  }
  invisible(NULL)
}

# S3: el ancho de la hoja lo fija su tabla más ancha (hoy la de facultades,
# doce columnas), y TODAS las bandas de sección lo cubren. Medido antes: la
# banda de «Avance contra la meta» iba con `cols = 1:2` y la de procedencia
# igual, sobre una hoja de doce; el subrayado se cortaba a la mitad y no se
# veía dónde terminaba cada bloque. Las cabeceras de tabla siguen al ancho de
# SU tabla: rotulan columnas, no separan bloques.
.cai_ancho_hoja <- function(ind) {
  ind <- if (is.list(ind)) ind else list()
  ancho_de <- function(df) if (is.data.frame(df) && nrow(df)) ncol(df) else 0L
  max(2L, 4L, vapply(AULAS_AVANCE_CAMPOS, function(k) ancho_de(ind[[k]]), integer(1)))
}

# --- El SEMÁFORO de la hoja, el mismo criterio en los dos renderers -----------
#
# Dictado de Gonzalo (2026-09-08): «las diferencias positivas (nos fue mejor de
# lo esperado) deben estar pintadas en escalas de verde y en los que la
# diferencia sea negativa que vayan en escalas de rojo. Por el lado de la meta,
# cuando la celda llegue a la meta debe pintarse de verde, y cuando llegue a la
# sobremuestra que se pinte de azul o celeste».
#
# **Qué celda se pinta lo decide el RÓTULO, no la posición**, y la clasificación
# vive en el vocabulario compartido: aquí se traduce a reglas de openxlsx y en
# `monitoreo_aulas_avance_formato.R` a `addConditionalFormatRule` de la API de
# Sheets. Dos motores, una sola respuesta a «¿esta celda ya llegó?».
#
# El tono es CLARO a propósito: la regla de color ayuda a barrer la tabla de un
# vistazo, pero el dato es el número, y un fondo saturado lo tapa (ya pasó con
# las databar en navy del PDF).
.CAI_VERDE_META <- "#D6EBD6"
.CAI_CELESTE_SOBRE <- "#D8E7F8"
.CAI_ESCALA_DIF <- c("#E9A8A8", "#FFFFFF", "#A9D5A9")
.CAI_NEUTRO_AVANCE <- "#EFF2F6"

.cai_semaforo <- function(wb, hoja, tabla, cabecera_en, traspuesta = FALSE) {
  if (!is.data.frame(tabla) || !nrow(tabla)) return(invisible(NULL))
  n <- nrow(tabla)
  verde <- openxlsx::createStyle(bgFill = .CAI_VERDE_META)
  celeste <- openxlsx::createStyle(bgFill = .CAI_CELESTE_SOBRE)

  # Un rango de la tabla: en la traspuesta es una FILA (columnas de datos), en
  # las demás una COLUMNA (filas de datos).
  pintar <- function(k, tipo, ...) {
    if (traspuesta) {
      openxlsx::conditionalFormatting(
        wb, hoja, cols = 2:ncol(tabla), rows = cabecera_en + k, type = tipo, ...)
    } else {
      openxlsx::conditionalFormatting(
        wb, hoja, cols = k, rows = (cabecera_en + 1L):(cabecera_en + n), type = tipo, ...)
    }
  }
  # Los valores del rango, para poder fijar la escala de la diferencia con un
  # cero en el medio: la escala automática de openxlsx pone el punto medio en la
  # mediana, y entonces «peor que lo esperado» puede salir verde.
  valores_de <- function(k) {
    v <- if (traspuesta) {
      suppressWarnings(as.numeric(unlist(tabla[k, -1L], use.names = FALSE)))
    } else {
      suppressWarnings(as.numeric(tabla[[k]]))
    }
    v[is.finite(v)]
  }

  rotulos <- if (traspuesta) as.character(tabla[[1L]]) else names(tabla)
  for (k in seq_along(rotulos)) {
    if (!traspuesta && k == 1L) next
    r <- trimws(rotulos[[k]])
    if (r %in% AULAS_AVANCE_DIFERENCIAS) {
      v <- valores_de(k)
      tope <- if (length(v)) max(abs(v)) else 0
      if (tope > 0) {
        pintar(k, "colourScale", style = .CAI_ESCALA_DIF, rule = c(-tope, 0, tope))
      }
      next
    }
    if (r %in% AULAS_AVANCE_FALTAN_MUESTRA) {
      # Cero faltantes = esta celda ya cubrió su meta.
      pintar(k, "expression", rule = "==0", style = verde)
      next
    }
    if (r %in% AULAS_AVANCE_FALTAN_SOBREMUESTRA) {
      pintar(k, "expression", rule = "==0", style = celeste)
      next
    }
    if (r %in% AULAS_AVANCE_AVANCES) {
      # Un depósito que se llena, no un veredicto: la escala va de vacío a
      # verde entre 0 y 1, y al pasarse del 100 % la celda va celeste. Sin
      # rojo — un avance bajo el día 2 es el día 2, no un fracaso.
      pintar(k, "colourScale",
             style = c(.CAI_NEUTRO_AVANCE, .CAI_VERDE_META), rule = c(0, 1))
      pintar(k, "expression", rule = ">=1", style = celeste)
    }
  }
  invisible(NULL)
}

aulas_libro_escribir_indicadores <- function(wb, ind, hoja = "Avance de campo",
                                             procedencia = NULL) {
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)

  titulo <- openxlsx::createStyle(fontSize = 16, textDecoration = "bold",
                                  fontColour = "#002457")
  pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472")
  seccion <- openxlsx::createStyle(fontSize = 11, textDecoration = "bold",
                                   fontColour = "#002457", border = "bottom",
                                   borderColour = "#C7D0DD")
  etiqueta <- openxlsx::createStyle(fontColour = "#5B6472")
  n_hoja <- .cai_ancho_hoja(ind)
  # S2: las notas bajan de línea dentro de su fusión y se leen desde arriba.
  nota <- openxlsx::createStyle(fontColour = "#5B6472", wrapText = TRUE, valign = "top")
  nota_pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472", wrapText = TRUE,
                                    valign = "top")
  # S4: el «—» de una celda sin dato, alineado como la cifra que no está.
  sin_dato_celda <- openxlsx::createStyle(halign = "right", fontColour = "#5B6472")
  rejilla <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#3C4149")
  derecha <- openxlsx::createStyle(halign = "right")
  total_fila <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                                      border = "top", borderColour = "#C7D0DD",
                                      numFmt = "#,##0")
  # Las columnas de conteo son enteras por definición —muestra, conseguidas,
  # aulas, faltan— así que van sin parte decimal: el `.#` sólo aportaba la coma
  # colgando que Gonzalo vio publicada («174,»).
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left")
  # El porcentaje es FORMATO DE CELDA, nunca un «(%)» en el rótulo (Gonzalo,
  # 2026-09-08). Un decimal: la diferencia entre 19,2 % y 19 % se mira todos los
  # días y la de 19,24 % no la mira nadie.
  porcentaje <- openxlsx::createStyle(halign = "right", numFmt = "0.0%")
  cabecera_partida <- openxlsx::createStyle(wrapText = TRUE, valign = "bottom",
                                            halign = "center")

  openxlsx::writeData(wb, hoja, "Avance de campo", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, hoja, paste("Al", format(Sys.Date(), "%d/%m/%Y")),
                      startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  fila <- 4L

  # **Una sola rutina escribe las cinco tablas.** Antes había cinco bloques
  # copiados con sus estilos, y cada vez que una tabla ganaba una columna había
  # que acordarse de los otros cuatro: así es como «Techo con sobremuestra» se
  # coló delante de «Avance» y la hoja salió con 188 aulas pintadas como
  # «18800,0 %». Qué columna es porcentaje, cuál es diferencia y cuál se pinta al
  # llegar a la meta lo decide el VOCABULARIO por el nombre del rótulo
  # (`carga_aulas_libro_avance_columnas.R`), que es el mismo que lee el Sheets.
  escribir_tabla <- function(clave, tabla, nota_arriba = NULL,
                             nota_abajo = NULL, vacio = NULL, con_total = FALSE) {
    titulo_bloque <- AULAS_AVANCE_TITULOS[[clave]]
    openxlsx::writeData(wb, hoja, titulo_bloque, startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <<- fila + 1L
    # C3: la sección no desaparece cuando no hay datos, dice por qué está vacía.
    if (!is.data.frame(tabla) || !nrow(tabla)) {
      if (!is.null(vacio)) {
        .cai_nota(wb, hoja, fila, vacio, nota, n_hoja)
        fila <<- fila + 2L
      } else {
        fila <<- fila + 1L
      }
      return(invisible(NULL))
    }
    if (!is.null(nota_arriba)) {
      .cai_nota(wb, hoja, fila, nota_arriba, nota, n_hoja)
      fila <<- fila + 1L
    }
    # **El VALOR se redondea, no sólo su formato.** Una tasa llega como
    # 0.266666666666667 y el numFmt tapa la cola en pantalla; basta que alguien
    # cambie el formato de la celda, la copie o la sume para que el ruido salga.
    # Cuatro decimales en las proporciones (el porcentaje se muestra con uno) y
    # dos en lo demás fraccionario; los conteos ya llegan enteros del modelo.
    # En «Avance general» la naturaleza es de la FILA y en las demás de la
    # COLUMNA; redondear por columna y volver a redondear por fila dejaba el
    # 26,67 % en 0.27 y el porcentaje salía «27,0 %».
    if (identical(clave, "general")) {
      pct <- vapply(as.character(tabla[[1L]]), .calac_es_proporcion,
                    logical(1), tabla = clave, USE.NAMES = FALSE)
      for (k in names(tabla)[-1L]) {
        if (!is.numeric(tabla[[k]])) next
        tabla[[k]] <- ifelse(pct, round(tabla[[k]], 4L), round(tabla[[k]], 2L))
      }
    } else {
      for (k in names(tabla)) {
        if (!is.numeric(tabla[[k]])) next
        tabla[[k]] <- round(tabla[[k]], if (.calac_es_proporcion(k, clave)) 4L else 2L)
      }
    }
    nombres <- names(tabla)
    n_col <- length(nombres)
    n <- nrow(tabla)
    cabecera_en <- fila
    openxlsx::writeData(wb, hoja, tabla, startCol = 1, startRow = cabecera_en)
    .cai_rayas(wb, hoja, tabla, cabecera_en, sin_dato_celda)
    openxlsx::addStyle(wb, hoja, cabecera, rows = cabecera_en, cols = seq_len(n_col),
                       gridExpand = TRUE)
    # Una cabecera de treinta caracteres en una columna de quince se PARTE; no
    # se corta. «Faltantes mujeres sobremuestra» a medias obliga a contar
    # posiciones para saber qué se está leyendo.
    openxlsx::addStyle(wb, hoja, cabecera_partida, rows = cabecera_en,
                       cols = seq_len(n_col), gridExpand = TRUE, stack = TRUE)
    openxlsx::setRowHeights(wb, hoja, rows = cabecera_en, heights = 45)

    # **Por NOMBRE de columna, nunca por índice.** Un índice fijo es una
    # dependencia invisible con el orden de las columnas: quien las añade no
    # tiene forma de saber que existe.
    es_pct <- vapply(nombres, .calac_es_proporcion, logical(1), tabla = clave)
    # La primera columna de una tabla traspuesta («Avance general») son rótulos,
    # y su naturaleza se decide por FILA. En las demás, la primera es texto.
    traspuesta <- identical(nombres, AULAS_AVANCE_CABECERAS$general)
    cols_datos <- seq_len(n_col)[-1L]
    if (traspuesta) {
      pct_fila <- vapply(as.character(tabla[[1L]]), .calac_es_proporcion,
                         logical(1), tabla = clave, USE.NAMES = FALSE)
      for (i in seq_len(n)) {
        openxlsx::addStyle(wb, hoja, if (pct_fila[[i]]) porcentaje else numero,
                           rows = cabecera_en + i, cols = cols_datos,
                           gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, etiqueta, rows = cabecera_en + i, cols = 1)
      }
    } else {
      texto <- vapply(nombres, function(k) is.character(tabla[[k]]), logical(1))
      cols_pct <- which(es_pct & !texto)
      cols_num <- setdiff(which(!texto), cols_pct)
      if (length(cols_num)) {
        openxlsx::addStyle(wb, hoja, numero, rows = (cabecera_en + 1L):(cabecera_en + n),
                           cols = cols_num, gridExpand = TRUE, stack = TRUE)
      }
      if (length(cols_pct)) {
        openxlsx::addStyle(wb, hoja, porcentaje, rows = (cabecera_en + 1L):(cabecera_en + n),
                           cols = cols_pct, gridExpand = TRUE, stack = TRUE)
      }
    }
    ultima <- cabecera_en + n
    if (isTRUE(con_total)) {
      total <- .calaf_fila_total(tabla)
      if (!is.null(total)) {
        ultima <- ultima + 1L
        openxlsx::writeData(wb, hoja, total, startCol = 1, startRow = ultima, colNames = FALSE)
        .cai_rayas(wb, hoja, total, ultima - 1L, sin_dato_celda)
        openxlsx::addStyle(wb, hoja, total_fila, rows = ultima, cols = seq_len(n_col),
                           gridExpand = TRUE)
      }
    }
    # Bordes en toda la tabla, cabecera incluida: sin ellos diecisiete columnas
    # se leen como una lista de números sueltos. Gonzalo: «todas las tres
    # primeras hojas debería tener bordes negros sus tablas».
    openxlsx::addStyle(wb, hoja, rejilla, rows = cabecera_en:ultima,
                       cols = seq_len(n_col), gridExpand = TRUE, stack = TRUE)
    # El COLOR que sigue al valor (Gonzalo, 2026-09-08): diferencia positiva en
    # verde y negativa en rojo; celda que llegó a la meta en verde y a la
    # sobremuestra en celeste. En el xlsx son reglas de openxlsx sobre el rango
    # de la columna; en el Sheets, `addConditionalFormatRule` — dos motores, la
    # misma clasificación por rótulo.
    .cai_semaforo(wb, hoja, tabla, cabecera_en, traspuesta)
    fila <<- ultima + 2L
    if (!is.null(nota_abajo)) {
      .cai_nota(wb, hoja, fila - 1L, nota_abajo, nota, n_hoja)
      fila <<- fila + 1L
    }
    invisible(NULL)
  }

  # --- 1. AVANCE GENERAL ------------------------------------------------------
  # Sin cuotas del diseño no hay tabla que derivar (la cuota no se reconstruye):
  # queda el bloque de siempre, etiqueta|valor, que es lo único computable.
  if (is.data.frame(ind$general) && nrow(ind$general)) {
    escribir_tabla(
      "general", ind$general,
      nota_arriba = .calam_titular(ind$facultades)
    )
  } else {
    m <- ind$meta %||% list()
    openxlsx::writeData(wb, hoja, AULAS_AVANCE_TITULOS[["general"]], startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    sin_dato <- 0L
    for (f in list(list("Encuestas de la meta", m$meta_total, numero),
                   list("Efectivas conseguidas", m$logrado, numero),
                   list("Avance", m$avance, porcentaje),
                   list("Faltan", m$falta, numero),
                   list("Aulas del operativo", m$aulas, numero))) {
      openxlsx::writeData(wb, hoja, f[[1]], startCol = 1, startRow = fila)
      valor <- suppressWarnings(as.numeric(f[[2]] %||% NA))[1]
      if (!length(valor) || !is.finite(valor)) {
        sin_dato <- sin_dato + 1L
        openxlsx::writeData(wb, hoja, "—", startCol = 2, startRow = fila)
        openxlsx::addStyle(wb, hoja, sin_dato_celda, rows = fila, cols = 2)
      } else {
        openxlsx::writeData(wb, hoja, round(valor, 4), startCol = 2, startRow = fila)
        openxlsx::addStyle(wb, hoja, f[[3]], rows = fila, cols = 2)
      }
      openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
      fila <- fila + 1L
    }
    if (sin_dato) {
      .cai_nota(
        wb, hoja, fila,
        "Estas cifras salen de la plataforma, no del parte de campo: se llenan al cargar la base de respuestas.",
        nota, n_hoja
      )
      fila <- fila + 1L
    }
    fila <- fila + 1L
  }

  # --- 2. AVANCE POR FACULTAD -------------------------------------------------
  # Va ANTES que la producción por aplicador: es la tabla que el cliente lee, y
  # la cuota es por facultad. La producción dice a quién empujar; esto dice si
  # el estudio cierra.
  if (is.data.frame(ind$facultades) && nrow(ind$facultades)) {
    escribir_tabla(
      "facultad", ind$facultades,
      nota_arriba = "La cuota es de cada facultad y de cada sexo: pasarse en una no cubre lo que falta en otra.",
      nota_abajo = .calaf_nota_metas(ind$facultades),
      con_total = TRUE
    )
  }

  # --- 3. RENDIMIENTO POR FACULTAD --------------------------------------------
  escribir_tabla(
    "rendimiento", ind$rendimiento,
    nota_arriba = paste(
      "Las tasas se miden sobre los elegibles de las aulas ya aplicadas. Las",
      "efectivas esperadas son esos elegibles por la tasa que el diseño le puso a",
      "la facultad: cuántas fichas debían salir de las aulas a las que ya se fue.",
      "El plan no trae elegibles por sexo, así que la esperada de hombres y la de",
      "mujeres se reparten con la misma proporción con la que el diseño repartió",
      "la cuota de esa facultad."
    ),
    vacio = "El plan todavía no trae facultades con aulas que medir."
  )

  # --- 4. PRODUCCIÓN POR APLICADOR --------------------------------------------
  escribir_tabla(
    "aplicador", ind$aplicadores,
    nota_arriba = paste(
      "Una fila por persona en cada facultad. La tasa esperada es la de la",
      "facultad, así que quien cubre dos se mide contra la vara de cada una.",
      "«Fichas faltantes» es lo que sus aulas ya aplicadas rindieron por debajo de",
      "lo esperado. Sobre las que aún no aplica no falta ninguna ficha."
    ),
    vacio = .cali_motivo_sin_aplicadores()
  )

  # --- 5. AVANCE DIARIO -------------------------------------------------------
  escribir_tabla(
    "diario", ind$diario,
    nota_arriba = paste(
      "Una fila por facultad y día. Las efectivas esperadas son la suma de las",
      "metas de los cursos-horario que ya se aplicaron ese día, no de todos los",
      "que estaban agendados: se compara contra lo que se hizo, no contra lo que",
      "falta por hacer."
    ),
    vacio = .cali_motivo_sin_diario(ind)
  )

  # DE DONDE SALIO ESTE LIBRO, dentro del propio libro.
  #
  # El riesgo de la sinergia app <-> Excel no es que la app destruya el archivo
  # del equipo —no lo toca: genera uno nuevo cada vez— sino la DIVERGENCIA:
  # alguien edita su copia, otro genera sin haberla subido, y quedan dos libros
  # sin nada que diga cual esta al dia. Abrir los dos y comparar esta seccion lo
  # resuelve sin adivinar.
  #
  # El dato ya existia y no tenia consumidor dentro del libro: el recibo
  # `monitoreo_aulas_libro` que compone `aulas_libro_importar_en_sesion()`.
  #
  # `importado_en` viene del ESTADO, no del reloj de aqui: dos generaciones del
  # mismo estado escriben lo mismo. (La cabecera de esta hoja si lee
  # `Sys.Date()`, que es anterior a esto y por eso el libro ya cambiaba de un
  # dia para otro.)
  if (is.list(procedencia) && length(procedencia)) {
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "De dónde salió este libro", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    r <- procedencia$resumen %||% list()
    leido <- .cai_marca_local(as.character(procedencia$importado_en %||% "")[1])
    filas_proc <- list(
      list("Última vez que la app leyó un libro lleno",
           if (nzchar(leido)) leido else "Ninguna: sale sólo del plan"),
      list("Aulas que traía esa lectura", r$unidades),
      list("Partes de campo que traía", r$partes_de_campo),
      list("Filas de control que traía", r$filas_de_control)
    )
    for (f in filas_proc) {
      openxlsx::writeData(wb, hoja, f[[1]], startCol = 1, startRow = fila)
      openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
      v <- f[[2]]
      if (is.null(v) || !length(v)) v <- "—"
      openxlsx::writeData(wb, hoja, v[1], startCol = 2, startRow = fila)
      # S12: las cifras con separador de miles como el resto de la hoja; la
      # marca y la raya, alineadas con ellas.
      openxlsx::addStyle(wb, hoja, if (is.numeric(v[1])) numero else derecha, rows = fila, cols = 2)
      fila <- fila + 1L
    }
    # La frase que convierte el dato en una accion: sin esto son cuatro cifras
    # que nadie sabe para que mirar.
    .cai_nota(
      wb, hoja, fila,
      "Si editaste el libro después de esa fecha y no lo subiste, la app todavía no lo sabe.",
      nota_pie, n_hoja
    )
    fila <- fila + 2L
  }

  # La primera columna lleva rótulos y nombres de facultad; las demás, cifras.
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 34)
  openxlsx::setColWidths(wb, hoja, cols = 2:max(4L, .cai_ancho_hoja(ind)), widths = 16)
  openxlsx::pageSetup(wb, hoja, orientation = "portrait", fitToWidth = TRUE,
                      fitToHeight = FALSE)
  invisible(fila)
}
