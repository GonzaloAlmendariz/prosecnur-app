# monitoreo_aulas_estados_desconocidos.R — un estatus que la app no conoce se
# declara, no se traga.
#
# Pedido de Gonzalo (2026-09-12, textual): «no sé ni siquiera si está siendo muy
# robusto ante este nuevo estatus, que es refuerzo por contactar. Creo que sería
# bueno tener ahí un mecanismo de robustez más importante».
#
# El estado concreto que le preocupaba SÍ se reconoce —`monitoreo_aulas_estado_muestra`
# tiene su rama propia desde el 2026-09-11—, pero su instinto apunta al hueco de
# verdad: **el traductor termina en un `default` que devuelve `sin_contactar`**.
# Un estatus que alguien teclee mañana en la hoja —o uno que hoy se escriba con
# otra ortografía— no falla ni avisa: cae en el estado de los titulares que
# nunca se tocaron, vuelve a la cola de llamadas y se cuenta como trabajo
# pendiente. Es la misma avería que B13b documenta para «EN CONTACTO» y
# «RECHAZO», que durante un tiempo degradaban al default: un rechazo tecleado
# volvía a la cola como si nadie hubiera llamado.
#
# **El detector se deriva del traductor, no lo copia.** Tener aquí una lista de
# estados reconocidos sería una segunda copia del vocabulario que envejecería
# sola — exactamente el defecto que este operativo ya pagó cuatro veces. En vez
# de eso se le pregunta al propio traductor: si devuelve el estado por defecto
# para un texto que NO es ese estado por defecto, es que cayó por el default.

# La ortografía canónica del estado al que cae todo lo desconocido. Es lo único
# que hay que saber para distinguir «cayó porque lo dice» de «cayó porque no se
# reconoció», y se comprueba contra el traductor en el test.
.maed_POR_DEFECTO <- "sin_contactar"

#' Los estatus de la hoja que la app no sabe leer.
#'
#' @param valores textos crudos de la columna STATUS MUESTRA (un vector).
#' @return `data.frame` de dos columnas —`valor` y `filas`— con un renglón por
#'   estatus desconocido distinto, ordenado de más frecuente a menos. Sin
#'   desconocidos devuelve un `data.frame` de cero filas, nunca `NULL`: un
#'   consumidor que hace `nrow()` no tiene que distinguir dos vacíos.
#' @export
monitoreo_aulas_estados_muestra_desconocidos <- function(valores) {
  vacio <- data.frame(valor = character(0), filas = integer(0),
                      stringsAsFactors = FALSE)
  txt <- trimws(as.character(unlist(valores %||% character(0), use.names = FALSE)))
  txt <- txt[!is.na(txt) & nzchar(txt)]
  if (!length(txt)) return(vacio)

  # Una sola llamada al traductor por ortografía distinta: la hoja del operativo
  # trae 174 filas y las ortografías son media docena.
  unicos <- unique(txt)
  desconocido <- vapply(unicos, function(v) {
    clave <- monitoreo_aulas_estado_muestra(v)
    if (!identical(clave, .maed_POR_DEFECTO)) return(FALSE)
    # Cayó en el estado por defecto: o lo dice de verdad, o no se reconoció.
    # Se distingue normalizando el texto igual que el traductor y comparando
    # con la forma canónica — sin volver a enumerar nada.
    !identical(.maed_clave(v), gsub("_", " ", .maed_POR_DEFECTO, fixed = TRUE))
  }, logical(1), USE.NAMES = FALSE)

  if (!any(desconocido)) return(vacio)
  raros <- unicos[desconocido]
  n <- vapply(raros, function(v) sum(txt == v), integer(1), USE.NAMES = FALSE)
  ord <- order(-n, raros)
  data.frame(valor = raros[ord], filas = n[ord], stringsAsFactors = FALSE)
}

# La misma normalización que hace el traductor antes de decidir. Vive aquí
# porque el traductor la aplica inline; si algún día se extrae allá, esta se
# borra y se llama a aquélla.
.maed_clave <- function(x) {
  k <- .monitoreo_text_key(.monitoreo_scalar(x, ""))
  k <- gsub("_", " ", k, fixed = TRUE)
  k <- gsub("[^a-z ]", "", k)
  trimws(gsub("[[:space:]]+", " ", k))
}

#' La frase que lo cuenta, o vacía cuando no hay nada que contar.
#'
#' Dice el texto tal cual está escrito en la hoja —no su versión normalizada—
#' porque lo que hay que ir a corregir es la celda, y dice **a qué estado se
#' está cayendo**, que es lo que convierte el aviso en una consecuencia: sin
#' eso, «hay un estatus raro» no explica por qué esa aula sigue en la cola de
#' llamadas.
#'
#' @param desconocidos salida de `monitoreo_aulas_estados_muestra_desconocidos()`.
#' @return una cadena; vacía si no hay desconocidos.
#' @export
monitoreo_aulas_estados_desconocidos_texto <- function(desconocidos) {
  if (is.null(desconocidos) || !nrow(desconocidos)) return("")
  piezas <- sprintf("«%s» (%d fila%s)", desconocidos$valor, desconocidos$filas,
                    ifelse(desconocidos$filas == 1L, "", "s"))
  sprintf(paste("La hoja trae %d estatus de muestra que la app no reconoce y",
                "está leyendo como «SIN CONTACTAR», así que esas aulas vuelven",
                "a la cola de llamadas: %s."),
          nrow(desconocidos), paste(piezas, collapse = "; "))
}
