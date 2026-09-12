# GOAL — Robustez: que la app no falle al usarse

Encargo de Gonzalo del 2026-09-12: «deja la app robusta y sólida en un loop
definido de mejora continua».

## La vara, y de dónde sale

La jornada del 2026-09-11 cerró con **20 commits, 9 de ellos fixes** de defectos
que sólo aparecieron al mirar la app en vivo. No los vio ningún test, ningún
typecheck y ningún build. Ésa es la medida de fragilidad: **el código pasa sus
gates y falla al usarse.**

**Una clase de defecto sólo está cerrada con tres cosas**: un guard automático
que la caza, **probado matando un mutante**, y un **barrido con su cifra** que
diga cuántos hermanos vivos quedaban. Sin las tres, no está cerrada. No vale
«revisé y parece que no hay más».

## El catálogo — las clases y su guard

| # | Clase | Guard | Mutante |
|---|---|---|---|
| 1 | Un endpoint no existe hasta que se le llama | regla de trabajo, no guard | — |
| 2 | Una lista cerrada se traga el campo en silencio | `test-monitoreo-aulas-campos-declarados.R` | 27→25/2 |
| 3 | Dos vocabularios para el mismo estado | `test-monitoreo-aulas-estado-normalizado.R` | 9→6/3 |
| 4 | Un paso que puede no ocurrir y no lo cuenta | `test-monitoreo-aulas-publicar-marcas.R` | 55→54/1 y 51/4 |
| 5 | Anclar por igualdad exacta lo que el libro escribe con sufijo | (en publicar-marcas) | 55→49/1 |
| 6 | Un gate que no se corre | `make gate-area` | 108/2 |
| 7 | Un concepto con dos implementaciones | `test-helpers-sin-duplicar.R` | 2→1/1 |
| 8 | Un estado de React que se escribe y nadie pinta | `estadoQueNadieLee.contract.test.ts` | 2→1/1 |

### El patrón que une a los peores

**No es el paso que calla: es el que da la razón equivocada.** Un paso mudo deja
buscando; uno que miente manda al sitio equivocado, y eso cuesta mucho más.

- «Esa hoja no está en el libro» cuando fue la red.
- «Credenciales inválidas» cuando fue el secreto ilegible.
- «Cero respuestas» cuando fue un portal cautivo.
- «Traspaso verificado» cuando no se verificó nada.

## Los defectos vivos que encontró, con su cifra

1. **Marcar un refuerzo era imposible sobre el plan real** — el plan de sesión
   guarda «SIN CONTACTAR» y el motor comparaba `sin_contactar`: **1.213 de
   1.218** reservas inalcanzables.
2. **Activar un reemplazo decía «no quedan reservas» teniéndolas todas** — doble
   causa: la cadena se resolvía por `replacement_for` (de 202 valores, **cero**
   coincidían con un titular) y el estado se comparaba crudo.
3. **El sello de la marca se caía camino al tablero** — `activation_origin` y
   `activated_for` no estaban declarados; después, `replaced_by`.
4. **La segunda publicación no habría encontrado ninguna marca** — tras releer
   el libro, el estado vuelve a su forma de Excel. Lo cazó el guard solo.
5. **El paquete de defensa se armaba con una selección de otro escenario.**
6. **Una hoja que falla por red se reportaba como «no está en el libro».**
7. **Renovar el acceso a Google fallaba en silencio** y salía el 401 crudo.
8. **Un 200 de Kobo con cuerpo ilegible** podía leerse como **cero respuestas**.
9. **Un XLSForm ilegible dejaba pasar el traspaso sin verificar** — fallar
   abierto en la puerta que existe para cerrar.

## Medidas que no conviene volver a pagar

- Tablero de aulas: **5,45 MB**, 56 claves; `agenda` sola **4 MB** (1.392 filas
  × 107 campos, 21 vacíos en todas — `section` entre ellos).
- `/state`: **8,1 s** la primera vez, **~2,6 s** desde caché. O sea **~5,5 s de
  construcción** y ~2,6 de serializar y transportar.
- Los cuatro `report_scope` de aulas devuelven el mismo payload **byte a byte**.
  `scopeForView()` los varía por sección, así que cambiar de sección reconstruye
  el tablero que ya se tenía. **El token que decide es el general**
  (`monitoreo_router_estado.R:57`), compartido por todas las familias: no se
  toca. El arreglo vive en el frontend y es **decisión de Gonzalo**.
- Helpers de texto en el backend: **69 distintos, sólo 5 con cuerpo repetido**.
  El conteo bruto (61 archivos) exagera: la mayoría tiene comportamiento propio.
- `useState` en el frontend: **1.754**, uno huérfano.
- Claves del tablero consumidas por el perfil: **52, cero huérfanas**.

## Trampas del propio método, aprendidas aquí

- **Un barrido estático no cierra una clase.** 3 falsos positivos de 52 (6 %) en
  un barrido por regex. Cada señal se verifica contra el dato vivo.
- **Un mutante mal hecho no prueba nada.** Dejar la variable citada en código
  muerto no reprodujo el defecto; hubo que borrar el bloque entero.
- **Explicar sin medir.** Dije dos veces que el endpoint de marcar reconstruía
  el tablero. Era falso: sólo invalida cachés. Y el arreglo de caché que hice
  después **no cambió el tiempo**, medido.
- **Un «Abierto» puede estar cerrado.** Con dos sesiones en el árbol, un
  pendiente se reverifica en el código antes de trabajarlo.
- **Un guard que da un falso rojo se acaba ignorando** — `tokensDefinidos` se
  cazaba a sí mismo al escanear los tests.
- **Una exclusión sin su motivo escrito** es por donde se cuela el caso real.

## Lo que queda, y qué necesita

- **Decisión de Gonzalo**: que `report_scope` deje de variarse en aulas (una
  línea en `scopeForView`, `AulasMonitoreoPage.tsx:143`), o que el backend acote
  de verdad.
- **Permiso de Gonzalo**: activar un reemplazo real en vivo. Es lo único que le
  falta al arreglo del camino A, y mutaría el operativo.
- Bajar el TOPE 4 de `test-helpers-sin-duplicar.R` si se cierra alguna de las
  cuatro parejas restantes (analítica, gráficos, monitoreo) — de acuerdo con la
  otra sesión.
