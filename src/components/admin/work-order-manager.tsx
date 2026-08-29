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
  ExternalLink, FileText, AlertTriangle, AlertCircle, RotateCcw,
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
  runTransaction, updateDoc, getDoc, query, where, or,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
export type WorkOrderItem = {
  description: string;
  quantity: number;
  unit: string;
  observations?: string;
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
  // Auditoría de Cancelación
  cancelledBy?: string;
  cancelledById?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  // Auditoría de Reactivación
  wasReactivated?: boolean;
  reactivatedBy?: string;
  reactivatedById?: string;
  reactivatedAt?: string;
  reactivationReason?: string;
};

type UserProfile = {
  displayName?: string;
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

const StatusBadge = ({ status, wo, onViewCancel }: { status: string; wo?: WorkOrder; onViewCancel?: (wo: WorkOrder) => void }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-700 border border-gray-300" };

  if (status === "Cancelada" || status === "Cancelado") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                if (onViewCancel && wo) {
                  e.stopPropagation();
                  onViewCancel(wo);
                }
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-red-400 transition-all ${cfg.className}`}
            >
              <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
              {cfg.label}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-1.5 p-3 text-xs bg-slate-900 text-slate-100 border-slate-800 shadow-xl rounded-lg">
            <p className="font-bold text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Orden Cancelada (Clic para ver)
            </p>
            <p><span className="text-slate-400 font-medium">Motivo:</span> {wo?.cancellationReason || "Motivo no especificado."}</p>
            {wo?.cancelledBy && <p><span className="text-slate-400 font-medium">Por:</span> {wo.cancelledBy}</p>}
            {wo?.cancelledAt && (
              <p className="text-[10px] text-slate-400">
                {new Date(wo.cancelledAt).toLocaleString("es-MX")}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isReactivated = !!((wo as any)?.wasReactivated || (wo?.reactivatedAt && status !== "Cancelada"));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
        {cfg.label}
      </span>
      {isReactivated && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  if (onViewCancel && wo) {
                    e.stopPropagation();
                    onViewCancel(wo);
                  }
                }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 px-2 py-0.5 rounded-full cursor-pointer transition-all shadow-xs"
              >
                <RotateCcw className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                Reactivada
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs space-y-1.5 p-3 text-xs bg-slate-900 text-slate-100 border-slate-800 shadow-xl rounded-lg">
              <p className="font-bold text-blue-400 flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Orden Reactivada tras cancelación
              </p>
              {wo?.reactivationReason && (
                <p><span className="text-slate-400 font-medium">Nota de reactivación:</span> {wo.reactivationReason}</p>
              )}
              {wo?.cancellationReason && (
                <p className="text-[11px] text-rose-300 border-t border-slate-800 pt-1">
                  <span className="text-slate-400 font-medium">Cancelación previa:</span> {wo.cancellationReason}
                </p>
              )}
              {wo?.reactivatedBy && (
                <p className="text-[10px] text-slate-400">Por {wo.reactivatedBy} el {wo.reactivatedAt ? new Date(wo.reactivatedAt).toLocaleDateString("es-MX") : ""}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
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

  // Tabla de ítems y actividades — Estrictamente SIN precios (Mapeo seguro)
  const itemsList = ot.items || [];
  const tableBody: any[] = itemsList.length > 0
    ? itemsList.map((item, i) => [
        { content: i + 1,                               styles: { halign: "center" as const } },
        { content: item.description || "—",             styles: { halign: "left" as const } },
        { content: item.unidad || (item as any).unit || "PZA", styles: { halign: "center" as const } },
        { content: (item.quantity || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 }), styles: { halign: "center" as const } },
      ])
    : [
        [
          { content: 1, styles: { halign: "center" as const } },
          { content: ot.tipoServicio ? `${ot.tipoServicio} - ${ot.tipoTrabajo || "Servicio técnico"}` : "Servicio técnico operativo según cotización", styles: { halign: "left" as const } },
          { content: "Servicio", styles: { halign: "center" as const } },
          { content: "1.00", styles: { halign: "center" as const } },
        ]
      ];

  autoTable(doc, {
    startY: finalY + 3,
    didDrawPage: (data) => {
      if (data.pageNumber > lastPage) { drawHeader(); lastPage = data.pageNumber; }
    },
    head: [[
      { content: "#", styles: { halign: "center" as const } },
      { content: "DESCRIPCIÓN DE ACTIVIDAD / MATERIAL / REFACCIÓN",  styles: { halign: "left" as const } },
      { content: "UNIDAD",       styles: { halign: "center" as const } },
      { content: "CANTIDAD",     styles: { halign: "center" as const } },
    ]],
    body: tableBody,
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

  // Cancellation & Reactivation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [woToCancel, setWoToCancel] = useState<WorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [viewCancelWo, setViewCancelWo] = useState<WorkOrder | null>(null);

  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [woToReactivate, setWoToReactivate] = useState<WorkOrder | null>(null);
  const [reactivateReason, setReactivateReason] = useState("");
  const [isSubmittingReactivate, setIsSubmittingReactivate] = useState(false);
  const [viewAuditWo, setViewAuditWo] = useState<WorkOrder | null>(null);

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

    // Si se selecciona Cancelar, solicitar motivo y usuario mediante modal de confirmación
    if (newStatus === "Cancelada" || newStatus === "Cancelado") {
      setWoToCancel(wo);
      setCancelReason("");
      setCancelModalOpen(true);
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

  // Confirm Cancellation with reason & user audit
  const handleConfirmCancel = useCallback(async () => {
    if (!woToCancel) return;
    if (!cancelReason.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Por favor describe el motivo de la cancelación de la orden de trabajo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const ref = doc(db, "ordenes_de_trabajo", woToCancel.id);
      const cancelData = {
        status: "Cancelada",
        cancellationReason: cancelReason.trim(),
        cancelledBy: userProfile?.displayName || user?.displayName || user?.email || "Usuario",
        cancelledById: user?.uid || "",
        cancelledAt: new Date().toISOString(),
      };

      await updateDoc(ref, cancelData);
      toast({
        title: "OT Cancelada",
        description: `La orden ${woToCancel.otNumber} ha sido cancelada y se descartó automáticamente de Cuentas por Cobrar.`,
      });
      setCancelModalOpen(false);
      setWoToCancel(null);
      setCancelReason("");
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: `ordenes_de_trabajo/${woToCancel.id}`, operation: "update" }));
    } finally {
      setIsSubmittingCancel(false);
    }
  }, [woToCancel, cancelReason, userProfile, user, toast]);

  // Confirm Reactivation with audit & quote synchronization
  const handleConfirmReactivate = useCallback(async () => {
    if (!woToReactivate || !user) return;
    setIsSubmittingReactivate(true);
    try {
      const ref = doc(db, "ordenes_de_trabajo", woToReactivate.id);
      const userName = userProfile?.displayName || user?.displayName || user?.email || "Usuario";
      const nowIso = new Date().toISOString();
      const reasonText = reactivateReason.trim() || "Reactivada por el administrador";

      await updateDoc(ref, {
        status: "Pendiente",
        wasReactivated: true,
        reactivatedBy: userName,
        reactivatedById: user.uid,
        reactivatedAt: nowIso,
        reactivationReason: reasonText,
      });

      // Si venía de una cotización vinculada que estaba rechazada, sincronizarla a Aceptada
      if (woToReactivate.quoteId) {
        try {
          const qRef = doc(db, "quotes", woToReactivate.quoteId);
          const qSnap = await getDoc(qRef);
          if (qSnap.exists() && qSnap.data().status === "Rechazada") {
            await updateDoc(qRef, {
              status: "Aceptada",
              wasReactivated: true,
              reactivatedBy: userName,
              reactivatedAt: nowIso,
              reactivationReason: `Reactivada desde OT ${woToReactivate.otNumber}: ${reasonText}`,
            });
          }
        } catch (syncErr) {
          console.warn("Error al sincronizar cotización con OT reactivada:", syncErr);
        }
      }

      toast({
        title: "¡OT Reactivada!",
        description: `La orden ${woToReactivate.otNumber} pasó a Pendiente y fue reincorporada a la operación y CxC.`,
      });
      setReactivateModalOpen(false);
      setWoToReactivate(null);
      setReactivateReason("");
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: `ordenes_de_trabajo/${woToReactivate.id}`, operation: "update" }));
    } finally {
      setIsSubmittingReactivate(false);
    }
  }, [woToReactivate, reactivateReason, user, userProfile, toast]);

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
      accessorKey: "quoteNumber",
      id: "quoteRef",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Cot. Origen <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.quoteNumber
        ? (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs font-mono font-semibold"
            onClick={() => router.push(`/admin/quotes?id=${row.original.quoteId}`)}>
            <LinkIcon className="mr-1 h-3 w-3" />{row.original.quoteNumber}
          </Button>
        )
        : <span className="text-muted-foreground text-xs">—</span>,
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
      cell: ({ row }) => <StatusBadge status={row.original.status} wo={row.original} onViewCancel={setViewCancelWo} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const wo = row.original;
        const validTransitions = getValidTransitions(wo.status);
        const isCancelled = wo.status === "Cancelada" || wo.status === "Cancelado";
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

              {isCancelled && (
                <>
                  <DropdownMenuItem onClick={() => setViewCancelWo(wo)} className="cursor-pointer text-destructive font-medium">
                    <AlertTriangle className="mr-2 h-4 w-4 text-destructive" /> Ver Motivo de Cancelación
                  </DropdownMenuItem>
                </>
              )}

              {/* Reactivar Orden (exclusivo para cuando está cancelada) */}
              {isCancelled && (userProfile?.role === "admin" || userProfile?.permissions?.work_orders) && (
                <>
                  <DropdownMenuItem 
                    onClick={() => { setWoToReactivate(wo); setReactivateReason(""); setReactivateModalOpen(true); }} 
                    className="cursor-pointer text-blue-600 dark:text-blue-400 font-semibold"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Reactivar Orden de Trabajo
                  </DropdownMenuItem>
                </>
              )}

              {/* Ver Historial de Auditoría si tiene cancelaciones o reactivaciones */}
              {(wo.reactivatedAt || (wo as any).wasReactivated || wo.cancellationReason) && !isCancelled && (
                <>
                  <DropdownMenuItem onClick={() => setViewAuditWo(wo)} className="cursor-pointer text-blue-600 dark:text-blue-400">
                    <RotateCcw className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" /> Ver Historial / Auditoría
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              {/* Descarga de PDF */}
              <DropdownMenuItem onClick={() => downloadPDF(wo)} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4 text-blue-600" /> Descargar PDF
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  disabled={validTransitions.length === 0}
                  className={validTransitions.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Cambiar Estado
                </DropdownMenuSubTrigger>
                {validTransitions.length > 0 && (
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
                      Desde: <StatusBadge status={wo.status} wo={wo} />
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {validTransitions.map((nextStatus) => {
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

              {/* Eliminar (ESTRICTAMENTE SOLO PARA ROL ADMIN) */}
              {userProfile?.role === "admin" && (
                <>
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
                          Esta acción no se puede deshacer. Se eliminará permanentemente la orden de trabajo de la base de datos.
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
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [handleDelete, handleStatusChange, userProfile, router]);

  const table = useReactTable({
    data: filteredWOs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase().trim();
      if (!search) return true;
      const wo = row.original;
      const otNum = (wo.otNumber || "").toLowerCase();
      const quoteNum = (wo.quoteNumber || "").toLowerCase();
      const client = (wo.clientName || "").toLowerCase();
      const tech = (wo.technician || "").toLowerCase();
      const service = (wo.tipoServicio || "").toLowerCase();
      const workType = (wo.tipoTrabajo || "").toLowerCase();
      const status = (wo.status || "").toLowerCase();
      const audit = `${(wo as any).wasReactivated || wo.reactivatedAt ? "reactivada reactivado" : ""} ${wo.reactivationReason || ""} ${wo.cancellationReason || ""}`.toLowerCase();
      const searchableText = `${otNum} ${quoteNum} ${client} ${tech} ${service} ${workType} ${status} ${audit}`;
      return search.split(/\s+/).filter(Boolean).every(t => searchableText.includes(t));
    },
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

      {/* Modal de Cancelación de OT con motivo y auditoría */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg">Cancelar {woToCancel?.otNumber}</DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Al cancelar esta orden de trabajo, se registrará tu usuario, fecha y motivo de cancelación. Además, se <strong>descartará automáticamente de Cuentas por Cobrar</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-semibold text-foreground">
                Motivo de la cancelación <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="Describe la razón por la cual se cancela esta orden de trabajo..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="min-h-[90px] text-sm"
              />
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
              <p>👤 <strong>Usuario:</strong> {userProfile?.displayName || user?.displayName || user?.email || "Usuario"}</p>
              <p>🕒 <strong>Fecha:</strong> {new Date().toLocaleString("es-MX")}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setCancelModalOpen(false); setWoToCancel(null); setCancelReason(""); }}
              disabled={isSubmittingCancel}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isSubmittingCancel || !cancelReason.trim()}
              className="gap-1.5"
            >
              {isSubmittingCancel && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Consultar Motivo de Cancelación */}
      <Dialog open={!!viewCancelWo} onOpenChange={(open) => { if (!open) setViewCancelWo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg">Detalle de Cancelación - {viewCancelWo?.otNumber}</DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Registro de auditoría y motivo por el cual esta orden de trabajo fue cancelada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-foreground space-y-1">
              <p className="font-semibold text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Motivo de Cancelación Registrado:
              </p>
              <p className="text-sm font-medium leading-relaxed pl-5">
                {viewCancelWo?.cancellationReason || "Sin motivo específico registrado."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl border">
              <div>
                <span className="font-semibold text-muted-foreground block">Cancelado por:</span>
                <span className="font-medium text-foreground">{viewCancelWo?.cancelledBy || "No especificado"}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block">Fecha y Hora:</span>
                <span className="font-medium text-foreground">
                  {viewCancelWo?.cancelledAt ? new Date(viewCancelWo.cancelledAt).toLocaleString("es-MX") : "No registrada"}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t">
                <span className="font-semibold text-muted-foreground block">Impacto Contable:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Descartada automáticamente de Cuentas por Cobrar
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCancelWo(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Confirmar Reactivación de la OT */}
      <Dialog open={reactivateModalOpen} onOpenChange={setReactivateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-lg">Reactivar {woToReactivate?.otNumber}</DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              La orden de trabajo pasará a estado <strong>Pendiente</strong>, se reincorporará a la operación y a <strong>Cuentas por Cobrar</strong>, y se sincronizará la cotización origen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reactivate-reason" className="text-xs font-semibold text-foreground">
                Nota o Motivo de Reactivación
              </Label>
              <Textarea
                id="reactivate-reason"
                placeholder="Ingresa la razón por la cual se reactiva esta orden de trabajo..."
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                className="min-h-[85px] text-sm"
              />
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
              <p>👤 <strong>Reactivado por:</strong> {userProfile?.displayName || user?.displayName || user?.email || "Usuario"}</p>
              <p>🕒 <strong>Fecha:</strong> {new Date().toLocaleString("es-MX")}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setReactivateModalOpen(false); setWoToReactivate(null); setReactivateReason(""); }}
              disabled={isSubmittingReactivate}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReactivate}
              disabled={isSubmittingReactivate}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmittingReactivate && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Reactivación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Consultar Historial y Auditoría de la OT */}
      <Dialog open={!!viewAuditWo} onOpenChange={(open) => { if (!open) setViewAuditWo(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle className="text-lg">Historial de Auditoría - {viewAuditWo?.otNumber}</DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Trazabilidad operativa y cambios de estado para {viewAuditWo?.clientName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {/* Evento 1: Creación */}
              <div className="relative">
                <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background" />
                <p className="text-xs font-semibold text-foreground">Orden de Trabajo Generada</p>
                <p className="text-[11px] text-muted-foreground">
                  Fecha: {viewAuditWo?.date ? new Date(viewAuditWo.date.replace(/-/g, "/")).toLocaleDateString("es-MX") : "N/A"} • Cotización Origen: {viewAuditWo?.quoteNumber || "Directa"}
                </p>
              </div>

              {/* Evento 2: Cancelación previa (si existió) */}
              {viewAuditWo?.cancellationReason && (
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-background" />
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Cancelación Registrada</p>
                  <p className="text-xs text-foreground bg-rose-50/80 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900 mt-1">
                    "{viewAuditWo.cancellationReason}"
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Cancelado por: {viewAuditWo.cancelledBy || "Usuario"} {viewAuditWo.cancelledAt ? `el ${new Date(viewAuditWo.cancelledAt).toLocaleString("es-MX")}` : ""}
                  </p>
                </div>
              )}

              {/* Evento 3: Reactivación */}
              {viewAuditWo?.reactivatedAt && (
                <div className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-background" />
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Orden Reactivada</p>
                  {viewAuditWo.reactivationReason && (
                    <p className="text-xs text-foreground bg-blue-50/80 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-200 dark:border-blue-900 mt-1">
                      "{viewAuditWo.reactivationReason}"
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Reactivado por: {viewAuditWo.reactivatedBy || "Usuario"} el {new Date(viewAuditWo.reactivatedAt).toLocaleString("es-MX")}
                  </p>
                </div>
              )}

              {/* Evento 4: Estado Actual */}
              <div className="relative">
                <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                <p className="text-xs font-semibold text-foreground">Estado Operativo Actual</p>
                <div className="pt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-300">
                    {viewAuditWo?.status}
                  </Badge>
                  {viewAuditWo?.technician && (
                    <span className="text-xs text-muted-foreground">Técnico: {viewAuditWo.technician}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAuditWo(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
