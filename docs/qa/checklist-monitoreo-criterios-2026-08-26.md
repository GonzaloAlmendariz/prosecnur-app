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
| **T7** | Las tres dimensiones del libro: leerlas y juzgar si se entienden en campo | `carga_aulas_libro_generar.R` (ya existe, **no se construye**) | C-E | ☐ |
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

## Lo que ya está cerrado y no se rehace

- Seguimiento de τ (ADR 0082): motor, tabla, disparador por margen, backtest
  2025. Ver `seguimiento-tau-campo-2026-08-26.md`.
- Seis listas con cabecera oculta reparadas; contraste WCAG AA medido (594
  elementos, cero incumplimientos).
- **El libro de las tres dimensiones ya existe**: `aulas_libro_hoja_agendadas()`,
  `aulas_libro_hoja_aplicadas()`, `aulas_libro_hoja_control()`, por
  `POST /api/monitoreo/aulas/generar-libro`. T7 lo audita, no lo construye.

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
