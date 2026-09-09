# monitoreo_fuente_servidor.R — la fuente hereda el servidor de su perfil.
#
# **El defecto.** `.monitoreo_source_from_payload()` rellenaba `base_url` con el
# servidor por DEFECTO del proveedor en cuanto el cuerpo no lo traía. Eso parece
# inocente y no lo es: la validación de más abajo sí sabe resolver el servidor
# del perfil (`.connections_profile_base_url()`), pero sólo lo intenta cuando
# `base_url` viene VACÍO. Al rellenarlo antes, el default TAPABA al perfil.
#
# Consecuencia medida el 2026-09-09 sobre HSVG2026: el perfil vivo era
# `PULSOEU`, europeo, y declarar la fuente con su `connection_profile_id`
# contestaba «Proyecto Kobo no encontrado. Verifica el asset UID.» — porque se
# le estaba preguntando al Kobo GLOBAL, donde ese formulario efectivamente no
# existe. El mensaje culpa al asset y el asset estaba bien; el mismo formulario
# aparecía el primero al listar los 22 del perfil.
#
# El arreglo es de orden, no de lógica nueva: primero lo que el cuerpo dice,
# después lo que el PERFIL sabe, y sólo al final el default del proveedor.

#' El servidor de una fuente: lo declarado, si no el de su perfil, si no el default.
#'
#' @param base_url lo que venga en el cuerpo; gana siempre si trae algo.
#' @param kind `kobo`, `surveymonkey` o `google_sheets`.
#' @param profile_id perfil de conexión declarado, si lo hay.
#' @return la URL base, o `""` para los proveedores que no tienen servidor.
#' @keywords internal
.monitoreo_fuente_base_url <- function(base_url, kind, profile_id = "") {
  declarado <- trimws(.monitoreo_scalar(base_url, ""))
  if (nzchar(declarado)) return(declarado)
  perfil <- trimws(.monitoreo_scalar(profile_id, ""))
  if (nzchar(perfil)) {
    # Un perfil que ya no existe no puede decidir nada: se cae al default en vez
    # de reventar. Es el caso real de un perfil borrado que la fuente todavía
    # nombra, y ahí lo que hace falta es que la app siga contestando.
    del_perfil <- tryCatch(
      .monitoreo_scalar(.connections_profile_base_url(kind, perfil), ""),
      error = function(e) ""
    )
    if (nzchar(del_perfil)) return(del_perfil)
  }
  if (identical(kind, "kobo")) return(kobo_api_default_base_url())
  if (identical(kind, "surveymonkey")) return("https://api.surveymonkey.com/v3")
  ""
}
