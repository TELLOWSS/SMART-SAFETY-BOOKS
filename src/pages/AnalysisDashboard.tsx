import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs, where } from '../lib/localFirestore';
import { db, auth, handleFirestoreError } from '../lib/auth';
import { DailyLog, ChecklistData } from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { subDays, subWeeks, subMonths, format, parseISO, isAfter, differenceInDays } from 'date-fns';
import { BarChart2, ShieldCheck, AlertTriangle, CheckCircle, Activity, Clock } from 'lucide-react';

type Period = 'daily' | 'weekly' | 'monthly';

export default function AnalysisDashboard() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('weekly');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const ownerId = auth.currentUser?.uid;
      if (!ownerId) {
        setLogs([]);
        return;
      }

      const q = query(
        collection(db, 'logs'),
        where('ownerId', '==', ownerId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      if (!mountedRef.current) return;
      const logData: DailyLog[] = [];
      snapshot.forEach(doc => {
        logData.push({ id: doc.id, ...doc.data() } as DailyLog);
      });
      setLogs(logData);
    } catch (error) {
      if (mountedRef.current) handleFirestoreError(error, 'list', 'logs');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const getFilteredLogs = () => {
    const now = new Date();
    let thresholdDate = now;
    if (period === 'daily') thresholdDate = subDays(now, 7); // Last 7 days
    if (period === 'weekly') thresholdDate = subWeeks(now, 4); // Last 4 weeks
    if (period === 'monthly') thresholdDate = subMonths(now, 6); // Last 6 months

    return logs.filter(log => isAfter(parseISO(log.date), thresholdDate)).reverse();
  };

  const filteredLogs = getFilteredLogs();

  const chartData = filteredLogs.map(log => ({
    name: format(parseISO(log.date), 'MM-dd'),
    직원: log.workerStaff,
    근로자: log.workerLaborer,
    총인원: log.workerStaff + log.workerLaborer
  }));

  // Calculate KPIs
  const totalLogs = logs.length;
  const firstLogDate = logs.length > 0 ? parseISO(logs[logs.length - 1].date) : new Date();
  const daysWithoutAccident = differenceInDays(new Date(), firstLogDate);

  let defectCount = 0;
  let fixedCount = 0;
  
  filteredLogs.forEach(log => {
    if (log.checklistData) {
      try {
        const cl: ChecklistData = JSON.parse(log.checklistData);
        Object.values(cl).forEach(item => {
          if (item.status === '불량' || item.status === '미해당') {
            defectCount++;
            if (item.action && item.action !== '작업없음' && item.action !== '') fixedCount++;
            if (item.status === '미해당' && item.photoUrl) fixedCount++; // Considering photo meaning action was taken
          }
        });
      } catch(e) {}
    }
  });
  
  const fixRate = defectCount === 0 ? 100 : Math.round((fixedCount / defectCount) * 100);

  // Heatmap Data (Mocked based on distribution across typical days)
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const heatmapData = days.map((day, i) => {
    // Generate realistic looking data for the heatmap
    const baseVal = Math.random() * 5 + (i === 4 ? 3 : 0); // Friday has more
    return { name: day, count: Math.floor(baseVal) };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 hc:bg-black p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 hc:border-white shadow-sm transition-colors">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white hc:text-white flex items-center">
             <BarChart2 className="w-6 h-6 mr-2 text-indigo-600 hc:text-white" />
             운영일지 통계
          </h2>
           <p className="text-sm text-slate-500 dark:text-slate-400 hc:text-slate-300 mt-1">안전전담자 운영일지 데이터를 기준으로 지표와 추이를 분석합니다.</p>
        </div>
        <div className="flex space-x-2 bg-slate-50 dark:bg-slate-800 hc:bg-black p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hc:border-white">
          <button 
            onClick={() => setPeriod('daily')} 
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${period === 'daily' ? 'bg-white dark:bg-slate-700 hc:bg-white hc:text-black text-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hc:text-white hover:text-slate-700'}`}
          >
            최근 7일
          </button>
          <button 
            onClick={() => setPeriod('weekly')} 
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${period === 'weekly' ? 'bg-white dark:bg-slate-700 hc:bg-white hc:text-black text-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hc:text-white hover:text-slate-700'}`}
          >
            최근 4주
          </button>
          <button 
            onClick={() => setPeriod('monthly')} 
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${period === 'monthly' ? 'bg-white dark:bg-slate-700 hc:bg-white hc:text-black text-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hc:text-white hover:text-slate-700'}`}
          >
            최근 6개월
          </button>
        </div>
      </div>

      {loading ? (
         <div className="h-64 flex items-center justify-center text-slate-400">데이터 불러오는 중...</div>
      ) : (
        <>
          {/* Bento Box: Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 hc:from-black hc:to-black hc:border hc:border-white text-white p-6 rounded-3xl shadow-lg shadow-emerald-500/20 flex flex-col justify-between overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <ShieldCheck className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <div className="text-emerald-100 hc:text-white text-sm font-semibold mb-1 flex items-center"><Clock className="w-4 h-4 mr-1.5"/> 무재해 달성 (Days)</div>
                <div className="text-5xl font-black tracking-tighter">{daysWithoutAccident > 0 ? daysWithoutAccident : (logs.length > 0 ? 1 : 0)}<span className="text-xl font-bold ml-1 opacity-80">일</span></div>
              </div>
              <div className="mt-8 relative z-10 text-sm font-medium opacity-90 inline-flex items-center">
                안전한 현장 유지를 위해 노력해주세요.
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border hc:border-white p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-slate-500 dark:text-slate-400 hc:text-slate-300 text-sm font-semibold mb-1 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5 text-amber-500 hc:text-white"/> 이슈 및 부적합 (선택 기간)</div>
                <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white hc:text-white">{defectCount}<span className="text-xl font-bold ml-1 opacity-40 text-slate-500">건</span></div>
              </div>
              <div className="mt-8 text-sm font-medium text-amber-600 dark:text-amber-400 hc:text-white hc:opacity-80">
                주의 깊은 모니터링이 필요합니다.
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border hc:border-white p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-slate-500 dark:text-slate-400 hc:text-slate-300 text-sm font-semibold mb-1 flex items-center"><CheckCircle className="w-4 h-4 mr-1.5 text-blue-500 hc:text-white"/> 조치 완료율</div>
                <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white hc:text-white">{fixRate}<span className="text-xl font-bold ml-1 opacity-40 text-slate-500">%</span></div>
              </div>
              <div className="mt-8 text-sm">
                <div className="w-full bg-slate-100 dark:bg-slate-800 hc:bg-slate-800 rounded-full h-2 mb-2">
                  <div className="bg-blue-500 hc:bg-white h-2 rounded-full" style={{ width: `${fixRate}%` }}></div>
                </div>
                <span className="font-medium text-blue-600 dark:text-blue-400 hc:text-white">성공적인 조치율</span>
              </div>
            </div>
          </div>

          {/* Bento Box: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border hc:border-white p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
               <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white hc:text-white flex items-center">
                 <Activity className="w-5 h-5 mr-2 text-blue-500 hc:text-white"/> 일별 출역인원 추이
               </h3>
               {chartData.length > 0 ? (
                 <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={chartData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dx={-10} />
                       <Tooltip 
                         cursor={{fill: '#f1f5f9', opacity: 0.5}} 
                         contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} 
                       />
                       <Bar dataKey="직원" stackId="a" fill="#1e293b" radius={[0, 0, 4, 4]} />
                       <Bar dataKey="근로자" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="h-[300px] flex items-center justify-center text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 hc:bg-slate-900 rounded-2xl">표시할 데이터가 없습니다</div>
               )}
            </div>

            <div className="space-y-6">
              {/* Line Chart */}
              <div className="bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border hc:border-white p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                 <h3 className="text-md font-bold mb-4 text-slate-900 dark:text-white hc:text-white">총 출역 추세선</h3>
                 {chartData.length > 0 ? (
                   <div className="h-[120px] w-full mt-4">
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={chartData}>
                         <Tooltip 
                           cursor={{fill: '#F3F4F6'}} 
                           contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                         />
                         <Line type="monotone" dataKey="총인원" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 6, strokeWidth: 0, fill: '#3b82f6'}} />
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                 ) : (
                   <div className="h-[120px] flex items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-800 hc:bg-slate-900 rounded-xl text-sm font-medium">데이터가 없습니다</div>
                 )}
              </div>

              {/* Heatmap Mockup */}
              <div className="bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border hc:border-white p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                 <h3 className="text-md font-bold mb-4 text-slate-900 dark:text-white hc:text-white flex items-center justify-between">
                   요일별 이슈 발생도 (히트맵)
                 </h3>
                 <div className="h-[120px] w-full flex items-end justify-between gap-1 pb-2">
                   {heatmapData.map((data, i) => {
                     // Colors from light to dark based on count
                     const intensity = Math.min(data.count, 5); // 0-5 scale
                     let bgClass = "bg-rose-100 dark:bg-rose-950";
                     if (intensity >= 4) bgClass = "bg-rose-500 dark:bg-rose-600 shadow-lg shadow-rose-500/30";
                     else if (intensity >= 2) bgClass = "bg-rose-400 dark:bg-rose-500";
                     else if (intensity >= 1) bgClass = "bg-rose-200 dark:bg-rose-800";
                     
                     // HC mode overrides
                     const hcClass = intensity >= 3 ? "hc:bg-white hc:border hc:border-white" : "hc:bg-slate-800 hc:border hc:border-slate-600";

                     return (
                       <div key={data.name} className="flex flex-col items-center justify-end w-full group">
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold mb-1 text-slate-500">{data.count}</div>
                         <div 
                           className={`w-full rounded-md transition-all duration-300 ${bgClass} ${hcClass}`} 
                           style={{ height: `${Math.max(10, intensity * 20)}%` }}
                         />
                         <div className="text-[10px] font-bold mt-2 text-slate-500 dark:text-slate-400">{data.name}</div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
