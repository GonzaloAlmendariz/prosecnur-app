# Completar los textos de relleno de las plantillas de casa antes de exportar
# (`placeholders_pending`, collection_mail_pendientes.R). Una plantilla con
# «[fecha límite]» ya no se exporta: las pruebas que miden el ZIP, el manifest
# o la audiencia completan primero el relleno, como lo haría el autor.
#
# Quita los corchetes y deja la frase: «[fecha límite]» -> «fecha límite». No
# toca los enlaces `[texto](url)`, las etiquetas de SurveyMonkey ni el
# marcador del alt que falta (`[Describe la imagen]`, que mide `images_alt`).

.CMAIL_FX_RELLENO_RE <- paste0(
  "\\[(?!Describe la imagen\\]|(?:SurveyLink|OptOutLink|PrivacyLink|FooterLink|RemoveLink|FirstQuestion|",
  "FirstName|LastName|Email|CustomData\\d{1,2})\\])([^\\[\\]\\n]*[[:alnum:]][^\\[\\]\\n]*)\\](?!\\()"
)

.cmail_fx_sin_relleno <- function(tpl) {
  rapply(tpl, function(x) gsub(.CMAIL_FX_RELLENO_RE, "\\1", x, perl = TRUE), classes = "character", how = "replace")
}

# Completa la plantilla guardada de una campaña (o la de la sesión) y devuelve el PUT.
.cmail_fx_completar <- function(sid, campaign_id = NULL) {
  g <- collection_mail_template_get(sid, campaign_id)
  collection_mail_template_put(sid, .cmail_fx_sin_relleno(g$template), g$state_revision, campaign_id = campaign_id)
}
