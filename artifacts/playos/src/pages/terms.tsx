import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

/**
 * Terms & Conditions, in both languages.
 *
 * /ar/terms used to render this component with English content — the route
 * existed, the Arabic text did not. Consumer-facing terms in Saudi Arabia
 * should be readable in Arabic, and a page that promises one language and
 * serves another is worse than not offering it.
 *
 * Direction (rtl/ltr) is handled by I18nProvider, so nothing here sets it.
 */

type Section = { title: string; body: string };

const EN: Section[] = [
  {
    title: "1. General",
    body: "By accessing and using PlayOS, you agree to be bound by these Terms and Conditions.",
  },
  {
    title: "2. Governing Law",
    body: "Any dispute or claim arising out of or in connection with this website shall be governed and construed in accordance with the laws of the Kingdom of Saudi Arabia. The Kingdom of Saudi Arabia is our country of domicile and the governing law is the local law.",
  },
  {
    title: "3. Age Requirement",
    body: "Customers using the website who are minors or under the age of 18 shall not register as a User of the website and shall not transact on or use the website.",
  },
  {
    title: "4. Payment Methods",
    body: "Booking fees are paid in SAR (Saudi Riyal) via STC Pay or in cash at the pitch. STC Pay payments are confirmed by the operator once received.",
  },
  {
    title: "5. Transaction Records",
    body: "You should retain a copy of your booking confirmation and of these terms for your records.",
  },
  {
    title: "6. Account Security",
    body: "The User is responsible for maintaining the confidentiality of his or her account.",
  },
  {
    title: "7. Changes to Terms",
    body: "The Website Policies and Terms & Conditions may be changed or updated occasionally to meet the requirements and standards. Therefore, Customers are encouraged to frequently visit these sections in order to be updated about the changes on the website. Modifications will be effective on the day they are posted.",
  },
  {
    // The most consequential clause on this page, and the one that was absent.
    // Written to allocate risk honestly rather than to claim immunity: Saudi
    // law does not permit excluding liability for one's own gross negligence,
    // and a clause that tries to is likelier to be struck down entirely.
    title: "8. Assumption of Risk and Liability",
    body:
      "Football is a physical contact sport. By booking a game through PlayOS you acknowledge that participation carries an inherent risk of injury, including serious injury, and you accept that risk voluntarily.\n\n" +
      "You confirm that you are medically fit to play. PlayOS does not assess fitness, screen players, or provide medical supervision.\n\n" +
      "PlayOS is a booking platform. We do not own, operate, maintain or inspect the pitches listed on PlayOS. Responsibility for the condition and safety of a venue, its surface, its equipment and its facilities rests with the venue operator.\n\n" +
      "PlayOS is not liable for injury, illness, death, or loss of or damage to personal belongings arising from participation in a game, from the condition of a venue, or from the conduct of other players, except where such loss results from our own gross negligence or wilful misconduct, which cannot be excluded under the laws of the Kingdom of Saudi Arabia.\n\n" +
      "Where PlayOS is found liable, our total liability is limited to the booking fee you paid for the game in question.\n\n" +
      "You are responsible for arranging your own medical or accident insurance. PlayOS does not provide insurance cover for players.\n\n" +
      "If you are injured during a game booked through PlayOS, please report it to us as soon as reasonably possible.",
  },
];

const AR: Section[] = [
  {
    title: "١. عام",
    body: "باستخدامك منصة PlayOS فإنك توافق على الالتزام بهذه الشروط والأحكام.",
  },
  {
    title: "٢. القانون الواجب التطبيق",
    body: "تخضع أي منازعة أو مطالبة تنشأ عن هذا الموقع أو تتعلق به لأنظمة المملكة العربية السعودية وتُفسَّر وفقاً لها. المملكة العربية السعودية هي بلد المقر، والنظام الواجب التطبيق هو النظام المحلي.",
  },
  {
    title: "٣. السن المطلوب",
    body: "لا يجوز لمن هم دون سن الثامنة عشرة التسجيل كمستخدمين في الموقع أو إجراء أي معاملات عليه.",
  },
  {
    title: "٤. طرق الدفع",
    body: "تُدفع رسوم الحجز بالريال السعودي عبر STC Pay أو نقداً في الملعب. تُؤكَّد مدفوعات STC Pay من قِبل المشغِّل عند استلامها.",
  },
  {
    title: "٥. سجلات المعاملات",
    body: "يُنصح بالاحتفاظ بنسخة من تأكيد الحجز ومن هذه الشروط للرجوع إليها عند الحاجة.",
  },
  {
    title: "٦. أمان الحساب",
    body: "يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات حسابه.",
  },
  {
    title: "٧. التعديلات على الشروط",
    body: "قد تُعدَّل سياسات الموقع وشروطه وأحكامه من وقت لآخر بما يتوافق مع المتطلبات والمعايير. لذا يُنصح العملاء بمراجعة هذه الصفحات بانتظام للاطلاع على التحديثات. وتسري التعديلات من تاريخ نشرها.",
  },
  {
    title: "٨. قبول المخاطر والمسؤولية",
    body:
      "كرة القدم رياضة احتكاكية بدنية. بحجزك مباراة عبر PlayOS فإنك تقر بأن المشاركة تنطوي على مخاطر إصابة متأصلة، بما في ذلك الإصابات البالغة، وتقبل هذه المخاطر طوعاً.\n\n" +
      "تقر بأنك لائق طبياً للعب. لا تقوم PlayOS بتقييم اللياقة البدنية أو فحص اللاعبين أو توفير إشراف طبي.\n\n" +
      "PlayOS منصة حجز فقط. نحن لا نملك الملاعب المدرجة على المنصة ولا نشغّلها ولا نصونها ولا نفحصها. وتقع مسؤولية حالة الملعب وسلامته وأرضيته ومعداته ومرافقه على عاتق مشغّل الملعب.\n\n" +
      "لا تتحمل PlayOS المسؤولية عن أي إصابة أو مرض أو وفاة أو فقدان أو تلف للممتلكات الشخصية ناتج عن المشاركة في مباراة، أو عن حالة الملعب، أو عن تصرفات اللاعبين الآخرين، باستثناء ما ينتج عن إهمالنا الجسيم أو سوء تصرفنا المتعمد، وهو ما لا يجوز استبعاده بموجب أنظمة المملكة العربية السعودية.\n\n" +
      "وفي حال ثبوت مسؤولية PlayOS، تكون مسؤوليتنا الإجمالية محدودة بقيمة رسوم الحجز المدفوعة عن المباراة المعنية.\n\n" +
      "تقع على عاتقك مسؤولية ترتيب تأمينك الطبي أو تأمين الحوادث الخاص بك. ولا توفر PlayOS تغطية تأمينية للاعبين.\n\n" +
      "في حال تعرضك لإصابة خلال مباراة محجوزة عبر PlayOS، يُرجى إبلاغنا في أقرب وقت ممكن.",
  },
];

export default function Terms() {
  const { language } = useI18n();
  const ar = language === "ar";
  const sections = ar ? AR : EN;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">{ar ? "الشروط والأحكام" : "Terms & Conditions"}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {ar ? "آخر تحديث: أغسطس ٢٠٢٦" : "Last updated: August 2026"}
      </p>

      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-base font-semibold text-[#1C1C1E] mb-2">{s.title}</h2>
            {/* whitespace-pre-line so the multi-paragraph liability clause
                keeps its breaks instead of collapsing into one block. */}
            <p className="text-sm text-[#3A3A3C] leading-relaxed whitespace-pre-line">{s.body}</p>
            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
