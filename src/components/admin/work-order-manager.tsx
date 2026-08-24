"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, PlusCircle, Download, Trash2, Edit, Loader2,
  ArrowUpDown, Calendar as CalendarIcon, Eraser, ChevronDown, Link as LinkIcon,
  ExternalLink, FileText,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { WorkOrderForm } from "@/components/forms/work-order-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection, onSnapshot, deleteDoc, doc, serverTimestamp,
  runTransaction, updateDoc, query, where, or,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
export type WorkOrderItem = {
  description: string;
  quantity: number;
  unidad?: string;
};

export type WorkOrder = {
  id: string;
  otNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  serviceAddress?: string;
  responsable?: string;
  date: string;
  tipoServicio?: string;
  tipoTrabajo?: string;
  equipoLugar?: string;
  observations?: string;
  items: WorkOrderItem[];
  status: "Pendiente" | "Asignada" | "En Proceso" | "En Espera" | "Completada" | "Cancelada" | "Completado" | "Cancelado";
  technicianId?: string;
  technician?: string;
  userId: string;
  createdAt?: any;
};

type UserProfile = {
  role: "admin" | "employee";
  userCode: string;
  permissions?: { [key: string]: boolean };
};

// ─── Status badge styles ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  "Pendiente":  { label: "Pendiente",  className: "bg-gray-100 text-gray-700 border border-gray-300" },
  "Asignada":   { label: "Asignada",   className: "bg-sky-100 text-sky-700 border border-sky-300" },
  "En Proceso": { label: "En Proceso", className: "bg-blue-100 text-blue-700 border border-blue-300" },
  "En Espera":  { label: "En Espera",  className: "bg-orange-100 text-orange-700 border border-orange-300" },
  "Completada": { label: "Completada", className: "bg-green-100 text-green-700 border border-green-300" },
  "Cancelada":  { label: "Cancelada",  className: "bg-red-100 text-red-700 border border-red-300" },
  // Compatibilidad con OTs antiguas
  "Completado": { label: "Completada", className: "bg-green-100 text-green-700 border border-green-300" },
  "Cancelado":  { label: "Cancelada",  className: "bg-red-100 text-red-700 border border-red-300" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-700 border border-gray-300" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

// ─── Valid state transitions (irreversible states are terminal) ────────────────────────
const STATE_TRANSITIONS: Record<string, string[]> = {
  "Pendiente":  ["Asignada", "Cancelada"],
  "Asignada":   ["Pendiente", "En Proceso", "Cancelada"],
  "En Proceso": ["En Espera", "Completada", "Cancelada"],
  "En Espera":  ["En Proceso", "Completada", "Cancelada"],
  // Estados terminales — sin transiciones posibles
  "Completada": [],
  "Cancelada":  [],
  // Compatibilidad OTs antiguas
  "Completado": [],
  "Cancelado":  [],
};

const getValidTransitions = (current: string): string[] =>
  STATE_TRANSITIONS[current] ?? [];

// ─── PDF Generator Profesional (sin precios) ─────────────────────────────
const downloadPDF = (ot: WorkOrder) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth  = doc.internal.pageSize.width;
  const margin     = 14;
  const bottomMargin = 40;
  const topMargin    = 42;
  let lastPage = 1;

  const primaryColor: [number, number, number] = [30, 62, 98]; // Navy Blue
  const titleText = "ORDEN DE TRABAJO";
  const subtitleText = "CONTROL OPERATIVO DE SERVICIO";

  const drawHeader = () => {
    // Membrete Superior con Logo
    try {
      doc.addImage(LOGO_BASE64, "PNG", margin, 6, 46, 25.8);
    } catch (e) {
      console.warn("Logo no disponible:", e);
    }

    const rx = pageWidth - margin;
    
    // Título Principal
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(titleText, rx, 16, { align: "right" });

    // Subtítulo
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text(subtitleText, rx, 21, { align: "right" });

    // Folio
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(15, 23, 42);
    doc.text(`FOLIO: ${ot.otNumber}`, rx, 27, { align: "right" });

    // Línea divisoria de membrete
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.7);
    doc.line(margin, 33, pageWidth - margin, 33);
    doc.setTextColor(0);
  };

  drawHeader();

  const localDate = new Date(ot.date.replace(/-/g, "/"));
  const dateFormatted = isNaN(localDate.getTime())
    ? ot.date || "—"
    : localDate.toLocaleDateString("es-MX", { timeZone: "UTC" });

  const clientInfo = [
    `Empresa: ${ot.clientName || "—"}`,
    `Teléfono: ${ot.clientPhone || "—"}`,
    `Dirección Fiscal: ${ot.clientAddress || "—"}`,
    ot.serviceAddress ? `Lugar de Obra: ${ot.serviceAddress}` : null,
  ].filter(Boolean).join("\n");

  const otInfo = [
    `Fecha de Emisión: ${dateFormatted}`,
    `Ciudad: Mérida, Yucatán`,
    `Tipo de Servicio: ${ot.tipoServicio || "N/A"}`,
    `Tipo de Trabajo: ${ot.tipoTrabajo || "N/A"}`,
    `Equipo / Área: ${ot.equipoLugar || "N/A"}`,
    ot.quoteNumber ? `Cotización Origen: ${ot.quoteNumber}` : "Cotización: Directa",
  ].filter(Boolean).join("\n");

  const companyInfo = [
    `Técnico Asignado: ${ot.technician || "Por asignar"}`,
    `Responsable Lebaref: ${ot.responsable || "Corporativo Lebaref"}`,
    "",
    "Calle 33 No. 259 Int 2 x 12 y 14",
    "Col. Santa María Chuburna CP. 97138",
    "Oficinas: 990 101 0387 | corporativo@lebaref.com",
  ].filter((v) => v !== null).join("\n");

  autoTable(doc, {
    startY: 37,
    head: [["DATOS DEL CLIENTE & SITIO", "DATOS DE LA ORDEN DE TRABAJO", "CONTACTO LEBAREF"]],
    body: [[clientInfo, otInfo, companyInfo]],
    theme: "grid",
    headStyles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak", valign: "top", textColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 63 }, 2: { cellWidth: 57 } },
    margin: { top: topMargin, left: margin, right: margin },
  });

  let finalY = (doc as any).lastAutoTable.finalY;

  // Tabla de ítems y actividades — Estrictamente SIN precios
  autoTable(doc, {
    startY: finalY + 3,
    didDrawPage: (data) => {
      if (data.pageNumber > lastPage) { drawHeader(); lastPage = data.pageNumber; }
    },
    head: [[
      { content: "#", styles: { halign: "center" } },
      { content: "DESCRIPCIÓN DE ACTIVIDAD / MATERIAL / REFACCIÓN",  styles: { halign: "left" } },
      { content: "UNIDAD",       styles: { halign: "center" } },
      { content: "CANTIDAD",     styles: { halign: "center" } },
    ]],
    body: ot.items.map((item, i) => [
      { content: i + 1,                               styles: { halign: "center" } },
      { content: item.description || "—",             styles: { halign: "left" } },
      { content: item.unidad || "PZA",                styles: { halign: "center" } },
      { content: (item.quantity || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 }), styles: { halign: "center" } },
    ]),
    theme: "grid",
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    bodyStyles: { fontSize: 7, overflow: "linebreak", textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
    },
    margin: { top: topMargin, bottom: bottomMargin, left: margin, right: margin },
  });

  finalY = (doc as any).lastAutoTable.finalY;

  // Observaciones e Instrucciones Técnicas
  if (ot.observations) {
    if (finalY + 32 > pageHeight - bottomMargin) {
      doc.addPage(); drawHeader(); lastPage++; finalY = topMargin;
    }
    autoTable(doc, {
      startY: finalY + 4,
      body: [
        [{ content: "Comentarios, Diagnóstico e Instrucciones de Campo:", styles: { fontStyle: "bold", fontSize: 7.5, textColor: primaryColor } }],
        [{ content: ot.observations, styles: { fontSize: 7, cellPadding: { top: 1.5, bottom: 4 } } }],
      ],
      theme: "plain",
      styles: { overflow: "linebreak", textColor: [30, 41, 59] },
      margin: { top: topMargin, left: margin, right: margin, bottom: bottomMargin },
      didDrawPage: (data) => {
        if (data.pageNumber > lastPage) { drawHeader(); lastPage = data.pageNumber; }
      },
    });
    finalY = (doc as any).lastAutoTable.finalY;
  }

  // Sección de Firmas de Control Operativo
  if (finalY + 40 > pageHeight - 20) {
    doc.addPage(); drawHeader(); finalY = topMargin;
  }
  const signY = finalY + 26;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);

  // 2 Firmas para OT Interna: Cliente y Técnico
  // Firma del Cliente (Izquierda)
  doc.line(28, signY, 92, signY);
  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(30, 41, 59);
  doc.text("Firma de Conformidad del Cliente", 60, signY + 4, { align: "center" });
  doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text("Nombre, Firma y Fecha", 60, signY + 8, { align: "center" });

  // Firma del Técnico (Derecha)
  doc.line(118, signY, 182, signY);
  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(30, 41, 59);
  doc.text("Firma del Técnico Responsable", 150, signY + 4, { align: "center" });
  doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text("Técnico Especialista Lebaref", 150, signY + 8, { align: "center" });

  // Footer en cada página
  const totalPages = (doc as any).internal.getNumberOfPages();
  const todayStr = format(new Date(), "dd/MM/yyyy HH:mm");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
    doc.setFontSize(6.5).setFont("helvetica", "normal").setTextColor(100, 116, 139);
    doc.text(
      `LEBAREF | Orden de Trabajo — Folio: ${ot.otNumber} — ${todayStr}`,
      margin,
      pageHeight - 5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  const fileName = `${ot.otNumber}.pdf`;
  doc.save(fileName);
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function WorkOrderManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  // Load user profile
  useEffect(() => {
    if (authIsLoading) return;
    if (!user) { setIsProfileLoading(false); setIsLoading(false); return; }
    const unsub = onSnapshot(doc(db, "users", user.uid), (d) => {
      if (d.exists()) setUserProfile(d.data() as UserProfile);
      setIsProfileLoading(false);
    });
    return () => unsub();
  }, [user, authIsLoading]);

  // Load work orders
  useEffect(() => {
    if (!user || !userProfile) { if (!isProfileLoading) setIsLoading(false); return; }
    setIsLoading(true);
    const col = collection(db, "ordenes_de_trabajo");
    const hasFullAccess = userProfile.role === "admin" || userProfile.permissions?.work_orders_all;
    const isOnlyOwn = userProfile.permissions?.work_orders_own;
    const isOnlyAssigned = userProfile.permissions?.work_orders_assigned;

    let q;
    if (hasFullAccess) {
      q = col;
    } else if (isOnlyOwn) {
      q = query(col, where("userId", "==", user.uid));
    } else if (isOnlyAssigned) {
      q = query(col, where("technicianId", "==", user.uid));
    } else {
      q = query(col, or(where("userId", "==", user.uid), where("technicianId", "==", user.uid)));
    }
    const unsub = onSnapshot(q, (snap) => {
      setWorkOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkOrder)));
      setIsLoading(false);
    }, () => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "ordenes_de_trabajo", operation: "list" }));
      setIsLoading(false);
    });
    return () => unsub();
  }, [user, userProfile, isProfileLoading]);

  // Date filter
  const filteredWOs = useMemo(() => {
    if (!date?.from) return workOrders;
    const from = new Date(date.from); from.setHours(0, 0, 0, 0);
    const to = date.to ? new Date(date.to) : new Date(date.from); to.setHours(23, 59, 59, 999);
    return workOrders.filter((wo) => {
      if (!wo.date) return false;
      const d = new Date(wo.date.replace(/-/g, "/"));
      return d >= from && d <= to;
    });
  }, [workOrders, date]);

  // Save (create / update)
  const handleSave = useCallback(async (data: Omit<WorkOrder, "id" | "otNumber" | "userId" | "createdAt">) => {
    if (!user) return;
    try {
      if (selectedWO) {
        await updateDoc(doc(db, "ordenes_de_trabajo", selectedWO.id), { ...data });
        toast({ title: "OT Actualizada", description: `La orden de trabajo ${selectedWO.otNumber} ha sido actualizada.` });
      } else {
        await runTransaction(db, async (tx) => {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await tx.get(userDocRef);

          let userCode = "00";
          let newOtCounter = 1;

          if (userDoc.exists()) {
            const uData = userDoc.data();
            userCode = uData.userCode || "00";
            newOtCounter = (uData.workOrderCounter || 0) + 1;
            tx.update(userDocRef, { workOrderCounter: newOtCounter });
          } else {
            const counterRef = doc(db, "counters", "work_orders");
            const counterDoc = await tx.get(counterRef);
            newOtCounter = (counterDoc.exists() ? counterDoc.data().lastNumber : 0) + 1;
            tx.set(counterRef, { lastNumber: newOtCounter }, { merge: true });
          }

          const newOtNumber = `OT${userCode}-${String(newOtCounter).padStart(4, "0")}`;
          const newRef = doc(collection(db, "ordenes_de_trabajo"));
          tx.set(newRef, {
            ...data,
            otNumber: newOtNumber,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
        });
        toast({ title: "OT Creada", description: "La nueva orden de trabajo ha sido creada." });
      }
      setIsFormOpen(false);
      setSelectedWO(null);
    } catch (error) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: selectedWO ? `ordenes_de_trabajo/${selectedWO.id}` : "ordenes_de_trabajo",
        operation: selectedWO ? "update" : "write",
      }));
    }
  }, [selectedWO, user, toast]);

  // Delete with safe counter rollback (only if it's the latest OT for that user)
  const handleDelete = useCallback(async (wo: WorkOrder) => {
    try {
      await runTransaction(db, async (tx) => {
        const otRef = doc(db, "ordenes_de_trabajo", wo.id);
        const otDoc = await tx.get(otRef);
        if (!otDoc.exists()) return;

        const otData = otDoc.data();
        const targetUserId = otData.userId || user?.uid;

        // Extraer el número consecutivo de la OT (ej: OT01-0005 -> 5)
        const match = (otData.otNumber || "").match(/OT\d+-(\d+)/);
        const currentOtNum = match ? parseInt(match[1], 10) : null;

        if (targetUserId && currentOtNum !== null) {
          const userDocRef = doc(db, "users", targetUserId);
          const userDoc = await tx.get(userDocRef);
          if (userDoc.exists()) {
            const currentCounter = userDoc.data().workOrderCounter || 0;
            // Solo si la OT que se elimina es exactamente la última generada por ese usuario
            if (currentCounter === currentOtNum && currentCounter > 0) {
              tx.update(userDocRef, { workOrderCounter: currentCounter - 1 });
            }
          }
        }

        tx.delete(otRef);
      });
      toast({ title: "OT Eliminada", description: "La orden de trabajo ha sido eliminada." });
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: `ordenes_de_trabajo/${wo.id}`, operation: "delete" }));
    }
  }, [toast, user]);

  // Status change — validates transition before applying
  const handleStatusChange = useCallback(async (wo: WorkOrder, newStatus: WorkOrder["status"]) => {
    const validNext = getValidTransitions(wo.status);
    if (!validNext.includes(newStatus)) {
      toast({
        title: "Transición no permitida",
        description: `No es posible pasar de "${STATUS_CONFIG[wo.status]?.label ?? wo.status}" a "${STATUS_CONFIG[newStatus]?.label ?? newStatus}".`,
        variant: "destructive",
      });
      return;
    }
    const ref = doc(db, "ordenes_de_trabajo", wo.id);
    try {
      await updateDoc(ref, { status: newStatus });
      toast({ title: "Estado Actualizado", description: `La OT ${wo.otNumber} ahora está: ${STATUS_CONFIG[newStatus]?.label ?? newStatus}.` });
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: ref.path, operation: "update" }));
    }
  }, [toast]);

  // Columns
  const columns: ColumnDef<WorkOrder>[] = useMemo(() => [
    {
      accessorKey: "otNumber",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          # OT <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono font-bold text-foreground">{row.original.otNumber || "N/A"}</span>,
    },
    {
      accessorKey: "clientName",
      header: "Cliente",
    },
    {
      accessorKey: "tipoServicio",
      header: "Tipo Servicio",
      cell: ({ row }) => row.original.tipoServicio || "—",
    },
    {
      accessorKey: "technician",
      header: "Técnico Asignado",
      cell: ({ row }) => row.original.technician || <span className="text-muted-foreground text-xs">Sin asignar</span>,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        if (!row.original.date) return "N/A";
        return new Date(row.original.date.replace(/-/g, "/")).toLocaleDateString("es-MX", { timeZone: "UTC" });
      },
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "quoteRef",
      header: "COT Origen",
      cell: ({ row }) => row.original.quoteNumber
        ? (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs"
            onClick={() => router.push(`/admin/quotes?id=${row.original.quoteId}`)}>
            <LinkIcon className="mr-1 h-3 w-3" />{row.original.quoteNumber}
          </Button>
        )
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const wo = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuLabel>Acciones de la OT</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setSelectedWO(wo); setIsFormOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Editar Orden
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Descarga de PDF */}
              <DropdownMenuItem onClick={() => downloadPDF(wo)} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4 text-blue-600" /> Descargar PDF
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  disabled={getValidTransitions(wo.status).length === 0}
                  className={getValidTransitions(wo.status).length === 0 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Cambiar Estado
                </DropdownMenuSubTrigger>
                {getValidTransitions(wo.status).length > 0 && (
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
                      Desde: <StatusBadge status={wo.status} />
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {getValidTransitions(wo.status).map((nextStatus) => {
                      const cfg = STATUS_CONFIG[nextStatus];
                      const dotColors: Record<string, string> = {
                        "Pendiente": "bg-gray-400", "Asignada": "bg-sky-500",
                        "En Proceso": "bg-blue-500", "En Espera": "bg-orange-500",
                        "Completada": "bg-green-500", "Cancelada": "bg-red-500",
                      };
                      return (
                        <DropdownMenuItem
                          key={nextStatus}
                          onClick={() => handleStatusChange(wo, nextStatus as WorkOrder["status"])}
                          className="cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${dotColors[nextStatus] ?? "bg-gray-400"}`} />
                            {cfg?.label ?? nextStatus}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                )}
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar {wo.otNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente la orden de trabajo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(wo)} className="bg-destructive hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [handleDelete, handleStatusChange, router]);

  const table = useReactTable({
    data: filteredWOs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: { pagination: { pageSize: 10 } },
    state: { globalFilter: filter, columnFilters, sorting },
    onGlobalFilterChange: setFilter,
  });

  if (isLoading || authIsLoading || isProfileLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Input
            placeholder="Buscar por ID o cliente..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-[200px]"
          />
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" id="ot-date-filter"
                className={cn("w-[200px] justify-start text-left font-normal shrink-0", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {date?.from ? (
                    date.to
                      ? <>{format(date.from, "d LLL", { locale: es })} – {format(date.to, "d LLL", { locale: es })}</>
                      : format(date.from, "d LLL", { locale: es })
                  ) : "Filtrar por fecha..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date}
                onSelect={setDate} numberOfMonths={1} locale={es} />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="capitalize shrink-0" id="ot-status-filter">
                {(table.getColumn("status")?.getFilterValue() as string) ?? "Estado"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={(table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all"}
                onValueChange={(v: string) => table.getColumn("status")?.setFilterValue(v === "all" ? undefined : v)}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Pendiente"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-400"/>Pendiente</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Asignada"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500"/>Asignada</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="En Proceso"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500"/>En Proceso</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="En Espera"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-500"/>En Espera</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Completada"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500"/>Completada</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Cancelada"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500"/>Cancelada</span></DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {(Boolean(filter) || Boolean(date) || Boolean(table.getColumn("status")?.getFilterValue())) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => { setFilter(""); setDate(undefined); table.getColumn("status")?.setFilterValue(undefined); }}>
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Limpiar filtros</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Button id="ot-create-btn" className="bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white font-medium shrink-0" onClick={() => { setSelectedWO(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Orden de Trabajo
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay órdenes de trabajo. Empieza creando una o acepta una cotización.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
      </div>

      <WorkOrderForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave as any}
        workOrder={selectedWO}
        userRole={userProfile?.role}
      />
    </div>
  );
}
