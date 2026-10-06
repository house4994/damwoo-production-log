'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductionLog, Product, ProductionLogMaterial } from '@/lib/types';
import { formatNum, calculateMaterials } from '@/lib/calculator';
import ProductionSheetDocument from '@/components/ProductionSheetDocument';
import {
  ListOrdered,
  Search,
  Calendar,
  Trash2,
  Printer,
  Eye,
  Pencil,
  X,
  ArrowUpDown,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  RefreshCw,
  Files,
  Scale,
  Sparkles,
  Save,
} from 'lucide-react';

export default function ProductionLogsListPage() {
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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

  // 생산일지 수정 모달 상태
  const [editingLog, setEditingLog] = useState<ProductionLog | null>(null);
  const [editLogDate, setEditLogDate] = useState<string>('');
  const [editProductId, setEditProductId] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<number | string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editMaterialUnit, setEditMaterialUnit] = useState<'g' | 'kg'>('g');
  const [editMaterials, setEditMaterials] = useState<ProductionLogMaterial[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // 제품 목록 로드
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          capacity,
          unit,
          category_id,
          product_categories (
            id,
            name,
            sort_order
          ),
          product_ingredients (
            id,
            ingredient_name,
            ratio,
            unit,
            remarks,
            sort_order
          )
        `)
        .order('name');

      if (error) throw error;

      const raw = (data || []) as unknown as Array<{
        id: string;
        name: string;
        capacity: number | string;
        unit: string;
        category_id: string | null;
        product_categories?: { id: string; name: string } | null;
        product_ingredients?: Array<{
          id: string;
          ingredient_name: string;
          ratio: number | string;
          unit: string;
          remarks?: string | null;
          sort_order?: number;
        }>;
      }>;

      const formatted: Product[] = raw.map((p) => ({
        id: p.id,
        name: p.name,
        capacity: Number(p.capacity),
        unit: p.unit,
        category_id: p.category_id,
        category_name: p.product_categories?.name || '미분류',
        ingredients: (p.product_ingredients || []).map((ing) => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name,
          ratio: Number(ing.ratio),
          unit: ing.unit,
          remarks: ing.remarks || '',
          sort_order: ing.sort_order,
        })),
      }));

      setProducts(formatted);
    } catch (err: unknown) {
      console.error('Error fetching products:', err);
    }
  }, []);

  // 생산일지 목록 로드
  const fetchLogs = useCallback(async () => {
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

      const raw = (data || []) as unknown as Array<{
        id: string;
        log_date: string;
        product_id?: string | null;
        product_name: string;
        product_capacity: number | string;
        product_unit: string;
        quantity: number | string;
        notes?: string | null;
        created_at?: string;
        production_log_materials?: Array<{
          id: string;
          ingredient_name: string;
          unit: string;
          in_quantity: number | string;
          out_quantity: number | string;
          remarks?: string | null;
        }>;
      }>;

      const formatted: ProductionLog[] = raw.map((item) => ({
        id: item.id,
        log_date: item.log_date,
        product_id: item.product_id,
        product_name: item.product_name,
        product_capacity: Number(item.product_capacity),
        product_unit: item.product_unit,
        quantity: Number(item.quantity),
        notes: item.notes || '',
        created_at: item.created_at,
        materials: (item.production_log_materials || []).map((m) => ({
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
    } catch (err: unknown) {
      console.error('Error fetching logs:', err);
      setErrorMsg('생산일지 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, sortField, sortOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs();
  }, [fetchLogs]);

  // 제품군별 그룹화
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach((prod) => {
      const cat = prod.category_name || '기타';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(prod);
    });
    return groups;
  }, [products]);

  // 검색어 필터링
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.product_name.toLowerCase().includes(term) ||
        log.log_date.includes(term) ||
        log.notes.toLowerCase().includes(term)
      );
    });
  }, [logs, searchTerm]);

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
      !confirm(
        `선택한 ${selectedIds.length}건의 생산일지를 정말로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.from('production_logs').delete().in('id', selectedIds);
      if (error) throw error;

      alert(`${selectedIds.length}건의 생산일지가 삭제되었습니다.`);
      await fetchLogs();
    } catch (err: unknown) {
      console.error('Error deleting logs:', err);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 단일 항목 삭제
  const handleDeleteOne = async (id: string, name: string, date: string) => {
    if (!confirm(`[${date} ${name}] 생산일지를 삭제하시겠습니까?`)) {
      return;
    }
    try {
      const { error } = await supabase.from('production_logs').delete().eq('id', id);
      if (error) throw error;
      await fetchLogs();
    } catch (err: unknown) {
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

  // 수정 모달 열기 핸들러
  const handleOpenEditModal = (log: ProductionLog) => {
    setEditingLog(log);
    setEditLogDate(log.log_date);

    // 일치하는 마스터 제품 찾기
    const matchingProd = products.find(
      (p) => (log.product_id && p.id === log.product_id) || p.name === log.product_name
    );
    const prodId = matchingProd ? matchingProd.id : (products[0]?.id || '');
    setEditProductId(prodId);
    setEditQuantity(log.quantity);
    setEditNotes(log.notes || '');

    // 원재료 산출 단위 기본 설정 (첫 원재료 단위가 kg이면 kg, 아니면 g)
    const unit = log.materials?.[0]?.unit === 'kg' ? 'kg' : 'g';
    setEditMaterialUnit(unit);

    if (matchingProd) {
      const calc = calculateMaterials(matchingProd, log.quantity, unit);
      setEditMaterials(calc);
    } else if (log.materials) {
      setEditMaterials(log.materials);
    } else {
      setEditMaterials([]);
    }
  };

  // 수정 폼 내 제품 변경 핸들러
  const handleEditProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prodId = e.target.value;
    setEditProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod && Number(editQuantity) > 0) {
      const calc = calculateMaterials(prod, Number(editQuantity), editMaterialUnit);
      setEditMaterials(calc);
    }
  };

  // 수정 폼 내 수량 변경 시 원재료 자동 재계산
  useEffect(() => {
    if (!editingLog) return;
    const prod = products.find((p) => p.id === editProductId);
    const qty = Number(editQuantity);
    if (prod && qty > 0) {
      const calc = calculateMaterials(prod, qty, editMaterialUnit);
      setEditMaterials(calc);
    } else {
      setEditMaterials([]);
    }
  }, [editingLog, editProductId, editQuantity, editMaterialUnit, products]);

  // 선택된 수정 제품 객체
  const selectedEditProduct = useMemo(() => {
    return products.find((p) => p.id === editProductId) || null;
  }, [products, editProductId]);

  // 수정 내용 저장 핸들러
  const handleSaveEdit = async () => {
    if (!editingLog) return;
    if (!selectedEditProduct) {
      alert('생산 제품을 선택해주세요.');
      return;
    }
    const qtyNum = Number(editQuantity);
    if (!editQuantity || isNaN(qtyNum) || qtyNum <= 0) {
      alert('생산량을 1개 이상 입력해주세요.');
      return;
    }

    try {
      setIsSavingEdit(true);

      // 1) 생산일지 마스터 업데이트
      const { error: logErr } = await supabase
        .from('production_logs')
        .update({
          log_date: editLogDate,
          product_id: selectedEditProduct.id,
          product_name: selectedEditProduct.name,
          product_capacity: selectedEditProduct.capacity,
          product_unit: selectedEditProduct.unit,
          quantity: qtyNum,
          notes: editNotes.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingLog.id);

      if (logErr) throw logErr;

      // 2) 기존 원료수불 상세 삭제 후 신규 계산분 재등록
      await supabase.from('production_log_materials').delete().eq('log_id', editingLog.id);

      if (editMaterials.length > 0) {
        const matPayload = editMaterials.map((m) => ({
          log_id: editingLog.id,
          ingredient_name: m.ingredient_name,
          unit: m.unit,
          in_quantity: m.in_quantity,
          out_quantity: m.out_quantity,
          remarks: m.remarks || '',
        }));

        const { error: matErr } = await supabase
          .from('production_log_materials')
          .insert(matPayload);

        if (matErr) throw matErr;
      }

      alert('생산일지가 성공적으로 수정되었습니다.');
      setEditingLog(null);
      await fetchLogs();
    } catch (err: unknown) {
      console.error('Error updating log:', err);
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      alert('생산일지 수정에 실패했습니다: ' + msg);
    } finally {
      setIsSavingEdit(false);
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
          {batchPrintLogs.map((log) => (
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
                저장된 생산일지를 조회·수정하고, 여러 건을 선택해 하나의 문서로 일괄 출력할 수 있습니다.
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
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
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
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                오늘
              </button>
              <button
                onClick={() => setQuickRange('week')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                최근 7일
              </button>
              <button
                onClick={() => setQuickRange('month')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                이번달
              </button>
              <button
                onClick={() => setQuickRange('all')}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                전체
              </button>
            </div>
          </div>
        </div>

        {/* 에러 메시지 알림 */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 데이터 테이블 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                {selectedIds.length > 0 && selectedIds.length === filteredLogs.length ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>전체 선택 ({filteredLogs.length}건)</span>
              </button>
              {selectedIds.length > 0 && (
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  {selectedIds.length}건 선택됨
                </span>
              )}
            </div>

            {/* 정렬 셀렉터 */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>정렬:</span>
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [any, 'asc' | 'desc'];
                  setSortField(field);
                  setSortOrder(order);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="log_date-desc">작성일자 최신순</option>
                <option value="log_date-asc">작성일자 과거순</option>
                <option value="quantity-desc">생산량 많은순</option>
                <option value="quantity-asc">생산량 적은순</option>
                <option value="created_at-desc">등록일시 최신순</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">생산일지 목록을 불러오는 중입니다...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-24 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">저장된 생산일지가 없습니다.</p>
              <p className="text-xs text-slate-400 mt-1">
                상단 '생산일지 작성' 탭에서 새 생산일지를 등록해보세요.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold">
                    <th className="py-3 px-4 w-12 text-center">선택</th>
                    <th className="py-3 px-4 w-28">작성 일자</th>
                    <th className="py-3 px-4">생산 제품명</th>
                    <th className="py-3 px-4 w-28 text-right">포장 규격</th>
                    <th className="py-3 px-4 w-32 text-right">완제품 생산량</th>
                    <th className="py-3 px-4 hidden md:table-cell">특이사항 / 메모</th>
                    <th className="py-3 px-4 w-28 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((log) => {
                    const isSelected = selectedIds.includes(log.id);
                    return (
                      <tr
                        key={log.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 체크박스 */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(log.id)}
                            className="cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        </td>

                        {/* 작성 일자 */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {log.log_date}
                        </td>

                        {/* 제품명 */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{log.product_name}</span>
                            {log.materials && log.materials.length > 0 && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-normal">
                                원료 {log.materials.length}종
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 규격 */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                          {log.product_capacity} {log.product_unit}
                        </td>

                        {/* 생산량 */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                          {formatNum(log.quantity)}
                          <span className="text-xs font-normal text-slate-400 ml-1">개</span>
                        </td>

                        {/* 특이사항 */}
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate hidden md:table-cell">
                          {log.notes || '-'}
                        </td>

                        {/* 관리 액션 버튼들 */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 미리보기 및 인쇄 모달 */}
                            <button
                              type="button"
                              onClick={() => {
                                setModalLog(log);
                                setIsBatchModalOpen(false);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="상세보기 / 단일 인쇄"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* 수정 모달 열기 버튼 */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(log)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                              title="생산일지 수정"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* 삭제 */}
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteOne(log.id, log.product_name, log.log_date)
                              }
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
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

      {/* 3. 생산일지 수정 팝업 모달 (생산일지 작성 뷰 탑재) */}
      {editingLog && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 screen-only"
          onClick={() => setEditingLog(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">생산일지 수정</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    생산 일자, 제품 및 수량을 수정하고 원료수불부를 자동 재계산합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 폼 본문 (스크롤) */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* 작성일자 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  작성 일자
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={editLogDate}
                    onChange={(e) => setEditLogDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* 제품 선택 (제품군별 그룹화) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  생산 제품 선택
                </label>
                <div className="relative">
                  <select
                    value={editProductId}
                    onChange={handleEditProductChange}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                  >
                    {Object.entries(groupedProducts).map(([catName, prodList]) => (
                      <optgroup key={catName} label={`📁 ${catName}`}>
                        {prodList.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({prod.capacity}
                            {prod.unit})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 선택된 제품 상세 정보 뱃지 */}
                {selectedEditProduct && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                      분류: {selectedEditProduct.category_name}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                      규격: 1개당 {selectedEditProduct.capacity} {selectedEditProduct.unit}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200/60">
                      원재료: {selectedEditProduct.ingredients?.length || 0}종 구성
                    </span>
                  </div>
                )}
              </div>

              {/* 완제품 생산 수량 입력 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    완제품 생산 수량
                  </label>
                  <span className="text-xs text-slate-400 font-medium">단위: 개 / 봉</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="예: 500"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <span className="absolute right-3.5 top-2.5 text-sm font-semibold text-slate-400">
                    개
                  </span>
                </div>

                {/* 수량 퀵 추가 버튼 */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[100, 200, 500, 1000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => {
                        const cur = Number(editQuantity) || 0;
                        setEditQuantity(cur + quick);
                      }}
                      className="flex-1 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    >
                      +{quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* 원료수불부 산출 단위 토글 (g / kg) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                    <span>원료수불부 산출 단위</span>
                  </label>
                  <span className="text-[11px] text-slate-500">문서 표기 단위</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditMaterialUnit('g')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      editMaterialUnit === 'g'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    g (그램)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMaterialUnit('kg')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      editMaterialUnit === 'kg'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    kg (킬로그램)
                  </button>
                </div>
              </div>

              {/* 원료수불 자동 재계산 요약 카드 */}
              {selectedEditProduct && editMaterials.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      원료수불부 소요량 자동 재계산 결과
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                      단위: {editMaterialUnit}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {editMaterials.map((mat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-100"
                      >
                        <span className="font-semibold text-slate-800">{mat.ingredient_name}</span>
                        <div className="flex items-center gap-1 text-emerald-800">
                          <span className="font-bold text-sm">{formatNum(mat.out_quantity)}</span>
                          <span className="text-xs font-medium text-slate-500">{mat.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 특이사항 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  특이사항 (선택 입력)
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="생산 중 특이사항 또는 메모를 입력하세요"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 모달 푸터 액션 버튼 */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !selectedEditProduct || !editQuantity}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>저장하는 중...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>수정 내용 저장</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
