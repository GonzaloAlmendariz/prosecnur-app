# Checklist · El Planner sale como módulo (ADR 0124) — 2026-11-01

Gonzalo, al revisar la Q5 en la app: «el tipo de estudio es uno solo», «¿por qué pide definir poblaciones?», «¿qué tanto
perderíamos si quitamos el Planner por completo?». Decidió: quitar el módulo, el nombre y el tipo en el Home, el
cronograma se va por completo («Sí, procede»). Sólo Gonzalo da los ítems por terminados.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Un estudio, un tipo: escribir acepta un solo perfil; el diseño sale del tipo; acreditación sin canales (abre la de correo); se deshace el 4b | `planner_modelo.R`, `planner_modos.R`, `planner_proyeccion.R`, `collection_campaigns_planner.R`, tests | pendiente |
| 2 | Panel «Ficha del estudio» en el Home (`?panel=estudio`): nombre, código, cliente, objetivo y el tipo con su variante; sin poblaciones, canales ni diseño | `features/home/` (componente nuevo), `panelesHome.ts`, `api/planner.ts` | pendiente |
| 3 | Sale el módulo `diseno-estudio`: manifiesto, rutas, tarjeta y selector del Home, contratos; `/planner`, `/bitacora`, `/diseno-estudio` → Home | `modules.ts`, `App.tsx`, contratos | pendiente |
| 4 | Se borran las pantallas del Planner y de la Bitácora (Resumen, Tipos, Camino, cronograma, calendario, registro, lienzo) | `features/bitacora/` | pendiente |
| 5 | Enlaces de Cálculo y Monitoreo que mandaban a declarar el tipo en el Planner → panel del Home | `AterrizajeDelPlanner.tsx`, `aterrizajeDeMonitoreo.ts`, `FichaEstudio.tsx` | pendiente |
| 6 | «Alinear la fase/ventana» de Monitoreo y la etapa del Planner en Hojas de ruta: ya no aparecen; su código lo retira cada sesión dueña | Monitoreo, Hojas de ruta | pendiente, de otras sesiones |
| 7 | Backend de la Bitácora y del calendario (routers, motores, jobs, exportación del mapa): queda dormido; se retira aparte | `router_bitacora*.R`, `plan_trabajo`, `planner_calendario.R` | fuera de esta tanda |
