import React, { useState, useEffect, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { KPISection } from './components/KPISection';
import { AuditTable } from './components/AuditTable';
import { ColumnMapper } from './components/ColumnMapper';
import { parseFile, mapData, performAudit, exportToExcel, exportToPDF, shareToWhatsApp, detectSequentialGaps, calculateSummary } from './services/freightService';
import { autoMapColumns } from './services/extractionService';
import { DashboardCharts } from './components/DashboardCharts';
import { HelpCenter } from './components/HelpCenter';
import { Changelog } from './components/Changelog';
import { CTEData, ColumnMapping, AuditResult, AuditSummary, SavedAudit } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, Play, RefreshCcw, FileSpreadsheet, LogIn, LogOut, History, Save, User as UserIcon, Truck, MessageSquare, CheckCircle2, Loader2, FileText, Share2, Sparkles, AlertTriangle, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useFirebase } from './contexts/FirebaseContext';
import { db, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from './firebase';
import { cn } from '@/lib/utils';

const DEFAULT_MAPPING: ColumnMapping = {
  cte: '',
  freteEmpresa: '',
  freteMotorista: '',
  margem: '',
  peso: ''
};

const Particles = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100 + 100}%`,
            width: `${Math.random() * 4 + 1}px`,
            height: `${Math.random() * 4 + 1}px`,
            // @ts-ignore
            '--duration': `${Math.random() * 20 + 10}s`,
            '--delay': `${Math.random() * 10}s`,
            '--drift': `${Math.random() * 200 - 100}px`,
          }}
        />
      ))}
    </div>
  );
};

export default function App() {
  const { user, login, logout, loading: authLoading } = useFirebase();
  
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  
  const [rawA, setRawA] = useState<any[]>([]);
  const [rawB, setRawB] = useState<any[]>([]);
  const [footerTotalA, setFooterTotalA] = useState<number>(0);
  
  const [mappingA, setMappingA] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [mappingB, setMappingB] = useState<ColumnMapping>(DEFAULT_MAPPING);
  
  const [results, setResults] = useState<AuditResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingA, setIsParsingA] = useState(false);
  const [isParsingB, setIsParsingB] = useState(false);
  const [isMappingA, setIsMappingA] = useState(false);
  const [isMappingB, setIsMappingB] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState<number>(0);
  const [history, setHistory] = useState<SavedAudit[]>([]);
  const [activeTab, setActiveTab] = useState("audit");
  const [showConfigWarning, setShowConfigWarning] = useState(true);

  const apiKeyExists = useMemo(() => {
    // Vite string replacement will replace process.env.GEMINI_API_KEY directly at build time
    // Do NOT use typeof process checks, because process is not defined in the browser, making the condition false.
    const key = import.meta.env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
    return !!key && key !== 'undefined' && key !== 'null' && key.length > 5;
  }, []);

  const columnsA = useMemo(() => rawA.length > 0 ? Object.keys(rawA[0]) : [], [rawA]);
  const columnsB = useMemo(() => rawB.length > 0 ? Object.keys(rawB[0]) : [], [rawB]);

  useEffect(() => {
    if (fileA) {
      setResults([]); // Clear results when new file is uploaded
      setIsParsingA(true);
      parseFile(fileA)
        .then(res => {
          setRawA(res.data);
          if (res.footerTotal) setFooterTotalA(res.footerTotal);
        })
        .catch(err => {
          console.error(err);
          setErrorMessage("Erro ao processar o arquivo A: " + err.message);
          setFileA(null);
        })
        .finally(() => setIsParsingA(false));
    } else {
      setRawA([]);
      setFooterTotalA(0);
    }
  }, [fileA]);

  useEffect(() => {
    if (fileB) {
      setResults([]); // Clear results when new file is uploaded
      setIsParsingB(true);
      parseFile(fileB)
        .then(res => setRawB(res.data))
        .catch(err => {
          console.error(err);
          setErrorMessage("Erro ao processar o arquivo B: " + err.message);
          setFileB(null);
        })
        .finally(() => setIsParsingB(false));
    } else {
      setRawB([]);
    }
  }, [fileB]);

  // Load history
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'audits'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedAudit[];
      setHistory(audits);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audits');
    });

    return unsubscribe;
  }, [user]);

  const handleAutoMap = async (system: 'A' | 'B') => {
    const cols = system === 'A' ? columnsA : columnsB;
    if (cols.length === 0) return;

    if (system === 'A') setIsMappingA(true);
    else setIsMappingB(true);

    try {
      const mapping = await autoMapColumns(cols);
      // Validate mapping properties
      const validMapping: Partial<ColumnMapping> = {};
      if (mapping.cte) validMapping.cte = mapping.cte;
      if (mapping.freteEmpresa) validMapping.freteEmpresa = mapping.freteEmpresa;
      if (mapping.freteMotorista) validMapping.freteMotorista = mapping.freteMotorista;
      if (mapping.margem) validMapping.margem = mapping.margem;
      if (mapping.peso) validMapping.peso = mapping.peso;

      if (system === 'A') setMappingA(prev => ({ ...prev, ...validMapping }));
      else setMappingB(prev => ({ ...prev, ...validMapping }));
    } catch (error: any) {
      console.error("Erro no Mapeamento Automático:", error);
      setErrorMessage(`Aviso: O motor de IA falhou ao mapear colunas do Arquivo ${system} (${error.message || 'Limite atingido'}). O sistema usará o mapeamento básico.`);
    } finally {
      if (system === 'A') setIsMappingA(false);
      else setIsMappingB(false);
    }
  };

  useEffect(() => {
    if (columnsA.length > 0) {
      const mapping = { ...DEFAULT_MAPPING };
      columnsA.forEach(col => {
        const lower = col.toLowerCase();
        if (lower.includes('número') || lower.includes('numero') || lower.includes('ct') || lower.includes('documento')) {
          if (!mapping.cte) mapping.cte = col;
        }
        if (lower.includes('frete empr') || lower.includes('empresa') || lower.includes('normal')) {
          if (!mapping.freteEmpresa) mapping.freteEmpresa = col;
        }
        if (lower.includes('frete mot') || lower.includes('motorista') || lower.includes('carreteiro')) {
          if (!mapping.freteMotorista) mapping.freteMotorista = col;
        }
        if (lower.includes('result') || lower.includes('margem') || lower.includes('%')) {
          if (!mapping.margem) mapping.margem = col;
        }
        if (lower.includes('peso')) {
          if (!mapping.peso) mapping.peso = col;
        }
      });
      // Aggressive fallback to prevent locking the button:
      if (!mapping.cte && columnsA.length > 0) mapping.cte = columnsA[0]; // assume first column is ID if no match
      setMappingA(mapping);
      handleAutoMap('A');
    }
  }, [columnsA]);

  useEffect(() => {
    if (columnsB.length > 0) {
      const mapping = { ...DEFAULT_MAPPING };
      columnsB.forEach(col => {
        const lower = col.toLowerCase();
        if (lower.includes('cte') || lower.includes('nfs') || lower.includes('numero') || lower.includes('ct') || lower.includes('documento')) {
          if (!mapping.cte) mapping.cte = col;
        }
        if (lower.includes('valor frete') || lower.includes('frete emp') || lower.includes('normal')) {
          if (!mapping.freteEmpresa) mapping.freteEmpresa = col;
        }
        if (lower.includes('carreteiro') || lower.includes('vl mot') || lower.includes('frete mot')) {
          if (!mapping.freteMotorista) mapping.freteMotorista = col;
        }
        if (lower.includes('result') || lower.includes('margem') || lower.includes('%')) {
          if (!mapping.margem) mapping.margem = col;
        }
        if (lower.includes('peso')) {
          if (!mapping.peso) mapping.peso = col;
        }
      });
      // Aggressive fallback
      if (!mapping.cte && columnsB.length > 0) mapping.cte = columnsB[0];
      setMappingB(mapping);
      handleAutoMap('B');
    }
  }, [columnsB]);

  const handleAudit = () => {
    if (isParsingA || isParsingB) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const dataA = mapData(rawA, mappingA);
        const dataB = mapData(rawB, mappingB);
        const auditResults = performAudit(dataA, dataB, tolerance);
        setResults(auditResults);
        setIsProcessing(false);
        
        // Scroll to results
        const resultsElement = document.getElementById('audit-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }

        // Check for 100% match
        const is100PercentMatch = auditResults.length > 0 && 
          auditResults.every(r => r.status === 'BOTH_MATCH');
          
        if (is100PercentMatch) {
          try {
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10b981', '#34d399', '#059669']
            });
          } catch (e) {
            console.error("Confetti error:", e);
          }
        }
      } catch (error) {
        console.error("Audit processing error:", error);
        setErrorMessage("Erro ao processar auditoria: " + (error as Error).message);
        setIsProcessing(false);
      }
    }, 800);
  };

  const handleUpdateResult = (updatedResult: AuditResult) => {
    setResults(prev => prev.map(r => r.cte === updatedResult.cte ? updatedResult : r));
  };

  const saveAudit = async () => {
    if (!user || results.length === 0) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'audits'), {
        userId: user.uid,
        name: `Auditoria ${new Date().toLocaleString('pt-BR')}`,
        summary,
        results: results, // Salvando todos os resultados para manter os gráficos precisos no histórico
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving audit:", error);
      handleFirestoreError(error, OperationType.CREATE, 'audits');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAudit = () => {
    setFileA(null);
    setFileB(null);
    setRawA([]);
    setRawB([]);
    setResults([]);
    setErrorMessage(null);
    setFooterTotalA(0);
    setActiveTab("audit");
  };

  const summary: AuditSummary = useMemo(() => {
    return calculateSummary(results, footerTotalA, tolerance);
  }, [results, footerTotalA, tolerance]);

  const canAudit = rawA.length > 0 && rawB.length > 0 && 
                  mappingA.cte && mappingB.cte;

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden relative">
      <Particles />
      {/* BACKGROUND LAYER: Image + Gradient + Tech Grid */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center" />
        <div className="absolute inset-0 logistics-bg-overlay" />
        <div className="absolute inset-0 tech-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
      </div>

      {/* HEADER */}
      <header className="relative z-50 border-b border-white/[0.05] backdrop-blur-3xl bg-slate-950/30">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-10 h-20 md:h-28 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 md:gap-5"
          >
            <div className="bg-white p-2 rounded-2xl shadow-xl glow-indigo floating h-12 w-12 md:h-16 md:w-16 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="FreteVision" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tight text-white font-heading leading-none uppercase glow-text">FreteVision</h1>
              <p className="text-[9px] md:text-xs font-black text-indigo-400 uppercase tracking-[0.4em] mt-1 md:mt-2 opacity-90">Inteligência Logística Pro</p>
            </div>
          </motion.div>

          <nav className="hidden lg:flex items-center gap-14">
            {['Auditoria', 'Suporte Técnico', 'Novidades'].map((item, i) => (
              <a 
                key={item} 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(i === 0 ? "audit" : i === 1 ? "help-center" : "changelog");
                }}
                className={cn(
                  "text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 hover:text-white hover:scale-110",
                  activeTab === (i === 0 ? "audit" : i === 1 ? "help-center" : "changelog") ? "text-white glow-text" : "text-slate-500"
                )}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-8">
            {user ? (
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-white leading-none tracking-tight">{user.displayName || user.email?.split('@')[0]}</span>
                  <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-full">Online</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => logout()} className="rounded-2xl hover:bg-white/5 border border-white/10 w-12 h-12">
                  <LogOut className="h-5 w-5 text-slate-400" />
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => login()} 
                className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:scale-105 transition-all duration-500 text-white rounded-2xl px-6 md:px-10 h-10 md:h-14 font-black uppercase text-[10px] md:text-sm tracking-widest shadow-2xl glow-indigo border border-white/20"
              >
                <LogIn className="mr-2 md:mr-3 h-3 w-3 md:h-4 md:w-4" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl p-6 lg:p-20">
        <AnimatePresence mode="wait">
          {activeTab === "audit" && results.length === 0 && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              {/* HERO SECTION */}
              <div className="w-full flex flex-col lg:flex-row items-center gap-24 mb-32">
                <div className="flex-1 text-center lg:text-left space-y-10">
                  <motion.div
                    initial={{ opacity: 0, x: -60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/40 px-5 py-2 rounded-full mb-8 uppercase tracking-[0.3em] font-black text-[11px] backdrop-blur-md">
                      Next-Gen Analytics v2.5.2
                    </Badge>
                    <h2 className="text-5xl md:text-7xl lg:text-9xl font-black text-white font-heading tracking-tighter leading-[0.85] glow-text drop-shadow-2xl">
                      Auditoria <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Financeira</span>
                    </h2>
                    <p className="text-lg md:text-xl lg:text-2xl text-slate-300/70 font-medium max-w-2xl mt-8 md:mt-10 leading-relaxed">
                      Evolua sua gestão com processamento automatizado. <br className="hidden md:block"/>
                      Validamos dados complexos com precisão cirúrgica.
                    </p>
                    <div className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6 mt-10 md:mt-14">
                      <Button variant="ghost" onClick={resetAudit} className="text-slate-500 hover:text-white uppercase tracking-[0.3em] text-[10px] md:text-xs font-black h-12 md:h-16 px-6 md:px-10 rounded-[2rem] border border-white/10 hover:bg-white/5 transition-all duration-500">
                        <RefreshCcw className="mr-3 h-4 w-4 md:h-5 md:w-5" />
                        Limpar Dados
                      </Button>
                    </div>
                  </motion.div>
                </div>
                
                <div className="hidden lg:block flex-1 relative perspective-1000">
                  <motion.div
                    initial={{ opacity: 0, rotateY: 20, x: 100 }}
                    animate={{ opacity: 0.7, rotateY: 0, x: 0 }}
                    transition={{ duration: 1.2, delay: 0.4 }}
                    className="relative group"
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=1200"
                      alt="Modern Hub"
                      className="w-full rounded-[4rem] object-cover h-[600px] shadow-[0_0_80px_rgba(79,70,229,0.3)] grayscale contrast-150 transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-slate-950/90 via-slate-950/20 to-transparent rounded-[4rem]" />
                    <div className="absolute -inset-4 border border-indigo-500/20 rounded-[4.5rem] -z-10 animate-pulse" />
                  </motion.div>
                </div>
              </div>

              {/* UPLOAD CARDS */}
              <div className="w-full grid md:grid-cols-2 gap-12 max-w-6xl mx-auto mb-10">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                  <FileUploadPremium 
                    title="Sistema Mandante"
                    subtitle="Base de dados principal (GP Audit)"
                    selectedFile={fileA}
                    onFileSelect={setFileA}
                    glowColor="indigo"
                    status={isParsingA ? 'loading' : isMappingA ? 'mapping' : fileA ? 'success' : 'idle'}
                  />
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
                  <FileUploadPremium 
                    title="Relatório Conferência"
                    subtitle="Arquivo de validação logística"
                    selectedFile={fileB}
                    onFileSelect={setFileB}
                    glowColor="purple"
                    status={isParsingB ? 'loading' : isMappingB ? 'mapping' : fileB ? 'success' : 'idle'}
                  />
                </motion.div>
              </div>

              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="w-full max-w-4xl mx-auto mb-10 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold flex items-center justify-center gap-4 text-sm"
                >
                  <div className="bg-rose-500/20 p-2 rounded-full">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {/* MAIN CTA */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-center"
              >
                <Button 
                  size="lg" 
                  disabled={!canAudit || isProcessing} 
                  onClick={handleAudit}
                  className={cn(
                    "relative group h-16 sm:h-20 md:h-24 px-6 sm:px-12 md:px-24 rounded-[2rem] md:rounded-[3rem] font-black text-xs sm:text-lg md:text-2xl uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] transition-all duration-700 overflow-hidden w-full md:w-auto",
                    "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white",
                    "shadow-[0_0_80px_-10px_rgba(79,70,229,0.7)] hover:shadow-[0_0_120px_-10px_rgba(79,70,229,1)] hover:scale-110 active:scale-95",
                    (!canAudit || isProcessing) && "opacity-30 grayscale cursor-not-allowed"
                  )}
                >
                  <span className="relative z-10 flex items-center gap-3 md:gap-4">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 sm:h-7 sm:w-7 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 sm:h-7 sm:w-7 fill-white" />
                        Executar Auditoria
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute -inset-[100%] group-hover:animate-[spin_4s_linear_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100" />
                </Button>
                {!canAudit && !isProcessing && (
                  <p className="mt-6 md:mt-8 text-indigo-400/50 font-black uppercase tracking-[0.15em] md:tracking-[0.4em] text-[9px] sm:text-[10px] md:text-[11px] animate-pulse text-center px-4">
                    Aguardando upload dos arquivos mandantes
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* AUDIT RESULTS VIEW */}
          {activeTab === "audit" && results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16 animate-in fade-in zoom-in-95 duration-1000"
            >
              <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-16 px-4">
                <div className="space-y-3">
                  <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 px-3 py-1 rounded-lg uppercase tracking-widest font-black text-[10px]">Relatório Consolidado</Badge>
                  <h2 className="text-5xl font-black text-white font-heading tracking-tighter glow-text uppercase leading-none">Visão Analítica</h2>
                  <p className="text-slate-400 font-black text-sm uppercase tracking-[0.3em]">{results.length} Registros Auditados com Sucesso</p>
                </div>
                <div className="flex flex-wrap justify-center gap-5">
                  <Button variant="outline" onClick={resetAudit} className="border-white/10 bg-white/[0.03] text-slate-400 rounded-2xl px-10 h-16 font-bold hover:bg-white/[0.08] transition-all uppercase tracking-widest text-xs">
                    <RefreshCcw className="mr-3 h-4 w-4" /> Novo Processo
                  </Button>
                  <Button 
                    onClick={saveAudit} 
                    disabled={isSaving}
                    className="bg-indigo-600 shadow-xl glow-indigo text-white rounded-2xl px-10 h-16 font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
                  >
                    {isSaving ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                    Arquivar Auditoria
                  </Button>
                </div>
              </div>

              <KPISection summary={summary} />
              
              <div className="grid gap-12">
                <DashboardCharts results={results} summary={summary} />

                <div className="glass-card rounded-[3rem] overflow-hidden border-indigo-500/10">
                  <div className="p-10 border-b border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">Registro Individual</h3>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Nível de granularidade máxima</p>
                    </div>
                    <div className="flex gap-4">
                      <Button variant="ghost" size="lg" onClick={() => exportToExcel(results)} className="text-emerald-400 hover:bg-emerald-500/10 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]"><FileSpreadsheet className="mr-2 h-5 w-5" /> Exportar Excel</Button>
                      <Button variant="ghost" size="lg" onClick={() => exportToPDF(results, summary)} className="text-rose-400 hover:bg-rose-500/10 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]"><FileText className="mr-2 h-5 w-5" /> Exportar PDF</Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto bg-slate-950/20">
                    <AuditTable results={results} onUpdateResult={handleUpdateResult} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "help-center" && (
            <motion.div key="help" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-16">
              <div className="text-center py-16 space-y-6">
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 px-4 py-1.5 rounded-full uppercase tracking-[0.3em] font-black text-[11px]">AI Support Agent</Badge>
                <h2 className="text-6xl font-black text-white font-heading tracking-tight glow-text uppercase">Cognição Assistida</h2>
                <p className="text-slate-400 text-xl max-w-3xl mx-auto leading-relaxed">Nossa inteligência artificial avançada analisa inconsistências e gera insights preditivos sobre seus custos logísticos.</p>
              </div>
              <HelpCenter results={results} summary={summary} />
            </motion.div>
          )}

          {activeTab === "changelog" && (
            <motion.div key="news" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10">
              <Changelog />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-32 border-t border-white/[0.05] mt-20 md:mt-32 flex flex-col items-center">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8 md:mb-10">
          <div className="p-2 bg-white rounded-2xl shadow-lg border border-white/5 h-12 w-12 md:h-16 md:w-16 flex items-center justify-center">
            <img src="/logo.png" alt="FreteVision" className="h-full w-full object-contain" />
          </div>
          <span className="text-xl md:text-2xl font-black text-white font-heading uppercase tracking-[0.4em] glow-text text-center">FreteVision</span>
        </div>
        <p className="text-slate-600 text-[10px] md:text-sm font-black uppercase tracking-[0.3em] md:tracking-[0.5em] mb-10 md:mb-14 text-center opacity-60">Logistics Intelligence Ecosystem</p>
        <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-[8px] md:text-[10px] text-slate-800 font-black tracking-[0.2em] md:tracking-[0.3em] uppercase">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>API Documentation</span>
        </div>
        <div className="mt-16 text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">@Desenvolvido por Amanda Vasconcelos</div>
      </footer>
    </div>
  );
}

// PREMIUM FILE UPLOAD COMPONENT
interface FileUploadPremiumProps {
  title: string;
  subtitle: string;
  glowColor: 'indigo' | 'purple';
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  status?: 'idle' | 'loading' | 'mapping' | 'success' | 'error';
}

const FileUploadPremium: React.FC<FileUploadPremiumProps> = ({ title, subtitle, glowColor, selectedFile, onFileSelect, status }) => {
  return (
    <div className="group perspective-1000">
      <div className={cn(
        "relative rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 flex flex-col items-center text-center",
        "glass-card glass-card-hover border-2 border-dashed h-[280px] md:h-[340px] justify-center cursor-pointer",
        selectedFile && (glowColor === 'indigo' ? "border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_30px_rgba(79,70,229,0.2)]" : "border-purple-500/50 bg-purple-500/5 shadow-[0_0_30px_rgba(168,85,247,0.2)]")
      )}>
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} />
        
        <div className={cn(
          "w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-3xl mb-6 md:mb-8 flex items-center justify-center transition-all duration-700 relative",
          selectedFile 
            ? (glowColor === 'indigo' ? "bg-indigo-600 shadow-xl shadow-indigo-500/40" : "bg-purple-600 shadow-xl shadow-purple-500/40")
            : "bg-slate-900 border border-white/5",
          "group-hover:scale-110 group-hover:rotate-12"
        )}>
          {selectedFile ? (
            <CheckCircle2 className="h-8 w-8 md:h-10 md:w-10 text-white" />
          ) : (
            <Upload className={cn("h-8 w-8 md:h-10 md:w-10", glowColor === 'indigo' ? "text-indigo-400" : "text-purple-400")} />
          )}
          {/* Pulsing inner glow */}
          <div className={cn(
            "absolute inset-0 rounded-[1.5rem] md:rounded-3xl animate-ping opacity-20 pointer-events-none",
            glowColor === 'indigo' ? "bg-indigo-400" : "bg-purple-400"
          )} />
        </div>

        <h3 className="text-xl md:text-2xl font-black text-white font-heading tracking-tight mb-1 md:mb-2">{title}</h3>
        <p className="text-slate-400 text-xs md:text-sm font-medium mb-4 md:mb-6">{subtitle}</p>

        {selectedFile ? (
          <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 bg-white/5 border border-white/10 rounded-2xl shadow-inner max-w-full overflow-hidden">
            <FileText className={cn("h-4 w-4 shrink-0", glowColor === 'indigo' ? "text-indigo-400" : "text-purple-400")} />
            <span className="text-[10px] md:text-xs text-white font-bold truncate">{selectedFile.name}</span>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            <div className={cn(
              "text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] px-3 md:px-4 py-1 md:py-1.5 rounded-full inline-block",
              glowColor === 'indigo' ? "bg-indigo-500/20 text-indigo-300" : "bg-purple-500/20 text-purple-300"
            )}>
              Enviar arquivo
            </div>
            <p className="text-[8px] md:text-[9px] text-slate-500 font-bold tracking-widest uppercase">CSV, XLS, DAT, PDF</p>
          </div>
        )}

        {/* LOADING OVERLAY */}
        {status === 'loading' && (
          <div className="absolute inset-0 glass-card z-30 flex flex-col items-center justify-center gap-3 md:gap-4 rounded-[2rem] md:rounded-[2.5rem]">
            <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-indigo-500" />
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-indigo-400">Lendo Arquivo...</p>
          </div>
        )}
      </div>
    </div>
  );
};
