# El mazo comparativo derivado de la declaración (ADR 0063)
# =========================================================
#
# La declaración del ADR 0062 dice qué pregunta de un público equivale a cuál de
# otro y a qué diapositiva va. Este archivo la convierte en una PROPUESTA de plan.
#
# Propuesta, no plan: no persiste nada. Un plan que se regenera solo destruye las
# ediciones manuales sin dejar rastro, que es la forma más cara de este defecto.
# El ciclo proponer → previsualizar → aplicar ya existe (`plan/sugerido` +
# `SuggestedPlanButton`) y es el que se reusa; un segundo generador en paralelo
# sería peor que uno.
#
# El graficador es `p_barras_multiapiladas`, que es el que
# ya existe para comparar públicos y el mismo de la diapositiva «prueba 2» del PPT
# entregado. Esa diapositiva no falló por el graficador: falló por el emparejamiento,
# que hasta el ADR 0062 no tenía dónde vivir.
#
# `var_cruce` y NO `multilista`: en `var_cruce`, `vars` es una lista nombrada de
# bloques con refs `fuente$variable`, que es exactamente la forma que produce la
# declaración. `multilista` exige `bloques` con su propio submodo y aborta con
# «`bloques` debe ser una lista no vacia». Lo descubrió el PPT real, no los
# tests: fijaban la forma que yo construía en vez de la que el motor acepta.

# Referencia de variable que entiende Gráficos: `base$variable`.
.gpe_ref <- function(base, var) paste0(base, "$", var)

# Nombre del indicador a partir de sus codigos y de la escala del primer tema. Se
# deriva en vez de declararse: las opciones elegidas ya dicen como se llama.
# Largo maximo del nombre de un tema para ofrecerlo como eje de radar. Es el
# mismo limite que usa el dibujo: declarar el numero aparte dejaria que el mazo
# emitiera radares que el graficador tiene que recortar.
#
# Funcion y no constante porque R carga los archivos en orden alfabetico y este
# se evalua ANTES que `graficos_radar_multibase.R`: una asignacion a nivel de
# archivo no encontraria el valor.
.gpe_max_etiqueta_radar <- function() .RADAR_MB_MAX_ETIQUETA

.gpe_etiqueta_corte <- function(filas, inst_por_base, corte) {
  if (!length(filas) || !exists(".equiv_escala_opciones", mode = "function")) return("")
  f <- filas[[1]]
  b <- names(f$variables)[1]
  inst <- inst_por_base[[b]]
  if (is.null(inst)) return("")
  .radar_mb_etiqueta_corte(corte, .equiv_escala_opciones(inst, f$variables[[b]]))
}

# Orden declarado de las diapositivas. Numérico cuando se puede: como texto, «10»
# ordena antes que «2» y el mazo saldría en un orden que nadie pidió.
.gpe_orden_diapositivas <- function(claves) {
  num <- suppressWarnings(as.numeric(claves))
  claves[order(is.na(num), num, claves)]
}

#' Propuesta de mazo a partir de la equivalencia declarada.
#'
#' Devuelve `list(declarada, plan, fuera, n_diapositivas)`. `fuera` lleva lo que no
#' entró y por qué: un mazo más corto de lo esperado sin explicación se lee como
#' un fallo del generador, no como una decisión del analista.
#' @noRd
.graficos_plan_desde_equivalencias <- function(sid) {
  s <- session_get(sid, required = FALSE)
  equiv <- (s %||% list())$equivalencias_publicos
  vacio <- list(declarada = FALSE, plan = list(slides = list()),
                fuera = list(), n_diapositivas = 0L, revision = "")
  if (is.null(equiv) || !length(equiv$filas %||% list())) return(vacio)

  inst_por_base <- if (exists(".equiv_inst_por_base", mode = "function")) {
    .equiv_inst_por_base(sid)
  } else list()

  fuera <- list()
  anota_fuera <- function(fila, motivo, detalle = "") {
    fuera[[length(fuera) + 1L]] <<- list(
      etiqueta = as.character(fila$etiqueta_estandar %||% ""),
      motivo = motivo,
      detalle = detalle,
      variables = fila$variables %||% list()
    )
  }

  # 1) Filtrar y agrupar por diapositiva, conservando el orden de las filas.
  por_diapositiva <- list()
  for (fila in equiv$filas) {
    vars <- fila$variables %||% list()
    if (!length(vars)) {
      anota_fuera(fila, "sin_variables")
      next
    }
    # ADR 0064: la propuesta se conserva en la declaración pero no llega al mazo
    # hasta que alguien la confirme. Una lámina construida sobre un emparejado
    # que nadie miró es indistinguible de una correcta, que es el modo de fallo
    # que el ADR 0062 vino a cerrar.
    if (isTRUE(fila$sugerida)) {
      anota_fuera(fila, "sin_confirmar")
      next
    }
    diapositiva <- trimws(as.character(fila$diapositiva %||% ""))
    if (!nzchar(diapositiva)) {
      # No asignar diapositiva es una decisión, no un olvido que la app deba
      # completar: rellenarla produciría diapositivas que nadie pidió.
      anota_fuera(fila, "sin_diapositiva")
      next
    }

    # Una pregunta cuyos públicos no comparten escala no se grafica. El guard de
    # multi-apiladas opera POR TEMA, así que este es exactamente su grano: dos
    # temas de escalas distintas conviven en una diapositiva, pero un tema con dos
    # escalas es un defecto de la declaración o del instrumento.
    firmas <- vapply(names(vars), function(b) {
      inst <- inst_por_base[[b]]
      if (is.null(inst) || !exists(".equiv_firma_escala", mode = "function")) return("")
      .equiv_firma_escala(inst, vars[[b]])
    }, character(1))
    firmas <- firmas[nzchar(firmas)]

    # Sólo se grafican las preguntas de opción —única o múltiple—, directamente
    # o vía su recodificada. Medido: la fila de «indique un correo electrónico»
    # entraba al mazo —es texto abierto, pero su firma era homogénea entre
    # públicos y por tanto pasaba el filtro de divergencia— y tumbaba la diapositiva
    # entera con «no comparten una escala compatible», un mensaje que apunta al
    # sitio equivocado: no es que las escalas difieran, es que no hay escala.
    #
    # Esto filtra el MAZO, no la declaración: esa pregunta sigue teniendo
    # etiqueta estándar y sigue siendo equivalente entre públicos.
    graficables <- vapply(names(vars), function(b) {
      inst <- inst_por_base[[b]]
      !is.null(inst) && exists(".equiv_es_graficable", mode = "function") &&
        isTRUE(.equiv_es_graficable(inst, vars[[b]]))
    }, logical(1))
    if (!all(graficables)) {
      anota_fuera(fila, "no_graficable",
                  paste(names(vars)[!graficables], collapse = ", "))
      next
    }

    if (length(unique(firmas)) > 1L) {
      anota_fuera(fila, "escala_divergente",
                  paste(unique(firmas), collapse = " || "))
      next
    }

    por_diapositiva[[diapositiva]] <- c(por_diapositiva[[diapositiva]] %||% list(), list(fila))
  }

  if (!length(por_diapositiva)) {
    return(list(declarada = TRUE, plan = list(slides = list()),
                fuera = fuera, n_diapositivas = 0L,
                revision = .equiv_declaracion_revision(equiv)))
  }

  # 2) Una diapositiva por clave declarada; un tema por pregunta.
  #
  # El agrupamiento por escala NO es cosmético. En `modo = "var_cruce"` el motor
  # comprueba la escala sobre TODAS las refs de la diapositiva, aplanando los temas
  # —el validador del frontend la comprueba por tema, y ahí es donde los dos
  # discrepan—. Una diapositiva que junta género (3 categorías) con una de Sí/No
  # abortaba entera con «las referencias no comparten una escala compatible» y
  # salía como «Sin datos», perdiendo también el tema que sí era graficable.
  #
  # `multilista` existe exactamente para esto: apila bloques de escalas
  # distintas en una sola composición vertical. Un solo grupo sigue usando
  # `var_cruce`, que es más simple y no arrastra la dependencia de cowplot.
  bloque_de <- function(filas) {
    vars_arg <- list()
    titulos <- list()
    for (i in seq_along(filas)) {
      f <- filas[[i]]
      clave <- paste0("tema_", i)
      bases_fila <- names(f$variables)
      vars_arg[[clave]] <- as.list(vapply(
        bases_fila, function(b) .gpe_ref(b, f$variables[[b]]), character(1),
        USE.NAMES = FALSE))
      titulos[[clave]] <- as.character(f$etiqueta_estandar %||% "")
    }
    list(modo = "var_cruce", vars = vars_arg, titulos_grupo = titulos)
  }

  slides <- list()
  radar_pendiente <- list()
  for (diapositiva in .gpe_orden_diapositivas(names(por_diapositiva))) {
    filas <- por_diapositiva[[diapositiva]]

    # Firma de escala de la fila: ya la validamos homogénea entre públicos, así
    # que basta la del primer público para agrupar.
    firma_fila <- vapply(filas, function(f) {
      b <- names(f$variables)[1]
      inst <- inst_por_base[[b]]
      if (is.null(inst) || !exists(".equiv_firma_escala", mode = "function")) return("")
      .equiv_firma_escala(inst, f$variables[[b]])
    }, character(1))

    grupos <- split(seq_along(filas), factor(firma_fila, levels = unique(firma_fila)))

    # ADR 0064: un bloque puede declarar `grafico = radar` con su corte.
    #
    # El radar es de la DIAPOSITIVA, no de un bloque suelto: no se puede apilar
    # una telarana con barras en el mismo lugar. Asi que sale radar cuando la
    # diapositiva tiene UN solo bloque y ese bloque lo pide. Si la diapositiva
    # junta escalas distintas, se queda en barras apiladas y se reporta: dibujar
    # media diapositiva de cada forma seria peor que no aplicar la decision.
    pedido_radar <- function(idx) {
      pedido <- vapply(filas[idx], function(f) {
        tolower(trimws(as.character(f$grafico %||% "")))
      }, character(1))
      any(pedido == "radar")
    }
    corte_de <- function(idx) {
      corte <- vapply(filas[idx], function(f) trimws(as.character(f$corte %||% "")), character(1))
      corte <- corte[nzchar(corte)]
      if (length(corte)) corte[1] else ""
    }

    quiere_radar <- any(vapply(grupos, pedido_radar, logical(1)))
    corte <- corte_de(seq_along(filas))

    # Un vertice no admite una oracion. Medido sobre el estudio: la diapositiva
    # 10 declara siete temas de 91 a 200 caracteres, y el radar salio como una
    # lista de frases sin grafico —las etiquetas se tapaban entre si y sepultaban
    # el poligono—. Cuando el tema necesita una oracion, la forma correcta son
    # las barras, que tienen ancho para leerla.
    etiquetas <- vapply(filas, function(f) as.character(f$etiqueta_estandar %||% ""), character(1))
    etiquetas_ok <- !length(etiquetas) || max(nchar(etiquetas), na.rm = TRUE) <= .gpe_max_etiqueta_radar()

    radar_ok <- quiere_radar && length(grupos) == 1L && nzchar(corte) && etiquetas_ok

    if (quiere_radar && !radar_ok) {
      radar_pendiente[[length(radar_pendiente) + 1L]] <- list(
        diapositiva = diapositiva,
        n_temas = length(filas),
        corte = corte,
        motivo = if (!nzchar(corte)) {
          "sin_indicador"
        } else if (length(grupos) != 1L) {
          "escalas_mixtas"
        } else {
          "etiquetas_largas"
        }
      )
    }

    # En las barras el eje se llama `tema_i` y su titulo viaja aparte en
    # `titulos_grupo`; en el radar el NOMBRE del eje es la etiqueta que se
    # dibuja en el vertice, asi que se arma con ella.
    ejes_radar <- function(filas) {
      out <- list()
      for (i in seq_along(filas)) {
        f <- filas[[i]]
        etiqueta <- trimws(as.character(f$etiqueta_estandar %||% ""))
        if (!nzchar(etiqueta)) etiqueta <- paste("Tema", i)
        # Dos temas con la misma etiqueta colapsarian en un solo vertice: se
        # desambigua en vez de perder uno.
        if (!is.null(out[[etiqueta]])) etiqueta <- paste0(etiqueta, " (", i, ")")
        out[[etiqueta]] <- as.list(vapply(
          names(f$variables), function(b) .gpe_ref(b, f$variables[[b]]),
          character(1), USE.NAMES = FALSE))
      }
      out
    }

    args <- if (radar_ok) {
      # `p_radar` en modo `publicos` y no un graficador aparte: para el analista
      # sigue siendo un radar, y lo unico que cambia es de donde salen las
      # series. El constructor delega en `p_radar_publicos`, que es donde vive el
      # calculo.
      list(modo = "publicos", vars = ejes_radar(filas), corte = corte,
           corte_etiqueta = .gpe_etiqueta_corte(filas, inst_por_base, corte),
           estilo = "comparativo", mostrar_tabla = TRUE)
    } else if (length(grupos) == 1L) {
      bloque_de(filas)
    } else {
      list(modo = "multilista",
           bloques = unname(lapply(grupos, function(idx) bloque_de(filas[idx]))))
    }
    graficador <- if (radar_ok) "p_radar" else "p_barras_multiapiladas"

    # ADR 0064: la diapositiva se titula con su enunciado. En el formato plano el
    # enunciado se escribe por fila —el Excel no tiene dónde poner un atributo de
    # grupo—, así que todas las filas de una diapositiva traen el mismo y se toma el
    # primero no vacío. Sin enunciado el título queda vacío, como hasta ahora: la
    # diapositiva se genera igual, que es lo que el ADR 0063 ya decidía.
    enunciado <- ""
    for (f in filas) {
      e <- trimws(as.character(f$enunciado %||% ""))
      if (nzchar(e)) {
        enunciado <- e
        break
      }
    }

    slides[[length(slides) + 1L]] <- list(
      id = paste0("s-equiv-", diapositiva),
      # Marca de procedencia. El `id` no basta: al aplicar, el editor clona el
      # plan con ids nuevos y `s-equiv-3` entra al lienzo como `sug-a1b2`, con lo
      # que despues de aplicarlo ya no se puede saber cual vino de la matriz.
      # Sin esta marca no hay forma de regenerar el bloque de equivalencias sin
      # tocar las diapositivas hechas a mano.
      origen = "equivalencias",
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = enunciado,
        grafico = list(graficador = graficador, args = args)
      )
    )
  }

  list(
    declarada = TRUE,
    plan = list(slides = slides),
    fuera = fuera,
    n_diapositivas = length(slides),
    # Bloques que pidieron radar y salieron como barras. Se devuelve para que la
    # superficie lo diga: una decision declarada que no se aplica y no se ve es
    # peor que no poder declararla.
    radar_pendiente = radar_pendiente,
    # Viaja con la propuesta para que, al aplicarla, quede grabada junto al plan
    # y el desfase posterior sea comprobable en vez de sospechado.
    revision = .equiv_declaracion_revision(equiv)
  )
}

# Elige la fuente del plan sugerido. Vive aqui y no en el router para que la
# eleccion sea probable sin HTTP y para que `router_graficos.R` siga siendo
# validacion + llamada + serializacion (regla de la casa: routers delgados).
#
# ADR 0063: la declaracion es una fuente MAS de `plan/sugerido`, no un generador
# aparte. Asi la previsualizacion, la validacion y el aplicar siguen siendo los
# que ya existen y estan probados.
.graficos_plan_sugerido_por_fuente <- function(sid, config = NULL) {
  fuente <- tolower(trimws(as.character((config %||% list())$fuente %||% "")[1]))
  if (!identical(fuente, "equivalencias")) {
    return(.graficos_suggested_plan(sid, config = config))
  }
  derivado <- .graficos_plan_desde_equivalencias(sid)
  list(
    ok = TRUE,
    plan = derivado$plan,
    fuente = "equivalencias",
    declarada = derivado$declarada,
    n_diapositivas = derivado$n_diapositivas,
    revision = derivado$revision,
    # Lo que no entro viaja con su motivo: un mazo mas corto de lo esperado sin
    # explicacion se lee como un fallo del generador.
    fuera = derivado$fuera,
    # Bloques que declararon radar y salieron como barras porque el render aun
    # no dibuja una serie por fuente. Viaja para que la superficie lo diga: una
    # decision declarada que no se aplica y no se ve es peor que no poder
    # declararla.
    radar_pendiente = derivado$radar_pendiente %||% list(),
    coverage = list(),
    warnings = character(0)
  )
}
