# Los refuerzos del operativo: de dónde salió cada aula y qué está rindiendo.
#
# Pedido de Gonzalo (2026-09-18, textual): «Que los refuerzos se mantengan
# guardados en pulso, que la app les haga adecuado seguimiento»; «Poder definir
# el techo de aulas y en base a ello poder pedir mas refuerzos».
#
# **El problema que resuelve.** Un aula que no es titular pudo entrar por dos
# caminos que piden decisiones opuestas: porque su titular se cayó —reemplazo
# orgánico, la cadena hace su trabajo— o porque alguien la eligió para tapar una
# brecha —refuerzo—. Gonzalo: «no hay forma de distinguir tan bien si un
# reemplazo fue por reemplazo organico o en verdad fue un reemplazo al aire que
# fue seleccionado por el selector de refuerzos». Y además: «el sheets los marco
# de morados y muchos se agendaron entonces ya no estuvieron marcados como
# refuerzo» — la marca se perdía justo al empezar a servir.
#
# **Se RECONSTRUYE, no se lee.** El plan tiene los campos donde esa decisión
# debería constar —`activation_origin`, `activation_reason`, `activated_for`,
# `activated_at`— y están vacíos: medido el 2026-09-18 sobre HSVG26ULT2, uno de
# 1 392 tiene origen y ninguno razón. Mientras nadie los escriba, la procedencia
# sale de la evidencia: si el titular de la cadena sigue vivo o ya se aplicó, la
# reserva no está reemplazando a nadie. Cada fila dice CÓMO se supo
# (`procedencia_fuente`), porque un dato inferido y uno registrado no valen lo
# mismo y la vista no debe poder confundirlos.
#
# **El techo es una decisión, no una constante.** Cuántos cursos-horario admite
# el operativo lo fija el estudio; aquí sólo se cuenta contra él. Y se cuenta
# con las aulas QUE FUERON A CAMPO, no con el eslabón en juego de cada cadena:
# son dos preguntas distintas y mezclarlas se come el margen. Medido el mismo
# día: 152 aulas fueron a campo y el criterio «en juego» daba 145, porque seis
# cadenas tienen dos eslabones aplicados. Contra un techo de 195, esa diferencia
# son siete refuerzos que no existen.

.MARF_TECHO_DEFECTO <- 0L

#' Cuántos cursos-horario admite el operativo.
#'
#' `0` significa sin techo declarado, que NO es lo mismo que un techo de cero:
#' sin él no se puede decir cuántos refuerzos caben, y el motor lo dice en vez
#' de inventar un número.
#' @param cfg config de aulas universitarias.
#' @return entero; `0` cuando el estudio no lo declara.
#' @keywords internal
.marf_techo <- function(cfg) {
  v <- suppressWarnings(as.numeric((cfg %||% list())[["techo_aulas_campo"]] %||% NA))
  if (length(v) && is.finite(v[1]) && v[1] > 0) as.integer(round(v[1])) else .MARF_TECHO_DEFECTO
}

# El texto y el número de una celda se leen con los micro-helpers COMPARTIDOS
# (`.monitoreo_scalar` y `.monitoreo_num`, de `monitoreo_engine.R`), no con una
# pareja propia: redefinirlos aquí puso en rojo `test-helpers-sin-duplicar.R`
# el mismo día que nació este motor — `.marf_txt` tenía el cuerpo exacto de
# `.malr_txt`, y el guard hizo su trabajo.

#' El plan como data.frame, con las respuestas ya atribuidas a cada fila.
#'
#' Comparte atribución con el avance (`.maac_atribucion()`): un aula que ya
#' recogió no es aforo pendiente aunque su parte no haya llegado, y ésa es
#' justamente la diferencia que descuadraba los conteos.
#' @keywords internal
.marf_marco <- function(plan, responses, cfg) {
  filas <- monitoreo_aulas_normalize_plan(plan %||% list())
  if (!length(filas)) return(NULL)
  chr <- function(k) vapply(filas, function(u) .monitoreo_scalar(u[[k]], ""), character(1))
  num <- function(k) vapply(filas, function(u) .monitoreo_num(u[[k]], 0), numeric(1))
  df <- data.frame(
    operational_code = chr("operational_code"),
    titular_operational_code = chr("titular_operational_code"),
    sample_role = chr("sample_role"), sample_status = chr("sample_status"),
    operational_status = chr("operational_status"),
    application_status = chr("application_status"),
    scheduled_date = chr("scheduled_date"), faculty = chr("faculty"),
    course_name = chr("course_name"), teacher = chr("teacher"),
    teacher_email = chr("teacher_email"), schedule = chr("schedule"),
    classroom_id = chr("classroom_id"), collection_unit_id = chr("collection_unit_id"),
    activation_origin = chr("activation_origin"), activation_reason = chr("activation_reason"),
    activated_at = chr("activated_at"),
    replacement_order = num("replacement_order"), eligible_n = num("eligible_n"),
    expected_valid = num("expected_valid"),
    sex_top_1 = chr("sex_top_1"), sex_top_1_n = num("sex_top_1_n"),
    sex_top_2 = chr("sex_top_2"), sex_top_2_n = num("sex_top_2_n"),
    stringsAsFactors = FALSE
  )
  df$respuestas_validas <- rep(0, nrow(df))
  if (is.data.frame(responses) && nrow(responses)) {
    atr <- .maac_atribucion(df, .monitoreo_aulas_valid_response(responses, cfg),
                            .monitoreo_aulas_response_classroom(responses, cfg))
    v <- atr$fila[atr$valid %in% TRUE]
    v <- v[is.finite(v)]
    if (length(v)) df$respuestas_validas <- tabulate(v, nbins = nrow(df))
  }
  # Los hombres y las mujeres que el aula puede aportar, del par `sex_top_*`
  # del marco. Es lo que permite elegir un refuerzo por la celda que falta y no
  # sólo por su tamaño.
  es <- function(letra, a, b, na, nb) ifelse(toupper(substr(a, 1L, 1L)) == letra, na,
                                             ifelse(toupper(substr(b, 1L, 1L)) == letra, nb, 0))
  df$hombres <- es("M", df$sex_top_1, df$sex_top_2, df$sex_top_1_n, df$sex_top_2_n)
  df$mujeres <- es("F", df$sex_top_1, df$sex_top_2, df$sex_top_1_n, df$sex_top_2_n)
  df
}

#' Estado de cada aula: aplicada, agendada, vencida, disponible o caída.
#' @keywords internal
.marf_estados <- function(df, hoy) {
  aplicada <- df$operational_status %in% MONITOREO_AULAS_ESTADOS_APLICADOS |
    df$application_status %in% "aplicada" |
    df$respuestas_validas > 0
  con_fecha <- .maau_con_fecha(df$sample_status, df$scheduled_date, df$operational_status)
  fechas <- suppressWarnings(as.Date(substr(df$scheduled_date, 1L, 10L)))
  corte <- suppressWarnings(as.Date(hoy))
  vencida <- !aplicada & con_fecha & !is.na(fechas) & !is.na(corte) & fechas < corte
  agendada <- !aplicada & con_fecha & !is.na(fechas) & !vencida
  caida <- .maej_caido(df$sample_status)
  list(aplicada = aplicada, agendada = agendada, vencida = vencida, caida = caida,
       fechas = fechas,
       disponible = !aplicada & !agendada & !vencida & !caida)
}

#' Por qué entró un aula que no es titular.
#'
#' Tres respuestas, y la diferencia entre ellas decide qué se hace después:
#'
#'   * `banco` — un extra: no reemplaza a nadie, es aula adicional;
#'   * `reemplazo` — su titular está caído, la cadena hizo su trabajo;
#'   * `refuerzo` — su titular sigue vivo o ya se aplicó, así que a esta aula la
#'     eligió alguien para tapar una brecha.
#'
#' @return lista con `clase` y `fuente` (`registrada` si el plan lo dice,
#'   `reconstruida` si hubo que deducirlo).
#' @keywords internal
.marf_procedencia <- function(df, estados, i) {
  origen <- tolower(trimws(df$activation_origin[i]))
  if (nzchar(origen)) {
    clase <- if (grepl("refuerzo|complemento|extra", origen)) "refuerzo" else "reemplazo"
    return(list(clase = clase, fuente = "registrada", detalle = df$activation_origin[i]))
  }
  if (identical(df$sample_role[i], "extra_reserve_pool")) {
    return(list(clase = "banco", fuente = "reconstruida",
                detalle = "del banco de extras: no reemplaza a ninguna cadena"))
  }
  cadena <- if (nzchar(df$titular_operational_code[i])) df$titular_operational_code[i] else
    df$operational_code[i]
  hermanos <- which(ifelse(nzchar(df$titular_operational_code), df$titular_operational_code,
                           df$operational_code) == cadena &
                      df$sample_role == "titular")
  if (!length(hermanos)) {
    return(list(clase = "refuerzo", fuente = "reconstruida",
                detalle = "su cadena no tiene titular en el plan"))
  }
  t <- hermanos[[1L]]
  if (isTRUE(estados$aplicada[t])) {
    return(list(clase = "refuerzo", fuente = "reconstruida",
                detalle = sprintf("su titular %s ya se aplicó con %d efectivas",
                                  df$operational_code[t], as.integer(df$respuestas_validas[t]))))
  }
  if (isTRUE(estados$caida[t])) {
    return(list(clase = "reemplazo", fuente = "reconstruida",
                detalle = sprintf("su titular %s está en %s",
                                  df$operational_code[t], df$sample_status[t])))
  }
  list(clase = "refuerzo", fuente = "reconstruida",
       detalle = sprintf("su titular %s sigue vivo (%s)",
                         df$operational_code[t], df$sample_status[t]))
}

#' Los refuerzos del operativo, su seguimiento y el margen contra el techo.
#'
#' @param plan filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias; de ella sale `techo_aulas_campo`.
#' @param hoy fecha de referencia.
#' @return `{ok, motivo, hoy, techo, aulas, activadas, rendimiento, disponibles}`.
#' @export
monitoreo_aulas_refuerzos <- function(plan = list(), responses = NULL, cfg = list(),
                                      hoy = Sys.Date()) {
  vacio <- function(motivo) list(ok = FALSE, motivo = motivo, hoy = as.character(hoy),
                                 techo = list(), aulas = list(), activadas = list(),
                                 rendimiento = list(), disponibles = list())
  cfg <- monitoreo_aulas_normalize_config(cfg)
  df <- .marf_marco(plan, responses, cfg)
  if (is.null(df) || !nrow(df)) return(vacio("el estudio todavía no tiene plan de aulas."))
  e <- .marf_estados(df, hoy)

  # --- las no titulares que están en juego o ya rindieron ---
  activas <- which((e$aplicada | e$agendada) & df$sample_role != "titular")
  activadas <- lapply(activas, function(i) {
    pr <- .marf_procedencia(df, e, i)
    list(
      codigo = df$operational_code[i], rol = df$sample_role[i],
      facultad = df$faculty[i], curso = df$course_name[i], docente = df$teacher[i],
      clase = pr$clase, procedencia_fuente = pr$fuente, por_que = pr$detalle,
      estado = if (isTRUE(e$aplicada[i])) "aplicada" else "agendada",
      fecha = df$scheduled_date[i],
      elegibles = as.integer(df$eligible_n[i]),
      efectivas = as.integer(df$respuestas_validas[i]),
      hombres = as.integer(df$hombres[i]), mujeres = as.integer(df$mujeres[i])
    )
  })

  # --- ¿rinden? Por clase, y con los titulares como referencia ---
  tasa <- function(idx) {
    if (!length(idx)) {
      return(list(n = 0L, elegibles = 0L, efectivas = 0L, tasa = NA_real_))
    }
    el <- sum(df$eligible_n[idx]); ef <- sum(df$respuestas_validas[idx])
    list(n = length(idx), elegibles = as.integer(round(el)), efectivas = as.integer(round(ef)),
         tasa = if (el > 0) round(ef / el, 4) else NA_real_)
  }
  clase_de <- rep("", nrow(df))
  for (i in activas) clase_de[i] <- .marf_procedencia(df, e, i)$clase
  aplicadas_de <- function(cl) activas[e$aplicada[activas] & clase_de[activas] == cl]
  rendimiento <- list(
    titulares = tasa(which(e$aplicada & df$sample_role == "titular")),
    reemplazo = tasa(aplicadas_de("reemplazo")),
    refuerzo = tasa(aplicadas_de("refuerzo")),
    banco = tasa(aplicadas_de("banco"))
  )

  # --- el techo, contado con las aulas QUE FUERON A CAMPO ---
  #
  # Una cita por delante en una cadena cuya aula ya se aplicó NO se va a
  # aplicar: tiene fecha, ocupa sitio en la agenda y un aplicador, pero no
  # consume techo. Contarla gastaba margen que sí existe.
  cadena <- ifelse(nzchar(df$titular_operational_code), df$titular_operational_code,
                   df$operational_code)
  cadenas_aplicadas <- unique(cadena[e$aplicada])
  huerfana <- e$agendada & cadena %in% cadenas_aplicadas & df$sample_role != "extra_reserve_pool"
  gastadas <- sum(e$aplicada)
  por_gastar <- sum(e$agendada & !huerfana)
  techo <- .marf_techo(cfg)
  list(
    ok = TRUE, motivo = "", hoy = as.character(hoy),
    techo = list(
      declarado = techo,
      hay = techo > 0,
      gastadas = as.integer(gastadas),
      por_gastar = as.integer(por_gastar),
      al_cierre = as.integer(gastadas + por_gastar),
      # Cuántos refuerzos caben todavía. `NA` sin techo declarado: decir un
      # número ahí sería inventarle un límite al estudio.
      caben = if (techo > 0) as.integer(techo - gastadas - por_gastar) else NA_integer_,
      vencidas = as.integer(sum(e$vencida)),
      citas_huerfanas = as.integer(sum(huerfana)),
      codigos_huerfanos = I(as.character(df$operational_code[huerfana]))
    ),
    activadas = activadas,
    rendimiento = rendimiento,
    # Lo que queda en la banca, por facultad: sin esto «pedir más refuerzos» no
    # sabe si hay de dónde.
    disponibles = local({
      m <- e$disponible & df$sample_role != "titular"
      if (!any(m)) return(list())
      lapply(split(which(m), df$faculty[m]), function(idx) list(
        facultad = df$faculty[idx[[1L]]],
        reservas = as.integer(sum(df$sample_role[idx] == "chain_reserve")),
        extras = as.integer(sum(df$sample_role[idx] == "extra_reserve_pool")),
        aforo = as.integer(round(sum(df$eligible_n[idx]))),
        hombres = as.integer(round(sum(df$hombres[idx]))),
        mujeres = as.integer(round(sum(df$mujeres[idx])))
      ))
    })
  )
}
