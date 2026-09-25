
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Briefcase, FileText, Users, ShoppingCart, Truck, User, LogOut, Menu, Wrench, Package, Calendar, AreaChart, DollarSign, ClipboardList, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

type UserProfile = {
    displayName?: string;
    name?: string;
    role: 'admin' | 'employee';
    jobTitle?: string;
    department?: string;
    permissions?: { [key: string]: boolean };
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, isLoading: authIsLoading } = useAuth();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    useEffect(() => {
        if (authIsLoading) return;
        if (!user) {
            router.push('/');
            return;
        }

        setIsProfileLoading(true);
        const docRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
            } else {
                console.error("User profile document not found!");
                setUserProfile(null);
            }
            setIsProfileLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'get',
            }));
            setIsProfileLoading(false);
        });

        return () => unsubscribe();
    }, [user, authIsLoading, router]);

    const hasAccess = (module: string) => {
        if (userProfile?.role === 'admin') return true;
        return userProfile?.permissions?.[module] ?? false;
    };

    const mainLinks = [
        { href: "/admin", label: "Inicio", icon: Home, id: "dashboard", exact: true },
        { href: "/admin/projects", label: "Proyectos", icon: Briefcase, id: "projects" },
    ].filter(link => hasAccess(link.id) || link.id === 'dashboard');
    
    const salesLinks = [
        { href: "/admin/quotes", label: "Cotizaciones", icon: FileText, id: "quotes" },
        { href: "/admin/clients", label: "Clientes", icon: Users, id: "clients" },
    ].filter(link => hasAccess(link.id));

    const operacionesLinks = [
        { href: "/admin/operaciones/ordenes-de-trabajo", label: "Órdenes de Trabajo", icon: ClipboardList, id: "work_orders" },
    ].filter(link => hasAccess(link.id));
    
    const purchasesLinks = [
        { href: "/admin/purchase-orders", label: "Órdenes de Compra", icon: ShoppingCart, id: "purchase_orders" },
        { href: "/admin/suppliers", label: "Proveedores", icon: Truck, id: "suppliers" },
    ].filter(link => hasAccess(link.id));
    
    const warehouseLinks = [
        { href: "/admin/services", label: "Servicios", icon: Wrench, id: "services" },
        { href: "/admin/spare-parts", label: "Refacciones", icon: Package, id: "spare_parts" },
    ].filter(link => hasAccess(link.id));

    const toolsLinks = [
        { href: "/admin/calendar", label: "Calendario", icon: Calendar, id: "calendar"},
        { href: "/admin/reports", label: "Reportes", icon: AreaChart, id: "reports" },
    ].filter(link => hasAccess(link.id));

    const cobranzaLinks = [
        { href: "/admin/cuentas-por-cobrar", label: "Cuentas por Cobrar", icon: DollarSign, id: "accounts_receivable" },
    ].filter(link => hasAccess(link.id) || hasAccess("cuentas_por_cobrar"));

    const adminControlLink = { href: "/admin/users", label: "Control de Usuarios", icon: User, id: "users" };
    
    const allNavLinks = [
        ...mainLinks,
        ...salesLinks,
        ...operacionesLinks,
        ...cobranzaLinks,
        ...purchasesLinks,
        ...warehouseLinks,
        ...toolsLinks,
        ...(hasAccess(adminControlLink.id) ? [adminControlLink] : [])
    ];

    const handleSignOut = async () => {
        await auth.signOut();
        router.push('/');
    };

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    }

    const NavLink = ({ link, isMobile = false }: { link: { href: string, label: string, icon: React.ElementType, exact?: boolean }, isMobile?: boolean}) => (
         <Link
            href={link.href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                isActive(link.href, link.exact) ? "bg-muted text-primary font-semibold" : "text-muted-foreground",
                 isMobile && `gap-4 rounded-xl text-foreground hover:text-foreground mx-[-0.65rem] ${isActive(link.href, link.exact) ? "bg-muted" : ""}`
            )}
        >
            <link.icon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
            {link.label}
        </Link>
    );

    const NavGroup = ({ title, links, isMobile = false }: { title: string, links: any[], isMobile?: boolean }) => {
        if (links.length === 0) return null;
        return (
            <div className="py-2">
                {!isMobile && <h3 className="mb-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>}
                {links.map((link) => <NavLink key={link.href} link={link} isMobile={isMobile} />)}
            </div>
        );
    }
    
    if (authIsLoading || isProfileLoading) {
        return (
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        );
    }

    return (
        <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-24 items-center border-b pl-4 pr-4 pt-2">
                <Logo href="/admin" width={150} height={84} />
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                {mainLinks.map((link) => <NavLink key={link.href} link={link} />)}
                <NavGroup title="Ventas" links={salesLinks} />
                <NavGroup title="Operaciones" links={operacionesLinks} />
                <NavGroup title="Cobranza" links={cobranzaLinks} />
                <NavGroup title="Compras" links={purchasesLinks} />
                <NavGroup title="Almacenes" links={warehouseLinks} />
                <NavGroup title="Herramientas" links={toolsLinks} />
                </nav>
            </div>
                <div className="mt-auto p-4">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {hasAccess(adminControlLink.id) && (
                            <NavLink link={adminControlLink} />
                        )}
                    </nav>
                </div>
            </div>
        </div>
        <div className="flex flex-col h-screen overflow-hidden">
            <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 shrink-0">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 md:hidden"
                        >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Abrir/cerrar menú de navegación</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="flex flex-col p-0">
                        <div className="flex h-24 items-center border-b pl-4 pr-4 pt-2">
                            <Logo href="/admin" width={150} height={84} />
                        </div>
                        <nav className="grid gap-2 text-lg font-medium p-4">
                            {allNavLinks.map((link) => <NavLink key={link.href} link={link} isMobile={true} />)}
                        </nav>
                    </SheetContent>
                </Sheet>
                <div className="w-full flex-1">
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {(() => {
                        const fullName = userProfile?.displayName || userProfile?.name || user?.displayName || user?.email?.split('@')[0] || "Usuario";
                        const firstName = fullName.split(' ')[0];
                        const initials = fullName
                            .split(' ')
                            .filter(Boolean)
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || "U";
                        const roleLabel = userProfile?.role === 'admin' ? 'Admin' : 'Empleado';
                        const subtitle = userProfile?.jobTitle || roleLabel;

                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        className="h-10 pl-2 pr-3 py-1 rounded-full border-border/70 hover:bg-muted/50 hover:border-primary/30 transition-all flex items-center gap-2.5 shadow-sm bg-background"
                                    >
                                        <Avatar className="h-7 w-7 border border-primary/20 bg-primary/10 text-primary">
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col items-start text-left leading-tight hidden sm:flex">
                                            <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                                                {firstName}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                {subtitle}
                                            </span>
                                        </div>
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-60 ml-0.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border/80 rounded-xl">
                                    <DropdownMenuLabel className="p-2 pb-3 font-normal">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-primary/20 bg-primary/10 text-primary">
                                                <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col space-y-0.5 min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
                                                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                                <div className="pt-1">
                                                    <Badge variant={userProfile?.role === 'admin' ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 font-medium">
                                                        {userProfile?.role === 'admin' ? 'Administrador' : 'Empleado'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer py-2 rounded-lg">
                                        <User className="mr-2.5 h-4 w-4 text-primary" /> Mi Perfil
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => router.push('/admin/configuracion')} className="cursor-pointer py-2 rounded-lg">
                                        <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" /> Configuración
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-2 rounded-lg text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40">
                                        <LogOut className="mr-2.5 h-4 w-4 text-red-500" />
                                        Cerrar Sesión
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        );
                    })()}
                </div>
            </header>
            <main className="flex-1 overflow-auto p-4 lg:p-6 bg-background">
            {children}
            </main>
        </div>
        </div>
    );
}
