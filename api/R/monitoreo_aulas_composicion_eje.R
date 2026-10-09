# =============================================================================
# Lo que cada aula aporta a las celdas del EJE, por su composición por nivel
# =============================================================================
#
# El proyector de Metas (`monitoreo_aulas_avance_sexo_facultad`) acumula lo
# esperado de cada aula por `(facultad, sexo)`. Con la cuota por nivel atribuida
# a la persona las celdas son niveles, y un aula no tiene UN nivel: tiene los de
# sus alumnos. Medido en CCSS Perfil 2026-II el 2026-09-23: las cuatro celdas
# salían con `previsto` NA y aporte 0 —«la app no sabe cuántos alumnos de cada
# nivel hay en las aulas agendadas»—, y el dato estaba en la base.
#
# La composición la escribe el marco (`level_composition`, ver
# calc_muestra_aulas_composicion_nivel.R) y cuenta a los mismos elegibles que
# `eligible_n`. Cada elegible rinde la tasa del aula —la misma con la que se
# escribió su meta—, así que lo que un aula aporta a la celda de un nivel es
# `elegibles de ese nivel × tasa del aula`, y la suma sobre niveles devuelve su
# meta entera. Misma varianza binomial que el reparto por sexo.
#
# **Supuestos declarados** (revisión metodológica, 2026-09-23):
#
# - Cada elegible rinde la tasa de su aula, sea cual sea su nivel.
# - Lo previsto suma ASIENTOS y lo logrado cuenta PERSONAS (deduplicadas): un
#   alumno en dos aulas aplicadas entra dos veces en lo previsto. No se
#   descuenta —«el traslape informa, no descuenta», decisión de Gonzalo— y es el
#   mismo supuesto con el que el diseño dimensiona.
# - La calibración logrado/previsto absorbe las pérdidas por códigos que no
#   resuelven contra el padrón y por duplicadas: mide el rendimiento del campo
#   tal como llega a la cuota.
# - El nivel de la composición es el del padrón: los dos salen de
#   `NIVEL_CURRICULAR` de la misma base (verificado en CCSS: 2.834/2.834).
# - En el banco, el solape con lo ya medido se reparte en proporción al nivel.

# Clave del contador de aulas sin composición, dentro del entorno del proyector.
.MAC_SIN_COMPOSICION <- "__aulas_sin_composicion__"

#' Acumula en el proyector lo que una fila aporta a cada celda de nivel.
#'
#' @param acc,accv entornos del proyector (esperadas y varianza).
#' @param fila fila del plan.
#' @param aplicada,agendada lógicos ya resueltos por el proyector.
#' @return invisible; modifica `acc` y `accv`.
#' @keywords internal
.mac_acumular_composicion <- function(acc, accv, fila, aplicada, agendada) {
  comp <- .cm_aulas_composicion_leer(fila$level_composition)
  # Un aula sin composición no aporta a ninguna celda del eje, y eso no puede
  # pasar callado: se cuenta y la celda lo publica.
  if (!length(comp)) {
    acc[[.MAC_SIN_COMPOSICION]] <- (acc[[.MAC_SIN_COMPOSICION]] %||% 0L) + 1L
    return(invisible(NULL))
  }
  num <- function(x) {
    v <- suppressWarnings(as.numeric(.monitoreo_scalar(x, NA))[1])
    if (is.finite(v)) v else NA_real_
  }
  tasa <- num(fila$tasa_efectividad_aula)
  el <- num(fila$eligible_n)
  meta <- num(fila$expected_valid %||% fila$efectivas_esperadas)
  if (!is.finite(tasa) && is.finite(el) && el > 0 && is.finite(meta)) tasa <- meta / el
  if (!is.finite(tasa) || tasa <= 0 || tasa > 1) {
    acc[[.MAC_SIN_COMPOSICION]] <- (acc[[.MAC_SIN_COMPOSICION]] %||% 0L) + 1L
    return(invisible(NULL))
  }
  for (nivel in names(comp)) {
    k0 <- paste0(.monitoreo_text_key(nivel), "|")
    esperadas <- comp[[nivel]] * tasa
    k <- paste0(k0, "|", if (aplicada) "ap" else "pe")
    acc[[k]] <- (acc[[k]] %||% 0) + esperadas
    if (!aplicada && agendada) acc[[paste0(k0, "|ag")]] <- (acc[[paste0(k0, "|ag")]] %||% 0) + esperadas
    # La varianza sólo de lo que falta, como en el reparto por sexo; con tasa 1
    # no hay varianza que afirmar.
    if (!aplicada && tasa < 1) accv[[k0]] <- (accv[[k0]] %||% 0) + esperadas * (1 - tasa)
  }
  invisible(NULL)
}

#' Lo que un aula del BANCO aporta a una celda de nivel, por su composición.
#'
#' `monitoreo_aulas_reserva_dirigida()` buscaba en el banco aulas cuyo nivel
#' MODAL fuera el de la celda. Medido en CCSS el 2026-09-23: «Nivel 9 — el banco
#' no tiene cursos-horario de ese nivel», cuando un aula de nivel modal 8 puede
#' traer varios alumnos de 9. Con la composición el aula sirve si tiene
#' elegibles de ese nivel, sea cual sea su moda.
#'
#' El solape con lo ya medido se reparte en la proporción del nivel —los ids no
#' vienen etiquetados—, el mismo supuesto que `.mard_aporte()` declara para el
#' sexo.
#'
#' @param aula fila del banco.
#' @param clave clave de la celda (`.maac_eje_key` del nivel).
#' @param eje el eje resuelto.
#' @param ya_medidos ids ya medidos.
#' @return `list(elegibles, netos, solape)`, o `NULL` si el aula no trae
#'   composición (entonces manda la regla de siempre).
#' @keywords internal
.mard_aporte_composicion <- function(aula, clave, eje, ya_medidos = character(0)) {
  comp <- .cm_aulas_composicion_leer(aula$level_composition)
  if (!length(comp)) return(NULL)
  k <- .maac_eje_key(names(comp), eje)
  del_nivel <- sum(comp[k == clave])
  total <- sum(comp)
  if (del_nivel <= 0 || total <= 0) return(list(elegibles = 0, netos = 0, solape = 0))
  solape <- 0
  ids <- .monitoreo_scalar(aula$unique_student_ids %||% "", "")
  if (nzchar(ids) && length(ya_medidos)) {
    propios <- strsplit(ids, "|", fixed = TRUE)[[1]]
    propios <- propios[nzchar(propios)]
    if (length(propios)) solape <- sum(propios %in% ya_medidos) * (del_nivel / total)
  }
  list(elegibles = del_nivel, netos = max(0, del_nivel - solape), solape = solape)
}
