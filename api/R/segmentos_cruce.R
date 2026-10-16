# Segmentos de cruce del estudio (ADR 0107)
# =========================================
#
# El estudio declara una vez sus segmentos de cruce (clave, nombre estándar
# `cruce_<clave>`, etiqueta y escala estándar) y cada base dice de dónde sale
# cada uno: una variable de origen y el mapa de sus códigos a la escala.
#
# DÓNDE VIVE. `s$estudio$segmentos_cruce`, una lista nombrada por clave. No en
# la declaración de equivalencias: `.equiv_guardar_declaracion` reconstruye esa
# declaración desde cero en cada guardado del editor, y el segmento es la
# FUENTE de la que salen dos cosas derivadas —la variable calculada de cada
# base y la fila de la matriz—, así que vive al lado de las bases, que es lo que
# el ADR llama «del estudio». El estado de sesión entero viaja en el `.pulso`.
#
# QUÉ MATERIALIZA. Por cada base con origen, la variable calculada
# `cruce_<clave>` (regla `recodificar` del ADR 0106, guardada con
# `base_variables_guardar_calculada` y marcada `segmento = <clave>`), y una
# sola fila de la matriz con `id = "SEG-<clave>"`, `cruce = TRUE` y armonización
# identidad sobre la escala estándar en las bases con origen.
#
# MAPA. `{ código de origen: código de la escala }`. Un destino vacío ("" o
# null) es «explícitamente sin dato»: cuenta como declarado para el estado pero
# no entra al mapa de la calculada (queda NA). Un mapa vacío es identidad sobre
# los códigos de la escala.
#
# ESTADO por base: `definido` (origen y todo código observado del origen con
# destino o sin dato explícito), `incompleto` (códigos observados sin declarar;
# `n_sin_mapa` son sus casos, sin ponderar) y `sin_origen`.
#
# Este archivo es servicio de sesión; el router (`router_segmentos.R`) sólo lo
# llama.

.SEGMENTOS_SECCION <- "Segmentos de cruce"
.SEGMENTOS_ID_PREFIJO <- "SEG-"

.segmentos_chr <- function(x) .equiv_armon_chr(x, "")

#' Normaliza la clave de un segmento: minúsculas, sin tildes, `[a-z0-9_]`.
#'
#' Un prefijo `cruce_` tecleado se quita para no producir `cruce_cruce_sexo`.
#' @return clave normalizada ("" si no queda nada).
#' @keywords internal
segmentos_normalizar_clave <- function(x) {
  # «ñ» se translitera a «ni» antes de quitar tildes: «años» no puede quedar «anos».
  x <- gsub("[\u00f1\u00d1]", "ni", .segmentos_chr(x))
  k <- gsub(" ", "_", .bases_norm_text(x), fixed = TRUE)
  k <- sub("^cruce_+", "", k)
  if (is.na(k)) "" else k
}

.segmentos_nombre <- function(clave) paste0("cruce_", clave)
.segmentos_fila_id <- function(clave) paste0(.SEGMENTOS_ID_PREFIJO, clave)

.segmentos_lista <- function(s) {
  segs <- (((s %||% list())$estudio %||% list())$segmentos_cruce) %||% list()
  if (!is.list(segs)) list() else segs
}

.segmentos_bases <- function(s) names(((s %||% list())$estudio %||% list())$bases %||% list())

# --- Validación ----------------------------------------------------------------

.segmentos_validar_escala <- function(escala) {
  if (is.null(escala) || !length(escala)) {
    stop_api(422, "E_SEGMENTO_ESCALA_VACIA",
             "El segmento necesita su escala estándar: al menos un código con su etiqueta.")
  }
  if (!is.list(escala)) {
    stop_api(422, "E_SEGMENTO_ESCALA_INVALIDA", "'escala' debe ser una lista de { codigo, etiqueta }.")
  }
  out <- lapply(escala, function(e) {
    if (!is.list(e)) {
      stop_api(422, "E_SEGMENTO_ESCALA_INVALIDA", "Cada categoría de la escala es { codigo, etiqueta }.")
    }
    codigo <- .codif_agrupar_codigo_chr(.segmentos_chr(e$codigo))
    if (is.na(codigo) || !nzchar(codigo) || !grepl(.EQUIV_ARMON_CODIGO_RE, codigo)) {
      stop_api(422, "E_SEGMENTO_ESCALA_INVALIDA", sprintf(
        "El código «%s» de la escala no es válido: usa letras, dígitos, «_», «.» o «-».",
        .segmentos_chr(e$codigo)), list(codigo = .segmentos_chr(e$codigo)))
    }
    etiqueta <- .segmentos_chr(e$etiqueta)
    list(codigo = codigo, etiqueta = if (nzchar(etiqueta)) etiqueta else codigo)
  })
  codigos <- vapply(out, `[[`, character(1), "codigo")
  if (anyDuplicated(codigos)) {
    dup <- codigos[duplicated(codigos)][[1]]
    stop_api(422, "E_SEGMENTO_ESCALA_INVALIDA", sprintf("El código «%s» se repite en la escala.", dup),
             list(codigo = dup))
  }
  out
}

# Mapa de una base: claves normalizadas como código, destino de la escala o ""
# (sin dato explícito). Vacío = identidad sobre la escala.
.segmentos_validar_mapa <- function(mapa, codigos_escala, base, clave) {
  if (is.null(mapa) || !length(mapa)) {
    return(as.list(stats::setNames(codigos_escala, codigos_escala)))
  }
  if (!is.list(mapa) || is.null(names(mapa))) {
    stop_api(422, "E_SEGMENTO_MAPA_INVALIDO", sprintf(
      "El mapa de «%s» en la base «%s» debe ser { código de origen: código de la escala }.", clave, base),
      list(base = base))
  }
  out <- list()
  for (k in names(mapa)) {
    origen <- .codif_agrupar_codigo_chr(trimws(k))
    if (is.na(origen) || !nzchar(origen)) {
      stop_api(422, "E_SEGMENTO_MAPA_INVALIDO", sprintf(
        "El mapa de «%s» en la base «%s» trae un código de origen vacío.", clave, base), list(base = base))
    }
    destino <- .segmentos_chr(mapa[[k]])
    if (nzchar(destino)) destino <- .codif_agrupar_codigo_chr(destino)
    if (nzchar(destino) && !(destino %in% codigos_escala)) {
      stop_api(422, "E_SEGMENTO_MAPA_FUERA_DE_ESCALA", sprintf(
        "El mapa de «%s» en la base «%s» lleva el código %s a «%s», que no está en la escala.",
        clave, base, origen, destino), list(base = base, origen = origen, destino = destino))
    }
    if (!is.null(out[[origen]]) && !identical(out[[origen]], destino)) {
      stop_api(422, "E_SEGMENTO_MAPA_INVALIDO", sprintf(
        "El mapa de «%s» en la base «%s» lleva el código %s a dos destinos.", clave, base, origen),
        list(base = base, origen = origen))
    }
    out[[origen]] <- destino
  }
  if (!any(nzchar(unlist(out)))) {
    stop_api(422, "E_SEGMENTO_MAPA_INVALIDO", sprintf(
      "El mapa de «%s» en la base «%s» no lleva ningún código a la escala.", clave, base),
      list(base = base))
  }
  out
}

# Nombres que `cruce_<clave>` no puede tomar en una base: preguntas del
# instrumento original, columnas de la data, columnas declaradas y calculadas
# que no son de este segmento.
.segmentos_ocupados <- function(par, meta, clave) {
  propias <- vapply(meta[["variables_propias"]] %||% list(),
                    function(p) .origen_externo_chr(p[["name"]]), character(1))
  calcs <- meta[["variables_calculadas"]] %||% list()
  ajenas <- vapply(Filter(function(cv) !identical(.segmentos_chr(cv[["segmento"]]), clave), calcs),
                   function(cv) .origen_externo_chr(cv[["nombre"]]), character(1))
  unique(c(.base_variables_nombres_instrumento(par$inst), names(par$data), propias, ajenas))
}

.segmentos_plano <- function(x) gsub("[^a-z0-9]", "", tolower(as.character(x)))

#' Normaliza y valida un segmento contra el estudio.
#'
#' Lee el par original de CADA base (el choque de nombre se mira en todas,
#' tengan origen o no). Valida todo antes de escribir nada.
#' @return list(segmento, pares) con el segmento listo para guardar.
#' @keywords internal
segmentos_validar <- function(sid, cuerpo) {
  s <- session_get(sid)
  cuerpo <- cuerpo %||% list()
  clave <- segmentos_normalizar_clave(cuerpo$clave)
  if (!nzchar(clave)) {
    stop_api(400, "E_SEGMENTO_CLAVE_INVALIDA", sprintf(
      "«%s» no sirve como clave de segmento: usa letras o dígitos (p. ej. «sexo», «edad»).",
      .segmentos_chr(cuerpo$clave)))
  }
  nombre <- .segmentos_nombre(clave)
  fila_id <- .segmentos_fila_id(clave)
  ajena <- Filter(function(f) identical(.segmentos_chr(f$id), fila_id) && !isTRUE(f$cruce),
                  ((s$equivalencias_publicos %||% list())$filas %||% list()))
  if (length(ajena)) {
    stop_api(409, "E_SEGMENTO_CLAVE_DUPLICADA", sprintf(
      "La matriz ya tiene una fila «%s» que no es de un segmento: elige otra clave.", fila_id),
      list(clave = clave, fila = fila_id))
  }
  escala <- .segmentos_validar_escala(cuerpo$escala)
  codigos <- vapply(escala, `[[`, character(1), "codigo")
  etiqueta <- .segmentos_chr(cuerpo$etiqueta)

  bases <- .segmentos_bases(s)
  pb_in <- cuerpo$por_base %||% list()
  if (length(pb_in) && (!is.list(pb_in) || is.null(names(pb_in)))) {
    stop_api(400, "E_BAD_REQUEST", "'por_base' debe ser un objeto { <base>: { origen, mapa } }.")
  }
  fuera <- setdiff(names(pb_in), bases)
  if (length(fuera)) {
    stop_api(422, "E_SEGMENTO_BASE_INEXISTENTE", sprintf(
      "La base «%s» no existe en el estudio.", fuera[[1]]), list(base = fuera[[1]], bases = as.list(bases)))
  }

  pares <- list()
  por_base <- list()
  for (b in bases) {
    pares[[b]] <- .segmentos_par_con_calculadas(s, b, clave)
    ocupados <- .segmentos_ocupados(pares[[b]], s$estudio$bases[[b]], clave)
    if (.segmentos_plano(nombre) %in% .segmentos_plano(ocupados)) {
      stop_api(409, "E_SEGMENTO_NOMBRE_OCUPADO", sprintf(
        "«%s» ya existe en la base «%s» (pregunta, columna o variable de la base): elige otra clave.",
        nombre, b), list(base = b, nombre = nombre))
    }
    e <- pb_in[[b]] %||% list()
    origen <- .segmentos_chr(if (is.list(e)) e$origen else NULL)
    if (!nzchar(origen)) next
    if (!(origen %in% names(pares[[b]]$data))) {
      stop_api(422, "E_SEGMENTO_ORIGEN_INEXISTENTE", sprintf(
        "La base «%s» no trae una variable «%s» de la que sacar el segmento.", b, origen),
        list(base = b, origen = origen))
    }
    por_base[[b]] <- list(origen = origen, mapa = .segmentos_validar_mapa(e$mapa, codigos, b, clave))
  }
  list(
    segmento = list(clave = clave, nombre = nombre,
                    etiqueta = if (nzchar(etiqueta)) etiqueta else clave,
                    nota = trimws(.segmentos_chr(cuerpo$nota)),
                    escala = escala, por_base = por_base),
    pares = pares
  )
}

# --- Materialización -------------------------------------------------------------

# Calculada del ADR 0106 que sale de una entrada por base del segmento.
.segmentos_calculada <- function(seg, entrada) {
  mapa <- entrada$mapa %||% list()
  list(nombre = seg$nombre, etiqueta = seg$etiqueta, regla = "recodificar",
       variables = list(entrada$origen), mapa = mapa[nzchar(unlist(mapa))], escala = seg$escala)
}

.segmentos_calculada_propia <- function(meta, seg) {
  any(vapply(meta[["variables_calculadas"]] %||% list(), function(cv) {
    identical(.segmentos_chr(cv[["segmento"]]), seg$clave) &&
      identical(.origen_externo_chr(cv[["nombre"]]), seg$nombre)
  }, logical(1)))
}

# Fila de la matriz del segmento (NULL si ninguna base tiene origen).
.segmentos_fila <- function(seg) {
  bases <- names(seg$por_base %||% list())
  if (!length(bases)) return(NULL)
  vars <- stats::setNames(as.list(rep(seg$nombre, length(bases))), bases)
  por_base <- stats::setNames(lapply(bases, function(b) list(
    comparable = TRUE, mapa = .equiv_armon_mapa_vacio())), bases)
  list(seccion = .SEGMENTOS_SECCION, etiqueta_estandar = seg$etiqueta, variables = vars,
       id = .segmentos_fila_id(seg$clave), cruce = TRUE,
       armonizacion = list(escala = seg$escala, por_base = por_base))
}

# Reescribe la matriz con la fila del segmento puesta (o quitada si `fila` es
# NULL), en su lugar si ya estaba. Pasa por `.equiv_guardar_declaracion`: la
# misma normalización, sellos y etiquetas por base que el editor.
.segmentos_escribir_fila <- function(sid, clave, fila) {
  equiv <- (session_get(sid) %||% list())$equivalencias_publicos
  filas <- (equiv %||% list())$filas %||% list()
  if (is.null(equiv) && is.null(fila)) return(invisible(FALSE))
  id <- .segmentos_fila_id(clave)
  i <- which(vapply(filas, function(f) identical(.segmentos_chr(f$id), id), logical(1)))
  if (length(i)) {
    if (is.null(fila)) filas <- filas[-i] else filas[[i[[1]]]] <- fila
  } else if (!is.null(fila)) {
    filas[[length(filas) + 1L]] <- fila
  } else {
    return(invisible(FALSE))
  }
  .equiv_guardar_declaracion(sid, filas, NULL)
  invisible(TRUE)
}

.segmentos_escribir_estudio <- function(sid, clave, seg) {
  s <- session_get(sid)
  segs <- .segmentos_lista(s)
  segs[[clave]] <- seg
  s$estudio$segmentos_cruce <- segs
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  invisible(TRUE)
}

#' Crea o reemplaza un segmento (por clave) y lo materializa en cada base.
#' @return el mismo payload que `segmentos_consultar()`.
#' @keywords internal
segmentos_guardar <- function(sid, cuerpo) {
  .equiv_requiere_disponible(sid)
  v <- segmentos_validar(sid, cuerpo)
  seg <- v$segmento
  for (b in names(v$pares)) {
    entrada <- seg$por_base[[b]]
    if (!is.null(entrada)) {
      base_variables_guardar_calculada(sid, b, .segmentos_calculada(seg, entrada),
                                       marca = list(segmento = seg$clave))
    } else if (.segmentos_calculada_propia(session_get(sid)$estudio$bases[[b]], seg)) {
      base_variables_quitar_calculada(sid, b, seg$nombre)
    }
  }
  .segmentos_escribir_estudio(sid, seg$clave, seg)
  .segmentos_escribir_fila(sid, seg$clave, .segmentos_fila(seg))
  segmentos_consultar(sid)
}

#' Quita un segmento, sus variables calculadas y su fila de la matriz.
#' @keywords internal
segmentos_quitar <- function(sid, clave) {
  .equiv_requiere_disponible(sid)
  s <- session_get(sid)
  k <- segmentos_normalizar_clave(clave)
  seg <- .segmentos_lista(s)[[k]]
  if (!nzchar(k) || is.null(seg)) {
    stop_api(404, "E_SEGMENTO_NO_ENCONTRADO", sprintf(
      "El estudio no tiene un segmento de cruce «%s».", .segmentos_chr(clave)), list(clave = k))
  }
  for (b in .segmentos_bases(s)) {
    if (.segmentos_calculada_propia(s$estudio$bases[[b]], seg)) {
      base_variables_quitar_calculada(sid, b, seg$nombre)
    }
  }
  s <- session_get(sid)
  segs <- .segmentos_lista(s)
  segs[[k]] <- NULL
  s$estudio$segmentos_cruce <- segs
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  .segmentos_escribir_fila(sid, k, NULL)
  segmentos_consultar(sid)
}

# --- Estado ----------------------------------------------------------------------

# El par original de la base con sus variables calculadas puestas: un segmento
# puede salir de una calculada (una fórmula como «2026 - P8», luego en rangos).
# Sin las calculadas de segmentos (ni la suya ni las de otros): un segmento no
# sale de otro.
.segmentos_par_con_calculadas <- function(s, base, clave) {
  par <- .base_variables_par_original(s, base)
  meta <- s$estudio$bases[[base]] %||% list()
  propias <- Filter(function(cv) !nzchar(.segmentos_chr(cv[["segmento"]])), meta[["variables_calculadas"]] %||% list())
  if (length(propias)) {
    # Asignación directa y no `modifyList`: con una lista sin nombres no
    # reemplaza nada y se materializarían también las de los segmentos.
    meta$variables_calculadas <- propias
    par$data <- base_variables_materializar(par$data, meta)
  }
  par
}

# Data de una base para mirar los códigos observados del origen: la fuente de
# runtime si la trae y, si no (base hermana no cargada), el par original.
.segmentos_data_base <- function(sid, s, base, origen) {
  df <- (s$rp_data_sources %||% list())[[base]]
  if (is.data.frame(df) && origen %in% names(df)) return(df)
  tryCatch(.segmentos_par_con_calculadas(s, base, "")$data, api_error = function(e) {
    # Una base sin par legible no tumba el estado de todo el estudio: su
    # segmento se informa sin origen (`origen_ausente`) y el motivo va a stderr.
    message(sprintf("[segmentos] base «%s» sin data legible: %s", base, conditionMessage(e)))
    NULL
  })
}

.segmentos_estado_base <- function(entrada, df) {
  vacio <- list(origen = "", mapa = .equiv_armon_mapa_vacio(), estado = "sin_origen",
                n_sin_mapa = 0L, codigos_sin_mapa = list())
  if (is.null(entrada) || !nzchar(.segmentos_chr(entrada$origen))) return(vacio)
  mapa <- entrada$mapa %||% list()
  out <- list(origen = entrada$origen,
              mapa = if (length(mapa)) mapa else .equiv_armon_mapa_vacio())
  if (!is.data.frame(df) || !(entrada$origen %in% names(df))) {
    return(c(out, list(estado = "sin_origen", n_sin_mapa = 0L, codigos_sin_mapa = list(),
                       origen_ausente = TRUE)))
  }
  obs <- .codif_agrupar_codigo_chr(df[[entrada$origen]])
  faltan <- setdiff(unique(obs[!is.na(obs)]), names(mapa))
  faltan <- .equiv_armon_orden_codigos(faltan)
  c(out, list(estado = if (length(faltan)) "incompleto" else "definido",
              n_sin_mapa = as.integer(sum(!is.na(obs) & obs %in% faltan)),
              codigos_sin_mapa = as.list(faltan)))
}

#' Segmentos del estudio con su estado por base (contrato GET del ADR 0107).
#' @keywords internal
segmentos_consultar <- function(sid) {
  s <- session_get(sid)
  bases <- .segmentos_bases(s)
  ids <- vapply(((s$equivalencias_publicos %||% list())$filas %||% list()),
                function(f) .segmentos_chr(f$id), character(1))
  segs <- lapply(unname(.segmentos_lista(s)), function(seg) {
    por_base <- stats::setNames(lapply(bases, function(b) {
      entrada <- (seg$por_base %||% list())[[b]]
      df <- if (is.null(entrada)) NULL else .segmentos_data_base(sid, s, b, entrada$origen)
      .segmentos_estado_base(entrada, df)
    }), bases)
    fila_id <- .segmentos_fila_id(seg$clave)
    list(clave = seg$clave, nombre = seg$nombre, etiqueta = seg$etiqueta,
         nota = .segmentos_chr(seg$nota), escala = seg$escala,
         por_base = if (length(por_base)) por_base else .equiv_armon_mapa_vacio(),
         fila_ref = if (fila_id %in% ids) fila_id else "")
  })
  list(disponible = .equiv_disponible(sid), bases = as.list(bases), segmentos = segs)
}

# --- Consumidores ------------------------------------------------------------------

#' Notas al pie de los segmentos usados como cruce, en el orden de los cruces.
#'
#' Un segmento puede declarar una nota (p. ej. la pregunta original de la que
#' sale, cuando su rótulo la abrevia). Toda tabla cruzada por ese segmento la
#' lleva al pie: el comparativo de cruces la agrega a sus notas generales.
#' @param cruces_refs ids `SEG-*`, índices o etiquetas de las filas de cruce.
#' @keywords internal
segmentos_notas_de_cruces <- function(sid, cruces_refs) {
  s <- session_get(sid, required = FALSE) %||% list()
  equiv <- s$equivalencias_publicos %||% list()
  segs <- .segmentos_lista(s)
  if (!length(segs)) return(character(0))
  notas <- vapply(.armz_refs(cruces_refs), function(r) {
    f <- tryCatch(.equiv_armon_resolver_fila(equiv, r), api_error = function(e) NULL)
    id <- .segmentos_chr((f %||% list())$id)
    seg <- Filter(function(x) identical(.segmentos_fila_id(x$clave), id), segs)
    if (length(seg)) trimws(.segmentos_chr(seg[[1]]$nota)) else ""
  }, character(1))
  unique(notas[nzchar(notas)])
}

# ¿La fila se armoniza en al menos dos bases de la serie? Un cruce que sólo
# existe en una medición no compara nada: sale «n.c.» en las demás.
.segmentos_comparable_en_serie <- function(f, periodos) {
  sum(vapply(periodos, function(b) !is.null(.equiv_armon_spec(f, b)), logical(1))) >= 2L
}

#' Referencias (`id`) de las filas de la matriz marcadas como cruce,
#' armonizadas y comparables en al menos dos bases de la serie: el cruce por
#' defecto de los comparativos (ADR 0107, punto 5 y Notas).
#' @keywords internal
segmentos_cruces_por_defecto <- function(sid) {
  equiv <- ((session_get(sid, required = FALSE) %||% list())$equivalencias_publicos) %||% list()
  filas <- equiv$filas %||% list()
  periodos <- .armz_periodos_estudio(sid, equiv)
  refs <- character(0)
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (!isTRUE(f$cruce) || is.null(f$armonizacion)) next
    if (!.segmentos_comparable_en_serie(f, periodos)) next
    id <- .segmentos_chr(f$id)
    refs <- c(refs, if (nzchar(id)) id else as.character(i - 1L))
  }
  refs
}

#' Conserva la marca `cruce` de la declaración previa en las filas que no
#' traen el campo (un editor que no lo conoce no la borra). Casa por `id` y, si
#' no, por el juego de variables; en ese caso devuelve también el `id` SEG-*,
#' que es por el que el segmento encuentra su fila (sin él, el siguiente
#' guardado del segmento la duplicaría). Una fila que manda `cruce = false` la
#' quita.
#' @param solo_ausentes Lógico por fila: TRUE si la fila no declaró `cruce`.
#' @keywords internal
segmentos_conservar_marca <- function(filas, previo, solo_ausentes) {
  prev <- Filter(function(f) isTRUE(f$cruce), (previo %||% list())$filas %||% list())
  if (!length(prev) || !length(filas)) return(filas)
  ids_prev <- vapply(prev, function(f) .segmentos_chr(f$id), character(1))
  claves_prev <- vapply(prev, .equiv_armon_clave_variables, character(1))
  for (i in seq_along(filas)) {
    if (!isTRUE(solo_ausentes[i]) || isTRUE(filas[[i]]$cruce)) next
    id <- .segmentos_chr(filas[[i]]$id)
    if (nzchar(id)) {
      if (id %in% ids_prev) filas[[i]]$cruce <- TRUE
      next
    }
    clave <- .equiv_armon_clave_variables(filas[[i]])
    j <- if (nzchar(clave)) match(clave, claves_prev) else NA_integer_
    if (is.na(j)) next
    filas[[i]]$cruce <- TRUE
    if (nzchar(ids_prev[[j]])) filas[[i]]$id <- ids_prev[[j]]
  }
  filas
}
