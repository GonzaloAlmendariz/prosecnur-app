// El inventario de variables de la base activa, pedido una vez por base y
// versión (revisión de V2, B3). En Reglas lo leen dos piezas a la vez: los
// controles del operativo y las reglas propias. La promesa vive en el store
// del feature, que se reinicia con la sesión; si el pedido falla se olvida,
// para que el siguiente intento vuelva a pedirlo.

import { apiV2ExplorarVariables } from "../../api/client";
import { useValidacionStore } from "./store";
import type { ExploradorVariablesList } from "./types";

export function pedirInventario(baseNombre: string | null | undefined): Promise<ExploradorVariablesList> {
  const { version, inventario, setInventario } = useValidacionStore.getState();
  const clave = `${baseNombre ?? ""}|${version}`;
  if (inventario && inventario.clave === clave) return inventario.promesa;
  const promesa = apiV2ExplorarVariables(baseNombre);
  setInventario({ clave, promesa });
  promesa.catch(() => {
    if (useValidacionStore.getState().inventario?.promesa === promesa) setInventario(null);
  });
  return promesa;
}
