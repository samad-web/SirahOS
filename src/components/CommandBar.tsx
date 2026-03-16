import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

export function CommandBar() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", bounce: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
    >
      <div
        className={`flex items-center gap-3 surface-raised rounded-xl px-4 py-3 ledge-transition ${
          focused ? "ring-1 ring-primary/50" : ""
        }`}
      >
        <Sparkles size={16} strokeWidth={1.5} className="text-primary flex-shrink-0" />
        <input
          type="text"
          placeholder='Try "Invoice ₹5000 to Sharma Electronics"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {input && (
          <button className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center active-press ledge-transition">
            <ArrowUp size={14} strokeWidth={2} className="text-primary-foreground" />
          </button>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        ⌘K to focus · AI-powered actions
      </p>
    </motion.div>
  );
}
