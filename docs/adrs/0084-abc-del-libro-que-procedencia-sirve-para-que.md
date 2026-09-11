# ADR 0084 — El ABC del libro: qué procedencia sirve para qué caso

- **Estado**: aceptado
- **Fecha**: 2026-09-10
- **Ámbito**: monitoreo de cursos-horario (perfil aulas), motor y pantalla
- **Sustituye a**: nada. Complementa el ADR 0022 (modos de monitoreo).

## Contexto

El libro operativo de HSVG2026 tiene tres verbos para lo que le pasa a un
curso-horario cuando entra otro detrás, y los tres se escriben en la misma
columna al aplicar:

- **A — REEMPLAZADA POR.** El titular no salió y otra ocupa su sitio.
- **B — COMPLEMENTADA CON.** El titular sí salió y se queda; entra otra además,
  y las dos cuentan.
- **C — APLICADA DE REFUERZO.** No hay titular caído: entra por cuota, porque
  la facultad no va a cerrar.

Durante meses el perfil los trató como un solo concepto, «reemplazo», y de ahí
salieron tres averías que costaron sesiones enteras:

1. **Los tres caían en `pendiente`.** `monitoreo_aulas_estado_aplicacion()`
   agrupaba sobre el verbo grueso, así que un curso-horario aplicado de refuerzo
   se contaba como si nadie lo hubiera tocado.
2. **El hecho ocurre antes que el verbo.** El verbo se teclea al aplicar. Medido
   el 2026-09-10 sobre HSVG26ULT2: **4 tipo A en curso, 0 declarados** —dos de
   ellos en Derecho—. Contar sólo lo declarado daba cero sobre un operativo que
   ya llevaba días con reemplazos en marcha.
3. **B y C no tenían puerta.** La pantalla sabía abrir el complemento desde una
   fila de la tabla de brechas y no tenía ninguna forma de llegar al refuerzo,
   que es la mitad de la decisión.

## Decisión

### 1. La procedencia y el caso son dos ejes, y no todos se cruzan

El catálogo de un curso-horario que puede entrar tiene **tres procedencias**, y
ninguna de ellas es «el banco» —ese concepto no existe en este operativo: es un
conjunto de aulas extra disponibles que no quedaron dentro de la cadena—:

| De dónde sale | A reemplaza | B complementa | C refuerza |
|---|:--:|:--:|:--:|
| **Su propia cadena** — el orden que fijó el sorteo, todavía comprometido | sí | sí | **no** |
| **Al aire** — su cadena ya se resolvió y dejó de estar comprometida | sí | sí | sí |
| **Reserva adicional** — nunca entró en ninguna cadena | sí | sí | sí |

**El único «no» es el que importa.** Una reserva de una cadena viva está libre
hoy y aun así no se puede gastar en un refuerzo: es la red de un titular que
todavía no ha salido, y gastarla lo deja sin relevo. La consecuencia llega días
después y en otra facultad, que es por lo que nadie la ve al decidir.

Una cadena se considera **resuelta** cuando *cualquiera* de sus eslabones ya
salió: basta uno, porque el slot queda cubierto y los demás dejan de estar
comprometidos. `ESTADOS_QUE_LIBERAN = {aplicada, cerrada, parcial}`.

### 2. La facultad es frontera dura en los tres casos

De ahí no se sale nunca, ni cuando la de al lado va sobrada. La cadena, en
cambio, es **guía y no candado**: se sigue salvo que no sirva.

### 3. Cada caso se decide desde una superficie distinta, porque la pregunta es distinta

- **B (complemento)** arranca **de un curso-horario**: uno que ya se aplicó y se
  quedó corto. El candidato se elige por **parecido** al que se quedó corto
  —mismo grupo, mismo nivel—, porque lo que se protege es el diseño de esa
  celda. Puerta: la fila de la tabla de brechas (`AulasBrechasDelCorte` →
  `AulasPopoverReemplazo`).
- **C (refuerzo)** arranca **de una facultad**: no hay titular caído ni celda
  que arreglar, hay una cuota que no va a cerrar. Aquí no hay nada a lo que
  parecerse: lo único que importa es **cuánto de lo que la facultad debe cierra
  el que se mete, por sexo**. Puerta: la fila de facultad del mapa de la deuda
  (`AulasComoVaCadaFacultad` → `AulasPopoverRefuerzo`).

Un curso-horario que aporta 21 respuestas casi todas de hombres cierra 1 de las
12 mujeres que se deben. Ordenar por lo que rinde lo pondría primero y es justo
el que no sirve: **`util` corta cada sexo contra lo que se debe de ESE sexo**.

### 4. El hecho manda sobre el verbo, en todas partes

Todo recuento del ABC se cuenta **por dos caminos**: lo `declarado` (el verbo
escrito en el libro) y lo `en_curso` (el hecho, deducido del estado y de las
respuestas). Publicar sólo lo declarado dio 0 sobre 4 casos reales.

Y lo mismo para «este curso-horario ya salió»: se mide **por sus respuestas
válidas primero, y por su estado después**. El estado lo teclea alguien al
registrar el campo y llega tarde; medido el 2026-09-10, las 1.218 reservas del
plan estaban en `planificada` mientras el KPI «Cerraron con reemplazo» ya decía
1, porque ese KPI cuenta por respuestas.

### 5. Rindió y aportó son dos preguntas, no una cifra

- **Qué tal rindió**: su tasa contra la prevista **de su facultad**. Juzga el
  trabajo de campo en ese salón. Un salón de 60 y uno de 18 no llevan el mismo
  listón.
- **Cuánto aportó**: si esas respuestas engordan la meta o sólo tapan un hueco
  con el que el plan ya contaba. Juzga la decisión de meterlo.

B y C **no estaban previstos**, así que todo lo que traen es ingreso neto: en
palabras de Gonzalo, «los alumnos tanto hombres como mujeres que habíamos
recolectado allí son alumnos netos o puros, ingresos completos». A **repone**:
el plan ya contaba con esas respuestas, sólo que de otro curso-horario.

No se ordenan igual, y ésa es la razón de que las dos varas existan: **un
complemento con tasa mediocre aporta más que un reemplazo impecable.**

El criterio operativo para separarlos no es el verbo: es **si su titular
salió**. Si también salió, no cayó nadie y lo que trae la reserva es neto. Si no
salió, está ocupando su sitio. La reserva adicional nunca tuvo titular al que
reponer, así que es neta siempre.

### 6. Lo que no se sabe no se publica como cero

Dos casos, los dos con test:

- **Sin columna de sexo, el reparto por aula no se publica.** No saberlo y saber
  que no hubo mujeres son cosas distintas, y un cero se leería como lo segundo.
- **El reparto puede no sumar el total, y es correcto.** Una respuesta con un
  sexo que el estudio no clasifica cuenta como válida y no cae en ningún sexo;
  repartirla sería inventar. La diferencia es visible y la vista la nombra.

En el agregado, el total por sexo sólo se declara si **todas** las aulas que
aportan traen su reparto: con la mitad sin sexo, «trajo 40 mujeres» sería una
cifra sobre parte de las aulas presentada como si fuera sobre todas.

## Consecuencias

- Esta tabla es **doctrina del operativo, no un panel**. Vivió un rato en
  Consultas › Brechas y se retiró: no es un dato de campo que cambie con el
  corte, es la regla con la que se lee todo lo demás. La pantalla enseña
  inventario y decisiones; el porqué vive aquí.
- `monitoreo_aulas_desenlaces.R` es el único sitio donde se reparte por tipo, y
  `refuerzosDeFacultad.ts` el único donde se arma el inventario de una facultad.
- El plan publica `validas_mujeres` y `validas_hombres` por curso-horario
  (`.monitoreo_aulas_validas_por_sexo`), que es lo que permite decir qué trajo
  un aula que no estaba prevista sin estimarlo multiplicando elegibles por una
  tasa.

## Alternativas descartadas

- **Un solo popover para los tres casos.** Pide un caído para medir el parecido,
  y en C no lo hay. Comparten catálogo y nada más.
- **Contar sólo el verbo declarado.** Daba 0 sobre 4 casos reales en curso.
- **Ordenar los candidatos de refuerzo por lo que rinden.** Pone primero al que
  no cierra la cuota.
- **Dejar que un refuerzo tome una reserva de cadena viva.** Es lo que más se
  olvida y lo que más caro sale: el titular se queda sin relevo.
