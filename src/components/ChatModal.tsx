
import React, { useState, useEffect, useRef } from 'react';
import type { BookInsight } from '../types';
import { X, Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { createBookChatSession } from '../services/geminiService';
import { Chat, GenerateContentResponse } from "@google/genai";

interface ChatModalProps {
  book: BookInsight;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({ book, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Hi! I'm here to help you get the most out of "${book.title}". Ask me anything about the key insights or how to apply them!` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSession = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSession.current = createBookChatSession(book);
  }, [book]);

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
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Create a placeholder for the model response
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      const result = await chatSession.current.sendMessageStream({ message: userMsg.text });
      
      let fullText = '';
      
      for await (const chunk of result) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) {
          fullText += text;
          setMessages(prev => {
            const newArr = [...prev];
            const lastMsg = newArr[newArr.length - 1];
            if (lastMsg.role === 'model') {
              lastMsg.text = fullText;
            }
            return newArr;
          });
        }
      }
    } catch (err) {
      console.error("Chat error", err);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I'm having trouble connecting right now. Please try again." }]);
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
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Book Assistant</h3>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">{book.title}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-orange-600 text-white'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
              </div>
              <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-white border border-gray-200 text-gray-800 rounded-tr-none shadow-sm' 
                  : 'bg-orange-600 text-white rounded-tl-none shadow-md'
              }`}>
                {msg.text || (isLoading && idx === messages.length - 1 ? <Loader2 className="animate-spin w-4 h-4" /> : '')}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-gray-100 text-gray-900 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all placeholder:text-gray-400"
              autoFocus
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 bg-white rounded-lg text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-50 transition-colors"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
