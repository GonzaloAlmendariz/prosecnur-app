// Direcciones canónicas de Analítica que otras pestañas enlazan (P-M12).
//
// «Definición global» dejó de existir como lugar: las secciones y las
// exclusiones se deciden en la pestaña Datos. Un texto que remite a otra
// pestaña lleva su enlace, construido con la gramática de navegación v3 y
// no con un string a mano.

import { serializarDireccion } from "../../lib/navegacion/direccion";

export const DIRECCION_DATOS = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "datos",
});
