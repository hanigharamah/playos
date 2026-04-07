import { Separator } from "@/components/ui/separator";

const sections = [
  {
    title: "1. Payment Data",
    body: "All credit/debit cards' details and personally identifiable information will NOT be stored, sold, shared, rented or leased to any third parties.",
  },
  {
    title: "2. Secure Payments",
    body: "If you make a payment for our products or services on our website, the details you are asked to submit will be provided directly to our payment provider via a secured connection.",
  },
  {
    title: "3. Card Information",
    body: "PlayOS will not pass any debit/credit card details to third parties.",
  },
  {
    title: "4. Data Security",
    body: "PlayOS takes appropriate steps to ensure data privacy and security including through various hardware and software methodologies. However, playos1.replit.app cannot guarantee the security of any information that is disclosed online.",
  },
  {
    title: "5. Third-Party Links",
    body: "PlayOS is not responsible for the privacy policies of websites to which it links. If you provide any information to such third parties, different rules regarding the collection and use of your personal information may apply. You should contact these entities directly if you have any questions about their use of the information that they collect.",
  },
  {
    title: "6. Third-Party Advertising",
    body: "Some of the advertisements you see on the Site are selected and delivered by third parties, such as ad networks, advertising agencies, advertisers, and audience segment providers. These third parties may collect information about you and your online activities, either on the Site or on other websites, through cookies, web beacons, and other technologies in an effort to understand your interests and deliver to you advertisements that are tailored to your interests. Please remember that PlayOS does not control what information third-party advertisers collect about you.",
  },
  {
    title: "7. Contact",
    body: "If you have any questions or concerns about this Privacy Policy, please contact us at hani.gharamah@evision-corp.org.",
  },
];

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-4">Last updated: April 2026</p>
      <p className="text-sm text-[#3A3A3C] leading-relaxed mb-8">
        PlayOS ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information.
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
