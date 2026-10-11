# Contrato A5 rebanada 2b — Vista general: «Otros» automáticos, índice, «Armar desde…» y E2

Tipo: Contrato de implementación
Estado: Vigente
Fecha: 2026-10-11
Autoridad: Lead de la Meta A; inventario de paridad `inventario-cierre-a0-2026-10-11.md` (C8, C37, C55, R5, R8, O4)

Rutas del frontend relativas a `frontend/src/features/graficos/` salvo que digan otra cosa. Diseño de origen: lectura de
código en `90b3356` (agente Plan, sin editar).

## Hechos que fijan la forma

1. Vista general hoy se pinta bajo la barra del Editor anterior: `GraficosPage.tsx:~334` monta `BarraLaminas` sólo con
   `pestana === "laminas"`; en las demás, `GraficosHeader` (Timeline/Canvas, «Estilo global» con «Otros», «Planes»).
2. Aplicar un plan sugerido ocupa hasta 3 pasos de deshacer (`loadPlan`, `applyPptStyleProfile`, `setScopeRules`) y
   `setEquivalenciasRevision` no entra al historial (`Snapshot`, `store.ts:~103-115`).
3. El interruptor de «Otros» (`setAutoOtrosSlides`, `store.ts:~472`) no se puede deshacer.
4. El selector de composición del índice puede mostrar «Arcos» y exportar «Círculos»: `conVariante` borra
   `meta.composicion` al elegir arcos (`laminas/selectores/tiposLamina.ts:~188-194`), pero con `iconos_focos` el motor usa
   círculos (`api/R/lamina_indice_focos.R:36-41`).
5. Un título de capítulo con «:» o «|» pierde sus subcapítulos (motor corta en el primero, `reporte_plan_ppt.R:~1039`;
   el modelo del front sólo mira «:», `indiceModel.ts:76`).
6. Un `plan.auto_otros_slides` gana al interruptor sin avisar (`router_graficos.R:~3094`); el normalizador lo deja pasar.

Backend de «Otros»: opt-in universal, `FALSE` si falta (B42/G-18); `/ppt`, `/ppt-all` por base, consolidado; el Word no
las lleva; el perfil ACNUR lo apaga; entra en la huella de miniaturas.

## Dónde vive cada cosa

| Capacidad | Superficie | Navegación |
|---|---|---|
| «Otros» automáticos | Barra de Vista general (grupo de cobertura): Switch «Láminas de «Otros» en el PowerPoint» con ayuda; encendido → chip «+ Otros al exportar» | En línea |
| «Armar desde…» | Barra común (`BarraLaminas`) y CTA de los vacíos de Láminas y Vista general | `panel=armar-desde` (popover, `usePanelDireccionable`) |
| Consolidado | Mismo botón con `aria-disabled` y motivo visible | — |
| Editor del índice | Inspector › Contenido de `p_slide_indice`: capítulos (título, subcapítulos, ícono) y «Tomar los capítulos del informe» con aviso de desfase | Ícono en `panel=iconos` (diálogo) |
| E2 | Composición del inspector con sello «Del recetario»; composición efectiva = la del motor | Sin cambios |

## Datos (sin cambio de forma persistida)

- «Otros»: mismas claves (`config.auto_otros_slides` + espejo en `scope_rules.global`); entra al `Snapshot`. Al leer, un
  `plan.auto_otros_slides` booleano sube a la raíz si falta y siempre se quita de `plan`. Un plan sugerido con valor
  distinto lo propone, nunca lo cambia sin avisar. En multibase independiente vale para la base activa.
- Índice: se siguen escribiendo `payload.secciones/subtemas/subindices`; íconos en `payload.meta.iconos: string[]`
  (`""` automático, `"none"` sin ícono; todo automático → sin clave). El editor nuevo nunca escribe `iconos_focos`; lee
  `meta.iconos[k]` y si falta `iconos_focos[k]`. Primera edición migra `iconos_focos` → `meta.iconos` y escribe
  `meta.composicion="circulos"` si no estaba declarada (la salida no cambia). `composicionIndiceEfectiva(slide)` replica
  `.lam_indice_composicion`. Avisos: más de 13 capítulos; «:» o «|» con subcapítulos (no se serializa); título vacío.
  `indiceDesdeEstructura(construirEstructura(slides))` explícito y deshacible; `indiceDesfasado` avisa, nunca sobrescribe.
- Planes sugeridos: acción única del store `aplicarPlanSugerido({plan, revision, perfil, identidad})` (un `dirty()`);
  `equivalenciasRevision` entra al `Snapshot`; `SuggestedPlanButton` con `consolidated` no llama a `/plan/sugerido`.
- E2: `variantesDe`/`conVariante` aceptan `defectoEfectivo?` (hoy el del recetario; A6 pasará el del cliente).

## Rebanadas

- Paso 0 (lead): `panelesGraficos.ts` añade `PANEL_ARMAR_DESDE` (popover) y `PANEL_ICONOS` (diálogo);
  `GraficosPage.tsx:~334` → `pestana === "laminas" || pestana === "vista-general"` (G2; aviso a la Meta B).
- W1 (Vista general, «Otros», «Armar desde…»): `vistaGeneral/**`, `armarDesde/**` (nuevo), `SuggestedPlanButton.tsx`,
  `store.ts`, `autoOtrosSlides.test.ts`, `laminas/LaminasWorkbench.tsx` (sólo el vacío), `frontend/src/api/
  graficosConfigNormalizer.ts`, `frontend/src/api/graficos.ts` (sólo el campo opcional `auto_otros_slides`).
- W2 (índice y E2): `indice/**` (nuevo), `laminas/InspectorLamina.tsx`, `laminas/SeccionComposicion.tsx`,
  `laminas/selectores/tiposLamina.ts` (+test). Sólo `updateSlidePayload`; no toca `store.ts`.
- Nadie toca `indiceModel.ts` (sólo lectura), `IndiceBuilder.tsx`, `ContenidoEditor.tsx`, `GraficosHeader.tsx`,
  `api/R/**`, `api/tests/**`.

## Tests y mutantes

W1: interruptor con `aria-checked` del store y texto «PowerPoint» (checked fijo); deshacer restaura «Otros» (quitar del
snapshot); `plan.auto_otros_slides` sale de `plan` (no quitarlo); aplicar plan = 1 paso con revisión (setters sueltos);
consolidado → `aria-disabled`, motivo y 0 llamadas (ignorar alcance); `?panel=armar-desde` abre y cerrar borra (estado
local); vacíos ofrecen «Armar desde» y no «Editor anterior»; «N avisos» abre `PanelAvisos` en Vista general.
W2: `meta.iconos` gana a `iconos_focos` (invertir); `serialize` nunca emite `iconos_focos` y todo automático quita la
clave; migración escribe `circulos` (no escribirla); `composicionIndiceEfectiva` replica al motor; «:»/«|» con
subcapítulos avisa y no serializa (validar sólo «:»); `indiceDesdeEstructura` y `indiceDesfasado` (contar subcapítulos
como capítulos); >13 capítulos avisa (tope 5 heredado); el inspector ya no dice «todavía se edita en el Editor anterior».

## Decisiones (recomendación del lead; Gonzalo puede cambiarlas)

| Código | Pregunta | Recomendación aplicada |
|---|---|---|
| G1 | ¿«Otros» por defecto? | Apagado: el recetario no dibuja láminas de «Otros» (opt-in B42/G-18) |
| G2 | ¿Vista general con la barra de Láminas? | Sí |
| G3 | ¿Índice automático desde los capítulos? | Ahora botón explícito + aviso de desfase; derivarlo en el motor queda para un ADR |
| G4 | Títulos con «:»/«|» y subcapítulos | Aviso y bloqueo, sin cambiar la forma |
| G5 | Migrar `iconos_focos` → `meta.iconos` | Sí, con composición explícita |
| G6 | ¿«Otros» con Ctrl+Z? | Sí |
| G7 | «Armar desde…» en consolidado | = D1 de A7 (pregunta 17 a Gonzalo); provisional: deshabilitado con motivo |
| G8 | E2 en Estilo del cliente | Provisional en el inspector; el defecto del cliente va en A6 R3 |

Riesgos a verificar aparte en backend: vista previa con `auto_otros_slides=TRUE` puede devolver las láminas de «Otros»
como partes extra; cambiar el interruptor invalida todas las miniaturas visibles (huella).

## Decisiones de Gonzalo (2026-10-11, preguntas 17, 21–23)

- 21 (G1): «Otros» apagado por defecto, pero como feature visible; las láminas deben salir con la forma que el recetario ya
  dibuja (ubicarla en `recetario-moderna.pptx` y alinear el motor; el contrato decía que no había: se corrige).
- 22 (G3): botón explícito + aviso de desfase, y el analista puede editar el índice resultante.
- 23 (G5): sí.
- 17 (G7): sin decisión cerrada; deshabilitado con motivo hasta estudiar la matriz de equivalencias de Procesamiento.

