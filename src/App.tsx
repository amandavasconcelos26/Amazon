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
import { Download, Play, RefreshCcw, FileSpreadsheet, LogIn, LogOut, History, Save, User as UserIcon, Truck, MessageSquare, CheckCircle2, Loader2, FileText, Share2, Sparkles, AlertTriangle } from 'lucide-react';
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
      if (system === 'A') setMappingA(prev => ({ ...prev, ...mapping }));
      else setMappingB(prev => ({ ...prev, ...mapping }));
    } catch (error) {
      console.error("Erro no Mapeamento Automático:", error);
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
        if (lower === 'número' || lower === 'numero' || lower === 'ct' || lower.includes('documento')) mapping.cte = col;
        if (lower === 'frete empr.' || lower === 'frete empr') mapping.freteEmpresa = col;
        if (lower === 'frete mot.' || lower === 'frete mot') mapping.freteMotorista = col;
        if (lower.includes('result') || lower.includes('margem') || lower === '%' || lower.includes('(%)')) mapping.margem = col;
        if (lower.includes('peso (ton)') || lower.includes('peso ton') || lower.includes('peso')) mapping.peso = col;
      });
      setMappingA(mapping);
      handleAutoMap('A');
    }
  }, [columnsA]);

  useEffect(() => {
    if (columnsB.length > 0) {
      const mapping = { ...DEFAULT_MAPPING };
      columnsB.forEach(col => {
        const lower = col.toLowerCase();
        if (lower === 'cte/nfs' || lower === 'cte' || lower.includes('numero')) mapping.cte = col;
        if (lower === 'valor frete') mapping.freteEmpresa = col;
        if (lower === 'vl carreteiro' || lower === 'vl carreteiro líquido' || lower === 'vl carreteiro liquido') mapping.freteMotorista = col;
        if (lower.includes('result') || lower.includes('margem') || lower === '%' || lower.includes('(%)')) mapping.margem = col;
        if (lower.includes('peso / kg') || lower.includes('peso kg') || lower.includes('peso')) mapping.peso = col;
      });
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
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 subtle-grid">
      <header className="bg-slate-950/70 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 shadow-[0_4px_30px_0_rgba(0,0,0,0.4)]">
        <div className="mx-auto max-w-7xl px-4 md:px-8 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 group cursor-pointer"
          >
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-900/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-heading leading-none">Amanda Gestão</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 hidden sm:block">Inteligência Logística</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            {(fileA || fileB || results.length > 0) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetAudit}
                className="hidden sm:flex border-white/10 text-slate-400 hover:bg-white/5 rounded-xl"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Nova Auditoria
              </Button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-bold text-white">{user.displayName || user.email}</span>
                  <span className="text-[10px] text-slate-500 font-medium">Usuário Verificado</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => logout().catch(handleFirestoreError)} className="rounded-full hover:bg-white/5">
                  <LogOut className="h-5 w-5 text-slate-400" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => login().catch(handleFirestoreError)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm">
                <LogIn className="mr-2 h-4 w-4" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6 space-y-10 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,58,138,0.85)),url('https://picsum.photos/seed/truck-trailer-highway-logistics/1920/1080?blur=1')] bg-cover bg-center bg-fixed rounded-3xl border-transparent shadow-2xl">
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-950/20 text-rose-200 rounded-2xl border border-rose-500/20 flex items-center justify-between shadow-sm"
          >
            <span className="font-medium">{errorMessage}</span>
            <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)} className="hover:bg-rose-500/20 rounded-full">X</Button>
          </motion.div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-10 bg-slate-800/40 backdrop-blur-sm p-1.5 rounded-2xl border border-white/5 h-auto gap-1 shadow-sm">
            <TabsTrigger value="audit" className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-400 data-[state=active]:shadow-md border border-transparent data-[state=active]:border-white/5">
              <FileSpreadsheet className="h-4 w-4" /> Auditoria
            </TabsTrigger>
            <TabsTrigger value="help-center" className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-400 data-[state=active]:shadow-md border border-transparent data-[state=active]:border-white/5">
              <MessageSquare className="h-4 w-4" /> Suporte Técnico
            </TabsTrigger>
            <TabsTrigger value="changelog" className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-400 data-[state=active]:shadow-md border border-transparent data-[state=active]:border-white/5">
              <Sparkles className="h-4 w-4" /> Novidades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-white font-heading tracking-tight">Nova Auditoria</h2>
                    <p className="text-xs text-slate-400">Configure os parâmetros e envie os relatórios.</p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="tolerance"
                      type="number" 
                      step="0.01"
                      min="0"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-24 px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                      placeholder="Tolerância"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FileUpload 
                    label="Relatório Sistema A" 
                    selectedFile={fileA} 
                    onFileSelect={setFileA} 
                  />
                  <FileUpload 
                    label="Relatório GW" 
                    selectedFile={fileB} 
                    onFileSelect={setFileB} 
                  />
                </div>
                
                {/* Auto Mapping areas - simplified */}
                <div className="grid gap-6 md:grid-cols-2 mt-6">
                  {(columnsA.length > 0) && (
                     <div className="text-xs text-indigo-300 font-medium">Sistema A: Colunas prontas</div>
                  )}
                  {(columnsB.length > 0) && (
                     <div className="text-xs text-purple-300 font-medium">Relatório GW: Colunas prontas</div>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 border flex flex-col justify-center items-center gap-4 text-center">
                <h3 className="font-bold text-white">Pronto para auditar?</h3>
                <Button 
                  size="lg" 
                  disabled={!canAudit || isProcessing} 
                  onClick={handleAudit}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 font-bold shadow-lg"
                >
                   {isProcessing ? "Processando..." : "Iniciar Auditoria"}
                </Button>
                {results.length > 0 && (
                   <Button variant="outline" onClick={resetAudit} className="w-full text-xs text-slate-400">Limpar tudo</Button>
                )}
              </div>
            </div>

            <div className="space-y-12" id="audit-results">
              {results.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-12"
                >
                  {/* Results components remain... */}
                  <KPISection summary={summary} />
                  
                  {summary.divergencias === 0 && summary.faltantes === 0 && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-xl shadow-emerald-950/40"
                    >
                      <div className="bg-emerald-500 p-5 rounded-3xl shadow-lg shadow-emerald-500/40">
                        <CheckCircle2 className="h-10 w-10 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-3xl font-extrabold text-white font-heading tracking-tight">Auditoria 100% Conciliada!</h3>
                        <p className="text-emerald-400 font-bold text-lg">Nenhuma divergência ou CTE faltante encontrado.</p>
                      </div>
                    </motion.div>
                  )}

                  <DashboardCharts results={results} summary={summary} />

                  <Card className="border-white/10 shadow-2xl shadow-slate-950/50 rounded-3xl overflow-hidden glass-card">
                    <CardHeader className="bg-white/5 border-b border-white/10 p-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-heading text-2xl font-extrabold tracking-tight text-white">Resultados da Auditoria</CardTitle>
                          <CardDescription className="text-slate-400 font-medium">Tabela completa com batimento individual</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <AuditTable results={results} onUpdateResult={handleUpdateResult} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="help-center" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass-card p-10 rounded-3xl border border-white/10 shadow-xl shadow-slate-950/40">
              <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight">Suporte Técnico Inteligente</h2>
              <p className="text-slate-400 font-medium mt-2">Tire dúvidas sobre os relatórios carregados para auxiliar na sua análise estratégica.</p>
            </div>
            <HelpCenter results={results} summary={summary} />
          </TabsContent>

          <TabsContent value="changelog" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Changelog />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mx-auto max-w-7xl px-4 md:px-8 py-12 border-t border-white/5 mt-20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-1.5 rounded-lg">
                <Truck className="h-4 w-4 text-slate-400" />
              </div>
              <span className="text-lg font-black font-heading text-white tracking-tight">Amanda Gestão</span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-loose">© {new Date().getFullYear()} Amanda Gestão Logística. <br className="hidden sm:block" /> Todos os direitos reservados.</p>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="uppercase tracking-[0.2em] opacity-60">Criado por</span>
              <span className="font-black text-slate-300 bg-slate-800 px-2 py-0.5 rounded">Amanda Vasconcelos</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-white/5 bg-transparent">v2.4.0-build</Badge>
              <span className="text-[10px] text-slate-600 font-bold">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      </footer>
    </div>
  );
}
