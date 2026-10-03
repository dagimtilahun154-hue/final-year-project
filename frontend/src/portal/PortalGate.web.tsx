import React, { ReactNode, useEffect, useState } from "react";
import Portal from "./Portal.web";
export default function PortalGate({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const change = () => setPath(window.location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  return /^\/(admin|staff)(\/|$)/.test(path) ? <Portal /> : <>{children}</>;
}
