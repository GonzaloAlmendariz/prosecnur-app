# Checklist — la cadena operativa de aulas, de punta a punta

**Encargo (textual):** «tenemos que testear que podemos generar desde cero las
aprox 190 aulas, con algunos adicionales si no se cubre derecho por ejemplo, y
luego poner a prueba que podemos usar esas mismas titulares, reemplazos y extras
para validar de una forma cómoda su transición a Monitoreo y Recopiladores con
una UI consistente, inteligente, elegante y profesional que responda a las
necesidades de los actores involucrados con profesionalismo, elementos visuales,
diagramas, explicaciones inteligentes y mostrando la información necesaria
ordenada de forma correcta y con la correcta jerarquía.»

**Norte de cada iteración**, en sus palabras: *generar → transitar → UI a la
altura*. No es un detalle de una tanda: es el objetivo de todas.

---

## La cadena, verificada en la app

| # | Eslabón | Estado | Evidencia |
|---|---|---|---|
| 1 | Sorteo de 193 titulares | ☑ | 193 · 507 reservas · 1 916 extras · `sel_aulas_20260822204345` |
| 2 | → Monitoreo | ☑ | 700 unidades, `desfasado: false` |
| 3 | → Recopiladores | ☑ | 2 616 = 193 + 507 + 1 916, tras reparar el reseed |
| 4 | → Libro de agendación | ☑ | 700 filas = 193 + 507, con desglose declarado |
| 5 | → Fichas QR | ☑ | el atajo aterriza en el editor de fichas |

## Las nueve reparaciones

| # | Qué estaba mal | Commit |
|---|---|---|
| 1 | «Rehacer el plan» respondía 200 y no rehacía nada | `639b9c3e` |
| 2 | El plan no decía de qué facultades es | `01e92bb1` |
| 3 | La tabla no traía curso, docente ni elegibles | `b5d6e0fc` |
| 4 | Accesos hablaba de «unidades» y dejaba 484 px en blanco | `0cc3577e` |
| 5 | Cuatro columnas de doce eran tautologías, y tapaban el correo | `46f4ec7a` |
| 6 | La cadena de reemplazos, con 146 saltos hacia atrás | `5077dc47` |
| 7 | «Libro de 700 aulas» prometía 700 visitas | `302decbc` |
| 8 | «Abrir fichas QR» llevaba al plan de recolección | `fde1385d` |
| 9 | El guardián de jerga no miraba el copy de estados | `17fb38a3` |
| 10 | El extractor no tenía pruebas propias | `dcf04163` |
| 11 | CI rojo por dos congelados ajenos | `46e2b329` |
| 12 | El resumen del plan no decía si hay con qué reemplazar | `22661e9d` |
| 13 | «2109» y «2,109» en la misma pantalla | `036c0fe2` |
| 14 | «576,5 respuestas faltan» | `06f233c4` |

## Lo que espera decisión tuya

| Tema | Por qué está bloqueado |
|---|---|
| **Hilo conceptual de Monitoreo** | Cálculo tiene «Universo → elegibles → operación → aulas». Qué hilo une las cinco secciones de Monitoreo es una decisión de dominio, no de UI. |
| **Vista por rol** (agendador / jefe de campo / analista) | Propuesta en `docs/qa/roles-del-operativo-de-aulas-2026-08-22.md`. Cambia la navegación del módulo. |
| **Diagramación de la ficha** | Compactar el `field_grid` rompe `test-collection-render-ficha.R:271`, que defiende lo contrario a propósito. |

## Deuda anotada, sin abrir

- **Veinte archivos del perfil de aulas** definen su propio `const fmt = (n) =>
  n.toLocaleString("es-PE")` mientras el compartido vive en `kpisDeAulas.ts`.
  Contra la regla de micro-helpers de la casa.
- La ficha imprime «Rol» y «Muestra» entre sus campos: en una ficha de titular
  son las mismas tautologías que se quitaron de la tabla de Agenda, pero en una
  de reserva sí informan. Hay que decidirlo por tipo de ficha, no en bloque.

## Dos trampas que costaron tiempo y se repiten

1. **Un punto entre dígitos no es un decimal.** «R 152.3» es la reserva 3 de la
   cadena 152. Cazó dos veces en la misma sesión: al filtrar accesos a propiedad
   en el extractor de texto y al barrer decimales en Avance.
2. **Al cambiar lo que se cuenta hay que revisar quién lo cuenta.** «Libro de
   2616 aulas» se arregló ajustando el total y el rótulo siguió diciendo
   «aulas»; las columnas de rol se quedaron cuando la agenda pasó a listar sólo
   titulares.

## Gate al cierre

`tsc` limpio · **5 696** tests de frontend (711 archivos) · **38** archivos de R
entre `carga-aulas` y `collection` · `sync-agentic-os --audit` y `--check` en
verde · 60 tests del sincronizador.
