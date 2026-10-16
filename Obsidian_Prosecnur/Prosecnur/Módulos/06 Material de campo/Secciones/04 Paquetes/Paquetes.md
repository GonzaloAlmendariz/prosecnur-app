---
tipo: seccion
padres:
  - "[[Material de campo]]"
orden: 4
documentacion: parcial
ruta_app: "/material-campo?seccion=paquetes"
nodo: "material-campo/paquetes"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/recopiladores/RecopiladoresShell.tsx"
  - "frontend/src/features/recopiladores/MaterialsSection.tsx"
  - "docs/adrs/0108-material-de-campo-catalogo-de-materiales-por-unidad.md"
---

# Paquetes

> Genera el PDF y el paquete de materiales de las unidades del plan, con un recibo por entrega.

Antes era la pestaña Paquetes de la sección Materiales. El ADR 0108 la separó del editor: Catálogo define la receta y
Paquetes la aplica a las unidades.
