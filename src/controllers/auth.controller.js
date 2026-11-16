const authService = require('../services/auth.service');
const {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateBusinessSchema
} = require('../validators/auth.validator');
const { sendSuccess } = require('../utils/response.util');

const sendOtp = async (req, res, next) => {
  try {
    // If body contains business registration fields, validate with registerSchema
    if (req.body.business_name || req.body.password) {
      const validatedData = registerSchema.parse(req.body);
      const result = await authService.sendRegistrationOtp(validatedData);
      return sendSuccess(res, 'OTP verification code sent to your email', result);
    }

    // Fallback for simple OTP dispatch
    const { email, name } = sendOtpSchema.parse(req.body);
    const result = await authService.sendRegistrationOtp({ email, admin_name: name });
    return sendSuccess(res, 'OTP verification code sent to your email', result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { id, email, otp, registrationData } = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyRegistrationOtp({ id, email, otp, registrationData });
    return sendSuccess(res, 'Company and admin account created successfully', result, 201);
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.registerBusinessAndAdmin(validatedData);
    return sendSuccess(res, 'Business and admin account registered successfully', result, 201);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, role_slug } = loginSchema.parse(req.body);
    const result = await authService.loginUser(email, password, role_slug);
    return sendSuccess(res, 'Login successful', result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    return sendSuccess(res, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getUserProfile(req.user.id);
    return sendSuccess(res, 'Current user profile fetched', result);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = sendOtpSchema.parse(req.body);
    const result = await authService.sendForgotPasswordOtp(email);
    return sendSuccess(res, 'Password reset OTP sent to your email', result);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPasswordWithOtp(email, otp, new_password);
    return sendSuccess(res, 'Password has been reset successfully. You can now login.', result);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const result = await authService.updateUserProfile(req.user.id, data);
    return sendSuccess(res, 'Profile updated successfully', result);
  } catch (error) {
    next(error);
  }
};

const updateBusiness = async (req, res, next) => {
  try {
    const data = updateBusinessSchema.parse(req.body);
    const result = await authService.updateBusinessDetails(req.user.business_id, data);
    return sendSuccess(res, 'Business updated successfully', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile,
  updateBusiness
};
