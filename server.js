// server.js 파일 내용
require('dotenv').config();
// 1. 패키지 불러오기
const express = require('express');
const axios = require('axios');
const cors = require('cors');

// 2. Express 앱 생성
const app = express();
const port = process.env.PORT || 3000; // Render에서 사용할 포트 또는 로컬 테스트용 3000

// 3. 미들웨어 설정

// 3-1. CORS 설정: 모든 출처(Flutter 앱)からのアクセスを許可
// 실제 운영 환경에서는 보안을 위해 Flutter 앱의 주소만 허용하도록 설정하는 것이 좋습니다.
// 예: cors({ origin: 'https://your-flutter-app-domain.com' })
app.use(cors());

// 3-2. JSON 요청 본문 파싱 설정: Flutter 앱에서 보낸 JSON 데이터를 처리
app.use(express.json());

// --- 라우트(경로) 설정 ---

// 4. 기본 엔드포인트: 서버가 잘 작동하는지 확인하기 위함
app.get('/', (req, res) => {
    res.send('Gemini Proxy Server is running!');
});

// 5. 서버 시작
app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'; // 예시 주소

/**
 * 6. Gemini AI 응답 요청을 위한 프록시 엔드포인트
 * Flutter 앱은 이 엔드포인트로 요청을 보냅니다.
 */
app.post('/api/gemini', async (req, res) => {
    // 6-1. Flutter 앱에서 보낸 요청 본문(JSON) 추출
    // { "prompt": "사용자 질문" } 와 같은 형태일 것입니다.
    const requestBody = req.body;
    
    // 요청 본문이 비어있으면 에러 응답
    if (!requestBody || !requestBody.prompt) {
        return res.status(400).json({ error: 'Prompt is required in the request body.' });
    }

    try {
        // 6-2. Axios를 사용하여 FastAPI 서버로 요청 전달
        // FastAPI의 AI 엔드포인트가 /generate_ai_response라고 가정합니다.
        const fastApiResponse = await axios.post(
            `${FASTAPI_URL}/generate_ai_response`, 
            requestBody // Flutter 앱에서 받은 요청 본문을 그대로 전달
        );

        // 6-3. FastAPI에서 받은 응답을 Flutter 앱으로 다시 전달
        // 상태 코드와 응답 본문을 그대로 전달하여 투명하게 중계합니다.
        res.status(fastApiResponse.status).json(fastApiResponse.data);

    } catch (error) {
        // 6-4. FastAPI 서버 통신 실패 또는 에러 처리
        console.error('Error communicating with FastAPI server:', error.message);
        
        // FastAPI에서 받은 에러 응답이 있다면 그 상태 코드를 사용
        const statusCode = error.response ? error.response.status : 500;
        const errorMessage = error.response ? error.response.data : { error: 'Internal server error or failed to connect to AI service.' };
        
        res.status(statusCode).json(errorMessage);
    }
});