# ADR 0069 — El instrumento sellado reconoce a su propia base

- **Estado**: Aceptada
- **Fecha**: 2026-08-08
- **Ámbito**: Editor de formularios · Procesamiento (Carga, Validación, Analítica)

## Contexto

Publicar una revisión en el Editor produce un snapshot inmutable del
instrumento. Su razón de ser es que Procesamiento sepa exactamente qué
formulario generó la data: `instrument_validation_contract` e
`instrument_analysis_contract` resuelven reglas de validación, exclusiones
analíticas y valores especiales leyendo la revisión que autoriza cada base.

El campo del que cuelga todo eso es `s$estudio$bases[[base]]$instrument_revision_id`.
Hasta este ADR lo escribían tres sitios, todos del mismo linaje: la carga SAV
de acreditación, el batch de acreditación multiactor y el bundle SAV de
SurveyMonkey. La carga normal no lo escribía nunca.

La consecuencia era que en un estudio de una sola base —manual, Kobo,
telefónico, territorial— publicar no tenía consumidor. El hub del Editor pedía
el ritual completo (revisar lógica, asignar público, publicar) y el sello no
alcanzaba a Procesamiento. El plan de ingreso, que es el otro puente, exigía
`actor_key` y `actor` por entrada y solo se montaba en el perfil `multi_actor`,
de modo que tampoco servía fuera de acreditación.

En paralelo, el estado de publicación era opaco por una razón distinta:
`xlsform_editor_validate()` emitía todos sus diagnósticos con `level = "warn"`
y la partición entre bloqueante y aviso se hacía por el prefijo del id —solo
`ast-unparseable-*` era aviso—. Cualquier diagnóstico nuevo nacía bloqueante y
cualquier instrumento real quedaba en "Publicación bloqueada" de forma
permanente.

## Decisión

**1. Una base queda ligada a una revisión cuando su XLSForm ES esa revisión.**

Al registrar o reemplazar los archivos de una base, el backend calcula el hash
canónico del XLSForm cargado (`.xlsform_revision_hash()`: survey/choices/
settings normalizados, sin las columnas `paper_*` de la capa de edición, sin
mirar los bytes del ZIP) y lo compara con `content_sha256` de las revisiones
publicadas. Liga solo con coincidencia exacta.

El enlace es deliberadamente conservador. Si el archivo pasó por Excel, se bajó
de Kobo o se editó a mano, el hash cambia y no se liga nada. Preferimos una
base sin revisión a una ligada a un instrumento que no es el suyo, porque ese
id autoriza reglas que alteran resultados. Nunca se infiere por nombre de
archivo, por `form_id` ni por proximidad temporal.

**2. El enlace vive en `estudio_add_base()` / `estudio_replace_base_files()`,
no en cada ruta de carga.** Por esas dos funciones pasan la carga manual, la
importación de Kobo, el bundle de SurveyMonkey y el handoff de Monitoreo.
Sembrar la llamada ruta por ruta es exactamente lo que dejó el enlace
disponible solo en acreditación. El costo es nulo en proyectos que no publican:
el binding sale antes de tocar el disco cuando no hay revisiones.

**3. Los enlaces declarados por el plan de ingreso de acreditación y por el
bundle SAV mandan.** Si la base trae `processing_intake_entry_id`, el binding
por hash no la toca.

**4. El resultado del intento se registra y se muestra.** La base guarda
`instrument_revision_binding` con `matched`, `no_match`, `none_published` o
`unreadable`. La publicación reporta `bound_bases`, y el hub distingue
"En uso por «default»" de "Publicada · ninguna base la usa todavía" y de
"«docentes» usa una revisión anterior". Carga explica el `no_match`, que era el
caso que antes pasaba en silencio.

**5. La severidad declarada decide qué bloquea la publicación.** `error` se
reserva para lo que impide interpretar el instrumento: `name` vacío, inválido o
duplicado —hace ambiguo el mapeo data↔variable—, select sin catálogo válido
—no hay dominio de respuesta—, grupo descuadrado —no exporta—, `form_id`
ausente —la revisión no tiene identidad estable—. Todo lo demás es `warn` y se
publica: una expresión que el editor visual no sabe leer o una referencia
colgante son defectos de contenido dentro de un instrumento interpretable, y
sellar una revisión con eso documenta la realidad en vez de dejar al proyecto
sin sello.

**6. El plan de ingreso exige actor solo en acreditación.** Fuera de ese
perfil, `actor_key` y `actor` son opcionales; si se declaran a medias, siguen
validándose como identidades bien formadas.

## Consecuencias

- Publicar tiene efecto observable en cualquier tipo de estudio, y el Editor
  puede decir si lo tuvo. La publicación deja de ser un ritual sin consecuencia.
- Un instrumento editado fuera de Pulso no hereda las decisiones del Editor.
  Es intencional, y la UI lo dice en vez de callarlo.
- Cambiar el XLSForm de una base recalcula el enlace: nunca se arrastra el
  anterior. Una base ligada a la revisión de un instrumento que ya no es el
  suyo aplicaría reglas ajenas.
- El campo no es escribible desde la API pública: `estudio_update_base_metadata()`
  no lo lleva en su whitelist. El backend es la única autoridad sobre el enlace.
- Un diagnóstico nuevo del validador debe declarar su severidad. Nacer sin
  ella significa no bloquear, que es el default seguro.

## Alternativas descartadas

- **Ligar por `form_id` o por nombre de archivo.** Barato y equivocado: dos
  instrumentos distintos comparten `form_id` con facilidad, y ligar mal es peor
  que no ligar porque altera resultados en silencio.
- **Exigir que Procesamiento importe el instrumento desde el Editor en vez de
  aceptar un archivo.** Cierra el caso pero rompe el flujo real, donde la data
  y el formulario a veces llegan de la plataforma y no del Editor.
- **Generalizar el plan de ingreso a todo estudio.** El plan existe para
  repartir N instrumentos entre N bases; en una sola base es burocracia. Se le
  quitó la exigencia de actor, pero no se convirtió en el camino obligatorio.
