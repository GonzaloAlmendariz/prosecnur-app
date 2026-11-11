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

# Devuelve la función que prepara, para UNA base, los argumentos con que se llama
# a `reporte_frecuencias()` (todos menos `path_xlsx`): base revisada y ponderada,
# instrumento, secciones, orden, códigos especiales, numéricas, listas ordinales
# y notas al pie. La usan el render del archivo y la vista previa
# (`analitica_frecuencias_preview.R`), así que ambos parten de lo mismo. `sid` es
# necesario para el desglose por servicio de las bases hija repeat (Parte B), que
# re-ancla `current_label` desde la data cruda de la propia hija.
.analitica_frecuencias_args_fn <- function(sid, cfg) {
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
  codes_codebook <- analitica_codigos_especiales_efectivos(.as_int_vec((cfg$codebook %||% list())$codigos_solo_si_presentes))
  excluidas <- .as_chr_vec(cfg$variables_excluidas)
  # Notas al pie (fuente y base por pregunta). Sin bloque `notas` queda
  # «Fuente: Pulso PUCP», como siempre.
  notas <- .notas_pie_normalizar(cfg$notas)

  function(rp_data, rp_inst, base = NULL) {
    reviewed <- .analitica_apply_data_review(rp_data, rp_inst, cfg)
    rp_data <- reviewed$data
    rp_inst <- reviewed$inst
    # Listas ordinales EFECTIVAS de ESTA base (override manual ∪ auto-detección).
    # Fuerzan "original" por variable ordinal.
    ordinal_lists <- .orden_categorias_ordinal_set(rp_inst, cfg)
    # Ponderacion: adjunta `peso` (si esta activa) antes de excluir columnas, para
    # que las variables de calibracion sigan presentes. Con `base` se pondera con
    # la config de ESA base: una hermana sin ponderacion propia no hereda la de
    # la activa (contrato E4-E7, R2).
    cfg_pond <- if (is.null(base)) cfg else .analitica_ponderacion_cfg_base(sid, base, cfg)
    rp_data <- .analitica_ponderacion_apply(rp_data, cfg_pond)
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
    notas_base <- notas
    if (is.list(grain_child) && identical(as.character(grain_child$kind %||% ""), "instancia")) {
      plan <- .repeat_frecuencias_plan_por_servicio(sid, data_out, rp_inst, grain_child)
      data_out <- plan$data
      rp_inst <- plan$inst
      secs <- plan$secciones
      # Sus filas son registros, no encuestados: el texto de base del estudio no la describe (ADR 0128 §4 ter).
      notas_base <- .frecuencias_notas_hija(sid, notas, grain_child)   # analitica_repeats_grano.R
    }
    list(
      data = data_out, instrumento = rp_inst,
      secciones = secs,
      orden = orden,
      mostrar_todo = mostrar_todo,
      incluir_titulos = incluir_titulos,
      incluir_secciones = incluir_secciones,
      codigos_solo_si_presentes = if (length(codes_codebook) > 0L) codes_codebook else NULL,
      numericas = if (length(numericas_arg) > 0L) numericas_arg else NULL,
      ordinal_lists = ordinal_lists,
      fuente = notas$fuente,
      notas = notas_base,
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

# Devuelve la función single-base de render de frecuencias: prepara los
# argumentos con `.analitica_frecuencias_args_fn()` y escribe el XLSX.
.analitica_frecuencias_render_fn <- function(sid, cfg) {
  preparar <- .analitica_frecuencias_args_fn(sid, cfg)

  function(rp_data, rp_inst, out_path, base = NULL) {
    a <- preparar(rp_data, rp_inst, base)
    reporte_frecuencias(
      data = a$data, instrumento = a$instrumento,
      secciones = a$secciones,
      path_xlsx = out_path,
      orden = a$orden,
      mostrar_todo = a$mostrar_todo,
      incluir_titulos = a$incluir_titulos,
      incluir_secciones = a$incluir_secciones,
      codigos_solo_si_presentes = a$codigos_solo_si_presentes,
      numericas = a$numericas,
      ordinal_lists = a$ordinal_lists,
      fuente = a$fuente,
      notas = a$notas,
      ficha_tecnica = a$ficha_tecnica
    )
  }
}
