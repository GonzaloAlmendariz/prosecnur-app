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


# --- códigos que el plan no conoce -------------------------------------------
#
# La hermana del detector de estados, y por el mismo motivo: lo que el libro
# trae y la app no sabe emparejar hay que decirlo, no dejarlo caer.
#
# Medido en el operativo el 2026-09-12: **0 partes y 0 filas de control** con el
# código fuera del plan, y tiene explicación —esas dos hojas las siembra la app
# con los códigos ya puestos, así que el equipo no los teclea—. Donde sí se
# teclean es en el Sheets de la distribución, y ahí había CINCO mal escritos.
# Este detector existe para el día en que esa protección falle: un parte cuyo
# código no case NO cuenta como aplicado, y ese día la cifra de avance baja sin
# que nada falle.

#' Los códigos de una lista de filas que el plan no reconoce.
#'
#' Compara por una clave que colapsa espacios y mayúsculas, así que «CH164» no
#' se declara desconocido si el plan tiene «CH 164»: eso es otra cosa —una
#' celda mal escrita— y confundirlas mandaría a buscar un aula que está ahí.
#'
#' @param filas partes o filas de control.
#' @param plan el plan de la sesión.
#' @return `data.frame` de dos columnas, `codigo` y `filas`; cero filas si todo
#'   casa.
#' @export
monitoreo_aulas_codigos_sin_plan <- function(filas, plan = list()) {
  vacio <- data.frame(codigo = character(0), filas = integer(0),
                      stringsAsFactors = FALSE)
  filas <- filas %||% list()
  if (!length(filas)) return(vacio)
  unidades <- if (is.data.frame(plan)) split(plan, seq_len(nrow(plan))) else (plan %||% list())
  if (!length(unidades)) return(vacio)
  clave <- function(x) toupper(gsub("[[:space:]]+", "", trimws(as.character(x %||% "")[1])))
  conocidos <- unique(vapply(unidades, function(u) {
    clave(u[["operational_code"]] %||% u[["classroom_id"]])
  }, character(1)))
  conocidos <- conocidos[nzchar(conocidos)]

  cods <- vapply(filas, function(f) {
    trimws(as.character((f[["operational_code"]] %||% f[["classroom_id"]] %||% "")[1]))
  }, character(1))
  cods <- cods[!is.na(cods) & nzchar(cods)]
  if (!length(cods)) return(vacio)
  fuera <- cods[!(vapply(cods, clave, character(1), USE.NAMES = FALSE) %in% conocidos)]
  if (!length(fuera)) return(vacio)
  tab <- table(fuera)
  ord <- order(-as.integer(tab), names(tab))
  data.frame(codigo = names(tab)[ord], filas = as.integer(tab)[ord],
             stringsAsFactors = FALSE)
}
