import React, { ReactNode, useEffect, useState } from "react";
import Portal from "./Portal.web";
import { isPortalPreviewPath } from "./previewPolicy";
import LandingPage from "./LandingPage.web";
import SuperAdmin from "./SuperAdmin.web";

export default function PortalGate({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const change = () => setPath(window.location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);

  if (/^\/(super-admin)(\/|$)/.test(path)) {
    return <SuperAdmin />;
  }

  if (/^\/(admin|staff)(\/|$)/.test(path)) {
    if (isPortalPreviewPath(path) && !__DEV__) {
      return <main><h1>Preview unavailable</h1><p>The sample preview is available in development builds.</p><a href="/admin/login">Sign in to your workspace</a></main>;
    }
    return <Portal key={`${path.startsWith("/staff") ? "staff" : "admin"}:${isPortalPreviewPath(path) ? "preview" : "live"}`} />;
  }

  if (/^\/(app|parent)(\/|$)/.test(path)) {
    return <>{children}</>;
  }

  // Root or any landing path shows the public SaaS Landing Page
  return <LandingPage />;
}
