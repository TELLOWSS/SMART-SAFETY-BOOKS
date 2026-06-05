import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/auth';
import { doc, getDoc, setDoc } from '../lib/localFirestore';
import { GoogleGenAI } from '@google/genai';
import { Shield, Upload, Loader2, Save, Trash2, Camera, Info } from 'lucide-react';
import { HIGH_RISK_ASSESSMENTS } from '../lib/checklistTypes';
import { useRef } from 'react';

interface RiskItem {
  id: string;
  category: string;
  hazardTop: string;
  hazardBottom: string;
}

export default function RiskAssessmentManager() {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!auth.currentUser) return;
    const fetchRiskAssessment = async () => {
      try {
        const docRef = doc(db, 'settings', `risk_assessment_${auth.currentUser?.uid}`);
        const snap = await getDoc(docRef);
        if (!mountedRef.current) return;
        if (snap.exists() && snap.data().items) {
          setItems(snap.data().items);
          setLastUpdated(snap.data().updatedAt || null);
        } else {
          // fallback to default
          setItems(HIGH_RISK_ASSESSMENTS.map(item => ({
            id: item.id,
            category: item.category,
            hazardTop: item.hazardTop,
            hazardBottom: item.hazardBottom
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };
    fetchRiskAssessment();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', `risk_assessment_${auth.currentUser.uid}`);
      const now = new Date().toISOString();
      await setDoc(docRef, { items, updatedAt: now });
      setLastUpdated(now);
      alert('월간 위험성평가가 성공적으로 저장되었습니다. 이후 작성되는 일지에 기본 적용됩니다.');
    } catch (error) {
      console.error(error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleItemChange = (id: string, field: keyof RiskItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: `risk_${Date.now()}`, category: '', hazardTop: '', hazardBottom: '' }]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // remove data:image/...;base64,
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `이 문서는 건설현장 월간 위험성평가 문서입니다. 문서에서 '상등급' 위험성평가 항목들을 추출해주세요.
추출할 데이터는 JSON 배열 형태로 반환해야 하며, 각 객체는 다음 키를 포함해야 합니다:
- category: 작업공종 (예: 시스템/써포트 등)
- hazardTop: 유해위험요인 (위험물 및 지적사항 등)
- hazardBottom: 감소대책 (안전조치사항 등)
만약 상등급 항목이 명시되지 않았다면 주요 위험 요소들을 추출해주세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: prompt }
        ],
        config: { responseMimeType: "application/json" }
      });

      if (response.text) {
         try {
           const parsed = JSON.parse(response.text);
           if (Array.isArray(parsed) && parsed.length > 0) {
             const newItems = parsed.map((item: any, i) => ({
               id: `risk_ocr_${Date.now()}_${i}`,
               category: item.category || '',
               hazardTop: item.hazardTop || '',
               hazardBottom: item.hazardBottom || ''
             }));
             setItems(newItems);
             alert('OCR 분석이 완료되었습니다. 추출된 내용을 확인하고 저장해주세요.');
           } else {
             alert('추출된 항목이 없습니다.');
           }
         } catch(e) {
           console.error("JSON 파싱 에러", e);
           alert('결과를 파싱하는 중 오류가 발생했습니다.');
         }
      }
    } catch (error) {
      console.error(error);
      alert('OCR 분석 중 오류가 발생했습니다.');
    } finally {
      if (mountedRef.current) {
        setAnalyzing(false);
      }
      if (e.target) e.target.value = '';
    }
  };


  if (loading) return <div className="flex justify-center items-center h-64 text-slate-500">로딩중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
             <Shield className="w-6 h-6 mr-2 text-indigo-600" />
             월간 위험성평가 관리 (상등급)
          </h2>
          <p className="text-slate-500 text-sm mt-1">월간 위험성평가표를 사진으로 업로드하면 AI가 상등급 사항을 자동 추출합니다.</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-medium text-sm hover:bg-indigo-100 cursor-pointer transition-colors shadow-sm cursor-pointer disabled:opacity-50">
            {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {analyzing ? 'AI 분석중...' : '사진으로 자동스캔 (OCR)'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={analyzing} />
          </label>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            저장하기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
           <h3 className="font-semibold text-slate-800">위험성평가 항목 편집</h3>
           {lastUpdated && <span className="text-xs text-slate-500">최근 업데이트: {new Date(lastUpdated).toLocaleString()}</span>}
        </div>
        <div className="p-0 sm:p-6 divide-y divide-slate-100">
           {items.length === 0 ? (
               <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                  <Info className="w-8 h-8 mb-2 text-slate-400" />
                  <p>등록된 위험성평가 항목이 없습니다.</p>
                  <p className="text-sm">사진을 스캔하거나 직접 항목을 추가해주세요.</p>
               </div>
           ) : items.map((item, index) => (
             <div key={item.id} className="p-4 sm:p-0 sm:py-6 flex flex-col sm:flex-row gap-4 group">
                <div className="w-12 h-12 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-4">
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 mb-1">작업공종 (Category)</label>
                     <input 
                        type="text" 
                        value={item.category} 
                        onChange={e => handleItemChange(item.id, 'category', e.target.value)} 
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        placeholder="예: 시스템/써포트, 직영/타설 등"
                     />
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 mb-1">유해위험요인</label>
                         <textarea 
                            value={item.hazardTop} 
                            onChange={e => handleItemChange(item.id, 'hazardTop', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[100px] resize-y transition-all"
                            placeholder="유해위험요인을 입력하세요"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 mb-1">감소대책 (이행사항)</label>
                         <textarea 
                            value={item.hazardBottom} 
                            onChange={e => handleItemChange(item.id, 'hazardBottom', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[100px] resize-y transition-all"
                            placeholder="안전조치 및 감소대책을 입력하세요"
                         />
                      </div>
                   </div>
                </div>
                <div className="sm:pt-6">
                   <button 
                      onClick={() => removeItem(item.id)}
                      className="w-full sm:w-auto p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="항목 삭제"
                   >
                     <Trash2 className="w-5 h-5 mx-auto" />
                   </button>
                </div>
             </div>
           ))}

           <div className="p-4 sm:p-6 sm:pt-6">
              <button 
                 onClick={addItem}
                 className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-medium rounded-xl hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center"
              >
                 <Upload className="w-5 h-5 mr-2" /> 새 항목 직접 추가하기
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
