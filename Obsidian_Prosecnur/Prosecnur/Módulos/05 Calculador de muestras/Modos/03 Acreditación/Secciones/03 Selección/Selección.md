---
tipo: seccion
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion"
nodo: "calc-muestra/acreditacion/seleccion"
padres: ["[[Acreditación]]"]
orden: 3
documentacion: completa
tags:
  - Seccion
fuentes:
  - "frontend/src/features/calcMuestra/general/SeleccionActores.tsx"
  - "frontend/src/features/calcMuestra/general/SelectorActor.tsx"
  - "api/R/calc_muestra_general_marco.R"
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
| Archivo del marco | Declara el padrón del actor | Escribe su N en el cálculo |
| Sorteo | El mismo de Muestra general, por actor | Listado con π y peso |
## Qué significa sortear según la técnica
| Técnica del actor | Resultado |
|---|---|
| Muestra probabilística (MAS, estratificado, sistemático) | Sorteo con π y peso base |
| Cobertura censal o barrido | El marco entero en orden aleatorio de contacto, π = 1 |
| Cuotas o conveniencia | No hay sorteo: no existe una π que publicar |
## Ojo
Declarar el marco puede cambiar la técnica: el motor infiere la de acreditación por actor, canal y N (docentes con N ≥ 251 pasan a cuotas; estudiantes por aula con N ≥ 3001, a conglomerados).
