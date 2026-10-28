import { KeyRound } from "../../vendor/lucide-react";
import { useAbrirConfiguracion } from "../home/useAbrirConfiguracion";

/**
 * Credenciales en el sitio del error (L7): desde la franja del token abre
 * Configuración › Conexiones sin salir del paso de Carga.
 */
export function BotonConfigurarCredenciales({ sinToken }: { sinToken: boolean }) {
  const abrir = useAbrirConfiguracion();
  return (
    <button type="button" className="pulso-sm-secondary" onClick={() => abrir("connections")}>
      <KeyRound size={13} />
      {sinToken ? "Configurar credenciales" : "Cambiar credenciales"}
    </button>
  );
}
