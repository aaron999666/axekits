import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const country = request.headers.get("cf-ipcountry") || "ZZ";
  const region = request.headers.get("cf-region-code") || "";
  const city = request.headers.get("cf-ipcity") || "";

  response.headers.set("x-geo-country", country);
  response.headers.set("x-geo-region", region);
  response.headers.set("x-geo-city", city);
  response.headers.set("Vary", "cf-ipcountry, cf-region-code, cf-ipcity");
  response.cookies.set("tb_geo_country", country, {
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src 'self' https:; connect-src 'self' https:; object-src 'none'; base-uri 'self';"
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
