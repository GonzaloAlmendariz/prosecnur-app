# Prepara para el recetario (C34): palabras, pares y tríos más frecuentes de la abierta p35 de ACRD ING, sin palabras
# vacías ni de relleno, y la categorización de cada respuesta en temas (respuesta múltiple: una respuesta puede caer en
# varios). Deja texto_ing.rds en SP. Uso: SP=<datos> Rscript prep_m3e_texto.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
SP <- Sys.getenv("SP")
x <- readRDS(file.path(SP, "ing_tmp.rds"))$src$data_sources[[1]]$p35
x <- x[!is.na(x) & nzchar(trimws(x))]
sin_tilde <- function(s) chartr("áéíóúüñ", "aeiouun", s)
norm <- function(s) sin_tilde(tolower(s))
tokens <- lapply(x, function(s) { t <- unlist(strsplit(gsub("[^[:alpha:]áéíóúñüÁÉÍÓÚÑÜ ]", " ", tolower(s)), "\\s+")); t[nzchar(t)] })
# vacías (artículos, preposiciones, conectores) y de relleno (verbos y adjetivos que no dicen qué cambiar)
vacias <- c("a","al","ante","con","de","del","desde","el","en","entre","es","esta","este","estos","estas","ha","hay","la","las","le","les","lo","los",
            "mas","más","me","mi","muy","no","nos","o","para","pero","por","que","se","si","sí","sin","sobre","su","sus","un","una","uno","y","ya","como",
            "todo","todos","toda","todas","cada","otro","otros","otra","otras","también","tambien","solo","sólo","ser","son","fue","era","eso","esto")
relleno <- c("considera","considero","creo","podría","podrian","podrían","debería","deberia","deberían","deberian","debe","deben","tener","tiene","hacer",
             "mejorar","implementar","falta","parte","importante","mayor","mejor","bueno","buena","nuevos","nuevas","nuevo","nueva","egresado","egresados",
             "carrera","alumnos","estudiantes","estudiante","universidad","ingeniería","ingenieria","mecánica","mecanica","temas","tema","forma","manera",
             "actualmente","sería","seria","ideal","donde","pueda","puedan","algunos","algunas","mucho","mucha","muchos","muchas","poco","ninguna","ninguno","nada","incluir","brindar","darle","dar")
fuera <- norm(c(vacias, relleno))
# variante con tilde más frecuente de cada forma normalizada, para mostrar «gestión» y no «gestion»
todas <- unlist(tokens); vista <- tapply(todas, norm(todas), function(v) { t <- table(v); con <- grepl("[áéíóúñ]", names(t)); names(sort(t[if (any(con)) con else TRUE], decreasing = TRUE))[1] })
ngramas <- function(n) {   # en el orden original; los extremos no pueden ser vacías ni de relleno, el medio sí (gestión de proyectos)
  g <- unlist(lapply(tokens, function(t) { k <- norm(t); if (length(k) < n) return(character())
    out <- vapply(seq_len(length(k) - n + 1), function(i) { s <- k[i:(i + n - 1)]
      if (s[1] %in% fuera || s[n] %in% fuera || any(nchar(s[c(1, n)]) < 3)) NA_character_ else paste(vista[s], collapse = " ") }, "")
    unique(out[!is.na(out)]) }))   # una vez por respuesta: cuenta personas, no repeticiones
  sort(table(g), decreasing = TRUE) }
palabras <- ngramas(1); pares <- ngramas(2); trios <- ngramas(3)
temas <- list(
  `Más práctica, talleres y casos reales` = "practic|taller|laboratorio|casos|real|aplicad",
  `Software, herramientas e IA` = "software|programa|herramienta|computacion|\\bia\\b|inteligencia artificial|tecnolog|programacion|digital",
  `Vínculo con la industria y el mercado` = "mercado|laboral|industria|empresa|rubro|sector|bolsa de trabajo|asesoria",
  `Gestión de proyectos` = "proyecto|gestion",
  `Habilidades blandas y liderazgo` = "blanda|liderazgo|comunicacion|relacionar|equipo|presentacion",
  `Malla y cursos de especialidad` = "malla|curricular|electivo|especializ|plan de estudio",
  `Docentes con experiencia en el campo` = "docente|profesor|jefe de practica",
  `Sin sugerencia` = "^\\s*(ninguna|ninguno|nada|no)\\b|no se le ocurre|no tengo")
xn <- norm(x)
m <- sapply(temas, function(rx) grepl(rx, xn, perl = TRUE))
sin <- m[, "Sin sugerencia"]; m[sin, setdiff(colnames(m), "Sin sugerencia")] <- FALSE
otros <- rowSums(m) == 0
cats <- c(colSums(m[, colnames(m) != "Sin sugerencia"]), Otros = sum(otros), `Sin sugerencia` = sum(sin))
saveRDS(list(n_resp = length(x), palabras = head(palabras, 12), pares = head(pares, 12), trios = head(trios, 12), cats = cats), file.path(SP, "texto_ing.rds"))
cat("respuestas", length(x), "\n"); print(head(palabras, 8)); print(head(pares, 8)); print(head(trios, 8)); print(round(100 * cats / length(x)))
