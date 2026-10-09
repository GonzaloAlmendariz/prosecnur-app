# =============================================================================
# Cola del build del marco de aulas: los agregados que se publican al final
# =============================================================================
#
# Pasos 5 a 8 de `calc_muestra_aulas_construir()`: catálogo de criterios, perfil,
# particularidades, las dos radiografías y el impacto del tipo de sesión.
#
# Vive aquí por dos razones. La primera es la de siempre: `calc_muestra_aulas.R`
# está congelado a crecimiento y esta cola no es el motor del marco, son sus
# publicaciones. La segunda es que separar la cola deja ver lo que el perfil ya
# medía y no se podía aprovechar: a escala real (5.269 CH) estos cuatro pasos se
# llevan 128 de los 185 s del build, y producen agregados que un `.pulso`
# guardado YA trae. Con la cola aparte, `construir(solo_criterios = TRUE)` puede
# parar en el paso 4 —donde la tabla atómica estudiante x CH ya existe— y
# devolverla en 57 s en vez de 185.
#
# No cambia nada del resultado: es el mismo código, movido. El gate es el
# `frame_hash`, que debe seguir siendo idéntico sobre el mismo proyecto.

#' Publica los agregados finales sobre el marco ya construido.
#'
#' @param out marco en construcción (pasos 1-4 ya aplicados).
#' @param criterios salida de `calc_muestra_aulas_aplicar_criterios()`.
#' @param ctx piezas del build que la cola necesita, tal como las nombra
#'   `construir`: `aula_frame`, `catalog_signals`, `raw`, `mapping`, `cfg`,
#'   `alumno_sel`, `particularidades_aplicadas` y los vectores por fila de
#'   alumno (`student_id`, `formation`, `condition`, `age`, `faculty`, `level`).
#' @param .p emisor de hitos de progreso.
#' @return `out` con los agregados adjuntos.
#' @keywords internal
.cm_aulas_construir_cola <- function(out, criterios, ctx, .p) {
  aula_frame <- ctx$aula_frame
  catalog_signals <- ctx$catalog_signals
  raw <- ctx$raw
  mapping <- ctx$mapping
  cfg <- ctx$cfg
  alumno_sel <- ctx$alumno_sel
  particularidades_aplicadas <- ctx$particularidades_aplicadas
  student_id <- ctx$student_id
  formation <- ctx$formation
  condition <- ctx$condition
  age <- ctx$age
  faculty <- ctx$faculty
  level <- ctx$level

    .p(5L, "Perfilando el marco")
    out$criterios_catalogo <- calc_muestra_aulas_criterios_catalogo(
      aula_frame = aula_frame,
      catalog_signals = catalog_signals,
      filas_alumno = list(
        student_id = student_id, formation = formation, condition = condition,
        age = age, faculty = faculty, level = level
      ),
      mapped_columns = list(
        formation = .cm_criterios_col_exacta(raw, mapping$formation),
        condition = .cm_aulas_col(raw, mapping$condition),
        faculty = .cm_aulas_col(raw, mapping$faculty),
        age = .cm_aulas_col(raw, mapping$age),
        level = .cm_aulas_col(raw, mapping$level),
        modality = .cm_aulas_col(raw, mapping$modality),
        session_type = .cm_aulas_col(raw, mapping$session_type),
        teacher_type = .cm_criterios_col_teacher_type(raw, mapping),
        course_level = .cm_criterios_col_course_level(raw, mapping),
        condicion_curso = .cm_criterios_col_condicion_curso(raw, mapping),
        enrolled_total = .cm_aulas_col(raw, mapping$enrolled_total),
        campus = .cm_aulas_col(raw, mapping$campus)
      )
    )
    out$criterios_seleccion <- cfg$criterios_seleccion
    # ADR 0035: orden EFECTIVO de jerarquía docente usado en este build (ya
    # resuelto por .cm_criterios_normalize_teacher_orden en la config; NULL/vacío
    # colapsó al default académico). El frontend lo compara con el orden que el
    # usuario tiene en pantalla para marcar el marco DESACTUALIZADO al reordenar.
    # Se expone como lista para forzar un array JSON aunque el orden tenga un solo
    # elemento.
    out$teacher_type_orden <- as.list(cfg$teacher_type_orden)
    out$criterios_alumno_report <- alumno_sel$report
    # Particularidades (§12): señales detectadas + eco de decisiones, paso
    # manual del embudo y rastro en la auditoría. Un solo call-site; la lógica
    # vive en calc_muestra_aulas_particularidades.R.
    out <- .cm_particularidades_adjuntar(out, catalog_signals, particularidades_aplicadas)
    # Radiografía del marco por facultad (pestaña «Explorador de aulas»): reusa
    # las señales ya adjuntadas en out$particularidades. Un solo call-site; la
    # lógica vive en calc_muestra_aulas_exploracion.R (este archivo no debe
    # crecer).
    # L11: las dos radiografías se emiten por separado porque su coste no se
    # parece. Medido a escala real (5.263 CH): la del marco publica 0,6 MB y la
    # de criterios 19,5 MB, y juntas se llevaban 114 de los 177 s del build con
    # la barra clavada en el último hito. Un progreso repartido por etapas del
    # código y no por coste miente aunque cada etapa exista.
    .p(6L, "Radiografía del marco")
    out <- .cm_exploracion_adjuntar(out, criterios)
    .p(7L, "Radiografía por criterio y facultad")
    out <- .cm_criterios_i18b_adjuntar(out, criterios)
    # Impacto del tipo de sesión por facultad (guard §12 «doble selección del
    # taller», schema cm_session_type_impacto_v1): un solo call-site; la lógica
    # vive en calc_muestra_aulas_criterios.R (este archivo no debe crecer).
    .p(8L, "Impacto del tipo de sesión")
    out <- .cm_criterios_session_impacto_adjuntar(out, catalog_signals)
    out
}
