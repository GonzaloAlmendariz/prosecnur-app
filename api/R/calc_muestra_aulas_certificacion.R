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

# El escenario que RIGE, y su componente.
#
# El workspace marca cual manda con `activo = TRUE` y lo enlaza a su componente
# por `component_id`. Antes ambos selectores de aqui usaban «el primero que
# publica margen» como proxy, y en HSVG2026 acertaban por ORDEN, no por regla:
# el estudio tiene dos componentes con margen —`cmp-cine0qk8` con n_objetivo
# 2 500 y `cmp-cine0qk8-fac` con 4 050— y el activo resulta ser el primero.
# Activar «facultades» habria dejado a monitoreo publicando 2 500 contra un
# diseno de 4 050 sin que nada fallara: un 62 % de diferencia en la meta.
#
# La regla vive AQUI y solo aqui; `.maoe_escenario_activo()` la lee de esta
# funcion en vez de reimplementarla, porque dos capas leyendo «cual es el
# activo» a su manera es como se separan en silencio.
.cm_estudio_escenario_activo <- function(estudio) {
  if (!is.list(estudio)) return(NULL)
  escenarios <- estudio$workspace$escenarios %||% list()
  if (!is.list(escenarios)) return(NULL)
  for (esc in escenarios) {
    if (is.list(esc) && isTRUE(esc$activo)) return(esc)
  }
  NULL
}

# El componente del escenario activo, o NULL si no hay escenario activo, no
# declara `component_id`, o el id no existe entre los componentes. NULL significa
# «no hay declaracion», y cada llamador decide su respaldo: no se adivina aqui.
.cm_estudio_componente_activo <- function(estudio) {
  esc <- .cm_estudio_escenario_activo(estudio)
  if (!is.list(esc)) return(NULL)
  id <- trimws(as.character(esc$component_id %||% ""))
  if (!nzchar(id)) return(NULL)
  for (cmp in (estudio$componentes %||% list())) {
    if (is.list(cmp) && identical(trimws(as.character(cmp$id %||% "")), id)) return(cmp)
  }
  NULL
}

.cm_certificacion_componente_facultad <- function(estudio) {
  if (!is.list(estudio)) return(NULL)
  componentes <- estudio$componentes
  if (!is.list(componentes)) return(NULL)
  con_filas <- Filter(function(c) {
    is.list(c) && is.list(c$resultado) && length(c$resultado$aulas_por_estrato)
  }, componentes)
  if (!length(con_filas)) return(NULL)
  # Manda el componente del escenario ACTIVO. Solo si el estudio no lo declara
  # se cae al proxy historico —el primero que publica margen, igual que
  # filasParaFichas en la UI—, que es lo correcto para estudios de un unico
  # escenario y para los guardados antes de que el workspace marcara el activo.
  activo <- .cm_estudio_componente_activo(estudio)
  if (is.list(activo) && length(activo$resultado$aulas_por_estrato)) {
    return(activo$resultado$aulas_por_estrato)
  }
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
  # Misma regla que arriba: el activo manda. Este selector iba por su cuenta
  # («el primero con distribucion_sub»), asi que las cuotas por sexo podian
  # salir de un escenario distinto al de las cuotas por facultad sin que nada
  # lo delatara.
  sub <- NULL
  activo <- .cm_estudio_componente_activo(estudio)
  if (is.list(activo) && length(activo$resultado$distribucion_sub)) {
    sub <- activo$resultado$distribucion_sub
  }
  for (comp in if (is.null(sub)) componentes else list()) {
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
    # Comparar contra los literales "F"/"M" descartaba en silencio un padron
    # etiquetado ("Mujer"), y la facultad salia con cero elegibles de ese sexo.
    sexo <- .pulso_sexo_fm(filas[[lado]])
    n <- suppressWarnings(as.numeric(filas[[col_n]]))
    n[!is.finite(n)] <- 0
    # Un lado vacío («sex_top_2» sin segundo sexo) da NA en `sexo`: sin excluirlo, `n[NA]` volvía NA toda la suma y
    # la celda de sexo salía sin esperadas.
    for (sx in c("F", "M")) acc[[sx]] <- acc[[sx]] + sum(n[!is.na(sexo) & sexo == sx])
  }
  acc
}

# Esperadas por sexo SUMANDO AULA POR AULA, no aplanando la tasa.
#
# La rama de facultad ya suma `efectivas_esperadas` (metodo `suma_esperadas`),
# pero las celdas de sexo aplanaban esa misma tasa: tomaban `esperadas/elegibles`
# de la facultad y la multiplicaban por los elegibles del sexo. Eso BORRA la
# covarianza entre el tamano del aula y su composicion por sexo, que existe y
# cambia de signo entre facultades — medido sobre el marco de HSVG2026:
# Educacion -0,721, Arquitectura +0,377, Artes Escenicas -0,321.
#
# La tasa del aula sale de `tasa_efectividad_aula` y, si no viaja, se deriva de
# `efectivas_esperadas / eligible_n`, que es la misma cifra por otra via. Sin
# ninguna de las dos la fila queda NA y el llamador cae a la tasa plana
# declarandolo, igual que hace la rama de facultad.
.cm_certificacion_esperadas_sexo <- function(titulares, fac_keys, k) {
  acc <- c(F = NA_real_, M = NA_real_)
  filas <- titulares[fac_keys == k, , drop = FALSE]
  if (!nrow(filas)) return(acc)
  tasa <- suppressWarnings(as.numeric(filas$tasa_efectividad_aula %||% rep(NA_real_, nrow(filas))))
  if (!all(is.finite(tasa))) {
    esp <- suppressWarnings(as.numeric(filas$efectivas_esperadas %||% rep(NA_real_, nrow(filas))))
    el <- suppressWarnings(as.numeric(filas$eligible_n %||% rep(NA_real_, nrow(filas))))
    derivada <- ifelse(is.finite(esp) & is.finite(el) & el > 0, esp / el, NA_real_)
    tasa[!is.finite(tasa)] <- derivada[!is.finite(tasa)]
  }
  # Parcial no sirve: mezclar aulas con tasa y aulas sin ella daria una suma que
  # no es ni una vara ni la otra.
  if (!all(is.finite(tasa))) return(acc)
  acc[] <- 0
  for (lado in c("sex_top_1", "sex_top_2")) {
    col_n <- paste0(lado, "_n")
    if (!lado %in% names(filas) || !col_n %in% names(filas)) next
    # Mismo lector que los elegibles: «Mujer»/«Hombre» cuentan, y un lado vacío no vuelve NA la suma.
    sexo <- .pulso_sexo_fm(filas[[lado]])
    n <- suppressWarnings(as.numeric(filas[[col_n]]))
    n[!is.finite(n)] <- 0
    for (sx in c("F", "M")) {
      sel <- !is.na(sexo) & sexo == sx
      acc[[sx]] <- acc[[sx]] + sum(n[sel] * tasa[sel])
    }
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
  esp_por_fac <- list()
  esp_aulas_fac <- list()
  titulares_fk <- character(0)
  if (nrow(titulares) && "faculty" %in% names(titulares)) {
    titulares_fk <- .cm_criterios_fac_key(as.character(titulares$faculty))
    el <- suppressWarnings(as.numeric(titulares$eligible_n))
    el[!is.finite(el)] <- 0
    # Plan 1b/E4: el metodo canonico suma las EFECTIVAS ESPERADAS por aula
    # (elegibles x tasa de efectividad del aula, V7). La tasa plana queda como
    # fallback DECLARADO para payloads sin la columna.
    ee <- suppressWarnings(as.numeric(titulares$efectivas_esperadas %||% rep(NA_real_, nrow(titulares))))
    for (i in seq_along(titulares_fk)) {
      k <- titulares_fk[[i]]
      if (!nzchar(k)) next
      eleg_por_fac[[k]] <- (eleg_por_fac[[k]] %||% 0) + el[[i]]
      aulas_por_fac[[k]] <- (aulas_por_fac[[k]] %||% 0L) + 1L
      if (is.finite(ee[[i]])) {
        esp_por_fac[[k]] <- (esp_por_fac[[k]] %||% 0) + ee[[i]]
        esp_aulas_fac[[k]] <- (esp_aulas_fac[[k]] %||% 0L) + 1L
      }
    }
  }
  cuotas_sexo <- .cm_certificacion_cuotas_sexo(estudio)

  # La tasa que certifica es la τ DEL PROPIO DISEÑO (cada estrato la lleva en
  # aulas_por_estrato$tau): certificar con la tasa observada de 2025 (0,7038)
  # cuando el diseño asumió 0,53 seria sellar con un supuesto mas optimista
  # que el que dimensiono las aulas. La referencia 2025 queda como fallback
  # para estudios sin τ declarada, y la fuente viaja en el payload.
  tasa_referencia <- .cm_certificacion_tasa(referencia_asistencia)
  taus_disenio <- vapply(filas_estudio, function(f) {
    if (!is.list(f)) return(NA_real_)
    t <- suppressWarnings(as.numeric(.cm_aulas_scalar(f$tau, NA)))
    if (length(t) == 1L && is.finite(t) && t > 0 && t <= 1) t else NA_real_
  }, numeric(1))
  usa_tau_disenio <- any(is.finite(taus_disenio))
  tasa_fuente <- if (usa_tau_disenio) "tau_disenio" else if (is.finite(tasa_referencia)) "referencia" else "sin_tasa"
  fmt1 <- function(x) format(round(x, 1), trim = TRUE, scientific = FALSE, big.mark = " ")
  # **Las encuestas son personas: el aviso que lee un humano no lleva decimales,
  # y la direccion del redondeo no es la misma en los dos numeros del aviso.**
  #
  #   · lo que PROMETEMOS (las efectivas esperadas) va hacia ABAJO: prometer
  #     media persona de mas es lo contrario de dimensionar con prudencia;
  #   · lo que PEDIMOS (las que faltan) va hacia ARRIBA: si faltan 2,6 encuestas
  #     faltan 3 personas, y con 2 la facultad sigue corta.
  #
  # Solo cambia lo PUBLICADO. `esperadas` sigue crudo para el margen y para el
  # estado: redondear antes de comparar convertiria una facultad de 99,6 sobre
  # una cuota de 100 en certificada.
  #
  # Las tasas y porcentajes NO pasan por aqui: ahi el decimal es la informacion.
  fmt_prometido <- function(x) format(floor(x), trim = TRUE, scientific = FALSE, big.mark = " ")
  fmt_pedido <- function(x) format(ceiling(x), trim = TRUE, scientific = FALSE, big.mark = " ")
  filas <- list()
  certificadas <- 0L
  evaluables <- 0L
  for (fi in seq_along(filas_estudio)) {
    f <- filas_estudio[[fi]]
    if (!is.list(f)) next
    tasa <- if (is.finite(taus_disenio[[fi]])) taus_disenio[[fi]] else tasa_referencia
    etiqueta <- .cm_aulas_scalar(f$estrato, "")
    if (!nzchar(etiqueta)) next
    k <- .cm_aulas_scalar(.cm_criterios_fac_key(etiqueta), "")
    cuota <- suppressWarnings(as.numeric(.cm_aulas_scalar(f$cuota, NA)))
    elegibles <- eleg_por_fac[[k]] %||% NA_real_
    aulas <- aulas_por_fac[[k]] %||% 0L
    # Suma por aula solo si TODAS las titulares de la facultad traen esperado
    # (parcial mezclaria varas); si no, tasa plana declarada.
    suma_ok <- (esp_aulas_fac[[k]] %||% 0L) == aulas && aulas > 0L
    metodo_fila <- if (suma_ok) "suma_esperadas" else "tasa_plana"
    esperadas <- if (suma_ok) {
      esp_por_fac[[k]]
    } else if (is.finite(elegibles) && is.finite(tasa)) {
      elegibles * tasa
    } else {
      NA_real_
    }
    if (suma_ok && is.finite(elegibles) && elegibles > 0) {
      # La tasa de la fila pasa a ser la EFECTIVA de sus aulas (derivada).
      tasa <- esperadas / elegibles
    }
    margen <- if (is.finite(esperadas) && is.finite(cuota) && cuota > 0) esperadas / cuota else NA_real_
    estado <- if (!is.finite(cuota) || cuota <= 0) {
      "sin_cuota"
    } else if (!is.finite(elegibles) || aulas <= 0L) {
      "sin_titulares"
    } else if (!suma_ok && !is.finite(tasa)) {
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
      certificada = if (identical(metodo_fila, "suma_esperadas")) sprintf(
        "Sus %d titulares suman %s efectivas esperadas (aula por aula, seg\u00fan el tama\u00f1o y la facultad de cada una) para una cuota de %s.",
        aulas, fmt_prometido(esperadas), fmt1(cuota)
      ) else sprintf(
        "Sus %d titulares cargan %s elegibles; con la tasa de rendimiento %s de %s %% rinden %s efectivas para una cuota de %s.",
        aulas, fmt1(elegibles),
        if (identical(tasa_fuente, "tau_disenio")) "del dise\u00f1o (\u03c4)" else "esperada",
        fmt1(tasa * 100), fmt_prometido(esperadas), fmt1(cuota)
      ),
      no_cubre = if (identical(metodo_fila, "suma_esperadas")) sprintf(
        "NO CUBRE: sus %d titulares suman %s efectivas esperadas (aula por aula) frente a una cuota de %s. Faltan %s.",
        aulas, fmt_prometido(esperadas), fmt1(cuota), fmt_pedido(cuota - esperadas)
      ) else sprintf(
        "NO CUBRE: sus %d titulares cargan %s elegibles y con la tasa de rendimiento %s de %s %% rinden %s efectivas, por debajo de la cuota de %s. Faltan %s.",
        aulas, fmt1(elegibles),
        if (identical(tasa_fuente, "tau_disenio")) "del dise\u00f1o (\u03c4)" else "esperada",
        fmt1(tasa * 100), fmt_prometido(esperadas), fmt1(cuota), fmt_pedido(cuota - esperadas)
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
      # Aula por aula cuando se puede; la tasa plana queda de fallback DECLARADO,
      # igual que en la rama de facultad.
      esp_por_aula <- .cm_certificacion_esperadas_sexo(titulares, titulares_fk, k)
      metodo_sexo <- if (all(is.finite(esp_por_aula))) "suma_esperadas" else "tasa_plana"
      for (sx in c("F", "M")) {
        cuota_sx <- suppressWarnings(as.numeric(cuotas_sx[[sx]] %||% NA))
        if (!is.finite(cuota_sx) || cuota_sx <= 0) next
        el_sx <- eleg_sx[[sx]]
        esp_sx <- if (identical(metodo_sexo, "suma_esperadas")) {
          esp_por_aula[[sx]]
        } else if (is.finite(tasa)) {
          el_sx * tasa
        } else {
          NA_real_
        }
        sexo_filas[[length(sexo_filas) + 1L]] <- list(
          sexo = sx,
          metodo = metodo_sexo,
          cuota = round(cuota_sx),
          elegibles = round(el_sx),
          # Promesa por celda: hacia ABAJO, igual que el aviso de la facultad.
          # `cubre` y `margen` siguen saliendo del valor CRUDO, dos lineas mas
          # abajo: el entero es para leer, no para decidir.
          esperadas = if (is.finite(esp_sx)) floor(esp_sx) else NA_real_,
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
      tasa = if (is.finite(tasa)) round(tasa, 4) else NA_real_,
      metodo = metodo_fila,
      sexo = sexo_filas
    )
  }
  if (!length(filas)) return(selection)

  selection$certificacion_facultad <- list(
    schema = "calc_muestra_aulas_certificacion_facultad_v1",
    owner = "calc_muestra_aulas_selection.certificacion",
    momento = "derivado_al_servir",
    grain = "facultad",
    tasa_esperada = {
      usadas <- unique(round(vapply(filas, function(x) x$tasa %||% NA_real_, numeric(1)), 4))
      usadas <- usadas[is.finite(usadas)]
      if (length(usadas) == 1L) usadas else NA_real_
    },
    tasa_fuente = tasa_fuente,
    certificadas = certificadas,
    evaluables = evaluables,
    total = length(filas),
    ok = evaluables > 0L && certificadas == evaluables,
    filas = filas
  )
  selection
}
