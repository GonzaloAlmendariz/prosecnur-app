# El mazo comparativo derivado de la declaración (ADR 0063)
# =========================================================
#
# La declaración del ADR 0062 dice qué pregunta de un público equivale a cuál de
# otro y a qué lámina va. Este archivo la convierte en una PROPUESTA de plan.
#
# Propuesta, no plan: no persiste nada. Un plan que se regenera solo destruye las
# ediciones manuales sin dejar rastro, que es la forma más cara de este defecto.
# El ciclo proponer → previsualizar → aplicar ya existe (`plan/sugerido` +
# `SuggestedPlanButton`) y es el que se reusa; un segundo generador en paralelo
# sería peor que uno.
#
# El graficador es `p_barras_multiapiladas`, que es el que
# ya existe para comparar públicos y el mismo de la lámina «prueba 2» del PPT
# entregado. Esa lámina no falló por el graficador: falló por el emparejamiento,
# que hasta el ADR 0062 no tenía dónde vivir.
#
# `var_cruce` y NO `multilista`: en `var_cruce`, `vars` es una lista nombrada de
# bloques con refs `fuente$variable`, que es exactamente la forma que produce la
# declaración. `multilista` exige `bloques` con su propio submodo y aborta con
# «`bloques` debe ser una lista no vacia». Lo descubrió el PPT real, no los
# tests: fijaban la forma que yo construía en vez de la que el motor acepta.

# Referencia de variable que entiende Gráficos: `base$variable`.
.gpe_ref <- function(base, var) paste0(base, "$", var)

# Orden declarado de las láminas. Numérico cuando se puede: como texto, «10»
# ordena antes que «2» y el mazo saldría en un orden que nadie pidió.
.gpe_orden_laminas <- function(claves) {
  num <- suppressWarnings(as.numeric(claves))
  claves[order(is.na(num), num, claves)]
}

#' Propuesta de mazo a partir de la equivalencia declarada.
#'
#' Devuelve `list(declarada, plan, fuera, n_laminas)`. `fuera` lleva lo que no
#' entró y por qué: un mazo más corto de lo esperado sin explicación se lee como
#' un fallo del generador, no como una decisión del analista.
#' @noRd
.graficos_plan_desde_equivalencias <- function(sid) {
  s <- session_get(sid, required = FALSE)
  equiv <- (s %||% list())$equivalencias_publicos
  vacio <- list(declarada = FALSE, plan = list(slides = list()),
                fuera = list(), n_laminas = 0L)
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

  # 1) Filtrar y agrupar por lámina, conservando el orden de las filas.
  por_lamina <- list()
  for (fila in equiv$filas) {
    vars <- fila$variables %||% list()
    if (!length(vars)) {
      anota_fuera(fila, "sin_variables")
      next
    }
    lamina <- trimws(as.character(fila$diapositiva %||% ""))
    if (!nzchar(lamina)) {
      # No asignar lámina es una decisión, no un olvido que la app deba
      # completar: rellenarla produciría láminas que nadie pidió.
      anota_fuera(fila, "sin_lamina")
      next
    }

    # Una pregunta cuyos públicos no comparten escala no se grafica. El guard de
    # multi-apiladas opera POR TEMA, así que este es exactamente su grano: dos
    # temas de escalas distintas conviven en una lámina, pero un tema con dos
    # escalas es un defecto de la declaración o del instrumento.
    firmas <- vapply(names(vars), function(b) {
      inst <- inst_por_base[[b]]
      if (is.null(inst) || !exists(".equiv_firma_escala", mode = "function")) return("")
      .equiv_firma_escala(inst, vars[[b]])
    }, character(1))
    firmas <- firmas[nzchar(firmas)]
    if (length(unique(firmas)) > 1L) {
      anota_fuera(fila, "escala_divergente",
                  paste(unique(firmas), collapse = " || "))
      next
    }

    por_lamina[[lamina]] <- c(por_lamina[[lamina]] %||% list(), list(fila))
  }

  if (!length(por_lamina)) {
    return(list(declarada = TRUE, plan = list(slides = list()),
                fuera = fuera, n_laminas = 0L))
  }

  # 2) Una lámina por clave declarada; un tema por pregunta.
  #
  # El agrupamiento por escala NO es cosmético. En `modo = "var_cruce"` el motor
  # comprueba la escala sobre TODAS las refs de la lámina, aplanando los temas
  # —el validador del frontend la comprueba por tema, y ahí es donde los dos
  # discrepan—. Una lámina que junta género (3 categorías) con una de Sí/No
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
  for (lamina in .gpe_orden_laminas(names(por_lamina))) {
    filas <- por_lamina[[lamina]]

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

    slides[[length(slides) + 1L]] <- list(
      id = paste0("s-equiv-", lamina),
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "",
        grafico = list(graficador = "p_barras_multiapiladas", args = args)
      )
    )
  }

  list(
    declarada = TRUE,
    plan = list(slides = slides),
    fuera = fuera,
    n_laminas = length(slides)
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
    n_laminas = derivado$n_laminas,
    # Lo que no entro viaja con su motivo: un mazo mas corto de lo esperado sin
    # explicacion se lee como un fallo del generador.
    fuera = derivado$fuera,
    coverage = list(),
    warnings = character(0)
  )
}
