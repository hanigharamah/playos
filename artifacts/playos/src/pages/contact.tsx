import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Building2 } from "lucide-react";

export default function Contact() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-8">
        Reach out to the PlayOS team — we're here to help.
      </p>

      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Company</div>
              <p className="text-muted-foreground">E-vision technology services</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Email</div>
              <a href="mailto:hani.gharamah@evision-corp.org" className="text-muted-foreground hover:text-primary transition-colors">
                hani.gharamah@evision-corp.org
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full shrink-0">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Phone</div>
              <a href="tel:+966534478561" className="text-muted-foreground hover:text-primary transition-colors">
                +966 534478561
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-3 bg-primary/10 rounded-full shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Address</div>
              <p className="text-muted-foreground">
                King Faisal Ibn Abdulaziz Saud<br />
                Riyadh, Saudi Arabia<br />
                P.O. Box 12631
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
