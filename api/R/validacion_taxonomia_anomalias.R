# =============================================================================
# Taxonomía de anomalías de Validación
# =============================================================================
# Hasta acá todo lo que encontraba Validación caía en un solo saco llamado
# "inconsistencia", y por eso un dato imposible pesaba lo mismo que un caso
# recolectado con otro formulario. Son cosas distintas y se resuelven distinto:
# unas se corrigen en Limpieza, otra se corrige hablando con campo.
#
# Cuatro tipos, acordados con el equipo (2026-08-12):
#
#   contradiccion  dos datos que no pueden coexistir. Se ve mirando OTRO dato.
#   valor_invalido un valor inválido en sí mismo. Se ve mirando su catálogo.
#   faltante       debía responderse y no está.
#   procedencia    de dónde salió el caso: con qué formulario, cuándo, si llegó
#                  completo. No es un error del encuestado.
#
# Regla de la casa: las tres primeras se corrigen en el dato; procedencia se
# confirma con campo. Por eso `procedencia` no propone acción de limpieza.
#
# Lo que NO está acá: duración de entrevista, entrevistas simultáneas, nombres
# del encuestador. Eso es comportamiento del equipo y su módulo es Monitoreo
# (recorte de alcance del 2026-08-12).
# =============================================================================

.VALIDACION_ANOMALIAS <- list(
  contradiccion = list(
    slug = "contradiccion",
    etiqueta = "Contradicción",
    descripcion = "Dos datos del mismo caso no pueden ser ciertos a la vez.",
    corrige = "dato",
    orden = 1L
  ),
  valor_invalido = list(
    slug = "valor_invalido",
    etiqueta = "Valor inválido",
    descripcion = "El valor no existe entre las opciones de su pregunta.",
    corrige = "dato",
    orden = 2L
  ),
  faltante = list(
    slug = "faltante",
    etiqueta = "Faltante indebido",
    descripcion = "La pregunta debía responderse y quedó vacía.",
    corrige = "dato",
    orden = 3L
  ),
  procedencia = list(
    slug = "procedencia",
    etiqueta = "Anomalía de procedencia",
    descripcion = "El caso no se recolectó como el estudio declaró: otra versión del formulario, fuera del periodo de campo, o un envío que no llegó.",
    corrige = "campo",
    orden = 4L
  )
)

#' Catálogo de tipos de anomalía
#'
#' Lo consume la UI para rotular y ordenar. Se expone entero en vez de dejar que
#' cada superficie invente sus propias etiquetas.
#'
#' @return lista de tipos con slug, etiqueta, descripción y qué se corrige.
#' @family validacion
#' @export
validacion_anomalias_catalogo <- function() {
  unname(.VALIDACION_ANOMALIAS[order(vapply(.VALIDACION_ANOMALIAS,
                                            function(x) x$orden, integer(1)))])
}

# Sembradores → tipo. El sembrador sabe qué está midiendo mejor que nadie, así
# que su `semilla$origen` manda sobre cualquier heurística.
.VALIDACION_ANOMALIA_POR_SEMILLA <- c(
  procedencia  = "procedencia",   # más de una versión del formulario
  continuidad  = "procedencia",   # envíos que el servidor numeró y no llegaron
  periodo      = "procedencia",   # recolectado fuera de la ventana de campo
  dominio      = "valor_invalido" # valor que su lista no contiene
)

# Reglas derivadas del XLSForm → tipo. `skip` es el salto violado: la respuesta
# contradice al dato que gobierna su relevancia. `required` es el faltante.
# `constraint` declara un dominio a mano, así que es valor inválido.
.VALIDACION_ANOMALIA_POR_TIPO_REGLA <- c(
  skip             = "contradiccion",
  required         = "faltante",
  constraint       = "valor_invalido",
  calculate_check  = "contradiccion",
  coherencia_2v    = "contradiccion",
  no_nulo          = "faltante",
  fuera_catalogo   = "valor_invalido",
  rango_num        = "valor_invalido",
  rango_fecha      = "valor_invalido",
  continuidad_secuencia = "procedencia"
)

#' Clasificar una anomalía
#'
#' Resuelve en tres pasos, del más específico al más general: lo que la regla
#' declaró explícitamente, lo que su sembrador sabe que mide, y por último el
#' tipo de regla. Sin ninguno de los tres devuelve `NA`, que la UI muestra como
#' "sin clasificar" — nunca inventa un tipo.
#'
#' @param tipo_regla tipo de la regla (`skip`, `required`, `fuera_catalogo`…).
#' @param origen_semilla `semilla$origen` cuando la regla nació de un sembrador.
#' @param declarado tipo declarado explícitamente en la regla, si lo hay.
#' @return slug del tipo, o `NA_character_`.
#' @family validacion
#' @export
validacion_anomalia_tipo <- function(tipo_regla = NULL,
                                     origen_semilla = NULL,
                                     declarado = NULL) {
  d <- as.character(declarado %||% "")[1]
  if (!is.na(d) && nzchar(d) && d %in% names(.VALIDACION_ANOMALIAS)) return(d)

  o <- as.character(origen_semilla %||% "")[1]
  if (!is.na(o) && nzchar(o) && o %in% names(.VALIDACION_ANOMALIA_POR_SEMILLA)) {
    return(unname(.VALIDACION_ANOMALIA_POR_SEMILLA[[o]]))
  }

  t <- as.character(tipo_regla %||% "")[1]
  if (!is.na(t) && nzchar(t) && t %in% names(.VALIDACION_ANOMALIA_POR_TIPO_REGLA)) {
    return(unname(.VALIDACION_ANOMALIA_POR_TIPO_REGLA[[t]]))
  }
  NA_character_
}

#' Etiqueta humana de un tipo de anomalía
#'
#' @param slug slug del tipo.
#' @return etiqueta, o "Sin clasificar" si el slug no existe.
#' @family validacion
#' @export
validacion_anomalia_etiqueta <- function(slug) {
  s <- as.character(slug %||% "")[1]
  if (is.na(s) || !nzchar(s) || !(s %in% names(.VALIDACION_ANOMALIAS))) {
    return("Sin clasificar")
  }
  .VALIDACION_ANOMALIAS[[s]]$etiqueta
}

#' ¿Este tipo se corrige tocando el dato?
#'
#' Procedencia no: un caso recolectado con otro formulario no se arregla
#' editándolo. Lo consume Limpieza para no ofrecer una acción que no aplica.
#'
#' @param slug slug del tipo.
#' @return TRUE si se corrige en el dato.
#' @family validacion
#' @export
validacion_anomalia_corrige_dato <- function(slug) {
  s <- as.character(slug %||% "")[1]
  if (is.na(s) || !(s %in% names(.VALIDACION_ANOMALIAS))) return(FALSE)
  identical(.VALIDACION_ANOMALIAS[[s]]$corrige, "dato")
}

# =============================================================================
# Enunciado del hallazgo
# =============================================================================
# Lo que Validación muestra hoy describe LA REGLA: un enunciado universal,
# negado y sin sujeto —"Si NO se cumple que (X es alguna de A, B, C y…),
# entonces P no debe responderse"—. Es correcto y obliga a deshacer una doble
# negación mental para entender qué pasó, y aun así no dice a quién le pasó.
#
# Lo que hace falta es describir EL HECHO: sujeto, qué respondió, con qué choca,
# qué hacer. La materia prima ya se calcula — `variable_roles` trae target,
# drivers y las etiquetas humanas de cada variable. Faltaba redactarlo.

.enun_etiqueta <- function(roles, var) {
  labs <- roles$labels %||% list()
  et <- as.character(labs[[var]] %||% "")[1]
  if (is.na(et) || !nzchar(et) || identical(et, var)) sprintf("«%s»", var)
  else sprintf("«%s» (%s)", et, var)
}

.enun_valor <- function(valor, etiquetas = NULL) {
  v <- trimws(as.character(valor %||% "")[1])
  if (is.na(v) || !nzchar(v) || v == "NA") return("sin respuesta")
  # Misma regla que el resto de la app: la etiqueta primero, el código detrás.
  # Un «4» no dice nada; «No estoy trabajando» (4) sí.
  et <- if (!is.null(etiquetas)) as.character(etiquetas[[v]] %||% "")[1] else ""
  if (!is.na(et) && nzchar(et)) sprintf("«%s» (%s)", et, v) else sprintf("«%s»", v)
}

#' Redactar el hallazgo de un caso
#'
#' Cuatro piezas fijas y en este orden: quién, qué hizo, con qué choca, qué
#' hacer. El sujeto va primero porque es lo que el equipo necesita para ir a
#' buscar el caso; la acción va al final porque es lo que se decide después de
#' entender.
#'
#' @param anomalia slug del tipo (`validacion_anomalia_tipo()`).
#' @param roles `variable_roles` de la regla: target, drivers y labels.
#' @param caso identificador del caso — código de campo o uuid.
#' @param valores lista nombrada con el valor observado de cada variable.
#' @param accion acción sugerida, ya en texto.
#' @param etiquetas_valor lista por variable con el mapa código → etiqueta de su
#'   lista de opciones, para que el enunciado diga «No estoy trabajando» (4) y
#'   no «4».
#' @return lista con `sujeto`, `hecho`, `choque`, `accion` y `texto` armado.
#' @family validacion
#' @export
validacion_enunciado_hallazgo <- function(anomalia, roles, caso,
                                          valores = list(), accion = NULL,
                                          etiquetas_valor = list()) {
  roles <- roles %||% list()
  target <- as.character(roles$target %||% "")[1]
  drivers <- as.character(unlist(roles$drivers %||% list()))
  # El gate del salto incluye variables de contexto —consentimiento, ruta del
  # estudio— que se cumplen en casi todos los casos y no explican nada. El
  # driver que importa es el que cambió de valor en ESTE caso, y ese es el que
  # trae un valor observado.
  drivers <- drivers[drivers != target & drivers %in% names(valores)]

  sujeto <- as.character(caso %||% "")[1]
  hecho <- if (nzchar(target)) {
    sprintf("Respondió %s en %s",
            .enun_valor(valores[[target]], etiquetas_valor[[target]]),
            .enun_etiqueta(roles, target))
  } else ""

  choque <- switch(
    as.character(anomalia %||% ""),
    contradiccion = if (length(drivers)) {
      sprintf("pero había declarado %s en %s",
              .enun_valor(valores[[drivers[1]]], etiquetas_valor[[drivers[1]]]),
              .enun_etiqueta(roles, drivers[1]))
    } else "pero contradice otro dato del mismo caso",
    valor_invalido = "y ese valor no está entre las opciones de la pregunta",
    faltante = "y la pregunta debía responderse",
    procedencia = "y el caso no se recolectó como el estudio declaró",
    ""
  )
  if (identical(as.character(anomalia %||% ""), "faltante") && nzchar(target)) {
    hecho <- sprintf("Dejó vacía %s", .enun_etiqueta(roles, target))
    choque <- "y debía responderse"
  }

  acc <- as.character(accion %||% "")[1]
  if (is.na(acc) || !nzchar(acc)) {
    acc <- if (identical(as.character(anomalia %||% ""), "procedencia")) {
      "Confirmar con campo antes de decidir si el caso entra."
    } else "Revisar y corregir en Limpieza."
  }

  texto <- paste0(
    if (nzchar(sujeto)) paste0(sujeto, " · ") else "",
    hecho,
    if (nzchar(choque)) paste0(" ", choque) else "",
    ". ", acc
  )
  list(sujeto = sujeto, hecho = hecho, choque = choque, accion = acc, texto = texto)
}

# =============================================================================
# Estado del dato vs estado de la regla
# =============================================================================
# `estado_dinamico` dice "correcta" en una regla que encontró inconsistencias, y
# no está mal: califica si la REGLA se pudo evaluar, no si el dato está bien.
# El problema es de lectura — en pantalla queda "correcta" al lado de
# "1 inconsistencia". En vez de renombrar un campo que consumen varias
# superficies, se agrega el que faltaba: el que sí habla del dato.

#' Estado del dato para una regla evaluada
#'
#' @param estado_regla valor de `estado_dinamico` (si la regla pudo evaluarse).
#' @param n_inconsistencias hallazgos de esa regla.
#' @return `"no_evaluada"`, `"limpio"` o `"con_hallazgos"`.
#' @family validacion
#' @export
validacion_estado_dato <- function(estado_regla, n_inconsistencias) {
  er <- as.character(estado_regla %||% "")[1]
  # Si la regla no corrió, del dato no sabemos nada — y decir "limpio" sería
  # afirmar algo que nadie verificó.
  if (!identical(er, "correcta")) return("no_evaluada")
  n <- suppressWarnings(as.integer(n_inconsistencias %||% 0L))[1]
  if (is.na(n) || n <= 0L) "limpio" else "con_hallazgos"
}

#' Etiqueta humana del estado del dato
#' @param slug estado devuelto por `validacion_estado_dato()`.
#' @family validacion
#' @export
validacion_estado_dato_etiqueta <- function(slug) {
  switch(as.character(slug %||% "")[1],
    limpio = "Sin hallazgos",
    con_hallazgos = "Con hallazgos",
    "No evaluada")
}
