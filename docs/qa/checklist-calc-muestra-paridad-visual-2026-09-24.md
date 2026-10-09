# Checklist — Paridad estética y de accesibilidad de Muestra general y Acreditación con aulas

Tipo: Checklist vivo · Fecha: 2026-09-24 · Etapa E11 del loop de Cálculo de muestra

Pedido de Gonzalo (textual): «Pero ademas le falta muchas mejoras esteticas y
de accesibilidad a la UI que ya tiene aulas pero no los demas caminos».

Evidencia de partida (scratchpad del loop): baseline visual `e11_baseline/`
(aulas hsvg2026, general `general_sorteo_trabajo`, acreditación
`acred_trabajo`; 1440×1000 y 1024×600) y matriz de código
`e11_matriz_codigo.md`. Cifras: universidad vs general — aria 630/115,
role 204/14, data-audit-ready 30/3, focus-visible 62/6,
prefers-reduced-motion 49/1, tabular-nums 252/9, gráficos SVG 54/0.

## Dirección congelada

- **Problema**: Muestra general y Acreditación calculan y sortean bien, pero
  se leen como formularios: sin cifras vigentes arriba, sin gráficos que
  expliquen la muestra, con tres estilos de aviso y tabla, vacío muerto y
  fallos de a11y (inputs sin nombre, paneles de pestaña huérfanos, saltos de
  encabezado).
- **Tarea primaria**: el usuario ve de un vistazo qué muestra lleva, por qué,
  y qué falta para sortear.
- **Se conserva**: la navegación v3 (modo → sección; ninguna dimensión
  nueva), el tono morado del módulo, los contratos HTTP, el comportamiento.
- **Patrón reutilizado** (de aulas, tal cual): `CifraMotor`/`CifraFila`,
  `AvisoModulo`, `FormulaLatex` + `TerminoChip`, tablas `cmv2-tabla`/`cmv2-num`,
  `useTooltipGrafico`, `BarraTasa`, `SwapValor`, `PanelAvanzado`.
- **No se copian** los defectos propios de aulas vistos en la baseline
  («Guardando…» persistente, chip `p 0.3` sin estilo, KPIs huérfanos a 1024).
- **Éxito**: cada sección de general y acreditación pasa `ui-quick-check
  --require-geometry` a 1440×1000 y 1024×600 con geometría declarada, sin
  inputs sin nombre, sin saltos de encabezado, con readiness, y a la vista de
  un revisor se lee al nivel de aulas.

## Ítems

| # | Ítem | Dónde vive | Dueño | Estado |
|---|---|---|---|---|
| V1 | Banda de cifras «Diseño vigente» (N, estratos, n completas, n a campo, margen, técnica; en Selección, la corrida) con `CifraFila` | `general/BandaDiseno*.tsx` nuevo, montado en Mesa general y Mesa acreditación | W1 | ☑ |
| V2 | Fuera la tarjeta-título que repite la sección (~80 px); encabezado con estado (`data-status`) y «siguiente condición» | `EncabezadoSeccion.tsx`, `MesaGeneral.tsx`, `MesaAcreditacion.tsx` | W1 | ☑ |
| V3 | Sin paneles huérfanos: los `role="tabpanel"` sin pestaña que los controle pasan a región con `aria-labelledby` de su encabezado. El rail de secciones NO se toca aquí: es compartido con aulas, vive en `CalcMuestraPage.tsx` (congelado) y lo gobierna `CalcMuestraSectionRailSemantics.test.ts` | `MesaGeneral.tsx`, `MetodoGeneral.tsx`, `MesaAcreditacion.tsx` | W1 · W2 (Método) | ☑ |
| V4 | Un solo aviso (`AvisoModulo`) con `aria-live` para desactualizado/resultados | `FichaCorrida.tsx`, `ResultadosComponentes.tsx`, `ParametrosTecnica.tsx` | W1 (Ficha, Resultados) · W2 (Parámetros) | ☑ |
| V5 | Reparto por estrato como gráfico: barras N_h vs n_h con π y peso, tooltip accesible (`role="img"` + tabla alternativa) | `general/RepartoEstratosGrafico.tsx` nuevo, en Resultados y Selección | W1 | ◐ tooltip por foco hecho; se cierra si el foco desplaza el contenedor |
| V6 | Memoria de cálculo con `FormulaLatex` y glosario (`TerminoChip`) | `MemoriaCalculoGeneral.tsx` | W1 | ☑ |
| V7 | Estados vacíos con «siguiente condición» y acción; el botón deshabilitado dice por qué | `SeleccionGeneral.tsx`, `SeleccionActores.tsx`, `MesaAcreditacion.tsx` | W1 (Mesa) · W2 (Selección) | ☑ |
| V8 | Sin vacío muerto: Contexto, Actores y Resultados usan el alto disponible | layouts de Mesa + `mesa.css` nuevo | W1 | ☑ |
| V9 | Tablas al estilo `cmv2-tabla`: cabecera fija, hover, `scope`, `caption`, numéricas a la derecha con `tabular-nums` | `EstratosGeneral`, `ActoresAcreditacion`, `TablaUnidades`, `general.css` | W2 | ☑ |
| V10 | Un solo formato es-PE (`fmtInt`/`fmtPct`); fuera `formatearEntero` | `general/modelo.ts` y consumidores | W2 | ◐ cifras es-PE unificadas; el «0,04» de los inputs numéricos lo pone el navegador (`lang` es-PE añadido, sin medir en Electron) |
| V11 | Todo input con nombre accesible y rótulo visible: `NumberCell` gana `ariaLabel`; «Marco (N)» de actores; notas de la propuesta | `universidad/aulas/NumberCell` (prop opcional), `ActoresAcreditacion`, `ResultadosComponentes` | W2 (NumberCell, Actores) · W1 (notas) | ☑ |
| V12 | Encabezados sin saltos (H2→H3→H4) | cada archivo por su dueño | W1 · W2 | ☑ |
| V13 | `data-audit-ready` en Método, Resultados, Contexto y Actores | Mesa (W1) · Método/Actores (W2) | W1 · W2 | ☑ |
| V14 | `:focus-visible` y `prefers-reduced-motion` en todo lo interactivo de general | `general.css` · `mesa.css` | W2 · W1 | ☑ |
| V15 | 1024×600: «Por calcular» y «175 a campo» no se parten; píldoras no tocan el estado de la mesa | `ActoresAcreditacion`, `general.css` (W2) · encabezado (W1) | W1 · W2 | ☑ |
| V16 | Docentes con MAS muestran la respuesta esperada (60 %) y no «sobremuestra 0 %» | `ActoresAcreditacion.tsx` | W2 | ☑ |
| V17 | Contraste AA en textos secundarios de general (color-mix con `--pulso-text`) | `general.css` · `mesa.css` | W2 · W1 | ☑ |

Fuera de alcance, anotado: defectos propios de aulas de la baseline
(«Guardando…» persistente al abrir, KPIs «—» calculados con versión anterior,
chip `p 0.3` sin estilo, cuadrícula de KPIs huérfana a 1024, C1 sin declarar
en `cmv2-salud-lista`, `cmv2-calc-supuestos`, `cmv2-generales-card`, contraste
1.94:1 de «cifra validada»).

## Cierre (2026-09-24)

Tres rondas de QA visual independiente (`qa-visual-desktop`) sobre las mismas
copias y viewports que la baseline: ronda 1 RECHAZADA (geometría 4, «sorteado»
contradictorio, vacío 144–228 px, 1024 sin compacto, «Calcular» sin request),
ronda 2 RECHAZADA por un bloqueo (tarjetas de actor sin `vigenciaSorteo`),
ronda 3 `ok=true` y `geometryIssues=0` en acreditación N alto (6 capturas,
1440/1280/1024) y general (9 capturas, 1440/1366/1024, md5 9/9). Verificador:
APROBADO CON PENDIENTES; su pendiente (test de integración de la vigencia en
Selección) quedó cubierto por `actoresDelSelector` con mutante que cae.
Gate: tsc 0, front 255 archivos / 2 391 tests (base 251 / 2 322).

Decisión tomada: el chip de estado del chrome («Mesa preparada») se oculta en
estas dos mesas (`body:has(.cmg-mesa)`, mesa.css): a 1024 px pisaba el rail y,
más ancho, contradecía a la cabecera nueva, que dice el estado fino y la
siguiente condición. Aulas no cambia.

Pendiente menor: la cabecera + banda de Muestra general a 1024×600 midió 156–173
px en la ronda 2 (meta 140); la técnica ya no se parte en tres líneas.

