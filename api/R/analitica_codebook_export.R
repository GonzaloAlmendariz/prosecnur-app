# Export del libro de códigos del estudio (endpoint /api/analitica/codebook).
#
# Este archivo concentra la lógica de render por formato para mantener el
# router delgado. Lo consume `run_report_multibase()`, que corre la función
# devuelta una vez por base.

# Devuelve la función single-base de render del libro de códigos para el
# `formato` pedido ("xlsx" | "pdf"). Ambos formatos parten del MISMO `data_out`
# (mismas exclusiones, etiquetas y orden de dummies), garantizando que el PDF y
# el XLSX documenten exactamente las mismas variables.
#
# - XLSX (`reporte_codebook`): el libro de códigos es un entregable en sí mismo
#   y la ficha técnica tiene su propio botón; por eso NO se embebe la ficha
#   (`ficha_tecnica = FALSE`). Antes se colaba una 2ª hoja "tras bambalinas".
# - PDF (`reporte_codebook_pdf`): título/subtítulo/período se toman de
#   `cfg$codebook$*_pdf`, igual que en el panel multibase.
# Variables de metadata/control operativo del formulario (consentimiento, QA
# "¿es prueba?", disponibilidad del respondiente…) que no son análisis. Reusa el
# mismo clasificador que el auto-plan de Gráficos para que el libro de códigos
# quede CONSISTENTE con el PPT: si no se grafican, tampoco se documentan.
.analitica_operational_metadata_vars <- function(inst) {
  if (!exists(".graficos_is_operational_metadata", mode = "function")) return(character(0))
  vl <- (inst %||% list())$var_labels
  nms <- names(vl %||% character(0))
  if (!length(nms)) return(character(0))
  hit <- vapply(seq_along(nms), function(i) {
    isTRUE(.graficos_is_operational_metadata(nms[[i]], as.character(vl[[i]] %||% "")))
  }, logical(1))
  nms[hit]
}

.analitica_codebook_render_fn <- function(cfg, formato, codes, numericas_arg, excluidas,
                                          sid = NULL) {
  cb_cfg <- cfg$codebook %||% list()
  codigos <- if (length(codes) > 0L) codes else NULL

  function(rp_data, rp_inst, out_path) {
    reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)

    # ADR 0030 Fase 4: ambos formatos comparten el mismo modelo por roster. El
    # plan se construye ANTES de filtrar: `_index` es necesaria para re-anclar
    # `current_label` desde la hija cruda, y el filtro analítico la elimina.
    grain <- .repeat_grain_from_inst(reviewed$inst)
    if (is.list(grain) && identical(as.character(grain$kind %||% ""), "instancia")) {
      plan <- .repeat_codebook_plan_por_servicio(
        sid, reviewed$data, reviewed$inst, grain
      )
      reviewed$data <- plan$data
      reviewed$inst <- plan$inst
    }
    excluidas_eff <- union(
      as.character(excluidas %||% character(0)),
      .analitica_operational_metadata_vars(reviewed$inst)
    )
    data_out <- .analitica_filter_data(reviewed$data, reviewed$inst, numericas_arg, excluidas_eff)

    if (identical(formato, "pdf")) {
      reporte_codebook_pdf(
        df = data_out,
        output_file = out_path,
        titulo = calc_str(cb_cfg$titulo_pdf, "LIBRO DE CODIGOS"),
        subtitulo = calc_str(cb_cfg$subtitulo_pdf, ""),
        ord = (attr(data_out, "instrumento_reporte", exact = TRUE) %||% list())$orders_list,
        codigos_solo_si_presentes = codigos,
        periodo = calc_str(cb_cfg$periodo_pdf, ""),
        incluir_indice = FALSE  # el libro de códigos va directo al contenido, sin índice
      )
    } else {
      reporte_codebook(
        data = data_out,
        path_xlsx = out_path,
        codigos_solo_si_presentes = codigos,
        # ARREGLO 3: el libro de códigos NO embebe la ficha técnica.
        ficha_tecnica = FALSE
      )
    }
  }
}
