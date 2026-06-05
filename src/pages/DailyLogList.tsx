import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, where } from '../lib/localFirestore';
import { db, auth, handleFirestoreError } from '../lib/auth';
import { DailyLog } from '../lib/types';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, ChevronRight, Download, Upload, Printer, Calendar, Trash2 } from 'lucide-react';
import { setDoc, doc } from '../lib/localFirestore';

type BackupPayload = {
  version: number;
  exportedAt: string;
  ownerId: string;
  total: number;
  logs: DailyLog[];
};

type BackupChecklistItem = {
  photoUrl?: string;
  [key: string]: any;
};

type BackupRelatedPhoto = {
  imageUrl?: string;
  [key: string]: any;
};

const isDataUrl = (value: string) => value.startsWith('data:');

const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const convertRemoteImageToDataUrl = async (url: string) => {
  if (!url) return '';
  if (isDataUrl(url)) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`이미지 다운로드 실패: ${response.status}`);
  }

  const blob = await response.blob();
  return readBlobAsDataUrl(blob);
};

const prepareChecklistDataForBackup = async (checklistData: string) => {
  if (!checklistData) return checklistData;

  try {
    const checklist = JSON.parse(checklistData) as Record<string, BackupChecklistItem>;
    const nextChecklist = await Promise.all(
      Object.entries(checklist).map(async ([itemId, item]) => [
        itemId,
        {
          ...item,
          photoUrl: item.photoUrl ? await convertRemoteImageToDataUrl(item.photoUrl) : '',
        },
      ])
    );
    return JSON.stringify(Object.fromEntries(nextChecklist));
  } catch {
    return checklistData;
  }
};

const prepareRelatedPhotosDataForBackup = async (relatedPhotosData: string) => {
  if (!relatedPhotosData) return relatedPhotosData;

  try {
    const relatedPhotos = JSON.parse(relatedPhotosData) as BackupRelatedPhoto[];
    const nextPhotos = await Promise.all(
      relatedPhotos.map(async photo => ({
        ...photo,
        imageUrl: photo.imageUrl ? await convertRemoteImageToDataUrl(photo.imageUrl) : '',
      }))
    );
    return JSON.stringify(nextPhotos);
  } catch {
    return relatedPhotosData;
  }
};

const prepareLogForBackup = async (log: DailyLog) => ({
  ...log,
  checklistData: await prepareChecklistDataForBackup(log.checklistData),
  relatedPhotosData: await prepareRelatedPhotosDataForBackup(log.relatedPhotosData),
  managerSignature: log.managerSignature ? await convertRemoteImageToDataUrl(log.managerSignature) : '',
  directorSignature: log.directorSignature ? await convertRemoteImageToDataUrl(log.directorSignature) : '',
});

const uploadImageDataUrl = async (value: string, storagePath: string) => {
  void storagePath;
  if (!value) return '';
  return value;
};

const restoreChecklistData = async (checklistData: string, logId: string, ownerId: string) => {
  if (!checklistData) return checklistData;

  try {
    const checklist = JSON.parse(checklistData) as Record<string, BackupChecklistItem>;
    const nextChecklist = await Promise.all(
      Object.entries(checklist).map(async ([itemId, item]) => [
        itemId,
        {
          ...item,
          photoUrl: await uploadImageDataUrl(
            item.photoUrl || '',
            `daily-logs/${ownerId}/${logId}/checklist/${itemId}`
          ),
        },
      ])
    );
    return JSON.stringify(Object.fromEntries(nextChecklist));
  } catch {
    return checklistData;
  }
};

const restoreRelatedPhotosData = async (relatedPhotosData: string, logId: string, ownerId: string) => {
  if (!relatedPhotosData) return relatedPhotosData;

  try {
    const relatedPhotos = JSON.parse(relatedPhotosData) as BackupRelatedPhoto[];
    const nextPhotos = await Promise.all(
      relatedPhotos.map(async (photo, index) => ({
        ...photo,
        imageUrl: await uploadImageDataUrl(
          photo.imageUrl || '',
          `daily-logs/${ownerId}/${logId}/related-photos/${photo.id || index}`
        ),
      }))
    );
    return JSON.stringify(nextPhotos);
  } catch {
    return relatedPhotosData;
  }
};

const restoreImageField = async (value: string | undefined, storagePath: string) => {
  if (!value) return '';
  return uploadImageDataUrl(value, storagePath);
};

const createRestoreLogId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeLogForRestore = (raw: unknown, ownerId: string): DailyLog => {
  const log = (raw && typeof raw === 'object' ? raw : {}) as Partial<DailyLog>;
  return {
    id: typeof log.id === 'string' && log.id.trim() !== '' ? log.id : createRestoreLogId(),
    ownerId,
    siteName: typeof log.siteName === 'string' ? log.siteName : '',
    date: typeof log.date === 'string' && log.date ? log.date : new Date().toISOString().slice(0, 10),
    workerStaff: Number.isFinite(log.workerStaff as number) ? Number(log.workerStaff) : 0,
    workerLaborer: Number.isFinite(log.workerLaborer as number) ? Number(log.workerLaborer) : 0,
    tasks: typeof log.tasks === 'string' ? log.tasks : '',
    education: typeof log.education === 'string' ? log.education : '특이사항 없음',
    others: typeof log.others === 'string' ? log.others : '특이사항 없음',
    aiSummary: typeof log.aiSummary === 'string' ? log.aiSummary : '',
    hazardsText: typeof log.hazardsText === 'string' ? log.hazardsText : '',
    actionsText: typeof log.actionsText === 'string' ? log.actionsText : '',
    checklistData: typeof log.checklistData === 'string' ? log.checklistData : '{}',
    relatedPhotosData: typeof log.relatedPhotosData === 'string' ? log.relatedPhotosData : '[]',
    managerSignature: typeof log.managerSignature === 'string' ? log.managerSignature : '',
    directorSignature: typeof log.directorSignature === 'string' ? log.directorSignature : '',
    createdAt: typeof log.createdAt === 'number' ? log.createdAt : Date.now(),
    updatedAt: typeof log.updatedAt === 'number' ? log.updatedAt : Date.now(),
  };
};

export default function DailyLogList() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<'all'|'day'|'week'|'month'>('all');
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        setLogs([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'logs'),
        where('ownerId', '==', user.uid),
        orderBy('date', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const logData: DailyLog[] = [];
        snapshot.forEach(doc => {
          logData.push({ id: doc.id, ...doc.data() } as DailyLog);
        });
        setLogs(logData);
        setLoading(false);
      }, (error) => {
        setLoading(false);
        handleFirestoreError(error, 'list', 'logs');
      });
    });

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, []);

  const handleBackup = async () => {
    const ownerId = auth.currentUser?.uid;
    if (!ownerId) {
      alert('로그인 정보가 확인되지 않아 백업할 수 없습니다.');
      return;
    }

    try {
      const logsWithAssets = await Promise.all(logs.map(log => prepareLogForBackup(log)));

      const payload: BackupPayload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        ownerId,
        total: logs.length,
        logs: logsWithAssets,
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `daily_logs_backup_${new Date().getTime()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      alert(`백업이 완료되었습니다. (${logsWithAssets.length}건, 사진 포함)`);
    } catch (error) {
      console.error(error);
      alert('백업 중 사진을 포함하는 과정에서 오류가 발생했습니다. 사진 URL에 접근할 수 없는 항목이 있을 수 있습니다.');
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedLogs: DailyLog[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.logs)
            ? parsed.logs
            : [];

        if (!Array.isArray(importedLogs) || importedLogs.length === 0) {
          alert('복구할 데이터가 없거나 백업 형식이 올바르지 않습니다.');
          return;
        }

        const ownerId = auth.currentUser?.uid;
        if (!ownerId) {
          alert('로그인 정보가 확인되지 않아 복구할 수 없습니다.');
          return;
        }

        let successCount = 0;
        let failedCount = 0;

        for (const log of importedLogs) {
          try {
            const normalizedLog = normalizeLogForRestore(log, ownerId);
            const logId = normalizedLog.id;
            const logRef = doc(db, 'logs', logId);
            const checklistData = await restoreChecklistData(normalizedLog.checklistData, logId, ownerId);
            const relatedPhotosData = await restoreRelatedPhotosData(normalizedLog.relatedPhotosData, logId, ownerId);
            const managerSignature = await restoreImageField(normalizedLog.managerSignature, `daily-logs/${ownerId}/${logId}/signatures/manager`);
            const directorSignature = await restoreImageField(normalizedLog.directorSignature, `daily-logs/${ownerId}/${logId}/signatures/director`);

            await setDoc(logRef, {
              ...normalizedLog,
              checklistData,
              relatedPhotosData,
              managerSignature,
              directorSignature,
            }, { merge: true });
            successCount += 1;
          } catch (restoreError) {
            failedCount += 1;
            console.error('Restore failed for one log:', restoreError);
          }
        }

        if (failedCount === 0) {
          alert(`복구가 완료되었습니다. (${successCount}건)`);
        } else {
          alert(`복구가 부분 완료되었습니다. 성공 ${successCount}건 / 실패 ${failedCount}건`);
        }
      } catch (err) {
        console.error(err);
        alert('잘못된 백업 파일입니다.');
      } finally {
        e.target.value = '';
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
