# Respuesta de Mailchimp a `GET /lists/{id}/members?status=subscribed`: todos
# los correos dados, en una página. La usan los mocks de `.mc_http` desde que
# "Respondió" se pone sólo a los suscriptores activos.
.mc_fx_es_activos <- function(url) grepl("/members\\?", url) && grepl("status=subscribed", url)
.mc_fx_activos <- function(emails) {
  list(status = 200L, headers = list(),
       body = list(members = lapply(emails, function(e) list(email_address = e)), total_items = length(emails)))
}
