# Indicadores compuestos en la fila de la matriz (ADR 0105)
# =========================================================
#
# PROBLEMA. La matriz de la OIGD pide indicadores que combinan varias preguntas:
# AP-12 «recurrió a alguna instancia PUCP», CO-01 «conoce al menos una
# instancia disciplinaria». Una fila de la matriz nombra UNA variable por base,
# así que esos agregados no se podían declarar.
#
# DISEÑO. La fila declara, en vez de una variable, un indicador:
#
#   derivada = {
#     regla:    "alguna",
#     por_base: {<base>: {variables: [V1, V2, ...], codigos: ["1"]}}
#   }
#
# El normalizador escribe en `variables[<base>]` la expresión canónica
# `alguna(V1,V2,...)`, en el orden declarado, y ése es el nombre de la columna
# que se materializa en los datos de la base. Todo consumidor que lee
# `variables[base]` (tabla, comparativos, cruces) funciona sin saber que la
# fila es compuesta.
#
# Valor por caso (ADR 0105, punto 3):
#   "1" si alguna variable tiene un código de `codigos`;
#   "0" si ninguna lo tiene y al menos una trae una respuesta válida que no es
#       especial (80-99);
#   NA  si todas están vacías (la pregunta no se le hizo) o sólo hay especiales.
#
# Una variable componente que no está en los datos de la base NO se
# materializa: la base cae en el «n.c.» con motivo `variable_ausente` que ya
# existe, y el aviso nombra la componente que falta, no la expresión.
#
# Este archivo es motor: normaliza, valida y materializa. El router, el preview
# y `.armz_preparar()` sólo lo llaman.

.EQUIV_DERIV_REGLAS <- c("alguna")

# Un nombre de variable no puede romper la expresión: sin paréntesis, comas ni
# espacios. Lo demás (`P28/1`, `p13_1`, `q0013.0001`) es un nombre de columna.
.EQUIV_DERIV_VARIABLE_RE <- "^[^(),[:space:]]+$"

.equiv_deriv_invalida <- function(etiqueta, motivo) {
  stop_api(400, "E_EQUIV_DERIVADA_INVALIDA",
           sprintf("El indicador compuesto «%s» no es válido: %s", etiqueta, motivo),
           list(fila = etiqueta, motivo = motivo))
}

.equiv_deriv_lista_chr <- function(x) {
  v <- as.character(unlist(x %||% character(0), use.names = FALSE))
  v <- trimws(v[!is.na(v)])
  v[nzchar(v)]
}

#' Expresión canónica del indicador: `alguna(V1,V2,...)` en el orden declarado.
#' @noRd
.equiv_deriv_expresion <- function(variables, regla = "alguna") {
  paste0(regla, "(", paste(variables, collapse = ","), ")")
}

# Normaliza y valida el campo `derivada` de una fila. Devuelve NULL si la fila
# no declara indicador (campo ausente, nulo o vacío). `regla` ausente vale
# «alguna», la única que existe; otra regla se rechaza.
.equiv_deriv_normalizar <- function(der, bases, etiqueta = "") {
  if (is.null(der) || !length(der)) return(NULL)
  if (!is.list(der)) .equiv_deriv_invalida(etiqueta, "debe ser un objeto {regla, por_base}.")

  regla <- .equiv_armon_chr(der$regla, "alguna")
  if (!regla %in% .EQUIV_DERIV_REGLAS) {
    .equiv_deriv_invalida(etiqueta, sprintf(
      "la regla «%s» no existe; la única regla es «alguna».", regla))
  }

  pb_in <- der$por_base %||% list()
  if (!is.list(pb_in) || !length(pb_in) || is.null(names(pb_in)) || any(!nzchar(names(pb_in)))) {
    .equiv_deriv_invalida(etiqueta, "'por_base' debe nombrar al menos una base con sus variables.")
  }
  por_base <- list()
  for (b in names(pb_in)) {
    if (!b %in% bases) {
      .equiv_deriv_invalida(etiqueta, sprintf("la base «%s» no existe en el estudio.", b))
    }
    e <- pb_in[[b]] %||% list()
    if (!is.list(e)) .equiv_deriv_invalida(etiqueta, sprintf("la entrada de «%s» debe ser un objeto.", b))

    vars <- vapply(.equiv_deriv_lista_chr(e$variables), .equiv_var_canonica, character(1),
                   USE.NAMES = FALSE)
    vars <- vars[nzchar(vars)]
    if (!length(vars)) {
      .equiv_deriv_invalida(etiqueta, sprintf("la base «%s» no declara ninguna variable.", b))
    }
    mal <- vars[!grepl(.EQUIV_DERIV_VARIABLE_RE, vars)]
    if (length(mal)) {
      .equiv_deriv_invalida(etiqueta, sprintf(
        "la variable «%s» de «%s» lleva paréntesis, comas o espacios.", mal[[1]], b))
    }
    if (any(duplicated(vars))) {
      .equiv_deriv_invalida(etiqueta, sprintf(
        "la variable «%s» se repite en «%s».", vars[duplicated(vars)][[1]], b))
    }

    cods <- .codif_agrupar_codigo_chr(.equiv_deriv_lista_chr(e$codigos))
    cods <- cods[!is.na(cods) & nzchar(cods)]
    if (!length(cods)) {
      .equiv_deriv_invalida(etiqueta, sprintf(
        "la base «%s» no declara qué códigos cuentan como «sí».", b))
    }
    mal <- cods[!grepl(.EQUIV_ARMON_CODIGO_RE, cods)]
    if (length(mal)) {
      .equiv_deriv_invalida(etiqueta, sprintf("el código «%s» lleva espacios o símbolos.", mal[[1]]))
    }
    if (any(duplicated(cods))) {
      .equiv_deriv_invalida(etiqueta, sprintf(
        "el código «%s» se repite en «%s».", cods[duplicated(cods)][[1]], b))
    }
    # Listas y no vectores: un solo elemento debe viajar como arreglo.
    por_base[[b]] <- list(variables = as.list(vars), codigos = as.list(cods))
  }
  list(regla = regla, por_base = por_base)
}

# Entrada del indicador para una base, o NULL si la fila no es compuesta ahí.
.equiv_deriv_entrada <- function(fila, base) {
  der <- (fila %||% list())$derivada
  if (is.null(der)) return(NULL)
  (der$por_base %||% list())[[base]]
}

#' Variables de la fila con la expresión canónica en cada base compuesta.
#' Una base que el indicador no declara conserva su variable.
#' @noRd
.equiv_deriv_variables <- function(variables, der) {
  variables <- variables %||% list()
  if (is.null(der)) return(variables)
  for (b in names(der$por_base %||% list())) {
    e <- der$por_base[[b]]
    variables[[b]] <- .equiv_deriv_expresion(.equiv_deriv_lista_chr(e$variables),
                                             der$regla %||% "alguna")
  }
  variables
}

# Las variables reales que la fila usa en una base: las componentes si es
# compuesta, si no su variable. Es lo que la cobertura compara con el
# instrumento (la expresión no es una variable del cuestionario).
.equiv_deriv_variables_reales <- function(fila, base) {
  e <- .equiv_deriv_entrada(fila, base)
  if (!is.null(e)) return(.equiv_deriv_lista_chr(e$variables))
  v <- (fila$variables %||% list())[[base]]
  if (is.null(v)) NULL else as.character(v)
}

# Escala por defecto del indicador (ADR 0105, punto 4): 1 «Sí» y 0 «No», con
# mapa identidad en cada base compuesta. Editable como cualquier otra fila.
.equiv_deriv_armon_defecto <- function(der) {
  pb <- lapply(der$por_base %||% list(), function(e) {
    list(comparable = TRUE, mapa = .equiv_armon_mapa_vacio())
  })
  list(escala = list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "0", etiqueta = "No")),
       por_base = if (length(pb)) pb else .equiv_armon_mapa_vacio())
}

.EQUIV_DERIV_EXPR_RE <- paste0("^(", paste(.EQUIV_DERIV_REGLAS, collapse = "|"), ")\\(.*\\)$")

#' Cierra las filas compuestas de la declaración que se guarda.
#'
#' 1. Una fila que NO trae la clave `derivada` conserva la de la fila previa
#'    con las mismas variables (un editor que no conoce el campo no la borra).
#' 2. Una fila compuesta sin armonización recibe la escala por defecto.
#' 3. Una fila que ya no es compuesta pierde sus expresiones `alguna(...)`: sin
#'    `derivada` no nombran ninguna columna. Si no le queda variable, se va.
#' @param solo_ausentes Lógico por fila: TRUE si la fila no declaró `derivada`.
#' @noRd
.equiv_deriv_cerrar <- function(filas, previo, solo_ausentes = NULL) {
  prev_filas <- (previo %||% list())$filas %||% list()
  claves_prev <- vapply(prev_filas, .equiv_armon_clave_variables, character(1))
  out <- list()
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (is.null(f$derivada) && (is.null(solo_ausentes) || isTRUE(solo_ausentes[i])) &&
        length(prev_filas)) {
      j <- match(.equiv_armon_clave_variables(f), claves_prev)
      if (!is.na(j) && !is.null(prev_filas[[j]]$derivada)) f$derivada <- prev_filas[[j]]$derivada
    }
    if (!is.null(f$derivada)) {
      if (is.null(f$armonizacion)) f$armonizacion <- .equiv_deriv_armon_defecto(f$derivada)
    } else {
      vars <- f$variables %||% list()
      quedan <- vars[!grepl(.EQUIV_DERIV_EXPR_RE, vapply(vars, as.character, character(1)))]
      if (!length(quedan)) next
      if (length(quedan) != length(vars)) {
        f$variables <- quedan
        f$cantidad <- length(quedan)
      }
    }
    out[[length(out) + 1L]] <- f
  }
  out
}

#' Forma canónica del indicador para la huella de la declaración. Sólo se
#' llama si la fila es compuesta: las demás conservan su huella.
#' @noRd
.equiv_deriv_canonico <- function(der) {
  if (is.null(der)) return("")
  pb <- der$por_base %||% list()
  partes <- vapply(sort(names(pb)), function(b) {
    e <- pb[[b]]
    paste0(b, ":", paste(.equiv_deriv_lista_chr(e$variables), collapse = ","), ":",
           paste(sort(.equiv_deriv_lista_chr(e$codigos)), collapse = ","))
  }, character(1))
  paste0("deriv{", der$regla %||% "alguna", "}{", paste(partes, collapse = ";"), "}")
}

# ---- Materialización -------------------------------------------------------

#' Valor del indicador por caso: "1", "0" o NA (ADR 0105, punto 3).
#'
#' Los códigos se comparan como texto normalizado (`.codif_agrupar_codigo_chr`,
#' el mismo que usa `codif_agrupar_df`): un 1 numérico, un "1" y un
#' haven_labelled con valor 1 casan.
#' @noRd
.equiv_deriv_valor <- function(df, variables, codigos) {
  n <- nrow(df)
  codigos <- .codif_agrupar_codigo_chr(as.character(codigos))
  si <- rep(FALSE, n)
  valida <- rep(FALSE, n)
  for (v in variables) {
    x <- .codif_agrupar_codigo_chr(df[[v]])
    con <- !is.na(x)
    si <- si | (con & x %in% codigos)
    valida <- valida | (con & !.equiv_bloques_es_especial(x))
  }
  out <- rep(NA_character_, n)
  out[valida] <- "0"
  out[si] <- "1"
  out
}

# Componentes de la fila que la base no trae (o que Analítica excluye).
.equiv_deriv_faltantes <- function(fila, base, df, excluidas = character(0)) {
  e <- .equiv_deriv_entrada(fila, base)
  if (is.null(e) || !is.data.frame(df)) return(character(0))
  vars <- .equiv_deriv_lista_chr(e$variables)
  vars[!(vars %in% names(df)) | vars %in% as.character(excluidas %||% character(0))]
}

#' Agrega a los datos de una base la columna de cada fila compuesta.
#'
#' La columna se llama exactamente como la expresión de `variables[base]`. Una
#' fila con alguna componente ausente no se materializa en esa base: el
#' consumidor la ve ausente y la marca «n.c.» (`variable_ausente`).
#' @param df data.frame de la base.
#' @param filas Filas de la matriz (las no compuestas se ignoran).
#' @param base Nombre de la base.
#' @return `df` con las columnas del indicador.
#' @keywords internal
equiv_derivadas_materializar <- function(df, filas, base) {
  if (!is.data.frame(df)) return(df)
  for (f in (filas %||% list())) {
    e <- .equiv_deriv_entrada(f, base)
    if (is.null(e)) next
    if (length(.equiv_deriv_faltantes(f, base, df))) next
    expr <- .equiv_armon_chr((f$variables %||% list())[[base]], "")
    if (!nzchar(expr)) next
    df[[expr]] <- .equiv_deriv_valor(df, .equiv_deriv_lista_chr(e$variables),
                                     .equiv_deriv_lista_chr(e$codigos))
  }
  df
}

#' Datos y exclusiones de la serie con los indicadores compuestos.
#'
#' Materializa cada fila compuesta en cada período y, si Analítica excluye
#' alguna de sus componentes en una base, excluye también la expresión: el
#' comparativo respeta las exclusiones igual que con una variable simple
#' (`causa = "excluida"`).
#' @return list(datos, excluidas).
#' @noRd
.equiv_derivadas_preparar <- function(datos, filas, periodos, excluidas = list()) {
  compuestas <- Filter(function(f) !is.null(f$derivada), filas %||% list())
  if (!length(compuestas)) return(list(datos = datos, excluidas = excluidas))
  for (b in periodos) {
    excl <- as.character(excluidas[[b]] %||% character(0))
    for (f in compuestas) {
      e <- .equiv_deriv_entrada(f, b)
      if (is.null(e) || !any(.equiv_deriv_lista_chr(e$variables) %in% excl)) next
      excl <- unique(c(excl, .equiv_armon_chr((f$variables %||% list())[[b]], "")))
    }
    if (length(excl)) excluidas[[b]] <- excl
    datos[[b]] <- equiv_derivadas_materializar(datos[[b]], compuestas, b)
  }
  list(datos = datos, excluidas = excluidas)
}

#' Variable que nombra el aviso de una base: la de la fila, salvo que sea
#' compuesta y le falten componentes; entonces, esas componentes.
#' @noRd
.equiv_deriv_variable_aviso <- function(fila, base, df, excluidas = character(0)) {
  var <- .equiv_armon_chr((fila$variables %||% list())[[base]], "")
  faltan <- .equiv_deriv_faltantes(fila, base, df, excluidas)
  if (length(faltan)) paste(faltan, collapse = ", ") else var
}

# ---- Preview ---------------------------------------------------------------

#' Datos de la base para el preview de una fila compuesta: con el indicador
#' materializado, o 409 nombrando la componente que falta.
#' @noRd
.equiv_deriv_preview_df <- function(df, fila, base) {
  if (is.null(.equiv_deriv_entrada(fila, base))) return(df)
  faltan <- .equiv_deriv_faltantes(fila, base, df)
  if (length(faltan)) {
    stop_api(409, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE",
             sprintf("La variable «%s» del indicador «%s» no está en los datos de la base «%s».",
                     faltan[[1]], fila$etiqueta_estandar %||% "", base),
             list(base = base, variable = faltan[[1]], variables_ausentes = as.list(faltan)))
  }
  equiv_derivadas_materializar(df, list(fila), base)
}

# Opciones del indicador en la base: sus códigos son siempre 1 y 0.
.equiv_deriv_opciones <- function() {
  list(list(codigo = "1", etiqueta = "Sí"), list(codigo = "0", etiqueta = "No"))
}

#' Bloque `derivada` del preview: componentes, códigos y cuántos casos quedan
#' en 1, en 0 y sin dato (ADR 0105, punto 6). NULL si la fila no es compuesta.
#' @noRd
.equiv_deriv_preview_resumen <- function(fila, base, valores) {
  e <- .equiv_deriv_entrada(fila, base)
  if (is.null(e)) return(NULL)
  list(regla = fila$derivada$regla %||% "alguna",
       variables = as.list(.equiv_deriv_lista_chr(e$variables)),
       codigos = as.list(.equiv_deriv_lista_chr(e$codigos)),
       n_si = as.integer(sum(!is.na(valores) & valores == "1")),
       n_no = as.integer(sum(!is.na(valores) & valores == "0")),
       n_sin_dato = as.integer(sum(is.na(valores))))
}
