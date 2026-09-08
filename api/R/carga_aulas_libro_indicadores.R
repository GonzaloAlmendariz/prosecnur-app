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
#' @return lista con `meta`, `diario` y `aplicadores`. Los conteos de personas
#'   (`meta_total`, `logrado`, `falta`, «Falta para la meta» del diario) salen
#'   ENTEROS del modelo; las tasas y promedios (`avance`, «Media por curso-horario»)
#'   conservan su decimal.
#' @export
aulas_libro_indicadores <- function(unidades, efectivas = NULL, responses = NULL,
                                    partes = list(), validas = NULL,
                                    cuotas = NULL, cfg = list(),
                                    # `codigo -> aplicador` del reparto: sin él,
                                    # la producción por aplicador sólo puede
                                    # hablar de quien ya rindió parte.
                                    asignados = NULL) {
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

  # **La serie diaria, con acumulado**: una barra por dia dice cuanto se
  # produjo; el acumulado dice si se llega.
  diario <- NULL
  if (is.data.frame(responses) && nrow(responses)) {
    # Con huso primero: en UTC el avance de un aula de la tarde se anota en la
    # jornada del día siguiente (`monitoreo_aulas_hora_local.R`).
    col <- intersect(MONITOREO_AULAS_COLUMNAS_TIEMPO,
                     names(responses))
    if (length(col)) {
      dias <- substr(as.character(responses[[col[[1]]]]), 1, 10)
      # **Solo las EFECTIVAS.** Contando todas las respuestas, la serie
      # acumulaba 3 700 mientras el logrado eran 2 220, y la columna «falta
      # para la meta» acababa diciendo 47 cuando faltaban 1 527: dos cifras
      # distintas bajo la misma tabla. La meta se mide en efectivas, asi que la
      # serie tambien.
      if (!is.null(validas) && length(validas) == nrow(responses)) {
        dias <- dias[validas %in% TRUE]
      }
      dias <- dias[nzchar(dias) & !is.na(dias)]
      if (length(dias)) {
        t <- table(dias)
        n <- as.integer(t)
        diario <- data.frame(
          Dia = names(t), Respuestas = n, Acumulado = cumsum(n),
          stringsAsFactors = FALSE
        )
        diario$`Efectivas acumuladas` <- diario$Acumulado
        diario$Acumulado <- NULL
        names(diario)[names(diario) == "Respuestas"] <- "Efectivas del dia"
        # Contra la meta BRUTA y hacia arriba: 3157.8 - 4 = 3153.8 respuestas
        # por recoger es 3154 — con 3153 no se cierra. El numFmt del xlsx
        # tapaba el decimal en pantalla, pero el VALOR de la celda quedaba
        # sucio y la pestaña de Sheets (RAW, sin numFmt) lo enseñaba tal cual.
        diario$`Falta para la meta` <- if (is.finite(meta_bruta)) {
          ceiling(pmax(0, meta_bruta - diario$`Efectivas acumuladas`))
        } else NA_real_
      }
    }
  }

  # **Produccion por aplicador**: el campo pregunta a quien empujar.
  #
  # **Y la respuesta salía del parte, que en la primera semana casi no existe.**
  # El 2026-09-07 esta tabla enseñaba UNA fila —«González Rubio · 1 aula · 34
  # efectivas declaradas»— con ocho cursos-horario aplicados y seis aplicadores
  # en la calle. La cuenta del parte es la del aplicador al cerrar; la de la
  # plataforma llega sola y es la que sirve a media jornada.
  #
  # Se publican las dos, una al lado de la otra: la declarada dice lo que el
  # aplicador contó, la de plataforma lo que llegó, y verlas juntas es el
  # control de campo que la hoja existe para dar. La atribución de la de
  # plataforma sale del REPARTO, no del parte, así que un aplicador aparece en
  # cuanto sale a su primera aula.
  aplicadores <- NULL
  quien_parte <- if (length(partes)) {
    vapply(partes, function(p) .cai_txt(p$applied_by %||% p$applicator), character(1))
  } else character(0)
  ef_parte <- if (length(partes)) {
    vapply(partes, function(p) {
      v <- .cai_num(p$effective_surveys); if (is.finite(v)) v else 0
    }, numeric(1))
  } else numeric(0)

  # **Quién es responsable de cada curso-horario**: manda el REPARTO, y si el
  # estudio no lo tiene —no toda operación reparte— manda el parte, que también
  # dice quién aplicó cada uno. Sin ninguno de los dos la tabla sólo puede
  # hablar de la cuenta declarada, que es de donde venía.
  por_aplicador <- list()
  atribuir <- function(cod, k) {
    cod <- .cai_txt(cod); k <- .cai_txt(k)
    if (!nzchar(cod) || !nzchar(k)) return(invisible(NULL))
    if (cod %in% (por_aplicador[[k]] %||% character(0))) return(invisible(NULL))
    por_aplicador[[k]] <<- c(por_aplicador[[k]] %||% character(0), cod)
  }
  for (cod in names(asignados %||% list())) atribuir(cod, asignados[[cod]])
  if (!length(por_aplicador)) {
    for (pt in (partes %||% list())) {
      if (!is.list(pt)) next
      atribuir(pt$operational_code %||% pt$classroom_id, pt$applied_by %||% pt$applicator)
    }
  }

  claves <- sort(unique(c(quien_parte[nzchar(quien_parte)], names(por_aplicador))))
  if (length(claves)) {
    de_plataforma <- function(k) {
      cods <- por_aplicador[[k]] %||% character(0)
      if (!length(cods) || is.null(efectivas)) return(c(aulas = NA_real_, ef = NA_real_))
      v <- suppressWarnings(as.numeric(efectivas[match(cods, names(efectivas))]))
      v[!is.finite(v)] <- 0
      c(aulas = sum(v > 0), ef = sum(v))
    }
    plat <- vapply(claves, de_plataforma, numeric(2))
    aplicadores <- data.frame(
      Aplicador = claves,
      `Cursos-horario asignados` = vapply(claves, function(k)
        length(por_aplicador[[k]] %||% character(0)), integer(1)),
      `Con respuestas` = as.numeric(plat["aulas", ]),
      `Efectivas en plataforma` = as.numeric(plat["ef", ]),
      `Partes rendidos` = vapply(claves, function(k) sum(quien_parte == k), integer(1)),
      # S14b (dictado de Gonzalo 2026-09-07, textual: «las efectivas las da la
      # app no el aplicador, el aplicador ve temas de lo que ve en aulas
      # nomás»): el conteo del parte se llama «Encuestas aplicadas (parte)».
      # Hasta ese día la columna era «Efectivas declaradas». La clave del parte
      # (`effective_surveys`) no cambia.
      `Encuestas aplicadas (parte)` = vapply(claves, function(k) {
        if (!any(quien_parte == k)) NA_real_ else sum(ef_parte[quien_parte == k])
      }, numeric(1)),
      check.names = FALSE, stringsAsFactors = FALSE
    )
    aplicadores$`Media por curso-horario` <- ifelse(
      aplicadores$`Con respuestas` > 0,
      round(aplicadores$`Efectivas en plataforma` / pmax(1, aplicadores$`Con respuestas`), 1),
      NA_real_
    )
    # Por produccion, no alfabetico: se mira primero quien va mas flojo, y quien
    # todavia no tiene ninguna respuesta abre la tabla.
    aplicadores <- aplicadores[order(
      ifelse(is.finite(aplicadores$`Media por curso-horario`),
             aplicadores$`Media por curso-horario`, -1),
      aplicadores$Aplicador
    ), , drop = FALSE]
  }

  # **El corte por facultad y por sexo**: la cuota no se compensa entre celdas
  # (ADR 0079), así que un avance global sano puede esconder facultades cortas.
  # Vive en `carga_aulas_libro_avance_facultad.R`.
  facultades <- .calaf_avance_por_facultad(
    unidades, efectivas = efectivas, cuotas = cuotas,
    responses = responses, validas = validas, cfg = cfg, partes = partes
  )

  list(meta = meta, diario = diario, aplicadores = aplicadores,
       facultades = facultades)
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
# hoja al final (`setColWidths`: A = 34, B–D = 20, el resto 15); si esos anchos
# cambian, cambia aquí el reparto, no el mecanismo.
.cai_chars_por_linea <- function(n_hoja) {
  n_hoja <- max(1L, as.integer(n_hoja))
  34L + 20L * min(3L, n_hoja - 1L) + 15L * max(0L, n_hoja - 4L)
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
  max(2L, 4L, ancho_de(ind$facultades), ancho_de(ind$aplicadores))
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
  # S12: el mismo trato en toda la hoja. La rejilla de la tabla de facultades
  # (`rejilla`) va también en la de aplicadores, y en la procedencia las
  # cifras llevan separador de miles y la marca se alinea con ellas.
  rejilla <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#3C4149")
  derecha <- openxlsx::createStyle(halign = "right")
  # S5: la fila «Total» del avance diario: negrita, cifras a la derecha y una
  # línea encima que la separa de los días.
  total_diario <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                                        border = "top", borderColour = "#C7D0DD",
                                        numFmt = "#,##0")
  # **`#,##0.#` deja la coma colgando en un entero, y casi todo aqui es entero.**
  #
  # El decimal opcional existia para las cifras que llegaban fraccionarias
  # —«3 157,8 encuestas de la meta» salia de una tasa—. Desde A9-B6 los conteos
  # de personas llegan ya ENTEROS del modelo (la regla de redondeo vive en
  # `aulas_libro_indicadores()`), asi que aqui el estilo con decimal queda de
  # red de seguridad para lo fraccionario legitimo. Y la coma: un visor con
  # locale español pinta el punto del formato como coma, y con 174 escribia
  # «174,»: un numero que parece cortado. Gonzalo: «con comas luego de numeros».
  #
  # Asi que hay DOS estilos y cada fila elige el suyo por su valor: entero -> sin
  # parte decimal; fraccionario -> con un decimal. Es lo unico que evita la coma
  # sin perder el decimal donde significa algo.
  cifra <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                                 numFmt = "#,##0.#")
  cifra_entera <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                                        numFmt = "#,##0")
  # Elige el estilo mirando el valor: `18` con `#,##0.#` sale «18,», y `18.4`
  # con `#,##0` sale «18» y pierde el dato.
  estilo_de_cifra <- function(v, entero = cifra_entera, con_decimal = cifra) {
    x <- suppressWarnings(as.numeric(v))
    if (length(x) != 1L || !is.finite(x) || abs(x - round(x)) < 1e-9) entero else con_decimal
  }
  # El VALOR tambien se redondea, no solo su formato: una meta calculada de una
  # tasa llegaba como 541.799999999997 y el formato lo tapaba. Basta que alguien
  # cambie el formato de la celda, la copie o la sume para que el ruido salga.
  # (Los conteos ya llegan enteros del modelo desde A9-B6; esto limpia lo que
  # siga siendo fraccionario legitimo.)
  cifra_limpia <- function(v) {
    x <- suppressWarnings(as.numeric(v))
    if (length(x) != 1L || !is.finite(x)) v else round(x, 1)
  }
  pct <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                               numFmt = "0.0%")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left")
  # Las columnas de conteo de la tabla por facultad son enteras por definicion
  # —muestra, conseguidas, aulas, faltan— asi que van sin parte decimal: aqui el
  # `.#` solo podia aportar la coma colgando.
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0")
  # `#,##0.#` OMITE el cero decimal, asi que en «Media por curso-horario» un 23.0 salia
  # «23» entre 20.5, 21.9 y 23.8: la misma columna con dos formatos, y el ojo lo
  # lee como si ese equipo tuviera una cifra mas redonda que los demas. Visto en
  # el PDF. Las columnas de conteo se quedan con `numero` —«26.0 aulas» seria
  # ruido—; solo la media, que es un promedio, declara su decimal.
  promedio <- openxlsx::createStyle(halign = "right", numFmt = "#,##0.0")
  # El porcentaje de una FILA de tabla, sin negrita: `pct` la lleva porque es
  # la cifra grande del bloque de meta, y en una columna de veinte filas la
  # negrita deja de destacar y sólo pesa.
  porcentaje <- openxlsx::createStyle(halign = "right", numFmt = "0.0%")

  openxlsx::writeData(wb, hoja, "Avance de campo", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, hoja, paste("Al", format(Sys.Date(), "%d/%m/%Y")),
                      startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  m <- ind$meta %||% list()
  fila <- 4L
  openxlsx::writeData(wb, hoja, "Avance contra la meta", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
  fila <- fila + 1L
  # El porcentaje va con su estilo propio: escrito como cifra saldria «0.6».
  filas_meta <- list(
    list("Encuestas de la meta", cifra_limpia(m$meta_total), estilo_de_cifra(m$meta_total)),
    list("Efectivas conseguidas", cifra_limpia(m$logrado), estilo_de_cifra(m$logrado)),
    list("Avance", m$avance, pct),
    list("Faltan", cifra_limpia(m$falta), estilo_de_cifra(m$falta)),
    # Que la suma vaya al 59 % no dice cuantas aulas quedan por cerrar: se puede
    # ir alto con la mitad de las aulas a medias.
    list("Aulas que llegaron a SU meta", cifra_limpia(m$aulas_cerradas), estilo_de_cifra(m$aulas_cerradas)),
    list("Aulas del operativo", cifra_limpia(m$aulas), estilo_de_cifra(m$aulas))
  )
  sin_dato <- 0L
  for (f in filas_meta) {
    openxlsx::writeData(wb, hoja, f[[1]], startCol = 1, startRow = fila)
    valor <- f[[2]]
    if (is.null(valor) || !length(valor) || !is.finite(suppressWarnings(as.numeric(valor)))) {
      # Sin respuestas leidas todavia no hay avance que dar, y un 0 diria que
      # se lleva cero.
      sin_dato <- sin_dato + 1L
      openxlsx::writeData(wb, hoja, "—", startCol = 2, startRow = fila)
    } else {
      openxlsx::writeData(wb, hoja, as.numeric(valor), startCol = 2, startRow = fila)
      openxlsx::addStyle(wb, hoja, f[[3]], rows = fila, cols = 2)
    }
    openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
    fila <- fila + 1L
  }

  # **Un «—» dice que falta, no de donde saldria.** Y en esta hoja el hueco se
  # lee peor todavia: dos bloques mas abajo hay 3 508 «efectivas declaradas»
  # sumadas por aplicador, asi que la misma pagina parece decir que no hay
  # efectivas y listarlas. No se contradicen —una sale de PLATAFORMA y la otra
  # de lo que el equipo escribio en su parte— pero sin decirlo, quien lee elige
  # cual creer. Esta nota solo aparece cuando de verdad hay huecos; el caso
  # contrario —las DOS familias presentes, que es cuando de verdad chocan— lo
  # cubre el puente de abajo (B7.3, `carga_aulas_libro_puente.R`), que ademas
  # decide solo: con plataforma completa pero sin partes no hay choque y no
  # escribe nada.
  if (sin_dato) {
    .cai_nota(
      wb, hoja, fila,
      "Estas cifras salen de la plataforma, no del parte de campo: se llenan al cargar la base de respuestas.",
      nota, n_hoja
    )
    fila <- fila + 1L
  }
  # Fila propia de ancho completo tras el bloque de meta, NUNCA una celda extra
  # dentro de una fila etiqueta|valor: las adyacencias col+1 estan pineadas.
  puente <- .calap_puente_con_datos(sin_dato, ind$aplicadores)
  if (!is.null(puente)) {
    .cai_nota(wb, hoja, fila, puente, nota, n_hoja)
    fila <- fila + 1L
  }

  # **El avance por facultad va ANTES que la producción por aplicador**: es la
  # tabla que el cliente lee, y la cuota es por facultad. La producción dice a
  # quién empujar; esto dice si el estudio cierra.
  if (!is.null(ind$facultades) && nrow(ind$facultades)) {
    ncol_fac <- ncol(ind$facultades)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "Avance por facultad", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    # La cuota NO se compensa entre facultades: se dice, porque quien mire el
    # total de arriba y esta tabla junto va a querer restar.
    .cai_nota(
      wb, hoja, fila,
      "La cuota es de cada facultad y de cada sexo: pasarse en una no cubre lo que falta en otra.",
      nota, n_hoja
    )
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, ind$facultades, startCol = 1, startRow = fila)
    .cai_rayas(wb, hoja, ind$facultades, fila, sin_dato_celda)
    openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:ncol_fac, gridExpand = TRUE)
    nf <- nrow(ind$facultades)
    # V2 (2026-09-08, Gonzalo: «debe haber una fila de total al final»): la
    # MISMA fila que el Sheets (`.calaf_fila_total`), vestida como el cierre
    # del diario. Sus «—» también se declaran.
    total_fac <- .calaf_fila_total(ind$facultades)
    openxlsx::writeData(wb, hoja, total_fac, startCol = 1, startRow = fila + nf + 1L, colNames = FALSE)
    .cai_rayas(wb, hoja, total_fac, fila + nf, sin_dato_celda)
    openxlsx::addStyle(wb, hoja, total_diario, rows = fila + nf + 1L, cols = 1:ncol_fac, gridExpand = TRUE)
    # **Por NOMBRE de columna, nunca por indice.**
    #
    # Esto decia `cols = 2:9` enteras, `cols = 10` porcentaje y `cols = 11`
    # entera. Al insertar «Techo con sobremuestra» delante de «Avance» —el
    # 2026-08-31, en el commit de al lado— los tres se corrieron una posicion y
    # la hoja salio con el techo de Arquitectura, 188, pintado como «18800,0 %».
    # Un indice fijo es una dependencia invisible con el orden de las columnas:
    # el que las añade no tiene forma de saber que existe.
    nombres_fac <- names(ind$facultades)
    col_de <- function(...) which(nombres_fac %in% c(...))
    cols_pct <- col_de("Avance")
    cols_num <- setdiff(seq_along(nombres_fac)[-1], cols_pct)
    if (length(cols_num)) {
      openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + nf), cols = cols_num,
                         gridExpand = TRUE, stack = TRUE)
    }
    if (length(cols_pct)) {
      openxlsx::addStyle(wb, hoja, porcentaje, rows = (fila + 1L):(fila + nf), cols = cols_pct,
                         gridExpand = TRUE, stack = TRUE)
    }
    # Bordes en toda la tabla, cabecera incluida: sin ellos una tabla de doce
    # columnas se lee como una lista de numeros sueltos. Gonzalo: «todas las
    # tres primeras hojas deberia tener bordes negros sus tablas».
    openxlsx::addStyle(
      wb, hoja,
      openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#3C4149"),
      rows = fila:(fila + nf + 1L), cols = seq_along(nombres_fac),
      gridExpand = TRUE, stack = TRUE
    )
    # Y anchos: las cabeceras salian cortadas —«Aulas aplicad», «Conseguidas r»,
    # «Techo con sob»— porque la columna era mas estrecha que su titulo.
    openxlsx::setColWidths(wb, hoja, cols = 1, widths = 34)
    openxlsx::setColWidths(wb, hoja, cols = 2:length(nombres_fac), widths = 15)
    # La cabecera se PARTE en vez de cortarse: «Faltantes para la sobremuestra»
    # son 30 caracteres en una columna de 15, y sin esto saldria a medias. Un
    # titulo a medias en una tabla de quince columnas obliga a contar posiciones
    # para saber que se esta leyendo. Tres lineas de alto: es la cabecera mas
    # larga de la hoja.
    openxlsx::addStyle(
      wb, hoja,
      openxlsx::createStyle(wrapText = TRUE, valign = "bottom", halign = "center"),
      rows = fila, cols = 2:length(nombres_fac), gridExpand = TRUE, stack = TRUE
    )
    openxlsx::setRowHeights(wb, hoja, rows = fila, heights = 45)
    fila <- fila + nf + 2L
    # V6: la nota es UNA para el xlsx y el Sheets (`.calaf_nota_metas`), y
    # nombra las dos metas sin llamar «referencial» ni «margen» a la
    # sobremuestra: Gonzalo, 2026-09-08, «dos metas, una real y otra
    # referencial (aunque no debe decir que lo es)».
    .cai_nota(wb, hoja, fila, .calaf_nota_metas(ind$facultades), nota, n_hoja)
    fila <- fila + 2L
  }

  if (!is.null(ind$aplicadores) && nrow(ind$aplicadores)) {
    # **Las columnas se buscan por su nombre, no se cuentan.** Estaban fijadas a
    # los índices 2:3 y 4, y la tabla ganó columnas el 2026-09-07 —el reparto y
    # la cuenta de plataforma—: el `promedio` cayó sobre «Efectivas en
    # plataforma» y la media quedó sin su decimal. Contar posiciones es la misma
    # ancla frágil que anclar por rótulo.
    n_col_apl <- ncol(ind$aplicadores)
    col_media <- which(names(ind$aplicadores) == "Media por curso-horario")
    cols_num <- setdiff(seq_len(n_col_apl)[-1L], col_media)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "Producción por aplicador", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, ind$aplicadores, startCol = 1, startRow = fila)
    .cai_rayas(wb, hoja, ind$aplicadores, fila, sin_dato_celda)
    openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = seq_len(n_col_apl), gridExpand = TRUE)
    # Las cabeceras de esta tabla ya no caben en su columna —«Efectivas en
    # plataforma», «Cursos-horario asignados»— así que bajan de línea en vez de
    # cortarse, igual que las de la tabla por facultad.
    openxlsx::addStyle(
      wb, hoja,
      openxlsx::createStyle(wrapText = TRUE, valign = "bottom"),
      rows = fila, cols = 2:n_col_apl, gridExpand = TRUE, stack = TRUE
    )
    openxlsx::setRowHeights(wb, hoja, rows = fila, heights = 30)
    n <- nrow(ind$aplicadores)
    if (length(cols_num)) {
      openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n), cols = cols_num,
                         gridExpand = TRUE, stack = TRUE)
    }
    if (length(col_media)) {
      openxlsx::addStyle(wb, hoja, promedio, rows = (fila + 1L):(fila + n), cols = col_media,
                         gridExpand = TRUE, stack = TRUE)
      # **La barra en un tono CLARO, o tapa el numero.** Con el navy del libro,
      # la cifra quedaba en negro sobre azul oscuro y no se leia: la barra ayuda
      # a comparar de un vistazo, pero el numero es el dato. Visto en el PDF.
      openxlsx::conditionalFormatting(
        wb, hoja, cols = col_media[[1]], rows = (fila + 1L):(fila + n),
        type = "databar", style = c("#DCE6F2", "#C2D4E8"), gradient = FALSE, border = FALSE
      )
    }
    # S12: la MISMA rejilla que la tabla de facultades (visto en el render
    # real: una con bordes y la otra sin ellos, en la misma hoja).
    openxlsx::addStyle(wb, hoja, rejilla, rows = fila:(fila + n), cols = seq_len(n_col_apl),
                       gridExpand = TRUE, stack = TRUE)
    fila <- fila + n + 2L
  } else {
    # S11: sin partes, el bloque no desaparece: título con su banda y el vacío
    # declarado con la MISMA frase que el Sheets.
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "Producción por aplicador", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    .cai_nota(wb, hoja, fila + 1L, .cali_motivo_sin_aplicadores(), nota, n_hoja)
    fila <- fila + 3L
  }

  # **La seccion no desaparece: dice por que esta vacia.** Sin avance diario, el
  # bloque entero se esfumaba de la hoja y quien la vio con datos no podia saber
  # si se habia retirado o si faltaba el dato. El avance diario cuenta EFECTIVAS
  # de plataforma, asi que sin base de respuestas no hay serie — y eso es lo que
  # hay que decir, no callarlo.
  if (is.null(ind$diario) || !nrow(ind$diario)) {
    openxlsx::writeData(wb, hoja, "Avance diario", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    .cai_nota(wb, hoja, fila + 1L, .cali_motivo_sin_diario(ind), nota, n_hoja)
    fila <- fila + 3L
  } else {
    openxlsx::writeData(wb, hoja, "Avance diario", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, ind$diario, startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:4, gridExpand = TRUE)
    n <- nrow(ind$diario)
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n), cols = 2:4,
                       gridExpand = TRUE, stack = TRUE)
    openxlsx::conditionalFormatting(
      wb, hoja, cols = 2, rows = (fila + 1L):(fila + n),
      # Mismo motivo que arriba: el numero por encima de la barra.
      type = "databar", style = c("#DCE6F2", "#C2D4E8"), gradient = FALSE, border = FALSE
    )
    # S5: la fila de cierre, fuera de la barra (es un total, no un día).
    cierre <- .cali_cierre_diario(ind$diario)
    if (!is.null(cierre)) {
      fila_total <- fila + n + 1L
      openxlsx::writeData(wb, hoja, cierre, startCol = 1, startRow = fila_total, colNames = FALSE)
      openxlsx::addStyle(wb, hoja, total_diario, rows = fila_total, cols = 1:4, gridExpand = TRUE)
      n <- n + 1L
    }
    fila <- fila + n + 1L
  }

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

  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 34)
  openxlsx::setColWidths(wb, hoja, cols = 2:4, widths = 20)
  openxlsx::pageSetup(wb, hoja, orientation = "portrait", fitToWidth = TRUE,
                      fitToHeight = FALSE)
  invisible(fila)
}
