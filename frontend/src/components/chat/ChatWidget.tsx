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
      const response = await fetch(`${API_BASE_URL}/chat/gemini`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
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
        className="group relative flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-3 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.6)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-primary/40"
        aria-label={isOpen ? t("chat_close") : t("chat_open")}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-400 text-white shadow-lg shadow-primary/30">
          <MessageCircle className="h-5 w-5" />
        </span>
        <span className="hidden text-sm font-semibold text-foreground sm:inline">
          {t("chat_title")}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("chat_subtitle")}
        </span>
      </button>

      {isOpen && (
        <div
          className="mt-4 w-[320px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-[0_26px_60px_-34px_rgba(15,23,42,0.7)] backdrop-blur-2xl sm:w-[360px]"
          dir={direction}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{t("chat_title")}</p>
              <p className="text-xs text-muted-foreground">{t("chat_subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("chat_close")}
            >
              <X className="h-4 w-4" />
            </button>
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
                      ? "bg-primary text-white shadow-primary/20"
                      : "bg-background/80 text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-background/80 px-4 py-2 text-sm text-muted-foreground">
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
                className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {reply}
              </button>
            ))}
          </div>

          {error && (
            <div className="px-4 pb-2 text-xs text-destructive">{error}</div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("chat_placeholder")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
