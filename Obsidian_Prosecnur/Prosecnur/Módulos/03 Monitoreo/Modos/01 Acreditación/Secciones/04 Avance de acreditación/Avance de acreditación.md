---
tipo: seccion
padres:
  - "[[Acreditación]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=avance"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avance/Resumen.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avance/PorPublico.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avance/PorCuota.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avance/Ritmo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avance/Salidas.tsx"
---
# Avance de acreditación

> Cómo vamos: si se llega a la meta, quién se queda atrás, si se cumple cada categoría, a qué velocidad entra y qué se entrega.

## Qué reúne

Conserva Resumen, Cuotas y Salidas, y absorbe Actores (ahora Por público), Encuestas (ahora Ritmo) y Detalle de controles (dentro de Por cuota). Correo pasó a Control.

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Resumen de avance de acreditación]] | Resumen | ¿si se llega a la meta? |
| [[Avance por público de acreditación]] | Por público | ¿quién se queda atrás? |
| [[Cuotas por categoría de acreditación]] | Por cuota | ¿si se cumple cada categoría? |
| [[Ritmo de acreditación]] | Ritmo | ¿a qué velocidad entra? |
| [[Salidas de acreditación]] | Salidas | ¿qué se entrega y si está al día? |

## Regla de lectura

Tres cifras conviven y no significan lo mismo: registros del corte, procesables y efectivas. La distancia entre ellas son mermas —casos fuera del padrón declarado, respuestas sin encuesta efectiva— y es justo lo que un comité pide explicar. Un cero significa que el control se ejecutó y no encontró casos; S/D, que no pudo evaluarse.

## Ubicación en la jerarquía

- Padre: [[Acreditación]].
