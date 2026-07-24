# Orden de los dummies de select_multiple en las fuentes de Gráficos/PPT.
#
# Problema: las columnas dummy `<parent>.<code>` se generan en la codificación en
# un orden arbitrario (p.ej. `legal`, `snm`, `legal_prot_int`, `cepr`, …) y
# `reporte_data()` lo preserva. Analítica lo corrige antes de servir la vista
# "Base final", el libro de códigos y las frecuencias
# (`.analitica_order_sm_dummy_cols`, ver analitica_sm_dummy_order.R), pero
# Gráficos consumía las fuentes crudas: la MISMA variable se leía en dos órdenes
# distintos según el módulo.
#
# Este helper cierra la brecha aplicando el mismo reordenamiento, por base, sobre
# las `data_sources` que alimentan al worker de PPT/Word y al consolidado. Se
# reusa la función de Analítica a propósito: es la definición canónica del orden
# (orden de la lista de opciones del instrumento, con el override del analista
# por encima y los valores especiales [80,100) siempre al final). Duplicarla acá
# garantizaría que los dos módulos volvieran a divergir con el primer cambio.
#
# Contrato: solo PERMUTA columnas — no agrega, quita ni renombra ninguna, y
# preserva los atributos top-level del data.frame (`instrumento_reporte`,
# `var_peso`, …). Es idempotente y no-op cuando la base ya está ordenada, cuando
# el instrumento no declara select_multiple o cuando la función de Analítica no
# está disponible. Cualquier error en una base degrada a "esa base sin reorden",
# nunca rompe el export.
.graficos_order_sm_dummy_sources <- function(src) {
  if (!is.list(src) || !is.list(src$data_sources) || !is.list(src$inst_sources)) {
    return(src)
  }
  if (!exists(".analitica_order_sm_dummy_cols", mode = "function")) return(src)

  common <- intersect(names(src$data_sources), names(src$inst_sources))
  for (nm in common) {
    data <- src$data_sources[[nm]]
    if (!is.data.frame(data) || !ncol(data)) next
    src$data_sources[[nm]] <- tryCatch(
      .analitica_order_sm_dummy_cols(data, src$inst_sources[[nm]]),
      error = function(e) data
    )
  }
  src
}
