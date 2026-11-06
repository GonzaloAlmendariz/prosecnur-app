# collection_campaigns_acreditacion.R — en acreditación, una campaña por público y ronda (ADR 0125 §5 y A4).
#
# Gonzalo (2 nov 2026): «a veces hay perfiles como egresado que es correo una vez, luego llamadas y al final
# otra ronda de correos, o sea que hay campañas relacionadas». El Modelo de Monitoreo declara, por público, sus
# `canales = list(list(ronda, canal))` (monitoreo_actor_contract.R, c36597d3d). Cada ronda telefónica es una
# campaña `telefonica` propia, con `relacion = list(publico, ronda, viene_de)` en su entrada del registro:
# `viene_de` es la campaña de Material de la ronda anterior de ese público, si es una del registro; una ronda de
# correo vive en el estado de correo y no se nombra aquí (queda `NULL`).
#
# Fuera de acreditación, o sin rondas telefónicas declaradas, la telefónica sigue siendo `telefonica.principal`.

.MACR_CANAL_A_TIPO <- c(telefonico = "telefonica", presencial = "aulas", correo = "correo")

# Las rondas que el Modelo declara, una por (público, ronda), con su canal.
.macr_rondas <- function(s) {
  units <- tryCatch(s$monitoreo_config$monitoreo_profile$units, error = function(e) NULL)
  if (!is.list(units)) return(list())
  out <- list()
  for (u in units) {
    if (!is.list(u)) next
    publico <- .mtf_txt(u$actor %||% u$label %||% u$id)
    if (!nzchar(publico)) next
    canales <- tryCatch(.monitoreo_normalize_canales(u$canales), error = function(e) list())
    for (c in canales) {
      out[[length(out) + 1L]] <- list(publico = publico, etiqueta = .mtf_txt(u$label %||% publico),
                                      ronda = as.integer(c$ronda), canal = c$canal,
                                      tipo = unname(.MACR_CANAL_A_TIPO[c$canal]))
    }
  }
  out
}

# `telefonica.egresados-r2`: tipo, público y ronda; cabe en el patrón de ids del registro.
.macr_id <- function(tipo, publico, ronda) {
  slug <- gsub("_", "-", .slug_code(publico))
  paste0(tipo, ".", substr(slug, 1L, 30L), "-r", as.integer(ronda))
}

# La campaña del registro de la ronda anterior de ese público, o NULL.
.macr_viene_de <- function(reg, publico, ronda) {
  if (ronda <= 1L) return(NULL)
  previa <- Find(function(e) {
    r <- e$relacion %||% list()
    identical(.mtf_txt(r$publico), publico) && identical(suppressWarnings(as.integer(.mtf_txt(r$ronda))), as.integer(ronda) - 1L)
  }, reg$campaigns)
  if (is.null(previa)) NULL else previa$id
}

# Las rondas de un tipo que todavía no tienen su campaña, con el id y el `viene_de` que llevarían.
.macr_rondas_libres <- function(s, reg, tipo) {
  tomadas <- vapply(reg$campaigns, function(e) e$id, "")
  libres <- Filter(function(r) identical(r$tipo, tipo) && !.macr_id(tipo, r$publico, r$ronda) %in% tomadas, .macr_rondas(s))
  lapply(libres, function(r) c(r, list(id = .macr_id(tipo, r$publico, r$ronda), viene_de = .macr_viene_de(reg, r$publico, r$ronda))))
}

# ¿Esta telefónica se arma por público y ronda? En acreditación, con alguna ronda telefónica declarada.
.macr_por_rondas <- function(s, tipo = "telefonica") {
  identical(.mcamp_proposito(s), "acreditacion") && any(vapply(.macr_rondas(s), function(r) identical(r$tipo, tipo), TRUE))
}
