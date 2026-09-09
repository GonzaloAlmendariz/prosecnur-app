# Censo completo de Monitoreo › Cursos-horario › Avance

**Fecha:** 2026-09-08 · **Pedido de:** Gonzalo · **Estado:** censo cerrado, veredictos sin aprobar

> «Mantén las seis, pero haz un censo completo de absolutamente todo lo que
> tenemos, valida qué va en qué pestaña, y qué tablas son realmente relevantes y
> qué podemos mostrar de forma visual y ordenada.»

**Las seis pestañas se quedan.** Este documento no propone renombrarlas ni
fusionarlas: censa lo que hay, comprueba cada pieza contra el propósito declarado
de su pestaña, y dictamina forma (tabla o visual) pieza por pieza.

Nada se implementa hasta que Gonzalo apruebe los veredictos.

---

## 0. El total

| | |
|---|---|
| Pestañas | 6 |
| Paneles montados | 26 |
| Componentes escritos y **sin montar** | 3 |
| Tablas HTML | 10 |
| Gráficos Plotly montados | **0** (todo es barra CSS o SVG a mano) |
| Bloques de datos que publica el motor | 44 |
| Bloques **sin un solo consumidor** | 5 + 4 sub-campos + 3 espejos muertos |
| Coste de un fallo de caché del tablero | **~3,6 s** sobre 2 616 cursos-horario |

El propósito declarado de cada pestaña, tal como está en el catálogo de
navegación, es la vara con la que se juzga todo lo demás:

| Pestaña | Propósito declarado |
|---|---|
| **Metas** | Avance hacia la muestra y la sobremuestra, **por facultad y sexo** |
| **Resumen** | Avance general **del operativo** |
| **Estratos** | Avance y brecha **por estrato** |
| **Rendimiento** | **Qué rinde más**, por facultad |
| **Efectividad** | La **τ del diseño** contra la del campo |
| **Salidas** | Publicación a Sheets |

---

## 1. Censo de paneles, con veredicto de pestaña

Leyenda: **✅ está en su sitio** · **➡️ va a otra pestaña** · **❌ duplica algo que ya existe** · **⚠️ decisión pendiente**

### Banda de 7 KPIs — se pinta en las seis pestañas

Efectivas · Muestra · Avance a la muestra · Sobremuestra · Avance a la
sobremuestra · Cursos-horario aplicados · Cursos-horario planificados.
**✅** Es el encabezado de la sección, no un panel; que viaje en las seis es correcto.

### Metas — hoy 5 paneles y 5 tablas

| Panel | Forma | Veredicto |
|---|---|---|
| Cumplimiento de la cuota del estudio | barra + ranking por facultad | **✅** Es literalmente el propósito de la pestaña |
| Avance de campo en tablas (5) | 5 tablas HTML | **➡️ Salidas.** Ver §3 |
| Hombres y mujeres por facultad | barras por sexo | **✅** |
| A qué aula del banco ir | lista con chips | **✅** Es la acción que sale de la brecha por celda |
| Tamaño de cada meta (pirámide) | pirámide CSS | **⚠️** Dice el *tamaño* de la meta, no el avance; duplica el eje del panel anterior con más tinta |

**Entra en Metas:** «Avance por facultad y sexo», hoy en Estratos — ver abajo.

### Resumen — hoy 7 paneles, 1 tabla

| Panel | Forma | Veredicto |
|---|---|---|
| Cumplimiento aula por aula | barra de 3 tramos | **✅** |
| Ritmo de la recolección | lista día a día con barra | **✅** pero ver R6 |
| Cursos-horario vencidos sin aplicar | carril + lista | **✅** El panel más operativo de todos |
| Estado de aplicación | barra apilada de 6 tramos | **✅** |
| Cursos-horario por cobertura | barras en filas | **✅** |
| Dónde falta más | barras por facultad | **❌** Mide contra la cuota por sexo: es Metas, y duplica «Cumplimiento de la cuota» |
| Avance por curso-horario | **tabla HTML**, 8 col. | **✅ Se queda tabla.** Buscas un aula concreta entre 174 |

**Entran en Resumen:** «A quién hay que agendar» y «Cuándo se termina de aplicar
el plan», hoy en Rendimiento — las dos son operativo, no rendimiento.

### Estratos — hoy 1 panel y medio, 1 tabla

| Panel | Forma | Veredicto |
|---|---|---|
| Avance por facultad y sexo | barras CSS | **➡️ Metas.** Es facultad×sexo, no estrato. **Y es más que eso**: su bloque `avance_sexo_facultad` trae *logrado, previsto, proyectado y si el campo se comporta como el modelo*. Es la proyección por celda, escondida bajo un rótulo que no la anuncia |
| (sin título) tabla de `avance_por_estrato` | **tabla HTML** | **✅ Se queda tabla**, con denominador declarado (sus estratos suman 891 de brecha contra los 170 del estudio) |

**Entra en Estratos:** el bloque `representativity`, que hoy **nadie lee** —
ver §4. Es exactamente «brecha por estrato»: compara el plan efectivo contra las
distribuciones del marco y publica un array `distribution` que se calcula en cada
refresco y se tira.

### Rendimiento — hoy 9 paneles, 1 tabla condicional

| Panel | Forma | Veredicto |
|---|---|---|
| A quién hay que agendar | rejilla con roles de tabla | **➡️ Resumen.** Es agenda |
| Rendimiento diario de las facultades | 2 gráficos SVG | **✅** |
| Qué está rindiendo más (facultad) | ranking | **✅** |
| Quién consigue más (aplicador) | ranking | **⚠️ Fusionar.** Mismo componente, otra clave |
| Franja horaria del operativo | ranking | **⚠️ Fusionar** |
| Día de la semana | ranking | **⚠️ Fusionar** |
| Encuestas por día de cada facultad | rejilla de barras | **❌** Duplica «Ritmo de la recolección», y peor: cuenta *efectivas del parte* donde el otro cuenta *válidas de plataforma* |
| Cuándo se termina de aplicar el plan | gráfico SVG | **➡️ Resumen.** Es pronóstico del operativo |
| Consumo de la reserva | rejilla con roles de tabla | **➡️ Metas.** Va con «A qué aula del banco ir» |

Cuatro de los nueve son **el mismo componente con distinta clave**. Eso es un
selector, no cuatro paneles. Rendimiento pasaría de 9 paneles a 4.

### Efectividad — hoy 2 paneles, 2 tablas

| Panel | Forma | Veredicto |
|---|---|---|
| El campo contra la tasa que dimensionó la muestra | **tabla HTML** con banda por fila | **✅ Se queda tabla.** 15 filas × 4 magnitudes, ya es semi-visual |
| Cada curso-horario contra su propio margen | **tabla HTML** + plegados | **✅ Se queda tabla.** Buscas la fila que se sale |

**La única pestaña coherente al 100 %.** Sus dos paneles contestan su pregunta y
nada más.

### Salidas — hoy 5 tarjetas, 0 tablas

PDF de cursos-horario · Producción por responsable · Base final del corte ·
Google Sheets (cliente e interno) · readiness del corte. **✅** Todo en su sitio.

**Entran en Salidas:** las cinco tablas, como vista previa de lo que se publica.

### Escritos y sin montar

| Componente | Qué contesta | Veredicto |
|---|---|---|
| `AulasAvanceProyectado` (222 l.) | Si cada celda de cuota va a llegar | **⚠️** Se bajó porque «pertenece a otra pestaña», y esa pestaña nunca se creó. Pero su dato **sí está montado**, en Estratos, bajo otro nombre. Decidir cuál de los dos vive |
| `AulasAvanceParaCliente` (332 l.) | Avance por facultad sin netear faltantes (ADR 0079) | **⚠️** Se sustituyó por las cinco tablas. Si las tablas se van, esto vuelve a quedar sin reemplazo |
| `AulasBrechaEstratoChart` (163 l.) | Dónde falta más, por estrato — **el único Plotly del perfil** | **⚠️** Si vuelve, debe declarar denominador |

---

## 2. Duplicación: la misma cifra en dos sitios

| # | Qué se repite | Dónde |
|---|---|---|
| 1 | El total de la cuota, **tres veces** | banda de KPIs · barra de «Cumplimiento» · barra de «Hombres y mujeres» — las tres en Metas |
| 2 | Faltantes por facultad | «Dónde falta más» (Resumen) vs. el ranking de «Cumplimiento de la cuota» (Metas) |
| 3 | Ritmo diario, **con dos numeradores distintos** | «Ritmo de la recolección» (válidas de plataforma) vs. «Encuestas por día» (efectivas del parte) |
| 4 | Rendimiento por facultad | tabla del motor (Metas) vs. «Qué está rindiendo más» calculado en el front (Rendimiento) |
| 5 | La tabla `diario` | entera en Metas y agregada como gráfico en Rendimiento |
| 6 | Cuota facultad×sexo, tres formas | «Hombres y mujeres» + pirámide (Metas) vs. «Avance por facultad y sexo» (Estratos) |
| 7 | Dos «Cumplimiento» sobre la misma base | «aula por aula» (Resumen) y «de la cuota» (Metas) parten de las mismas respuestas con distinto denominador y distinto tope |

---

## 3. Las cinco tablas: forma exacta y veredicto

| Tabla | Columnas | Grano | Ya lo dice en la app | Veredicto |
|---|---|---|---|---|
| Avance general | 4 × 10 filas (traspuesta) | total, por sexo | **la banda de 7 KPIs** | **➡️ Salidas** |
| Avance por facultad | **20** | facultad | «Hombres y mujeres por facultad» + «Cumplimiento de la cuota» | **➡️ Salidas** |
| Rendimiento por facultad | 10 | facultad | «Qué está rindiendo más» | **➡️ Salidas** |
| Producción por aplicador | 10 | facultad × aplicador | «Quién consigue más» | **➡️ Salidas** |
| Avance diario | 11 | facultad × día | el gráfico del día | **➡️ Salidas** |

**Ninguna aporta un número que la app no pinte ya.** Y la de facultad tiene
**veinte columnas**: eso no se lee en una pantalla, se lee en una hoja de cálculo
que puedes congelar, filtrar y copiar. Ése es su sitio.

Su forma visual, para cada una, **ya existe montada**:

| Lo que dice la tabla | La forma que ya tenemos |
|---|---|
| Efectivas / muestra / sobremuestra, total y por sexo | banda de KPIs |
| Avance de cada facultad hacia sus dos metas | barras por sexo con marca de meta |
| Esperado vs. obtenido por facultad | ranking de rendimiento |
| Producción de cada aplicador | ranking por aplicador |
| Cómo fue cada jornada | barras grises + línea verde |

### Las otras cinco tablas de la sección

| Tabla | Veredicto | Por qué |
|---|---|---|
| Avance por curso-horario (Resumen) | **Se queda tabla** | 174 filas donde buscas una concreta |
| `avance_por_estrato` (Estratos) | **Se queda tabla**, con denominador declarado | Muchos estratos; un ranking mentiría sobre el total |
| τ del diseño vs. campo (Efectividad) | **Se queda tabla** | 15 filas × 4 magnitudes, ya lleva banda y vara CSS |
| Cada aula contra su margen (Efectividad) | **Se queda tabla** | Buscas la fila que se sale del margen |
| Cuotas de la facultad elegida (Rendimiento) | **Se queda** | Condicional y corta |

**La regla que las separa:** una tabla es correcta cuando el lector **busca una
fila concreta** o **compara más de tres magnitudes de la misma fila**. Es
incorrecta cuando la pregunta es *quién va peor* (ranking), *cómo viene* (línea)
o *cuánto llevo* (barra con marca de meta).

---

## 4. Lo que el motor calcula y **nadie mira**

Se paga en cada refresco del estado y no llega a ninguna pantalla.

| Bloque | Qué contiene | Coste | Qué hacer |
|---|---|---|---|
| **`representativity`** | `planned/effective_score`, `effective_distance`, `score_loss`, **`distribution[]`** y un `warning` | Recorre el plan sin banco contra las distribuciones del marco | **Montarlo en Estratos.** Es exactamente su tema y hoy esa pestaña está casi vacía |
| **`criterio_aula`** | El veredicto del estudio contra el del Excel del equipo, aula por aula | Hoy `NULL` sin criterio declarado; en cuanto se declare se paga entero | Su sitio natural es **Calidad**, no Avance. Montar o dejar de calcular |
| `kpis.quota_cells_pending` | Celdas de cuota todavía abiertas | barato | Candidato a KPI de Metas |
| `kpis.aulas_parciales` | Aulas a medias | barato | Candidato a «Estado de aplicación» |
| `kpis.representativity_*` | Dos escalares de lo anterior | arrastran el bloque entero | Con `representativity` montado, dejan de ser huérfanos |
| `schema`, `selection_run_id`, `frame_hash` | duplicados de `config` | nulo | Dejar de publicarlos |
| `kpis.aulas_total`, `aulas_aplicadas`, `respuestas_validas_aulas` | espejos muertos, ya documentados | nulo | Dejar de publicarlos |

### Y lo que cuesta de más

| Bloque | Problema |
|---|---|
| **`reparto`** | Es un algoritmo de asignación que **se recomputa con el plan vigente en cada construcción del tablero**. El bloque más caro del payload, y sólo lo usa la sección Modelo |
| **`course_status`** | Recorre el plan entero (2 616 filas) contra las respuestas y **tira todo menos 500**. Se paga completo, viaja recortado |
| **`agenda`** | El plan entero como lista de listas: 1 424 filas × ~80 campos. Es la mayor parte del peso |

El precedente ya existe y es de esta misma sección: las cinco tablas se sacaron
del estado a un endpoint aparte precisamente porque cruzan respuestas con plan
aula por aula. `representativity` y `criterio_aula` hacen ese mismo trabajo y
siguen viajando en cada `/monitoreo/state`.

---

## 5. Checklist

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| A1 | Sacar las cinco tablas de Metas | `AulasPestanaCuotas.tsx` | pendiente |
| A2 | Montarlas en Salidas como vista previa del libro | `MonitoreoOutputsWorkbench.tsx` | pendiente |
| A3 | Mover «Avance por facultad y sexo» de Estratos a Metas, con rótulo que anuncie la proyección | `AulasPestanaEstratos.tsx` → `AulasPestanaCuotas.tsx` | pendiente |
| A4 | Montar `representativity` en Estratos | panel nuevo | pendiente |
| A5 | Mover «A quién hay que agendar» y «Cuándo se termina el plan» a Resumen | `AulasPestanaRendimiento.tsx` → `AulasPestanaResumen.tsx` | pendiente |
| A6 | Mover «Consumo de la reserva» a Metas | `AulasPestanaRendimiento.tsx` → `AulasPestanaCuotas.tsx` | pendiente |
| A7 | Fusionar los 4 rankings en uno con selector | `AulasRendimientoPorFacultad.tsx` | pendiente |
| A8 | Retirar «Dónde falta más» de Resumen | `AulasPestanaResumen.tsx` | pendiente |
| A9 | Quitar la triple publicación del total de la cuota en Metas | `AulasPestanaCuotas.tsx` | pendiente |
| A10 | Declarar denominador en el subtítulo de cada panel | todos | pendiente |
| A11 | Decidir entre «Ritmo de la recolección» y «Encuestas por día» | dos numeradores distintos | **bloqueado — decisión metodológica** |
| A12 | Decidir si la pirámide se queda | `AulasPiramideCuota.tsx` | **bloqueado — decisión de Gonzalo** |
| A13 | Decidir el destino de los 3 componentes sin montar | `AulasAvanceProyectado`, `AulasAvanceParaCliente`, `AulasBrechaEstratoChart` | **bloqueado — decisión de Gonzalo** |
| A14 | Dejar de publicar los bloques sin consumidor, o montarlos | `monitoreo_aulas_universitarias.R` | pendiente |

Tres ítems están **bloqueados**, no pendientes: A11 es una contradicción entre dos
fuentes que hoy cuentan cosas distintas bajo el mismo nombre, y A12 y A13 son
decisiones tuyas.
