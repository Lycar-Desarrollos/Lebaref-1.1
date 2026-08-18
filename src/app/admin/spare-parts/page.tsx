
import { SparePartsManager } from "@/components/admin/spare-parts-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function SparePartsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Package className="w-6 h-6" />
                    <CardTitle>Almacén de Refacciones</CardTitle>
                </div>
                <CardDescription>Control de inventario: existencias, stock mínimo, ubicaciones y valor del almacén.</CardDescription>
            </CardHeader>
            <CardContent>
                <SparePartsManager />
            </CardContent>
        </Card>
    )
}
