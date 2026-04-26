/**
 * 路由定义
 * 将 HTTP 方法 + 路径 映射到对应的控制器方法
 */

import express from 'express';
import * as ctrl from '../controllers/leavesController.js';

const router = express.Router();

// GET    /api/leaves          查询列表（支持 employee_name / leave_type / status 过滤）
router.get('/', ctrl.list);

// POST   /api/leaves          新建休假申请
router.post('/', ctrl.create);

// GET    /api/leaves/:id      查询单条记录
router.get('/:id', ctrl.getOne);

// PUT    /api/leaves/:id      编辑休假申请（仅限"待审批"）
router.put('/:id', ctrl.update);

// DELETE /api/leaves/:id      删除休假申请（仅限"待审批"）
router.delete('/:id', ctrl.remove);

// PATCH  /api/leaves/:id/status  审批休假申请
router.patch('/:id/status', ctrl.approve);

export default router;
