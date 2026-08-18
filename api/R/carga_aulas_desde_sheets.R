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
