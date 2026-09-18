"use client";

import React, { useState, useEffect } from "react";
import { CalendarItem, CATEGORY_CONFIG } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventInspectorContent } from "./event-popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { cn } from "@/lib/utils";

interface WeekViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onSelectDate: (date: Date) => void;
  onDrillDownToDay?: (date: Date) => void;
  onNewEventAtDate: (dateStr: string, hour?: string) => void;
  onEditItem: (item: CalendarItem) => void;
  onToggleComplete: (item: CalendarItem) => void;
  onDeleteItem: (item: CalendarItem) => void;
  onDropOT?: (otId: string, dateStr: string) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 to 20:00 (7 AM to 8 PM)
const HOUR_HEIGHT = 60; // 60px per hour

export function WeekView({
  currentDate,
  items,
  onSelectDate,
  onDrillDownToDay,
  onNewEventAtDate,
  onEditItem,
  onToggleComplete,
  onDeleteItem,
  onDropOT,
}: WeekViewProps) {
  // Live current time tracker
  const [now, setNow] = useState(new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute 7 days of the week starting Monday
  const weekDays = React.useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const todayStr = now.toISOString().split("T")[0];

    const days: {
      date: Date;
      dateStr: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
    }[] = [];

    const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      days.push({
        date: d,
        dateStr,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentDate, now]);

  // Separate all-day / reminders vs timed events
  const { allDayByDate, timedByDate } = React.useMemo(() => {
    const allDayMap: Record<string, CalendarItem[]> = {};
    const timedMap: Record<string, CalendarItem[]> = {};

    weekDays.forEach((d) => {
      allDayMap[d.dateStr] = [];
      timedMap[d.dateStr] = [];
    });

    items.forEach((item) => {
      if (!item.date || !allDayMap[item.date]) return;

      if (item.allDay || item.category === "reminder" || !item.startTime) {
        allDayMap[item.date].push(item);
      } else {
        timedMap[item.date].push(item);
      }
    });

    return { allDayByDate: allDayMap, timedByDate: timedMap };
  }, [items, weekDays]);

  // Calculate pixel position for timed event
  const getEventPosition = (item: CalendarItem) => {
    const [startH, startM] = (item.startTime || "09:00").split(":").map(Number);
    const [endH, endM] = (item.endTime || "10:30").split(":").map(Number);

    const startMinutesFrom7AM = (startH - 7) * 60 + (startM || 0);
    let durationMinutes = (endH - startH) * 60 + (endM - startM);
    if (durationMinutes <= 0) durationMinutes = 60;

    const top = (startMinutesFrom7AM / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);

    return { top, height };
  };

  // Current time red line calculation
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTimeLine = currentHour >= 7 && currentHour <= 20;
  const currentTimeTop = ((currentHour - 7) * 60 + currentMinute) * (HOUR_HEIGHT / 60);

  return (
    <div className="flex flex-col h-full bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm overflow-hidden select-none">
      {/* Week Header Row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/60 bg-muted/30">
        {/* Timezone / GMT column header */}
        <div className="flex items-center justify-center p-2 border-r border-border/50 text-[10px] text-muted-foreground font-mono">
          GMT-6
        </div>

        {/* 7 Days Headers */}
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            onClick={() => onSelectDate(day.date)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDrillDownToDay?.(day.date);
            }}
            className={cn(
              "p-2 text-center border-r border-border/40 last:border-r-0 cursor-pointer transition-colors hover:bg-muted/40 group",
              day.isToday && "bg-primary/5 font-bold"
            )}
          >
            <span className="text-[11px] uppercase font-bold text-muted-foreground block">
              {day.dayName}
            </span>
            <div className="mt-1 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDrillDownToDay?.(day.date);
                }}
                title="Clic para ver este día en detalle"
                className={cn(
                  "text-sm w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer select-none",
                  day.isToday
                    ? "bg-primary text-primary-foreground font-extrabold shadow-md"
                    : "font-semibold text-foreground/80 group-hover:text-primary group-hover:bg-primary/10"
                )}
              >
                {day.dayNumber}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Top All-Day / Reminders Row (Apple Reminders Style) */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/60 bg-muted/15 min-h-[44px]">
        <div className="p-2 border-r border-border/50 flex items-center justify-center text-[10px] uppercase font-bold text-muted-foreground">
          Todo el día
        </div>

        {weekDays.map((day) => {
          const allDayEvents = allDayByDate[day.dateStr] || [];

          return (
            <div
              key={`allday-${day.dateStr}`}
              className="p-1.5 border-r border-border/40 last:border-r-0 space-y-1 overflow-y-auto max-h-24"
            >
              {allDayEvents.map((item) => {
                const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.reminder;
                const isDone = item.completed || item.status === "Completada";

                return (
                  <Popover key={item.id}>
                    <PopoverTrigger asChild>
                      <div
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-medium border flex items-center justify-between gap-1 cursor-pointer transition-all shadow-2xs",
                          catConfig.pillBg,
                          catConfig.pillBorder,
                          catConfig.pillText,
                          isDone && "opacity-50 line-through"
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={() => onToggleComplete(item)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-3.5 w-3.5 rounded border-border/80 data-[state=checked]:bg-primary"
                          />
                          <span className="truncate text-[11px] font-medium">{item.title}</span>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
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
            </div>
          );
        })}
      </div>

      {/* Hourly Grid Scrollable Area */}
      <div className="flex-1 overflow-y-auto relative">
        <div
          className="grid grid-cols-[60px_repeat(7,1fr)] relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
        >
          {/* Time Labels Column */}
          <div className="border-r border-border/50 select-none bg-background/50">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-[11px] text-muted-foreground font-mono text-right pr-2 relative -top-2.5"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 Day Columns */}
          {weekDays.map((day) => {
            const timedEvents = timedByDate[day.dateStr] || [];

            return (
              <div
                key={`grid-${day.dateStr}`}
                className={cn(
                  "relative border-r border-border/40 last:border-r-0 group/col transition-colors",
                  day.isToday && "bg-primary/[0.02]",
                  dragOverDate === day.dateStr && "ring-2 ring-inset ring-primary/40 bg-primary/5"
                )}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const hourClicked = Math.floor(clickY / HOUR_HEIGHT) + 7;
                  onNewEventAtDate(day.dateStr, `${String(hourClicked).padStart(2, "0")}:00`);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverDate(day.dateStr);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverDate(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const otId = e.dataTransfer.getData('otId');
                  if (otId && onDropOT) {
                    onDropOT(otId, day.dateStr);
                  }
                  setDragOverDate(null);
                }}
              >
                {/* Horizontal hour guide lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/30 w-full"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Live Current Time Red Line (Apple macOS Style) */}
                {day.isToday && showCurrentTimeLine && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: `${currentTimeTop}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-sm ring-2 ring-background" />
                    <div className="flex-1 h-[2px] bg-rose-500 shadow-xs" />
                  </div>
                )}

                {/* Timed Event Blocks */}
                {timedEvents.map((item) => {
                  const { top, height } = getEventPosition(item);
                  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;
                  const isDone = item.completed || item.status === "Completada";

                  return (
                    <Popover key={item.id}>
                      <PopoverTrigger asChild>
                        <div
                          className={cn(
                            "absolute left-1 right-1 rounded-xl p-2 cursor-pointer transition-all border shadow-sm flex flex-col justify-between overflow-hidden group/item backdrop-blur-md",
                            catConfig.pillBg,
                            catConfig.pillBorder,
                            catConfig.pillText,
                            isDone && "opacity-50"
                          )}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            borderLeftWidth: "4px",
                            borderLeftColor: catConfig.color,
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-[10px] font-semibold opacity-80">
                                {item.startTime} {item.endTime ? `- ${item.endTime}` : ""}
                              </span>
                              {item.otNumber && (
                                <span className="text-[9px] font-bold px-1 rounded bg-background/50">
                                  {item.otNumber}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-xs truncate leading-tight mt-0.5">
                              {item.title}
                            </p>

                            {item.clientName && height > 45 && (
                              <p className="text-[10px] opacity-75 truncate mt-0.5">
                                {item.clientName}
                              </p>
                            )}
                          </div>

                          {height > 55 && item.technicianName && (
                            <div className="flex items-center gap-1.5 mt-auto pt-1">
                              <Avatar className="h-4 w-4 border border-primary/20">
                                <AvatarFallback className="text-[8px] font-bold">
                                  {item.technicianName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] truncate opacity-85">
                                {item.technicianName}
                              </span>
                            </div>
                          )}
                        </div>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
