import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, runTransaction, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/auth';
import { DailyLog } from '../lib/types';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, ChevronRight, Download, Upload, Printer, Calendar, Trash2 } from 'lucide-react';
import { setDoc, doc } from 'firebase/firestore';

export default function DailyLogList() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<'all'|'day'|'week'|'month'>('all');
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, 'logs'), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData: DailyLog[] = [];
      snapshot.forEach(doc => {
        logData.push({ id: doc.id, ...doc.data() } as DailyLog);
      });
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'list', 'logs');
    });

    return () => unsubscribe();
  }, []);

  const handleBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `daily_logs_backup_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedLogs = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedLogs)) {
          for (const log of importedLogs) {
             const logId = log.id || String(Date.now());
             const logRef = doc(db, 'logs', logId);
             // exclude id from the object itself when saving to firestore if needed, but it's okay
             await setDoc(logRef, { ...log, ownerId: auth.currentUser?.uid }, { merge: true });
          }
          alert('복구가 완료되었습니다.');
        }
      } catch (err) {
        console.error(err);
        alert('잘못된 백업 파일입니다.');
      }
    };
    reader.readAsText(file);
  };

  const filteredLogs = logs.filter(log => {
      if (filterPeriod === 'all') return true;
      const logDate = new Date(log.date);
      const today = new Date();
      if (filterPeriod === 'day') {
          return logDate.toDateString() === today.toDateString();
      } else if (filterPeriod === 'week') {
          const pastWeek = new Date();
          pastWeek.setDate(today.getDate() - 7);
          return logDate >= pastWeek;
      } else if (filterPeriod === 'month') {
          return logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear();
      }
      return true;
  });

  const toggleSelectLog = (id: string, e: React.MouseEvent) => {
     e.stopPropagation();
     setSelectedLogs(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
     });
  };

  const toggleSelectAll = () => {
      if (selectedLogs.size === filteredLogs.length && filteredLogs.length > 0) {
          setSelectedLogs(new Set());
      } else {
          setSelectedLogs(new Set(filteredLogs.map(l => l.id)));
      }
  };

  const printSelectedLogs = () => {
      if(selectedLogs.size === 0) {
          alert('인쇄할 일지를 선택해주세요.');
          return;
      }
      const ids = Array.from(selectedLogs).join(',');
      window.open(`/logs/print?ids=${ids}`, '_blank');
  };

  const deleteSelectedLogs = async () => {
      if(selectedLogs.size === 0) {
          alert('삭제할 일지를 선택해주세요.');
          return;
      }
      if(!window.confirm(`선택한 ${selectedLogs.size}개의 일지를 정말 삭제하시겠습니까?`)) {
          return;
      }
      try {
          for (const id of Array.from(selectedLogs)) {
              await deleteDoc(doc(db, 'logs', id));
          }
          setSelectedLogs(new Set());
          // UI will automatically update via onSnapshot
      } catch (error) {
          handleFirestoreError(error, 'delete', 'logs');
      }
  };

  const deleteIndividualLog = async (id: string, date: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if(!window.confirm(`[${date}] 일지를 정말 삭제하시겠습니까?`)) {
          return;
      }
      try {
          await deleteDoc(doc(db, 'logs', id));
          // Update selected logs if it was selected
          setSelectedLogs(prev => {
              const newSet = new Set(prev);
              newSet.delete(id);
              return newSet;
          });
      } catch (error) {
          handleFirestoreError(error, 'delete', `logs/${id}`);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-indigo-600" /> 안전전담자 운영일지 목록
          </h2>
          <p className="text-sm text-slate-500 mt-1">작성된 운영일지를 관리하고 PDF로 출력하거나 데이터를 백업하세요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedLogs.size > 0 && (
            <>
              <button
                 onClick={printSelectedLogs}
                 className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                선택 PDF 출력 ({selectedLogs.size})
              </button>
              <button
                 onClick={deleteSelectedLogs}
                 className="flex items-center px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-sm font-medium text-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                선택 삭제 ({selectedLogs.size})
              </button>
            </>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={handleBackup} className="flex items-center px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all text-sm font-medium" title="JSON 백업">
              <Download className="w-4 h-4 mr-1.5" /> 백업
            </button>
            <label className="flex items-center px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all text-sm font-medium cursor-pointer" title="JSON 복구">
              <Upload className="w-4 h-4 mr-1.5" /> 복구
              <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
            </label>
          </div>
          
          <Link
            to="/logs/new"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            신규 작성
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-neutral-200 shadow-sm">
         <div className="flex items-center space-x-2">
            <button 
                onClick={() => setFilterPeriod('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${filterPeriod === 'all' ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >전체</button>
            <button 
                onClick={() => setFilterPeriod('day')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${filterPeriod === 'day' ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >일간 (오늘)</button>
            <button 
                onClick={() => setFilterPeriod('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${filterPeriod === 'week' ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >주간 (최근 7일)</button>
            <button 
                onClick={() => setFilterPeriod('month')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${filterPeriod === 'month' ? 'bg-blue-100 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >월간 (이번 달)</button>
         </div>
         
         <div className="flex items-center space-x-3 border-l pl-3 border-neutral-200">
             <div className="text-sm text-neutral-500 font-medium">
                {selectedLogs.size}개 선택됨
             </div>
             <button 
                onClick={printSelectedLogs}
                disabled={selectedLogs.size === 0}
                className="inline-flex items-center px-3 py-1.5 bg-neutral-800 text-white rounded font-medium text-sm hover:bg-neutral-900 disabled:opacity-50"
             >
                <Printer className="w-4 h-4 mr-1.5" />
               선택 PDF 출력
             </button>
         </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-neutral-500">로딩중...</div>
      ) : logs.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-xl p-12 text-center bg-neutral-50">
          <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-neutral-900 mb-1">작성된 일지가 없습니다</h3>
          <p className="text-neutral-500 mb-4">첫 번째 안전전담자 운영일지를 작성해보세요.</p>
          <Link
            to="/logs/new"
            className="inline-flex items-center px-4 py-2 bg-white border border-neutral-300 rounded-md font-medium text-sm hover:bg-neutral-50"
          >
            신규 일지 작성
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex items-center">
             <input type="checkbox" onChange={toggleSelectAll} checked={filteredLogs.length > 0 && selectedLogs.size === filteredLogs.length} className="mr-3 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
             <span className="text-sm font-semibold text-neutral-700">전체 선택</span>
          </div>
          <ul className="divide-y divide-neutral-100">
            {filteredLogs.map((log) => (
              <li key={log.id} className="group flex items-center relative">
                <div className="px-4 py-4 flex items-center h-full z-10" onClick={(e) => toggleSelectLog(log.id, e)}>
                    <input type="checkbox" checked={selectedLogs.has(log.id)} readOnly className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                </div>
                <Link to={`/logs/${log.id}`} className="flex-1 block hover:bg-neutral-50 p-4 pl-0 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-lg font-medium text-neutral-900">{log.date} 일지</span>
                      <span className="text-sm text-neutral-500 mt-1 truncate max-w-md">출역인원: {log.workerStaff + log.workerLaborer}명 | {(log.tasks || '').substring(0, 30)}...</span>
                    </div>
                    <div className="flex items-center space-x-3 pr-4">
                      <button 
                        onClick={(e) => deleteIndividualLog(log.id, log.date, e)}
                        className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors z-20 opacity-0 group-hover:opacity-100"
                        title="삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {filteredLogs.length === 0 && (
                <div className="p-8 text-center text-neutral-500 bg-neutral-50">해당 기간의 일지가 없습니다.</div>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
