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
  if (nrow(titulares) && "faculty" %in% names(titulares)) {
    fk <- .cm_criterios_fac_key(as.character(titulares$faculty))
    el <- suppressWarnings(as.numeric(titulares$eligible_n))
    el[!is.finite(el)] <- 0
    for (i in seq_along(fk)) {
      k <- fk[[i]]
      if (!nzchar(k)) next
      eleg_por_fac[[k]] <- (eleg_por_fac[[k]] %||% 0) + el[[i]]
      aulas_por_fac[[k]] <- (aulas_por_fac[[k]] %||% 0L) + 1L
    }
  }

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
    filas[[length(filas) + 1L]] <- list(
      faculty_key = k,
      facultad = etiqueta,
      cuota = if (is.finite(cuota)) round(cuota) else NA_real_,
      aulas_titulares = as.integer(aulas),
      elegibles_titulares = if (is.finite(elegibles)) round(elegibles) else NA_real_,
      efectivas_esperadas = if (is.finite(esperadas)) round(esperadas) else NA_real_,
      margen = if (is.finite(margen)) round(margen, 2) else NA_real_,
      estado = estado,
      aviso = aviso
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
