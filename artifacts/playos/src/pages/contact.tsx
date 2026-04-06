import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MessageCircle } from "lucide-react";

export default function Contact() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <p className="text-muted-foreground mb-8">
        Have a question, issue, or feedback? Reach out to the PlayOS team. We're here to help.
      </p>
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Email</div>
              <a href="mailto:support@playos.sa" className="text-muted-foreground hover:text-primary transition-colors">
                support@playos.sa
              </a>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Phone / WhatsApp</div>
              <a href="tel:+966500000000" className="text-muted-foreground hover:text-primary transition-colors">
                +966 50 000 0000
              </a>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Response Time</div>
              <p className="text-muted-foreground text-sm">We respond within 24 hours on business days.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
