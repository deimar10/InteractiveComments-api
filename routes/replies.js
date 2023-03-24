const express = require('express');
const router = express.Router();

const controller = require('../controllers/replies');

router.post('/reply/create/:id', controller.createReply);

module.exports = router;