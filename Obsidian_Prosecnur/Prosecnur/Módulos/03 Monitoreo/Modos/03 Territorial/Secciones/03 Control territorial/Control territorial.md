---
tipo: seccion
padres:
  - "[[Territorial]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=control"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/control/BandejaTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/control/SenalesTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/control/OcurrenciasTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/control/SubsanacionesTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/control/ConciliacionTab.tsx"
---
# Control territorial

> Qué hay que revisar, qué no cruza y qué se corrigió, en tres grupos del rail: Calidad, Ocurrencias y Correcciones.

## Qué reúne

Absorbe Consultas internas (Registro, GPS con señal, Tiempo corto, Cruce responsable, Subsanaciones), Validación (Geolocalización, Duración, Anulación, Reconciliación UMP), Fuente › Reconciliación de códigos y la sección Ocurrencias de campo.

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Bandeja territorial]] | Bandeja | ¿qué reviso hoy y qué decido? |
| [[Señales territoriales]] | Señales | ¿si la calidad es pareja? |
| [[Equipo territorial]] | Equipo | ¿quién produce cuánto? |
| [[Ocurrencias territoriales]] | Ocurrencias ◇ | ¿por qué no se logra la entrevista? |
| [[Reportes UMP territoriales]] | Reportes UMP ◇ | ¿qué UMP no reporta o no cuadra? |
| [[Subsanaciones territoriales]] | Subsanaciones | ¿qué celda falta y de dónde se cubre? |
| [[Anulaciones territoriales]] | Anulaciones | ¿qué salió del conteo? |
| [[Conciliación territorial]] | Conciliación | ¿códigos y UMP corregidos? |

◇ condicional: la pestaña aparece solo si el estudio declara esa capacidad.

## Regla de lectura

Calidad (Bandeja, Señales, Equipo) dice qué revisar; Ocurrencias (Ocurrencias, Reportes UMP) documenta por qué no se logra una entrevista y es condicional —parte del protocolo en ACNUR, opcional para otros clientes—; Correcciones (Subsanaciones, Anulaciones, Conciliación) deja auditado lo que cambió el conteo.

## Ubicación en la jerarquía

- Padre: [[Territorial]].
