# Leer las hojas del libro de aulas desde Google Sheets.
#
# La otra puerta del mismo ciclo. `aulas_agendadas_leer()` entra por el `.xlsx`;
# esto entra por la pestaña que el equipo llena en linea, que es lo que pasa
# cuando el operativo esta en marcha y nadie quiere descargar un archivo para
# ver como va.
#
# NO publica nada. La publicacion a Sheets solo escribe pestañas CONTROLADAS
# —`.monitoreo_sheets_controlled_tab_names()`, 99 nombres y ninguno de aulas— y
# eso es deliberado: las tres hojas del libro las llena el equipo, y una
# publicacion que las tocara borraria su trabajo. El sentido App -> Sheets es
# una siembra, no una sincronizacion.
#
# La trampa que resuelve este modulo: la API de Sheets devuelve las filas
# DENTADAS. Recorta las celdas vacias del final de cada fila, asi que en la hoja
# de agenda —241 columnas— una fila cuyo ultimo dato esta en la columna 180 llega
# con 180 celdas. Pasarlas asi a un `data.frame` corre las columnas de esa fila y
# el lector empieza a leer `HORA` donde hay `DIA`. El relleno no es cosmetico:
# sin el, los datos salen desplazados y en silencio.

# Una matriz rectangular de texto a partir de las filas de la API.
.cads_rectangular <- function(values) {
  filas <- lapply(values %||% list(), function(f) as.character(unlist(f, use.names = FALSE)))
  if (!length(filas)) return(NULL)
  ancho <- max(vapply(filas, length, integer(1)))
  if (!is.finite(ancho) || ancho < 1L) return(NULL)
  # `f[seq_len(ancho)]` ES el relleno: indexar mas alla del largo da `NA`, y con
  # todas las filas del mismo largo `rbind` ya no recicla. Comprobado por
  # mutantes, que corrigieron dos cosas que yo creia:
  #   - un `if` que añadia `rep("", ...)` a mano era codigo muerto (siete tests
  #     seguian verdes sin el);
  #   - la sustitucion de `NA` de abajo TAMPOCO sostiene el caso (idem), asi que
  #     se queda como red por si la API manda un `NA` de verdad, no como la
  #     linea que arregla el dentado.
  # Quitar esta linea SI pone el test en rojo. Sheets recorta por el FINAL,
  # nunca por delante, asi que el hueco siempre cae a la derecha.
  m <- do.call(rbind, lapply(filas, function(f) f[seq_len(ancho)]))
  m[is.na(m)] <- ""
  m
}

#' Filas del plan a partir de los valores crudos de una pestaña de Sheets.
#'
#' @param values filas tal como las devuelve `spreadsheets.values.get`.
#' @param hoja cual de las tres hojas del libro es.
#' @return las mismas filas de plan que producen los lectores del `.xlsx`.
#' @export
aulas_libro_desde_valores <- function(values, hoja = c("agendadas", "aplicadas", "control")) {
  hoja <- match.arg(hoja)
  m <- .cads_rectangular(values)
  # Una pestaña con solo la cabecera no es un error: es el libro recien sembrado
  # y todavia sin llenar.
  if (is.null(m) || nrow(m) < 2L) return(list())

  # `aplicadas` y `control` llevan DOS filas de cabecera —grupo y campo—; la de
  # agenda lleva una. Es el mismo reparto que usa el generador.
  n_cabecera <- if (identical(hoja, "agendadas")) 1L else 2L
  if (nrow(m) <= n_cabecera) return(list())
  titulos <- as.character(m[n_cabecera, ])
  cuerpo <- as.data.frame(m[-seq_len(n_cabecera), , drop = FALSE], stringsAsFactors = FALSE)

  switch(
    hoja,
    agendadas = aulas_agendadas_a_plan(cuerpo, titulos),
    aplicadas = aulas_aplicadas_a_partes(cuerpo, titulos),
    control = base_control_a_filas(cuerpo, titulos)
  )
}

# El rol de la fuente decide QUE hoja es. `monitoreo_sync_fuentes.R` ya declara
# los tres —`MONITOREO_AULAS_LIBRO_ROLES`— y su comentario ya anticipaba este
# caso: «el libro entero puede vivir en Drive como un Sheet de tres pestanas, y
# entonces llega como `google_sheets` con el mismo rol». Lo que faltaba era
# justo esta traduccion: sin ella, una pestaña del libro se leia como una tabla
# de respuestas cualquiera.
AULAS_LIBRO_HOJA_POR_ROL <- c(
  agendamiento = "agendadas",
  parte_campo  = "aplicadas",
  control      = "control"
)

#' La hoja del libro que corresponde a un rol de fuente.
#'
#' @param rol uno de `MONITOREO_AULAS_LIBRO_ROLES`.
#' @return `"agendadas"`, `"aplicadas"`, `"control"`, o `""` si no es del libro.
#' @export
aulas_libro_hoja_por_rol <- function(rol) {
  clave <- tolower(trimws(as.character(rol %||% "")[1]))
  if (is.na(clave) || !nzchar(clave)) return("")
  # `[[` con un nombre que no esta LANZA, no devuelve NULL, asi que el `%||%`
  # nunca llegaba a correr: un rol desconocido reventaba en vez de contestar
  # «esta fuente no es del libro». Lo caza el test del rol «respuestas».
  if (!clave %in% names(AULAS_LIBRO_HOJA_POR_ROL)) return("")
  unname(AULAS_LIBRO_HOJA_POR_ROL[[clave]])
}

#' Filas del plan a partir de una pestaña de Sheets y el rol de su fuente.
#'
#' @param values filas crudas de la API.
#' @param rol rol declarado en la fuente.
#' @return filas de plan, o `list()` si el rol no es de una hoja del libro.
#' @export
aulas_libro_desde_fuente <- function(values, rol) {
  hoja <- aulas_libro_hoja_por_rol(rol)
  # Un rol que no es del libro NO se adivina: devolver «agendadas» por defecto
  # leeria una tabla de respuestas como si fuera la agenda y produciria filas de
  # plan inventadas.
  if (!nzchar(hoja)) return(list())
  aulas_libro_desde_valores(values, hoja)
}
