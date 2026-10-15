# **La base preparada fuera también puede traer menos variables.** ADR 0100,
# Enmienda 1, pieza P2b.
#
# Una base preparada con un script puede llegar sin columnas del instrumento: en
# HSyVBG 2026 el script quitó `start` y `end`. El backfill de Carga recrea vacía
# una pregunta faltante («sin respuestas») y salta los metadatos, así que ni una
# ni otros se declaraban como retirados. Aquí la app DETECTA lo que falta y la
# declaración le pone motivo.
#
# Funciones puras (sin sesión): reciben el `survey` del XLSForm y los nombres de
# columna de la base tal como se cargó.

# `pendiente`: la carga manual registró la retirada y nadie le puso motivo aún
# (ADR 0106, punto 4). No excluye de los entregables.
.ORIGEN_EXTERNO_MOTIVOS_VARIABLE <- c("metadato", "no_va_al_cliente", "otra", "pendiente")

# Motivos que también retiran la variable de los entregables de Analítica.
.ORIGEN_EXTERNO_MOTIVOS_EXCLUYEN <- c("metadato", "no_va_al_cliente")

#' Variables del instrumento que se esperan como columna, con su tipo.
#'
#' El universo de `.dn_expected_data_names()` (sin grupos, notas, preguntas de
#' repeat ni headers de matriz) pero contando los metadatos y los `calculate`.
#'
#' @return data.frame `variable`, `tipo` (type base del XLSForm).
#' @keywords internal
.origen_externo_variables_esperadas <- function(survey) {
  nombres <- .dn_expected_data_names(list(survey = survey), con_metadatos = TRUE)
  if (!length(nombres)) return(data.frame(variable = character(0), tipo = character(0)))
  tipos <- .dn_survey_type_base(survey)[match(nombres, .dn_survey_names(survey))]
  data.frame(variable = nombres, tipo = tipos, stringsAsFactors = FALSE)
}

#' ¿Qué variables esperadas tienen columna en la base?
#'
#' Una variable está si una columna se llama igual o termina en `/<nombre>` (el
#' prefijo de grupo de Kobo, `grupo/P1`). La dummy de un select_multiple
#' (`P11/1`, `grupo/P11/1`) NO cuenta: su hoja es una opción, no una variable,
#' aunque una opción se llame como otra pregunta.
#'
#' @param variables nombres esperados. @param columnas nombres de la base.
#' @param select_multiple nombres de las preguntas select_multiple.
#' @return lógico, uno por variable.
#' @keywords internal
.origen_externo_variables_presentes <- function(variables, columnas, select_multiple = character(0)) {
  columnas <- as.character(columnas %||% character(0))
  columnas <- columnas[!is.na(columnas)]
  hojas <- sub("^.*/", "", columnas)
  padres <- ifelse(grepl("/", columnas, fixed = TRUE), sub("/[^/]*$", "", columnas), "")
  padre_hoja <- sub("^.*/", "", padres)
  es_dummy <- nzchar(padres) & padre_hoja %in% select_multiple
  hojas_validas <- unique(hojas[!es_dummy])
  variables %in% columnas | variables %in% hojas_validas
}

#' Variables del instrumento que no vienen en la base cargada.
#'
#' @return lista de `list(variable, tipo, motivo_sugerido)`; `motivo_sugerido`
#'   es "metadato" para los tipos de metadato del XLSForm y "" para el resto.
#' @keywords internal
origen_externo_variables_faltantes <- function(survey, columnas) {
  esperadas <- .origen_externo_variables_esperadas(survey)
  if (!nrow(esperadas)) return(list())
  tipos <- .dn_survey_type_base(survey)
  sm <- .dn_survey_names(survey)[tipos == "select_multiple"]
  presentes <- .origen_externo_variables_presentes(esperadas$variable, columnas, sm)
  faltan <- esperadas[!presentes, , drop = FALSE]
  lapply(seq_len(nrow(faltan)), function(i) list(
    variable = faltan$variable[[i]],
    tipo = faltan$tipo[[i]],
    motivo_sugerido = if (faltan$tipo[[i]] %in% .DN_TIPOS_METADATO) "metadato" else ""
  ))
}

#' Variables retiradas que se declaran, con su motivo, y los avisos.
#'
#' Sólo se aceptan variables que de verdad faltan. Toda faltante se registra:
#' con el motivo declarado, o con el sugerido, o con "otra".
#'
#' @param faltantes salida de `origen_externo_variables_faltantes()`.
#' @param columnas nombres de la base (para decir que una declarada sí está).
#' @param variables_motivo lista con nombre `variable -> motivo`.
#' @return `list(retiradas, avisos)`.
#' @keywords internal
origen_externo_variables_retiradas <- function(faltantes, columnas, variables_motivo = list()) {
  avisos <- list()
  aviso <- function(codigo, mensaje) avisos[[length(avisos) + 1L]] <<- list(codigo = codigo, mensaje = mensaje)
  nombres_faltan <- vapply(faltantes, function(f) f$variable, character(1))
  declarados <- variables_motivo %||% list()
  if (!is.list(declarados)) declarados <- as.list(declarados)
  declarados <- declarados[nzchar(names(declarados) %||% character(0))]
  motivos <- list()
  for (v in names(declarados)) {
    motivo <- .origen_externo_chr(declarados[[v]])
    if (!(v %in% nombres_faltan)) {
      if (any(.origen_externo_variables_presentes(v, columnas))) {
        aviso("variable_presente", sprintf(
          "«%s» sí viene en la base cargada: no se declara como retirada.", v))
      } else {
        aviso("variable_desconocida", sprintf(
          "«%s» no es una variable del instrumento de esta base: no se declara.", v))
      }
      next
    }
    if (!(motivo %in% .ORIGEN_EXTERNO_MOTIVOS_VARIABLE)) {
      aviso("motivo_invalido", sprintf(
        "El motivo «%s» de «%s» no es uno de %s: se guarda el sugerido.",
        motivo, v, paste(.ORIGEN_EXTERNO_MOTIVOS_VARIABLE, collapse = ", ")))
      next
    }
    motivos[[v]] <- motivo
  }
  retiradas <- lapply(faltantes, function(f) {
    motivo <- motivos[[f$variable]] %||% ""
    if (!nzchar(motivo)) motivo <- if (nzchar(f$motivo_sugerido)) f$motivo_sugerido else "otra"
    list(variable = f$variable, tipo = f$tipo, motivo = motivo)
  })
  list(retiradas = retiradas, avisos = avisos)
}

#' Agregado de variables retiradas para la ficha: total y conteo por motivo.
#' @keywords internal
.origen_externo_resumen_variables <- function(retiradas) {
  motivos <- vapply(retiradas %||% list(), function(r) .origen_externo_chr(r$motivo, "otra"), character(1))
  orden <- unique(c(.ORIGEN_EXTERNO_MOTIVOS_VARIABLE, motivos))
  n <- vapply(orden, function(m) sum(motivos == m), integer(1))
  list(
    total = length(motivos),
    por_motivo = lapply(orden[n > 0L], function(m) list(motivo = m, n = as.integer(n[[m]])))
  )
}

#' Suma a `variables_excluidas` las retiradas por metadato o no_va_al_cliente.
#'
#' Pura: recibe la config de Analítica de la base y devuelve la nueva y las
#' agregadas, sin duplicar las que ya estaban.
#' @keywords internal
.origen_externo_excluidas_con_retiradas <- function(cfg, retiradas) {
  cfg <- cfg %||% list()
  previas <- .as_chr_vec(cfg$variables_excluidas)
  candidatas <- vapply(Filter(function(r) .origen_externo_chr(r$motivo) %in% .ORIGEN_EXTERNO_MOTIVOS_EXCLUYEN,
                              retiradas %||% list()),
                       function(r) r$variable, character(1))
  agregadas <- setdiff(unique(candidatas), previas)
  cfg$variables_excluidas <- as.list(c(previas, agregadas))
  list(cfg = cfg, agregadas = agregadas)
}
