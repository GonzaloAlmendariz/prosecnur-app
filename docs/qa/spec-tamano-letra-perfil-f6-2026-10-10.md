# Tamaño de letra por perfil de cliente (K13, F6)

Tipo: Especificación (sesión de diseño del editor, 2026-10-10). Gonzalo eligió la opción 2 (tamaño de letra por perfil
de cliente) y pidió que fuera más específica. Principio vigente: el recetario manda; el perfil sólo desplaza sus
valores en pasos con nombre.

1. **Dónde vive.** En el perfil de cliente (el que ya cambia logo y paleta, ADR 0092 decisión 2), no en el plan ni en
   la lámina. Lo heredan todos los informes del cliente; un informe puede fijar otro valor sólo como excepción declarada
   («propio de este informe»). Nunca por lámina ni por gráfico.
2. **Qué se controla.** Pasos con nombre, no número libre: «Estándar» (0, el recetario), «Grande» (+2 pt), «Muy grande»
   (+4 pt), aplicados a toda la jerarquía. «Afinar por elemento» con los mismos tres pasos por rol: títulos (título 24 y
   antetítulo 10), preguntas y premisas (13), cifras (14/13/12 y cifra_fuera 12), rótulos y leyenda (12/11.5/11/10.5 y
   leyenda 12), base y notas (10). El rol hereda el paso global salvo que se afine.
3. **Motor.** Un desplazamiento por rol en el perfil que `.std_pt(rol)` suma al valor del estándar; las piezas no cambian
   de código. Los tamaños de familia por tipo de lámina (`familia.cifra_pt`, `rotulo_pt`) se desplazan igual. Piso: en
   Word nunca por debajo de 8 pt; en PPT el estándar mismo (no hay paso «chico»). Techo: +4.
4. **Composición.** La geometría de las ranuras no cambia. `.lam_lineas_tinta` y las compuertas `*_cabe` corren con el
   tamaño efectivo: las filas ganan aire, la partición en «(cont.)» se recalcula y la compuerta decide como hoy.
   `verificar_mazo` mide la conformidad contra el estándar más el desplazamiento del perfil.
5. **Editor.** Estilo del cliente › Tipografía: el control con sus pasos y la vista previa viva (lámina y página Word);
   el resumen «Con “Grande” este informe pasa de 24 a 27 partes» con plan abierto (partición en seco). En el inspector,
   el candado dice el tamaño efectivo («cifra 16 pt = 14 del recetario + 2 del perfil»); en Estado, si la partición
   cambió por el perfil.
6. **Word.** Mismo perfil y roles mapeados a `word.tipografia` (titulo_1, titulo_2, cuerpo, rotulo, base, lectura,
   grafico_cifra, grafico_rotulo, grafico_leyenda), con el piso de 8 pt en figuras.
7. **No entra.** Tamaños por gráfico o lámina, familia tipográfica distinta de Arial salvo que el perfil la declare
   («Propia del cliente»), pasos fuera de los tres con nombre.

Recetario: añadir una lámina que muestre la misma lámina en «Estándar» y «Grande» (como las marcas 0–100 %), para
documentar la opción.
