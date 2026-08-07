import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

/**
 * Privacy Policy, in both languages.
 *
 * /ar/privacy used to render this component with English content. Direction
 * (rtl/ltr) is handled by I18nProvider, so nothing here sets it.
 *
 * TODO(contact): the support address was removed at the owner's request and a
 * replacement is not chosen yet. Both the privacy and delivery policies now
 * say "get in touch" without saying how. PDPL expects a reachable contact for
 * data-access and deletion requests, and the App Store privacy questionnaire
 * asks for one too — so this must be filled before submission, in BOTH
 * languages here and in policies/delivery.tsx.
 *
 * NOTE FOR WHOEVER TOUCHES THIS NEXT: sections 1 and 3 describe a product that
 * takes no card payments. That is true today and becomes FALSE the moment a
 * payment gateway is connected. Update both, in both languages, as part of
 * that work — a privacy policy that describes the wrong product is worse than
 * a thin one.
 */

type Section = { title: string; body: string };

const EN: Section[] = [
  {
    title: "1. Information We Collect",
    body: "To create your account and book games, we collect your name, phone number, and email address. If you choose to add a profile photo, we store it. When you book a game, we record the booking details and which payment method you chose (cash at the pitch, or STC Pay) — we do not collect or store card numbers, since PlayOS does not currently process card payments directly. If you enable match reminders, we store a device push token so we can notify you before kickoff. If you allow it, we use your device location only while the app is open, to sort pitches by how close they are — we do not store your location. We also collect basic usage data (pages visited, app interactions) to understand how PlayOS is used and improve it.",
  },
  {
    title: "2. We Do Not Sell Your Data",
    body: "We do not sell, rent, lease, or trade your personal information — name, phone number, email, booking history, or payment details — to any third party, for advertising or any other purpose. Your data is used only to operate PlayOS: to confirm bookings, contact you about your games, and send reminders you've opted into.",
  },
  {
    title: "3. Secure Payments",
    body: "PlayOS does not currently process card payments. Bookings are settled via cash at the pitch or STC Pay, confirmed directly by the operator — your card details never pass through PlayOS's systems.",
  },
  {
    title: "4. Who Processes Your Data",
    body: "We use a small number of service providers to run PlayOS: Supabase (database, authentication and file storage), PostHog (usage analytics), and Expo (delivery of push notifications). These providers process data on our behalf and are not permitted to use it for their own purposes. Some of them operate servers outside the Kingdom of Saudi Arabia, which means your personal data may be stored or processed abroad under contractual safeguards.",
  },
  {
    title: "5. Data Security",
    body: "We keep your data safe using industry-standard measures: encrypted connections (HTTPS) for all traffic, access-controlled database policies so only you and the operator can see your booking data, and no card data storage of any kind. No online system can guarantee absolute security, but we take reasonable, ongoing steps to protect your information.",
  },
  {
    title: "6. Your Rights Under Saudi Law (PDPL)",
    body: "Under the Saudi Personal Data Protection Law (PDPL), you have the right to know what personal data we hold about you, request a copy of it, ask us to correct inaccurate data, withdraw your consent, and request that we delete your account and associated data. You can delete your account yourself at any time from Settings in the PlayOS app. To exercise any other right, or to complain about how we handle your data, get in touch with us.",
  },
  {
    title: "7. Third-Party Links",
    body: "PlayOS is not responsible for the privacy policies of websites to which it links. If you provide any information to such third parties, different rules regarding the collection and use of your personal information may apply. You should contact these entities directly if you have any questions about their use of the information that they collect.",
  },
  {
    title: "8. Contact",
    body: "If you have any questions or concerns about this Privacy Policy, or want to access, correct, or delete your data, please get in touch and we will respond.",
  },
];

const AR: Section[] = [
  {
    title: "١. المعلومات التي نجمعها",
    body: "لإنشاء حسابك وحجز المباريات، نجمع اسمك ورقم جوالك وبريدك الإلكتروني. وإذا اخترت إضافة صورة شخصية فإننا نحتفظ بها. وعند حجز مباراة نسجّل تفاصيل الحجز وطريقة الدفع التي اخترتها (نقداً في الملعب أو عبر STC Pay) — ولا نجمع أرقام البطاقات أو نخزّنها، إذ إن PlayOS لا تعالج حالياً مدفوعات البطاقات مباشرة. وإذا فعّلت تذكيرات المباريات فإننا نحتفظ برمز الإشعارات الخاص بجهازك لتنبيهك قبل انطلاق المباراة. وإذا سمحت بذلك، نستخدم موقع جهازك أثناء استخدام التطبيق فقط لترتيب الملاعب حسب قربها منك — ولا نخزّن موقعك. كما نجمع بيانات استخدام أساسية (الصفحات التي تُزار والتفاعلات داخل التطبيق) لفهم كيفية استخدام PlayOS وتحسينها.",
  },
  {
    title: "٢. لا نبيع بياناتك",
    body: "نحن لا نبيع معلوماتك الشخصية — الاسم أو رقم الجوال أو البريد الإلكتروني أو سجل الحجوزات أو تفاصيل الدفع — ولا نؤجّرها ولا نتاجر بها مع أي طرف ثالث، لأغراض إعلانية أو غيرها. وتُستخدم بياناتك فقط لتشغيل PlayOS: لتأكيد الحجوزات والتواصل معك بشأن مبارياتك وإرسال التذكيرات التي اخترت تلقّيها.",
  },
  {
    title: "٣. المدفوعات",
    body: "لا تعالج PlayOS حالياً مدفوعات البطاقات. وتُسدَّد الحجوزات نقداً في الملعب أو عبر STC Pay، ويؤكدها المشغّل مباشرة — ولا تمر بيانات بطاقتك عبر أنظمة PlayOS.",
  },
  {
    title: "٤. من يعالج بياناتك",
    body: "نستعين بعدد محدود من مزودي الخدمة لتشغيل PlayOS: Supabase (قاعدة البيانات والمصادقة وتخزين الملفات)، وPostHog (تحليلات الاستخدام)، وExpo (إرسال الإشعارات). ويعالج هؤلاء المزودون البيانات نيابةً عنا ولا يُسمح لهم باستخدامها لأغراضهم الخاصة. ويشغّل بعضهم خوادم خارج المملكة العربية السعودية، ما يعني أن بياناتك الشخصية قد تُخزَّن أو تُعالَج خارج المملكة وفق ضمانات تعاقدية.",
  },
  {
    title: "٥. أمن البيانات",
    body: "نحافظ على أمان بياناتك باستخدام تدابير معيارية: اتصالات مشفّرة (HTTPS) لجميع البيانات، وسياسات وصول على مستوى قاعدة البيانات بحيث لا يطّلع على بيانات حجزك سواك والمشغّل، وعدم تخزين أي بيانات بطاقات على الإطلاق. ولا يمكن لأي نظام إلكتروني ضمان الأمان المطلق، لكننا نتخذ خطوات معقولة ومستمرة لحماية معلوماتك.",
  },
  {
    title: "٦. حقوقك بموجب نظام حماية البيانات الشخصية",
    body: "بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية، يحق لك معرفة البيانات الشخصية التي نحتفظ بها عنك، وطلب نسخة منها، وطلب تصحيح البيانات غير الدقيقة، وسحب موافقتك، وطلب حذف حسابك والبيانات المرتبطة به. ويمكنك حذف حسابك بنفسك في أي وقت من الإعدادات داخل تطبيق PlayOS. ولممارسة أي حق آخر، أو لتقديم شكوى بشأن طريقة تعاملنا مع بياناتك، يُرجى التواصل معنا.",
  },
  {
    title: "٧. روابط الجهات الخارجية",
    body: "PlayOS غير مسؤولة عن سياسات الخصوصية للمواقع التي ترتبط بها. وإذا قدّمت أي معلومات لتلك الجهات فقد تنطبق قواعد مختلفة على جمع معلوماتك الشخصية واستخدامها. ويُنصح بالتواصل معها مباشرة لأي استفسار حول استخدامها للمعلومات التي تجمعها.",
  },
  {
    title: "٨. التواصل",
    body: "إذا كان لديك أي استفسار أو ملاحظة بشأن سياسة الخصوصية هذه، أو رغبت في الاطلاع على بياناتك أو تصحيحها أو حذفها، يُرجى التواصل معنا وسنقوم بالرد عليك.",
  },
];

export default function Privacy() {
  const { language } = useI18n();
  const ar = language === "ar";
  const sections = ar ? AR : EN;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {ar ? "آخر تحديث: أغسطس ٢٠٢٦" : "Last updated: August 2026"}
      </p>
      <p className="text-sm text-[#3A3A3C] leading-relaxed mb-8">
        {ar
          ? "تلتزم PlayOS (\"نحن\") بحماية خصوصيتك وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية. توضح هذه السياسة ما نجمعه من معلومات شخصية، وكيف نستخدمها ونحميها، وحقوقك تجاهها. باختصار: لا نبيع بياناتك، ونحافظ على أمانها."
          : "PlayOS (\"we\", \"us\", \"our\") is committed to protecting your privacy in accordance with the Saudi Personal Data Protection Law (PDPL). This Privacy Policy explains what personal information we collect, how we use and safeguard it, and your rights over it. In short: we don't sell your data, and we keep it safe."}
      </p>

      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-base font-semibold text-[#1C1C1E] mb-2">{s.title}</h2>
            <p className="text-sm text-[#3A3A3C] leading-relaxed whitespace-pre-line">{s.body}</p>
            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
