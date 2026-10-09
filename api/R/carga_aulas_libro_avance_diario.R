# carga_aulas_libro_avance_diario.R — la tabla «AVANCE DIARIO».
#
# Dictado de Gonzalo (2026-09-08): «Facultad, Día, Día de la semana, Efectivas
# del día, Efectivas esperadas, Diferencia (de las esperadas y las obtenidas),
# Efectivas acumuladas, Faltantes para la meta (muestra), Tasa de facultad
# esperada, Tasa de facultad obtenida (en el día)» — con su corrección de
# rótulo: «la "tasa de facultad" es en realidad la "Tasa de rendimiento de la
# facultad"».
#
# **La serie cambia de sujeto: de UN día del estudio a un día DE CADA
# FACULTAD.** La versión anterior era una fila por jornada con el total y el
# acumulado del operativo entero, y con quince cuotas que no se compensan entre
# sí (ADR 0079) esa fila no permitía decidir nada: un martes de 300 efectivas
# puede ser un martes excelente en Ciencias y un martes perdido en Derecho, y la
# suma dice «300».
#
# QUÉ SON LAS «EFECTIVAS ESPERADAS» DE UN DÍA
#
# **Las de los curso-horario que YA SE APLICARON ese día, no las de todos los
# agendados.** Gonzalo, 2026-09-08, viendo la tabla publicada: «las efectivas
# esperadas son las de los cursos-horario que ya se han aplicado en el día, no
# todas las planificadas del día, ¿verdad? porque lo segundo no sería justo».
#
# Esta columna llegó a medirse sobre las AGENDADAS durante un rato, por una
# respuesta suya que llegó por otra vía. No lo dejes así otra vez: comparar las
# efectivas de un día contra la meta de todo lo agendado castiga a la facultad
# por las aulas a las que todavía no ha ido, y en una jornada a medias castiga
# por las horas que faltan. La comparación justa es contra lo que se aplicó, que
# es lo mismo que produjo las efectivas del día.
#
# El día de aplicación sale de la PLATAFORMA: la primera jornada en que el aula
# produjo una efectiva. Es la misma decisión de
# `.monitoreo_aulas_fecha_de_plataforma()`, y por el mismo motivo medido en
# campo: `applied_at` llegaba vacío en los 152 partes mientras las respuestas
# traían hora completa. La diferencia con aquella función es que aquí se cuentan
# sólo las EFECTIVAS, porque es contra ellas que se mide la meta.
#
# Un día puede traer efectivas y ninguna aula estrenada: son las respuestas
# rezagadas de un aula de ayer. Ahí las esperadas y la tasa del día quedan en
# blanco, porque dividir entre los elegibles de cero aulas no es cero sino
# indefinido, y las efectivas siguen contando en el acumulado.

# Los días de la semana en castellano, SIN pasar por el locale del sistema.
# `format(x, "%A")` devuelve «Tuesday» en un contenedor sin locale español y ya
# costó una tanda de rojos en otro módulo. `%w` es un número y no depende de nada.
.calad_DIAS_SEMANA <- c("domingo", "lunes", "martes", "miércoles",
                        "jueves", "viernes", "sábado")

.calad_dia_de_la_semana <- function(iso) {
  d <- suppressWarnings(as.Date(iso))
  out <- rep("", length(d))
  ok <- !is.na(d)
  if (any(ok)) {
    i <- as.integer(format(d[ok], "%w")) + 1L
    out[ok] <- .calad_DIAS_SEMANA[i]
  }
  out
}

#' Avance diario por facultad.
#'
#' @param unidades filas del plan que entran al libro.
#' @param responses `data.frame` de respuestas de la plataforma.
#' @param validas vector lógico por fila de `responses`: cuáles son efectivas.
#' @param cuotas bloque `design_targets` de la config, para la meta de cada
#'   facultad.
#' @param cfg config de aulas universitarias (criterio de validez, claves).
#' @return `data.frame` con las columnas de `AULAS_AVANCE_CABECERAS$diario`, o
#'   `NULL` si no hay respuestas fechadas con que armar la serie.
#' @keywords internal
.calad_avance_diario <- function(unidades, responses = NULL, validas = NULL,
                                 cuotas = NULL, cfg = list(),
                                 # **Qué respuestas son ENTREVISTAS EFECTIVAS**,
                                 # por fila de `responses`. Con el eje atribuido
                                 # a la persona, una válida recogida en un aula
                                 # aplicada puede no serlo —quien contestó no
                                 # pertenece a la población medida, o su código
                                 # no se verifica—, y esta tabla las contaba
                                 # todas: publicaba «127 efectivas · +21» en
                                 # verde cuando eran 94 y la diferencia −12,
                                 # contradiciendo a «Rendimiento» dos tablas más
                                 # arriba en la misma hoja. NULL = el criterio de
                                 # siempre, y ningún estudio con eje en el aula
                                 # se mueve.
                                 efectivas_resp = NULL) {
  unidades <- unidades %||% list()
  if (!length(unidades) || !is.data.frame(responses) || !nrow(responses)) return(NULL)

  col <- .monitoreo_aulas_col(responses, MONITOREO_AULAS_COLUMNAS_TIEMPO)
  if (!nzchar(col)) return(NULL)
  # Con huso: en UTC el avance de un aula de las 19:30 se anota en la jornada
  # siguiente (`monitoreo_aulas_hora_local.R`).
  dia_resp <- monitoreo_aulas_fecha_local(as.character(responses[[col]]))

  # **El índice del plan se arma desde las unidades CRUDAS, no con
  # `monitoreo_aulas_normalize_plan()`.** El normalizador descarta la fila que no
  # trae `classroom_id`, y el plan del libro habla en código operativo: con un
  # plan sin esa columna devolvía cero filas y la tabla entera desaparecía en
  # silencio. Es la misma decisión de `.calaf_avance_por_facultad()`, que
  # tampoco lo usa. Las tres claves del emparejamiento viajan igual, que es lo
  # que `.monitoreo_aulas_contar_por_fila()` necesita.
  campo <- function(k) vapply(unidades, function(u) .cai_txt(u[[k]]), character(1))
  plan_df <- data.frame(
    classroom_id = campo("classroom_id"),
    collection_unit_id = campo("collection_unit_id"),
    operational_code = campo("operational_code"),
    stringsAsFactors = FALSE
  )
  if (!nrow(plan_df)) return(NULL)
  aula <- .monitoreo_aulas_response_classroom(responses, cfg)
  valida <- if (!is.null(validas) && length(validas) == nrow(responses)) {
    validas %in% TRUE
  } else {
    .monitoreo_aulas_valid_response(responses, cfg)
  }

  # La validez del criterio del estudio, acotada a lo que además es una
  # entrevista efectiva de su celda cuando el estudio lo puede distinguir.
  if (!is.null(efectivas_resp) && length(efectivas_resp) == nrow(responses)) {
    valida <- valida & (efectivas_resp %in% TRUE)
  }
  vivas <- valida & nzchar(dia_resp) & nzchar(trimws(as.character(aula)))
  if (!any(vivas)) return(NULL)
  dias <- sort(unique(dia_resp[vivas]))

  # Facultad, elegibles, esperadas y tasa de cada fila del plan, en el MISMO
  # orden que `plan_df` — que es el orden en que
  # `.monitoreo_aulas_contar_por_fila()` devuelve sus conteos.
  num <- function(k) vapply(unidades, function(u) .cai_num(u[[k]]), numeric(1))
  fac_plan <- campo("faculty")
  eleg_plan <- num("eligible_n")
  esp_plan <- num("expected_valid")

  # Las efectivas de cada fila del plan en cada día, con la MISMA maquinaria de
  # emparejamiento que el total del aula: tres claves (classroom_id,
  # collection_unit_id, código operativo) y espacio canónico cuando no colisionan.
  por_dia <- lapply(dias, function(d) {
    conteo <- .monitoreo_aulas_named_counts(aula, vivas & dia_resp == d)
    as.numeric(.monitoreo_aulas_contar_por_fila(plan_df, conteo))
  })
  names(por_dia) <- dias

  # El día en que cada aula se aplicó: el primero en que produjo una efectiva.
  primera <- rep(NA_character_, nrow(plan_df))
  for (d in dias) {
    nuevo <- is.na(primera) & por_dia[[d]] > 0
    primera[nuevo] <- d
  }

  # La cuota de cada facultad, para «Faltantes para la meta».
  cuota_de <- list()
  for (f in ((cuotas %||% list())$facultades %||% list())) {
    k <- .cai_txt(f$faculty_key %||% .cm_criterios_fac_key(.cai_txt(f$facultad)))
    if (nzchar(k)) cuota_de[[k]] <- .cai_num(f$cuota)
  }

  facultades <- sort(unique(fac_plan[nzchar(fac_plan)]))
  filas <- list()
  for (f in facultades) {
    idx <- fac_plan == f
    clave_fac <- .cm_criterios_fac_key(f)[[1]]
    cuota <- if (!is.null(cuota_de[[clave_fac]])) cuota_de[[clave_fac]] else NA_real_
    # La vara de la facultad, la misma que citan las otras dos tablas: lo que el
    # diseño espera de todas sus aulas entre los elegibles que pone. Constante a
    # lo largo del operativo, para que la comparación con la tasa del día diga
    # si ese día rindió por encima o por debajo de lo que la facultad rinde.
    esperada_tasa <- .calar_tasa_esperada(esp_plan[idx], eleg_plan[idx])
    acumulado <- 0
    for (d in dias) {
      del_dia <- sum(por_dia[[d]][idx], na.rm = TRUE)
      aplicadas_hoy <- idx & !is.na(primera) & primera == d
      # Ni efectivas ni aulas estrenadas: ese día esa facultad no estuvo en el
      # campo y una fila en cero sólo alarga la tabla.
      if (del_dia <= 0 && !any(aplicadas_hoy)) next
      esperadas <- sum(esp_plan[aplicadas_hoy & is.finite(esp_plan)], na.rm = TRUE)
      eleg_hoy <- sum(eleg_plan[aplicadas_hoy & is.finite(eleg_plan)], na.rm = TRUE)
      acumulado <- acumulado + del_dia
      obtenida_tasa <- if (eleg_hoy > 0) del_dia / eleg_hoy else NA_real_
      out <- data.frame(
        f, d, .calad_dia_de_la_semana(d),
        del_dia,
        if (any(aplicadas_hoy)) round(esperadas) else NA_real_,
        if (any(aplicadas_hoy)) del_dia - round(esperadas) else NA_real_,
        acumulado,
        if (is.finite(cuota)) max(0, cuota - acumulado) else NA_real_,
        esperada_tasa,
        obtenida_tasa,
        # La brecha de tasa del día, que es lo que dice si ese día se rindió por
        # encima o por debajo de lo que la facultad rinde de costumbre. La
        # diferencia en encuestas ya está arriba; ésta es la misma noticia en
        # la unidad que compara aulas de tamaños distintos.
        if (is.finite(esperada_tasa) && is.finite(obtenida_tasa)) {
          obtenida_tasa - esperada_tasa
        } else NA_real_,
        stringsAsFactors = FALSE
      )
      names(out) <- AULAS_AVANCE_CABECERAS$diario
      filas[[length(filas) + 1L]] <- out
    }
  }
  if (!length(filas)) return(NULL)
  out <- do.call(rbind, filas)
  # **Por DÍA y dentro por facultad** (Gonzalo, 2026-09-08, viendo la tabla
  # publicada: «esto debe estar ordenado por día y luego por facultad»). La
  # primera versión agrupaba por facultad, que es como se calcula —el acumulado
  # corre dentro de cada una— pero no como se lee: quien abre esta tabla mira
  # la jornada de ayer entera, no el historial de una facultad. El acumulado y
  # los faltantes ya están calculados por facultad, así que reordenar no los
  # toca.
  out[order(out[["Día"]], out$Facultad), , drop = FALSE]
}
