import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Share2, ArrowRight, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RoomReadyPopupProps {
  isOpen: boolean;
  roomId: string;
  onEnterRoom: () => void;
}

export default function RoomReadyPopup({ isOpen, roomId, onEnterRoom }: RoomReadyPopupProps) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCopy = async () => {
    const roomUrl = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = roomUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  const roomUrl = `${window.location.origin}/room/${roomId}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="room-ready-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(17,28,45,0.7)' }}
        >
          <motion.div
            key="room-ready-card"
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 32 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-midnight/5 overflow-hidden"
          >
            {/* Green gradient top */}
            <div className="h-2 w-full emerald-gradient" />

            <div className="p-8 text-center">
              {/* Animated checkmark icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
              >
                <Video className="w-8 h-8 text-primary" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="font-headline text-2xl font-extrabold text-midnight tracking-tight mb-2">
                  Your Studio is Ready! 🎉
                </h2>
                <p className="text-on-surface-variant text-sm mb-7">
                  Share this link with your guests to invite them to your recording session.
                </p>

                {/* Room ID display */}
                <div className="bg-surface rounded-2xl p-4 mb-4 border border-midnight/8">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Room Link</span>
                  </div>
                  <p className="text-midnight font-mono text-sm break-all text-left leading-relaxed">
                    {roomUrl}
                  </p>
                  <div className="mt-2 pt-2 border-t border-midnight/5 flex items-center gap-1.5">
                    <span className="text-xs text-on-surface-variant">Room ID:</span>
                    <span className="text-xs font-bold text-midnight font-mono bg-primary/10 px-2 py-0.5 rounded-lg">{roomId}</span>
                  </div>
                </div>

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className={`w-full font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all mb-3 ${
                    copied
                      ? 'bg-emerald-50 border-2 border-primary/40 text-primary'
                      : 'bg-midnight/5 hover:bg-midnight/10 text-midnight border-2 border-transparent'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied to clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Room Link
                    </>
                  )}
                </button>

                {/* Enter room button */}
                <button
                  onClick={onEnterRoom}
                  className="w-full emerald-gradient text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  Enter Studio Room
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
