# La portada del libro de agendación.
#
# **Es lo que una tabla dinámica enseñaría, ya calculado.** `openxlsx` no genera
# pivots nativos, así que en vez de prometer una dinámica que no puedo escribir,
# el libro abre con los cortes que el equipo iba a construir a mano: cuánto
# operativo hay, cómo se reparte por facultad y en qué estado está.
#
# Va PRIMERA porque es la primera impresión del fichero y porque contesta sin
# desplazarse lo que las hojas de datos sólo contestan filtrando.

.calr_txt <- function(u, k) {
  v <- u[[k]]
  if (is.null(v) || !length(v)) return("")
  trimws(as.character(v)[1])
}

.calr_num <- function(u, k) {
  v <- suppressWarnings(as.numeric(u[[k]] %||% NA))
  if (!length(v)) NA_real_ else v[1]
}

#' Cortes del plan para la portada.
#'
#' @param unidades filas del plan (formato largo).
#' @return lista con `totales`, `por_facultad` y `por_estado`.
#' @export
aulas_libro_cortes <- function(unidades, partes = list(), control = list()) {
  rol <- vapply(unidades, .calr_txt, character(1), "sample_role")
  cod_u <- vapply(unidades, .calr_txt, character(1), "operational_code")
  fac <- vapply(unidades, .calr_txt, character(1), "faculty")
  fac[!nzchar(fac)] <- "Sin facultad"
  est <- vapply(unidades, function(u) {
    v <- .calr_txt(u, "sample_status")
    if (nzchar(v)) v else "Sin estado"
  }, character(1))
  eleg <- vapply(unidades, .calr_num, numeric(1), "eligible_n")
  meta <- vapply(unidades, .calr_num, numeric(1), "expected_valid")
  fecha <- vapply(unidades, function(u) substr(.calr_txt(u, "scheduled_date"), 1, 10), character(1))

  # El banco NO entra en los cortes por facultad: no está agendado y sumarlo
  # daría un operativo que nadie va a visitar. Se cuenta aparte, que es como lo
  # trata el resto del sistema.
  del_plan <- rol != "extra_reserve_pool"

  # **Lo esperado se cuenta sobre los TITULARES, no sobre la cadena entera.**
  #
  # Una reserva sólo entra a campo si su titular cae, así que sumar sus metas da
  # un esperado que nadie va a recoger: en el corte de prueba, 26 titulares
  # daban «4 154 encuestas esperadas» porque arrastraban 238 reservas. Las
  # reservas son respaldo y se cuentan como respaldo.
  titular <- rol == "titular"

  totales <- list(
    `Cursos-horario titulares` = sum(titular),
    `Reservas de cadena` = sum(rol == "chain_reserve"),
    `Aulas del banco` = sum(rol == "extra_reserve_pool"),
    `Facultades` = length(unique(fac[del_plan])),
    `Con fecha agendada` = sum(nzchar(fecha) & del_plan),
    `Alumnos elegibles (titulares)` = sum(eleg[titular & is.finite(eleg)]),
    `Encuestas esperadas (titulares)` = round(sum(meta[titular & is.finite(meta)]), 1)
  )

  claves <- sort(unique(fac[del_plan]))
  por_facultad <- data.frame(
    Facultad = claves,
    Titulares = vapply(claves, function(f) sum(del_plan & fac == f & rol == "titular"), integer(1)),
    Reservas = vapply(claves, function(f) sum(del_plan & fac == f & rol == "chain_reserve"), integer(1)),
    `Con fecha` = vapply(claves, function(f) sum(del_plan & fac == f & nzchar(fecha)), integer(1)),
    # Igual que arriba: de titulares. Una facultad con 22 reservas y 2 titulares
    # no espera 22 aulas de encuestas.
    Elegibles = vapply(claves, function(f) sum(eleg[titular & fac == f & is.finite(eleg)]), numeric(1)),
    Esperadas = vapply(claves, function(f) round(sum(meta[titular & fac == f & is.finite(meta)]), 1), numeric(1)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # **Y lo recogido, que es la pregunta que se le hace a esta tabla.**
  #
  # «El calculo es por facultad; si necesitamos X alumnos por facultad tenemos
  # que tener aulas que respondan a ese X». Con solo el plan, la tabla decia
  # cuanto se esperaba de cada facultad y nada de cuanto lleva: para saber cual
  # va corta habia que cruzarla a mano con otra hoja.
  #
  # Las columnas solo aparecen si hay partes: en un libro nuevo serian dos
  # columnas de ceros al lado de las que si dicen algo.
  if (length(partes)) {
    fac_de <- list()
    for (k in seq_along(unidades)) fac_de[[cod_u[[k]]]] <- fac[[k]]
    ef_fac <- stats::setNames(numeric(length(claves)), claves)
    for (pt in partes) {
      c1 <- .calr_txt(pt, "operational_code")
      if (!nzchar(c1)) c1 <- .calr_txt(pt, "classroom_id")
      f1 <- fac_de[[c1]]
      e <- .calr_num(pt, "effective_surveys")
      if (is.null(f1) || !is.finite(e)) next
      if (!is.na(ef_fac[[f1]])) ef_fac[[f1]] <- ef_fac[[f1]] + e
    }
    por_facultad$Recogidas <- round(unname(ef_fac[por_facultad$Facultad]), 1)
    # Un 0 de 0 no es 0 %: una facultad sin esperado no tiene avance que dar.
    por_facultad$Avance <- vapply(seq_len(nrow(por_facultad)), function(i) {
      esp <- por_facultad$Esperadas[[i]]
      if (!is.finite(esp) || esp <= 0) return("—")
      paste0(round(100 * por_facultad$Recogidas[[i]] / esp, 1), " %")
    }, character(1))
  }

  # Por tamaño del operativo y no alfabético: la portada ordena por dónde hay
  # más trabajo, que es lo que se mira primero.
  por_facultad <- por_facultad[order(-por_facultad$Titulares, por_facultad$Facultad), , drop = FALSE]

  estados <- sort(unique(est[del_plan]))
  por_estado <- data.frame(
    Estado = estados,
    Aulas = vapply(estados, function(e) sum(del_plan & est == e), integer(1)),
    stringsAsFactors = FALSE
  )
  por_estado <- por_estado[order(-por_estado$Aulas), , drop = FALSE]

  # **El avance, si lo hay.**
  #
  # La portada solo miraba el plan: abrir el libro a mitad de operativo daba una
  # primera pagina que hablaba como si no hubiera empezado. Se puede contar
  # desde que los partes y el control viajan al libro.
  #
  # Un libro NUEVO no lleva este bloque: siete ceros no informan de nada y la
  # portada tiene que caber. Sin partes ni control, no hay avance del que hablar.
  avance <- NULL
  if (length(partes) || length(control)) {
    cod <- vapply(unidades, .calr_txt, character(1), "operational_code")
    con_parte <- unique(Filter(nzchar, vapply(partes, function(pt) {
      v <- .calr_txt(pt, "operational_code")
      if (nzchar(v)) v else .calr_txt(pt, "classroom_id")
    }, character(1))))
    efectivas <- sum(vapply(partes, .calr_num, numeric(1), "effective_surveys"), na.rm = TRUE)

    # «Efectiva» exige los DOS umbrales, que es el criterio del estudio. Se leen
    # los veredictos que el equipo ya declaro en su hoja (`VALIDO TOTAL` y
    # `VALIDO POBLACION`, 0/1); la portada refleja el libro, no lo recalcula.
    dos <- vapply(control, function(r) {
      isTRUE(.calr_num(r, "valid_total") == 1) &&
        isTRUE(.calr_num(r, "valid_population") == 1)
    }, logical(1))
    uno <- vapply(control, function(r) {
      a <- isTRUE(.calr_num(r, "valid_total") == 1)
      b <- isTRUE(.calr_num(r, "valid_population") == 1)
      xor(a, b)
    }, logical(1))

    esperadas <- totales[["Encuestas esperadas (titulares)"]]
    avance <- list(
      `Aulas con parte de campo` = length(intersect(con_parte, cod[titular])),
      `Aulas en la base de control` = if (length(control)) length(control) else "—",
      `Encuestas efectivas recogidas` = round(efectivas, 1),
      # Un 0 de 0 no es 0 %: es una cuenta que no se puede hacer.
      `Avance sobre lo esperado` = if (is.finite(esperadas) && esperadas > 0) {
        paste0(round(100 * efectivas / esperadas, 1), " %")
      } else "—",
      # Sin base de control, «0 aulas efectivas» es falso: no es que ninguna lo
      # sea, es que no hay con que decirlo. Mismo criterio que el 0 de 0 — visto
      # en el PDF, donde un libro con 130 partes y sin control declaraba cero
      # efectivas junto a un avance del 93.6 %.
      `Aulas efectivas (los dos umbrales)` = if (length(control)) sum(dos) else "—",
      `Aulas que cumplen solo uno` = if (length(control)) sum(uno) else "—"
    )
  }

  list(totales = totales, por_facultad = por_facultad, por_estado = por_estado,
       avance = avance)
}

#' Escribe la portada en el workbook.
#'
#' @param wb workbook abierto.
#' @param unidades filas del plan.
#' @param hoja nombre de la hoja.
#' @return la fila siguiente a lo escrito.
#' @export
aulas_libro_escribir_resumen <- function(wb, unidades, hoja = "Resumen",
                                         partes = list(), control = list()) {
  cortes <- aulas_libro_cortes(unidades, partes, control)
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)

  titulo <- openxlsx::createStyle(fontSize = 16, textDecoration = "bold", fontColour = "#002457")
  pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472")
  seccion <- openxlsx::createStyle(fontSize = 11, textDecoration = "bold", fontColour = "#002457",
                                   border = "bottom", borderColour = "#C7D0DD")
  etiqueta <- openxlsx::createStyle(fontColour = "#5B6472")
  cifra <- openxlsx::createStyle(textDecoration = "bold", halign = "right", numFmt = "#,##0.#")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left")
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0.#")

  openxlsx::writeData(wb, hoja, "Libro de agendación de aulas", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, hoja, paste("Generado por Prosecnur el",
                                      format(Sys.Date(), "%d/%m/%Y")),
                      startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  fila <- 4L
  openxlsx::writeData(wb, hoja, "El operativo", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
  fila <- fila + 1L
  for (nombre in names(cortes$totales)) {
    openxlsx::writeData(wb, hoja, nombre, startCol = 1, startRow = fila)
    openxlsx::writeData(wb, hoja, cortes$totales[[nombre]], startCol = 2, startRow = fila)
    openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
    openxlsx::addStyle(wb, hoja, cifra, rows = fila, cols = 2)
    fila <- fila + 1L
  }

  # El avance va DESPUES del operativo y antes de los cortes: es lo que se mira
  # primero al abrir el libro de un estudio en marcha.
  if (length(cortes$avance)) {
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "El avance", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
    fila <- fila + 1L
    for (nombre in names(cortes$avance)) {
      valor <- cortes$avance[[nombre]]
      openxlsx::writeData(wb, hoja, nombre, startCol = 1, startRow = fila)
      openxlsx::writeData(wb, hoja, valor, startCol = 2, startRow = fila)
      openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
      # El porcentaje llega como texto ya formado; la cifra en negrita a la
      # derecha vale para los dos.
      openxlsx::addStyle(wb, hoja, cifra, rows = fila, cols = 2)
      fila <- fila + 1L
    }
  }

  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, "Por facultad", startCol = 1, startRow = fila)
  # El ancho de la tabla se lee de la tabla: gana dos columnas cuando hay
  # avance, y un `1:6` fijo dejaba la cabecera a medio teñir.
  n_col_fac <- ncol(cortes$por_facultad)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_col_fac), gridExpand = TRUE)
  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, cortes$por_facultad, startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = seq_len(n_col_fac), gridExpand = TRUE)
  n_fac <- nrow(cortes$por_facultad)
  if (n_fac) {
    # `Avance` es texto ya formado y va a la derecha como las cifras, pero sin
    # formato numerico: un «—» con `#,##0.#` encima no se rompe, pero declarar
    # numero lo que no lo es invita al proximo error de escala.
    numericas <- setdiff(2:n_col_fac, which(names(cortes$por_facultad) == "Avance"))
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n_fac), cols = numericas,
                       gridExpand = TRUE, stack = TRUE)
    # **Una barra donde se compara.** Veinte facultades con sus cifras alineadas
    # obligan a leer numero por numero para ver cual va corta; la barra lo
    # resuelve de un vistazo y no ocupa una columna mas. Solo en `Recogidas`,
    # que es la que se compara con su meta de al lado — poner barras en todas
    # las columnas seria decoracion.
    col_rec <- which(names(cortes$por_facultad) == "Recogidas")
    if (length(col_rec)) {
      openxlsx::conditionalFormatting(
        wb, hoja, cols = col_rec, rows = (fila + 1L):(fila + n_fac),
        type = "databar", style = c("#C7D0DD", "#002457"), gradient = FALSE,
        border = FALSE
      )
    }
    col_av <- which(names(cortes$por_facultad) == "Avance")
    if (length(col_av)) {
      openxlsx::addStyle(wb, hoja, openxlsx::createStyle(halign = "right"),
                         rows = (fila + 1L):(fila + n_fac), cols = col_av,
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  fila <- fila + n_fac + 2L

  openxlsx::writeData(wb, hoja, "Por estado de muestra", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, cortes$por_estado, startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:2, gridExpand = TRUE)
  n_est <- nrow(cortes$por_estado)
  if (n_est) {
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n_est), cols = 2,
                       gridExpand = TRUE, stack = TRUE)
  }

  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 34)
  openxlsx::setColWidths(wb, hoja, cols = 2:8, widths = 13)
  # **La portada tiene que caber a lo ancho.**
  #
  # Convertida a PDF, la tabla por facultad se partia en dos paginas: «Elegibles»
  # y «Esperadas» caian sueltas en la segunda, con su cabecera pero sin saber de
  # que facultad eran. Seis columnas de 34+13x5 no entran en un A4 vertical.
  # `fitToWidth` la encaja en una pagina de ancho y deja crecer el alto, que es
  # lo que hace falta cuando la universidad tiene veinte facultades.
  #
  # Esto solo se ve ABRIENDO el fichero: el XML declaraba las seis columnas y
  # todo parecia correcto.
  openxlsx::pageSetup(wb, hoja, orientation = "portrait", fitToWidth = TRUE,
                      fitToHeight = FALSE)
  invisible(fila + n_est + 1L)
}
