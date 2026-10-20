---
tipo: pestana
padres:
  - "[[Catálogo]]"
orden: 1
documentacion: parcial
ruta_app: "/material-campo?modo=aulas&seccion=catalogo&pestana=tipos"
nodo: "material-campo/aulas/catalogo/tipos"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/recopiladores/catalogo/CatalogoTipos.tsx"
  - "frontend/src/api/materialCatalog.ts"
  - "api/R/collection_material_catalog.R"
  - "docs/adrs/0109-material-de-campo-se-compone-e-imprime-por-tipo-de-campo.md"
---

# Tipos

> Galería de los tipos de material compatibles con las unidades, con la miniatura real que produce el mismo compilador del PDF.

Es el aterrizaje de la sección Catálogo. Filtra por familia, muestra cada tipo con sus páginas (frente y dorso cuando tiene dos caras) y permite fijarlo como plantilla activa. La miniatura usa una unidad de prueba sintética: nunca datos del proyecto.
