'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, ProductCategory, ProductionLog } from '@/lib/types';
import { formatNum, roundFixed } from '@/lib/calculator';
import {
  BarChart3,
  Layers,
  Boxes,
  Scale,
  CalendarDays,
  Award,
  ChevronDown,
  ChevronUp,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Info,
  CalendarRange,
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

  // 2. 상태 관리
  // 기간 필터 모드: 'month' (연도/월 선택) | 'custom' (직접 입력)
  const [filterMode, setFilterMode] = useState<'month' | 'custom'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);

  const [startDate, setStartDate] = useState<string>(defaultFirstDay);
  const [endDate, setEndDate] = useState<string>(defaultLastDay);

  // 제품 및 카테고리 데이터
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState<boolean>(true);

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

      // 기본적으로 모든 제품 선택
      const allIds = new Set<string>(loadedProducts.map((p) => p.id));
      setSelectedProductIds(allIds);
      setIsAllSelected(true);
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

  // 6. 프리셋 버튼 동작 핸들러
  const handlePresetCurrentMonth = () => {
    setFilterMode('month');
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    const start = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(lastDay);
  };

  const handlePresetPreviousMonth = () => {
    setFilterMode('month');
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
    setFilterMode('month');
    setSelectedYear(currentYear);
    setSelectedMonth('all');
    setStartDate(`${currentYear}-01-01`);
    setEndDate(`${currentYear}-12-31`);
  };

  const handlePresetAllTime = () => {
    setFilterMode('custom');
    setStartDate('');
    setEndDate('');
  };

  // 연도/월 모드 변경 핸들러
  const handleYearMonthChange = (year: number, month: number | 'all') => {
    setSelectedYear(year);
    setSelectedMonth(month);
    if (month === 'all') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(lastDay);
    }
  };

  // 7. 제품 필터링 동작
  const handleToggleProduct = (prodId: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(prodId)) {
      next.delete(prodId);
    } else {
      next.add(prodId);
    }
    setSelectedProductIds(next);
    setIsAllSelected(next.size === products.length);
  };

  const handleSelectAllProducts = () => {
    const all = new Set(products.map((p) => p.id));
    setSelectedProductIds(all);
    setIsAllSelected(true);
  };

  const handleDeselectAllProducts = () => {
    setSelectedProductIds(new Set());
    setIsAllSelected(false);
  };

  // 검색 및 카테고리로 필터링된 제품 칩 목록
  const displayedFilterProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'all' ||
        p.category_id === selectedCategory ||
        (!p.category_id && selectedCategory === 'uncategorized');
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, productSearch]);

  // 8. 중량 환산 함수 (kg 기준)
  const calculateWeightInKg = (capacity: number, unit: string, quantity: number): number => {
    const cleanUnit = (unit || 'g').trim().toLowerCase();
    if (cleanUnit === 'kg' || cleanUnit === 'l') {
      return capacity * quantity;
    }
    // 기본 g, ml -> kg 환산
    return (capacity * quantity) / 1000;
  };

  // 9. 제품별 집계 및 종합 KPI 계산
  const { aggregatedList, grandTotalQty, grandTotalWeightKg, totalProductionDays, totalLogRecords, topProduct } =
    useMemo(() => {
      // 1) 선택된 제품 필터링
      const filteredLogs = logs.filter((log) => {
        if (isAllSelected) return true;
        if (log.product_id && selectedProductIds.has(log.product_id)) return true;
        // 제품 ID가 등록되어 있지 않은 기존 일지의 경우 이름으로 매칭 시도
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

        // 일치하는 마스터 제품 찾기
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
        // 내부 일자별 로그는 최신 일자순 정렬
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
    }, [logs, products, selectedProductIds, isAllSelected]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                생산 통계 대시보드
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">
              월별, 연도별, 제품별 생산량을 집계하여 실시간 누적 현황과 품목별 비중을 분석합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchProductsAndCategories();
                fetchLogs();
              }}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>데이터 새로고침</span>
            </button>
          </div>
        </div>

        {/* 에러 메시지 알림 */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            <Info className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 필터 컨트롤 패널 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          {/* 기간 필터 영역 */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <CalendarRange className="w-4 h-4 text-emerald-400" />
                <span>집계 기간 설정</span>
                <span className="text-xs font-normal text-slate-400 ml-1">
                  ({startDate || '시작'} ~ {endDate || '현재'})
                </span>
              </div>

              {/* 빠른 기간 프리셋 버튼 */}
              <div className="flex items-center flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handlePresetCurrentMonth}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filterMode === 'month' && selectedYear === currentYear && selectedMonth === currentMonth
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  이번 달
                </button>
                <button
                  type="button"
                  onClick={handlePresetPreviousMonth}
                  className="px-3 py-1.5 rounded-lg font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                >
                  지난 달
                </button>
                <button
                  type="button"
                  onClick={handlePresetCurrentYear}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filterMode === 'month' && selectedYear === currentYear && selectedMonth === 'all'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  올해 전체 ({currentYear}년)
                </button>
                <button
                  type="button"
                  onClick={handlePresetAllTime}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    !startDate && !endDate
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  전체 기간
                </button>
              </div>
            </div>

            {/* 필터 모드 탭 (연도/월 선택 vs 자유 기간 선택) */}
            <div className="flex border-b border-slate-800 mb-4">
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                  filterMode === 'month'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                연도 / 월 간편 선택
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('custom')}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                  filterMode === 'custom'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                자유 기간 직접 지정 (달력)
              </button>
            </div>

            {/* 모드 1: 연도 및 월 선택 UI */}
            {filterMode === 'month' && (
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-medium">연도 선택:</span>
                  <div className="flex items-center gap-1.5">
                    {availableYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => handleYearMonthChange(y, selectedMonth)}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                          selectedYear === y
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {y}년
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-slate-400 font-medium mr-1">월 선택:</span>
                  <button
                    type="button"
                    onClick={() => handleYearMonthChange(selectedYear, 'all')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                      selectedMonth === 'all'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                    }`}
                  >
                    연간 전체
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleYearMonthChange(selectedYear, m)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                        selectedMonth === m
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {m}월
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 모드 2: 자유 기간 직접 지정 (달력) */}
            {filterMode === 'custom' && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="text-xs text-slate-400 font-medium whitespace-nowrap">시작일:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-slate-500 hidden sm:inline">~</span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <label className="text-xs text-slate-400 font-medium whitespace-nowrap">종료일:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 underline sm:ml-auto"
                  >
                    기간 초기화 (전체)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 제품 다중 선택 및 검색 필터 */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>제품 필터</span>
                <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                  {selectedProductIds.size} / {products.length} 품목 선택됨
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllProducts}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all font-medium"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllProducts}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all font-medium"
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  전체 해제
                </button>
              </div>
            </div>

            {/* 제품 검색 및 카테고리 필터 */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="제품명 검색..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* 카테고리 탭 */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all font-medium ${
                    selectedCategory === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  전체 카테고리
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all font-medium ${
                      selectedCategory === c.id
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 제품 선택 칩 리스트 */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              {displayedFilterProducts.length === 0 ? (
                <div className="text-xs text-slate-500 py-2 px-1">검색 조건에 일치하는 제품이 없습니다.</div>
              ) : (
                displayedFilterProducts.map((p) => {
                  const isChecked = selectedProductIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleToggleProduct(p.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all font-medium border ${
                        isChecked
                          ? 'bg-emerald-950/70 border-emerald-600/70 text-emerald-300 shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded flex items-center justify-center border text-[9px] ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isChecked && '✓'}
                      </div>
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-500">
                        ({p.capacity}{p.unit})
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 종합 지표 KPI 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 카드 1: 총 생산 수량 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 p-5 shadow-lg group hover:border-emerald-500/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                총 완제품 생산량
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                <span>{formatNum(grandTotalQty)}</span>
                <span className="text-sm font-semibold text-emerald-400">개 / 봉</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                선택 기간 내 완제품 총 수량
              </p>
            </div>
          </div>

          {/* 카드 2: 총 생산 중량 (kg) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 p-5 shadow-lg group hover:border-sky-500/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                총 환산 중량
              </span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                <span>{formatNum(grandTotalWeightKg)}</span>
                <span className="text-sm font-semibold text-sky-400">kg</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                포장 규격 기준 총 생산 무게
              </p>
            </div>
          </div>

          {/* 카드 3: 생산 가동 일수 및 건수 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 p-5 shadow-lg group hover:border-violet-500/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-violet-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                가동 일수 / 기록 건수
              </span>
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <CalendarDays className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                <span>{totalProductionDays}</span>
                <span className="text-sm font-semibold text-violet-400">일</span>
                <span className="text-xs font-normal text-slate-400 ml-1">
                  (총 {totalLogRecords}건)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                실제 생산이 기록된 누적 일수
              </p>
            </div>
          </div>

          {/* 카드 4: 최다 생산 품목 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 p-5 shadow-lg group hover:border-amber-500/50 transition-all">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                최다 생산 품목
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {topProduct ? (
                <>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-white truncate" title={topProduct.productName}>
                    {topProduct.productName}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5 text-xs">
                    <span className="font-semibold text-amber-400">{formatNum(topProduct.totalQuantity)}개</span>
                    <span className="text-slate-400">({topProduct.percentage}%)</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500 mt-2">생산 내역 없음</div>
              )}
              <p className="mt-1 text-xs text-slate-400">
                선택 기간 최다 생산 1위 제품
              </p>
            </div>
          </div>
        </div>

        {/* 제품별 생산 집계 요약 및 상세 내역 테이블 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>제품별 집계 현황</span>
                <span className="text-xs font-normal text-slate-400">
                  (총 {sortedAggregatedList.length}개 제품)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                각 제품을 클릭하면 해당 기간의 일자별 생산 상세 내역을 확인할 수 있습니다.
              </p>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>실시간 집계 산출 완료</span>
            </div>
          </div>

          {/* 테이블 영역 */}
          {isLoading ? (
            <div className="py-24 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-400 animate-spin mb-3" />
              <p className="text-sm text-slate-400">생산 데이터를 집계하고 있습니다...</p>
            </div>
          ) : sortedAggregatedList.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-300">집계된 생산 데이터가 없습니다</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                선택하신 기간이나 제품 필터 조건에 해당하는 생산일지가 없습니다. 필터 기간을 조정해보세요.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-xs font-medium">
                    <th className="py-3.5 px-4 sm:px-6 w-12 text-center">#</th>
                    <th
                      className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleSort('productName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>제품명</span>
                        {sortField === 'productName' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4 hidden md:table-cell">카테고리</th>
                    <th className="py-3.5 px-4 hidden sm:table-cell">포장 규격</th>
                    <th
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleSort('logCount')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>생산 횟수</span>
                        {sortField === 'logCount' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleSort('totalQuantity')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>총 생산 수량 (개)</span>
                        {sortField === 'totalQuantity' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleSort('totalWeightKg')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>총 중량 (kg)</span>
                        {sortField === 'totalWeightKg' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-3.5 px-4 w-40 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => toggleSort('percentage')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>생산 비중</span>
                        {sortField === 'percentage' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-center w-20">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
                  {sortedAggregatedList.map((item, index) => {
                    const isExpanded = expandedProducts.has(item.key);
                    return (
                      <React.Fragment key={item.key}>
                        <tr
                          onClick={() => toggleExpand(item.key)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-3.5 px-4 sm:px-6 text-center text-slate-500 font-mono text-xs">
                            {index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{item.productName}</span>
                              {index === 0 && sortField === 'totalQuantity' && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-normal">
                                  1위
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 hidden md:table-cell">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-xs border border-slate-700">
                              {item.categoryName}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 hidden sm:table-cell font-mono">
                            {item.capacity} {item.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-300 font-mono">
                            {item.logCount}회 ({item.datesCount}일)
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-400 font-mono text-sm sm:text-base">
                            {formatNum(item.totalQuantity)}
                            <span className="text-xs font-normal text-emerald-500 ml-1">개</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-sky-400 font-mono">
                            {formatNum(item.totalWeightKg)}
                            <span className="text-xs font-normal text-sky-500 ml-1">kg</span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden hidden sm:block">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-slate-300 w-10 text-right">
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
                              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* 아코디언 펼침: 일자별 생산 상세 내역 서브 테이블 */}
                        {isExpanded && (
                          <tr className="bg-slate-950/80 border-b border-slate-800">
                            <td colSpan={9} className="p-4 sm:p-6">
                              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-inner">
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                                  <div className="flex items-center gap-2 text-slate-300 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>
                                      <strong>{item.productName}</strong> 일자별 생산 내역 ({item.logs.length}건)
                                    </span>
                                  </div>
                                  <span className="text-slate-500 text-[11px]">
                                    해당 기간 누적 생산: {formatNum(item.totalQuantity)}개 ({formatNum(item.totalWeightKg)}kg)
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-800/80">
                                        <th className="py-2 px-3 text-left">생산일자</th>
                                        <th className="py-2 px-3 text-right">생산수량</th>
                                        <th className="py-2 px-3 text-right">환산중량</th>
                                        <th className="py-2 px-3 text-left">특이사항 / 비고</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/40 font-mono">
                                      {item.logs.map((log) => {
                                        const logWeight = calculateWeightInKg(
                                          log.product_capacity || item.capacity,
                                          log.product_unit || item.unit,
                                          log.quantity
                                        );
                                        return (
                                          <tr key={log.id} className="hover:bg-slate-800/40">
                                            <td className="py-2 px-3 text-slate-300 font-medium">
                                              {log.log_date}
                                            </td>
                                            <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                                              {formatNum(log.quantity)} 개
                                            </td>
                                            <td className="py-2 px-3 text-right text-sky-400">
                                              {formatNum(roundFixed(logWeight, 2))} kg
                                            </td>
                                            <td className="py-2 px-3 text-slate-400 font-sans truncate max-w-xs">
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

                {/* 테이블 하단 합계 요약 푸터 */}
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-950 font-semibold text-xs sm:text-sm text-slate-200">
                    <td colSpan={4} className="py-4 px-4 sm:px-6 text-slate-300">
                      선택 필터 총합계 ({sortedAggregatedList.length}개 품목)
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-300">
                      {totalLogRecords}회 ({totalProductionDays}일)
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-emerald-400 text-sm sm:text-base font-bold">
                      {formatNum(grandTotalQty)} 개
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sky-400 text-sm sm:text-base font-bold">
                      {formatNum(grandTotalWeightKg)} kg
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-slate-300">
                      100.0%
                    </td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
