"use client";

import React from "react";
import { CalendarItem, CATEGORY_CONFIG } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin, Phone, User, Clock, Calendar as CalendarIcon, ExternalLink,
  CheckCircle2, Trash2, Edit3, Briefcase, ClipboardList, Wrench,
  CalendarCheck, AlertCircle, ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface EventPopoverProps {
  item: CalendarItem;
  onEdit?: (item: CalendarItem) => void;
  onToggleComplete?: (item: CalendarItem) => void;
  onDelete?: (item: CalendarItem) => void;
  onClose?: () => void;
}

export function EventInspectorContent({
  item,
  onEdit,
  onToggleComplete,
  onDelete,
  onClose,
}: EventPopoverProps) {
  const router = useRouter();
  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.work_order;

  const address = item.serviceAddress || item.clientAddress;
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const isCompleted = item.completed || item.status === "Completada" || item.status === "Completado";

  const getInitials = (name?: string) => {
    if (!name) return "T";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-80 md:w-96 rounded-2xl p-4 bg-background/95 backdrop-blur-xl border border-border/70 shadow-2xl space-y-4 text-foreground animate-in fade-in-50 zoom-in-95 duration-150">
      {/* Header bar with Category & Status */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: catConfig.color }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {catConfig.label}
          </span>
        </div>
        {item.status && (
          <Badge
            variant="outline"
            className={cn("text-[11px] px-2 py-0.5 font-medium rounded-full shrink-0", {
              "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30":
                item.status === "Completada" || item.status === "Completado",
              "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30":
                item.status === "Asignada" || item.status === "En Proceso" || item.status === "En Progreso",
              "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30":
                item.status === "Pendiente" || item.status === "Nuevo",
              "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30":
                item.status === "Cancelada" || item.status === "En Pausa",
            })}
          >
            {item.status}
          </Badge>
        )}
      </div>

      {/* Title & Folio */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("text-base font-bold leading-snug", isCompleted && "line-through text-muted-foreground")}>
            {item.title}
          </h3>
          {item.otNumber && (
            <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5 shrink-0 bg-muted">
              {item.otNumber}
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>

      {/* Time & Date */}
      <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/40 p-2.5 border border-border/40 text-xs">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            {new Date(item.date + "T00:00:00").toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        {(item.startTime || item.allDay) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              {item.allDay
                ? "Todo el día"
                : `${item.startTime || "09:00"} ${item.endTime ? `- ${item.endTime}` : ""}`}
            </span>
          </div>
        )}
      </div>

      {/* Client Info (if available) */}
      {(item.clientName || address || item.clientPhone) && (
        <div className="space-y-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Detalles del Cliente / Sitio
          </span>
          {item.clientName && (
            <div className="flex items-center gap-2 font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{item.clientName}</span>
            </div>
          )}
          {item.clientPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a
                href={`tel:${item.clientPhone}`}
                className="text-primary hover:underline font-medium"
              >
                {item.clientPhone}
              </a>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="line-clamp-2">{address}</span>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-0.5"
                  >
                    Abrir en Google Maps
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assigned Technician (only if available) */}
      {item.technicianName && (
        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
          <span className="text-muted-foreground">Responsable:</span>
          <span className="font-semibold text-foreground truncate max-w-[160px]">
            {item.technicianName}
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <div className="flex items-center gap-1.5">
          {onToggleComplete && (
            <Button
              size="sm"
              variant={isCompleted ? "secondary" : "outline"}
              className="h-8 text-xs gap-1.5 rounded-lg"
              onClick={() => onToggleComplete(item)}
            >
              <CheckCircle2
                className={cn(
                  "h-3.5 w-3.5",
                  isCompleted ? "text-emerald-600 fill-emerald-600/20" : "text-muted-foreground"
                )}
              />
              {isCompleted ? "Hecho" : "Completar"}
            </Button>
          )}

          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(item)}
              title="Editar"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
              onClick={() => onDelete(item)}
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Deep link to Full Module */}
        {item.sourceCollection === "ordenes_de_trabajo" && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground font-medium"
            onClick={() => {
              if (onClose) onClose();
              router.push(`/admin/operaciones/ordenes-de-trabajo?highlight=${item.id}`);
            }}
          >
            Abrir OT
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}

        {item.sourceCollection === "projects" && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground font-medium"
            onClick={() => {
              if (onClose) onClose();
              router.push(`/admin/projects?highlight=${item.id}`);
            }}
          >
            Ver Proyecto
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
