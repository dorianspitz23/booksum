import React, { useId, useState, useEffect, useRef } from 'react';
import { useFocusTrap } from './ui/useFocusTrap';
import type { Book, Summary } from '../types';
import { X, Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { createBookChatSession, sendMessageStream } from '../lib/ai/chat';
import type { Chat } from '../lib/ai/chat';
import { reportAiError } from '../features/settings/keyDialog';

interface ChatModalProps {
  book: Book;
  summary: Summary;
  onClose: () => void;
  /** Surfaces an AI failure and opens the key dialog when the key is the problem. */
  onAiError: (error: unknown) => string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  /** Set when the stream failed, so the bubble can say so rather than look complete. */
  failed?: boolean;
}

export const ChatModal: React.FC<ChatModalProps> = ({ book, summary, onClose, onAiError }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `Hi! I'm here to help you get the most out of "${book.title}". Ask me anything about the key insights or how to apply them!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const chatSession = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(panelRef, { active: true, onClose });

  // Read through a ref so the effect below can key on ids without eslint
  // demanding the objects themselves as dependencies.
  const contextRef = useRef({ book, summary });
  contextRef.current = { book, summary };

  useEffect(() => {
    // createBookChatSession is the only synchronous AI entry point, so an
    // unhandled throw here escapes to the route error boundary and takes the
    // whole app down. The commonest cause is simply having no key stored.
    try {
      const { book: currentBook, summary: currentSummary } = contextRef.current;
      chatSession.current = createBookChatSession(currentBook, currentSummary);
      setStartupError(null);
    } catch (error) {
      chatSession.current = null;
      setStartupError(onAiError(error));
    }
    // Keyed on the identity of the *content*, not of the objects. Depending on
    // `[book, summary]` rebuilt the session — discarding the conversation the
    // user was in the middle of — every time an unrelated library write handed
    // this component a freshly deserialised Summary.
  }, [book.id, summary.id, summary.generatedAt, onAiError]);

  /**
   * False from the moment this unmounts, so an in-flight stream stops writing.
   * The SDK's stream is not abortable here, so the request itself finishes — but
   * its chunks no longer reach a component that is gone.
   */
  const isOpenRef = useRef(true);
  useEffect(() => {
    isOpenRef.current = true;
    return () => {
      isOpenRef.current = false;
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatSession.current || isLoading) return;

    const userMsg: Message = { role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Placeholder the reply streams into.
      setMessages((prev) => [...prev, { role: 'model', text: '' }]);

      await sendMessageStream(chatSession.current, userMsg.text, (textSoFar) => {
        // Dropped once the drawer is gone. The stream kept running after close
        // and every chunk called setState on an unmounted component — React
        // warns, and the work carried on being paid for with nothing to show it.
        if (!isOpenRef.current) return;
        setMessages((prev) =>
          prev.map((message, index) =>
            index === prev.length - 1 && message.role === 'model'
              ? { ...message, text: textSoFar }
              : message,
          ),
        );
      });
    } catch (err) {
      const message = reportAiError(err);
      setMessages((prev) =>
        prev.map((entry, index) => {
          if (index !== prev.length - 1 || entry.role !== 'model') return entry;
          // A stream that failed *after* emitting text left a reply cut off
          // mid-sentence with no indication anything had gone wrong — this only
          // replaced the placeholder when it was still empty. A truncated answer
          // that looks complete is worse than an error, because the user acts
          // on it.
          return entry.text
            ? { ...entry, text: `${entry.text}\n\n_${message}_`, failed: true }
            : { ...entry, text: message, failed: true };
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Chat Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-950 rounded-full flex items-center justify-center text-orange-700 dark:text-orange-400">
              <Bot size={20} />
            </div>
            <div>
              <h3 id={titleId} className="font-bold text-gray-900 dark:text-gray-100 leading-tight">
                Book Assistant
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {book.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    : 'bg-orange-600 text-white'
                }`}
              >
                {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tr-none shadow-sm'
                    : 'bg-orange-600 text-white rounded-tl-none shadow-md'
                }`}
              >
                {msg.text ||
                  (isLoading && idx === messages.length - 1 ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                  ) : (
                    ''
                  ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          {startupError && (
            <p
              role="alert"
              className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm rounded-xl border border-red-100 dark:border-red-900"
            >
              {startupError}
            </p>
          )}
          <form
            onSubmit={(event) => void handleSend(event)}
            className="relative flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={startupError ? 'Chat unavailable' : 'Ask a question...'}
              disabled={startupError !== null}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-60"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || startupError !== null}
              className="absolute right-2 p-2 bg-white dark:bg-gray-900 rounded-lg text-orange-700 dark:text-orange-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
