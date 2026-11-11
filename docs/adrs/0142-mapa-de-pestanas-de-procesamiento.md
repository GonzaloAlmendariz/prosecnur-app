# ADR 0142: mapa de pestañas de Procesamiento

Estado: Aceptado
Fecha: 2026-11-10 (aceptado el 2026-11-11)
Autoridad: Gonzalo pidió "una propuesta profunda de mejora y no solo superficial" para "todas sus secciones (menos Gráficos) y pestañas", y el 2026-11-10 aprobó el mapa de pestañas con las decisiones D1 a D11 de `docs/qa/plan-revamp-procesamiento-2026-11-10.md`. Después decidió D9, D12, D13 y D14. Este ADR recoge solo lo que cambia el contrato de navegación; queda como Propuesto hasta que él lo acepte, porque retira pestañas.

## Contexto

Carga, Validación, Codificación y Analítica suman hoy 27 pestañas en `frontend/src/lib/navegacion/catalogos/procesamiento.ts`. Crecieron función por función: Analítica tiene 13, cuatro de ellas son salidas de un mismo paquete de entrega, y Validación reparte en tres pestañas lo que es una sola cola de decisiones. El plan citado arriba diagnostica siete causas y propone 21 pestañas, cada una con la pregunta que responde. El prototipo aprobado las dibuja todas.

Las direcciones de pestaña son contrato: las fijan `catalogos.test.ts` y `manifiesto.test.ts` (32 pestañas contando Gráficos), las usa `__pulsoNav` en el QA visual y otros módulos enlazan a ellas con `?pestana=`.

## Decisión

Gráficos no cambia. Las otras cuatro secciones quedan así. El slug se conserva cuando la pestaña conserva su función; el slug que cambia se sigue leyendo como alias y no se vuelve a escribir.

| Sección | Pestaña nueva | Slug | Reemplaza a (slug de hoy) |
|---|---|---|---|
| Carga | Bases | `bases` | `plan`, `fuentes` |
| Carga | Revisión | `revision` | `revision` |
| Carga | Variables | `variables` | panel "Variables de la base" |
| Carga | Equivalencias (condicional) | `equivalencias` | `equivalencias` |
| Carga | Formulario | `formulario` | `estructura` |
| Carga | Respuestas | `respuestas` | `datos` |
| Validación | Explorar | `explorar` | `explorar` |
| Validación | Reglas | `reglas` | `instrumento` (paso 1), `reglas_custom` |
| Validación | Hallazgos | `hallazgos` | `instrumento` (pasos 2 y 3) y la cola de `limpieza` |
| Validación | Cierre | `cierre` | `limpieza` |
| Codificación | Preguntas | `preguntas` | `organizar` |
| Codificación | Codificar | `codificar` | `codificar`, `matrices` |
| Codificación | Aplicar | `aplicar` | `adaptar` |
| Analítica | Variables | `variables` | `datos` |
| Analítica | Categorías | `categorias` | `orden` |
| Analítica | Dimensiones | `dimensiones` | `dimensiones` |
| Analítica | Ponderación | `ponderacion` | `ponderacion` |
| Analítica | Frecuencias | `frecuencias` | `frecuencias` |
| Analítica | Cruces | `cruces` | `cruces` |
| Analítica | Comparativos (condicional) | `comparativos` | `multibase`, `comparativos`, `panel` |
| Analítica | Entrega | `entrega` | `base_final`, `bases`, `codebook`, `ficha` |

El total pasa de 32 a 26 contando Gráficos. `/procesamiento` deja de redirigir a la primera sección pendiente y muestra "Estado del estudio" (D7). La ruta `/codificacion/preguntas/:parent`, que nada enlaza, se retira.

## Consecuencias

- Se retiran diez slugs y una ruta. Cada uno queda como alias de lectura hacia la pestaña que lo absorbe, para que los enlaces de otros módulos y los proyectos guardados sigan llegando a algún lado.
- `matrices` deja de ser una pestaña: la codificación con matriz pasa a la vista de tabla de Codificar y la matriz queda como archivo de salida en Aplicar. Traer una columna ya codificada desde un SAV o un Excel se declara en Preguntas.
- Un punto queda abierto: el alias de `limpieza`. Hoy esa pestaña contiene la cola de decisiones y el cierre; los enlaces "Ver en limpieza" apuntan a la cola. Se propone que el alias lleve a `hallazgos`.
- Cambian `TOTAL_PESTANAS_PROCESAMIENTO`, las firmas de `catalogos.test.ts` y `manifiesto.test.ts`, y la lista de archivos que `auditReadyRoutes.contract.test.ts` lee por AST.

## Cumplimiento

La implementación va por secciones, y el catálogo de cada sección cambia en el mismo commit que monta sus pestañas nuevas, con sus pruebas de contrato actualizadas. Mientras este ADR estuvo en Propuesto no se borró ninguna pestaña. Gonzalo lo aceptó el 2026-11-11 ("Acepto todo lo que haga falta", en respuesta a la lista de decisiones pendientes, cuya primera era este ADR). Desde entonces el catálogo de cada sección puede cambiar a sus pestañas nuevas; las direcciones viejas se siguen leyendo como alias y no se escriben. El borrado de los archivos de página que queden sin uso sigue pidiendo su confirmación en el momento de hacerlo.

## Notas

El detalle de cada pestaña, sus pantallas y lo que pide al motor está en el plan citado en Autoridad, secciones 5, 8 y 9.
