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
    const sortOption = sortBy === 'mostPosted' ? { postCount: -1 } :
                       sortBy === 'mostLiked' ? { likeCount: -1 } :
                       sortBy === 'mostBadge' ? { badges: -1 } :
                       { createdAt: -1 }; // Default: latest
    
    const query = keyword ? { name: new RegExp(keyword, 'i') } : {};
    if (isPublic !== undefined) query.isPublic = isPublic === 'true';
    
    const skip = (page - 1) * pageSize;
    const groups = await Group.find(query).sort(sortOption).skip(skip).limit(Number(pageSize));
    const totalItemCount = await Group.countDocuments(query);

    res.send({
        currentPage: Number(page),
        totalPages: Math.ceil(totalItemCount / pageSize),
        totalItemCount,
        data: groups
    });
}));

// 그룹 상세 조회 API
app.get('/api/groups/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const group = await Group.findById(id);
    if (group) {
        res.send(group);
    } else {
        res.status(404).send({ message: 'Cannot find given id.' });
    }
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

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));
