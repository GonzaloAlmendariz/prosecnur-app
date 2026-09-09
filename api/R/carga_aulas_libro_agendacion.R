# carga_aulas_libro_agendacion.R — la hoja «Avance de agendación».
#
# Dictado de Gonzalo (2026-09-08): «me gustaría que Tabla dinámica 2 se vuelva
# una hoja que la app pueda producir en base a lo agendado, viendo no sólo
# titulares sino los reemplazos y sus columnas, para saber cuántas ya han sido
# agendadas, de ésas cuántas ya han sido aplicadas, la agendación por día, las
# titulares aún pendientes de agendación, los rechazos y los rechazos que ya
# agendaron reemplazos». Y después: «debería haber también la relación de aulas
# agendadas por semana, siendo la del 7 al 11 la primera semana (domingos no
# cuentan)».
#
# **Qué reemplaza y por qué no basta lo que había.** «Tabla dinámica 2» es una
# tabla dinámica que el coordinador rehace a mano sobre la hoja de agenda, y
# sólo puede ver el BLOQUE TITULAR: cuenta 174 filas —los titulares del plan— y
# no sabe nada de los once eslabones de reemplazo que viven a su derecha en la
# misma fila. Con eso, un titular rechazado cuyo R1 ya está agendado se lee
# igual que uno rechazado al que nadie ha llamado, que son dos situaciones
# opuestas: una está resuelta y la otra es trabajo pendiente.
#
# LA UNIDAD ES LA CADENA, NO LA FILA
#
# Un slot de la muestra es una cadena entera (`CH 5` → `R 5.1` → `R 5.2`…) y
# contar filas cuenta el mismo slot tantas veces como respaldos tenga. Las
# cuentas de esta hoja se hacen sobre el eslabón EN JUEGO
# (`monitoreo_aulas_en_juego()`), salvo donde la pregunta es explícitamente por
# eslabón — que es la cuarta tabla y por eso existe.

#' Las tablas de «Avance de agendación» y sus columnas.
#'
#' Viven aquí y no en `carga_aulas_libro_avance_columnas.R` porque son otra
#' hoja: aquélla mide lo que se recogió y ésta lo que se consiguió agendar.
#' Comparten la disciplina —el rótulo es el ancla, nunca la posición— y no el
#' vocabulario.
#' @keywords internal
AULAS_AGENDACION_CABECERAS <- list(
  facultad = c(
    "Facultad", "Slots",
    "Agendadas", "Aplicadas", "Por aplicar",
    "Titulares agendadas", "Reemplazos agendados",
    "Pendientes de agendar", "En contacto", "Sin contactar",
    "Rechazos", "Rechazos con reemplazo agendado", "Rechazos sin reemplazo"
  ),
  dia = c(
    "Día", "Día de la semana", "Semana",
    "Agendadas", "De titulares", "De reemplazos", "Aplicadas", "Por aplicar"
  ),
  semana = c(
    "Semana", "Desde", "Hasta",
    "Agendadas", "De titulares", "De reemplazos", "Aplicadas", "Por aplicar"
  ),
  eslabon = c(
    "Eslabón", "En el plan", "Agendadas", "Aplicadas",
    "En contacto", "Sin contactar", "Rechazos", "Reemplazadas"
  )
)

#' @keywords internal
AULAS_AGENDACION_TITULOS <- c(
  facultad = "Agendación por facultad",
  semana = "Agendación por semana",
  dia = "Agendación por día",
  eslabon = "Agendación por eslabón"
)

#' El número de semana de una fecha, contando de lunes a sábado.
#'
#' «la del 7 al 11 la primera semana (domingos no cuentan)». La semana se ancla
#' en el LUNES de la primera fecha agendada del estudio y avanza de siete en
#' siete; el domingo no se trabaja y por eso el rótulo de cada semana va de
#' lunes a sábado.
#'
#' **Un domingo agendado no se pierde.** Cae en la semana que empezó ese lunes,
#' como cualquier otro día. Descartarlo sería más limpio de contar y dejaría un
#' aula fuera de la hoja sin decirlo, que es exactamente como se pierde una
#' aplicación.
#'
#' @param fechas fechas ISO.
#' @param ancla lunes de la semana 1; `NULL` lo deriva de la primera fecha.
#' @return enteros (1 es la primera semana), `NA` para lo ilegible.
#' @keywords internal
.calan_semana <- function(fechas, ancla = NULL) {
  d <- suppressWarnings(as.Date(vapply(fechas, function(x) .mav_fecha(x), character(1))))
  if (is.null(ancla)) {
    if (!any(!is.na(d))) return(rep(NA_integer_, length(d)))
    ancla <- min(d, na.rm = TRUE)
  } else {
    ancla <- suppressWarnings(as.Date(.mav_fecha(ancla)))
  }
  if (!length(ancla) || is.na(ancla)) return(rep(NA_integer_, length(d)))
  # Al lunes de su semana: `wday` de POSIXlt es 0 el domingo, así que el lunes
  # es 1 y el domingo retrocede seis días, no cero.
  al_lunes <- function(x) {
    w <- as.POSIXlt(x)$wday
    x - ifelse(w == 0L, 6L, w - 1L)
  }
  base <- al_lunes(ancla)
  as.integer(floor(as.numeric(al_lunes(d) - base) / 7)) + 1L
}

#' El rango escrito de una semana: de su lunes a su sábado.
#' @keywords internal
.calan_rango_semana <- function(n, ancla) {
  lunes <- suppressWarnings(as.Date(.mav_fecha(ancla)))
  if (!length(lunes) || is.na(lunes)) return(list(desde = "", hasta = ""))
  w <- as.POSIXlt(lunes)$wday
  lunes <- lunes - ifelse(w == 0L, 6L, w - 1L)
  inicio <- lunes + (n - 1L) * 7L
  list(desde = format(inicio, "%d/%m"), hasta = format(inicio + 5L, "%d/%m"))
}

#' Los ejes de cada fila del plan: qué es, en qué anda y si ya se aplicó.
#' @keywords internal
.calan_ejes <- function(unidades, partes = list(), efectivas = NULL) {
  u <- if (is.data.frame(unidades)) split(unidades, seq_len(nrow(unidades))) else (unidades %||% list())
  n <- length(u)
  txt <- function(campo) vapply(u, function(x) .cai_txt(x[[campo]]), character(1))
  num <- function(campo) vapply(u, function(x) .cai_num(x[[campo]]), numeric(1))
  estado <- vapply(txt("sample_status"), monitoreo_aulas_estado_muestra, character(1), USE.NAMES = FALSE)
  fecha <- vapply(txt("scheduled_date"), function(x) .mav_fecha(x), character(1), USE.NAMES = FALSE)
  rol <- tolower(txt("sample_role"))
  orden <- num("replacement_order")
  orden[!is.finite(orden)] <- 0
  titular <- txt("titular_operational_code")
  codigo <- txt("operational_code")
  list(
    n = n,
    codigo = codigo,
    facultad = txt("faculty"),
    cadena = ifelse(nzchar(titular), titular, codigo),
    es_reserva = rol == "chain_reserve",
    # **Las EXTRA no son una cadena y no pueden contar como slots.** No
    # reemplazan a nadie: son aulas adicionales para cerrar la cuota de hombres
    # y mujeres por facultad. Contándolas, DERECHO salía con 61 slots donde el
    # diseño le puso 19, y sus 42 reservas dormidas se leían como cuarenta y dos
    # aulas sin agendar.
    es_extra = rol == "extra_reserve_pool",
    eslabon = ifelse(rol == "extra_reserve_pool", "Extra",
                     ifelse(rol == "chain_reserve", paste0("R", orden), "Titular")),
    estado = estado,
    fecha = fecha,
    # **Agendada es estado Y fecha.** Un `AGENDADA` sin fecha no se puede poner
    # en ningún día ni en ninguna semana, y contarlo como agendada haría que la
    # tabla por facultad y la del día no cuadraran entre sí.
    agendada = estado %in% c("agendada", "reagendada") & nzchar(fecha),
    aplicada = tryCatch(
      monitoreo_aulas_aula_aplicada(u, partes = partes, efectivas = efectivas),
      error = function(e) rep(FALSE, n)
    ),
    rechazo = estado == "rechazo",
    en_contacto = estado == "en_contacto",
    reemplazada = estado == "reemplazada",
    dormido = .maej_dormido(txt("sample_status"))
  )
}

#' Agendación por facultad, con los reemplazos dentro.
#' @keywords internal
.calan_por_facultad <- function(e) {
  facs <- sort(unique(e$facultad[nzchar(e$facultad)]), method = "radix")
  if (!length(facs)) return(NULL)
  del_slot <- !e$es_extra
  # A qué facultad pertenece cada cadena, y en qué anda: la cadena hereda la
  # facultad de su titular, que es la que el diseño le puso.
  filas <- lapply(facs, function(f) {
    idx <- which(e$facultad == f & del_slot)
    cadenas <- unique(e$cadena[idx])
    # Por cadena: ¿tiene algún eslabón agendado? ¿alguno aplicado? ¿su titular
    # está rechazado?
    resumen <- lapply(cadenas, function(k) {
      j <- which(e$cadena == k & del_slot)
      tit <- j[!e$es_reserva[j]]
      list(
        agendada = any(e$agendada[j]),
        agendada_titular = any(e$agendada[j] & !e$es_reserva[j]),
        agendada_reemplazo = any(e$agendada[j] & e$es_reserva[j]),
        aplicada = any(e$aplicada[j]),
        rechazo = length(tit) > 0L && any(e$rechazo[tit]),
        en_contacto = any(e$en_contacto[j]),
        # Dormida de verdad: nadie de la cadena ha entrado al operativo.
        sin_contactar = all(e$dormido[j])
      )
    })
    saca <- function(campo) sum(vapply(resumen, function(r) isTRUE(r[[campo]]), logical(1)))
    rechazos <- vapply(resumen, function(r) isTRUE(r$rechazo), logical(1))
    con_relevo <- sum(rechazos & vapply(resumen, function(r) isTRUE(r$agendada_reemplazo), logical(1)))
    agendadas <- saca("agendada")
    data.frame(
      f, length(cadenas),
      agendadas, saca("aplicada"), agendadas - saca("aplicada"),
      saca("agendada_titular"), saca("agendada_reemplazo"),
      # **Pendiente de agendar es la cadena sin NINGÚN eslabón agendado.** No se
      # resta el rechazo: un titular rechazado cuya reserva nadie ha llamado
      # sigue siendo trabajo pendiente, y es justo el caso que la tabla dinámica
      # hecha a mano no sabía distinguir del rechazo ya relevado.
      length(cadenas) - agendadas,
      saca("en_contacto"), saca("sin_contactar"),
      sum(rechazos), con_relevo, sum(rechazos) - con_relevo,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  names(out) <- AULAS_AGENDACION_CABECERAS$facultad
  # Por lo que falta por agendar y de más a menos: la facultad con más trabajo
  # pendiente abre la tabla, que es lo que se mira primero.
  out[order(-out$`Pendientes de agendar`, out$Facultad), , drop = FALSE]
}

#' Agendación por día: una fila por fecha con alguna aula agendada.
#'
#' Aquí la unidad SÍ es la fila y no la cadena, y es a propósito: la pregunta es
#' cuántas aplicaciones hay ese día, y si el titular cayó y su reserva se agendó
#' para otra fecha, las dos fechas tienen trabajo.
#' @keywords internal
.calan_por_dia <- function(e, ancla = NULL) {
  i <- which(e$agendada)
  if (!length(i)) return(NULL)
  if (is.null(ancla)) ancla <- min(e$fecha[i])
  dias <- sort(unique(e$fecha[i]))
  semanas <- .calan_semana(dias, ancla)
  filas <- lapply(seq_along(dias), function(k) {
    d <- dias[[k]]
    j <- i[e$fecha[i] == d]
    aplicadas <- sum(e$aplicada[j])
    data.frame(
      .alpa_dia_y_fecha(d)$fecha,
      .alpa_dia_y_fecha(d)$dia,
      semanas[[k]],
      length(j), sum(!e$es_reserva[j]), sum(e$es_reserva[j]),
      aplicadas, length(j) - aplicadas,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  names(out) <- AULAS_AGENDACION_CABECERAS$dia
  out
}

#' Agendación por semana, de lunes a sábado.
#' @keywords internal
.calan_por_semana <- function(e, ancla = NULL) {
  i <- which(e$agendada)
  if (!length(i)) return(NULL)
  if (is.null(ancla)) ancla <- min(e$fecha[i])
  sem <- .calan_semana(e$fecha[i], ancla)
  ok <- is.finite(sem)
  if (!any(ok)) return(NULL)
  numeros <- sort(unique(sem[ok]))
  filas <- lapply(numeros, function(n) {
    j <- i[ok & sem == n]
    r <- .calan_rango_semana(n, ancla)
    aplicadas <- sum(e$aplicada[j])
    data.frame(
      paste("Semana", n), r$desde, r$hasta,
      length(j), sum(!e$es_reserva[j]), sum(e$es_reserva[j]),
      aplicadas, length(j) - aplicadas,
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  names(out) <- AULAS_AGENDACION_CABECERAS$semana
  out
}

#' Agendación por eslabón: el titular y cada nivel de reemplazo.
#'
#' Es la tabla que la dinámica hecha a mano no podía tener: los once eslabones
#' viven a la derecha del titular EN LA MISMA FILA de la hoja de agenda, así que
#' una tabla dinámica sobre esa hoja sólo sabe contar el bloque titular.
#' @keywords internal
.calan_por_eslabon <- function(e) {
  if (!e$n) return(NULL)
  orden <- unique(e$eslabon)
  # Titular primero y las erres por número, no alfabético: «R10» antes que «R2»
  # sería el orden de texto y no el de la cadena.
  clave <- ifelse(orden == "Titular", -1,
                  ifelse(orden == "Extra", 1e6,
                         suppressWarnings(as.numeric(sub("^R", "", orden)))))
  orden <- orden[order(clave)]
  filas <- lapply(orden, function(lab) {
    j <- which(e$eslabon == lab)
    data.frame(
      lab, length(j), sum(e$agendada[j]), sum(e$aplicada[j]),
      sum(e$en_contacto[j]), sum(e$dormido[j]),
      sum(e$rechazo[j]), sum(e$reemplazada[j]),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  names(out) <- AULAS_AGENDACION_CABECERAS$eslabon
  out
}

#' El modelo de «Avance de agendación».
#'
#' @param unidades filas del plan COMPLETO (titulares y reservas). No es el
#'   mismo insumo que «Avance de campo», que trabaja sobre las que entran al
#'   libro: aquí hace falta la cadena entera para saber si un rechazo ya tiene
#'   relevo agendado.
#' @param partes partes de campo.
#' @param efectivas efectivas por código (plataforma).
#' @param ancla lunes de la semana 1; por defecto, el de la primera agendada.
#' @return lista `{facultad, semana, dia, eslabon}`.
#' @export
aulas_libro_agendacion <- function(unidades, partes = list(), efectivas = NULL,
                                   ancla = NULL) {
  e <- .calan_ejes(unidades, partes = partes, efectivas = efectivas)
  if (!e$n) return(list(facultad = NULL, semana = NULL, dia = NULL, eslabon = NULL))
  if (is.null(ancla)) {
    con_fecha <- e$fecha[e$agendada]
    ancla <- if (length(con_fecha)) min(con_fecha) else NULL
  }
  list(
    facultad = .calan_por_facultad(e),
    semana = .calan_por_semana(e, ancla),
    dia = .calan_por_dia(e, ancla),
    eslabon = .calan_por_eslabon(e)
  )
}
