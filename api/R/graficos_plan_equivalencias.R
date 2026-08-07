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
    args <- if (length(grupos) == 1L) {
      bloque_de(filas)
    } else {
      list(modo = "multilista",
           bloques = unname(lapply(grupos, function(idx) bloque_de(filas[idx]))))
    }

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
        grafico = list(graficador = "p_barras_multiapiladas", args = args)
      )
    )
  }

  list(
    declarada = TRUE,
    plan = list(slides = slides),
    fuera = fuera,
    n_diapositivas = length(slides),
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
    coverage = list(),
    warnings = character(0)
  )
}
