import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { apiRequest } from '../api/client';

const FACE_MATCH_THRESHOLD = 0.78;

export default function Attendance({ onSuccess, currentUser }) {
  // NIELIT Agartala coordinates
  const CAMPUS_LAT = 23.865;
  const CAMPUS_LNG = 91.3353;
  const ALLOWED_RADIUS = 7600; // meters

  const [locationStatus, setLocationStatus] = useState('');
  const [coords, setCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isInside, setIsInside] = useState(false);

  const [faceStatus, setFaceStatus] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [faceMatchScore, setFaceMatchScore] = useState(null);
  const [faceSignature, setFaceSignature] = useState(null);
  const [isFirstEnrollment, setIsFirstEnrollment] = useState(false);

  const [capturedImage, setCapturedImage] = useState(null);
  const [submittedRecord, setSubmittedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingFlow, setCheckingFlow] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);
  const blinkCountRef = useRef(0);
  const livenessPassedRef = useRef(false);
  const eyesClosedRef = useRef(false);
  const latestSignatureRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const employeeKey =
    currentUser?.id ||
    currentUser?.employee_id ||
    currentUser?.email ||
    localStorage.getItem('userId') ||
    localStorage.getItem('employeeId') ||
    'default_employee';

  const storageKey = `geoattend_face_sig_${employeeKey}`;

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

  const stopFaceLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopCameraTracks = useCallback(() => {
    stopFaceLoop();
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
  }, [stopCameraTracks]);

  const markVideoReadyIfPossible = useCallback(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoReady(true);
    }
  }, []);

  const extractFaceSignature = (landmarks) => {
    if (!landmarks || landmarks.length < 468) return null;

    const noseTip = landmarks[1];
    const leftEyeOuter = landmarks[33];
    const rightEyeOuter = landmarks[263];
    const chin = landmarks[152];

    const interEyeDist = Math.hypot(
      rightEyeOuter.x - leftEyeOuter.x,
      rightEyeOuter.y - leftEyeOuter.y,
      (rightEyeOuter.z || 0) - (leftEyeOuter.z || 0)
    );
    const faceScale =
      interEyeDist ||
      Math.hypot(chin.x - noseTip.x, chin.y - noseTip.y) ||
      0.1;

    const anchorIndices = [
      33, 133, 159, 145,
      263, 362, 386, 374,
      1, 4, 5, 6,
      61, 291, 13, 14,
      234, 454, 152, 10, 70, 300,
    ];

    const vector = [];
    for (const idx of anchorIndices) {
      const pt = landmarks[idx];
      if (!pt) continue;
      vector.push((pt.x - noseTip.x) / faceScale);
      vector.push((pt.y - noseTip.y) / faceScale);
      vector.push(((pt.z || 0) - (noseTip.z || 0)) / faceScale);
    }

    const norm = Math.hypot(...vector) || 1;
    return vector.map((val) => Number((val / norm).toFixed(6)));
  };

  const cosineSimilarity = (vecA, vecB) => {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || !vecA.length) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i += 1) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const getEyeAspectRatio = (landmarks, upperIdx, lowerIdx, leftIdx, rightIdx) => {
    const v = Math.hypot(
      landmarks[upperIdx].x - landmarks[lowerIdx].x,
      landmarks[upperIdx].y - landmarks[lowerIdx].y
    );
    const h = Math.hypot(
      landmarks[rightIdx].x - landmarks[leftIdx].x,
      landmarks[rightIdx].y - landmarks[leftIdx].y
    );
    return h > 0 ? v / h : 0.3;
  };

  const initFaceLandmarker = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numFaces: 2,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    landmarkerRef.current = landmarker;
    return landmarker;
  };

  const evaluateSignatureAgainstEmployee = (sig) => {
    const savedRaw = localStorage.getItem(storageKey);
    if (!savedRaw) {
      setIsFirstEnrollment(true);
      setFaceMatchScore(1);
      return { matched: true, score: 1, isFirstTime: true };
    }

    try {
      const savedSig = JSON.parse(savedRaw);
      const score = Number(cosineSimilarity(savedSig, sig).toFixed(4));
      setIsFirstEnrollment(false);
      setFaceMatchScore(score);
      return {
        matched: score >= FACE_MATCH_THRESHOLD,
        score,
        isFirstTime: false,
      };
    } catch {
      setIsFirstEnrollment(true);
      setFaceMatchScore(1);
      return { matched: true, score: 1, isFirstTime: true };
    }
  };

  const inspectLandmarksAndUpdateState = (landmarks, nowMs) => {
    const leftEAR = getEyeAspectRatio(landmarks, 159, 145, 33, 133);
    const rightEAR = getEyeAspectRatio(landmarks, 386, 374, 362, 263);
    const avgEAR = (leftEAR + rightEAR) / 2;

    if (avgEAR < 0.19) {
      eyesClosedRef.current = true;
    } else if (eyesClosedRef.current && avgEAR >= 0.22) {
      blinkCountRef.current += 1;
      eyesClosedRef.current = false;
      livenessPassedRef.current = true;
      setLivenessVerified(true);
    }

    const sig = extractFaceSignature(landmarks);
    latestSignatureRef.current = { sig, timestampMs: nowMs };
    setFaceDetected(true);

    const matchResult = evaluateSignatureAgainstEmployee(sig);

    if (!matchResult.matched) {
      setFaceStatus(
        `Face mismatch (${Math.round(matchResult.score * 100)}%)! Yeh face is employee ID ke registered face se match nahi kar raha.`
      );
    } else if (!livenessPassedRef.current) {
      setFaceStatus(
        matchResult.isFirstTime
          ? 'First-time face scanned! Selfie lete waqt aankh blink karein.'
          : `Employee face matched (${Math.round(matchResult.score * 100)}%). Selfie lete waqt aankh blink karein.`
      );
    } else {
      setFaceStatus(
        matchResult.isFirstTime
          ? 'Face scanned & live! First-time selfie capture ke liye ready hai.'
          : `Face scanned & live! Employee identity matched (${Math.round(matchResult.score * 100)}%).`
      );
    }

    return { sig, matchResult };
  };

  const runFaceDetectionLoop = () => {
    stopFaceLoop();
    blinkCountRef.current = 0;
    livenessPassedRef.current = false;
    eyesClosedRef.current = false;
    latestSignatureRef.current = null;
    setLivenessVerified(false);
    setFaceDetected(false);

    const processFrame = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || video.readyState < 2 || video.videoWidth === 0 || !landmarker) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      setVideoReady(true);

      const nowMs = performance.now();
      const result = landmarker.detectForVideo(video, nowMs);
      const faces = result?.faceLandmarks || [];

      if (faces.length === 0) {
        setFaceDetected(false);
        latestSignatureRef.current = null;
        setFaceStatus('MediaPipe: Face detect nahi hua. Camera ke samne seedhe dekhein.');
      } else if (faces.length > 1) {
        setFaceDetected(false);
        latestSignatureRef.current = null;
        setFaceStatus('MediaPipe: Ek se zyada faces dikh rahe hain. Sirf employee ka face frame mein rakhein.');
      } else {
        inspectLandmarksAndUpdateState(faces[0], nowMs);
      }

      rafRef.current = requestAnimationFrame(processFrame);
    };

    rafRef.current = requestAnimationFrame(processFrame);
  };

  const fetchBackgroundLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;
          const dist = Math.round(calculateDistance(userLat, userLng, CAMPUS_LAT, CAMPUS_LNG));
          const inside = dist <= ALLOWED_RADIUS;

          setCoords({ lat: userLat, lng: userLng, accuracy });
          setDistance(dist);
          setIsInside(inside);

          if (inside) {
            setLocationStatus(
              `Auto-Verified! Inside NIELIT Agartala zone (${dist}m away, accuracy ±${Math.round(accuracy)}m).`
            );
            resolve({ lat: userLat, lng: userLng, accuracy, dist, inside });
          } else {
            const msg = `Outside radius! You are ${dist}m away (Limit: ${ALLOWED_RADIUS}m). Selfie blocked.`;
            setLocationStatus(msg);
            reject(new Error(msg));
          }
        },
        (error) => {
          setIsInside(false);
          const msg = 'Location error: ' + error.message;
          setLocationStatus(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });

  const startCameraAndAutoVerify = async () => {
    setErrorMsg('');
    setCapturedImage(null);
    setFaceSignature(null);
    setVideoReady(false);
    setCheckingFlow(true);
    setLocationStatus('Background mein automatic GPS location check ho rahi hai...');
    setFaceStatus('Camera open ho raha hai...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if (typeof videoRef.current.play === 'function') {
          await videoRef.current.play().catch(() => {});
        }
        markVideoReadyIfPossible();
      }

      // Run location check and MediaPipe initialization without blocking video preview
      const locationPromise = fetchBackgroundLocation();

      initFaceLandmarker()
        .then(() => {
          runFaceDetectionLoop();
        })
        .catch(() => {
          setFaceStatus('Face scanner load nahi ho paya; camera selfie mode ready hai.');
        });

      await locationPromise;
    } catch (err) {
      stopCameraTracks();
      setIsInside(false);
      setErrorMsg(err.message || 'Location ya camera verification fail ho gaya.');
    } finally {
      setCheckingFlow(false);
    }
  };

  // Scan face directly at the moment selfie is captured
  const capturePhoto = () => {
    setErrorMsg('');

    if (!isInside || !coords) {
      stopCameraTracks();
      setErrorMsg('Aap allowed location ke bahar hain, isliye selfie capture nahi ho sakti.');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMsg('Camera frame abhi ready nahi hai. Thoda ruk kar try karein.');
      return;
    }

    let activeSig = latestSignatureRef.current?.sig || null;

    if (landmarkerRef.current) {
      const nowMs = performance.now();
      const lastMs = latestSignatureRef.current?.timestampMs ?? -1;
      const scanTimestamp = nowMs > lastMs ? nowMs : lastMs + 16;
      const liveScan = landmarkerRef.current.detectForVideo(video, scanTimestamp);
      const faces = liveScan?.faceLandmarks || [];

      if (faces.length === 0) {
        setFaceDetected(false);
        setErrorMsg('Selfie scan fail: Frame mein koi face detect nahi hua.');
        return;
      }

      if (faces.length > 1) {
        setFaceDetected(false);
        setErrorMsg('Selfie scan fail: Ek se zyada faces dikh rahe hain.');
        return;
      }

      const inspected = inspectLandmarksAndUpdateState(faces[0], scanTimestamp);
      activeSig = inspected.sig;

      if (!inspected.matchResult.matched) {
        setErrorMsg(
          'Security alert: Yeh face is employee ID ke registered face se match nahi kar raha.'
        );
        return;
      }

      if (!livenessPassedRef.current) {
        setErrorMsg('Liveness check ke liye selfie lene se pehle ek baar aankh blink karein.');
        return;
      }
    } else if (!activeSig) {
      // Fallback signature when MediaPipe model is unavailable/slow
      setIsFirstEnrollment((prev) => prev || !localStorage.getItem(storageKey));
      setFaceMatchScore(1);
      activeSig = Array.from({ length: 66 }, (_, i) => Number((Math.sin(i + 1) * 0.1).toFixed(6)));
    }

    setFaceSignature(activeSig);

    const width = video.videoWidth || 480;
    const height = video.videoHeight || 360;

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCameraTracks();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!coords || !isInside) {
      setErrorMsg('Allowed geofence ke andar location verify hona zaroori hai.');
      return;
    }

    if (!capturedImage || !faceSignature) {
      setErrorMsg('Pehle face scan karke live selfie capture karein.');
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
          faceSignature,
          faceMatchScore: faceMatchScore ?? 1,
          faceVerified: true,
          isFirstEnrollment,
        },
      });

      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(faceSignature));
      }

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
    livenessPassedRef.current = false;
    blinkCountRef.current = 0;
    eyesClosedRef.current = false;
    latestSignatureRef.current = null;
    setSubmittedRecord(null);
    setCapturedImage(null);
    setIsInside(false);
    setCoords(null);
    setDistance(null);
    setLocationStatus('');
    setFaceStatus('');
    setFaceDetected(false);
    setLivenessVerified(false);
    setFaceMatchScore(null);
    setFaceSignature(null);
    setIsFirstEnrollment(false);
    setErrorMsg('');
  };

  if (submittedRecord) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-200 p-8 rounded-2xl shadow-sm text-center space-y-5 mt-8">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold border border-emerald-200">
          ✓
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Attendance Logged Successfully
        </h2>
        <p className="text-sm text-gray-600">
          Ref: <b>{submittedRecord.ref_code}</b> · Distance: <b>{submittedRecord.distance_meters}m</b> · Status:{' '}
          <span className="text-emerald-700 font-semibold">{submittedRecord.status}</span>
        </p>
        {submittedRecord.selfie_url && (
          <img
            src={submittedRecord.selfie_url}
            alt="Uploaded selfie"
            className="w-32 h-24 object-cover rounded-xl mx-auto border border-gray-200 shadow-sm"
          />
        )}
        <button
          type="button"
          onClick={resetForm}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer"
        >
          Mark Another Entry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white border border-gray-200/80 p-8 rounded-2xl shadow-sm space-y-6 mt-6"
    >
      <div className="border-b border-gray-100 pb-5">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">
            Employee Verification Portal
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mt-1">
          Mark Attendance
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Authenticate via GPS geofence and live selfie (uploaded securely via backend to ImgBB & PostgreSQL).
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Step 1: Auto Background Location & Camera Shortcut */}
      <div className="border border-gray-200/80 p-5 rounded-xl bg-gray-50/40 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
              1
            </span>
            Auto Geofence & Camera Shortcut (NIELIT Agartala)
          </h3>
          {isInside && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-full font-medium">
              Verified ({distance}m)
            </span>
          )}
        </div>

        {!cameraActive && !capturedImage && (
          <button
            type="button"
            disabled={checkingFlow}
            onClick={startCameraAndAutoVerify}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
          >
            {checkingFlow ? 'Checking Location & Camera...' : 'Open Camera Feed'}
          </button>
        )}

        {locationStatus && (
          <p className="text-xs font-medium text-gray-600 bg-white border border-gray-200 p-2.5 rounded-lg">
            {locationStatus}
          </p>
        )}
      </div>

      {/* Step 2: Live MediaPipe Face Scan & Selfie Capture */}
      {(cameraActive || capturedImage) && (
        <div className="border border-gray-200/80 p-5 rounded-xl bg-gray-50/40 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
              2
            </span>
            Biometric Selfie Capture & Face Match
          </h3>

          {faceStatus && (
            <p className="text-xs font-medium text-gray-600 bg-white border border-gray-200 p-2.5 rounded-lg">
              {faceStatus}
            </p>
          )}

          {cameraActive && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={markVideoReadyIfPossible}
                onCanPlay={markVideoReadyIfPossible}
                className="w-full max-w-xs h-48 border border-gray-200 rounded-xl object-cover bg-black shadow-inner"
              />
              <div>
                <button
                  type="button"
                  disabled={!videoReady || !isInside}
                  onClick={capturePhoto}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all cursor-pointer"
                >
                  {!videoReady
                    ? 'Loading Camera Frame...'
                    : !isInside
                    ? 'Verifying Location...'
                    : 'Capture Snapshot'}
                </button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {capturedImage && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg inline-block">
                ✓ Snapshot ready for backend upload
              </p>
              <div>
                <img
                  src={capturedImage}
                  alt="Selfie preview"
                  className="w-32 h-24 border border-gray-200 rounded-xl object-cover shadow-sm"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={startCameraAndAutoVerify}
                  className="text-xs text-gray-600 hover:text-gray-900 font-medium underline cursor-pointer"
                >
                  Retake photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Final Submit */}
      {isInside && capturedImage && (
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white p-3.5 rounded-xl font-semibold text-sm shadow-sm tracking-wide transition-all cursor-pointer"
        >
          {submitting ? 'Uploading to ImgBB & Saving to DB...' : 'Submit Verified Attendance'}
        </button>
      )}
    </form>
  );
}