# Funciones de soporte para integrar Overture Maps Transportation como
# fuente complementaria a OpenStreetMap en la capa vial de Hojas de Ruta.
#
# Uso esperado:
#   1. `overture_fetch_segments_to_parquet()` baja el slice de Lima+Callao
#      desde S3 vía DuckDB (httpfs + spatial) y lo cachea localmente.
#   2. `overture_load_segments()` lo carga como `sf` en EPSG:4326.
#   3. `merge_osm_overture()` lo integra contra el `sf` de OSM en EPSG:32718,
#      primero por `osm_id` (cuando Overture lo trae) y luego por proximidad
#      geométrica con tolerancia Hausdorff.
#
# Las dependencias `duckdb`/`DBI`/`sf` solo se exigen en build, no en runtime
# del API. Por eso se valida con `requireNamespace()` y se falla con mensajes
# accionables si falta algo.

`%||%` <- function(x, y) if (is.null(x) || length(x) == 0L) y else x

#' Release pinned de Overture Maps Transportation
#'
#' Overture publica releases mensuales con tag `YYYY-MM-DD.0` en
#' `s3://overturemaps-us-west-2/release/`. No expone un endpoint oficial de
#' "latest", así que pineamos explícitamente para reproducibilidad de build.
#' Se puede overridear via `HOJAS_RUTA_OVERTURE_RELEASE`.
#'
#' @return chr release tag (ej. "2026-04-23.0").
#' @export
overture_release_pinned <- function() {
  override <- Sys.getenv("HOJAS_RUTA_OVERTURE_RELEASE", "")
  if (nzchar(override)) return(override)
  "2026-04-15.0"
}

#' URL S3 base para una release de Overture Transportation segments
#' @export
overture_segments_url <- function(release = overture_release_pinned()) {
  sprintf(
    "s3://overturemaps-us-west-2/release/%s/theme=transportation/type=segment/*",
    release
  )
}

#' Bajar segments de Overture para un bbox y cachear como Parquet local
#'
#' Usa DuckDB con extensiones `httpfs` y `spatial`. Filtra por bbox y
#' `subtype = 'road'`. La proyección de origen es EPSG:4326.
#'
#' @param release tag Overture (ej. "2026-04-23.0").
#' @param bbox vector numérico length 4: c(xmin, ymin, xmax, ymax) en WGS84.
#' @param cache_path ruta destino del Parquet local.
#' @param refresh si TRUE, redescarga aunque exista cache.
#' @return ruta del Parquet (cache_path).
#' @export
overture_fetch_segments_to_parquet <- function(release, bbox, cache_path,
                                               refresh = FALSE) {
  for (pkg in c("DBI", "duckdb")) {
    if (!requireNamespace(pkg, quietly = TRUE)) {
      stop(sprintf(
        "Falta el paquete '%s' para descargar Overture. Instalalo con install.packages('%s').",
        pkg, pkg
      ), call. = FALSE)
    }
  }
  stopifnot(is.numeric(bbox), length(bbox) == 4L)
  if (file.exists(cache_path) && !isTRUE(refresh)) {
    message("Overture cache hit: ", cache_path)
    return(cache_path)
  }
  dir.create(dirname(cache_path), recursive = TRUE, showWarnings = FALSE)

  con <- DBI::dbConnect(duckdb::duckdb())
  on.exit(DBI::dbDisconnect(con, shutdown = TRUE), add = TRUE)
  for (ext in c("httpfs", "spatial", "json")) {
    DBI::dbExecute(con, sprintf("INSTALL %s", ext))
    DBI::dbExecute(con, sprintf("LOAD %s", ext))
  }
  DBI::dbExecute(con, "SET s3_region = 'us-west-2'")

  # Mismas clases vehiculares que el pipeline OSM (motorway -> living_street).
  # Excluye footway/cycleway/service/path/steps/pedestrian/track/bridleway/unknown.
  keep_classes <- c(
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "living_street", "unclassified"
  )
  classes_sql <- sprintf("(%s)", paste(sprintf("'%s'", keep_classes), collapse = ", "))

  src <- overture_segments_url(release)
  message("Querying Overture segments from ", src)
  query <- sprintf(
    "COPY (
       SELECT
         id,
         names,
         class,
         subclass,
         subtype,
         road_surface,
         road_flags,
         access_restrictions,
         level_rules,
         speed_limits,
         sources,
         ST_AsWKB(geometry) AS geometry_wkb,
         bbox.xmin AS bbox_xmin,
         bbox.ymin AS bbox_ymin,
         bbox.xmax AS bbox_xmax,
         bbox.ymax AS bbox_ymax
       FROM read_parquet('%s', filename = false, hive_partitioning = 1)
       WHERE subtype = 'road'
         AND class IN %s
         AND bbox.xmin >= %f AND bbox.xmax <= %f
         AND bbox.ymin >= %f AND bbox.ymax <= %f
     ) TO '%s' (FORMAT PARQUET)",
    src,
    classes_sql,
    bbox[[1]], bbox[[3]],
    bbox[[2]], bbox[[4]],
    cache_path
  )
  DBI::dbExecute(con, query)
  message("Wrote Overture cache: ", cache_path,
          " (", round(file.info(cache_path)$size / 1024 / 1024, 1), " MB)")
  cache_path
}

#' Cargar parquet Overture local como `sf` en EPSG:4326
#'
#' @param parquet_path ruta al parquet.
#' @return sf con columnas: id, class, subclass, subtype, road_surface,
#'   names_json, road_flags_json, speed_limits_json, sources_json,
#'   access_restrictions_json, level_rules_json, geometry.
#' @export
overture_load_segments <- function(parquet_path) {
  for (pkg in c("DBI", "duckdb", "sf")) {
    if (!requireNamespace(pkg, quietly = TRUE)) {
      stop(sprintf("Falta el paquete '%s' para cargar Overture.", pkg), call. = FALSE)
    }
  }
  if (!file.exists(parquet_path)) {
    stop("Overture parquet no encontrado: ", parquet_path, call. = FALSE)
  }
  con <- DBI::dbConnect(duckdb::duckdb())
  on.exit(DBI::dbDisconnect(con, shutdown = TRUE), add = TRUE)
  for (ext in c("spatial", "json")) {
    DBI::dbExecute(con, sprintf("INSTALL %s", ext))
    DBI::dbExecute(con, sprintf("LOAD %s", ext))
  }

  rows <- DBI::dbGetQuery(con, sprintf(
    "SELECT
       id,
       class,
       subclass,
       subtype,
       to_json(road_surface) AS road_surface_json,
       to_json(names) AS names_json,
       to_json(road_flags) AS road_flags_json,
       to_json(speed_limits) AS speed_limits_json,
       to_json(sources) AS sources_json,
       to_json(access_restrictions) AS access_restrictions_json,
       to_json(level_rules) AS level_rules_json,
       geometry_wkb
     FROM read_parquet('%s')",
    parquet_path
  ))
  if (!nrow(rows)) {
    return(sf::st_sf(
      id = character(), class = character(), subclass = character(),
      subtype = character(), road_surface_json = character(),
      names_json = character(), road_flags_json = character(),
      speed_limits_json = character(), sources_json = character(),
      access_restrictions_json = character(), level_rules_json = character(),
      geometry = sf::st_sfc(crs = 4326)
    ))
  }
  geom <- sf::st_as_sfc(structure(rows$geometry_wkb, class = "WKB"),
                        EWKB = FALSE, crs = 4326)
  rows$geometry_wkb <- NULL
  sf_obj <- sf::st_sf(rows, geometry = geom, crs = 4326)
  sf_obj
}

# ---- Parsers de campos JSON de Overture --------------------------------------

#' Extrae el OSM record_id si Overture lo cita en `sources`
#' @export
parse_overture_osm_id <- function(sources_json) {
  if (!length(sources_json)) return(character(0))
  vapply(sources_json, function(blob) {
    if (is.na(blob) || !nzchar(blob)) return(NA_character_)
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed) || !length(parsed)) return(NA_character_)
    for (entry in parsed) {
      ds <- entry$dataset %||% ""
      rid <- entry$record_id %||% ""
      if (identical(tolower(as.character(ds)), "openstreetmap") && nzchar(rid)) {
        # Overture cita como "w123456789@6" (way + versión). El osm_id que
        # GDAL devuelve para `lines` son solo los dígitos. Quitamos prefijo
        # de tipo (n/w/r) y sufijo de versión (@N).
        clean <- sub("^[a-z]", "", as.character(rid))
        clean <- sub("@\\d+$", "", clean)
        return(clean)
      }
    }
    NA_character_
  }, character(1), USE.NAMES = FALSE)
}

#' Extrae el nombre primario y el name:es desde `names` de Overture
#' @return data.frame con cols `name_primary` y `name_es`.
#' @export
parse_overture_names <- function(names_json) {
  if (!length(names_json)) {
    return(data.frame(name_primary = character(), name_es = character(),
                      stringsAsFactors = FALSE))
  }
  .single <- function(x, default = "") {
    if (is.null(x) || length(x) == 0L) return(default)
    s <- as.character(x[[1]])
    if (is.na(s)) return(default)
    s
  }
  primary_out <- character(length(names_json))
  es_out <- character(length(names_json))
  for (i in seq_along(names_json)) {
    blob <- names_json[[i]]
    if (is.na(blob) || !nzchar(blob)) next
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed)) next
    primary_out[[i]] <- .single(parsed$primary, "")
    # Overture ubica el nombre en español en common.es (cuando difiere del
    # primary). Si no está, intentamos rules[language=es*].
    es <- .single(parsed$common$es, "")
    if (!nzchar(es)) {
      rules <- parsed$rules %||% list()
      for (rule in rules) {
        lang <- tolower(.single(rule$language, ""))
        if (lang %in% c("es", "es-pe", "es-419")) {
          v <- .single(rule$value, "")
          if (nzchar(v)) { es <- v; break }
        }
      }
    }
    es_out[[i]] <- es
  }
  data.frame(name_primary = primary_out, name_es = es_out,
             stringsAsFactors = FALSE)
}

#' Carriles en Overture Transportation (schema GA)
#'
#' El schema GA actual NO expone un campo `lanes` directo (a diferencia de OSM
#' que tiene el tag `lanes`). Si en el futuro se agrega, este parser está listo
#' para leerlo desde `road_flags` o un campo `lanes` top-level. Por ahora
#' devuelve 0L para todo, dejando que los lanes de OSM tomen precedencia.
#' @export
parse_overture_lanes <- function(road_flags_json) {
  if (!length(road_flags_json)) return(integer(0))
  vapply(road_flags_json, function(blob) {
    if (is.na(blob) || !nzchar(blob)) return(0L)
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed)) return(0L)
    # Algunos releases pueden inyectar lanes como entry$lanes
    if (is.list(parsed)) {
      for (entry in parsed) {
        if (!is.null(entry$lanes)) {
          val <- suppressWarnings(as.integer(entry$lanes[[1]] %||% entry$lanes))
          if (length(val) == 1L && !is.na(val) && val > 0L) return(val)
        }
      }
    }
    0L
  }, integer(1), USE.NAMES = FALSE)
}

#' Detecta sentido (oneway) en Overture vía `access_restrictions`
#'
#' Overture señala oneway con `access_type = "denied"` y
#' `when.heading = "backward"` (no se puede ir en sentido contrario).
#' Devuelve "yes" / "no" / NA_character_.
#' @export
parse_overture_oneway <- function(access_restrictions_json) {
  if (!length(access_restrictions_json)) return(character(0))
  vapply(access_restrictions_json, function(blob) {
    if (is.na(blob) || !nzchar(blob)) return(NA_character_)
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed) || !length(parsed)) return(NA_character_)
    for (entry in parsed) {
      access <- tolower(as.character(entry$access_type %||% ""))
      heading <- tolower(as.character(entry$when$heading %||% ""))
      if (access == "denied" && heading == "backward") return("yes")
      if (access == "denied" && heading == "forward") return("yes")  # oneway al revés
    }
    NA_character_
  }, character(1), USE.NAMES = FALSE)
}

#' Extrae velocidad máxima en km/h desde `speed_limits` de Overture
#' @export
parse_overture_speed_kmh <- function(speed_limits_json) {
  if (!length(speed_limits_json)) return(integer(0))
  vapply(speed_limits_json, function(blob) {
    if (is.na(blob) || !nzchar(blob)) return(NA_integer_)
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed) || !length(parsed)) return(NA_integer_)
    entry <- if (is.list(parsed) && !is.null(parsed[[1]])) parsed[[1]] else parsed
    speed <- entry$max_speed %||% entry$speed %||% NULL
    if (is.null(speed)) return(NA_integer_)
    val <- speed$value %||% speed[[1]] %||% NULL
    unit <- tolower(as.character(speed$unit %||% "kmh"))
    if (is.null(val)) return(NA_integer_)
    num <- suppressWarnings(as.numeric(val))
    if (is.na(num)) return(NA_integer_)
    if (unit %in% c("mph", "mi/h")) num <- num * 1.609344
    as.integer(round(num))
  }, integer(1), USE.NAMES = FALSE)
}

#' Extrae el surface primario desde `road_surface` de Overture
#'
#' Schema: array de `{value, between}`. Devuelve el primer value no nulo.
#' @export
parse_overture_surface <- function(road_surface_json) {
  if (!length(road_surface_json)) return(character(0))
  vapply(road_surface_json, function(blob) {
    if (is.na(blob) || !nzchar(blob)) return(NA_character_)
    parsed <- tryCatch(jsonlite::fromJSON(blob, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed) || !length(parsed)) return(NA_character_)
    for (entry in parsed) {
      v <- entry$value %||% NULL
      if (!is.null(v) && nzchar(as.character(v))) return(as.character(v))
    }
    NA_character_
  }, character(1), USE.NAMES = FALSE)
}

#' Normaliza tag OSM `maxspeed` (string libre) a entero km/h
#' @export
parse_osm_maxspeed_kmh <- function(maxspeed) {
  if (!length(maxspeed)) return(integer(0))
  vapply(maxspeed, function(s) {
    if (is.na(s) || !nzchar(s)) return(NA_integer_)
    s_low <- tolower(as.character(s))
    is_mph <- grepl("mph", s_low, fixed = TRUE)
    num <- suppressWarnings(as.numeric(gsub("[^0-9.]", "", s_low)))
    if (is.na(num) || num <= 0) return(NA_integer_)
    if (is_mph) num <- num * 1.609344
    as.integer(round(num))
  }, integer(1), USE.NAMES = FALSE)
}

#' Normaliza tag OSM `lit` a logical
#' @export
parse_osm_lit <- function(lit) {
  if (!length(lit)) return(logical(0))
  vapply(lit, function(s) {
    if (is.na(s) || !nzchar(s)) return(NA)
    v <- tolower(trimws(as.character(s)))
    if (v %in% c("yes", "true", "24/7", "automatic", "limited", "sunset-sunrise")) return(TRUE)
    if (v %in% c("no", "false", "disused")) return(FALSE)
    NA
  }, logical(1), USE.NAMES = FALSE)
}

#' Normaliza tag OSM `oneway` (`yes`/`no`/`-1`/etc.)
#' @export
parse_osm_oneway <- function(oneway) {
  if (!length(oneway)) return(character(0))
  vapply(oneway, function(s) {
    if (is.na(s) || !nzchar(s)) return(NA_character_)
    v <- tolower(trimws(as.character(s)))
    if (v %in% c("yes", "true", "1")) return("yes")
    if (v %in% c("no", "false", "0")) return("no")
    if (v %in% c("-1", "reverse", "reversible", "alternating")) return("reversible")
    NA_character_
  }, character(1), USE.NAMES = FALSE)
}

#' Normaliza tag OSM `lanes` a entero
#' @export
parse_osm_lanes <- function(lanes) {
  if (!length(lanes)) return(integer(0))
  vapply(lanes, function(s) {
    if (is.na(s) || !nzchar(s)) return(0L)
    val <- suppressWarnings(as.integer(round(as.numeric(s))))
    if (is.na(val) || val < 0L || val > 50L) return(0L)
    val
  }, integer(1), USE.NAMES = FALSE)
}

# ---- Merge OSM <-> Overture --------------------------------------------------

#' Combina capa de OSM (sf) con capa de Overture (sf), priorizando OSM
#'
#' Hace dos pasos de matching:
#'   (1) por `osm_id` cuando Overture trae el sources[].record_id,
#'   (2) espacial con buffer + Hausdorff para los que sobran.
#' Lo que queda en Overture sin match se incorpora como filas nuevas
#' (`source = "overture"`). Los campos faltantes en OSM se rellenan desde
#' Overture cuando hay match.
#'
#' Ambos sf deben venir en EPSG:32718 (UTM 18S, metros) para que las
#' tolerancias en metros tengan sentido.
#'
#' @param roads_osm sf con columnas: osm_id, name, name_es, name_official,
#'   name_alt, name_ref, lanes, oneway, surface, maxspeed_kmh, lit, highway,
#'   class_group, rank, avenue_like, display_name (todas character/numeric).
#' @param overture_sf sf con columnas: id, name_primary, name_es, lanes,
#'   oneway, surface, maxspeed_kmh, osm_record_id (todas character/numeric).
#' @param hausdorff_max_m tolerancia máxima de Hausdorff en metros (default 5).
#' @param buffer_m buffer de búsqueda en metros (default 2).
#' @return sf en EPSG:32718 con columnas combinadas + `source` y `overture_id`.
#' @export
merge_osm_overture <- function(roads_osm, overture_sf,
                               hausdorff_max_m = 5,
                               buffer_m = 2,
                               geometric_match_max = 5000L) {
  if (!requireNamespace("sf", quietly = TRUE)) {
    stop("Se requiere 'sf' para merge_osm_overture()", call. = FALSE)
  }
  stopifnot(inherits(roads_osm, "sf"), inherits(overture_sf, "sf"))
  if (!nrow(overture_sf)) {
    roads_osm$source <- "osm"
    roads_osm$overture_id <- NA_character_
    return(roads_osm)
  }
  if (sf::st_crs(roads_osm)$input != sf::st_crs(overture_sf)$input) {
    overture_sf <- sf::st_transform(overture_sf, sf::st_crs(roads_osm))
  }

  roads_osm$source <- "osm"
  roads_osm$overture_id <- NA_character_

  # ---- Paso 1: match por osm_id --------------------------------------------
  ov_osm_id <- as.character(overture_sf$osm_record_id %||% rep(NA_character_, nrow(overture_sf)))
  matched_idx <- which(!is.na(ov_osm_id) & nzchar(ov_osm_id))
  if (length(matched_idx)) {
    osm_ids <- as.character(roads_osm$osm_id)
    map_idx <- match(ov_osm_id[matched_idx], osm_ids)
    have_pair <- which(!is.na(map_idx))
    for (k in have_pair) {
      ov_row <- matched_idx[[k]]
      osm_row <- map_idx[[k]]
      roads_osm$source[osm_row] <- "both"
      roads_osm$overture_id[osm_row] <- as.character(overture_sf$id[[ov_row]])
      # coalesce: rellenar campos de OSM con Overture si OSM venía vacío
      .coalesce_inplace <- function(field, ov_value, transform = identity) {
        cur <- roads_osm[[field]][[osm_row]]
        is_empty <- is.null(cur) || (length(cur) == 1L &&
          (is.na(cur) || (is.character(cur) && !nzchar(cur)) ||
           (is.numeric(cur) && (cur == 0 || is.na(cur)))))
        if (is_empty && length(ov_value) == 1L && !is.na(ov_value) &&
            (!is.character(ov_value) || nzchar(ov_value))) {
          roads_osm[[field]][[osm_row]] <<- transform(ov_value)
        }
      }
      .coalesce_inplace("name_es",      overture_sf$name_es[[ov_row]])
      .coalesce_inplace("lanes",        overture_sf$lanes[[ov_row]], as.integer)
      .coalesce_inplace("oneway",       overture_sf$oneway[[ov_row]])
      .coalesce_inplace("surface",      overture_sf$surface[[ov_row]])
      .coalesce_inplace("maxspeed_kmh", overture_sf$maxspeed_kmh[[ov_row]], as.integer)
    }
    overture_sf <- overture_sf[-matched_idx[have_pair], , drop = FALSE]
  }

  if (!nrow(overture_sf)) return(roads_osm)

  # ---- Paso 2: match espacial con buffer + Hausdorff -----------------------
  # En geografías donde Overture es esencialmente OSM (caso Lima/Callao), los
  # unmatched después del paso 1 son segmentos sin nombre que no aportan valor
  # y consumen O(n*m) tiempo. Skip si excede el umbral.
  if (nrow(overture_sf) > geometric_match_max) {
    message(sprintf(
      "merge_osm_overture: %d unmatched después del paso 1 (>%d). Skip match espacial.",
      nrow(overture_sf), geometric_match_max
    ))
    return(roads_osm)
  }
  candidates <- suppressWarnings(sf::st_is_within_distance(
    overture_sf, roads_osm, dist = buffer_m
  ))
  matched_ov_geom <- integer()
  for (i in seq_len(nrow(overture_sf))) {
    cands <- candidates[[i]]
    if (!length(cands)) next
    ov_geom <- sf::st_geometry(overture_sf)[[i]]
    best_osm <- NA_integer_
    best_d <- Inf
    for (j in cands) {
      osm_geom <- sf::st_geometry(roads_osm)[[j]]
      d <- tryCatch(
        as.numeric(sf::st_distance(
          sf::st_sfc(ov_geom, crs = sf::st_crs(roads_osm)),
          sf::st_sfc(osm_geom, crs = sf::st_crs(roads_osm))
        )),
        error = function(e) Inf
      )
      if (!is.finite(d)) next
      # Aproximación a Hausdorff direccional (vía st_distance siempre <= Hausdorff)
      if (d <= hausdorff_max_m && d < best_d) {
        best_d <- d
        best_osm <- j
      }
    }
    if (!is.na(best_osm)) {
      matched_ov_geom <- c(matched_ov_geom, i)
      roads_osm$source[best_osm] <- "both"
      if (is.na(roads_osm$overture_id[best_osm])) {
        roads_osm$overture_id[best_osm] <- as.character(overture_sf$id[[i]])
      }
      # coalesce ligero (sin sobrescribir OSM)
      cur_es <- roads_osm$name_es[best_osm]
      ov_es <- overture_sf$name_es[[i]]
      if ((is.na(cur_es) || !nzchar(cur_es)) && !is.na(ov_es) && nzchar(ov_es)) {
        roads_osm$name_es[best_osm] <- ov_es
      }
      if (roads_osm$lanes[best_osm] == 0L) {
        ov_lanes <- overture_sf$lanes[[i]]
        if (!is.na(ov_lanes) && ov_lanes > 0L) roads_osm$lanes[best_osm] <- ov_lanes
      }
    }
  }
  if (length(matched_ov_geom)) {
    overture_sf <- overture_sf[-matched_ov_geom, , drop = FALSE]
  }

  if (!nrow(overture_sf)) return(roads_osm)

  # ---- Paso 3: incorporar Overture-only como nuevas filas ------------------
  n_ov <- nrow(overture_sf)
  display <- ifelse(nzchar(overture_sf$name_primary), overture_sf$name_primary, "")
  overture_only <- sf::st_sf(
    osm_id        = rep(NA_character_, n_ov),
    name          = display,
    name_es       = as.character(overture_sf$name_es),
    name_official = rep(NA_character_, n_ov),
    name_alt      = rep(NA_character_, n_ov),
    name_ref      = rep(NA_character_, n_ov),
    lanes         = as.integer(overture_sf$lanes),
    oneway        = as.character(overture_sf$oneway),
    surface       = as.character(overture_sf$surface),
    maxspeed_kmh  = as.integer(overture_sf$maxspeed_kmh),
    lit           = rep(NA, n_ov),
    highway       = .overture_class_to_osm_highway(overture_sf$class),
    class_group   = .overture_class_group(overture_sf$class),
    rank          = .overture_class_rank(overture_sf$class),
    avenue_like   = rep(FALSE, n_ov),
    display_name  = display,
    source        = rep("overture", n_ov),
    overture_id   = as.character(overture_sf$id),
    geometry      = sf::st_geometry(overture_sf)
  )
  # Conservar columnas presentes en roads_osm que no estén en overture_only
  missing_cols <- setdiff(names(roads_osm), names(overture_only))
  for (col in missing_cols) {
    overture_only[[col]] <- rep(NA, n_ov)
  }
  overture_only <- overture_only[, names(roads_osm), drop = FALSE]
  rbind(roads_osm, overture_only)
}

# Mapeos del schema Overture al schema OSM-like usado en el resto del pipeline.
.overture_class_to_osm_highway <- function(cls) {
  cls <- tolower(as.character(cls %||% ""))
  out <- ifelse(cls %in% c("motorway"), "motorway",
         ifelse(cls %in% c("trunk"), "trunk",
         ifelse(cls %in% c("primary"), "primary",
         ifelse(cls %in% c("secondary"), "secondary",
         ifelse(cls %in% c("tertiary"), "tertiary",
         ifelse(cls %in% c("residential", "living_street"), cls,
         ifelse(cls %in% c("unclassified"), "unclassified",
                "residential")))))))
  out
}

.overture_class_group <- function(cls) {
  cls <- tolower(as.character(cls %||% ""))
  ifelse(cls %in% c("motorway", "trunk", "primary", "secondary"), "major",
    ifelse(cls %in% c("tertiary"), "avenue", "detail"))
}

.overture_class_rank <- function(cls) {
  cls <- tolower(as.character(cls %||% ""))
  ifelse(cls %in% c("motorway", "trunk"), 1L,
    ifelse(cls == "primary", 2L,
      ifelse(cls == "secondary", 3L,
        ifelse(cls == "tertiary", 4L, 7L))))
}
