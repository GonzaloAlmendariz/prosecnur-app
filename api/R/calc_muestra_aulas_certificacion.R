# =============================================================================
# Certificación por facultad de la selección de aulas
# =============================================================================
#
# Gonzalo (2026-08-18, textual): «siempre muy importante tener aulas tal que
# nos garantice tener la cantidad de alumnos que nos hemos trazado en la meta
# (…) cada facultad tiene metas en función de pesos, y tenemos que llegar a
# esas metas, entonces la selección de aulas tiene que ser por facultad, o
# sea, tiene que certificarse de esa forma».
#
# La certificación responde UNA pregunta por facultad: ¿las aulas titulares
# seleccionadas cargan suficientes alumnos elegibles para cubrir la cuota que
# el diseño le trazó, con la tasa de asistencia esperada? No es un conteo de
# aulas —eso ya lo garantiza la afijación— sino de ALUMNOS: una facultad
# puede tener sus N aulas y aún así no llegar si le tocaron aulas chicas.
#
# Derivada AL SERVIR (patrón sexo_por_facultad): aditiva, nunca persiste y
# por eso nunca queda desfasada de la selección vigente. Se mide sobre las
# TITULARES, que son las que se visitan y entregan la cuota.

.cm_certificacion_componente_facultad <- function(estudio) {
  if (!is.list(estudio)) return(NULL)
  componentes <- estudio$componentes
  if (!is.list(componentes)) return(NULL)
  con_filas <- Filter(function(c) {
    is.list(c) && is.list(c$resultado) && length(c$resultado$aulas_por_estrato)
  }, componentes)
  if (!length(con_filas)) return(NULL)
  # Igual que filasParaFichas en la UI: manda el primer componente cuyo
  # resultado publica margen (el escenario vigente del diseño).
  con_margen <- Filter(function(c) {
    any(vapply(c$resultado$aulas_por_estrato, function(f) !is.null(f$margen), logical(1)))
  }, con_filas)
  if (length(con_margen)) con_margen[[1]]$resultado$aulas_por_estrato
  else con_filas[[1]]$resultado$aulas_por_estrato
}

# Cuotas por facultad × sexo del diseño: el engine del cálculo YA las
# sub-distribuye (proporcional a la población de cada sexo en la facultad) y
# las publica en `distribucion_sub`; aquí sólo se leen. Devuelve
# fac_key -> list(F = cuota, M = cuota) con claves de sexo normalizadas.
.cm_certificacion_cuotas_sexo <- function(estudio) {
  if (!is.list(estudio)) return(list())
  componentes <- estudio$componentes
  if (!is.list(componentes)) return(list())
  sub <- NULL
  for (comp in componentes) {
    if (is.list(comp) && is.list(comp$resultado) && length(comp$resultado$distribucion_sub)) {
      sub <- comp$resultado$distribucion_sub
      break
    }
  }
  if (!length(sub)) return(list())
  out <- list()
  for (fila in sub) {
    if (!is.list(fila)) next
    k <- .cm_aulas_scalar(.cm_criterios_fac_key(fila$estrato %||% ""), "")
    sexo <- toupper(.cm_aulas_scalar(fila$sub, ""))
    n <- suppressWarnings(as.numeric(.cm_aulas_scalar(fila$n, NA)))
    if (!nzchar(k) || !sexo %in% c("F", "M") || !is.finite(n)) next
    if (is.null(out[[k]])) out[[k]] <- list()
    out[[k]][[sexo]] <- n
  }
  out
}

# Elegibles por sexo en las titulares de una facultad, desde las columnas
# sex_top_* de la selección (con dos sexos, top-1 y top-2 son el split
# completo del aula).
.cm_certificacion_elegibles_sexo <- function(titulares, fac_keys, k) {
  filas <- titulares[fac_keys == k, , drop = FALSE]
  acc <- c(F = 0, M = 0)
  if (!nrow(filas)) return(acc)
  for (lado in c("sex_top_1", "sex_top_2")) {
    col_n <- paste0(lado, "_n")
    if (!lado %in% names(filas) || !col_n %in% names(filas)) next
    sexo <- toupper(as.character(filas[[lado]]))
    n <- suppressWarnings(as.numeric(filas[[col_n]]))
    n[!is.finite(n)] <- 0
    for (sx in c("F", "M")) acc[[sx]] <- acc[[sx]] + sum(n[sexo == sx])
  }
  acc
}

.cm_certificacion_tasa <- function(referencia_asistencia) {
  if (!is.list(referencia_asistencia)) return(NA_real_)
  d <- referencia_asistencia$diseno
  tasa <- suppressWarnings(as.numeric(.cm_aulas_scalar(
    if (is.list(d)) d$tasa_respuesta_asumida else NULL, NA
  )))
  if (length(tasa) == 1L && is.finite(tasa) && tasa > 0 && tasa <= 1) tasa else NA_real_
}

#' Añade `certificacion_facultad` a la selección.
#'
#' Aditivo: no toca ninguna cifra del sorteo. Por facultad del diseño:
#' cuota trazada, elegibles en titulares, efectivas esperadas
#' (elegibles × tasa), margen y estado. Un dato ausente produce un estado
#' que dice la causa (`sin_tasa`, `sin_titulares`), nunca un 0 que se
#' leería como medido.
#'
#' @keywords internal
calc_muestra_aulas_adjuntar_certificacion <- function(selection, estudio = NULL,
                                                      referencia_asistencia = NULL) {
  if (!is.list(selection)) return(selection)
  sel_df <- selection$selection
  if (!is.data.frame(sel_df) || !nrow(sel_df)) return(selection)
  filas_estudio <- .cm_certificacion_componente_facultad(estudio)
  if (!length(filas_estudio)) return(selection)

  roles <- if ("sample_role" %in% names(sel_df)) as.character(sel_df$sample_role) else rep("", nrow(sel_df))
  titulares <- sel_df[roles %in% "titular", , drop = FALSE]
  if (!nrow(titulares) && "wave" %in% names(sel_df)) {
    titulares <- sel_df[as.character(sel_df$wave) %in% "M1", , drop = FALSE]
  }
  eleg_por_fac <- list()
  aulas_por_fac <- list()
  titulares_fk <- character(0)
  if (nrow(titulares) && "faculty" %in% names(titulares)) {
    titulares_fk <- .cm_criterios_fac_key(as.character(titulares$faculty))
    el <- suppressWarnings(as.numeric(titulares$eligible_n))
    el[!is.finite(el)] <- 0
    for (i in seq_along(titulares_fk)) {
      k <- titulares_fk[[i]]
      if (!nzchar(k)) next
      eleg_por_fac[[k]] <- (eleg_por_fac[[k]] %||% 0) + el[[i]]
      aulas_por_fac[[k]] <- (aulas_por_fac[[k]] %||% 0L) + 1L
    }
  }
  cuotas_sexo <- .cm_certificacion_cuotas_sexo(estudio)

  tasa <- .cm_certificacion_tasa(referencia_asistencia)
  fmt1 <- function(x) format(round(x, 1), trim = TRUE, scientific = FALSE, big.mark = " ")
  filas <- list()
  certificadas <- 0L
  evaluables <- 0L
  for (f in filas_estudio) {
    if (!is.list(f)) next
    etiqueta <- .cm_aulas_scalar(f$estrato, "")
    if (!nzchar(etiqueta)) next
    k <- .cm_aulas_scalar(.cm_criterios_fac_key(etiqueta), "")
    cuota <- suppressWarnings(as.numeric(.cm_aulas_scalar(f$cuota, NA)))
    elegibles <- eleg_por_fac[[k]] %||% NA_real_
    aulas <- aulas_por_fac[[k]] %||% 0L
    esperadas <- if (is.finite(elegibles) && is.finite(tasa)) elegibles * tasa else NA_real_
    margen <- if (is.finite(esperadas) && is.finite(cuota) && cuota > 0) esperadas / cuota else NA_real_
    estado <- if (!is.finite(cuota) || cuota <= 0) {
      "sin_cuota"
    } else if (!is.finite(elegibles) || aulas <= 0L) {
      "sin_titulares"
    } else if (!is.finite(tasa)) {
      "sin_tasa"
    } else if (esperadas >= cuota) {
      "certificada"
    } else {
      "no_cubre"
    }
    if (estado %in% c("certificada", "no_cubre")) {
      evaluables <- evaluables + 1L
      if (estado == "certificada") certificadas <- certificadas + 1L
    }
    aviso <- switch(estado,
      certificada = sprintf(
        "Sus %d titulares cargan %s elegibles; con la tasa esperada de %s %% rinden %s efectivas para una cuota de %s.",
        aulas, fmt1(elegibles), fmt1(tasa * 100), fmt1(esperadas), fmt1(cuota)
      ),
      no_cubre = sprintf(
        "NO CUBRE: sus %d titulares cargan %s elegibles y con la tasa esperada de %s %% rinden %s efectivas, por debajo de la cuota de %s. Faltan %s.",
        aulas, fmt1(elegibles), fmt1(tasa * 100), fmt1(esperadas), fmt1(cuota), fmt1(cuota - esperadas)
      ),
      sin_titulares = "El sorteo vigente no le asignó titulares: no hay con qué certificar.",
      sin_tasa = "El diseño no declara la tasa de asistencia esperada: los elegibles están medidos pero la certificación no se puede afirmar.",
      sin_cuota = "El diseño no le trazó cuota: no hay meta que certificar."
    )
    # Cuotas de hombre y mujer (Gonzalo: «aulas que nos garanticen llegar a
    # ese número de cuotas de hombre y mujer por sexo»). El estado por sexo
    # es informativo por celda; no tumba la certificación de la facultad —
    # la composición de un aula mixta no se controla en el sorteo, y un
    # roll-up estricto marcaría en rojo selecciones operativamente sanas.
    sexo_filas <- list()
    cuotas_sx <- cuotas_sexo[[k]]
    if (is.list(cuotas_sx) && length(cuotas_sx) && estado %in% c("certificada", "no_cubre")) {
      eleg_sx <- .cm_certificacion_elegibles_sexo(titulares, titulares_fk, k)
      for (sx in c("F", "M")) {
        cuota_sx <- suppressWarnings(as.numeric(cuotas_sx[[sx]] %||% NA))
        if (!is.finite(cuota_sx) || cuota_sx <= 0) next
        el_sx <- eleg_sx[[sx]]
        esp_sx <- if (is.finite(tasa)) el_sx * tasa else NA_real_
        sexo_filas[[length(sexo_filas) + 1L]] <- list(
          sexo = sx,
          cuota = round(cuota_sx),
          elegibles = round(el_sx),
          esperadas = if (is.finite(esp_sx)) round(esp_sx) else NA_real_,
          margen = if (is.finite(esp_sx) && cuota_sx > 0) round(esp_sx / cuota_sx, 2) else NA_real_,
          cubre = if (is.finite(esp_sx)) esp_sx >= cuota_sx else NA
        )
      }
    }
    filas[[length(filas) + 1L]] <- list(
      faculty_key = k,
      facultad = etiqueta,
      cuota = if (is.finite(cuota)) round(cuota) else NA_real_,
      aulas_titulares = as.integer(aulas),
      elegibles_titulares = if (is.finite(elegibles)) round(elegibles) else NA_real_,
      efectivas_esperadas = if (is.finite(esperadas)) round(esperadas) else NA_real_,
      margen = if (is.finite(margen)) round(margen, 2) else NA_real_,
      estado = estado,
      aviso = aviso,
      sexo = sexo_filas
    )
  }
  if (!length(filas)) return(selection)

  selection$certificacion_facultad <- list(
    schema = "calc_muestra_aulas_certificacion_facultad_v1",
    owner = "calc_muestra_aulas_selection.certificacion",
    momento = "derivado_al_servir",
    grain = "facultad",
    tasa_esperada = if (is.finite(tasa)) round(tasa, 4) else NA_real_,
    certificadas = certificadas,
    evaluables = evaluables,
    total = length(filas),
    ok = evaluables > 0L && certificadas == evaluables,
    filas = filas
  )
  selection
}
