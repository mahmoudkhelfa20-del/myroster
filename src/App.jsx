import React, { useState, useEffect } from 'react';
import { 
  Users, Settings, Calendar, Plus, Trash2, Play, Activity,
  UserCog, MessageCircle, LogOut, LogIn, Save, Mail, Phone, Facebook, 
  Instagram, Sun, Moon, Clock, RotateCcw, Download, Printer, Lock, X, ShieldCheck
} from 'lucide-react';

// 1. Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// 2. Firebase Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYfEuKC2x15joIBS082can9w0jdy_6_-0", 
  authDomain: "roster-maker-app.firebaseapp.com",
  projectId: "roster-maker-app",
  storageBucket: "roster-maker-app.firebasestorage.app",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- إعدادات الأدمن ---
// تم تحديث الـ UID الخاص بك هنا
const ADMIN_UID = "lpHTOe8uAzbf8MNnX6SGw6W7B5h1"; 

// --- START OF APP COMPONENT ---
const App = () => {
  const [activeTab, setActiveTab] = useState('staff');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Admin State
  const isAdmin = userId === ADMIN_UID;
  const [paymentInfo, setPaymentInfo] = useState({
    price: "150 جنيه",
    instapay: "mahmoudkhelfa@instapay",
    wallet: "01205677601",
    whatsapp: "201205677601"
  });

  // Modals State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState(null);
  
  // Default Data (For Logout State)
  const defaultInitialConfig = {
    shiftSystem: '12h', allowDayAfterNight: false, requireMedicationNurse: true, allowMultipleCharge: false,
    minStaffOnlyCount: 3, startDay: 1, month: new Date().getMonth(), year: new Date().getFullYear(), durationDays: 30
  };

  const defaultInitialStaff = [
    { id: 1, name: 'أحمد محمد', role: 'Charge', grade: 'A', preference: 'cycle', maxConsecutive: 3, targetShifts: 15, vacationDays: [] },
    { id: 2, name: 'سارة علي', role: 'Staff', grade: 'A', preference: 'scattered', maxConsecutive: 4, targetShifts: 15, vacationDays: [] }, 
  ];

  // Data States
  const [config, setConfig] = useState(defaultInitialConfig); 
  const [staffList, setStaffList] = useState(defaultInitialStaff);
  const [roster, setRoster] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staffStats, setStaffStats] = useState({});

  // --- Helpers ---
  const months = [ "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر" ];

  const getDateFromIndex = (index) => { 
    if (!config) return new Date();
    const date = new Date(config.year, config.month, config.startDay);
    date.setDate(date.getDate() + (index - 1));
    return date;
  };

  const formatDate = (date) => { return `${date.getDate()}/${date.getMonth() + 1}`; };
  const getDayLetter = (date) => { 
    const letters = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; 
    return letters[date.getDay()];
  };

  const getFullDateLabel = (index) => {
    const date = getDateFromIndex(index);
    return {
      dateObj: date, str: formatDate(date), dayNum: date.getDate(), dayName: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()],
      dayLetter: getDayLetter(date), isWeekend: date.getDay() === 5 || date.getDay() === 6 
    };
  };

  const getShiftsForSystem = (system) => {
    switch(system) {
      case '12h': return [{ code: 'D', label: 'Day (12h)', icon: Sun }, { code: 'N', label: 'Night (12h)', icon: Moon }];
      case '8h': return [{ code: 'M', label: 'Morning', icon: Sun }, { code: 'E', label: 'Evening', icon: Sun }, { code: 'N', label: 'Night', icon: Moon }];
      case '24h': return [{ code: '24', label: 'Full Day', icon: Clock }];
      default: return [];
    }
  };

  const roles = ['Charge', 'Medication', 'Staff'];
  
  // --- LISTENERS ---
  
  // 1. Fetch Payment Settings (Global)
  useEffect(() => {
    const fetchPaymentSettings = async () => {
        try {
            const docRef = doc(db, "settings", "payment");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setPaymentInfo(docSnap.data());
            }
        } catch (e) { console.log("Error fetching settings:", e); }
    };
    fetchPaymentSettings();
  }, []);

  // 2. Auth Listener (تم إصلاح مشكلة التعليق هنا)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        if (user.isAnonymous) setIsPremium(false); 
      } else {
        // عند تسجيل الخروج، نعيد البيانات الافتراضية فوراً ليفتح التطبيق
        setUserId(null);
        setUserEmail(null);
        setConfig(defaultInitialConfig);
        setStaffList(defaultInitialStaff);
        setIsPremium(false);
        setShowAuthModal(true); 
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. User Data Listener
  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, "rosters", userId);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(data.config || defaultInitialConfig);
        setStaffList(data.staffList || defaultInitialStaff);
        setRoster(data.roster || []);
        setIsPremium(data.isPremium === true); 
      } else {
        await setDoc(docRef, { 
            config: defaultInitialConfig, 
            staffList: defaultInitialStaff, 
            roster: [],
            isPremium: false 
        });
        setConfig(defaultInitialConfig); setStaffList(defaultInitialStaff);
        setIsPremium(false);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // --- SYNC & ACTIONS ---
  const updateFirestore = async (newConfig = config, newStaffList = staffList, newRoster = roster) => {
    if (!userId || !config || !staffList) return; 
    try {
      await setDoc(doc(db, "rosters", userId), { config: newConfig, staffList: newStaffList, roster: newRoster }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const updateAdminSettings = async () => {
      if (!isAdmin) return;
      if(window.confirm("هل تريد حفظ التعديلات العامة لجميع المستخدمين؟")) {
        try {
            await setDoc(doc(db, "settings", "payment"), paymentInfo);
            alert("تم تحديث بيانات الدفع للجميع بنجاح!");
        } catch(e) {
            alert("حدث خطأ: " + e.message);
        }
      }
  };

  const setConfigAndSync = (newConfig) => { setConfig(newConfig); updateFirestore(newConfig, staffList, roster); };
  const setStaffListAndSync = (newStaffList) => { setStaffList(newStaffList); updateFirestore(config, newStaffList, roster); };
  const setRosterAndSync = (newRoster) => { setRoster(newRoster); updateFirestore(config, staffList, newRoster); };

  // --- إضافة الموظفين (مع قيد العدد) ---
  const addStaff = () => {
    // التحقق من حد النسخة المجانية
    if (!isPremium && staffList.length >= 5) {
        // إظهار رسالة تنبيه
        alert("عفواً، النسخة المجانية تدعم 5 ممرضين فقط.\nيرجى الاشتراك لإضافة عدد غير محدود.");
        setShowPaymentModal(true);
        return; // وقف العملية
    }

    const newId = staffList.length > 0 ? Math.max(...staffList.map(s => s.id)) + 1 : 1;
    const defaultTarget = config.shiftSystem === '12h' ? 15 : config.shiftSystem === '24h' ? 10 : 22;
    setStaffListAndSync([...staffList, { id: newId, name: 'ممرض جديد', role: 'Staff', grade: 'C', preference: 'cycle', maxConsecutive: 3, targetShifts: defaultTarget, vacationDays: [] }]);
  };

  const removeStaff = (id) => setStaffListAndSync(staffList.filter(s => s.id !== id));
  const updateStaff = (id, field, value) => setStaffListAndSync(staffList.map(s => s.id === id ? { ...s, [field]: value } : s));
  
  const toggleVacationDay = (staffId, dayIndex) => {
    const staff = staffList.find(s => s.id === staffId);
    let newVacations = staff.vacationDays.includes(dayIndex) ? staff.vacationDays.filter(d => d !== dayIndex) : [...staff.vacationDays, dayIndex];
    setStaffListAndSync(staffList.map(s => s.id === staffId ? { ...s, vacationDays: newVacations } : s));
  };

  const resetRoster = () => { if(window.confirm("هل أنت متأكد؟")) { setRosterAndSync([]); setLogs([]); setStaffStats({}); } };

  const generateRoster = () => {
    if (!config || !staffList) return; 
    const shiftTypes = getShiftsForSystem(config.shiftSystem);
    const newRoster = []; 
    const generationLogs = [];
    let staffState = {}; 
    staffList.forEach(s => staffState[s.id] = { lastShift: null, consecutiveDays: 0, totalShifts: 0 });

    for (let dayIndex = 1; dayIndex <= config.durationDays; dayIndex++) {
      const dateInfo = getFullDateLabel(dayIndex);
      let dailyShifts = {};
      shiftTypes.forEach(shift => {
        let assignedShiftStaff = []; 
        let needCharge = 1; let needMed = config.requireMedicationNurse ? 1 : 0; let needStaff = config.minStaffOnlyCount; 

        const isAvailable = (staff) => {
          const state = staffState[staff.id];
          if (staff.vacationDays.includes(dayIndex)) return false;
          if (Object.values(dailyShifts).flat().some(s => s.id === staff.id)) return false;
          if (state.consecutiveDays >= staff.maxConsecutive) return false;
          if (!config.allowDayAfterNight && (state.lastShift === 'N' || state.lastShift === 'Night')) return false;
          if (state.totalShifts >= staff.targetShifts + 2) return false;
          return true;
        };

        let candidates = staffList.filter(s => isAvailable(s));
        const scoreStaff = (staff) => { 
          let score = (staff.targetShifts - (staffState[staff.id].totalShifts || 0)) * 10;
          if (staff.preference === 'cycle' && staffState[staff.id].consecutiveDays > 0) score += 5;
          if (staff.grade === 'A') score += 2;
          return score;
        };
        candidates.sort((a, b) => scoreStaff(b) - scoreStaff(a));

        let chargeNurse = candidates.find(s => s.role === 'Charge');
        if (!chargeNurse && candidates.length > 0) { chargeNurse = candidates[0]; generationLogs.push(`${dateInfo.str} ${shift.label}: ${chargeNurse.name} Acting Charge.`); }
        if (chargeNurse) assignedShiftStaff.push({ ...chargeNurse, assignedRole: 'Charge' });

        if (needMed > 0) {
          const medNurse = candidates.find(s => s.role === 'Medication' && !assignedShiftStaff.some(a => a.id === s.id));
          if (medNurse) assignedShiftStaff.push({ ...medNurse, assignedRole: 'Medication' });
        }

        while (needStaff > 0) {
          const nextStaff = candidates.find(s => !assignedShiftStaff.some(a => a.id === s.id));
          if (nextStaff) assignedShiftStaff.push({ ...nextStaff, assignedRole: 'Staff' }); else break;
          needStaff--;
        }

        assignedShiftStaff.forEach(s => { staffState[s.id].lastShift = shift.code; staffState[s.id].consecutiveDays += 1; staffState[s.id].totalShifts += 1; });
        const workedIds = assignedShiftStaff.map(s => s.id);
        staffList.forEach(s => { if (!workedIds.includes(s.id)) { staffState[s.id].consecutiveDays = 0; staffState[s.id].lastShift = null; } });
        dailyShifts[shift.code] = assignedShiftStaff;
      });
      newRoster.push({ dayIndex, dateInfo, shifts: dailyShifts });
    }
    setRosterAndSync(newRoster); setLogs(generationLogs); setStaffStats(staffState); setActiveTab('roster');
  };

  const handlePremiumFeature = (action) => {
    if (isPremium) action(); else setShowPaymentModal(true);
  };

  const exportRosterToCSV = () => {
    if (roster.length === 0) { alert("الجدول فارغ!"); return; }
    const shiftTypes = getShiftsForSystem(config.shiftSystem).map(s => s.label);
    let csvContent = `التاريخ,اليوم,${shiftTypes.join(',')}\n`;
    roster.forEach(row => {
      let rowData = `${row.dateInfo.str},${row.dateInfo.dayName}`;
      shiftTypes.forEach(label => {
        const shiftCode = getShiftsForSystem(config.shiftSystem).find(s => s.label === label).code;
        const assigned = row.shifts[shiftCode] || [];
        const staffString = assigned.map(s => `${s.name} (${s.assignedRole})`).join(' / ');
        rowData += `,"${staffString}"`;
      });
      csvContent += rowData + '\n';
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Roster_${config.month + 1}_${config.year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRosterToPDF = () => { window.print(); };

  const handleAuthSubmit = async (e, mode) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      else await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      setShowAuthModal(false);
    } catch (error) { setAuthError("فشل العملية: " + error.message); }
  };

  // --- RENDERERS ---

  const renderLoading = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center py-10 animate-pulse">
        <div className="border-t-4 border-indigo-500 border-solid rounded-full w-12 h-12 mx-auto mb-4 animate-spin"></div>
        <p className="text-indigo-600 font-bold">جاري الاتصال بالسحابة...</p>
      </div>
      {/* Emergency Reset Button */}
      <button 
        onClick={() => { signOut(auth); window.location.reload(); }} 
        className="mt-4 text-xs text-slate-400 underline hover:text-red-500"
      >
        هل استغرق الأمر وقتاً طويلاً؟ اضغط هنا لإعادة التعيين
      </button>
    </div>
  );

  const renderAuthModal = () => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={() => setShowAuthModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">{authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
            {authError && <div className="bg-rose-100 text-rose-700 p-3 rounded-lg mb-4 text-sm text-center">{authError}</div>}
            <form onSubmit={(e) => handleAuthSubmit(e, authMode)} className="space-y-4">
                <input name="email" type="email" placeholder="البريد الإلكتروني" required className="w-full p-3 border rounded-lg" />
                <input name="password" type="password" placeholder="كلمة المرور" required className="w-full p-3 border rounded-lg" />
                <button type="submit" className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700">{authMode === 'login' ? 'دخول' : 'تسجيل'}</button>
            </form>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-indigo-600 mt-4 hover:underline">
                {authMode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
            </button>
        </div>
    </div>
  );

  const renderPaymentModal = () => (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white text-center relative">
              <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 left-4 text-white/80 hover:text-white"><X/></button>
              <Lock className="w-12 h-12 mx-auto mb-2 opacity-90" />
              <h2 className="text-xl font-bold">ميزة للمشتركين فقط</h2>
              <p className="text-indigo-100 text-sm mt-1">اشترك الآن واحصل على كامل الصلاحيات</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                 <p className="text-gray-600 font-bold">سعر الاشتراك الشامل</p>
                 <div className="text-3xl font-black text-indigo-600">{paymentInfo.price} <span className="text-sm text-gray-400">/ مدى الحياة</span></div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                 <div className="flex items-center justify-between p-2 border-b border-slate-200">
                    <span className="font-bold text-slate-700 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500"/> InstaPay</span>
                    <span className="font-mono bg-white px-2 py-1 rounded border select-all dir-ltr">{paymentInfo.instapay}</span>
                 </div>
                 <div className="flex items-center justify-between p-2">
                    <span className="font-bold text-slate-700 flex items-center gap-2"><Phone className="w-4 h-4 text-green-600"/> محفظة</span>
                    <span className="font-mono bg-white px-2 py-1 rounded border select-all dir-ltr">{paymentInfo.wallet}</span>
                 </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-xs text-slate-500">بعد التحويل، اضغط بالأسفل لإرسال صورة التحويل واتساب</p>
                <a href={`https://wa.me/${paymentInfo.whatsapp}?text=أريد الاشتراك في تطبيق الروستر. قمت بتحويل المبلغ.`} target="_blank" className="w-full block bg-green-500 text-white p-3 rounded-xl font-bold hover:bg-green-600 shadow-lg shadow-green-200 transition-transform hover:-translate-y-1">
                   <div className="flex items-center justify-center gap-2"><MessageCircle /> تفعيل الاشتراك عبر واتساب</div>
                </a>
              </div>
            </div>
        </div>
    </div>
  );

  if (loading || config === null || staffList === null) {
      return renderLoading();
  }
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700" dir="rtl">
      {showAuthModal && renderAuthModal()}
      {showPaymentModal && renderPaymentModal()}
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-95 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2.5 rounded-xl shadow-lg">
                <Activity className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">ROSTER <span className="text-indigo-600">MAKER</span></h1>
                <div className="flex items-center gap-2">
                   <p className="text-xs text-slate-500 font-serif italic mt-0.5 tracking-wide">for Nurses</p>
                   {isPremium && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold border border-amber-200">Premium 👑</span>}
                   {isAdmin && <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded-full font-bold">Admin 🛠️</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              <button onClick={userEmail ? () => signOut(auth) : () => setShowAuthModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${userEmail ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {userEmail ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  {userEmail ? 'خروج' : 'دخول'}
              </button>
              <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                 {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'}, {id:'contact', icon:MessageCircle, label:'تواصل'} ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <tab.icon className={`w-4 h-4 ml-2 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} /> {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => { setActiveTab('roster'); generateRoster(); }} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 md:px-6 py-2.5 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 group">
                <div className="bg-white/20 p-1 rounded-full group-hover:bg-white/30 transition-colors"><Play className="w-4 h-4 fill-current" /></div>
                <span className="hidden sm:inline">توزيع</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide print:hidden">
            {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'}, {id:'contact', icon:MessageCircle, label:'تواصل'} ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all border ${activeTab === tab.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                <tab.icon className="w-4 h-4 ml-2" /> {tab.label}
              </button>
            ))}
        </div>

        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
             {/* Admin Control Panel - Only Visible to Admin */}
             {isAdmin && (
                 <div className="bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                     <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2">
                        <ShieldCheck className="text-emerald-400"/>
                        <h3 className="font-bold text-lg">لوحة تحكم الأدمن (تعديل بيانات الدفع)</h3>
                     </div>
                     <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">السعر</label>
                            <input type="text" value={paymentInfo.price} onChange={(e) => setPaymentInfo({...paymentInfo, price: e.target.value})} className="w-full p-3 bg-slate-700 border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">InstaPay Username</label>
                            <input type="text" value={paymentInfo.instapay} onChange={(e) => setPaymentInfo({...paymentInfo, instapay: e.target.value})} className="w-full p-3 bg-slate-700 border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">رقم المحفظة</label>
                            <input type="text" value={paymentInfo.wallet} onChange={(e) => setPaymentInfo({...paymentInfo, wallet: e.target.value})} className="w-full p-3 bg-slate-700 border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">رقم واتساب</label>
                            <input type="text" value={paymentInfo.whatsapp} onChange={(e) => setPaymentInfo({...paymentInfo, whatsapp: e.target.value})} className="w-full p-3 bg-slate-700 border-slate-600 rounded-lg text-white" />
                        </div>
                        <div className="md:col-span-2">
                            <button onClick={updateAdminSettings} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
                                <Save className="w-5 h-5"/> حفظ التعديلات العامة
                            </button>
                        </div>
                     </div>
                 </div>
             )}

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase">نظام العمل</h4>
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">بداية الروستر</label>
                                    <div className="flex gap-2">
                                    <input type="number" min="1" max="31" value={config.startDay} onChange={(e) => setConfigAndSync({...config, startDay: parseInt(e.target.value)})} className="w-20 p-2 border rounded font-bold text-center"/>
                                    <select value={config.month} onChange={(e) => setConfigAndSync({...config, month: parseInt(e.target.value)})} className="flex-1 p-2 border rounded font-bold">{months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}</select>
                                    <input type="number" value={config.year} onChange={(e) => setConfigAndSync({...config, year: parseInt(e.target.value)})} className="w-24 p-2 border rounded font-bold text-center"/>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">المدة (يوم)</label>
                                    <input type="number" value={config.durationDays} onChange={(e) => setConfigAndSync({...config, durationDays: parseInt(e.target.value)})} className="w-full p-2 border rounded font-bold"/>
                                </div>
                            </div>
                            <hr />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">النظام</label>
                                <select value={config.shiftSystem} onChange={(e) => setConfigAndSync({...config, shiftSystem: e.target.value})} className="w-full p-3 border rounded-lg">
                                    <option value="12h">12 ساعة (Day / Night)</option>
                                    <option value="8h">8 ساعات (3 Shifts)</option>
                                    <option value="24h">24 ساعة</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">الحد الأدنى (Staff)</label>
                                <input type="number" value={config.minStaffOnlyCount} onChange={(e) => setConfigAndSync({...config, minStaffOnlyCount: parseInt(e.target.value)})} className="w-24 p-3 border rounded-lg font-bold text-center"/>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase">السياسات</h4>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                            <label className="flex justify-between items-center p-3 bg-white border rounded-lg cursor-pointer"><span className="text-sm font-medium">Day بعد Night</span><input type="checkbox" checked={config.allowDayAfterNight} onChange={(e) => setConfigAndSync({...config, allowDayAfterNight: e.target.checked})} className="w-5 h-5"/></label>
                            <label className="flex justify-between items-center p-3 bg-white border rounded-lg cursor-pointer"><span className="text-sm font-medium">Medication Nurse</span><input type="checkbox" checked={config.requireMedicationNurse} onChange={(e) => setConfigAndSync({...config, requireMedicationNurse: e.target.checked})} className="w-5 h-5"/></label>
                            <label className="flex justify-between items-center p-3 bg-white border rounded-lg cursor-pointer"><span className="text-sm font-medium">أكثر من Charge</span><input type="checkbox" checked={config.allowMultipleCharge} onChange={(e) => setConfigAndSync({...config, allowMultipleCharge: e.target.checked})} className="w-5 h-5"/></label>
                        </div>
                    </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div className="flex items-center"><div className="bg-indigo-100 p-2 rounded-lg ml-3"><Users className="w-6 h-6 text-indigo-600"/></div><h3 className="font-bold text-slate-800">فريق العمل</h3></div>
                <div className="flex gap-2"><span className="text-xs text-green-600 flex items-center bg-green-50 px-2 rounded-full"><Save className="w-3 h-3 ml-1"/> Cloud</span><button onClick={addStaff} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 ml-1"/> جديد</button></div>
             </div>
             <div className="grid gap-6">
                {staffList.map(staff => (
                   <div key={staff.id} className="bg-white rounded-xl shadow-sm border p-5 relative">
                      <button onClick={() => removeStaff(staff.id)} className="absolute top-4 left-4 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         <div><label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label><input type="text" value={staff.name} onChange={(e) => updateStaff(staff.id, 'name', e.target.value)} className="w-full border-b-2 focus:border-indigo-500 outline-none font-bold"/></div>
                         <div><label className="text-xs font-bold text-slate-500 block mb-1">الدور</label><select value={staff.role} onChange={(e) => updateStaff(staff.id, 'role', e.target.value)} className="w-full border rounded p-1 text-sm">{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                         <div><label className="text-xs font-bold text-slate-500 block mb-1">Target</label><input type="number" value={staff.targetShifts} onChange={(e) => updateStaff(staff.id, 'targetShifts', parseInt(e.target.value))} className="w-16 border rounded text-center text-sm"/></div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">إجازات</label>
                            <div className="grid grid-cols-7 gap-1">
                               {Array.from({length: config.durationDays}, (_, i) => i + 1).map(d => (
                                  <button key={d} onClick={() => toggleVacationDay(staff.id, d)} className={`h-6 text-[9px] rounded ${staff.vacationDays.includes(d) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'roster' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border overflow-x-auto print:border-none print:shadow-none">
                 <div className="flex justify-between mb-4 print:hidden">
                    <h4 className="text-sm font-bold text-slate-600 flex items-center"><Activity className="w-5 h-5 ml-2 text-indigo-500"/> الإحصائيات</h4>
                    <div className="flex gap-2">
                       <button onClick={resetRoster} className="text-xs bg-slate-100 px-3 py-1 rounded hover:text-red-500 flex items-center"><RotateCcw className="w-3 h-3 ml-1"/> مسح</button>
                       <button onClick={() => handlePremiumFeature(exportRosterToCSV)} className={`text-xs px-3 py-1 rounded flex items-center ${isPremium ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                          {isPremium ? <Download className="w-3 h-3 ml-1"/> : <Lock className="w-3 h-3 ml-1"/>} CSV
                       </button>
                       <button onClick={() => handlePremiumFeature(exportRosterToPDF)} className={`text-xs px-3 py-1 rounded flex items-center ${isPremium ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                           {isPremium ? <Printer className="w-3 h-3 ml-1"/> : <Lock className="w-3 h-3 ml-1"/>} طباعة/PDF
                       </button>
                    </div>
                 </div>
                 <div className="flex space-x-3 space-x-reverse pb-2 min-w-max print:hidden">
                    {staffList.map(s => {
                       const actual = staffStats[s.id]?.totalShifts || 0;
                       const diff = actual - s.targetShifts;
                       let color = diff === 0 ? 'bg-emerald-50 border-emerald-200' : diff < 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200';
                       return <div key={s.id} className={`p-2 rounded border ${color} text-center w-24 flex-shrink-0`}><div className="text-xs font-bold truncate">{s.name}</div><div className="text-lg font-bold">{actual} <span className="text-xs text-slate-400">/ {s.targetShifts}</span></div></div>
                    })}
                 </div>
              </div>
              {logs.length > 0 && <div className="bg-amber-50 p-4 rounded border border-amber-200 max-h-40 overflow-y-auto text-xs text-amber-800 print:hidden"><ul className="list-disc pr-4">{logs.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
              <div className="bg-white rounded-xl shadow-sm border overflow-x-auto print:shadow-none print:border">
                 <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-800 text-white print:bg-slate-200 print:text-black">
                       <tr>
                          <th className="px-4 py-3 text-right w-24">التاريخ</th>
                          {getShiftsForSystem(config.shiftSystem).map(s => <th key={s.code} className="px-4 py-3 text-right border-l border-slate-700 print:border-slate-400">{s.label}</th>)}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                       {roster.map(row => (
                          <tr key={row.dayIndex} className="hover:bg-slate-50">
                             <td className="px-4 py-3 font-bold text-slate-700 border-l print:border-slate-300">{row.dateInfo.str} <span className="text-xs text-slate-400 block">{row.dateInfo.dayName}</span></td>
                             {getShiftsForSystem(config.shiftSystem).map(s => {
                                const assigned = row.shifts[s.code] || [];
                                return (
                                   <td key={s.code} className="px-4 py-3 align-top border-l print:border-slate-300">
                                      <div className="space-y-1">
                                         {assigned.map(st => (
                                            <div key={st.id} className="flex justify-between bg-white border rounded px-2 py-1 shadow-sm print:border-slate-300">
                                               <span className="font-bold text-slate-700">{st.name}</span>
                                               <span className="text-[10px] bg-slate-100 px-1 rounded print:bg-slate-200">{st.assignedRole}</span>
                                            </div>
                                         ))}
                                         {assigned.length < config.minStaffOnlyCount && <div className="text-xs text-rose-500 border-dashed border border-rose-300 rounded px-2 py-1 text-center print:hidden">عجز</div>}
                                      </div>
                                   </td>
                                )
                             })}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'contact' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-10 text-center text-white">
                 <MessageCircle className="w-12 h-12 mx-auto mb-2"/>
                 <h2 className="text-2xl font-bold">تواصل مع المطور</h2>
              </div>
              <div className="p-8 space-y-6">
                 <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border"><Mail className="text-indigo-600"/><span className="font-mono">mahmoudkhelfa20@gmail.com</span></div>
                 <div className="grid grid-cols-3 gap-4 text-center">
                    <a href="https://facebook.com" target="_blank" className="p-4 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><Facebook className="mx-auto mb-1"/><span className="text-xs font-bold">Facebook</span></a>
                    <a href="https://instagram.com" target="_blank" className="p-4 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-100"><Instagram className="mx-auto mb-1"/><span className="text-xs font-bold">Instagram</span></a>
                    <a href={`https://wa.me/${paymentInfo.whatsapp}`} target="_blank" className="p-4 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"><Phone className="mx-auto mb-1"/><span className="text-xs font-bold">WhatsApp</span></a>
                 </div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;