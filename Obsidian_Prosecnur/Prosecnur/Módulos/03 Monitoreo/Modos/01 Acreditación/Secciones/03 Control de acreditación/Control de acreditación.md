---
tipo: seccion
padres:
  - "[[Acreditación]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=control"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/contacto/Barrido.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/contacto/Correo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/casos/PorResolver.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/casos/Cruce.tsx"
  - "api/R/monitoreo_acreditacion_queries_cache.R"
---
# Control de acreditación

> Lo que hay que operar y revisar mientras corre el campo: el contacto declarado y los casos que esperan una decisión.

## Qué reúne

Absorbe Consultas (Registros en plataforma, Estado de la base, Cruces efectivos, Subsanación), Teléfono (Barrido y Kobo, Ritmo diario, Sin efectiva, Responsables, Alertas reales) y Avance › Correo. De Teléfono › Supervisión solo pasó el control de tiempos de Kobo, como señal de Calidad; el resto queda por definir (pregunta P3 del revamp).

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Correo de acreditación]] | Correo ◇ | ¿cómo rinde cada envío? |
| [[Barrido de acreditación]] | Barrido ◇ | ¿cuánto del padrón se llamó? |
| [[Reintentos de acreditación]] | Reintentos ◇ | ¿en qué casos se sigue insistiendo? |
| [[Equipo de acreditación]] | Equipo ◇ | ¿cómo rinde cada responsable? |
| [[Por resolver de acreditación]] | Por resolver | ¿qué respuestas esperan una decisión? |
| [[Cruce de acreditación]] | Cruce | ¿cómo se volvió avance cada respuesta? |
| [[Calidad de acreditación]] | Calidad | ¿si hay respuestas sospechosas? |
| [[Personas de acreditación]] | Personas | ¿en qué está cada persona del padrón? |
| [[Respuestas de acreditación]] | Respuestas | ¿qué llegó de cada plataforma? |

◇ condicional: la pestaña aparece solo si el estudio declara esa capacidad.

## Regla de lectura

El rail separa dos grupos. **Contacto** (Correo, Barrido, Reintentos, Equipo) muestra solo los canales que el estudio declara. **Casos** (Por resolver, Cruce, Calidad, Personas, Respuestas) vale para todo estudio. Personas y Respuestas no se fusionan: una tiene grano persona del padrón y la otra grano respuesta de plataforma.

## Ubicación en la jerarquía

- Padre: [[Acreditación]].
