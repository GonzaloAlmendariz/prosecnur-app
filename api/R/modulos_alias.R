# =============================================================================
# Alias de slugs de módulo persistidos (ADR 0108 §1 «Slug persistido»)
# =============================================================================
#
# Un slug de módulo vive en estado persistido (`project_modules`, `module_id` de
# la bitácora) y las listas que lo leen son CERRADAS: descartan o reasignan en
# silencio lo que no reconocen. Renombrar un módulo sin alias borraría ese
# estado de los `.pulso` anteriores. Por eso el alias se aplica SIEMPRE antes de
# filtrar por la lista cerrada, y ningún código nuevo escribe el slug viejo.
#
# El vocabulario «recopilador» como collector de proveedor (SurveyMonkey/Kobo),
# el prefijo /api/recopiladores/* y los kinds de job `recopiladores.*` NO son
# slugs de módulo y no pasan por aquí.

.MODULOS_ALIAS <- c(
  "recopiladores" = "material-campo"
)

# Devuelve el vector de slugs con los alias resueltos al slug vigente. Conserva
# el largo y el orden; lo que no es alias pasa intacto.
.modulos_alias_aplicar <- function(slugs) {
  slugs <- as.character(unlist(slugs, use.names = FALSE))
  if (!length(slugs)) return(character(0))
  hit <- !is.na(slugs) & slugs %in% names(.MODULOS_ALIAS)
  slugs[hit] <- unname(.MODULOS_ALIAS[slugs[hit]])
  slugs
}
