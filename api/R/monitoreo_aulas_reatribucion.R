# monitoreo_aulas_reatribucion.R — «estas respuestas cuentan para otro aula».
#
# **De dónde sale.** El 2026-09-09, con campo activo, un aplicador confundió los
# QR de sus dos aulas: CH 117 y CH 121 quedaron cruzadas y cada una recibió las
# respuestas de la otra. Veintiséis encuestas de Arquitectura contando para Arte
# y Diseño, y un aula que se veía sin aplicar cuando sí se había aplicado.
#
# **Por qué no se arregla en la plataforma.** Lo que Kobo tiene es lo que Kobo
# recibió, y eso es un hecho: editarlo a mano borra la huella de que hubo un
# error y deja el dato crudo diciendo algo que nunca ocurrió. Además son
# decenas de ediciones manuales por incidente, cada una una oportunidad de
# equivocarse otra vez.
#
# Aquí la corrección vive en el PROYECTO, junto a las demás decisiones
# operativas: dice qué respuestas, a qué aula, por qué y cuándo se decidió. Se
# puede leer, auditar y deshacer, y el crudo no se toca. Es el mismo criterio
# con el que el operativo trata todo lo demás: la app no reescribe la realidad,
# la anota.
#
# **Se identifica por el ID de la respuesta, no por una ventana de tiempo.** La
# ventana parece más cómoda —«lo de tal hora a tal hora»— y es justo donde se
# cuela el error siguiente: husos, relojes desfasados, una respuesta que entró
# tarde porque el móvil no tenía señal. El id es exacto y no admite discusión.

#' La columna con el identificador de cada respuesta.
#'
#' Kobo devuelve `_id` y `_uuid`; SurveyMonkey, `response_id`. Se prefiere el
#' que la plataforma considere su clave primaria.
#' @keywords internal
.mar_col_id <- function(data) {
  if (!is.data.frame(data) || !ncol(data)) return("")
  for (k in c("_id", "_uuid", "response_id", "id")) {
    if (k %in% names(data)) return(k)
  }
  ""
}

#' Los identificadores de las respuestas, como texto.
#' @keywords internal
.mar_ids <- function(data) {
  col <- .mar_col_id(data)
  if (!nzchar(col)) return(character(0))
  trimws(as.character(data[[col]]))
}

#' Normaliza la lista de reatribuciones para la whitelist de la config.
#'
#' Cada entrada: `{de, a, ids, motivo, registrado}`. Una entrada sin `a` o sin
#' `ids` no dice nada y se descarta: guardar una corrección que no corrige deja
#' al que lee creyendo que algo se arregló.
#'
#' @param x lo que venga en la config.
#' @return lista de entradas válidas, posiblemente vacía.
#' @export
monitoreo_aulas_reatribuciones_normalizar <- function(x) {
  crudo <- x %||% list()
  if (is.data.frame(crudo)) crudo <- split(crudo, seq_len(nrow(crudo)))
  if (!is.list(crudo)) return(list())
  out <- list()
  for (e in crudo) {
    if (!is.list(e) && !is.data.frame(e)) next
    if (is.data.frame(e)) e <- as.list(e[1, , drop = FALSE])
    a <- trimws(.monitoreo_scalar(e[["a"]] %||% e[["hacia"]], ""))
    ids <- unique(trimws(as.character(unlist(e[["ids"]] %||% character(0), use.names = FALSE))))
    ids <- ids[nzchar(ids)]
    if (!nzchar(a) || !length(ids)) next
    out[[length(out) + 1L]] <- list(
      de = trimws(.monitoreo_scalar(e[["de"]] %||% e[["desde"]], "")),
      a = a,
      ids = as.list(ids),
      motivo = trimws(.monitoreo_scalar(e[["motivo"]], "")),
      registrado = trimws(.monitoreo_scalar(e[["registrado"]], ""))
    )
  }
  out
}

#' Aplica las reatribuciones sobre los códigos de aula ya resueltos.
#'
#' **La última entrada manda.** Si dos corrigen la misma respuesta es que alguien
#' se corrigió a sí mismo, y lo que vale es lo último que decidió; el orden de la
#' lista es el orden en que se decidieron.
#'
#' @param codigos códigos de aula por respuesta, en el orden de `data`.
#' @param data las respuestas.
#' @param cfg config de aulas.
#' @return los mismos códigos con las correcciones aplicadas.
#' @export
monitoreo_aulas_reatribuir <- function(codigos, data, cfg = list()) {
  reglas <- monitoreo_aulas_reatribuciones_normalizar((cfg %||% list())[["reatribuciones"]])
  if (!length(reglas) || !length(codigos)) return(codigos)
  ids <- .mar_ids(data)
  # Sin identificadores no se puede corregir NADA, y forzarlo por posición sería
  # atribuir respuestas al azar. Se devuelven los códigos tal cual.
  if (length(ids) != length(codigos)) return(codigos)
  for (r in reglas) {
    i <- which(ids %in% unlist(r$ids, use.names = FALSE))
    if (length(i)) codigos[i] <- r$a
  }
  codigos
}

#' Propone las reatribuciones de un cruce de QR, para que alguien las confirme.
#'
#' Toma las anomalías de `monitoreo_aulas_respuestas_fuera_de_franja()` y, cuando
#' dos aulas tienen desfases de signo opuesto y magnitud parecida, propone
#' intercambiarlas: es la firma de dos QR confundidos.
#'
#' **Propone, no aplica.** Reatribuir mueve encuestas entre facultades y cambia
#' las cuotas; eso lo decide una persona mirando, igual que el ciclo de la
#' distribución propone y el coordinador dispone.
#'
#' @param unidades filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas.
#' @param tolerancia_min cuánto pueden diferir las dos magnitudes para seguir
#'   pareciendo un intercambio.
#' @return lista de `{de, a, ids, motivo}` lista para confirmar, o vacía.
#' @export
monitoreo_aulas_reatribucion_propuesta <- function(unidades, responses, cfg = list(),
                                                   tolerancia_min = 45) {
  anom <- monitoreo_aulas_respuestas_fuera_de_franja(unidades, responses, cfg)
  if (length(anom) < 2L) return(list())
  ids <- .mar_ids(responses)
  if (!length(ids)) return(list())
  crudos <- tryCatch(trimws(as.character(.mar_codigos_crudos(responses, cfg))),
                     error = function(e) character(0))
  if (length(crudos) != length(ids)) return(list())

  usados <- character(0)
  out <- list()
  for (i in seq_along(anom)) {
    a <- anom[[i]]
    if (a$codigo %in% usados) next
    for (j in seq_along(anom)) {
      if (j == i) next
      b <- anom[[j]]
      if (b$codigo %in% usados) next
      # Signos opuestos y magnitudes parecidas: cada uno llegó cuando tocaba el
      # otro. Con el mismo signo no es un intercambio, es que los dos se
      # movieron, y eso no se resuelve cambiándolos entre sí.
      if (sign(a$desfase_min) == sign(b$desfase_min)) next
      if (abs(abs(a$desfase_min) - abs(b$desfase_min)) > tolerancia_min) next
      motivo <- sprintf(
        "Cruce de QR: lo registrado como %s llegó %d min fuera de su franja y coincide con la de %s.",
        a$codigo, a$desfase_min, b$codigo)
      out[[length(out) + 1L]] <- list(
        de = a$codigo, a = b$codigo,
        ids = as.list(ids[crudos == a$codigo]), motivo = motivo)
      out[[length(out) + 1L]] <- list(
        de = b$codigo, a = a$codigo,
        ids = as.list(ids[crudos == b$codigo]),
        motivo = sprintf(
          "Cruce de QR: lo registrado como %s llegó %d min fuera de su franja y coincide con la de %s.",
          b$codigo, b$desfase_min, a$codigo))
      usados <- c(usados, a$codigo, b$codigo)
      break
    }
  }
  out
}
