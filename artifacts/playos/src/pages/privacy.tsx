import { Separator } from "@/components/ui/separator";

const sections = [
  {
    title: "1. Information We Collect",
    body: "To create your account and book games, we collect your name, phone number, and email address. When you book a game, we record the booking details and which payment method you chose (cash at the pitch, or STC Pay) — we do not collect or store card numbers, since PlayOS never processes card payments directly. If you enable match reminders, we store a device push subscription so we can notify you before kickoff. We also collect basic usage data (pages visited, app interactions) to understand how PlayOS is used and improve it.",
  },
  {
    title: "2. We Do Not Sell Your Data",
    body: "We do not sell, rent, lease, or trade your personal information — name, phone number, email, booking history, or payment details — to any third party, for advertising or any other purpose. Your data is used only to operate PlayOS: to confirm bookings, contact you about your games, and send reminders you've opted into.",
  },
  {
    title: "3. Secure Payments",
    body: "PlayOS does not process card payments. Bookings are settled via cash at the pitch or STC Pay, confirmed directly by the operator — your card details never pass through PlayOS's systems.",
  },
  {
    title: "4. Data Security",
    body: "We keep your data safe using industry-standard measures: encrypted connections (HTTPS) for all traffic, access-controlled database policies so only you and the relevant pitch operator can see your booking data, and no card data storage of any kind. No online system can guarantee absolute security, but we take reasonable, ongoing steps to protect your information.",
  },
  {
    title: "5. Your Rights Under Saudi Law (PDPL)",
    body: "Under the Saudi Personal Data Protection Law (PDPL), you have the right to know what personal data we hold about you, request a copy of it, ask us to correct inaccurate data, and request that we delete your account and associated data. To exercise any of these rights, contact us using the details below.",
  },
  {
    title: "6. Third-Party Links",
    body: "PlayOS is not responsible for the privacy policies of websites to which it links. If you provide any information to such third parties, different rules regarding the collection and use of your personal information may apply. You should contact these entities directly if you have any questions about their use of the information that they collect.",
  },
  {
    title: "7. Contact",
    body: "If you have any questions or concerns about this Privacy Policy, or want to access, correct, or delete your data, please contact us at hani.gharamah@evision-corp.org.",
  },
];

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-4">Last updated: July 2026</p>
      <p className="text-sm text-[#3A3A3C] leading-relaxed mb-8">
        PlayOS ("we", "us", "our") is committed to protecting your privacy in accordance with the Saudi Personal Data Protection Law (PDPL). This Privacy Policy explains what personal information we collect, how we use and safeguard it, and your rights over it. In short: we don't sell your data, and we keep it safe.
      </p>

      <div className="space-y-6">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-base font-semibold text-[#1C1C1E] mb-2">{s.title}</h2>
            <p className="text-sm text-[#3A3A3C] leading-relaxed">{s.body}</p>
            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
