import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

const getQuickReplies = (language: string) => {
  if (language === "ar") {
    return [
      "كيف أبدأ التحدي؟",
      "ما هي الأسعار؟",
      "ما هي قواعد السحب؟",
    ];
  }
  if (language === "en") {
    return ["How do I start?", "What are the prices?", "What are the rules?"];
  }
  return ["Comment demarrer ?", "Quels sont les tarifs ?", "Quelles sont les regles ?"];
};

const getGreeting = (language: string) => {
  if (language === "ar") {
    return "مرحبا! كيف يمكنني مساعدتك اليوم؟";
  }
  if (language === "en") {
    return "Hi! How can I help you today?";
  }
  return "Bonjour ! Comment puis-je vous aider aujourd'hui ?";
};

const ChatWidget = () => {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: getGreeting(language) },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: getGreeting(language) }]);
  }, [language]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, [isOpen, messages]);

  const quickReplies = useMemo(() => getQuickReplies(language), [language]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const chatBaseUrl = import.meta.env.VITE_CHAT_API_BASE_URL || API_BASE_URL;
      const response = await fetch(`${chatBaseUrl}/chat/gemini`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          language,
        }),
      });
      if (!response.ok) {
        throw new Error("chat_failed");
      }
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "" },
      ]);
    } catch (err) {
      setError(t("chat_error"));
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const direction = language === "ar" ? "rtl" : "ltr";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-26px_rgba(34,211,238,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        aria-label={isOpen ? t("chat_close") : t("chat_open")}
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.35),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 text-slate-900 shadow-[0_10px_25px_-12px_rgba(34,211,238,0.9)]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <span className="sr-only">{t("chat_title")}</span>
      </button>

      {isOpen && (
        <div
          className="mt-4 w-[320px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-[0_30px_70px_-36px_rgba(15,23,42,0.9)] backdrop-blur-2xl sm:w-[360px]"
          dir={direction}
        >
          <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div className="relative z-10 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 text-slate-900 shadow-[0_10px_22px_-12px_rgba(34,211,238,0.9)]">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t("chat_title")}</p>
                <p className="text-xs text-slate-300">{t("chat_subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="relative z-10 rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:text-white"
              aria-label={t("chat_close")}
            >
              <X className="h-4 w-4" />
            </button>
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_65%)]" />
          </div>

          <div
            ref={listRef}
            className="flex max-h-[320px] flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 text-slate-900 shadow-[0_10px_22px_-14px_rgba(34,211,238,0.6)]"
                      : "bg-white/5 text-slate-100"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/5 px-4 py-2 text-sm text-slate-300">
                  {t("chat_thinking")}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => void sendMessage(reply)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 transition-colors hover:text-white"
              >
                {reply}
              </button>
            ))}
          </div>

          {error && (
            <div className="px-4 pb-2 text-xs text-destructive">{error}</div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("chat_placeholder")}
              className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400"
            />
            <Button type="submit" size="icon" variant="hero" disabled={isSending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
