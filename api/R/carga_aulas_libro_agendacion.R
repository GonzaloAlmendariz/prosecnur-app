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
  # **El total, arriba del todo** (dictado 2026-09-09: «quizás una tabla al
  # inicio que diga cuántas agendadas en total ya hay, cuántas titulares y
  # cuántos reemplazos»). La hoja abría con la tabla por facultad, que son doce
  # filas y trece columnas: para saber cuántas van había que sumarlas de cabeza.
  # Dos columnas y siete filas, que es lo que se mira antes que nada.
  total = c("Indicador", "Total"),
  facultad = c(
    "Facultad", "Slots",
    # **«Agendado» es lo que convierte un inventario en un AVANCE** (2026-09-10).
    # Esta hoja tenía once columnas y ninguna era un porcentaje: todas conteos.
    # «Avance de campo» —la que él aprueba— lleva su `Avance muestra` contra la
    # cuota, y por eso se lee como progreso con el mismo formato exacto. «34 de
    # 37» y «3 de 3» son la misma cifra de trabajo pendiente y muy distinta
    # noticia; el porcentaje es lo que las separa de un vistazo.
    "Agendadas", "Agendado", "Aplicadas", "Por aplicar",
    "Titulares agendadas", "Reemplazos agendados",
    "Pendientes de agendar", "En contacto", "Sin contactar",
    "Rechazos", "Rechazos con reemplazo agendado", "Rechazos sin reemplazo"
  ),
  # **El orden de esta lista ES el orden de los bloques de la hoja**, y por eso
  # la semana va antes que el día: primero el resumen con el que se decide si la
  # semana entrante está cubierta, y después el detalle con el que se organiza
  # cada jornada. `AULAS_AGENDACION_TITULOS` lleva el mismo orden a propósito.
  semana = c(
    "Semana", "Desde", "Hasta",
    "Agendadas", "De titulares", "De reemplazos", "Aplicadas", "Por aplicar"
  ),
  dia = c(
    "Día", "Día de la semana", "Semana",
    "Agendadas", "De titulares", "De reemplazos", "Aplicadas", "Por aplicar"
  ),
  eslabon = c(
    "Eslabón", "En el plan", "Agendadas", "Aplicadas",
    "En contacto", "Sin contactar", "Rechazos", "Reemplazadas"
  )
)

#' Las columnas de esta hoja que son una PROPORCIÓN, no un conteo.
#'
#' La hoja nació con las cuatro tablas en conteos —así lo dice su propio
#' escritor— y eso es justo lo que la separaba de «Avance de campo»: con el
#' mismo navy, la misma cabecera y la misma rejilla, una se lee como progreso y
#' la otra como inventario, porque sólo una dice qué fracción del trabajo va
#' hecha. Gonzalo, 2026-09-10: «avance está muy bien… la de las agendaciones
#' todavía le falta muchísimo para verse bien».
#'
#' Se declara aquí, por NOMBRE, y no se deduce del tipo: una columna de conteos
#' también es numérica, y adivinar por el tipo pintaría «152» como «15 200 %».
#' @keywords internal
AULAS_AGENDACION_PROPORCIONES <- list(
  # El bloque de arriba es TRASPUESTO —los conceptos son filas, no columnas—,
  # así que aquí el nombre es el de la FILA. Es el mismo reparto que hace
  # `AULAS_AVANCE_PROPORCIONES$general` en la hoja hermana.
  total = c("Agendado del plan"),
  facultad = c("Agendado")
)

#' ¿Esta columna de esta tabla es una proporción?
#' @keywords internal
.calan_es_proporcion <- function(rotulo, tabla = NULL) {
  r <- trimws(as.character(rotulo %||% ""))
  if (!length(r) || !nzchar(r)) return(FALSE)
  lista <- if (is.null(tabla) || !nzchar(tabla)) {
    unlist(AULAS_AGENDACION_PROPORCIONES, use.names = FALSE)
  } else {
    AULAS_AGENDACION_PROPORCIONES[[tabla]] %||% character(0)
  }
  r %in% lista
}

#' @keywords internal
AULAS_AGENDACION_TITULOS <- c(
  total = "Cuánto se lleva agendado",
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

#' El total de la hoja: cuánto se lleva agendado y de qué tipo.
#'
#' **La unidad aquí es la FILA, no la cadena.** «Agendación por facultad» cuenta
#' cadenas —un titular y sus reemplazos son un solo slot— y ésta cuenta citas:
#' si el titular cayó y su reemplazo se agendó, son dos visitas al campus y las
#' dos tienen que verse. Las dos lecturas conviven y la nota del bloque lo dice,
#' porque dos cifras que no cuadran sin explicación se leen como un error.
#'
#' Las EXTRA se cuentan aparte y sólo si hay alguna: no reemplazan a nadie
#' —cierran cuota de hombres o mujeres— y meterlas entre los reemplazos diría
#' que hubo cuarenta y dos caídas que nunca ocurrieron.
#'
#' @param e ejes de `.calan_ejes()`.
#' @return `data.frame` de dos columnas, o `NULL` si no hay ninguna agendada.
#' @keywords internal
.calan_total <- function(e) {
  if (!e$n || !any(e$agendada)) return(NULL)
  ag <- e$agendada
  extra <- ag & e$es_extra
  reserva <- ag & e$es_reserva
  titular <- ag & !e$es_reserva & !e$es_extra
  filas <- list(
    c("Cursos-horario agendados", sum(ag)),
    c("De titulares", sum(titular)),
    c("De reemplazos", sum(reserva))
  )
  if (any(extra)) filas[[length(filas) + 1L]] <- c("De reservas extra", sum(extra))
  filas <- c(filas, list(
    c("Ya aplicados", sum(ag & e$aplicada)),
    c("Pendientes de aplicar", sum(ag & !e$aplicada)),
    # Lo que queda por delante, que es la otra mitad de la pregunta: sin esto la
    # tabla dice cuánto se hizo y no cuánto falta. **Un rechazo NO está «sin
    # agendar»**: ya se resolvió por el otro camino, tiene su propia fila abajo,
    # y contarlo aquí lo diría dos veces y pondría en la cola de llamadas a
    # alguien que ya dijo que no. Lo mismo una reemplazada: su relevo es quien
    # queda por agendar, y ése ya se cuenta solo.
    c("Sin agendar todavía",
      sum(!ag & !e$es_extra & !e$dormido & !e$rechazo & !e$reemplazada)),
    c("Rechazos", sum(e$rechazo))
  ))
  # **La fracción, arriba del todo, que es donde se mira.** Las cifras de este
  # bloque contestan «cuántas hay» y ninguna contestaba «cuánto llevamos»: con
  # 152 agendadas y 23 sin agendar hay que hacer la división mentalmente cada
  # vez. Es la misma lectura que «Avance muestra» le da a la hoja hermana.
  #
  # El denominador es lo que HAY QUE agendar: lo agendado más lo que sigue
  # pendiente. No entran los rechazos —ya se resolvieron por el otro camino y
  # contarlos bajaría el porcentaje por trabajo que nadie debe hacer— ni las
  # extra, por lo mismo que no entran arriba.
  pendientes <- sum(!ag & !e$es_extra & !e$dormido & !e$rechazo & !e$reemplazada)
  por_agendar <- sum(ag) + pendientes
  filas <- c(filas, list(c(
    "Agendado del plan",
    if (por_agendar > 0) sum(ag) / por_agendar else NA_real_
  )))
  data.frame(
    Indicador = vapply(filas, function(x) x[[1]], character(1)),
    Total = as.numeric(vapply(filas, function(x) x[[2]], character(1))),
    stringsAsFactors = FALSE,
    check.names = FALSE
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
      agendadas,
      # Sobre los SLOTS de la facultad, que es el denominador de esta hoja: la
      # cadena entera cuenta una vez, esté agendado el titular o su reemplazo.
      # Sin slots no hay fracción y se declara vacío, no cero: «0 %» diría que
      # no se ha agendado nada de algo que no existe.
      if (length(cadenas) > 0L) agendadas / length(cadenas) else NA_real_,
      saca("aplicada"), agendadas - saca("aplicada"),
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
  if (!e$n) return(list(total = NULL, facultad = NULL, semana = NULL, dia = NULL, eslabon = NULL))
  if (is.null(ancla)) {
    con_fecha <- e$fecha[e$agendada]
    ancla <- if (length(con_fecha)) min(con_fecha) else NULL
  }
  list(
    total = .calan_total(e),
    facultad = .calan_por_facultad(e),
    semana = .calan_por_semana(e, ancla),
    dia = .calan_por_dia(e, ancla),
    eslabon = .calan_por_eslabon(e)
  )
}

# --- la pestaña ---------------------------------------------------------------
#
# **Por qué esta hoja lleva su propio formateador y no el de «Avance de campo».**
# Aquél se ancla en `AULAS_AVANCE_CABECERAS`, `AULAS_AVANCE_PROPORCIONES` y
# `AULAS_AVANCE_DIFERENCIAS` para decidir qué celda es porcentaje y cuál lleva
# escala de color. Reusarlo obligaría a meter los rótulos de esta hoja en aquel
# vocabulario, y las dos comparten nombres de clave —«facultad» está en las dos—
# así que una columna de aquélla acabaría decidiendo el formato de una de ésta:
# la avería del anclaje ambiguo que este libro ya pagó.
#
# Y no hace falta: aquí no hay ni una proporción ni una diferencia con signo.
# Las cuatro tablas son conteos. Lo que necesitan es banda de bloque, cabecera
# legible, anchos y las cifras a la derecha, que es justo lo que ya hacen
# `aulas_libro_asignacion_formato_requests()` y su hermana de disponibilidad con
# las mismas primitivas.

#' @keywords internal
.calan_NOTAS <- c(
  total = paste(
    "Aquí la unidad es la FILA, no la cadena: un titular y su reemplazo agendados",
    "son dos citas y dos visitas. La tabla de abajo cuenta cadenas, así que sus",
    "cifras no tienen por qué coincidir con éstas, y ninguna de las dos sobra."
  ),
  facultad = paste(
    "La unidad es la CADENA, no la fila: un titular y sus reemplazos son un solo",
    "slot. Una cadena cuenta como agendada si cualquiera de sus eslabones lo",
    "está, y las reservas extra no son slots porque no reemplazan a nadie."
  ),
  semana = paste(
    "Semanas de lunes a sábado, contadas desde el lunes de la primera aula",
    "agendada. El domingo no se trabaja; si alguna cae en domingo, cuenta en la",
    "semana que empezó ese lunes."
  ),
  dia = paste(
    "Aquí la unidad es la FILA y no la cadena: si un titular cayó y su reemplazo",
    "se agendó para otro día, los dos días tienen trabajo."
  ),
  eslabon = paste(
    "Lo que la tabla dinámica hecha a mano no podía ver: los once eslabones de",
    "reemplazo viven a la derecha del titular, en la misma fila de la agenda."
  )
)

#' @keywords internal
.calan_VACIOS <- c(
  total = "Todavía no hay ningún curso-horario agendado.",
  facultad = "El plan todavía no trae facultades con aulas que agendar.",
  semana = "Todavía no hay ninguna aula con fecha agendada.",
  dia = "Todavía no hay ninguna aula con fecha agendada.",
  eslabon = "El plan todavía no trae cursos-horario."
)

#' Arma la hoja «Avance de agendación» como filas de celdas para Sheets.
#'
#' Mismo contrato que `aulas_libro_hoja_avance()`: filas de celdas donde las
#' cifras viajan como NÚMEROS, no como texto, para que el Sheets pueda
#' ordenarlas y sumarlas. El corte NUNCA sale del reloj —lo derivaría de
#' `Sys.Date()` y dos publicaciones del mismo estado darían hashes distintos—:
#' se deriva del último día agendado del propio modelo.
#'
#' @param ag el modelo de `aulas_libro_agendacion()`.
#' @param actualizado marca ISO de la última sincronización, para la portada.
#' @return lista de filas de celdas.
#' @export
aulas_libro_hoja_agendacion <- function(ag, actualizado = "") {
  ag <- if (is.list(ag)) ag else list()
  filas <- list()
  poner <- function(...) {
    celdas <- list(...)
    if (length(celdas) == 1L && is.list(celdas[[1]])) celdas <- celdas[[1]]
    filas[[length(filas) + 1L]] <<- celdas
  }

  # El corte, derivado del modelo: el último día con alguna aula agendada.
  dias <- if (is.data.frame(ag$dia) && nrow(ag$dia)) as.character(ag$dia[["Día"]]) else character(0)
  dias <- dias[!is.na(dias) & nzchar(dias)]
  corte <- if (length(dias)) {
    sprintf("Agendado hasta el %s", utils::tail(dias, 1L))
  } else {
    "Todavía no hay ninguna aula con fecha agendada."
  }
  marca <- .cai_marca_local(.cala_txt(actualizado))
  if (nzchar(marca)) corte <- paste0(corte, " · datos de plataforma actualizados el ", marca)

  poner("Avance de agendación")
  poner(corte)
  poner("")

  for (clave in names(AULAS_AGENDACION_CABECERAS)) {
    tabla <- ag[[clave]]
    poner(unname(AULAS_AGENDACION_TITULOS[[clave]]))
    if (!is.data.frame(tabla) || !nrow(tabla)) {
      poner(unname(.calan_VACIOS[[clave]]))
      poner("")
      next
    }
    poner(unname(.calan_NOTAS[[clave]]))
    # `proporciones = character(0)`: aquí no hay ni una. Ver la nota de arriba
    # sobre por qué no se pregunta al vocabulario de «Avance de campo».
    # **Las proporciones de ESTA hoja, no `character(0)`.** `.cala_celda_num()`
    # redondea a cuatro decimales lo que es proporción y a DOS lo que es
    # conteo, así que declarar «aquí no hay ninguna» convertía 0,6842 en 0,68 y
    # la celda enseñaba «68,0 %» con un patrón de un decimal que nunca variaba:
    # trece de diecinueve es 68,4 %. Visto en el Sheets publicado el 2026-09-10.
    #
    # `traspuesta` para el bloque de arriba, donde la proporción es una FILA.
    for (f in .cala_tabla_filas(
      tabla, clave,
      traspuesta = identical(clave, "total"),
      proporciones = AULAS_AGENDACION_PROPORCIONES[[clave]] %||% character(0)
    )) poner(f)
    poner("")
  }
  filas
}

#' @keywords internal
.calan_es_titulo <- function(x) {
  trimws(as.character(x %||% "")) %in% c("Avance de agendación", unname(AULAS_AGENDACION_TITULOS))
}

#' A qué tabla de esta hoja pertenece una fila de cabecera.
#'
#' Por la cabecera COMPLETA y no por su primera celda: «Agendación por semana» y
#' «Agendación por día» comparten columnas y la primera no basta.
#' @keywords internal
.calan_tabla_de_cabecera <- function(celdas) {
  celdas <- trimws(as.character(celdas %||% character(0)))
  for (nombre in names(AULAS_AGENDACION_CABECERAS)) {
    esperada <- AULAS_AGENDACION_CABECERAS[[nombre]]
    if (length(celdas) >= length(esperada) &&
        identical(celdas[seq_along(esperada)], esperada)) {
      return(nombre)
    }
  }
  ""
}

#' Formato de la pestaña «Avance de agendación».
#'
#' Bandas de bloque, cabeceras legibles, anchos y las cifras a la derecha. Sin
#' reglas de color por valor a propósito: todas sus columnas son conteos y una
#' escala sobre un conteo diría que veinte aulas agendadas es «mejor» que dos,
#' cuando lo que dice es que esa facultad tiene veinte.
#'
#' @param sheet_id id de la pestaña.
#' @param rows las filas publicadas.
#' @return lista de requests.
#' @export
aulas_libro_agendacion_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(r) length(r %||% list()), integer(1))))
  celda <- function(i, j) {
    v <- rows[[i]]
    if (j > length(v)) return("")
    trimws(as.character(v[[j]] %||% ""))
  }
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req

  # **El ancho de la primera columna sale del contenido, no de un 260.** Lleva
  # nombres de facultad y el más largo del operativo pide 250 px: diez de
  # margen, o sea otra vez «cabe por suerte». Mismo factor que
  # `.maaf_anchos_px()` (7,2 px por carácter más el relleno), suelo en los 260
  # de antes y techo en 360. Las demás son conteos y su rótulo baja de línea.
  ancho1 <- 260L
  for (r in rows) {
    if (length(r) < 2L) next
    # Sólo filas de DATO: los títulos y las notas se derraman sobre las celdas
    # vacías de su derecha y no necesitan columna.
    if (!nzchar(trimws(as.character(r[[2]] %||% "")))) next
    ancho1 <- max(ancho1, as.integer(round(nchar(trimws(as.character(r[[1]] %||% "")),
                                                 type = "chars") * 7.2) + 20L))
  }
  anchos <- c(min(360L, ancho1), rep(120L, max(0L, n_cols - 1L)))
  cabeceras <- integer(0)
  for (i in seq_along(rows)) {
    fila <- vapply(seq_len(n_cols), function(j) celda(i, j), character(1))
    if (.calan_es_titulo(fila[[1L]])) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF"))
    } else if (nzchar(.calan_tabla_de_cabecera(fila))) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
      poner(.maaf_alto_fila(sheet_id, i, .maaf_alto_de_cabecera(fila, anchos)))
      cabeceras <- c(cabeceras, i)
    }
  }
  # Anchos: la primera columna lleva nombres de facultad y de eslabón; el resto
  # son cifras y caben en su rótulo.
  poner(.mafs_dim_request(sheet_id, 0L, 1L, anchos[[1L]]))
  if (n_cols > 1L) poner(.mafs_dim_request(sheet_id, 1L, n_cols, 120L))
  # Las cifras a la derecha, de la primera cabecera a la última fila: leerlas en
  # columna es lo único que deja comparar de un vistazo.
  if (length(cabeceras) && n_cols > 1L) {
    # `.maaf_derecha()` toma la columna en base CERO: para empezar en la
    # segunda columna va 1, no 2. Con 2 la primera columna de cifras se quedaba
    # a la izquierda y desalineada del resto.
    poner(.maaf_derecha(sheet_id, 1L, n_cols, min(cabeceras), length(rows)))
  }
  # **La proporción tiene que vivir en la celda como NÚMERO**, o «0.918» se lee
  # como un identificador. Esta hoja no tenía ni un `numberFormat` porque todas
  # sus columnas eran conteos; con «Agendado» entra el primero, y sólo sobre esa
  # columna: un `#,##0` general aquí no arregla nada —Sheets ya alinea— y un
  # porcentaje sobre un conteo pintaría «152» como «15 200 %».
  for (k in seq_along(cabeceras)) {
    i_cab <- cabeceras[[k]]
    tabla <- .calan_tabla_de_cabecera(vapply(seq_len(n_cols), function(j) celda(i_cab, j), character(1)))
    if (!nzchar(tabla)) next
    hasta <- if (k < length(cabeceras)) cabeceras[[k + 1L]] - 1L else length(rows)
    if (hasta <= i_cab) next
    pct <- function(fila_desde, fila_hasta, col) poner(list(repeatCell = list(
      range = list(sheetId = sheet_id,
                   startRowIndex = as.integer(fila_desde), endRowIndex = as.integer(fila_hasta),
                   startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)),
      cell = list(userEnteredFormat = list(
        numberFormat = list(type = "PERCENT", pattern = "0.0%"))),
      fields = "userEnteredFormat.numberFormat"
    )))
    if (identical(tabla, "total")) {
      # **Bloque TRASPUESTO**: los conceptos son filas y el nombre a mirar es el
      # de la primera celda de cada fila, no el de la cabecera. Formatear por
      # columna aquí pintaría de porcentaje las siete cifras del bloque.
      for (i in (i_cab + 1L):hasta) {
        if (.calan_es_proporcion(celda(i, 1L), tabla)) pct(i - 1L, i, 2L)
      }
    } else {
      for (j in seq_len(n_cols)) {
        if (.calan_es_proporcion(celda(i_cab, j), tabla)) pct(i_cab, hasta, j)
      }
    }
  }
  requests
}


# --- la hoja del xlsx ---------------------------------------------------------

#' Escribe «Avance de agendación» en el libro `.xlsx`.
#'
#' **Escritor propio y no el de «Avance de campo»**, por lo mismo que el
#' formateador de Sheets: aquél es un closure atado a `AULAS_AVANCE_*` —el
#' título por `AULAS_AVANCE_TITULOS`, el porcentaje por `.calac_es_proporcion`,
#' la traspuesta por `AULAS_AVANCE_CABECERAS$general` y el color por
#' `.cai_semaforo`— y ni siquiera es alcanzable desde fuera. Éste es corto
#' porque aquí no hay ninguna de esas cuatro cosas: las cuatro tablas son
#' conteos.
#'
#' Comparte los ESTILOS con su hermana a propósito (mismo navy, misma cabecera,
#' misma rejilla): dos hojas del mismo libro que se ven distintas se leen como
#' dos documentos.
#'
#' @param wb workbook de openxlsx.
#' @param ag el modelo de `aulas_libro_agendacion()`.
#' @param hoja nombre de la pestaña.
#' @return el workbook, invisible.
#' @export
aulas_libro_escribir_agendacion <- function(ag, wb, hoja = "Avance de agendación") {
  ag <- if (is.list(ag)) ag else list()
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)

  titulo <- openxlsx::createStyle(fontSize = 16, textDecoration = "bold", fontColour = "#002457")
  pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472")
  seccion <- openxlsx::createStyle(fontSize = 11, textDecoration = "bold",
                                   fontColour = "#002457", border = "bottom",
                                   borderColour = "#C7D0DD")
  nota <- openxlsx::createStyle(fontColour = "#5B6472", wrapText = TRUE, valign = "top")
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0")
  # La proporción viaja 0-1 y se ENSEÑA como porcentaje: el rótulo no lleva
  # «(%)» —«el (%) significa que va en porcentaje, no que les pongas "(%)" al
  # título»— así que el porcentaje tiene que vivir en la celda.
  porcentaje <- openxlsx::createStyle(halign = "right", numFmt = "0.0%")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left",
                                    wrapText = TRUE, valign = "bottom")
  rejilla <- openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#3C4149")

  n_hoja <- max(vapply(AULAS_AGENDACION_CABECERAS, length, integer(1)))
  # **Los anchos salen del MODELO, no de un literal.** Esta hoja nació con «34 la
  # primera y 16 las demás», que hoy cabe: la facultad más larga mide 32. Cabe
  # por suerte, y ésa es exactamente la forma en que el libro se ganó cinco
  # cortes (ver `docs/qa/anchos-que-cortan-datos-2026-09-09.md`). Se mide lo que
  # las tablas llevan, con suelo en los mismos 34 y 16 para que una tabla
  # floja no estreche la columna, y techo en 42. Se recorren TODAS las tablas
  # que la spec declare, así que el bloque del total entró sin tocar esto.
  #
  # Del MODELO y no de la hoja escrita: las notas van fusionadas a lo ancho y
  # leerlas de vuelta pediría 42 para la columna A. Es la misma razón por la que
  # «Avance de campo» tiene su propia función de anchos.
  anchos_col <- vapply(seq_len(n_hoja), function(j) {
    largos <- unlist(lapply(names(AULAS_AGENDACION_CABECERAS), function(clave) {
      t <- ag[[clave]]
      if (!is.data.frame(t) || !nrow(t) || j > ncol(t)) return(0L)
      c(nchar(names(t)[[j]], type = "chars") %/% 2L,
        if (is.character(t[[j]])) nchar(t[[j]], type = "chars") else 0L)
    }), use.names = FALSE)
    largos <- largos[is.finite(largos)]
    as.integer(min(42L, max(if (j == 1L) 34L else 16L,
                            if (length(largos)) max(largos) + 2L else 0L)))
  }, integer(1))
  openxlsx::writeData(wb, hoja, "Avance de agendación", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  # El corte sale del MODELO y no del reloj, igual que en la pestaña de Sheets:
  # dos generaciones del mismo estado tienen que dar el mismo libro.
  dias <- if (is.data.frame(ag$dia) && nrow(ag$dia)) as.character(ag$dia[["Día"]]) else character(0)
  dias <- dias[!is.na(dias) & nzchar(dias)]
  openxlsx::writeData(wb, hoja, if (length(dias)) {
    sprintf("Agendado hasta el %s", utils::tail(dias, 1L))
  } else {
    "Todavía no hay ninguna aula con fecha agendada."
  }, startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  fila <- 4L
  for (clave in names(AULAS_AGENDACION_CABECERAS)) {
    openxlsx::writeData(wb, hoja, unname(AULAS_AGENDACION_TITULOS[[clave]]),
                        startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = seq_len(n_hoja), gridExpand = TRUE)
    fila <- fila + 1L
    tabla <- ag[[clave]]
    # C3: la sección no desaparece cuando no hay datos, dice por qué está vacía.
    if (!is.data.frame(tabla) || !nrow(tabla)) {
      .cai_nota(wb, hoja, fila, unname(.calan_VACIOS[[clave]]), nota, n_hoja, anchos_col)
      fila <- fila + 2L
      next
    }
    # **La nota se FUSIONA a lo ancho de la hoja**, con el mismo helper que su
    # hermana. Escrita sólo en la columna A se partía en seis renglones dentro
    # de una columna de 34 caracteres y empujaba la tabla media pantalla hacia
    # abajo: se vio al abrir el libro, no en los tests, que sólo miraban que el
    # texto estuviera.
    .cai_nota(wb, hoja, fila, unname(.calan_NOTAS[[clave]]), nota, n_hoja, anchos_col)
    fila <- fila + 1L

    n_col <- ncol(tabla)
    cabecera_en <- fila
    openxlsx::writeData(wb, hoja, tabla, startCol = 1, startRow = cabecera_en)
    openxlsx::addStyle(wb, hoja, cabecera, rows = cabecera_en, cols = seq_len(n_col),
                       gridExpand = TRUE)
    openxlsx::setRowHeights(wb, hoja, rows = cabecera_en, heights = 32)
    # Las cifras a la derecha, POR NOMBRE de columna y nunca por índice: el día
    # que una tabla gane una columna, un índice fijo pinta la de al lado.
    cols_num <- which(vapply(names(tabla), function(k) is.numeric(tabla[[k]]), logical(1)))
    # Las proporciones se separan de los conteos POR NOMBRE: por tipo no se
    # distinguen —las dos son numéricas— y «152» con formato de porcentaje
    # saldría como «15 200 %».
    cols_pct <- cols_num[vapply(names(tabla)[cols_num],
                                function(k) .calan_es_proporcion(k, clave), logical(1))]
    cols_cuenta <- setdiff(cols_num, cols_pct)
    filas_tabla <- (cabecera_en + 1L):(cabecera_en + nrow(tabla))
    if (length(cols_cuenta)) {
      openxlsx::addStyle(wb, hoja, numero, rows = filas_tabla,
                         cols = cols_cuenta, gridExpand = TRUE, stack = TRUE)
    }
    if (length(cols_pct)) {
      openxlsx::addStyle(wb, hoja, porcentaje, rows = filas_tabla,
                         cols = cols_pct, gridExpand = TRUE, stack = TRUE)
    }
    # En el bloque traspuesto la proporción es una FILA, no una columna: su
    # celda es la del valor y hay que pintarla aparte, o se queda con el
    # `#,##0` de sus vecinas y «0.874» sale como «1».
    if (identical(clave, "total") && ncol(tabla) >= 2L) {
      for (k in seq_len(nrow(tabla))) {
        if (!.calan_es_proporcion(tabla[[1L]][[k]], clave)) next
        openxlsx::addStyle(wb, hoja, porcentaje, rows = cabecera_en + k,
                           cols = 2L, gridExpand = TRUE, stack = TRUE)
      }
    }
    openxlsx::addStyle(wb, hoja, rejilla, rows = cabecera_en:(cabecera_en + nrow(tabla)),
                       cols = seq_len(n_col), gridExpand = TRUE, stack = TRUE)
    fila <- cabecera_en + nrow(tabla) + 2L
  }
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos_col), widths = anchos_col)
  invisible(wb)
}
