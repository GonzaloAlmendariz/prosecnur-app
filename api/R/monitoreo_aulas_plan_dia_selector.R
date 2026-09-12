# El selector de día de «Plan del día» en Google Sheets — unidad B20 (v4-app).
#
# Dictado de Gonzalo (2026-09-01, textual): «debería tener algún selector de
# día: quiero escoger qué me toca el día quince… y en función del desplegable
# —que lógicamente filtra solo los días donde hay aplicación— se muestra lo
# que se tiene que hacer ese día».
#
# El bloque corona la hoja publicada SIN reemplazar el listado (que se
# conserva completo debajo, como siempre):
#
#   fila 1  «VER EL DÍA:» | celda elegible (dataValidation ONE_OF_LIST con
#           EXACTAMENTE los días que tienen aplicación — una retirada no abre
#           día: ofrecerla sería mandar gente a un aula que ya no existe)
#   fila 2  «PLAN DEL DÍA ELEGIDO»
#   fila 3  cabecera repetida del listado (las filas filtradas salen rotuladas)
#   fila 4  la celda de la FÓRMULA de filtro; su spill ocupa las filas
#           reservadas debajo (tantas como el día más cargado, para que el
#           desborde nunca choque con el listado)
#   …       una fila en blanco de separación
#   luego   el listado completo de siempre (cabecera + filas)
#
# Mecánica de escritura (precedente exacto: el arrastre B9):
#   - El bloque viaja como TEXTO en el values:batchUpdate RAW del motor; la
#     celda de la fórmula va vacía ahí (RAW la dejaría como texto sin
#     computar).
#   - Tras cada escritura efectiva de la hoja, `.mapds_formula_publicar` PUT-ea
#     la fórmula por rango con `valueInputOption=USER_ENTERED` — el mismo canal
#     del arrastre.
#   - Para comparar lo producido con lo remoto, `.mapds_mascara` blanquea la
#     celda elegible (es del USUARIO: su elección no es un cambio del libro) y
#     el área de la fórmula (la API devuelve el spill COMPUTADO, que jamás
#     coincide con el vacío sembrado) — el precedente exacto de
#     `.malar_mascara_arrastre` en el `libro_cambio` del publicador.
#
# DECISIÓN (documentada, del implementador): el bloque es SOLO de la
# publicación a Sheets. El `.xlsx` descargable conserva el listado puro: la
# fórmula de filtro y el desplegable son conducta VIVA del documento, y un
# snapshot estático con una fórmula que no recalcula sería ruido, no un
# selector. Si algún día el xlsx lo quiere, se decide ahí con dataValidation
# de openxlsx propia.
#
# Sin días con aplicación no hay bloque: la hoja sale como hoy y ningún
# desplegable ofrece una lista vacía.

.mapds_ETIQUETA_SELECTOR <- "VER EL DÍA:"
.mapds_ETIQUETA_AREA <- "PLAN DEL DÍA ELEGIDO"

#' Lo que dice el área cuando todavía no se ha elegido día.
#'
#' **Una zona en blanco no se lee como «sin elegir», se lee como ROTA.** El
#' bloque reserva tantas filas como el día más cargado para que el desborde de
#' la fórmula no choque con el listado, así que sin día elegido el usuario ve
#' veinticinco filas vacías entre dos cabeceras iguales. Gonzalo, 2026-09-10,
#' abriendo el libro: «el plan del día estaba bugueado, que había como filas
#' arriba que estaban vacías, que no se estaban mostrando bien».
#'
#' No lo estaba: estaba sin usar. Pero para quien abre la hoja es lo mismo, y
#' el arreglo es que el hueco diga qué hacer en vez de callarse. La flecha
#' apunta al desplegable, que está justo encima.
#' @keywords internal
.mapds_SIN_DIA_ELEGIDO <- "▲ Elige un día arriba para ver sólo lo de ese día."

# Las filas (1-based) que traen la cabecera del listado — «FECHA AGENDADA» y
# «CURSO-HORARIO» juntas. Con bloque hay dos (la repetida del área y la del
# listado); la del LISTADO es la última, mismo criterio que el contrato.
.mapds_filas_cabecera <- function(values) {
  which(vapply(seq_along(values), function(i) {
    fila <- trimws(as.character(unlist(values[[i]] %||% list(), use.names = FALSE)))
    ("FECHA AGENDADA" %in% fila) && ("CURSO-HORARIO" %in% fila)
  }, logical(1)))
}

# Posición (fila, col) 1-based de una etiqueta exacta, o NULL si no está.
.mapds_pos <- function(values, etiqueta) {
  for (i in seq_along(values)) {
    fila <- trimws(as.character(unlist(values[[i]] %||% list(), use.names = FALSE)))
    j <- which(fila == etiqueta)
    if (length(j)) return(c(fila = i, col = j[[1]]))
  }
  NULL
}

# Las fechas de las filas-aula del listado (código NO vacío: los totales y la
# sección de pendientes declaran vacío en CURSO-HORARIO justamente para no
# contarse como aulas). Una por fila; el llamador agrupa o deduplica.
.mapds_fechas_aula <- function(values) {
  cabeceras <- .mapds_filas_cabecera(values)
  if (!length(cabeceras)) return(character(0))
  fc <- cabeceras[[length(cabeceras)]]
  if (fc >= length(values)) return(character(0))
  cab <- trimws(as.character(unlist(values[[fc]], use.names = FALSE)))
  col_fecha <- match("FECHA AGENDADA", cab)
  col_codigo <- match("CURSO-HORARIO", cab)
  if (is.na(col_fecha) || is.na(col_codigo)) return(character(0))
  fechas <- character(0)
  for (i in seq.int(fc + 1L, length(values))) {
    fila <- as.character(unlist(values[[i]] %||% list(), use.names = FALSE))
    codigo <- if (length(fila) >= col_codigo) trimws(fila[[col_codigo]]) else ""
    if (!nzchar(codigo)) next
    fecha <- if (length(fila) >= col_fecha) trimws(fila[[col_fecha]]) else ""
    if (nzchar(fecha)) fechas <- c(fechas, fecha)
  }
  fechas
}

# Los días con aplicación, ascendentes (ISO es lexicográfico): las opciones
# EXACTAS del desplegable.
.mapds_dias <- function(values) {
  sort(unique(.mapds_fechas_aula(values)))
}

# Corona el listado con el bloque selector. Sin días con aplicación devuelve
# el listado intacto (sin bloque no hay nada que elegir).
.mapds_con_selector <- function(listado) {
  listado <- listado %||% list()
  fechas <- .mapds_fechas_aula(listado)
  if (!length(fechas)) return(listado)
  cabeceras <- .mapds_filas_cabecera(listado)
  cab <- listado[[cabeceras[[length(cabeceras)]]]]
  # Tantas filas reservadas como aulas trae el día más cargado: el spill del
  # filtro nunca alcanza el listado (FILTER revienta con #REF! si el desborde
  # choca con una celda ocupada).
  #
  # **Y con HOLGURA, porque la reserva justa dura hasta la siguiente agenda.**
  # Medido en el operativo el 2026-09-12: el día más cargado traía 24 aulas y la
  # reserva era de 24 exactas — cero filas de margen. El equipo agenda en vivo,
  # así que basta UNA aula más en ese día para que el bloque reviente en `#REF!`
  # y se quede así hasta la próxima publicación; y el bloque es el que contesta
  # «qué toca hoy». El margen no cuesta nada —son filas en blanco sobre una hoja
  # que se regenera entera— y compra las agendaciones de una jornada.
  cargado <- max(as.integer(table(fechas)))
  reserva <- cargado + max(4L, as.integer(ceiling(cargado * 0.25)))
  c(
    list(list(.mapds_ETIQUETA_SELECTOR, "")),
    list(list(.mapds_ETIQUETA_AREA)),
    list(cab),
    rep(list(list("")), reserva),
    list(list("")),
    listado
  )
}

# La geometría del bloque, derivada del CONTENIDO producido (jamás números
# mágicos): se computa sobre los values locales y se aplica igual al remoto,
# como la máscara geométrica del arrastre. NULL cuando la hoja no lleva bloque.
.mapds_geometria <- function(values) {
  values <- values %||% list()
  sel <- .mapds_pos(values, .mapds_ETIQUETA_SELECTOR)
  if (is.null(sel)) return(NULL)
  cabeceras <- .mapds_filas_cabecera(values)
  if (length(cabeceras) < 2L) return(NULL)
  fc_area <- cabeceras[[1L]]
  fc_listado <- cabeceras[[length(cabeceras)]]
  cab <- trimws(as.character(unlist(values[[fc_listado]], use.names = FALSE)))
  list(
    sel_fila = as.integer(sel[["fila"]]),
    sel_col = as.integer(sel[["col"]]),
    fila_formula = as.integer(fc_area + 1L),
    fila_cabecera_listado = as.integer(fc_listado),
    n_filas = length(values),
    n_cols = length(cab),
    col_fecha = match("FECHA AGENDADA", cab),
    col_codigo = match("CURSO-HORARIO", cab)
  )
}

# LA fórmula del área del día elegido — UN solo sitio a propósito: el lead va
# a medir en vivo el separador antes de cerrar B20 y esta función es lo único
# que habría que ajustar si la medición dice otra cosa.
#
# Separador de argumentos «;» SIEMPRE, jamás coma fuera de comillas: la única
# medición en vivo del repo (monitoreo_aulas_libro_arrastre.R, 2026-09-01)
# muestra el spreadsheet real del operativo en locale de coma DECIMAL, donde
# USER_ENTERED parsea «como si el usuario tipeara» y una coma multi-arg se
# rompe o cambia de sentido. Los editores de Google aceptan «;» en todos los
# locales y lo normalizan al separador canónico — comportamiento documentado,
# NO medido en vivo por este repo: hueco declarado del cierre de B20.
#
# El filtro: fecha de la fila = día elegido Y código de aula no vacío — los
# totales caen por la fecha-rótulo y las pendientes re-listadas por su código
# vacío, así que el área enseña SOLO las aulas del día. Selector vacío = área
# vacía; un día sin filas (una elección rancia tras replanear) declara su
# vacío en texto, jamás un #N/A pelado.
#
# **El selector se compara como TEXTO, y ahí estaba el defecto.**
#
# Medido sobre el Sheets publicado el 2026-09-04: con «2026-09-09» elegido, el
# área decía «Sin aulas agendadas para ese día» mientras el listado de abajo
# traía su curso-horario. La causa es de tipos y afectaba a TODOS los días, no
# a uno:
#
#   - la columna de fechas se escribe con `valueInputOption=RAW` —decisión
#     documentada del publicador, para que Sheets no parsee «0205» ni fechas
#     por locale—, así que es TEXTO;
#   - el desplegable ofrece esos mismos textos, pero elegir una opción equivale
#     a TIPEARLA, y Sheets sí parsea lo tipeado: la celda queda con una FECHA.
#
# Texto igual a fecha es siempre falso, así que el filtro no devolvía nunca
# nada. Se normaliza el lado del SELECTOR, que es una celda escalar: `TEXT` con
# el patrón ISO si Sheets lo convirtió en fecha, y el texto tal cual si no. Del
# otro lado no hace falta —la columna es texto por construcción— y además
# normalizar un rango dentro de `FILTER` dependería de que `TEXT` vectorice,
# que es justo lo que no conviene apostar en una fórmula que no se puede
# probar sin publicar.
.mapds_formula <- function(geo) {
  sel <- sprintf("$%s$%d", .malar_col_a1(geo$sel_col + 1L), geo$sel_fila)
  # El día elegido, siempre como «YYYY-MM-DD».
  sel_txt <- sprintf('IF(ISNUMBER(%s);TEXT(%s;"yyyy-mm-dd");TO_TEXT(%s))', sel, sel, sel)
  desde <- geo$fila_cabecera_listado + 1L
  hasta <- geo$n_filas
  rango <- function(col) {
    letra <- .malar_col_a1(col)
    sprintf("%s%d:%s%d", letra, desde, letra, hasta)
  }
  sprintf(
    paste0(
      '=IF(%s="";%s;IFERROR(FILTER(%s%d:%s%d;%s=%s;%s<>"");',
      '"Sin aulas agendadas para ese día."))'
    ),
    sel, sprintf('"%s"', .mapds_SIN_DIA_ELEGIDO),
    .malar_col_a1(1L), desde, .malar_col_a1(geo$n_cols), hasta,
    rango(geo$col_fecha), sel_txt,
    rango(geo$col_codigo)
  )
}

# PUT de la fórmula por rango con USER_ENTERED — el canal del arrastre (B9):
# no puede ir en el batch RAW (quedaría texto sin computar) ni subir el batch
# a USER_ENTERED (Sheets parsearía «0205» y fechas por locale). Se llama tras
# CADA escritura efectiva de la hoja: el rectángulo recién escrito dejó la
# celda vacía.
# Deja REALMENTE vacías las celdas de la reserva. Dos rangos y no uno: la fila
# de la fórmula conserva su columna A —ahí va la fórmula— y se limpian sus
# demás columnas; de la fila siguiente hasta el final de la reserva se limpia
# todo el ancho. Nunca toca el listado, que empieza en `fila_cabecera_listado`.
.mapds_vaciar_area <- function(spreadsheet_id, hoja, geo) {
  h <- .monitoreo_sheets_quote_sheet(hoja)
  ultima <- geo$fila_cabecera_listado - 2L   # la de encima del renglón separador
  if (is.na(ultima) || ultima < geo$fila_formula) return(invisible(FALSE))
  ancho <- .malar_col_a1(max(1L, as.integer(geo$n_cols)))
  rangos <- c(
    if (geo$n_cols > 1L) sprintf("%s!B%d:%s%d", h, geo$fila_formula, ancho, geo$fila_formula),
    if (ultima > geo$fila_formula) sprintf("%s!A%d:%s%d", h, geo$fila_formula + 1L, ancho, ultima)
  )
  if (!length(rangos)) return(invisible(FALSE))
  # `values:batchClear` y no un `:clear` por rango: el segundo pide un cuerpo
  # vacío y `list()` de R se serializa como `[]`, que Google rechaza con
  # «Root element must be a message» — el error se tragaba en silencio y el
  # área seguía escrita. Éste lleva sus rangos DENTRO del cuerpo, así que no
  # hay cuerpo vacío que serializar mal, y limpia los dos de una sola llamada.
  #
  # Un fallo aquí no tumba la publicación: la hoja ya está escrita y lo peor que
  # pasa es que el bloque siga sin expandirse, que es el estado de antes.
  tryCatch(.monitoreo_google_api(
    paste0(.monitoreo_sheets_api_base(spreadsheet_id), "/values:batchClear"),
    method = "POST", body = list(ranges = as.list(rangos))),
    error = function(e) NULL)
  invisible(TRUE)
}

.mapds_formula_publicar <- function(spreadsheet_id, hoja, values) {
  geo <- .mapds_geometria(values)
  if (is.null(geo)) return(invisible(FALSE))
  # **Antes de la fórmula, VACIAR de verdad el área del desborde.**
  #
  # Ésta es la causa real del `#REF!` que el operativo arrastró toda la jornada
  # del 2026-09-12, y costó tres hipótesis falsas averiguarla. La hoja se
  # escribe como un RECTÁNGULO, así que Sheets rellena con **cadena vacía**
  # todas las celdas de las filas de reserva. Una cadena vacía **no es una
  # celda vacía**: `ISBLANK` la da por ocupada y `FILTER` se niega a expandirse
  # sobre ella con «Array result was not expanded because it would overwrite
  # data in B4».
  #
  # Y es invisible desde fuera: `values.get` devuelve "" igual que para una
  # celda vacía, y `includeGridData` no le ve `userEnteredValue`. Por eso el
  # área «estaba limpia» en todas las mediciones y el bloque seguía roto.
  # Reescribir la fórmula tampoco servía —el estorbo no estaba en la fórmula—.
  #
  # `updateCells` con `fields = "userEnteredValue"` y filas sin valor deja las
  # celdas REALMENTE vacías. Sólo el rectángulo de la reserva: la fila de la
  # fórmula y el listado de abajo no se tocan.
  .mapds_vaciar_area(spreadsheet_id, hoja, geo)
  rango <- sprintf("%s!A%d", .monitoreo_sheets_quote_sheet(hoja), geo$fila_formula)
  .monitoreo_google_api(
    paste0(
      .monitoreo_sheets_api_base(spreadsheet_id),
      "/values/", utils::URLencode(rango, reserved = TRUE),
      "?valueInputOption=USER_ENTERED"
    ),
    method = "PUT",
    body = list(
      range = rango, majorDimension = "ROWS",
      values = list(list(.mapds_formula(geo)))
    )
  )
  # **Y se MIRA lo que quedó.** Escribir la fórmula y devolver TRUE sin leerla
  # es declarar éxito sin comprobar el resultado: el 2026-09-12 el recibo decía
  # «Plan del día: actualizada» mientras la celda del área estaba en `#REF!` —
  # el bloque que contesta «qué toca hoy»— y nadie se enteró hasta que alguien
  # la leyó a mano diez horas después.
  #
  # Un GET de UNA celda. Si Sheets devolvió un error de fórmula, se nombra y
  # viaja al recibo; el resto de la publicación no se toca, porque la hoja SÍ se
  # escribió y revertirla sería peor. Un fallo del propio GET no inventa un
  # problema: se calla, que es distinto de callar el `#REF!` que sí se vio.
  leer_celda <- function() tryCatch({
    r <- .monitoreo_google_api(paste0(
      .monitoreo_sheets_api_base(spreadsheet_id),
      "/values/", utils::URLencode(rango, reserved = TRUE)))
    trimws(.monitoreo_scalar(((r$values %||% list())[[1]] %||% list())[[1]], ""))
  }, error = function(e) "")
  es_error <- function(x) grepl("^#(REF|N/A|VALUE|NAME|DIV/0|NULL|ERROR)", x)

  computado <- leer_celda()
  if (!es_error(computado)) return(invisible(TRUE))

  # **Un error puede ser un recuerdo, no un hecho.** Medido en el operativo el
  # 2026-09-12: la celda decía `#REF!` y Google daba el motivo exacto —«Array
  # result was not expanded because it would overwrite data in B4»— con B4
  # VACÍA (sin `userEnteredValue`, sin combinaciones, sin rangos protegidos) y
  # el día elegido cabiendo de sobra: 18 filas para una reserva de 24. O sea,
  # el estorbo existió, desapareció, y el resultado se quedó cacheado: `FILTER`
  # no es volátil, así que mientras ninguna de sus entradas cambie Google sirve
  # el error viejo aunque ya no sea cierto. Abrir el documento tampoco lo
  # recalcula, que era la salida que se había supuesto.
  #
  # Reescribir la MISMA fórmula no basta —Sheets ve el mismo contenido—, así
  # que se vacía la celda y se vuelve a poner: eso sí obliga al recálculo. Sólo
  # cuando YA se vio un error, nunca de rutina, y sólo sobre la celda de la
  # app. Si después de eso el error sigue, entonces es un hecho y viaja al
  # recibo.
  poner <- function(valor) .monitoreo_google_api(
    paste0(
      .monitoreo_sheets_api_base(spreadsheet_id),
      "/values/", utils::URLencode(rango, reserved = TRUE),
      "?valueInputOption=USER_ENTERED"
    ),
    method = "PUT",
    body = list(range = rango, majorDimension = "ROWS", values = list(list(valor)))
  )
  reintento <- tryCatch({
    poner("")
    poner(.mapds_formula(geo))
    leer_celda()
  }, error = function(e) computado)
  if (es_error(reintento)) return(invisible(reintento))
  invisible(TRUE)
}

# La dataValidation ONE_OF_LIST de la celda elegible, con EXACTAMENTE los días
# que tienen aplicación. Reusa el constructor de la capa de formato del libro
# (`.mafs_validacion_request`: showCustomUi para que el chip se vea,
# strict = FALSE para no pelearse con un valor viejo). Viaja en el batch-2 del
# motor vía `.malp_formato_requests`, después de los values — el reset de una
# pestaña con dims cambiadas borra dataValidation, así que antes sería
# regalarla al borrado.
.mapds_validacion_requests <- function(sheet_id, values) {
  geo <- .mapds_geometria(values)
  if (is.null(geo)) return(list())
  dias <- .mapds_dias(values)
  if (!length(dias)) return(list())
  list(.mafs_validacion_request(
    sheet_id, geo$sel_col + 1L, geo$sel_fila - 1L, geo$sel_fila, as.list(dias)
  ))
}

# La máscara para comparar lo producido con lo remoto (precedente exacto:
# `.malar_mascara_arrastre` en el `libro_cambio` del publicador). Blanquea:
#   - la celda elegible: es del USUARIO — su elección no es un cambio del
#     libro y compararla forzaría la reasserción (que la pisaría) en cada
#     Recargar;
#   - el área de la fórmula y su spill (de la fila de la fórmula hasta antes
#     de la cabecera del listado): son DERIVADAS — la API real devuelve el
#     resultado computado, que jamás coincide con el vacío sembrado.
# Geométrica y derivada de los values LOCALES: se aplica igual a ambos lados,
# dé igual si el remoto trae la fórmula cruda (mock), el spill computado (API
# real) o el vacío de la siembra.
.mapds_mascara <- function(values, geo) {
  values <- values %||% list()
  if (is.null(geo)) return(values)
  if (geo$sel_fila <= length(values)) {
    fila <- as.list(values[[geo$sel_fila]] %||% list())
    if (length(fila) > geo$sel_col) {
      fila[[geo$sel_col + 1L]] <- ""
      values[[geo$sel_fila]] <- fila
    }
  }
  hasta <- min(geo$fila_cabecera_listado - 1L, length(values))
  if (hasta >= geo$fila_formula) {
    for (i in seq.int(geo$fila_formula, hasta)) {
      fila <- as.list(values[[i]] %||% list())
      for (j in seq_along(fila)) fila[[j]] <- ""
      values[[i]] <- fila
    }
  }
  values
}
