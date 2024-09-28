import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import Group from './models/group.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('Connected to DB'));

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

// 그룹 등록 API
app.post('/api/groups', asyncHandler(async (req, res) => {
    const newGroup = await Group.create(req.body);
    res.status(201).send(newGroup);
}));

// 그룹 목록 조회 API
app.get('/api/groups', asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;

    // 정렬 옵션 설정
    const sortOption = sortBy === 'mostPosted' ? { postCount: -1 } :
                       sortBy === 'mostLiked' ? { likeCount: -1 } :
                       sortBy === 'mostBadge' ? { badges: -1 } :
                       { createdAt: -1 }; // Default: 최신순

    // 검색 조건 설정
    const query = keyword ? { name: new RegExp(keyword, 'i') } : {};
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';

    // 페이징 처리
    const skip = (page - 1) * pageSize;
    
    // 그룹 조회 (비밀번호 제외, 배지 목록 대신 배지 수로 변환)
    const groups = await Group.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(pageSize))
        .select('-password') // 비밀번호 제외
        .lean() // 리턴된 문서를 평범한 JS 객체로 변환 (수정 가능하게)

    // 각 그룹에 배지 수 추가
    groups.forEach(group => {
        group.badgeCount = group.badges.length; // 배지 목록 대신 배지 수
        delete group.badges; // 배지 목록 삭제
    });

    // 총 문서 수 계산
    const totalItemCount = await Group.countDocuments(query);

    // 응답
    res.send({
        currentPage: Number(page),
        totalPages: Math.ceil(totalItemCount / pageSize),
        totalItemCount,
        data: groups
    });
}));

// 그룹 상세 조회 API
app.post('/api/groups/:id', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const { password } = req.body; // 비밀번호를 요청 본문에서 받음

    const group = await Group.findById(groupId);

    if (!group) {
        return res.status(404).send({ message: '존재하지 않는 그룹입니다' });
    }

    if (!group.isPublic) {
        // 비공개 그룹일 경우 비밀번호 확인
        if (!password || password !== group.password) {
            return res.status(403).send({ message: '비밀번호가 일치하지 않습니다' });
        }
    }

    // 비밀번호는 응답에서 제외하고 그룹 정보 전송
    const groupDetails = {
        id: group._id,
        name: group.name,
        imageUrl: group.imageUrl,
        isPublic: group.isPublic,
        likeCount: group.likeCount,
        badges: group.badges,
        postCount: group.postCount,
        createdAt: group.createdAt,
        introduction: group.introduction
    };

    res.status(200).send(groupDetails);
}));


// 그룹 수정 API
app.put('/api/groups/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        if (group.password === req.body.password) {
            Object.keys(req.body).forEach((key) => {
                if (key !== 'password') group[key] = req.body[key];
            });
            await group.save();
            res.send(group);
        } else {
            res.status(403).send({ message: '비밀번호가 틀렸습니다' });
        }
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 삭제 API
app.delete('/api/groups/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        if (group.password === req.body.password) {
            await Group.findByIdAndDelete(id);
            res.send({ message: '그룹 삭제 성공' });
        } else {
            res.status(403).send({ message: '비밀번호가 틀렸습니다' });
        }
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 공감하기 API
app.post('/api/groups/:id/like', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        group.likeCount += 1;
        await group.save();
        res.send({ message: '그룹 공감하기 성공' });
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 공개 여부 확인 API
app.get('/api/groups/:id/is-public', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        res.send({ id: group._id, isPublic: group.isPublic });
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
}));

// 그룹 조회 권한 확인 API
app.post('/api/groups/:groupId/verify-password', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { password } = req.body;

    // 그룹 찾기
    const group = await Group.findById(groupId);

    // 그룹이 존재하지 않을 경우 404 응답
    if (!group) {
        return res.status(404).send({ message: '그룹이 존재하지 않습니다' });
    }

    // 비밀번호 비교
    if (group.password === password) {
        res.status(200).send({ message: '비밀번호가 확인되었습니다' });
    } else {
        res.status(401).send({ message: '비밀번호가 틀렸습니다' });
    }
}));


app.listen(process.env.PORT || 3000, () => console.log('Server Started'));
