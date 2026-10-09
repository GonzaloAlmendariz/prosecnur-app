# La efectividad al grano de FACULTAD x SEXO.
#
# Gonzalo, 2026-09-10, sobre la tabla de efectividad: «ese valor no deberia
# estar en terminos generales sino en terminos de sexo; a ese grafico le falta
# granularidad en todo: tiene la tasa general pero tambien necesitamos la tasa
# por sexo y por facultad, y el superavit o deficit de alumnos por sexo y por
# facultad».
#
# La tabla mide τ = efectivas / elegibles por facultad. Esa τ promedia dos
# poblaciones que el operativo NO trata igual: la cuota se fija por facultad Y
# sexo (ADR 0079) y la brecha se suma celda a celda porque un hombre de mas no
# cubre a una mujer que falta. Una facultad puede ir conforme en su τ general y
# estar corta en una de las dos celdas — que es exactamente el patron del
# agregado que esconde lo que muerde por celda.
#
# **Los tres insumos existen y cada uno tiene su dueño; aqui no se inventa
# ninguno:**
#
# - los ELEGIBLES por sexo salen de la composicion del padron del aula
#   (`sex_top_1`/`sex_top_1_n`/`sex_top_2`/`sex_top_2_n` del plan). Ojo con la
#   trampa ya medida en este repo: `sex_top_1` es el sexo MAS FRECUENTE, no
#   «mujeres» — leerlo como mujeres invierte la mitad de las aulas.
# - las ESPERADAS por sexo las reparte `.mac_esperadas_por_sexo()`, que prefiere
#   la hoja de control cuando existe y cae a la composicion del aula si no. No
#   se recalculan aqui: dos repartos de la misma meta acaban discrepando.
# - las EFECTIVAS por sexo se cuentan de las respuestas, con los mismos dueños
#   que las cuotas: `.monitoreo_aulas_response_faculty_values()` para la
#   facultad, `monitoreo_aulas_columna_sexo()` + `monitoreo_aulas_sexo_key()`
#   para el sexo y `.maac_atribucion()` para el aula.
#
# **Y las tres se miden sobre EL MISMO conjunto de aulas: las aplicadas.**
# Mezclar esperadas de todo el plan con efectivas de lo aplicado daria un
# deficit falso del tamaño de lo que todavia no se ha visitado.

#' Efectividad por facultad y sexo.
#'
#' @param plan_df el plan, con su composicion por sexo.
#' @param responses respuestas.
#' @param cfg config de aulas (para la columna de sexo y sus equivalencias).
#' @param valid_response logico por fila de `responses`.
#' @param response_classroom identificador de aula de cada respuesta.
#' @param aplicada vector logico por fila de `plan_df`: cuales estan aplicadas.
#'
#'   **Se pide, no se deduce.** La primera version lo leia de
#'   `plan_df$application_state`, y esa columna NO EXISTE en `plan_df`: la deriva
#'   `.monitoreo_aulas_course_status()` sobre su propia copia. El resultado fue
#'   un bloque vacio en el payload sin que nada fallara —ninguna aula pasaba el
#'   filtro— y el test no lo vio porque su fixture SI traia la columna, o sea
#'   tenia la forma de `course_status` y no la del plan. Es la segunda vez que
#'   este perfil paga la misma confusion entre las dos formas.
#'
#'   `NULL` cae a `application_state` para quien la tenga, pero el llamador de
#'   dentro del motor pasa el vector explicito.
#' @param efectiva lógico por fila de `responses`: cuáles son entrevistas
#'   efectivas DEL DISEÑO (el atributo `efectiva` de `avance_cuota$casos`).
#'   `NULL` —o de otra longitud— conserva la cuenta de siempre.
#' @return lista de celdas `facultad x sexo` con elegibles, esperadas,
#'   efectivas, las dos tasas y la diferencia en PERSONAS.
#' @export
monitoreo_aulas_efectividad_por_sexo <- function(plan_df, responses = data.frame(),
                                                 cfg = list(),
                                                 valid_response = logical(0),
                                                 response_classroom = character(0),
                                                 aplicada = NULL,
                                                 efectiva = NULL) {
  if (!is.data.frame(plan_df) || !nrow(plan_df)) return(list())

  # **Sin `aplicada`, se deduce de las RESPUESTAS y no de una columna de estado.**
  #
  # El plan crudo no sabe que esta aplicado: su `operational_status` dice
  # «planificada» en las 1 392 filas y `application_state` ni existe —eso lo
  # produce `.monitoreo_aulas_course_status()` cruzando con respuestas y
  # partes—. Y ese `out` derivado ni conserva el padron por sexo ni mantiene el
  # orden del plan (se reordena por prioridad), asi que pasarle su vector de
  # estado a este motor exige una alineacion que puede romperse en silencio y
  # mandar las respuestas de un aula a la celda de otra.
  #
  # La regla de aqui es la misma que el resto del perfil usa como respaldo: un
  # curso-horario del que llego al menos una respuesta valida SE VISITO. No
  # necesita mas tablas y no puede desalinearse.
  if (is.null(aplicada)) {
    estado <- as.character(plan_df$application_state %||% rep("", nrow(plan_df)))
    aplicada <- estado %in% c("en_aplicacion", "cerrando")
    if (!any(aplicada) && is.data.frame(responses) && nrow(responses) && length(response_classroom)) {
      atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
      con_respuesta <- unique(atr$fila[atr$valid & !is.na(atr$fila)])
      aplicada <- seq_len(nrow(plan_df)) %in% con_respuesta
    }
  }
  aplicada <- if (length(aplicada) == nrow(plan_df)) aplicada %in% TRUE else rep(FALSE, nrow(plan_df))
  if (!any(aplicada)) return(list())

  fac_key <- .cm_criterios_fac_key(as.character(plan_df$faculty %||% plan_df$stratum %||% ""))
  etiqueta <- as.character(plan_df$faculty %||% plan_df$stratum %||% "")

  # --- elegibles y esperadas, aula a aula ------------------------------------
  acc <- new.env(parent = emptyenv())
  suma <- function(k, campo, valor) {
    if (!is.finite(valor) || valor <= 0) return(invisible(NULL))
    actual <- get0(k, envir = acc, ifnotfound = NULL)
    if (is.null(actual)) actual <- list(elegibles = 0, esperadas = 0, efectivas = 0, aulas = 0)
    actual[[campo]] <- actual[[campo]] + valor
    assign(k, actual, envir = acc)
  }
  etiquetas <- list()

  for (i in which(aplicada)) {
    k <- fac_key[[i]]
    if (!nzchar(k)) next
    fila <- plan_df[i, , drop = FALSE]
    # El padron del aula, con su sexo declarado. `.pulso_sexo_fm` traduce la
    # etiqueta a F/M; sin ella no se reparte nada, porque suponer que el sexo
    # mas frecuente son mujeres es justo el error que ya costo una lectura al
    # reves de todo el tablero.
    s1 <- .pulso_sexo_fm(.monitoreo_scalar(fila$sex_top_1 %||% "", ""))
    s2 <- .pulso_sexo_fm(.monitoreo_scalar(fila$sex_top_2 %||% "", ""))
    n1 <- suppressWarnings(as.numeric(fila$sex_top_1_n %||% NA))[1]
    n2 <- suppressWarnings(as.numeric(fila$sex_top_2_n %||% NA))[1]
    if (identical(s1, "F") || identical(s1, "M")) {
      if (is.finite(n1)) suma(paste(k, s1, sep = "|"), "elegibles", n1)
      if ((identical(s2, "F") || identical(s2, "M")) && is.finite(n2)) {
        suma(paste(k, s2, sep = "|"), "elegibles", n2)
      }
    }
    esp <- .mac_esperadas_por_sexo(fila)
    if (length(esp$valores)) {
      for (sx in names(esp$valores)) {
        sk <- .pulso_sexo_fm(sx)
        if (identical(sk, "F") || identical(sk, "M")) {
          suma(paste(k, sk, sep = "|"), "esperadas", as.numeric(esp$valores[[sx]]))
          suma(paste(k, sk, sep = "|"), "aulas", 1 / max(1L, length(esp$valores)))
        }
      }
    }
    if (!k %in% names(etiquetas)) etiquetas[[k]] <- etiqueta[[i]]
  }

  # --- efectivas por facultad y sexo, SOLO de las aulas aplicadas ------------
  if (is.data.frame(responses) && nrow(responses) && length(response_classroom)) {
    atr <- .maac_atribucion(plan_df, valid_response, response_classroom)
    facultad <- .monitoreo_aulas_response_faculty_values(responses, plan_df, response_classroom)
    if (length(facultad) != nrow(atr)) facultad <- rep("", nrow(atr))
    sex_col <- monitoreo_aulas_columna_sexo(responses, cfg)
    sexo_raw <- if (nzchar(sex_col)) .monitoreo_aulas_values(responses, sex_col, "") else character(0)
    if (length(sexo_raw) != nrow(atr)) sexo_raw <- rep("", nrow(atr))
    sexo_key <- monitoreo_aulas_sexo_key(sexo_raw, cfg)
    # **Sólo las respuestas de un aula APLICADA.** Es lo que hace comparables
    # las efectivas con las esperadas de arriba; contar las que llegaron por un
    # aula que el plan aun no da por aplicada compararia dos universos.
    de_aplicada <- !is.na(atr$fila) & aplicada[pmax(1L, atr$fila)]
    keep <- atr$valid & nzchar(facultad) & sexo_key %in% c("F", "M") & de_aplicada
    # **Y sólo las de la población que miden los elegibles.** `sex_top_*_n`
    # cuenta a la población del diseño; con el eje en la persona el aula entera
    # contesta y el diseño mide un subconjunto. Medido sobre CCSS Perfil 2026-II
    # al cierre del 2026-09-22: elegibles 118 + 95 = 213 del diseño contra
    # efectivas 93 + 71 = 164 del aula entera, y la fila publicaba Mujeres
    # 78,8 % y Hombres 74,7 % al lado de una τ de 57,8 %. Ninguna de las dos
    # partes puede quedar por encima del todo.
    if (is.logical(efectiva) && length(efectiva) == length(keep)) {
      keep <- keep & efectiva %in% TRUE
    }
    if (any(keep)) {
      fk <- .cm_criterios_fac_key(facultad[keep])
      sk <- sexo_key[keep]
      for (j in seq_along(fk)) {
        if (!nzchar(fk[[j]])) next
        suma(paste(fk[[j]], sk[[j]], sep = "|"), "efectivas", 1)
      }
    }
  }

  claves <- sort(ls(acc))
  out <- list()
  for (k in claves) {
    v <- get(k, envir = acc)
    partes <- strsplit(k, "|", fixed = TRUE)[[1]]
    fk <- partes[[1]]; sx <- partes[[2]]
    elegibles <- v$elegibles
    # Sin elegibles no hay tasa; la diferencia en personas SI se puede dar, que
    # es la mitad de lo que se pregunta.
    tasa <- function(x) if (elegibles > 0) round(x / elegibles, 4) else NA_real_
    out[[length(out) + 1L]] <- list(
      faculty_key = fk,
      facultad = etiquetas[[fk]] %||% fk,
      sexo = sx,
      elegibles = as.integer(round(elegibles)),
      esperadas = round(v$esperadas, 1),
      efectivas = as.integer(round(v$efectivas)),
      tasa_prevista = tasa(v$esperadas),
      tasa_observada = tasa(v$efectivas),
      # En PERSONAS y con signo, que es como se decide si hay que agendar mas
      # aulas para esa celda.
      diferencia = round(v$efectivas - v$esperadas, 1)
    )
  }
  out
}
