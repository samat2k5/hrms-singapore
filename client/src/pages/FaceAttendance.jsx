import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

const FaceAttendance = () => {
    const videoRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [lastAction, setLastAction] = useState(null);
    const [statusMessage, setStatusMessage] = useState('Face Attendance Ready');
    const [cooldown, setCooldown] = useState(false);

    // SweetAlert2 Toast Mixin
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        },
        customClass: {
            popup: 'glass-card border border-[var(--border-main)] rounded-xl shadow-2xl'
        }
    });

    useEffect(() => {
        const loadModels = async () => {
            try {
                if (!window.faceapi) {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
                    script.async = true;
                    script.onload = () => loadFaceApiModels();
                    document.body.appendChild(script);
                } else {
                    loadFaceApiModels();
                }
            } catch (err) {
                Toast.fire({
                    icon: 'error',
                    title: 'Failed to load face recognition models'
                });
            }
        };

        const loadFaceApiModels = async () => {
            try {
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
                await Promise.all([
                    window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                startVideo();
            } catch (err) {
                console.error('Face API models failed to load:', err);
            }
        };

        loadModels();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Auto-scan logic
    useEffect(() => {
        let timer;
        if (modelsLoaded && !loading && !detecting && !cooldown) {
            timer = setInterval(() => {
                handleAutoClock();
            }, 1000); // Check every second
        }
        return () => clearInterval(timer);
    }, [modelsLoaded, loading, detecting, cooldown]);

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setLoading(false);
                }
            })
            .catch(err => {
                Toast.fire({
                    icon: 'error',
                    title: 'Camera access denied'
                });
                setLoading(false);
            });
    };

    const handleAutoClock = async () => {
        if (!modelsLoaded || !videoRef.current || detecting || cooldown) return;

        // Fast pre-check for face detection (without descriptor yet to save CPU)
        const check = await window.faceapi.detectSingleFace(
            videoRef.current,
            new window.faceapi.TinyFaceDetectorOptions()
        );

        if (check) {
            // Face found! Now do full scan
            handleClock();
        }
    };

    const handleClock = async () => {
        if (!modelsLoaded || !videoRef.current || detecting || cooldown) return;
        setDetecting(true);
        setStatusMessage('Scanning face...');

        try {
            const detections = await window.faceapi.detectSingleFace(
                videoRef.current,
                new window.faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks().withFaceDescriptor();

            if (detections) {
                const descriptor = Array.from(detections.descriptor);
                const result = await api.clockInFace(descriptor);

                setLastAction(result);
                setStatusMessage(`Welcome ${result.employee.full_name}! Clocked ${result.action}`);

                Toast.fire({
                    icon: 'success',
                    title: `Clocked ${result.action}: ${result.employee.full_name}`
                });

                // Set cooldown to prevent double scans
                setCooldown(true);
                setTimeout(() => {
                    setStatusMessage('Face Attendance Ready');
                    setLastAction(null);
                    setCooldown(false);
                }, 8000); // 8 second cooldown for next person
            } else {
                setStatusMessage('Detecting Face...');
            }
        } catch (err) {
            console.error('Clocking failed:', err);
            const msg = err.message || 'Face recognition failed';
            // Only show toast if it's a real failure, not just 'not recognized'
            if (!msg.toLowerCase().includes('not recognized')) {
                Toast.fire({
                    icon: 'error',
                    title: msg
                });
            }
            setStatusMessage(msg);

            // Short cooldown on errors to prevent spam
            setCooldown(true);
            setTimeout(() => {
                setStatusMessage('Face Attendance Ready');
                setCooldown(false);
            }, 3000);
        } finally {
            setDetecting(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-150px)] flex flex-col items-center justify-center">
            <div className="glass-card w-full max-w-2xl p-8 rounded-3xl border border-[var(--border-main)] flex flex-col items-center">
                <h2 className="text-3xl font-black mb-2 text-[var(--brand-primary)]">TIME CLOCK</h2>
                <div className={`mb-6 text-lg font-bold ${lastAction ? 'text-[var(--success)]' : 'text-[var(--text-main)]'}`}>
                    {statusMessage}
                </div>

                <div className="relative w-full aspect-square max-w-[400px] bg-black rounded-full overflow-hidden mb-8 border-4 border-[var(--border-main)] box-shadow shadow-2xl">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className={`w-full h-full object-cover grayscale brightness-110 contrast-125 ${loading || !modelsLoaded ? 'hidden' : ''}`}
                    />
                    {loading && <div className="absolute inset-0 flex items-center justify-center text-white text-lg animate-pulse">Initializing...</div>}

                    {/* Scanning Animation */}
                    {detecting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-full h-1 bg-[var(--brand-primary)] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                        </div>
                    )}

                    {/* Identification Overlay */}
                    {lastAction && (
                        <div className="absolute inset-0 bg-[var(--success)] bg-opacity-20 flex items-center justify-center">
                            <div className="bg-white/90 p-4 rounded-2xl shadow-xl flex flex-col items-center">
                                <span className="text-4xl mb-2">✅</span>
                                <div className="text-xl font-black text-slate-900">{lastAction.employee.full_name}</div>
                                <div className="text-sm font-bold text-slate-600">SUCCESSFULLY CLOCKED {lastAction.action.toUpperCase()}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div
                    className={`px-12 py-5 rounded-2xl font-black text-xl text-white transition-all flex items-center gap-3 ${cooldown ? 'bg-orange-500 shadow-lg' : detecting ? 'bg-blue-600' : 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}
                >
                    {cooldown ? (
                        <>
                            <span>PLEASE WAIT...</span>
                            <span className="text-2xl animate-spin">⏳</span>
                        </>
                    ) : detecting ? (
                        <>
                            <span>RECOGNIZING...</span>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </div>
                        </>
                    ) : (
                        <>
                            <span>AUTO SCANNIG ACTIVE</span>
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                            </span>
                        </>
                    )}
                </div>

                <p className="mt-8 text-sm text-[var(--text-muted)] font-medium text-center">
                    Automatic scanning is active. <br />
                    Please position yourself in front of the camera.
                </p>
            </div>

            <style>{`
                @keyframes scan {
                    0%, 100% { top: 0%; opacity: 0.1; }
                    50% { top: 100%; opacity: 0.8; }
                }
            `}</style>
        </div>
    );
};

export default FaceAttendance;
