import { Suspense } from "react";
import { WorkOrderManager } from "@/components/admin/work-order-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function WorkOrdersPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6" />
          <CardTitle>Gestión de Órdenes de Trabajo</CardTitle>
        </div>
        <CardDescription>
          Crear, ver, editar y eliminar órdenes de trabajo para los clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={
          <div className="flex justify-center p-8">
            <ClipboardList className="h-8 w-8 animate-pulse text-muted-foreground" />
          </div>
        }>
          <WorkOrderManager />
        </Suspense>
      </CardContent>
    </Card>
  );
}
