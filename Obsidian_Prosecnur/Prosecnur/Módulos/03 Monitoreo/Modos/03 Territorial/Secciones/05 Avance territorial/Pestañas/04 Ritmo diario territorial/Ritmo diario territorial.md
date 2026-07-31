---
tipo: pestana
padres:
  - "[[Avance territorial]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=avance&pestana=ritmo"
nodo: "monitoreo/territorial/avance/ritmo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/territorial/TerritorialAdvanceWorkbench.tsx"
  - "api/R/monitoreo_engine.R"
---
# Ritmo diario territorial

> Muestra la producción del campo día a día y su tendencia, para saber si el operativo cierra en el plazo previsto.

## Objetivo

Responde la pregunta de plazo: **¿se llega?** En campo territorial la respuesta importa más que en otros modos, porque reforzar significa mover gente por el territorio y eso no se improvisa en dos días.

## Antes de empezar

- El corte debe traer respuestas fechadas.
- Ten presente qué días trabaja el equipo: en territorial es habitual que el fin de semana produzca más que un día laborable, al revés que en telefónico.
- Conviene traer del Resumen cuánto falta en cada eje.

## Mapa de la pantalla

```mermaid
flowchart LR
    A["Producción por día"] --> B["Tendencia del corte"]
    B --> C["Ritmo observado"]
    D["Lo que falta"] --> E["Días necesarios"]
    C --> E
    E --> F["¿Cierra en plazo?"]
```

## Elementos de la pantalla

| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Serie diaria | Presenta las encuestas levantadas por día | Es la base de la lectura |
| Tendencia | Muestra si la producción sube, baja o se mantiene | Anticipa el comportamiento futuro |
| Días con producción | Cuenta los días efectivamente trabajados | Es el divisor honesto del promedio |
| Ritmo observado | Encuestas por día del operativo | Describe la capacidad actual |
| Contexto del corte | Recuerda el alcance y el distrito filtrado | Evita leer una zona como el estudio |

## Cómo interpretar lo que ves

Comprueba el **distrito filtrado** antes de leer: un ritmo acotado a una zona no se puede proyectar al estudio.

El ritmo territorial tiene una estacionalidad semanal marcada que conviene no confundir con una caída: los días en que la gente está en casa producen más. Una bajada de martes no significa lo mismo que una bajada de sábado.

Los **días con producción** son el divisor honesto. Un promedio sobre días de calendario mezcla jornadas de trabajo con días sin campo y subestima la capacidad real del equipo.

Cruza el ritmo con lo que falta en cada eje: cerrar una brecha de cuota en un perfil difícil es más lento que sumar encuestas en general, así que el ritmo agregado puede ser engañosamente optimista.

## Cómo se usa

1. Comprueba el contexto y el distrito filtrado.
2. Lee la tendencia antes que el nivel: importa hacia dónde va.
3. Calcula sobre días con producción, no de calendario.
4. Contrasta con lo que falta en cuota y en UMP, no sólo con el total.
5. Si no alcanza, decide con margen: reforzar en territorio exige logística.

## Ejemplo guiado

**Situación inicial.** El ritmo de los últimos días bajó y se plantea reforzar el equipo de inmediato.

**Acciones.** Se revisa la serie completa en lugar de los últimos días. La bajada corresponde a jornadas laborables, y el mismo patrón se repitió las semanas anteriores con recuperación en fin de semana. Los días con producción mantienen un promedio estable.

**Resultado observable.** No hay caída de rendimiento sino estacionalidad semanal. El refuerzo se descarta y se revisa en cambio lo que sí falta: celdas de cuota de un perfil concreto, que no se resuelven con más gente sino con horarios distintos. La lectura de la serie completa evitó una decisión logística cara e inútil.

## Resultado y siguiente paso

- Queda la lectura del ritmo y su proyección contra lo que falta.
- Continúa en Salidas territoriales si el operativo cierra, o vuelve a Distritos si hay que redistribuir esfuerzo.

## Estados, alertas y límites

- Sin respuestas fechadas no hay serie.
- El ritmo territorial tiene estacionalidad semanal; una bajada aislada rara vez es una caída.
- El promedio depende del divisor: días con producción frente a días de calendario.
- Un ritmo agregado no proyecta bien el cierre de una brecha de perfil concreto.
- Con distrito filtrado, el ritmo es de esa zona.

## Si algo no coincide

Si la serie parece caer, compárala con las semanas anteriores antes de concluir. Si el ritmo no cuadra con la producción total, comprueba el alcance y el distrito filtrado. Si la proyección resulta optimista frente a lo que falta, revisa si lo pendiente son perfiles difíciles y no volumen general.

## Ubicación en la jerarquía

- Padre: [[Avance territorial]].
