# =============================================================================
# Planner: cronograma y etapa operativa en un solo lugar (ADR 0122 §2)
# =============================================================================
#
# «¿En qué etapa está el estudio y cuándo es el campo?» hoy tiene tres
# respuestas: las fechas de la fase Campo del cronograma (plan_trabajo), la
# etapa activa de Hojas de ruta (`hojas_ruta_active_phase`: piloto o campo) y
# la de Monitoreo territorial (`active_route_phase` y sus `phase_windows`).
# Este archivo las lee juntas, sin escribir en ninguna, y dice cuando no
# coinciden. Quién pasa a ser dueño de la etapa es otra decisión (Hojas de
# ruta y Monitoreo, con Meta B): hasta entonces el Planner la muestra, no la
# declara.
#
# Lectura pura: no llama a nada que escriba ni a helpers privados de archivos
# congelados; lee la forma cruda de cada clave con defensas.

.PLANNER_ETAPAS <- c(pilot = "piloto", piloto = "piloto", field = "campo", campo = "campo", real = "campo")

.planner_etapa_de <- function(x) {
  v <- tolower(.planner_chr1(x))
  if (!nzchar(v)) return(NA_character_)
  e <- unname(.PLANNER_ETAPAS[v])
  if (is.na(e)) NA_character_ else e
}

.planner_fecha <- function(x) {
  v <- substr(.planner_chr1(x), 1L, 10L)
  if (grepl("^\\d{4}-\\d{2}-\\d{2}$", v)) v else ""
}

.planner_etapas_declaradas <- function(s) {
  fuentes <- list()
  hojas <- .planner_etapa_de(s[["hojas_ruta_active_phase"]])
  if (!is.na(hojas)) fuentes$hojas_ruta <- list(etapa = hojas)
  ter <- ((s[["monitoreo_config"]] %||% list())$territorial) %||% list()
  mon <- .planner_etapa_de(ter$active_route_phase)
  if (is.list(ter) && !is.na(mon)) {
    ventanas <- ter$phase_windows %||% list()
    fuentes$monitoreo <- list(
      etapa = mon,
      piloto_desde = .planner_fecha((ventanas$pilot %||% list())$start_at),
      campo_desde = .planner_fecha((ventanas$field %||% list())$start_at)
    )
  }
  fuentes
}

#' Cronograma, ventana de campo y etapa operativa del estudio. Lectura pura.
#' @keywords internal
.planner_calendario <- function(s) {
  s_migrado <- .bitacora_migrar_estado(s)   # transforma en memoria; no persiste
  plan <- .bit_plan_actual(s_migrado)
  fases <- lapply(.bit_cron_vista_fases(s_migrado, plan), function(f) {
    list(id = f$id, label = f$label, modulo = f$modulo, inicio = f$start_date, fin = f$end_date,
         actividades = f$task_count)
  })
  campo <- Filter(function(f) identical(f$id, "campo"), fases)
  campo <- if (length(campo)) campo[[1]] else list(inicio = "", fin = "")

  etapas <- .planner_etapas_declaradas(s)
  valores <- unique(vapply(etapas, `[[`, "", "etapa"))
  avisos <- list()
  if (length(valores) > 1L) {
    avisos[[length(avisos) + 1L]] <- .planner_aviso(
      "etapa_no_coincide",
      sprintf("Hojas de ruta dice que el estudio está en %s y Monitoreo, en %s.",
              etapas$hojas_ruta$etapa, etapas$monitoreo$etapa))
  }
  campo_mon <- etapas$monitoreo$campo_desde %||% ""
  if (nzchar(campo_mon) && nzchar(campo$inicio) && !identical(campo_mon, campo$inicio)) {
    avisos[[length(avisos) + 1L]] <- .planner_aviso(
      "campo_no_coincide",
      sprintf("El cronograma empieza el campo el %s y Monitoreo lo cuenta desde el %s.", campo$inicio, campo_mon))
  }
  list(
    ok = TRUE,
    hoy = .bit_cron_hoy_servidor(),
    fases = fases,
    campo = list(inicio = campo$inicio, fin = campo$fin),
    etapa = list(
      valor = if (length(valores) == 1L) valores[[1]] else NA_character_,
      fuentes = etapas,
      # El Planner la muestra; todavía no la declara (ver encabezado).
      declarable = FALSE
    ),
    avisos = avisos
  )
}
