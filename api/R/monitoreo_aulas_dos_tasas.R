# monitoreo_aulas_dos_tasas.R — las DOS tasas de efectividad, al grano de AULA.
#
# Mandato de Gonzalo (B3, 2026-08-31): «poder tener margenes de los esperados y
# no descartar algo o catalogarlo como algo simplemente porque la tasa de
# efectividad no es la esperada». Un aula fuera de margen se SEÑALA, no se
# descarta: por eso la salida no lleva ningun campo «valido»/«cumple» y ninguna
# aula sale del calculo por su tasa.
#
# La mitad FACULTAD ya existe (`monitoreo_aulas_efectividad_seguimiento.R`, ADR
# 0082) y no se toca: aquella contesta si la τ agregada de una facultad difiere
# de lo supuesto y si su cuota va a cerrar. Esta mitad baja al grano AULA y pone
# las dos varas LADO A LADO en cada fila: la prevista del diseño para ESA aula
# (`tasa_efectividad_aula`) y la de su facultad (`tasa_facultad`, tal como
# viaja en la fila del plan). Un aula bajo su propia meta tuvo un problema; una
# bajo la de su facultad pero sobre la suya solo es mas grande que el promedio,
# y sin las dos tasas en la misma fila los dos casos se ven iguales.
#
# La banda sigue el patron de `tasaDeCaida.ts`: 2*sqrt(p*(1-p)/n) armada sobre
# la p de REFERENCIA (la prevista) con el n del aula (sus elegibles). Dentro
# del margen NO se le pone nombre —`conforme`, sin direccion—; `bajo`/`sobre`
# solo fuera de banda.
#
# Calculo puro sobre estado ya validado: degrada declarando, nunca lanza. Por
# eso aqui no hay `stop_api()` ni `stop()`.

# Con menos elegibles que esto no se arma banda. No es un numero magico: la
# banda binomial en su caso mas ancho (p = 0.5) mide 2*sqrt(0.25/n) = 1/sqrt(n),
# y con n < 16 supera ±25 puntos —mas de la mitad de la escala [0,1]—, o sea
# que CUALQUIER observada saldria «conforme» y la banda dejaria de decir nada.
# En n = 16 queda exactamente en ±25 pp, que es el limite de lo legible. La
# cifra observada VIAJA igual con `sin_banda`: se enseña sin juzgarla.
.madt_ELEGIBLES_MINIMOS <- 16

# El plan puede llegar como data.frame (el `plan_df` del tablero) o como lista
# de filas (los tests y el estado crudo). Se unifica a lista de listas con el
# helper que ya usa el resto del payload, sin tope: recortar aqui seria
# descartar aulas en silencio, que es justo lo que este bloque viene a quitar.
.madt_filas <- function(plan) {
  if (is.null(plan)) return(list())
  if (is.data.frame(plan)) return(.monitoreo_aulas_records(plan))
  if (is.list(plan)) return(Filter(is.list, plan))
  list()
}

# El numerador de un aula, con su origen declarado.
#
# La efectiva de PLATAFORMA (`respuestas_validas` de la fila: la respuesta que
# llego y paso los filtros declarados) manda, porque es la misma clase de tasa
# que dimensiono y la que ADR 0079 usa para medir cumplimiento. El parte de
# campo (`effective_surveys`) entra como RESPALDO cuando la plataforma no trae
# nada, y el origen usado viaja en `numerador` para que la vista no tenga que
# adivinar de que fuente sale la cifra.
#
# El cero es un DATO: `respuestas_validas = 0` es una medicion —nadie paso los
# filtros—, no un hueco, asi que 0 de plataforma NO cae al parte.
.madt_efectivas <- function(fila) {
  plataforma <- .monitoreo_num(fila[["respuestas_validas"]], NA_real_)
  if (is.finite(plataforma)) return(list(valor = as.numeric(plataforma), origen = "plataforma"))
  parte <- .monitoreo_num(fila[["effective_surveys"]], NA_real_)
  if (is.finite(parte)) return(list(valor = as.numeric(parte), origen = "parte"))
  list(valor = NA_real_, origen = NA_character_)
}

# Quien entra a la medicion: los TITULARES y quien tenga señal de campo.
#
# Una reserva dormida no es una fila que medir todavia: meterla daria «sin
# datos» o ceros que se leerian como campo caido cuando lo que pasa es que
# nadie la visito. La señal de campo es el parte rendido (`effective_surveys`
# presente) o efectivas de plataforma ATRIBUIDAS (> 0): las dos dicen que el
# aula entro al operativo. El «> 0» no contradice que el cero sea dato: en el
# tablero real TODAS las filas llevan `respuestas_validas` calculado —0 para
# las dormidas—, asi que la sola presencia de la columna no distingue nada; el
# cero de un TITULAR si se mide, porque el titular entra por rol.
#
# Un rol desconocido o vacio se mide, no se esconde: solo quedan fuera los dos
# roles de respaldo que el plan declara como tales.
.madt_entra <- function(fila) {
  rol <- .monitoreo_scalar(fila[["sample_role"]], "")
  if (!rol %in% c("chain_reserve", "extra_reserve_pool")) return(TRUE)
  if (is.finite(.monitoreo_num(fila[["effective_surveys"]], NA_real_))) return(TRUE)
  plataforma <- .monitoreo_num(fila[["respuestas_validas"]], NA_real_)
  is.finite(plataforma) && plataforma > 0
}

# La señal de un aula. SEÑALA, no descarta: ningun valor de aqui saca a un aula
# de ningun calculo.
#
# Precedencia, espejo de `.maes_senal` (la mitad facultad): dos superficies
# vecinas que contestan la misma pregunta tienen que degradar igual, y alli
# `sin_previsto` gana. Por eso cuando faltan la prevista Y los datos se declara
# `sin_previsto` —decision propia, no pineada por el test—: es el hueco del
# DISEÑO, que el dueño del estudio puede cerrar hoy, mientras que los datos
# pueden llegar solos con el campo; y si llegan con la prevista aun ausente, la
# señal no cambia, que es lo coherente.
#
#   1. sin_previsto — el diseño no publico tasa para esta aula.
#   2. sin_datos    — ni plataforma ni parte: no hay numerador que medir.
#   3. sin_banda    — elegibles < .madt_ELEGIBLES_MINIMOS (o sin denominador):
#                     la cifra se enseña, no se juzga.
#   4. conforme / bajo / sobre — |obs - prev| contra la banda.
.madt_senal <- function(prevista, efectivas, observada, banda) {
  if (!is.finite(prevista)) return("sin_previsto")
  if (!is.finite(efectivas)) return("sin_datos")
  if (!is.finite(banda) || !is.finite(observada)) return("sin_banda")
  if (observada < prevista - banda) return("bajo")
  if (observada > prevista + banda) return("sobre")
  # Dentro del margen no se le pone nombre: conforme y sin direccion.
  "conforme"
}

# El criterio, dicho al lado de las cifras: un solo dueño del idioma.
.madt_criterio <- function() {
  list(
    numerador = paste0(
      "la EFECTIVA de plataforma (`respuestas_validas` de la fila: la ",
      "respuesta que paso los filtros declarados) primero; `effective_surveys` ",
      "del parte de campo como respaldo, y cada aula declara en `numerador` ",
      "cual de los dos uso"
    ),
    denominador = "los elegibles (`eligible_n`) de la propia aula",
    banda = paste0(
      "2*sqrt(p*(1-p)/elegibles) con p = la tasa PREVISTA del diseño ",
      "(`tasa_efectividad_aula`): la banda se arma sobre la referencia con el ",
      "n del aula. Con menos de ", .madt_ELEGIBLES_MINIMOS, " elegibles no se ",
      "arma (`sin_banda`): mediria mas de ±25 puntos y cualquier cifra ",
      "saldria conforme"
    ),
    vara_agregada = paste0(
      "la vara de la facultad viaja al lado en `tasa_facultad`, tal como la ",
      "trae la fila del plan: bajo la propia meta y bajo la de la facultad ",
      "son dos lecturas distintas y las dos viajan"
    ),
    senal = paste0(
      "conforme dentro de la banda y sin direccion; bajo/sobre solo fuera. ",
      "Esto SEÑALA, no descarta: ninguna aula sale del calculo por su tasa"
    )
  )
}

#' Las dos tasas de efectividad por aula: la prevista del diseño y la de su
#' facultad, contra la observada, con banda y señal.
#'
#' @param plan plan normalizado: data.frame o lista de filas.
#' @return lista con `aulas` (una fila por aula medida) y `criterio`.
#' @noRd
monitoreo_aulas_dos_tasas <- function(plan = list()) {
  filas <- .madt_filas(plan)
  aulas <- list()
  for (fila in filas) {
    if (!.madt_entra(fila)) next
    elegibles <- .monitoreo_num(fila[["eligible_n"]], NA_real_)
    if (!is.finite(elegibles) || elegibles < 0) elegibles <- NA_real_
    prevista <- .monitoreo_num(fila[["tasa_efectividad_aula"]], NA_real_)
    tasa_fac <- .monitoreo_num(fila[["tasa_facultad"]], NA_real_)
    num <- .madt_efectivas(fila)
    # NULL estricto donde no se pudo medir, nunca NA ni un cero que se lea
    # como medicion: la ausencia se declara, no se disfraza de dato.
    observada <- if (is.finite(num$valor) && is.finite(elegibles) && elegibles > 0) {
      num$valor / elegibles
    } else NA_real_
    banda <- if (is.finite(prevista) && is.finite(elegibles) &&
                 elegibles >= .madt_ELEGIBLES_MINIMOS) {
      2 * sqrt(prevista * (1 - prevista) / elegibles)
    } else NA_real_
    aulas[[length(aulas) + 1L]] <- list(
      codigo = .monitoreo_scalar(fila[["operational_code"]], ""),
      facultad = .monitoreo_scalar(fila[["faculty"]], ""),
      elegibles = if (is.finite(elegibles)) as.numeric(elegibles) else NULL,
      # Double a proposito: es un conteo, pero viaja en la misma familia de
      # cifras que las tasas y el contrato del payload lo pinnea asi.
      efectivas = if (is.finite(num$valor)) num$valor else NULL,
      numerador = if (is.na(num$origen)) NULL else num$origen,
      tasa_prevista = if (is.finite(prevista)) prevista else NULL,
      tasa_facultad = if (is.finite(tasa_fac)) tasa_fac else NULL,
      tasa_observada = if (is.finite(observada)) observada else NULL,
      banda = if (is.finite(banda)) banda else NULL,
      senal = .madt_senal(prevista, num$valor, observada, banda)
    )
  }
  list(aulas = aulas, criterio = .madt_criterio())
}
