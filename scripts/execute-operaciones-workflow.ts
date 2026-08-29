import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, serverTimestamp, doc, setDoc, getDoc, 
  getDocs, query, where, updateDoc, runTransaction 
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

async function runRealWorkflow() {
  console.log("================================================================================");
  console.log("🚀 INICIANDO FLUJO DE TRABAJO REAL INTEGRAL EN LEBAREF-DEMO");
  console.log("================================================================================");

  // 1. AUTENTICACIÓN / ALTA DE USUARIO OPERACIONES
  const email = "operaciones@lebaref.com";
  const password = "iPvejazXGQmgLKf";

  let userCredential;
  try {
    console.log(`\n[PASO 1] Autenticando usuario ${email}...`);
    userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`✅ Sesión iniciada con éxito. UID: ${userCredential.user.uid}`);
  } catch (err: any) {
    console.log(`ℹ️ Usuario no existe en Auth (${err.code}). Creando cuenta de usuario...`);
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`✅ Usuario creado con éxito en Firebase Auth. UID: ${userCredential.user.uid}`);
    } catch (createErr: any) {
      console.error(`❌ Error al crear usuario:`, createErr.message);
      return;
    }
  }

  const user = userCredential.user;
  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    console.log("Configurando perfil de Administrador en Firestore...");
    await setDoc(userDocRef, {
      uid: user.uid,
      displayName: "Operaciones Lebaref",
      email: user.email,
      role: "admin",
      userCode: "OP",
      department: "Operaciones y Mantenimiento",
      jobTitle: "Gerente de Operaciones",
      permissions: {},
      createdAt: serverTimestamp(),
      quoteCounter: 0,
      purchaseOrderCounter: 0,
    });
    console.log("✅ Perfil de Administrador creado en Firestore.");
  } else {
    // Asegurar rol admin
    await updateDoc(userDocRef, {
      role: "admin",
      displayName: userDocSnap.data().displayName || "Operaciones Lebaref",
      department: userDocSnap.data().department || "Operaciones y Mantenimiento",
      jobTitle: userDocSnap.data().jobTitle || "Gerente de Operaciones",
      userCode: userDocSnap.data().userCode || "OP",
    });
    console.log("✅ Perfil existente verificado con rol de Administrador.");
  }

  // 2. VERIFICACIÓN Y CREACIÓN DE CATÁLOGOS BASE (CLIENTES, SERVICIOS, REFACCIONES)
  console.log("\n[PASO 2] Verificando catálogos de Clientes, Servicios y Refacciones...");
  const clientsSnap = await getDocs(collection(db, "clients"));
  let sampleClientId = "";
  let sampleClientName = "Hospital Regional de Alta Especialidad de la Península";

  if (clientsSnap.empty) {
    console.log("Creando clientes base de demostración...");
    const client1Ref = await addDoc(collection(db, "clients"), {
      name: sampleClientName,
      contactPerson: "Lic. Roberto Méndez",
      email: "mantenimiento@hraepyucatan.gob.mx",
      phone: "9991234567",
      rfc: "HRA060601ABC",
      fiscalAddress: "Calle 7 No. 433 por 20 y 22, Fracc. Altabrisa, Mérida, Yucatán",
      serviceAddress: "Edificio de Hospitalización Torre B, Mérida, Yucatán",
      type: "Empresa",
      paymentTerms: "30 días",
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
    sampleClientId = client1Ref.id;

    await addDoc(collection(db, "clients"), {
      name: "Plaza Altabrisa Mérida",
      contactPerson: "Ing. Daniela Morales",
      email: "administracion@plazaaltabrisa.com",
      phone: "9999876543",
      rfc: "PAM101010XYZ",
      fiscalAddress: "Periférico Manuel Berzunza, Mérida, Yucatán",
      type: "Empresa",
      paymentTerms: "15 días",
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
    console.log("✅ Clientes creados con éxito.");
  } else {
    sampleClientId = clientsSnap.docs[0].id;
    sampleClientName = clientsSnap.docs[0].data().name;
    console.log(`✅ Clientes existentes encontrados (${clientsSnap.size} clientes). Usando: ${sampleClientName}`);
  }

  // Servicios base
  const servicesSnap = await getDocs(collection(db, "services"));
  if (servicesSnap.empty) {
    console.log("Creando catálogo de servicios...");
    await addDoc(collection(db, "services"), {
      name: "Mantenimiento Mayor a Chiller Enfriado por Agua",
      description: "Desincrustación de condensadores, revisión de compresores y calibración",
      price: 18500,
      unit: "Servicio",
      category: "Refrigeración Industrial",
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "services"), {
      name: "Carga y Detección de Fugas con Gas R-410A",
      description: "Presurización con nitrógeno, vacío a 500 micrones y carga",
      price: 6800,
      unit: "Servicio",
      category: "Refrigeración",
      createdAt: serverTimestamp(),
    });
    console.log("✅ Catálogo de servicios creado.");
  }

  // Refacciones base
  const sparePartsSnap = await getDocs(collection(db, "spare_parts"));
  if (sparePartsSnap.empty) {
    console.log("Creando catálogo de refacciones...");
    await addDoc(collection(db, "spare_parts"), {
      name: "Refrigerante R-410A (Cilindro 11.3 kg)",
      code: "REF-R410A",
      price: 3450,
      cost: 2100,
      stock: 15,
      unit: "Cilindro",
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "spare_parts"), {
      name: "Filtro Deshidratador Soldable 5/8",
      code: "FLT-058",
      price: 850,
      cost: 450,
      stock: 24,
      unit: "PZA",
      createdAt: serverTimestamp(),
    });
    console.log("✅ Catálogo de refacciones creado.");
  }

  // 3. CREACIÓN DE UNA COTIZACIÓN REAL
  console.log("\n[PASO 3] Creando Cotización Real con items, subitems y descripción corta...");
  const quoteNumber = "OP-0001";
  const subtotal = 28750;
  const iva = 16;
  const ivaAmount = subtotal * (iva / 100);
  const total = subtotal + ivaAmount; // $33,350.00

  const quoteDocRef = await addDoc(collection(db, "quotes"), {
    quoteNumber: quoteNumber,
    clientName: sampleClientName,
    clientPhone: "9991234567",
    clientEmail: "mantenimiento@hraepyucatan.gob.mx",
    clientAddress: "Calle 7 No. 433 por 20 y 22, Fracc. Altabrisa, Mérida, Yucatán",
    serviceAddress: "Edificio de Hospitalización Torre B - Sala de Máquinas",
    responsable: "Operaciones Lebaref",
    shortDescription: "Mantenimiento Preventivo y Recarga de Chiller 50TR",
    tipoServicio: "Preventivo / Correctivo",
    tipoTrabajo: "Chiller Industrial",
    equipoLugar: "Chiller York 50TR - Azotea Torre B",
    date: new Date().toISOString().split("T")[0],
    expirationDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    subtotal: subtotal,
    iva: iva,
    total: total,
    status: "Borrador",
    items: [
      {
        description: "Servicio de Mantenimiento Preventivo Mayor a Chiller York 50TR",
        quantity: 1,
        price: 18500,
        unidad: "Servicio",
        subItems: [
          { description: "Limpieza química y desincrustación de condensador", quantity: 1, price: 0 },
          { description: "Revisión eléctrica de contactores y sensores de temperatura", quantity: 1, price: 0 },
          { description: "Prueba de acidez de aceite y aislamiento de bobinas", quantity: 1, price: 0 },
        ]
      },
      {
        description: "Refrigerante Ecológico R-410A de alta pureza (Cilindro 11.3 kg)",
        quantity: 2,
        price: 3450,
        unidad: "Cilindro",
      },
      {
        description: "Filtro Deshidratador Bidireccional de Líquido 5/8",
        quantity: 2,
        price: 1675,
        unidad: "PZA",
      }
    ],
    policies: "Garantía de 90 días en mano de obra. Refacciones con garantía de fabricante de 1 año.",
    paymentTerms: "50% de anticipo al autorizar y 50% al finalizar las pruebas de enfriamiento.",
    userId: user.uid,
    createdAt: serverTimestamp(),
  });

  console.log(`✅ Cotización creada con éxito. ID: ${quoteDocRef.id} | Folio: ${quoteNumber} | Total: $${total.toLocaleString("es-MX")}`);

  // 4. TRANSICIÓN A ESTADO "ENVIADA"
  console.log("\n[PASO 4] Enviando cotización al cliente (Estado: Enviada)...");
  await updateDoc(doc(db, "quotes", quoteDocRef.id), {
    status: "Enviada",
    sentAt: new Date().toISOString(),
  });
  console.log("✅ Cotización marcada como 'Enviada'.");

  // 5. TRANSICIÓN A ESTADO "ACEPTADA" Y GENERACIÓN AUTOMÁTICA DE ORDEN DE TRABAJO (OT)
  console.log("\n[PASO 5] Cliente autoriza la cotización (Estado: Aceptada) -> Generando Orden de Trabajo y CxC...");
  
  // Generar OT correlativa
  const otNumber = "OT-2026-0001";
  const acceptedDate = new Date().toISOString().split("T")[0];

  const otDocRef = await addDoc(collection(db, "ordenes_de_trabajo"), {
    otNumber: otNumber,
    quoteId: quoteDocRef.id,
    quoteNumber: quoteNumber,
    clientName: sampleClientName,
    clientPhone: "9991234567",
    clientEmail: "mantenimiento@hraepyucatan.gob.mx",
    serviceAddress: "Edificio de Hospitalización Torre B - Sala de Máquinas",
    tipoServicio: "Preventivo / Correctivo",
    tipoTrabajo: "Chiller Industrial",
    equipoLugar: "Chiller York 50TR - Azotea Torre B",
    description: "Mantenimiento Preventivo y Recarga de Chiller 50TR",
    date: acceptedDate,
    status: "Pendiente",
    technician: "Ing. Carlos Mendoza",
    supervisor: "Operaciones Lebaref",
    items: [
      { description: "Mantenimiento Preventivo Mayor a Chiller York 50TR", quantity: 1, status: "Pendiente" },
      { description: "Carga de Gas Refrigerante R-410A (2 cilindros)", quantity: 2, status: "Pendiente" },
      { description: "Reemplazo de Filtros Deshidratadores", quantity: 2, status: "Pendiente" },
    ],
    userId: user.uid,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "quotes", quoteDocRef.id), {
    status: "Aceptada",
    acceptedDate: acceptedDate,
    linkedTicketId: otDocRef.id,
  });

  console.log(`✅ Cotización Aceptada y Orden de Trabajo generada: ${otNumber} (ID: ${otDocRef.id})`);

  // 6. CICLO OPERATIVO DE LA ORDEN DE TRABAJO
  console.log("\n[PASO 6] Ejecutando el ciclo operativo de la Orden de Trabajo...");
  
  // 6.1 Asignada
  await updateDoc(doc(db, "ordenes_de_trabajo", otDocRef.id), {
    status: "Asignada",
    technician: "Ing. Carlos Mendoza",
    assignedAt: new Date().toISOString(),
  });
  console.log(`   ➡️ OT ${otNumber} asignada al técnico Ing. Carlos Mendoza.`);

  // 6.2 En Proceso
  await updateDoc(doc(db, "ordenes_de_trabajo", otDocRef.id), {
    status: "En Proceso",
    startedAt: new Date().toISOString(),
    operationalNotes: "Técnico en sitio realizando vacío y limpieza de condensadores.",
  });
  console.log(`   ➡️ OT ${otNumber} en ejecución (En Proceso).`);

  // 6.3 Completada
  await updateDoc(doc(db, "ordenes_de_trabajo", otDocRef.id), {
    status: "Completada",
    completedAt: new Date().toISOString(),
    operationalNotes: "Servicio completado satisfactoriamente. Presiones en 115/380 PSI, temperatura de suministro 7°C.",
  });
  console.log(`   ➡️ OT ${otNumber} completada con éxito.`);

  // 7. FLUJO DE CUENTAS POR COBRAR (CxC), FACTURACIÓN Y PAGOS
  console.log("\n[PASO 7] Gestionando Cuentas por Cobrar (CxC), Facturación y Cobranza...");
  
  // 7.1 Registro de Factura
  const invoiceNumber = "FAC-A2026-045";
  console.log(`   ➡️ Factura emitida por administración: ${invoiceNumber}`);

  // 7.2 Pago de Anticipo (50%)
  const advanceAmount = total / 2; // $16,675.00
  const payment1 = {
    id: "PAY-001",
    amount: advanceAmount,
    date: new Date().toISOString().split("T")[0],
    method: "Transferencia",
    reference: "SPEI-BBVA-98432178",
    invoiceNumber: invoiceNumber,
    notes: "Anticipo 50% por inicio de servicio",
    registeredBy: "Operaciones Lebaref",
    registeredAt: new Date().toISOString(),
  };

  await updateDoc(doc(db, "quotes", quoteDocRef.id), {
    invoiceNumber: invoiceNumber,
    paidAmount: advanceAmount,
    payments: [payment1],
    collectionNotes: [
      {
        id: "NOTE-001",
        date: new Date().toISOString().split("T")[0],
        note: "Cliente realizó transferencia de anticipo del 50%. Resto programado contra entrega.",
        promisedPaymentDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        user: "Operaciones Lebaref",
        createdAt: new Date().toISOString(),
      }
    ]
  });

  const remainingBalance = total - advanceAmount;
  console.log(`   ➡️ Anticipo registrado: $${advanceAmount.toLocaleString("es-MX")} | Saldo Pendiente: $${remainingBalance.toLocaleString("es-MX")}`);

  // 7.3 Liquidación Final (50%)
  const payment2 = {
    id: "PAY-002",
    amount: remainingBalance,
    date: new Date().toISOString().split("T")[0],
    method: "Transferencia",
    reference: "SPEI-BBVA-98439900",
    invoiceNumber: invoiceNumber,
    notes: "Liquidación final 50% tras entrega conforme de OT completada",
    registeredBy: "Operaciones Lebaref",
    registeredAt: new Date().toISOString(),
  };

  await updateDoc(doc(db, "quotes", quoteDocRef.id), {
    status: "Pagada",
    paidAmount: total,
    payments: [payment1, payment2],
  });

  console.log(`   ➡️ Liquidación final registrada: $${remainingBalance.toLocaleString("es-MX")}. Total Pagado: $${total.toLocaleString("es-MX")}`);
  console.log(`   ➡️ Estado de la Cotización actualizado a: 'Pagada' (Saldo $0.00).`);

  // 8. PRUEBA DE RECHAZO Y SINCRONIZACIÓN DE OT (CONTROL DE CANCELACIÓN)
  console.log("\n[PASO 8] Probando seguridad de cancelación y reactivación de cotización/OT...");
  const quote2Ref = await addDoc(collection(db, "quotes"), {
    quoteNumber: "OP-0002",
    clientName: "Plaza Altabrisa Mérida",
    clientPhone: "9999876543",
    clientEmail: "administracion@plazaaltabrisa.com",
    clientAddress: "Periférico Manuel Berzunza, Mérida, Yucatán",
    serviceAddress: "Área de Comidas - Ductería",
    responsable: "Operaciones Lebaref",
    shortDescription: "Mantenimiento a Extractores de Campana",
    date: new Date().toISOString().split("T")[0],
    subtotal: 9500,
    iva: 16,
    total: 11020,
    status: "Aceptada",
    items: [{ description: "Lavado de extractores y cambio de bandas", quantity: 2, price: 4750 }],
    userId: user.uid,
    createdAt: serverTimestamp(),
  });

  const ot2Ref = await addDoc(collection(db, "ordenes_de_trabajo"), {
    otNumber: "OT-2026-0002",
    quoteId: quote2Ref.id,
    quoteNumber: "OP-0002",
    clientName: "Plaza Altabrisa Mérida",
    description: "Mantenimiento a Extractores de Campana",
    date: new Date().toISOString().split("T")[0],
    status: "Pendiente",
    userId: user.uid,
    createdAt: serverTimestamp(),
  });

  // Simular Rechazo: Apagar OT y Descartar de CxC
  await updateDoc(doc(db, "quotes", quote2Ref.id), {
    status: "Rechazada",
    rejectionReason: "Cliente pospone mantenimiento por remodelación del área.",
    rejectedBy: "Operaciones Lebaref",
    rejectedAt: new Date().toISOString(),
  });
  await updateDoc(doc(db, "ordenes_de_trabajo", ot2Ref.id), {
    status: "Cancelada",
    cancellationReason: "Cotización OP-0002 rechazada: Cliente pospone mantenimiento.",
    cancelledBy: "Operaciones Lebaref",
    cancelledAt: new Date().toISOString(),
  });
  console.log(`✅ Cotización OP-0002 Rechazada -> OT OT-2026-0002 apagada a 'Cancelada' y descartada de CxC.`);

  // Simular Reactivación
  await updateDoc(doc(db, "quotes", quote2Ref.id), {
    status: "Aceptada",
    reactivationReason: "Cliente confirma presupuesto para reanudar el trabajo la próxima semana.",
    reactivatedBy: "Operaciones Lebaref",
    reactivatedAt: new Date().toISOString(),
  });
  await updateDoc(doc(db, "ordenes_de_trabajo", ot2Ref.id), {
    status: "Pendiente",
  });
  console.log(`✅ Cotización OP-0002 Reactivada -> OT OT-2026-0002 reactivada a 'Pendiente' y reincorporada a CxC.`);

  console.log("\n================================================================================");
  console.log("🎉 FLUJO DE TRABAJO REAL COMPLETADO CON ÉXITO Y CERO ERRORES");
  console.log("================================================================================");
}

runRealWorkflow().catch(console.error);
