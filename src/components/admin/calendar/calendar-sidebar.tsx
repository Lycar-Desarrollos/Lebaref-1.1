"use client";

import React from "react";
import {
  CalendarItem,
  EventCategory,
  Technician,
  CATEGORY_CONFIG,
} from "./types";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { es } from "date-fns/locale";
import {
  Layers,
  Users,
  Clock,
  ClipboardList,
  AlertCircle,
  Plus,
  CalendarPlus,
  ChevronRight,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarSidebarProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  selectedCategories: Record<EventCategory, boolean>;
  onToggleCategory: (cat: EventCategory) => void;
  onSelectAllCategories: () => void;
  technicians?: Technician[];
  selectedTechIds?: string[];
  onToggleTech?: (techId: string) => void;
  onSelectAllTechs?: () => void;
  unscheduledOTs: CalendarItem[];
  onScheduleOT: (otItem: CalendarItem) => void;
  items: CalendarItem[];
  totalItems?: CalendarItem[];
}

export function CalendarSidebar({
  currentDate,
  onSelectDate,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  unscheduledOTs,
  onScheduleOT,
  items,
  totalItems,
}: CalendarSidebarProps) {
  // Count items per category based on TOTAL unfiltered database items
  const countSource = totalItems || items;
  const categoryCounts = React.useMemo(() => {
    const counts: Record<EventCategory, number> = {
      work_order: 0,
      maintenance: 0,
      appointment: 0,
      reminder: 0,
      project: 0,
    };
    countSource.forEach((item) => {
      if (counts[item.category] !== undefined) {
        counts[item.category]++;
      }
    });
    return counts;
  }, [countSource]);

  return (
    <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
      {/* Mini Calendar Card (macOS frosted look) */}
      <div className="bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl p-4 shadow-sm">
        <Calendar
          mode="single"
          selected={currentDate}
          onSelect={(d) => d && onSelectDate(d)}
          locale={es}
          className="w-full pointer-events-auto"
          classNames={{
            months: "flex flex-col w-full",
            month: "w-full",
            caption: "flex items-center justify-between px-1 pb-3",
            caption_label: "text-sm font-bold text-foreground capitalize",
            nav: "flex items-center gap-1",
            nav_button:
              "h-7 w-7 flex items-center justify-center bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-muted/60 rounded-full transition-all",
            nav_button_previous: "relative",
            nav_button_next: "relative",
            table: "w-full border-collapse",
            head_row: "flex w-full mb-1",
            head_cell:
              "flex-1 text-center text-[11px] font-semibold text-muted-foreground uppercase",
            row: "flex w-full mt-1",
            cell: "flex-1 flex items-center justify-center p-0",
            day: "h-8 w-8 flex items-center justify-center text-xs font-medium rounded-full transition-all cursor-pointer hover:bg-muted/60 aria-selected:opacity-100",
            day_selected:
              "bg-primary text-primary-foreground font-bold hover:bg-primary hover:text-primary-foreground shadow-sm",
            day_today:
              "text-primary font-extrabold underline underline-offset-2",
            day_outside: "opacity-30",
            day_disabled: "opacity-20 cursor-default",
          }}
        />
      </div>

      {/* Capas y Categorías de Calendario */}
      <div className="bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Mis Calendarios</span>
          </div>
          <button
            onClick={onSelectAllCategories}
            className="text-[11px] text-primary hover:underline font-semibold"
          >
            Todos
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map((catKey) => {
            const config = CATEGORY_CONFIG[catKey];
            const isChecked = selectedCategories[catKey] ?? true;
            const count = categoryCounts[catKey] || 0;

            return (
              <label
                key={catKey}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs",
                  isChecked
                    ? "border-border/70 bg-muted/40 hover:bg-muted/70 shadow-2xs"
                    : "border-border/30 bg-muted/10 opacity-60 hover:opacity-90"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full shrink-0 shadow-xs ring-2 ring-background transition-transform",
                      isChecked ? "scale-105" : "opacity-50"
                    )}
                    style={{ backgroundColor: config.color }}
                  />
                  <span className={cn("truncate font-medium", isChecked ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors",
                    isChecked
                      ? "bg-background text-foreground border-border/70 shadow-2xs"
                      : "bg-muted/40 text-muted-foreground border-transparent"
                  )}>
                    {count}
                  </span>
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleCategory(catKey)}
                    className="rounded-md border-border/70 data-[state=checked]:bg-primary"
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>



      {/* Bandeja de OTs Pendientes de Programar */}
      <div className="bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
            <ClipboardList className="h-3.5 w-3.5 text-sky-500" />
            <span>Por Programar ({unscheduledOTs.length})</span>
          </div>
        </div>

        {unscheduledOTs.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500/70 mb-1" />
            ¡Todas las OTs están programadas!
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {unscheduledOTs.map((ot) => (
              <div
                key={ot.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('otId', ot.id);
                  e.dataTransfer.setData('otTitle', ot.title || '');
                  e.dataTransfer.effectAllowed = 'move';
                  (e.currentTarget as HTMLElement).style.opacity = '0.5';
                }}
                onDragEnd={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                className="p-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition-all text-xs space-y-1.5 group cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start gap-1.5">
                  {/* Drag handle */}
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-muted-foreground/70 transition-colors" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] px-1.5 py-0 font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/30"
                      >
                        {ot.otNumber || "OT"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {ot.priority}
                      </span>
                    </div>

                    <p className="font-semibold text-foreground truncate">{ot.title}</p>
                    {ot.clientName && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {ot.clientName}
                      </p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onScheduleOT(ot)}
                      className="w-full h-7 text-[11px] gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10 mt-1 font-semibold"
                    >
                      <CalendarPlus className="h-3 w-3" />
                      Asignar Fecha / Técnico
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
