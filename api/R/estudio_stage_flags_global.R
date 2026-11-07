# Marcas de Analítica al reabrir un estudio multibase con config GLOBAL.
#
# Con la config de Analítica por base (hermanas independientes, o multibase con
# topología `separate`/`independent` y más de una base; ADR 0061) cada escritor
# pasa por `.analitica_status_set()`, que mantiene `analitica_status_por_base`
# de la base activa: ese mapa es la verdad y al reabrir se reproyecta.
#
# Con la config GLOBAL no: `.analitica_scoped_base()` es "" y
# `.analitica_status_set()` sólo escribe el espejo escalar (`analitica_dim_ok`,
# `analitica_cruces_ok`, ...); los invalidadores directos
# (`.limpieza_invalidate_downstream()`, el cambio de config de Codificación)
# también tocan sólo el espejo. La entrada por base de la activa la escribe
# únicamente `.estudio_capture_stage_flags()`, y sólo cuando falta la clave, así
# que queda congelada en lo que valía la primera vez que se abrió el proyecto.
# Reproyectarla al reabrir deshacía lo hecho después: en la copia del tablero
# (formato-dashboard-2026-11-04) `analitica_dim_ok` volvía a FALSE con `rp_dim`
# de 426 filas dentro del `.pulso`, y una invalidación posterior resucitaba un
# TRUE viejo.
#
# Por eso se corrige al reabrir y no al escribir: el espejo es lo único que
# todos los escritores mantienen en este modo, y así también se recuperan las
# copias ya guardadas con la foto vieja. Se exceptúan las marcas que el propio
# guardado apaga en el espejo porque sus objetos runtime no viajan: ahí el FALSE
# persistido es un marcador de `.pulso_strip_caches()`, no un hecho, y siguen
# saliendo de la entrada por base como hasta ahora.
.ESTUDIO_ANALITICA_STATUS_KEYS_APAGADAS_AL_GUARDAR <- c("analitica_prep_ok")

# Alinea la entrada por base de `base_nombre` con el espejo global persistido.
# Sólo para config global; con config por base devuelve `s` intacto. Una clave
# sin espejo (proyecto anterior a esa marca) conserva lo que tenga el mapa.
.estudio_stage_flags_espejo_global <- function(sid, s, base_nombre) {
  base_nombre <- as.character(base_nombre %||% "")
  if (!nzchar(base_nombre) || isTRUE(.analitica_config_es_por_base(sid))) return(s)
  if (is.null(s$analitica_status_por_base) || !is.list(s$analitica_status_por_base)) {
    s$analitica_status_por_base <- list()
  }
  ast <- s$analitica_status_por_base[[base_nombre]]
  if (is.null(ast) || !is.list(ast)) ast <- list()
  claves <- setdiff(.ESTUDIO_ANALITICA_STATUS_KEYS, .ESTUDIO_ANALITICA_STATUS_KEYS_APAGADAS_AL_GUARDAR)
  for (key in claves) {
    if (!is.null(s[[key]])) ast[[key]] <- isTRUE(s[[key]])
  }
  s$analitica_status_por_base[[base_nombre]] <- ast
  s
}
