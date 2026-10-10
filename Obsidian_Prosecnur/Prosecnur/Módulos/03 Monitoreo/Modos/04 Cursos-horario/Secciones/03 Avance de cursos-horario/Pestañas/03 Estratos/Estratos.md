---
padres: []
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=avance&pestana=estratos"
historica: true
tags:
  - Archivo/Historica
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasPestanaEstratos.tsx"
  - "api/R/monitoreo_aulas_avance_cuota.R"
---

# Estratos

> **Pestaña retirada el 2026-09-09.** Mostraba el avance y la brecha de cada estrato del diseño dentro de Avance de cursos-horario.

## Por qué ya no existe

El catálogo de navegación (`frontend/src/lib/navegacion/catalogos/monitoreo.ts`, bloque `aulas › avance`) la retiró por decisión de Gonzalo: el avance del operativo no se lee partiendo las facultades por su composición por sexo, que era el eje de esta pestaña. Avance quedó como Resumen → Metas → Rendimiento → Efectividad → Salidas.

Sus dos paneles legítimos —cómo se repartió el sorteo y cuánto se movió la composición— son del diseño muestral, no del avance; si vuelven, será en Cálculo de muestra. El componente `AulasPestanaEstratos` sigue en el árbol, sin montar, y la dirección `pestana=estratos` ya no resuelve en el contrato.

## Lo que documentaba

1. El avance por estrato contra la cuota que el diseño le asignó.
2. La brecha medida contra la cuota del diseño, no contra la suma de metas por aula (ADR 0079).

La lectura de avance contra la cuota vive hoy en la pestaña Metas (`monitoreo/aulas/avance/cuotas`).
