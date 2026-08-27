"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useTheme, Theme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  Check,
  BarChart3,
  Save,
  Loader2,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  Briefcase,
  ShoppingCart,
  Eye,
  CreditCard,
  Clock,
  Download,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type UserPreferences = {
  // Appearance
  theme?: Theme;

  // 1. Dashboard (Inicio) Preferences per account
  dashboardDefaultPeriod?: "este_mes" | "mes_anterior" | "trimestre" | "este_ano" | "historico";
  showDashboardStats?: boolean;
  dashboardShowQuotesCard?: boolean;
  dashboardShowPendingCard?: boolean;
  dashboardShowPurchaseOrdersCard?: boolean;
  dashboardShowProjectsCard?: boolean;
  dashboardShowProjectsSection?: boolean;

  // 2. Cuentas por Cobrar (CxC) Preferences per account
  defaultPeriod?: "este_mes" | "mes_anterior" | "trimestre" | "este_ano" | "historico";
  showExecutiveSummaryByDefault?: boolean;
  defaultCreditDays?: number;
  alertDaysBeforeDue?: number;
  includeMetricsInPdfReport?: boolean;
  includeLogoInPdfReport?: boolean;
  includeFiltersInPdfReport?: boolean;

  // 3. Notifications & Periodic Reports
  summarySendEmail?: string;
  summarySendFrequency?: "semanal" | "quincenal" | "mensual" | "nunca";
  notifyExpiringQuotes?: boolean;
  notifyCompletedOtNoInvoice?: boolean;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  dashboardDefaultPeriod: "este_mes",
  showDashboardStats: true,
  dashboardShowQuotesCard: true,
  dashboardShowPendingCard: true,
  dashboardShowPurchaseOrdersCard: true,
  dashboardShowProjectsCard: true,
  dashboardShowProjectsSection: true,
  defaultPeriod: "este_mes",
  showExecutiveSummaryByDefault: true,
  defaultCreditDays: 30,
  alertDaysBeforeDue: 7,
  includeMetricsInPdfReport: false,
  includeLogoInPdfReport: true,
  includeFiltersInPdfReport: true,
  summarySendEmail: "",
  summarySendFrequency: "mensual",
  notifyExpiringQuotes: true,
  notifyCompletedOtNoInvoice: true,
};

export default function ConfiguracionPage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Ref to remember the theme that was active when entering this page
  const originalThemeRef = useRef<Theme>(theme);
  // Ref to know if the user explicitly saved (so the cleanup effect doesn't revert)
  const savedRef = useRef(false);

  // On unmount: revert theme to what it was before if the user didn't save
  useEffect(() => {
    originalThemeRef.current = theme; // capture initial theme once mounted
    return () => {
      if (!savedRef.current) {
        const revertTo = originalThemeRef.current;
        // Update React state
        setTheme(revertTo);
        // Also revert localStorage and DOM immediately (synchronous) so navigating
        // to another page doesn't pick up the unsaved preview theme
        try {
          localStorage.setItem("lebaref_theme_preference", revertTo);
        } catch {}
        const isDark =
          revertTo === "dark" ||
          (revertTo === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (isDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [userProfile, setUserProfile] = useState<{
    displayName?: string;
    email?: string;
    role?: string;
    userCode?: string;
    createdAt?: any;
    permissions?: Record<string, boolean>;
  } | null>(null);

  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load user data & preferences from Firestore
  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({
            displayName: data.displayName || data.name || user.displayName || "Usuario",
            email: data.email || user.email || "",
            role: data.role || "employee",
            userCode: data.userCode || "00",
            createdAt: data.createdAt,
            permissions: data.permissions || {},
          });

          // Preferences loaded
          const savedPrefs = data.preferences || {};
          const loadedPrefs: UserPreferences = {
            ...DEFAULT_PREFERENCES,
            ...savedPrefs,
            summarySendEmail: savedPrefs.summarySendEmail || data.email || user.email || "",
            theme: data.theme || theme,
          };
          setPrefs(loadedPrefs);

          // Sync theme if different; also update original ref so revert goes to the saved value
          if (data.theme && data.theme !== theme) {
            setTheme(data.theme);
            originalThemeRef.current = data.theme;
          }
        }
      } catch (err) {
        console.error("Error al cargar configuración:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, authIsLoading]);

  // Handle Theme Selection — applies theme as a live preview; reverts on navigate away if not saved
  const handleSelectTheme = (newTheme: Theme) => {
    setTheme(newTheme); // preview only — cleanup effect reverts if user doesn't save
    setPrefs((prev) => ({ ...prev, theme: newTheme }));
  };

  // Save all settings to Firestore
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    try {
      setIsSaving(true);
      const userRef = doc(db, "users", user.uid);
      const chosenTheme = prefs.theme || theme;

      // Mark as saved so the cleanup effect won't revert the theme on navigate away
      savedRef.current = true;
      originalThemeRef.current = chosenTheme;

      // Apply theme globally upon explicit save
      setTheme(chosenTheme);

      await updateDoc(userRef, {
        preferences: prefs,
        theme: chosenTheme,
        updatedAt: new Date(),
      });

      // Save preference to localStorage as well for instant per-account access
      localStorage.setItem("cxc_show_summary_default", String(prefs.showExecutiveSummaryByDefault));
      localStorage.setItem("cxc_default_period", String(prefs.defaultPeriod));
      localStorage.setItem("dashboard_show_stats", String(prefs.showDashboardStats));
      localStorage.setItem("dashboard_default_period", String(prefs.dashboardDefaultPeriod || "este_mes"));
      localStorage.setItem("cxc_include_metrics_pdf", String(prefs.includeMetricsInPdfReport ?? false));
      localStorage.setItem("cxc_include_logo_pdf", String(prefs.includeLogoInPdfReport ?? true));
      localStorage.setItem("cxc_include_filters_pdf", String(prefs.includeFiltersInPdfReport ?? true));

      toast({
        title: "Configuración Guardada",
        description: "Tus preferencias y personalización de cuenta se han guardado exitosamente.",
      });
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los cambios. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Download Sample Executive PDF with User Preferences
  const handleDownloadSampleReportPDF = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const todayStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
      const primaryColor: [number, number, number] = [30, 62, 98];
      const pageW = doc.internal.pageSize.width;
      const pageH = doc.internal.pageSize.height;

      // 1. Corporate Header (With or without logo based on setting)
      const hasLogo = prefs.includeLogoInPdfReport !== false;
      if (hasLogo) {
        doc.addImage(LOGO_BASE64, "PNG", 14, 5, 36, 20.2);
      }

      const textLeft = hasLogo ? 56 : 14;
      doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(30, 62, 98);
      doc.text("REPORTE DE CUENTAS POR COBRAR", textLeft, 13);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 116, 139);
      doc.text("LEBAREF SERVICIO DE MANTENIMIENTO GENERAL", textLeft, 19);
      doc.text(`Fecha de emisión: ${todayStr} | Período: ${prefs.defaultPeriod || "Este Mes"} | Moneda: MXN`, textLeft, 24);

      // Company info (Right aligned)
      doc.setFontSize(7).setTextColor(90, 100, 110);
      doc.text("Calle 33 No. 259 Num int 2 por 12 y 14 Col. Santa María Chuburna", pageW - 14, 11, { align: "right" });
      doc.text("CP. 97138, Mérida, Yucatán | Tel: 990 101 0387", pageW - 14, 16, { align: "right" });
      doc.text(prefs.summarySendEmail || "corporativo@lebaref.com", pageW - 14, 21, { align: "right" });

      doc.setDrawColor(30, 62, 98).setLineWidth(0.8).line(14, 28, pageW - 14, 28);

      let startY = 32;

      // 2. Financial KPI Metric Cards (ONLY if enabled in preferences)
      if (prefs.includeMetricsInPdfReport === true) {
        const cardW = (pageW - 28 - 9) / 4;
        const cardH = 13;
        const cardY = 31;

        // Card 1
        doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240);
        doc.roundedRect(14, cardY, cardW, cardH, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(100, 116, 139).text("CARTERA TOTAL", 18, cardY + 4.5);
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(30, 41, 59).text("$125,480.00", 18, cardY + 10);

        // Card 2
        doc.setFillColor(240, 253, 244).setDrawColor(187, 247, 208);
        doc.roundedRect(14 + cardW + 3, cardY, cardW, cardH, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(22, 101, 52).text("TOTAL COBRADO (82%)", 18 + cardW + 3, cardY + 4.5);
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(21, 128, 61).text("$102,893.60", 18 + cardW + 3, cardY + 10);

        // Card 3
        doc.setFillColor(239, 246, 255).setDrawColor(191, 219, 254);
        doc.roundedRect(14 + (cardW + 3) * 2, cardY, cardW, cardH, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(30, 64, 175).text("SALDO PENDIENTE", 18 + (cardW + 3) * 2, cardY + 4.5);
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(29, 78, 216).text("$22,586.40", 18 + (cardW + 3) * 2, cardY + 10);

        // Card 4
        doc.setFillColor(254, 242, 242).setDrawColor(254, 202, 202);
        doc.roundedRect(14 + (cardW + 3) * 3, cardY, cardW, cardH, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(153, 27, 27).text("SALDO EN MORA", 18 + (cardW + 3) * 3, cardY + 4.5);
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(185, 28, 28).text("$0.00", 18 + (cardW + 3) * 3, cardY + 10);

        startY = cardY + cardH + 5;
      }

      // 3. Filters Description
      if (prefs.includeFiltersInPdfReport !== false) {
        doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(100, 116, 139);
        doc.text(`Filtros: Todos los registros de cartera | Período: ${prefs.defaultPeriod || "Este Mes"}`, 14, startY);
        startY += 4;
      }

      const tableData = [
        ["C01-0023", "OT01-0020", "F-10492", "GMX Seguros", "Mantenimiento HVAC", "$1,531.20", "$300.00", "$1,231.20", "13/08/2026", "28/08/2026", "—", "Abonada (En plazo)"],
        ["C01-0022", "OT01-0019", "Sin Factura", "GMX Seguros", "Instalación Eléctrica", "$1,941.60", "$0.00", "$1,941.60", "13/08/2026", "28/08/2026", "—", "Al corriente"],
        ["C01-0021", "OT01-0018", "F-10488", "Distribuidora Peninsular", "Póliza Mensual", "$15,200.00", "$15,200.00", "$0.00", "01/08/2026", "15/08/2026", "—", "Liquidada"],
        ["C01-0020", "OT01-0017", "F-10481", "Constructora Maya", "Refrigeración Industrial", "$4,800.00", "$4,800.00", "$0.00", "28/07/2026", "12/08/2026", "—", "Liquidada"],
      ];

      autoTable(doc, {
        startY: startY + 2,
        head: [["Folio", "OT", "Factura", "Cliente", "Servicio", "Total", "Abonado", "Pendiente", "Emisión", "Vencimiento", "Mora", "Estado"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 7.5, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 16 },
          2: { cellWidth: 18 },
          3: { cellWidth: 38 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
          8: { cellWidth: 17 },
          9: { cellWidth: 17 },
          10: { cellWidth: 13, halign: "center" },
          11: { cellWidth: 32 },
        },
      });

      // Footer
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageH - 9, pageW, 9, "F");
      doc.setFontSize(6.5).setTextColor(120).setFont("helvetica", "normal");
      doc.text(
        `LEBAREF | Reporte de Cuentas por Cobrar — Fecha: ${todayStr} | Documento Oficial de Control | Página 1 de 1`,
        pageW / 2,
        pageH - 3.5,
        { align: "center" }
      );

      doc.save(`Muestra_Reporte_CxC_LEBAREF_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({
        title: "Reporte Descargado",
        description: `Se ha generado el PDF con las preferencias seleccionadas (Métricas: ${prefs.includeMetricsInPdfReport ? "Activadas" : "Desactivadas"}).`,
      });
    } catch (err) {
      console.error("Error al generar PDF de muestra:", err);
      toast({
        title: "Error al descargar",
        description: "No se pudo generar el PDF de muestra.",
        variant: "destructive",
      });
    }
  };

  const hasCxcAccess =
    userProfile?.role === "admin" ||
    Boolean(
      userProfile?.permissions?.accounts_receivable ||
      userProfile?.permissions?.accounts_receivable_all ||
      userProfile?.permissions?.accounts_receivable_own ||
      userProfile?.permissions?.cuentas_por_cobrar
    );

  if (isLoading || authIsLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1e3e62]/10 text-[#1e3e62] dark:bg-blue-900/30 dark:text-blue-400 rounded-xl">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Configuración del Sistema
              </h1>
              <p className="text-sm text-muted-foreground">
                Personaliza de forma individual tu cuenta ({userProfile?.displayName || user?.email}), vistas de Inicio{hasCxcAccess ? " y CxC" : ""}, tema y reportes.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => handleSaveAll()}
          disabled={isSaving}
          className="bg-[#1e3e62] hover:bg-[#1e3e62]/90 text-white font-semibold gap-2 shadow-sm rounded-xl px-6 h-11 self-start sm:self-auto shrink-0"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar Cambios
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vistas" className="space-y-6">
        <TabsList className="grid grid-cols-1 sm:grid-cols-2 h-auto p-1 bg-muted rounded-xl gap-1">
          <TabsTrigger value="vistas" className="py-2.5 rounded-lg gap-2 text-xs sm:text-sm font-semibold">
            <LayoutDashboard className="h-4 w-4" />
            Vistas & Resúmenes
          </TabsTrigger>
          <TabsTrigger value="apariencia" className="py-2.5 rounded-lg gap-2 text-xs sm:text-sm font-semibold">
            <Sun className="h-4 w-4" />
            Apariencia & Tema
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: VISTAS & RESÚMENES (INICIO + CXC CONDICIONAL) ─ */}
        <TabsContent value="vistas" className="space-y-8">
          
          {/* ═══════════════════════════════════════════════════════════════════
              SECCIÓN 1: PANTALLA DE INICIO (DASHBOARD)
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {hasCxcAccess ? "Sección 1: Pantalla de Inicio (Dashboard)" : "Pantalla de Inicio (Dashboard)"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Personaliza los contadores, tarjetas y el rango de meses que se mostrarán en la pantalla principal.
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                Inicio / Dashboard
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Default Month Period for Inicio */}
              <Card className="rounded-2xl border">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Período de Meses Predeterminado en Inicio
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define qué rango de meses se cargará al ingresar a la pantalla principal con tu cuenta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="pref-dash-period" className="text-xs font-bold text-foreground">
                    Corte de Tiempo Inicial
                  </Label>
                  <Select
                    value={prefs.dashboardDefaultPeriod || "este_mes"}
                    onValueChange={(val: any) =>
                      setPrefs((prev) => ({ ...prev, dashboardDefaultPeriod: val }))
                    }
                  >
                    <SelectTrigger id="pref-dash-period" className="h-10 bg-card rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="este_mes">Este Mes (Mes en curso)</SelectItem>
                      <SelectItem value="mes_anterior">Mes Anterior (Cierre de mes previo)</SelectItem>
                      <SelectItem value="trimestre">Trimestre Actual</SelectItem>
                      <SelectItem value="este_ano">Año en Curso (YTD)</SelectItem>
                      <SelectItem value="historico">Histórico Global (Todo el historial)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Las estadísticas de cotizaciones y operaciones en Inicio se enfocarán en este período.
                  </p>
                </CardContent>
              </Card>

              {/* Master toggle for Inicio Stats */}
              <Card className="rounded-2xl border">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Visibilidad del Bloque Superior
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Activa o desactiva la fila completa de tarjetas de métricas en Inicio.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 transition-all">
                    <div className="space-y-0.5">
                      <Label htmlFor="toggle-dash-stats" className="text-xs font-bold text-foreground cursor-pointer">
                        Mostrar Bloque Superior de Métricas
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Habilita la barra con los contadores de cotizaciones y proyectos.
                      </p>
                    </div>
                    <Switch
                      id="toggle-dash-stats"
                      checked={prefs.showDashboardStats !== false}
                      onCheckedChange={(checked) =>
                        setPrefs((prev) => ({ ...prev, showDashboardStats: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              SECCIÓN 2: CUENTAS POR COBRAR (CXC) — SOLO SI TIENE PERMISOS
             ═══════════════════════════════════════════════════════════════════ */}
          {hasCxcAccess && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Sección 2: Cuentas por Cobrar (CxC)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Configura el período de corte, visualización del resumen de cartera y personalización de documentos PDF.
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  Cuentas por Cobrar
                </Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Default Month Period for CxC */}
                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Período de Meses Predeterminado en CxC
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Filtra automáticamente las cuentas por cobrar al mes o período deseado al entrar a CxC.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Label htmlFor="pref-default-period-cxc" className="text-xs font-bold text-foreground">
                      Período de Corte Inicial
                    </Label>
                    <Select
                      value={prefs.defaultPeriod || "este_mes"}
                      onValueChange={(val: any) =>
                        setPrefs((prev) => ({ ...prev, defaultPeriod: val }))
                      }
                    >
                      <SelectTrigger id="pref-default-period-cxc" className="h-10 bg-card rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="este_mes">Este Mes (Mes en curso)</SelectItem>
                        <SelectItem value="mes_anterior">Mes Anterior (Cierre de mes previo)</SelectItem>
                        <SelectItem value="trimestre">Trimestre Actual</SelectItem>
                        <SelectItem value="este_ano">Año en Curso (YTD)</SelectItem>
                        <SelectItem value="historico">Histórico Global (Toda la cartera)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      La tabla y el estado de cartera se enfocarán en este período al ingresar con tu usuario.
                    </p>
                  </CardContent>
                </Card>

                {/* On-Screen Executive Summary in CxC */}
                <Card className="rounded-2xl border">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Visualización en Pantalla de CxC
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Controla si deseas desplegar el panel de gráficas y KPIs al entrar a CxC.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 transition-all">
                      <div className="space-y-0.5">
                        <Label htmlFor="toggle-cxc-summary" className="text-xs font-bold text-foreground cursor-pointer">
                          Mostrar Resumen Ejecutivo al Entrar
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Despliega automáticamente las 4 tarjetas de saldo y métricas financieras en la página de CxC.
                        </p>
                      </div>
                      <Switch
                        id="toggle-cxc-summary"
                        checked={prefs.showExecutiveSummaryByDefault !== false}
                        onCheckedChange={(checked) =>
                          setPrefs((prev) => ({ ...prev, showExecutiveSummaryByDefault: checked }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Document PDF Report Customization */}
              <Card className="rounded-2xl border">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Personalización del Documento & Reporte PDF de CxC
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define qué elementos saldrán al generar o descargar el reporte en formato PDF.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-all">
                    <div className="space-y-0.5">
                      <Label htmlFor="toggle-pdf-metrics" className="text-xs font-bold text-foreground cursor-pointer">
                        Incluir Resumen Ejecutivo y Bloques de Métricas en el PDF
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Por defecto desactivado (genera la tabla limpia). Solo saldrán las tarjetas de métricas en el documento si activas esta opción.
                      </p>
                    </div>
                    <Switch
                      id="toggle-pdf-metrics"
                      checked={prefs.includeMetricsInPdfReport === true}
                      onCheckedChange={(checked) =>
                        setPrefs((prev) => ({ ...prev, includeMetricsInPdfReport: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-all">
                    <div className="space-y-0.5">
                      <Label htmlFor="toggle-pdf-logo" className="text-xs font-bold text-foreground cursor-pointer">
                        Incluir Logotipo Oficial LEBAREF en el Encabezado
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Inserta el logotipo oficial y membrete corporativo en la parte superior izquierda.
                      </p>
                    </div>
                    <Switch
                      id="toggle-pdf-logo"
                      checked={prefs.includeLogoInPdfReport !== false}
                      onCheckedChange={(checked) =>
                        setPrefs((prev) => ({ ...prev, includeLogoInPdfReport: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:bg-muted/20 transition-all">
                    <div className="space-y-0.5">
                      <Label htmlFor="toggle-pdf-filters" className="text-xs font-bold text-foreground cursor-pointer">
                        Incluir Detalle de Filtros y Período Aplicado
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Imprime en el documento la línea descriptiva con el rango de fechas y clientes.
                      </p>
                    </div>
                    <Switch
                      id="toggle-pdf-filters"
                      checked={prefs.includeFiltersInPdfReport !== false}
                      onCheckedChange={(checked) =>
                        setPrefs((prev) => ({ ...prev, includeFiltersInPdfReport: checked }))
                      }
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadSampleReportPDF}
                      className="h-10 rounded-xl gap-2 font-medium border-slate-300 hover:bg-slate-100 text-slate-700 shadow-2xs"
                    >
                      <Download className="h-4 w-4 text-emerald-600" />
                      Descargar Muestra de Reporte PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </TabsContent>

        {/* ── TAB 3: APARIENCIA & TEMA ────────────────────────────────────── */}
        <TabsContent value="apariencia" className="space-y-6">
          <Card className="rounded-2xl border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-500" />
                Tema Visual de la Interfaz
              </CardTitle>
              <CardDescription>
                Elige la apariencia visual que mejor se adapte a tus condiciones de trabajo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Light Mode Card */}
                <div
                  onClick={() => handleSelectTheme("light")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative flex flex-col justify-between ${
                    prefs.theme === "light"
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 rounded-xl">
                        <Sun className="h-6 w-6" />
                      </div>
                      {prefs.theme === "light" && (
                        <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Activo
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">Modo Claro</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fondo blanco luminoso y contrastes nítidos para ambientes con buena iluminación.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-2 bg-slate-100 rounded-lg border border-slate-200 pointer-events-none space-y-1.5">
                    <div className="h-2.5 w-12 bg-slate-300 rounded" />
                    <div className="h-2 w-full bg-white rounded shadow-2xs" />
                  </div>
                </div>

                {/* 2. Dark Mode Card */}
                <div
                  onClick={() => handleSelectTheme("dark")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative flex flex-col justify-between ${
                    prefs.theme === "dark"
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 rounded-xl">
                        <Moon className="h-6 w-6" />
                      </div>
                      {prefs.theme === "dark" && (
                        <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Activo
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">Modo Oscuro</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Paleta oscura de alto confort visual para reducir la fatiga ocular en jornadas largas.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-2 bg-slate-900 rounded-lg border border-slate-800 pointer-events-none space-y-1.5">
                    <div className="h-2.5 w-12 bg-slate-700 rounded" />
                    <div className="h-2 w-full bg-slate-800 rounded" />
                  </div>
                </div>

                {/* 3. System Mode Card */}
                <div
                  onClick={() => handleSelectTheme("system")}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative flex flex-col justify-between ${
                    prefs.theme === "system"
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                        <Laptop className="h-6 w-6" />
                      </div>
                      {prefs.theme === "system" && (
                        <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Activo
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">Tema del Sistema</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sincronización automática según la configuración del sistema operativo.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 pointer-events-none">
                    <div className="p-2 bg-white space-y-1">
                      <div className="h-2 w-8 bg-slate-300 rounded" />
                      <div className="h-2 w-full bg-slate-100 rounded" />
                    </div>
                    <div className="p-2 bg-slate-900 space-y-1">
                      <div className="h-2 w-8 bg-slate-700 rounded" />
                      <div className="h-2 w-full bg-slate-800 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Tema actualmente aplicado:</span>
                  <Badge variant="outline" className="capitalize font-mono font-bold">
                    {resolvedTheme === "dark" ? "🌙 Oscuro" : "☀️ Claro"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Los cambios se aplican de forma inmediata y persistente.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
