
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Loader2, ShieldCheck, ArrowLeft, Pencil, Save, X, Phone, Mail, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

type UserProfile = {
  email: string;
  role: 'user' | 'admin';
  displayName?: string;
  photoURL?: string;
  phone?: string;
};

export default function ProfilePage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchUserProfile = async () => {
      setIsSyncing(true);
      const userDocRef = doc(db, "users", user.uid);
      try {
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          setProfile(userData);
          setDisplayName(user.displayName || userData.displayName || '');
          setPhone(userData.phone || '');
        } else {
          // If doc doesn't exist, create it.
          const newUserProfile: UserProfile = {
            email: user.email || '',
            role: "user", // Default role
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            phone: '',
          };
          setDoc(userDocRef, newUserProfile).catch(serverError => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: userDocRef.path,
                  operation: 'create',
                  requestResourceData: newUserProfile
              }));
          });
          setProfile(newUserProfile);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar tu perfil.",
          variant: "destructive"
        });
      } finally {
        setIsSyncing(false);
      }
    };

    fetchUserProfile();
  }, [user, authIsLoading, router, toast]);

  const handleCancelEdit = () => {
    if (profile) {
      setDisplayName(user?.displayName || profile.displayName || '');
      setPhone(profile.phone || '');
    }
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!user) return;
    if (phone && phone.length < 10) {
      toast({
        title: "Error al Guardar",
        description: "El número telefónico debe tener al menos 10 dígitos.",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    const userDocRef = doc(db, "users", user.uid);
    const payload = { displayName, phone };
    try {
        // Update Firebase Auth profile
        await updateProfile(user, { displayName });
        
        // Update Firestore document
        await updateDoc(userDocRef, payload);

        setProfile(prev => prev ? { ...prev, displayName, phone } : null);
        setIsEditing(false);

        toast({
            title: "Perfil Actualizado",
            description: "Tus datos han sido guardados exitosamente.",
        });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: payload
        }));
    } finally {
        setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast({
        title: "Sesión Cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Fallo al Cerrar Sesión",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    }
  };

  if (authIsLoading || isSyncing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null; // Redirecting is handled in useEffect
  }
  
  const isAdmin = profile.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
          </Button>

          {!isEditing && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="gap-2 text-primary border-primary/30 hover:bg-primary/5 shadow-sm"
            >
              <Pencil className="h-4 w-4" />
              Editar Perfil
            </Button>
          )}
        </div>

        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader className="text-center pb-4">
            <Avatar className="mx-auto h-24 w-24 mb-3 border-4 border-primary/15 shadow-sm">
              <AvatarImage src={profile.photoURL} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-2xl font-headline font-bold">
                {isAdmin ? 'Panel de Administrador' : 'Panel de Usuario'}
              </CardTitle>
              <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                {isAdmin ? "Admin" : "Empleado"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {isEditing 
                ? "Modifica tus datos y presiona Guardar Cambios." 
                : "Información y datos de contacto de tu cuenta."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {isEditing ? (
              // ─── MODO EDICIÓN ───────────────────────────────────────────
              <div className="space-y-4 bg-muted/20 p-4 rounded-xl border">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-xs font-semibold flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Nombre a Mostrar
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Este nombre aparecerá automáticamente como responsable en tus cotizaciones y en el saludo del sistema.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-semibold flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Número Telefónico
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Tu teléfono de 10 dígitos"
                    className="bg-background font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit} 
                    disabled={isSaving}
                    className="w-1/2 gap-1.5"
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                  <Button 
                    onClick={handleSaveChanges} 
                    disabled={isSaving}
                    className="w-1/2 gap-1.5 shadow-sm"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                    ) : (
                      <><Save className="h-4 w-4" /> Guardar Cambios</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // ─── MODO LECTURA / FICHA ELEGANTE ──────────────────────────
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border bg-slate-50/60 dark:bg-slate-900/40 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Nombre a Mostrar
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {displayName || "Sin nombre configurado"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-50/60 dark:bg-slate-900/40 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" /> Número Telefónico
                  </p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {phone || "No registrado"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-slate-50/60 dark:bg-slate-900/40 space-y-1 md:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-600" /> Correo Electrónico
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            )}

            {isAdmin && !isEditing && (
              <Button asChild className="w-full bg-accent hover:bg-accent/90 shadow-sm mt-4">
                  <Link href="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4"/>
                      Ir al Panel de Administración
                  </Link>
              </Button>
            )}
          </CardContent>

          <CardFooter className="pt-2 border-t">
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
