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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Globe, Menu, X, LogOut, LayoutDashboard, Gamepad2 } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isArabic = language === "ar";
  const getPath = (path: string) => (isArabic ? `/ar${path}` : path);

  const NavLinks = () => (
    <>
      <Link
        href={getPath("/games")}
        className="text-sm font-medium text-[#6C6C70] hover:text-[#1C1C1E] transition-colors"
      >
        {t("nav.games")}
      </Link>
      {user?.role === "player" && (
        <Link
          href={getPath("/my-games")}
          className="text-sm font-medium text-[#6C6C70] hover:text-[#1C1C1E] transition-colors"
        >
          My Games
        </Link>
      )}
      {user?.role === "organiser" && (
        <Link
          href={getPath("/dashboard")}
          className="text-sm font-medium text-[#6C6C70] hover:text-[#1C1C1E] transition-colors"
        >
          {t("nav.dashboard")}
        </Link>
      )}
      {!user && (
        <Link
          href={getPath("/host/login")}
          className="text-sm font-medium text-[#6C6C70] hover:text-[#1C1C1E] transition-colors"
        >
          {t("nav.host")}
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E5EA] bg-white/90 backdrop-blur-md">
      <div className="mx-auto px-4 flex h-14 items-center justify-between max-w-5xl">
        {/* Logo */}
        <div className="flex items-center gap-7">
          <Link href={getPath("/")} className="flex items-center">
            <span
              className="text-xl font-extrabold uppercase select-none"
              style={{ color: "#1D3557", letterSpacing: "-0.03em" }}
            >
              PLAY
            </span>
            <span
              className="text-xl font-extrabold uppercase select-none"
              style={{ color: "#0A84FF", letterSpacing: "-0.03em" }}
            >
              OS
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-xs font-semibold text-[#6C6C70] hover:text-[#1C1C1E] transition-colors px-2 py-1 rounded-md hover:bg-[#F2F2F7]"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="uppercase">{language === "en" ? "EN" : "AR"}</span>
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className="text-xs font-bold text-white"
                      style={{ background: "#0A84FF" }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold leading-none text-[#1C1C1E]">{user.name}</p>
                  <p className="text-xs leading-none text-[#6C6C70] mt-1">
                    {user.email || user.phone}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "player" && (
                  <DropdownMenuItem asChild>
                    <Link href={getPath("/my-games")} className="cursor-pointer w-full flex items-center">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      <span>My Games</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "organiser" && (
                  <DropdownMenuItem asChild>
                    <Link href={getPath("/dashboard")} className="cursor-pointer w-full flex items-center">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>{t("nav.dashboard")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-[#FF3B30] cursor-pointer focus:text-[#FF3B30]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href={getPath("/auth")} className="hidden md:block">
              <button
                className="text-sm font-semibold px-4 py-1.5 rounded-[10px] transition-all hover:-translate-y-px"
                style={{
                  background: "#0A84FF",
                  color: "#fff",
                  boxShadow: "0 4px 12px rgba(10,132,255,0.25)",
                }}
              >
                {t("nav.login")}
              </button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#E5E5EA] px-4 py-4 bg-white">
          <nav className="flex flex-col gap-4">
            <NavLinks />
            {!user && (
              <Link href={getPath("/auth")} onClick={() => setIsMobileMenuOpen(false)}>
                <button
                  className="w-full text-sm font-semibold px-4 py-2.5 rounded-[10px]"
                  style={{ background: "#0A84FF", color: "#fff" }}
                >
                  {t("nav.login")}
                </button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
