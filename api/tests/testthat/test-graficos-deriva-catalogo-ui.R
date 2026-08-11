source("setup-load-all.R")

# Deriva entre lo que la UI ofrece y lo que el motor puede recibir.
#
# CORRECCION 2026-08-11: la primera version de este archivo resolvia el motor
# como `graficar_<x>` y daba por hecho que era lo que el router llamaba. No lo
# es. Hay DOS capas y el router llama a la primera:
#
#   p_<x>()        constructor de spec del plan. 7-38 formals: var, titulo,
#                  cruces, `overrides`, base, filtros... Es lo que resuelve
#                  `getExportedValue()` en router_graficos.R:402 y contra cuyos
#                  formals filtra `.clean_rebuild_args()` (linea 203).
#   graficar_<x>() el renderer. 17-130 formals. Recibe lo suyo por `overrides`,
#                  que es el canal libre entre ambas capas.
#
# Consecuencias del error: se midieron los formals de la capa equivocada y,
# peor, los 9 graficadores SIN `graficar_*` se saltaban con un `next` mudo —
# el test cubria 15 de 24 diciendo cubrirlos todos. Un test que se salta lo que
# no entiende es exactamente el falso verde que este loop existe para evitar.
#
# Medido sobre el banco de prueba (Conta 10-08, 66 grafs): el plan real no
# guarda NI UN argumento fuera de la firma de su `p_*`, y 42 de los 66 llevan
# `overrides` con contenido. O sea que la UI si anida bien y hoy no hay ningun
# control muerto.

# Los 9 que no tienen renderer separado: su universo ES la firma de `p_*`.
# Declarados a proposito para que no se salten en silencio.
.deriva_sin_renderer <- c(
  "p_barras_multiapiladas", "p_donut", "p_numerico", "p_tabla",
  "p_dim_radar", "p_dim_heatmap", "p_dim_comparativo_radarbar",
  "p_dim_foda", "p_dim_heatmap_criterios"
)

# Args catalogados que no son formals de NINGUNA de las dos capas porque los
# consume el plan al renderizar. Verificado uno por uno:
#   mostrar_significancia / significancia_alpha -> reporte_plan_ppt.R:5114,
#     leidos de `overrides$...` por el propio plan.
#   iter_var / iter_level -> dashboard_dimensiones.R:148.
.deriva_consumidos_por_el_plan <- c(
  "mostrar_significancia", "significancia_alpha", "iter_var", "iter_level"
)

# Nunca van a la UI por diseno: los rellena el plan o son mecanica del export.
.deriva_args_internos <- c(
  "data", "instrumento", "contexto", "overrides", "cols_n", "cols_porcentaje",
  "etiquetas_series", "etiquetas_grupos", "etiquetas_leyenda", "reparto",
  "path_salida", "exportar", "dpi", "ancho", "alto",
  "ppt_append", "ppt_layout", "ppt_master",
  "usar_canvas", "centro_cowplot", "preservar_tamanos_texto"
)

.deriva_renderer <- function(nombre) {
  rn <- sub("^p_", "graficar_", nombre)
  if (exists(rn)) get(rn) else NULL
}

.deriva_args_en_ui <- function() {
  nombres <- function(lista) unique(unlist(lapply(lista, function(x)
    vapply(x$args %||% list(), function(a) as.character(a$name %||% ""), character(1)))))
  unique(c(nombres(.graficos_registry_payload()$graficadores),
           nombres(.presets_metadata_payload()$presets)))
}

test_that("los 24 graficadores del registro resuelven, ninguno se salta", {
  gs <- .graficos_registry_payload()$graficadores
  expect_length(gs, 24L)
  for (g in gs) {
    fn <- tryCatch(getExportedValue("prosecnurapp", g$name), error = function(e) NULL)
    expect_true(is.function(fn), info = sprintf("%s no resuelve como el router lo resuelve", g$name))
  }
  # Y la lista de los que no tienen renderer es exacta: si alguien agrega uno,
  # o le escribe el renderer a otro, este test lo obliga a decirlo.
  reales <- vapply(gs, function(g) is.null(.deriva_renderer(g$name)), logical(1))
  expect_setequal(vapply(gs, function(g) g$name, character(1))[reales], .deriva_sin_renderer)
})

test_that("ningun control de la UI cae en el vacio", {
  # Un arg catalogado que no es formal de ninguna capa ni lo consume el plan
  # se descarta en silencio en router_graficos.R:203: el analista lo mueve y
  # no pasa nada. Es el caso que fundo el criterio 1 del loop.
  for (g in .graficos_registry_payload()$graficadores) {
    fn <- getExportedValue("prosecnurapp", g$name)
    rend <- .deriva_renderer(g$name)
    alcanzable <- c(names(formals(fn)), if (!is.null(rend)) names(formals(rend)),
                    .deriva_consumidos_por_el_plan)
    catalogados <- vapply(g$args %||% list(), function(a) as.character(a$name %||% ""), character(1))
    muertos <- setdiff(catalogados, alcanzable)
    expect_identical(
      muertos, character(0),
      info = sprintf("%s ofrece %s y nadie lo recibe", g$name, paste(muertos, collapse = ", "))
    )
  }
})

test_that("un ajuste anidado en overrides sobrevive y uno al ras se descarta", {
  # El mecanismo del que depende TODO lo anterior. Se prueba aqui y no sobre un
  # proyecto porque el unico .pulso versionado (acrconta) trae 1 lamina y cero
  # grafs: no puede sostener la invariante, y un `skip` la dejaria verde por no
  # mirar. Medido en cambio sobre el banco vivo del loop (Conta 10-08, 66
  # grafs): cero args al ras fuera de la firma, 42 grafs con overrides.
  fn <- getExportedValue("prosecnurapp", "p_barras_apiladas")
  expect_true("overrides" %in% names(formals(fn)))
  expect_false("size_ejes" %in% names(formals(fn)))

  limpio <- .clean_rebuild_args(
    list(var = "P1", overrides = list(size_ejes = 14), size_ejes = 14),
    fn
  )
  # Anidado llega intacto...
  expect_equal(limpio$overrides$size_ejes, 14)
  # ...y al ras lo tira el filtro, sin aviso. Por eso la UI TIENE que anidar.
  expect_null(limpio$size_ejes)
})
