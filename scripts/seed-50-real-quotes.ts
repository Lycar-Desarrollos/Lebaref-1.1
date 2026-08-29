import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc, 
  getDocs, writeBatch 
} from "firebase/firestore";

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

// ─── 1. REAL CLIENTS DATA ───────────────────────────────────────────────────
const CLIENTS_SEED = [
  {
    name: "Hospital Regional de Alta Especialidad de la Península",
    contactPerson: "Lic. Roberto Méndez",
    email: "mantenimiento@hraepyucatan.gob.mx",
    phone: "9991234567",
    rfc: "HRA060601ABC",
    fiscalAddress: "Calle 7 No. 433 por 20 y 22, Fracc. Altabrisa, Mérida, Yucatán",
    serviceAddress: "Edificio de Hospitalización Torre Médica B, Mérida",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Hospital Faro del Mayab",
    contactPerson: "Dr. Fernando Valencia",
    email: "infraestructura@farodelmayab.com",
    phone: "9992345678",
    rfc: "HFM150312XYZ",
    fiscalAddress: "Calle 24 Santa Gertrudis Copó, Mérida, Yucatán",
    serviceAddress: "Área Quirófanos y Terapia Intensiva",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Plaza Altabrisa Mérida",
    contactPerson: "Ing. Daniela Morales",
    email: "administracion@plazaaltabrisa.com",
    phone: "9999876543",
    rfc: "PAM101010XYZ",
    fiscalAddress: "Periférico Manuel Berzunza, Mérida, Yucatán",
    serviceAddress: "Área de Restaurantes y Cines",
    type: "Empresa",
    paymentTerms: "15 días",
  },
  {
    name: "Plaza La Isla Cabo Norte",
    contactPerson: "Lic. Javier Solís",
    email: "operaciones@laislamerida.com",
    phone: "9994567890",
    rfc: "LIC170921KLM",
    fiscalAddress: "Cabo Norte, Temozón Norte, Mérida, Yucatán",
    serviceAddress: "Pasillos Centrales y Zona Gourmet",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Plaza Galerías Mérida",
    contactPerson: "Arq. Sofia Cámara",
    email: "mantenimiento@galeriasmerida.com",
    phone: "9993214567",
    rfc: "PGM080415GHI",
    fiscalAddress: "Calle 60 No. 299, Revolución, Mérida, Yucatán",
    serviceAddress: "Sala de Máquinas Pista de Hielo",
    type: "Empresa",
    paymentTerms: "15 días",
  },
  {
    name: "Hotel Fiesta Americana Mérida",
    contactPerson: "Ing. Guillermo Herrera",
    email: "mantenimiento@fiestamericana.com.mx",
    phone: "9992113344",
    rfc: "FAM880210QWE",
    fiscalAddress: "Paseo de Montejo No. 451, Mérida, Yucatán",
    serviceAddress: "Pisos Ejecutivos 3 al 6 y Salones",
    type: "Empresa",
    paymentTerms: "15 días",
  },
  {
    name: "Hotel Hyatt Regency Mérida",
    contactPerson: "Lic. Andrea Peón",
    email: "compras@hyattmerida.com",
    phone: "9999421234",
    rfc: "HRM940718ASD",
    fiscalAddress: "Calle 60 No. 344, Zona Paseo Montejo, Mérida",
    serviceAddress: "Restaurante Peregrina y Centro de Convenciones",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Hotel Emporio Cancún Resort",
    contactPerson: "Ing. Mauricio Escalante",
    email: "facilities@emporiocancun.com",
    phone: "9988812000",
    rfc: "HEC990115RTY",
    fiscalAddress: "Blvd. Kukulcan Km 17, Zona Hotelera, Cancún, Q. Roo",
    serviceAddress: "Torres Huéspedes A y B, Cancún",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Grand Palladium Riviera Maya",
    contactPerson: "Ing. Esteban Domínguez",
    email: "chief.engineer@palladiumhotelgroup.com",
    phone: "9848772100",
    rfc: "GPR020819BNM",
    fiscalAddress: "Carretera Chetumal-Puerto Juárez Km 256, Akumal, Q. Roo",
    serviceAddress: "Cámaras Frías de Cocina Principal",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Cadena de Supermercados Súper Akí",
    contactPerson: "Ing. Carlos Villamil",
    email: "frio.corporativo@superaki.mx",
    phone: "9999304000",
    rfc: "SAK850604CVB",
    fiscalAddress: "Periférico Poniente Km 34, Mérida, Yucatán",
    serviceAddress: "Sucursal Francisco de Montejo",
    type: "Empresa",
    paymentTerms: "15 días",
  },
  {
    name: "Planta Purificadora Bepensa (Cristal)",
    contactPerson: "Ing. Manuel Canto",
    email: "mantenimiento@bepensa.com",
    phone: "9999422000",
    rfc: "BEP760412JNM",
    fiscalAddress: "Calle 60 Diagonal No. 492, Fracc. Parque Industrial, Umán",
    serviceAddress: "Líneas de Envasado 1 y 2",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Universidad Marista de Mérida",
    contactPerson: "Ing. Juan Pablo Rivas",
    email: "servicios.generales@marista.edu.mx",
    phone: "9999429700",
    rfc: "UMM960901POI",
    fiscalAddress: "Periférico Norte Tablaje Catastral 13941, Mérida",
    serviceAddress: "Edificio de Aulas D y Laboratorios",
    type: "Empresa",
    paymentTerms: "Contado",
  },
  {
    name: "Universidad Autónoma de Yucatán (UADY)",
    contactPerson: "Mtro. Alejandro Cetina",
    email: "servicios@correo.uady.mx",
    phone: "9999300100",
    rfc: "UAD840901UAD",
    fiscalAddress: "Calle 60 No. 491 x 57, Centro, Mérida, Yucatán",
    serviceAddress: "Campus Ciencias Exactas e Ingenierías",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Empacadora Kekén Tixpéhual",
    contactPerson: "Ing. Luis Balam",
    email: "frio.planta@keken.com.mx",
    phone: "9999305500",
    rfc: "GKE910523TYU",
    fiscalAddress: "Carretera Mérida-Tixkokob Km 9.5, Tixpéhual, Yucatán",
    serviceAddress: "Cámaras de Conservación de Carne de Cerdo",
    type: "Empresa",
    paymentTerms: "30 días",
  },
  {
    name: "Distribuidora Mayorista Dunosusa",
    contactPerson: "Lic. Gabriela Pacheco",
    email: "adquisiciones@dunosusa.com.mx",
    phone: "9999427000",
    rfc: "DMD800318HJK",
    fiscalAddress: "Calle 42 No. 501, Fracc. Industrial, Mérida",
    serviceAddress: "Centro de Distribución CEDIS Umán",
    type: "Empresa",
    paymentTerms: "15 días",
  }
];

// ─── 2. USERS MAP ───────────────────────────────────────────────────────────
const USERS_SEED = [
  {
    uid: "USER-C01-LARRY",
    displayName: "Larry Carrillo Herrera",
    email: "larry.carrillo@lebaref.com",
    role: "admin",
    userCode: "C01",
    department: "Dirección General",
    jobTitle: "Director General",
    phone: "9991223344",
  },
  {
    uid: "USER-C02-EDGAR",
    displayName: "Edgar Ydalimir Arévalo Escobedo",
    email: "operaciones@lebaref.com",
    role: "admin",
    userCode: "C02",
    department: "Operaciones y Mantenimiento",
    jobTitle: "Gerente de Operaciones",
    phone: "9999887766",
  },
  {
    uid: "USER-C03-ROBERTO",
    displayName: "Ing. Roberto Pech Pool",
    email: "roberto.pech@lebaref.com",
    role: "employee",
    userCode: "C03",
    department: "Refrigeración Industrial",
    jobTitle: "Jefe de Mantenimiento",
    phone: "9995554433",
  },
  {
    uid: "USER-C04-ALEJANDRO",
    displayName: "Tec. Alejandro Canché Chan",
    email: "alejandro.canche@lebaref.com",
    role: "employee",
    userCode: "C04",
    department: "Aire Acondicionado Comercial",
    jobTitle: "Técnico Senior HVAC",
    phone: "9994443322",
  },
  {
    uid: "USER-C05-MARIANA",
    displayName: "Lic. Mariana Novelo Rosado",
    email: "cobranza@lebaref.com",
    role: "employee",
    userCode: "C05",
    department: "Administración y Finanzas",
    jobTitle: "Atención a Clientes y Cobranza",
    phone: "9993332211",
  }
];

// ─── 3. REALISTIC QUOTE TEMPLATES ───────────────────────────────────────────
const QUOTE_TEMPLATES = [
  {
    shortDescription: "Mantenimiento Preventivo Chiller York 100TR Torre Médica",
    tipoServicio: "Preventivo",
    tipoTrabajo: "Chiller Agua Helada",
    equipoLugar: "Chiller York YVAA 100TR - Azotea Torre B",
    items: [
      { description: "Mantenimiento preventivo mayor y limpieza de condensadores enfriados por aire", quantity: 1, price: 24500, unidad: "Servicio" },
      { description: "Refrigerante Ecológico R-410A (Cilindro 11.3 kg)", quantity: 2, price: 3450, unidad: "Cilindro" },
      { description: "Filtro Deshidratador de Bloque Líquido 7/8", quantity: 2, price: 1850, unidad: "PZA" },
    ]
  },
  {
    shortDescription: "Instalación de Sistema VRF Inverter 16HP Área Quirófanos",
    tipoServicio: "Instalación",
    tipoTrabajo: "Sistema VRF / VRV",
    equipoLugar: "Área Quirófanos Piso 2",
    items: [
      { description: "Suministro y montaje de unidad condensadora VRF Inverter 16HP 220V/3F", quantity: 1, price: 145000, unidad: "Equipo" },
      { description: "Instalación de tubería de cobre rígido con aislamiento Armaflex y soportería", quantity: 1, price: 32000, unidad: "Servicio" },
      { description: "Vacío profundo a 250 micrones, presurización con nitrógeno y arranque", quantity: 1, price: 12500, unidad: "Servicio" },
    ]
  },
  {
    shortDescription: "Recarga R-410A y Cambio de Contactores Paquete 15TR",
    tipoServicio: "Correctivo",
    tipoTrabajo: "Paquete Rooftop",
    equipoLugar: "Azotea Área de Cines - Unidad Paquete 03",
    items: [
      { description: "Servicio correctivo de detección de microfuga y soldadura con aleación plata", quantity: 1, price: 8500, unidad: "Servicio" },
      { description: "Refrigerante R-410A de alta pureza (11.3 kg)", quantity: 3, price: 3450, unidad: "Cilindro" },
      { description: "Contactor magnético trifásico 40A bobina 24V", quantity: 2, price: 1250, unidad: "PZA" },
    ]
  },
  {
    shortDescription: "Reparación Cámara de Congelación -20°C de Carnes",
    tipoServicio: "Correctivo",
    tipoTrabajo: "Refrigeración Industrial",
    equipoLugar: "Cámara Fría No. 2 - Andén de Carga",
    items: [
      { description: "Reemplazo de motor ventilador de evaporador Bohn 1/2 HP y aspas", quantity: 2, price: 6200, unidad: "PZA" },
      { description: "Calibración de control digital Dixell y sensores NTC de temperatura", quantity: 1, price: 4800, unidad: "Servicio" },
      { description: "Cambio de resistencia de deshielo y empaques perimetrales de puerta", quantity: 1, price: 5400, unidad: "Servicio" },
    ]
  },
  {
    shortDescription: "Mantenimiento a Extractores Centrífugos y Lavado de Campanas",
    tipoServicio: "Preventivo",
    tipoTrabajo: "Extracción e Inyección",
    equipoLugar: "Área de Cocina y Zona Gourmet",
    items: [
      { description: "Desengrase químico profundo a campanas de extracción y ductería", quantity: 2, price: 9500, unidad: "Servicio" },
      { description: "Revisión de turbinas centrífugas, cambio de bandas y engrase de chumaceras", quantity: 3, price: 3800, unidad: "Servicio" },
      { description: "Juego de bandas en V perfil B-52 alta resistencia", quantity: 6, price: 420, unidad: "PZA" },
    ]
  },
  {
    shortDescription: "Cambio de Compresor Scroll 10HP y Filtros Deshidratadores",
    tipoServicio: "Correctivo",
    tipoTrabajo: "Refrigeración Comercial",
    equipoLugar: "Condensadora Remota Piso 1",
    items: [
      { description: "Suministro de compresor Copeland Scroll 10HP R-404A 220V/3F", quantity: 1, price: 58000, unidad: "Equipo" },
      { description: "Mano de obra especializada para cambio, barrido de sistema y vacío", quantity: 1, price: 14500, unidad: "Servicio" },
      { description: "Aceite sintético POE para compresor y filtro antiácido", quantity: 1, price: 3900, unidad: "Lote" },
    ]
  },
  {
    shortDescription: "Servicio a Torres de Enfriamiento Circuito Secundario",
    tipoServicio: "Preventivo",
    tipoTrabajo: "Torre de Enfriamiento",
    equipoLugar: "Planta de Fuerza - Torre Baltimore 200TR",
    items: [
      { description: "Lavado y desinfección de celosías de relleno y pileta inferior", quantity: 1, price: 16500, unidad: "Servicio" },
      { description: "Alineación de poleas, ajuste de transmisión y cambio de sellos mecánicos", quantity: 1, price: 9800, unidad: "Servicio" },
    ]
  },
  {
    shortDescription: "Mantenimiento Bimensual a 12 Minisplits Inverter 24K BTU",
    tipoServicio: "Preventivo",
    tipoTrabajo: "Minisplit Inverter",
    equipoLugar: "Aulas Piso 1 y Piso 2",
    items: [
      { description: "Lavado con hidrolavadora de evaporadores y condensadores, desazolve de drenajes", quantity: 12, price: 850, unidad: "Servicio" },
      { description: "Revisión de presiones operativas, consumo eléctrico y limpieza de filtros", quantity: 12, price: 250, unidad: "Servicio" },
    ]
  },
  {
    shortDescription: "Limpieza Química de Serpentines y Detección de Fugas Nitrógeno",
    tipoServicio: "Correctivo",
    tipoTrabajo: "Manejadora de Aire (UMA)",
    equipoLugar: "Cuarto de Máquinas Piso 3 - UMA 04",
    items: [
      { description: "Aplicación de desincrustante espumante alcalino y enjuague a presión", quantity: 1, price: 7800, unidad: "Servicio" },
      { description: "Prueba hidrostática y presurización con nitrógeno seco a 350 PSI", quantity: 1, price: 4200, unidad: "Servicio" },
    ]
  },
  {
    shortDescription: "Aislamiento Térmico de Tubería de Agua Helada con Armaflex",
    tipoServicio: "Aislamiento",
    tipoTrabajo: "Línea Hidrónica",
    equipoLugar: "Tubería Principal de Suministro Azotea",
    items: [
      { description: "Instalación de aislamiento elastomérico Armaflex espesor 1 pulgada con recubrimiento UV", quantity: 45, price: 680, unidad: "Metro" },
      { description: "Sellado de uniones con adhesivo 520 y encintado con cinta de aluminio", quantity: 1, price: 5600, unidad: "Lote" },
    ]
  }
];

// ─── 4. RUN FULL SEEDING ───────────────────────────────────────────────────
async function seed50Quotes() {
  console.log("================================================================================");
  console.log("🚀 POBLANDO BASE DE DATOS LEBAREF-DEMO CON 50 COTIZACIONES REALES");
  console.log("================================================================================");

  // 0. Autenticarse como Administrador para cumplir con las reglas de seguridad
  const adminEmail = "operaciones@lebaref.com";
  const adminPassword = "iPvejazXGQmgLKf";
  console.log(`\n[PASO 0] Autenticando como ${adminEmail}...`);
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  console.log("✅ Sesión de Administrador activa.");

  // 1. Guardar Usuarios en Firestore
  console.log("\n[PASO 1] Registrando/actualizando usuarios en Firestore...");
  for (const u of USERS_SEED) {
    const uRef = doc(db, "users", u.uid);
    await setDoc(uRef, {
      ...u,
      createdAt: serverTimestamp(),
      quoteCounter: 15,
      workOrderCounter: 15,
    }, { merge: true });
    console.log(`   👤 Usuario listo: ${u.displayName} (${u.userCode})`);
  }

  // 2. Guardar Clientes en Firestore
  console.log("\n[PASO 2] Registrando clientes de la Península de Yucatán...");
  const clientIds: { id: string; name: string; email: string; phone: string; address: string; rfc: string }[] = [];
  
  for (const c of CLIENTS_SEED) {
    const cRef = await addDoc(collection(db, "clients"), {
      ...c,
      userId: auth.currentUser!.uid,
      createdAt: serverTimestamp(),
    });
    clientIds.push({
      id: cRef.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.serviceAddress || c.fiscalAddress,
      rfc: c.rfc,
    });
  }
  console.log(`✅ ${clientIds.length} clientes registrados.`);

  // 3. Generar las 50 Cotizaciones con Distribución Real
  console.log("\n[PASO 3] Creando 50 cotizaciones con estados reales distribuidos...");

  // Distribución de Estados:
  // 10 activas/en proceso: 3 Borrador, 4 Enviada, 3 Aceptada (con OT en proceso)
  // 40 terminadas: 28 Pagada, 8 Aceptada (con OT completada y saldo pendiente), 4 Rechazada
  const statusPlan: ("Borrador" | "Enviada" | "Aceptada" | "Pagada" | "Rechazada")[] = [
    // 10 en proceso / activas
    "Borrador", "Borrador", "Borrador",
    "Enviada", "Enviada", "Enviada", "Enviada",
    "Aceptada", "Aceptada", "Aceptada", // OTs en proceso

    // 40 finalizadas
    ...Array(28).fill("Pagada"),
    ...Array(8).fill("Aceptada"), // OTs completadas con saldo en CxC
    ...Array(4).fill("Rechazada"),
  ];

  const technicians = [
    "Ing. Roberto Pech Pool",
    "Tec. Alejandro Canché Chan",
    "Tec. David May Balam",
    "Tec. Juan Carlos Poot",
    "Ing. Carlos Mendoza"
  ];

  let otGlobalCounter = 1;

  for (let i = 0; i < 50; i++) {
    const quoteStatus = statusPlan[i];
    const client = clientIds[i % clientIds.length];
    const template = QUOTE_TEMPLATES[i % QUOTE_TEMPLATES.length];
    const assignedUser = USERS_SEED[i % USERS_SEED.length];

    const quoteNumber = `${assignedUser.userCode}-${String(i + 1).padStart(4, '0')}`;
    
    // Fechas escalonadas entre Marzo y Agosto 2026
    const daysAgo = 150 - Math.floor((i / 50) * 140);
    const quoteDateObj = new Date(Date.now() - daysAgo * 86400000);
    const quoteDate = quoteDateObj.toISOString().split('T')[0];
    const expDate = new Date(quoteDateObj.getTime() + 15 * 86400000).toISOString().split('T')[0];
    const acceptedDate = quoteStatus !== "Borrador" && quoteStatus !== "Enviada" ? new Date(quoteDateObj.getTime() + 3 * 86400000).toISOString().split('T')[0] : undefined;

    // Calcular montos
    const subtotal = template.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const iva = 16;
    const ivaAmount = subtotal * (iva / 100);
    const total = subtotal + ivaAmount;

    // Pagos y Facturación
    let paidAmount = 0;
    let invoiceNumber: string | undefined = undefined;
    let payments: any[] = [];
    let collectionNotes: any[] = [];

    if (quoteStatus === "Pagada") {
      invoiceNumber = `FAC-2026-${String(100 + i).padStart(4, '0')}`;
      paidAmount = total;
      payments = [
        {
          id: `PAY-${i}-1`,
          amount: total / 2,
          date: new Date(quoteDateObj.getTime() + 5 * 86400000).toISOString().split('T')[0],
          method: "Transferencia",
          reference: `SPEI-BBVA-${100000 + i}`,
          invoiceNumber: invoiceNumber,
          notes: "Anticipo 50% al autorizar servicio",
          registeredBy: assignedUser.displayName,
          registeredAt: new Date().toISOString(),
        },
        {
          id: `PAY-${i}-2`,
          amount: total / 2,
          date: new Date(quoteDateObj.getTime() + 12 * 86400000).toISOString().split('T')[0],
          method: "Transferencia",
          reference: `SPEI-BANAMEX-${200000 + i}`,
          invoiceNumber: invoiceNumber,
          notes: "Liquidación final 50% tras entrega de servicio",
          registeredBy: assignedUser.displayName,
          registeredAt: new Date().toISOString(),
        }
      ];
    } else if (quoteStatus === "Aceptada" && i >= 10) {
      // Cotizaciones Aceptadas finalizadas con saldo pendiente en CxC (abono 50%)
      invoiceNumber = `FAC-2026-${String(100 + i).padStart(4, '0')}`;
      paidAmount = total / 2;
      payments = [
        {
          id: `PAY-${i}-1`,
          amount: total / 2,
          date: new Date(quoteDateObj.getTime() + 4 * 86400000).toISOString().split('T')[0],
          method: "Transferencia",
          reference: `SPEI-SANTANDER-${300000 + i}`,
          invoiceNumber: invoiceNumber,
          notes: "Anticipo 50% registrado. Saldo pendiente a 15 días.",
          registeredBy: assignedUser.displayName,
          registeredAt: new Date().toISOString(),
        }
      ];
      collectionNotes = [
        {
          id: `NOTE-${i}-1`,
          date: new Date().toISOString().split('T')[0],
          note: "Se contactó a cuentas por pagar del cliente. Programado pago de finiquito para el próximo viernes.",
          promisedPaymentDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          user: assignedUser.displayName,
          createdAt: new Date().toISOString(),
        }
      ];
    }

    // Datos de Rechazo
    let rejectionReason: string | undefined = undefined;
    let rejectedBy: string | undefined = undefined;
    let rejectedAt: string | undefined = undefined;

    if (quoteStatus === "Rechazada") {
      rejectionReason = i % 2 === 0 
        ? "Cliente decidió posponer mantenimiento por cierre de ejercicio presupuestal." 
        : "El cliente optó por comprar equipo nuevo en lugar de reparar el existente.";
      rejectedBy = assignedUser.displayName;
      rejectedAt = new Date(quoteDateObj.getTime() + 5 * 86400000).toISOString();
    }

    // Guardar Cotización
    const quotePayload: any = {
      quoteNumber: quoteNumber,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientAddress: client.address,
      serviceAddress: client.address,
      responsable: assignedUser.displayName,
      shortDescription: template.shortDescription,
      tipoServicio: template.tipoServicio,
      tipoTrabajo: template.tipoTrabajo,
      equipoLugar: template.equipoLugar,
      date: quoteDate,
      expirationDate: expDate,
      subtotal: subtotal,
      iva: iva,
      total: total,
      status: quoteStatus,
      items: template.items,
      policies: "Garantía de 90 días en mano de obra. 1 año en refacciones nuevas con fabricante.",
      paymentTerms: "50% de anticipo y 50% al término de las pruebas de operación.",
      userId: auth.currentUser!.uid,
      createdAt: serverTimestamp(),
    };

    if (acceptedDate) quotePayload.acceptedDate = acceptedDate;
    if (invoiceNumber) quotePayload.invoiceNumber = invoiceNumber;
    if (paidAmount > 0) quotePayload.paidAmount = paidAmount;
    if (payments.length > 0) quotePayload.payments = payments;
    if (collectionNotes.length > 0) quotePayload.collectionNotes = collectionNotes;
    if (rejectionReason) {
      quotePayload.rejectionReason = rejectionReason;
      quotePayload.rejectedBy = rejectedBy;
      quotePayload.rejectedAt = rejectedAt;
    }

    const quoteRef = await addDoc(collection(db, "quotes"), quotePayload);

    // 4. Si la cotización está Aceptada, Pagada o Rechazada, crear Orden de Trabajo (OT) vinculada
    if (quoteStatus === "Aceptada" || quoteStatus === "Pagada" || quoteStatus === "Rechazada") {
      const otNumber = `OT${assignedUser.userCode}-${String(otGlobalCounter++).padStart(4, '0')}`;
      let otStatus: "Pendiente" | "Asignada" | "En Proceso" | "Completada" | "Cancelada" = "Completada";

      if (quoteStatus === "Rechazada") {
        otStatus = "Cancelada";
      } else if (i === 7) {
        otStatus = "Pendiente";
      } else if (i === 8) {
        otStatus = "Asignada";
      } else if (i === 9) {
        otStatus = "En Proceso";
      } else {
        otStatus = "Completada";
      }

      const assignedTech = technicians[i % technicians.length];

      const otPayload: any = {
        otNumber: otNumber,
        quoteId: quoteRef.id,
        quoteNumber: quoteNumber,
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email,
        serviceAddress: client.address,
        responsable: assignedUser.displayName,
        tipoServicio: template.tipoServicio,
        tipoTrabajo: template.tipoTrabajo,
        equipoLugar: template.equipoLugar,
        description: template.shortDescription,
        date: acceptedDate || quoteDate,
        status: otStatus,
        technician: otStatus !== "Pendiente" ? assignedTech : "",
        items: template.items.map(it => ({ description: it.description, quantity: it.quantity, unidad: it.unidad || "PZA" })),
        userId: auth.currentUser!.uid,
        createdAt: serverTimestamp(),
      };

      if (otStatus === "Cancelada") {
        otPayload.cancellationReason = `Cotización ${quoteNumber} rechazada: ${rejectionReason}`;
        otPayload.cancelledBy = assignedUser.displayName;
        otPayload.cancelledAt = rejectedAt;
      } else if (otStatus === "Completada") {
        otPayload.completedAt = new Date(quoteDateObj.getTime() + 8 * 86400000).toISOString();
      }

      const otRef = await addDoc(collection(db, "ordenes_de_trabajo"), otPayload);

      // Vincular OT a la cotización
      await setDoc(doc(db, "quotes", quoteRef.id), { linkedTicketId: otRef.id }, { merge: true });
    }

    if ((i + 1) % 10 === 0 || i === 49) {
      console.log(`   ✨ ${i + 1}/50 cotizaciones creadas (Última: ${quoteNumber} - ${quoteStatus} - $${total.toLocaleString("es-MX")})`);
    }
  }

  console.log("\n================================================================================");
  console.log("🎉 BASE DE DATOS POBLADA EXITOSAMENTE CON 50 COTIZACIONES REALES Y SUS OTs");
  console.log("================================================================================");
}

seed50Quotes().catch(console.error);
