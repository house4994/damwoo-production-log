'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, ProductIngredient, ProductCategory } from '@/lib/types';
import { sumRatios } from '@/lib/calculator';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Scale,
  Sparkles,
  Loader2,
  Search,
  FolderTree,
  Tag,
} from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // 제품 모달 상태
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // 제품 폼 상태
  const [name, setName] = useState<string>('');
  const [capacity, setCapacity] = useState<number | string>('');
  const [unit, setUnit] = useState<string>('g');
  const [categoryId, setCategoryId] = useState<string>('');
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([
    { ingredient_name: '', ratio: 100, unit: 'g', remarks: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // 제품군 관리 모달 상태
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>('');

  // 1. 제품군 및 제품 목록 로드
  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 제품군 조회
      const { data: catData, error: catErr } = await supabase
        .from('product_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (catErr) throw catErr;
      setCategories(catData || []);

      // 제품 조회 (제품군 조인)
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
        category_name: p.product_categories?.name || '미지정',
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
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert('데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. 제품 모달 열기 (신규)
  const handleOpenAddProductModal = () => {
    setEditingProductId(null);
    setName('');
    setCapacity('');
    setUnit('g');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setIngredients([
      { ingredient_name: '', ratio: 100, unit: 'g', remarks: '' },
    ]);
    setModalError(null);
    setIsProductModalOpen(true);
  };

  // 3. 제품 모달 열기 (수정)
  const handleOpenEditProductModal = (prod: Product) => {
    setEditingProductId(prod.id);
    setName(prod.name);
    setCapacity(prod.capacity);
    setUnit(prod.unit);
    setCategoryId(prod.category_id || '');
    setIngredients(
      prod.ingredients && prod.ingredients.length > 0
        ? prod.ingredients.map((i) => ({ ...i, unit: i.unit || 'g' }))
        : [{ ingredient_name: '', ratio: 100, unit: 'g', remarks: '' }]
    );
    setModalError(null);
    setIsProductModalOpen(true);
  };

  // 원재료 행 추가
  const handleAddIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      { ingredient_name: '', ratio: 0, unit: 'g', remarks: '' },
    ]);
  };

  // 원재료 행 삭제
  const handleRemoveIngredientRow = (index: number) => {
    if (ingredients.length <= 1) {
      alert('최소 1개 이상의 원재료가 필요합니다.');
      return;
    }
    setIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 원재료 행 값 변경
  const handleIngredientChange = (
    index: number,
    field: keyof ProductIngredient,
    value: any
  ) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // 원재료 함량 합계 계산 (부동소수점 오차 방지)
  const totalRatio = sumRatios(ingredients.map((i) => i.ratio));
  const isRatio100 = Math.abs(totalRatio - 100) < 0.001;

  // 제품 저장 (신규 등록 또는 수정)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('제품명을 입력해주세요.');
      return;
    }
    const capNum = Number(capacity);
    if (!capacity || isNaN(capNum) || capNum <= 0) {
      setModalError('규격 용량을 0보다 크게 입력해주세요.');
      return;
    }
    if (ingredients.some((i) => !i.ingredient_name.trim())) {
      setModalError('모든 원재료명을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      if (editingProductId) {
        // 1) 제품 정보 업데이트
        const { error: prodErr } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            capacity: capNum,
            unit: unit.trim(),
            category_id: categoryId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProductId);

        if (prodErr) throw prodErr;

        // 2) 기존 원재료 삭제 후 재삽입
        const { error: delErr } = await supabase
          .from('product_ingredients')
          .delete()
          .eq('product_id', editingProductId);

        if (delErr) throw delErr;

        const ingPayload = ingredients.map((ing, idx) => ({
          product_id: editingProductId,
          ingredient_name: ing.ingredient_name.trim(),
          ratio: Number(ing.ratio) || 0,
          unit: ing.unit || 'g',
          remarks: ing.remarks?.trim() || '',
          sort_order: idx + 1,
        }));

        const { error: insErr } = await supabase
          .from('product_ingredients')
          .insert(ingPayload);

        if (insErr) throw insErr;
      } else {
        // 신규 제품 등록
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .insert({
            name: name.trim(),
            capacity: capNum,
            unit: unit.trim(),
            category_id: categoryId || null,
          })
          .select()
          .single();

        if (prodErr) throw prodErr;

        if (prodData) {
          const ingPayload = ingredients.map((ing, idx) => ({
            product_id: prodData.id,
            ingredient_name: ing.ingredient_name.trim(),
            ratio: Number(ing.ratio) || 0,
            unit: ing.unit || 'g',
            remarks: ing.remarks?.trim() || '',
            sort_order: idx + 1,
          }));

          const { error: insErr } = await supabase
            .from('product_ingredients')
            .insert(ingPayload);

          if (insErr) throw insErr;
        }
      }

      setIsProductModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setModalError(`저장 실패: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 제품 삭제
  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (
      !confirm(
        `'${prodName}' 제품을 삭제하시겠습니까?\n(등록된 원재료 배합비 정보도 함께 삭제됩니다)`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error('Error deleting product:', err);
      alert('제품 삭제 중 오류가 발생했습니다.');
    }
  };

  // 4. 제품군(카테고리) 추가
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const nextSort = categories.length + 1;
      const { error } = await supabase
        .from('product_categories')
        .insert({ name: newCategoryName.trim(), sort_order: nextSort });

      if (error) throw error;
      setNewCategoryName('');
      await fetchData();
    } catch (err: any) {
      alert(`제품군 추가 실패: ${err.message}`);
    }
  };

  // 제품군 수정
  const handleUpdateCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    try {
      const { error } = await supabase
        .from('product_categories')
        .update({ name: editingCategoryName.trim() })
        .eq('id', id);

      if (error) throw error;
      setEditingCategoryId(null);
      await fetchData();
    } catch (err: any) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  // 제품군 삭제 (제품은 그대로 유지됨)
  const handleDeleteCategory = async (id: string, catName: string) => {
    if (
      !confirm(
        `'${catName}' 제품군을 삭제하시겠습니까?\n※ 제품군을 삭제해도 속한 제품은 삭제되지 않고 안전하게 유지됩니다.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 검색 및 제품군 필터링
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' || p.category_id === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">제품 및 원재료 기준정보</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              제품별 포장 규격과 원재료 배합 비율(%)을 등록하면 생산일지 작성 시 수불부가 자동 계산됩니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 제품군 관리 버튼 */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
          >
            <FolderTree className="w-4 h-4 text-slate-500" />
            <span>제품군 관리 ({categories.length})</span>
          </button>

          {/* 신규 제품 등록 버튼 */}
          <button
            type="button"
            onClick={handleOpenAddProductModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>신규 제품 등록</span>
          </button>
        </div>
      </div>

      {/* 제품군 필터 탭 & 검색 바 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        {/* 제품군 탭 바 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 ${
              selectedCategoryFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = selectedCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-emerald-700' : 'bg-slate-200'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 검색창 */}
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="제품명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* 제품 목록 그리드 */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm">제품 목록을 불러오는 중입니다...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">등록된 제품이 없습니다.</p>
          <button
            onClick={handleOpenAddProductModal}
            className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
          >
            첫 제품 등록하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                {/* 카드 상단 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                        <Tag className="w-3 h-3 text-blue-500" />
                        {prod.category_name}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600">
                      {prod.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Scale className="w-3 h-3 text-slate-400" />
                        1개당 {prod.capacity} {prod.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditProductModal(prod)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id, prod.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 원재료 배합표 */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>원재료 배합비 ({prod.ingredients?.length || 0}종)</span>
                    <span className="text-emerald-600 font-semibold">
                      합계 {sumRatios(prod.ingredients?.map((c) => c.ratio) || [])}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {prod.ingredients && prod.ingredients.length > 0 ? (
                      prod.ingredients.map((ing, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <span className="font-medium text-slate-700">{ing.ingredient_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700">{ing.ratio}%</span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {ing.unit || 'g'}
                            </span>
                            {ing.remarks && (
                              <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {ing.remarks}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 py-2 text-center">
                        원재료 정보가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 관리 버튼 */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenEditProductModal(prod)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>배합비 수정</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 제품 등록 / 수정 모달 */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <span>{editingProductId ? '제품 및 원재료 배합비 수정' : '신규 제품 등록'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 폼 */}
            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 제품군 및 제품명 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    제품군 분류
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- 미지정 --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    제품명 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 담우 곤드레나물밥"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 포장 규격 및 단위 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    1개당 규격 용량 *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="any"
                    placeholder="예: 250"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    용량 단위 *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="g">g (그램)</option>
                    <option value="kg">kg (킬로그램)</option>
                    <option value="ml">ml (밀리리터)</option>
                    <option value="L">L (리터)</option>
                  </select>
                </div>
              </div>

              {/* 원재료 배합비 목록 */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    원재료 배합비 목록 (기본 단위: g) *
                  </label>
                  {/* 함량 합계 표시 뱃지 */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isRatio100
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isRatio100 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>함량 합계: {totalRatio}%</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2"
                    >
                      {/* 원재료명 */}
                      <input
                        type="text"
                        placeholder="원재료명 (예: 국내산 쌀)"
                        value={ing.ingredient_name}
                        onChange={(e) =>
                          handleIngredientChange(idx, 'ingredient_name', e.target.value)
                        }
                        className="flex-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      />

                      {/* 배합비(%) */}
                      <div className="relative flex-2">
                        <input
                          type="number"
                          placeholder="함량"
                          step="0.01"
                          min="0"
                          max="100"
                          value={ing.ratio === 0 ? '' : ing.ratio}
                          onChange={(e) =>
                            handleIngredientChange(idx, 'ratio', parseFloat(e.target.value) || 0)
                          }
                          className="w-full pr-6 pl-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                          required
                        />
                        <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">
                          %
                        </span>
                      </div>

                      {/* 수불 단위 (g / kg 선택, 기본값 g) */}
                      <select
                        value={ing.unit || 'g'}
                        onChange={(e) =>
                          handleIngredientChange(idx, 'unit', e.target.value)
                        }
                        className="w-18 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>

                      {/* 비고 */}
                      <input
                        type="text"
                        placeholder="비고 (원산지 등)"
                        value={ing.remarks || ''}
                        onChange={(e) =>
                          handleIngredientChange(idx, 'remarks', e.target.value)
                        }
                        className="flex-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="원재료 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 원재료 추가 버튼 */}
                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="mt-2.5 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>원재료 행 추가</span>
                </button>
              </div>

              {/* 모달 푸터 액션 */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProductId ? '수정 내용 저장' : '새 제품 등록하기'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 제품군 관리 모달 */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-600" />
                <span>제품군 분류 관리</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* 신규 제품군 추가 폼 */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="새 제품군 명칭 (예: 간편조리식)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0"
                >
                  추가
                </button>
              </form>

              {/* 안내 문구 */}
              <p className="text-[11px] text-slate-400">
                ※ 제품군을 삭제해도 해당 제품군에 속한 제품은 삭제되지 않고 안전하게 유지됩니다.
              </p>

              {/* 제품군 목록 */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {categories.map((cat) => {
                  const isEditing = editingCategoryId === cat.id;
                  const prodCount = products.filter((p) => p.category_id === cat.id).length;

                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-white flex items-center justify-between gap-2 hover:bg-slate-50"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs border border-emerald-400 rounded-lg focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateCategory(cat.id)}
                            className="px-2 py-1 bg-emerald-600 text-white text-xs rounded-lg font-bold"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-lg"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {prodCount}개 제품
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryName(cat.name);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                              title="이름 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="제품군 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
