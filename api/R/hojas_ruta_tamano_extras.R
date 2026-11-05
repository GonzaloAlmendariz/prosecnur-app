# No respuesta, visitas e ICC del tamaño de Hojas de ruta (ADR 0116).
#
# La no respuesta de viviendas no infla el N: dimensiona las visitas de cada ruta,
# el salto y la capacidad de la manzana. El ICC medido en un estudio se traslada al
# siguiente recalculando el DEFF con el k de la ruta nueva, nunca copiando el DEFF.
#
# El motor congelado sólo llama a `hojas_ruta_tamano_extras_normalizar()` desde
# `.hojas_ruta_normalize_sample_size()` (lista cerrada): sin eso los campos nuevos
# de `sample_size` se perderían en silencio.

HOJAS_RUTA_DEFF_FUENTES <- c("legado", "por_declarar", "manual", "icc_biblioteca")
HOJAS_RUTA_ICC_MIN_CONGLOMERADOS <- 50L
HOJAS_RUTA_VISITAS_CUANTIL <- 0.9

.hojas_ruta_te_alerta <- function(code, message, ...) c(list(level = "warn", code = code, message = message), list(...))

.hojas_ruta_te_num <- function(x, defecto = NA_real_) {
  v <- suppressWarnings(as.numeric(if (is.null(x) || !length(x)) NA else x[[1]]))
  if (is.na(v)) defecto else v
}

# ---------- Normalización (enganche en el motor) ----------

#' Campos de `sample_size` del ADR 0116.
#'
#' - `ocupacion` (e): tasa de ocupación y elegibilidad de viviendas, por defecto 1.
#' - `design_effect_fuente`: sin `sample_size` (proyecto nuevo) es `por_declarar`; con
#'   `sample_size` guardado pero sin el campo (proyecto existente) es `legado`.
#' - `icc_aplicado`: la entrada de la biblioteca copiada al aplicarla, o NULL.
hojas_ruta_tamano_extras_normalizar <- function(x = NULL) {
  nuevo <- is.null(x) || !is.list(x) || !length(x)
  fuente <- if (nuevo) "por_declarar" else as.character(x$design_effect_fuente %||% "legado")[1]
  if (is.na(fuente) || !fuente %in% HOJAS_RUTA_DEFF_FUENTES) fuente <- "legado"
  e <- .hojas_ruta_te_num(if (nuevo) NULL else x$ocupacion, 1)
  if (e > 1) e <- e / 100
  e <- min(1, max(0.05, e))
  icc <- if (nuevo) NULL else x$icc_aplicado
  if (!is.null(icc) && !isTRUE(hojas_ruta_icc_validar(icc)$ok)) icc <- NULL
  # A1: si el DEFF se editó después de aplicar el ICC (también desde la página clásica),
  # ya no sale de la biblioteca: pasa a manual y se suelta la entrada.
  if (!is.null(icc) && !nuevo && !is.null(x$design_effect) && !is.null(icc$deff_resultante) &&
      abs(.hojas_ruta_te_num(x$design_effect) - .hojas_ruta_te_num(icc$deff_resultante)) > 1e-6) {
    icc <- NULL
    fuente <- "manual"
  }
  if (identical(fuente, "icc_biblioteca") && is.null(icc)) fuente <- "manual"
  c(list(ocupacion = e, design_effect_fuente = fuente, icc_aplicado = icc),
    hojas_ruta_reparto_base_normalizar(x), hojas_ruta_estrato_normalizar(x), hojas_ruta_ciudades_normalizar(x),
    hojas_ruta_distritos_normalizar(x))  # ADR 0131 §1-§2, §1c
}

# ---------- Visitas y capacidad (ADR 0116 §1) ----------

#' Visitas esperadas para lograr k entrevistas completas: `ceil(k / (r·e))`.
hojas_ruta_visitas_por_ruta <- function(k, r, e = 1) {
  p <- max(1e-6, r * e)
  if (k <= 0) return(0L)
  as.integer(ceiling(k / p))
}

#' Visitas para cubrir el 90 % de las rutas: k más el cuantil de los fracasos de una
#' binomial negativa con probabilidad de éxito r·e; nunca menos que la media.
hojas_ruta_visitas_cap <- function(k, r, e = 1, q = HOJAS_RUTA_VISITAS_CUANTIL) {
  p <- min(1, max(1e-6, r * e))
  if (k <= 0) return(0L)
  if (p >= 1) return(as.integer(k))
  as.integer(max(hojas_ruta_visitas_por_ruta(k, r, e), k + stats::qnbinom(q, size = k, prob = p)))
}

#' Salto sobre visitas: `max(1, floor(V / v))` (el automático del motor divide por k
#' y supone respuesta total).
hojas_ruta_salto_visitas <- function(viviendas, visitas) {
  if (!is.finite(viviendas) || viviendas <= 0 || visitas <= 0) return(1L)
  as.integer(max(1, floor(viviendas / visitas)))
}

#' ¿La manzana alcanza para las visitas que harán falta? Por modo de salto.
hojas_ruta_capacidad_manzana <- function(viviendas, k, r, e = 1, modo = "auto", salto_manual = 1L) {
  v_cap <- hojas_ruta_visitas_cap(k, r, e)
  V <- max(0, .hojas_ruta_te_num(viviendas, 0))
  # v_cap ya cuenta las visitas a viviendas desocupadas (éxito con probabilidad r·e):
  # no se vuelve a dividir entre e (revisión metodológica de U12, A2).
  necesita <- if (identical(modo, "manual")) max(1, as.integer(salto_manual)) * v_cap else v_cap
  list(alcanza = V >= necesita - 1e-9, v_cap = v_cap, necesita = necesita)
}

#' Contactos esperados (`N / r`) y visitas planificadas (`Σ ceil(k_b / (r·e))`).
#' Con un N que no es múltiplo de k, cada distrito tiene rutas de k y una última
#' ruta con el resto.
hojas_ruta_contactos_y_visitas <- function(n_por_distrito, k, r, e = 1) {
  n <- as.numeric(unlist(n_por_distrito, use.names = FALSE))
  n <- n[is.finite(n) & n > 0]
  if (!length(n) || k <= 0) return(list(contactos_esperados = 0, visitas_planificadas = 0L))
  visitas <- sum(vapply(n, function(nd) {
    rutas <- floor(nd / k)
    resto <- nd - rutas * k
    rutas * hojas_ruta_visitas_por_ruta(k, r, e) + (if (resto > 0) hojas_ruta_visitas_por_ruta(resto, r, e) else 0L)
  }, numeric(1)))
  list(contactos_esperados = sum(n) / max(1e-6, r), visitas_planificadas = as.integer(visitas))
}

# ---------- Avisos del tamaño (ADR 0116 §1, §3) ----------

#' Avisos del ADR 0116 sobre el tamaño ya calculado.
hojas_ruta_tamano_extras_avisos <- function(sample_size, k, reemplazos_por_titular) {
  ss <- sample_size %||% list()
  deff <- .hojas_ruta_te_num(ss$design_effect, 1)
  fuente <- as.character(ss$design_effect_fuente %||% "legado")
  r <- .hojas_ruta_te_num(ss$response_rate, 0.9)
  e <- .hojas_ruta_te_num(ss$ocupacion, 1)
  avisos <- list()
  if (k > 1 && fuente %in% c("legado", "por_declarar") && deff <= 1 + 1e-9) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_DEFF_IGNORES_CLUSTERING",
      sprintf("Con %d entrevistas por ruta y DEFF 1, el tamaño ignora el conglomerado: el margen es el de un muestreo aleatorio simple.", as.integer(k))
    )
  }
  if (k > 1 && deff < 1 - 1e-9) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_DEFF_BELOW_ONE", sprintf("Un DEFF de %s con %d entrevistas por ruta supone que el conglomerado mejora la precisión.", format(deff), as.integer(k))
    )
  }
  if (as.integer(reemplazos_por_titular %||% 0L) == 0L) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_UMP_NONRESPONSE_UNCOVERED",
      "Sin reemplazos por titular, una ruta que no se puede trabajar pierde sus entrevistas: considera sumar rutas por la tasa de acceso."
    )
  }
  v <- hojas_ruta_visitas_por_ruta(k, r, e)
  if (k > 0 && v > 5 * k) {
    avisos[[length(avisos) + 1L]] <- .hojas_ruta_te_alerta(
      "W_VISITS_HIGH", sprintf("Con respuesta %s y ocupación %s, cada ruta necesita unas %d visitas para %d entrevistas.", format(r), format(e), v, as.integer(k))
    )
  }
  avisos
}

#' ¿El margen publicado incluye el conglomerado? Si no, se rotula «bajo MAS».
hojas_ruta_margen_incluye_conglomerado <- function(sample_size, k) {
  !(k > 1 && .hojas_ruta_te_num(sample_size$design_effect, 1) <= 1 + 1e-9)
}

# ---------- Biblioteca de ICC (ADR 0116 §2) ----------

#' Una entrada de la biblioteca es aplicable a Hojas de ruta si es de la misma
#' unidad (ruta) y escala (proporción), con ICC en (0, 1] y conglomerados declarados.
hojas_ruta_icc_validar <- function(entrada) {
  if (is.null(entrada) || !is.list(entrada)) return(list(ok = FALSE, motivo = "No es una entrada de la biblioteca."))
  icc <- .hojas_ruta_te_num(entrada$icc)
  conglomerados <- .hojas_ruta_te_num(entrada$conglomerados)
  unidad <- as.character(entrada$unidad_conglomerado %||% "")[1]
  escala <- as.character(entrada$escala %||% "")[1]
  if (!nzchar(unidad) || is.na(conglomerados)) return(list(ok = FALSE, motivo = "Le falta la unidad de conglomeración o el número de conglomerados."))
  if (!identical(unidad, "ruta")) return(list(ok = FALSE, motivo = sprintf("Se midió con «%s» como conglomerado; Hojas de ruta conglomera por ruta.", unidad)))
  if (!identical(escala, "proporcion")) return(list(ok = FALSE, motivo = "Se midió sobre un indicador que no es una proporción."))
  if (is.na(icc) || icc <= 0 || icc > 1) return(list(ok = FALSE, motivo = "El ICC no está entre 0 y 1: se muestra, pero no se aplica."))
  avisos <- list()
  ic <- suppressWarnings(as.numeric(unlist(entrada$icc_ic95 %||% list(), use.names = FALSE)))
  ancho <- if (length(ic) == 2L && all(is.finite(ic))) abs(diff(ic)) else NA_real_
  if (conglomerados < HOJAS_RUTA_ICC_MIN_CONGLOMERADOS || (!is.na(ancho) && ancho > icc)) {
    avisos[[1]] <- .hojas_ruta_te_alerta(
      "W_ICC_FEW_CLUSTERS",
      sprintf("El ICC de «%s» viene de %d conglomerados%s: es una estimación poco estable.", as.character(entrada$id %||% "?"), as.integer(conglomerados), if (!is.na(ancho) && ancho > icc) " y su intervalo es más ancho que el propio ICC" else "")
    )
  }
  list(ok = TRUE, motivo = "", avisos = avisos)
}

#' Aplica un ICC de la biblioteca: DEFF = 1 + (k − 1)·ICC con el k de la ruta nueva.
#' La entrada se copia en `icc_aplicado` para reconstruir el DEFF sin la biblioteca.
#' Los overrides por distrito prevalecen y se devuelven marcados.
hojas_ruta_icc_aplicar <- function(sample_size, entrada, k) {
  v <- hojas_ruta_icc_validar(entrada)
  if (!isTRUE(v$ok)) return(list(ok = FALSE, sample_size = sample_size, motivo = v$motivo, avisos = list()))
  k <- max(1L, as.integer(k))
  deff <- round(1 + (k - 1) * .hojas_ruta_te_num(entrada$icc), 4)
  ss <- sample_size
  ss$design_effect <- deff
  ss$design_effect_fuente <- "icc_biblioteca"
  ss$icc_aplicado <- c(entrada, list(k_ruta = k, deff_resultante = deff))
  list(ok = TRUE, sample_size = ss, motivo = "", avisos = v$avisos %||% list(),
       distritos_con_override = names(sample_size$design_effect_overrides %||% list()))
}

# PROSECNUR_HOJAS_RUTA_ICC redirige la biblioteca (los tests no tocan la del usuario).
hojas_ruta_icc_biblioteca_ruta <- function() {
  otra <- Sys.getenv("PROSECNUR_HOJAS_RUTA_ICC", "")
  if (nzchar(otra)) return(otra)
  file.path(tools::R_user_dir("prosecnur", "data"), "hojas_ruta", "icc.json")
}

#' Lee la biblioteca local de ICC; vacía si no existe o no se puede leer.
hojas_ruta_icc_biblioteca_leer <- function(ruta = hojas_ruta_icc_biblioteca_ruta()) {
  if (!file.exists(ruta)) return(list())
  x <- tryCatch(jsonlite::fromJSON(ruta, simplifyVector = FALSE), error = function(e) list())
  if (!is.list(x)) list() else Filter(is.list, x)
}

#' Agrega o reemplaza (por id) una entrada de la biblioteca.
hojas_ruta_icc_biblioteca_guardar <- function(entrada, ruta = hojas_ruta_icc_biblioteca_ruta()) {
  id <- as.character(entrada$id %||% "")[1]
  if (!nzchar(id)) stop_api(400, "E_BAD_REQUEST", "La entrada del ICC necesita un id.")
  actuales <- Filter(function(e) !identical(as.character(e$id %||% ""), id), hojas_ruta_icc_biblioteca_leer(ruta))
  dir.create(dirname(ruta), recursive = TRUE, showWarnings = FALSE)
  writeLines(as.character(jsonlite::toJSON(c(actuales, list(entrada)), auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE)), ruta, useBytes = TRUE)
  invisible(c(actuales, list(entrada)))
}

#' A1: con un ICC aplicado, el DEFF sigue al k actual de la ruta. Si k cambió desde
#' que se aplicó, se recalcula `1 + (k − 1)·ICC` y se actualiza la copia.
hojas_ruta_icc_reconciliar <- function(sample_size, k) {
  icc <- sample_size$icc_aplicado
  if (!identical(sample_size$design_effect_fuente, "icc_biblioteca") || is.null(icc)) return(sample_size)
  k <- max(1L, as.integer(k))
  if (identical(as.integer(icc$k_ruta %||% NA_integer_), k)) return(sample_size)
  deff <- round(1 + (k - 1) * .hojas_ruta_te_num(icc$icc), 4)
  sample_size$design_effect <- deff
  sample_size$icc_aplicado$k_ruta <- k
  sample_size$icc_aplicado$deff_resultante <- deff
  sample_size
}

# ---------- Posproceso del tamaño (router /sample-size-preview) ----------

#' Agrega al resultado de `hojas_ruta_sample_size_preview` lo del ADR 0116 sin tocar
#' el motor: visitas por ruta y su tope, contactos esperados y visitas planificadas,
#' procedencia del DEFF, si el margen incluye el conglomerado y los avisos.
#' `contacts_suggested` se conserva tal cual para sus lectores actuales.
hojas_ruta_tamano_extras_completar <- function(resultado, config) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  ss <- cfg$sample_size
  k <- .hojas_ruta_route_size(cfg)
  r <- as.numeric(ss$response_rate)
  e <- as.numeric(ss$ocupacion %||% 1)
  n_por_distrito <- vapply(resultado$district_rows %||% list(), function(f) as.numeric(f$n_used %||% 0), numeric(1))
  cv <- hojas_ruta_contactos_y_visitas(n_por_distrito, k, r, e)
  resultado$visitas <- list(
    entrevistas_por_ruta = as.integer(k),
    respuesta = r,
    ocupacion = e,
    por_ruta = hojas_ruta_visitas_por_ruta(k, r, e),
    tope_90 = hojas_ruta_visitas_cap(k, r, e),
    contactos_esperados = cv$contactos_esperados,
    visitas_planificadas = cv$visitas_planificadas
  )
  resultado$design_effect_fuente <- ss$design_effect_fuente
  resultado$icc_aplicado <- ss$icc_aplicado
  resultado$margen_incluye_conglomerado <- hojas_ruta_margen_incluye_conglomerado(ss, k)
  vistos <- vapply(resultado$alerts %||% list(), function(a) as.character(a$code %||% ""), character(1))
  for (a in hojas_ruta_tamano_extras_avisos(ss, k, cfg$replacements_per_titular)) {
    if (!a$code %in% vistos) resultado$alerts <- c(resultado$alerts %||% list(), list(a))
  }
  resultado
}

# ---------- Salto sobre visitas en la muestra (ADR 0116 §1) ----------

# Protocolo único ante la no respuesta (ADR 0116 §1): lo imprimen la ficha de la
# UMP y la hoja del día. Formal pero llano —lo lee cualquier encuestador, no un
# estadístico—: nada de «salto sistemático» ni «elegible». Una oración por paso.
HOJAS_RUTA_REGLA_NO_RESPUESTA <- paste(
  "Si en la vivienda no responden, está desocupada o no vive nadie del perfil del estudio, pase a la siguiente que indica el salto.",
  "Si termina la vuelta a la manzana sin completar la cuota, dé una segunda vuelta por las viviendas que no visitó.",
  "Si aún falta completar la cuota, continúe en las manzanas aledañas (las de al lado), en el orden del esquema (1 a 8), con el mismo sentido y el mismo salto."
)

# F31: lo que la ficha y la hoja de zona dicen de una manzana con 0 viviendas en el censo.
HOJAS_RUTA_AVISO_SIN_VIVIENDAS <- "El censo no registra viviendas en esta manzana: si no encuentra hogares, siga el paso 3."

#' La misma regla sin salto (checklist F38): con el salto deshabilitado la ficha dice
#' «Constante de salto: deshabilitada», y la regla no puede mandar a «la siguiente
#' que indica el salto».
hojas_ruta_regla_no_respuesta <- function(sin_salto = FALSE) {
  if (!isTRUE(sin_salto)) return(HOJAS_RUTA_REGLA_NO_RESPUESTA)
  paste(
    "Si en la vivienda no responden, está desocupada o no vive nadie del perfil del estudio, pase a la vivienda siguiente.",
    "Si termina la vuelta a la manzana sin completar la cuota, dé una segunda vuelta por las viviendas que no visitó.",
    "Si aún falta completar la cuota, continúe en las manzanas aledañas (las de al lado), en el orden del esquema (1 a 8), con el mismo sentido."
  )
}

# Recalcula el salto de una tabla de manzanas sobre visitas, con la misma semilla y
# los mismos cubos estables que el motor para la vivienda de inicio.
.hojas_ruta_te_salto_tabla <- function(tabla, cfg, r, e) {
  bloques <- .hojas_ruta_rows_df(tabla %||% list())
  if (!nrow(bloques)) return(tabla)
  modo <- as.character(cfg$route_jump_mode %||% "auto")
  seed <- as.integer(cfg$seed %||% 2017L)
  filas <- lapply(seq_len(nrow(bloques)), function(i) {
    b <- as.list(bloques[i, , drop = FALSE])
    b[] <- lapply(b, function(x) x[[1]])
    k <- max(1L, suppressWarnings(as.integer(b$entrevistas %||% cfg$entrevistas_por_manzana %||% 1L)), na.rm = TRUE)
    V <- max(0L, suppressWarnings(as.integer(b$viviendas %||% 0L)), na.rm = TRUE)
    v <- hojas_ruta_visitas_por_ruta(k, r, e)
    b$visitas_esperadas <- v
    b$regla_no_respuesta <- hojas_ruta_regla_no_respuesta(identical(modo, "off"))
    if (identical(modo, "auto")) {
      raw <- if (v > 0) V / v else NA_real_
      constante <- max(1L, as.integer(floor(raw)))
      if (!is.finite(constante) || is.na(constante)) constante <- 1L
      id <- as.character(b$id_manzana %||% b$manzana %||% b$orden_seleccion %||% "")
      inicio <- if (constante > 1L) .hojas_ruta_stable_bucket(seed, id, "start_dwelling", constante) else 1L
      b$constante_salto <- constante
      b$salto_operativo <- constante
      b$constante_salto_raw <- raw
      b$constante_salto_formula <- sprintf("K=%s/%s visitas (v = ceil(%s/(%s·%s))); operativo=floor(K)", V, v, k, format(r), format(e))
      b$vivienda_inicio <- as.integer(inicio)
      b$domicilio_inicio <- as.integer(inicio)
      b$modo_seleccion_vivienda <- if (V <= v || constante <= 1L) "Barrido completo" else "Sistematico por casa/domicilio"
    }
    b
  })
  filas
}

#' El salto automático de la muestra se calcula sobre visitas, `floor(V / v)` con
#' `v = ceil(k / (r·e))`, en vez de `floor(V / k)` del motor, que supone respuesta total.
#' Cada manzana lleva además sus visitas esperadas y la regla ante la no respuesta, que
#' la hoja de ruta imprime. Titulares y reemplazos.
hojas_ruta_tamano_extras_salto_muestra <- function(resultado, config) {
  cfg <- hojas_ruta_integrada_normalize_config(config)
  r <- as.numeric(cfg$sample_size$response_rate %||% 0.9)
  e <- as.numeric(cfg$sample_size$ocupacion %||% 1)
  resultado$blocks <- .hojas_ruta_te_salto_tabla(resultado$blocks, cfg, r, e)
  resultado$replacement_blocks <- .hojas_ruta_te_salto_tabla(resultado$replacement_blocks, cfg, r, e)
  resultado$salto_sobre_visitas <- list(respuesta = r, ocupacion = e, modo = as.character(cfg$route_jump_mode %||% "auto"))
  resultado
}

#' Valores operativos de una ruta para las salidas (Excel, ZIP, hojas de reemplazo):
#' los del motor (esquina, sentido, inicio) con el salto automático sobre VISITAS
#' (ADR 0116 §1), igual que el que muestra el sorteo. El motor congelado lo llama
#' desde `.hojas_ruta_add_operational_values`; antes imprimía `floor(V / k)`.
hojas_ruta_valores_operativos <- function(block, config = list()) {
  vals <- .hojas_ruta_route_operational_values(block, config)
  cfg <- if (is.list(config)) config else list()
  ss <- if (is.list(cfg$sample_size)) cfg$sample_size else hojas_ruta_integrada_normalize_config(cfg)$sample_size
  r <- suppressWarnings(as.numeric(ss$response_rate %||% 0.9)[1]); if (is.na(r) || r <= 0) r <- 0.9
  e <- suppressWarnings(as.numeric(ss$ocupacion %||% 1)[1]); if (is.na(e) || e <= 0) e <- 1
  k <- max(1L, suppressWarnings(as.integer(block$entrevistas %||% cfg$entrevistas_por_manzana %||% 1L)), na.rm = TRUE)
  V <- max(0L, suppressWarnings(as.integer(block$viviendas %||% 0L)), na.rm = TRUE)
  v <- as.integer(hojas_ruta_visitas_por_ruta(k, r, e))
  vals$visitas_esperadas <- v
  vals$regla_no_respuesta <- HOJAS_RUTA_REGLA_NO_RESPUESTA
  if (identical(vals$constante_salto_modo, "auto")) {
    raw <- if (v > 0) V / v else NA_real_
    constante <- if (is.finite(raw)) max(1L, as.integer(floor(raw))) else 1L
    seed <- as.integer(cfg$seed %||% 2017L)
    id <- as.character(block$id_manzana %||% block$manzana %||% block$orden_seleccion %||% "")
    inicio <- if (constante > 1L) .hojas_ruta_stable_bucket(seed, id, "start_dwelling", constante) else 1L
    vals$constante_salto <- as.integer(constante)
    vals$salto_operativo <- as.integer(constante)
    vals$constante_salto_raw <- as.numeric(raw)
    vals$constante_salto_formula <- sprintf("K=%s/%s visitas (v = ceil(%s/(%s·%s))); operativo=floor(K)", V, v, k, format(r), format(e))
    vals$vivienda_inicio <- as.integer(inicio)
    vals$domicilio_inicio <- as.integer(inicio)
    vals$modo_seleccion_vivienda <- if (V <= v || constante <= 1L) "Barrido completo" else "Sistematico por casa/domicilio"
  }
  vals
}
