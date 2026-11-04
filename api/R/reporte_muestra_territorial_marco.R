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
      # Candado: el marco recalculado debe reproducir los conteos de la muestra
      # (también detecta un cambio de cartografía que `hash_marco` no ve).
      if (!.reporte_mt_conteos_coinciden(ap$por_distrito, por_distrito)) {
        nse_marco_cambio <- TRUE
        NULL
      } else .hojas_ruta_me_nse_por_distrito(territorio, ap$criterio, puntos)
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
  bdf <- if (length(bloques)) .hojas_ruta_rows_df(bloques) else data.frame()
  ent_b <- if (nrow(bdf) && "entrevistas" %in% names(bdf)) .hojas_ruta_me_num(bdf$entrevistas) else numeric(0)
  vis_b <- if (nrow(bdf) && "visitas_esperadas" %in% names(bdf)) .hojas_ruta_me_num(bdf$visitas_esperadas) else numeric(0)
  muestra <- if (nrow(bdf)) list(
    rutas = nrow(bdf),
    entrevistas = sum(ent_b),
    k = sort(unique(ent_b[ent_b > 0])),
    visitas = if (length(vis_b)) range(vis_b[vis_b > 0]) else NULL,
    respuesta = sample$salto_sobre_visitas$respuesta %||% NULL,
    ocupacion = sample$salto_sobre_visitas$ocupacion %||% NULL,
    # F33 (a): el informe no puede afirmar probabilidad conocida de una muestra v1 (ADR 0117).
    # F34: con qué algoritmo se sorteó (sin firma = v1, ADR 0117).
    # Método, nivel de cuota y medida CON QUE SE SORTEÓ: la config vigente puede haber
    # cambiado después (revisor de F34).
    algoritmo_sorteo = as.character(sample$algoritmo_sorteo %||% ""),
    metodo = as.character(sample$config$sampling_method %||% sample$method %||% ""),
    row_var = as.character(sample$config$row_var %||% ""),
    measure_var = as.character(sample$config$measure_var %||% ""),
    # F37: ¿cada ficha trae su cuota de sexo repartida desde la del distrito? Mismo
    # criterio que muestraConCuotasRepartidas del front («h,m» en todas las titulares).
    cuotas_repartidas = all(vapply(bloques, function(b) is.list(b) && grepl("^[0-9]+,[0-9]+$", as.character(b$cuota_sexo_totals %||% "")[1]), logical(1))),
    # F35: salto y reemplazos con que se sorteó.
    route_jump_mode = as.character(sample$config$route_jump_mode %||% ""),
    route_jump_manual = sample$config$route_jump_manual %||% NULL,
    replacements_per_titular = sample$config$replacements_per_titular %||% NULL,
    avisos_v1 = (av <- .reporte_mt_avisos_v1(sample))$avisos,
    avisos_v1_fallo = av$fallo
  ) else NULL
  list(
    estado_muestra = estado_muestra,
    config_cambio = config_cambio,
    muestra = muestra,
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

# Distritos de una muestra v1 con viviendas sin probabilidad de salir (avisos
# W_SAMPLE_DRAWN_WITH_V1 y W_ZONE_QUOTA_EXCLUDES_ZONES que recalcula el GET) y su %
# sobre el marco elegible del distrito. Un fallo NO es «sin aviso»: se marca y la
# causa va a stderr, como nse_fallo y plan_fallo.
.HOJAS_RUTA_CODIGOS_SIN_PROBABILIDAD <- c("W_SAMPLE_DRAWN_WITH_V1", "W_ZONE_QUOTA_EXCLUDES_ZONES")
.reporte_mt_avisos_v1 <- function(sample) {
  con_aviso <- tryCatch(hojas_ruta_sorteo_aviso_v1(sample), error = function(e) {
    message("[reporte-decisional] no se pudo comprobar el reparto del sorteo: ", conditionMessage(e))
    NULL
  })
  if (is.null(con_aviso)) return(list(avisos = list(), fallo = TRUE))
  avisos <- Filter(function(a) as.character(a$code %||% "") %in% .HOJAS_RUTA_CODIGOS_SIN_PROBABILIDAD, con_aviso$alerts %||% list())
  list(fallo = FALSE, avisos = lapply(avisos, function(a) list(
    distrito = sub(":.*$", "", as.character(a$message %||% a$ubigeo %||% "")),
    pct = .reporte_mt_num(a$viviendas_sin_probabilidad_pct %||% a$data$viviendas_sin_probabilidad_pct)
  )))
}

# ¿El marco recalculado reproduce los conteos de la muestra? Compara elegible, área,
# mínimo y piloto, en manzanas y en población, distrito por distrito.
.reporte_mt_conteos_coinciden <- function(recalculado, muestra) {
  clave <- function(filas) {
    filas <- Filter(is.list, filas %||% list())
    u <- vapply(filas, function(f) as.character(f$ubigeo), character(1))
    v <- lapply(filas, function(f) unlist(lapply(c("elegible", "excluida_area", "excluida_minimo", "excluida_piloto"), function(c) {
      c(.reporte_mt_num(f[[c]]$manzanas), .reporte_mt_num(f[[c]]$poblacion))
    })))
    stats::setNames(v, u)[order(u)]
  }
  a <- clave(recalculado); b <- clave(muestra)
  identical(names(a), names(b)) && all(vapply(names(a), function(u) isTRUE(all.equal(a[[u]], b[[u]], tolerance = 1e-9)), logical(1)))
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
  "Una calibración posterior a los totales INEI completos, por marginales de edad y de sexo (raking), supone que dentro de cada categoría de edad y de sexo la población excluida se parece a la cubierta.",
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
    "El perfil socioeconómico de lo excluido no se publica: el marco de manzanas INEI o su cartografía cambiaron después del sorteo y ya no reproducen los conteos de esta muestra."
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

# F33 (b): el reparto lo dice la lógica del N (`sample_size_mode`), no sólo
# `allocation_mode`, que queda con su valor anterior cuando el N se fija por distrito.
.reporte_mt_reparto <- function(cfg, ss) {
  alloc <- as.character(ss$allocation_mode %||% "proportional")
  largo <- unname(.REPORTE_MT_REPARTO[alloc]); if (is.na(largo)) largo <- alloc
  corto <- unname(.REPORTE_MT_REPARTO_CORTO[alloc]); if (is.na(corto)) corto <- largo
  forma <- c(proportional = "proporcional a su población", uniform = "uniforme", compromise = "intermedia entre la proporcional y la uniforme")[alloc]
  if (is.na(forma)) forma <- largo
  switch(as.character(cfg$sample_size_mode %||% "calculator"),
    external_district = c(frase = "El número de entrevistas de cada distrito se fijó de antemano para ese distrito.", corto = "Fijado para cada distrito"),
    external_total = c(frase = sprintf("El total de entrevistas se fijó de antemano y se distribuye entre los distritos de forma %s.", forma), corto = sprintf("Total fijado; %s", tolower(corto))),
    c(frase = sprintf("La distribución de las entrevistas entre distritos es %s.", largo), corto = corto)
  )
}

# F34: estratificación y selección de manzanas según el algoritmo real del sorteo
# (cabeceras de hojas_ruta_sorteo_pps.R y hojas_ruta_sorteo_tope.R). Con muestra,
# todo sale de la muestra (firma, método, nivel de cuota y medida con que se sorteó);
# sin muestra, de la config: describe el próximo sorteo.
.reporte_mt_estrategia <- function(cfg, muestra = NULL) {
  de_muestra <- function(clave, respaldo) {
    v <- as.character(unlist(muestra[[clave]] %||% "", use.names = FALSE))[1]
    if (is.na(v) || !nzchar(v)) as.character(respaldo %||% "") else v
  }
  con_muestra <- !is.null(muestra)
  algoritmo <- if (con_muestra) de_muestra("algoritmo_sorteo", "") else ""
  metodo <- if (con_muestra) de_muestra("metodo", cfg$sampling_method) else as.character(cfg$sampling_method %||% "pps")
  por_zona <- identical(if (con_muestra) de_muestra("row_var", cfg$row_var) else as.character(cfg$row_var %||% ""), "zona")
  medida <- if (con_muestra) de_muestra("measure_var", cfg$measure_var) else as.character(cfg$measure_var %||% "viviendas")
  if (!nzchar(medida)) medida <- "viviendas"
  # Igual que el motor: v1 es toda firma que no sea vigente (sin firma, NA o desconocida).
  v1 <- con_muestra && !(algoritmo %in% .hojas_ruta_sorteo_firmas_vigentes())
  tope <- !v1 && (if (con_muestra) identical(algoritmo, HOJAS_RUTA_ALGORITMO_SORTEO_TOPE) else identical(metodo, "pps_tope"))
  igual <- !tope && identical(metodo, "sistematico")
  sel <- if (igual) "Sistemática con igual probabilidad"
    else if (tope) sprintf("Sistemática con probabilidad proporcional al tamaño, con el tamaño limitado al percentil 95 de las manzanas del distrito (medida: %s)", medida)
    else if (v1) sprintf("Probabilidad proporcional al tamaño (medida: %s)", medida)
    else sprintf("Sistemática con probabilidad proporcional al tamaño (medida: %s)", medida)
  ponderar <- "los resultados deben ponderarse por la inversa de la probabilidad de selección de cada manzana."
  sel_j <- if (igual) paste("Cada manzana elegible tiene la misma probabilidad de selección. Como cada ruta hace el mismo número de entrevistas, el diseño no es autoponderado:", ponderar)
    else if (tope) paste("Las manzanas muy grandes no concentran rutas. El diseño deja de ser autoponderado:", ponderar)
    else "Las manzanas con más viviendas tienen mayor probabilidad de selección, lo que compensa el número fijo de entrevistas por ruta."
  if (v1) {
    return(list(
      estrato = "Distrito y zona", estrato_j = "Las rutas de cada distrito se repartieron entre sus zonas y se sortearon dentro de cada zona.",
      seleccion = paste(sel, "dentro de cada zona"), seleccion_j = sel_j))
  }
  if (por_zona) {
    return(list(
      estrato = "Distrito y zona (cuotas por zona)",
      estrato_j = "Las rutas de cada distrito se reparten entre sus zonas en proporción a la población de cada zona; las fracciones de ruta se resuelven por sorteo, de modo que toda zona con población tiene posibilidad de recibir ruta. El sorteo de manzanas se hace dentro de cada zona.",
      seleccion = paste(sel, "dentro de cada zona"), seleccion_j = sel_j))
  }
  list(
    estrato = "Distrito (lista ordenada por zona)",
    estrato_j = sprintf("Un solo sorteo sistemático por distrito, sobre la lista de manzanas ordenada por zona: en promedio, las rutas se distribuyen entre las zonas en proporción a su tamaño, y %s tiene posibilidad de selección.",
                        if (igual) "toda manzana elegible" else "toda manzana con viviendas"),
    seleccion = paste(sel, "dentro del distrito"), seleccion_j = sel_j)
}

# Un valor de la muestra si lo trae; si no, el de la config (F35).
.reporte_mt_de_muestra <- function(muestra, cfg, clave) {
  v <- muestra[[clave]]
  if (is.null(v) || !length(v) || is.na(v[[1]]) || identical(as.character(v[[1]]), "")) cfg[[clave]] else v[[1]]
}

# Salto con que se sorteó: F33 (c), sin salto con modo «off» o salto manual de 1.
.reporte_mt_salto <- function(cfg, muestra = NULL) {
  modo <- as.character(.reporte_mt_de_muestra(muestra, cfg, "route_jump_mode") %||% "auto")
  manual <- as.integer(.reporte_mt_de_muestra(muestra, cfg, "route_jump_manual") %||% 1L)
  auto <- identical(modo, "auto")
  list(modo = modo, manual = manual, auto = auto, sin = identical(modo, "off") || (!auto && manual <= 1L))
}

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
reporte_mt_diseno_modelo <- function(config, sample_size_preview = NULL, decision_log = NULL, territorios = list(), muestra = NULL) {
  pr <- .reporte_mt_params(config)
  cfg <- pr$cfg; ss <- pr$ss; k <- pr$k
  # F35: salto y reemplazos de la muestra cuando la hay (la config pudo cambiar después).
  reemplazos <- as.integer(.reporte_mt_de_muestra(muestra, cfg, "replacements_per_titular") %||% 0L)
  sa <- .reporte_mt_salto(cfg, muestra)
  salto_manual <- sa$manual; salto_auto <- sa$auto; sin_salto <- sa$sin
  v1 <- Filter(is.list, muestra$avisos_v1 %||% list())
  v1_fallo <- isTRUE(muestra$avisos_v1_fallo)
  est <- .reporte_mt_estrategia(cfg, muestra)
  decisiones <- data.frame(
    `Decisión` = c("Tipo de muestreo", "Unidad primaria de muestreo (UPM)", "Estratificación",
                   "Selección de manzanas", "Selección de viviendas", "Selección de personas", "Reemplazo de rutas"),
    Valor = c(
      "Probabilístico hasta la manzana; no probabilístico dentro de ella",
      "Manzana censal INEI 2017 (una ruta)",
      est$estrato,
      est$seleccion,
      if (sin_salto) "Sin salto: se visitan las viviendas una tras otra, desde la esquina de inicio y en el sentido de la ficha, hasta completar la ruta"
      else if (salto_auto) "Salto sistemático sobre las visitas esperadas, desde una vivienda de inicio sorteada"
      else sprintf("Salto sistemático fijo de %d viviendas, desde una vivienda de inicio sorteada", salto_manual),
      "Cuotas de totales por sexo y por edad, sin cruces",
      if (reemplazos > 0L) sprintf("%d %s de reemplazo por titular", reemplazos, if (reemplazos == 1L) "manzana" else "manzanas") else "Sin manzanas de reemplazo"
    ),
    `Justificación` = c(
      if (length(v1)) "El diseño sortea las manzanas con probabilidad conocida, pero en esta muestra una parte de las viviendas del marco elegible quedó sin posibilidad de selección (ver la limitación de cobertura de esta sección); la selección de personas por cuotas no tiene probabilidad conocida, por lo que el margen de error es nominal."
      else if (v1_fallo) "El diseño sortea las manzanas con probabilidad conocida; no se pudo comprobar si el sorteo de esta muestra dejó viviendas sin posibilidad de selección. La selección de personas por cuotas no tiene probabilidad conocida, por lo que el margen de error es nominal."
      else "Las manzanas se sortean con probabilidad conocida; la selección de personas por cuotas no tiene probabilidad conocida, por lo que el margen de error es nominal.",
      "El marco INEI provee la ubicación y el conteo de viviendas de cada manzana.",
      est$estrato_j,
      est$seleccion_j,
      if (sin_salto) "El encuestador no elige por dónde empezar ni qué viviendas visitar."
      else "El salto distribuye las visitas por toda la manzana y la vivienda de inicio no la elige el encuestador.",
      if (!is.null(muestra) && identical(muestra$cuotas_repartidas, FALSE))
        "En esta muestra las hojas piden la misma cuota en todas las rutas (la mitad de hombres y de mujeres y la misma distribución de edad), de modo que la suma de las rutas no reproduce la cuota de cada distrito; las cuotas deben repartirse por distrito antes de imprimir las hojas."
      else "Cada ruta completa sus totales por sexo y por edad según la cuota de su distrito.",
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
  rp <- .reporte_mt_reparto(cfg, ss)
  reparto_corto <- rp[["corto"]]
  # El tamaño fijado de antemano no sale de la fórmula: los márgenes objetivo son referencia.
  n_externo <- as.character(cfg$sample_size_mode %||% "calculator") %in% c("external_district", "external_total")
  parametros <- data.frame(
    `Parámetro` = c("Nivel de confianza",
                    if (n_externo) "Margen de error total de referencia" else "Margen de error total objetivo",
                    if (n_externo) "Margen de error por distrito de referencia" else "Margen de error por distrito objetivo",
                    "Proporción esperada (p)", "Efecto de diseño (DEFF)", "Corrección por población finita (FPC)",
                    "Entrevistas por ruta (k)", "Reparto entre distritos"),
    Valor = c(.reporte_mt_pct(ss$confidence_level, 0L), .reporte_mt_pct(ss$margin_total), .reporte_mt_pct(ss$margin_district),
              .reporte_mt_dec(ss$expected_proportion), .reporte_mt_dec(ss$design_effect),
              if (fpc) "Sí" else "No", as.character(k),
              reparto_corto),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  formula_intro <- if (n_externo) {
    sprintf("El tamaño de muestra se fijó de antemano%s; no resulta de la fórmula para una proporción. Su precisión se evalúa con el margen nominal de la sección siguiente.",
            if (identical(cfg$sample_size_mode, "external_district")) " para cada distrito" else "")
  } else if (fpc) {
    "El tamaño se calcula con la fórmula para una proporción, ajustada por el efecto de diseño y con corrección por población finita (FPC):"
  } else {
    "El tamaño se calcula con la fórmula para una proporción, ajustada por el efecto de diseño y sin corrección por población finita:"
  }
  formula <- if (n_externo) NULL else if (fpc) {
    "n = \\frac{N \\cdot z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}{(N - 1) \\cdot e^2 + z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}"
  } else {
    "n = \\frac{z^2 \\cdot p \\cdot q \\cdot \\mathrm{DEFF}}{e^2}"
  }
  sp <- sample_size_preview %||% list()
  n_total <- sp$n_used %||% sp$n_total %||% sp$n_recommended
  tamano <- if (!is.null(n_total) && n_externo) {
    sprintf("Tamaño de muestra: %s entrevistas completas, fijado de antemano, en rutas de %d entrevistas.", .reporte_mt_int(n_total), k)
  } else if (!is.null(n_total)) {
    sprintf("Tamaño de muestra: %s entrevistas completas, redondeado hacia arriba a un múltiplo de %d entrevistas por ruta para que cada ruta sea completa.",
            .reporte_mt_int(n_total), k)
  } else "El cálculo del tamaño de muestra todavía no se ha ejecutado."
  # A1: la muestra sorteada debe sumar el n del cálculo.
  aviso_tamano <- if (!is.null(n_total) && !is.null(muestra$entrevistas) &&
                      abs(.reporte_mt_num(muestra$entrevistas) - .reporte_mt_num(n_total)) > 0.5) {
    sprintf("La muestra sorteada no coincide con este tamaño: tiene %s rutas titulares que suman %s entrevistas, frente a las %s del cálculo. El tamaño o la muestra deben actualizarse antes de ir a campo.",
            .reporte_mt_int(muestra$rutas), .reporte_mt_int(muestra$entrevistas), .reporte_mt_int(n_total))
  } else NULL
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
    `Objetivo` = vapply(filas, function(f) sprintf("± %.1f pp", 100 * .hojas_ruta_margin_district_for(ss, as.character(f$ubigeo))), character(1)),
    check.names = FALSE, stringsAsFactors = FALSE
  ) else NULL
  # ADR 0131 §2: con la base 2025 la población del cálculo son los adultos urbanos estimados.
  base25 <- if (is.list(sp$base_reparto)) sp$base_reparto else NULL
  if (!is.null(por_distrito) && !is.null(base25)) names(por_distrito)[2] <- "Adultos urbanos 2025 (est.)"
  # A3: distritos cuyo margen nominal pasa el objetivo por distrito.
  sobre <- Filter(Negate(is.null), lapply(filas, function(f) {
    m <- .reporte_mt_margen_p05(ss, f$poblacion, f$n_used, as.character(f$ubigeo))
    obj <- .hojas_ruta_margin_district_for(ss, as.character(f$ubigeo))
    if (is.na(m) || m <= obj + 1e-9) return(NULL)
    sprintf("%s (± %.1f pp frente a ± %.1f pp)", .reporte_mt_nombre_distrito(as.character(f$ubigeo), as.character(f$distrito %||% ""), territorios), 100 * m, 100 * obj)
  }))
  aviso_margen_distrito <- if (length(sobre)) {
    sprintf("%s el margen de error objetivo por distrito: %s. Las estimaciones de %s tienen menos precisión que la declarada.",
            if (length(sobre) == 1L) "Un distrito supera" else sprintf("%d distritos superan", length(sobre)),
            paste(unlist(sobre), collapse = "; "), if (length(sobre) == 1L) "ese distrito" else "esos distritos")
  } else NULL
  # Reparto no proporcional: el total exige ponderar por distrito (se mide, no se supone).
  pob_d <- vapply(filas, function(f) .reporte_mt_num(f$poblacion), numeric(1))
  n_d <- vapply(filas, function(f) .reporte_mt_num(f$n_used), numeric(1))
  desproporcion <- length(filas) > 1L && sum(pob_d) > 0 && sum(n_d) > 0 &&
    max(abs(n_d / sum(n_d) - pob_d / sum(pob_d))) > 0.02
  nota_tecnica <- c(
    if (n_externo) sprintf("El tamaño se fijó de antemano; el efecto de diseño%s intervienen sólo en el margen nominal.", if (fpc) " y la corrección por población finita" else "")
    else sprintf("El efecto de diseño se integra en la fórmula del tamaño%s.", if (fpc) ", junto con la corrección por población finita" else "; no se aplica corrección por población finita"),
    rp[["frase"]],
    if (!is.null(base25)) sprintf("La población con que se calcula el tamaño y se reparten las entrevistas entre distritos son los adultos urbanos estimados para 2025, según %s: población censada 2025 × u17 × a17, donde u17 es la fracción del distrito que en 2017 se encontraba en manzanas del marco y a17 la proporción de personas de 18 años a más en 2017. Ambas fracciones son supuestos. Las manzanas se sortean sobre el marco 2017.", as.character(base25$fuente %||% "CPV 2025")[1]) else NULL,
    .reporte_mt_frase_estrato(sp$estrato_muestral),
    if (desproporcion) "Las entrevistas no se reparten entre distritos en proporción a su población: para estimar el total, los resultados deben ponderarse por el peso de cada distrito en la población. El margen nominal del total no incluye el efecto de esa ponderación." else NULL,
    "Las cuotas por sexo y por edad de cada distrito salen de la población INEI 2017 del distrito y se aplican en campo como totales, sin cruces entre sexo y edad.",
    sprintf("El tamaño total es múltiplo de %d entrevistas por ruta, de modo que cada ruta es completa.", k)
  )
  aviso_sorteo_v1 <- if (length(v1)) {
    detalle <- paste(vapply(v1, function(a) sprintf("%s, %s %%", a$distrito, format(round(a$pct, 1), nsmall = 1)), character(1)), collapse = "; ")
    sprintf("**Limitación de cobertura.** Al repartir las rutas de cada distrito entre sus zonas, el sorteo de esta muestra dejó zonas sin ninguna ruta, cuyas viviendas no tenían posibilidad de ser seleccionadas. Porcentaje de las viviendas del marco elegible de cada distrito en esa situación: %s. Los resultados no pueden generalizarse a esas viviendas y, si difieren de las incluidas, las estimaciones del distrito y del total pueden estar sesgadas.", detalle)
  } else if (v1_fallo) {
    "No se pudo comprobar si el sorteo de esta muestra dejó viviendas del marco elegible sin posibilidad de selección."
  } else NULL
  list(decisiones = decisiones, aviso_sorteo_v1 = aviso_sorteo_v1, parametros = parametros, formula_intro = formula_intro, formula = formula,
       tamano = tamano, aviso_tamano = aviso_tamano, por_distrito = por_distrito,
       aviso_margen_distrito = aviso_margen_distrito, nota_tecnica = nota_tecnica,
       nota_cuotas = "Las cuotas se controlan como totales por sexo y por edad de cada distrito, sin cruces entre sexo y edad. Cada total suma las entrevistas del distrito, y en campo se reparte entre sus rutas.")
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
      if (!identical(.reporte_mt_dec(deff), .reporte_mt_dec(deff_k))) {
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
  supuestos <- c(
    "El margen es nominal: la selección de personas dentro de la manzana es por cuotas, no probabilística, de modo que el margen describe la precisión que tendría un diseño probabilístico del mismo tamaño y efecto de diseño.",
    if (identical(fuente, "icc_biblioteca") && is.list(icc)) sprintf("El efecto de diseño supone que la correlación intraclase medida en «%s» se traslada a este estudio con su propio número de entrevistas por ruta.", as.character(icc$estudio %||% icc$id %||% "un estudio previo"))
  )
  list(
    supuestos = supuestos,
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
reporte_mt_plan_modelo <- function(config, sample_size_preview = NULL, plan_campo = NULL, plan_fecha = NULL, plan_fallo = FALSE, muestra = NULL) {
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
      Supuesto = c("Contactos esperados en todo el estudio, n / r", "Visitas planificadas según el tamaño calculado, suma de ceil(k / (r · e)) por ruta"),
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
      Concepto = c("Rutas", "Entrevistas", "Visitas esperadas de las rutas sorteadas", "Encuestadores", "Visitas por jornada",
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
    # A2: las rutas sorteadas llevan las visitas con que se sortearon; si sus supuestos
    # difieren de los de la config actual, se muestran los de la muestra.
    supuestos_plan <- NULL
    aviso_supuestos <- NULL
    if (!is.null(muestra)) {
      r_m <- muestra$respuesta; e_m <- muestra$ocupacion; k_m <- muestra$k; v_m <- muestra$visitas
      txt_k <- if (length(k_m)) paste(unique(range(k_m)), collapse = " a ") else "-"
      txt_v <- if (length(v_m)) paste(unique(v_m), collapse = " a ") else "-"
      difiere <- (!is.null(r_m) && abs(.reporte_mt_num(r_m) - r) > 1e-9) ||
        (!is.null(e_m) && abs(.reporte_mt_num(e_m) - e) > 1e-9) ||
        (length(k_m) && !identical(as.numeric(k_m), as.numeric(k))) ||
        (length(v_m) && !identical(as.numeric(unique(v_m)), as.numeric(v)))
      if (difiere) {
        supuestos_plan <- data.frame(
          Supuesto = c("Tasa de respuesta (r)", "Ocupación y elegibilidad (e)", "Entrevistas por ruta (k)", "Visitas esperadas por ruta"),
          `Rutas sorteadas` = c(if (is.null(r_m)) "No registrada" else .reporte_mt_pct(r_m, 0L), if (is.null(e_m)) "No registrada" else .reporte_mt_pct(e_m, 0L), txt_k, txt_v),
          `Configuración actual` = c(.reporte_mt_pct(r, 0L), .reporte_mt_pct(e, 0L), as.character(k), as.character(v)),
          check.names = FALSE, stringsAsFactors = FALSE
        )
        aviso_supuestos <- "Las rutas sorteadas se dimensionaron con supuestos distintos de los de la configuración actual. El plan de campo usa las visitas esperadas de las rutas sorteadas:"
      }
    }
    plan <- list(
      supuestos_plan = supuestos_plan,
      aviso_supuestos = aviso_supuestos,
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
  # F38: sin salto, la regla no manda a «la siguiente que indica el salto».
  list(intro = intro, supuestos = supuestos, regla = hojas_ruta_regla_no_respuesta(.reporte_mt_salto(pr$cfg, muestra)$sin), plan = plan, sin_plan = sin_plan)
}

# ---------- Modelo: cuotas ----------

#' Cuotas por distrito como totales por sexo y totales por rango de edad (revisión
#' metodológica de U16): lo mismo que reparte `hojas_ruta_cuotas_por_ficha()`. La
#' tabla sexo × edad va completa sólo como anexo de referencia para Monitoreo.
reporte_mt_cuotas_modelo <- function(quota = NULL, territorios = list(), sample_size_preview = NULL) {
  cells <- .hojas_ruta_rows_df(quota$cells %||% list())
  if (!nrow(cells) || !all(c("ubigeo", "cuota") %in% names(cells))) return(list(sexo = NULL, edad = NULL, anexo = NULL, aviso_n = NULL))
  cells$cuota <- .hojas_ruta_me_num(cells$cuota)
  cells$ubigeo <- as.character(cells$ubigeo)
  ubigeos <- unique(cells$ubigeo)
  nombre <- function(u) {
    desde_terr <- .reporte_mt_nombre_distrito(u, "", territorios)
    if (!identical(desde_terr, u)) return(desde_terr)
    d <- if ("territorio" %in% names(cells)) as.character(cells$territorio[cells$ubigeo == u][1]) else ""
    if (nzchar(d)) .reporte_mt_titulo(d) else u
  }
  total_u <- function(u) .reporte_mt_int(sum(cells$cuota[cells$ubigeo == u]))
  edad_col <- if ("rango_edad" %in% names(cells)) "rango_edad" else if ("rango_id" %in% names(cells)) "rango_id" else NULL
  sexo <- if ("sexo" %in% names(cells)) {
    niveles <- intersect(c("Hombre", "Mujer"), unique(as.character(cells$sexo)))
    niveles <- c(niveles, setdiff(unique(as.character(cells$sexo)), niveles))
    df <- data.frame(Distrito = vapply(ubigeos, nombre, character(1)), check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL)
    for (nv in niveles) df[[if (nv == "Hombre") "Hombres" else if (nv == "Mujer") "Mujeres" else nv]] <-
      vapply(ubigeos, function(u) .reporte_mt_int(sum(cells$cuota[cells$ubigeo == u & cells$sexo == nv])), character(1))
    df$Total <- vapply(ubigeos, total_u, character(1))
    df
  } else NULL
  edad <- if (!is.null(edad_col)) {
    rangos <- unique(as.character(cells[[edad_col]]))
    df <- data.frame(Distrito = vapply(ubigeos, nombre, character(1)), check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL)
    for (rg in rangos) df[[rg]] <- vapply(ubigeos, function(u) .reporte_mt_int(sum(cells$cuota[cells$ubigeo == u & cells[[edad_col]] == rg])), character(1))
    df$Total <- vapply(ubigeos, total_u, character(1))
    df
  } else NULL
  anexo <- if (!is.null(edad_col) && "sexo" %in% names(cells)) {
    rangos <- unique(as.character(cells[[edad_col]]))
    claves <- unique(cells[c("ubigeo", "sexo")])
    df <- data.frame(Distrito = vapply(claves$ubigeo, nombre, character(1)), Sexo = as.character(claves$sexo),
                     check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL)
    for (rg in rangos) df[[rg]] <- vapply(seq_len(nrow(claves)), function(i) .reporte_mt_int(sum(cells$cuota[cells$ubigeo == claves$ubigeo[i] & cells$sexo == claves$sexo[i] & cells[[edad_col]] == rg])), character(1))
    df
  } else NULL
  # Cada total debe sumar el n del distrito que fija el cálculo del tamaño.
  difieren <- Filter(Negate(is.null), lapply(Filter(is.list, sample_size_preview$district_rows %||% list()), function(f) {
    u <- as.character(f$ubigeo)
    if (!u %in% ubigeos) return(NULL)
    q <- sum(cells$cuota[cells$ubigeo == u]); n <- .reporte_mt_num(f$n_used)
    if (abs(q - n) < 0.5) return(NULL)
    sprintf("%s (cuota %s, tamaño %s)", nombre(u), .reporte_mt_int(q), .reporte_mt_int(n))
  }))
  aviso_n <- if (length(difieren)) {
    sprintf("La cuota no suma el tamaño calculado en %s: %s. Las cuotas deben recalcularse con el tamaño vigente.",
            if (length(difieren) == 1L) "un distrito" else sprintf("%d distritos", length(difieren)), paste(unlist(difieren), collapse = "; "))
  } else NULL
  list(sexo = sexo, edad = edad, anexo = anexo, aviso_n = aviso_n,
       nota_anexo = "Referencia para Monitoreo: matriz completa de sexo por rango de edad de cada distrito, de la que salen los totales. Sus celdas no son cuotas de campo: no se controlan los cruces.")
}

.reporte_mt_titulo <- function(x) {
  x <- as.character(x %||% "")
  if (!nzchar(x) || x != toupper(x)) return(x)
  palabras <- strsplit(tolower(x), " ", fixed = TRUE)[[1]]
  menores <- c("de", "del", "la", "las", "los", "y", "el")
  paste(vapply(seq_along(palabras), function(i) {
    w <- palabras[i]
    if (i > 1L && w %in% menores) w else paste0(toupper(substr(w, 1, 1)), substr(w, 2, nchar(w)))
  }, character(1)), collapse = " ")
}

#' Modelo de las secciones que la plantilla pinta.
reporte_mt_secciones_modelo <- function(config, sample_size_preview = NULL, insumos = NULL, territorios = list(), decision_log = NULL, quota = NULL) {
  insumos <- insumos %||% list()
  list(
    marco = reporte_mt_marco_modelo(insumos, territorios),
    diseno = reporte_mt_diseno_modelo(config, sample_size_preview, decision_log, territorios, insumos$muestra),
    margen = reporte_mt_margen_modelo(config, territorios, sample_size_preview),
    plan = reporte_mt_plan_modelo(config, sample_size_preview, insumos$plan_campo, insumos$plan_fecha, insumos$plan_fallo, insumos$muestra),
    cuotas = reporte_mt_cuotas_modelo(quota, territorios, sample_size_preview)
  )
}
