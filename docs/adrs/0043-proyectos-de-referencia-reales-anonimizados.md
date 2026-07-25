# ADR 0043: Proyectos de referencia — estudios reales anonimizados como fixtures

Estado: Aceptado

Fecha: 2026-07-24

## Contexto

El repo ya tiene una fábrica de proyectos canónicos sintéticos
(`api/R/audit_projects.R`, ADR previo del agentic OS): cuatro familias
—territorial, acreditación, procesamiento, telefónico— que se generan bajo
demanda, son deterministas y sirven de gate en CI.

Tienen un límite estructural: un proyecto sintético solo contiene los casos que
alguien pensó en construir. Los defectos que la app sufre en producción vienen
de estados que nadie diseña a propósito. Del inventario de los cuatro estudios
reales del analista salieron, entre otros:

- una base de acreditación con 450 columnas, veintiuna de ellas con datos
  personales, y una columna llamada `col_7` con quince correos institucionales
  perdidos entre 1277 filas de códigos cortos;
- un proyecto guardado con la versión 0.5.5 de la app, catorce versiones atrás
  del formato vigente;
- un repeat group Kobo real —base padre de 426x177 más `rep_servicios` de
  667x17 unidas por `_parent_index`— con filtro de universo activo en ambas;
- un marco muestral de 136 mil filas y 29 mil estudiantes;
- el mismo archivo de 11.5 MB registrado dos veces bajo `file_id` distintos;
- bases con nombres de columna duplicados y vacíos.

Dos de las semillas sintéticas ya declaraban en su `coverage` un `reduced_from`
apuntando a estos estudios (`ACGACNUR`, `ACRCONTA`), pero como texto suelto: no
resolvía a nada. Y el `.pulso` de ACNUR PDM traía embebido un bloque
`audit_project` con schema `prosecnur.external_project_probe.v1` que no existe
en ninguna parte del código — un intento previo de registrar proyectos externos
que quedó huérfano.

El obstáculo para versionar los estudios reales es que contienen datos
personales de participantes identificables.

## Decisión

Se adopta un catálogo de **proyectos de referencia** (`api/R/reference_projects.R`,
schema `prosecnur.reference_project.v1`), hermano del de proyectos canónicos
pero para estudios reales anonimizados, con cuatro entradas: `acnur_pdm`,
`acnur_acg`, `hsvg2026` y `acrconta`.

### 1. La anonimización preserva lo que hace útil al fixture

`api/R/pulso_anonimizar.R` reemplaza los datos personales respetando tres
invariantes, porque un fixture anonimizado a lo bruto deja de probar lo que
tiene que probar:

- **Estabilidad** — el seudónimo es un hash del valor original con una sal por
  proyecto. Mismo valor, mismo seudónimo, en todas las bases y corridas: las
  uniones (`_parent_index`, `link_key`, `recipient_id`) siguen cerrando.
- **Forma** — un DNI de ocho dígitos se reemplaza por ocho dígitos, un correo
  conserva su dominio institucional, un celular sigue empezando en 9. Los
  parsers y validadores de la app se siguen ejercitando de verdad.
- **Geometría** — el GPS se desplaza en bloque con un offset rígido por
  proyecto. Distancias, rutas y cruces `sf` contra el marco INEI mantienen su
  estructura relativa; solo dejan de apuntar a los hogares reales.

La sal vive en `PROSECNUR_ANON_SALT`, fuera del repo. Sin ella el mapeo sería
recomputable por cualquiera con una lista de nombres candidatos.

### 2. El texto libre se redacta, no se seudonimiza

En columnas estructuradas se preserva la forma. Dentro de una pregunta abierta
se sustituye por un marcador explícito: `[correo]`, `[celular]`, `[documento]`.

La asimetría es deliberada. En prosa, un seudónimo con forma de dato real es
indistinguible de una filtración: quien lee "escríbeme a ana.flores3f@pucp.edu.pe"
dentro de una abierta no puede saber si se generó o se escapó. El marcador hace
la diferencia auditable, y no se pierde nada analítico porque una abierta se
codifica por tema.

### 3. El gate mira las columnas que la anonimización no garantiza

`pulso_detectar_pii()` escanea por contenido **solo** las columnas que la
clasificación por nombre no marcó como PII. Las clasificadas están garantizadas
por construcción; escanearlas reportaría el 100% de los fixtures correctos como
sucios, precisamente porque el seudónimo conserva la forma del original.

El hueco real —y lo que el detector busca— es una columna de nombre inocente con
un contacto escrito adentro.

### 4. La procedencia entre catálogos es un dato, no un literal

`reduced_from` pasa a vivir en `.audit_project_catalog_list()` y a contener el
slug del proyecto de referencia. Un test verifica que resuelva. La trazabilidad
entre el sintético y el real deja de ser decorativa.

### 5. Los fixtures se instalan read-only y declaran su cobertura

Van a `api/inst/reference_projects/<slug>/`, con permisos `0444` y un
`reference-project.json` que declara sha256, módulos cubiertos y qué aporta el
fixture. La cobertura se calcula **leyendo el state**, no el `modules_summary`
del manifest: ese campo es una declaración de la UI sobre en qué anda el
analista y miente por optimista — marca como `ready` módulos que están vacíos.

## Consecuencias

Los cuatro fixtures ocupan 17 MB versionados y cubren, en conjunto, once
módulos. `acnur_acg` es el único que recorre el pipeline hasta analítica;
`acnur_pdm` el único con repeat groups reales; `hsvg2026` el único con marco de
aulas a escala; `acrconta` el único con diseño de estudio.

Tres huecos siguen sin cubrir por ningún fixture, y las semillas sintéticas los
siguen sosteniendo: **recopiladores** (cero cobertura), **reglas de validación
custom y limpieza aplicada** (`reglas_custom`, `limpieza_draft` y
`limpieza_artifacts` están en cero en los cuatro estudios) y **SurveyMonkey con
conexión real**.

La unicidad de un fixture **no** se mide por qué módulos cubre. `hsvg2026` cubre
un subconjunto estricto de los módulos de `acnur_acg` y aun así es
irreemplazable: `acnur_acg` tiene `calc_muestra` por su `calc_muestra_estudio`
pero nunca construyó un `aulas_frame`. Lo que distingue a un fixture es cuán
lejos llega dentro de un módulo.

Reconstruir un fixture exige los `.pulso` originales, que no están en el repo.
Por eso `reference_project_verify` trata un fixture ausente como omitido y no
como falla: quien no tenga los originales debe poder correr la suite.

`acrconta` es el único fixture **fusionado**: el estudio vivía partido en un
`.pulso` de monitoreo multiactor sin archivos embebidos y otro de procesamiento
con la base `.sav`. `api/scripts/reference_project_merge_acrconta.R` los une
tomando el monitoreo como destino y trayendo solo las ramas que no tiene.

## Alternativas descartadas

**Dejar los `.pulso` fuera del repo y referenciarlos por ruta.** Cero riesgo de
fuga, pero los fixtures no viajan al CI ni a otra máquina, que es justamente lo
que se quería.

**Recortar el marco de `hsvg2026` para que pese menos.** Su aporte *es* el
volumen: un marco recortado no ejercita lo mismo. El peso se atacó
deduplicando el input repetido (14.8 MB a 7.7 MB), que no cuesta nada.

**Un detector de PII que escanee todas las columnas.** Incompatible con
preservar la forma del dato. Se eligió preservar la forma y acotar el detector.
