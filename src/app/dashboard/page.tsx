'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, ProductCategory, ProductionLog } from '@/lib/types';
import { formatNum, roundFixed } from '@/lib/calculator';
import {
  BarChart3,
  CalendarRange,
  Layers,
  Boxes,
  Scale,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface AggregatedProduct {
  key: string;
  productId?: string | null;
  productName: string;
  categoryName: string;
  capacity: number;
  unit: string;
  totalQuantity: number;
  totalWeightKg: number;
  logCount: number;
  datesCount: number;
  percentage: number;
  logs: ProductionLog[];
}

type PeriodScope = 'monthly' | 'yearly' | 'all';
type SortField = 'productName' | 'logCount' | 'totalQuantity' | 'totalWeightKg' | 'percentage';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 15;

export default function DashboardPage() {
  // 1. 기준 오늘 날짜
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 2. 상태 관리: 기간 필터 (월별 / 연간 / 전체)
  const [periodScope, setPeriodScope] = useState<PeriodScope>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

  // 제품 및 카테고리 데이터
  const [products, setProducts] = useState<Product[]>([]);
  const [, setCategories] = useState<ProductCategory[]>([]);

  // 선택된 제품 필터 (빈 Set이면 "모든 제품 전체 집계")
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // 생산일지 원본 데이터 및 로딩
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 테이블 정렬
  const [sortField, setSortField] = useState<SortField>('totalQuantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 상세 보기 팝업 모달 상태 & 페이지네이션
  const [detailModalProduct, setDetailModalProduct] = useState<AggregatedProduct | null>(null);
  const [modalPage, setModalPage] = useState<number>(1);

  // 3. 기간 계산 (월별 / 연간 / 전체)
  const { startDate, endDate } = useMemo(() => {
    if (periodScope === 'all') {
      return { startDate: '', endDate: '' };
    }
    if (periodScope === 'yearly') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
      };
    }
    // monthly (월별)
    const monthPad = String(selectedMonth).padStart(2, '0');
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    return {
      startDate: `${selectedYear}-${monthPad}-01`,
      endDate: `${selectedYear}-${monthPad}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [periodScope, selectedYear, selectedMonth]);

  // 4. 실제 일지가 존재하는 연도 목록 조회
  const fetchAvailableYears = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('production_logs')
        .select('log_date');

      if (!error && data) {
        const yearSet = new Set<number>([currentYear]);
        data.forEach((row: { log_date?: string }) => {
          if (row.log_date) {
            const y = parseInt(row.log_date.slice(0, 4), 10);
            if (!isNaN(y)) yearSet.add(y);
          }
        });
        setAvailableYears(Array.from(yearSet).sort((a, b) => b - a));
      }
    } catch (err: unknown) {
      console.error('Failed to fetch available years:', err);
    }
  }, [currentYear]);

  // 5. 제품 및 카테고리 데이터 로드
  const fetchProductsAndCategories = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase
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
            )
          `)
          .order('name'),
        supabase
          .from('product_categories')
          .select('*')
          .order('sort_order', { ascending: true }),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      const rawProducts = (prodRes.data || []) as unknown as Array<{
        id: string;
        name: string;
        capacity: number | string;
        unit?: string | null;
        category_id?: string | null;
        product_categories?: { id: string; name: string; sort_order?: number } | null;
      }>;

      const loadedProducts: Product[] = rawProducts.map((p) => ({
        id: p.id,
        name: p.name,
        capacity: Number(p.capacity),
        unit: p.unit || 'g',
        category_id: p.category_id,
        category_name: p.product_categories?.name || '미분류',
      }));

      setProducts(loadedProducts);
      setCategories(catRes.data || []);
    } catch (err: unknown) {
      console.error('Failed to load products/categories:', err);
      setErrorMsg('제품 목록을 불러오는 중 오류가 발생했습니다.');
    }
  }, []);

  // 6. 생산일지 데이터 로드
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
          created_at
        `)
        .order('log_date', { ascending: false });

      if (startDate) {
        query = query.gte('log_date', startDate);
      }
      if (endDate) {
        query = query.lte('log_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawLogs = (data || []) as unknown as Array<{
        id: string;
        log_date: string;
        product_id?: string | null;
        product_name: string;
        product_capacity?: number | string | null;
        product_unit?: string | null;
        quantity?: number | string | null;
        notes?: string | null;
        created_at?: string;
      }>;

      const loadedLogs: ProductionLog[] = rawLogs.map((item) => ({
        id: item.id,
        log_date: item.log_date,
        product_id: item.product_id,
        product_name: item.product_name,
        product_capacity: Number(item.product_capacity || 0),
        product_unit: item.product_unit || 'g',
        quantity: Number(item.quantity || 0),
        notes: item.notes || '',
        created_at: item.created_at,
      }));

      setLogs(loadedLogs);
    } catch (err: unknown) {
      console.error('Failed to load production logs:', err);
      setErrorMsg('생산일지 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // 초기 및 변경 시 로드
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAvailableYears();
    void fetchProductsAndCategories();
  }, [fetchAvailableYears, fetchProductsAndCategories]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs();
  }, [fetchLogs]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailModalProduct) {
        setDetailModalProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailModalProduct]);

  // 7. 제품 필터 조작
  const handleAddProductFilter = (prodId: string) => {
    if (!prodId) return;
    const next = new Set(selectedProductIds);
    next.add(prodId);
    setSelectedProductIds(next);
  };

  const handleRemoveProductFilter = (prodId: string) => {
    const next = new Set(selectedProductIds);
    next.delete(prodId);
    setSelectedProductIds(next);
  };

  const handleClearProductFilter = () => {
    setSelectedProductIds(new Set());
  };

  const selectableProducts = useMemo(() => {
    return products.filter((p) => !selectedProductIds.has(p.id));
  }, [products, selectedProductIds]);

  // 8. 중량 환산 함수 (kg 기준)
  const calculateWeightInKg = (capacity: number, unit: string, quantity: number): number => {
    const cleanUnit = (unit || 'g').trim().toLowerCase();
    if (cleanUnit === 'kg' || cleanUnit === 'l') {
      return capacity * quantity;
    }
    return (capacity * quantity) / 1000;
  };

  // 9. 제품별 집계 계산
  const { aggregatedList, grandTotalQty, grandTotalWeightKg, totalLogRecords } =
    useMemo(() => {
      const hasSpecificFilter = selectedProductIds.size > 0;
      const filteredLogs = logs.filter((log) => {
        if (!hasSpecificFilter) return true;
        if (log.product_id && selectedProductIds.has(log.product_id)) return true;
        const matchingProd = products.find((p) => p.name === log.product_name);
        if (matchingProd && selectedProductIds.has(matchingProd.id)) return true;
        return false;
      });

      const groupMap = new Map<string, AggregatedProduct>();
      let sumQty = 0;
      let sumWeight = 0;

      filteredLogs.forEach((log) => {
        const masterProd = products.find(
          (p) => (log.product_id && p.id === log.product_id) || p.name === log.product_name
        );

        const key = masterProd?.id || log.product_name;
        const productName = masterProd?.name || log.product_name;
        const categoryName = masterProd?.category_name || '미분류';
        const capacity = masterProd?.capacity ?? log.product_capacity ?? 0;
        const unit = masterProd?.unit || log.product_unit || 'g';

        const weightKg = calculateWeightInKg(capacity, unit, log.quantity);
        sumQty += log.quantity;
        sumWeight += weightKg;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            productId: masterProd?.id || log.product_id,
            productName,
            categoryName,
            capacity,
            unit,
            totalQuantity: 0,
            totalWeightKg: 0,
            logCount: 0,
            datesCount: 0,
            percentage: 0,
            logs: [],
          });
        }

        const item = groupMap.get(key)!;
        item.totalQuantity += log.quantity;
        item.totalWeightKg += weightKg;
        item.logCount += 1;
        item.logs.push(log);
      });

      const list = Array.from(groupMap.values()).map((item) => {
        const prodDates = new Set(item.logs.map((l) => l.log_date));
        item.datesCount = prodDates.size;
        item.totalWeightKg = roundFixed(item.totalWeightKg, 2);
        item.percentage = sumQty > 0 ? roundFixed((item.totalQuantity / sumQty) * 100, 1) : 0;
        item.logs.sort((a, b) => b.log_date.localeCompare(a.log_date));
        return item;
      });

      return {
        aggregatedList: list,
        grandTotalQty: sumQty,
        grandTotalWeightKg: roundFixed(sumWeight, 2),
        totalLogRecords: filteredLogs.length,
      };
    }, [logs, products, selectedProductIds]);

  // 10. 정렬된 집계 목록
  const sortedAggregatedList = useMemo(() => {
    return [...aggregatedList].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [aggregatedList, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 모달 열기 핸들러
  const handleOpenDetailModal = (product: AggregatedProduct) => {
    setDetailModalProduct(product);
    setModalPage(1);
  };

  // 모달 내 페이지네이션 계산
  const modalPaginatedLogs = useMemo(() => {
    if (!detailModalProduct) return [];
    const startIndex = (modalPage - 1) * PAGE_SIZE;
    return detailModalProduct.logs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [detailModalProduct, modalPage]);

  const modalTotalPages = useMemo(() => {
    if (!detailModalProduct) return 1;
    return Math.max(1, Math.ceil(detailModalProduct.logs.length / PAGE_SIZE));
  }, [detailModalProduct]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 상단 타이틀 카드 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">생산 통계 대시보드</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              월별, 연도별, 제품별 생산량을 집계하여 실시간 누적 현황과 품목별 비중을 분석합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchAvailableYears();
              fetchProductsAndCategories();
              fetchLogs();
            }}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 에러 메시지 알림 */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 컴팩트 단일 라인 필터바 (월별 / 연간 / 전체 선택 및 드롭다운) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* 기간 필터 컨트롤: [월별][연간][전체] 버튼 + 연도 드롭다운 + 월 드롭다운 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              집계 기간:
            </span>

            {/* 3가지 동작 모드 버튼: 월별 / 연간 / 전체 */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setPeriodScope('monthly')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  periodScope === 'monthly'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                월별
              </button>
              <button
                type="button"
                onClick={() => setPeriodScope('yearly')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  periodScope === 'yearly'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                연간
              </button>
              <button
                type="button"
                onClick={() => setPeriodScope('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  periodScope === 'all'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체
              </button>
            </div>

            {/* 연도 드롭다운 (전체 모드 시 비활성화) */}
            <div className="flex items-center gap-1">
              <select
                value={selectedYear}
                disabled={periodScope === 'all'}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={`px-2.5 py-1.5 border rounded-lg font-medium transition-all ${
                  periodScope === 'all'
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer'
                }`}
                title={periodScope === 'all' ? '전체 기간 선택 중입니다' : '연도 선택'}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>

            {/* 월 드롭다운 (연간/전체 모드 시 비활성화) */}
            <div className="flex items-center gap-1">
              <select
                value={selectedMonth}
                disabled={periodScope === 'yearly' || periodScope === 'all'}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={`px-2.5 py-1.5 border rounded-lg font-medium transition-all ${
                  periodScope === 'yearly' || periodScope === 'all'
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer'
                }`}
                title={
                  periodScope === 'yearly'
                    ? '연간 전체 집계 중입니다'
                    : periodScope === 'all'
                    ? '전체 기간 집계 중입니다'
                    : '월 선택'
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>

            {/* 현재 적용 기간 텍스트 뱃지 */}
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60 hidden sm:inline-block">
              {periodScope === 'monthly' && `${selectedYear}년 ${selectedMonth}월 (당월)`}
              {periodScope === 'yearly' && `${selectedYear}년 전체 (1~12월)`}
              {periodScope === 'all' && '등록된 전체 기간'}
            </span>
          </div>

          {/* 제품 필터 드롭다운 추가 */}
          <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <span className="font-semibold text-slate-700 flex items-center gap-1 whitespace-nowrap">
              <Layers className="w-4 h-4 text-emerald-600" />
              제품 선택:
            </span>

            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddProductFilter(e.target.value);
                }
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-xs truncate cursor-pointer"
            >
              <option value="">+ 제품 선택하여 필터 추가...</option>
              {selectableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.capacity}
                  {p.unit})
                </option>
              ))}
            </select>

            {selectedProductIds.size > 0 && (
              <button
                type="button"
                onClick={handleClearProductFilter}
                className="text-xs text-slate-500 hover:text-slate-800 underline whitespace-nowrap cursor-pointer ml-1"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 선택된 제품 태그 칩 영역 */}
        {selectedProductIds.size > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 text-[11px] font-medium mr-1">
              선택된 품목 ({selectedProductIds.size}개):
            </span>
            {Array.from(selectedProductIds).map((id) => {
              const prod = products.find((p) => p.id === id);
              if (!prod) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                >
                  <span>{prod.name}</span>
                  <span className="text-emerald-500 text-[10px]">
                    ({prod.capacity}
                    {prod.unit})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProductFilter(id)}
                    className="hover:text-emerald-900 rounded-full p-0.5 cursor-pointer"
                    title="제거"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              현재 <strong>모든 제품(총 {products.length}종)</strong>의 생산량을 한눈에 집계 중입니다. 특정 제품만 보려면 드롭다운에서 선택하세요.
            </span>
          </div>
        )}
      </div>

      {/* 종합 지표 KPI 요약 카드 (총 수량 & 총 중량 2개 카드만 심플하게 구성) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 카드 1: 총 생산 수량 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              총 완제품 생산량
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{formatNum(grandTotalQty)}</span>
              <span className="text-base font-semibold text-emerald-600">개 / 봉</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">선택된 기간 내 완제품 총 생산 수량</p>
          </div>
        </div>

        {/* 카드 2: 총 생산 중량 (kg) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              총 환산 중량
            </span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{formatNum(grandTotalWeightKg)}</span>
              <span className="text-base font-semibold text-sky-600">kg</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">포장 규격을 반영한 총 생산 무게</p>
          </div>
        </div>
      </div>

      {/* 제품별 생산 집계 요약 테이블 */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>제품별 집계 현황</span>
              <span className="text-xs font-normal text-slate-500">
                (총 {sortedAggregatedList.length}개 제품)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              행 또는 [상세보기] 버튼을 누르면 해당 제품의 일자별 생산 내역 팝업을 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 테이블 본문 */}
        {isLoading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
            <p className="text-sm text-slate-500">생산 데이터를 집계하고 있습니다...</p>
          </div>
        ) : sortedAggregatedList.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">집계된 생산 데이터가 없습니다</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              선택하신 기간이나 제품 필터 조건에 해당하는 생산일지가 없습니다. 필터 기간을 조정해보세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4 sm:px-6 w-12 text-center">#</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors select-none"
                    onClick={() => toggleSort('productName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>제품명</span>
                      {sortField === 'productName' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 hidden md:table-cell">카테고리</th>
                  <th className="py-3 px-4 hidden sm:table-cell">포장 규격</th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors select-none"
                    onClick={() => toggleSort('logCount')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>생산 횟수</span>
                      {sortField === 'logCount' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors select-none"
                    onClick={() => toggleSort('totalQuantity')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>총 생산 수량 (개)</span>
                      {sortField === 'totalQuantity' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors select-none"
                    onClick={() => toggleSort('totalWeightKg')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>총 중량 (kg)</span>
                      {sortField === 'totalWeightKg' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 w-36 cursor-pointer hover:text-slate-900 transition-colors select-none"
                    onClick={() => toggleSort('percentage')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>생산 비중</span>
                      {sortField === 'percentage' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center w-24">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                {sortedAggregatedList.map((item, index) => {
                  return (
                    <tr
                      key={item.key}
                      onClick={() => handleOpenDetailModal(item)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80 group"
                    >
                      <td className="py-3.5 px-4 sm:px-6 text-center text-slate-400 font-mono text-xs">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {item.productName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-xs text-slate-600">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 hidden sm:table-cell font-mono text-xs">
                        {item.capacity} {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-mono">
                        {item.logCount}회 ({item.datesCount}일)
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 font-mono text-sm sm:text-base">
                        {formatNum(item.totalQuantity)}
                        <span className="text-xs font-normal text-emerald-700 ml-1">개</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-sky-600 font-mono">
                        {formatNum(item.totalWeightKg)}
                        <span className="text-xs font-normal text-sky-700 ml-1">kg</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                            <div
                              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(item.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-600 w-10 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetailModal(item);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>보기</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* 테이블 하단 합계 요약 푸터 */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-xs sm:text-sm text-slate-800">
                  <td colSpan={4} className="py-3.5 px-4 sm:px-6 text-slate-700">
                    선택 필터 총합계 ({sortedAggregatedList.length}개 품목)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {totalLogRecords}건
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-sm sm:text-base font-bold">
                    {formatNum(grandTotalQty)} 개
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-sky-700 text-sm sm:text-base font-bold">
                    {formatNum(grandTotalWeightKg)} kg
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">100.0%</td>
                  <td className="py-3.5 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 팝업 모달: 상품별 일자별 생산 내역 (최대 15개씩 페이지네이션 지원) */}
      {detailModalProduct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setDetailModalProduct(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900">
                    {detailModalProduct.productName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                    {detailModalProduct.categoryName}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
                    {detailModalProduct.capacity} {detailModalProduct.unit}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  해당 기간 내 총 <strong>{detailModalProduct.logs.length}건</strong>의 생산 기록이 집계되었습니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="닫기 (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 요약 바 */}
            <div className="bg-slate-50 px-5 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span>
                  누적 수량:{' '}
                  <strong className="text-emerald-700 font-mono text-sm">
                    {formatNum(detailModalProduct.totalQuantity)}개
                  </strong>
                </span>
                <span>
                  누적 중량:{' '}
                  <strong className="text-sky-700 font-mono text-sm">
                    {formatNum(detailModalProduct.totalWeightKg)}kg
                  </strong>
                </span>
                <span>
                  실제 생산 일수:{' '}
                  <strong className="text-slate-800 font-mono">
                    {detailModalProduct.datesCount}일
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>최신 생산일자 순 정렬</span>
              </div>
            </div>

            {/* 모달 테이블 본문 (스크롤) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-200 bg-slate-50/80 font-semibold">
                    <th className="py-2.5 px-3 text-left w-28">생산일자</th>
                    <th className="py-2.5 px-3 text-right w-28">생산수량</th>
                    <th className="py-2.5 px-3 text-right w-28">환산중량</th>
                    <th className="py-2.5 px-3 text-left">특이사항 / 비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {modalPaginatedLogs.map((log) => {
                    const logWeight = calculateWeightInKg(
                      log.product_capacity || detailModalProduct.capacity,
                      log.product_unit || detailModalProduct.unit,
                      log.quantity
                    );
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {log.log_date}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                          {formatNum(log.quantity)} 개
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-600 font-medium">
                          {formatNum(roundFixed(logWeight, 2))} kg
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans truncate max-w-sm">
                          {log.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모달 푸터: 15개 단위 페이지네이션 */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
              <div>
                전체 <strong>{detailModalProduct.logs.length}</strong>건 중{' '}
                <span className="font-mono">
                  {(modalPage - 1) * PAGE_SIZE + 1} ~{' '}
                  {Math.min(modalPage * PAGE_SIZE, detailModalProduct.logs.length)}
                </span>
                건 표시
              </div>

              {/* 페이지네이션 버튼 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalPage((prev) => Math.max(1, prev - 1))}
                  disabled={modalPage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>이전</span>
                </button>

                <span className="font-medium text-slate-700 px-2">
                  <span className="text-emerald-700 font-bold">{modalPage}</span> / {modalTotalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setModalPage((prev) => Math.min(modalTotalPages, prev + 1))}
                  disabled={modalPage >= modalTotalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>다음</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
