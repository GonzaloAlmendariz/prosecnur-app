# =============================================================================
# monitoreo_telefonico_no_barridos.R — Seguimiento de casos sin barrer
# =============================================================================
#
# Pedido de Gonzalo (2026-10-27): «aún no veo un buen seguimiento de los no
# barrido; en principio es grave que la gente no barra sus casos cuando ya ha
# pasado varios días». Hasta aquí «No barrido» era un conteo por responsable
# (`no_barridos_responsable`): no decía desde cuándo ni qué casos.
#
# «No barrido» es un caso ASIGNADO que todavía no tiene ningún intento en la
# hoja (la máscara `no_barrido` que ya calcula `.monitoreo_report_phone_blocks`).
# Un caso sin responsable no es atraso de nadie (la reserva del RMS que aún no
# entra, por ejemplo): queda fuera de este bloque y se sigue contando en
# `no_barridos_responsable` como «Sin asignar».
#
# La hoja guarda UNA fila por caso y su «Fecha» es la del último intento: un
# caso sin barrer no trae fecha propia. La antigüedad se cuenta desde una
# referencia, en este orden, y cada fila publica cuál usó:
#   1. `asignacion`: una columna de fecha de asignación en la hoja, si el
#      equipo la lleva (alias en `.MONITOREO_NO_BARRIDOS_ASIGNACION`).
#   2. `primera_llamada_operador`: el primer intento registrado por ese
#      responsable; desde ese día ya estaba trabajando su lista.
#   3. `inicio_campo`: el primer intento registrado en toda la hoja, para el
#      responsable que todavía no registró ninguno.
#   4. `sin_referencia`: la hoja no trae ninguna fecha legible.
# Las fechas de otro año que el grueso de la hoja (un «2020» tecleado por
# error) no cuentan como referencia, igual que en Control › Barrido.
#
# Los días y la severidad NO se calculan aquí: el frente los cuenta contra el
# corte (`synced_at`), como la cola de insistencia, y los umbrales viven en un
# solo lugar (`noBarridosModel.ts`).
#
# Bloque `no_barridos_casos` (una fila por caso asignado sin barrer):
#   CodPulso · Responsable · Variable cuota · Cuota · Origen · Fecha referencia
#   · Referencia · Primera llamada operador · Ultima llamada operador
# =============================================================================

.MONITOREO_NO_BARRIDOS_MAX_FILAS <- 5000L

.MONITOREO_NO_BARRIDOS_ASIGNACION <- c(
  "Fecha de asignación", "Fecha de asignacion", "Fecha asignación", "Fecha asignacion",
  "Fecha asignado", "Asignado el", "Fecha de reparto", "Fecha reparto"
)

.monitoreo_no_barridos_vacio <- function() {
  data.frame(
    CodPulso = character(0), Responsable = character(0), `Variable cuota` = character(0),
    Cuota = character(0), Origen = character(0), `Fecha referencia` = character(0),
    Referencia = character(0), `Primera llamada operador` = character(0),
    `Ultima llamada operador` = character(0),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

# Fechas ISO legibles; las de otro año que el grueso quedan vacías.
.monitoreo_no_barridos_fechas <- function(valores) {
  iso <- .monitoreo_daily_parse_date_vec(valores)
  iso[is.na(iso)] <- ""
  anios <- substr(iso[nzchar(iso)], 1L, 4L)
  if (length(anios)) {
    modal <- names(sort(table(anios), decreasing = TRUE))[[1]]
    iso[nzchar(iso) & substr(iso, 1L, 4L) != modal] <- ""
  }
  iso
}

#' Casos asignados sin barrer con la fecha desde la que se cuenta su atraso.
#'
#' `ctx` trae los vectores por fila de `phone` que `.monitoreo_report_phone_blocks`
#' ya calculó: `responsables`, `no_barrido`, `dates` (último intento), `keys`
#' y, si hay, `quota_variable` + `quota_values`.
#' @noRd
.monitoreo_telefonico_no_barridos_df <- function(phone, ctx) {
  if (!is.data.frame(phone) || !nrow(phone)) return(.monitoreo_no_barridos_vacio())
  n <- nrow(phone)
  vec <- function(x, default) {
    x <- x %||% rep(default, n)
    if (length(x) != n) x <- rep(default, n)
    x
  }
  no_barrido <- as.logical(vec(ctx$no_barrido, FALSE))
  no_barrido[is.na(no_barrido)] <- FALSE
  responsables <- trimws(as.character(vec(ctx$responsables, "")))
  responsables[is.na(responsables)] <- ""
  sin_asignar <- !nzchar(responsables) | .monitoreo_text_key(responsables) %in% c("sin responsable", "sin asignar")
  idx <- which(no_barrido & !sin_asignar)
  if (!length(idx)) return(.monitoreo_no_barridos_vacio())

  # Sólo los intentos registrados cuentan como llamada: un «No barrido» con
  # fecha tecleada no es una llamada.
  intentos <- .monitoreo_no_barridos_fechas(vec(ctx$dates, ""))
  intentos[no_barrido] <- ""
  con_fecha <- nzchar(intentos)
  inicio_campo <- if (any(con_fecha)) min(intentos[con_fecha]) else ""
  primera <- tapply(intentos[con_fecha], responsables[con_fecha], min)
  ultima <- tapply(intentos[con_fecha], responsables[con_fecha], max)
  primera_de <- function(quien) {
    valor <- unname(primera[quien])
    ifelse(is.na(valor), "", valor)
  }
  ultima_de <- function(quien) {
    valor <- unname(ultima[quien])
    ifelse(is.na(valor), "", valor)
  }

  col_asignacion <- .monitoreo_report_col(phone, .MONITOREO_NO_BARRIDOS_ASIGNACION)
  asignacion <- if (nzchar(col_asignacion)) .monitoreo_no_barridos_fechas(phone[[col_asignacion]]) else rep("", n)

  quien <- responsables[idx]
  primera_op <- primera_de(quien)
  referencia <- asignacion[idx]
  tipo <- ifelse(nzchar(referencia), "asignacion", "")
  usa_primera <- !nzchar(referencia) & nzchar(primera_op)
  referencia[usa_primera] <- primera_op[usa_primera]
  tipo[usa_primera] <- "primera_llamada_operador"
  usa_inicio <- !nzchar(referencia) & nzchar(inicio_campo)
  referencia[usa_inicio] <- inicio_campo
  tipo[usa_inicio] <- "inicio_campo"
  tipo[!nzchar(referencia)] <- "sin_referencia"

  quota_variable <- .monitoreo_scalar(ctx$quota_variable, "")
  quota_values <- as.character(vec(ctx$quota_values, NA_character_))
  quota_values[is.na(quota_values) | !nzchar(trimws(quota_values)) | quota_values %in% "Sin dato"] <- ""
  col_origen <- .monitoreo_report_col(phone, c("Origen"))
  origen <- if (nzchar(col_origen)) trimws(as.character(phone[[col_origen]])) else rep("", n)
  origen[is.na(origen)] <- ""
  keys <- trimws(as.character(vec(ctx$keys, "")))
  keys[is.na(keys)] <- ""

  out <- data.frame(
    CodPulso = keys[idx],
    Responsable = quien,
    `Variable cuota` = rep(quota_variable, length(idx)),
    Cuota = quota_values[idx],
    Origen = origen[idx],
    `Fecha referencia` = referencia,
    Referencia = tipo,
    `Primera llamada operador` = primera_op,
    `Ultima llamada operador` = ultima_de(quien),
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  # Lo más antiguo primero; las referencias vacías al final.
  orden_fecha <- ifelse(nzchar(out$`Fecha referencia`), out$`Fecha referencia`, "9999-99-99")
  out[order(orden_fecha, out$Responsable, out$CodPulso), , drop = FALSE]
}

#' Bloque `no_barridos_casos` del reporte telefónico. Lo llama
#' `.monitoreo_report_phone_blocks`.
#' @noRd
.monitoreo_telefonico_no_barridos_blocks <- function(phone, ctx, from_population = FALSE) {
  if (isTRUE(from_population)) {
    return(list(.monitoreo_report_block(
      "no_barridos_casos", "Casos asignados sin barrer", .monitoreo_no_barridos_vacio(),
      "Sin hoja de barrido: no hay casos asignados que seguir."
    )))
  }
  casos <- .monitoreo_telefonico_no_barridos_df(phone, ctx)
  total <- nrow(casos)
  nota <- "Casos asignados sin ningún intento en la hoja, con la fecha desde la que se cuenta su atraso."
  if (total > .MONITOREO_NO_BARRIDOS_MAX_FILAS) {
    nota <- sprintf("%s Se muestran %s de %s casos.", nota, .MONITOREO_NO_BARRIDOS_MAX_FILAS, total)
  }
  list(.monitoreo_report_block(
    "no_barridos_casos", "Casos asignados sin barrer",
    utils::head(casos, .MONITOREO_NO_BARRIDOS_MAX_FILAS), nota
  ))
}
