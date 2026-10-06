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
  CalendarDays,
  Award,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Info,
  X,
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

type SortField = 'productName' | 'logCount' | 'totalQuantity' | 'totalWeightKg' | 'percentage';
type SortOrder = 'asc' | 'desc';

export default function DashboardPage() {
  // 1. 기준 오늘 날짜 및 기본 월 계산
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const defaultFirstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const defaultLastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  // 2. 상태 관리: 기간 필터 (드롭다운 & 달력 & 프리셋 통합)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all' | 'custom'>(currentMonth);
  const [startDate, setStartDate] = useState<string>(defaultFirstDay);
  const [endDate, setEndDate] = useState<string>(defaultLastDay);

  // 제품 및 카테고리 데이터
  const [products, setProducts] = useState<Product[]>([]);
  const [, setCategories] = useState<ProductCategory[]>([]);

  // 선택된 제품 필터 (빈 Set이면 "모든 제품 전체 집계")
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // 생산일지 원본 데이터 및 로딩
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 테이블 정렬 및 아코디언 펼침
  const [sortField, setSortField] = useState<SortField>('totalQuantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // 3. 연도 목록 (최근 5년 및 로그에 존재하는 연도)
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
    logs.forEach((log) => {
      if (log.log_date) {
        const y = parseInt(log.log_date.slice(0, 4), 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs, currentYear]);

  // 4. 제품 및 카테고리 데이터 로드
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

  // 5. 생산일지 데이터 로드
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
    void fetchProductsAndCategories();
  }, [fetchProductsAndCategories]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs();
  }, [fetchLogs]);

  // 6. 연도 / 월 드롭다운 조작 핸들러
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (selectedMonth === 'all') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (typeof selectedMonth === 'number') {
      const start = `${year}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(year, selectedMonth, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(lastDay);
    }
  };

  const handleMonthChange = (month: number | 'all') => {
    setSelectedMonth(month);
    if (month === 'all') {
      setStartDate(`${selectedYear}-01-01`);
      setEndDate(`${selectedYear}-12-31`);
    } else {
      const start = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, month, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(lastDay);
    }
  };

  // 빠른 프리셋 버튼 핸들러
  const handlePresetCurrentMonth = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(lastDay);
  };

  const handlePresetPreviousMonth = () => {
    const prevDate = new Date(currentYear, currentMonth - 2, 1);
    const pYear = prevDate.getFullYear();
    const pMonth = prevDate.getMonth() + 1;
    setSelectedYear(pYear);
    setSelectedMonth(pMonth);
    const start = `${pYear}-${String(pMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(pYear, pMonth, 0).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(lastDay);
  };

  const handlePresetCurrentYear = () => {
    setSelectedYear(currentYear);
    setSelectedMonth('all');
    setStartDate(`${currentYear}-01-01`);
    setEndDate(`${currentYear}-12-31`);
  };

  const handlePresetAllTime = () => {
    setSelectedMonth('all');
    setStartDate('');
    setEndDate('');
  };

  // 7. 제품 필터 드롭다운 조작
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

  // 드롭다운에 추가 가능한 미선택 제품 목록
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

  // 9. 제품별 집계 및 종합 KPI 계산
  const { aggregatedList, grandTotalQty, grandTotalWeightKg, totalProductionDays, totalLogRecords, topProduct } =
    useMemo(() => {
      // 1) 선택된 제품 필터링 (선택된 ID가 없으면 '전체 제품' 집계)
      const hasSpecificFilter = selectedProductIds.size > 0;
      const filteredLogs = logs.filter((log) => {
        if (!hasSpecificFilter) return true;
        if (log.product_id && selectedProductIds.has(log.product_id)) return true;
        const matchingProd = products.find((p) => p.name === log.product_name);
        if (matchingProd && selectedProductIds.has(matchingProd.id)) return true;
        return false;
      });

      // 2) 제품별 그룹화
      const groupMap = new Map<string, AggregatedProduct>();
      const allDistinctDates = new Set<string>();

      let sumQty = 0;
      let sumWeight = 0;

      filteredLogs.forEach((log) => {
        if (log.log_date) allDistinctDates.add(log.log_date);

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

      // 3) 고유 생산일수 및 비중 계산
      const list = Array.from(groupMap.values()).map((item) => {
        const prodDates = new Set(item.logs.map((l) => l.log_date));
        item.datesCount = prodDates.size;
        item.totalWeightKg = roundFixed(item.totalWeightKg, 2);
        item.percentage = sumQty > 0 ? roundFixed((item.totalQuantity / sumQty) * 100, 1) : 0;
        item.logs.sort((a, b) => b.log_date.localeCompare(a.log_date));
        return item;
      });

      // 최다 생산 품목 찾기
      const sortedByQty = [...list].sort((a, b) => b.totalQuantity - a.totalQuantity);
      const top = sortedByQty.length > 0 ? sortedByQty[0] : null;

      return {
        aggregatedList: list,
        grandTotalQty: sumQty,
        grandTotalWeightKg: roundFixed(sumWeight, 2),
        totalProductionDays: allDistinctDates.size,
        totalLogRecords: filteredLogs.length,
        topProduct: top,
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

  const toggleExpand = (key: string) => {
    const next = new Set(expandedProducts);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedProducts(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 상단 타이틀 카드 (기존 스타일 통일) */}
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

      {/* 단순하고 컴팩트한 단일 라인 필터바 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* 기간 필터 컨트롤: 연도 드롭다운 + 월 드롭다운 + 달력 + 프리셋 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              집계 기간:
            </span>

            {/* 연도 드롭다운 */}
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            {/* 월 드롭다운 */}
            <select
              value={selectedMonth}
              onChange={(e) =>
                handleMonthChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">연간 전체</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>

            {/* 직접 달력 선택 */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedMonth('custom');
                }}
                className="bg-transparent text-slate-700 text-xs font-medium focus:outline-none"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedMonth('custom');
                }}
                className="bg-transparent text-slate-700 text-xs font-medium focus:outline-none"
              />
            </div>

            {/* 빠른 프리셋 버튼 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePresetCurrentMonth}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedYear === currentYear && selectedMonth === currentMonth
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                이번달
              </button>
              <button
                type="button"
                onClick={handlePresetPreviousMonth}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                지난달
              </button>
              <button
                type="button"
                onClick={handlePresetCurrentYear}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedYear === currentYear && selectedMonth === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                올해
              </button>
              <button
                type="button"
                onClick={handlePresetAllTime}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  !startDate && !endDate
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                전체
              </button>
            </div>
          </div>

          {/* 제품 필터 드롭다운 추가 인터페이스 */}
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

      {/* 종합 지표 KPI 요약 카드 (Light Mode 통일) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 카드 1: 총 생산 수량 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              총 완제품 생산량
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{formatNum(grandTotalQty)}</span>
              <span className="text-sm font-semibold text-emerald-600">개 / 봉</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">선택 기간 내 완제품 총 수량</p>
          </div>
        </div>

        {/* 카드 2: 총 생산 중량 (kg) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              총 환산 중량
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{formatNum(grandTotalWeightKg)}</span>
              <span className="text-sm font-semibold text-sky-600">kg</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">포장 규격 기준 총 생산 무게</p>
          </div>
        </div>

        {/* 카드 3: 생산 가동 일수 및 건수 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-violet-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              가동 일수 / 기록 건수
            </span>
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
              <span>{totalProductionDays}</span>
              <span className="text-sm font-semibold text-violet-600">일</span>
              <span className="text-xs font-normal text-slate-400 ml-1">
                (총 {totalLogRecords}건)
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">실제 생산이 기록된 누적 일수</p>
          </div>
        </div>

        {/* 카드 4: 최다 생산 품목 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              최다 생산 품목
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {topProduct ? (
              <>
                <div
                  className="text-base sm:text-lg font-bold text-slate-900 truncate"
                  title={topProduct.productName}
                >
                  {topProduct.productName}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5 text-xs">
                  <span className="font-semibold text-amber-600">
                    {formatNum(topProduct.totalQuantity)}개
                  </span>
                  <span className="text-slate-400">({topProduct.percentage}%)</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-400 mt-2">생산 내역 없음</div>
            )}
            <p className="mt-1 text-xs text-slate-400">선택 기간 최다 생산 1위 제품</p>
          </div>
        </div>
      </div>

      {/* 제품별 생산 집계 요약 및 상세 내역 테이블 (Light Mode 통일) */}
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
              각 제품 행을 클릭하면 해당 기간의 일자별 생산 상세 내역을 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 테이블 영역 */}
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
                  <th className="py-3 px-4 text-center w-16">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700">
                {sortedAggregatedList.map((item, index) => {
                  const isExpanded = expandedProducts.has(item.key);
                  return (
                    <React.Fragment key={item.key}>
                      <tr
                        onClick={() => toggleExpand(item.key)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 sm:px-6 text-center text-slate-400 font-mono text-xs">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{item.productName}</span>
                            {index === 0 && sortField === 'totalQuantity' && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-normal">
                                1위
                              </span>
                            )}
                          </div>
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
                              toggleExpand(item.key);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* 아코디언 펼침: 일자별 생산 상세 내역 서브 테이블 (Light Mode) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-sm">
                              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 text-slate-800 font-medium">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>
                                    <strong>{item.productName}</strong> 일자별 생산 내역 ({item.logs.length}건)
                                  </span>
                                </div>
                                <span className="text-slate-500 text-[11px]">
                                  누적: {formatNum(item.totalQuantity)}개 ({formatNum(item.totalWeightKg)}kg)
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-100 bg-slate-50/50">
                                      <th className="py-2 px-3 text-left">생산일자</th>
                                      <th className="py-2 px-3 text-right">생산수량</th>
                                      <th className="py-2 px-3 text-right">환산중량</th>
                                      <th className="py-2 px-3 text-left">특이사항 / 비고</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono">
                                    {item.logs.map((log) => {
                                      const logWeight = calculateWeightInKg(
                                        log.product_capacity || item.capacity,
                                        log.product_unit || item.unit,
                                        log.quantity
                                      );
                                      return (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 text-slate-700 font-medium">
                                            {log.log_date}
                                          </td>
                                          <td className="py-2 px-3 text-right text-emerald-600 font-bold">
                                            {formatNum(log.quantity)} 개
                                          </td>
                                          <td className="py-2 px-3 text-right text-sky-600">
                                            {formatNum(roundFixed(logWeight, 2))} kg
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 font-sans truncate max-w-xs">
                                            {log.notes || '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* 테이블 하단 합계 요약 푸터 (Light Mode) */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-xs sm:text-sm text-slate-800">
                  <td colSpan={4} className="py-3.5 px-4 sm:px-6 text-slate-700">
                    선택 필터 총합계 ({sortedAggregatedList.length}개 품목)
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    {totalLogRecords}회 ({totalProductionDays}일)
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
    </div>
  );
}
