# collection_territorial_registro.R — el «Registro del coordinador» del Excel de asignación
# (informe de brechas §1C; decisiones de Gonzalo del 31 de octubre: (e) el avance oficial es
# Kobo validado, (f) el formulario de ocurrencias se mantiene, (g) las cuotas salen de Hojas
# de ruta; y el límite «Material crea los materiales de campo; el control es de Monitoreo»).
#
# El coordinador anota por UMP lo que pasó en el día: efectivas por celda de cuota, no
# efectivas por código, fecha de visita, si se reemplaza, supervisión y observaciones. Es
# material de campo: Material lo genera dentro del Excel de asignación, lo lee de vuelta con
# el resto del archivo y lo publica en solo lectura por GET …/territorial/asignacion/estado.
# NO calcula Estado ni avance, ni trae Reporte: eso es de Monitoreo, que cruza lo declarado
# con Kobo y alerta la diferencia. Las columnas de totales son sólo ayuda de llenado.
#
# Una pestaña por región (decisión a): por `departamento` del bloque; una sola si el estudio
# tiene una región o la muestra no lo trae. Las celdas de cuota son las marginales que Hojas
# de ruta reparte por ficha (`cuota_sexo_totals` «h,m» y `cuota_edad_totals`, ver
# hojas_ruta_cuotas_por_ficha.R); los reemplazos heredan las de su titular.

.MTR_PREFIJO <- "Registro"
.MTR_FILA_CABECERA <- 4L
.MTR_SEXOS <- c("Hombre", "Mujer")
.MTR_EFECTIVAS <- "Efectivas · "
.MTR_META <- "Meta · "
.MTR_SI_NO <- c("Sí", "No")
.MTR_CAMPO <- c("Fecha de visita", "¿Se reemplaza?", "Supervisión: aprobadas", "Supervisión: no aprobadas", "Observaciones")
.MTR_REPORTADO <- "Total reportado por coordinación"
.MTR_ESTADOS_1A <- c("Sin iniciar", "En curso", "Completa")

# Variante del territorial (informe de brechas §1): «conveniencia» (cuotas, como Ser
# Adolescente) o «ump_aleatoria» (hoja de ruta, como acogida). Sale del perfil territorial
# del Planner; mientras el Planner no la declare, UMP aleatoria, que es lo que arma Hojas de ruta.
.mtr_variante <- function(s) {
  perfiles <- tryCatch(.planner_payload_perfiles(s), error = function(e) list())
  ter <- Filter(function(p) is.list(p) && identical(p$tipo, "territorial"), perfiles %||% list())
  sel <- if (length(ter)) as.character(ter[[1]]$seleccion %||% "") else ""
  if (identical(sel, "conveniencia")) "conveniencia" else "ump_aleatoria"
}

# Las celdas de cuota del envío: sexo y rangos de edad, sólo las que la muestra trae.
.mtr_celdas <- function(envio) {
  defs <- envio$config$age_ranges
  if (!length(defs)) defs <- .hojas_ruta_age_defs_default()
  edades <- vapply(defs, function(d) .hojas_ruta_scalar(d$label, .hojas_ruta_scalar(d$id, "")), "")
  filas <- c(.hojas_ruta_envio_rows(envio$sample$blocks), .hojas_ruta_envio_rows(envio$sample$replacement_blocks))
  cuota <- lapply(filas, function(b) list(
    sexo = .hojas_ruta_parse_edad_totals(b[["cuota_sexo_totals"]], 2L),
    edad = .hojas_ruta_parse_edad_totals(b[["cuota_edad_totals"]], length(edades))
  ))
  names(cuota) <- vapply(filas, function(b) .hojas_ruta_envio_chr(b[["id_manzana"]]), "")
  region <- stats::setNames(vapply(filas, function(b) .hojas_ruta_envio_chr(b[["departamento"]]), ""), names(cuota))
  con_sexo <- any(vapply(cuota, function(q) !is.null(q$sexo), TRUE))
  con_edad <- any(vapply(cuota, function(q) !is.null(q$edad), TRUE))
  list(sexo = if (con_sexo) .MTR_SEXOS else character(0), edad = if (con_edad) edades else character(0),
       cuota = cuota, region = region)
}

# Nombre de pestaña válido en Excel (31 caracteres, sin []:*?/\).
.mtr_nombre_hoja <- function(region, varias) {
  if (!varias || !nzchar(region)) return(.MTR_PREFIJO)
  substr(paste(.MTR_PREFIJO, gsub("[:*?/\\\\]|\\[|\\]", " ", region, perl = TRUE)), 1L, 31L)
}

#' Agrega al libro las pestañas del Registro del coordinador. Devuelve sus nombres.
#'
#' En conveniencia (1A) es el seguimiento de Ser Adolescente: logradas por celda, el total
#' declarado (fórmula) y el reportado por coordinación, y un Estado calculado; sin códigos
#' de resultado ni reemplazo (P2 no va en 1A). En UMP aleatoria (1B), lo de §1C.
#' @keywords internal
.mtr_agregar <- function(wb, ctx, ordenadas, label_de, codigos, hoja_asignacion, col_id, col_enc, col_ump, variante = "ump_aleatoria") {
  conveniencia <- identical(variante, "conveniencia")
  celdas <- .mtr_celdas(ctx$envio)
  cel <- c(celdas$sexo, celdas$edad)
  no_efectivos <- Filter(function(k) !identical(k$grupo, "efectiva"), codigos)
  cols_cod <- if (conveniencia) character(0) else .mtx_columnas_conteo(no_efectivos)
  campo <- if (conveniencia) setdiff(.MTR_CAMPO, "¿Se reemplaza?") else .MTR_CAMPO
  identidad <- c("Distrito", "UMP", "Código de manzana", "Tipo", "Reemplaza a", "Encuestador", "Cuestionarios", "Meta")
  metas <- if (length(cel)) paste0(.MTR_META, cel) else character(0)
  efectivas <- if (length(cel)) paste0(.MTR_EFECTIVAS, cel) else "Efectivas"
  ayuda <- if (conveniencia) c("Total efectivas", "Faltan para la meta", "Estado") else c("Total efectivas", "Faltan para la meta", "Total de intentos")
  reportado <- if (conveniencia) .MTR_REPORTADO else character(0)
  columnas <- c(identidad, metas, efectivas, cols_cod, ayuda, reportado, campo)
  ambar <- c(efectivas, cols_cod, reportado, campo)
  idx <- function(x) match(x, columnas)
  letra <- function(x) openxlsx::int2col(idx(x))
  txt <- function(x) if (is.null(x) || is.na(x)) "" else as.character(x)

  regiones <- vapply(ordenadas, function(u) {
    r <- unname(celdas$region[u$unit_id])
    if (identical(u$role, "reemplazo") && !is.na(u$titular_id) && !nzchar(r %||% "")) r <- unname(celdas$region[u$titular_id])
    if (is.na(r)) "" else r
  }, "")
  orden_regiones <- unique(regiones)
  varias <- length(setdiff(orden_regiones, "")) > 1L
  hojas <- character(0)
  for (reg in orden_regiones) {
    hoja <- .mtr_nombre_hoja(reg, varias)
    if (hoja %in% hojas) hoja <- substr(paste(hoja, length(hojas) + 1L), 1L, 31L)
    hojas <- c(hojas, hoja)
    unidades <- ordenadas[regiones == reg]
    n <- length(unidades)
    primera <- .MTR_FILA_CABECERA + 1L
    ultima <- .MTR_FILA_CABECERA + n
    cuerpo <- primera:ultima

    tabla <- do.call(rbind, lapply(unidades, function(u) {
      q <- celdas$cuota[[u$unit_id]] %||% list()
      if (identical(u$role, "reemplazo") && !is.na(u$titular_id) && is.null(q$sexo) && is.null(q$edad)) q <- celdas$cuota[[u$titular_id]] %||% list()
      fila <- list(
        Distrito = txt(u$distrito), UMP = u$label, `Código de manzana` = u$unit_id,
        Tipo = if (identical(u$role, "reemplazo")) "Reemplazo" else "Titular",
        `Reemplaza a` = if (identical(u$role, "reemplazo") && !is.na(u$titular_id)) txt(unname(label_de[u$titular_id])) else "",
        Encuestador = "",
        Cuestionarios = if (!is.na(u$rango_inicio) && !is.na(u$rango_fin)) sprintf("%d a %d", u$rango_inicio, u$rango_fin) else "",
        Meta = if (!is.na(u$rango_inicio) && !is.na(u$rango_fin)) u$rango_fin - u$rango_inicio + 1L else NA_integer_
      )
      vals <- c(if (length(celdas$sexo)) (q$sexo %||% rep(NA_integer_, 2L)),
                if (length(celdas$edad)) (q$edad %||% rep(NA_integer_, length(celdas$edad))))
      for (i in seq_along(metas)) fila[[metas[[i]]]] <- as.integer(vals[[i]])
      for (c in c(efectivas, cols_cod, ayuda, reportado, campo)) fila[[c]] <- NA
      as.data.frame(fila, check.names = FALSE, stringsAsFactors = FALSE)
    }))

    openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)
    openxlsx::writeData(wb, hoja, sprintf("%s · %s%s", if (conveniencia) "Seguimiento de campo" else "Registro del coordinador",
                                          ctx$hit$entry$name, if (nzchar(reg)) paste0(" · ", reg) else ""), startRow = 1)
    openxlsx::writeData(wb, hoja, if (conveniencia) paste(
      "Anota por UMP las encuestas logradas en cada celda de cuota y el total que reporta coordinación. El Estado sale solo.",
      "Llena sólo las columnas en ámbar. Es lo declarado por coordinación: Monitoreo lo compara con lo que llega a Kobo, que es el avance oficial."
    ) else paste(
      "Anota por UMP lo que pasó en campo: efectivas por celda de cuota, no efectivas por código (los totales de la hoja de consolidados),",
      "fecha de visita y si se reemplaza. Llena sólo las columnas en ámbar. Es lo declarado por coordinación:",
      "Monitoreo lo compara con lo que llega a Kobo, que es el avance oficial."
    ), startRow = 2)
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(fontSize = 14, textDecoration = "bold"), rows = 1, cols = 1)
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(fontSize = 10, fontColour = "#5B6573", wrapText = TRUE), rows = 2, cols = 1)
    openxlsx::mergeCells(wb, hoja, cols = seq_along(columnas), rows = 2)
    openxlsx::setRowHeights(wb, hoja, rows = 2, heights = 32)
    # Fila de grupos sobre la cabecera: de dónde sale cada bloque.
    grupos <- list(list("Cuota (de Hojas de ruta)", metas), list("Efectivas", efectivas), list("No efectivas por código", cols_cod),
                   list("Ayuda de llenado", ayuda), list("Coordinación", reportado), list("Campo", campo))
    for (g in grupos) if (length(g[[2]])) {
      openxlsx::writeData(wb, hoja, g[[1]], startCol = idx(g[[2]][[1]]), startRow = 3)
      if (length(g[[2]]) > 1L) openxlsx::mergeCells(wb, hoja, cols = idx(g[[2]]), rows = 3)
    }
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(textDecoration = "bold", fontColour = "#5B6573", halign = "center"),
                       rows = 3, cols = seq_along(columnas))
    openxlsx::writeData(wb, hoja, tabla, startRow = .MTR_FILA_CABECERA,
                        headerStyle = openxlsx::createStyle(textDecoration = "bold", fgFill = "#1F3A5F", fontColour = "#FFFFFF",
                                                            border = "Bottom", wrapText = TRUE, valign = "center", locked = TRUE))
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(textDecoration = "bold", fgFill = "#B7791F", fontColour = "#FFFFFF",
                                                       border = "Bottom", wrapText = TRUE, valign = "center", locked = TRUE),
                       rows = .MTR_FILA_CABECERA, cols = idx(ambar))
    es_reemplazo <- tabla$Tipo == "Reemplazo"
    if (any(es_reemplazo)) openxlsx::addStyle(wb, hoja, openxlsx::createStyle(fgFill = "#FFF6D6"),
                                              rows = which(es_reemplazo) + .MTR_FILA_CABECERA, cols = idx(identidad), gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(numFmt = "@"), rows = cuerpo, cols = idx("Código de manzana"), stack = TRUE)
    # Sólo lo de campo se edita; la identidad, las metas y la ayuda quedan bloqueadas.
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(locked = FALSE, fgFill = "#FFF3D6", border = "TopBottomLeftRight", borderColour = "#E2C88A"),
                       rows = cuerpo, cols = idx(ambar), gridExpand = TRUE)
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(numFmt = "dd/mm/yyyy"), rows = cuerpo, cols = idx("Fecha de visita"), stack = TRUE)
    openxlsx::addStyle(wb, hoja, openxlsx::createStyle(wrapText = TRUE), rows = cuerpo, cols = idx("Observaciones"), stack = TRUE)

    # El encuestador se lee de la hoja Asignación: reasignar ahí lo cambia aquí. El &"" evita
    # que una celda vacía se lea como 0.
    ref_id <- sprintf("'%s'!$%s:$%s", hoja_asignacion, openxlsx::int2col(col_id), openxlsx::int2col(col_id))
    ref_enc <- sprintf("'%s'!$%s:$%s", hoja_asignacion, openxlsx::int2col(col_enc), openxlsx::int2col(col_enc))
    ref_ump <- sprintf("'%s'!$%s:$%s", hoja_asignacion, openxlsx::int2col(col_ump), openxlsx::int2col(col_ump))
    # Cada efectiva cae en una celda de sexo y en una de edad: el total sale de un solo eje.
    total_de <- if (length(celdas$sexo)) paste0(.MTR_EFECTIVAS, celdas$sexo)
                else if (length(celdas$edad)) paste0(.MTR_EFECTIVAS, celdas$edad) else efectivas
    rango <- function(cols, r) paste(sprintf("%s%d", vapply(cols, letra, ""), r), collapse = ",")
    for (i in seq_len(n)) {
      r <- .MTR_FILA_CABECERA + i
      # Un reemplazo sin encuestador propio hereda el de su titular (se busca por la UMP en «Reemplaza a»).
      propio <- sprintf("IFERROR(INDEX(%s,MATCH($%s%d,%s,0))&\"\",\"\")", ref_enc, letra("Código de manzana"), r, ref_id)
      heredado <- sprintf("IF($%s%d=\"\",\"\",IFERROR(INDEX(%s,MATCH($%s%d,%s,0))&\"\",\"\"))",
                          letra("Reemplaza a"), r, ref_enc, letra("Reemplaza a"), r, ref_ump)
      openxlsx::writeFormula(wb, hoja, sprintf("IF(%s<>\"\",%s,%s)", propio, propio, heredado),
                             startCol = idx("Encuestador"), startRow = r)
      tot <- sprintf("SUM(%s)", rango(total_de, r))
      vacio <- sprintf("COUNT(%s)=0", rango(c(efectivas, cols_cod), r))
      openxlsx::writeFormula(wb, hoja, sprintf("IF(%s,\"\",%s)", vacio, tot), startCol = idx("Total efectivas"), startRow = r)
      openxlsx::writeFormula(wb, hoja, sprintf("IF(OR(%s,%s%d=\"\"),\"\",MAX(0,%s%d-%s))", vacio, letra("Meta"), r, letra("Meta"), r, tot),
                             startCol = idx("Faltan para la meta"), startRow = r)
      if (conveniencia) {
        # Como en Ser Adolescente: Completa al llegar a la meta, En curso con algo logrado.
        openxlsx::writeFormula(wb, hoja, sprintf("IF(%s,\"%s\",IF(AND(%s%d<>\"\",%s>=%s%d),\"%s\",\"%s\"))", vacio, .MTR_ESTADOS_1A[[1]],
                                                 letra("Meta"), r, tot, letra("Meta"), r, .MTR_ESTADOS_1A[[3]], .MTR_ESTADOS_1A[[2]]),
                               startCol = idx("Estado"), startRow = r)
      } else {
        intentos <- if (length(cols_cod)) sprintf("%s+SUM(%s)", tot, rango(cols_cod, r)) else tot
        openxlsx::writeFormula(wb, hoja, sprintf("IF(%s,\"\",%s)", vacio, intentos), startCol = idx("Total de intentos"), startRow = r)
      }
    }
    enteros <- c(efectivas, cols_cod, reportado, "Supervisión: aprobadas", "Supervisión: no aprobadas")
    openxlsx::dataValidation(wb, hoja, cols = idx(enteros), rows = cuerpo, type = "whole", operator = "greaterThanOrEqual", value = 0)
    if (!conveniencia) {
      openxlsx::writeData(wb, hoja, data.frame(x = .MTR_SI_NO), startCol = length(columnas) + 3L, startRow = 1, colNames = FALSE)
      lista <- openxlsx::int2col(length(columnas) + 3L)
      openxlsx::setColWidths(wb, hoja, cols = length(columnas) + 3L, widths = 0, hidden = TRUE)
      openxlsx::dataValidation(wb, hoja, cols = idx("¿Se reemplaza?"), rows = cuerpo, type = "list",
                               value = sprintf("$%s$1:$%s$%d", lista, lista, length(.MTR_SI_NO)))
    }
    openxlsx::setColWidths(wb, hoja, cols = seq_along(columnas),
                           widths = pmin(26, pmax(9, nchar(columnas) * 0.7 + 3)))
    openxlsx::setColWidths(wb, hoja, cols = idx(c("Distrito", "Encuestador", "Observaciones")), widths = c(18, 30, 36))
    openxlsx::setRowHeights(wb, hoja, rows = .MTR_FILA_CABECERA, heights = 44)
    openxlsx::freezePane(wb, hoja, firstActiveRow = primera, firstActiveCol = idx("Tipo"))
    openxlsx::addFilter(wb, hoja, rows = .MTR_FILA_CABECERA, cols = seq_along(columnas))
    openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE, printTitleRows = .MTR_FILA_CABECERA)
    openxlsx::protectWorksheet(wb, hoja, protect = TRUE, lockFormattingCells = FALSE, lockFormattingRows = FALSE,
                               lockAutoFilter = FALSE, lockSorting = TRUE)
  }
  hojas
}

# Entero desde cero de una celda; NA si vacía; FALSE si no es entero válido.
.mtr_entero <- function(v) {
  if (is.null(v) || !length(v) || is.na(v[[1]]) || !nzchar(trimws(as.character(v[[1]])))) return(NA)
  num <- suppressWarnings(as.numeric(v[[1]]))
  if (is.na(num) || num < 0 || num != floor(num)) FALSE else as.integer(num)
}

#' Lee las pestañas del Registro del coordinador de un Excel llenado (lectura pura).
#'
#' Devuelve `por_id` (lo declarado por UMP: efectivas por celda, conteos por código,
#' fecha de visita, ¿se reemplaza?, supervisión) y `problemas` con su fila. El conteo del
#' código efectivo es la suma de las efectivas (por sexo, o por edad si no hay sexo).
#' @keywords internal
.mtr_leer <- function(path, codigos) {
  hojas <- tryCatch(openxlsx::getSheetNames(path), error = function(e) character(0))
  hojas <- hojas[startsWith(hojas, .MTR_PREFIJO)]
  efectivo <- Filter(function(k) identical(k$grupo, "efectiva"), codigos)
  cod_efectivo <- if (length(efectivo)) efectivo[[1]]$codigo else NA_character_
  por_id <- list(); problemas <- list()
  for (h in hojas) {
    crudo <- tryCatch(openxlsx::read.xlsx(path, sheet = h, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE),
                      error = function(e) NULL)
    if (!is.data.frame(crudo) || !nrow(crudo)) next
    r0 <- NA_integer_
    for (r in seq_len(min(15L, nrow(crudo)))) {
      cab <- vapply(crudo[r, ], function(x) as.character(x %||% ""), "")
      if (!is.na(.mtx_columna(cab, "Código de manzana"))) { r0 <- r; break }
    }
    if (is.na(r0) || r0 >= nrow(crudo)) next
    cab <- vapply(crudo[r0, ], function(x) { v <- as.character(x %||% ""); if (is.na(v)) "" else v }, "")
    cuerpo <- crudo[(r0 + 1L):nrow(crudo), , drop = FALSE]
    ci <- .mtx_columna(cab, "Código de manzana")
    col <- function(nombre) { k <- match(nombre, cab); if (is.na(k)) NULL else cuerpo[[k]] }
    ef_cols <- which(startsWith(cab, .MTR_EFECTIVAS) | cab == "Efectivas")
    cod_cols <- which(grepl("^\\s*[0-9]+\\s*·", cab))
    ids <- .mtx_texto_id(cuerpo[[ci]])
    for (i in seq_along(ids)) {
      id <- ids[[i]]
      if (!nzchar(id)) next
      fila <- r0 + i
      malo <- function(valor, motivo) problemas[[length(problemas) + 1L]] <<- list(fila = fila, id_manzana = id, valor = as.character(valor), motivo = paste0(motivo, " (", h, ")"))
      sexo <- list(); edad <- list(); conteos <- list()
      for (k in ef_cols) {
        v <- .mtr_entero(cuerpo[[k]][i])
        if (identical(v, FALSE)) { malo(cuerpo[[k]][[i]], sprintf("«%s» no es un entero desde cero", cab[[k]])); next }
        if (is.na(v)) next
        celda <- sub(.MTR_EFECTIVAS, "", cab[[k]], fixed = TRUE)
        if (celda %in% .MTR_SEXOS) sexo[[celda]] <- v else edad[[celda]] <- v
      }
      for (k in cod_cols) {
        v <- .mtr_entero(cuerpo[[k]][i])
        if (identical(v, FALSE)) { malo(cuerpo[[k]][[i]], sprintf("El conteo del código %s no es un entero desde cero", trimws(sub("·.*$", "", cab[[k]])))); next }
        if (!is.na(v)) conteos[[trimws(sub("·.*$", "", cab[[k]]))]] <- v
      }
      total <- if (length(sexo)) sum(unlist(sexo)) else if (length(edad)) sum(unlist(edad)) else NA
      if (!is.na(total) && !is.na(cod_efectivo)) conteos[[cod_efectivo]] <- as.integer(total)
      if (length(sexo) && length(edad) && sum(unlist(sexo)) != sum(unlist(edad))) {
        malo(sprintf("%d / %d", sum(unlist(sexo)), sum(unlist(edad))), "Las efectivas por sexo y por edad no suman lo mismo")
      }
      fv <- .mte_fecha(col("Fecha de visita")[i])
      fv_crudo <- col("Fecha de visita")[[i]]
      if (is.na(fv) && !is.null(fv_crudo) && !is.na(fv_crudo) && nzchar(trimws(as.character(fv_crudo)))) malo(fv_crudo, "La fecha de visita no se reconoce")
      sr <- trimws(as.character(col("¿Se reemplaza?")[[i]] %||% ""))
      sr <- if (is.na(sr) || !nzchar(sr)) "" else .MTR_SI_NO[match(.mtx_normalizar_nombre(sr), .mtx_normalizar_nombre(.MTR_SI_NO))]
      if (is.na(sr)) { malo(col("¿Se reemplaza?")[[i]], "«¿Se reemplaza?» no es Sí ni No"); sr <- "" }
      reportado <- .mtr_entero(col(.MTR_REPORTADO)[i])
      if (identical(reportado, FALSE)) { malo(col(.MTR_REPORTADO)[[i]], sprintf("«%s» no es un entero desde cero", .MTR_REPORTADO)); reportado <- NA }
      sup <- list()
      for (par in list(c("aprobadas", "Supervisión: aprobadas"), c("no_aprobadas", "Supervisión: no aprobadas"))) {
        v <- .mtr_entero(col(par[[2]])[i])
        if (identical(v, FALSE)) malo(col(par[[2]])[[i]], sprintf("«%s» no es un entero desde cero", par[[2]]))
        else if (!is.na(v)) sup[[par[[1]]]] <- v
      }
      if (!length(sexo) && !length(edad) && !length(conteos) && is.na(fv) && !nzchar(sr) && !length(sup) && is.na(reportado)) next
      por_id[[id]] <- list(efectivas = list(sexo = sexo, edad = edad), conteos = conteos,
                           fecha_visita = if (is.na(fv)) "" else fv, se_reemplaza = sr, supervision = sup,
                           total_reportado = if (is.na(reportado)) NA_integer_ else reportado)
    }
  }
  list(hojas = hojas, por_id = por_id, problemas = problemas)
}
