# UI v3 — Indicación 2 del dueño: implicancias del sidebar unificado por ventana

Insumo para el bucle de convergencia de `plan-revamp-ui-2026-07.md` (§12). Origen: dirección
del dueño del 2026-07-23 con screenshot de Hojas de Ruta + verificación directa en vivo
(`/ver-ui`, proyecto de referencia, 1361×987 y 1024×600).

## 1. Evidencia observada (por qué el top bar actual no da más)

Verificado en vivo en Hojas de Ruta:

1. **Colisión del recorrido con los KPIs**: a anchos intermedios (~1360 y en el monitor del
   dueño) el primer paso del recorrido ("Territorio") queda cortado/tapado por los chips de
   KPIs. La banda superior intenta contener a la vez: 4 KPIs + 4 chips de estado + 5 pasos
   del recorrido + toggle Piloto/Campo real. No caben.
2. **Pérdida de información en compacto**: a 1024×600 los chips de estado (Territorio ✓,
   Población ✓, Cuotas ✓, Campo ✓) desaparecen por completo, el paso 5 del recorrido se
   corta en el borde y el toggle de fase lo aprieta.
3. **El "+" (agregar módulos) rompe el contexto**: desde Hojas de Ruta, el "+" navega a
   `/?agregar=1` (te expulsa del módulo al carrusel), y "Listo" aterriza en el homepage —
   nunca vuelve a donde estabas trabajando. El toggle quitar/agregar en sí funciona (probado:
   contador 8→7→8, tarjeta cambia de estado); el bug estructural es el flujo, no el toggle.
   Además el dock inferior del carrusel recorta el 8º módulo (Dashboard existe en el DOM
   pero no se ve completo).
4. **El strip de módulos del top ya está al límite**: 8 íconos + "+" compiten con el logo y
   la píldora de proyecto; no hay espacio para un módulo más.

## 2. Taxonomía de ventanas y qué le hace el sidebar a cada una

La migración NO es uniforme: hay 5 clases de ventana con implicancias distintas.

**Clase A — Módulos con recorrido de pasos + banda KPI** (Hojas de Ruta, Calc-muestra):
- El recorrido (nivel 2) migra al sidebar → la banda superior queda dueña del ancho completo
  para KPIs + chips de estado (se acaba la colisión, y los chips sobreviven en compacto).
- REGLA CLAVE: el toggle **Piloto/Campo real NO es navegación, es un selector de fase de
  datos** — no va al sidebar; queda en la banda del módulo (toolbar de contexto). Definir
  esta separación (navegar vs operar) como norma antes de migrar nada.
- Riesgo específico de Hojas de Ruta: sus vistas de mapa quieren canvas ancho — el sidebar
  debe colapsar a íconos EMPUJANDO el canvas (regla ya vigente para nivel 3), jamás overlay.

**Clase B — Procesamiento (meta-módulo con 5 secciones + gating)**:
- Las secciones Carga→Validación→Codificación→Analítica→Gráficos migran al sidebar CON sus
  estados (los puntitos verdes y el `blockedReason` del gating se vuelven badges del sidebar).
- Es la jerarquía más profunda (sección + pestañas nivel 3 dentro de varias): el sidebar
  debe soportar 2 niveles anidados sin convertirse en un árbol infinito — las pestañas
  nivel 3 conservan su patrón actual (icon-compressed) DENTRO del canvas o como sub-nivel
  colapsado del sidebar; decidir UNO y aplicarlo parejo.

**Clase C — Monitoreo (chrome operativo denso)**:
- El chrome actual (Modo/Activas + Avance/Todo + Regenerado/Registros/Corte) es TOOLBAR
  OPERATIVA, no navegación: se queda arriba. Solo las secciones (Fuentes/Modelo/Consultas/
  Teléfono/Avance) migran al sidebar.
- Beneficio directo: hoy ese chrome también está apretado (visto en el screenshot de
  acreditación del dueño); al sacarle las secciones respira.

**Clase D — Canvas totales (Editor XLSForm, mapa, Dashboard/tablero)**:
- Necesitan el ancho completo: sidebar auto-colapsado a íconos por defecto en estas rutas,
  expandible al hover/click empujando. El editor XLSForm además tiene su propia estructura
  interna (canvas/inspector) que no debe duplicarse en el sidebar (regla: no duplicar
  navegación de un nivel en otro).

**Clase E — Homepage del proyecto**:
- Con sidebar global, el homepage deja de ser el único selector de módulos → decidir si el
  sidebar muestra los 8 módulos siempre (nivel 1 + nivel 2 del módulo activo) o solo el
  módulo activo con un switcher. La decisión del dueño (sidebar según la guía general)
  apunta a: nivel 1 arriba del sidebar o en su cabecera, secciones del módulo activo debajo.

## 3. El gestor de módulos (el "+") — rediseño obligatorio en v3

- Debe ser **overlay/modal sobre la vista actual** (o panel del propio sidebar), nunca una
  navegación que te saca del módulo; al cerrar, vuelves EXACTAMENTE donde estabas.
- El carrusel de tarjetas puede sobrevivir dentro del overlay, pero su dock debe mostrar
  los 8+ módulos completos (hoy recorta el último) y anticipar crecimiento del catálogo
  (Enciclopedia no aparece en el carrusel — verificar si es deliberado).
- Con sidebar, el hogar natural del "+" es el pie o cabecera del sidebar.

## 4. Normas transversales que la migración debe fijar ANTES de tocar ventanas

1. **Navegar vs operar vs identidad**: sidebar = navegación (niveles 1-2-3); banda superior
   del módulo = KPIs + estado + toolbar de contexto (fase, corte, acciones de sync);
   esquina superior = identidad (proyecto, guardado, home). Nada cruza de categoría.
2. **Compacto 1024×600 como gate** (regla dual-platform/Windows): cada ventana migrada se
   verifica en ese viewport; los chips de estado no pueden volver a desaparecer.
3. **El sidebar empuja, nunca superpone** (regla ya vigente para pestañas nivel 3).
4. **ADR nuevo antes de la primera ventana** (ya anotado en el plan §4.5): supersede el
   patrón maestro #2 del ADR 0038 y reforma el #3.
5. **QA contract**: cada ventana migrada re-registra su `data-audit-ready` y entra a la
   matriz visual canónica antes/después.

## 5. Orden de migración sugerido (robustez primero)

1. **Shell + sidebar vacío detrás de flag** (sin mover ninguna ventana): estructura, colapso,
   breakpoints, el "+" rediseñado.
2. **Hojas de Ruta como piloto** — es la ventana más rota hoy (colisión demostrada) y cubre
   la clase A completa (recorrido + KPIs + fase + mapa).
3. **Procesamiento** (clase B, la jerarquía más profunda — si el sidebar la aguanta, aguanta
   todo).
4. **Monitoreo** (clase C — recién desacoplado en el plan de mejoras: los 4 profiles
   modulares facilitan la migración por familia).
5. **Canvas totales y homepage** (clases D/E) al final, con las normas ya maduras.

Cada paso cierra con el bucle del plan: auditar → ejecutar → verificar (visual matrix +
compacto) → el dueño decide si converge.
