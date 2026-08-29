# Fusionar el libro leido con el plan que ya vive en la sesion.
#
# La importacion hacia `session_set(sid, "monitoreo_aulas_plan", out$plan)`: el
# plan del libro REEMPLAZABA al de la muestra. El libro no lleva la composicion
# muestral —`sex_top_1`, `sex_top_2` y sus n— porque es un artefacto de campo,
# asi que releerlo dejaba las cuotas sexo x facultad en CERO celdas y la
# representatividad efectiva en 100 % por no poder calcular desviacion. Medido:
# 12 celdas antes, 0 despues, sobre el mismo proyecto.
#
# Es el reflejo exacto de L44 —donde el GENERADOR escribia en blanco lo que el
# operativo ya tenia— en la direccion contraria: ahora es el LECTOR el que
# borra lo que no sabe escribir.

#' Los campos que el libro POSEE: los unicos que puede pisar.
#'
#' Es una lista explicita a proposito. Decidirlo por el valor —«si el libro trae
#' algo, manda»— no distingue un dato de un relleno: el lector emite
#' `sex_top_1_n = 0` porque su plantilla no pregunta por la composicion, no
#' porque el aula tenga cero mujeres, y ese cero borraba la muestra. Aqui la
#' proteccion es por DECLARACION, asi que un campo que el libro no recoge queda
#' a salvo aunque el lector lo emita.
#'
#' Sale de lo que las tres hojas realmente preguntan
#' (`carga_aulas_agendadas.R` y `carga_aulas_aplicadas.R`).
#' @export
AULAS_LIBRO_CAMPOS_PROPIOS <- c(
  # Identidad y agenda
  "label", "course_name", "faculty", "level", "teacher", "teacher_phone",
  "teacher_email", "schedule", "wave", "enrolled_total", "eligible_n",
  "selection_slot_id",
  # Estado y ciclo de contacto
  "sample_status", "contact_medium", "contact_date", "contact_attempts",
  "scheduled_date", "scheduled_day", "scheduled_time", "link",
  "replacement_note", "notes",
  # Parte de campo
  "actual_room", "attendees", "refusals", "duplicates", "applied_surveys",
  "effective_surveys", "application_status", "application_date", "field_notes"
)

#' Fusiona las filas del libro sobre el plan existente.
#'
#' El libro manda en lo que el libro sabe —estado, ciclo de contacto,
#' observaciones, el parte— y el plan conserva todo lo demas. Un valor **vacio**
#' del libro no pisa uno lleno del plan: entre perder la composicion muestral
#' entera y no poder blanquear un campo desde Excel, lo segundo es mucho menos
#' danino y mucho mas raro.
#'
#' Un aula que el libro NO menciona **se conserva** y se cuenta: el libro es un
#' registro de campo, no la fuente de la muestra, asi que su ausencia significa
#' que alguien borro la fila, no que el aula ya no exista.
#'
#' @param previo plan actual de la sesion (lista de filas).
#' @param nuevo plan leido del libro.
#' @return lista con `plan` fusionado, `actualizadas`, `nuevas` y `intactas`.
#' @export
aulas_libro_fusionar_plan <- function(previo = list(), nuevo = list()) {
  if (!length(previo)) return(list(plan = nuevo, actualizadas = 0L, nuevas = length(nuevo), intactas = 0L))
  if (!length(nuevo)) return(list(plan = previo, actualizadas = 0L, nuevas = 0L, intactas = length(previo)))

  clave <- function(fila) {
    for (campo in c("operational_code", "classroom_id", "collection_unit_id")) {
      v <- .alf_txt(fila[[campo]])
      if (nzchar(v)) return(v)
    }
    ""
  }

  indice <- list()
  for (i in seq_along(previo)) {
    k <- clave(previo[[i]])
    if (nzchar(k) && is.null(indice[[k]])) indice[[k]] <- i
  }

  plan <- previo
  vistas <- character(0)
  actualizadas <- 0L
  nuevas <- list()

  for (fila in nuevo) {
    k <- clave(fila)
    pos <- if (nzchar(k)) indice[[k]] else NULL
    if (is.null(pos)) {
      # Un aula que el libro trae y el plan no: entra tal cual. Descartarla
      # perderia una fila que alguien añadio a mano en campo.
      nuevas[[length(nuevas) + 1L]] <- fila
      next
    }
    vistas <- c(vistas, k)
    base <- plan[[pos]]
    for (campo in names(fila)) {
      # Solo pisa lo que el libro POSEE. `sample_role`, `replacement_for` y la
      # composicion muestral los deriva el lector de la POSICION en la hoja, no
      # de una pregunta, asi que dejarlos entrar reescribiria la muestra con una
      # lectura de forma.
      if (!campo %in% AULAS_LIBRO_CAMPOS_PROPIOS) {
        if (.alf_vacio(base[[campo]])) base[[campo]] <- fila[[campo]]
        next
      }
      valor <- fila[[campo]]
      if (.alf_vacio(valor) && !.alf_vacio(base[[campo]])) next
      base[[campo]] <- valor
    }
    plan[[pos]] <- base
    actualizadas <- actualizadas + 1L
  }

  list(
    plan = c(plan, nuevas),
    actualizadas = as.integer(actualizadas),
    nuevas = as.integer(length(nuevas)),
    intactas = as.integer(length(previo) - length(unique(vistas)))
  )
}

.alf_txt <- function(x) {
  v <- suppressWarnings(as.character(x %||% "")[1])
  if (is.na(v)) "" else trimws(v)
}

# Vacio es la cadena vacia, el NA y el NULL. El CERO no lo es: `respuestas = 0`
# es un dato del parte, no una ausencia, y tratarlo como vacia dejaria de poder
# corregir un conteo a la baja desde el libro.
.alf_vacio <- function(x) {
  if (is.null(x)) return(TRUE)
  if (length(x) == 0) return(TRUE)
  if (length(x) > 1) return(FALSE)
  if (is.na(x)) return(TRUE)
  if (is.character(x)) return(!nzchar(trimws(x)))
  FALSE
}
