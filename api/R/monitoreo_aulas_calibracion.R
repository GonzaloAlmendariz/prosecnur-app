# =============================================================================
# Avance por celda facultad x sexo, con calibracion
# =============================================================================
#
# POR QUE EXISTE
#
# La celda de cuota sabia dos cosas: cuanto pide (`target`) y cuanto lleva
# (`observed`). Con eso se puede decir si YA llegaste, no si VAS a llegar, y
# cuando «ya no llegaste» es tarde.
#
# Faltaba ademas una tercera lectura que no es el avance: **si el campo se esta
# comportando como el modelo dice**. Son preguntas distintas y la segunda avisa
# antes:
#
#   logrado    lo obtenido de ese sexo, acumulado
#   previsto   lo que las aulas YA APLICADAS debian aportar de ese sexo
#   proyectado logrado + lo que aportaran las aulas PENDIENTES
#   calibracion  logrado / previsto  <- la pieza nueva
#
# La calibracion detecta un sesgo sistematico mientras todavia quedan aulas por
# delante. Y hay motivo para mirarla: en el campo 2025 la composicion lograda se
# desvio **+3,4 pp hacia mujeres** (meta 48,2 %, logrado 51,6 %), con **10 de 14
# facultades en la misma direccion** —GESTION +9,2, GASTRONOMIA +8,9, ARTES
# ESCENICAS +5,5, EE.GG. LETRAS +5,2—. Que EE.GG. LETRAS hombres fuera la unica
# celda incumplida de ese año no fue mala suerte: es la consecuencia previsible
# de ese sesgo en la facultad con el cuarto desvio mas grande.
#
# LO QUE ESTE MOTOR NO HACE
#
# **No corrige el modelo.** La decision de Gonzalo (2026-08-24) es reportar la
# calibracion y esperar a que 2026 confirme el sesgo con padron por sexo de cada
# aula antes de aplicar una tasa diferencial. Con los datos de 2025 no se puede
# separar «visitamos aulas con mas mujeres» de «las mujeres responden mas»,
# porque falta ese padron. Publicar el numero es lo que permite decidirlo
# despues; aplicarlo ahora seria calibrar contra una hipotesis.

MONITOREO_AULAS_CALIBRACION_SCHEMA <- "monitoreo_aulas_avance_sexo_facultad_v1"

# Umbral de margen para `ajustada`, en proporcion de la cuota. 5 % es la
# decision de Gonzalo (2026-08-24), declarada revisable.
.MAC_MARGEN_AJUSTADA <- 0.05

#' Estado de cobertura PROYECTADA de una celda.
#'
#' A diferencia de `.monitoreo_aulas_quota_estado`, que es retrospectivo, este
#' mira hacia adelante y por eso SI usa el vocabulario proyectivo. Los dos
#' conviven a proposito: uno dice donde estas y el otro si vas a llegar.
#'
#' `deficit_no_subsanable` es el unico que no se puede afirmar sin saber si
#' queda pool: con `pool_restante = NA` un deficit se queda en
#' `deficit_proyectado`, que pide una accion posible, en vez de declarar una
#' derrota que quiza no lo sea.
#'
#' @param cuota meta de la celda.
#' @param proyeccion logrado + aporte esperado de lo pendiente.
#' @param pool_restante aulas disponibles fuera del plan para esa celda; `NA` si
#'   no se sabe.
#' @return vector de estados.
#' @keywords internal
.mac_estado_proyectado <- function(cuota, proyeccion, pool_restante = NA_real_) {
  cuota <- suppressWarnings(as.numeric(cuota))
  proyeccion <- suppressWarnings(as.numeric(proyeccion))
  pool <- suppressWarnings(as.numeric(pool_restante))
  n <- max(length(cuota), length(proyeccion))
  cuota <- rep_len(cuota, n); proyeccion <- rep_len(proyeccion, n); pool <- rep_len(pool, n)
  cuota[!is.finite(cuota)] <- 0
  proyeccion[!is.finite(proyeccion)] <- 0
  ifelse(cuota <= 0, "sin_cuota",
  ifelse(proyeccion >= cuota * (1 + .MAC_MARGEN_AJUSTADA), "asegurada",
  ifelse(proyeccion >= cuota, "ajustada",
  ifelse(is.finite(pool) & pool <= 0, "deficit_no_subsanable", "deficit_proyectado"))))
}

#' Brecha de una celda, en personas.
#'
#' **Hacia ARRIBA y entera**: si faltan 0,1 encuestas falta una persona, y con
#' cero la celda sigue corta. Es el unico sitio del avance donde se redondea
#' hacia arriba, porque es lo unico que se PIDE.
#'
#' @param cuota meta de la celda.
#' @param proyeccion logrado + aporte esperado de lo pendiente.
#' @return entero >= 0.
#' @keywords internal
.mac_brecha <- function(cuota, proyeccion) {
  cuota <- suppressWarnings(as.numeric(cuota))
  proyeccion <- suppressWarnings(as.numeric(proyeccion))
  cuota[!is.finite(cuota)] <- 0
  proyeccion[!is.finite(proyeccion)] <- 0
  as.integer(pmax(0, ceiling(cuota - proyeccion)))
}

#' Calibracion de una celda: lo logrado contra lo que se preveia.
#'
#' `NA` sin previsto: una celda cuyas aulas aun no se aplican no esta
#' descalibrada, es que todavia no hay con que comparar. Devolver 0 la pintaria
#' de rojo el primer dia de campo.
#'
#' @param logrado efectivas obtenidas de ese sexo.
#' @param previsto lo que las aulas ya aplicadas debian aportar.
#' @return razon o `NA`.
#' @keywords internal
.mac_calibracion <- function(logrado, previsto) {
  logrado <- suppressWarnings(as.numeric(logrado))
  previsto <- suppressWarnings(as.numeric(previsto))
  ifelse(is.finite(previsto) & previsto > 0 & is.finite(logrado), logrado / previsto, NA_real_)
}

# Etiquetas para persona, no para programa.
#
# Gonzalo (2026-08-24): «que la informacion de los graficos e indicadores no sea
# muy criptica en la app sino que se entienda claramente sin caer en jerga».
# `deficit_no_subsanable` es una clave correcta y una etiqueta pesima: la clave
# viaja en el payload y la frase es lo que lee quien decide.
#
# Cada etiqueta dice lo que PASA y, cuando hace falta, cuanto: «faltan 3
# encuestas» manda a alguien a un aula; «deficit proyectado» no.
.mac_etiqueta_estado <- function(estado, brecha = NA_integer_) {
  b <- suppressWarnings(as.integer(brecha)[1])
  switch(as.character(estado)[1],
    sin_cuota = "Sin cuota trazada",
    # **La etiqueta dice DE QUE UNIVERSO habla.** `estado` se calcula sobre el
    # plan ENTERO —lo logrado mas todo lo pendiente, tenga fecha o no—, asi que
    # «va a llegar» solo es cierto si todo lo que aun no esta agendado acaba
    # agendandose y aplicandose. El 2026-09-10, con 30 celdas: CERO cortas por
    # esta lectura y SEIS cortas contando solo lo que YA tiene fecha. Las seis
    # decian «Va a llegar, con margen» mientras el panel de abajo decia que no
    # llegan: dos superficies con cifras opuestas, que es el defecto que esta
    # seccion lleva toda la sesion corrigiendo.
    #
    # No se arregla cambiando el calculo —la lectura del plan entero es
    # legitima y es el techo— sino nombrando su universo, que es la politica que
    # Gonzalo fijo: «no se resuelve eligiendo una, se resuelve ensenandolas
    # juntas y diciendo cada una de que universo habla».
    asegurada = "Llega con todo el plan, con margen",
    ajustada = "Llega con todo el plan, sin margen: hay que vigilarla",
    deficit_proyectado = if (is.finite(b) && b > 0)
      sprintf("No llega ni con todo el plan: %s", if (b == 1L) "falta 1 encuesta" else sprintf("faltan %d encuestas", b))
      else "No llega ni con todo el plan",
    deficit_no_subsanable = if (is.finite(b) && b > 0)
      sprintf("No llega y ya no quedan cursos-horario: %s y habrá que ponderar",
              if (b == 1L) "falta 1 encuesta" else sprintf("faltan %d encuestas", b))
      else "No llega y ya no quedan cursos-horario: habrá que ponderar",
    "Sin estado"
  )
}

# La calibracion en una frase. El numero solo -0,85- no dice ni en que direccion
# ni de que; la frase dice las dos cosas y no usa la palabra «calibracion».
#
# **Y dice sobre cuanto, cuando es poco.** `.mac_calibracion` es `logrado /
# previsto` sin suelo ni techo, asi que una celda diminuta produce una afirmacion
# tan rotunda como una grande. Medido el 2026-08-30 en el estudio real:
# EDUCACION/M tiene `previsto` 2,5 y `logrado` 1, o sea calibracion 0,404, y la
# frase salia «El campo esta rindiendo un 60 % menos de lo previsto» —una
# sentencia sobre el campo entero de esa celda, sacada de UNA encuesta—. Con dos
# habria dicho 20 % menos y con tres, 20 % mas.
#
# Este motor ya tenia el criterio al lado y no se le habia aplicado a la
# calibracion: la dispersion no se publica con menos de
# `.MAC_MINIMO_PARA_DISPERSION` aulas, y su vista lo dice en vez de callarlo.
# Aqui igual: la frase se da, porque el dato es el que hay y ocultarlo seria
# peor, pero declara su base para que nadie la lea como una tendencia asentada.
.MAC_PREVISTO_MINIMO_PARA_AFIRMAR <- 10

.mac_etiqueta_calibracion <- function(cal, previsto = NA_real_) {
  c1 <- suppressWarnings(as.numeric(cal)[1])
  if (!is.finite(c1)) return("Todavía sin cursos-horario aplicados con qué comparar")
  pct <- round(abs(c1 - 1) * 100)
  if (pct < 1) return("El campo está rindiendo lo previsto")
  base <- suppressWarnings(as.numeric(previsto)[1])
  salvedad <- if (is.finite(base) && base > 0 && base < .MAC_PREVISTO_MINIMO_PARA_AFIRMAR) {
    sprintf(", pero sobre muy poco: sólo %s de margen", .mac_frase_encuestas(base))
  } else ""
  sprintf("El campo está rindiendo un %d %% %s de lo previsto%s", pct,
          if (c1 < 1) "menos" else "más", salvedad)
}

# «2,5 encuestas» y no «2.5 encuestas»: el previsto es fraccionario porque
# reparte por sexo, y la coma es la notacion de la app en prosa.
.mac_frase_encuestas <- function(x) {
  n <- suppressWarnings(as.numeric(x)[1])
  redondo <- abs(n - round(n)) < 0.05
  cifra <- if (redondo) format(round(n)) else sub("[.]", ",", sprintf("%.1f", n))
  if (redondo && abs(round(n)) == 1) sprintf("%s encuesta prevista", cifra)
  else sprintf("%s encuestas previstas", cifra)
}


# Las efectivas esperadas de un aula, repartidas por sexo.
#
# Dos fuentes y se declara cual se uso, porque no valen lo mismo:
#
#   . `mujeres_esperadas` / `hombres_esperados` — los escribe la app en la hoja
#     de control. Es el dato directo cuando existe.
#   . `expected_valid` x la composicion del aula (`sex_top_1_n` / `sex_top_2_n`)
#     — la derivacion, que es la que ya usaba
#     `.monitoreo_aulas_plan_sex_faculty_targets` para las metas. Reparte lo que
#     el aula promete en la proporcion de sexos de SUS elegibles.
#
# La derivacion asume que la tasa de efectividad no depende del sexo. Es
# exactamente el supuesto que la calibracion existe para poner a prueba: en 2025
# la composicion lograda se fue +3,4 pp hacia mujeres. Por eso el origen viaja
# en el payload: una calibracion sobre un previsto derivado mide el supuesto y
# el campo a la vez, y quien lea tiene que poder saberlo.
.mac_esperadas_por_sexo <- function(fila) {
  num <- function(x) {
    v <- suppressWarnings(as.numeric(.monitoreo_scalar(x, NA))[1])
    if (is.finite(v)) v else NA_real_
  }
  m <- num(fila$mujeres_esperadas); h <- num(fila$hombres_esperados)
  if (is.finite(m) || is.finite(h)) {
    v <- c(F = if (is.finite(m)) m else 0, M = if (is.finite(h)) h else 0)
    return(list(valores = v, origen = "hoja_de_control"))
  }
  esp <- num(fila$expected_valid %||% fila$efectivas_esperadas)
  s1 <- toupper(.monitoreo_scalar(fila$sex_top_1 %||% "", ""))
  s2 <- toupper(.monitoreo_scalar(fila$sex_top_2 %||% "", ""))
  n1 <- num(fila$sex_top_1_n); n2 <- num(fila$sex_top_2_n)
  n1 <- if (is.finite(n1)) n1 else 0; n2 <- if (is.finite(n2)) n2 else 0
  total <- n1 + n2
  if (!is.finite(esp) || esp <= 0 || total <= 0 || !nzchar(s1)) {
    return(list(valores = numeric(0), origen = "sin_dato"))
  }
  v <- c(esp * n1 / total)
  names(v) <- s1
  if (nzchar(s2) && n2 > 0) v[[s2]] <- esp * n2 / total
  list(valores = v, origen = "composicion_del_aula")
}

#' Cuanta INCERTIDUMBRE aporta un aula pendiente a su celda.
#'
#' El estado de una celda se decide hoy con un umbral sobre una proyeccion
#' puntual: `asegurada` si supera la cuota por el margen, `ajustada` si la
#' iguala. Una celda al 100,1 % de su cuota se declara tan segura como una al
#' 150 %, y eso es lo que esta funcion existe para reparar.
#'
#' Si el aporte de un aula se modela como Binomial(n_sexo, tasa), entonces
#' `media = n_sexo * tasa` —que es justo lo que devuelve
#' `.mac_esperadas_por_sexo()`— y **`varianza = media * (1 - tasa)`**. Asi que
#' no hace falta ningun dato nuevo: basta la tasa del aula, que sale de sus
#' propias esperadas sobre sus elegibles.
#'
#' **Sin tasa no hay varianza, y entonces no hay probabilidad.** Devuelve `NA`
#' en vez de suponer una tasa: una probabilidad calculada sobre un supuesto
#' inventado es peor que no darla.
#'
#' @param fila fila del plan.
#' @param esperadas vector de esperadas por sexo de esa aula.
#' @return vector con la misma forma que `esperadas`, o `NA` si no hay tasa.
#' @keywords internal
.mac_varianza_por_sexo <- function(fila, esperadas) {
  if (!length(esperadas)) return(esperadas)
  num <- function(x) {
    v <- suppressWarnings(as.numeric(.monitoreo_scalar(x, NA))[1])
    if (is.finite(v)) v else NA_real_
  }
  elegibles <- num(fila$eligible_n %||% fila$elegibles)
  esperadas_aula <- num(fila$expected_valid %||% fila$efectivas_esperadas)
  tasa <- num(fila$tasa_efectividad_aula)
  if (!is.finite(tasa) && is.finite(elegibles) && elegibles > 0 && is.finite(esperadas_aula)) {
    tasa <- esperadas_aula / elegibles
  }
  # Una tasa fuera de (0,1) no es una tasa. Con 1 exacta la varianza es cero, y
  # eso afirmaria certeza absoluta sobre el campo, que nunca la hay.
  if (!is.finite(tasa) || tasa <= 0 || tasa >= 1) {
    return(stats::setNames(rep(NA_real_, length(esperadas)), names(esperadas)))
  }
  stats::setNames(pmax(0, as.numeric(esperadas) * (1 - tasa)), names(esperadas))
}

#' Cuanto MAS varia el campo de lo que la binomial supone.
#'
#' La probabilidad de cierre suponia independencia entre las respuestas de un
#' aula, y eso es optimista: el rendimiento varia de aula a aula. Medido sobre
#' los tres simulacros de HSVG2026 a semana y media, con ~151 aulas aplicadas
#' cada uno, la dispersion real es de **2,8 a 4,4** — o sea que la desviacion
#' estandar salia entre 1,7 y 2,1 veces demasiado pequeña, y la probabilidad se
#' iba a 0 o a 100 sin decir nada: 12 celdas a «0 %», 4 a «100 %» y solo dos en
#' medio, de 30.
#'
#' Se estima **del propio estudio** y no de un `deff` traido de otro sitio: es
#' el estadistico de Pearson de un quasi-Poisson sobre las aulas ya aplicadas.
#'
#' **Alrededor de la media CALIBRADA, no de la del diseño.** Es la correccion que
#' decide: si el campo rinde un 56 % de lo previsto —el escenario «campo malo»—,
#' el Pearson crudo da 6,09 y esta contando el SESGO como si fuera ruido. Netos
#' del sesgo son 4,44. Sesgo y dispersion son dos cosas y la app ya publica la
#' primera aparte, como `calibracion`.
#'
#' @param plan filas del plan ya normalizadas (con `respuestas_validas` y
#'   `expected_valid`).
#' @return lista con `phi` y `n`, o `phi = NA` si no hay aulas suficientes.
#' @keywords internal
.MAC_MINIMO_PARA_DISPERSION <- 20L

.mac_dispersion_observada <- function(plan = list()) {
  vacio <- list(phi = NA_real_, n = 0L)
  if (!length(plan)) return(vacio)
  num <- function(x) {
    v <- suppressWarnings(as.numeric(.monitoreo_scalar(x, NA))[1])
    if (is.finite(v)) v else NA_real_
  }
  y <- vapply(plan, function(f) if (is.list(f)) num(f$respuestas_validas) else NA_real_, numeric(1))
  mu <- vapply(plan, function(f) if (is.list(f)) num(f$expected_valid) else NA_real_, numeric(1))
  # Solo aulas con campo: `y > 0` excluye las que aun no se aplicaron, que no
  # dicen nada de la dispersion y la hundirian hacia cero.
  ok <- is.finite(y) & is.finite(mu) & mu > 0 & y > 0
  n <- sum(ok)
  if (n < .MAC_MINIMO_PARA_DISPERSION) return(list(phi = NA_real_, n = as.integer(n)))
  y <- y[ok]; mu <- mu[ok]
  r <- sum(y) / sum(mu)
  if (!is.finite(r) || r <= 0) return(list(phi = NA_real_, n = as.integer(n)))
  phi <- sum((y - r * mu)^2 / (r * mu)) / (n - 1)
  # Por debajo de 1 no se encoge la varianza: menos dispersion que la binomial
  # seria un artefacto del estimador, no una noticia buena.
  list(phi = if (is.finite(phi)) max(1, round(phi, 2)) else NA_real_, n = as.integer(n))
}

#' Probabilidad de que una celda cierre su cuota.
#'
#' Normal sobre la suma de los aportes pendientes:
#' `P = pnorm((proyeccion - cuota) / sd)`. Con `sd` cero o no finito devuelve
#' `NA`: sin varianza medible no hay probabilidad que dar.
#'
#' **Supone independencia entre los alumnos de un aula, y eso es optimista.**
#' El rendimiento varia de aula a aula, asi que la varianza real es mayor y la
#' probabilidad que sale de aqui es una COTA SUPERIOR de la confianza. Se dice
#' en pantalla, no solo aqui. No se infla por ningun factor de diseno: el `deff`
#' medido de HSVG 2025 (1,29 / 1,55) es el de sus estimaciones ponderadas, que
#' es otra cosa que la varianza de un conteo por celda, y aplicarlo aqui seria
#' vestir de medida un supuesto.
#'
#' @param cuota meta de la celda.
#' @param proyeccion logrado mas aporte esperado de lo pendiente.
#' @param varianza suma de varianzas de los aportes pendientes.
#' @param phi sobredispersion medida del estudio. **Sin ella no hay
#'   probabilidad**: la binomial sola da una confianza que el campo no respalda,
#'   y antes de que haya aulas aplicadas no hay con que medirla. Publicar un
#'   porcentaje ahi seria fingir precision justo cuando menos se sabe.
#' @return probabilidad en [0,1], o `NA`.
#' @keywords internal
.mac_probabilidad_de_cierre <- function(cuota, proyeccion, varianza, phi = NA_real_) {
  cuota <- suppressWarnings(as.numeric(cuota)[1])
  proyeccion <- suppressWarnings(as.numeric(proyeccion)[1])
  varianza <- suppressWarnings(as.numeric(varianza)[1])
  if (!is.finite(cuota) || cuota <= 0) return(NA_real_)
  if (!is.finite(proyeccion) || !is.finite(varianza) || varianza <= 0) return(NA_real_)
  phi <- suppressWarnings(as.numeric(phi)[1])
  if (!is.finite(phi) || phi <= 0) return(NA_real_)
  round(stats::pnorm((proyeccion - cuota) / sqrt(varianza * phi)), 3)
}

#' Unidades de `previsto` para que la calibracion observada pese la mitad.
#'
#' 60 es del orden de dos aulas medianas: con una sola aula aplicada el diseño
#' sigue mandando, y hacia las cuatro o cinco manda el campo. No es un umbral
#' magico —es un peso— y por eso vive con nombre en vez de incrustado.
#' @noRd
.MAC_ENCOGIMIENTO <- 60

#' La calibracion del campo, encogida hacia 1.
#'
#' Sin encoger, una celda con un aula aplicada que rindio el doble de lo previsto
#' proyectaria el doble para TODO lo que le queda. El encogimiento hace que la
#' correccion valga en proporcion a cuanto se ha observado.
#' @noRd
.mac_factor_de_campo <- function(cal, previsto) {
  p <- suppressWarnings(as.numeric(previsto)[1])
  if (!is.finite(cal) || cal <= 0 || !is.finite(p) || p <= 0) return(1)
  (p * cal + .MAC_ENCOGIMIENTO) / (p + .MAC_ENCOGIMIENTO)
}

#' Un aula aplicada DE HECHO, se llame como se llame en el plan.
#'
#' Misma regla que `.madt_aplicada_de_hecho()` en `monitoreo_aulas_dos_tasas.R`:
#' la plataforma manda y el parte respalda. Vive aqui y no se importa de alli
#' porque aquel es privado de su motor; si un dia se comparte, se comparte una
#' vez y las dos la llaman.
#'
#' Limite declarado: un aula aplicada con CERO efectivas y sin parte sigue
#' contando como pendiente. Es el mismo limite que su gemela y por la misma
#' razon: sin ninguna senal, no hay como distinguirla de una que no se visito.
#' @noRd
.mac_aplicada_de_hecho <- function(fila) {
  val <- suppressWarnings(as.numeric(.monitoreo_scalar(fila$respuestas_validas %||% NA, NA))[1])
  if (is.finite(val) && val > 0) return(TRUE)
  parte <- suppressWarnings(as.numeric(.monitoreo_scalar(fila$effective_surveys %||% NA, NA))[1])
  if (is.finite(parte) && parte > 0) return(TRUE)
  identical(
    monitoreo_aulas_estado_aplicacion(.monitoreo_scalar(fila$application_status %||% "", "")),
    "aplicada"
  )
}

#' El avance por facultad y sexo, con su proyección y su calibración.
#'
#' **Recupera el `@export` que la función había perdido.** Estaba en `NAMESPACE`
#' de una regeneración anterior y el bloque roxygen ya no estaba en el código, así
#' que la primera regeneración posterior la borró de la lista de exportadas — y
#' la usa `monitoreo_aulas_universitarias.R` para las celdas de avance. Es el
#' modo de fallo que el ADR 0070 describe: `NAMESPACE` se genera, y lo que no
#' tiene `@export` en su sitio desaparece en silencio.
#'
#' @param plan lista de filas del plan; cada una con `faculty`,
#'   `operational_status` y los esperados por sexo (`mujeres_esperadas`,
#'   `hombres_esperados`).
#' @param cuotas lista de celdas con `faculty`, `sex`, `target`, `observed`.
#' @param pool_restante lista opcional `facultad|sexo -> aulas disponibles`.
#' @return lista de celdas con logrado, previsto, proyeccion, calibracion,
#'   brecha, estado y sus etiquetas.
#' @export
monitoreo_aulas_avance_sexo_facultad <- function(plan = list(), cuotas = list(),
                                                 pool_restante = list()) {
  if (!length(cuotas)) return(list())
  # Los esperados por sexo se acumulan separando APLICADAS de PENDIENTES: el
  # previsto es el denominador de la calibracion y solo puede contar aulas que
  # ya ocurrieron. Meter las pendientes ahi pintaria de rojo el primer dia.
  acc <- new.env(parent = emptyenv())
  # Varianza del aporte PENDIENTE, con la misma clave pero sin el sufijo
  # aplicada/pendiente: lo aplicado no aporta incertidumbre.
  accv <- new.env(parent = emptyenv())
  # La sobredispersion del estudio: UNA vez para todas las celdas. Es una
  # propiedad del campo, no de la celda, y estimarla por celda daria un phi
  # sobre un puñado de aulas que se movería mas que el dato que corrige.
  disp <- .mac_dispersion_observada(plan)
  origenes <- character(0)
  for (fila in plan) {
    if (!is.list(fila)) next
    fac <- .monitoreo_text_key(.monitoreo_scalar(fila$faculty %||% fila$stratum %||% "", ""))
    if (!nzchar(fac)) next
    estado_op <- .monitoreo_aulas_status(fila$operational_status %||% "")
    # **Un curso-horario reemplazado no aporta ni va a aportar.**
    #
    # Salio del plan por su reserva y esa reserva viaja en el MISMO plan con su
    # propio `expected_valid`: contarlas juntas seria contar dos veces lo que se
    # espera recibir.
    #
    # **Hoy no llegan hasta aqui, y conviene saber por que.** `tracked_df` se
    # construye con `monitoreo_aulas_en_juego`, que agrupa por CADENA —titular
    # mas sus reservas— y deja **una sola fila viva por cadena**: si hay reserva
    # despierta gana la de mayor `replacement_order`, y el titular reemplazado se
    # queda fuera. Comprobado en HSVG2026 el 2026-08-30: de 1.347 seguidas salen
    # 174 en juego (152 aplicadas + 22 agendadas) y **ni una sola reemplazada**,
    # aunque «reemplazada» no este en `MONITOREO_AULAS_ESTADOS_DORMIDOS`.
    #
    # Se deja igualmente porque esta funcion recibe una lista de filas y no puede
    # dar por hecho quien la filtro antes: sus propias pruebas la llaman con
    # planes que si traen reemplazadas. Es defensa en profundidad, no el arreglo
    # de un defecto observado.
    if (identical(estado_op, "reemplazada")) next
    # `cerrada` es aplicada y terminada. Estaba cayendo del lado de las
    # pendientes por comparar contra la cadena «aplicada» a secas, cuando el
    # resto del motor cuenta las dos juntas —`aulas_aplicadas` es
    # `operational_status %in% c("aplicada", "cerrada")`—. En este estudio no hay
    # ninguna todavia; el dia que la haya, su aporte ya recibido se habria
    # contado como aporte por recibir.
    # **NO se le pregunta a `operational_status`, se mira la EVIDENCIA.**
    #
    # Ese campo no lo actualiza nadie: medido sobre HSVG26ULT2 el 2026-09-10,
    # valia «planificada» en los 174 titulares mientras 60 ya tenian respuestas.
    # Con el solo, esas 60 caian del lado de las PENDIENTES y su aporte esperado
    # se sumaba a la proyeccion ADEMAS de su logrado real —1 059 esperadas
    # encima de 1 184 logradas—, asi que las 30 celdas del estudio salian
    # «asegurada» con una proyeccion de 4 350 sobre una cuota de 2 500. Aguas
    # abajo eso apagaba dos superficies: `reserva_dirigida` publicaba CERO
    # candidatos —el panel «A que aula del banco ir» no se encendia nunca— y
    # `previsto` salia nulo en las 30, con lo que la calibracion tampoco se
    # podia calcular.
    #
    # Es el MISMO defecto que ya obligo a reparar `dos_tasas` (`531369a2`) en
    # otro consumidor, y el arreglo es el mismo: plataforma primero, parte como
    # respaldo, y el estado del plan sigue valiendo cuando SI dice algo.
    aplicada <- estado_op %in% c("aplicada", "cerrada") || .mac_aplicada_de_hecho(fila)
    esp <- .mac_esperadas_por_sexo(fila)
    if (!length(esp$valores)) next
    origenes <- c(origenes, esp$origen)
    # La varianza SOLO de las pendientes: lo aplicado ya ocurrio y no aporta
    # incertidumbre a si la celda va a cerrar. `NA` en una sola aula envenena la
    # suma a proposito —es lo correcto—: si no se sabe cuanto varia una de las
    # que faltan, no se puede afirmar una probabilidad para esa celda.
    varz <- if (aplicada) NULL else .mac_varianza_por_sexo(fila, esp$valores)
    # **Tres baldes y no dos.** `ap` es lo aplicado, `pe` todo lo que falta y
    # `ag` la parte de `pe` que YA TIENE FECHA. Gonzalo, 2026-09-10: «tanto b
    # como c son importantes, deben servir para mayor contexto» — o sea que la
    # pantalla necesita distinguir el techo (todo el plan en juego) de lo que
    # hay comprometido (lo agendado), y no elegir uno.
    agendada <- nzchar(.monitoreo_scalar(fila$scheduled_date %||% fila$fecha %||% "", ""))
    for (sx in names(esp$valores)) {
      k <- paste0(fac, "|", sx, "|", if (aplicada) "ap" else "pe")
      acc[[k]] <- (acc[[k]] %||% 0) + esp$valores[[sx]]
      if (!aplicada && agendada) {
        ka <- paste0(fac, "|", sx, "|ag")
        acc[[ka]] <- (acc[[ka]] %||% 0) + esp$valores[[sx]]
      }
      if (!is.null(varz)) {
        kv <- paste0(fac, "|", sx)
        accv[[kv]] <- (accv[[kv]] %||% 0) + varz[[sx]]
      }
    }
  }
  origen <- if (!length(origenes)) "sin_dato"
            else if (length(unique(origenes)) == 1L) unique(origenes)
            else "mixto"
  lapply(cuotas, function(celda) {
    fac <- .monitoreo_text_key(.monitoreo_scalar(celda$faculty %||% "", ""))
    sx <- toupper(.monitoreo_scalar(celda$sex %||% "", ""))
    cuota <- suppressWarnings(as.numeric(.monitoreo_scalar(celda$target %||% 0, 0))[1])
    logrado <- suppressWarnings(as.numeric(.monitoreo_scalar(celda$observed %||% 0, 0))[1])
    previsto <- acc[[paste0(fac, "|", sx, "|ap")]] %||% NA_real_
    pendiente <- acc[[paste0(fac, "|", sx, "|pe")]] %||% 0
    # Lo pendiente que YA tiene fecha: es el subconjunto comprometido.
    pendiente_ag <- acc[[paste0(fac, "|", sx, "|ag")]] %||% 0
    proyeccion <- (if (is.finite(logrado)) logrado else 0) + pendiente
    pool <- suppressWarnings(as.numeric(pool_restante[[paste0(fac, "|", sx)]] %||% NA_real_)[1])
    varianza <- accv[[paste0(fac, "|", sx)]] %||% NA_real_
    estado <- .mac_estado_proyectado(cuota, proyeccion, pool)
    brecha <- .mac_brecha(cuota, proyeccion)
    cal <- .mac_calibracion(logrado, previsto)
    base <- if (is.finite(logrado)) logrado else 0
    # (b) SOLO lo agendado, a la tasa que el diseño le puso.
    proy_ag <- base + pendiente_ag
    # (c) lo mismo, corregido por lo que el campo ESTA rindiendo en esta celda.
    #
    # El factor es la calibracion —logrado sobre previsto— ENCOGIDA hacia 1: con
    # una sola aula aplicada su cociente no es la tasa de la celda, y publicarlo
    # crudo haria bailar la proyeccion con cada parte que entra. El peso del
    # encogimiento es el propio `previsto`, que ya mide cuanto se ha observado:
    # con poco previsto manda el diseño, y a medida que el campo acumula manda
    # el campo. `.MAC_ENCOGIMIENTO` son las unidades de previsto que hacen falta
    # para que la observada pese la mitad.
    factor <- .mac_factor_de_campo(cal, previsto)
    proy_ag_obs <- base + pendiente_ag * factor
    list(
      faculty = .monitoreo_scalar(celda$faculty %||% "", ""), sex = sx,
      cuota = cuota, logrado = logrado,
      previsto = if (is.finite(previsto)) round(previsto, 1) else NA_real_,
      aporte_pendiente = round(pendiente, 1),
      # Lo comprometido, que es el subconjunto con fecha del pendiente.
      aporte_agendado = round(pendiente_ag, 1),
      proyeccion = round(proyeccion, 1),
      # Las otras dos lecturas de la misma pregunta. Van JUNTAS a proposito: la
      # diferencia entre ellas dice si el campo rinde por encima o por debajo de
      # lo que el diseño supuso, y esa diferencia es informacion, no ruido.
      proyeccion_agendada = round(proy_ag, 1),
      proyeccion_agendada_observada = round(proy_ag_obs, 1),
      factor_de_campo = if (is.finite(factor)) round(factor, 3) else NA_real_,
      brecha = brecha,
      calibracion = if (is.finite(cal)) round(cal, 3) else NA_real_,
      estado = estado,
      # La misma pregunta que `estado` —«va a llegar?»— con la incertidumbre
      # puesta. `NA` cuando no hay varianza medible, que es distinto de 0.
      prob_cierre = .mac_probabilidad_de_cierre(cuota, proyeccion, varianza, disp$phi),
      # Lo que corrige esa probabilidad, para poder declararlo en pantalla: sin
      # decir sobre cuantas aulas se midio, un «x4,4» no es comprobable.
      dispersion = disp$phi,
      dispersion_n = disp$n,
      previsto_origen = origen,
      etiqueta = .mac_etiqueta_estado(estado, brecha),
      etiqueta_calibracion = .mac_etiqueta_calibracion(cal, previsto)
    )
  })
}
