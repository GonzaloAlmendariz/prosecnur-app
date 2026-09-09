# carga_aulas_libro_avance_aplicadores.R — la tabla «PRODUCCIÓN POR APLICADOR».
#
# Dictado de Gonzalo (2026-09-08): «Facultad, Aplicador, Aulas aplicadas, Fichas
# en la base, Fichas faltantes, Tasa de rendimiento esperada en facultad, Tasa
# de rendimiento obtenido, Aplicaciones regulares, Aplicaciones especial mañana,
# Aplicaciones especial noche».
#
# **La tabla cambia de sujeto: pasa de ser una fila por persona a una fila por
# PERSONA EN UNA FACULTAD.** No es un detalle de presentación. La columna que él
# pone primera es «Facultad», y las dos de tasa son «esperada en facultad» y
# «obtenida»: comparar la producción de alguien con la tasa esperada exige saber
# de qué facultad se está hablando, porque cada una tiene la suya. Un aplicador
# que cubre dos facultades sale en dos filas, cada una contra su propia vara.
#
# QUÉ ES «FICHAS FALTANTES», Y SOBRE QUÉ AULAS SE MIDE
#
# Es lo que sus aulas YA APLICADAS rindieron por debajo de lo que se esperaba de
# ellas: `Σ max(0, esperadas del aula − obtenidas)`. Sobre las que todavía no ha
# aplicado no falta ninguna ficha, falta ir — y eso ya lo dice la diferencia
# entre sus aulas aplicadas y las que tiene asignadas. Nunca negativo: pasarse
# en un aula no compensa quedarse corto en otra, que es la misma regla del
# ADR 0079 aplicada al aula.
#
# Los tres rangos de aplicación —regular, especial mañana, especial noche— salen
# de `.calg_rango_de_aplicacion()`, la misma función que escribe la columna
# «RANGO DE APLICACIÓN» de la Base de control. Sin ella habría dos definiciones
# de «especial noche» y sólo una saldría publicada.

#' Producción por aplicador y facultad.
#'
#' @param unidades filas del plan que entran al libro.
#' @param efectivas vector con nombre por código operativo (PLATAFORMA).
#' @param partes partes de campo; sustituyen al reparto cuando no lo hay.
#' @param asignados `codigo -> aplicador` del reparto vigente.
#' @return `data.frame` con las columnas de `AULAS_AVANCE_CABECERAS$aplicador`,
#'   o `NULL` cuando no hay a quién atribuir ni un aula.
#' @keywords internal
.calaa_produccion_por_aplicador <- function(unidades, efectivas = NULL,
                                            partes = list(), asignados = NULL) {
  unidades <- unidades %||% list()
  if (!length(unidades)) return(NULL)

  cod <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  fac <- vapply(unidades, function(u) .cai_txt(u$faculty), character(1))
  eleg <- vapply(unidades, function(u) .cai_num(u$eligible_n), numeric(1))
  esperadas <- vapply(unidades, function(u) .cai_num(u$expected_valid), numeric(1))
  rango <- vapply(unidades, function(u) .calg_rango_de_aplicacion(u$scheduled_time), character(1))
  apl <- monitoreo_aulas_aula_aplicada(unidades, partes = partes, efectivas = efectivas)
  ef_fila <- vapply(cod, function(k) {
    if (is.null(efectivas)) return(NA_real_)
    i <- match(k, names(efectivas))
    if (is.na(i)) 0 else suppressWarnings(as.numeric(efectivas[[i]]))
  }, numeric(1))

  # **Quién responde por cada curso-horario**: manda el REPARTO, y si el estudio
  # no lo tiene manda el parte, que también dice quién aplicó. La atribución por
  # reparto es la que permite que alguien aparezca en la tabla en cuanto sale a
  # su primera aula, sin esperar a que rinda el parte —que en la primera semana
  # llega tarde o no llega—.
  quien <- rep("", length(unidades))
  asignados <- asignados %||% list()
  for (i in seq_along(unidades)) {
    k <- cod[[i]]
    if (nzchar(k) && !is.null(asignados[[k]])) quien[[i]] <- .cai_txt(asignados[[k]])
  }
  if (!any(nzchar(quien))) {
    del_parte <- list()
    for (pt in (partes %||% list())) {
      if (!is.list(pt)) next
      k <- .cai_txt(pt$operational_code %||% pt$classroom_id)
      persona <- .cai_txt(pt$applied_by %||% pt$applicator)
      if (nzchar(k) && nzchar(persona) && is.null(del_parte[[k]])) del_parte[[k]] <- persona
    }
    for (i in seq_along(unidades)) {
      k <- cod[[i]]
      if (nzchar(k) && !is.null(del_parte[[k]])) quien[[i]] <- del_parte[[k]]
    }
  }
  # El nombre se escribe como se escribe un nombre, nunca crudo de la hoja de
  # disponibilidad (`aulas_nombre_aplicador`, con su detector de regresión).
  quien <- vapply(quien, aulas_nombre_aplicador, character(1), USE.NAMES = FALSE)

  vivas <- nzchar(quien) & nzchar(fac)
  if (!any(vivas)) return(NULL)

  pares <- unique(data.frame(Facultad = fac[vivas], Aplicador = quien[vivas],
                             stringsAsFactors = FALSE))
  filas <- lapply(seq_len(nrow(pares)), function(p) {
    f <- pares$Facultad[[p]]
    a <- pares$Aplicador[[p]]
    idx <- fac == f & quien == a
    aplicadas <- idx & apl
    eleg_apl <- sum(eleg[aplicadas & is.finite(eleg)], na.rm = TRUE)
    # **Sin una sola aula aplicada, las tres cifras de fichas CALLAN.** Un «0
    # fichas en la base, 0 faltantes» se lee como que fue y no sacó nada, y lo
    # que pasa es que todavía no le ha tocado ir: eso ya lo dicen las dos
    # columnas de aulas que tiene al lado. Es la misma regla que «Rendimiento
    # por facultad» aplica a sus esperadas.
    fue <- any(aplicadas)
    en_base <- if (is.null(efectivas) || !fue) NA_real_ else sum(ef_fila[aplicadas], na.rm = TRUE)
    # Lo que le falta a cada aula suya para su propia meta, sumado y sin
    # compensar entre aulas.
    faltantes <- if (is.null(efectivas) || !fue) NA_real_ else {
      brecha <- pmax(0, esperadas[aplicadas] - ef_fila[aplicadas])
      brecha <- brecha[is.finite(brecha)]
      if (length(brecha)) ceiling(sum(brecha)) else 0
    }
    # **La vara es LA DE LA FACULTAD, no la media de las aulas de esta persona.**
    # La columna promete «esperada en facultad» y la primera versión daba 69 %
    # a una persona y 55 % a la de al lado dentro de la misma facultad: se vio
    # publicado. Se calcula sobre TODAS las aulas de la facultad, con la misma
    # función que la tabla de rendimiento.
    esperada <- .calar_tasa_esperada(esperadas[fac == f], eleg[fac == f])
    cuenta_rango <- function(etiqueta) sum(aplicadas & rango == etiqueta)
    # Lo que el diseño esperaba de las aulas que YA aplicó: el mismo universo
    # que «Fichas en la base» y que «Fichas faltantes», para que las tres se
    # lean en la misma línea sin cambiar de denominador a mitad de fila.
    esperadas_apl <- {
      v <- esperadas[aplicadas]
      v <- v[is.finite(v)]
      if (length(v)) round(sum(v)) else NA_real_
    }
    obtenida <- if (is.finite(en_base) && eleg_apl > 0) en_base / eleg_apl else NA_real_
    # La brecha en puntos, del mismo signo que en sus tablas hermanas: positiva
    # cuando rinde por encima de lo que su facultad espera. Calla —no da cero—
    # mientras no haya una tasa obtenida que comparar: un cero diría «va justo».
    diferencia <- if (is.finite(obtenida) && is.finite(esperada)) obtenida - esperada else NA_real_
    out <- data.frame(
      f, a,
      sum(idx),
      sum(aplicadas),
      esperadas_apl,
      en_base,
      faltantes,
      esperada,
      obtenida,
      diferencia,
      cuenta_rango("Regular"),
      cuenta_rango("Especial mañana"),
      cuenta_rango("Especial noche"),
      stringsAsFactors = FALSE
    )
    if (length(out) != length(AULAS_AVANCE_CABECERAS$aplicador)) {
      # La misma guarda que su hermana: el contrato es el vocabulario, no esta
      # lista literal. Sin ella, añadir una columna aquí y olvidarla allá
      # renombra en silencio y la hoja sale con una cabecera sobre otra cifra.
      stop(sprintf(
        ".calaa_produccion_por_aplicador(): %d columnas contra %d en AULAS_AVANCE_CABECERAS$aplicador.",
        length(out), length(AULAS_AVANCE_CABECERAS$aplicador)))
    }
    names(out) <- AULAS_AVANCE_CABECERAS$aplicador
    out
  })
  out <- do.call(rbind, filas)
  # Por facultad y, dentro, por lo que falta: en cada facultad abre quien más
  # fichas dejó sin recoger. Es a quién empujar, que es para lo que existe.
  out[order(out$Facultad,
            -ifelse(is.finite(out$`Fichas faltantes`), out$`Fichas faltantes`, -1),
            out$Aplicador), , drop = FALSE]
}
