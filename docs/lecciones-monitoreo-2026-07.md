# Lecciones de Acreditación, para el resto de Monitoreo

Cierre del 2026-07-29. Acreditación se usó como banco de pruebas de un rediseño
que empezó en Fuentes y acabó tocando vocabulario, jerarquía, dominio,
rendimiento y gráficos. Este documento **no** es la lista de arreglos —eso está
en `docs/plan-fuentes-legibles-2026-07.md` y en los mensajes de commit—: es lo
que se aprendió y lo que hay que ir a revisar en Territorial, Telefónico y
Aulas antes de repetir el mismo trabajo cuatro veces.

Regla de lectura: cada sección abre con el patrón, sigue con la evidencia medida
y cierra con **qué evaluar** en los demás modos.

---

## 1. El rótulo nombra la pregunta, no la tecnología

Fuentes estaba organizada por el servicio que trae el dato —Kobo, SurveyMonkey,
Sheets— y quien monitorea no piensa así: piensa en qué universo tiene, qué
respuestas llegaron y qué falta. Esa era la causa raíz de que la sección fuera
ilegible; la densidad era el síntoma.

Tres reparaciones del mismo tipo:

| Antes | Después |
|---|---|
| pestañas por servicio | pestañas por pregunta (universo · encuestas · …) |
| «7 fuentes SurveyMonkey/Kobo» | «7 encuestas conectadas» (proveedor al `title`) |
| «Snapshot · registros crudos» | «Recibidas · llegaron de las fuentes» |

`snapshot` describe cómo la app guarda lo sincronizado; no es un concepto de
investigación por encuestas y no debe aparecer en pantalla.

**A evaluar:** barrer los cuatro modos buscando rótulos que nombren proveedor,
formato o estructura interna (`snapshot`, `payload`, `raw`, `asset`, nombres de
servicio). Cada uno es un defecto de legibilidad, no un detalle de copy.

---

## 2. No se explica lo que la vista ya dice

Textos como «Cada barra es lo que se registró ese día, no el estado de toda la
base» bajo un título que dice *Estados registrados por día*, o «Pasa el cursor
por un día para ver su reparto» sobre un gráfico que responde al cursor, **se
ven mal** y son señal de AI slop. Ocupan la línea donde debería ir el dato.

Lo que sustituye a esas frases es el dato: al apuntar un día, la leyenda deja de
contar el periodo y cuenta ese día, en el mismo sitio y con la misma forma.

**A evaluar:** todo subtítulo que parafrasee su título y toda frase que describa
una afordancia. Si hace falta aclarar qué mide una superficie, que lo diga el
título. El matiz de dominio que no cabe va al comentario del código o al plan,
nunca a la pantalla. Norma registrada para toda la app.

---

## 3. Un dato, un lugar — y el lugar lo decide la pregunta de la sección

Dos hallazgos del mismo patrón:

- Una tira de estados telefónicos repetía los mismos cinco estados que la
  sección de abajo ya mostraba con barra proporcional, y los recortaba a «Sin
  conta…». Se retiró (y con ella su componente y 16 reglas de CSS muertas).
- El embudo de efectividad se leía desde cualquier sección. En Fuentes —donde
  todavía se están conectando las bases— es **el resultado puesto antes del
  trabajo**. Pasó a vivir solo en Avance, que es donde se pregunta cuánto se
  lleva.

La lección no es «no repetir»: es que un indicador que se lee en todas las
secciones no informa en ninguna. Cada sección responde una pregunta y muestra lo
que esa pregunta necesita.

**A evaluar:** en Territorial y Telefónico, qué indicadores viajan en el chrome o
en la franja de contexto de todas las secciones y si pertenecen a una sola.

---

## 4. Guiar es priorizar, no enumerar pasos

En Subsanación y Cruces el defecto no era falta de guía: **sobraba**. Había dos
rutas de tres pasos compitiendo en la misma pantalla, ninguna clicable, y las
276 filas mostraban la misma frase —la regla que las agrupa, no lo que le pasa a
cada una—, así que no había forma de elegir cuál trabajar.

Lo que ordenó la bandeja vino del dominio, no de la UI: **no todo lo que no
cruza pesa igual**. Un caso completo que no cruza es recuperable —hay una
encuesta real esperando a que se le devuelva su identidad— y va primero; un
rechazo o una parcial temprana, no. Y el canal decide cuándo la ausencia de
llave es siquiera un defecto.

**A evaluar:** en cada bandeja de trabajo de los otros modos, si el orden lo pone
una regla de dominio explicable o el orden de llegada. Y si cada fila dice su
motivo concreto o repite la regla del grupo.

---

## 5. Lo que cambia entre estudios se declara; no se fija en código

Dos mecanismos nuevos, mismo principio:

- **Variables de interés por actor** (varias por actor si hace falta). El
  catálogo de columnas viaja con su distribución y su normalización sugerida, y
  se ordena por cobertura descendente: elegir una variable es elegir con cuánto
  dato cuentas.
- **Definidor de estados del barrido**: los estados los escribe el cliente y
  cambian entre estudios («Número Incorrrecto», con su typo, es un estado real).
  Lo que el usuario confirma manda sobre la heurística, también en cortes
  futuros, y el color sale de ahí —ningún estado se pinta con un literal en una
  vista—.

Dos trampas medidas al construirlos: la normalización de ciclo exige **mayoría**
de coincidencias y no unanimidad (un «2019-II» mal tipeado entre cien no puede
desactivar la agrupación de la columna), y en R los campos que no estén en la
whitelist del modelo operativo **se descartan en silencio** al guardar.

**A evaluar:** qué está hardcodeado en Territorial y Aulas que en realidad
depende del estudio (etiquetas de estado, variables de corte, criterios de
efectividad).

---

## 6. Un número incoherente no se pinta

Teléfono llegó a mostrar `1.277 → 0 procesables → 534 efectivas` con «−1.277
fuera del universo», acusando de descarte a todo el corte, mientras Modelo leía
`519 → 418` del mismo dato. El oficial es un subconjunto del procesable por
definición, así que esa combinación no es un conteo: es un hueco —típicamente
una columna que faltaba y se leyó como 0—.

Ahora se declara **indeterminado** en vez de dibujarse. Preferir «sin
determinar» a un cero que parece dato.

**A evaluar:** los embudos y KPIs de los otros modos, buscando ceros que
convivan con totales mayores aguas abajo. El guard vive en `corteContract.ts` y
es compartido.

---

## 7. Rendimiento: cachear por scope, e invalidar por cálculo

El snapshot guardaba **un** dashboard y la interfaz pedía cuatro scopes al
abrir, así que tres se reconstruían enteros en cada apertura y en cada guardado.
Medido en acrconta: **294 s → 36 s** de warm start, con el `.pulso` de 368K a
259K.

Tres decisiones que conviene copiar:

1. Se hashea la configuración **completa**, no una lista de campos elegidos:
   enumerar es más rápido, pero olvidar un campo sirve números viejos que
   parecen frescos.
2. El lookup **revalida** los tres componentes en vez de confiar en la clave: un
   digest puede colisionar y servir el corte de otro estudio sería invisible.
3. La versión del esquema es parte de la clave y hay que subirla cuando cambia
   la forma de **calcular**, no solo de guardar. Pasó justo eso: la vista siguió
   mostrando «0 variables» con el motor ya arreglado, y hubo que bumpear **dos**
   claves.

**A evaluar:** Territorial ya tenía su cache por entradas; Aulas y el dashboard
general no se revisaron. Y medir la apertura **fría real**, no el delta-0.

---

## 8. Gráficos: el contrato de lectura antes que el adorno

Todo esto salió de mirar la app, no el CSS:

- **Ningún estado presente desaparece.** Con el día grande llevándose 118 de los
  148 px de la columna, 6 de 32 segmentos caían por debajo de 3 px: un día con
  un rechazo se veía igual que un día sin ninguno. Piso de 4 px; la cifra exacta
  sigue en el detalle.
- **El hover nativo no es hover.** El `title` del navegador tarda cerca de un
  segundo, no sigue al puntero y se pinta como tooltip del sistema; sobre
  franjas de 4 px es inservible. El foco lo toma el día entero y el reparto se
  lee en un sitio fijo.
- **Misma familia visual.** El apilado iba redondeado debajo de un Plotly que
  dibuja a escuadra; son el mismo periodo leído de dos maneras y tienen que
  verse de la misma casa.
- **Cada barra lleva su cifra**, y las de reporte en negrita: son las que viajan
  al informe. Cuáles son lo decide el cronograma, no el gráfico.
- **Los ejes no se desplazan.** Con el campo largo hay que poder recorrer el
  tiempo, pero un eje que se va de la vista deja de ser referencia justo cuando
  más falta hace. El gráfico se reparte en tres columnas —eje, área
  desplazable, eje— y solo se mueve la del medio.
- **El umbral sale de la geometría**, no de un número mágico: el mínimo por
  corte contra el ancho disponible, así que se ajusta a la pantalla y al zoom.

Tres intentos propios que hubo que descartar midiendo: el `rangeslider` nativo
encogía el área y se comía las etiquetas; el `dragmode: "pan"` rompía el gesto
de dos dedos del trackpad y permitía arrastrar al vacío sin tope; y una regla de
atenuación colgada de `:hover` apagaba el gráfico entero cuando el cursor caía
en el hueco de 3 px entre columnas.

**A evaluar:** los gráficos de Territorial y Aulas contra esta lista, empezando
por el piso de los segmentos y por si algún estado se pinta con un color escrito
a mano en la vista.

---

## 9. Pestañas contextuales: se añaden por pregunta, no para partir contenido

Lo que se añadió en Acreditación y por qué:

| Superficie | Pestaña | La pregunta que responde |
|---|---|---|
| Fuentes | reparto por pregunta | ¿qué universo tengo, qué llegó, qué falta? |
| Modelo | **Distribución por actor** | ¿cómo se reparte la variable que me importa? |
| Modelo | **Cronograma del campo** | ¿cuándo cierra cada reporte? |
| Teléfono | **Estados** | ¿qué significa cada estado que trae el corte? |
| Teléfono | ritmo con apilado | ¿en qué acabaron las llamadas de cada día? |
| Avance | Detalles | ¿qué declaró cada actor? |

Y una que **no** se hizo: el plan pedía *quitar* subpestañas de Modelo (B1), y
quedó superado por la decisión de añadir dos. Está anotado en el plan para que
nadie lo «repare» deshaciéndolas. La lección es que un plan escrito hace tres
días no gana a una decisión de dominio tomada hoy, pero hay que dejar constancia
del cruce.

**Criterio para los demás modos:** una pestaña nueva se justifica cuando responde
una pregunta distinta y mantiene juntas las decisiones que se toman juntas.
Partir una vista larga en dos no es estructura, es navegación duplicada.

---

## 10. Cómo se verificó (y qué costó)

Esto vale para cualquier trabajo visual en el repo:

- **Medir en la app, no leer CSS.** Los defectos que importaron —segmentos de
  2 px, títulos girados encimados sobre las cifras, el gráfico apagándose
  entero— solo aparecieron midiendo en pantalla. Varios pasaban typecheck y
  tests sin problema.
- **Los tests débiles dan verde en falso.** Un `toContain("1 caso")` acertaba
  dentro de «1 casos»; el defecto de plural sobrevivió a su propio test hasta que
  se comprobó la negativa.
- **El hover automatizado no dispara React.** El `hover` de la herramienta mueve
  el cursor pero no emite los eventos que React escucha: hay que confirmar con
  `elementFromPoint` antes de concluir que la función está rota, y disparar el
  evento nativo para aislar.
- **HMR stale produce errores fantasma.** Dos veces apareció un
  `ReferenceError` de un símbolo que sí existía en disco y con typecheck limpio.
- **`node_modules` puede estar corrupto sin que nada lo diga.** El 2026-07-29 el
  dev server dejó de arrancar con `unknown node of type "ExpressionStatement"` en
  `main.tsx`, un archivo intacto en git. `pnpm install` respondía **«Already up
  to date»**: comprueba el lockfile, no la integridad del contenido. Estaban
  corruptos `@babel/generator` y `@babel/traverse` —a este último le faltaba
  `lib/path/replacement.js` entero—, junto a 182 directorios vacíos con sufijo
  `" 2"` en `.pnpm`, la firma de una copia de Finder/iCloud a medias.
  > Lo que ahorra tiempo es **reproducir fuera de la herramienta**: tres líneas
  > —`parser.parse('a.b = 1;')` pasado por `generator`— aislaron en un minuto lo
  > que dos reinicios del dev server y un borrado de `node_modules/.vite` no
  > tocaron. Antes de eso di dos diagnósticos equivocados razonando sobre el
  > árbol de dependencias sin ejecutarlo.
  >
  > La reparación es borrar los paquetes afectados de `node_modules/.pnpm/` y
  > reinstalar: pnpm los repone desde el store sin tocar el lockfile. Y el
  > **build de producción no lo detecta** —usa esbuild, no Babel—, así que un
  > verde de `pnpm build` no dice nada del dev server.
- **El warm start es el coste dominante.** Abrir el proyecto real cuesta varios
  minutos y una recarga completa obliga a recalcular; conviene levantar el stack
  una vez y verificar todo en esa sesión. El backend al 99 % de CPU no está
  colgado: alterna ráfagas y pausas, así que una sola medición no distingue.
- **La auditoría de congelados es un aliado.** Rechazó un cálculo duplicado en
  dos monolitos y forzó moverlo al vocabulario compartido; el resultado fue
  mejor que la primera versión.

---

## 11. Una pestaña que no decide nada no es una pestaña

Añadido tras Telefónico, 2026-07-29. §9 dice cuándo se **añade** una pestaña;
esto es su reverso, y salió de un caso que ninguna de las reglas anteriores
atrapaba.

Las tres pestañas de Fuentes en Telefónico se llamaban por su pregunta —lo que
§1 pide— y aun así el usuario las reportó como indistinguibles. Tenían razón: el
nombre estaba bien y el contenido no. Renderizaban un solo componente con un
`focus` que gobernaba las tarjetas pero **no** los dos bloques de configuración,
que se montaban en las tres. «Encuestas» ofrecía configurar hojas de cálculo, y
«Fuentes activas» era la unión literal de las otras dos.

Lo que lo dejó pasar es que dos de los cinco booleanos del reparto sólo
controlaban el atributo `open` del `<details>`, no su presencia. Un `focus` que
parece gobernar el contenido y sólo gobierna un adorno es indistinguible de uno
correcto leyendo el código.

**A evaluar:** en cada sección con pestañas, montar dos y comparar. Si el diff es
sólo qué está plegado, no son dos pestañas. Y el reparto conviene sacarlo a un
módulo con test —`profiles/telefonico/fuentes/repartoDePestanas.ts` es el
patrón—: «cada decisión aparece en una pestaña y sólo en una» es una aserción,
no una intención.

---

## 12. Un flujo genérico no sirve a cuatro modos que trabajan distinto

El panel de conectar fuente empezaba preguntando el **servicio** —Google Sheets /
Kobo / SurveyMonkey— igual para todos. Es §1 otra vez, pero en un flujo en vez de
en un rótulo, y por eso se escapó: los rótulos ya estaban corregidos.

Medido en `acnur_pdm`: un estudio telefónico, que lee su padrón de Sheets y sus
efectivas de Kobo, recibía SurveyMonkey como tercera opción de igual peso, y
«Universo» preseleccionado cuando lo que ordena el estudio es el barrido.

La reparación fue declarar el guion de cada familia (`fuentes/guionDeConexion.ts`):
qué piezas necesita, en qué orden dependen una de otra, qué servicios admite cada
una y si el estudio la reparte por actor. Con eso:

- El servicio **deja de preguntarse** donde no hay decisión —una hoja de barrido
  es una hoja de cálculo— y ese paso desaparece del flujo en vez de pedir un
  «Continuar» sobre una pantalla que repite el nombre de la pieza.
- Al conectar, el panel **no se cierra si queda algo**: avanza a la pieza
  siguiente, y en una pieza por actor a la siguiente **de ese mismo actor**.
  Cerrar devolvía al usuario a la pantalla anterior con el estudio a medio
  configurar y le obligaba a reabrir el panel para lo que él mismo acababa de ver
  marcado como pendiente.
- Una pieza `porActor` **nunca está terminada**: siempre puede entrar otro actor,
  y ese es justamente el caso que lleva a alguien al panel en Acreditación. Lo
  que se dice de ella no es «lista» sino cuáles ya lo tienen.

> **`cubiertaPor` es dominio, no atajo.** Muchos estudios telefónicos llevan
> universo y barrido en la misma hoja: cada fila es una persona a llamar con su
> estado al lado. El motor ya lo resolvía así, y sin declararlo el guion pedía
> conectar un padrón que el estudio ya tenía —contradiciendo a la pantalla de al
> lado, que lo daba por completo—. Una regla que el motor aplica y la UI ignora
> produce dos verdades sobre el mismo dato.

**A evaluar:** Territorial y Aulas tienen su guion declarado pero sin verificar
en pantalla. Y el mismo patrón aplica a cualquier flujo de alta compartido entre
modos: si el primer paso es elegir un proveedor, el flujo no sabe dónde está.

---

## 13. El sideover lleva la identidad del módulo desde el que se abre

El panel iba en portal al `body` —obligatorio: `position: fixed` no se ancla al
viewport si un ancestro tiene `transform`— y ahí **pierde el scope del módulo**,
así que salía gris en los cuatro modos. Se declara el acento en el propio panel.

Dos medidas de la misma vuelta:

- El tinte al 9 % es indistinguible del gris de fondo. Si el color tiene que
  decir de qué módulo se habla, tiene que verse: 13 % en el degradado más un 4 %
  en la base, y un distintivo con el icono del módulo.
- **Alto completo o alto por contenido, según qué haya dentro.** La versión
  anterior dejaba que el alto lo pusiera el contenido, y con razón: un panel de
  un solo formulario que reserva 793 px para 251 se lee como una vista rota. Con
  el guion al lado —que está siempre y ocupa el alto de verdad— el criterio se
  invierte, porque un sheet de altura variable salta de tamaño en cada paso
  teniendo una columna fija al lado.

Y una trampa que sólo aparece midiendo: el panel arrastra reglas del kit que
ponen `white-space: nowrap` en `em`. A 1024×600, «A quién hay que llamar y las
variables de cuota» ocupaba 250 px dentro de una columna de 154 y se salía por el
borde. Lo que dice qué aporta cada pieza no se recorta (C4).

---

## Pendientes que salen de aquí

1. **Territorial** (§4.2 del plan): aplicar §1–§4, §8 y §11–§13. Telefónico
   (§4.4) quedó hecho el 2026-07-29.
0. El guion de conexión de **Territorial**, **Aulas** y el genérico está
   declarado pero **sin verificar en pantalla**: sólo se comprobó Telefónico
   sobre `acnur_pdm`. Acreditación tiene su guion cubierto por test y tampoco se
   miró en la app —abrir `acrconta` cuesta ~3,5 min por recarga—.
2. El gráfico general de **Telefónico** conserva el scroll simple: sus ejes se
   desplazan. Lleva una banda propia montada sobre la geometría del gráfico
   (`usesEffectiveAxisBand`) y meterle el marco exige verificar esa interacción.
3. `AcreditacionSurveySourcePicker` quedó sin montar; se retira cuando se
   confirme en producción que el catálogo del panel lo cubre.
4. El eje temporal tiene un mecanismo de aclarado de etiquetas (`tickEvery`) que
   queda anulado porque los cortes de reporte fuerzan su propia marca. Con
   desplazamiento no molesta; es el sitio a tocar si algún día se quiere un
   campo largo legible sin desplazar.
5. Revisar el cache de reportes en **Aulas** y en el dashboard general.
6. **Aulas tiene su especificación desde el 2026-07-30**
   (`plan-monitoreo-aulas-2026-07.md`): la auditoría del Excel con el que se
   operó PUCP 2025, con las cinco secciones que el perfil debe tener, el modelo
   de datos mínimo y 18 criterios de aceptación con cifras. Lo primero que pide
   es lo que §5 de este documento predice: separar `contact_status` de
   `application_status` —el Excel los mezclaba en una columna y por eso dos
   aplicaciones reales figuraban como agendadas—, y tomar la asistencia de los
   eventos de campo en vez de un pegado manual que ya iba 85 asistentes
   desfasado. Y el guion de conexión declara dos fuentes donde la
   especificación exige cuatro.
