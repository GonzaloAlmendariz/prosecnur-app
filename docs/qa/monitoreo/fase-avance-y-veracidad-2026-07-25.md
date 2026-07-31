# Fase «Avance y veracidad» — reparación de Monitoreo

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-07-25
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de reparaciones visuales de Monitoreo](../historico/monitoreo-reparaciones-visuales-2026-07.md)

**Origen:** [auditoría visual exhaustiva del 25-07-2026](auditoria-visual-exhaustiva-2026-07-25.md)
**Estado:** plan aprobado para ejecución en oleadas
**Foco declarado:** las pestañas de la sección **Avance** en Territorial y Acreditación

---

## 0. Encuadre

La auditoría rechazó el módulo por tres familias de defecto: **contenido inalcanzable**,
**estados que mienten** y **salidas sin gate**. Esta fase las trata como un solo
problema de raíz: *Monitoreo no tiene un contrato de corte*. Cada superficie inventa
su propio conteo, su propio "listo" y su propio verde, así que la incoherencia no es
un bug puntual sino la ausencia de una fuente de verdad compartida.

La sección **Avance** es donde ese vacío duele más, porque es la sección que el
cliente ve y de la que salen los entregables. Por eso la Ola B —Avance pestaña por
pestaña— es el centro de la fase y no un apéndice.

### Lectura crítica: tres puntos donde la fase se aparta de la auditoría

**1. MON-VIS-07 propone algo que contradice el canon de la casa.**
La auditoría pide «mostrar etiqueta persistente de la pestaña activa» en el rail.
El rail icon-only de 40×40 con material en reposo es el estándar vigente del repo
(ADR 0044 + estandarización reciente de Procesamiento y Cálculo de muestra); ensanchar
el rail de Monitoreo lo sacaría del sistema y rompería la uniformidad de los ocho módulos.

El defecto real, verificado en código, es otro y es más barato de arreglar:

- `MonitoreoWorkbenchRail.tsx:74-79` recibe `badge` y `status` por props y los **descarta**
  al mapear a `ContextTabRailItem`. Acreditación los calcula con esmero
  (`AcreditacionMonitoreoPage.tsx:18344-18406`) y nunca se pintan.
- `ContextTabRail` (`frontend/src/components/ContextTabRail.tsx:7-13`) no tiene contrato
  para badge ni estado.
- Territorial ni siquiera pasa por el wrapper: monta `ContextTabRail` directo
  (`TerritorialMonitoreoPage.tsx:1938`), así que nunca tuvo señal de estado.
- El nombre de la pestaña activa no aparece en el `head` del workbench.

**Reinterpretación adoptada:** el rail se queda icon-only. Se restituyen badge y estado
como señal dentro del ícono de 40×40, y el rótulo de la pestaña activa vive en el
encabezado del workbench, que es donde el sistema ya pone contexto. Esto satisface el
criterio de cierre («el rail identifica la pestaña activa sin depender del tooltip»)
sin romper el estándar.

**2. Los 45 «unreachable» de Acreditación no son una nota al pie, son una falla del auditor.**
La auditoría los declara falsos positivos de `.pulso-module-tile` y sigue adelante. Un
auditor que produce 45 falsos positivos en un modo no es confiable en los otros tres.
La corrección del probe entra en la fase como unidad propia (D3), no como observación.

**3. El P1 de Aulas y el P1 de conteos de Territorial son el mismo defecto.**
«100% con 0 aplicadas» y «36 recibidas / 22 filtradas / 0 válidas» son dos síntomas de
mezclar granos. Se reparan con un solo contrato (Unidad A0), no con dos parches.

---

## 1. Unidad A0 — el contrato de corte (habilitante, bloquea todo lo demás)

Nada de la Ola B se puede ejecutar bien sin esto. Es la primera unidad y la única
que se hace en serie.

### A0.1 — `MonitoreoCorte`: tres granos con nombre

Tipo nuevo en `frontend/src/features/monitoreo/corte/corteContract.ts` (archivo nuevo;
no crece ningún archivo congelado):

| Grano | Qué es | Fuente hoy |
|---|---|---|
| `ingesta` | filas crudas del snapshot | `state.n_rows` |
| `procesable` | casos que pasan el filtro de elegibilidad | `reports.kpis.consentidas` / filtro de fuente |
| `oficial` | válidas defendibles que cuentan como avance | `reports.advance.validas` / `reports.kpis.validas` |

El objeto lleva además `meta`, `brecha`, `cutAt`, `generationStatus` y `explicacion:
{ deIngestaAProcesable, deProcesableAOficial }` —la regla causal en texto corto, con
`deepLink` a la superficie que explica el descarte.

**Regla dura:** ninguna superficie de Avance vuelve a leer `state.n_rows` para hablar de
avance. `n_rows` solo puede rotularse literalmente como «registros del snapshot».
Hoy lo violan al menos `AcreditacionMonitoreoPage.tsx:17728`,
`TerritorialMonitoreoPage.tsx:1959` y ambos paneles de salidas.

### A0.2 — máquina de estados visual

`readyStatus()` (`AcreditacionMonitoreoPage.tsx:18016-18019`) hoy es binaria:
`ready` si hay filas, `warning` si no. Por eso «hay 4 actores» se pinta igual que
«el corte está listo». Se reemplaza por cinco estados con tokens propios:

| Estado | Significado | Token | Verde permitido |
|---|---|---|---|
| `sin-configurar` | falta configuración del estudio | `--pulso-state-unset` | no |
| `no-evaluado` | configurado, control no ejecutado | `--pulso-state-unchecked` | no |
| `parcial` | ejecutado con datos incompletos | `--pulso-state-partial` | no |
| `bloqueado` | prerrequisito ausente | `--pulso-state-blocked` | no |
| `listo` | evidencia completa verificada | `--pulso-state-ready` | **sí, solo aquí** |

Se añade un token separado para **selección** (`--pulso-nav-selected`), hoy mezclado con
el verde de estado. Selección y readiness pasan a usar canales visuales distintos:
selección = fondo/indicador; readiness = punto de estado.

### A0.3 — contrato de tabla honesta

Toda tabla de Monitoreo que recorte declara el recorte. El patrón ya existe y funciona
(`AcreditacionMonitoreoPage.tsx:17391`, «Mostrando 18 de N filas»); se generaliza a un
helper compartido y se prohíbe el slice mudo. Aulas es el peor caso (8 columnas / 80 filas
con 9 columnas pedidas).

**Aceptación A0:** typecheck limpio; test de contrato que falla si una superficie de
Avance importa `n_rows` fuera del rótulo de snapshot; test de que `estadoVisual()` nunca
devuelve `listo` sin evidencia.

---

## 2. Ola B — Avance, pestaña por pestaña (el foco de la fase)

### 2.1 Territorial · Avance (4 pestañas)

Componente raíz: `TerritorialAdvanceWorkbench.tsx` (2.968 líneas).
Salidas van por rama aparte en `TerritorialMonitoreoPage.tsx:1255-1267`.

#### B1 — `resumen` · «Resumen»
*Archivo:* `TerritorialAdvanceWorkbench.tsx:263-324` (`TerritorialAdvanceSummary`),
panel de progreso en `:326-367`.

| Error observado | Causa en código | Cambio | Aceptación |
|---|---|---|---|
| El mismo corte muestra 36 recibidas, 22 filtradas, «100% de 24» y 0 válidas según la superficie | cada panel del canvas calcula su propio total; `advance.validas`, `advance.meta` y los conteos de distrito no comparten denominador declarado | el panel consume `MonitoreoCorte` y **rotula el denominador junto al número** («1.283 válidas de 1.200 meta», no «107%») | los cinco bloques del canvas muestran el mismo `oficial`; si difiere del `ingesta`, el bloque de progreso enuncia la regla causal |
| El anillo de avance puede pasar de 100% sin explicación | `:337` `clamp(advance.avancePct, 0, 100)` recorta la barra pero `:351` imprime el valor real sin recortar | sobre-cumplimiento se rotula explícitamente («meta superada, +83») en vez de un 107% mudo | ningún porcentaje >100 aparece sin la palabra «meta superada» |
| 912 px de scroll en el canvas ejecutivo | `mon-territorial-exec-canvas` apila cinco bloques de altura libre | los dos bloques laterales (`ExecutiveProgressPanel` + `ExecutiveUmpPanel`) quedan fijos; el tablero de distritos y prioridades entran en el scroll | el bloque de progreso y el de UMP siguen visibles al final del scroll a 1366×768 |

#### B2 — `ump` · «Mapa y UMP»
*Archivo:* `:838-1133` (`TerritorialAdvanceUmpSection`), mapa en `:1206`, navegador en `:1819`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| Tres scrolls verticales anidados (1.060 + 223 + 39 px) y dos mapas | la sección apila mapa GPS + mapa de manzanas + lista de UMP, cada uno con su propio contenedor | **un solo mapa con capas conmutables** (GPS / manzanas / cobertura) y un único dueño de scroll en la columna de lista | máximo un scroll vertical por columna; el conmutador de capas es direccionable (`panel=capas`) |
| El scroll de 39 px es una affordance invisible | contenedor hijo con altura casi igual al contenido | altura útil mínima: la lista de UMP muestra **dos tarjetas completas** sin interacción | medición reporta ≥2 tarjetas visibles en 1600×1000, 1366×768 y 1024×600 |
| El inspector de UMP cambia de lado según la paridad de la fila | posicionamiento derivado del índice | posición fija (siempre derecha; en compacto, sideover) | la posición del inspector no depende de qué fila se abrió |

#### B3 — `ritmo` · «Ritmo diario»
*Archivo:* `:2145-2297` (`TerritorialAdvanceRhythmSection`), tabla en `:2298`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| «Mejor día válido: 0» | `:2196` toma el máximo de la serie y lo formatea aunque valga 0; el `S/D` solo cubre `best == null` | si `best.validas === 0`, estado vacío causal: «Sin días con válidas en este corte» | ninguna métrica de ritmo imprime `0` como si fuera un logro |
| «Válidas acumuladas» y «Brecha meta» pueden contradecir el Resumen | `:2194-2196` usan `latest.cumulative_valid` y `targetTotal` calculados aparte | ambas métricas se derivan de `MonitoreoCorte` | Resumen y Ritmo reportan idéntico `oficial` y `meta` |

#### B4 — `salidas` · «Salidas» — **P1 bloqueante**
*Archivos:* `TerritorialOutputsPanel.tsx:31-32` → `MonitoreoOutputsWorkbench.tsx:663-664`.

El gate hoy es literalmente:

```
const canGeneratePdf = hasSnapshot && nRows > 0 && !pdfJobId;
```

`nRows` es el conteo crudo del snapshot. Con 36 filas crudas y **0 válidas** el PDF de
cliente se genera igual. Ese es el hallazgo más grave de la auditoría y es un cambio
de cuatro líneas más su cableado.

| Cambio | Detalle |
|---|---|
| El workbench recibe `corte: MonitoreoCorte` en vez de `nRows` | `hasSnapshot`/`nRows` quedan como props derivadas internas |
| Gate de salida de cliente | `corte.oficial > 0 && corte.generationStatus === "complete"` |
| Gate de Sheets cliente | idéntico, más fuentes activas completas |
| Borrador diagnóstico | permitido con `corte.oficial === 0`, **rotulado en la UI y marcado en el PDF** como «Borrador no publicable» |
| Encabezado del panel | `snapshotHint` (`:989-991`) deja de decir solo «N registros»: dice ingesta, procesable y oficial con fecha de corte |

**Aceptación B4:** con el proyecto semilla `territorial_lima_manzanas` en estado de 0 válidas,
los botones de PDF y Sheets de cliente están deshabilitados con causa visible, y el
único camino disponible produce un artefacto rotulado como borrador.

---

### 2.2 Acreditación · Avance (5 pestañas)

Todo vive dentro de `AcreditacionMonitoreoPage.tsx` (19.100 líneas). **Ninguna de estas
reparaciones puede engordar ese archivo**: cada workbench de Avance que se toque sale a
archivo propio bajo `profiles/acreditacion/avance/`, y el page-file solo lo llama. Esto
salda deuda de la regla de archivos congelados en el mismo movimiento.

#### B5 — `resumen` · «Resumen»
*Archivo:* `:17530-17763` (`AcreditacionAdvanceSummaryWorkbench`) → extraer a `avance/AdvanceResumen.tsx`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| «N registros» en el header usa el conteo crudo | `:17728` `fmt(state?.n_rows ?? totals.universe)` | rótulo explícito de snapshot, separado de efectivas | el header distingue snapshot de efectivas sin ambigüedad |
| `S/D` y `S/M` aparecen junto a KPIs con tono `ready` | `:17739-17740` el tono es fijo, no depende del dato | tono derivado del estado (`no-evaluado` cuando el valor es `S/D`) | ningún `S/D` se pinta con tono de éxito |
| «Efectivas» siempre con tono `ready` aunque valga 0 | `:17740` `tone="ready"` literal | tono por evidencia | `0 efectivas` nunca es verde |

#### B6 — `actores` · «Actores»
*Archivo:* `:16063` (`AcreditacionAdvanceActorsWorkbench`) → extraer a `avance/AdvanceActores.tsx`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| 1.462 px de scroll para una lista de actores | tarjetas de altura libre, una por actor, sin densidad alterna | filas compactas + virtualización; el detalle del actor pasa al inspector, no al flujo | el listado completo de actores del proyecto semilla cabe en ≤1 pantalla y media a 1600×1000 |
| «brechas» en el rail se pinta verde por tener filas | `:18387-18391` `readyStatus(advanceStats.actors > 0)` | estado derivado de brecha real: `listo` solo si `brecha === 0` | un actor con brecha abierta nunca muestra la pestaña en verde |
| No hay atajo a los actores con brecha | — | filtro «solo con brecha» + contador «N de M» | se puede llegar a un actor con brecha en un click desde el rail |

#### B7 — `encuestas` · «Encuestas»
*Archivo:* `:16757` (`AcreditacionAdvanceSurveysWorkbench`) → extraer a `avance/AdvanceEncuestas.tsx`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| El rail declara «N fuentes · canales» en verde con fuentes incompletas | `:18392-18396` `readyStatus(advanceStats.sources > 0)` | el estado refleja fuentes **activas y sincronizadas**, no fuentes declaradas | con una fuente faltante la pestaña está en `parcial`, nunca en `listo` |
| La pestaña no dice de qué corte vienen los canales | — | fecha, procedencia y completitud por canal, con el patrón de Fuentes/Paquete (declarado fortaleza por la auditoría) | cada canal muestra origen + fecha + completitud |

#### B8 — `detalle` · «Detalle»
*Archivo:* `:17480-17529` (`AcreditacionAdvanceDetailWorkbench`), reportes en `:17397-17478`.

| Error observado | Causa | Cambio | Aceptación |
|---|---|---|---|
| «N controles · reglas» en verde por existir | `:18397-18401` | `listo` solo si los controles se ejecutaron y pasaron | un control no ejecutado se lee «No evaluado» |
| El bloque de reporte recorta a 18 filas | `:17391` (ya avisa, pero sin paginación) | se conserva el aviso y se añade paginación o «ver todo» | ninguna fila queda inalcanzable |

#### B9 — `salidas` · «Salidas» — **P1 bloqueante**
*Archivo:* `:17842-17858` → mismo `MonitoreoOutputsWorkbench`.

Comparte reparación con B4 (`nRows` → `MonitoreoCorte`), más lo específico de Acreditación:

- `ESTADO Pendiente` + `EFECTIVAS S/D` conviviendo con botones habilitados es exactamente
  lo que el gate nuevo prohíbe.
- **Sin efectivas determinadas** (`corte.oficial == null`) la salida oficial queda
  bloqueada; el panel explica cuál es el prerrequisito y enlaza a la pestaña que lo resuelve.
- El panel de salidas gana un bloque de *readiness* propio que enumera los prerrequisitos
  con su estado, en lugar de dejar que el usuario los deduzca del hero.

**Aceptación B9:** con `acreditacion_multiactor` en estado pendiente, ningún botón de
salida oficial está habilitado, y el panel enumera qué falta con deep-link a cada bloqueo.

---

## 3. Ola A — bloqueantes fuera de Avance

Se ejecutan en paralelo a la Ola B; no comparten archivos.

**A1 — scroll jails territoriales.** Siete puntos: Fuente/Filtro (203×2), UMPs/Cobertura
(114/104/59), UMPs/Manzanas (120), Consultas/Subsanaciones (126), Ocurrencias/Resumen (39),
Ocurrencias/Alertas (378), Ocurrencias/UMP (16 px útiles para 339). Un dueño de scroll por
región y altura útil mínima declarada. *Aceptación:* todos los bloques reportan
`unreachable:false` y operan con rueda, trackpad y teclado en los tres viewports.

**A2 — corte de Aulas.** 0 aplicadas + 8 válidas + 100% representatividad + 8 brechas +
«Pendiente»/«Listo» simultáneos. Se resuelve con `MonitoreoCorte` separando *cobertura de
respuestas* de *aplicación de cursos-horario*, con denominadores impresos y banner de
snapshot desactualizado.

**A3 — pasos verdes sin evidencia (Aulas/Agenda).** `Kobo + QR` y `Fichas PDF/Word` en verde
con detalle `0/8`, `pendiente`, `sin enlaces`. Los pasos que solo describen arquitectura son
neutros; verde exige evidencia operativa.

**A4 — truncación silenciosa.** Aulas limita a 8 columnas y 80 filas mientras Agenda pide 9.
Aplica el contrato A0.3.

**A5 — Consultas de Aulas mezcla granos.** Cursos repetidos en «Reemplazos y brechas» sin
columna de tipo/motivo/relación titular–reemplazo. Cada fila declara su grano y procedencia.

---

## 4. Ola C — carga cognitiva

**C1 — rail con señal, sin romper el canon.** `ContextTabRail` gana contrato de `badge` y
`status`; `MonitoreoWorkbenchRail.tsx:74-79` deja de descartarlos; Territorial pasa por el
wrapper en vez de montar el rail crudo; el `head` del workbench muestra el nombre de la
pestaña activa. Tooltip accesible por hover **y foco**. El rail sigue siendo 40×40 icon-only.

**C2 — Consultas de Acreditación.** 4.880 / 4.451 / 10.225+983 / 5.802+1.304 px.
Virtualización, filas compactas, «N de M» y preservación del caso seleccionado. El
master-detail actual es una fortaleza: se conserva el patrón y se reduce la longitud.

**C3 — Ocurrencias territorial.** ~360 px de configuración repetida antes del contenido de
cada pestaña; se colapsa a una barra compartida por la sección.

**C4 — Alertas telefónicas.** Hero + vacío central + lateral dicen tres cosas distintas
sobre lo mismo. Un solo estado con causa y siguiente acción. «Sin observaciones disponibles
para este corte» mientras falten fuentes.

**C5 — Anulación territorial.** `confirm()` nativo en una acción destructiva. Diálogo Pulso
con preview del efecto, motivo obligatorio, Cancelar por defecto y restauración de foco.

---

## 5. Ola D — pulido y contrato de QA

**D1** — `input` que desborda 11 px a 1024×600 en Acreditación (`min-width`/`box-sizing`).
**D2** — tipografía: el timestamp del rail llega a 7 px; metadatos en 8–10 px. Se aplica el
piso de 10 px ya establecido en la escala de seis pesos. Fechas ISO crudas → formato local.
**D3** — el auditor deriva su catálogo del registro semántico del frontend
(`useRegistrarPestanasMonitoreo`, ya existe y ya lo alimentan ambos perfiles) en vez de un
catálogo versionado con pestañas retiradas. Excluye `.pulso-module-tile` por contrato.
**D4** — checks nuevos que fallan si `scrollTop` no cambia, si la captura media es idéntica
a la final, o si la sección/pestaña activa no coincide con la declarada.
**D5** — colores literales de Territorial y Telefónico → tokens semánticos de A0.2.

---

## 6. Orquestación

| Ola | Writers | Ownership de archivos | Paralelo con |
|---|---|---|---|
| A0 | 1 (`frontend-react`) | `corte/`, `theme.css`, helper de tablas | — (serie, habilita todo) |
| B (Avance) | 2 | writer 1: `profiles/territorial/TerritorialAdvanceWorkbench.tsx` + `TerritorialOutputsPanel.tsx`; writer 2: `profiles/acreditacion/avance/**` (archivos nuevos) + `salidas/MonitoreoOutputsWorkbench.tsx` | A |
| A | 1 | `profiles/aulas*`, resto de `profiles/territorial/**` | B |
| C | 2 | writer 1: `components/ContextTabRail.*` + `MonitoreoWorkbenchRail.tsx`; writer 2: Consultas/Ocurrencias/Telefónico | — |
| D | 1 | CSS, `scripts/`, probes de QA | C |

Globs sin solape. `MonitoreoOutputsWorkbench.tsx` lo toca **un solo writer** (el de B),
porque B4 y B9 son la misma reparación; Territorial consume el cambio, no lo duplica.

Cada ola cierra con `qa-visual-desktop` independiente y termina en `verificador`.

---

## 7. Gates de verificación

```bash
pnpm --dir frontend typecheck && pnpm --dir frontend test
```

```bash
make monitoreo-qa && make audit-project-visual-matrix
```

Tests nuevos que la fase debe dejar escritos:

- contrato: ninguna superficie de Avance lee `n_rows` para hablar de avance;
- contrato: `estadoVisual()` nunca devuelve `listo` sin evidencia;
- regresión: gate de salidas cerrado con `oficial === 0` (Territorial y Acreditación);
- regresión: `MonitoreoWorkbenchRail` propaga `badge` y `status` al rail;
- regresión: «Mejor día válido» con serie en cero no imprime `0`;
- semántica de navegación: las pestañas de Avance siguen siendo direccionables
  (`?seccion=avance&pestana=...`) tras la extracción a archivos propios.

---

## 8. Criterio de cierre

Sobre el criterio de la auditoría, con dos precisiones:

- las 68 pestañas hidratan sin errores;
- ningún bloque de datos con `unreachable:true`;
- **las salidas oficiales están bloqueadas para cortes incompletos, en los cuatro modos**;
- un mismo corte expresa el mismo `oficial` en todas sus secciones, y cuando difiere del
  crudo lo explica con enlace al bloqueo;
- «sin datos» nunca se pinta como éxito;
- **el rail identifica la pestaña activa por estado e ícono, y el nombre vive en el head**
  (precisión sobre el criterio original, que pedía ensanchar el rail);
- los cinco viewports sin overflow global ni truncamiento crítico;
- **el auditor deriva su catálogo del registro del frontend** y conserva evidencia inicial,
  media y final de cada scroll real.

---

## 9. Decisiones que necesitan tu palabra

1. **Borrador diagnóstico.** ¿El PDF con 0 válidas existe rotulado como «Borrador no
   publicable» con marca de agua, o directamente no se genera?
   *Recomiendo rotulado*: el equipo de campo usa ese PDF para diagnosticar, y quitarlo
   empuja a la gente a exportar por fuera.

2. **Extracción del monolito de Acreditación.** La fase saca cinco workbenches de Avance de
   un archivo de 19.100 líneas. Es la reparación correcta y salda deuda, pero mueve mucho
   código en una sola unidad. *Recomiendo hacerlo*, con la extracción como commit propio
   sin cambio de comportamiento, y las reparaciones encima.

3. **Un solo mapa con capas en Territorial/UMP (B2).** Fusionar los dos mapas es la mejora
   real, pero cambia un patrón que los usuarios ya conocen. *Recomiendo fusionar* con el
   conmutador de capas visible por defecto.
