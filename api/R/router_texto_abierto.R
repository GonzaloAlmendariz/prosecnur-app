# Router del diccionario del proyecto por pregunta abierta (TXT-6 + TXT-7, plan-texto-abierto-ccss-2026-10-24).
# Delgado: lee la sesión y el cuerpo, delega en texto_abierto_diccionario.R y serializa.
#
#   GET /api/texto-abierto/diccionario?base=&variable=   diccionario + palabras reconocidas de la pregunta
#   PUT /api/texto-abierto/diccionario?base=&variable=   guarda el diccionario completo (marca project_dirty)
#
# `base` vacía = la base activa (nunca la primera por omisión). En el PUT, `base` y `variable` pueden venir también en
# el cuerpo; el diccionario va en `diccionario` o en la raíz del cuerpo (`equivalencias`, `excluir`, `frases`).
# Sólo se monta fuera del modo público (plumber_app.R): el PUT muta el proyecto. El contrato por el wire vive en
# test-texto-abierto-diccionario-http.R.

#' Cuerpo JSON del pedido como lista, sin simplificar (las listas de un elemento siguen siendo listas)
#' @keywords internal
.txt_dic_router_cuerpo <- function(req) {
  raw <- if (!is.null(req$bodyRaw) && length(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  raw <- as.character(raw %||% "")
  if (!nzchar(trimws(raw))) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
  Encoding(raw) <- "UTF-8"
  parsed <- tryCatch(jsonlite::fromJSON(raw, simplifyVector = FALSE),
                     error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
  if (!is.list(parsed)) stop_api(422, "E_TXT_DICCIONARIO_INVALIDO", "El cuerpo debe ser un objeto JSON.")
  parsed
}

mount_texto_abierto <- function(pr) {
  pr |>
    plumber::pr_get("/api/texto-abierto/diccionario", wrap_endpoint(function(req, res, base = NULL, variable = NULL, ...) {
      sid <- session_header(req)
      session_get(sid)
      texto_abierto_diccionario_consultar(sid, base = base, variable = variable)
    })) |>
    plumber::pr_put("/api/texto-abierto/diccionario", wrap_endpoint(function(req, res, base = NULL, variable = NULL, ...) {
      # `...` porque plumber pasa los campos del cuerpo JSON como argumentos: sin él, `equivalencias` sería un
      # argumento sin usar y el pedido moriría en E_INTERNAL. El cuerpo se lee entero de `req` (abajo).
      sid <- session_header(req)
      session_get(sid)
      cuerpo <- .txt_dic_router_cuerpo(req)
      dic <- if (is.list(cuerpo$diccionario)) cuerpo$diccionario else cuerpo[intersect(c("equivalencias", "excluir", "frases"), names(cuerpo))]
      texto_abierto_diccionario_guardar(sid, base = base %||% cuerpo$base, variable = variable %||% cuerpo$variable, raw = dic)
    }))
}
