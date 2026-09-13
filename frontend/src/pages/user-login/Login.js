import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import countries from '../../utils/countriles';
import { loginUser, registerUser, updateUserProfile } from '../../api/authApi';
import useUserStore from '../../store/useUserStore';

const avatars = [
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Alex',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Sam',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Riya',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Kabir',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Nova',
];

function WhatsAppMark() {
  return (
    <div className="wa-brand-mark" aria-label="WhatsApp">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3.1A12.7 12.7 0 0 0 5.2 22.5L3.6 28.4l6-1.6A12.8 12.8 0 1 0 16 3.1Zm0 23.2c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.5.9.9-3.4-.2-.4A10.5 10.5 0 1 1 16 26.3Z" />
        <path d="M21.8 18.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.7.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2.1-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.3 3.4 1.4 3.6c.2.2 2.5 3.8 6.1 5.3 2.3 1 3.2 1.1 4.4.9.7-.1 1.8-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.4-.3-.7-.4Z" />
      </svg>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const setUser = useUserStore((s) => s.setUser);
  const [authMode, setAuthMode] = useState('login');
  const [contactMode, setContactMode] = useState('phone');
  const [step, setStep] = useState('auth');
  const [dialCode, setDialCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [legacyPasswordSetup, setLegacyPasswordSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('Hey there! I am using WhatsApp Clone.');
  const [avatar, setAvatar] = useState(avatars[0]);
  const [profileFile, setProfileFile] = useState(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef(null);

  const countryOptions = useMemo(() => {
    const seen = new Set();
    return countries.filter((c) => {
      const key = `${c.name}-${c.dialCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  function buildPayload() {
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    if (contactMode === 'email') {
      const clean = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(clean)) throw new Error('Enter a valid email address');
      return { email: clean, password };
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^\d{6,14}$/.test(cleanPhone)) throw new Error('Enter a valid mobile number');
    return { phoneNumber: cleanPhone, phoneSuffix: dialCode, password };
  }

  async function handleAuth(e) {
    e.preventDefault();
    let payload;
    try { payload = buildPayload(); }
    catch (error) { return toast.error(error.message); }

    setLoading(true);
    try {
      const result = authMode === 'login' ? await loginUser(payload) : await registerUser(payload);

      // Old OTP-only users already exist in MongoDB but do not have a password.
      // Keep their account/profile/chats and guide them through a one-time password setup.
      if (result?.data?.requiresPasswordSetup) {
        setLegacyPasswordSetup(true);
        setAuthMode('register');
        toast.info('Old OTP account found. Click “Set password” once to keep this account and use password login.');
        return;
      }

      const user = result?.data?.user;
      if (!user) throw new Error('Login response did not include a user');
      setUser(user);

      if (result?.data?.migratedLegacyAccount) {
        toast.success('Password saved. Your old account has been upgraded.');
        if (!user?.username) setStep('profile');
        else navigate('/');
      } else if (authMode === 'register' && !user?.username) {
        setStep('profile');
        toast.success('Account created. Complete your profile.');
      } else {
        toast.success('Welcome to WhatsApp');
        navigate('/');
      }
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    setProfileFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleProfile(e) {
    e.preventDefault();
    if (!username.trim()) return toast.error('Please enter your name');
    const form = new FormData();
    form.append('username', username.trim());
    form.append('about', about.trim());
    form.append('agreed', 'true');
    if (profileFile) form.append('profilepicture', profileFile);
    else form.append('profilePicture', avatar);

    setLoading(true);
    try {
      const result = await updateUserProfile(form);
      setUser(result.data);
      toast.success('Profile ready');
      navigate('/');
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-top-band" />
      <main className="login-card">
        <WhatsAppMark />
        <div className="login-brand">WhatsApp</div>

        {step === 'auth' ? (
          <>
            <h1>{authMode === 'login' ? 'Log in' : (legacyPasswordSetup ? 'Set your password' : 'Create your account')}</h1>
            <p className="login-subtitle">
              {authMode === 'login'
                ? 'Use your phone number or email address and password.'
                : legacyPasswordSetup
                  ? 'Your old OTP account was found. Set a password once and keep your existing profile and chats.'
                  : 'Create a password-based account. No OTP is required.'}
            </p>

            <div className="auth-mode-tabs" role="tablist">
              <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setLegacyPasswordSetup(false); }}>Log in</button>
              <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setLegacyPasswordSetup(false); }}>Sign up</button>
            </div>

            <form onSubmit={handleAuth} className="login-form">
              <div className="contact-tabs">
                <button type="button" className={contactMode === 'phone' ? 'active' : ''} onClick={() => setContactMode('phone')}>Phone</button>
                <button type="button" className={contactMode === 'email' ? 'active' : ''} onClick={() => setContactMode('email')}>Email</button>
              </div>

              {contactMode === 'phone' ? (
                <div className="phone-row">
                  <select value={dialCode} onChange={(e) => setDialCode(e.target.value)} aria-label="Country code">
                    {countryOptions.map((c) => <option key={`${c.alpha2}-${c.dialCode}`} value={c.dialCode}>{c.flag} {c.dialCode}</option>)}
                  </select>
                  <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Phone number" autoComplete="tel" inputMode="tel" />
                </div>
              ) : (
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" autoComplete="email" />
              )}

              <div className="password-field">
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>

              <button className="primary-btn" disabled={loading}>
                {loading ? 'Please wait…' : (authMode === 'login' ? 'Log in' : (legacyPasswordSetup ? 'Set password' : 'Create account'))}
              </button>
              <p className="security-note">🔒 Passwords are securely hashed. OTP/SMS/email-code login has been removed.</p>
            </form>
          </>
        ) : (
          <form onSubmit={handleProfile} className="login-form profile-setup-form">
            <button type="button" className="profile-back" onClick={() => setStep('auth')}>← Back</button>
            <h1>Profile info</h1>
            <p className="login-subtitle">Add a photo and name so your contacts can recognize you.</p>

            <button type="button" className="profile-photo-picker" onClick={() => fileRef.current?.click()}>
              <img src={preview || avatar} alt="Profile preview" />
              <span className="camera-badge">📷</span>
            </button>
            <button type="button" className="change-photo-link" onClick={() => fileRef.current?.click()}>Choose profile photo</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

            {!profileFile && <div className="avatar-grid">{avatars.map((a) => <button type="button" className={avatar === a ? 'selected' : ''} key={a} onClick={() => setAvatar(a)}><img src={a} alt="Avatar option" /></button>)}</div>}
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your name" maxLength={40} />
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="About" maxLength={140} rows={3} />
            <button className="primary-btn" disabled={loading}>{loading ? 'Saving…' : 'Continue to WhatsApp'}</button>
          </form>
        )}
      </main>
      <div className="login-footer">Private messaging • WhatsApp-style clone</div>
    </div>
  );
}
