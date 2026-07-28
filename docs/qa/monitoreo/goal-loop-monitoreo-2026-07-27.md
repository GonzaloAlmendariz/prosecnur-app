# GOAL — Monitoreo: geometría gobernada, no vigilada a mano

**Fecha de apertura:** 27 de julio de 2026
**Estado:** objetivo permanente en curso. **Solo Gonzalo lo cierra.**
**Antecedente:** `docs/qa/monitoreo/territorial_telefonico_visual_cleanup_20260726.md`
(58 iteraciones) y `docs/qa/revamps-visuales-lecciones-operativas-2026-07-26.md`
(contrato operativo). Continúa el goal de la primera tanda, no lo reemplaza.

## Objetivo

> Monitoreo debe verse como **una sola aplicación profesional**, no como un
> mosaico de cajas que crecen con sus datos. Dos bloques hermanos comparten
> marco; una colección repetida conserva su caja aunque tenga 0, 2 u 80 ítems;
> el vacío vive **dentro** de un contenedor visible y nunca entre superficies.
>
> Y esto deja de sostenerse a pulso: **la violación de ese contrato tiene que
> fallar sola.** Una superficie que no lo cumpla debe producir un rojo
> automático, no esperar a que alguien la mire.

La primera parte ya está escrita en `docs/ui-layout-grammar.md` §"Contrato de
geometría y capacidad". La segunda es lo que este goal persigue.

## Por qué este goal y no "seguir puliendo"

Las 58 iteraciones demostraron que el defecto se repara bien y **vuelve**. La
medición del 2026-07-27 explica por qué:

| Hecho medido | Consecuencia |
|---|---|
| 13 declaraciones de `data-qa-geometry-group` en todo el frontend, 9 grupos, 6 archivos | El comprobador solo puede fallar sobre lo declarado |
| 0 declaraciones fuera de Monitoreo | Los demás módulos no tienen este contrato en absoluto |
| `geometryCoverageMisses` solo detecta un grupo **pedido** y ausente | Una colección sin declarar sale verde por ausencia, no por conformidad |
| El contrato `equal` calcula `heightDelta`; no existe `widthDelta` | La mitad del contrato —"anchos parecidos"— no tiene comprobación |
| Casi toda la evidencia del recorrido se pasó por CLI (`--geometry-group`) | Demuestra esa corrida; no deja guard permanente |

Conclusión operativa: **el problema ya no es de CSS, es de cobertura de
contrato.** Seguir reparando superficie por superficie sin cerrar esto garantiza
una tercera tanda idéntica.

## Modo de operación

Bucle de convergencia, **no** lista que se agota:

```
auditar los CUATRO modos (medido, no leído)  →  priorizar un solo defecto literal
   →  scope lock  →  regresión roja  →  reparar  →  verificar con evidencia real
      →  guard en los otros tres modos  →  registrar  →  volver a auditar
```

- Mínimo **seis iteraciones por tanda**.
- **Los cinco carriles no son fases en secuencia.** Cada vuelta elige un carril
  según lo que el barrido encontró; A va primero porque produce el inventario
  que alimenta a B y E, pero después se intercalan. Una tanda sana mezcla
  geometría (B), cronograma (D) y contenido faltante (E) — no agota uno y pasa
  al siguiente, porque eso es otra vez una lista lineal.
- Cada iteración cierra **solo a sí misma**. El goal permanece activo.
- Una vuelta que no encuentra defecto se **reporta como vuelta en seco**, con lo
  que se auditó y con qué evidencia; nunca se convierte en cierre.
- Cada tanda termina commiteada (`/cerrar-trabajo`), sin working trees de miles
  de líneas.

## Contrato de recorrido — los cuatro modos, siempre

**Ninguna vuelta del loop se declara auditada si no cubrió los cuatro modos.**
Monitoreo no es un módulo con variantes decorativas: cada modo reescribe el
juego de secciones y comparte cascadas con los demás, así que una reparación en
uno es una hipótesis de regresión en los otros tres.

### Inventario canónico (de `core/monitoreoRegistry.ts`, 2026-07-27)

| Modo | Familia | Secciones | Proyecto de referencia |
|---|---|---|---|
| **Acreditación** | `acreditacion` | 5 — Fuentes · Modelo operativo · Consultas · Monitoreo telefónico · Avance | `acrconta` (multiactor + Sheets) |
| **Territorial** | `territorial` | 6 — Fuente · UMPs · Validación · Consultas internas · Avance · Ocurrencias | `acnur_acg` (pipeline completo) |
| **Telefónico** | `telefonico` | 5 — Fuentes · Modelo · Llamadas · Consultas · Avance | `acnur_pdm` (repeats Kobo) |
| **Aulas** | `aulas_universitarias` | 5 — Fuentes · Agenda · Avance · Validación · Consultas | `hsvg2026` (marco a escala) |

**21 secciones.** Las pestañas **no** se enumeran aquí a propósito: viven dentro
de cada página de perfil y se publican en runtime vía
`useRegistrarPestanasMonitoreo`. Duplicar ese catálogo ya produjo una copia
desincronizada; el inventario se obtiene del **puente de navegación vivo**
(`window.__pulsoNav`), nunca de una matriz histórica. Referencia de orden de
magnitud, no contrato: Territorial ~28 pestañas, Telefónico 15 base más
`Salvedades` condicional.

### Un modo = un proyecto

El modo **lo determina el estudio, no un click** (ADR 0044). No se navega entre
modos: se abre el proyecto que corresponde. Consecuencias operativas:

- Cada vuelta usa **copia temporal escribible** de los cuatro proyectos; los
  originales quedan intactos.
- El mismo proyecto antes y después de cada reparación. Comparar contra otro
  invalida la evidencia.
- `acnur_acg` tarda ~4 min en warm start y a veces se reinicia solo: **sondear
  `window.__pulsoNav`, nunca dormir a ciegas**.
- `acrconta` está anonimizado y sus **cifras de efectivas no son fiables**
  (418 reales vs 188 en el fixture). Sirve para geometría y composición; no se
  usa para juzgar números.

### Qué obliga cada vuelta

1. **Auditoría de barrido: los cuatro modos, las 21 secciones**, en `1440×1000`
   y `1024×600` como mínimo. Es lo que produce el candidato de la vuelta.
2. **Reparación: un solo defecto**, en el modo donde se midió.
3. **Guard vecino obligatorio.** Si el cambio toca una cascada compartida
   —`profilePage.css`, `monitoreo.css`, chrome, `PageFrame`— se verifica **al
   menos un consumidor representativo de cada uno de los otros tres modos**. Si
   la regla es local, se aísla por componente/estado y se añade el guard igual.
4. **Registro por modo.** El cierre de la iteración declara qué modos se
   midieron, cuáles quedaron cubiertos por guard y cuáles no se tocaron.

### Cobertura declarada, nunca implícita

Un modo que no se pudo auditar en una vuelta —fixture ausente, warm start
fallido, sección sin datos— se registra como **cobertura pendiente con su
razón**. No se infiere que esté bien porque los otros tres lo estén, ni se
compensa con más capturas de un modo ya cubierto. Es el mismo principio que
prohíbe el verde compuesto, aplicado al eje de modos.

## Criterio de priorización

En cada vuelta se elige **un solo** defecto, en este orden:

1. **Contenido inalcanzable o recortado** — tabla en 0 px, texto operativo con
   elipsis, contenido fuera de su clipping ancestor.
2. **Marco gobernado por `items.length`** — la caja crece o encoge con la
   cardinalidad.
3. **Hueco exterior sin dueño** — vacío entre superficies, no dentro de una.
4. **Deriva entre hermanos** — pares o repetidos con `Δ > 2 px` de alto o ancho.
5. **Fricción de recorrido** — scroll anidado, doble dueño, reset ausente.
6. **Accesibilidad del control** — teclado, nombre, foco, Escape.

Si dos vistas empatan, gana la que **una persona usuaria ve primero**: el primer
viewport de la sección debe mostrar trabajo útil.

## Carril A — cerrar el agujero de validación (prioridad de la tanda)

Es trabajo de instrumento, sin riesgo de regresión visual. Va primero porque
todo lo demás depende de él.

- **A1. Detección de grupos no declarados.** El runner infiere colecciones
  candidatas —hermanos visibles de la misma variante bajo un mismo padre, ≥2— y
  emite `geometry-undeclared` en vez de callar. Convierte el verde por ausencia
  en un pendiente visible y, de paso, produce el inventario de trabajo del
  carril B.
- **A2. `widthDelta` en el contrato `equal`.** Completa la mitad faltante del
  contrato y captura desde el marco la familia de defectos de truncación que
  hoy solo se detecta midiendo texto (its. 40, 41, 53, 58).
- **A3. Backfill de declaraciones a markup.** Subir a `data-qa-geometry-group` /
  `-contract` / `-member` / `-capacity` los grupos que hoy solo viven en CLI,
  empezando por los ya reparados, para que no puedan reaparecer en silencio.

Criterio de salida del carril: **cero `geometry-undeclared` en los cuatro modos
× 21 secciones**, y toda superficie reparada durante las 58 iteraciones
protegida por markup, no por un flag de línea de comandos. Un modo con
`geometry-undeclared` sin resolver mantiene el carril abierto aunque los otros
tres estén limpios.

## Carril B — backlog visual vivo

Confirmado con evidencia y aún abierto al 2026-07-27:

- `Telefónico > Fuentes > Paquete` a `1440×900`: seis valores recortados en
  celdas de 118 px (hasta 227 px de déficit); nombre Kobo pierde 68 px a 1024.
  Scope lock de la iteración 58 ya declarado, sin ejecutar.
- `Telefónico > Consultas > Cruces` a `1440×900`: dos dueños verticales en tabla
  y detalle por colisión de especificidad. `Subsanación` no aparece con cero
  salvedades; los estados compactos no hidrataron.
- `Telefónico > Llamadas > Resumen`: alargamiento del panel izquierdo. Diferido
  a propósito — `align-items:start` rompería la igualdad de marcos adyacentes;
  requiere decisión compositiva, no un parche.
- `Acreditación`: falta una corrida verde en una vista que **sí** consuma
  `.mon-profile-panel-head` (iteración 34 quedó sin evidencia directa).

**Sesgo declarado del backlog:** tres de las cuatro entradas son Telefónico y
una es Acreditación; **Territorial y Aulas aportan cero**. Eso no significa que
estén bien — significa que las últimas vueltas miraron ahí. El backlog es una
consecuencia de dónde se auditó, no un mapa de dónde está el daño. Por eso la
vuelta empieza siempre por el barrido de los cuatro modos y **no** por consumir
esta lista.

El backlog es vivo: A1 lo alimentará y cada vuelta puede añadir o retirar
entradas con evidencia.

## Carril D — el cronograma tiene que responder si vamos a tiempo

**Superficie:** `.mon-field-schedule-panel`, pestaña `estrategias` ("Cronograma")
dentro de Modelo. **Compartida por Acreditación y Telefónico**; Territorial y
Aulas no la tienen —Territorial expresa tiempo como "Ritmo diario", que es una
serie, no un plan—. Cualquier cambio aquí es cascada compartida entre dos modos
y exige guard cruzado.

La iteración 54 solo reparó una columna de 220 a 240 px. Eso arregló la lectura,
no la superficie. **Es el único lugar de Monitoreo que expresa tiempo** y hoy no
cierra el ciclo plan → real → desvío.

Lo que debe resolver, en este orden:

1. **¿Vamos a tiempo?** — un veredicto legible en el primer viewport, derivado
   del corte observado contra el plan, no un mosaico de días que el usuario tiene
   que sumar mentalmente.
2. **¿Dónde se desvió?** — `data-desvio` ya existe en el markup; el día que
   rompe el plan debe ser localizable sin recorrer toda la lista.
3. **¿Cuánto falta y a qué ritmo?** — proyección contra las semanas de campo
   declaradas (`durationWeeks`), no solo el acumulado.
4. **Coherencia entre los dos modos** — Acreditación y Telefónico comparten la
   superficie pero alimentan mecanismos distintos. Deben leerse como el mismo
   componente, con los mismos grupos geométricos declarados.

Restricción: esto **no** autoriza inventar métricas. Todo lo que se muestre sale
del corte y del plan ya persistidos, o del engine (ver carril E, categoría 3).
Si el dato no existe, se declara como deuda; no se estima.

Gate propio: además del gate visual, `revisor-metodologico` valida que el
veredicto de tiempo y la proyección tengan denominador y grano correctos. Un
cronograma que miente es peor que uno feo.

## Carril E — pestañas vacías: evaluar qué información les falta

Este carril **modifica una regla del goal** y lo hace de forma deliberada. Hasta
ahora regía *"no se añade copy"*. Sigue rigiendo para el relleno ornamental,
pero se distingue de esto:

- **Relleno ornamental** (prohibido): texto que existe para ocupar espacio.
- **Información faltante** (este carril): la pestaña tiene una función declarada
  en su `label`/`detail` y no muestra el dato que esa función exige.

### Triaje obligatorio de cada pestaña vacía

Ninguna pestaña vacía se toca antes de clasificarla. Son tres categorías y
**solo una autoriza añadir contenido**:

| Categoría | Qué significa | Qué se hace |
|---|---|---|
| **1. Vacío legítimo** | El proyecto realmente no tiene esos datos | Estado vacío honesto **dentro** de la caja de su variante, que diga qué falta y cómo se llena. No es copy ornamental: es orientación operativa. |
| **2. Vacío por fixture** | El dato existe en la realidad pero no en el proyecto de referencia | **Deuda de evidencia declarada**, no defecto. No se repara nada. No se fabrican datos. |
| **3. Vacío por desconexión** | El backend ya lo calcula y el frontend no lo consume | **Defecto real de producto.** Aquí sí se añade la información. |

La categoría 3 no es hipotética: ya está documentada en
`docs/plan-monitoreo-telefonico-2026-07.md` — el engine calcula estados por
encuestador, plataforma-vs-Sheets y el conflicto de enlace, y **el frontend no
consume ninguno**. Misma causa raíz que los fallbacks de acreditación.

### Procedimiento

1. **Inventario**: recorrer las 21 secciones y sus pestañas en los cuatro modos
   y listar las que renderizan vacío o casi vacío. Sale del mismo barrido que
   alimenta el carril A.
2. **Clasificar** cada una en 1 / 2 / 3, **con evidencia**: para la 3, citar la
   función del engine que ya produce el dato.
3. **Reparar solo la categoría 3**, una pestaña por iteración, con contrato
   congelado antes de tocar frontend si cruza capas.
4. La categoría 1 se resuelve en el carril B como geometría + estado vacío útil.
5. La categoría 2 se acumula en el carril C.

### Gate distinto

Este carril **no cierra con el gate visual**. Añadir información es una decisión
de dominio:

- `dominio-prosecnur` confirma que el dato pertenece a esa pestaña y a ese nivel
  de la jerarquía, y no duplica lo que ya dice otra superficie.
- `revisor-metodologico` valida grano, denominador y trazabilidad.
- `guardian-contratos` revisa el contrato si cruza React↔R.
- Recién entonces entra el gate visual y `verificador`.

## Carril C — deuda de evidencia declarada

No son defectos; son cosas que **no podemos demostrar todavía**. Se conservan
declaradas para que nadie las lea como aprobación:

- Alta cardinalidad real de **Aulas**: `hsvg2026` tiene el marco de
  cursos-horario a escala pero no un snapshot de Monitoreo Aulas importable.
- Producción telefónica de alta cardinalidad: `acnur_pdm` permite validar
  chrome, readiness y estados vacíos, pero no una sincronización telefónica
  poblada.

**No se fabrican datos para convertir esto en un pase.** Se resuelve consiguiendo
el fixture o se mantiene declarado.

## Contrato de cada iteración

Igual que en las 58 anteriores, sin excepciones:

1. **Scope lock**: módulo · fuente de verdad · archivos previstos · exclusiones
   explícitas · falla literal medida en px · causa · cambio permitido · riesgo ·
   gate mínimo · stopping rule.
2. **Regresión roja primero.** El test falla *antes* del cambio o no cuenta.
3. **Medir de la hoja a la raíz** y reparar el **primer ancestro** que viola el
   contrato. Nunca acumular compensaciones en selectores más específicos.
4. **Ancho y compacto son contratos distintos**, no un parámetro trasladado.
5. **QA visual real hidratado** en `1440×1000` y `1024×600` como mínimo,
   `1710×1107` y `1280×720/800` cuando la vista lo justifique.
6. **Gate proporcional**: suite de Monitoreo, typecheck, `git diff --check`. Si
   la unidad no toca frontend, no se repite la suite React.
7. **Verificador independiente** antes de declarar cerrada la iteración.

## Reglas de evidencia (no negociables)

- Una captura cuenta solo si demuestra a la vez **ruta, pestaña, estado
  hidratado y ancla de contenido esperada**.
- `waitSelectorMisses > 0`, `projectMisses > 0` u `ok: false` = intento
  inválido. Se repite limpio.
- **Prohibido el "verde compuesto".** Las corridas fallidas se conservan
  etiquetadas como diagnóstico, jamás se combinan para producir una aprobación.
- Navegar por dirección canónica (`--ir`), nunca por etiqueta visible.
- Proyecto real, copia temporal escribible, original intacto. El mismo proyecto
  antes y después.

## Lo que este goal NO autoriza

- Añadir copy, explicaciones o texto ornamental **para llenar espacio**. La
  excepción es el carril E categoría 3: información que la pestaña necesita por
  su función declarada y que el backend ya calcula. Esa distinción se resuelve
  en el triaje, nunca a ojo durante una reparación visual.
- Estimar, proyectar o inferir un dato que no existe, en el cronograma o en
  cualquier otra superficie. Si no está, se declara deuda.
- Reducir la tipografía para esconder un recorte.
- Abreviar con siglas artificiales.
- Eliminar una superficie porque "parece duplicada" sin comprobar que su función
  lo es (`UMP exacta` vs `Cola UMP` son distintas; el defecto era geométrico).
- Estirar secciones semánticamente independientes para igualarlas.
- Convertir capacidad interior legítima en "espacio a recuperar".

## Stopping rule

El goal **solo lo cierra Gonzalo**. Ni el agotamiento del backlog, ni una vuelta
en seco, ni un gate verde lo cierran. Cuando una tanda converge se informa
—qué se auditó, con qué evidencia, qué queda declarado como deuda— y se pregunta
si continuar.

## Tanda 2 — contratos de iteración

### Scope lock — iteración 60 / A1 `geometry-undeclared`

- Módulo: instrumento `scripts/ui-quick-check`, cobertura del contrato
  geométrico.
- Fuente de verdad: este goal, `docs/ui-layout-grammar.md` y baseline real del
  runner: 13 declaraciones, 9 grupos únicos, 6 archivos; Telefónico registrado
  tiene 0 grupos locales.
- Archivos previstos: `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs`, este registro y el arnés
  desechable de evidencia bajo
  `tmp/visual-qa/tanda2-iter60-four-modes/**`.
- Exclusiones: React, CSS, TSX, API, proyectos `.pulso`, navegación, topbar,
  sidebar, A2 `widthDelta`, A3 backfill y workflow de CI.
- Falla literal: una fixture con dos `article` hermanos de la misma variante y
  50 px de deriva sale verde (`geometryCoverageMisses=0`) cuando junto a ella
  existe un grupo declarado válido. El runner sólo mide lo que ya conoce.
- Causa: `geometrySpecs` se llena sólo desde CLI o markup; el fallback de
  cobertura corre únicamente cuando no hubo ninguna auditoría ni miss.
- Cambio permitido: cuando la corrida exige geometría, inferir colecciones
  candidatas de hermanos visibles equivalentes dentro del workbench hidratado
  y emitir `geometry-undeclared`. No se adivina `equal` o `intrinsic`.
- Riesgo: falsos positivos sobre tablas, navegación, tabs, toolbars, menús o
  controles repetidos; se excluyen explícitamente y se conservan modificadores
  semánticos de clase.
- Gate mínimo: regresión Node roja/verde con un positivo y negativos; las tres
  pruebas geométricas existentes siguen verdes; `git diff --check`.
- Stopping rule: exactamente un `geometry-undeclared` para la colección no
  declarada, cero para los negativos y ningún cambio en el resultado de las
  pruebas previas. El barrido vivo de cuatro modos ocurre después de poner
  verde el instrumento; sus intentos inválidos no se combinan.

#### Preparación medida

- Baseline: `node --test scripts/tests/ui-quick-check-geometry.test.mjs` → 3/3
  verde con servidor local efímero.
- El arnés canónico abre proyectos y mide geometría, pero varios `--ir` sólo
  capturan el destino final. El barrido de 21 secciones necesitará capturar una
  celda por navegación y enumerar pestañas con
  `window.__pulsoNav.pestanasDeLaSeccion()`.
- Proyectos canónicos localizados y protegidos 0444: `acrconta`, `acnur_acg`,
  `acnur_pdm` y `hsvg2026`; cada corrida usará copia temporal escribible
  preparada por `api/scripts/reference_project_prepare_run.R`.

#### Resultado medido — iteración 60

- Roja causal: la fixture con un grupo `equal` válido y dos
  `article.candidate-card` hermanos no declarados devolvía `status=0`,
  `geometryGroups=1` y `geometryCoverageMisses=0`; la aserción esperada falló
  con `0 !== 1`.
- Reparación del instrumento: cuando `requireGeometry` está activo, el runner
  examina hermanos visibles de la misma variante dentro de la raíz hidratada,
  excluye navegación, tablas, tabs, toolbars, menús y controles, y emite
  `geometry-undeclared`. No infiere `equal` ni `intrinsic`.
- Verde focal: `node --test scripts/tests/ui-quick-check-geometry.test.mjs` →
  4/4; las tres regresiones anteriores permanecen verdes y la nueva produce un
  único miss para la colección no declarada, cero para los negativos.
- Para no duplicar la lógica, `inspectDom` quedó exportado y el arnés temporal
  lo ejecuta sobre una sola página viva. Cada modo abre una copia `.pulso` una
  vez, enumera pestañas con `window.__pulsoNav.pestanasDeLaSeccion()`, navega
  con `ir()` y conserva dirección solicitada/real, captura de viewport y full
  page en `1440×1000` y `1024×600`.
- Evidencia agregada:
  `tmp/visual-qa/tanda2-iter60-four-modes/matrix.{json,md}`.

| Modo | Secciones | Pestañas runtime | Celdas | PASS | FAIL | DEBT | INVALID | A1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Acreditación | 5 | 22 | 27 | 6 | 21 | 0 | 0 | 0 |
| Territorial | 6 | 28 | 34 | 23 | 11 | 0 | 0 | 0 |
| Telefónico | 5 | 15 | 20 | 0 | 4 | 16 | 0 | 0 |
| Aulas | 5 | desconocidas | 5 | 0 | 0 | 0 | 5 | n/a |
| **Total** | **21** | **65 verificadas** | **86** | **29** | **36** | **16** | **5** | **0** |

Las 81 celdas alcanzables produjeron 162 capturas de viewport y 162 capturas
full page. El gate independiente detectó que el primer recuento confundía
"DOM medido sin deriva" con "contenido esperado presente". Se auditó entonces
el contenido de las 86 celdas y cada una conserva `visualStatus` además de una
clasificación de contenido: 4 vacíos legítimos, 16 deudas de fixture y 26
desconexiones. Ningún vacío o casi-vacío queda verde por omisión.

- Acreditación: Fuentes prueba 4 actores y 1,277 registros en `acrconta`, pero
  Modelo muestra `ACTORES 0 / UNIVERSO 0`; Consultas deriva 0 filas/casos;
  Teléfono muestra `BASE TEL. S/D`; y Avance conserva los 1,277 crudos pero
  deriva 0 actores/respuestas. Las 21 celdas afectadas son `FAIL`, aunque su
  `visualStatus` aislado haya sido PASS. Avance/Salidas es el único vacío
  legítimo: la salida aún no fue generada y conserva un contenedor de estado.
- Telefónico: `acnur_pdm` prueba Fuentes y navegación, pero no trae la
  sincronización telefónica productiva, mecanismos Kobo/CodPulso ni cuotas
  derivadas que exige esta inspección. Sus 16 celdas dependientes son `DEBT`,
  no PASS; sus fallos visuales originales quedan preservados en
  `visualStatus`.
- Territorial: Geolocalización sin sospechas, Reconciliación sin cambios en
  cola y Ocurrencias sin alertas son tres vacíos legítimos dentro de
  contenedores visibles; el proyecto restante permanece poblado.
- Aulas: las cinco celdas son desconexiones categoría 3 y siguen `INVALID`
  porque no hubo DOM del modo que medir.

Los 36 fallos compuestos conservan además los defectos visuales originales:

- Acreditación: placeholder de búsqueda recortado en Consultas, Cruces y
  Subsanación.
- Territorial: `scroll-unreachable` y `overflow-y` en Modelo/Tabla; placeholders
  recortados en Calidad, Consultas, Subsanaciones y Ocurrencias/UMP.
- Telefónico: `overflow-x` compacto en las cuatro vistas de Fuentes y
  placeholder recortado en Consultas/Cruces.
- Aulas: la dirección `monitoreo/aulas/fuentes` resolvió exactamente, pero la
  superficie permaneció en `monitoreo-mode-choice` y nunca montó
  `monitoreo-aulas`. Sus cinco secciones son `INVALID/disconnected`; las
  pestañas runtime quedan `null`, no inventadas.

Stopping rule A1 satisfecho: positivo y negativos de la regresión son exactos.
En las superficies realmente montadas el barrido no encontró candidatos
adicionales sin declarar; eso no se extrapola a tarjetas ausentes. Los vacíos
legítimos, la deuda de fixture y las desconexiones quedan trazados por separado.
Falta repetir el gate independiente de cierre de esta unidad.

#### Gate independiente — iteración 60

`APROBADO`: 4/4 regresiones verdes; sintaxis y `diff --check` verdes; 86
celdas = 29 PASS + 36 FAIL + 16 DEBT + 5 INVALID; 162 capturas de viewport y
162 full-page existentes. Confirmó literalmente el contraste 4 actores en
Fuentes vs. 0 en Modelo, las 21 celdas de Acreditación en categoría 3, las 16
deudas de fixture de Telefónico, los tres vacíos legítimos territoriales y las
cinco celdas Aulas `INVALID`. No queda pendiente para cerrar esta unidad.

### Scope lock — iteración 61 / A2 `widthDelta`

- Módulo: instrumento `scripts/ui-quick-check`, contrato geométrico `equal`.
- Fuente de verdad: Carril A2 de este goal y el contrato de geometría de
  `docs/ui-layout-grammar.md`.
- Archivos previstos: `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-geometry.test.mjs`, este registro y el arnés
  desechable bajo `tmp/visual-qa/tanda2-iter6{0,1}-four-modes/**`.
- Exclusiones: React/CSS/TSX, API, fixtures `.pulso`, A3 backfill, navegación,
  topbar, sidebar y reparación de los hallazgos visuales de Iter60.
- Falla literal: dos miembros `equal` con el mismo alto pero anchos 200/260 px
  producen cero `geometryIssues`; el reporte no contiene `widthDelta`.
- Cambio permitido: medir ancho de los marcos ya declarados, publicar
  `widthDelta` en el audit y emitir un issue específico cuando exceda la misma
  tolerancia; no cambiar detección de grupos, capacidad ni scroll.
- Riesgo: marcar composiciones responsive deliberadamente asimétricas que
  fueron declaradas erróneamente como `equal`; eso es deuda de declaración,
  no razón para silenciar el contrato.
- Gate mínimo: regresión roja/verde dedicada; 4 regresiones previas verdes;
  `node --check` y `git diff --check`.
- Stopping rule: la fixture 200/260 emite exactamente un fallo de ancho con
  `widthDelta=60`, una fixture `equal` válida conserva delta dentro de 2 px y
  no cambia ningún resultado previo.

#### Resultado medido — iteración 61

- Roja causal: la fixture de dos marcos de igual alto y anchos 200/260 px
  terminó `ok=true`, `geometryIssues=0`; la aserción esperada falló `0 !== 1`.
- Reparación: cada audit publica `widthDelta`; `equal` emite
  `equal-frame-width-drift` con los anchos de los miembros cuando el delta
  excede la tolerancia. No cambió inferencia, capacidad ni scroll.
- Verde focal: 5/5 regresiones; el caso nuevo produce exactamente
  `widthDelta=60`, la fixture válida queda dentro de 2 px y las cuatro pruebas
  previas conservan su resultado.
- El primer barrido reveló contaminación de navegación en las filas puente:
  el segundo viewport heredaba la última pestaña visitada. Esos intentos se
  descartaron. El arnés final registra el destino runtime esperado, precalienta
  la sección para montar su catálogo, exige `actual===expectedActual` en cada
  captura y elimina resúmenes residuales antes de reintentar.
- Evidencia agregada final:
  `tmp/visual-qa/tanda2-iter61-four-modes/matrix.{json,md}`.

| Modo | Secciones | Pestañas runtime | Celdas | PASS | FAIL | DEBT | INVALID | A2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Acreditación | 5 | 22 | 27 | 5 | 22 | 0 | 0 | 1 |
| Territorial | 6 | 28 | 34 | 25 | 9 | 0 | 0 | 0 |
| Telefónico | 5 | 15 | 20 | 0 | 4 | 16 | 0 | 0 |
| Aulas | 5 | desconocidas | 5 | 0 | 0 | 0 | 5 | n/a |
| **Total** | **21** | **65 verificadas** | **86** | **30** | **35** | **16** | **5** | **1** |

Integridad: 81 celdas alcanzables, 162 capturas de viewport, 162 full-page,
166 auditorías geométricas con `widthDelta`, cero destinos contaminados y cero
campos de ancho ausentes. Se preserva el triaje de contenido de Iter60: 4
vacíos legítimos, 16 deudas de fixture y 26 desconexiones.

Hallazgo nuevo A2: `Acreditación > Fuentes > Activas`, a `1024×600`, declara
un grupo `equal` cuyos marcos miden 247.38, 334.31 y 334.31 px; delta 86.93 px.
La celda ahora falla automáticamente. Queda como candidato del carril B; no se
mezcla su reparación CSS con esta iteración del instrumento.

Aulas repitió la desconexión literal: la ruta resolvió, pero la marca visible
permaneció `monitoreo-mode-choice`; sus cinco secciones siguen `INVALID` y sus
pestañas runtime siguen `null`. Territorial requirió un reintento de warm start;
la matriz final apunta solo a la copia preparada a las 12:08:16 y no referencia
los intentos previos.

Stopping rule A2 satisfecho. Falta el gate independiente de esta unidad.

#### Gate independiente — iteración 61

`APROBADO`: 5/5 regresiones; 86 celdas = 30 PASS + 35 FAIL + 16 DEBT +
5 INVALID; 324 imágenes presentes; 166 auditorías con `widthDelta`; cero
destinos divergentes. Confirmó literalmente Activas compacto con
`widthDelta=86.93` y anchos `[247.38, 334.31, 334.31]`, además de la matriz
Territorial final, Telefónico determinista y Aulas sin cobertura inventada.

### Scope lock — iteración 62 / Activas compacto

- Módulo: Acreditación > Fuentes > Activas; workbench de monitoreo, sin tocar
  topbar ni sidebar.
- Fuente de verdad: hallazgo A2 de Iter61, contrato `equal` del markup,
  `docs/ui-layout-grammar.md` y dirección `revamp-visual`.
- Dirección visual: conservar los tres contenedores pares, su acento semántico
  y su capacidad interior; en compacto deben compartir ancho y alto exterior,
  con una sola retícula repetible. El contenido puede ocupar menos espacio
  dentro de cada marco; no se estiran filas ni textos.
- Contrato de armonía: grupo `acreditacion-active-sources`; ejes gobernados
  ancho+alto, tolerancia 2 px; cardinalidad 1/pocos/muchos resuelta dentro de
  cada panel; secciones externas intrínsecas; el dueño de overflow existente
  permanece sin cambios.
- Archivos previstos: componente/estilo que realmente gobierna
  `acreditacion-active-sources`, regresión focal disjunta si existe un punto de
  prueba estable, este registro y evidencia Iter62.
- Exclusiones: datos, API, fixtures, navegación, topbar/sidebar, otras vistas
  de Fuentes, A3 y reparaciones de contenido desconectado.
- Riesgo: igualar columnas con `1fr` puede reducir la primera región y recortar
  texto; debe medirse ancho, texto, alto y overflow en 1440×1000 y 1024×600.
- Gate mínimo: prueba/frontend typecheck, Acreditación Activas en ambos
  viewports con delta ≤2 px y guard representativo de Territorial, Telefónico
  y Aulas (o cobertura pendiente literal si Aulas sigue desconectado).
- Stopping rule: el grupo conserva tres miembros y produce
  `heightDelta≤2`, `widthDelta≤2`, sin placeholder/texto recortado, overflow
  nuevo ni pérdida de alcance del último elemento.

#### Resultado medido — iteración 62

- Roja causal: la regresión existente protegía la asimetría compacta y exigía
  literalmente `minmax(210px, 0.74fr) + 1fr + 1fr`; al cambiar el contrato a
  tres columnas iguales falló 1/10 con esa regla como valor recibido.
- Reparación: en `max-width:1320px`, `.mon-acr-active-grid` usa el mismo
  `repeat(3, minmax(0, 1fr))` que escritorio. No se tocaron alturas, tarjetas,
  contenido, overflow ni el apilado bajo 980 px.
- Verde local: `AcreditacionActiveSourcesLayout.test.ts` 10/10;
  `pnpm --dir frontend typecheck` verde; `git diff --check` focal verde.
- Evidencia:
  `tmp/visual-qa/tanda2-iter62-four-modes/matrix.{json,md}`.

Antes (Iter61, 1024×600): anchos `[247.38, 334.31, 334.31]`,
`widthDelta=86.93`, FAIL. Después: `[305.33, 305.33, 305.34]`,
`widthDelta=0.01`; altos `[300, 300, 300]`. A 1440×1000: anchos
`[444, 444, 444]`, altos `[420, 420, 420]`, ambos deltas 0. En las dos
capturas: cero issue geométrico, cero issue visual y cero overflow global.

| Modo | Secciones | Pestañas runtime | Celdas | PASS | FAIL | DEBT | INVALID |
|---|---:|---:|---:|---:|---:|---:|---:|
| Acreditación | 5 | 22 | 27 | 6 | 21 | 0 | 0 |
| Territorial | 6 | 28 | 34 | 25 | 9 | 0 | 0 |
| Telefónico | 5 | 15 | 20 | 0 | 4 | 16 | 0 |
| Aulas | 5 | desconocidas | 5 | 0 | 0 | 0 | 5 |
| **Total** | **21** | **65 verificadas** | **86** | **31** | **34** | **16** | **5** |

Las 81 celdas alcanzables conservan 162 capturas de viewport, 162 full-page,
cero destinos contaminados y `widthDelta` en todos los audits. Territorial y
Telefónico no añadieron issues frente a Iter61. Aulas agotó 600 s con la ruta
resuelta pero `monitoreo-mode-choice` visible; sigue categoría 3, sin tabs ni
capturas inventadas.

La dirección de `revamp-visual` y `govern-visual-harmony` mantuvo la capacidad
vacía dentro de cada contenedor y gobernó únicamente los ejes exteriores del
grupo par. Stopping rule satisfecho; falta gate independiente.

#### Gate independiente — iteración 62

`APROBADO`: 10/10 tests de layout, typecheck y `diff --check` verdes. Confirmó
el antes 86.93 px y el después 0.01 px, altos idénticos, cero clipping/overflow,
86 celdas y guards sin regresiones en Territorial/Telefónico; Aulas conserva
cinco `INVALID` sin evidencia inventada.

### Scope lock — iteración 63 / Modelo territorial compacto

- Módulo: Territorial > Modelo > Tabla, workbench de UMPs.
- Fuente de verdad: reporte Iter62 `09-modelo-tabla` a 1024×600 y regla No
  Scroll Jail de `docs/ui-layout-grammar.md`.
- Falla literal: `mon-territorial-route-table-card` mide 22 px de alto con
  `scrollHeight=10,516`; `context-card` 129 px con `scrollHeight=518`; el dueño
  exterior llega al final pero el último contenido queda recortado.
- Causa: al apilar bajo 1120 px se liberan `height/overflow`, pero la sidebar
  conserva una fila `minmax(0,1fr)` y sus hijos pierden un viewport propio;
  dos cascadas convierten listas acotadas en overflow visible dentro de un
  ancestro aún gobernado.
- Dirección: dos superficies apiladas, cada una con marco visible y viewport
  útil estable; tabla y ficha conservan un único scroll interno alcanzable. El
  área principal puede desplazar la composición, no esconderla.
- Contrato de capacidad: tabla y ficha son secciones independientes (altos
  intrínsecos/acotados, no iguales); su contenido largo vive en
  `.mon-territorial-route-table-scroll` y `.mon-territorial-route-context-body`;
  tolerancia de hueco exterior 2 px; último elemento alcanzable.
- Archivos previstos: `territorialProfile.css` y/o `monitoreo.css`, regresión
  focal territorial, este registro y evidencia Iter63.
- Exclusiones: TSX/datos/API, contenido de filas, topbar/sidebar globales,
  Resumen/Atlas, otras secciones y cambios tipográficos.
- Riesgo: entregar 10,516 px al scroll de página o crear doble scroll; el gate
  debe comprobar dimensiones visibles, dueño único y alcance final.
- Gate mínimo: regresión roja/verde, typecheck, Modelo/Tabla 1440×1000 y
  1024×600, más guards de los cuatro modos.
- Stopping rule: cero `overflow-y` sintomático en los dos marcos, cero
  `scroll-unreachable`, ambos viewports internos con alto útil y último
  contenido alcanzable.

#### Resultado medido — iteración 63

- Roja causal reproducida en Iter62, `1024×600`: la tabla colapsaba a 22 px
  con `scrollHeight=10,516`; la ficha quedaba en 129 px con
  `scrollHeight=518`; el panel exterior emitía `scroll-unreachable` y su último
  contenido no era alcanzable.
- Reparación: bajo 1120 px, la sidebar apilada declara dos filas compactas con
  capacidad propia (`clamp(360px, 58vh, 560px)` y
  `clamp(320px, 50vh, 480px)`). Tabla y ficha ocupan el 100% de su fila y
  ocultan únicamente el excedente del marco; sus cuerpos son los dueños del
  scroll interno. No cambió el contenido, el TSX ni el workbench global.
- Verde focal: `TerritorialGeometryCapacityLayout.test.ts` 3/3; typecheck y
  `git diff --check` verdes.
- Evidencia:
  `tmp/visual-qa/tanda2-iter63-four-modes/matrix.{json,md}`.

Después, `Territorial > Modelo > Tabla` a `1024×600` queda sin issues visuales,
geométricos ni scroll jail. El panel visible conserva `950×343.84`; su dueño
de scroll tiene `clientHeight=330`, `scrollHeight=861` y `maxScroll=531`; llega
al final, la ficha operativa es el último contenido alcanzable y
`clippedBy=null`. La celda también pasa a `1440×1000`.

| Modo | Secciones | Pestañas runtime | Celdas | PASS | FAIL | DEBT | INVALID |
|---|---:|---:|---:|---:|---:|---:|---:|
| Acreditación | 5 | 22 | 27 | 6 | 21 | 0 | 0 |
| Territorial | 6 | 28 | 34 | 26 | 8 | 0 | 0 |
| Telefónico | 5 | 15 | 20 | 0 | 4 | 16 | 0 |
| Aulas | 5 | desconocidas | 5 | 0 | 0 | 0 | 5 |
| **Total** | **21** | **65 verificadas** | **86** | **32** | **33** | **16** | **5** |

Integridad: 81 celdas alcanzables, 162 capturas de viewport, 162 full-page y
166 auditorías con `widthDelta`; cero archivos ausentes, destinos divergentes o
categorías 2/3 aceptadas como PASS. Territorial resolvió exactamente una
incidencia y no añadió ninguna; Telefónico y Acreditación no añadieron issues.
Aulas agotó 600 s y permaneció en `monitoreo-mode-choice`, por lo que conserva
cinco `INVALID` sin matrix, reports ni imágenes inventadas.

Stopping rule satisfecho. Falta el gate independiente de esta unidad.

#### Gate independiente — iteración 63

`APROBADO`: 3/3 regresiones, typecheck y `diff --check` verdes. Confirmó el
cambio literal `FAIL → PASS` solo en `Territorial/09-modelo-tabla`, con tres
incidencias resueltas y ninguna nueva en las otras 33 celdas territoriales ni
en Acreditación/Telefónico. Verificó el dueño de scroll `330/861`,
`maxScroll=531`, final alcanzable, `clippedBy=null`, 86 celdas, 324 imágenes y
166 auditorías con ancho numérico. Aulas conserva cinco `INVALID` tras una
espera superior a 600 s, sin cobertura inventada.

### Scope lock — iteración 64 / Actores de Acreditación con marco verificable

- Módulo: Acreditación > Modelo > Estructura; cuatro tarjetas de actor.
- Fuente de verdad: captura del usuario, principio de capacidad interior de
  este goal y contrato `equal` de `docs/ui-layout-grammar.md`.
- Falla literal: la cardinalidad de Base y barrido/Fuentes de respuesta podía
  gobernar el alto exterior. El CSS actual ya propone filas de 304 px, pero la
  quinta pista de la tarjeta sigue siendo `auto` y el barrido real Iter63 no
  prueba la composición porque su fixture llega con `ACTORES 0`.
- Dirección: las cuatro tarjetas comparten marco exterior; la variación vive
  dentro de la lista de mecanismos. La capacidad sobrante debe pertenecer a
  esa lista, no quedar como hueco exterior ni expandir la tarjeta.
- Contrato de armonía: grid `equal` con tolerancia 2 px; cada tarjeta es miembro
  y superficie de contenido; su lista es la capacidad interna y dueña del
  overflow. Estado escaso conserva vacío interior; estado denso llega al último
  mecanismo mediante scroll.
- Archivos previstos: `profilePage.css`, markup de
  `AcreditacionMonitoreoPage.tsx`, regresión focal existente y este registro.
- Exclusiones: datos/API/fixtures, topbar/sidebar, otras pestañas, Teléfono y
  cambios tipográficos.
- Riesgo: una fila flexible sin `min-height:0` puede recortar mecanismos o crear
  doble scroll; una declaración QA sin cuatro actores no puede aceptarse como
  evidencia visual del caso poblado.
- Gate mínimo: roja/verde focal, typecheck, `ui-quick-check` sobre fixture DOM
  equivalente si el proyecto real sigue sin actores, Acreditación completa y
  guards de los otros modos.
- Stopping rule: el contrato geométrico detecta cualquier deriva exterior;
  quinta pista `minmax(76px,1fr)`, lista interna desplazable, sin regresión de
  apilado compacto ni aceptación falsa del estado `ACTORES 0` como prueba de
  las cuatro tarjetas.

#### Resultado medido — iteración 64

- Roja causal: 2/11 fallos. La tarjeta aún declaraba cinco pistas `auto` y el
  markup no publicaba el grupo `acreditacion-model-actors` ni su capacidad.
- Reparación: la quinta pista es `minmax(76px, 1fr)`; cada tarjeta se declara
  miembro del grupo `equal`; la lista de mecanismos se declara contenido y
  capacidad `owned`. El grupo solo se publica cuando existen actores, de modo
  que el panel `Sin actores detectados` no produce un falso audit de cuatro
  tarjetas.
- Verde focal: 11/11 tests de Acreditación; 5/5 regresiones del inspector
  geométrico (incluidos deriva de marco, scroll de capacidad, wrappers,
  geometría no declarada y ancho desigual); typecheck y `diff --check` verdes.
- Evidencia:
  `tmp/visual-qa/tanda2-iter64-four-modes/matrix.{json,md}`.

La retícula conserva dos columnas con filas repetidas de 304 px en escritorio
y una columna bajo 1180 px; la tarjeta ocupa el 100% del marco. La lista interna
mantiene `min-height=76px`, `max-height=160px` y `overflow:auto`, por lo que la
cardinalidad no altera el alto exterior. El proyecto real de referencia sigue
mostrando `ACTORES 0` y `Sin actores detectados` en ambos viewports; solo audita
el workbench, y el triaje lo mantiene como desconexión de contenido, no como
evidencia visual poblada.

| Modo | Secciones | Pestañas runtime | Celdas | PASS | FAIL | DEBT | INVALID |
|---|---:|---:|---:|---:|---:|---:|---:|
| Acreditación | 5 | 22 | 27 | 6 | 21 | 0 | 0 |
| Territorial | 6 | 28 | 34 | 26 | 8 | 0 | 0 |
| Telefónico | 5 | 15 | 20 | 0 | 4 | 16 | 0 |
| Aulas | 5 | desconocidas | 5 | 0 | 0 | 0 | 5 |
| **Total** | **21** | **65 verificadas** | **86** | **32** | **33** | **16** | **5** |

Integridad: 81 reports, 162 capturas de viewport, 162 full-page, 166 auditorías
con `widthDelta`, cero destinos divergentes, archivos ausentes o categorías 2/3
aceptadas como PASS. Territorial y Telefónico conservaron exactamente sus
firmas de Iter63; Modelo/Tabla territorial sigue con final alcanzable. Aulas
agotó 600 s, no montó `monitoreo-aulas` y conserva cinco `INVALID` sin evidencia
inventada.

Stopping rule satisfecho con la limitación explícita de fixture poblada. Falta
el gate independiente.

#### Gate independiente — iteración 64

`APROBADO`: 11/11 tests focales, 5/5 regresiones del inspector, typecheck y
`diff --check` verdes. Confirmó filas de 304 px, stretch, quinta pista
`minmax(76px,1fr)`, lista interna 76..160 con scroll y contrato `equal`
condicionado a `cards.length`. Verificó que `ACTORES 0` produce cero audits del
grupo y queda categoría 3/FAIL, no una prueba poblada falsa. Matriz global:
86 celdas, 324 imágenes y 166 auditorías; guards sin regresiones y Aulas con
cinco `INVALID` tras 631.5 s. Queda pendiente una captura futura hidratada de
las cuatro tarjetas; el contrato estático y el inspector equivalente sí quedan
cubiertos.

#### Requisito entrante — ownership Modelo → Teléfono

El usuario fijó un contrato funcional adicional: Modelo debe ser la fuente de
verdad de los actores, permitir definir su nombre visible y seleccionar 0..N
actores que participan en la sección Teléfono. El estado actual no lo cumple:
reconstruye actores desde reportes/metas/fuentes y Teléfono aplica heurísticas
globales de barrido o columnas de contacto.

La dirección congelada para una iteración arquitectónica separada es extender
`monitoreo_profile.units` con identidad técnica estable, etiqueta editable y
participación telefónica explícita; cero seleccionados produce un estado vacío
útil y nunca activa heurísticas. La migración será aditiva, no marcará dirty al
abrir y persistirá en la primera mutación explícita. Por cambiar schema `.pulso`
y ownership entre secciones, requiere ADR complementario a 0010/0040, contratos
backend/frontend y round-trip; no se mezcla con el gate cosmético de Iter64.

### Scope lock — iteración 65 / contrato persistido de actores

- Módulo: Monitoreo Acreditación, contrato Modelo → configuración; primera de
  tres unidades para el requisito funcional entrante.
- Fuente de verdad: requisito del usuario, `monitoreo_profile.units`, ADR 0010,
  identidad técnica/etiqueta del ADR 0040 y contrato `.pulso`.
- Falla literal: `units` solo normaliza `id/type/label/actor/segment/group`;
  Modelo reconstruye actores desde reportes y Teléfono no recibe una selección
  autoritativa. Renombrar por texto puede romper metas y asociaciones.
- Contrato congelado `monitoreo_profile_v2`: cada unit tiene `id` técnico único
  e inmutable, `actor` como clave legacy/inmutable de datos, `label` visible y
  editable, y `phone={enabled,role}` con roles `none|target`. Cero units con
  `phone.enabled=true` es válido.
- Migración: normalización aditiva en memoria; legacy sin `phone` queda
  deshabilitado, sin inferir por columnas, nombres o teléfono. Abrir no marca
  dirty; la primera mutación explícita persiste v2 en `monitoreo_config`.
- Mutación: endpoint dedicado `/api/monitoreo/acreditacion/model` reemplaza la
  lista validada, rechaza IDs duplicados/cambios de `actor` para un ID existente
  y usa `.monitoreo_store_config`, heredando dirty e invalidación de caches.
- Archivos previstos: ADR 0045 e índice; `monitoreo_engine.R`,
  `router_monitoreo.R`, nueva regresión backend y este registro.
- Exclusiones: filtrado de reportes telefónicos (Iter66), UI/API TypeScript
  (Iter67), inferencias legacy, fixtures `.pulso`, secretos, topbar/sidebar y
  cambios visuales.
- Riesgo: reidentificar actores existentes por etiqueta o marcar dirty durante
  una lectura. Debe preservarse `actor` aunque cambie `label` y no crear una
  nueva key top-level de sesión.
- Gate mínimo: tests R focales de normalización/validación/mutación, round-trip
  por la key existente, `session_set`/dirty, pruebas Monitoreo relacionadas y
  `git diff --check`.
- Stopping rule: shape v2 determinista, cero activación implícita, IDs/actor
  protegidos, endpoint persiste mediante el dueño canónico y documentación
  arquitectónica verificable.

#### Resultado medido — iteración 65

- Roja independiente: 20 fallos y 2 pases. `schema_version` y `phone` eran
  `NULL`; el helper de mutación no existía.
- Contrato: ADR 0045 aceptado e indexado. `monitoreo_normalize_profile()`
  produce `monitoreo_profile_v2`; cada unit conserva siete campos y normaliza
  `phone` de forma determinista. `enabled` es autoritativo: true implica
  `target`; false o ausencia legacy implica `none`.
- Compatibilidad: unidades legacy `id+label` fijan `actor=label`; no se activa
  telefonía por texto, columnas o fuentes. IDs legacy duplicados reciben un
  sufijo determinista solo en lectura; la mutación explícita los rechaza.
- Mutación pura: `monitoreo_update_acreditacion_model_units()` acepta cero
  seleccionados, preserva `id/actor` al editar `label` y emite cinco errores
  registrados para ID vacío/duplicado/inmutable, actor vacío o actor inmutable.
- Persistencia: `POST /api/monitoreo/acreditacion/model` recibe la lista
  completa, aplica el helper y guarda mediante `.monitoreo_store_config`; el
  test de sesión confirma que el helper no muta y el store sí marca dirty con
  proyecto abierto.
- Verde focal inicial: 34/34 aserciones; registro de errores 6/6; vecinos engine
  344 PASS/0 FAIL (1 warning de entorno) y performance 100/100. Parse de los
  tres archivos R, montaje único del endpoint y `git diff --check` verdes.

No se creó una key de sesión nueva ni se tocaron filtrado telefónico,
TypeScript, fixtures o `project_pulso`: el subshape viaja dentro del
`monitoreo_config` ya portable. Stopping rule satisfecho; falta gate
independiente.

#### Gate independiente inicial — iteración 65

`RECHAZADO`: el caso previo `{id=egresados, actor=Egresados}` aceptaba una
mutación `{id=graduados, actor=Egresados}`. El guard solo buscaba por el ID
entrante y, al cambiarlo, el mismo actor evadía la inmutabilidad declarada en
ADR 0045. El resto del gate quedó verde (34/34 focales, 6/6 registro de
errores, parse de tres archivos, endpoint único, performance y motor sin
fallos; un warning ambiental del caché cartográfico). La unidad permanece
abierta hasta proteger también `actor previo → id previo`, añadir la regresión
exacta y repetir el gate independiente.

#### Gate independiente final — iteración 65

`APROBADO`: la evasión exacta `egresados/Egresados → graduados/Egresados`
devuelve ahora `409 E_MONITOREO_MODEL_UNIT_ID_IMMUTABLE`. La regresión pasó de
3 fallos/36 pases a 39/39. El re-gate confirmó además que reordenar, renombrar
`label`, alternar participación telefónica, añadir un actor nuevo u
omitir/eliminar uno siguen permitidos; cambiar `actor` para el mismo ID sigue
rechazado. Legacy sin `phone` queda `disabled/none` y cero seleccionados sigue
siendo válido. Registro 6/6, parse 3/3, endpoint único y `diff --check` verdes;
motor y performance se reutilizaron del gate inicial porque el hotfix quedó
aislado al helper, registro y regresión.

### Scope lock — iteración 66 / Teléfono consume exclusivamente actores de Modelo

- Módulo: Monitoreo Acreditación, generación de la ventana y hoja Teléfono;
  segunda unidad del requisito Modelo → Teléfono.
- Fuente de verdad: ADR 0045 y `monitoreo_profile_v2$units[*].phone.enabled`.
- Falla literal: `.monitoreo_report_phone_blocks()` sigue tomando todas las
  filas de barrido y puede caer en heurísticas por fuente, texto o columnas de
  contacto, aunque Modelo haya seleccionado cero o solo algunos actores.
- Contrato congelado: para familia `acreditacion`, primero se delimita todo el
  dataset telefónico por la llave estable `unit$actor`; recién dentro de ese
  conjunto se calculan barrido, población, respuestas, conciliación, cuotas y
  alertas. `label` nunca participa en el cruce. Cero seleccionados produce los
  bloques factuales vacíos; 1 y N producen la unión exacta sin filas de actores
  deshabilitados.
- La identificación de una fila puede leer sus campos explícitos de actor y la
  metadata de fuente ya asignada, pero jamás decide participación: esa decisión
  proviene solo de Modelo. Una fila sin actor vinculable no entra por tener
  teléfono, barrido o texto telefónico.
- El producto Telefónico autónomo (`family=telefonico`) conserva su semántica
  actual y no queda restringido por este subshape de Acreditación.
- Archivos previstos: `api/R/monitoreo_telefonico.R`; solo si el filtro debe
  abarcar alertas/callers, el call site mínimo en `monitoreo_engine.R`; nueva
  regresión backend aislada y este registro.
- Exclusiones: endpoint de Modelo ya cerrado, persistencia, TypeScript/UI
  (Iter67), CSS, fixtures `.pulso`, inferencias de participación legacy,
  topbar/sidebar y entregables.
- Riesgo: filtrar solo el barrido y dejar respuestas/alertas globales generaría
  fugas cruzadas; usar `label` haría que un renombre altere resultados; aplicar
  el filtro a `family=telefonico` rompería el producto autónomo.
- Gate mínimo: roja/verde 0/1/N, renombre de label, fila deshabilitada con
  teléfono/barrido, actor sin vínculo y no-op Telefónico; engine/performance,
  parse y `diff --check`.
- Stopping rule: ninguna métrica, fila, cuota, conciliación ni alerta de un
  actor no seleccionado aparece en Teléfono de Acreditación; cero es vacío útil
  y el modo Telefónico conserva literalmente sus totales previos.

#### Resultado medido — iteración 66

- Roja independiente: con cero seleccionados el reporte global devolvía total
  5, tres estados, siete filas de cuota y cuatro alertas; con solo Egresados
  devolvía total 5 en lugar de 2 y filtraba también Docentes y filas sin actor.
  Responsables y alertas contenían `D1`/`X1`.
- Reparación: `.monitoreo_report_phone_scope_data()` normaliza una llave solo
  cuando el actor explícito no está vacío, toma la selección exclusivamente de
  `unit$actor + phone.enabled` y admite metadata operacional inequívoca por
  fuente/colector. El dataset se recorta antes de cualquier heurística y antes
  de barrido, población, respuestas, reconciliación, cuotas o tiempos.
- En `phone_summary`, Acreditación reconstruye hoja Teléfono y Alertas con el
  scope actual en vez de reutilizar una hoja global cacheada. Cero actores crea
  bloques telefónicos factuales en cero y Alertas sin filas sintéticas. La
  familia `telefonico` conserva el cache y no aplica este filtro.
- El payload de Acreditación también vacía `internal_queries`: la UI las usa
  como fallback de estados/responsables cuando un bloque está vacío, por lo que
  propagar consultas globales habría reintroducido actores excluidos después
  del filtro. El producto `telefonico` conserva literalmente sus consultas
  cacheadas.
- El edge `actor=Campo` no confunde una fila vacía con la normalización
  histórica `.monitoreo_safe_name("") == "campo"`; el vacío se preserva antes
  de normalizar.
- Cuatro fixtures de motor que probaban telefonía de Acreditación quedaron
  alineados al ADR declarando participación explícita. En dos fixtures
  segmentados se usa `.source_actor=Egresados`, no `dim_actor`, para no cambiar
  la unidad analítica Civil ni contaminar cuotas generales. No cambiaron sus
  aserciones.
- Verde: regresión 27/27, endpoints telefónicos 39/39, engine completo sin
  fallos (un warning ambiental del caché cartográfico), performance 100/100,
  parse y `git diff --check` verdes.

La cobertura incluye 0/1/N, renombre de `label`, actor deshabilitado, fila sin
actor con apariencia telefónica, cuotas, conciliación, responsables, tiempos,
alertas, descarte de `internal_queries` globales y el no-op Telefónico con units
ausentes o deshabilitadas. Stopping rule satisfecho; falta gate independiente.

#### Gate independiente — iteración 66

`APROBADO`: focal 27/27, endpoints telefónicos 39/39, modelo de unidades
39/39, motor completo sin fallos, performance 100/100, parse 2/2 y
`diff --check` verde. Confirmó 0/1/N, renombre de `label`, exclusión de
Docentes/D1/X1/Luis/Fantasma, edge Campo/vacío y reconstrucción de hojas y
Alertas para no reutilizar cache global. El hotfix final descarta además
`internal_queries` en Acreditación y conserva literalmente ese cache en
`family=telefonico`. Los cuatro fixtures no cambiaron aserciones; Civil sigue
siendo la unidad analítica mediante `.source_actor`. Único warning: permiso
denegado al caché cartográfico externo. Riesgo deliberado: filas sin actor
explícito ni metadata operacional inequívoca quedan fuera.

### Scope lock — iteración 67 / Modelo editable y estado telefónico explícito

- Módulo: frontend de Monitoreo Acreditación, Modelo > Modelo operativo y las
  seis pestañas de Teléfono; tercera unidad del requisito Modelo → Teléfono.
- Fuente de verdad: ADR 0045, endpoint dedicado cerrado en Iter65 y reportes
  filtrados cerrados en Iter66.
- Falla literal: `MonitoreoProfile.units` sigue tipado como records genéricos;
  Modelo reconstruye tarjetas desde reportes/metas/fuentes, no permite definir
  actores ni su nombre y Teléfono no explica el estado válido de cero actores.
- Contrato de datos UI: `MonitoreoModelUnit` expone `id/type/actor/label/phone`;
  el API POST reemplaza la lista completa. `id` y `actor` no son editables tras
  crear; `label` y `phone.enabled` sí. Añadir crea ambos a partir del nombre
  inicial con ID slug único; eliminar quita la unidad de la lista pendiente.
- Modelo muestra primero un registro compacto de actores con nombre visible,
  llave estable solo como información secundaria y control claro “Participa
  en Teléfono”. Cero activados se describe como una decisión válida, no como
  error ni como inferencia pendiente.
- Las tarjetas de actor usan exclusivamente las units persistidas como marco:
  una unit sin filas conserva tarjeta de alto idéntico con ceros/estado interno;
  un actor presente en reportes pero no adoptado aparece solo como candidato,
  nunca como tarjeta autoritativa. `label` se renderiza, pero metas, mecanismos
  y cruces siguen usando `actor`.
- Teléfono Acreditación recibe la selección actual. Si cero actores están
  activos, todas sus pestañas muestran un único estado vacío útil que invita a
  configurarlo en Modelo; no reconstruyen estados/responsables desde datos.
  El producto Telefónico autónomo no cambia.
- Archivos previstos: tipos y función API en `frontend/src/api/monitoreo.ts`;
  UI/ayudantes en `AcreditacionMonitoreoPage.tsx`; CSS de perfil; pruebas API,
  estado/modelo y este registro.
- Exclusiones: backend/ADR/schema ya cerrados, topbar/sidebar, fuentes,
  cronograma/metas, modo Telefónico autónomo, cambios de copy extensos y
  limpieza cosmética vertical posterior.
- Riesgo: mostrar `label` como llave puede romper metas; aplicar el state full
  del endpoint como cache del scope activo puede dejar Phone stale; adoptar
  candidatos implícitamente violaría cero válido. Deben preservarse identidad,
  invalidación de scopes y decisión explícita.
- Gate mínimo: roja/verde API; helpers 0/pocos/muchos, rename/toggle/add/remove,
  cards sin reportes, candidato no adoptado y empty state en las seis pestañas;
  typecheck, pruebas Monitoreo y QA visual Modelo/Teléfono en 1440×1000 y
  1024×600 con todos los tabs y scroll.
- Stopping rule: el usuario puede crear, nombrar, renombrar, quitar y marcar
  0..N actores telefónicos desde Modelo; guardar conserva `id/actor`, actualiza
  estado y cache; tarjetas mantienen marcos iguales y Teléfono nunca muestra
  actores no seleccionados ni confunde cero con error.

### Scope lock — iteración 68 / Fuentes conserva ownership de actores y canales

- Módulo: Monitoreo Acreditación, contrato Fuentes → Modelo → Teléfono.
- Fuente de verdad: ADR 0045 corregido con la evidencia literal de
  `ACRDCONTA.pulso`: perfil sin `schema_version`, `units` vacío, cuatro actores
  en `sources[*].dimensions$actor` y canal `Telefonico` para Egresados.
- Falla literal: Iter67 interpretó todo `units=[]` como decisión explícita de
  cero actores. En ACRDCONTA Modelo quedó vacío y Teléfono perdió Egresados,
  aunque Fuentes seguía mostrando Estudiantes, Egresados, Administrativos y
  Docentes y su declaración actor-canal.
- Corrección del usuario: Fuentes ya define actores, nombres y canales; Modelo
  no debe duplicar CRUD ni convertirse en otra autoridad. La lectura deriva y
  deduplica el roster desde `sources[*].dimensions$actor`; Teléfono incluye al
  actor si una fuente activa declara `dimensions$canal=Telefonico`. `units`
  vacío o distinto no borra ni renombra ese roster. Ninguna heurística por
  teléfono, texto libre o mera existencia de barrido decide participación.
- Responsabilidad de Modelo: consumir actores en solo lectura y configurar
  estrategia por actor —objetivo barrido/mínimo, meta, porcentaje, prioridad,
  reglas operativas y calendario— manteniendo tarjetas de igual altura.
- Archivos previstos: normalización R, regresiones backend, solo el fallback
  frontend mínimo si el payload no contiene todavía la migración, ADR 0045 y
  este registro.
- Exclusiones: modificación de proyectos `.pulso`, fuentes originales,
  topbar/sidebar, sincronización remota, metas, entregables y pulido cosmético
  ajeno a esta regresión.
- Riesgo principal: conservar el CRUD nuevo permitiría contradicciones entre
  secciones; filtrar Teléfono por `units` rompería ACRDCONTA aunque Fuentes siga
  mostrando correctamente su matriz actor–canal.
- Gate mínimo: cuatro actores y solo Egresados telefónico desde Fuentes incluso
  con `units=[]`; canales no telefónicos fuera; Modelo sin agregar/renombrar/
  quitar/toggle; Teléfono autónomo no cambia; focales R/frontend, typecheck y
  QA visual sobre una copia de referencia ACRDCONTA.
- Stopping rule: ACRDCONTA muestra los cuatro actores en Modelo y solo
  Egresados en Teléfono, el editor de actores existe únicamente en Fuentes y
  Modelo conserva una tarea operacional clara sin modificar el `.pulso` al
  abrir.

#### Resultado medido — iteración 68

- El original
  `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`
  no se modificó: `mtime 2026-07-25 19:42:48 -0500`, tamaño `269798` y SHA-256
  `b1b27e2c77db51c3b3bab8f2f3bbe8851e0cf9d853b1ef4ca89ea3e6d6da0e34`.
  Todo el QA mutante/visual usó la copia descartable
  `outputs/reference-runs/acrconta-20260727-141849/acrconta.pulso`.
- Backend adjunta la declaración completa de Fuentes al snapshot, incluidos
  actores cuyas fuentes todavía no aportaron filas. Deriva y deduplica el
  roster desde `dimensions$actor`; reconoce teléfono solo cuando el canal
  normalizado es exactamente `Telefonico`. `profile.units` queda como overlay
  de estrategia para actores coincidentes y no decide identidad ni teléfono.
- La reconstrucción real de ACRDCONTA devolvió
  `Administrativos|Docentes|Egresados|Estudiantes`, un único actor telefónico
  `Egresados`, base telefónica `270` y scope telefónico de `742` filas, sin
  inferencia por etiqueta, números, barrido o collector config.
- Frontend eliminó el CRUD, alta/baja, renombre y toggle telefónico de Modelo.
  Modelo presenta “Actores definidos en Fuentes” en solo lectura y conserva su
  trabajo propio: metas, objetivo barrido/mínimo, mecanismos y cronograma. El
  estado vacío de las seis pestañas telefónicas remite a Fuentes. El modo
  Telefónico autónomo no cambió.
- Geometría: cuatro tarjetas de actor de `304px` y roster con filas de `46px`;
  el gate `equal` midió ambos grupos sin drift. En 1440×1000 y 1024×600 Modelo
  quedó `ok=true`, sin overflow, scroll jail, issue geométrico ni miss de
  cobertura. En compacto los cuatro actores siguen visibles y Egresados
  conserva la marca Telefónico.
- Recorrido real de Teléfono: Resumen, Día, Incidencias, Responsables, Alertas
  y Supervisión quedaron `ok=true` individualmente a 1440×1000; Resumen también
  a 1024×600. Todos tuvieron cero overflow, scroll jail, errores de página/API,
  recursos o espera. Incidencias, la vista larga, expuso un owner real
  `.mon-phone-panel` de `709px` para `3661px` de contenido y fue inspeccionada
  arriba, en el medio y al final (`scrollTop=2952`), incluida la tabla final.
- Regresiones: Modelo backend `49/49`, selección Teléfono `33/33`, engine
  completo `1696/1696`; frontend focal/vecino `153/153`, suite completa
  `251` archivos y `1865/1865`; `pnpm --dir frontend typecheck` y
  `git diff --check` verdes.
- El primer gate independiente rechazó correctamente la iteración: una fuente
  con `enabled=false` todavía podía aportar actor y canal telefónico desde sus
  dimensiones materializadas. Se añadió una regresión causal que falla con
  ese caso y se corrigieron tanto el recorrido del catálogo como el mapeo de
  filas por `.source_id`: una fuente inactiva ya no crea actores ni habilita
  Teléfono, aunque sus columnas actor/canal permanezcan en el snapshot.
- Después de la corrección, las focales quedaron `49/49` y `33/33`, el motor
  completo `1696/1696` y `git diff --check` verde. El único warning del motor
  corresponde al intento bloqueado de escribir el caché cartográfico global
  en el entorno restringido; no produjo fallos.

Stopping rule funcional satisfecha; se repite el gate independiente serial
sobre el defecto causal antes de abrir la siguiente unidad cosmética.

#### Gate independiente serial — iteración 68

- Veredicto final: **APROBADO** después del rechazo y la reparación causal.
- Reproducción literal: `model_actors=Administrativos`, ningún actor
  telefónico, `declared_rows=Administrativos|` y `scoped_rows=0` cuando la
  fuente Egresados/Telefonico está desactivada pero conserva dimensiones
  materializadas.
- Evidencia repetida por el verificador: backend `49/49`, `33/33` y
  `1696/1696`; frontend `251` archivos y `1865/1865`; typecheck y diff-check
  verdes. Los nueve reportes visuales hidratados válidos quedaron `ok=true`;
  el intento sobre “Preparando Monitoreo” permanece explícitamente excluido.
- Integridad de ACRDCONTA confirmada con el mismo mtime, tamaño y SHA-256. No
  quedan pendientes funcionales de esta iteración.

Iteración 68 cerrada. El objetivo general continúa con la siguiente unidad de
pulido cosmético de Monitoreo.

### Scope lock — iteración 69 / capacidad útil del resumen telefónico

- Módulo: Monitoreo Acreditación, Teléfono > Resumen; composición vertical de
  “Barra de barrido”, “Estados telefónicos” y “Cuotas telefónicas”.
- Fuente de verdad: principio documentado de capacidad interior gobernada. La
  pareja superior conserva marcos iguales aunque uno tenga menos contenido;
  el panel inferior puede ocupar el remanente, pero no debe desmontar todo el
  contenido capaz de usarlo.
- Falla literal: en 1440×1000 CSS reserva toda la segunda fila con
  `minmax(max-content, 1fr)` y estira Cuotas al 100%, mientras React inicia su
  detalle colapsado. El marco ocupa aproximadamente 300px y la información
  termina cerca de sus primeros 85px. Además, la pareja superior sí iguala sus
  marcos, pero “Barra de barrido” usa `align-content:start`: sus cuatro métricas
  quedan comprimidas en una franja y dejan libre casi todo el alto que “Estados
  telefónicos” usa correctamente. En 1024×600 la fila flexible no aplica, el
  workbench se apila y el único scroll owner ya alcanza el contenido final.
- Cambio previsto: conservar el marco estable y la igualdad superior; en
  escritorio distribuir las cuatro métricas de Barrido como matriz 2×2 que usa
  el alto disponible y mantiene tarjetas de escala comparable a los estados.
  Abrir inicialmente el detalle de cuotas solo cuando el viewport sea ancho y
  alto, manteniéndolo colapsado en compacto y respetando el toggle posterior.
- Archivos previstos: `AcreditacionMonitoreoPage.tsx`, prueba de layout/estado
  vecina y este registro. CSS solo si la medición real muestra que el contenido
  expandido todavía no usa la capacidad; no se cambia por anticipado.
- Exclusiones: topbar/sidebar, Fuentes, Modelo, backend, contrato actor-canal,
  reportes, modo Teléfono autónomo, proyectos `.pulso`, contenido inventado y
  nuevos dueños de scroll.
- Riesgo principal: abrir el detalle también en compacto podría aumentar la
  presión vertical; reaccionar continuamente a `resize` podría deshacer una
  elección manual. La decisión inicial debe ser segura sin sobrescribir el
  toggle del usuario.
- Gate mínimo: rojo/verde para 1440×1000 expandido y 1024×600 colapsado; toggle
  accesible; pareja superior con delta ≤2px y Barrido 2×2 sin remanente muerto;
  typecheck y pruebas vecinas; QA real en ambos viewports con cero overflow/
  scroll jail, contenido final alcanzable y medición del vacío interno inferior
  del panel de cuotas.
- Stopping rule: escritorio usa el remanente con datos reales de cuotas y
  Barrido distribuye sus métricas en todo el marco; compacto conserva densidad
  y un único scroll gobernado; la pareja superior sigue midiendo igual y no se
  añadió información artificial.

#### Resultado medido — iteración 69

- La regresión independiente comenzó roja: faltaban el helper de expansión
  inicial, las anotaciones del par/capacidad y la distribución interna de
  Barrido. La primera medición real añadió otra divergencia: el contrato `equal`
  encontró anchos `727.47px` y `596.53px` (`Δ=130.94px`). Se corrigió el grid de
  escritorio a dos columnas iguales y el contrato geométrico se limita al modo
  ancho; el compacto apilado no se compara artificialmente.
- En 1440×1000, el detalle de Cuotas inicia abierto con sus tres categorías
  reales. Barra de barrido usa una matriz 2×2 de métricas dentro de su marco.
  Barra y Estados miden ambos `662×310.28px`: `widthDelta=0`, `heightDelta=0`
  y `unusedInteriorBottom=1px` en los dos miembros. El reporte
  `/tmp/iter69-phone-summary-1440-loaded/report.json` quedó `ok=true`, con dos
  grupos medidos y cero issues, misses, overflow, scroll jail o errores.
- En 1024×600, Cuotas inicia colapsado y el workbench conserva su composición
  apilada. `/tmp/iter69-phone-summary-1024-loaded/report.json` quedó `ok=true`
  sin issues ni errores. Un segundo recorrido hizo click en “Ver detalle”,
  esperó `.mon-phone-quota-detail` y cambió correctamente a “Ocultar detalle”;
  `/tmp/iter69-phone-summary-1024-expanded/report.json` también quedó verde,
  sin dueño de scroll adicional ni contenido inaccesible detectado.
- Se descarta explícitamente la primera corrida combinada: capturó 1440 antes
  de igualar columnas y 1024 en BootGate sin proyecto cargado. No se usa como
  evidencia de aceptación.
- Pruebas: layout `15/15`, comportamiento vecino `58/58`, suite frontend
  completa `251` archivos y `1871/1871`; typecheck y diff-check verdes.

Stopping rule funcional satisfecha. Falta el gate independiente serial antes
de abrir la siguiente unidad cosmética del objetivo general.

#### Gate independiente serial — iteración 70 y cierre de sesión

- Primer veredicto: **RECHAZADO**. La geometría Acreditación era correcta, pero
  los overrides Iter69/70 aún partían de `.mon-profile-canonical-shell` y podían
  alcanzar al perfil Telefónico autónomo. Además, se había eliminado su estilo
  vacío global transparente, violando una exclusión explícita del scope.
- Reparación causal: Acreditación declara la raíz
  `.mon-profile-canonical-shell.is-acreditacion-profile`; todos los overrides
  amplios de overview/storage/cuotas requieren esa raíz. Se restauró el vacío
  global con `padding:0`, fondo transparente, borde 0 y sin sombra; solo
  Acreditación vuelve a dibujar un marco visible mediante override específico.
- Veredicto final: **APROBADO**. Evidencia repetida: layout Acreditación `19/19`,
  página `58/58`, Telefónico autónomo `21/21`, typecheck, suite completa `251`
  archivos/`1875` pruebas y diff-check verde. El verificador confirmó que los
  perfiles ya no comparten los nuevos selectores expansivos y que la geometría
  visual Acreditación previamente medida sigue aplicando.
- No quedan pendientes funcionales dentro de Iter70. El usuario pidió cerrar
  lo pendiente y finalizar esta sesión; no se abre una nueva iteración.

Sesión cerrada por instrucción explícita del usuario. El objetivo continuo de
pulido cosmético queda finalizado en este punto, sin commits ni publicación.

#### Gate independiente serial — iteración 69

- Veredicto: **APROBADO**.
- El verificador repitió layout `15/15`, comportamiento `58/58`, typecheck,
  frontend completo `251` archivos/`1871` pruebas y diff-check dirigido.
- Confirmó escritorio `662×310.28px` para ambos miembros, deltas `0/0`, matriz
  2×2 y `unusedInteriorBottom=1px`; Cuotas abierta con tres categorías reales.
- Confirmó compacto inicialmente colapsado y el recorrido posterior al click
  con `.mon-phone-quota-detail` montado, “Ocultar detalle” visible y cero
  overflow, jails, misses o errores. El modo Telefónico autónomo no cambió.
- No quedan pendientes funcionales de Iter69. La corrida temprana inválida
  permanece excluida de la aceptación.

Iteración 69 cerrada. El objetivo general continúa con la siguiente unidad de
pulido cosmético de Monitoreo.

### Scope lock — iteración 70 / capacidad gobernada dentro de Cuotas

- Módulo: Monitoreo Acreditación, Teléfono > Resumen, panel “Cuotas
  telefónicas” expandido y su estado sin variables.
- Fuente de verdad: una reserva vertical puede existir, pero debe pertenecer a
  contenedores informativos visibles. El panel exterior no puede conservar una
  franja anónima mientras sus tarjetas terminan mucho antes.
- Falla literal: en 1440×1000 Cuotas mide aproximadamente `372px` y su último
  contenido termina unos `134px` antes del borde. `height:100%` conserva el
  marco, pero `align-content:start` acumula todo el remanente al pie. El QA lo
  exime porque el panel completo declara `data-qa-geometry-capacity=owned`, sin
  medir qué elemento interno posee realmente esa capacidad. Con cero filas,
  `.is-empty` además elimina borde y fondo, volviendo invisible el contenedor.
- Cambio previsto: conservar la fila flexible y el alto total; cuando el
  detalle está abierto, asignar la tercera pista al detalle y su grid, estirar
  tarjetas de variable pares y mantener cada fila de cuota en alto intrínseco.
  Mover la declaración de capacidad desde el panel exterior a tarjetas/estado
  vacío visibles. El estado vacío conserva marco, borde y fondo.
- Archivos previstos: `AcreditacionMonitoreoPage.tsx`, `profilePage.css`, prueba
  de layout/capacidad vecina y este registro.
- Exclusiones: harness global, topbar/sidebar, Fuentes, Modelo, backend,
  proyectos `.pulso`, modo Telefónico autónomo, nuevas métricas, scroll interno
  y cambios del contrato actor-canal.
- Riesgo principal: estirar la fila de datos en lugar de su tarjeta produciría
  controles gigantes; forzar altura en compacto crearía presión vertical. Las
  reglas de reparto se limitan a escritorio y al estado expandido.
- Gate mínimo: rojo/verde para pistas expandidas, capacidad en tarjetas y marco
  vacío visible; compacto sin altura forzada; focales, typecheck y suite vecina;
  QA ACRDCONTA 1440×1000 con remanente exterior del panel ≤10px, tres tarjetas
  pares y filas intrínsecas; 1024×600 con un único owner y final alcanzable.
- Stopping rule: el panel conserva su capacidad total, no queda una franja sin
  dueño al pie, las tarjetas repetidas poseen el remanente de forma explícita,
  el estado cero sigue siendo visible y no aparece scroll anidado.

#### Resultado medido — iteración 70

- La regresión comenzó roja con tres fallos: el panel exterior seguía marcado
  como dueño de toda la capacidad, no existían pistas internas expandidas y el
  estado vacío eliminaba borde, fondo, sombra y padding. Tras la corrección, el
  focal de layout quedó `17/17`; el test vecino de página `58/58`.
- El panel exterior conserva su fila flexible, pero en escritorio expandido el
  detalle y el grid reciben `minmax(0,1fr)`. La capacidad `owned` pasó a las
  tarjetas de variable y al contenedor visible del estado vacío. Las filas de
  cuota permanecen intrínsecas; no se añadió overflow ni scroll interno.
- QA real ACRDCONTA 1440×1000:
  `/tmp/iter70-quota-geometry-loaded/report.json` quedó `ok=true`, tres grupos,
  cero issues/misses/overflow/jails/errores. Actor, Carrera y Segmento miden
  cada uno `434×239.58px`, con `widthDelta=0`, `heightDelta=0` y
  `exteriorGapBottom=0`. Sus `123.58px` libres quedan dentro de cada tarjeta
  visible y declarada como capacidad poseída, no en una franja anónima.
- QA compacto 1024×600 después de “Ver detalle”:
  `/tmp/iter70-quota-1024-expanded/report.json` quedó `ok=true`, sin errores,
  overflow, scroll jail ni miss de espera; el reparto de escritorio no se
  filtró al layout apilado.
- Suite completa frontend: `251` archivos y `1873/1873`; typecheck y diff-check
  dirigidos verdes.

Stopping rule funcional satisfecha. Falta el gate independiente serial antes
de abrir la siguiente unidad cosmética del objetivo general.

### Scope lock — iteración 71 / deriva nueva de color en CSS

- Módulo: Monitoreo, únicamente las declaraciones de color añadidas por el
  trabajo visual pendiente en el CSS compartido y los perfiles Acreditación,
  Telefónico y Territorial.
- Fuente de verdad: `--pulso-*` y los custom properties semánticos ya
  existentes. El acento del módulo conserva identidad; advertencia,
  información y no efectividad conservan sus roles operativos.
- Falla literal: el diff introduce 18 usos nuevos de `#hex` o `rgba(...)` en
  cuatro hojas de Monitoreo, aunque todos corresponden a superficie, texto,
  sombra, información, advertencia o un color de estado ya gobernado.
- Dirección visual: no cambia la composición, la jerarquía ni el contraste
  intencional. Se reemplazan literales por `var(--pulso-*)`, custom properties
  existentes o `color-mix(..., transparent)` derivado del token adecuado.
- Contrato de geometría y capacidad: ningún selector, pista, alto, ancho,
  padding, gap, overflow o cardinalidad `0/1/pocos/muchos` cambia. Los grupos
  pares y sus dueños de capacidad conservan las mediciones aprobadas en las
  iteraciones 69–70.
- Archivos previstos: `monitoreo.css`, `profiles/profilePage.css`,
  `profiles/telefonico/telefonicoProfile.css`,
  `profiles/territorial/territorialProfile.css`, este registro y los artefactos
  derivados del catálogo visual regenerados por su script canónico.
- Exclusiones: React/TSX, backend, `theme.css`, nuevos tokens, topbar/sidebar,
  proyectos `.pulso`, contenido y comportamiento. No se corrige en esta unidad
  la deuda hex histórica fuera de las líneas nuevas del diff.
- Riesgo principal: cambiar un color de categoría por un acento de módulo o
  estado incorrecto. Cada sustitución debe mantener su rol semántico y no
  introducir fallbacks hexadecimales.
- Gate mínimo: el diff de Monitoreo queda con cero líneas añadidas que contengan
  `#hex` o `rgba(...)`; `git diff --check`, typecheck, catálogo visual `--check`
  y pruebas focales de layout Acreditación/Telefónico/Territorial permanecen
  verdes.
- Stopping rule: cero deriva nueva de color en el diff, catálogo sincronizado y
  ninguna modificación estructural o funcional fuera del ownership.

#### Resultado técnico y bloqueo visual — iteración 71

- Los 18 literales nuevos de color quedaron en cero. Blancos, transparencias,
  sombras, información, advertencia y no efectividad consumen tokens o custom
  properties semánticos existentes; no cambió ninguna regla geométrica.
- Typecheck, focales Acreditación/Telefónico/Territorial `117/117`, suite
  frontend `251` archivos y `1875/1875`, catálogo visual `24/24`, regeneración
  `--check` y diff-check quedaron verdes.
- El QA real no es evidencia de aceptación: con `acrconta` publicó
  `data-audit-ready="monitoreo-acreditacion"` mientras seguía en `ACTIVAS 0/0`,
  `REGISTROS 0`, `Kobo Pendiente` y “Resumen pendiente”. El grupo
  `acreditacion-phone-summary-top` no estaba montado. La captura se descarta.
- La reproducción aisló un defecto previo de navegación: la URL cambia de
  Fuentes a Teléfono sin ejecutar `loadView("telefonico")`; la respuesta
  `source` en vuelo se descarta y su `finally` todavía apaga `loading`.

La limpieza de tokens queda implementada, pero su gate visual permanece
bloqueado hasta reparar la hidratación de la sección activa.

### Scope lock — iteración 72 / readiness ligada al scope activo

- Módulo: Monitoreo Acreditación; navegación profunda o externa entre Fuentes,
  Modelo, Consultas, Teléfono y Avance, y marcador de readiness de la vista.
- Fuente de verdad: cada sección report-backed solo está lista cuando existe
  estado y sus reportes cubren el scope requerido (`source`,
  `advance_summary`, `queries_summary`, `phone_summary` o `full`). Cambiar una
  sección por URL y por click debe ejecutar la misma transición scopeada.
- Falla literal: `onSeccionPedida` solo llama `setActiveView`; el efecto inicial
  de carga es one-shot. Una respuesta vieja puede descartarse por sección y aun
  así ejecutar `setLoading(false)`, publicando readiness con `state=null`.
- Cambio previsto: unificar el handler de cambio de sección para actualizar la
  ref, el estado visible y llamar `loadView(view)`; hacer que el `finally` solo
  libere la petición que todavía corresponde a la vista activa; condicionar
  readiness a estado, error ausente y cobertura del scope seleccionado.
- Archivos previstos: `AcreditacionMonitoreoPage.tsx`,
  `telefonico/TelefonicoMonitoreoPage.tsx`,
  `MonitoringProfilesReadinessContract.test.ts` y este registro. La regresión
  roja confirmó que el perfil Telefónico autónomo comparte el mismo setter
  crudo, `finally` insuficiente y readiness basada solo en `loading`.
- Exclusiones: CSS, backend/API, `runtime.ts`, `ui-quick-check.mjs`,
  topbar/sidebar, proyectos `.pulso`, sincronización y mutaciones externas.
- Riesgo principal: disparar dos cargas por un mismo click o dejar readiness
  permanentemente bloqueado en una pestaña que no necesita reports. El handler
  debe ser idempotente y el contrato debe distinguir las excepciones reales.
- Gate mínimo: regresión roja/verde para `source` en vuelo →
  `telefonico/resumen`, cobertura `phone_summary|full`, ausencia de readiness
  con state/scope insuficiente; focales de perfiles/readiness, typecheck, suite
  frontend y QA `acrconta` grande/compacto con datos hidratados.
- Stopping rule: URL y click cargan el scope activo, ninguna petición obsoleta
  apaga su loading, readiness nunca aparece sobre contenido pendiente y el QA
  real alcanza la geometría de Teléfono sin BootGate falso positivo.

#### Resultado técnico — iteración 72

- La navegación por URL y por control visible comparte ahora una transición
  scopeada que actualiza la referencia activa y solicita exactamente una carga.
- Una respuesta obsoleta ya no puede apagar el `loading` de la sección nueva.
  Acreditación y Telefónico autónomo solo publican readiness cuando existe
  estado, no hay error y `report_scope` cubre la vista activa o es `full`.
- La regresión de contrato quedó `6/6`; focales vecinas `137/137`, suite
  frontend `251` archivos y `1879/1879`, typecheck, catálogo visual `24/24` y
  diff-check quedaron verdes.
- El backend recibió y completó `phone_summary` con `1,277` filas en la prueba
  real. El runner no generó captura: antes de consultar readiness espera
  `networkidle` hasta el timeout global, aunque los prefetch de otras secciones
  continúan en segundo plano. La corrección de producto queda probada; el gate
  visual pasa a la siguiente iteración como bloqueo de instrumentación.

### Scope lock — iteración 73 / runner gobernado por readiness

- Módulo: instrumento local `ui-quick-check`, únicamente su transición de
  ruta/pestaña, espera de readiness y selección de scope para prefetch.
- Fuente de verdad: `window.__pulsoNav.estadoListo()` y el marcador final de la
  vista destino. `networkidle` es una señal auxiliar y no puede consumir el
  timeout de una aplicación con peticiones largas en segundo plano.
- Falla literal: `irADireccion()` espera `networkidle` hasta `timeoutMs` antes
  de consultar readiness; la ruta inicial y los clicks no exigen readiness
  final; “Teléfono” cae al scope `source` en el prefetch.
- Cambio previsto: retirar la espera larga obsoleta, dar como máximo una pausa
  breve auxiliar, esperar el siguiente ciclo de render y exigir readiness tras
  la ruta inicial o cada transición. Mapear etiquetas telefónicas a
  `phone_summary`.
- Archivos previstos: `scripts/ui-quick-check.mjs`,
  `scripts/tests/ui-quick-check-readiness-contract.test.mjs` y este registro.
- Exclusiones: producto React/CSS, backend/API, runtime de navegación,
  topbar/sidebar, proyectos `.pulso`, warmup global y geometría del inspector.
- Riesgo principal: aceptar el marcador aún montado de la vista origen o, en el
  extremo contrario, bloquear rutas sin marcador. La espera debe ceder dos
  frames antes de leer el contrato y conservar el fallo explícito si la vista
  destino no alcanza readiness.
- Gate mínimo: regresión roja/verde del timeout y del scope telefónico, pruebas
  Node del runner y captura real ACRDCONTA Teléfono/Resumen en 1440×1000 y
  1024×600 con grupo geométrico presente.
- Stopping rule: el runner no queda secuestrado por `networkidle`, nunca captura
  antes de readiness destino, prefiere `phone_summary` para Teléfono y produce
  reporte/capturas reales o un error causal explícito dentro del timeout.

#### Resultado medido — iteración 73

- Se retiró `networkidle` de las transiciones canónicas y por click. El runner
  cede dos frames para que React desmonte el marcador anterior y después exige
  readiness final. La pausa inicial de recursos permanece acotada a cinco
  segundos y no gobierna la aceptación.
- “Teléfono”, “telefono” y “llamada” precargan `phone_summary`. La ruta inicial,
  cada click y el estado inmediatamente anterior a la captura fallan con
  contexto explícito si no alcanzan readiness.
- La primera integración dejó sin reportes a los fixtures HTML del inspector.
  Se reparó sin relajar la aplicación: el fallback a `[data-audit-ready]` solo
  existe cuando no hay `.pulso-shell`; una shell Prosecnur sin puente continúa
  esperando. Regresión final `7/7`; Playwright geométrico `5/5` en `5.98s`.
- QA real ACRDCONTA 1440×1000:
  `/tmp/iter73-visual-qa/out/acr-phone-1440/report.json` quedó `ok=true`, con
  readiness `monitoreo-acreditacion`, `13/13`, `1,277` registros, selector
  telefónico presente, dos grupos medidos, cero issues geométricos, misses,
  jails, overflow y errores. Los dos paneles superiores miden exactamente
  `662×310.28px`, `heightDelta=0` y `widthDelta=0`.
- QA real 1024×600:
  `/tmp/iter73-visual-qa/out/acr-phone-1024/report.json` quedó `ok=true`, con el
  mismo estado hidratado, selector telefónico presente, apilado intrínseco,
  cero issues/misses/jails/overflow/errores y contenido final alcanzable según
  el contrato del inspector.
- Los logs de ambas corridas registran la solicitud `phone_summary` con
  `rows=1277` y construcción en aproximadamente `6.8–7.0s`; los servidores se
  cerraron después de producir los artefactos. Original y copia conservaron el
  mismo SHA-256 `b1b27e2c…d6da0e34`.
- Se retiró el `telefonicoProfile.css` suelto de la raíz: no tenía importadores
  y sus reglas ya estaban integradas en la hoja canónica del perfil. La carpeta
  documental `Obsidian_Prosecnur/` se preserva hasta una decisión explícita.

Stopping rule satisfecha. La instrumentación vuelve a ser utilizable para
fixtures aislados y para la aplicación real, sin conservar la espera obsoleta.
