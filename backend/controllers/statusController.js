const Status = require('../models/status');
const response = require('../utils/responseHandler');
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');

exports.createStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content = '' } = req.body;
    let mediaUrl = '';
    let contentType = 'text';
    if (req.file) {
      const uploaded = await uploadFileToCloudinary(req.file, req);
      mediaUrl = uploaded?.secure_url || '';
      contentType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    } else if (!String(content).trim()) {
      return response(res, 400, 'Status cannot be empty');
    }
    const status = await Status.create({
      user: userId,
      content: String(content).trim(),
      mediaUrl,
      contentType,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await status.populate('user', 'username profilepicture');
    req.io?.emit('status_updated');
    return response(res, 201, 'Status created', status);
  } catch (error) {
    console.error('createStatus:', error);
    return response(res, 500, error.message || 'Unable to create status');
  }
};

exports.getStatuses = async (req, res) => {
  try {
    const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
      .populate('user', 'username profilepicture')
      .populate('viewers', 'username profilepicture')
      .sort({ createdAt: -1 });
    return response(res, 200, 'Statuses retrieved', statuses);
  } catch (error) {
    return response(res, 500, 'Unable to retrieve statuses');
  }
};

exports.viewStatus = async (req, res) => {
  try {
    const status = await Status.findById(req.params.statusId);
    if (!status) return response(res, 404, 'Status not found');
    if (String(status.user) !== String(req.user.userId) && !status.viewers.some((id) => String(id) === String(req.user.userId))) {
      status.viewers.push(req.user.userId);
      await status.save();
    }
    return response(res, 200, 'Status viewed');
  } catch (error) {
    return response(res, 500, 'Unable to view status');
  }
};

exports.deleteStatus = async (req, res) => {
  try {
    const status = await Status.findById(req.params.statusId);
    if (!status) return response(res, 404, 'Status not found');
    if (String(status.user) !== String(req.user.userId)) return response(res, 403, 'Not allowed');
    await status.deleteOne();
    req.io?.emit('status_updated');
    return response(res, 200, 'Status deleted');
  } catch (error) {
    return response(res, 500, 'Unable to delete status');
  }
};
