# GOAL — Cálculo de muestra: el marco se puede defender

Tipo: Goal operativo (loop de convergencia)
Estado: Abierto
Fecha: 2026-08-15
Autoridad: Objetivo de trabajo medible; **sólo Gonzalo lo cierra**

Abierto el 2026-08-15 a partir de la revisión profunda del módulo, cuyo
inventario vive en `checklist-calc-muestra-2026-08-15.md`. El estado vive en
este documento, no en la conversación.

## Por qué existe

El módulo pasa sus gates: typecheck 0, 1251 tests de frontend, 4573 de R. Y aun
así la revisión encontró un marco que excluía 136.284 filas **sin poder decir
por qué**, una ruta que congelaba la app entera nueve minutos, tres cifras de
calidad que viajaban tipadas sin que ninguna pantalla las leyera, y un test que
llevaba semanas saltándose sin que nadie lo notara.

Ninguno de los cuatro es un bug de cálculo. Los cuatro son la misma cosa: **el
motor acierta y no puede demostrarlo**. Un número correcto que no se puede
explicar no sirve para defender un diseño muestral ante un comité, que es
literalmente para lo que existe este módulo.

Esa es la calidad que persigue este loop, y no se alcanza de una vez: vuelve
cada vez que se añade un criterio, un motor de sorteo o una superficie.

## La vara

Ocho afirmaciones, cada una con cómo se mide. Si no se puede medir, no es vara.

| | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | Toda fila que el marco excluye declara qué la excluyó | Filas de `frame$exclusions` con `exclude_reason` vacío = **0** |
| **V2** | Ninguna operación del módulo bloquea el hilo único | Rutas con costo O(base) que corren síncronas sin gate = **0** |
| **V3** | La π publicada es la del sorteo ejecutado, en todo motor y todo camino | Celdas de la matriz motor × descuento sin test direccional = **0** |
| **V4** | Ningún dato de calidad viaja sin superficie que lo muestre | Campos tipados en `api/calcMuestra.ts` que ninguna vista lee = **0** |
| **V5** | Ningún test del módulo finge cobertura | SKIPs permanentes en la suite = **0** |
| **V6** | El proyecto de referencia reconstruye su marco y cuadra | Elegibles > 0 y reconciliados con el frame guardado o con la razón del cambio |
| **V7** | Las superficies de selección se auditan con dato real | Titulares, Reemplazos y Sustento vistos con una corrida real, contra C1–C5 |
| **V8** | Los archivos congelados no crecen sin declararlo | `sync-agentic-os --audit` verde |

Regla madre, heredada de los loops anteriores y que este no afloja: **primero el
dato, después el gráfico, después el brillo** — con el añadido de que un dato
correcto que no se puede explicar tampoco está entregado.

## La cola

| # | Qué | Vara | Dónde vive | Estado |
|---|---|---|---|---|
| L1 | Las exclusiones del marco declaran su causa | V1 | motor R | ☑ **hecho** (2026-08-15) · mutante: 5 FAIL sin el fix |
| L2 | Línea base de los congelados al día | V8 | `agentic/manifest.json` | ☑ **hecho** (2026-08-15) · `--audit` verde |
| L3 | Construir el marco no congela la app | V2 | router R + motor + frontend | ☑ **hecho** (2026-08-15) · verificado en la app: 177 s de job con el backend respondiendo en 2–57 ms todo el tiempo |
| L11 | El último hito de progreso abarca el 64 % del tiempo | V2 | motor R | ☑ **hecho** (2026-08-15) · 6 hitos → 8, repartidos por coste medido; el mayor baja de 64 % a 47,6 % |
| L4 | El MC secuencial se mide también con `estratificado_aleatorio` | V3 | tests R | ☑ **hecho** (2026-08-15) · mutante: reintroducir el Defecto 1 tira 5 asserts |
| L5 | `composicion_na_n` y el intervalo de elegibles tienen superficie | V4 | frontend | ☑ **hecho** (2026-08-15) · mutantes: 3 de 5 y 3 de 6 tests caen |
| L6 | El test de la base canónica deja de fingir cobertura | V5 | tests R | ⛔ **bloqueado** · ver tabla de decisiones |
| L7 | El marco de referencia reconstruye con elegibles > 0 | V6 | **fixture** (no el motor) | ☑ **hecho** (2026-08-15) · criterio reparado: `faculty` pasa de 0 a 128.018 filas y el marco da **21.362 elegibles** |
| L8 | Titulares, Reemplazos y Sustento auditados con selección real | V7 | frontend + corrida | ◐ **C1–C4 verificados en vacío** · las tres declaran su vacío con causa y salida, 0 desbordes, geometría 100 % declarada. **C5 bloqueado por L14** |
| L14 | El objetivo de cursos-horario no llega nunca a la Selección | V7 | **backend** (persistencia del workspace) | ⛔ **abierto** · el cliente lo envía; el backend lo descarta al normalizar. Sospechoso: la whitelist de persistencia |
| L9 | ~~El impacto de los criterios opcionales no se pinta~~ | V4 | — | ✗ **retirado** · la premisa era falsa, ver abajo |
| L10 | La tasa de Asistencia del agregado es un techo y se lee como observación | V4 | frontend | ☑ **hecho** (2026-08-15) · mutante: 5 de 7 tests caen |
| L13 | El gate de PII lleva rojo por falsos positivos | — | ☑ **hecho** (2026-08-15) · los 5 fixtures pasan; la lista de exentos queda vacía |

### Lo que espera a Gonzalo

| # | Decisión | Por qué no puedo yo |
|---|---|---|

| L14 | Cómo se cierra el traspaso del objetivo de cursos-horario: **(a)** persistir `n_aulas` al calcular —conservador, mantiene la doble llave— o **(b)** que el handoff use el objetivo del motor sin exigir copia —de raíz, pero hay que reconstruir qué caso detectaba la comparación— | La doble llave parece un guard deliberado contra corridas obsoletas. Quitarla sin saber qué protegía reabre lo que cerraba, y este módulo ya tiene historial de fixes que corrigen el feat anterior. Mientras siga así, **C5 de L8 no se puede medir** |
| L6 | Qué se hace con el test `[gated]` de la base canónica: **(a)** versionar una fixture anonimizada, **(b)** documentar `PULSO_CALC_MUESTRA_CANONICO` como gate manual y quitar el fallback muerto, o **(c)** retirar el test | Las tres son defendibles y tienen precios distintos. (a) da cobertura real en CI pero exige pasar la base por el anonimizador, que ya envenenó `hsvg2026` una vez; (c) pierde la única defensa contra la cancelación de errores. Elegir por ti sería decidir cuánta cobertura vale ese riesgo |

## Trampas medidas (no volver a pagarlas)

Cada una costó al menos un intento fallido en esta sesión.

1. **Con la suite de criterios activa, los filtros legacy de alumno NO filtran.**
   `require_adult`, `accepted_conditions` y `require_undergraduate` quedan en
   `TRUE` a propósito (`calc_muestra_aulas.R:1124`, «suite activa ⇒ suite
   manda»). Un test que asuma que edad y criterio de alumno pueden ser causa a
   la vez está escrito sobre un escenario imposible.

2. **El `classroom_id` vacío no produce una fila excluida.** El motor lo deriva
   de curso y horario cuando falta, así que la fila sigue siendo elegible y
   nunca llega a `exclusions`.

3. **La razón de exclusión tiene que nombrar el criterio, no la familia.** Un
   genérico `criterio_alumno` obliga a adivinar cuál de los criterios activos se
   llevó las filas — que es exactamente el problema que L1 vino a resolver.

4. **`testthat::test_dir` con filtro da falsos rojos.** Correr archivo por
   archivo con `test_file`. Locale obligatorio: `en_US.UTF-8`.

5. **El worker `callr` resuelve contra el paquete instalado, no contra
   `load_all()`.** Cualquier test que dispare un job de verdad necesita
   `R CMD INSTALL` antes. Trampa ya pagada dos veces.

6. **El árbol puede estar compartido con otra sesión.** El 2026-08-15 una sesión
   concurrente absorbió cuatro archivos de este trabajo dentro de su propio
   commit (`ce9bd5da`). El contenido llegó íntegro, pero la atribución se
   perdió. Antes de commitear, `git status` y mirar qué es tuyo.

7. **«La misma medición» no siempre es la misma.** El pendiente que originó L4
   pedía repetir con `estratificado_aleatorio` la medición direccional que se
   hacía con `sistematico_pps`. Pero la dirección esperada es **la contraria**:
   con PPS la MOS manda y descontar repetidos mueve la π; con sorteo uniforme la
   MOS no interviene y la π **no se mueve** (medido: 0.5 en las cuatro aulas,
   desvío máximo 0.023 con 400 corridas). Copiar el arnés tal cual habría
   producido un test rojo que parecería un bug del motor. El test correcto es un
   control negativo — y de paso vigila el Defecto 1 del ADR 0066.

8. **Una cifra puede estar mal aunque el número sea correcto.** La asistencia
   del agregado siempre publicó el valor que le tocaba; lo que fallaba era su
   **forma**: se dibujaba como punto siendo una cota, así que una medición
   exacta y un rango ancho se leían igual. Buscar campos ausentes no encuentra
   este defecto — el campo estaba, y en pantalla.

9. **Una superficie sin datos se declara limpia en falso.** Medido en el loop de
   frontend: Sustento llevaba una sesión entera con 0 desbordes porque su
   gráfico no tenía nada que dibujar; al llegar el dato aparecieron cuatro. Por
   eso L8 exige corrida real y no basta con que la pestaña abra.

10. **Llamar al motor no es reproducir el flujo.** Medí A1 invocando
    `calc_muestra_aulas_construir` con la `aulas_config` del `.pulso` y me dio
    21.362 elegibles, así que lo declaré reparado. **Estaba equivocado:** por la
    app, con su suite de nueve criterios, da **0**. La llamada directa se saltó
    justo el criterio que rompe. Un camino que nadie recorre no prueba nada — si
    el defecto se reportó desde la UI, hay que reproducirlo desde la UI.

12. **El tamaño de una salida no predice su coste.** Para repartir los hitos de
    L11 medí primero cuánto publica cada etapa: la radiografía de criterios pesa
    19,5 MB y la del marco 0,6 MB. La cara resultó ser **la pequeña** — 95,4 s
    contra 44,4 s. Un proxy barato puede orientar, pero el reparto se decide
    cronometrando.

11. **Este entorno de sesión no sostiene procesos de larga vida.** El backend R
    murió tres veces tras arrancar —lanzado con `make`, con background del
    harness y con `nohup … & disown`— y se llevó el Vite por delante. Para
    verificar sobre datos reales, llamar al motor directamente funciona; para
    todo lo que exige la app viva (jobs con barra, superficies con selección),
    hace falta una pila que el usuario levante fuera de la sesión.

## L5 · qué se hizo y qué queda

### Hecho: `composicion_na_n` tiene superficie

Es la cifra de cuántas aulas pasaron un gate de composición (c7, c8,
c8_facultad) **sin señal medible**. Los tres gates NA-pasan
(`is.na(x) | x >= umbral`, `calc_muestra_aulas_criterios.R:821`): un
curso-horario sin facultad declarada o sin nivel parseable no se queda fuera,
entra. Eso es deliberado —excluir por falta de dato sesgaría el marco hacia lo
bien registrado— pero deja una cifra que quien mueve el umbral tiene que ver.

Vive ahora dentro de cada paso de `CriterioComposicionCard`, pegada al recorte,
porque responde la misma pregunta: qué hizo este paso con el marco. Sale de
`perfil.opcionales[id].composicion_na_n`, que es del **marco ejecutado** y
**global al criterio** —no por facultad, a diferencia del recorte—, así que no
se recalcula con el foco ni con el preview del borrador.

La regla que la hace honesta: **sin cifra o en cero, no hay línea.** Un 0
dibujado sobre un frame que no trae la clave afirmaría que se midió y no había
ninguno, cuando la verdad es que no se midió. Esa distinción es la que fijan
tres de los cinco tests.

### Hecho: el intervalo `asistencia_elegibles_min/max` se dibuja como intervalo

La asistencia de elegibles **no se observa: se acota**. El techo es
`asistentes − no_elegibles`, y `no_elegibles` son los *detectados* —si el
screening fue parcial, sobran ajenos en el numerador—; el suelo son las
efectivas, gente que seguro estuvo, era del estudio y respondió. El motor
publica las dos cotas desde el ADR 0060 y la barra pintaba **sólo el techo, con
la misma forma que una tasa observada**: un rango ancho y una medición exacta se
leían igual.

`BarraTasa` (primitiva compartida) acepta ahora `cotaInferior`. Con las dos
cotas, la barra pinta sólido hasta lo cierto, tramado hasta el techo, y la cifra
se escribe como rango (`62%–87%`). En la serie semanal el detalle pasa a decir
«entre *efectivas* y *asistentes* de *elegibles*».

Es **aditivo**: sin el prop la barra es la de siempre, y los otros cuatro usos
del módulo no cambiaron. Sólo cambia de forma cuando el intervalo es real —cota
finita y **menor** que el valor—, para que un intervalo degenerado no dibuje un
tramado de ancho cero que insinúe una duda inexistente.

## L10 · el agregado publicaba el intervalo sin decirlo

Apareció al rastrear las cotas de L5, sin buscarlo. En la cadena global del
panel:

- **Asistencia** = `(asistentes − no_elegibles) / elegibles` → es la **cota
  superior**. El propio motor lo comenta: *«la resta es una COTA SUPERIOR, no
  una observación»* (`calc_muestra_asistencia_referencia.R:1872`).
- **Rendimiento** = `efectivas / elegibles` → es exactamente la **cota
  inferior**.

Las dos llevaban rondas en pantalla, una al lado de la otra, sin que nada dijera
que acotan la misma cantidad. Quien leía «Asistencia 87 %» leía un techo sin
tener cómo saberlo.

### Qué se cambió

El chip de Asistencia escribe ahora el rango (`62.0%–87.0%`) y su pie dice por
qué: *«Solo se acota: el suelo son las encuestas completas, el techo descuenta a
los ajenos que se detectaron»*.

**No se tocaron las cifras ni la cadena.** Los cuatro tramos siguen siendo los
mismos y su encadenamiento multiplicativo intacto — unir Asistencia y
Rendimiento en una sola barra habría roto justamente eso, que es la razón de ser
de la cadena. Lo que faltaba no era una métrica: era declarar una relación que
ya existía.

### El guard es la parte que podía salir mal

Afirmar un rango donde no lo hay es peor que el techo suelto de antes, porque
parece más riguroso. Por eso la condición vive en `asistenciaAcotada.ts`, fuera
del panel, donde se puede probar sin montar el payload entero:

1. **Con glosario.** Sin él, «Asistencia» es la bruta sobre matriculados y
   «Rendimiento» no la acota: son dos cantidades distintas, y presentarlas como
   extremos de una sola sería inventar la relación.
2 y 3. **Las dos cifras existen.** Con el desborde del ADR 0060 la tasa viaja
   `null`; media cota no es un rango.
4. **El suelo queda por debajo del techo.** Si coinciden, la cantidad se conoce
   —no se acota—; si se invierten, el payload está sucio.

**Verificado con mutante**: colapsando el guard a `Boolean(asistencia &&
rendimiento)` caen **5 de los 7 tests**, incluido el del suelo en 0 % —una cota
legítima que un `if (!rendimiento)` habría descartado en silencio—.

### Corrección: L9 se retira, su premisa era falsa

Anoté como hallazgo que «el impacto de los criterios opcionales no se pinta en
ninguna superficie». **Es falso y conviene que quede escrito.** La tarjeta de
composición sí lo pinta, y bien: `RecorteDelPaso` publica llegan/quedan/aplicado
por facultad y `EvidenciaPaso` la distribución de la señal con el coste del
corte.

Lo que no se pinta es el objeto `impactoActivar` del **dominio**
(`adaptador.ts:238`), que es otra cosa: el impacto hipotético de *activar* un
criterio, no el efecto del que corrió. Que no tenga superficie puede ser
correcto — alimenta el motor de perfil, no la pantalla.

La lección: grepear un identificador y no encontrarlo en ningún `.tsx` **no
prueba que la capacidad falte**. Prueba que ese objeto no se pinta, que es
distinto. Aquí la superficie existía desde G38–G41 y usaba otra ruta de datos.

## GOAL hermano

La otra sesión abrió el 2026-08-15
`goal-ui-dice-lo-que-el-motor-sabe-2026-08-15.md`, con el mismo patrón —el motor
calcula bien y la superficie no lo declara— pero acotado a **Procesamiento**
(Limpieza, Validación, Codificación). Este GOAL es el de **Cálculo de muestra**.
No comparten archivos; sí conviene mirar el otro antes de tocar V4, porque su
cola resuelve el mismo tipo de problema y lo que se aprenda ahí aplica aquí.

## Corrida real sobre `hsvg2026` (2026-08-15)

Medida sobre el proyecto de referencia abierto tal cual, reconstruyendo el marco
con la config guardada. Base: 136.284 filas × 18 columnas (hoja `MATRICULADO`) +
23.133 de catálogo de curso-horario.

### L7 · reparado (2026-08-15)

El criterio `faculty` del fixture pedía 15 facultades PUCP que su propia base ya
no tenía. `api/scripts/pulso_reparar_criterios_anonimizados.R` lo reescribe
sobre el vocabulario vigente **preservando la intención** —todas las unidades
menos posgrado y consorcio, que el anonimizador dejó reconocibles por sus
palabras genéricas—, sin inventar a qué facultad real corresponde cada nombre de
persona: esa correspondencia se perdió al anonimizar y reconstruirla sería un
fixture que miente.

| | Antes | Después |
|---|---:|---:|
| Filas que pasan el criterio `faculty` | **0** | **128.018** |
| Elegibles del marco | **0** | **21.362** |
| Exclusiones | 136.284 | 30.271 |
| Exclusiones sin causa | 0 | 0 |

Los 21.362 reconcilian con los 21.365 del frame guardado. Resultado en
`outputs/reference-runs/hsvg2026-reparado.pulso`, con marco y selección dentro.

**Nota del contrato `.pulso`:** al reabrir, `population` baja de 21.362 a 238
porque los caches derivables se podan al guardar (es lo esperado, ADR del
`.pulso`). La **selección viaja completa** —2.561 filas, 30 titulares—, que es
lo que L8 necesita.

## Corrección importante (segunda corrida, en la app)

Lo que sigue en «L7 · los dos hallazgos…» se midió **llamando al motor
directamente** con la `aulas_config` guardada en el `.pulso`, y dio 21.362
elegibles. Al repetirlo **en la app**, por el flujo real, el resultado es **0
elegibles y 136.284 exclusiones** — el A1 original, intacto.

La diferencia son los criterios: el flujo de la app construye con una suite de
nueve criterios activos que mi llamada directa no reprodujo. **La conclusión del
turno anterior («A1 ya estaba reparado») era incorrecta**, y la corrida en la app
es la que manda: el camino que usa una persona es el que cuenta.

### L7 · causa raíz, encontrada en 5 segundos gracias a L1

El diagnóstico completo, leído del marco que la app acaba de construir:

```
criterios_alumno_report:  faculty:0  condition:124167  formation:125003
                          age:123360  level:136284
```

**El criterio `faculty` deja pasar 0 filas.** Los otros cuatro dejan pasar entre
123.000 y 136.284. Y el porqué:

| | |
|---|---|
| El criterio pide | `estudios_generales_letras`, `ciencias_e_ingenieria`, `derecho`, `psicologia`, `educacion`… (las 15 facultades reales) |
| La base contiene | `"Andres"`, `"Nestor DE Ricardo Diana"`, `"Karina, Karina Y Karina"`, `"Nestor DE POSGRADO"` |

**Es un defecto del fixture, no del motor.** El anonimizador reemplazó los
nombres de facultad por nombres de persona y **no tradujo el criterio guardado**
en `criterios_seleccion`, que sigue listando las facultades reales. El proyecto
de referencia quedó internamente inconsistente consigo mismo. El motor hace lo
correcto: si el criterio exige 15 facultades y ninguna existe, no pasa nadie.

Es exactamente el hallazgo #3 que el loop v2 ya había anotado —«el anonimizador
deja base, config, catálogo y componentes en vocabularios distintos»— y que
seguía sin reparar.

**Por qué esto valida L1 mejor que cualquier test.** Antes, esas 136.284
exclusiones se publicaban mudas: la pantalla sólo podía decir «se cayeron
136.284», indistinguible de un bug de mapeo que tiró la base entera. Hoy el
marco dice `faculty` en el 100 % de ellas y el diagnóstico tardó una consulta.

### Qué desbloquea L7 (y con él L8)

Regenerar `hsvg2026` con un anonimizador que traduzca **también** los criterios
guardados, o corregir el criterio del fixture para que hable el vocabulario de
su propia base. Cualquiera de las dos exige la sal del anonimizador y decidir
qué se versiona — por eso queda como decisión, no como tarea.

### L7 · medición previa (llamada directa al motor, superada por la de arriba)

| Métrica | Ledger v2 (2026-08-02) | Medido hoy | Veredicto |
|---|---:|---:|---|
| Elegibles al reconstruir | **0** de 29.083 | **21.362** | reconcilia con los 21.365 del frame guardado (−3) |
| Exclusiones que declaran su causa | **0** de 136.284 | **30.271 de 30.271** | 0 mudas |

Las razones que publica el marco reconstruido, por frecuencia: `age` (10.426),
`level` (6.493), `condition` (6.090), `condition|level` (2.977),
`age|condition` (2.474), `level|modality` (1.211), y cuatro combinaciones más.
Es exactamente lo que L1 vino a hacer posible: antes esas 30.271 filas se
publicaban sin poder decir qué se las llevó.

**A1 no era lo que parecía.** El ledger registró 0 elegibles con
`excluded_rows = 136.284`; hoy el mismo proyecto con la misma config da 21.362.
El hallazgo se resolvió en algún punto entre el 2026-08-02 y hoy —lo más
probable, en los arreglos de criterios de agosto— y nadie lo volvió a medir.
Vale como recordatorio: **un hallazgo viejo sin volver a medir no es un
hallazgo, es una hipótesis.**

### L3 · cerrado en la app, con la pila real

Pulsando «Calcular población y cursos-horario elegibles» sobre `hsvg2026`:

| | |
|---|---|
| Respuesta de `marco/construir` | `mode: "job"`, `job_id`, `input_rows: 136284` |
| Latencia de esa respuesta | **2,4 s** (sólo la lectura de tablas, que se queda en el router a propósito) |
| Duración del job | **176,8 s** hasta `status: "done"` |
| **Salud del backend durante esos 177 s** | **HTTP 200 en 2–57 ms**, sondeado cada 3–10 s sin una sola caída |

Esa última fila es L3 entero: antes, esos 177 segundos habrían sido 177 segundos
con Plumber monohilo bloqueado y la app entera muerta.

Transiciones de progreso observadas por el cliente:

```
 0/0  Trabajando…                      t=  5 s
 1/6  Leyendo la base institucional    t=  9 s
 2/6  Depurando elegibles              t= 37 s
 4/6  Aplicando criterios del marco    t= 59 s
 5/6  Perfilando el marco              t= 61 s
 6/6  Radiografía por facultad         t= 63 s  →  done t=177 s
```

### L11 · repartido por coste, medido a escala real

Ocho hitos en vez de seis. El reparto ya no sale de las etapas del código sino
del tiempo que cuesta cada una, medido sobre `hsvg2026` (5.263 CH, 200 s):

| Etapa | Tiempo | % |
|---|---:|---:|
| 6/8 Radiografía del marco | **95,4 s** | **47,6 %** |
| 7/8 Radiografía por criterio y facultad | 44,4 s | 22,1 % |
| 1/8 Leyendo la base institucional | 28,3 s | 14,1 % |
| 2/8 Depurando elegibles | 22,4 s | 11,2 % |
| 4/8 Aplicando criterios del marco | 6,3 s | 3,2 % |
| 5/8 Perfilando el marco | 2,5 s | 1,2 % |
| 3/8 Agrupando cursos-horario | 1,0 s | 0,5 % |
| 8/8 Impacto del tipo de sesión | 0,1 s | 0,0 % |

El hito mayor baja del 64 % al 47,6 %, y las dos radiografías dejan de ser
indistinguibles.

**Queda margen, y está localizado:** ese 47,6 % vive entero dentro de
`.cm_exploracion_adjuntar`. Partirlo exige instrumentar esa función por dentro
—vive en `calc_muestra_aulas_exploracion.R`, que no está congelado— y
propagarle el callback. Es el siguiente paso natural si la barra sigue
pareciendo parada.

### Hallazgo previo (L11): el progreso estaba mal repartido

El hito **6/6 dura 114 s de los 177 — el 64 % del tiempo**, con la barra clavada
al final. Para quien mira, la construcción parece colgada justo cuando más
avanzada está. El hito 3/6 tampoco se llegó a ver: dura menos que el intervalo
de polling (2 s), lo cual es correcto y no es defecto.

El reparto de hitos se eligió por **etapas del código**, no por **coste**. La
radiografía por facultad es, con diferencia, la más cara, y merece subdividirse.
Queda como L11.

## L13 · el gate de PII vuelve a ser informativo

Llevaba rojo en dos fixtures por **PII falsa**: `hsvg2026` con 204.928 correos y
`acrconta` con 842, todos seudónimos emitidos antes de que el anonimizador
marcara el dominio con `.example.test`. Tenían forma de correo real
(`carla.valdiviaf4f@pucp.edu.pe`) y el detector no podía distinguirlos, así que
había dos fixtures **exentos del gate entero** por una lista de excepciones.

Lo que los distingue es el **local-part**, que no cambió entre versiones del
anonimizador: `nombre.apellido` + 3 hex, con nombre y apellido de dos catálogos
**cerrados** (32 × 26). No es una heurística de forma sino la firma del propio
emisor, y la regla se construye desde sus catálogos —no desde una copia—, así
que si mañana se amplían, los sigue.

**Lo que no afloja:** la comprobación es por valor, no por columna. Un correo
real que sobreviva entre seudónimos no lleva esa firma y se marca igual — que es
exactamente el caso que el detector existe para atrapar, y el que una exención
por columna habría dejado pasar.

| | Antes | Después |
|---|---:|---:|
| Fixtures que pasan el gate | 3 de 5 | **5 de 5** |
| Fixtures exentos del gate | 2 | **0** |

Tres regresiones fijan la frontera: que los seudónimos de ambas épocas se
reconozcan, que un correo real mezclado con ellos se siga marcando, y seis casos
que rompen cada condición de la firma por separado (nombre fuera de catálogo,
apellido fuera, sufijo no hex, de 2, de 4, y sin anclar al inicio).
**Verificado con mutante**: quitando el ancla y relajando el sufijo a `{2,4}`,
el test de la frontera cae.

## L12 · la causa, no el síntoma

El anonimizador reescribía los valores de las tablas y dejaba intactas las
DECISIONES que nombran esos valores. Datos seudonimizados + criterios reales = 0
elegibles, y el fixture incapaz de reproducir su propio marco.

Ese defecto se diagnosticó **dos veces como bug del motor**: la primera sesión
lo anotó como «limpiar criterios antes de construir» —un workaround sobre el
síntoma— y sólo la segunda llegó hasta la anonimización. Hoy se cierra en el
emisor: `pulso_anonimizar_criterios.R` traduce las categorías de toda suite de
criterios usando el mismo diccionario que seudonimizó los datos.

Tres decisiones de diseño que valen más que el código:

- **Se busca por forma, no por ruta.** El estado guarda la suite en más de un
  sitio (el marco construido y la config del workspace) y una lista de rutas
  quedaría desactualizada al primer módulo que persista la suya. Mismo criterio
  que el recorrido de tablas, que ya buscaba «todo data.frame en cualquier
  profundidad».
- **La traducción es por `text_key`.** El criterio guarda `ciencias_e_ingenieria`
  y el diccionario mapea `CIENCIAS E INGENIERIA`: se normalizan los dos lados.
- **Una categoría que el diccionario no conoce se deja intacta.** Puede ser una
  dimensión que el anonimizador no tocó; sustituirla por nada la convertiría en
  un criterio que no filtra, y eso cambia el marco en silencio — peor que
  dejarla.

El reporte publica `n_criterios_traducidos`, que es lo primero que hay que
mirar cuando un fixture anonimizado no reproduce su marco.

## L14 · el objetivo del motor no llega a la Selección

Encontrado al intentar cerrar L8 con dato real, y es lo que lo bloquea.

Las tres superficies de Selección se quedan en «La selección existe; falta
acreditar el objetivo» **por más que calcules**. No es un paso que falte
recorrer: la condición es inalcanzable.

| | |
|---|---|
| Motor: `resultado.aulas_base_total` | **200** |
| Motor: `resultado.aulas_total` | 302 (200 base + 102 extra) |
| `expectedTarget` derivado (`classroomHandoff.ts:291`) | **200** ✓ |
| `aulas_config.n_aulas` persistido | **ausente** — `aulas_config` es `{}` |
| `currentAulasTarget` resultante | **0** → bloqueo |

El handoff **ya lee el objetivo del motor**, y aun así devuelve 0, porque exige
además una copia persistida que coincida:

```ts
const persistedTarget = safeNumber(workspaceConfig?.n_aulas, 0);   // ausente -> 0
const currentAulasTarget = persistedTarget > 0 && persistedTarget === expectedTarget
  ? persistedTarget : 0;
```

**Y nadie escribe esa copia.** La única superficie que podría —«Cursos-horario
requeridos»— declara *«esta vista no reconstruye estadísticas ni aulas en
React»* y no tiene un solo botón. Así que `persistedTarget` se queda en 0 pase
lo que pase.

Es la familia de L1/L5/L10 un escalón más arriba: no es que falte mostrar un
número, es que la cifra correcta está a un `resultado.aulas_base_total` de
distancia y el handoff exige una llave que nadie fabrica.

### Intento fallido de la vía conservadora (2026-08-15)

Se probó y **no bastó**. Queda escrito porque descarta la hipótesis más obvia y
ahorra repetirla.

El mecanismo que debía persistir el objetivo **ya existe**:
`reconcileUniversityAulasTarget` escribe `aulas_config.n_aulas` con
`resultado.aulas_base_total`, y se llama justo después de calcular. Lo que
fallaba parecía ser su guard: `registrarCorridaDeCalculo` decidía si el proyecto
es universitario con `normalizedWorkspace.frame_mode === "opinion_universitaria"`,
mientras que el cálculo, tres líneas antes, lo decide con `inferDesk(...)`.

**Y los dos discrepan en `hsvg2026`**: su `frame_mode` es `sin_definir` y
`inferDesk` lo reconoce como universitario por `macro_familia`
(`encuesta_estudiantes` + componentes). Dos criterios para la misma pregunta, y
el de la reconciliación es el estrecho.

Se unificó a `inferDesk` en los dos call-sites, se recargó la app y se
recalculó: **`aulas_config.n_aulas` sigue AUSENTE** con `aulas_base_total = 200`
disponible en el resultado. El cambio se revirtió por no estar verificado.

**Instrumentado el 2026-08-15: es la hipótesis (2).** El log de
`reconcileUniversityAulasTarget` durante un recálculo real:

```
[L14] {"n_componentes":2, "selected":"Muestra con representatividad a nivel universidad",
       "hasUseful":true, "aulas_base_total":200, "target":200, "n_aulas_previo":200}
```

Todo correcto en el cliente: encuentra el componente, `hasUsefulResult` es
`true`, calcula `target = 200` — y `n_aulas_previo` **ya vale 200**, o sea que
el workspace en memoria lleva el objetivo bien puesto. Quedan descartadas (1) y
(3).

Y el matiz que precisa el defecto: consultado en el mismo instante,
`GET /api/calc-muestra/state` devuelve `aulas_config` con **cero claves**. No es
que llegue con `n_aulas` ausente: es que llega **vacío del todo**.

Eso descarta también que el backend lo filtre.
`.cm_normalize_workspace_aulas_config` (`calc_muestra_engine.R:467`) conserva
`n_aulas` cuando viene, y ante cualquier objeto devuelve ~15 claves con sus
defaults; sólo devuelve `list()` cuando recibe **NULL**. Así que el backend
nunca vio el `aulas_config`.

**Corrección (misma sesión): el envío está bien; el defecto es del backend.**

Interceptado el autosave, el POST `/api/calc-muestra/estudio` manda
`aulas_config` con **56 claves y `n_aulas = 200`**. El cliente cumple.

Prueba directa, enviando el objetivo a mano y leyendo la respuesta:

| | |
|---|---|
| Enviado en el POST | `n_aulas = 200` |
| Respuesta del POST | `aulas_config` con **55 claves**, `n_aulas` **AUSENTE** |
| `GET /state` acto seguido | `aulas_config` con **0 claves** |

El backend recibe el objetivo, normaliza el bloque —devuelve sus 55 claves con
defaults— y **descarta `n_aulas` por el camino**.

Ojo con la lectura ingenua del código, que me costó un turno:
`.cm_normalize_workspace_aulas_config` (`calc_muestra_engine.R:622`) SÍ tiene una
rama que conserva `n_aulas`, así que leerla aislada convence de que el campo
sobrevive. No sobrevive: algo posterior lo descarta. El sospechoso es la
whitelist de persistencia del workspace, que ya mordió antes en este repo y que
exige registrar los campos nuevos uno a uno.

Siguiente paso: encontrar esa whitelist y comprobar si `n_aulas` falta en ella.
Si es eso, el fix es una línea — y explica por qué el objetivo nunca llegó a la
Selección por más que se calculara. Lo siguiente es mirar
qué payload arma el autosave del workspace — si omite `aulas_config`, si
`setWorkspaceSiCambia` no dispara guardado, o si una escritura posterior lo pisa
con el workspace anterior.

Hipótesis originales, conservadas para el registro:

1. `universityComponentForScenario` no encuentra el componente esperado, así que
   `reconcileUniversityAulasTarget` calcula `target = undefined` y **borra**
   `n_aulas` en vez de escribirlo (su rama `target == null` quita la clave).
2. `setWorkspaceSiCambia` no llega a persistir —el autosave del workspace no se
   dispara, o lo pisa una escritura posterior—.
3. `hasUsefulResult(selected)` devuelve `false` pese a que el componente trae
   resultado con `aulas_base_total`.

La forma barata de separarlas es instrumentar `reconcileUniversityAulasTarget`
con un log del `target` que calcula, recalcular una vez y mirar: si sale
`undefined`, es (1) o (3); si sale 200 y no se persiste, es (2).

### Por qué no lo arreglé de raíz

La lectura obvia —`persistedTarget` sobra, si `expectedTarget` ya viene del
motor— es probablemente correcta, pero **esa doble llave parece deliberada**:
huele a guard contra corridas obsoletas. Quitarla sin entender qué protegía
reabre lo que ese guard cerraba, y este módulo ya tiene historial de fixes que
corrigen el feat anterior.

Dos caminos, y la diferencia es de contrato:

- **Conservador**: persistir `n_aulas` al calcular. Mantiene la comprobación y
  llena el hueco. Menor riesgo, deja la doble llave en pie.
- **De raíz**: que el handoff use el objetivo del motor sin exigir copia. Más
  limpio, pero hay que reconstruir primero qué caso detectaba la comparación.

### Lo que sí quedó verificado de L8

Con la selección real generada (2.561 filas: 30 titulares, 330 reemplazos en
cadena, 2.201 de pool), las tres superficies pasan lo verificable sin dato:

| | Titulares | Reemplazos | Sustento |
|---|---|---|---|
| Desborde horizontal | 0 | 0 | 0 |
| Grupos de geometría | 1 | 1 | 6 |
| Sin contrato declarado | **0** | **0** | **0** |
| `data-audit-ready` | ✓ | ✓ | ✓ |
| Vacío con causa y salida | ✓ | ✓ | ✓ |

C1–C4 se cumplen. **C5 —que la superficie entregue lo que promete— sigue sin
poder medirse**, y es exactamente lo que la trampa 9 advierte: una superficie
sin datos se declara limpia en falso.

### La cadena real del módulo, que no estaba escrita

Descubierta a golpe de dos reconstrucciones de ~4 min:

```
marco → decisión de Alumnos por CH → RECONSTRUIR marco → calcular → seleccionar
```

Reconstruir el marco invalida el cálculo, así que firmar la decisión después de
construir obliga a rehacerlo todo. El guard que lo detecta funciona bien
(`decision_stale`), pero el orden no lo dice ninguna superficie.

### Hallazgo de propina: «Cálculo completado» sobre un 409

Al pulsar «Calcular muestra» con la decisión sin firmar, la pantalla mostró
**«Cálculo completado: 2 componentes»** mientras el endpoint respondía
`409 E_CALC_MUESTRA_ALUMNOS_CH_DECISION` y el componente quedaba con
`resultado: null`. La franja sí marcaba «resultado inválido», así que la UI se
contradice a sí misma en la misma pantalla. Es el hallazgo #1 del ledger v2
—«`calcular` devuelve 200 con resultado vacío»— visto desde la UI, que es peor:
el usuario lee éxito donde hubo error.

## Ledger

| Métrica | Apertura (2026-08-15) | Hoy | Dirección |
|---|---:|---:|---|
| Exclusiones del marco sin causa declarada | **todas** (`exclude_reason` vacío en el camino de criterios de alumno) | **0** | = 0 |
| Rutas con costo O(base) sin gate sync/job | **1** (`marco/construir`) | **0** | = 0 |
| Celdas motor × descuento con test direccional | 2 de 3 | **3 de 3** | = 3 de 3 |
| Campos de calidad tipados sin superficie | **3** | **0** | = 0 |
| SKIPs permanentes en la suite del módulo | **1** | 1 | = 0 |
| Archivos congelados por encima de su línea base | **1** | **0** | = 0 |
| Tests del módulo (R) | 64 archivos · 4573 PASS | **66 archivos · 4616 PASS** | crece con cada ítem |
| Tests del módulo (vitest) | 142 archivos · 1251 PASS | **145 archivos · 1269 PASS** | crece con cada ítem |
| Cifras publicadas como punto siendo una cota | **2** (agregado y serie semanal) | **0** | = 0 |
| Elegibles al reconstruir `hsvg2026` **en la app** | **0** de 29.083 (ledger v2) | **0** (causa raíz identificada: fixture) | > 0 y reconciliados |
| Exclusiones de `hsvg2026` con causa declarada | **0** de 136.284 | **136.284 de 136.284** | todas |
| Rutas O(base) verificadas sin bloquear la app | 0 | **1 de 1** (`marco/construir`, 177 s) | todas |

## Cómo se corre cada visita

```bash
node agentic/sync-agentic-os.mjs --audit
pnpm -C frontend exec tsc --noEmit --pretty false
pnpm -C frontend exec vitest run src/features/calcMuestra
```

R del módulo, archivo por archivo (nunca `test_dir` con filtro):

```bash
Rscript -e 'Sys.setlocale("LC_ALL","en_US.UTF-8"); pkgload::load_all("api", quiet=TRUE); for (f in list.files("api/tests/testthat", pattern="^test-.*calc-muestra.*\\.R$", full.names=TRUE)) print(testthat::test_file(f, reporter="silent"))'
```
