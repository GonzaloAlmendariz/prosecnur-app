# Plan de Fuentes legibles — Monitoreo

Dirección congelada para que la sección **Fuentes** de Monitoreo la entienda
alguien que no conoce la app por dentro. Se implementa modo por modo:
Acreditación primero, y de ahí se traslada a Telefónico y Territorial.

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-07-28 |
| Estado | Dirección congelada; implementación en curso en el modo Acreditación |
| Alcance | Sección `fuentes` de Monitoreo en los modos Acreditación, Telefónico y Territorial: estructura de pestañas, vocabulario, enlaces y contrato geométrico |
| Fuera de alcance | Motor R de fuentes, contrato del `.pulso`, sincronización, y la divergencia numérica de `recibidas` en Territorial (se trata como bug aparte) |
| Modo en curso | Acreditación — proyecto de referencia `acrconta` |

## Estado al 2026-07-28

**Hecho y verificado** (typecheck limpio, 1.957 vitest, 3.532 testthat):

- Pestañas de 4 a 3, nombradas por pregunta, con alias de las claves viejas.
- `Resumen` reconstruido: agrupación por papel, nombre humano, enlaces reales,
  mapa de cobertura por actor, identificadores en detalle plegado.
- Panel `Conectar fuente`: una puerta, tres pasos, validación local en vivo,
  verificación antes de guardar y aviso de duplicado.
- Franja de fuentes repartida en una fila.
- Timeout en los tres caminos de red hacia Google (N7).

**Pendiente**, en este orden:

1. `Universo` y `Encuestas y recopiladores` siguen mostrando las vistas viejas
   dentro de la estructura nueva. Funcionan; no tienen el tratamiento del
   Resumen.
2. En el paso 3 del panel, el actor declarado no se puede corregir sin volver
   al paso 1, y el pie puede decir «respuestas de Administrativos» sobre una
   encuesta llamada «…Estudiantes».
3. Territorial (§4.2) y Telefónico (§4.4).
4. La divergencia `1.693` vs `1.697` de Territorial (T3), como diagnóstico
   aparte.

> **Trampa operativa medida:** abrir `acrconta` cuesta ~3,5 min de warm start, y
> se paga **en cada recarga** del navegador. Los proyectos de referencia son
> read-only a propósito (`0444`), así que los caches del warm start no se
> escriben de vuelta y nunca hay arranque caliente. Para iterar sobre la UI,
> navegar con `window.__pulsoNav.ir(...)` en vez de recargar; una edición de un
> archivo `.tsx` que fuerce full reload vuelve a pagar los 3,5 min.

---

## 0. Tesis

Fuentes es el punto de partida de todo monitoreo: si no se entiende de dónde
vienen los números, ninguna pestaña posterior es creíble. Hoy la sección está
escrita para quien construyó la integración, no para quien dirige el estudio.

El problema no es de estética. Es que la sección **está organizada por servicio
externo** (SurveyMonkey, Google Sheets, recopiladores) cuando el usuario llega
con **preguntas de estudio**: de dónde salen mis datos, qué le falta a esto para
estar completo, y qué tengo que decidir yo.

---

## 1. Evidencia del ANTES

Medido en la app el 2026-07-28, viewport `1440x1000`, contra los proyectos de
referencia del ADR 0043 (`acrconta` para Acreditación, `acnur_acg` para
Territorial). No se leyó CSS para producir estos hallazgos: se leyó la pantalla.

### 1.1 Acreditación (`acrconta` — 13 fuentes, 4 actores, 1.277 registros)

| # | Hallazgo | Evidencia literal |
|---|---|---|
| A1 | Las pestañas nombran el servicio, no la pregunta | `Encuestas en plataforma · SurveyMonkey/Kobo`, `Bases en Sheets`, `Recopiladores`, `Fuentes activas` |
| A2 | La pestaña que responde «¿de dónde salen mis números?» es la última | `Fuentes activas` es la 4.ª de 4 y es la más legible de todas |
| A3 | El identificador desplaza al enlace en Sheets | Campo `SPREADSHEET` con `1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ` pelado; sin nombre del documento ni forma de abrirlo |
| A4 | El identificador desplaza al nombre en encuestas | Cada tarjeta lleva `527327742` de subtítulo permanente y la encuesta no es alcanzable desde la app |
| A5 | Jerga de implementación en títulos de superficie | `DECLARACIÓN ACTOR-CANAL`, `CANAL BASE`, `20 heredan · 0 excepciones`, `Base Ficha QR`, `Sin alias operativo`, `Metadata real lista`, `Snapshot local listo`, `Catálogo cerrado por defecto` |
| A6 | La misma etiqueta con dos cifras a 20 px | Franja de sección `BASE 1,277`; franja siguiente `BASE 4` |
| A7 | El mismo dato repetido tres veces | `13/13` en la barra de módulo (`ACTIVAS`), en la franja de sección (`FUENTES`) y en la franja de contadores (`FUENTES`) |
| A8 | Una pestaña concentra todas las decisiones repetidas | `Recopiladores`: 20+ filas × (4 métricas + incluir/excluir + alias + clasificación + canal) |
| A9 | Texto operativo recortado | `Cuenta en este ca…` en cada fila de recopilador |
| A10 | Vacío exterior sin dueño | `Bases en Sheets` deja ~45 % del alto vacío bajo la tarjeta del actor seleccionado |

### 1.2 Territorial (`acnur_acg`)

| # | Hallazgo | Evidencia literal |
|---|---|---|
| T1 | El selector de fase se pinta dos veces seguidas, con dos tratamientos | `FORMATO TERRITORIAL: Piloto / Campo`, y debajo `Piloto · FORMULARIO PILOTO` / `Campo · FORMULARIO DE CAMPO` |
| T2 | El nombre de la encuesta se repite 5 veces, 2 de ellas cortado a mitad de palabra | `Encuesta de Percep...cogida - Perú 2026` |
| T3 | Dos cifras bajo la misma palabra en la misma pantalla | franja `1,697 RECIBIDAS` vs KPI `RESPUESTAS RECIBIDAS 1,693` vs cabecera `1,693 en el snapshot` |
| T4 | Dos conceptos distintos con palabras que se leen como sinónimas | cabecera `1,283 efectivas` vs `1,404 PASAN FILTRO` |
| T5 | Vocabulario de implementación sin traducir | `snapshot`, `CHOICES 61`, `DESPLIEGUE Activo` |
| T6 | Etiquetas recortadas en la tira de Hoja de Ruta | `0 sin primera e…`, `0 UMP sospech…` |
| T7 | Un input sin procedencia | `SPREADSHEET` vacío, sin decir de dónde se saca esa URL |
| T8 | Tres decisiones sin relación en un solo scroll | fase + formulario Kobo, conexión de Hoja de Ruta, e inspección/sincronización, todas en la pestaña `Formulario` |

### 1.3 Telefónico

`TelefonicoMonitoreoPage.tsx` declara su propio `ACREDITACION_SOURCE_TABS`
idéntico al de Acreditación y renderiza las mismas vistas con `phoneMode`.
Hereda A1–A10 sin excepción. Por eso Acreditación va primero: lo que se aprenda
ahí se traslada casi sin traducir.

> **T3 no es cosmético.** `1.693` vs `1.697` bajo la palabra «recibidas» tiene la
> firma del patrón de fallbacks `||` que ya cambió denominadores bajo la misma
> etiqueta en acreditación. Se diagnostica aparte; este plan no lo repara ni lo
> disimula.

---

## 2. Las cuatro reglas

Valen para los tres modos y son auditables una por una.

### R1 — El nombre humano manda; el identificador es metadato

El título de una fuente es el nombre del documento o de la encuesta. El
identificador (`survey_id`, `asset_uid`, `spreadsheet_id`, `source_id`) **nunca
es subtítulo**: vive en un renglón «Detalle técnico» plegado, o como `title` del
enlace que ya lo lleva.

*Se audita:* ningún identificador opaco aparece en un `strong`, un `h*` ni en el
subtítulo directo de un título.

### R2 — Todo identificador con URL se muestra como enlace

`survey_id` → la encuesta en SurveyMonkey. `asset_uid` + `base_url` → el
formulario en Kobo. `sheet_binding.spreadsheet_id` → el Google Sheet. Cuando no
se puede armar el enlace, la superficie dice **qué falta para tenerlo**, no que
falta.

El tono ya existe en el repo y no se inventa otro —
`captureUrlMessage()` en `lib/captureUrl.ts`:

> «Abre el proyecto en Kobo, copia el enlace del formulario web y pégalo aquí.»

*Se audita:* toda fuente con los datos necesarios expone un `a[href]`; ninguna
muestra un identificador sin enlace ni explicación.

### R3 — Un dato, un lugar, con su denominador

Un mismo número no se pinta dos veces en la misma pantalla. Si dos cifras
parecidas tienen grano distinto, el rótulo lo dice (`recibidas en el corte` vs
`recibidas de esta fase`), y si no se puede distinguir, se muestra una sola.

*Se audita:* ninguna etiqueta se repite con dos valores; ningún valor se repite
en tres superficies de la misma vista.

### R4 — Guiar es nombrar el siguiente paso concreto

«Falta la pestaña de barrido» es guía. «Las fuentes son el punto de partida del
monitoreo» es relleno, y el Contrato de Superficie lo prohíbe explícitamente
(«copy, explicaciones o texto ornamental para llenar espacio»).

*Se audita:* toda superficie con estado pendiente nombra la acción que lo
resuelve; ninguna superficie completa agrega prosa explicativa.

---

## 3. Vocabulario: qué se traduce y qué no

**Se conserva** el vocabulario del estudio, porque el metodólogo lo usa y
traducirlo lo empobrece: *actor, canal, efectiva, cuota, corte, UMP, Código
Pulso, barrido, universo, recopilador*.

**Se traduce** el vocabulario de implementación:

| Antes | Después |
|---|---|
| `snapshot` / `Snapshot local listo` | copia local · *fecha de la última actualización* |
| `choices` | opciones |
| `DECLARACIÓN ACTOR-CANAL` | Quién responde cada encuesta |
| `CANAL BASE` | Canal por defecto |
| `20 heredan · 0 excepciones` | 20 recopiladores usan este canal · ninguno con excepción |
| `Base Ficha QR` | Canal por defecto: Ficha QR |
| `Sin alias operativo` | Sin nombre propio *(usa el de la plataforma)* |
| `Metadata real lista` | *fecha de la última lectura de la plataforma* |
| `Catálogo cerrado por defecto` | *(se elimina: describe una decisión de implementación)* |
| `SPREADSHEET` | Enlace del Google Sheet |
| `Source ID` / `Asset Kobo` | *(bajan a «Detalle técnico»)* |

Regla de crecimiento: una traducción nueva se agrega al vocabulario compartido,
no se escribe suelta en la vista.

---

## 4. Estructura de pestañas

No se agregan pestañas por agregar. Se corta por **pregunta**, y las decisiones
que se condicionan entre sí quedan juntas.

### 4.1 Acreditación — de 4 a 3

| Hoy | Mañana | Por qué |
|---|---|---|
| `activas` — Fuentes activas | **1 · Resumen** | Responde «¿de dónde salen mis números?». Sube a primera y pierde toda decisión: es lectura |
| `sheets` — Bases en Sheets | **2 · Universo** | La base por actor: qué documento, qué pestaña, qué rango |
| `survey` — Encuestas en plataforma | **3 · Encuestas y recopiladores** | Se unen |
| `collectors` — Recopiladores | ↑ | Porque el recopilador **hereda el canal de su encuesta** (`20 heredan · 0 excepciones`): hoy la regla se declara en una pestaña y la excepción se decide en otra |

La pestaña 3 es master/detail: la encuesta arriba con su declaración de actor y
canal, y sus recopiladores debajo con un filtro por defecto en **«por
clasificar»** — así A8 deja de poner 20 decisiones abiertas cuando solo 2
requieren atención.

Compatibilidad de direcciones (ADR 0044): las claves `activas`, `sheets`,
`survey` y `collectors` se siguen **leyendo** como alias y nunca se **escriben**.
Las claves canónicas nuevas son `resumen`, `universo`, `encuestas`.

### 4.2 Territorial — de 5 a 6 (pendiente, tras Acreditación)

`Formulario` mete tres decisiones sin relación en un scroll (T8). Se parte en
`Formulario` (fase + Kobo + inspección) y `Hoja de ruta` (la Google Sheet), y el
selector de fase se pinta **una** vez (T1).

### 4.3 Conectar una fuente — el flujo, no solo su lectura (pendiente)

Medido el 2026-07-28 en `acrconta`. Conectar una fuente hoy no es un flujo: son
tres formularios distintos repartidos por pestaña, sin punto de entrada común.

| # | Hallazgo | Evidencia |
|---|---|---|
| N1 | No existe una sola puerta «conectar fuente» | `+ Agregar SurveyMonkey` en una pestaña, `Seleccionar encuesta Kobo` en la misma, y un campo `SPREADSHEET` suelto en otra |
| N2 | Se pide pegar un identificador sin decir de dónde sale | el input muestra `1UMlN7xVAzQOrglhMkVNSj2KQ2RgJntOh2mNbDQm5mbQ` y no ofrece pegar la URL del documento |
| N3 | Dos botones sin orden ni resultado visible | `Leer pestañas` y `Confirmar base`, sin decir cuál va primero ni qué quedó leído |
| N4 | Texto libre donde debería haber una lista | `PESTAÑA DEL ACTOR` es un input aunque `Leer pestañas` ya trae los nombres reales |
| N5 | Sin estado de progreso ni confirmación de lectura | no se ve «probando», ni cuántas filas ni qué columnas entraron |
| N6 | Vacío exterior sin dueño | ~45 % del alto queda en blanco bajo el formulario (es A10 visto desde el flujo) |

> **N7 — un identificador mal pegado tumbaba el backend entero.** Al probar el
> paso 3 con el enlace de un spreadsheet inexistente,
> `/api/monitoreo/sheets/inspect` quedó esperando a Google sin límite. Plumber
> atiende en un solo hilo, así que con esa petición murieron también
> `/api/system/health` y la apertura del módulo, que pasó a responder
> `HTTP_500`. Causa: `.monitoreo_google_api_once()` armaba su handle con
> `curl::new_handle()` sin `timeout` ni `connecttimeout`. Reparado en
> `api/R/monitoreo_google_http.R`, con regresión en
> `test-monitoreo-google-http.R`.

Dirección: **una sola puerta, tres pasos siempre iguales, resultado verificado
antes de guardar.** Elegir servicio → pegar la dirección (URL, no ID) y que la
app la valide mientras se escribe, con el diagnóstico concreto que ya escribe
`captureUrlMessage()` → elegir hoja/encuesta de una lista real y confirmar
contra una previsualización que diga qué se leyó. El paso 3 es el que hoy no
existe y es el que convierte «guardé algo» en «sé qué guardé».

### 4.4 Telefónico — igual que Acreditación (pendiente)

Se decide al llegar si reusa los componentes extraídos o los forka. **No se
fusiona el perfil**: el fork telefónico se mantiene por decisión previa; lo que
se comparte es infraestructura genérica, no el modelo de dominio.

---

## 5. Contrato de geometría y capacidad

Paleta: `--pulso-module-monitoring` vía `--module-accent`. Nada de hex.
`PageFrame`: `workbench`. Radios, alturas de control y pesos salen de los tokens
`--pulso-*` de `theme.css` (radio de tarjeta 14, panel 16, chip 999; control
28/36; seis pesos y nada entre medio).

| Grupo | Contrato | Ejes gobernados | Cardinalidades a probar | Dueño del overflow |
|---|---|---|---|---|
| Tarjeta de papel (Resumen: Universo / Respuestas / Barrido) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 8 fuentes por papel | lista interna de la tarjeta |
| Tarjeta de actor (Universo) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 4 / 12 actores | lista interna de la tarjeta |
| Tarjeta de encuesta (Encuestas) | `equal` | alto y ancho, tol. 2 px | 0 / 1 / 7 / 30 encuestas | lista de recopiladores de la tarjeta |
| Fila de recopilador | `equal` | alto, tol. 2 px | 0 / 1 / 20 / 200 | lista de la tarjeta padre |
| Tira de contadores de sección | `equal` | alto, tol. 2 px | siempre 3 | — |
| Bloques de la vista (Resumen, Universo…) | `intrinsic` | — | — | `.pulso-main` |

Reglas que se derivan:

- **C1**: todo grupo par declara `data-qa-geometry-group` y su contrato
  `equal`/`intrinsic` **al construir**, no en el QA.
  > Lección de la primera vuelta: las tres tarjetas de papel se declararon
  > `intrinsic` razonando que eran «secciones independientes», y en `acrconta`
  > Barrido —una sola fuente— quedó como un muñón de 90 px junto a dos tarjetas
  > de 285. Tres hermanas del mismo rol son un grupo par: el contrato es `equal`
  > y el vacío de la que tiene menos es capacidad interior legítima. La duda
  > entre `intrinsic` y `equal` se resuelve mirándolo con datos reales, no
  > razonando sobre la semántica.
- **C2**: el marco no crece con `items.length`; una tarjeta de actor sin fuentes
  conserva la caja de su variante y resuelve el vacío **dentro**.
- **C3**: A10 se repara entregándole el alto disponible a la lista, no
  estirando la tarjeta.
- **C4**: un solo dueño de scroll por pantalla; cero recorte de texto operativo
  (A9, T6). Elipsis en etiqueta larga sí; en dato operativo no.
- **C5**: toda superficie vacía se clasifica antes de tocarla — vacío legítimo,
  vacío por fixture, o vacío por desconexión. Solo la tercera autoriza añadir.

---

## 6. Dónde vive el código

`AcreditacionMonitoreoPage.tsx` (19.691 líneas), `TelefonicoMonitoreoPage.tsx`,
`monitoreo.css` (38.160) y `profilePage.css` (20.167) están **congelados a
crecimiento** (`agentic/manifest.json`). Por eso el rediseño es también una
extracción, y eso es deliberado:

```
frontend/src/features/monitoreo/fuentes/          ← infraestructura compartida
  enlacesDeFuente.ts        R2: nombre humano + URL de cualquier MonitoreoSource
  vocabulario.ts            §3: el glosario, en un solo lugar
frontend/src/features/monitoreo/profiles/acreditacion/fuentes/
  pestanas.ts               §4.1: catálogo canónico + alias
  FuentesResumen.tsx
  FuentesUniverso.tsx
  FuentesEncuestas.tsx
  fuentes.css               tokens --pulso-* únicamente
```

La página congelada solo pierde líneas: cambia bloques inline por llamadas a los
componentes nuevos.

---

## 7. Verificación

- `pnpm --dir frontend typecheck` y `pnpm --dir frontend test`.
- `make ui-quick-check` con `--require-geometry` sobre `acrconta`, matriz
  `1440x1000` y `1024x600`, mismo proyecto que en el ANTES.
- Por cada grupo par: marco y región de contenido medidos por separado en
  cardinalidad baja y alta.
- Gate final con el agente `verificador`. Verde por conformidad, no por
  ausencia: un `visualIssues=0` con geometría no declarada no aprueba.
