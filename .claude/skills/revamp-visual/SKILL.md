---
name: revamp-visual
description: Dirige e implementa un rediseño de Prosecnur con identidad local, geometría declarada, capacidad real y QA desktop independiente. Usar al modernizar o pulir una vista, módulo o componente.
---

# Revamp visual

Un revamp debe mejorar una tarea concreta sin romper identidad, navegación,
capacidad ni accesibilidad. Sus fuentes locales son:

- `branding/identity.json`, `branding/direccion-creativa-v3.md` y
  `branding/catalogo-visual/`;
- `frontend/src/app/tokens.css`, `frontend/src/app/theme.css`,
  `frontend/src/lib/modules.ts` y los componentes compartidos en
  `frontend/src/components/`;
- `docs/ui-layout-grammar.md` y `/contrato-superficie`.

Para geometría compositiva se puede cargar `govern-visual-harmony`; para
microinteracciones, `emil-design-eng` es opcional. Ninguno sustituye los
contratos locales.

## 1. Congelar dirección

1. Abre la vista con `/ver-ui` sobre el proyecto de referencia adecuado y toma
   evidencia **antes** en desktop grande y compacto.
2. Declara en pocas líneas: problema, tarea primaria, qué se conserva, patrón
   reutilizado y criterio de éxito.
3. Ubica el cambio en una sola dimensión de la gramática
   **módulo → modo → sección → pestaña → panel**. No inventes un sexto nivel ni
   dupliques una navegación existente.
4. Conserva tono del módulo, tipografía, logos, iconografía, materiales y
   estados definidos por la identidad. Reutiliza `PageFrame`,
   `AdaptiveSplitView`, `PulsoButton` y demás primitivas existentes antes de
   crear otra variante.
5. Congela el contrato de capacidad para `0 / 1 / pocos / muchos`: marcos,
   grupos pares, ancho/alto, breakpoint, contenido intrínseco y dueño del
   overflow.
6. Declara C1 antes de asignar archivos:
   `data-qa-geometry-group`, contrato `equal` o `intrinsic`, miembros y capacidad
   poseída.

## 2. Implementar

- Usa tokens `--pulso-*`; un valor visual nuevo entra primero en el sistema
  canónico, no como literal aislado del feature.
- Mantén la identidad entre shell, pantalla, estados vacíos, overlays y
  entregables relacionados. Un acento de módulo no reemplaza colores
  semánticos de éxito, advertencia o error.
- C2: el marco responde a rol y viewport, no a `items.length`.
- C3: el vacío útil permanece dentro de una superficie visible; secciones
  independientes conservan alto intrínseco.
- C4: un dueño de scroll, paginación, virtualización o detalle hace alcanzable
  todo el contenido.
- C5: clasifica todo vacío como legítimo, limitación del fixture o desconexión
  real. No fabriques texto ni datos para llenar espacio.
- No crezcas archivos congelados ni dupliques componentes/navegación. No
  elimines una superficie sin confirmar su función y contrato.
- Preserva foco, teclado, nombres accesibles, contraste, movimiento reducido y
  render Windows/macOS.

## 3. QA independiente

1. Ejecuta typecheck y los tests focales.
2. Usa el mismo proyecto antes/después y prueba, como mínimo, `1440x1000` y
   `1024x600`; añade cardinalidad alta, modo oscuro o ambos cuando corresponda.
3. Ejecuta:

   ```bash
   make ui-quick-check UI_QA_ARGS='--route <ruta> --viewport 1440x1000 --viewport 1024x600 --require-geometry --fail-on-issues'
   ```

   Para una ruta respaldada por estudio real, prefiere
   `make reference-project-visual-matrix REFERENCE_PROJECT=<slug>`.
4. `qa-visual-desktop` revisa sin editar producto: C1–C5, scroll final,
   overlays, navegación direccionable, identidad y comparación visual. Un
   `visualIssues=0` sin cobertura de geometría o suficiencia no aprueba.
5. Cierra con screenshots antes/después, viewports, proyecto, cardinalidades,
   medidas de los grupos, dueño de overflow, hallazgos de accesibilidad y
   veredicto serial de `verificador`.
