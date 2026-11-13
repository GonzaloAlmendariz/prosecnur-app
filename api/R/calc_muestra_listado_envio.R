# Listado de envío de un barrido por correo (ADR 0143, D9): cada persona recibe una sola encuesta.
#
# En la propuesta quien figura en dos públicos se cuenta en ambos. Aquí se decide, con el cliente y para cada par
# de públicos con personas en común, a cuál van esas personas. Una persona que está en tres públicos va al que gana
# todos sus pares; si las decisiones forman un ciclo (A sobre B, B sobre C, C sobre A) queda sin asignar y se dice.
# El listado no se descarga mientras quede un par sin decidir o una persona sin asignar.
#
# Se cruza por correo normalizado (`.cm_marco_correo_clave`), nunca por nombre.

.cm_par_clave <- function(a, b) paste(sort(c(a, b)), collapse = "\r")
.CM_POR_DECIDIR <- "\u0001"

#' Asignación de las personas compartidas entre públicos.
#'
#' @param publicos lista de list(id, nombre, correos): un correo por persona invitada.
#' @param decisiones lista de list(a, b, va): para el par {a, b}, `va` es el id del público que se queda con las
#'   personas que están en ambos. El orden de a y b no importa.
#' @return list(
#'   publicos = [{id, nombre, invitados, quedan, cedidas, por_decidir, sin_asignar}],
#'   pares = [{a, b, nombre_a, nombre_b, n, va}],   # va = "" si falta decidir
#'   pendientes, sin_asignar, listo,
#'   destino = list(<id> = lógico por persona: TRUE si se le envía como ese público))
calc_muestra_listado_asignar <- function(publicos, decisiones = list()) {
  publicos <- if (is.list(publicos)) publicos else list()
  ids <- vapply(publicos, function(p) calc_str(p$id, ""), "")
  nombres <- stats::setNames(vapply(publicos, function(p) calc_str(p$nombre, ""), ""), ids)
  claves <- lapply(publicos, function(p) {
    x <- .cm_marco_correo_clave(unlist(p$correos %||% list()))
    x[is.na(x)] <- ""
    x
  })
  names(claves) <- ids
  unicos <- lapply(claves, function(x) unique(x[nzchar(x)]))

  gana <- list()
  for (d in decisiones %||% list()) {
    a <- calc_str(d$a, ""); b <- calc_str(d$b, ""); va <- calc_str(d$va, "")
    if (!a %in% ids || !b %in% ids || identical(a, b)) next
    if (!va %in% c(a, b)) {
      stop_api(400, "E_BAD_REQUEST", sprintf("La decisión entre %s y %s debe elegir uno de los dos.", nombres[[a]], nombres[[b]]))
    }
    gana[[.cm_par_clave(a, b)]] <- va
  }

  pares <- list()
  for (i in seq_along(ids)) for (j in seq_along(ids)) {
    if (j <= i) next
    n <- length(intersect(unicos[[i]], unicos[[j]]))
    if (!n) next
    clave <- .cm_par_clave(ids[i], ids[j])
    pares[[length(pares) + 1L]] <- list(a = ids[i], b = ids[j], nombre_a = nombres[[ids[i]]], nombre_b = nombres[[ids[j]]],
                                        n = n, va = gana[[clave]] %||% "")
  }
  pendientes <- sum(vapply(pares, function(p) !nzchar(p$va), logical(1)))

  # Para cada correo, los públicos en que figura; se queda en el que gana a todos los demás.
  todos <- unique(unlist(unicos, use.names = FALSE))
  en <- lapply(unicos, function(u) todos %in% u)
  dueno <- rep("", length(todos))
  for (k in seq_along(todos)) {
    miembros <- ids[vapply(en, `[`, logical(1), k)]
    if (length(miembros) == 1L) { dueno[k] <- miembros; next }
    decididos <- vapply(utils::combn(miembros, 2L, simplify = FALSE), function(par) !is.null(gana[[.cm_par_clave(par[1], par[2])]]), logical(1))
    if (!all(decididos)) { dueno[k] <- .CM_POR_DECIDIR; next }
    for (m in miembros) {
      otros <- setdiff(miembros, m)
      if (all(vapply(otros, function(o) identical(gana[[.cm_par_clave(m, o)]], m), logical(1)))) { dueno[k] <- m; break }
    }
  }
  sin_dueno <- todos[!nzchar(dueno)]
  dueno_de <- stats::setNames(dueno, todos)

  destino <- list()
  resumen <- lapply(ids, function(id) {
    x <- claves[[id]]
    con <- nzchar(x)
    d <- unname(dueno_de[x])
    queda <- !con | (!is.na(d) & d == id)
    # Un correo repetido dentro del mismo público recibe una sola encuesta.
    queda <- queda & !(con & duplicated(x))
    unica <- con & !duplicated(x)
    sin <- unica & x %in% sin_dueno
    por_decidir <- unica & !is.na(d) & d == .CM_POR_DECIDIR
    destino[[id]] <<- queda
    list(id = id, nombre = nombres[[id]], invitados = length(x), quedan = sum(queda),
         cedidas = sum(unica & !queda & !sin & !por_decidir), por_decidir = sum(por_decidir), sin_asignar = sum(sin))
  })
  list(publicos = resumen, pares = pares, pendientes = pendientes, sin_asignar = length(sin_dueno),
       listo = pendientes == 0L && length(sin_dueno) == 0L, destino = destino)
}
