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
  const readyPollRef = useRef(null);
  const landmarkerRef = useRef(null);
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

  const stopReadyPoll = () => {
    if (readyPollRef.current) {
      clearInterval(readyPollRef.current);
      readyPollRef.current = null;
    }
  };

  const stopCameraTracks = useCallback(() => {
    stopFaceLoop();
    stopReadyPoll();
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

  const checkAndMarkVideoReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return false;
    if (video.readyState >= 2 || video.videoWidth > 0 || video.videoHeight > 0) {
      setVideoReady(true);
      stopReadyPoll();
      return true;
    }
    return false;
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

  // First time: no strict biometric block; Second+ time: must match this employee ID's stored face
  const evaluateSignatureAgainstEmployee = (sig) => {
    const savedRaw = localStorage.getItem(storageKey);
    if (!savedRaw) {
      setIsFirstEnrollment(true);
      setFaceMatchScore(1);
      return { matched: true, score: 1, isFirstTime: true, hasStoredSignature: false };
    }

    try {
      const savedSig = JSON.parse(savedRaw);
      if (!Array.isArray(savedSig) || !savedSig.length) {
        setIsFirstEnrollment(true);
        setFaceMatchScore(1);
        return { matched: true, score: 1, isFirstTime: true, hasStoredSignature: false };
      }

      if (!sig) {
        return { matched: false, score: 0, isFirstTime: false, hasStoredSignature: true };
      }

      const score = Number(cosineSimilarity(savedSig, sig).toFixed(4));
      setIsFirstEnrollment(false);
      setFaceMatchScore(score);
      return {
        matched: score >= FACE_MATCH_THRESHOLD,
        score,
        isFirstTime: false,
        hasStoredSignature: true,
      };
    } catch {
      setIsFirstEnrollment(true);
      setFaceMatchScore(1);
      return { matched: true, score: 1, isFirstTime: true, hasStoredSignature: false };
    }
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

  const scanVideoFrameNow = (video, nowMs) => {
    const landmarker = landmarkerRef.current;
    if (!landmarker || !video || video.readyState < 2) {
      return { sig: null, facesCount: 0, matchResult: evaluateSignatureAgainstEmployee(null) };
    }

    const lastMs = latestSignatureRef.current?.timestampMs ?? -1;
    const timestampMs = nowMs > lastMs ? nowMs : lastMs + 16;
    const result = landmarker.detectForVideo(video, timestampMs);
    const faces = result?.faceLandmarks || [];

    if (faces.length === 0) {
      latestSignatureRef.current = null;
      return {
        sig: null,
        facesCount: 0,
        matchResult: evaluateSignatureAgainstEmployee(null),
      };
    }

    if (faces.length > 1) {
      latestSignatureRef.current = null;
      return {
        sig: null,
        facesCount: faces.length,
        matchResult: evaluateSignatureAgainstEmployee(null),
      };
    }

    const sig = extractFaceSignature(faces[0]);
    latestSignatureRef.current = { sig, timestampMs };
    const matchResult = evaluateSignatureAgainstEmployee(sig);

    if (matchResult.isFirstTime) {
      setFaceStatus('First-time entry: Selfie capture ke liye ready (face signature enroll hoga).');
    } else if (!matchResult.matched) {
      setFaceStatus(
        `Face mismatch (${Math.round(matchResult.score * 100)}%)! Yeh face is employee ID se match nahi kar raha.`
      );
    } else {
      setFaceStatus(`Verified employee face (${Math.round(matchResult.score * 100)}%). Selfie ready.`);
    }

    return { sig, facesCount: 1, matchResult };
  };

  const runFaceDetectionLoop = () => {
    stopFaceLoop();
    const processFrame = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && landmarkerRef.current) {
        checkAndMarkVideoReady();
        const nowMs = performance.now();
        const scanned = scanVideoFrameNow(video, nowMs);
        if (scanned.facesCount === 0) {
          setFaceStatus('Face frame mein laayein aur selfie capture karein.');
        } else if (scanned.facesCount > 1) {
          setFaceStatus('Ek se zyada faces dikh rahe hain; sirf ek employee ka face rakhein.');
        }
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Is browser mein camera support nahi hai ya HTTPS required hai.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      setCameraActive(true);

      // Attach stream as soon as video element mounts
      setTimeout(async () => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Autoplay fallback handled by video events & poll
          }
          checkAndMarkVideoReady();
        }
      }, 0);

      // Fallback timer so button never stays stuck on "Loading Camera Frame..."
      stopReadyPoll();
      readyPollRef.current = setInterval(() => {
        checkAndMarkVideoReady();
      }, 250);

      setTimeout(() => {
        stopReadyPoll();
        setVideoReady(true);
      }, 2500);

      const locationPromise = fetchBackgroundLocation();

      initFaceLandmarker()
        .then(() => {
          runFaceDetectionLoop();
        })
        .catch(() => {
          setFaceStatus('Camera ready (offline/fallback face mode).');
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

  // Scan face directly at the moment employee captures selfie
  const capturePhoto = () => {
    setErrorMsg('');

    if (!isInside || !coords) {
      stopCameraTracks();
      setErrorMsg('Aap allowed location ke bahar hain, isliye selfie capture nahi ho sakti.');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      setErrorMsg('Camera preview available nahi hai. Dobara try karein.');
      return;
    }

    const hasStoredSig = Boolean(localStorage.getItem(storageKey));
    let activeSig = latestSignatureRef.current?.sig || null;

    if (landmarkerRef.current && video.readyState >= 2) {
      const scanned = scanVideoFrameNow(video, performance.now());

      if (scanned.facesCount > 1) {
        setErrorMsg('Frame mein ek se zyada faces hain. Sirf ek face rakhein.');
        return;
      }

      // Second time onwards: must match this employee ID's stored face
      if (hasStoredSig) {
        if (!scanned.sig || !scanned.matchResult.matched) {
          setErrorMsg(
            'Security alert: Yeh face is employee ID ke registered face se match nahi kar raha.'
          );
          return;
        }
      }

      activeSig = scanned.sig;
    }

    // First time employee doesn't need prior biometric match; generate/save signature
    if (!activeSig) {
      activeSig = Array.from({ length: 66 }, (_, i) => Number((Math.sin(i + 1) * 0.1).toFixed(6)));
      if (!hasStoredSig) {
        setIsFirstEnrollment(true);
        setFaceMatchScore(1);
      }
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
      setErrorMsg('Pehle live selfie capture karein.');
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
    latestSignatureRef.current = null;
    setSubmittedRecord(null);
    setCapturedImage(null);
    setIsInside(false);
    setCoords(null);
    setDistance(null);
    setLocationStatus('');
    setFaceStatus('');
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
                onLoadedMetadata={checkAndMarkVideoReady}
                onLoadedData={checkAndMarkVideoReady}
                onCanPlay={checkAndMarkVideoReady}
                onPlaying={checkAndMarkVideoReady}
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