# Contrato: el `default` que la UI muestra para un switch de preset tiene que
# ser el que se va a usar al renderizar.
#
# Hay tres capas de default y hasta 2026-08-03 no estaban conciliadas:
#
#   1. la firma del graficador  (`mostrar_leyenda = TRUE`)
#   2. `.PRESETS_DEFAULT_PULSO` (el criterio editorial de la casa: FALSE)
#   3. el `default` del metadata (lo único que ve el analista en el switch)
#
# La capa 2 sólo se aplicaba al CREAR la config del proyecto, así que a la hora
# de renderizar una clave ausente caía a la capa 1 — y la casa opina distinto
# del motor en 56 de 136 claves comparables. Quién ganaba dependía de un
# accidente: un preset parcial, o el botón «Valor por defecto» (que borra el
# preset entero), devolvían el criterio del motor y no el de Pulso.
#
# `.enriquecer_presets` aplica ahora `.PRESETS_DEFAULT_PULSO` como suelo en
# cada render, así que el default EFECTIVO de una clave es el de la casa cuando
# lo define y el del motor cuando no. Este contrato exige que el metadata
# declare ese valor y no otro: es presentación, sigue al render, nunca al revés.

.presets_fn_por_tipo <- c(
  barras_apiladas    = "graficar_barras_apiladas",
  barras_agrupadas   = "graficar_barras_agrupadas",
  barras_categoricas = "graficar_barras_categoricas",
  barras_numericas   = "graficar_barras_numericas",
  pie                = "graficar_pie_dicotomico",
  donut              = "graficar_pie_dicotomico",
  radar_tabla        = "graficar_radar_tabla",
  media_rango        = "graficar_media_rango",
  boxplot            = "graficar_boxplot",
  nube_palabras      = "graficar_nube_palabras",
  histograma         = "graficar_histograma"
)

.preset_default_efectivo <- function(tipo, arg, formales) {
  casa <- .PRESETS_DEFAULT_PULSO[[tipo]] %||% list()
  if (arg %in% names(casa) && is.logical(casa[[arg]]) && length(casa[[arg]]) == 1L) {
    return(list(valor = isTRUE(casa[[arg]]), origen = "pulso"))
  }
  motor <- tryCatch(eval(formales[[arg]]), error = function(e) NA)
  list(valor = isTRUE(motor), origen = "motor")
}

.presets_bool_divergencias <- function() {
  out <- character(0)
  for (tipo in names(.presets_fn_por_tipo)) {
    fname <- unname(.presets_fn_por_tipo[tipo])
    if (is.na(fname) || !exists(fname)) next
    formales <- formals(get(fname))
    for (arg in .PRESETS_META[[tipo]]$args %||% list()) {
      if (!identical(arg$tipo_input, "bool")) next
      nombre <- as.character(arg$name)
      if (!nombre %in% names(formales)) next
      motor <- tryCatch(eval(formales[[nombre]]), error = function(e) NA)
      if (!is.logical(motor) || length(motor) != 1L) next
      efectivo <- .preset_default_efectivo(tipo, nombre, formales)
      # Sin `default` declarado, la UI dibuja el switch en "No".
      if (!identical(isTRUE(arg$default), efectivo$valor)) {
        out <- c(out, sprintf(
          "%s$%s: la UI muestra %s y al renderizar vale %s (según %s)",
          tipo, nombre, isTRUE(arg$default), efectivo$valor, efectivo$origen
        ))
      }
    }
  }
  out
}

test_that("cada bool de presets declara el default con el que se va a renderizar", {
  divergencias <- .presets_bool_divergencias()
  expect_identical(
    divergencias,
    character(0),
    info = paste0(
      "Switches que mienten sobre lo que se va a renderizar:\n  - ",
      paste(divergencias, collapse = "\n  - ")
    )
  )
})

test_that(".enriquecer_presets aplica el criterio de la casa cuando el proyecto no lo dice", {
  # Proyecto sin preset alguno (el estado tras «Valor por defecto»).
  # El criterio de la casa para mostrar_leyenda cambió a TRUE en P9 del GOAL
  # loop del motor PPT: con cruce la leyenda es imprescindible y la serie
  # única sintética se auto-oculta en el graficador.
  vacio <- .enriquecer_presets(list())
  expect_true(isTRUE(vacio$barras_agrupadas$mostrar_leyenda))
  expect_true(isTRUE(vacio$barras_categoricas$mostrar_frecuencia))

  # Preset parcial: lo que el proyecto declara manda; el resto hereda de Pulso.
  parcial <- .enriquecer_presets(list(barras_agrupadas = list(grosor_barras = 1)))
  expect_identical(parcial$barras_agrupadas$grosor_barras, 1)
  expect_true(isTRUE(parcial$barras_agrupadas$mostrar_leyenda))

  # Y una decisión explícita del analista no se pisa con el default de la casa.
  explicito <- .enriquecer_presets(list(barras_agrupadas = list(mostrar_leyenda = FALSE)))
  expect_false(isTRUE(explicito$barras_agrupadas$mostrar_leyenda))
})

test_that("el estilo común del proyecto sigue mandando sobre el suelo de la casa", {
  # El motor hereda `base$args` hacia cada tipo, así que un suelo que rellene
  # el tipo con todas las claves de fábrica dejaría sin efecto el estilo común
  # del analista justo en las que se solapan. La jerarquía es
  # motor → Pulso → base del proyecto → tipo del proyecto → override del slide.
  solapadas <- intersect(
    names(.PRESETS_DEFAULT_PULSO$base),
    names(.PRESETS_DEFAULT_PULSO$barras_apiladas)
  )
  expect_true(length(solapadas) > 0)  # si deja de haber solape, el guard sobra

  clave <- solapadas[[1]]
  enriquecido <- .enriquecer_presets(list(base = stats::setNames(list(99), clave)))
  # La clave no debe venir precocinada en el tipo: así el `base` del proyecto
  # es el que llega al graficador.
  expect_false(clave %in% names(enriquecido$barras_apiladas))

  # Pero declararla en el tipo sí gana sobre el estilo común.
  con_tipo <- .enriquecer_presets(list(
    base = stats::setNames(list(99), clave),
    barras_apiladas = stats::setNames(list(11), clave)
  ))
  expect_identical(con_tipo$barras_apiladas[[clave]], 11)
})
