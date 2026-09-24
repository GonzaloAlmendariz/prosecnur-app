# Regresión de aulas sobre hsvg2026 — 2026-09-24

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-09-24
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

E9 del loop de Cálculo de muestra. El loop cambió el motor general (no
respuesta, reparto, deff por defecto, avisos de parámetros, sorteo nuevo) y
aulas es el patrón que no debía moverse. Se midió end-to-end, no por suites.

## Cómo

- Árbol de ANTES del loop: `git archive d99f33957^ api`; árbol de AHORA:
  `git archive 90bc0b661 api`. Cada uno cargado con `pkgload::load_all`.
- Proyecto: copia de `api/inst/reference_projects/hsvg2026/hsvg2026.pulso`
  (marco de 5.263 cursos-horario, 2 componentes).
- En cada árbol: `calc_muestra_calcular_componente` sobre los dos
  componentes y `calc_muestra_aulas_seleccionar(frame, config)` con la
  configuración y semilla guardadas en el proyecto.

## Resultado

| Pieza | Antes | Ahora |
|---|---|---|
| Conglomerado (deff 2): n teórico / a campo | 2.304 / 3.456 | 2.304 / 3.456 |
| Dominios independientes (deff 1,5): n teórico / a campo | 4.986 / 5.984 | 4.986 / 5.984 |
| Resultado completo de cada componente | — | idéntico (salvo los campos nuevos `avisos_parametros` y `n_campo`) |
| Selección de aulas (2.373 filas: titulares, reservas, cadenas, π) | — | idéntica byte a byte |

La única diferencia en la selección es `selection_run_id`, que lleva la hora
de la corrida (`sel_aulas_<fecha-hora>_4fda3cad`); su sufijo de contenido es
el mismo en ambas. El cambio deliberado que sí toca aulas —un conglomerado con
p = 0 o p = 1 ya no da n = 0 (H20)— no se ejercita en este proyecto.
