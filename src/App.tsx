import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from './lib/auth';
import { useThemeStore } from './lib/theme';
import { Shield, Home, FileText, BarChart2, Bell, AlertTriangle, Moon, Sun, Monitor } from 'lucide-react';
import DailyLogList from './pages/DailyLogList';
import DailyLogForm from './pages/DailyLogForm';
import AnalysisDashboard from './pages/AnalysisDashboard';
import NotificationsPage from './pages/NotificationsPage';
import PrintLogs from './pages/PrintLogs';
import RiskAssessmentManager from './pages/RiskAssessmentManager';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">로딩중...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">접속중...</div>;
  return <>{children}</>;
}

function NavLink({ to, icon: Icon, children }: { to: string, icon: any, children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      className={`flex items-center px-4 py-3.5 mb-2 text-sm font-semibold rounded-2xl transition-all duration-300 relative overflow-hidden group ${
        isActive 
          ? 'bg-gradient-to-r from-safety-orange to-amber-500 text-white shadow-lg shadow-safety-orange/20 translate-x-1' 
          : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
      }`}
    >
      <Icon className={`w-5 h-5 mr-3 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} /> 
      <span className="relative z-10">{children}</span>
      {isActive && (
        <span className="absolute right-0 top-0 bottom-0 w-1 bg-white rounded-l-full" />
      )}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'high-contrast'] as const;
    const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    if (theme === 'dark') return <Moon className="w-5 h-5" />;
    if (theme === 'high-contrast') return <Monitor className="w-5 h-5" />;
    return <Sun className="w-5 h-5" />;
  };

  return (
    <div className="flex h-screen print:h-auto print:overflow-visible bg-slate-50 dark:bg-slate-950 hc:bg-white overflow-hidden font-sans selection:bg-orange-100 selection:text-orange-900 transition-colors">
      <aside className="w-[280px] bg-brand-slate flex flex-col justify-between shrink-0 hidden md:flex z-10 shadow-2xl print:hidden border-r border-slate-900/50">
        <div>
          <div className="h-24 flex items-center px-8 border-b border-slate-900/50 bg-slate-950/20">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-safety-orange to-amber-500 text-white shadow-md shadow-safety-orange/20 mr-3.5 border border-white/10">
              <Shield className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-extrabold text-base tracking-tight text-white focus:outline-none leading-none">Safeguard Books</h1>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Safety Control OS</span>
            </div>
          </div>
          <nav className="p-5 mt-4">
             <div className="text-[10px] font-extrabold text-slate-500 hc:text-slate-300 uppercase tracking-widest mb-4 px-3.5">OPERATING SYSTEMS</div>
             <NavLink to="/" icon={Home}>운영일지 대시보드</NavLink>
             <NavLink to="/logs/new" icon={FileText}>일일 일지 작성</NavLink>
             <NavLink to="/risk-assessment" icon={AlertTriangle}>정기 위험성평가</NavLink>
             <NavLink to="/analysis" icon={BarChart2}>종합 안전 통계</NavLink>
          </nav>
        </div>
        <div className="p-6 border-t border-slate-900/50 bg-slate-950/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col max-w-[140px]">
              <span className="text-sm font-extrabold text-white truncate">안전전담자 모드</span>
              <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                오프라인 저장 중
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button onClick={cycleTheme} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200 border border-slate-800/50 bg-slate-900/20" title="테마 변경">
                {getThemeIcon()}
              </button>
              <Link to="/notifications" className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200 border border-slate-800/50 bg-slate-900/20 relative">
                <Bell className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen print:h-auto print:overflow-visible overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden print:hidden h-16 bg-white dark:bg-slate-900 hc:bg-black hc:text-white hc:border-b-4 hc:border-white border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-5 shrink-0 shadow-sm z-10 transition-colors">
          <div className="flex items-center">
             <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-safety-orange to-amber-500 hc:from-white hc:to-white hc:text-black text-white mr-2.5 shadow-sm">
               <Shield className="w-4 h-4" />
             </div>
             <span className="font-bold text-base text-slate-900 dark:text-white hc:text-white">Safeguard Books</span>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={cycleTheme} className="p-2 text-slate-400 dark:text-slate-300 hc:text-white hover:text-safety-orange hc:hover:bg-white hc:hover:text-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              {getThemeIcon()}
            </button>
            <Link to="/notifications" className="p-2 text-slate-400 dark:text-slate-300 hc:text-white hover:text-safety-orange hc:hover:bg-white hc:hover:text-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-8 styled-scrollbar scroll-smooth bg-slate-50/50 dark:bg-slate-950/20 hc:bg-white print:bg-white print:p-0 transition-colors">
          {children}
        </main>
        
        {/* Mobile Nav */}
        <nav className="md:hidden print:hidden border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-around p-2 shrink-0 pb-safe z-10 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
            <Link to="/" className="p-2 flex flex-col items-center text-slate-500 hover:text-safety-orange"><Home className="w-6 h-6" /><span className="text-[10px] mt-1 font-semibold">일지 목록</span></Link>
            <Link to="/logs/new" className="p-2 flex flex-col items-center text-slate-500 hover:text-safety-orange"><FileText className="w-6 h-6" /><span className="text-[10px] mt-1 font-semibold">일지 작성</span></Link>
            <Link to="/risk-assessment" className="p-2 flex flex-col items-center text-slate-500 hover:text-safety-orange"><AlertTriangle className="w-6 h-6" /><span className="text-[10px] mt-1 font-semibold">위험성평가</span></Link>
            <Link to="/analysis" className="p-2 flex flex-col items-center text-slate-500 hover:text-safety-orange"><BarChart2 className="w-6 h-6" /><span className="text-[10px] mt-1 font-semibold">안전 통계</span></Link>
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Layout><DailyLogList /></Layout></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><Layout><DailyLogList /></Layout></ProtectedRoute>} />
        <Route path="/logs/print" element={<ProtectedRoute><PrintLogs /></ProtectedRoute>} />
        <Route path="/logs/new" element={<ProtectedRoute><Layout><DailyLogForm /></Layout></ProtectedRoute>} />
        <Route path="/logs/:id" element={<ProtectedRoute><Layout><DailyLogForm /></Layout></ProtectedRoute>} />
        <Route path="/risk-assessment" element={<ProtectedRoute><Layout><RiskAssessmentManager /></Layout></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><Layout><AnalysisDashboard /></Layout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
