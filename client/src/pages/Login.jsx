import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOTP, setShowOTP] = useState(false);
    const [error, setError] = useState('');
    const [infoMsg, setInfoMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const { login, verifyOTP, resendOTP } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setInfoMsg('');
        try {
            if (!showOTP) {
                const data = await login(email, password);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            } else {
                const data = await verifyOTP(email, otp);
                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            }
        } catch (err) {
            if (err.needsVerification) {
                setShowOTP(true);
                setCooldown(60);
                setError(err.message || 'Account not verified. A verification code has been sent to your email.');
            } else {
                setError(err.message || (typeof err === 'string' ? err : 'Login failed'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (cooldown > 0 || resendLoading) return;
        setResendLoading(true);
        setError('');
        setInfoMsg('');
        try {
            const res = await resendOTP(email);
            setCooldown(res?.cooldownSeconds || 60);
            setInfoMsg(res?.message || 'A new verification code has been sent to your email.');
        } catch (err) {
            setError(typeof err === 'string' ? err : err.message || 'Failed to resend code');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-500">Sign in to your Eventora account</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-center shadow-inner border border-red-100">{error}</div>}
            {infoMsg && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-6 text-center text-sm border border-green-200">{infoMsg}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
                {!showOTP ? (
                    <>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div>
                        <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                            Sent to: <span className="font-semibold text-gray-900">{email}</span>
                            <button
                                type="button"
                                onClick={() => { setShowOTP(false); setOtp(''); setError(''); setInfoMsg(''); }}
                                className="ml-2 text-xs text-blue-600 hover:underline font-medium"
                            >
                                (Back to Login)
                            </button>
                        </div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Code (OTP)</label>
                        <input
                            type="text"
                            required
                            placeholder="6-digit code"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength="6"
                        />

                        <div className="flex items-center justify-between mt-3 text-sm">
                            <span className="text-gray-500">Didn't receive the code?</span>
                            <button
                                type="button"
                                disabled={cooldown > 0 || resendLoading}
                                onClick={handleResendOTP}
                                className={`font-semibold transition ${cooldown > 0 || resendLoading ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900 hover:underline'}`}
                            >
                                {resendLoading ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                            </button>
                        </div>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md"
                >
                    {loading ? 'Processing...' : (showOTP ? 'Verify OTP & Log In' : 'Sign In')}
                </button>
            </form>

            <p className="text-center mt-8 text-gray-600">
                Don't have an account? <Link to="/register" className="text-gray-900 font-bold hover:underline">Sign up</Link>
            </p>
        </div>
    );
};

export default Login;
