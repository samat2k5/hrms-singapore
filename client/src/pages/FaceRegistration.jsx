import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const FaceRegistration = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Position Face for Enrollment');

    useEffect(() => {
        const loadModelsAndData = async () => {
            try {
                const emp = await api.getEmployee(id);
                setEmployee(emp);

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
                toast.error('Failed to load employee data');
                navigate('/employees');
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
                toast.error('Failed to load face recognition models');
            }
        };

        loadModelsAndData();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, [id, navigate]);

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Camera access denied:', err);
                toast.error('Camera access denied');
                setLoading(false);
            });
    };

    const handleCapture = async () => {
        if (!modelsLoaded || !videoRef.current || detecting) return;
        setDetecting(true);
        setStatusMessage('Scanning face descriptor...');

        try {
            const detections = await window.faceapi.detectSingleFace(
                videoRef.current,
                new window.faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks().withFaceDescriptor();

            if (detections) {
                const descriptor = Array.from(detections.descriptor);
                console.log('Descriptor captured:', descriptor.length);
                await api.updateEmployeeFace(id, descriptor);

                setRegistered(true);
                setStatusMessage('Face Signature Registered Successfully');
                toast.success('Face signature registered successfully');

                setTimeout(() => {
                    navigate('/employees');
                }, 2000);
            } else {
                setStatusMessage('No face detected. Try again.');
                toast.error('No face detected. Please position your face clearly in the frame.');
            }
        } catch (err) {
            console.error('Capture failed:', err);
            const msg = err.message || 'Failed to capture face signature';
            setStatusMessage(msg);
            toast.error(msg);
        } finally {
            setDetecting(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-150px)] flex flex-col items-center justify-center">
            <div className="glass-card w-full max-w-2xl p-8 rounded-3xl border border-[var(--border-main)] flex flex-col items-center">
                <div className="flex justify-between items-center w-full mb-4">
                    <h2 className="text-3xl font-black text-[var(--brand-primary)]">FACE ENROLL</h2>
                    <button onClick={() => navigate('/employees')} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        ✕
                    </button>
                </div>

                <div className="text-center mb-6">
                    <div className="text-xl font-bold text-[var(--text-main)]">{employee?.full_name}</div>
                    <div className="text-sm font-medium text-[var(--text-muted)] tracking-wider">{employee?.employee_id}</div>
                </div>

                <div className={`mb-6 text-lg font-bold ${registered ? 'text-[var(--success)]' : 'text-[var(--text-main)]'}`}>
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
                    {!modelsLoaded && !loading && <div className="absolute inset-0 flex items-center justify-center text-white text-lg animate-pulse text-center p-4">Loading face models...</div>}

                    {/* Scanning Animation */}
                    {detecting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-full h-1 bg-[var(--brand-primary)] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                        </div>
                    )}

                    {/* Success Overlay */}
                    {registered && (
                        <div className="absolute inset-0 bg-[var(--success)] bg-opacity-20 flex items-center justify-center">
                            <div className="bg-white/90 p-4 rounded-2xl shadow-xl flex flex-col items-center">
                                <span className="text-4xl mb-2">✅</span>
                                <div className="text-xl font-black text-slate-900">ENROLLED</div>
                                <div className="text-sm font-bold text-slate-600 uppercase">SIGNATURE SAVED</div>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCapture}
                    disabled={loading || !modelsLoaded || detecting || registered}
                    className={`group relative overflow-hidden px-12 py-5 rounded-2xl font-black text-xl text-white transition-all transform active:scale-95 ${loading || !modelsLoaded || detecting || registered ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-[var(--brand-primary)] to-[#5e5ce6] hover:shadow-[0_0_30px_rgba(10,132,255,0.4)]'}`}
                >
                    <span className="relative z-10 flex items-center gap-3">
                        {detecting ? 'DETECTING...' : registered ? 'SUCCESSFUL' : (
                            <>
                                <span>CAPTURE FACE</span>
                                <span className="text-2xl">📸</span>
                            </>
                        )}
                    </span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                </button>

                <p className="mt-8 text-sm text-[var(--text-muted)] font-medium text-center max-w-md">
                    Ensure the employee is well-lit and facing the camera directly for an accurate signature capture.
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

export default FaceRegistration;
