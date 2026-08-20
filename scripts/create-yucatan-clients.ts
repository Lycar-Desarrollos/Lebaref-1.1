import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBtV2f5KKQJujJLFFElQw4No_w_sfQWXYU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lebaref-demo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lebaref-demo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lebaref-demo.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "646161358842",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:646161358842:web:9e157c1f2b53cfb47c0e43",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-5LRQMQB3BV",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = "ydalimir12arevalo16@lebaref.com";
  const password = "Aleman11";

  console.log(`Iniciando sesión con ${email}...`);
  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`Autenticación exitosa! UID: ${userCredential.user.uid}`);
  } catch (err: any) {
    console.error("Error al iniciar sesión:", err.message);
    return;
  }

  const user = userCredential.user;
  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    console.log("Datos de usuario:", userDocSnap.data());
  } else {
    console.log("El documento de usuario no existe en 'users'.");
  }

  const empresas = [
    {
      name: "Distribuidora Peninsular de Alimentos S.A. de C.V.",
      phone: "9991234567",
      email: "contacto@dispeninsular.com",
      rfc: "DPA180415XYZ",
      clientType: "Persona moral",
      industry: "Comercial",
      status: "Activo",
      assignedSeller: "",
      priority: "A",
      notes: "Cliente corporativo de prueba en Yucatán con línea de crédito estándar a 30 días.",
      streetAndNumber: "Calle 60 #345 x 43 y 45, Col. Centro",
      municipality: "Mérida",
      state: "Yucatán",
      zipCode: "97000",
      address: "Calle 60 #345 x 43 y 45, Col. Centro, Mérida, Yucatán, CP 97000",
      diasCredito: 30,
      limiteCredito: 150000,
      moneda: "MXN",
      regimenFiscal: "601 - General de Ley Personas Morales",
      usoCFDI: "G03 - Gastos en general",
      metodoPago: "PPD - Pago en parcialidades o diferido",
      formaPago: "99 - Por definir",
      correoFacturacion: "facturacion@dispeninsular.com",
      contactoCuentasPorPagar: "Lic. Manuel Herrera (m.herrera@dispeninsular.com)",
      evidenceFormat: "Estándar",
      serviceTypeRequired: ["Refrigeración", "Electricidad"],
      responseTimeRequired: "4 horas",
      quoteReceiptEmail: "compras@dispeninsular.com",
      reqAccesos: true,
      reqPermisos: false,
      reqUniformes: true,
      reqHerramientas: false,
      reqPositivoDetails: "EPP completo y calzado de seguridad.",
      reqNegativoDetails: "",
      contactoPrincipalIsActive: true,
      contactoPrincipal: {
        name: "Ing. Rodrigo Pech Gamboa",
        puesto: "Gerente de Operaciones",
        depto: "Mantenimiento y Cadena de Frío",
        phoneDirect: "9991234567",
        celularWhatsapp: "9999887766",
        email: "rodrigo.pech@dispeninsular.com"
      },
      contactoComprador: {
        name: "Lic. Sofía Canto Aguilar",
        puesto: "Coordinadora de Compras",
        depto: "Adquisiciones",
        phoneDirect: "9991234568",
        celularWhatsapp: "9991122334",
        email: "compras@dispeninsular.com"
      },
      contactosSecundarios: [
        {
          name: "Tec. Carlos Medina",
          puesto: "Supervisor en Turno",
          depto: "Mantenimiento",
          phoneDirect: "9991234569",
          celularWhatsapp: "9995544332",
          email: "carlos.medina@dispeninsular.com"
        }
      ],
      branches: [
        {
          id: "suc-mer-01",
          name: "Cedis Periférico Norte",
          establishmentType: "Almacén/Bodega",
          streetAndNumber: "Anillo Periférico Manuel Berzunza Km 28",
          municipality: "Mérida",
          state: "Yucatán",
          zipCode: "97115",
          address: "Anillo Periférico Manuel Berzunza Km 28, Mérida, Yucatán, CP 97115"
        }
      ],
      scheduleByDay: {
        "Lunes": { enabled: true, open: "08:00", close: "18:00" },
        "Martes": { enabled: true, open: "08:00", close: "18:00" },
        "Miércoles": { enabled: true, open: "08:00", close: "18:00" },
        "Jueves": { enabled: true, open: "08:00", close: "18:00" },
        "Viernes": { enabled: true, open: "08:00", close: "18:00" },
        "Sábado": { enabled: true, open: "08:00", close: "14:00" },
        "Domingo": { enabled: false, open: "", close: "" }
      },
      changelog: [
        {
          timestamp: new Date().toISOString(),
          userId: user.uid,
          userName: user.displayName || user.email || "Sistema",
          changeType: "Creación",
          details: "Registro inicial de cliente de prueba para el estado de Yucatán con 30 días de crédito."
        }
      ]
    },
    {
      name: "Operadora Hotelera de la Costa Maya S. de R.L. de C.V.",
      phone: "9699351234",
      email: "administracion@costamayayuc.com",
      rfc: "OHC190722AB1",
      clientType: "Persona moral",
      industry: "Hotel",
      status: "Activo",
      assignedSeller: "",
      priority: "A",
      notes: "Complejo hotelero y restaurante de playa en Progreso, Yucatán. Crédito 30 días.",
      streetAndNumber: "Calle 19 #120 x 60 y 62, Col. Malecón",
      municipality: "Progreso",
      state: "Yucatán",
      zipCode: "97320",
      address: "Calle 19 #120 x 60 y 62, Col. Malecón, Progreso, Yucatán, CP 97320",
      diasCredito: 30,
      limiteCredito: 200000,
      moneda: "MXN",
      regimenFiscal: "601 - General de Ley Personas Morales",
      usoCFDI: "G03 - Gastos en general",
      metodoPago: "PPD - Pago en parcialidades o diferido",
      formaPago: "03 - Transferencia electrónica de fondos",
      correoFacturacion: "pagos@costamayayuc.com",
      contactoCuentasPorPagar: "CP. Esteban Solís (e.solis@costamayayuc.com)",
      evidenceFormat: "Estándar",
      serviceTypeRequired: ["Refrigeración", "Obra Civil", "Electricidad"],
      responseTimeRequired: "2 horas",
      quoteReceiptEmail: "mantenimiento@costamayayuc.com",
      reqAccesos: true,
      reqPermisos: true,
      reqUniformes: false,
      reqHerramientas: true,
      reqPositivoDetails: "Registro en caseta de seguridad y portar gafete de visitante.",
      reqNegativoDetails: "No ingresar áreas de huéspedes sin acompañamiento de personal interno.",
      contactoPrincipalIsActive: true,
      contactoPrincipal: {
        name: "Lic. Andrea Moguel Bates",
        puesto: "Directora General",
        depto: "Dirección",
        phoneDirect: "9699351234",
        celularWhatsapp: "9993344556",
        email: "andrea.moguel@costamayayuc.com"
      },
      contactoComprador: {
        name: "Ing. Fernando Ucán Gómez",
        puesto: "Jefe de Mantenimiento",
        depto: "Operaciones e Instalaciones",
        phoneDirect: "9699351235",
        celularWhatsapp: "9994455667",
        email: "mantenimiento@costamayayuc.com"
      },
      contactosSecundarios: [],
      branches: [
        {
          id: "suc-prog-01",
          name: "Beach Club & Marina Progreso",
          establishmentType: "Sucursal",
          streetAndNumber: "Boulevard Turístico Yucalpetén Km 4.5",
          municipality: "Progreso",
          state: "Yucatán",
          zipCode: "97320",
          address: "Boulevard Turístico Yucalpetén Km 4.5, Progreso, Yucatán, CP 97320"
        }
      ],
      scheduleByDay: {
        "Lunes": { enabled: true, open: "07:00", close: "22:00" },
        "Martes": { enabled: true, open: "07:00", close: "22:00" },
        "Miércoles": { enabled: true, open: "07:00", close: "22:00" },
        "Jueves": { enabled: true, open: "07:00", close: "22:00" },
        "Viernes": { enabled: true, open: "07:00", close: "22:00" },
        "Sábado": { enabled: true, open: "07:00", close: "22:00" },
        "Domingo": { enabled: true, open: "07:00", close: "20:00" }
      },
      changelog: [
        {
          timestamp: new Date().toISOString(),
          userId: user.uid,
          userName: user.displayName || user.email || "Sistema",
          changeType: "Creación",
          details: "Registro inicial de empresa hotelera en Yucatán con 30 días de crédito."
        }
      ]
    },
    {
      name: "Industrias y Logística del Mayab S.A.P.I. de C.V.",
      phone: "9858567890",
      email: "operaciones@logmayab.mx",
      rfc: "ILM201105KL9",
      clientType: "Persona moral",
      industry: "Comercial",
      status: "Activo",
      assignedSeller: "",
      priority: "A",
      notes: "Centro logístico y cámaras de congelación en Valladolid, Yucatán. Crédito 30 días.",
      streetAndNumber: "Carretera Federal Cancún-Mérida Km 158",
      municipality: "Valladolid",
      state: "Yucatán",
      zipCode: "97780",
      address: "Carretera Federal Cancún-Mérida Km 158, Valladolid, Yucatán, CP 97780",
      diasCredito: 30,
      limiteCredito: 300000,
      moneda: "MXN",
      regimenFiscal: "601 - General de Ley Personas Morales",
      usoCFDI: "G01 - Adquisición de mercancías",
      metodoPago: "PPD - Pago en parcialidades o diferido",
      formaPago: "99 - Por definir",
      correoFacturacion: "cfdi@logmayab.mx",
      contactoCuentasPorPagar: "Lic. Karla Quintal (cuentasporpagar@logmayab.mx)",
      evidenceFormat: "Estándar",
      serviceTypeRequired: ["Refrigeración", "Electricidad", "Voz y Datos"],
      responseTimeRequired: "3 horas",
      quoteReceiptEmail: "licitaciones@logmayab.mx",
      reqAccesos: true,
      reqPermisos: true,
      reqUniformes: true,
      reqHerramientas: true,
      reqPositivoDetails: "DC3 de trabajo en alturas y constancia de capacitación en seguridad.",
      reqNegativoDetails: "Prohibido fumar y usar teléfonos en áreas de maniobra.",
      contactoPrincipalIsActive: true,
      contactoPrincipal: {
        name: "Ing. Javier Arjona Rosado",
        puesto: "Superintendente de Planta",
        depto: "Ingeniería y Mantenimiento",
        phoneDirect: "9858567890",
        celularWhatsapp: "9851122334",
        email: "javier.arjona@logmayab.mx"
      },
      contactoComprador: {
        name: "Lic. Patricia Chan Méndez",
        puesto: "Gerente de Suministros",
        depto: "Compras Corporativas",
        phoneDirect: "9858567891",
        celularWhatsapp: "9852233445",
        email: "patricia.chan@logmayab.mx"
      },
      contactosSecundarios: [
        {
          name: "Ing. Mauricio Várguez",
          puesto: "Jefe de Refrigeración",
          depto: "Mantenimiento Frigorífico",
          phoneDirect: "9858567892",
          celularWhatsapp: "9853344556",
          email: "m.varguez@logmayab.mx"
        }
      ],
      branches: [
        {
          id: "suc-val-01",
          name: "Planta Frigorífica Valladolid",
          establishmentType: "Almacén/Bodega",
          streetAndNumber: "Carretera Federal Valladolid-Tizimín Km 3",
          municipality: "Valladolid",
          state: "Yucatán",
          zipCode: "97784",
          address: "Carretera Federal Valladolid-Tizimín Km 3, Valladolid, Yucatán, CP 97784"
        }
      ],
      scheduleByDay: {
        "Lunes": { enabled: true, open: "06:00", close: "20:00" },
        "Martes": { enabled: true, open: "06:00", close: "20:00" },
        "Miércoles": { enabled: true, open: "06:00", close: "20:00" },
        "Jueves": { enabled: true, open: "06:00", close: "20:00" },
        "Viernes": { enabled: true, open: "06:00", close: "20:00" },
        "Sábado": { enabled: true, open: "06:00", close: "15:00" },
        "Domingo": { enabled: false, open: "", close: "" }
      },
      changelog: [
        {
          timestamp: new Date().toISOString(),
          userId: user.uid,
          userName: user.displayName || user.email || "Sistema",
          changeType: "Creación",
          details: "Registro inicial de parque logístico en Yucatán con 30 días de crédito."
        }
      ]
    }
  ];

  const clientsRef = collection(db, "clients");
  for (const emp of empresas) {
    console.log(`Registrando ${emp.name}...`);
    const docRef = await addDoc(clientsRef, {
      ...emp,
      createdAt: serverTimestamp()
    });
    console.log(`-> Registrado exitosamente con ID: ${docRef.id}`);
  }

  console.log("Todas las empresas han sido dadas de alta correctamente en Firestore.");
}

main().catch(console.error);
