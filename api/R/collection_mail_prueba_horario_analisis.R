# =============================================================================
# Material de campo › Correo › Seguimiento › Prueba de horarios: análisis.
#
# Pregunta: ¿se completa más la encuesta cuando el recordatorio llega a una
# hora o a otra? Cada persona tiene un grupo fijo (A o B, sorteado dentro de su
# público) y en cada recordatorio cada grupo recibe a su hora.
#
# Medida (por recordatorio y público):
#   base (n)  quienes recibieron ese recordatorio: personas del grupo con enlace
#             personal que no habían completado antes del envío de su grupo;
#   completas (x) las que completaron dentro de H horas desde el envío de SU
#             grupo. H es la misma para los dos grupos, así ninguno gana por
#             haber tenido más tiempo. Si el recordatorio sigue en curso, H se
#             recorta a lo que alcanzó el grupo que salió último.
# Un público entra a la comparación de un recordatorio sólo si sus dos grupos
# tienen hora y las horas son distintas (con la misma hora no hay nada que
# comparar). Se compara con Cochran-Mantel-Haenszel por público y se lee cada
# público con la diferencia A − B y su intervalo (collection_mail_prueba_estadistica.R).
#
# Funciones puras: reciben tablas, no la sesión.
# =============================================================================

.MPH_TZ <- "America/Lima"

# "10:00 a. m." / "8:00 p. m." en hora de Lima.
.mph_hora_txt <- function(t) {
  if (is.na(t)) return("")
  lt <- as.POSIXlt(t, tz = .MPH_TZ)
  h <- lt$hour; m <- lt$min
  suf <- if (h < 12) "a. m." else "p. m."
  h12 <- h %% 12; if (h12 == 0) h12 <- 12
  sprintf("%d:%02d %s", h12, m, suf)
}

.mph_fecha_txt <- function(t) {
  if (is.na(t)) return("")
  lt <- as.POSIXlt(t, tz = .MPH_TZ)
  dias <- c("domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado")
  meses <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
             "octubre", "noviembre", "diciembre")
  sprintf("%s %d de %s", dias[lt$wday + 1L], lt$mday, meses[lt$mon + 1L])
}

# Franja del día de una hora, para leer el cruce entre recordatorios.
.mph_franja <- function(t) {
  h <- as.POSIXlt(t, tz = .MPH_TZ)$hour + as.POSIXlt(t, tz = .MPH_TZ)$min / 60
  if (is.na(h)) return(NA_character_)
  if (h < 12) "mañana" else if (h < 15) "mediodía" else if (h < 19) "tarde" else "noche"
}

.mph_p_txt <- function(p) {
  if (is.na(p)) return("")
  if (p < 0.001) "p < 0.001" else sprintf("p = %s", formatC(p, format = "f", digits = if (p < 0.01) 3 else 2))
}

.mph_pct_txt <- function(x) if (is.na(x)) "" else sprintf("%s %%", formatC(x, format = "f", digits = 2))

#' Análisis de la prueba de horarios.
#'
#' @param personas data.frame(publico, grupo = "A"/"B", completo_en POSIXct o NA).
#' @param envios data.frame(ronda int, etiqueta chr, publico, grupo, hora POSIXct).
#' @param horizonte_h horas desde cada envío.
#' @param ahora corte del análisis.
#' @keywords internal
.mph_analizar <- function(personas, envios, horizonte_h = 24, ahora = Sys.time()) {
  ahora <- as.POSIXct(ahora, tz = "UTC")
  horizonte_h <- max(1, as.numeric(horizonte_h))
  rondas <- sort(unique(envios$ronda))
  out <- lapply(rondas, function(k) {
    ev <- envios[envios$ronda == k, , drop = FALSE]
    etiqueta <- as.character(ev$etiqueta[[1]] %||% sprintf("Recordatorio %d", k))
    publicos <- unique(ev$publico)
    excluidos <- list(); comparables <- character(0); horas <- list()
    for (p in publicos) {
      tA <- ev$hora[ev$publico == p & ev$grupo == "A"]; tB <- ev$hora[ev$publico == p & ev$grupo == "B"]
      tA <- if (length(tA)) tA[[1]] else as.POSIXct(NA); tB <- if (length(tB)) tB[[1]] else as.POSIXct(NA)
      motivo <- if (is.na(tA) || is.na(tB)) "falta la hora de un grupo"
                else if (abs(as.numeric(tA) - as.numeric(tB)) < 60) "los dos grupos tuvieron la misma hora"
                else if (max(tA, tB) > ahora) "todavía no sale el envío de un grupo"
                else NULL
      if (!is.null(motivo)) { excluidos[[length(excluidos) + 1L]] <- list(publico = p, motivo = motivo); next }
      comparables <- c(comparables, p)
      horas[[p]] <- list(A = tA, B = tB)
    }
    if (!length(comparables)) {
      return(list(ronda = as.integer(k), etiqueta = etiqueta, comparable = FALSE, excluidos = excluidos,
                  publicos = list(), total = NULL, cmh = NULL, curvas = list(), lectura = "Sin públicos que comparar todavía."))
    }
    ultimo <- max(vapply(horas, function(h) as.numeric(max(h$A, h$B)), 0))
    alcanzado <- (as.numeric(ahora) - ultimo) / 3600
    H <- min(horizonte_h, alcanzado)
    en_curso <- alcanzado < horizonte_h
    filas <- list(); estratos <- data.frame(xA = integer(0), nA = integer(0), xB = integer(0), nB = integer(0))
    curva <- list(A = numeric(0), B = numeric(0))
    # Hasta H exacto: la última cifra de la curva es la de la tabla.
    pasos <- unique(c(seq(0, floor(H)), H))
    acum <- list(A = matrix(0, nrow = length(pasos), ncol = 2), B = matrix(0, nrow = length(pasos), ncol = 2))
    for (p in comparables) {
      cnt <- list()
      for (g in c("A", "B")) {
        t0 <- horas[[p]][[g]]
        sel <- personas$publico == p & personas$grupo == g
        ce <- personas$completo_en[sel]
        base <- is.na(ce) | ce >= t0
        dt <- (as.numeric(ce[base]) - as.numeric(t0)) / 3600
        x <- sum(!is.na(dt) & dt < H)
        cnt[[g]] <- c(x = x, n = sum(base))
        acum[[g]][, 1] <- acum[[g]][, 1] + vapply(pasos, function(h) sum(!is.na(dt) & dt < max(h, 1e-9) & dt < H), 0)
        acum[[g]][, 2] <- acum[[g]][, 2] + sum(base)
      }
      f <- .prueba_fila(cnt$A[["x"]], cnt$A[["n"]], cnt$B[["x"]], cnt$B[["n"]])
      f$publico <- p
      f$horaA <- .mph_hora_txt(horas[[p]]$A); f$horaB <- .mph_hora_txt(horas[[p]]$B)
      filas[[length(filas) + 1L]] <- f
      estratos[nrow(estratos) + 1L, ] <- c(cnt$A[["x"]], cnt$A[["n"]], cnt$B[["x"]], cnt$B[["n"]])
    }
    total <- .prueba_fila(sum(estratos$xA), sum(estratos$nA), sum(estratos$xB), sum(estratos$nB))
    cmh <- .prueba_cmh(estratos)
    # Hora "de la ronda": la del público más grande (los de oficina pueden tener otra).
    mayor <- comparables[which.max(estratos$nA + estratos$nB)]
    hA <- horas[[mayor]]$A; hB <- horas[[mayor]]$B
    curvas <- lapply(seq_along(pasos), function(i) list(
      horas = pasos[[i]],
      pctA = .prueba_pct(acum$A[i, 1], acum$A[i, 2]), pctB = .prueba_pct(acum$B[i, 1], acum$B[i, 2])))
    res <- list(
      ronda = as.integer(k), etiqueta = etiqueta, comparable = TRUE, en_curso = en_curso,
      horizonte_h = round(H, 1), horaA = .mph_hora_txt(hA), horaB = .mph_hora_txt(hB),
      fecha = .mph_fecha_txt(hA), franjaA = .mph_franja(hA), franjaB = .mph_franja(hB),
      publicos = filas, total = total,
      cmh = list(or = round(cmh$or, 3), or_li = round(cmh$or_li, 3), or_ls = round(cmh$or_ls, 3),
                 chi2 = round(cmh$chi2, 3), p = signif(cmh$p, 3), p_txt = .mph_p_txt(cmh$p)),
      ganador = if (!is.na(cmh$p) && cmh$p < 0.05) (if (cmh$or > 1) "A" else "B") else "empate",
      excluidos = excluidos, curvas = curvas
    )
    res$lectura <- .mph_lectura_ronda(res)
    res
  })
  list(rondas = out, horizonte_h = horizonte_h, cruce = .mph_lectura_cruce(out),
       corte = format(ahora, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
}

# Una frase por recordatorio: quién ganó y con qué cifras, o que empataron.
.mph_lectura_ronda <- function(r) {
  t <- r$total
  base <- sprintf("A las %s horas de cada envío, el grupo A (%s) completó %s y el grupo B (%s) %s",
                  formatC(r$horizonte_h, format = "fg"), r$horaA, .mph_pct_txt(t$pctA), r$horaB, .mph_pct_txt(t$pctB))
  veredicto <- switch(r$ganador,
    A = sprintf("ganaron las %s (%s)", r$horaA, r$cmh$p_txt),
    B = sprintf("ganaron las %s (%s)", r$horaB, r$cmh$p_txt),
    sprintf("no hay diferencia clara (%s)", r$cmh$p_txt))
  txt <- sprintf("%s: %s.", base, veredicto)
  if (isTRUE(r$en_curso)) txt <- paste(txt, "El recordatorio sigue en curso.")
  txt
}

# ¿La hora que gana se repite con los grupos cruzados? Si en dos recordatorios
# gana la misma franja del día y en cada uno la tuvo un grupo distinto, la
# diferencia es de la hora y no del grupo.
.mph_lectura_cruce <- function(rondas) {
  gan <- Filter(function(r) isTRUE(r$comparable) && r$ganador %in% c("A", "B"), rondas)
  if (length(gan) < 2L) return(list(confirmado = FALSE, texto = ""))
  franja <- vapply(gan, function(r) if (r$ganador == "A") r$franjaA else r$franjaB, "")
  grupo <- vapply(gan, function(r) r$ganador, "")
  for (f in unique(franja)) {
    i <- which(franja == f)
    if (length(unique(grupo[i])) == 2L) {
      etiquetas <- paste(vapply(gan[i], function(r) r$etiqueta, ""), collapse = " y ")
      return(list(confirmado = TRUE, franja = f,
                  texto = sprintf("%s %s ganó en %s con los grupos cruzados: la diferencia se debe a la hora y no al grupo.",
                                  if (identical(f, "mediodía")) "El" else "La", f, etiquetas)))
    }
  }
  list(confirmado = FALSE, texto = "")
}
