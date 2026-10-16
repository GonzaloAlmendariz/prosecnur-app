# **Variables calculadas en la base.** ADR 0106, punto 2.
#
# Una base declara variables que se calculan a partir de otras de la misma base.
# Dos reglas:
#   - `alguna`: vale 1 si alguna de `variables` tiene uno de `codigos`, 0 si
#     ninguna lo tiene y al menos una tiene una respuesta válida que no es
#     especial (80–99), NA si todas están vacías o sólo hay especiales. Es el
#     mismo valor por caso que el indicador compuesto de la matriz (ADR 0105):
#     se reusa `.equiv_deriv_valor`.
#   - `recodificar`: una variable y un `mapa` `codigo_origen -> codigo_destino`
#     a una `escala` nueva (varios códigos a uno). Un código sin destino en el
#     mapa queda NA: lo que no se declaró no se inventa.
#   - `formula`: una expresión aritmética sobre columnas de la base
#     (base_variables_formula.R). Da un número, no una escala: entra al
#     instrumento como `decimal`.
#
# Una calculada puede partir de otra declarada antes (una fórmula y luego su
# recodificación en tramos): se calculan en el orden en que se declararon.
#
# La declaración vive en `estudio$bases[[b]]$variables_calculadas`; el valor se
# calcula al leer la base (la data original no se reescribe) y la variable entra
# al instrumento adaptado como select_one con su escala.

.BASE_VARIABLES_REGLAS <- c("alguna", "recodificar", "formula")

# Nombre de variable XLSForm: letra o guion bajo, luego letras, dígitos, `_`, `.`, `-`.
.BASE_VARIABLES_NOMBRE_RE <- "^[A-Za-z_][A-Za-z0-9_.-]*$"

.base_variables_escala_alguna <- function() {
  list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "0", etiqueta = "No"))
}

# Lista de códigos o nombres sin vacíos ni repetidos (el helper de ADR 0105 más `unique`).
.base_variables_lista <- function(x) unique(.equiv_deriv_lista_chr(x))

#' Escala efectiva de una calculada (la de `alguna` por defecto es 1 Sí / 0 No).
#' @keywords internal
base_variables_escala <- function(cv) {
  esc <- cv[["escala"]] %||% list()
  if (!length(esc) && identical(.origen_externo_chr(cv[["regla"]]), "alguna")) {
    return(.base_variables_escala_alguna())
  }
  esc
}

# Una columna select_multiple («1 3 5») se reduce a un código por caso para
# `.equiv_deriv_valor`: el primero que cuenta como «sí», si no el primero válido
# no especial, si no el primero (especial). Así «alguna» también mira dentro de
# una opción múltiple sin reescribir la regla del ADR 0105.
.base_variables_reducir_multiple <- function(x, codigos) {
  chr <- .codif_agrupar_codigo_chr(x)
  if (!any(grepl("\\s", chr[!is.na(chr)]))) return(x)
  vapply(strsplit(ifelse(is.na(chr), "", chr), "\\s+"), function(tk) {
    tk <- tk[nzchar(tk)]
    if (!length(tk)) return(NA_character_)
    si <- tk[tk %in% codigos]
    if (length(si)) return(si[[1]])
    validos <- tk[!.equiv_bloques_es_especial(tk)]
    if (length(validos)) validos[[1]] else tk[[1]]
  }, character(1))
}

#' Valor por caso de una calculada sobre `df` (data normalizada de la base).
#'
#' @return vector de códigos: numérico si todos los de la escala lo son, si no
#'   texto. Una variable fuente ausente deja la columna en NA y lo dice en stderr.
#' @keywords internal
base_variables_calcular <- function(df, cv) {
  n <- nrow(df)
  vars <- .base_variables_lista(cv[["variables"]])
  faltan <- setdiff(vars, names(df))
  regla <- .origen_externo_chr(cv[["regla"]])
  out <- if (length(faltan) || !length(vars)) {
    message(sprintf("[base_variables] «%s» sin calcular: faltan %s en la base.",
                    .origen_externo_chr(cv[["nombre"]]), paste(faltan, collapse = ", ")))
    rep(NA_character_, n)
  } else if (identical(regla, "alguna")) {
    codigos <- .codif_agrupar_codigo_chr(.base_variables_lista(cv[["codigos"]]))
    reducido <- df[vars]
    for (v in vars) reducido[[v]] <- .base_variables_reducir_multiple(df[[v]], codigos)
    .equiv_deriv_valor(reducido, vars, codigos)
  } else if (identical(regla, "formula")) {
    arbol <- base_variables_formula_parsear(cv[["expresion"]])
    base_variables_formula_evaluar(arbol, df, .base_variables_lista(cv[["especiales_na"]]))
  } else if (identical(regla, "recodificar")) {
    mapa <- cv[["mapa"]] %||% list()
    destino <- stats::setNames(
      vapply(mapa, function(d) .origen_externo_chr(d), character(1)),
      .codif_agrupar_codigo_chr(names(mapa))
    )
    x <- .codif_agrupar_codigo_chr(df[[vars[[1]]]])
    unname(destino[x])
  } else {
    rep(NA_character_, n)
  }
  if (is.character(out)) out[!is.na(out) & !nzchar(out)] <- NA_character_
  codigos_escala <- vapply(base_variables_escala(cv), function(o) .origen_externo_chr(o[["codigo"]]), character(1))
  if (length(codigos_escala) && !anyNA(suppressWarnings(as.numeric(codigos_escala)))) {
    out <- suppressWarnings(as.numeric(out))
  }
  etiqueta <- .origen_externo_chr(cv[["etiqueta"]])
  attr(out, "label") <- if (nzchar(etiqueta)) etiqueta else .origen_externo_chr(cv[["nombre"]])
  out
}

#' Agrega a la data de la base la columna de cada calculada declarada.
#' @param data data.frame ya normalizado al XLSForm.
#' @param base_meta meta de la base.
#' @keywords internal
base_variables_materializar <- function(data, base_meta) {
  if (!is.data.frame(data)) return(data)
  data <- .base_variables_rellenar_retiradas(data, base_meta)
  calcs <- (base_meta %||% list())[["variables_calculadas"]] %||% list()
  if (!length(calcs)) return(data)
  for (cv in calcs) {
    nombre <- .origen_externo_chr(cv[["nombre"]])
    if (nzchar(nombre)) data[[nombre]] <- base_variables_calcular(data, cv)
  }
  data
}

# Una retirada vigente que NO sale del instrumento (motivo `otra` declarado
# antes, ver `.base_variables_retiradas`) sigue siendo una pregunta: si la base
# no trae su columna, llega vacía en vez de tumbar la lectura estricta.
.base_variables_rellenar_retiradas <- function(data, base_meta) {
  quedan <- setdiff(.base_variables_retiradas_nombres(base_meta), .base_variables_retiradas(base_meta))
  faltan <- setdiff(quedan, names(data))
  # Columna a columna y no `.dn_backfill_missing_columns`: ése rehace el
  # data.frame y perdería los atributos de la normalización.
  for (v in faltan) data[[v]] <- rep(NA_character_, nrow(data))
  data
}

# --- Validación ---------------------------------------------------------------

.base_variables_escala_valida <- function(escala) {
  op <- .base_variables_opciones_df(escala)
  lapply(seq_len(nrow(op)), function(i) list(codigo = op$codigo[[i]], etiqueta = op$etiqueta[[i]]))
}

#' Normaliza y valida una calculada contra la base.
#'
#' @param cv cuerpo del POST (`nombre`, `etiqueta`, `regla`, `variables`,
#'   `codigos`, `mapa`, `escala`).
#' @param columnas columnas de la data normalizada de la base.
#' @param ocupados nombres que una calculada no puede tomar (preguntas del
#'   instrumento, columnas de la data y columnas propias declaradas). No incluye
#'   las calculadas: con el mismo nombre se reemplaza.
#' @param con_lista variables con lista de respuestas (select_one o calculada
#'   con escala): en una fórmula, sus códigos 80–99 cuentan como sin dato.
#' @param multiples variables select_multiple: una fórmula no las admite.
#' @return la calculada normalizada, lista para guardar.
#' @keywords internal
base_variables_validar_calculada <- function(cv, columnas, ocupados,
                                             con_lista = character(0), multiples = character(0)) {
  cv <- cv %||% list()
  nombre <- .origen_externo_chr(cv[["nombre"]])
  if (!nzchar(nombre) || !grepl(.BASE_VARIABLES_NOMBRE_RE, nombre)) {
    stop_api(400, "E_BASE_VARIABLE_NOMBRE_INVALIDO", sprintf(
      "«%s» no es un nombre de variable válido: empieza con una letra o «_» y usa sólo letras, dígitos, «_», «.» o «-».",
      nombre))
  }
  # Se compara sin mayúsculas ni separadores: la reconciliación canónica de la
  # normalización (`.dn_reconcile_canonical_names`) llevaría una columna
  # `Recurrio` a la calculada `recurrio` y la calculada la pisaría.
  plano <- function(x) gsub("[^a-z0-9]", "", tolower(as.character(x)))
  if (plano(nombre) %in% plano(ocupados)) {
    stop_api(409, "E_BASE_VARIABLE_DUPLICADA", sprintf(
      "«%s» ya existe en la base (pregunta del instrumento, columna de la data o columna declarada): elige otro nombre.",
      nombre), list(nombre = nombre))
  }
  regla <- .origen_externo_chr(cv[["regla"]])
  if (!(regla %in% .BASE_VARIABLES_REGLAS)) {
    stop_api(422, "E_BASE_VARIABLE_REGLA_DESCONOCIDA", sprintf(
      "La regla «%s» no existe: usa %s.", regla, paste(.BASE_VARIABLES_REGLAS, collapse = " o ")),
      list(regla = regla))
  }
  if (identical(regla, "formula")) {
    expresion <- trimws(.origen_externo_chr(cv[["expresion"]]))
    arbol <- base_variables_formula_parsear(expresion)
    cv[["variables"]] <- as.list(base_variables_formula_variables(arbol))
  }
  vars <- .base_variables_lista(cv[["variables"]])
  if (!length(vars)) {
    stop_api(422, "E_BASE_VARIABLE_REGLA_INCOMPLETA",
             sprintf("«%s» no nombra ninguna variable de la que calcularse.", nombre))
  }
  if (nombre %in% vars) {
    stop_api(422, "E_BASE_VARIABLE_REGLA_INCOMPLETA",
             sprintf("«%s» no puede calcularse a partir de sí misma.", nombre))
  }
  faltan <- setdiff(vars, columnas)
  if (length(faltan)) {
    stop_api(422, "E_BASE_VARIABLE_INEXISTENTE", sprintf(
      "La base no trae %s: una calculada sólo usa variables de su misma base.",
      paste(sprintf("«%s»", faltan), collapse = ", ")), list(variables = as.list(faltan)))
  }
  escala <- .base_variables_escala_valida(cv[["escala"]])
  etiqueta <- .origen_externo_chr(cv[["etiqueta"]])
  out <- list(nombre = nombre, etiqueta = if (nzchar(etiqueta)) etiqueta else nombre,
              regla = regla, variables = as.list(vars))
  if (identical(regla, "formula")) {
    if (length(intersect(vars, multiples))) {
      stop_api(422, "E_BASE_VARIABLE_FORMULA_INVALIDA", sprintf(
        "%s admite varias respuestas: una fórmula sólo opera con números. Usa la regla «alguna».",
        paste(sprintf("«%s»", intersect(vars, multiples)), collapse = ", ")), list(expresion = expresion))
    }
    out$expresion <- expresion
    out$especiales_na <- as.list(intersect(vars, con_lista))
    out$escala <- list()
    return(out)
  }
  if (identical(regla, "alguna")) {
    codigos <- .base_variables_lista(cv[["codigos"]])
    if (!length(codigos)) {
      stop_api(422, "E_BASE_VARIABLE_REGLA_INCOMPLETA",
               sprintf("«%s» (alguna) no dice qué códigos cuentan como «sí».", nombre))
    }
    if (!length(escala)) escala <- .base_variables_escala_alguna()
    cods <- vapply(escala, function(o) o$codigo, character(1))
    if (!setequal(cods, c("1", "0"))) {
      stop_api(422, "E_BASE_VARIABLE_MAPA_INVALIDO", sprintf(
        "La escala de «%s» (alguna) tiene que ser exactamente 1 y 0; trae %s.",
        nombre, paste(cods, collapse = ", ")))
    }
    out$codigos <- as.list(codigos)
  } else {
    if (length(vars) != 1L) {
      stop_api(422, "E_BASE_VARIABLE_REGLA_INCOMPLETA", sprintf(
        "«%s» (recodificar) parte de una sola variable; trae %d.", nombre, length(vars)))
    }
    if (!length(escala)) {
      stop_api(422, "E_BASE_VARIABLE_ESCALA_VACIA",
               sprintf("«%s» (recodificar) necesita la escala nueva: al menos un código con su etiqueta.", nombre))
    }
    mapa <- cv[["mapa"]] %||% list()
    origen <- trimws(names(mapa) %||% character(0))
    if (!length(mapa) || !is.list(mapa) || any(!nzchar(origen))) {
      stop_api(422, "E_BASE_VARIABLE_REGLA_INCOMPLETA", sprintf(
        "«%s» (recodificar) necesita el mapa { código de origen: código de la escala }.", nombre))
    }
    destinos <- vapply(mapa, function(d) .origen_externo_chr(d), character(1))
    cods <- vapply(escala, function(o) o$codigo, character(1))
    fuera <- unique(destinos[!(destinos %in% cods)])
    if (length(fuera)) {
      stop_api(422, "E_BASE_VARIABLE_MAPA_INVALIDO", sprintf(
        "El mapa de «%s» lleva a %s, que no están en su escala.",
        nombre, paste(sprintf("«%s»", fuera), collapse = ", ")), list(fuera = as.list(fuera)))
    }
    out$mapa <- as.list(stats::setNames(destinos, origen))
  }
  out$escala <- escala
  out
}

#' Cuántos casos caen en cada código de la escala y cuántos sin dato.
#' @keywords internal
base_variables_resumen_calculada <- function(valores, cv) {
  if (identical(.origen_externo_chr(cv[["regla"]]), "formula")) return(base_variables_resumen_numerico(valores))
  chr <- .codif_agrupar_codigo_chr(valores)
  esc <- base_variables_escala(cv)
  list(
    por_codigo = lapply(esc, function(o) list(
      codigo = o$codigo, etiqueta = o$etiqueta,
      n = as.integer(sum(!is.na(chr) & chr == o$codigo)))),
    n_sin_dato = as.integer(sum(is.na(chr))),
    n_total = as.integer(length(chr))
  )
}
