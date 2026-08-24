"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

import { 
  Loader2, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Download, 
  ChevronsUpDown, 
  Check, 
  Eraser, 
  ExternalLink,
  CreditCard,
  Calendar as CalendarIcon,
  ChevronDown,
  Eye,
  EyeOff,
  PlusCircle,
  History,
  FileText,
  Trash2,
  PhoneCall,
  CalendarCheck,
  Receipt,
  MessageSquare,
  Wrench,
  Building2,
  Filter,
  ListFilter,
  ArrowUpRight,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Percent,
  CalendarClock,
  Sparkles,
  Settings,
  Mail,
  Send,
  Save,
  SlidersHorizontal,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

import type { Quote, PaymentRecord, CollectionNote } from "@/components/admin/quote-manager";
import type { Client } from "@/components/admin/client-manager";
import type { WorkOrder } from "@/components/admin/work-order-manager";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  startOfQuarter, 
  endOfQuarter 
} from "date-fns";
import { es } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────

export type CxcUserPreferences = {
  defaultPeriod: "este_mes" | "mes_anterior" | "trimestre" | "este_ano" | "historico";
  showSummaryByDefault: boolean;
  defaultCreditDays: number;
  alertDaysBeforeDue: number;
  summarySendEmail?: string;
  summarySendFrequency?: "nunca" | "semanal" | "quincenal" | "mensual";
};

type UserProfile = {
  role: "admin" | "employee";
  displayName?: string;
  email?: string;
  permissions?: { [key: string]: boolean };
  cxcPreferences?: CxcUserPreferences;
};

const DEFAULT_CXC_PREFERENCES: CxcUserPreferences = {
  defaultPeriod: "historico",
  showSummaryByDefault: true,
  defaultCreditDays: 30,
  alertDaysBeforeDue: 7,
  summarySendEmail: "",
  summarySendFrequency: "mensual"
};

// ── Pure Top-Level Helpers ─────────────────────────────────────────────

function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined).filter(item => item !== undefined) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month, day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  const fallback = new Date(cleanStr);
  if (isNaN(fallback.getTime())) return null;
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

function getPeriodDateRange(period: "este_mes" | "mes_anterior" | "trimestre" | "este_ano" | "historico"): DateRange | undefined {
  const now = new Date();
  switch (period) {
    case "este_mes":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "mes_anterior": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "trimestre":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "este_ano":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "historico":
    default:
      return undefined;
  }
}

export default function CuentasPorCobrarPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // User Custom Preferences State
  const [preferences, setPreferences] = useState<CxcUserPreferences>(DEFAULT_CXC_PREFERENCES);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [tempPrefs, setTempPrefs] = useState<CxcUserPreferences>(DEFAULT_CXC_PREFERENCES);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // View state
  const [mainTab, setMainTab] = useState<"detalle" | "deudores">("detalle");
  const [showSummary, setShowSummary] = useState(true);

  // Period preset state
  const [activePeriod, setActivePeriod] = useState<"este_mes" | "mes_anterior" | "trimestre" | "este_ano" | "historico" | "personalizado">("historico");

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("Todos");
  const [responsableFilter, setResponsableFilter] = useState<string>("Todos");
  const [otFilter, setOtFilter] = useState<string>("Todas");
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Unified Modal State
  const [unifiedModalOpen, setUnifiedModalOpen] = useState(false);
  const [unifiedModalTab, setUnifiedModalTab] = useState<"abono" | "pagos" | "bitacora" | "factura">("abono");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // New Payment Form State
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"Transferencia" | "Efectivo" | "Cheque" | "Tarjeta" | "Otro">("Transferencia");
  const [payDate, setPayDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [payRef, setPayRef] = useState<string>("");
  const [payInvoice, setPayInvoice] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Collection Follow-up Note Form State
  const [noteText, setNoteText] = useState<string>("");
  const [notePromisedDate, setNotePromisedDate] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Edit Invoice & Custom Due Date State
  const [editInvoiceNum, setEditInvoiceNum] = useState<string>("");
  const [editCustomDueDate, setEditCustomDueDate] = useState<string>("");
  const [isSavingInvoiceDue, setIsSavingInvoiceDue] = useState(false);

  // PDF Comment Dialog State
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfComment, setPdfComment] = useState<string>("");

  // Load preferences from local storage and user profile
  useEffect(() => {
    if (!user) return;
    try {
      const localShowSummary = localStorage.getItem("cxc_show_summary_default");
      if (localShowSummary !== null) {
        setShowSummary(localShowSummary === "true");
      }
      const localPeriod = localStorage.getItem("cxc_default_period") as any;
      if (localPeriod && localPeriod !== "historico") {
        setActivePeriod(localPeriod);
        setDate(getPeriodDateRange(localPeriod));
      }
      const localStored = localStorage.getItem(`cxc_prefs_${user.uid}`);
      if (localStored) {
        const parsed = JSON.parse(localStored) as CxcUserPreferences;
        setPreferences(parsed);
      }
    } catch {
      // Ignore local storage error
    }
  }, [user]);

  // Session & Permissions check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setUserProfile(profile);

        const globalPrefs = (profile as any).preferences;
        if (globalPrefs) {
          const isSummaryVisible = globalPrefs.showExecutiveSummaryByDefault ?? globalPrefs.showSummaryByDefault ?? true;
          setShowSummary(isSummaryVisible);
          if (globalPrefs.defaultPeriod && globalPrefs.defaultPeriod !== "historico") {
            setActivePeriod(globalPrefs.defaultPeriod);
            setDate(getPeriodDateRange(globalPrefs.defaultPeriod));
          }
        } else if (profile.cxcPreferences) {
          const userPrefs = { ...DEFAULT_CXC_PREFERENCES, ...profile.cxcPreferences };
          setPreferences(userPrefs);
          setShowSummary(userPrefs.showSummaryByDefault ?? true);
          if (userPrefs.defaultPeriod && activePeriod === "historico") {
            setActivePeriod(userPrefs.defaultPeriod);
            setDate(getPeriodDateRange(userPrefs.defaultPeriod));
          }
        } else if (!preferences.summarySendEmail) {
          setPreferences(prev => ({ ...prev, summarySendEmail: profile.email || user.email || "" }));
        }

        if (
          profile.role !== "admin" && 
          !profile.permissions?.reports && 
          !profile.permissions?.quotes && 
          !profile.permissions?.accounts_receivable
        ) {
          router.push("/admin");
        }
      }
    });
    return () => unsub();
  }, [user, authLoading, router]);

  // Real-time data subscription
  useEffect(() => {
    if (!userProfile) return;
    setIsLoading(true);

    const unsubs: (() => void)[] = [];

    // Subscribe to quotes
    unsubs.push(
      onSnapshot(
        collection(db, "quotes"),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
          setQuotes(data);
          setIsLoading(false);
        },
        () => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "quotes", operation: "list" }));
          setIsLoading(false);
        }
      )
    );

    // Subscribe to clients
    unsubs.push(
      onSnapshot(
        collection(db, "clients"),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
          setClients(data);
        },
        () => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "clients", operation: "list" }));
        }
      )
    );

    // Subscribe to work orders
    unsubs.push(
      onSnapshot(
        collection(db, "ordenes_de_trabajo"),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
          setWorkOrders(data);
        },
        () => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "ordenes_de_trabajo", operation: "list" }));
        }
      )
    );

    // Subscribe to users for Puesto and Departamento lookups
    unsubs.push(
      onSnapshot(
        collection(db, "users"),
        (snap) => {
          const data = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
          setUsersList(data);
        },
        () => {
          // Non-blocking fallback
        }
      )
    );

    return () => unsubs.forEach(unsub => unsub());
  }, [userProfile]);

  // Map of users -> { jobTitle, department, displayName }
  const usersMap = useMemo(() => {
    const map = new Map<string, { displayName?: string; jobTitle?: string; department?: string }>();
    usersList.forEach(u => {
      if (u.uid) map.set(u.uid, u);
      if (u.displayName) map.set(u.displayName.trim().toLowerCase(), u);
    });
    return map;
  }, [usersList]);

  // Map of client name -> client details
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => {
      if (c.name) {
        map.set(c.name.trim().toLowerCase(), c);
      }
    });
    return map;
  }, [clients]);

  // Map of quoteId / quoteNumber -> WorkOrder
  const workOrdersByQuoteMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach(ot => {
      if (ot.quoteId) {
        map.set(ot.quoteId, ot);
      }
      if (ot.quoteNumber) {
        map.set(ot.quoteNumber, ot);
      }
    });
    return map;
  }, [workOrders]);

  // Comprehensive Quote Financial, Overdue & WorkOrder calculations
  const getQuoteCalculations = useMemo(() => {
    return (q: Quote) => {
      const totalVal = round2(q.total || 0);

      // Calculate paid amount from payments array or fallback
      let paidVal = 0;
      if (q.status === "Pagada") {
        paidVal = totalVal;
      } else if (Array.isArray(q.payments) && q.payments.length > 0) {
        paidVal = round2(q.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
      } else if (q.paidAmount !== undefined && q.paidAmount !== null) {
        paidVal = round2(Number(q.paidAmount));
      }

      let pendingVal = round2(Math.max(0, totalVal - paidVal));
      const isFullyPaid = pendingVal <= 0.01 || q.status === "Pagada";
      if (isFullyPaid) {
        pendingVal = 0;
        paidVal = totalVal;
      }
      const hasPartialPayment = paidVal > 0 && !isFullyPaid;

      // Credit days & due date calculation
      const clientKey = q.clientName?.trim().toLowerCase();
      const client = clientKey ? clientMap.get(clientKey) : undefined;
      const creditDays = (client?.diasCredito !== undefined && client?.diasCredito !== null && !isNaN(Number(client.diasCredito)))
        ? Number(client.diasCredito)
        : (preferences.defaultCreditDays || 30);

      let expirationDate: Date | null = null;
      let daysOverdue = 0;

      if (q.customDueDate) {
        expirationDate = parseDateSafe(q.customDueDate);
      } else {
        let baseDate = parseDateSafe(q.acceptedDate || q.date);
        if (!baseDate && q.history) {
          const acceptEntry = q.history.find(
            h => h.snapshot?.status === "Aceptada" || h.snapshot?.status === "Pagada"
          );
          if (acceptEntry) {
            baseDate = parseDateSafe(acceptEntry.updatedAt);
          }
        }
        if (!baseDate) {
          baseDate = parseDateSafe(q.date) || new Date();
          baseDate.setHours(0, 0, 0, 0);
        }

        if (baseDate) {
          expirationDate = new Date(baseDate.getTime());
          expirationDate.setDate(expirationDate.getDate() + creditDays);
          expirationDate.setHours(0, 0, 0, 0);
        }
      }

      if (expirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - expirationDate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (isNaN(daysOverdue)) daysOverdue = 0;
      }

      const alertThreshold = preferences.alertDaysBeforeDue || 7;

      // Payment Status badge construction
      let paymentStatus = {
        label: "Al corriente",
        color: "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      };

      if (isFullyPaid) {
        paymentStatus = {
          label: "Pagada / Liquidada",
          color: "text-muted-foreground border-border bg-muted/50",
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
        };
      } else if (hasPartialPayment) {
        if (daysOverdue > 0) {
          paymentStatus = {
            label: `Abonada - Vencida (${daysOverdue}d)`,
            color: "text-red-700 dark:text-red-300 border-red-500/30 bg-red-500/10 font-bold",
            icon: <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          };
        } else if (daysOverdue >= -alertThreshold) {
          const daysToDue = Math.abs(daysOverdue);
          paymentStatus = {
            label: `Abonada - Por vencer (${daysToDue === 0 ? "hoy" : daysToDue + "d"})`,
            color: "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 font-semibold",
            icon: <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          };
        } else {
          paymentStatus = {
            label: "Abonada (En plazo)",
            color: "text-blue-700 dark:text-blue-300 border-blue-500/30 bg-blue-500/10",
            icon: <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          };
        }
      } else {
        if (daysOverdue > 0) {
          paymentStatus = {
            label: `Vencida (${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'})`,
            color: "text-red-700 dark:text-red-300 border-red-500/30 bg-red-500/10 font-bold",
            icon: <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          };
        } else if (daysOverdue >= -alertThreshold) {
          const daysToDue = Math.abs(daysOverdue);
          paymentStatus = {
            label: daysToDue === 0 ? "Vence hoy" : `Por vencer (${daysToDue} ${daysToDue === 1 ? 'día' : 'días'})`,
            color: "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 font-semibold",
            icon: <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          };
        } else {
          paymentStatus = {
            label: "Al corriente",
            color: "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
            icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          };
        }
      }

      // Breakdown Subtotal & IVA
      const ivaPercentage = q.iva ?? 16;
      const subtotalVal = round2(q.subtotal || (totalVal / (1 + ivaPercentage / 100)));
      const ivaAmountVal = round2(totalVal - subtotalVal);

      // Linked Work Order
      const linkedOt = workOrdersByQuoteMap.get(q.id) || (q.quoteNumber ? workOrdersByQuoteMap.get(q.quoteNumber) : undefined);

      // High-Value Business Indicators
      const isOtDone = linkedOt?.status === "Completada" || linkedOt?.status === "Completado";
      const hasInvoice = !!q.invoiceNumber?.trim();
      const isOtCompletedWithoutInvoice = isOtDone && !hasInvoice && !isFullyPaid;

      // Active Promised Payment in notes
      let latestPromisedDate: string | undefined = undefined;
      if (Array.isArray(q.collectionNotes)) {
        const noteWithPromise = q.collectionNotes.find(n => !!n.promisedPaymentDate);
        if (noteWithPromise) {
          latestPromisedDate = noteWithPromise.promisedPaymentDate;
        }
      }

      return {
        creditDays,
        expirationDate,
        daysOverdue,
        paymentStatus,
        subtotal: subtotalVal,
        ivaAmount: ivaAmountVal,
        total: totalVal,
        paidAmount: paidVal,
        pendingAmount: pendingVal,
        isFullyPaid,
        hasPartialPayment,
        linkedOt,
        isOtCompletedWithoutInvoice,
        latestPromisedDate
      };
    };
  }, [clientMap, workOrdersByQuoteMap, preferences]);

  // List of clients with active debts
  const clientsWithDebts = useMemo(() => {
    const names = new Set(
      quotes
        .filter(q => q.status === "Aceptada" || q.status === "Pagada")
        .map(q => q.clientName)
        .filter(Boolean)
    );
    return Array.from(names).sort();
  }, [quotes]);

  // Unique service types and sales responsibles
  const uniqueServiceTypes = useMemo(() => {
    const types = new Set(
      quotes
        .filter(q => q.status === "Aceptada" || q.status === "Pagada")
        .map(q => q.tipoServicio)
        .filter((t): t is string => !!t)
    );
    return Array.from(types).sort();
  }, [quotes]);

  const uniqueResponsables = useMemo(() => {
    const list = new Set(
      quotes
        .filter(q => q.status === "Aceptada" || q.status === "Pagada")
        .map(q => q.responsable)
        .filter((r): r is string => !!r)
    );
    return Array.from(list).sort();
  }, [quotes]);

  const isGlobalCobranza = Boolean(
    !userProfile ||
    userProfile.role === "admin" ||
    userProfile.permissions?.accounts_receivable_all ||
    (userProfile.permissions?.accounts_receivable && !userProfile.permissions?.accounts_receivable_own) ||
    (userProfile.permissions?.cuentas_por_cobrar && !userProfile.permissions?.accounts_receivable_own)
  );

  // Quick Preset Counts
  const presetCounts = useMemo(() => {
    let vencidas = 0;
    let porVencer = 0;
    let pendientes = 0;
    let liquidadas = 0;
    let conOt = 0;
    let otSinFactura = 0;
    let conPromesa = 0;
    let total = 0;

    quotes.forEach(q => {
      if (q.status !== "Aceptada" && q.status !== "Pagada") return;
      if (!isGlobalCobranza && user && q.userId !== user.uid) return;
      total++;
      const { daysOverdue, isFullyPaid, linkedOt, isOtCompletedWithoutInvoice, latestPromisedDate } = getQuoteCalculations(q);

      if (linkedOt) conOt++;
      if (isOtCompletedWithoutInvoice) otSinFactura++;
      if (!isFullyPaid && latestPromisedDate) conPromesa++;

      if (isFullyPaid) {
        liquidadas++;
      } else {
        pendientes++;
        if (daysOverdue > 0) {
          vencidas++;
        } else if (daysOverdue >= -(preferences.alertDaysBeforeDue || 7)) {
          porVencer++;
        }
      }
    });

    return { vencidas, porVencer, pendientes, liquidadas, conOt, otSinFactura, conPromesa, total };
  }, [quotes, getQuoteCalculations, preferences, isGlobalCobranza, user]);

  // Filter quotes based on search, client, service, responsable, OT, date, and status
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      // BASE FILTER: Solo cotizaciones aceptadas o pagadas aparecen en CxC
      if (q.status !== "Aceptada" && q.status !== "Pagada") return false;

      // If user is a salesperson without global accounts_receivable permission, only show their own quotes
      if (!isGlobalCobranza && user && q.userId !== user.uid) {
        return false;
      }
      const { daysOverdue, isFullyPaid, hasPartialPayment, linkedOt, isOtCompletedWithoutInvoice, latestPromisedDate } = getQuoteCalculations(q);
      const alertThreshold = preferences.alertDaysBeforeDue || 7;

      // 1. Status Filter
      if (statusFilter === "Todos") {
        if (isFullyPaid) return false;
      } else if (statusFilter === "Con Abonos") {
        if (!hasPartialPayment) return false;
      } else if (statusFilter === "Sin Abonos") {
        if (hasPartialPayment || isFullyPaid) return false;
      } else if (statusFilter === "Al corriente") {
        if (isFullyPaid || daysOverdue > 0 || daysOverdue >= -alertThreshold) return false;
      } else if (statusFilter === "Por vencer") {
        if (isFullyPaid || daysOverdue > 0 || daysOverdue < -alertThreshold) return false;
      } else if (statusFilter === "Vencida") {
        if (isFullyPaid || daysOverdue <= 0) return false;
      } else if (statusFilter === "OT Sin Factura") {
        if (!isOtCompletedWithoutInvoice) return false;
      } else if (statusFilter === "Con Promesa") {
        if (isFullyPaid || !latestPromisedDate) return false;
      } else if (statusFilter === "Pagadas (Referencia)") {
        if (!isFullyPaid) return false;
      } else if (statusFilter === "Todas (Historial)") {
        if (q.status !== "Aceptada" && q.status !== "Pagada") return false;
      }

      // 2. Work Order (OT) Filter
      if (otFilter === "Con OT" && !linkedOt) return false;
      if (otFilter === "Sin OT" && linkedOt) return false;
      if (otFilter === "OT Completada" && linkedOt?.status !== "Completada" && linkedOt?.status !== "Completado") return false;
      if (otFilter === "OT En Proceso" && linkedOt?.status !== "En Proceso") return false;
      if (otFilter === "OT Pendiente" && linkedOt?.status !== "Pendiente" && linkedOt?.status !== "Asignada") return false;

      // 3. Client Filter
      if (selectedClient && q.clientName !== selectedClient) {
        return false;
      }

      // 4. Service Type Filter
      if (serviceTypeFilter !== "Todos" && q.tipoServicio !== serviceTypeFilter) {
        return false;
      }

      // 5. Responsable Filter
      if (responsableFilter !== "Todos" && q.responsable !== responsableFilter) {
        return false;
      }

      // 6. Date Range Filter (Filtered by period / calendar)
      if (date?.from) {
        const fromDate = new Date(date.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = date.to ? new Date(date.to) : new Date(date.from);
        toDate.setHours(23, 59, 59, 999);

        let quoteDate = parseDateSafe(q.acceptedDate || q.date);
        if (!quoteDate && q.history) {
          const acceptEntry = q.history.find(h => h.snapshot?.status === "Aceptada" || h.snapshot?.status === "Pagada");
          if (acceptEntry) quoteDate = parseDateSafe(acceptEntry.updatedAt);
        }
        if (!quoteDate) quoteDate = parseDateSafe(q.date);

        if (quoteDate) {
          if (quoteDate < fromDate || quoteDate > toDate) return false;
        } else {
          return false;
        }
      }

      // 7. Search query (Quote #, OT #, Client, Invoice #, Technician, Service, Responsable)
      if (searchQuery) {
        const queryVal = searchQuery.toLowerCase();
        const matchNo = q.quoteNumber?.toLowerCase().includes(queryVal);
        const matchClient = q.clientName?.toLowerCase().includes(queryVal);
        const matchInvoice = q.invoiceNumber?.toLowerCase().includes(queryVal);
        const matchOtNo = linkedOt?.otNumber?.toLowerCase().includes(queryVal);
        const matchTech = linkedOt?.technician?.toLowerCase().includes(queryVal);
        const matchService = q.tipoServicio?.toLowerCase().includes(queryVal);
        const matchResp = q.responsable?.toLowerCase().includes(queryVal);
        if (!matchNo && !matchClient && !matchInvoice && !matchOtNo && !matchTech && !matchService && !matchResp) return false;
      }

      return true;
    });
  }, [quotes, statusFilter, otFilter, selectedClient, serviceTypeFilter, responsableFilter, date, searchQuery, getQuoteCalculations, preferences, isGlobalCobranza, user]);

  // Financial KPIs & Executive Statistics
  const stats = useMemo(() => {
    let totalCartera = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalVencido = 0;
    const clientesVencidos = new Set<string>();
    let totalDiasRetraso = 0;
    let countVencidos = 0;

    let otCompletedWithoutInvoiceCount = 0;
    let otCompletedWithoutInvoiceAmount = 0;

    let promesasCount = 0;
    let promesasAmount = 0;

    let aging = {
      corriente: 0,
      r1_30: 0,
      r31_60: 0,
      r61_90: 0,
      r90_plus: 0
    };

    const serviceBreakdown = new Map<string, number>();

    quotes.forEach(q => {
      if (q.status !== "Aceptada" && q.status !== "Pagada") return;
      if (!isGlobalCobranza && user && q.userId !== user.uid) return;
      const { 
        total, 
        paidAmount, 
        pendingAmount, 
        daysOverdue, 
        isFullyPaid, 
        isOtCompletedWithoutInvoice,
        latestPromisedDate 
      } = getQuoteCalculations(q);

      totalCartera += total;
      totalCobrado += paidAmount;

      if (isOtCompletedWithoutInvoice) {
        otCompletedWithoutInvoiceCount += 1;
        otCompletedWithoutInvoiceAmount += pendingAmount;
      }

      if (!isFullyPaid && latestPromisedDate) {
        promesasCount += 1;
        promesasAmount += pendingAmount;
      }

      if (!isFullyPaid) {
        totalPendiente += pendingAmount;

        // Aging classification
        if (daysOverdue <= 0) {
          aging.corriente += pendingAmount;
        } else if (daysOverdue <= 30) {
          aging.r1_30 += pendingAmount;
        } else if (daysOverdue <= 60) {
          aging.r31_60 += pendingAmount;
        } else if (daysOverdue <= 90) {
          aging.r61_90 += pendingAmount;
        } else {
          aging.r90_plus += pendingAmount;
        }

        if (daysOverdue > 0) {
          totalVencido += pendingAmount;
          if (q.clientName) clientesVencidos.add(q.clientName.trim());
          totalDiasRetraso += daysOverdue;
          countVencidos += 1;
        }

        // Service breakdown
        const sType = q.tipoServicio || "Sin clasificar";
        serviceBreakdown.set(sType, (serviceBreakdown.get(sType) || 0) + pendingAmount);
      }
    });

    totalCartera = round2(totalCartera);
    totalCobrado = round2(totalCobrado);
    totalPendiente = round2(totalPendiente);
    totalVencido = round2(totalVencido);
    otCompletedWithoutInvoiceAmount = round2(otCompletedWithoutInvoiceAmount);
    promesasAmount = round2(promesasAmount);

    const promedioRetraso = countVencidos > 0 ? totalDiasRetraso / countVencidos : 0;
    const efectividadCobro = totalCartera > 0 ? round2((totalCobrado / totalCartera) * 100) : 0;
    const dsoEstimado = totalCartera > 0 ? Math.round((totalPendiente / totalCartera) * 90) : 0;

    return {
      totalCartera,
      totalCobrado,
      totalPendiente,
      totalVencido,
      efectividadCobro,
      dsoEstimado,
      otCompletedWithoutInvoiceCount,
      otCompletedWithoutInvoiceAmount,
      promesasCount,
      promesasAmount,
      clientesVencidosCount: clientesVencidos.size,
      vencidasCount: countVencidos,
      promedioRetraso,
      aging,
      serviceBreakdown: Array.from(serviceBreakdown.entries()).map(([name, amount]) => ({ name, amount: round2(amount) }))
    };
  }, [quotes, getQuoteCalculations, isGlobalCobranza, user]);

  // Executive Client Debt Summary ("Quién Debe y Quién No")
  const clientDebtsSummary = useMemo(() => {
    const map = new Map<string, {
      clientName: string;
      phone?: string;
      email?: string;
      creditDays: number;
      totalQuotesCount: number;
      totalOtCount: number;
      totalAmount: number;
      totalPaid: number;
      totalPending: number;
      totalOverdue: number;
      maxDaysOverdue: number;
      overdueQuotesCount: number;
      pendingQuotesCount: number;
    }>();

    quotes.forEach(q => {
      if (q.status !== "Aceptada" && q.status !== "Pagada") return;
      if (!isGlobalCobranza && user && q.userId !== user.uid) return;
      const cName = q.clientName?.trim() || "Sin Cliente";
      const calcs = getQuoteCalculations(q);

      const existing = map.get(cName) || {
        clientName: cName,
        phone: q.clientPhone,
        email: q.clientEmail,
        creditDays: calcs.creditDays,
        totalQuotesCount: 0,
        totalOtCount: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
        maxDaysOverdue: 0,
        overdueQuotesCount: 0,
        pendingQuotesCount: 0
      };

      existing.totalQuotesCount += 1;
      if (calcs.linkedOt) existing.totalOtCount += 1;
      existing.totalAmount = round2(existing.totalAmount + calcs.total);
      existing.totalPaid = round2(existing.totalPaid + calcs.paidAmount);
      existing.totalPending = round2(existing.totalPending + calcs.pendingAmount);

      if (!calcs.isFullyPaid) {
        existing.pendingQuotesCount += 1;
        if (calcs.daysOverdue > 0) {
          existing.totalOverdue = round2(existing.totalOverdue + calcs.pendingAmount);
          existing.overdueQuotesCount += 1;
          if (calcs.daysOverdue > existing.maxDaysOverdue) {
            existing.maxDaysOverdue = calcs.daysOverdue;
          }
        }
      }

      map.set(cName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [quotes, getQuoteCalculations, isGlobalCobranza, user]);

  // Top 5 Critical Debtors for Executives
  const topCriticalDebtors = useMemo(() => {
    return clientDebtsSummary
      .filter(c => c.totalPending > 0)
      .sort((a, b) => (b.totalOverdue - a.totalOverdue) || (b.totalPending - a.totalPending))
      .slice(0, 5);
  }, [clientDebtsSummary]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1;
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuotes.slice(start, start + itemsPerPage);
  }, [filteredQuotes, currentPage, itemsPerPage]);

  const hasActiveFilters = searchQuery !== "" || selectedClient !== null || statusFilter !== "Todos" || serviceTypeFilter !== "Todos" || responsableFilter !== "Todos" || otFilter !== "Todas" || date !== undefined;

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedClient(null);
    setStatusFilter("Todos");
    setServiceTypeFilter("Todos");
    setResponsableFilter("Todos");
    setOtFilter("Todas");
    setDate(undefined);
    setActivePeriod("historico");
    setCurrentPage(1);
  };

  const handleViewClientAccounts = (clientName: string) => {
    setSelectedClient(clientName);
    setStatusFilter("Todas (Historial)");
    setDate(undefined);
    setActivePeriod("historico");
    setSearchQuery("");
    setOtFilter("Todas");
    setServiceTypeFilter("Todos");
    setResponsableFilter("Todos");
    setCurrentPage(1);
    setMainTab("detalle");
    setTimeout(() => {
      const tableElem = document.getElementById("cuentas-table-container");
      if (tableElem) {
        tableElem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const getOtBadgeStyle = (status?: string) => {
    switch (status) {
      case "Completada":
      case "Completado":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
      case "En Proceso":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "Asignada":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20";
      case "En Espera":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      case "Pendiente":
        return "bg-muted text-muted-foreground border-border";
      case "Cancelada":
      case "Cancelado":
        return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Currency Formatter Helper
  const fmt = (num: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2
    }).format(num);
  };

  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const cleanStr = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
      const parts = cleanStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatExDate = (dateObj?: Date | null) => {
    if (!dateObj) return "—";
    try {
      return dateObj.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch {
      return "—";
    }
  };

  // Export to Excel with Extended Executive Metrics
  const handleDownloadExcel = () => {
    const dataToExport = filteredQuotes.map(q => {
      const { expirationDate, daysOverdue, paymentStatus, subtotal, ivaAmount, total, paidAmount, pendingAmount, linkedOt, isOtCompletedWithoutInvoice, latestPromisedDate } = getQuoteCalculations(q);
      
      const lastNote = q.collectionNotes && q.collectionNotes.length > 0 ? q.collectionNotes[0] : null;

      return {
        "No. Cotización": q.quoteNumber || "—",
        "Orden de Trabajo (OT)": linkedOt?.otNumber || "—",
        "Estado OT": linkedOt?.status || "Sin OT",
        "Técnico OT": linkedOt?.technician || "—",
        "No. Factura": q.invoiceNumber || "—",
        "Cliente": q.clientName || "—",
        "Tipo de Servicio": q.tipoServicio || "—",
        "Responsable": q.responsable || "—",
        "Subtotal": subtotal,
        "IVA": ivaAmount,
        "Total Cotizado": total,
        "Monto Abonado": paidAmount,
        "Saldo Pendiente": pendingAmount,
        "Fecha Emisión": q.date ? formatDateStr(q.date) : "—",
        "Fecha Vencimiento": expirationDate ? formatExDate(expirationDate) : "—",
        "Días Vencidos": daysOverdue > 0 ? daysOverdue : (q.status === "Pagada" ? "—" : 0),
        "Estado de Pago": paymentStatus.label,
        "Alerta Operativa": isOtCompletedWithoutInvoice ? "OT Completada sin Factura" : "—",
        "Promesa de Pago": latestPromisedDate ? formatDateStr(latestPromisedDate) : "—",
        "Último Seguimiento": lastNote ? `${lastNote.date}: ${lastNote.note}` : "—",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle CxC");

    if (userProfile?.role === "admin") {
      const summaryData = [
        ["RESUMEN EJECUTIVO DE CUENTAS POR COBRAR - LEBAREF"],
        [],
        ["Indicador Financiero", "Valor"],
        ["Total Cartera Emitida", stats.totalCartera],
        ["Total Cobrado / Abonado", stats.totalCobrado],
        ["Saldo Pendiente por Cobrar", stats.totalPendiente],
        ["Monto Vencido Pendiente", stats.totalVencido],
        ["Efectividad de Cobranza (%)", `${stats.efectividadCobro}%`],
        ["Días Promedio de Cobro (DSO Est.)", `${stats.dsoEstimado} días`],
        ["Clientes en Mora", stats.clientesVencidosCount],
        ["Retraso Promedio de Mora", `${Math.round(stats.promedioRetraso)} días`],
        ["OTs Completadas Sin Factura (Monto)", stats.otCompletedWithoutInvoiceAmount],
        ["OTs Completadas Sin Factura (Cantidad)", stats.otCompletedWithoutInvoiceCount],
        ["Cobranza Comprometida (Promesas)", stats.promesasAmount],
        [],
        ["ANTIGÜEDAD DE SALDOS (AGING)"],
        ["Brackets", "Monto Pendiente"],
        ["Al corriente", stats.aging.corriente],
        ["1 a 30 días", stats.aging.r1_30],
        ["31 a 60 días", stats.aging.r31_60],
        ["61 a 90 días", stats.aging.r61_90],
        ["Más de 90 días", stats.aging.r90_plus],
        [],
        ["DEUDA POR LÍNEA DE NEGOCIO"],
        ["Línea de Servicio", "Saldo Pendiente"]
      ];

      stats.serviceBreakdown.forEach(s => {
        summaryData.push([s.name, s.amount]);
      });

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumen Ejecutivo");
    }

    XLSX.writeFile(workbook, `Reporte_Cuentas_Por_Cobrar_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // Build default PDF comment based on active filters
  const buildDefaultComment = () => {
    const todayStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const parts: string[] = [];
    parts.push(`Reporte ejecutivo de cartera generado el ${todayStr}.`);
    if (selectedClient) parts.push(`Cliente filtrado: ${selectedClient}.`);
    if (serviceTypeFilter !== "Todos") parts.push(`Tipo de servicio: ${serviceTypeFilter}.`);
    if (statusFilter !== "Todos") parts.push(`Estado de cartera: ${statusFilter}.`);
    if (otFilter !== "Todas") parts.push(`Filtro OT: ${otFilter}.`);
    if (date?.from) {
      const from = format(date.from, "d MMM yyyy", { locale: es });
      const to = date.to ? format(date.to, "d MMM yyyy", { locale: es }) : from;
      parts.push(`Período: del ${from} al ${to}.`);
    }
    parts.push(`Total de registros en este reporte: ${filteredQuotes.length}.`);
    return parts.join(" ");
  };

  const openPdfDialog = () => {
    setPdfComment(buildDefaultComment());
    setPdfDialogOpen(true);
  };

  // Export to PDF (Customized via User Preferences)
  const handleDownloadPDF = (comment: string) => {
    const doc = new jsPDF("l", "mm", "a4");
    const todayStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const primaryColor: [number, number, number] = [30, 62, 98]; // #1e3e62
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;

    // Check user document preferences
    const includeMetrics = (preferences as any).includeMetricsInPdfReport === true || 
      (userProfile as any)?.preferences?.includeMetricsInPdfReport === true || 
      localStorage.getItem("cxc_include_metrics_pdf") === "true";
    
    const includeLogo = (preferences as any).includeLogoInPdfReport !== false && 
      (userProfile as any)?.preferences?.includeLogoInPdfReport !== false && 
      localStorage.getItem("cxc_include_logo_pdf") !== "false";

    const includeFilters = (preferences as any).includeFiltersInPdfReport !== false && 
      (userProfile as any)?.preferences?.includeFiltersInPdfReport !== false && 
      localStorage.getItem("cxc_include_filters_pdf") !== "false";

    const drawHeader = () => {
      // Official Corporate Logo (if enabled)
      if (includeLogo) {
        doc.addImage(LOGO_BASE64, "PNG", 14, 5, 36, 20.2);
      }

      const textLeft = includeLogo ? 56 : 14;

      // Title & Subtitle
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 62, 98);
      doc.text("REPORTE DE CUENTAS POR COBRAR", textLeft, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("LEBAREF SERVICIO DE MANTENIMIENTO GENERAL", textLeft, 19);
      doc.text(`Fecha de emisión: ${todayStr} | Moneda: MXN`, textLeft, 24);

      // Company Contact Info (Right aligned)
      doc.setFontSize(7);
      doc.setTextColor(90, 100, 110);
      doc.text("Calle 33 No. 259 Num int 2 por 12 y 14 Col. Santa María Chuburna", pageW - 14, 11, { align: "right" });
      doc.text("CP. 97138, Mérida, Yucatán | Tel: 990 101 0387", pageW - 14, 16, { align: "right" });
      doc.text("corporativo@lebaref.com", pageW - 14, 21, { align: "right" });

      // Decorative separator line
      doc.setDrawColor(30, 62, 98);
      doc.setLineWidth(0.8);
      doc.line(14, 28, pageW - 14, 28);
    };

    drawHeader();

    let startY = 32;

    // Financial KPI Summary Boxes (ONLY rendered if explicitly enabled in user preferences)
    if (includeMetrics) {
      const cardW = (pageW - 28 - 9) / 4;
      const cardH = 13;
      const cardY = 31;

      // 1. Cartera Total
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, cardY, cardW, cardH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(100, 116, 139);
      doc.text("CARTERA TOTAL", 18, cardY + 4.5);
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(30, 41, 59);
      doc.text(fmt(stats.totalCartera), 18, cardY + 10);

      // 2. Total Cobrado
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(14 + cardW + 3, cardY, cardW, cardH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(22, 101, 52);
      doc.text("TOTAL COBRADO", 18 + cardW + 3, cardY + 4.5);
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(21, 128, 61);
      doc.text(fmt(stats.totalCobrado), 18 + cardW + 3, cardY + 10);

      // 3. Saldo Pendiente
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(14 + (cardW + 3) * 2, cardY, cardW, cardH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(30, 64, 175);
      doc.text("SALDO PENDIENTE", 18 + (cardW + 3) * 2, cardY + 4.5);
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(29, 78, 216);
      doc.text(fmt(stats.totalPendiente), 18 + (cardW + 3) * 2, cardY + 10);

      // 4. Monto en Mora
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(14 + (cardW + 3) * 3, cardY, cardW, cardH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(153, 27, 27);
      doc.text("SALDO EN MORA", 18 + (cardW + 3) * 3, cardY + 4.5);
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(185, 28, 28);
      doc.text(fmt(stats.totalVencido), 18 + (cardW + 3) * 3, cardY + 10);

      startY = cardY + cardH + 5;
    }

    // Active filters summary
    if (includeFilters) {
      const filterParts: string[] = [];
      if (selectedClient) filterParts.push(`Cliente: ${selectedClient}`);
      if (serviceTypeFilter !== "Todos") filterParts.push(`Servicio: ${serviceTypeFilter}`);
      if (statusFilter !== "Todos") filterParts.push(`Estado: ${statusFilter}`);
      if (otFilter !== "Todas") filterParts.push(`OT: ${otFilter}`);
      if (date?.from) {
        const from = format(date.from, "d MMM yyyy", { locale: es });
        const to = date.to ? format(date.to, "d MMM yyyy", { locale: es }) : from;
        filterParts.push(`Período: ${from} – ${to}`);
      }
      const filterText = filterParts.length > 0 ? `Filtros aplicados: ${filterParts.join(" | ")}` : "Todos los registros de cartera sin filtros restrictivos";
      doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(100, 116, 139);
      doc.text(filterText, 14, startY);
      startY += 4;
    }

    // Optional comment
    if (comment.trim()) {
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(`Nota: ${comment.trim()}`, pageW - 28);
      doc.text(lines, 14, startY);
      startY += lines.length * 3.8 + 3;
    }

    // Main data table
    const tableData = filteredQuotes.map((q) => {
      const { expirationDate, daysOverdue, paymentStatus, total, paidAmount, pendingAmount, linkedOt } = getQuoteCalculations(q);
      return [
        q.quoteNumber || "—",
        linkedOt?.otNumber || "—",
        q.invoiceNumber || "—",
        q.clientName || "—",
        q.tipoServicio || "—",
        fmt(total),
        fmt(paidAmount),
        fmt(pendingAmount),
        q.date ? formatDateStr(q.date) : "—",
        expirationDate ? formatExDate(expirationDate) : "—",
        daysOverdue > 0 ? `${daysOverdue}d` : "—",
        paymentStatus.label,
      ];
    });

    autoTable(doc, {
      startY,
      margin: { top: 32, bottom: 14, left: 14, right: 14 },
      head: [["Folio", "OT", "Factura", "Cliente", "Servicio", "Total", "Abonado", "Pendiente", "Emisión", "Vencimiento", "Mora", "Estado"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 18 }, // Folio
        1: { cellWidth: 22 }, // OT (evita cortes como OT00-000 \n 1)
        2: { cellWidth: 20 }, // Factura
        3: { cellWidth: 42 }, // Cliente
        4: { cellWidth: 20 }, // Servicio
        5: { cellWidth: 22, halign: "right" }, // Total
        6: { cellWidth: 22, halign: "right" }, // Abonado
        7: { cellWidth: 22, halign: "right" }, // Pendiente
        8: { cellWidth: 19 }, // Emisión
        9: { cellWidth: 23 }, // Vencimiento (evita corte Vencimien \n to)
        10: { cellWidth: 12, halign: "center" }, // Mora
        11: { cellWidth: 27 }, // Estado
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawHeader();
        }
      },
    });

    // Footer on every page
    const totalPagesCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPagesCount; i++) {
      doc.setPage(i);
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageH - 9, pageW, 9, "F");
      doc.setFontSize(6.5).setTextColor(120).setFont("helvetica", "normal");
      doc.text(
        `LEBAREF | Reporte Ejecutivo de Cuentas por Cobrar — Fecha: ${todayStr} | Documento Oficial de Control Interno | Página ${i} de ${totalPagesCount}`,
        pageW / 2,
        pageH - 3.5,
        { align: "center" }
      );
    }

    doc.save(`Reporte_CxC_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // Open Unified Payment & Management Modal
  const handleOpenUnifiedModal = (quote: Quote, initialTab: "abono" | "pagos" | "bitacora" | "factura" = "abono") => {
    setSelectedQuote(quote);
    const calcs = getQuoteCalculations(quote);
    setPayAmount(calcs.pendingAmount > 0 ? calcs.pendingAmount.toFixed(2) : "");
    setPayMethod("Transferencia");
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayRef("");
    setPayInvoice(quote.invoiceNumber || "");
    setPayNotes("");
    setNoteText("");
    setNotePromisedDate("");
    setEditInvoiceNum(quote.invoiceNumber || "");
    setEditCustomDueDate(quote.customDueDate || "");
    setUnifiedModalTab(initialTab);
    setUnifiedModalOpen(true);
  };

  // Submit Payment Registration
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Monto inválido", description: "Ingrese un monto mayor a $0.00.", variant: "destructive" });
      return;
    }

    setIsSubmittingPay(true);
    try {
      const calcs = getQuoteCalculations(selectedQuote);
      const newPaidTotal = round2(calcs.paidAmount + amountNum);
      const isNowFullyPaid = newPaidTotal >= (selectedQuote.total || 0) - 0.01;

      const newRecord: PaymentRecord = {
        id: `PAY-${Date.now()}`,
        amount: amountNum,
        date: payDate,
        method: payMethod,
        ...(payRef.trim() ? { reference: payRef.trim() } : {}),
        ...(payInvoice.trim() ? { invoiceNumber: payInvoice.trim() } : {}),
        ...(payNotes.trim() ? { notes: payNotes.trim() } : {}),
        registeredBy: userProfile?.displayName || user?.email || "Usuario",
        registeredAt: new Date().toISOString()
      };

      const currentPayments = Array.isArray(selectedQuote.payments) ? selectedQuote.payments : [];
      const updatedPayments = [newRecord, ...currentPayments];

      const updateData: any = {
        payments: updatedPayments,
        paidAmount: newPaidTotal,
        invoiceNumber: payInvoice.trim() || selectedQuote.invoiceNumber || ""
      };

      if (isNowFullyPaid) {
        updateData.status = "Pagada";
      }

      await updateDoc(doc(db, "quotes", selectedQuote.id), cleanUndefined(updateData));

      toast({
        title: isNowFullyPaid ? "¡Cuenta Liquidada!" : "Abono Registrado",
        description: isNowFullyPaid 
          ? `Se liquidó el total de la cotización #${selectedQuote.quoteNumber}.` 
          : `Se registraron ${fmt(amountNum)} correctamente. Nuevo saldo: ${fmt(Math.max(0, (selectedQuote.total || 0) - newPaidTotal))}`
      });

      setSelectedQuote(prev => prev ? {
        ...prev,
        payments: updatedPayments,
        paidAmount: newPaidTotal,
        status: isNowFullyPaid ? "Pagada" : prev.status,
        invoiceNumber: payInvoice.trim() || prev.invoiceNumber
      } : null);

      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      setUnifiedModalTab("pagos");
    } catch (err) {
      console.error("Error al registrar abono:", err);
      toast({ title: "Error", description: "No se pudo registrar el abono. Intente nuevamente.", variant: "destructive" });
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Submit Follow-up Note
  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote || !noteText.trim()) return;

    setIsSubmittingNote(true);
    try {
      const newNote: CollectionNote = {
        id: `NOTE-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        note: noteText.trim(),
        ...(notePromisedDate ? { promisedPaymentDate: notePromisedDate } : {}),
        user: userProfile?.displayName || user?.email || "Usuario",
        createdAt: new Date().toISOString()
      };

      const currentNotes = Array.isArray(selectedQuote.collectionNotes) ? selectedQuote.collectionNotes : [];
      const updatedNotes = [newNote, ...currentNotes];

      await updateDoc(doc(db, "quotes", selectedQuote.id), cleanUndefined({
        collectionNotes: updatedNotes
      }));

      toast({ title: "Nota registrada", description: "La bitácora de cobranza se actualizó correctamente." });
      setNoteText("");
      setNotePromisedDate("");
      
      setSelectedQuote(prev => prev ? { ...prev, collectionNotes: updatedNotes } : null);
    } catch (err) {
      console.error("Error al registrar nota:", err);
      toast({ title: "Error", description: "No se pudo guardar la nota.", variant: "destructive" });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Save Invoice & Custom Due Date
  const handleSaveInvoiceDue = async () => {
    if (!selectedQuote) return;
    setIsSavingInvoiceDue(true);
    try {
      await updateDoc(doc(db, "quotes", selectedQuote.id), cleanUndefined({
        invoiceNumber: editInvoiceNum.trim() || "",
        customDueDate: editCustomDueDate || ""
      }));

      toast({ title: "Factura / Vencimiento guardado", description: "La información fiscal y prórroga se actualizaron." });
      setSelectedQuote(prev => prev ? { ...prev, invoiceNumber: editInvoiceNum.trim(), customDueDate: editCustomDueDate } : null);
    } catch (err) {
      console.error("Error al guardar factura/vencimiento:", err);
      toast({ title: "Error", description: "No se pudo actualizar la información.", variant: "destructive" });
    } finally {
      setIsSavingInvoiceDue(false);
    }
  };

  // Open User Preferences Modal
  const handleOpenPreferencesModal = () => {
    setTempPrefs({
      ...preferences,
      summarySendEmail: preferences.summarySendEmail || userProfile?.email || user?.email || ""
    });
    setConfigModalOpen(true);
  };

  // Save User Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingPrefs(true);
    try {
      setPreferences(tempPrefs);
      setShowSummary(tempPrefs.showSummaryByDefault);

      // Save in LocalStorage for instant access
      try {
        localStorage.setItem(`cxc_prefs_${user.uid}`, JSON.stringify(tempPrefs));
      } catch {
        // Ignore local storage write error
      }

      // Save in Firestore User Document
      await updateDoc(doc(db, "users", user.uid), cleanUndefined({
        cxcPreferences: tempPrefs
      }));

      toast({
        title: "Configuración guardada",
        description: "Tus preferencias de visualización y periodicidad de CxC se han actualizado exitosamente."
      });

      // Apply default period immediately
      if (tempPrefs.defaultPeriod !== activePeriod) {
        setActivePeriod(tempPrefs.defaultPeriod);
        setDate(getPeriodDateRange(tempPrefs.defaultPeriod));
      }

      setConfigModalOpen(false);
    } catch (err) {
      console.error("Error al guardar preferencias de CxC:", err);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar las preferencias en el servidor, pero se mantendrán en tu navegador.",
        variant: "destructive"
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Trigger Mock / Test Email Summary Send
  const handleSendTestSummary = async () => {
    const targetEmail = tempPrefs.summarySendEmail || user?.email;
    if (!targetEmail) {
      toast({ title: "Correo requerido", description: "Ingresa un correo electrónico para enviar el resumen.", variant: "destructive" });
      return;
    }
    setIsSendingTestEmail(true);
    try {
      // Simulate dispatch and notification
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({
        title: "Resumen de Cobranza preparado",
        description: `Se preparó el reporte de cartera para envío a ${targetEmail} con frecuencia ${tempPrefs.summarySendFrequency || "mensual"}.`
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3">Cargando módulo de cuentas por cobrar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-foreground" />
            Cobranza & Cuentas por Cobrar
          </h1>
          <p className="text-muted-foreground text-sm">
            Control integral de saldos pendientes, abonos, órdenes de trabajo (OTs), facturación y seguimiento estratégico de cartera.
          </p>
        </div>
      </div>

      {/* KPI Cards - Executive summary */}
      {userProfile?.role === "admin" && showSummary && (
        <>
          {/* Main 4 High-Value KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Saldo Pendiente Total & Efectividad */}
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo Pendiente por Cobrar</CardTitle>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono">{fmt(stats.totalPendiente)}</div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t text-xs text-muted-foreground">
                  <span>Efectividad de Cobro:</span>
                  <span className="font-semibold text-emerald-600 font-mono">{stats.efectividadCobro}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cartera total: {fmt(stats.totalCartera)} (Cobrado: {fmt(stats.totalCobrado)})
                </p>
              </CardContent>
            </Card>

            {/* 2. Monto Vencido & Retraso Promedio */}
            <Card className="relative overflow-hidden border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monto Vencido en Mora</CardTitle>
                <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400 font-mono">{fmt(stats.totalVencido)}</div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t text-xs text-muted-foreground">
                  <span>Clientes en mora:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400 font-mono">{stats.clientesVencidosCount} empresas</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {stats.vencidasCount} deudas vencidas (Promedio: {Math.round(stats.promedioRetraso)} días mora)
                </p>
              </CardContent>
            </Card>

            {/* 3. Alerta Operativa: OTs Terminadas Sin Factura */}
            <Card className="relative overflow-hidden border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">OTs Listas Sin Facturar</CardTitle>
                <div className="p-2 bg-amber-50 rounded-full text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 font-mono">{fmt(stats.otCompletedWithoutInvoiceAmount)}</div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t text-xs text-muted-foreground">
                  <span>Órdenes concluidas:</span>
                  <span className="font-semibold text-amber-800 font-mono">{stats.otCompletedWithoutInvoiceCount} trabajos</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Trabajo en campo terminado que requiere emitir factura para cobro.
                </p>
              </CardContent>
            </Card>

            {/* 4. Cobranza Comprometida (Promesas de Pago) & DSO */}
            <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cobranza Comprometida</CardTitle>
                <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
                  <CalendarClock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 font-mono">{fmt(stats.promesasAmount)}</div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t text-xs text-muted-foreground">
                  <span>Promesas activas:</span>
                  <span className="font-semibold text-emerald-800 font-mono">{stats.promesasCount} compromisos</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  DSO estimado de cobranza: {stats.dsoEstimado} días
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Distribution Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Antigüedad de Saldos Pendientes (Aging)</span>
                  <span className="text-xs font-normal text-muted-foreground font-mono">Total: {fmt(stats.totalPendiente)}</span>
                </CardTitle>
                <CardDescription>Distribución del saldo no cobrado clasificado por días de morosidad</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5">
                {[
                  { label: "Al corriente (Sin mora)", amount: stats.aging.corriente, color: "bg-emerald-500" },
                  { label: "1 a 30 días de mora", amount: stats.aging.r1_30, color: "bg-yellow-500" },
                  { label: "31 a 60 días de mora", amount: stats.aging.r31_60, color: "bg-orange-400" },
                  { label: "61 a 90 días de mora", amount: stats.aging.r61_90, color: "bg-orange-600" },
                  { label: "Más de 90 días (Crítico)", amount: stats.aging.r90_plus, color: "bg-red-600" },
                ].map(b => {
                  const pct = stats.totalPendiente > 0 ? (b.amount / stats.totalPendiente) * 100 : 0;
                  return (
                    <div key={b.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-700 dark:text-slate-300">{b.label}</span>
                        <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                          {fmt(b.amount)} <span className="text-muted-foreground font-normal">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", b.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Deuda Pendiente por Línea de Servicio
                </CardTitle>
                <CardDescription>Concentración de cartera pendiente según la especialidad</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
                {stats.serviceBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No hay deuda activa registrada.</p>
                ) : (
                  stats.serviceBreakdown
                    .sort((a, b) => b.amount - a.amount)
                    .map(s => {
                      const pct = stats.totalPendiente > 0 ? (s.amount / stats.totalPendiente) * 100 : 0;
                      return (
                        <div key={s.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-300">{s.name}</span>
                            <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                              {fmt(s.amount)} <span className="text-muted-foreground font-normal">({Math.round(pct)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Main Tabs for Directives and Detail View */}
      <Tabs value={mainTab} onValueChange={(val) => setMainTab(val as "detalle" | "deudores")} className="w-full space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
          <TabsList className="grid w-full sm:w-auto grid-cols-2 bg-muted p-1 rounded-xl">
            <TabsTrigger value="detalle" className="gap-2 text-xs sm:text-sm font-semibold py-2">
              <ListFilter className="h-4 w-4" />
              Detalle de Cuentas & OTs
            </TabsTrigger>
            <TabsTrigger value="deudores" className="gap-2 text-xs sm:text-sm font-semibold py-2">
              <Building2 className="h-4 w-4" />
              Seguimiento a Deudores (Directivos)
              {presetCounts.vencidas > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] rounded-full">
                  {presetCounts.vencidas}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Export Button */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-foreground shadow-2xs"
                >
                  <Download className="h-4 w-4" />
                  <span className="font-semibold text-xs sm:text-sm">Generar Reporte</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[190px] p-1.5 shadow-md rounded-xl border bg-card">
                <DropdownMenuItem 
                  onClick={handleDownloadExcel} 
                  className="gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium"
                >
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Exportar a Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={openPdfDialog} 
                  className="gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium"
                >
                  <Download className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span>Exportar a PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* TAB 1: DETALLE DE CUENTAS & ORDENES DE TRABAJO */}
        <TabsContent value="detalle" className="space-y-4 m-0">
          <Card className="shadow-xs" id="cuentas-table-container">
            <CardHeader className="pb-3 border-b">
              <div>
                <CardTitle className="text-lg font-bold">Registro & Control de Cuentas por Cobrar</CardTitle>
                <CardDescription>Consulta saldos, OTs vinculadas, abonos, prórrogas y seguimiento de cobranza.</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              
              {/* Unified Grid Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end bg-muted/40 p-3 rounded-xl border">
                
                {/* 1. Date Range picker */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Rango de fechas</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background h-9",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {date?.from ? (
                            date.to ? (
                              <>
                                {format(date.from, "dd/MM/yy")} - {format(date.to, "dd/MM/yy")}
                              </>
                            ) : (
                              format(date.from, "dd/MM/yy")
                            )
                          ) : (
                            "Filtrar fecha..."
                          )}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={(newDate) => {
                          setDate(newDate);
                          setActivePeriod("personalizado");
                        }}
                        numberOfMonths={1}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 2. Client Combobox */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Cliente</span>
                  <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" role="combobox" className="w-full justify-between text-left font-normal bg-background h-9">
                        <span className="truncate">{selectedClient || "Todos"}</span>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="all" onSelect={() => { setSelectedClient(null); setIsClientPopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", !selectedClient ? "opacity-100" : "opacity-0")} />
                              Todos los clientes
                            </CommandItem>
                            {clientsWithDebts.map((clientName) => (
                              <CommandItem
                                key={clientName}
                                value={clientName}
                                onSelect={() => {
                                  setSelectedClient(clientName);
                                  setIsClientPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedClient === clientName ? "opacity-100" : "opacity-0")} />
                                {clientName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 3. Service Type Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Línea de servicio</span>
                  <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                    <SelectTrigger className="w-full bg-background h-9">
                      <SelectValue placeholder="Línea de servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todas las líneas</SelectItem>
                      {uniqueServiceTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Responsable Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Responsable</span>
                  <Select value={responsableFilter} onValueChange={setResponsableFilter}>
                    <SelectTrigger className="w-full bg-background h-9">
                      <SelectValue placeholder="Responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos los responsables</SelectItem>
                      {uniqueResponsables.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 5. Work Order Filter (OT) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Orden de Trabajo</span>
                  <Select value={otFilter} onValueChange={setOtFilter}>
                    <SelectTrigger className="w-full bg-background h-9">
                      <SelectValue placeholder="Filtrar OT" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas las OTs</SelectItem>
                      <SelectItem value="Con OT">Con OT Asignada ({presetCounts.conOt})</SelectItem>
                      <SelectItem value="Sin OT">Sin OT Asignada</SelectItem>
                      <SelectItem value="OT Completada">OT Completada</SelectItem>
                      <SelectItem value="OT En Proceso">OT En Proceso</SelectItem>
                      <SelectItem value="OT Pendiente">OT Pendiente / Asignada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 6. Status Select */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Estado de cobro</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full bg-background h-9">
                      <SelectValue placeholder="Estado de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Pendientes (Activas) ({presetCounts.pendientes})</SelectItem>
                      <SelectItem value="Vencida">En Mora ({presetCounts.vencidas})</SelectItem>
                      <SelectItem value="Por vencer">Por vencer ({presetCounts.porVencer})</SelectItem>
                      <SelectItem value="OT Sin Factura">OT Terminada sin Factura ({presetCounts.otSinFactura})</SelectItem>
                      <SelectItem value="Con Promesa">Con Promesa de Pago ({presetCounts.conPromesa})</SelectItem>
                      <SelectItem value="Con Abonos">Con Abonos Parciales</SelectItem>
                      <SelectItem value="Sin Abonos">Sin Abonos</SelectItem>
                      <SelectItem value="Al corriente">Al corriente</SelectItem>
                      <SelectItem value="Pagadas (Referencia)">Pagadas / Liquidadas ({presetCounts.liquidadas})</SelectItem>
                      <SelectItem value="Todas (Historial)">Todas (Historial completo) ({presetCounts.total})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 7. Text Search & Clear button */}
                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Búsqueda global</span>
                    <Input
                      placeholder="Cotización, OT, Factura, Cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-9 bg-background"
                    />
                  </div>
                  {hasActiveFilters && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleClearFilters} className="h-9 w-9 text-muted-foreground hover:text-foreground self-end mb-[1px]">
                            <Eraser className="h-4 w-4" />
                            <span className="sr-only">Limpiar filtros</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Limpiar todos los filtros</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

              </div>

              {/* Table */}
              <div className="rounded-xl border overflow-x-auto shadow-sm">
                <Table className="min-w-[1650px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[110px] whitespace-nowrap">No. Cotización</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">No. OT</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">No. Factura</TableHead>
                      <TableHead className="min-w-[180px]">Cliente</TableHead>
                      <TableHead className="min-w-[140px]">Responsable</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">Puesto / Rol</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">Departamento</TableHead>
                      <TableHead className="w-[110px] whitespace-nowrap">Servicio</TableHead>
                      <TableHead className="text-right w-[110px] whitespace-nowrap">Total</TableHead>
                      <TableHead className="text-right w-[110px] whitespace-nowrap">Abonado</TableHead>
                      <TableHead className="text-right w-[120px] whitespace-nowrap">Saldo Pend.</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap">Emisión</TableHead>
                      <TableHead className="w-[105px] whitespace-nowrap">Vencimiento</TableHead>
                      <TableHead className="w-[80px] text-center whitespace-nowrap">Mora</TableHead>
                      <TableHead className="w-[160px] whitespace-nowrap">Estado de Cobro</TableHead>
                      <TableHead className="w-[120px] text-right whitespace-nowrap">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={16} className="h-28 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2 py-4">
                            <ListFilter className="h-8 w-8 text-muted-foreground/40" />
                            <p className="font-medium text-slate-600 dark:text-slate-400">No se encontraron cuentas por cobrar con los filtros seleccionados.</p>
                            {hasActiveFilters && (
                              <Button variant="link" onClick={handleClearFilters} className="text-xs text-blue-600 dark:text-blue-400 h-auto p-0">
                                Restablecer filtros
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedQuotes.map((quote) => {
                        const { 
                          expirationDate, 
                          daysOverdue, 
                          paymentStatus, 
                          total, 
                          paidAmount, 
                          pendingAmount, 
                          isFullyPaid, 
                          linkedOt,
                          isOtCompletedWithoutInvoice,
                          latestPromisedDate 
                        } = getQuoteCalculations(quote);
                        
                        const hasNotes = quote.collectionNotes && quote.collectionNotes.length > 0;

                        return (
                          <TableRow key={quote.id} className={cn(daysOverdue > 0 && !isFullyPaid && "bg-red-50/40 hover:bg-red-50/60")}>
                            {/* Quote Number */}
                            <TableCell className="font-semibold font-mono text-xs whitespace-nowrap">{quote.quoteNumber || "—"}</TableCell>
                            
                            {/* Linked Work Order (OT) */}
                            <TableCell className="whitespace-nowrap">
                              {linkedOt ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className={cn("font-mono text-[11px] gap-1 cursor-pointer transition-all whitespace-nowrap shrink-0 inline-flex items-center", getOtBadgeStyle(linkedOt.status))}>
                                        <Wrench className="h-3 w-3 shrink-0" />
                                        <span>{linkedOt.otNumber}</span>
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="space-y-1 p-2 text-xs bg-slate-900 text-slate-100 border-slate-800">
                                      <p className="font-bold text-sky-400">Orden de Trabajo: {linkedOt.otNumber}</p>
                                      <p>Estado: <span className="font-semibold text-white">{linkedOt.status}</span></p>
                                      {linkedOt.technician && <p>Técnico: <span className="text-white">{linkedOt.technician}</span></p>}
                                      {linkedOt.equipoLugar && <p>Lugar: <span className="text-white">{linkedOt.equipoLugar}</span></p>}
                                      {linkedOt.date && <p>Fecha: <span className="text-white">{formatDateStr(linkedOt.date)}</span></p>}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-xs text-muted-foreground italic whitespace-nowrap">Sin OT</span>
                              )}
                            </TableCell>

                            {/* Invoice Number */}
                            <TableCell className="whitespace-nowrap">
                              {quote.invoiceNumber ? (
                                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-mono text-[11px] gap-1.5 whitespace-nowrap shrink-0 inline-flex items-center px-2 py-0.5">
                                  <Receipt className="h-3 w-3 text-slate-500 shrink-0" />
                                  <span>{quote.invoiceNumber}</span>
                                </Badge>
                              ) : isOtCompletedWithoutInvoice ? (
                                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[10px] gap-1 font-semibold whitespace-nowrap shrink-0 inline-flex items-center px-2 py-0.5">
                                  <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>Sin Factura</span>
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic whitespace-nowrap">Sin Factura</span>
                              )}
                            </TableCell>

                            {/* Client Name */}
                            <TableCell className="max-w-[180px] truncate" title={quote.clientName}>
                              <div className="font-semibold text-sm truncate">{quote.clientName || "—"}</div>
                            </TableCell>

                            {/* Responsable */}
                            <TableCell className="max-w-[140px] truncate">
                              <span className="font-medium text-xs text-foreground">
                                {quote.responsable || usersMap.get(quote.userId || "")?.displayName || "—"}
                              </span>
                            </TableCell>

                            {/* Puesto / Rol */}
                            <TableCell className="whitespace-nowrap">
                              {(() => {
                                const uInfo = (quote.userId ? usersMap.get(quote.userId) : null) || (quote.responsable ? usersMap.get(quote.responsable.trim().toLowerCase()) : null);
                                return uInfo?.jobTitle ? (
                                  <Badge variant="secondary" className="font-normal text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {uInfo.jobTitle}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                );
                              })()}
                            </TableCell>

                            {/* Departamento */}
                            <TableCell className="whitespace-nowrap">
                              {(() => {
                                const uInfo = (quote.userId ? usersMap.get(quote.userId) : null) || (quote.responsable ? usersMap.get(quote.responsable.trim().toLowerCase()) : null);
                                return uInfo?.department ? (
                                  <Badge variant="outline" className="font-normal text-xs border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                                    {uInfo.department}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                );
                              })()}
                            </TableCell>

                            {/* Service Type */}
                            <TableCell className="truncate max-w-[110px]" title={quote.tipoServicio}>{quote.tipoServicio || "—"}</TableCell>
                            
                            {/* Amounts */}
                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">{fmt(total)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {paidAmount > 0 ? fmt(paidAmount) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground whitespace-nowrap">
                              {isFullyPaid ? <span className="text-muted-foreground font-normal">$0.00</span> : fmt(pendingAmount)}
                            </TableCell>

                            {/* Dates & Overdue */}
                            <TableCell className="text-xs whitespace-nowrap">{formatDateStr(quote.date)}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {formatExDate(expirationDate)}
                              {quote.customDueDate && (
                                <span className="block text-[10px] text-primary font-medium">(Prórroga)</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center font-mono text-xs whitespace-nowrap">
                              {isFullyPaid ? (
                                <span className="text-muted-foreground">—</span>
                              ) : daysOverdue > 0 ? (
                                <span className="font-bold text-red-600 dark:text-red-400">{daysOverdue}d</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Status Badge & Promised Date */}
                            <TableCell className="whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={cn("gap-1 text-[11px] font-medium py-0.5 px-2 w-fit whitespace-nowrap shrink-0 inline-flex items-center", paymentStatus.color)}>
                                  {paymentStatus.icon}
                                  <span>{paymentStatus.label}</span>
                                </Badge>
                                {latestPromisedDate && !isFullyPaid && (
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1 whitespace-nowrap">
                                    <CalendarCheck className="h-3 w-3 shrink-0" /> Promesa: {formatDateStr(latestPromisedDate)}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Actions Dropdown / Buttons */}
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {!isFullyPaid && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenUnifiedModal(quote, "abono")}
                                    className="h-8 text-xs gap-1 font-medium shadow-2xs bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white"
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    Abonar
                                  </Button>
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[220px]">
                                    <DropdownMenuItem onClick={() => handleOpenUnifiedModal(quote, "abono")} className="gap-2 cursor-pointer">
                                      <CreditCard className="h-4 w-4 text-emerald-600" />
                                      <span>Registrar Abono</span>
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => handleOpenUnifiedModal(quote, "pagos")} className="gap-2 cursor-pointer">
                                      <History className="h-4 w-4 text-blue-600" />
                                      <span>Historial de Pagos</span>
                                      {quote.payments && quote.payments.length > 0 && (
                                        <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
                                          {quote.payments.length}
                                        </Badge>
                                      )}
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => handleOpenUnifiedModal(quote, "bitacora")} className="gap-2 cursor-pointer">
                                      <MessageSquare className="h-4 w-4 text-amber-600" />
                                      <span>Bitácora de Cobranza</span>
                                      {hasNotes && (
                                        <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
                                          {quote.collectionNotes?.length}
                                        </Badge>
                                      )}
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => handleOpenUnifiedModal(quote, "factura")} className="gap-2 cursor-pointer">
                                      <Receipt className="h-4 w-4 text-indigo-600" />
                                      <span>Factura & Prórroga</span>
                                    </DropdownMenuItem>

                                    {linkedOt && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => router.push(`/admin/operaciones/ordenes-de-trabajo?search=${linkedOt.otNumber}`)} className="gap-2 text-indigo-700 cursor-pointer">
                                          <Wrench className="h-4 w-4 text-indigo-600" />
                                          <span>Ir a OT ({linkedOt.otNumber})</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem onClick={() => router.push(`/admin/quotes?id=${quote.id}`)} className="gap-2 cursor-pointer">
                                      <ExternalLink className="h-4 w-4 text-slate-500" />
                                      <span>Ver Cotización</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>

                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <div>
                    Mostrando <span className="font-semibold text-foreground">{paginatedQuotes.length}</span> de <span className="font-semibold text-foreground">{filteredQuotes.length}</span> cuentas
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 text-xs"
                    >
                      Anterior
                    </Button>
                    <span className="px-2 font-medium">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 text-xs"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SEGUIMIENTO DE DEUDORES PARA DIRECTIVOS (QUIEN DEBE Y QUIEN NO) */}
        <TabsContent value="deudores" className="space-y-5 m-0">
          
          {/* Top 5 Critical Debtors Directive Dashboard Banner */}
          {topCriticalDebtors.length > 0 && (
            <Card className="border-red-200 bg-gradient-to-br from-red-50/50 via-background to-amber-50/30 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-700 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Top 5 Clientes con Mayor Concentración de Deuda / Mora
                </CardTitle>
                <CardDescription>
                  Empresas con mayor prioridad de gestión de cobranza y volumen de saldo retenido.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {topCriticalDebtors.map((debtor, idx) => {
                    const isMora = debtor.totalOverdue > 0;
                    return (
                      <div 
                        key={debtor.clientName}
                        className={cn(
                          "p-3 rounded-xl border flex flex-col justify-between transition-all hover:shadow-md bg-white dark:bg-card",
                          isMora ? "border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-900/10" : "border-slate-200 dark:border-slate-700"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-500 dark:text-slate-400">#{idx + 1}</span>
                            {isMora ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                {debtor.maxDaysOverdue}d mora
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0">
                                Al corriente
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={debtor.clientName}>
                            {debtor.clientName}
                          </h4>
                          <div className="mt-2 space-y-0.5">
                            <div className="text-xs text-muted-foreground">Saldo Pendiente:</div>
                            <div className="text-base font-bold font-mono text-blue-700 dark:text-blue-400">{fmt(debtor.totalPending)}</div>
                            {isMora && (
                              <div className="text-[11px] font-mono text-red-600 dark:text-red-400 font-semibold">
                                Vencido: {fmt(debtor.totalOverdue)}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewClientAccounts(debtor.clientName)}
                          className="mt-3 h-7 text-xs text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full justify-between px-2"
                        >
                          <span>Ver cuentas ({debtor.totalQuotesCount})</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Client Debtors Master Table */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-orange-50/50 dark:from-orange-900/10 to-slate-50 dark:to-slate-900/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-orange-600" />
                    Vista Ejecutiva: Resumen Consolidado por Cliente
                  </CardTitle>
                  <CardDescription>
                    Visión clara para directivos: consulta quién debe, cuánto debe, saldos en mora y estado global por empresa.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 px-3 py-1 font-semibold text-xs">
                    {stats.clientesVencidosCount} Clientes en Mora
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 px-3 py-1 font-semibold text-xs">
                    {fmt(stats.totalPendiente)} Pendiente Total
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="rounded-xl border overflow-x-auto shadow-sm">
                <Table className="min-w-[1100px]">
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                    <TableRow>
                      <TableHead>Empresa / Cliente</TableHead>
                      <TableHead className="w-[100px] text-center">Crédito</TableHead>
                      <TableHead className="w-[140px] text-center">Cotizaciones & OTs</TableHead>
                      <TableHead className="text-right w-[130px]">Total Cotizado</TableHead>
                      <TableHead className="text-right w-[120px]">Total Abonado</TableHead>
                      <TableHead className="text-right w-[140px]">Saldo Pendiente</TableHead>
                      <TableHead className="text-right w-[140px]">Monto Vencido</TableHead>
                      <TableHead className="w-[160px]">Estado Global</TableHead>
                      <TableHead className="w-[150px] text-right">Acciones Directivas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientDebtsSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          No hay deudas registradas por clientes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientDebtsSummary.map((client) => {
                        const isOverdue = client.totalOverdue > 0;
                        const isSettled = client.totalPending <= 0.01;

                        return (
                          <TableRow 
                            key={client.clientName} 
                            className={cn(
                              isOverdue && "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50/80 dark:hover:bg-red-900/20 font-medium",
                              isSettled && "bg-slate-50/50 dark:bg-slate-800/20 text-muted-foreground"
                            )}
                          >
                            {/* Client Name & Contact */}
                            <TableCell className="font-semibold">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{client.clientName}</div>
                              {(client.phone || client.email) && (
                                <div className="text-xs text-muted-foreground font-normal">
                                  {client.phone && <span>Tel: {client.phone}</span>}
                                  {client.email && <span className="ml-2">Email: {client.email}</span>}
                                </div>
                              )}
                            </TableCell>

                            {/* Credit Days */}
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs">
                                {client.creditDays} días
                              </Badge>
                            </TableCell>

                            {/* Counts of Quotes and OTs */}
                            <TableCell className="text-center text-xs">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{client.totalQuotesCount} cotizaciones</div>
                              {client.totalOtCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">
                                  <Wrench className="h-3 w-3" />
                                  {client.totalOtCount} OTs generadas
                                </span>
                              )}
                            </TableCell>

                            {/* Financial totals */}
                            <TableCell className="text-right font-mono text-xs font-medium">{fmt(client.totalAmount)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-green-700 dark:text-green-400 font-medium">
                              {client.totalPaid > 0 ? fmt(client.totalPaid) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                              {isSettled ? <span className="text-muted-foreground font-normal">$0.00</span> : fmt(client.totalPending)}
                            </TableCell>
                            
                            {/* Overdue amount */}
                            <TableCell className="text-right font-mono text-xs font-bold text-red-700 dark:text-red-400">
                              {isOverdue ? fmt(client.totalOverdue) : <span className="text-muted-foreground font-normal">$0.00</span>}
                            </TableCell>

                            {/* Global Status */}
                            <TableCell>
                              {isOverdue ? (
                                <Badge variant="destructive" className="gap-1.5 font-bold text-xs py-1 px-2.5 bg-red-600">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  En Mora ({client.maxDaysOverdue}d retraso)
                                </Badge>
                              ) : isSettled ? (
                                <Badge variant="outline" className="gap-1 text-xs py-1 px-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                                  Al día (Sin deuda)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-xs py-1 px-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-400 dark:border-green-700">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                  Al corriente (Vigente)
                                </Badge>
                              )}
                            </TableCell>

                            {/* Directive Action Buttons */}
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewClientAccounts(client.clientName)}
                                className="h-8 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 font-medium"
                              >
                                <span>Ver Cuentas</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>

                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* ── UNIFIED DIALOG: GESTIÓN DE CUENTA, ABONOS & BITÁCORA ─────────── */}
      <Dialog open={unifiedModalOpen} onOpenChange={setUnifiedModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1e3e62]" />
              Gestión de Cuenta & Abonos
            </DialogTitle>
            <DialogDescription>
              {selectedQuote && (
                <span>
                  Cotización <strong className="text-foreground font-mono">#{selectedQuote.quoteNumber}</strong> — <strong className="text-foreground">{selectedQuote.clientName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (() => {
            const calcs = getQuoteCalculations(selectedQuote);
            const pendingVal = calcs.pendingAmount;
            const payments = Array.isArray(selectedQuote.payments) ? selectedQuote.payments : [];
            const notes = Array.isArray(selectedQuote.collectionNotes) ? selectedQuote.collectionNotes : [];

            return (
              <div className="space-y-4">
                {/* Financial Summary Cards Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-muted/40 rounded-xl border">
                  <div className="p-2 bg-card rounded-lg border shadow-xs">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Cotizado</span>
                    <p className="text-base font-bold font-mono text-foreground mt-0.5">{fmt(selectedQuote.total || 0)}</p>
                  </div>
                  <div className="p-2 bg-card rounded-lg border shadow-xs">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Abonado ({payments.length})</span>
                    <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{fmt(calcs.paidAmount)}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 shadow-xs">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Saldo Pendiente</span>
                    <p className="text-base font-bold font-mono text-foreground mt-0.5">{fmt(pendingVal)}</p>
                  </div>
                </div>

                <Tabs value={unifiedModalTab} onValueChange={(val: any) => setUnifiedModalTab(val)} className="w-full">
                  <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted rounded-xl">
                    <TabsTrigger value="abono" className="py-2 text-xs font-semibold gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      Registrar Abono
                    </TabsTrigger>
                    <TabsTrigger value="pagos" className="py-2 text-xs font-semibold gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Pagos ({payments.length})
                    </TabsTrigger>
                    <TabsTrigger value="bitacora" className="py-2 text-xs font-semibold gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Bitácora ({notes.length})
                    </TabsTrigger>
                    <TabsTrigger value="factura" className="py-2 text-xs font-semibold gap-1.5">
                      <Receipt className="h-3.5 w-3.5" />
                      Factura & Plazo
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: REGISTRAR ABONO (PANTALLA PRINCIPAL) */}
                  <TabsContent value="abono" className="space-y-4 pt-2">
                    {calcs.isFullyPaid ? (
                      <div className="p-6 text-center border rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        <h4 className="font-bold text-emerald-800 dark:text-emerald-300">¡Esta cuenta ya se encuentra totalmente liquidada!</h4>
                        <p className="text-xs text-muted-foreground">El monto total de {fmt(selectedQuote.total || 0)} fue cubierto en su totalidad.</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setUnifiedModalTab("pagos")} className="mt-2 text-xs">
                          Ver Historial de Pagos
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitPayment} className="space-y-4">
                        {/* Amount Input & Fast Fill Buttons */}
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <Label htmlFor="pay-amount" className="text-xs font-bold text-foreground">
                              Monto a Abonar ($ MXN) *
                            </Label>
                            {pendingVal > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPayAmount(pendingVal.toFixed(2))}
                                  className="h-6 text-[11px] px-2 rounded-md font-semibold"
                                >
                                  Liquidar Total ({fmt(pendingVal)})
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPayAmount((pendingVal * 0.5).toFixed(2))}
                                  className="h-6 text-[11px] px-2 rounded-md text-muted-foreground hover:bg-muted"
                                >
                                  50% ({fmt(pendingVal * 0.5)})
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-base">$</span>
                            <Input
                              id="pay-amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="pl-8 h-11 font-mono text-lg font-bold text-foreground bg-card border-input rounded-xl"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="pay-method" className="text-xs font-bold text-foreground">Método de Pago *</Label>
                            <Select value={payMethod} onValueChange={(val: any) => setPayMethod(val)}>
                              <SelectTrigger id="pay-method" className="h-9 bg-card rounded-lg text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Transferencia">Transferencia Bancaria (SPEI)</SelectItem>
                                <SelectItem value="Efectivo">Efectivo</SelectItem>
                                <SelectItem value="Cheque">Cheque</SelectItem>
                                <SelectItem value="Tarjeta">Tarjeta Débito / Crédito</SelectItem>
                                <SelectItem value="Otro">Otro Método</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="pay-date" className="text-xs font-bold text-foreground">Fecha de Recepción *</Label>
                            <Input
                              id="pay-date"
                              type="date"
                              required
                              value={payDate}
                              onChange={(e) => setPayDate(e.target.value)}
                              className="h-9 text-xs bg-card rounded-lg"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="pay-ref" className="text-xs font-bold text-foreground">Referencia / No. de Operación</Label>
                            <Input
                              id="pay-ref"
                              placeholder="Ej. SPEI 849203 / Autorización 4810"
                              value={payRef}
                              onChange={(e) => setPayRef(e.target.value)}
                              className="h-9 bg-card rounded-lg font-mono text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="pay-invoice" className="text-xs font-bold text-foreground">No. Factura Fiscal (Opcional)</Label>
                            <Input
                              id="pay-invoice"
                              placeholder="Ej. F-10492"
                              value={payInvoice}
                              onChange={(e) => setPayInvoice(e.target.value)}
                              className="h-9 bg-card rounded-lg font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="pay-notes" className="text-xs font-bold text-foreground">Notas u Observaciones del Pago</Label>
                          <Textarea
                            id="pay-notes"
                            placeholder="Detalles adicionales sobre la cuenta de origen, comprobante, concepto o acuerdo de pago..."
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            className="text-xs resize-y min-h-[60px] bg-card rounded-lg"
                          />
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t">
                          <DialogClose asChild>
                            <Button type="button" variant="outline" className="h-10 px-4 rounded-xl text-xs">Cancelar</Button>
                          </DialogClose>
                          <Button
                            type="submit"
                            disabled={isSubmittingPay}
                            className="h-10 px-5 bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white font-bold rounded-xl shadow-xs gap-2 text-xs"
                          >
                            {isSubmittingPay && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirmar y Guardar Abono
                          </Button>
                        </div>
                      </form>
                    )}
                  </TabsContent>

                  {/* TAB 2: HISTORIAL DE PAGOS */}
                  <TabsContent value="pagos" className="space-y-3 pt-2">
                    {payments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">
                        No se han registrado abonos previos para esta cotización.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                        {payments.map((p, idx) => (
                          <div key={p.id || idx} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:bg-muted/20 transition-all">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">{fmt(p.amount)}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {p.method}
                                </Badge>
                              </div>
                              {p.reference && (
                                <div className="text-xs text-foreground font-mono">
                                  Ref: <span className="font-semibold">{p.reference}</span>
                                </div>
                              )}
                              {p.notes && <p className="text-[11px] text-muted-foreground">{p.notes}</p>}
                            </div>
                            <div className="text-right text-xs shrink-0">
                              <span className="font-medium text-foreground block">{formatDateStr(p.date)}</span>
                              <span className="text-[10px] text-muted-foreground">{p.registeredBy || "Usuario"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 3: BITÁCORA DE COBRANZA & NOTAS */}
                  <TabsContent value="bitacora" className="space-y-4 pt-2">
                    <form onSubmit={handleSubmitNote} className="space-y-3.5 border p-3.5 rounded-xl bg-muted/30">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Añadir nueva gestión / llamada de cobranza</Label>
                        <Textarea
                          placeholder="Ej. Se llamó a cuentas por pagar. Prometieron pago el viernes..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          required
                          className="text-xs bg-card min-h-[70px] rounded-lg"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor="promised-date" className="text-[11px] font-medium text-muted-foreground">Promesa de Pago (Opcional)</Label>
                          <Input
                            id="promised-date"
                            type="date"
                            value={notePromisedDate}
                            onChange={(e) => setNotePromisedDate(e.target.value)}
                            className="h-9 text-xs bg-card rounded-lg"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={isSubmittingNote}
                          className="h-9 px-4 text-xs font-semibold bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white rounded-lg shadow-2xs gap-1.5 shrink-0"
                        >
                          {isSubmittingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Guardar Nota
                        </Button>
                      </div>
                    </form>

                    {/* Notes Timeline */}
                    {notes.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs border border-dashed rounded-xl">
                        No hay notas de seguimiento registradas.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {notes.map((n) => (
                          <div key={n.id} className="border-l-2 border-l-primary pl-3 py-1 space-y-1 bg-card/60 p-2 rounded-r-lg border">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">{n.user || "Usuario"}</span>
                              <span className="text-muted-foreground text-[11px]">{formatDateStr(n.date)}</span>
                            </div>
                            <p className="text-xs text-foreground">{n.note}</p>
                            {n.promisedPaymentDate && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] gap-1 w-fit">
                                <CalendarCheck className="h-3 w-3" />
                                Promesa: {formatDateStr(n.promisedPaymentDate)}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 4: FACTURACIÓN Y PRÓRROGA */}
                  <TabsContent value="factura" className="space-y-4 pt-2">
                    <div className="space-y-3 border rounded-xl p-4 bg-muted/30">
                      <div>
                        <Label htmlFor="edit-invoice-num" className="text-xs font-semibold">Número de Factura / Folio Fiscal</Label>
                        <Input
                          id="edit-invoice-num"
                          placeholder="Ej. F-10492"
                          value={editInvoiceNum}
                          onChange={(e) => setEditInvoiceNum(e.target.value)}
                          className="mt-1 bg-card h-9 text-xs font-mono rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-custom-due" className="text-xs font-semibold">Fecha de Vencimiento Personalizada (Prórroga)</Label>
                        <Input
                          id="edit-custom-due"
                          type="date"
                          value={editCustomDueDate}
                          onChange={(e) => setEditCustomDueDate(e.target.value)}
                          className="mt-1 bg-card h-9 text-xs rounded-lg"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Si asignas una fecha aquí, se usará como fecha límite de cobro en lugar de los días de crédito ({calcs.creditDays} días).
                        </p>
                      </div>

                      <Button
                        onClick={handleSaveInvoiceDue}
                        disabled={isSavingInvoiceDue}
                        className="w-full gap-2 mt-2 bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white text-xs h-10 rounded-xl"
                      >
                        {isSavingInvoiceDue && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Guardar Facturación y Vencimiento
                      </Button>
                    </div>
                  </TabsContent>

                </Tabs>
              </div>
            );
          })()}

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: PDF Comment Dialog ──────────────────────────────────── */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generar Reporte PDF
            </DialogTitle>
            <DialogDescription>
              Agrega un comentario o nota que aparecerá en el encabezado del reporte. El texto fue generado automáticamente según tus filtros activos — puedes editarlo o borrarlo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-comment" className="text-sm font-semibold">Comentario del Reporte</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary underline"
                onClick={() => setPdfComment(buildDefaultComment())}
              >
                ↺ Restaurar texto automático
              </button>
            </div>
            <Textarea
              id="pdf-comment"
              value={pdfComment}
              onChange={(e) => setPdfComment(e.target.value)}
              placeholder="Escribe aquí cualquier nota, observación o contexto para este reporte..."
              className="min-h-[120px] resize-y text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Incluirá <strong>{filteredQuotes.length}</strong> registro(s) con los filtros actuales.
              {selectedClient && <span> · Cliente: <strong>{selectedClient}</strong></span>}
              {serviceTypeFilter !== "Todos" && <span> · Servicio: <strong>{serviceTypeFilter}</strong></span>}
              {statusFilter !== "Todos" && <span> · Estado: <strong>{statusFilter}</strong></span>}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={() => {
                setPdfDialogOpen(false);
                handleDownloadPDF(pdfComment);
              }}
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
