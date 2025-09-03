"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  LogOut,
  Building,
  GraduationCap,
  Link as LinkIcon,
  Brain,
  Play,
} from "lucide-react";

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER", "ADMIN", "AGENT"],
  },
  {
    name: "Conversations",
    href: "/dashboard/conversations",
    icon: MessageSquare,
    roles: ["OWNER", "ADMIN", "AGENT"],
  },
  {
    name: "Integrations",
    href: "/dashboard/integrations",
    icon: LinkIcon,
    roles: ["OWNER", "ADMIN"],
  },
  {
    name: "LLM Config",
    href: "/dashboard/llm-config",
    icon: Brain,
    roles: ["OWNER", "ADMIN"],
  },
  {
    name: "LLM Training",
    href: "/dashboard/training",
    icon: GraduationCap,
    roles: ["OWNER", "ADMIN"],
  },
  {
    name: "Playground",
    href: "/dashboard/playground",
    icon: Play,
    roles: ["OWNER", "ADMIN", "AGENT"],
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["OWNER", "ADMIN"],
  },
  {
    name: "Company",
    href: "/dashboard/company",
    icon: Building,
    roles: ["OWNER"],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["OWNER", "ADMIN", "AGENT"],
  },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const userRole = session?.user?.role;
  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(userRole as string)
  );

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center h-16 px-4 bg-gray-800">
        <h1 className="text-xl font-bold text-white">Bot Dashboard</h1>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${
                    isActive
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }
                `}
              >
                <item.icon
                  className={`
                    mr-3 h-5 w-5 flex-shrink-0
                    ${
                      isActive
                        ? "text-white"
                        : "text-gray-400 group-hover:text-white"
                    }
                  `}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {session?.user?.name?.charAt(0) ||
                    session?.user?.email?.charAt(0)}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-white">
                {session?.user?.name || session?.user?.email}
              </p>
              <p className="text-xs text-gray-400">{userRole?.toLowerCase()}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="ml-3 p-1 text-gray-400 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
