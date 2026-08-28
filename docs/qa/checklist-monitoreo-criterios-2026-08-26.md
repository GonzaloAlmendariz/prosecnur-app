# Monitoreo: criterios generales y prueba con la selección real

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-08-26
Autoridad: Encargo de Gonzalo del 2026-08-26; los criterios los gobiernan el ADR 0079 (cumplimiento contra la cuota) y el ADR 0082 (τ como supuesto declarado)

Encargo de Gonzalo, textual: **«debe tomar en cuenta no elementos específicos
de que hacerle seguimiento sino criterios generales que tenemos que tomar en
cuenta en Monitoreo»**. El audit anterior iba componente por componente; esto
va por criterio de dominio, y los componentes salen de ahí.

## Los cinco criterios generales

Son las afirmaciones que Monitoreo tiene que sostener siempre. Cada ítem de
trabajo se justifica contra uno de ellos.

| | Criterio | Por qué se rompe |
|---|---|---|
| **C-A** | **La cuota es por facultad, y dentro de ella por sexo.** Nada se compensa entre facultades ni entre celdas. | Pasarse en Derecho no cubre lo que falta en Letras. Un total agregado siempre sale más favorable que la suma de los déficits. |
| **C-B** | **Efectivas y elegibles son dos cosas y nunca comparten rótulo.** | Son numerador y denominador de τ. En el histórico 2025, 8 de 194 aulas rinden efectivas **por encima** de sus elegibles (máximo 1,29): los dos campos ni siquiera comparten universo. |
| **C-C** | **Una encuesta efectiva la definen los filtros iniciales declarados**, no un umbral posterior ni el parte del aplicador. | «La efectiva se define en la plataforma, no en el parte» (`monitoreo_aulas_efectivas.R`). Sin filtros declarados, el motor cuenta todo: medido en la fixture, «la base no trae columna de estado, así que cuentan las 3 700 respuestas». |
| **C-D** | **El seguimiento de efectividad contrasta lo supuesto con lo observado y decide activación de reservas** — no informa una tasa. | Si la señal llega sin fecha límite, sin el sexo que falta o contando de menos el respaldo, informa pero no decide. |
| **C-E** | **Las tres dimensiones del libro se leen y se elaboran bien porque son lo que va a campo.** | Agendación, registro de campo y base de control. Un archivo que se genera sin error pero que nadie entiende no sirve. |

## El estado real medido, 2026-08-26

Sobre `~/Documents/Pulso/HSTVG2026/HSVG26ULT.pulso` (12,1 MB, guardado el
2026-08-26 14:33). **Trabajado siempre sobre copia; el original no se toca y
nunca entra al repositorio** — lleva nombres, correos y teléfonos de docentes.

- Selección cerrada: **174 titulares · 1 259 de cadena · 79 de banco** = 1 512
  filas × 86 columnas. **6 119 elegibles** en titulares, **15 facultades**.
- `calc-muestra: ready` · **`recopiladores: active`** · **`monitoreo: pending`**.
- **`link` vacío en 1 512 de 1 512 filas.** El handoff de Recopiladores no ha
  escrito enlaces pese a que el módulo está activo. Es exactamente la trampa que
  la sesión hermana midió antes (0 de 951): generar el libro sin ese paso deja
  «ENLACE DE LA FICHA» vacío.
- **`monitoreo_config` ausente**: la selección no se ha trasladado a Monitoreo.
  El traslado que hay que probar está sin hacer, así que el punto de partida
  está limpio.

## Checklist

Cada ítem dice **dónde vive** y contra qué criterio responde. Ninguno se cierra
sin verlo en la aplicación.

| # | Ítem | Dónde vive | Criterio | Estado |
|---|---|---|---|---|
| **T1** | Trasladar la selección de 174 aulas a Monitoreo desde la UI | `classroomHandoff.ts:342` | C-E | **☑ probado: NO se puede.** Causa medida; **bloqueado por decisión de Gonzalo** |
| **T2** | Fabricar **una semana** de campo sobre ese traslado | copia de trabajo, nunca el original | C-C, C-E | ☐ **bloqueado por T1** |
| **T3** | Poner a prueba C-A a C-E contra ese estado y anotar qué se rompe | recorrido por la UI | todos | ☐ |
| **T4** | Definición de encuesta efectiva desde los filtros iniciales: comprobar que se declara y que el motor la respeta | `criterio_validez`, `valid_filters` | C-C | ☐ |
| **T5** | Efectivas vs elegibles: dónde comparten rótulo | perfil de aulas | C-B | **☑ medido**: 3 700 contra 3 508 en la misma pantalla; **no se repara**, es E8 y espera a Gonzalo |
| **T6** | Cuotas por facultad y sexo sin compensar entre celdas | `avance_cuota`, cuotas | C-A | **☑ conforme**: 37 + 17 = 54, igual que el KPI |
| **T7** | El libro leído | `carga_aulas_libro_generar.R` | C-E | **☑** son 5 hojas y está bien formado; 3 puntos a mirar |
| **T8** | **La tabla de avance para el cliente**, en **tres formas**: pantalla en Avance, PDF y Excel | pantalla + `router_monitoreo.R:3159` (patrón de territorial y telefónico) | C-A | ☐ diseñado, bloqueado por T1+T2 |
| **T9** | Gráficos y diagramas: mejorar los actuales y proponer los que faltan | perfil de aulas | C-D | ☐ |
| **T10** | Formato y estética del resto del perfil, con el criterio ya aprobado | perfil de aulas | — | ◐ parcial (seis listas y contraste hechos) |

## T8 — la tabla de avance para el cliente: las tres formas

Decisión de Gonzalo del 2026-08-26: **«las tres formas, una en avance y las
otras dos en un PDF para poder enviarlos a sus correos y un Excel para poder
compartírselos»**. Mismo contenido, tres soportes:

| Soporte | Para qué |
|---|---|
| **Pantalla**, en Avance | mirarlo mientras el campo corre |
| **PDF** | enviarlo por correo |
| **Excel** | compartirlo y que lo manipulen |

### Qué lleva

Avance **por facultad × sexo** contra **la muestra y la sobremuestra**, más
**la cantidad de aulas aplicadas**.

Las dos varas ya tienen nombre en el repo y **no se inventan**:
`calc_muestra_asistencia_referencia.R` lee `sobremuestra` —alias
`muestra_operativa`— y `ratio_sobremuestra` —alias `factor_sobremuestra`—, y
las dos viajan en la whitelist de persistencia del `.pulso`. La **muestra** es
la cuota comprometida; la **sobremuestra**, lo que hay que salir a buscar
contando que sólo responde una fracción.

Medido en el diseño real de HSVG26ULT: cuota **2 500** alumnos repartida en 15
facultades y por sexo dentro de cada una (Arquitectura M=40 · F=85), y
**165 aulas base + 15 de reemplazo + 15 extra = 180**. Ojo: la selección
ejecutada trae **174 titulares**, no 165 — el ejecutado y el nominal del diseño
difieren, y la tabla tiene que decir cuál está mostrando.

### El mecanismo YA EXISTE. No se inventa: se añade el tercer perfil

`router_monitoreo.R:3159` despacha el reporte a cliente por perfil:

- territorial → `avance_territorial_monitoreo` (`monitoreo.territorial_advance_pdf`)
- telefónico → `avance_telefonico_monitoreo` (`monitoreo.telefonico_advance_pdf`)
- **todo lo demás, aulas incluido → el genérico `reporte_cliente_monitoreo`**

Así que aulas **no tiene** PDF de avance propio y cae al genérico, mientras los
otros dos perfiles sí lo tienen. T8 es añadir el tercero siguiendo el patrón de
los dos que ya funcionan —`report_kind`, slug, `job_kind`, y el modelo que
`.monitoreo_client_report_model_for_snapshot()` arma—, no construir un motor.

Para el Excel, el camino es el de los exports que ya existen; se decide al
llegar, después de ver el PDF.

**Bloqueo de secuencia**: T8 no se puede juzgar sin T1 y T2 —el traslado y la
semana de campo—, porque una tabla de avance sin avance no dice si se entiende.

## T1 — la selección de 174 aulas NO se puede trasladar hoy, y ésta es la razón

Probado el 2026-08-26 sobre la copia de trabajo de `HSVG26ULT.pulso`, abriendo
la aplicación y recorriendo `Cálculo de muestra → Entrega → Pase a Monitoreo`.

**La pestaña muestra «pendiente» en sus cuatro filas** —cursos-horario
titulares, cursos-horario de reemplazo, método y simulación de reemplazos— y
bajo ellas «Completa la selección antes de emitir fichas». **No hay ningún
botón de traslado.** Y la selección está cerrada.

### La causa, medida

`selectionReady` (`classroomHandoff.ts:342`) exige siete condiciones a la vez.
Consultado el estado por la propia sesión del navegador:

| Condición | Estado |
|---|---|
| Selección presente | ✅ 1 512 filas: **174 titulares**, 1 259 de cadena, 79 de banco |
| `selection_run_id` | ✅ `sel_aulas_20260826…` |
| `frame_hash` de la selección = el del marco | ✅ los dos `87df265f50d247` |
| **`selector.n_aulas` = lo que pide el cálculo** | ❌ **174 contra 165** |

**Ése es el único que falla.** La selección se hizo para 174 aulas y el cálculo
vigente pide 165, así que la guarda la trata como si no correspondiera al diseño
y apaga el handoff entero.

### Por qué importa que sean 174 y no 165

Los 9 de diferencia no son un desajuste accidente: la propia app, en su tabla de
coincidencia contra el estudio anterior, anota junto a las aulas a visitar
«**ejecutado tras ajuste manual de agenda; no es el dimensionamiento de su
diseño**». Es decir, el repo ya reconoce que una selección puede apartarse del
número nominal por decisión operativa — pero la guarda del handoff no lo
contempla y lo lee como obsolescencia.

**Consecuencia**: cualquier ajuste deliberado del número de aulas deja el pase a
Monitoreo bloqueado, sin decir por qué. El mensaje que se ve —«completa la
selección»— es además engañoso: la selección está completa.

### Lo que NO se hace sin decisión de Gonzalo

Hay al menos tres salidas y no son equivalentes:

1. **Que el objetivo siga a la selección**: si se sorteó para 174, el objetivo
   vigente pasa a 174. Riesgo: un objetivo que se reescribe solo deja de ser la
   vara contra la que se comprueba el sorteo.
2. **Que la guarda compare identidad y no cantidad**: `selection_run_id` +
   `frame_hash` ya coinciden, y son lo que prueba que la selección es de este
   marco. La cantidad pasaría a ser un aviso, no un bloqueo.
3. **Que exista un modo declarado de «ajuste operativo»** que registre por qué
   174 y no 165, y desbloquee con esa constancia.

La 2 es la que menos promete de más y la que más se parece a lo que el repo ya
hace en otros sellos, pero **cambia cuándo se considera vigente una selección**
y eso es decisión suya, no mía. Mientras tanto **T2 queda bloqueado**: sin
traslado no hay estado de Monitoreo sobre el que fabricar la semana de campo.

## T5 y T6 — medidos en pantalla (2026-08-26)

### T5 · C-B: dos totales del mismo concepto, en la misma pantalla

En `avance > rendimiento`, a la vez y sin nada que los distinga:

| Qué se ve | Cifra | De dónde sale |
|---|---|---|
| KPI **VÁLIDAS** | **3 700** | plataforma — «respuestas de Kobo que pasan el filtro» |
| Ranking, sumando sus 20 facultades | **3 508** | parte de campo — «251 encuestas» por fila |

**192 encuestas de diferencia**, las dos llamadas «encuestas». Las cuatro lentes
del ranking —facultad, aplicador, franja, día— coinciden entre sí (3 508 sobre
152 aulas cada una), así que no es un fallo de una lente: es la distancia
parte↔plataforma, que es exactamente lo que el criterio C-B existe para no
esconder.

Lo que hace la diferencia legible o no es el rótulo: **la banda de KPI sí
declara su fuente** («declaradas en el registro de campo» para aplicadas,
«respuestas de Kobo» para válidas) y **el ranking no dice nada**: pone «251
encuestas» a secas.

**No se repara aquí.** Es la misma familia que E8 —«Del potencial» y la
proyección del banco— y E8 **espera a Gonzalo**. Queda listado con su pantalla y
su número, que es lo que él pidió.

### T6 · C-A: conforme, y con el conteo

La pirámide de cuota publica exactamente **dos** cifras de faltante, **37
mujeres + 17 hombres = 54**, idéntico al KPI «CUOTA POR RECOGER 54 · 37 mujeres
· 17 hombres». No hay compensación entre celdas ni neteo. «CIERRAN CON LO
AGENDADO 38 de 40 celdas sexo × facultad» también es por celda, sobre 20
facultades.

### La trampa que ya va por la tercera vez

Contar sobre el TEXTO renderizado con una expresión regular ha dado tres falsos
positivos en esta sesión:

1. «3,700 respuestas» leído como 3,7 — era 3 700 con separador inglés.
2. «faltan · 80,2» leído como personas — era 80,2 **%**, la regex cortó el signo.
3. Aquí: tres coincidencias de «por recoger» sumando 108 contra un KPI de 54 —
   la regex contaba también la línea del propio KPI, y 108 es 2 × 54.

Las tres se deshacen mirando la ESTRUCTURA en vez del texto: nodos hoja, su
cadena de padres y su unidad. **Un número sin su estructura no se puede
juzgar**, igual que no se puede sin su unidad.

## De dónde salen los 174 — y por qué la app muestra 165

Gonzalo: «no me explico por qué hay 165, deberían de haber 174». **Tenía razón**,
y la causa es precisa.

### El estudio tiene DOS componentes y la app está mirando el otro

| Componente | Actor declarado | Aulas base |
|---|---|---|
| `cmp-cine0qk8` | Muestra con representatividad a nivel **universidad** | **165** |
| `cmp-cine0qk8-fac` | Muestra con representatividad a nivel **facultad** | **174** |

HSVG2026 corre con representatividad **a nivel facultad** —cuotas por facultad,
15 estratos, todo el ADR 0079—, así que el componente vigente es el segundo y
el número del estudio es **174**.

**Y la selección hizo exactamente eso**: comparando `aulas_base` por estrato del
componente de facultad contra los titulares realmente sorteados, **coinciden las
15 de 15 facultades**, suma 174 contra 174, cero discrepancias.

### El defecto

`workspace.aulas_config.n_aulas` guarda **165** —el objetivo del escenario de
universidad— mientras el estudio corre por facultad. Y el workspace **no declara
qué escenario rige** (`escenario` es `null`; sólo hay una lista `escenarios`),
así que el pipeline lo infiere.

De ahí sale todo lo demás en cascada, porque **la misma comparación vive en tres
capas** de `classroomHandoff.ts`:

1. `currentAulasTarget` se anula a 0 si el objetivo guardado no iguala al del
   componente elegido.
2. `runIsCurrent` exige que el objetivo de la corrida iguale a ése.
3. `selectionReady` exigía lo mismo de la selección.

Con 165 guardado y 174 ejecutado, las tres fallan y el pase a Monitoreo se apaga
entero, mostrando «pendiente» y «completa la selección» sobre una selección
completa y correcta.

### La regla NO era numerología: se des-retracta

En un tick reporté la regla `max(fórmula, certeza)` + un aula en Derecho; en el
siguiente la retracté al ver que el componente de facultad cuadraba 15 de 15.
**La retractación estaba mal, y la sesión hermana tenía razón al pedir que no la
diera por falsa.** Las dos cosas son ciertas porque describen el mismo objeto:

| Facultad | comp1 | certeza | max | **comp2** | ¿comp2 = max? |
|---|---|---|---|---|---|
| Arquitectura | 8 | 7 | 8 | 8 | sí |
| Arte y Diseño | 15 | 13 | 15 | 15 | sí |
| Ciencias e Ingeniería | 37 | 34 | 37 | 37 | sí |
| **Derecho** | 16 | 18 | **18** | **19** | **NO** |
| EE.GG. Letras | 18 | 20 | 20 | 20 | sí |
| … las otras diez | | | | | sí |
| **suma** | **165** | **167** | **173** | **174** | |

**`comp2 = max(comp1, certeza)` en 14 de 15 facultades.** La única excepción es
Derecho —18 contra 19—, el aula añadida a mano que la sesión hermana localizó
documentada en el PDF metodológico §5.3 (a 18 la certificación daba 0,9512).

Es decir: **el componente de facultad ES la afijación posterior a la
certificación, ya persistida**, incluida la decisión de Derecho. No hay que
reconstruirla ni buscarla en otro sitio.

### Lo que no reproduce, y hay que cruzar

La sesión hermana midió `comp2` sumando **294** y coincidiendo **0 de 15** con
el sorteo. Sobre este archivo eso no reproduce: leyendo el `state.rds` en crudo,
sin API, `comp2$resultado$aulas_base_total` es **174** y la suma de sus
`aulas_base` por estrato también. Y el archivo es el mismo —la copia de trabajo
tiene el **hash idéntico** al original (`73963fc8…`)—.

Tampoco existe `aulas_base_fijas` en ninguno de los dos componentes, así que la
reparación no puede leerse de ahí.

### Dónde queda el defecto, ya reconciliado

No es «el workspace guarda el escenario que no rige»: es que
`workspace.aulas_config.n_aulas` guarda **165** —el `aulas_base_total` de comp1,
o sea el objetivo **pre-certificación**— mientras la afijación operativa vive en
`comp2.aulas_base_total` = **174**. El objetivo vigente hay que leerlo del
componente operativo, no de `aulas_config.n_aulas`.

### Qué falta decidir

El arreglo de fondo no es aflojar guardas: es que **el workspace guarde el
objetivo del componente vigente** y que el escenario se declare en vez de
inferirse. Eso toca `calc-muestra`, no Monitoreo, y conviene coordinarlo con la
sesión hermana antes de tocarlo.

## T7 — el libro leído (2026-08-26)

Generado con la fixture del operativo completo y **todos** sus insumos —plan,
partes, control, efectivas de plataforma, respuestas y el vector de validez—,
que es como lo llama el router.

### Son CINCO hojas, no tres

| Hoja | Tamaño |
|---|---|
| Aulas Agendadas | 171 × 61 |
| Aulas Aplicadas (Campo) | 194 × **102** |
| Base de control | 194 × 43 |
| **Cómo va el campo** | 34 × 4 |
| Listas | 7 × 4 |

**«Cómo va el campo» ya es una tabla de avance** y nadie la había nombrado en el
encargo. Trae la meta, las conseguidas, el avance, lo que falta, las aulas que
llegaron a su meta, la producción por aplicador y el **avance diario acumulado
con lo que falta día a día**.

### El libro está bien formado

Se llena entero y los porcentajes llevan formato `0.0%` en la celda: el
«Avance» que en crudo es `0.987456…` **se muestra como 98,7 %**.

**Dos veces estuve a punto de reportar defectos que no existían**: primero
llamé vacía a la hoja porque la generé sin `efectivas`/`responses`/`validas` —el
router sí los pasa—, y después llamé cruda a una cifra que la celda formatea.

### Lo que sí merece mirada

1. **«Aulas Aplicadas (Campo)» tiene 102 columnas**, y es la hoja que llena el
   aplicador. Es la pregunta de usabilidad más grande del libro.
2. **«Aulas del operativo: 170» contra «Aulas que llegaron a SU meta: 106»**. El
   denominador es el plan, no lo aplicado (152 en la fixture). Un lector calcula
   106/170 = 62 % cuando sobre aplicadas sería 106/152 = 70 %.
3. **C-B, y aquí el Excel va POR DELANTE de la UI**: en la misma hoja conviven
   «Efectivas declaradas» por aplicador (suma **3 508**, el parte) y «Efectivas
   conseguidas» (**3 700**, plataforma) — pero **los rótulos las distinguen**.
   En la pantalla de Rendimiento las mismas dos cifras aparecen sin que nada las
   separe. El libro ya resuelve lo que la UI tiene abierto en E8.

### Y esto cambia T8

**T8 no es crear la tabla de avance: es extender «Cómo va el campo»**, que ya
existe y ya se genera. Lo que le falta es exactamente lo que Gonzalo pidió: **el
corte por facultad y por sexo, contra muestra y sobremuestra, y las aulas
aplicadas**. Hoy sólo da el agregado del estudio.

## T8c — el PDF: el camino, medido antes de escribirlo

Dos de las tres formas están hechas: el **Excel** (bloque de once columnas en la
hoja «Cómo va el campo») y la **pantalla** (`AulasAvanceParaCliente`, en
`avance > cuotas`, verificada con desvío 0). Falta el PDF, y esto es lo que hay
que saber antes de empezarlo.

### Aulas no cae a un genérico: cae al modelo de ACREDITACIÓN

`.monitoreo_client_report_model_for_snapshot()` (`router_monitoreo.R:2352`)
ramifica en tres:

| Familia | Modelo | `report_kind` |
|---|---|---|
| territorial | `monitoreo_publication_model(audience="client")` | `territorial_advance_pdf` |
| telefónico | `build_monitoreo_telefonico_report_model()` | `telefonico_advance_pdf` |
| **todo lo demás, aulas incluido** | `monitoreo_acreditacion_client_report_model()` | `acreditacion_client_report_pdf` |

Y el runner (`router_monitoreo.R:2705`) ramifica igual hacia tres renderizadores.

### Por qué NO se puede reusar el renderizador de acreditación

Su modelo de hojas **parece** genérico —`sheet` → `block` → `data.frame`— pero
el renderizador no lo consume: `monitoreo_acreditacion_client_report_pdf()` lee
`model$actors`, `model$daily_actor`, `model$daily_general`, `model$sources` y
`model$channel_labels`. **Tiene forma de acreditación.**

Reusarlo exigiría mapear facultades a «actores», y eso es llamar una cosa por el
nombre de otra dentro del propio modelo — el defecto que este perfil ya arrastra
con las tasas homónimas. **No se hace.**

### El camino, entonces

Un motor propio siguiendo el precedente telefónico
(`monitoreo_telefonico_report_pdf.R`, **1 068 líneas**, modelo y renderizador en
el mismo archivo). Es trabajo de varios ticks, no de uno.

**Lo que NO hay que rehacer**: el contenido ya está decidido y probado en
`avanceParaCliente.ts` —muestra y su reparto por sexo, conseguidas y el suyo,
aulas aplicadas sobre las del plan, avance y faltantes, ordenado por lo que
falta— y en `carga_aulas_libro_avance_facultad.R` del lado R, con 19 aserciones.
**El modelo del PDF debe leer de ahí, no recalcular**: tres tablas del mismo
nombre con cifras distintas es exactamente lo que este perfil no puede permitirse.

La estética la da el kit compartido (`pulso_pdf_theme.R`: `pulso_pdf_header`,
`pulso_pdf_footer`, `pulso_pdf_hairline`, `pulso_pdf_tokens`, `pulso_pdf_geo`),
que resuelve cabecera, pie, logo y paleta pero **no dibuja tablas**: eso lo pone
cada motor.

## T9 — inventario de los gráficos, y el conteo vuelve a sobrestimar

Antes de proponer gráficos nuevos, qué hay. Diez piezas en el perfil, medidas
contra el criterio aprobado (alternativa textual, leyenda junto a la pieza,
escala con extremos conocidos, el color nunca como único portador):

| Gráfico | `role="img"` | Veredicto |
|---|---|---|
| `AulasSerieDeRendimiento` | 5 | conforme |
| `AulasRitmoPorFacultad` | 2 | conforme (reparado hoy) |
| `AulasCadenaChart` | 1 | conforme |
| `AulasConcentracionBrecha` | 1 | conforme |
| `AulasEfectividadSeguimiento` | 1 | conforme |
| **`AulasPiramideCuota`** | 0 → **1** | **era defecto, reparado** |
| `AulasRitmoDiario` | 0 | **NO es defecto**, ver abajo |
| `AulasBrechaEstratoChart` | 0 propio | **conforme**: es Plotly |
| `AulasEstadoChart` | 0 propio | **conforme**: es Plotly |
| `AulasCoberturaChart` | 0 propio | **conforme**: es Plotly |

### El inventario cierra: 1 defecto de 10, ya reparado

Los tres que salían sin etiqueta son **exactamente** los tres que dibuja
`PlotlyChart`, y ese envoltorio compartido **ya pone `role="img"` y
`aria-label`** (líneas 237-238). Comprobado: los tres le pasan su `ariaLabel`
—«Respuestas recogidas y brecha por estrato», «Cursos-horario por status de
aplicación», «Cursos-horario por nivel de cobertura de su meta»—.

Así que de los diez: **ocho ya estaban conformes**, uno es decorativo declarado
y correcto (`AulasRitmoDiario`), y **uno era defecto y está reparado**
(`AulasPiramideCuota`). El «5 sin etiqueta» del conteo era **1**.

Y una trampa de medición propia por el camino: el patrón `Plot\b` no casa
«PlotlyChart» —la frontera de palabra cae dentro del nombre—, así que el primer
barrido dijo que ninguno era Plotly y estuve a punto de tratarlos como divs
dibujados a mano.

**Consecuencia para T9**: la parte de inventario está cerrada y los gráficos
están sanos. Lo que queda es la parte que Gonzalo pidió y que sigue sin tocarse
—«gráficos y diagramas adicionales útiles y un mejoramiento de los actuales»—,
y para eso los candidatos ya identificados en este loop son **E7** (la tercera
línea del diseño en `serieDeRendimiento`, que hoy dibuja observado y esperado
bayesiano pero no lo que el diseño supuso) y **E5** (la proyección a dos tasas).

### El que sí era defecto

**`AulasPiramideCuota`**: las cifras de cada celda —observadas, meta y avance—
vivían **sólo en un `title`**. Un tooltip no es alcanzable por teclado y los
lectores de pantalla lo tratan de forma desigual, así que quien no pudiera pasar
el ratón no tenía el dato: no aparece como texto en ninguna otra parte de la
fila. Ahora el carril lleva `role="img"` y una `aria-label` con la misma lectura
que el tooltip. Verificado en pantalla: **40 celdas, las 40 con etiqueta**, del
tipo «F: 92 de 121 · 76% · con lo agendado se queda a 18».

### El que NO lo era, y por qué el conteo engaña

**`AulasRitmoDiario`** sale con cero `role="img"` y su barra lleva
`aria-hidden="true"`. **Es correcto, y el propio código lo declara**: las dos
cifras de la fila —las del día y el acumulado— ya son texto en las celdas de al
lado, así que un lector de pantalla tiene el dato sin la barra. El comentario
incluso contrasta con la agenda por día, que sí etiqueta las suyas porque allí
la barra reparte tramos que no están escritos en ningún otro sitio.

**La regla del triaje, entonces**: un gráfico cuyo dato ya está en texto junto a
él no necesita alternativa; uno cuya información vive sólo en la geometría o en
un tooltip, sí. Aplicar el conteo sin esa distinción habría "reparado" una pieza
que ya estaba bien y habría añadido ruido a un lector de pantalla.

Es la **quinta vez en esta sesión** que un conteo de grep sobrestima: 8
redondeos daban 0 defectos, 12 archivos con `aria-hidden` daban 6, y aquí 5
gráficos sin etiqueta dan 1 confirmado y 3 por triar.

## Lo que ya está cerrado y no se rehace

- Seguimiento de τ (ADR 0082): motor, tabla, disparador por margen, backtest
  2025. Ver `seguimiento-tau-campo-2026-08-26.md`.
- Seis listas con cabecera oculta reparadas; contraste WCAG AA medido (594
  elementos, cero incumplimientos).
- **El libro de las tres dimensiones ya existe**: `aulas_libro_hoja_agendadas()`,
  `aulas_libro_hoja_aplicadas()`, `aulas_libro_hoja_control()`, por
  `POST /api/monitoreo/aulas/generar-libro`. T7 lo audita, no lo construye.

## E7 — la tercera altura de la serie diaria ☑ hecho (2026-08-27)

La serie de rendimiento tenía **dos** alturas por día: el techo de elegibles y
lo conseguido. Comparaba el campo consigo mismo y con la media del estudio,
nunca contra la vara con la que se dimensionó. Entra la tercera.

**De dónde sale, y por qué no de `tau_previsto`.** El encargo decía tomar la τ
prevista de `efectividad_seguimiento`, y eso habría sido un error de unidades:
el eje son **encuestas por aula** y τ es una **tasa**. La vara correcta es
`expected_valid` del plan, que para las aulas del diseño ya es
`eligible_n × rendimiento_ref × factor_facultad` —la misma τ, aplicada a esa
aula— y viene del par plan+parte, sin cruzar fuentes.

**La trampa que casi repito.** `expected_valid` colapsa tres cosas y el motor lo
declara en `meta_origen`:

| origen | qué es | ¿sirve de vara? |
|---|---|---|
| `diseno` | lo que el cálculo de muestra computó | **sí** |
| `declarada` | lo que alguien escribió a mano | no |
| `elegibles` | el techo, puesto porque no había meta | **no**: es el techo |

Promediarlas daría una vara que en parte es el techo, y dibujada pegada al techo
se leería como que el diseño esperaba el 100 %. Es literalmente el defecto que
`api/R/monitoreo_aulas_universitarias.R:496` ya documenta —«la pantalla decía "la
meta que el cálculo de muestra calculó" sobre filas que no venían de ningún
diseño»—. Se filtra por origen y **el promedio se toma sobre las que tienen
vara**, no sobre todas las del día.

**La fixture no la sembraba.** `qa_pulso_aulas_campo.R` escribía `expected_valid`
pero nunca `efectivas_esperadas` ni `meta_origen`, así que toda derivaba a
`declarada` y la vara no se dibujaba en **ninguna** pantalla de QA. Medido en el
proyecto real: las 1512 filas del plan son `diseno`, razón meta/elegibles 0,41 a
0,80 por facultad, y **174 titulares** —la cifra vuelve a salir sola desde una
extracción fresca—. La fixture ahora siembra en ese rango, variando por facultad
y dejando una de cada nueve sin vara para que el día mezclado se vea.

**Un defecto propio, cazado mirando.** La vara empezó siendo una raya punteada
gris. En este gráfico **ya hay otra punteada gris** —el esperado—, o sea dos
cosas distintas con el mismo trazo y una sola en la leyenda. Se reencuadró: la
barra va en dos tonos y el relleno es la señal primaria; la raya queda de
refuerzo. Y el gráfico, que **no tenía leyenda**, ahora nombra los cuatro
trazos, incluido el esperado, que llevaba dibujado desde siempre y sólo se
explicaba en el pie tres bandas más abajo.

**Verificado en pantalla** (fixture de campo, `avance > rendimiento`): 17 de 21
facultades declaran la mezcla («en 7 de 8 aulas») y la vara va de **11 a 22**
según la facultad —un número fijo no habría servido de nada—. Gate: 211
archivos, 1.780 pass, typecheck limpio; los tres tests nuevos se vieron rojos
quitando el filtro de origen.

**Lo que queda sin ver en pantalla**: la rama de ausencia total («el plan no trae
la meta del diseño de estas aulas»). Ninguna facultad de la fixture se queda a
cero, así que sólo la cubre el test unitario.

**El latente, ya medido (2026-08-27): NO es un defecto.** `metaDeLoVisitado` —la
meta del gráfico *acumulado*— suma `expected_valid` sin mirar el origen, y el
delta sobre la fixture es **406 de 2 694 (15,1 %)**. Pero viene **entero de 20
aulas con origen `declarada`**, y el campo está documentado como «lo que el plan
espera de las aulas visitadas»: para una meta escrita a mano eso es cierto. **No
hay ni una fila con origen `elegibles`** —el techo disfrazado de meta, que sí
sería defecto— ni en la fixture ni en el proyecto real, donde las 1512 son
`diseno` y el delta es **cero**. Se deja como está.

La medición se hizo contra el **plan publicado**, no contra el crudo: suman 4.945
y 6.040 respectivamente, y el front lee el publicado. Contra el crudo daba 3.339
y no cuadraba con el 2.693 de la pantalla; contra el publicado da 2.694. Es la
misma disciplina de siempre —medir contra lo que el consumidor consume— y aquí
la diferencia era del 24 %.

**Lo que sí salió de esa medición**: en la misma línea de leyenda conviven «Meta
2 693» y las dos cuotas por sexo, que suman **2 710**. Diecisiete de diferencia
entre dos cantidades que no tienen nada que ver. El chip ahora dice «Meta de lo
visitado». ☑ hecho

### Séptima advertencia sobre los conteos, y una octava sobre el arranque

- `Plot\b` **no casa «PlotlyChart»**: la frontera de palabra cae dentro del
  nombre. El primer barrido concluyó que ninguno de los tres gráficos restantes
  era Plotly. Un patrón que no encuentra nada puede estar mal escrito.
- **`/api/system/bootstrap` se consume en la primera lectura**
  (`router_sistema.R:213`). Usarlo como sonda de «¿ya arrancó?» se lo come antes
  de que el SPA lo pida, y la app se queda en el BootGate sin que nada falle.
  Para esperar a la API va `/api/system/diagnostic`, que no consume nada.
- Y lo ya anotado: el dev server escucha en **IPv6**, así que `127.0.0.1:5291`
  da 000 y `localhost:5291` da 200.

## E5 — las dos llegadas ☑ hecho (2026-08-27)

El pronóstico corría con **una sola tasa**, la del campo. Ahora dice también a
dónde se llegaría con lo que el diseño pedía de las aulas agendadas, que es el
contraste del ADR 0082.

**No es otra tasa**: es la suma del `expected_valid` de las aulas agendadas, cada
una con su tamaño. Una agenda de tres aulas grandes no es la misma que una de
tres pequeñas, y `tasa × nº de aulas` no distingue las dos. Mismo filtro por
`meta_origen === "diseno"` que E7, misma declaración de cobertura, mismo `null`
en vez de cero.

Un detalle del acumulado que no es obvio: **arrastra los días anteriores aunque
ESE día no traiga vara**. Sin eso, la segunda línea caía a cero al primer día sin
meta y parecía que el diseño había dejado de pedir nada.

**Verificado en pantalla** (`avance > rendimiento`, fixture de campo):

> 3 508 de 2 693 encuestas que el plan espera de las aulas visitadas · con lo
> agendado se llegaría a **3 878**, por encima de esa meta · con lo que el diseño
> pedía de esas aulas, **3 795**

### Dos cosas que sólo se vieron mirando

1. **La cifra desaparecía al pasar la meta.** El texto decía «con lo agendado se
   pasa de esa meta» sin dar el número, así que la llegada del diseño quedaba
   sin par: «se pasa de esa meta · con lo que el diseño pedía, 3 795», y ese
   3 795 solo no significa nada. Las dos se dicen ahora siempre juntas.
2. **`cifrasConFormato` cazó un template literal anidado** dentro de la
   expresión de otro, que escondía sus cifras del escaneo del contrato. El
   contrato tenía razón; la reparación es desanidar, no debilitarlo.

### Y una corrección a la nota de arranque del tick anterior

El **deep-link `?pulso=` es el camino fiable**, no el bootstrap. Con la API
recién arrancada y bootstrap intacto, una recarga dura del SPA aterrizó tres
veces seguidas en el BootGate; con `?pulso=` entró a la primera. El bootstrap
sigue siendo de un solo uso —y sigue sin servir de sonda— pero **no es la vía de
entrada**: la vía es el deep-link.

## Decisiones que esperan a Gonzalo

1. **Cinco del libro de agendación**, abiertas desde el 2026-08-20 en
   `checklist-sinergia-agendacion-2026-08-20.md`: banco en hoja propia ·
   columnas de meta en el bloque · re-armado del plan de Recopiladores ·
   botón del libro en Entrega.
2. **E8**: «Del potencial» y la proyección del banco nombran tasas con
   numeradores distintos. No se renombran sin su palabra.
3. **¿El seguimiento de τ entra en algún entregable interno?**
4. **T8**: qué forma tiene la tabla de avance para el cliente y dónde vive
   —¿PDF de avance, hoja del libro, pantalla?—. Se propone y se confirma.
