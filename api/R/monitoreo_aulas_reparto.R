# monitoreo_aulas_reparto.R — el reparto equitativo de aplicadores desde su
# disponibilidad (B29, docs/qa/checklist-operativo-aulas-2026-08-31.md).
#
# Dictado de Gonzalo (2026-09-02): «ahora tenemos la disponibilidad de los
# aplicadores y sería bueno poder ir mapeando una distribución equitativa en
# base a lo agendado que se tiene hasta ahora, pero que pueda ir
# actualizándose con el paso de los días».
#
# Contrato en test-monitoreo-aulas-reparto.R. Dos piezas:
#
# - `monitoreo_aulas_reparto(plan, disponibilidad)`: la ventana de cada CH se
#   DERIVA de `monitoreo_aulas_ventanas()` (B11) — hereda el parser AM/PM, los
#   veinte minutos y el balde de retiradas/rechazos; una cancelada no pide
#   aplicador. Candidato = el bloque disponible del día CUBRE la ventana
#   entera. Greedy determinista por fecha+hora ascendente con carga mínima
#   acumulada; empate por alfabeto; entre dos CH con idéntica fecha+hora manda
#   el CÓDIGO (decisión del lead, estable). Un aplicador no está en dos aulas
#   cuyas ventanas se solapan; la adyacencia no es solape (convención B11).
#   Fecha sin hora → `por_confirmar`; cita pactada sin candidato libre →
#   `no_cubiertos` declarado. `equidad` lista a TODOS los aplicadores de la
#   disponibilidad en orden alfabético, ceros incluidos.
# - `monitoreo_aulas_disponibilidad_bloque(disponibilidad)`: la oferta para la
#   vista «Disponibilidad de aplicadores» — por día de SEMANA (lunes→domingo,
#   solo días con cobertura), malla de 30 minutos dentro del rango cubierto,
#   cada franja con `{inicio, fin, disponibles, nombres}` y nombres en orden
#   alfabético estable.
#
# «Que pueda ir actualizándose con el paso de los días» se pinea como PUREZA:
# recomputar con el plan nuevo produce el reparto del estado nuevo, sin
# memoria entre corridas. Determinismo del dictado («repetible»): ni reloj ni
# azar en este archivo — hay grep-pins que lo vigilan. Cálculo puro sobre
# estado ya validado: degrada declarando, nunca lanza.

# El día de semana pineado del lector (minúscula, sin tilde), desde el token
# sin locale de B11 (`.mav_dia_token` sobre la fecha ISO).
.marep_DIA_CLAVE <- c(
  DOM = "domingo", LUN = "lunes", MAR = "martes", MIE = "miercoles",
  JUE = "jueves", VIE = "viernes", SAB = "sabado"
)

# El orden de semana para el bloque de disponibilidad: lunes→domingo. El orden
# alfabético diría «jueves» antes que «lunes»; la semana no.
.marep_SEMANA <- c("lunes", "martes", "miercoles", "jueves", "viernes",
                   "sabado", "domingo")

# «HH:MM» a minutos, con el parser de B11 (acepta también AM/PM, aunque aquí
# todo llega ya canónico de ventanas o del lector).
.marep_min <- function(x) .mav_hora_una(as.character(x %||% "")[1])

# Los bloques {inicio, fin} de un aplicador para un día, en minutos. Lo que no
# parsea se descarta sin inventarle lectura.
.marep_bloques_min <- function(bloques) {
  out <- list()
  for (b in (bloques %||% list())) {
    if (!is.list(b)) next
    ini <- .marep_min(b[["inicio"]])
    fin <- .marep_min(b[["fin"]])
    if (is.na(ini) || is.na(fin) || fin <= ini) next
    out[[length(out) + 1L]] <- c(ini, fin)
  }
  out
}

# La disponibilidad normalizada: lista nombrada nombre → (dia → bloques en
# minutos). Nombres vacíos se saltan; un nombre repetido conserva la primera
# declaración (determinista).
# **El comodín del operativo: cuando no hay aplicador y lo hace alguien de Pulso.**
#
# Dictado 2026-09-04: «el selector de aplicadores manual debería permitirte
# escoger una nueva opción llamada "INTERNO PULSO", que es cuando no hay
# aplicadores disponibles y lo termina haciendo alguien de Pulso».
#
# Es una fijación como cualquier otra —viaja en `reparto_fijado`— pero NO es una
# persona con horario: no está en el libro de disponibilidad y nunca lo estará.
# Por eso se le calla la advertencia «fuera de su disponibilidad declarada», que
# en su caso no avisa de nada: decir que el comodín no tiene horario es decir lo
# que ya se sabe, y un aviso que siempre salta deja de leerse. El solape SÍ se
# le avisa: dos citas a la misma hora no las cubre nadie, ni Pulso.
MONITOREO_AULAS_INTERNO_PULSO <- "INTERNO PULSO"

#' Cuántas aplicaciones caben en un viaje al campus.
#'
#' Dictado de Gonzalo (2026-09-04): «que todos tengan asignaciones el mismo día
#' y no vengan en días diferentes, o aunque sea por lo menos vengan por dos
#' aplicaciones». Con la agenda de HSVG 2026 —86 citas pactadas y 24
#' aplicadores en la lista final— el promedio por persona es 3,6: si cada
#' quien LLENA un viaje de hasta cuatro, el equipo entero cabe en un día cada
#' uno; si se reparte de a una, salen cincuenta viajes.
#'
#' Cuatro y no más porque una aplicación ocupa media hora de recojo más la
#' aplicación: cuatro ya son una jornada entera con sus traslados.
#'
#' Es un tope BLANDO: quien llegó a cuatro deja de ser el preferido, pero si es
#' el único que cubre una cita se la lleva —antes que dejarla sin aplicador.
#' @keywords internal
MONITOREO_AULAS_MAX_POR_VIAJE <- 4L

.marep_oferta <- function(disponibilidad) {
  oferta <- list()
  for (a in (disponibilidad %||% list())) {
    if (!is.list(a)) next
    nombre <- trimws(as.character(a[["nombre"]] %||% "")[1])
    if (is.na(nombre) || !nzchar(nombre) || !is.null(oferta[[nombre]])) next
    dias <- a[["dias"]]
    dias <- if (is.list(dias)) dias else list()
    por_dia <- list()
    for (d in (names(dias) %||% character(0))) {
      bloques <- .marep_bloques_min(dias[[d]])
      if (length(bloques)) por_dia[[d]] <- bloques
    }
    oferta[[nombre]] <- por_dia
  }
  oferta
}

# ¿Algún bloque del día cubre la ventana ENTERA? Cubrir a medias no es cubrir.
.marep_cubre <- function(bloques, ini, fin) {
  for (b in (bloques %||% list())) {
    if (b[[1L]] <= ini && b[[2L]] >= fin) return(TRUE)
  }
  FALSE
}

# ¿La ventana [ini, fin) se solapa con alguna ya asignada? La adyacencia (una
# termina cuando la otra empieza) NO es solape — convención de franjas B11: a
# esa hora el aplicador sale de un salón y entra al otro.
.marep_solapa <- function(ocupadas, ini, fin) {
  for (o in (ocupadas %||% list())) {
    if (ini < o[[2L]] && o[[1L]] < fin) return(TRUE)
  }
  FALSE
}

#' Reparto equitativo de aplicadores sobre las citas pactadas del plan.
#'
#' Deriva las ventanas de `monitoreo_aulas_ventanas()` (B11): cada cita
#' pactada pide un aplicador cuyo bloque disponible del día cubra la ventana
#' entera. Greedy determinista por fecha+hora (y código en empate): cada CH
#' toma el candidato con menos asignaciones acumuladas, alfabeto como
#' desempate; nadie queda en dos aulas cuyas ventanas se solapan. Recomputar
#' con el plan del día siguiente produce el reparto del estado nuevo — sin
#' memoria entre corridas.
#'
#' B36 (dictado 2026-09-02: «mecanismo propio de asignación y reasignación,
#' que sea equitativo»): `fijadas` es la voluntad explícita del usuario —
#' código → aplicador. La fijada MANDA: se aplica siempre, primero, marca
#' `fijada = TRUE`, y lo que la oferta no respalda no la frena sino que viaja
#' declarado en `advertencia` («sin_disponibilidad», «se_solapa»). El greedy
#' reparte el resto contándola en la carga y sin pisarle la ventana. Una
#' fijación cuyo código no tiene cita pactada se devuelve en
#' `fijadas_sin_cita`, no se traga.
#'
#' B70/B71 (dictado 2026-09-03): la aplicación dura `duracion_min` (config;
#' default 30) y el aplicador está OCUPADO desde media hora antes — recoge
#' materiales a T−30 y sale hacia el aula a T−15. Cobertura y solapes se
#' juzgan sobre la ocupación `[hora − 30, hora + duración]`, no sobre la
#' aplicación sola («para que los cruces sean más honestos y verídicos»);
#' cada asignación publica `recojo` y `salida` para el aviso del día.
#'
#' @param plan plan normalizado: lista de filas o data.frame (mismo formato
#'   que `monitoreo_aulas_dos_tasas` y `monitoreo_aulas_ventanas`).
#' @param disponibilidad salida de `carga_disponibilidad_aplicadores()`.
#' @param fijadas lista nombrada código → aplicador (B36); vacía por defecto.
#' @param duracion_min minutos de la aplicación (B70); default 30.
#' @param semilla B67 (dictado 2026-09-03: «no tengo una forma de hacer un
#'   resorteo»): entero >= 0 que ROTA el orden de desempate del greedy. El
#'   reparto sigue determinista —misma semilla, mismo reparto— y la equidad
#'   no cambia (misma carga mínima acumulada); solo cambia QUIÉN gana los
#'   empates. Las fijadas mandan igual. 0 = el alfabético de siempre.
#' @param rango B75 (dictado 2026-09-03: «distribuir equitativamente entre de
#'   este día a este día»): lista `{desde, hasta}` en ISO. Solo se reparten
#'   las citas cuyo día cae dentro; lo de fuera NO se descarta en silencio —
#'   viaja declarado en `fuera_de_rango` y espera su tanda. `NULL` o ilegible
#'   = todo el horizonte.
#' @return lista con `dias` (por fecha ISO ascendente: `{fecha, asignaciones,
#'   no_cubiertos, por_confirmar}`; cada asignación con `recojo`, `salida`,
#'   `fijada` y, si aplica, `advertencia`), `equidad` (`{aplicador,
#'   asignadas}` en orden alfabético — la oferta entera más los fijados
#'   externos, cero incluido), `fijadas_sin_cita` (códigos fijados sin cita
#'   pactada), `fuera_de_rango` (`{fecha, codigos, por_confirmar}` por fecha
#'   excluida; ausente sin rango), el eco `rango` saneado cuando rige, y los
#'   ecos `duracion_min` / `preparacion_min` / `salida_min`.
#' @keywords internal
monitoreo_aulas_reparto <- function(plan = list(), disponibilidad = list(),
                                    fijadas = list(),
                                    duracion_min = .mav_DURACION_MIN,
                                    rango = NULL,
                                    semilla = 0L,
                                    concentrado = FALSE) {
  # Dictado de Gonzalo (2026-09-04): «si un aplicador viene hasta la
  # universidad, que haga por lo menos más de un curso-horario: sus asignados
  # concentrados en un día o dos como máximo, tomando en cuenta que la
  # asignación debe ser equitativa… maximizar su día, contando la preparación
  # de media hora previa». `concentrado = TRUE` (su elección: «sí quiero que
  # se active») antepone al candidato que YA está ese día — el que más
  # aplicaciones acumula en la fecha primero, para llenar su jornada — y solo
  # entre iguales decide la menor carga total y el desempate de siempre. Es
  # PREFERENCIA, no tope duro: cuando la física del día (solapes sobre la
  # ocupación recojo→fin) ya no deja apilar, el reparto abre a la siguiente
  # persona con menos carga. El default del MOTOR es FALSE (función pura,
  # compatible con su historia); el default OPERATIVO — TRUE, por su
  # dictado — vive en la whitelist del config, que es donde se decide.
  concentrado <- isTRUE(concentrado)
  semilla <- suppressWarnings(as.integer(semilla %||% 0L)[1])
  if (is.na(semilla) || semilla < 0L) semilla <- 0L
  # B75: el rango saneado — ambas puntas en ISO o no hay rango. Un desde >
  # hasta se corrige por intercambio (deliberado: la intención del usuario es
  # el intervalo, no el orden en que tecleó las puntas).
  rango_vigente <- NULL
  if (is.list(rango)) {
    d1 <- trimws(as.character(rango[["desde"]] %||% "")[1])
    d2 <- trimws(as.character(rango[["hasta"]] %||% "")[1])
    if (grepl("^\\d{4}-\\d{2}-\\d{2}$", d1) && grepl("^\\d{4}-\\d{2}-\\d{2}$", d2)) {
      rango_vigente <- if (d1 <= d2) c(d1, d2) else c(d2, d1)
    }
  }
  base <- monitoreo_aulas_ventanas(plan, duracion_min = duracion_min)
  aulas <- base[["aulas"]] %||% list()
  oferta <- .marep_oferta(disponibilidad)
  nombres <- sort(names(oferta) %||% character(0), method = "radix")
  # B67: el orden de PRIORIDAD del desempate. Con semilla 0 es el alfabeto de
  # siempre; una semilla s lo rota s posiciones — otro sorteo, mismas reglas.
  prioridad <- if (length(nombres) && semilla %% length(nombres) > 0L) {
    s_rot <- semilla %% length(nombres)
    c(nombres[(s_rot + 1L):length(nombres)], nombres[1L:s_rot])
  } else nombres

  # Las fijaciones saneadas: código y aplicador no vacíos; lo demás se ignora
  # aquí porque el normalizador del config ya avisó (frontera, no motor).
  fij <- list()
  for (nm in (names(fijadas %||% list()) %||% character(0))) {
    v <- trimws(as.character(fijadas[[nm]] %||% "")[1])
    cod <- trimws(nm)
    if (nzchar(cod) && !is.na(v) && nzchar(v)) fij[[cod]] <- v
  }

  # Las citas pactadas (ventana confirmada con fecha) y las pendientes del
  # día (todo lo demás CON fecha: tentativas y sin_ventana — el vocabulario
  # de B11 heredado por franjas: una cita sin pactar no pide gente todavía).
  citas <- list()
  pendientes <- list()
  # Las pactadas cuya ventana NO se puede leer. Existían y desaparecían: el
  # `next` de abajo era mudo y la cita no salía por ningún lado —ni asignada,
  # ni sin cubrir, ni por confirmar, ni fuera de rango—. Se destapó con CCSS
  # Perfil 2026-II: CH 50 estaba agendada a las «11:45 pm» (un tipeo por am en
  # el Sheets), el motor le sumó la duración y escribió `fin = "24:15"`, que su
  # propio parser rechaza. 19 citas en la semana, 18 declaradas, y el hueco no
  # avisaba de nada. Una cita que no se puede repartir se DECLARA sin cubrir:
  # la vista ya sabe decir la causa —`salidasDeDescubiertos` la clasifica
  # `sin-hora` cuando no encuentra ventana legible— y así el coordinador ve la
  # fila, va al Sheets y corrige la hora.
  ilegibles <- list() # fecha -> códigos
  for (aula in aulas) {
    fecha <- as.character(aula[["fecha"]] %||% "")
    if (!nzchar(fecha)) next
    if (identical(as.character(aula[["ventana"]] %||% ""), "confirmada")) {
      ini <- .marep_min(aula[["inicio"]])
      fin <- .marep_min(aula[["fin"]])
      if (is.na(ini) || is.na(fin)) {
        ilegibles[[fecha]] <- c(ilegibles[[fecha]],
                                as.character(aula[["codigo"]] %||% ""))
        next
      }
      citas[[length(citas) + 1L]] <- list(
        codigo = as.character(aula[["codigo"]] %||% ""),
        fecha = fecha, ini = ini, fin = fin,
        # B71: la ocupación real arranca en el recojo de materiales (T−30) —
        # cobertura y solape se juzgan sobre ella. El día no cruza hacia
        # atrás de medianoche: se recorta a 0.
        ini_ocupado = max(0, ini - .mav_PREPARACION_MIN),
        inicio = as.character(aula[["inicio"]] %||% ""),
        fin_hhmm = as.character(aula[["fin"]] %||% "")
      )
    } else {
      pendientes[[fecha]] <- c(pendientes[[fecha]],
                               as.character(aula[["codigo"]] %||% ""))
    }
  }

  # B75: la partición por rango. Los códigos pactados se censan ANTES de
  # partir —una fijación cuya cita quedó fuera del rango NO es huérfana: su
  # cita existe, solo espera otra tanda—. Lo excluido viaja declarado.
  codigos_pactados_total <- c(
    vapply(citas, function(x) x$codigo, character(1)) %||% character(0),
    # La ilegible también tiene cita: fijarla no la vuelve huérfana.
    unlist(ilegibles, use.names = FALSE) %||% character(0)
  )
  fuera <- list() # fecha -> list(codigos, por_confirmar)
  if (!is.null(rango_vigente)) {
    dentro <- list()
    for (cita in citas) {
      if (cita$fecha >= rango_vigente[[1]] && cita$fecha <= rango_vigente[[2]]) {
        dentro[[length(dentro) + 1L]] <- cita
      } else {
        f <- fuera[[cita$fecha]] %||% list(codigos = character(0), por_confirmar = character(0))
        f$codigos <- c(f$codigos, cita$codigo)
        fuera[[cita$fecha]] <- f
      }
    }
    citas <- dentro
    for (fecha in names(pendientes)) {
      if (fecha >= rango_vigente[[1]] && fecha <= rango_vigente[[2]]) next
      f <- fuera[[fecha]] %||% list(codigos = character(0), por_confirmar = character(0))
      f$por_confirmar <- c(f$por_confirmar, pendientes[[fecha]])
      fuera[[fecha]] <- f
      pendientes[[fecha]] <- NULL
    }
    # La ilegible parte por el mismo corte: tiene fecha, así que fuera del
    # rango espera su tanda en `codigos` —es una cita pactada— y no se
    # arrastra al día que se está repartiendo.
    for (fecha in names(ilegibles)) {
      if (fecha >= rango_vigente[[1]] && fecha <= rango_vigente[[2]]) next
      f <- fuera[[fecha]] %||% list(codigos = character(0), por_confirmar = character(0))
      f$codigos <- c(f$codigos, ilegibles[[fecha]])
      fuera[[fecha]] <- f
      ilegibles[[fecha]] <- NULL
    }
  }

  # Greedy por fecha+hora ascendente; entre dos CH con idéntica fecha+hora
  # manda el código (decisión del lead: estable, sin depender del orden de
  # entrada del plan).
  if (length(citas)) {
    orden <- order(
      vapply(citas, function(x) x$fecha, character(1)),
      vapply(citas, function(x) x$ini, numeric(1)),
      vapply(citas, function(x) x$codigo, character(1)),
      method = "radix"
    )
    citas <- citas[orden]
  }

  carga <- stats::setNames(rep(0L, length(nombres)), nombres)
  ocupadas <- list() # "nombre\rfecha" -> lista de c(ini, fin) asignadas
  # Cuántos DÍAS distintos lleva ya cada quien: la clave que evita darle un
  # segundo viaje a alguien teniendo al lado a otro que no ha salido nunca.
  dias_por <- list()
  asignaciones <- list()
  # El minuto de inicio de cada asignación, paralelo por fecha: las fijadas
  # entran ANTES que las automáticas y el día se reordena por hora al final —
  # el contrato del payload («greedy por hora ascendente») no cambia.
  orden_dia <- list()
  # Sembrado con las de ventana ilegible: nacen sin cubrir porque no hay hora
  # contra la que buscar a nadie.
  no_cubiertos <- ilegibles

  anotar_asignacion <- function(cita, elegido, fijada, advertencia = "") {
    clave_dia <- paste(elegido, cita$fecha, sep = "\r")
    # B71: lo que se ocupa es la hora completa (recojo→fin), no la aplicación.
    ocupadas[[clave_dia]] <<- c(ocupadas[[clave_dia]],
                                list(c(cita$ini_ocupado, cita$fin)))
    item <- list(
      codigo = cita$codigo,
      aplicador = elegido,
      inicio = cita$inicio,
      fin = cita$fin_hhmm,
      # B71: las horas del protocolo, dichas por el motor — el frontend no
      # re-parsea horas (contrato horaDelMotor).
      recojo = .mav_hhmm(cita$ini_ocupado),
      salida = .mav_hhmm(max(0, cita$ini - .mav_SALIDA_MIN)),
      fijada = fijada
    )
    if (nzchar(advertencia)) item[["advertencia"]] <- advertencia
    asignaciones[[cita$fecha]] <<- c(asignaciones[[cita$fecha]], list(item))
    orden_dia[[cita$fecha]] <<- c(orden_dia[[cita$fecha]], cita$ini)
  }

  # PRIMERA pasada — las fijadas (B36): la voluntad del usuario se aplica
  # siempre; lo que la oferta no respalda viaja declarado, no la frena.
  # El censo total (B75): incluye las citas fuera del rango, para que la
  # fijación de una cita aplazada no caiga a `fijadas_sin_cita`.
  codigos_pactados <- codigos_pactados_total
  for (cita in citas) {
    elegido <- fij[[cita$codigo]]
    if (is.null(elegido)) next
    dia_token <- .mav_dia_token(cita$fecha)
    dia_clave <- if (nzchar(dia_token)) .marep_DIA_CLAVE[[dia_token]] else ""
    cubre <- nzchar(dia_clave) &&
      .marep_cubre(oferta[[elegido]][[dia_clave]], cita$ini_ocupado, cita$fin)
    solapa <- .marep_solapa(ocupadas[[paste(elegido, cita$fecha, sep = "\r")]],
                            cita$ini_ocupado, cita$fin)
    # **A una cita FIJADA no se le avisa de la disponibilidad.**
    #
    # Gonzalo, 2026-09-11, sobre Jesús Ramiro con siete aulas marcadas «fuera de
    # su disponibilidad declarada»: «lo de Jesús es que finalmente pudo y se
    # presentó a oficina a querer aplicar; son cosas que son parte de la
    # impredictibilidad del campo».
    #
    # Y ahí está: una fijada la puso una PERSONA, muchas veces justamente porque
    # el horario declarado se quedó viejo. Avisar de que no lo cubre no informa
    # de nada y, peor, marca como anomalía a quien se sumó. Es el mismo motivo
    # por el que el comodín ya la tenía callada: un aviso que salta donde no hay
    # problema deja de leerse, y entonces tampoco se lee donde sí lo hay.
    #
    # El SOLAPE sigue avisándose: dos citas a la misma hora no las cubre nadie,
    # las haya decidido quien las haya decidido. Y en la segunda pasada —la que
    # reparte el SORTEO— la advertencia se mantiene entera: ahí sí es un error
    # de la app mandar a alguien fuera de lo que dijo poder.
    advertencia <- if (solapa) "se_solapa" else ""
    # Un fijado externo a la oferta entra a la equidad al verse: sin él la
    # suma de asignaciones no cuadraría con el resumen.
    if (!elegido %in% names(carga)) {
      carga <- c(carga, stats::setNames(0L, elegido))
    }
    carga[[elegido]] <- carga[[elegido]] + 1L
    anotar_asignacion(cita, elegido, fijada = TRUE, advertencia = advertencia)
  }

  # SEGUNDA pasada — el greedy de siempre sobre lo no fijado, con la carga y
  # las ventanas de las fijadas ya sembradas.
  for (cita in citas) {
    if (!is.null(fij[[cita$codigo]])) next
    dia_token <- .mav_dia_token(cita$fecha)
    dia_clave <- if (nzchar(dia_token)) .marep_DIA_CLAVE[[dia_token]] else ""
    candidatos <- character(0)
    if (nzchar(dia_clave)) {
      candidatos <- nombres[vapply(nombres, function(n) {
        # B71: el candidato debe estar libre desde el recojo (T−30) hasta el
        # fin de la aplicación — cubrir solo la aplicación era el cruce
        # deshonesto que el dictado 2026-09-03 vino a matar.
        .marep_cubre(oferta[[n]][[dia_clave]], cita$ini_ocupado, cita$fin) &&
          !.marep_solapa(ocupadas[[paste(n, cita$fecha, sep = "\r")]],
                         cita$ini_ocupado, cita$fin)
      }, logical(1))]
    }
    if (!length(candidatos)) {
      no_cubiertos[[cita$fecha]] <- c(no_cubiertos[[cita$fecha]], cita$codigo)
      next
    }
    # Menor carga acumulada manda; el empate se rompe por el orden de
    # prioridad (alfabeto con semilla 0; rotado al resortear, B67), nunca por
    # orden de entrada de la disponibilidad.
    #
    # **Con `concentrado`, quien ya está ese día se prefiere, PERO sin abrir
    # brecha.** La primera versión ponía «ya está ese día» delante de la carga
    # a secas, y el resultado sobre el operativo fue lo que Gonzalo vio el
    # 2026-09-04: «le estás dando 4 seguidas a una cuando tranquilamente le
    # puedes dar 2 seguidas a dos personas; hay que balancear bien equidad, sus
    # horarios disponibles, la concentración es el mismo día». Con esa regla,
    # quien entraba primero se quedaba con la jornada entera y el resto del
    # equipo se iba a cero.
    #
    # La preferencia se acota con la MISMA vara que el veredicto llama parejo:
    # se mantiene sólo mientras su carga no supere en más de UNA a la del menos
    # cargado que puede esa cita. Así cada persona sigue cayendo en un solo día
    # —al día siguiente ya no es la preferida— y las cargas quedan a distancia
    # de una. No es un tope duro: si nadie más puede, sigue siendo candidata y
    # se la lleva.
    carga_de <- vapply(candidatos, function(n) carga[[n]], numeric(1))
    mismo_dia <- if (concentrado) {
      vapply(candidatos, function(n) {
        length(ocupadas[[paste(n, cita$fecha, sep = "\r")]] %||% list())
      }, integer(1))
    } else {
      rep(0L, length(candidatos))
    }
    # **La banda de equidad se retiró el 2026-09-04, medida contra el operativo.**
    #
    # Acotar la preferencia a «no más de una por encima del menos cargado»
    # repartía en horizontal: con 24 aplicadores y 86 aplicaciones el greedy
    # dejaba a casi todo el mundo en cuatro, y como cada cuatro caían en días
    # distintos salían 50 viajes, 18 de ellos por UNA sola aplicación, y sólo
    # tres personas venían un único día. Eso es justo lo que su dictado vino a
    # prohibir: «que todos tengan asignaciones el mismo día y no vengan en días
    # diferentes, o aunque sea por lo menos vengan por dos aplicaciones».
    #
    # Con la cuenta en la mano la equidad y la concentración dejan de pelearse:
    # 86 entre 24 son 3,6 por persona, así que si cada quien LLENA un viaje de
    # hasta cuatro, el equipo entero cabe en un día cada uno. Lo que se reparte
    # parejo son los VIAJES, no las aplicaciones sueltas; quien ya está en el
    # campus sigue trabajando hasta el tope y el siguiente día lo abre gente
    # que no ha salido nunca.
    #
    # El tope es blando: quien ya llegó a cuatro deja de ser preferido, pero si
    # es el único que puede cubrir esa cita se la lleva igual.
    prefiere <- mismo_dia > 0L & mismo_dia < MONITOREO_AULAS_MAX_POR_VIAJE
    # **Y a igual carga, quien menos días lleva.**
    #
    # Sin esta clave el desempate caía en el alfabeto, así que una cita del
    # martes podía ir a alguien que YA vino el lunes teniendo al lado a otro
    # que no ha salido nunca: mismo reparto de trabajo, un viaje más al campus.
    # Medido sobre el operativo con la agenda al día (2026-09-04): 23 de 30
    # personas salían dos o más veces, 55 viajes para 85 aplicaciones.
    #
    # Va DESPUÉS de la carga —la equidad no se negocia— y sólo desempata entre
    # quienes llevan lo mismo. Con `concentrado` apagado no aplica: ahí el
    # criterio es explícitamente el de antes.
    dias_ya <- if (concentrado) {
      vapply(candidatos, function(n) as.integer(dias_por[[n]] %||% 0L), integer(1))
    } else {
      rep(0L, length(candidatos))
    }
    # El orden, y por qué cada clave está donde está:
    #   1. quien ya está ese día y no llegó al tope — ahorra el viaje;
    #   2. entre ellos, el que MÁS lleva ese día — se llena una jornada antes
    #      de abrir otra;
    #   3. si hay que reclutar, primero quien NO ha salido ningún día;
    #   4. después la carga acumulada, y al final el desempate de siempre.
    # `mismo_dia` sólo ordena DENTRO del grupo preferido: fuera de él sigue
    # valiendo cero, o quien ya pasó el tope volvería a encabezar la lista por
    # llevar más — el bug que puso siete aplicaciones en una persona con el
    # tope en cuatro.
    llenado <- ifelse(prefiere, mismo_dia, 0L)
    elegido <- candidatos[order(-prefiere,
                                -llenado,
                                dias_ya,
                                carga_de,
                                match(candidatos, prioridad),
                                method = "radix")][[1L]]
    if (is.null(ocupadas[[paste(elegido, cita$fecha, sep = "\r")]])) {
      dias_por[[elegido]] <- as.integer(dias_por[[elegido]] %||% 0L) + 1L
    }
    carga[[elegido]] <- carga[[elegido]] + 1L
    anotar_asignacion(cita, elegido, fijada = FALSE)
  }

  # TERCERA pasada — el reparo de VIAJES. Dictado de Gonzalo (2026-09-04):
  # «necesito que hagas la distribución para que todos tengan asignaciones el
  # mismo día y no vengan en días diferentes, o aunque sea por lo menos vengan
  # por dos aplicaciones».
  #
  # El greedy reparte cita a cita y no puede ver lo que va dejando atrás: una
  # persona con UNA sola aplicación en una fecha hizo el viaje al campus por
  # cuarenta minutos de trabajo, y una segunda fecha para quien ya vino es casi
  # siempre un viaje que podía absorber alguien que ya estaba ahí. Las dos
  # cosas sólo se ven con el día entero repartido, así que se arreglan al final
  # y moviendo asignaciones ENTRE PERSONAS: la fecha y la hora de una cita no
  # se negocian, sólo quién la cubre.
  #
  # Dos movimientos, y cuál se intenta primero depende de si esa fecha es el
  # ÚNICO día de esa persona:
  #
  # - si es su único día, se intenta TRAER una segunda aplicación de ese mismo
  #   día, de alguien que quede con dos o más: sube a dos sin dejar a nadie
  #   corto y sin que el equipo pierda una persona;
  # - si además viene otro día, se intenta LLEVARSE la aplicación a alguien que
  #   ya está ese día: eso ahorra el viaje entero, que es lo que él pidió.
  #
  # Invariante de equidad, para no reabrir el 4-contra-0 que él vio esa misma
  # mañana: **ningún movimiento sube el techo.** Sólo se acepta si quien recibe
  # queda con una carga que no supera la mayor que ya existía. Si el equipo
  # entero está en el techo, el viaje solitario se queda como está y viaja
  # declarado, que es preferible a mentir sobre la equidad.
  #
  # Las FIJADAS no se tocan, ni como origen ni como destino: son su voluntad,
  # no una sugerencia del motor.
  if (concentrado && length(asignaciones)) {
    # Mover una asignación exige su ventana OCUPADA (recojo→fin), que vive en
    # la cita y no en el item del payload.
    cita_de <- list()
    for (cita in citas) cita_de[[cita$codigo]] <- cita

    # El estado derivado se recalcula entero después de cada movimiento: con
    # ochenta y cinco asignaciones cuesta nada y evita la clase de bug que
    # aparece cuando un índice incremental se desincroniza de la lista.
    recontar <- function() {
      ocup <- list()
      crg <- carga
      if (length(crg)) crg[] <- 0L
      dias <- list()
      for (fecha in names(asignaciones)) {
        for (item in asignaciones[[fecha]]) {
          nm <- item$aplicador
          c0 <- cita_de[[item$codigo]]
          if (is.null(c0)) next
          clave <- paste(nm, fecha, sep = "\r")
          if (is.null(ocup[[clave]])) {
            dias[[nm]] <- as.integer(dias[[nm]] %||% 0L) + 1L
          }
          ocup[[clave]] <- c(ocup[[clave]], list(c(c0$ini_ocupado, c0$fin)))
          if (!nm %in% names(crg)) crg <- c(crg, stats::setNames(0L, nm))
          crg[[nm]] <- crg[[nm]] + 1L
        }
      }
      list(ocupadas = ocup, carga = crg, dias = dias)
    }

    # Mismo criterio de candidatura que el greedy: cubrir recojo→fin ese día de
    # semana y no solapar con lo que ya tiene esa fecha.
    puede <- function(nm, fecha, c0, ocup) {
      dia_token <- .mav_dia_token(fecha)
      dia_clave <- if (nzchar(dia_token)) .marep_DIA_CLAVE[[dia_token]] else ""
      nzchar(dia_clave) &&
        .marep_cubre(oferta[[nm]][[dia_clave]], c0$ini_ocupado, c0$fin) &&
        !.marep_solapa(ocup[[paste(nm, fecha, sep = "\r")]], c0$ini_ocupado, c0$fin)
    }

    mover <- function(codigo, fecha, de, a) {
      items <- asignaciones[[fecha]]
      for (k in seq_along(items)) {
        if (identical(items[[k]]$codigo, codigo) &&
            identical(items[[k]]$aplicador, de)) {
          items[[k]]$aplicador <- a
          break
        }
      }
      asignaciones[[fecha]] <<- items
    }

    n_ese_dia <- function(st, nm, fecha) {
      length(st$ocupadas[[paste(nm, fecha, sep = "\r")]] %||% list())
    }

    # Un movimiento por vuelta y a recontar: el tope es generoso porque cada
    # vuelta que mueve algo reduce en uno los solitarios, y la vuelta que no
    # mueve nada corta el bucle.
    for (vuelta in seq_len(length(citas) + 5L)) {
      st <- recontar()
      # El tope de la tercera pasada es el MISMO del greedy: llenar el viaje
      # de quien ya está ahí. Antes era `max(carga)` y con el equipo entero
      # pegado al techo no dejaba mover nada — 18 viajes solitarios seguían
      # en pie después de la pasada.
      techo <- MONITOREO_AULAS_MAX_POR_VIAJE
      solitarios <- list()
      for (fecha in names(asignaciones)) {
        por_nombre <- list()
        for (item in asignaciones[[fecha]]) {
          por_nombre[[item$aplicador]] <- c(por_nombre[[item$aplicador]], list(item))
        }
        for (nm in names(por_nombre)) {
          if (length(por_nombre[[nm]]) != 1L) next
          it <- por_nombre[[nm]][[1L]]
          if (isTRUE(it$fijada)) next
          solitarios[[length(solitarios) + 1L]] <- list(
            nombre = nm, fecha = fecha, codigo = it$codigo
          )
        }
      }
      if (!length(solitarios)) break
      solitarios <- solitarios[order(
        vapply(solitarios, function(x) x$fecha, character(1)),
        vapply(solitarios, function(x) x$nombre, character(1)),
        method = "radix"
      )]

      movio <- FALSE
      for (s in solitarios) {
        c0 <- cita_de[[s$codigo]]
        if (is.null(c0)) next
        unico_dia <- as.integer(st$dias[[s$nombre]] %||% 0L) <= 1L

        # **Los dos movimientos se intentan SIEMPRE; lo que cambia es el orden.**
        #
        # Si esa fecha es su único día, primero TRAER: sube a dos sin que el
        # equipo pierda una persona. Si además viene otro día, primero
        # LLEVARSE, que ahorra el viaje entero.
        #
        # Pero si el primero falla, el segundo se intenta igual. La versión que
        # sólo traía cuando era su único día dejaba once viajes solitarios en el
        # operativo: gente con dos fechas cuya aplicación no podía ir a nadie
        # —a esa hora los demás estaban ocupados o fuera de su horario— y a la
        # que, ya que el viaje iba a ocurrir de todos modos, nadie le acercaba
        # una segunda aula que sí encajaba.
        traer <- function() {
          if (n_ese_dia(st, s$nombre, s$fecha) + 1L > techo) return(FALSE)
          for (item in asignaciones[[s$fecha]]) {
            q <- item$aplicador
            if (identical(q, s$nombre) || isTRUE(item$fijada)) next
            # Quien cede debe quedarse con dos: cederlo estando en dos sólo
            # mueve el viaje solitario de sitio.
            if (n_ese_dia(st, q, s$fecha) < 3L) next
            c1 <- cita_de[[item$codigo]]
            if (is.null(c1) || !puede(s$nombre, s$fecha, c1, st$ocupadas)) next
            mover(item$codigo, s$fecha, q, s$nombre)
            return(TRUE)
          }
          FALSE
        }

        # LLEVARSE — a quien ya está ese día, empezando por el menos cargado.
        llevarse <- function() {
          destinos <- nombres[vapply(nombres, function(q) {
            !identical(q, s$nombre) &&
              n_ese_dia(st, q, s$fecha) >= 1L &&
              q %in% names(st$carga) &&
              n_ese_dia(st, q, s$fecha) + 1L <= techo &&
              puede(q, s$fecha, c0, st$ocupadas)
          }, logical(1))]
          if (!length(destinos)) return(FALSE)
          orden_destino <- order(
            vapply(destinos, function(q) st$carga[[q]], numeric(1)),
            match(destinos, prioridad),
            method = "radix"
          )
          mover(s$codigo, s$fecha, s$nombre, destinos[orden_destino][[1L]])
          TRUE
        }

        movio <- if (unico_dia) (traer() || llevarse()) else (llevarse() || traer())
        if (movio) break
      }
      if (!movio) break
    }

    st <- recontar()
    carga <- st$carga
    ocupadas <- st$ocupadas
    dias_por <- st$dias
  }

  fechas <- sort(unique(c(
    names(asignaciones), names(no_cubiertos), names(pendientes)
  )))
  dias <- lapply(fechas, function(fecha) {
    items <- asignaciones[[fecha]] %||% list()
    if (length(items) > 1L) {
      o <- order(orden_dia[[fecha]],
                 vapply(items, function(a) as.character(a$codigo), character(1)),
                 method = "radix")
      items <- items[o]
    }
    list(
      fecha = fecha,
      asignaciones = items,
      no_cubiertos = as.list(no_cubiertos[[fecha]] %||% character(0)),
      por_confirmar = as.list(pendientes[[fecha]] %||% character(0))
    )
  })
  equidad <- lapply(sort(names(carga), method = "radix"), function(n) {
    list(aplicador = n, asignadas = as.integer(carga[[n]]))
  })

  list(
    dias = dias, equidad = equidad,
    # El eco del criterio de concentración: la UI enseña el estado real del
    # motor, no el que cree tener.
    concentrado = concentrado,
    # El eco del mapa saneado, entero: la UI reconstruye el mapa completo al
    # fijar/soltar UNA cita sin perder las demás — una huérfana descartada en
    # silencio sería el defecto, no el ahorro.
    fijadas = lapply(sort(names(fij) %||% character(0), method = "radix"),
                     function(k) list(codigo = k, aplicador = fij[[k]])),
    fijadas_sin_cita = as.list(sort(
      as.character(setdiff(names(fij) %||% character(0), codigos_pactados)),
      method = "radix"
    )),
    # B70/B71: con qué duración se armó el reparto y cuánto dura la
    # preparación — el aviso y los gráficos lo leen de aquí, no de constantes
    # propias.
    duracion_min = as.integer(base[["duracion_min"]] %||% duracion_min),
    preparacion_min = .mav_PREPARACION_MIN,
    salida_min = .mav_SALIDA_MIN,
    # Y cuántas aplicaciones cabían en un viaje. Viaja porque la vista tiene
    # que poder decir «X podría tomarla, pero ya lleva el tope del día», y esa
    # frase es falsa si el frontend guarda su propio 4: sería la misma regla
    # leída dos veces, que es como empiezan a divergir las dos capas.
    tope_por_viaje = if (concentrado) MONITOREO_AULAS_MAX_POR_VIAJE else NA_integer_,
    # B75: lo aplazado, declarado por fecha; y el rango saneado que rigió.
    fuera_de_rango = if (length(fuera)) {
      lapply(sort(names(fuera), method = "radix"), function(fecha) {
        list(fecha = fecha,
             codigos = as.list(fuera[[fecha]]$codigos),
             por_confirmar = as.list(fuera[[fecha]]$por_confirmar))
      })
    } else NULL,
    rango = if (!is.null(rango_vigente)) {
      list(desde = rango_vigente[[1]], hasta = rango_vigente[[2]])
    } else NULL,
    # B67: con qué sorteo se armó este reparto.
    semilla = semilla
  )
}

#' El bloque de la vista «Disponibilidad de aplicadores».
#'
#' Pinta la oferta en la malla de 30 minutos de Carga de campo: por día de
#' semana (lunes→domingo, solo días con cobertura), las franjas del rango
#' cubierto donde ALGUIEN está disponible la franja entera, con el conteo y
#' los nombres en orden alfabético estable.
#'
#' @param disponibilidad salida de `carga_disponibilidad_aplicadores()`.
#' @return lista con `dias` (`{dia, franjas}`; cada franja `{inicio, fin,
#'   disponibles, nombres}`). Disponibilidad vacía → `dias` vacío declarado.
#' @keywords internal
monitoreo_aulas_disponibilidad_bloque <- function(disponibilidad = list()) {
  oferta <- .marep_oferta(disponibilidad)
  nombres <- sort(names(oferta) %||% character(0), method = "radix")

  dias <- list()
  for (dia in .marep_SEMANA) {
    quienes <- nombres[vapply(nombres, function(n) {
      length(oferta[[n]][[dia]] %||% list()) > 0L
    }, logical(1))]
    if (!length(quienes)) next
    bloques_dia <- lapply(quienes, function(n) oferta[[n]][[dia]])
    inis <- unlist(lapply(bloques_dia, function(bs) {
      vapply(bs, function(b) b[[1L]], numeric(1))
    }))
    fins <- unlist(lapply(bloques_dia, function(bs) {
      vapply(bs, function(b) b[[2L]], numeric(1))
    }))
    desde <- floor(min(inis) / 30) * 30
    hasta <- ceiling(max(fins) / 30) * 30
    franjas <- list()
    for (a in seq(desde, hasta - 30, by = 30)) {
      b <- a + 30
      presentes <- quienes[vapply(seq_along(quienes), function(k) {
        .marep_cubre(bloques_dia[[k]], a, b)
      }, logical(1))]
      if (!length(presentes)) next
      franjas[[length(franjas) + 1L]] <- list(
        inicio = .mav_hhmm(a),
        fin = .mav_hhmm(b),
        disponibles = length(presentes),
        nombres = as.list(presentes)
      )
    }
    if (length(franjas)) {
      dias[[length(dias) + 1L]] <- list(dia = dia, franjas = franjas)
    }
  }

  list(dias = dias)
}
