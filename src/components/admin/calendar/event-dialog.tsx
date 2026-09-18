"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarItem, EventCategory, Technician, CATEGORY_CONFIG } from "./types";
import { Clock, Calendar as CalendarIcon, User, MapPin, Phone, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItem?: Partial<CalendarItem> | null;
  technicians: Technician[];
  onSave: (itemData: Partial<CalendarItem>) => Promise<void>;
}

export function EventDialog({
  open,
  onOpenChange,
  initialItem,
  technicians,
  onSave,
}: EventDialogProps) {
  const [category, setCategory] = useState<EventCategory>("appointment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [technicianId, setTechnicianId] = useState<string>("none");
  const [priority, setPriority] = useState<"Baja" | "Media" | "Alta">("Media");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialItem) {
        setCategory(initialItem.category || "appointment");
        setTitle(initialItem.title || "");
        setDescription(initialItem.description || "");
        setDate(initialItem.date || new Date().toISOString().split("T")[0]);
        setAllDay(initialItem.allDay ?? (initialItem.category === "reminder"));
        setStartTime(initialItem.startTime || "09:00");
        setEndTime(initialItem.endTime || "10:30");
        setClientName(initialItem.clientName || "");
        setClientPhone(initialItem.clientPhone || "");
        setClientAddress(initialItem.clientAddress || initialItem.serviceAddress || "");
        setTechnicianId(initialItem.technicianId || "none");
        setPriority(initialItem.priority || "Media");
      } else {
        setCategory("appointment");
        setTitle("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
        setAllDay(false);
        setStartTime("09:00");
        setEndTime("10:30");
        setClientName("");
        setClientPhone("");
        setClientAddress("");
        setTechnicianId("none");
        setPriority("Media");
      }
    }
  }, [open, initialItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setIsSaving(true);
    try {
      const selectedTech = technicians.find((t) => t.id === technicianId);
      await onSave({
        id: initialItem?.id,
        category,
        title: title.trim(),
        description: description.trim(),
        date,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        clientName: clientName.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        technicianId: technicianId !== "none" ? technicianId : undefined,
        technicianName: selectedTech ? selectedTech.name : undefined,
        priority,
        sourceCollection: initialItem?.sourceCollection || (category === "reminder" ? "calendar_reminders" : "calendar_events"),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!initialItem?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 shadow-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: CATEGORY_CONFIG[category].color }}
              />
              <DialogTitle className="text-xl font-bold">
                {isEditing ? "Editar Evento" : "Nuevo Evento en Calendario"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Programa citas, mantenimientos preventivos, órdenes de trabajo o pendientes estilo Apple.
            </DialogDescription>
          </DialogHeader>

          {/* Categoría Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tipo de Evento
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map((catKey) => {
                const config = CATEGORY_CONFIG[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => {
                      setCategory(catKey);
                      if (catKey === "reminder") setAllDay(true);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20 shadow-sm"
                        : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="truncate">{config.label.split("(")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-semibold">
              Título del Evento / Servicio <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Mantenimiento Chiller #2 o Cita de Levantamiento"
              className="rounded-xl border-border/70 text-sm"
              required
            />
          </div>

          {/* Fecha y Horario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/50">
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs font-semibold flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                Fecha <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg text-xs"
                required
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center space-x-2 pb-2">
                <Checkbox
                  id="allDay"
                  checked={allDay}
                  onCheckedChange={(checked) => setAllDay(!!checked)}
                />
                <Label htmlFor="allDay" className="text-xs font-medium cursor-pointer">
                  Evento de todo el día / Pendiente
                </Label>
              </div>
            </div>

            {!allDay && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="startTime" className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Hora Inicio
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime" className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Hora Fin
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-lg text-xs"
                  />
                </div>
              </>
            )}
          </div>

          {/* Prioridad y Técnico Asignado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prioridad</Label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Baja">Baja</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Alta">Alta (Urgente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Técnico Asignado</Label>
              <Select value={technicianId} onValueChange={(val) => setTechnicianId(val)}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Seleccionar técnico..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} {tech.userCode ? `(${tech.userCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datos del Cliente */}
          <div className="space-y-2.5 border-t border-border/50 pt-3">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
              Cliente y Ubicación (Opcional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre del Cliente o Empresa"
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Teléfono de contacto"
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
            <div>
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Dirección o ubicación del servicio"
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Observaciones / Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Notas / Observaciones
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instrucciones especiales, herramientas requeridas o detalles del trabajo..."
              rows={2}
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="border-t border-border/50 pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold gap-2"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Guardar Cambios" : "Crear Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
