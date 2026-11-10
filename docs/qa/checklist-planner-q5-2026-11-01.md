# Checklist · Planner Q5, la pantalla nueva (ADR 0123) — 2026-11-01

Tipo: Checklist de implementación
Estado: Histórico
Fecha: 2026-11-01
Autoridad: ADR 0123; propuesta aprobada por Gonzalo el 2026-11-01 ("Sí, constrúyela")
Consolidado en: [Checklist del retiro del Planner](checklist-planner-retiro-2026-11-01.md)

Gonzalo aprobó la propuesta («Sí, constrúyela», 1/11), sobre el prototipo navegable
https://claude.ai/artifact/4FGYFbie5F4JeUdLAc88k9 (versión 7). Un ítem por pieza; sólo Gonzalo los da por terminados.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | **Resumen** como landing de Estudio: avance de las 2 definiciones obligatorias, tarjetas de las 4 definiciones, «Así abre cada módulo» (de `/api/planner/modos`) y, con origen `deducido`, el aviso de proyecto viejo («el Planner abre vacío; cada módulo conserva su modo») | `PlannerResumen.tsx` (nuevo), `modules.ts` (pestaña `resumen`) | hecho, por revisar con Gonzalo |
| 2 | **Identificación** con el objetivo en una línea; el objetivo no se publica (ADR 0123 §7) | `planner_modelo.R` (`.planner_norm_estudio`), `planner_publico.R`, `api/planner.ts`, `PlannerEstudio.tsx` | hecho, por revisar con Gonzalo |
| 3 | **Tipos de estudio**: la pestaña Perfiles pasa a llamarse así; quién diseña la muestra ya va dentro de cada perfil | `modules.ts`, `PlannerEstudio.tsx` | hecho, por revisar con Gonzalo |
| 4 | **Canales de acreditación** («acreditación no solo es por correo»): correo, teléfono y presencial con QR, elegibles en el perfil; teléfono abre campaña telefónica | `PlannerEstudio.tsx`, `plannerCopia.ts`, `planner_modos.R` | hecho, por revisar con Gonzalo |
| 4b | Qué campaña de Material abre acreditación **presencial con QR** (¿la de aulas?) | `planner_modos.R` (`sorteo_aulas`), `collection_aulas_siembra.R` (`.collection_hay_sorteo_aulas`), `PlannerResumen.tsx` | **parcial: (b) hecho; (a) pendiente de Gonzalo**. (b): abre la campaña de aulas sólo si hay sorteo de aulas (`calc_muestra_aulas_selection` o `monitoreo_aulas_plan`); sin él, `material$pendientes` lo dice en el Resumen y no se crea una campaña vacía. (a), sembrar la campaña de aulas desde la corrida de un actor de acreditación, cambia cómo se muestrea: acrconta no trae marco de estudiantes con cursos-horario |
| 5 | `PUT /api/planner/perfiles` conserva del valor previo `representatividad`, `canales` y `bases` si el cliente no los manda, e ignora `representatividad` (ADR 0123 §2) | `planner_modelo.R` | hecho, por revisar con Gonzalo |
| 6 | **Camino**: pestaña «Camino» con los carriles por perfil (derivados de los tipos) y pestaña «Lienzo» con el lienzo libre de siempre (no se borra lo dibujado) | `PlannerCamino.tsx` (nuevo), `modules.ts`, `BitacoraPage.tsx` | hecho, por revisar con Gonzalo |
| 7 | **Muestra** sale del Planner: alias `seccion=muestra` → Estudio con aviso «el universo y las cuotas viven en Cálculo», migración de nodos del lienzo, se quita `PlannerMuestra` | `direccion.ts`, `bitacora_migraciones.R`, `BitacoraPage.tsx` | hecho, por revisar con Gonzalo |
| 8 | Textos que todavía dicen «bitácora» en el registro y el lienzo | `LogbookSection`, `CanvasSection` | hecho, por revisar con Gonzalo |
| 9 | Ficha del estudio del prototipo | — | fuera de esta tanda: el Resumen cubre lo que mostraba; se decide al revisarla |

## Notas

- El riel de pestañas de la app (ContextTabRail) es la identidad del módulo: el riel numerado del prototipo se
  traduce a las pestañas de Estudio (Resumen, Identificación, Tipos de estudio).

## Verificación (1/11)

- R: `gate-area planner` 320/0, más bitacora-migraciones, bitacora-canvas, plan-trabajo, dashboard-publish-permitido y
  collection-territorial-excel en verde.
- Front: `tsc` 0; `gate-front bitacora` verde salvo `inputsDelKit` y `ModuleChrome` (CSS de acreditación de Monitoreo,
  ajenos); vitest de lib, app, bitacora y api en verde.
- Capturas 1440x1000, sin issues: un `acnur_acg` con el estudio declarado (Resumen, Identificación, Tipos, Recorrido,
  Lienzo y el alias de Muestra) y `hsvg2026` sin declarar (Resumen con «cada módulo sigue en el modo que ya tenía»).
