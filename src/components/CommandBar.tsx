import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";

export function CommandBar() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div
        className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 shadow-lg transition-shadow ${
          focused ? "shadow-xl ring-1 ring-primary/20" : ""
        }`}
      >
        <Sparkles size={15} strokeWidth={1.5} className="text-primary flex-shrink-0" />
        <input
          type="text"
          placeholder='Try "Invoice ₹5000 to Sharma"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {input && (
          <button className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center transition-transform active:scale-95">
            <ArrowUp size={13} strokeWidth={2} className="text-primary-foreground" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
