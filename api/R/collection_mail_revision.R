# collection_mail_revision.R — «Vista para revisión»: un HTML para mandar a
# quien aprueba los correos (loop editor de correos, L9; Acreditación
# Institucional 2026: se armó seis veces fuera de la app con capturas).
#
# Cada campaña elegida es una columna (para comparar dos propuestas, se duplica
# la campaña y se cambia); la página tiene una fila «Computadora» con cada
# correo a 760 px y una fila «Celular» con cada correo a 390 px dentro de un
# marco. Cada correo va como HTML real en un `iframe srcdoc` (no capturas): se
# lee nítido, pesa poco y en el celular responde como en un teléfono.
#
# Se usa la persona de ejemplo (Ana o Luis, L8) y el render de vista previa SIN
# las marcas del editor (zonas, tinte de los campos): nada de datos personales,
# así que el archivo no es `personal_data`. Sin «·» en los rótulos (pedido de
# Gonzalo, 2026-10-27).

.CMAIL_REVISION_ANCHOS <- c(computadora = 760L, celular = 390L)
.CMAIL_REVISION_MAX <- 6L
# Qué envío de cada campaña (L17), con los nombres de Gonzalo y sin numerar:
# el primer correo, un recordatorio (el primero de ellos) o el último.
.CMAIL_REVISION_ENVIOS <- c(primero = "Primer correo", recordatorio = "Recordatorio", ultimo = "Último recordatorio")

#' El envío de la campaña que se muestra; sin recordatorios, el primer correo.
#' @keywords internal
.cmail_revision_envio <- function(campaign, envio) {
  sends <- .cmail_sends_of(campaign)
  recs <- Filter(function(s) identical(.cmail_one(s$kind), "recordatorio"), sends)
  if (identical(envio, "recordatorio") && length(recs)) return(recs[[1L]]$send_id)
  if (identical(envio, "ultimo") && length(recs)) return(recs[[length(recs)]]$send_id)
  NULL
}

#' HTML del correo de una campaña, limpio, para la vista para revisión.
#' @keywords internal
.cmail_revision_correo <- function(session, campaign, ejemplo, envio = "primero") {
  tpl <- .cmail_campaign_template_checked(campaign, strict = FALSE)
  attr(tpl, "problems") <- NULL
  sp <- .cmail_send_pick(campaign, tpl, .cmail_revision_envio(campaign, envio))
  ef <- .cmail_template_for_send(tpl, sp$send)
  images <- .cmail_images_resolve(session, ef)
  values <- .cmail_synthetic_values(ef, ejemplo)
  rendered <- collection_mail_render(ef, mode = "preview", dialect = .cmail_platform_of(campaign),
                                     values = values, images = images, marks = FALSE)
  es_primero <- identical(.cmail_one(sp$send$kind) %||% "invitacion", "invitacion")
  list(nombre = .cmail_one(campaign$name) %||% .cmail_one(campaign$campaign_id), html = rendered$html,
       subject = rendered$subject,
       envio = if (es_primero) .CMAIL_REVISION_ENVIOS[["primero"]] else .CMAIL_REVISION_ENVIOS[[envio]])
}

#' Saca las imágenes en base64 de los correos y las deja una sola vez (L18).
#'
#' Cada correo trae sus imágenes como `data:` y se repiten en computadora y
#' celular y entre campañas: las 6 campañas de Acreditación pesaban 6,4 MB por
#' 5 imágenes distintas (670 KB). Cada `<img src="data:…">` pasa a
#' `<img data-cmail-img="i3">` y la página lleva el mapa una vez; el `onload`
#' de cada iframe las pone (un srcdoc es del mismo origen que su página).
#' @keywords internal
.cmail_revision_imagenes <- function(correos) {
  mapa <- character(0)
  re <- 'src="(data:image/[^"]+)"'
  for (k in seq_along(correos)) {
    h <- correos[[k]]$html
    m <- gregexpr(re, h, perl = TRUE)
    hallados <- regmatches(h, m)[[1]]
    if (!length(hallados)) next
    reemplazos <- vapply(hallados, function(x) {
      # El render parte el base64 en líneas y las escribe `&#10;`: dentro del srcdoc
      # se decodifican, en un string de JavaScript no.
      uri <- gsub("\\s|&#1[03];", "", sub(re, "\\1", x, perl = TRUE), perl = TRUE)
      pos <- match(uri, mapa)
      if (is.na(pos)) {
        mapa[[paste0("i", length(mapa) + 1L)]] <<- uri
        pos <- length(mapa)
      }
      clave <- names(mapa)[[pos]]
      sprintf('data-cmail-img="%s"', clave)
    }, "", USE.NAMES = FALSE)
    regmatches(h, m) <- list(reemplazos)
    correos[[k]]$html <- h
  }
  list(correos = correos, mapa = as.list(mapa))
}

#' La página de revisión con los correos ya armados (list(nombre, html, subject)).
#' @keywords internal
.cmail_revision_pagina <- function(titulo, correos) {
  esc <- function(x) htmltools::htmlEscape(x)
  im <- .cmail_revision_imagenes(correos)
  correos <- im$correos
  # Pone las imágenes del mapa y reajusta el alto cuando cada una termina de cargar.
  ajustar <- "cmailListo(this)"
  fila <- function(vista) {
    ancho <- .CMAIL_REVISION_ANCHOS[[vista]]
    celdas <- vapply(correos, function(c) sprintf(
      '<figure><figcaption style="max-width:%dpx">%s<small>%s</small><span>Asunto: %s</span></figcaption><iframe class="%s" title="%s en %s" style="width:%dpx;height:900px" srcdoc="%s" onload="%s"></iframe></figure>',
      ancho, esc(c$nombre), esc(c$envio %||% ""), esc(c$subject %||% ""), vista, esc(c$nombre), vista, ancho, htmltools::htmlEscape(c$html, attribute = TRUE), ajustar), "")
    sprintf('<section class="fila"><h2 id="%s">%s</h2><div class="par">%s</div></section>',
            vista, if (identical(vista, "computadora")) "Computadora" else "Celular", paste(celdas, collapse = ""))
  }
  paste0(
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    sprintf("<title>%s</title>", esc(titulo)),
    '<style>',
    ':root{--bg:#eef1f6;--card:#fff;--ink:#101b33;--line:#dce1ea;--navy:#022051;--azul:#004dac;',
    '--font:"Helvetica Neue",Helvetica,Arial,sans-serif}',
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--font)}',
    'header{background:var(--navy);color:#fff}header .in{max-width:1640px;margin:0 auto;padding:22px 20px;',
    'display:flex;flex-wrap:wrap;gap:12px 28px;align-items:baseline}',
    'header h1{margin:0;font-size:clamp(20px,2.6vw,27px);line-height:1.2}',
    'nav a{color:#cfe0ff;text-decoration:none;font-weight:600;margin-right:18px}',
    'main{max-width:1640px;margin:0 auto;padding:20px 20px 48px;display:grid;gap:20px}',
    '.fila{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px}',
    'h2{margin:0 0 12px;font-size:22px;color:var(--navy)}',
    '.par{display:grid;grid-auto-flow:column;grid-auto-columns:max-content;gap:28px;justify-content:center;overflow-x:auto}',
    'figure{margin:0;display:grid;gap:8px;justify-items:center;align-content:start}',
    'figcaption{display:grid;gap:2px;justify-items:center;text-align:center;font-size:13px;font-weight:700;color:var(--azul);text-transform:uppercase;letter-spacing:.06em}',
    'figcaption small{font-size:12px;color:var(--ink);letter-spacing:.04em}',
    'figcaption span{font-size:14px;font-weight:600;color:var(--ink);text-transform:none;letter-spacing:0}',
    'iframe{display:block;border:1px solid var(--line);border-radius:10px;background:#fff}',
    'iframe.celular{border:8px solid #1b2438;border-radius:22px}',
    '</style>',
    '<script>var CMAIL_IMG=', jsonlite::toJSON(im$mapa, auto_unbox = TRUE), ';',
    'function cmailListo(f){var d=f.contentDocument,alto=function(){f.style.height=d.documentElement.scrollHeight+"px"};',
    'd.querySelectorAll("img[data-cmail-img]").forEach(function(i){i.addEventListener("load",alto);i.src=CMAIL_IMG[i.getAttribute("data-cmail-img")]||""});alto()}',
    '</script></head><body>',
    sprintf('<header><div class="in"><h1>%s</h1><nav><a href="#computadora">Computadora</a><a href="#celular">Celular</a></nav></div></header>', esc(titulo)),
    '<main>', fila("computadora"), fila("celular"), '</main></body></html>'
  )
}

#' Arma la vista para revisión de las campañas pedidas y la deja para descargar.
#' @param campaign_ids ids de campaña (1 a 6), en el orden de las columnas.
#' @param ejemplo "femenino" (Ana) o "masculino" (Luis).
#' @param envio "primero", "recordatorio" o "ultimo" (L17).
#' @keywords internal
collection_mail_revision <- function(sid, campaign_ids, ejemplo = "femenino", titulo = NULL, envio = "primero") {
  session <- session_get(sid)
  ids <- as.character(unlist(campaign_ids %||% list(), use.names = FALSE))
  if (!length(ids) || length(ids) > .CMAIL_REVISION_MAX) {
    stop_api(422, "E_COLLECTION_MAIL_REVISION", sprintf("Elige de 1 a %d campañas.", .CMAIL_REVISION_MAX))
  }
  state <- .collection_current(session)
  todas <- .cmail_campaigns_of(state)$campaigns
  por_id <- setNames(todas, vapply(todas, function(c) as.character(c$campaign_id), ""))
  faltan <- setdiff(ids, names(por_id))
  if (length(faltan)) {
    stop_api(422, "E_COLLECTION_MAIL_REVISION", sprintf("No existe la campaña %s.", paste(faltan, collapse = ", ")))
  }
  ejemplo <- .cmail_one(ejemplo) %||% "femenino"
  if (!(ejemplo %in% names(.CMAIL_EJEMPLOS))) ejemplo <- "femenino"
  envio <- .cmail_one(envio) %||% "primero"
  if (!(envio %in% names(.CMAIL_REVISION_ENVIOS))) {
    stop_api(422, "E_COLLECTION_MAIL_REVISION", "El envío es «primero», «recordatorio» o «ultimo».")
  }
  correos <- lapply(ids, function(id) .cmail_revision_correo(session, por_id[[id]], ejemplo, envio))
  titulo <- .cmail_one(titulo) %||% "Correos para revisar"
  html <- .cmail_revision_pagina(titulo, correos)
  dir.create(file.path(session$dir, "downloads"), recursive = TRUE, showWarnings = FALSE)
  nombre <- paste0(.cmail_campaign_slug(titulo), "_revision.html")
  path <- file.path(session$dir, "downloads", paste0(uuid::UUIDgenerate(), "__", nombre))
  writeLines(html, path, useBytes = TRUE)
  file <- .cmail_register_artifact(sid, path, "mail_revision", nombre, "revision", "text/html", "internal")
  list(ok = TRUE, file = file, campaigns = as.list(ids), ejemplo = ejemplo, envio = envio)
}
