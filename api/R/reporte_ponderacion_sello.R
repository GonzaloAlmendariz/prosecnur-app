# =============================================================================
# Sello de ponderacion para entregables (Plan de mejoras 2026-07, unidad 1.2).
#
# Objetivo: ningun artefacto sale sin declarar su estado de ponderacion, y el
# fallback silencioso a base no ponderada deja rastro. Este archivo concentra:
#   - el objeto de estado (`ponderacion_estado`) que .analitica_ponderacion_apply
#     adjunta como atributo de la base de reporte,
#   - la derivacion defensiva del estado desde una corrida (data + cfg), util
#     cuando el atributo se perdio (subsetting) o el peso llego heredado
#     (bases hijas repeat: ponderacion_analitica.R, herencia madre -> hija),
#   - el texto canonico del sello (funcion pura, testeable, sin side effects).
#
# Textos canonicos del sello:
#   "Resultados ponderados (n efectivo = X)"                  -> aplicada (S4)
#   "Resultados ponderados"                                   -> aplicada sin n efectivo
#   "Base sin ponderar"                                       -> sin config
#   "Base sin ponderar (ponderación configurada no aplicada)" -> fallback
#   "Resultados ponderados por la columna «col» (n efectivo = X)" -> modo columna
#     (el peso viene de una columna de la base, no se calibró en la app)
# =============================================================================

# Construye el objeto de estado de ponderacion de una corrida.
# `status`: "aplicada" | "no_aplicada" | "sin_config".
# `diagnostics`: lista del motor (ponderacion_engine.R) con n / n_eff / deff.
reporte_ponderacion_estado <- function(status,
                                       motivo = NULL,
                                       diagnostics = NULL,
                                       design_applied = NA,
                                       rake_applied = NA,
                                       converged = NA,
                                       modo = "calibracion",
                                       peso_columna = NULL) {
  status <- as.character(status %||% "sin_config")[1]
  if (!status %in% c("aplicada", "no_aplicada", "sin_config")) status <- "sin_config"
  d <- diagnostics %||% list()
  num1 <- function(x) {
    x <- suppressWarnings(as.numeric(x %||% NA_real_)[1])
    if (is.finite(x)) x else NA_real_
  }
  list(
    status = status,
    motivo = if (is.null(motivo)) NULL else as.character(motivo)[1],
    n = num1(d$n),
    n_eff = num1(d$n_eff),
    deff = num1(d$deff),
    design_applied = isTRUE(design_applied),
    rake_applied = isTRUE(rake_applied),
    converged = isTRUE(converged),
    modo = if (identical(as.character(modo %||% "")[1], "columna")) "columna" else "calibracion",
    peso_columna = if (is.null(peso_columna)) NULL else as.character(peso_columna)[1]
  )
}

# Deriva el estado de ponderacion de una corrida. Prioridad:
#   1. atributo `ponderacion_estado` que dejo .analitica_ponderacion_apply;
#   2. config habilitada + columna `peso` presente => aplicada (cubre a las
#      bases hijas repeat, que heredan el peso de la madre sin recalibrar; los
#      diagnosticos n_eff/DEFF se recalculan sobre el peso heredado);
#   3. config habilitada sin `peso` => fallback (configurada no aplicada);
#   4. sin config habilitada => NULL: la corrida no trae informacion de
#      ponderacion y los hooks deben dejar el artefacto historico intacto.
reporte_ponderacion_estado_corrida <- function(data = NULL, cfg = NULL) {
  estado <- if (!is.null(data)) attr(data, "ponderacion_estado", exact = TRUE) else NULL
  if (is.list(estado) && length(estado)) return(estado)

  pond <- (cfg %||% list())$ponderacion
  enabled <- is.list(pond) && isTRUE(.analitica_ponderacion_scalar(pond$enabled, FALSE))
  if (!enabled) return(NULL)

  if (is.data.frame(data) && "peso" %in% names(data)) {
    diag <- tryCatch(.ponderacion_diagnostics(data[["peso"]]), error = function(e) NULL)
    return(reporte_ponderacion_estado(
      "aplicada", diagnostics = diag,
      modo = .analitica_ponderacion_modo(pond),
      peso_columna = .analitica_ponderacion_scalar(pond$peso_columna, NULL)
    ))
  }
  reporte_ponderacion_estado(
    "no_aplicada",
    motivo = "la corrida no adjuntó pesos (fallback a base sin ponderar)"
  )
}

# Texto canonico del sello de ponderacion. Pura: solo mira el objeto de estado.
# `estado` NULL o sin status conocido se trata como corrida sin configuracion.
reporte_ponderacion_sello <- function(estado = NULL) {
  status <- if (is.list(estado)) as.character(estado$status %||% "sin_config")[1] else "sin_config"
  if (identical(status, "aplicada")) {
    n_eff <- suppressWarnings(as.numeric((estado %||% list())$n_eff %||% NA_real_)[1])
    col <- as.character((estado %||% list())$peso_columna %||% "")[1]
    if (identical(as.character(estado$modo %||% "")[1], "columna") && !is.na(col) && nzchar(col)) {
      base_txt <- sprintf("Resultados ponderados por la columna «%s»", col)
      if (is.finite(n_eff) && n_eff > 0) {
        return(sprintf("%s (n efectivo = %s)", base_txt,
                       format(round(n_eff), big.mark = ",", trim = TRUE)))
      }
      return(base_txt)
    }
    # S4 (contrato base-sin-ponderar F6, §3): la base de cada lámina es casos sin ponderar; lo ponderado son los
    # resultados, y el n efectivo de Kish se declara una vez, aquí (ficha técnica).
    if (is.finite(n_eff) && n_eff > 0) {
      return(sprintf(
        "Resultados ponderados (n efectivo = %s)",
        format(round(n_eff), big.mark = ",", trim = TRUE)
      ))
    }
    return("Resultados ponderados")
  }
  if (identical(status, "no_aplicada")) {
    return("Base sin ponderar (ponderación configurada no aplicada)")
  }
  "Base sin ponderar"
}

# Sello listo para hooks de artefactos: devuelve "" cuando la corrida no trae
# informacion de ponderacion (ni estado adjunto ni config habilitada), para que
# los entregables historicos sin ponderacion queden byte-idénticos.
reporte_ponderacion_sello_para_corrida <- function(data = NULL, cfg = NULL) {
  estado <- reporte_ponderacion_estado_corrida(data, cfg)
  if (is.null(estado)) return("")
  reporte_ponderacion_sello(estado)
}
