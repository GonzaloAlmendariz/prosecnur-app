# ADR 0089 — El vínculo alumno↔aula se persiste en estudios confidenciales

- **Estado**: Aceptado
- **Implementación**: Pendiente
- **Ámbito**: Marco de cursos-horario · `project_pulso.R` (bloque F114) ·
  `calc_muestra_aulas*.R` · `pulso_anonimizar_proyecto.R`
- **Fecha**: 2026-09-22 · **Ratificado**: 2026-09-22 (Gonzalo: «ADR, y guárdalo
  para este tipo de estudios confidenciales, no los anónimos»)
- **Relación**: extiende el [ADR 0087](0087-el-padron-del-eje-se-persiste-y-revierte-el-f114.md)
  —misma reversión deliberada del F114, un escalón más allá— y hereda su régimen
  de purga; obedece el [ADR 0005](0005-secretos-fuera-del-proyecto.md) igual que
  aquél: el marco no es un secreto de integración, pero no sale del equipo.

## Contexto

El F114 de [project_pulso.R:556-616](../../api/R/project_pulso.R) subroga los
ids de alumno a enteros densos al guardar y **descarta el mapa**. Fue una
decisión buena y sigue siéndolo para lo que la motivó: el descuento de traslape
necesita la *estructura* —qué aulas comparten alumnos y cuántos—, no la
identidad, y un `.pulso` que viaja no tiene por qué nombrar a nadie.

Lo que el 22/09/2026 quedó claro es **dónde corta ese filo**. Gonzalo pidió la
lista de elegibles por carrera con código PUCP para que quienes monitorean
pudieran cruzar alumnos. La estructura estaba intacta: las 136 aulas del plan de
CCSS Perfil 2026-II traen sus `unique_student_ids` subrogados, y su conteo
coincide con `eligible_n` aula por aula. Con ellos se responde «estas dos aulas
comparten 7 alumnos» y se midió, sin tocar ningún archivo externo, que **359 de
662 personas alcanzables por aulas titulares lo son en dos o más** —el 54 %— y
que las 50 titulares suman 1.212 asientos elegibles que son 662 personas.

Lo que no se responde con subrogados es **quién**. Para eso hubo que rehacer el
cruce desde fuera, y el costo real no fue el `join`:

- La base madre del motor no era ninguno de los archivos obvios. Son las hojas
  `Data` **y** `Excluidos` del mismo xlsx del marco, que sólo juntas dan las
  127.791 filas, 4.596 curso-horario y 25.403 alumnos que el frame declara. El
  xlsx crudo de la DTI no sirve: le falta `CONDICION_MATRICULA`.
- La definición de elegible hubo que deducirla de `config$criterios_seleccion` y
  validarla contra `eligible_n`, incluyendo que un `CONDICION_MATRICULA` en
  blanco **cuenta**. Equivocarse ahí es barato y silencioso: filtrar por
  `CONDICION` —que es la beca, no la matrícula— borra 651 filas de becarios sin
  un solo error.

Es decir: la identidad no está, y **reconstruirla exige arqueología que nadie
garantiza que salga igual la próxima vez**. Esa reconstrucción salió bien esta
vez porque se pudo contrastar contra los subrogados; si el `.pulso` no los
trajera, no habría con qué comprobarla.

## Decisión

En estudios declarados **confidenciales** —los que ya persisten padrón por el
ADR 0087— `unique_student_ids` se guarda con los **códigos reales**, y
`student_ids_policy` pasa a `identificadores_reales`. El mapa deja de
descartarse porque deja de haber mapa: el id es el código.

En todo lo demás —proyectos de referencia, demos, cualquier `.pulso` sin padrón
persistido— **no cambia nada**: sigue el F114 tal cual, subrogados sin mapa.

La purga no se inventa: es la misma del ADR 0087. Toda copia que sale del equipo
—`pulso_anonimizar_proyecto.R` y la purga al exportar— vuelve a subrogar estos
ids igual que hoy, de modo que un `.pulso` anonimizado es indistinguible del que
produce el F114.

## Consecuencias

- La lista nominal de elegibles por aula pasa a ser una consulta al proyecto, no
  una reconstrucción. Desaparece la clase de error que este ADR documenta.
- El `.pulso` de un estudio confidencial contiene códigos de alumno además del
  padrón. Ya los contenía por el ADR 0087; el incremento real es el **vínculo**
  con el aula, que es precisamente lo que lo hace útil y lo que obliga a que la
  purga al exportar sea la misma y se verifique igual.
- `student_ids_policy` deja de ser informativa y pasa a ser un contrato: quien
  lea `unique_student_ids` debe mirarla antes de interpretar el contenido como
  código real. El gate es un test que falle si una copia exportada sale con
  `identificadores_reales`.
- No cambia ningún cálculo. El descuento de traslape sigue leyendo estructura y
  le da igual el alfabeto de los ids.

## Alternativas descartadas

- **Guardar el mapa aparte, fuera del `.pulso`.** Reintroduce el problema que el
  ADR 0005 resuelve para secretos —un archivo que hay que mover junto al
  proyecto y que se pierde— sin ganar nada: el padrón ya vive dentro.
- **Hash con sal en vez del código.** Sobre un espacio de códigos de 8 dígitos
  se invierte en segundos; da la apariencia de protección, no la protección. Ya
  estaba descartado en el F114 y se mantiene.
- **Dejarlo como está y documentar la reconstrucción.** Es lo que hubo que hacer
  el 22/09 y el motivo de este ADR: la receta depende de archivos externos que
  no versiona nadie y de una definición que hay que deducir cada vez.
