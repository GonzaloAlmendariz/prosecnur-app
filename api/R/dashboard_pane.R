# ============================================================
# Helpers compartidos del módulo Dashboard.
#
# Filosofía: el Dashboard es un RENDERIZADOR FIEL de lo que el paquete
# `prosecnur::reporte_interactivo()` define. Las tabs y el layout no se
# editan desde la UI. Antes de renderizar existe una curaduría inicial
# para excluir campos no aptos (fechas, metadatos, controles); luego el
# frontend solo renderiza lo que el backend declara como dashboard-ready.
#
# Tabs canónicas: resumen, relaciones, base_datos, dimensiones (opcional).
# ============================================================

# ------------------------------------------------------------
# Config persistida del usuario (twitches estéticos).
# Espejo de `interactivo_estetica.R::reporte_interactivo_theme_default()`
# para los 8 colores del tema legacy, pero modelado del lado del store.
.dashboard_default_config <- function() {
  list(
    titulo                  = "Dashboard",
    subtitulo               = "",
    logo_data_uri           = NULL,        # base64 "data:image/png;base64,..."
    logo_alt                = "",
    logo_height_px          = 36L,
    paleta_id               = NULL,        # FK a paletas de Gráficos; NULL = default
    paletas_listas          = list(),      # list_name -> label -> hex
    color_primario_override = NULL,        # hex; si set, sobreescribe primario derivado
    notas                   = ""
  )
}

# Defaults del tema visual — espejo 1:1 de
# `reporte_interactivo_theme_default()` en interactivo_estetica.R:14.
# Se exponen al frontend para que `deriveTheme.ts` parta de los mismos
# valores cuando el usuario no override paleta/primario.
.dashboard_theme_default <- function() {
  list(
    color_primario      = "#002457",
    color_fondo_app     = "#f5f6fa",
    color_borde         = "#e6e9f2",
    color_texto         = "#1f2933",
    color_texto_suave   = "#5f6b7a",
    color_superficie    = "#ffffff",
    color_superficie_2  = "#fafbff",
    color_header_tabla  = "#f1f3f9"
  )
}

# ------------------------------------------------------------
# Manifest — qué tabs están disponibles según los insumos del proyecto.
# La lista de tabs es FIJA (viene del paquete); `available` indica si
# tiene insumos para renderizarse. El frontend deshabilita las que no
# tengan datos.
.dashboard_manifest <- function(s) {
  s <- .dashboard_ctx(s)
  has_data  <- !is.null(s$rp_data) && !is.null(s$rp_inst)
  has_dim   <- isTRUE(s$analitica_dim_ok) && !is.null(s$rp_dim)
  curacion <- .dashboard_curacion_saved(s)
  n_secs <- if (has_data) length(.dashboard_curated_secciones(s)) else 0L

  tabs <- list(
    list(
      id = "resumen",
      label = "Resumen",
      available = has_data && n_secs > 0L,
      reason = if (!has_data) "Carga la base y el instrumento primero."
               else if (n_secs == 0L) "El instrumento no tiene secciones con variables presentes en la base."
               else NA_character_
    ),
    list(
      id = "relaciones",
      label = "Relaciones",
      available = has_data && n_secs > 0L,
      reason = if (!has_data) "Carga la base y el instrumento primero." else NA_character_
    ),
    list(
      id = "base_datos",
      label = "Base de datos",
      available = has_data,
      reason = if (!has_data) "Carga la base primero." else NA_character_
    ),
    list(
      id = "dimensiones",
      label = "Dimensiones",
      available = has_dim,
      reason = if (!has_dim) "Genera dimensiones en Analítica → Dimensiones." else NA_character_
    )
  )

  list(
    tabs = tabs,
    estado = list(
      tiene_data = has_data,
      tiene_dim = has_dim,
      n_secciones = as.integer(n_secs),
      curacion_confirmed = isTRUE(curacion$confirmed)
    )
  )
}

# ------------------------------------------------------------
# Filtros — aplica una lista de filtros activos (sec/var/valores) al
# data frame. Espejo de la lógica `data_filtrada` del legacy
# (interactivo_resumen.R:949). Filtros se evalúan contra el VALOR CRUDO
# (no etiqueta) ya que el frontend manda los `value` del catálogo.
.dashboard_apply_filtros <- function(df, filtros = list()) {
  if (!is.data.frame(df) || !nrow(df)) return(df)
  if (is.null(filtros) || !length(filtros)) return(df)

  for (f in filtros) {
    var <- as.character(f$var %||% "")[1]
    vals <- as.character(unlist(f$valores %||% list()))
    vals <- vals[!is.na(vals) & nzchar(trimws(vals))]
    if (!nzchar(var) || !length(vals) || !(var %in% names(df))) next
    xv <- trimws(as.character(df[[var]]))
    keep <- !is.na(xv) & xv %in% vals
    df <- df[keep, , drop = FALSE]
  }
  df
}

# ------------------------------------------------------------
# Detección de SM "madres" — variables que en el survey son
# `select_multiple` y por tanto vienen expandidas como dummies en data.
# Espejo de la lógica que `reporte_interactivo()` ejecuta al armar el ctx.
.dashboard_sm_madres <- function(rp_inst) {
  sv <- rp_inst$survey
  if (is.null(sv) || !"type" %in% names(sv) || !"name" %in% names(sv)) {
    return(character(0))
  }
  is_sm <- grepl("^select_multiple(\\s|$)", as.character(sv$type %||% ""))
  vars <- as.character(sv$name[is_sm])
  vars[!is.na(vars) & nzchar(vars)]
}

.dashboard_tipo_pregunta <- function(var, rp_inst, df) {
  .interactivo_tipo_pregunta(
    var,
    survey = rp_inst$survey,
    sm_vars_force = .dashboard_sm_madres(rp_inst),
    df = df
  )
}

# Helper utilitario — para SM, devuelve las columnas dummy presentes en
# data y un mapeo code→label desde choices. Espejo de
# `resolver_var_spec` mencionado en interactivo_resumen.R:1322.
.dashboard_resolver_sm_spec <- function(var_madre, rp_inst, df) {
  cols <- character(0)
  prefix <- paste0(var_madre, ".")
  cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix)),
               names(df), value = TRUE)
  if (!length(cols)) {
    prefix2 <- paste0(var_madre, "/")
    cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix2)),
                 names(df), value = TRUE)
  }

  map_code_to_label <- list()
  ch <- rp_inst$choices
  sv <- rp_inst$survey
  if (!is.null(ch) && !is.null(sv) &&
      all(c("name", "list_name") %in% names(sv)) &&
      all(c("name", "list_name") %in% names(ch))) {
    label_col <- if ("label" %in% names(ch)) "label"
                 else grep("^label(::|$)", names(ch), value = TRUE)[1]
    if (!is.null(label_col) && !is.na(label_col) && label_col %in% names(ch)) {
      i <- which(!is.na(sv$name) & sv$name == var_madre)[1]
      if (!is.na(i)) {
        ln <- as.character(sv$list_name[i])
        if (!is.na(ln) && nzchar(ln)) {
          ch_v <- ch[ch$list_name == ln, , drop = FALSE]
          if (nrow(ch_v)) {
            map_code_to_label <- as.list(stats::setNames(
              as.character(ch_v[[label_col]]),
              as.character(ch_v$name)
            ))
          }
        }
      }
    }
  }

  list(cols = cols, map_code_to_label = map_code_to_label)
}
