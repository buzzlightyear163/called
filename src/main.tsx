import { Buffer } from "buffer";
(window as any).Buffer = (window as any).Buffer || Buffer;

import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "./styles.css";
import { SiteProvider } from "./lib/site";
import { Footer, Header, Tape } from "./components/Chrome";
import Home from "./pages/Home";

const Launch = lazy(() => import("./pages/Launch"));
const Explore = lazy(() => import("./pages/Explore"));
const CoinPage = lazy(() => import("./pages/Coin"));
const Callers = lazy(() => import("./pages/Callers"));
const CallDesk = lazy(() => import("./pages/CallDesk"));
const CallerPage = lazy(() => import("./pages/CallerPage"));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage"));
const Docs = lazy(() => import("./pages/Docs"));
const Setup = lazy(() => import("./pages/Setup"));

const TITLES: Record<string, string> = {
  "/": "CALLED · Callers get paid when you do",
  "/launch": "Launch a coin · CALLED",
  "/live": "Explore · CALLED",
  "/callers": "Leaderboard · CALLED",
  "/call": "Make a call · CALLED",
  "/docs": "Docs · CALLED",
  "/setup": "Setup · CALLED",
};

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    else {
      const el = document.getElementById(hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
    if (!/^\/(c|r|caller)\//.test(pathname)) document.title = TITLES[pathname] ?? "CALLED";
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <ScrollTop />
        <Header />
        <Tape />
        <Suspense fallback={<main className="page-loading" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/launch" element={<Launch />} />
            <Route path="/live" element={<Explore />} />
            <Route path="/c/:mint" element={<CoinPage />} />
            <Route path="/callers" element={<Callers />} />
            <Route path="/call" element={<CallDesk />} />
            <Route path="/caller/:wallet" element={<CallerPage />} />
            <Route path="/r/:id" element={<ReceiptPage />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
        <Footer />
      </SiteProvider>
    </BrowserRouter>
  </StrictMode>,
);
