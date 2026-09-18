"use client";

import React, { useState } from "react";
import { CalendarItem, CATEGORY_CONFIG } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventInspectorContent } from "./event-popover";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onSelectDate: (date: Date) => void;
  onDrillDownToDay?: (date: Date) => void;
  onNewEventAtDate: (dateStr: string) => void;
  onEditItem: (item: CalendarItem) => void;
  onToggleComplete: (item: CalendarItem) => void;
  onDeleteItem: (item: CalendarItem) => void;
  onDropOT?: (otId: string, dateStr: string) => void;
}

export function MonthView({
  currentDate,
  items,
  onSelectDate,
  onDrillDownToDay,
  onNewEventAtDate,
  onEditItem,
  onToggleComplete,
  onDeleteItem,
  onDropOT,
}: MonthViewProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysOfWeek = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Compute month days matrix (Monday as 1st day of week)
  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDay = firstDayOfMonth.getDay(); // 0 is Sunday
    startDay = startDay === 0 ? 6 : startDay - 1; // convert to 0 = Monday

    const totalDays = lastDayOfMonth.getDate();

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: {
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split("T")[0];

    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Group items by date
  const itemsByDate = React.useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    items.forEach((item) => {
      if (!item.date) return;
      if (!map[item.date]) {
        map[item.date] = [];
      }
      map[item.date].push(item);
    });
    return map;
  }, [items]);

  const MAX_VISIBLE_EVENTS = 3;

  return (
    <div className="flex flex-col h-full bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm overflow-hidden select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40 text-center py-2.5">
        {daysOfWeek.map((dayName, idx) => (
          <div
            key={dayName}
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              idx >= 5 ? "text-muted-foreground/70" : "text-muted-foreground"
            )}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-border/50 bg-background/40">
        {calendarDays.map((cell) => {
          const dayEvents = itemsByDate[cell.dateStr] || [];
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
          const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.date)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onDrillDownToDay?.(cell.date);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverDate(cell.dateStr);
              }}
              onDragLeave={(e) => {
                // Only clear if leaving this cell entirely (not entering a child)
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverDate(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const otId = e.dataTransfer.getData('otId');
                if (otId && onDropOT) {
                  onDropOT(otId, cell.dateStr);
                }
                setDragOverDate(null);
              }}
              className={cn(
                "min-h-[110px] p-2 transition-colors flex flex-col justify-between group relative cursor-pointer",
                cell.isCurrentMonth ? "bg-background/60 hover:bg-muted/30" : "bg-muted/15 opacity-40 hover:opacity-75",
                dragOverDate === cell.dateStr && "ring-2 ring-inset ring-primary/40 bg-primary/5 opacity-100"
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDrillDownToDay?.(cell.date);
                  }}
                  title="Clic para ver este día en detalle"
                  className={cn(
                    "text-xs w-7 h-7 flex items-center justify-center rounded-full transition-all cursor-pointer select-none",
                    cell.isToday
                      ? "bg-primary text-primary-foreground font-extrabold shadow-md"
                      : "font-semibold text-foreground/80 group-hover:text-primary group-hover:bg-primary/10"
                  )}
                >
                  {cell.dayNumber}
                </button>

                {/* Quick Add icon on cell hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewEventAtDate(cell.dateStr);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-opacity"
                  title="Agregar evento en esta fecha"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Event Pills List */}
              <div className="space-y-1 my-1 flex-1 overflow-hidden">
                {visibleEvents.map((item) => {
                  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;
                  const isDone = item.completed || item.status === "Completada" || item.status === "Completado";

                  return (
                    <Popover key={item.id}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 truncate shadow-2xs group/pill",
                            catConfig.pillBg,
                            catConfig.pillBorder,
                            catConfig.pillText,
                            isDone && "opacity-60 line-through"
                          )}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: catConfig.color }}
                          />
                          {!item.allDay && item.startTime && (
                            <span className="font-mono text-[10px] opacity-75 shrink-0">
                              {item.startTime}
                            </span>
                          )}
                          <span className="truncate flex-1">{item.title}</span>
                          {item.technicianName && (
                            <Avatar className="h-3.5 w-3.5 shrink-0 opacity-80 border border-primary/20">
                              <AvatarFallback className="text-[8px] font-bold">
                                {item.technicianName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        className="p-0 border-none bg-transparent shadow-none"
                      >
                        <EventInspectorContent
                          item={item}
                          onEdit={onEditItem}
                          onToggleComplete={onToggleComplete}
                          onDelete={onDeleteItem}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                })}

                {/* Overflow Pill (+X más) */}
                {hiddenCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded bg-muted/60 w-full text-left"
                      >
                        +{hiddenCount} más...
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      className="w-64 p-2 bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl space-y-1.5"
                    >
                      <div className="text-xs font-bold text-foreground pb-1 border-b border-border/50">
                        Eventos del {cell.dayNumber}
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {dayEvents.map((item) => (
                          <Popover key={item.id}>
                            <PopoverTrigger asChild>
                              <div className="text-xs p-1.5 rounded-lg bg-muted/40 hover:bg-muted font-medium cursor-pointer flex items-center justify-between">
                                <span className="truncate">{item.title}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.startTime || "Todo el día"}
                                </span>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              side="right"
                              className="p-0 border-none bg-transparent shadow-none"
                            >
                              <EventInspectorContent
                                item={item}
                                onEdit={onEditItem}
                                onToggleComplete={onToggleComplete}
                                onDelete={onDeleteItem}
                              />
                            </PopoverContent>
                          </Popover>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
