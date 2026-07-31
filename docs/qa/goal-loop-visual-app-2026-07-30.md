# GOAL — La app entera se ve como una sola aplicación

Tipo: Goal operativo QA
Estado: En curso
Fecha: 2026-07-30
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado visual

**Fecha de apertura:** 30 de julio de 2026
**Estado:** objetivo permanente en curso. **Solo Gonzalo lo cierra.**
**Antecedente:** `docs/qa/monitoreo/goal-loop-monitoreo-2026-07-27.md` (Monitoreo,
geometría gobernada) y `docs/qa/pulido-monitoreo-estado.md` (16 hallazgos abiertos).
Este goal **no reemplaza** al de Monitoreo: lo absorbe y lo extiende a los ocho
módulos del proyecto y a Enciclopedia como utilidad global.

## Objetivo

> Prosecnur debe verse como **una sola aplicación profesional en los ocho
> módulos del proyecto**, no como un módulo pulido y siete sin auditar. El
> instrumento de medición ya existe y ha visto uno de ocho; este goal lo pone en
> órbita sobre todos y revisa Enciclopedia como utilidad global.
>
> Y arreglar la app **no puede seguir agrandando la app**: cada reparación deja
> su archivo más chico que como lo encontró.

## Por qué este goal

Medición del 2026-07-30:

| Hecho medido | Consecuencia |
|---|---|
| El audit del agentic OS está **en rojo**: 3 congelados crecieron esta semana (+6, +104, +136) | El pulido está pagándose con deuda estructural |
| 4.117 hex sin token en CSS de features; **1.081 fuera de Monitoreo** | Siete módulos y la utilidad global con deriva de color jamás medida |
| Gráficos, sección de Procesamiento (33.023 líneas CSS), Dashboard y Hojas de ruta: **0** `data-qa-geometry-group` | Verdes por ausencia, no por conformidad |
| 44 declaraciones de geometría en total, **17 son de Monitoreo** | El resto es cobertura simbólica |
| 16 hallazgos abiertos en Monitoreo, **7 bloqueados en decisión** | El loop anterior se frenaba esperando respuesta |
| Eje "Evolución modular" del corte de escalabilidad | **Rojo** |

## Invariante

**Ninguna iteración termina con el audit en rojo, y cada iteración deja al menos
un número del ledger estrictamente más bajo.** Igualar no cierra la iteración.

## Órbita

El loop rota por los ocho módulos del proyecto en orden fijo. Ningún módulo se
salta, ninguno monopoliza. Monitoreo es **una** posición de ocho, no la mitad
del trabajo. Enciclopedia se inspecciona como utilidad global al cerrar cada
vuelta, sin convertirla en un noveno módulo.

```
Monitoreo → Procesamiento → Dashboard → Hojas de ruta
   → Cálculo de muestra → Formularios → Bitácora → Recopiladores
   → Enciclopedia (utilidad global) → (vuelve)
```

Al llegar a un módulo, el loop hace **auditar → reparar** en la misma visita:

1. **Auditar (medido, no leído).** `ui-quick-check` con `--ir` sobre las
   direcciones canónicas del módulo, matriz de viewports, `--require-geometry`
   y `--fail-on-issues`. Los hallazgos se anotan con `archivo:línea` y proyecto
   de referencia. **Esto es lo que hace que el loop nunca se quede sin trabajo:**
   auditar produce combustible, reparar lo consume.
2. **Reparar** el defecto de mayor radio, de raíz y no el síntoma.
3. **Pagar el peaje estructural.** El tema tocado sale del monolito a archivo
   propio. Si el arreglo exige tocar un congelado, se extrae primero.
4. **Dejar guard.** Lo reparado se declara (`data-qa-geometry-group`,
   token, contrato) para que la violación vuelva a fallar sola.
5. **Gate escalado al diff** y commit atómico.

## Regla de no-bloqueo

**El loop nunca se detiene esperando una decisión.** Si un hallazgo exige criterio
de dominio o estructura, se anota en la bandeja de abajo con opciones y
recomendación, y el loop **pasa al siguiente hallazgo o al siguiente módulo de la
órbita**. Máximo una decisión nueva presentada por iteración; si la bandeja pasa
de tres, el loop las presenta juntas y sigue trabajando en lo desbloqueado.

## Ledger

| Métrica | Apertura (30 jul) | Hoy | Dirección |
|---|---:|---:|---|
| Audit del agentic OS | rojo (3) | **verde** | verde, siempre |
| Hex sin token — Monitoreo | 3.036 | 3.036 | ↓ |
| Hex sin token — otros 7 módulos + Enciclopedia | 1.081 | 1.081 | ↓ |
| `data-qa-geometry-group` fuera de Monitoreo | 27 | **35** | ↑ hasta cubrir toda colección |
| Superficies principales con 0 declaraciones geométricas | 3 | **0** | ↓ a 0 |
| Secciones con 0 declaraciones geométricas | 5 | **3** | ↓ a 0 |
| Rutas en la matriz por defecto del instrumento | 4 | **5** | = las secciones que existan |
| Defectos C4 abiertos (contenido inalcanzable) | — | **0 en Procesamiento** | ↓ |
| Tokens `--pulso-*` usados sin definir | 29 | 29 | ↓ a 0 |
| `monitoreo_engine.R` | 39.981 | **38.662** | ↓ |
| `router_monitoreo.R` | 6.150 | **5.116** | ↓ |
| `TelefonicoMonitoreoPage.tsx` | 20.622 | **20.320** | ↓ |
| `AcreditacionMonitoreoPage.tsx` | 18.403 | 18.403 | ↓ |
| `monitoreo.css` | 38.160 | 38.160 | ↓ |
| Hallazgos abiertos (todos los módulos) | 16 | 18 | ↓ |
| Módulos auditados con el instrumento | 1 de 8 | **4 de 8** | ↑ a 8 |
| Utilidad global Enciclopedia auditada | no | no | sí |

## Hallazgos nuevos, medidos por el loop

| # | Módulo · superficie | Hallazgo | Estado |
|---|---|---|---|
| N1 | telefónico y acreditación | `phoneRowValue` está **definido cuatro veces** en el repo con el mismo cuerpo: en los dos page-files y en `TelefonicoPhoneDailyTrend.ts:198` y `AcreditacionPhoneDailyTrend.ts:198`. Cada perfil puede mantener el suyo —esa es la decisión de independencia— pero tener dos copias *dentro* del mismo perfil no la sirve | abierto |
| N2 | telefónico | El racimo `AcreditacionPhone*` de comparación teléfono↔plataforma (`TelefonicoMonitoreoPage.tsx:7117-7483`) tiene **35 dependencias hacia declaraciones del page-file**, la más lejana en la línea 15.016. Es la atadura medida que impide extraerlo: cualquier intento crea un ciclo de imports. Cortarla es su propia unidad de trabajo | abierto |
| N3 | Dashboard | **Ningún proyecto de referencia trae datos de dashboard**, así que `/tablero` rinde su compuerta de fuente y el estado cargado —el que monta los gráficos de plotly, ~10 MB de chunks— nunca se audita. La cobertura de Dashboard es de la compuerta, no del tablero. Cerrarlo exige o un proyecto de referencia con dashboard construido, o que el instrumento sepa pulsar «Cargar fuente» y esperar el render | abierto |

## Bandeja de decisiones

Cada entrada: qué se decide, opciones, recomendación, costo. Gonzalo responde con
una letra; el loop sigue solo mientras tanto.

| # | Módulo · superficie | Decisión | Estado |
|---|---|---|---|
| 1 | Telefónico · Llamadas › Sin efectiva | Denominador de las barras de insistencia (dan 130%). **A:** casos con ≥1 intento. **B:** conteo en vez de %. Recomiendo A | abierta |
| 2 | Territorial · Modelo › Manzanas | La fila del UMP expandido colapsa a 2 px. **A:** retirar la expansión inline (la Ficha UMP ya muestra el dato). **B:** rehacer el reparto de alto. Recomiendo A | abierta |
| 3 | Territorial · tablas | Ancho de columna en las tres tablas (83 datos recortados en Reporte UMP). Decisión única para las tres | abierta |
| 4 | Los cuatro modos · espaciado | Adoptar `--pulso-space-1..9` en el chrome compartido (`monitoreo.css`, `profilePage.css`) | abierta |
| 5 | Telefónico · Modelo › Cuotas | Cuál de las cuatro superficies es la de lectura y cuál la de edición | abierta |
| 6 | Telefónico · Consultas › CodPulso | Cuál de los dos nodos duplicados sobra | abierta |
| 7 | Territorial · autodetección | `sex_var` es la única de doce con fallback vacío: deja sexo sin mapear y sin avisar | abierta |

## Cuándo cierra

Solo Gonzalo. La condición **medible** es: audit verde, los ocho módulos
auditados con el instrumento, Enciclopedia inspeccionada como utilidad global,
cero módulos sin contrato geométrico, cero hallazgos abiertos y bandeja vacía.
Alcanzada esa condición el loop **no termina**: reabre la órbita con un nivel de
exigencia mayor (viewport más estrecho, estado vacío, estado a escala) y vuelve
a empezar.

## Bitácora de iteraciones

| # | Fecha | Módulo | Hallazgo | Números movidos | Commit |
|---|---|---|---|---|---|
| — | 30 jul | — | apertura del goal | — | — |
| 1 | 30 jul | Monitoreo | **El audit estaba en rojo: tres congelados crecieron durante la tanda de pulido.** No se subieron las líneas base: se pagó el peaje. Tres extracciones literales, sin tocar un cuerpo de función | engine -1.319 · router -930 · telefónico -166 · audit rojo→**verde** | `fbe7a791`, `712159f7`, `89145285` |
| 2 | 30 jul | **Procesamiento · Gráficos** | **La sección estaba fuera del instrumento, no solo sin declarar.** `/graficos` no figuraba en `PROCESSING_ROUTES`, así que la matriz por defecto nunca la miró: 33.023 líneas de CSS y cero geometría, sin que nada se quejara | geometryGroups 0→10 · coverageMisses 5→0 · superficies principales sin geometría 3→**2** · rutas de la matriz 4→5 | `f2dfb95a` |
| 3 | 30 jul | **Procesamiento** | **Primer defecto C4 del goal: Carga atrapaba 300 px en pantallas cortas.** Y las dos colecciones que el comprobador descubrió solas quedan declaradas | issues 1→**0** · geometryGroups 15→**60** · coverageMisses 45→**0** · secciones sin geometría 5→3 | `ccbb2f61`, `11cde117` |

| 4 | 30 jul | **Dashboard** | Tercera superficie principal con cero geometría. Las dos colecciones de la compuerta de fuente quedan declaradas `equal`. **Pero solo se auditó la compuerta**: ningún proyecto de referencia trae datos de dashboard | geometryGroups 0→**10** · coverageMisses 5→**0** · superficies sin geometría 2→**1** | `80f843e7` |

| 5 | 30 jul | **Hojas de ruta** | La última superficie principal con cero geometría. Declaradas la lista de distritos —que crece con el marco— y la banda de KPIs territoriales, **sin sumar una sola línea** al page-file congelado | geometryGroups 0→**10** · coverageMisses 5→**0** · superficies sin geometría 1→**0** | `53cf69a4` |

### Nota de la iteración 5

**Declarar geometría no puede costar volumen en un archivo congelado.**
`HojasRutaPage.tsx` está a 8.991 líneas y ahí se queda: los atributos
`data-qa-geometry-*` van en la misma línea del elemento, no en líneas propias.
Es la diferencia entre gobernar un monolito y engordarlo con su propio
gobierno. Vale para los cinco congelados de frontend que quedan.

**`equal` sobre una lista de datos es una afirmación fuerte, y aquí se
sostuvo.** Declararlo en la lista de distritos dice que el marco de una tarjeta
no puede moverse porque el nombre del distrito sea más largo. Comprobado en los
cinco viewports incluido 1024: «SAN JUAN DE LURIGANCHO» y «SAN MARTIN DE
PORRES» conviven con «ATE» sin desalinear la lista. Cuando el contrato pasa a la
primera sobre una colección real, lo que se gana no es un arreglo sino un guard:
de ahora en más, romperlo falla solo.

Con esto **las tres superficies principales que abrieron el goal en cero quedan
en cero**: Gráficos, Dashboard y Hojas de ruta. Lo que sigue no es cobertura de
superficie sino profundidad: secciones internas sin declarar, el estado cargado
de Dashboard (N3) y los 1.081 hex sin token fuera de Monitoreo, que el ledger
sigue registrando intactos.

### Nota de la iteración 4

**`equal` no es una promesa universal, es una promesa sobre los viewports que se
miden.** `.dash-source-grid` colapsa a una columna bajo 700 px, y ahí sus dos
paneles tendrían alturas distintas —correctamente, porque apilados ya no
comparten fila—. Declarar `equal` habría sido falso si la matriz bajara hasta
ese ancho; como baja hasta 1024, es exacto. **Antes de declarar `equal` en una
rejilla que colapsa, hay que mirar dónde está el breakpoint contra la matriz**,
y dejarlo escrito para que el siguiente no tenga que redescubrirlo.

**Lo que esta iteración NO cubrió, dicho con todas las letras.** `/tablero`
rinde su compuerta de fuente porque `acnur_acg` no trae dashboard construido. El
estado cargado —el que monta los gráficos de plotly— sigue sin auditar, y con él
la mayor parte de la superficie del módulo. Contar Dashboard como «auditado» en
el ledger sería exactamente el verde por ausencia que este goal persigue, así
que queda como hallazgo N3 y el módulo volverá a la órbita con esa deuda
explícita.

### Nota de la iteración 3

**La válvula de escape existía y estaba mal cableada.** El defecto de Carga no
era una pantalla corta sin contemplar: `@media (max-height: 700px)` estaba
escrita justo para eso. Lo que hacía era poner `overflow: visible` sobre el
elemento que *es* `.pulso-adaptive-main` —el dueño del scroll designado por la
gramática de layout—, así que la regla escrita para salvar la pantalla corta era
la que quitaba el scroll. Con `visible` el contenido se derrama y lo recorta un
ancestro; con el `hidden` de base se recorta ahí mismo. Ninguno de los dos
alcanza. **Cuando una válvula de escape existe y el defecto persiste, revisa qué
valor pone, no si está.**

Queda anotado, sin arreglar: el comentario de `is-plan` afirma que la capacidad
se absorbe «dentro de Cobertura», y **no hay ningún scroller interno en la
pestaña**. La intención está escrita pero no implementada. Mientras no lo esté,
el marco no puede ser el que atrape — que es lo que este fix garantiza.

**El comprobador descubre colecciones solo.** No hace falta adivinar qué
declarar: `geometry-undeclared` nombra el contenedor y su texto. Las 40
coberturas de Analítica eran una sola familia vista ocho veces —8 secciones, una
lista por sección—, así que una declaración cerró las cuarenta. Conviene contar
familias, no incidencias, antes de estimar el trabajo.

**Trampa de sintaxis, para no repetirla:** `{/* comentario */}` es válido entre
hijos JSX, pero **no** dentro de un `cond && ( … )`, donde se está en contexto de
expresión y va como `/* comentario */` a secas. Rompió el archivo y lo atrapó el
typecheck.

### Nota de la iteración 2

La órbita funcionó exactamente como se esperaba: apuntar el instrumento a una
sección de Procesamiento que nunca había visto encontró algo que ninguna
cantidad de pulido de Monitoreo habría encontrado.

Lo importante no fue que a Gráficos le faltaran declaraciones —eso ya estaba
medido al abrir el goal—, sino **por qué** le faltaban y nadie lo notó:
`/graficos` no estaba en el set de rutas de la matriz. Procesamiento tiene cinco
secciones y la lista tenía cuatro. **Estar fuera de la lista de rutas es la
forma silenciosa de quedar verde por ausencia**, y no la detecta ningún
comprobador de geometría, porque el comprobador nunca llega a correr. Conviene
revisar la misma pregunta en cada módulo y sección de la órbita antes de
auditarlo: ¿el instrumento los alcanza?

**Duodécima familia de falso positivo: decoración con lienzo declarado.** Se le
puso `intrinsic` al stack de previsualización y marcó `capacity-drift` en las
cinco capturas. No era deuda: son mockups de lámina con `min-height` y
`align-content: center`, y ese lienzo es lo que las hace parecer diapositivas.
La regla que faltaba: **un contrato geométrico gobierna superficies que deben
sostener su marco frente a sus DATOS.** Un elemento `aria-hidden` sin datos no
tiene marco que sostener, y declararlo produce un rojo que solo se puede saldar
rompiendo el dibujo. Se retiró la declaración con la razón escrita en el código,
no en un registro aparte.

### Nota de la iteración 1

Esta iteración **no** corrió el instrumento sobre ningún módulo: fue el
prerrequisito estructural. El invariante exige terminar con el audit en verde y
el audit estaba en rojo desde antes de abrir el goal, así que la primera vuelta
tenía que saldarlo. La órbita avanza a **Procesamiento · Gráficos** en la
iteración 2, que sí empieza por auditar.

Tres cosas que aprendió el loop y que valen para las próximas vueltas:

1. **El exit code de un comando en pipe no es el del comando.** `tsc | tail` sale
   0 aunque `tsc` falle. La primera lectura del typecheck se dio por verde y
   tenía 14 errores. Se mide con `cmd > archivo; echo $?`, nunca a través de un
   pipe.
2. **Insertar imports "después del último import" rompe los multilínea.** La
   heurística cortó por la mitad un `import {` de varias líneas. El final real
   de la sección de imports se halla contando llaves, no buscando la última
   línea que empieza por `import`.
3. **Otra sesión commiteó sobre el mismo árbol a mitad del gate** (HEAD pasó de
   `d3a3a9ee` a `105481e1`, con cambios en `branding/` y `scripts/` que no eran
   de este trabajo). Se stageó por ruta explícita, nunca `git add -A`.
