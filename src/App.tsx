import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';

const COLORS = [
  { id: 'azul', hex: '#00f0ff', label: 'Azul', shadow: 'rgba(0, 240, 255, 0.8)' },
  { id: 'verde', hex: '#00ff00', label: 'Verde', shadow: 'rgba(0, 255, 0, 0.8)' },
  { id: 'amarelo', hex: '#ffea00', label: 'Amarelo', shadow: 'rgba(255, 234, 0, 0.8)' },
  { id: 'vermelho', hex: '#ff003c', label: 'Vermelho', shadow: 'rgba(255, 0, 60, 0.8)' },
  { id: 'roxo', hex: '#b026ff', label: 'Roxo', shadow: 'rgba(176, 38, 255, 0.8)' },
  { id: 'branco', hex: '#ffffff', label: 'Branco', shadow: 'rgba(255, 255, 255, 0.8)' },
];

export default function App() {
  const [cpf, setCpf] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [resultColor, setResultColor] = useState<{ id: string; hex: string; label: string; shadow: string } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState('');
  const controls = useAnimation();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spinIntervalRef = useRef<number | null>(null);
  const currentRotationRef = useRef<number>(0);

  const playBeep = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio play failed:", e);
    }
  };

  const startSpinSound = () => {
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    let freq = 400;
    spinIntervalRef.current = window.setInterval(() => {
      playBeep(freq, 'square', 0.05, 0.03);
      freq = freq === 400 ? 600 : 400;
    }, 80);
  };

  const stopSpinSound = () => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  };

  const playSuccessSound = () => {
    playBeep(523.25, 'sine', 0.1, 0.2); // C5
    setTimeout(() => playBeep(659.25, 'sine', 0.1, 0.2), 100); // E5
    setTimeout(() => playBeep(783.99, 'sine', 0.4, 0.2), 200); // G5
    setTimeout(() => playBeep(1046.50, 'sine', 0.8, 0.2), 300); // C6
  };

  useEffect(() => {
    return () => {
      stopSpinSound();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, []);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Format CPF: 000.000.000-00
    let formatted = value;
    if (value.length > 9) {
      formatted = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
      formatted = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (value.length > 3) {
      formatted = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    
    setCpf(formatted);
    setError('');
  };

  const handleSpin = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Por favor, insira um CPF válido com 11 dígitos.');
      return;
    }

    setError('');
    setIsSpinning(true);
    setShowResult(false);
    setResultColor(null);

    try {
      // Fetch the color from the backend
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cleanCpf }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao verificar CPF');
      }

      const data = await response.json();
      const targetColorId = data.color;
      const targetColorIndex = COLORS.findIndex(c => c.id === targetColorId);
      const targetColor = COLORS[targetColorIndex];

      if (!targetColor) throw new Error('Cor inválida retornada pelo servidor');

      // Play sound
      startSpinSound();

      const sliceAngle = 360 / COLORS.length;
      const targetCenterAngle = (targetColorIndex * sliceAngle) + (sliceAngle / 2);
      
      // The wheel needs to stop so the pointer (at top) points to targetColor
      // Target final angle (mod 360) where the color aligns with top pointer
      const targetStopAngle = (360 - targetCenterAngle + 360) % 360;
      
      // Calculate how much more we need to rotate from current position
      const currentAngle = currentRotationRef.current % 360;
      let neededDegrees = (targetStopAngle - currentAngle + 360) % 360;
      if (neededDegrees === 0) neededDegrees = 360;
      
      // Add full rotations for dramatic effect
      const extraRotations = 360 * 8;
      const spinAmount = extraRotations + neededDegrees;
      const finalRotation = currentRotationRef.current + spinAmount;

      // Stop any running animation and set starting position
      controls.stop();
      controls.set({ rotate: currentRotationRef.current });
      currentRotationRef.current = finalRotation;

      await controls.start({
        rotate: finalRotation,
        transition: {
          duration: 5,
          ease: [0.15, 0.6, 0.15, 1],
        }
      });

      stopSpinSound();
      playSuccessSound();

      setResultColor(targetColor);
      setShowResult(true);

    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado.');
      setIsSpinning(false);
      stopSpinSound();
    } finally {
      setIsSpinning(false);
    }
  };

  // SVG drawing logic for the wheel
  const radius = 150;
  const cx = 150;
  const cy = 150;

  const createSlicePath = (index: number, total: number) => {
    const startAngle = (index * 360) / total;
    const endAngle = ((index + 1) * 360) / total;
    
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 font-sans overflow-hidden relative">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#050505] to-[#050505] opacity-80 z-0"></div>
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgNDBoNDBWMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] z-0 opacity-50"></div>

      {/* Logos fixas no lado direito da tela */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        className="fixed right-16 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-16 hidden md:flex"
      >
        <img
          src="/logo-parceiro.png"
          alt="Logo Parceiro"
          className="h-25 lg:h-28 object-contain opacity-80 -mt-8"
        />
        

        <img
          src="/logo-goias.png"
          alt="Logo Goiás"
          className="h-15 lg:h-20 object-contain opacity-80 mt-4"
        />
      </motion.div>

      {/* Logo do evento fixa no lado esquerdo da tela */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        className="fixed left-16 top-1/2 -translate-y-1/2 z-20 hidden md:flex"
      >
        <img
          src="/logo-evento.png"
          alt="Logo do Evento"
          className="h-52 lg:h-64 object-contain opacity-80"
        />
      </motion.div>

      <div className="max-w-md w-full relative z-10 flex flex-col items-center">
        
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-10 flex flex-col items-center"
        >
          {/* Logo do Evento */}
          <motion.img 
            src="/logo.png" 
            alt="Logo do Evento" 
            className="h-22 md:h-28 mb-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            onError={(e) => {
              // Fallback caso a imagem não seja encontrada
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <motion.h1 
            animate={{ 
              scale: [1, 1.03, 1],
              filter: [
                "drop-shadow(0 0 10px rgba(34,211,238,0.4))",
                "drop-shadow(0 0 25px rgba(168,85,247,0.8))",
                "drop-shadow(0 0 10px rgba(34,211,238,0.4))"
              ]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500"
          >
            CREDENCIAMENTO
          </motion.h1>
          <p className="text-slate-400 text-sm md:text-base tracking-widest uppercase font-semibold">
            Descubra sua equipe
          </p>
        </motion.div>

        <div className="mb-12 relative flex justify-center w-full">
          {/* Neon Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 z-20 flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] mb-1"></div>
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
          </div>
          
          {/* Wheel Container */}
          <div className="relative p-2 rounded-full bg-slate-900/50 backdrop-blur-sm border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            {/* Outer Neon Ring */}
            <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-1000 ${isSpinning ? 'border-cyan-500 shadow-[0_0_30px_rgba(0,240,255,0.5)]' : 'border-slate-700'}`}></div>
            
            <motion.div 
              className="relative w-[320px] h-[320px] md:w-[380px] md:h-[380px] rounded-full overflow-hidden"
              animate={controls}
              initial={{ rotate: 0 }}
            >
              <svg width="100%" height="100%" viewBox="0 0 300 300">
                {COLORS.map((color, i) => (
                  <g key={color.id}>
                    <path
                      d={createSlicePath(i, COLORS.length)}
                      fill={color.hex}
                      stroke="#050505"
                      strokeWidth="4"
                      className="opacity-90 hover:opacity-100 transition-opacity"
                    />
                    {/* Text on slice */}
                    <text
                      x={cx + (radius * 0.65) * Math.cos(((i + 0.5) * 360 / COLORS.length - 90) * Math.PI / 180)}
                      y={cy + (radius * 0.65) * Math.sin(((i + 0.5) * 360 / COLORS.length - 90) * Math.PI / 180)}
                      fill="#050505"
                      fontSize="16"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${(i + 0.5) * 360 / COLORS.length}, ${cx + (radius * 0.65) * Math.cos(((i + 0.5) * 360 / COLORS.length - 90) * Math.PI / 180)}, ${cy + (radius * 0.65) * Math.sin(((i + 0.5) * 360 / COLORS.length - 90) * Math.PI / 180)})`}
                      style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                    >
                      {color.label}
                    </text>
                  </g>
                ))}
                {/* Center Hub */}
                <circle cx="150" cy="150" r="25" fill="#050505" stroke="#333" strokeWidth="4" />
                <circle cx="150" cy="150" r="10" fill="#fff" className="shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
              </svg>
            </motion.div>
          </div>

        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="relative">
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={handleCpfChange}
              placeholder="DIGITE SEU CPF"
              disabled={isSpinning}
              className="w-full px-6 py-4 bg-slate-900/80 backdrop-blur-md border-2 border-slate-700 rounded-2xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition-all text-white text-center text-2xl font-mono tracking-[0.2em] disabled:opacity-50 placeholder:text-slate-600 placeholder:text-lg placeholder:tracking-widest"
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-3 text-center font-semibold tracking-wide"
              >
                {error}
              </motion.p>
            )}
          </div>

          <button
            onClick={handleSpin}
            disabled={isSpinning || cpf.replace(/\D/g, '').length !== 11}
            className="group relative w-full py-5 bg-slate-800 rounded-2xl font-black text-xl uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            {/* Button background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
            
            {/* Button glow effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]"></div>
            
            <span className="relative z-10 flex items-center justify-center gap-3 text-white drop-shadow-md">
              {isSpinning ? (
                <>
                  <span className="animate-pulse">Sorteando</span>
                  <span className="flex gap-1">
                    <span className="animate-bounce delay-75">.</span>
                    <span className="animate-bounce delay-150">.</span>
                    <span className="animate-bounce delay-300">.</span>
                  </span>
                </>
              ) : (
                'Girar Roleta'
              )}
            </span>
          </button>
        </div>

        {/* Dramatic Reveal Overlay */}
        <AnimatePresence>
          {showResult && resultColor && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
              style={{ backgroundColor: 'rgba(5, 5, 5, 0.85)' }}
            >
              {/* Radial glow behind the card */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 0.4 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none"
                style={{ backgroundColor: resultColor.hex }}
              />

              <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
                className="relative w-full max-w-md bg-[#0a0a0a] rounded-3xl p-8 md:p-12 text-center border overflow-hidden"
                style={{ 
                  borderColor: resultColor.hex,
                  boxShadow: `0 0 40px ${resultColor.shadow}, inset 0 0 20px ${resultColor.shadow}`
                }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: resultColor.hex }}></div>
                
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: 360 }}
                  transition={{ type: "spring", damping: 10, stiffness: 50, delay: 0.5 }}
                  className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${resultColor.hex}20`, border: `2px solid ${resultColor.hex}` }}
                >
                  <Shield size={40} color={resultColor.hex} />
                </motion.div>

                <h2 className="text-sm tracking-[0.3em] text-slate-400 uppercase font-bold mb-2">
                  Você pertence à
                </h2>
                <h3 
                  className="text-4xl md:text-5xl font-black uppercase mb-6"
                  style={{ 
                    color: resultColor.hex,
                    textShadow: `0 0 20px ${resultColor.shadow}`
                  }}
                >
                  Equipe {resultColor.label}
                </h3>
                
                <p className="text-lg text-slate-300 mb-8 font-medium">
                  Retire sua armadura e prepare-se para o jogo!
                </p>

                <button
                  onClick={() => {
                    setShowResult(false);
                    setCpf('');
                  }}
                  className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all hover:scale-105 active:scale-95"
                  style={{ 
                    backgroundColor: resultColor.hex,
                    color: '#000',
                    boxShadow: `0 0 15px ${resultColor.shadow}`
                  }}
                >
                  Novo Check-in
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
