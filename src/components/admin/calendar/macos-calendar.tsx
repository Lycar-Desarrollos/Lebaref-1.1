"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarItem,
  EventCategory,
  Technician,
  ViewMode,
  TECH_COLORS,
  CATEGORY_CONFIG,
} from "./types";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarSidebar } from "./calendar-sidebar";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { AgendaView } from "./agenda-view";
import { EventDialog } from "./event-dialog";
import { Loader2 } from "lucide-react";

export function MacOSCalendar() {
  const { user, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();

  // Navigation and view states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // User Profile
  const [userProfile, setUserProfile] = useState<any>(null);

  // Data states
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarReminders, setCalendarReminders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<Record<EventCategory, boolean>>({
    work_order: true,
    maintenance: true,
    appointment: true,
    reminder: true,
    project: true,
  });

  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);

  // Dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CalendarItem> | null>(null);

  // Load User Profile
  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    const unsubProfile = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      },
      (err) => {
        console.warn("Error fetching user profile:", err);
      }
    );

    return () => unsubProfile();
  }, [user, authIsLoading]);

  // 1. Subscribe to Technicians / Users
  useEffect(() => {
    if (!user || authIsLoading) return;

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const techs: Technician[] = [];
        let colorIndex = 0;

        snapshot.docs.forEach((d) => {
          const u = d.data();
          const name = u.displayName || u.name || u.email?.split("@")[0] || "Usuario";
          const initials =
            name
              .split(" ")
              .filter(Boolean)
              .map((n: string) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "T";

          techs.push({
            id: d.id,
            name,
            email: u.email,
            userCode: u.userCode,
            role: u.role || "Técnico",
            color: TECH_COLORS[colorIndex % TECH_COLORS.length],
            avatarInitials: initials,
          });
          colorIndex++;
        });

        setTechnicians(techs);
        setSelectedTechIds(techs.map((t) => t.id));
      },
      (err) => {
        console.warn("Users subscription notice:", err.message);
      }
    );

    return () => unsubUsers();
  }, [user, authIsLoading]);

  // 2. Subscribe to Work Orders (ordenes_de_trabajo)
  useEffect(() => {
    if (!user || authIsLoading || !userProfile) return;

    const col = collection(db, "ordenes_de_trabajo");
    const isAdmin = userProfile.role === "admin" || userProfile.permissions?.work_orders || userProfile.permissions?.work_orders_all;
    const q = isAdmin ? col : query(col, where("userId", "==", user.uid));

    const unsubOTs = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWorkOrders(list);
      },
      (err) => {
        console.warn("Work orders subscription notice:", err.message);
      }
    );
    return () => unsubOTs();
  }, [user, authIsLoading, userProfile]);

  // 3. Subscribe to Projects
  useEffect(() => {
    if (!user || authIsLoading || !userProfile) return;

    const col = collection(db, "projects");
    const isAdmin = userProfile.role === "admin" || userProfile.permissions?.projects || userProfile.permissions?.calendar;
    const q = isAdmin ? col : query(col, where("userId", "==", user.uid));

    const unsubProjects = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProjects(list);
      },
      (err) => {
        console.warn("Projects subscription notice:", err.message);
      }
    );
    return () => unsubProjects();
  }, [user, authIsLoading, userProfile]);

  // 4. Subscribe to Calendar Events
  useEffect(() => {
    if (!user || authIsLoading || !userProfile) return;

    const col = collection(db, "calendar_events");
    const isAdmin = userProfile.role === "admin";
    const q = isAdmin ? col : query(col, where("userId", "==", user.uid));

    const unsubEvents = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCalendarEvents(list);
      },
      (err) => {
        console.warn("Calendar events subscription notice:", err.message);
      }
    );
    return () => unsubEvents();
  }, [user, authIsLoading, userProfile]);

  // 5. Subscribe to Calendar Reminders
  useEffect(() => {
    if (!user || authIsLoading) return;

    const unsubReminders = onSnapshot(
      collection(db, "calendar_reminders"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCalendarReminders(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn("Calendar reminders subscription notice:", err.message);
        setIsLoading(false);
      }
    );
    return () => unsubReminders();
  }, [user, authIsLoading]);

  // Unified items mapping
  const allItems: CalendarItem[] = useMemo(() => {
    const items: CalendarItem[] = [];

    // Map Work Orders
    workOrders.forEach((ot) => {
      const isMaintenance =
        ot.tipoServicio?.toLowerCase().includes("mantenimiento") ||
        ot.tipoTrabajo?.toLowerCase().includes("mantenimiento");

      const category: EventCategory = isMaintenance ? "maintenance" : "work_order";

      // If OT has a scheduledDate, add it as a scheduled calendar item
      if (ot.scheduledDate) {
        items.push({
          id: ot.id,
          title: ot.tipoTrabajo || ot.tipoServicio || `OT: ${ot.clientName || "Servicio"}`,
          description: ot.observations || ot.equipoLugar || "",
          category,
          date: ot.scheduledDate,
          startTime: ot.scheduledTime || "09:00",
          endTime: ot.scheduledEndTime || "11:30",
          allDay: false,
          status: ot.status || "Pendiente",
          priority: ot.priority || "Media",
          clientName: ot.clientName,
          clientPhone: ot.clientPhone,
          clientAddress: ot.clientAddress,
          serviceAddress: ot.serviceAddress,
          technicianId: ot.technicianId,
          technicianName: ot.technician || ot.responsable,
          otNumber: ot.otNumber,
          sourceCollection: "ordenes_de_trabajo",
          completed: ot.status === "Completada" || ot.status === "Completado",
          raw: ot,
        });
      }
    });

    // Map Projects
    projects.forEach((p) => {
      if (p.programmedDate) {
        items.push({
          id: p.id,
          title: `Proyecto: ${p.client || "Cliente"}`,
          description: p.description || "",
          category: "project",
          date: p.programmedDate,
          startTime: "09:00",
          endTime: "17:00",
          allDay: true,
          status: p.status || "Nuevo",
          priority: p.priority || "Media",
          clientName: p.client,
          technicianName: p.responsible,
          sourceCollection: "projects",
          completed: p.status === "Completado",
          raw: p,
        });
      }
    });

    // Map Custom Calendar Events
    calendarEvents.forEach((ev) => {
      if (ev.date) {
        items.push({
          id: ev.id,
          title: ev.title || "Evento",
          description: ev.description || "",
          category: ev.category || "appointment",
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          allDay: ev.allDay ?? false,
          status: ev.status || "Confirmado",
          priority: ev.priority || "Media",
          clientName: ev.clientName,
          clientPhone: ev.clientPhone,
          clientAddress: ev.clientAddress,
          serviceAddress: ev.serviceAddress,
          technicianId: ev.technicianId,
          technicianName: ev.technicianName,
          sourceCollection: "calendar_events",
          completed: ev.completed ?? false,
          raw: ev,
        });
      }
    });

    // Map Reminders
    calendarReminders.forEach((r) => {
      if (r.date) {
        items.push({
          id: r.id,
          title: r.title || "Pendiente",
          description: r.description || "",
          category: "reminder",
          date: r.date,
          allDay: true,
          sourceCollection: "calendar_reminders",
          completed: r.completed ?? false,
          priority: r.priority || "Media",
          raw: r,
        });
      }
    });

    return items;
  }, [workOrders, projects, calendarEvents, calendarReminders]);

  // Unscheduled OTs list — uses scheduledDate (not date which is the emission date)
  const unscheduledOTs = useMemo(() => {
    return workOrders
      .filter((ot) => !ot.scheduledDate && ot.status !== "Completada" && ot.status !== "Cancelada" && ot.status !== "Completado" && ot.status !== "Cancelado")
      .map(
        (ot) =>
          ({
            id: ot.id,
            title: ot.tipoTrabajo || ot.tipoServicio || `OT: ${ot.clientName}`,
            description: ot.observations || "",
            category: "work_order",
            date: "",
            status: ot.status || "Pendiente",
            priority: ot.priority || "Media",
            clientName: ot.clientName,
            otNumber: ot.otNumber,
            sourceCollection: "ordenes_de_trabajo",
            raw: ot,
          } as CalendarItem)
      );
  }, [workOrders]);

  // Filtered items based on category, tech, and search
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Category filter
      if (!selectedCategories[item.category]) return false;

      // Technician filter (if assigned)
      if (item.technicianId && !selectedTechIds.includes(item.technicianId)) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchClient = item.clientName?.toLowerCase().includes(q);
        const matchOT = item.otNumber?.toLowerCase().includes(q);
        const matchTech = item.technicianName?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchOT && !matchTech && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [allItems, selectedCategories, selectedTechIds, searchQuery]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    const nextDate = new Date(currentDate);
    if (viewMode === "month") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else if (viewMode === "week") {
      nextDate.setDate(nextDate.getDate() - 7);
    } else if (viewMode === "day") {
      nextDate.setDate(nextDate.getDate() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setCurrentDate(nextDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const nextDate = new Date(currentDate);
    if (viewMode === "month") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (viewMode === "week") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (viewMode === "day") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setCurrentDate(nextDate);
  }, [currentDate, viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Filter toggles
  const handleToggleCategory = (cat: EventCategory) => {
    setSelectedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSelectAllCategories = () => {
    const allSelected = Object.values(selectedCategories).every(Boolean);
    const updated: any = {};
    Object.keys(CATEGORY_CONFIG).forEach((k) => {
      updated[k] = !allSelected;
    });
    setSelectedCategories(updated);
  };

  const handleToggleTech = (techId: string) => {
    setSelectedTechIds((prev) =>
      prev.includes(techId) ? prev.filter((id) => id !== techId) : [...prev, techId]
    );
  };

  const handleSelectAllTechs = () => {
    if (selectedTechIds.length === technicians.length) {
      setSelectedTechIds([]);
    } else {
      setSelectedTechIds(technicians.map((t) => t.id));
    }
  };

  // Event handlers
  const handleNewEvent = (cat?: EventCategory) => {
    setEditingItem({
      category: cat || "appointment",
      date: currentDate.toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "10:30",
    });
    setEventDialogOpen(true);
  };

  const handleNewEventAtDate = (dateStr: string, hour?: string) => {
    setEditingItem({
      category: "appointment",
      date: dateStr,
      startTime: hour || "09:00",
      endTime: hour ? `${String(Number(hour.split(":")[0]) + 1).padStart(2, "0")}:${hour.split(":")[1]}` : "10:30",
    });
    setEventDialogOpen(true);
  };

  const handleEditItem = (item: CalendarItem) => {
    setEditingItem(item);
    setEventDialogOpen(true);
  };

  const handleScheduleOT = (otItem: CalendarItem) => {
    setEditingItem({
      ...otItem,
      date: currentDate.toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "11:30",
    });
    setEventDialogOpen(true);
  };

  const handleDropOT = useCallback(async (otId: string, dateStr: string) => {
    try {
      await updateDoc(doc(db, "ordenes_de_trabajo", otId), {
        scheduledDate: dateStr,      // calendar date — separate from emission date
        scheduledTime: "09:00",
        scheduledEndTime: "11:00",
      });
      toast({ title: "OT Programada ✓", description: `Agendada para el ${dateStr}.` });
    } catch (err: any) {
      toast({ title: "Error al programar OT", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const cleanUndefined = (obj: Record<string, any>) => {
    const result: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  };

  const handleSaveEvent = async (data: Partial<CalendarItem>) => {
    try {
      if (data.sourceCollection === "ordenes_de_trabajo" && data.id) {
        // Update OT calendar fields — scheduledDate is separate from the emission date (date field)
        const otData = cleanUndefined({
          scheduledDate: data.date || null,   // calendar date separate from emission date
          scheduledTime: data.startTime || "09:00",
          scheduledEndTime: data.endTime || "11:30",
          technicianId: data.technicianId || null,
          technician: data.technicianName || null,
          responsable: data.technicianName || null,
          priority: data.priority || "Media",
          observations: data.description || "",
        });
        await updateDoc(doc(db, "ordenes_de_trabajo", data.id), otData);
        toast({ title: "Orden de Trabajo Programada", description: `OT agendada para el ${data.date}.` });
      } else if (data.sourceCollection === "projects" && data.id) {
        const projData = cleanUndefined({
          programmedDate: data.date || null,
          responsible: data.technicianName || null,
          priority: data.priority || "Media",
        });
        await updateDoc(doc(db, "projects", data.id), projData);
        toast({ title: "Proyecto Actualizado", description: `Fecha programada actualizada.` });
      } else if (data.sourceCollection === "calendar_reminders") {
        if (data.id) {
          const remData = cleanUndefined({
            title: data.title || "",
            description: data.description || "",
            date: data.date || "",
            priority: data.priority || "Media",
          });
          await updateDoc(doc(db, "calendar_reminders", data.id), remData);
          toast({ title: "Recordatorio Actualizado" });
        } else {
          const remData = cleanUndefined({
            title: data.title || "",
            description: data.description || "",
            date: data.date || "",
            completed: false,
            priority: data.priority || "Media",
            userId: user?.uid || "admin",
            createdAt: serverTimestamp(),
          });
          await addDoc(collection(db, "calendar_reminders"), remData);
          toast({ title: "Recordatorio Creado" });
        }
      } else {
        // calendar_events
        if (data.id) {
          const evData = cleanUndefined({
            title: data.title || "",
            description: data.description || "",
            category: data.category || "appointment",
            date: data.date || "",
            allDay: data.allDay ?? false,
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            clientName: data.clientName || "",
            clientPhone: data.clientPhone || "",
            clientAddress: data.clientAddress || "",
            technicianId: data.technicianId || "",
            technicianName: data.technicianName || "",
            priority: data.priority || "Media",
          });
          await updateDoc(doc(db, "calendar_events", data.id), evData);
          toast({ title: "Evento Actualizado" });
        } else {
          const evData = cleanUndefined({
            title: data.title || "",
            description: data.description || "",
            category: data.category || "appointment",
            date: data.date || "",
            allDay: data.allDay ?? false,
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            clientName: data.clientName || "",
            clientPhone: data.clientPhone || "",
            clientAddress: data.clientAddress || "",
            technicianId: data.technicianId || "",
            technicianName: data.technicianName || "",
            priority: data.priority || "Media",
            userId: user?.uid || "admin",
            createdAt: serverTimestamp(),
          });
          await addDoc(collection(db, "calendar_events"), evData);
          toast({ title: "Evento Creado", description: "Evento agendado en el calendario." });
        }
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error al guardar",
        description: err.message || "No se pudo guardar el evento.",
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (item: CalendarItem) => {
    try {
      const nextDone = !item.completed;
      if (item.sourceCollection === "calendar_reminders") {
        await updateDoc(doc(db, "calendar_reminders", item.id), { completed: nextDone });
      } else if (item.sourceCollection === "calendar_events") {
        await updateDoc(doc(db, "calendar_events", item.id), { completed: nextDone });
      } else if (item.sourceCollection === "ordenes_de_trabajo") {
        await updateDoc(doc(db, "ordenes_de_trabajo", item.id), {
          status: nextDone ? "Completada" : "En Proceso",
        });
      } else if (item.sourceCollection === "projects") {
        await updateDoc(doc(db, "projects", item.id), {
          status: nextDone ? "Completado" : "En Progreso",
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (item: CalendarItem) => {
    try {
      if (item.sourceCollection === "calendar_events") {
        await deleteDoc(doc(db, "calendar_events", item.id));
        toast({ title: "Evento eliminado" });
      } else if (item.sourceCollection === "calendar_reminders") {
        await deleteDoc(doc(db, "calendar_reminders", item.id));
        toast({ title: "Recordatorio eliminado" });
      } else if (item.sourceCollection === "ordenes_de_trabajo") {
        // Quitar del calendario → limpia scheduledDate para que vuelva a "Por Programar"
        await updateDoc(doc(db, "ordenes_de_trabajo", item.id), {
          scheduledDate: null,
          scheduledTime: null,
          scheduledEndTime: null,
        });
        toast({ title: "OT desprogramada", description: "La OT volvió a la bandeja Por Programar." });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)] min-h-[680px]">
      {/* Top macOS Toolbar */}
      <CalendarToolbar
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onNewEvent={handleNewEvent}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Collapsible Left Sidebar */}
        {sidebarOpen && (
          <div className="hidden lg:block overflow-y-auto max-h-full pr-1">
            <CalendarSidebar
              currentDate={currentDate}
              onSelectDate={setCurrentDate}
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
              onSelectAllCategories={handleSelectAllCategories}
              unscheduledOTs={unscheduledOTs}
              onScheduleOT={handleScheduleOT}
              items={filteredItems}
              totalItems={allItems}
            />
          </div>
        )}

        {/* Calendar View Area */}
        <div className="flex-1 h-full overflow-hidden">
          {viewMode === "month" && (
            <MonthView
              currentDate={currentDate}
              items={filteredItems}
              onSelectDate={setCurrentDate}
              onDrillDownToDay={(d) => {
                setCurrentDate(d);
                setViewMode("day");
              }}
              onNewEventAtDate={handleNewEventAtDate}
              onEditItem={handleEditItem}
              onToggleComplete={handleToggleComplete}
              onDeleteItem={handleDeleteItem}
              onDropOT={handleDropOT}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              currentDate={currentDate}
              items={filteredItems}
              onSelectDate={setCurrentDate}
              onDrillDownToDay={(d) => {
                setCurrentDate(d);
                setViewMode("day");
              }}
              onNewEventAtDate={handleNewEventAtDate}
              onEditItem={handleEditItem}
              onToggleComplete={handleToggleComplete}
              onDeleteItem={handleDeleteItem}
              onDropOT={handleDropOT}
            />
          )}

          {viewMode === "day" && (
            <DayView
              currentDate={currentDate}
              items={filteredItems}
              technicians={technicians}
              onNewEventAtDate={handleNewEventAtDate}
              onEditItem={handleEditItem}
              onToggleComplete={handleToggleComplete}
              onDeleteItem={handleDeleteItem}
            />
          )}

          {viewMode === "agenda" && (
            <AgendaView
              items={filteredItems}
              onSelectDate={setCurrentDate}
              onEditItem={handleEditItem}
              onToggleComplete={handleToggleComplete}
              onDeleteItem={handleDeleteItem}
            />
          )}
        </div>
      </div>

      {/* Event Creation & Edit Dialog */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        initialItem={editingItem}
        technicians={technicians}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
