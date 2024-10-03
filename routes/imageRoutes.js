import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path'; // path 모듈 import

const router = express.Router();

// 에러 처리 핸들러
function asyncHandler(handler) {
    return async function (req, res) {
        try {
            await handler(req, res);
        } catch (e) {
            if (e.name === 'ValidationError') {
                res.status(400).send({ message: e.message });
            } else if (e.name === 'CastError') {
                res.status(404).send({ message: 'Cannot find given id.' });
            } else {
                res.status(500).send({ message: e.message });
            }
        }
    };
}

// 이미지 저장 경로 설정 (서버에 저장)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        
        // 저장 폴더가 없으면 생성
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        
        cb(null, uploadDir); // 이미지가 저장될 경로
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname); // 확장자 추출
        cb(null, file.fieldname + '-' + uniqueSuffix + ext); // 파일명 설정
    }
});

// Multer 설정 (이미지 파일만 받도록 필터링)
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const fileTypes = /jpeg|jpg|png/; // 허용할 이미지 타입
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeType = fileTypes.test(file.mimetype);

        if (extname && mimeType) {
            return cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다.'));
        }
    }
});

// POST /api/image (이미지 업로드 API)
router.post('/image', upload.single('image'), asyncHandler((req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: '이미지 파일을 업로드해주세요.' });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`; // 이미지 URL 생성

    return res.status(200).json({
        imageUrl: imageUrl // 업로드된 이미지 URL 반환
    });
}));

// /api/uploads 정적 파일 제공 (업로드된 이미지 접근 가능하도록 설정)
router.use('/uploads', express.static('uploads'));

export default router;
