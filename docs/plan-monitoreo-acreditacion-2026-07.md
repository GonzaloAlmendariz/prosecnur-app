# Plan Monitoreo de acreditación — que la pantalla diga la verdad y se vea profesional

Rediseño de fondo y superficie del modo Acreditación de Monitoreo (5 secciones · 22 pestañas).

| Campo | Valor |
| --- | --- |
| Versión | 1.0 |
| Fecha | 2026-07-26 |
| Estado | Vigente — **bucle de convergencia**, solo el usuario lo cierra |
| Alcance | `/monitoreo?modo=acreditacion` completo: Fuentes, Modelo, Consultas, Teléfono, Avance — sus 22 pestañas — más los contratos R que las alimentan |
| Diagnóstico | Barrido en vivo del 2026-07-26 sobre `api/inst/reference_projects/acrconta/acrconta.pulso` (4 actores, 13 fuentes, 1.277 registros, 418 efectivas), warm start completo, 1512×945 y 1280×800, cada sección y cada pestaña recorridas arriba/medio/final; verificación cruzada contra el `state.rds` del `.pulso` y contra el código |
| Normas | `CLAUDE.md` (reglas de la casa) · ADR 0040 (flujo de acreditación) · ADR 0044 (jerarquía y direcciones) · `docs/ui-layout-grammar.md` · `branding/direccion-creativa.md` |
| Gate | Toda fase termina en el agente `verificador` |

---

## 0. Tesis

El módulo tiene **el vocabulario correcto escrito en un solo lugar** —la pestaña Salidas, con su embudo `1.277 snapshot → 519 procesables → 418 válidas` y las mermas nombradas (`−758 fuera del universo declarado`, `−101 sin encuesta efectiva`)— y **en ninguna otra parte**. El resto del módulo presenta `418` como un número caído del cielo, lo repite doce veces, y en el camino se contradice consigo mismo seis veces con cifras distintas bajo la misma etiqueta.

El problema no es estético. Es que **el flujo que produce una efectiva es silencioso**, cuando por definición del negocio tiene que ser explícito y auditable:

```
respuesta → completa → consentimiento positivo → cruza con la base real → dedup (gana mayor duración) → EFECTIVA
```

Lo que no cumple, no cuenta. Ese es el contrato de una acreditación: el entregable no es un porcentaje, es un **expediente defendible**. Un comité no pregunta "¿cuánto avanzaron?", pregunta "¿por qué entró este caso y por qué no entró aquel?". Hoy la app no puede responder eso en pantalla: la sección que existe para responderlo —Consultas— está muda, y su insumo no viaja en el `.pulso`.

Por eso el plan tiene un orden no negociable: **primero que los números dejen de mentir, después que la cadena sea explícita, y solo al final que se vea bonito.** Pulir la superficie sobre denominadores que se contradicen sería maquillar el problema.

---

## 1. El contrato de dominio (lo que la UI debe encarnar)

### 1.1 Qué es una efectiva

Una respuesta es efectiva cuando, simultáneamente:

1. está **completa**;
2. tiene **consentimiento positivo**;
3. **cruza con la base real** (el universo declarado por actor);
4. **sobrevive la deduplicación** — cuando hay más de una del mismo caso, gana la de **mayor duración**.

Las cuatro compuertas son eliminatorias. **Ninguna puede ser silenciosa.** Hoy las cuatro lo son: el usuario ve `418` y no ve ni una sola de las bajas, salvo agregadas en la última pestaña de la última sección.

Esto es lo que hace a **Consultas** la sección crítica del módulo: es donde el cruce contra la base real ocurre caso por caso y donde se establece el **avance real**. No es una pestaña de consulta ocasional; es la que sostiene la cifra.

### 1.2 Mínimos vs barrido: dos lecturas legítimas

- **El "meta"** es un **mínimo a llegar**, y es un instrumento **interno**: nos cubrimos al alcanzarlo. Internamente "4 de 4 mínimos cubiertos" es una lectura correcta y útil.
- **El cliente normalmente quiere barrer todo el universo**, sobre todo cuando el universo es chico.
- Pero **hay universos grandes que no se pueden barrer**, y ahí el mínimo *es* el acuerdo y con eso nos conformamos.
- **Depende del cliente y del actor.** Por eso el mínimo se incluye en el reporte de forma **opcional**, no por defecto.

Consecuencia de diseño: **el objetivo no se asume, se declara por actor.** Hoy la app hardcodea una sola lectura y estampa un badge verde terminal sobre actores que todavía tienen trabajo.

Con `acrconta` la diferencia es tangible:

| Actor | Universo | Efectivas | Mínimo | Lectura hoy | Lectura correcta |
| --- | --- | --- | --- | --- | --- |
| Administrativos | 16 | 15 | 15 | ✅ Meta cubierta | falta **1** para barrer |
| Docentes | 53 | 52 | 38 | ✅ Meta cubierta | falta **1** para barrer |
| Estudiantes | 180 | 173 | 126 | ✅ Meta cubierta | faltan **7** para barrer |
| Egresados | 270 | 178 | 108 | ✅ Meta cubierta | **87 por trabajar**, o mínimo al 165% si se acordó mínimo |

Tres actores están a 1, 1 y 7 respuestas de cerrar el universo, y la app los da por terminados.

### 1.3 Censo vs muestra

Con `acrconta`, tres de los cuatro actores son censo o casi:

| Actor | N | n | Margen (95%, con corrección por población finita) | Lectura |
| --- | --- | --- | --- | --- |
| Egresados | 270 | 178 | **±4.3%** | única muestra real |
| Estudiantes | 180 | 173 | ±1.5% | prácticamente censo |
| Docentes | 53 | 52 | ~±1% | censo |
| Administrativos | 16 | 15 | — | censo |

La app no distingue censo de muestra en ningún lado. Cambia el lenguaje del informe entero: a un censo no se le reporta margen de error.

### 1.4 Población real ≠ base trabajada

Lo que la app llama "universo" (180 estudiantes) es la **base de contactos trabajada**, no la matrícula de la carrera. No existe campo para la población real, que es contra lo que un comité juzga la cobertura.

---

## 2. Evidencia verificada

Todo lo de abajo fue reproducido en vivo el 2026-07-26. Lo marcado con `file:line` tiene causa localizada.

### 2.1 Números que se contradicen en pantalla

| Dónde | Dice | Contra |
| --- | --- | --- |
| Avance/Resumen, leyenda | RECHAZOS **3** | Misma vista, banda universo: RECHAZOS **0**. El desagregado de Detalle confirma 3 (0+1+1+1) |
| Fuentes, banda superior | BASE **1.277** | Fuentes, banda inferior pegada: BASE **4**. Misma palabra, dos conceptos |
| Fuentes/Estado | "**11 piezas** alimentando monitoreo" | Header: 13/13. Lista lateral: 7 encuestas + 6 sheets = 13 |
| Avance/Encuestas | RECOPILADORES **0** | Fuentes/Estado: **38 incluidos** |
| Teléfono/Supervisión | BASE TEL. **270** · POR BARRER **16** | Teléfono/Resumen y /Responsables: **519** y **90** |
| Actores → Administrativos | "9 días con respuesta · 16 respuestas" y "35 de 59 días visibles" | En el medio: "**Sin ritmo diario** — el corte todavía no trae respuestas fechadas" |
| Modelo/Resumen | BASES SHEETS **4** | Fuentes/Estado: "BASES SHEETS VINCULADAS · **6 fuentes**" |

### 2.2 Causa raíz común: fallbacks que cambian el concepto

No son casos sueltos. Es un patrón: **cadenas `||` / `??` que sustituyen un denominador por otro incompatible y lo muestran con la misma etiqueta.**

```ts
// AcreditacionClarityStrip — AcreditacionMonitoreoPage.tsx:18697
const phoneBaseTotal = phoneBaseFromReport || summary.universe || state?.n_rows || 0;
const phonePendingTotal = phoneSummaryValue(rows, "no barridos") ?? summary.unanswered;
```

En Supervisión el bloque canónico `estatus_telefonico` resuelve y da **270** (los 11 estados suman exactamente 270) con **16** por barrer. En Resumen y Responsables ese bloque no resuelve y cae al **universo completo (519)** y a "sin respuesta del universo (90)". Misma etiqueta, tres denominadores.

El mismo patrón produce **"EFECTIVAS KOBO 1.277 · pasan filtro"**: `Math.max(totals.effective, fallbackEffective)` con `fallbackEffective = state.dashboard.kpis.valid` = todas las filas del corte.

### 2.3 El gráfico principal oculta el 65% del campo

Confirmado contra la tabla cruda de Avance/Detalle:

- El campo empieza el **2026-05-25**. Al 11 de junio ya van **288 acumuladas** de 429.
- El gráfico "Ritmo general del estudio" **arranca el 11 de junio**. Los primeros 17 días —con el pico real (55 el 27/5, 37 el 5/6)— no existen.
- Por eso la curva acumulada entra a pantalla ya al 60% de altura y se lee como una meseta.
- El pie dice "42 de 59 días calendario visibles". No dice que falta el 65% de la producción.

Causa: `AcreditacionMonitoreoPage.tsx:15444`
```ts
const visibleLimit = isCompactChart ? 14 : variant === "general" ? 42 : ...;
const visiblePoints = allChartRows.slice(-visibleLimit);
```

Y el promedio del encabezado está mal por lo mismo (`:15466`): divide el total **completo** (429) entre los días **recortados** (42) → "10.2/día". El real es 7.3/día sobre 59 días, 9.5/día sobre los 45 con respuesta.

### 2.4 Consultas: el insumo no viaja en el `.pulso`

Verificado leyendo `state.rds` directamente:

- El snapshot **sí trae los casos reales**: 1.277 filas con `Código PUCP`, apellidos y nombres, email, celular, `dim_actor`, `.source_role`.
- `monitoreo_snapshot$reports$internal_queries` está persistido como **lista vacía**.
- `case_rollup` **no existe** en el `.pulso`.
- Los `reports$sheets` sí viajan (por eso Avance pinta).

Consecuencia: las 4 pestañas de Consultas dicen *"No hay filas del universo con los filtros activos"* con todos los filtros en "Todos" — culpan a un filtro que nadie puso.

Y no es cosmético: por ADR 0040 §3 el `case_rollup` es la fuente de verdad para promover a Procesamiento. Sin él no hay handoff.

El motor **puede** recalcularlo offline: `.monitoreo_acreditacion_internal_queries(data, profile)` solo necesita `data` y `profile`, y ya se usa así en `router_monitoreo.R:5630` (endpoint de reconciliación). Pero **no existe ningún endpoint de regeneración local**: el único camino es `/api/monitoreo/sync`, que exige red a Google Sheets y SurveyMonkey. Abrir un `.pulso` guardado sin conexión deja Consultas rota permanentemente.

Además es una asimetría con la decisión vigente de que los caches viajan en el `.pulso`: los de dashboard sí, este no.

### 2.5 Bugs con causa exacta

| Qué | Dónde |
| --- | --- |
| "Telefónico" se dibuja **encima** de la fila de herencia. Grid de 4 columnas para 5 canales con la fila clavada a 34px; el quinto envuelve y desborda. Medido: strip en y=369 h=34, quinto botón en y=408, fila de herencia en y=410 | `profilePage.css:4417` (`grid-template-rows: auto 34px`) y `:4425` (`repeat(4, minmax(0,1fr))`) |
| Muestra de supervisión = 30% de 1.277 (todas las filas del corte) rotulada "efectivas Kobo", con sello verde "Consistencia lista" y el barrido en cero | `AcreditacionMonitoreoPage.tsx:4432` |
| La barra bajo "121 RESPUESTAS" vale 68.36% = **121/177**, o sea contra la encuesta más grande de la lista (`max`), no contra un objetivo. Se lee como progreso | `:16535` (y su gemela de teléfono en `:16592`) |
| Gráfico general recorta 17 días y calcula mal el promedio | `:15444`, `:15466` |
| `pestanasDeSeccion()` declara pestañas de acreditación (Sheets / SurveyMonkey / Recopiladores / Reconciliación) que **no usa nadie** y contradicen las reales | `shell/monitoreoSectionTabs.ts` — archivo huérfano completo |
| La etiqueta `RESPUESTAS` se parte en dos líneas en cada fila de recopiladores (caja 77px, texto 65px + uppercase, altura medida 21px = 2 líneas) | tarjetas de `AcreditacionCollectorsSourceView` |

### 2.6 Oficio y densidad

- **Salidas es la mejor pestaña del módulo** y está escondida al final del último rail.
- **418 aparece cuatro veces en un scroll** del Resumen, en cuatro cajas distintas. Igual con 519.
- **Canvas muerto**: Modelo/Resumen gasta el 40% de la pantalla en 4 números y una frase (es un resumen de otra sección, sin acción). Teléfono/Responsables gasta el 80% en un empty state de 250px anclado a la izquierda. Consultas y Cronograma, parecido.
- **Scroll anidado**: Actores (2.617px dentro de un panel que también scrollea), Modelo (823 dentro de 757), Fuentes/Estado (933 y 586). En Actores cada actor mide ~650px, así que comparar los 4 —el gesto central de la sección— exige scrollear y memorizar.
- **Recopiladores**: 20 tarjetas de 127px, la mayoría con 0 respuestas, sin orden ni filtro, y entre ellas una llamada **"Prueba"** incluida en el corte, visualmente idéntica a las buenas.
- **Gráficos de un punto**: cada encuesta pinta un gráfico completo de series —doble eje 0-150, línea de acumulado, marca de corte punteada, 350px— para decir "121 el 10 de junio". Y esas fechas no cuadran con el ritmo general (Estudiantes pone sus 177 el 15/7; el gráfico general muestra 9 ese día).
- **La franja de contexto** (`mon-clarity-strip is-telefonico`): bloque plano lavanda de 1206×110 fuera de la paleta vino del módulo, con **11 categorías crudas del cliente** en puntos de color casi indistinguibles y truncadas (`No efectivo / F…`, `No existe el nú…`, `Contactar des…`, `Número Incorrrecto` con tres erres — verificado: el typo viene de la hoja del cliente, no de la app, pero la app lo publica en su superficie más visible sin catálogo canónico).
- **Triple repetición** de Efectivas/Parciales/Rechazos dentro de una misma tarjeta de encuesta (`survey-states`, `daily-mini-kpis`, leyenda), y el título del gráfico repitiendo literal el título de la tarjeta a 30px.
- **Vocabulario suelto**: efectivas/válidas · universo/base/base reportada/base trabajada · meta/mínimo n/meta actor. Cada sección eligió el suyo.
- **Detalles**: `ULTIMO SYNC` y `Catalogo` sin tilde; `1 nombres reales` / `1 incluidos` / `1 días con fecha`; toggle "Incluido" en color de alerta; ID crudo del spreadsheet como protagonista en Bases; `RECOP. INCLUI…` truncado; badge "sin guardar" alarmando desde el segundo cero.

### 2.7 Vacíos metodológicos

- **"LECTURA DE REPRESENTATIVIDAD — Sin variables de control detectadas"** en Avance/Detalle, mientras el `.pulso` **sí** tiene `Área de trabajo`, `Dedicación`, `Categoría`. Nunca se declararon como variables de control y la UI no ofrece hacerlo desde ahí. Un actor con el mínimo cubierto pero concentrado en un área es el hallazgo que hunde un expediente.
- **La columna META de "Resumen por actor" está vacía en las 4 filas** — justo la tabla publicable.
- **Cronograma**: `CAMPO: Semana 1`, `CANTIDAD DE SEMANAS: 1`, fechas vacías rotuladas "Fechas opcionales" — mientras el campo real corrió del 25/5 al 22/7 (≈9 semanas). El periodo de campo va en la ficha técnica del expediente; no puede ser opcional. Nada confronta plan contra ejecutado.
- **El mínimo se define a ciegas**: `MÍNIMO N` y `% UNIVERSO` son dos inputs libres sin decir cuál gobierna ni qué precisión implica. Los valores lo delatan: 40% y 70% son decisiones, 71.7% y 93.8% son residuos de un cálculo, y se muestran idénticos.

---

### 2.8 El conteo de efectivas es correcto — el fixture anonimizado es el que miente

Reconstruir la reconciliación sobre el fixture `acrconta` daba **188 efectivas** contra las **418** del reporte por actor, lo que parecía un defecto grave del motor. **No lo es.** Reproducido sobre el `.pulso` **original sin anonimizar** (`~/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`, mismas 1.277 filas):

| | `client_report$actors` | `case_rollup` reconciliado |
| --- | --- | --- |
| **Original** | 418 | **418** efectivas · 8 parciales · 3 rechazos · 90 pendientes |
| **Fixture anonimizado** | 418 | **188** efectivas · 7 · 2 · 322 pendientes |

Sobre datos reales los dos caminos **coinciden exactamente**, y además coinciden con lo que la UI muestra. El motor de efectivas está bien.

Lo que falla es el **proyecto de referencia**. Diagnóstico:

- El cruce caso↔base sobrevive intacto: 519 casos cruzan en ambos (`Cruzó` + `Cruzó por barrido`).
- Lo que se rompe es el vínculo **respuesta↔caso**: `platform_state` pasa de 418 `Completa` a 188, y de 90 `Sin respuesta` a **322**. Doscientas treinta y dos respuestas quedan huérfanas.
- Las respuestas están todas presentes (488 en ambos) y con idéntico `response_status` (449 `completed`, 39 `partial`). Ninguna fuente declara `person_code_var`, así que el cruce cae en una llave heurística (nombre/correo) — y `acrconta` seudonimizó **1.095 nombres**.

**Consecuencia para el repo**: `acrconta` no sirve para juzgar cifras de acreditación. El ADR 0043 lo presenta como estudio real anonimizado apto para reproducir bugs sobre estado real, y `make reference-project-verify` valida PII y cobertura, **no fidelidad semántica**. Cualquier QA visual, captura o test que use este fixture para leer avance está midiendo sobre un corte con el 55% de las respuestas desvinculadas.

Acción: que la anonimización preserve la llave de cruce (seudonimizar de forma consistente entre base y respuestas, o declarar `person_code_var` antes de anonimizar), y que `reference-project-verify` gatee la fidelidad del cruce, no solo la ausencia de PII.

### 2.9 La reconstrucción cuesta ~1 minuto

Medido sobre 1.277 filas: reconstruir `internal_queries` toma **~66 s** en el proyecto original y **~96 s** en el fixture (que además genera 810 casos en vez de 578 por el cruce roto de §2.8).

Cabe en una acción explícita con progreso, **no** en el warm start: el `.pulso` tiene que abrir en caliente. La reconstrucción está implementada y probada (`monitoreo_acreditacion_queries_cache.R`), pero deliberadamente **no** se dispara sola.

---

## 3. Fase 1 — Que los números dejen de mentir

**Por qué primero**: es lo que hace que la pantalla se lea como poco confiable, y ninguna mejora visual se sostiene encima de denominadores que se contradicen.

1. **Prohibir el fallback entre denominadores distintos.** Si el bloque canónico no resuelve, se muestra `S/D` con el motivo — **nunca otro número**. Reemplazar las cadenas `||` / `??` de `AcreditacionClarityStrip` (`:18697`) y del workbench telefónico (`:6549`) por resolución explícita con estado.
2. **Un solo origen por métrica y por sección.** Efectivas / parciales / rechazos / universo / base telefónica se calculan una vez y se consumen; hoy hay tres cálculos de `progress` conviviendo.
3. **Matar las bandas duplicadas.** Fuentes tiene dos bandas de KPIs apiladas con `FUENTES 13/13` repetido y `BASE` significando dos cosas. Avance/Resumen repite el mismo trío cuatro veces.
4. **Glosario de tres términos y aplicarlo en las 22 pestañas**: `efectiva`, `universo` (base trabajada), `población` (marco real). Retirar válidas / base reportada / casos como sinónimos sueltos.
5. **Arreglar el gráfico general** (`:15444`, `:15466`): mostrar el campo completo o, si hay recorte, decir cuántas respuestas quedan fuera — no solo cuántos días. Corregir el promedio.
6. **Reparar los bugs de §2.5**: el grid de 5 canales, la muestra de supervisión sobre `kpis.valid`, la barra 121/177, y retirar `monitoreoSectionTabs.ts`.

**Gate**: `pnpm --dir frontend typecheck` · `pnpm --dir frontend test` · recorrido visual de las 22 pestañas con `acrconta` verificando que ninguna métrica homónima difiere entre pestañas de la misma sección.

---

## 4. Fase 2 — Consultas deja de ser opcional

**Por qué segundo**: sin reconciliación no hay avance real ni handoff a Procesamiento (ADR 0040 §3).

0. **Dirimir la divergencia de §2.8 primero.** Sin saber si el avance real es 418 o 188, poblar Consultas solo hace visible una contradicción sin resolverla.
1. **Persistir la reconciliación en el `.pulso`**, igual que los caches de dashboard. Cerrar la asimetría.
2. **Acción explícita de regeneración local** (no automática, §2.9): recalcula `internal_queries` / `case_rollup` desde el snapshot ya persistido, **sin red**, con progreso visible, y **persiste el resultado** para pagarlo una vez. El helper ya existe y está probado: `.monitoreo_acreditacion_queries_hidratadas()`.
3. **Nunca en el warm start.** ~66 s rompen el arranque en caliente.
4. **Empty states que digan la causa real.** ✅ Hecho: ya no culpan a "los filtros activos" cuando no hay ninguno.
5. **Test de round-trip**: guardar `.pulso` → reabrir sin red → regenerar → Consultas puebla.

**Gate**: `testthat` del engine de reconciliación + regresión de round-trip `.pulso` + Consultas poblada con `acrconta` sin conexión.

---

## 5. Fase 3 — El embudo de efectividad como espina dorsal

1. **Componente único de embudo** con las cuatro compuertas nombradas y sus bajas: completa → consentimiento → cruce con base → dedup. Presente en la cabecera del módulo, no en la última pestaña. El material existe en Salidas; hay que **desagregarlo por compuerta y subirlo**.
2. **Cada compuerta clicable** → abre Consultas ya filtrada por esa exclusión. Es el gesto que convierte el número en auditoría.
3. **La deduplicación se hace visible**: cuántos duplicados se resolvieron, cuál ganó y por qué (mayor duración), exportable. Es lo primero que pregunta un comité ante dos respuestas del mismo código.
4. **Censo vs muestra etiquetado por actor**, con el margen resultante solo donde corresponde.

**Gate**: `verificador` + revisión de `revisor-metodologico` sobre grano y denominadores.

---

## 6. Fase 4 — El objetivo se declara, no se asume

1. **Declaración de objetivo por actor**, en Modelo, junto al mínimo:
   - **Barrido total** — el universo es barrible; el mínimo es piso interno.
   - **Mínimo** — el universo no se puede barrer; el mínimo es el objetivo real.

   Se sugiere por tamaño de universo, se edita, se persiste y viaja al reporte.

2. **Ambas cifras siempre visibles; la declarada es el titular:**

   | Objetivo declarado | Titular | Barra | Verde cuando |
   | --- | --- | --- | --- |
   | Barrido total | "faltan 7 de 180" | efectivas/universo, con marca del mínimo | efectivas = universo |
   | Mínimo | "mínimo 108 · 178 logradas (165%)" | efectivas/mínimo, universo como contexto | efectivas ≥ mínimo |

   La otra cifra nunca desaparece: baja a línea secundaria. Así `65.9%` y `BRECHA 0` dejan de contradecirse.

3. **Cabecera del módulo con las dos lecturas**, porque internamente ambas importan:
   `4 de 4 mínimos cubiertos · 418 de 519 del universo · 101 por trabajar`

4. **Renombrar `meta` → mínimo a llegar** en toda la UI y marcarlo como interno.

5. **Retirar el badge verde terminal** sobre actores que aún tienen universo por trabajar bajo objetivo "barrido total".

6. **El reporte hereda la declaración.** `INCLUIR MÍNIMOS` sigue opcional y apagado por defecto, pero **por actor**: para un Egresados grande donde el mínimo es el acuerdo tiene sentido publicarlo; para Administrativos con 16 personas, no.

7. **Población real separada de base trabajada**, y el margen que implica el mínimo elegido junto al input.

**Requiere ADR** (estado nuevo persistido + cambio de vocabulario en 22 pestañas). Ver §9.

---

## 7. Fase 5 — La capa metodológica que falta

1. **Representatividad conectada a las variables que ya están en la data**, con "declarar variable de control" desde el propio bloque de Detalle.
2. **Columna META/mínimo poblada** en la tabla publicable "Resumen por actor".
3. **Ventana de campo obligatoria** y confrontada con lo ejecutado (plan vs real). Hoy dice "Semana 1" con 9 semanas de campo corridas.
4. **Catálogo canónico de estados de llamada** (efectivo / no contesta / número errado / rechazo / pendiente / no barrido), con el crudo del cliente detrás como trazabilidad.

---

## 8. Fase 6 — Superficie

Solo cuando el vocabulario esté fijo.

1. **Franja de contexto** dentro de la paleta del módulo, con el catálogo canónico y sin truncados.
2. **Tarjeta de encuesta**: un solo bloque de KPIs, sin repetir el título, y **ningún gráfico de un solo punto** — regla general del módulo.
3. **Actores comparables sin scroll**: los 4 actores en una vista, con el detalle en panel.
4. **Recopiladores en tabla ordenable** por respuestas, con alerta explícita para los que parecen de prueba.
5. **Fusionar Modelo/Resumen dentro de Modelo** — deja de ser pestaña.
6. **Eliminar scrolls anidados** y llenar el canvas: empty states que ocupen y expliquen.
7. **Saldar el arrastre**: tildes, plurales, el toggle "Incluido" fuera del color de alerta, nombre del spreadsheet en vez del ID, truncados.

---

## 9. ADRs que este plan necesita

1. **Vocabulario y denominadores de acreditación** — efectiva / universo / población / mínimo; prohibición de fallback entre denominadores; una métrica, un origen.
2. **Objetivo declarado por actor** — estado nuevo persistido en `.pulso`, migración aditiva, herencia al reporte.
3. **Persistencia y regeneración local de la reconciliación** — cierra la asimetría de caches y el hueco del ADR 0040 §3.

---

## 10. Gates

Ninguna fase se declara terminada sin evidencia. Mínimo por fase:

- `pnpm --dir frontend typecheck` y `pnpm --dir frontend test` si tocó TS.
- `testthat` focalizado del engine tocado; suite completa antes de cerrar una fase que tocó R.
- Recorrido visual de las pestañas afectadas con `acrconta`, warm start completo, 1512×945 y 1280×800, arriba/medio/final.
- **Chequeo de coherencia numérica**: ninguna métrica homónima difiere entre pestañas de la misma sección.
- Agente `verificador` como gate final.

---

## 11. Loop

Este plan es un **bucle de convergencia**, no una lista que se agota. Cada fase itera auditar → ejecutar → verificar, y el plan entero **solo lo cierra el usuario**. Cada vuelta empieza recorriendo las 22 pestañas con `acrconta` y termina con evidencia, no con una afirmación.
