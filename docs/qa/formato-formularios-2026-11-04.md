# Formato en Formularios (4 nov 2026, noche)

Tipo: Registro QA fechado
Estado: En curso
Fecha: 2026-11-04
Autoridad: Encargo de coordinación (Meta B) a pedido de Gonzalo; decisiones revisables por él

Encargo de coordinación (Meta B) a pedido de Gonzalo: «aún hay bastante UI desfasada por mejorar durante toda la
noche». Receta de `formato-monitoreo-2026-11-02.md` y `formato-hojas-ruta-2026-11-04.md`. Alcance de escritura:
`frontend/src/features/xlsformEditor/`, sus tests y este doc. Las decisiones son de coordinación y **revisables por
Gonzalo**. Se respeta el trabajo reciente de Gonzalo (asa de arrastre, botón «?», L36 «Así queda»); `impreso/` sólo
después de mirar su `git log`.

## Medición (4 nov, mañana)

Script `medirxf.mjs` en el scratchpad de la sesión: recorre `features/xlsformEditor` sin tests ni `__tests__` y no
cuenta comentarios.

| # | Patrón | Antes | Dónde nace | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px | 47 en 6 hojas | `impreso/impreso.css` 17, `styles/xf-simulator.css` 17, `styles/xf-preview-inputs.css` 9 | **Ya cerrado** por la pasada L29 y el ratchet `app/letraPorRol`: los 47 son excepciones declaradas en su regla. El impreso es la página del Word, el simulador y la previa de entradas imitan el formulario en el dispositivo, la frase del Armador es grande a propósito, el «×» es un glifo y el título de la biblioteca va entre `title` y `display` |
| P2 | `h2–h4` sueltos / `<Panel>` del kit | 56 en 42 archivos / 3 | `shell/` 24, `choiceFilters/` 8 | |
| P3 | Líneas de código con « · » | 120 en 76 archivos | `shell/` 40, `canvas-graph/` 12, `impreso/` 12, `outline/` 10 | La cifra de 305 del encargo incluía comentarios |
| P4 | Cifra a mano (`toLocaleString`, `toFixed`) | 6 | `shell/HallazgosPanel.tsx` 2, `kit/Sello.tsx`, `outline/modeloEstructura.ts`, `resumen/TablaSecciones.tsx`, `shell/campanaComplementariaModel.ts` | |
| P5 | Vacíos y cargas con receta propia (usos en JSX) | ~70, más de 20 recetas | `pulso-xf-listas-vacio`, `xfo-vacio`, `xfh-vacia`, `pulso-xfs-empty`, `pulso-logic-builder-empty`… | `EstadoVacio` del kit: 0 usos; `LoadingBlock`: 1 |
| P6 | Estados con píldora propia | ~70 | `xcf-chip`, `pulso-xftr-chip`, `pulso-xfs-pill`, `pulso-xf-status-dot`… | `EstadoChip` del kit: 0 usos. Sólo los que dicen un ESTADO (cumple, falta, error); los chips de dato o de tipo quedan |

## Ranking de vistas (por densidad de patrones, peor primero)

| # | Vista | « · » | Vacío o carga | Chip o estado | `h2–h4` | Estado |
|---|---|---|---|---|---|---|
| 1 | `shell/` (cabecera, biblioteca, paneles laterales, asistentes) | 40 | 20 | 24 | 24 | ☑ tanda 1 |
| 2 | `inspector/` | 7 | 11 | 22 | 0 | ☑ tanda 2 |
| 3 | `choiceFilters/` | 6 | 5 | 11 | 8 | ☑ tanda 3 |
| 4 | `canvas-graph/` (lógica en grafo) | 12 | 10 | 4 | 1 | ☑ tanda 3 |
| 5 | `canvas/` | 6 | 8 | 5 | 4 | ☑ tanda 3 |
| 6 | `impreso/` | 12 | 3 | 6 | 2 | ◐ tanda 4: P3 y P4 (su `git log`: 5 commits de L36 de hace dos días, sin cambios sin commitear) |
| 7 | `sheets/`, `outline/`, `listas/`, `catalogs/`, `resumen/` y el resto | 30 | 18 | 15 | 17 | ◐ tanda 4: P3 y P4 |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición y ranking | ☑ | (este doc) | |
| Tanda 1: `shell/` | ☑ | (ver abajo) | P3: 39 líneas pasan a coma, «y» o paréntesis («Disponible, revisión 2», «Fuera de Prosecnur (SPSS)», «Matriz (2 filas)»). La barra de comando dice «N preguntas, M secciones, listas» sin separadores sueltos. El parser de errores del servidor busca `\u00b7`, no el carácter. P4: `toFixed` y `toLocaleString` a `formatoDecimal`. P5: 12 vacíos a `EstadoVacio` y la carga de sugerencias a `LoadingBlock`; −16 selectores huérfanos. Declarados: el simulador y el esqueleto de carga de la campaña. P6: sin estados con tono que convertir («Activo» es identidad del módulo; las píldoras de la barra son el slot de estado del chrome). Guard nuevo `formatoDelModulo.contract.test.ts` (P3, P4 y P5 por archivo, sólo baja). Foto: P3 81, P4 3, P5 48 |
| Tanda 2: `inspector/` | ☑ | (ver abajo) | P3: 7 líneas («n.º 3», «(compartida con 2)», «(equivale a DNI)», el placeholder de cálculo con «o»). P5: 6 vacíos a `EstadoVacio`, los de condición y validación con su acción («+ Agregar condición», «Fórmula avanzada»); −7 selectores huérfanos. Declarados: la condición guiada sin preguntas previas (ilustración y dos acciones) y `pulso-catalogchip-empty`, que es el botón «Asignar lista» y cuyo estilo vive en `app/theme.css`. P6: los chips del inspector son de tipo o de dato, no estados. Foto: P3 74, P4 3, P5 41 |
| Tanda 3: `choiceFilters/`, `canvas-graph/`, `canvas/` | ☑ | (ver abajo) | P3: 24 líneas. Los pasos del asistente de filtro dicen «1. Pregunta»; las relaciones del lienzo, «(3 ramas)»; las fichas, «Pregunta 4, Sección A»; la referencia corta de una pregunta, «P3.2». P5: 6 vacíos a `EstadoVacio` (el cierre de sección con su acción «Eliminar el cierre»); −10 selectores huérfanos. Declarados: las superposiciones del lienzo de lógica (`pulso-graph-*`, con ilustración y acciones). Foto: P3 50, P4 3, P5 32 |
| Tanda 4: P3 y P4 en el resto | ☑ | (ver abajo) | P3: 46 líneas. Los atajos se escriben con coma («Enter abre, Alt+↑ / Alt+↓ mueve»); los resúmenes de Impreso, «Dos columnas, con N.º» y «A4, 12 páginas, 87 preguntas»; el código de la fila ya no lleva un « · » suelto delante. Quedan 4, deliberadas: la portada de `impreso/MaquetaPagina` (reproduce el Word), el ejemplo «10 · 20» del Armador, un fixture de prueba y el parser de errores del servidor (escrito `\u00b7`, no cuenta). P4: el conteo de `outline/modeloEstructura` y los minutos de `resumen/TablaSecciones` por el formateador; queda el `toFixed(4)` de `kit/Sello`, que es geometría SVG. Foto: P3 4, P4 1, P5 32 |
| Tanda 5: P5 en el resto | ☑ | (ver abajo) | 13 vacíos a `EstadoVacio` (biblioteca y área de listas, comparación entre formularios, matrices y versiones de Impreso, pestaña Opciones, Armador, secciones del Resumen y hojas vacías) y la lectura de otros formularios a `LoadingBlock`; −16 selectores huérfanos. Declarados en el guard: el error de la previa de Impreso con «Reintentar» (`ErrorBlock` no lleva acción), el HTML de la previa de markdown y el id de diagnóstico `settings-*-empty`. Los `is-empty`, `is-vacia` e `is-loading` son modificadores de estado, no recetas. **P5 en meta 0.** P3 queda en 3 líneas deliberadas: la portada de `MaquetaPagina`, que reproduce el Word, el ejemplo «10 · 20» del Armador y un fixture. P4 en 1: geometría SVG de `kit/Sello` |
| Captura después | ☑ | | `acnur_acg` (copia de corrida), `/editor-xlsform` a 1440×1000 y 1024×600: `ok=true`, 0 hallazgos. Se lee «1 pregunta, 0 secciones, 1 lista», «Pregunta 1, fuera de toda sección» y «1 opción, sólo esta pregunta la usa» |
| P2 (Panel) | ☑ (acotado) | (ver «P2 y P6, 4 nov mañana») | Decisión de coordinación, revisable por Gonzalo: sólo `shell/` y `choiceFilters/`. Revisados los 32 `h2–h4` uno por uno, el único bloque «caja con cabecera» son los paneles del Resumen; los demás son títulos de diálogo, nombres de tarjeta, la leyenda, la ayuda guiada, secciones dentro de los pasos del importador, antetítulos de sub-bloque del detalle de filtro y un cajón flotante (`HallazgosPanel`, que sería un `Sideover`). El constructor, su inspector y el lienzo de lógica no se tocan |
| P6 (EstadoChip) | ☑ | (ver «P2 y P6, 4 nov mañana») | Sólo las píldoras de ESTADO: el estado de cada filtro de opciones, «ya tiene filtro», «nunca visible», las insignias de Restricciones y Cálculos y el contador de «Qué falta para publicar». Se quedan los chips de tipo, de dato (los códigos huérfanos de la matriz de cascada), del simulador y «Activo» |

## P2 y P6, 4 nov mañana (decidido por coordinación, revisable por Gonzalo)

Antes de tocar nada se miró `git log -10 -- frontend/src/features/xlsformEditor`: el asa de arrastre, el «?» y L36
(Impreso) no se tocan.

- **P6.** `choiceFilters/ListaFiltros` (`ChipEstado`: ok → éxito, nunca → aviso, vacía y en conflicto → peligro, sin
  vista → neutro, también en el detalle), «ya tiene filtro» (selector de pregunta) y «nunca visible» (opciones de la
  expresión) a `EstadoChip`; `pestanas/` las insignias de Restricciones (vigente, sin regla, sin traducir, fila rota) y
  de Cálculos; `resumen/` el contador «N tareas pendientes / Todo en orden». −10 reglas (`xfp-insignia`,
  `xcf-chip__punto` y sus tonos, `pulso-xf-res-contador`).
- **P2.** Los tres bloques del Resumen («Qué falta para publicar e imprimir», «Composición» y «Secciones») son `Panel`
  sin relleno, con el título y la nota o el estado en `actions`; la cabecera conserva su filete. «Composición» vive en
  `shell/`; los otros dos en `resumen/` y van en el mismo cambio para que el Resumen no mezcle dos cabeceras.
- **Guard.** `formatoDelModulo.contract.test.ts` suma P6 (las píldoras de estado de arriba, meta 0) y P2
  (`pulso-xf-res-panel-cabeza`, meta 0), con los casos que prueban el detector (los códigos huérfanos no cuentan).
- **Defecto previo visto en la captura, no tocado:** Restricciones titula la pregunta «Restricción ( P1», con el
  paréntesis sin cerrar.
- **Capturas** (`--url` contra la pila de la sesión, `hsvg2026`, 1440×1000 y 1024×600): Filtros, Restricciones y
  Cálculos sin hallazgos; los estados se leen como `EstadoChip`. El Resumen se pide con su `form_id`
  (`/editor-xlsform?pestana=resumen&form_id=…`) porque abrir el formulario restaura la última pestaña. Los tres Panel se
  leen bien en los dos anchos. El runner marca tres cosas de la tabla de Secciones que este cambio no toca (viven en
  `xf-summary/02-secciones.css`, sin diff), anotadas como **previas**:
  1. La chapa «Pesada» se sale 30 px (1440) y 18 px (1024) de su caja.
  2. A 1440, la cabecera fija de la tabla tapa 23 px de la fila tras desplazar fila y media.
  3. El nombre de sección trae el HTML del XLSForm (`<span style="color:#002060">…`) y se pinta como texto: es el
     dato del instrumento, pero la tabla debería mostrar el rótulo limpio.

  **Resueltos los tres** (pedido de coordinación, un commit cada uno; capturas `--url` a 1440 y 1024 con `ok=true`,
  `issues=0`, 2 md5 distintos):
  1. ☑ El rótulo de la sección pasa por `stripMarkdown`, el helper con que el resto del editor (Vista, simulador,
     filtros, progreso) muestra el texto del XLSForm. Se limpia una vez en el modelo (`modeloResumen`), así la tabla,
     el detalle desplegado y los tramos del recorrido con sus títulos leen lo mismo; sin texto, cae al `name`. Test en
     `modeloResumen.test.ts`.
  2. ☑ «Pesada»: en la tabla angosta (contenedor ≤ 980 px, que es la de 1440 y la de 1024) la columna de la sección
     mide 140 px y la chapa se encogía bajo su texto. Ahí la chapa queda sólo para el lector de pantalla y a la vista
     la marca un filete del acento junto al nombre, además de su barra de peso llena; en la tabla ancha no se encoge.
  3. ☑ Cabecera fija: el patrón de la grilla de bases (1f8075374). `useAltoDeCabecera` mide su alto real (46 px: los
     rótulos parten en dos líneas) y las filas encajan bajo ella al desplazar (`scroll-snap`); una sección desplegada
     más alta que el marco se sigue recorriendo libre.
