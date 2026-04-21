import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setIsLoading(true);
    try {
      const response = await api.post('/auth/google', { idToken: credentialResponse.credential });
      const { token, user } = response.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'External Google Authentication gracefully failed.');
      } else {
        setError('A network abstraction error explicitly failed maintaining Google connectivity.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Both email and password are required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      login(user, token);
      navigate('/'); // Redirect to home → home will show room-ready popup
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Invalid credentials.');
      } else {
        setError('A network error occurred connecting to the studio node framework.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 w-full z-50 glass-header border-b border-midnight/5 bg-white/80 backdrop-blur-md">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="text-xl font-bold tracking-tight text-midnight font-headline cursor-pointer">
            ArchitectSaaS
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-midnight tracking-tight mb-3">
              Welcome back
            </h1>
            <p className="text-on-surface-variant">
              Sign in to access your high-fidelity studio.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl border border-midnight/5 p-8">
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6">
                {error}
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-surface border border-midnight/10 rounded-xl py-4 pl-12 pr-4 text-midnight font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                  disabled={isLoading}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface border border-midnight/10 rounded-xl py-4 pl-12 pr-4 text-midnight font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full emerald-gradient text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-primary/20 mt-2 disabled:opacity-70 disabled:scale-100"
              >
                {isLoading ? 'Authenticating...' : 'Sign In'}
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <div className="grow border-t border-midnight/10"></div>
              <span className="text-on-surface-variant text-sm px-4">or sign in with</span>
              <div className="grow border-t border-midnight/10"></div>
            </div>

            <div className="mt-6 flex justify-center w-full [&>div]:w-full transition-all hover:scale-[1.02]">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Sign In module failed.')}
                useOneTap
                theme="outline"
                size="large"
                shape="pill"
                width="100%"
              />
            </div>

            <div className="mt-8 text-center border-t border-midnight/5 pt-6">
              <p className="text-on-surface-variant text-sm">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary font-bold hover:underline">
                  Create a Studio
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
