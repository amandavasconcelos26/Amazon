import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ColumnMapping } from '@/src/types';

interface ColumnMapperProps {
  columns: string[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  title: string;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ columns, mapping, onMappingChange, title }) => {
  const handleChange = (key: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [key]: value });
  };

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner">
      {title && <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h3>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Coluna CTE</Label>
          <Select value={mapping.cte} onValueChange={(v) => handleChange('cte', v)}>
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white rounded-xl h-10 shadow-sm focus:ring-amber-500/20">
              <SelectValue placeholder="Selecione a coluna" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200 rounded-xl">
              {columns.map(col => <SelectItem key={col} value={col} className="focus:bg-amber-500/20 focus:text-white rounded-lg">{col}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Coluna Frete Empresa</Label>
          <Select value={mapping.freteEmpresa} onValueChange={(v) => handleChange('freteEmpresa', v)}>
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white rounded-xl h-10 shadow-sm focus:ring-amber-500/20">
              <SelectValue placeholder="Selecione a coluna" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200 rounded-xl">
              {columns.map(col => <SelectItem key={col} value={col} className="focus:bg-amber-500/20 focus:text-white rounded-lg">{col}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Coluna Frete Motorista</Label>
          <Select value={mapping.freteMotorista} onValueChange={(v) => handleChange('freteMotorista', v)}>
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white rounded-xl h-10 shadow-sm focus:ring-amber-500/20">
              <SelectValue placeholder="Selecione a coluna" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200 rounded-xl">
              {columns.map(col => <SelectItem key={col} value={col} className="focus:bg-amber-500/20 focus:text-white rounded-lg">{col}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Coluna Margem</Label>
          <Select value={mapping.margem} onValueChange={(v) => handleChange('margem', v)}>
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white rounded-xl h-10 shadow-sm focus:ring-amber-500/20">
              <SelectValue placeholder="Selecione a coluna" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200 rounded-xl">
              {columns.map(col => <SelectItem key={col} value={col} className="focus:bg-amber-500/20 focus:text-white rounded-lg">{col}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Coluna Peso (Ton/Kg)</Label>
          <Select value={mapping.peso} onValueChange={(v) => handleChange('peso', v)}>
            <SelectTrigger className="bg-slate-900/50 border-white/10 text-white rounded-xl h-10 shadow-sm focus:ring-amber-500/20">
              <SelectValue placeholder="Selecione a coluna" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-slate-200 rounded-xl">
              {columns.map(col => <SelectItem key={col} value={col} className="focus:bg-amber-500/20 focus:text-white rounded-lg">{col}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
