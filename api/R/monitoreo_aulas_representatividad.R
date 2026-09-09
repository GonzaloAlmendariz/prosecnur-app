# Representatividad efectiva del plan de aulas.
#
# Cuánto se parece la muestra que de verdad se está aplicando a la que el sorteo
# planificó, y cómo se dice eso en una palabra y en una frase.
#
# Sale de `monitoreo_aulas_universitarias.R` por la regla que el GOAL de
# Monitoreo profesional declara permanente para ese archivo: «cada fix que lo
# toque saca su tema a `monitoreo_aulas_<tema>.R`». Estaba en 2.691 líneas,
# +339 sobre la línea que el GOAL fijó, y 119 de ese crecimiento las puso el
# loop del registro académico sin extraer nada a cambio.
#
# Las cuatro funciones son internas: ninguna lleva `@export`, así que el
# NAMESPACE no cambia. R resuelve las llamadas en tiempo de ejecución y no de
# carga, así que el orden alfabético de los archivos no importa aquí; sí
# importaría si alguna se usara en el nivel superior de otro archivo, y no es
# el caso.

.monitoreo_aulas_distribution_distance <- function(planned, effective, var = "stratum", weight_col = "eligible_n") {
  if (!nrow(planned) || !nrow(effective) || !var %in% names(planned) || !var %in% names(effective)) {
    return(list(score = NA_real_, distance = NA_real_, table = data.frame(stringsAsFactors = FALSE), warning = "Sin datos suficientes para distancia efectiva."))
  }
  pv <- .monitoreo_aulas_values(planned, var, "sin_dato")
  ev <- .monitoreo_aulas_values(effective, var, "sin_dato")
  pw <- suppressWarnings(as.numeric(planned[[weight_col]] %||% rep(1, nrow(planned))))
  ew <- suppressWarnings(as.numeric(effective[[weight_col]] %||% rep(1, nrow(effective))))
  pw[!is.finite(pw) | pw < 0] <- 0
  ew[!is.finite(ew) | ew < 0] <- 0
  cats <- sort(unique(c(pv, ev)))
  rows <- lapply(cats, function(cat) {
    planned_n <- sum(pw[pv == cat], na.rm = TRUE)
    effective_n <- sum(ew[ev == cat], na.rm = TRUE)
    planned_prop <- planned_n / max(1, sum(pw, na.rm = TRUE))
    effective_prop <- effective_n / max(1, sum(ew, na.rm = TRUE))
    data.frame(
      variable = var,
      categoria = cat,
      planned_n = round(planned_n, 6),
      effective_n = round(effective_n, 6),
      planned_prop = round(planned_prop, 6),
      effective_prop = round(effective_prop, 6),
      abs_error = round(abs(effective_prop - planned_prop), 6),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })
  table <- if (length(rows)) do.call(rbind, rows) else data.frame(stringsAsFactors = FALSE)
  avg_abs <- if (nrow(table)) mean(table$abs_error, na.rm = TRUE) else NA_real_
  max_abs <- if (nrow(table)) max(table$abs_error, na.rm = TRUE) else NA_real_
  score <- if (is.finite(avg_abs)) round(max(0, 100 - min(100, 100 * avg_abs / 0.05)), 1) else NA_real_
  list(
    score = score,
    distance = round(avg_abs %||% NA_real_, 6),
    table = table,
    warning = if (is.finite(max_abs) && max_abs > 0.10) "La muestra efectiva se aleja más de 10 pp en al menos un grupo de facultad y sexo." else ""
  )
}

# Estado y frase de la representatividad efectiva.
#
# La escala: `score = 100 - 100 * desvio_medio / 0.05`. O sea 100 es una muestra
# efectiva identica a la planificada y 0 es un desvio medio de 5 pp o mas —el
# tope de la escala, no «sin dato»—. El estado se derivaba solo de `warning`,
# que exige 10 pp en UNA celda, asi que un 0 sobre 100 salia como «Correcto».
.monitoreo_aulas_representatividad_estado <- function(rep) {
  score <- suppressWarnings(as.numeric(rep$effective_score %||% NA_real_))
  # Sin muestra efectiva no hay nada que aprobar: decir «Correcto» cuando no hay
  # ni un curso-horario en campo es peor que no decir nada. Tampoco es una
  # alerta de representatividad —no hay desvio, hay ausencia—, asi que `review`.
  if (!is.finite(score)) return("review")
  if (nzchar(rep$warning %||% "")) return("warning")
  if (score < 70) "review" else "ok"
}

.monitoreo_aulas_representatividad_texto <- function(rep) {
  score <- suppressWarnings(as.numeric(rep$effective_score %||% NA_real_))
  dist <- suppressWarnings(as.numeric(rep$effective_distance %||% NA_real_))
  if (!is.finite(score)) {
    return(if (nzchar(rep$warning %||% "")) rep$warning else "Todavía no hay muestra efectiva que comparar con la planificada.")
  }
  base <- sprintf(
    "Puntaje %.1f de 100: la muestra efectiva se desvía %.1f pp en promedio de la planificada (100 = idéntica, 0 = 5 pp o más).",
    score, 100 * (if (is.finite(dist)) dist else 0)
  )
  if (nzchar(rep$warning %||% "")) paste(base, rep$warning) else base
}

.monitoreo_aulas_effective_representativity <- function(plan_df, cfg) {
  planned <- plan_df[plan_df$wave == "M1", , drop = FALSE]
  # **La muestra efectiva es UN eslabon por cadena, y quien lo decide es
  # `monitoreo_aulas_en_juego()`.**
  #
  # Hasta el 2026-09-08 se armaba como los M1 vivos MAS toda fila con
  # `replacement_for` no vacio y estado activo, con `"planificada"` dentro de esa
  # lista de activos. Dos errores en una linea:
  #
  #  1. `replacement_for` marca a que titular PODRIA reemplazar una reserva, no
  #     que haya reemplazado a nadie. `monitoreo_aulas_en_juego.R` ya lo tenia
  #     anotado —«no sirve: lleva el `classroom_id` y sobre HSVG2026 ninguno de
  #     sus 202 valores coincidia con un titular»— y esta funcion se quedo
  #     usandolo igual.
  #  2. `"planificada"` es un estado DORMIDO (`MONITOREO_AULAS_ESTADOS_DORMIDOS`):
  #     el eslabon todavia no entro al operativo.
  #
  # Juntos metian el banco entero en la muestra efectiva. Medido sobre
  # HSVG26ULT2 el 2026-09-08: 1 173 reservas con `replacement_for` puesto, las
  # 1 173 en `planificada` —ninguna habia entrado—, y el conjunto efectivo salia
  # de **1 347 cursos-horario contra 174 planificados**. El `score_loss` daba
  # **-17,4**: la muestra efectiva aparecia MAS representativa que el diseno,
  # que es imposible. Promediar el banco entero suaviza la distribucion.
  #
  # El defecto vivio invisible porque NINGUNA pantalla leia este bloque; se
  # descubrio al ir a montarlo. La regla no se reescribe aqui: se pide a la
  # funcion canonica, que es la misma que usa `tracked_df` unas lineas mas
  # arriba en `monitoreo_aulas_universitarias.R`.
  # **`en_juego` no alcanza solo, y la diferencia importa.** Esa funcion contesta
  # «¿a cual hay que ir a aplicar?» y por diseno NUNCA devuelve cero filas para
  # una cadena: si no queda ningun eslabon vivo deja al titular marcado, para que
  # el hueco se vea en alguna fila «nunca en cero». Para la representatividad eso
  # seria contar como muestra efectiva un aula que ya no va a aplicarse. Se resta
  # la cadena muerta con la misma lista de estados que usaba esta funcion antes
  # del arreglo, que es la que fija el test de «sin muestra efectiva».
  en_juego <- monitoreo_aulas_en_juego(plan_df)
  if (length(en_juego) != nrow(plan_df)) en_juego <- rep(FALSE, nrow(plan_df))
  muerta <- as.character(plan_df$operational_status %||% rep("", nrow(plan_df))) %in%
    c("cancelada", "sin_acceso", "reemplazada")
  effective <- plan_df[en_juego & !muerta, , drop = FALSE]
  distance <- .monitoreo_aulas_distribution_distance(planned, effective, "stratum", "eligible_n")
  planned_score <- suppressWarnings(as.numeric(planned$representativity_score[is.finite(planned$representativity_score)][1]))
  if (!is.finite(planned_score)) {
    planned_score <- suppressWarnings(as.numeric(cfg$representativity$representativity_score %||% cfg$representativity$overall_score %||% NA_real_))
  }
  score_loss <- if (is.finite(planned_score) && is.finite(distance$score)) round(planned_score - distance$score, 3) else NA_real_
  list(
    planned_score = if (is.finite(planned_score)) planned_score else NA_real_,
    effective_score = distance$score,
    effective_distance = distance$distance,
    score_loss = score_loss,
    planned_aulas = as.integer(nrow(planned)),
    effective_aulas = as.integer(nrow(effective)),
    distribution = .monitoreo_aulas_records(distance$table),
    warning = distance$warning
  )
}
