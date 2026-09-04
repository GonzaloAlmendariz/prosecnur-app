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
  reserva <- max(as.integer(table(fechas)))
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
      '=IF(%s="";"";IFERROR(FILTER(%s%d:%s%d;%s=%s;%s<>"");',
      '"Sin aulas agendadas para ese día."))'
    ),
    sel,
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
.mapds_formula_publicar <- function(spreadsheet_id, hoja, values) {
  geo <- .mapds_geometria(values)
  if (is.null(geo)) return(invisible(FALSE))
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
