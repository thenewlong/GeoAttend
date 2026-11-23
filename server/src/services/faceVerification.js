const FACE_MATCH_THRESHOLD = 0.78;

export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || !vecA.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    const a = Number(vecA[i]);
    const b = Number(vecB[i]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function verifyOrEnrollEmployeeFace({ pool, employeeId, faceSignature, selfieUrl }) {
  if (!Array.isArray(faceSignature) || faceSignature.length < 20) {
    throw new Error('Valid face scan signature missing hai.');
  }

  const empRes = await pool.query(
    'SELECT id, face_signature FROM employees WHERE id = $1',
    [employeeId]
  );

  if (empRes.rowCount === 0) {
    throw new Error('Employee record nahi mila.');
  }

  const storedSignature = empRes.rows[0].face_signature;

  // Day 1: First-time enrollment for this employee
  if (!storedSignature) {
    await pool.query(
      `UPDATE employees
       SET face_signature = $1::jsonb,
           reference_selfie_url = COALESCE($2, reference_selfie_url),
           face_enrolled_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(faceSignature), selfieUrl || null, employeeId]
    );

    return {
      faceVerified: true,
      faceMatchScore: 1,
      isFirstEnrollment: true,
    };
  }

  // Next days: Must match the enrolled face of THIS employee
  const score = Number(cosineSimilarity(storedSignature, faceSignature).toFixed(4));

  if (score < FACE_MATCH_THRESHOLD) {
    const err = new Error(
      `Face verification failed (${Math.round(score * 100)}%). Yeh face is employee ke registered face se match nahi karta.`
    );
    err.statusCode = 403;
    throw err;
  }

  return {
    faceVerified: true,
    faceMatchScore: score,
    isFirstEnrollment: false,
  };
}