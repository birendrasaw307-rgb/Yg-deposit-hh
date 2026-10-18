import React, { useState, useEffect, useRef } from 'react';

declare global {
  interface Window {
    firebase?: any;
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyCW_MWgZ9w-VVUkO88eBtIn7P1AweimKBI",
  authDomain: "yg-earn.firebaseapp.com",
  databaseURL: "https://yg-earn-default-rtdb.firebaseio.com",
  projectId: "yg-earn",
  storageBucket: "yg-earn.firebasestorage.app",
  messagingSenderId: "516376481938",
  appId: "1:516376481938:web:e605225a449e2ac2f5964b",
  measurementId: "G-31JQHSQJM3"
};

export default function App() {
  const [currentView, setCurrentView] = useState<'register' | 'download'>('register');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [userName, setUserName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isInviteReadOnly, setIsInviteReadOnly] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [apkLink, setApkLink] = useState<string | null>(null);
  const [apkStatusText, setApkStatusText] = useState('Checking server for file...');
  const [isApkReady, setIsApkReady] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{
    show: boolean;
    icon: string;
    title: string;
    message: string;
    onClose?: () => void;
  }>({
    show: false,
    icon: '✅',
    title: '',
    message: ''
  });

  const dbRef = useRef<any>(null);

  // Initialize Firebase RTDB & read URL params on mount
  useEffect(() => {
    // Check invite code in URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('ref') || params.get('invite');
    if (code) {
      setInviteCode(code);
      setIsInviteReadOnly(true);
    }

    const initFirebase = () => {
      if (window.firebase) {
        if (!window.firebase.apps || !window.firebase.apps.length) {
          window.firebase.initializeApp(firebaseConfig);
        }
        const db = window.firebase.database();
        dbRef.current = db;

        // Listen for APK link
        db.ref('admin_settings/apk_link').on('value', (snapshot: any) => {
          const link = snapshot.val();
          if (link) {
            setApkLink(link);
            setApkStatusText('✅ New Version Available');
            setIsApkReady(true);
          } else {
            setApkStatusText('Loading Link...');
            setIsApkReady(false);
          }
        });
      } else {
        setTimeout(initFirebase, 200);
      }
    };

    initFirebase();
  }, []);

  const showAlert = (icon: string, title: string, message: string, onClose?: () => void) => {
    setAlert({
      show: true,
      icon,
      title,
      message,
      onClose
    });
  };

  const closeAlert = () => {
    const callback = alert.onClose;
    setAlert((prev) => ({ ...prev, show: false }));
    if (callback) {
      setTimeout(callback, 200);
    }
  };

  const switchToDownload = (loginMode = false) => {
    setIsLoginMode(loginMode);
    setCurrentView('download');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchToRegister = () => {
    setCurrentView('register');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (!apkLink || apkLink === '#') {
      e.preventDefault();
      showAlert('⏳', 'Please Wait', 'Loading download link...');
    }
  };

  const handleRegister = () => {
    const trimmedName = userName.trim();
    let cleanedMobile = mobile.trim().replace(/\D/g, '');
    if (cleanedMobile.length > 10) {
      cleanedMobile = cleanedMobile.slice(-10);
    }
    const trimmedPass = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    const trimmedInvite = inviteCode.trim();

    // Validations matching original logic
    if (trimmedName.length < 2) {
      showAlert('⚠️', 'Invalid Name', 'Please enter a valid user name (minimum 2 characters)');
      return;
    }

    if (cleanedMobile.length !== 10) {
      showAlert('⚠️', 'Invalid Mobile Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passRegex.test(trimmedPass)) {
      showAlert(
        '⚠️',
        'Weak Password',
        'Password must contain 1 uppercase, 1 lowercase, 1 number and 1 special character (minimum 6 characters)'
      );
      return;
    }

    if (trimmedPass !== trimmedConfirm) {
      showAlert('⚠️', 'Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    if (!dbRef.current) {
      showAlert('❌', 'Connecting', 'Connecting to database service. Please try again in a moment.');
      return;
    }

    setIsLoading(true);

    const db = dbRef.current;
    db.ref('users/' + cleanedMobile)
      .once('value')
      .then((snapshot: any) => {
        if (snapshot.exists()) {
          setIsLoading(false);
          showAlert(
            '❌',
            'Already Registered',
            'This mobile number is already registered. Please login.',
            () => {
              switchToDownload(true);
            }
          );
        } else {
          createAccountInDb(trimmedName, cleanedMobile, trimmedPass, trimmedInvite);
        }
      })
      .catch(() => {
        setIsLoading(false);
        showAlert('❌', 'Connection Error', 'Please check your internet connection and try again.');
      });
  };

  const createAccountInDb = (name: string, phone: string, pass: string, invite: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rnd = '';
    for (let i = 0; i < 4; i++) {
      rnd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const myRefCode = rnd + phone.substring(6);

    const now = Date.now();
    const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const userData = {
      name: name,
      mobileNumber: phone,
      password: pass,
      balance: 60.0,
      referral_code: myRefCode,
      invited_by: invite || 'Direct',

      total_deposit: 0.0,
      today_deposit: 0.0,
      total_withdrawal: 0.0,
      today_withdrawal: 0.0,

      total_reward: 60.0,
      today_reward: 0.0,

      total_invites: 0,

      is_active: true,
      status: 'Complete',
      registration_date: now,
      last_login: now,

      transactions: {
        welcome_bonus: {
          order_id: 'welcome_bonus',
          type: 'Signup Bonus',
          amount: '60',
          status: 'Success',
          date: dateStr,
          created_at: now
        }
      },
      my_referrals: {}
    };

    const db = dbRef.current;
    db.ref('users/' + phone).set(userData, (error: any) => {
      setIsLoading(false);
      if (!error) {
        if (invite) {
          processReferral(invite, phone);
        }
        showAlert('✅', 'Registration Successful', 'Welcome! You will receive ₹60 signup bonus.', () => {
          switchToDownload(false);
        });
      } else {
        showAlert('❌', 'Server Error', 'Registration failed. Please try again later.');
      }
    });
  };

  const processReferral = (inviteCodeVal: string, newPhone: string) => {
    const db = dbRef.current;
    if (!db) return;

    db.ref('users')
      .orderByChild('referral_code')
      .equalTo(inviteCodeVal)
      .once('value')
      .then((snapshot: any) => {
        if (snapshot.exists()) {
          snapshot.forEach((child: any) => {
            const refMobile = child.key;
            const oldInvites = child.val().total_invites || 0;

            db.ref(`users/${refMobile}/my_referrals/${newPhone}`).set({
              mobile: newPhone,
              total_deposit: 0,
              status: 'Processing',
              reward_amount: 0,
              reward_claimed: false,
              registered_at: Date.now()
            });

            db.ref(`users/${refMobile}/total_invites`).set(oldInvites + 1);
          });
        }
      });
  };

  return (
    <div
      style={{
        fontFamily: "'Poppins', sans-serif",
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d3436 100%)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px'
      }}
    >
      {/* MAIN CONTAINER CARD */}
      <div
        style={{
          backgroundColor: '#2d3436',
          width: '100%',
          maxWidth: '400px',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(255, 215, 0, 0.15)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}
      >
        {/* BANNER HEADER */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#2d3436',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
        >
          <img
            src="https://i.ibb.co/bGQNzMg/file-00000000f6fc820bbe5574f8de0207d4-3-2.jpg"
            alt="YG Earn"
            style={{
              width: '100%',
              display: 'block',
              transition: 'all 0.5s ease',
              objectFit: 'cover',
              objectPosition: 'top center',
              height: currentView === 'register' ? '150px' : '320px',
              borderBottom: currentView === 'register' ? '2px solid #FFD700' : 'none',
              borderRadius: currentView === 'download' ? '0 0 24px 24px' : '0',
              marginBottom: currentView === 'download' ? '8px' : '0'
            }}
          />
        </div>

        {/* CONTENT AREA */}
        <div style={{ padding: '18px 22px 22px 22px', flexGrow: 1, backgroundColor: '#2d3436' }}>
          {currentView === 'register' ? (
            /* REGISTER SECTION */
            <div>
              <h2
                style={{
                  textAlign: 'center',
                  color: '#FFD700',
                  margin: '0 0 14px 0',
                  fontWeight: 700,
                  fontSize: '18px',
                  letterSpacing: '0.5px'
                }}
              >
                Create Account
              </h2>

              {/* User Name */}
              <div style={{ marginBottom: '11px', position: 'relative' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#dfe6e9',
                    display: 'block',
                    marginBottom: '4px',
                    marginLeft: '2px'
                  }}
                >
                  User Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  maxLength={20}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #FFD700',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    fontFamily: "'Poppins', sans-serif",
                    color: '#000000',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Phone Number */}
              <div style={{ marginBottom: '11px', position: 'relative' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#dfe6e9',
                    display: 'block',
                    marginBottom: '4px',
                    marginLeft: '2px'
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="10 Digit Number"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #FFD700',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    fontFamily: "'Poppins', sans-serif",
                    color: '#000000',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '11px', position: 'relative' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#dfe6e9',
                    display: 'block',
                    marginBottom: '4px',
                    marginLeft: '2px'
                  }}
                >
                  Password
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '45px',
                      border: '2px solid #FFD700',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                      fontFamily: "'Poppins', sans-serif",
                      color: '#000000',
                      fontWeight: 600,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: showPassword ? '#FFD700' : '#000000',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '3px', marginLeft: '2px' }}>
                  Example: @Abc123
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '11px', position: 'relative' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#dfe6e9',
                    display: 'block',
                    marginBottom: '4px',
                    marginLeft: '2px'
                  }}
                >
                  Confirm Password
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '45px',
                      border: '2px solid #FFD700',
                      borderRadius: '10px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                      fontFamily: "'Poppins', sans-serif",
                      color: '#000000',
                      fontWeight: 600,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: showConfirmPassword ? '#FFD700' : '#000000',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Referral Code */}
              <div style={{ marginBottom: '11px', position: 'relative' }}>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#dfe6e9',
                    display: 'block',
                    marginBottom: '4px',
                    marginLeft: '2px'
                  }}
                >
                  Referral Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  readOnly={isInviteReadOnly}
                  onChange={(e) => !isInviteReadOnly && setInviteCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #FFD700',
                    borderRadius: '10px',
                    fontSize: '13px',
                    backgroundColor: isInviteReadOnly ? '#e8f0fe' : '#ffffff',
                    outline: 'none',
                    fontFamily: "'Poppins', sans-serif",
                    color: '#000000',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Register Button */}
              <button
                onClick={handleRegister}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  marginTop: '8px',
                  boxShadow: '0 8px 20px rgba(255, 215, 0, 0.3)',
                  letterSpacing: '0.5px',
                  opacity: isLoading ? 0.6 : 1,
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                CREATE ACCOUNT
              </button>

              {/* Switch to Download / Login */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#b2bec3',
                  fontWeight: 500
                }}
              >
                Already have an account?{' '}
                <span
                  onClick={() => switchToDownload(true)}
                  style={{ color: '#FFD700', fontWeight: 700, cursor: 'pointer' }}
                >
                  Login Here
                </span>
              </div>
            </div>
          ) : (
            /* DOWNLOAD SECTION */
            <div style={{ textAlign: 'center', padding: '5px 0' }}>
              <h2
                style={{
                  margin: 0,
                  color: '#FFD700',
                  fontWeight: 700,
                  fontSize: '18px',
                  letterSpacing: '0.5px'
                }}
              >
                Download App
              </h2>
              <p
                style={{
                  color: '#dfe6e9',
                  fontSize: '12px',
                  marginTop: '6px',
                  lineHeight: '1.5'
                }}
              >
                {isLoginMode ? (
                  'Login securely to access your dashboard.'
                ) : (
                  <>
                    Account created successfully!
                    <br />
                    You will receive <b style={{ color: '#FFD700' }}>₹60 signup bonus</b>
                  </>
                )}
              </p>

              {/* DOWNLOAD APK BUTTON WITH BOUNCE */}
              <a
                href={apkLink || '#'}
                onClick={handleDownloadClick}
                download
                className="download-bounce"
                style={{
                  background: 'linear-gradient(135deg, #00b894, #00cec9)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '15px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '50px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  boxShadow: '0 10px 25px rgba(0, 184, 148, 0.3)',
                  marginTop: '12px',
                  cursor: 'pointer'
                }}
              >
                ⬇ DOWNLOAD APK
              </a>

              <div
                style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  color: isApkReady ? '#00b894' : '#b2bec3',
                  marginTop: '8px',
                  fontWeight: 600
                }}
              >
                {apkStatusText}
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <span
                  onClick={switchToRegister}
                  style={{
                    color: '#FFD700',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Create Account
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CENTER ALERT POPUP */}
      {alert.show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#2d3436',
              borderRadius: '18px',
              padding: '24px 20px',
              maxWidth: '320px',
              width: '100%',
              textAlign: 'center',
              border: '2px solid #FFD700',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '44px', marginBottom: '10px', display: 'block' }}>{alert.icon}</span>
            <div
              style={{
                color: '#FFD700',
                fontSize: '17px',
                fontWeight: 700,
                marginBottom: '6px'
              }}
            >
              {alert.title}
            </div>
            <div
              style={{
                color: '#dfe6e9',
                fontSize: '13px',
                lineHeight: 1.5,
                marginBottom: '16px'
              }}
            >
              {alert.message}
            </div>
            <button
              onClick={closeAlert}
              style={{
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: '#000000',
                border: 'none',
                padding: '11px 30px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                minWidth: '100px'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* CENTER SPINNER */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9998
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                border: '5px solid rgba(255, 215, 0, 0.2)',
                borderTop: '5px solid #FFD700',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto'
              }}
            />
            <div
              style={{
                color: '#FFD700',
                fontSize: '13px',
                marginTop: '15px',
                fontWeight: 600,
                letterSpacing: '0.5px'
              }}
            >
              Please wait...
            </div>
          </div>
        </div>
      )}

      {/* CSS KEYFRAME INJECTIONS */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
