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
      className={`flex items-center px-4 py-3 mb-1.5 text-sm font-medium rounded-xl transition-all duration-200 ${
        isActive 
          ? 'bg-blue-600 shadow-md shadow-blue-900/20 text-white' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-300'}`} /> 
      {children}
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
    <div className="flex h-screen print:h-auto print:overflow-visible bg-slate-50 dark:bg-slate-900 hc:bg-white overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors">
      <aside className="w-[280px] bg-slate-950 flex flex-col justify-between shrink-0 hidden md:flex z-10 shadow-2xl print:hidden">
        <div>
          <div className="h-20 flex items-center px-8 border-b border-slate-800">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 hc:from-black hc:to-black hc:bg-black hc:rounded-none text-white shadow-lg shadow-blue-500/20 mr-3">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white focus:outline-none">SafetyCore</h1>
          </div>
          <nav className="p-4 mt-2">
             <div className="text-[11px] font-bold text-slate-500 hc:text-slate-300 uppercase tracking-widest mb-4 px-3">Main Menu</div>
             <NavLink to="/" icon={Home}>대시보드</NavLink>
             <NavLink to="/logs" icon={FileText}>일지 관리</NavLink>
             <NavLink to="/risk-assessment" icon={AlertTriangle}>월간 위험성평가</NavLink>
             <NavLink to="/analysis" icon={BarChart2}>통계 및 분석</NavLink>
          </nav>
        </div>
        <div className="p-5 border-t border-slate-800/80 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white truncate">현장 담당자</span>
              <span className="text-xs text-slate-400 font-medium mt-0.5">안전팀 (게스트)</span>
            </div>
            <div className="flex items-center space-x-1">
              <button onClick={cycleTheme} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative" title="테마 변경">
                {getThemeIcon()}
              </button>
              <Link to="/notifications" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative">
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
             <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 hc:from-white hc:to-white hc:text-black text-white mr-2.5 shadow-sm">
               <Shield className="w-4 h-4" />
             </div>
             <span className="font-bold text-lg text-slate-900 dark:text-white hc:text-white">SafetyCore</span>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={cycleTheme} className="p-2 text-slate-400 dark:text-slate-300 hc:text-white hover:text-blue-600 hc:hover:bg-white hc:hover:text-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              {getThemeIcon()}
            </button>
            <Link to="/notifications" className="p-2 text-slate-400 dark:text-slate-300 hc:text-white hover:text-blue-600 hc:hover:bg-white hc:hover:text-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-8 styled-scrollbar scroll-smooth bg-slate-50/50 dark:bg-slate-900/50 hc:bg-white print:bg-white print:p-0 transition-colors">
          {children}
        </main>
        
        {/* Mobile Nav */}
        <nav className="md:hidden print:hidden border-t border-slate-200 bg-white/80 backdrop-blur-md flex justify-around p-2 shrink-0 pb-safe z-10 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
           <Link to="/" className="p-2 flex flex-col items-center text-slate-500 hover:text-blue-600"><Home className="w-6 h-6" /><span className="text-[10px] mt-1 font-medium">홈</span></Link>
           <Link to="/logs" className="p-2 flex flex-col items-center text-slate-500 hover:text-blue-600"><FileText className="w-6 h-6" /><span className="text-[10px] mt-1 font-medium">일지</span></Link>
           <Link to="/risk-assessment" className="p-2 flex flex-col items-center text-slate-500 hover:text-blue-600"><AlertTriangle className="w-6 h-6" /><span className="text-[10px] mt-1 font-medium">위험성평가</span></Link>
           <Link to="/analysis" className="p-2 flex flex-col items-center text-slate-500 hover:text-blue-600"><BarChart2 className="w-6 h-6" /><span className="text-[10px] mt-1 font-medium">분석</span></Link>
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Layout><AnalysisDashboard /></Layout></ProtectedRoute>} />
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
