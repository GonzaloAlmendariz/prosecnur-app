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

# ¿La escala de esta diapositiva admite un top-two-box?
#
# La firma es `codigo=etiqueta|codigo=etiqueta|...`, asi que las categorias se
# cuentan por separadores. Con 2 opciones la suma de las dos ultimas es la barra
# entera; con 7 o mas, «las dos mejores» deja de resumir la mitad alta.
.GPE_TOP2BOX_CATEGORIAS <- c(4L, 6L)

.gpe_admite_top2box <- function(firmas) {
  firmas <- as.character(firmas %||% character(0))
  firmas <- unique(firmas[nzchar(firmas)])
  if (length(firmas) != 1L) return(FALSE)
  if (!grepl("=", firmas[1], fixed = TRUE)) return(FALSE)
  n <- length(strsplit(firmas[1], "|", fixed = TRUE)[[1]])
  n >= .GPE_TOP2BOX_CATEGORIAS[1] && n <= .GPE_TOP2BOX_CATEGORIAS[2]
}

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
  # ¿Cuántos públicos toca este conjunto de filas? Es lo que decide la FORMA del
  # gráfico, no un detalle de estilo.
  publicos_de <- function(filas) {
    unique(unlist(lapply(filas, function(f) names(f$variables))))
  }

  bloque_de <- function(filas) {
    # Un solo público: el eje Y es la PREGUNTA, una barra por tema, y el público
    # se dice una vez en el pie. Repetir «Administrativos» en las siete barras no
    # informa nada —el pie ya dice «Base: 15 administrativos»— y obliga a meter el
    # tema en un canal lateral, que es donde se apilaban unos sobre otros.
    #
    # El canal del tema solo existe cuando hay VARIOS públicos: ahí sí hacen falta
    # las dos dimensiones, tema y actor, y cada una necesita su sitio.
    if (length(publicos_de(filas)) == 1L) {
      refs <- vapply(filas, function(f) {
        b <- names(f$variables)[1]
        .gpe_ref(b, f$variables[[b]])
      }, character(1))
      return(list(modo = "var", vars = as.list(unname(refs))))
    }

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
    # El estilo se declara por bloque, como el corte: dice COMO se lee ese
    # bloque. Una bateria de perfil se presenta con lineas y una de diagnostico
    # con la grilla a la vista, y las dos conviven en el mismo mazo. Una clave
    # que el motor no conozca cae a `comparativo` en vez de abortar el mazo.
    estilo_de <- function(idx) {
      est <- vapply(filas[idx], function(f) tolower(trimws(as.character(f$estilo %||% ""))), character(1))
      est <- est[nzchar(est)]
      if (!length(est)) return("comparativo")
      if (is.null(.RADAR_MB_ESTILOS[[est[1]]])) "comparativo" else est[1]
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
      # El eje arranca en 50 y no en 0. Un indicador de acuerdo o satisfaccion
      # vive en la mitad alta —el perfil de egreso medido va de 90 % a 98 %— y
      # de 0 a 100 las tres series se dibujan una encima de otra. El piso NO
      # miente: si algun tema cae por debajo, `.radar_mb_piso()` lo baja solo y
      # lo dice.
      list(modo = "publicos", vars = ejes_radar(filas), corte = corte,
           corte_etiqueta = .gpe_etiqueta_corte(filas, inst_por_base, corte),
           estilo = estilo_de(seq_along(filas)), mostrar_tabla = TRUE, eje_min = 50)
    } else if (length(grupos) == 1L) {
      bloque_de(filas)
    } else {
      list(modo = "multilista",
           bloques = unname(lapply(grupos, function(idx) bloque_de(filas[idx]))))
    }
    graficador <- if (radar_ok) "p_radar" else "p_barras_multiapiladas"

    # El canal del tema y su envoltura, dimensionados para lo que la matriz pone
    # ahi de verdad.
    #
    # Los defectos del motor —13 % de ancho y envoltura a ~18 caracteres— estan
    # pensados para nombres cortos de bloque. Aqui el nombre del bloque es la
    # etiqueta estandar, que en el estudio medido pasa de 100 caracteres: a 18
    # columnas son siete lineas por tema, y tres bloques seguidos se escribian
    # unos sobre otros. Con el canal mas ancho el mismo texto cabe en la mitad de
    # lineas y no hay que recortarlo.
    #
    # `wrap_y` sube con el: el motor deriva la envoltura del titulo de bloque de
    # ese valor. En estas laminas el eje Y son nombres de publico —«Docentes»,
    # «Egresados»—, asi que subirlo no los toca.
    if (!radar_ok) {
      # Con un solo publico el texto largo esta en el EJE Y —es la pregunta— y no
      # en el canal del tema, que ni siquiera existe. Cada canal se ensancha en su
      # caso y no en el otro: darle 22 % al canal del tema en una lamina que no lo
      # usa solo empuja las barras a la derecha.
      ancho <- if (identical(args$modo, "var")) {
        list(canvas_w_etiquetas = 0.34, wrap_y = 62)
      } else {
        # Los defectos del motor —13 % de ancho y envoltura a ~18 caracteres—
        # estan pensados para nombres cortos de bloque. Aqui el nombre del bloque
        # es la etiqueta estandar, que en el estudio medido pasa de 100
        # caracteres: a 18 columnas son siete lineas por tema, y tres bloques
        # seguidos se escribian unos sobre otros. `wrap_y` sube con el canal
        # porque el motor deriva de ahi la envoltura del titulo de bloque; en
        # estas laminas el eje Y son nombres de publico y no los toca.
        list(canvas_w_grupo = 0.22, wrap_y = 90)
      }
      args$overrides <- utils::modifyList(ancho, as.list(args$overrides %||% list()))

      # Top-two-box encendido cuando la escala lo admite.
      #
      # La barra extra ya salia de fabrica, pero con preset «ninguno»: una
      # columna estrecha con una cifra diminuta, sin titulo y sin color. Eso no
      # es una opcion apagada, es una opcion a medias — ocupa el sitio y no dice
      # nada. El top-two-box es lo que de verdad se usa, asi que es el defecto.
      #
      # Solo de 4 a 6 categorias: con 2 (Si/No) la suma de las dos ultimas es la
      # barra entera, y con 7 o mas «las dos mejores» deja de ser un resumen
      # honesto de la mitad alta.
      if (.gpe_admite_top2box(firma_fila)) {
        args$top2box <- TRUE
      }
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
