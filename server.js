// server.js 파일 (타임아웃 설정 추가)

require('dotenv').config();
// 1. 패키지 불러오기
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. Express 앱 생성
const app = express();
const port = process.env.PORT || 3000;

// 3. 미들웨어 설정

// 3-1. CORS 설정
app.use(cors());

// 3-2. JSON 요청 본문 파싱 설정
app.use(express.json());

// --- 라우트(경로) 설정 ---

// 4. 기본 엔드포인트: 헬스 체크
app.get('/', (req, res) => {
    res.send('Gemini Proxy Server is running!');
});

// 5. 서버 시작
app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});

// FastAPI 서버 주소 (Render 환경 변수에서 로드)
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'; 

/**
 * 6. Gemini AI 응답 요청을 위한 프록시 엔드포인트
 */
app.post('/api/gemini', async (req, res) => {
    // 6-1. 요청 본문 추출
    const requestBody = req.body;
    
    if (!requestBody || !requestBody.prompt) {
        // FastAPI의 PromptRequest 모델과 일치하는지 확인해야 하지만, 
        // prompt만 확인하여 기본적인 유효성 검사 수행
        return res.status(400).json({ error: 'Prompt, user_id, and session_id are typically required.' });
    }

    try {
        // 6-2. Axios를 사용하여 FastAPI 서버로 요청 전달
        // ✨ 타임아웃 옵션 추가 (60000ms = 60초)
        const fastApiResponse = await axios.post(
            `${FASTAPI_URL}/generate_ai_response`, 
            requestBody,
            {
                timeout: 60000 // AI 검색 및 응답을 위한 충분한 시간 확보
            }
        );

        // 6-3. FastAPI에서 받은 응답을 Flutter 앱으로 다시 전달
        res.status(fastApiResponse.status).json(fastApiResponse.data);

    } catch (error) {
        // 6-4. 에러 처리 (타임아웃 포함)
        let statusCode = 500;
        let errorMessage = { error: 'Internal server error or failed to connect to AI service.' };
        
        if (error.code === 'ECONNABORTED') {
            // 타임아웃 에러 처리
            statusCode = 504; // Gateway Timeout
            errorMessage = { error: 'AI processing timed out. Please try again.' };
        } else if (error.response) {
            // FastAPI에서 받은 에러 응답
            statusCode = error.response.status;
            errorMessage = error.response.data;
        }

        console.error('Error communicating with FastAPI server:', error.message);
        res.status(statusCode).json(errorMessage);
    }
});
