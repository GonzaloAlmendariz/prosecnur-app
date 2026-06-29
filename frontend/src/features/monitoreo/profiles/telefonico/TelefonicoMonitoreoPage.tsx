import { lazy, Suspense } from "react";
import { LoadingBlock } from "../../../../components/States";

const TelefonicoProfilePage = lazy(async () => {
  const module = await import("../acreditacion/AcreditacionMonitoreoPage");
  return {
    default: function TelefonicoProfilePageLazy() {
      return <module.AcreditacionProfilePage mode="telefonico" />;
    },
  };
});

export default function TelefonicoMonitoreoPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Abriendo monitoreo telefónico..." />}>
      <TelefonicoProfilePage />
    </Suspense>
  );
}
