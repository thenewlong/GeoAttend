import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { apiRequest } from '../api/client';

let faceModelsLoaded = false;

async function ensureFaceModelsLoaded() {
  if (faceModelsLoaded) return;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  ]);
  faceModelsLoaded = true;
}

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
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [faceStatus, setFaceStatus] = useState('');
  const [scanningFace, setScanningFace] = useState(false);
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

  // Attach active media stream once <video> element is mounted in DOM
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
    setLocationStatus('Fetching real-time GPS coordinates...');

    if (!navigator.geolocation) {
      setCheckingLoc(false);
      setIsInside(false);
      setLocationStatus('Geolocation is not supported by your browser.');
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
          setLocationStatus(
            `Verified! Inside NIELIT Agartala zone (${dist}m away, ±${Math.round(accuracy)}m).`
          );
        } else {
          setIsInside(false);
          setLocationStatus(
            `Outside radius! You are ${dist}m away (Limit: ${ALLOWED_RADIUS}m).`
          );
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
    setFaceDescriptor(null);
    setFaceStatus('');
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
      setErrorMsg('Camera access denied or unavailable: ' + err.message);
    }
  };

  const capturePhoto = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const width = video.videoWidth || 480;
    const height = video.videoHeight || 360;

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCameraTracks();

    try {
      setScanningFace(true);
      setErrorMsg('');
      setFaceStatus('Verifying live face geometry...');

      await ensureFaceModelsLoaded();
      const detections = await faceapi
        .detectAllFaces(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections.length === 0) {
        setCapturedImage(null);
        setFaceDescriptor(null);
        setFaceStatus('');
        setErrorMsg('Face detect nahi hua. Clear front selfie ke liye Retake karein.');
        return;
      }

      if (detections.length > 1) {
        setCapturedImage(null);
        setFaceDescriptor(null);
        setFaceStatus('');
        setErrorMsg('Frame mein sirf 1 employee ka face hona chahiye.');
        return;
      }

      const descriptorArray = Array.from(detections[0].descriptor);
      setCapturedImage(dataUrl);
      setFaceDescriptor(descriptorArray);
      setFaceStatus('Live face captured & ready for backend match');
    } catch (err) {
      setCapturedImage(null);
      setFaceDescriptor(null);
      setFaceStatus('');
      setErrorMsg(err.message || 'Face scan failed. Check /models folder.');
    } finally {
      setScanningFace(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!coords || !isInside) {
      setErrorMsg('Pehle campus geofence ke andar GPS location verify karein.');
      return;
    }

    if (!capturedImage || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      setErrorMsg('Pehle valid live selfie aur face scan complete karein.');
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
          faceDescriptor,
        },
      });

      setSubmittedRecord(data.record);
      if (typeof onSuccess === 'function') {
        onSuccess(data.record);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Attendance submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    stopCameraTracks();
    setSubmittedRecord(null);
    setCapturedImage(null);
    setFaceDescriptor(null);
    setFaceStatus('');
    setScanningFace(false);
    setIsInside(false);
    setCoords(null);
    setDistance(null);
    setLocationStatus('');
    setErrorMsg('');
  };

  if (submittedRecord) {
    return (
      <div className="max-w-md sm:max-w-xl mx-auto bg-white border-2 border-[#191D19] p-6 sm:p-8 rounded-2xl shadow-[5px_5px_0_#191D19] text-center space-y-4 mt-4 text-[#191D19]">
        <div className="w-12 h-12 bg-[#FFD84D] text-[#191D19] rounded-full flex items-center justify-center mx-auto text-xl font-black border-2 border-[#191D19] shadow-[2px_2px_0_#191D19]">
          ✓
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Attendance Logged Successfully
          </h2>
          <p className="text-xs sm:text-sm text-[#4A5049] mt-1 font-medium">
            Ref: <b>{submittedRecord.ref_code}</b> · Distance: <b>{submittedRecord.distance_meters}m</b> · Status:{' '}
            <span className="text-[#4E6B47] font-extrabold">{submittedRecord.status}</span>
          </p>
        </div>
        {submittedRecord.selfie_url && (
          <img
            src={submittedRecord.selfie_url}
            alt="Uploaded selfie"
            className="w-28 h-22 sm:w-32 sm:h-24 object-cover rounded-xl mx-auto border-2 border-[#191D19]"
          />
        )}
        <button
          type="button"
          onClick={resetForm}
          className="w-full sm:w-auto bg-[#6B8A63] hover:bg-[#5B7854] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
        >
          Mark Another Entry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md sm:max-w-2xl mx-auto bg-[#F8F8F3] sm:bg-white border-0 sm:border-2 sm:border-[#191D19] p-2 sm:p-7 rounded-2xl sm:shadow-[5px_5px_0_#191D19] space-y-4 sm:space-y-5 mt-2 sm:mt-5 text-[#191D19]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b-2 border-[#191D19] pb-3.5">
        <div>
          <span className="inline-block bg-[#E8EFE4] border border-[#191D19] rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3B5235]">
            NIELIT Agartala · Employee
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
            Mark Attendance
          </h2>
        </div>
        <span className="bg-[#FFD84D] border-2 border-[#191D19] rounded-xl px-3 py-1 text-xs font-extrabold shadow-[2px_2px_0_#191D19]">
          {isInside ? `${distance}m OK` : 'GPS Pending'}
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-[#FFE5E5] border-2 border-[#191D19] text-[#8A1C1C] text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Steps Grid: 1 Col on Mobile, 2 Cols on PC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Step 1: GPS Geofence Verification */}
        <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#191D19] flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-black flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#6B8A63] text-white border-2 border-[#191D19] flex items-center justify-center text-xs font-extrabold">
                  1
                </span>
                Location Check
              </span>
              {isInside && (
                <span className="bg-[#E8EFE4] border border-[#191D19] rounded-lg px-2 py-0.5 text-[10px] font-extrabold">
                  Verified
                </span>
              )}
            </div>

            <p className="text-xs text-[#4A5049] font-medium leading-relaxed">
              {locationStatus || 'Tap below to verify campus geofence.'}
            </p>
          </div>

          <button
            type="button"
            disabled={checkingLoc}
            onClick={verifyLocation}
            className="w-full bg-[#F2F4EC] hover:bg-[#E8EFE4] disabled:opacity-50 text-[#191D19] font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            {checkingLoc ? 'Checking GPS...' : isInside ? 'Recheck Location' : 'Check My Location'}
          </button>
        </div>

        {/* Step 2: Live Selfie Capture + Face Descriptor */}
        <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#191D19] flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-black flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#FFD84D] text-[#191D19] border-2 border-[#191D19] flex items-center justify-center text-xs font-extrabold">
                  2
                </span>
                Live Selfie
              </span>
              {capturedImage && faceDescriptor && (
                <span className="bg-[#E8EFE4] border border-[#191D19] rounded-lg px-2 py-0.5 text-[10px] font-extrabold">
                  Face Ready
                </span>
              )}
            </div>

            {!cameraActive && !capturedImage && (
              <p className="text-xs text-[#4A5049] font-medium leading-relaxed">
                {scanningFace
                  ? faceStatus
                  : isInside
                  ? 'Open front camera to take live selfie.'
                  : 'Verify location first to unlock camera.'}
              </p>
            )}
          </div>

          {!cameraActive && !capturedImage && (
            <button
              type="button"
              disabled={!isInside || scanningFace}
              onClick={startCamera}
              className="w-full bg-[#6B8A63] hover:bg-[#5B7854] disabled:opacity-45 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
            >
              {scanningFace ? 'Scanning Face...' : 'Open Camera Feed'}
            </button>
          )}

          {cameraActive && (
            <div className="space-y-2.5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-40 sm:h-44 border-2 border-[#191D19] rounded-xl object-cover bg-black"
              />
              <button
                type="button"
                disabled={scanningFace}
                onClick={capturePhoto}
                className="w-full bg-[#FFD84D] hover:bg-[#F5CC36] disabled:opacity-50 text-[#191D19] font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                {scanningFace ? 'Scanning Face...' : 'Capture Snapshot'}
              </button>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-2 pt-1">
              {faceStatus && (
                <p className="text-[11px] font-bold text-[#283B24]">{faceStatus}</p>
              )}
              <div className="flex items-center justify-between gap-3">
                <img
                  src={capturedImage}
                  alt="Selfie preview"
                  className="w-24 h-20 border-2 border-[#191D19] rounded-xl object-cover shrink-0"
                />
                <button
                  type="button"
                  disabled={scanningFace}
                  onClick={startCamera}
                  className="bg-[#F2F4EC] hover:bg-[#E8EFE4] disabled:opacity-50 text-[#191D19] font-bold text-xs px-3.5 py-2 rounded-xl border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  Retake Photo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Final Submit */}
      <button
        type="submit"
        disabled={submitting || scanningFace || !isInside || !capturedImage || !faceDescriptor}
        className="w-full bg-[#6B8A63] hover:bg-[#5B7854] disabled:opacity-45 text-white font-extrabold text-sm py-3.5 rounded-xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
      >
        {submitting ? 'Uploading to ImgBB & Saving to DB...' : 'Submit Verified Attendance'}
      </button>
    </form>
  );
}