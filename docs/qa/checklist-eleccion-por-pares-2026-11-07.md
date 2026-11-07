# Checklist: experimento de elección por pares (conjoint) en el editor, 2026-11-07

Pedido de Gonzalo, en tres mensajes:

1. Sobre los 240 cálculos sueltos en Estructura: «Todos estos cálculos están aquí y entiendo que son por una razón, pero
   francamente no me queda claro; además agregaste la sección conjoint pero luego no la usas».
2. Sobre el nombre: «¿Hay otra forma de llamarlo que experimento conjoint? No se entiende muy bien». Después pidió buscar
   términos académicos en español y evaluar las secciones anidadas: «no creo que hagan falta».
3. «De acuerdo con ambas decisiones»: el nombre «Experimento de elección por pares» y sacar los pares de la Sección B.
   Antes había aprobado hacer las dos cosas: ordenar el XLSForm y que el editor reconozca el experimento.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | El bloque se llama «Experimento de elección por pares» en el editor; «conjoint» sigue sirviendo para buscarlo | `conjoint/altaConjoint.tsx`, `conjoint/estadoPanelConjoint.ts`, `conjoint/PanelConjoint.tsx` | Hecho (71a3e152f): rótulo del menú y del panel, «Pares por persona», «1. Pares»; «conjoint» y «pares» siguen entre los términos de búsqueda |
| C2 | El generador del editor pone el sorteo de cada par dentro de su grupo «Par N», no suelto al inicio | `conjoint/modeloConjoint.ts` | Hecho (71a3e152f): cada par abre su grupo con su sorteo adentro, antes de la tabla; el orden sorteado de atributos queda antes del primer par. Test de inserción actualizado |
| C3 | El XLSForm del v5 sin la Sección B como grupo: los 8 pares quedan de primer nivel, el rótulo «Sección B» pasa a la nota de introducción y el sorteo de cada par va dentro de su grupo | `03_Instrumento/generar_xlsform_v5.py` del estudio (fuera del repo) | Hecho en el script (`generar_xlsform_v5.py`, versión 2026110701): sin grupo `secB`, «Sección B. Experimento conjoint» en negrita al inicio de `B_intro`, sorteo dentro de cada par; pyxform lo convierte (331 filas). **Falta reemplazar** `conjoint_defensa_v5_es.xlsx` en la carpeta del estudio: Excel lo tenía abierto. El nuevo está en el scratchpad (`v5_nuevo.xlsx`); el script y el xlsx viejo, respaldados |
| C4 | El editor reconoce un experimento ya escrito (el del v5 y el que genera el propio editor) y lee su diseño: pares, perfiles, atributos, niveles, pesos y condiciones | `conjoint/leerConjoint.ts` (nuevo) | Hecho (5da0353d8): `leerConjoint` reconoce el del editor y el del v5 (otros nombres, sorteo suelto o dentro de los pares, pares dentro de una sección) y lee pesos y condiciones; sólo es editable si el diseño leído regenera las mismas filas. Con el v5 real: 8 pares, 5 atributos, 240 cálculos, fiel. `reemplazarConjoint` conserva los nombres y no quita un par cuyo sorteo usa otra pregunta (la sección D usa el par 8). 7 tests |
| C5 | En Estructura, el sorteo de cada par se ve como una sola fila plegada; abrirla lleva al panel con el diseño cargado para editarlo | `outline/`, `conjoint/MontajeConjoint.tsx` | Hecho (a713dbe66): «Sorteo del par N» plegado con su conteo y el botón «Diseño», que abre el panel con el diseño leído y «Aplicar cambios». Visto en vivo con el `.pulso` del TCD a 1440: 8 sorteos, cada uno dentro de su par; el panel trae 8 pares y 5 atributos. No se aplicó un cambio desde el panel en vivo (es el proyecto de Gonzalo); el reemplazo está cubierto por tests. 3 tests del modelo de Estructura |
| C6 | El formulario del `.pulso` del TCD se actualiza con el XLSForm nuevo | `2026_TCD_Conjoint_Defensa/04_Proyecto/tcd_conjoint_defensa.pulso` | Hecho: el formulario del `.pulso` del TCD tiene el XLSForm nuevo (331 filas, sin `secB`, versión 2026110701); el `.pulso` anterior, respaldado en el scratchpad |

## Decisiones y lo aprendido

- Términos en español: «experimento conjoint» (ciencia política latinoamericana, sin traducir), «experimento de elección
  por parejas» (preferencias declaradas), «análisis conjunto» (marketing; nombra el análisis), «encuesta factorial» o
  «estudio de viñetas» (sociología; se califica un escenario a la vez). Gonzalo eligió «Experimento de elección por
  pares».
- Secciones anidadas: las baterías A1 a A3 necesitan su grupo (`table-list`); la Sección B no. Con `style = pages`,
  Enketo hace una página por cada grupo de primer nivel, así que la Sección B entera (introducción y 8 pares) salía en
  una sola página y el encuestado veía todos los pares a la vez.
- La sección D lee `t8A_*_txt` y `t8B_*_txt`: mover el sorteo dentro de «Par 8» no rompe esas referencias (XLSForm
  resuelve `${}` entre grupos).
- La primera vez que se abrió el `.pulso` actualizado, el editor mostró el formulario VIEJO: la copia autoguardada en el
  navegador (`pulso.xlsformEditor.workbook.v2.<proyecto>.<form_id>`) gana sobre la del backend aunque esta sea más
  nueva. Hubo que borrar esas claves. Afecta a cualquiera que actualice un formulario fuera del navegador.
- En el panel, la pregunta y la introducción del v5 se editan en campos de una línea y muestran el markdown crudo
  (`**B1.**`, `**Sección B…**`).
