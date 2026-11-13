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
#'   publicos = [{id, nombre, invitados, quedan, cedidas, por_decidir, sin_asignar, sin_correo, repetidas}],
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
    # Sin correo no se le puede enviar: va aparte y no se cuenta entre quienes reciben la encuesta.
    unica <- con & !duplicated(x)
    queda <- unica & !is.na(d) & d == id
    sin <- unica & x %in% sin_dueno
    por_decidir <- unica & !is.na(d) & d == .CM_POR_DECIDIR
    destino[[id]] <<- queda
    # Las columnas suman las filas del público: quedan + cedidas + por decidir + sin asignar + sin correo + repetidas.
    list(id = id, nombre = nombres[[id]], invitados = length(x), quedan = sum(queda),
         cedidas = sum(unica & !queda & !sin & !por_decidir), por_decidir = sum(por_decidir), sin_asignar = sum(sin),
         sin_correo = sum(!con), repetidas = sum(con & duplicated(x)))
  })
  list(publicos = resumen, pares = pares, pendientes = pendientes, sin_asignar = length(sin_dueno),
       listo = pendientes == 0L && length(sin_dueno) == 0L, destino = destino)
}

#' Decisiones por par limpias: list(list(a, b, va)) sin vacías ni repetidas (gana la última de cada par).
calc_muestra_listado_decisiones <- function(decisiones) {
  out <- list()
  for (d in if (is.list(decisiones)) decisiones else list()) {
    a <- calc_str(d$a, ""); b <- calc_str(d$b, ""); va <- calc_str(d$va, "")
    if (!nzchar(a) || !nzchar(b) || identical(a, b) || !va %in% c(a, b)) next
    out[[.cm_par_clave(a, b)]] <- list(a = a, b = b, va = va)
  }
  unname(out)
}

#' Excel del listado de envío: una hoja por público con las personas a las que se les envía como ese público.
#' @param publicos los de `.cm_publicos_con_correo()$publicos` (con datos y columnas).
#' @param asignacion el resultado de `calc_muestra_listado_asignar()` sobre esos públicos.
#' @param tandas list(n, semilla): con n > 1 cada hoja lleva la columna Tanda y sale ordenada por ella.
#' Tandas del envío limpias: list(n = 1..20, semilla entera).
calc_muestra_listado_tandas_config <- function(t) {
  t <- if (is.list(t)) t else list()
  list(n = min(20L, calc_int(t$n, 1L, min = 1L)), semilla = calc_int(t$semilla, .CM_GENERAL_SEMILLA_DEFAULT))
}

calc_muestra_listado_xlsx <- function(publicos, asignacion, path, tandas = list()) {
  tandas <- calc_muestra_listado_tandas_config(tandas)
  if (!isTRUE(asignacion$listo)) {
    stop_api(400, "E_BAD_REQUEST", "Decide a qué público van las personas compartidas antes de descargar el listado.")
  }
  wb <- openxlsx::createWorkbook()
  usadas <- character()
  for (p in publicos) {
    d <- p$datos[asignacion$destino[[p$id]], , drop = FALSE]
    cols <- unique(c(p$col_id, p$col_correo, if (nzchar(p$col_segmento)) p$col_segmento))
    cols <- cols[nzchar(cols) & cols %in% names(d)]
    d <- d[, cols, drop = FALSE]
    if (tandas$n > 1L) {
      d$Tanda <- calc_muestra_listado_tandas(d[[p$col_correo]], tandas$n, tandas$semilla)
      d <- d[order(d$Tanda), , drop = FALSE]
    }
    # Nombre de hoja válido para Excel: sin caracteres reservados, 31 como máximo y sin repetir.
    hoja <- substr(gsub("[][*?/\\\\:]", " ", p$nombre), 1, 31)
    if (!nzchar(trimws(hoja))) hoja <- "Público"
    base <- hoja; k <- 1L
    while (tolower(hoja) %in% tolower(usadas)) { k <- k + 1L; hoja <- substr(paste0(substr(base, 1, 27), " (", k, ")"), 1, 31) }
    usadas <- c(usadas, hoja)
    openxlsx::addWorksheet(wb, hoja)
    openxlsx::writeData(wb, hoja, d, headerStyle = openxlsx::createStyle(textDecoration = "bold"))
    openxlsx::setColWidths(wb, hoja, cols = seq_along(cols), widths = "auto")
    openxlsx::freezePane(wb, hoja, firstRow = TRUE)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

#' Tanda de envío de cada persona, fija por persona: sale de su correo y de la semilla, así que agregar, quitar o
#' reasignar a otra persona no la mueve de tanda (una tanda ya enviada no cambia). Los tamaños y la composición por
#' segmento quedan parejos en promedio, no exactos.
#' @param claves correo de cada persona (normalizado aquí).
#' @param n_tandas número de tandas (1 = todo en una).
#' @param semilla entero; la misma semilla da las mismas tandas.
#' @return entero por persona, de 1 a n_tandas.
calc_muestra_listado_tandas <- function(claves, n_tandas = 1L, semilla = 1L) {
  n <- length(claves)
  n_tandas <- max(1L, calc_int(n_tandas, 1L, min = 1L))
  if (!n) return(integer())
  if (n_tandas == 1L) return(rep(1L, n))
  x <- .cm_marco_correo_clave(claves); x[is.na(x)] <- ""
  semilla <- calc_int(semilla, 1L)
  # Los primeros 7 dígitos hexadecimales del md5 de "semilla|correo": un entero uniforme y fijo por persona.
  h <- vapply(paste0(semilla, "|", x), function(k) strtoi(substr(digest::digest(k, algo = "md5", serialize = FALSE), 1, 7), 16L),
              numeric(1), USE.NAMES = FALSE)
  as.integer(h %% n_tandas) + 1L
}

#' Personas por tanda de cada público, con las mismas tandas que el Excel.
calc_muestra_listado_por_tanda <- function(publicos, asignacion, tandas = list()) {
  tandas <- calc_muestra_listado_tandas_config(tandas)
  lapply(publicos, function(p) {
    correos <- p$correos[asignacion$destino[[p$id]]]
    t <- calc_muestra_listado_tandas(correos, tandas$n, tandas$semilla)
    list(id = p$id, por_tanda = as.integer(tabulate(t, nbins = tandas$n)))
  })
}
