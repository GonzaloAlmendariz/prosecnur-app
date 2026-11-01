# =============================================================================
# Planner: cronograma y etapa operativa en un solo lugar (ADR 0122 §2)
# =============================================================================
#
# «¿En qué etapa está el estudio y cuándo es el campo?» hoy tiene tres
# respuestas: las fechas de la fase Campo del cronograma (plan_trabajo), la
# etapa activa de Hojas de ruta (`hojas_ruta_active_phase`: piloto o campo) y
# la de Monitoreo territorial (`active_route_phase` y sus `phase_windows`).
# Este archivo las lee juntas, sin escribir en ninguna, y dice cuando no
# coinciden. Desde la decisión de Meta B (2026-10-31) el Planner DECLARA la
# etapa (sección `etapa`): sembrada desde Hojas de ruta y Monitoreo si
# coinciden, en conflicto si no. Mientras esos dos no la lean del Planner, se
# dice cuál sigue en otra.
#
# Lectura pura: no llama a nada que escriba ni a helpers privados de archivos
# congelados; lee la forma cruda de cada clave con defensas.

.PLANNER_ETAPAS <- c(pilot = "piloto", piloto = "piloto", field = "campo", campo = "campo", real = "campo")
.PLANNER_FUENTE_ETAPA <- c(hojas_ruta = "Hojas de ruta", monitoreo = "Monitoreo")

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

# Una fuente cuenta sólo si su módulo se usa en el estudio: `field` en Hojas de
# ruta y `pilot` en Monitoreo territorial son los valores por defecto, y en un
# estudio telefónico o de acreditación aparecen sin que nadie los haya elegido
# (acnur_pdm y acrconta los traen). Leerlos inventaba un desacuerdo.
.planner_hojas_en_uso <- function(s) {
  runs <- s[["hojas_ruta_runs"]]
  is.list(runs) && any(vapply(runs, function(r) {
    is.list(r) && length(((r$workspace_outputs %||% list())$sample) %||% list()) > 0L
  }, logical(1)))
}

.planner_monitoreo_territorial_en_uso <- function(s) {
  perfil <- (s[["monitoreo_config"]] %||% list())$monitoreo_profile
  is.list(perfil) && identical(.planner_chr1(perfil$family), "territorial")
}

.planner_etapas_declaradas <- function(s) {
  fuentes <- list()
  hojas <- if (.planner_hojas_en_uso(s)) .planner_etapa_de(s[["hojas_ruta_active_phase"]]) else NA_character_
  if (!is.na(hojas)) fuentes$hojas_ruta <- list(etapa = hojas)
  ter <- ((s[["monitoreo_config"]] %||% list())$territorial) %||% list()
  mon <- if (.planner_monitoreo_territorial_en_uso(s)) .planner_etapa_de(ter$active_route_phase) else NA_character_
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

# Lo que Monitoreo dice hoy de la ventana de campo. Dos lugares, en este orden:
# las fases del plan de campo con fechas (`strategy_phases`, telefónico y
# acreditación: del primer inicio al último fin) y el inicio del campo
# territorial (`phase_windows$field$start_at`, que no guarda fin).
.planner_ventana_monitoreo <- function(s) {
  mc <- s[["monitoreo_config"]] %||% list()
  if (!is.list(mc)) return(NULL)
  fases <- Filter(is.list, mc$strategy_phases %||% list())
  inicios <- Filter(nzchar, vapply(fases, function(f) .planner_fecha(f$start_date), ""))
  fines <- Filter(nzchar, vapply(fases, function(f) .planner_fecha(f$end_date), ""))
  if (length(inicios)) {
    return(list(inicio = min(inicios), fin = if (length(fines)) max(fines) else "", de = "fases"))
  }
  if (.planner_monitoreo_territorial_en_uso(s)) {
    campo <- .planner_fecha((((mc$territorial %||% list())$phase_windows %||% list())$field %||% list())$start_at)
    if (nzchar(campo)) return(list(inicio = campo, fin = "", de = "territorial"))
  }
  NULL
}

.planner_ventanas_fuente <- function(s, campo_cronograma = .planner_campo_cronograma(s)$campo) {
  fuentes <- list()
  mon <- .planner_ventana_monitoreo(s)
  if (!is.null(mon)) fuentes$monitoreo <- mon
  if (nzchar(campo_cronograma$inicio) || nzchar(campo_cronograma$fin)) {
    fuentes$cronograma <- list(inicio = campo_cronograma$inicio, fin = campo_cronograma$fin, de = "cronograma")
  }
  fuentes
}

# La ventana sembrada: la de Monitoreo si dice algo (es la que opera), si no la
# del cronograma. `fuente` dice de cuál salió.
.planner_proyectar_ventana <- function(s, fuentes = .planner_ventanas_fuente(s)) {
  for (k in c("monitoreo", "cronograma")) {
    f <- fuentes[[k]]
    if (!is.null(f) && nzchar(f$inicio)) return(list(inicio = f$inicio, fin = f$fin, fuente = k))
  }
  list(inicio = "", fin = "", fuente = "")
}

.planner_rango_texto <- function(f) {
  if (nzchar(f$fin %||% "")) sprintf("del %s al %s", f$inicio, f$fin) else sprintf("desde el %s, sin fin", f$inicio)
}

#' Ventana de campo del estudio: la PROPUESTA del Planner y lo que dice cada
#' fuente. Lectura pura; la lee el Planner y la puede leer Monitoreo para
#' mostrar la discrepancia con la suya.
#' @keywords internal
.planner_ventana_campo <- function(s, campo_cronograma = .planner_campo_cronograma(s)$campo) {
  fuentes <- .planner_ventanas_fuente(s, campo_cronograma)
  declarada <- .planner_leer(s)$secciones$ventana
  v <- if (!is.null(declarada)) c(declarada$valor, list(fuente = "planner")) else .planner_proyectar_ventana(s, fuentes)
  avisos <- list()
  if (!is.null(declarada)) {
    # Declarada, manda como propuesta: se dice qué fuente cuenta otra cosa.
    for (k in names(fuentes)) {
      f <- fuentes[[k]]
      if (!identical(f$inicio, v$inicio) || (nzchar(f$fin) && !identical(f$fin, v$fin))) {
        avisos[[length(avisos) + 1L]] <- .planner_aviso(
          paste0("ventana_", k, "_distinta"),
          sprintf("%s cuenta el campo %s.", c(monitoreo = "Monitoreo", cronograma = "El cronograma")[[k]],
                  .planner_rango_texto(f)),
          fuente = k)
      }
    }
  }
  list(inicio = v$inicio, fin = v$fin, fuente = v$fuente,
       origen = if (is.null(declarada)) "proyectado" else "declarado",
       propuesta = TRUE, declarable = TRUE, fuentes = fuentes, avisos = avisos)
}

#' Cronograma, ventana de campo y etapa operativa del estudio. Lectura pura.
#' @keywords internal
.planner_calendario <- function(s) {
  crono <- .planner_campo_cronograma(s)   # migra en memoria; no persiste
  fases <- crono$fases
  campo <- crono$campo
  ventana <- .planner_ventana_campo(s, campo)

  etapas <- .planner_etapas_declaradas(s)
  valores <- unique(vapply(etapas, `[[`, "", "etapa"))
  declarada <- .planner_leer(s)$secciones$etapa
  avisos <- list()
  if (!is.null(declarada)) {
    # Declarada en el Planner: manda. Hojas de ruta y Monitoreo todavía no la
    # leen, así que se dice cuál de los dos sigue en otra.
    valor <- declarada$valor$valor
    for (k in names(etapas)) {
      if (!identical(etapas[[k]]$etapa, valor)) {
        avisos[[length(avisos) + 1L]] <- .planner_aviso(
          "etapa_modulo_desfasado",
          sprintf("%s todavía trabaja en %s.", .PLANNER_FUENTE_ETAPA[[k]], etapas[[k]]$etapa), fuente = k)
      }
    }
  } else if (length(valores) > 1L) {
    avisos[[length(avisos) + 1L]] <- .planner_aviso(
      "etapa_no_coincide",
      sprintf("Hojas de ruta dice que el estudio está en %s y Monitoreo, en %s: declara la etapa aquí.",
              etapas$hojas_ruta$etapa, etapas$monitoreo$etapa))
    valor <- NA_character_
  } else {
    valor <- if (length(valores) == 1L) valores[[1]] else NA_character_
  }
  campo_mon <- etapas$monitoreo$campo_desde %||% ""
  # Con la ventana declarada, sus avisos dicen ya qué fuente difiere.
  if (identical(ventana$origen, "declarado")) {
    avisos <- c(avisos, ventana$avisos)
  } else if (nzchar(campo_mon) && nzchar(campo$inicio) && !identical(campo_mon, campo$inicio)) {
    avisos[[length(avisos) + 1L]] <- .planner_aviso(
      "campo_no_coincide",
      sprintf("El cronograma empieza el campo el %s y Monitoreo lo cuenta desde el %s.", campo$inicio, campo_mon))
  }
  list(
    ok = TRUE,
    hoy = .bit_cron_hoy_servidor(),
    fases = fases,
    campo = list(inicio = campo$inicio, fin = campo$fin),
    ventana = ventana[setdiff(names(ventana), "avisos")],
    etapa = list(
      valor = valor,
      origen = if (is.null(declarada)) "proyectado" else "declarado",
      fuentes = etapas,
      declarable = TRUE
    ),
    avisos = avisos
  )
}
