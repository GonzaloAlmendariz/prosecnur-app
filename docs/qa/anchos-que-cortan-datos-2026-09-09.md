# Un ancho fijo acaba cortando un dato

Escrito el 2026-09-09, después de encontrar el mismo defecto **cinco veces** en
el libro de aulas y de descartar, con la medición delante, el detector que
parecía la solución obvia.

## La regla

Cuando en el generador del `.xlsx` aparezca un `setColWidths` con un número
literal, sospechar. Ese número se eligió mirando el contenido de un día, y el
contenido crece: un nombre más largo, una persona con dos bloques de horario,
un aplicador con cuatro aulas en la jornada.

**El corte no rompe ningún test.** La celda conserva su valor íntegro y el
archivo se abre sin quejarse; lo único que pasa es que quien lo mira ve la
mitad. Los cinco casos tenían su suite en verde antes y después.

## Cómo se comprueba

Dos preguntas, en este orden:

1. **¿El contenido real excede el literal?** Se mide sobre el proyecto de
   trabajo, no sobre un fixture: los fixtures tienen nombres cortos.
2. **¿La celda de la derecha está ocupada?** Si está vacía, Excel derrama el
   texto sobre ella y se lee entero: **eso no es un defecto**. Sólo corta cuando
   la vecina tiene algo.

La segunda pregunta es la que separa el ruido del hallazgo. En la hoja de
asignación, la nota del sorteo (111 caracteres en una columna de 42) y el rótulo
del bloque se derraman y están bien; la lista de aulas del día, con «ESTADO DE
APLICACIÓN» ocupada al lado, se cortaba.

Y para verlo con los ojos, sin publicar nada:

```bash
soffice --headless --convert-to pdf libro.xlsx --outdir .
pdftoppm -r 300 -png -f 1 -l 1 libro.pdf pagina
magick pagina-1.png -crop 2400x520+150+1560 +repage -resize 1400x zoom.png
```

`timeout` no existe en el macOS de este equipo; se llama a `soffice` directo.

## Los cinco

| Dónde | El literal | Lo que se perdía |
|---|---|---|
| Notas de «Avance de agendación» | sin fusionar | se apilaban en seis renglones y empujaban la tabla |
| «Avance de campo», columna 2 | 16 | `Álvarez Espinoza Sald‖`, de 40 caracteres |
| Disponibilidad, columnas de día | 17 | `11:00 a 14:00 · 15:00‖`, el segundo tramo |
| Asignación, «Cursos-horario del día» | 56 | la última aula de la jornada, en 6 filas de 61 |
| Hojas de datos, columna 1 | 11 | la cabecera `FECHA AGENDADA` del «Plan del día» |

Dos más se midieron y estaban bien: `ID MATCH` (8 en 11) y la hoja «Listas»
(23 en 22, pero **está oculta** y sólo alimenta los desplegables).

## Por qué no hay un detector

Se intentó. Un test que recorra el libro y marque toda celda cuyo texto exceda
su columna con la vecina ocupada reporta **~3 300 celdas** sobre el libro real, y
casi todas son correctas:

- los topes de 42 que `.calf_anchos()` pone a propósito, «para que ninguna
  columna se coma la pantalla»;
- las cabeceras con `wrapText`, que no se cortan: bajan de línea.

Un guard que grita tres mil veces no guarda nada, porque se aprende a ignorarlo.
Lo que sí funcionó las cinco veces fue lo concreto: **una columna, un contenido
que alguien necesita entero, medir y ensanchar**, con suelo en el ancho de
antes para que un día flojo no la estreche, y techo para que un caso raro no
empuje la hoja.

## Dónde quedó cada arreglo

`236e68b0` · `54bcb3bb` · `fc68bfdc` · `00bdfa23` · `bf01ad5b`.
