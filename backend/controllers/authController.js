const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const response = require('../utils/responseHandler');
const generateToken = require('../utils/generateToken');
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const { hashPassword, verifyPassword } = require('../utils/password');
const normalizePhone = require('../utils/phoneNumber');

const setAuthCookie = (res, token) => {
  res.cookie('auth_token', token, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (password) => typeof password === 'string' && password.length >= 6 && password.length <= 72;
const safeUser = (user) => {
  const obj = user?.toObject ? user.toObject() : { ...(user || {}) };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

const resolveIdentity = (body) => {
  if (body.email) {
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) throw new Error('Enter a valid email address');
    return { type: 'email', query: { email }, values: { email } };
  }
  if (!body.phoneNumber || !body.phoneSuffix) throw new Error('Mobile number and country code are required');
  const phone = normalizePhone(body.phoneNumber, body.phoneSuffix);
  return { type: 'phone', query: { fullPhoneNumber: phone.fullPhoneNumber }, values: phone };
};

exports.register = async (req, res) => {
  try {
    const { password } = req.body;
    if (!validPassword(password)) return response(res, 400, 'Password must be 6 to 72 characters');

    const identity = resolveIdentity(req.body);
    // passwordHash is select:false, so explicitly include it when checking whether
    // an existing user is a legacy OTP-only account.
    const exists = await User.findOne(identity.query).select('+passwordHash');

    if (exists) {
      // One-time legacy migration: preserve the same MongoDB user document (and
      // therefore existing profile/chats) and add a password instead of creating
      // a duplicate account.
      if (!exists.passwordHash) {
        exists.passwordHash = hashPassword(password);
        exists.isverified = true;
        exists.agreed = true;
        exists.lastSeen = new Date();
        await exists.save();

        const token = generateToken(exists._id);
        setAuthCookie(res, token);
        return response(res, 200, 'Password added to your existing account', {
          token,
          user: safeUser(exists),
          migratedLegacyAccount: true,
        });
      }

      return response(res, 409, 'This account already has a password. Please use Log in.');
    }

    const user = new User({
      ...identity.values,
      passwordHash: hashPassword(password),
      isverified: true,
      agreed: true,
    });
    await user.save();

    const token = generateToken(user._id);
    setAuthCookie(res, token);
    return response(res, 201, 'Account created successfully', { token, user: safeUser(user) });
  } catch (error) {
    console.error('register:', error);
    if (error?.code === 11000) return response(res, 409, 'An account already exists with this phone number or email');
    return response(res, 400, error.message || 'Unable to create account');
  }
};

exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return response(res, 400, 'Password is required');

    const identity = resolveIdentity(req.body);
    const user = await User.findOne(identity.query).select('+passwordHash');
    if (!user) return response(res, 401, 'Incorrect phone/email or password');

    if (!user.passwordHash) {
      // This is an expected migration state, not a server failure. Return 200 so
      // the frontend can move the user to the one-time password setup screen
      // without producing a red 409 resource error in the browser console.
      return response(res, 200, 'Older OTP account found. Set a password to continue.', {
        requiresPasswordSetup: true,
      });
    }

    if (!verifyPassword(password, user.passwordHash)) return response(res, 401, 'Incorrect phone/email or password');

    user.isverified = true;
    user.lastSeen = new Date();
    await user.save();
    const token = generateToken(user._id);
    setAuthCookie(res, token);
    return response(res, 200, 'Login successful', { token, user: safeUser(user) });
  } catch (error) {
    console.error('login:', error);
    return response(res, 400, error.message || 'Unable to login');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return response(res, 404, 'User not found');

    const { username, about, agreed, profilePicture } = req.body;
    if (req.file) {
      const uploaded = await uploadFileToCloudinary(req.file, req);
      user.profilepicture = uploaded?.secure_url || '';
    } else if (profilePicture) {
      user.profilepicture = profilePicture;
    }
    if (username !== undefined) user.username = String(username).trim();
    if (about !== undefined) user.about = String(about).trim();
    if (agreed !== undefined) user.agreed = String(agreed) === 'true' || agreed === true;
    await user.save();
    return response(res, 200, 'Profile updated', safeUser(user));
  } catch (error) {
    console.error('updateProfile:', error);
    return response(res, 500, error.message || 'Unable to update profile');
  }
};

exports.checkAuth = async (req, res) => {
  // Session checks are intentionally returned as HTTP 200 even when the user
  // is logged out. This avoids a noisy 401 in the browser console on /user-login.
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = req.cookies?.auth_token || bearer;

  if (!token || !process.env.JWT_SECRET) {
    return response(res, 200, 'Not authenticated', { authenticated: false, user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return response(res, 200, 'Not authenticated', { authenticated: false, user: null });
    }

    const user = await User.findById(userId);
    if (!user) {
      return response(res, 200, 'Not authenticated', { authenticated: false, user: null });
    }

    return response(res, 200, 'Authenticated', { authenticated: true, user: safeUser(user) });
  } catch (_) {
    return response(res, 200, 'Not authenticated', { authenticated: false, user: null });
  }
};

exports.logout = async (req, res) => {
  try {
    if (req.user?.userId) {
      await User.findByIdAndUpdate(req.user.userId, { isOnline: false, lastSeen: new Date() });
    }
  } catch (_) {}
  res.clearCookie('auth_token', {
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response(res, 200, 'Logged out');
};

exports.getAllUser = async (req, res) => {
  try {
    const loggedInUser = req.user.userId;
    const users = await User.find({ _id: { $ne: loggedInUser }, isverified: true })
      .select('username profilepicture about phoneNumber phoneSuffix fullPhoneNumber lastSeen isOnline')
      .lean();

    const result = await Promise.all(users.map(async (user) => {
      const conversation = await Conversation.findOne({
        participants: { $all: [loggedInUser, user._id], $size: 2 },
      }).populate({ path: 'lastMessage', select: 'content contentType mediaUrl createdAt sender receiver messageStatus' }).lean();

      let unreadCount = 0;
      if (conversation) {
        unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          receiver: loggedInUser,
          messageStatus: { $ne: 'read' },
          deletedForEveryone: false,
        });
      }
      return { ...user, conversation: conversation || null, unreadCount };
    }));

    result.sort((a, b) => {
      const at = a.conversation?.updatedAt ? new Date(a.conversation.updatedAt).getTime() : 0;
      const bt = b.conversation?.updatedAt ? new Date(b.conversation.updatedAt).getTime() : 0;
      return bt - at;
    });
    return response(res, 200, 'Users retrieved', result);
  } catch (error) {
    console.error('getAllUser:', error);
    return response(res, 500, 'Unable to retrieve users');
  }
};
