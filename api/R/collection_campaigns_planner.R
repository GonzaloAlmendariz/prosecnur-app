# collection_campaigns_planner.R — qué tipos de campaña declara el estudio (ADR 0122 P2).
#
# El perfil de recojo del Planner fija qué campañas abre Material (.planner_modos_de:
# territorial → territorial, aulas → aulas, telefónico → telefonica, acreditación o un
# perfil con canal correo → correo). «Nueva campaña» ofrece sólo esas y crear otra es 409.
# Una campaña que ya existe de un tipo no declarado se abre igual y se marca «fuera del
# estudio»: no se borra lo hecho.
#
# Sólo manda lo DECLARADO: mientras los perfiles sean la proyección del Planner (lo que
# infiere de los módulos), Material ofrece todos los tipos, como antes.

#' Tipos de campaña del estudio, o NULL si el Planner no declaró perfiles. Lectura pura.
#' @keywords internal
.mcamp_tipos_del_estudio <- function(s) {
  decl <- tryCatch(.planner_leer(s)$secciones$perfiles, error = function(e) NULL)
  if (is.null(decl) || !length(decl$valor)) return(NULL)
  campanas <- tryCatch(unlist(.planner_modos_de(decl$valor, sorteo_aulas = .collection_hay_sorteo_aulas(s))$material$campanas), error = function(e) NULL)
  if (!length(campanas)) return(NULL)
  intersect(.MCAMP_TIPOS, campanas)
}

# Marca cada tipo con `del_estudio` y cada campaña con `fuera_del_estudio`.
.mcamp_marcar_del_estudio <- function(s, tipos, campaigns) {
  del <- .mcamp_tipos_del_estudio(s)
  en <- function(t) is.null(del) || t %in% del
  list(
    tipos = lapply(tipos, function(t) c(t, list(del_estudio = en(t$tipo)))),
    campaigns = lapply(campaigns, function(c) c(c, list(fuera_del_estudio = !en(c$tipo %||% "")))),
    tipos_del_estudio = if (is.null(del)) NULL else as.list(del)
  )
}

.mcamp_assert_del_estudio <- function(s, tipo) {
  del <- .mcamp_tipos_del_estudio(s)
  if (is.null(del) || tipo %in% del) return(invisible(TRUE))
  stop_api(409, "E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE",
           "Este estudio no declara ese tipo de campaña: agrega el perfil de recojo en el Planner.",
           details = list(tipo = tipo, tipos_del_estudio = as.list(del)))
}
