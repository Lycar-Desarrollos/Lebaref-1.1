export type EventCategory = 'work_order' | 'maintenance' | 'appointment' | 'reminder' | 'project';

export interface CalendarItem {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (24h), e.g. "09:00"
  endTime?: string; // HH:mm (24h), e.g. "11:30"
  allDay?: boolean;
  completed?: boolean;
  status?: string;
  priority?: 'Baja' | 'Media' | 'Alta';
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  serviceAddress?: string;
  technicianId?: string;
  technicianName?: string;
  otNumber?: string;
  projectId?: string;
  sourceCollection: 'ordenes_de_trabajo' | 'projects' | 'calendar_events' | 'calendar_reminders';
  createdAt?: any;
  raw?: any;
}

export interface Technician {
  id: string;
  name: string;
  email?: string;
  userCode?: string;
  role: string;
  color: string;
  avatarInitials: string;
}

export type ViewMode = 'day' | 'week' | 'month' | 'agenda';

export interface CategoryMeta {
  id: EventCategory;
  label: string;
  color: string; // Tailwind border/bg class or hex
  badgeClass: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  dotColor: string;
  iconName: string;
}

export const CATEGORY_CONFIG: Record<EventCategory, CategoryMeta> = {
  work_order: {
    id: 'work_order',
    label: 'Órdenes de Trabajo (OT)',
    color: '#0284c7', // Sky blue
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/30',
    pillBg: 'bg-sky-500/15 hover:bg-sky-500/25 dark:bg-sky-950/50 dark:hover:bg-sky-900/60',
    pillBorder: 'border-sky-500/40 dark:border-sky-500/30',
    pillText: 'text-sky-900 dark:text-sky-100',
    dotColor: 'bg-sky-500',
    iconName: 'ClipboardList',
  },
  maintenance: {
    id: 'maintenance',
    label: 'Mantenimientos Preventivos',
    color: '#10b981', // Emerald green
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30',
    pillBg: 'bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60',
    pillBorder: 'border-emerald-500/40 dark:border-emerald-500/30',
    pillText: 'text-emerald-900 dark:text-emerald-100',
    dotColor: 'bg-emerald-500',
    iconName: 'Wrench',
  },
  appointment: {
    id: 'appointment',
    label: 'Citas y Levantamientos',
    color: '#f59e0b', // Amber/gold
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30',
    pillBg: 'bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/50 dark:hover:bg-amber-900/60',
    pillBorder: 'border-amber-500/40 dark:border-amber-500/30',
    pillText: 'text-amber-900 dark:text-amber-100',
    dotColor: 'bg-amber-500',
    iconName: 'CalendarCheck',
  },
  reminder: {
    id: 'reminder',
    label: 'Recordatorios y Pendientes',
    color: '#8b5cf6', // Violet
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/30',
    pillBg: 'bg-purple-500/15 hover:bg-purple-500/25 dark:bg-purple-950/50 dark:hover:bg-purple-900/60',
    pillBorder: 'border-purple-500/40 dark:border-purple-500/30',
    pillText: 'text-purple-900 dark:text-purple-100',
    dotColor: 'bg-purple-500',
    iconName: 'CheckCircle2',
  },
  project: {
    id: 'project',
    label: 'Proyectos Generales',
    color: '#f97316', // Orange
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/30',
    pillBg: 'bg-orange-500/15 hover:bg-orange-500/25 dark:bg-orange-950/50 dark:hover:bg-orange-900/60',
    pillBorder: 'border-orange-500/40 dark:border-orange-500/30',
    pillText: 'text-orange-900 dark:text-orange-100',
    dotColor: 'bg-orange-500',
    iconName: 'Briefcase',
  },
};

export const TECH_COLORS = [
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
];
