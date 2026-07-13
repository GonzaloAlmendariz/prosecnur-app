# Export de frecuencias del estudio (endpoint /api/analitica/frecuencias).
#
# Concentra la lógica single-base del render de frecuencias para mantener el
# router delgado y como FUENTE ÚNICA de la tubería (evita que un driver/replica
# se desincronice del path real). Lo consume `run_report_multibase()`, que corre
# la función devuelta una vez por base.
#
# La config (secciones, orden, excluidas, numéricas, codigos_solo_si_presentes)
# se aplica globalmente a TODAS las bases; si una variable de la sección no existe
# en una base, el motor la ignora en esa base (no rompe).

# Devuelve la función single-base de render de frecuencias. `sid` es necesario
# para el desglose por servicio de las bases hija repeat (Parte B), que re-ancla
# `current_label` desde la data cruda de la propia hija.
.analitica_frecuencias_render_fn <- function(sid, cfg) {
  fc <- cfg$frecuencias %||% list()
  activas <- .as_chr_vec(fc$secciones_activas)
  secs_cfg <- .secciones_from_config(cfg, activas_filter = if (length(activas) > 0L) activas else NULL)

  orden <- as.character(fc$orden %||% "desc")
  if (!orden %in% c("desc", "asc", "original")) orden <- "desc"
  # Default TRUE cuando la config NO lo trae seteado (proyecto sin config
  # explícita): muestra la escala completa con 0. Si el usuario lo apagó, su
  # FALSE explícito se respeta.
  mostrar_todo <- if (is.null(fc$mostrar_todo)) TRUE else isTRUE(fc$mostrar_todo)
  # Los títulos de variable/pregunta se conservan siempre. La opción UI solo
  # controla los separadores de sección.
  incluir_titulos <- TRUE
  incluir_secciones <- isTRUE(fc$incluir_secciones %||% TRUE)

  numericas_arg <- .analitica_declared_numericas(cfg, override_frecuencias = TRUE)
  codes_codebook <- .as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes)
  excluidas <- .as_chr_vec(cfg$variables_excluidas)

  function(rp_data, rp_inst, out_path) {
    reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
    rp_data <- reviewed$data
    rp_inst <- reviewed$inst
    # Listas ordinales EFECTIVAS de ESTA base (override manual ∪ auto-detección).
    # Fuerzan "original" por variable ordinal.
    ordinal_lists <- .orden_categorias_ordinal_set(rp_inst, cfg)
    # Ponderacion: adjunta `peso` (si esta activa) antes de excluir columnas, para
    # que las variables de calibracion sigan presentes.
    rp_data <- .analitica_ponderacion_apply(rp_data, cfg)
    data_out <- .excluir_cols(rp_data, excluidas)
    # Secciones: usa las del config si las hay; sino, detecta automáticamente las
    # del instrumento de ESTA base.
    secs <- secs_cfg
    if (is.null(secs)) secs <- .secciones_desde_instrumento(rp_inst)
    secs <- .analitica_filter_sections(secs, rp_inst, numericas_arg, excluidas)
    secs <- .analitica_append_missing_select_multiple_sections(secs, rp_inst, numericas_arg, excluidas)
    # ADR 0030 Fase 4 (PARTES A+B): en una base HIJA repeat el univariado excluye
    # las variables heredadas de la madre (grano persona) y desglosa las `srv_*`
    # nativas POR SERVICIO (`current_label`), evitando el total plano inflado.
    # Fuera de bases hija, el plan queda igual.
    grain_child <- .repeat_grain_from_inst(rp_inst)
    if (is.list(grain_child) && identical(as.character(grain_child$kind %||% ""), "instancia")) {
      plan <- .repeat_frecuencias_plan_por_servicio(sid, data_out, rp_inst, grain_child)
      data_out <- plan$data
      rp_inst <- plan$inst
      secs <- plan$secciones
    }
    reporte_frecuencias(
      data = data_out, instrumento = rp_inst,
      secciones = secs,
      path_xlsx = out_path,
      orden = orden,
      mostrar_todo = mostrar_todo,
      incluir_titulos = incluir_titulos,
      incluir_secciones = incluir_secciones,
      codigos_solo_si_presentes = if (length(codes_codebook) > 0L) codes_codebook else NULL,
      numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL,
      ordinal_lists = ordinal_lists,
      ficha_tecnica = list(
        cfg = cfg,
        instrumento = rp_inst,
        reporte = "Frecuencias",
        detalles = list(
          "Secciones activas" = if (!is.null(secs) && length(names(secs))) paste(names(secs), collapse = ", ") else "Todas las disponibles"
        )
      )
    )
  }
}
