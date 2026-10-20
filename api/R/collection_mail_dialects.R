# collection_mail_dialects.R — cómo sale el correo en cada plataforma de envío
# (ADR 0110, etapa E1j: «plataforma por campaña»).
#
# El render es UNO solo (collection_mail_render.R). La plataforma entra como
# parámetro (`dialect`) y todo lo que antes estaba cableado a Mailchimp
# (etiquetas, condicionales, pie legal, `src` de imagen) se pide a esta tabla.
# Así un mismo `{{enlace}}` sale `*|ENLACE|*` en Mailchimp o `[SurveyLink]` en
# SurveyMonkey, y cambiar de plataforma no toca la plantilla.
#
# | Función     | mailchimp                          | surveymonkey                        |
# |-------------|------------------------------------|-------------------------------------|
# | name_tag    | *|FNAME|*                          | [FirstName]                         |
# | field_tag   | *|TAG|*                            | [<sm>]; sin `sm`, "" (error en la revisión) |
# | conditional | *|IF:T|*…*|ELSE:|*…*|END:IF|*      | ninguno: sale la etiqueta sola      |
# | footer      | *|LIST:ADDRESSLINE|* + *|UNSUB|*    | [PrivacyLink] + [OptOutLink]        |
# | img_src     | URL https o nombre relativo (ZIP)  | solo URL https (sin URL, src="")    |
#
# SurveyMonkey (ayuda pública, ver ADR 0110 §E1j): `[SurveyLink]` y
# `[OptOutLink]` son obligatorias; en «HTML personalizado» van como URL de un
# `<a href>`. No hay condicionales: un contacto sin dato ve un espacio vacío.

.CMAIL_DIALECT_NAMES <- c("mailchimp", "surveymonkey")
.CMAIL_PLATFORM_DEFAULT <- "mailchimp"

# `fields[].sm`: la etiqueta de SurveyMonkey de un campo del estudio.
.CMAIL_SM_FIELD_RE <- "^(SurveyLink|LastName|CustomData([1-9]|[1-4][0-9]|50))$"
# Fuera de Team/Enterprise SurveyMonkey ofrece CustomData1..6.
.CMAIL_SM_CUSTOM_PLAN_LIMIT <- 6L
# Vocabulario de SurveyMonkey que no se escribe a mano en un texto (`raw_platform_tag`).
.CMAIL_PLATFORM_TAG_RE <- "\\[(SurveyLink|OptOutLink|PrivacyLink|FooterLink|RemoveLink|FirstQuestion|FirstName|LastName|Email|CustomData\\d{1,2})\\]"

.cmail_platform_ok <- function(x) is.character(x) && length(x) == 1L && !is.na(x) && x %in% .CMAIL_DIALECT_NAMES

# Plataforma de una campaña (sin clave, mailchimp: lectura sin escribir).
.cmail_platform_of <- function(campaign) {
  p <- .cmail_one(campaign$platform)
  if (.cmail_platform_ok(p)) p else .CMAIL_PLATFORM_DEFAULT
}

.cmail_platform_arg <- function(platform) {
  if (is.null(platform)) return(NULL)
  value <- .cmail_one(as.list(platform))
  if (!.cmail_platform_ok(value)) {
    stop_api(422, "E_COLLECTION_MAIL_PLATFORM", "platform es mailchimp o surveymonkey.",
             details = list(platforms = as.list(.CMAIL_DIALECT_NAMES)))
  }
  value
}

.CMAIL_DIALECTS <- list(
  mailchimp = list(
    name_tag = function() "*|FNAME|*",
    field_tag = function(field) sprintf("*|%s|*", field$tag),
    # `cond` es la etiqueta que decide (FNAME o la del campo).
    conditional = function(cond, then_html, else_html) {
      sprintf("*|IF:%s|*%s*|ELSE:|*%s*|END:IF|*", cond, then_html, else_html)
    },
    footer = function() c(
      "*|LIST:ADDRESSLINE|*",
      '<a href="*|UNSUB|*" target="_blank" style="color:#555555;text-decoration:underline;">Dejar de recibir estos correos</a>'
    ),
    footer_preview = function() '<span style="text-decoration:underline;">Dejar de recibir estos correos</span>',
    img_src = function(img) img$url %||% img$export_name
  ),
  surveymonkey = list(
    name_tag = function() "[FirstName]",
    field_tag = function(field) {
      sm <- .cmail_one(field$sm)
      if (is.null(sm)) "" else sprintf("[%s]", sm)
    },
    conditional = function(cond, then_html, else_html) then_html,
    # Texto del pie de las invitaciones de PULSO en SurveyMonkey.
    footer = function() paste0(
      '<a href="[PrivacyLink]" target="_blank" style="color:#555555;text-decoration:underline;">Privacidad</a> | ',
      'Si desea darse de baja de esta encuesta, haga clic ',
      '<a href="[OptOutLink]" target="_blank" style="color:#555555;text-decoration:underline;">aquí</a>.'
    ),
    footer_preview = function() paste0(
      '<span style="text-decoration:underline;">Privacidad</span> | ',
      'Si desea darse de baja de esta encuesta, haga clic <span style="text-decoration:underline;">aquí</span>.'
    ),
    img_src = function(img) {
      u <- .cmail_one(img$url)
      if (!is.null(u) && grepl("^https://", u)) u else ""
    }
  )
)

.cmail_dialect <- function(ctx) .CMAIL_DIALECTS[[ctx$dialect %||% .CMAIL_PLATFORM_DEFAULT]]

#' Verificación estructural del HTML para SurveyMonkey («HTML personalizado»).
#'
#' No confía en cómo se armó: sin `data:`, todo `src` https, `href="[SurveyLink]"`
#' y `href="[OptOutLink]"` presentes y nada de `*|`, `{{` ni `data-pulso`.
#' @return list(ok, problems).
#' @keywords internal
.cmail_sm_html_verify <- function(html) {
  html <- paste(as.character(html), collapse = "\n")
  problems <- character(0)
  srcs <- sub('^src="', "", sub('"$', "", regmatches(html, gregexpr('src="[^"]*"', html))[[1]]))
  if (grepl("data:[a-z]+/", html)) problems <- c(problems, "hay imágenes incrustadas (data:).")
  bad <- srcs[!grepl("^https://", srcs)]
  if (length(bad)) problems <- c(problems, sprintf("%d imágenes sin URL https.", length(bad)))
  if (!grepl('href="[SurveyLink]"', html, fixed = TRUE)) problems <- c(problems, 'falta href="[SurveyLink]".')
  if (!grepl('href="[OptOutLink]"', html, fixed = TRUE)) problems <- c(problems, 'falta href="[OptOutLink]".')
  if (grepl("*|", html, fixed = TRUE)) problems <- c(problems, "quedan etiquetas de Mailchimp (*|).")
  if (grepl("{{", html, fixed = TRUE)) problems <- c(problems, "quedan campos sin traducir ({{).")
  if (grepl("data-pulso", html, fixed = TRUE)) problems <- c(problems, "el HTML trae marcas de edición.")
  list(ok = !length(problems), problems = as.list(problems))
}
