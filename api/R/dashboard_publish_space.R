# =============================================================================
# Lo que se copia al Space público: LISTA PERMITIDA (ADR 0122 §9)
# =============================================================================
#
# El Space se arma copiando el código de la app desde su raíz local. Antes se
# copiaban api/, frontend/ y launcher/ enteros con una lista NEGRA de rutas y
# extensiones, y pasaba todo lo que nadie había previsto: capturas de QA
# (frontend/tmp, frontend/output: 117 PNG de pantallas internas, algunas de
# ACNUR), auditorías de instrumentos de clientes (api/outputs, CSV), fixtures...
# Ahora sólo entra lo que el Dockerfile necesita para construir y correr:
#
# - Dockerfile y .dockerignore;
# - el paquete: api/DESCRIPTION, api/NAMESPACE, api/R/*.R y, de api/inst, sólo
#   las carpetas de recursos que el código lee (catálogos, fuentes, íconos,
#   logos del estándar, croquis, recetario), con extensiones de recurso;
# - launcher/*.R;
# - el frontend para compilarlo: su configuración, src/ (sin tests) y public/.
# Los PNG entran sólo desde esas carpetas de recursos (logos del front, íconos
# de dimensiones del dashboard), nunca desde otro lado.
#
# Y si la raíz es un repositorio git, además, sólo lo VERSIONADO: una carpeta
# local que alguien deja en el árbol no viaja aunque calce con la lista.

.SPACE_PERMITIDOS <- c(
  "^Dockerfile$",
  "^\\.dockerignore$",
  "^api/(DESCRIPTION|NAMESPACE)$",
  "^api/R/[^/]+\\.R$",
  "^api/inst/(catalogos|croquis|estandar|fonts|ppt_assets|recetario|scripts)/.+\\.(json|png|svg|webp|ttf|otf|woff2?|txt|md|mjs)$",
  "^api/inst/fonts/.+/(COPYING|LICENSE[^/]*)$",
  "^launcher/[^/]+\\.R$",
  "^frontend/(package\\.json|pnpm-lock\\.yaml|pnpm-workspace\\.yaml|index\\.html|tsconfig[^/]*\\.json|vite\\.config\\.(ts|js|mjs))$",
  "^frontend/src/.+\\.(ts|tsx|css|json|svg|png|webp|woff2?|ttf)$",
  "^frontend/public/.+\\.(ico|png|svg|webp|json|txt|webmanifest)$"
)

.SPACE_EXCLUIDOS <- c(
  "(^|/)__tests__/",
  "\\.(test|spec)\\.(ts|tsx|js|mjs)$",
  "(^|/)\\.DS_Store$"
)

.space_versionados <- function(root) {
  git <- Sys.which("git")
  if (!nzchar(git)) return(NULL)
  dentro <- suppressWarnings(tryCatch(
    system2(git, c("-C", shQuote(root), "rev-parse", "--is-inside-work-tree"), stdout = TRUE, stderr = FALSE),
    error = function(e) character(0)))
  if (!identical(trimws(dentro[1] %||% ""), "true")) return(NULL)
  rel <- suppressWarnings(tryCatch(
    system2(git, c("-C", shQuote(root), "ls-files", "--full-name", "--", "Dockerfile", ".dockerignore", "api", "frontend", "launcher"),
            stdout = TRUE, stderr = FALSE),
    error = function(e) character(0)))
  # --full-name da rutas desde la raíz del repo; la raíz de la app puede ser una subcarpeta.
  prefijo <- suppressWarnings(tryCatch(
    system2(git, c("-C", shQuote(root), "rev-parse", "--show-prefix"), stdout = TRUE, stderr = FALSE),
    error = function(e) ""))
  prefijo <- trimws(prefijo[1] %||% "")
  if (nzchar(prefijo)) rel <- sub(paste0("^", .publicacion_regex_literal(prefijo)), "", rel[startsWith(rel, prefijo)])
  rel
}

#' Las rutas relativas a la raíz que se copian al Space (lista permitida).
#' @keywords internal
.space_rutas_permitidas <- function(root) {
  # Los candidatos: en un repo, lo versionado; si no, sólo las carpetas que la
  # lista permite (nunca un recorrido de la raíz entera: node_modules, tmp/...).
  todas <- .space_versionados(root)
  if (is.null(todas)) {
    listar <- function(dir, recursivo = TRUE) {
      d <- file.path(root, dir)
      if (!dir.exists(d)) return(character(0))
      f <- list.files(d, recursive = recursivo, all.files = TRUE, no.. = TRUE)
      file.path(dir, f)
    }
    todas <- c("Dockerfile", ".dockerignore",
               listar("api", FALSE), listar("api/R", FALSE), listar("api/inst"),
               listar("launcher", FALSE), listar("frontend", FALSE), listar("frontend/src"), listar("frontend/public"))
  }
  todas <- todas[file.exists(file.path(root, todas)) & !dir.exists(file.path(root, todas))]
  ok <- Reduce(`|`, lapply(.SPACE_PERMITIDOS, grepl, x = todas, perl = TRUE), FALSE)
  fuera <- Reduce(`|`, lapply(.SPACE_EXCLUIDOS, grepl, x = todas, perl = TRUE), FALSE)
  sort(unique(todas[ok & !fuera]))
}

.space_copiar_permitido <- function(root, stage) {
  for (rel in .space_rutas_permitidas(root)) {
    destino <- file.path(stage, rel)
    dir.create(dirname(destino), recursive = TRUE, showWarnings = FALSE)
    file.copy(file.path(root, rel), destino, overwrite = TRUE, copy.mode = TRUE, copy.date = TRUE)
  }
  invisible(TRUE)
}
