import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, AlertTriangle, Edit, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { AuditResult } from '@/src/types';
import { cn } from '@/lib/utils';

interface AuditTableProps {
  results: AuditResult[];
  onUpdateResult?: (updatedResult: AuditResult) => void;
}

export const AuditTable: React.FC<AuditTableProps> = ({ results, onUpdateResult }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [editingCte, setEditingCte] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    freteEmpresaA?: number;
    freteMotoristaA?: number;
    freteEmpresaB?: number;
    freteMotoristaB?: number;
  }>({});

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchesSearch = r.cte.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const isDivergent = r.status === 'BOTH_DIVERGENT' || r.status === 'A_ONLY' || r.status === 'B_ONLY';
      const matchesDivergentToggle = !onlyDivergent || isDivergent;
      
      return matchesSearch && matchesStatus && matchesDivergentToggle;
    });
  }, [results, searchTerm, statusFilter, onlyDivergent]);

  const handleStartEdit = (result: AuditResult) => {
    setEditingCte(result.cte);
    setEditValues({
      freteEmpresaA: result.sistemaA?.freteEmpresa,
      freteMotoristaA: result.sistemaA?.freteMotorista,
      freteEmpresaB: result.sistemaB?.freteEmpresa,
      freteMotoristaB: result.sistemaB?.freteMotorista,
    });
  };

  const handleSaveEdit = (result: AuditResult) => {
    if (!onUpdateResult) return;

    const updatedResult: AuditResult = {
      ...result,
      sistemaA: result.sistemaA ? {
        ...result.sistemaA,
        freteEmpresa: editValues.freteEmpresaA ?? result.sistemaA.freteEmpresa,
        freteMotorista: editValues.freteMotoristaA ?? result.sistemaA.freteMotorista,
      } : undefined,
      sistemaB: result.sistemaB ? {
        ...result.sistemaB,
        freteEmpresa: editValues.freteEmpresaB ?? result.sistemaB.freteEmpresa,
        freteMotorista: editValues.freteMotoristaB ?? result.sistemaB.freteMotorista,
      } : undefined,
    };

    // Recalculate differences and status
    const itemA = updatedResult.sistemaA;
    const itemB = updatedResult.sistemaB;

    if (itemA && itemB) {
      const diffEmpresa = Math.abs(itemA.freteEmpresa - itemB.freteEmpresa);
      const diffMotorista = Math.abs(itemA.freteMotorista - itemB.freteMotorista);
      
      const diffEmpresaRounded = Math.round(diffEmpresa * 100) / 100;
      const diffMotoristaRounded = Math.round(diffMotorista * 100) / 100;

      updatedResult.status = (diffEmpresaRounded > 0.00 || diffMotoristaRounded > 0.00) ? 'BOTH_DIVERGENT' : 'BOTH_MATCH';
      updatedResult.diferencaMotorista = itemA.freteMotorista - itemB.freteMotorista;
      updatedResult.divergencias = {
        ...updatedResult.divergencias,
        freteEmpresa: diffEmpresaRounded > 0.00 ? diffEmpresaRounded : undefined,
        freteMotorista: diffMotoristaRounded > 0.00 ? diffMotoristaRounded : undefined,
      };
    }

    onUpdateResult(updatedResult);
    setEditingCte(null);
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val?: number) => {
    if (val === undefined) return '-';
    return `${val.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6 p-8 glass-card rounded-[2rem] border border-white/10 shadow-xl shadow-slate-950/40">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <Input
            placeholder="Pesquisar por Número do CTE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 rounded-2xl h-14 focus-visible:ring-4 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 transition-all font-bold text-white placeholder:text-slate-500 shadow-inner"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant={onlyDivergent ? "destructive" : "outline"}
            size="lg"
            onClick={() => setOnlyDivergent(!onlyDivergent)}
            className={cn(
              "rounded-2xl h-14 px-8 transition-all font-extrabold uppercase tracking-widest text-[10px] shadow-sm",
              !onlyDivergent && "border-white/10 text-slate-400 hover:bg-white/5 hover:text-indigo-400 hover:border-indigo-500/30 bg-white/5"
            )}
          >
            <AlertTriangle className={cn("mr-2 h-4 w-4", onlyDivergent ? "text-white" : "text-rose-500")} />
            {onlyDivergent ? "Divergências" : "Toda Auditoria"}
          </Button>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[260px] bg-white/5 border-white/10 rounded-2xl h-14 font-extrabold text-[10px] uppercase tracking-widest text-slate-400 shadow-sm focus:ring-4 focus:ring-indigo-500/20">
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-slate-500" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-white/10 bg-slate-900 shadow-2xl">
              <SelectItem value="ALL" className="font-bold py-3 text-slate-300">Todos os Status</SelectItem>
              <SelectItem value="BOTH_MATCH" className="font-bold py-3 text-emerald-400">Conciliados</SelectItem>
              <SelectItem value="BOTH_DIVERGENT" className="font-bold py-3 text-rose-400">Divergentes</SelectItem>
              <SelectItem value="A_ONLY" className="font-bold py-3 text-amber-400">Apenas Relatório Sistema A</SelectItem>
              <SelectItem value="B_ONLY" className="font-bold py-3 text-blue-400">Apenas Relatório GW</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-white/10 shadow-2xl shadow-slate-950/50 rounded-[2rem] overflow-hidden glass-card">
        <div className="max-h-[700px] overflow-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <Table>
            <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-xl">
              <TableRow className="hover:bg-transparent border-b border-white/10">
                <TableHead className="w-[140px] font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6 pl-8">CTE</TableHead>
                <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Status</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Empresa (Rel. A)</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Empresa (GW)</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Motorista (Rel. A)</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Motorista (GW)</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6">Dif. Motorista</TableHead>
                <TableHead className="text-right font-black text-slate-500 uppercase text-[10px] tracking-[0.2em] py-6 pr-8">Margem (GW)</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredResults.map((result, index) => {
                  const isEditing = editingCte === result.cte;
                  const isCritical = result.sistemaA?.freteMotorista === 0 && (result.sistemaB?.freteMotorista || 0) > 0;
                  
                  return (
                    <motion.tr 
                      key={result.cte}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.015, 0.4) }}
                      className={cn(
                        "transition-all duration-300 group border-b border-white/5 data-grid-row",
                        result.status === 'BOTH_DIVERGENT' && "bg-rose-500/5 hover:bg-rose-500/10",
                        (result.status === 'A_ONLY' || result.status === 'B_ONLY') && "bg-amber-500/5 hover:bg-amber-500/10",
                        isEditing && "bg-indigo-500/10 ring-2 ring-inset ring-indigo-500/20",
                        isCritical && "bg-rose-500/20 hover:bg-rose-500/30"
                      )}
                    >
                      <TableCell className="font-mono font-black text-slate-300 text-[13px] py-5 pl-8">
                        <div className="flex flex-col">
                          <span>{result.cte}</span>
                          {result.fuzzyMatch && (
                            <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider mt-1 bg-indigo-500/10 w-fit px-1.5 rounded">Sugestão</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.status === 'A_ONLY' && <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] font-black uppercase tracking-wider px-3 rounded-xl">RELATÓRIO SISTEMA A</Badge>}
                        {result.status === 'B_ONLY' && <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-[10px] font-black uppercase tracking-wider px-3 rounded-xl">RELATÓRIO GW</Badge>}
                        {result.status === 'BOTH_DIVERGENT' && (
                          <Badge variant="destructive" className={cn("text-[10px] font-black uppercase tracking-wider px-3 rounded-xl shadow-lg shadow-rose-900/40", isCritical && "animate-pulse")}>
                            {isCritical ? "CRÍTICO" : "DIVERGENTE"}
                          </Badge>
                        )}
                        {result.status === 'BOTH_MATCH' && <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black uppercase tracking-wider px-3 rounded-xl">OK</Badge>}
                      </TableCell>
                      
                      {/* Empresa (A) */}
                      <TableCell className={cn("text-right font-mono text-[13px] py-5", result.divergencias.freteEmpresa ? "text-rose-400 font-extrabold" : "text-slate-400")}>
                        {isEditing && result.sistemaA ? (
                          <Input 
                            type="number" 
                            value={editValues.freteEmpresaA} 
                            onChange={(e) => setEditValues({...editValues, freteEmpresaA: parseFloat(e.target.value)})}
                            className="h-10 w-28 text-right ml-auto font-mono text-xs border-white/10 focus-visible:ring-indigo-500/20 rounded-xl bg-slate-800 text-white"
                          />
                        ) : formatCurrency(result.sistemaA?.freteEmpresa)}
                      </TableCell>
                      
                      {/* Empresa (B) */}
                      <TableCell className={cn("text-right font-mono text-[13px] py-5", result.divergencias.freteEmpresa ? "text-rose-400 font-extrabold" : "text-slate-400")}>
                        {isEditing && result.sistemaB ? (
                          <Input 
                            type="number" 
                            value={editValues.freteEmpresaB} 
                            onChange={(e) => setEditValues({...editValues, freteEmpresaB: parseFloat(e.target.value)})}
                            className="h-10 w-28 text-right ml-auto font-mono text-xs border-white/10 focus-visible:ring-indigo-500/20 rounded-xl bg-slate-800 text-white"
                          />
                        ) : formatCurrency(result.sistemaB?.freteEmpresa)}
                      </TableCell>
                      
                      {/* Motorista (A) */}
                      <TableCell className={cn("text-right font-mono text-[13px] py-5", result.divergencias.freteMotorista ? "text-rose-400 font-extrabold" : "text-slate-400")}>
                        {isEditing && result.sistemaA ? (
                          <Input 
                            type="number" 
                            value={editValues.freteMotoristaA} 
                            onChange={(e) => setEditValues({...editValues, freteMotoristaA: parseFloat(e.target.value)})}
                            className="h-10 w-28 text-right ml-auto font-mono text-xs border-white/10 focus-visible:ring-indigo-500/20 rounded-xl bg-slate-800 text-white"
                          />
                        ) : formatCurrency(result.sistemaA?.freteMotorista)}
                      </TableCell>
                      
                      {/* Motorista (B) */}
                      <TableCell className={cn("text-right font-mono text-[13px] py-5", result.divergencias.freteMotorista ? "text-rose-400 font-extrabold" : "text-slate-400")}>
                        {isEditing && result.sistemaB ? (
                          <Input 
                            type="number" 
                            value={editValues.freteMotoristaB} 
                            onChange={(e) => setEditValues({...editValues, freteMotoristaB: parseFloat(e.target.value)})}
                            className="h-10 w-28 text-right ml-auto font-mono text-xs border-white/10 focus-visible:ring-indigo-500/20 rounded-xl bg-slate-800 text-white"
                          />
                        ) : formatCurrency(result.sistemaB?.freteMotorista)}
                      </TableCell>

                      <TableCell className={cn("text-right font-mono font-black text-[13px] py-5", Math.abs(result.diferencaMotorista) > 0.01 ? "text-rose-400" : "text-emerald-500")}>
                        {formatCurrency(result.diferencaMotorista)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono font-black text-[13px] py-5 pr-8", (result.sistemaB?.margem || 0) < 0 ? "text-rose-400" : "text-slate-500")}>
                        {formatPercent(result.sistemaB?.margem)}
                      </TableCell>
                      
                      <TableCell className="pr-6">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-emerald-400 hover:bg-emerald-500/10 rounded-xl" onClick={() => handleSaveEdit(result)}>
                              <CheckCircle2 className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-rose-400 hover:bg-rose-500/10 rounded-xl" onClick={() => setEditingCte(null)}>
                              <X className="h-5 w-5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-600 hover:text-indigo-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all rounded-xl" onClick={() => handleStartEdit(result)}>
                            <Edit className="h-5 w-5" />
                          </Button>
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filteredResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-60 text-center text-slate-600 font-bold">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-5 bg-white/5 rounded-3xl">
                        <Search className="h-10 w-10 opacity-20 text-white" />
                      </div>
                      <span className="text-lg opacity-60">Nenhum registro encontrado</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
