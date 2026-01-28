import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface MobileMenuProps {
  currentPath: string;
}

export default function MobileMenu({ currentPath }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "home" },
    { href: "/mixes", label: "mixes" },
    { href: "/about", label: "about" },
    { href: "/tools", label: "tools" },
    { href: "/support", label: "support" },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="md:hidden p-2 hover:opacity-70 transition-opacity"
          aria-label="Open menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent>
        <div className="flex flex-col gap-6 mt-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-lg hover:opacity-70 transition-opacity ${
                currentPath === link.href ? "opacity-50" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

