"use client";

import React from "react";
import { CalendarItem, CATEGORY_CONFIG } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventInspectorContent } from "./event-popover";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendaViewProps {
  items: CalendarItem[];
  onSelectDate: (date: Date) => void;
  onEditItem: (item: CalendarItem) => void;
  onToggleComplete: (item: CalendarItem) => void;
  onDeleteItem: (item: CalendarItem) => void;
}

export function AgendaView({
  items,
  onSelectDate,
  onEditItem,
  onToggleComplete,
  onDeleteItem,
}: AgendaViewProps) {
  // Sort items by date and then time
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = `${a.date || ""} ${a.startTime || "00:00"}`;
      const dateB = `${b.date || ""} ${b.startTime || "00:00"}`;
      return dateA.localeCompare(dateB);
    });
  }, [items]);

  // Group by date string
  const groupedByDate = React.useMemo(() => {
    const groups: {
      dateStr: string;
      date: Date;
      label: string;
      isToday: boolean;
      items: CalendarItem[];
    }[] = [];

    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const groupMap: Record<string, CalendarItem[]> = {};
    sortedItems.forEach((it) => {
      if (!it.date) return;
      if (!groupMap[it.date]) groupMap[it.date] = [];
      groupMap[it.date].push(it);
    });

    Object.keys(groupMap).forEach((dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      let label = d.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (dateStr === todayStr) {
        label = `Hoy - ${label}`;
      } else if (dateStr === tomorrowStr) {
        label = `Mañana - ${label}`;
      }

      groups.push({
        dateStr,
        date: d,
        label,
        isToday: dateStr === todayStr,
        items: groupMap[dateStr],
      });
    });

    return groups;
  }, [sortedItems]);

  if (groupedByDate.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[350px] p-8 text-center bg-background/80 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm text-muted-foreground space-y-3">
        <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mx-auto" />
        <div>
          <h3 className="font-bold text-foreground text-base">No hay eventos en la agenda</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            No se encontraron eventos o citas con los filtros y búsqueda aplicados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-220px)] pr-2">
      {groupedByDate.map((group) => (
        <div key={group.dateStr} className="space-y-2.5">
          {/* Group Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between py-2 px-3 bg-background/90 backdrop-blur-xl border-b border-border/60 rounded-xl">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  group.isToday ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                )}
              />
              <h4
                className={cn(
                  "text-xs font-bold capitalize tracking-tight",
                  group.isToday ? "text-primary text-sm font-extrabold" : "text-foreground"
                )}
              >
                {group.label}
              </h4>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {group.items.length} {group.items.length === 1 ? "evento" : "eventos"}
            </Badge>
          </div>

          {/* Event Cards in Group */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
            {group.items.map((item) => {
              const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;
              const isDone = item.completed || item.status === "Completada";

              return (
                <Popover key={item.id}>
                  <PopoverTrigger asChild>
                    <div
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all cursor-pointer bg-background/90 backdrop-blur-xl shadow-xs hover:shadow-md space-y-2 group/card flex flex-col justify-between",
                        isDone && "opacity-60"
                      )}
                      style={{
                        borderLeftWidth: "5px",
                        borderLeftColor: catConfig.color,
                      }}
                    >
                      <div className="space-y-1.5">
                        {/* Header: Category & Time */}
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-2 py-0.5 font-bold rounded-full", catConfig.badgeClass)}
                          >
                            {catConfig.label.split("(")[0]}
                          </Badge>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                            <Clock className="h-3 w-3 text-primary" />
                            <span>
                              {item.allDay ? "Todo el día" : `${item.startTime || "09:00"} ${item.endTime ? `- ${item.endTime}` : ""}`}
                            </span>
                          </div>
                        </div>

                        {/* Title & Folio */}
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={cn(
                              "font-bold text-sm text-foreground leading-snug group-hover/card:text-primary transition-colors",
                              isDone && "line-through text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </h4>
                          {item.otNumber && (
                            <Badge variant="secondary" className="font-mono text-[11px] font-semibold shrink-0">
                              {item.otNumber}
                            </Badge>
                          )}
                        </div>

                        {/* Client & Address info */}
                        {(item.clientName || item.clientAddress) && (
                          <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                            {item.clientName && (
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{item.clientName}</span>
                              </div>
                            )}
                            {item.clientAddress && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                                <span className="truncate">{item.clientAddress}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer: Technician & Status */}
                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {item.technicianName ? (
                            <>
                              <Avatar className="h-4 w-4 border border-primary/20">
                                <AvatarFallback className="text-[8px] font-bold">
                                  {item.technicianName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] font-semibold text-foreground truncate max-w-[120px]">
                                {item.technicianName}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              Sin técnico
                            </span>
                          )}
                        </div>

                        {item.status && (
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {item.status}
                          </Badge>
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
      ))}
    </div>
  );
}
