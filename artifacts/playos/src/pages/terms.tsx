import { Separator } from "@/components/ui/separator";

const sections = [
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
    body: "The cardholder must retain a copy of transaction records and Merchant policies and rules.",
  },
  {
    title: "6. Account Security",
    body: "The User is responsible for maintaining the confidentiality of his or her account.",
  },
  {
    title: "7. Changes to Terms",
    body: "The Website Policies and Terms & Conditions may be changed or updated occasionally to meet the requirements and standards. Therefore, Customers are encouraged to frequently visit these sections in order to be updated about the changes on the website. Modifications will be effective on the day they are posted.",
  },
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>

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
