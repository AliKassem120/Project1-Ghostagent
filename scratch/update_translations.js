const fs = require('fs');

const en = JSON.parse(fs.readFileSync('src/messages/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('src/messages/ar.json', 'utf8'));
const fr = JSON.parse(fs.readFileSync('src/messages/fr.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('src/messages/es.json', 'utf8'));

const aboutEn = {
  "title": "Built for businesses that run on DMs.",
  "badge": "The AI Business Agent",
  "desc": "GhostAgent was created for the stores, salons, clinics, studios, and local brands losing sales because customer messages move faster than humans can reply.",
  "missionTitle": "Our mission is simple:",
  "missionHighlight": "turn missed messages into revenue.",
  "missionDesc": "Most small businesses do not need another complicated CRM. They need someone to answer customers instantly, check the right information, and help close the sale or booking. GhostAgent gives every business a reliable AI assistant that works inside the conversations they already use.",
  "p1Title": "Customers message after hours",
  "p1Desc": "Buyers expect instant answers at 2 AM. If you are asleep, they go to a competitor.",
  "p2Title": "Owners miss replies while working",
  "p2Desc": "You are busy fulfilling orders or serving clients, leaving new leads waiting in the inbox.",
  "p3Title": "Generic chatbots guess",
  "p3Desc": "Basic bots hallucinate answers instead of checking real inventory or calendar data.",
  "diffTitle": "Why GhostAgent is different",
  "diffDesc": "GhostAgent is not just a chatbot. It is a workflow system that connects AI replies with business logic like inventory, services, calendar availability, and checkout details.",
  "d1Title": "Built for Instagram DMs",
  "d1Desc": "Sits exactly where your customers already are. No apps to download, no links to click.",
  "d2Title": "Checks live business data",
  "d2Desc": "Connects to your real inventory. It never promises a product that is out of stock.",
  "d3Title": "Handles orders & appointments",
  "d3Desc": "Actually drives conversions. Collects names, phones, addresses, and secures the booking.",
  "d4Title": "Speaks naturally in multiple languages",
  "d4Desc": "Fluently switches between Arabic, English, and French without sounding like a robot.",
  "founderNote": "A note from the founder",
  "founderP1": "\"I built GhostAgent after seeing how many businesses lose customers simply because they cannot reply fast enough.",
  "founderP2": "The goal is not to replace the human side of business — it is to protect it. GhostAgent handles the repetitive messages, checks the facts, and keeps conversations moving so owners can focus on the work only they can do.\"",
  "founderName": "— Ali, Founder of GhostAgent",
  "whoTitle": "Who uses GhostAgent?",
  "whoDesc": "The ultimate tool for the DM-first economy.",
  "ecomTitle": "E-Commerce",
  "ecom1": "Clothing stores",
  "ecom2": "Beauty products",
  "ecom3": "Accessories",
  "ecom4": "Local online shops",
  "ecom5": "Instagram sellers",
  "apptTitle": "Services & Appointments",
  "appt1": "Salons",
  "appt2": "Clinics",
  "appt3": "Barbers",
  "appt4": "Makeup artists",
  "appt5": "Studios",
  "appt6": "Consultants",
  "val1Title": "Accuracy over guessing",
  "val1Desc": "Deterministic routing ensures we never hallucinate prices or stock.",
  "val2Title": "Automation with control",
  "val2Desc": "You set the rules, inventory, and hours. The AI strictly follows them.",
  "val3Title": "Fast replies, human tone",
  "val3Desc": "Professional, warm, and instantaneous responses 24/7.",
  "val4Title": "Built for real businesses",
  "val4Desc": "Focused purely on driving revenue and completing bookings.",
  "ctaTitle": "Ready to stop missing customers in your DMs?",
  "ctaDesc": "Launch your AI business agent and let GhostAgent handle replies, orders, and appointments around the clock.",
  "contactUs": "Contact Us"
};

const aboutAr = {
  "title": "مبني للأعمال التي تعتمد على الرسائل.",
  "badge": "وكيل الأعمال الذكي",
  "desc": "تم إنشاء GhostAgent للمتاجر والصالونات والعيادات والاستوديوهات والعلامات التجارية المحلية التي تفقد المبيعات لأن رسائل العملاء تتحرك أسرع مما يمكن للبشر الرد عليه.",
  "missionTitle": "مهمتنا بسيطة:",
  "missionHighlight": "تحويل الرسائل الفائتة إلى إيرادات.",
  "missionDesc": "معظم الشركات الصغيرة لا تحتاج إلى نظام إدارة علاقات عملاء معقد آخر. يحتاجون إلى شخص يرد على العملاء فوراً، ويتحقق من المعلومات الصحيحة، ويساعد في إغلاق البيع أو الحجز. يمنح GhostAgent كل شركة مساعداً ذكياً موثوقاً يعمل داخل المحادثات التي يستخدمونها بالفعل.",
  "p1Title": "يُراسل العملاء بعد ساعات العمل",
  "p1Desc": "يتوقع المشترون إجابات فورية في الساعة 2 صباحاً. إذا كنت نائماً، سيذهبون إلى منافس.",
  "p2Title": "يُفوت المالكون الردود أثناء العمل",
  "p2Desc": "أنت مشغول بتلبية الطلبات أو خدمة العملاء، تاركاً عملاء محتملين جدد ينتظرون في صندوق الوارد.",
  "p3Title": "روبوتات الدردشة العامة تخمن",
  "p3Desc": "الروبوتات الأساسية تهلوس الإجابات بدلاً من التحقق من المخزون الحقيقي أو بيانات التقويم.",
  "diffTitle": "لماذا GhostAgent مختلف",
  "diffDesc": "GhostAgent ليس مجرد روبوت دردشة. إنه نظام سير عمل يربط ردود الذكاء الاصطناعي بمنطق العمل مثل المخزون والخدمات وتوفر التقويم وتفاصيل الدفع.",
  "d1Title": "مبني لرسائل إنستغرام",
  "d1Desc": "يقع بالضبط حيث يتواجد عملاؤك بالفعل. لا تطبيقات للتنزيل، لا روابط للنقر.",
  "d2Title": "يتحقق من بيانات العمل المباشرة",
  "d2Desc": "يتصل بمخزونك الحقيقي. لا يعد أبداً بمنتج غير متوفر.",
  "d3Title": "يتعامل مع الطلبات والحجوزات",
  "d3Desc": "يدفع التحويلات فعلياً. يجمع الأسماء والهواتف والعناوين، ويؤمن الحجز.",
  "d4Title": "يتحدث بطلاقة بلغات متعددة",
  "d4Desc": "يتحول بطلاقة بين العربية والإنجليزية والفرنسية دون أن يبدو كروبوت.",
  "founderNote": "ملاحظة من المؤسس",
  "founderP1": "\"بنيت GhostAgent بعد أن رأيت كم من الشركات تفقد العملاء ببساطة لأنهم لا يستطيعون الرد بسرعة كافية.",
  "founderP2": "الهدف ليس استبدال الجانب البشري من العمل — بل حمايته. يتولى GhostAgent الرسائل المتكررة، ويتحقق من الحقائق، ويبقي المحادثات تتحرك حتى يتمكن المالكون من التركيز على العمل الذي يمكنهم فقط القيام به.\"",
  "founderName": "— علي، مؤسس GhostAgent",
  "whoTitle": "من يستخدم GhostAgent؟",
  "whoDesc": "الأداة النهائية لاقتصاد الرسائل المباشرة.",
  "ecomTitle": "التجارة الإلكترونية",
  "ecom1": "متاجر الملابس",
  "ecom2": "منتجات التجميل",
  "ecom3": "الإكسسوارات",
  "ecom4": "المتاجر الإلكترونية المحلية",
  "ecom5": "بائعو إنستغرام",
  "apptTitle": "الخدمات والمواعيد",
  "appt1": "الصالونات",
  "appt2": "العيادات",
  "appt3": "الحلاقون",
  "appt4": "خبراء المكياج",
  "appt5": "الاستوديوهات",
  "appt6": "المستشارون",
  "val1Title": "الدقة على التخمين",
  "val1Desc": "يضمن التوجيه الحتمي أننا لا نهلوس أبداً بالأسعار أو المخزون.",
  "val2Title": "أتمتة مع تحكم",
  "val2Desc": "أنت تضع القواعد والمخزون وساعات العمل. يتبعها الذكاء الاصطناعي بصرامة.",
  "val3Title": "ردود سريعة، نبرة بشرية",
  "val3Desc": "ردود احترافية ودافئة وفورية على مدار الساعة.",
  "val4Title": "مبني للأعمال الحقيقية",
  "val4Desc": "يركز بحتة على دفع الإيرادات وإكمال الحجوزات.",
  "ctaTitle": "مستعد للتوقف عن فقدان العملاء في رسائلك؟",
  "ctaDesc": "أطلق وكيل أعمالك الذكي ودع GhostAgent يتولى الردود والطلبات والمواعيد على مدار الساعة.",
  "contactUs": "تواصل معنا"
};

const termsEn = {
  "title": "Terms of Service",
  "lastUpdated": "Last updated: February 2026",
  "s1t": "1. Acceptance of Terms",
  "s1c": "By accessing or using GhostAgent (\"we,\" \"our,\" or \"us\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.",
  "s2t": "2. Description of Service",
  "s2c": "GhostAgent provides an automated Instagram DM management platform powered by Artificial Intelligence (AI). We enable businesses to manage messaging workflows, inventory syncing, and automated replies.",
  "s4t": "4. User Responsibilities",
  "s4c": "You agree to use the service in compliance with all applicable laws and Meta's Terms of Service. You are responsible for maintaining the security of your account credentials.",
  "s5t": "5. Termination",
  "s5c": "We reserve the right to suspend or terminate your access to GhostAgent at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.",
  "s6t": "6. Changes to Terms",
  "s6c": "We reserve the right to modify these terms at any time. Your continued use of the service constitutes acceptance of the modified terms.",
  "aiTitle": "3. AI Liability Disclaimer",
  "aiDesc1": "GhostAgent is an AI-powered tool. While we strive for accuracy, AI models may generate incorrect, misleading, or inappropriate responses (\"hallucinations\").",
  "aiDesc2": "You acknowledge and agree that:",
  "aiList1": "You are solely responsible for reviewing and overseeing the AI's interactions with your customers.",
  "aiList2": "GhostAgent is not liable for any loss of business, reputation damage, or legal consequences arising from AI-generated content.",
  "aiList3": "You should regularly monitor the AI's performance and intervene when necessary."
};

const termsAr = {
  "title": "شروط الخدمة",
  "lastUpdated": "آخر تحديث: فبراير 2026",
  "s1t": "1. قبول الشروط",
  "s1c": "من خلال الوصول إلى GhostAgent أو استخدامه، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا كنت لا توافق على هذه الشروط، فلا يجوز لك الوصول إلى خدماتنا أو استخدامها.",
  "s2t": "2. وصف الخدمة",
  "s2c": "يوفر GhostAgent منصة إدارة رسائل إنستغرام آلية مدعومة بالذكاء الاصطناعي. نحن نمكن الشركات من إدارة سير عمل المراسلة ومزامنة المخزون والردود الآلية.",
  "s4t": "4. مسؤوليات المستخدم",
  "s4c": "أنت توافق على استخدام الخدمة بامتثال لجميع القوانين المعمول بها وشروط خدمة Meta. أنت مسؤول عن الحفاظ على أمان بيانات اعتماد حسابك.",
  "s5t": "5. الإنهاء",
  "s5c": "نحتفظ بالحق في تعليق أو إنهاء وصولك إلى GhostAgent وفقاً لتقديرنا الخاص، دون إشعار، للسلوك الذي نعتقد أنه ينتهك شروط الخدمة هذه أو يضر بالمستخدمين الآخرين أو بنا أو بأطراف ثالثة.",
  "s6t": "6. تغييرات الشروط",
  "s6c": "نحتفظ بالحق في تعديل هذه الشروط في أي وقت. يشكل استمرارك في استخدام الخدمة قبولاً للشروط المعدلة.",
  "aiTitle": "3. إخلاء مسؤولية الذكاء الاصطناعي",
  "aiDesc1": "GhostAgent هي أداة مدعومة بالذكاء الاصطناعي. بينما نسعى جاهدين لتحقيق الدقة، قد تولد نماذج الذكاء الاصطناعي ردوداً غير صحيحة أو مضللة أو غير مناسبة (هلوسة).",
  "aiDesc2": "أنت تقر وتوافق على أن:",
  "aiList1": "أنت المسؤول الوحيد عن مراجعة والإشراف على تفاعلات الذكاء الاصطناعي مع عملائك.",
  "aiList2": "GhostAgent ليس مسؤولاً عن أي خسارة في العمل أو ضرر في السمعة أو عواقب قانونية ناشئة عن المحتوى المولد بواسطة الذكاء الاصطناعي.",
  "aiList3": "يجب عليك مراقبة أداء الذكاء الاصطناعي بانتظام والتدخل عند الضرورة."
};

const privacyEn = {
  "title": "Privacy Policy",
  "lastUpdated": "Last updated: February 2026",
  "s1t": "1. Introduction",
  "s1c": "Welcome to GhostAgent (\"we,\" \"our,\" or \"us\"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and shield your information when you use our automated Instagram DM service.",
  "s2t": "2. Integration with Meta Platform Technologies",
  "s2c": "Our service integrates directly with Meta Platform Technologies (specifically Instagram and Facebook Graph APIs) to read and reply to direct messages on your behalf. By using GhostAgent, you acknowledge that your data is processed in accordance with Meta's Platform Terms and Developer Policies. We only access the data necessary to perform the automated response function.",
  "s3t": "3. Data Storage and Processing",
  "s3c": "We use industry-standard providers to facilitate our service:",
  "s3l1": "<strong>Supabase:</strong> We use Supabase securely to store user account information, authentication data, and activity logs.",
  "s3l2": "<strong>AI Processing:</strong> Incoming messages are processed by advanced AI models to generate relevant responses. These third-party AI providers do not use your data for training their models without your explicit consent.",
  "s4t": "4. Data Collection",
  "s4c": "We collect the following types of information:",
  "s4l1": "<strong>Account Information:</strong> Your email address and authentication tokens required to link your Instagram account.",
  "s4l2": "<strong>Communication Data:</strong> Logs of incoming messages and outgoing AI-generated replies for the purpose of maintaining conversation history and improving service quality.",
  "s6t": "6. Contact Us",
  "s6c": "If you have questions about this Privacy Policy, please contact us at support@ghostagent.qzz.io.",
  "delTitle": "5. Data Deletion Instructions",
  "delDesc": "You have the right to request the complete deletion of your personal data stored on our servers at any time. To exercise this right:",
  "del1": "Send an email to <strong className=\"text-primary\">support@ghostagent.qzz.io</strong> with the subject line \"Data Deletion Request\".",
  "del2": "Include your registered email address and your connected Instagram handle.",
  "del3": "We will process your request within 30 days and permanently delete your account, authentication tokens, and all associated chat logs from our database."
};

const privacyAr = {
  "title": "سياسة الخصوصية",
  "lastUpdated": "آخر تحديث: فبراير 2026",
  "s1t": "1. مقدمة",
  "s1c": "مرحباً بك في GhostAgent (\"نحن\"، أو \"خاصتنا\"). نحن ملتزمون بحماية معلوماتك الشخصية وحقك في الخصوصية. تشرح سياسة الخصوصية هذه كيف نجمع ونستخدم ونكشف ونحمي معلوماتك عند استخدام خدمة رسائل إنستغرام الآلية الخاصة بنا.",
  "s2t": "2. التكامل مع تقنيات منصة Meta",
  "s2c": "تتكامل خدمتنا مباشرة مع تقنيات منصة Meta (تحديداً واجهات برمجة تطبيقات Instagram و Facebook Graph) لقراءة والرد على الرسائل المباشرة نيابة عنك. باستخدام GhostAgent، فإنك تقر بأن بياناتك تتم معالجتها وفقاً لشروط منصة Meta وسياسات المطورين. نصل فقط إلى البيانات اللازمة لأداء وظيفة الرد الآلي.",
  "s3t": "3. تخزين البيانات ومعالجتها",
  "s3c": "نستخدم مزودين بمعايير الصناعة لتسهيل خدمتنا:",
  "s3l1": "<strong>Supabase:</strong> نستخدم Supabase بأمان لتخزين معلومات حساب المستخدم وبيانات المصادقة وسجلات النشاط.",
  "s3l2": "<strong>معالجة الذكاء الاصطناعي:</strong> تتم معالجة الرسائل الواردة بواسطة نماذج ذكاء اصطناعي متقدمة لتوليد ردود ذات صلة. لا يستخدم مزودو الذكاء الاصطناعي التابعون لجهات خارجية بياناتك لتدريب نماذجهم دون موافقتك الصريحة.",
  "s4t": "4. جمع البيانات",
  "s4c": "نجمع الأنواع التالية من المعلومات:",
  "s4l1": "<strong>معلومات الحساب:</strong> عنوان بريدك الإلكتروني ورموز المصادقة المطلوبة لربط حساب إنستغرام الخاص بك.",
  "s4l2": "<strong>بيانات الاتصال:</strong> سجلات الرسائل الواردة والردود الصادرة المولدة بالذكاء الاصطناعي بغرض الحفاظ على سجل المحادثة وتحسين جودة الخدمة.",
  "s6t": "6. تواصل معنا",
  "s6c": "إذا كانت لديك أسئلة حول سياسة الخصوصية هذه، يرجى الاتصال بنا على support@ghostagent.qzz.io.",
  "delTitle": "5. تعليمات حذف البيانات",
  "delDesc": "لديك الحق في طلب الحذف الكامل لبياناتك الشخصية المخزنة على خوادمنا في أي وقت. لممارسة هذا الحق:",
  "del1": "أرسل بريداً إلكترونياً إلى <strong className=\"text-primary\">support@ghostagent.qzz.io</strong> بعنوان \"طلب حذف البيانات\".",
  "del2": "قم بتضمين عنوان بريدك الإلكتروني المسجل وحساب إنستغرام المرتبط بك.",
  "del3": "سنقوم بمعالجة طلبك في غضون 30 يوماً وحذف حسابك ورموز المصادقة وجميع سجلات الدردشة المرتبطة بها نهائياً من قاعدة بياناتنا."
};

en.About = aboutEn;
en.Terms = termsEn;
en.Privacy = privacyEn;

ar.About = aboutAr;
ar.Terms = termsAr;
ar.Privacy = privacyAr;

fr.About = aboutEn;
fr.Terms = termsEn;
fr.Privacy = privacyEn;

es.About = aboutEn;
es.Terms = termsEn;
es.Privacy = privacyEn;

fs.writeFileSync('src/messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('src/messages/ar.json', JSON.stringify(ar, null, 2));
fs.writeFileSync('src/messages/fr.json', JSON.stringify(fr, null, 2));
fs.writeFileSync('src/messages/es.json', JSON.stringify(es, null, 2));

console.log("Translations successfully updated.");
