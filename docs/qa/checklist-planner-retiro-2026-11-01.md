# Checklist · El Planner sale como módulo (ADR 0124) — 2026-11-01

Gonzalo, al revisar la Q5 en la app: «el tipo de estudio es uno solo», «¿por qué pide definir poblaciones?», «¿qué tanto
perderíamos si quitamos el Planner por completo?». Decidió: quitar el módulo, el nombre y el tipo en el Home, el
cronograma se va por completo («Sí, procede»). Sólo Gonzalo da los ítems por terminados.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Un estudio, un tipo: escribir acepta un solo perfil; el diseño sale del tipo; acreditación sin canales (abre la de correo); se deshace el 4b | `planner_modelo.R`, `planner_modos.R`, `planner_proyeccion.R`, `collection_campaigns_planner.R`, tests | hecho (b00932653), por revisar con Gonzalo |
| 2 | Panel «Ficha del estudio» en el Home (`?panel=estudio`): nombre, código, cliente, objetivo y el tipo con su variante; sin poblaciones, canales ni diseño | `features/estudio/` (`FichaDelEstudio`, host en `Layout.tsx`, `panelEstudio.ts` en el manifiesto global), botón «Ficha del estudio» en el pie del Home | hecho, por revisar con Gonzalo |
| 3 | Sale el módulo `diseno-estudio`: manifiesto, rutas, tarjeta y selector del Home, contratos; `/planner`, `/bitacora`, `/diseno-estudio` → Home | `modules.ts`, `App.tsx`, `ModuleWarmupBoundary.tsx`, `warmupRegistry.ts`, `ProjectModulesContext.tsx`, `direccion.ts` (sin alias por valor), contratos | hecho, por revisar con Gonzalo |
| 4 | Se borran las pantallas del Planner y de la Bitácora (Resumen, Tipos, Camino, cronograma, calendario, registro, lienzo) | `features/bitacora/` (sobreviven en `features/estudio/` el hook del estudio, el vacío y `usePlannerModos`) | hecho, por revisar con Gonzalo |
| 5 | Enlaces de Cálculo y Monitoreo que mandaban a declarar el tipo en el Planner → panel del Home | `AterrizajeDelPlanner.tsx`, `FichaEstudio.tsx`, `usePlannerIdentidad.ts`, `MonitoreoShell.tsx`: abren la ficha sobre la vista actual y releen al guardar | hecho, por revisar con Gonzalo |
| 6 | «Alinear la fase/ventana» de Monitoreo y la etapa del Planner en Hojas de ruta: ya no aparecen; su código lo retira cada sesión dueña | Monitoreo, Hojas de ruta | pendiente, de otras sesiones |
| 7 | Backend de la Bitácora y del calendario (routers, motores, jobs, exportación del mapa): queda dormido; se retira aparte | `router_bitacora*.R`, `plan_trabajo`, `planner_calendario.R` | fuera de esta tanda |

## Notas

- La ficha guarda en la clave `planner` (identificación y un solo perfil); el diseño de la muestra sale del tipo y,
  si el tipo no cambia, se conserva el que ya estaba (un telefónico con Cálculo sigue con Cálculo).
- El tipo se elige con un `PulsoSelect` de cinco opciones (territorial aleatorio, territorial por cuotas, aulas,
  telefónico, acreditación); aulas pide además la selección (cursos-horario o marco). Sin poblaciones ni canales.
- Guardar emite `pulso:estudio-declarado`: Cálculo y Monitoreo releen su modo y su identidad sin recargar.
- `/planner`, `/bitacora`, `/diseno-estudio` y `/plan-trabajo` → `/?panel=estudio`. Un `.pulso` con `diseno-estudio`
  en sus módulos agregados lo pierde al leerlo (`PRIMARY_MODULE_SLUGS`); el slug y su tono quedan como legado.
- Sale con la bitácora el `.plan-button` que usaba el «Cancelar» de quitar un módulo en el Home: pasa al botón del kit.
