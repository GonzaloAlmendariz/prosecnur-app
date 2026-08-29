# Bitácora del trabajo en Monitoreo de aulas

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
