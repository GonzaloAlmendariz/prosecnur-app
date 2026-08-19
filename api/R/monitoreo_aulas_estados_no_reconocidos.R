# Que valores de STATUS MUESTRA se leyeron como «sin contactar» sin serlo.
#
# `monitoreo_aulas_estado_muestra()` es una LISTA CERRADA: reconoce `agendada`,
# `reagendada`, `reemplazada` y `en reserva N`, y **todo lo demas cae al default
# `sin_contactar`**. Medido: «aplicada», «contactada», «en campo», «cerrada»,
# «parcial» y «efectiva» salen las seis como `sin_contactar`.
#
# En blanco y `-` SI son «todavia nada aqui» —1 810 de 2 040 celdas del estudio
# de 2025 son `-`— y para esos el default es la respuesta correcta. El problema
# es el resto: una reserva cuyo STATUS MUESTRA dijera «aplicada» pasa a
# `sin_contactar`, y `sin_contactar` es justamente lo que
# `monitoreo_aulas_reservas_disponibles()` cuenta como reserva LIBRE y lo que la
# cola de contacto manda a llamar. Se ofreceria otra vez un aula que ya esta en
# campo.
#
# Y la red que deberia avisar esta anulada aguas arriba: `estadoDeAplicacion.ts`
# promete que «un estado que el motor no declare no se descarta en silencio: se
# cuenta en `desconocidas`», pero cuando esas filas llegan al frontend ya son
# `sin_contactar`, asi que ese contador **no puede dispararse nunca**.
#
# Esto NO cambia el mapeo —hacerlo tocaria todos los consumidores que hoy
# switchean sobre `sin_contactar`—: lo hace VISIBLE, que es lo que faltaba.
# Cambiar el default es una decision aparte y con su propio gate.

#' Valores crudos de STATUS MUESTRA que el normalizador no reconoce.
#'
#' @param plan filas del plan SIN normalizar. Con el plan ya normalizado
#'   devuelve vacio por construccion, que es justo lo que hay que evitar.
#' @return lista con `total` (filas afectadas) y `valores` (los distintos, con
#'   su cuenta, de mayor a menor).
#' @export
monitoreo_aulas_estados_no_reconocidos <- function(plan = list()) {
  vacio <- list(total = 0L, valores = list())
  if (!length(plan)) return(vacio)

  crudos <- vapply(plan, function(u) trimws(as.character(u$sample_status %||% "")), character(1))
  # En blanco y las variantes de «todavia nada aqui» del Excel no son un
  # problema: para ellas `sin_contactar` es la lectura correcta.
  # `sin_contactar` es la SALIDA canonica del normalizador, y como tal tambien
  # cae a su propio default: sin esta linea el chequeo se denunciaba a si mismo y
  # marcaba como raro un plan perfectamente normalizado.
  declara_nada <- !nzchar(crudos) | grepl("^-+$", crudos) |
    tolower(crudos) %in% c("sin_contactar", "sin contactar")
  # Se pregunta a la FUNCION REAL en vez de reescribir su lista aqui: una copia
  # de los estados reconocidos se desincronizaria en cuanto alguien añada uno, y
  # este chequeo dejaria de avisar precisamente cuando mas falta hiciera.
  cae_al_default <- vapply(crudos, function(x) {
    identical(monitoreo_aulas_estado_muestra(x), "sin_contactar")
  }, logical(1), USE.NAMES = FALSE)

  raros <- crudos[!declara_nada & cae_al_default]
  if (!length(raros)) return(vacio)

  tabla <- sort(table(raros), decreasing = TRUE)
  list(
    total = as.integer(length(raros)),
    valores = lapply(names(tabla), function(v) list(valor = v, aulas = as.integer(tabla[[v]])))
  )
}

#' El aviso en palabras, con la consecuencia por delante.
#'
#' @param x lo que devuelve `monitoreo_aulas_estados_no_reconocidos()`.
#' @return una frase.
#' @export
monitoreo_aulas_estados_no_reconocidos_texto <- function(x) {
  if (!length(x) || !length(x$total) || x$total <= 0L) {
    return("Todos los valores de STATUS MUESTRA se reconocieron.")
  }
  muestra <- utils::head(x$valores, 3)
  nombres <- paste(vapply(muestra, function(v) sprintf("«%s» (%d)", v$valor, v$aulas), character(1)),
                   collapse = ", ")
  restantes <- length(x$valores) - length(muestra)
  sprintf(
    paste0(
      "%d aulas se cuentan como SIN CONTACTAR sin estarlo: su STATUS MUESTRA trae un ",
      "valor que el lector no reconoce, y todo lo no reconocido se lee como vacio. %s%s ",
      "Mientras siga asi se pueden ofrecer como reserva libre, o mandar a llamar, aulas ",
      "que ya estan en campo. Corrige la hoja o pide que se añada ese estado."
    ),
    x$total,
    nombres,
    if (restantes > 0L) sprintf(" y %d valor%s mas.", restantes, if (restantes == 1L) "" else "es") else "."
  )
}
