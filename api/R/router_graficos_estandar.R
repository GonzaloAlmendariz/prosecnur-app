# =============================================================================
# router_graficos_estandar.R — lectura del estándar del recetario para el editor (plan F6 §5)
# =============================================================================
#
# Endpoints de sólo lectura: no tocan la sesión, el plan ni el render. La forma de cada respuesta la arma su engine
# (`graficos_estandar_api.R`); aquí sólo se enruta.

mount_graficos_estandar <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/estandar", wrap_endpoint(function(req, res) {
      # K1: tipos de lámina con sus ranuras en pulgadas, colores y paletas del recetario, tal cual del estándar.
      .graficos_estandar_payload()
    })) |>
    plumber::pr_get("/api/graficos/recetario/ejemplos", wrap_endpoint(function(req, res) {
      # K5: qué tipos y páginas traen ejemplo del recetario (sin las imágenes).
      .recetario_ejemplos_indice()
    })) |>
    plumber::pr_get("/api/graficos/recetario/ejemplo", wrap_endpoint(function(req, res, tipo = NULL, pagina = NULL, clase = NULL,
                                                                              recetario = NULL) {
      # K5: la lámina de ejemplo del recetario por tipo o por página, como imagen embebida con su procedencia.
      .recetario_ejemplo_payload(tipo = tipo, pagina = pagina, clase = clase, recetario = recetario)
    }))
}
