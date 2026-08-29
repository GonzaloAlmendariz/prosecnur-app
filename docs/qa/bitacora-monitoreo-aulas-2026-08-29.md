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

## Pendiente para la siguiente iteración

1. **Ver los siete.** Una captura por pestaña tocada, con `--wait-selector`.
2. Su respuesta sobre la estructura de Avance
   (`auditoria-avance-aulas-2026-08-29.md`): retirar Estratos, fundir
   Efectividad, y las dos nuevas —Decisiones y Calendario—.
3. El registro académico de las etiquetas (ítem 12 del checklist), con el mapeo
   propuesto y sin aplicar.
