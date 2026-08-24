# Traslape entre el estudio IAGen (DAA) y HSVG 2026

Doc vivo. Abierto el 2026-08-21 a partir del insumo
`Cursos_horario_Estudio IAGen_DAA_2026_info a OIGD.docx` (DAA / Oficina de
Gestión Curricular y Evaluación, semestre 2026-2), que lista los cursos-horario
donde se aplicará un estudio sobre Inteligencia Artificial Generativa.

**La pregunta que responde**: HSVG 2026 va a entrar a aulas este semestre; IAGen
también. ¿Cuánto se pisan, dónde duele y qué decisión hay que tomar?

## 1 · Qué se cruzó, y contra qué

| Lado | Fuente | Grano |
|---|---|---|
| IAGen | el .docx de la DAA | 164 filas → **160 cursos-horario únicos** |
| Marco DTI | `BBDD2026/207915-Cursos-Horarios 2026-2.xlsx` (info al 18/08/2026) | 5 269 CH, docente/aula/sesiones |
| Población | `BBDD2026/207915-Alumnos matriculados 2026-2.xlsx` | 137 919 matrículas |
| HSVG | `libro_aulas_plan1b.xlsx` (sorteo del plan 1b, 2026-08-20) | 190 titulares · 1 665 reservas · 761 extras |

Llave del cruce: `clave_horario` en minúsculas — el mismo `operational_code` que
usa el motor. El insumo no trae docente, aula ni matriculados: todo eso se
levantó del reporte DTI.

**Anclas de validación del cálculo** (para que este doc no invente una segunda
aritmética): con el modelo sellado del plan 1b —`efectivas_esperadas =
elegibles × R(tramo) × F(facultad)`, bins 0,809 / 0,642 / 0,566 / 0,500 / 0,409
y residuales C&I 0,972 · EGC 0,917 · EGL 0,985 · CCSS 0,960 · DER 1,115 ·
A&D 0,910— la suma sobre los 190 titulares da **3 423** efectivas esperadas y
deja a **Derecho en 0,97×**. Ambas cifras reproducen exactamente las del plan.
El cálculo del traslape corre sobre esa misma base.

**Profundidad alcanzable** (criterio de Gonzalo, 2026-08-21): en campo se llega
razonablemente hasta el **reemplazo 5**. De R6 en adelante la cadena existe en
el papel pero es poco probable que se recorra, así que el traslape ahí se
registra y no se pondera.

## 2 · El mapa del traslape, en seis grados

| Grado | Qué es | Cuánto | Sobre qué base |
|---|---|---|---|
| **A · Aula titular** | HSVG va a entrar sí o sí | **12** | 6,3 % de 190 |
| **B · Reserva alcanzable (R1–R5)** | respaldo que sí se usaría | **45** en 44 cadenas | 5,2 % de 871 |
| **C · Reserva profunda (R6+)** | existe, casi no se recorre | 34 | registrado, no ponderado |
| **D · Banco de extras** | cierra cuota de sexo por facultad | **43** | 5,7 % de 761 |
| **E · Docente** | mismo profesor, dos estudios | **20** con aula titular | 12 misma aula · 8 aula distinta |
| **F · Alumno** | misma persona, dos encuestas | **1 366** | **20,5 %** de los 6 666 que HSVG piensa encuestar |

El grado F es el que ningún cruce por código de aula ve: de esos 1 366 alumnos,
**941 llegan por aulas distintas** — están en un aula de IAGen y en otra,
diferente, de HSVG. El traslape real entre estudios es de personas, no de
códigos, y es cuatro veces mayor que el de aulas.

## 3 · El traslape por titular

Los 12 titulares que IAGen también va a visitar, y lo que cada uno aporta al
esperado del estudio:

| Titular | Facultad | Curso | Elegibles | Efectivas esperadas |
|---|---|---|--:|--:|
| `int124_0305` | EGL | Investigación Académica | 58 | 23,4 |
| `urb209_0601` | ARQ | Taller de Urbanismo 1 | 53 | 21,7 |
| `1rei15_1051` | CCSS | Integración Regional | 43 | 20,6 |
| `1arc06_0802` | ARQ | Historia y Teoría de la Arquitectura 4 | 40 | 20,0 |
| `arc227_0701` | ARQ | Taller 7 | 36 | 18,0 |
| `1inf54_0982` | C&I | Proyecto de Diseño y Desarrollo de Software | 32 | 17,6 |
| `fil191_0802` | AE | Estética | 29 | 16,4 |
| `psb229_7146` | PSI | Motivación y Emoción | 25 | 16,1 |
| `cco234_0402` | CyA | Semiótica para Comunicaciones | 25 | 16,1 |
| `eco293_0623` | CCSS | Macroeconomía 2 | 25 | 15,4 |
| `1ing02_0230` | EGC | Dibujo en Ingeniería | 20 | 11,8 |
| `fis220_0861` | C&I | Técnicas Computacionales en Física | 16 | 10,0 |
| | | | | **207** |

**207 efectivas esperadas expuestas = 6,0 % del esperado del estudio.**
«Expuestas» es la palabra exacta: no son una pérdida, son lo que está sobre la
mesa si el traslape degrada esas aulas. Cuánto degrada es justo lo que no se
sabe todavía (§6).

Once de los doce conservan respaldo completo en la ventana alcanzable. La
excepción es `1rei15_1051` (CCSS): titular tocado, R2 también tomada, y solo le
queda **una** reserva limpia.

## 4 · El traslape en los reemplazos

Contado sobre la cadena entera son 79 reservas; contado sobre la ventana que de
verdad se recorre, **45 en R1–R5 (5,2 %)**, repartidas en 44 cadenas distintas
—43 cadenas con una sola reserva tomada y una con dos—. No hay ninguna cadena
donde IAGen se lleve un bloque.

Dónde cae el primer eslabón tomado:

| Posición | R1 | R2 | R3 | R4 | R5 | R6+ |
|---|--:|--:|--:|--:|--:|--:|
| Cadenas | 12 | 12 | 9 | 5 | 6 | 22 |

Doce cadenas tienen su **primera** reserva tomada. Es el caso incómodo —si el
titular cae, el primer respaldo al que se llama ya está tocado— pero once de
esas doce conservan R2 libre, así que el costo es de orden, no de disponibilidad.

**Reservas limpias en R1–R5, por cadena**: 124 cadenas con las 5 · 42 con 4 ·
4 con 3 · 7 con 2 · 12 con 1 · **1 con ninguna**.

Ese último caso es el único daño estructural en reemplazos: **`1gtm09_0411`
(Gastronomía)** tiene una sola reserva en toda su cadena y esa reserva está en
IAGen. Si el titular cae, se queda sin respaldo no tocado. Las otras doce
cadenas de una sola reserva ya nacían cortas: es angostura del marco, no efecto
de IAGen.

## 5 · Cómo nos afecta, por facultad

`Expuesto` = efectivas esperadas de los titulares tocados. `Margen` = Σ
esperadas ÷ cuota; `sin expuesto` es el mismo margen si esas aulas rindieran
cero, que es el peor caso imaginable y no el escenario probable.

| Facultad | Tit. | Toc. | Esperadas | Expuesto | % | Margen | sin expuesto | R1–R5 tocadas |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| C&I | 40 | 2 | 742 | 28 | 4 % | 1,41× | 1,35× | 3 |
| EGC | 30 | 1 | 599 | 12 | 2 % | 1,49× | 1,46× | 7 |
| EGL | 26 | 1 | 554 | 23 | 4 % | 1,39× | 1,34× | 7 |
| **Derecho** | 16 | **0** | 353 | 0 | 0 % | **0,97×** | 0,97× | 5 |
| **ARQ** | 11 | **3** | 199 | **60** | **30 %** | — | — | 2 |
| **CCSS** | 12 | **2** | 195 | **36** | **18 %** | 1,31× | **1,07×** | 6 |
| A&D | 14 | 0 | 171 | 0 | 0 % | 1,43× | 1,43× | 1 |
| GES | 7 | 0 | 122 | 0 | 0 % | — | — | 1 |
| AE | 9 | 1 | 121 | 16 | 14 % | — | — | 2 |
| CyA | 8 | 1 | 112 | 16 | 14 % | — | — | 3 |
| PSI | 6 | 1 | 91 | 16 | 18 % | — | — | 4 |
| GAS | 3 | 0 | 48 | 0 | 0 % | — | — | 1 |
| EDU | 3 | 0 | 46 | 0 | 0 % | — | — | 1 |
| LyCH | 3 | 0 | 45 | 0 | 0 % | — | — | 1 |
| CONT | 2 | 0 | 26 | 0 | 0 % | — | — | 1 |

Tres lecturas:

- **Derecho se salva.** La facultad que ya venía en 0,97× —la decisión abierta
  del plan 1b— no tiene ningún titular tocado. El traslape no agrava el único
  problema de cobertura que el estudio ya tenía.
- **Arquitectura es la más expuesta**: 3 de sus 11 titulares y el 30 % de su
  esperado. Es también una facultad chica, donde una sola aula pesa mucho.
- **Ciencias Sociales es la que puede cambiar de veredicto**: su margen 1,31×
  cae a 1,07× si sus dos aulas tocadas no rindieran nada. Sigue cubriendo, pero
  se acerca al filo. Y es la facultad con más reservas alcanzables tocadas (6).

## 6 · Lo que este cruce todavía no puede decir

**Actualización 2026-08-21 (tarde)**: el correo de la DAA cierra la incógnita 1
y cambia el escenario. Ver §11.

El insumo de la DAA da qué aulas, no **cuándo** ni **cómo**. Sin esos dos datos
el traslape no se puede convertir en un número de daño:

1. ~~**Orden temporal.**~~ **RESUELTO**: la DAA aplica del **31 de agosto al 11
   de setiembre**, antes que HSVG. El efecto de fatiga nos toca entero.
2. **Modalidad.** Si IAGen se responde en clase, compite por el mismo tiempo de
   aula que HSVG y por la misma autorización del docente. Si va por correo o
   Ágora, compite mucho menos. Sigue sin saberse.
3. **Magnitud del efecto.** No hay medición propia de cuánto baja la tasa de
   respuesta de un aula ya encuestada ese semestre. El histórico 2025 no tiene
   ese caso.

Mientras (1) y (2) no se sepan, la tabla de §5 se lee como exposición, nunca
como pérdida esperada.

## 7 · Lo que sí está decidido y choca

HSVG ya tiene una regla dura de **docente único** entre titulares —«un mismo
docente, por más que sean dos cursos horarios diferentes, no sea seleccionado de
forma repetida (…) no molestar al docente»— implementada como reparación
post-sorteo en `calc_muestra_aulas_docente_unico.R`.

Los **20 docentes** del grado E la rompen desde fuera: 12 recibirían dos
solicitudes por la misma aula y 8 por dos aulas distintas. El motor no puede
verlo porque la regla mira dentro del sorteo, no fuera del estudio. Sea cual sea
la decisión sobre las aulas, el contacto a esos 20 docentes debería salir
coordinado —una sola conversación, dos estudios— o se gasta dos veces la misma
buena voluntad.

## 8 · Decisiones abiertas

| # | Decisión | Estado |
|---|---|---|
| T1 | Pedir a la DAA cronograma y modalidad de IAGen | **bloqueante** de todo lo demás |
| T2 | ¿Los 12 titulares se re-sortean, o se conservan? | abierta |
| T3 | `1gtm09_0411`: darle una reserva limpia adicional | abierta, barata |
| T4 | Contacto coordinado con los 20 docentes compartidos | abierta |
| T5 | ¿Sellar el marco IAGen como exclusión en el motor? | abierta — ver §9 |

## 9 · Si se decide excluir

Excluir IAGen del marco de HSVG es implementable como criterio de aula, en la
misma familia que `calc_muestra_aulas_facultades_excluidas.R`: una lista de
`operational_code` vetados que recorta el marco antes del sorteo, declarada en
la config como datos (nunca embebida) y visible en el embudo con su propia
etiqueta, para que el recorte diga qué quitó y no solo cuánto.

Costo del recorte: 160 CH de 5 269 (3,0 % del marco). Ninguna facultad se queda
sin alternativas: la más ajustada sería Gastronomía, y aun así conserva marco.

**Advertencia sobre el alcance real de esta salida**: excluir aulas resuelve los
grados A–D, deja intacto el grado E (docentes) sólo si además se veta por
docente, y **no toca el grado F en absoluto**. Los 941 alumnos que coinciden por
aulas distintas seguirían recibiendo las dos encuestas. Ninguna regla sobre
aulas puede evitar eso: es la consecuencia de dos estudios muestreando la misma
población el mismo semestre.

## 10 · Qué abrió este cruce

El traslape resultó ser un **criterio de dimensionamiento** que el estudio no
tenía, y preguntarse cuáles más faltan abrió su propio doc:
`criterios-dimensionamiento-aulas-2026-08-21.md` — profundidad de cadena, banco
de extras, operación de campo, precisión por dominio y el margen del deff.

---

**Evidencia**: el inventario completo, aula por aula, con docente, correo,
sesiones, aula física, composición por facultad y marca de traslape está en
`HSTVG2026/Inventario_cursos_horario_IAGen_2026-2.xlsx` (hojas «Inventario CH»,
«Resumen por facultad», «Cruce con HSVG 2026», «Incidencias»).


## 11 · El escenario cambió: la decisión de la DAA (2026-08-21)

Oscar Pain (Director de Asuntos Académicos) comunicó una **decisión tomada**,
no una consulta, con el Vicerrector ya al tanto:

- La DAA **procede según lo planificado** (cartas ya enviadas a decanos; campo
  del 31 de agosto al 11 de setiembre).
- PULSO debe **retirar de su marco los cursos-horario de la DAA** y sortear
  después. PULSO entrega su muestra el **miércoles 26 de agosto**.

Verificación de las cifras del correo (2026-08-21):

| Cifra del correo | Medido | Veredicto |
|---|---|---|
| «136 cursos-horario ya seleccionados por la DAA» | la lista trae 160 CH únicos; **134** caen dentro del marco seleccionable de PULSO | correcta en la práctica (±2) |
| «marco muestral de 4 995 cursos-horario» | el reporte DTI trae 5 269; tras los criterios del estudio el **marco seleccionable es 2 616** | **no es nuestro marco**; el retiro es el **5,1 %**, no el 2,7 % |
| «no afectará la representatividad» | ninguna facultad baja de **5,5 aulas por cupo** (la peor, Contables: 11 para 2) | **se sostiene** |

**Consecuencia sobre este doc**: si el retiro se ejecuta y hay re-sorteo, los
grados A–D (12 titulares, 45 reservas alcanzables, 43 extras) **desaparecen por
construcción**. Sobreviven:

- **Grado E parcial**: los 8 docentes que tienen un aula en IAGen y *otra*
  distinta en HSVG. Retirar aulas no los protege.
- **Grado F entero**: los 1 366 alumnos compartidos, 941 de ellos por aulas
  distintas. Ninguna exclusión de aulas lo toca, y como la DAA aplica primero,
  la fatiga la absorbe HSVG.

El grado F es, por tanto, **el único argumento que sobrevive al retiro** — y el
que conviene poner por escrito ante la DAA y el Vicerrectorado.
