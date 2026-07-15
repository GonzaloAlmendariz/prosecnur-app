# ADR 0035 — Etiqueta de MAYOR JERARQUÍA docente por curso-horario.
#
# Un curso-horario (CH) puede tener varios docentes (p.ej. JEFE DE PRÁCTICA +
# DOCENTE CONTRATADO). El aula_frame ya expone `teacher_type` como el CONJUNTO
# concatenado de tipos únicos (" | ") y la INCLUSIÓN es "al menos uno"
# (match:any) — eso NO se toca. Aquí se agrega, en paralelo y SOLO como
# etiqueta/catálogo, `teacher_type_top`: de las categorías presentes en ese CH,
# la de MAYOR rango según un orden configurable (o el orden por defecto
# académico). No participa de la evaluación del criterio ni cambia la inclusión.
#
# Este archivo existe para no engrosar calc_muestra_aulas_criterios.R con la
# lógica de ranking; se llama con una línea desde .cm_criterios_stats_por_aula.

# Orden por defecto (ALTO→BAJO), derivado de la estructura jerárquica existente
# de teacher_type. Criterio académico: docente ordinario (principal > asociado >
# auxiliar) por encima del contratado, este por encima del extraordinario, y el
# pre-docente / jefe de práctica al final antes de "cualquier otro". Cada entrada
# es una CLAVE canónica (.cm_aulas_text_key) que puede ser un child completo o un
# prefijo de GRUPO: una entrada de grupo ("docente_contratado") cubre a todos sus
# children ("docente_contratado_contratado"). Las claves desconocidas rankean al
# fondo (rango Inf) y el empate se resuelve por primera vista.
.cm_criterios_teacher_orden_default <- function() {
  c(
    "docente_ordinario_principal",
    "docente_ordinario_asociado",
    "docente_ordinario_auxiliar",
    "docente_ordinario",       # cualquier otro ordinario sin detalle de nivel
    "docente_contratado",      # grupo → contratado_contratado y afines
    "docente_extraordinario",  # grupo → todos los extraordinarios
    "pre_docente",             # grupo → jefe de práctica y afines (pre-docente)
    "jefe_de_practica"         # valor "JEFE DE PRÁCTICA" sin prefijo pre-docente
  )
}

# Normaliza un orden de teacher_type provisto por el usuario a un vector de
# claves canónicas (.cm_aulas_text_key), sin vacíos ni duplicados. NULL/vacío →
# orden por defecto. Acepta tanto claves ya canónicas ("docente_ordinario_
# principal") como labels crudos ("DOCENTE ORDINARIO - PRINCIPAL"): ambos
# colapsan a la misma clave.
.cm_criterios_normalize_teacher_orden <- function(x) {
  keys <- .cm_aulas_text_key(.cm_aulas_chr_vec(x))
  keys <- keys[nzchar(keys)]
  keys <- keys[!duplicated(keys)]
  if (!length(keys)) return(.cm_criterios_teacher_orden_default())
  keys
}

# Rango (posición) de una clave canónica de teacher_type dentro de `orden`
# (ALTO→BAJO): índice de la PRIMERA entrada que iguala la clave o es su prefijo
# de grupo ("docente_ordinario" cubre "docente_ordinario_principal"). Sin match
# → Inf (al fondo).
.cm_criterios_teacher_rank <- function(key, orden) {
  if (!nzchar(key) || !length(orden)) return(Inf)
  for (r in seq_along(orden)) {
    e <- orden[[r]]
    if (identical(key, e) || startsWith(key, paste0(e, "_"))) return(as.numeric(r))
  }
  Inf
}

# De los valores de docente de UN curso-horario, devuelve la CLAVE canónica del
# docente de mayor jerarquía según `orden`. Cada entrada puede ser un valor
# suelto ("DOCENTE ORDINARIO - PRINCIPAL") o el CONJUNTO ya concatenado con "|"
# que arma el catálogo ("A | B | C"): se separa por "|" (mismo split que
# .cm_criterios_eval_teacher) ANTES de canonizar, para no colapsar el set entero
# en una sola clave falsa. Cada docente se canoniza con .cm_aulas_text_key (misma
# clave child que usa el catálogo). Empate (mismo rango, o todos desconocidos) →
# primera vista (which.min devuelve el primer índice del mínimo). Sin señal → "".
.cm_criterios_teacher_top <- function(raw_values, orden) {
  vals <- unlist(strsplit(as.character(raw_values), "\\s*\\|+\\s*"), use.names = FALSE)
  keys <- .cm_aulas_text_key(vals)
  keys <- keys[nzchar(keys)]
  if (!length(keys)) return("")
  ranks <- vapply(keys, function(k) .cm_criterios_teacher_rank(k, orden), numeric(1))
  keys[[which.min(ranks)]]
}
