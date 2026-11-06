# =============================================================================
# Planner: cronograma, ventana de campo y etapa operativa (ADR 0123 §5–§6)
# =============================================================================
#
# El cronograma es opcional. La ventana y la etapa son PROPUESTAS: Monitoreo y
# Hojas de ruta las comparan con las suyas y ofrecen «Alinear» con un clic; nada
# cambia sin ese clic. El Planner va primero, así que aquí no se lee a Hojas de
# ruta ni a Monitoreo: el desfase lo dicen ellos desde su lado
# (`etapaDelPlanner.ts`, `hojas_ruta_etapa.R`). La ventana sin declarar se
# propone sólo desde la fase Campo del propio cronograma.
#
# Lectura pura: no llama a nada que escriba ni a helpers privados de archivos
# congelados.

.planner_fecha <- function(x) {
  v <- substr(.planner_chr1(x), 1L, 10L)
  if (grepl("^\\d{4}-\\d{2}-\\d{2}$", v)) v else ""
}

# La fase Campo del cronograma (plan_trabajo). Lectura pura: migra en memoria.
.planner_campo_cronograma <- function(s) {
  s_migrado <- .bitacora_migrar_estado(s)
  plan <- .bit_plan_actual(s_migrado)
  fases <- lapply(.bit_cron_vista_fases(s_migrado, plan), function(f) {
    list(id = f$id, label = f$label, modulo = f$modulo, inicio = f$start_date, fin = f$end_date,
         actividades = f$task_count)
  })
  campo <- Filter(function(f) identical(f$id, "campo"), fases)
  campo <- if (length(campo)) campo[[1]] else list(inicio = "", fin = "")
  list(fases = fases, campo = list(inicio = .planner_fecha(campo$inicio), fin = .planner_fecha(campo$fin)))
}

#' Ventana de campo del estudio: la declarada o, sin declarar, la fase Campo
#' del cronograma. Lectura pura.
#' @keywords internal
.planner_ventana_campo <- function(s, campo_cronograma = .planner_campo_cronograma(s)$campo) {
  declarada <- .planner_leer(s)$secciones$ventana
  if (!is.null(declarada)) {
    return(list(inicio = declarada$valor$inicio, fin = declarada$valor$fin, fuente = "planner",
                origen = "declarado", propuesta = TRUE, declarable = TRUE))
  }
  del_cronograma <- nzchar(campo_cronograma$inicio)
  list(inicio = if (del_cronograma) campo_cronograma$inicio else "",
       fin = if (del_cronograma) campo_cronograma$fin else "",
       fuente = if (del_cronograma) "cronograma" else "",
       origen = "vacio", propuesta = TRUE, declarable = TRUE)
}

#' Cronograma, ventana de campo y etapa operativa del estudio. Lectura pura.
#' @keywords internal
.planner_calendario <- function(s) {
  crono <- .planner_campo_cronograma(s)   # migra en memoria; no persiste
  declarada <- .planner_leer(s)$secciones$etapa
  list(
    ok = TRUE,
    hoy = .bit_cron_hoy_servidor(),
    fases = crono$fases,
    campo = crono$campo,
    ventana = .planner_ventana_campo(s, crono$campo),
    etapa = list(
      valor = if (is.null(declarada)) NA_character_ else declarada$valor$valor,
      origen = if (is.null(declarada)) "vacio" else "declarado",
      declarable = TRUE
    ),
    avisos = list()
  )
}
