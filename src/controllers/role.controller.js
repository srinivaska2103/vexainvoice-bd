const roleService = require('../services/role.service');
const { sendSuccess } = require('../utils/response.util');

const getRoles = async (req, res, next) => {
  try {
    const roles = await roleService.getRoles(req.user.business_id);
    return sendSuccess(res, 'Roles fetched successfully', roles);
  } catch (error) {
    next(error);
  }
};

const getRoleBySlug = async (req, res, next) => {
  try {
    const role = await roleService.getRoleBySlug(req.params.slug);
    return sendSuccess(res, 'Role configuration resolved successfully', role);
  } catch (error) {
    next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const role = await roleService.createRole(req.user.business_id, req.body);
    return sendSuccess(res, 'Custom role created successfully', role, 201);
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const role = await roleService.updateRole(req.user.business_id, req.params.id, req.body);
    return sendSuccess(res, 'Custom role updated successfully', role);
  } catch (error) {
    next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const result = await roleService.deleteRole(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoles,
  getRoleBySlug,
  createRole,
  updateRole,
  deleteRole
};
