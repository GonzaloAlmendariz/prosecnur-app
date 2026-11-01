# =============================================================================
# Lo que viaja al publicar un dashboard: LISTA PERMITIDA (ADR 0122 §9)
# =============================================================================
#
# Publicar sube un .pulso al Space público. Antes subía el .pulso ENTERO: la
# lista de encuestadores con nombres y DNI, la disponibilidad de aplicadores,
# la asignación de UMP, el Planner con su equipo, los archivos de files/... Un
# dashboard no lee nada de eso. Aquí se arma el estado a publicar con lo que el
# artefacto público SÍ lee, y nada más: lo que no está en la lista no viaja,
# aunque mañana alguien agregue una clave nueva con datos personales.
#
# Qué lee el dashboard público (router_dashboard.R, dashboard_*.R, el
# descriptor /api/public/artifact y /api/session/state), verificado con la
# paridad de respuestas de test-dashboard-publish-permitido.R:
# - la fuente del dashboard (`dashboard_source`) y SUS DOS archivos en files/
#   (instrumento y base): los cachés `dashboard_rp_*` se reconstruyen de ahí;
# - su configuración y curación (`dashboard_config`, `dashboard_curacion`) y
#   las dimensiones si las hay (`dimensiones_config`, `analitica_dim_ok`);
# - las etiquetas del proyecto (`label_overrides`);
# - los grupos de recodificación de Codificación, y sólo eso de cada base
#   (`codif_por_base[[base]]$grupos_recod`);
# - el descriptor y el payload del artefacto (`public_artifact*`);
# - la identidad del estudio (`estudio$nombre` y la del Planner).

.PUBLICACION_CLAVES_DASHBOARD <- c(
  "dashboard_source", "dashboard_config", "dashboard_curacion",
  "dimensiones_config", "analitica_dim_ok", "label_overrides",
  "public_artifact", "public_artifact_payload"
)

# Lo que la propia sesión necesita para existir y guardarse (no es del estudio).
.PUBLICACION_CLAVES_SESION <- c("id", "created_at", "dir", "project_path", "project_dirty", "project_last_saved_at")

.publicacion_archivos_dashboard <- function(s) {
  fuente <- s[["dashboard_source"]] %||% list()
  ids <- unique(c(.planner_chr1(fuente$xlsform_file_id), .planner_chr1(fuente$data_file_id)))
  ids <- ids[nzchar(ids)]
  archivos <- s[["files"]] %||% list()
  archivos[intersect(names(archivos), ids)]
}

#' El estado de sesión que se publica con un dashboard: sólo lo que el
#' artefacto público lee (lista permitida). Lectura pura: devuelve una copia.
#' @keywords internal
.publicacion_estado_dashboard <- function(s) {
  claves <- intersect(c(.PUBLICACION_CLAVES_SESION, .PUBLICACION_CLAVES_DASHBOARD), names(s))
  out <- s[claves]
  out$files <- .publicacion_archivos_dashboard(s)
  # La base viaja podada a lo que el dashboard usa; el instrumento, entero.
  dato_id <- .planner_chr1((s[["dashboard_source"]] %||% list())$data_file_id)
  if (nzchar(dato_id) && !is.null(out$files[[dato_id]])) {
    out$files[[dato_id]] <- .publicacion_base_podada(s, out$files[[dato_id]])
  }
  estudio <- s[["estudio"]] %||% list()
  out$estudio <- list(
    nombre = estudio$nombre %||% NULL,
    processing_mode = estudio$processing_mode %||% "multibase",
    bases = list()
  )
  cpb <- s[["codif_por_base"]]
  if (is.list(cpb) && length(cpb)) {
    out$codif_por_base <- lapply(cpb, function(b) list(grupos_recod = if (is.list(b)) b$grupos_recod else NULL))
  }
  if (!is.null(s[["planner"]])) out$planner <- s[["planner"]]
  .planner_para_publicar(out)
}

# --- La base que viaja: una copia podada a lo que el dashboard usa ------------
#
# La curación oculta variables sólo en la API: el .xlsx de files/ viajaba con
# TODAS sus columnas (en acnur_pdm, Enumerator_name y telephone) y del repo de
# un Space público se descarga entero. Al publicar se reemplaza por una copia
# con sólo lo que el motor lee; la base del proyecto no se toca.
#
# Qué columnas, medido con la paridad de los endpoints públicos
# (test-dashboard-publish-permitido.R), no supuesto:
# - las variables visibles por la curación (.dashboard_curated_secciones) y,
#   de las select_multiple, sus columnas por opción (var/opción, var_opción…);
# - las columnas que nombran la configuración del dashboard, la de dimensiones
#   o los grupos de recodificación (variable madre);
# - las columnas estructurales de una base con repeats (_index, _parent_index…);
# - VACÍAS: las demás columnas «var_algo» de una select_multiple visible
#   (p. ej. reason_edp_other). El motor las lee como una opción más y, si
#   faltan, el resumen pierde esa fila; su contenido (texto libre que puede
#   traer nombres) sólo le sumaba ceros. Viajan sin contenido.
# Todo lo demás se queda: identificación, teléfonos, fechas, textos abiertos.

.PUBLICACION_COLUMNAS_ESTRUCTURALES <- c("_index", "_parent_index", "_parent_table_name", "_submission__id",
                                         "_submission__uuid", "_uuid", "KEY", "PARENT_KEY")

.publicacion_regex_literal <- function(x) gsub("([][{}()+*^$|\\\\?.])", "\\\\\\1", x)

#' Qué columnas de la base del dashboard se publican, con y sin contenido.
#' @keywords internal
.publicacion_columnas_base <- function(s, columnas) {
  ctx <- .dashboard_ctx(s)
  sv <- ctx$rp_inst$survey %||% data.frame(name = character(0), type = character(0))
  ch <- ctx$rp_inst$choices %||% data.frame(list_name = character(0), name = character(0))
  visibles <- unique(unlist(.dashboard_curated_secciones(s)))
  nombradas <- intersect(unique(c(unlist(.dashboard_config_with_defaults(s[["dashboard_config"]])),
                                  unlist(s[["dimensiones_config"]]))), columnas)
  recod <- unlist(lapply(s[["codif_por_base"]] %||% list(), function(b) names(b$grupos_recod)))
  base <- unique(c(visibles, nombradas, recod))
  tipo_de <- function(v) { t <- sv$type[match(v, sv$name)]; if (is.na(t)) "" else as.character(t) }
  multiples <- base[vapply(base, function(v) grepl("^select_multiple", tipo_de(v)), logical(1))]
  opciones <- unlist(lapply(multiples, function(v) {
    lista <- trimws(sub("^select_multiple\\s+", "", tipo_de(v)))
    ops <- as.character(ch$name[ch$list_name == lista])
    unlist(lapply(c("/", "_", ".", ":"), function(sep) paste0(v, sep, ops)))
  }))
  con_datos <- columnas[columnas %in% c(base, opciones, .PUBLICACION_COLUMNAS_ESTRUCTURALES)]
  vacias <- character(0)
  if (length(multiples)) {
    patron <- paste0("^(", paste(.publicacion_regex_literal(multiples), collapse = "|"), ")[/_.:]")
    vacias <- setdiff(columnas[grepl(patron, columnas)], con_datos)
  }
  list(con_datos = con_datos, vacias = vacias)
}

.publicacion_podar_tabla <- function(df, s) {
  cols <- .publicacion_columnas_base(s, names(df))
  out <- as.data.frame(df)[, names(df)[names(df) %in% c(cols$con_datos, cols$vacias)], drop = FALSE]
  for (v in cols$vacias) out[[v]] <- rep(NA_character_, nrow(out))
  out
}

#' Una copia podada del archivo de datos del dashboard (no toca el original).
#' Devuelve la entrada de files/ apuntando a la copia.
#' @keywords internal
.publicacion_base_podada <- function(s, entrada) {
  origen <- as.character(entrada$path %||% "")
  if (!nzchar(origen) || !file.exists(origen)) return(entrada)
  ext <- tolower(as.character(entrada$ext %||% tools::file_ext(origen)))
  destino <- tempfile("publicacion-base-", fileext = paste0(".", ext))
  if (ext %in% c("xlsx", "xls")) {
    hojas <- readxl::excel_sheets(origen)
    libro <- lapply(hojas, function(h) .publicacion_podar_tabla(readxl::read_excel(origen, sheet = h), s))
    names(libro) <- hojas
    if (identical(ext, "xls")) destino <- sub("\\.xls$", ".xlsx", destino)
    openxlsx::write.xlsx(libro, destino)
  } else if (identical(ext, "csv")) {
    utils::write.csv(.publicacion_podar_tabla(readr::read_csv(origen, show_col_types = FALSE, progress = FALSE), s),
                     destino, row.names = FALSE, na = "")
  } else if (identical(ext, "sav")) {
    haven::write_sav(.publicacion_podar_tabla(haven::read_sav(origen), s), destino)
  } else {
    # Un formato que no sabemos podar no se publica entero: mejor fallar.
    stop_api(409, "E_PUBLICACION_BASE_FORMATO",
             "La base del dashboard está en un formato que no se puede preparar para publicar. Vuelve a cargarla en Excel, CSV o SPSS.",
             details = list(ext = ext))
  }
  entrada$path <- destino
  entrada$size <- file.size(destino)
  entrada
}
