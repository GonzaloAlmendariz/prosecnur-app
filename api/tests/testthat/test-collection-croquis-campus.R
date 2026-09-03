# B32: el VERSO de la ficha de campo — croquis estilizado del campus PUCP.
#
# La ficha QR (`ficha_campo_qr_a4_v1`) gana una segunda pagina: un croquis del
# campus donde el pabellon del aula (derivado de `unit.venue`, «A206» -> «A»)
# se resalta con relleno pleno + anillo, y los demas quedan en trazo suave con
# su letra. El aplicador que no conoce el campus encuentra el pabellon sin
# preguntar; la letra usa el MISMO tono que el chip B31 de Monitoreo, para que
# papel y pantalla hablen el mismo color.
#
# Coordenadas y procedencia: docs/qa/croquis-campus-pucp-fuentes.md. La paridad
# de paleta y de derivacion de letra es contra el helper TS de B31
# (frontend/src/features/monitoreo/profiles/aulas/chipDePabellon.ts): dos capas
# leyendo la misma regla tienen que dar la misma respuesta.

# Gemelo de `.cfx_compiled()` (test-collection-ficha-campo.R): una unidad, un
# binding manual y la instancia minima que el compilador acepta. Se copia con
# prefijo propio porque los fixtures de un archivo de test no viajan al vecino.
.ccq_compiled <- function(template, url = "https://x.test/enc", collector = "PILOTO_2026",
                          dimensions = NULL) {
  unit <- list(unit_id = "u1", label = "Rotulo de la unidad", role = "piloto", group = "PILOTO")
  if (!is.null(dimensions)) unit$dimensions <- dimensions
  binding <- list(
    access_id = "a1", logical_collector_id = collector, unit_id = "u1",
    access_kind = "manual_handoff", access_ref = url, status = "ready"
  )
  deployment <- list(
    deployment_id = "d1", target = list(provider = "kobo"), bindings = list(binding),
    sensitivity = list(access_urls = "operational"), status = "prepared"
  )
  fp <- function(x) collection_fingerprint(x)
  instance <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA, instance_id = "m1",
    template_ref = list(
      template_id = template$template_id, revision = 1L, sha256 = template$template_sha256
    ),
    deployment_id = "d1", deployment_fingerprint = fp(deployment),
    access_fingerprint = fp(list(binding)), instance_fingerprint = fp("m1"),
    unit_refs = list("u1"), access_refs = list("a1"),
    locale = "es-PE", status = "ready", sensitivity = "operational", warnings = list()
  )
  collection_material_compile(
    template, instance, project = list(name = "Estudio", period = "Piloto"),
    plan = list(plan_id = "p1", units = list(unit)), deployment = deployment
  )
}

# npc -> pixel con la MISMA convencion que `.cfx_grey`/`collection_qr_matrix_
# from_png`: fila = (1 - y) * alto, columna = x * ancho. Devuelve los tres
# canales RGB como MEDIANA de una ventana de 5x5 px: un pixel suelto lo decide
# el antialiasing del device, y verificar color con un solo canal daria verde
# a un gris cualquiera.
.ccq_pixel <- function(img, x, y, medio = 2L) {
  fila <- max(1L, min(nrow(img), as.integer(round((1 - y) * nrow(img)))))
  col <- max(1L, min(ncol(img), as.integer(round(x * ncol(img)))))
  filas <- max(1L, fila - medio):min(nrow(img), fila + medio)
  cols <- max(1L, col - medio):min(ncol(img), col + medio)
  if (length(dim(img)) == 3L) {
    vapply(1:3, function(canal) stats::median(img[filas, cols, canal]), numeric(1))
  } else {
    rep(stats::median(img[filas, cols]), 3L)
  }
}

# Centro proyectado de un pabellon, por la MISMA cadena que usa el dibujante
# (tabla -> proyeccion -> npc): pinchar coordenadas a mano probaria la copia
# del test, no el croquis.
.ccq_centro <- function(letra) {
  pab <- prosecnurapp:::.ccx_pabellones()
  fila <- pab[pab$letra == letra, , drop = FALSE][1, ]
  prosecnurapp:::.ccx_proyectar(fila$lat, fila$lng, prosecnurapp:::.ccx_layout())
}

# Punto de muestreo de color: centro + 0.30 lados SOLO en x. En el centro
# EXACTO cae el glifo de la letra del pabellon (pinchar ahi mediria la
# tipografia, no el relleno), y un offset diagonal caeria en el borde: la
# caja es fisicamente cuadrada, asi que su semialtura en npc es
# lado*(page_w/page_h) / 2 ~= lado*0.354 y subir lado*0.35 en y aterriza
# justo sobre el trazo. A lado*0.30 en horizontal el punto queda dentro de la
# caja (semiancho lado*0.5), fuera del glifo y lejos del borde.
.ccq_probe <- function(letra) {
  centro <- .ccq_centro(letra)
  lado <- prosecnurapp:::.ccx_layout()$lado_pabellon
  list(x = centro$x + lado * 0.30, y = centro$y)
}

.ccq_codes <- function(rendered) {
  vapply(rendered$warnings %||% list(), function(w) as.character(w$code %||% ""), character(1))
}

test_that("la paleta del croquis es la gemela exacta de los chips B31 del frontend", {
  # Ocho tonos, en el mismo orden que aulasCargaDeCampo.css resuelto a hex en
  # tokens.css: si una capa retoca un tono sin la otra, el papel y la pantalla
  # dejan de nombrar el mismo pabellon con el mismo color y nadie avisa.
  expect_identical(prosecnurapp:::CCX_TONOS_DE_PABELLON, 8L)
  expect_identical(
    prosecnurapp:::.ccx_paleta_tonos(),
    c("#4f7cbf", "#16a34a", "#c2416b", "#d97706", "#7c3aed", "#0ea5b7", "#a0464e", "#0f766e")
  )
})

test_that("la letra y el tono del pabellon se derivan igual que chipDePabellon.ts", {
  letra <- function(x) prosecnurapp:::.ccx_letra_de_pabellon(x)
  # Primera letra en mayuscula, sin diacriticos: la virgulilla de «Ñ» se
  # normaliza a N (asi lo hace el helper TS de B31, y dos respuestas distintas
  # para el mismo local serian dos pabellones).
  expect_identical(letra("A703"), "A")
  expect_identical(letra("lfia"), "L")
  expect_identical(letra("Ñ201"), "N")
  # Un local que no empieza por letra no inventa pabellon: declara vacio.
  expect_identical(letra("9no piso"), "")
  expect_identical(letra(""), "")
  expect_identical(letra(NULL), "")

  tono <- function(x) prosecnurapp:::.ccx_tono_de_pabellon(x)
  # tono = (utf8ToInt(letra) - 65) %% 8 — la misma aritmetica del chip B31.
  expect_identical(tono("A703"), 0L)
  expect_identical(tono("lfia"), 3L)
  expect_identical(tono("Ñ201"), 5L)
  expect_identical(tono("Z101"), 1L)
  # Sin letra no hay tono: NA, no un 0 que colorearia de steel lo desconocido.
  expect_identical(tono("9no"), NA_integer_)
  expect_identical(tono(""), NA_integer_)
})

test_that("el croquis conoce los 18 pabellones del operativo mas B, F y U, con su procedencia", {
  pab <- prosecnurapp:::.ccx_pabellones()
  expect_s3_class(pab, "data.frame")
  expect_true(all(c("letra", "lat", "lng", "fuente") %in% names(pab)))

  # Las 18 letras de la leyenda del operativo HSVG2026: si una falta, el aula
  # de esa letra caeria en «desconocido» con el croquis mirandola de frente.
  operativo <- c("A", "D", "E", "G", "H", "I", "J", "L", "M", "N", "O", "P",
                 "Q", "R", "V", "X", "Y", "Z")
  expect_true(all(operativo %in% pab$letra))
  # B, F, K y U no estan en la leyenda pero existen en el campus: van en
  # trazo suave como referencia, porque un croquis con huecos desorienta mas
  # que uno completo. La K la entrego el barrido de Google Maps del
  # 2026-09-03 («PABELLON K, Sec. Mecatronica») — y el venue real «K301»
  # dejo de caer en desconocido.
  expect_true(all(c("B", "F", "K", "U") %in% pab$letra))
  expect_identical(as.character(pab$fuente[pab$letra == "K"]), "google")

  # Y no tiene marcador propio en ninguna fuente: su posicion es un centroide
  # de vecinos y la tabla lo DICE. Declarar la procedencia es lo que permite
  # auditar el croquis sin volver a las cuatro fuentes.
  expect_identical(as.character(pab$fuente[pab$letra == "Y"]), "derivada")
})

test_that("la proyeccion esta girada 180 grados: sur arriba, este a la izquierda", {
  # Dictado de Gonzalo (2026-09-03): «inviertas el mapa 180 grados». El giro
  # es contrato, no gusto: el equipo lee el croquis con la zona de aplicacion
  # dominante (el sur del campus) arriba. La flecha N del dibujo apunta hacia
  # abajo y sigue diciendo la verdad.
  L <- prosecnurapp:::.ccx_layout()
  expect_true(is.list(L))

  centro <- function(letra) .ccq_centro(letra)
  x_ <- centro("X") # extremo norte del campus -> ABAJO tras el giro
  o_ <- centro("O") # sur y oeste -> arriba y a la derecha
  p_ <- centro("P") # este -> izquierda
  expect_lt(x_$y, o_$y)
  expect_lt(p_$x, o_$x)
  for (punto in list(x_, o_, p_)) {
    expect_gte(punto$x, 0); expect_lte(punto$x, 1)
    expect_gte(punto$y, 0); expect_lte(punto$y, 1)
  }
})

test_that("la base PULSO PUCP esta marcada siempre, con su fuente declarada", {
  # Dictado de Gonzalo (2026-09-03): «resalta donde esta PULSO PUCP siempre».
  # La primera posicion se DERIVO junto al L y el dueño la corrigio en vivo
  # («esta cerca de ahi pero no esta alli») con captura: la coordenada es la
  # del place publico «PULSO PUCP» de Google Maps, junto a CIGA — fuente
  # CONFIRMADA, ya no derivada.
  base <- prosecnurapp:::.ccx_base_pulso()
  expect_identical(base$nombre, "PULSO PUCP")
  expect_identical(base$fuente, "confirmada")
  # En el barrio del pabellon L (el pin real queda a ~90 m de su marcador).
  pab <- prosecnurapp:::.ccx_pabellones()
  ele <- pab[pab$letra == "L", ]
  dist_m <- sqrt(((base$lat - ele$lat) * 110574)^2 +
                 ((base$lng - ele$lng) * 111320 * cos(12.07 * pi / 180))^2)
  expect_lt(dist_m, 120)

  # Y se dibuja SIEMPRE: la lamina general (sin venue) tambien la lleva. Se
  # verifica por pixel en el punto proyectado de la base: navy de la marca,
  # no el gris del terreno.
  skip_if_not_installed("png")
  dir <- tempfile("ccq-pulso-"); dir.create(dir)
  png_path <- file.path(dir, "lamina.png")
  collection_croquis_lamina(png_path, venue = NULL, device = "png", dpi = 110)
  img <- png::readPNG(png_path)
  p <- prosecnurapp:::.ccx_proyectar(base$lat, base$lng, prosecnurapp:::.ccx_layout())
  pixel <- .ccq_pixel(img, p$x, p$y)
  navy <- c(0x00, 0x24, 0x57) / 255
  expect_true(
    all(abs(pixel - navy) <= 0.20),
    info = sprintf("pixel de la base PULSO = (%.3f, %.3f, %.3f)", pixel[1], pixel[2], pixel[3])
  )
})

test_that("el verso resalta EXACTAMENTE el aula que la cara del QR imprime", {
  # Dictado de Gonzalo (2026-09-03): «asegurate que el pabellon que se
  # resalte sea el que se muestra en el QR en relacion al pabellon
  # establecido». Las dos caras beben del MISMO campo (unit.venue): este test
  # fija que el texto impreso en «Pabellon y aula» y el venue crudo que el
  # verso usa para resaltar son identicos — si alguna cara cambiara de
  # fuente (p. ej. al aula pactada) sin la otra, aqui truena.
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "D103 · H113")
  )
  cara <- compiled$pages[[1]]
  verso <- compiled$pages[[2]]
  filas <- Filter(function(b) identical(b$type, "form_lines"), cara$blocks)[[1]]$rows
  celda <- NULL
  for (row in filas) for (cell in row$fields) {
    if (grepl("Pabell", cell$label %||% "")) celda <- cell
  }
  expect_false(is.null(celda))
  expect_identical(celda$value, "D103 · H113")
  expect_identical(verso$unit$venue_raw, celda$value)
  # Y las letras que el verso resalta salen de ese mismo texto.
  expect_identical(prosecnurapp:::.ccx_letras_de_venue(verso$unit$venue_raw), c("D", "H"))
})

test_that("la ficha de campo gana un verso: pagina croquis_campus con campus_map ligado al aula", {
  template <- collection_material_field_sheet_template()
  expect_length(template$pages, 2L)
  expect_identical(template$pages[[1]]$page_id, "ficha")
  expect_identical(template$pages[[1]]$layout_preset, "field_form")
  expect_identical(template$pages[[2]]$page_id, "croquis")
  expect_identical(template$pages[[2]]$layout_preset, "croquis_campus")

  # El croquis se liga al aula por `unit.venue`: es el MISMO dato del que la
  # cara frontal imprime «Pabellon y aula», asi que las dos caras no pueden
  # contradecirse. Y lleva footer, como toda hoja que se reparte suelta.
  tipos <- vapply(template$pages[[2]]$blocks, function(b) as.character(b$type %||% ""), character(1))
  expect_true("campus_map" %in% tipos)
  expect_true("footer" %in% tipos)
  mapa <- Filter(function(b) identical(b$type, "campus_map"), template$pages[[2]]$blocks)[[1]]
  expect_identical(mapa$binding, "unit.venue")

  # La plantilla completa de dos paginas sigue validando: el verso entra al
  # vocabulario del preset, no por la puerta de atras.
  expect_true(collection_material_template_validate(template)$ok)
  expect_true("campus_map" %in% COLLECTION_MATERIAL_BLOCK_TYPES)
  expect_true("campus_map" %in% COLLECTION_MATERIAL_PRESETS$ficha_campo_qr_a4_v1$blocks)

  # Admitir el layout del verso NO abre la compuerta a cualquier layout: una
  # pagina con un layout ajeno al preset se sigue rechazando por su codigo.
  ajeno <- template
  ajeno$pages[[2]]$layout_preset <- "poster_qr"
  ajeno$template_sha256 <- NULL
  ajeno$template_sha256 <- collection_fingerprint(ajeno)
  expect_true("layout_not_allowed" %in% vapply(
    collection_material_template_validate(ajeno)$problems,
    function(p) p$code, character(1)
  ))
})

test_that("compilar una unidad produce las dos caras de la misma unidad", {
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "A206")
  )
  expect_identical(compiled$page_count, 2L)
  # Las dos paginas pertenecen a la MISMA unidad en el page_map: es el dato
  # del que despues vive el bundle para no partir una ficha en dos archivos.
  unidades <- vapply(compiled$page_map, function(p) as.character(p$unit_id %||% ""), character(1))
  expect_identical(unique(unidades), "u1")
})

test_that("el verso dibuja con el contrato de sus hermanos: warnings y links", {
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "A206")
  )
  expect_identical(compiled$page_count, 2L)
  skip_if(compiled$page_count < 2L, "sin verso aun: el contrato de dos paginas fallo arriba")

  # Mismo retorno que collection_material_draw_field_form: el renderer generico
  # concatena warnings y links de cada pagina sin preguntar de que layout viene.
  grDevices::pdf(NULL)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  drawn <- collection_material_draw_campus_croquis(compiled$pages[[2]], 2L, 2L, list())
  expect_true(is.list(drawn))
  expect_true(all(c("warnings", "links") %in% names(drawn)))
})

test_that("el pabellon del aula se rellena con su tono pleno y los demas quedan claros", {
  skip_if_not_installed("png")
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "A206")
  )
  dir <- tempfile("ccq-resalte-"); dir.create(dir)
  png_path <- file.path(dir, "croquis.png")
  collection_material_render_compiled(compiled, png_path, device = "png", page = 2L, dpi = 110)

  img <- png::readPNG(png_path)
  # «A206» -> pabellon A -> tono 0 steel #4f7cbf, el mismo del chip B31. Se
  # muestrea el interior del poligono DESPLAZADO del centro (ahi cae el glifo
  # de la letra): relleno PLENO significa que el interior es del tono, no solo
  # su borde.
  probe_a <- .ccq_probe("A")
  pixel_a <- .ccq_pixel(img, probe_a$x, probe_a$y)
  steel <- c(0x4f, 0x7c, 0xbf) / 255
  expect_true(
    all(abs(pixel_a - steel) <= 0.12),
    info = sprintf("interior del pabellon A = (%.3f, %.3f, %.3f)", pixel_a[1], pixel_a[2], pixel_a[3])
  )

  # Y un pabellon NO seleccionado va en trazo suave: su interior sigue claro.
  # Si Z tambien saliera relleno, el resaltado no señalaria nada.
  probe_z <- .ccq_probe("Z")
  pixel_z <- .ccq_pixel(img, probe_z$x, probe_z$y)
  expect_gt(mean(pixel_z), 0.8)
})

test_that("sin pabellon no se resalta nada y el vacio se declara, no se calla", {
  skip_if_not_installed("png")
  # Fixture SIN dimensions: la unidad no trae venue. El croquis igual se
  # imprime -orienta aunque no señale- pero el render lo DICE con su codigo,
  # porque una hoja sin resaltado que no avisa se lee como un mapa decorativo.
  compiled <- .ccq_compiled(collection_material_field_sheet_template())
  dir <- tempfile("ccq-sin-venue-"); dir.create(dir)
  png_path <- file.path(dir, "croquis.png")
  rendered <- collection_material_render_compiled(
    compiled, png_path, device = "png", page = 2L, dpi = 110
  )
  expect_true("croquis_sin_pabellon" %in% .ccq_codes(rendered))

  # Nada quedo resaltado: el interior del pabellon A sigue claro (mismo punto
  # desplazado que el probe del resaltado, para comparar lo comparable).
  img <- png::readPNG(png_path)
  probe_a <- .ccq_probe("A")
  expect_gt(mean(.ccq_pixel(img, probe_a$x, probe_a$y)), 0.8)
})

test_that("una letra sin edificio en el croquis avisa sin tumbar el render", {
  # «W101» deriva la letra W, que no existe en el campus: el render sale igual
  # (la ficha ya esta impresa en la cara frontal) y el aviso deja rastro para
  # que el hueco se investigue en el plan, no en el aula.
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "W101")
  )
  dir <- tempfile("ccq-desconocido-"); dir.create(dir)
  png_path <- file.path(dir, "croquis.png")
  rendered <- collection_material_render_compiled(
    compiled, png_path, device = "png", page = 2L, dpi = 110
  )
  expect_true("croquis_pabellon_desconocido" %in% .ccq_codes(rendered))
})

test_that("el bundle empaqueta UN PDF por unidad con sus dos caras, no un PDF por cara", {
  # Aqui vivio el bug historico «pagina == unidad»: el empaquetador recorre
  # compiled$pages, y con un template de dos paginas eso produciria CUATRO
  # PDFs de una cara -la ficha de un aula partida en dos archivos- en vez de
  # DOS fichas completas de dos paginas.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_name", "Estudio Croquis")
  session_set(sid, "monitoreo_aulas_plan", list(
    list(
      selection_run_id = "croquis-1", operational_code = "CH 1", label = "Aula 1",
      wave = "M1", faculty = "Ingenieria", course_id = "Calculo",
      sample_role = "titular",
      schedule = "08:00", venue = "A206", teacher = "Docente 1", eligible_n = 30,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=CH-1"
    ),
    list(
      selection_run_id = "croquis-1", operational_code = "CH 2", label = "Aula 2",
      wave = "M1", faculty = "Derecho", course_id = "Derecho",
      sample_role = "titular",
      schedule = "10:00", venue = "Z101", teacher = "Docente 2", eligible_n = 25,
      link = "https://kf.kobotoolbox.org/x/form?d%5BcollectorID%5D=CH-2"
    )
  ))
  seeded <- collection_state_seed(sid)
  # El estado arranca con la plantilla builtin (ficha de plan): se instala la
  # de campo ANTES de crear la instancia, que es el flujo real del modulo.
  put <- collection_material_template_put(
    sid, collection_material_field_sheet_template(), seeded$state_revision
  )
  created <- collection_material_instance_create(sid, put$state_revision)
  snapshot <- collection_material_render_snapshot(sid, created$instance$instance_id)
  snapshot$output_filename <- "materiales.zip"

  dir <- withr::local_tempdir()
  snapshot_path <- file.path(dir, "bundle.rds")
  saveRDS(snapshot, snapshot_path)
  zip_path <- file.path(dir, "materiales.zip")

  result <- collection_material_render_job(snapshot_path, "bundle", zip_path)

  listing <- utils::unzip(zip_path, list = TRUE)$Name
  pdfs <- grep("[.]pdf$", listing, value = TRUE)
  # Dos unidades -> dos PDFs, no cuatro.
  expect_length(pdfs, 2L)
  # Y el page_map cuenta las cuatro caras, unidad a unidad y en orden: las dos
  # de la primera unidad y luego las dos de la segunda.
  expect_identical(result$page_count, 4L)
  expect_identical(
    vapply(result$page_map, function(p) as.character(p$unit_id %||% ""), character(1)),
    rep(as.character(unlist(snapshot$instance$unit_refs)), each = 2L)
  )

  unpack <- file.path(dir, "unpack")
  dir.create(unpack)
  utils::unzip(zip_path, exdir = unpack)
  for (pdf in pdfs) {
    expect_identical(
      qpdf::pdf_length(file.path(unpack, pdf)), 2L,
      info = sprintf("caras del PDF por unidad: %s", pdf)
    )
  }
})

test_that("la lamina suelta del croquis se emite sin venue y sin error", {
  # El croquis tambien sirve solo -material de referencia para el equipo, sin
  # aula concreta-: con venue NULL renderiza sin resaltado y sin reventar,
  # porque «no hay aula» es un caso del contrato, no una excepcion.
  dir <- tempfile("ccq-lamina-"); dir.create(dir)
  pdf_path <- file.path(dir, "croquis.pdf")
  collection_croquis_lamina(pdf_path, venue = NULL, device = "pdf")
  expect_true(file.exists(pdf_path))
  expect_identical(qpdf::pdf_length(pdf_path), 1L)
})

# --- V2: cursos-horario con DOS pabellones (dictado de Gonzalo, 2026-09-02) ---
#
# «Hay algunos cursos horarios que pueden tener dos pabellones a la vez.
# Entonces, ahí simplemente marcar que puede ser en cualquiera de los dos en
# función del horario». Medido en el plan real de HSVG26ULT2: 301/1.392 venues
# traen dos aulas unidas por « · » y 73 CRUZAN pabellon («H404 · A608»,
# «D102 · H211», «TAMB · Z111»...). Resaltar solo la primera letra dejaba al
# aplicador sin la mitad de su destino.

test_that("un venue con dos aulas se parte en sus lugares y sus letras", {
  lugares <- function(x) prosecnurapp:::.ccx_lugares_de_venue(x)
  letras <- function(x) prosecnurapp:::.ccx_letras_de_venue(x)
  expect_identical(lugares("H404 · A608"), c("H404", "A608"))
  expect_identical(lugares("A206"), "A206")
  expect_identical(lugares(""), character(0))
  expect_identical(lugares(NULL), character(0))
  # Dos aulas del MISMO pabellon son un solo destino: la letra no se repite.
  expect_identical(letras("A204 · A206"), "A")
  expect_identical(letras("H404 · A608"), c("H", "A"))
  # El token sin letra de pabellon conserva su lugar en la lista de letras
  # («TAMB» -> T): quien decide si T existe en el croquis es el dibujante,
  # que lo declara; el parser no se traga nada en silencio.
  expect_identical(letras("TAMB · Z111"), c("T", "Z"))
})

test_that("un venue de dos pabellones resalta los dos edificios", {
  skip_if_not_installed("png")
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "H404 · A608")
  )
  dir <- tempfile("ccq-dos-"); dir.create(dir)
  png_path <- file.path(dir, "croquis.png")
  rendered <- collection_material_render_compiled(
    compiled, png_path, device = "png", page = 2L, dpi = 110
  )
  img <- png::readPNG(png_path)
  paleta <- prosecnurapp:::.ccx_paleta_tonos()
  # H = (72-65) %% 8 = 7 (processing) y A = 0 (steel): AMBOS interiores plenos.
  probe_h <- .ccq_probe("H")
  col_h <- grDevices::col2rgb(paleta[[8L]])[, 1] / 255
  pixel_h <- .ccq_pixel(img, probe_h$x, probe_h$y)
  expect_true(
    all(abs(pixel_h - col_h) <= 0.12),
    info = sprintf("interior del pabellon H = (%.3f, %.3f, %.3f)", pixel_h[1], pixel_h[2], pixel_h[3])
  )
  probe_a <- .ccq_probe("A")
  col_a <- grDevices::col2rgb(paleta[[1L]])[, 1] / 255
  pixel_a <- .ccq_pixel(img, probe_a$x, probe_a$y)
  expect_true(
    all(abs(pixel_a - col_a) <= 0.12),
    info = sprintf("interior del pabellon A = (%.3f, %.3f, %.3f)", pixel_a[1], pixel_a[2], pixel_a[3])
  )
  # Un tercero sigue en trazo suave: resaltar dos no es resaltar todos.
  probe_z <- .ccq_probe("Z")
  expect_gt(mean(.ccq_pixel(img, probe_z$x, probe_z$y)), 0.8)
  # Dos pabellones REALES no son un desconocido ni un vacio: nada que declarar.
  expect_false("croquis_pabellon_desconocido" %in% .ccq_codes(rendered))
  expect_false("croquis_sin_pabellon" %in% .ccq_codes(rendered))
})

test_that("en un venue mixto el token sin edificio se declara y el resoluble se resalta", {
  skip_if_not_installed("png")
  # «TAMB · Z111» existe en el plan real: TAMB no tiene edificio en el croquis
  # (T no esta en ninguna fuente), Z111 si. El aplicador recibe el resaltado
  # que SE PUEDE dar y el render declara el que no, en vez de elegir en
  # silencio o romperse.
  compiled <- .ccq_compiled(
    collection_material_field_sheet_template(), dimensions = list(venue = "TAMB · Z111")
  )
  dir <- tempfile("ccq-mixto-"); dir.create(dir)
  png_path <- file.path(dir, "croquis.png")
  rendered <- collection_material_render_compiled(
    compiled, png_path, device = "png", page = 2L, dpi = 110
  )
  img <- png::readPNG(png_path)
  paleta <- prosecnurapp:::.ccx_paleta_tonos()
  # Z = (90-65) %% 8 = 1 (green): resaltada.
  probe_z <- .ccq_probe("Z")
  col_z <- grDevices::col2rgb(paleta[[2L]])[, 1] / 255
  pixel_z <- .ccq_pixel(img, probe_z$x, probe_z$y)
  expect_true(
    all(abs(pixel_z - col_z) <= 0.12),
    info = sprintf("interior del pabellon Z = (%.3f, %.3f, %.3f)", pixel_z[1], pixel_z[2], pixel_z[3])
  )
  expect_true("croquis_pabellon_desconocido" %in% .ccq_codes(rendered))
})

test_that("el subtitulo imprime lo que el warning declara — el papel no lee warnings", {
  # Nota del verificador de V2: en «TAMB · Z111» la declaracion de que TAMB no
  # tiene edificio viajaba SOLO en el warning del render. El aplicador tiene
  # la lamina en la mano, no el log: lo declarado se imprime.
  sub <- function(v) prosecnurapp:::.ccx_subtitulo_croquis(v)
  expect_match(sub("TAMB · Z111"), "TAMB fuera del croquis", fixed = TRUE)
  # Y los casos de siempre no se mueven: la frase nueva es un apendice, no
  # una reescritura.
  expect_match(sub("H404 · A608"), "según el horario", fixed = TRUE)
  expect_match(sub("A206"), "PABELLÓN A · aula A206", fixed = TRUE)
  expect_identical(sub(""), "Pabellón por confirmar")
})
