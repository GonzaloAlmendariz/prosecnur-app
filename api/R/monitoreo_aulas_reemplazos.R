# Activar un reemplazo desde la app.
#
# Hasta ahora el plan sabia QUE aula reemplaza a cual —`replacement_for`, la
# cadena `R n.k`, el orden— pero activarla era una decision que se tomaba en un
# chat y se anotaba a mano en el Excel. La consecuencia no es de comodidad: el
# avance sigue contando el aula caida contra su meta, asi que la brecha del
# estudio miente hasta que alguien reescribe la hoja.
#
# Lo que esta funcion hace y lo que NO hace:
#
#   SI  mueve el estado de MUESTRA: la caida a `reemplazada`, su siguiente
#       reserva a `agendada`, y deja el motivo y la marca de tiempo.
#   NO  toca `activation_weight_status`. Ese campo dice que el peso de una
#       reserva es CONDICIONAL por diseno muestral, y el relato de Calculo de
#       muestra lo explica asi. La activacion es un hecho operativo; que el peso
#       se active es una consecuencia que el ponderador deriva de ver una
#       reserva condicional ya agendada.
#   NO  inventa una reserva cuando la cadena se agoto. Devuelve que no hay, con
#       cuantas se habian usado ya.

.mar_txt <- function(x, default = "") {
  v <- suppressWarnings(as.character(x %||% default)[1])
  if (is.na(v)) default else trimws(v)
}

.mar_num <- function(x, default = NA_real_) {
  v <- suppressWarnings(as.numeric(x %||% default)[1])
  if (!length(v) || !is.finite(v)) default else v
}

# El titular de una cadena: para un titular es el mismo, para una reserva es su
# `replacement_for`. Sale del campo, no de la posicion — ver L41.
.mar_titular_de <- function(fila) {
  rf <- .mar_txt(fila$replacement_for)
  if (nzchar(rf)) rf else .mar_txt(fila$operational_code)
}

#' Reservas disponibles para cubrir un aula caida.
#'
#' @param plan filas del plan (formato largo).
#' @param codigo codigo operativo del aula que cae.
#' @return indices de las reservas de esa cadena aun sin usar, en orden.
#' @export
monitoreo_aulas_reservas_disponibles <- function(plan = list(), codigo = "") {
  codigo <- .mar_txt(codigo)
  if (!length(plan) || !nzchar(codigo)) return(integer(0))
  caida <- Filter(function(r) identical(.mar_txt(r$operational_code), codigo), plan)
  if (!length(caida)) return(integer(0))
  cadena <- .mar_titular_de(caida[[1]])
  # Una reserva ya agendada o ya aplicada no esta disponible: esta en campo.
  libres <- c("en_reserva", "sin_contactar", "")
  idx <- which(vapply(plan, function(r) {
    identical(.mar_txt(r$sample_role), "chain_reserve") &&
      identical(.mar_titular_de(r), cadena) &&
      !identical(.mar_txt(r$operational_code), codigo) &&
      .mar_txt(r$sample_status) %in% libres
  }, logical(1)))
  if (!length(idx)) return(integer(0))
  # Por orden de cadena; el que no lo declare va al final en vez de al frente.
  orden <- vapply(plan[idx], function(r) .mar_num(r$replacement_order, Inf), numeric(1))
  idx[order(orden)]
}

#' Activa la siguiente reserva de un aula caida.
#'
#' @param plan filas del plan.
#' @param codigo codigo operativo del aula que cae.
#' @param motivo por que cae; se guarda en la caida y en la reserva.
#' @param ahora marca de tiempo ISO; parametro para que el resultado sea
#'   reproducible en test.
#' @return lista con `plan` actualizado, `activada` (codigo o `NULL`),
#'   `reemplazada` y `agotada` (TRUE si no quedaban reservas).
#' @export
monitoreo_aulas_activar_reemplazo <- function(plan = list(), codigo = "",
                                              motivo = "", ahora = NULL) {
  codigo <- .mar_txt(codigo)
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN", "No hay plan de cursos-horario sobre el que activar un reemplazo.")
  }
  pos_caida <- which(vapply(plan, function(r) identical(.mar_txt(r$operational_code), codigo), logical(1)))
  if (!length(pos_caida)) {
    stop_api(404, "E_AULA_NO_ENCONTRADA",
             sprintf("No existe el curso-horario '%s' en el plan.", codigo))
  }
  pos_caida <- pos_caida[[1]]
  ahora <- .mar_txt(ahora, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  motivo <- .mar_txt(motivo)

  disponibles <- monitoreo_aulas_reservas_disponibles(plan, codigo)
  if (!length(disponibles)) {
    # La cadena se agoto. No se marca la caida como `reemplazada`: no lo esta.
    # Decir que si dejaria un aula fuera del avance sin nadie que la cubra.
    cadena <- .mar_titular_de(plan[[pos_caida]])
    usadas <- sum(vapply(plan, function(r) {
      identical(.mar_txt(r$sample_role), "chain_reserve") &&
        identical(.mar_titular_de(r), cadena) &&
        !.mar_txt(r$sample_status) %in% c("en_reserva", "sin_contactar", "")
    }, logical(1)))
    return(list(plan = plan, activada = NULL, reemplazada = codigo,
                agotada = TRUE, reservas_usadas = as.integer(usadas)))
  }

  pos_reserva <- disponibles[[1]]
  plan[[pos_caida]]$sample_status <- "reemplazada"
  if (nzchar(motivo)) plan[[pos_caida]]$replacement_reason <- motivo
  plan[[pos_caida]]$replaced_at <- ahora

  plan[[pos_reserva]]$sample_status <- "agendada"
  plan[[pos_reserva]]$activated_at <- ahora
  # El motivo viaja a la reserva: quien la mire despues necesita saber POR QUE
  # esta en campo, no solo que lo esta.
  if (nzchar(motivo)) plan[[pos_reserva]]$activation_reason <- motivo

  list(plan = plan,
       activada = .mar_txt(plan[[pos_reserva]]$operational_code),
       reemplazada = codigo, agotada = FALSE,
       restantes = as.integer(length(disponibles) - 1L),
       # La advertencia de ponderacion de la reserva que ENTRA. La escribe
       # Calculo de muestra —«usar peso analitico final solo si se activa en
       # campo y se ajusta no respuesta»— y esta redactada para este momento
       # exacto: el de la activacion. Viajaba en el plan y quien pulsa el boton
       # no la veia nunca.
       #
       # Se DEVUELVE, no se mezcla en el texto: la consecuencia operativa
       # —cuantas reservas quedan— y la metodologica son dos lecturas distintas
       # y una frase sola las aplasta. Y sigue sin tocarse
       # `activation_weight_status`, que es la decision de la cabecera de este
       # modulo: mostrar no es mutar.
       advertencia_peso = .mar_txt(plan[[pos_reserva]]$analysis_weight_warning))
}

#' Frase que explica una activacion sin jerga.
#'
#' @param res resultado de `monitoreo_aulas_activar_reemplazo()`.
#' @return texto en espanol.
#' @export
monitoreo_aulas_activacion_texto <- function(res) {
  if (isTRUE(res$agotada)) {
    usadas <- as.integer(res$reservas_usadas %||% 0L)
    # Nunca haber tenido reserva y haberlas gastado todas son cosas distintas:
    # la primera es una decision del diseno muestral y la segunda un hecho del
    # operativo. Decir «ya se agoto: se habian usado 0» las confundia.
    if (usadas == 0L) {
      return(sprintf(
        "%s cae y no tiene ninguna reserva en el plan: la muestra nunca le asigno una. Su meta se queda sin cubrir.",
        res$reemplazada))
    }
    return(sprintf(
      "%s cae y su cadena de reemplazos ya se agoto: se habian usado %s. No queda reserva equivalente, asi que la meta de ese curso-horario se queda sin cubrir.",
      res$reemplazada, usadas))
  }
  sprintf("%s pasa a reemplazada y entra %s en su lugar. Quedan %s reservas en la cadena.",
          res$reemplazada, res$activada, res$restantes %||% 0L)
}
