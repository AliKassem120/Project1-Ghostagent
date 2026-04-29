const fs = require('fs');
const fr = JSON.parse(fs.readFileSync('src/messages/fr.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('src/messages/es.json', 'utf8'));

// ═══════════════════════════════════════════════════════════
// FRENCH — About, Terms, Privacy + scattered missing
// ═══════════════════════════════════════════════════════════

fr.About = {
  "title": "Conçu pour les entreprises qui vivent dans les DMs.",
  "badge": "L'Agent Business IA",
  "desc": "GhostAgent a été créé pour les boutiques, salons, cliniques, studios et marques locales qui perdent des ventes parce que les messages clients arrivent plus vite que les humains ne peuvent répondre.",
  "missionTitle": "Notre mission est simple :",
  "missionHighlight": "transformer les messages manqués en revenus.",
  "missionDesc": "La plupart des petites entreprises n'ont pas besoin d'un CRM complexe de plus. Elles ont besoin de quelqu'un qui répond instantanément aux clients, vérifie les bonnes informations et aide à conclure la vente ou la réservation. GhostAgent offre à chaque entreprise un assistant IA fiable qui travaille dans les conversations qu'elles utilisent déjà.",
  "p1Title": "Les clients écrivent après les heures d'ouverture",
  "p1Desc": "Les acheteurs attendent des réponses instantanées à 2h du matin. Si vous dormez, ils vont chez un concurrent.",
  "p2Title": "Les propriétaires ratent des messages en travaillant",
  "p2Desc": "Vous êtes occupé à préparer des commandes ou servir des clients, laissant de nouveaux prospects attendre.",
  "p3Title": "Les chatbots classiques devinent",
  "p3Desc": "Les bots basiques inventent des réponses au lieu de vérifier les stocks réels ou les disponibilités.",
  "diffTitle": "Pourquoi GhostAgent est différent",
  "diffDesc": "GhostAgent n'est pas un simple chatbot. C'est un système de workflow qui connecte les réponses IA à la logique métier : stocks, services, disponibilités et détails de paiement.",
  "d1Title": "Conçu pour les DMs Instagram",
  "d1Desc": "Se place exactement là où vos clients sont déjà. Pas d'appli à télécharger, pas de lien à cliquer.",
  "d2Title": "Vérifie les données en temps réel",
  "d2Desc": "Connecté à votre inventaire réel. Il ne promet jamais un produit en rupture de stock.",
  "d3Title": "Gère commandes et rendez-vous",
  "d3Desc": "Génère des conversions. Collecte noms, téléphones, adresses et sécurise les réservations.",
  "d4Title": "Parle naturellement en plusieurs langues",
  "d4Desc": "Passe fluidement entre l'arabe, l'anglais et le français sans paraître robotique.",
  "founderNote": "Un mot du fondateur",
  "founderP1": "\"J'ai créé GhostAgent après avoir vu combien d'entreprises perdent des clients simplement parce qu'elles ne peuvent pas répondre assez vite.",
  "founderP2": "L'objectif n'est pas de remplacer le côté humain du business — c'est de le protéger. GhostAgent gère les messages répétitifs, vérifie les faits et maintient les conversations en mouvement pour que les propriétaires puissent se concentrer sur ce qu'eux seuls peuvent faire.\"",
  "founderName": "— Ali, Fondateur de GhostAgent",
  "whoTitle": "Qui utilise GhostAgent ?",
  "whoDesc": "L'outil ultime pour l'économie du DM.",
  "ecomTitle": "E-Commerce",
  "ecom1": "Boutiques de vêtements",
  "ecom2": "Produits de beauté",
  "ecom3": "Accessoires",
  "ecom4": "Boutiques en ligne locales",
  "ecom5": "Vendeurs Instagram",
  "apptTitle": "Services et Rendez-vous",
  "appt1": "Salons",
  "appt2": "Cliniques",
  "appt3": "Barbiers",
  "appt4": "Maquilleurs",
  "appt5": "Studios",
  "appt6": "Consultants",
  "val1Title": "La précision avant la supposition",
  "val1Desc": "Le routage déterministe garantit qu'on n'invente jamais les prix ou les stocks.",
  "val2Title": "Automatisation avec contrôle",
  "val2Desc": "Vous définissez les règles, l'inventaire et les horaires. L'IA les suit strictement.",
  "val3Title": "Réponses rapides, ton humain",
  "val3Desc": "Réponses professionnelles, chaleureuses et instantanées 24h/24.",
  "val4Title": "Conçu pour les vrais business",
  "val4Desc": "Focalisé uniquement sur la génération de revenus et la prise de réservations.",
  "ctaTitle": "Prêt à arrêter de perdre des clients dans vos DMs ?",
  "ctaDesc": "Lancez votre agent business IA et laissez GhostAgent gérer les réponses, commandes et rendez-vous 24h/24.",
  "contactUs": "Nous contacter"
};

fr.Terms = {
  "title": "Conditions d'utilisation",
  "lastUpdated": "Dernière mise à jour : Février 2026",
  "s1t": "1. Acceptation des conditions",
  "s1c": "En accédant ou en utilisant GhostAgent (\"nous\"), vous acceptez d'être lié par ces Conditions d'utilisation. Si vous n'acceptez pas ces conditions, vous ne pouvez pas accéder à nos services.",
  "s2t": "2. Description du service",
  "s2c": "GhostAgent fournit une plateforme de gestion automatisée des DMs Instagram alimentée par l'Intelligence Artificielle (IA). Nous permettons aux entreprises de gérer les flux de messagerie, la synchronisation des stocks et les réponses automatisées.",
  "s4t": "4. Responsabilités de l'utilisateur",
  "s4c": "Vous acceptez d'utiliser le service en conformité avec toutes les lois applicables et les Conditions d'utilisation de Meta. Vous êtes responsable de la sécurité de vos identifiants.",
  "s5t": "5. Résiliation",
  "s5c": "Nous nous réservons le droit de suspendre ou de résilier votre accès à GhostAgent à notre seule discrétion, sans préavis, pour tout comportement que nous estimons enfreindre ces Conditions.",
  "s6t": "6. Modifications des conditions",
  "s6c": "Nous nous réservons le droit de modifier ces conditions à tout moment. Votre utilisation continue du service constitue l'acceptation des conditions modifiées.",
  "aiTitle": "3. Clause de responsabilité IA",
  "aiDesc1": "GhostAgent est un outil alimenté par l'IA. Bien que nous visons la précision, les modèles IA peuvent générer des réponses incorrectes, trompeuses ou inappropriées (\"hallucinations\").",
  "aiDesc2": "Vous reconnaissez et acceptez que :",
  "aiList1": "Vous êtes seul responsable de la supervision des interactions de l'IA avec vos clients.",
  "aiList2": "GhostAgent n'est pas responsable de toute perte commerciale, atteinte à la réputation ou conséquences juridiques résultant du contenu généré par l'IA.",
  "aiList3": "Vous devez surveiller régulièrement les performances de l'IA et intervenir si nécessaire."
};

fr.Privacy = {
  "title": "Politique de confidentialité",
  "lastUpdated": "Dernière mise à jour : Février 2026",
  "s1t": "1. Introduction",
  "s1c": "Bienvenue chez GhostAgent (\"nous\"). Nous nous engageons à protéger vos informations personnelles et votre droit à la vie privée. Cette politique explique comment nous collectons, utilisons et protégeons vos informations lorsque vous utilisez notre service de DMs Instagram automatisé.",
  "s2t": "2. Intégration avec les technologies Meta",
  "s2c": "Notre service s'intègre directement aux technologies de la plateforme Meta pour lire et répondre aux messages directs en votre nom. En utilisant GhostAgent, vous reconnaissez que vos données sont traitées conformément aux conditions de la plateforme Meta.",
  "s3t": "3. Stockage et traitement des données",
  "s3c": "Nous utilisons des fournisseurs aux normes de l'industrie pour faciliter notre service :",
  "s3l1": "<strong>Supabase :</strong> Nous utilisons Supabase de manière sécurisée pour stocker les informations de compte, les données d'authentification et les journaux d'activité.",
  "s3l2": "<strong>Traitement IA :</strong> Les messages entrants sont traités par des modèles IA avancés pour générer des réponses pertinentes. Ces fournisseurs n'utilisent pas vos données pour entraîner leurs modèles sans votre consentement.",
  "s4t": "4. Collecte de données",
  "s4c": "Nous collectons les types d'informations suivants :",
  "s4l1": "<strong>Informations de compte :</strong> Votre adresse email et les tokens d'authentification nécessaires pour lier votre compte Instagram.",
  "s4l2": "<strong>Données de communication :</strong> Journaux des messages entrants et des réponses IA sortantes pour maintenir l'historique des conversations.",
  "s6t": "6. Nous contacter",
  "s6c": "Si vous avez des questions sur cette politique, contactez-nous à support@ghostagent.qzz.io.",
  "delTitle": "5. Instructions de suppression des données",
  "delDesc": "Vous avez le droit de demander la suppression complète de vos données personnelles à tout moment. Pour exercer ce droit :",
  "del1": "Envoyez un email à <strong className=\"text-primary\">support@ghostagent.qzz.io</strong> avec l'objet \"Demande de suppression de données\".",
  "del2": "Incluez votre adresse email enregistrée et votre identifiant Instagram connecté.",
  "del3": "Nous traiterons votre demande sous 30 jours et supprimerons définitivement votre compte et toutes les données associées."
};

// Fix scattered missing FR translations
if (fr.Navbar.getStarted === "Get Started") fr.Navbar.getStarted = "Commencer";
if (fr.Hero.instagram === "Instagram") fr.Hero.instagram = "Instagram";
if (fr.Hero.comingSoon === "Coming Soon") fr.Hero.comingSoon = "Bientôt disponible";
if (fr.Footer.about === "About") fr.Footer.about = "À propos";
if (fr.Common && fr.Common.signOut === "Sign Out") fr.Common.signOut = "Déconnexion";
if (fr.Common && fr.Common.save === "Save") fr.Common.save = "Enregistrer";
if (fr.Common && fr.Common.cancel === "Cancel") fr.Common.cancel = "Annuler";
if (fr.Common && fr.Common.loading === "Loading") fr.Common.loading = "Chargement";


// ═══════════════════════════════════════════════════════════
// SPANISH — About, Terms, Privacy + scattered missing
// ═══════════════════════════════════════════════════════════

es.About = {
  "title": "Hecho para negocios que viven en los DMs.",
  "badge": "El Agente de Negocios IA",
  "desc": "GhostAgent fue creado para las tiendas, salones, clínicas, estudios y marcas locales que pierden ventas porque los mensajes de los clientes llegan más rápido de lo que los humanos pueden responder.",
  "missionTitle": "Nuestra misión es simple:",
  "missionHighlight": "convertir mensajes perdidos en ingresos.",
  "missionDesc": "La mayoría de las pequeñas empresas no necesitan otro CRM complicado. Necesitan a alguien que responda a los clientes al instante, verifique la información correcta y ayude a cerrar la venta o la reserva. GhostAgent le da a cada negocio un asistente IA confiable que trabaja dentro de las conversaciones que ya usan.",
  "p1Title": "Los clientes escriben fuera de horario",
  "p1Desc": "Los compradores esperan respuestas instantáneas a las 2 AM. Si estás dormido, van con un competidor.",
  "p2Title": "Los dueños pierden mensajes trabajando",
  "p2Desc": "Estás ocupado cumpliendo pedidos o atendiendo clientes, dejando nuevos prospectos esperando.",
  "p3Title": "Los chatbots genéricos adivinan",
  "p3Desc": "Los bots básicos inventan respuestas en vez de verificar el inventario real o disponibilidad.",
  "diffTitle": "Por qué GhostAgent es diferente",
  "diffDesc": "GhostAgent no es solo un chatbot. Es un sistema de flujo de trabajo que conecta las respuestas IA con la lógica de negocio: inventario, servicios, disponibilidad y detalles de pago.",
  "d1Title": "Hecho para DMs de Instagram",
  "d1Desc": "Se ubica exactamente donde tus clientes ya están. Sin apps que descargar, sin enlaces que abrir.",
  "d2Title": "Verifica datos del negocio en vivo",
  "d2Desc": "Conectado a tu inventario real. Nunca promete un producto agotado.",
  "d3Title": "Gestiona pedidos y citas",
  "d3Desc": "Genera conversiones reales. Recopila nombres, teléfonos, direcciones y asegura las reservas.",
  "d4Title": "Habla naturalmente en varios idiomas",
  "d4Desc": "Cambia fluidamente entre árabe, inglés y francés sin sonar como un robot.",
  "founderNote": "Una nota del fundador",
  "founderP1": "\"Construí GhostAgent después de ver cuántos negocios pierden clientes simplemente porque no pueden responder lo suficientemente rápido.",
  "founderP2": "El objetivo no es reemplazar el lado humano del negocio — es protegerlo. GhostAgent maneja los mensajes repetitivos, verifica los datos y mantiene las conversaciones en movimiento para que los dueños puedan enfocarse en el trabajo que solo ellos pueden hacer.\"",
  "founderName": "— Ali, Fundador de GhostAgent",
  "whoTitle": "¿Quién usa GhostAgent?",
  "whoDesc": "La herramienta definitiva para la economía del DM.",
  "ecomTitle": "E-Commerce",
  "ecom1": "Tiendas de ropa",
  "ecom2": "Productos de belleza",
  "ecom3": "Accesorios",
  "ecom4": "Tiendas online locales",
  "ecom5": "Vendedores de Instagram",
  "apptTitle": "Servicios y Citas",
  "appt1": "Salones",
  "appt2": "Clínicas",
  "appt3": "Barberías",
  "appt4": "Maquillistas",
  "appt5": "Estudios",
  "appt6": "Consultores",
  "val1Title": "Precisión sobre suposiciones",
  "val1Desc": "El enrutamiento determinístico garantiza que nunca inventamos precios ni stock.",
  "val2Title": "Automatización con control",
  "val2Desc": "Tú defines las reglas, el inventario y los horarios. La IA los sigue estrictamente.",
  "val3Title": "Respuestas rápidas, tono humano",
  "val3Desc": "Respuestas profesionales, cálidas e instantáneas las 24 horas.",
  "val4Title": "Hecho para negocios reales",
  "val4Desc": "Enfocado puramente en generar ingresos y completar reservas.",
  "ctaTitle": "¿Listo para dejar de perder clientes en tus DMs?",
  "ctaDesc": "Lanza tu agente de negocios IA y deja que GhostAgent maneje respuestas, pedidos y citas las 24 horas.",
  "contactUs": "Contáctanos"
};

es.Terms = {
  "title": "Términos de Servicio",
  "lastUpdated": "Última actualización: Febrero 2026",
  "s1t": "1. Aceptación de los Términos",
  "s1c": "Al acceder o usar GhostAgent (\"nosotros\"), aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo, no puedes acceder ni usar nuestros servicios.",
  "s2t": "2. Descripción del Servicio",
  "s2c": "GhostAgent proporciona una plataforma automatizada de gestión de DMs de Instagram impulsada por Inteligencia Artificial (IA). Permitimos a las empresas gestionar flujos de mensajería, sincronización de inventario y respuestas automáticas.",
  "s4t": "4. Responsabilidades del Usuario",
  "s4c": "Aceptas usar el servicio en cumplimiento con todas las leyes aplicables y los Términos de Servicio de Meta. Eres responsable de mantener la seguridad de tus credenciales.",
  "s5t": "5. Terminación",
  "s5c": "Nos reservamos el derecho de suspender o terminar tu acceso a GhostAgent a nuestra sola discreción, sin aviso, por conducta que consideremos que viola estos Términos.",
  "s6t": "6. Cambios en los Términos",
  "s6c": "Nos reservamos el derecho de modificar estos términos en cualquier momento. Tu uso continuado del servicio constituye la aceptación de los términos modificados.",
  "aiTitle": "3. Descargo de Responsabilidad de IA",
  "aiDesc1": "GhostAgent es una herramienta impulsada por IA. Aunque buscamos precisión, los modelos de IA pueden generar respuestas incorrectas, engañosas o inapropiadas (\"alucinaciones\").",
  "aiDesc2": "Reconoces y aceptas que:",
  "aiList1": "Eres el único responsable de supervisar las interacciones de la IA con tus clientes.",
  "aiList2": "GhostAgent no es responsable de ninguna pérdida comercial, daño reputacional o consecuencias legales derivadas del contenido generado por IA.",
  "aiList3": "Debes monitorear regularmente el rendimiento de la IA e intervenir cuando sea necesario."
};

es.Privacy = {
  "title": "Política de Privacidad",
  "lastUpdated": "Última actualización: Febrero 2026",
  "s1t": "1. Introducción",
  "s1c": "Bienvenido a GhostAgent (\"nosotros\"). Estamos comprometidos a proteger tu información personal y tu derecho a la privacidad. Esta política explica cómo recopilamos, usamos y protegemos tu información cuando usas nuestro servicio automatizado de DMs de Instagram.",
  "s2t": "2. Integración con las tecnologías de Meta",
  "s2c": "Nuestro servicio se integra directamente con las tecnologías de la plataforma Meta para leer y responder mensajes directos en tu nombre. Al usar GhostAgent, reconoces que tus datos se procesan de acuerdo con los términos de la plataforma Meta.",
  "s3t": "3. Almacenamiento y Procesamiento de Datos",
  "s3c": "Utilizamos proveedores estándar de la industria para facilitar nuestro servicio:",
  "s3l1": "<strong>Supabase:</strong> Usamos Supabase de forma segura para almacenar información de cuentas, datos de autenticación y registros de actividad.",
  "s3l2": "<strong>Procesamiento IA:</strong> Los mensajes entrantes son procesados por modelos de IA avanzados para generar respuestas relevantes. Estos proveedores no usan tus datos para entrenar sus modelos sin tu consentimiento.",
  "s4t": "4. Recopilación de Datos",
  "s4c": "Recopilamos los siguientes tipos de información:",
  "s4l1": "<strong>Información de Cuenta:</strong> Tu dirección de email y tokens de autenticación necesarios para vincular tu cuenta de Instagram.",
  "s4l2": "<strong>Datos de Comunicación:</strong> Registros de mensajes entrantes y respuestas IA salientes para mantener el historial de conversaciones.",
  "s6t": "6. Contáctanos",
  "s6c": "Si tienes preguntas sobre esta Política de Privacidad, contáctanos en support@ghostagent.qzz.io.",
  "delTitle": "5. Instrucciones de Eliminación de Datos",
  "delDesc": "Tienes derecho a solicitar la eliminación completa de tus datos personales en cualquier momento. Para ejercer este derecho:",
  "del1": "Envía un email a <strong className=\"text-primary\">support@ghostagent.qzz.io</strong> con el asunto \"Solicitud de Eliminación de Datos\".",
  "del2": "Incluye tu dirección de email registrada y tu cuenta de Instagram conectada.",
  "del3": "Procesaremos tu solicitud en un plazo de 30 días y eliminaremos permanentemente tu cuenta y todos los datos asociados."
};

// Fix scattered missing ES translations
if (es.Navbar.getStarted === "Get Started") es.Navbar.getStarted = "Comenzar";
if (es.Hero.comingSoon === "Coming Soon") es.Hero.comingSoon = "Próximamente";
if (es.Footer && es.Footer.about === "About") es.Footer.about = "Acerca de";
if (es.Common && es.Common.signOut === "Sign Out") es.Common.signOut = "Cerrar sesión";
if (es.Common && es.Common.save === "Save") es.Common.save = "Guardar";
if (es.Common && es.Common.cancel === "Cancel") es.Common.cancel = "Cancelar";
if (es.Common && es.Common.loading === "Loading") es.Common.loading = "Cargando";

fs.writeFileSync('src/messages/fr.json', JSON.stringify(fr, null, 2));
fs.writeFileSync('src/messages/es.json', JSON.stringify(es, null, 2));
console.log("FR and ES translations updated successfully.");
