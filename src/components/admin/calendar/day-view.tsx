"use client";

import React, { useState, useEffect } from "react";
import { CalendarItem, CATEGORY_CONFIG } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventInspectorContent } from "./event-popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayViewProps {
  currentDate: Date;
  items: CalendarItem[];
  technicians?: any[];
  onNewEventAtDate: (dateStr: string, hour?: string) => void;
  onEditItem: (item: CalendarItem) => void;
  onToggleComplete: (item: CalendarItem) => void;
  onDeleteItem: (item: CalendarItem) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 to 20:00
const HOUR_HEIGHT = 70; // 70px per hour for day view

export function DayView({
  currentDate,
  items,
  onNewEventAtDate,
  onEditItem,
  onToggleComplete,
  onDeleteItem,
}: DayViewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = currentDate.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];
  const isToday = dateStr === todayStr;

  // Filter items for current day
  const dayItems = items.filter((it) => it.date === dateStr);

  const allDayEvents = dayItems.filter(
    (it) => it.allDay || it.category === "reminder" || !it.startTime
  );
  const timedEvents = dayItems.filter(
    (it) => !it.allDay && it.category !== "reminder" && it.startTime
  );

  // Position calculation
  const getEventPosition = (item: CalendarItem) => {
    const [startH, startM] = (item.startTime || "09:00").split(":").map(Number);
    const [endH, endM] = (item.endTime || "10:30").split(":").map(Number);

    const startMinutesFrom7AM = (startH - 7) * 60 + (startM || 0);
    let durationMinutes = (endH - startH) * 60 + (endM - startM);
    if (durationMinutes <= 0) durationMinutes = 60;

    const top = (startMinutesFrom7AM / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 36);

    return { top, height };
  };

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTimeLine = isToday && currentHour >= 7 && currentHour <= 20;
  const currentTimeTop = ((currentHour - 7) * 60 + currentMinute) * (HOUR_HEIGHT / 60);

  return (
    <div className="flex flex-col h-full bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm overflow-hidden select-none">
      {/* Day Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-lg font-bold w-10 h-10 flex items-center justify-center rounded-2xl transition-all",
              isToday
                ? "bg-primary text-primary-foreground font-extrabold shadow-md ring-2 ring-primary/20"
                : "bg-muted text-foreground"
            )}
          >
            {currentDate.getDate()}
          </span>
          <div>
            <h3 className="font-bold text-foreground capitalize leading-tight">
              {currentDate.toLocaleDateString("es-MX", { weekday: "long" })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {dayItems.length} eventos programados para hoy
            </p>
          </div>
        </div>
      </div>

      {/* All-Day / Reminders Bar */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border/60 bg-muted/15 p-2.5 space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-1">
            Todo el Día / Pendientes
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {allDayEvents.map((item) => {
              const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.reminder;
              const isDone = item.completed || item.status === "Completada";

              return (
                <Popover key={item.id}>
                  <PopoverTrigger asChild>
                    <div
                      className={cn(
                        "p-2 rounded-xl text-xs font-medium border flex items-center justify-between gap-2 cursor-pointer transition-all shadow-2xs",
                        catConfig.pillBg,
                        catConfig.pillBorder,
                        catConfig.pillText,
                        isDone && "opacity-50 line-through"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={() => onToggleComplete(item)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded-md border-border/80 data-[state=checked]:bg-primary"
                        />
                        <span className="truncate font-semibold">{item.title}</span>
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
        </div>
      )}

      {/* Main Hourly Timeline Scrollable */}
      <div className="flex-1 overflow-y-auto relative">
        <div
          className="grid grid-cols-[70px_1fr] relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
        >
          {/* Time labels */}
          <div className="border-r border-border/50 bg-background/50 select-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-xs text-muted-foreground font-mono text-right pr-3 relative -top-3"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Grid column */}
          <div
            className="relative"
            onDoubleClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickY = e.clientY - rect.top;
              const hourClicked = Math.floor(clickY / HOUR_HEIGHT) + 7;
              onNewEventAtDate(dateStr, `${String(hourClicked).padStart(2, "0")}:00`);
            }}
          >
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-border/30 w-full"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Red Line */}
            {showCurrentTimeLine && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${currentTimeTop}px` }}
              >
                <div className="w-3 h-3 rounded-full bg-rose-500 -ml-1.5 shadow-sm ring-2 ring-background" />
                <div className="flex-1 h-[2px] bg-rose-500 shadow-xs" />
              </div>
            )}

            {/* Event Cards */}
            {timedEvents.map((item) => {
              const { top, height } = getEventPosition(item);
              const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;
              const isDone = item.completed || item.status === "Completada";

              return (
                <Popover key={item.id}>
                  <PopoverTrigger asChild>
                    <div
                      className={cn(
                        "absolute left-3 right-3 rounded-2xl p-3 cursor-pointer transition-all border shadow-md flex flex-col justify-between overflow-hidden backdrop-blur-xl group/card hover:scale-[1.005]",
                        catConfig.pillBg,
                        catConfig.pillBorder,
                        catConfig.pillText,
                        isDone && "opacity-60"
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        borderLeftWidth: "6px",
                        borderLeftColor: catConfig.color,
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono text-xs px-2 py-0.5 font-bold bg-background/80"
                            >
                              {item.startTime} - {item.endTime || "10:30"}
                            </Badge>
                            {item.otNumber && (
                              <Badge variant="secondary" className="font-mono text-xs font-bold">
                                {item.otNumber}
                              </Badge>
                            )}
                          </div>
                          {item.status && (
                            <Badge variant="outline" className="text-xs font-semibold">
                              {item.status}
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-bold text-sm text-foreground mt-1.5 truncate">
                          {item.title}
                        </h4>

                        {item.clientName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                            <User className="h-3 w-3" />
                            {item.clientName}
                          </p>
                        )}
                      </div>
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
        </div>
      </div>
    </div>
  );
}
