const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

const getUsers = async (business_id) => {
  const users = await prisma.users.findMany({
    where: {
      business_id,
      is_active: true
    },
    include: {
      custom_roles: {
        select: {
          id: true,
          name: true,
          slug: true,
          permissions: true,
          is_active: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email || 'N/A',
    phone: u.phone || 'N/A',
    role: u.role,
    custom_role_id: u.custom_role_id || null,
    custom_role: u.custom_roles ? {
      id: u.custom_roles.id,
      name: u.custom_roles.name,
      slug: u.custom_roles.slug,
      permissions: u.custom_roles.permissions,
      is_active: u.custom_roles.is_active
    } : null,
    displayRole: u.custom_roles ? u.custom_roles.name : u.role,
    status: u.is_active ? 'Active' : 'Inactive',
    is_active: u.is_active,
    lastLogin: u.updated_at ? new Date(u.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'
  }));
};

const getUserById = async (business_id, id) => {
  const user = await prisma.users.findFirst({
    where: { id, business_id },
    include: {
      custom_roles: true
    }
  });

  if (!user) {
    const error = new Error('Team user not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email || '',
    phone: user.phone || 'N/A',
    role: user.role,
    custom_role_id: user.custom_role_id || null,
    custom_role: user.custom_roles || null,
    displayRole: user.custom_roles ? user.custom_roles.name : user.role,
    status: user.is_active ? 'Active' : 'Inactive',
    is_active: user.is_active,
    lastLogin: user.updated_at ? new Date(user.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'
  };
};

const createUser = async (business_id, data) => {
  const existingUser = await prisma.users.findFirst({
    where: {
      business_id,
      email: data.email
    }
  });

  if (existingUser) {
    const error = new Error('A user with this email address already exists in your team.');
    error.statusCode = 409;
    throw error;
  }

  // Validate custom_role_id if provided
  let validCustomRoleId = null;
  if (data.custom_role_id) {
    const customRole = await prisma.custom_roles.findFirst({
      where: { id: data.custom_role_id, business_id, is_active: true }
    });
    if (!customRole) {
      const error = new Error('Assigned custom role does not exist or is inactive.');
      error.statusCode = 400;
      throw error;
    }
    validCustomRoleId = customRole.id;
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const isActive = data.status ? data.status === 'Active' : (data.is_active !== undefined ? data.is_active : true);

  const newUser = await prisma.users.create({
    data: {
      business_id,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      password_hash: hashedPassword,
      role: data.role || 'BILLING_STAFF',
      custom_role_id: validCustomRoleId,
      is_active: isActive
    },
    include: {
      custom_roles: true
    }
  });

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email || 'N/A',
    phone: newUser.phone || 'N/A',
    role: newUser.role,
    custom_role_id: newUser.custom_role_id,
    custom_role: newUser.custom_roles || null,
    displayRole: newUser.custom_roles ? newUser.custom_roles.name : newUser.role,
    status: newUser.is_active ? 'Active' : 'Inactive',
    is_active: newUser.is_active,
    lastLogin: 'Never'
  };
};

const updateUser = async (business_id, id, data) => {
  const user = await prisma.users.findFirst({
    where: { id, business_id }
  });

  if (!user) {
    const error = new Error('Team user not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.email && data.email !== user.email) {
    const emailConflict = await prisma.users.findFirst({
      where: {
        business_id,
        email: data.email,
        id: { not: id }
      }
    });
    if (emailConflict) {
      const error = new Error('Another user with this email address already exists.');
      error.statusCode = 409;
      throw error;
    }
  }

  const updatePayload = {};
  if (data.name) updatePayload.name = data.name;
  if (data.email) updatePayload.email = data.email;
  if (data.phone !== undefined) updatePayload.phone = data.phone || null;
  if (data.role) updatePayload.role = data.role;
  if (data.status) updatePayload.is_active = data.status === 'Active';
  if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

  if (data.custom_role_id !== undefined) {
    if (data.custom_role_id) {
      const customRole = await prisma.custom_roles.findFirst({
        where: { id: data.custom_role_id, business_id, is_active: true }
      });
      if (!customRole) {
        const error = new Error('Assigned custom role does not exist or is inactive.');
        error.statusCode = 400;
        throw error;
      }
      updatePayload.custom_role_id = customRole.id;
    } else {
      updatePayload.custom_role_id = null;
    }
  }

  if (data.password && data.password.trim().length >= 6) {
    updatePayload.password_hash = await bcrypt.hash(data.password, 10);
  }

  const updatedUser = await prisma.users.update({
    where: { id },
    data: updatePayload,
    include: {
      custom_roles: true
    }
  });

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email || 'N/A',
    phone: updatedUser.phone || 'N/A',
    role: updatedUser.role,
    custom_role_id: updatedUser.custom_role_id,
    custom_role: updatedUser.custom_roles || null,
    displayRole: updatedUser.custom_roles ? updatedUser.custom_roles.name : updatedUser.role,
    status: updatedUser.is_active ? 'Active' : 'Inactive',
    is_active: updatedUser.is_active,
    lastLogin: updatedUser.updated_at ? new Date(updatedUser.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'
  };
};

const deleteUser = async (business_id, id, requestingUserId) => {
  const user = await prisma.users.findFirst({
    where: { id, business_id }
  });

  if (!user) {
    const error = new Error('Team user not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.id === requestingUserId) {
    const error = new Error('You cannot delete your own logged-in account.');
    error.statusCode = 400;
    throw error;
  }

  if (user.role === 'ADMIN') {
    const adminCount = await prisma.users.count({
      where: { business_id, role: 'ADMIN', is_active: true }
    });
    if (adminCount <= 1) {
      const error = new Error('Cannot delete the primary ADMIN user account.');
      error.statusCode = 400;
      throw error;
    }
  }

  try {
    await prisma.users.deleteMany({
      where: { id, business_id }
    });
  } catch (err) {
    // Soft delete if foreign key constraints exist
    await prisma.users.updateMany({
      where: { id, business_id },
      data: { is_active: false }
    });
  }

  return { message: `User "${user.name}" removed successfully.` };
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
