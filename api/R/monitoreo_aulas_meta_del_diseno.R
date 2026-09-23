# =============================================================================
# La meta por aula sale de la τ del DISEÑO cuando la calibración no tiene dueño
# =============================================================================
#
# Decisión de Gonzalo, 2026-09-22, sobre CCSS Perfil 2026-II: «la del diseño».
#
# Un estudio que no declara su calibración en Cálculo de muestra recibe las
# curvas EMBEBIDAS (`efectividad_fuente = "calibracion_embebida"`: tramos
# 0,80/0,69/0,56/0,55/0,44 por tamaño de aula, sin procedencia verificable y de
# otra ola de otro estudio). Con ellas se escribe `expected_valid` de cada aula.
# Pero el estudio SÍ declaró su τ —en `design_targets`, desde su documento de
# diseño— y con ella dimensionó la cuota. Resultado en CCSS: dos «previstos»
# en la misma pestaña, 0,50 y ≈0,66, y dos paneles vecinos diciendo +16 y −18.
#
# La regla: si la meta de un aula sale de la calibración sin dueño y el diseño
# declara una τ que le aplica, la meta es `eligible_n × τ del diseño`. Es
# exactamente la vía `tau_global` que Cálculo de muestra ya conoce (esperado =
# elegibles × τ, sin tramo ni factor), así que la fila queda en un estado que
# todas las superficies ya saben leer y explicar.
#
# **Qué τ le aplica a una fila:**
#
# - eje en el AULA (facultad): la de la celda de su facultad.
# - eje en la PERSONA (nivel): la del diseño sólo si TODAS las celdas declaran
#   τ y es la misma. Con τ distintas por nivel la del aula dependería de su
#   mezcla de niveles, que el marco colapsó a su moda; con una celda sin τ,
#   heredarle la de sus vecinas sería suponer por el diseño. En los dos casos
#   la fila conserva lo que traía.
#
# **Supuestos declarados** (revisión metodológica del 2026-09-22):
#
# - Con el eje en el aula, una facultad sin celda en el diseño conserva la meta
#   embebida; su fila lo dice en `efectividad_fuente`.
# - Una fila sin `eligible_n` legible conserva lo que traía: sin elegibles no
#   hay meta que derivar.
# - La «Base de control» leída de un libro publicado ANTES de esta regla trae
#   las esperadas viejas hasta la siguiente publicación, que las reescribe.
# - Cálculo de muestra sigue mostrando la calibración embebida: la corrección
#   vive donde se LEE la meta, no en el estado. El arreglo de raíz es que el
#   estudio declare su τ como calibración en Cálculo de muestra.
#
# **Qué NO toca:** una fila cuya calibración tiene dueño (`historico`, o una
# `tau_global` declarada en Cálculo de muestra). HSVG2026 corre sobre
# `historico` y sus esperadas ya cuadran con su τ por facultad: queda igual.
#
# **Idempotente y reversible.** Se marca `efectividad_periodo =
# "design_targets"` para poder re-derivar si el diseño cambia su τ, y
# `rendimiento_ref` / `factor_facultad` se conservan: dicen qué habría pedido la
# calibración embebida, y «Por qué esa meta» elige la fórmula que reproduce el
# número, así que no se contradicen.
#
# Se aplica en la entrada de cada superficie que lee la meta con la config a
# mano —el tablero, el libro, su publicación, las tablas de Avance y el PDF—,
# antes de que nadie la lea.

.MAMD_PERIODO <- "design_targets"

#' La τ del diseño que le toca a cada fila del plan, o `NA`.
#'
#' @param fuente,periodo `efectividad_fuente` y `efectividad_periodo` por fila.
#' @param valor_eje el valor de la columna del eje en cada fila.
#' @param cfg config de aulas (lleva `design_targets` y la declaración del eje).
#' @keywords internal
.mamd_tau_por_fila <- function(fuente, periodo, valor_eje, cfg) {
  n <- length(fuente)
  out <- rep(NA_real_, n)
  if (!n) return(out)
  sin_dueno <- fuente %in% "calibracion_embebida" |
    (fuente %in% "tau_global" & periodo %in% .MAMD_PERIODO)
  if (!any(sin_dueno)) return(out)

  facs <- ((cfg %||% list())[["design_targets"]] %||% list())[["facultades"]] %||% list()
  tau_k <- list()
  for (f in facs) {
    if (!is.list(f)) next
    k <- .monitoreo_scalar(f$faculty_key, "")
    if (!nzchar(k)) k <- monitoreo_aulas_eje_key(.monitoreo_scalar(f$facultad, ""))
    t <- .monitoreo_num(f$tau, NA_real_)
    if (nzchar(k) && is.finite(t) && t > 0 && t <= 1 && is.null(tau_k[[k]])) tau_k[[k]] <- t
  }
  if (!length(tau_k)) return(out)

  eje <- monitoreo_aulas_eje(cfg)
  if (identical(.monitoreo_scalar(eje$atribucion, "aula"), "aula")) {
    claves <- .maac_eje_key(as.character(valor_eje), eje)
    out <- vapply(seq_len(n), function(i) {
      if (!sin_dueno[[i]]) return(NA_real_)
      .monitoreo_num(tau_k[[claves[[i]]]], NA_real_)
    }, numeric(1))
  } else {
    # **Todas las celdas con τ, y la misma.** Una celda sin τ legible no es «la
    # misma que las demás»: es una que el diseño no declaró, y heredarle la de
    # sus vecinas sería suponer por él.
    taus <- vapply(facs, function(f) if (is.list(f)) .monitoreo_num(f$tau, NA_real_) else NA_real_,
                   numeric(1))
    if (length(taus) && all(is.finite(taus)) && diff(range(taus)) < 1e-9) out[sin_dueno] <- taus[[1]]
  }
  out
}

# Las columnas que la regla reescribe, con su valor para una τ y unos elegibles.
.mamd_campos <- function(tau, el) {
  list(
    expected_valid = round(el * tau, 1),
    tasa_efectividad_aula = round(tau, 4),
    efectividad_tau = round(tau, 4),
    # La otra vara de la fila: con τ única del diseño la del aula y la de su
    # facultad son la misma, y dejarlas distintas reabriría las dos varas.
    tasa_facultad = round(tau, 4),
    esperadas_facultad = round(el * tau, 1),
    efectividad_fuente = "tau_global",
    efectividad_periodo = .MAMD_PERIODO,
    meta_origen = "diseno"
  )
}

#' La meta de cada aula, con la τ del diseño donde la calibración no tiene dueño.
#'
#' @param plan filas del plan: lista de listas (libro) o `data.frame` (tablero).
#' @param cfg config de aulas.
#' @return el plan con la misma forma; las filas que no aplican, intactas.
#' @keywords internal
monitoreo_aulas_meta_del_diseno <- function(plan, cfg = list()) {
  if (is.data.frame(plan)) {
    if (!nrow(plan)) return(plan)
    col_eje <- monitoreo_aulas_columna_eje(plan, monitoreo_aulas_eje(cfg))
    tau <- .mamd_tau_por_fila(
      as.character(plan$efectividad_fuente %||% rep("", nrow(plan))),
      as.character(plan$efectividad_periodo %||% rep("", nrow(plan))),
      if (nzchar(col_eje)) as.character(plan[[col_eje]]) else rep("", nrow(plan)),
      cfg)
    el <- suppressWarnings(as.numeric(plan$eligible_n %||% rep(NA_real_, nrow(plan))))
    ok <- is.finite(tau) & is.finite(el) & el >= 0
    if (!any(ok)) return(plan)
    campos <- .mamd_campos(tau[ok], el[ok])
    for (nm in names(campos)) {
      if (!nm %in% names(plan)) plan[[nm]] <- if (is.character(campos[[nm]])) "" else NA_real_
      plan[[nm]][ok] <- campos[[nm]]
    }
    # El alias con PRECEDENCIA en `normalize_plan`: si se queda atrás, la
    # siguiente normalización devuelve la meta embebida con la fuente diciendo
    # «diseño» (lo cazaron el verificador y el revisor metodológico).
    if ("efectivas_esperadas" %in% names(plan)) plan$efectivas_esperadas[ok] <- campos$expected_valid
    return(plan)
  }
  if (!is.list(plan) || !length(plan)) return(plan)
  eje <- monitoreo_aulas_eje(cfg)
  alias <- eje[["alias"]] %||% "faculty"
  valor_eje <- vapply(plan, function(u) {
    if (!is.list(u)) return("")
    for (a in alias) {
      v <- u[[a]]
      if (!is.null(v) && length(v) && nzchar(as.character(v[[1]]))) return(as.character(v[[1]]))
    }
    ""
  }, character(1))
  campo <- function(k) vapply(plan, function(u) {
    v <- if (is.list(u)) u[[k]] else NULL
    if (is.null(v) || !length(v)) "" else as.character(v[[1]])
  }, character(1))
  tau <- .mamd_tau_por_fila(campo("efectividad_fuente"), campo("efectividad_periodo"),
                            valor_eje, cfg)
  el <- suppressWarnings(as.numeric(campo("eligible_n")))
  for (i in which(is.finite(tau) & is.finite(el) & el >= 0)) {
    campos <- .mamd_campos(tau[[i]], el[[i]])
    for (nm in names(campos)) plan[[i]][[nm]] <- campos[[nm]]
    # El alias con que Cálculo de muestra escribe la misma meta, si viaja.
    if (!is.null(plan[[i]][["efectivas_esperadas"]])) {
      plan[[i]][["efectivas_esperadas"]] <- campos$expected_valid
    }
  }
  plan
}
