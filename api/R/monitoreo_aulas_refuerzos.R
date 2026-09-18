# Los refuerzos del operativo: de dónde salió cada aula y qué está rindiendo.
#
# Pedido de Gonzalo (2026-09-18, textual): «Que los refuerzos se mantengan
# guardados en pulso, que la app les haga adecuado seguimiento»; «Poder definir
# el techo de aulas y en base a ello poder pedir mas refuerzos».
#
# **El problema que resuelve.** Un aula que no es titular pudo entrar por dos
# caminos que piden decisiones opuestas: porque su titular se cayó —reemplazo
# orgánico, la cadena hace su trabajo— o porque alguien la eligió para tapar una
# brecha —refuerzo—. Gonzalo: «no hay forma de distinguir tan bien si un
# reemplazo fue por reemplazo organico o en verdad fue un reemplazo al aire que
# fue seleccionado por el selector de refuerzos». Y además: «el sheets los marco
# de morados y muchos se agendaron entonces ya no estuvieron marcados como
# refuerzo» — la marca se perdía justo al empezar a servir.
#
# **Se RECONSTRUYE, no se lee.** El plan tiene los campos donde esa decisión
# debería constar —`activation_origin`, `activation_reason`, `activated_for`,
# `activated_at`— y están vacíos: medido el 2026-09-18 sobre HSVG26ULT2, uno de
# 1 392 tiene origen y ninguno razón. Mientras nadie los escriba, la procedencia
# sale de la evidencia: si el titular de la cadena sigue vivo o ya se aplicó, la
# reserva no está reemplazando a nadie. Cada fila dice CÓMO se supo
# (`procedencia_fuente`), porque un dato inferido y uno registrado no valen lo
# mismo y la vista no debe poder confundirlos.
#
# **El techo es una decisión, no una constante.** Cuántos cursos-horario admite
# el operativo lo fija el estudio; aquí sólo se cuenta contra él. Y se cuenta
# con las aulas QUE FUERON A CAMPO, no con el eslabón en juego de cada cadena:
# son dos preguntas distintas y mezclarlas se come el margen. Medido el mismo
# día: 152 aulas fueron a campo y el criterio «en juego» daba 145, porque seis
# cadenas tienen dos eslabones aplicados. Contra un techo de 195, esa diferencia
# son siete refuerzos que no existen.

.MARF_TECHO_DEFECTO <- 0L

#' Cuántos cursos-horario admite el operativo.
#'
#' `0` significa sin techo declarado, que NO es lo mismo que un techo de cero:
#' sin él no se puede decir cuántos refuerzos caben, y el motor lo dice en vez
#' de inventar un número.
#' @param cfg config de aulas universitarias.
#' @return entero; `0` cuando el estudio no lo declara.
#' @keywords internal
.marf_techo <- function(cfg) {
  v <- suppressWarnings(as.numeric((cfg %||% list())[["techo_aulas_campo"]] %||% NA))
  if (length(v) && is.finite(v[1]) && v[1] > 0) as.integer(round(v[1])) else .MARF_TECHO_DEFECTO
}

# El texto y el número de una celda se leen con los micro-helpers COMPARTIDOS
# (`.monitoreo_scalar` y `.monitoreo_num`, de `monitoreo_engine.R`), no con una
# pareja propia: redefinirlos aquí puso en rojo `test-helpers-sin-duplicar.R`
# el mismo día que nació este motor — `.marf_txt` tenía el cuerpo exacto de
# `.malr_txt`, y el guard hizo su trabajo.

#' El plan como data.frame, con las respuestas ya atribuidas a cada fila.
#'
#' Comparte atribución con el avance (`.maac_atribucion()`): un aula que ya
#' recogió no es aforo pendiente aunque su parte no haya llegado, y ésa es
#' justamente la diferencia que descuadraba los conteos.
#' @keywords internal
.marf_marco <- function(plan, responses, cfg) {
  filas <- monitoreo_aulas_normalize_plan(plan %||% list())
  if (!length(filas)) return(NULL)
  chr <- function(k) vapply(filas, function(u) .monitoreo_scalar(u[[k]], ""), character(1))
  num <- function(k) vapply(filas, function(u) .monitoreo_num(u[[k]], 0), numeric(1))
  df <- data.frame(
    operational_code = chr("operational_code"),
    titular_operational_code = chr("titular_operational_code"),
    sample_role = chr("sample_role"), sample_status = chr("sample_status"),
    operational_status = chr("operational_status"),
    application_status = chr("application_status"),
    scheduled_date = chr("scheduled_date"), faculty = chr("faculty"),
    course_name = chr("course_name"), teacher = chr("teacher"),
    teacher_email = chr("teacher_email"), schedule = chr("schedule"),
    classroom_id = chr("classroom_id"), collection_unit_id = chr("collection_unit_id"),
    activation_origin = chr("activation_origin"), activation_reason = chr("activation_reason"),
    activated_at = chr("activated_at"),
    replacement_order = num("replacement_order"), eligible_n = num("eligible_n"),
    expected_valid = num("expected_valid"),
    sex_top_1 = chr("sex_top_1"), sex_top_1_n = num("sex_top_1_n"),
    sex_top_2 = chr("sex_top_2"), sex_top_2_n = num("sex_top_2_n"),
    stringsAsFactors = FALSE
  )
  df$respuestas_validas <- rep(0, nrow(df))
  if (is.data.frame(responses) && nrow(responses)) {
    atr <- .maac_atribucion(df, .monitoreo_aulas_valid_response(responses, cfg),
                            .monitoreo_aulas_response_classroom(responses, cfg))
    v <- atr$fila[atr$valid %in% TRUE]
    v <- v[is.finite(v)]
    if (length(v)) df$respuestas_validas <- tabulate(v, nbins = nrow(df))
  }
  # Los hombres y las mujeres que el aula puede aportar, del par `sex_top_*`
  # del marco. Es lo que permite elegir un refuerzo por la celda que falta y no
  # sólo por su tamaño.
  es <- function(letra, a, b, na, nb) ifelse(toupper(substr(a, 1L, 1L)) == letra, na,
                                             ifelse(toupper(substr(b, 1L, 1L)) == letra, nb, 0))
  df$hombres <- es("M", df$sex_top_1, df$sex_top_2, df$sex_top_1_n, df$sex_top_2_n)
  df$mujeres <- es("F", df$sex_top_1, df$sex_top_2, df$sex_top_1_n, df$sex_top_2_n)
  df
}

#' Estado de cada aula: aplicada, agendada, vencida, disponible o caída.
#' @keywords internal
.marf_estados <- function(df, hoy) {
  aplicada <- df$operational_status %in% MONITOREO_AULAS_ESTADOS_APLICADOS |
    df$application_status %in% "aplicada" |
    df$respuestas_validas > 0
  con_fecha <- .maau_con_fecha(df$sample_status, df$scheduled_date, df$operational_status)
  fechas <- suppressWarnings(as.Date(substr(df$scheduled_date, 1L, 10L)))
  corte <- suppressWarnings(as.Date(hoy))
  vencida <- !aplicada & con_fecha & !is.na(fechas) & !is.na(corte) & fechas < corte
  agendada <- !aplicada & con_fecha & !is.na(fechas) & !vencida
  caida <- .maej_caido(df$sample_status)
  list(aplicada = aplicada, agendada = agendada, vencida = vencida, caida = caida,
       fechas = fechas,
       disponible = !aplicada & !agendada & !vencida & !caida)
}

#' Por qué entró un aula que no es titular: el caso A, B o C.
#'
#' El vocabulario es de Gonzalo (2026-09-11, confirmado el 18): «A es reemplazo
#' directo por rechazo, B es complemento a un CH y C son aulas adicionales que se
#' usan de refuerzo».
#'
#' **Sólo A se puede deducir; B y C no.** Que el titular esté caído es un hecho
#' del plan, así que A se reconoce sola. Pero entre completar a un curso-horario
#' concreto y reforzar a la facultad entera no hay ninguna diferencia observable:
#' la distingue la INTENCIÓN de quien eligió el aula.
#'
#' Lo demostró Gonzalo el 2026-09-18 con la lista de los quince refuerzos de la
#' primera semana, todos caso C. Entre ellos, R 161.5, R 161.6 y R 161.8, cuyo
#' titular CH 161 YA se había aplicado con 12 efectivas. Una primera versión de
#' esta función deducía «titular aplicado → complemento (B)» y habría clasificado
#' esas tres como B: eran C, elegidas por la cuota de Psicología y no para
#' completar a CH 161.
#'
#' Por eso lo no declarado sale como `adicional` —con su `caso` vacío— en vez de
#' inventarle una letra. Es exactamente lo que hace valioso el registro: sin él
#' no hay forma de saberlo, y con él se sabe sin deducir nada.
#'
#' @return lista con `clase` y `fuente`. La fuente tiene TRES grados, no dos:
#'   `declarada` (alguien la marcó), `sellada` (la app la dedujo al agendar y
#'   la escribió) y `reconstruida` (se deduce ahora, sin constar en el plan).
#'
#'   Los tres existen porque fundirlos le daría a una deducción la certeza de
#'   una decisión. Lo advirtió la sesión vecina el 2026-09-18 mirando este
#'   mismo diseño: «si las deduces y las publicas iguales, le das a 14 filas una
#'   certeza que no tienen, y dentro de un mes nadie va a poder distinguir la
#'   declarada de la inferida». Tenía razón: con dos grados, sellar convertía
#'   ocho deducciones en «registrada».
#' @keywords internal
.marf_procedencia <- function(df, estados, i) {
  origen <- tolower(trimws(df$activation_origin[i]))
  # Lo DECLARADO manda y trae su letra: `monitoreo_aulas_marcar_refuerzo()` ya
  # escribe «complemento» o «refuerzo».
  if (nzchar(origen) && !identical(origen, .MARF_ORIGEN_INFERIDO)) {
    clase <- if (grepl("complemento", origen)) "complemento" else
      if (grepl("refuerzo|extra", origen)) "refuerzo" else "reemplazo"
    return(list(clase = clase, fuente = "declarada", detalle = df$activation_origin[i]))
  }
  fuente <- if (nzchar(origen)) "sellada" else "reconstruida"
  if (identical(df$sample_role[i], "extra_reserve_pool")) {
    # Un extra no pertenece a ninguna cadena, así que A queda descartado; entre
    # B y C sigue sin haber evidencia.
    return(list(clase = "adicional", fuente = fuente,
                detalle = "del banco de extras: no reemplaza a ninguna cadena"))
  }
  cadena <- if (nzchar(df$titular_operational_code[i])) df$titular_operational_code[i] else
    df$operational_code[i]
  hermanos <- which(ifelse(nzchar(df$titular_operational_code), df$titular_operational_code,
                           df$operational_code) == cadena &
                      df$sample_role == "titular")
  if (!length(hermanos)) {
    return(list(clase = "adicional", fuente = fuente,
                detalle = "su cadena no tiene titular en el plan"))
  }
  t <- hermanos[[1L]]
  # A: el único que la evidencia sostiene.
  if (isTRUE(estados$caida[t]) && !isTRUE(estados$aplicada[t])) {
    return(list(clase = "reemplazo", fuente = fuente,
                detalle = sprintf("su titular %s está en %s",
                                  df$operational_code[t], df$sample_status[t])))
  }
  if (isTRUE(estados$aplicada[t])) {
    return(list(clase = "adicional", fuente = fuente,
                detalle = sprintf("entró con su titular %s ya aplicado (%d efectivas)",
                                  df$operational_code[t], as.integer(df$respuestas_validas[t]))))
  }
  list(clase = "adicional", fuente = fuente,
       detalle = sprintf("entró con su titular %s todavía vivo (%s)",
                         df$operational_code[t], df$sample_status[t]))
}

#' Los refuerzos del operativo, su seguimiento y el margen contra el techo.
#'
#' @param plan filas del plan.
#' @param responses respuestas de la plataforma.
#' @param cfg config de aulas universitarias; de ella sale `techo_aulas_campo`.
#' @param hoy fecha de referencia.
#' @return `{ok, motivo, hoy, techo, aulas, activadas, rendimiento, disponibles}`.
#' @export
monitoreo_aulas_refuerzos <- function(plan = list(), responses = NULL, cfg = list(),
                                      hoy = Sys.Date()) {
  vacio <- function(motivo) list(ok = FALSE, motivo = motivo, hoy = as.character(hoy),
                                 techo = list(), aulas = list(), activadas = list(),
                                 rendimiento = list(), disponibles = list())
  cfg <- monitoreo_aulas_normalize_config(cfg)
  df <- .marf_marco(plan, responses, cfg)
  if (is.null(df) || !nrow(df)) return(vacio("el estudio todavía no tiene plan de aulas."))
  e <- .marf_estados(df, hoy)

  # --- las no titulares que están en juego o ya rindieron ---
  activas <- which((e$aplicada | e$agendada) & df$sample_role != "titular")
  activadas <- lapply(activas, function(i) {
    pr <- .marf_procedencia(df, e, i)
    list(
      codigo = df$operational_code[i], rol = df$sample_role[i],
      facultad = df$faculty[i], curso = df$course_name[i], docente = df$teacher[i],
      clase = pr$clase, caso = .marf_caso(pr$clase),
      procedencia_fuente = pr$fuente, por_que = pr$detalle,
      estado = if (isTRUE(e$aplicada[i])) "aplicada" else "agendada",
      fecha = df$scheduled_date[i],
      elegibles = as.integer(df$eligible_n[i]),
      efectivas = as.integer(df$respuestas_validas[i]),
      hombres = as.integer(df$hombres[i]), mujeres = as.integer(df$mujeres[i])
    )
  })

  # --- ¿rinden? Por clase, y con los titulares como referencia ---
  tasa <- function(idx) {
    if (!length(idx)) {
      return(list(n = 0L, elegibles = 0L, efectivas = 0L, tasa = NA_real_))
    }
    el <- sum(df$eligible_n[idx]); ef <- sum(df$respuestas_validas[idx])
    list(n = length(idx), elegibles = as.integer(round(el)), efectivas = as.integer(round(ef)),
         tasa = if (el > 0) round(ef / el, 4) else NA_real_)
  }
  clase_de <- rep("", nrow(df))
  for (i in activas) clase_de[i] <- .marf_procedencia(df, e, i)$clase
  aplicadas_de <- function(cl) activas[e$aplicada[activas] & clase_de[activas] == cl]
  rendimiento <- list(
    titulares = tasa(which(e$aplicada & df$sample_role == "titular")),
    reemplazo = tasa(aplicadas_de("reemplazo")),
    complemento = tasa(aplicadas_de("complemento")),
    refuerzo = tasa(aplicadas_de("refuerzo")),
    # Las que nadie declaró: se miden aparte porque mezclarlas con las de su
    # letra supuesta es justo lo que haría pasar una deducción por un dato.
    adicional = tasa(aplicadas_de("adicional")),
    banco = tasa(activas[e$aplicada[activas] &
                           df$sample_role[activas] == "extra_reserve_pool"])
  )

  # --- el techo, contado con las aulas QUE FUERON A CAMPO ---
  #
  # Una cita por delante en una cadena cuya aula ya se aplicó NO se va a
  # aplicar: tiene fecha, ocupa sitio en la agenda y un aplicador, pero no
  # consume techo. Contarla gastaba margen que sí existe.
  cadena <- ifelse(nzchar(df$titular_operational_code), df$titular_operational_code,
                   df$operational_code)
  huerfana <- e$agendada & cadena %in% unique(cadena[e$aplicada]) &
    df$sample_role != "extra_reserve_pool"
  gastadas <- sum(e$aplicada)
  por_gastar <- sum(e$agendada & !huerfana)
  techo <- .marf_techo(cfg)
  list(
    ok = TRUE, motivo = "", hoy = as.character(hoy),
    techo = list(
      declarado = techo,
      hay = techo > 0,
      gastadas = as.integer(gastadas),
      por_gastar = as.integer(por_gastar),
      al_cierre = as.integer(gastadas + por_gastar),
      # Cuántos refuerzos caben todavía. `NA` sin techo declarado: decir un
      # número ahí sería inventarle un límite al estudio. Sale del MISMO cuerpo
      # que usa la lista de candidatos: dos copias acabarían discrepando en el
      # detalle que más cuesta, las citas huérfanas.
      caben = .marf_techo_caben(df, e, cfg),
      vencidas = as.integer(sum(e$vencida)),
      citas_huerfanas = as.integer(sum(huerfana)),
      codigos_huerfanos = I(as.character(df$operational_code[huerfana])),
      # **Las huérfanas tienen dos lecturas y las dos son ciertas**, así que se
      # publican las dos con nombre propio en vez de elegir una y callar la
      # otra. Tienen fecha y aplicador, pero su titular ya rindió: si nadie va,
      # no consumen techo (`caben`); si alguien va igual porque la cita sigue
      # en la hoja, sí (`caben_en_el_peor_caso`). Sobre HSVG2026 al 18/09 la
      # diferencia es 19 contra 15, y revisarlas es lo que devuelve el margen.
      caben_en_el_peor_caso = if (techo > 0) {
        as.integer(.marf_techo_caben(df, e, cfg) - sum(huerfana))
      } else NA_integer_
    ),
    # **El embudo del DISEÑO: qué fue de cada curso-horario original.**
    #
    # Gonzalo, 2026-09-18: «se tenían 174 aulas de esas 174 originales, cuántas
    # finalmente se aplicaron o reemplazaron, y sobre esas 174 se llamaron a más
    # aulas a nivel de reemplazo». Es otro marco que el del techo: aquél cuenta
    # aulas gastadas, éste sigue la suerte de cada titular del diseño.
    #
    # La distinción que pedía está en `adicionales`: de las reservas en juego,
    # unas SUSTITUYEN a un titular caído y otras entraron sin que cayera nadie.
    # Sobre HSVG2026 son 7 contra 11, y llamarlas a todas «reemplazos» escondía
    # que dos tercios eran refuerzos.
    diseno = .marf_embudo(df, e, cadena),
    activadas = activadas,
    rendimiento = rendimiento,
    # Lo que queda en la banca, por facultad: sin esto «pedir más refuerzos» no
    # sabe si hay de dónde.
    disponibles = local({
      m <- e$disponible & df$sample_role != "titular"
      if (!any(m)) return(list())
      lapply(split(which(m), df$faculty[m]), function(idx) list(
        facultad = df$faculty[idx[[1L]]],
        reservas = as.integer(sum(df$sample_role[idx] == "chain_reserve")),
        extras = as.integer(sum(df$sample_role[idx] == "extra_reserve_pool")),
        aforo = as.integer(round(sum(df$eligible_n[idx]))),
        hombres = as.integer(round(sum(df$hombres[idx]))),
        mujeres = as.integer(round(sum(df$mujeres[idx])))
      ))
    })
  )
}

# ---------------------------------------------------------------------------
# Las cuotas que ameritan un refuerzo, ordenadas por lo que aprieta.
#
# Dictado de Gonzalo (2026-09-18): «que el mapeo de cuotas en riesgo sea aun mas
# claro, viendo cuales todavia estan muy lejanas (cuantitativamente pero tambien
# a nivel de tiempo o agenda muy lejana o casi finalizando) y ameritan un
# refuerzo o mas de uno».
#
# **El eje de TIEMPO, que faltaba.** Hasta aquí una cuota se juzgaba por cuánto
# le falta y cuánto margen proyecta. Pero dos celdas con el mismo margen no
# corren el mismo riesgo si una tiene su última cita el jueves y la otra el 1 de
# octubre: la primera ya no puede reaccionar. Y una a la que no le queda nada
# agendado es el peor caso aunque su número se vea bien, porque no hay nada que
# pueda salir bien. Cada factor de tiempo pesa y, sobre todo, DICE por qué.
#
# **La vara es suya y es el orden, no la decisión** —«podemos tener los
# refuerzos ordenados por orden de urgencia y de ellos escoger 10 por ejemplo,
# pero eso ya lo haria yo uno por uno, sabiendo que informacion del contexto de
# cada uno y la razon por la cual uno es mas importante que el otro»—. Por eso
# cada cuota sale con `por_que`: una lista de motivos legibles, no una nota
# global. Quien lee decide; el motor ordena y explica.

#' Cuántos días faltan para una fecha ISO, o `NA` si no hay.
#' @keywords internal
.marf_dias <- function(iso, hoy) {
  v <- .monitoreo_scalar(iso, "")
  if (!nzchar(v)) return(NA_real_)
  d <- suppressWarnings(as.Date(substr(v, 1L, 10L)))
  if (is.na(d)) return(NA_real_)
  as.numeric(d - as.Date(hoy))
}

#' «1 aula» y «2 aulas», nunca «1 aula(s)»: un paréntesis así es la marca de
#' una frase armada sin mirar su número, y estos textos los lee el coordinador.
#' @keywords internal
.marf_plural <- function(n, uno, varios) {
  sprintf("%d %s", as.integer(n), if (abs(n) == 1) uno else varios)
}

#' Las cuotas cortas, con su urgencia y el motivo de cada punto.
#'
#' @param riesgo el resultado de `monitoreo_aulas_riesgo_facultades()`.
#' @param hoy fecha de referencia.
#' @param dias_de_reaccion cuántos días necesita un refuerzo para llegar a
#'   aplicarse: contactar al docente, cerrar fecha y aplicar. Por debajo de eso,
#'   la agenda de esa cuota ya no admite otra aula y el aviso cambia de «ponle
#'   un refuerzo» a «ya no da tiempo».
#' @return lista de cuotas ordenada de más a menos urgente.
#' @export
monitoreo_aulas_cuotas_urgentes <- function(riesgo, hoy = Sys.Date(),
                                            dias_de_reaccion = 5L) {
  if (!isTRUE((riesgo %||% list())$ok)) return(list())
  out <- list()
  for (f in (riesgo$facultades %||% list())) {
    for (c in (f$sexo %||% list())) {
      falta <- .monitoreo_num(c$cuota, 0) - .monitoreo_num(c$logrado, 0)
      if (!(falta > 0)) next
      margen <- .monitoreo_num(c$margen, NA_real_)
      mdec <- .monitoreo_num(c$margen_declarado, NA_real_)
      prob <- .monitoreo_num(c$prob_cierre, NA_real_)
      agendadas <- .monitoreo_num(f$agendadas, 0)
      sin_agendar <- .monitoreo_num(f$sin_agendar, 0)
      reservas <- .monitoreo_num(f$reservas_libres, 0)
      dias_ult <- .marf_dias(f$ultima_cita, hoy)
      dias_prox <- .marf_dias(f$proxima_cita, hoy)

      motivos <- list(); urgencia <- 0
      anotar <- function(peso, texto, eje) {
        motivos[[length(motivos) + 1L]] <<- list(eje = eje, texto = texto, peso = peso)
        urgencia <<- urgencia + peso
      }
      # --- el eje CUANTITATIVO ---
      if (is.finite(margen) && margen < 0) {
        anotar(100, sprintf("no llega ni aplicando todo lo agendado (%+d)",
                            as.integer(round(margen))), "cantidad")
      }
      if (is.finite(prob) && prob < 0.95) {
        anotar(60, sprintf("su probabilidad de cierre es %.2f", prob), "cantidad")
      }
      if (is.finite(mdec) && mdec < 0) {
        anotar(50, sprintf("por la facultad que declaran no llega (%+d)",
                           as.integer(round(mdec))), "cantidad")
      }
      if (is.finite(margen) && margen >= 0 && margen <= 10) {
        anotar(30, sprintf("su margen es de sólo %+d", as.integer(round(margen))), "cantidad")
      }
      # --- el eje de TIEMPO ---
      if (isTRUE(f$campo_cerrado)) {
        anotar(80, "ya no le queda nada por aplicar: lo que falta no puede salir de su plan",
               "tiempo")
      } else if (agendadas == 0 && sin_agendar > 0) {
        anotar(55, sprintf("tiene %s en el plan y ninguna con fecha",
                           .marf_plural(sin_agendar, "aula", "aulas")), "tiempo")
      }
      if (is.finite(dias_ult) && agendadas > 0) {
        if (dias_ult <= dias_de_reaccion) {
          # **«Ya no da tiempo» sólo si de verdad no lo hay.** Una facultad con
          # aulas del plan sin fecha todavía puede agendar una; decirle que no
          # llega mientras `admite_refuerzo` dice que sí es un rótulo que
          # promete lo contrario de su propio campo.
          anotar(45, if (sin_agendar > 0) {
            sprintf("su agenda se acaba en %s, aunque le quedan %s por agendar",
                    .marf_plural(dias_ult, "día", "días"),
                    .marf_plural(sin_agendar, "aula", "aulas"))
          } else {
            sprintf("su agenda se acaba en %s y un refuerzo ya no llegaría a tiempo",
                    .marf_plural(dias_ult, "día", "días"))
          }, "tiempo")
        } else if (dias_ult <= dias_de_reaccion * 2) {
          anotar(25, sprintf("su agenda se acaba en %s",
                             .marf_plural(dias_ult, "día", "días")), "tiempo")
        } else {
          anotar(5, sprintf("su última cita es dentro de %d días: hay margen para reaccionar",
                            as.integer(dias_ult)), "tiempo")
        }
      }
      if (agendadas > 0 && agendadas <= 1) {
        anotar(40, "todo lo que le falta cuelga de una sola aula", "tiempo")
      }
      # --- el eje de RESPALDO ---
      if (reservas <= 10) {
        anotar(20, sprintf("le %s sólo %s libre%s",
                           if (abs(reservas) == 1) "queda" else "quedan",
                           .marf_plural(reservas, "reserva", "reservas"),
                           if (abs(reservas) == 1) "" else "s"), "respaldo")
      }
      urgencia <- urgencia + min(30, falta)
      if (!length(motivos)) {
        anotar(0, sprintf("le faltan %d y su margen es %+d", as.integer(falta),
                          as.integer(round(margen))), "cantidad")
      }
      out[[length(out) + 1L]] <- list(
        facultad = f$facultad, sexo = .monitoreo_scalar(c$sexo, ""),
        cuota = .monitoreo_num(c$cuota, NA_real_), logrado = .monitoreo_num(c$logrado, NA_real_),
        faltan = as.integer(round(falta)), al_cierre = .monitoreo_num(c$al_cierre, NA_real_),
        margen = margen, margen_declarado = mdec, prob_cierre = prob,
        aulas_agendadas = as.integer(agendadas), sin_agendar = as.integer(sin_agendar),
        reservas_libres = as.integer(reservas),
        proxima_cita = .monitoreo_scalar(f$proxima_cita, ""),
        ultima_cita = .monitoreo_scalar(f$ultima_cita, ""),
        dias_a_la_proxima = if (is.finite(dias_prox)) as.integer(dias_prox) else NA_integer_,
        dias_a_la_ultima = if (is.finite(dias_ult)) as.integer(dias_ult) else NA_integer_,
        # Si un refuerzo pedido hoy todavía podría aplicarse. Es la diferencia
        # entre «ponle un refuerzo» y «ya no da tiempo, mira otra cosa».
        admite_refuerzo = !isTRUE(f$campo_cerrado) &&
          (!is.finite(dias_ult) || dias_ult > dias_de_reaccion || sin_agendar > 0),
        urgencia = round(urgencia, 1),
        por_que = I(vapply(motivos, function(m) m$texto, character(1))),
        ejes = I(unique(vapply(motivos, function(m) m$eje, character(1))))
      )
    }
  }
  if (!length(out)) return(list())
  out[order(-vapply(out, function(x) x$urgencia, numeric(1)))]
}

# ---------------------------------------------------------------------------
# Los candidatos a refuerzo, ordenados y explicados. La app ORDENA; Gonzalo ELIGE.
#
# Su vara, textual (2026-09-18): «Tampoco sobreprometer aulas, podemos tener los
# refuerzos ordenados por orden de urgencia y de ellos escoger 10 por ejemplo,
# pero eso ya lo haria yo uno por uno, sabiendo que informacion del contexto de
# cada uno y la razon por la cual uno es mas importante que el otro o porque
# esta facultad esta en mas riesgo».
#
# De ahí las tres reglas de este bloque:
#
#   1. **Una lista, no un reparto.** Un cupo por facultad decidido aquí —«tres
#      para Letras, cuatro para Gestión»— es exactamente la decisión que él se
#      reserva. Sale una lista única, ordenada, y él corta donde quiera.
#   2. **Cada candidato carga el porqué de SU cuota**, no una nota al pie: el
#      número 7 tiene que poder defenderse contra el 8 sin abrir otra pantalla.
#   3. **No se sobrepromete.** `dentro_del_techo` marca hasta dónde llega el
#      sitio que queda; lo que sobra sigue en la lista —para el día que el techo
#      suba o alguien caiga— pero declarado como lo que es.

#' Los candidatos a refuerzo de cada cuota urgente.
#'
#' @param plan,responses,cfg,hoy como en `monitoreo_aulas_refuerzos()`.
#' @param riesgo salida de `monitoreo_aulas_riesgo_facultades()`: de ahí salen
#'   las cuotas y su urgencia. Sin él no hay a qué brecha atribuir un refuerzo.
#' @param por_cuota cuántos candidatos ofrecer por cuota. Más de cuatro sobre la
#'   misma brecha es ofrecer opciones que ya no la cambian.
#' @return `{ok, motivo, hoy, caben, candidatos}`.
#' @export
monitoreo_aulas_candidatos_refuerzo <- function(plan = list(), responses = NULL,
                                                cfg = list(), riesgo = NULL,
                                                hoy = Sys.Date(), por_cuota = 4L) {
  vacio <- function(motivo) list(ok = FALSE, motivo = motivo, hoy = as.character(hoy),
                                 caben = NA_integer_, candidatos = list())
  urgentes <- monitoreo_aulas_cuotas_urgentes(riesgo, hoy = hoy)
  if (!length(urgentes)) {
    return(vacio("ninguna cuota está por debajo de su meta: no hay a qué brecha atribuir un refuerzo."))
  }
  cfg <- monitoreo_aulas_normalize_config(cfg)
  df <- .marf_marco(plan, responses, cfg)
  if (is.null(df) || !nrow(df)) return(vacio("el estudio todavía no tiene plan de aulas."))
  e <- .marf_estados(df, hoy)
  libre <- e$disponible & df$sample_role != "titular"
  if (!any(libre)) {
    return(vacio("no queda ninguna reserva ni extra sin usar: los refuerzos tendrían que salir de un marco nuevo."))
  }
  caben <- .marf_techo_caben(df, e, cfg)

  out <- list()
  usados <- character(0)
  for (u in urgentes) {
    m <- libre & df$faculty == u$facultad & !(df$operational_code %in% usados)
    if (!any(m)) next
    idx <- which(m)
    aporta <- if (identical(u$sexo, "M")) df$hombres[idx] else df$mujeres[idx]
    # Por lo que aporta a la celda que falta, no por tamaño: un aula grande de
    # mayoría contraria no mueve la cuota que se quiere cerrar.
    idx <- idx[order(-aporta, -df$eligible_n[idx])]
    idx <- utils::head(idx, max(1L, as.integer(por_cuota)))
    for (i in idx) {
      usados <- c(usados, df$operational_code[i])
      out[[length(out) + 1L]] <- list(
        cuota = sprintf("%s · %s", u$facultad,
                        if (identical(u$sexo, "F")) "Mujeres" else "Hombres"),
        facultad = u$facultad, sexo = u$sexo, faltan = u$faltan,
        urgencia_de_la_cuota = u$urgencia,
        por_que_la_cuota = u$por_que,
        admite_refuerzo = isTRUE(u$admite_refuerzo),
        codigo = df$operational_code[i], rol = df$sample_role[i],
        curso = df$course_name[i], docente = df$teacher[i],
        correo = df$teacher_email[i], horario = df$schedule[i],
        elegibles = as.integer(df$eligible_n[i]),
        aporta = as.integer(if (identical(u$sexo, "M")) df$hombres[i] else df$mujeres[i]),
        hombres = as.integer(df$hombres[i]), mujeres = as.integer(df$mujeres[i])
      )
    }
  }
  if (!length(out)) {
    return(vacio("las cuotas cortas no tienen ninguna reserva libre en su propia facultad."))
  }
  for (i in seq_along(out)) {
    out[[i]]$orden <- i
    out[[i]]$dentro_del_techo <- if (is.na(caben)) NA else i <= caben
  }
  list(ok = TRUE, motivo = "", hoy = as.character(hoy), caben = caben, candidatos = out)
}

#' Qué fue de cada curso-horario del diseño original.
#'
#' Ocho destinos, y la frontera que importa es la de en medio: `resueltas` ya
#' recogieron —ellas o su reemplazo—, `en_camino` tienen fecha y `sin_resolver`
#' no tienen por dónde. Un titular aplicado que ADEMÁS recibió refuerzo se
#' cuenta aparte: es aula gastada sobre una cadena que ya había rendido.
#' @keywords internal
.marf_embudo <- function(df, e, cadena) {
  tit <- which(df$sample_role == "titular")
  destino <- vapply(tit, function(i) {
    c <- df$operational_code[i]
    hijos <- which(cadena == c & df$sample_role == "chain_reserve")
    if (isTRUE(e$aplicada[i])) {
      return(if (any(e$aplicada[hijos])) "aplicada_y_reforzada" else "aplicada")
    }
    if (any(e$aplicada[hijos])) return("reemplazada_y_aplicada")
    if (isTRUE(e$agendada[i])) return("ella_agendada")
    if (any(e$agendada[hijos])) return("reemplazo_agendado")
    if (isTRUE(e$vencida[i])) return("cita_vencida")
    if (isTRUE(e$caida[i])) return("caida_sin_reemplazo")
    "sin_agendar"
  }, character(1))
  n <- function(k) as.integer(sum(destino == k))
  resueltas <- n("aplicada") + n("aplicada_y_reforzada") + n("reemplazada_y_aplicada")
  en_camino <- n("ella_agendada") + n("reemplazo_agendado")
  reservas <- which((e$aplicada | e$agendada) & df$sample_role == "chain_reserve")
  extras <- which((e$aplicada | e$agendada) & df$sample_role == "extra_reserve_pool")
  list(
    titulares = length(tit),
    aplicada = n("aplicada"),
    aplicada_y_reforzada = n("aplicada_y_reforzada"),
    reemplazada_y_aplicada = n("reemplazada_y_aplicada"),
    ella_agendada = n("ella_agendada"),
    reemplazo_agendado = n("reemplazo_agendado"),
    cita_vencida = n("cita_vencida"),
    sin_agendar = n("sin_agendar"),
    caida_sin_reemplazo = n("caida_sin_reemplazo"),
    resueltas = resueltas, en_camino = en_camino,
    sin_resolver = length(tit) - resueltas - en_camino,
    adicionales = list(
      total = length(reservas) + length(extras),
      reservas = length(reservas), extras = length(extras),
      # La distinción que se pedía: sustituir a alguien caído no es lo mismo
      # que entrar sin que cayera nadie.
      sustituyen = n("reemplazada_y_aplicada") + n("reemplazo_agendado"),
      refuerzo = as.integer(length(reservas) + length(extras) -
                              n("reemplazada_y_aplicada") - n("reemplazo_agendado"))
    )
  )
}

#' Cuántos refuerzos caben todavía bajo el techo declarado.
#'
#' Extraído para que el conteo del techo tenga UN solo cuerpo: lo usan el
#' seguimiento y la lista de candidatos, y dos copias acabarían discrepando en
#' el detalle que más cuesta —las citas huérfanas, que no consumen techo—.
#' @keywords internal
.marf_techo_caben <- function(df, e, cfg) {
  techo <- .marf_techo(cfg)
  if (techo <= 0) return(NA_integer_)
  cadena <- ifelse(nzchar(df$titular_operational_code), df$titular_operational_code,
                   df$operational_code)
  huerfana <- e$agendada & cadena %in% unique(cadena[e$aplicada]) &
    df$sample_role != "extra_reserve_pool"
  as.integer(techo - sum(e$aplicada) - sum(e$agendada & !huerfana))
}

# ---------------------------------------------------------------------------
# Sellar la procedencia al agendar: que un refuerzo siga constando como tal.
#
# Gonzalo, 2026-09-18: «Que los refuerzos se mantengan guardados en pulso»; y
# antes, describiendo lo que pasaba: «el sheets los marco de morados y muchos se
# agendaron entonces ya no estuvieron marcados como refuerzo».
#
# **Lo que faltaba no era la capacidad.** `monitoreo_aulas_marcar_refuerzo()`
# existe desde el 11/09 y escribe los cuatro campos. Lo que pasa es que casi
# nadie pasa por ella: medido el 2026-09-18 sobre HSVG26ULT2, de las 15 aulas
# que entraron como refuerzo **una sola** tiene `activation_origin`. Las otras
# catorce se agendaron directo, y al agendarse su `sample_status` pasó a
# `agendada` —perdiendo el morado de `refuerzo_por_contactar`— sin que nada
# dejara constancia de por qué estaban ahí.
#
# **Activar una reserva cuyo titular no ha caído ES un refuerzo**, y eso la app
# lo sabe en el momento de agendar. Sellarlo entonces es registrar un hecho,
# no adivinarlo después.
#
# **Lo inferido se marca como inferido, y sin letra.** El sello dice
# `adicional_inferido`: consta que el aula entró de más, no cuál de los dos
# motivos. Entre completar un curso-horario (B) y reforzar una facultad (C) sólo
# decide quien la eligió, así que ponerle letra sería inventarla. El seguimiento
# separa los grados en `procedencia_fuente`.
#
# Es IDEMPOTENTE y no pisa: una fila que ya trae origen se queda como está.
# Por eso la primera pasada también repara las catorce de atrás.

# «Adicional», no «refuerzo»: el sello dice lo ÚNICO que consta —que no es
# un reemplazo por rechazo—. Llamarlo refuerzo prometería la letra C, y
# entre B y C no hay evidencia que elegir.
.MARF_ORIGEN_INFERIDO <- "adicional_inferido"

#' La letra del caso, o vacía cuando nadie la declaró.
#'
#' `adicional` NO tiene letra a propósito: es «no es A, y entre B y C sólo lo
#' sabe quien la eligió».
#' @keywords internal
.marf_caso <- function(clase) {
  switch(clase %||% "", reemplazo = "A", complemento = "B", refuerzo = "C", "")
}

#' Deja constancia de por qué entró cada aula no titular que ya está en juego.
#'
#' @param plan filas del plan (crudo o normalizado).
#' @param ahora sello de tiempo; por defecto el del sistema.
#' @param hoy fecha de referencia para decidir qué está en juego.
#' @return `{plan, selladas, codigos}`. `selladas = 0` cuando no había nada que
#'   sellar, que es lo normal en cuanto el plan ya pasó una vez por aquí.
#' @export
monitoreo_aulas_sellar_procedencia <- function(plan = list(), ahora = NULL,
                                               hoy = Sys.Date()) {
  filas <- plan %||% list()
  if (!length(filas)) return(list(plan = filas, selladas = 0L, codigos = character(0)))
  df <- .marf_marco(filas, NULL, list())
  if (is.null(df) || !nrow(df)) {
    return(list(plan = filas, selladas = 0L, codigos = character(0)))
  }
  e <- .marf_estados(df, hoy)
  ahora <- .monitoreo_scalar(ahora, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  # **Se indexa por las DOS claves, no por una con `%||%`.** `%||%` en R sólo
  # cae por NULL: con `operational_code` presente pero VACÍO, el
  # `classroom_id` no se usaría nunca. La sesión vecina lo midió el mismo día en
  # otro motor —0 de 64 filas casaban por `operational_code` y 63 de 64 por
  # `classroom_id`— y la pantalla decía «64 sin curso-horario identificable».
  #
  # El código operativo se escribe DESPUÉS, así que gana si las dos claves de
  # dos unidades distintas colisionan.
  pos <- list()
  for (k in seq_along(filas)) {
    aula <- .monitoreo_scalar(filas[[k]]$classroom_id, "")
    if (nzchar(aula) && is.null(pos[[aula]])) pos[[aula]] <- k
  }
  for (k in seq_along(filas)) {
    cod <- .monitoreo_scalar(filas[[k]]$operational_code, "")
    if (nzchar(cod)) pos[[cod]] <- k
  }
  selladas <- character(0)
  for (i in which((e$aplicada | e$agendada) & df$sample_role != "titular")) {
    if (nzchar(df$activation_origin[i])) next
    pr <- .marf_procedencia(df, e, i)
    # Sólo lo que NO es un reemplazo por rechazo. Sellar un reemplazo
    # convertiría en decisión deliberada lo que fue la cadena haciendo su
    # trabajo, y sellar una letra que no consta sería inventarla.
    if (!identical(pr$clase, "adicional")) next
    # Las DOS claves en orden, no una u otra: el normalizador INVENTA un
    # `operational_code` cuando la fila no lo trae —una reserva sin código sale
    # como `R 2.1`—, así que un fallback por «está vacío» no se dispara nunca y
    # la fila no se encuentra. Se prueba el código y, si no está en el índice,
    # el aula.
    k <- NULL
    for (clave in c(df$operational_code[i], df$classroom_id[i])) {
      if (!nzchar(clave)) next
      k <- pos[[clave]]
      if (!is.null(k)) break
    }
    if (is.null(k) || is.na(k)) next
    filas[[k]]$activation_origin <- .MARF_ORIGEN_INFERIDO
    filas[[k]]$activation_reason <- pr$detalle
    if (!nzchar(.monitoreo_scalar(filas[[k]]$activated_at, ""))) {
      filas[[k]]$activated_at <- ahora
    }
    if (!nzchar(.monitoreo_scalar(filas[[k]]$activated_for, ""))) {
      filas[[k]]$activated_for <- df$faculty[i]
    }
    selladas <- c(selladas, df$operational_code[i])
  }
  list(plan = filas, selladas = length(selladas), codigos = selladas)
}
