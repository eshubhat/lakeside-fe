import React, { useState, useEffect } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, X, Video, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface SignupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: any) => void;
}

export default function SignupModal({ isOpen, onClose, onSuccess }: SignupModalProps) {
  const [tab, setTab] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signup, login } = useAuth();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setName('');
      setEmail('');
      setPassword('');
    }
  }, [isOpen, tab]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setIsLoading(true);
    try {
      const response = await api.post('/auth/google', { idToken: credentialResponse.credential });
      const { token, user } = response.data;
      signup(user, token);
      onSuccess(user);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Google authentication failed.');
      } else {
        setError('Network error during Google sign in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) {
      setError('All fields are required.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/auth/signup', { name, email, password });
      const { token, user } = response.data;
      signup(user, token);
      onSuccess(user);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Failed to create account.');
      } else {
        setError('Network error during sign up.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      login(user, token);
      onSuccess(user);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Invalid credentials.');
      } else {
        setError('Network error during sign in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="signup-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(17,28,45,0.6)' }}
        >
          <motion.div
            key="signup-modal-card"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-midnight/5 overflow-hidden"
          >
            {/* Gradient accent bar */}
            <div className="h-1.5 w-full emerald-gradient" />

            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-7 h-7 text-primary" />
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Your room is ready</span>
                </div>
                <h2 className="font-headline text-2xl font-extrabold text-midnight tracking-tight mb-1.5">
                  {tab === 'signup' ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-on-surface-variant text-sm">
                  {tab === 'signup'
                    ? 'Sign up to save your room and invite guests.'
                    : 'Sign in to access your studio.'}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex bg-surface rounded-xl p-1 mb-6">
                <button
                  onClick={() => { setTab('signup'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'signup' ? 'bg-white text-midnight shadow-sm' : 'text-on-surface-variant hover:text-midnight'}`}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => { setTab('login'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'login' ? 'bg-white text-midnight shadow-sm' : 'text-on-surface-variant hover:text-midnight'}`}
                >
                  Sign In
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-4"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={tab === 'signup' ? handleSignup : handleLogin} className="space-y-4">
                {tab === 'signup' && (
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full bg-surface border border-midnight/10 rounded-xl py-3.5 pl-11 pr-4 text-midnight text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full bg-surface border border-midnight/10 rounded-xl py-3.5 pl-11 pr-4 text-midnight text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-surface border border-midnight/10 rounded-xl py-3.5 pl-11 pr-4 text-midnight text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full emerald-gradient text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-70"
                >
                  {isLoading ? 'Please wait...' : tab === 'signup' ? 'Create Account & Enter Room' : 'Sign In & Enter Room'}
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              {/* Divider */}
              <div className="mt-5 flex items-center gap-3">
                <div className="flex-1 border-t border-midnight/10" />
                <span className="text-on-surface-variant text-xs">or continue with</span>
                <div className="flex-1 border-t border-midnight/10" />
              </div>

              {/* Google */}
              <div className="mt-4 flex justify-center w-full [&>div]:w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign in failed.')}
                  useOneTap
                  theme="outline"
                  size="large"
                  shape="pill"
                  width="100%"
                />
              </div>

              {/* Close button (optional, only if onClose provided) */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface hover:bg-surface-low flex items-center justify-center transition-colors text-on-surface-variant hover:text-midnight"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
