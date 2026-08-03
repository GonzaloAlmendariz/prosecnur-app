# Firma explícita de los insumos que pueden cambiar una comparación de métodos.
#
# El método configurado se excluye a propósito: la comparación ejecuta todos
# los métodos y elegir uno después no vuelve stale sus métricas. El frame vive
# bajo `frame_hash` y el objetivo bajo `objective_config`; este snapshot cubre
# el resto de decisiones del selector que sí alteran sorteos o diagnósticos.
.cm_aulas_method_comparison_selector_snapshot <- function(selector = list(), objective = list()) {
  if (is.null(selector) || !is.list(selector)) selector <- list()
  list(
    schema = "calc_muestra_aulas_method_comparison_selector_v1",
    seed = .cm_aulas_int(selector$seed, 20260619L),
    n_aulas = max(1L, .cm_aulas_int(selector$n_aulas, 30L)),
    replacement_waves = max(0L, .cm_aulas_int(selector$replacement_waves, 0L)),
    strata_cols = as.list(.cm_aulas_chr_vec(selector$strata_cols)),
    balance_vars = as.list(.cm_aulas_chr_vec(selector$balance_vars)),
    spread_vars = as.list(.cm_aulas_chr_vec(selector$spread_vars)),
    candidate_pool_size = max(1L, .cm_aulas_int(selector$candidate_pool_size, 1L)),
    simulation_runs = max(0L, .cm_aulas_int(selector$simulation_runs, 0L)),
    mos_strategy = .cm_aulas_scalar(selector$mos_strategy, ""),
    coordination_mode = .cm_aulas_scalar(selector$coordination_mode, ""),
    replacement_depth_strategy = .cm_aulas_scalar(selector$replacement_depth_strategy, ""),
    min_replacements_per_titular = max(0L, .cm_aulas_int(selector$min_replacements_per_titular, 0L)),
    max_replacements_per_titular = max(0L, .cm_aulas_int(selector$max_replacements_per_titular, 0L)),
    extra_pool_policy = .cm_aulas_scalar(selector$extra_pool_policy, ""),
    replacement_equivalence_vars = as.list(.cm_aulas_chr_vec(selector$replacement_equivalence_vars)),
    replacement_score_weights = selector$replacement_score_weights %||% list(),
    duplicate_penalty = max(0, .cm_aulas_num(selector$duplicate_penalty, 0)),
    sequential_discount = .cm_aulas_bool(selector$sequential_discount, TRUE),
    pps_weight = max(0, .cm_aulas_num(selector$pps_weight, 0)),
    coverage_weight = max(0, .cm_aulas_num(selector$coverage_weight, 0)),
    monte_carlo_n = max(0L, .cm_aulas_int(selector$monte_carlo_n, 0L)),
    objective = objective %||% list()
  )
}
