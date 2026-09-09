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
# B1 (rechazo metodologico, 2026-08-31): la prevista es CONDICIONAL a que el
# aula se aplique (`efectivas_esperadas = elegibles x tasa — condicional a
# aplicarse`, calc_muestra_aulas_efectividad.R), asi que solo se CONTRASTA el
# aula con `operational_status` aplicado. La mitad facultad ya condiciona igual
# (`mide <- aplicada & elegibles > 0`); antes esta mitad contrastaba todo y un
# titular «planificada» —que en el tablero real lleva `respuestas_validas = 0`
# calculado— salia como «bajo, 0%»: catalogado por AGENDA, no por rendimiento.
#
# La banda sigue el patron de `tasaDeCaida.ts`: z*sqrt(p*(1-p)/n) armada sobre
# la p de REFERENCIA (la prevista) con el n del aula (sus elegibles), con la z
# de la casa (`.maes_Z`). Dentro del margen NO se le pone nombre —`conforme`,
# sin direccion—; `bajo`/`sobre` solo fuera de banda. Y es un PISO: la formula
# asume independencia intra-aula que aqui no se cumple (ver `.madt_criterio`).
#
# Calculo puro sobre estado ya validado: degrada declarando, nunca lanza. Por
# eso aqui no hay `stop_api()` ni `stop()`.

# Con menos elegibles que esto no se arma banda. No es un numero magico: la
# banda binomial en su caso mas ancho (p = 0.5) mide z*sqrt(0.25/n) =
# z/(2*sqrt(n)), y con n < 16 pasa de ±24,5 puntos —casi la mitad de la escala
# [0,1]—, o sea que CUALQUIER observada saldria «conforme» y la banda dejaria
# de decir nada. En n = 16 queda en ±24,5 pp, el limite de lo legible. La
# cifra observada VIAJA igual con `sin_banda`: se enseña sin juzgarla.
.madt_ELEGIBLES_MINIMOS <- 16

# Los tres baldes del eje `operational_status` (vocabulario de
# `monitoreo_aulas_estados()`, monitoreo_aulas_universitarias.R). Los once
# estados quedan todos con balde:
#
# - CONTRASTADOS: `MONITOREO_AULAS_ESTADOS_APLICADOS` (aplicada/cerrada/
#   parcial, monitoreo_aulas_en_juego.R) — se reusa la constante, no se
#   duplica la lista: es la misma regla con nombre que ya condiciona la mitad
#   facultad.
# - PENDIENTES: los cuatro estados PRE-aplicacion. El aula esta en gestion y
#   su prevista todavia no aplica: se enseña lo que se espera de ella, sin
#   juzgar un rendimiento que aun no existe.
.madt_ESTADOS_PENDIENTES <- c("planificada", "contactada", "agendada", "en_campo")
# - RETIRADOS: estados cuyo desenlace operativo ya NO es aplicarse por esta
#   via. `reemplazada`/`cancelada` son el caso obvio —la reserva rinde por el
#   titular, y dejarlo en «bajo, 0%» duplicaria el asiento del hueco a
#   perpetuidad—. `sin_acceso` y `reemplazo_pendiente` entran por DECISION DEL
#   LEAD (B3, 2026-08-31): tambien en ellos el desenlace ya no es aplicarse
#   por esta via —al aula no se pudo entrar, o su reemplazo esta en camino— y
#   el estado LITERAL viaja en `estado_operativo`, que es lo que distingue los
#   cuatro casos en la vista.
.madt_ESTADOS_RETIRADOS <- c("reemplazada", "cancelada", "sin_acceso", "reemplazo_pendiente")

# El balde de un estado. El vacio —y el «-» de relleno del Excel— cae en
# `pendiente`: un titular sin gestion todavia no rindio nada que juzgar. Un
# literal fuera del vocabulario tambien: no declara aplicacion, asi que no
# autoriza contraste, y el literal viaja en `estado_operativo` para que la
# vista lo enseñe en vez de que esto lo juzgue a ciegas.
.madt_balde <- function(estado) {
  est <- tolower(trimws(estado))
  if (est %in% MONITOREO_AULAS_ESTADOS_APLICADOS) return("contrastada")
  if (est %in% .madt_ESTADOS_RETIRADOS) return("retirada")
  "pendiente"
}

# **Aplicada DE HECHO, aunque el plan no lo diga.**
#
# `operational_status` es un campo que el plan trae y que NADIE ACTUALIZA
# conforme avanza el campo: medido sobre HSVG26ULT2 el 2026-09-08, las 174 filas
# M1 lo tenian en «planificada», el default del row-builder. Con la
# clasificacion colgando solo de ese campo, `dos_tasas` mandaba las 174 al balde
# `pendiente` y el panel «Cada curso-horario contra su propio margen» publicaba
# «Ningun curso-horario tiene todavia margen que contrastar» en la MISMA
# pantalla en que la banda de KPIs decia «26 cursos-horario aplicados». Nunca
# habria contrastado nada.
#
# El resto del perfil no pregunta por ese campo: DERIVA la aplicacion de la
# evidencia. `course_status` marca «en_aplicacion» con `responses_total > 0` y
# «cerrando» cuando las validas alcanzan la meta, sin mirar el estado escrito
# —de ahi salen los 26—. Aqui se hace lo mismo con lo que esta funcion ya tiene
# en la fila: efectivas de plataforma primero, parte de campo como respaldo, que
# son las dos mismas fuentes de `.madt_efectivas()`.
#
# LIMITE CONOCIDO: un aula aplicada con CERO efectivas se queda en `pendiente`,
# porque sin estado escrito no hay forma de distinguirla de una que aun no se
# visito. El comentario del cero de arriba sigue valiendo para la que SI declara
# su estado; para el resto, la evidencia es lo unico que hay.
.madt_aplicada_de_hecho <- function(fila) {
  val <- .monitoreo_num(fila[["respuestas_validas"]], NA_real_)
  if (is.finite(val) && val > 0) return(TRUE)
  parte <- .monitoreo_num(fila[["effective_surveys"]], NA_real_)
  is.finite(parte) && parte > 0
}

# B13b: el RECHAZO tecleado vive en el OTRO eje —`sample_status`, el del
# agendamiento— y tambien retira: un docente que dijo que no ya no va a
# aplicarse por esta via, y dejarlo `pendiente` era pedirle gestion a
# perpetuidad. Se pregunta al normalizador real (acepta «RECHAZO» del libro y
# `rechazo` del plan por igual), no a una copia de su lista. Solo degrada el
# balde `pendiente`: un aula con `operational_status` aplicado YA se midio, y
# ante la contradiccion entre los dos ejes manda la medicion que existe.
.madt_rechazada <- function(fila) {
  identical(monitoreo_aulas_estado_muestra(fila[["sample_status"]]), "rechazo")
}

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
# El cero es un DATO solo en el aula APLICADA: `respuestas_validas = 0` con
# estado aplicado es una medicion —nadie paso los filtros—, no un hueco, asi
# que 0 de plataforma NO cae al parte. En el resto de estados ese 0 es el
# relleno que el tablero calcula en todas las filas, y esas filas ni llegan
# aqui: se van por su balde antes de medir (B1, punto 5 del contrato).
.madt_efectivas <- function(fila) {
  plataforma <- .monitoreo_num(fila[["respuestas_validas"]], NA_real_)
  if (is.finite(plataforma)) return(list(valor = as.numeric(plataforma), origen = "plataforma"))
  parte <- .monitoreo_num(fila[["effective_surveys"]], NA_real_)
  if (is.finite(parte)) return(list(valor = as.numeric(parte), origen = "parte"))
  list(valor = NA_real_, origen = NA_character_)
}

# Quien entra a la medicion: los TITULARES y quien tenga señal de campo o de
# GESTION.
#
# Una reserva dormida no es una fila que medir todavia: meterla daria «sin
# datos» o ceros que se leerian como campo caido cuando lo que pasa es que
# nadie la visito. Entra la reserva con parte rendido (`effective_surveys`
# presente), con efectivas de plataforma ATRIBUIDAS (> 0), o —B1b, DECISION
# DEL LEAD (2026-08-31)— con `operational_status` escrito: una reserva
# «contactada» o «aplicada» ya esta en el operativo aunque no rinda aun, y con
# la entrada solo por numeros la reserva aplicada con 0 efectivas era INVISIBLE
# mientras la τ̂ de facultad si la contaba. El «-» no cuenta como estado: es el
# relleno con que el equipo escribe «todavia nada aqui».
#
# OJO: aqui NO se usa `MONITOREO_AULAS_ESTADOS_DORMIDOS` — ese es vocabulario
# de `sample_status` (el eje del AGENDAMIENTO), no de `operational_status`, y
# contiene «planificada» — pero «planificada» TAMPOCO abre la puerta: el
# normalizador escribe ese default en toda fila sin gestion (row-builder y
# .monitoreo_aulas_status de monitoreo_aulas_universitarias convierten "",
# "-" y lo desconocido en «planificada»), asi que post-normalizador equivale
# a «nadie escribio nada» y con ella el banco dormido entero se colaba como
# «pendiente». Costo asumido y declarado: una reserva marcada planificada a
# proposito es indistinguible del default y asoma recien con su primer
# estado real (contactada en adelante) o con datos.
#
# El «> 0» de plataforma no contradice que el cero sea dato: en el tablero
# real TODAS las filas llevan `respuestas_validas` calculado —0 para las
# dormidas—, asi que la sola presencia de la columna no distingue nada; el
# cero de un aula APLICADA si se mide, porque esa entra por su estado.
#
# Un rol desconocido o vacio se mide, no se esconde: solo quedan fuera los dos
# roles de respaldo que el plan declara como tales.
.madt_entra <- function(fila) {
  rol <- .monitoreo_scalar(fila[["sample_role"]], "")
  if (!rol %in% c("chain_reserve", "extra_reserve_pool")) return(TRUE)
  if (is.finite(.monitoreo_num(fila[["effective_surveys"]], NA_real_))) return(TRUE)
  plataforma <- .monitoreo_num(fila[["respuestas_validas"]], NA_real_)
  if (is.finite(plataforma) && plataforma > 0) return(TRUE)
  est <- trimws(.monitoreo_scalar(fila[["operational_status"]], ""))
  nzchar(est) && !est %in% c("-", "planificada")
}

# La señal de un aula APLICADA. SEÑALA, no descarta: ningun valor de aqui saca
# a un aula de ningun calculo. Las no aplicadas no llegan aqui: su señal es su
# balde (`pendiente`/`retirada`).
#
# Precedencia:
#
#   1. descuadre    — efectivas > elegibles (N2): ALGUN numero esta mal
#                     (atribucion, aforo o plataforma). Va primero —antes que
#                     sin_previsto— porque cualquier tasa armada con esos
#                     numeros es basura y ninguna otra señal puede taparlo.
#   2. sin_previsto — el diseño no publico tasa para esta aula. Gana sobre
#                     sin_datos, espejo de `.maes_senal` (la mitad facultad):
#                     es el hueco del DISEÑO, que el dueño puede cerrar hoy,
#                     mientras que los datos pueden llegar solos con el campo.
#   3. sin_datos    — ni plataforma ni parte: no hay numerador que medir.
#   4. sin_banda    — elegibles < .madt_ELEGIBLES_MINIMOS, sin denominador o
#                     prevista fuera de [0,1]: la cifra se enseña, no se juzga.
#   5. conforme / bajo / sobre — |obs - prev| contra la banda.
.madt_senal <- function(prevista, efectivas, elegibles, observada, banda) {
  if (is.finite(efectivas) && is.finite(elegibles) && elegibles > 0 &&
      efectivas > elegibles) return("descuadre")
  if (!is.finite(prevista)) return("sin_previsto")
  if (!is.finite(efectivas)) return("sin_datos")
  if (!is.finite(banda) || !is.finite(observada)) return("sin_banda")
  if (observada < prevista - banda) return("bajo")
  if (observada > prevista + banda) return("sobre")
  # Dentro del margen no se le pone nombre: conforme y sin direccion.
  "conforme"
}

# El criterio, dicho al lado de las cifras: un solo dueño del idioma. La UI lo
# consume tal cual (M4), por eso cada regla —incluida la clasificacion por
# estado— se dice aqui y no se reconstruye en la vista.
.madt_criterio <- function() {
  list(
    numerador = paste0(
      "la EFECTIVA de plataforma (`respuestas_validas` de la fila: la ",
      "respuesta que paso los filtros declarados) primero; `effective_surveys` ",
      "del parte de campo como respaldo, y cada aula declara en `numerador` ",
      "cual de los dos uso"
    ),
    denominador = "los elegibles (`eligible_n`) de la propia aula",
    estados = paste0(
      "se contrasta el aula APLICADA: la que declara su estado ",
      "(aplicada/cerrada/parcial) y tambien la que trae evidencia de campo ",
      "—efectivas de plataforma o del parte— aunque el plan siga diciendo ",
      "«planificada», que es lo que dice mientras nadie lo actualice. La ",
      "prevista del diseño es condicional a aplicarse. ",
      "planificada/contactada/agendada/en_campo —o sin estado— viajan como ",
      "`pendiente`, con su prevista y sus elegibles a la vista; ",
      "reemplazada/cancelada/sin_acceso/reemplazo_pendiente como `retirada` ",
      "—su desenlace ya no es aplicarse por esta via—, y el estado literal ",
      "viaja en `estado_operativo`. El RECHAZO tecleado en STATUS MUESTRA ",
      "(el eje del agendamiento) tambien retira lo pendiente: el docente dijo ",
      "que no y esa aula ya no va a aplicarse por esta via"
    ),
    banda = paste0(
      "1.959964*sqrt(p*(1-p)/elegibles) —la z de la casa, la misma de la ",
      "mitad facultad— con p = la tasa PREVISTA del diseño ",
      "(`tasa_efectividad_aula`): la banda se arma sobre la referencia con el ",
      "n del aula. Es un PISO: la formula asume independencia entre los ",
      "elegibles del aula, que no se cumple —comparten profesor, hora y ",
      "sala— y el deff medido de la casa (HSVG 2025: 1,29-1,55) la ",
      "ensancharia x1,14-1,25. Con menos de ", .madt_ELEGIBLES_MINIMOS,
      " elegibles no se arma (`sin_banda`): mediria mas de ±24 puntos y ",
      "cualquier cifra saldria conforme"
    ),
    vara_agregada = paste0(
      "la vara de la facultad viaja al lado en `tasa_facultad`, tal como la ",
      "trae la fila del plan: bajo la propia meta y bajo la de la facultad ",
      "son dos lecturas distintas y las dos viajan"
    ),
    senal = paste0(
      "conforme dentro de la banda y sin direccion; bajo/sobre solo fuera; ",
      "descuadre cuando hay mas efectivas que elegibles —inconsistencia de ",
      "numeros, no un logro—. Esto SEÑALA, no descarta: ninguna aula sale ",
      "del calculo por su tasa"
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
    estado <- .monitoreo_scalar(fila[["operational_status"]], "")
    balde <- .madt_balde(estado)
    # B13b: RECHAZO en el eje del agendamiento retira lo que aun estaba
    # `pendiente` — sin gestion operativa escrita, o con el default
    # «planificada» del row-builder, que son las dos formas reales del tablero.
    if (identical(balde, "pendiente") && .madt_rechazada(fila)) balde <- "retirada"
    # El rechazo se pregunta ANTES a proposito (B13b, decision explicita): un
    # docente que dijo que no ya no se aplica por esta via. Lo que quede
    # `pendiente` con evidencia de campo si se contrasta.
    if (identical(balde, "pendiente") && .madt_aplicada_de_hecho(fila)) balde <- "contrastada"
    # El literal viaja tal como se escribio; el vacio y el «-» de relleno no
    # son un estado que enseñar.
    estado_lit <- trimws(estado)
    base <- list(
      codigo = .monitoreo_scalar(fila[["operational_code"]], ""),
      facultad = .monitoreo_scalar(fila[["faculty"]], ""),
      estado_operativo = if (nzchar(estado_lit) && !identical(estado_lit, "-")) estado else NULL,
      elegibles = if (is.finite(elegibles)) as.numeric(elegibles) else NULL,
      tasa_prevista = if (is.finite(prevista)) prevista else NULL,
      tasa_facultad = if (is.finite(tasa_fac)) tasa_fac else NULL
    )
    if (!identical(balde, "contrastada")) {
      # Fila pendiente/retirada: viajan `senal`, `estado_operativo`,
      # `tasa_prevista` y `elegibles` (los cuatro pineados por el contrato),
      # mas la identidad y la vara de facultad. NO viajan
      # efectivas/numerador/tasa_observada/banda: son los campos del CONTRASTE
      # y emitirlos aqui —donde el 0 es relleno de agenda, no medicion—
      # invitaria a la vista a leer un juicio donde no lo hay.
      base$senal <- balde
      aulas[[length(aulas) + 1L]] <- base
      next
    }
    num <- .madt_efectivas(fila)
    # NULL estricto donde no se pudo medir, nunca NA ni un cero que se lea
    # como medicion: la ausencia se declara, no se disfraza de dato.
    observada <- if (is.finite(num$valor) && is.finite(elegibles) && elegibles > 0) {
      num$valor / elegibles
    } else NA_real_
    # `.maes_Z` (efectividad_seguimiento): dos superficies vecinas, una sola
    # z. La guarda `[0,1]` es N2: con la prevista fuera de rango, p*(1-p) < 0
    # y el sqrt gritaria un warning al log del tablero; no se evalua y la
    # señal degrada a `sin_banda` en silencio.
    banda <- if (is.finite(prevista) && prevista >= 0 && prevista <= 1 &&
                 is.finite(elegibles) && elegibles >= .madt_ELEGIBLES_MINIMOS) {
      .maes_Z * sqrt(prevista * (1 - prevista) / elegibles)
    } else NA_real_
    base$efectivas <- if (is.finite(num$valor)) num$valor else NULL
    # Double a proposito: es un conteo, pero viaja en la misma familia de
    # cifras que las tasas y el contrato del payload lo pinnea asi.
    base$numerador <- if (is.na(num$origen)) NULL else num$origen
    base$tasa_observada <- if (is.finite(observada)) observada else NULL
    base$banda <- if (is.finite(banda)) banda else NULL
    base$senal <- .madt_senal(prevista, num$valor, elegibles, observada, banda)
    aulas[[length(aulas) + 1L]] <- base
  }
  list(aulas = aulas, criterio = .madt_criterio())
}
