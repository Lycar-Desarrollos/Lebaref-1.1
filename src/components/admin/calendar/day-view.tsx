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
  onDropOT?: (otId: string, dateStr: string) => void;
  onMoveItem?: (item: CalendarItem, targetDate: string, targetHour?: string) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 to 20:00
const HOUR_HEIGHT = 70; // 70px per hour for day view

export function DayView({
  currentDate,
  items,
  technicians,
  onNewEventAtDate,
  onEditItem,
  onToggleComplete,
  onDeleteItem,
  onDropOT,
  onMoveItem,
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

  // Calculate overlapping layout so multiple events in the same time slot share columns side-by-side
  const getEventLayoutMap = (events: CalendarItem[]) => {
    const sorted = [...events].sort((a, b) => {
      const [ah, am] = (a.startTime || "09:00").split(":").map(Number);
      const [bh, bm] = (b.startTime || "09:00").split(":").map(Number);
      return (ah * 60 + (am || 0)) - (bh * 60 + (bm || 0));
    });

    const parsed = sorted.map((item) => {
      const [sh, sm] = (item.startTime || "09:00").split(":").map(Number);
      const [eh, em] = (item.endTime || "10:30").split(":").map(Number);
      const start = sh * 60 + (sm || 0);
      const end = Math.max(start + 30, eh * 60 + (em || 0));
      return { item, start, end };
    });

    const clusters: (typeof parsed)[] = [];
    let currentCluster: typeof parsed = [];
    let clusterEnd = -1;

    parsed.forEach((ev) => {
      if (currentCluster.length === 0 || ev.start < clusterEnd) {
        currentCluster.push(ev);
        clusterEnd = Math.max(clusterEnd, ev.end);
      } else {
        clusters.push(currentCluster);
        currentCluster = [ev];
        clusterEnd = ev.end;
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    const layoutMap: Record<string, { colIndex: number; totalCols: number }> = {};
    clusters.forEach((cluster) => {
      const columns: number[] = [];
      cluster.forEach((ev) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          if (columns[i] <= ev.start) {
            columns[i] = ev.end;
            layoutMap[ev.item.id] = { colIndex: i, totalCols: 1 };
            placed = true;
            break;
          }
        }
        if (!placed) {
          layoutMap[ev.item.id] = { colIndex: columns.length, totalCols: 1 };
          columns.push(ev.end);
        }
      });

      const totalCols = columns.length;
      cluster.forEach((ev) => {
        if (layoutMap[ev.item.id]) {
          layoutMap[ev.item.id].totalCols = totalCols;
        }
      });
    });

    return layoutMap;
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const itemJson = e.dataTransfer.getData('calendarItem');
            if (itemJson && onMoveItem) {
              try {
                const item = JSON.parse(itemJson);
                if (item) {
                  onMoveItem(item, dateStr);
                }
              } catch (err) {
                console.error("Failed to parse dragged calendar item:", err);
              }
            }
          }}
          className="border-b border-border/60 bg-muted/15 p-2.5 space-y-1.5"
        >
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
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('calendarItem', JSON.stringify(item));
                        e.dataTransfer.effectAllowed = 'move';
                        (e.currentTarget as HTMLElement).style.opacity = '0.4';
                      }}
                      onDragEnd={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = '1';
                      }}
                      className={cn(
                        "p-2 rounded-xl text-xs font-medium border flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing transition-all shadow-2xs",
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
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              const hourDropped = Math.max(7, Math.min(20, Math.floor(dropY / HOUR_HEIGHT) + 7));
              const targetHour = `${String(hourDropped).padStart(2, "0")}:00`;

              const otId = e.dataTransfer.getData('otId');
              if (otId && onDropOT) {
                onDropOT(otId, dateStr);
              }
              const itemJson = e.dataTransfer.getData('calendarItem');
              if (itemJson && onMoveItem) {
                try {
                  const item: CalendarItem = JSON.parse(itemJson);
                  if (item) {
                    onMoveItem(item, dateStr, targetHour);
                  }
                } catch (err) {
                  console.error("Failed to parse dragged calendar item:", err);
                }
              }
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
            {(() => {
              const layoutMap = getEventLayoutMap(timedEvents);
              return timedEvents.map((item) => {
                const { top, height } = getEventPosition(item);
                const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;
                const isDone = item.completed || item.status === "Completada";
                const layout = layoutMap[item.id] || { colIndex: 0, totalCols: 1 };
                const widthPercent = 100 / layout.totalCols;
                const leftPercent = layout.colIndex * widthPercent;
                const isVeryNarrow = layout.totalCols >= 4;
                const isNarrow = layout.totalCols >= 2 && !isVeryNarrow;

                return (
                  <Popover key={item.id}>
                    <PopoverTrigger asChild>
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('calendarItem', JSON.stringify(item));
                          e.dataTransfer.effectAllowed = 'move';
                          (e.currentTarget as HTMLElement).style.opacity = '0.4';
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                        className={cn(
                          "absolute rounded-2xl cursor-grab active:cursor-grabbing transition-all border shadow-sm flex flex-col justify-between overflow-hidden backdrop-blur-xl group/card hover:shadow-md",
                          isVeryNarrow ? "p-2" : isNarrow ? "p-2.5" : "p-3",
                          catConfig.pillBg,
                          catConfig.pillBorder,
                          catConfig.pillText,
                          isDone && "opacity-60"
                        )}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: layout.totalCols > 1 ? `calc(${leftPercent}% + 4px)` : "12px",
                          width: layout.totalCols > 1 ? `calc(${widthPercent}% - 8px)` : "calc(100% - 24px)",
                          borderLeftWidth: isVeryNarrow ? "4px" : "6px",
                          borderLeftColor: catConfig.color,
                        }}
                      >
                        <div className="min-w-0">
                          {/* Top row: Time and Badges */}
                          {isVeryNarrow ? (
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-[10px] font-bold px-1 py-0.5 rounded bg-background/80 truncate">
                                {item.startTime}
                              </span>
                              {item.otNumber && (
                                <span className="font-mono text-[9px] font-bold px-1 py-0.5 rounded bg-secondary/80 truncate shrink-0">
                                  {item.otNumber}
                                </span>
                              )}
                            </div>
                          ) : isNarrow ? (
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1 truncate">
                                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-background/80 truncate">
                                  {item.startTime} {item.endTime ? `- ${item.endTime}` : ""}
                                </span>
                                {item.otNumber && (
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary/80 truncate">
                                    {item.otNumber}
                                  </span>
                                )}
                              </div>
                              {item.status && (
                                <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0 shrink-0">
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                          ) : (
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
                          )}

                          {/* Title */}
                          <h4
                            className={cn(
                              "font-bold text-foreground mt-1 truncate leading-tight",
                              isVeryNarrow ? "text-xs" : isNarrow ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                            )}
                          >
                            {item.title}
                          </h4>

                          {/* Client Name */}
                          {item.clientName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.clientName}</span>
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
            });
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}
