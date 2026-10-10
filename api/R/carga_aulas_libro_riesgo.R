# «Facultades en riesgo» — la hoja que contesta si cada facultad llega.
#
# Pedido de Gonzalo (2026-09-18, textual): «la hoja de facultades en riesgo debe
# tener bastante contexto util, como las aulas que estan agendadas, cuanto es
# esperar tener con ellas, si eso nos deja al final por debajo de la meta o por
# encima, que tal lejos estan las agendaciones, si ya se aplicaron todas sus
# aulas, etc. hay que ser bastante precisos con todas esas informaciones».
#
# **Por qué no basta el indicador de riesgo del motor.** Ya dice si una facultad
# cierra o no (`riesgo`, `riesgo_agendado`), y el 2026-09-18 las quince salían en
# verde. Pero «ninguna en riesgo» no es lo mismo que «ninguna apretada»: Letras y
# Ciencias Humanas cerraba su cuota de mujeres por UNA sola aula del 24/09 y con
# seis reservas libres. La hoja pone al lado las piezas con las que se decide:
# lo que hay, lo que falta, de cuántas aulas depende, para cuándo son y qué queda
# si una se cae.
#
# **La unidad es la CUOTA, no la facultad** (dictado 2026-09-18: «el desglose
# debe ser por facultad y sexo de forma independiente»). Las cuotas del diseño
# son por celda, y una facultad puede cerrar su total con una de sus dos celdas
# corta. La facultad entera se conserva en su propio bloque, como control.
#
# **La hoja da los datos, no el juicio** (mismo dictado: «el veredicto no lo das
# tú, porque suena a AI slop. Sino tú proporcionas los datos»). Lo único en
# palabras es el semáforo, que existe porque el color necesita una regla, y su
# criterio va escrito en la cabecera de la hoja.
#
# **Ordenada por lo que aprieta, no por el alfabeto.** Primero la facultad con
# menos margen al cierre. Una hoja alfabética obliga a leerla entera para
# encontrar la que muerde, que es justo lo que no se hace a las siete de la
# mañana.
#
# **No inventa una cuenta nueva.** Cada cifra sale del mismo dashboard que pinta
# la pantalla —`efectividad_seguimiento` para la proyección por facultad,
# `avance_sexo_facultad` para la celda de sexo, `control_facultad` para lo
# declarado—. Si la hoja y la pantalla discreparan sería un defecto, no una
# diferencia de criterio: por eso el dashboard entra por argumento y no se
# recalcula aquí con insumos propios.

.MALR_HOJA <- "Facultades en riesgo"
.MALR_BLOQUES <- c(
  "CUOTA POR CUOTA: FACULTAD Y SEXO",
  "LA FACULTAD ENTERA, COMO CONTROL",
  "LA AGENDA: DE CUÁNTO DEPENDE Y PARA CUÁNDO",
  "SI CONTÁRAMOS POR LA FACULTAD DECLARADA"
)

# **El semáforo, con su texto canónico.** El color no viaja solo: cada fila
# lleva la palabra, y los dos renderers —xlsx y Sheets— la traducen a fondo y
# tinta. Un color sin palabra se pierde al copiar la hoja, al imprimirla en
# blanco y negro y para quien no distingue el rojo del verde; una palabra sin
# color no se ve de un vistazo. Van juntos.
.MALR_SEMAFORO <- list(
  no_llega  = list(texto = "NO LLEGA",   fondo = "#FBD5D5", tinta = "#8A1C1C"),
  filo      = list(texto = "EN EL FILO", fondo = "#FDE2B8", tinta = "#8A4B00"),
  justa     = list(texto = "JUSTA",      fondo = "#FDF3D0", tinta = "#7A5C00"),
  en_camino = list(texto = "EN CAMINO",  fondo = "#E3EDFA", tinta = "#1B4B8F"),
  cerrada   = list(texto = "CERRADA",    fondo = "#E4F1E4", tinta = "#1E5B2A")
)

#' En qué peldaño del semáforo cae una cuota.
#'
#' **Una cuota ya cumplida NO corre peligro**: lo recogido no se devuelve. Por
#' eso el margen chico sólo pesa cuando todavía falta gente; si no, la celda es
#' `CERRADA` aunque su proyección sobre por poco. Confundir las dos cosas ponía
#' en la lista de riesgo a Contables y Educación, que cerraron hace días.
#'
#' @param cuota,logrado,margen,prob,margen_declarado,campo_cerrado la celda.
#' @return la clave del peldaño.
#' @keywords internal
.malr_peldano <- function(cuota, logrado, margen, prob = NA_real_,
                          margen_declarado = NA_real_, campo_cerrado = FALSE) {
  falta <- .malr_num(cuota, 0) - .malr_num(logrado, 0)
  margen <- .malr_num(margen); prob <- .malr_num(prob)
  mdec <- .malr_num(margen_declarado)
  if (is.finite(margen) && margen < 0) return("no_llega")
  if (falta > 0 && isTRUE(campo_cerrado)) return("no_llega")
  if (falta <= 0) return("cerrada")
  if (is.finite(prob) && prob < 0.95) return("filo")
  if (is.finite(mdec) && mdec < 0) return("filo")
  if (is.finite(margen) && margen <= 10) return("justa")
  "en_camino"
}

#' El texto del semáforo de un peldaño.
#' @keywords internal
.malr_semaforo_texto <- function(clave) {
  (.MALR_SEMAFORO[[clave]] %||% list(texto = ""))$texto
}

# La cabecera que marca la columna del semáforo, igual que su hermana del
# margen: es el ancla de la que salen los colores de las dos salidas.
.MALR_CABECERA_SEMAFORO <- "SEMÁFORO"

.malr_num <- function(x, default = NA_real_) {
  if (is.null(x) || !length(x)) return(default)
  v <- suppressWarnings(as.numeric(x[[1L]]))
  if (length(v) && is.finite(v)) v else default
}

.malr_txt <- function(x, default = "") {
  if (is.null(x) || !length(x)) return(default)
  v <- as.character(x[[1L]])
  if (is.na(v)) default else v
}

#' Un entero con separador de miles, o vacío si no hay cifra.
#' @keywords internal
.malr_ent <- function(x) {
  v <- .malr_num(x)
  if (!is.finite(v)) return("")
  format(round(v), big.mark = " ", trim = TRUE, scientific = FALSE)
}

#' Un margen, que viaja como NÚMERO y se pinta con su signo.
#'
#' El signo no se escribe en el texto: `.alp_celdas()` tipa como número toda
#' celda que parsee como tal, así que `"+5"` volvería 5 y el `+` se perdería
#' por el camino —y con él la diferencia entre sobrar cinco y faltar cinco—.
#' Lo que viaja es el número y quien lo pinta es el numFmt, en el xlsx y en
#' Sheets: `.MALR_CABECERA_MARGEN` marca las columnas donde se aplica.
#' @keywords internal
.malr_firmado <- function(x) {
  v <- .malr_num(x)
  if (!is.finite(v)) return("")
  as.character(as.integer(round(v)))
}

# La cabecera que marca una columna de margen. Es el ancla de la que salen el
# numFmt del xlsx y el de Sheets: renombrarla sin tocar las dos salidas deja la
# columna sin signo y en silencio, así que el contrato la comprueba.
.MALR_CABECERA_MARGEN <- "SOBRE / BAJO"
.MALR_NUMFMT_MARGEN <- "+#,##0;-#,##0;0"

#' Las columnas de margen de cada fila de cabecera, por número de fila.
#'
#' @param filas filas tipadas de la hoja.
#' @return lista `fila -> vector de columnas` para cada bloque con margen. Son
#'   VARIAS por bloque: la cuota por el aula y la misma por lo declarado llevan
#'   cada una su margen, y quedarse con la primera dejaba la segunda sin signo.
#' @keywords internal
.malr_columnas_margen <- function(filas) {
  out <- list()
  cols <- integer(0)
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    celdas <- as.character(unlist(f$celdas, use.names = FALSE))
    if (identical(f$tipo, "cabecera")) {
      cols <- which(startsWith(celdas, .MALR_CABECERA_MARGEN))
      next
    }
    if (identical(f$tipo, "dato") && length(cols)) out[[as.character(i)]] <- cols
  }
  out
}

#' La columna del semáforo de cada fila de dato, por número de fila.
#' @keywords internal
.malr_columnas_semaforo <- function(filas) {
  out <- list()
  col <- NA_integer_
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    celdas <- as.character(unlist(f$celdas, use.names = FALSE))
    if (identical(f$tipo, "cabecera")) {
      hit <- which(celdas == .MALR_CABECERA_SEMAFORO)
      col <- if (length(hit)) hit[[1L]] else NA_integer_
      next
    }
    if (identical(f$tipo, "dato") && is.finite(col)) out[[as.character(i)]] <- col
  }
  out
}

#' La primera letra en mayúscula, sin tocar el resto.
#' @keywords internal
.malr_may <- function(x) {
  v <- as.character(x %||% "")[1]
  if (!nzchar(v)) return("")
  paste0(toupper(substr(v, 1L, 1L)), substr(v, 2L, nchar(v)))
}

.malr_pct <- function(n, d) {
  n <- .malr_num(n); d <- .malr_num(d)
  if (!is.finite(n) || !is.finite(d) || d <= 0) return("")
  sprintf("%.0f %%", 100 * n / d)
}

#' Una fecha ISO como la lee una persona, y los días que faltan para ella.
#' @keywords internal
.malr_fecha <- function(x) {
  v <- .malr_txt(x)
  if (!nzchar(v)) return("")
  d <- suppressWarnings(as.Date(substr(v, 1L, 10L)))
  if (is.na(d)) return("")
  format(d, "%d/%m")
}

.malr_dia <- function(x) {
  v <- .malr_txt(x)
  if (!nzchar(v)) return(NA)
  suppressWarnings(as.Date(substr(v, 1L, 10L)))
}

#' Las citas que el motor cuenta como aforo agendado, con sus fechas.
#'
#' **El mismo criterio que el motor, llamado y no parecido.** La hoja pone en
#' una fila «2 agendadas» y al lado «próxima cita»: si las dos columnas salieran
#' de dos definiciones distintas de agendada, la fila se contradiría a sí misma.
#' Una primera versión de esta función usaba «no aplicada y con algo escrito en
#' `scheduled_date`» sobre el eslabón en juego, y sobre HSVG2026 el 2026-09-18
#' cuadraba en 13 facultades de 15 y fallaba por una cita en Ciencias Sociales y
#' otra en Estudios Generales Ciencias. Coincidir en trece no es el mismo
#' criterio: es un criterio parecido.
#'
#' Por eso reproduce `agend` de `.monitoreo_aulas_efectividad_seguimiento()`
#' pieza por pieza y con sus propias funciones:
#'
#'   * el eslabón EN JUEGO, sin banco (`monitoreo_aulas_en_juego()`): de
#'     `CH 5` → `R 5.1` → `R 5.2` sólo una juega a la vez;
#'   * PENDIENTE = no aplicada y con aforo. Aplicada incluye el aula que ya
#'     tiene respuestas atribuidas aunque su parte no haya llegado — que es
#'     exactamente la cita de más que fallaba antes;
#'   * CON FECHA según `.maau_con_fecha()`, que deja fuera `contactada`:
#'     estar llamando al docente no es tener día;
#'   * y NO VENCIDA: una cita que pasó pide reagendar, no es aforo.
#'
#' @param plan filas del plan, ya normalizadas.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias, ya normalizada.
#' @param hoy fecha de referencia.
#' @return `data.frame` con `facultad`, `codigo`, `fecha` y `elegibles` de cada
#'   cita que cuenta como aforo agendado, o un data.frame vacío.
#' @keywords internal
.malr_citas_pendientes <- function(plan, responses = NULL, cfg = list(), hoy = Sys.Date()) {
  vacio <- data.frame(facultad = character(0), codigo = character(0),
                      fecha = as.Date(character(0)), elegibles = numeric(0),
                      stringsAsFactors = FALSE)
  filas <- plan %||% list()
  if (!length(filas)) return(vacio)
  campo <- function(k, f) vapply(filas, function(u) f(u[[k]]), if (identical(f, .malr_num)) {
    numeric(1)
  } else character(1))
  df <- data.frame(
    facultad = campo("faculty", .malr_txt),
    operational_code = campo("operational_code", .malr_txt),
    titular_operational_code = campo("titular_operational_code", .malr_txt),
    sample_role = campo("sample_role", .malr_txt),
    sample_status = campo("sample_status", .malr_txt),
    operational_status = campo("operational_status", .malr_txt),
    application_status = campo("application_status", .malr_txt),
    scheduled_date = campo("scheduled_date", .malr_txt),
    classroom_id = campo("classroom_id", .malr_txt),
    collection_unit_id = campo("collection_unit_id", .malr_txt),
    replacement_order = campo("replacement_order", .malr_num),
    eligible_n = campo("eligible_n", .malr_num),
    stringsAsFactors = FALSE
  )
  df$replacement_order[!is.finite(df$replacement_order)] <- 0
  df$eligible_n[!is.finite(df$eligible_n)] <- 0

  # Las respuestas ya atribuidas a cada fila del plan, con la misma atribución
  # que el avance: un aula que ya recogió no es aforo pendiente aunque su parte
  # siga sin llegar.
  df$respuestas_validas <- rep(0, nrow(df))
  if (is.data.frame(responses) && nrow(responses)) {
    atr <- .maac_atribucion(df, .monitoreo_aulas_valid_response(responses, cfg),
                            .monitoreo_aulas_response_classroom(responses, cfg))
    validas <- atr$fila[atr$valid %in% TRUE]
    validas <- validas[is.finite(validas)]
    if (length(validas)) df$respuestas_validas <- tabulate(validas, nbins = nrow(df))
  }

  sin_banco <- df[df$sample_role != "extra_reserve_pool", , drop = FALSE]
  if (!nrow(sin_banco)) sin_banco <- df
  tracked <- sin_banco[monitoreo_aulas_en_juego(sin_banco), , drop = FALSE]
  if (!nrow(tracked)) tracked <- sin_banco
  if (!nrow(tracked)) return(vacio)

  aplicada <- tracked$operational_status %in% MONITOREO_AULAS_ESTADOS_APLICADOS |
    tracked$application_status %in% "aplicada" |
    tracked$respuestas_validas > 0
  pendiente <- !aplicada & tracked$eligible_n > 0
  con_fecha <- .maau_con_fecha(tracked$sample_status, tracked$scheduled_date,
                               tracked$operational_status)
  fechas <- suppressWarnings(as.Date(substr(tracked$scheduled_date, 1L, 10L)))
  corte <- suppressWarnings(as.Date(hoy))
  vencida <- pendiente & con_fecha & !is.na(fechas) & !is.na(corte) & fechas < corte
  agend <- pendiente & con_fecha & !vencida & !is.na(fechas)
  if (!any(agend)) return(vacio)
  data.frame(facultad = tracked$facultad[agend], codigo = tracked$operational_code[agend],
             fecha = fechas[agend], elegibles = tracked$eligible_n[agend],
             stringsAsFactors = FALSE)
}

#' El estado de cada facultad frente a su meta, con el contexto que se decide.
#'
#' @param plan filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias.
#' @param cuotas `design_targets`.
#' @param dashboard el dashboard ya calculado, si el llamador lo tiene. Es el
#'   mismo objeto que pinta la pantalla; pasarlo evita recalcularlo (7,6 s
#'   medidos sobre HSVG2026) y GARANTIZA que la hoja y la pantalla digan el
#'   mismo número.
#' @param hoy fecha de referencia.
#' @param cruce el cruce de facultad declarada ya calculado, si quien llama lo
#'   tiene. Es la pieza cara del bloque.
#' @return `{ok, motivo, hoy, facultades, total}`. `ok = FALSE` cuando el
#'   estudio todavía no tiene cuotas por facultad con las que juzgar.
#' @export
monitoreo_aulas_riesgo_facultades <- function(plan = list(), responses = NULL,
                                              cfg = list(), cuotas = NULL,
                                              dashboard = NULL, hoy = Sys.Date(),
                                              cruce = NULL) {
  vacio <- function(motivo) list(ok = FALSE, motivo = motivo, hoy = as.character(hoy),
                                 facultades = list(), total = list())
  # **Esta hoja es CONDICIONAL y no puede tumbar el libro.** El dashboard pide
  # más del plan que el generador: con un plan mínimo —sin `faculty`— revienta,
  # y al colgar la hoja del generador se llevó por delante 22 suites del libro
  # que llevaban años en verde. El libro tiene que salir aunque su hoja de
  # riesgo no pueda calcularse; lo que no puede es salir sin decir por qué
  # falta, así que el motivo viaja en vez de perderse.
  d <- dashboard %||% tryCatch(
    monitoreo_aulas_dashboard(plan, responses, cfg, hoy = hoy),
    error = function(e) NULL)
  if (is.null(d)) {
    return(vacio(paste(
      "el plan todavía no tiene lo que hace falta para proyectar el cierre por",
      "facultad (la facultad de cada curso-horario y su aforo).")))
  }
  seg <- d$efectividad_seguimiento %||% list()
  filas_seg <- seg$facultades %||% list()
  # **La cuota SIEMPRE existe, y por eso hay que decir de dónde sale.** Medido
  # el 2026-09-18: sin `design_targets` el motor no se queda sin meta, cae al
  # `expected_valid` del propio plan —una facultad con 40 elegibles sale con
  # cuota 20—. Así que el riesgo de esta hoja no es quedarse vacía: es decir
  # «llega» contra una meta que el estudio nunca fijó. La fuente viaja en
  # `fuente_cuota` y la nota de cabecera la nombra.
  con_cuota <- vapply(filas_seg, function(x) is.finite(.malr_num(x$cuota)), logical(1))
  if (!length(filas_seg) || !any(con_cuota)) {
    return(vacio(paste(
      "todavía no hay ninguna facultad con una meta contra la que medirse.")))
  }
  filas_seg <- filas_seg[con_cuota]

  citas <- .malr_citas_pendientes(monitoreo_aulas_normalize_plan(plan), responses,
                                  monitoreo_aulas_normalize_config(cfg), hoy = hoy)
  # Las celdas de sexo, indexadas por facultad: la cuota total puede cerrar y la
  # de mujeres no, que es el caso que la hoja existe para no dejar pasar.
  sexo_por_fac <- list()
  for (c in (d$avance_sexo_facultad %||% list())) {
    k <- .malr_txt(c$faculty)
    if (!nzchar(k)) next
    sexo_por_fac[[k]] <- c(sexo_por_fac[[k]] %||% list(), list(c))
  }
  # La retención de cada facultad: de los que su aula entrega, cuántos dicen ser
  # de ella. Sólo existe si el estudio declara su variable de facultad.
  #
  # **El cruce se pide entero, no se toma del payload.** `d$control_facultad`
  # publica el resumen que la UI necesita —`ok`, `comparables`, `coinciden`,
  # `discrepan`— y deja fuera `por_sexo`, que es justo lo que este bloque mira.
  # Leerlo de ahí daba una lista vacía y el bloque desaparecía de la hoja sin
  # decir por qué, que es peor que no tenerlo.
  # **El cruce entra por argumento cuando quien llama ya lo tiene.** Cuesta
  # 11,9 s sobre las 3 000 respuestas de HSVG2026, y el dashboard lo necesita
  # también para `control_facultad`: calcularlo dos veces llevó el tablero de
  # 7,6 s a 31 s. Sin él por argumento se pide, que es lo que hace el libro.
  cruce <- cruce %||% tryCatch(
    monitoreo_aulas_cruce_facultad_declarada(plan, responses, cfg, cuotas = cuotas),
    error = function(e) list(ok = FALSE))
  retencion <- list()
  if (isTRUE(cruce$ok)) {
    for (f in (cruce$por_sexo %||% list())) {
      k <- .malr_txt(f$facultad)
      if (!nzchar(k)) next
      for (sx in c("F", "M")) {
        aula <- .malr_num(f[[paste0("aula_", sx)]])
        decl <- .malr_num(f[[paste0("declaradas_", sx)]])
        if (is.finite(aula) && aula > 0 && is.finite(decl)) {
          retencion[[paste(k, sx)]] <- decl / aula
        }
      }
    }
  }

  out <- lapply(filas_seg, function(x) {
    fac <- .malr_txt(x$facultad)
    mias <- citas[citas$facultad == fac, , drop = FALSE]
    agendadas <- .malr_num(x$cursos_agendados, 0)
    sin_agendar <- .malr_num(x$cursos_sin_agendar, 0)
    vencidas <- .malr_num(x$cursos_vencidos, 0)
    proximas <- mias[mias$fecha >= hoy, , drop = FALSE]
    celdas <- lapply(sexo_por_fac[[fac]] %||% list(), function(c) {
      sx <- .malr_txt(c$sex)
      ret <- retencion[[paste(fac, sx)]]
      cierre <- .malr_num(c$proyeccion_agendada)
      list(
        sexo = sx,
        cuota = .malr_num(c$cuota),
        logrado = .malr_num(c$logrado),
        esperado = .malr_num(c$aporte_agendado),
        al_cierre = cierre,
        margen = cierre - .malr_num(c$cuota),
        prob_cierre = .malr_num(c$prob_cierre),
        estado = .malr_txt(c$estado),
        etiqueta = .malr_txt(c$etiqueta),
        retencion = ret %||% NA_real_,
        al_cierre_declarado = if (!is.null(ret) && is.finite(cierre)) cierre * ret else NA_real_,
        margen_declarado = if (!is.null(ret) && is.finite(cierre)) {
          cierre * ret - .malr_num(c$cuota)
        } else NA_real_
      )
    })
    list(
      facultad = fac,
      cuota = .malr_num(x$cuota),
      logrado = .malr_num(x$conseguido),
      aulas_aplicadas = .malr_num(x$aulas_aplicadas, 0),
      agendadas = agendadas,
      sin_agendar = sin_agendar,
      vencidas = vencidas,
      en_gestion = .malr_num(x$cursos_en_gestion, 0),
      estancadas = .malr_num(x$cursos_estancados, 0),
      aforo_agendado = .malr_num(x$elegibles_agendados, 0),
      tau_observado = .malr_num(x$tau_observado),
      esperado_agendado = .malr_num(x$proyectado_agendado) - .malr_num(x$conseguido),
      al_cierre = .malr_num(x$proyectado_agendado),
      margen = .malr_num(x$margen_agendado),
      riesgo = .malr_txt(x$riesgo_agendado),
      reservas_libres = .malr_num(x$reservas_libres, 0),
      # **Campo cerrado NO es «llegó a su cuota»**: es que ya no le queda nada
      # que aplicar —ni cita pendiente, ni aula por agendar, ni cita vencida que
      # reprogramar—. Una facultad puede tener campo cerrado y estar corta, y es
      # el peor de los casos porque ya no hay de dónde sacarlo.
      campo_cerrado = agendadas == 0 && sin_agendar == 0 && vencidas == 0,
      proxima_cita = if (nrow(proximas)) as.character(min(proximas$fecha)) else "",
      ultima_cita = if (nrow(proximas)) as.character(max(proximas$fecha)) else "",
      dias_a_la_ultima = if (nrow(proximas)) as.numeric(max(proximas$fecha) - hoy) else NA_real_,
      codigos_pendientes = as.character(proximas$codigo),
      sexo = celdas
    )
  })

  # El orden es el del aprieto: primero la celda de sexo más justa de cada
  # facultad, y si no tiene celdas, su margen total.
  aprieto <- vapply(out, function(f) {
    m <- vapply(f$sexo, function(c) {
      v <- c$margen_declarado
      if (is.finite(v)) v else c$margen
    }, numeric(1))
    m <- m[is.finite(m)]
    if (length(m)) min(m) else .malr_num(f$margen, Inf)
  }, numeric(1))
  out <- out[order(aprieto)]

  list(
    ok = TRUE, motivo = "", hoy = as.character(hoy), facultades = out,
    fuente_cuota = .malr_txt(seg$fuente, "el plan"),
    vigencia_cuota = .malr_txt(seg$vigencia),
    total = list(
      facultades = length(out),
      cuotas = sum(vapply(out, function(f) length(f$sexo), integer(1))),
      cuotas_cortas = sum(vapply(out, function(f) {
        sum(vapply(f$sexo, function(c) {
          isTRUE(.malr_num(c$cuota, 0) - .malr_num(c$logrado, 0) > 0)
        }, logical(1)))
      }, integer(1))),
      en_riesgo = .malr_num((seg$total %||% list())$facultades_en_riesgo_agendado, 0),
      con_campo_cerrado = sum(vapply(out, function(f) isTRUE(f$campo_cerrado), logical(1))),
      cortas = sum(vapply(out, function(f) {
        isTRUE(.malr_num(f$logrado, 0) < .malr_num(f$cuota, 0))
      }, logical(1))),
      citas_pendientes = nrow(citas),
      ultima_cita = if (nrow(citas)) as.character(max(citas$fecha)) else ""
    )
  )
}

#' Las filas de la hoja «Facultades en riesgo», tipadas.
#'
#' @inheritParams monitoreo_aulas_riesgo_facultades
#' @return `NULL` si no hay con qué juzgar; si no, lista de `{tipo, celdas}`.
#' @keywords internal
aulas_libro_filas_riesgo <- function(plan = list(), responses = NULL, cfg = list(),
                                     cuotas = NULL, dashboard = NULL, hoy = Sys.Date()) {
  o <- monitoreo_aulas_riesgo_facultades(plan, responses, cfg, cuotas = cuotas,
                                         dashboard = dashboard, hoy = hoy)
  if (!isTRUE(o$ok) || !length(o$facultades)) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = .alp_celdas(tipo, celdas))
  }
  hoy_d <- if (inherits(hoy, "Date")) hoy else Sys.Date()

  # **La hoja da los datos; el juicio es del que la lee.** Gonzalo, 2026-09-18:
  # «el veredicto no lo das tú, porque suena a AI slop. Sino tú proporcionas los
  # datos». La primera versión escribía una frase por fila —«Le falta 1 persona
  # y la espera de 1 aula agendada»— que no añadía nada que las columnas no
  # dijeran ya, y encima lo decía con voz de informe. Fuera.
  #
  # Lo único que queda en palabras es el SEMÁFORO, y está porque el color que
  # pidió necesita una regla y un texto que lo acompañe: es una clasificación de
  # cinco valores con su criterio escrito arriba, no una redacción.
  poner("titulo", "FACULTADES EN RIESGO")
  poner("nota", sprintf("Al %s · %d cuotas (facultad × sexo) · %d de ellas todavía por debajo de su meta.",
                        format(hoy_d, "%d/%m/%Y"), o$total$cuotas, o$total$cuotas_cortas))
  poner("nota", paste(
    "AL CIERRE = logrado + lo que aportan las aulas con fecha, a la tasa de esa",
    "facultad. No cuenta lo que está sin agendar. SOBRE / BAJO = al cierre menos",
    "la cuota."))
  poner("nota", sprintf(paste(
    "SEMÁFORO — NO LLEGA: el margen es negativo, o falta gente y ya no queda",
    "nada por aplicar. EN EL FILO: probabilidad de cierre bajo 0,95 o no llega",
    "por lo declarado. JUSTA: falta gente y el margen es 10 o menos. EN CAMINO:",
    "falta gente con margen mayor. CERRADA: ya tiene su cuota. Meta tomada de %s."),
    .malr_fuente_cuota(o$fuente_cuota)))
  poner("nota", "")

  # ---- Bloque 1: la CUOTA, que es la celda facultad x sexo ----
  poner("bloque", .MALR_BLOQUES[[1]])
  poner("nota", paste(
    "Las cuotas del diseño son por facultad Y sexo, así que cada una se mide",
    "por separado. Las columnas de agenda son de la facultad: las mismas aulas",
    "sostienen sus dos celdas."))
  poner("cabecera", c("FACULTAD", "SEXO", "CUOTA", "LOGRADO", "% DE LA CUOTA", "FALTAN",
                      "ESPERADO DE LO AGENDADO", "AL CIERRE", "SOBRE / BAJO LA META",
                      "PROBABILIDAD DE CIERRE", "RETENCIÓN", "AL CIERRE POR LO DECLARADO",
                      "SOBRE / BAJO POR LO DECLARADO", "AULAS AGENDADAS", "SIN AGENDAR",
                      "VENCIDAS", "PRÓXIMA CITA", "ÚLTIMA CITA", "RESERVAS LIBRES",
                      .MALR_CABECERA_SEMAFORO))
  celdas <- unlist(lapply(o$facultades, function(f) {
    lapply(f$sexo, function(c) c(list(facultad = f$facultad, padre = f), c))
  }), recursive = FALSE)
  peldano_de <- function(c) .malr_peldano(c$cuota, c$logrado, c$margen, c$prob_cierre,
                                          c$margen_declarado, c$padre$campo_cerrado)
  # Orden: primero el peldaño, y dentro de él lo más apretado.
  rango <- c(no_llega = 1, filo = 2, justa = 3, en_camino = 4, cerrada = 5)
  celdas <- celdas[order(
    vapply(celdas, function(c) rango[[peldano_de(c)]], numeric(1)),
    vapply(celdas, function(c) {
      v <- c(.malr_num(c$margen_declarado), .malr_num(c$margen))
      v <- v[is.finite(v)]
      if (length(v)) min(v) else Inf
    }, numeric(1)))]
  for (c in celdas) {
    f <- c$padre
    falta <- .malr_num(c$cuota, 0) - .malr_num(c$logrado, 0)
    poner("dato", c(
      c$facultad, if (identical(c$sexo, "F")) "Mujeres" else "Hombres",
      .malr_ent(c$cuota), .malr_ent(c$logrado), .malr_pct(c$logrado, c$cuota),
      if (falta > 0) .malr_ent(falta) else "",
      .malr_ent(c$esperado), .malr_ent(c$al_cierre), .malr_firmado(c$margen),
      if (is.finite(.malr_num(c$prob_cierre))) sprintf("%.2f", c$prob_cierre) else "",
      if (is.finite(.malr_num(c$retencion))) sprintf("%.0f %%", 100 * c$retencion) else "",
      .malr_ent(c$al_cierre_declarado), .malr_firmado(c$margen_declarado),
      .malr_ent(f$agendadas), .malr_ent(f$sin_agendar), .malr_ent(f$vencidas),
      .malr_fecha(f$proxima_cita), .malr_fecha(f$ultima_cita), .malr_ent(f$reservas_libres),
      .malr_semaforo_texto(peldano_de(c))))
  }

  # ---- Bloque 2: la facultad entera, como control ----
  poner("nota", "")
  poner("bloque", .MALR_BLOQUES[[2]])
  poner("nota", paste(
    "La suma de las dos celdas de cada facultad. Una facultad puede cerrar aquí",
    "y tener una de sus dos cuotas corta, así que esta tabla no sustituye a la",
    "de arriba: la controla."))
  poner("cabecera", c("FACULTAD", "CUOTA", "LOGRADO", "% DE LA CUOTA", "FALTAN",
                      "ESPERADO DE LO AGENDADO", "AL CIERRE", "SOBRE / BAJO LA META",
                      .MALR_CABECERA_SEMAFORO))
  # Ordenado por SU propio aprieto, no por el del bloque de arriba: heredarlo
  # ponía Contables y Educación en cabeza de una tabla en la que están holgadas.
  peldano_fac <- function(f) .malr_peldano(f$cuota, f$logrado, f$margen,
                                           campo_cerrado = f$campo_cerrado)
  por_facultad <- o$facultades[order(
    vapply(o$facultades, function(f) rango[[peldano_fac(f)]], numeric(1)),
    vapply(o$facultades, function(f) {
      v <- .malr_num(f$margen); if (is.finite(v)) v else Inf
    }, numeric(1)))]
  for (f in por_facultad) {
    falta <- .malr_num(f$cuota, 0) - .malr_num(f$logrado, 0)
    poner("dato", c(
      f$facultad, .malr_ent(f$cuota), .malr_ent(f$logrado), .malr_pct(f$logrado, f$cuota),
      if (falta > 0) .malr_ent(falta) else "",
      .malr_ent(f$esperado_agendado), .malr_ent(f$al_cierre), .malr_firmado(f$margen),
      .malr_semaforo_texto(peldano_fac(f))))
  }

  # ---- Bloque 3: la agenda, aula por aula ----
  poner("nota", "")
  poner("bloque", .MALR_BLOQUES[[3]])
  poner("nota", paste(
    "SIN AGENDAR: aulas del plan que todavía no tienen día. VENCIDAS: citas que",
    "pasaron sin aplicarse. RESERVAS LIBRES: con cuántas se puede cubrir una que",
    "se caiga. CÓDIGOS: las aulas con fecha de las que depende lo que falta."))
  poner("cabecera", c("FACULTAD", "APLICADAS", "AGENDADAS", "SIN AGENDAR", "VENCIDAS",
                      "EN GESTIÓN", "AFORO AGENDADO", "PRÓXIMA CITA", "ÚLTIMA CITA",
                      "DÍAS HASTA LA ÚLTIMA", "RESERVAS LIBRES", "CÓDIGOS AGENDADOS"))
  for (f in por_facultad) {
    poner("dato", c(
      f$facultad, .malr_ent(f$aulas_aplicadas), .malr_ent(f$agendadas),
      .malr_ent(f$sin_agendar), .malr_ent(f$vencidas), .malr_ent(f$en_gestion),
      .malr_ent(f$aforo_agendado), .malr_fecha(f$proxima_cita), .malr_fecha(f$ultima_cita),
      if (is.finite(f$dias_a_la_ultima)) .malr_ent(f$dias_a_la_ultima) else "",
      .malr_ent(f$reservas_libres),
      paste(f$codigos_pendientes, collapse = ", ")))
  }

  filas
}

#' Los valores de la hoja para Sheets.
#' @keywords internal
aulas_libro_valores_riesgo <- function(plan = list(), responses = NULL, cfg = list(),
                                       cuotas = NULL, dashboard = NULL, hoy = Sys.Date()) {
  filas <- aulas_libro_filas_riesgo(plan, responses, cfg, cuotas = cuotas,
                                    dashboard = dashboard, hoy = hoy)
  if (is.null(filas)) return(NULL)
  lapply(filas, function(f) as.list(f$celdas))
}

#' Escribe la hoja «Facultades en riesgo» sobre el workbook del libro.
#' @keywords internal
aulas_libro_hoja_riesgo <- function(wb, plan = list(), responses = NULL, cfg = list(),
                                    cuotas = NULL, dashboard = NULL, hoy = Sys.Date()) {
  filas <- aulas_libro_filas_riesgo(plan, responses, cfg, cuotas = cuotas,
                                    dashboard = dashboard, hoy = hoy)
  if (is.null(filas)) return(invisible(FALSE))
  hoja <- .MALR_HOJA
  openxlsx::addWorksheet(wb, hoja)
  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    openxlsx::writeData(wb, hoja, .alp_fila_df(f$celdas), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i, cols = seq_along(f$celdas),
                         gridExpand = TRUE)
    }
  }
  # **El color sale del semáforo de la fila, no de buscar texto suelto.** La
  # celda del semáforo lleva la palabra y de ahí sale el fondo, así que las dos
  # cosas no pueden discrepar: cambiar el peldaño cambia los dos a la vez.
  estilo_semaforo <- lapply(.MALR_SEMAFORO, function(x) {
    openxlsx::createStyle(fgFill = x$fondo, fontColour = x$tinta,
                          textDecoration = "bold", halign = "center")
  })
  fila_semaforo <- lapply(.MALR_SEMAFORO, function(x) {
    openxlsx::createStyle(fgFill = x$fondo)
  })
  por_texto <- stats::setNames(names(.MALR_SEMAFORO),
                               vapply(.MALR_SEMAFORO, function(x) x$texto, character(1)))
  semaforos <- .malr_columnas_semaforo(filas)
  for (fila in names(semaforos)) {
    i <- as.integer(fila)
    col <- semaforos[[fila]]
    txt <- as.character(filas[[i]]$celdas[[col]])
    clave <- por_texto[[txt]] %||% NA_character_
    if (is.na(clave)) next
    # La fila entera con el tinte suave, y la celda del semáforo con su tinta:
    # se busca la fila roja de un vistazo y se lee la palabra al llegar.
    openxlsx::addStyle(wb, hoja, fila_semaforo[[clave]], rows = i,
                       cols = seq_along(filas[[i]]$celdas), gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, hoja, estilo_semaforo[[clave]], rows = i, cols = col, stack = TRUE)
  }
  signo <- openxlsx::createStyle(numFmt = .MALR_NUMFMT_MARGEN, halign = "right")
  margenes <- .malr_columnas_margen(filas)
  for (fila in names(margenes)) {
    openxlsx::addStyle(wb, hoja, signo, rows = as.integer(fila),
                       cols = margenes[[fila]], stack = TRUE)
  }
  ancho_max <- max(vapply(filas, function(f) length(f$celdas), integer(1)))
  anchos <- c(34L, rep(15L, max(0L, ancho_max - 2L)), 46L)
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L)
  invisible(TRUE)
}

#' El numFmt con signo de UNA celda de margen en Sheets.
#'
#' Es el hermano del `numFmt` del xlsx: el mismo patrón en las dos salidas, para
#' que el margen se lea igual en el archivo y en la pestaña.
#' @keywords internal
.malr_formato_signo <- function(sheet_id, fila, col) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(
      numberFormat = list(type = "NUMBER", pattern = .MALR_NUMFMT_MARGEN),
      horizontalAlignment = "RIGHT"
    )),
    fields = "userEnteredFormat(numberFormat,horizontalAlignment)"
  ))
}

#' Una banda de UNA celda: el hermano de `.maaf_banda()`, que pinta la fila.
#' @keywords internal
.malr_banda_celda <- function(sheet_id, fila, col, fondo, tinta) {
  list(repeatCell = list(
    range = list(
      sheetId = sheet_id,
      startRowIndex = as.integer(fila - 1L), endRowIndex = as.integer(fila),
      startColumnIndex = as.integer(col - 1L), endColumnIndex = as.integer(col)
    ),
    cell = list(userEnteredFormat = list(
      backgroundColor = .monitoreo_sheets_rgb(fondo),
      textFormat = list(bold = TRUE, foregroundColor = .monitoreo_sheets_rgb(tinta)),
      horizontalAlignment = "CENTER"
    )),
    fields = "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
  ))
}

#' Requests de formato de la hoja en Sheets.
#' @keywords internal
aulas_libro_riesgo_formato_requests <- function(sheet_id, rows) {
  rows <- rows %||% list()
  if (!length(rows)) return(list())
  n_cols <- max(1L, max(vapply(rows, function(r) length(r %||% list()), integer(1))))
  requests <- list()
  poner <- function(req) requests[[length(requests) + 1L]] <<- req
  # La columna de margen del bloque en curso: se fija al leer su cabecera y se
  # suelta al llegar a la del bloque siguiente, porque no todos la tienen.
  cols_margen <- integer(0)
  col_semaforo <- NA_integer_
  por_texto <- stats::setNames(names(.MALR_SEMAFORO),
                               vapply(.MALR_SEMAFORO, function(x) x$texto, character(1)))
  for (i in seq_along(rows)) {
    celdas <- trimws(as.character(unlist(rows[[i]] %||% list(), use.names = FALSE)))
    primera <- if (length(celdas)) celdas[[1L]] else ""
    linea <- paste(celdas, collapse = " ")
    clave_fila <- ""
    if (identical(primera, "FACULTAD")) {
      cols_margen <- which(startsWith(celdas, .MALR_CABECERA_MARGEN))
      hit <- which(celdas == .MALR_CABECERA_SEMAFORO)
      col_semaforo <- if (length(hit)) hit[[1L]] else NA_integer_
    } else if (primera %in% .MALR_BLOQUES) {
      cols_margen <- integer(0)
      col_semaforo <- NA_integer_
    } else if (nzchar(primera) && length(celdas) > 1L) {
      for (cm in cols_margen) poner(.malr_formato_signo(sheet_id, i, cm))
      if (is.finite(col_semaforo) && length(celdas) >= col_semaforo) {
        clave_fila <- por_texto[[celdas[[col_semaforo]]]] %||% ""
      }
    }
    if (identical(primera, "FACULTADES EN RIESGO")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 13L))
      poner(.maaf_alto_fila(sheet_id, i, 36L))
    } else if (primera %in% .MALR_BLOQUES) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#002457", "#FFFFFF", size = 11L))
      poner(.maaf_alto_fila(sheet_id, i, 28L))
    } else if (identical(primera, "FACULTAD")) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#E7EEF9", "#1B4B8F", wrap = TRUE))
    } else if (nzchar(clave_fila)) {
      sem <- .MALR_SEMAFORO[[clave_fila]]
      # La fila con su tinte y la tinta normal del texto; la celda del semáforo
      # va aparte, en negrita y centrada.
      poner(.maaf_banda(sheet_id, i, n_cols, sem$fondo, "#3A3532", bold = FALSE))
      if (is.finite(col_semaforo)) {
        poner(.malr_banda_celda(sheet_id, i, col_semaforo, sem$fondo, sem$tinta))
      }
    } else if (length(celdas) == 1L && nzchar(primera)) {
      poner(.maaf_banda(sheet_id, i, n_cols, "#FFFFFF", "#6B6560",
                        size = 9L, italic = TRUE, bold = FALSE))
    }
  }
  requests
}

#' De dónde sale la cuota, en palabras.
#'
#' `design_targets` es el cálculo de muestra —una cuota acordada—; cualquier
#' otra cosa es una meta derivada, y la hoja tiene que decirlo con todas las
#' letras para que nadie lea «llega» como «llega a lo pactado».
#' @keywords internal
.malr_fuente_cuota <- function(fuente) {
  switch(as.character(fuente %||% "")[1],
         design_targets = "el cálculo de muestra del estudio",
         plan = "lo que el plan esperaba de cada aula",
         sprintf("%s", if (nzchar(as.character(fuente %||% "")[1])) fuente else "el plan"))
}
