# Marco elegible, cobertura, diseño, margen y plan de campo del reporte decisional (U16).
#
# El informe de diseño muestral publica lo que el motor ya sabe tras U11-U17:
# la cobertura del marco elegible por distrito y su decisión registrada (ADR 0115
# §4-§5), la procedencia del DEFF y el margen nominal (ADR 0116 §2-§3), la no
# respuesta, las visitas por ruta y el plan de campo registrado (ADR 0116 §1, U14).
#
# Dos piezas:
# - `.reporte_mt_insumos_sesion()` corre en el router (proceso principal): toma de
#   la sesión la bitácora, el estado de la decisión y el plan ya calculados, y la
#   cartografía para el perfil NSE. El worker callr no lee la sesión.
# - `reporte_mt_secciones_modelo()` corre en el worker: arma data.frames y frases
#   ya redactadas. La plantilla Quarto sólo los pinta.
#
# Lo que describe la muestra sale de la MUESTRA guardada (criterios, distritos,
# conteos, piloto, huella de la decisión), no de la config actual: si la config
# cambió después del sorteo, el informe lo dice (revisión metodológica de U16).
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

.REPORTE_MT_SORTEADO_TODO <- "Sorteado sobre todo el marco 2017"

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

.reporte_mt_ubigeos <- function(x) unique(as.character(unlist(x %||% list(), use.names = FALSE)))

# ---------- Insumos de la sesión (router) ----------

#' Estado de la muestra frente al marco elegible.
#'
#' - `sin_sorteo`: no hay titulares sorteadas.
#' - `previo_al_marco`: la muestra no declara criterios y la config sí (se sorteó
#'   antes de declarar el marco elegible).
#' - `sin_criterios`: ni la muestra ni la config declaran criterios.
#' - `declarado`: la muestra se sorteó con el marco elegible declarado.
.reporte_mt_estado_muestra <- function(sample, criterios_muestra, me_config) {
  if (!length(sample$blocks %||% list())) return("sin_sorteo")
  if (isTRUE(criterios_muestra$declarado)) return("declarado")
  if (isTRUE(me_config$declarado)) return("previo_al_marco")
  "sin_criterios"
}

#' Supuestos del último plan de campo registrado en la bitácora de la fase activa.
#' NULL si no hay: `ui_state$plan_campo` siempre trae valores por defecto, así que
#' no prueba que el equipo haya registrado un plan.
.reporte_mt_plan_registrado <- function(bitacora, fase) {
  regs <- Filter(function(e) is.list(e) && identical(e$accion, "plan_supuestos") &&
                   identical(as.character(e$fase %||% ""), as.character(fase %||% "field")), bitacora %||% list())
  if (!length(regs)) return(NULL)
  ultima <- regs[[length(regs)]]
  list(supuestos = ultima$detalle$supuestos %||% list(), fecha = ultima$fecha)
}

#' Insumos del reporte que viven en la sesión, calculados en el proceso principal.
#'
#' Devuelve el estado de la muestra, `marco` (criterios, conteos por distrito y
#' por área de la MUESTRA, sin polígonos), si la config cambió después del sorteo,
#' el estado de la decisión de cobertura calculado con los criterios y los conteos
#' de la muestra, las entradas `decision_cobertura` de la bitácora, el plan de
#' campo registrado (si hay una entrada `plan_supuestos` en la fase activa) y el
#' perfil NSE. Un fallo se marca (`*_fallo`) en vez de presentarse como ausencia.
.reporte_mt_insumos_sesion <- function(sid, active, cfg, sample) {
  sample <- sample %||% list()
  me_muestra <- sample$marco_elegible %||% NULL
  # `completos` (con polígonos) para la huella y para aplicar el marco aquí;
  # `criterios` (sin polígonos) es lo que viaja al worker y al informe.
  completos <- if (is.list(me_muestra$criterios)) hojas_ruta_marco_elegible_normalizar(me_muestra$criterios) else NULL
  criterios <- completos
  if (!is.null(criterios)) {
    attr(criterios, "alertas") <- NULL
    criterios$areas_excluidas <- lapply(criterios$areas_excluidas %||% list(), function(a) { a$poligono <- NULL; a })
  }
  me_config <- hojas_ruta_marco_elegible_normalizar(cfg$marco_elegible)
  estado_muestra <- .reporte_mt_estado_muestra(sample, completos, me_config)
  por_distrito <- Filter(is.list, me_muestra$por_distrito %||% list())
  marco <- if (is.null(me_muestra)) NULL else list(
    criterios = criterios,
    por_distrito = por_distrito,
    por_area = me_muestra$por_area %||% list()
  )
  config_cambio <- identical(estado_muestra, "declarado") &&
    !identical(tryCatch(hojas_ruta_marco_elegible_huella(me_config), error = function(e) "config"),
               tryCatch(hojas_ruta_marco_elegible_huella(completos), error = function(e) "muestra"))

  bitacora_toda <- session_get(sid)$hojas_ruta_bitacora %||% list()
  bitacora <- Filter(function(e) is.list(e) && identical(e$accion, "decision_cobertura"), bitacora_toda)
  # La decisión se valida con la huella de los criterios de la MUESTRA y con sus
  # mismos conteos por distrito. Un fallo NO es «sin decisión»: se marca y la causa
  # va a stderr.
  decision_fallo <- FALSE
  decision <- NULL
  if (identical(estado_muestra, "declarado")) {
    decision <- tryCatch(hojas_ruta_decision_cobertura_estado(por_distrito, completos, bitacora), error = function(e) {
      message("[reporte-decisional] no se pudo calcular la decisión de cobertura: ", conditionMessage(e))
      decision_fallo <<- TRUE
      NULL
    })
  }

  bloques <- sample$blocks %||% list()
  ubigeos <- .reporte_mt_ubigeos(lapply(por_distrito, `[[`, "ubigeo"))
  if (!length(ubigeos) && length(bloques)) ubigeos <- unique(as.character(.hojas_ruta_rows_df(bloques)$ubigeo))
  if (!length(ubigeos)) ubigeos <- .reporte_mt_ubigeos(cfg$territorios)

  necesita_nse <- identical(estado_muestra, "declarado") && any(vapply(por_distrito, function(f) {
    .reporte_mt_num(f$excluida_area$poblacion) + .reporte_mt_num(f$excluida_minimo$poblacion) > 0
  }, logical(1)))
  plan_reg <- if (length(bloques)) .reporte_mt_plan_registrado(bitacora_toda, active$phase) else NULL

  # El perfil NSE se recalcula sobre el marco INEI: sólo si es el mismo archivo con
  # el que se sorteó la muestra (hash guardado en la muestra).
  nse_marco_cambio <- FALSE
  if (necesita_nse) {
    hash_muestra <- as.character(me_muestra$hash_marco %||% NA_character_)[1]
    ruta <- tryCatch(hojas_ruta_inei_frame_path(cfg$frame_source), error = function(e) "")
    hash_actual <- if (nzchar(ruta) && file.exists(ruta)) digest::digest(file = ruta, algo = "sha256") else NA_character_
    nse_marco_cambio <- !is.na(hash_muestra) && !is.na(hash_actual) && !identical(hash_muestra, hash_actual)
  }
  puntos <- NULL
  if ((necesita_nse && !nse_marco_cambio) || !is.null(plan_reg)) {
    puntos <- tryCatch(do.call(rbind, c(
      list(data.frame(id_manzana = character(0), lon = numeric(0), lat = numeric(0), nse_nivel = character(0))),
      lapply(unique(c(ubigeos, as.character(.hojas_ruta_rows_df(bloques)$ubigeo))), hojas_ruta_marco_elegible_puntos)
    )), error = function(e) NULL)
  }
  nse <- NULL
  nse_fallo <- necesita_nse && !nse_marco_cambio && is.null(puntos)
  if (necesita_nse && !nse_marco_cambio && !is.null(puntos)) {
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
  plan_fallo <- FALSE
  plan <- if (!is.null(plan_reg)) {
    tryCatch(hojas_ruta_plan_campo(bloques, plan_reg$supuestos, puntos = puntos), error = function(e) {
      message("[reporte-decisional] no se pudo rehacer el plan de campo registrado: ", conditionMessage(e))
      plan_fallo <<- TRUE
      NULL
    })
  } else NULL
  list(
    estado_muestra = estado_muestra,
    config_cambio = config_cambio,
    ubigeos = as.list(ubigeos),
    marco = marco,
    decision_cobertura = if (is.null(decision)) NULL else decision[c("exigida", "huella", "vigente")],
    bitacora = bitacora,
    plan_campo = plan,
    plan_fecha = plan_reg$fecha,
    plan_fallo = plan_fallo,
    nse_por_distrito = nse,
    decision_fallo = decision_fallo,
    nse_fallo = nse_fallo,
    nse_marco_cambio = nse_marco_cambio
  )
}

# ---------- Modelo: marco elegible y cobertura ----------

# Áreas de la muestra que tocan cada distrito (U16): NULL si la muestra es anterior
# al campo `por_distrito` de `por_area`.
.reporte_mt_areas_por_distrito <- function(por_area) {
  if (!length(por_area)) return(list())
  if (!all(vapply(por_area, function(a) !is.null(a$por_distrito), logical(1)))) return(NULL)
  out <- list()
  for (a in por_area) for (d in a$por_distrito) {
    if (.reporte_mt_num(d$manzanas) <= 0) next
    u <- as.character(d$ubigeo)
    out[[u]] <- c(out[[u]], as.character(a$id))
  }
  out
}

.reporte_mt_frase_marco <- function(criterios, fila, n_areas_estudio, areas_distrito, varios_distritos) {
  m <- as.integer(criterios$minimo_viviendas %||% 0L)
  base <- if (m > 0L) {
    sprintf("La muestra representa a los hogares de manzanas con al menos %d %s registradas en 2017",
            m, if (m == 1L) "vivienda" else "viviendas")
  } else {
    "La muestra representa a los hogares de todas las manzanas registradas en 2017"
  }
  if (n_areas_estudio == 0L) return(paste0(base, "; no se declararon áreas excluidas."))
  total <- .reporte_mt_num(fila$total$poblacion)
  x <- if (total > 0) .reporte_mt_num(fila$excluida_area$poblacion) / total else NA_real_
  if (!is.null(areas_distrito)) {
    k <- length(areas_distrito)
    if (k == 0L) return(sprintf("%s; ninguna de las áreas excluidas del estudio toca este distrito.", base))
    return(sprintf("%s, fuera de las áreas excluidas (%d %s, %s de la población del distrito).",
                   base, k, if (k == 1L) "área" else "áreas", .reporte_mt_pct(x)))
  }
  # Muestra anterior al conteo por distrito: sólo se sabe cuántas áreas tiene el estudio.
  if (!is.na(x) && x <= 0) return(sprintf("%s; las áreas excluidas del estudio no excluyen población de este distrito.", base))
  areas_txt <- if (varios_distritos) {
    sprintf("%d %s para el estudio", n_areas_estudio, if (n_areas_estudio == 1L) "área declarada" else "áreas declaradas")
  } else sprintf("%d %s", n_areas_estudio, if (n_areas_estudio == 1L) "área" else "áreas")
  sprintf("%s, fuera de las áreas excluidas (%s, %s de la población del distrito).", base, areas_txt, .reporte_mt_pct(x))
}

.reporte_mt_estado_decision <- function(ubigeo, fila, est, entrada) {
  if (is.null(fila)) return(.REPORTE_MT_SORTEADO_TODO)
  exige <- ubigeo %in% vapply(est$exigida %||% list(), function(d) as.character(d$ubigeo), character(1))
  if (!exige) return("No requiere decisión (excluye menos del 10 %)")
  if (is.null(entrada)) return("Sin decisión registrada")
  tipo <- as.character(entrada$detalle$decision %||% "")[1]
  tipo_txt <- switch(tipo, redefinir = "redefinir la población objetivo", aceptar = "aceptar la pérdida de cobertura", "tipo no indicado")
  sprintf("Decisión registrada (%s, %s)", .reporte_mt_fecha(entrada$fecha, corta = TRUE), tipo_txt)
}

.reporte_mt_supuestos_marco <- function() c(
  "El tamaño de muestra y las cuotas se calculan sobre la población INEI 2017 completa de cada distrito, no sobre el marco elegible.",
  "Una calibración posterior a los totales INEI completos supone que, dentro de cada celda de edad y sexo, la población excluida se parece a la cubierta.",
  "La concentración de lo excluido en un nivel socioeconómico todavía no exige una decisión de cobertura: su umbral no está fijado. El perfil NSE de lo excluido se publica para que pueda evaluarse."
)

.reporte_mt_marco_vacio <- function(estado_muestra, frase, estado = NULL) list(
  estado_muestra = estado_muestra, declarado = FALSE, frase_general = frase, aviso_config = NULL,
  frases_distrito = character(0), cobertura = NULL, estado = estado, areas = NULL, decisiones = NULL,
  nse = NULL, nota_nse = NULL, nota_piloto = NULL, supuestos = character(0)
)

#' Modelo de la sección «Marco elegible y cobertura».
#'
#' @param insumos Salida de `.reporte_mt_insumos_sesion()` (o equivalente en tests).
#' @param territorios Territorios del reporte, para nombrar distritos sin nombre.
reporte_mt_marco_modelo <- function(insumos = list(), territorios = list()) {
  marco <- insumos$marco %||% NULL
  criterios <- marco$criterios %||% NULL
  filas <- Filter(is.list, marco$por_distrito %||% list())
  estado_muestra <- as.character(insumos$estado_muestra %||% if (isTRUE(criterios$declarado)) "declarado" else "sin_criterios")[1]
  ubigeos <- unique(c(vapply(filas, function(f) as.character(f$ubigeo), character(1)), .reporte_mt_ubigeos(insumos$ubigeos)))
  if (!length(ubigeos)) {
    ubigeos_terr <- vapply(territorios, function(t) as.character(t$ubigeo %||% ""), character(1))
    ubigeos <- ubigeos_terr[nzchar(ubigeos_terr)]
  }
  fila_de <- function(u) { for (f in filas) if (identical(as.character(f$ubigeo), u)) return(f); NULL }
  nombre <- function(u) .reporte_mt_nombre_distrito(u, as.character(fila_de(u)$distrito %||% ""), territorios)
  tabla_todo <- function() if (length(ubigeos)) data.frame(
    Distrito = vapply(ubigeos, nombre, character(1)),
    `Decisión de cobertura` = .REPORTE_MT_SORTEADO_TODO,
    check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
  ) else NULL

  if (identical(estado_muestra, "sin_sorteo")) {
    return(.reporte_mt_marco_vacio(estado_muestra,
      "Todavía no hay una muestra sorteada. La cobertura del marco elegible se informa cuando se sortean las manzanas."))
  }
  if (identical(estado_muestra, "previo_al_marco")) {
    return(.reporte_mt_marco_vacio(estado_muestra,
      "La muestra se sorteó antes de que se declarara el marco elegible: se sorteó sobre todo el marco de manzanas del Censo 2017 de los distritos del estudio. Los criterios de elegibilidad que la configuración declara hoy no se aplicaron a esta muestra; para aplicarlos hay que volver a sortear.",
      tabla_todo()))
  }
  if (!identical(estado_muestra, "declarado")) {
    return(.reporte_mt_marco_vacio("sin_criterios",
      "La muestra se sorteó sobre todo el marco de manzanas del Censo 2017 de los distritos del estudio, sin criterios de elegibilidad declarados: no se excluyeron manzanas por número de viviendas ni por área.",
      tabla_todo()))
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
  por_area <- marco$por_area %||% list()
  areas_de <- .reporte_mt_areas_por_distrito(por_area)
  varios <- length(ubigeos) > 1L

  pct_de <- function(f, campo) {
    t <- .reporte_mt_num(f$total$poblacion)
    if (is.null(f) || t <= 0) return("-")
    .reporte_mt_pct(sum(vapply(campo, function(c) .reporte_mt_num(f[[c]]$poblacion), numeric(1))) / t)
  }
  cobertura <- data.frame(
    Distrito = vapply(ubigeos, nombre, character(1)),
    `Población 2017` = vapply(ubigeos, function(u) { f <- fila_de(u); if (is.null(f)) "-" else .reporte_mt_int(f$total$poblacion) }, character(1)),
    `Población elegible` = vapply(ubigeos, function(u) { f <- fila_de(u); if (is.null(f)) "-" else .reporte_mt_int(f$elegible$poblacion) }, character(1)),
    `Excluida por área` = vapply(ubigeos, function(u) pct_de(fila_de(u), "excluida_area"), character(1)),
    `Excluida por mínimo` = vapply(ubigeos, function(u) pct_de(fila_de(u), "excluida_minimo"), character(1)),
    `Total excluido` = vapply(ubigeos, function(u) pct_de(fila_de(u), c("excluida_area", "excluida_minimo")), character(1)),
    check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
  )
  estado <- data.frame(
    Distrito = cobertura$Distrito,
    `Decisión de cobertura` = vapply(ubigeos, function(u) {
      ent_u <- if (!is.null(entrada) && u %in% as.character(unlist(entrada$detalle$ubigeos, use.names = FALSE))) entrada else NULL
      .reporte_mt_estado_decision(u, fila_de(u), est, ent_u)
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
    areas_u <- if (is.null(areas_de)) NULL else (areas_de[[u]] %||% character(0))
    sprintf("%s. %s", nombre(u), .reporte_mt_frase_marco(criterios, f, n_areas, areas_u, varios))
  }, character(1), USE.NAMES = FALSE)

  area_de_id <- function(id) { p <- Filter(function(x) identical(as.character(x$id), as.character(id)), por_area); if (length(p)) p[[1]] else NULL }
  areas <- if (n_areas) {
    df <- data.frame(
      `Área` = vapply(areas_decl, function(a) as.character(a$id %||% ""), character(1)),
      Motivo = vapply(areas_decl, function(a) {
        lab <- unname(.REPORTE_MT_MOTIVOS[as.character(a$motivo %||% "")])
        if (is.na(lab)) lab <- as.character(a$motivo)
        det <- as.character(a$detalle %||% "")
        if (nzchar(det)) sprintf("%s: %s", lab, det) else lab
      }, character(1)),
      Evidencia = vapply(areas_decl, function(a) {
        fu <- as.character(a$fuente %||% ""); fe <- as.character(a$fecha_evidencia %||% "")
        partes <- c(if (nzchar(fu)) fu, if (nzchar(fe)) .reporte_mt_fecha(fe))
        if (length(partes)) paste(partes, collapse = ", ") else "-"
      }, character(1)),
      check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL
    )
    if (!is.null(areas_de)) {
      df$Distritos <- vapply(areas_decl, function(a) {
        p <- area_de_id(a$id)
        us <- vapply(Filter(function(d) .reporte_mt_num(d$manzanas) > 0, p$por_distrito %||% list()), function(d) as.character(d$ubigeo), character(1))
        if (length(us)) paste(vapply(us, nombre, character(1)), collapse = ", ") else "Ninguno"
      }, character(1))
    }
    df$Manzanas <- vapply(areas_decl, function(a) { p <- area_de_id(a$id); if (is.null(p)) "-" else .reporte_mt_int(p$manzanas) }, character(1))
    df$`Población excluida` <- vapply(areas_decl, function(a) { p <- area_de_id(a$id); if (is.null(p)) "-" else .reporte_mt_int(p$poblacion) }, character(1))
    df
  } else NULL

  decisiones <- if (!is.null(entrada)) {
    tipo <- as.character(entrada$detalle$decision %||% "")[1]
    cubre <- intersect(ubigeos, as.character(unlist(entrada$detalle$ubigeos, use.names = FALSE)))
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
  nota_nse <- if (!hay_exclusion) {
    "El marco elegible no excluyó población por área ni por mínimo de viviendas; no hay perfil de lo excluido que comparar."
  } else if (is.null(nse) && isTRUE(insumos$nse_marco_cambio)) {
    "El perfil socioeconómico de lo excluido no se publica: el marco de manzanas INEI cambió después del sorteo y ya no describe esta muestra."
  } else if (is.null(nse) && isTRUE(insumos$nse_fallo)) {
    "El perfil socioeconómico de lo excluido no pudo calcularse al generar este informe."
  } else if (is.null(nse)) {
    "El perfil socioeconómico de lo excluido no está disponible para estos distritos."
  } else NULL

  # Lo retirado por la piloto no es criterio del marco: va aparte, y explica por qué
  # elegible + área + mínimo no suma la población del distrito.
  con_piloto <- Filter(function(f) .reporte_mt_num(f$excluida_piloto$manzanas) > 0 || .reporte_mt_num(f$excluida_piloto$poblacion) > 0, filas)
  nota_piloto <- if (length(con_piloto)) {
    detalle <- paste(vapply(con_piloto, function(f) {
      mz <- .reporte_mt_num(f$excluida_piloto$manzanas)
      sprintf("%s: %s %s y %s personas", nombre(as.character(f$ubigeo)), .reporte_mt_int(mz),
              if (mz == 1) "manzana" else "manzanas", .reporte_mt_int(f$excluida_piloto$poblacion))
    }, character(1)), collapse = "; ")
    sprintf("La prueba piloto retiró del marco sus manzanas titulares para el campo real (%s). Por eso, en %s, la población elegible más la excluida por área y por mínimo no suma el 100 %% de la población 2017: la diferencia es lo retirado por la piloto, que no es un criterio del marco elegible y no entra en los porcentajes de exclusión ni en la decisión de cobertura.",
            detalle, if (length(con_piloto) == 1L) "ese distrito" else "esos distritos")
  } else NULL

  m <- as.integer(criterios$minimo_viviendas %||% 0L)
  list(
    estado_muestra = "declarado",
    declarado = TRUE,
    frase_general = sprintf(
      "El sorteo se hizo sobre el marco elegible: las manzanas del Censo 2017 de los distritos del estudio %s%s. La cobertura se mide en población 2017 del distrito: los porcentajes de exclusión por área y por mínimo de viviendas comparten ese denominador. Un distrito cuya población excluida en total (por área más por mínimo) llega al 10 %% exige una decisión registrada antes de emitir las hojas de campo: redefinir la población objetivo o aceptar la pérdida con justificación.",
      if (m > 0L) sprintf("con al menos %d %s", m, if (m == 1L) "vivienda registrada" else "viviendas registradas") else "sin mínimo de viviendas",
      if (n_areas) sprintf(", fuera de %d %s", n_areas, if (n_areas == 1L) "área excluida" else "áreas excluidas") else ""
    ),
    aviso_config = if (isTRUE(insumos$config_cambio)) "La configuración del marco elegible cambió después del sorteo; este informe describe la muestra sorteada." else NULL,
    frases_distrito = frases,
    cobertura = cobertura,
    estado = estado,
    areas = areas,
    decisiones = decisiones,
    nse = nse,
    nota_nse = nota_nse,
    nota_piloto = nota_piloto,
    supuestos = .reporte_mt_supuestos_marco()
  )
}

# ---------- Modelo: diseño, parámetros y tamaño ----------

.REPORTE_MT_REPARTO <- c(
  proportional = "proporcional a la población de cada distrito",
  uniform = "uniforme entre distritos",
  compromise = "de compromiso entre el reparto proporcional y el uniforme"
)

.REPORTE_MT_REPARTO_CORTO <- c(proportional = "Proporcional a la población", uniform = "Uniforme", compromise = "Compromiso")

.reporte_mt_params <- function(config) {
  cfg <- hojas_ruta_integrada_normalize_config(config %||% list())
  list(cfg = cfg, ss = cfg$sample_size %||% list(), k = max(1L, as.integer(cfg$entrevistas_por_manzana %||% 1L)))
}

# Margen nominal con p = 0,5 para una población y un n, con el DEFF del distrito si
# se da el ubigeo (misma fórmula que el motor).
.reporte_mt_margen_p05 <- function(ss, poblacion, n, ubigeo = NULL) {
  p <- ss
  p$expected_proportion <- 0.5
  .hojas_ruta_margin_error(poblacion, n, p, ubigeo = ubigeo)
}

#' Decisiones de diseño, parámetros y cálculo del tamaño (secciones heredadas,
#' corregidas para que digan lo que hace el motor).
reporte_mt_diseno_modelo <- function(config, sample_size_preview = NULL, decision_log = NULL, territorios = list()) {
  pr <- .reporte_mt_params(config)
  cfg <- pr$cfg; ss <- pr$ss; k <- pr$k
  pps <- !identical(cfg$sampling_method, "sistematico")
  medida <- as.character(cfg$measure_var %||% "viviendas")
  reemplazos <- as.integer(cfg$replacements_per_titular %||% 0L)
  salto_auto <- identical(as.character(cfg$route_jump_mode %||% "auto"), "auto")
  decisiones <- data.frame(
    `Decisión` = c("Tipo de muestreo", "Unidad primaria de muestreo (UPM)", "Estratificación",
                   "Selección de manzanas", "Selección de viviendas", "Selección de personas", "Reemplazo de rutas"),
    Valor = c(
      "Probabilístico hasta la manzana; no probabilístico dentro de ella",
      "Manzana censal INEI 2017 (una ruta)",
      "Distrito y zona",
      if (pps) sprintf("Probabilidad proporcional al tamaño (PPS, medida: %s) dentro del distrito y la zona", medida)
      else "Sistemática con igual probabilidad dentro del distrito y la zona",
      if (salto_auto) "Salto sistemático sobre las visitas esperadas, desde una vivienda de inicio sorteada"
      else sprintf("Salto sistemático fijo de %d viviendas, desde una vivienda de inicio sorteada", as.integer(cfg$route_jump_manual %||% 1L)),
      "Cuotas de totales por sexo y por edad, sin cruces",
      if (reemplazos > 0L) sprintf("%d %s de reemplazo por titular", reemplazos, if (reemplazos == 1L) "manzana" else "manzanas") else "Sin manzanas de reemplazo"
    ),
    `Justificación` = c(
      "Las manzanas se sortean con probabilidad conocida; la selección de personas por cuotas no tiene probabilidad conocida, por lo que el margen de error es nominal.",
      "El marco INEI provee la ubicación y el conteo de viviendas de cada manzana.",
      "Las rutas se reparten por distrito y, dentro de cada distrito, por zona.",
      if (pps) "Las manzanas con más viviendas tienen mayor probabilidad de selección, lo que compensa el número fijo de entrevistas por ruta."
      else "Cada manzana elegible de la zona tiene la misma probabilidad de selección.",
      "El salto distribuye las visitas por toda la manzana y la vivienda de inicio no la elige el encuestador.",
      "Cada ruta completa sus totales por sexo y por edad según la cuota de su distrito.",
      "Si una ruta no puede trabajarse, se reemplaza por otra manzana sorteada del mismo distrito."
    ),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  metodologicas <- decision_log$metodologicas %||% NULL
  if (length(metodologicas)) {
    decisiones <- data.frame(
      `Decisión` = vapply(metodologicas, function(d) as.character(d$decision %||% ""), character(1)),
      Valor = vapply(metodologicas, function(d) as.character(d$valor %||% ""), character(1)),
      `Justificación` = vapply(metodologicas, function(d) as.character(d$justificacion %||% ""), character(1)),
      check.names = FALSE, stringsAsFactors = FALSE
    )
  }
  fpc <- isTRUE(ss$apply_fpc)
  reparto <- unname(.REPORTE_MT_REPARTO[as.character(ss$allocation_mode %||% "proportional")])
  if (is.na(reparto)) reparto <- as.character(ss$allocation_mode)
  reparto_corto <- unname(.REPORTE_MT_REPARTO_CORTO[as.character(ss$allocation_mode %||% "proportional")])
  if (is.na(reparto_corto)) reparto_corto <- reparto
  parametros <- data.frame(
    `Parámetro` = c("Nivel de confianza", "Margen de error total objetivo", "Margen de error por distrito objetivo",
                    "Proporción esperada (p)", "Efecto de diseño (DEFF)", "Corrección por población finita (FPC)",
                    "Entrevistas por ruta (k)", "Reparto entre distritos"),
    Valor = c(.reporte_mt_pct(ss$confidence_level, 0L), .reporte_mt_pct(ss$margin_total), .reporte_mt_pct(ss$margin_district),
              .reporte_mt_dec(ss$expected_proportion), .reporte_mt_dec(ss$design_effect),
              if (fpc) "Sí" else "No", as.character(k),
              reparto_corto),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  formula_intro <- if (fpc) {
    "El tamaño se calcula con la fórmula para una proporción, ajustada por el efecto de diseño y con corrección por población finita (FPC):"
  } else {
    "El tamaño se calcula con la fórmula para una proporción, ajustada por el efecto de diseño y sin corrección por población finita:"
  }
  formula <- if (fpc) {
    "n = \\frac{N \\cdot z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}{(N - 1) \\cdot e^2 + z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}"
  } else {
    "n = \\frac{z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}{e^2}"
  }
  sp <- sample_size_preview %||% list()
  n_total <- sp$n_used %||% sp$n_total %||% sp$n_recommended
  tamano <- if (!is.null(n_total)) {
    sprintf("Tamaño de muestra: %s entrevistas completas, redondeado hacia arriba a un múltiplo de %d entrevistas por ruta para que cada ruta sea completa.",
            .reporte_mt_int(n_total), k)
  } else "El cálculo del tamaño de muestra todavía no se ha ejecutado."
  filas <- Filter(is.list, sp$district_rows %||% list())
  por_distrito <- if (length(filas)) data.frame(
    Distrito = vapply(filas, function(f) .reporte_mt_nombre_distrito(as.character(f$ubigeo), as.character(f$distrito %||% ""), territorios), character(1)),
    `Población 2017` = vapply(filas, function(f) .reporte_mt_int(f$poblacion), character(1)),
    `Entrevistas` = vapply(filas, function(f) .reporte_mt_int(f$n_used), character(1)),
    `DEFF` = vapply(filas, function(f) .reporte_mt_dec(f$design_effect %||% ss$design_effect), character(1)),
    `Margen nominal (p = 0.5)` = vapply(filas, function(f) {
      m <- .reporte_mt_margen_p05(ss, f$poblacion, f$n_used, as.character(f$ubigeo))
      if (is.na(m)) "-" else sprintf("± %.1f pp", 100 * m)
    }, character(1)),
    check.names = FALSE, stringsAsFactors = FALSE
  ) else NULL
  nota_tecnica <- c(
    sprintf("El efecto de diseño se integra en la fórmula del tamaño%s.", if (fpc) ", junto con la corrección por población finita" else "; no se aplica corrección por población finita"),
    sprintf("La distribución de las entrevistas entre distritos es %s.", reparto),
    "Las cuotas por sexo y por edad de cada distrito salen de la población INEI 2017 del distrito y se aplican en campo como totales, sin cruces entre sexo y edad.",
    sprintf("El tamaño total es múltiplo de %d entrevistas por ruta, de modo que cada ruta es completa.", k)
  )
  list(decisiones = decisiones, parametros = parametros, formula_intro = formula_intro, formula = formula,
       tamano = tamano, por_distrito = por_distrito, nota_tecnica = nota_tecnica,
       nota_cuotas = "En campo, cada ruta aplica las cuotas como totales por sexo y por edad, sin cruces; la tabla siguiente muestra la matriz de referencia de la que salen esos totales.")
}

# ---------- Modelo: margen ----------

#' Modelo del margen nominal y la procedencia del DEFF (ADR 0116 §2-§3).
reporte_mt_margen_modelo <- function(config, territorios = list(), sample_size_preview = NULL) {
  pr <- .reporte_mt_params(config)
  ss <- pr$ss; k <- pr$k
  deff <- .reporte_mt_num(ss$design_effect, 1)
  fuente <- as.character(ss$design_effect_fuente %||% "legado")[1]
  incluye <- hojas_ruta_margen_incluye_conglomerado(ss, k)
  margen <- if (incluye) {
    sprintf("El margen de error se calcula bajo muestreo aleatorio simple (MAS) ajustado por un efecto de diseño (DEFF) de %s.", .reporte_mt_dec(deff))
  } else {
    sprintf("El margen de error se calcula bajo muestreo aleatorio simple (MAS) y no incluye el efecto del conglomerado: con %d entrevistas por ruta, el DEFF aplicado es %s.", k, .reporte_mt_dec(deff))
  }
  sp <- sample_size_preview %||% list()
  n <- sp$n_used %||% sp$n_total
  N <- sp$total_population
  m_total <- if (!is.null(n) && !is.null(N)) .reporte_mt_margen_p05(ss, N, n) else NA_real_
  margen_numerico <- if (!is.na(m_total)) {
    sprintf("Margen nominal para el total: ± %.1f puntos porcentuales al %s de confianza, con p = 0.5, n = %s y DEFF %s%s.",
            100 * m_total, .reporte_mt_pct(ss$confidence_level, 0L), .reporte_mt_int(n), .reporte_mt_dec(deff),
            if (isTRUE(ss$apply_fpc)) " (con corrección por población finita)" else "")
  } else NULL

  icc <- ss$icc_aplicado
  aviso_icc <- NULL
  procedencia <- switch(
    fuente,
    icc_biblioteca = if (is.list(icc)) {
      icc_v <- .reporte_mt_num(icc$icc)
      deff_k <- round(1 + (k - 1) * icc_v, 4)
      ic <- suppressWarnings(as.numeric(unlist(icc$icc_ic95 %||% list(), use.names = FALSE)))
      origen <- c(
        if (nzchar(as.character(icc$indicador %||% ""))) sprintf("indicador «%s»", as.character(icc$indicador)),
        if (nzchar(as.character(icc$unidad_conglomerado %||% ""))) sprintf("conglomerado: %s", as.character(icc$unidad_conglomerado)),
        if (length(ic) == 2L && all(is.finite(ic))) sprintf("IC 95 %%: %s a %s", formatC(ic[1], format = "f", digits = 3), formatC(ic[2], format = "f", digits = 3)),
        if (!is.null(icc$conglomerados)) sprintf("%s conglomerados", .reporte_mt_int(icc$conglomerados)),
        if (nzchar(as.character(icc$fuente %||% ""))) as.character(icc$fuente),
        if (nzchar(as.character(icc$fecha %||% ""))) .reporte_mt_fecha(icc$fecha)
      )
      resultante <- .reporte_mt_num(icc$deff_resultante, NA_real_)
      if (abs(deff - deff_k) > 0.005 || (!is.na(resultante) && abs(resultante - deff) > 0.005)) {
        aviso_icc <- sprintf("El DEFF aplicado al tamaño (%s) no coincide con el que resulta de este ICC con las %d entrevistas por ruta actuales (%s): el tamaño debe recalcularse.",
                             .reporte_mt_dec(deff), k, .reporte_mt_dec(deff_k))
      }
      sprintf("Procedencia del DEFF: se trasladó el coeficiente de correlación intraclase (ICC) de %s medido en «%s»%s, con DEFF = 1 + (k − 1) · ICC y k = %d entrevistas por ruta, lo que da %s.",
              formatC(icc_v, format = "f", digits = 3), as.character(icc$estudio %||% icc$id %||% "estudio previo"),
              if (length(origen)) sprintf(" (%s)", paste(origen, collapse = "; ")) else "",
              k, .reporte_mt_dec(deff_k))
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
    margen_numerico = margen_numerico,
    procedencia = procedencia,
    aviso_icc = aviso_icc,
    nota_overrides = nota_overrides,
    alcance = "La fórmula del DEFF recoge sólo el componente de conglomeración por ruta. No incluye el efecto de los pesos desiguales ni el de la estratificación; con la selección final por cuotas, el margen es nominal."
  )
}

# ---------- Modelo: no respuesta y plan de campo ----------

#' Modelo de la sección «Plan de campo y no respuesta» (ADR 0116 §1, U14).
reporte_mt_plan_modelo <- function(config, sample_size_preview = NULL, plan_campo = NULL, plan_fecha = NULL, plan_fallo = FALSE) {
  pr <- .reporte_mt_params(config)
  ss <- pr$ss; k <- pr$k
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
      "Visitas con margen al 90 % por ruta"
    ),
    Valor = c(.reporte_mt_pct(r, 0L), .reporte_mt_pct(e, 0L), as.character(k), as.character(v), as.character(v90)),
    stringsAsFactors = FALSE
  )
  if (!is.null(vis$visitas_planificadas)) {
    supuestos <- rbind(supuestos, data.frame(
      Supuesto = c("Contactos esperados en todo el estudio, N / r", "Visitas planificadas en todo el estudio, suma de ceil(k / (r · e)) por ruta"),
      Valor = c(.reporte_mt_int(vis$contactos_esperados), .reporte_mt_int(vis$visitas_planificadas)),
      stringsAsFactors = FALSE
    ))
  }
  intro <- sprintf(
    "La no respuesta no aumenta el tamaño de muestra: se absorbe con más visitas por ruta. Con una tasa de respuesta de %s y una ocupación de %s, lograr %d entrevistas completas en una ruta requiere ceil(%d / (%s · %s)) = %d visitas esperadas; con margen para que el 90 %% de las rutas se complete, %d visitas.",
    .reporte_mt_pct(r, 0L), .reporte_mt_pct(e, 0L), k, k, .reporte_mt_dec(r), .reporte_mt_dec(e), v, v90
  )
  plan <- NULL
  if (is.list(plan_campo) && length(plan_campo$jornadas %||% list())) {
    res <- plan_campo$resumen %||% list()
    su <- hojas_ruta_plan_campo_supuestos(plan_campo$supuestos %||% list())
    costo_declarado <- (su$costo_por_entrevista + su$costo_por_jornada + su$costo_por_km) > 0
    resumen <- data.frame(
      Concepto = c("Rutas", "Entrevistas", "Visitas planificadas (visitas esperadas de cada ruta)", "Encuestadores", "Visitas por jornada",
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
      `Visitas esperadas` = vapply(largas, function(j) .reporte_mt_int(j$visitas), character(1)),
      `Días consecutivos` = vapply(largas, function(j) as.character(as.integer(j$jornadas_equivalentes %||% 1L)), character(1)),
      check.names = FALSE, stringsAsFactors = FALSE
    ) else NULL
    plan <- list(
      frase = paste0(
        if (!is.null(plan_fecha)) sprintf("Plan de campo registrado el %s. ", .reporte_mt_fecha(plan_fecha)) else "",
        "Las rutas se agrupan en jornadas de un encuestador por cercanía dentro de cada distrito, con la capacidad de una jornada medida en visitas esperadas. Una ruta que no cabe en una jornada no se parte: va completa con el mismo encuestador en días consecutivos y cuenta como varias jornadas equivalentes."
      ),
      resumen = resumen,
      rutas_largas = rutas_largas,
      nota_largas = if (length(largas)) sprintf(
        "%d %s más visitas esperadas que una jornada de %d y se %s completa%s al mismo encuestador durante días consecutivos.",
        length(largas), if (length(largas) == 1L) "ruta requiere" else "rutas requieren", as.integer(su$visitas_por_jornada),
        if (length(largas) == 1L) "asigna" else "asignan", if (length(largas) == 1L) "" else "s"
      ) else NULL
    )
  }
  sin_plan <- if (!is.null(plan)) NULL else if (isTRUE(plan_fallo)) {
    "El plan de campo registrado no pudo rehacerse al generar este informe."
  } else "No se registró un plan de campo para esta muestra."
  list(intro = intro, supuestos = supuestos, regla = HOJAS_RUTA_REGLA_NO_RESPUESTA, plan = plan, sin_plan = sin_plan)
}

#' Modelo de las secciones que la plantilla pinta.
reporte_mt_secciones_modelo <- function(config, sample_size_preview = NULL, insumos = NULL, territorios = list(), decision_log = NULL) {
  insumos <- insumos %||% list()
  list(
    marco = reporte_mt_marco_modelo(insumos, territorios),
    diseno = reporte_mt_diseno_modelo(config, sample_size_preview, decision_log, territorios),
    margen = reporte_mt_margen_modelo(config, territorios, sample_size_preview),
    plan = reporte_mt_plan_modelo(config, sample_size_preview, insumos$plan_campo, insumos$plan_fecha, insumos$plan_fallo)
  )
}
