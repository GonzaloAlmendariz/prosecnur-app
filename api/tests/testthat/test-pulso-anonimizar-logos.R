source("setup-load-all.R")

# Meta A · higiene de datos de cliente. Un logo de `estilo_cliente.logos` (ADR 0094) viaja en `files/` del `.pulso` e
# identifica al cliente igual que su nombre. Al anonimizar: PNG neutro del mismo aspecto bajo un `file_id` nuevo, nombre
# «Logo del cliente», el PNG original fuera de `files/` y ni su nombre, ni su archivo, ni su ruta en ninguna entrada del
# zip. Mutante que mata: `.pulso_anon_logos_neutralizar` sin efecto (logos intactos) → el gate de PII los marca.

.pal_png <- function(ancho, alto, rgb) {
  arr <- array(0, dim = c(alto, ancho, 3L))
  for (k in 1:3) arr[, , k] <- rgb[[k]]
  jsonlite::base64_enc(png::writePNG(arr))
}

.pal_proyecto <- function(env = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = env)
  session_set(sid, "estudio", list(
    bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
    active_base = "docentes", processing_mode = "independent_siblings"))
  unsa <- .graficos_estilo_cliente_subir_logo(sid, list(nombre = "Universidad Nacional de San Agustin UNSA",
                                                        data_base64 = .pal_png(300L, 100L, c(0.8, 0.1, 0.1))))
  socio <- .graficos_estilo_cliente_subir_logo(sid, list(nombre = "Consorcio Quimera",
                                                         data_base64 = .pal_png(120L, 120L, c(0.1, 0.3, 0.9))))
  estilo <- function(...) list(estilo_cliente = list(logos = list(...)))
  s <- session_get(sid)
  # Portador de proyecto con los dos logos; la base «estudiantes» con su propio estilo; «docentes» sin estilo.
  s$graficos_config <- c(list(plan = list(slides = list())), list(estilo_cliente = list(ambito = "base", logos = list(
    portada_izquierda = list(file_id = unsa$file_id, nombre = "Universidad Nacional de San Agustin UNSA"),
    contraportada = list(file_id = socio$file_id, nombre = "Consorcio Quimera")))))
  s$graficos_config_por_base <- list(
    docentes = list(plan = list(slides = list())),
    estudiantes = c(list(plan = list(slides = list())),
                    estilo(portada_derecha = list(file_id = unsa$file_id, nombre = "Universidad Nacional de San Agustin UNSA"))))
  s$graficos_consolidado_draft <- list(config = estilo(contraportada = list(file_id = socio$file_id, nombre = "Consorcio Quimera")))
  for (k in c("graficos_config", "graficos_config_por_base", "graficos_consolidado_draft")) session_set(sid, k, s[[k]])
  rutas <- vapply(c(unsa$file_id, socio$file_id), function(f) session_get(sid)$files[[f]]$path, character(1))
  list(sid = sid, unsa = unsa, socio = socio, dir = s$dir, rutas = unname(rutas))
}

.pal_entradas <- function(path) {
  stage <- tempfile("pal-"); dir.create(stage)
  zip::unzip(path, exdir = stage)
  rutas <- list.files(stage, recursive = TRUE, full.names = TRUE)
  list(stage = stage, rutas = rutas, rel = list.files(stage, recursive = TRUE),
       state = readRDS(file.path(stage, "state.rds")))
}

# Bytes de cada entrada del zip; el state.rds se busca DEScomprimido (serializado) para que el xz/gzip no esconda nada.
.pal_bytes <- function(e) {
  c(lapply(e$rutas[basename(e$rutas) != "state.rds"], function(p) readBin(p, "raw", n = file.info(p)$size)),
    list(serialize(e$state, NULL)))
}

.pal_anonimizar <- function(env = parent.frame()) {
  p <- .pal_proyecto(env)
  origen <- tempfile(fileext = ".pulso")
  build_pulso(p$sid, origen, project_name = "Estudio")
  destino <- tempfile(fileext = ".pulso")
  reporte <- pulso_anonimizar_archivo(origen, destino, sal = "sal-logos", slug = "logos")
  list(p = p, origen = origen, destino = destino, reporte = reporte)
}

test_that("los logos del cliente se sustituyen por un PNG neutro en todos los portadores", {
  r <- .pal_anonimizar()
  viejos <- c(r$p$unsa$file_id, r$p$socio$file_id)
  expect_equal(r$reporte$n_logos_neutralizados, 2L)
  e <- .pal_entradas(r$destino)
  s <- e$state

  refs <- .pulso_anon_logos_refs(s)
  # proyecto x2, base estudiantes, borrador y la receta que el guardado deriva del borrador
  expect_equal(nrow(refs), 5L)
  expect_identical(s$graficos_consolidado$config$estilo_cliente$logos$contraportada$nombre, "Logo del cliente")
  expect_true(all(refs$nombre == "Logo del cliente"))
  expect_false(any(refs$file_id %in% viejos))
  expect_length(unique(refs$file_id), 2L)                                     # mismo logo -> mismo fid nuevo
  expect_null(s$graficos_config_por_base$docentes$estilo_cliente)             # la hermana sin estilo sigue sin estilo
  expect_identical(s$graficos_config$estilo_cliente$ambito, "base")           # el resto del estilo se preserva
  expect_identical(names(s$graficos_config$estilo_cliente$logos), c("portada_izquierda", "contraportada"))

  # files/: fuera los PNG originales, dentro los neutros con su entrada del file store y sin ruta.
  pngs <- e$rel[startsWith(e$rel, "files/")]
  expect_false(any(vapply(viejos, function(f) any(grepl(f, pngs, fixed = TRUE)), logical(1))))
  for (fid in unique(refs$file_id)) {
    hit <- e$rutas[startsWith(basename(e$rutas), paste0(fid, "__"))]
    expect_length(hit, 1L)
    meta <- s$files[[fid]]
    expect_match(meta$original_name, "^logo_cliente_[0-9]+\\.png$")
    expect_null(meta$path)
    sha <- digest::digest(file = hit, algo = "sha256")
    expect_false(sha %in% c(r$p$unsa$sha256, r$p$socio$sha256))
  }
  expect_false(any(viejos %in% names(s$files)))

  # Mismo aspecto: el de UNSA era 3:1 y el del socio 1:1.
  fid_unsa <- s$graficos_config$estilo_cliente$logos$portada_izquierda$file_id
  d <- .pulso_anon_logo_dims(e$rutas[startsWith(basename(e$rutas), paste0(fid_unsa, "__"))])
  expect_equal(unname(d[["ancho"]] / d[["alto"]]), 3)
  fid_socio <- s$graficos_config$estilo_cliente$logos$contraportada$file_id
  d <- .pulso_anon_logo_dims(e$rutas[startsWith(basename(e$rutas), paste0(fid_socio, "__"))])
  expect_equal(unname(d[["ancho"]] / d[["alto"]]), 1)

  # Ningún rastro por bytes en ninguna entrada del zip: nombres, archivos originales, file_ids viejos ni la ruta.
  bytes <- .pal_bytes(e)
  agujas <- c("San Agustin", "UNSA", "Quimera", "logo_universidad", "logo_consorcio", viejos, r$p$rutas, basename(r$p$rutas), file.path(r$p$dir, "logos"))
  for (a in agujas) {
    hay <- vapply(bytes, function(b) length(grepRaw(a, b, fixed = TRUE)) > 0L, logical(1))
    expect_false(any(hay), info = a)
  }

  # El gate queda limpio y la anonimización es reproducible con la misma sal.
  expect_equal(nrow(pulso_detectar_pii(r$destino)), 0L)
  destino2 <- tempfile(fileext = ".pulso")
  pulso_anonimizar_archivo(r$origen, destino2, sal = "sal-logos", slug = "logos")
  e2 <- .pal_entradas(destino2)
  expect_identical(.pulso_anon_logos_refs(e2$state), refs)
})

test_that("el .pulso anonimizado abre y el logo neutro resuelve (no se poda)", {
  r <- .pal_anonimizar()
  ld <- suppressMessages(load_pulso(r$destino))
  withr::defer(session_delete(ld$session_id))
  sid2 <- ld$session_id
  cfg <- session_get(sid2)$graficos_config
  ruta <- .graficos_estilo_cliente_resolver(sid2, .graficos_normalize_config(cfg, sid = sid2))$logos$portada_izquierda
  expect_true(file.exists(ruta))
  expect_identical(.graficos_estilo_cliente_nombre_de_ref(session_get(sid2), cfg$estilo_cliente$logos$portada_izquierda$file_id),
                   "el logo «Logo del cliente» (portada, izquierda)")
})

test_that("un logo sin PNG en files/ se retira en vez de dejar su nombre", {
  s <- list(graficos_config = list(estilo_cliente = list(logos = list(
    contraportada = list(file_id = "fid-huerfano", nombre = "Cliente Secreto")))))
  d <- tempfile("files-"); dir.create(d)
  out <- .pulso_anon_logos_neutralizar(s, d, sal = "x")
  expect_null(out$estado$graficos_config$estilo_cliente$logos)
  expect_identical(out$retirados, "fid-huerfano")
  expect_equal(out$neutralizados, 0L)
})

test_that("el gate marca logos del cliente sin anonimizar (mutante: el anonimizador no toca logos)", {
  p <- .pal_proyecto()
  origen <- tempfile(fileext = ".pulso")
  build_pulso(p$sid, origen)
  h <- pulso_detectar_pii(origen)
  expect_true(all(c("logo_nombre", "logo_archivo", "logo_cliente") %in% h$tipo))

  local_mocked_bindings(.pulso_anon_logos_neutralizar = function(estado, files_dir, sal) {
    list(estado = estado, neutralizados = 0L, retirados = character())
  })
  destino <- tempfile(fileext = ".pulso")
  pulso_anonimizar_archivo(origen, destino, sal = "sal-logos")
  h2 <- pulso_detectar_pii(destino)
  expect_true(all(c("logo_nombre", "logo_cliente") %in% h2$tipo))
})
