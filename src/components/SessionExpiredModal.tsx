import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, ShieldAlert } from "lucide-react";
import { SESSION_EXPIRED_EVENT } from "@/lib/api";

export function SessionExpiredModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (window.location.pathname !== "/login") {
        setShow(true);
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const handleLogin = () => {
    setShow(false);
    window.location.href = "/login";
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl text-center p-8"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={28} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Session Expired</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Your session has expired for security reasons. Please sign in again to continue where you left off.
            </p>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 gradient-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <LogIn size={15} /> Sign In Again
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
