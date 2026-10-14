// Carga perezosa de los OTROS formularios del proyecto para comparar listas.
// Se monta sólo con el diálogo abierto. Lee como el editor al cambiar de
// formulario: primero la copia local del proyecto, si no la del backend.
// Un formulario que no se pudo leer no tumba a los demás: queda en `fallidos`.

import { useEffect, useState } from "react";
import { apiXlsformFormGet } from "../../../api/xlsformEditor";
import { loadForm, type ProjectScope } from "../state/persistence";
import type { FormularioHermano } from "./listasEntreFormularios";

export type ReferenciaFormulario = { id: string; name: string };

export type FormulariosDelProyecto = {
  scope: ProjectScope;
  activoId: string | null;
  formularios: readonly ReferenciaFormulario[];
};

export type EstadoHermanos =
  | { estado: "sin-otros" }
  | { estado: "cargando" }
  | { estado: "listo"; hermanos: FormularioHermano[]; fallidos: string[] };

async function leerHermano(scope: ProjectScope, ref: ReferenciaFormulario): Promise<FormularioHermano> {
  const local = loadForm(scope, ref.id);
  if (local) return { id: ref.id, nombre: ref.name, workbook: local.workbook };
  const remoto = (await apiXlsformFormGet(ref.id)).form;
  if (!remoto) throw new Error(`El formulario «${ref.name}» no tiene contenido.`);
  return { id: ref.id, nombre: ref.name, workbook: remoto.workbook };
}

export function useFormulariosHermanos(proyecto: FormulariosDelProyecto | undefined): EstadoHermanos {
  const scope = proyecto?.scope ?? null;
  // Clave estable: el índice de la biblioteca se re-crea en cada guardado y no
  // debe recargar los formularios; sólo si cambia el conjunto (id + nombre).
  const clave = JSON.stringify(
    (proyecto?.formularios ?? [])
      .filter((f) => f.id !== proyecto?.activoId)
      .map((f): ReferenciaFormulario => ({ id: f.id, name: f.name })),
  );
  const [estado, setEstado] = useState<EstadoHermanos>(clave !== "[]" ? { estado: "cargando" } : { estado: "sin-otros" });

  useEffect(() => {
    const otros = JSON.parse(clave) as ReferenciaFormulario[];
    if (!otros.length) {
      setEstado({ estado: "sin-otros" });
      return undefined;
    }
    let vigente = true;
    setEstado({ estado: "cargando" });
    void Promise.allSettled(otros.map((ref) => leerHermano(scope, ref))).then((resultados) => {
      if (!vigente) return;
      const hermanos: FormularioHermano[] = [];
      const fallidos: string[] = [];
      resultados.forEach((r, i) => {
        if (r.status === "fulfilled") hermanos.push(r.value);
        else fallidos.push(otros[i].name);
      });
      setEstado({ estado: "listo", hermanos, fallidos });
    });
    return () => { vigente = false; };
  }, [clave, scope]);

  return estado;
}
