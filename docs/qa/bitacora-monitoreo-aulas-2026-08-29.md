# Bitácora del trabajo en Monitoreo de aulas

Tipo: Bitácora de trabajo
Estado: Histórico
Consolidado en: [Loop definido de Monitoreo de aulas](checklist-loop-definido-aulas-2026-08-28.md)
Fecha: 2026-08-29
Autoridad: Registro de iteraciones; no reemplaza un ADR

**Por qué existe.** Gonzalo, 2026-08-29: «no te estás planteando un plan de
acción ni nada, qué es lo que vas a hacer, en qué pasos, qué es lo que ya vas
haciendo, qué encontraste; no estás registrando qué has hecho en cada iteración
y qué queda pendiente para la siguiente». Tenía razón: lo llevaba en un archivo
de trabajo que él no ve.

**El norte**, suyo y textual: **que todas las facultades cumplan con su cuota de
sexo.** Todo lo de abajo se juzga contra eso.

## Regla que me falta y adopto aquí

**Ningún cambio se declara hecho sin haberlo visto.** Hasta hoy entregué con
typecheck y tests verdes pero sin abrir la pantalla, y él lo señaló. La forma
que uso —y que queda escrita para no reinventarla— es:

```bash
node scripts/ui-quick-check.mjs --project outputs/simulacros/campo_malo.pulso \
  --route "/monitoreo?seccion=avance&pestana=<tab>" --viewport 1440x1600 \
  --wait-selector "<clase del elemento nuevo>" --timeout-ms 180000
```

El `--wait-selector` es lo que faltaba: sin él la captura sale antes de que
Plotly pinte y la imagen engaña.

## Iteraciones

### 2026-08-29 · tarde

| # | Qué hice | Qué encontré | Estado |
|---|---|---|---|
| 1 | Abrir sus tres simulacros en vez de mi fixture | El derivado no tenía campo; los suyos sí. Gradiente de 1 · 13 · 23 celdas que piden aula del banco | visto |
| 2 | Medir la dispersión real del rendimiento | 2,78 · 3,62 · 4,44 netos del sesgo. La probabilidad saturaba en 0/100 | visto |
| 3 | Corregir la probabilidad con esa dispersión | De 2 valores intermedios a 7 de 18 | **sin ver** |
| 4 | Decimales en personas | «236.1 respuestas» → 244. Segunda vez que lo señala | **sin ver** |
| 5 | El gráfico de estratos usaba el sexo DOMINANTE DEL AULA | Cambiado a facultad × sexo del alumno, en tres tramos | **sin ver** |
| 6 | La fecha salía del parte, vacío en los 152 | Sale de la plataforma: 151 aulas, once días. Revive serie, ritmo, pronóstico y corte | **sin ver** |
| 7 | Cuotas abre Avance | Lo pidió él | **sin ver** |
| 8 | El parte llegaba con 13 de 14 campos vacíos | Claves en español en el estado, en inglés en el publicador. Ahora 5 de 14 | **sin ver** |
| 9 | El avance por facultad no conocía el sexo | Ahora cada fila dice de qué lado va corta | **VISTO** |
| 10 | Capturar Resumen con `--wait-selector` | El ritmo diario está vivo: «1.538 respuestas en 11 días de campo», barras del 7 al 18/9. Antes vacío | **VISTO** |
| 11 | En esa captura: «139,8 al día» | Decimal en respuestas, **tercera vez en el día**. Ahora «140 al día» | **VISTO** |
| 12 | En esa captura: «397 respuestas faltan · faltan 31 mujeres · 114 hombres» | 31+114=145, no 397. Dos varas sin declarar: el total va contra la meta del PLAN y las celdas contra la CUOTA. Ahora «para su cuota, faltan 31 mujeres y 114 hombres» | **VISTO** |

**Nueve cambios y siete sin verificar en pantalla.** Eso es exactamente lo que
él señaló, y es la deuda que se paga primero.

**Y en cuanto miré, la captura encontró dos defectos que ningún test habría
cazado** (11 y 12). Los dos son de la misma familia que él ya había señalado:
decimales en personas, y un rótulo que promete un número distinto del que
entrega. Eso zanja la discusión: mirar no es una comprobación de cortesía, es
donde aparecen los defectos que las suites no ven.

### 2026-08-29 · noche

| # | Qué hice | Qué encontré | Estado |
|---|---|---|---|
| 13 | Su aviso: «el avance se mide sobre las cuotas, no sobre lo pronosticado» | La meta publicada era **3.145,7** (suma de `expected_valid`) frente a una cuota de **2.500**. CIENCIAS E INGENIERIA decía «faltan 397» cuando faltan **232** | **VISTO** |
| 14 | Cuadrar las partes con el total | **Primer caso REAL del agregado engañando**: GASTRONOMÍA, mujeres 10 de 12 y hombres 14 de 9, se publicaba con «cero faltan» y faltaban 2 mujeres. La brecha pasa a ser la suma de celdas | **VISTO** |
| 15 | Capturar el gráfico de facultad × sexo | Funciona: tres tramos, sexos juntos por facultad, sin decimales | **VISTO** |
| 16 | Comprobar que los tres tramos sumen la cuota | **6 de 30 celdas se pasan** y el gráfico no marcaba la meta. Añadida la marca de cuota | **VISTO** |

| 17 | Capturar Cuotas | «aportan 6.1» — **su frase literal, cuarta vez el mismo defecto**. Barrido del payload: `aporte_pendiente`, `proyeccion` y `expected_valid` siguen fraccionarios en el motor a propósito (son esperanzas), pero ningún sitio los imprime crudos | **VISTO** — recapturado: «aportan 18», «aportan 7» |
| 18 | Revisar la barra de secciones | **Avance es la última de cinco** (Fuentes · Agenda · Validación · Consultas · Avance). Cuotas abre Avance, pero la sección va al final | **abierto, es decisión suya** |

| 19 | Capturar Consultas | Los partes ya traen aplicador, asistentes, efectivas y fecha. **Y el embudo decía «de 4.386 quedaron 4.386 · 100 %»** sobre dos pasos que nadie anota, acusando además al equipo de un descuadre de 2.791 que era el hueco | **VISTO** — `5cb20112` |
| 20 | Barrer el payload buscando el patrón | `partes_campo` 9 de 14 campos vacíos · `control_calidad` 5 de 10 · `agenda` 56 de 98 · **`avance_sexo_facultad` 0 de 16** | medido |
| 21 | Capturar la base de control, que usa los booleanos vacíos | **Ya está bien resuelta**, y es el estándar: «304 sin evaluar en el libro… se llenan en el Excel del equipo y vuelven al importar» | **VISTO**, sin cambio |

### 2026-08-29 · noche, segunda tanda

| # | Qué hice | Qué encontré | Estado |
|---|---|---|---|
| 22 | Capturar Rendimiento | «Pedir 33 · Banco S/D · **Cubren 25**» — la columna no hablaba del banco, son las que *bastarían*. Renombrada | **VISTO** `5e9501f5` |
| 23 | Ir a verificar la banda de anoche | **No se podía llegar**: la facultad elegida era un `useState` suelto y no viajaba en la URL, contra la regla de la casa | **VISTO** `241d68bb` |
| 24 | Con el foco ya enlazable, mirar la banda | **Era invisible** al 13 % de opacidad sobre las barras grises. Subida al 24 % con borde | **VISTO** `1d30a9f8` |

La cadena de 23 y 24 es la que más dice de cómo trabajaba: entregué la banda
anoche sin verla, **no había manera de verla** porque la vista no era
alcanzable, y sólo salió al obligarme a capturar todo. Dieciocho horas de algo
entregado y roto sin que ningún gate pudiera avisar.

### 2026-08-29 · rendimiento del tablero

Ataqué el coste de verificar, que es lo que me llevaba a no mirar: una captura
tardaba de tres a nueve minutos porque el tablero se reconstruye entero en cada
petición.

| # | Hipótesis | Resultado |
|---|---|---|
| 25 | El plan se normaliza dos veces por tablero | **✓ 5,4 → 3,9 s** `d5435ecd` |
| 26 | Marcar el plan normalizado con un atributo | ✗ se pierde al convertir a data.frame |
| 27 | `reserva_por_celda` recorre el banco por celda | ✗ **el banco son 77 aulas, no 1.173**; la función tarda 0,05 s |
| 28 | El plan se convierte a registros dos veces | **✓ 3,9 → 3,3 s** `f3c06734` |
| 29 | Partir el normalizador para evitar el viaje redondo | ✗ 0,04 s sobre 5 corridas: ruido |

**5,4 → 3,29 s, un 39 % menos.** Tres de cinco hipótesis falsadas, y las tres
por medir en vez de creerme el diagnóstico.

**La trampa que costó dos de ellas**: `Rprof` atribuye el coste de un argumento
perezoso a la función que lo recibe. `reserva_por_celda` salía como el 17,7 %
del tablero cuando medida aparte tarda 0,05 s — el resto era la conversión del
argumento. Antes de optimizar lo que el perfil señala, medir esa función sola.

**Y la segunda**: comparar una corrida contra otra no distingue nada cuando el
rango va de 3,2 a 3,9 s. Hay que comparar medianas de cinco corridas contra la
línea base revertida con `git stash`.

### 2026-08-29 · las capturas que faltaban

| # | Qué hice | Qué encontré | Estado |
|---|---|---|---|
| 30 | Capturar `modelo/facultad` | «A dónde ir cada día» está bien resuelta. **Sin defecto**, y lo digo en vez de fabricar uno | **VISTO** |
| 31 | Capturar `avance/efectividad` | La mejor superficie del perfil, y **ya trataba la incertidumbre con intervalos** (± 6, ± 8, ± 27 pts). Corregí mi propuesta de fundirla | **VISTO** |
| 32 | Capturar `consultas/reemplazos` | «META 24.6» y «18 de 24.6». **Quinta vez el decimal** | **VISTO** `48e4a1a1` — recapturado: «META 25», «18 de 25» |

**Por qué la quinta se escapó**, que es lo que importa: el mecanismo existía
—`COLUMNAS_DE_CUENTA` redondea `expected_valid` al pintar, desde el 23 de
agosto— pero esa tabla muestra una `meta` **derivada**, con otra clave y fuera
de la lista, y además dentro de un texto donde ningún formateador de columna
llega. Es el patrón de la lista cerrada: sólo protege lo que alguien recordó
registrar.

## El patrón de los seis defectos

Los seis que aparecieron al mirar tienen la misma forma: **algo ausente
presentado como algo medido.**

| dónde | la ausencia | se leía como |
|---|---|---|
| reserva dirigida, ritmo, brecha, aporte | — | decimales de persona |
| perfil por facultad | dos varas sin declarar | un total que no cuadraba |
| avance por facultad | la cuota de sexo | «cero faltan» con 2 mujeres cortas |
| gráfico de cuotas | la cuota | seis celdas pasándose sin verse |
| probabilidad de cierre | la dispersión | 0 % o 100 % y nada en medio |
| embudo del parte | rechazos y duplicados | 100 % de conversión |

Y el contraejemplo, que es el estándar: la **base de control** dice «304 sin
evaluar en el libro» y explica cómo se llenan. Ninguno de los seis lo hacía.

## Lo que aprendí hoy sobre mi propia forma de trabajar

1. **Arreglar donde se ve, no barrer.** El decimal salió cuatro veces porque las
   tres primeras lo corregí en el sitio señalado. Un defecto que reaparece es un
   barrido pendiente.
2. **Los gates verdes no ven lo que importa.** Cuatro defectos hoy —decimales,
   un total que promete otro número, una facultad con «cero faltan» y dos
   mujeres cortas, seis celdas que se pasan sin poder verlo— con typecheck y
   2.049 tests en verde.
3. **Medir la premisa antes de construir sobre ella.** El avance se medía contra
   el pronóstico (3.145,7) y no contra la cuota (2.500). Construí encima durante
   horas sin comprobarlo.

## Pendiente para la siguiente iteración

1. **Ver los siete.** Una captura por pestaña tocada, con `--wait-selector`.
2. Su respuesta sobre la estructura de Avance
   (`auditoria-avance-aulas-2026-08-29.md`): retirar Estratos, fundir
   Efectividad, y las dos nuevas —Decisiones y Calendario—.
3. El registro académico de las etiquetas (ítem 12 del checklist), con el mapeo
   propuesto y sin aplicar.

---

## 33 · CORREGIDA — no eran dos cuentas de lo mismo, era un rótulo mentiroso

Capturas: `tmp/visual-qa/quick/2026-08-29T16-47-20-544Z/` (con Plotly pintado) y
`…T16-58-23-693Z/` (alto completo). Proyecto: `aulas_con_respuestas.pulso`,
714 registros, 667 válidas.

En la MISMA pantalla (`monitoreo/aulas/avance/estratos`):

- La tarjeta **«Cierran con lo agendado: 0 de 30 celdas sexo × facultad con
  objetivo»**.
- El gráfico **«Avance por facultad y sexo»**, que dibuja esas mismas 30 celdas,
  enseña **seis o siete sin déficit** —DERECHO·Hombres, CIENCIAS E
  INGENIERÍA·Mujeres, GESTIÓN·Hombres, ARTE Y DISEÑO·Hombres, LETRAS Y CIENCIAS
  HUMANAS·Hombres, ESTUDIOS GENERALES CIENCIAS·Mujeres—. La etiqueta numérica se
  omite a propósito cuando el déficit es cero, así que «sin número» ES «cierra».
- Su pie: «quedaría un déficit de 271 respuestas, repartido en 15 facultades»,
  **sin** la frase «N alcanzan su cuota en los dos sexos», que sólo se imprime si
  hay alguna. O sea: 0 facultades cubiertas en AMBOS sexos, que es compatible con
  6 celdas cerradas y no con 0.

**La causa: cada superficie lo calcula por su cuenta, y de fuentes distintas.**

| | Fuente | Dónde se calcula |
|---|---|---|
| Gráfico | `dashboard.avance_sexo_facultad` | backend, `monitoreo_aulas_avance_sexo_facultad()` sobre el **plan** (aplicada/pendiente) |
| Tarjeta | `proyeccionPorAgenda(agenda, parteDeCampo(partes_campo, agenda), quotas_sex_faculty)` | frontend, `kpisDeAulas.ts:263` |

Dos agravantes:

1. La tarjeta mete el **parte de campo**. Gonzalo, esta semana: «lo que contamos
   son las efectivas en plataforma… lo que se registra en campo es una cosa,
   pero lo que a nosotros nos importa es lo que sale en la plataforma».
2. El backend ya escribió la regla que esto rompe, en
   `monitoreo_aulas_universitarias.R:1894`: «No se recalcula nada: se toman las
   celdas que `monitoreo_aulas_avance_sexo_facultad()` ya produjo unas líneas
   arriba. **Dos lecturas del mismo dato acabarían discrepando.**»

**Reparación (siguiente tick):** `cierreKpi()` cuenta sobre
`dashboard.avance_sexo_facultad` —`cuota > 0` como evaluables,
`ceil(brecha − 1e-9) <= 0` como cerradas— en vez de rearmar la proyección. NO se
toca `proyeccionPorAgenda`, que tiene otros consumidores. Los seis tests de
`kpisDeAulas.test.ts:247-300` cambian de fixture; **hay que conservar el mutante
que matan**: una celda con `cuota = 0` no cuenta como cerrada ni infla el
denominador (el defecto real «10 de 30» con cero aulas agendadas). Y añadir el
test que faltaba: las dos superficies dan el mismo número sobre el mismo payload.

## 34 · El runner dio verde sobre un gráfico que no se pintó

La captura `…T16-58-23-693Z` a 1440x1600, **sin** `--wait-selector`, salió con
**700 px de hueco blanco** donde va el gráfico —Plotly no había pintado— y el
runner reportó:

`ok=true issues=0 geometryIssues=0 geometryCoverageMisses=0 overflow=0`

Verde por conformidad, no por ausencia: aquí el gate aprobó un panel cuyo
contenido principal no existía en la página medida. No es un fallo de C1–C4 —el
contenedor estaba declarado y su marco intacto—, es que **ninguna cláusula
comprueba que dentro haya algo**. Sirve de aviso para toda captura de una vista
con Plotly: **sin `--wait-selector` la evidencia no vale**, y el `issues=0` de
esa corrida tampoco.

Dos cosas más que aprendí del runner en este tick, y que valen como trampa:

- `--wait-selector` se evalúa **antes** de `--ir`, así que sobre la ruta de
  aterrizaje. Un `waitSelectorMisses=1` con el selector de la vista de destino
  es falsa alarma; aun así la espera que introduce es lo que deja pintar a
  Plotly, que es para lo que sirve aquí.
- Un `.pulso` **sin `monitoreo_config`** deja al shell en «¿Qué tipo de estudio
  vas a monitorear?» y **el `--ir` no llega a ninguna parte**. Las capturas
  anteriores con `hsvg2026_trabajo.pulso` medían esa pantalla de elección, no el
  panel: su `issues=0` no dice nada de Monitoreo. Se arregla derivando
  (`api/scripts/derivar_monitoreo_aulas.R`, que sella `route_selected = TRUE`) o
  usando un proyecto que ya lo traiga.

---

## 33b · La corrección de la 33: verifiqué el denominador y me lo tumbó

Escribí en la 33 que la tarjeta y el gráfico eran «dos lecturas del mismo dato».
Antes de repararlo fui a medir de qué come cada una, y **no lo son**:

- `avance_sexo_facultad` sale de `monitoreo_aulas_avance_sexo_facultad()` sobre
  `tracked_df`, que es `seguidas[monitoreo_aulas_en_juego(seguidas), ]` —el
  titular o la reserva despierta de cada cadena—. La función **no filtra por
  fecha**: su `aporte_pendiente` cuenta toda aula viva sin aplicar, agendada o
  no.
- `proyeccionPorAgenda()` proyecta sólo sobre filas con `scheduled_date` y
  `esVisitaComprometida(sample_status)`.

El primer conjunto contiene al segundo, así que el gráfico cierra más celdas que
la tarjeta. **«0 de 30» y «seis sin déficit» son las dos correctas.** No había
contradicción que reparar y la reparación que dejé especificada —hacer que el
KPI leyera la tabla del gráfico— habría roto un número bueno.

Lo que sí estaba mal era el **rótulo del gráfico**: llamaba «Aportarán las aulas
agendadas» a un tramo que cuenta el plan vivo entero, y su pie decía «Con todas
las aulas agendadas aplicadas». El número prometido no era el entregado, y quien
restara las dos superficies encontraría un hueco inexistente. Corregido a
«Aportarán las aulas que faltan» / «Aplicando todas las aulas que quedan en el
plan», con guard en `celdasPorFacultad.test.ts` que se comprobó rojo al
restaurar el rótulo viejo.

**Queda abierto, y es tuyo:** `proyeccionPorAgenda()` saca el rendimiento
esperado (`serieDeRendimiento(partes)`) **y** su fecha de corte del **parte de
campo**, no de la plataforma. Con la regla que repetiste esta semana, esa
proyección debería construirse sobre `start`/`end`/`collectorID` de Kobo. No lo
cambio por mi cuenta: decide qué debe alimentar la proyección de la agenda.

La lección: **la 33 nació de comparar dos cifras en una captura sin ir a ver sus
denominadores.** El tell estaba a la vista —una tarjeta dice «con lo agendado» y
la otra superficie dice «del plan»— y aun así escribí «dos lecturas del mismo
dato». Es la trampa de siempre: una palabra para dos cosas.

---

## 35 · «Mujer» empieza por eme

Salió persiguiendo el ±1 entre «Cuota por recoger 2.824» y «Faltan 2.825». No era
redondeo: eran **dos cantidades distintas con el mismo nombre**. La tarjeta suma
`max(0, target − observed)` celda a celda; la tabla del cliente restaba los
TOTALES de la facultad, o sea que un excedente de hombres tapaba un déficit de
mujeres. Aplicaba el ADR 0079 entre facultades y se lo saltaba un nivel más
abajo, que es donde vive la meta: «TODAS LAS FACULTADES CUMPLAN CON SU CUOTA DE
SEXO».

Al escribir el test de eso apareció lo gordo. El `sex` de `quotas_sex_faculty`
**sale de la columna del estudio tal cual**
(`monitoreo_aulas_universitarias.R:1586`), y `audit_reference.R:231` mapea
`"1" = "Mujer", "2" = "Hombre"`. Tres superficies del perfil lo trataban mal,
cada una a su manera y ninguna avisando:

| Superficie | Cómo clasificaba | Qué pasaba con «Mujer» |
|---|---|---|
| `avanceParaCliente.ts` | `/^(f|fem)/` y luego `/^(m|masc|varon|hombre)/` | falla la primera, **casa la segunda**: contada como hombre |
| `brechaDeLaFacultad.ts` | `.slice(0, 1)` del crudo | «Mujer» → «M»: contada como hombre |
| `celdasPorFacultad.ts` | `=== "F"` / `=== "M"` | **descartada**; el gráfico entero sale vacío |

Las dos primeras son de las que no dan error: los totales por facultad siguen
cuadrando y la columna de mujeres enseña las cifras de los hombres. La tercera es
la lista cerrada que se traga lo que no reconoce.

Existía desde el principio el clasificador de la casa —`sexSeriesKind` en
`calcMuestra/sexoPalette.ts`, que prueba pertenencia exacta antes que subcadena,
así que «m» sola es hombre y «mujer» es mujer— y `AulasSerieDeRendimiento` ya lo
usaba. Las tres pasan a usarlo.

Por qué no lo cazó nadie: **el estudio real trae `F`/`M`**, así que las tres
funcionan sobre HSVG2026. El defecto sólo se ve con un estudio cuya variable de
sexo esté etiquetada, que es exactamente lo que produce el proyecto de auditoría.
Un fixture con los códigos buenos no prueba el clasificador; el test nuevo compara
`("Mujer","Hombre")` contra `("F","M")` y exige que den lo mismo, y además mira el
ORDEN de las celdas —si se invirtieran, el HTML seguiría teniendo un 40 y un 130—.

Cuatro tests nuevos. Comprobados contra dos mutantes: restaurar el neteo entre
sexos deja 1 rojo; restaurar las regex caseras deja 3.

---

## 36 · El mismo defecto estaba en R, y en el camino del diseño

Barrido tras la 35. En el frontend no quedaba nada más —los territoriales usan
pertenencia exacta, que es el patrón correcto, y `avanceProyectado.ts:136` y
`AulasReservaDirigida.tsx:65` caen al literal crudo sin confundir—. En R había
tres, y **producen la cuota de sexo contra la que Monitoreo mide**:

| Sitio | Cómo clasificaba | Con «Mujer» |
|---|---|---|
| `calc_muestra_aulas_sexo_por_facultad.R:45` | `substr(k, 1, 1) %in% c("F","M")` | → «M», **contada como hombre** |
| `carga_aulas_libro_generar.R:465` | `toupper(substr(…, 1, 1))` | → «M», la ficha de campo sale con las mujeres esperadas en el renglón de hombres |
| `calc_muestra_aulas_certificacion.R:128` | `sexo == "F"` / `== "M"` | **descartada**: la facultad sale con cero elegibles de ese sexo |

No había clasificador canónico en R —`.cm_dist_sex_key` sólo normaliza texto para
agrupar—, y por eso cada sitio se hizo el suyo. Ahora hay uno,
`.pulso_sexo_fm()` en `helpers_calc_comunes.R`, con el mismo criterio que
`sexSeriesKind` del frontend: **pertenencia exacta antes que subcadena**, para
que «m» a secas siga siendo hombre y «Mujer» sea mujer. Lo que no reconoce
devuelve `NA` y nunca cae a un sexo por descarte.

Cinco tests, uno de ellos el control del orden del criterio: si se probara
subcadena primero, «m» no casaría `grepl("hombre|masculin|varon")` y saldría
`NA`, rompiendo el caso que hoy funciona en todos los estudios reales.

**Y el propio test cazó un defecto en mi helper**: `out[pend & grepl(…, k[pend])]`
cruzaba un vector recortado con una máscara de longitud completa, o sea
reciclaje silencioso de R. Salía como *warning*, no como error, y habría corrido
la clasificación. El `grepl` va sobre `k` entero.

## 37 · Un `@export` mío se lo había llevado el helper de al lado

Al correr `test-namespace-contract.R` como seguro barato aparecieron dos rojos, y
eran **de mi propio tick del ítem 13**. Al meter `.mard_personas` en
`monitoreo_aulas_reserva_dirigida.R` dejé su bloque de documentación pegado
justo detrás del `#' @export` de la función pública. Roxygen funde comentarios
`#'` contiguos en un solo bloque que se aplica al objeto siguiente: el `@export`
se lo llevó `.mard_personas` —un helper interno, con punto inicial— y
`monitoreo_aulas_reserva_dirigida` se quedó fuera del NAMESPACE, que conservaba
su `export()` huérfano.

En `pkgload::load_all` no se nota nada; en el binario instalado, la función
pública deja de existir. Es el patrón que ya estaba anotado y volvió a pasar en
cuanto inserté un helper delante de una función exportada.

Separados los dos bloques y regenerado: **el NAMESPACE no cambió ni una línea**
—el `export()` ya estaba, sólo le faltaba su `@export` en el sitio correcto— y
las cinco comprobaciones del contrato pasan.

---

## 38 · La causa del cero, donde se lee el cero (ítem 10, la mitad que faltaba)

El motor ya tenía hecha la parte difícil. `monitoreo_aulas_avance_cuota.R:518`
detecta que la columna de sexo existe y **ninguno** de sus valores se reconoce
—una base de Kobo sin decodificar trae el NOMBRE de la opción del XLSForm, y el
instrumento de HSVG2026 usa `1` = Mujer y `2` = Hombre—, y publica la causa con
los valores que llegaron. Deliberadamente no adivina que `1` es mujer: otro
estudio puede numerarlo al revés.

Lo que faltaba era el último eslabón: ese aviso viajaba en la columna `warning`
de las treinta filas y la UI lo pintaba **sólo como una columna más de la tabla**,
rotulada «Advertencia» y repetida treinta veces, mientras el panel de al lado
decía «0 de 30 celdas cumplidas» sobre mil quinientas respuestas ya atribuidas a
su aula. Ahora sale encima de las cifras que explica, en
`AulasCuotasResumen`. Tres tests, con el mutante comprobado.

## 39 · Una familia de tokens que nunca existió

Al darle estilo al aviso escribí `var(--pulso-warning-fg)` copiando el CSS de al
lado. **No existe.** El token de la casa es `--pulso-warn-fg` —sin `-ing`— y la
familia falsa estaba referenciada en **dieciséis sitios**, seis de ellos sin
respaldo, o sea declaraciones inválidas: `avanceParaCliente.css:133` pintaba el
chip de aviso con el color heredado, y `editor-v2.css` y `monitoreoPublic.css`
tenían `background: var(--pulso-warning-bg) !important` sin fondo ninguno.
Renombrados los dieciséis. Quedan dos `--pulso-warning-soft` en Analítica con
respaldo hex: `--pulso-warn-soft` **tampoco** existe, así que renombrarlos sería
cambiar un token inexistente por otro; se dejan y siguen en la lista de deuda.

**Y el barrido con `sed` se llevó por delante el propio test que lo vigila.**
`tokensDefinidos.contract.test.ts` lleva un `DEUDA_CONOCIDA` con los huérfanos
tolerados, y mi `sed -i` sobre «todo archivo que mencione `pulso-warning-`»
reescribió también esas tres entradas de la lista, convirtiéndolas en nombres
que **sí** están definidos. El test lo cazó por su trinquete —«estos tokens ya no
están huérfanos, quítalos para que la lista sólo encoja»— y no por el chequeo
principal.

Dos lecciones, y la segunda es la que vale:

1. Un `sed -i` sobre el resultado de un `grep -rl` toca **todo** archivo que
   mencione el patrón, incluidos los tests, los fixtures y las listas de
   excepciones que hablan *de* ese patrón. Mirar `git status` después de un
   barrido, no sólo el gate.
2. **El rojo se localiza antes de atribuirlo.** Mi primera lectura fue «esto ya
   estaba rojo, es de otra sesión», y para comprobarlo miré HEAD: el nombre no
   estaba en la lista de HEAD, o sea que la entrada la había escrito yo hacía
   dos minutos. Sin ese paso habría committeado una lista de deuda corrompida
   diciendo que el rojo era ajeno.

Como el renombrado dejó los tres nombres falsos sin un solo uso, las tres deudas
quedan **pagadas** y salen de la lista: el trinquete cumple su función.

---

## 40 · Volví a mirar la pantalla y uno de los tres arreglos no se veía

Cuatro ticks reparando sin capturar. Captura de `avance/cuotas` con
`aulas_con_respuestas.pulso` (`tmp/visual-qa/quick/2026-08-29T17-49-24-399Z/`),
comprobando las tres cosas que debían haber cambiado:

| | Qué debía verse | Qué se ve |
|---|---|---|
| a | «una muestra de 3.491» → 2.500 | **sigue 3.491** |
| b | los «Faltan» dejan de netear entre sexos | ✓ el total pasó de 2.825 a **2.824** y ya cuadra con la tarjeta; la nota dice «celda a celda… o en un sexo» |
| c | el gráfico dice «las aulas que faltan» | ✓ (pestaña Estratos, ya verificado) |

**La (a) no funcionó y el motivo importa.** Cambié la fuente del número —de una
suma en el frontend a `avance_cuota$total$cuota` del motor— creyendo que ese
total era el objetivo del diseño. No lo es:
`monitoreo_aulas_metas_diseno.R:117` lo define como
`round(sum(cuotas_por_facultad))`, o sea **el mismo 3.491**. El commit anterior
dio a entender que el panel pasaría a decir 2.500; no lo hizo.

El cambio de fuente sigue valiendo —una lectura en vez de dos que pueden
separarse, que es la regla que el propio backend escribió— pero no era la
reparación del rótulo.

Lo inequívoco sí se arregla: 3.491 **no es una muestra**, es lo que suman las
cuotas. La frase pasa a «Las cuotas por facultad suman 3.491 alumnos; se llevan
667».

**Lo que queda abierto, ítem 24, y es tuyo:** el objetivo del estudio es
`n_objetivo = 2500` y vive en el componente activo de Cálculo de muestra; el
reparto por facultad suma 3.491 y el operativo con sobremuestra es 3.750.
Ninguno de los dos primeros llega hoy a Monitoreo salvo por esa suma. **¿Cuál
debe presidir el panel del cliente?** Si es el objetivo, hay que hacerlo viajar
—`n_objetivo` no está en `design_targets`—; si es el reparto, la frase de ahora
ya es correcta y no hay nada más que hacer.

La lección, otra vez: **un arreglo verificado por tests no está verificado.** Los
tres mutantes pasaron, el typecheck pasó, 2.063 tests pasaron, y el número de la
pantalla era el mismo. Sólo lo dice la captura.

---

## 41 · Medido en el DOM: dos líneas a 2.628 px de su caja (ítem 25)

Ni Plotly ni la animación. `AulasSerieDeRendimiento` dibuja SVG a mano y la
medición en el DOM lo dejó sin dudas:

| elemento | `stroke` | sale por arriba | `top` |
|---|---|---|---|
| `<line>` cuota | `--aulas-sexo-mujer` | **2.628 px** | −1384 |
| `<line>` cuota | `--aulas-sexo-hombre` | **2.575 px** | −1332 |
| `<polyline>` ×4 | series por sexo | 187–331 px | 912–1057 |

Con el SVG en `top 1243` y la tabla en `508–1086`, las polylines caen justo
encima de la tabla. Las dos `<line>` se van muy por encima de la pantalla.

**Dos causas, y ninguna es la que supuse leyendo el código.** La primera:
`techo = max(ultimo, meta, sobremuestra, ...proyectadas)` **no incluye las
cuotas por sexo**, y con un tope de unos 400 contra cuotas de 1.730 y 1.761 la
`y` de `MARGEN + UTIL − UTIL*v/tope` se va muy negativa. La segunda: el CSS pone
`overflow: visible` en el SVG —para que un trazo del borde no se corte a la
mitad— y con eso el pintado no tiene tope ninguno.

Meter las cuotas en la escala tampoco valía: aplastaría la serie observada —348
sobre 1.761— contra el suelo, y leer el avance es para lo que existe el panel.
Así que **se dibuja lo que cabe y se dice lo que no**, con su cifra, más un
`<clipPath>` que garantiza que nada vuelva a salirse por otra vía. Un recorte
mudo habría cambiado un estropicio visible por una ausencia silenciosa.

Verificado en pantalla, no sólo en tests: la tabla quedó limpia, el párrafo del
pie se lee entero y aparecen «la cuota de hombres (1.730) no cabe en la escala de
este gráfico» y su pareja.

**Cómo se midió, que es lo reutilizable.** `elementsFromPoint` sobre una rejilla
en el rect de la tabla devolvió **cero**: `overflow: visible` saca el PINTADO
fuera del viewport del SVG, pero el hit-testing sigue recortado, así que por ahí
no se ve nada. Lo que sí lo mide es recorrer `svg.querySelectorAll('*')` y
comparar cada `getBoundingClientRect().top` con el del SVG. Y al revés: después
del arreglo esos rects **siguen** diciendo 331 px, porque un `clipPath` recorta
el pintado y no el bbox — ahí la única prueba es la captura.

**Y el runner sigue sin verlo**: `derrames=0 solapes=0 desbordes=0 issues=0` en
las cuatro corridas, antes y después. Ninguna cláusula del contrato comprueba que
un trazo se quede dentro de su caja. Sigue siendo el ítem 16.

---

## 42 · El mismo defecto en el SVG de al lado, y uno nuevo en su leyenda

Antes de capturar otra pestaña miré si el arreglo del 41 estaba completo. **No lo
estaba**: `AulasSerieDeRendimiento` tiene DOS svg y sólo recorté el del acumulado.
El segundo —el diario— comparte `overflow: visible` y tiene su propio agujero de
escala: `valores` (línea ~266) no incluye **el borde alto de la banda de
credibilidad**, que sí se dibuja (~1249). El comentario de esas mismas líneas
cuenta que esto ya pasó una vez ahí con las barras: «un elemento que no cabe en
su eje no es un elemento mal pintado: es un eje mal calculado». Tercera vez.

Aquí la banda **sí** es del orden de la serie, así que se arregla el eje —entra
en el máximo— en vez de declararla fuera. `esperadoDelEstudio` se calcula
DESPUÉS del techo y no se puede incluir sin reordenar; para eso queda el
`<clipPath>`.

Con `id` propio y no el del acumulado: los `id` de SVG son del documento entero,
así que apuntar al del otro gráfico funciona… hasta que el acumulado no se
renderiza. Y una referencia de `clip-path` que no resuelve **no deja el elemento
sin recortar: lo deja sin dibujar**.

### Lo nuevo, y hay que medirlo antes de tocarlo (ítem 26)

En la captura `…T18-24-04-172Z`, con el gráfico ya entero y la tabla limpia:

- el eje del acumulado va de **0 a 200**, la serie verde llega a **~54** y la
  línea de meta está en **67**;
- el pie dice «54 de 67 encuestas que el plan espera de las aulas visitadas · con
  lo agendado se llegaría a 162»;
- y los chips de sexo de la MISMA leyenda dicen **«Hombres 348/1.730»** y
  **«Mujeres 319/1.761»**.

348 y 1.730 no pueden ser del mismo universo que un gráfico cuyo eje acaba en 200
y cuya meta es 67. **El chip verde habla de las aulas visitadas y los de sexo
parecen hablar del estudio entero**, en la misma línea y sin distinguirlo. Es el
patrón de una palabra para dos cosas, dentro de una sola leyenda.

Y tiene un efecto sobre lo que acabo de escribir: las declaraciones «la cuota de
hombres (1.730) no cabe en la escala de este gráfico» son literalmente ciertas
pero **engañosas** si ese número no es del universo del gráfico. Lo correcto no
sería declararlo fuera de escala, sino no ponerlo ahí. **No se toca hasta
medirlo**: de dónde sale `cuotasVisibles[].meta` y contra qué denominador, y si
`se.conseguidas` cuenta lo mismo que la serie verde.

---

## 43 · Dos universos en una leyenda (ítem 26), y el residuo que dejé al arreglarlo

Medido, y la aritmética lo cierra sin margen: `cuotasVisibles`
(`AulasSerieDeRendimiento.tsx:379`) tiene dos ramas. Con una facultad elegida
salen de ella; en la vista «Todas las facultades» —que es la de la captura— se
agregan TODAS, y **1.730 + 1.761 = 3.491**, exactamente la suma de las quince
cuotas por facultad que ya estaba medida. El resto del gráfico habla de las aulas
visitadas: eje 0–200, serie en 54, meta 67.

O sea que no era que «no cupieran»: **son de otro universo**. El comentario del
código ya lo decía —«las de la facultad, o las del estudio»— y lo que faltaba era
que el lector pudiera saber cuál. Los chips dicen ahora «Hombres 348/1.730 **del
estudio**» y la declaración dice el motivo real: «las cuotas por sexo (1.730 y
1.761) son las del estudio entero: no se dibujan sobre un eje de aulas
visitadas». Una vez, no una por sexo.

**Y el residuo, que es la parte que vale.** Al dejar de dibujar esas dos
horizontales, el pie del gráfico —«las horizontales son la meta **y las cuotas de
cada sexo**»— pasó a mandar a buscar dos líneas que ya no están. Es exactamente
el defecto que este panel lleva todo el día corrigiendo, **introducido por mí en
el arreglo anterior**, y sólo se vio en la captura: typecheck y 2.070 tests
estaban en verde con el pie mintiendo. Ahora dice «la horizontal es la meta»
cuando no hay cuotas dibujadas.

La regla que sale de aquí: **un arreglo que deja de pintar algo tiene que revisar
todo lo que nombraba a ese algo.** El pie, la leyenda y el `aria-label` son
consumidores del mismo contenido y ninguno se entera solo.

---

## 44 · Efectividad: una frase con un guion dentro, y tres intentos para arreglarla

Primera captura de `avance/efectividad` en todo el loop. El panel «El campo
contra la tasa que dimensionó la muestra» abría con:

> En las 48 aulas ya aplicadas, la **tasa de la facultad** suponía que
> respondería el **—** de los alumnos.

Un guion **dentro de una oración**. El motivo estaba dicho dos líneas más abajo
—«el estudio importado no publica metas del diseño»— pero eso no arregla la
frase: un vacío se declara, no se incrusta. Y la leyenda anunciaba «▎dónde se
esperaba llegar» cuando esa vara no se dibuja en ninguna de las quince barras.

**Costó tres intentos y los tres errores son trampas ya documentadas.**

1. Condicioné la frase con `hayPrevisto`, un flag que calculé sobre las FILAS,
   cuando la frase habla del AGREGADO. La captura salió idéntica. Una palabra
   para dos cosas, dentro de mi propio arreglo.
2. Lo cambié a `t.tau_previsto != null` y la captura **volvió a salir idéntica**:
   el valor no es `null`, es `NaN`, y `NaN != null` es `true`. El `pct` local de
   ese archivo (línea ~159) escribe «—» con `!Number.isFinite(n)`, así que el
   guard tenía que preguntar lo mismo que el texto. Es el `Number(null) === 0`
   de siempre con otro disfraz.
3. Y de paso: buscaba el `pct` importado de `formatoComun`, que devuelve «S/D»
   —no «—»—. Estuve dos vueltas mirando la función equivocada. **El formateador
   que escribe un texto se localiza por el TEXTO que produce**, no por su
   nombre.

Vale también para la vara: se pintaba con `left: NaN%`, que el navegador
descarta, así que la leyenda prometía una marca invisible aunque la fila
«existiera». También pasa a `Number.isFinite`.

Y un cuarto, mío y del método: escribí `pnpm … tsc | head -3; echo "exit=$?"` y
el `$?` era el del `head`. Dijo `exit=0` con el typecheck **rojo** —lo delataba
la línea de error impresa justo encima—. Es la trampa del exit code en un pipe,
ya anotada, y aquí casi me hace commitear con TS roto.

**Pendiente de medir (ítem 27):** la cabecera dice «528 alumnos en riesgo en 12
facultades» y la columna «Alumnos» de esas doce filas suma **535** leyendo la
captura (157+98+60+19+17+13+3+1+59+58+48+2). Puede ser redondeo por fila contra
un total sin redondear, o puede ser otro denominador. **No se toca hasta
medirlo**, que hoy tres diagnósticos deducidos salieron falsos.

---

## 45 · 528 contra 535: los dos eran correctos y por eso había que elegir (ítem 28)

Medido, y no era un error de nadie. El motor
(`monitoreo_aulas_efectividad_seguimiento.R:562`) suma los déficits **crudos** de
las facultades en riesgo —ya sin compensar entre ellas, ADR 0079— y el frontend
lo redondeaba al entero más cercano: **528**. Cada fila, en cambio, redondea su
faltante **hacia arriba en magnitud** a propósito, y el comentario que lo
justifica es explícito: «decir que faltan 22 cuando faltan 22,4 es prometer que
se cierra con menos de lo que hace falta, que es el error caro en una pantalla
que decide si se activan reservas». Doce filas redondeando hacia arriba explican
los siete de diferencia: la columna sumaba **535**.

Los dos números eran correctos bajo su propia regla, y justo por eso el lector
que suma la columna encuentra un hueco y desconfía de las dos cifras.

**Se elige el 535**, y el argumento es el mismo que ya justifica el redondeo por
fila: como cada facultad hay que cubrirla por separado, lo que de verdad hace
falta es la suma de los techos y no el techo de la suma. Se calcula sobre las
MISMAS filas que se pintan —`alumnosQueFaltanEnTotal()`—, así que no es una
segunda lectura del dato: es la única, con su regla de presentación aplicada una
sola vez. Verificado en pantalla: la cabecera dice 535 y la columna suma 535.

Cinco tests, con el mutante comprobado (volver al crudo deja 1 rojo) y con los
tres casos que no se ven a ojo: sólo cuentan las facultades en riesgo, un
excedente no descuenta lo que falta en otra, y un `NaN` colándose habría escrito
«NaN alumnos en riesgo».

---

## 46 · Decimales en respuestas, sexta vez, una línea debajo de donde ya se arregló

Primera captura de `avance/resumen`. El pie del ritmo decía:

> Faltan **2 824,4** para la meta total de **3 491,4** · 22 días más al ritmo de
> estos 5

Personas partidas, que es lo que Gonzalo ya corrigió dos veces. Lo demoledor es
dónde estaba: el comentario de la línea 68 de ese mismo archivo dice
literalmente «aquí son RESPUESTAS… **tercera vez** que aparece el mismo
defecto», y arregló la media diaria —`fmtCuenta(media)`— dejando el pie de
cincuenta líneas más abajo con `fmt`. **Se arregló donde se miró.** Corregido con
`fmtCuenta`, que redondea hacia arriba: quedarse a 0,4 de una persona es quedarse
corto.

Barrido del resto del perfil buscando el mismo patrón —`fmt(` sobre campos que
vienen de una esperanza—: **el único caso real era ése**.
`AulasHistoriaCadena` imprime `meta.toLocaleString` en crudo tres veces y parecía
el siguiente, pero `historiaDeCadena.ts:136` ya hace
`Math.ceil(expected_valid − 1e-9)`, así que ahí la meta ya llega entera. Un
`toLocaleString` crudo no es un defecto si el productor ya redondeó.

### Lo que destapa, y es decisión suya (ítem 29)

Con el pie ya en enteros, la misma app publica **tres cifras del «cuánto falta»,
las tres correctas y con tres granos distintos**:

| cifra | dónde | qué suma |
|---|---|---|
| **2.824** | banda de KPIs y tabla del cliente | Σ por celda sexo × facultad de `max(0, cuota − observado)` |
| **2.825** | pie del ritmo, en Resumen | meta total (3.492) − conseguidas (667) |
| **2.923** | «Cumplimiento en respuestas» | Σ por curso-horario de lo que falta a su meta |

Y dos metas totales conviviendo a dos paneles de distancia: **3.572** («suma de
metas por curso-horario», rotulada) y **3.492** («la meta total», sin decir su
grano).

Ninguna está mal. Pero quien mira Resumen y luego Cuotas ve 2.825 y 2.824 y no
tiene cómo saber que son dos preguntas distintas. Es hermano del ítem 24: hace
falta decidir **cuál preside** y que las demás digan su grano en el rótulo, como
ya hace «suma de metas por curso-horario». No lo decido solo.

---

## 47 · Dos ceros que no se leían, y una taxonomía que se contradice con la banda

Bajando por `avance/resumen`, dos superficies escondían sus ceros de formas
distintas y las dos se arreglan igual: **escribiéndolos**.

**«Status de aplicación»** creaba una traza por estado, así que su leyenda
listaba seis entradas —Sin agendar, Agendada, Aplicada, En cierre, Reemplazada,
En reserva— sobre una barra con tres segmentos. No era un vacío oculto sino un
cero declarado, pero el lector no tenía cómo saber **cuál** estaba en cero sin
pasar el cursor. El conteo pasa a la propia leyenda: «Sin agendar 2.061 ·
Agendada 0 · Aplicada 0 · En cierre 48 · Reemplazada 0 · En reserva 507».

**«Cursos-horario por cobertura»** dejaba la fila «Muy por debajo (menos de la
mitad)» sin barra y sin cifra entre cuatro que sí las tenían, y eso se lee como
un hueco de renderizado. Escribir el cero **no bastó**: comprobado en pantalla,
Plotly con `textposition: "auto"` sobre una barra de ancho cero no tiene dónde
meter el texto y no lo saca fuera por su cuenta. Se le dice punto a punto —
`outside` cuando la barra no existe— más `cliponaxis: false`.

**Y no es una contradicción con el gráfico de acumulado, donde el cero se omite a
propósito.** Allí el cero es un déficit cubierto —buena noticia— y su etiqueta
compite con las celdas que sí piden algo. Aquí es cuántos cursos-horario cayeron
en esa banda: que sean cero describe la forma del reparto. Queda escrito en los
dos sitios para que nadie los «armonice».

### Lo que destapó la leyenda nueva (ítem 31)

Con los conteos a la vista, «Status de aplicación» dice **«Aplicada 0 · En cierre
48»** mientras la banda de KPIs, dos centímetros más arriba, dice **«APLICADAS
48»**. Las dos pueden ser ciertas —una habla del punto del circuito y la otra del
hecho de haberse aplicado— pero conviven sin distinguirse, y un lector que busque
«aplicadas» encuentra 0 y 48 en la misma pantalla. Es el conflicto de taxonomías
de estado, otra vez. **No se toca hasta medir** de dónde sale cada una.

---

## 48 · El rótulo estaba en el tramo equivocado (ítem 32)

Medido en el motor, y no era una taxonomía legítima en conflicto: era un
participio mal puesto.

- `cerrando` = `operational_status ∈ {aplicada, cerrada}` **o**
  `válidas ≥ meta` (`monitoreo_aulas_universitarias.R:1332`). **Ahí caen las
  aplicadas.** Se rotula «En cierre».
- `en_aplicacion` = tiene respuestas pero **todavía no** es `aplicada` ni
  `cerrada` (línea 1335). O sea, **en curso**. Se rotulaba «Aplicada».

«Aplicada» es participio de terminado y era la misma palabra que el KPI
«APLICADAS» de la banda, dos centímetros más arriba. De ahí el «Aplicada 0» junto
a «APLICADAS 48»: las 48 estaban en el tramo de al lado. Pasa a **«En
aplicación»**, que es lo que dice su propia clave.

**Y no es la primera vez en ese mismo array.** El tramo `cerrando` se llamaba
«Cumple» y chocaba con el KPI «Llegaron a su meta» y con «Meta cumplida» del
gráfico de cobertura —tres cosas con la misma palabra—; ya se había renombrado a
mano, con su comentario y todo, **una línea más abajo del que seguía roto**.
Nada lo vigilaba.

Ahora sí: `rotulosNoColisionan.contract.test.ts` normaliza a minúsculas, sin
tildes y sin la `s` del plural, y falla si algún tramo usa una palabra de la
banda o si dos tramos se repiten entre sí. Lleva además el control de que el
fixture sirve —si `aulasKpis(null, …)` devolviera lista vacía, el contrato
pasaría sin comparar nada, que es verde por ausencia—. Mutante comprobado:
restaurar «Aplicada» deja 1 rojo.

---

## 49 · La tercera meta la había puesto yo (y arreglarla cerró el ítem 30 casi entero)

Primera captura de `avance/salidas`. Ahí la meta dice **3.491**, igual que
Cuotas. Y el pie del ritmo, que yo acababa de pasar a `fmtCuenta`, decía
**3.492**. No son dos granos: es **la misma cantidad** —3.491,4— con dos
redondeos, y el segundo lo introduje yo en el arreglo de los decimales.

`fmtCuenta` redondea hacia arriba y para «lo que falta» es lo correcto. Para una
**meta** no: una meta no es lo que hace falta conseguir de más, es una cantidad
ya fijada, y el motor la publica redondeada al entero más cercano en
`avance_cuota$total$cuota`.

Corregido, y de paso el faltante se calcula sobre la meta **mostrada**:

> Faltan **2.824** para la meta total de **3.491**

Con lo que 667 + 2.824 = 3.491 cuadra a la vista, y ese 2.824 es exactamente el
de la banda de KPIs y el de la tabla del cliente. **Del ítem 30 quedan dos
cifras en vez de tres**, y la que queda —2.923, por curso-horario— ya declara su
grano en el rótulo («suma de metas por curso-horario»). Lo que sigue abierto para
Gonzalo es sólo si esa lectura por curso-horario debe convivir con la de celda o
si una de las dos preside.

La lección, otra vez sobre mí: **un formateador correcto para una magnitud no lo
es para la de al lado.** «Lo que falta» va hacia arriba; «la meta» no. Y el
único sitio donde se vio fue una captura de una pestaña distinta de la que
toqué.

---

## 50 · La tarjeta «Corte» daba el reloj de la máquina (ítem 33)

Primera captura de la sección `fuentes`. La banda decía **CORTE 29/8/2026** con
la pista «todo el atraso se mide contra este día», mientras Salidas decía «corte
05/09/26» y el panel de vencidos «al 2 de setiembre». Tres fechas para una
palabra.

Medido: `sello = fecha(dashboard?.generated_at)`. Y el repo **ya tenía escrito
que eso está mal**: `corteDelEstudio.ts` existe para resolverlo y su cabecera
dice «**No es `generated_at`.** Ese sello dice cuándo se calculó el tablero, o
sea el reloj de la máquina que lo abrió, y sobre un estudio reabierto o simulado
dice cualquier cosa», con un caso medido —«al 27 de agosto» sobre un estudio
sincronizado al 12/09—. La tarjeta que publica la palabra «Corte» en la banda era
la única que no lo usaba. Dos capas, dos lecturas de la misma regla, que es la
frase que ese mismo comentario emplea para el defecto hermano.

Ahora sale del módulo y dice **2/9/2026 · «último día con parte»**, que concuerda
con el panel de vencidos. Sin partes cae al sello **y lo declara**, en vez de
afirmar un corte que nadie midió.

**Y el test cazó un desfase de un día que introduje al arreglarlo.** `fecha()`
pasaba el valor por `new Date()`, y un `YYYY-MM-DD` pelado se parsea como
medianoche **UTC**: en Lima, `2026-09-05` salía **4/9/2026**. El sello del
tablero lleva hora y no tenía el problema; el día del corte no la lleva. Se
formatea a mano desde sus tres números.

### Lo que queda a la vista, y es suyo (ítem 34)

El corte ya no es el reloj de la máquina, pero **sale del parte de campo**: el
último `applied_at` es el 2/9 mientras las respuestas llegan por plataforma hasta
el 5/9 —es lo que muestra el ritmo y lo que dice Salidas—. Con la regla que
Gonzalo repitió esta semana —«lo que contamos son las efectivas en plataforma»—
el «hoy» del estudio debería salir de la última respuesta, no del último parte.
`corteDelEstudio` está construido a propósito sobre los partes y con su
razonamiento escrito, así que cambiarlo es una decisión de diseño, no un typo.
Hermano del ítem 17.

---

## 51 · Las claves de sección no son las etiquetas, y un `capacity-drift` que sí declara su miembro

**Dos cosas, y la primera me costó un tick entero.** `--ir monitoreo/aulas/agenda`
no existe. El runner escupe el manifiesto y ahí está la respuesta: las secciones
de este perfil son

`fuentes · modelo · calidad · consultas · avance`

aunque la barra superior las rotule **Fuentes · Agenda · Validación · Consultas ·
Avance**. «Agenda» es `modelo` (con pestañas `agenda`, `facultad`, `contacto`,
`carga`) y «Validación» es `calidad` (`registro`, `controles`, `base`,
`abiertas`). Las direcciones completas del perfil:

```
monitoreo/aulas/fuentes
monitoreo/aulas/modelo/{agenda,facultad,contacto,carga}
monitoreo/aulas/calidad/{registro,controles,base,abiertas}
monitoreo/aulas/consultas/{reemplazos,brechas,parte,extras}
monitoreo/aulas/avance/{cuotas,resumen,estratos,rendimiento,efectividad,salidas}
```

Para el usuario no hay defecto —ve «Agenda» y navega—, pero quien captura por
dirección se estrella. Anotado aquí para no volver a perder un tick.

### El octavo `capacity-drift`, y mi diagnóstico estaba incompleto

`monitoreo/aulas/modelo/agenda` reporta `geometryIssues=1`:

```
capacity-drift · [data-qa-geometry-group="monitoring-aulas-table"]
  members: [div.mon-profile-panel-head] · unusedInteriorBottom: 5
```

Mismo patrón que las siete veces anteriores: el runner mide la cabecera. **Pero
aquí la reparación conocida YA está aplicada**: el contenedor de datos
—`AulasGestionesPorAula`— declara `data-qa-geometry-member` en sus dos ramas, y
la que se renderiza es la de datos (se ve su `summary`: «0 de 10 aulas con
gestión anotada van por la 3.ª llamada o más»). El runner acepta el atributo por
presencia, no por valor, y sólo filtra por `isVisibleElement` y por que su
`closest("[data-qa-geometry-group]")` sea el grupo. Aun así cayó al fallback.

O sea que **«no declara su miembro» no explica los ocho casos**: hay al menos
otra causa. La hipótesis a medir —y sólo a medir, que hoy tres diagnósticos
deducidos del código salieron falsos— es que el miembro sea un
`<details>` cerrado y `isVisibleElement` lo descarte por alguna condición de
tamaño. Se comprueba con la pila viva preguntando al DOM: si
`group.querySelectorAll("[data-qa-geometry-member]")` devuelve el `details` y
qué dice de él el criterio de visibilidad del runner.

---

## 52 · El `capacity-drift` era del gate, no del markup (ítem 35)

Medido leyendo el criterio del propio runner, sin levantar nada:

```js
const closedDetails = el.closest("details:not([open])");
if (closedDetails) {
  const visibleSummary = closedDetails.querySelector(":scope > summary");
  if (!visibleSummary || (el !== visibleSummary && !visibleSummary.contains(el))) return false;
}
```

**`closest()` se incluye a sí mismo.** Para un `<details>` cerrado devuelve el
propio elemento; entonces `el !== visibleSummary` y el summary no lo contiene, y
lo declara **invisible**. Pero un `details` cerrado sí se ve —es exactamente la
caja de su summary— y su marco cuenta.

Consecuencia: en «Cuánto cuesta cerrar un aula» el contenedor de datos es un
`<details>` cerrado que **sí** declara `data-qa-geometry-member`; el filtro lo
descartaba, el auditor se quedaba con cero miembros explícitos, caía a los hijos
del grupo y **medía la cabecera del panel**. Ése es el `capacity-drift` que
llevaba ocho apariciones: **no era del markup, era del gate**.

La norma dice «cerrado, sólo el `summary` participa de la geometría». Eso excluye
a los **descendientes** ocultos, no al contenedor. El guard pasa a
`closedDetails && closedDetails !== el`.

**Medición del arreglo**, que aquí importa más que un test porque es un gate
compartido:

| vista | antes | después |
|---|---|---|
| `modelo/agenda` | `geometryIssues=1` | **0** |
| `fuentes` | 6 grupos, 0 issues | 6 grupos, 0 issues |
| `avance/resumen` | 10 grupos, 0 issues | 10 grupos, 0 issues |
| `avance/cuotas` | 6 grupos, 0 issues | 6 grupos, 0 issues |

Sin test propio, y con el motivo: lo único que podría afirmar un test aquí es la
presencia de una subcadena en el runner, y un guard así envejece sin vigilar
nada. La evidencia es el 1→0 con tres vistas intactas, y el porqué queda escrito
en el código con su caso medido.

**Lo que NO afirmo:** que esto explique las ocho apariciones. Explica ésta, y la
causa que yo venía dando —«el panel no declara su miembro»— era cierta en las que
reparé declarando el miembro. Que haya dos causas distintas bajo el mismo síntoma
es justamente lo que me hizo perder el diagnóstico general durante todo el día.

---

## 53 · `consultas/brechas`: dos sospechas comprobadas, las dos sanas

Captura limpia —`geometryIssues=0`, y sin ningún `capacity-drift` ahora que el
gate ya no descarta los `<details>` cerrados—. Dos cosas parecían defectos y
ninguna lo era. Se anotan para que otro tick no las reabra.

**1. «ESTADO OPERATIVO: Planificada» no está en el juego de tramos.** Las 180
filas muestran «Planificada», que no existe en el vocabulario de
`application_state` («Sin agendar / Agendada / En aplicación / En cierre /
Reemplazada / En reserva»). Parecía un tercer juego de palabras para el mismo
eje. **No lo es**, y el repo ya lo tenía escrito: `EstadoEnCelda.tsx` documenta
que «este vocabulario es DISTINTO del de `application_state`, y por eso necesita
su propia tabla», con su caso medido. `operational_status` es el estado del aula
—planificada, contactada, en campo, aplicada…— y `application_state` es el tramo
del circuito. Dos ejes deliberados, y cada columna rotula el suyo: «Estado
operativo» aquí, «Status de aplicación» allá.

**2. «CADENAS SIN CERRAR 180» junto a «BRECHAS 180».** Dos tarjetas vecinas con
el mismo número invitan a pensar que una sobra. Son conceptos distintos: la
primera cuenta **cadenas** —titular más sus reservas, vía `historiaDeCadena()`— y
la segunda **cursos-horario** por debajo de su meta. Coinciden porque ninguna
reserva ha entrado todavía; en cuanto se active un reemplazo divergen. Cada pista
declara su eje.

Vale la pena decirlo porque es el reverso del día: **de los hallazgos que
perseguí, los que salieron de mirar la pantalla eran reales y los que deduje del
código eran falsos**; aquí, mirar levantó dos sospechas y medir las tumbó. El
tick sin hallazgo es un resultado, no un tick perdido, siempre que quede escrito
qué se comprobó.

---

## 54 · Español sin tildes en la pantalla (ítem 36)

Primera captura de `calidad/controles`. Once reglas, y varias hablan así:

> «Los **numeros** de cada parte de campo cuadran.»
> «Las 3 aulas que **estan** en las dos hojas dicen lo mismo en asistentes, % de
> asistencia y quien **aplico**.»
> «La base no trae columnas de **identificacion** personal con datos.»
> «Todas las respuestas **validas** se atribuyeron a un aula del plan.»

Y lo mismo en los tramos de cobertura de `avance/resumen`: «Se **quedo** a
medias», «**Llego** a la mayor parte», «Casi **llego**».

**No es una convención ni una barrera técnica.** `DESCRIPTION` declara
`Encoding: UTF-8` y **387** archivos de `api/R` ya llevan tildes. Y la prueba
definitiva está dentro del propio vector de frases publicables, donde conviven

> «Empezó, todavía no llega» · «habrá que ponderar» · «El campo está rindiendo…»

con

> «Ya llego a su cuota» · «Llego a lo esperado» · «Se quedo a medias»

Unas se escribieron con tilde y otras no: es una inconsistencia, no un criterio.

Corregidas las **cinco** frases del archivo canónico
(`monitoreo_aulas_etiquetas.R`) y añadido el guard donde vive la vara: el test
que ya auditaba la jerga ahora falla si alguna frase publicable contiene una
palabra de una lista negra **sólo de casos inequívocos** —nada de «mas», «solo»
o «esta», que existen con y sin tilde según la función—. Con su control de que
la lista de frases no esté vacía, para que vaciarla no lo deje en verde por
ausencia. Mutante comprobado: quitar una tilde deja 1 rojo.

Dos tests existentes fijaban la cadena vieja y se actualizaron: cambio
deliberado de contrato, no regresión.

**Y mi propio guard falló con cero culpables**, por una trampa que vale anotar:
`vapply` devuelve el vector **con nombres**, así que filtrar sin coincidencias da
un `named character(0)` que no es `identical` a `character(0)`. Se resuelve con
`unname`.

### Lo que queda medido y NO tocado

Fuera del archivo canónico hay más frases sin tilde —`monitoreo_aulas_universitarias.R`
(8), `identificadores.R` (2), `estados_no_reconocidos.R` (2), `reconciliacion.R`
(2), `cruce_hojas.R`, `reemplazos.R`, `efectividad_seguimiento.R`, y el aviso del
sexo que escribí yo hoy en `avance_cuota.R`—. **No se barren a ciegas**: en esa
misma búsqueda aparecen `"validas"`, `"seleccion"` y `"quien aplico"` que son
**claves internas**, no texto, y tildarlas rompería el consumo. Hay que separar
cadena mostrada de clave antes de tocar, una por una.

---

## 55 · Un contrato `equal` que el propio archivo desmentía (ítem 37)

`consultas/reemplazos` reporta `equal-frame-drift` sobre
`monitoring-aulas-cadenas` con `memberHeights: [13, 852]`. Trece píxeles es un
`<h4>`, no una tarjeta.

La causa es un malentendido de la declaración, y vale escribirlo porque es fácil
de repetir: **`data-qa-geometry-group` en un elemento repetido no declara «estos
hermanos miden igual»**. Declara «este elemento es un grupo, y sus miembros son
sus hijos». El grupo estaba puesto en cada `<section>` repetida por desenlace con
`contract="equal"`, y su comentario decía «sus miembros son variantes del MISMO
rol» pensando en las secciones **entre sí**. El gate lo leyó como debía: exigió
que el `<h4>` del título midiera lo mismo que el contenido.

Y el contrato correcto lo dice el propio archivo doce líneas más abajo: «las
abiertas van en tabla y las cerradas narradas: **no es una inconsistencia, es que
son dos preguntas distintas**». Dos presentaciones y dos volúmenes distintos son
secciones independientes → `intrinsic`. Con eso, `geometryIssues` pasa de 1 a 0 y
el frontend queda en 2.081 tests con typecheck limpio.

**Declarar el grupo fue correcto** —sin él la superficie era invisible para el
gate, ni conforme ni no conforme—; lo que estaba mal era el contrato. Es la
tercera forma distinta que toma el mismo error de fondo esta semana: **una
superficie declara algo que no es lo que el gate va a medir**.

### Sospecha levantada y descartada

La columna «Reservas» dice **4 en las 180 filas**, y el libro declara 507
reservas para 193 cadenas: 4 × 193 = 772 > 507. Parecía una constante falsa.
No lo es: la columna es `eslabones.length − 1` —las reservas que el diseño
asignó a esa cadena, cuatro para todas— y el 507 del «Status de aplicación» son
sólo las que están **despiertas**; el resto duerme o está en el banco. Las dos
cifras son compatibles. Segunda sospecha del día que mirar levanta y medir
descarta.

---

## 56 · `calidad/registro`: sana, y el límite del arreglo de las tildes

`geometryIssues=0`. Cuatro sospechas y ninguna era defecto:

- **«Aulas aplicadas (campo)» con 700 filas donde 652 no tienen registro.** El
  título parece prometer 700 aplicadas. Ya está resuelto y documentado en
  `RegistroDeCampo.tsx:449`: el nombre es deliberado —es la hoja del libro— y el
  antetítulo «HOJA DEL LIBRO» más el contador «652 de 700 todavía sin registrar»
  lo convierten en lo que es, un destino del libro.
- **«Ningún equipo se separa de las 18.0 encuestas por aula» con Perez en 25,0 y
  Rojas en 14,5.** No se contradice: «no se separa» significa que su banda
  —±31,4 y ±22,2— contiene la media del estudio, y la nota del pie lo explica.
- **«8 rechazos/100» con una sola aula.** Está normalizado por cien encuestas y
  el pie lo dice: «en bruto, quien hace más aulas parece siempre el más
  problemático».
- **Punto decimal en «18.0» y «94.9».** Es el formato correcto de `es-PE`, que
  usa coma para los miles y punto para los decimales.

### El límite del ítem 36, y hay que respetarlo

En esta pantalla se leen «El docente **pidio** empezar al final de la clase» y
«Docente **cancelo** la clase», sin tilde. **No se tocan.** Son observaciones
tecleadas por el campo, o sea datos del cliente, y la regla es explícita: «la
información tal cual como viene en la DTI, no cambies nada ni normalices».

Queda escrito porque es exactamente lo contrario de lo que acabo de hacer en el
ítem 36 y la distinción es fácil de perder: **las frases que escribe la app se
tildan; el dato que llega de la fuente se muestra tal cual.** Un barrido de
tildes que no distinga las dos cosas corrompe datos de cliente.

Tercer tick seguido en que mirar levanta sospechas y medirlas las descarta. Sin
cambios de código.

---

## 57 · «Días de campo» eran dos cosas (ítem 38), y los siete paneles de abajo

Bajé por fin al pliegue de `avance/rendimiento` —los siete paneles que llevaban
todo el loop sin mirarse—. `geometryIssues=0` en los doce grupos.

**Cinco están sanos y cuadran entre sí**: «Qué está rindiendo más» (2 aulas · 54
encuestas en ARQUITECTURA), «Quién consigue más» (Rojas 29 + Perez 25 = 54),
«Franja horaria» (29 + 25 = 54) y «Día de la semana» (Martes, 54) cuentan lo
mismo por cuatro cortes distintos y suman igual. «Cuándo se termina de aplicar el
plan» y «Consumo de la reserva» declaran su vacío con su causa —«hacen falta al
menos tres días de campo para proyectar» y «ningún curso-horario ha sido
reemplazado todavía»—.

**Y el sexto destapó una palabra con dos significados.**

| panel | dice | cuenta |
|---|---|---|
| Resumen › Ritmo | «667 respuestas en **5 días de campo**» | días con RESPUESTAS en plataforma (1/9–5/9) |
| Rendimiento › Encuestas por día | «**2 días de campo**, de 01/09 a 02/09» | días con PARTE de campo |

Los dos cálculos son correctos —uno sale de `ritmo.dias_con_campo` del motor y
el otro de `fechas.length` sobre los partes— y son **dos ejes**, justo la
distinción plataforma/parte que Gonzalo lleva repitiendo. Lo que no puede ser es
que compartan las mismas tres palabras a dos pestañas de distancia.

Ahora dicen «**5 días de recolección**» y «**2 días con parte de campo**».
Verificado en pantalla, los dos. No se toca ningún cálculo: era el rótulo.

Es la misma familia que el «Aplicada 0 / APLICADAS 48» del ítem 32 y que las dos
lecturas de «meta»: **la app tiene dos ejes reales —lo que declara el campo y lo
que llega a la plataforma— y cada vez que un rótulo no dice cuál de los dos es,
las cifras se leen como una contradicción.**

---

## 58 · El mismo cociente con dos formatos, dentro del mismo panel (ítem 39)

`consultas/parte` es de los paneles mejor construidos del perfil: el embudo
cuadra exacto —28 + 31 = 59 asistentes, −2 rechazos, −3 duplicados, 54
efectivas— y declara su límite con la causa: «No se puede saber si alguna aula se
aplicó en otro salón: el plan agendado no trae salón para ningún curso-horario».

Lo que no cuadraba era el formato. La frase decía **«92%»** —entero y con el
símbolo pegado— y la columna «% asistencia» de la tabla que tiene justo debajo
decía **«89.3 %»** y **«93.5 %»**. El mismo cociente, 54 de 59, con dos formatos
a dos centímetros; y el 91,5 % que publica «Qué está rindiendo más» por otro
camino tampoco casaba con el 92.

La causa: `embudoDelAula.ts` redondeaba a entero **en el modelo**. Redondear es
una decisión de presentación y va en la vista, que además es donde vive el
formato de la casa —un decimal y espacio antes del «%», como en
`aulasPresentation.ts:575`, `AulasTextoAbierto`, `AulasAlcanceDelBanco` y
`AulasAvanceParaCliente`—. Ahora dice **91.5 %** y coincide.

El test del modelo pasa a `Math.round(p.pct)`: sigue fijando el mismo contrato
—100, 90, 70— sin atarlo a una decisión de formato que no es suya.

Verificado en pantalla. Y de paso el `aria-label` de cada barra, que llevaba el
mismo entero pegado.

---

## 59 · «Agendadas» eran las que no tenían fecha (ítem 40)

`modelo/facultad`, primera vez. La tarjeta decía:

> **SIN EMPEZAR · 145 ·** *agendadas que aún no salen a campo*

y el panel de debajo, en la misma pantalla:

> «193 cursos-horario en 15 facultades, por el día en que empieza cada una ·
> **145 sin fecha**, al final de su facultad»

Si están sin fecha no están agendadas. Y el «Status de aplicación» de la misma
sesión lo confirma: **«Agendada 0»**.

Medido: `sinSalirACampo` suma los tramos `pendiente` («Sin agendar») y `lista`
(«Agendada») —lo dice su propio comentario en `estadoDeAplicacion.ts`— y la pista
nombraba **sólo la segunda mitad, que es la que valía cero**.

No es cosmético: **invierte la decisión**. Una agendada se espera; una sin fecha
hay que salir a agendarla, y son 145 de 193. La pista declara ahora el reparto —
«todavía sin fecha: hay que agendarlas» cuando ninguna tiene fecha, «agendadas,
todavía sin salir a campo» cuando todas la tienen, y «60 sin fecha · 40
agendadas» cuando es mezcla, que es el caso de un operativo a medias y el que más
engaña.

Cuatro tests, con el mutante comprobado (volver a la pista fija deja 3 rojos) y
con el control de que el valor sigue siendo la suma de los dos tramos, para que
nadie «simplifique» la pista tomando uno solo y deje al número hablando de otro
conjunto. Verificado en pantalla.

Es la quinta vez que el mismo eje —lo que declara el campo contra lo que hay
realmente— produce un rótulo que dice lo contrario de lo que muestra.

---

## 60 · `calidad/base`: la tentación de formatear el dato del cliente

Vista sana, `geometryIssues=0`, y todo lo que podría leerse como vacío está
declarado: «Este estudio **no ha declarado** qué es un aula válida» con su enlace
para hacerlo; «0 Los dos · 0 Sólo uno · 0 Ninguno» con «193 aulas sin sus dos
umbrales en la hoja · 100 %»; «0 efectivas de 0 evaluadas» con «193 sin evaluar
en el libro».

Lo que sí tienta: la columna «% DE EFECTIVAS…» muestra **`0.409434`,
`0.8083333`, `0.6428571`** —proporciones crudas con siete decimales bajo un
rótulo que dice «%»—. Después de haber pasado el día unificando formatos, la
mano se va sola.

**Sería el error.** La cabecera declara «193 filas de la hoja · 18 columnas en la
tabla · **lo que calcula el equipo**», y el propio panel lo repite: «Las 3
columnas de validador son del equipo: las llena en su Excel y la app no las
calcula» y «Es el corte que el equipo escribió en el libro, no un criterio que la
app verifique». Es un volcado del libro, con los valores y los nombres del libro.

Es el mismo límite del ítem 36 con otra cara, y conviene tenerlo junto: **lo que
la app calcula, la app lo formatea; lo que la app vuelca, se muestra tal cual.**
La señal que los separa está en la propia superficie —«lo que calcula el
equipo», «de la hoja», «del libro»—, y cuando está, es una instrucción.

Cuarto tick seguido en que mirar levanta una sospecha y medirla la descarta.
Sin cambios de código.

---

## 61 · La lista de a quién llamar tenía 38 aulas ya aplicadas (ítem 41)

`modelo/contacto`, primera vez. Aplicando la comprobación barata —de qué conjunto
habla cada número— salieron dos que no podían ser los dos ciertos:

- la tarjeta: «SIN EMPEZAR **145**» (193 − 48 aplicadas);
- el panel: «**183** cursos-horario siguen sin cita» y «Por contactar **183**»,
  con «Citas fijadas **10**». Y 10 + 183 = 193.

Con 48 aplicadas y sólo 10 citadas, 38 aulas aplicadas tenían que estar en los
183. Medido en el código y confirmado: `tieneCita()` mira **`sample_status`**, y
en cuanto un aula se aplica ese estado deja de ser «agendada», así que el aula
**vuelve a la cola de contacto**.

Es otra vez el par de ejes de siempre —`sample_status` es el del muestreo y
`operational_status` el del operativo— y aquí manda el segundo sin discusión:
llamar a un aula que ya se aplicó es trabajo perdido, y esta pantalla existe para
repartir llamadas. El propio modelo ya distinguía el caso: las **citadas**
llevaban un flag `aplicada`; las pendientes no lo miraban.

Ahora la cola las excluye **y lo declara**:

> «145 cursos-horario siguen sin cita · el que más lleva va por 0 intentos · *38
> más ya se aplicaron sin cita registrada, así que no están en la cola*»

Y el 145 es exactamente el «SIN EMPEZAR 145» de la tarjeta de arriba: los dos
números que no cuadraban son ahora el mismo. Declararlo importa: un contador que
baja de 183 a 145 sin decir por qué deja a quien reparte llamadas sin saber si
mejoró el dato o se perdió trabajo.

Cuatro tests con mutante comprobado, incluido el control de que las **citadas**
aplicadas siguen en su lista —si la exclusión se les aplicara también,
desaparecerían las citas conseguidas, que son el resultado del trabajo de quien
agenda.

**Sexta vez** que el eje campo/operativo produce un defecto, y la primera en que
manda a alguien a hacer trabajo inútil en vez de sólo confundir una cifra.

---

## 62 · `modelo/carga`: un panel de 1.000 px con un aviso de 60 (ítem 42)

El vacío está **bien declarado** y es de los mejores del perfil: dice la causa y
además cómo se llena —«El plan no trae el horario de los cursos-horario. Se
completa al construir el marco desde el catálogo de Cursos-Horarios, que es de
donde sale el rango de cada sesión»—.

Lo que está mal es la composición: ese aviso vive en un panel que ocupa **todo el
alto de la pantalla**, unos 1.000 px, con ~940 de vacío absoluto debajo. Es C3 —
«un hueco sin borde, material, propósito ni dueño no es aire: es rotura de
composición».

**Y el gate da `geometryIssues=0`, correctamente.** El `capacity="owned"` está en
la `<p>` del aviso, que es el contenedor de datos, y esa `<p>` mide lo que mide
su texto: sin drift. La norma es explícita en que `capacity` va al contenedor de
datos y **nunca al panel**, así que el gate hace lo que debe; el hueco que sobra
es del marco, y eso no lo mira nadie.

Medido el porqué: `AulasSeccionModelo` envuelve el panel en un stack con
`grid-template-rows: auto minmax(0, 1fr)` (`aulasMonitoreo.css:178`), y su propio
comentario explica que esa regla existe para que la tabla de «Aulas agendadas» no
se quede en 88 px. Correcto para `agenda`; en `carga` la segunda fila es este
panel, que recibe todo el sobrante aunque su contenido sea un párrafo.

Otra vez **la superficie declara una cosa y hace otra**: el `<section>` dice
`data-qa-geometry-contract="intrinsic"` —«sección única en su pestaña, así que su
geometría es intrínseca», dice su comentario— y el CSS del stack la estira a
`1fr`. Séptima forma del mismo error de fondo.

**Reparación propuesta, NO aplicada** —exige una decisión y no la improviso al
final de un tick—: el panel sólo debe tomar `1fr` cuando hay malla que dibujar.
Eso pide que `AulasSeccionModelo` sepa si hay horario, y hoy sólo lo sabe
`AulasCargaDeCampo` por dentro (`conHorario`). La salida limpia es exportar de
ese módulo un `hayHorarioDeCurso(filas)` y usarlo en los dos sitios, en vez de
duplicar el cálculo. Con él, `align-self: start` en la rama sin malla.

Lo que **no** vale: poner `align-content: start` dentro del panel. Subiría el
contenido pero dejaría el marco igual de alto, que es exactamente el hueco sin
dueño que la norma rechaza.

---

## 63 · El ítem 42, reparado sin duplicar el cálculo

La reparación que quedó especificada en la 62, hecha:
`hayHorarioDeCurso(plan)` sale a `cargaDeCampo.ts` —donde vive `aulasDelPlan()`,
que es quien lo sabe— y lo preguntan los dos: el panel para elegir entre la malla
y su aviso, y `AulasSeccionModelo` para decidir si le da el `1fr` del stack. Sin
malla, `align-self: start`.

Medido en pantalla: el panel pasa de ~1.000 px a ~125. El vacío de abajo deja de
estar dentro de un marco; es el fondo de la página, que sí tiene dueño.

**Dos cosas del proceso que valen más que el arreglo.**

La primera: `conHorario` **no se pudo eliminar**, porque el aviso del pie —«N de
M aulas no declaran horario»— lo necesita. Así que quedan dos expresiones del
mismo número: `titulares − sinHorario` en el panel y `unidades.length > 0` en el
helper. Son iguales por definición, pero «por definición» es exactamente lo que
se rompe cuando alguien toca `aulasDelPlan()`. Van atadas con un test de
equivalencia sobre cuatro casos —sin filas, todas sin horario, mezcla, todas con
horario—, que es más barato que forzar una sola expresión y menos frágil que
confiar en el comentario.

La segunda: el typecheck me paró **tres veces** en este arreglo —un `conHorario`
huérfano, un import mal cosido y un `eje: "fecha"` que no existe (los valores son
`"semana" | "calendario"`)—. Las tres las habría dado por buenas si no lo hubiera
corrido después de cada paso; y las tres veces `vitest` estaba en **verde**,
porque los tests no compilan el archivo entero. Con TS estricto, el typecheck no
es un trámite del final: es el que sabe.

---

## 64 · `calidad/abiertas`: dos tildes más, y por qué el guard no se extiende

Vista sana en todo lo demás: el vacío declara su causa **y** lo que se vería al
resolverla —«Con el instrumento cargado, aquí se leen las respuestas de cada
pregunta abierta ordenadas por las que conviene mirar primero»—, y el panel mide
lo que mide su contenido, lo que confirma que el arreglo del stack de la 63 era
específico de Agenda y no tocó nada más.

Dos frases de `monitoreo_texto_abierto.R` seguían sin tildes: «no trae
instrumento, **asi** que no se sabe **que** preguntas son abiertas» y «o no
**estan** en la base». Corregidas. Nótese que «qué» no puede vivir en una lista
negra —sin tilde es correcto casi siempre— así que este caso no lo habría cazado
el guard del ítem 36 ni ningún guard razonable: lo cazó mirar la pantalla.

### Por qué NO extiendo el guard, medido

Probé la heurística obvia —auditar las cadenas **largas** (>30 caracteres) de
`api/R/monitoreo_*.R`, asumiendo que una clave interna no llega a esa longitud—.
Da **43 ocurrencias** y no sirve:

- muchas son **expresiones regulares**, no frases:
  `"mail|correo|telefono|celular|phone|codigo|cod|pulso|cv_id|^cv$|^id$"`,
  `"^(codpulso|caso|estado|distrito|...|validas|válidas|cuota|...)\\b"`. Un guard
  que las marque obliga a exentarlas una a una y muere de ruido;
- y las que sí son frases están en `monitoreo_router_acreditacion.R`,
  `monitoreo_router_handoff.R` y `monitoreo_engine.R`, o sea en los perfiles de
  **acreditación y territorial**, fuera de este loop.

Distinguir regex de frase con precisión cuesta más de lo que vale, y un guard
ruidoso acaba silenciado —que es peor que no tenerlo, como ya me pasó con el
contrato estático del `capacity-drift`—. Queda escrito el alcance por si se
quiere una pasada deliberada por Monitoreo entero: son ~15 frases reales fuera de
aulas.

---

## 65 · `consultas/extras`: la última vista, y el perfil queda recorrido

Cuadra exacto, y esta vez lo comprobé número a número:

- 30.808 mujeres + 31.596 hombres = **62.404 alumnos** ✓
- los quince chips por facultad —467, 351, 233, 227, 158, 127, 104, 63, 52, 47,
  36, 22, 16, 12, 1— suman **1.916** ✓
- y la limitación está declarada con su causa: «Para saber si el banco alcanza
  hace falta la hoja "Base de control" del libro: de ahí sale la tasa con la que
  responde un aula, y sin ella proyectar sus alumnos sería inventar».

Lo único: con el chip «Todas» activo, la tabla enseña **sólo** aulas de Estudios
Generales Letras, lo que se lee como un filtro roto. No lo es —la lista va por
mujeres descendente, y EGL trae 27 mujeres por aula contra las 8 de Ciencias e
Ingeniería— y el `sort` lo razona: «el caso que motiva la vista es *me faltan
mujeres en esta facultad*». Faltaba decirlo en pantalla.

Ahora la frase del inventario termina en «**· las que más mujeres traen
primero**». Va en `AulasBancoExtras`, **donde está el `sort`**, y no en el
subtítulo del panel de fuera: si lo pongo allí, cambiar el orden aquí deja el
rótulo mintiendo, que es el defecto que llevo todo el loop cerrando y sería
absurdo crearlo yo en el último panel.

### El perfil, recorrido

`fuentes` · `modelo/{agenda,facultad,contacto,carga}` ·
`calidad/{controles,registro,base,abiertas}` ·
`consultas/{brechas,reemplazos,parte,extras}` ·
`avance/{cuotas,resumen,estratos,rendimiento,efectividad,salidas}`. Diecinueve
vistas. Quedan sólo dos paneles bajo el pliegue de `avance/resumen` —«Dónde falta
más» y «Cursos-horario vencidos sin aplicar»—, que piden una captura alta.

---

## 66 · Dos funciones del mismo módulo redondeaban distinto (ítem 45)

«Dónde falta más», bajo el pliegue de `avance/resumen`, cuadra celda a celda:
138 + 394 = 532, 275 + 187 = 462, 132 + 316 = 448, 251 + 125 = 376,
110 + 51 = 161, 84 + 76 = 160 ✓, y coinciden con la tabla del cliente tras el
arreglo del ítem 19.

Lo que no: el «**20%**» de al lado. Es el avance conseguido —130 de 662— y la
tabla del cliente publica **19.6 %** del mismo cociente. Medido, y la causa es
peor que un formato:

| función | redondeo |
|---|---|
| `avanceEnRespuestas()` | `Math.round(1000·x/meta)/10` → **19,6** |
| `perfilDesdeElMotor()` | `Math.round(100·x/meta)` → **20** |

Las dos calculan el mismo avance, y el panel **usa una u otra según llegue
`avance_por_facultad` del motor**. O sea que la misma pantalla cambiaba de
precisión según la fuente, sin que nadie pudiera saber cuál estaba viendo.
Unificadas en un decimal, con dos tests que lo fijan.

Y el rótulo: «532 respuestas faltan · 20%» pegaba dos cifras de sentido opuesto y
se leía como «falta el 20 %». Ahora dice «**19.6 % conseguido**».

### Lo que me delató el guard de la casa

Al formatear escribí un `pctCasa()` local… **y ya había escrito un `pctTexto()`
local en el embudo dos ticks antes**. Dos helpers con el mismo propósito: el
problema que llevo todo el loop cerrando, creado por mí, dos veces.

Lo cazó `cifrasConFormato.test.ts`, un guard que exige que toda cifra
interpolada pase por un formateador conocido y que no reconocía ninguno de los
dos. Su cabecera ya decía que la lista «crece cuando aparezca otra forma», así
que la respuesta correcta no era silenciarlo: **un solo `pctPerfil()` en
`kpisDeAulas.ts`** —junto a `fmt` y `fmtCuenta`, de donde todo el perfil
importa—, usado por los dos paneles y añadido al detector.

Ese guard lleva además su propio control de que el regex funciona («sin esto, un
regex roto daría verde en los treinta y pico archivos sin haber mirado
ninguno»). Es el mismo criterio con el que escribí los míos hoy, y aquí me
devolvió el favor.

---

## 67 · Segunda vuelta: el simulacro abre las ramas que nunca se vieron

Todo el loop se ha medido sobre `aulas_con_respuestas.pulso` —48 aplicadas, 3
partes, campo recién empezado— así que media app salía por su rama vacía. Traídos
al scratchpad de esta sesión los tres simulacros de mitad de operativo
(`HSVG2026_sem15_{como_2025,campo_flojo,campo_malo}.pulso`, 1.424 filas de plan,
`route_selected = TRUE`).

**Con `como_2025` aparecen ramas que nadie había visto, y cuadran:**

- `consultas/reemplazos`: «Cerraron con reemplazo **14**» (antes 0), y
  «62 cerraron con el titular · 14 con un reemplazo · 98 sin cerrar» = **174
  cadenas** ✓. La columna «Lo más cerca» enseña por fin reservas ganando —«R
  89.1, 16 de 25»—, que es para lo que existe el panel. Y «Reservas» varía
  (11, 9, 8…), lo que confirma que el 4 constante del otro proyecto era del
  dato y no un defecto, como se midió en la 55.
- `avance/cuotas`: «Cierran con lo agendado **23** de 30» (antes 0), «2.668 de
  2.500 personas · **21 de 30 celdas cumplidas**», «Cuota por recoger 170 · 90
  hombres · 80 mujeres» (90 + 80 = 170 ✓).

Y ahí se gana el sueldo la nota del ítem 19: **se llevan 2.668 sobre una meta de
2.500 y aun así faltan 170**, porque cubrir de más en una facultad —o en un
sexo— no cubre lo que falta en otra. Sin esa frase, esas dos cifras juntas se
leen como un error.

### Dos hallazgos nuevos, medidos y sin tocar

**(a) La resta no cuadra a la vista.** En EDUCACION · Hombres:

> «No va a llegar: **falta 1 encuesta** · 45% de cerrar · Lleva 1 de 4: **faltan
> 3** y las aulas que faltan por aplicar **aportan 3**.»

3 − 3 = 0, no 1. Lo más probable es que el aporte real sea 2,x y el déficit 0,y,
y que cada cifra se redondee por su lado —el déficit hacia arriba, como manda la
regla cauta, y el aporte hacia abajo—. Las dos serían correctas y la frase, no.
Es el patrón del 2.824/2.825, y aquí **dentro de una sola oración**.

**(b) Concordancia.** «**1** de 30 celdas con objetivo no **van** a llegar».

Ninguno se toca hasta medirlo: la (a) exige ver de dónde salen las tres cifras
—`brecha`, `aporte_pendiente` y el «faltan N» del veredicto— y con qué redondeo
llega cada una.

---

## 68 · El aporte se prometía de más, con la regla escrita al lado (ítems 46 y 47)

Medidas las tres cifras de «No va a llegar: falta 1 encuesta · Lleva 1 de 4:
faltan 3 y las aulas que faltan por aplicar aportan 3»:

| cifra | de dónde | formato |
|---|---|---|
| «falta 1 encuesta» | `.mac_etiqueta_estado(estado, brecha)` en R | entero |
| «faltan 3» | `cuota − logrado` en el frontend | crudo |
| «aportan 3» | `aporte_pendiente` | `fmtCuenta`, **hacia arriba** |

El aporte real era **2,1** y subía a 3. Por eso 3 − 3 = 0 en pantalla mientras el
veredicto decía 1.

**Y el repo ya tenía la regla escrita, aplicada al revés.** El comentario de
`.mard_personas()` en `monitoreo_aulas_reserva_dirigida.R` —del ítem 13, de este
mismo loop— dice:

> «**Hacia abajo y no al más cercano.** Es lo que un aula va a APORTAR, no lo que
> hay que alcanzar: prometer 17 cuando se esperan 16,6 es prometer de más…
> `fmtCuenta()` del frontend redondea hacia arriba por el motivo contrario —una
> meta que hay que cumplir— y las dos reglas son correctas en su sitio.»

`fmtCuenta` estaba en el sitio equivocado. Ahora hay `fmtAporte()` junto a
`fmt`/`fmtCuenta`/`pctPerfil`, con el porqué y añadido al detector de
`cifrasConFormato`. Verificado: «faltan 3 … **aportan 2**» y el veredicto «falta
1 encuesta» cuadran.

De paso el ítem 47: «1 de 30 celdas con objetivo no **van** a llegar» → «no
**va**». Sólo se veía con este simulacro, que es el primero donde ese contador
baja a uno.

### El test del epsilon estaba mal, no el código

Escribí un control «un 3 guardado como 2,9999999 sigue siendo 3» y falló. El
equivocado era el test: la tolerancia de la casa es `1e-9` —la misma que usa
`.mard_personas()` en R— y 2,9999999 se aparta `1e-7`. Un 2,9999999 **de verdad**
debe redondearse a 2; lo que se tolera es el ruido binario, no un decimal real.
El test quedó fijando las dos cosas: `3 − 1e-12` da 3, y `2,9999999` da 2.

Es la tercera vez hoy que un rojo mío resultó ser un test equivocado y no un
defecto —`named character(0)`, el `eje: "fecha"` inexistente y éste—, y las tres
veces la salida fue alinearse con la regla que el repo ya tenía en vez de
aflojar la comprobación.

---

## 69 · «Repartido en 15 facultades» un déficit de 1 (ítem 48)

Con datos reales el gráfico de `avance/estratos` se ve por fin como debe: treinta
barras de tres tramos, las marcas de cuota visibles, ordenado por déficit. Y su
pie —**que edité yo en el ítem 15**— decía:

> «quedaría un déficit de **1 respuestas**, repartido en **15 facultades**.
> 14 alcanzan su cuota en los dos sexos.»

Dos defectos en una frase, y los dos sólo aparecen cuando el número baja a uno,
que es justo lo que el simulacro de mitad de operativo hace posible:

- **concordancia**: «1 respuestas»;
- y el grave: **`filas.length` son TODAS las facultades del gráfico**, cerradas
  incluidas. Un déficit de 1 está en una facultad; decir quince manda a buscar en
  catorce sitios donde no hay nada. Ahora cuenta las que ponen algo en ese
  déficit —`filas.filter((f) => f.deficit > 0)`— y cuando no hay ninguna, la
  frase no menciona reparto.

Verificado: «un déficit de **1 respuesta**, repartido en **1 facultad**».

Es la misma familia del ítem 40 —«SIN EMPEZAR 145 · agendadas» sobre 145 sin
fecha—: **un rótulo que nombra un conjunto distinto del que cuenta el número**.
Y es la segunda vez que lo cometo yo al redactar una frase.

### Anotado sin tocar (ítem 49)

La tabla de estratos publica «88.2», «85.7», «66.4» con un decimal y «**17**» y
«**100**» sin él, en la misma columna. Es `maximumFractionDigits` sin
`minimumFractionDigits`. Mismo patrón que el ítem 39; se repara con
`pctPerfil()`, pero hay que comprobar antes si esas columnas son porcentajes o
índices —«Avance de cursos-horario» y «Avance de respuestas» podrían no llevar
símbolo a propósito—.

---

## 70 · La lista cerrada se tragó dos columnas, y el guard vecino completó el arreglo

El «88.2» junto a «17» y «100» de la tabla de estratos no era un problema de
`minimumFractionDigits`: era que **esas dos columnas no se reconocían como
porcentaje**. `COLUMNAS_DE_PORCENTAJE` es un `Set` escrito a mano y
`avance_aulas_pct` / `avance_respuestas_pct` no estaban en él, pese a acabar en
`_pct` como todas las demás. Un número que no se reconoce como porcentaje se
pinta crudo, y de ahí la mezcla.

**No es la primera vez en esa misma lista.** El comentario de `progress_pct` dice
literalmente: «Sin ella, "Avance" enseñaba "62.3" a secas». Se arregló una
entrada y las dos hermanas se quedaron fuera, sin nada que lo vigilara. Es la
lista cerrada que se traga lo que no reconoce, con el agravante de que el
síntoma ya estaba documentado tres líneas más arriba.

`columnasDePorcentaje.contract.test.ts` cierra la familia: **toda clave `_pct`
con etiqueta tiene que estar en la lista**, con su control de que el mapa no esté
vacío. Mutante comprobado.

### Y el guard vecino me obligó a completar el arreglo

Al meterlas en la lista, **falló un contrato que ya existía**: «todo campo de la
lista lleva "%" o "vs" en su rótulo». Mis dos etiquetas eran «Avance de
cursos-horario» y «Avance de respuestas», sin símbolo.

Tenía razón, y de paso contestó la pregunta que yo había dejado abierta en el
ítem 49 —«comprobar antes si son porcentajes o índices»—: si entran en la lista,
son porcentajes, y entonces el rótulo debe decirlo. Ahora son «**% Avance de
cursos-horario**» y «**% Avance de respuestas**», y la columna publica «88.2 %»
y «66.4 %».

Dos guards de la casa en un mismo arreglo: uno que escribí hoy y otro que ya
estaba. El segundo es el que lo dejó bien.

---

## 71 · El acumulado cuenta el parte y no lo decía (ítem 50)

Con datos de mitad de operativo el gráfico se ve entero por primera vez: las tres
líneas, la banda del día a día y —esto valida el ítem 26— **las cuotas por sexo
dibujadas**, «Hombres 1.291/1.261 del estudio ✓», porque aquí sí caben en la
escala. Cuando no caben se declaran; cuando caben se pintan.

Su pie decía «**2.817** de 2.771 encuestas que el plan espera de las aulas
visitadas» mientras la banda decía «**2.668** válidas». Lo conseguido en 152
aulas no puede superar el total de válidas, así que el numerador era otra cosa.
Medido: `efectivasAcumuladas` suma `effective_surveys` de los **partes de campo**
(`ritmoPorFacultad.ts:84`); el campo declaró 149 más de las que pasaron el filtro
de la plataforma.

El panel vecino sí lo declara —«encuestas **del parte**, por aula visitada»— y
éste no. Ahora dice «Acumulado por día · **encuestas del parte contra la meta**».
Cuál de los dos ejes DEBE mandar es otra pregunta, es de Gonzalo y ya está
abierta como ítem 17; esto sólo dice cuál se está mirando.

### Y lo que eso destapa, medido pero SIN tocar (ítem 51)

En la misma leyenda: «Hombres **1.291**/1.261» y «Mujeres **1.377**/1.239».
**1.291 + 1.377 = 2.668**, que son exactamente las válidas de plataforma. O sea
que en un mismo gráfico conviven **la línea verde del parte (2.817) y las dos
líneas de sexo de la plataforma (2.668)**.

Hay una nota al pie que ya explica que las cifras de sexo no suman la verde,
pero por otro motivo: «el reparto sólo se conoce en las aulas cuyo libro lo
declara». Aquí el reparto está **completo** —suman todas las válidas— y la
diferencia con la verde es el eje, no la cobertura. **La explicación existente no
cubre este caso**, y escribir una nueva sin medir de dónde sale cada serie sería
apostar. Se mide antes de tocar.

---

## 72 · Dos causas para la misma diferencia, y sólo una tenía nota (ítem 51)

Medidas las dos ramas que producen las líneas de sexo del acumulado:

1. **Del libro** (`seriesDelLibro`, cuando `hayLibroPorSexo`): acumulados por sexo
   que declara el parte.
2. **El respaldo** (`cuotasVisibles`): el **nivel** sale de las respuestas
   atribuidas —plataforma— y **la forma de la curva** se toma del acumulado
   diario del parte, que es lo único con fecha. El comentario lo razona: «el
   nivel de hoy es el que declara la cuota; la forma se toma del acumulado
   diario».

Con `como_2025` está activa la segunda: 1.291 + 1.377 = **2.668**, las válidas de
plataforma, contra **2.817** del parte en la verde.

**Y la nota que explicaba la diferencia sólo cubría la rama 1.** Está bien
guardada —`cubiertasPorSexo` sólo deja de ser `null` cuando el reparto viene del
libro— así que en el respaldo no salía ninguna, y ahí la diferencia no tenía
explicación en pantalla. Peor: la explicación disponible («el reparto sólo se
conoce en las aulas cuyo libro lo declara») **habría sido falsa**, porque aquí el
reparto está completo.

Ahora el respaldo tiene la suya: «**las dos de sexo salen de las respuestas
atribuidas y la verde, del parte: por eso no suman**». Verificado en pantalla.

La lección, que es la del ítem 35 en otra forma: **un mismo síntoma puede tener
dos causas, y una nota que sólo explica una es peor que ninguna** — porque el
lector la aplica al caso que no le toca. Lo que hizo falta para verlo fue un
proyecto donde la segunda rama se activa; con el campo recién empezado nunca lo
hacía.
