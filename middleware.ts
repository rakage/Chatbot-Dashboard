import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can be added here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without token
        if (req.nextUrl.pathname.startsWith("/auth/")) {
          return true;
        }

        // Allow access to API auth routes
        if (req.nextUrl.pathname.startsWith("/api/auth/")) {
          return true;
        }

        // Allow access to webhook routes (they have their own auth)
        if (req.nextUrl.pathname.startsWith("/api/webhook/")) {
          return true;
        }

        // Allow access to home page
        if (req.nextUrl.pathname === "/") {
          return true;
        }

        // Require authentication for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
