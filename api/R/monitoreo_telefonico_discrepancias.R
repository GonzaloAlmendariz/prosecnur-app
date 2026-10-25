# =============================================================================
# monitoreo_telefonico_discrepancias.R — Kobo y la hoja no dicen lo mismo
# =============================================================================
#
# Revamp de Monitoreo › Telefónico, T9 (Control › Discrepancias). Decisiones en
# `docs/qa/revamp-monitoreo/procedimientos-respondidos.md`, P1–P4:
#   - P2: lo primero es la ALERTA en los dos sentidos, con responsable, CodPulso
#     y código proGres, para avisar al equipo antes de decidir.
#   - P1: mientras no se decide, la efectiva de Kobo cuenta (manda Kobo).
#   - P3: «la hoja dice Efectivo y Kobo no tiene envío» va a Avisos.
#   - La decisión «Cuenta / No cuenta» reutiliza
#     `monitoreo_profile.reconciliation_decisions`: «No cuenta» es
#     `keep_excluded` y suma el `response_id` a `exclude_response_ids` (el
#     avance lo descuenta); «Cuenta» es `include_with_caveat` con el CodPulso
#     como caso asignado y deja el envío fuera de la lista de excluidos.
#
# Bloque `discrepancias_telefonicas` (solo lectura), una fila por caso:
#   Sentido (`kobo_sin_hoja` | `hoja_sin_kobo`) · CodPulso · proGres ·
#   Responsable · La hoja dice · Fecha hoja · Fecha Kobo · Enumerador Kobo ·
#   Response ID · Mismo responsable (`Sí` | `No` | "") · Decisión
#   (`pendiente` | `cuenta` | `no_cuenta` | "") · Nota · Decidido el ·
#   Destino (`decision` | `avisos`).
# proGres sale de la columna del barrido que `monitoreo_llave_progres.R`
# reconoce (RMS «Código proGres», MEDVID «COD.proGres»); sin columna, "".
# Una efectiva que el supervisor sacó («No cuenta») ya no es efectiva de Kobo
# y no sale del cruce; se agrega igual desde su decisión para que siga a la
# vista y se pueda revertir.
#
# Bloque `equivalencias_nombres` (solo lectura, P4), una fila por enumerador
# de Kobo: Enumerador Kobo · Responsable hoja · Estado (`igual` |
# `confirmada` | `sugerida` | `sin_par`) · Criterio (`exacto` | `confirmada` |
# `normalizado` | `orden` | `parcial` | "") · Envíos Kobo. Las confirmadas viven en
# `monitoreo_profile.enumerator_equivalences` (lista de {kobo, hoja}).
# =============================================================================

.MONITOREO_DISCREPANCIAS_MAX_FILAS <- 5000L
.MONITOREO_DISCREPANCIAS_COLUMNAS <- c(
  "Sentido", "CodPulso", "proGres", "Responsable", "La hoja dice", "Fecha hoja", "Fecha Kobo",
  "Enumerador Kobo", "Response ID", "Mismo responsable", "Decisión", "Nota", "Decidido el", "Destino"
)
.MONITOREO_SIN_RESPONSABLE <- c("", "sin responsable", "sin asignar")
.MONITOREO_KOBO_ID_ALIAS <- c("_uuid", "uuid", "response_id", "id_respuesta", "id respuesta", "_id", "id")

# Enumerador de cada fila de Kobo. Dos fuentes:
#   - la pregunta del formulario: por nombre exacto conocido («Enumerator_name»
#     en PDM, «name_enumerator» en RMS) o, si no, por patrón
#     (enumerat|encuestador|enumerador) en el nombre sin grupo o en la etiqueta;
#   - la cuenta de plataforma (`_submitted_by`…).
# La pregunta manda cuando la cuenta está vacía o es compartida (la misma
# cuenta —p. ej. la del servidor— con dos o más nombres distintos en la
# pregunta). Una cuenta por persona se respeta.
.MONITOREO_KOBO_CUENTA_ALIAS <- c("_submitted_by", "submitted_by", "submitted by", "username", "usuario")
.MONITOREO_KOBO_ENUMERADOR_PREGUNTA <- c(
  "enumerator_name", "name_enumerator", "nombre_enumerador", "nombre_encuestador", "nombre del encuestador",
  "nombre del encuestador/a", "enumerator", "enumerador", "encuestador", "entrevistador", "operador", "teleoperador"
)
.MONITOREO_KOBO_ENUMERADOR_PATRON <- "enumerat|encuestador|enumerador"

# Columnas candidatas a «pregunta del enumerador», en orden de prioridad.
.monitoreo_kobo_enumerador_columnas <- function(kobo) {
  nombres <- names(kobo)[!startsWith(names(kobo), ".")]
  base <- .monitoreo_text_key(sub("^.*/", "", nombres))
  cuentas <- .monitoreo_text_key(.MONITOREO_KOBO_CUENTA_ALIAS)
  exactas <- unlist(lapply(.monitoreo_text_key(.MONITOREO_KOBO_ENUMERADOR_PREGUNTA), function(a) nombres[base == a]), use.names = FALSE)
  por_nombre <- nombres[grepl(.MONITOREO_KOBO_ENUMERADOR_PATRON, base) & !base %in% cuentas]
  etiquetas <- c(.monitoreo_variable_label_map(kobo), .monitoreo_source_variable_label_map(kobo))
  etiquetas <- etiquetas[names(etiquetas) %in% nombres]
  por_etiqueta <- names(etiquetas)[grepl(.MONITOREO_KOBO_ENUMERADOR_PATRON, .monitoreo_text_key(etiquetas))]
  unique(c(exactas, por_nombre, por_etiqueta))
}

.monitoreo_kobo_enumerador <- function(kobo) {
  if (!is.data.frame(kobo) || !nrow(kobo)) return(character(0))
  pregunta <- rep("", nrow(kobo))
  for (col in .monitoreo_kobo_enumerador_columnas(kobo)) {
    v <- .monitoreo_discrepancias_txt(kobo[[col]])
    falta <- !nzchar(pregunta) & nzchar(v)
    pregunta[falta] <- v[falta]
  }
  cuenta <- .monitoreo_report_first_values(kobo, .MONITOREO_KOBO_CUENTA_ALIAS)
  # Cuenta compartida: la misma cuenta con dos o más personas en la pregunta.
  compartida <- rep(FALSE, nrow(kobo))
  con_ambas <- nzchar(cuenta) & nzchar(pregunta)
  if (any(con_ambas)) {
    personas <- tapply(.monitoreo_nombre_clave(pregunta[con_ambas]), cuenta[con_ambas], function(x) length(unique(x)))
    compartida <- cuenta %in% names(personas)[personas >= 2L]
  }
  ifelse(nzchar(pregunta) & (!nzchar(cuenta) | compartida), pregunta, ifelse(nzchar(cuenta), cuenta, pregunta))
}

# Enumerador por Response ID.
.monitoreo_kobo_enumerador_por_id <- function(kobo) {
  if (!is.data.frame(kobo) || !nrow(kobo)) return(character(0))
  ids <- .monitoreo_report_first_values(kobo, .MONITOREO_KOBO_ID_ALIAS)
  enum <- .monitoreo_kobo_enumerador(kobo)
  keep <- nzchar(ids) & !duplicated(ids)
  stats::setNames(enum[keep], ids[keep])
}

.monitoreo_discrepancias_vacio <- function() {
  cols <- stats::setNames(rep(list(character(0)), length(.MONITOREO_DISCREPANCIAS_COLUMNAS)), .MONITOREO_DISCREPANCIAS_COLUMNAS)
  as.data.frame(cols, check.names = FALSE, stringsAsFactors = FALSE)
}

# proGres por fila del barrido, con la misma detección que la llave de respaldo.
.monitoreo_discrepancias_progres <- function(phone) {
  if (is.null(phone) || !is.data.frame(phone) || !nrow(phone)) return(character(0))
  candidatas <- which(.monitoreo_progres_columnas(
    phone, .monitoreo_variable_label_map(phone), .monitoreo_source_variable_label_map(phone)
  ))
  if (!length(candidatas)) return(rep("", nrow(phone)))
  valores <- trimws(as.character(phone[[candidatas[[1]]]]))
  valores[is.na(valores)] <- ""
  valores
}

# proGres de cada fila del barrido, por la llave publicada de ESA fila (clave
# normalizada). Una llave que se repite con proGres distintos no se usa: nunca
# se atribuye a un caso el proGres de otro.
.monitoreo_discrepancias_progres_mapa <- function(phone, claves) {
  progres <- .monitoreo_discrepancias_progres(phone)
  claves <- as.character(claves %||% character(0))
  if (!length(progres) || length(claves) != length(progres)) return(character(0))
  k <- .monitoreo_nombre_clave(claves)
  ok <- nzchar(k) & nzchar(progres)
  k <- k[ok]
  progres <- progres[ok]
  ambiguas <- unique(k[duplicated(k) & !duplicated(paste(k, progres))])
  keep <- !k %in% ambiguas & !duplicated(k)
  stats::setNames(progres[keep], k[keep])
}

# proGres por código publicado; si el código ES un proGres del barrido (llave
# proGres sin CodPulso), es él mismo.
.monitoreo_discrepancias_progres_de <- function(codigos, mapa) {
  if (!length(codigos)) return(character(0))
  if (length(mapa)) names(mapa) <- .monitoreo_nombre_clave(names(mapa))
  k <- .monitoreo_nombre_clave(codigos)
  out <- unname(mapa[k])
  out[is.na(out)] <- ""
  propio <- !nzchar(out) & k %in% .monitoreo_nombre_clave(unname(mapa))
  out[propio] <- unname(mapa[match(k[propio], .monitoreo_nombre_clave(unname(mapa)))])
  out
}

.monitoreo_discrepancias_txt <- function(x) {
  v <- trimws(as.character(x %||% character(0)))
  v[is.na(v)] <- ""
  v
}

# --- P4: nombres de la misma persona ------------------------------------------

# Clave de nombre sin tildes, mayúsculas ni puntuación: «Op-14» y «op14» dan
# lo mismo. `orden = TRUE` además ordena las palabras: «Pérez Ana» = «Ana Perez».
.monitoreo_nombre_clave <- function(x, orden = FALSE) {
  k <- .monitoreo_text_key(.monitoreo_discrepancias_txt(x))
  if (!isTRUE(orden)) return(gsub("[^a-z0-9]+", "", k))
  vapply(strsplit(gsub("[^a-z0-9]+", " ", k), " ", fixed = TRUE), function(p) {
    paste(sort(p[nzchar(p)]), collapse = " ")
  }, character(1))
}

# Equivalencias confirmadas del perfil ya normalizadas: nombre de la hoja con
# nombre = clave del enumerador de Kobo.
.monitoreo_equivalencias_mapa <- function(profile) {
  profile <- profile %||% list()
  pares <- profile[["enumerator_equivalences"]] %||% profile[["name_equivalences"]] %||% list()
  if (!length(pares)) return(character(0))
  kobo <- vapply(pares, function(p) .monitoreo_scalar(p$kobo, ""), character(1))
  hoja <- vapply(pares, function(p) .monitoreo_scalar(p$hoja, ""), character(1))
  stats::setNames(hoja, .monitoreo_nombre_clave(kobo))
}

#' Un enumerador de Kobo frente a los responsables de la hoja: con quién se
#' empareja y por qué criterio. Devuelve list(hoja, estado, criterio).
#' @noRd
.monitoreo_equivalencia_de <- function(enumerador, responsables, confirmadas = character(0)) {
  k <- .monitoreo_nombre_clave(enumerador)
  if (nzchar(k) && k %in% names(confirmadas)) return(list(hoja = unname(confirmadas[[k]]), estado = "confirmada", criterio = "confirmada"))
  if (enumerador %in% responsables) return(list(hoja = enumerador, estado = "igual", criterio = "exacto"))
  normal <- responsables[nzchar(k) & .monitoreo_nombre_clave(responsables) == k]
  if (length(normal)) return(list(hoja = sort(normal)[[1]], estado = "sugerida", criterio = "normalizado"))
  ko <- .monitoreo_nombre_clave(enumerador, orden = TRUE)
  orden <- responsables[nzchar(ko) & .monitoreo_nombre_clave(responsables, orden = TRUE) == ko]
  if (length(orden)) return(list(hoja = sort(orden)[[1]], estado = "sugerida", criterio = "orden"))
  # «Olga» en la hoja y «Olga Ramírez» en Kobo: todas las palabras de uno están
  # en el otro. Solo si hay un único candidato; no basta para «Mismo responsable».
  palabras <- function(x) strsplit(.monitoreo_nombre_clave(x, orden = TRUE), " ", fixed = TRUE)[[1]]
  pe <- palabras(enumerador)
  parcial <- responsables[vapply(responsables, function(r) {
    pr <- palabras(r)
    length(pe) && length(pr) && (all(pr %in% pe) || all(pe %in% pr))
  }, logical(1))]
  if (length(parcial) == 1L) return(list(hoja = parcial[[1]], estado = "sugerida", criterio = "parcial"))
  list(hoja = "", estado = "sin_par", criterio = "")
}

#' Estrato de persona para cada enumerador de Kobo: la equivalencia confirmada
#' o, si no, la grafía más frecuente entre las que comparten clave sin tildes,
#' mayúsculas ni espacios («silbia cruzado» y «Silbia Cruzado» son una).
#' @noRd
.monitoreo_enumerador_persona <- function(enumeradores, profile = list()) {
  enumeradores <- .monitoreo_discrepancias_txt(enumeradores)
  if (!length(enumeradores)) return(character(0))
  confirmadas <- .monitoreo_equivalencias_mapa(profile)
  clave <- .monitoreo_nombre_clave(enumeradores)
  out <- enumeradores
  for (k in unique(clave[nzchar(clave)])) {
    idx <- which(clave == k)
    if (k %in% names(confirmadas)) {
      out[idx] <- confirmadas[[k]]
      next
    }
    tabla <- sort(table(enumeradores[idx]), decreasing = TRUE)
    out[idx] <- names(tabla)[[1]]
  }
  out
}

.monitoreo_responsables_hoja <- function(detalle) {
  if (is.null(detalle) || !is.data.frame(detalle) || !"Responsable" %in% names(detalle)) return(character(0))
  v <- unique(.monitoreo_discrepancias_txt(detalle$Responsable))
  sort(v[!tolower(v) %in% .MONITOREO_SIN_RESPONSABLE])
}

#' Bloque `equivalencias_nombres`: sugerencia y estado por enumerador de Kobo.
#' @noRd
.monitoreo_equivalencias_df <- function(enumeradores, responsables, profile) {
  vacio <- data.frame(`Enumerador Kobo` = character(0), `Responsable hoja` = character(0), Estado = character(0),
                      Criterio = character(0), `Envíos Kobo` = integer(0), check.names = FALSE, stringsAsFactors = FALSE)
  enumeradores <- .monitoreo_discrepancias_txt(enumeradores)
  enumeradores <- enumeradores[nzchar(enumeradores)]
  if (!length(enumeradores)) return(vacio)
  conteo <- table(enumeradores)
  confirmadas <- .monitoreo_equivalencias_mapa(profile)
  filas <- lapply(names(conteo), function(e) {
    eq <- .monitoreo_equivalencia_de(e, responsables, confirmadas)
    data.frame(`Enumerador Kobo` = e, `Responsable hoja` = eq$hoja, Estado = eq$estado, Criterio = eq$criterio,
               `Envíos Kobo` = as.integer(conteo[[e]]), check.names = FALSE, stringsAsFactors = FALSE)
  })
  out <- do.call(rbind, filas)
  out <- out[order(match(out$Estado, c("sin_par", "sugerida", "confirmada", "igual")), out$`Enumerador Kobo`), , drop = FALSE]
  rownames(out) <- NULL
  out
}

# --- Filas de la alerta --------------------------------------------------------

# Decisiones propias de este modo, por response_id.
.monitoreo_discrepancias_decisiones <- function(profile) {
  manual <- ((profile %||% list())$reconciliation_decisions %||% list())$manual_case_reconciliations %||% list()
  propias <- Filter(function(item) is.list(item) && identical(.monitoreo_scalar(item$match_type, ""), "telefonico_discrepancia"), manual)
  ids <- vapply(propias, function(item) .monitoreo_scalar(item$response_id, ""), character(1))
  stats::setNames(propias, ids)[nzchar(ids)]
}

#' Filas del bloque `discrepancias_telefonicas`.
#'
#' `detalle` es `comparacion_codpulso` (una fila por caso del barrido y, al
#' final, las efectivas de Kobo fuera de base); `claves` es el CodPulso de cada
#' fila del barrido, en el orden de `phone`. `efectivas` es
#' `control_tiempo_kobo` (CodPulso, Responsable plataforma, Response ID);
#' `kobo` son las filas de Kobo SIN descontar las «No cuenta».
#' @noRd
.monitoreo_telefonico_discrepancias_df <- function(phone, claves, detalle, efectivas = NULL, profile = list(), kobo = NULL) {
  if (is.null(detalle) || !is.data.frame(detalle)) detalle <- data.frame()
  n <- nrow(detalle)
  si <- function(col) if (col %in% names(detalle)) as.character(detalle[[col]]) == "Sí" else rep(FALSE, n)
  kobo_ok <- si("Efectiva Kobo")
  hoja_ok <- si("Efectiva telefónica")
  sentido <- ifelse(kobo_ok & !hoja_ok, "kobo_sin_hoja", ifelse(hoja_ok & !kobo_ok, "hoja_sin_kobo", ""))
  filas <- which(nzchar(sentido))
  mapa <- .monitoreo_discrepancias_progres_mapa(phone, claves)
  texto <- function(col, idx = filas) {
    if (col %in% names(detalle)) .monitoreo_discrepancias_txt(detalle[[col]][idx]) else rep("", length(idx))
  }
  out <- data.frame(
    Sentido = sentido[filas], CodPulso = texto("CodPulso"), Responsable = texto("Responsable"),
    `La hoja dice` = texto("Estado telefónico"), `Fecha hoja` = texto("Fecha"), `Fecha Kobo` = texto("Fecha Kobo"),
    `Enumerador Kobo` = rep("", length(filas)), `Response ID` = rep("", length(filas)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # Envío de Kobo por CodPulso: el primero de control_tiempo_kobo.
  if (is.data.frame(efectivas) && nrow(efectivas) && nrow(out)) {
    cod_ef <- .monitoreo_discrepancias_txt(efectivas$CodPulso)
    # control_tiempo_kobo publica la llave («DSC001»), el cruce la grafía («DSC-001»).
    pos <- match(.monitoreo_nombre_clave(out$CodPulso), .monitoreo_nombre_clave(cod_ef))
    hay <- !is.na(pos) & out$Sentido == "kobo_sin_hoja"
    out$`Enumerador Kobo`[hay] <- .monitoreo_discrepancias_txt(efectivas[["Responsable plataforma"]])[pos[hay]]
    out$`Response ID`[hay] <- .monitoreo_discrepancias_txt(efectivas[["Response ID"]])[pos[hay]]
  }
  por_id <- .monitoreo_kobo_enumerador_por_id(kobo)
  if (length(por_id) && nrow(out)) {
    v <- unname(por_id[out$`Response ID`])
    usar <- !is.na(v) & nzchar(v)
    out$`Enumerador Kobo`[usar] <- v[usar]
  }
  # «No cuenta»: el envío salió del cruce, la decisión no.
  decisiones <- .monitoreo_discrepancias_decisiones(profile)
  fuera <- Filter(function(d) identical(.monitoreo_scalar(d$action, ""), "keep_excluded"), decisiones)
  fuera <- fuera[setdiff(names(fuera), out$`Response ID`)]
  if (length(fuera)) {
    kobo_ids <- if (is.data.frame(kobo) && nrow(kobo)) .monitoreo_report_first_values(kobo, .MONITOREO_KOBO_ID_ALIAS) else character(0)
    kobo_enum <- if (length(kobo_ids)) .monitoreo_kobo_enumerador(kobo) else character(0)
    kobo_fecha <- if (length(kobo_ids)) .monitoreo_discrepancias_txt(.monitoreo_report_date_values(kobo)) else character(0)
    cod_det <- texto("CodPulso", seq_len(n))
    extra <- do.call(rbind, lapply(names(fuera), function(id) {
      cod <- .monitoreo_scalar(fuera[[id]]$declared_code, "")
      i <- match(cod, cod_det)
      k <- match(id, kobo_ids)
      data.frame(
        Sentido = "kobo_sin_hoja", CodPulso = cod,
        Responsable = if (is.na(i)) "Sin responsable" else texto("Responsable", i),
        `La hoja dice` = if (is.na(i)) "Fuera de base" else texto("Estado telefónico", i),
        `Fecha hoja` = if (is.na(i)) "" else texto("Fecha", i),
        `Fecha Kobo` = if (is.na(k)) "" else kobo_fecha[[k]] %||% "",
        `Enumerador Kobo` = if (is.na(k)) "" else kobo_enum[[k]],
        `Response ID` = id, check.names = FALSE, stringsAsFactors = FALSE
      )
    }))
    out <- rbind(out, extra)
  }
  if (!nrow(out)) return(.monitoreo_discrepancias_vacio())
  out$proGres <- .monitoreo_discrepancias_progres_de(out$CodPulso, mapa)
  # P4: mismo responsable con la equivalencia confirmada o sugerida.
  responsables <- .monitoreo_responsables_hoja(detalle)
  confirmadas <- .monitoreo_equivalencias_mapa(profile)
  out$`Mismo responsable` <- vapply(seq_len(nrow(out)), function(i) {
    e <- out$`Enumerador Kobo`[[i]]
    r <- out$Responsable[[i]]
    if (!nzchar(e) || tolower(r) %in% .MONITOREO_SIN_RESPONSABLE) return("")
    eq <- .monitoreo_equivalencia_de(e, responsables, confirmadas)
    if (nzchar(eq$hoja) && identical(eq$hoja, r) && !identical(eq$criterio, "parcial")) "Sí" else "No"
  }, character(1))
  # P1: pendiente = cuenta mientras tanto. P3: la hoja sin Kobo va a Avisos.
  decision <- lapply(out$`Response ID`, function(id) if (nzchar(id)) decisiones[[id]] else NULL)
  kobo_fila <- out$Sentido == "kobo_sin_hoja"
  out$`Decisión` <- ifelse(kobo_fila, vapply(decision, function(d) {
    if (is.null(d)) "pendiente" else if (identical(.monitoreo_scalar(d$action, ""), "keep_excluded")) "no_cuenta" else "cuenta"
  }, character(1)), "")
  out$Nota <- vapply(decision, function(d) if (is.null(d)) "" else .monitoreo_scalar(d$note, ""), character(1))
  out$`Decidido el` <- vapply(decision, function(d) if (is.null(d)) "" else .monitoreo_scalar(d$decided_at, ""), character(1))
  out$Destino <- ifelse(kobo_fila, "decision", "avisos")
  out <- out[order(out$Sentido, out$Responsable, out$CodPulso), .MONITOREO_DISCREPANCIAS_COLUMNAS, drop = FALSE]
  rownames(out) <- NULL
  utils::head(out, .MONITOREO_DISCREPANCIAS_MAX_FILAS)
}

#' Bloques `discrepancias_telefonicas` y `equivalencias_nombres`.
#' @noRd
.monitoreo_telefonico_discrepancias_blocks <- function(phone, claves, detalle, efectivas = NULL, profile = list(), kobo = NULL) {
  filas <- .monitoreo_telefonico_discrepancias_df(phone, claves, detalle, efectivas, profile, kobo)
  enumeradores <- .monitoreo_kobo_enumerador(kobo)
  c(list(
    .monitoreo_report_block(
      "discrepancias_telefonicas",
      "Discrepancias entre Kobo y la hoja de barrido",
      filas,
      "Efectivas de Kobo que la hoja no marca «Efectivo» (cuentan mientras no se decida) y casos que la hoja marca «Efectivo» sin envío de Kobo (van a Avisos)."
    ),
    .monitoreo_report_block(
      "equivalencias_nombres",
      "Enumeradores de Kobo y responsables de la hoja",
      .monitoreo_equivalencias_df(enumeradores, .monitoreo_responsables_hoja(detalle), profile),
      "La misma persona escrita de dos formas. Las sugeridas ignoran tildes, mayúsculas, puntuación y el orden de las palabras; se confirman en Insumos › Llave y filtros."
    )
  ),
  # P3: «Efectivo» sin Kobo va a Avisos, desde estas mismas filas.
  .monitoreo_avisos_hoja_sin_kobo_blocks(filas)) # monitoreo_avisos_telefonico.R
}

# --- Decisión «Cuenta / No cuenta» ------------------------------------------

#' Aplica la decisión del supervisor sobre una efectiva de Kobo en
#' discrepancia. Devuelve la config con `reconciliation_decisions` al día.
#' @noRd
.monitoreo_telefonico_decidir_discrepancia <- function(config, payload) {
  if (!is.list(payload)) payload <- list()
  response_id <- trimws(.monitoreo_scalar(payload$response_id %||% payload$responseId, ""))
  codigo <- trimws(.monitoreo_scalar(payload$codpulso %||% payload$CodPulso %||% payload$codigo, ""))
  decision <- .monitoreo_scalar(payload$decision %||% payload$action, "")
  nota <- trimws(.monitoreo_scalar(payload$note %||% payload$nota, ""))
  if (!nzchar(response_id)) stop_api(400, "E_MONITOREO_RESPONSE_ID", "Falta response_id para guardar la decision.")
  if (!decision %in% c("cuenta", "no_cuenta")) {
    stop_api(400, "E_MONITOREO_DECISION_ACTION", "La decision debe ser «cuenta» o «no_cuenta».")
  }
  if (!nzchar(nota)) {
    stop_api(400, "E_MONITOREO_NOTE_REQUIRED", "Agrega una nota: la decision queda en el proyecto con quien decidio y por que.")
  }
  cfg <- if (is.list(config)) config else list()
  profile <- cfg$monitoreo_profile %||% list()
  recon <- profile$reconciliation_decisions %||% list()
  incluir <- unique(.monitoreo_chr_vec(recon$include_response_ids))
  excluir <- unique(.monitoreo_chr_vec(recon$exclude_response_ids))
  manual <- .monitoreo_normalize_manual_case_reconciliations(recon$manual_case_reconciliations %||% list())
  anterior <- manual[[response_id]]
  cuenta <- identical(decision, "cuenta")
  excluir <- if (cuenta) setdiff(excluir, response_id) else unique(c(excluir, response_id))
  incluir <- setdiff(incluir, response_id)
  manual[[response_id]] <- list(
    response_id = response_id,
    actor = "",
    action = if (cuenta) "include_with_caveat" else "keep_excluded",
    declared_code = codigo,
    declared_email = "",
    assigned_person_label = if (cuenta) codigo else "",
    assigned_case_key = if (cuenta) codigo else "",
    assigned_base_source = "",
    assigned_base_row = 0L,
    match_type = "telefonico_discrepancia",
    previous_status = if (is.list(anterior)) .monitoreo_scalar(anterior$new_status, "cuenta_mientras_tanto") else "cuenta_mientras_tanto",
    new_status = if (cuenta) "cuenta" else "no_cuenta",
    note = nota,
    decided_at = .monitoreo_now_iso()
  )
  profile$reconciliation_decisions <- list(
    include_response_ids = as.list(incluir),
    exclude_response_ids = as.list(excluir),
    manual_case_reconciliations = manual
  )
  cfg$monitoreo_profile <- profile
  list(config = cfg, decision = manual[[response_id]])
}

mount_monitoreo_telefonico_discrepancias <- function(pr) {
  pr |>
    plumber::pr_post("/api/monitoreo/telefonico/discrepancia/decision", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      s <- session_get(sid)
      snapshot <- s$monitoreo_snapshot %||% NULL
      data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
      cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
      # El body plano trae `decision` como string («cuenta»): solo se desenvuelve
      # si viene anidado como objeto.
      payload <- if (is.list(parsed$decision)) parsed$decision else parsed
      applied <- .monitoreo_telefonico_decidir_discrepancia(cfg, payload)
      cfg <- .monitoreo_store_config(sid, monitoreo_normalize_config(applied$config, data))
      saved_project <- .monitoreo_mark_project_dirty_if_open(sid)
      list(ok = TRUE, decision = applied$decision, state = .monitoreo_state_payload(sid), saved_project = !is.null(saved_project))
    }))
}

# --- «No cuenta» sale del avance ---------------------------------------------

#' Envíos que el supervisor decidió que no cuentan desde Discrepancias. Solo
#' las decisiones de este modo (`match_type = "telefonico_discrepancia"`): una
#' exclusión heredada de otra pantalla no mueve el avance telefónico.
#' @noRd
.monitoreo_telefonico_no_cuentan <- function(profile) {
  manual <- (profile$reconciliation_decisions %||% list())$manual_case_reconciliations %||% list()
  ids <- vapply(manual, function(item) {
    if (!is.list(item)) return("")
    propia <- identical(.monitoreo_scalar(item$match_type, ""), "telefonico_discrepancia")
    fuera <- identical(.monitoreo_scalar(item$action, ""), "keep_excluded")
    if (propia && fuera) .monitoreo_scalar(item$response_id, "") else ""
  }, character(1))
  unique(ids[nzchar(ids)])
}

#' Las respuestas sin los envíos que «no cuentan». Mismo identificador que la
#' columna «Response ID» que ve el supervisor.
#' @noRd
.monitoreo_telefonico_sin_excluidas <- function(responses, profile) {
  fuera <- .monitoreo_telefonico_no_cuentan(profile)
  if (!length(fuera) || is.null(responses) || !is.data.frame(responses) || !nrow(responses)) return(responses)
  ids <- trimws(.monitoreo_report_first_values(responses, c("_uuid", "uuid", "response_id", "id_respuesta", "id respuesta", "_id", "id")))
  ids[is.na(ids)] <- ""
  responses[!(nzchar(ids) & ids %in% fuera), , drop = FALSE]
}

# --- P4: equivalencias confirmadas en el perfil ---------------------------------

#' `enumerator_equivalences`: lista de {kobo, hoja} que el equipo confirma en
#' Insumos › Llave y filtros (P4). Se llama desde `monitoreo_normalize_profile`.
#' Acepta `name_equivalences` como alias de lectura y escribe solo
#' `enumerator_equivalences`. Recorta espacios, descarta pares a medias
#' y deja un par por enumerador de Kobo (por su clave sin tildes ni
#' mayúsculas; gana el primero). Sin pares la clave no aparece.
#' @noRd
.monitoreo_profile_equivalencias <- function(out, profile) {
  raw <- profile[["enumerator_equivalences"]] %||% profile[["name_equivalences"]]
  if (is.data.frame(raw)) raw <- lapply(seq_len(nrow(raw)), function(i) as.list(raw[i, , drop = FALSE]))
  if (!is.list(raw) || !length(raw)) return(.monitoreo_profile_supervision_rondas(out, profile))
  pares <- list()
  vistos <- character(0)
  for (item in raw) {
    if (!is.list(item)) next
    kobo <- trimws(.monitoreo_scalar(item$kobo, ""))
    hoja <- trimws(.monitoreo_scalar(item$hoja, ""))
    clave <- .monitoreo_nombre_clave(kobo)
    if (!nzchar(clave) || !nzchar(hoja) || clave %in% vistos) next
    vistos <- c(vistos, clave)
    pares[[length(pares) + 1L]] <- list(kobo = kobo, hoja = hoja)
  }
  if (length(pares)) out[["enumerator_equivalences"]] <- pares
  .monitoreo_profile_supervision_rondas(out, profile) # monitoreo_supervision_rondas.R
}
