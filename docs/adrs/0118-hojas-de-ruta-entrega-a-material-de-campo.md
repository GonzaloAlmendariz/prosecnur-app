# ADR 0118: Hojas de ruta diseña; Material de campo produce lo que va a campo

Estado: Propuesto (decisión de Gonzalo, 2026-10-29; pendiente su visto bueno al resumen antes de implementar)

Implementación: Pendiente (fases F1–F3 abajo)

Fecha: 2026-10-29

Enmienda: ADR 0114 §3 (paneles de Selección) y §5 (el envío a Material). Activa: ADR 0108 §8 etapa E2 y ADR 0111
(campaña `territorial`).

## Contexto

En el lienzo de Hojas de ruta (ADR 0114) la sección Selección abría un panel `salidas` que hacía dos trabajos
distintos: **cerrar el diseño** (informe de diseño muestral, bitácora de decisiones) y **producir el material de
campo** (fichas por UMP, hojas de zona, ZIP del paquete, Excel operativo, reemplazos puntuales, PDF de prueba, plan
de campo por encuestador). El segundo trabajo es exactamente lo que Material de campo existe para hacer (ADR 0108:
«produce y entrega el material de campo de cada unidad que otro módulo decidió»), y su campaña `territorial` estaba
reservada para esto desde el ADR 0111 («no se declara hasta E2»).

Tres pendientes de la brecha con el artefacto chocaban con eso (checklist `docs/qa/checklist-brecha-artefacto-hojas-2026-10-29.md`):
B19 (Salidas como sección con mapa por encuestador), B46 (la hoja de la UMP en grande con «Imprimir») y B22/U19
(«Enviar a Material»). Gonzalo, textual: «Debería ser parte del módulo de material para el campo, ¿no?» y, sobre
la hoja grande, «Sigo sintiendo que debe conectarse con el módulo encargado».

## Decisión

### 1. Qué se muda a Material de campo

A la campaña `territorial` (id `territorial.principal`), con fuente `ump_territorial_v1` y `unit_type =
territorial_ump` (ADR 0108 §1):

| Pieza | Hoy en Hojas de ruta | En Material de campo |
|---|---|---|
| Lista de UMP titulares y reemplazos, con su mapa | Selección (estructura y lienzo) | `seccion=unidades` (lista + mapa; la revisión contra el marco **no** se muda) |
| Hoja de la UMP en grande, con «Imprimir» (B46) | miniatura en la ficha de la UMP | `seccion=unidades&foco=<id_manzana>&panel=hoja` (diálogo) |
| Ficha por UMP (caras 1 y 2) y hoja de zona | motor (`hojas_ruta_ficha_pdf.R`, `hojas_ruta_hoja_zona_pdf.R`) | `seccion=catalogo` (los mismos motores, como layout legacy de E2) |
| ZIP del paquete, Excel operativo, reemplazos puntuales, PDF de prueba | panel `salidas` | `seccion=paquetes&pestana=armado` |
| Plan de campo por encuestador, con mapa por encuestador (B20) y hoja del día | panel `salidas` | `seccion=entrega` (pestaña nueva `plan`, junto a `traspaso`) |

Los motores de R no se mudan de archivo ni se duplican: Material los llama con la muestra **enviada** (§3).

### 2. Qué queda en Hojas de ruta

Todo el diseño: Territorio, Población, Muestra (con los supuestos y el costo del plan, que deciden el tamaño),
Manzanas y Selección con la revisión contra el marco. El panel `salidas` de Selección conserva su id (está declarado
y lo recorre el QA) pero pasa a llamarse **«Entrega»** y sólo lleva:

- el estado del envío (no enviado / enviado con su huella y fecha / la muestra cambió desde el envío) y el botón
  **«Enviar a Material»** (U19);
- el enlace a la campaña territorial (`/material-campo?modo=territorial&campana=territorial.principal`);
- el informe de diseño muestral y la bitácora, que son del diseño.

La ficha de la UMP en Selección deja la miniatura y lleva «Ver en Material» (que abre su `panel=hoja` allá).

### 3. El envío es una foto con huella

«Enviar a Material» guarda en el estado de Hojas de ruta la muestra vigente con su huella (`sample_fingerprint`) y
fecha. `ump_territorial_v1` lee **esa foto**, nunca la muestra viva: Material no ve un re-sorteo hasta que se
reenvía, y si la muestra cambió, Hojas lo dice («La muestra cambió desde el envío del 29/10: reenvía») y Material
marca su lista `stale` (ADR 0108 §1). Reenviar no borra material ya generado; lo marca como de otra huella.

### 4. Direcciones en Material

`/material-campo?modo=territorial&campana=territorial.principal&seccion=<unidades|catalogo|paquetes|entrega>`, con
`foco=<id_manzana>` para la UMP y `panel=hoja` para la hoja grande, declarado en `PANELES_POR_MODULO` y abierto con
`usePanelDireccionable` (ADR 0044). El modo `territorial` se declara en `lib/modules.ts` con esas cuatro secciones;
los contratos de navegación (`auditReadyRoutes`, `uiQuickCheckNavigation`, `modulesNavigation`) se actualizan en
el mismo cambio.

### 5. Fases

| Fase | Contenido | Depende de |
|---|---|---|
| F1 | Backend: `POST /api/hojas-ruta/envio` (foto + huella en el estado, `project_dirty`), `ump_territorial_v1` sobre la foto, campaña `territorial` disponible; tests sin red | aceptación |
| F2 | Frontend de Material: modo `territorial` con las cuatro secciones, reutilizando los componentes de Salidas como layout legacy con paridad visual; `panel=hoja`; plan por encuestador con mapa | F1 |
| F3 | Hojas de ruta: `salidas` → «Entrega» (§2), «Ver en Material» en la ficha; retiro de las piezas mudadas con doble confirmación (gate 3) | F2 verificada en vivo |

## Consecuencias

- B19, B46 y el mapa por encuestador de B20 se resuelven en Material, no en Hojas de ruta; B22 «Enviar a Material»
  es U19 = F1 + F3.
- Hojas de ruta pierde la producción de material; gana una frontera clara: lo que decide el diseño queda, lo que
  se imprime y se reparte se va.
- Durante F2 conviven las dos puertas al material; F3 retira la de Hojas. No hay dos ediciones de lo mismo: Material
  sólo lee la foto.
- Revisión antes de implementar: `guardian-contratos` (persistencia de la foto en el `.pulso`, contrato del source
  adapter, paneles declarados).
