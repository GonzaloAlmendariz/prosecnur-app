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
#' @return lista con `dias` (por fecha ISO ascendente: `{fecha, asignaciones,
#'   no_cubiertos, por_confirmar}`; cada asignación con `recojo`, `salida`,
#'   `fijada` y, si aplica, `advertencia`), `equidad` (`{aplicador,
#'   asignadas}` en orden alfabético — la oferta entera más los fijados
#'   externos, cero incluido), `fijadas_sin_cita` (códigos fijados sin cita
#'   pactada) y el eco `duracion_min` / `preparacion_min`.
#' @keywords internal
monitoreo_aulas_reparto <- function(plan = list(), disponibilidad = list(),
                                    fijadas = list(),
                                    duracion_min = .mav_DURACION_MIN) {
  base <- monitoreo_aulas_ventanas(plan, duracion_min = duracion_min)
  aulas <- base[["aulas"]] %||% list()
  oferta <- .marep_oferta(disponibilidad)
  nombres <- sort(names(oferta) %||% character(0), method = "radix")

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
  for (aula in aulas) {
    fecha <- as.character(aula[["fecha"]] %||% "")
    if (!nzchar(fecha)) next
    if (identical(as.character(aula[["ventana"]] %||% ""), "confirmada")) {
      ini <- .marep_min(aula[["inicio"]])
      fin <- .marep_min(aula[["fin"]])
      if (is.na(ini) || is.na(fin)) next
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
  asignaciones <- list()
  # El minuto de inicio de cada asignación, paralelo por fecha: las fijadas
  # entran ANTES que las automáticas y el día se reordena por hora al final —
  # el contrato del payload («greedy por hora ascendente») no cambia.
  orden_dia <- list()
  no_cubiertos <- list()

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
  codigos_pactados <- vapply(citas, function(x) x$codigo, character(1)) %||% character(0)
  for (cita in citas) {
    elegido <- fij[[cita$codigo]]
    if (is.null(elegido)) next
    dia_token <- .mav_dia_token(cita$fecha)
    dia_clave <- if (nzchar(dia_token)) .marep_DIA_CLAVE[[dia_token]] else ""
    cubre <- nzchar(dia_clave) &&
      .marep_cubre(oferta[[elegido]][[dia_clave]], cita$ini_ocupado, cita$fin)
    solapa <- .marep_solapa(ocupadas[[paste(elegido, cita$fecha, sep = "\r")]],
                            cita$ini_ocupado, cita$fin)
    advertencia <- if (solapa) "se_solapa" else if (!cubre) "sin_disponibilidad" else ""
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
    # Menor carga acumulada manda; el empate se rompe por alfabeto, no por
    # orden de entrada de la disponibilidad.
    elegido <- candidatos[order(carga[candidatos], candidatos,
                                method = "radix")][[1L]]
    carga[[elegido]] <- carga[[elegido]] + 1L
    anotar_asignacion(cita, elegido, fijada = FALSE)
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
    preparacion_min = .mav_PREPARACION_MIN
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
