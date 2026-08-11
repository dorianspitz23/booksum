
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ArrowRight, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, signup, isLoading, error, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      await login(email, password);
    } else {
      await signup(name, email, password);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fcfcf9]">
      {/* Left: Branding & Value Prop */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-orange-50/50 -z-10" />
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-serif font-bold italic shadow-lg shadow-orange-100">
              B
            </div>
            <span className="text-2xl font-serif font-bold text-gray-900 tracking-tighter">BookSum</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 mb-8 leading-[1.1]">
            Understand books in <span className="text-orange-600">15 minutes</span>.
          </h1>
          
          <p className="text-xl text-gray-600 leading-relaxed max-w-md mb-12">
            Your personal knowledge library. Get key insights, audio summaries, and actionable steps from the world's best non-fiction.
          </p>

          <div className="space-y-4">
            {[
              "AI-Powered Summaries & Deep Dives",
              "Audio Narrations for On-the-Go",
              "Personalized Knowledge Tracking"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                <CheckCircle2 className="text-orange-500" size={20} />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-sm text-gray-400 font-medium">
          &copy; {new Date().getFullYear()} BookSum AI.
        </div>
      </div>

      {/* Right: Login Action */}
      <div className="w-full md:w-1/2 bg-white flex flex-col items-center justify-center p-8 md:p-12 border-l border-gray-100 shadow-2xl shadow-gray-100 relative z-10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-gray-500">
              {isLogin ? 'Enter your details to access your library' : 'Start your learning journey today'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-900"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-900"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-medium text-gray-900"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium animate-in slide-in-from-top-2">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full group relative flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-orange-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="opacity-60 group-hover:translate-x-1 transition-transform" size={20} />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  clearError();
                }}
                className="ml-2 font-bold text-orange-600 hover:underline"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
