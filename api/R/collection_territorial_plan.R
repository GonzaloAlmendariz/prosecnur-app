# collection_territorial_plan.R — el plan de campo y la Hoja del día de la campaña
# territorial salen de la FOTO enviada (P6 del plan conjunto, aprobada por Gonzalo el
# 31 oct), no de la muestra viva de Hojas de ruta. Así lo que Material reparte y
# entrega es lo mismo que recibió, aunque Hojas de ruta vuelva a sortear: si la muestra
# viva cambió, se avisa con `stale` y se reenvía; no se mezcla en silencio.
#
# Usa los mismos motores de Hojas de ruta (hojas_ruta_plan_campo, hoja del día) y los
# supuestos guardados del plan (ui_state$plan_campo) cuando el cuerpo no trae otros.

.mtpl_contexto <- function(sid, campaign_id) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio) || !length(envio[["sample"]]$blocks %||% list())) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_FUENTE", "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla.",
             details = list(id = hit$entry$id, fase = fase))
  }
  guardados <- tryCatch(.hojas_ruta_active_run(sid)$run$ui_state$plan_campo, error = function(e) NULL)
  list(hit = hit, fase = fase, envio = envio, guardados = guardados %||% list(),
       stale = .mcamp_territorial_stale(s, fase, envio))
}

#' Plan de campo de la campaña territorial sobre la foto enviada (lectura pura).
#' @keywords internal
collection_territorial_plan <- function(sid, campaign_id = NULL, supuestos = NULL) {
  ctx <- .mtpl_contexto(sid, campaign_id)
  plan <- hojas_ruta_plan_campo(ctx$envio[["sample"]]$blocks, supuestos %||% ctx$guardados)
  plan$fuente <- "envio"
  plan$sample_fingerprint <- ctx$envio$sample_fingerprint
  plan$stale <- ctx$stale
  plan
}

#' Hoja del día de una jornada del plan, sobre la foto enviada.
#' @keywords internal
collection_territorial_hoja_dia <- function(sid, campaign_id = NULL, jornada = NULL, supuestos = NULL) {
  jornada <- toupper(.mtf_txt(jornada))
  if (!nzchar(jornada)) stop_api(400, "E_BAD_REQUEST", "Falta la jornada (p. ej. «J03»).")
  ctx <- .mtpl_contexto(sid, campaign_id)
  modelo <- hojas_ruta_hoja_dia_modelo(ctx$envio[["sample"]], jornada, supuestos %||% ctx$guardados)
  if (is.null(modelo)) {
    stop_api(404, "E_NOT_FOUND", sprintf("La jornada %s no existe en el plan de campo con estos supuestos.", jornada))
  }
  out <- tempfile(fileext = ".pdf")
  hojas_ruta_hoja_dia_pdf(modelo, out)
  meta <- .hojas_ruta_vp_registrar(sid, "hojas_ruta_hoja_dia", out, original_name = .hojas_ruta_hd_nombre(modelo))
  list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, jornada = modelo$jornada,
       rutas = as.list(vapply(modelo$rutas, `[[`, character(1), "id_manzana")), fuente = "envio", stale = ctx$stale)
}
