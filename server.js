require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// --- 1. 설정 및 초기화 ---
const app = express();
const PORT = process.env.PORT || 3000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
// 타임아웃 설정을 환경변수로 분리 (기본값 60초)
const AI_TIMEOUT = parseInt(process.env.AI_REQUEST_TIMEOUT) || 60000;

// --- 2. 미들웨어 설정 ---
app.use(cors()); // 모든 출처 허용 (보안 필요 시 도메인 지정 권장)
app.use(express.json());

// --- 3. 로깅 헬퍼 ---
const log = (msg, type = 'INFO') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${msg}`);
};

// --- 4. 라우트 설정 ---

// 4-1. 헬스 체크
app.get('/', (req, res) => {
    res.status(200).send('✅ Gemini Proxy Server is running well.');
});

// 4-2. AI 응답 생성 프록시
app.post('/api/gemini', async (req, res) => {
    const { user_id, session_id, prompt } = req.body;

    // [유효성 검사] 필수 데이터가 없으면 Python 서버로 보내지 않고 즉시 거절
    if (!user_id || !session_id || !prompt) {
        log('Rejected request due to missing fields.', 'WARN');
        return res.status(400).json({ 
            error: 'Missing required fields: user_id, session_id, and prompt are required.' 
        });
    }

    log(`Received request for Session: ${session_id}, User: ${user_id}`);

    try {
        // [FastAPI 요청]
        const fastApiResponse = await axios.post(
            `${FASTAPI_URL}/generate_ai_response`, 
            { user_id, session_id, prompt },
            { 
                timeout: AI_TIMEOUT, // 환경변수 기반 타임아웃
                headers: { 'Content-Type': 'application/json' }
            }
        );

        // 성공 응답 전달
        log(`Success: Received response from Python server (Length: ${fastApiResponse.data.response?.length || 0})`);
        res.status(fastApiResponse.status).json(fastApiResponse.data);

    } catch (error) {
        // [에러 처리]
        let statusCode = 500;
        let errorMessage = 'Internal Server Error';
        let errorDetails = error.message;

        if (error.code === 'ECONNABORTED') {
            // 타임아웃 에러
            statusCode = 504; // Gateway Timeout
            errorMessage = `Request timed out after ${AI_TIMEOUT/1000} seconds. The AI is taking too long to respond.`;
            log(`Timeout Error: ${errorMessage}`, 'ERROR');
        } else if (error.response) {
            // Python 서버가 에러 응답을 보낸 경우 (4xx, 5xx)
            statusCode = error.response.status;
            errorMessage = error.response.data?.detail || 'Error from AI Service';
            errorDetails = JSON.stringify(error.response.data);
            log(`Python Server Error (${statusCode}): ${errorDetails}`, 'ERROR');
        } else {
            // 네트워크 연결 실패 등
            errorMessage = 'Failed to connect to the AI server.';
            log(`Network/System Error: ${errorDetails}`, 'ERROR');
        }
        
        // 클라이언트(Flutter)에게 JSON 형태로 에러 전달
        res.status(statusCode).json({ 
            error: errorMessage,
            details: errorDetails // 디버깅용 상세 내용 (필요시 제거 가능)
        });
    }
});

// --- 5. 서버 시작 ---
app.listen(PORT, () => {
    log(`🚀 Proxy server listening at http://localhost:${PORT}`);
    log(`🔗 Target FastAPI URL: ${FASTAPI_URL}`);
    log(`⏱️ Request Timeout: ${AI_TIMEOUT}ms`);
});
