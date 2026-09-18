'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, ProductionLogMaterial } from '@/lib/types';
import { calculateMaterials, formatNum } from '@/lib/calculator';
import { downloadHWPX } from '@/lib/hwpxExporter';
import ProductionSheetDocument from '@/components/ProductionSheetDocument';
import {
  Printer,
  FileDown,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  Layers,
  Sparkles,
  Eye,
  Loader2,
  Scale,
} from 'lucide-react';

export default function ProductionLogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // 폼 상태
  const todayStr = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState<string>(todayStr);
  const [quantity, setQuantity] = useState<number | string>('');
  const [notes, setNotes] = useState<string>('');

  // 원료수불부 산출 단위 선택 (g 또는 kg, 기본값 g)
  const [materialUnit, setMaterialUnit] = useState<'g' | 'kg'>('g');

  // 계산된 원재료 목록
  const [materials, setMaterials] = useState<ProductionLogMaterial[]>([]);

  // UI 상태
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 1. 제품 및 배합비 데이터 로드 (제품군 포함)
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const { data: prodData, error: prodErr } = await supabase
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

      if (prodErr) throw prodErr;

      const formatted: Product[] = (prodData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        capacity: Number(p.capacity),
        unit: p.unit,
        category_id: p.category_id,
        category_name: p.product_categories?.name || '기타',
        ingredients: (p.product_ingredients || []).map((ing: any) => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name,
          ratio: Number(ing.ratio),
          unit: ing.unit || 'g',
          remarks: ing.remarks || '',
          sort_order: ing.sort_order || 0,
        })),
      }));

      setProducts(formatted);

      // 첫 번째 제품 기본 선택
      if (formatted.length > 0 && !selectedProductId) {
        setSelectedProductId(formatted[0].id);
        setSelectedProduct(formatted[0]);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setErrorMsg('제품 목록을 불러오는데 실패했습니다. Supabase 연결을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. 제품군별 그룹화
  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    products.forEach((prod) => {
      const cat = prod.category_name || '기타';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(prod);
    });
    return groups;
  }, [products]);

  // 3. 제품 선택 변경 시
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prodId = e.target.value;
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId) || null;
    setSelectedProduct(prod);
  };

  // 4. 생산량 또는 제품 또는 단위 변경 시 원료수불 자동 계산
  useEffect(() => {
    if (!selectedProduct || !quantity || Number(quantity) <= 0) {
      setMaterials([]);
      return;
    }
    const calculated = calculateMaterials(selectedProduct, Number(quantity), materialUnit);
    setMaterials(calculated);
  }, [selectedProduct, quantity, materialUnit]);

  // 5. 생산일지 저장
  const handleSave = async () => {
    if (!selectedProduct) {
      alert('제품을 선택해주세요.');
      return;
    }
    const qtyNum = Number(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      alert('생산량을 1개 이상 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      // 1) 생산일지 마스터 저장
      const { data: logData, error: logErr } = await supabase
        .from('production_logs')
        .insert({
          log_date: logDate,
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          product_capacity: selectedProduct.capacity,
          product_unit: selectedProduct.unit,
          quantity: qtyNum,
          notes: notes.trim(),
        })
        .select()
        .single();

      if (logErr) throw logErr;

      // 2) 원료수불 상세 내역 저장 (선택된 단위로 저장)
      if (materials.length > 0 && logData) {
        const matPayload = materials.map((m) => ({
          log_id: logData.id,
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

      setSaveSuccessMsg('생산일지가 성공적으로 저장되었습니다!');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving production log:', err);
      setErrorMsg(`저장 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 6. PDF 인쇄 호출
  const handlePrint = () => {
    window.print();
  };

  // 7. HWPX 다운로드 호출
  const handleDownloadHWPX = async () => {
    if (!selectedProduct) {
      alert('제품을 먼저 선택해주세요.');
      return;
    }
    await downloadHWPX({
      logDate,
      productName: selectedProduct.name,
      productUnit: selectedProduct.unit || '개',
      quantity,
      materials,
      notes,
    });
  };

  // 8. 초기화
  const handleReset = () => {
    if (confirm('입력한 내용을 초기화하시겠습니까?')) {
      setQuantity('');
      setNotes('');
      setLogDate(todayStr);
      setMaterialUnit('g');
      if (products.length > 0) {
        setSelectedProductId(products[0].id);
        setSelectedProduct(products[0]);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 인쇄 전용 영역 */}
      <div id="printable-root" className="hidden print:block">
        <ProductionSheetDocument
          logDate={logDate}
          productName={selectedProduct?.name || ''}
          productUnit={selectedProduct?.unit || '개'}
          quantity={quantity}
          materials={materials}
          notes={notes}
          isPrintOnly={true}
        />
      </div>

      {/* 화면 전용 UI */}
      <div className="screen-only">
        {/* 상단 알림 메시지 */}
        {saveSuccessMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold text-sm">{saveSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span className="font-semibold text-sm">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 좌측: 생산일지 입력 패널 (5 칼럼) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">생산 정보 입력</h2>
                    <p className="text-xs text-slate-500">제품 및 생산량을 입력하면 수불부가 자동 계산됩니다</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="초기화"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-sm">제품 데이터를 불러오는 중...</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* 작성일자 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      작성 일자
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* 제품 선택 (제품군별 그룹화) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        생산 제품 선택
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">제품군별 정렬됨</span>
                    </div>
                    {products.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        등록된 제품이 없습니다. 상단 '제품 및 원재료 관리'에서 먼저 제품을 등록해주세요.
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={selectedProductId}
                          onChange={handleProductChange}
                          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                        >
                          {Object.entries(groupedProducts).map(([catName, prodList]) => (
                            <optgroup key={catName} label={`📁 ${catName}`}>
                              {prodList.map((prod) => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} ({prod.capacity}{prod.unit})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* 선택된 제품 상세 정보 뱃지 */}
                    {selectedProduct && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                          분류: {selectedProduct.category_name}
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                          규격: 1개당 {selectedProduct.capacity} {selectedProduct.unit}
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-200/60">
                          원재료: {selectedProduct.ingredients?.length || 0}종 구성
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 생산 수량 입력 */}
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
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
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
                            const cur = Number(quantity) || 0;
                            setQuantity(cur + quick);
                          }}
                          className="flex-1 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
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
                      <span className="text-[11px] text-slate-500">
                        문서에 표기될 단위 선택
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setMaterialUnit('g')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          materialUnit === 'g'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        g (그램)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterialUnit('kg')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          materialUnit === 'kg'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        kg (킬로그램)
                      </button>
                    </div>
                  </div>

                  {/* 원료수불 자동 계산 요약 카드 */}
                  {selectedProduct && materials.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          원료수불부 소요량 자동 계산 결과
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                          단위: {materialUnit}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {materials.map((mat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-100 shadow-2xs"
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

                  {/* 특이사항 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      특이사항 (선택 입력)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="생산 중 특이사항 또는 메모를 입력하세요"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* 메인 액션 버튼 그룹 */}
                  <div className="pt-3 space-y-2.5">
                    {/* 저장 버튼 */}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || !selectedProduct || !quantity}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-700/20 hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>DB에 저장하는 중...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>생산일지 저장하기</span>
                        </>
                      )}
                    </button>

                    {/* 출력 및 다운로드 버튼 */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF / 인쇄 출력</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadHWPX}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>한글(.hwpx) 다운로드</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 우측: 실제 인쇄 서식 실시간 라이브 미리보기 (7 칼럼) */}
          <div className="lg:col-span-7">
            <div className="sticky top-20">
              <div className="bg-slate-800/90 text-white px-4 py-2.5 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>실시간 양식 미리보기 (생산일지.pdf 서식 1:1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                    단위: {materialUnit}
                  </span>
                  <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                    A4 단일 페이지
                  </span>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                  >
                    <Printer className="w-3 h-3" />
                    <span>바로 인쇄</span>
                  </button>
                </div>
              </div>

              {/* 미리보기 용지 카드 */}
              <div className="bg-slate-200 p-4 sm:p-6 rounded-b-2xl shadow-inner overflow-x-auto border-x border-b border-slate-300 flex justify-center">
                <div className="shadow-2xl rounded-sm transition-all transform origin-top max-w-[210mm] w-full">
                  <ProductionSheetDocument
                    logDate={logDate}
                    productName={selectedProduct?.name || ''}
                    productUnit={selectedProduct?.unit || '개'}
                    quantity={quantity}
                    materials={materials}
                    notes={notes}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
