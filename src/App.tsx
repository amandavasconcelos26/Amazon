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
    <div className="min-h-screen bg-[#0B0F19] font-sans overflow-x-hidden relative">
      <Particles />
      {/* BACKGROUND LAYER: Image + Gradient + Tech Grid */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 logistics-bg-overlay" />
        <div className="absolute inset-0 tech-grid opacity-30" />
        {/* Superior mais branca para mesclar a logo e clarear o topo */}
        <div className="absolute top-0 inset-x-0 h-[220px] md:h-[350px] bg-gradient-to-b from-white via-white/95 to-transparent pointer-events-none" />
      </div>

      {/* HEADER */}
      <header className="relative z-50">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-10 h-24 md:h-36 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 md:gap-5"
          >
            <div className="h-24 md:h-36 w-auto flex items-center justify-start shrink-0 pt-2 md:pt-4">
              <img src="/logo.png" alt="FreteVision" className="h-full w-auto object-contain mix-blend-multiply" />
            </div>
            {/* Ocultando o texto do logo caso a imagem já tenha o nome, ou mantendo algo minimalista */}
          </motion.div>

          <nav className="hidden lg:flex items-center gap-14">
            {['Soluções', 'Auditoria', 'Tecnologia'].map((item, i) => (
              <a 
                key={item} 
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(i === 0 ? "audit" : i === 1 ? "audit" : "changelog");
                }}
                className={cn(
                  "text-[15px] font-bold transition-all duration-500 hover:scale-105",
                  "text-[#0B0F19]" // Texto escuro combinando com o fundo claro do topo
                )}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-[#0B0F19] leading-none tracking-tight">{user.displayName || user.email?.split('@')[0]}</span>
                  <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-1.5 px-2 py-0.5 bg-amber-500/10 rounded-full">Online</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => logout()} className="rounded-2xl hover:bg-black/5 border border-black/10 w-12 h-12">
                  <LogOut className="h-5 w-5 text-[#0B0F19]" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Button variant="link" onClick={() => login()} className="text-[#0B0F19] font-bold text-[15px] hover:text-[#0B0F19]/70 hover:no-underline">
                  Entrar
                </Button>
                <Button 
                  onClick={() => login()} 
                  className="bg-[#0B0F19] hover:bg-[#1A2235] transition-all duration-500 text-white rounded-full px-8 h-12 font-semibold text-[15px] shadow-lg"
                >
                  Falar com Especialista
                </Button>
              </div>
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
              <div className="w-full flex flex-col lg:flex-row items-center gap-12 mb-32 pt-16">
                <div className="flex-1 text-center lg:text-left space-y-8">
                  <motion.div
                    initial={{ opacity: 0, x: -60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-5 py-2.5 rounded-full mb-8 font-medium tracking-[0.05em] text-[13px] backdrop-blur-md">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                      Plataforma de Inteligência Logística
                    </Badge>
                    <h2 className="text-5xl md:text-7xl lg:text-[5.5rem] font-medium text-white font-heading tracking-tight leading-[1.05] drop-shadow-2xl">
                      Visão que move <br /> <span className="text-[#ceaa69]">resultados.</span>
                    </h2>
                    <p className="text-lg md:text-xl lg:text-2xl text-slate-300 font-normal max-w-2xl mt-8 md:mt-10 leading-relaxed">
                      Auditoria avançada, cálculo preciso de frete, viabilidade de rotas e controle operacional em um único painel inteligente.
                    </p>
                    <div className="flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6 mt-10 md:mt-14">
                      <Button variant="outline" onClick={() => {
                        const el = document.getElementById('upload-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }} className="bg-[#D6AD60] hover:bg-[#C29B50] text-[#0A0F1A] border-none rounded-full px-8 h-14 md:h-16 font-semibold text-base transition-all group">
                        Começar agora
                        <svg className="ml-2 h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Button>
                      <Button variant="outline" className="bg-transparent hover:bg-white/5 text-white border border-white/20 rounded-full px-8 h-14 md:h-16 font-semibold text-base transition-all">
                        Agendar demonstração
                      </Button>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* UPLOAD CARDS */}
              <div id="upload-section" className="w-full grid md:grid-cols-2 gap-12 max-w-6xl mx-auto mb-10 pt-20">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                  <FileUploadPremium 
                    title="Sistema Mandante"
                    subtitle="Base de dados principal (GP Audit)"
                    selectedFile={fileA}
                    onFileSelect={setFileA}
                    glowColor="amber"
                    status={isParsingA ? 'loading' : isMappingA ? 'mapping' : fileA ? 'success' : 'idle'}
                  />
                </motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
                  <FileUploadPremium 
                    title="Relatório Conferência"
                    subtitle="Arquivo de validação logística"
                    selectedFile={fileB}
                    onFileSelect={setFileB}
                    glowColor="slate"
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
              <div className="text-center w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-6 mt-12 mb-10">
                <Button 
                  size="lg" 
                  disabled={!canAudit || isProcessing} 
                  onClick={handleAudit}
                  className={cn(
                    "relative group h-16 sm:h-20 px-8 sm:px-16 rounded-[2rem] md:rounded-full font-bold text-sm sm:text-lg uppercase tracking-[0.1em] transition-all duration-500 overflow-hidden w-full md:w-auto",
                    "bg-[#D6AD60] text-[#0B0F19] hover:bg-[#C29B50] hover:scale-105 active:scale-95",
                    (!canAudit || isProcessing) && "opacity-50 grayscale cursor-not-allowed"
                  )}
                >
                  <span className="relative z-10 flex items-center gap-3">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 fill-[#0B0F19]" />
                        Executar Auditoria
                      </>
                    )}
                  </span>
                </Button>
                <Button variant="ghost" onClick={resetAudit} className="text-slate-400 hover:text-white uppercase tracking-[0.1em] text-[12px] font-bold h-16 sm:h-20 px-8 rounded-full border border-white/10 hover:bg-white/5 transition-all duration-500 w-full md:w-auto">
                  <RefreshCcw className="mr-3 h-4 w-4" />
                  Limpar Dados
                </Button>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="text-center w-full"
              >
                {!canAudit && !isProcessing && (
                  <p className="mt-4 text-amber-500/50 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[11px] animate-pulse text-center px-4">
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
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 px-3 py-1 rounded-lg uppercase tracking-widest font-black text-[10px]">Relatório Consolidado</Badge>
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
                    className="bg-[#D6AD60] text-[#0B0F19] hover:bg-[#C29B50] shadow-lg rounded-2xl px-10 h-16 font-bold uppercase tracking-widest text-xs hover:scale-105 transition-all"
                  >
                    {isSaving ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <Save className="mr-3 h-4 w-4" />}
                    Arquivar Auditoria
                  </Button>
                </div>
              </div>

              <KPISection summary={summary} />
              
              <div className="grid gap-12">
                <DashboardCharts results={results} summary={summary} />

                <div className="glass-card rounded-[3rem] overflow-hidden border-amber-500/10">
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
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 px-4 py-1.5 rounded-full uppercase tracking-[0.3em] font-black text-[11px]">AI Support Agent</Badge>
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
          <div className="h-16 w-16 md:h-24 md:w-24 flex items-center justify-center shrink-0">
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
  glowColor: 'amber' | 'slate';
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  status?: 'idle' | 'loading' | 'mapping' | 'success' | 'error';
}

const FileUploadPremium: React.FC<FileUploadPremiumProps> = ({ title, subtitle, glowColor, selectedFile, onFileSelect, status }) => {
  return (
    <div className="group perspective-1000">
      <div className={cn(
        "relative rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 flex flex-col items-center text-center",
        "glass-card glass-card-hover border border-white/5 h-[280px] md:h-[340px] justify-center cursor-pointer",
        selectedFile && (glowColor === 'amber' ? "border-amber-500/30 bg-amber-500/5 glow-primary" : "border-slate-500/30 bg-slate-500/5 glow-primary")
      )}>
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} />
        
        <div className={cn(
          "w-16 h-16 md:w-24 md:h-24 rounded-full mb-6 md:mb-8 flex items-center justify-center transition-all duration-700 relative",
          selectedFile 
            ? (glowColor === 'amber' ? "bg-amber-500 shadow-lg shadow-amber-500/20" : "bg-slate-700 shadow-lg shadow-slate-700/20")
            : "bg-[#1A2235] border border-white/5",
          "group-hover:scale-110"
        )}>
          {selectedFile ? (
            <CheckCircle2 className="h-8 w-8 md:h-10 md:w-10 text-[#0B0F19]" />
          ) : (
            <Upload className={cn("h-8 w-8 md:h-10 md:w-10", glowColor === 'amber' ? "text-amber-400" : "text-slate-400")} />
          )}
          {/* Pulsing inner glow */}
          <div className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none",
            glowColor === 'amber' ? "bg-amber-400" : "bg-slate-400"
          )} />
        </div>

        <h3 className="text-xl md:text-2xl font-bold text-white font-heading tracking-tight mb-1 md:mb-2">{title}</h3>
        <p className="text-slate-400 text-xs md:text-sm font-medium mb-4 md:mb-6">{subtitle}</p>

        {selectedFile ? (
          <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 bg-white/5 border border-white/10 rounded-full shadow-inner max-w-full overflow-hidden">
            <FileText className={cn("h-4 w-4 shrink-0", glowColor === 'amber' ? "text-amber-400" : "text-slate-400")} />
            <span className="text-[10px] md:text-xs text-white font-medium truncate">{selectedFile.name}</span>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            <div className={cn(
              "text-[9px] md:text-[10px] font-bold uppercase tracking-[0.1em] px-4 md:px-6 py-2 md:py-2.5 rounded-full inline-block",
              glowColor === 'amber' ? "bg-amber-500/10 text-amber-500" : "bg-white/5 text-slate-300"
            )}>
              Selecionar arquivo
            </div>
            <p className="text-[8px] md:text-[9px] text-slate-500 font-medium tracking-wider uppercase">CSV, XLS, DAT, PDF</p>
          </div>
        )}

        {/* LOADING OVERLAY */}
        {status === 'loading' && (
          <div className="absolute inset-0 glass-card z-30 flex flex-col items-center justify-center gap-3 md:gap-4 rounded-[2rem] md:rounded-[2.5rem]">
            <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-amber-500" />
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-amber-400">Lendo Arquivo...</p>
          </div>
        )}
      </div>
    </div>
  );
};
