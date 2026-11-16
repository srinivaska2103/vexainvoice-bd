const userService = require('../services/user.service');
const { createUserSchema, updateUserSchema } = require('../validators/user.validator');
const { sendSuccess } = require('../utils/response.util');

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers(req.user.business_id);
    return sendSuccess(res, 'Team users fetched successfully', users);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'User details fetched successfully', user);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    const user = await userService.createUser(req.user.business_id, validatedData);
    return sendSuccess(res, 'Team user created successfully', user, 201);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const validatedData = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.user.business_id, req.params.id, validatedData);
    return sendSuccess(res, 'Team user updated successfully', user);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.user.business_id, req.params.id, req.user.id);
    return sendSuccess(res, result.message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
