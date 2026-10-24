---
tipo: seccion
padres:
  - "[[Telefónico]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/montaje.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Barrido.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Discrepancias.tsx"
  - "api/R/monitoreo_telefonico.R"
---
# Control telefónico

> El gobierno diario del campo: cómo rinde la hoja, a quién se sigue llamando, quién rinde cómo y qué hay que corregir.

## Qué reúne

Absorbe Llamadas (Resumen operativo, Sin efectiva, Responsables, Alertas reales, Validación de tiempo) y Consultas (Efectivas Kobo, CodPulso, Salvedades).

| Pestaña | Pregunta que responde |
|---|---|
| [[Barrido telefónico]] | ¿Cómo rinde la hoja de barrido? |
| [[Insistencia telefónica]] | ¿A quién se sigue llamando? |
| [[Equipo telefónico]] | ¿Cómo rinde cada responsable? |
| [[Discrepancias telefónicas]] | ¿Kobo y la hoja dicen lo mismo? |
| [[Respuestas telefónicas]] | ¿Qué envío es efectiva? |
| [[Supervisión telefónica]] | ¿Qué efectivas se vuelven a llamar? |
| [[Avisos telefónicos]] | ¿Qué hay que corregir y dónde? |

## Regla de lectura

La plataforma manda las efectivas; la hoja describe el intento. Una diferencia entre las dos no se corrige en el total: se decide caso por caso en Discrepancias o se le pide a quien tiene los casos sin marcar.

## Ubicación en la jerarquía

- Padre: [[Telefónico]].
