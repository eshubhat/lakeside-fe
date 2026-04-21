import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Video, Mic, Users, Zap, Shield, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SignupModal from '../../components/SignupModal';

function generateRoomId() {
  return crypto.randomUUID().slice(0, 8);
}

const FEATURES = [
  { icon: Video,  label: '4K Local Recording',  desc: 'Uncompressed video captured on each side' },
  { icon: Mic,    label: 'Studio-grade Audio',   desc: 'Crystal clear audio tracks for every guest' },
  { icon: Users,  label: 'Multi-guest Rooms',    desc: 'Invite unlimited remote participants' },
  { icon: Zap,    label: 'Zero-latency Sync',    desc: 'Real-time WebRTC powered sessions' },
  { icon: Shield, label: 'Private & Secure',     desc: 'End-to-end encrypted streams' },
  { icon: Globe,  label: 'Join From Anywhere',   desc: 'Browser-based, no downloads needed' },
];

export default function Home() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Stable room id for this landing visit
  const [roomId] = useState<string>(() => generateRoomId());

  const [showSignupModal, setShowSignupModal] = useState(false);

  useEffect(() => {
    if (token) {
      // Already logged in → go straight into a new room, no popup
      navigate(`/room/${roomId}`, { replace: true });
    } else {
      // Not logged in → show sign-in modal after a brief animation delay
      const t = setTimeout(() => setShowSignupModal(true), 500);
      return () => clearTimeout(t);
    }
  }, [token]);

  // Called by SignupModal when auth succeeds
  const handleAuthSuccess = () => {
    setShowSignupModal(false);
    navigate(`/room/${roomId}`);
  };

  // While the authenticated redirect is processing, render nothing (auth context shows Loading)
  if (token) return null;

  return (
    <div className="min-h-screen bg-surface relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #006d43, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-48 -left-24 w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #00d084, transparent 70%)' }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 w-full z-50 glass-header border-b border-midnight/5">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <div className="text-xl font-bold tracking-tight text-midnight font-headline select-none">
            ArchitectSaaS
          </div>
          <button
            onClick={() => setShowSignupModal(true)}
            className="emerald-gradient text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-md shadow-primary/20"
          >
            Get Started Free
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs tracking-wider uppercase mb-8"
          >
            <Zap className="w-3.5 h-3.5" />
            High-Fidelity Remote Studio
          </motion.span>

          <h1 className="font-headline text-5xl sm:text-6xl md:text-7xl font-extrabold text-midnight leading-[1.08] tracking-tight mb-6">
            Record like you're{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #006d43 0%, #00d084 100%)' }}
            >
              in the same room.
            </span>
          </h1>

          <p className="text-on-surface-variant text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Riverside captures 4K uncompressed video and studio-quality audio locally on every device.
            No compression, no quality loss — just broadcast-ready content.
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowSignupModal(true)}
            className="emerald-gradient text-white font-bold px-8 py-4 rounded-xl text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/25 hover:opacity-95 transition-all mx-auto"
          >
            <Video className="w-5 h-5" />
            Start Recording Free
          </motion.button>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-24 max-w-5xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + idx * 0.07 }}
              className="bg-white rounded-2xl border border-midnight/5 p-6 text-left hover:shadow-lg hover:shadow-midnight/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-headline font-bold text-midnight text-base mb-1">{feature.label}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Signup / Login Modal */}
      <SignupModal
        isOpen={showSignupModal}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
