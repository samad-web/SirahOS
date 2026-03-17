import { useState } from "react";
import { Sparkles, ArrowUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CommandBar() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4, type: "spring", bounce: 0.1 }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
    >
      <div
        className={`flex items-center gap-3 surface-glass px-4 py-3 shadow-lg transition-all duration-300 ${
          focused ? "shadow-xl ring-2 ring-primary/20 border-primary/30" : ""
        }`}
      >
        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} strokeWidth={2} className="text-white" />
        </div>
        <input
          type="text"
          placeholder='Try "Invoice ₹5000 to Sharma"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        <AnimatePresence>
          {input && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center transition-transform active:scale-95"
            >
              <ArrowUp size={14} strokeWidth={2.5} className="text-white" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
