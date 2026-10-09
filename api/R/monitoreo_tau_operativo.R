# Tres tasas con tres nombres, porque son tres cosas.
#
# Idea de Gonzalo (2026-08-28): «¿qué tan complejo es que este rendimiento se
# actualice cada x número de días? Es casi como una especie de estadística
# bayesiana […] habría que diferenciar el rendimiento inicial versus el
# rendimiento operativo […] que tengan nombres diferenciados para que se
# entienda bien».
#
#   · **tau de diseno**   — el que sello el sorteo. Justifico el tamano de
#     muestra y que aulas entraron. **NUNCA se recalcula.** Cambiarlo hacia atras
#     hace que la meta de ayer deje de ser reproducible y le quita al marco su
#     procedencia, que es justo lo que un evaluador externo revisa.
#   · **tau observado**   — lo que el campo lleva entregando, crudo. Es un HECHO
#     SOBRE EL PASADO. Con dos aulas cerradas es ruido; con cuarenta es solido.
#   · **tau operativo**   — lo que hay que esperar de la PROXIMA aula. Mezcla el
#     de diseno con el observado pesando por cuanta evidencia hay. Sin datos vale
#     exactamente el de diseno; con muchos converge al observado.
#
# La confusion que estos nombres existen para evitar es la mas cara de este
# repositorio: dos cifras distintas viviendo bajo la misma palabra. **Una
# superficie que enseñe una tasa tiene que decir cual de las tres es.**
#
# ## Por que un encogimiento y no la media a secas
#
# Porque al principio del campo la media a secas es inservible y ademas peligrosa:
# con tres aulas cerradas, una floja mueve la estimacion veinte puntos y la
# alerta que la consume manda a pedir aulas que no hacen falta. El encogimiento
# resuelve solo el problema que ya aparecio al medir la dispersion por facultad
# —diez de quince no tienen aulas suficientes para sostener una estimacion
# propia— sin que nadie decida caso por caso.
#
# Es la media posterior de un Beta-Binomial con previo `Beta(k0*tau, k0*(1-tau))`:
#
#   operativo = (k0*tau_diseno + exitos) / (k0 + intentos)
#
# que es identicamente `peso*observado + (1-peso)*diseno` con
# `peso = intentos/(intentos + k0)`. Se escribe de la segunda forma porque es la
# que se puede leer en una pantalla: **cuanto pesa lo que hemos visto**.
#
# `k0` es «cuantos intentos vale el supuesto». Con 10, hacen falta 10 intentos
# para que el campo pese la mitad. Es el mismo valor y la misma forma que ya usa
# `calc_muestra_aulas_profundidad.R` para encoger la tasa de caida por facultad.
#
# ## La cadencia es por evidencia, no por calendario
#
# Recalcular «cada tres dias» con dos aulas cerradas actualiza ruido, y con
# quince llega tarde. Se recalcula cuando hay intentos nuevos; el peso se encarga
# de que al principio casi no se mueva y al final mande el campo.

#' Cuantos intentos vale el supuesto de diseno.
#'
#' Con 10, el campo pesa la mitad a los 10 intentos. Mismo valor que el
#' encogimiento de la tasa de caida por facultad: no es casualidad, es la misma
#' pregunta —cuanta evidencia hace falta para apartarse de lo declarado—.
MONITOREO_TAU_K0 <- 10

.mto_num <- function(x, defecto = NA_real_) {
  v <- suppressWarnings(as.numeric(x))
  if (length(v) != 1L || !is.finite(v)) defecto else v
}

#' Las tres tasas de una celda, con su evidencia.
#'
#' @param exitos Respuestas validas conseguidas hasta ahora en la celda.
#' @param intentos Personas elegibles a las que ya se entro. **No es el numero
#'   de aulas**: una tasa por persona necesita personas en el denominador, y
#'   contar aulas daria el mismo peso a una de 12 que a una de 70.
#' @param tau_diseno La tasa que sello el diseno para esa celda, 0-1.
#' @param k0 Cuantos intentos vale el supuesto.
#' @return Lista con `diseno`, `observado` (NA sin intentos), `operativo`,
#'   `peso_evidencia` (0-1, cuanto manda el campo), `intentos`, `exitos` y
#'   `banda` (intervalo creible del 95 % del operativo). **`observado` es NA y no
#'   0 cuando no hay intentos**: no haber medido no es haber medido cero, y esa
#'   confusion convierte una celda sin empezar en una celda que va fatal.
#' @export
monitoreo_tau_operativo <- function(exitos, intentos, tau_diseno,
                                    k0 = MONITOREO_TAU_K0) {
  d <- .mto_num(tau_diseno)
  # Un diseno fuera de 0-1 no es una tasa. Se declara en vez de corregirse:
  # capar en silencio produciria un operativo que nadie puede reconciliar.
  if (is.na(d) || d < 0 || d > 1) {
    return(list(diseno = NA_real_, observado = NA_real_, operativo = NA_real_,
                peso_evidencia = 0, intentos = 0, exitos = 0,
                banda = c(NA_real_, NA_real_), estado = "diseno_invalido"))
  }
  n <- .mto_num(intentos, 0); if (n < 0) n <- 0
  e <- .mto_num(exitos, 0);   if (e < 0) e <- 0
  # Mas exitos que intentos es un dato roto, no una tasa mayor que 1.
  if (n > 0 && e > n) {
    return(list(diseno = d, observado = NA_real_, operativo = d,
                peso_evidencia = 0, intentos = n, exitos = e,
                banda = c(NA_real_, NA_real_), estado = "exitos_sobre_intentos"))
  }
  k <- .mto_num(k0, MONITOREO_TAU_K0); if (k <= 0) k <- MONITOREO_TAU_K0

  peso <- n / (n + k)
  observado <- if (n > 0) e / n else NA_real_
  operativo <- peso * (if (n > 0) observado else 0) + (1 - peso) * d

  # Banda creible del posterior Beta, que es lo que permite hablar «en
  # probabilidad» aguas abajo en vez de con un punto.
  alfa <- k * d + e
  beta <- k * (1 - d) + (n - e)
  banda <- if (alfa > 0 && beta > 0) {
    stats::qbeta(c(0.025, 0.975), alfa, beta)
  } else c(NA_real_, NA_real_)

  list(
    diseno = d, observado = observado, operativo = operativo,
    peso_evidencia = peso, intentos = n, exitos = e,
    banda = banda,
    estado = if (n == 0) "sin_evidencia" else "actualizado"
  )
}

#' ¿El campo se aparta del diseno, o todavia no se sabe?
#'
#' Devuelve `"por_encima"`, `"por_debajo"` o `"como_el_diseno"`. Lo tercero
#' cubre dos situaciones que en pantalla se leen igual y no lo son: que el campo
#' coincida con el supuesto, y que todavia no haya evidencia para decir nada.
#' Por eso se mira la BANDA y no la diferencia de puntos: **con pocos intentos
#' cualquier tasa se parece a cualquier otra**, y declarar una diferencia ahi es
#' inventar una senal.
#' @export
monitoreo_tau_veredicto <- function(tau) {
  if (!is.list(tau) || !is.finite(tau$diseno %||% NA_real_)) return("sin_evidencia")
  b <- tau$banda
  if (length(b) != 2L || any(!is.finite(b))) return("sin_evidencia")
  if (b[1] > tau$diseno) return("por_encima")
  if (b[2] < tau$diseno) return("por_debajo")
  "como_el_diseno"
}

#' Las tres tasas de varias celdas a la vez.
#'
#' @param celdas data.frame con `celda`, `exitos`, `intentos` y `tau_diseno`.
#' @param k0 Cuantos intentos vale el supuesto.
#' @return data.frame con una fila por celda y las columnas de
#'   `monitoreo_tau_operativo()` mas `veredicto`. Conserva el orden de entrada:
#'   quien llama suele haber ordenado por algo que le importa.
#' @export
monitoreo_tau_operativo_celdas <- function(celdas, k0 = MONITOREO_TAU_K0) {
  vacio <- data.frame(
    celda = character(0), diseno = numeric(0), observado = numeric(0),
    operativo = numeric(0), peso_evidencia = numeric(0), intentos = numeric(0),
    exitos = numeric(0), banda_baja = numeric(0), banda_alta = numeric(0),
    estado = character(0), veredicto = character(0), stringsAsFactors = FALSE
  )
  if (!is.data.frame(celdas) || !nrow(celdas)) return(vacio)
  faltan <- setdiff(c("celda", "exitos", "intentos", "tau_diseno"), names(celdas))
  if (length(faltan)) return(vacio)

  filas <- lapply(seq_len(nrow(celdas)), function(i) {
    t <- monitoreo_tau_operativo(celdas$exitos[i], celdas$intentos[i],
                                 celdas$tau_diseno[i], k0 = k0)
    data.frame(
      celda = as.character(celdas$celda[i]),
      diseno = t$diseno, observado = t$observado, operativo = t$operativo,
      peso_evidencia = t$peso_evidencia, intentos = t$intentos, exitos = t$exitos,
      banda_baja = t$banda[1], banda_alta = t$banda[2],
      estado = t$estado, veredicto = monitoreo_tau_veredicto(t),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  rownames(out) <- NULL
  out
}
