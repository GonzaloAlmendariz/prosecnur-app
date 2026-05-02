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
    notas                   = "",
    # ---- Personalización visual avanzada (Dimensiones) ----
    semaforo_modo           = "cortes",    # "cortes" | "gradiente"
    semaforo_red_color      = "#D84B55",   # color del rango bajo
    semaforo_amber_color    = "#E0B44C",   # color del rango medio
    semaforo_green_color    = "#3A9A5B",   # color del rango alto
    semaforo_red_max        = 60L,         # umbral superior del rojo (0-100)
    semaforo_amber_max      = 80L,         # umbral superior del ámbar (red_max-100)
    radar_min               = 0L,          # límite inferior del eje radial (0-95)
    radar_max               = 100L,        # límite superior del eje radial (5-200)
    radar_gridshape         = "linear",    # "linear" (polígono) | "circular"
    radar_modo              = "uno",       # "uno" | "facet" | "alternante"
    radar_animado           = TRUE,        # ordena ejes por score desc + entrada animada
    barras_orientacion      = "horizontal",# "horizontal" | "vertical" | "facet"
    barras_x_min            = 0L,          # 0-90 — límite inferior del eje x
    barras_x_max            = 100L,        # 10-200 — límite superior
    foda_iconos_enabled     = TRUE,
    foda_icon_tint          = "#FFFFFF",
    foda_icon_size          = 1,
    foda_icon_legend        = TRUE,
    foda_score_min          = 0L,
    foda_score_max          = 120L,
    foda_show_total         = TRUE,
    foda_spacing            = 1.15,
    foda_grid_intensity     = 0.42,
    foda_vista              = "conductores",
    foda_views              = list(
      list(
        id = "conductores",
        label = "Conductores",
        variable = "",
        metric_var = "",
        card_mode = "iconos",
        aliases = list(),
        icons = list()
      ),
      list(
        id = "servicios",
        label = "Servicios",
        variable = "servicio",
        metric_var = "idx_indice_general",
        card_mode = "iconos",
        aliases = list(),
        icons = list()
      ),
      list(
        id = "municipios",
        label = "Municipios",
        variable = "distrito",
        metric_var = "idx_indice_general",
        card_mode = "alias",
        aliases = as.list(stats::setNames(
          c("ATE", "RIM", "SJL", "VES", "LE", "EP"),
          c("Ate", "Rimac", "San Juan de Lurigancho", "Villa El Salvador", "La Esperanza", "El Porvenir")
        )),
        icons = list()
      )
    ),
    foda_aliases            = list(
      distrito = as.list(stats::setNames(
        c("ATE", "RIM", "SJL", "VES", "LE", "EP"),
        c("Ate", "Rimac", "San Juan de Lurigancho", "Villa El Salvador", "La Esperanza", "El Porvenir")
      ))
    ),
    foda_service_icons      = list(),
    # ---- Layout y matriz por unidad (Dimensiones) ----
    dim_desglose_layout     = "paginado",  # "paginado" | "apilado"
    matriz_var_color        = "",          # variable que da el color de fondo
    matriz_var_nombre       = "",          # variable opcional de ícono + nombre secundario
    # ---- Overrides de íconos por conductor (axis_label → data-uri) ----
    # Persisten en el .pulso. Si está vacío, el helper R cae al ícono del
    # paquete prosecnur (defaults por dimensión).
    dim_axis_icons          = list()
  )
}

.dashboard_config_with_defaults <- function(config = NULL) {
  out <- utils::modifyList(
    .dashboard_default_config(),
    config %||% list(),
    keep.null = TRUE
  )
  # `foda_views` es una lista ordenada de objetos, no un mapa anidable.
  # `modifyList()` mezcla listas por posición y puede pisar aliases/icons
  # personalizados con los defaults. Si el usuario ya trae vistas, ganan
  # completas sobre la plantilla.
  if (is.list(config) && !is.null(config$foda_views)) {
    out$foda_views <- config$foda_views
  }
  out
}

# ------------------------------------------------------------
# Visibilidad de variables en el dashboard publicado/local.
# `dashboard_curated_secciones()` aplica la curación estructural inicial
# (secciones/variables no aptas). Este segundo filtro aplica la decisión
# del panel Datos: config$dashboard_var_overrides[[var]]$enabled = FALSE.
#
# Las columnas recodificadas suelen llegar como `<var>_recod`; si el
# usuario apaga la variable madre (`p8`), ocultamos también `p8_recod`,
# salvo que exista un override explícito para `p8_recod`.
.dashboard_var_enabled <- function(s, var) {
  if (!is.character(var) || !length(var) || !nzchar(var[1])) return(FALSE)
  var <- as.character(var[1])
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  overrides <- cfg$dashboard_var_overrides %||% list()

  exact <- overrides[[var]]
  if (is.list(exact) && !is.null(exact$enabled)) {
    return(!isFALSE(exact$enabled))
  }

  parent <- sub("_recod$", "", var)
  if (!identical(parent, var)) {
    parent_ov <- overrides[[parent]]
    if (is.list(parent_ov) && !is.null(parent_ov$enabled)) {
      return(!isFALSE(parent_ov$enabled))
    }
  }

  TRUE
}

.dashboard_var_label_override <- function(s, var) {
  if (!is.character(var) || !length(var) || !nzchar(var[1])) return(NULL)
  var <- as.character(var[1])
  cfg <- .dashboard_config_with_defaults(s$dashboard_config)
  overrides <- cfg$dashboard_var_overrides %||% list()
  exact <- overrides[[var]]
  if (is.list(exact) && is.character(exact$label) && nzchar(exact$label)) {
    return(as.character(exact$label))
  }
  parent <- sub("_recod$", "", var)
  if (!identical(parent, var)) {
    parent_ov <- overrides[[parent]]
    if (is.list(parent_ov) && is.character(parent_ov$label) && nzchar(parent_ov$label)) {
      return(as.character(parent_ov$label))
    }
  }
  NULL
}

.dashboard_visible_secciones <- function(s, secs = NULL) {
  s <- .dashboard_ctx(s)
  secs <- secs %||% .dashboard_curated_secciones(s)
  if (!length(secs)) return(secs)
  secs <- lapply(secs, function(vars) {
    vars[vapply(vars, function(v) .dashboard_var_enabled(s, v), logical(1))]
  })
  secs[vapply(secs, length, integer(1)) > 0L]
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
# Catálogo de variables disponibles del dataset agrupadas por sección
# del XLSForm. Usado por el endpoint `/api/dashboard/all-vars` y el
# panel "Datos" del frontend (incluir/excluir + label override).
.dashboard_all_vars_payload <- function(s) {
  s <- .dashboard_ctx(s)
  if (is.null(s$rp_inst) || is.null(s$rp_data)) return(list())
  secs <- .dashboard_curated_secciones(s)
  if (!length(secs)) return(list())
  unname(lapply(names(secs), function(sec_name) {
    vars <- secs[[sec_name]]
    list(
      seccion = as.character(sec_name),
      vars = lapply(vars, function(v) {
        list(
          name = as.character(v),
          label = tryCatch(
            .obtener_label_var(v, s$rp_inst, s$rp_data),
            error = function(e) v
          )
        )
      })
    )
  }))
}

.dashboard_resolver_sm_spec <- function(var_madre, rp_inst, df, s = NULL) {
  cols <- character(0)
  prefix <- paste0(var_madre, ".")
  cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix)),
               names(df), value = TRUE)
  separator <- "."
  if (!length(cols)) {
    prefix2 <- paste0(var_madre, "/")
    cols <- grep(paste0("^", gsub("([\\W])", "\\\\\\1", prefix2)),
                 names(df), value = TRUE)
    if (length(cols)) separator <- "/"
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

  # Recolectar etiquetas y códigos del módulo Codificación. Cuando un
  # usuario codifica respuestas de un select_multiple, el proceso crea
  # columnas dummy adicionales `{var}.recod.N` cuyos labels humanos
  # viven en `s$codif_por_base[[src]]$grupos_recod[[var_madre]]`.
  recod_codes <- character(0)
  recod_labels <- list()
  if (!is.null(s) && is.list(s$codif_por_base)) {
    for (src_name in names(s$codif_por_base)) {
      gr <- s$codif_por_base[[src_name]]$grupos_recod[[var_madre]]
      if (is.list(gr)) {
        for (g in gr) {
          codigo <- as.character(g$codigo %||% "")
          etiqueta <- as.character(g$etiqueta %||% "")
          if (!nzchar(codigo)) next
          if (!(codigo %in% recod_codes)) recod_codes <- c(recod_codes, codigo)
          if (nzchar(etiqueta)) recod_labels[[codigo]] <- etiqueta
        }
      }
    }
  }
  # Fallback: detectar columnas recod por PATRÓN. Cubre datasets que vienen
  # con dummies recodificadas creadas fuera del módulo Codificación de
  # Pulso (KoBo, scripts externos), donde `grupos_recod` está vacío pero
  # las dummies igual existen en data. Patrones soportados sobre el code
  # (parte después de `<var>.` o `<var>/`):
  #   - "recod"            — single dummy recod
  #   - "recod.N"          — N-ésima dummy recod
  #   - "<algo>_recod"     — convención del módulo Codif (parent/code_recod)
  if (length(cols) > 0) {
    code_of <- function(col) substring(col, nchar(var_madre) + nchar(separator) + 1L)
    rx_recod <- "^recod(\\.[0-9]+)?$|_recod$"
    for (col in cols) {
      code <- code_of(col)
      if (grepl(rx_recod, code) && !(code %in% recod_codes)) {
        recod_codes <- c(recod_codes, code)
      }
    }
  }
  has_recod <- length(recod_codes) > 0

  # Decidir qué columnas conservar según el modo configurado por el
  # usuario para esta variable (vive en config$dashboard_var_modes):
  # - "original" → ocultar las dummies recod (default si no hay decisión)
  # - "recod"    → ocultar las dummies originales del XLSForm, usar solo recod
  #
  # Solo se permite UNA versión por variable — no mostramos ambas. La
  # configuración vive en el panel "Datos" del frontend.
  mode_cfg <- "original"
  if (!is.null(s)) {
    cfg <- s$dashboard_config
    vm <- if (is.list(cfg)) cfg$dashboard_var_modes else NULL
    if (is.list(vm) && is.list(vm[[var_madre]])) {
      m <- as.character(vm[[var_madre]]$modo %||% "")
      if (identical(m, "recod")) mode_cfg <- "recod"
    }
  }
  if (has_recod && length(cols) > 0) {
    is_recod_col <- vapply(cols, function(col) {
      code <- substring(col, nchar(var_madre) + nchar(separator) + 1L)
      code %in% recod_codes
    }, logical(1))
    if (identical(mode_cfg, "recod")) {
      cols <- cols[is_recod_col]
      # Mergear etiquetas de codificación al map (sin pisar XLSForm).
      # Fallback "Grupo N" cuando no hay etiqueta humana — mejor que
      # mostrar "recod.1" crudo en la barra.
      for (codigo in recod_codes) {
        if (!is.null(map_code_to_label[[codigo]])) next
        lbl <- recod_labels[[codigo]]
        if (is.null(lbl) || !nzchar(lbl)) {
          m <- regmatches(codigo, regexpr("[0-9]+", codigo))
          lbl <- if (length(m) > 0 && nzchar(m[1])) paste("Grupo", m[1]) else codigo
        }
        map_code_to_label[[codigo]] <- lbl
      }
    } else {
      # "original" (default) → quitamos las dummies recod.
      cols <- cols[!is_recod_col]
    }
  } else if (length(recod_labels) > 0) {
    # Caso edge: hay etiquetas en el catálogo pero no detectamos cols
    # recod (data sin las dummies). Mergeamos etiquetas igual por si
    # algún col viejo aparece más adelante.
    for (codigo in names(recod_labels)) {
      if (is.null(map_code_to_label[[codigo]])) {
        map_code_to_label[[codigo]] <- recod_labels[[codigo]]
      }
    }
  }

  list(cols = cols, map_code_to_label = map_code_to_label, separator = separator)
}
