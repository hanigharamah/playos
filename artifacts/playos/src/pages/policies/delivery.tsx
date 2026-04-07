import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sections = [
  {
    title: "Service Description",
    body: "PlayOS provides an online platform for booking spots in pickup football games. Upon successful payment, your spot in the selected game is immediately reserved.",
  },
  {
    title: "Booking Confirmation",
    body: "Upon successful payment, you will receive an on-screen confirmation displaying your booking details including the game name, date, time, pitch, team assignment, and amount paid.",
  },
  {
    title: "Service Access",
    body: "Your booked game spot is accessible immediately after payment confirmation through your PlayOS account. You can view your booking on the game page at any time before the game.",
  },
  {
    title: "No Physical Delivery",
    body: "PlayOS is a digital service platform. There are no physical goods to ship or deliver. The service is the reservation of a spot in a football game at the specified pitch location.",
  },
  {
    title: "OFAC Compliance",
    body: "playos.vercel.app will NOT deal or provide any services or products to any of OFAC (Office of Foreign Assets Control) sanctions countries in accordance with the law of the Kingdom of Saudi Arabia.",
  },
  {
    title: "Multiple Transactions",
    body: "Multiple transactions may result in multiple postings to the cardholder's monthly statement.",
  },
];

export default function DeliveryPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Service Delivery Policy</h1>
      <p className="text-muted-foreground mb-8 text-sm">Last updated: April 2026</p>

      <div className="space-y-4">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <p className="text-sm text-muted-foreground">
        Questions? Contact us at{" "}
        <a href="mailto:hani.gharamah@evision-corp.org" className="text-primary hover:underline">
          hani.gharamah@evision-corp.org
        </a>
        .
      </p>
    </div>
  );
}
