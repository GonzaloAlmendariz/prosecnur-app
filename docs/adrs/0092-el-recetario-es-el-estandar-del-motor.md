# ADR 0092 — Los recetarios son el estándar del motor de PPT y Word

- **Estado**: Aceptado
- **Implementación**: En curso — fuente de verdad en `api/inst/estandar/estandar_pulso.json`
  (exportada por `docs/qa/motor-ppt-2026-10-06/herramientas/exportar_estandar.R`); fases F0 a F7 en
  [goal-remasterizacion-motor-2026-10-08.md](../qa/goal-remasterizacion-motor-2026-10-08.md)
- **Ámbito**: Procesamiento › Gráficos (motor PPT, motor Word, graficadores y editor)
- **Fecha**: 2026-10-08 · **Ratificado**: 2026-10-08 (Gonzalo: «el recetario de PPT, tanto como el
  recetario de Word, son a lo que tenemos que apuntar. Y precisamente ante eso es lo que el motor debe ajustarse»)
- **Relación**: deja histórico el estilo «fiel» del recetario como norma; conserva
  [estandar-ppt-acreditacion-2026-08-14.md](../qa/estandar-ppt-acreditacion-2026-08-14.md) sólo como referencia de contenido.

## Contexto

El motor se construyó por capas, lámina a lámina y caso a caso. Hoy el estilo vive en al menos cuatro lugares
que se contradicen: los presets de `graficos_metadata.R`, los defaults de cada `graficar_*`, valores sueltos
dentro de `reporte_plan_ppt.R` y paletas que sólo existen en perfiles. La geometría la deciden las plantillas
(márgenes de 0.315, 0.347 o 0.505 in según el layout). El Word arma el documento a mano, sin estilos ni campos.

Entre el 6 y el 8 de octubre de 2026 se cerraron dos recetarios con Gonzalo: la propuesta de diseño en PPT
(`recetario-moderna.pptx`, 22 tipos de lámina) y la propuesta en Word (`propuesta-word.docx`).

## Decisión

1. **Una sola fuente de verdad.** Todo valor visual del motor (color, tamaño, margen, grosor, aire, posición de
   ranuras, estilos de Word) sale de `estandar_pulso.json`. Ningún graficador ni renderer declara un valor
   visual propio. Lo que hoy es un número suelto pasa a ser un token con nombre.
2. **El recetario moderno es el estilo por defecto.** Los perfiles de cliente (acreditación, ACNUR) quedan como
   variantes que sólo cambian logo y paleta, sobre la misma geometría y las mismas reglas.
3. **Los proyectos existentes migran solos.** Un plan guardado se abre y se regenera con el estándar; lo que no
   tenga equivalente se avisa con nombre (`[PULSO-AVISO]`), nunca se descarta en silencio.
4. **La app produce el Word completo**: portada, índices, capítulos con apertura y encabezado, «Cómo leer este
   informe», figuras con rótulo, base y lectura, tablas y contraportada.
5. **Conformidad medida.** Las reglas de `verificar_mazo` se amplían con la conformidad al estándar; una fase
   se cierra en verde por conformidad, no por ausencia de errores.

## Consecuencias

- Cambiar el estilo es cambiar el JSON (y el recetario que lo origina), no un graficador.
- `reporte_plan_ppt.R` y `graficador_dimensiones.R` siguen congelados: lo nuevo va en archivos propios y el
  renderer sólo delega.
- Los mazos de proyectos ya entregados se verán distintos al regenerarse: es el efecto buscado.
