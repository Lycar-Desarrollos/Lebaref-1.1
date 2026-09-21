"use client";

import React from "react";
import { ViewMode, CATEGORY_CONFIG, EventCategory } from "./types";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Search,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  Wrench,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CalendarToolbarProps {
  currentDate: Date;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewEvent: (category?: EventCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CalendarToolbar({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  sidebarOpen,
  onToggleSidebar,
  onNewEvent,
  searchQuery,
  onSearchChange,
}: CalendarToolbarProps) {
  // Format Date for macOS Header
  const getHeaderTitle = () => {
    if (viewMode === "month") {
      const monthStr = currentDate.toLocaleDateString("es-MX", { month: "long" });
      const yearStr = currentDate.getFullYear();
      return `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${yearStr}`;
    }
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startMonth = startOfWeek.toLocaleDateString("es-MX", { month: "short" });
      const endMonth = endOfWeek.toLocaleDateString("es-MX", { month: "short" });
      return `${startOfWeek.getDate()} ${startMonth} - ${endOfWeek.getDate()} ${endMonth} ${endOfWeek.getFullYear()}`;
    }
    return `Agenda - ${currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}`;
  };

  const viewOptions: { id: ViewMode; label: string }[] = [
    { id: "day", label: "Día" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
    { id: "agenda", label: "Agenda" },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm">
      {/* Left section: Sidebar toggle & Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60"
          title={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Hoy button (Google Calendar style pill with blue text and border) */}
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-9 px-5 text-sm font-medium rounded-full border border-[#747775]/70 dark:border-neutral-500 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#0b57d0] dark:text-sky-400 transition-colors shadow-none select-none"
        >
          Hoy
        </Button>

        {/* Previous and Next chevrons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className="h-9 w-9 rounded-full text-[#444746] dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-9 w-9 rounded-full text-[#444746] dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-[22px] font-normal text-[#1f1f1f] dark:text-neutral-100 capitalize tracking-normal ml-3 truncate max-w-[220px] sm:max-w-none select-none">
          {getHeaderTitle()}
        </h2>
      </div>

      {/* Center section: macOS Segmented Control */}
      <div className="flex items-center justify-center">
        <div className="inline-flex p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 shadow-inner">
          {viewOptions.map((opt) => {
            const isActive = viewMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onViewModeChange(opt.id)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 select-none",
                  isActive
                    ? "bg-background text-foreground font-bold shadow-sm ring-1 ring-border/50 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/30"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right section: Search & Action Button */}
      <div className="flex items-center gap-2 justify-end">
        <div className="relative max-w-[180px] sm:max-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar evento, OT o cliente..."
            className="pl-8 h-9 text-xs rounded-xl bg-background/50 border-border/60 focus:bg-background transition-all"
          />
        </div>

        {/* macOS Style Add Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 gap-1.5 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nuevo Evento</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl border-border/80 shadow-2xl">
            <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
              Crear en Calendario
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onNewEvent("appointment")}
              className="cursor-pointer gap-2.5 py-2 text-xs rounded-lg font-medium"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Cita / Levantamiento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onNewEvent("maintenance")}
              className="cursor-pointer gap-2.5 py-2 text-xs rounded-lg font-medium"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Mantenimiento Preventivo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onNewEvent("work_order")}
              className="cursor-pointer gap-2.5 py-2 text-xs rounded-lg font-medium"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Programar Orden de Trabajo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onNewEvent("reminder")}
              className="cursor-pointer gap-2.5 py-2 text-xs rounded-lg font-medium"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Recordatorio / Pendiente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
