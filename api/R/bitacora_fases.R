# =============================================================================
# Catálogo de fases del estudio (ADR 0047)
# =============================================================================
#
# Dueño ÚNICO de la tabla fase → módulos. La fase es lo que el usuario elige al
# construir el cronograma; los módulos son el cableado interno que permite
# contrastar la fase planificada contra la evidencia real de la sesión.
#
# ¿Por qué una lista curada de seis y no los ocho módulos de la app? Porque el
# usuario piensa en fases de estudio ("el campo va del 3 al 20"), no en módulos
# de software. Dashboard y Bitácora son módulos pero casi nunca son una fase de
# trabajo; en cambio Procesamiento es una sola fase mental que en la app son
# cuatro secciones. La tabla traduce entre los dos vocabularios.
#
# ¿Por qué no texto libre? Porque el vínculo con módulos es lo que hace útil al
# cronograma frente a un Excel: sin él se pierde `evidence_state`, y con eso el
# cronograma vuelve a ser una lista de fechas que nadie contrasta con nada.

# El orden es el del estudio y se respeta en la UI: es el recorrido natural, no
# un orden alfabético.
#
# Cada fase declara DOS cosas distintas que antes estaban mezcladas:
#
#   `modulo` / `seccion` — a qué parte de la app se refiere la etapa. Es lo que
#     le da IDENTIDAD: el frontend resuelve de ahí el ícono y el color del
#     módulo, para que el usuario reconozca la etapa por el mismo sello que ve
#     en la barra de módulos y en el home. Una etapa que no se puede señalar en
#     la app es una etapa que el usuario no puede accionar.
#
#   `evidencia` — con qué claves de sesión se comprueba si esa etapa ya
#     arrancó de verdad. No coinciden con el slug del módulo: "carga" y
#     "validacion" son secciones de Procesamiento, y "reportes" no es un módulo
#     sino el conjunto de salidas. Mezclarlas con la identidad era lo que hacía
#     que una fase no tuviera un módulo al que apuntar.
.bit_fases_catalogo <- function() {
  list(
    # NO hay fase «Diseño». El cronograma se construye DESDE la bitácora, así
    # que una fase que apunta al módulo donde ya estás parado no declara nada:
    # es la superficie mirándose a sí misma. Lo que se planifica desde acá es lo
    # que viene después del diseño.
    list(id = "muestra", label = "Muestra",
         modulo = "calc-muestra", seccion = "",
         evidencia = c("calc-muestra")),
    list(id = "instrumento", label = "Instrumento",
         modulo = "editor-xlsform", seccion = "",
         evidencia = c("editor-xlsform")),
    list(id = "campo", label = "Campo",
         modulo = "monitoreo", seccion = "",
         evidencia = c("monitoreo", "hojas-ruta", "recopiladores")),
    # Procesamiento es la tubería que deja la base limpia y codificada: carga,
    # validación y codificación.
    list(id = "procesamiento", label = "Procesamiento",
         modulo = "procesamiento", seccion = "carga",
         evidencia = c("carga", "validacion", "codificacion")),
    # Entregables son Analítica y Gráficos, que en la app son DOS SECCIONES del
    # mismo módulo Procesamiento. Comparte con él el acento teal a propósito:
    # son el mismo módulo y fingir lo contrario mentiría sobre dónde vive la
    # funcionalidad. Lo que las distingue es el ícono de la sección, que es
    # justamente lo que el usuario ve al entrar. El Dashboard cuenta como
    # evidencia de entregable pero no da identidad: es un plus, no el camino.
    list(id = "entregables", label = "Entregables",
         modulo = "procesamiento", seccion = "graficos",
         evidencia = c("analitica", "graficos", "dashboard", "reportes"))
  )
}

# Fase de destino de todo lo que no se pudo clasificar.
BITACORA_FASE_FALLBACK <- "campo"

BITACORA_FASES <- c("muestra", "instrumento", "campo", "procesamiento", "entregables")

.bit_fase_valida <- function(fase) {
  calc_enum(fase, BITACORA_FASES, "")
}

.bit_fase_label <- function(fase) {
  hit <- Filter(function(f) identical(f$id, fase), .bit_fases_catalogo())
  if (!length(hit)) return("")
  hit[[1]]$label
}

# Claves de evidencia de la fase. Es lo que viaja como `sync_targets` y lo que
# alimenta `.plan_windows`.
.bit_fase_modulos <- function(fase) {
  hit <- Filter(function(f) identical(f$id, fase), .bit_fases_catalogo())
  if (!length(hit)) return(character(0))
  hit[[1]]$evidencia
}

# Identidad de la fase: a qué módulo (y opcionalmente a qué sección) apunta.
# El frontend resuelve de acá el ícono y el color.
.bit_fase_identidad <- function(fase) {
  hit <- Filter(function(f) identical(f$id, fase), .bit_fases_catalogo())
  if (!length(hit)) return(list(modulo = "", seccion = ""))
  list(modulo = hit[[1]]$modulo, seccion = hit[[1]]$seccion)
}

# --- Traducción desde los `sync_targets` heredados ---------------------------
#
# El vocabulario viejo de `sync_targets` NO son slugs de módulo: mezcla módulos
# reales con nombres inventados. `reportes` no existe como módulo de la app, y
# `plan-trabajo` es literalmente el fallback de "la regex no supo". La tabla
# cubre los siete valores que `.plan_task_targets` puede producir, para que
# migrar un .pulso viejo no deje ninguna tarea sin fase.
.BIT_TARGET_A_FASE <- c(
  "monitoreo"      = "campo",
  "hojas-ruta"     = "campo",
  "recopiladores"  = "campo",
  "reportes"       = "entregables",
  "graficos"       = "entregables",
  "dashboard"      = "entregables",
  # Analítica produce salidas, no la base: va con Entregables, junto a Gráficos.
  "analitica"      = "entregables",
  "carga"          = "procesamiento",
  "validacion"     = "procesamiento",
  "codificacion"   = "procesamiento",
  "calc-muestra"   = "muestra",
  "editor-xlsform" = "instrumento",
  # Una tarea que apuntaba al propio módulo de la bitácora no describe una
  # etapa del estudio: cae en el fallback como cualquier otra sin clasificar.
  "diseno-estudio" = "campo",
  # El fallback histórico de la regex. Cae en Campo porque es donde arranca lo
  # que se planifica de verdad, y porque en un estudio de encuestas lo que no se
  # supo clasificar casi siempre es trabajo de campo. Nunca se descarta la
  # tarea: eso dejaría el cronograma con huecos.
  "plan-trabajo"   = "campo"
)

# Deriva la fase desde los targets heredados. Con varios targets gana el
# primero que mapea, en el orden en que vienen: `.plan_task_targets` los emite
# en orden de especificidad y el primero es el más informativo.
.bit_fase_de_targets <- function(targets) {
  if (is.null(targets)) return(BITACORA_FASE_FALLBACK)
  if (is.list(targets)) targets <- unlist(targets, recursive = TRUE, use.names = FALSE)
  targets <- as.character(targets)
  targets <- targets[nzchar(targets)]
  if (!length(targets)) return(BITACORA_FASE_FALLBACK)
  for (t in targets) {
    fase <- .BIT_TARGET_A_FASE[[t]]
    if (!is.null(fase)) return(fase)
  }
  BITACORA_FASE_FALLBACK
}

# Camino inverso: los `sync_targets` que corresponden a una fase elegida. Es lo
# que mantiene vivas las ventanas de `.plan_windows` cuando el usuario declara
# la fase en vez de dejar que la regex adivine.
.bit_targets_de_fase <- function(fase) {
  modulos <- .bit_fase_modulos(.bit_fase_valida(fase))
  if (!length(modulos)) return(character(0))
  modulos
}

# --- Evidencia real por fase -------------------------------------------------
#
# Extiende a conjuntos de módulos el `switch` que `.plan_sync_preview` hacía
# módulo por módulo. Una fase tiene evidencia si CUALQUIERA de sus módulos la
# tiene: planificaste "Campo" y hay snapshot de monitoreo, entonces el campo
# arrancó, sin importar que hojas de ruta esté vacío.
.bit_modulo_tiene_evidencia <- function(s, modulo) {
  switch(modulo,
    monitoreo      = !is.null(s$monitoreo_snapshot) || length(s$monitoreo_sources %||% list()) > 0L,
    `hojas-ruta`   = !is.null(s$hojas_ruta_config) || length(s$hojas_ruta_runs %||% list()) > 0L,
    recopiladores  = !is.null(s$calc_muestra_aulas_export),
    reportes       = isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok) || !is.null(s$monitoreo_publication),
    graficos       = isTRUE(s$graficos_ppt_ok) || isTRUE(s$graficos_word_ok),
    dashboard      = !is.null(s$dashboard_source),
    carga          = !is.null(s$rp_data) || length(s$rp_data_sources %||% list()) > 0L,
    validacion     = !is.null(s$evaluacion) || !is.null(s$plan_result),
    codificacion   = length(s$codif_por_base %||% list()) > 0L,
    analitica      = !is.null(s$analitica_rp_data),
    `calc-muestra` = !is.null(s$calc_muestra_estudio) || !is.null(s$calc_muestra_aulas_selection),
    `editor-xlsform` = !is.null(s$rp_inst) || length(s$rp_inst_sources %||% list()) > 0L,
    `diseno-estudio` = length(s$diseno_estudio_bitacora %||% list()) > 0L,
    FALSE
  )
}

.bit_fase_evidencia <- function(s, fase) {
  modulos <- .bit_fase_modulos(.bit_fase_valida(fase))
  if (!length(modulos)) return(FALSE)
  any(vapply(modulos, function(m) isTRUE(.bit_modulo_tiene_evidencia(s, m)), logical(1)))
}

# --- Resolución de la fase de una tarea --------------------------------------
#
# Regla del ADR 0047: si el usuario la eligió (`fase_manual`), manda. Si no, se
# deriva de los targets — que a su vez pueden venir de la regex. La derivación
# SUGIERE; nunca pisa una elección.
.bit_fase_de_tarea <- function(t) {
  if (is.null(t) || !is.list(t)) return(BITACORA_FASE_FALLBACK)
  declarada <- .bit_fase_valida(t$fase)
  if (isTRUE(t$fase_manual) && nzchar(declarada)) return(declarada)
  if (nzchar(declarada)) return(declarada)
  .bit_fase_de_targets(t$sync_targets)
}
