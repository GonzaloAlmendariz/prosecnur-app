---
tipo: seccion
padres:
  - "[[Territorial]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=insumos"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/insumos/ConexionesTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/insumos/MapeoTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/insumos/PadronTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/insumos/HistorialTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/TerritorialSourceConsole.tsx"
---
# Insumos territoriales

> De dónde sale cada dato y con qué reglas se lee: las conexiones, el mapeo de columnas y el filtro de efectivas, el padrón de aplicadores y el historial de lecturas.

## Qué reúne

Absorbe la antigua sección Fuente (Formulario, Filtro y distritos, Encuestadores, Historial) y UMPs › Variables, desde el revamp de Monitoreo (2026-10-23). La reconciliación de códigos pasó a Control › Conciliación.

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Conexiones territoriales]] | Conexiones | ¿qué fuentes alimentan el modo? |
| [[Mapeo y filtro territorial]] | Mapeo y filtro | ¿qué columna es cada cosa y qué cuenta? |
| [[Padrón territorial]] | Padrón | ¿quiénes son los aplicadores declarados? |
| [[Historial territorial]] | Historial | ¿qué se leyó y cuándo? |

## Regla de lectura

Variables, filtro, umbrales y distritos son una sola configuración de lectura: cambiar cualquiera cambia la cifra antes de contarla. El padrón es un insumo; su conciliación con lo que el aplicador escribe a mano es trabajo de Control.

## Ubicación en la jerarquía

- Padre: [[Territorial]].
