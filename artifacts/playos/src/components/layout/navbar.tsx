import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Globe, Menu, X, LogOut, LayoutDashboard, User } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const isArabic = language === "ar";
  const getPath = (path: string) => (isArabic ? `/ar${path}` : path);

  const NavLinks = () => (
    <>
      <Link href={getPath("/games")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        {t("nav.games")}
      </Link>
      {user?.role === "organiser" && (
        <Link href={getPath("/dashboard")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t("nav.dashboard")}
        </Link>
      )}
      {!user && (
        <Link href={getPath("/host/login")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t("nav.host")}
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={getPath("/")} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold italic tracking-tighter">P</span>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">PlayOS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleLanguage} aria-label="Toggle language">
            <Globe className="h-4 w-4" />
            <span className="sr-only">Toggle Language</span>
          </Button>
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline-block uppercase">
            {language === "en" ? "EN" : "AR"}
          </span>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email || user.phone}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "organiser" && (
                  <DropdownMenuItem asChild>
                    <Link href={getPath("/dashboard")} className="cursor-pointer w-full flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>{t("nav.dashboard")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => logout()} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href={getPath("/auth")}>
                <Button variant="ghost">{t("nav.login")}</Button>
              </Link>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t p-4 bg-background">
          <nav className="flex flex-col gap-4">
            <NavLinks />
            {!user && (
              <Link href={getPath("/auth")} onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full">{t("nav.login")}</Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
