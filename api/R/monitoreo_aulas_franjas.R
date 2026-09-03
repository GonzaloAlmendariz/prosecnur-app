# monitoreo_aulas_franjas.R — el bloque `franjas` del dashboard: el mapa de
# horas por dia que el grafico de la separacion de tiempo consume (encargo de
# Gonzalo 2026-09-02).
#
# DERIVADO de `monitoreo_aulas_ventanas()` (B11, monitoreo_aulas_ventanas.R),
# no recalculado a mano: hereda el parser AM/PM, la fecha ISO/dd-mm, los
# veinte minutos y la exclusion de retiradas/rechazadas. Reimplementar el
# barrido aqui perderia esas reglas en la primera divergencia — hay un
# grep-pin en test-monitoreo-aulas-franjas.R que lo vigila.
#
# Contrato (congelado 2026-09-02): `list(dias, personas_fuente)`.
#
# - `dias`: un elemento por FECHA agendada (ISO, ascendente); cada dia
#   `{fecha, ventanas, pico, por_confirmar}`.
#     * `ventanas`: `{codigo, inicio, fin, confirmada}` por aula dibujable —
#       confirmada = TRUE con hora pactada ([hora, hora+20] de B11), FALSE en
#       la franja tentativa del curso.
#     * `pico`: `{aulas, inicio, fin}` — el MAXIMO de aulas confirmadas EN
#       CURSO a la vez, contado por RANGO real y no por hora de inicio (el
#       sesgo medido en universitarias: por inicio daba 8 donde el rango real
#       daba 19). En empate, la franja mas TEMPRANA. Con cero confirmadas:
#       `aulas = 0` sin franja inventada.
#     * `por_confirmar`: codigos del dia SIN hora pactada. DECISION DECLARADA:
#       EXTIENDE el `por_confirmar` del mapa de B11 —que solo lista tentativas
#       con rango— derivandolo de `aulas` de ventanas, donde la fecha del
#       `sin_ventana` si viaja: una cita sin pactar cuenta como pendiente del
#       dia aunque no sepamos ni la franja del curso. La tentativa con rango
#       tiene doble presencia deliberada: dibuja su ventana con
#       `confirmada = FALSE` Y cuenta en `por_confirmar`.
# - `personas_fuente`: "confirmadas" — el pico sale SOLO de ventanas
#   confirmadas, mismo pin que B11: una cita que no existe no pide gente.
#
# Determinismo: sin reloj — el mapa del martes se calcula igual el lunes que
# el miercoles (mismo pin que B11). Calculo puro sobre estado ya validado:
# degrada declarando (dias vacios, pico en cero), nunca lanza — por eso aqui
# no hay `stop_api()` ni `stop()`.

# El pico de un dia a partir de las franjas confirmadas de B11 (tramos entre
# cortes, en orden ascendente, solo ocupados). El primer maximo ES la franja
# mas temprana del empate porque los cortes ya vienen ordenados. Sin franjas
# —cero confirmadas ese dia— el pico declara `aulas = 0` sin inventarse un
# tramo.
.mafr_pico <- function(franjas) {
  if (!length(franjas)) return(list(aulas = 0L))
  n <- vapply(franjas, function(f) {
    v <- suppressWarnings(as.integer(f[["confirmadas"]] %||% 0L))
    if (length(v) == 1L && !is.na(v)) v else 0L
  }, integer(1))
  mejor <- franjas[[which.max(n)]]
  list(
    aulas = max(n),
    inicio = as.character(mejor[["inicio"]] %||% ""),
    fin = as.character(mejor[["fin"]] %||% "")
  )
}

#' El mapa de horas por dia del dashboard de aulas.
#'
#' Deriva de `monitoreo_aulas_ventanas()` el bloque que el grafico de franjas
#' consume: por fecha agendada, las ventanas dibujables (confirmadas y
#' tentativas), el pico de carga simultanea contado por rango real y los
#' codigos por confirmar del dia.
#'
#' @param plan plan normalizado: lista de filas o data.frame (mismo formato
#'   que `monitoreo_aulas_dos_tasas` y `monitoreo_aulas_ventanas`).
#' @param duracion_min minutos de la aplicación (B70): pasa intacto a
#'   `monitoreo_aulas_ventanas()`; default 30.
#' @return lista con `dias`, `personas_fuente`, y el eco `duracion_min` /
#'   `preparacion_min` (B71) para que los gráficos deriven la ocupación real
#'   sin re-parsear horas ni inventarse constantes propias.
#' @keywords internal
monitoreo_aulas_franjas <- function(plan = list(),
                                    duracion_min = .mav_DURACION_MIN) {
  base <- monitoreo_aulas_ventanas(plan, duracion_min = duracion_min)
  aulas <- base[["aulas"]] %||% list()
  mapa <- base[["mapa"]] %||% list()

  # Las franjas confirmadas por fecha, tal como B11 ya las barrio: de aqui
  # sale el pico sin re-parsear ninguna hora.
  franjas_por_fecha <- list()
  for (dia in mapa) {
    fecha_mapa <- as.character(dia[["fecha"]] %||% "")
    if (nzchar(fecha_mapa)) {
      franjas_por_fecha[[fecha_mapa]] <- dia[["franjas"]] %||% list()
    }
  }

  # Un pase sobre `aulas`: ventanas dibujables y pendientes, agrupadas por la
  # fecha que ya viaja normalizada (tambien en el `sin_ventana`, que es lo que
  # permite extender `por_confirmar` sin volver al plan crudo).
  ventanas_por_fecha <- list()
  pendientes_por_fecha <- list()
  for (aula in aulas) {
    fecha <- as.character(aula[["fecha"]] %||% "")
    if (!nzchar(fecha)) next
    tipo <- as.character(aula[["ventana"]] %||% "")
    if (tipo %in% c("confirmada", "tentativa")) {
      ventanas_por_fecha[[fecha]] <- c(ventanas_por_fecha[[fecha]], list(list(
        codigo = as.character(aula[["codigo"]] %||% ""),
        inicio = as.character(aula[["inicio"]] %||% ""),
        fin = as.character(aula[["fin"]] %||% ""),
        confirmada = identical(tipo, "confirmada")
      )))
    }
    if (!identical(tipo, "confirmada")) {
      pendientes_por_fecha[[fecha]] <- c(
        pendientes_por_fecha[[fecha]],
        as.character(aula[["codigo"]] %||% "")
      )
    }
  }

  fechas <- sort(unique(c(
    names(ventanas_por_fecha), names(pendientes_por_fecha),
    names(franjas_por_fecha)
  )))

  dias <- lapply(fechas, function(fecha) {
    list(
      fecha = fecha,
      ventanas = ventanas_por_fecha[[fecha]] %||% list(),
      pico = .mafr_pico(franjas_por_fecha[[fecha]] %||% list()),
      por_confirmar = as.list(pendientes_por_fecha[[fecha]] %||% character(0))
    )
  })

  # B70/B71: el bloque declara con qué duración se armó y cuánto dura la
  # preparación (recojo+desplazamiento) — el eco existe para que los gráficos
  # del frontend pinten la ocupación real sin constantes propias.
  list(dias = dias, personas_fuente = "confirmadas",
       duracion_min = as.integer(base[["duracion_min"]] %||% duracion_min),
       preparacion_min = .mav_PREPARACION_MIN)
}
