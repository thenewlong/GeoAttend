import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';

export default function Attendance({ onSuccess }) {
  // NIELIT Agartala coordinates
  const CAMPUS_LAT = 23.865;
  const CAMPUS_LNG = 91.3353;
  const ALLOWED_RADIUS = 7600; // meters

  const [locationStatus, setLocationStatus] = useState('');
  const [coords, setCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isInside, setIsInside] = useState(false);
  const [checkingLoc, setCheckingLoc] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [submittedRecord, setSubmittedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
  }, [stopCameraTracks]);

  const verifyLocation = () => {
    setErrorMsg('');
    setCheckingLoc(true);
    setLocationStatus('Checking GPS...');

    if (!navigator.geolocation) {
      setCheckingLoc(false);
      setIsInside(false);
      setLocationStatus('GPS not supported.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 0;
        const dist = Math.round(calculateDistance(userLat, userLng, CAMPUS_LAT, CAMPUS_LNG));

        setCoords({ lat: userLat, lng: userLng, accuracy });
        setDistance(dist);
        setCheckingLoc(false);

        if (dist <= ALLOWED_RADIUS) {
          setIsInside(true);
          setLocationStatus(`Inside zone (${dist}m)`);
        } else {
          setIsInside(false);
          setLocationStatus(`Outside limit (${dist}m > ${ALLOWED_RADIUS}m)`);
        }
      },
      (error) => {
        setCheckingLoc(false);
        setIsInside(false);
        setLocationStatus('Location error: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    setErrorMsg('');
    setCapturedImage(null);
    stopCameraTracks();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      stopCameraTracks();
      setErrorMsg('Camera error: ' + err.message);
    }
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const width = video.videoWidth || 480;
    const height = video.videoHeight || 360;

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
    stopCameraTracks();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!coords || !isInside) {
      setErrorMsg('Verify location inside campus first.');
      return;
    }
    if (!capturedImage) {
      setErrorMsg('Capture live selfie first.');
      return;
    }

    try {
      setSubmitting(true);
      const data = await apiRequest('/attendance', {
        method: 'POST',
        body: {
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          selfieBase64: capturedImage,
        },
      });

      setSubmittedRecord(data.record);
      if (typeof onSuccess === 'function') {
        onSuccess(data.record);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    stopCameraTracks();
    setSubmittedRecord(null);
    setCapturedImage(null);
    setIsInside(false);
    setCoords(null);
    setDistance(null);
    setLocationStatus('');
    setErrorMsg('');
  };

  if (submittedRecord) {
    return (
      <div className="max-w-md sm:max-w-lg mx-auto bg-white border-2 border-[#191D19] p-5 sm:p-6 rounded-2xl shadow-[4px_4px_0_#191D19] text-center space-y-4 mt-4">
        <div className="w-11 h-11 bg-[#FFD84D] text-[#191D19] rounded-full flex items-center justify-center mx-auto text-lg font-black border-2 border-[#191D19]">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-black text-[#191D19]">Attendance Marked</h2>
          <p className="text-xs sm:text-sm text-[#4A5049] mt-1 font-medium">
            Ref: <b>{submittedRecord.ref_code}</b> · {submittedRecord.distance_meters}m ·{' '}
            <span className="text-[#4E6B47] font-bold">{submittedRecord.status}</span>
          </p>
        </div>
        {submittedRecord.selfie_url && (
          <img
            src={submittedRecord.selfie_url}
            alt="Selfie"
            className="w-28 h-20 object-cover rounded-xl mx-auto border-2 border-[#191D19]"
          />
        )}
        <button
          type="button"
          onClick={resetForm}
          className="w-full sm:w-auto bg-[#6B8A63] hover:bg-[#5B7854] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md sm:max-w-xl mx-auto bg-[#F8F8F3] sm:bg-white border-0 sm:border-2 sm:border-[#191D19] p-3 sm:p-6 rounded-2xl sm:shadow-[5px_5px_0_#191D19] space-y-4 mt-2 sm:mt-5 text-[#191D19]"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-[#191D19]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Mark Attendance</h2>
          <p className="text-xs text-[#5A6058] font-medium">NIELIT Agartala · GPS & Selfie</p>
        </div>
        <span className="bg-[#E8EFE4] border-2 border-[#191D19] rounded-lg px-2.5 py-1 text-[11px] font-extrabold">
          {isInside ? `${distance}m OK` : 'Pending'}
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-[#FFE5E5] border-2 border-[#191D19] text-[#8A1C1C] text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Desktop 2-col, Mobile 1-col Compact Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Step 1: Location */}
        <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 shadow-[3px_3px_0_#191D19] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wide">1. Location</span>
            {isInside && (
              <span className="bg-[#FFD84D] border border-[#191D19] rounded-md px-2 py-0.5 text-[10px] font-extrabold">
                Verified
              </span>
            )}
          </div>

          <p className="text-xs text-[#4A5049] font-medium min-h-[18px]">
            {locationStatus || 'Tap to check campus radius.'}
          </p>

          <button
            type="button"
            disabled={checkingLoc}
            onClick={verifyLocation}
            className="w-full bg-[#F2F4EC] hover:bg-[#E8EFE4] disabled:opacity-50 text-[#191D19] font-bold text-xs py-2.5 px-3 rounded-xl border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            {checkingLoc ? 'Checking...' : isInside ? 'Recheck GPS' : 'Check Location'}
          </button>
        </div>

        {/* Step 2: Selfie */}
        <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 shadow-[3px_3px_0_#191D19] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wide">2. Live Selfie</span>
            {capturedImage && (
              <span className="bg-[#E8EFE4] border border-[#191D19] rounded-md px-2 py-0.5 text-[10px] font-extrabold">
                Ready
              </span>
            )}
          </div>

          {!cameraActive && !capturedImage && (
            <>
              <p className="text-xs text-[#4A5049] font-medium min-h-[18px]">
                {isInside ? 'Camera ready for snapshot.' : 'Verify location first.'}
              </p>
              <button
                type="button"
                disabled={!isInside}
                onClick={startCamera}
                className="w-full bg-[#6B8A63] hover:bg-[#5B7854] disabled:opacity-45 text-white font-bold text-xs py-2.5 px-3 rounded-xl border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                Open Camera
              </button>
            </>
          )}

          {cameraActive && (
            <div className="space-y-2.5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-36 sm:h-40 rounded-xl border-2 border-[#191D19] object-cover bg-black"
              />
              <button
                type="button"
                onClick={capturePhoto}
                className="w-full bg-[#FFD84D] hover:bg-[#F5CC36] text-[#191D19] font-extrabold text-xs py-2 px-3 rounded-xl border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                Capture Photo
              </button>
            </div>
          )}

          {capturedImage && (
            <div className="flex items-center justify-between gap-3">
              <img
                src={capturedImage}
                alt="Preview"
                className="w-20 h-16 rounded-xl border-2 border-[#191D19] object-cover shrink-0"
              />
              <button
                type="button"
                onClick={startCamera}
                className="bg-[#F2F4EC] hover:bg-[#E8EFE4] text-[#191D19] font-bold text-xs px-3 py-2 rounded-xl border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                Retake
              </button>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !isInside || !capturedImage}
        className="w-full bg-[#6B8A63] hover:bg-[#5B7854] disabled:opacity-45 text-white font-extrabold text-sm py-3 rounded-xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
      >
        {submitting ? 'Submitting...' : 'Submit Attendance'}
      </button>
    </form>
  );
}