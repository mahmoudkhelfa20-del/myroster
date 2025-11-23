import React, { useState, useEffect } from 'react';
import { 
  Users, Settings, Calendar, Plus, Trash2, Play, Activity,
  UserCog, MessageCircle, LogOut, LogIn, Save, Mail, Phone, Facebook, 
  Instagram, Sun, Moon, Clock, RotateCcw, Download, Printer, Lock, X, ShieldCheck, Upload, Image as ImageIcon, Copy, CheckCircle, UserCheck, AlertTriangle
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYfEuKC2x15joIBS082can9w0jdy_6_-0", 
  authDomain: "roster-maker-app.firebaseapp.com",
  projectId: "roster-maker-app",
  storageBucket: "roster-maker-app.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// تأكد من أن هذا الـ UID مطابق لحسابك كأدمن
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
  
  // State للعجز
  const [shortageWarnings, setShortageWarnings] = useState([]);

  const defaultInitialConfig = {
    shiftSystem: '12h', 
    allowDoubleShift: false, 
    maxConsecutiveWork: 5,   
    maxConsecutiveOff: 4,    
    requireMedicationNurse: true, 
    allowMultipleCharge: false,
    minStaffOnlyCount: 3, 
    minSeniorCount: 1,
    startDay: 1, month: new Date().getMonth(), year: new Date().getFullYear(), durationDays: 30,
    hospitalName: "", hospitalLogo: null
  };

  const defaultInitialStaff = [
    // تم إضافة cycleWorkDays و cycleOffDays هنا
    { id: 1, staffId: '101', name: 'أحمد محمد', gender: 'M', role: 'Charge', pos: 'CN', grade: 'A', preference: 'cycle', cycleWorkDays: 5, cycleOffDays: 4, shiftPreference: 'auto', maxConsecutive: 5, targetShifts: 15, vacationDays: [] },
    { id: 2, staffId: '102', name: 'سارة علي', gender: 'F', role: 'Staff', pos: 'SN', grade: 'B', preference: 'scattered', cycleWorkDays: 5, cycleOffDays: 4, shiftPreference: 'auto', maxConsecutive: 5, targetShifts: 15, vacationDays: [] }, 
  ];

  const [config, setConfig] = useState(defaultInitialConfig); 
  const [staffList, setStaffList] = useState(defaultInitialStaff);
  const [roster, setRoster] = useState([]);
  const [staffStats, setStaffStats] = useState({});

  const months = [ "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر" ];
  
  const getDateFromIndex = (index) => { 
    if (!config) return new Date();
    const date = new Date(config.year, config.month, config.startDay);
    date.setDate(date.getDate() + (index - 1));
    return date;
  };

  const formatDate = (date) => { return `${date.getDate()}`; }; 
  
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

  const roles = ['Charge', 'Medication', 'Staff', 'Nurse Aid', 'Intern (Released)', 'Intern (Not Released)'];
  const grades = ['A', 'B', 'C', 'D'];
  const isSenior = (grade) => ['A', 'B'].includes(grade);
  const isCountable = (role) => ['Charge', 'Medication', 'Staff', 'Intern (Released)'].includes(role);

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
        const loadedConfig = data.config || defaultInitialConfig;
        setConfig({ ...defaultInitialConfig, ...loadedConfig });
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

  const calculateMonthlyDuration = (startDay, month, year) => {
      const startDate = new Date(year, month, startDay);
      const endDate = new Date(year, month + 1, startDay); 
      const diffTime = Math.abs(endDate - startDate);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleConfigDateChange = (field, value) => {
      let newConfig = { ...config, [field]: value };
      if (field === 'startDay' || field === 'month' || field === 'year') {
          const d = field === 'startDay' ? parseInt(value) : config.startDay;
          const m = field === 'month' ? parseInt(value) : config.month;
          const y = field === 'year' ? parseInt(value) : config.year;
          newConfig.durationDays = calculateMonthlyDuration(d, m, y);
      }
      setConfigAndSync(newConfig);
  };

  const updateFirestore = async (newConfig = config, newStaffList = staffList, newRoster = roster) => {
    if (!userId || !config || !staffList) return; 
    try { await setDoc(doc(db, "rosters", userId), { config: newConfig, staffList: newStaffList, roster: newRoster }, { merge: true }); } catch (e) { console.error(e); }
  };

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
    const defaultPos = 'SN'; 
    setStaffListAndSync([...staffList, { 
        id: newId, staffId: '', name: 'ممرض جديد', gender: 'F', role: 'Staff', pos: defaultPos, grade: 'C', 
        preference: 'cycle', cycleWorkDays: 5, cycleOffDays: 4, shiftPreference: 'auto', maxConsecutive: 5, targetShifts: 15, vacationDays: [] 
    }]);
  };

  const removeStaff = (id) => setStaffListAndSync(staffList.filter(s => s.id !== id));
  
  const updateStaff = (id, field, value) => {
      let newData = { [field]: value };
      if (field === 'role') {
          if (value === 'Charge') { newData.pos = 'CN'; } 
          else if (value === 'Staff' || value === 'Medication') { newData.pos = 'SN'; } 
          else if (value.includes('Intern')) { newData.pos = 'INT'; } 
          else if (value === 'Nurse Aid') { newData.pos = 'NA'; }
      }
      setStaffListAndSync(staffList.map(s => s.id === id ? { ...s, ...newData } : s));
  };

  const toggleVacationDay = (staffId, dayIndex) => {
    const staff = staffList.find(s => s.id === staffId);
    let newVacations = staff.vacationDays.includes(dayIndex) ? staff.vacationDays.filter(d => d !== dayIndex) : [...staff.vacationDays, dayIndex];
    setStaffListAndSync(staffList.map(s => s.id === staffId ? { ...s, vacationDays: newVacations } : s));
  };

  const resetRoster = () => { 
      if(window.confirm("هل أنت متأكد؟")) { 
          setRosterAndSync([]); 
          setStaffStats({}); 
          setShortageWarnings([]);
      } 
  };

  // --- 1. منطق التوزيع المحسن (مع دعم السايكل القوية) ---
  const generateRoster = () => {
    if (!config || !staffList) return; 
    const shiftTypes = getShiftsForSystem(config.shiftSystem);
    const newRoster = []; 
    let currentShortages = []; 
    let staffState = {}; 
    staffList.forEach(s => {
        staffState[s.id] = { lastShift: null, consecutiveWorkDays: 0, consecutiveOffDays: 0, totalShifts: 0 };
    });

    for (let dayIndex = 1; dayIndex <= config.durationDays; dayIndex++) {
      const dateInfo = getFullDateLabel(dayIndex);
      let dailyShifts = {};
      
      shiftTypes.forEach(shift => {
        let assignedShiftStaff = []; 
        let needCharge = 1; let needMed = config.requireMedicationNurse ? 1 : 0; let needStaff = config.minStaffOnlyCount; 
        let needAid = 1; let needSeniors = config.minSeniorCount || 1;

        const isAvailable = (staff) => {
          const state = staffState[staff.id];
          if (staff.vacationDays.includes(dayIndex)) return false;
          if (Object.values(dailyShifts).flat().some(s => s.id === staff.id)) return false;
          
          // === إضافة منطق السايكل (Strict Modulo) ===
          if (staff.preference === 'cycle') {
             const work = staff.cycleWorkDays || 5;
             const off = staff.cycleOffDays || 4;
             const cycleLen = work + off;
             // معادلة رياضية لتحديد الأيام بدقة
             const dayInCycle = (dayIndex + staff.id) % cycleLen; 
             if (dayInCycle >= work) return false; // هذا يوم راحة إجباري
          }
          // =========================================

          if (state.consecutiveWorkDays >= config.maxConsecutiveWork) return false;
          if (!config.allowDoubleShift && state.lastShift === 'N' && shift.code === 'D') return false;
          if (state.totalShifts >= staff.targetShifts + 2) return false;
          return true;
        };

        let candidates = staffList.filter(s => isAvailable(s));

        const scoreStaff = (staff) => { 
            const state = staffState[staff.id];
            let score = (staff.targetShifts - state.totalShifts) * 10;
            if (staff.preference === 'cycle' && state.consecutiveWorkDays > 0) score += 50; // أولوية قصوى لإكمال السايكل
            if (staff.grade === 'A') score += 2;
            if (config.shiftSystem === '12h') {
                const pref = staff.shiftPreference || 'auto';
                const isDayShift = shift.code === 'D';
                if (pref === 'all_day') { if (isDayShift) score += 100; else score -= 1000; }
                else if (pref === 'all_night') { if (!isDayShift) score += 100; else score -= 1000; }
                else if (pref === 'mostly_day') { if (isDayShift) score += 20; else score -= 20; }
                else if (pref === 'mostly_night') { if (!isDayShift) score += 20; else score -= 20; }
            }
            return score;
        };

        candidates.sort((a, b) => scoreStaff(b) - scoreStaff(a));

        let chargeNurse = candidates.find(s => s.role === 'Charge');
        if (!chargeNurse && candidates.length > 0) chargeNurse = candidates.find(s => isCountable(s.role) && isSenior(s.grade));
        if (chargeNurse) assignedShiftStaff.push({ ...chargeNurse, assignedRole: 'Charge' });

        if (needAid > 0) {
            const aid = candidates.find(s => s.role === 'Nurse Aid' && !assignedShiftStaff.some(a => a.id === s.id));
            if (aid) assignedShiftStaff.push({ ...aid, assignedRole: 'Nurse Aid' });
        }

        if (needMed > 0) {
          const medNurse = candidates.find(s => s.role === 'Medication' && !assignedShiftStaff.some(a => a.id === s.id));
          if (medNurse) assignedShiftStaff.push({ ...medNurse, assignedRole: 'Medication' });
        }

        let currentSeniors = assignedShiftStaff.filter(s => isSenior(s.grade)).length;
        while (currentSeniors < needSeniors) {
            const seniorCandidate = candidates.find(s => !assignedShiftStaff.some(a => a.id === s.id) && isCountable(s.role) && isSenior(s.grade));
            if (seniorCandidate) { assignedShiftStaff.push({ ...seniorCandidate, assignedRole: 'Staff (Senior)' }); currentSeniors++; } else { break; }
        }

        let currentCountable = assignedShiftStaff.filter(s => isCountable(s.role)).length;
        while (currentCountable < needStaff) {
          const nextStaff = candidates.find(s => !assignedShiftStaff.some(a => a.id === s.id) && isCountable(s.role));
          if (nextStaff) { assignedShiftStaff.push({ ...nextStaff, assignedRole: 'Staff' }); currentCountable++; } else { break; }
        }

        const internsNotReleased = candidates.filter(s => s.role === 'Intern (Not Released)' && !assignedShiftStaff.some(a => a.id === s.id) && staffState[s.id].totalShifts < s.targetShifts);
        if (internsNotReleased.length > 0) assignedShiftStaff.push({ ...internsNotReleased[0], assignedRole: 'Intern (Training)' });

        if (currentCountable < needStaff) {
            currentShortages.push({
                day: dateInfo.str,
                dayName: dateInfo.dayName,
                shift: shift.label,
                needed: needStaff,
                actual: currentCountable,
                missing: needStaff - currentCountable
            });
        }

        assignedShiftStaff.forEach(s => { 
            staffState[s.id].lastShift = shift.code; 
            staffState[s.id].consecutiveWorkDays += 1; 
            staffState[s.id].consecutiveOffDays = 0; 
            staffState[s.id].totalShifts += 1; 
        });
        
        dailyShifts[shift.code] = assignedShiftStaff;
      });

      const workedIds = Object.values(dailyShifts).flat().map(s => s.id);
      staffList.forEach(s => { 
          if (!workedIds.includes(s.id)) { 
              staffState[s.id].consecutiveWorkDays = 0; 
              staffState[s.id].consecutiveOffDays += 1; 
          } 
      });

      newRoster.push({ dayIndex, dateInfo, shifts: dailyShifts });
    }

    setRosterAndSync(newRoster); 
    setStaffStats(staffState); 
    setShortageWarnings(currentShortages);
    setActiveTab('roster');
  };

  // --- 2. دالة التعديل اليدوي (Manual Override) ---
  const toggleShiftCell = (dayIndex, staffId) => {
    if (!isPremium) {
       alert("التعديل اليدوي متاح في النسخة المدفوعة فقط.");
       setShowPaymentModal(true);
       return;
    }

    const newRoster = [...roster];
    const dayData = newRoster.find(r => r.dayIndex === dayIndex);
    
    if (dayData) {
      const isDay = dayData.shifts['D']?.some(s => s.id === staffId) || dayData.shifts['M']?.some(s => s.id === staffId);
      const isNight = dayData.shifts['N']?.some(s => s.id === staffId);
      const staffMember = staffList.find(s => s.id === staffId);
      if (!staffMember) return;

      if (isDay) {
        // Switch Day -> Night
        if (dayData.shifts['D']) dayData.shifts['D'] = dayData.shifts['D'].filter(s => s.id !== staffId);
        if (dayData.shifts['M']) dayData.shifts['M'] = dayData.shifts['M'].filter(s => s.id !== staffId);
        if (!dayData.shifts['N']) dayData.shifts['N'] = [];
        dayData.shifts['N'].push({ ...staffMember, assignedRole: 'Manual' });
      } else if (isNight) {
        // Switch Night -> Off
        if (dayData.shifts['N']) dayData.shifts['N'] = dayData.shifts['N'].filter(s => s.id !== staffId);
      } else {
        // Switch Off -> Day
        const code = config.shiftSystem === '12h' ? 'D' : 'M';
        if (!dayData.shifts[code]) dayData.shifts[code] = [];
        dayData.shifts[code].push({ ...staffMember, assignedRole: 'Manual' });
      }
      setRosterAndSync(newRoster);
    }
  };

  // --- 3. دالة تصدير الإكسل الملون (HTML Based) ---
  const exportToExcel = () => {
    if (!isPremium) { setShowPaymentModal(true); return; }
    
    const table = document.getElementById("roster-table-export");
    if (!table) return;

    const htmlContext = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1px solid #000000; text-align: center; vertical-align: middle; }
            </style>
        </head>
        <body>
            ${table.outerHTML}
        </body>
        </html>
    `;

    const blob = new Blob([htmlContext], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Roster_${months[config.month]}_${config.year}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePremiumFeature = (action) => { if (isPremium) action(); else setShowPaymentModal(true); };
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

  const renderLoading = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center py-10 animate-pulse"><div className="border-t-4 border-indigo-500 border-solid rounded-full w-12 h-12 mx-auto mb-4 animate-spin"></div><p className="text-indigo-600 font-bold">جاري الاتصال بالسحابة...</p></div>
      <button onClick={() => { signOut(auth); window.location.reload(); }} className="mt-4 text-xs text-slate-400 underline hover:text-red-500">هل استغرق الأمر وقتاً طويلاً؟ اضغط هنا لإعادة التعيين</button>
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
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm text-indigo-600 mt-4 hover:underline">{authMode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}</button>
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
              <div className="text-center space-y-2"><p className="text-gray-600 font-bold">سعر الاشتراك السنوي</p><div className="text-3xl font-black text-indigo-600">{paymentInfo.price} <span className="text-sm text-gray-400">/ سنة</span></div></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                 <div className="flex items-center justify-between p-2 border-b border-slate-200"><span className="font-bold text-slate-700 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500"/> InstaPay</span><span className="font-mono bg-white px-2 py-1 rounded border select-all dir-ltr">{paymentInfo.instapay}</span></div>
                 <div className="flex items-center justify-between p-2"><span className="font-bold text-slate-700 flex items-center gap-2"><Phone className="w-4 h-4 text-green-600"/> محفظة</span><span className="font-mono bg-white px-2 py-1 rounded border select-all dir-ltr">{paymentInfo.wallet}</span></div>
              </div>
              <div className="text-center space-y-3"><p className="text-xs text-slate-500">بعد التحويل، انسخ "كود الحساب" من الإعدادات وارسله لنا واتساب</p><a href={`https://wa.me/${paymentInfo.whatsapp}?text=أريد تفعيل الاشتراك. هذا كود حسابي: ${userId}`} target="_blank" className="w-full block bg-green-500 text-white p-3 rounded-xl font-bold hover:bg-green-600 shadow-lg shadow-green-200 transition-transform hover:-translate-y-1"><div className="flex items-center justify-center gap-2"><MessageCircle /> إرسال الكود لتفعيل الاشتراك</div></a></div>
            </div>
        </div>
    </div>
  );

  if (loading || config === null || staffList === null) { return renderLoading(); }
  
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-700 overflow-x-auto" dir="rtl">
      {showAuthModal && renderAuthModal()}
      {showPaymentModal && renderPaymentModal()}
      
      <div className="hidden print:block bg-white">
         <div className="border-2 border-black mb-1 text-center">
             <div className="bg-blue-200 p-1 border-b border-black font-bold text-sm">Monthly Duty Roster ({months[config.month]} {config.year})</div>
             <div className="flex items-center p-2 gap-4 justify-center">
                 {config.hospitalLogo && <img src={config.hospitalLogo} className="h-12" alt="logo"/>}
                 <h1 className="font-bold text-xl">{config.hospitalName || "HOSPITAL NAME"}</h1>
             </div>
         </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-95 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2.5 rounded-xl shadow-lg"><Activity className="w-7 h-7" /></div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">ROSTER <span className="text-indigo-600">MAKER</span></h1>
                <div className="flex items-center gap-2">
                   <p className="text-xs text-slate-500 font-serif italic mt-0.5 tracking-wide">for Nurses</p>
                   {isPremium && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">Premium 👑 <span className="opacity-50 font-normal hidden sm:inline">| Exp: {expiryDate}</span></span>}
                   {isAdmin && <span className="text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded-full font-bold">Admin 🛠️</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              <button onClick={userEmail ? () => signOut(auth) : () => setShowAuthModal(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${userEmail ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>{userEmail ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}{userEmail ? 'خروج' : 'دخول'}</button>
              <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                 {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'}, {id:'contact', icon:MessageCircle, label:'تواصل'} ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><tab.icon className={`w-4 h-4 ml-2 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} /> {tab.label}</button>
                ))}
              </div>
              <button onClick={() => { setActiveTab('roster'); generateRoster(); }} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 md:px-6 py-2.5 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 group"><div className="bg-white/20 p-1 rounded-full group-hover:bg-white/30 transition-colors"><Play className="w-4 h-4 fill-current" /></div><span className="hidden sm:inline">توزيع</span></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[98%] mx-auto px-2 py-4 pb-24">
        <div className="md:hidden flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide print:hidden">
            {[ {id:'staff', icon:Users, label:'الفريق'}, {id:'settings', icon:UserCog, label:'الإعدادات'}, {id:'roster', icon:Calendar, label:'الجدول'}, {id:'contact', icon:MessageCircle, label:'تواصل'} ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all border ${activeTab === tab.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}><tab.icon className="w-4 h-4 ml-2" /> {tab.label}</button>
            ))}
        </div>

        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
             <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center">
                <div><h4 className="font-bold text-indigo-900 text-sm">كود الحساب (User ID)</h4><p className="text-xs text-indigo-600 mt-1 font-mono select-all">{userId || "غير مسجل"}</p></div>
                <button onClick={() => {navigator.clipboard.writeText(userId); alert("تم النسخ!");}} className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-full"><Copy className="w-5 h-5"/></button>
             </div>
             {isAdmin && (
                 <div className="bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                     <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2"><ShieldCheck className="text-emerald-400"/><h3 className="font-bold text-lg">لوحة تحكم الأدمن</h3></div>
                     <div className="p-6 space-y-6">
                        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600"><h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4"/> تفعيل اشتراك لمستخدم</h4><div className="flex gap-2"><input type="text" placeholder="UID" value={targetUserUid} onChange={(e) => setTargetUserUid(e.target.value)} className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"/><button onClick={activateUserSubscription} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold">تفعيل سنة</button></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs text-slate-400 mb-1">السعر</label><input type="text" value={paymentInfo.price} onChange={(e) => setPaymentInfo({...paymentInfo, price: e.target.value})} className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" /></div><div><label className="block text-xs text-slate-400 mb-1">رقم واتساب</label><input type="text" value={paymentInfo.whatsapp} onChange={(e) => setPaymentInfo({...paymentInfo, whatsapp: e.target.value})} className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" /></div></div><button onClick={updateAdminSettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded font-bold text-sm flex items-center justify-center gap-2"><Save className="w-4 h-4"/> حفظ بيانات الدفع</button></div></div>)}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase">نظام العمل</h4>
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">بداية الروستر</label><div className="flex gap-2"><input type="number" min="1" max="31" value={config.startDay} onChange={(e) => handleConfigDateChange('startDay', e.target.value)} className="w-20 p-2 border rounded font-bold text-center"/><select value={config.month} onChange={(e) => handleConfigDateChange('month', e.target.value)} className="flex-1 p-2 border rounded font-bold">{months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}</select><input type="number" value={config.year} onChange={(e) => handleConfigDateChange('year', e.target.value)} className="w-24 p-2 border rounded font-bold text-center"/></div></div>
                                <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">المدة (يوم)</label><input type="number" value={config.durationDays} disabled className="w-full p-2 border rounded font-bold bg-gray-100 text-gray-500 cursor-not-allowed"/></div>
                            </div>
                            <hr />
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">النظام</label><select value={config.shiftSystem} onChange={(e) => setConfigAndSync({...config, shiftSystem: e.target.value})} className="w-full p-3 border rounded-lg"><option value="12h">12 ساعة (Day / Night)</option><option value="8h">8 ساعات (3 Shifts)</option><option value="24h">24 ساعة</option></select></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-2">الحد الأدنى (Staff)</label><input type="number" value={config.minStaffOnlyCount} onChange={(e) => setConfigAndSync({...config, minStaffOnlyCount: parseInt(e.target.value)})} className="w-full p-3 border rounded-lg font-bold text-center"/></div><div><label className="block text-sm font-medium text-slate-700 mb-2">السنيور (A/B) المطلوب</label><input type="number" value={config.minSeniorCount || 1} onChange={(e) => setConfigAndSync({...config, minSeniorCount: parseInt(e.target.value)})} className="w-full p-3 border rounded-lg font-bold text-center bg-indigo-50 text-indigo-900"/></div></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">قواعد الراحة والـ Cycle</h4>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                             <div><label className="block text-xs font-bold text-slate-500 mb-1">أقصى أيام شغل متصل (Max Work)</label><input type="number" value={config.maxConsecutiveWork} onChange={(e) => setConfigAndSync({...config, maxConsecutiveWork: parseInt(e.target.value)})} className="w-full p-2 border rounded text-center font-bold bg-white"/></div>
                             <label className="flex justify-between items-center p-3 bg-white border rounded-lg cursor-pointer"><div><span className="text-sm font-medium block">سماح بـ Night ثم Day</span></div><input type="checkbox" checked={config.allowDoubleShift} onChange={(e) => setConfigAndSync({...config, allowDoubleShift: e.target.checked})} className="w-5 h-5"/></label>
                        </div>
                    </div>
                </div>
                <div><div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${!isPremium ? 'opacity-70 pointer-events-none relative' : ''}`}>{!isPremium && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 z-10"><span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> للمشتركين فقط</span></div>}<div className="p-6 space-y-4"><h4 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><ImageIcon className="w-4 h-4"/> هوية المستشفى</h4><p className="text-xs text-slate-500">أضف شعار واسم المستشفى ليظهر في الطباعة.</p><div><label className="block text-sm font-medium text-slate-700 mb-2">اسم المستشفى / القسم</label><input type="text" placeholder="مثال: مستشفى السلام - العناية" value={config.hospitalName || ""} onChange={(e) => setConfigAndSync({...config, hospitalName: e.target.value})} className="w-full p-3 border rounded-lg"/></div><div><label className="block text-sm font-medium text-slate-700 mb-2">الشعار (Logo)</label><div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative"><input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />{config.hospitalLogo ? (<img src={config.hospitalLogo} className="h-20 mx-auto object-contain mb-2" alt="Logo Preview"/>) : (<Upload className="w-8 h-8 mx-auto text-slate-400 mb-2"/>)}<span className="text-xs text-indigo-600 font-bold">اضغط لرفع صورة</span></div></div></div></div></div></div></div>
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
                         <div className="col-span-2 lg:col-span-1"><label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label><input type="text" value={staff.name} onChange={(e) => updateStaff(staff.id, 'name', e.target.value)} className="w-full border-b-2 focus:border-indigo-500 outline-none font-bold"/></div>
                         <div className="grid grid-cols-3 gap-2">
                             <div><label className="text-[10px] font-bold text-slate-500 block">ID</label><input type="text" value={staff.staffId || ''} onChange={(e) => updateStaff(staff.id, 'staffId', e.target.value)} className="w-full border rounded p-1 text-xs text-center"/></div>
                             <div><label className="text-[10px] font-bold text-slate-500 block">G</label><select value={staff.gender || 'F'} onChange={(e) => updateStaff(staff.id, 'gender', e.target.value)} className="w-full border rounded p-1 text-xs text-center"><option value="M">M</option><option value="F">F</option></select></div>
                             <div><label className="text-[10px] font-bold text-slate-500 block">POS</label><input type="text" value={staff.pos || 'SN'} onChange={(e) => updateStaff(staff.id, 'pos', e.target.value)} className="w-full border rounded p-1 text-xs text-center bg-slate-50" readOnly/></div>
                         </div>
                         <div>
                             <label className="text-xs font-bold text-slate-500 block mb-1">نمط العمل</label>
                             <select value={staff.preference} onChange={(e) => updateStaff(staff.id, 'preference', e.target.value)} className="w-full border rounded p-1 text-sm bg-indigo-50 text-indigo-900 font-bold">
                                 <option value="cycle">متصل (Cycle)</option>
                                 <option value="scattered">متقطع (Scattered)</option>
                             </select>
                         </div>
                         <div><label className="text-xs font-bold text-slate-500 block mb-1">الدرجة (Grade)</label><select value={staff.grade} onChange={(e) => updateStaff(staff.id, 'grade', e.target.value)} className="w-full border rounded p-1 text-sm font-bold bg-slate-50">{grades.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
                         <div><label className="text-xs font-bold text-slate-500 block mb-1">الدور</label><select value={staff.role} onChange={(e) => updateStaff(staff.id, 'role', e.target.value)} className="w-full border rounded p-1 text-sm">{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                         
                         {/* خانات السايكل (Cycle) الجديدة */}
                         {staff.preference === 'cycle' && (
                             <div className="col-span-2 bg-blue-50 p-2 rounded flex gap-2 items-center border border-blue-200 justify-center">
                                <span className="text-[10px] font-bold text-blue-800">السايكل:</span>
                                <div><label className="text-[9px] block text-center text-slate-500">شغل</label><input type="number" value={staff.cycleWorkDays || 5} onChange={(e) => updateStaff(staff.id, 'cycleWorkDays', parseInt(e.target.value))} className="w-12 h-6 text-center text-xs border rounded font-bold"/></div>
                                <span className="font-bold text-slate-400 mt-3">/</span>
                                <div><label className="text-[9px] block text-center text-slate-500">راحة</label><input type="number" value={staff.cycleOffDays || 4} onChange={(e) => updateStaff(staff.id, 'cycleOffDays', parseInt(e.target.value))} className="w-12 h-6 text-center text-xs border rounded font-bold"/></div>
                             </div>
                         )}
                         
                         <div className="col-span-2 lg:col-span-4"><label className="text-xs font-bold text-slate-500 block mb-1">إجازات</label><div className="grid grid-cols-10 gap-1">{Array.from({length: config.durationDays}, (_, i) => i + 1).map(d => (<button key={d} onClick={() => toggleVacationDay(staff.id, d)} className={`h-6 text-[9px] rounded ${staff.vacationDays.includes(d) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</button>))}</div></div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'roster' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border overflow-x-auto print:border-none print:shadow-none print:p-0">
                 {/* تنبيهات العجز */}
                 {shortageWarnings.length > 0 && (
                     <div className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg print:hidden">
                         <div className="flex items-center gap-2 text-rose-700 font-bold mb-2"><AlertTriangle className="w-6 h-6" /><h3>تنبيه: يوجد عجز في بعض الأيام!</h3></div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                             {shortageWarnings.map((warn, idx) => (
                                 <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-rose-100 shadow-sm text-xs">
                                     <span className="font-bold text-slate-700">يوم {warn.day} ({warn.dayName})</span>
                                     <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded font-bold">{warn.shift}: عجز {warn.missing}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 <div className="flex justify-between mb-4 print:hidden">
                    <h4 className="text-sm font-bold text-slate-600 flex items-center"><Activity className="w-5 h-5 ml-2 text-indigo-500"/> الجدول النهائي</h4>
                    <div className="flex gap-2">
                       <button onClick={resetRoster} className="text-xs bg-slate-100 px-3 py-1 rounded hover:text-red-500 flex items-center"><RotateCcw className="w-3 h-3 ml-1"/> مسح</button>
                       <button onClick={() => handlePremiumFeature(exportToExcel)} className={`text-xs px-3 py-1 rounded flex items-center ${isPremium ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{isPremium ? <Download className="w-3 h-3 ml-1"/> : <Lock className="w-3 h-3 ml-1"/>} Excel ملون</button>
                       <button onClick={() => handlePremiumFeature(exportRosterToPDF)} className={`text-xs px-3 py-1 rounded flex items-center ${isPremium ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-slate-200 text-slate-500'}`}>{isPremium ? <Printer className="w-3 h-3 ml-1"/> : <Lock className="w-3 h-3 ml-1"/>} PDF</button>
                    </div>
                 </div>

                 <div className="overflow-x-auto">
                     <table id="roster-table-export" className="w-full border-collapse text-[10px] font-sans border border-black text-center">
                        <thead className="bg-blue-100">
                            <tr>
                                <th className="border border-black w-6">NO.</th>
                                <th className="border border-black min-w-[120px]">STAFF NAME</th>
                                <th className="border border-black w-8">POS.</th>
                                <th className="border border-black w-8">ID</th>
                                <th className="border border-black w-6">LEVEL</th>
                                <th className="border border-black w-6">G</th>
                                {roster.length > 0 && roster.map((r, i) => (
                                    <th key={i} style={{backgroundColor: r.dateInfo.isWeekend ? '#fed7aa' : '#e0f2fe'}} className="border border-black w-6">
                                        <div className="text-[8px] font-bold">{r.dateInfo.dayName.substring(0,3)}</div>
                                        <div>{r.dateInfo.dayNum}</div>
                                    </th>
                                ))}
                                <th className="border border-black w-6 bg-gray-200">D</th>
                                <th className="border border-black w-6 bg-gray-200">N</th>
                                <th className="border border-black w-8 bg-gray-300">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffList.map((staff, index) => {
                                const stats = { D: 0, N: 0 };
                                return (
                                <tr key={staff.id} className="hover:bg-gray-50">
                                    <td className="border border-black">{index + 1}</td>
                                    <td className="border border-black text-left px-1 font-bold whitespace-nowrap">{staff.name}</td>
                                    <td className="border border-black">{staff.pos}</td>
                                    <td className="border border-black">{staff.staffId}</td>
                                    <td className="border border-black">{staff.grade}</td>
                                    <td className="border border-black">{staff.gender}</td>
                                    {roster.map((r, i) => {
                                        const isDay = r.shifts['D']?.some(s => s.id === staff.id) || r.shifts['M']?.some(s => s.id === staff.id);
                                        const isNight = r.shifts['N']?.some(s => s.id === staff.id);
                                        if (isDay) stats.D++; if (isNight) stats.N++;

                                        return (
                                            <td key={i} 
                                                onClick={() => toggleShiftCell(r.dayIndex, staff.id)}
                                                style={{ 
                                                    backgroundColor: isDay ? '#fef9c3' : isNight ? '#374151' : r.dateInfo.isWeekend ? '#fed7aa' : '#ffffff',
                                                    color: isNight ? '#ffffff' : '#000000',
                                                    cursor: 'pointer'
                                                }}
                                                className="border border-black font-bold select-none hover:opacity-80">
                                                {isDay ? 'D' : isNight ? 'N' : ''}
                                            </td>
                                        );
                                    })}
                                    <td className="border border-black font-bold bg-gray-100">{stats.D}</td>
                                    <td className="border border-black font-bold bg-gray-100">{stats.N}</td>
                                    <td className="border border-black font-bold bg-gray-200">{stats.D + stats.N}</td>
                                </tr>
                            )})}
                        </tbody>
                        <tfoot className="font-bold text-[10px]">
                            <tr>
                                <td colSpan={6} style={{backgroundColor: '#bfdbfe'}} className="border border-black p-1 text-right px-2">TOTAL</td>
                                {roster.map((r, i) => {
                                    const count = Object.values(r.shifts).flat().length;
                                    const isShortage = shortageWarnings.some(w => w.day === r.dateInfo.str);
                                    return (
                                        <td key={i} style={{ backgroundColor: isShortage ? '#ef4444' : r.dateInfo.isWeekend ? '#fdba74' : '#dbeafe', color: isShortage ? '#ffffff' : '#000000' }} className="border border-black text-center py-1">{count}</td>
                                    )
                                })}
                                <td colSpan={3} className="border border-black bg-gray-300"></td>
                            </tr>
                        </tfoot>
                     </table>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'contact' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-10 text-center text-white"><MessageCircle className="w-12 h-12 mx-auto mb-2"/><h2 className="text-2xl font-bold">تواصل مع المطور</h2></div>
              <div className="p-8 space-y-6"><div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border"><Mail className="text-indigo-600"/><span className="font-mono">mahmoudkhelfa20@gmail.com</span></div><div className="grid grid-cols-3 gap-4 text-center"><a href="https://facebook.com" target="_blank" className="p-4 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><Facebook className="mx-auto mb-1"/><span className="text-xs font-bold">Facebook</span></a><a href="https://instagram.com" target="_blank" className="p-4 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-100"><Instagram className="mx-auto mb-1"/><span className="text-xs font-bold">Instagram</span></a><a href={`https://wa.me/${paymentInfo.whatsapp}`} target="_blank" className="p-4 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"><Phone className="mx-auto mb-1"/><span className="text-xs font-bold">WhatsApp</span></a></div></div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;