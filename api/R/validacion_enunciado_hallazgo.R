# =============================================================================
# Enunciado del hallazgo de un caso, por subtipo de regla (M4, cambio 4)
# =============================================================================
# Lo que el detalle de una regla y GET /caso muestran por caso marcado: quién,
# qué respondió, con qué choca y qué hacer. Hasta M4 el enunciado no conocía la
# regla: una restricción de rango decía "ese valor no está entre las opciones
# de la pregunta", un salto "debe responderse" escribía "Respondió sin
# respuesta" y el factor del salto podía ser uno vacío. Ahora se redacta por
# subtipo, con lo que la regla declara (límites, dirección del salto, códigos
# especiales del estudio), en comillas rectas y sin punto medio.
#
# Subtipos (`.validacion_subtipo_hallazgo()`):
#   rango         rango numérico propio o del motor: fuera del rango permitido.
#   restriccion   restricción del formulario (con sus límites si los tiene).
#   fecha         fecha fuera del periodo permitido.
#   especial      un código especial declarado por el estudio en una regla de
#                 rango, fecha o restricción (D-F6 sin decidir: la regla lo
#                 sigue marcando y el enunciado lo dice).
#   catalogo      valor que no está entre las opciones de la pregunta.
#   salto_debe    vacía cuando le correspondía responder.
#   salto_nodebe  respondida cuando no le correspondía.
#   calculo       el valor calculado no coincide con su fórmula.
#   coherencia    dos respuestas que no son compatibles.
#   faltante      obligatoria y vacía.
#   periodo, version, continuidad  procedencia del caso.
#   bateria       patrón en una batería: qué respondió en cuántas preguntas
#                 (validacion_regla_bateria.R). No depende del tipo de anomalía.
#   contradiccion, valor_invalido, procedencia  sin más datos de la regla.
# Sin tipo de anomalía no hay enunciado (null): no se inventa.

.enun_rotulo <- function(var, regla) {
  lab <- as.character((regla$etiquetas %||% list())[[var]] %||% "")[1]
  if (is.na(lab) || !nzchar(trimws(lab)) || identical(trimws(lab), var)) var else trimws(lab)
}

.enun_vacio <- function(v) {
  v <- trimws(as.character(v %||% NA_character_)[1])
  is.na(v) || !nzchar(v) || identical(v, "NA")
}

# "17", o "Sí" (1) cuando el valor es una opción con rótulo (etiqueta primero,
# código detrás). Un código especial declarado lleva su rótulo del estudio.
.enun_valor <- function(valor, etiquetas = NULL, especiales = NULL) {
  v <- trimws(as.character(valor %||% "")[1])
  et <- if (!is.null(etiquetas)) as.character(etiquetas[[v]] %||% "")[1] else ""
  if ((is.na(et) || !nzchar(et)) && !is.null(especiales) && v %in% names(especiales)) {
    et <- as.character(especiales[[v]] %||% "")[1]
  }
  if (!is.na(et) && nzchar(et)) sprintf("\"%s\" (%s)", et, v) else sprintf("\"%s\"", v)
}

.enun_numero <- function(x) {
  n <- suppressWarnings(as.numeric(x))
  if (is.na(n)) as.character(x) else format(n, scientific = FALSE, trim = TRUE, drop0trailing = TRUE)
}

# "(18 a 80)", "(mayor o igual a 0)"; NULL sin límites.
.enun_limites_rango <- function(lim, con_entre = FALSE, rotulo = NULL) {
  if (!is.list(lim)) return(NULL)
  mn <- as.character(lim$min %||% NA)[1]; mx <- as.character(lim$max %||% NA)[1]
  pre <- if (!is.null(rotulo)) paste0(rotulo, " ") else ""
  if (!is.na(mn) && !is.na(mx)) {
    if (con_entre) return(sprintf("(%sentre %s y %s)", pre, .enun_numero(mn), .enun_numero(mx)))
    return(sprintf("(%s%s a %s)", pre, .enun_numero(mn), .enun_numero(mx)))
  }
  if (!is.na(mn)) return(sprintf("(%s%s %s)", pre, if (isFALSE(lim$inclusive_min)) "mayor que" else "mayor o igual a", .enun_numero(mn)))
  if (!is.na(mx)) return(sprintf("(%s%s %s)", pre, if (isFALSE(lim$inclusive_max)) "menor que" else "menor o igual a", .enun_numero(mx)))
  NULL
}

.enun_limites_fecha <- function(lim) {
  if (!is.list(lim)) return(NULL)
  mn <- as.character(lim$min %||% NA)[1]; mx <- as.character(lim$max %||% NA)[1]
  if (!is.na(mn) && !is.na(mx)) return(sprintf("(del %s al %s)", mn, mx))
  if (!is.na(mn)) return(sprintf("(desde el %s)", mn))
  if (!is.na(mx)) return(sprintf("(hasta el %s)", mx))
  NULL
}

# Evalúa la condición de un salto con los valores del caso y devuelve la
# pregunta que decide su resultado: en un "y" verdadero, la primera; en uno
# falso, la primera falsa; en un "o" verdadero, la primera verdadera. NA si la
# condición no se puede evaluar con lo que hay (entonces se usa el primer factor
# con valor).
.enun_factor_que_decide <- function(cond, valores) {
  if (is.null(cond) || !is_ast(cond)) return(NA_character_)
  r <- tryCatch(.enun_evaluar(cond, valores), error = function(e) list(val = NA, var = NA_character_))
  if (isTRUE(r$val)) r$var else NA_character_
}

.enun_evaluar <- function(x, valores) {
  na <- list(val = NA, var = NA_character_)
  op <- ast_op(x)
  leer <- function(v) { y <- trimws(as.character(valores[[v]] %||% NA)[1]); if (is.na(y) || !nzchar(y)) NA_character_ else y }
  if (op %in% c("compare_const", "in_set", "not_in_set", "is_missing", "selected")) {
    var <- as.character(x$var)
    v <- leer(var)
    if (identical(op, "is_missing")) return(list(val = is.na(v), var = var))
    if (is.na(v)) return(list(val = NA, var = var))
    val <- switch(op,
      compare_const = {
        k <- as.character(x$value)[1]
        a <- suppressWarnings(as.numeric(v)); b <- suppressWarnings(as.numeric(k))
        num <- !is.na(a) && !is.na(b)
        switch(as.character(x$op),
               "==" = if (num) a == b else v == k, "!=" = if (num) a != b else v != k,
               "<" = if (num) a < b else NA, "<=" = if (num) a <= b else NA,
               ">" = if (num) a > b else NA, ">=" = if (num) a >= b else NA, NA)
      },
      in_set = v %in% as.character(x$values),
      not_in_set = !(v %in% as.character(x$values)),
      selected = as.character(x$value)[1] %in% strsplit(v, "[[:space:]]+")[[1]])
    return(list(val = val, var = var))
  }
  if (identical(op, "not")) {
    r <- .enun_evaluar(x$arg, valores)
    return(list(val = !r$val, var = r$var))
  }
  if (op %in% c("and", "or")) {
    rs <- lapply(x$args, .enun_evaluar, valores = valores)
    vals <- vapply(rs, function(r) as.logical(r$val)[1], logical(1))
    vars <- vapply(rs, function(r) as.character(r$var)[1], character(1))
    if (identical(op, "and")) {
      if (any(vals %in% FALSE)) return(list(val = FALSE, var = vars[which(vals %in% FALSE)[1]]))
      if (all(vals %in% TRUE)) return(list(val = TRUE, var = vars[1]))
      return(na)
    }
    if (any(vals %in% TRUE)) return(list(val = TRUE, var = vars[which(vals %in% TRUE)[1]]))
    if (all(vals %in% FALSE)) return(list(val = FALSE, var = vars[1]))
    return(na)
  }
  na
}

#' Subtipo del hallazgo de una regla
#'
#' @param anomalia tipo de anomalía (`validacion_anomalia_tipo()`).
#' @param regla contexto de la regla (`.validacion_contexto_enunciado()`).
#' @return código del subtipo, o NA sin anomalía.
#' @keywords internal
.validacion_subtipo_hallazgo <- function(anomalia, regla = list()) {
  # Una batería se redacta por su patrón aunque no tenga tipo de anomalía: el
  # enunciado dice lo que se midió en el caso, no lo clasifica.
  if (!is.null(regla$bateria)) return("bateria")
  a <- as.character(anomalia %||% NA_character_)[1]
  if (is.na(a) || !nzchar(a)) return(NA_character_)
  tipo <- as.character(regla$tipo_regla %||% "")[1]
  familia <- as.character(regla$familia %||% "")[1]
  semilla <- as.character(regla$origen_semilla %||% "")[1]
  dir <- as.character(regla$direccion %||% "")[1]
  lim_tipo <- as.character((if (is.list(regla$limites)) regla$limites$tipo else NA) %||% NA)[1]
  if (identical(a, "faltante")) return("faltante")
  if (identical(tipo, "skip") || identical(familia, "salto")) {
    if (identical(dir, "nodebe")) return("salto_nodebe")
    if (identical(dir, "debe")) return("salto_debe")
  }
  if (identical(tipo, "calculate_check") || identical(familia, "calculo")) return("calculo")
  if (identical(a, "procedencia")) {
    if (identical(semilla, "periodo") || identical(familia, "periodo")) return("periodo")
    if (identical(semilla, "procedencia")) return("version")
    if (identical(semilla, "continuidad") || identical(familia, "continuidad_secuencia")) return("continuidad")
    return("procedencia")
  }
  if (identical(a, "valor_invalido")) {
    if (identical(semilla, "dominio") || familia %in% c("fuera_catalogo") || identical(tipo, "catalog")) return("catalogo")
    if (identical(familia, "rango_fecha") || identical(lim_tipo, "fecha")) return("fecha")
    if (identical(familia, "rango_num") || identical(tipo, "range")) return("rango")
    if (familia %in% c("restriccion", "filtro_opciones")) return("restriccion")
    return("valor_invalido")
  }
  if (identical(a, "contradiccion")) {
    if (familia %in% c("coherencia_2v") || identical(tipo, "coherence")) return("coherencia")
    return("contradiccion")
  }
  a
}

#' Redactar el hallazgo de un caso
#'
#' Cuatro piezas en este orden: quién, qué hizo, con qué choca, qué hacer.
#' `texto` es "<caso>: <hecho><separador><choque>. <acción>".
#'
#' @param anomalia slug del tipo (`validacion_anomalia_tipo()`).
#' @param roles `variable_roles` de la regla: target, drivers y labels.
#' @param caso identificador del caso.
#' @param valores lista nombrada con el valor observado de cada variable.
#' @param accion acción sugerida, ya en texto.
#' @param etiquetas_valor lista por variable con el mapa código a rótulo de sus
#'   opciones.
#' @param regla contexto de la regla (`.validacion_contexto_enunciado()`):
#'   tipo_regla, familia, direccion, limites, origen_semilla, especiales
#'   (código a rótulo), etiquetas (pregunta a rótulo), version_vigente,
#'   faltantes. Sin él, el enunciado sale por el tipo de anomalía.
#' @return lista con `subtipo`, `sujeto`, `hecho`, `choque`, `accion` y `texto`.
#' @family validacion
#' @export
validacion_enunciado_hallazgo <- function(anomalia, roles, caso,
                                          valores = list(), accion = NULL,
                                          etiquetas_valor = list(), regla = NULL) {
  roles <- roles %||% list()
  regla <- regla %||% list()
  regla$etiquetas <- c(regla$etiquetas %||% list(), roles$labels %||% list())
  target <- as.character(unlist(roles$target %||% ""))[1]
  if (is.na(target)) target <- ""
  drivers <- as.character(unlist(roles$drivers %||% list()))
  # El factor que explica el hallazgo es el que tiene valor en ESTE caso: el
  # gate de un salto incluye variables de contexto que pueden estar vacías.
  drivers <- drivers[drivers != target & drivers %in% names(valores)]
  drivers <- drivers[!vapply(drivers, function(v) .enun_vacio(valores[[v]]), logical(1))]
  # En un salto se nombra el factor que DECIDE la condición en este caso (el
  # que la hace verdadera), no el primero con valor.
  decide <- .enun_factor_que_decide(regla$condicion, valores)
  if (!is.na(decide) && decide != target && !.enun_vacio(valores[[decide]])) {
    drivers <- unique(c(decide, drivers))
  }
  esp <- regla$especiales
  sub <- .validacion_subtipo_hallazgo(anomalia, regla)
  v_target <- if (nzchar(target)) valores[[target]] else NA
  et_target <- if (nzchar(target)) etiquetas_valor[[target]] else NULL
  if (!is.na(sub) && sub %in% c("rango", "restriccion", "fecha") && !.enun_vacio(v_target) &&
      trimws(as.character(v_target)) %in% names(esp %||% list())) sub <- "especial"
  rot <- if (nzchar(target)) .enun_rotulo(target, regla) else ""
  val <- if (.enun_vacio(v_target)) NULL else .enun_valor(v_target, et_target, esp)
  respondio <- if (is.null(val)) sprintf("dejó vacía %s", rot) else sprintf("respondió %s en %s", val, rot)
  factor_ <- if (length(drivers)) {
    sprintf("%s en %s", .enun_valor(valores[[drivers[1]]], etiquetas_valor[[drivers[1]]], esp),
            .enun_rotulo(drivers[1], regla))
  } else NULL
  sep <- ", "
  hecho <- respondio
  choque <- switch(
    as.character(sub %||% ""),
    rango = paste("fuera del rango permitido", .enun_limites_rango(regla$limites) %||% "") |> trimws(),
    restriccion = paste("que no cumple la restricción del formulario",
                        .enun_limites_rango(regla$limites, con_entre = TRUE, rotulo = rot) %||% "") |> trimws(),
    fecha = {
      hecho <- if (is.null(val)) respondio else sprintf("registró %s en %s", val, rot)
      paste("fuera del periodo permitido", .enun_limites_fecha(regla$limites) %||% "") |> trimws()
    },
    especial = sprintf("un código especial que %s no admite",
                       switch(as.character(regla$familia %||% ""),
                              restriccion = , filtro_opciones = "la restricción del formulario",
                              rango_fecha = , periodo = "la regla de fechas",
                              "la regla de rango")),
    catalogo = "que no está entre las opciones de la pregunta",
    salto_debe = {
      hecho <- sprintf("dejó vacía %s", rot)
      if (is.null(factor_)) "que correspondía responder"
      else sprintf("que correspondía responder porque declaró %s", factor_)
    },
    salto_nodebe = if (is.null(factor_)) "que no correspondía responder"
                   else sprintf("que no correspondía porque declaró %s", factor_),
    calculo = {
      hecho <- sprintf("el valor calculado de %s (%s)", rot,
                       if (is.null(val)) "vacío" else val)
      sep <- " "
      "no coincide con el que resulta de sus componentes"
    },
    coherencia = if (is.null(factor_)) "que no es compatible con otra respuesta del caso"
                 else sprintf("que no es compatible con %s", factor_),
    contradiccion = if (is.null(factor_)) "que contradice otra respuesta del caso"
                    else sprintf("que contradice %s", factor_),
    faltante = { hecho <- sprintf("dejó vacía %s", rot); "que es obligatoria" },
    valor_invalido = "un valor que la pregunta no admite",
    periodo = {
      hecho <- if (is.null(val)) sprintf("no tiene fecha en %s", rot) else
        sprintf("se registró el %s", trimws(as.character(v_target)))
      paste("fuera del periodo de campo", .enun_limites_fecha(regla$limites) %||% "") |> trimws()
    },
    version = {
      hecho <- if (is.null(val)) "no trae la versión del formulario" else
        sprintf("se recolectó con la versión %s del formulario", val)
      sep <- "; "
      vig <- as.character(regla$version_vigente %||% NA)[1]
      if (is.na(vig) || !nzchar(vig)) "el estudio declara otra versión" else sprintf("el estudio declara \"%s\"", vig)
    },
    continuidad = {
      n <- suppressWarnings(as.integer(as.character(v_target)))
      falt <- suppressWarnings(as.integer(unlist(regla$faltantes %||% list())))
      sig <- if (!is.na(n) && length(falt)) suppressWarnings(min(falt[falt > n])) else NA
      hecho <- if (is.na(n)) "el caso no trae su número de envío" else
        sprintf("es el envío %d de la numeración del servidor", n)
      sep <- " "
      if (is.finite(sig)) sprintf("y falta el envío %d", as.integer(sig))
      else "y después falta un envío que el servidor numeró"
    },
    procedencia = { sep <- " "; "y el caso no se recolectó como el estudio declaró" },
    bateria = {
      b <- .regla_bateria_enunciado(regla$bateria, valores, etiquetas_valor)
      hecho <- b$hecho
      b$choque
    },
    ""
  )
  if (!nzchar(target) && !(sub %in% c("procedencia"))) hecho <- ""

  acc <- as.character(accion %||% "")[1]
  if (is.na(acc) || !nzchar(acc)) {
    acc <- if (identical(as.character(anomalia %||% ""), "procedencia")) {
      "Confirmar con campo antes de decidir si el caso entra."
    } else "Revisar y corregir en Limpieza."
  }
  sujeto <- as.character(caso %||% "")[1]
  if (is.na(sujeto)) sujeto <- ""
  cuerpo <- paste0(hecho, if (nzchar(hecho) && nzchar(choque)) sep else "", choque)
  if (!nzchar(sujeto)) cuerpo <- paste0(toupper(substr(cuerpo, 1, 1)), substring(cuerpo, 2))
  texto <- paste0(if (nzchar(sujeto)) paste0(sujeto, ": ") else "", cuerpo, ". ", acc)
  list(subtipo = sub, sujeto = sujeto, hecho = hecho, choque = choque, accion = acc, texto = texto)
}

# --- Contexto de una regla para redactar --------------------------------------

#' Contexto de redacción de una regla de la última auditoría
#'
#' @param scope scope de la base.
#' @param id_regla id del motor.
#' @param inst instrumento (o NULL).
#' @param especiales códigos especiales declarados por el estudio (código a
#'   rótulo; `validacion_codigos_especiales_declarados()`).
#' @return lista para `validacion_enunciado_hallazgo(regla = )`.
#' @keywords internal
.validacion_contexto_enunciado <- function(scope, id_regla, inst = NULL, especiales = NULL) {
  id <- as.character(id_regla)
  propias <- scope$reglas_custom %||% list()
  ids_propias <- vapply(propias, function(r) as.character(r$id %||% ""), character(1))
  propia <- if (id %in% ids_propias) propias[[match(id, ids_propias)]] else NULL
  reglas <- c(scope$evaluacion$bundle$rules %||% list(), scope$plan_result$bundle$rules %||% list())
  rule <- Find(function(r) identical(as.character(r$id %||% ""), id), reglas)
  ctx <- .vrf_contexto(inst)
  etiquetas <- as.list(ctx$etiquetas)
  if (is.null(rule)) {
    return(list(tipo_regla = as.character(propia$tipo %||% NA_character_), familia = as.character(propia$tipo %||% ""),
                origen_semilla = (propia$semilla %||% list())$origen %||% NA_character_,
                especiales = especiales, etiquetas = etiquetas,
                bateria = .regla_bateria_contexto(propia)))
  }
  origen <- .vrc_origen(rule, ids_propias)
  familia <- .vrc_familia(rule, origen, propia = propia)
  limites <- tryCatch(.vrc_limites(.vrc_cuerpo(rule, familia), familia, ctx), error = function(e) NA)
  semilla <- (propia$semilla %||% list())
  direccion <- as.character((rule$presentation %||% list())$subtipo_semantico %||% NA_character_)
  target <- as.character((rule$variable_roles %||% list())$target %||% rule$primary_var %||% "")[1]
  condicion <- if (identical(as.character(rule$tipo_regla), "skip") && direccion %in% c("debe", "nodebe")) {
    tryCatch(.vrb_condicion_salto(rule$predicate, target, direccion), error = function(e) NULL)
  } else NULL
  list(
    condicion = condicion,
    tipo_regla = as.character(rule$tipo_regla %||% NA_character_),
    familia = familia,
    direccion = as.character((rule$presentation %||% list())$subtipo_semantico %||% NA_character_),
    limites = limites,
    origen_semilla = as.character(semilla$origen %||% NA_character_),
    version_vigente = as.character(semilla$version_vigente %||%
                                     unlist((propia$params %||% list())$valores %||% list())[1] %||% NA_character_),
    faltantes = semilla$faltantes %||% list(),
    especiales = especiales,
    etiquetas = etiquetas,
    bateria = .regla_bateria_contexto(propia)
  )
}
