# Marco elegible, cobertura, margen y plan de campo del reporte decisional (U16).
#
# El informe de diseño muestral publica lo que el motor ya sabe tras U11-U17:
# la cobertura del marco elegible por distrito y su decisión registrada (ADR 0115
# §4), la procedencia del DEFF y el rótulo del margen (ADR 0116 §3), la no
# respuesta, las visitas por ruta y el plan de campo (ADR 0116 §1, U14).
#
# Dos piezas:
# - `.reporte_mt_insumos_sesion()` corre en el router (proceso principal): toma de
#   la sesión la bitácora, el estado de la decisión y el plan ya calculados, y la
#   cartografía para el perfil NSE. El worker callr no lee la sesión.
# - `reporte_mt_secciones_modelo()` corre en el worker: arma data.frames y frases
#   ya redactadas. La plantilla Quarto sólo los pinta.
#
# Audiencia cliente: sin códigos de aviso, sin ids de bitácora, sin atribuciones.

.REPORTE_MT_MOTIVOS <- c(
  inseguridad = "Inseguridad",
  no_residencial = "Uso no residencial",
  inaccesible = "Inaccesible",
  otro = "Otro"
)

.REPORTE_MT_MESES <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                       "agosto", "septiembre", "octubre", "noviembre", "diciembre")

.reporte_mt_num <- function(x, defecto = 0) {
  v <- suppressWarnings(as.numeric(if (is.null(x) || !length(x)) NA else x[[1]]))
  if (is.na(v)) defecto else v
}

.reporte_mt_int <- function(x) formatC(round(.reporte_mt_num(x)), format = "d", big.mark = ",")

.reporte_mt_pct <- function(x, dec = 1L) {
  if (is.null(x) || !length(x) || is.na(x)) return("-")
  sprintf(paste0("%.", dec, "f %%"), 100 * x)
}

.reporte_mt_dec <- function(x, dec = 2L) {
  formatC(.reporte_mt_num(x), format = "f", digits = dec)
}

.reporte_mt_fecha <- function(x, corta = FALSE) {
  t <- as.character(x %||% "")[1]
  d <- suppressWarnings(as.Date(substr(t, 1L, 10L)))
  if (is.na(d)) return("fecha no registrada")
  if (corta) return(format(d, "%d/%m/%Y"))
  sprintf("%d de %s de %s", as.integer(format(d, "%d")), .REPORTE_MT_MESES[as.integer(format(d, "%m"))], format(d, "%Y"))
}

.reporte_mt_nombre_distrito <- function(ubigeo, distrito = "", territorios = list()) {
  if (nzchar(distrito %||% "")) return(distrito)
  for (t in territorios) if (identical(as.character(t$ubigeo %||% ""), ubigeo)) {
    n <- as.character(t$distrito %||% t$nombre %||% "")
    if (nzchar(n)) return(n)
  }
  ubigeo
}

# ---------- Insumos de la sesión (router) ----------

#' Insumos del reporte que viven en la sesión, calculados en el proceso principal.
#'
#' Devuelve `marco` (lo de `sample$marco_elegible` que el informe usa, sin
#' polígonos), `decision_cobertura` (estado para el marco del run activo), las
#' entradas `decision_cobertura` de la bitácora, `plan_campo` (sólo si hay
#' supuestos guardados en `ui_state$plan_campo` y muestra sorteada) y
#' `nse_por_distrito` (población por NSE de lo elegible y lo excluido). Lo que
#' no se puede calcular queda NULL y el informe lo dice.
.reporte_mt_insumos_sesion <- function(sid, active, cfg, sample) {
  me_muestra <- sample$marco_elegible %||% NULL
  # `completos` (con polígonos) para aplicar el marco aquí; `criterios` (sin
  # polígonos) es lo que viaja al worker y al informe.
  completos <- if (is.list(me_muestra$criterios)) hojas_ruta_marco_elegible_normalizar(me_muestra$criterios) else NULL
  criterios <- completos
  if (!is.null(criterios)) {
    attr(criterios, "alertas") <- NULL
    criterios$areas_excluidas <- lapply(criterios$areas_excluidas %||% list(), function(a) { a$poligono <- NULL; a })
  }
  marco <- if (is.null(me_muestra)) NULL else list(
    criterios = criterios,
    por_distrito = me_muestra$por_distrito %||% list(),
    por_area = me_muestra$por_area %||% list()
  )
  bitacora <- Filter(function(e) is.list(e) && identical(e$accion, "decision_cobertura"),
                     session_get(sid)$hojas_ruta_bitacora %||% list())
  # Un fallo al calcular la decisión NO es «sin decisión»: se marca para que el
  # informe diga que no pudo verificarse, y la causa va a stderr.
  decision_fallo <- FALSE
  decision <- tryCatch(.hojas_ruta_decision_cobertura_sesion(sid), error = function(e) {
    message("[reporte-decisional] no se pudo calcular la decisión de cobertura: ", conditionMessage(e))
    decision_fallo <<- TRUE
    NULL
  })

  bloques <- sample$blocks %||% list()
  ubigeos <- unique(as.character(unlist(cfg$territorios %||% list(), use.names = FALSE)))
  necesita_nse <- isTRUE(criterios$declarado) && any(vapply(marco$por_distrito %||% list(), function(f) {
    .reporte_mt_num(f$excluida_area$poblacion) + .reporte_mt_num(f$excluida_minimo$poblacion) > 0
  }, logical(1)))
  supuestos <- active$run$ui_state$plan_campo
  necesita_plan <- is.list(supuestos) && length(supuestos) > 0L && length(bloques) > 0L
  puntos <- NULL
  if (necesita_nse || necesita_plan) {
    puntos <- tryCatch(do.call(rbind, c(
      list(data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))),
      lapply(unique(c(ubigeos, as.character(.hojas_ruta_rows_df(bloques)$ubigeo))), hojas_ruta_marco_elegible_puntos)
    )), error = function(e) NULL)
  }
  nse <- NULL
  nse_fallo <- necesita_nse && is.null(puntos)
  if (necesita_nse && !is.null(puntos)) {
    nse <- tryCatch({
      territorio <- hojas_ruta_inei_frame(cfg$frame_source)
      territorio <- territorio[territorio$ubigeo %in% ubigeos, , drop = FALSE]
      ap <- hojas_ruta_marco_elegible_aplicar(territorio, completos, puntos = puntos,
                                              excluidas_piloto = cfg$excluded_titular_ids %||% list())
      .hojas_ruta_me_nse_por_distrito(territorio, ap$criterio, puntos)
    }, error = function(e) {
      # Igual que la decisión: un fallo no se presenta como falta de datos.
      message("[reporte-decisional] no se pudo calcular el perfil NSE de lo excluido: ", conditionMessage(e))
      nse_fallo <<- TRUE
      NULL
    })
  }
  plan <- if (necesita_plan) {
    tryCatch(hojas_ruta_plan_campo(bloques, supuestos, puntos = puntos), error = function(e) NULL)
  } else NULL
  list(
    marco = marco,
    decision_cobertura = if (is.null(decision)) NULL else decision[c("exigida", "huella", "vigente")],
    bitacora = bitacora,
    plan_campo = plan,
    nse_por_distrito = nse,
    decision_fallo = decision_fallo,
    nse_fallo = nse_fallo
  )
}

# ---------- Modelo: marco elegible y cobertura ----------

.reporte_mt_frase_marco <- function(criterios, fila, n_areas, varios_distritos) {
  m <- as.integer(criterios$minimo_viviendas %||% 0L)
  base <- if (m > 0L) {
    sprintf("La muestra representa a los hogares de manzanas con al menos %d %s registradas en 2017",
            m, if (m == 1L) "vivienda" else "viviendas")
  } else {
    "La muestra representa a los hogares de todas las manzanas registradas en 2017"
  }
  if (n_areas == 0L) return(paste0(base, "; no se declararon áreas excluidas."))
  total <- .reporte_mt_num(fila$total$poblacion)
  x <- if (total > 0) .reporte_mt_num(fila$excluida_area$poblacion) / total else NA_real_
  if (!is.na(x) && x <= 0) {
    return(sprintf("%s; %s no %s manzanas de este distrito.", base,
                   if (n_areas == 1L) "el área excluida del estudio" else sprintf("las %d áreas excluidas del estudio", n_areas),
                   if (n_areas == 1L) "toca" else "tocan"))
  }
  areas_txt <- sprintf("%d %s%s", n_areas, if (n_areas == 1L) "área" else "áreas",
                       if (varios_distritos) " declaradas para el estudio" else "")
  if (varios_distritos && n_areas == 1L) areas_txt <- "1 área declarada para el estudio"
  sprintf("%s, fuera de las áreas excluidas (%s, %s de la población del distrito).", base, areas_txt, .reporte_mt_pct(x))
}

.reporte_mt_estado_decision <- function(ubigeo, fila, declarado, est, entrada) {
  if (!declarado || is.null(fila)) return("Sorteado sobre todo el marco 2017")
  exige <- ubigeo %in% vapply(est$exigida %||% list(), function(d) as.character(d$ubigeo), character(1))
  if (!exige) return("No requiere decisión (excluye menos del 10 %)")
  if (is.null(entrada)) return("Sin decisión registrada")
  tipo <- as.character(entrada$detalle$decision %||% "")[1]
  tipo_txt <- switch(tipo, redefinir = "redefinir la población objetivo", aceptar = "aceptar la pérdida de cobertura", "tipo no indicado")
  sprintf("Decisión registrada (%s, %s)", .reporte_mt_fecha(entrada$fecha, corta = TRUE), tipo_txt)
}

#' Modelo de la sección «Marco elegible y cobertura».
#'
#' @param insumos Salida de `.reporte_mt_insumos_sesion()` (o equivalente en tests).
#' @param territorios Territorios del reporte, para nombrar distritos sin nombre.
reporte_mt_marco_modelo <- function(insumos = list(), territorios = list()) {
  marco <- insumos$marco %||% NULL
  criterios <- marco$criterios %||% NULL
  declarado <- isTRUE(criterios$declarado)
  filas <- Filter(is.list, marco$por_distrito %||% list())
  ubigeos_terr <- vapply(territorios, function(t) as.character(t$ubigeo %||% ""), character(1))
  ubigeos <- unique(c(vapply(filas, function(f) as.character(f$ubigeo), character(1)), ubigeos_terr[nzchar(ubigeos_terr)]))
  fila_de <- function(u) { for (f in filas) if (identical(as.character(f$ubigeo), u)) return(f); NULL }

  if (!declarado) {
    estado <- if (length(ubigeos)) data.frame(
      Distrito = vapply(ubigeos, function(u) .reporte_mt_nombre_distrito(u, "", territorios), character(1)),
      `Decisión de cobertura` = "Sorteado sobre todo el marco 2017",
      check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
    ) else NULL
    return(list(
      declarado = FALSE,
      frase_general = "La muestra se sorteó sobre todo el marco de manzanas del Censo 2017 de los distritos del estudio, sin criterios de elegibilidad declarados: no se excluyeron manzanas por número de viviendas ni por área.",
      frases_distrito = character(0), cobertura = NULL, estado = estado, areas = NULL, decisiones = NULL,
      nse = NULL, nota_nse = NULL, nota_piloto = NULL
    ))
  }

  est <- insumos$decision_cobertura %||% NULL
  bitacora <- insumos$bitacora %||% list()
  # Sin estado calculado en el router no hay huella con qué validar una decisión:
  # se sabe qué distritos la exigen, no si alguna sigue vigente.
  if (is.null(est)) est <- list(exigida = hojas_ruta_marco_elegible_requiere_decision(filas), vigente = NULL)
  entrada <- NULL
  if (length(est$vigente) == 1L && !is.na(suppressWarnings(as.integer(est$vigente)))) {
    for (e in bitacora) if (identical(as.integer(e$id %||% NA_integer_), as.integer(est$vigente))) entrada <- e
  }
  areas_decl <- criterios$areas_excluidas %||% list()
  n_areas <- length(areas_decl)
  varios <- length(ubigeos) > 1L
  nombre <- function(u) .reporte_mt_nombre_distrito(u, as.character(fila_de(u)$distrito %||% ""), territorios)

  cobertura <- data.frame(
    Distrito = vapply(ubigeos, nombre, character(1)),
    `Población 2017` = vapply(ubigeos, function(u) { f <- fila_de(u); if (is.null(f)) "-" else .reporte_mt_int(f$total$poblacion) }, character(1)),
    `Población elegible` = vapply(ubigeos, function(u) { f <- fila_de(u); if (is.null(f)) "-" else .reporte_mt_int(f$elegible$poblacion) }, character(1)),
    `Excluida por área` = vapply(ubigeos, function(u) {
      f <- fila_de(u); t <- .reporte_mt_num(f$total$poblacion)
      if (is.null(f) || t <= 0) "-" else .reporte_mt_pct(.reporte_mt_num(f$excluida_area$poblacion) / t)
    }, character(1)),
    `Excluida por mínimo` = vapply(ubigeos, function(u) {
      f <- fila_de(u); t <- .reporte_mt_num(f$total$poblacion)
      if (is.null(f) || t <= 0) "-" else .reporte_mt_pct(.reporte_mt_num(f$excluida_minimo$poblacion) / t)
    }, character(1)),
    check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
  )
  estado <- data.frame(
    Distrito = cobertura$Distrito,
    `Decisión de cobertura` = vapply(ubigeos, function(u) {
      ent_u <- if (!is.null(entrada) && u %in% as.character(unlist(entrada$detalle$ubigeos, use.names = FALSE))) entrada else NULL
      .reporte_mt_estado_decision(u, fila_de(u), TRUE, est, ent_u)
    }, character(1)),
    check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
  )
  if (isTRUE(insumos$decision_fallo)) {
    sin <- estado$`Decisión de cobertura` == "Sin decisión registrada"
    estado$`Decisión de cobertura`[sin] <- "No pudo verificarse al generar el informe"
  }

  frases <- vapply(ubigeos, function(u) {
    f <- fila_de(u)
    if (is.null(f)) return(sprintf("%s: sorteado sobre todo el marco 2017.", nombre(u)))
    sprintf("%s. %s", nombre(u), .reporte_mt_frase_marco(criterios, f, n_areas, varios))
  }, character(1), USE.NAMES = FALSE)

  por_area <- marco$por_area %||% list()
  areas <- if (n_areas) {
    data.frame(
      `Área` = vapply(areas_decl, function(a) as.character(a$id %||% ""), character(1)),
      Motivo = vapply(areas_decl, function(a) {
        lab <- unname(.REPORTE_MT_MOTIVOS[as.character(a$motivo %||% "")]) %||% as.character(a$motivo)
        if (is.na(lab)) lab <- as.character(a$motivo)
        det <- as.character(a$detalle %||% "")
        if (nzchar(det)) sprintf("%s: %s", lab, det) else lab
      }, character(1)),
      Evidencia = vapply(areas_decl, function(a) {
        fu <- as.character(a$fuente %||% ""); fe <- as.character(a$fecha_evidencia %||% "")
        partes <- c(if (nzchar(fu)) fu, if (nzchar(fe)) .reporte_mt_fecha(fe))
        if (length(partes)) paste(partes, collapse = ", ") else "-"
      }, character(1)),
      Manzanas = vapply(areas_decl, function(a) {
        p <- Filter(function(x) identical(as.character(x$id), as.character(a$id)), por_area)
        if (length(p)) .reporte_mt_int(p[[1]]$manzanas) else "-"
      }, character(1)),
      `Población excluida` = vapply(areas_decl, function(a) {
        p <- Filter(function(x) identical(as.character(x$id), as.character(a$id)), por_area)
        if (length(p)) .reporte_mt_int(p[[1]]$poblacion) else "-"
      }, character(1)),
      check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
    )
  } else NULL

  decisiones <- if (!is.null(entrada)) {
    tipo <- as.character(entrada$detalle$decision %||% "")[1]
    cubre <- as.character(unlist(entrada$detalle$ubigeos, use.names = FALSE))
    cubre <- intersect(ubigeos, cubre)
    data.frame(
      Distritos = paste(vapply(cubre, nombre, character(1)), collapse = ", "),
      Fecha = .reporte_mt_fecha(entrada$fecha),
      `Decisión` = switch(tipo, redefinir = "Se redefine la población objetivo", aceptar = "Se acepta la pérdida de cobertura", "No indicada"),
      `Justificación` = as.character(entrada$resumen %||% ""),
      check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
    )
  } else NULL

  # Perfil NSE de lo excluido (área + mínimo) frente a lo elegible, en población.
  nse_rows <- list()
  for (n in Filter(is.list, insumos$nse_por_distrito %||% list())) {
    u <- as.character(n$ubigeo)
    exc <- unlist(n$excluida %||% list()); eleg <- unlist(n$elegible %||% list())
    if (!length(exc) || sum(exc, na.rm = TRUE) <= 0) next
    niveles <- sort(unique(c(names(exc), names(eleg))))
    te <- sum(exc, na.rm = TRUE); tl <- sum(eleg, na.rm = TRUE)
    for (nv in niveles) {
      pe <- .reporte_mt_num(exc[nv]); pl <- .reporte_mt_num(eleg[nv])
      if (pe <= 0 && pl <= 0) next
      nse_rows[[length(nse_rows) + 1L]] <- data.frame(
        Distrito = nombre(u),
        `Nivel NSE` = if (identical(nv, "S/D")) "Sin dato" else nv,
        `Población excluida` = .reporte_mt_int(pe),
        `% de lo excluido` = .reporte_mt_pct(pe / te),
        `% de lo elegible` = if (tl > 0) .reporte_mt_pct(pl / tl) else "-",
        check.names = FALSE, stringsAsFactors = FALSE
      )
    }
  }
  hay_exclusion <- any(vapply(filas, function(f) .reporte_mt_num(f$excluida_area$poblacion) + .reporte_mt_num(f$excluida_minimo$poblacion) > 0, logical(1)))
  nse <- if (length(nse_rows)) do.call(rbind, nse_rows) else NULL
  nota_nse <- if (is.null(nse) && hay_exclusion && isTRUE(insumos$nse_fallo)) {
    "El perfil socioeconómico de lo excluido no pudo calcularse al generar este informe."
  } else if (is.null(nse) && hay_exclusion) {
    "El perfil socioeconómico de lo excluido no está disponible para estos distritos."
  } else if (!hay_exclusion) {
    "El marco elegible no excluyó población por área ni por mínimo de viviendas; no hay perfil de lo excluido que comparar."
  } else NULL

  piloto <- sum(vapply(filas, function(f) .reporte_mt_num(f$excluida_piloto$manzanas), numeric(1)))
  nota_piloto <- if (piloto > 0) {
    sprintf("Además, %s %s titulares de la prueba piloto se retiraron del marco para el campo real. No es un criterio del marco elegible y no entra en los porcentajes de exclusión.",
            .reporte_mt_int(piloto), if (piloto == 1) "manzana" else "manzanas")
  } else NULL

  m <- as.integer(criterios$minimo_viviendas %||% 0L)
  list(
    declarado = TRUE,
    frase_general = sprintf(
      "El sorteo se hizo sobre el marco elegible: las manzanas del Censo 2017 de los distritos del estudio %s%s. La cobertura se mide en población 2017 del distrito: los porcentajes de exclusión por área y por mínimo de viviendas comparten ese denominador. Un distrito que pierde el 10 %% o más de su población exige una decisión registrada antes de emitir las hojas de campo: redefinir la población objetivo o aceptar la pérdida con justificación.",
      if (m > 0L) sprintf("con al menos %d %s", m, if (m == 1L) "vivienda registrada" else "viviendas registradas") else "sin mínimo de viviendas",
      if (n_areas) sprintf(", fuera de %d %s", n_areas, if (n_areas == 1L) "área excluida" else "áreas excluidas") else ""
    ),
    frases_distrito = frases,
    cobertura = cobertura,
    estado = estado,
    areas = areas,
    decisiones = decisiones,
    nse = nse,
    nota_nse = nota_nse,
    nota_piloto = nota_piloto
  )
}

# ---------- Modelo: margen, no respuesta y plan de campo ----------

#' Modelo del margen y la procedencia del DEFF (ADR 0116 §3).
reporte_mt_margen_modelo <- function(config, territorios = list()) {
  cfg <- hojas_ruta_integrada_normalize_config(config %||% list())
  ss <- cfg$sample_size %||% list()
  k <- max(1L, as.integer(cfg$entrevistas_por_manzana %||% 1L))
  deff <- .reporte_mt_num(ss$design_effect, 1)
  fuente <- as.character(ss$design_effect_fuente %||% "legado")[1]
  incluye <- hojas_ruta_margen_incluye_conglomerado(ss, k)
  margen <- if (incluye) {
    sprintf("El margen de error se calcula bajo muestreo aleatorio simple (MAS) ajustado por un efecto de diseño (DEFF) de %s.", .reporte_mt_dec(deff))
  } else {
    sprintf("El margen de error se calcula bajo muestreo aleatorio simple (MAS) y no incluye el efecto del conglomerado: con %d entrevistas por ruta, el DEFF aplicado es %s.", k, .reporte_mt_dec(deff))
  }
  icc <- ss$icc_aplicado
  procedencia <- switch(
    fuente,
    icc_biblioteca = if (is.list(icc)) {
      origen <- c(if (nzchar(as.character(icc$fuente %||% ""))) as.character(icc$fuente),
                  if (nzchar(as.character(icc$fecha %||% ""))) .reporte_mt_fecha(icc$fecha),
                  if (!is.null(icc$conglomerados)) sprintf("%s conglomerados", .reporte_mt_int(icc$conglomerados)))
      sprintf("Procedencia del DEFF: se trasladó el coeficiente de correlación intraclase (ICC) de %s medido en «%s»%s, con DEFF = 1 + (k − 1) · ICC y k = %d entrevistas por ruta, lo que da %s.",
              formatC(.reporte_mt_num(icc$icc), format = "f", digits = 3), as.character(icc$id %||% "estudio previo"),
              if (length(origen)) sprintf(" (%s)", paste(origen, collapse = "; ")) else "",
              as.integer(icc$k_ruta %||% k), .reporte_mt_dec(icc$deff_resultante %||% deff))
    } else "Procedencia del DEFF: coeficiente de correlación intraclase de un estudio previo.",
    manual = "Procedencia del DEFF: valor declarado por el equipo para este estudio.",
    por_declarar = "Procedencia del DEFF: pendiente de declaración.",
    "Procedencia del DEFF: DEFF heredado sin procedencia declarada."
  )
  overrides <- names(ss$design_effect_overrides %||% list())
  nota_overrides <- if (length(overrides)) {
    sprintf("Los siguientes distritos tienen un DEFF propio que prevalece sobre el general: %s.",
            paste(vapply(overrides, function(u) .reporte_mt_nombre_distrito(u, "", territorios), character(1)), collapse = ", "))
  } else NULL
  list(
    margen = margen,
    procedencia = procedencia,
    nota_overrides = nota_overrides,
    alcance = "La fórmula del DEFF recoge sólo el componente de conglomeración por ruta. No incluye el efecto de los pesos desiguales ni el de la estratificación; con la selección final por cuotas, el margen es nominal."
  )
}

#' Modelo de la sección «Plan de campo y no respuesta» (ADR 0116 §1, U14).
reporte_mt_plan_modelo <- function(config, sample_size_preview = NULL, plan_campo = NULL) {
  cfg <- hojas_ruta_integrada_normalize_config(config %||% list())
  ss <- cfg$sample_size %||% list()
  k <- max(1L, as.integer(cfg$entrevistas_por_manzana %||% 1L))
  r <- .reporte_mt_num(ss$response_rate, 0.9)
  e <- .reporte_mt_num(ss$ocupacion, 1)
  v <- hojas_ruta_visitas_por_ruta(k, r, e)
  v90 <- hojas_ruta_visitas_cap(k, r, e)
  vis <- sample_size_preview$visitas %||% list()
  supuestos <- data.frame(
    Supuesto = c(
      "Tasa de respuesta supuesta (r)",
      "Ocupación y elegibilidad de viviendas supuesta (e)",
      "Entrevistas completas por ruta (k)",
      "Visitas esperadas por ruta, ceil(k / (r · e))",
      "Visitas para cubrir el 90 % de las rutas"
    ),
    Valor = c(.reporte_mt_pct(r, 0L), .reporte_mt_pct(e, 0L), as.character(k), as.character(v), as.character(v90)),
    stringsAsFactors = FALSE
  )
  if (!is.null(vis$visitas_planificadas)) {
    supuestos <- rbind(supuestos, data.frame(
      Supuesto = c("Contactos esperados en todo el estudio", "Visitas planificadas en todo el estudio"),
      Valor = c(.reporte_mt_int(vis$contactos_esperados), .reporte_mt_int(vis$visitas_planificadas)),
      stringsAsFactors = FALSE
    ))
  }
  intro <- sprintf(
    "La no respuesta no aumenta el tamaño de muestra: se absorbe con más visitas por ruta. Con una tasa de respuesta de %s y una ocupación de %s, lograr %d entrevistas completas en una ruta requiere en promedio %d visitas; para que el 90 %% de las rutas se complete se planifican %d.",
    .reporte_mt_pct(r, 0L), .reporte_mt_pct(e, 0L), k, v, v90
  )
  regla <- HOJAS_RUTA_REGLA_NO_RESPUESTA

  plan <- NULL
  if (is.list(plan_campo) && length(plan_campo$jornadas %||% list())) {
    res <- plan_campo$resumen %||% list()
    su <- hojas_ruta_plan_campo_supuestos(plan_campo$supuestos %||% list())
    costo_declarado <- (su$costo_por_entrevista + su$costo_por_jornada + su$costo_por_km) > 0
    resumen <- data.frame(
      Concepto = c("Rutas", "Entrevistas", "Visitas planificadas", "Encuestadores", "Visitas por jornada",
                   "Jornadas-encuestador equivalentes", "Días de campo", "Recorrido estimado entre rutas",
                   if (costo_declarado) "Costo estimado"),
      Valor = c(.reporte_mt_int(res$rutas), .reporte_mt_int(res$entrevistas), .reporte_mt_int(res$visitas),
                .reporte_mt_int(su$encuestadores), .reporte_mt_int(su$visitas_por_jornada),
                .reporte_mt_int(res$jornadas), .reporte_mt_int(res$dias),
                sprintf("%s km", formatC(.reporte_mt_num(res$km), format = "f", digits = 1, big.mark = ",")),
                if (costo_declarado) sprintf("%s %s", su$moneda, formatC(.reporte_mt_num(res$costo), format = "f", digits = 2, big.mark = ","))),
      stringsAsFactors = FALSE
    )
    largas <- Filter(function(j) isTRUE(j$excede_jornada), plan_campo$jornadas)
    rutas_largas <- if (length(largas)) data.frame(
      Ruta = vapply(largas, function(j) as.character(unlist(j$rutas))[1], character(1)),
      Distrito = vapply(largas, function(j) as.character(j$distrito %||% j$ubigeo %||% ""), character(1)),
      Visitas = vapply(largas, function(j) .reporte_mt_int(j$visitas), character(1)),
      `Días consecutivos` = vapply(largas, function(j) as.character(as.integer(j$jornadas_equivalentes %||% 1L)), character(1)),
      check.names = FALSE, stringsAsFactors = FALSE
    ) else NULL
    plan <- list(
      frase = "Las rutas se agrupan en jornadas de un encuestador por cercanía dentro de cada distrito, con la capacidad de una jornada medida en visitas. Una ruta que no cabe en una jornada no se parte: va completa con el mismo encuestador en días consecutivos y cuenta como varias jornadas equivalentes.",
      resumen = resumen,
      rutas_largas = rutas_largas,
      nota_largas = if (length(largas)) sprintf(
        "%d %s más visitas que una jornada de %d y se %s completa%s al mismo encuestador durante días consecutivos.",
        length(largas), if (length(largas) == 1L) "ruta requiere" else "rutas requieren", as.integer(su$visitas_por_jornada),
        if (length(largas) == 1L) "asigna" else "asignan", if (length(largas) == 1L) "" else "s"
      ) else NULL
    )
  }
  list(
    intro = intro,
    supuestos = supuestos,
    regla = regla,
    plan = plan,
    sin_plan = if (is.null(plan)) "No se registró un plan de campo para esta muestra." else NULL
  )
}

#' Modelo de las secciones de U16 que la plantilla pinta.
reporte_mt_secciones_modelo <- function(config, sample_size_preview = NULL, insumos = NULL, territorios = list()) {
  insumos <- insumos %||% list()
  list(
    marco = reporte_mt_marco_modelo(insumos, territorios),
    margen = reporte_mt_margen_modelo(config, territorios),
    plan = reporte_mt_plan_modelo(config, sample_size_preview, insumos$plan_campo)
  )
}
