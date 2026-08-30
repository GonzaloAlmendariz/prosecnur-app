# Checklist — registro académico y lectura no técnica de Monitoreo de aulas

Encargo de Gonzalo el 2026-08-29, al reanudar el loop. Nueve indicaciones. Se
dibuja **entero** cada vez que se menciona; sólo él lo da por terminado.

> «evaluar conceptualmente todos los elementos de cada una de las pestañas,
> evaluar si se pueden agregar dos pestañas más, solo sí y solo sí lo amerita,
> ver bien la lógica, ver bien qué se entienda bien en español las cosas, los
> conceptos, los términos que utilizas, tratar de no utilizar demasiadas jergas
> o no utilizar ninguna, dado que estamos en un contexto académico, validar que
> todos los gráficos se vean bien, se entiendan y que avance sirva como un
> mecanismo de revisión no técnica»

## Lo que cambia respecto del loop anterior

Las primeras 51 entradas cazaron **defectos de cifra**: un número que no era el
que su rótulo prometía. Este encargo cambia el criterio de aceptación: ahora una
superficie puede tener todas sus cifras correctas y **seguir sin pasar**, porque
el lector al que va dirigida —una autoridad universitaria, no un analista— no
puede reconstruir qué le están diciendo.

**La vara**: cada elemento de Avance tiene que poder leerlo alguien que no
participó en el diseño muestral. Si para entender una cifra hace falta saber qué
es un estrato, un τ o un *deff*, el elemento no pasa.

## Tabla

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| A | Comprobación visual de cada pestaña, no lectura de código | runner `ui-quick-check` + capturas | ◐ en curso |
| B | Registro académico en todo texto publicable | `monitoreo_aulas_etiquetas.R` + rótulos del perfil | ☐ |
| C | Evaluación conceptual de **cada elemento** de cada pestaña | inventario por pestaña, abajo | ☐ |
| D | ¿Faltan dos pestañas? Sólo si lo amerita | `modules.ts` + secciones del perfil | ☐ |
| E | Revisar la lógica de cada elemento | motores de `api/R/monitoreo_aulas_*.R` | ☐ |
| F | Que se entienda en español: conceptos y términos | todos los rótulos y pistas | ☐ |
| G | Sin jerga, o con la mínima indispensable | ídem | ☐ |
| H | Todos los gráficos se ven bien y se entienden | los seis gráficos del perfil | ☐ |
| I | **Avance como mecanismo de revisión no técnica** | sección `avance` completa | ☐ |

## Inventario de lo que hay que evaluar

Seis pestañas en Avance —`cuotas`, `resumen`, `estratos`, `rendimiento`,
`efectividad`, `salidas`— y trece en el resto del perfil. El inventario elemento
por elemento se va llenando conforme se miran.

## Registro de la evaluación

Se escribe abajo, una entrada por pestaña, con el elemento, el veredicto y la
frase exacta que lo delata.

---

### Vuelta 1 · Avance > Cuotas

Seis hallazgos, todos verificados en pantalla con `HSVG2026_sem15_como_2025`.

| Elemento | Decía | Dice | Por qué |
|---|---|---|---|
| Chip de procedencia | «cuota del diseño · τ 0,53» | «cuota del diseño · tasa de efectividad 53.0 %» | La letra griega sin definición. Cálculo de muestra ya había decidido «la tasa se nombra, no se escribe en griego»; Monitoreo se quedó con ella, así que el mismo número tenía dos presentaciones según el módulo |
| El mismo chip, sin tasa única | «τ —» | «tasa de efectividad sin valor único» | El guion no informaba. En `como_2025` es el caso real: las facultades tienen tasas distintas y el motor deja `NA` para no promediar a escondidas |
| Notación decimal | «88,1%» junto a «88.1 %» | «88.1 %» en las dos | Tres formateadores forzaban la coma española con `.replace(".", ",")`. `es-PE` usa **punto decimal y coma de millar**, así que la coma hacía de decimal en una tarjeta y de millar en la de al lado |
| «celda sexo × facultad» (8 sitios) | «de 30 celdas sexo × facultad» | «de 30 grupos de facultad y sexo» | Jerga de tabla estadística en la pantalla que lee una autoridad |
| Título del panel | «El avance que ve el cliente» | «Cuota asignada y encuestas logradas» | Nombraba al lector en tercera persona desde dentro del equipo, en la pantalla que ese lector abre |
| Cabeceras de columna | «La muestra que le toca» · «Lo que se lleva» | «Cuota asignada» · «Encuestas logradas» | Registro coloquial |
| Pista de Válidas | «respuestas de Kobo que pasan el filtro» | «respuestas de la plataforma que pasan los controles de validez» | «El filtro» no decía cuál; y la marca no se lee sin conocerla —además de volverse falsa en un estudio que recoja por SurveyMonkey |

**Lo que el guard de títulos evitó**: «Avance por facultad y sexo» era el nombre
natural para la tabla, y ya es el del gráfico de Estratos. El guard también
rechaza terminaciones iguales, así que «Cuánto lleva cada facultad» chocaba con
«Encuestas por día de cada facultad».

**Brecha cerrada**: `cifrasConFormato.test.ts` vigilaba cuentas pegadas a su
unidad —«aulas», «respuestas»— y por eso no podía ver un porcentaje. Se añadió
el guard de la coma forzada, que mide la operación y no necesita heurística.
