'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductionLog } from '@/lib/types';
import { formatNum } from '@/lib/calculator';
import { downloadHWPX } from '@/lib/hwpxExporter';
import ProductionSheetDocument from '@/components/ProductionSheetDocument';
import {
  ListOrdered,
  Search,
  Calendar,
  Trash2,
  Printer,
  FileDown,
  Eye,
  X,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  RefreshCw,
  Files,
} from 'lucide-react';

export default function ProductionLogsListPage() {
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortField, setSortField] = useState<'log_date' | 'created_at' | 'quantity'>('log_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 단일 상세 보기 및 인쇄 모달 상태
  const [modalLog, setModalLog] = useState<ProductionLog | null>(null);

  // 다중 선택 일괄 인쇄 모달 상태
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchPrintLogs, setBatchPrintLogs] = useState<ProductionLog[]>([]);

  // 데이터 로드
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      let query = supabase
        .from('production_logs')
        .select(`
          id,
          log_date,
          product_id,
          product_name,
          product_capacity,
          product_unit,
          quantity,
          notes,
          created_at,
          production_log_materials (
            id,
            ingredient_name,
            unit,
            in_quantity,
            out_quantity,
            remarks
          )
        `)
        .order(sortField, { ascending: sortOrder === 'asc' });

      if (startDate) {
        query = query.gte('log_date', startDate);
      }
      if (endDate) {
        query = query.lte('log_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: ProductionLog[] = (data || []).map((item: any) => ({
        id: item.id,
        log_date: item.log_date,
        product_id: item.product_id,
        product_name: item.product_name,
        product_capacity: Number(item.product_capacity),
        product_unit: item.product_unit,
        quantity: Number(item.quantity),
        notes: item.notes || '',
        created_at: item.created_at,
        materials: (item.production_log_materials || []).map((m: any) => ({
          id: m.id,
          ingredient_name: m.ingredient_name,
          unit: m.unit,
          in_quantity: Number(m.in_quantity),
          out_quantity: Number(m.out_quantity),
          remarks: m.remarks || '',
        })),
      }));

      setLogs(formatted);
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setErrorMsg('생산일지 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate, sortField, sortOrder]);

  // 검색어 필터링
  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.product_name.toLowerCase().includes(term) ||
      log.log_date.includes(term) ||
      log.notes.toLowerCase().includes(term)
    );
  });

  // 전체 선택/해제 토글
  const handleSelectAll = () => {
    if (selectedIds.length === filteredLogs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLogs.map((l) => l.id));
    }
  };

  // 개별 선택 토글
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 다중 선택 일괄 인쇄 열기
  const handleOpenBatchPrint = () => {
    const selected = logs.filter((l) => selectedIds.includes(l.id));
    if (selected.length === 0) return;
    setBatchPrintLogs(selected);
    setIsBatchModalOpen(true);
  };

  // 선택 항목 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(`선택한 ${selectedIds.length}건의 생산일지를 영구 삭제하시겠습니까?`)
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('production_logs')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      await fetchLogs();
    } catch (err: any) {
      console.error('Error deleting logs:', err);
      alert('삭제 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 단일 항목 삭제
  const handleDeleteOne = async (id: string, name: string, date: string) => {
    if (!confirm(`[${date}] ${name} 생산일지를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('production_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      console.error('Error deleting log:', err);
      alert('삭제 실패');
    }
  };

  // 빠른 기간 필터
  const setQuickRange = (type: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      const dStr = fmt(today);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (type === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(fmt(weekAgo));
      setEndDate(fmt(today));
    } else if (type === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(fmt(monthStart));
      setEndDate(fmt(today));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 인쇄 전용 영역: 단일 인쇄 */}
      {modalLog && (
        <div id="printable-root" className="hidden print:block">
          <ProductionSheetDocument
            logDate={modalLog.log_date}
            productName={modalLog.product_name}
            productUnit={modalLog.product_unit}
            quantity={modalLog.quantity}
            materials={modalLog.materials || []}
            notes={modalLog.notes}
            isPrintOnly={true}
          />
        </div>
      )}

      {/* 인쇄 전용 영역: 다중 선택 일괄 인쇄 (하나의 문서, 여러 페이지) */}
      {isBatchModalOpen && batchPrintLogs.length > 0 && (
        <div id="printable-root" className="hidden print:block">
          {batchPrintLogs.map((log, index) => (
            <div key={log.id} className="print-page">
              <ProductionSheetDocument
                logDate={log.log_date}
                productName={log.product_name}
                productUnit={log.product_unit}
                quantity={log.quantity}
                materials={log.materials || []}
                notes={log.notes}
                isPrintOnly={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* 화면 전용 UI */}
      <div className="screen-only space-y-6">
        {/* 상단 타이틀 및 액션 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">생산일지 보관 목록</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                저장된 생산일지를 기간별로 조회하고, 여러 건을 선택해 하나의 문서로 일괄 출력할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* 다중 선택 액션 버튼들 */}
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleOpenBatchPrint}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>선택 {selectedIds.length}건 일괄 인쇄 (다중 페이지)</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>삭제 ({selectedIds.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 필터 및 검색 바 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* 검색창 */}
            <div className="md:col-span-4 relative">
              <input
                type="text"
                placeholder="제품명 또는 특이사항 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* 기간 필터 */}
            <div className="md:col-span-5 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-slate-400 text-xs">~</span>
              <div className="relative flex-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 빠른 기간 프리셋 */}
            <div className="md:col-span-3 flex items-center gap-1.5">
              <button
                onClick={() => setQuickRange('today')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                오늘
              </button>
              <button
                onClick={() => setQuickRange('week')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                1주일
              </button>
              <button
                onClick={() => setQuickRange('month')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                이번달
              </button>
              <button
                onClick={() => setQuickRange('all')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                전체
              </button>
            </div>
          </div>
        </div>

        {/* 생산일지 테이블 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-sm">목록을 불러오는 중입니다...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">저장된 생산일지가 없습니다.</p>
              <p className="text-xs text-slate-400 mt-1">상단 '생산일지 작성'에서 새 일지를 등록해보세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4 w-12 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {selectedIds.length === filteredLogs.length && filteredLogs.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 w-28">작성 일자</th>
                    <th className="py-3 px-4">제품명</th>
                    <th className="py-3 px-4 w-28">규격 용량</th>
                    <th className="py-3 px-4 w-28 text-right">생산 수량</th>
                    <th className="py-3 px-4">특이사항</th>
                    <th className="py-3 px-4 w-36 text-center">출력 및 작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const isChecked = selectedIds.includes(log.id);
                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isChecked ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(log.id)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{log.log_date}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{log.product_name}</div>
                          {log.materials && log.materials.length > 0 && (
                            <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                              원재료: {log.materials.map((m) => m.ingredient_name).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {log.product_capacity} {log.product_unit}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            {formatNum(log.quantity)} 개
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 truncate max-w-[180px]">
                          {log.notes || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 미리보기 및 인쇄 모달 */}
                            <button
                              type="button"
                              onClick={() => {
                                setModalLog(log);
                                setIsBatchModalOpen(false);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="상세보기 / 단일 인쇄"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* HWPX 다운로드 */}
                            <button
                              type="button"
                              onClick={() =>
                                downloadHWPX({
                                  logDate: log.log_date,
                                  productName: log.product_name,
                                  productUnit: log.product_unit,
                                  quantity: log.quantity,
                                  materials: log.materials || [],
                                  notes: log.notes,
                                })
                              }
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                              title="한글(.hwpx) 다운로드"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>

                            {/* 삭제 */}
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteOne(log.id, log.product_name, log.log_date)
                              }
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 1. 단일 생산일지 상세 및 인쇄 모달 */}
      {modalLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 screen-only">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span>생산일지 상세 미리보기</span>
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    {modalLog.log_date}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalLog.product_name} ({formatNum(modalLog.quantity)}개)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF / 인쇄</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadHWPX({
                      logDate: modalLog.log_date,
                      productName: modalLog.product_name,
                      productUnit: modalLog.product_unit,
                      quantity: modalLog.quantity,
                      materials: modalLog.materials || [],
                      notes: modalLog.notes,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>한글(.hwpx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalLog(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-300 flex justify-center">
              <div className="shadow-2xl rounded max-w-[210mm] w-full">
                <ProductionSheetDocument
                  logDate={modalLog.log_date}
                  productName={modalLog.product_name}
                  productUnit={modalLog.product_unit}
                  quantity={modalLog.quantity}
                  materials={modalLog.materials || []}
                  notes={modalLog.notes}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 다중 선택 일괄 인쇄 (다중 페이지) 미리보기 모달 */}
      {isBatchModalOpen && batchPrintLogs.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 screen-only">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Files className="w-5 h-5 text-emerald-400" />
                  <span>다중 생산일지 일괄 인쇄 (총 {batchPrintLogs.length}페이지)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  선택한 {batchPrintLogs.length}건의 일지가 하나의 문서로 묶여 각 페이지별로 출력됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>전체 {batchPrintLogs.length}페이지 인쇄 시작</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 다중 페이지 스크롤 미리보기 */}
            <div className="p-6 overflow-y-auto bg-slate-400 space-y-8 flex flex-col items-center">
              {batchPrintLogs.map((log, idx) => (
                <div key={log.id} className="w-full max-w-[210mm] flex flex-col items-center">
                  <div className="w-full text-right mb-1 text-xs font-bold text-slate-700 pr-2">
                    [ {idx + 1} / {batchPrintLogs.length} 페이지 ] - {log.product_name} ({log.log_date})
                  </div>
                  <div className="shadow-2xl rounded w-full bg-white">
                    <ProductionSheetDocument
                      logDate={log.log_date}
                      productName={log.product_name}
                      productUnit={log.product_unit}
                      quantity={log.quantity}
                      materials={log.materials || []}
                      notes={log.notes}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
