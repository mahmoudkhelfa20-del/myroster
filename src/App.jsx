import React, { useState, useEffect } from 'react';
import { 
  Users, Settings, Calendar, Plus, Trash2, Play, Activity,
  UserCog, MessageCircle, LogOut, LogIn, Save, Mail, Phone, Facebook, 
  Instagram, Sun, Moon, Clock, RotateCcw, Download, Printer, Lock, X, ShieldCheck, Upload, Image as ImageIcon, Copy, CheckCircle, UserCheck
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYfEuKC2x15joIBS082can9w0jdy_6_-0", 
  authDomain: "roster-maker-app.firebaseapp.com",
  projectId: "roster-maker-app",
  storageBucket: "roster-maker-app.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_UID = "lpHTOe8uAzbf8MNnX6SGw6W7B5h1"; 

const App = () => {
  const [activeTab, setActiveTab] = useState('staff');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [expiryDate, setExpiryDate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = userId === ADMIN_UID;
  const [targetUserUid, setTargetUserUid] = useState(""); 
  const [paymentInfo, setPaymentInfo] = useState({
    price: "1000 جنيه",
    instapay: "mahmoudkhelfa@instapay",
    wallet: "01205677601",
    whatsapp: "201205677601"
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState(null);
  
  const defaultInitialConfig = {
    shiftSystem: '12h', allowDayAfterNight: false, requireMedicationNurse: true, allowMultipleCharge: false,
    minStaffOnlyCount: 3, minSeniorCount: 1,
    startDay: 1, month: new Date().getMonth(), year: new Date().getFullYear(), durationDays: 30,
    hospitalName: "", hospitalLogo: null
  };

  const defaultInitialStaff = [
    { id: 1, staffId: '101', name: 'Admin Head', gender: 'M', role: 'Head Nurse', pos: 'HN', grade: 'A', preference: 'cycle', shiftPreference: 'auto', maxConsecutive: 5, targetShifts: 20, vacationDays: [] },
    { id: 2, staffId: '102', name: 'Senior Charge', gender: 'F', role: 'Charge', pos: 'CN', grade: 'A', preference: 'cycle', shiftPreference: 'auto', maxConsecutive: 3, targetShifts: 15, vacationDays: [] }, 
  ];

  const [config, setConfig] = useState(defaultInitialConfig); 
  const [staffList, setStaffList] = useState(defaultInitialStaff);
  const [roster, setRoster] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staffStats, setStaffStats] = useState({});

  const months = [ "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر" ];
  
  // --- DATE HELPERS ---
  const getDateFromIndex = (index) => { 
    if (!config) return new Date();
    const date = new Date(config.year, config.month, config.startDay);
    date.setDate(date.getDate() + (index - 1));
    return date;
  };

  const formatDate = (date) => `${date.getDate()}`; 
  
  const getFullDateLabel = (index) => {
    const date = getDateFromIndex(index);
    const dayNamesEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return {
      dateObj: date, 
      str: formatDate(date), 
      dayNum: date.getDate(), 
      dayName: dayNamesEn[date.getDay()], 
      isWeekend: date.getDay() === 5 
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

  // Updated Roles to include Head Nurse
  const roles = ['Head Nurse', 'Charge', 'Staff', 'Medication', 'Nurse Aid', 'Intern (Released)', 'Intern (Not Released)'];
  const grades = ['A', 'B', 'C', 'D'];
  const isSenior = (grade) => ['A', 'B'].includes(grade);
  const isCountable = (role) => ['Charge', 'Medication', 'Staff', 'Intern (Released)'].includes(role);

  // --- AUTH & DATA LOADING ---
  useEffect(() => {
    const fetchPaymentSettings = async () => {
        try {
            const docRef = doc(db, "settings", "payment");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { setPaymentInfo(docSnap.data()); }
        } catch (e) { console.log("Error fetching settings:", e); }
    };
    fetchPaymentSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        if (user.isAnonymous) setIsPremium(false); 
      } else {
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

  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, "rosters", userId);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig(data.config || defaultInitialConfig);
        setStaffList(data.staffList || defaultInitialStaff);
        setRoster(data.roster || []);
        if (data.subscriptionEndDate) {
            const now = new Date();
            const expiry = new Date(data.subscriptionEndDate);
            if (expiry > now) { setIsPremium(true); setExpiryDate(data.subscriptionEndDate); } else { setIsPremium(false); }
        } else { setIsPremium(data.isPremium === true); }
      } else {
        await setDoc(docRef, { config: defaultInitialConfig, staffList: defaultInitialStaff, roster: [], isPremium: false });
        setConfig(defaultInitialConfig); setStaffList(defaultInitialStaff);
        setIsPremium(false);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const updateFirestore = async (newConfig = config, newStaffList = staffList, newRoster = roster) => {
    if (!userId || !config || !staffList) return; 
    try { await setDoc(doc(db, "rosters", userId), { config: newConfig, staffList: newStaffList, roster: newRoster }, { merge: true }); } catch (e) { console.error(e); }
  };

  // --- CORE ACTIONS ---
  const updateAdminSettings = async () => {
      if (!isAdmin) return;
      if(window.confirm("هل تريد حفظ التعديلات العامة؟")) {
        try { await setDoc(doc(db, "settings", "payment"), paymentInfo); alert("تم الحفظ!"); } 
        catch(e) { alert("حدث خطأ: " + e.message); }
      }
  };

  const activateUserSubscription = async () => {
      if (!isAdmin) return;
      if (!targetUserUid) { alert("أدخل كود المستخدم أولاً"); return; }
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const expiryString = nextYear.toISOString().split('T')[0];
      if(window.confirm(`تفعيل للمستخدم ${targetUserUid} حتى ${expiryString}؟`)) {
          try { await updateDoc(doc(db, "rosters", targetUserUid), { subscriptionEndDate: expiryString, isPremium: true }); alert(`تم التفعيل!`); setTargetUserUid(""); } catch (e) { alert("فشل التفعيل: " + e.message); }
      }
  };

  const setConfigAndSync = (newConfig) => { setConfig(newConfig); updateFirestore(newConfig, staffList, roster); };
  const setStaffListAndSync = (newStaffList) => { setStaffList(newStaffList); updateFirestore(config, newStaffList, roster); };
  const setRosterAndSync = (newRoster) => { setRoster(newRoster); updateFirestore(config, staffList, newRoster); };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 500000) { alert("حجم كبير!"); return; }
        const reader = new FileReader();
        reader.onloadend = () => { setConfigAndSync({...config, hospitalLogo: reader.result}); };
        reader.readAsDataURL(file);
    }
  };

  const addStaff = () => {
    if (!isPremium && staffList.length >= 5) { alert("عفواً، النسخة المجانية تدعم 5 ممرضين فقط."); setShowPaymentModal(true); return; }
    const newId = staffList.length > 0 ? Math.max(...staffList.map(s => s.id)) + 1 : 1;
    setStaffListAndSync([...staffList, { 
        id: newId, staffId: '', name: 'ممرض جديد', gender: 'F', role: 'Staff', pos: 'SN', grade: 'C', 
        preference: 'cycle', shiftPreference: 'auto', maxConsecutive: 3, targetShifts: 15, vacationDays: [] 
    }]);
  };

  const removeStaff = (id) => setStaffListAndSync(staffList.filter(s => s.id !== id));
  
  // Updated updateStaff to handle POS correctly
  const updateStaff = (id, field, value) => {
      let newData = { [field]: value };
      if (field === 'role') {
          if (value === 'Head Nurse') newData.pos = 'HN';
          else if (value === 'Charge') newData.pos = 'CN';
          else if (value === 'Staff' || value === 'Medication') newData.pos = 'SN';
          else if (value.includes('Intern')) newData.pos = 'INT';
          else if (value === 'Nurse Aid') newData.pos = 'NA';
      }
      setStaffListAndSync(staffList.map(s => s.id === id ? { ...s, ...newData } : s));
  };

  const toggleVacationDay = (staffId, dayIndex) => {
    const staff = staffList.find(s => s.id === staffId);
    let newVacations = staff.vacationDays.includes(dayIndex) ? staff.vacationDays.filter(d => d !== dayIndex) : [...staff.vacationDays, dayIndex];
    setStaffListAndSync(staffList.map(s => s.id === staffId ? { ...s, vacationDays: newVacations } : s));
  };
  const resetRoster = () => { if(window.confirm("هل أنت متأكد؟")) { setRosterAndSync([]); setLogs([]); setStaffStats({}); } };

  // --- ROSTER GENERATION ---
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
        // Logic for requirements can be enhanced here
        let needStaff = config.minStaffOnlyCount; 
        let needSeniors = config.minSeniorCount || 1;

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
        
        // Simple Scoring
        const scoreStaff = (staff) => { 
          let score = (staff.targetShifts - (staffState[staff.id].totalShifts || 0)) * 10;
          if (staff.preference === 'cycle' && staffState[staff.id].consecutiveDays > 0) score += 5;
          if (staff.grade === 'A') score += 2;
          // Add preference logic...
          return score;
        };
        candidates.sort((a, b) => scoreStaff(b) - scoreStaff(a));

        // 1. Head/Charge assignment (Simplified for brevity, extend as needed)
        let chargeNurse = candidates.find(s => s.role === 'Charge');
        if (chargeNurse) assignedShiftStaff.push({ ...chargeNurse, assignedRole: 'Charge' });

        // 2. Staff Assignment
        let currentCountable = assignedShiftStaff.filter(s => isCountable(s.role)).length;
        while (currentCountable < needStaff) {
          const nextStaff = candidates.find(s => !assignedShiftStaff.some(a => a.id === s.id) && isCountable(s.role));
          if (nextStaff) { assignedShiftStaff.push({ ...nextStaff, assignedRole: 'Staff' }); currentCountable++; } else { break; }
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

  const handlePremiumFeature = (action) => { if (isPremium) action(); else setShowPaymentModal(true); };
  
  const exportRosterToCSV = () => {
    if (roster.length === 0) { alert("الجدول فارغ!"); return; }
    let csvContent = `NO,STAFF NAME,POS,ID,LEVEL,G,${roster.map(r => r.dateInfo.str).join(',')},Total D, Total N, Total\n`;
    staffList.forEach((staff, idx) => {
        const stats = { D: 0, N: 0 };
        let rowData = `${idx+1},"${staff.name}",${staff.pos || ''},${staff.staffId || ''},${staff.grade || ''},${staff.gender || ''}`;
        roster.forEach(r => {
            const isDay = r.shifts['D']?.some(s => s.id === staff.id) || r.shifts['M']?.some(s => s.id === staff.id);
            const isNight = r.shifts['N']?.some(s => s.id === staff.id);
            if (isDay) stats.D++;
            if (isNight) stats.N++;
            rowData += `,${isDay ? 'D' : isNight ? 'N' : 'X'}`;
        });
        rowData += `,${stats.D},${stats.N},${stats.D + stats.N}`;
        csvContent += rowData + '\n';
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRosterToPDF = () => { window.print(); };
  const handleAuthSubmit = async (e, mode) => {
    e.preventDefault();
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      else await createUserWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      setShowAuthModal(false);
    } catch (error) { setAuthError("فشل العملية: " + error.message); }
  };

  const renderLoading = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-pulse text-indigo-600 font-bold">جاري التحميل...</div>
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
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-indigo-600 mt-4 hover:underline">تبديل الوضع</button>
        </div>
    </div>
  );

  // Helper to categorize staff
  const getCategorizedStaff = () => {
      const categories = [
          { title: 'HEAD NURSE', role: 'Head Nurse' },
          { title: 'CHARGE NURSE', role: 'Charge' },
          { title: 'STAFF NURSE', role: 'Staff' }, // Include Medication here if needed, or separate
          { title: 'MEDICATION', role: 'Medication' },
          { title: 'NURSE AID', role: 'Nurse Aid' },
          { title: 'INTERNS', role: 'Intern (Released)' }
      ];
      
      return categories.map(cat => {
          // Filter staff by role. For interns, we might want to grab both released/not released
          const staffInCat = staffList.filter(s => {
              if (cat.title === 'INTERNS') return s.role.includes('Intern');
              return s.role === cat.role;
          });
          return { ...cat, staff: staffInCat };
      }).filter(cat => cat.staff.length > 0); // Only show categories that have staff
  };

  if (loading || config === null || staffList === null) { return renderLoading(); }
  
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700 overflow-x-auto" dir="rtl">
      {showAuthModal && renderAuthModal()}
      
      {/* --- PRINT HEADER --- */}
      <div className="hidden print:block bg-white">
         <div className="border-2 border-black mb-1 text-center">
             <div className="bg-blue-200 p-1 border-b border-black font-bold text-sm">Monthly Duty Roster ({months[config.month]} {config.year})</div>
             <div className="flex items-center p-2 gap-4 justify-center">
                 {config.hospitalLogo && <img src={config.hospitalLogo} className="h-12" alt="logo"/>}
                 <h1 className="font-bold text-xl">{config.hospitalName || "HOSPITAL NAME"}</h1>
             </div>
         </div>
      </div>

      {/* --- APP HEADER --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-slate-800">ROSTER <span className="text-indigo-600">MAKER</span></h1>
              {isPremium && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">Premium 👑</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={userEmail ? () => signOut(auth) : () => setShowAuthModal(true)} className="px-4 py-2 rounded-full bg-slate-100 text-sm font-bold">{userEmail ? 'خروج' : 'دخول'}</button>
              <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                 {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'} ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><tab.icon className="w-4 h-4 ml-2"/> {tab.label}</button>
                ))}
              </div>
              <button onClick={() => { setActiveTab('roster'); generateRoster(); }} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2"><Play className="w-4 h-4" /> توزيع</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[98%] mx-auto px-2 py-4 pb-24">
        {/* Mobile Tabs */}
        <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-2 print:hidden">
            {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'} ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 flex items-center px-4 py-2 rounded-full text-sm font-bold border ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}>{tab.label}</button>
            ))}
        </div>

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center">
                <div><h4 className="font-bold text-indigo-900 text-sm">User ID</h4><p className="text-xs font-mono select-all">{userId}</p></div>
                <button onClick={() => navigator.clipboard.writeText(userId)}><Copy className="w-5 h-5 text-indigo-600"/></button>
             </div>
             <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                 <h4 className="font-bold border-b pb-2">إعدادات الوقت</h4>
                 <div className="flex gap-4">
                    <div className="flex-1"><label className="block text-xs font-bold mb-1">الشهر</label><select value={config.month} onChange={(e) => setConfigAndSync({...config, month: parseInt(e.target.value)})} className="w-full p-2 border rounded">{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select></div>
                    <div className="flex-1"><label className="block text-xs font-bold mb-1">السنة</label><input type="number" value={config.year} onChange={(e) => setConfigAndSync({...config, year: parseInt(e.target.value)})} className="w-full p-2 border rounded"/></div>
                    <div className="flex-1"><label className="block text-xs font-bold mb-1">عدد الأيام</label><input type="number" value={config.durationDays} onChange={(e) => setConfigAndSync({...config, durationDays: parseInt(e.target.value)})} className="w-full p-2 border rounded"/></div>
                 </div>
             </div>
             <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                 <h4 className="font-bold border-b pb-2">هوية المستشفى</h4>
                 <input type="text" placeholder="اسم المستشفى" value={config.hospitalName} onChange={(e) => setConfigAndSync({...config, hospitalName: e.target.value})} className="w-full p-2 border rounded"/>
                 <input type="file" onChange={handleLogoUpload} className="w-full text-sm"/>
             </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4">
             <div className="flex justify-between bg-white p-4 rounded-xl shadow-sm border">
                <h3 className="font-bold text-slate-800">قائمة الموظفين</h3>
                <button onClick={addStaff} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 ml-1"/> إضافة</button>
             </div>
             <div className="grid gap-4">
                {staffList.map(staff => (
                   <div key={staff.id} className="bg-white rounded-xl shadow-sm border p-4 relative">
                      <button onClick={() => removeStaff(staff.id)} className="absolute top-4 left-4 text-red-400"><Trash2 className="w-4 h-4"/></button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-1">
                             <label className="text-[10px] font-bold text-slate-500">الاسم</label>
                             <input type="text" value={staff.name} onChange={(e) => updateStaff(staff.id, 'name', e.target.value)} className="w-full font-bold border-b"/>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                             <div><label className="text-[10px]">ID</label><input value={staff.staffId} onChange={(e) => updateStaff(staff.id, 'staffId', e.target.value)} className="w-full border rounded text-center text-xs"/></div>
                             <div><label className="text-[10px]">G</label><select value={staff.gender} onChange={(e) => updateStaff(staff.id, 'gender', e.target.value)} className="w-full border rounded text-center text-xs"><option value="M">M</option><option value="F">F</option></select></div>
                             <div><label className="text-[10px]">POS</label><input value={staff.pos} readOnly className="w-full bg-slate-50 border rounded text-center text-xs"/></div>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                             <div>
                                 <label className="text-[10px] font-bold block">الدور</label>
                                 <select value={staff.role} onChange={(e) => updateStaff(staff.id, 'role', e.target.value)} className="w-full border rounded text-xs">{roles.map(r=><option key={r} value={r}>{r}</option>)}</select>
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold block">نمط العمل</label>
                                 <select value={staff.preference} onChange={(e) => updateStaff(staff.id, 'preference', e.target.value)} className="w-full border rounded text-xs bg-indigo-50 text-indigo-900"><option value="cycle">متصل (Cycle)</option><option value="scattered">متقطع (Scattered)</option></select>
                             </div>
                         </div>
                         <div>
                             <label className="text-[10px] font-bold block">أيام الإجازة</label>
                             <div className="flex flex-wrap gap-1 mt-1">{Array.from({length: 15}, (_,i)=>i+1).map(d => <button key={d} onClick={() => toggleVacationDay(staff.id, d)} className={`w-5 h-5 text-[8px] rounded ${staff.vacationDays.includes(d) ? 'bg-red-500 text-white' : 'bg-slate-100'}`}>{d}</button>)}</div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'roster' && (
           <div className="space-y-6">
              <div className="bg-white p-2 rounded-xl shadow-sm border overflow-x-auto print:border-none print:shadow-none print:p-0">
                 <div className="flex justify-between mb-4 print:hidden">
                    <h4 className="font-bold text-indigo-900">الجدول النهائي</h4>
                    <div className="flex gap-2">
                       <button onClick={exportRosterToCSV} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded font-bold">CSV</button>
                       <button onClick={exportRosterToPDF} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded font-bold">PDF Print</button>
                    </div>
                 </div>

                 {/* --- CATEGORIZED TABLE START --- */}
                 <table className="w-full border-collapse text-[10px] font-sans border border-black text-center">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="border border-black w-6">NO.</th>
                            <th className="border border-black min-w-[120px]">STAFF NAME</th>
                            <th className="border border-black w-8">POS.</th>
                            <th className="border border-black w-8">ID</th>
                            <th className="border border-black w-6">LEVEL</th>
                            <th className="border border-black w-6">G</th>
                            {roster.length > 0 && roster.map((r, i) => (
                                <th key={i} className={`border border-black w-6 ${r.dateInfo.isWeekend ? 'bg-orange-200' : ''}`}>
                                    <div className="text-[8px] font-bold">{r.dateInfo.dayName.substring(0,3)}</div>
                                    <div>{r.dateInfo.dayNum}</div>
                                </th>
                            ))}
                            <th className="border border-black w-6 bg-gray-200">D</th>
                            <th className="border border-black w-6 bg-gray-200">N</th>
                            <th className="border border-black w-8 bg-gray-300">Total</th>
                        </tr>
                    </thead>
                    
                    {/* Render Body per Category */}
                    {getCategorizedStaff().map((category, catIdx) => {
                        const categoryStats = { D: 0, N: 0 }; // Accumulator for sub-total row

                        return (
                        <tbody key={catIdx}>
                            {/* SECTION HEADER */}
                            <tr className="bg-blue-50">
                                <td colSpan={6 + (roster.length) + 3} className="border border-black p-1 font-bold text-left px-4 text-blue-800 uppercase tracking-wider">
                                    {category.title}
                                </td>
                            </tr>

                            {/* STAFF ROWS */}
                            {category.staff.map((staff, sIdx) => {
                                const rowStats = { D: 0, N: 0 };
                                return (
                                    <tr key={staff.id} className="hover:bg-gray-50">
                                        <td className="border border-black">{sIdx + 1}</td>
                                        <td className="border border-black text-left px-1 font-bold whitespace-nowrap">{staff.name}</td>
                                        <td className="border border-black">{staff.pos}</td>
                                        <td className="border border-black">{staff.staffId}</td>
                                        <td className="border border-black">{staff.grade}</td>
                                        <td className="border border-black">{staff.gender}</td>
                                        
                                        {/* SHIFTS */}
                                        {roster.map((r, i) => {
                                            const isDay = r.shifts['D']?.some(s => s.id === staff.id) || r.shifts['M']?.some(s => s.id === staff.id);
                                            const isNight = r.shifts['N']?.some(s => s.id === staff.id);
                                            
                                            if (isDay) { rowStats.D++; categoryStats.D++; }
                                            if (isNight) { rowStats.N++; categoryStats.N++; }

                                            return (
                                                <td key={i} className={`border border-black font-bold ${r.dateInfo.isWeekend ? 'bg-orange-200' : ''} ${isDay ? 'bg-yellow-100' : ''}`}>
                                                    {isDay ? 'D' : isNight ? 'N' : <span className="text-red-500">X</span>}
                                                </td>
                                            );
                                        })}
                                        
                                        {/* ROW TOTALS */}
                                        <td className="border border-black font-bold bg-gray-100">{rowStats.D}</td>
                                        <td className="border border-black font-bold bg-gray-100">{rowStats.N}</td>
                                        <td className="border border-black font-bold bg-gray-200">{rowStats.D + rowStats.N}</td>
                                    </tr>
                                );
                            })}

                            {/* SUB-TOTAL ROW (The Gray Bar in image) */}
                            <tr className="bg-slate-300 font-bold border-t-2 border-black">
                                <td colSpan={6} className="border border-black p-1 text-center text-slate-800">TOTAL {category.title}</td>
                                {roster.map((r, i) => {
                                    // Calculate how many people in THIS category are working on THIS day
                                    const count = Object.values(r.shifts).flat().filter(s => category.staff.some(cs => cs.id === s.id)).length;
                                    return <td key={i} className={`border border-black text-[9px] ${count > 0 ? 'text-black' : 'text-transparent'}`}>{count || ''}</td>
                                })}
                                <td className="border border-black text-center">{categoryStats.D}</td>
                                <td className="border border-black text-center">{categoryStats.N}</td>
                                <td className="border border-black text-center">{categoryStats.D + categoryStats.N}</td>
                            </tr>
                            
                            {/* Spacer Row */}
                            <tr><td colSpan="100%" className="h-1 bg-white border-l border-r border-black"></td></tr>
                        </tbody>
                        );
                    })}

                    {/* GRAND TOTAL FOOTER */}
                    <tfoot className="bg-blue-200 font-bold border-t-2 border-black">
                        <tr>
                            <td colSpan={6} className="border border-black p-1 text-right px-2">GRAND TOTAL</td>
                            {roster.map((r, i) => {
                                const count = Object.values(r.shifts).flat().length;
                                return (
                                    <td key={i} className={`border border-black ${r.dateInfo.isWeekend ? 'bg-orange-300' : ''}`}>{count}</td>
                                )
                            })}
                            <td colSpan={3} className="border border-black bg-gray-300"></td>
                        </tr>
                    </tfoot>
                 </table>
                 {/* --- CATEGORIZED TABLE END --- */}

              </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;