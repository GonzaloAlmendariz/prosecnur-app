# =============================================================================
# Sugeridas al mirar la base: "Patrón en una batería" (ítem 51, punto 1)
# =============================================================================
# Una batería es un grupo de preguntas de opción única que comparten la lista
# de opciones del formulario y un prefijo común en el nombre ("p29_1" a
# "p29_14": prefijo "p29", lista de 7 grados de acuerdo). Se proponen dos
# reglas del tipo `bateria` (validacion_regla_bateria.R):
#
#   misma respuesta  todas las respuestas contadas iguales, con al menos el
#                    75 % de los ítems respondidos (`.SEMILLA_BAT_IGUALES`).
#                    Los códigos de salida de la lista (No aplica, No sabe,
#                    No responde) no cuentan como respuesta. Solo en baterías
#                    de 10 ítems o más y con al menos 3 opciones de escala: en
#                    una batería corta, o de Sí y No, responder lo mismo en
#                    todo es frecuente y no indica nada (en la base de prueba
#                    del ítem 51, las de 5 a 8 ítems marcaban del 14 % al 29 %
#                    de los casos).
#   No aplica        cuando la lista tiene una opción "No aplica", se buscan
#                    los ítems que se marcan No aplica juntos (el bloque sobre
#                    la madre, que se salta entero si no hay madre). Se agrupan
#                    por contenido: dos ítems van juntos si los casos que los
#                    marcan No aplica se parecen (Jaccard de 0.6 o más). La
#                    regla marca los casos con No aplica en el 85 % o más del
#                    bloque y al menos una respuesta de la escala en el resto:
#                    el bloque se saltó a medias.
#
# Base y cifra: ver reglas_custom_semilla_comun.R (casos de la base cargada,
# contados con el motor).
# =============================================================================

.SEMILLA_BAT_MIN_ITEMS <- 10L        # ítems mínimos para "misma respuesta"
.SEMILLA_BAT_MIN_ESCALA <- 3L        # opciones de escala mínimas
.SEMILLA_BAT_IGUALES <- 0.75         # parte de los ítems que debe estar respondida
.SEMILLA_BAT_NA_JACCARD <- 0.6       # parecido mínimo entre dos ítems para el bloque No aplica
.SEMILLA_BAT_NA_MIN_ITEMS <- 4L      # ítems mínimos de un bloque No aplica
.SEMILLA_BAT_NA_PARTE <- 0.85        # parte del bloque en No aplica para marcar
.SEMILLA_BAT_NA_MIN_CASOS <- 5L      # casos mínimos con No aplica para que un ítem entre

# Rótulos de las opciones de salida de una escala. Se lee el rótulo, no el
# código: 88 es No aplica en un estudio y una opción más en otro.
.SEMILLA_BAT_SALIDA <- "^(no aplica|no corresponde|no sabe|no responde|no precisa|ns|nr|ns/nr|prefiere no|prefiero no)\\b"
.SEMILLA_BAT_NO_APLICA <- "^(no aplica|no corresponde)\\b"

.semilla_bat_rotulo <- function(choices, lab_col, i) {
  if (is.na(lab_col)) return("")
  et <- trimws(gsub("<[^>]+>", "", as.character(choices[[lab_col]][i])))
  ifelse(is.na(et), "", et)
}

# Opciones de una lista: códigos de escala y de salida, con su rótulo.
.semilla_bat_lista <- function(choices, lista) {
  ch <- choices[!is.na(choices$list_name) & choices$list_name == lista & !is.na(choices$name), , drop = FALSE]
  if (!nrow(ch)) return(NULL)
  lab_col <- .semilla_label_col(ch)
  cod <- as.character(ch$name)
  rot <- vapply(seq_len(nrow(ch)), function(i) .semilla_bat_rotulo(ch, lab_col, i), character(1))
  rl <- tolower(rot)
  salida <- grepl(.SEMILLA_BAT_SALIDA, rl, perl = TRUE) | cod %in% .semilla_valores_especiales
  list(codigos = cod, rotulos = rot, salida = cod[salida], escala = cod[!salida],
       no_aplica = cod[grepl(.SEMILLA_BAT_NO_APLICA, rl, perl = TRUE)])
}

# "de 1 a 7" si la escala es numérica y correlativa; si no, la lista.
.semilla_bat_escala_txt <- function(escala) {
  num <- suppressWarnings(as.numeric(escala))
  if (!anyNA(num) && length(num) >= 2L && all(diff(sort(num)) == 1)) {
    return(sprintf("de %s a %s", min(num), max(num)))
  }
  paste(escala, collapse = ", ")
}

# "la opción 88 (No aplica)" / "las opciones 88 (No aplica) y 99 (No responde)".
.semilla_bat_salida_txt <- function(info) {
  if (!length(info$salida)) return("")
  et <- vapply(info$salida, function(c) {
    r <- info$rotulos[match(c, info$codigos)]
    if (is.na(r) || !nzchar(r)) c else sprintf("%s (%s)", c, r)
  }, character(1))
  sprintf("%s %s", .semilla_plural(length(et), "la opción", "las opciones"),
          if (length(et) == 1L) et else paste(paste(utils::head(et, -1), collapse = ", "), "y", utils::tail(et, 1)))
}

# Baterías del formulario: select_one con nombre "<prefijo>_<n>" agrupadas por
# lista y prefijo, en el orden del formulario y presentes en la base.
.semilla_bat_grupos <- function(data, survey) {
  if (!all(c("name", "type_base", "list_name") %in% names(survey))) return(list())
  so <- survey[!is.na(survey$type_base) & survey$type_base == "select_one" &
                 !is.na(survey$name) & survey$name %in% names(data), , drop = FALSE]
  if (!nrow(so)) return(list())
  nm <- as.character(so$name)
  m <- regmatches(nm, regexec("^(.*[^_.])[_.]([0-9]+)$", nm))
  pref <- vapply(m, function(z) if (length(z) == 3L) z[2] else NA_character_, character(1))
  clave <- ifelse(is.na(pref), NA_character_, paste(so$list_name, pref, sep = "␟"))
  grupos <- split(nm[!is.na(clave)], factor(clave[!is.na(clave)], levels = unique(clave[!is.na(clave)])))
  lapply(names(grupos), function(k) {
    partes <- strsplit(k, "␟", fixed = TRUE)[[1]]
    list(lista = partes[1], prefijo = partes[2], variables = grupos[[k]])
  })
}

.semilla_bat_base_regla <- function(vars, params, nombre, mensaje, semilla) {
  list(
    tipo = "bateria",
    variables = as.list(vars),
    params = params,
    nombre = nombre,
    mensaje = mensaje,
    severidad = "advertencia",
    activa = TRUE,
    hallazgo_kind = "caso_validar",
    planned_action_type = "ignore_rule",
    origen = "sembrado",
    semilla = semilla
  )
}

.semilla_bat_iguales <- function(g, info, reglas_existentes, survey = NULL) {
  vars <- g$variables
  k <- length(vars)
  if (k < .SEMILLA_BAT_MIN_ITEMS || length(info$escala) < .SEMILLA_BAT_MIN_ESCALA) return(NULL)
  if (.semilla_ya_cubierta_conjunto(reglas_existentes, "bateria", vars)) return(NULL)
  minimo <- as.integer(ceiling(.SEMILLA_BAT_IGUALES * k))
  params <- list(patron = "iguales", minimo = minimo)
  if (length(info$salida)) params$no_cuentan <- as.list(info$salida)
  nb <- .semilla_nombrar_bateria(vars, survey)
  tramo <- nb$nombre
  salida_txt <- .semilla_bat_salida_txt(info)
  porque <- sprintf(
    "%s comparten la escala %s%s. La regla marca los casos con la misma respuesta en todos los ítems respondidos, con al menos %d de los %d respondidos%s.",
    tramo, .semilla_bat_escala_txt(info$escala),
    if (nzchar(salida_txt)) sprintf(" y %s", salida_txt) else "",
    minimo, k,
    if (length(info$salida)) sprintf("; %s no %s como respuesta", sub("^las? opci[oó]n(es)? ", "", salida_txt),
                                     .semilla_plural(length(info$salida), "cuenta", "cuentan")) else "")
  .semilla_bat_base_regla(
    vars, params,
    nombre = sprintf("Misma respuesta en %s", nb$nombre),
    mensaje = sprintf("Respondió lo mismo en todos los ítems de %s.", nb$corto),
    semilla = list(origen = "bateria_iguales", variable = vars[1], lista = g$lista,
                   n_items = k, minimo = minimo, porque = porque)
  )
}

# Bloques de ítems que se marcan No aplica juntos, por el parecido (Jaccard)
# de los casos que los marcan. Componentes conexas de ítems con parecido alto.
.semilla_bat_bloques_na <- function(data, vars, codigo) {
  if (length(vars) < .SEMILLA_BAT_NA_MIN_ITEMS) return(list())
  ind <- vapply(vars, function(v) {
    x <- .semilla_texto(data[[v]])
    !is.na(x) & x == codigo
  }, logical(nrow(data)))
  if (!is.matrix(ind)) return(list())
  s <- colSums(ind)
  keep <- s >= .SEMILLA_BAT_NA_MIN_CASOS
  if (sum(keep) < .SEMILLA_BAT_NA_MIN_ITEMS) return(list())
  vars <- vars[keep]; ind <- ind[, keep, drop = FALSE]; s <- s[keep]
  inter <- crossprod(ind * 1)
  jac <- inter / (outer(s, s, "+") - inter)
  adj <- jac >= .SEMILLA_BAT_NA_JACCARD
  comp <- rep(NA_integer_, length(vars))
  c_id <- 0L
  for (i in seq_along(vars)) {
    if (!is.na(comp[i])) next
    c_id <- c_id + 1L
    cola <- i
    while (length(cola)) {
      j <- cola[1]; cola <- cola[-1]
      if (!is.na(comp[j])) next
      comp[j] <- c_id
      cola <- c(cola, which(adj[j, ] & is.na(comp)))
    }
  }
  bloques <- split(vars, comp)
  Filter(function(b) length(b) >= .SEMILLA_BAT_NA_MIN_ITEMS, unname(bloques))
}

.semilla_bat_no_aplica <- function(data, bloque, info, codigo, reglas_existentes, survey = NULL) {
  if (.semilla_ya_cubierta_conjunto(reglas_existentes, "bateria", bloque)) return(NULL)
  k <- length(bloque)
  # En un bloque corto el 85 % redondea al bloque entero, y entonces nadie
  # puede tener además una respuesta: se deja al menos un ítem libre.
  minimo <- as.integer(min(k - 1L, ceiling(.SEMILLA_BAT_NA_PARTE * k)))
  esc <- suppressWarnings(as.numeric(info$escala))
  ademas <- if (!anyNA(esc) && length(esc)) list(desde = min(esc), hasta = max(esc), minimo = 1L)
            else list(codigos = as.list(info$escala), minimo = 1L)
  # Casos con el bloque entero en No aplica: el salto completo, que la regla no marca.
  todo <- rowSums(vapply(bloque, function(v) {
    x <- .semilla_texto(data[[v]]); !is.na(x) & x == codigo
  }, logical(nrow(data)))) == k
  rot <- info$rotulos[match(codigo, info$codigos)]
  cod_txt <- if (is.na(rot) || !nzchar(rot)) codigo else sprintf("%s (%s)", rot, codigo)
  nb <- .semilla_nombrar_bateria(bloque, survey)
  tramo <- nb$nombre
  porque <- sprintf(
    paste("Los %d ítems de %s se marcan %s juntos: en %s los %d son %s.",
          "La regla marca los casos con %s en %d o más de esos ítems y alguna respuesta %s en el resto, es decir, el bloque saltado a medias."),
    k, tramo, cod_txt, .semilla_casos_txt(sum(todo)), k, codigo, codigo, minimo,
    .semilla_bat_escala_txt(info$escala))
  .semilla_bat_base_regla(
    bloque,
    list(patron = "codigo", codigos = list(codigo), minimo = minimo, ademas = ademas),
    nombre = sprintf("%s a medias en %s", if (is.na(rot) || !nzchar(rot)) codigo else rot, nb$nombre),
    mensaje = sprintf("Marcó %s en casi todo el bloque %s y respondió alguno de sus ítems.", codigo, nb$corto),
    semilla = list(origen = "bateria_no_aplica", variable = bloque[1], codigo = codigo,
                   n_items = k, minimo = minimo, n_bloque_completo = as.integer(sum(todo)), porque = porque)
  )
}

#' Proponer reglas de batería
#'
#' @param data data.frame de la base cargada.
#' @param survey,choices hojas del formulario.
#' @param reglas_existentes reglas propias ya definidas en el scope.
#' @return lista de propuestas sin cifra (la pone `.semilla_con_cifra()`).
#' @keywords internal
reglas_semilla_baterias <- function(data, survey, choices, reglas_existentes = list()) {
  if (!is.data.frame(data) || !nrow(data)) return(list())
  if (!is.data.frame(survey) || !is.data.frame(choices) || !nrow(choices)) return(list())
  if (!all(c("list_name", "name") %in% names(choices))) return(list())
  grupos <- .semilla_bat_grupos(data, survey)
  out <- list()
  for (g in grupos) {
    info <- .semilla_bat_lista(choices, g$lista)
    if (is.null(info)) next
    out[[length(out) + 1L]] <- .semilla_bat_iguales(g, info, reglas_existentes, survey)
  }
  # Bloques No aplica: por lista, sobre todos los ítems que la usan, porque el
  # bloque puede cruzar prefijos (la madre en P11 a P14).
  listas <- unique(vapply(grupos, `[[`, character(1), "lista"))
  for (lista in listas) {
    info <- .semilla_bat_lista(choices, lista)
    if (is.null(info) || length(info$no_aplica) != 1L || length(info$escala) < .SEMILLA_BAT_MIN_ESCALA) next
    vars <- unlist(lapply(Filter(function(g) identical(g$lista, lista), grupos), `[[`, "variables"))
    for (b in .semilla_bat_bloques_na(data, vars, info$no_aplica)) {
      out[[length(out) + 1L]] <- .semilla_bat_no_aplica(data, b, info, info$no_aplica, reglas_existentes, survey)
    }
  }
  Filter(Negate(is.null), out)
}
