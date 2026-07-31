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
módulos del proyecto.

## Objetivo

> Prosecnur debe verse como **una sola aplicación profesional en los ocho
> módulos del proyecto**, no como un módulo pulido y siete sin auditar. El
> instrumento de medición ya existe y ha visto uno de ocho; este goal lo pone en
> órbita sobre todos.
>
> Y arreglar la app **no puede seguir agrandando la app**: cada reparación deja
> su archivo más chico que como lo encontró.

## Por qué este goal

Medición del 2026-07-30:

| Hecho medido | Consecuencia |
|---|---|
| El audit del agentic OS está **en rojo**: 3 congelados crecieron esta semana (+6, +104, +136) | El pulido está pagándose con deuda estructural |
| 4.117 hex sin token en CSS de features; **1.081 fuera de Monitoreo** | Siete módulos con deriva de color jamás medida |
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
del trabajo.

```
Monitoreo → Procesamiento → Dashboard → Hojas de ruta
   → Cálculo de muestra → Formularios → Bitácora → Recopiladores → (vuelve)
```

La novena posición era Enciclopedia, retirada de la app el 2026-07-31
([ADR 0051](../adrs/0051-retiro-de-enciclopedia.md)). La órbita queda en ocho.

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
| Hex sin token — otros 7 módulos | 1.081 | 1.081 | ↓ |
| `data-qa-geometry-group` fuera de Monitoreo | 27 | **38** | ↑ hasta cubrir toda colección |
| Superficies principales con 0 declaraciones geométricas | 3 | **0** | ↓ a 0 |
| Secciones con 0 declaraciones geométricas | 5 | **3** | ↓ a 0 |
| Rutas en la matriz por defecto del instrumento | 4 | **5** | = las secciones que existan |
| Defectos reparados por el loop (C4 · recorte · C3 · contexto) | — | **5** | ↓ |
| Píxeles de contenido recuperados | — | **~2.300** | ↓ |
| Tokens `--pulso-*` usados sin definir | 29 | 29 | ↓ a 0 |
| `monitoreo_engine.R` | 39.981 | **38.662** | ↓ |
| `router_monitoreo.R` | 6.150 | **5.116** | ↓ |
| `TelefonicoMonitoreoPage.tsx` | 20.622 | **20.320** | ↓ |
| `AcreditacionMonitoreoPage.tsx` | 18.403 | 18.403 | ↓ |
| `monitoreo.css` | 38.160 | 38.160 | ↓ |
| Hallazgos abiertos (todos los módulos) | 16 | 18 | ↓ |
| Módulos auditados con el instrumento | 1 de 8 | **8 de 8 — primera órbita completa** | ↑ a 8 |

## Hallazgos nuevos, medidos por el loop

| # | Módulo · superficie | Hallazgo | Estado |
|---|---|---|---|
| N1 | telefónico y acreditación | `phoneRowValue` está **definido cuatro veces** en el repo con el mismo cuerpo: en los dos page-files y en `TelefonicoPhoneDailyTrend.ts:198` y `AcreditacionPhoneDailyTrend.ts:198`. Cada perfil puede mantener el suyo —esa es la decisión de independencia— pero tener dos copias *dentro* del mismo perfil no la sirve | abierto |
| N2 | telefónico | El racimo `AcreditacionPhone*` de comparación teléfono↔plataforma (`TelefonicoMonitoreoPage.tsx:7117-7483`) tiene **35 dependencias hacia declaraciones del page-file**, la más lejana en la línea 15.016. Es la atadura medida que impide extraerlo: cualquier intento crea un ciclo de imports. Cortarla es su propia unidad de trabajo | abierto |
| N3 | Dashboard | **CERRADO** en la iteración 11 con `--sembrar "Cargar fuente"`: el tablero cargado entra a la matriz y ahí apareció el defecto de 2.017 px. Texto original: **Ningún proyecto de referencia trae datos de dashboard**, así que `/tablero` rinde su compuerta de fuente y el estado cargado —el que monta los gráficos de plotly, ~10 MB de chunks— nunca se audita. La cobertura de Dashboard es de la compuerta, no del tablero. Cerrarlo exige o un proyecto de referencia con dashboard construido, o que el instrumento sepa pulsar «Cargar fuente» y esperar el render | **cerrado** |
| N4 | Bitácora | **Ningún proyecto de referencia tiene entradas de bitácora** (los cuatro dan 0), así que el estado lleno del timeline no se puede verificar visualmente. Por eso la iteración 8 enmarcó solo la rama vacía y no tocó la poblada. Mismo patrón que N3 con Dashboard | abierto |
| N5 | Dashboard, Bitácora y Recopiladores | **Dashboard CERRADO** (iteración 11: `--sembrar` lo mete a la matriz cargado). Bitácora y Recopiladores siguen abiertos, y peor de lo anotado: ninguno de los cuatro fixtures trae el estado **aguas arriba** —`monitoreo_aulas_plan` y `calc_muestra_aulas_selection` en cero—, así que `POST /api/recopiladores/seed` devuelve `seed_available: false`. Cerrarlos exige fixtures nuevos, no un flag. Texto original: **Patrón, no incidencia: los proyectos de referencia cubren el pipeline de análisis y no los módulos operativos aguas abajo.** Tres de los ocho módulos solo se pueden auditar vacíos —Dashboard sin datos de tablero, Bitácora con 0 entradas, Recopiladores sin plan—, y en los tres el estado con datos es la mayor parte de la superficie. Mientras no se cierre, la línea «8 de 8 auditados» significa «8 de 8 visitados», no «8 de 8 cubiertos». **Cerrarlo es su propia unidad de trabajo**: o se enriquecen los fixtures, o el instrumento aprende a sembrar estado | abierto |

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
| **8** | **Todo el frontend · vocabulario de contratos** | **Falta un contrato para «mismo alto, ancho intrínseco»**, que es la forma de toda tira de chips, toolbar y banda de estado de la app. Hoy `equal` exige mismo alto **y** mismo ancho, e `intrinsic` llama desperdicio al `min-height` de un control. Medido en Formularios: con `intrinsic`, capacity-drift de 10,5 px que es el alto de control del chip; con `equal`, width-drift de 118 px y 55 px. **A:** agregar un tercer contrato (`banda`) con alto igual y ancho libre. **B:** partir `equal` en ejes (`equal-height` / `equal-width`) y permitir combinarlos. **C:** dejar las tiras sin declarar y aceptar el hueco de cobertura. **Recomiendo B**: es el que además deja declarar el caso inverso —ancho igual, alto libre— que ya apareció en las rejillas que colapsan a una columna | abierta |

| **9** | **Todo el frontend · estado vacío del kit** | **`.pulso-empty-state--panel` no dibuja panel**: no tiene fondo, ni borde, ni radio, pese al nombre y pese a ser el estado vacío canónico. Son ~96 de los 105 usos de `EmptyState` en la app. Al menos dos features ya se escribieron su propio marco alrededor (`cmv2-calc-escenarios-panel`, `cmv2-marco-vacio`), que es la duplicación que el kit compartido debería evitar. **A:** darle materia de panel al kit —arregla ~96 superficies de una vez, pero deja cajas concéntricas donde ya hay marco propio, y esos hay que retirarlos—. **B:** dejar el kit sin marco y que cada superficie envuelva su vacío, como hizo la iteración 8 en Bitácora —más trabajo, pero respeta que el marco es de la superficie, no del mensaje—. **C:** renombrar la variante para que deje de prometer lo que no da. **Recomiendo B**, y renombrar la variante como parte de ella: el marco es de la superficie | abierta |

## Cuándo cierra

Solo Gonzalo. La condición **medible** es: audit verde, los ocho módulos
auditados con el instrumento, cero módulos sin contrato geométrico, cero
hallazgos abiertos y bandeja vacía.
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

| 6 | 31 jul | **Cálculo de muestra** | **Un indicador con el nombre recortado —«UNIVERSO DE CURSOS-HORAR…»— que el comprobador NO marcó.** Apareció al mirar la captura. Envuelto, y la franja declarada `equal` | geometryGroups 0→**5** · coverageMisses 5→**0** · defectos reparados 1→**2** | `d753a645` |

| 7 | 31 jul | **Formularios** | **El vocabulario de contratos se quedó corto y el loop no lo forzó.** Dos colecciones declaradas y pasando; las dos tiras de chips quedan sin declarar con la razón medida, y sube la decisión 8 | geometryGroups 5→**15** · coverageMisses 20→**10** · geometryIssues **0** | `7a47ef01` |

| 8 | 31 jul | **Bitácora** | **El reporte dio verde a la primera y la captura mostró el defecto:** el vacío flotaba sobre 680 px de lienzo sin marco (C3). Al enmarcarlo apareció un scroll-jail que ya estaba latente | issues 0 · scrollJails 0 · defectos reparados 2→**3** · módulos auditados 6→**7** de 8 | `ddb711cc` |

| 9 | 31 jul | **Recopiladores** | **Cierra la primera órbita.** Reporte verde a la primera; el defecto salió de comparar la captura con las de las ocho vueltas previas: era el único módulo que ponía su propio nombre donde los demás ponen su cifra | issues 0 · defectos reparados 3→**4** · módulos visitados 7→**8 de 8** | `5a0ee445` |

| 10 | 31 jul | **Enciclopedia — retirada** | Auditada (`geometryGroups=0`, `coverageMisses=5`, verde por ausencia como las demás) y, en la misma vuelta, **retirada de la app por decisión del dueño**. La órbita pasa de nueve posiciones a ocho | superficie, router, 3 JSON huérfanos y `TabStrip` fuera · [ADR 0051](../adrs/0051-retiro-de-enciclopedia.md) | `44374172`, y el retiro |

| 11 | 31 jul | **N5 · Dashboard** | **El instrumento aprende a sembrar (`--sembrar`) y el Dashboard cargado entra por primera vez a la matriz.** Detrás del estado sembrado apareció el mayor defecto del goal: 2.017 px de curaduría inalcanzables | scrollJails 1→**0** · defectos reparados 4→**5** · N5 cerrado para Dashboard | `23d20376`, `774828d8`, `486a5f7b` |

### Nota de la iteración 11

**Sembrar valió exactamente lo que N5 prometía.** La primera captura del
Dashboard con datos encontró `dashboard-scope--editor` con `overflow: hidden`,
`scrollOwner: null` y 2.906 px de contenido en 889: **cinco de las siete
secciones de curaduría eran inalcanzables**, y con ellas la decisión que esa
pantalla existe para pedir. Diez vueltas de auditoría no lo habían visto porque
la ruta siempre rendía su compuerta.

**Tercera aparición del mismo patrón** —Carga, Bitácora, ahora Dashboard— y ya
merece nombre: *un contenedor que recorta apostando a que sus hijos scrollean
tiene que verificar que **todos** lo hagan, no la mayoría.* En los tres casos la
premisa estaba escrita (`scrollOwner="panels"`, `overflow: hidden` sobre una
columna flex) y un hijo no la cumplía.

**`--click-tab` no servía y relajarlo habría sido peor.** La sesión es una sola
para toda la matriz: el control de siembra existe en la primera captura y
desaparece en las cuatro siguientes. Pero en `--click-tab` un control ausente
**sí** es un fallo que hay que ver, así que la tolerancia va en un flag propio,
`--sembrar`, con su semántica escrita.

**N5 se cierra solo para Dashboard, y el resto empeoró al medirlo.** No es que
falte el estado de Recopiladores: falta el de **aguas arriba**. Los cuatro
fixtures tienen `monitoreo_aulas_plan` y `calc_muestra_aulas_selection` en cero,
así que el endpoint de siembra que parecía la solución devuelve
`seed_available: false`. Bitácora y Recopiladores necesitan fixtures nuevos, no
un flag — y eso es una unidad de trabajo propia, no media iteración.

**Y una del gate, que es mía.** El retiro de Enciclopedia dejó cuatro tests del
catálogo visual en rojo y el gate de esa unidad no los vio: corrí tsc, vitest,
build, testthat y audit, pero no `node --test scripts/tests/`. **Escalar el gate
al diff incluye preguntarse qué suites cubren lo que se borró**, no solo lo que
se escribió: un borrado no deja archivos nuevos que delaten su área.

### Nota de la iteración 10

**El módulo se auditó y se retiró en la misma vuelta**, y el orden importó: la
auditoría dio lo mismo que los demás —cero geometría, cinco coberturas— pero
esa medición quedó sin destino. Lo que sirvió del trabajo previo fue otra cosa:
la costumbre de medir dependencias antes de tocar.

**Borrar una carpeta no es borrar un módulo.** Medido antes de tocar nada:

- `enciclopedia/shared/components/Math.tsx` —envoltorio de KaTeX— lo importaba
  **Cálculo de muestra**. Borrar la carpeta habría roto otro módulo. Se movió al
  kit primero, en su propio commit, y recién después se retiró la feature.
- `catalogo_metodologias.json` y `catalogo_tipos_estudio.json` los lee
  **Bitácora** (`router_diseno_estudio.R:247`). Se quedan.
- Los tokens `--pulso-module-encyclopedia*` son, pese al nombre, la fuente del
  **ámbar de Bitácora**, que los aliasa. Borrarlos habría cambiado la paleta de
  otro módulo.
- `components/TabStrip.tsx` quedó huérfano al irse sus dos únicos consumidores.
  Se retiró también, **anotado aparte** por ser del kit y no de la feature.

Tres de esas cuatro no se ven leyendo la carpeta: se ven grepeando por nombre
de archivo y por token desde fuera. **La pregunta antes de un borrado no es qué
hay dentro, sino quién entra desde afuera.**

Y una consecuencia de método: `glosario` aparecía en seis archivos de Cálculo
de muestra y ninguno era el JSON —era la palabra, en prosa y en clases CSS—.
Buscar por concepto da falsos positivos; buscar por nombre de archivo, no.

### Nota de la iteración 9 — cierre de la primera órbita

**El defecto de esta vuelta no lo encontró el instrumento ni una captura suelta:
lo encontró la serie.** Recopiladores dio verde en todo y su zona de contexto
decía «Recopiladores». Eso solo se ve como defecto al ponerlo al lado de las
otras ocho capturas, donde ese hueco lleva `ENTRADAS · sin entradas`,
`DISTRITOS 6`, `MESA · Muestra de cursos-horario`, `DATOS sin cargar`. **La
comparación entre módulos es un instrumento en sí misma, y solo existe una vez
que la órbita dio la vuelta completa.** Es el primer hallazgo que la órbita
habilita y que ninguna pasada por un módulo aislado habría dado.

**Balance honesto de la primera órbita.** Ocho módulos visitados, cuatro
defectos reparados, 38 declaraciones geométricas fuera de Monitoreo contra 27 al
abrir, cero superficies principales sin contrato y el audit verde en las nueve
vueltas. Pero la línea del ledger dice «8 de 8 visitados», no «8 de 8
cubiertos», y la diferencia está escrita en N5: **tres de los ocho módulos solo
se pueden auditar vacíos** porque los proyectos de referencia cubren el pipeline
de análisis y no los módulos operativos aguas abajo. En Dashboard, Bitácora y
Recopiladores el estado con datos es la mayor parte de la superficie y sigue sin
mirarse.

Lo que la segunda órbita debería atacar, en ese orden: cerrar N5 —o fixtures más
ricos, o que el instrumento siembre estado—, porque sin eso toda cobertura
posterior arrastra el mismo asterisco; después las dos decisiones abiertas (8 y
9), que juntas gobiernan cómo se declara media app; y recién después seguir
declarando secciones internas.

### Nota de la iteración 8

**La regla de abrir la captura se pagó sola.** `ui-quick-check` devolvió
`ok=true`, `issues=0`, `coverageMisses=0` — y la pantalla mostraba «La bitácora
está vacía» flotando sobre 680 px de lienzo desnudo, junto a dos superficies que
sí tenían marco. El detector mide recorte, scroll y geometría; **no mide si un
vacío tiene dónde vivir**. C3 no es comprobable con el instrumento actual.

La causa estaba en el código, no en el CSS: `TimelinePorDia` devuelve un
contenedor cuando hay datos y el `EmptyState` pelado cuando no. **El marco
existía solo si había entradas** — que es C2 leído al revés: la superficie no
sostiene su marco frente a sus datos.

**El arreglo destapó un defecto mayor que el que venía a corregir.** Al enmarcar
apareció un `scroll-jail` a 1024x600 sobre `pulso-page-frame-body--fill`, con
`overflowY: hidden` y `scrollOwner: null`. No lo causó el marco: Bitácora
declara `scrollOwner="panels"` y el panel nuevo no cumplía ese contrato —se
traía el piso de 240 px del estado vacío del kit sin poder encogerse—. Con
entradas reales habría desbordado igual. **Un arreglo que destapa un rojo latente
no es un arreglo que rompió algo; es uno que hizo visible lo que ya estaba.**

**Lo que no se tocó, y por qué.** Ningún proyecto de referencia tiene entradas
(los cuatro dan 0), así que el estado poblado del timeline no se puede ver.
Se enmarcó solo la rama vacía —la que sí se puede verificar— y la poblada quedó
intacta. Cambiar a ciegas lo que no se puede mirar es justo lo que este goal
evita. Queda como N4, hermano de N3.

Y de aquí sale la decisión 9: el estado vacío canónico del kit se llama `panel`
y **no dibuja panel**. Son ~96 de 105 usos en la app, y dos features ya se
escribieron su propio marco alrededor. No se tocó de forma unilateral porque
cambiarlo mueve 96 superficies a la vez y deja cajas concéntricas donde ya hay
marco propio.

### Nota de la iteración 7

**Primera vez que el instrumento se queda corto, y conviene no disimularlo.**
Una tira de chips es «mismo alto, ancho intrínseco». El vocabulario tiene
`equal` (mismo alto **y** mismo ancho) e `intrinsic` (cada uno ciñe su
contenido), y ninguno de los dos la describe. Se midió en los dos sentidos antes
de concluirlo: con `intrinsic`, `capacity-drift` de 10,5 px que resultan ser el
`min-height: 22px` del chip contra su `line-height: 1` —alto de control
deliberado—; con `equal`, `width-drift` de 118 px y 55 px. «Nuevo» y «Guardado
ahora» son el caso limpio: misma variante, mismo alto por diseño, ancho distinto
por contenido.

Había dos salidas cómodas y las dos son falsas: forzar `intrinsic` deja un rojo
que solo se salda rompiendo el diseño, y forzar `equal` deja un rojo peor.
También se podía subir la tolerancia hasta que pasara, que es comprar el verde.
**Se eligió no declarar, escribir la medición en el código y elevar la
decisión** — un hueco de cobertura reconocido vale más que un contrato que
miente.

Es la tercera familia de «esto no es deuda» del goal, después de la decoración
con lienzo (iteración 2): **control con alto de control declarado**. Las dos
comparten raíz —un `min-height` intencional no es interior desperdiciado— pero
esta no se resuelve retirando la declaración, sino ampliando el vocabulario.
Por eso va a la bandeja y no al registro de falsos positivos.

`ok=false` al cerrar, y está bien: quedan 10 coberturas abiertas a propósito.
Declararlas es lo que desbloquea la decisión 8, no al revés.

### Nota de la iteración 6

**El instrumento acota el trabajo, no lo agota.** Las cinco capturas dieron
`issues=0` y aun así la franja mostraba «UNIVERSO DE CURSOS-HORAR…»: un
`text-overflow: ellipsis` deliberado no dispara la regla de recorte del
detector, porque desde su punto de vista el autor pidió esa elipsis. El defecto
apareció al **mirar la imagen**. Conviene seguir abriendo una captura por
iteración aunque el reporte venga limpio.

**Se reusó un criterio ya ganado en vez de deliberar de nuevo.** La pregunta
«¿envolver desacomoda las columnas?» ya estaba resuelta en las tablas de
territorial: solo las mueve si el ancho lo decide el contenido. Aquí lo deciden
seis `1fr`, así que envolver era seguro y no hacía falta medir 26 columnas otra
vez. Los criterios del registro son reutilizables entre módulos; el detector no
los sabe, pero el loop sí.

**El contrato como prueba del arreglo, no solo como guard.** `equal` sobre la
franja pasa *con la etiqueta ya envuelta*: esa es la evidencia de que crecer una
celda no rompió el marco, porque las seis crecieron juntas. Declarar y reparar
en la misma vuelta deja el arreglo demostrado, no supuesto.

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
