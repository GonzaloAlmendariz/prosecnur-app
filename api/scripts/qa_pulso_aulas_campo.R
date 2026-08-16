# Siembra un .pulso de QA con un estudio de aulas ya en campo.
#
# Existe porque ocho reparaciones (L15-L22 del GOAL «el aula se recoge sola»)
# estaban respaldadas por simulacion y por tests, pero **nadie las habia visto
# en pantalla**. La nota del GOAL decia que era imposible sin recorrer el flujo
# entero desde Calculo de muestra, porque "la whitelist de persistencia guarda
# el plan y poco mas".
#
# Esa premisa era FALSA y comprobarla es lo que desbloqueo esto: la persistencia
# del `.pulso` es una lista NEGRA, no blanca. `build_pulso()` serializa el
# estado completo salvo los caches que `.pulso_strip_caches()` nombra uno a uno.
# El plan, la config de aulas, los partes de campo y las respuestas de
# `monitoreo_snapshot$data` viajan todos.
#
# El estudio sembrado es sintetico y esta construido para que los ocho
# fenomenos sean VISIBLES a la vez. No es una muestra realista: es un banco de
# pruebas donde cada aula existe para hacer fallar un control distinto.
#
#   Rscript api/scripts/qa_pulso_aulas_campo.R /ruta/destino.pulso

suppressWarnings(suppressMessages(pkgload::load_all("api", quiet = TRUE)))

args <- commandArgs(trailingOnly = TRUE)
destino <- args[1]
if (is.na(destino) || !nzchar(destino)) {
  destino <- file.path(tempdir(), "qa_aulas_campo.pulso")
}
# `--escala 2025` siembra el operativo entero —170 titulares y 26 reemplazos
# consumidos, la forma que el campo tuvo de verdad— en vez de las siete aulas de
# banco de pruebas. Las tablas de 196 filas son donde el recorte de columnas y el
# reparto de alto se ponen a prueba; con nueve no se ve nada de eso.
ESCALA_2025 <- any(args == "--escala") && any(args == "2025")

# --- El plan -----------------------------------------------------------------
# Cinco titulares y dos reservas encadenadas. Cada aula tiene un papel:
#
#   CH 1  aplicada y completa           -> avance real, no cero (L15)
#   CH 2  5 de 30                       -> NO debe decir «cerrando» (L17)
#   CH 3  sin una sola respuesta        -> brecha entera (L18)
#   CH 4  caida, con su cadena activa   -> la cadena se ve (L19)
#   CH 5  agendada y sin campo aun      -> estado de muestra distinto del de aplicacion (L30)
aula <- function(codigo, unidad, rol, facultad, elegibles, validas_meta,
                 estado_muestra, reemplaza = NULL, orden = 1, s1 = "Mujer", s2 = "Hombre") {
  out <- list(
    classroom_id = codigo, collection_unit_id = unidad, operational_code = codigo,
    label = sprintf("Aula %s", codigo), course_name = sprintf("Curso %s", codigo),
    schedule = "Lun 08:00", teacher = sprintf("Docente %s", codigo),
    teacher_phone = sprintf("9%08d", abs(sum(utf8ToInt(codigo))) * 137 %% 100000000),
    teacher_email = sprintf("docente.%s@ejemplo.edu", tolower(gsub("[^A-Za-z0-9]", "", codigo))),
    sample_role = rol, wave = "M1", orden = orden,
    eligible_n = elegibles, expected_valid = validas_meta,
    faculty = facultad, stratum = facultad, level = "Pregrado",
    sample_status = estado_muestra,
    contact_attempts = if (identical(estado_muestra, "agendada")) 1L else 3L,
    contact_medium = "Correo",
    # Composicion por sexo: sin ella la seccion de cuotas sale vacia (L20).
    sex_top_1 = s1, sex_top_1_n = ceiling(elegibles * 0.55),
    sex_top_2 = s2, sex_top_2_n = elegibles - ceiling(elegibles * 0.55),
    link = sprintf("https://ee.kobotoolbox.org/x/abc123?d[collectorID]=%s", codigo)
  )
  if (!is.null(reemplaza)) out$replacement_for <- reemplaza
  out
}

plan <- list(
  aula("CH 1", "u-ch1", "titular", "Ciencias", 30, 20, "agendada", orden = 1),
  aula("CH 2", "u-ch2", "titular", "Ciencias", 30, 20, "agendada", orden = 2),
  aula("CH 3", "u-ch3", "titular", "Letras",   25, 18, "agendada", orden = 3),
  aula("CH 4", "u-ch4", "titular", "Letras",   25, 18, "reemplazada", orden = 4),
  aula("CH 5", "u-ch5", "titular", "Derecho",  40, 28, "agendada", orden = 5),
  # Cadena de cuatro: con una sola reserva no se ve si la tabla distingue el
  # orden ni el estado, que es justo lo que importa al decidir a quien activar.
  aula("R 4.1", "u-r41", "chain_reserve", "Letras", 22, 16, "reemplazada",
       reemplaza = "CH 4", orden = 6),
  aula("R 4.2", "u-r42", "chain_reserve", "Letras", 20, 14, "agendada",
       reemplaza = "CH 4", orden = 7),
  aula("R 4.3", "u-r43", "chain_reserve", "Letras", 21, 15, "en_reserva",
       reemplaza = "CH 4", orden = 8),
  aula("R 4.4", "u-r44", "chain_reserve", "Letras", 19, 13, "en_reserva",
       reemplaza = "CH 4", orden = 9)
)

# --- Las respuestas ----------------------------------------------------------
# Llegan como las devuelve Kobo cuando el QR lo genero este mismo sistema: el
# aula viaja en `collectorID`, no en una columna que alguien mapeo a mano.
respuesta <- function(unidad, sexo, valida = TRUE) list(
  collectorID = unidad,
  sexo = sexo,
  `_validation_status` = if (valida) "" else "on_hold",
  `_submission_time` = "2026-08-14T10:00:00"
)

filas <- c(
  # CH 1 llega a su meta.
  lapply(seq_len(20), function(i) respuesta("u-ch1", if (i %% 2) "Mujer" else "Hombre")),
  # CH 2 con 5 de 30: el caso que antes se declaraba «cerrando».
  lapply(seq_len(5), function(i) respuesta("u-ch2", "Mujer")),
  # La reserva activada produce campo real; su titular no.
  lapply(seq_len(9), function(i) respuesta("u-r41", if (i %% 3) "Hombre" else "Mujer")),
  # Un aula que no existe en el plan: el aviso que antes nunca saltaba (L22).
  list(respuesta("u-fantasma", "Mujer"))
)

data <- do.call(rbind, lapply(filas, function(r) as.data.frame(r, stringsAsFactors = FALSE)))
names(data) <- gsub("^X_", "_", names(data))

partes <- list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 22,
       refusals = 1, duplicates = 1, effective_surveys = 20,
       applicator = "Equipo A", application_status = "aplicada"),
  list(operational_code = "CH 2", intento = 1L, observed_students = 8,
       refusals = 2, duplicates = 0, effective_surveys = 5,
       applicator = "Equipo A", application_status = "aplicada"),
  # Descuadre deliberado: 12 - 1 - 0 son 11, no 9. Es el control de L33.
  list(operational_code = "R 4.1", intento = 1L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applicator = "Equipo B", application_status = "aplicada")
)

if (ESCALA_2025) {
  facs <- c("Ciencias e Ingenieria", "Estudios Generales Letras", "Gestion",
            "Arquitectura", "Educacion", "Derecho")
  base <- function(cod, rol, fac, i, repl = NULL, ord = NULL, est = "agendada") {
    o <- list(classroom_id = cod, operational_code = cod, label = paste("Aula", cod),
              course_name = paste("Curso", cod), schedule = "Lun 08:00",
              teacher = paste("Docente", cod), teacher_phone = sprintf("9%08d", i * 137 %% 1e8),
              faculty = fac, stratum = fac, level = "Pregrado", sample_role = rol,
              wave = if (rol == "titular") "M1" else sprintf("M%d", (ord %||% 1) + 1),
              orden = i, eligible_n = 20 + (i %% 25), enrolled_total = 25 + (i %% 25),
              expected_valid = max(1, round((20 + (i %% 25)) * 0.7)), sample_status = est,
              sex_top_1 = "F", sex_top_1_n = 11 + (i %% 8),
              sex_top_2 = "M", sex_top_2_n = 9 + (i %% 6),
              link = sprintf("https://ee.kobotoolbox.org/x/abc?d[collectorID]=%s", cod))
    if (!is.null(repl)) { o$replacement_for <- repl; o$replacement_order <- ord }
    o
  }
  plan <- c(
    lapply(1:170, function(i) base(sprintf("CH %d", i), "titular", facs[[1 + (i %% 6)]], i,
                                   est = if (i <= 24) "reemplazada" else "agendada")),
    lapply(1:24, function(k) base(sprintf("R %d.1", k), "chain_reserve", facs[[1 + (k %% 6)]],
                                  170 + k, repl = sprintf("CH %d", k), ord = 1,
                                  est = if (k <= 2) "reemplazada" else "agendada")),
    lapply(1:2, function(k) base(sprintf("R %d.2", k), "chain_reserve", facs[[1 + (k %% 6)]],
                                 194 + k, repl = sprintf("CH %d", k), ord = 2))
  )
  aplicadas <- Filter(function(r) !identical(r$sample_status, "reemplazada"), plan)
  partes <- lapply(seq_along(aplicadas), function(i) {
    u <- aplicadas[[i]]; asist <- as.numeric(u$eligible_n); rech <- i %% 3; dup <- i %% 4
    efec <- asist - rech - dup
    if (i %in% c(7L, 88L)) efec <- efec - 1
    list(operational_code = as.character(u$operational_code), intento = 1L,
         observed_students = asist, refusals = rech, duplicates = dup,
         effective_surveys = efec, applied_by = sprintf("Equipo %d", 1 + (i %% 6)))
  })
  data <- do.call(rbind, lapply(seq_len(600), function(i) data.frame(
    collectorID = sprintf("CH %d", 25 + (i %% 145)), sexo = if (i %% 2) "F" else "M",
    stringsAsFactors = FALSE)))
}

sid <- session_create()
session_set(sid, "monitoreo_aulas_plan", plan)
session_set(sid, "monitoreo_aulas_partes_campo", partes)
session_set(sid, "monitoreo_config", monitoreo_normalize_config(list(
  monitoreo_profile = list(family = "aulas_universitarias", variant = "multi_actor",
                           status = "active", route_selected = TRUE),
  aulas_universitarias = list(
    enabled = TRUE, plan = plan, partes_campo = partes,
    # SIN `status_var`: es lo que hace hoy un estudio real de Kobo recien
    # conectado. Declararlo apuntando a `_validation_status` descarta TODAS las
    # respuestas, porque Kobo deja esa columna vacia mientras nadie las revisa
    # a mano —y "" no esta entre los estados validos. Es la otra cara de L12.
    source_mapping = list(collector_var = "collectorID"),
    # Siete columnas huerfanas, como las que trae la Base de control del estudio
    # de 2025: tienen datos y su cabecera esta vacia en la hoja.
    control_sin_nombre = 7L
  )
)))
session_set(sid, "monitoreo_snapshot", list(
  synced_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  data = data
))
session_set(sid, "monitoreo_sources", list(list(
  id = "src-kobo-aulas", kind = "kobo", label = "Aplicacion en aulas",
  role = "principal", status = "ready"
)))

invisible(capture.output(build_pulso(sid, destino, project_name = "QA aulas en campo")))

tablero <- monitoreo_aulas_dashboard(plan, data, monitoreo_aulas_normalize_config(list(
  enabled = TRUE, plan = plan, partes_campo = partes,
  source_mapping = list(collector_var = "collectorID"),
  control_sin_nombre = 7L
)))

cat(sprintf("proyecto: %s (%.1f KB)\n", destino, file.size(destino) / 1024))
cat(sprintf("aulas: %s · respuestas sembradas: %s\n", length(plan), nrow(data)))
k <- tablero$kpis %||% list()
cat(sprintf("KPI aulas aplicadas: %s · validas: %s\n",
            k$aulas_aplicadas %||% 0L, k$respuestas_validas %||% 0L))
seccion <- function(titulo, filas, campos) {
  cat(sprintf("\n%s (%s)\n", titulo, length(filas)))
  for (r in utils::head(filas, 8)) {
    cat("  ", paste(vapply(campos, function(k) sprintf("%s=%s", k, r[[k]] %||% "-"), character(1)),
                    collapse = " · "), "\n", sep = "")
  }
}
# `application_state` vive en `course_status`, NO en `agenda`: la agenda es el
# plan con sus contadores, y el estado de aplicacion es un derivado aparte.
# Mirarlo en la lista equivocada devuelve vacio y parece un defecto.
seccion("Estado de aplicacion por aula", tablero$course_status %||% list(),
        c("operational_code", "respuestas_validas", "expected_valid", "brecha", "application_state"))
seccion("Avance por estrato", tablero$avance_por_estrato %||% list(),
        c("stratum", "aulas", "respuestas_validas", "brecha"))
seccion("Reemplazos", tablero$reemplazos %||% list(),
        c("operational_code", "replacement_for", "sample_role"))
seccion("Cuotas sexo x facultad", tablero$cuotas_sexo_facultad %||% tablero$quotas_sex_faculty %||% list(),
        c("faculty", "sex", "target", "observed", "status"))
cat("\nControles\n")
for (r in (tablero$validation %||% list())) {
  cat(sprintf("  [%s] %s — %s\n", r$status %||% "?", r$check %||% "?", r$detail %||% ""))
}
