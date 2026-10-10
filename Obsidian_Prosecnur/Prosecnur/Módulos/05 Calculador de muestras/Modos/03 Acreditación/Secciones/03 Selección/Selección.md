---
tipo: seccion
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion"
nodo: "calc-muestra/acreditacion/seleccion"
padres: ["[[Acreditación]]"]
orden: 3
documentacion: completa
verificado_contra: "3d66530e"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/calcMuestra/general/SeleccionActores.tsx"
  - "frontend/src/features/calcMuestra/general/SelectorActor.tsx"
  - "api/R/calc_muestra_general_marco.R"
  - "api/R/calc_muestra_acreditacion_cuadro.R"
  - "docs/adrs/0091-el-cuadro-de-acreditacion-corta-por-precision.md"
  - "docs/adrs/0090-muestra-general-sortea-de-un-marco-real.md"
---
# Selección
> Declara el marco de cada actor y lo sortea según su técnica.
## Objetivo
Que cada actor de la acreditación (administrativos, docentes, estudiantes, egresados) salga con su listado de contacto y, cuando es muestra, con la π de cada persona.
## Elementos de la pantalla
| Elemento | Para qué sirve | Qué cambia o produce |
|---|---|---|
| Selector de actor | Elige el actor; queda en la dirección como `foco` | El marco y el sorteo de ese actor |
| Pestaña Archivo del marco | Declara el padrón del actor | Escribe su N en el cálculo |
| Pestañas Selección aleatoria, Resumen y Unidades | Las mismas de Muestra general, por actor | Listado con π y peso |
## Qué significa sortear según la técnica
| Técnica del actor | Resultado |
|---|---|
| Muestra probabilística de elementos (MAS, estratificado, sistemático) | Sorteo con π y peso base |
| Conglomerados (estudiantes por aula, del lado probabilístico) | No se sortea aquí: se sortea en el modo de aulas |
| Cobertura censal o barrido | El marco entero en orden aleatorio de contacto, π = 1 |
| Cuotas o conveniencia | No hay sorteo: no existe una π que publicar |
## Pestañas
- [[Archivo del marco por actor]]
- [[Selección aleatoria por actor]]
- [[Resumen de la selección por actor]]
- [[Unidades seleccionadas por actor]]
## Ojo
Declarar el marco puede cambiar la técnica: el motor la infiere por actor, canal y N (ADR 0091). Se intenta el censo mientras una muestra a la precisión canónica pediría al menos la cobertura mínima (60 %; 50 % en egresados); desde ahí se sortea. Los puntos de cambio son N = 2 050 en estudiantes por aula (pasan a conglomerados), N = 258 en docentes (MAS) y N = 386 en egresados (MAS).
