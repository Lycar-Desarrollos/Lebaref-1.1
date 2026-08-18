

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Loader2, PlusCircle, MoreHorizontal, Edit, Trash2,
  Package, AlertTriangle, DollarSign, Search, MapPin, Tag, Layers, Minus, Plus,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Textarea } from "../ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

// ─── Schema ─────────────────────────────────────────────────────────────────
// Campos nuevos son opcionales/con default para no romper documentos existentes
const sparePartSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  brand: z.string().min(2, { message: "La marca es requerida." }),
  sku: z.string().min(3, { message: "El SKU es requerido." }),
  price: z.coerce.number().min(0, { message: "El precio no puede ser negativo." }),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
  stock: z.coerce.number().min(0).default(0),
  stockMin: z.coerce.number().min(0).default(0),
  unidad: z.string().optional().default("PZA"),
  location: z.string().optional().default(""),
  category: z.string().optional().default(""),
});

export type SparePart = z.infer<typeof sparePartSchema>;

const CATEGORIES = ["Refrigeración", "Eléctrico", "Electrónico", "Mecánico", "Hidráulico", "Filtros", "Lubricantes", "Herramientas", "Otro"];
const UNIDADES = ["PZA", "KG", "LT", "MT", "ROLLO", "CAJA", "JGO", "SERVICIO"];

// ─── Badge de stock ──────────────────────────────────────────────────────────
function StockBadge({ stock, stockMin }: { stock: number; stockMin: number }) {
  if (stock === 0) {
    return <Badge variant="destructive" className="gap-1 text-xs whitespace-nowrap"><AlertTriangle className="h-3 w-3" />Sin stock</Badge>;
  }
  if (stock <= stockMin) {
    return <Badge className="gap-1 text-xs whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white"><AlertTriangle className="h-3 w-3" />Stock bajo</Badge>;
  }
  return <Badge className="gap-1 text-xs whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white"><Package className="h-3 w-3" />En stock</Badge>;
}

// ─── Tarjetas de resumen ─────────────────────────────────────────────────────
function SummaryCards({ parts }: { parts: SparePart[] }) {
  const totalPiezas = parts.reduce((s, p) => s + (p.stock ?? 0), 0);
  const valorInventario = parts.reduce((s, p) => s + (p.stock ?? 0) * (p.price ?? 0), 0);
  const enAlerta = parts.filter(p => (p.stock ?? 0) <= (p.stockMin ?? 0)).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="rounded-lg border bg-card p-4 flex items-center gap-4">
        <div className="p-2 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total en almacén</p>
          <p className="text-2xl font-bold">{totalPiezas.toLocaleString('es-MX')}</p>
          <p className="text-xs text-muted-foreground">piezas registradas</p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 flex items-center gap-4">
        <div className="p-2 rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Valor del inventario</p>
          <p className="text-2xl font-bold">${valorInventario.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">costo de almacén</p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4 flex items-center gap-4">
        <div className={`p-2 rounded-md ${enAlerta > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/40' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Artículos en alerta</p>
          <p className={`text-2xl font-bold ${enAlerta > 0 ? 'text-red-600' : ''}`}>{enAlerta}</p>
          <p className="text-xs text-muted-foreground">stock bajo o agotado</p>
        </div>
      </div>
    </div>
  );
}

// ─── Manager principal ───────────────────────────────────────────────────────
export function SparePartsManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  // Ajuste rápido de stock ±1
  const handleStockAdjust = useCallback(async (part: SparePart, delta: number) => {
    if (!part.id) return;
    const newStock = Math.max(0, (part.stock ?? 0) + delta);
    try {
      await updateDoc(doc(db, "spare_parts", part.id), { stock: newStock });
      toast({ title: delta > 0 ? "Stock aumentado" : "Stock reducido", description: `${part.name}: ${newStock} ${part.unidad ?? 'PZA'}` });
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `spare_parts/${part.id}`, operation: 'update' }));
    }
  }, [toast]);

  useEffect(() => {
    if (authIsLoading) { setIsLoading(true); return; }
    if (!user) { setIsLoading(false); setSpareParts([]); return; }
    const q = collection(db, "spare_parts");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partsData = snapshot.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name ?? "",
          brand: raw.brand ?? "",
          sku: raw.sku ?? "",
          price: raw.price ?? 0,
          description: raw.description ?? "",
          stock: raw.stock ?? 0,
          stockMin: raw.stockMin ?? 0,
          unidad: raw.unidad ?? "PZA",
          location: raw.location ?? "",
          category: raw.category ?? "",
        } as SparePart;
      });
      setSpareParts(partsData);
      setIsLoading(false);
    }, () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'spare_parts', operation: 'list' }));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, authIsLoading]);

  const handleSavePart = useCallback(async (data: Omit<SparePart, 'id'>) => {
    try {
      if (selectedPart?.id) {
        await updateDoc(doc(db, "spare_parts", selectedPart.id), data);
        toast({ title: "Refacción actualizada", description: `"${data.name}" fue actualizada.` });
      } else {
        await addDoc(collection(db, "spare_parts"), data);
        toast({ title: "Refacción creada", description: `"${data.name}" fue añadida al almacén.` });
      }
      setIsFormOpen(false);
      setSelectedPart(null);
    } catch {
      const op = selectedPart?.id ? 'update' : 'create';
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: selectedPart?.id ? `spare_parts/${selectedPart.id}` : 'spare_parts',
        operation: op,
        requestResourceData: data,
      }));
    }
  }, [selectedPart, toast]);

  const handleDeletePart = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "spare_parts", id));
      toast({ title: "Refacción eliminada", variant: "destructive" });
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `spare_parts/${id}`, operation: 'delete' }));
    }
  }, [toast]);

  const columns: ColumnDef<SparePart>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nombre / Marca",
      cell: ({ row }) => (
        <div>
          <p className="font-medium leading-tight">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.brand}</p>
        </div>
      ),
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{row.original.sku}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => row.original.category
        ? <Badge variant="outline" className="text-xs gap-1"><Tag className="h-2.5 w-2.5" />{row.original.category}</Badge>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: "stock",
      header: "Existencia",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <StockBadge stock={row.original.stock ?? 0} stockMin={row.original.stockMin ?? 0} />
          <span className="text-xs text-muted-foreground">
            {row.original.stock ?? 0} {row.original.unidad ?? 'PZA'} · mín {row.original.stockMin ?? 0}
          </span>
        </div>
      ),
    },
    {
      id: "stockControl",
      header: "Ajuste rápido",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => handleStockAdjust(row.original, -1)}
            disabled={(row.original.stock ?? 0) === 0}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{row.original.stock ?? 0}</span>
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => handleStockAdjust(row.original, 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Ubicación",
      cell: ({ row }) => row.original.location
        ? <span className="text-xs flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{row.original.location}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      accessorKey: "price",
      header: "Precio unit.",
      cell: ({ row }) => (
        <span className="font-medium text-sm">
          ${row.original.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => { setSelectedPart(row.original); setIsFormOpen(true); }}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-500">
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. <strong>{row.original.name}</strong> será eliminada permanentemente del almacén.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeletePart(row.original.id)} className="bg-destructive hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [handleDeletePart, handleStockAdjust]);

  const table = useReactTable({
    data: spareParts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
    globalFilterFn: (row, _, value) => {
      const q = value.toLowerCase();
      return (
        row.original.name?.toLowerCase().includes(q) ||
        row.original.brand?.toLowerCase().includes(q) ||
        row.original.sku?.toLowerCase().includes(q) ||
        (row.original.category ?? "").toLowerCase().includes(q) ||
        (row.original.location ?? "").toLowerCase().includes(q)
      );
    },
  });

  if (isLoading && authIsLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, marca, SKU, categoría..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setSelectedPart(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Refacción
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <p className="text-sm">No hay refacciones en el almacén.</p>
                    <p className="text-xs">Usa "Agregar Refacción" para comenzar.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} refacción(es)
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Pág. {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Siguiente
          </Button>
        </div>
      </div>

      <SparePartFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSavePart}
        part={selectedPart}
      />
    </div>
  );
}

// ─── Formulario de alta/edición ──────────────────────────────────────────────
interface SparePartFormDialogProps {
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: Omit<SparePart, 'id'>) => void;
  part: SparePart | null;
}

function SparePartFormDialog({ isOpen, onOpenChange, onSave, part }: SparePartFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof sparePartSchema>>({
    resolver: zodResolver(sparePartSchema),
    defaultValues: { name: "", brand: "", sku: "", price: 0, description: "", stock: 0, stockMin: 0, unidad: "PZA", location: "", category: "" },
  });

  useEffect(() => {
    if (isOpen) {
      if (part) {
        form.reset({ ...part, stock: part.stock ?? 0, stockMin: part.stockMin ?? 0, unidad: part.unidad ?? "PZA", location: part.location ?? "", category: part.category ?? "" });
      } else {
        form.reset({ name: "", brand: "", sku: "", price: 0, description: "", stock: 0, stockMin: 0, unidad: "PZA", location: "", category: "" });
      }
    }
  }, [part, isOpen, form]);

  const handleSubmit = async (data: z.infer<typeof sparePartSchema>) => {
    setIsSubmitting(true);
    await onSave(data);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{part ? 'Editar Refacción' : 'Agregar Nueva Refacción'}</DialogTitle>
          <DialogDescription>
            {part ? `Modifica los datos de "${part.name}".` : 'Completa los campos para registrar una nueva refacción en el almacén.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">

            {/* Identificación */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 border-b pb-1">Identificación</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre de la Refacción</FormLabel>
                    <FormControl><Input placeholder="Ej: Termostato bimetálico" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl><Input placeholder="Ej: Robertshaw" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Código</FormLabel>
                    <FormControl><Input placeholder="Ej: RS-5300-123" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Unitario ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Inventario */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 border-b pb-1">Control de Inventario</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock actual</FormLabel>
                    <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="stockMin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock mínimo</FormLabel>
                    <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unidad" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "PZA"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación</FormLabel>
                    <FormControl><Input placeholder="Ej: Estante A-3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 border-b pb-1">Descripción</p>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción / Notas</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe la refacción, compatibilidad con equipos, notas de uso, etc." className="min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {part ? 'Guardar cambios' : 'Agregar al almacén'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
